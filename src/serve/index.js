'use strict';
const debug = require('debug')('kos:core-dev');
const co = require('co');

module.exports = function(kos) {

  const serve = {};

  serve._cpServer = null;

  serve.cmdOpts = {};
  serve.start = co.wrap(start.bind(serve));

  return serve;

  /**
   *
   * @param opts
   *   - cwd{String}
   *
   *   - type{String}
   *   - builderReflect{String}
   *   - customServer{Boolean}
   *
   *   - livereload{Boolean}
   *   - watchDir{String}
   *   - livereloadServerImpl{Function}
   *   - customLivereload{Boolean}
   *
   *   - disableCombo{Boolean}
   *   - disableIndex{Boolean}
   *
   *   - server{Function}
   *
   *   - * 其他均会透传
   */
  async function start(opts) {
    opts = normalizeOpts(opts);
    kos.log.verbose('[dev]', 'start with: ', opts);
    debug('start opts', opts);

    await checkPort(opts.port);

    const reflectJs = await getReflectJs(opts);
    debug('start reflectJs', reflectJs);

    if (opts.customServer) {
      kos.log.verbose('[dev]', 'use custom server');
      return require(reflectJs);
    }
    const result = await require('./app').start(require(reflectJs), opts);
    debug('start result', result);
    return result;
  }

  function getReflectJs(opts) {
    let builder = '';
    let configJson = kos.lookupConfigJson() || {};

    if (!builder) {
      kos.log.verbose('[dev]', 'lookup builder from `abc.json`');
      if (configJson.assets && configJson.assets.builder) {
        builder = configJson.assets.builder.name;
      }
    }
    debug('builder:', builder);

    if (builder) {
      kos.log.info('[dev]', '使用 `%s/%s` 启动服务器', builder, 'reflect.js');
      debug('getReflectJs:', kos.store.resolve(builder + '/reflect.js'));

      return kos.store.resolve(builder + '/reflect.js');
    }
  }

  async function checkPort(port) {
    const inUse = await require('tcp-port-used').check(port);
    if (inUse) {
      throw new Error('port `' + port + '` is used');
    }
    return port;
  }

  function normalizeOpts(opts) {
    opts = Object.assign(serve.cmdOpts, opts || {});

    opts = Object.assign({
      'port': 3333,
      'debug': false,
      'disableIndex': 'index' in opts ? !opts.index : false,
      'livereload': 'noLivereload' in opts ? false : true
    }, opts);

    if (opts.lrPort == null) {
      opts.lrPort = opts.port + 32369;
    }

    opts.cwd = opts.cwd || process.cwd();

    return opts;
  }
};

