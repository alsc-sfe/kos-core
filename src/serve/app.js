'use strict';

const http = require('http');
const path = require('path');

const express = require('express');
const colors = require('colors/safe');
const Promise = require('bluebird');
const localIP = require('node-localip');
const debug = require('debug')('kos:core-dev-app');

/**
 *
 */
exports.start = function start(reflect, options) {

  return getOpts(options)
    .then(opts => {
      debug('getOpts opts', opts);

      return startServer(reflect, opts);
    });

  function getOpts(options) {
    return new Promise((resolve, reject) => {
      options = options || {};

      localIP(function(err, ip) {
        options.ip = '127.0.0.1';
        if (!err) {
          options.ip = ip;
        }

        options.base = path.resolve(options.cwd || '.');

        options.port = options.port || 3333;
        options.host = options.host || (options.ip + ':' + options.port);

        resolve(options);
      });
    });
  }

  function startServer(reflect, options) {
    return new Promise((resolve, reject) => {
      const app = express();

      // dev logger
      const morgan = require('morgan');
      morgan.token('port', function(req, res) { return options.port; });
      morgan.token('size', function(req, res) { return pretty(res.get('content-length')); });
      morgan.format('reflect', function reflectFormatLine(tokens, req, res) {
        const status = headersSent(res) ? res.statusCode : undefined;

        const color = status >= 500 ? 'red'
          : status >= 400 ? 'yellow'
          : status >= 300 ? 'cyan'
          : status >= 200 ? 'green'
          : 0;

        let fn = reflectFormatLine[color];
        if (!fn) {
          fn = reflectFormatLine[color] = morgan.compile(
            colors.dim('[127.0.0.1::port]') + ' :method :url ' +
            (color != 0 ? colors[color](':status') : ':status') + 
            ' :response-time ms - :size'
          );
        }
        return fn(tokens, req, res);

        function headersSent (res) {
          return typeof res.headersSent !== 'boolean'
            ? Boolean(res._header)
            : res.headersSent;
        }
      });
      if (process.env.NODE_ENV !== 'production') {
        app.use(morgan('reflect'));
      }

      // force clean
      forceClean(app, options);

      // // combo
      // if (!options.disableCombo) {
      //   app.use(require('comboed').middleware({
      //     port: options.port
      //   }));
      // }

      // live reload
      liveReload(app, options);

      // register reflect.
      try {
        reflect(app, options);        
      } catch (e) { 
        return reject(e); 
      }

      // index dir structure
      // if (!options.disableIndex) {
      //   app.use(require('serve-index')(
      //     options.base, {'icons': true}
      //   ));
      // }

      // static
      app.use(express.static(options.tmpDir));
      app.use(express.static(options.base, {
        index: ['index.php', 'index.html', 'index.htm']
      }));

      // markdown
      // app.use(require('markdown-middleware-2')({
      //   directory: options.base
      // }));

      // error
      app.use(require('errorhandler')());

      const server = http.createServer(app);
      if (options.server) {
        options.server(server);
      }
      app.server = server;

      // listen server
      if (!options.notStart) {
        createServer(server, options, () => resolve(app));
      } else {
        resolve(app);
      }
    });
  }

  function forceClean(app, options) {
    if (!options.tmpDir) {
      options.tmpDir = path.join(
        require('os').tmpDir(),
        'reflect-' + require('sha1')(options.base)
      );
    }
    process.nextTick(function(){
      require('fs-extra').removeSync(options.tmpDir);
    });
    app.use(require('./force-clean')({
      clean: options.tmpDir
    }));
  }

  function liveReload(app, options) {
    if (options.livereload && !options.customLivereload) {
      const lrPort = options.lrPort;

      app.use(require('connect-livereload')({
        port: lrPort
      }));

      options.watchDir = options.watchDir || ['**/*', '!node_modules/**/*', '!**/node_modules/**/*'];

      options.livereloadServerImpl = options.livereloadServerImpl || function() {
        const tinylr = require('tiny-lr');
        const gaze = require('gaze');

        tinylr().listen(lrPort, function() {
          console.log('[reflect] livereload Listening on %s', lrPort);
        });
        gaze(options.watchDir, {
          'cwd': options.base,
          'debounceDelay': 200
        }, function(err) {
          if (err) {
            return;
          }
          this.on('all', function(event, filepath) {
            const now = new Date();
            filepath = path.relative(options.base, filepath);
            console.log('[%s] %s %s..', pad(now.getMinutes(), 2) + ':' + pad(now.getSeconds(), 2), filepath, event);
            tinylr.changed(filepath.replace(/.(less|scss|sass|stylus)$/, '.css'));
          });
        });

        function pad(n, width, z) {
          z = z || '0';
          n = n + '';
          return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        }
      };
      process.nextTick(options.livereloadServerImpl);
    }
  }

  function createServer(server, options, callback) {
    const externalIp = options.ip;

    const url = 'http://127.0.0.1:' + options.port;
    const exUrl = 'http://' + externalIp + ':' + options.port;

    if (!options.notShowOpenTip) {
      console.log('[reflect] 临时目录: ' + colors.cyan(options.tmpDir));
      console.log('[reflect] 用 SHIFT+F5 或 SHIFT+CMD+R(Mac) 刷新可强制清空缓存');

      console.log('\n  visit (-o 直接打开) \n  %s\n  移动预览 (-m 直接打开)\n  %s\n',
        colors.cyan(url),
        colors.cyan(exUrl)
      );
    }

    server.listen(options.port, function() {
      callback();

      if (options.openUrl) {
        require('open')(url);
      }
      if (options.mobilePreview) {
        require('open')(mUrl);
      }
    });
  }

};


function pretty(size, nospace, one) {
  var sizes = [
    'B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'
  ];

  var mysize, f;

  sizes.forEach(function(f, id) {
    debug('pretty id', f, id);
    if (one) {
      f = f.slice(0, 1);
    }
    var s = Math.pow(1024, id), fixed;
    if (size >= s) {
      fixed = String((size / s).toFixed(1));
      if (fixed.indexOf('.0') === fixed.length - 2) {
        fixed = fixed.slice(0, -2);
      }
      mysize = fixed + (nospace ? '' : ' ') + f;
    }
  });

  // zero handling
  // always prints in Bytes
  if (!mysize) {
    f = (one ? sizes[0].slice(0, 1) : sizes[0]);
    mysize = '0' + (nospace ? '' : ' ') + f;
  }

  return mysize;
}