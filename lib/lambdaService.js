const AWS = require('aws-sdk');
const YAML = require('yamljs');
const tfState = require('./tfstateService');

function invoke({ script, iterations }) {
    if (!script) {
        console.error('No scenario script supplied. Invoke requires a script to be specified!');
        return;
    };
    if (isNaN(iterations)) {
        console.error(`Iterations can only be a number. You set it to ${iterations}`);
        return;
    }
    iterations = iterations || 1;

    let requestPayload = JSON.stringify(YAML.load(script));
    var artilleryFunctions = tfState.readState();
    if (!isArtilleryDeployed(artilleryFunctions)) { return; }

    console.log(`Running artillery with "${iterations}" iteration(s) and scenario "${script}"`);

    for (i = 0; i < artilleryFunctions.length; i++) {
        for (x = 0; x < iterations; x++) {
            invokeLambda(artilleryFunctions[i].name, x, artilleryFunctions[i].region, requestPayload);
        }
    };
}
exports.invoke = invoke;

function invokeLambda(functionName, iteration, region, payload) {
    console.log(`Executing ${functionName} for iteration ${iteration}`);

    var lambda = new AWS.Lambda({ region: region, apiVersion: '2015-03-31' });

    var lambdaParams = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: payload
    };

    lambda.invoke(lambdaParams, (error) => {
        if (error) {
            console.error(error);
        } else {
            console.log(`Finished executing ${functionName} for iteration ${iteration}`);
        }
    });
}

function isArtilleryDeployed(artilleryFunctions) {
    if (artilleryFunctions.length === 0) {
        console.error('No artillery functions have been deployed. Run the deploy command before invoking');
        return false;
    }
    console.log(`Found ${artilleryFunctions.length} deployed artillery function(s)`);
    return true;
}

