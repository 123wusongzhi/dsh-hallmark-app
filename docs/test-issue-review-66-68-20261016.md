# 测试 issue #66–68 独立复现与最小修复

基线 e12e49f5281358d886ec5a76a2e12e514f0cec6d；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0。仅使用本地锁定依赖、回环服务和公开脱敏冻结数据，无重新安装、真实商家写入、桌面操作或永久生产修改。

实际 GitHub created_at：#66 2026-10-15T21:51:55Z；#67 2026-10-15T22:11:54Z；#68 2026-10-15T22:44:31Z，均晚于本任务起点。每项读取全文与现有评论，独立构造故障，不导入对方候选提交或执行其外部脚本。

## #66：把父侧进度断言移出预期拒绝范围

原 malformed chunk case 在 async transport callback 内断言父侧 chunkProgressKey 为空，但外层裸 assert.rejects 将该断言失败当作预期成功；SDK progress 仍为零，不能替代父窗口 deadline 校验。

最小修复只保存真实 bad reply 后返回，独立匹配 SDK 的拒绝原因，再于 rejects 范围之外断言父侧 key 为空和 SDK 零进度。保留六个 case、五种缺陷、慢传输、重复块、idle、180 秒绝对上限、AppsClient 和 dispose 保护。协议错误用显式 INVALID_DATA_TRANSFER，base64 用 InvalidCharacterError 名称，不绑定引擎详细消息、stack 或跨 realm 类身份。不新增生产输入限制。

两个 Node 版本均在同一固定五文件、26 项完整组执行：

| 输入 | 实际结果 |
| --- | --- |
| 旧测试 + 原生产 | 26/26 |
| 删除 chunk.id !== request.id 父侧校验 + 旧测试 | 26/26，漏检 |
| 同故障 + 透明 observer + 旧测试 | 26/26，observer 记录原 callback ERR_ASSERTION 后重抛 |
| 同故障 + 新测试 | 25 通过 / 1 精准失败，命中父侧 key 断言 |
| 原生产恢复 + 新测试 | 26/26 |

无 observer 的旧测试本身已经假绿，结论不依赖诊断插桩。另以 Node MockTimers、真实 React/useComponentBridge、ComponentHost、DataTransferReader 做离线 frame probe：两版原 idle 到期均为 30000ms，故障为 59000ms，恢复为 30000ms；SDK 均报 INVALID_DATA_TRANSFER 且零 progress。说明 SDK 拒绝不会撤销父窗口先记入的错误进度；不是无限阻塞，180 秒上限仍保留。此探针的 window transport 与时钟受控，不是浏览器/线上验收。

第一次 observer --import 使用 Windows E: 绝对路径导致 ERR_UNSUPPORTED_ESM_URL_SCHEME，已保存为 attempt1-windows-import。它是证据 runner 的加载错误，不计语义验证。改用 pathToFileURL 后完整双版本对照通过，源码均 finally 恢复。

## #67：验证独立的活动价格上限

promotions 的 maxActionPrice 是公开的“活动价格上限”，与当前 actionPrice 分开，真实默认组合 reader 会暴露它。原 case 已有 12/13 CNY 非对称输入，因此只加 literal 13 的独立断言，原 fixture、case、币种、路由、参加状态、分页和警告断言不变。

临时只将 maxActionPrice:max.amount 改成 maxActionPrice:price.amount。固定八文件、108 项，均完整执行、不作名称过滤：

| 阶段 | Node 24 | Node 22 |
| --- | --- | --- |
| 旧测试 + 原生产 | 108/108 | 108/108 |
| 旧测试 + 故障 | 108/108，漏检 | 108/108，漏检 |
| 新测试 + 同故障 | 107 通过 / 1 失败 | 首轮 105 通过 / 3 失败；确认轮 107 通过 / 1 失败 |
| 新测试 + 恢复原生产 | 108/108 | 108/108；确认轮恢复仍 108/108 |

目标失败均为原 promotions case 的 ERR_ASSERTION，actual 12、expected 13。Node 22 首轮另有 normal-empty-orders 的 APP_NOT_FOUND 和 runtime wiring storesList=[]；当时其他两个任务均未变异或测试。恢复后、两份旧测试独立观察各 23/23、2/2，以及同故障确认轮都未再现，原因未确定，不能声称已修复。这些失败原日志与输入 SHA 完整保留，不改无关断言或生产代码。

独立小探针调用真实默认 readOzonComposition，不注入自定义 reader，仅在 storeDataRead 边界提供四路离线只读响应。两个版本均观察到 maxActionPrice 13→12→13，actionPrice=12、CNY、上限字段 label/currencyPath 不变。证明真实组合输出会被误接，不推断任何真实商家已受影响。

