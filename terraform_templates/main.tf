provider "aws" {
  region = "us-east-1"
}

module "us_east_1" {
  source           = "./lambda"
  lambda_region    = "us-east-1"
  filename         = "${var.lambda_package}"
  function_name    = "${var.environment}-artillery-us-east-1"
  role_arn         = "${aws_iam_role.artillery.arn}"
  role_id          = "${aws_iam_role.artillery.id}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file(var.lambda_package))}"
  runtime          = "nodejs4.3"
  enabled          = "${var.useast1}"
  env_vars         = "${var.env_vars}"
}

module "us_east_2" {
  source           = "./lambda"
  lambda_region    = "us-east-2"
  filename         = "${var.lambda_package}"
  function_name    = "${var.environment}-artillery-us-east-2"
  role_arn         = "${aws_iam_role.artillery.arn}"
  role_id          = "${aws_iam_role.artillery.id}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file(var.lambda_package))}"
  runtime          = "nodejs4.3"
  enabled          = "${var.useast2}"
  env_vars         = "${var.env_vars}"
}

module "us_west_1" {
  source           = "./lambda"
  lambda_region    = "us-west-1"
  filename         = "${var.lambda_package}"
  function_name    = "${var.environment}-artillery-us-west-1"
  role_arn         = "${aws_iam_role.artillery.arn}"
  role_id          = "${aws_iam_role.artillery.id}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file(var.lambda_package))}"
  runtime          = "nodejs4.3"
  enabled          = "${var.uswest1}"
  env_vars         = "${var.env_vars}"
}

module "us_west_2" {
  source           = "./lambda"
  lambda_region    = "us-west-2"
  filename         = "${var.lambda_package}"
  function_name    = "${var.environment}-artillery-us-west-2"
  role_arn         = "${aws_iam_role.artillery.arn}"
  role_id          = "${aws_iam_role.artillery.id}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file(var.lambda_package))}"
  runtime          = "nodejs4.3"
  enabled          = "${var.uswest2}"
  env_vars         = "${var.env_vars}"
}

resource "aws_iam_role" "artillery" {
  name = "${var.environment}-artillery"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}
