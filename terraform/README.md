## `lambda-cert` Terraform Module

This Terraform module can be used for configuring AWS resources in order to use `lambda-cert`. Configuration is intended
to account for a some flexibility, but if different behaviour is desired it is likely better to use this module as a
starting point for your own rather than using it directly.

### Usage

The following module block can be used to reference this module directly:

```hcl
module "lambda_cert" {
        source = "github.com/jen20/lambda-cert//terraform"
        
        description = "Vault"
        function_name = "MaintainVaultTLSCertificate"

        handler_package = "path/to/handler.zip"
        handler_package_sha = "<INSERT SHA HERE>"
        
        bucket_name_prefix = "vault-tls"
        service_name = "*.vault"
        top_level_domain = "<INSERT TLD HERE>"
        
        admin_email = "<INSERT EMAIL HERE>"
        
        # Set this to the production endpoing once satisfied with
        # the rest of the configuration
        acme_url = "https://acme-staging-v02.api.letsencrypt.org/directory"
}
```

The following variables are required:

- `description` - Description of the purpose of this configuration (e.g. "Vault", "HAProxy"). Used
  in Tags.
- `function_name` - Name used for Lambda and IAM resources for this configuration.
- `handler_package` - Path to a release package from this repository.
- `handler_package_sha` - SHA256 checksum of the release package.
- `bucket_name_prefix` - Prefix used for the S3 bucket name. A suffix of `-key` is applied.
- `service_name` - The name to use for the certificate (e.g. `vault`). Forms the complete name when
  `top_level_domain` is appended. Wildcards certificates can be issued using `*`.
- `top_level_domain` - The TLD of the name for the certificate (e.g. `amazon.com`). Forms the
  complete name when appended to `service_name`. `top_level_domain` should be the part of the name
  for which a hosted zone exists in Route.  53, in order that the `DNS-01` challenge can be
  completed.
- `admin_email` - The email address to which renewal reminders will be sent.
- `acme_url` - The URL of the ACME server for the certificate authority. Defaults to the Let's
  Encrypt Staging API.

The following outputs are produced:

- `key_bucket_arn` - The ARN of the bucket in which certificates and keys are stored.
- `key_bucket_name` - The name of the bucket in which certificates and keys are stored.
- `kms_key_arn` - The ARN of the KMS key which can be used to decrypt the private key.
- `kms_key_id` - The ID of the KMS key which can be used to decrypt the private key.
