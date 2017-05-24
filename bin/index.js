#!/usr/bin/env node
'use strict';

const packageInfo = require('../package.json');
const program = require('commander');
const terraformService = require('../lib/terraformService');
const artilleryService = require('../lib/artilleryService');
const tfState = require('./tfstateService');

const defaultScenarioDirectory = `${__dirname}/../scenarios`;

program.version(packageInfo.version);

program
    .command('deploy')
    .description('deploy artillery lambdas to AWS environment')
    .option('--useast1', 'Deploy Artillery to us-east-1 AWS region')
    .option('--useast2', 'Deploy Artillery to us-east-2 AWS region')
    .option('--uswest1', 'Deploy Artillery to us-west-1 AWS region')
    .option('--uswest2', 'Deploy Artillery to us-west-2 AWS region')
    .option('-p, --plan', 'Display which items will be deployed in to AWS')
    .option('-e, --env <map>', 'Environmental variables to set on the Artillery lambda ex: {foo=\\"bar\\",baz=\\"qux\\"}')
    .option('-a, --allregions', 'Deploy Artillery to all US regions')
    .option('-o, --overwrite', 'Re-package and overwrite any existing lambda package before deployment')
    .action(terraformService.deploy);

program
    .command('package')
    .description('Create the Zip package for AWS Lambda deployment (Will overwrite existing package)')
    .action(terraformService.package);

program
    .command('template')
    .description('Create the basic structure for an Artillery lambda. The lambda code can be customized to suit your needs')
    .action(terraformService.template);

program
    .command('destroy')
    .description('Remove all AWS resource currently deployed')
    .action(terraformService.destroy);

program
    .command('invoke')
    .description('Run scenario(s) against all deployed Artillery Lambdas')
    .option('-s, --scenario <path>', 'The scenario file or directory of files to remotely execute on the artillery lambdas')
    .option('-i, --iterations <n>', 'The number of times to execute each scenario on each lambda (Defaults to 1 if unspecified)')
    .option('--test', 'Run the default scenarios (verify correct operation)')
    .action((scenario, iterations, test) => {
        let scenarios = scenarioService.getScenarioContent(test ? defaultScenarioDirectory : scenario);
        let tfState = tfState.readState();
        artilleryService.invoke(tfState, scenarios, iterations);
    });

program.parse(process.argv);


