variable "enabled" {}
variable "lambda_region" {}
variable "filename" {}
variable "function_name" {}
variable "role" {}
variable "handler" {}
variable "source_code_hash" {}
variable "runtime" {}

provider "aws" {
  alias  = "myregion"
  region = "${var.lambda_region}"
}

resource "aws_lambda_function" "artillery_lambda" {
  function_name = "${var.function_name}"

  count            = "${var.enabled}"
  filename         = "${var.filename}"
  role             = "${var.role}"
  handler          = "${var.handler}"
  source_code_hash = "${var.source_code_hash}"
  runtime          = "${var.runtime}"
  memory_size      = "512"
  timeout          = "300"
  provider         = "aws.myregion"
}
