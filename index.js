#!/usr/bin/env node
'use strict';

const program = require('commander');
const terraform = require('./terraform');

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

program.parse(process.argv);
