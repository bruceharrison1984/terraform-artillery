const fs = require('fs-extra');
const yaml = require('yaml-js');
const finder = require('fs-finder');
require('colors');

function getScenarioContent(path) {
    let scenarioFiles = createFileList(path);
    console.log(`Found ${scenarioFiles.length} scenario files in ${path}`.cyan);
    return readAllFiles(scenarioFiles);
}
exports.getScenarioContent = getScenarioContent;

function createFileList(path) {
    if (!fs.lstatSync(path).isDirectory()) {
        return [path];
    }
    return finder.from(path).findFiles('*.<yml|json>');
}

function readAllFiles(scenarioPaths) {
    let yamlDocuments = [];
    scenarioPaths.forEach(scenarioPath => {
        yamlDocuments.push(yaml.load(fs.readFileSync(scenarioPath, 'utf8')));
    });
    return yamlDocuments;
}


