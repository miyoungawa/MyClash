/*
 * MyClash DNS 策略补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 作用：
 *   1. 统一「国内直连」场景的解析器：把 default-nameserver（引导）与
 *      proxy-server-nameserver（解析节点 server 域名）换成与国内直连相同的
 *      chinaDNS（223.5.5.5 / 119.29.29.29），不再使用 114.114.114.114 等。
 *   2. 为 B 站域名族补 nameserver-policy（依赖 bilibili.js 注册的 provider）。
 *
 * 刻意不动的部分：
 *   - nameserver（默认解析器 = 走代理的 Cloudflare / Google DoH）：它是防 DNS 泄露的关键。
 *   - nameserver-policy['rule-set:private'] = system：局域网/私有域名只能交给本机解析器。
 *   - nameserver-policy['rule-set:douyin']：上游为抖音 CDN 调度特意配置的 system + 字节 DNS。
 *
 * 实现说明：defaultDNS / proxyServerDNS 是上层脚本里的 const 数组，
 * 生成的 dns 块直接引用这两个数组对象，所以这里改数组内容即可生效。
 *
 * 本补丁需排在 bilibili.js 之后：第 2 步要用到它设置的 ruleOptionsEnable 开关。
 */
(() => {
  // 1) 国内直连场景统一使用与 rule-set:cn / direct-nameserver 相同的解析器
  defaultDNS.splice(0, defaultDNS.length, ...chinaDNS);
  proxyServerDNS.splice(0, proxyServerDNS.length, ...chinaDNS);

  // 2) B 站域名族固定国内解析器（国外 DoH 会把它答成海外加速地址，从国内直连会超时）。
  //    nameserver-policy 在 buildDnsAndHostsConfig 内部就地构造，加载期无法访问，
  //    因此在 main() 返回后补写。
  const originalMain = main;

  main = function (config) {
    const output = originalMain(config);
    const nameserverPolicy = output && output.dns && output.dns['nameserver-policy'];

    if (
      nameserverPolicy &&
      nameserverPolicy['rule-set:cn'] &&
      ruleOptionsEnable['哔哩哔哩'] &&
      !nameserverPolicy['rule-set:bilibili']
    ) {
      nameserverPolicy['rule-set:bilibili'] = nameserverPolicy['rule-set:cn'];
    }

    return output;
  };
})();