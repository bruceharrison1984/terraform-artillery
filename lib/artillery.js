const AWS = require('aws-sdk');
const YAML = require('yamljs');

function invoke(program) {
    if (!program.script) { throw 'No scenario script supplied!' };
    if (!program.iterations) { program.iterations = 1 };
    console.log('Invoking artillery with script:', program.script);
    console.log('Running artillery X iterations:', program.iterations);

    let requestPayload = JSON.stringify(YAML.load(program.script));

    var stateData = require('fs').readFileSync(`${__dirname}/../terraform.tfstate`, 'utf8');

    let terraformState = JSON.parse(stateData);
    let artilleryFunctions = terraformState.modules.filter(module => {
        return module.resources["aws_lambda_function.artillery_lambda"] != undefined;
    }).map(lambda => {
        let functionName = lambda.resources["aws_lambda_function.artillery_lambda"].primary.id
        let functionRegion = functionName.substring(functionName.indexOf('-') + 1, functionName.length)
        return {
            name: functionName,
            region: functionRegion
        };
    });

    console.log(`Found ${artilleryFunctions.length} deployed artillery functions`)
    if (artilleryFunctions.length == 0) { throw 'No artillery functions have been deployed. Run the deploy command before invoking' }

    for (i = 0; i < artilleryFunctions.length; i++) {
        for (x = 0; x < program.iterations; x++) {
            invokeLambda(artilleryFunctions[i].name, artilleryFunctions[i].region, requestPayload);
        }
    };
}
exports.invoke = invoke;

function invokeLambda(functionName, region, payload) {
    console.log(`Executing ${functionName} for iteration ${x}`);

    var lambda = new AWS.Lambda({ region: region, apiVersion: '2015-03-31' });

    var lambdaParams = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: payload
    };

    lambda.invoke(lambdaParams, function (error, data) {
        if (error) {
            console.log(error);
        } else {
            console.log(data.Payload);
        }
    });
}

