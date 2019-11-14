'use strict';

const yeoman = require('yeoman-environment');
const debug = require('debug')('kos:core-yo');

module.exports = function(kos) {
  const Promise = require('bluebird');
  const co = require('co');

  const yo = {};

  yo.run = co.wrap(run.bind(yo));


  /**
   *
   * @param opts
   *   resolved:
   *   generator:
   *   name:
   *   argv:
   *   useYeomanEnvironment
   */
  function* run(opts) {
    opts = opts || {};
    kos.log.verbose('[yo]', 'run with: ', opts);
    debug('run opts', opts);

    if (opts.resolved) {
      kos.log.verbose('[yo]', 'resolved= %s', opts.resolved);
      yield G(opts.resolved, opts.argv, opts.useYeomanEnvironment);
      return;
    }

    /*
     * spec=
     *   xcake:page
     *   @ali/cake:page
     */
    let spec = (opts.generator || opts.name).split(':');

    let name = spec[0].replace(/^(\@saasfe\/)?(generator-)?(.+)$/, '$1generator-$3');
    let sub = spec[1] || 'app';
    debug('run name', name);

    let resolved = kos.store.resolve(name + '/' + sub + '/index.js');
    debug('run resolved 1', resolved);
    if (!resolved) {
      resolved = kos.store.resolve(name + '/generators/' + sub + '/index.js');
      debug('run resolved 2', resolved);
    }
    kos.log.verbose('[yo]', 'resolved= %s', resolved);
    debug('run resolved', resolved);

    if (!resolved) {
      throw new Error('查找 generator `' + name + '` 失败.');
    }

    yield G(resolved, opts.argv || [], opts.useYeomanEnvironment);
  }

  function G(resolved, argv, useYeomanEnvironment) {
    if (useYeomanEnvironment) {
      return new Promise(function(resolve, reject) {
        const yo_env = yeoman.createEnv();
        const name = `generator`;
        yo_env.register(resolved, name);
  
        yo_env.run(`${name}`, argv, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      return new Promise(function(resolve, reject) {
        let Generator = require(resolved);
        let g = new Generator(argv, {
          'resolved': resolved,
          'env': {
            'cwd': process.cwd()
          }
        });
  
        g.run(function(err) {
          if (err) return reject(err);
          return resolve();
        });
      });
    }
  }

  return yo;
};
