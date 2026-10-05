/*
 * MyClash 地区调整补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 作用：增删地区策略组（当前为移除 新加坡 与 台湾省），
 *       被移除地区的节点不会被丢弃，而是归入「其他节点」。
 *
 * 注意：脚本内有两个数组——
 *   regionDefinitions        用于判定“是否地区节点”（影响节点过滤与「其他节点」归类）
 *   allRegionDefinitions     用于节点匹配与策略组生成，在加载时已复制为
 *                            [...regionDefinitions, ...rateRegionDefinitions]
 * 所以增删地区都必须同时处理两者，否则会出现
 * 「地区组没有生成、节点却仍被当作地区节点」或「节点匹配不到地区」的问题。
 */
(() => {
  // 需要移除的地区（保留：香港 / 日本 / 美国）
  const removedRegionNames = ['新加坡', '台湾省'];

  // 需要追加的地区，字段与上游 regionDefinitions 保持一致（当前为空）
  const extraRegions = [];

  const shouldRemove = (region) => removedRegionNames.includes(region.name);

  // 1) 移除地区定义（两个数组都要处理）
  for (let i = regionDefinitions.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(regionDefinitions[i])) regionDefinitions.splice(i, 1);
  }

  for (let i = allRegionDefinitions.length - 1; i >= 0; i -= 1) {
    if (shouldRemove(allRegionDefinitions[i])) allRegionDefinitions.splice(i, 1);
  }

  // 2) 清理指向被移除地区的默认选中，避免生成指向不存在策略组的配置
  for (const service of serviceConfigs) {
    if (removedRegionNames.includes(service.defaultSelected)) {
      delete service.defaultSelected;
    }
  }

  // 3) 追加地区：插到倍率组之前，保持「地区组 → 倍率组」的顺序与全量版一致
  for (const region of extraRegions) {
    if (allRegionDefinitions.some((item) => item.name === region.name)) continue;

    regionDefinitions.push(region);

    const rateStartIndex = allRegionDefinitions.findIndex((item) => rateRegionDefinitions.includes(item));

    if (rateStartIndex >= 0) {
      allRegionDefinitions.splice(rateStartIndex, 0, region);
    } else {
      allRegionDefinitions.push(region);
    }
  }
})();