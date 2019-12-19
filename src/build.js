'use strict';
const debug = require('debug')('kos:core-build');
const co = require('co');

module.exports = function(kos) {

  const build = {};

  build.start = co.wrap(start.bind(build));

  return build;

  async function start() {
    const reflectJs = await getReflectJs();
    console.log('start reflectJs', reflectJs);
    return require(reflectJs);
  }

  function getReflectJs() {
    debug('getReflectJs');

    let builder = '';
    let configJson = kos.lookupConfigJson() || {};

    if (!builder) {
      if (configJson.assets && configJson.assets.builder) {
        builder = configJson.assets.builder.name;
      }
    }

    if (builder) {
      return kos.store.resolve(builder + '/serverBuild.js');
    }
  }
};