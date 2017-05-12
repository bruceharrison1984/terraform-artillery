const execSh = require('exec-sh');
const fs = require('fs');

let commandlineOptions;

function deploy(program) {
    commandlineOptions = program;
    isTerraformInstalled()
        .then(isRegionDefined)
        .then(isLambdaPackaged)
        .then(() => {
            let terraformCommand = getTerraformCommand(commandlineOptions);
            execSh(`cd terraform_templates \
                    && terraform get \
                    && ${terraformCommand}`, err => {
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
            execSh('cd terraform_templates \
                    && terraform destroy --force', err => {
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
    if (commandlineOptions.overwrite || !fs.existsSync('./lambda_package/lambda.zip')) {
        console.warn('Creating AWS Lambda deployment package...');
        return package();
    }
    else {
        console.log('Lambda package already exists.');
        return Promise.resolve();
    }
}

function isRegionDefined({ useast1, useast2, uswest1, uswest2, allregions } = commandlineOptions) {
    return new Promise((resolve, reject) => {
        if (useast1 || useast2 || uswest1 || uswest2 || allregions) { resolve(); };
        reject('At least one region must be selected for deployment');
    });
}

function isRegionDefined({ useast1, useast2, uswest1, uswest2, allregions }) {
    return useast1 || useast2 || uswest1 || uswest2 || allregions;
}

function getTerraformCommand({ useast1, useast2, uswest1, uswest2, allregions, env, plan }) {
    let terraformCommand = 'terraform';
    terraformCommand += plan ? ' plan' : ' apply';
    terraformCommand += useast1 || allregions ? ' -var "useast1=1"' : '';
    terraformCommand += useast2 || allregions ? ' -var "useast2=1"' : '';
    terraformCommand += uswest1 || allregions ? ' -var "uswest1=1"' : '';
    terraformCommand += uswest2 || allregions ? ' -var "uswest2=1"' : '';
    terraformCommand += env ? ` -var 'env_vars=${env}'` : '';
    console.log('Terraform will be executed with:', terraformCommand);
    return terraformCommand;
}
