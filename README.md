
# MyClash

基于 [mihomo](https://github.com/MetaCubeX/mihomo/tree/Alpha) 的配置与覆写脚本，提供全量版和精简版。

本仓库 fork 自 [AIsouler/MyClash](https://github.com/AIsouler/MyClash)，其实原因是想和自己的女朋友sakiki打Discord电话，而原本的MyClash并没有Discord的分流功能，所以在其上追加 **Discord 分流支持**、**自动化构建**与**测试套件**。上游文件保持原样，改动集中在 `overlay/`、`tools/`、`Test/`、`.github/`，以及自动生成的 `dist/Script.js`。

主要特性：

- 内置多种分流策略与地区策略
- 自动排除信息节点与无效地区节点
- 自动识别节点地区与倍率并分类，**按匹配结果动态生成地区策略组**
- 解决机场私有 DNS、hosts 导致节点域名无法解析的问题
- 重写 DNS 配置，无 DNS 泄露风险
- 支持 Bettbox 图形化配置管理

友情推荐：
[Bettbox](https://github.com/appshubcc/Bettbox) —— 一款轻量、省电、低内存占用的代理客户端。

**覆写脚本已适配 Bettbox，可通过图形界面自定义启用策略组及配置选项，获得更灵活的使用体验，具体效果请查看下方效果预览图。**

---

## 目录结构

| 路径                                                     | 说明                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `dist/Script.js`                                       | **本仓库发布的覆写脚本**：上游最新精简版 + Discord 补丁，由 CI 定时构建 |
| `Script/Script.js`                                     | 上游精简版脚本快照                                                            |
| `Script/mihomoScript.js`                               | 上游全量版脚本快照                                                            |
| `Config/mihomoConfigLite.yaml` / `Config/mihomoConfig.yaml` | 上游配置文件快照（provider 式，独立使用，**不能**挂覆写脚本，见下文） |
| `overlay/`                                                                  | 补丁目录：`discord.js`（Discord 分流）、`onedrive.js`（OneDrive 分流），构建时依次追加到上游脚本末尾 |
| `tools/build.mjs`                                      | 构建脚本：下载上游脚本 → 追加补丁 → 沙箱自检 → 写出`dist/Script.js`      |
| `Test/`                                                | 覆写脚本测试套件（单元 / 集成 / ES2020 兼容性 / QuickJS 引擎验证）            |
| `.github/workflows/`                                   | 定时构建与格式检查                                                            |

> `Script/`、`Config/` 是上游某一时点的快照，可能滞后于上游仓库；`dist/Script.js` 每次构建都基于上游的最新版本生成。两者内容不一致时，**以 `dist/Script.js` 为准**。

---

## 覆写脚本

### 注意事项

> [!IMPORTANT]
> ⚠️该脚本仅用于覆写机场提供的配置文件，请勿用于覆写自行编写的配置
>
> ⚠️输入配置中的节点必须是**内联的 `proxies:` 列表**。若配置里含有 `proxy-providers`，脚本会直接中断并报错：
>
> ```
> 配置文件中包含 proxy-providers，请使用机场提供的配置文件进行覆写
> ```
>
> 这是有意为之：provider 中的节点要等内核运行时才会下载，脚本无法对其做过滤、重命名与地区归类，所以覆写在这种输入上根本无法成立。仓库内的 `Config/*.yaml` 正是 provider 式配置，请直接把它当配置使用，**不要**给它挂覆写脚本。
>
> ⚠️脚本已解决部分机场抽象DNS导致无法解析节点或者使用脚本覆写导致解析出来节点延迟高的问题，请务必关闭代理软件的DNS覆写功能

### 脚本功能

- ✅ 解决机场私有 DNS 或节点域名 hosts 映射导致的节点解析问题（节点 hosts 映射将自动改写进节点 `server`，无需复制 hosts）
- ✅ 根据节点匹配情况动态生成地区策略组
- ✅ 自动补全地区国旗、折叠节点名多余空格、按名称去重
- ✅ 自动排除信息节点（流量、到期、官网、客服、订阅、网址等关键词）
- ✅ 自动识别节点倍率并归类为「低倍率节点 / 高倍率节点」
- ✅ 修复链式代理引用：`dialer-proxy` 目标改名时跟随更新，目标不存在时移除该字段
- ✅ 支持在脚本中配置自定义节点（自动生成“自建节点”策略组，与订阅节点重名时自动添加“自建-”前缀）
- ✅ 支持链式代理（将自定义节点作为落地节点，经“链式中转”策略组通过订阅节点中转；启用后自动为自定义节点添加 `dialer-proxy`）
- ✅ 支持极简模式：只保留「默认代理 / 直连 / GLOBAL」，不生成分流组与地区组
- ✅ 支持自定义是否生成地区自动选择策略组
- ✅ 支持自定义是否隐藏地区手动选择策略组
- ✅ 支持自定义是否生成 高/低 倍率节点组
- ✅ 支持自定义是否将全部节点加入分流策略组
- ✅ 支持自定义是否过滤低倍率节点
- ✅ 支持自定义是否过滤高倍率节点
- ✅ 支持自定义是否过滤非地区节点
- ✅ 支持自定义是否屏蔽国外 QUIC 流量
- ✅ 支持自定义是否将订阅节点统一为 IPv4/IPv6 优先（同时开启时不生效）

### 配置项开关

脚本顶部 `ruleOptionsEnable` 中的开关（以本仓库发布的 `dist/Script.js` 为准；脚本跟随上游更新，可能新增开关，例如 `极简模式` 即为较新版本引入）：

| 开关                                                 | 默认  | 说明                                                             |
| ---------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `手动选择`                                         | true  | 生成「手动选择」策略组（含全部节点）                             |
| `自动选择`                                         | true  | 生成「自动选择」url-test 策略组                                  |
| `Google` `AI` `Telegram` `Steam` `AdBlock` | true  | 精简版内置的 5 个分流策略组                                      |
| `极简模式`                                         | false | 只生成「默认代理 / 直连 / GLOBAL」，`MATCH` 直接走「默认代理」 |
| `生成地区自动选择组`                               | true  | 每个地区组内附带一个`<地区>-自动选择` url-test 组              |
| `隐藏地区手动选择组`                               | false | 隐藏地区手动选择组（同时影响「直连」组）                         |
| `生成倍率组`                                       | true  | 生成低倍率 / 高倍率策略组                                        |
| `分流组添加所有节点`                               | false | 把全部节点直接加入各分流策略组                                   |
| `过滤低倍率节点`                                   | false | 剔除低倍率节点                                                   |
| `过滤高倍率节点`                                   | false | 剔除高倍率节点                                                   |
| `过滤非地区节点`                                   | true  | 剔除匹配不到地区、且命中信息节点关键词的节点                     |
| `屏蔽国外QUIC`                                     | true  | UDP 443 且目标非国内地址一律 REJECT，防止 QUIC 绕过代理          |
| `代理IPV4优先` / `代理IPV6优先`                  | false | 统一节点 IP 版本，两者同时开启时不生效                           |
| `链式代理`                                         | false | 需配合自定义节点使用，未配置自定义节点时会直接报错               |

全量版另有 `负载均衡`、`FCM`、`YouTube`、`Microsoft`、`Apple`、`TikTok`、`Twitter`、`Meta`、`Line`、`Netflix`、`Emby`、`PikPak`、`Spotify`、`Crypto`、`EHentai` 等开关。

### 使用方法（脚本）

复制以下任意一个链接或者复制完整代码后按如图所示步骤导入到代理客户端，以 [Bettbox](https://github.com/appshubcc/Bettbox) 为例

- **精简版（推荐，含本仓库追加的 Discord 策略组）**，复制下面这个链接使用👇👇👇

```txt
https://raw.githubusercontent.com/miyoungawa/MyClash/main/dist/Script.js
```

- **全量版**（分流策略组更多，上游快照，不含 Discord）

```txt
https://raw.githubusercontent.com/miyoungawa/MyClash/main/Script/mihomoScript.js
```

|                             |
| --------------------------- |
| ![img](./Image/import.webp) |

### 处理流程

脚本的 `main(config)` 分四步覆写订阅配置：

1. **过滤与规范化节点**：剔除 `direct`/`reject`/`rematch` 类型与信息节点，补国旗、折叠空格、去重，修复链式代理引用，按需统一 IP 版本
2. **归类地区与倍率**：按节点名匹配地区与倍率，**只对匹配到的地区生成策略组**，未匹配到地区的节点归入「其他节点」
3. **组装策略组与规则**：生成「默认代理 / GLOBAL / 直连 / 漏网之鱼」等组与各分流组，装配 `rule-set` 规则（含国内直连前置规则、可选的国外 QUIC 拦截、兜底规则）
4. **重写 DNS 与 hosts**：保留必要的节点域名解析策略，按 hosts 映射改写节点 `server`，并写入完整的 DNS 配置

---

## DNS 说明

脚本**不继承订阅的 DNS**，而是重写整套 DNS（这也是要求关闭客户端 DNS 覆写的原因：DNS 配置与路由规则是配套设计的）：

| 字段                        | 取值                                                     | 作用                                    |
| --------------------------- | -------------------------------------------------------- | --------------------------------------- |
| `default-nameserver`      | `114.114.114.114`、`tls://223.5.5.5`、`1.12.12.12` | 引导用，解析下面那些 DoH 服务器域名本身 |
| `proxy-server-nameserver` | `114.114.114.114`、`tls://223.5.5.5`、`doh.pub`    | 解析节点`server` 域名                 |
| `nameserver`              | Cloudflare / Google DoH，均带`#默认代理`               | 默认解析器，查询经代理，避免 DNS 泄露   |
| `nameserver-policy`       | `rule-set:cn` → 国内 DNS（`#DIRECT`）               | 国内域名走国内解析                      |
| `direct-nameserver`       | 国内 DNS                                                 | 直连出口的解析                          |

此外固定开启 fake-ip（`198.18.0.1/15`、`2001:2::1/48`）、`cache-algorithm: arc`、`use-hosts`，并把 `rule-set:private`、`rule-set:fakeip_filter`、`rule-set:geolocation-cn` 加入 `fake-ip-filter`。

**关于机场的私有 DNS / 私人 DoH**：脚本只在「解析节点域名」这一件事上可能保留订阅里的私有 DNS，写入 `proxy-server-nameserver-policy`。保留条件是二选一：

- 订阅在 `nameserver-policy` 或 `proxy-server-nameserver-policy` 中**显式**为节点域名指定了该 DNS（此路径不做公共 DNS 过滤，原样保留）
- 该 DNS 未被识别为公共 DNS（脚本内置了 50 余条公共 DNS 名单，含 `nextdns`、`adguard`、`dnspod`、`doh.pub`、`dns.google` 等关键词），此时会被套用到全部节点域名上

因此：**若你的机场私人 DoH 域名中含有上述关键词，或只写在 `nameserver` 里且没有针对节点域名的 policy，它会被丢弃，节点域名改由写死的国内 DNS 解析**——如果节点域名只有该 DoH 能解析，就会出现节点解析失败。

同时脚本会用自己生成的 `hosts` 整体替换订阅的 `hosts`，其中固定包含：`doh.pub` / `cloudflare-dns.com` / `dns.google` 的 IP 映射（DoH 自举）、`services.googleapis.cn` 映射（修复谷歌商店下载）、以及 4 条 B 站 PCDN 域名映射到 `0.0.0.0`（解决视频卡顿）。

---

## 内置策略组

> - 若不需要某个分流策略组，可在脚本中将 `ruleOptionsEnable` 对应值设为 `false`
> - 除「GLOBAL」「默认代理」外，未启用/未生成对应内容的组不会出现在最终配置中

**两个版本都会生成**

- `GLOBAL`
- `默认代理`
- `手动选择`
- `自动选择`
- `直连` （可自定义 `双栈/IPv4优先/IPv6优先/仅IPv4/仅IPv6`）
- `漏网之鱼` （极简模式下不生成，`MATCH` 直接走「默认代理」）

**精简版内置分流组**

- `Google`
- `AI` （默认选中「美国」）
- `Telegram`
- `Steam`
- `AdBlock`

**仅全量版**

- `负载均衡`
- `FCM` （默认选中「直连」）
- `YouTube`
- `Microsoft`
- `Apple`
- `TikTok`
- `Twitter`
- `Meta` （Facebook/Instagram/WhatsApp/Messenger/Threads）
- `Line`
- `Netflix`
- `Emby`
- `PikPak`
- `Spotify`
- `Crypto`
- `EHentai`

**本仓库追加**

- `Discord` （由 `overlay/discord.js` 注入，仅 `dist/Script.js` 包含；补丁会把它插在基础策略组之后、Google 等宽泛规则之前，避免 Discord 附件域名被 Google 规则提前匹配）
- `OneDrive` （由 `overlay/onedrive.js` 注入，仅 `dist/Script.js` 包含；默认走「默认代理」，同时提供「直连」选项。规则集覆盖 `onedrive.mrs`（1drv.ms / livefilestore.com / storage.live.com / onedrive.com 等）与 `sharepoint.mrs`（国际版 sharepoint.com / sharepointonline.com）；世纪互联版的 `sharepoint.cn` 等 `.cn` 域名仍由前缀规则 `microsoft_cn` 直连，不受影响）

**条件生成**

- `自建节点/链式落地` （仅添加了自定义节点时生成）
- `链式中转` （仅启用链式代理且配置自定义节点时生成）

## 内置节点组

> - 所有组均为手动选择（select），默认内部包含对应的自动选择策略组
> - 未匹配到地区组的节点将归类至 「其他节点」

- `香港`
- `日本`
- `美国`
- `新加坡`
- `台湾省` （仅全量版）
- `低倍率节点`
- `高倍率节点`
- `其他节点`

倍率识别说明：脚本**按节点名称正则匹配**倍率（并非读取倍率字段），默认将名称含 `2` 以上倍率标记的节点归入高倍率组，将 `0.x`、`0倍`、`免费`、`free`、`低倍`，以及名称含“下载”（不含“客户端/软件”）的节点归入低倍率组。因此需要机场在节点名中带上倍率信息才能生效。

---

## 配置文件

`Config/` 下是与脚本实现效果基本一致的静态配置文件，两者**互斥使用**：

- 配置文件：使用 `proxy-providers` 拉取订阅，不挂脚本，可在 `url` 处填入机场订阅链接（`age-secret-key` 按需填写）
- 覆写脚本：要求节点内联，用于覆写机场下发的配置

### 限制

- 不支持自定义启用/禁用配置项
- 无法根据节点匹配情况动态生成策略组
- 使用私有 DNS 或 hosts 节点域名映射的机场需要手动写入配置中
- 未匹配地区的策略组将回退至 REJECT

## 功能说明

- 仅适用于使用 [mihomo 内核](https://github.com/MetaCubeX/mihomo/tree/Alpha) 的代理客户端
- 全量版和精简版仅有分流策略组数量差异，其他基本一致，若不需要很多分流策略组，可使用精简版
- 内置的DNS配置已解决DNS泄露问题（在 Windows 上需要关闭系统的智能多宿主解析功能或在代理软件中开启 [严格路由](https://wiki.metacubex.one/config/inbound/tun/#strict-route)），DNS配置和路由规则是配套的，建议不要开启代理软件的DNS覆写或随意修改
- 规则采用 `rule-set` 模式，按需添加规则集，告别臃肿的 geodata，减少内存占用
- 规则以 `domain` 与 `ipcidr` 行为为主，相比 `classical` 查询效率更高
- 脚本会覆盖以下内核参数：`mixed-port: 7890`、`allow-lan: true`、`find-process-mode: strict`、`external-controller: 127.0.0.1:9090`（面板为 zashboard）、TUN 使用 `mips` 栈并开启 `strict-route`/`auto-redirect`、NTP 使用阿里云。订阅中对应的字段会被替换
- 脚本保持 ES2020 语法兼容：Bettbox 等客户端内置 QuickJS 引擎，超出该版本语法会导致脚本加载失败（这也是仓库内测试套件包含 ES2020 与 QuickJS 校验的原因）

---

## 构建与测试

### 构建（维护者）

`dist/Script.js` 由 [tools/build.mjs](./tools/build.mjs) 生成：

1. 下载上游精简版 `Script.js`（`AIsouler/MyClash` main 分支）
2. 校验上游关键结构标记（`ruleOptionsEnable`、`baseGroups`、`serviceConfigs`、`function main`），结构变化则中止，不发布错误脚本
3. 在脚本末尾依次追加 [overlay/](./overlay) 下的补丁（`discord.js`、`onedrive.js`）
4. 在 Node `vm` 沙箱中实际执行一次 `main(示例配置)` 做断言：Discord / OneDrive 策略组与规则是否齐全、二者规则是否位于 Google 规则之前、所有 `RULE-SET` 引用是否有对应 provider、策略组名是否重复
5. 全部通过后才覆盖 `dist/Script.js`

`.github/workflows/update-script.yml` 每 6 小时检查一次上游变化，也可手动触发；`overlay/`、`tools/`、workflow 自身有改动时会立即重建。

执行构建：

```bash
node tools/build.mjs
```

### 测试

针对仓库内 `Script/` 快照的自动化测试（仅需 Node.js）：

```bash
node Test/run-tests.js
# 或
npm --prefix Test test
```

可按需只运行某一部分（参数可组合）：

```bash
node Test/run-tests.js --node     # 仅 Node 单元+集成测试
node Test/run-tests.js --es2020   # 仅 ES2020 兼容性检查
node Test/run-tests.js --quickjs  # 仅 QuickJS 引擎验证
```

兼容性验证依赖两个可选包，首次使用前安装（未安装时对应部分自动跳过）：

```bash
npm --prefix Test install
```

- `espree`：以 `ecmaVersion: 2020` 解析脚本，并静态扫描是否使用 ES2021+ 内置 API
- `quickjs-emscripten`：用真实 QuickJS 引擎加载脚本并调用 `main()`

测试详情见 [Test/README.md](./Test/README.md)。

---

## 效果预览

- 客户端： [Bettbox](https://github.com/appshubcc/Bettbox)

|                            |                            |                            |                            |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| ![img](./Image/IMG_1.webp) | ![img](./Image/IMG_2.webp) | ![img](./Image/IMG_3.webp) | ![img](./Image/IMG_4.webp) |
| ![img](./Image/IMG_5.webp) | ![img](./Image/IMG_6.webp) | ![img](./Image/IMG_7.webp) | ![img](./Image/IMG_8.webp) |

## 致谢

本项目基于 [AIsouler/MyClash](https://github.com/AIsouler/MyClash)，感谢原作者及以下项目与所有上游项目

- [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet/blob/main/Mihomo/global_script.js)
- [YiXuanZX/rules](https://github.com/YiXuanZX/rules)
- [appshubcc/bett-rules](https://github.com/appshubcc/bett-rules)
- [217heidai/adblockfilters](https://github.com/217heidai/adblockfilters)
- [Koolson/Qure](https://github.com/Koolson/Qure)

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=miyoungawa/myclash&type=date&legend=top-left)](https://www.star-history.com/?repos=miyoungawa%2Fmyclash&type=date&legend=top-left)
