package main

import (
	"io/ioutil"
	"log"
	"os"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jen20/lambda-cert/client"
	"github.com/spf13/pflag"
)

func main() {
	var region string
	var bucketName string
	var bucketPrefix string
	var secretKey string
	var outputFile string

	pflag.StringVar(&region, "region", os.Getenv("AWS_REGION"),
		"Region in which the bucket exists")
	pflag.StringVar(&bucketName, "bucket-name", "",
		"Name of the bucket")
	pflag.StringVar(&bucketPrefix, "bucket-prefix", "",
		"Bucket prefix")
	pflag.StringVar(&secretKey, "secret-key", "",
		"Key to secret in bucket")
	pflag.StringVar(&outputFile, "output-file", "",
		"Path to which to write")

	pflag.Parse()

	if region == "" {
		log.Fatalf("--region is required")
	}
	if bucketName == "" {
		log.Fatalf("--bucket-name is required")
	}
	if secretKey == "" {
		log.Fatalf("--secret-key is required")
	}
	if outputFile == "" {
		log.Fatalf("--output-file is required")
	}

	awsSession, err := session.NewSession()
	if err != nil {
		log.Fatalf("Cannot create session: %s", err)
	}

	s3 := client.NewS3(awsSession, region, bucketName, bucketPrefix,
		"", 10*1024*1024)

	resp, err := s3.GetEncryptedObject(secretKey)
	if err != nil {
		log.Fatalf("Cannot get object: %s", err)
	}

	err = ioutil.WriteFile(outputFile, resp, 0600)
	if err != nil {
		log.Fatalf("Cannot write file %q: %s", outputFile, err)
	}
}
