# Apps V1 候选实现

**GitHub 发布阅读说明（2026-10-07）：** [需求与追踪](requirements/README.md)、[公开验证摘要](apps-publication-validation-20261007.md)和[最新原聊天创作设计](chat-component-authoring-review.md)已收录到仓库。下文 `evidence/`、`artifacts/` 是原开发机的本地归档定位，不随 Git 发布；历史候选验收不表示 A.1 的原生 `@` 与真实创作预览接线已完成。

本轮在原 `dsh-hallmark-app` 项目覆盖更新，以 `cb871b4086508988485dc4a0a5d6aa5440901267` 为基线，按 `01_TODO.md`、`02_SPEC.md`、`03_ARCHITECTURE.md` 与 `traceability.csv` 实施。候选版本为 `1.0.0-candidate.6`，通过官方插件管理器替换原桌面插件。全仓570项测试、类型检查和实际桌面源码显示通过；安装、原会话查询、显示、卸载和最终重装的当前结果见 `evidence/apps-live-bill-20261007/desktop-verification/result.json`。此前独立 Host 的各版本记录见 `evidence/apps-live-bill-20261007/host-session/host-live-index.json`，保留各自版本与执行时间。外部真实模型、Hallmark 调价/库存写入和原业务数据库切换仍未执行。

最终版本矩阵为 bundle/Host `1.0.0-candidate.6`、Runtime `1.0.0-candidate.4`、DB schema 3、HTTP/目录 1、bridge 2.0。第六版修复普通组件生成器的 React 依赖解析；Runtime 与 Client 字节均与第五版一致，旧包和失败记录保留。

## 运行与边界

`app-runtime` 管理目录、连接、会话绑定、调用、操作和脚本记录；`app-hallmark` 与 `app-notes` 提供异构能力，`app-presentation` 管理共享展示、查询绑定和版本资产。只有 `service/apps-main.ts` 组合具体 Provider。工具、SDK、组件通过同一个 Runtime 调用，不重复实现业务算法。Notes 的独立数据源位于每连接命名空间，Hallmark 的业务事实仍由原应用保管。

旧 Hallmark 服务与 schema-2 `app.db` 继续使用。桌面新版连接独立 Runtime `127.0.0.1:36994`，数据目录为 `artifacts/apps-live-bill-runtime`；Hallmark 连接读取原 Bill 数据源的既有商品快照，源时间为 `2026-10-06T16:01:20.856Z`，Notes 使用独立命名空间。显式刷新更新读取成功时间，并不表示平台实时同步或改价/库存写入。Runtime 只打开 schema-3 `apps.db`，使用进程租约拒绝第二个写入者。按用户最新要求，第二轮验收后保留新版桌面插件；第一轮恢复 Hallmark 0.3.0 和七个配置文件的记录只作为历史回退证据。桌面验收见 `desktop-verification/result.json`，历史恢复见 `lifecycle-restored.json`；独立 Web Host 的 Chrome 阻断不能代替桌面结论。原 Hallmark 后台服务保持运行，原业务数据库未迁移；离线迁移和回退命令见迁移运行手册。

## 开发命令

在仓库根目录使用 Node ≥22.18；第六版全仓测试实际使用 Node 24.12.0，先前第五版的 Node 24.19.0 日志保留原时间。以下入口均已落盘，测试命令不依赖真实业务服务。

```powershell
node scripts/generate-apps-sdk.mjs
node scripts/build-plugin.mjs
node scripts/build-apps-bundle.mjs
node node_modules/typescript/bin/tsc --noEmit
node --test test/**/*.test.ts
node scripts/smoke-apps-bundle.mjs
node scripts/apps-benchmark.mjs
```

干净 clone 先安装根目录依赖。版本测试读取本机构建的 bundle 文件，因此必须先完成构建再执行全仓测试；这些文件由命令生成，无须纳入 Git。

启动独立 Runtime 必须明确数据目录与连接配置，不从焦点、最近会话或固定业务端口推断连接。例如新建一个 Notes 夹具配置：

```json
{"connections":[{"appId":"notes","connectionId":"local-test","displayName":"Isolated Notes","config":{"backend":"runtime"},"configRevision":1,"enabled":true}]}
```

```powershell
$env:APPS_DATA_DIR='E:\test-data\apps-candidate'
$env:APPS_CONNECTIONS_FILE='E:\test-data\apps-connections.json'
$env:APPS_PORT='4181'
node packages/service/src/apps-main.ts
```

这些是显式配置示例，目录不代表本机已安装位置。真实 Hallmark 连接需添加自己的已核实 `baseUrl`；兼容默认连接必须显式填写 `legacyHallmarkConnectionId`。凭据通过现有环境配置传入，不写进连接 JSON、日志或 bundle。共享令牌只在 Host/服务间使用，Client 通过宿主认证通道转发。

## 插件、SDK 与源码组件

