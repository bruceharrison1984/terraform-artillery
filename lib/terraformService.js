const execSh = require('exec-sh');
const fs = require('fs');

function deploy() {
    isTerraformInstalled()
        .then(isLambdaPackaged)
        .then(() => {
            execSh('cd terraform_templates \
                    && terraform get \
                    && terraform apply', err => {
                if (err) {
                    console.error('An error occured with exit code:', err.code);
                    console.error('Error:', err);
                }
                return;
            });
        });
};
exports.deploy = deploy;

function destroy() {
    isTerraformInstalled()
        .then(() => {
            execSh('terraform destroy --force', err => {
                if (err) {
                    console.error('An error occured with exit code:', err.code);
                    console.error('Error:', err);
                }
                return;
            });
        });
};
exports.destroy = destroy;

function package() {
    return new Promise((resolve, reject) => {
        execSh('mkdir lambda_package -p \
                && node ./node_modules/.bin/bestzip ./lambda_package/lambda.zip handler.js node_modules package.json', err => {
            if (err) {
                console.error('An error occured with exit code:', err.code);
                console.error('Error:', err);
                reject();
            }
            let packageSize = fs.statSync('./lambda_package/lambda.zip').size / 1000000;
            console.log(`Lambda package size: ${packageSize}Mb`);
            resolve();
        });
    });
}
exports.package = package;

function isTerraformInstalled() {
    return new Promise((resolve, reject) => {
        execSh('terraform version', err => {
            if (err) {
                console.error('An error occured with exit code:', err.code);
                console.error('This is likely because either Terraform is not installed, or is not available on PATH', err);
                reject();
            }
            resolve();
        });
    });
}

function isLambdaPackaged() {
    if (!fs.existsSync('./lambda_package/lambda.zip')) {
        console.warn('Lambda package does not exist. Creating...');
        return package();
    }
    else {
        console.log('Lambda package already exists.');
        return Promise.resolve();
    }
}
