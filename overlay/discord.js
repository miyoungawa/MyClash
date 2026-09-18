/*
 * MyClash Discord 持久化补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 */
(() => {
  ruleOptionsEnable.Discord = true;

  const discordProvider = {
    ...ruleProviderCommonDomain,
    url: 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/discord.mrs',
    path: './ruleset/discord.mrs',
    'path-in-bundle': 'geo/geosite/discord.mrs',
  };

  const discordRules = [
    'RULE-SET,discord,Discord',
    'PROCESS-NAME,Discord.exe,Discord',
    'PROCESS-NAME,DiscordPTB.exe,Discord',
    'PROCESS-NAME,DiscordCanary.exe,Discord',
    'PROCESS-NAME,Discord,Discord',
    'PROCESS-NAME,com.discord,Discord',
  ];

  const discordIcon =
    'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Discord.png';

  const existingIndex = serviceConfigs.findIndex(
    (service) => service.name === 'Discord',
  );

  let discordService;

  if (existingIndex >= 0) {
    discordService = serviceConfigs[existingIndex];
    serviceConfigs.splice(existingIndex, 1);
  } else {
    discordService = {
      name: 'Discord',
    };
  }

  discordService.baseOption =
    discordService.baseOption || selectBaseOption;

  discordService.providers = {
    ...(discordService.providers || {}),
    discord: discordProvider,
  };

  discordService.rules = [
    ...new Set([
      ...discordRules,
      ...(discordService.rules || []),
    ]),
  ];

  discordService.icon = discordService.icon || discordIcon;

  // 放在基础策略组之后、Google 等宽泛规则之前，
  // 防止 Discord 附件域名被 Google 规则提前匹配。
  serviceConfigs.splice(baseGroups.length, 0, discordService);
})();