组合 bundle 保留一个 Apps 入口与三个逻辑投影（Apps、Hallmark、Notes）。默认原生目录只有四个固定网关 `apps_list`、`apps_describe`、`apps_invoke`、`apps_inspect`；未核实本机动态 Schema 时不宣称模型工作集动态注册。显式打开 `legacyToolProjection` 可同时注册 26 个旧工具；HTTP 兼容入口、旧 alias 和 bridge v1 转换始终保留。三个 SDK 的 JavaScript、类型声明和普通 React 源码 starter 随候选包分发；源代码/dist/预览及业务缓存由本机 Runtime 管理。

此前独立 Host 升级发现，官方 manager 在同一模块路径热更新后仍可能使用旧回调；磁盘包 hash 相同不表示内存代码已更新。本轮官方桌面已正常退出并重开，核对实际四工具、三个投影和会话摘要。官方管理器卸载磁盘包后，原桌面进程在31秒检查时仍保留注册；正常退出并重开后，四工具、摘要与候选 Client 插槽均为零，同源码资源路由由200变为404。更新和卸载须重开桌面后核对，不能把 CLI 成功返回当作运行状态。原 Hallmark 后台服务与业务 Runtime 未重启，失败及重开前后的记录均保留。

实际桌面还发现普通源码工程通过 `file:` 链接 SDK 时可能打入两份 React，首次 `useApps` 渲染报 `useRef` dispatcher 为 null。第六版生成器显式将 React/ReactDOM 及子路径解析到组件项目的同一依赖。回归测试复现旧错误并验证修复；旧不可变 build 保留，新 build 在原生侧栏与 Apps 工作台正常显示。SDK 仍使用外部 React peer，不把框架重复打入 SDK。

bridge v2 验证 session/view/build/frame/nonce 与方法列表；商品类型在公共协议中替换为 `ResourceRef`。本地排序、筛选和选择不提交模型请求。能力调用必须由显式动作触发；保存组件是另一个显式动作，构建不会自动保存。只读刷新失败保留最近成功快照并标 stale，更新组件使用修订 CAS 并保留不可变历史。

旧 26 个工具逐项经隔离 HTTP、Runtime 和具体 Provider 回放，另验证结果集过期、模板与历史版本、原入口身份及绑定字段保留。兼容入口保留原来源、时间、店铺和参考利润说明；未知回执只读取同一操作的领域证据。缺少原写入幂等键或保存原话会在分发前停止，旧入口不会为其自动生成业务意图。

独立 Host 的实际 Inspect 已核实工具、systemPrompt、sessionController 与 sessions 的签名。默认 `nativeSessionAdapter: 'disabled'`；显式选择已核实的 `dsh-0.2.0-rc.2` 且服务可用时才公布 `updateContext` 与 `requestAgent`。组件更新以 CAS 保存不可变快照，不唤醒模型；显式请求携带原请求 ID 和固定快照，经原生队列落盘与事件核对后返回 accepted（已排队）。正式模型消费、历史前缀重放与重启核对在独立 Host candidate.5 完成；candidate.6 未重跑模型路径，原证据保留原版本与执行时间。未支持的 Host 仍明确降级；fixture 的 attachment collector 只证明 ResourceRef 与 attached 状态。

底层 API 目录含 15 项查询和一项既有调价适配 `hallmark.api.products.update_price`。它复用原 `WriteOperations` 的任务平台与严格 CNY fallback、同一 operationId 和只读核实逻辑，不新增业务算法。登记前零派发、登记后单次写入、幂等冲突和 unknown 不重放已用 SDK/HTTP 夹具验证；真实 bill 写入仍需明确商品与目标价格或库存参数。

## 可靠性与恢复

每个 invocation 标识一次尝试；同一业务意图由 `(appId, connectionId, capabilityId, idempotencyKey)` 唯一定位 operation。变更在 dispatch barrier 前持久化，并核对版本、规范输入和预期修订的 hash。丢失响应、取消或不可用发生在 dispatch 后时保持 unknown，仅只读 inspect；进程在 dispatch 前退出的 queued 意图会取消且不自动重放。脚本恢复复用已完成步骤，并把 inspect 后的结果写回 step，跨应用失败报告 partial，不伪造事务回滚。

SDK 变更传输失败会读取原 invocation 并返回已有 operation；服务完全不可达且没有取得 operationId 时返回 unavailable/inspect_only，附原 invocationId 和禁止重提交提示，不能编造 operationId。恢复后先读取该 invocation，再 inspect 已有操作。

Apps 模型内容最多 16384 UTF-8 字节；完整值保存在 Runtime 数据句柄并分页读取。基准记录是隔离夹具各30次样本、Schema与结果字节数，未把字节数冒充 tokenizer token 或真实平台性能。独立 DSH 的消费验证使用官方 LLM 适配接口注册的本地确定性模型；实际宿主请求与外部模型调用分别记录。

## 回退

用户要求在原项目和原桌面覆盖更新，最终保留第六版；原 Hallmark 0.3.0 包与配置备份仍保留。需要恢复时须通过官方管理器核对插件字节、配置、原会话与注册清理，磁盘卸载不能代替运行中注册核对。业务数据库尚未切换；之后的数据回退须依据增量报告处理本地资产及 unknown/pending，只读核实后再选择分支，不能覆盖新资产或把入口回退当作撤销外部业务。诊断面板提供 invocationId/traceId/operationId/runId；GC 默认为 dry-run。
