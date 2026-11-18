/*
 * MyClash Anthropic 分流补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 规则集：geosite/anthropic.mrs，覆盖 claude.ai / claude.com / anthropic.com，
 * 以及 Anthropic 的 CDN 与 Claude Code 遥测域名。
 *
 * 规则顺序说明：上游 AI 组使用的 category-ai-!cn 已 include:anthropic，
 * 若 AI 规则先执行，Claude 域名会被 AI 组提前匹配，本组永远无法命中。
 * 因此本组插入 serviceConfigs 中 AI 之前，让 Claude 域名优先由「Anthropic」组
 * 接管，其余 AI 服务仍走 AI 组。
 *
 * 默认选中「家宽节点」（住宅/原生 IP 组）；没有家宽节点时内核不会写入该默认值
 * （buildFunctionalGroups 仅在目标存在于 proxies 中时才输出 default-selected）。
 */
(() => {
  const serviceName = 'Anthropic';

  // 上游按 ruleOptionsEnable[组名] 决定是否生成该分流组、是否注册其 rule-provider，
  // 新增的组必须在这里打开开关，否则组与 provider 都不会生成。
  ruleOptionsEnable[serviceName] = true;

  const anthropicService = {
    name: serviceName,
    baseOption: selectBaseOption,
    defaultSelected: '家宽节点',
    providers: {
      anthropic: {
        ...ruleProviderCommonDomain,
        url: `${ruleSetBaseUrl}geosite/anthropic.mrs`,
        path: './ruleset/anthropic.mrs',
        'path-in-bundle': 'geo/geosite/anthropic.mrs',
      },
    },
    rules: [`RULE-SET,anthropic,${serviceName}`],
  };

  const existingIndex = serviceConfigs.findIndex((service) => service.name === serviceName);

  if (existingIndex >= 0) {
    serviceConfigs.splice(existingIndex, 1);
  }

  const aiIndex = serviceConfigs.findIndex((service) => service.name === 'AI');

  if (aiIndex >= 0) {
    serviceConfigs.splice(aiIndex, 0, anthropicService);
  } else {
    serviceConfigs.push(anthropicService);
  }
})();
