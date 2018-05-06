## `lambda-cert`

`lambda-cert` is a lambda function which can be used to obtain TLS certificates from a certificate
authority using the `acme` API (for example, [Let's Encrypt][le]). The private key is encrypted
using KMS, and stored along with the certificate (unencrypted) in an S3 bucket.

A policy granting access to these files and the Decrypt operation for the KMS key can be assigned to
a role associated with an instance profile in order for servers to obtain the keys on startup.

`lambda-cert` completes the [DNS-01][dns1] challenge using AWS Route 53 in order to verify control
of a particular domain.

An accompanying utility `s3-get-secret` shares much of the same codebase, and can be used to
download and decrypt certificates from S3 without needing additional dependencies.

Note that this is only really intended to be used in circumstances where ACM certificates are
unpalatable - that is, if TLS termination is being done inside an instance specifically, or where a
self-signed CA cannot be used. It is especially useful for [HashiCorp Vault][vault] clusters, since
each client need not be provisioned with an additional root certificate, provided they already trust
certificates issued by Let's Encrypt.

### Rationale

The rate limits for ACME with Let's Encrypt mean that renewing a certificate for each member of a
large cluster whenever a new image is deployed (say, a rolling upgrade of an auto-scaling group)
cannot be achieved. In this model, Lambda manages the initial creation and subsequent renewal of the
certificate, and the instances making use of the certificates can simply obtain the files from S3,
and update them on a regular basis.

Even in smaller clusters which are not affected by the rate limit, it is preferable not to delegate
control over DNS records in an instance policy, given the limited granularity with which AWS IAM
exposes controls over Route 53 hosted zones.

### Building

During development, `lambda-cert` and `s3-get-secret` can be built using `go build`. 

Releases are made using `goreleaser`. _You should likely build binaries yourself rather than
trusting these._

### Contributing

Feedback, issues and pull requests are welcome!

### Terraform Module

A [Terraform][terraform] module is included in the `terraform/` directory. See the
[README][tfreadme] in that directory for more documentation.

### Example lambda function policy

Substitute values as necessary for your certificates:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "<KMS KEY ARN>"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
            ],
            "Resource": [
                "arn:aws:s3:::<BUCKET NAME>/<BUCKET PREFIX>/config/config.json.enc",
                "arn:aws:s3:::<BUCKET NAME>/<BUCKET_PRFIX>/<NAME>/cert.crt",
                "arn:aws:s3:::<BUCKET NAME>/<BUCKET_PRFIX>/<NAME>/cert.key.enc"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:ChangeResourceRecordSets"
            ],
            "Resource": [
                "arn:aws:route53:::hostedzone/<HOSTED ZONE ID>"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:GetChange",
                "route53:ListHostedZonesByName"
            ],
            "Resource": "*"
        }
    ]
}
```

[le]: https://letsencrypt.org/
[vault]: https://vaultproject.io
[mage]: https://magefile.org
[terraform]: https://terraform.io
[tfreadme]: ./terraform/README.md
