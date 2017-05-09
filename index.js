#!/usr/bin/env node
'use strict';

const program = require('commander');
const terraform = require('./lib/terraform');
const artillery = require('./lib/artillery.js');

program.version('0.0.1');

program
    .command('deploy')
    .description('deploy artillery lambdas to AWS environment')
    .action(terraform.deploy);

program
    .command('package')
    .description('zip handler for deployment to AWS lambda')
    .action(terraform.package);

program
    .command('destroy')
    .description('remove artillery lambdas from AWS environment')
    .action(terraform.destroy);

program
    .command('invoke')
    .description('run scenario script against remote artillery lambdas')
    .option('-s, --script <script>', 'The scenario file to remotely execute on the artillery lambdas')
    .option('-i, --iterations <iterations>', 'The number of times to execute each scenario on each lambda')
    .action(artillery.invoke);

program.parse(process.argv);
