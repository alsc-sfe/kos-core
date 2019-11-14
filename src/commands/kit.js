'use strict';


module.exports = function(kos) {

  const init = kos.cli
    .command('init', '初始化工程目录结构')
    .alias('it')
    .group('kit')
    .action(async function () {

      let showedKits = showedKits = ['saas'];
      
      let type = await kos.ui.list('请选择套件：', showedKits);
      await kos.useKit(type);
      kos.log.verbose('core', 'use kit `%s` in init', type);
      console.log('command kit process.argv.slice(2)', process.argv.slice(2))
      // const parsed = await kos.cli.parse(process.argv.slice(2), {'use': 'parser'});
      // const data = kos.cli._apply(parsed);
      // console.log('init parsed', parsed);
      // console.log('init parsed', data);

    //   await kos.runKit('init', [type], data.opts, data.ctx, data.args);
    });

  const dev = kos.cli
    .command('dev', '开启本地调试服务器')
    .alias('d')
    .group('kit')
    .action(async function (opts) {
    //   kos.serve.cmdOpts = opts;
      await kos.runKit('dev', [], opts, this, arguments);
    });

  const build = kos.cli
    .command('build', '执行代码构建')
    .alias('b')
    .group('kit')
    .action(async function (opts) {
      kos.builder.cmdOpts = opts;
      await kos.runKit('build', [], opts, this, arguments);
    });

  const publish = kos.cli
    .command('publish', '执行代码发布')
    .alias('p')
    .group('kit')
    .action(async function (opts) {
        await kos.runKit('publish', [], opts, this, ['', opts]);
    });

  return {
    'init': init,
    'build': build,
    'dev': dev,
    'publish': publish
  };

  function pad(str, n) {
    str = str.split('');
    n = n - str.length;
    if (n > 0) {
      for (var i = 0; i < n; i += 1) {
        str.push(' ');
      }
    }
    str.push(' :');
    return str.join('');
  }

};