const lambdaService = require('./lambdaService');
require('colors');

function invoke({ tfState, scenarios, iterations }) {
    if (!scenarios) {
        console.error('No scenario script or directory path supplied. Invoke requires a script or directory path to be specified!'.red);
        return;
    };
    iterations = iterations || 1;
    if (isNaN(iterations)) {
        console.error(`Iterations is a required argument and can only be a number. You set it to ${iterations}`.red);
        return;
    }

    if (!isArtilleryDeployed(tfState)) { return; }

    console.log('Waiting for Artillery responses...'.cyan);

    lambdaService.runArtillery(artilleryFunctions, scenarios, iterations).then(() => {
        console.log('All requests completed, results can be found in Cloudwatch'.green);
    });
}
exports.invoke = invoke;

function isArtilleryDeployed(tfState) {
    if (tfState.length === 0) {
        console.error('No artillery functions have been deployed. Run the deploy command before invoking'.red);
        return false;
    }
    console.log(`Found ${tfState.length} deployed artillery function(s)`.cyan);
    return true;
}
