package jks

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"time"

	"github.com/pavel-v-chernykh/keystore-go"
	"github.com/xenolf/lego/acmev2"
)

func BuildJavaKeyStore(certificate *acme.CertificateResource) ([]byte, error) {
	cert, err := tls.X509KeyPair(certificate.Certificate, certificate.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("error parsing key pair: %s", err)
	}

	pcks8Key, err := x509.MarshalPKCS8PrivateKey(cert.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("error marshalling key pair to PKCS8: %s", err)
	}

	keyStore := keystore.KeyStore{
		"alias": &keystore.PrivateKeyEntry{
			Entry: keystore.Entry{
				CreationDate: time.Now(),
			},
			PrivKey: pcks8Key,
		},
	}

	var encoded bytes.Buffer
	err = keystore.Encode(&encoded, keyStore, []byte{})
	if err != nil {
		return nil, fmt.Errorf("error marshalling key store: %s", err)
	}

	return encoded.Bytes(), nil
}
