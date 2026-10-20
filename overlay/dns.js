/*
 * MyClash DNS 策略补丁
 *
 * 本文件不会修改上游 Script.js。
 * tools/build.mjs 会把本补丁追加到最新版上游脚本末尾。
 *
 * 作用：
 *   1. 统一「国内直连」场景的解析器，优先使用 114 DNS：
 *      - nameserver-policy:cn（国内域名策略）与 direct-nameserver（直连出口）统一为
 *        「114 优先、阿里 DNS（223.5.5.5）备用」；
 *      - 引导层（default-nameserver）与节点域名解析（proxy-server-nameserver）
 *        分开维护（当前同值：114 / 阿里）；
 *      - 不再使用上游默认的 1.12.12.12、doh.pub。
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
  // 1) 国内直连解析器：114 DNS 首选、阿里 DNS（223.5.5.5）备选。
  //    注意：内核是并发查询、取先返回者，"首选"只是配置顺序，不保证一定用 114；
  //    好处是抗故障——114 不可用时自动采用阿里的结果，不会因此断网。
  //    说明：备用只在主解析器完全无响应（超时 / SERVFAIL）时才会被采用；
  //    若主解析器返回了内容（哪怕是一条失效 IP），内核不会改用备用，IP 质量靠 tcp-concurrent 兜底。
  //    改写 chinaDNS 会让 nameserver-policy:cn 与 direct-nameserver 一并生效（它们引用同一数组）。
  const domesticDns = ['114.114.114.114#DIRECT', '223.5.5.5#DIRECT'];

  //    引导层（解析 DoH 服务器域名）与节点域名解析：与国内直连分开维护，当前同值。
  const bootstrapDns = ['114.114.114.114#DIRECT', '223.5.5.5#DIRECT'];

  chinaDNS.splice(0, chinaDNS.length, ...domesticDns);
  defaultDNS.splice(0, defaultDNS.length, ...bootstrapDns);
  proxyServerDNS.splice(0, proxyServerDNS.length, ...bootstrapDns);

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
      ruleOptionsEnable['bilibili'] &&
      !nameserverPolicy['rule-set:bilibili']
    ) {
      nameserverPolicy['rule-set:bilibili'] = nameserverPolicy['rule-set:cn'];
    }

    return output;
  };
})();