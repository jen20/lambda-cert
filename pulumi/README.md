# @operator-error/pulumi-lambda-cert

_This is a package containing components for use with [Pulumi][pulumi], a tool for provisioning cloud infrastructure 
based on a description written with general purpose programming languages._

This package provides a component named `LambdaCert`, which can be used to create the resources
needed to run [Lambda Cert][lambdacert], a function for maintaining Let's Encrypt certificates using
AWS Lambda.

## Usage

```typescript
import { LambdaCert, LambdaCertOutputs, letsEncryptV2ProductionUrl } from "@operator-error/pulumi-lambda-cert"

async function main(): Promise<LambdaCertOutputs> {
	return await LambdaCert.create("vault", {
		// A Description of the purpose of this configuration (e.g. "Vault", "HAProxy"). Used in Tags.
		description: "Vault",

		// These tags will be applied to every object which supports tagging.
		// Avoid using `Name`, since this will be overridden by many components.
		baseTags: {
			Project: "Staging Vault",
		},

		// The part of the domain name for which a certificate is required which does _not_
		// form part of the hosted zone name. For example, if requesting a certificate for
		// `*.vault.operator-error.com`, and the public hosted zone is for `operator-error.com`,
		// `domainNamePrefix` should be set to `*.vault` (without a trailing `.`).
		domainNamePrefix: "vault-staging",
		// The part of the domain name for which a certificate is required which is included
		// in the hosted zone name.
		route53DomainName: "operator-error.com",

		// The admin email address to provide to the ACME service when creating an account.
		adminEmail: "webmaster@operator-error.com",

		// The URL of the ACME server. Defaults to Let's Encrypt ACME V2 Staging. Constants
		// are exported from the package for both Let's Encrypt staging and production.
		acmeUrl: letsEncryptV2ProductionUrl,

		// If set to true, add the certificate to an Java KeyStore encrypted with the same
		// KMS key as the private key, and uploaded to the bucket along with the certificate
		// and encrypted private key.
		generateJavaKeyStore: true,

		// If set to true, force delete the entire contents of the bucket when destroying
		// the component using Pulumi. This can be useful for quick iteration in development
		// when using a staging endpoint, though be wary of rate limits when using a real
		// ACME service.
		emptyBucketOnDestroy: true,
	});
}

const outputs = main();
export const keyBucketArn = outputs.then(o => o.keyBucketArn);
export const keyBucketName = outputs.then(o => o.keyBucketName);
export const kmsKeyArn = outputs.then(o => o.kmsKeyArn);
export const kmsKeyId = outputs.then(o => o.kmsKeyId);
```

Running a [`pulumi preview`][pulumipreview] of the above program in the `us-west-2` region results in the following:

```
❯ pulumi preview
Previewing update of stack 'vault-staging'
Previewing changes:

     Type                                 Name                                   Plan       Info
 +   pulumi:pulumi:Stack                  pulumi-lambda-cert-test-vault-staging  create
 +   └─ operator-error:aws:LambdaCert     vault-lambda-cert                      create
 +      ├─ aws:iam:Role                   vault-lambda-cert-function-role        create
 +      │  └─ aws:iam:RolePolicy          vault-lambda-cert-function-policy      create
 +      ├─ aws:kms:Key                    vault-lambda-cert-kms-key              create
 +      ├─ aws:s3:Bucket                  vault-lambda-cert-bucket               create
 +      ├─ aws:lambda:Function            vault-lambda-cert-function             create
 +      │  └─ aws:lambda:Permission       vault-lambda-cert-permission           create
 +      └─ aws:cloudwatch:EventRule       vault-lambda-cert-schedule             create
 +         └─ aws:cloudwatch:EventTarget  vault-lambda-cert-target               create

info: 10 changes previewed:
    + 10 resources to create
```

## License

This package is licensed under the [Mozilla Public License, v2.0][mpl2].

## Contributing

Please feel free to open issues or pull requests on GitHub.

[pulumi]: https://pulumi.io
[lambdacert]: https://github.com/jen20/lambda-cert
[pulumipreview]: https://pulumi.io/reference/cli/pulumi_preview.html
[mpl2]: https://www.mozilla.org/en-US/MPL/2.0/
