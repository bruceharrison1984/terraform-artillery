variable "lambda_region" {}

# variable "s3_bucket" {}
# variable "s3_key" {}

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
  # s3_bucket = "${var.s3_bucket}"    # s3_key    = "${var.s3_key}"

  function_name = "${var.function_name}"

  filename         = "${var.filename}"
  role             = "${var.role}"
  handler          = "${var.handler}"
  source_code_hash = "${var.source_code_hash}"
  runtime          = "${var.runtime}"
  provider         = "aws.myregion"
}
