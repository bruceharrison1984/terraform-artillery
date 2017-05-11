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

### Deploy the Artillery lambdas:
- Running any deploy tasks will update/overwrite any lambdas that may already be deployed
- Running deploy and changing regions will remove lambdas from any regions no longer specified
- `terraform-artillery deploy --all`
  - Deploy to all US regions
- `terraform-artillery deploy --useast1 --uswest1`
  - Each region can be individually added by using the correct command line switch
  - See help for valid options

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
- `terraform-artillery invoke --script scenarios/get-aws.amazon.com --iterations 10`
  - Invoke the lambdas with the given scenario, for X iterations
- Scenarios will be run against all currently deployed lambdas

### Package the files for lambda deployment (for testing)
- `terraform-artillery package`

### Display commandline help:
- `terraform-artillery help`
- `terraform-artillery destroy help`
- `terraform-artillery deploy help`
- etc...

## ToDo
- Results should be placed in a container
  - S3 bucket
  - DynamoDB table
- Allow multiple scenarios to be specified
  - Allow an entire directory of scenarios to be executed in one session
- Publish as an NPM module

## License
- Apache 2.0
- Feel free to use any thing from this repo for your own development, just try and remember to give credit
- Original 'handler.js' file was copied from the project [Nordstrom/serverless-artillery](https://github.com/Nordstrom/serverless-artillery)
