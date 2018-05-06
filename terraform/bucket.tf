resource "aws_s3_bucket" "key" {
	bucket = "${lower(replace(var.bucket_name_prefix, " ", "-"))}-key"
	acl = "private"

	tags {
		Name = "${var.description} TLS Keys"
	}
}
