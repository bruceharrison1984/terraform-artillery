#!/usr/bin/env node
'use strict';

const packageInfo = require('../package.json');
const program = require('commander');
const {
    terraformService,
    artilleryService,
    scenarioService,
    tfstateService,
    resultsWriterService
} = require('../index.js');

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
    .action( (...args) => {
        terraformService.deploy(...args)
          .catch(err => {
            console.error(`Error occured during deployment: ${err}`.red);
            process.exit(1);
          });
    });

program
    .command('package')
    .description('Create the Zip package for AWS Lambda deployment (Will overwrite existing package)')
    .action(() => {
        terraformService.package()
            .catch(err => {
                console.error(`Error occured during packaging: ${err}`.red);
                process.exit(1);
            });
    });

program
    .command('template')
    .description('Create the basic structure for an Artillery lambda. The lambda code can be customized to suit your needs')
    .action(() => {
        terraformService.template()
            .catch(err => {
                console.error(`Error occured during template copy: ${err}`.red);
                process.exit(1);
            });
    });

program
    .command('destroy')
    .description('Remove all AWS resource currently deployed')
    .action( (...args) => {
        terraformService.destroy(...args)
          .catch(err => {
            console.error(`Error occured during destroy: ${err}`.red);
            process.exit(1);
          });
    });

program
    .command('invoke')
    .description('Run scenario(s) against all deployed Artillery Lambdas')
    .option('-s, --scenario <path>', 'The scenario file or directory of files to remotely execute on the artillery lambdas')
    .option('-i, --iterations <n>', 'The number of times to execute each scenario on each lambda (Defaults to 1 if unspecified)')
    .option('-o, --output', 'Save the results of the invocation to the Results directory')
    .option('--test', 'Run the default scenarios (verify correct operation)')
    .action(({ scenario, iterations, test, output }) => {
        let scenarios = scenarioService.getScenarioContent(test ? defaultScenarioDirectory : scenario);
        let tfstate = tfstateService.readState();
        artilleryService.invoke(tfstate, scenarios, iterations || 1)
            .then(results => {
                console.log('All requests have finished!'.green);
                if (output) { resultsWriterService.saveResults(results); }
            }).catch(err => {
                console.log(`Error occured during invocation: ${err}`.red);
                process.exit(1);
            });
    });

program.parse(process.argv);
