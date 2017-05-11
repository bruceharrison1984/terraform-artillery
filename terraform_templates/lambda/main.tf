variable "enabled" {}
variable "lambda_region" {}
variable "filename" {}
variable "function_name" {}
variable "role_arn" {}
variable "role_id" {}
variable "handler" {}
variable "source_code_hash" {}
variable "runtime" {}

variable "env_vars" {
  type = "map"
}

provider "aws" {
  alias  = "myregion"
  region = "${var.lambda_region}"
}

resource "aws_lambda_function" "artillery_lambda" {
  function_name = "${var.function_name}"

  count            = "${var.enabled}"
  filename         = "${var.filename}"
  role             = "${var.role_arn}"
  handler          = "${var.handler}"
  source_code_hash = "${var.source_code_hash}"
  runtime          = "${var.runtime}"
  memory_size      = "512"
  timeout          = "300"
  provider         = "aws.myregion"

  environment {
    variables = "${var.env_vars}"
  }
}

resource "aws_iam_role_policy" "artillery_cloudwatch_policy" {
  name  = "${var.function_name}-cloudwatch-policy"
  role  = "${var.role_id}"
  count = "${var.enabled}"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "${aws_cloudwatch_log_group.artillery_logs.arn}"
    }
  ]
}
EOF
}

resource "aws_cloudwatch_log_group" "artillery_logs" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 90
  count             = "${var.enabled}"
}
