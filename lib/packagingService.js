const zip = require('bestzip');
const md5dir = require('./md5dir');
const fs = require('fs-extra');
const execSh = require('exec-sh');
const constants = require('./constants');
require('colors');

function packageLambda() {
    return fs.ensureDir(constants.LAMBDA_PACKAGE_DIRECTORY)
        .then(isTemplateFolderCreated)
        .then(isTemplateFolderChanged)
        .then(createPackage)
        .catch(err => {
            return Promise.reject(err);
        });
}
exports.packageLambda = packageLambda;

function isTemplateFolderCreated() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(`${constants.USER_TEMPLATE_DIRECTORY}/handler.js`)) {
            reject('Deployment file `lambda_template/handler.js` not found. Run `terraform-artillery template` first');
        }
        resolve();
    });
}

function isTemplateFolderChanged() {
    return new Promise(resolve => {
        isTemplateFolderCreated()
            .then(isHashCreated)
            .then(() => Promise.all([md5dir(constants.USER_TEMPLATE_DIRECTORY), fs.readFile(constants.USER_TEMPLATE_HASH, 'utf8')]))
            .then((results) => {
                if (results[0] !== results[1]) {
                    return resolve(true);
                }
                resolve(false);
            });
    });
}

function isHashCreated() {
    return new Promise(resolve => {
        if (!fs.existsSync(constants.USER_TEMPLATE_HASH)) {
            fs.writeFile(constants.USER_TEMPLATE_HASH, 'uninitialized');
        }
        resolve();
    });
}

function createPackage(hasChanged) {
    if (hasChanged) {
        console.log('Changes detected in Lambda template, creating new deployment package'.yellow);
        return installNpmPackages()
            .then(buildPackageZip)
            .then(() => md5dir(constants.USER_TEMPLATE_DIRECTORY))
            .then(md5 => fs.writeFile(constants.USER_TEMPLATE_HASH, md5));
    }
    else {
        console.log('Lambda function has not changed, skipping package creation'.green);
        return Promise.resolve();
    }
}

function installNpmPackages() {
    return new Promise((resolve, reject) => {
        execSh(`cd ${constants.USER_TEMPLATE_DIRECTORY} && npm install`, err => {
            if (err) {
                reject('Error while installing Lambda NPM dependencies');
            }
            resolve();
        });
    });
}

function buildPackageZip() {
    return new Promise((resolve, reject) => {
        zip(constants.LAMBDA_PACKAGE_LOCATION, ['lambda_template/*'], err => {
            if (err) {
                reject(`Error occured while creating AWS Lambda package: ${err}`);
            }
            let packageSize = fs.statSync(constants.LAMBDA_PACKAGE_LOCATION).size / 1000000;
            console.log(`Lambda package size: ${packageSize}Mb`.cyan);
            resolve();
        });
    });
}
