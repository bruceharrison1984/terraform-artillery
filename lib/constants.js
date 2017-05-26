const cwd = process.cwd();

module.exports = Object.freeze({
    DEFAULT_TEMPLATE_DIRECTORY: `${__dirname}/default_template/`,
    USER_TEMPLATE_DIRECTORY: `${cwd}/lambda_template`,
    TERRAFORM_TEMPLATE_DIRECTORY: `${__dirname}/../terraform_templates`,
    LAMBDA_PACKAGE_DIRECTORY: `${cwd}/lambda_package`,
    LAMBDA_PACKAGE_LOCATION: `${cwd}/lambda_package/lambda.zip`,
    USER_TEMPLATE_HASH: `${cwd}/lambda_package/lambda_template.md5`,
    TFSTATE_LOCATION: `${cwd}/tfstate/terraform.tfstate`,
    RESULTS_DIRECTORY: `${cwd}/Results`,
});

