'use strict';

const path = require('path');
const debug = require('debug')('kos:core');
const co = require('co');

module.exports = class Kos {
  constructor(opts) {
    debug('constructor', opts);
    this._home = opts.home;
    this._pkg = require('../package.json');
    this._fs = null;
    this._ui = null;
    this._store = null;
    this._log = null;
    this._kit = null;
    this._yo = null;
    this._serve = null;
    this._build = null;

    this._registry = opts.registry || 'https://registry.npm.taobao.org';
  }

    /*
   * opts: {'clipkg', 'nodeVersion', 'argv', 'cwd'}
   */
  start(opts) {
    const kos = this;

    opts = opts || {};
    debug('start', opts);
    this._startTime = Date.now();

    process.on('uncaughtException', this.onFatal);
    process.on('unhandledRejection', this.onFatal);

    return co(function* () {
      yield kos.init(opts);
      yield kos.run(opts);

      // try {
      //   yield kos.startNotify();
      // } catch(e) {
      //   debug('start notify error', e);
      // }
    }).catch(this.onFatal);
  }

  async init(opts) {
    debug('init', opts);

    this._createCli(opts || {});
    await this._init();
    await this._registerCommands();
  }

  async run(opts) {
    opts = opts || {};
    debug('run', opts);

    // set the correct argv back
    const rawArgv = opts.argv || process.argv;
    process.argv = rawArgv.slice();
    const argv = rawArgv.slice(2);
    debug('cli arg= %o', argv);

    // ch cwd if need
    opts.cwd = opts.cwd || process.cwd();
    if (process.cwd() !== opts.cwd) {
      process.chdir(opts.cwd);
      debug('chdir= %s', opts.cwd);
    }

    // pre parse to use kit.
    if (!this.kit.key) {
      const parsed = await this.cli.parse(argv, {'use': 'parser'});
      debug('parsed', parsed);

      try {
        await this._preUse({
          argv: argv,
          opts: parsed.argv,
        });
      } catch(e) {
        this.log.verbose('[core]', 'cli pre use error');
        console.log('run err', e);
      }
    }

    // add the exit event
    this._onExit();
  }

  _createCli(opts) {
    this._nodeVersion = opts.nodeVersion;

    this._cliVersion = 'unknown';
    if (opts.clipkg && opts.clipkg.version) {
      this._cliVersion = opts.clipkg.version;
    }

    this.cli = require('./cli')(
      {
        'name': 'kos',
        'description': 'KOS 客户端',
        'version': '' +
          '     Cli: ' + (this._cliVersion == 'unknown' ? 'unknown' : 'v' + this._cliVersion) + '\n' +
          '    Core: v' + this._version + '\n' +
          '    Node: ' + this._nodeVersion + '\n' +
          'Registry: ' + this._registry,
        'lang': {
          'usage': '用法：',
          'arguments': '参数：',
          'options': '选项：',
          'commands': '命令：',

          'help': '显示帮助信息',
          'version': '显示版本信息',
        }
      }
    );
    this.cli.option('-V, --verbose', '显示详细日志信息');
    this.cli.on('parsed', this._onParsed.bind(this));
  }

  async _init() {
    await this.fs.ensureDirAsync(path.join(this._home, 'kos_modules'));
  }

  async _registerCommands() {
    require('./commands/store')(this);
    this._kitCommands = require('./commands/kit')(this);
  }

  _onParsed(data) {
    debugger;
    this._parsed = data.parsed;
    this.verbose = data.parsed.argv.verbose;
    debug('onParsed', data.parsed);
  }

  async _preUse(data) {
    const { argv, opts } = data;
    const info = {
      name: argv[0],
      type: argv[1],
    };
    debug('_preUse parsed:', opts);

    let configJson = null;
    let kitType = 'unknown';

    if (info.name == 'init') {
      this.log.verbose('[core]', 'guess type from arg');
      // try to get type from args. like: `kos init xxx`
      kitType = info.type;
      await this.runKit(info.name, kitType);
    } else {
      this.log.verbose('[core]', 'guess type from abc.json');
      try {
        configJson = this.lookupConfigJson();
      } catch (e) {
        throw new Error('项目 `abc.json` 文件解析失败: ' + e.message);
      }
      if (!configJson) {
        throw new Error('项目 `abc.json` 文件未找到，请检查执行目录是否正确');
      }
      debug('_preUse configJson:', configJson);

      kitType = configJson.kit || configJson.type || 'unknown';
      await this.runKit(info.name, kitType, opts);
    }
  }

  async runKit(cmd, kitType, opts, actionCtx, actionArgs) {
    debug('runKit kitType', kitType)
    debug('runKit opts:', opts);

    if(cmd == 'init'){
      await this.store.install(`@saasfe/kos-kit-${kitType}`);
      await this.store.install(`@saasfe/generator-${kitType}`);

      await this.yo.run({
        name: `@saasfe/generator-${kitType}`,
        useYeomanEnvironment: true,
      });
    }

    if(cmd == 'dev'){
      // kit & builder
      const configJson = this.lookupConfigJson();
      const builder = configJson.assets.builder.name;
      await this.store.install(builder);

      await this.serve.start();
    }

    if(cmd == 'build') {
      console.log('in build');
      // kit & builder
      const configJson = this.lookupConfigJson();
      const builder = configJson.assets.builder.name;
      await this.store.install(builder);
      if(!opts.env && !opts.version) {
        console.error('缺少变量，例如 kos build --env daily --appVersion 1.0.0');
        return;
      }
      // build
      const build = await this.build.start();
      build(opts);
    }
  }

  lookupConfigJson(cwd) {
    const abcFile = lookupConfigFile.call(this, cwd);
    debug('configFile: %s', abcFile);
    if (!abcFile) {
      return null;
    }

    let configJson = this.fs.readFileSync(abcFile, 'utf8');
    configJson = require('json-parse-helpfulerror').parse(configJson);
    debug('configJson: %j', configJson);
    return configJson;

    function lookupConfigFile(cwd) {
      cwd = cwd || process.cwd();

      let abcFile = path.join(cwd, 'abc.json');
      if (this.fs.existsSync(abcFile)) {
        return abcFile;
      } else {
        // FIXME: 向下查一次，for ICE.
        abcFile = path.join(cwd, 'assets', 'abc.json');
        if (this.fs.existsSync(abcFile)) {
          return abcFile;
        }
      }
      return '';
    }
  }

  _onExit() {
    const onExit = function() {
      debug('onExit');
      // 尚未打点，提前退出了
      if (!this._endTime && this._parsed) {
        this._endTime = Date.now();
        try {
          console.log('time_used', `${this._endTime - this._startTime}ms`)
        } catch(e) {
          debug('onExit track error', e);
        }
      }
    }.bind(this);

    require('on-exit')(onExit);
  };

  onFatal(e, p) {
    debug('onFatal', e, p);
    process.exit(1);
  }

  get kit() {
    return this._kitCommands;
  }

  get log() {
    debug('get log');
    if (this._log) {
      debug('use cache');
      return this._log;
    }
    this._log = require('./log');
    debug('use require log');
    return this._log;
  }

  get store() {
    debug('get store');
    if (this._store) {
      debug('use cache');
      return this._store;
    }
    this._store = new (require('./store'))(Object.assign({
      'registry': this._registry,
      'storeDir': path.join(this._home, 'kos_modules'),
      'home': this._home,
    }, this._storeConfig));
    debug('use require');
    return this._store;
  }

  get ui() {
    debug('get ui');
    if (this._ui) {
      debug('use cache');
      return this._ui;
    }
    this._ui = require('./ui');
    debug('use require');
    return this._ui;
  }

  get fs() {
    debug('get fs');
    if (this._fs) {
      debug('use cache');
      return this._fs;
    }
    this._fs = require('./fs');
    debug('use require');
    return this._fs;
  }

  get yo() {
    debug('get yo');
    if (this._yo) {
      debug('use cache');
      return this._yo;
    }
    this._yo = require('./yo')(this);
    debug('use require');
    return this._yo;
  }

  get serve() {
    debug('get serve');
    if (this._serve) {
      debug('use cache');
      return this._serve;
    }
    this._serve = require('./serve/')(this);
    debug('use require');
    return this._serve;
  }

  get build() {
    debug('get build');
    if (this._build) {
      debug('use cache');
      return this._build;
    }
    this._build = require('./build')(this);
    debug('use require');
    return this._build;
  }
}
