/*
 * MyClash 地区调整补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 作用：增删地区策略组（当前为移除 新加坡、保留 台湾 并在缺失时补齐），
 *       并默认关闭地区自动选择子组，
 *       被移除地区的节点不会被丢弃，而是归入「其他节点」。
 *
 * 移除与去重都按“关键词”而非“完整名称”匹配：上游曾把「台湾省」改名为「台湾」，
 * 一旦改名，按旧名匹配就会静默失效（移除失效 / 重复建组），改用关键词可自动兼容。
 *
 * 注意：脚本内有两个数组——
 *   regionDefinitions        用于判定“是否地区节点”（影响节点过滤与「其他节点」归类）
 *   allRegionDefinitions     用于节点匹配与策略组生成，在加载时已复制为
 *                            [...regionDefinitions, ...rateRegionDefinitions]
 * 所以增删地区都必须同时处理两者，否则会出现
 * 「地区组没有生成、节点却仍被当作地区节点」或「节点匹配不到地区」的问题。
 */
(() => {
  // 需要移除的地区关键词（保留：香港 / 日本 / 美国 / 台湾）
  const removedRegionKeywords = ['新加坡'];

  // 需要追加的地区，字段与上游 regionDefinitions 保持一致。
  // 台湾：上游精简版自带的地区定义随时可能被上游删改，这里做兜底——
  // 上游已有（含「台湾省」等旧名，按关键词去重）时不重复建组，缺失时补上。
  const extraRegions = [
    {
      name: '台湾',
      flag: '🇹🇼',
      regex: /🇹🇼|台湾|台北|高雄|(?<![A-Za-z])TWN?(?![A-Za-z])|taiwan/i,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png',
    },
  ];

  const shouldRemove = (region) =>
    removedRegionKeywords.some((keyword) => region.name.includes(keyword));

  // 0) 默认关闭地区自动选择子组：地区组内不再附带「X-自动选择」url-test 组，
  //    组内只保留节点列表（默认选中第一项）。仍可在脚本开关或客户端里重新打开。
  ruleOptionsEnable.生成地区自动选择组 = false;

  // 1) 移除地区定义（两个数组都要处理）
  for (let i = regionDefinitions.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(regionDefinitions[i])) regionDefinitions.splice(i, 1);
  }

  for (let i = allRegionDefinitions.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(allRegionDefinitions[i])) allRegionDefinitions.splice(i, 1);
  }

  // 2) 清理指向被移除地区的默认选中，避免生成指向不存在策略组的配置
  for (const service of serviceConfigs) {
    if (
      typeof service.defaultSelected === 'string' &&
      removedRegionKeywords.some((keyword) => service.defaultSelected.includes(keyword))
    ) {
      delete service.defaultSelected;
    }
  }

  // 3) 追加地区：插到倍率组之前，保持「地区组 → 倍率组」的顺序与全量版一致
  for (const region of extraRegions) {
    // 名称按关键词去重：上游可能用「台湾省」，也可能是「台湾」，任一存在即跳过
    const alreadyDefined = (item) => item.name.includes(region.name) || region.name.includes(item.name);

    if (regionDefinitions.some(alreadyDefined) || allRegionDefinitions.some(alreadyDefined)) continue;

    regionDefinitions.push(region);

    const rateStartIndex = allRegionDefinitions.findIndex((item) => rateRegionDefinitions.includes(item));

    if (rateStartIndex >= 0) {
      allRegionDefinitions.splice(rateStartIndex, 0, region);
    } else {
      allRegionDefinitions.push(region);
    }
  }
})();