const AWS = require('aws-sdk');
const YAML = require('yamljs');
const tfState = require('./tfstateService');

function invoke(program) {
    if (!program.script) {
        console.error('No scenario script supplied. Invoke requires a script to be specified!');
        return;
    };
    program.iterations = program.iterations || 1;

    console.log(`Running artillery with "${program.iterations}" iteration(s) and scenario "${program.script}"`);

    let requestPayload = JSON.stringify(YAML.load(program.script));

    var artilleryFunctions = tfState.readState();

    if (artilleryFunctions.length === 0) {
        console.error('No artillery functions have been deployed. Run the deploy command before invoking');
        return;
    }
    console.log(`Found ${artilleryFunctions.length} deployed artillery function(s)`);

    for (i = 0; i < artilleryFunctions.length; i++) {
        for (x = 1; x < program.iterations + 1; x++) {
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

    lambda.invoke(lambdaParams, (error, data) => {
        if (error) {
            console.error(error);
        } else {
            let artilleryResponse = JSON.parse(data.Payload);
            console.log(JSON.stringify(artilleryResponse, null, 2));
        }
    });
}

