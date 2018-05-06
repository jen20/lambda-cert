package client

import (
	"crypto"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"

	"github.com/xenolf/lego/acmev2"
)

type User struct {
	Email        string
	Registration *acme.RegistrationResource
	key          *rsa.PrivateKey
}

type userJson struct {
	Email        string                     `json:"email"`
	KeyPEM       string                     `json:"keyPEM"`
	Registration *acme.RegistrationResource `json:"registration"`
}

func UserFromJSONBytes(encoded []byte) (*User, error) {
	var unmarshaled userJson
	if err := json.Unmarshal(encoded, &unmarshaled); err != nil {
		return nil, err
	}

	block, _ := pem.Decode([]byte(unmarshaled.KeyPEM))
	if block == nil {
		return nil, errors.New("unmarshaled key is not PEM-encoded")
	}

	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("error parsing decrypted key: %s", err)
	}

	return &User{
		Email:        unmarshaled.Email,
		Registration: unmarshaled.Registration,
		key:          key,
	}, nil
}

func (u *User) GetEmail() string {
	return u.Email
}

func (u *User) GetRegistration() *acme.RegistrationResource {
	return u.Registration
}

func (u *User) GetPrivateKey() crypto.PrivateKey {
	return u.key
}

func (u *User) Marshal() ([]byte, error) {
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(u.key),
	})

	toMarshal := userJson{
		KeyPEM:       string(privateKeyPEM),
		Registration: u.Registration,
		Email:        u.Email,
	}

	return json.MarshalIndent(toMarshal, "", "\t")
}
