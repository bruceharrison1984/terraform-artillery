const tfState = require('./tfstateService');
const scenarioService = require('./scenarioService');
const lambdaService = require('./lambdaService');
require('colors');
const defaultScenarioDirectory = `${__dirname}/../scenarios`;

function invoke({ scenario, iterations, test }) {
    if (test) {
        console.info('Running bundled tests...'.cyan);
        scenario = defaultScenarioDirectory;
    }
    if (!scenario && !test) {
        console.error('No scenario script or directory path supplied. Invoke requires a script or directory path to be specified!'.red);
        return;
    };
    iterations = iterations || 1;
    if (isNaN(iterations)) {
        console.error(`Iterations is a required argument and can only be a number. You set it to ${iterations}`.red);
        return;
    }
    var artilleryFunctions = tfState.readState();
    if (!isArtilleryDeployed(artilleryFunctions)) { return; }

    let requestPayloads = scenarioService.getScenarioContent(scenario);

    console.log('Waiting for Artillery responses...'.cyan);

    lambdaService.runArtillery(artilleryFunctions, requestPayloads, iterations).then(() => {
        console.log('All requests completed, results can be found in Cloudwatch'.green);
    });
}
exports.invoke = invoke;

function isArtilleryDeployed(artilleryFunctions) {
    if (artilleryFunctions.length === 0) {
        console.error('No artillery functions have been deployed. Run the deploy command before invoking'.red);
        return false;
    }
    console.log(`Found ${artilleryFunctions.length} deployed artillery function(s)`.cyan);
    return true;
}
