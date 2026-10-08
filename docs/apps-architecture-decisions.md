# Apps V1 架构决策与 P0 开发边界

2026-10-08，用户将本轮目标调整为完成可用的应用框架，TODO 与原审计表作为参考。优先完成原 DSH 会话中的应用引用、组件创建和编辑、实际展示、搜索选择和附加到输入框，以及前端外观与交互性能；其他实现保持克制，不擅自新增安全审计或防御性校验。下文保留历史架构与验证事实，严格逐卡验收及原发布门禁不作为本轮交付前置。

2026-10-07，以 `cb871b4086508988485dc4a0a5d6aa5440901267` / Hallmark 0.3.0 为代码基线。需求优先顺序保持 SPEC 编号规则 > TODO 顺序 > ARCH 图示。本记录固定实施边界；不会把拟新增项目协议描述成现有 DSH API。

P0 已冻结 26 个旧工具目录、依赖锁、基线文件和已有构建产物哈希，并在同一只读 SQLite 事务中盘点本地表数量。没有复制业务值、安装 bundle、修改 DSH 核心、重启服务或执行业务变更。441 项既有测试全部通过。证据位于 `evidence/apps-v1-20261007/P0/`。

最初只读探针确认官方 Desktop CLI 为 0.2.0-rc.2，原 Desktop Host 绑定 loopback 19387，Hallmark 安装包元数据为 0.3.0。该次观察保存在 `host-capabilities-baseline-a0.json`。用户随后授权独立测试 profile：官方管理器实际安装候选，真实 Cordis Inspect 取得 tools/systemPrompt/sessionController 签名，原生 Tool 管线完成 Bill 只读查询，卸载后四工具与代理路由撤销且 Runtime 三个 Provider 保持 ready。核心哈希与初始基线一致，原 Desktop Host 未重启。Client GUI 仍受 Chrome `ERR_BLOCKED_BY_CLIENT` 阻挡；动态工作集保持固定网关降级。正式会话适配已按安装版本的公开合同实施，默认关闭，显式 opt-in 的实际消费与历史重建由独立 Host 证据单独验证。

G0 允许在隔离开发路径进入 P1，关闭未核实的宿主功能并保留旧入口。后续各任务按其原卡影响范围验证，关联完整需求的未验范围独立保留，不能将隔离技术结果称为生产或完整功能验收。

| 决策 | 固定内容 | 实施与验证边界 |
|---|---|---|
| ADR-001 | 一个 Apps 用户入口；1+N 逻辑原生插件 | `plugin-apps` 提供通用外壳；应用插件仅附加原生投影。异构 Notes 实施后验证公共代码没有 Notes 分支。 |
| ADR-002 | 单仓库、一个组合 bundle、P2 一个 Runtime 进程 | 应用 Provider 作为显式模块加载；不要求每个应用启动进程。产物版本域分别列明。 |
| ADR-003 | P2 拥有目录与执行，P1 仅原生投影 | Host 读取 Runtime Schema，不复制业务算法；宿主差异由 `dsh-compat` 封装。 |
| ADR-004 | 工具、SDK、组件汇聚一套能力实现 | 入口只绑定来源、可信会话、trace 与 deadline；Runtime 验证并执行。 |
| ADR-005 | 普通 React/TSX/CSS 源码为自由组件主路径 | 保留既有源码构建与 `hallmark.source.v1` 入口；DSL 是快速路径。真实构建/交互后才通过 G4。 |
| ADR-006 | 原业务事实留原应用，Runtime 管理缓存与资产 | Hallmark 保留真实 HTTP 与默认数据目录；Notes 有独立原应用数据源。快照必须标来源、时间与 stale。 |
| ADR-007 | 优先 DSH 原生接入；MCP 为未来适配 | 不增加第二 Agent Loop、聊天历史、安装器或权限体系。未核实扩展点直接降级，不猜方法名。 |
| ADR-008 | 停止旧写入 → 离线迁移 → 验证 → 单写切换 | P5 才允许切换演练；实现真实迁移命令与全资产备份后执行。当前运行服务继续使用现有数据。 |
| ADR-009 | 构建和预览通过 → 准备组件 → 用户点击 → 验证原生展示 | candidate.16 的历史实现。原聊天卡片固定发布身份，等待点击不启动计时；其一次性挂载协议在新侧栏打开路径中由 ADR-010 取代。 |
| ADR-010 | 成功预览归档 → 用户打开 → 独立显示尝试 → 失败可重开 | candidate.17 实现中的增量修复。每次明确打开使用新的 display/frame 身份，加载同一成功预览归档；加载错误供 Agent 读取，重开保持会话与数据权限检查。 |

