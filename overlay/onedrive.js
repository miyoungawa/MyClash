/*
 * MyClash OneDrive 分流补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 说明：精简版（dist）没有 Microsoft 策略组，OneDrive 流量此前由兜底规则
 * 送到「默认代理」。本补丁为其建立独立策略组，便于单独指定出口或地区。
 * 世纪互联版（sharepoint.cn 等 .cn 域名）仍由前缀规则 microsoft_cn 直连，不受影响。
 */
(() => {
  ruleOptionsEnable.OneDrive = true;

  // 是否把 SharePoint（OneDrive for Business 文档库）一并纳入本组
  // 注意：sharepoint.mrs 覆盖的是国际版 sharepoint.com / sharepointonline.com
  const includeSharepoint = true;

  const onedriveProviders = {
    onedrive: {
      ...ruleProviderCommonDomain,
      url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/onedrive.mrs',
      path: './ruleset/onedrive.mrs',
      'path-in-bundle': 'geo/geosite/onedrive.mrs',
    },
    ...(includeSharepoint && {
      sharepoint: {
        ...ruleProviderCommonDomain,
        url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/sharepoint.mrs',
        path: './ruleset/sharepoint.mrs',
        'path-in-bundle': 'geo/geosite/sharepoint.mrs',
      },
    }),
  };

  const onedriveRules = ['RULE-SET,onedrive,OneDrive'];

  if (includeSharepoint) {
    onedriveRules.push('RULE-SET,sharepoint,OneDrive');
  }

  const onedriveIcon = 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/OneDrive.png';

  const existingIndex = serviceConfigs.findIndex((service) => service.name === 'OneDrive');

  let onedriveService;

  if (existingIndex >= 0) {
    onedriveService = serviceConfigs[existingIndex];
    serviceConfigs.splice(existingIndex, 1);
  } else {
    onedriveService = {
      name: 'OneDrive',
    };
  }

  onedriveService.baseOption = onedriveService.baseOption || selectBaseOption;

  // 首个选项是「默认代理」，即默认走代理；把「直连」同时纳入可选，方便按需切换
  onedriveService.direct = onedriveService.direct === undefined ? true : onedriveService.direct;

  onedriveService.providers = {
    ...(onedriveService.providers || {}),
    ...onedriveProviders,
  };

  onedriveService.rules = [...new Set([...onedriveRules, ...(onedriveService.rules || [])])];

  onedriveService.icon = onedriveService.icon || onedriveIcon;

  // 放在基础策略组之后、Google 等宽泛规则之前，
  // 与 Discord 补丁同一位置（两者域名无重叠，先后顺序不影响结果）。
  serviceConfigs.splice(baseGroups.length, 0, onedriveService);
})();