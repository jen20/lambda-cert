package cert

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"path"
	"time"

	"github.com/jen20/lambda-cert/client"
)

func NeedsRenewal(configVariable string, gracePeriod time.Duration,
	s3Client *client.S3) (bool, error) {

	names, err := NamesFromConfigVar(configVariable)
	if err != nil {
		return false, err
	}

	if len(names) != 1 {
		return false, fmt.Errorf("only one primary domain may be specified, %d found", len(names))
	}

	name := names[0]
	certPath := path.Join(names[0], "cert.crt")

	log.Printf("[INFO] Looking for %s/cert.crt", name)
	certBytes, err := s3Client.GetUnencryptedObject(certPath)
	if err != nil {
		if s3Client.IsNoSuchKey(err) || s3Client.IsAccessDenied(err) {
			log.Printf("[INFO] No certificate for %s/cert.crt", name)
			return true, nil
		}

		return true, err
	}
	log.Printf("[INFO] Examining %s/cert.crt", name)

	certificate, err := loadFromBytes(certBytes)
	if err != nil {
		return true, err
	}

	if isExpiryWithinDuration(certificate, gracePeriod) {
		log.Printf("[INFO] Certificate %q is within expiry window, will renew", name)
		return true, nil
	}

	log.Printf("[INFO] Certificate %q is not within expiry window", name)
	return false, nil
}

func loadFromBytes(certBytes []byte) (*x509.Certificate, error) {
	block, _ := pem.Decode(certBytes)
	if block == nil {
		return nil, errors.New("certificate is not PEM-encoded")
	}

	return x509.ParseCertificate(block.Bytes)
}

func isExpiryWithinDuration(cert *x509.Certificate, duration time.Duration) bool {
	return cert.NotAfter.Before(time.Now().UTC().Add(duration))
}
