# terraform-artillery

This project is very similar to [Nordstrom/serverless-artillery](https://github.com/Nordstrom/serverless-artillery), minus using [serverless](https://github.com/serverless/serverless) to deploy the lambdas. I liked serverless-artillery so much, the handler.js is the same one that they include in their project. That will no doubt change over time, but it suits my purpose perfectly for the time being.

I created the project due to my distaste for serverless. Rather than introduce another AWS deployment tool in to my toolbox, I opted to use Terraform to deploy Artillery in to an AWS Lambda, and then run it remotely.

### Hard Dependencies
- Terraform ^0.9.4 on PATH
  - Lower versions may work depending on your terraform templatees
  - [Download](https://www.terraform.io/downloads.html)

## Features
- Simultaneously deploy an AWS Lambda to each of the US regions
- Run a scenario N times against all of the deployed lambdas
- Run a directory of scenarios N times against all of the deployed lambdas
- Easily pass environment variables to Lambdas through commandline
- Clean up all lambdas once testing has finished
- Cloudwatch logging for deployed lambdas
- Scenarios are executed sequentially, but responses arrive asynchronously

## Installation
- Install node modules using either
  - yarn install
  - npm install

## Usage
- **Beware! Executing many iterations in many regions could be an expensive mistake!**
- Command Note: If running directly from the repository, swap `terraform-artillery` to `node ./index.js`
- This will be necessary until an NPM package has been published

### Create the artifacts
- Before deploying Artillery lambdas, you will need to create the deployment package
- `terraform-artillery template`
  - This will create a folder called `lambda_template` that contains the function to be published
  - This also creates a package.json that you will use to package dependencies to your Artillery lambda function
- This directory and files must exist prior to deployment
- Currently, the entry point must be a file called `handler.js` that exports a function called `handler`
  - This will probably be made configurable at some point

### Deploy the Artillery lambdas:
- Running any deploy tasks will update/overwrite any lambdas that may already be deployed
- Running deploy and changing regions will remove lambdas from any regions no longer specified
- `terraform-artillery deploy --all`
  - Deploy to all US regions
- `terraform-artillery deploy --useast1 --uswest1`
  - Each region can be individually added by using the correct command line switch
  - See help for valid options
- `terraform-artillery deploy -p --useast1 --uswest1`
  - This will display the resources that will be deployed to AWS, but nothing is deployed
  - Useful for testing or seeing if resources have already been deployed

### Passing environmental variables
- `terraform-artillery deploy --useast1 --env {foo=\"bar\"}`
- `terraform-artillery deploy --useast1 --env {foo=\"bar\",baz=\"zap\"}`
- Environment variables can only be assigned upon deployment, not invocation
  - They can be updated by running the deployment again
- When using the -e/--env switches, map pairs must be entered with quotes around the value
- Use slashes to escape these quotes so the command is interpreted correctly
- Incorrectly following these rules will result in a deployment failure, likely with the message 'variable "env_vars" should be type map, got string'

### Destroy the Artillery lambdas:
- `terraform-artillery destroy`
- Destroys all lambdas in all regions

### Invoke the Artillery lambdas:
- `terraform-artillery invoke --scenario scenarios/get-aws.amazon.com --iterations 10`
  - Invoke the lambdas with the given scenario, for X iterations
- `terraform-artillery invoke --scenario scenarios/ --iterations 10`
  - Run all scenarios found in the directory specified
  - This is a recursive search so files in sub-directories will also be ran
- Scenarios will be run against all currently deployed lambdas

### Package the files for lambda deployment (for testing)
- `terraform-artillery package`

### Display commandline help:
- `terraform-artillery help`
- `terraform-artillery destroy help`
- `terraform-artillery deploy help`
- etc...

### Scenarios
- Scenarios are defined exactly the same way as Artillery scenarios
- YML or JSON formats are both acceptable
- Incorrect templates will cause the entire job to fail

## ToDo
- Results should be placed in a container
  - S3 bucket
  - DynamoDB table
- Publish as an NPM module
- Error handling of incorrectly structured templates
- Only add necessary node_modules to the deployed lambda
  - Decrease filesize
  - Speed-up deployment and execution time

## License
- Apache 2.0
- Feel free to use any thing from this repo for your own development, just try and remember to give credit
- Original 'handler.js' file was copied from the project [Nordstrom/serverless-artillery](https://github.com/Nordstrom/serverless-artillery)
