# C1/C2 独立验收

本目录只包含验收设施，不修改生产代码，也不连接 DSH 正式会话、模型或真实店铺。Runtime 只注册离线只读 `displayreplay.records.list` 和 Presentation Provider；Web 入口拒绝刷新、能力写入和业务提交。业务字段来自 `test/real-data/corpus.ts` 的不可变记录，入口校验原始 SHA-256，不以合成商品替代。

## 运行（仓库根目录，依次执行）

```text
node --test --test-concurrency=1 test/acceptance/component-display/read-scale.test.ts
node test/acceptance/component-display/run-performance.mjs
node test/acceptance/component-display/run-browser.mjs
node test/acceptance/component-display/run-recovery.mjs
node test/acceptance/component-display/run-recovery.mjs --package 1.0.0-candidate.76
npx tsc --noEmit
```

- 普通 `npm test` **保留 C1 的全部确定性断言**：49 MB 负载、索引计划、解析次数/字节不随无关记录增长、零重复完整证据验证、未变化文件零重读、有界且每次执行的文件身份检查、零 Provider 重算、JSON 解析工作量上限。默认运行不以耗时判定，通过唯一文件名 `c1-workload-<pid>-<time>.json` 保存诊断，不覆盖独立性能证据。
- `run-performance.mjs` 显式开启 **所有**耗时预算，使用独占锁避免两个 C1 验收互相覆盖，并核验 JSON 为 PASS、预算确已执行和样本数完整。锁不检测其他测试进程：仍需人为安排在全量测试、浏览器和构建任务全部结束之后串行运行。不得为了通过验收调大预算。
- 浏览器入口复用项目已有“安装的 Chrome/Edge + 新临时 profile + CDP”模式，不下载浏览器、不使用日常登录资料。浏览器和 HTTP 服务均在 finally 中关闭；临时目录只在验证位于系统 temp 且前缀正确后移除。JSON 的 cleanup 字段保留清理结果。

## C1：规模、预算与解释

- 41 个原始完整采集记录按顺序重复，放入不同的 provider-record 外层身份。扩展的是行数和 wrapper id/namespace/connection；原始 detail、raw、provenance 等业务字段不变。约 **49,057,755 字节、890 行**是 `provider_records.value_json` 的 UTF-8 字节总数，不是 SQLite 文件大小，也不是 890 个不同商品。实际数量、源语料哈希写入报告。
- 归档含 41 个完整原始记录文件，C1 当前共约 2.27 MB/45 个工程文件；使用真实 Build 进程与归档 SHA 验证，不以“49 MB 证据集”误称它。被显示的 snapshot 有 41 件原商品，detail 序列化约 1.19 MB。`projectFiles` 与归档总字节数独立记录。
- 发布的 Preview 通过现有 backend fixture 机制注入**明确标注的协议控制收据**，其中截图占位字节不是截图，performance fixture 不是浏览器性能证据。它只使候选进入可测协议状态，不用于宣称正式预览或视觉验收通过。C2 的 displayed 证据独立来自浏览器 DOM 与 SDK。
- 冷读分两组，每组 n=3：
  - 新子进程：包括 Node/模块载入、SQLite/Runtime/Presentation/Authoring/Source 初始化到首次已准备 snapshot。父进程测 process wall；子进程另测初始化至首读、事件循环延迟与完整验证次数。
  - 新服务缓存：同一打开的 SQLite 上，新建 Presentation/Authoring/Source 缓存，经 openDisplay、frame grant 到首读。
  - 两者都不清空 OS 文件缓存，不包括建库填充/构建/语料校验；子进程不启动生产 scheduler、HTTP 与 Provider。它们不是物理磁盘冷启动，也不是完整生产 bootstrap/重启验收。
- 热读 n=64，16 组、每组并发 4，在真实 HTTP extension/grant/host 路径重复读 transfer 的前 4 块。C2 另验证 SDK 对**完整 payload**的并发分块恢复和哈希校验，而非把前四块当作整份数据。
- 预算为冷读最大 **10,000 ms**、分块 p95 **500 ms**、事件循环最大 **1,500 ms**。10 秒给本地防病毒/文件系统启动留空间；500 ms 远高于毫秒级无 Provider 重算的常见本地读取；1.5 秒意在捕获明显请求线程阻塞，而非承诺流畅帧率。预算是宽容的回归报警线，**不是服务 SLA**。
- p95 为 nearest-rank；n=3 的“p95”等于最大值，只用于说明样本，不具有统计 SLA 意义。事件循环用 `monitorEventLoopDelay`（10 ms 分辨率），覆盖三次服务缓存冷读和 64 次 HTTP 热读；进程冷读另报自己的窗口。报告包含 CPU/内存/OS/Node、原始样本、样本数及窗口。

## C2：真实 iframe 与 W6 父 gate

原五个场景使用生产 AppsSourceFrame/handlers → AppsHost/HttpAppsHostTransport → Runtime/Presentation → 归档 iframe `useApps`。只有 iframe 在 React DOM 提交后，校验 41 个原始 id/title 全量一致，SDK 才自动发送 renderReady；脚本不直接调用 confirmDisplayReady，也不由 iframe onLoad 伪造 ready。

