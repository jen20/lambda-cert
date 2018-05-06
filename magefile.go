// +build mage

package main

import (
	"context"
	"path"

	"github.com/magefile/mage/sh"
)

const (
	rootPkg = "github.com/jen20/lambda-cert"

	dirGoreleaser = "goreleaser"
)

func ReleaseS3GetSecret(ctx context.Context) error {
	config := path.Join(dirGoreleaser, "s3-get-secret.yml")

	return sh.RunV("goreleaser", "--rm-dist", "--config", config)
}

func ReleaseLambdaCert(ctx context.Context) error {
	config := path.Join(dirGoreleaser, "lambda-cert.yml")

	return sh.RunV("goreleaser", "--rm-dist", "--config", config)
}
