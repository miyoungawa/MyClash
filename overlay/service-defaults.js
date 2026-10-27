/*
 * MyClash 默认选中补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 作用：改写指定分流策略组的 default-selected。
 *
 * 说明：mihomo 的 select 组支持 default-selected（见源码 SelectorOption），
 *       仅在客户端没有保存过该组的选择时生效；一旦在面板里选过，
 *       profile.store-selected 的缓存会覆盖它。若该名称不在组的 proxies
 *       列表中，内核会静默回落到列表第一项，所以构建脚本会额外断言目标名称存在。
 *
 * 本补丁必须在 discord.js 之后执行，否则看不到它插入的 Discord 策略组。
 */
(() => {
  // 策略组名 -> 默认选中的选项
  const defaultSelectedMap = {
    AI: '日本',
    Discord: '手动选择',
  };

  for (const service of serviceConfigs) {
    const target = defaultSelectedMap[service.name];

    if (target !== undefined) {
      service.defaultSelected = target;
    }
  }

  // 地区组仅在有匹配节点时生成，且上游可能命名为「台湾省」。
  // 根据实际输出设置 Google 默认值，避免无台湾节点时指向不存在的组。
  const originalMain = main;
  main = function (config) {
    const output = originalMain(config);
    const groups = output && output['proxy-groups'];
    if (Array.isArray(groups)) {
      const google = groups.find((group) => group.name === 'Google');
      const taiwan = allRegionDefinitions.find((region) => region.name.includes('台湾'));
      if (google && taiwan && google.proxies.includes(taiwan.name)) {
        google['default-selected'] = taiwan.name;
      }
    }
    return output;
  };
})();
