# candidate72：#12 / #13 / #14 实际生产路径复验

## 结论与版本

本报告仅使用 candidate72 实际重跑的功能和时延数据，不复制 candidate70 的速度、构建或全仓回归结果。

- 指定 annotated tag：`v1.0.0-candidate.72`
- tag object：`52d12f7ee593fe04944c63b5d01fb0e924a6eee5`
- commit：`4e1cd98082a432e2ca89f606927da29eb26ddb67`
- tree：`fc82c44d9aae05812173b03e2f107b9b51612c96`
- 版本判定使用该 tag/commit/tree 和实际 Runtime/打包元数据。README 页首的旧版本、根服务包的 `0.3.0` 不替代这个身份。
- 比较对象是纯 candidate72 与其隔离三补丁树；没有把工具链主线的其他更改混入收益。

| 问题 / 正式负载 | baseline 中位数 ms | candidate 中位数 ms | 周期耗时下降 | ABBA改善轮数 |
|---|---:|---:|---:|---:|
| #12 实际经营 React，10行×20属性，8动作周期 | 4.797544 | 3.702844 | 22.8179% | 5/5 |
| #13 实际 collection Runtime，medium 请求 | 79.0377685 | 54.2367965 | 31.3786% | 5/5 |
| #14 实际 DataTransfers＋reader，333KB三读周期 | 52.7953715 | 8.227079 | 84.4170% | 5/5 |

这是三个不同范围的计时，不能相加，也不能称为整应用、浏览器端到端或真实店铺网络的改善。每项另保留小输入或不经过补丁的控制。当前材料不批准部署或真实业务写。

## 正式性、排他和排除记录

Node `24.19.0`、Linux云端，冻结仓库依赖；实际生产模块配合离线fixture。

- 每项2种负载×5轮×ABBA四个独立进程，即40进程；三项正式数据合计120进程。
- #12、#13 的正式重跑对整个命令组持有 `/tmp/hallmark-c72-cpu.lock` 排他锁，不仅锁单个样本。
- #14 发生在统一flock约定前的人工独占窗口；全部worker的时窗确认没有重叠，故接受为正式。这里不倒称其当时持有flock。
- #12 首批40进程曾与短工具链fixture重叠。整批被排除，并从零重跑；其原始数据和summary以 `diagnostic-overlapped-*` 单独保存，绝不引用为正式收益。
- 之后可移植脚本的所有构建、功能、回归和计时均通过一个整段flock入口。工具链主线优先，未授权新窗口时不启动。

## #12：完整字段惰性初始化

生产修改：`business-operations.tsx` 中将 `useState(JSON.stringify(payload, null, 2))` 改为惰性函数。原有payload变更effect、稳定row key、输入/保存/提交逻辑不变。

72上实际 `BusinessOperations`＋production React/test-renderer 完成10行×20属性的43帧。完整host tree和稳定业务POST序列相同；pretty JSON调用 `1003→204`，处理UTF-16字符 `5263534→1046797`。这些是调用量，不是时延或内存替代指标。覆盖未应用文本、同key payload替换、错误JSON、保存、筛选、批量售价、未知提交结果恢复和会话切换。

正式每进程18个8动作周期，丢弃前3轮，测量实际事件处理和生产组件渲染；每进程核对源码/bundle身份、初末host tree hash和业务请求序列。完整原始样本含mount、8动作时长、CPU和RSS。

负面与边界：

- 10行×0属性小控制 `3.8906375→3.62317ms`，中位数下降6.8746%，但仅3/5轮改善；两轮分别慢2.9093%和0.3318%。
- 小控制p95 `7.168622→7.322003ms`，冷挂载中位数 `35.4422715→35.883928ms`；不能宣称小输入或挂载普遍更快。
- 本次72请求记录剔除了外层requestId，仅记录稳定业务POST；没有全GET/options或原始HTTP轨迹。没有把70的独立fulltrace当作72已重做。
- 这不是DOM布局、绘制、浏览器输入延迟或UI实际验收。

## #13：采集刊登状态的请求内索引

生产修改位于 `app-hallmark/src/listing-prepare.ts`。对本次请求已经读到的刊登关联和草稿建立索引，减少商品×店铺反复扫描；保留读点、输出顺序和异常语义，不引入跨请求cache。

72上实际 `AppsRuntime`、`HallmarkProvider`、store和SQLite完整功能结果：12个响应、42个事件、12389条SQL trace、投影和完整DB内容均逐字节相同。插桩及非插桩完整结果相同。六类array callback总数 `27453583→1628653`，但map单独从 `705942→716974` 增加；不把调用下降当作总操作下降或直接收益。

medium：367采集商品；每店600 offers、2店；60个plan、每plan15行。tiny：8商品、8 offers、1店、2 plan、每plan4行。正式测量每进程warmup5次后15次实际Runtime collection请求，计入生产读/转换/投影流程，不计建库fixture准备。每次响应data digest以及两侧功能流程一致。

