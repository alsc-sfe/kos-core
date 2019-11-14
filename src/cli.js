'use strict';

const debug = require('debug')('kos:core-cli');
const EventEmitter = require('events');
const parser = require('yargs-parser');
const colors = require('colors/safe');


/**
 *
 */
class Command extends EventEmitter {

  constructor(parent) {
    super();

    this._parent = parent || null;

    this._name = '';
    this._alias = '';

    this._version = '';
    this._description = '';

    this._group = '';
    this._hide = false;
    this._allowUnknownOption = false;

    this._commands = [];
    this._args = [];
    this._opts = [];

    this._actionFn = null;
  }

  name(n) {
    if (n) {
      this._name = n;
      return this;
    }
    return this._name;
  }

  alias(a) {
    if (a) {
      if (this._parent) {
        let cmd = this._parent.find(a);
        if (cmd) {
          throw new Error('the alias `' + a + '` already define by `' + cmd.name() + '(' + cmd.alias() + ')`.');
        }
        this._alias = a;
      }
      return this;
    }
    return this._alias;
  }

  version(v) {
    if (v) {
      this._version = v;
      return this;
    }
    return this._version;
  }

  description(desc) {
    if (desc) {
      this._description = desc;
      return this;
    }
    return this._description;
  }

  option(flag, desc, conf, defVal) {
    let config = {};

    let len = arguments.length;
    if (len > 2) {
      if (len == 3) {
        // conf->default or config
        if (null != conf) {
          if ('[object Object]' == conf.toString()) {
            config = conf;
          } else {
            config['default'] = conf;
          }
        } else {
          config = conf || {};
        }
      }
      if (len == 4) {
        if (typeof conf == 'function') {
          config['parse'] = conf;
        }
        if (null != defVal && '[object Object]' != defVal.toString()) {
          config['default'] = defVal;
        }
      }
    }

    var opt = {
      'name': '',
      'alias': '',
      'required': false,
      'flag': '',
      'desc': '',
      'type': '',
      'defaultVal': null,
      'choices': null,
      'hide': false,
      'pass': true,
      'narg': null,
      'parse': null
    };

    opt.flag = flag;
    opt.desc = desc || '';

    flag = flag.split(/[ ,|]+/);
    if (flag.length > 1 && !/^[[<]/.test(flag[1])) {
      opt.alias = flag.shift().replace(/^(--|-)/, '');
    }
    opt.name = flag.shift().replace(/^(--|-)/, '');

    if (this._opts.filter(o => o.name == opt.name && o.alias == opt.alias).length > 1) {
      throw new Error('the opt `' + opt.flag + '` already defined.');
    }

//    opt.type = 'boolean';
    if (flag[0]) {
      if (/^[[<]/.test(flag[0])) {
        opt.narg = 1;

        opt.defaultVal = config['default'];

        if (Array.isArray(config['choices'])) {
          opt.choices = config['choices'];
        }

        if (/^</.test(flag[0])) {
          opt.required = true;
        }

        opt.type = 'string';
        if (typeof opt.defaultVal == 'number') {
          opt.type = 'number';
        }
        if (flag[0].indexOf('...') != -1) {
          opt.type = 'array';
          opt.narg = null;
          opt.defaultVal = [];
        }
      }
    }

    if (config['hide'] != null) {
      opt.hide = config['hide'];
    }
    if (config['pass'] != null) {
      opt.pass = config['pass'];
    }
    if (typeof config['parse'] == 'function') {
      opt.parse = config['parse'];
    }

    this._opts.push(opt);

    return this;
  }

  action(fn) {
    if (typeof fn == 'function') {
      this._actionFn = fn;
      return this;
    }
    return this._actionFn;
  }

  group(name) {
    if (name) {
      this._group = name;
      // console.log('cli group: ', this);
      return this;
    }
    // console.log('cli group: ', this._group);
    return this._group;
  }

  showHelp() {
    console.log('help on the way');
  }

  command(spec, desc) {
    if (!spec) {
      return this;
    }
    if (spec == this._name) {
      return this;
    }

    const parents = this.parents();
    if (parents.length > 2) {
      throw new Error('the max sub commands level only allow 3.');
    }

    spec = spec.split(/ +/);

    const cmd = new Command(this);
    cmd.name(spec.shift());
    cmd.description(desc);

    // avoid duplicate
    if (this._commands.filter(c => c._name == cmd._name).length == 0) {
      this._commands.push(cmd);
    }
    debug('cli command spec:', spec);
    // debug('cli command cmd:', cmd);
    return cmd;
  }

  parents() {
    const arr = [];

    let p = this._parent;
    while (p) {
      arr.push(p);
      p = p._parent;
    }

    return arr;
  }

  find(arg) {
    for (let i = 0, len = this._commands.length; i < len; i += 1) {
      let cmd = this._commands[i];
      if (cmd.is(arg)) {
        return cmd;
      }
    }
    return null;
  }

  is(arg) {
    return this._name == arg || this._alias == arg;
  }

  * parse(argv, config) {
    config = config || {};

    if (this._parent != null) {
      throw new Error('`parse` should called at root command.');
    }

    argv = argv.slice();

    let rawArgv = argv.slice();
    let remainedArgv = [];
    let optsConfig, parsed;
    let idx;

    // process --
    idx = argv.indexOf('--');
    if (idx != -1) {
      remainedArgv = argv.slice(idx + 1);
      argv = argv.slice(0, idx);
    }

    optsConfig = {
      'alias': {},
      'default': {},
      'array': [],
      'boolean': [],
      'count': [],
      'string': [],
      'number': [],
      'narg': {},
      'configuration': {
        'boolean-negation': false,
        'camel-case-expansion': false
      }
    };

    parsed = {
      '--': remainedArgv,
      'raw': rawArgv,
      'cmd': null,
      'argv': null,
      'args': null,
      'opts': null
    };

    this._parse(argv, optsConfig, parsed);
    this.emit('parsed', {'parsed': parsed});

    if (config.use == 'parser') {
      return parsed;
    }

    if (!parsed.cmd) {
      return {'cmd': parsed.argv._[0], '$error': 'invalid command'};
    }

    if (parsed.argv.version) {
      let v = parsed.cmd.version() || this.version();
      console.log(v);
      return v;
    }

    let errArg = parsed.args.filter(arg => arg.err)[0];
    if (errArg) {
      // parsed.cmd.error(errArg.err + ' `' + errArg.name + '`.', true);
      return {'$error': 'invalid arg'};
    }

    let errOpt = null;
    for (let k in parsed.opts.opts) {
      if (parsed.opts.opts[k].err) {
        errOpt = parsed.opts.opts[k];
        break;
      }
    }
    if (errOpt) {
      // parsed.cmd.error(errOpt.err + ' `' + errOpt.opt.flag + '`.', true);
      return {'$error': 'invalid opt'};
    }

    let actionFn = parsed.cmd.action();

    if (typeof actionFn != 'function') {
      // this.error('can not find action fn of command `' + parsed.cmd.name() + '`.');
      return {'$error': 'invalid action fn'};
    }

    let applyArgs, applyOpts, applyCtx;

    let applyData = this._apply(parsed);
    console.log('parsed applyData', applyData);


    applyArgs = applyData.args;
    applyOpts = applyData.opts;
    applyCtx = applyData.ctx;

    // apply ctx.
    if (typeof config.applyCtx == 'function') {
      applyCtx = config.applyCtx(applyCtx);
    }

    this.emit('command.start', {
      'cmd': parsed.cmd,
      'args': applyArgs
    });
    const result = yield co.apply(null, [actionFn.bind(applyCtx)].concat(applyArgs));
    console.log('parsed result', result);
    return result;
  }

  _apply(parsed) {
    let applyArgs = [];
    let applyOpts = {};
    let applyCtx = {'cmd': parsed.cmd};

    // apply args.
    parsed.args.forEach(arg => applyArgs.push(arg.val));

    // apply opts.
    for (let k in parsed.opts.opts) {
      applyOpts[camelcase(k)] = parsed.opts.opts[k].val;
    }
    applyOpts['--'] = parsed['--'];
    applyOpts['$'] = parsed.opts.unknown;
    applyArgs.push(applyOpts);

    return {
      'args': applyArgs,
      'opts': applyOpts,
      'ctx': applyCtx
    };
  }
}

Command.lang = {
  'usage': 'Usage: ',
  'arguments': 'Arguments: ',
  'options': 'Options: ',
  'commands': 'Commands: ',
  'choices': 'choices: ',

  'help': 'output the help information.',
  'version': 'output the version number.',

  'error': 'ERROR: ',

  'invalidArgument': 'invalid argument',
  'missingRequiredArgument': 'missing required argument',

  'unknownOption': 'unknown option',
  'invalidOptionArgument': 'invalid option argument',

  'showHelp': 'Show Help: '
};


function Cli(config) {
  config = config || {};

  Command.lang = Object.assign({}, Command.lang, config.lang || {});

  const cmd = new Command();
  cmd
    .name(config.name)
    .description(config.description)
    .version(config.version)
    .option('-h, --help', Command.lang.help)
    .option('-v, --version', Command.lang.version)
    .action(() => cmd.showHelp());

  return cmd;
}

Cli.Command = Command;


module.exports = Cli;
