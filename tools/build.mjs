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
  resolve(root, 'overlay', 'apple.js'),
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

// 普通模式与极简模式均不应生成 bilibili 专用配置。
const assertNoBilibili = (config) => {
  assert(!config['proxy-groups'].some((group) => group.name === 'bilibili'), '不应生成 bilibili 策略组');
  assert(!config['rule-providers'].bilibili, '不应生成 bilibili Rule Provider');
  assert(
    !config.rules.some((rule) => typeof rule === 'string' && rule.split(',').includes('bilibili')),
    '不应保留指向 bilibili 的规则',
  );
  assert(
    config.dns['nameserver-policy']['rule-set:bilibili'] === undefined,
    '不应保留依赖 bilibili Rule Provider 的 DNS 策略',
  );
};

assertNoBilibili(output);
const originalMinimalMode = ruleOptionsEnable.极简模式;
try {
  ruleOptionsEnable.极简模式 = true;
  assertNoBilibili(main(sampleConfig));
} finally {
  ruleOptionsEnable.极简模式 = originalMinimalMode;
}

// Apple 断言：默认选中「直连」、domain + ipcidr 双 provider 齐全、
// 规则各出现一次，且 apple_cn 中国区直连规则保留
const appleGroup = groups.find((group) => group.name === 'Apple');

assert(appleGroup, '没有生成 Apple 策略组');
assert(appleGroup.proxies.includes('直连'), 'Apple 策略组缺少「直连」选项');
assert(
  appleGroup['default-selected'] === '直连',
  `Apple 的 default-selected 应为「直连」，实际为「${appleGroup['default-selected']}」`,
);

assert(providers.apple, '没有生成 apple Rule Provider');
assert(
  providers.apple.behavior === 'domain',
  'apple Rule Provider 不是 domain 类型',
);
assert(providers.apple_ip, '没有生成 apple_ip Rule Provider');
assert(
  providers.apple_ip.behavior === 'ipcidr',
  'apple_ip Rule Provider 不是 ipcidr 类型',
);

for (const rule of ['RULE-SET,apple,Apple', 'RULE-SET,apple_ip,Apple,no-resolve']) {
  assert(
    rules.filter((item) => item === rule).length === 1,
    `Apple 规则应出现且仅出现一次：${rule}`,
  );
}

assert(
  rules.includes('RULE-SET,apple_cn,直连'),
  '缺少 apple_cn 中国区直连规则（不得被 Apple 组规则取代）',
);

const nameserverPolicy = output.dns && output.dns['nameserver-policy'];

assert(nameserverPolicy, '生成的配置缺少 dns.nameserver-policy');

// 国内直连解析器断言：国内策略（rule-set:cn）与直连出口（direct-nameserver）
// 必须统一为「114 优先、阿里备用」
const expectedChinaDns = ['114.114.114.114#DIRECT', '223.5.5.5#DIRECT'];
// 引导层与节点域名解析（独立维护，当前同值）
const expectedBootstrapDns = ['114.114.114.114#DIRECT', '223.5.5.5#DIRECT'];

for (const field of ['default-nameserver', 'proxy-server-nameserver']) {
  assert(
    JSON.stringify(output.dns[field]) === JSON.stringify(expectedBootstrapDns),
    `${field} 应为引导解析器 ${expectedBootstrapDns.join(' / ')}，实际为 ${JSON.stringify(output.dns[field])}`,
  );
}

assert(
  JSON.stringify(nameserverPolicy['rule-set:cn']) === JSON.stringify(expectedChinaDns),
  `nameserver-policy 的 rule-set:cn 应为 ${expectedChinaDns.join(' / ')}，实际为 ${JSON.stringify(nameserverPolicy['rule-set:cn'])}`,
);

assert(
  JSON.stringify(output.dns['direct-nameserver']) === JSON.stringify(expectedChinaDns),
  `direct-nameserver 应为 ${expectedChinaDns.join(' / ')}，实际为 ${JSON.stringify(output.dns['direct-nameserver'])}`,
);