功能包含筛选/游标、重复offer和summary的首次/末次语义、组合来源、保存后新请求可见、空/异常数据、刷新失败及另一个SQLite连接在请求中的可观察提交。

负面与边界：

- tiny wall `2.355767→2.2781755ms`，下降3.2937%；一轮wall慢4.2184%。
- tiny CPU `2.707→2.840ms`，增加4.9132%；不宣称小输入全面收益。
- medium CPU `87.9735→65.059ms`，详见summary全部轮次；CPU和wall口径分开。
- 数据由真实Runtime处理，但不代表真实账户商品分布或网络端到端时延。

## #14：分块base64之后的字节复制

生产修改：`component-runtime/src/data-transfer-client.ts` 将 `Uint8Array.from(atob(chunk), mapper)` 改为预分配数组的直接逐字节复制。仍然复制每个字节；没有去除SHA、id/index/revision、容量、UTF-8、JSON和cache隔离检查。

72上真实 `DataTransfers.prepare/read`＋生产reader重新完成输出、协议、digest/clone、错误及重叠revision功能检查。333146/2100146字节chunked首读的mapper次数降到0；这仅为路径证据，2.1MB在本轮只做功能/计数，不引用其70时延。

正式每进程18个三读周期，丢弃3轮：无缓存首读、正文不变但metadata更新、正文变更刷新。fixture生成、deepEqual和hash核对在测量段外；真正prepare/read、base64、校验、解码和返回隔离在段内。完整结果与fixture deepEqual，实际结果原始JSON字节hash严格比较；协议仅规范化随机transfer UUID，不排序产物字段。

333KB段中位数：首读 `25.1553015→3.074534ms`，不变刷新 `1.423399→1.374614ms`，内容变更 `25.5029615→3.160279ms`。每周期3次prepare、12次chunk read，两侧相同。unchanged不经过修改的字节复制，不把其差异计为本补丁收益。

负面与边界：

- inline210KB完整快照210333字节，周期 `5.1973105→5.090820ms`；该路径不执行修改，一轮慢3.3830%，所有差异均作为混合噪声，不计收益。
- inline严格条件是body bytes＋header bytes `<220000`；块65536字节、4块并发批次；总上限32MiB/512块、单base64字符串最多90000字符。
- 所有块合并后才SHA校验、fatal UTF-8和JSON解析。不是流式UI或逐块UTF-8解码。
- reader没有AbortSignal API；外层取消/权限规则未修改。本轮72计数harness不构成所有外层生命周期重验，统一回归与真实浏览器验收另列。
- 两次正文传输占三读周期的大部分；不能外推为主要unchanged轮询的会话总体收益。

## 可交付材料与复验

- [`candidate72-revalidation/summary.json`](candidate72-revalidation/summary.json)：完整分组中位数、p95/CPU/RSS、每轮结果和功能摘要。
- [`candidate72-revalidation/source-manifest.json`](candidate72-revalidation/source-manifest.json)：基线/补丁源码、原计时脚本、可移植脚本、压缩及解压原始数据SHA256。
- 三个 `timing-*.json.gz`：正式全部120进程原始样本。collection归档还保留原文件名。
- `diagnostic-overlapped-frontend.json.gz` / `diagnostic-overlapped-summary.json`：不纳入正式结论的首批40进程；保留而不择优取数。
- [`scripts/performance/candidate72-revalidation`](../../scripts/performance/candidate72-revalidation/README.md)：实际生产fixture、可移植构建、计数、ABBA与整段flock入口。无云端绝对路径前提。
- 永久回归位于 `test/plugin-apps/business-content-lazy.test.ts`、`test/app-hallmark/listing-state-index.test.ts`、`test/performance/data-transfer-byte-copy.test.ts`，合计8项；生产和回归补丁由统一集成单独管理，本文材料patch不重复夹带。

可移植入口只做路径适配及身份/数据gate，原功能/计时harness保持原样。归档速度来自上文已完成的原72正式运行；路径适配脚本的smoke不会被冒充为重新收集的正式速度。

## 当前验收状态

- 72的三条实际功能路径与正式120进程：已完成，详见归档。
- 可移植脚本短smoke：**已通过**（2026-10-10 17:28:42Z 起，整段共享锁；43 前端帧、collection tiny 完整输出与 transfer 功能校验；不作为正式计时）。
- 统一工具链集成树（工具链更改＋三项性能补丁＋#7兼容修复）的SDK/typecheck/Apps/plugin build、全仓suite、独立包smoke：**构建/typecheck/smoke通过；全仓1666项1645pass、4fail、1cancel、16skip，与纯72失败/取消完全相同、无新增失败**，详见 [组合门禁](candidate72-integration-gate.zh-CN.md)。不沿用70的任何通过数、失败数或产物hash。
- 旧#7R2与撤回cache的兼容性审查另行处理；本材料的结果不等于旧问题已消失。
- 浏览器/桌面UI验收：**NOT_RUN**。云端Chromium socket限制未绕过，未部署、未安装、未执行真实店铺写。
