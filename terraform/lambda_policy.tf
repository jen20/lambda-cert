data "aws_iam_policy_document" "cert" {
	statement {
		effect = "Allow"
		actions = [
			"logs:CreateLogGroup",
			"logs:CreateLogStream",
			"logs:PutLogEvents"
		]
		resources = [
			"arn:aws:logs:*:*:*"
		]
	}

	statement {
		effect = "Allow"
		actions = [
			"kms:Encrypt",
			"kms:Decrypt",
			"kms:GenerateDataKey"
		]
		resources = [
			"${aws_kms_key.key.arn}"
		]
	}

	statement {
		effect = "Allow"
		actions = [
			"route53:GetChange",
			"route53:ListHostedZonesByName"
		]
		resources = ["*"]
	}

	statement {
		effect = "Allow"
		actions = [
			"route53:ChangeResourceRecordSets"
		]
		resources = [
			"arn:aws:route53:::hostedzone/${data.aws_route53_zone.public.id}"
		]
	}

	statement {
		effect = "Allow"
		actions = [
			"s3:PutObject",
			"s3:GetObject"
		]
		resources = [
			"${aws_s3_bucket.key.arn}/config/config.json.enc",
			"${aws_s3_bucket.key.arn}/${var.service_name}.${var.top_level_domain}/cert.crt",
			"${aws_s3_bucket.key.arn}/${var.service_name}.${var.top_level_domain}/cert.key.enc",
		]
	}
}
