/*
 * MyClash 哔哩哔哩分流补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 规则为什么放进 prefixRules（而不是像 Discord 那样交给分流区）：
 *   生成的规则数组是 [...prefixRules, ...屏蔽国外QUIC, ...分流规则, 兜底规则]，
 *   而 prefixRules 里的 RULE-SET,geolocation-cn,直连 会把 B 站主站域名
 *   （geosite 中归入 cn 的那批）提前匹配成直连。若规则放在分流区，
 *   「哔哩哔哩」组实际只能接管 bilibili.tv / biliintl.com 这类 @!cn 域名。
 *   插到 prefixRules 中 geolocation-cn 之前，该组即可接管全部 B 站流量。
 *
 * 该策略组默认选中「直连」，所以默认行为与改动前一致；
 * 需要看港澳台等限定内容时，在面板里把该组切到对应地区即可。
 */
(() => {
  const serviceName = '哔哩哔哩';

  // 上游按 ruleOptionsEnable[组名] 决定是否生成该分流组、是否注册其 rule-provider，
  // 新增的组必须在这里打开开关，否则组与 provider 都不会生成。
  ruleOptionsEnable[serviceName] = true;

  const bilibiliProvider = {
    ...ruleProviderCommonDomain,
    url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/bilibili.mrs',
    path: './ruleset/bilibili.mrs',
    'path-in-bundle': 'geo/geosite/bilibili.mrs',
  };

  const bilibiliService = {
    name: serviceName,
    baseOption: selectBaseOption,
    // 让组内附带「直连」选项（与 FCM / Microsoft 等组一致）
    direct: true,
    defaultSelected: '直连',
    providers: { bilibili: bilibiliProvider },
    icon: 'https://fastly.jsdelivr.net/gh/MiToverG422/Qure@master/IconSet/Color/bilibili.png',
    // 本组的规则由下面的 prefixRules 承载，故不在这里配置 rules，
    // 避免在分流区再生成一条永远不会命中的重复规则。
  };

  const existingIndex = serviceConfigs.findIndex((service) => service.name === serviceName);

  if (existingIndex >= 0) {
    serviceConfigs.splice(existingIndex, 1);
  }

  serviceConfigs.push(bilibiliService);

  const bilibiliRule = `RULE-SET,bilibili,${serviceName}`;

  if (!prefixRules.includes(bilibiliRule)) {
    const cnRuleIndex = prefixRules.indexOf('RULE-SET,geolocation-cn,直连');

    prefixRules.splice(cnRuleIndex >= 0 ? cnRuleIndex : 0, 0, bilibiliRule);
  }

  /*
   * DNS 加固：为 B 站域名族固定国内解析器。
   *
   * 背景：国外 DoH 会把 s1.hdslb.com 这类域名答成阿里云全球加速段
   * （实测 155.102.175.140-147），从国内直连这些地址基本必然超时；
   * 而国内解析器（223.5.5.5）返回的是国内调度过的边缘地址。
   * 写法与上游的 'rule-set:cn' / 'rule-set:douyin' 一致。
   *
   * nameserver-policy 在 buildDnsAndHostsConfig 内部就地构造，加载期无法访问，
   * 因此在 main() 返回后补写；顺带复用 'rule-set:cn' 的解析器，避免重复定义。
   */
  const originalMain = main;

  main = function (config) {
    const output = originalMain(config);
    const nameserverPolicy = output && output.dns && output.dns['nameserver-policy'];

    if (nameserverPolicy && nameserverPolicy['rule-set:cn'] && !nameserverPolicy['rule-set:bilibili']) {
      nameserverPolicy['rule-set:bilibili'] = nameserverPolicy['rule-set:cn'];
    }

    return output;
  };
})();