/*
This template is a very basic example of how to run artillery within an AWS Lambda
You can modify this file however you need in order to run your tests
You can also bundle additional modules with the test by keeping everything within the lambda_template directory

Any dependencies this module requires should be added to the lambda_template/package.json
They will automatically be downloaded and added to the deployment ZIP package
*/

const artillery = require('artillery-core');

module.exports = {
    handler: artilleryRunner
};

function artilleryRunner(event, context, callback) {
    let payload = null;
    let runner = artillery.runner(event, payload, {});
    runner.on('phaseStarted', (opts) => {
        console.log('phase', opts.index, ':', opts.name ? opts.name : '', 'started, duration', opts.duration ? opts.duration : opts.pause);
    });
    runner.on('phaseCompleted', (opts) => {
        console.log('phase', opts.index, ':', opts.name ? opts.name : '', 'complete');
    });
    runner.on('done', (report) => {
        report.context = context;   //Do not remove this line if you plan on using the --output option.

        //any custom actions you wish to take after the test should be placed here, write to S3 bucket, dynamoDb, datadog, etc

        callback(null, report);     //Do not remove this line if you plan on using the --output option.
    });

    runner.run();
}
