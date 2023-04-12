const fs = require('fs');
const path = require('path');
const exec = require('child_process').execSync;

/**
 * 生成 feeds 配置
 * @param {*} name
 * @param {*} uri
 * @param {*} branch
 * @returns
 */
const GenerateFeedsConfig = (name, uri, branch) => {
  exec(`git clone --depth=1 ${uri} -b ${branch} ${name}`);
  const revision = exec(`cd ${name} && git log -1 --pretty=%H`).toString().trim();
  exec(`cd ..`);
  exec(`rm -rf ${name}`);
  return {
    name: name.trim(),
    uri: uri.trim(),
    branch: branch.trim(),
    revision: revision.trim(),
  };
}

/**
 * 生成编译配置文件
 */
const generateYml =() => {
  try {
    exec(`npm install js-yaml`);
    const yaml = require('js-yaml');
    // 生成 feeds 配置
    const feeds = require('./feeds').map(item => GenerateFeedsConfig(item.name, item.uri, item.branch));
    // 生成 packages 配置
    const package = require('./packages');
    const packages = package.map(item => item.name.trim());
    const packagesDesc = package.map((item, index) => `${index + 1}. ${item.desc.trim()}`);

    const profilesPath = path.resolve(process.cwd(), `custom.yml`);

    let customYml = yaml.load(fs.readFileSync(profilesPath, 'utf8'));

    const yamlStr = yaml.dump({
      feeds,
      packages,
      diffconfig: customYml.diffconfig
    }, { lineWidth: -1 });

    fs.writeFileSync(profilesPath, yamlStr);

    const workflows = require('./workflows');
    const official_devices = workflows.filter(item => item.official).map(item => item.target);
    const devices = workflows.map(item => item.target);

    // 读取 workflow 模板
    let template = fs.readFileSync(path.resolve(__dirname, 'workflow.tpl'), 'utf8');
    template = template.replace(/\$\{releasePackages\}/g, JSON.stringify([
      `## ✨ 主要功能`,
      ...packagesDesc
    ].join('\n')));

    template = template.replace(/\$\{resaseTotal\}/g, [...official_devices, ...devices].length);

    // 替换模板变量
    let official_tpl = template.replace(/\$\{releaseName\}/g, '官方 UI');
    official_tpl = official_tpl.replace(/\$\{devices\}/g, official_devices.join(', '));
    official_tpl = official_tpl.replace(/\$\{ui\}/g, true);
    official_tpl = official_tpl.replace(/\$\{workflowName\}/g, 'build glinet official');

    let openwrt_tpl = template.replace(/\$\{releaseName\}/g, 'OPENWER UI');
    openwrt_tpl = openwrt_tpl.replace(/\$\{devices\}/g, devices.join(', '));
    openwrt_tpl = openwrt_tpl.replace(/\$\{ui\}/g, false);
    openwrt_tpl = openwrt_tpl.replace(/\$\{workflowName\}/g, 'build glinet openwrt');

    // 写入 workflow
    fs.writeFileSync(path.resolve(process.cwd(), '.github/workflows', `build-glinet-official.yml`), official_tpl)
    fs.writeFileSync(path.resolve(process.cwd(), '.github/workflows', `build-glinet-openwrt.yml`), openwrt_tpl)

  } catch (error) {
    throw error;
  } finally {
     // 清理文件
     require('./feeds').forEach(item => exec(`rm -rf ${item.name}`));
     exec(`rm -rf node_modules`);
     exec(`rm -rf package-lock.json`);
     exec(`rm -rf package.json`);
  }
}

generateYml()