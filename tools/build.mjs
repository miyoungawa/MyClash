import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const upstreamUrl =
  'https://raw.githubusercontent.com/AIsouler/MyClash/main/Script/Script.js';

const overlayPath = resolve(root, 'overlay', 'discord.js');
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

const overlay = await readFile(overlayPath, 'utf8');

const combined = `${upstream.trimEnd()}

/* ===== 以下内容由个人仓库自动追加 ===== */

${overlay.trim()}
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
