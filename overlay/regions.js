/*
 * MyClash 额外地区补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 精简版（dist）内置地区只有 香港 / 日本 / 美国 / 新加坡，本补丁补上台湾省（与全量版一致）。
 *
 * 注意：脚本内有两个数组——
 *   regionDefinitions        用于判定“是否地区节点”（影响节点过滤与「其他节点」归类）
 *   allRegionDefinitions     用于节点匹配与策略组生成，在加载时已复制为
 *                            [...regionDefinitions, ...rateRegionDefinitions]
 * 所以新增地区必须把同一个对象同时写入两者，否则会出现
 * 「地区组生成了、但节点同时落进其他节点」或「节点匹配不到地区」的问题。
 */
(() => {
  // 需要新增的地区，字段与上游 regionDefinitions 保持一致；可继续往下追加
  const extraRegions = [
    {
      name: '台湾省',
      flag: '🇹🇼',
      regex: /🇹🇼|台湾|台北|高雄|(?<![A-Za-z])TWN?(?![A-Za-z])|taiwan/i,
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png',
    },
  ];

  for (const region of extraRegions) {
    // 上游若已内置同名地区则跳过，避免生成重复策略组
    if (allRegionDefinitions.some((item) => item.name === region.name)) continue;

    regionDefinitions.push(region);

    // 插到倍率组之前，保持「地区组 → 倍率组」的顺序与全量版一致
    const rateStartIndex = allRegionDefinitions.findIndex((item) => rateRegionDefinitions.includes(item));

    if (rateStartIndex >= 0) {
      allRegionDefinitions.splice(rateStartIndex, 0, region);
    } else {
      allRegionDefinitions.push(region);
    }
  }
})();
