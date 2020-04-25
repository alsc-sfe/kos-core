'use strict';

const debug = require('debug')('kos:core-store');

const path = require('path');

const semver = require('semver');
const globby = require('globby');

const fs = require('./fs');
const Util = require('./util');
const installer = require('./installer');

module.exports = class Store {

  constructor(opts) {
    opts = opts || {};

    this.registry = opts.registry;
    this.timeout = opts.timeout || 10 * 1000;
    this.storeDir = opts.storeDir;
    this.storeFile = path.join(this.storeDir, '.store.json');
    this.builderStoreDir = path.join(this.storeDir, '.builders');
    this.generatorStoreDir = path.join(this.storeDir, '.generators');

    // 拉平模式下均存储在一级目录
    this.flatten = opts.flatten;
    if (this.flatten) {
      this.builderStoreDir = this.storeDir;
      this.generatorStoreDir = this.storeDir;
    }
  }

  resolve(p) {
    let filepath = this._getPath(p);
    debug('resolve filepath', filepath);

    if (fs.existsSync(filepath)) {
      debug('resolve filepath 2', filepath);
      return filepath;
    }
    return '';
  }

  async install(name) {
    debug('install', name);
    const filepath = this.resolve(name);
    // 本地缺失
    if (!filepath) {
      debug('install.missing');
      await installer({
        'registry': 'https://registry.npm.taobao.org',
        'root': path.join(this._realRoot(name), name),
        'pkgs': [{'name': name, 'version': 'latest'}]
      });
      return true;
    } else if (Util.isBuilder(name) || Util.isGenerator(name) || Util.isKit(name)) {
      debug('install.update');
      const originVersion = Util.getOriginVersion(name); // 远端版本号
      let configJson = fs.readFileSync(path.join(filepath, 'package.json'), 'utf8');
      configJson = require('json-parse-helpfulerror').parse(configJson);
      const localVersion = configJson.version; // 本地版本号
      console.log('依赖包：' + name + '本地版本号：'+ localVersion + ' 远端版本号：' + originVersion);
      if (localVersion !== originVersion) {
        console.log('依赖包：' + name + '即将更新至最新版本...');
        try {
          fs.emptyDirSync(path.resolve(filepath));
        } catch(err) {
          console.error('清空依赖包'+ name +'内容出错 ERROR: ' + err);
          return true;
        }
        await installer({
          'registry': 'https://registry.npm.taobao.org',
          'root': path.join(this._realRoot(name), name),
          'pkgs': [{'name': name, 'version': 'latest'}]
        });
      }
    }

    return true;
  }

  _getPath(p) {
    const parts = p.split('/');

    let name = parts.shift();
    if (name == '@saasfe') {
      name = name + '/' + parts.shift();
    }
    let suffix = parts.join('/');

    return path.join(
      this._realRoot(name), Util.generatePath(name, suffix, this.flatten)
    );
  }

  _realRoot(name) {
    if (Util.isGenerator(name)) {
      return this.generatorStoreDir;
    } else if (Util.isBuilder(name)) {
      return this.builderStoreDir;
    } else {
      return this.storeDir;
    }
  }
}