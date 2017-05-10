const execSh = require('exec-sh');
const fs = require('fs');

function deploy(program) {
    isTerraformInstalled()
        .then(isLambdaPackaged)
        .then(() => {
            let terraformCommand = getTerraformCommand(program);
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
    if (!fs.existsSync('./lambda_package/lambda.zip')) {
        console.warn('Lambda package does not exist. Creating...');
        return package();
    }
    else {
        console.log('Lambda package already exists.');
        return Promise.resolve();
    }
}

function getTerraformCommand(program) {
    let terraformCommand = 'terraform apply';
    terraformCommand += program.useast1 || program.allregions ? ' -var "useast1=1"' : '';
    terraformCommand += program.useast2 || program.allregions ? ' -var "useast2=1"' : '';
    terraformCommand += program.uswest1 || program.allregions ? ' -var "uswest1=1"' : '';
    terraformCommand += program.uswest2 || program.allregions ? ' -var "uswest2=1"' : '';
    console.log('Terraform will be executed with:', terraformCommand);
    return terraformCommand;
}
