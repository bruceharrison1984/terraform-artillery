- Automatically deploy an AWS Lambda to each of the US regions
  - us-east-1
  - us-east-2
  - us-west-1
  - us-west-2

- Automatically run a scenario against all of the deployed lambdas
- Clean up all lambdas once execution has finished

- Dependencies
  - Terraform ^0.9.4
  - Python ^2.7.1

- Notes
  - Lambdas deployed in a region cannot retrieve their source code from an S3 bucket in another region
    - A lambda deployed in us-west-2 cannot retrieve its source code from a bucket in us-east-1
    - This will throw a very strange error
    - This means the source code must be uploaded to each lambda individually
    - It seems like terraform does not do these uploads in parallel
    - average 8 minutes to create all 4 lambdas
    - destroy time less than one minute
  - Count cannot be used on modules, so a unique section is required for each lambda
