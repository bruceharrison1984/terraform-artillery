const zip = require('bestzip');
const md5dir = require('./md5dir');
const fs = require('fs-extra');
const execSh = require('exec-sh');
require('colors');

const cwd = process.cwd();
const userTemplateDirectory = `${cwd}/lambda_template`;
const lambdaPackageDirectory = `${cwd}/lambda_package`;
const lambdaPackageLocation = `${lambdaPackageDirectory}/lambda.zip`;
const userTemplateHash = `${lambdaPackageDirectory}/lambda_template.md5`;

function packageLambda() {
    return fs.ensureDir(lambdaPackageDirectory)
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
        if (!fs.existsSync(`${userTemplateDirectory}/handler.js`)) {
            reject('Deployment file `lambda_template/handler.js` not found. Run `terraform-artillery template` first');
        }
        resolve();
    });
}

function isTemplateFolderChanged() {
    return new Promise(resolve => {
        isTemplateFolderCreated()
            .then(isHashCreated)
            .then(() => Promise.all([md5dir(userTemplateDirectory), fs.readFile(userTemplateHash, 'utf8')]))
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
        if (!fs.existsSync(userTemplateHash)) {
            fs.writeFile(userTemplateHash, 'uninitialized');
        }
        resolve();
    });
}

function createPackage(hasChanged) {
    if (hasChanged) {
        return installNpmPackages()
            .then(buildPackageZip)
            .then(() => md5dir(userTemplateDirectory))
            .then(md5 => fs.writeFile(userTemplateHash, md5));
    }
    else {
        console.log('Lambda function has not changed, skipping package creation'.cyan);
        return Promise.resolve();
    }
}

function installNpmPackages() {
    return new Promise((resolve, reject) => {
        execSh(`cd ${userTemplateDirectory} && npm install`, err => {
            if (err) {
                reject('Error while install Lambda NPM dependencies');
            }
            resolve();
        });
    });
}

function buildPackageZip() {
    return new Promise((resolve, reject) => {
        zip(lambdaPackageLocation, ['lambda_template/*'], err => {
            if (err) {
                reject(`Error occured while creating AWS Lambda package: ${err}`);
            }
            let packageSize = fs.statSync(lambdaPackageLocation).size / 1000000;
            console.log(`Lambda package size: ${packageSize}Mb`.cyan);
            resolve();
        });
    });
}
