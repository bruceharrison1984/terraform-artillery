provider "aws" {
  # alias  = "home_region"
  region = "us-east-1"
}

# resource "aws_s3_bucket" "artillery_packages" {
#   bucket   = "artillery-packages"
#   acl      = "private"
#   provider = "aws.home_region"
# }

# resource "aws_s3_bucket_object" "artillery_package" {
#   bucket   = "${aws_s3_bucket.artillery_packages.id}"
#   key      = "package.zip"
#   source   = "./out/lambda.zip"
#   etag     = "${md5(file("./out/lambda.zip"))}"
#   provider = "aws.home_region"
# }

module "us_east_1" {
  source        = "./modules/lambda"
  lambda_region = "us-east-1"

  # s3_bucket     = "${aws_s3_bucket.artillery_packages.id}"
  # s3_key        = "${aws_s3_bucket_object.artillery_package.id}"

  filename         = "./out/lambda.zip"
  function_name    = "artillery-us-east-1"
  role             = "${aws_iam_role.artillery.arn}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file("out/lambda.zip"))}"
  runtime          = "nodejs4.3"
}

module "us_east_2" {
  source        = "./modules/lambda"
  lambda_region = "us-east-2"

  # s3_bucket     = "${aws_s3_bucket.artillery_packages.id}"
  # s3_key        = "${aws_s3_bucket_object.artillery_package.id}"

  filename         = "./out/lambda.zip"
  function_name    = "artillery-us-east-2"
  role             = "${aws_iam_role.artillery.arn}"
  handler          = "handler.handler"
  source_code_hash = "${base64sha256(file("out/lambda.zip"))}"
  runtime          = "nodejs4.3"
}

module "us_west_1" {
  source        = "./modules/lambda"
  lambda_region = "us-west-1"

  # s3_bucket     = "${aws_s3_bucket.artillery_packages.id}"
  # s3_key        = "${aws_s3_bucket_object.artillery_package.id}"

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