| 事实或资产 | 唯一所有者 |
|---|---|
| 商品、价格、库存、平台原始操作状态 | 原 Hallmark / 平台业务服务 |
| 笔记正文与修订 | Notes 原应用存储 |
| 活动目录、连接与会话绑定、受管理调用及操作账本 | 单个 P2 Runtime |
| 共享展示状态、查询快照、组件源码、build 与 revision | Runtime 存储接口 |
| 工具/Slot 可撤销句柄与目录版本缓存 | DSH Host 投影 |
| 焦点、未确认的交互状态 | Client/iframe；不视为模型已消费的上下文 |
| 模型实际输入、原生会话历史 | DSH 正式会话机制 |

应用交付包含两个半部：P2 Provider 承载业务，P1 原生插件贡献目录与工具/界面投影。两组状态分别表示 `runtimeState` 与 `hostProjectionState`；后端 ready 不意味着宿主 attached。Provider 注册、就绪、停止接收、排空和停止的职责不能由 Host 窗口关闭替代。

ADR-009 是本轮针对桌面挂载问题的增量契约。`publish` 产生 `prepared`，`readyDeadlineAt` 与 `mountStartedAt` 为空；重启保留尚未打开的准备记录。候选保存在 `publication.source`，当前 `activeBuildId`、`lastGoodBuildId` 和已展示源码在等待期间保持原值。原聊天卡片固定 `sessionId/viewId/publicationId/buildId`，不跟随最新焦点或另一个发布；原生 `sidebarRight.mounted` 表示当前中央会话，仍作为所属会话的导航保护。

点击后 Client 经 Host 的 UI 路由调用 `POST /v1/authoring/startMount`，带 `sessionId` 和 `params` 中的 `viewId/publicationId/attemptId/attemptEpoch/buildId/expectedViewRevision`。Runtime 重新核验当前草稿代际、视图版本、构建/预览回执和归档，原子转入 `mounting` 并首次设定截止时间；相同点击不续期，终态不能复活。此操作不注册为模型能力。只有真实 frame 的授权、数据读取、React 提交和必要断言确认后才提升 `active/lastGood`，才称“已展示”；超时保留上一成功版本。candidate.16 已通过 801 项完整测试、类型和实际包内命令检查，并由官方管理器覆盖原同名插件、重开桌面；实际 Runtime16/schema4/健康和原会话历史前缀已核实，独立磁盘检查确认 33 个产物、144 项源码输入及 9774 个原核心文件一致。原生插件内存、用户点击后的真实组件显示与原输入附加仍待验，不能用后台或磁盘检查代签实际显示；正式状态见 [A.2 执行记录](apps-a2-execution.md)。

ADR-010 将创作结果与一次桌面加载分开。构建、预览和不可变归档仍由现有 authoring 回执证明；`publication` 固定原消息对应的构建。用户点击后，UI-only `openDisplay` 创建独立 `displayId/generation`，原侧栏直接加载该归档。等待点击不启动显示计时。准备态读取也必须注册归档资源，不能要求组件已经进入挂载态才允许读取入口。真实组合 Host + Runtime 的隔离回归已复现旧准备态读取 503，并在修复后通过实际构建、浏览器预览和原归档资源读取；此结果不替代桌面现场验收。

