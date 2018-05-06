package client

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"path"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/kms"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3crypto"
)

type S3 struct {
	client *s3.S3

	encryptionClient *s3crypto.EncryptionClient
	decryptionClient *s3crypto.DecryptionClient

	bucketName   string
	bucketPrefix string

	maxSize int
}

func NewS3(session *session.Session, region, bucketName, bucketPrefix string, keyId string, maxObjectSize int) *S3 {
	s3Client := s3.New(session, aws.NewConfig().WithRegion(region))
	kmsClient := kms.New(session, aws.NewConfig().WithRegion(region))

	var encryptionClient *s3crypto.EncryptionClient
	if keyId != "" {
		encryptionHandler := s3crypto.NewKMSKeyGenerator(kmsClient, keyId)
		encryptionClient = s3crypto.NewEncryptionClient(session, s3crypto.AESGCMContentCipherBuilder(encryptionHandler))
	}
	decryptionClient := s3crypto.NewDecryptionClient(session)

	return &S3{
		client:           s3Client,
		encryptionClient: encryptionClient,
		decryptionClient: decryptionClient,
		bucketName:       bucketName,
		bucketPrefix:     bucketPrefix,
		maxSize:          maxObjectSize,
	}
}

func (client *S3) PutEncryptedObject(objectPath string, objectBytes []byte) error {
	prefixedPath := path.Join(client.bucketPrefix, objectPath)

	_, err := client.encryptionClient.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(client.bucketName),
		Key:    aws.String(prefixedPath),
		ACL:    aws.String("private"),
		Body:   bytes.NewReader(objectBytes),
	})
	if err != nil {
		return err
	}

	return nil
}

func (client *S3) GetEncryptedObject(objectPath string) ([]byte, error) {
	prefixedPath := path.Join(client.bucketPrefix, objectPath)

	response, err := client.decryptionClient.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(client.bucketName),
		Key:    aws.String(prefixedPath),
	})
	if err != nil {
		return nil, err
	}

	if *response.ContentLength > int64(client.maxSize) {
		return nil, fmt.Errorf("object too large: %s bytes", *response.ContentLength)
	}

	defer response.Body.Close()
	return ioutil.ReadAll(response.Body)
}

func (client *S3) GetUnencryptedObject(objectPath string) ([]byte, error) {
	prefixedPath := path.Join(client.bucketPrefix, objectPath)

	response, err := client.client.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(client.bucketName),
		Key:    aws.String(prefixedPath),
	})
	if err != nil {
		return nil, err
	}

	if *response.ContentLength > int64(client.maxSize) {
		return nil, fmt.Errorf("object too large: %s bytes", *response.ContentLength)
	}

	defer response.Body.Close()
	return ioutil.ReadAll(response.Body)
}

func (client *S3) PutUnencryptedObject(objectPath string, objectBytes []byte) error {
	prefixedPath := path.Join(client.bucketPrefix, objectPath)

	_, err := client.client.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(client.bucketName),
		Key:    aws.String(prefixedPath),
		ACL:    aws.String("private"),
		Body:   bytes.NewReader(objectBytes),
	})
	if err != nil {
		return err
	}

	return nil
}

func (client *S3) IsNoSuchKey(err error) bool {
	if awsErr, ok := err.(awserr.Error); ok {
		return awsErr.Code() == s3.ErrCodeNoSuchKey
	}

	return false
}

func (client *S3) IsAccessDenied(err error) bool {
	if awsErr, ok := err.(awserr.Error); ok {
		return awsErr.Code() == "AccessDenied"
	}

	return false
}