## #68：让真实 Host 握手失败进入原清理范围

真实 HTTP 已监听后，host.start/attachApp 在 try 之外会跳过 finally。只将这两个语句移入既有 try，原 23 个 assert、两个 case、错误和清理顺序保持；没有新增 sleep、timeout、catch、unref、强制退出或生产协议修改。

双 Node 各独立执行六种对照，故障仅修改真实 Runtime.identity 的 transportMajor 1→2，实际走 GET /v1/runtime 和 AppsHost.handshake 并报原始 INCOMPATIBLE_PROTOCOL：

| 输入 | 真实状态与结束方式 |
| --- | --- |
| 旧测试 + 原生产 | HTTP/Store 关闭，Host/Runtime dispose 各 1，自然结束 |
| 旧测试 + 协议故障 | HTTP listening、Store open、dispose 各 0；先记录泄漏，后由 observer 显式诊断清理 |
| 新测试 + 同一故障 | 禁止 observer 清理；HTTP/Store 关闭、dispose 各 1，自然 exit 1 |
| 新测试删除 HTTP close + 同一故障 | 精准检出 HTTP 仍 listening，Store 已关闭、dispose 各 1；先记录后诊断善后 |
| 新测试 + 恢复原生产 | 清理完整，自然通过 |
| 新测试 + 同故障、完全无 preload/测试 timeout/外层 timeout | 自然 exit 1、零取消；Node 24 为 .290s，Node 22 为 .370s |

这些 exit 1 都是原握手失败，不是新测试变绿；改进是失败时仍清理并结束。旧漏资源运行依赖明确诊断善后，不能称其自身清理或自然退出。无 preload 对照不采包装资源状态，状态证据来自另一个独立 observer 运行。

初次 preload 使用 Windows E: 路径产生加载错误，已保留并改用 file URL；该尝试不计六种有效对照。没有注入 attachApp 失败，未覆盖更早构造/listen 失败、cleanup 自身抛错或永不结束的 provider，不扩展为通用清理框架。

## 合并、检查与边界

#68 恢复后固定 13 文件双版本各 40/40，无跳过或取消。三个问题的定向组均为固定文件全量执行；不是全仓或浏览器验收。

主工作区合入三份最小测试补丁后，26 个相关文件在两版本各 176/176，零失败/跳过/取消；其中含用户已有的额外测试。主工作区和隔离树 TypeScript、真实数据审计均通过。

集成前保护主工作区 107 个既有未提交/未跟踪文件。两个干净目标仅应用测试补丁；已有用户改动的 ozon-data.test.ts 只插入一个断言，去除此插入后的 Buffer 与进入时完全一致，其余已有文件 SHA 不变。不覆盖主工作区生产 WIP，不将其导入本提交。

本次不重跑全仓 npm test。前序 #60–62 的实际全仓结果为 Node 22 两失败、Node 24 一失败：association capability 状态与 packaged parity 字符串 productId 转 NaN。该结果在 #63–65 的测试修改前取得，不能据定向通过称最终全仓全绿。详见 [前序报告](test-issue-review-60-62-20261016.md)。

## 字节恢复与本地证据

- #66 visible-deadline.ts 恢复 SHA-256：4b818fa9628c8e25252108bfadac76b036d9655c0aec9e1b4b0aa6d65ab64f22。
- #66 候选测试 SHA-256：2231c7880cec6b6cadca2a1e8e3cfe5c171e06b2043d8e7d46abb78f0ec428ac。
- #67 ozon-data.ts 恢复 SHA-256：2eaaa81e31608424f10826db22b910626dc22e149fa174d9904c0949b3183d7d。
- #67 候选测试 SHA-256：32b5d36f5b94d30a7bbaeed122951ce07c955c910a610b3c51b4e0eb85fc765e。
- #68 Runtime index.ts 恢复 SHA-256：423e75983680c8a11b6aca5e95871184996523e5fc6ac77c69e438cd8ceb3a72。
- #68 候选测试 SHA-256：9c2c1711caeae4631c094b638833324c7c8abf1e020f53267900a81d5d3657af。
- 所有生产故障均以进入时的原 Buffer 在 finally 恢复，不修改冻结 corpus。

逐项 runner、原始 TAP、进度/组合探针、实际资源状态、输入 SHA、恢复与合并记录位于本地 artifacts/issue-review-automation20-20261015T2253/ 下各 issue66/67/68 目录。提交只包含三个测试文件与本报告。

