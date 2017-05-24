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
        console.log(JSON.stringify(report, null, 2));
        callback(null, report);
    });
}
