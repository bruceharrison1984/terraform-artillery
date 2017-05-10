# terraform-artillery
## Alternative to serverless-artillery

### Hard Dependencies
- Terraform ^0.9.4 on PATH
  - Lower versions may work depending on your terraform templatees

This project is very similar to serverless-artillery(which inspired me), just without the serverless deployment aspects. I liked 
serverless-artillery so much, the handler.js is the same one that they include in their project. That will no doubt change over time,
but it suits my purpose perfectly for the time being.

I created the project due to my distaste for serverless. Rather than introduce another AWS deployment tool in to my toolbox,
I opted to use Terraform to deploy Artillery in to an AWS Lambda, and then run it remotely.

## Features
- Simultaneously deploy an AWS Lambda to each of the US regions
- Run a scenario N times against all of the deployed lambdas
- Clean up all lambdas once testing has finished

## Usage
### Deploy the Artillery lambdas:
  - terraform-artillery deploy


### Destroy the Artillery lambdas:
  - terraform-artillery destroy

### Invoke the Artillery lambdas:
- terraform-artillery invoke --script scenarios/get-aws.amazon.com --iterations 10
  - Invoke the lambdas with the given scenario, for X iterations
  - The scenario will be run against all deployed lambdas

### Package the files for lambda deployment (for testing)
- terraform-artillery package

### Display commandline help:
- terraform-artillery help
- terraform-artillery destroy help
- terraform-artillery deploy help
- etc...

### Passing environmental variables
- when using the -e/--env switches, variables must be entered with quotes around the values
- Use slashes to escape these slashes so the command is interpreted correctly
- Incorrectly following these rules will result in a deployment failure, likely with the message 'variable "env_vars" should be type map, got string'
- Examples: 
  - terraform-artillery deploy --useast1 --env {foo=\\"bar\\"}
  - terraform-artillery deploy --useast1 --env {foo=\\"bar\\",baz=\\"zap\\"}

## ToDo
- Scenarios should be run parallel
  - Currently they run synchronously
- Results should be placed in to an S3 bucket
- Enable Cloudwatch logging for deployed lambdas

## License
- Feel free to use any thing from this repo for your own development
- Original 'handler.js' file was copied from the project 'Nordstrom/serverless-artillery'
