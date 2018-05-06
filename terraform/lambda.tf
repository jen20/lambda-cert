data "aws_iam_policy_document" "assume_role" {
	statement {
		effect = "Allow"
		actions = [
			"sts:AssumeRole",
		]
		principals {
			type = "Service"
			identifiers = ["lambda.amazonaws.com"]
		}
	}
}

resource "aws_iam_role" "cert" {
	name = "${var.function_name}"
	path = "/lambda/"
	assume_role_policy = "${data.aws_iam_policy_document.assume_role.json}"
}

resource "aws_iam_role_policy" "cert" {
	name = "${var.function_name}"
	role = "${aws_iam_role.cert.id}"
	policy = "${data.aws_iam_policy_document.cert.json}"
}

resource "aws_lambda_function" "cert" {
	function_name = "${var.function_name}"
	description = "Maintain TLS Certificates via lambda-cert"

	runtime = "go1.x"
	handler = "lambda-cert"

	role = "${aws_iam_role.cert.arn}"
	timeout = 300

	filename = "${var.handler_package}"
	source_code_hash = "${var.handler_package_sha}"

	environment {
		variables {
			ACME_SERVER_URL = "${var.acme_url}"
			KMS_KEY_ID = "${aws_kms_key.key.id}"
			BUCKET_NAME = "${aws_s3_bucket.key.id}"
			CERTIFICATE_NAME = "${var.service_name}.${var.top_level_domain}"
			ADMIN_EMAIL = "${var.admin_email}"
		}
	}
}

resource "aws_cloudwatch_event_rule" "cert" {
	name = "${var.function_name}"
	description = "Run ${var.function_name} every 12 hours"
	schedule_expression = "rate(12 hours)"

	# Ensure function exists for first run
	depends_on = ["aws_lambda_function.cert"]
}


resource "aws_cloudwatch_event_target" "cert" {
	rule = "${aws_cloudwatch_event_rule.cert.name}"
	target_id = "${var.function_name}"
	arn = "${aws_lambda_function.cert.arn}"
}

resource "aws_lambda_permission" "with_cloudwatch" {
	statement_id = "AllowExecutionFromCloudWatch"
	action = "lambda:InvokeFunction"
	function_name = "${aws_lambda_function.cert.function_name}"
	principal = "events.amazonaws.com"
	source_arn = "${aws_cloudwatch_event_rule.cert.arn}"
}
