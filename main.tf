provider "aws" {
  region = "us-east-1"
}

module "us_east_1" {
  source           = "./modules/lambda"
  lambda_region    = "us-east-1"
  filename         = "./out/lambda.zip"
  function_name    = "artillery-us-east-1"
  role             = "${aws_iam_role.artillery.arn}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file("out/lambda.zip"))}"
  runtime          = "nodejs4.3"
}

module "us_east_2" {
  source           = "./modules/lambda"
  lambda_region    = "us-east-2"
  filename         = "./out/lambda.zip"
  function_name    = "artillery-us-east-2"
  role             = "${aws_iam_role.artillery.arn}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file("out/lambda.zip"))}"
  runtime          = "nodejs4.3"
}

module "us_west_1" {
  source           = "./modules/lambda"
  lambda_region    = "us-west-1"
  filename         = "./out/lambda.zip"
  function_name    = "artillery-us-west-1"
  role             = "${aws_iam_role.artillery.arn}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file("out/lambda.zip"))}"
  runtime          = "nodejs4.3"
}

resource "aws_iam_role" "artillery" {
  name = "artillery"

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