显示尝试保存在 Runtime 现有 `provider_records` 中。每次明确重开使用新的 iframe/nonce，并退役上次显示的 grant；旧文档不能借重开恢复桥接或提交回执。授权先核验所属会话、固定 publication/build、预览回执与归档、连接绑定和支持特性，再原子写入 grant。显示失败保留成功构建和工作副本，Agent 经 `apps.authoring.inspect` 读取 `latestDisplay/displays` 中的错误阶段、code 和 message，决定是否需要修复源码。加载错误回执不会自动发送聊天消息。首次实际数据读取、React 提交及必要断言通过可确认展示；再次打开不重复提交创作状态或推进视图版本。

历史原消息保持原构建与可信 `view_revisions` 快照的 bindings，不能把 P1 的源码配上 P2 的数据。历史展示不会覆盖当前活动构建，数据读取与资源选择仍重新检查当前会话权限及资源修订。保存继续由明确的用户请求触发。candidate.17 已通过 812 项完整测试、类型和实际包内命令检查，冻结 145 项构建输入和 33 个产物；归档 SHA256 为 `e5cdbfefe9eab592f7cd733009deacdc215bab909a54cc09dd0128868bb3fa56`。独立源码复核覆盖旧会话拒绝、显示授权、失败重开和真实 candidate.16 SDK 兼容；兼容夹具使用私有归档，Node 侧 ready 模拟，不代表 Bill 原归档或桌面显示。官方管理器已覆盖同名插件并重开桌面，实际 Runtime17/schema4、Hallmark 健康和原会话历史前缀已核实；Host 插件内存、实际显示与原输入附加尚待验证。安装前旧16的 Host 文件只有一处允许 `prepared` 的条件变化，实际旧插件与运行数据均已冷备；内部 pnpm Junction 按等价拓扑重建，原文件字节及源指纹不变。初次链接检查和旧安装漂移检查的失败记录均保留。ADR-009 的旧实现及失败证据保留，正式 A.2 状态没有因新增实现提升。

动态 Schema 默认采用固定 `apps_list` / `apps_describe` / `apps_invoke` / `apps_inspect` 网关。只有支持状态、live 证据等级和真实签名同时具备才启用动态工作集。门禁阻止调用不等于按需发现。

组合 bundle 默认关闭 `legacyToolProjection`，因此默认模型只有 4 个发现网关；Runtime 始终保留旧 26 名称的别名、旧 HTTP 与 bridge v1 解释器。兼容回放可显式打开旧工具投影，形成 4 + 26 个工具，所有旧工具执行仍经 Runtime。此模式会加载完整旧 Schema，不能记为默认按需发现通过。真实 DSH 旧 26 工具回放未执行；当前证据只覆盖夹具注册唯一性、别名所有权及统一执行。共享 `apps` 展示 Provider 的原生投影由外壳自身挂载和撤销，Hallmark/Notes 投影各有独立句柄。

候选包随带 `@dsh/apps-contracts`、`@dsh/apps-sdk` 与 `@dsh/apps-component-runtime` 的预构建 JavaScript 和类型声明；组件保留普通 React 工程依赖。source-starter 只在显式新目录生成普通 React/TSX/CSS 工程，真实依赖锁由工程的正常安装生成，不伪造锁文件。发布代码包不打入个人源码组件构建、业务库或快照；这些资产由离线迁移/备份路径携带。打包 SDK 已在另一隔离工程做 JS 导入、独立类型检查与真实构建，但常规依赖安装以及真实 Host 组件装载仍未验。

候选 Client 的 `apps_invoke` 展示仅读取工具输出的 `meta.apps`，并按当前原生会话校验 view 所有权。Apps 工作台与旧 SourceFrame 共用注入的 v2 工厂，经 `/api/dsh-apps` → Runtime HTTP 调用同一能力；源文件仍由既有 source asset 路由统一拥有。实际组合 Client 夹具已验证新旧 iframe 调用到 Notes Provider、账本记录 component 来源、资源选择校验后产生一个原生附件且零自动发送；这只覆盖候选结构契约与真实隔离 Runtime，不作为已安装 DSH GUI 验收。

