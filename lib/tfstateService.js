const fs = require('fs-extra');
const constants = require('./constants');

function readState() {
    var stateData = fs.readFileSync(constants.TFSTATE_LOCATION, 'utf8');

    let terraformState = JSON.parse(stateData);

    let artilleryFunctions = terraformState.modules.filter(module => {
        return module.resources['aws_lambda_function.artillery_lambda'] !== undefined;
    }).map(lambda => {
        let functionName = lambda.resources['aws_lambda_function.artillery_lambda'].primary.id;
        let functionRegion = functionName.match('us-east-1|us-east-2|us-west-1|us-west-2')[0];
        return {
            name: functionName,
            region: functionRegion
        };
    });
    return {
        functions: artilleryFunctions
    };
};
exports.readState = readState;