| 场景 | 必须成立 |
| --- | --- |
| response-lost | Runtime 已返回 200 的首块响应丢失；重试同一 requestId 一次；完整数据渲染后当前 build ready |
| transient-503 | 块 0 连续三次 503，越过 Host 单次重试后由 SDK 初读重试恢复；并发峰值至少 4 |
| sqlite-busy | Store 查询边界注入 SQLite-coded 异常，经真实 Runtime 分类成 503/read_retry，保留 cause，最终真实 ready；**不是实际 SQLite 锁竞争** |
| terminal-never | 首次 prepare 确定性拒绝，只执行一次；不发 renderReady；Runtime display_failed 中保留 code/requestId/cause/attempts |
| hidden-then-visible | 生产桥接隐藏时不开始 SDK 数据读，可见后实际读数并 ready |

另在同一视图发布新 build：旧 build 的 ready 不能使新发布 displayed，`isCurrentBuild`/`isCurrentPublication` 必须为 false。

新增五个 W6 场景挂载**生产 `AppsNativeView`**，不把上述无父 gate 的五例冒充 W6 验收：

| 场景 | 必须成立 |
| --- | --- |
| native-preparing-ready | 父层显示“数据准备中”；初读与至少一次 preparing 轮询期间没有 iframe/归档请求；真实 snapshot ready 后才加载归档 SDK、并发读全量数据并真实 ready |
| native-preparing-failed | 准备失败上报 Runtime，phase=data，保留 never 和 INVALID_BINDING；没有 iframe 或 ready |
| native-hidden-late-ready | 准备轮询已在途时隐藏；释放旧 ready 响应不产生 ready，隐藏期间停止 HTTP 轮询；重新可见才真实 ready |
| native-session-switch-late-ready | 准备轮询在途时切换 session/abort owner；释放旧 ready 不挂 iframe，不产生 ready；旧 display 仍未完成 |
| native-expired-budget | 纯协议时钟控制把 opening display 的 openedAt 放到 181 秒前；父层立即报告 data/DISPLAY_READY_TIMEOUT，不重启新的 180 秒准备预算 |

W6 preparing/failed 和过期时钟是明确注入的**协议控制条件**。`ready` 返回的业务 payload 是原始 Runtime viewData，后续授权、SDK、数据块、DOM、当前 build/display ready 回执全部真实。此测试证明父 gate，不证明一个真实业务 worker 已长时间运行；不猜造 W6/W7 新接口。

## 输出与失败历史

输出目录：`artifacts/component-display-reliability/`。

- `c1-final-20261015-19732.json`：停止前、安全修复前的历史计时证据，使用 wx 冻结；SHA-256 为 `7e8c9491596fea683454d2c2fd4e8d2d4aa73ca3e74bb168d7fa0fc37da49e98`。不能替代接续后的最终计时。
- `c1-read-scale.json`：仅独立计时入口更新；`budgetsEnforced=true` 才代表计时预算验收。
- `c1-workload-*.json`：普通测试的确定性工作量验收；耗时仅为诊断。
- `c2-browser-faults.json` 和 `c2-*.png`：10 例的请求轨迹、Runtime summary/display、浏览器 DOM 和实际截图。
- `existing-targeted.json/.tap`：首次指定基线 52/53，失败为原 `display-verification` 的 payload-is-chunked 断言；W6 后来修复旧预热遮蔽新 snapshot 的生产竞态，未削弱该测试。
- `existing-targeted-retest.json/.tap`：上述修复后的独立复测；原 53 例保持不变。
- `w6-targeted.json/.tap`：已有 data-preparation 与 preparation-deadline 测试的定向复测。
- `c2-native-first-attempt.json`：新增父 gate 首轮 9/10；验收脚本错误等待“已过期”场景的瞬时 preparing 文本而超时。改成等待**立即失败**后 10/10 通过；没有改变终局、无 iframe、phase=data 和旧 ready 断言。
- `typecheck.json`：本地 TypeScript 全仓检查，零退出才为 PASS。

### 真实默认重启及新包验收

`run-recovery.mjs` 使用实际 `composeAppsRuntime`、默认健康监测和默认重启退避，结束仅属于自己的 Runtime 进程。故障注入在首次 SDK prepare、尚无 transfer registry 时；要求同 publication/build 用新 display/frame 自动重新读数、真实 DOM 提交后 SDK ready，`manualActions=0`，原 build/preview/publication IDs 不变。启动、健康、归档完整性诊断和资源清理均记录在 JSON。

`--package <精确版本>` 先核对 tgz、全部构建源码输入和关键产物 SHA，再在工作区旁的专属随机隔离目录解包，保留提取器对祖先node_modules的检查。执行包内未改写的 Runtime composition、真实 `client/client.js` 注册的父侧栏以及包内 SDK。固定会话/侧栏服务面、HTTP 适配、Host 运输及健康/重启监测辅助仍来自测试与源码，报告的 `packageBoundary` 明确列出；这不是正式 DSH 桌面验收。输出独立 `c2-packed-runtime-recovery.json/.png/-child.log`，不覆盖源码模式；包隔离目录清理另校验专属根和随机前缀。

仍未覆盖：实际店铺/DSH 桌面环境展示、实际 SQLite 锁竞争、长时间真实业务准备任务完整运行画像、已存在 transfer registry 的进程中断恢复。最终通过状态与限制见仓库 [接续验收报告](../../../docs/组件稳定展示-接续验收报告-20261015.md)。

## 分类交接

`read-scale.test.ts`、`run-browser.mjs` 和 `run-recovery.mjs` 已登记 requiredFiles，以真实语料派生规模及协议故障执行；`fixture.ts` 是其共享真实语料依赖。各 browser parent、`cold-start.mjs`、`run-performance.mjs` 是传输/进程验收支撑。`chunk-progress-deadline.test.ts` 单独归为协议控制字节流基础设施，不能将使用真实商品的 C1/C2 归为纯基础设施。
