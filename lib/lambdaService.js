const AWS = require('aws-sdk');
const colors = require('colors');

function runArtillery(lambdas, scenarios, iterations) {
    let invocationPromises = [];

    scenarios.forEach(payload => {
        lambdas.forEach(lambdaFunction => {
            for (x = 0; x < iterations; x++) {
                invocationPromises.push(invokeLambda(lambdaFunction.name, x, iterations, lambdaFunction.region, payload));
            }
        });
    });

    return Promise.all(invocationPromises);
}
exports.runArtillery = runArtillery;

function invokeLambda(functionName, iteration, totalIterations, region, payload) {
    console.log(`${functionName} :: ${payload.config.target} -- ${iteration + 1}/${totalIterations}`.grey);

    var lambda = new AWS.Lambda({ region: region, apiVersion: '2015-03-31' });

    var lambdaParams = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: JSON.stringify(payload)
    };

    return lambda.invoke(lambdaParams).promise();
}


