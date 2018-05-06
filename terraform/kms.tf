data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "key" {
	statement {
		sid = "Delegate Key Access to IAM"
		effect = "Allow"
		principals {
			type = "AWS"
			identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
		}
		actions = [
			"kms:*"
		]
		resources = ["*"]
	}
}

resource "aws_kms_key" "key" {
	description = "${var.description} TLS Keys"
	deletion_window_in_days = 14
	policy = "${data.aws_iam_policy_document.key.json}"
}