`requestAgent` 与正式持久上下文投影默认关闭，返回 `UNSUPPORTED_HOST_CAPABILITY`。可用替代路径是既有 `attachSelection` 将数据附加到当前会话输入，再由用户发送。附件成功仅为 attached，不能显示 submitted；iframe 内存不会被宣称为 Agent 已收到。显式 `nativeSessionAdapter: dsh-0.2.0-rc.2` 仅在正式服务 ready 时启用：异步 assembly hook 从 Runtime 读取最后一次显式 updateContext 的不可变快照，DSH 自身投影保存实际消费上下文；requestAgent 先取得 Runtime 唯一 dispatch claim，再提交原生输入，官方 sessions.flush 与原 rpcId 事件核实后才记录 durable accepted。accepted 表示持久排队，实际模型消费另留证；失联/unknown 只查原输入，不重发。

安装版 Cordis 4 的 `inject` 只接受服务数组或服务配置表，不支持自造 required/optional 分组。可选会话服务使用正式 `ctx.get(name)` 严格读取 ACTIVE provider，禁止通过未声明的直接属性读取或 strict=false 绕过就绪状态。candidate.4 实际展示了构造时服务尚未 ACTIVE、之后服务已可用而单次缓存仍为 false 的问题；该失败与零 prompt 记录保留。candidate.5 在正式 internal/service 通知及每次能力查询/动作时重新 strict get，并仅注册一份 owned assembly hook；服务失效后明确阻断上下文消费。Host/bundle 为 candidate.5，P2 Runtime 保留 candidate.4 与原字节，版本域不强行同步。

candidate.5 实际独立 Host 的显式适配已通过：发布 revision1 不唤醒模型，第一条原生输入具有 durable queued 回执，DSH 正式 buildRequest 随后被本地确定性 adapter 消费；再发布 revision2 后，重启 Host 并以官方 Session.create 重建原 throughSeq17，旧 revision/资源引用和任务指定快照逐项相同，纯历史读取产生零模型调用与零会话写入。第二条明确新任务消费 revision2，并捕获实际发送的四个 Apps Schema、零旧 hallmark Schema及三应用摘要。两条 Agent step 与一次会话标题辅助调用都由本地 adapter 执行，无外部模型或性能/token 宣称。独立复核见 `evidence/apps-live-bill-20261007/host-session/independent-review-candidate5.json`；安装版 Client GUI 仍单独受阻。

职责记录：实施 I 为 Codex `host_baseline`、父代理及其分工代理；验证 V 为独立断言与命令记录，具体执行者在各结果中标明；架构 A 为用户授权的 V1 范围与固定 SPEC。官方安装与重启只在用户授权的独立 profile 执行，复制环境完成迁移/切换/双回退演练；生产发布 R 未签认，原用户服务与数据未切换。

实际安装观察证明同一 package 路径升级后，磁盘 candidate.2 与运行回调可以短暂不同：管理器 HMR 保留了 candidate.1 的 agent-only 摘要回调。记录磁盘 hash、实际回调特征和失败输出后，仅重启独立 Web Host；fresh process 加载 candidate.2 的 `agent ?? scope` 回调，同一会话组装得到三应用摘要与四工具 Schema。部署必须验证运行结果，必要时按官方管理机制重启目标 Host；不能仅凭磁盘版本宣称升级完成。证据见 `evidence/apps-live-bill-20261007/host-session/{callback-before-restart.json,callback-after-restart.json,prompt-candidate2.json}`。

ADR-010 调整用户已授权范围内的组件展示协议，沿用原侧栏与 Runtime 所有权，并以独立显示尝试支持失败重开。固定基线保留，变更记录在本 ADR 和候选执行说明中；新增运行时代码继续以候选实现交付，不能因本记录称为完整验收版。
