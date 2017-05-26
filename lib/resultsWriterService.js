const fs = require('fs-extra');
const constants = require('./constants');

function saveResults(results) {
    let timestamp = JSON.parse(results[0].Payload).timestamp;
    let latestRunResults = `${constants.RESULTS_DIRECTORY}/${timestamp}`;

    console.log('Preparing to save results...'.gray);
    fs.ensureDir(latestRunResults).then(() => {
        let writeFilePromises = [];
        results.forEach(result => {
            let resultObject = JSON.parse(result.Payload);
            writeFilePromises.push(fs.writeFile(`${latestRunResults}/${resultObject.context.awsRequestId}.json`, JSON.stringify(resultObject, null, 2)));
        });

        Promise.all(writeFilePromises).then(() => {
            console.log(`All results have been written to ${latestRunResults}`.green);
        });
    });
}
exports.saveResults = saveResults;
