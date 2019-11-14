'use strict';


module.exports = function forceClean(options) {
  return function(req, res, next) {
    var fse = require('fs-extra');

    if (!/text\/html/.test(req.headers['accept'])) {
      return next();
    }

    var noCache = /no-cache/.test(req.headers['pragma']) || /no-cache/.test(req.headers['cache-control']);
    if (!options.clean || !noCache) {
      return next();
    }
    console.log('-- cache clean --');
    fse.remove(options.clean, next);
  };
};