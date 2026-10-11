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
})();