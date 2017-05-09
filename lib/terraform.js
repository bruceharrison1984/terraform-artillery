const execSh = require('exec-sh');
const fs = require('fs');

function deploy() {
    isTerraformInstalled()
        .then(isLambdaPackaged)
        .then(() => {
            execSh('terraform apply', err => {
                if (err) {
                    console.log('An error occured with exit code:', err.code);
                    console.log('Error:', err);
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
                    console.log('An error occured with exit code:', err.code);
                    console.log('Error:', err);
                }
                return;
            });
        });
};
exports.destroy = destroy;

function package() {
    return new Promise((resolve, reject) => {
        execSh('node ./node_modules/.bin/bestzip out/lambda.zip handler.js node_modules package.json', err => {
            if (err) {
                console.log('An error occured with exit code:', err.code);
                console.log('Error:', err);
                reject();
            }
            resolve();
        });
    });
}
exports.package = package;

function isTerraformInstalled() {
    return new Promise((resolve, reject) => {
        execSh('terraform version', err => {
            if (err) {
                console.log('An error occured with exit code:', err.code);
                console.log('This is likely because either Terraform is not installed, or is not available on PATH', err);
                reject();
            }
            console.log('Terraform is installed, continuing');
            resolve();
        });
    });
}

function isLambdaPackaged() {
    if (!fs.existsSync('./out/lambda.zip')) {
        console.log('Lambda package does not exist. Creating...')
        return package();
    }
    else {
        console.log('Lambda package already exists.')
        return Promise.resolve();
    }

}
