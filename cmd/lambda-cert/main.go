package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/jen20/lambda-cert/cert"
	"github.com/jen20/lambda-cert/client"
)

func CertHandler(ctx context.Context) error {
	letsEncryptURL := os.Getenv("ACME_SERVER_URL")
	if letsEncryptURL == "" {
		letsEncryptURL = "https://acme-v01.api.letsencrypt.org/directory"
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		return errors.New("[ERROR] value must be specified for ADMIN_EMAIL in environment")
	}

	domainName := os.Getenv("CERTIFICATE_NAME")
	if domainName == "" {
		return errors.New("[ERROR] value must be specified for CERTIFICATE_NAME in environment")
	}

	additionalNames := os.Getenv("CERTIFICATE_ADDITIONAL_NAMES")
	var additionalNameSlice []string
	if additionalNames != "" {
		var err error
		additionalNameSlice, err = cert.NamesFromConfigVar(additionalNames)
		if err != nil {
			return fmt.Errorf("[ERROR] Error reading CERTIFICATE_ADDITIONAL_NAMES: %s", err)
		}
	}

	region := os.Getenv("AWS_REGION")
	if region == "" {
		return errors.New("[ERROR] value must be specified for AWS_REGION in environment")
	}

	bucketName := os.Getenv("BUCKET_NAME")
	if bucketName == "" {
		return errors.New("[ERROR] value must be specified for BUCKET_NAME in environment")
	}

	kmsKeyId := os.Getenv("KMS_KEY_ID")
	if kmsKeyId == "" {
		return errors.New("[ERROR] value must be specified for KMS_KEY_ID in environment")
	}

	// Empty value is allow for BUCKET_PREFIX
	bucketPrefix := os.Getenv("BUCKET_PREFIX")

	gracePeriodHoursString := os.Getenv("EARLY_RENEWAL_PERIOD_HOURS")
	if gracePeriodHoursString == "" {
		gracePeriodHoursString = "72"
	}

	gracePeriodHours, err := strconv.Atoi(gracePeriodHoursString)
	if err != nil {
		log.Printf("[ERROR] Parsing EARLY_RENEWAL_PERIOD_HOURS: %s", err)
		return err
	}
	if gracePeriodHours < 24 {
		log.Printf("[ERROR] EARLY_RENEWAL_PERIOD_HORUS must be >= 24 if set")
		return err
	}
	gracePeriod := time.Duration(gracePeriodHours) * time.Hour

	awsSession, err := session.NewSession()
	if err != nil {
		log.Printf("[ERROR] Creating AWS Session: %s", err)
		return err
	}

	_, err = awsSession.Config.Credentials.Get()
	if err != nil {
		log.Printf("[ERROR] No credentials available; %s", err)
		return err
	}

	s3Client := client.NewS3(awsSession, region, bucketName, bucketPrefix, kmsKeyId, 1024*1024)

	needsRenewal, err := cert.NeedsRenewal(domainName, gracePeriod, s3Client)
	if err != nil {
		log.Printf("[ERROR] Validating existing certificates: %s", err)
		return err
	}

	if !needsRenewal {
		log.Print("[INFO] No need to do anything - all certificates are present and within expiry window")
		return nil
	}

	acmeClient, err := client.NewACME(adminEmail, letsEncryptURL, s3Client)
	if err != nil {
		log.Printf("[ERROR] Failed to create ACME client: %s", err)
		return err
	}

	certificate, err := acmeClient.ObtainCertificate(domainName, additionalNameSlice)
	if err != nil {
		log.Printf("[ERROR] Obtaining certificate: %s", err)
		return err
	}

	privateKeyPath := path.Join(domainName, "cert.key.enc")
	err = s3Client.PutEncryptedObject(privateKeyPath, certificate.PrivateKey)
	if err != nil {
		log.Printf("[ERROR] Uploading Key: %s", err)
		return err
	}

	certificatePath := path.Join(domainName, "cert.crt")
	err = s3Client.PutUnencryptedObject(certificatePath, certificate.Certificate)
	if err != nil {
		log.Printf("[ERROR] Uploading Certificate: %s", err)
		return err
	}

	return nil
}

func main() {
	lambda.Start(CertHandler)
}
