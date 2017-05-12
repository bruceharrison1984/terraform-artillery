const tfState = require('./tfstateService');
const scenarioService = require('./scenarioService');
const lambdaService = require('./lambdaService');

function invoke({ scenario, iterations }) {
    if (!scenario) {
        console.error('No scenario script or directory path supplied. Invoke requires a script or directory path to be specified!');
        return;
    };
    if (isNaN(iterations)) {
        console.error(`Iterations can only be a number. You set it to ${iterations}`);
        return;
    }

    var artilleryFunctions = tfState.readState();
    if (!isArtilleryDeployed(artilleryFunctions)) { return; }

    let requestPayloads = scenarioService.getScenarioContent(scenario);

    console.log('Waiting for Artillery responses...');

    lambdaService.runArtillery(artilleryFunctions, requestPayloads, iterations).then(() => {
        console.log('All requests completed, results can be found in Cloudwatch');
    });
}
exports.invoke = invoke;

function isArtilleryDeployed(artilleryFunctions) {
    if (artilleryFunctions.length === 0) {
        console.error('No artillery functions have been deployed. Run the deploy command before invoking');
        return false;
    }
    console.log(`Found ${artilleryFunctions.length} deployed artillery function(s)`);
    return true;
}

