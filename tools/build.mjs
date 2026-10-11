import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const upstreamUrl =
  'https://raw.githubusercontent.com/AIsouler/MyClash/main/Script/Script.js';

const overlayPaths = [
  resolve(root, 'overlay', 'discord.js'),
  resolve(root, 'overlay', 'bilibili.js'),
  resolve(root, 'overlay', 'dns.js'),
  resolve(root, 'overlay', 'service-defaults.js'),
  resolve(root, 'overlay', 'regions.js'),
];
const outputPath = resolve(root, 'dist', 'Script.js');

const response = await fetch(upstreamUrl, {
  redirect: 'follow',
  signal: AbortSignal.timeout(30000),
  headers: {
    'User-Agent': 'MyClash-Discord-Overlay',
    'Cache-Control': 'no-cache',
  },
});

if (!response.ok) {
  throw new Error(
    `下载上游 Script.js 失败：HTTP ${response.status}`,
  );
}

const upstream = await response.text();

const requiredMarkers = [
  'const ruleOptionsEnable',
  'const baseGroups',
  'const serviceConfigs',
  'function main(config)',
];

for (const marker of requiredMarkers) {
  if (!upstream.includes(marker)) {
    throw new Error(
      `上游结构已变化，缺少关键标记：${marker}。为避免发布错误脚本，本次更新已停止。`,
    );
  }
}

const overlays = await Promise.all(
  overlayPaths.map(async (path) => (await readFile(path, 'utf8')).trim()),
);

const combined = `${upstream.trimEnd()}

/* ===== 以下内容由个人仓库自动追加 ===== */

${overlays.join('\n\n')}
`;

// 在写入正式文件前实际加载并运行一次。
const sandbox = {
  module: { exports: {} },
  console,
  URL,
  URLSearchParams,
  setTimeout,
  clearTimeout,
};

vm.createContext(sandbox);

vm.runInContext(
  `${combined}
;module.exports = { main, ruleOptionsEnable };`,
  sandbox,
  {
    filename: 'dist/Script.js',
    timeout: 10000,
  },
);

const { main, ruleOptionsEnable } = sandbox.module.exports;

if (typeof main !== 'function') {
  throw new Error('生成脚本没有导出有效的 main() 函数');
}

if (ruleOptionsEnable.Discord !== true) {
  throw new Error('Discord 开关没有成功启用');
}

const sampleConfig = {
  proxies: [
    {
      name: '香港测试节点',
      type: 'ss',
      server: 'hk.example.com',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'test',
    },
    {
      name: '日本测试节点',
      type: 'ss',
      server: 'jp.example.com',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'test',
    },
    {
      name: '美国测试节点',
      type: 'vmess',
      server: 'us.example.com',
      port: 443,
      uuid: '00000000-0000-0000-0000-000000000000',
      alterId: 0,
    },
    {
      name: '新加坡测试节点',
      type: 'ss',
      server: 'sg.example.com',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'test',
    },
    {
      name: '台湾测试节点',
      type: 'ss',
      server: 'tw.example.com',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'test',
    },
  ],
};

const output = main(sampleConfig);

const groups = output['proxy-groups'] || [];
const providers = output['rule-providers'] || {};
const rules = output.rules || [];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const discordGroup = groups.find(
  (group) => group.name === 'Discord',
);

assert(discordGroup, '没有生成 Discord 策略组');
assert(
  Array.isArray(discordGroup.proxies) &&
    discordGroup.proxies.length > 0,
  'Discord 策略组中没有可选策略',
);

assert(providers.discord, '没有生成 discord Rule Provider');
assert(
  providers.discord.behavior === 'domain',
  'discord Rule Provider 不是 domain 类型',
);

for (const rule of [
  'RULE-SET,discord,Discord',
  'PROCESS-NAME,Discord.exe,Discord',
  'PROCESS-NAME,DiscordPTB.exe,Discord',
  'PROCESS-NAME,DiscordCanary.exe,Discord',
  'PROCESS-NAME,Discord,Discord',
  'PROCESS-NAME,com.discord,Discord',
]) {
  assert(rules.includes(rule), `缺少 Discord 规则：${rule}`);
}

const discordRuleIndex = rules.indexOf(
  'RULE-SET,discord,Discord',
);
const googleRuleIndex = rules.indexOf(
  'RULE-SET,google,Google',
);

assert(
  googleRuleIndex === -1 ||
    discordRuleIndex < googleRuleIndex,
  'Discord 规则必须位于 Google 规则之前',
);

// 默认选中断言：default-selected 必须确实存在于该组的 proxies 中，
// 否则内核会静默回落到列表第一项（见 mihomo Selector 的 selectedProxy）
const expectedDefaultSelected = {
  AI: '日本',
  Discord: '手动选择',
};

for (const [groupName, target] of Object.entries(expectedDefaultSelected)) {
  const group = groups.find((item) => item.name === groupName);

  assert(group, `没有生成 ${groupName} 策略组`);
  assert(
    group['default-selected'] === target,
    `${groupName} 的 default-selected 应为「${target}」，实际为「${group['default-selected']}」`,
  );
  assert(
    group.proxies.includes(target),
    `${groupName} 的默认选中「${target}」不在其 proxies 列表中，内核会回落到第一项`,
  );
}

// 哔哩哔哩断言：规则必须排在 geolocation-cn 之前，
// 否则 B 站主站域名会被国内直连规则提前匹配，该组只能接管到海外域名
const bilibiliGroup = groups.find((group) => group.name === '哔哩哔哩');

