package client

import (
	"crypto/rand"
	"crypto/rsa"
	"fmt"

	"github.com/xenolf/lego/acmev2"
	"github.com/xenolf/lego/providers/dns/route53"
)

type ACME struct {
	s3Client   *S3
	legoClient *acme.Client
}

const configPath = "config/config.json.enc"

func NewACME(email string, acmeURL string, s3Client *S3) (*ACME, error) {
	config, err := s3Client.GetEncryptedObject(configPath)
	if err != nil {
		if s3Client.IsNoSuchKey(err) || s3Client.IsAccessDenied(err) {
			return newRegistration(email, acmeURL, s3Client)
		}

		return nil, err
	}

	acmeUser, err := UserFromJSONBytes(config)
	if err != nil {
		return nil, err
	}

	acmeClient, err := acme.NewClient(acmeURL, acmeUser, acme.RSA4096)
	if err != nil {
		return nil, err
	}
	err = configureClient(acmeClient)
	if err != nil {
		return nil, err
	}

	return &ACME{
		s3Client:   s3Client,
		legoClient: acmeClient,
	}, nil
}

func configureClient(acmeClient *acme.Client) error {
	acmeClient.ExcludeChallenges([]acme.Challenge{
		acme.HTTP01,
	})

	dnsProvider, err := route53.NewDNSProvider()
	if err != nil {
		return err
	}

	err = acmeClient.SetChallengeProvider("dns-01", dnsProvider)
	if err != nil {
		return err
	}

	return nil
}

func (c *ACME) ObtainCertificate(commonName string, otherNames []string) (*acme.CertificateResource, error) {
	names := []string{commonName}
	names = append(names, otherNames...)

	resource, err := c.legoClient.ObtainCertificate(names, true, nil, false)
	if err != nil {
		return nil, fmt.Errorf("%v", err)
	}

	return &resource, nil
}

func newRegistration(email, acmeURL string, s3Client *S3) (*ACME, error) {
	reader := rand.Reader
	key, err := rsa.GenerateKey(reader, 4096)
	if err != nil {
		return nil, err
	}

	user := User{
		key:   key,
		Email: email,
	}

	acmeClient, err := acme.NewClient(acmeURL, &user, acme.RSA4096)
	if err != nil {
		return nil, err
	}

	registration, err := acmeClient.Register(true)
	if err != nil {
		return nil, err
	}
	user.Registration = registration

	err = configureClient(acmeClient)
	if err != nil {
		return nil, err
	}

	configToSave, err := user.Marshal()
	if err != nil {
		return nil, err
	}

	err = s3Client.PutEncryptedObject(configPath, configToSave)
	if err != nil {
		return nil, err
	}

	return &ACME{
		s3Client:   s3Client,
		legoClient: acmeClient,
	}, nil
}
