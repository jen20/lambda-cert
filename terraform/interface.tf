variable "description" {
	type = "string"
	description = "Purpose of this TLS key (for tags etc)"
}

variable "handler_package" {
	type = "string"
	description = "Location of the Lambda function handler"
}

variable "handler_package_sha" {
	type = "string"
	description = "Base 64-encoded SHA256 hash of the Lambda function handler"
}

variable "function_name" {
	type = "string"
	description = "Name to use for function, policy etc"
}

variable "acme_url" {
	type = "string"
	description = "ACMEv2 API endpoint (defaults to Let's Encrypt Staging)"
	default = "https://acme-staging-v02.api.letsencrypt.org/directory"
}

variable "bucket_name_prefix" {
	type = "string"
	description = "Name for the bucket/key"
}

variable "service_name" {
	type = "string"
	description = "Service name (* for wildcard)"
}

variable "top_level_domain" {
	type = "string"
	description = "TLD, used for locating the appropriate Route 53 hosted zone"
}

variable "admin_email" {
	type = "string"
	description = "Admin Email for Let's Encrypt registration"
}

variable "generate_java_keystore" {
	type = "string"
	description = "Set to any non-empty value to generate a Java KeyStore from the certificate"
	default = ""
}

data "aws_route53_zone" "public" {
	name = "${var.top_level_domain}."
	private_zone = false
}

output "key_bucket_arn" {
	value = "${aws_s3_bucket.key.arn}"
}

output "key_bucket_name" {
	value = "${aws_s3_bucket.key.bucket}"
}

output "kms_key_arn" {
	value = "${aws_kms_key.key.arn}"
}

output "kms_key_id" {
	value = "${aws_kms_key.key.key_id}"
}