assert(bilibiliGroup, '没有生成哔哩哔哩策略组');
assert(bilibiliGroup.proxies.includes('直连'), '哔哩哔哩策略组缺少「直连」选项');
assert(
  bilibiliGroup['default-selected'] === '直连',
  `哔哩哔哩的 default-selected 应为「直连」，实际为「${bilibiliGroup['default-selected']}」`,
);

assert(providers.bilibili, '没有生成 bilibili Rule Provider');
assert(
  providers.bilibili.behavior === 'domain',
  'bilibili Rule Provider 不是 domain 类型',
);

const bilibiliRule = 'RULE-SET,bilibili,哔哩哔哩';
const cnRuleIndex = rules.indexOf('RULE-SET,geolocation-cn,直连');

assert(
  rules.filter((rule) => rule === bilibiliRule).length === 1,
  `哔哩哔哩规则应出现且仅出现一次：${bilibiliRule}`,
);
assert(
  cnRuleIndex === -1 || rules.indexOf(bilibiliRule) < cnRuleIndex,
  '哔哩哔哩规则必须位于 geolocation-cn（国内直连）之前，否则无法接管 B 站主站流量',
);

// 哔哩哔哩 DNS 加固断言：B 站域名必须走国内解析器，
// 否则国外 DoH 会把它答成海外加速地址（从国内直连会超时）
const nameserverPolicy = output.dns && output.dns['nameserver-policy'];

assert(nameserverPolicy, '生成的配置缺少 dns.nameserver-policy');
assert(
  Array.isArray(nameserverPolicy['rule-set:bilibili']) &&
    nameserverPolicy['rule-set:bilibili'].length > 0,
  '缺少 rule-set:bilibili 的解析器策略',
);
assert(
  JSON.stringify(nameserverPolicy['rule-set:bilibili']) ===
    JSON.stringify(nameserverPolicy['rule-set:cn']),
  'rule-set:bilibili 的解析器应与 rule-set:cn 保持一致',
);

// 国内直连解析器统一断言：四处（引导 / 节点域名 / 国内策略 / 直连出口）必须完全一致，
// 且腾讯 Public DNS 位于首位
const expectedDomesticDns = ['119.29.29.29#DIRECT', '223.5.5.5#DIRECT'];

for (const field of ['default-nameserver', 'proxy-server-nameserver', 'direct-nameserver']) {
  assert(
    JSON.stringify(output.dns[field]) === JSON.stringify(expectedDomesticDns),
    `${field} 应为国内直连解析器 ${expectedDomesticDns.join(' / ')}，实际为 ${JSON.stringify(output.dns[field])}`,
  );
}

for (const key of ['rule-set:cn', 'rule-set:bilibili']) {
  assert(
    JSON.stringify(output.dns['nameserver-policy'][key]) === JSON.stringify(expectedDomesticDns),
    `nameserver-policy 的 ${key} 应为 ${expectedDomesticDns.join(' / ')}，实际为 ${JSON.stringify(output.dns['nameserver-policy'][key])}`,
  );
}

assert(
  output.dns['direct-nameserver'][0] === '119.29.29.29#DIRECT',
  '腾讯 Public DNS 应位于国内直连解析器首位',
);

// 反向断言：防止补丁改过头，破坏防泄露 / 局域网解析 / 抖音专用策略
assert(
  Array.isArray(output.dns.nameserver) &&
    output.dns.nameserver.length > 0 &&
    output.dns.nameserver.every((item) => item.includes('#默认代理')),
  '默认 nameserver 必须保持经代理出口，否则会泄露 DNS 查询',
);
assert(
  output.dns['nameserver-policy']['rule-set:private'] === 'system',
  'rule-set:private 必须保持 system，否则局域网域名无法解析',
);
assert(
  output.dns['nameserver-policy']['rule-set:douyin'] !== undefined,
  'rule-set:douyin 应保持上游原样，不应被移除',
);

// 地区调整断言：被移除的地区不应再生成策略组（含其自动选择子组），其节点应归入「其他节点」
// 按关键词匹配而非完整名称，兼容上游改名（「台湾省」→「台湾」）
for (const keyword of ['新加坡', '台湾']) {
  assert(
    !groups.some((group) => group.name.includes(keyword)),
    `仍生成了含「${keyword}」的策略组，地区移除未生效`,
  );
}

for (const kept of ['香港', '日本', '美国']) {
  assert(
    groups.some((group) => group.name === kept),
    `地区「${kept}」不应被移除`,
  );
}

const otherGroup = groups.find((group) => group.name === '其他节点');

assert(otherGroup, '被移除地区的节点没有归入「其他节点」');
for (const node of ['新加坡测试节点', '台湾测试节点']) {
  assert(
    otherGroup.proxies.some((name) => name.includes(node)),
    `节点「${node}」没有出现在「其他节点」中`,
  );
}

const missingProviders = rules
  .filter(
    (rule) =>
      typeof rule === 'string' &&
      rule.startsWith('RULE-SET,'),
  )
  .map((rule) => rule.split(',')[1])
  .filter((name) => !providers[name]);

assert(
  missingProviders.length === 0,
  `存在未定义的 Rule Provider：${[
    ...new Set(missingProviders),
  ].join(', ')}`,
);

const groupNames = groups.map((group) => group.name);

assert(
  new Set(groupNames).size === groupNames.length,
  '生成结果中存在重复策略组',
);

// 所有检查通过后才覆盖正式输出文件。
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, combined, 'utf8');

const upstreamHash = createHash('sha256')
  .update(upstream)
  .digest('hex')
  .slice(0, 12);

console.log(`上游 Script.js：${upstreamHash}`);
console.log(`策略组数量：${groups.length}`);
console.log(`规则数量：${rules.length}`);
console.log(`已生成：${outputPath}`);