assert(
  output.dns['direct-nameserver'][0] === '114.114.114.114#DIRECT',
  '114 DNS 应位于国内直连解析器首位',
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
for (const keyword of ['新加坡']) {
  assert(
    !groups.some((group) => group.name.includes(keyword)),
    `仍生成了含「${keyword}」的策略组，地区移除未生效`,
  );
}

for (const kept of ['香港', '日本', '美国', '台湾']) {
  assert(
    groups.some((group) => group.name.includes(kept)),
    `地区「${kept}」不应被移除`,
  );
}

// 台湾保留断言：节点必须落在台湾地区组内，而不是被归入「其他节点」
// 组名按关键词找而非精确匹配，兼容上游「台湾省」/「台湾」两种命名
const taiwanGroup = groups.find((group) => group.name.startsWith('台湾'));

assert(taiwanGroup, '没有生成台湾策略组');
const googleGroup = groups.find((group) => group.name === 'Google');
assert(googleGroup, '没有生成 Google 策略组');
assert(
  googleGroup['default-selected'] === taiwanGroup.name && googleGroup.proxies.includes(taiwanGroup.name),
  'Google 默认选中应为实际生成的台湾策略组',
);
const outputWithoutTaiwan = main({
  proxies: sampleConfig.proxies.filter((proxy) => !proxy.name.includes('台湾')),
});
const googleWithoutTaiwan = outputWithoutTaiwan['proxy-groups'].find((group) => group.name === 'Google');
assert(
  googleWithoutTaiwan && (!googleWithoutTaiwan['default-selected'] ||
    googleWithoutTaiwan.proxies.includes(googleWithoutTaiwan['default-selected'])),
  '没有台湾节点时 Google 不应默认选中不存在的策略组',
);
assert(
  taiwanGroup.proxies.some((name) => name.includes('台湾测试节点')),
  '节点「台湾测试节点」没有出现在台湾策略组中',
);

// 地区自动选择子组默认关闭断言：补丁把「生成地区自动选择组」改为 false，
// 不应再生成形如「香港-自动选择」的子组（顶层「自动选择」组名不带该后缀，不受影响）
assert(
  !groups.some((group) => group.name.endsWith('-自动选择')),
  '仍生成了形如「香港-自动选择」的地区自动选择子组，「生成地区自动选择组」默认关闭未生效',
);

const otherGroup = groups.find((group) => group.name === '其他节点');

assert(otherGroup, '被移除地区的节点没有归入「其他节点」');
for (const node of ['新加坡测试节点']) {
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

// 规则集 URL 探活：上游/镜像仓库调整路径时，provider 会静默 404，
// 内核只在运行时打一条 initial rule provider error，构建期发现不了。
// 这里只把 404 判为失败（确定性的路径错误），网络错误与 5xx 仅告警，避免 CDN 抖动阻塞发布。
const providerUrls = [
  ...new Set(
    Object.values(providers)
      .map((provider) => provider.url)
      .filter((url) => typeof url === 'string' && url.startsWith('http')),
  ),
];

const missingProviderUrls = [];

await Promise.all(
  providerUrls.map(async (url) => {
    try {
      const providerResponse = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'MyClash-Build-Check',
          Range: 'bytes=0-0',
        },
      });

      if (providerResponse.status === 404) {
        missingProviderUrls.push(url);
      } else if (!providerResponse.ok && providerResponse.status !== 206) {
        console.warn(
          `规则集探活返回 HTTP ${providerResponse.status}（忽略）：${url}`,
        );
      }

      await providerResponse.body?.cancel?.();
    } catch (error) {
      console.warn(`规则集探活失败（忽略）：${url} -> ${error.message}`);
    }
  }),
);

assert(
  missingProviderUrls.length === 0,
  `以下 Rule Provider 地址返回 404：\n${missingProviderUrls.join('\n')}`,
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
