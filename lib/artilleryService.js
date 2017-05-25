const lambdaService = require('./lambdaService');
require('colors');

function invoke(tfstate, scenarios, iterations) {
    if (!scenarios) {
        console.error('No scenario script or directory path supplied. Invoke requires a script or directory path to be specified!'.red);
        return;
    };

    if (isNaN(iterations)) {
        console.error(`Iterations is a required argument and can only be a number. You set it to ${iterations}`.red);
        return;
    }

    if (tfstate.functions.length === 0) {
        return Promise.reject('No artillery functions have been deployed. Run the deploy command before invoking');
    }

    console.log('Waiting for Artillery responses...'.cyan);

    return lambdaService.runArtillery(tfstate.functions, scenarios, iterations);
}
exports.invoke = invoke;
