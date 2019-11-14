'use strict';


module.exports = function (kos) {

  kos.cli
    .command('install <name>', '安装 KOS 模块（插件、套件）')
    .alias('i')
    .option('-f, --force', '强制进行覆盖安装')
    .group('store')
    .action(function* (name, opts) {
      // 本地是否已经安装
      const spinner = kos.ui.spinner('获取模块信息...');


      spinner.stop();

      // 未安装进行安装
      const start = Date.now();
      kos.log.info('[store]', '开始安装模块：' + info.long + '，请等待...');
      yield kos.store.install(info, { 'force': opts.force });
      kos.log.info('[store]', '安装完成，耗时：' + (Date.now() - start) / 1000 + 's');
    });
};