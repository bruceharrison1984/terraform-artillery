const execSh = require('exec-sh');
const fs = require('fs-extra');
const packagingService = require('./packagingService');
const constants = require('./constants');
require('colors');

let commandlineOptions;

function deploy(program) {
    commandlineOptions = program;
    isTerraformInstalled()
        .then(isRegionDefined)
        .then(package)
        .then(runTerraform)
        .catch(err => {
            console.error(`Error occured during deployment: ${err}`.red);
        });
};
exports.deploy = deploy;

function destroy() {
    isTerraformInstalled()
        .then(() => {
            execSh(`cd ${constants.TERRAFORM_TEMPLATE_DIRECTORY} && terraform destroy -state=${constants.TFSTATE_LOCATION} --force -var 'lambda_package=${constants.LAMBDA_PACKAGE_LOCATION}'`, err => {
                if (err) {
                    console.error(`An error occured with exit code: ${err.code}`.red);
                    console.error(`Error: ${err}`.red);
                }
                return;
            });
        });
};
exports.destroy = destroy;

function package() {
    return packagingService.packageLambda()
        .catch(err => {
            return Promise.reject(err);
        });
}
exports.package = package;

function template() {
    return isTemplateCreated()
        .then(() => fs.copy(constants.DEFAULT_TEMPLATE_DIRECTORY, constants.USER_TEMPLATE_DIRECTORY))
        .catch(err => {
            return Promise.reject(err);
        });
}
exports.template = template;

function isTemplateCreated() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(constants.USER_TEMPLATE_DIRECTORY)) {
            resolve();
        } else {
            reject('Overwrite protection: /lambda_template directory already exists. Delete /lambda_templates before running `template`');
        }
    });
}

function isTerraformInstalled() {
    return new Promise((resolve, reject) => {
        execSh('terraform version', err => {
            if (err) {
                reject('Terraform could not be found. This is likely because either Terraform is not installed, or is not available on PATH');
            }
            resolve();
        });
    });
}

function isRegionDefined({ useast1, useast2, uswest1, uswest2, allregions } = commandlineOptions) {
    return new Promise((resolve, reject) => {
        if (useast1 || useast2 || uswest1 || uswest2 || allregions) { resolve(); };
        reject('At least one region must be selected for deployment');
    });
}

function runTerraform() {
    return new Promise((resolve, reject) => {
        let terraformCommand = getTerraformCommand(commandlineOptions);
        execSh(`cd ${constants.TERRAFORM_TEMPLATE_DIRECTORY} \
                && terraform get \
                && ${terraformCommand}`, err => {
                if (err) {
                    reject(`Error: ${err}`);
                }
                resolve();
            });
    });
}

function getTerraformCommand({ useast1, useast2, uswest1, uswest2, allregions, env, plan }) {
    let terraformCommand = 'terraform';
    terraformCommand += plan ? ' plan' : ' apply';
    terraformCommand += useast1 || allregions ? ' -var "useast1=1"' : '';
    terraformCommand += useast2 || allregions ? ' -var "useast2=1"' : '';
    terraformCommand += uswest1 || allregions ? ' -var "uswest1=1"' : '';
    terraformCommand += uswest2 || allregions ? ' -var "uswest2=1"' : '';
    terraformCommand += env ? ` -var 'env_vars=${env}'` : '';
    terraformCommand += ` -var 'lambda_package=${constants.LAMBDA_PACKAGE_LOCATION}'`;
    terraformCommand += ` -state=${constants.TFSTATE_LOCATION}`;
    console.log(`Terraform will be executed with: ${terraformCommand}`.cyan);
    return terraformCommand;
}
