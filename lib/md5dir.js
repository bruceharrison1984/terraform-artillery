const tar = require('tar');
const crypto = require('crypto');

function md5dir(dir) {
  const tarball = makeTarball(dir);
  const hash = makeHash();
  return makePromise(tarball, hash);
}

function makeTarball(dir) {
  return tar.c({portable:true,C:dir},['.']);
}

function makeHash() {
  const hash = crypto.createHash('md5');
  hash.setEncoding('hex');
  return hash;
}

function makePromise(tarball, hash) {
  return new Promise( (resolve) => {
    tarball.on('end',() => {
      hash.end();
      resolve(hash.read());
    });
    tarball.pipe(hash);
  });
}

module.exports = md5dir;
