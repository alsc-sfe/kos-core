'use strict';

const debug = require('debug')('def:runtime');
const Util = require('./util');

let ctx = null;

module.exports = function(def) {

  ctx = def;

  return {'create': create};

  function create(opts) {
    opts = opts || {};
    debug('create opts=', opts);

    const runtime = Object.create(null);

    // FIXME: 兼容用
    runtime.__fallback = true;

    baseRuntime(runtime, opts);
    kitRuntime(runtime, opts);
    
    return runtime;
  }

  function baseRuntime(runtime, opts) {
    // env
    runtime.env = {
      'home': ctx._home,
      'version': ctx._cliVersion + '_' + ctx._version,
      'server': ctx._server,
      'next': true
    };

    // log
    runtime.log = ctx.log.Adapter(opts.type + ':' + opts.key);

    // config
    runtime.config = (function(name, type, config) {
      function key(k) {
        return type + ':' + name + ':' + k;
      }

      return {
        'get': function(k) {
          return config.get(key(k));
        },
        'set': function(k, v) {
          return config.set(key(k), v);
        },
        'save': function() {
          return config.save();
        }
      };
    })(opts.key, opts.type, ctx.config);

    // fatal
    runtime.fatal = ctx.onFatal.bind(ctx);

    //
    Object.defineProperty(runtime, 'ui', {
      'get': function() { return ctx.ui; }
    });

    //
    Object.defineProperty(runtime, 'Promise', {
      'get': function() { return ctx.Promise; }
    });

    //
    Object.defineProperty(runtime, 'util', {
      'get': function() { return ctx.util; }
    });

    //
    Object.defineProperty(runtime, 'parser', {
      'get': function() { return ctx.parser; }
    });

    // store
    runtime.store = {};
    Object.defineProperty(runtime.store, 'resolve', {
      'get': function() { return ctx.store.resolve.bind(ctx.store); }
    });
    Object.defineProperty(runtime.store, 'require', {
      'get': function() { return ctx.store.require.bind(ctx.store); }
    });
  }

  function kitRuntime(runtime, opts) {
    const kit = opts.kit;

    runtime.kit = {};

    //yo
    runtime.kit.yo = {
      'run': function(opts) {
        const path = require('path');
        const fs = require('fs');
        const shorten = function(str) {
          return str.replace(
            new RegExp(path.join(ctx._home, 'def_modules', kit.name, 'node_modules', '.\\d+.\\d+.\\d+@'), 'ig'), 
            ''
          );
        };

        opts = opts || {};

        if (opts.resolved) {
          ctx.log.info('[core]', 'generator: %s [from kit]', shorten(opts.resolved));
          return ctx.yo.run(opts);
        }

        let spec = (opts.generator || opts.name).split(':');
        let name = spec[0].replace(/^(\@ali\/)?(generator-)?(.+)$/, '$1generator-$3');
        let sub = spec[1] || 'app';

        let kitRoot = ctx.store.resolve(kit.name);
        let resolved = path.join(kitRoot, 'node_modules', name, sub, 'index.js');
        if (!fs.existsSync(resolved)) {
          resolved = path.join(kitRoot, 'node_modules', name, 'generators', sub, 'index.js');
          if (!fs.existsSync(resolved)) {
            resolved = '';
          }
        }
        if (resolved) {
          opts.resolved = resolved;
          let pkg = null;
          try {
            pkg = fs.readFileSync(path.join(kitRoot, 'node_modules', name, 'package.json'), 'utf8');
            pkg = JSON.parse(pkg);
          } catch(e) {}

          if (pkg) {
            ctx.log.info('[core]', 'generator: %s@%s [from kit]', pkg.name, pkg.version);
          } else {
            ctx.log.info('[core]', 'generator: %s [from kit]', opts.resolved);
          }
        }
        return ctx.yo.run(opts);
      }
    };

    // depreted
    Object.defineProperty(runtime.kit, 'scm', {
      'get': function() { return ctx.repo; }
    });

    Object.defineProperty(runtime.kit, 'build', {
      'get': function() { return ctx.builder; }
    });
    Object.defineProperty(runtime.kit, 'reflect', {
      'get': function() { return ctx.serve; }
    });

    // look up abc.json
    runtime.lookupABCJson = runtime.lookupConfigJson = ctx.lookupConfigJson.bind(ctx);

    return runtime;
  }
};