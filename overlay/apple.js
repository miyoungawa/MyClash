/*
 * MyClash Apple 分流补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 结构与上游全量版的 Apple 组一致（精简版砍掉了该组）：
 *   - 域名规则：geosite/apple.mrs → 「Apple」组
 *   - IP 规则：geoip/apple.mrs（no-resolve，不做 DNS 解析）→ 「Apple」组
 *
 * 规则顺序说明：prefixRules 中已存在 RULE-SET,apple_cn,直连（中国区 Apple 域名直连），
 * 它优先于本组在分流区的规则，所以中国区 CDN 保持直连，本组只接管其余 Apple 流量。
 *
 * 该策略组默认选中「直连」，默认行为与改动前一致；
 * 需要走代理（如美区账号 / Apple Intelligence）时在面板切换即可。
 */
(() => {
  const serviceName = 'Apple';

  // 上游按 ruleOptionsEnable[组名] 决定是否生成该分流组、是否注册其 rule-provider，
  // 新增的组必须在这里打开开关，否则组与 provider 都不会生成。
  ruleOptionsEnable[serviceName] = true;

  const appleService = {
    name: serviceName,
    baseOption: selectBaseOption,
    // 让组内附带「直连」选项（与 FCM / Microsoft 等组一致）
    direct: true,
    defaultSelected: '直连',
    providers: {
      apple: {
        ...ruleProviderCommonDomain,
        url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple.mrs',
        path: './ruleset/apple.mrs',
        'path-in-bundle': 'geo/geosite/apple.mrs',
      },
      apple_ip: {
        ...ruleProviderCommonIpcidr,
        url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/apple.mrs',
        path: './ruleset/apple_ip.mrs',
        'path-in-bundle': 'geo/geoip/apple.mrs',
      },
    },
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png',
    // 规则放分流区（在 apple_cn 直连规则之后执行），接管非中国区的 Apple 流量
    rules: [`RULE-SET,apple,${serviceName}`, `RULE-SET,apple_ip,${serviceName},no-resolve`],
  };

  const existingIndex = serviceConfigs.findIndex((service) => service.name === serviceName);

  if (existingIndex >= 0) {
    serviceConfigs.splice(existingIndex, 1);
  }

  serviceConfigs.push(appleService);
})();