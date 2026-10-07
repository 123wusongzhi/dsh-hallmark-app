# DSH 多应用框架 · SPEC 规格说明书

> **GitHub 收录说明（2026-10-07）：** 本文件由原项目工作目录收录，文档链接已调整到仓库内；历史任务、基线和验收范围保留。原始现场归档不发布，`evidence/` 路径仅作原开发机定位；公开结果见[发布验证摘要](../apps-publication-validation-20261007.md)。

**文件编号：DSH-APPS-SPEC-001　｜　修订：A.0 / 1.0.0-draft　｜　发布日期：2026-10-06**

**状态：设计与实施评审稿。** 本文规定建议的目标系统，不表示这些能力已经在仓库实现、安装或验收。所有任务初始状态为 TODO，测试初始状态为 NOT_RUN。

| 控制项 | 内容 |
|---|---|
| 适用项目 | 123wusongzhi/dsh-hallmark-app |
| 代码基线 | `cb871b4086508988485dc4a0a5d6aa5440901267` |
| 当前基线产品版本 | 0.3.0；实际运行版本需现场核实 |
| 目标形态 | 一个 Apps 入口；1+N 逻辑插件；单仓库与一个组合 bundle；V1 一个本机 Runtime 进程 |
| 评审责任 | 架构负责人 A、实施负责人 I、验证负责人 V、发布负责人 R；人员姓名在执行时登记 |
| 规范优先顺序 | SPEC 的编号需求与字段/状态规则 > TODO 的执行顺序 > ARCH 的图示；发现冲突先提交变更单，不自行解释 |
| 阅读约定 | “必须”是放行要求；“不得”是禁止行为；“应”允许记录理由后偏离；“可”是可选能力 |
| 安全范围 | 本次不重新设计权限、安全沙箱或审批体系；现有机制不因架构重构被删除；结果可核实、幂等与故障恢复属于正确性要求 |

> **停止条件：** 当本机 DSH 契约、原应用真实接口或数据迁移前提与本文不一致时，停止受影响步骤，保留证据并更新决策记录。不得把“拟新增”接口当作现有 DSH API 直接调用。


## 00 使用方法与配置控制

本文件把上一轮架构建议转成可实施、可测试的目标规格。“SPC”在本交付中按软件规格说明书处理，统一标识为 SPEC。

需求以 REQ-001 至 REQ-048 编号；对应验证用例以 TST-001 至 TST-048 编号；实施任务见 DSH-APPS-TODO-001 的 TODO-001 至 TODO-026；图纸见 DSH-APPS-ARCH-001 的 FIG-01 至 FIG-12。机器可检查追踪表为 `traceability.csv`。

执行人员必须先读 01、03、05、08 和 12 章。进入开发前执行 TODO 的 G0；进入发布前执行 G5。不能以“已生成本文件”将任何需求标为完成。

### 00.1 修改规则

改变进程归属、状态所有者、操作状态、字段语义、兼容窗口或切换程序，必须提交 CR 变更单。变更单必须包含原规则、新规则、受影响 REQ/TODO/TST/FIG、数据迁移影响和回退影响。修订历史只追加，不改写旧版批准记录。

示例中的 ID、连接名、Notes 数据和路径均为合成值。未出现于基线代码的包名、HTTP 路由、`AppsHost` 和 bridge v2 均是本项目拟新增协议，不是 DSH 官方现成接口。

### 00.2 本版已作出的设计决定

本版固定 V1 的部署为 P1 DSH Host、P2 单个本机 Apps Runtime、P3 Client/iframe、P4 原应用。Hallmark Provider 与 Notes Provider 的业务实现放在 P2；N 个 DSH 插件在 P1 只承担原生投影。不同于模糊的“Provider 可在任何地方”，本版不允许实施人员自行选进程。以后引入远程 Provider 必须另立 ADR。


## 01 目标、范围与非目标

### 01.1 产品目标

用户从一个 Apps 入口访问多个应用。Agent 在原有 DSH 会话中发现能力，选择连接，组合查询与修改，生成普通源码组件，并在明确保存后复用组件。复杂批处理通过 SDK 脚本执行；低频接口通过注册的 API operationId 调用；所有受管理调用汇聚到同一业务实现。

本框架不是业务数据库替代品，也不是第二套 Agent 产品。它管理“如何发现、调用、记录、展示和恢复应用能力”。业务上的商品、订单和原始笔记仍由原应用保存。现有 Hallmark 参考利润仍只是参考模型，不会因进入通用框架而变成实际结算利润。[SRC-07]

### 01.2 V1 必须交付

V1 包含共享应用目录、连接模型、多应用会话绑定、统一能力协议、Hallmark Provider、异构 Notes 验证 Provider、语义工具/SDK/API 三入口、共享源码组件运行时、历史兼容投影、操作记录与恢复、离线迁移及发布回退程序。

V1 的 Notes 是验证接入边界的本地最小应用，不要求变成商业笔记产品。它必须具有不同于商品的资源类型，并完成 list/get/create/update。

### 01.3 明确排除

本期不建设插件市场、自动售卖/发布平台、第二个插件安装器、第二个 Agent Loop、通用工作流引擎、自研浏览器或全面 MCP 改造。DSH 原有网络和命令能力也不在本规范接管范围：绕过 SDK 直接执行的 curl 不会自动获得本框架调用记录，不能计入受管理调用验收。

权限和安全不是本次方案选择的主理由。保留幂等、版本、来源和未知结果，是为了避免重复执行、接口漂移和错误结论。


## 02 现状基线与迁移约束

| 基线事实 | 源码证据 | 对目标系统的约束 |
|---|---|---|
| `TOOL_DEFINITIONS` 有 26 个 define 条目；README 部分仍写 25 | SRC-02、SRC-01 | 迁移以 26 名称清单为准，不按历史数量漏项 |
| `AppCore` 同时分发业务和展示 | SRC-06 | 先移动责任，不同时改变原 Hallmark HTTP 语义 |
| 应用目录静态、SessionApp 的 appId 固定 Hallmark | SRC-04、SRC-05、SRC-07 | 新增 Runtime 注册与组合身份，不能仅给数组加名称 |
| 一个独立服务组装业务、存储、展示和调度 | SRC-08 | V1 保留伴随服务形态，逐步通用化，不一开始迁入 DSH Host |
| 现有 SQLite schemaVersion 为 2 | SRC-09 | 目标为空库 schemaVersion 3，必须执行显式迁移，不直接改旧库 |
| 源码 bridge 有五种方法，选择类型包含商品语义 | SRC-10 | 新增 v2，旧 v1 通过适配器继续工作 |
| 组件构建和历史版本已有实现 | SRC-11、SRC-12 | 保留普通源码、不可变构建与显式保存，不回退成只允许 DSL |
| 实际 Host 接入类型来自 0.2.0-rc.2 Inspect | SRC-04、SRC-13 | 官方 master 文档不能代替当前安装版本探针 |
| 模型输出已有 16384 字节默认预算 | SRC-14 | 延续完整数据与模型投影分离，不删除已有能力 |

本次交付没有重跑仓库业务测试，没有访问真实 Hallmark 服务，也没有执行安装、数据库迁移或真实写操作。本文的测试表均为待实施验证计划。


## 03 术语与标识：每个词只保留一种含义

| 术语 | 本规范唯一含义 | 不等于 |
|---|---|---|
| App | 一种可接入产品/系统，如 Hallmark、Notes | 插件实例、店铺或组件 |
| appId | 应用稳定标识，如 `hallmark` | UI 显示名称 |
| Native Plugin | 在 DSH/Cordis 中装载并贡献工具/界面的模块 | 单独的 OS 进程 |
| Provider | P2 内实现一个应用能力的业务模块 | Agent、聊天系统或 UI 外壳 |
| AppsHost | 本项目在 P1 中新增的接入门面 | DSH 已有官方服务名 |
| Runtime | P2 中的目录、调用、记录和共享展示管理器 | DSH Agent Loop |
| Connection | 一个明确后端实例/账号连接 | 店铺、会话或插件包 |
| connectionId | Connection 的稳定身份 | 连接名称、端口或店铺 ID |
| Store | Hallmark 领域中的店铺 | 通用连接；一个连接可有多店 |
| Capability | 有版本、输入输出和效果类型的可调用动作 | 提示词或界面按钮 |
| semantic tool | 面向高频任务的清晰原生工具投影 | 全部可用能力的上限 |
| API operationId | 已登记底层接口的协议标识 | 任意 URL 或一次业务操作 ID |
| invocationId | 一次调用尝试的 ID | 幂等业务意图或远端请求 ID |
| operationId | 一次受记录业务变更的稳定 ID | API operationId；两者不同命名空间 |
| idempotencyKey | 同一逻辑变更在重试中复用的键 | 每次随机生成的 invocationId |
| runId / stepKey | 脚本运行和其中稳定步骤标识 | 自研工作流引擎的要求 |
| ResourceRef | app、connection、type、id 的通用资源引用 | 自动跨应用匹配规则 |
| Dataset | 查询结果与来源、时间、版本的快照 | 原应用实时数据库 |
| focusedApp | 界面当前聚焦应用/连接 | 当前会话唯一可用应用 |
| SessionAppBinding | 一个会话绑定一个 app+connection 的状态行 | 插件全局安装状态 |
| buildId | 不可变源码及构建清单的内容地址 | 可编辑目录 |
| viewId | 某个会话中的展示/草稿实例身份 | 已保存组件身份 |
| componentId + revision | 用户组件库中的资产和版本 | 临时预览或母模板 |
| frameInstanceId | 一次 iframe 装载生命周期身份 | buildId；同构建重载也有新 frame |
| pending | 已有受理证据，业务结果尚未结算 | 失败、未发送或成功 |
| unknown | 缺少足够证据判断外部结果 | 可以安全自动重发 |
| stale | 保留数据但时效已不满足当前来源判断 | 空数据或读取失败 |

所有时间使用含时区的 ISO 8601；记录与比较使用 UTC，界面可转换本地时区。序列化空缺值必须明确区分 null 与字段未提供。源数据的 resourceId 是不透明字符串，不做大小写折叠或名称猜测。


## 04 编号需求与强制断言

以下 48 项均属于目标要求。每项都有同号测试，详细验证步骤见 15 章。

### 04.1 系统边界

**REQ-001 · 不修改 DSH 核心**

集成实现必须通过已核实的 DSH 插件、工具、会话与展示扩展点工作；不得增加第二个 Agent Loop、复制聊天历史或修改 DSH 核心文件。

验证：`TST-001`；放行断言：核心文件哈希不变；任务使用原会话；卸载无残留注册。

**REQ-002 · 一个外壳与 N 个接入**

共享 Apps 外壳不得 import 任何具体应用实现。每个应用必须通过清单和 Provider 注册加入；应用 UI 入口数不得随接入插件数增长。

验证：`TST-002`；放行断言：公共源代码无 notes 分支；目录出现两个应用；仍只有一个 Apps 入口。

**REQ-003 · 一个业务事实来源**

原应用必须继续拥有商品、订单等业务事实。Runtime 只能保存连接、调用证据、查询快照和展示资产；不得把缓存标为实时源记录。

验证：`TST-003`；放行断言：快照可读且明确 stale/时间；刷新报 unavailable；原业务库没有被替代写入。

**REQ-004 · 一个能力执行实现**

原生工具、SDK、底层 operationId 入口和组件动作必须汇聚到 Runtime invoke；一个逻辑调用只能触发一次 Provider execute。

验证：`TST-004`；放行断言：每次独立调用 Provider 恰为一次；三入口的结果包络和错误语义一致。

### 04.2 注册与发现

**REQ-005 · 唯一运行时目录**

P2 Runtime 必须维护唯一活动能力目录。DSH Host 只保存可撤销投影和目录版本缓存，不得独立定义第二份能力 Schema。

验证：`TST-005`；放行断言：Host 由目录生成新投影；catalogDigest 改变；不存在手工同步的第二份 Schema。

**REQ-006 · 生命周期与卸载**

Provider 启动、Host 投影挂载、停止接收、排空及卸载必须是显式状态。卸载 Host 投影不得删除组件、快照或已提交业务操作。

验证：`TST-006`；放行断言：无重复工具和事件监听；组件仍存在；操作可由 Runtime 回查。

**REQ-007 · 连接独立于应用**

一个 appId 必须允许多个 connectionId。connectionId 必须绑定明确后端实例；店铺 ID 必须保留为领域参数，不得默认等同 connectionId。

验证：`TST-007`；放行断言：请求只到指定连接；店铺按输入解析；不复制插件或混淆两类标识。

**REQ-008 · 会话应用集合与焦点分离**

SessionAppBinding 必须以 sessionId、appId、connectionId 为组合身份。focusedApp 只影响界面，不得自动禁用其他已启用会话绑定。

验证：`TST-008`；放行断言：原会话仍能调用两应用；另一会话未获得隐式绑定。

**REQ-009 · 显式路由与歧义处理**

调用在多个连接候选间无法唯一解析时，必须返回 needs_clarification 和候选 connectionId；不得按最近使用、第一项或名称相似自动选择。

验证：`TST-009`；放行断言：首个请求零下游分发并返回候选；完整 ID 请求仅命中一个连接。

**REQ-010 · 按需工具发现**

默认模型上下文必须只包含应用摘要和已选工作集能力；未验证 DSH 动态 Schema 支持前，必须使用固定 discovery/describe/invoke 投影，不得宣称执行门禁等于按需发现。

验证：`TST-010`；放行断言：完整 1000 能力 Schema 未整体注入；加载工作集可追踪；未支持路径显式降级。

**REQ-011 · 兼容性握手**

Host 与 Runtime 必须校验 transportMajor、catalogSchemaVersion 和能力版本；支持范围外的破坏性差异必须返回 INCOMPATIBLE_PROTOCOL，不得绕过检验继续执行。

验证：`TST-011`；放行断言：前者目录刷新成功；后者在 Provider 分发前停止并显示期望/实际版本。

### 04.3 能力契约

**REQ-012 · 输入输出同时声明**

每个能力必须声明版本化输入及输出 Schema，且注册时编译校验。成功结果的 data 必须满足输出 Schema；校验失败不得投影为成功。

验证：`TST-012`；放行断言：注册失败或 OUTPUT_SCHEMA_INVALID；错误包含字段路径；模型不见伪成功。

**REQ-013 · 底层 API 不是第二套业务**

底层调用必须通过注册 operationId 和对应 Provider dispatch，保留请求/响应证据。具备直接 HTTP 的应用可用生成客户端；CLI/MCP 接入可另写适配器。

验证：`TST-013`；放行断言：无需新增语义工具即可调用；仍生成 invocationId 和正确来源/结果状态。

**REQ-014 · 未知写接口显式分类**

目录未登记的底层操作必须先添加效果类型、请求格式和结果解释。不得把未知 POST 当只读；这是结果可解释性要求，不是要求人工审批每次调用。

验证：`TST-014`；放行断言：未登记请求为 CAPABILITY_NOT_FOUND；登记后沿统一写入链路执行。

**REQ-015 · 生成 SDK 与调用语义**

SDK 类型、能力文档和原生参数投影必须从同一能力清单生成。SDK 必须返回显式结果联合类型，不得将 unknown 静默转为空对象或自动重试写操作。

验证：`TST-015`；放行断言：类型/文档/工具投影同步变化；调用方必须处理 unknown，Provider 未再次执行。

**REQ-016 · 数据来源时间口径**

返回数据必须分别表达 fetchedAt、sourceDataTime 和 freshness；无法证明源时间时 sourceDataTime 为 null。参考利润必须保留 metricBasis，不得改称结算净利润。

验证：`TST-016`；放行断言：sourceDataTime=null；缺成本单列；标题及结果未使用实际结算净利润。

### 04.4 执行可靠性

**REQ-017 · 幂等身份与请求哈希**

变更调用必须在分发前持久化 operationId；幂等唯一域为 appId+connectionId+capabilityId+idempotencyKey。相同键不同规范化请求必须返回 IDEMPOTENCY_CONFLICT。

验证：`TST-017`；放行断言：仅一次业务分发；并发获得同一 operationId；改变价格请求冲突且零新分发。

**REQ-018 · 状态与业务核实**

接受请求、平台接收和业务完成必须分开表示。unknown 只能由只读回查变为已知状态，不得经自动重发变为 running。

验证：`TST-018`；放行断言：操作先 unknown；仅执行 inspect；确认完成后 succeeded，原变更端点总调用数为一。

**REQ-019 · 取消不等于撤销**

取消前未分发的变更必须记 cancelled；分发后缺少完成证据的取消必须记 unknown 或保持 pending 并回查。AbortSignal 必须逐层传递，停止新增子调用。

验证：`TST-019`；放行断言：前者外部请求为零；后者不声称业务撤回；子调用不再增加。

**REQ-020 · 并发与冲突域**

Provider 必须声明同一连接/资源的并发规则。默认变更串行；readOnly 名称不能代替并发安全证明；冲突保存必须使用 expectedRevision。

验证：`TST-020`；放行断言：冲突域内按序；无关读取按声明执行；仅一个保存成功，另一个 REVISION_CONFLICT。

**REQ-021 · 脚本子调用日志**

脚本和批处理必须有 runId，所有能力子调用必须记录 parentRunId、invocationId、appId 和 connectionId。已完成子调用在后续失败时不得从记录中删除。

验证：`TST-021`；放行断言：run=failed/partial 可定位；Notes 完成记录仍在；恢复未重放已完成写入。

**REQ-022 · 跨应用不假装事务**

跨应用流程必须按步骤汇报结果；补偿必须由应用明确提供，且补偿本身具有独立操作记录。不得承诺通用原子回滚。

验证：`TST-022`；放行断言：结果为 partial 并列出步骤；只恢复未完成步骤；没有自动反向 Hallmark 变更。

**REQ-023 · 模型预算与数据句柄**

完整数据必须能以数据集或文件引用读取；模型投影默认不得超过 16384 UTF-8 字节。分页/筛选必须明确 total、returned、cursor 和完整性。

验证：`TST-023`；放行断言：模型响应受预算限制；完整结果可查；spill 失败给明确错误/更小分页提示，不转无限文本。

**REQ-024 · 稳定错误契约**

业务错误必须有 code、message、retryPolicy 和相关 operationId；retryPolicy 必须区分 never、read_retry、inspect_only。transport 超时不得统一变成业务 failed。

验证：`TST-024`；放行断言：结果依次为 failed/never、unavailable/read_retry、unknown/inspect_only。

### 04.5 组件与交互

**REQ-025 · 普通源码为主路径**

复杂组件必须允许普通 React/TSX/CSS 源码和正常依赖构建；静态/声明式组件可作为快速路径，不得成为自由布局上限。

验证：`TST-025`；放行断言：不依赖七类固定控件即可展示；构建错误不覆盖旧可用版本。

**REQ-026 · 构建与保存分离**

buildId 必须标识不可变构建；viewId 必须标识会话展示实例；componentId 必须标识已保存资产。登记草稿不得自动保存进组件库。

验证：`TST-026`；放行断言：A 构建仍可读；另一 view 未被覆盖；只有保存步骤生成组件版本。

**REQ-027 · 桥接握手与协议**

组件握手必须包含 protocolVersion、viewId、buildId、frameInstanceId 和宿主支持方法。旧 frame 回复不得改变新构建状态。

验证：`TST-027`；放行断言：旧回复被丢弃；新 frame 数据与当前 buildId 匹配；未知主版本被拒绝。

**REQ-028 · 通用资源选择**

组件选择必须使用 ResourceRef，不得在通用 SDK 声明商品、店铺或利润专属字段。选择提交必须携带 bindingId 和数据 revision。

验证：`TST-028`；放行断言：两种资源均可表示；旧选择返回 SELECTION_STALE，未静默映射到新行。

**REQ-029 · 本地动作不经过模型**

筛选、排序、折叠、分页显示和选中状态必须在组件本地处理；明确业务按钮通过 SDK invoke，不得每次点击都生成 Agent 请求。

验证：`TST-029`；放行断言：本地交互模型请求数为零；能力按钮产生一次 invocation。

**REQ-030 · 上下文与消息分开**

updateContext 必须只更新可在后续模型步消费的结构化上下文；requestAgent 必须沿 DSH 已验证会话输入路径提交任务。上下文更新不得自动唤醒模型。

验证：`TST-030`；放行断言：前者不新增模型步；后者产生可重放的原生会话输入或明确 UNSUPPORTED_HOST_CAPABILITY。

**REQ-031 · 确定性会话投影**

任何实际进入模型的组件上下文必须能从 DSH 持久会话记录或正式纯投影重建。仅保存在 iframe 内存中的状态不得被宣称为已送达 Agent。

验证：`TST-031`；放行断言：消费时的 revision 与数据引用可重建；后续 UI 状态未篡改历史输入。

**REQ-032 · 多应用绑定**

单组件必须能绑定不同 appId/connectionId 的多个数据集，各绑定独立报告 freshness 和错误。跨应用实体关联必须注明匹配键与证据。

验证：`TST-032`；放行断言：可用区域继续显示；失败区域独立报错；未映射对象标记 unresolved，不按名称猜配。

**REQ-033 · 离线与版本冲突**

打开保存组件不得强制业务后端在线；刷新失败必须保留上次成功快照；组件更新必须提供 expectedRevision，历史版本回退必须保存为新版本。

验证：`TST-033`；放行断言：设计可打开，数据明确 stale；冲突不覆盖；历史版本仍存在。

### 04.6 数据与迁移

**REQ-034 · 明确状态所有者**

P2 Runtime 必须是应用目录、连接、调用记录和共享展示库的唯一写入者；Provider 域状态必须命名空间隔离；P1/P3 不得直接写 SQLite。

验证：`TST-034`；放行断言：只有 Runtime 存储接口提交共享写；Host/浏览器无直接数据库访问。

**REQ-035 · 确定性数据集身份**

数据集键必须由协议版本、appId、connectionId、能力主版本、规范化输入和字段投影生成；对象键排序但数组保序，未知字段必须按 Schema 处理。

验证：`TST-035`；放行断言：仅对象键重排仍同键；其他语义变化不同键；存储保留完整规范输入以核对哈希。

**REQ-036 · 历史数据可追溯迁移**

v2 到目标数据结构必须在离线副本执行 dry-run，生成逐表计数、旧新 ID 映射和构建文件校验。未知连接/工具映射必须隔离为 needs_migration。

验证：`TST-036`；放行断言：原库不变；可解析记录有映射；孤儿不被自动认领；异常在报告中逐项列出。

**REQ-037 · 禁止双写切换**

切换前必须停止旧入口接收与写入、核实未决操作并取得一致备份。切换后只有新 Runtime 写新库；旧库必须保留且禁止新旧服务同时写同一业务请求。

验证：`TST-037`；放行断言：第二写入者被拒绝；切换检查失败不开放入口；已应答数据未遗失。

**REQ-038 · 有条件回退**

新系统已产生业务变更后，不得简单还原旧 app.db 并恢复写入。必须先冻结新入口、导出增量操作及回查，再决定兼容代码回退或数据恢复。

验证：`TST-038`；放行断言：流程阻止盲目旧库写入；两条操作仍可追踪；回退结论附校验记录。

**REQ-039 · 引用驱动清理**

保存组件引用的构建、数据证据和历史 revision 不得因普通临时文件清理被删除。清理必须先标记，再核对引用，最后按显式保留策略删除。

验证：`TST-039`；放行断言：A 不在删除计划；B 只有满足保留条件才可删除；计划含字节数和引用原因。

### 04.7 兼容与发布

**REQ-040 · 保留旧工具与协议入口**

迁移版本必须保留已有 26 个 hallmark_* 工具名及其参数/结果语义的兼容投影；旧源码 bridge v1 通过适配器工作，不直接强制所有组件重建。

验证：`TST-040`；放行断言：26 名称覆盖完整；结果语义不退化；hallmark.source.v1 仍能读取和附加选择。

**REQ-041 · DSH 兼容探针**

dsh-compat 必须记录实际 Host 版本及各扩展点探针结果。无法核实的动态工具、Agent 消息或上下文接口必须关闭相关特性，不得通过猜测方法名上线。

验证：`TST-041`；放行断言：功能矩阵准确；不支持项返回固定错误并显示可用替代路径。

**REQ-042 · 统一分发但独立版本**

V1 必须采用单仓库、一个组合 bundle、一个 P2 运行时进程；逻辑上保留 1+N 原生插件。插件包版本、能力版本、桥接协议和数据库版本必须分开记录。

验证：`TST-042`；放行断言：无每应用一进程要求；版本字段可分别解释；安装器仍为 DSH 官方管理机制。

### 04.8 验收与运行

**REQ-043 · 异构应用验证**

第二个验证应用必须是 Notes 等非商品领域，且至少具备 list/get/create/update 与独立 ResourceRef；第二家店铺不得作为多应用验收替代。

验证：`TST-043`；放行断言：两种领域正常工作；通用层无 storeId/productId 分支；无需改 Hallmark 源文件。

**REQ-044 · 可定位观测记录**

日志必须携带 traceId、invocationId、operationId（存在时）、runId（存在时）、appId、connectionId、能力版本与耗时；UI 必须显示可复制的诊断标识。

验证：`TST-044`；放行断言：可定位到同一次调用；包含分发/结果证据；没有仅写 unknown error 的不可定位日志。

**REQ-045 · 自动化故障矩阵**

发布必须覆盖服务不可用、响应丢失、重启恢复、组件旧帧、重复请求、并发保存和协议不兼容；成功路径测试不得替代故障测试。

验证：`TST-045`；放行断言：全部强制断言通过；失败项阻止候选版通过 G5。

**REQ-046 · 性能与上下文基准**

必须对同一任务比较直接工具、SDK 脚本和混合方式，报告模型输入量、总耗时及成功率；不得引用外部项目提升比例作为本项目验收结果。

验证：`TST-046`；放行断言：报告原始样本和分位数；无未经测量的提速承诺；预算硬限制通过。

**REQ-047 · 可复现交付证据**

每个需求必须关联任务、测试和证据路径。代码完成、模拟测试通过、真实后端验收和文档发布必须分别记录，不得互相替代。

验证：`TST-047`；放行断言：48 个需求无遗漏；未运行测试保留 NOT_RUN；真实业务验收缺口明确。

**REQ-048 · 不扩张本期目标**

V1 不得包含插件市场、第二套权限系统、通用工作流引擎、强制 MCP 改造或自研浏览器；新需求必须经变更单确定影响与新增验收。

验证：`TST-048`；放行断言：越界变更被评审标为 scope_change；未纳入 V1 放行声明。

## 05 架构决策与职责分配

### 05.1 固定决策

| 决策 | 规定 | 变更所需证据 |
|---|---|---|
| ADR-001 | 一个用户入口，1+N 逻辑原生插件 | 第二应用接入成本及公共代码差异 |
| ADR-002 | V1 单仓库、一个组合 bundle、P2 一个 Runtime 进程 | 独立发布/故障隔离需求及运维负担比较 |
| ADR-003 | 能力目录和业务执行在 P2；P1 仅原生投影 | 宿主 API、后台运行与故障恢复比较 |
| ADR-004 | 一套能力实现供工具、SDK 和组件调用 | 三入口一致性测试及调用日志 |
| ADR-005 | 普通源码为自由组件主路径，DSL 仅快速路径 | 真实定制交互用例和构建/运行成本 |
| ADR-006 | 源业务事实留原应用，缓存和资产由 Runtime 管理 | 数据所有权和同步冲突分析 |
| ADR-007 | 原生 DSH 优先，MCP 作为未来协议适配器 | 已有跨宿主需求及适配成本，不以潮流为理由 |
| ADR-008 | 先停止旧写入、离线迁移、验证后单写切换 | 可证明不丢失已应答操作的迁移和回退演练 |

### 05.2 执行边界

P1 包含 plugin-apps、plugin-hallmark、plugin-notes 与 dsh-compat。plugin-apps 提供拟新增 AppsHost 门面，获取 P2 目录并转为原生工具/界面。N 个应用原生插件调用 attachApp，保有自己的可撤销注册句柄；不得重复实现价格或笔记业务。

P2 包含 app-runtime、presentation、source-components、各 Provider、SQLite 和文件存档。启动组合器从显式清单装载 Provider 模块。公共 Runtime 仅依赖 AppProvider 协议。V1 增加 Provider 模块需要重新构建/部署对应 P2 产物并按安装结果重启；不承诺热加载。

P3 是 DSH Client 与 iframe。它只调用 Host 代理/bridge，不写本机数据库。P4 是原应用服务；原已有多个服务继续存在，不计为框架新增 N 个微服务。

DSH 官方架构说明服务、事件、可撤销注册和 bundle 组合是扩展基础。[SRC-15] 本项目具体扩展点仍以 TODO-002 的实际 Host 探针为准。

### 05.3 两个半部不是两份目录

“应用插件”作为交付单元可以同时包含 P1 的原生投影包和 P2 的 Provider 包。P2 目录是唯一能力真相；P1 缓存只记录同一目录的版本与注册句柄。工具的参数和输出不可在两个半部各手写一份。

应用目录应同时显示 runtimeState 和 hostProjectionState。P2 Provider 已加载但 P1 未挂载时，应显示“后端可用，DSH 接入未挂载”，不得假装 Agent 工具已注册。

### 05.4 状态与操作的所有者

| 对象/职责 | 唯一所有者 | 其他层可做什么 |
|---|---|---|
| DSH 插件安装/升级配置 | DSH 官方管理机制 | 读取已核实状态；不能据目录名称推断安装成功 |
| 能力描述与版本 | P2 Registry / Provider 清单 | P1 缓存与生成投影 |
| 连接与 session binding | P2 Runtime | P1/P3 提交明确变更 |
| 领域字段解释、接口路径和远端回查 | 对应 Provider | Runtime 调用统一接口 |
| 本地 invocation/operation 状态 | P2 Runtime | Provider 提交证据，不另开独立幂等宇宙 |
| 源商品/笔记业务记录 | 原应用 | Runtime 查询、发起业务动作、保留快照 |
| build/view/component/版本与绑定 | P2 Presentation | Agent 编写源码，Client 显示与请求保存 |
| 模型可见历史 | DSH 正式会话机制 | 插件按已核实扩展点贡献结果与上下文 |


## 06 接口控制文件：数据契约

### 06.1 约束等级

本章与 `schemas/proposed-contracts.ts` 是拟新增项目协议。TypeScript 文件仅为类型声明，不包含服务实现。字段规则以本章和编号需求为准；类型能够编译不等于运行时行为正确。

appId 必须是 2 至 64 字符的小写字母、数字、连字符标识，首字符为字母。capabilityId 必须全局命名空间化，例如 `hallmark.products.list`、`notes.notes.create`；执行时传精确 capabilityVersion，不传 latest。connectionId、资源 ID 和 operationId 为不透明字符串，界面名称变更不改变身份。

规范化 JSON 必须递归排序对象键，保留数组顺序，拒绝非有限数、循环引用和 undefined。序列化结果必须使用 UTF-8。字符串不自动 trim、转小写或改变 Unicode 内容；有此需求的能力必须在自己的 Schema/归一化规范中明确声明。

### 06.2 核心请求字段

| 字段 | 必填及产生者 | 语义与校验 |
|---|---|---|
| protocolVersion | 必填；入口适配器 | 本期 `1.0`；主版本不兼容不得执行 |
| invocationId | 必填；Host/SDK 产生 | 一次尝试；重复同 ID 不得生成第二次调用尝试 |
| traceId | 必填；最外层入口产生 | 贯穿 Host、Runtime 和 Provider |
| appId / connectionId | 必填；解析后入口绑定 | 必须匹配一个已知连接；歧义先澄清 |
| capabilityId / capabilityVersion | 必填；发现目录后确定 | 指向目录中精确版本；无静默升级 |
| input | 必填；调用者 | 通过能力输入 Schema；传空对象也应明确为 `{}` |
| source | 必填；入口运行环境绑定 | agent/script/component/scheduler/recovery 联合类型；无会话后台调用不伪造 sessionId |
| deadlineAt | 必填；入口 | 绝对截止时间；跨进程传播剩余预算，不每层重置 |
| idempotencyKey | 变更必填 | 跨重试稳定；与逻辑意图绑定，不在每次重试随机生成 |
| expectedResourceRevision | 条件必填 | 需要资源并发控制时提供；与组件 revision 分开 |

同一 idempotencyKey 的请求哈希必须包括 capabilityVersion 与规范化 input，但不包括 invocationId、traceId、deadlineAt 等尝试字段。相同键升级能力版本应视为冲突，避免同一业务意图在新语义下被偷偷重放。

### 06.3 结果规则

`ok` 必须有 data；`partial` 必须有可用 data 和 errors；`pending` 必须有 operation 与 pollAfterMs；`unknown` 必须有 operation 和 inspect_only 错误策略。`needs_clarification` 必须列出 missing 与 question，候选可以为空但不可杜撰。

结果的 `status` 是当前调用对业务结果的解释，不是 HTTP 状态。操作的 `state` 是持久状态；SDK 不得仅凭 Promise resolve 判成功。失败包络允许包含 operationRef，以便参数以外的后续错误不丢失定位信息。

输出 Schema 针对成功/部分成功 data 的具体结构；统一包络另行校验。错误详情保留原业务码，但外层 code 稳定。上游 HTTP 200 和 imported 状态不必然证明上架在售；解释由 Provider 指明。

### 06.4 低层 API 的开放方式

每个已核实 API operationId 作为能力目录中的低层条目暴露，拥有固定效果类型与输入输出描述。可从原应用 OpenAPI/SDK 自动生成，不要求为每个接口手写一个面向模型的语义工具。Agent 通过 describe 读取长尾契约，再由 SDK 或通用 invoke 调用。

不得用“全量 API 需要能调用”推导为“所有 API Schema 每次都塞给模型”；也不得用“常用工具只有几个”推导为“底层能力永久只能有几个”。未登记操作可以增加目录后使用；直接裸 URL 不自动获得本规范保证。

`API operationId` 与业务 `operationId` 分开：前者例如 `ozonProductsPricesRead`，后者例如某一次调价操作的 UUID。代码字段中低层接口应使用 `apiOperationId`，避免日志歧义。

### 06.5 完整参考类型


```ts
/**
 * DSH Apps SPEC A.0 — proposed project-owned contract, not a DSH SDK.
 * Declaration file only. No Runtime, transport, provider or persistence implementation.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] |
  { [key: string]: JsonValue };
export type JsonSchema = { [key: string]: JsonValue };
export type AppId = string;
export type ConnectionId = string;
export type CapabilityId = string;
export interface AppRef { appId: AppId; connectionId: ConnectionId; }
export interface ResourceRef extends AppRef {
  resourceType: string;
  resourceId: string;
  revision?: string;
}
export type InvocationSource =
  | { kind: 'agent'; sessionId: string; nativeCallId: string }
  | { kind: 'script'; sessionId: string; runId: string; stepKey: string }
  | { kind: 'component'; sessionId: string; viewId: string; frameInstanceId: string }
  | { kind: 'scheduler'; scheduleId: string; runId: string }
  | { kind: 'recovery'; operationId: string };
export interface InvocationRequest extends AppRef {
  protocolVersion: '1.0';
  invocationId: string;
  traceId: string;
  capabilityId: CapabilityId;
  capabilityVersion: string;
  input: JsonValue;
  source: InvocationSource;
  deadlineAt: string;
  idempotencyKey?: string;
  expectedResourceRevision?: string;
}
export interface ExecutionContext {
  request: Readonly<InvocationRequest>;
  signal: AbortSignal;
  /** Assigned and persisted before a mutation is dispatched. */
  operationId?: string;
  parentRunId?: string;
}
export type OperationState = 'queued' | 'dispatching' | 'pending' | 'unknown'
  | 'succeeded' | 'failed' | 'partial' | 'cancelled';
export interface OperationRef { operationId: string; state: OperationState; }
export type Freshness = 'fresh' | 'stale' | 'unknown';
export interface DataProvenance extends AppRef {
  sourceKind: 'application' | 'snapshot' | 'derived';
  sourceRef: string;
  fetchedAt: string;
  sourceDataTime: string | null;
  freshness: Freshness;
  metricBasis?: string;
  derivedFrom?: string[];
}
export type RetryPolicy = 'never' | 'read_retry' | 'inspect_only';
export interface FailureInfo {
  code: string;
  message: string;
  retryPolicy: RetryPolicy;
  retryAfterMs?: number;
  details?: JsonValue;
}
export interface ResultBase {
  invocationId: string;
  traceId: string;
  provenance?: DataProvenance[];
  operation?: OperationRef;
}
export type CapabilityResult<T extends JsonValue = JsonValue> = ResultBase & (
  | { status: 'ok'; data: T }
  | { status: 'partial'; data: T; errors: FailureInfo[]; unresolvedOperationIds?: string[] }
  | { status: 'pending'; operation: OperationRef; pollAfterMs: number }
  | { status: 'unknown'; operation: OperationRef; error: FailureInfo }
  | { status: 'failed' | 'unavailable'; error: FailureInfo }
  | { status: 'cancelled'; error: FailureInfo }
  | { status: 'needs_clarification'; missing: string[]; candidates: JsonValue[]; question: string }
);
export interface CapabilityDescriptor {
  capabilityId: CapabilityId;
  version: string;
  title: string;
  description: string;
  effect: 'query' | 'compute' | 'mutation';
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  execution: {
    mode: 'sync' | 'async';
    timeoutMs: number;
    concurrency: 'exclusive' | 'declared_safe';
    lockScope: 'connection' | 'resources';
    idempotency: 'not_applicable' | 'runtime_dedup' | 'upstream_supported';
    completionEvidence: 'response' | 'readback' | 'upstream_operation';
  };
  discovery: { defaultVisible: boolean; keywords: string[] };
  aliases: string[];
}
export interface AppManifest {
  manifestVersion: 1;
  appId: AppId;
  displayName: string;
  providerPackage: string;
  providerVersion: string;
  runtimeProtocolMajor: 1;
  resourceTypes: string[];
}
export interface AppProvider {
  manifest: AppManifest;
  descriptors: readonly CapabilityDescriptor[];
  execute(context: ExecutionContext): Promise<CapabilityResult>;
  /** Only inspect an existing operation; this method cannot submit a new mutation. */
  inspect?(operationId: string, context: ExecutionContext): Promise<CapabilityResult>;
  dispose(): Promise<void>;
}
export interface SessionAppBinding extends AppRef {
  sessionId: string;
  enabled: boolean;
  boundAt: string;
}
export interface DatasetBinding extends AppRef {
  bindingId: string;
  capabilityId: CapabilityId;
  capabilityMajor: number;
  input: JsonValue;
  projection: string[];
  datasetId?: string;
  refresh: { mode: 'manual' | 'scheduled'; scheduleId?: string };
}
export interface SelectionEnvelope {
  bindingId: string;
  datasetRevision: string;
  resources: ResourceRef[];
}
export interface BridgeIdentity {
  protocolVersion: '2.0';
  sessionId: string;
  viewId: string;
  buildId: string;
  frameInstanceId: string;
}
export interface BridgeRequest extends BridgeIdentity {
  requestId: string;
  method: 'getData' | 'getContext' | 'refresh' | 'attachSelection' | 'resize'
    | 'invokeCapability' | 'updateContext' | 'requestAgent';
  params: JsonValue;
}
export interface BridgeHello extends BridgeIdentity {
  supportedMethods: BridgeRequest['method'][];
  maxMessageBytes: number;
  contextRevision: number;
}
export interface DataPage<T extends JsonValue = JsonValue> {
  datasetId: string;
  revision: string;
  items: T[];
  returned: number;
  total: number | null;
  nextCursor: string | null;
  completeness: 'complete' | 'partial' | 'unknown';
}

```

## 07 传输接口与 DSH 适配

### 07.1 P1/SDK 到 P2 的拟新增 HTTP 接口

这些路由是待实现契约，不存在于当前 0.3.0 服务。不得把它们直接作为已有接口部署使用。V1 沿用现有本机连接机制，不在此重做鉴权。

| 方法与路由 | 输入/输出 | 副作用 |
|---|---|---|
| GET `/v1/runtime` | 协议主版本、实现版本、目录摘要、schemaVersion | 无业务写 |
| GET `/v1/apps` | Provider 状态和应用元数据；不伪造 DSH 安装状态 | 无业务写 |
| GET `/v1/capabilities` | appId/搜索词/cursor；返回摘要列表和下一页 | 无业务写 |
| GET `/v1/capabilities/{id}` | 精确版本；返回完整输入输出和执行声明 | 无业务写 |
| POST `/v1/invocations` | InvocationRequest → CapabilityResult | 由能力 effect 明确决定 |
| GET `/v1/operations/{id}` | 本地已记录操作与证据 | 不访问变更接口 |
| POST `/v1/operations/{id}/inspect` | 回查已存在操作 → 更新本地证据 | 只读核实远端；允许写本地回查记录 |
| POST `/v1/session-bindings` | 明确 session/app/connection/enabled | 只改接入状态 |
| POST `/v1/views/open` | 已构建源码或现有设计、绑定 | 保存草稿，不进入组件库 |
| POST `/v1/views/{id}/refresh` | 明确绑定 ID 集合 | 只刷新 query/compute，不触发业务 mutation |
| POST `/v1/components` | viewId、mode、componentId、expectedRevision | 显式保存展示资产，不改原应用业务 |

返回完整 JSON 的传输成功用 200；异步受理可用 202，但正文仍必须有 pending 操作。语法错误用 400；协议主版本不兼容用 409；Runtime 本身不可达由入口包装为 unavailable 或 unknown，依据是否可能分发业务变更决定。客户端不能只看状态码。

每个端点的请求体必须拒绝未知公共字段；Provider 原始数据字段则按该能力输出 Schema 的开放性决定，不能全局截断所有原字段。

### 07.2 DSH 原生适配边界

P1 必须复用已核实的工具注册、output schema/render、动态提示贡献、Connection 代理、Client 插槽及生命周期。新增 AppsHost 是项目自定义抽象，内部封装具体 DSH 版本差异。

动态发现可有两种明确实现：探针确认支持时使用宿主作用域/延迟能力；探针不支持时使用固定的 apps_list、apps_describe、apps_invoke、apps_inspect 等项目工具。后者不是伪装的动态 Schema 注册，应在能力矩阵中写“固定发现网关”。

若某 DSH 版本不支持正式 requestAgent/上下文持久投影，则相应 bridge 方法必须返回 UNSUPPORTED_HOST_CAPABILITY，继续提供现有 attachSelection → 用户发送路径。不得直接追加会话文件、猜测方法名或另开聊天系统代替。

### 07.3 历史兼容投影

保留旧 26 个工具名。业务类别映射到 Hallmark Provider；展示类映射到共享 PresentationService。旧调用的名称、参数解释和输出语义保持可重放；新能力可以使用新命名空间，但不能直接删掉历史解释器。

旧 bridge `hallmark.source.v1` 与新 `dsh.apps.component.v2` 并存。旧五方法适配至新运行时；只有新方法才要求 v2 握手。兼容窗口覆盖整个 V1 系列；移除旧投影必须在后续主版本提供资产/查询引用扫描和迁移报告。


## 08 生命周期、操作状态与一致性

### 08.1 应用与 Host 投影

Provider 状态为 registered、ready、degraded、stopping、stopped；Host 投影状态为 detached、attaching、attached、unsupported、failed。两组状态分别记录。一个进程发生故障不应把另一进程的状态伪装成已完成卸载。

关闭 DSH 窗口或卸载原生投影会移除 P1 新调用入口，但不等于 P2 已停止，也不撤回已发出的业务操作。P2 已配置的后台只读任务可继续运行；界面必须说明此行为。“暂停应用调用”是单独的 Runtime 控制：停止接收该连接的新调用和新调度，保留未决操作回查。只有排空后才能停止 Provider 模块。

会话中关闭一个绑定只影响该会话的新调用；不关闭其他会话、Provider 或背景调度。focusedApp 改变只更新 UI。不能让“离开页面”同时代表以上所有操作。

### 08.2 正常变更状态转移

| 当前状态 | 触发事实 | 下一状态/动作 |
|---|---|---|
| queued | 已持久化且准备发送 | 先持久化 dispatching，再进入网络调用 |
| queued | 在发送前取消，确认无外部效果 | cancelled |
| dispatching | 有同步完成证据 | succeeded / failed / partial |
| dispatching | 有受理回执，完成尚待确认 | pending |
| dispatching | 丢响应、超时或进程崩溃且无法证明未发送 | unknown；仅允许 inspect |
| pending | 只读回查确认完成 | succeeded / failed / partial |
| pending | 回查无可解释状态 | 维持 pending 或 unknown，保留理由 |
| unknown | 只读证据证明明确结果 | succeeded / failed / partial |
| unknown | 没有证据 | 维持 unknown，不产生新变更请求 |
| 已知终态 | 普通重复调用 | 读取原结果；终态不自动反转 |

partial 表示该操作已知的部分完成终态；如果仍有未决对象，必须拆为子操作并在流程结果中列出 unresolvedOperationIds。不能把尚在处理中对象藏进一个不会再恢复的 partial 终态。

### 08.3 本地幂等与外部保证

本地账本阻止同键重复分发，但不能单独保证任何外部系统的“恰好一次”。Provider 有原生幂等键时必须透传相同稳定键；没有时依赖本地去重与只读核实，并保持证据不足时的 unknown。

P1 抽取阶段允许继续委托旧 Hallmark 写入账本，但新层不得再创造独立操作 ID 和重复执行器。TODO-016 切换账本所有权时必须复用/映射旧 operationId 与 clientOperationKey；旧领域逻辑退为证据提供者，避免两套幂等状态互相判断。

### 08.4 并发和取消

默认每连接变更串行。Provider 能证明资源不冲突时可提供稳定 lock key，实现按资源串行；未提供 key 时仍按连接串行。query/compute 只有声明 declared_safe 后才可并发。

deadlineAt 与 AbortSignal 从最外层传递到 Provider。取消意味着停止新增工作并等待当前执行静止，不等于回滚已经发生的业务。进程终止时必须保存可恢复操作；强制终止不得把未决操作写成 cancelled。


## 09 标准操作程序

### PROC-CALL-01 · 执行一次能力调用

**前提：** 已取得目录版本；连接唯一；源上下文有明确定义。**输入：** InvocationRequest。**输出：** CapabilityResult 与可定位记录。

1. 入口从执行环境绑定 source 和 traceId，不把当前 UI 焦点当作连接证据。
2. Runtime 解析 appId、connectionId、精确能力版本。候选不唯一时返回澄清并停止，不访问原应用。
3. 校验输入及剩余时间预算。错误在 Provider execute 之前结束。
4. 变更先取得幂等记录；同键同请求返回现有操作，同键不同请求返回冲突。查询只需 invocation 记录。
5. Provider 调用原 API/SDK，并提交原始回执、来源与时间。
6. 按能力 completionEvidence 判断完成；需要回查则记录 pending/unknown 并调用只读 inspect。
7. Runtime 校验结果、持久化状态，输出完整数据引用和受预算限制的模型投影。

**检查：** 每次独立调用都有一个 invocationId；一个逻辑变更只有一个 operationId。**停止：** 未知结果不得重新执行第 5 步的变更调用。

### PROC-SCRIPT-01 · 执行多应用脚本

**前提：** 使用生成 SDK；脚本通过 DSH 已有命令执行器运行。**输入：** 明确连接、能力版本和资源 ID。**输出：** run 记录及步骤结果。

1. 创建 runId，为每一步分配稳定 stepKey；变更的 idempotencyKey 随该业务意图保存。
2. 在执行环境获取数据并进行筛选/关联，只把摘要和必要证据交给模型。
3. 每个 SDK 调用记录 parentRunId；不把多次变更压缩成一条不可解释脚本日志。
4. 后续步骤失败时停止依赖步骤，返回已成功、失败和未运行步骤。
5. 恢复时只处理未完成步骤；有 unknown 的步骤先 inspect。补偿必须是独立明确能力，生成新的记录。

**停止：** 不把“脚本退出非零”解释为所有业务都未发生。**检查：** 已成功的 Notes 写入在脚本失败后仍可查，且不被重复创建。

### PROC-VIEW-01 · 创建与保存源码组件

**前提：** 有设计需求、绑定和可用 Node 构建环境。**输入：** 普通源码工程。**输出：** buildId、viewId；显式保存后才有 componentId/revision。

1. Agent 创建或复制工程，编辑 TSX/CSS 与依赖；模板只是起点。
2. 使用 DSH 已有文件与命令工具构建。编译失败时停止登记，不覆盖旧构建。
3. 预览相同 dist，记录截图、错误和至少一条交互证据；静态截图不能替代交互检查。
4. 登记源码、锁文件、资源和 dist，生成不可变 buildId；打开或更新指定 viewId。
5. 用户要求保存时提供 mode。更新已有组件必须带打开时的 expectedRevision；冲突时重新打开或另存为，不静默覆盖。
6. 从历史版本恢复时创建工作副本；再次保存生成新 revision，历史不被改写。

**检查：** 登记草稿可以落盘恢复，但未自动进入组件库。**停止：** 构建缺资源、版本冲突或绑定未解析时保留旧可用视图。

### PROC-UI-01 · 组件与 Agent 交互

**前提：** 完成 bridge 握手，方法在 supportedMethods 中。**输入：** 当前 frame 身份与参数。

1. 排序、选择和显示切换在本地执行，不产生模型请求。
2. 业务动作通过 invokeCapability 进入 PROC-CALL-01；按钮显示 pending/unknown，而非仅“请求成功”。
3. updateContext 更新宿主结构化状态并增加 contextRevision，不唤醒 Agent。
4. requestAgent 经正式 DSH 输入路径提交。取得提交回执后显示 submitted；仅添加附件成功只能显示 attached。
5. 上下文真正被模型消费时，必须能够从 DSH 正式持久记录/投影恢复当时版本。

**降级：** 方法未验证或不受支持时返回 UNSUPPORTED_HOST_CAPABILITY，保留“附加到输入框后由用户发送”。不得直接编辑会话日志。

### PROC-REFRESH-01 · 刷新多应用绑定

1. 对每个绑定解析 app/connection/capability/version/input，不从页面焦点补全。
2. 只允许 query/compute 作为刷新；效果类型不同则拒绝绑定。
3. 每个数据集独立获取结果，原子更新该数据集 payload 与 revision。
4. 一个绑定失败时保留其最后成功 payload 和时间，其余绑定可成功更新。
5. 任一选择引用旧 revision 时要求重新选择，不自动按行号迁移。

**检查：** UI 分别显示各绑定的状态。禁止用一次整体刷新成功掩盖其中某个应用失败。


## 10 数据模型与文件布局

### 10.1 目标布局

V1 使用显式配置的目标目录，数据库名为 `apps.db`。目标目录可以与原配置目录相同或不同，迁移程序必须由参数确定，不能从原开发机路径推测。

```text
<apps-data-dir>/
  apps.db                       # 目标 schemaVersion 3
  builds/<buildId>/              # 不可变源码、dist、manifest
  datasets/<datasetId>/          # 过大 payload 与版本文件
  logs/                         # 可定位运行日志
  migration/<migrationId>/       # 映射、计数、校验与切换证据
  backups/<backupId>/            # 一致备份 manifest 与实际资产
```

### 10.2 表与不变量

| 对象 | 主身份 | 必须保持的不变量 |
|---|---|---|
| connections | appId + connectionId | 连接名称和配置版本改变不改变身份 |
| session_app_bindings | sessionId + appId + connectionId | 同会话允许多行；focusedApp 不存成唯一能力绑定 |
| invocations | invocationId | 一次尝试唯一；source 的后台分支不伪造 session |
| operations | operationId + 组合幂等唯一索引 | 先落账再分发；相同键不同请求冲突 |
| invocation_operations | invocationId → operationId | 多次尝试可指向同一逻辑操作 |
| operation_events | operationId + sequence | 追加状态/证据，不抹去历史分发事实 |
| runs / run_steps | runId；runId + stepKey | 子调用关联完整；步骤序号唯一 |
| datasets | datasetId | 标识由规范化绑定生成；revision 表达内容/快照版本 |
| builds | buildId | manifest 文件列表及 SHA256 可核实；内容不可变 |
| views | viewId | ownerSessionId 可为空的历史孤儿不能自动认领 |
| components / component_versions | componentId；componentId + revision | latestRevision 更新与新增版本必须同事务 CAS |
| saved_assets | kind + assetId | 模板与入口分型保存，不覆盖同名不同 kind |
| provider_records | app/connection/namespace/recordId | 领域状态不泄漏为公共列假设 |
| legacy_aliases | legacyKind + legacyId | 映射可追溯；无法解析则 needs_migration |
| artifact_refs | owner/target 组合 | 删除前核对引用；临时清理不删除保存版本资产 |

`schemas/proposed-runtime-schema.sql` 提供可执行的空库 DDL，用于实现和测试起点；它不是 v2 迁移脚本，不得直接应用到原 app.db。合法状态转移需要 Runtime 事务代码校验，SQL 的 CHECK 只能校验枚举取值，不能独自保证状态机。

### 10.3 数据集身份

构造 canonicalBinding：`{protocolMajor, appId, connectionId, capabilityId, capabilityMajor, input, projection}`。递归排序对象键，数组保序；UTF-8 编码后计算 SHA256，形成 `dataset:v1:<hex>`。存储完整 canonicalBinding 以便检查哈希相同但内容异常的情况。内容 revision 与 datasetId 分开，刷新相同查询不改变查询身份。

默认 freshness 不能仅由文件修改时间推出。Provider 明确源时间/TTL 才可标 fresh；无源时间且仅有获取时间时为 unknown，仍展示 fetchedAt。手动刷新失败应标 stale/failed 并保留 lastSuccessAt，不用失败时刻冒充源数据时刻。

### 10.4 文件与垃圾清理

构建存档必须包含源码、资源、依赖锁文件和 dist；不要求将 node_modules 打包成每个组件版本。manifest 必须枚举相对路径、大小和 SHA256。文件路径归一化不改变内容身份。

用户保存组件及其历史版本默认不自动过期。临时无引用草稿与 spill 的初始建议保留期为 7 天；只读 GC dry-run 必须先列出候选、占用字节和保留原因，再允许显式清理。未决操作与迁移证据不得随临时文件策略删除。


## 11 v2 迁移、切换与回退

### 11.1 旧数据逐项映射

| 现有集合/文件 | 目标 | 必须核实的内容 |
|---|---|---|
| session_apps | session_app_bindings | 原会话身份；明确 Hallmark 连接；关闭意图已应用 |
| operations | invocations + operations + events + aliases | 保留旧 operationId/clientKey/远端引用；不能自动重发 |
| snapshots | datasets | 旧 datasetKey 到新规范身份映射；源时间、旧 payload、失败状态 |
| internal_tasks | provider_records 的 hallmark 命名空间 | 店铺、用途与 taskId 原样保留 |
| result_sets | datasets 或带过期信息的 Provider 记录 | 原 24h 等时效语义和来源，不永久冒充实时数据 |
| queries | DatasetBinding / aliases | 旧工具名是否已映射；参数与 capability 主版本 |
| views | views | 草稿归属；source-draft/component-draft；孤儿不可认领 |
| components | components + component_versions | revision、构建引用与 CAS 基础版本 |
| templates / entries | saved_assets | 源码模板与只读入口分别保留 |
| settings 中历史 source-revision | component_versions | 历史引用完整，不只迁当前版本 |
| 其他 settings | provider_records / 隔离 legacy 记录 | 不执行未知内容；逐键报告 |
| source-components 构建目录与缩略图 | builds 与 manifest | 文件存在、哈希、相对路径、所有引用可解析 |
| Host close-outbox 等恢复文件 | 显式恢复/迁移记录 | 未确认的关闭意图不得在迁移后变成 active=true |

现有备份命令输出 JSON，不应未经核实就当作源码构建、数据文件与全部恢复状态的完整备份。[SRC-01] 新迁移备份必须覆盖数据库一致快照和所引用资产。SQLite WAL 模式下不得只复制打开中的主 db 文件并假装一致；使用停写后的备份接口或一致快照方式。

### PROC-MIG-01 · 首次切换

**进入条件：** G0 至 G4 已通过；目标路径和连接映射已确定；备份存储可用；真实业务变更测试有明确范围。

1. 停止旧入口接收新业务调用与新调度，排空正在执行的请求。
2. 列出所有 pending/unknown。能回查的进行只读回查；不能确定的保留原标识并标记未决，不靠重发清空列表。
3. 生成一致数据库备份、资产清单、配置映射和 SHA256；验证备份能够在隔离目录打开。
4. 对副本执行迁移 dry-run。逐表比较总数、转换数、隔离数和目标引用；未知连接或工具引用为 needs_migration。
5. 运行旧 26 工具、旧 bridge、保存组件、两会话和两应用的只读冒烟测试。
6. 核实只有新 Runtime 将获得写入口；停止旧服务写入口后切换数据库路径与插件/服务版本组合。
7. 在新系统验证读取与明确范围测试；记录 cutoverAt、包版本、数据版本和备份 ID。

**中止条件：** 任何无法解释的记录丢失、文件缺失、目标库错误、双写或已应答操作缺少映射。中止时保持旧备份与证据，不覆盖源库。

### PROC-RBK-01 · 发布回退

**首先判断：** 新系统切换后是否产生过业务 mutation 或用户已确认的资产保存？不是只看数据库文件是否变化。

**分支 A：没有新业务/资产写入。** 冻结新入口，核实操作记录为空增量，停止新服务，恢复已验证的旧代码和旧状态副本，重新验证只读能力，再开放入口。

**分支 B：已经有新写入。** 冻结新入口，导出所有切换后操作、组件与绑定增量；回查未决业务结果；优先选择能够读取当前新 schema 的兼容代码回退。只有完成可验证的增量迁移后才允许旧数据格式接管。不能简单恢复旧 app.db 丢弃增量。

**两分支共同规则：** 回退软件不等于撤销外部业务。需要反向操作时必须通过应用显式能力另立记录；没有通用回滚承诺。没有充分证据时维持冻结而不是冒险恢复旧写入。


## 12 异常处置卡

每张卡按“识别 → 立即动作 → 核实 → 恢复条件”执行。错误显示应附 traceId；存在 operationId 时也必须显示。

| 卡号 / 错误 | 立即动作 | 恢复条件 |
|---|---|---|
| ABN-01 `APP_SERVICE_UNAVAILABLE` | 区分发送前失败与发送后失联；查询保留旧数据，变更不得自动重发 | Runtime 恢复且原调用结果已解释 |
| ABN-02 `OUTCOME_UNKNOWN` | 保存原操作 ID；只读 inspect；停止依赖其成功的后续步骤 | 有明确外部证据；否则维持 unknown |
| ABN-03 `INCOMPATIBLE_PROTOCOL` | 在分发前停止；记录期望/实际版本 | 安装兼容组合并重新握手 |
| ABN-04 `REVISION_CONFLICT` | 不覆盖；保留本地草稿 | 重新打开最新版本合并，或显式另存为 |
| ABN-05 `SELECTION_STALE` | 清晰提示数据已更新，不按行号重新配对象 | 从当前 revision 重新选择 |
| ABN-06 `UNSUPPORTED_HOST_CAPABILITY` | 关闭对应方法；保留已有可用路径 | 本机探针确认支持并发布适配器 |
| ABN-07 `IDEMPOTENCY_CONFLICT` | 零新分发，展示冲突键与原操作 | 解释是同一意图参数错误还是全新意图，明确新意图才用新键 |
| ABN-08 `OUTPUT_SCHEMA_INVALID` | 保存原始诊断；不投影成功 | 修复 Provider/契约并验证旧结果解释 |
| ABN-09 `MIGRATION_UNRESOLVED` | 停止切换，列出具体记录 | 连接/工具/资产映射有证据且 dry-run 通过 |
| ABN-10 `RESOURCE_UNRESOLVED` | 不自动用名称相似对象替代 | 提供稳定资源 ID 或人工确认映射 |
| ABN-11 `SOURCE_BUILD_NOT_FOUND` | 不刷新成空白成功；保留组件元数据 | 从一致备份恢复构建并校验 manifest |
| ABN-12 `CAPABILITY_NOT_FOUND` | 刷新目录并报告缺失版本，零业务分发 | Provider 提供兼容能力或完成显式版本迁移 |

ABN-01 与 ABN-02 的判断依据是分发证据，不是“这是本机服务”。本机超时同样可能发生在外部业务已提交之后。


## 13 初始运行预算与可观测性

以下数值是目标初始配置，不是当前实测性能。Provider 可在经测试的描述中声明不同超时，但 Host/Runtime 必须传递同一绝对 deadline，不每层重新计时。

| 配置 | V1 初始值 | 规则 |
|---|---|---|
| modelContentBudgetBytes | 16384 | UTF-8 文本上限；大结果使用句柄或分页 |
| publicRequestMaxBytes | 1048576 | 过大输入用文件/资源引用，不默默截断 |
| queryTimeoutMs | 30000 | 超时可按只读策略恢复，不改成业务 failed |
| mutationSubmitTimeoutMs | 75000 | 未获得完成证据时 pending/unknown；不重发 |
| nativeToolTimeoutMs | 90000 | 与现有 Host 量级一致；必须实际传取消 |
| bridgeTimeoutMs | 30000 | 只限桥接等待；超时不表示后台操作撤销 |
| safeReadConcurrencyPerConnection | 4 | 仅 declared_safe；其余为 1 |
| mutationConcurrencyPerLock | 1 | 默认连接锁，Provider 可声明资源锁 |
| readRetryAttempts | 2 次总尝试 | 仅显式 read_retry；遵守可接受 retryAfter，否则返回调用方 |
| temporaryUnreferencedRetentionDays | 7 | 仅临时无引用文件；用户保存资产不自动过期 |

日志必须区分 received、validated、dispatch_intent、upstream_receipt、inspect、settled。operation_events 与结果用于恢复；普通文本日志仅用于诊断，不能作为唯一恢复数据库。

性能基准固定记录 OS、Node、DSH 版本、CPU/内存、数据规模和网络条件。P50/P95 由至少 30 次同任务样本产生。真实模型 token 无法获取时记录 UTF-8 字节并标明不是 token，不用猜测换算。

强制预算门禁是模型输出不超上限、未选能力不全量注入、请求没有重复业务变更。端到端 P95 的绝对数值在 TODO-018 首次建立项目基线，本版不编造延迟承诺。


## 14 兼容、发布与未决项处理

发布清单必须分别列出：bundleVersion、hostProjectionVersion、runtimeVersion、transportMajor、bridgeMajor、catalogSchemaVersion、databaseSchemaVersion 和每个 capabilityVersion。一个 UI 补丁不应自动意味着数据库升级；数据库升级也不能靠整体包版本猜出兼容性。

已安装版本、已启用版本和当前运行版本必须有独立证据。官方安装器要求重启时，只有重启后运行时握手返回版本正确才能完成验收。[SRC-01]

本版没有保留“架构任选项”：V1 进程、职责、调用入口与迁移方式已经固定。真正待核实的是外部能力：DSH 动态 Schema、正式 Agent 消息/上下文接口以及 Hallmark 长尾接口的真实完整性。默认处置均为禁用受影响新增特性或明确 unavailable，不以开发者自由发挥补齐。

缺失真实后端验收不妨碍形成设计文档，但必须阻止相应能力被宣称“真实业务已通过”。G5 可以形成带已知限制的候选包；正式范围中强制业务用例未通过时，不得发布为完整验收版。


## 15 验证手册

测试初始状态均为 **NOT_RUN**。下列是执行程序与断言，不是已获得结果。默认为合成夹具/隔离库；涉及真实业务时必须另外登记目标连接、范围与回执，不能用假数据代替。每项证据包含环境、输入、执行日志、断言和结果状态。

### TST-001 · 不修改 DSH 核心

**覆盖：** REQ-001。**初始状态：** NOT_RUN。

**准备与动作：** 安装测试 bundle；运行查询、展示和卸载；对安装前后 DSH 核心文件清单做哈希比较。

**通过标准：** 核心文件哈希不变；任务使用原会话；卸载无残留注册。

**证据：** `evidence/<releaseId>/tests/TST-001/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-002 · 一个外壳与 N 个接入

**覆盖：** REQ-002。**初始状态：** NOT_RUN。

**准备与动作：** 增加 notes Provider 和 plugin-notes，仅修改新增包与分发清单；检查公共代码 diff。

**通过标准：** 公共源代码无 notes 分支；目录出现两个应用；仍只有一个 Apps 入口。

**证据：** `evidence/<releaseId>/tests/TST-002/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-003 · 一个业务事实来源

**覆盖：** REQ-003。**初始状态：** NOT_RUN。

**准备与动作：** 断开 Hallmark 后端；打开已有快照并执行刷新。

**通过标准：** 快照可读且明确 stale/时间；刷新报 unavailable；原业务库没有被替代写入。

**证据：** `evidence/<releaseId>/tests/TST-003/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-004 · 一个能力执行实现

**覆盖：** REQ-004。**初始状态：** NOT_RUN。

**准备与动作：** 为同一能力分别通过三种调用入口运行等价输入，记录各自独立 invocationId 和 Provider spy。

**通过标准：** 每次独立调用 Provider 恰为一次；三入口的结果包络和错误语义一致。

**证据：** `evidence/<releaseId>/tests/TST-004/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-005 · 唯一运行时目录

**覆盖：** REQ-005。**初始状态：** NOT_RUN。

**准备与动作：** Provider 注册 v1；Host 拉取；再加入一个能力并刷新目录。

**通过标准：** Host 由目录生成新投影；catalogDigest 改变；不存在手工同步的第二份 Schema。

**证据：** `evidence/<releaseId>/tests/TST-005/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-006 · 生命周期与卸载

**覆盖：** REQ-006。**初始状态：** NOT_RUN。

**准备与动作：** 挂载并卸载同一应用 10 次；同时保留一个 pending 操作和一个保存组件。

**通过标准：** 无重复工具和事件监听；组件仍存在；操作可由 Runtime 回查。

**证据：** `evidence/<releaseId>/tests/TST-006/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-007 · 连接独立于应用

**覆盖：** REQ-007。**初始状态：** NOT_RUN。

**准备与动作：** 创建两个 Hallmark 后端连接，其中一个含两店；查询每一组合。

**通过标准：** 请求只到指定连接；店铺按输入解析；不复制插件或混淆两类标识。

**证据：** `evidence/<releaseId>/tests/TST-007/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-008 · 会话应用集合与焦点分离

**覆盖：** REQ-008。**初始状态：** NOT_RUN。

**准备与动作：** 同一会话启用 Hallmark 与 Notes，切换界面焦点；另一会话保持空绑定。

**通过标准：** 原会话仍能调用两应用；另一会话未获得隐式绑定。

**证据：** `evidence/<releaseId>/tests/TST-008/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-009 · 显式路由与歧义处理

**覆盖：** REQ-009。**初始状态：** NOT_RUN。

**准备与动作：** 同名连接两个，省略 connectionId；再用完整 ID 重试只读调用。

**通过标准：** 首个请求零下游分发并返回候选；完整 ID 请求仅命中一个连接。

**证据：** `evidence/<releaseId>/tests/TST-009/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-010 · 按需工具发现

**覆盖：** REQ-010。**初始状态：** NOT_RUN。

**准备与动作：** 构造 20 应用各 50 能力，组装模型输入；读取实际发送的 Schema 记录。

**通过标准：** 完整 1000 能力 Schema 未整体注入；加载工作集可追踪；未支持路径显式降级。

**证据：** `evidence/<releaseId>/tests/TST-010/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-011 · 兼容性握手

**覆盖：** REQ-011。**初始状态：** NOT_RUN。

**准备与动作：** 分别运行兼容新增能力和不兼容 transportMajor 的服务夹具。

**通过标准：** 前者目录刷新成功；后者在 Provider 分发前停止并显示期望/实际版本。

**证据：** `evidence/<releaseId>/tests/TST-011/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-012 · 输入输出同时声明

**覆盖：** REQ-012。**初始状态：** NOT_RUN。

**准备与动作：** 提交缺输出 Schema 的 Provider，再返回一个结构错误的成功值。

**通过标准：** 注册失败或 OUTPUT_SCHEMA_INVALID；错误包含字段路径；模型不见伪成功。

**证据：** `evidence/<releaseId>/tests/TST-012/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-013 · 底层 API 不是第二套业务

**覆盖：** REQ-013。**初始状态：** NOT_RUN。

**准备与动作：** 对未做语义工具的已登记 operationId 调用一次，检查执行入口与日志。

**通过标准：** 无需新增语义工具即可调用；仍生成 invocationId 和正确来源/结果状态。

**证据：** `evidence/<releaseId>/tests/TST-013/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-014 · 未知写接口显式分类

**覆盖：** REQ-014。**初始状态：** NOT_RUN。

**准备与动作：** 发起未登记 operationId，再注册具备 mutation 分类和回查规则的条目。

**通过标准：** 未登记请求为 CAPABILITY_NOT_FOUND；登记后沿统一写入链路执行。

**证据：** `evidence/<releaseId>/tests/TST-014/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-015 · 生成 SDK 与调用语义

**覆盖：** REQ-015。**初始状态：** NOT_RUN。

**准备与动作：** 修改一个输出字段并重新生成；对 SDK 注入 unknown 返回。

**通过标准：** 类型/文档/工具投影同步变化；调用方必须处理 unknown，Provider 未再次执行。

**证据：** `evidence/<releaseId>/tests/TST-015/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-016 · 数据来源时间口径

**覆盖：** REQ-016。**初始状态：** NOT_RUN。

**准备与动作：** 源夹具缺时间、缺成本，缓存刷新时间为已知。

**通过标准：** sourceDataTime=null；缺成本单列；标题及结果未使用实际结算净利润。

**证据：** `evidence/<releaseId>/tests/TST-016/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-017 · 幂等身份与请求哈希

**覆盖：** REQ-017。**初始状态：** NOT_RUN。

**准备与动作：** 相同键相同内容并发 20 次，再以同键改变价格。

**通过标准：** 仅一次业务分发；并发获得同一 operationId；改变价格请求冲突且零新分发。

**证据：** `evidence/<releaseId>/tests/TST-017/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-018 · 状态与业务核实

**覆盖：** REQ-018。**初始状态：** NOT_RUN。

**准备与动作：** 模拟平台已接受但响应丢失；重启 Runtime 并恢复。

**通过标准：** 操作先 unknown；仅执行 inspect；确认完成后 succeeded，原变更端点总调用数为一。

**证据：** `evidence/<releaseId>/tests/TST-018/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-019 · 取消不等于撤销

**覆盖：** REQ-019。**初始状态：** NOT_RUN。

**准备与动作：** 在排队前和发出后两个位置触发取消，记录外部请求计数。

**通过标准：** 前者外部请求为零；后者不声称业务撤回；子调用不再增加。

**证据：** `evidence/<releaseId>/tests/TST-019/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-020 · 并发与冲突域

**覆盖：** REQ-020。**初始状态：** NOT_RUN。

**准备与动作：** 同一商品两次变更与无关只读并发；两个草稿同时保存相同基础版本。

**通过标准：** 冲突域内按序；无关读取按声明执行；仅一个保存成功，另一个 REVISION_CONFLICT。

**证据：** `evidence/<releaseId>/tests/TST-020/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-021 · 脚本子调用日志

**覆盖：** REQ-021。**初始状态：** NOT_RUN。

**准备与动作：** 脚本先完成 Hallmark 查询和 Notes 写入，再制造计算异常。

**通过标准：** run=failed/partial 可定位；Notes 完成记录仍在；恢复未重放已完成写入。

**证据：** `evidence/<releaseId>/tests/TST-021/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-022 · 跨应用不假装事务

**覆盖：** REQ-022。**初始状态：** NOT_RUN。

**准备与动作：** Hallmark 动作成功后 Notes 写入失败，调用恢复流程。

**通过标准：** 结果为 partial 并列出步骤；只恢复未完成步骤；没有自动反向 Hallmark 变更。

**证据：** `evidence/<releaseId>/tests/TST-022/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-023 · 模型预算与数据句柄

**覆盖：** REQ-023。**初始状态：** NOT_RUN。

**准备与动作：** 返回 1 MiB 夹具，分页获取第二页，并使 spill 写入失败。

**通过标准：** 模型响应受预算限制；完整结果可查；spill 失败给明确错误/更小分页提示，不转无限文本。

**证据：** `evidence/<releaseId>/tests/TST-023/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-024 · 稳定错误契约

**覆盖：** REQ-024。**初始状态：** NOT_RUN。

**准备与动作：** 分别制造参数错误、读超时、变更响应丢失。

**通过标准：** 结果依次为 failed/never、unavailable/read_retry、unknown/inspect_only。

**证据：** `evidence/<releaseId>/tests/TST-024/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-025 · 普通源码为主路径

**覆盖：** REQ-025。**初始状态：** NOT_RUN。

**准备与动作：** 从空模板创建带自定义状态的组件，再构建并登记。

**通过标准：** 不依赖七类固定控件即可展示；构建错误不覆盖旧可用版本。

**证据：** `evidence/<releaseId>/tests/TST-025/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-026 · 构建与保存分离

**覆盖：** REQ-026。**初始状态：** NOT_RUN。

**准备与动作：** 构建 A、打开两 view、更新其中一 view 到 B，再显式保存。

**通过标准：** A 构建仍可读；另一 view 未被覆盖；只有保存步骤生成组件版本。

**证据：** `evidence/<releaseId>/tests/TST-026/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-027 · 桥接握手与协议

**覆盖：** REQ-027。**初始状态：** NOT_RUN。

**准备与动作：** 加载 frame A 后切换构建 B，再送回 A 的延迟 refresh 回复。

**通过标准：** 旧回复被丢弃；新 frame 数据与当前 buildId 匹配；未知主版本被拒绝。

**证据：** `evidence/<releaseId>/tests/TST-027/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-028 · 通用资源选择

**覆盖：** REQ-028。**初始状态：** NOT_RUN。

**准备与动作：** 分别选择 Note 与商品；刷新数据后提交旧 revision 的选择。

**通过标准：** 两种资源均可表示；旧选择返回 SELECTION_STALE，未静默映射到新行。

**证据：** `evidence/<releaseId>/tests/TST-028/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-029 · 本地动作不经过模型

**覆盖：** REQ-029。**初始状态：** NOT_RUN。

**准备与动作：** 连续排序/选中 100 次，再触发一次能力按钮。

**通过标准：** 本地交互模型请求数为零；能力按钮产生一次 invocation。

**证据：** `evidence/<releaseId>/tests/TST-029/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-030 · 上下文与消息分开

**覆盖：** REQ-030。**初始状态：** NOT_RUN。

**准备与动作：** 更新选择上下文后观察请求计数，再执行 requestAgent。

**通过标准：** 前者不新增模型步；后者产生可重放的原生会话输入或明确 UNSUPPORTED_HOST_CAPABILITY。

**证据：** `evidence/<releaseId>/tests/TST-030/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-031 · 确定性会话投影

**覆盖：** REQ-031。**初始状态：** NOT_RUN。

**准备与动作：** 上下文被模型消费后重启并重放该模型步；比较归一化输入。

**通过标准：** 消费时的 revision 与数据引用可重建；后续 UI 状态未篡改历史输入。

**证据：** `evidence/<releaseId>/tests/TST-031/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-032 · 多应用绑定

**覆盖：** REQ-032。**初始状态：** NOT_RUN。

**准备与动作：** 商品绑定成功、成本绑定失败、笔记绑定成功；含一个无精确映射对象。

**通过标准：** 可用区域继续显示；失败区域独立报错；未映射对象标记 unresolved，不按名称猜配。

**证据：** `evidence/<releaseId>/tests/TST-032/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-033 · 离线与版本冲突

**覆盖：** REQ-033。**初始状态：** NOT_RUN。

**准备与动作：** 断网打开组件并刷新；同时保存冲突；将历史版本另存为新 revision。

**通过标准：** 设计可打开，数据明确 stale；冲突不覆盖；历史版本仍存在。

**证据：** `evidence/<releaseId>/tests/TST-033/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-034 · 明确状态所有者

**覆盖：** REQ-034。**初始状态：** NOT_RUN。

**准备与动作：** 静态检查跨层依赖并运行所有入口的存储 spy。

**通过标准：** 只有 Runtime 存储接口提交共享写；Host/浏览器无直接数据库访问。

**证据：** `evidence/<releaseId>/tests/TST-034/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-035 · 确定性数据集身份

**覆盖：** REQ-035。**初始状态：** NOT_RUN。

**准备与动作：** 改变对象键顺序、数组顺序、连接和能力主版本分别生成键。

**通过标准：** 仅对象键重排仍同键；其他语义变化不同键；存储保留完整规范输入以核对哈希。

**证据：** `evidence/<releaseId>/tests/TST-035/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-036 · 历史数据可追溯迁移

**覆盖：** REQ-036。**初始状态：** NOT_RUN。

**准备与动作：** 迁移正常库、含孤儿 view 的库和未知工具引用库。

**通过标准：** 原库不变；可解析记录有映射；孤儿不被自动认领；异常在报告中逐项列出。

**证据：** `evidence/<releaseId>/tests/TST-036/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-037 · 禁止双写切换

**覆盖：** REQ-037。**初始状态：** NOT_RUN。

**准备与动作：** 暂停旧服务执行切换脚本，故意尝试双启动和错误数据库路径。

**通过标准：** 第二写入者被拒绝；切换检查失败不开放入口；已应答数据未遗失。

**证据：** `evidence/<releaseId>/tests/TST-037/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-038 · 有条件回退

**覆盖：** REQ-038。**初始状态：** NOT_RUN。

**准备与动作：** 切换后产生一成功变更和一 unknown，再触发回退演练。

**通过标准：** 流程阻止盲目旧库写入；两条操作仍可追踪；回退结论附校验记录。

**证据：** `evidence/<releaseId>/tests/TST-038/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-039 · 引用驱动清理

**覆盖：** REQ-039。**初始状态：** NOT_RUN。

**准备与动作：** 构建 A 被保存组件引用，B 仅未引用草稿；执行清理 dry-run。

**通过标准：** A 不在删除计划；B 只有满足保留条件才可删除；计划含字节数和引用原因。

**证据：** `evidence/<releaseId>/tests/TST-039/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-040 · 保留旧工具与协议入口

**覆盖：** REQ-040。**初始状态：** NOT_RUN。

**准备与动作：** 用基线工具清单与旧构建夹具调用新版本。

**通过标准：** 26 名称覆盖完整；结果语义不退化；hallmark.source.v1 仍能读取和附加选择。

**证据：** `evidence/<releaseId>/tests/TST-040/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-041 · DSH 兼容探针

**覆盖：** REQ-041。**初始状态：** NOT_RUN。

**准备与动作：** 在支持与不支持 requestAgent/动态 Schema 的两个 Host 夹具运行探针。

**通过标准：** 功能矩阵准确；不支持项返回固定错误并显示可用替代路径。

**证据：** `evidence/<releaseId>/tests/TST-041/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-042 · 统一分发但独立版本

**覆盖：** REQ-042。**初始状态：** NOT_RUN。

**准备与动作：** 检查产物清单并安装；修改仅 UI 补丁后比对各版本域。

**通过标准：** 无每应用一进程要求；版本字段可分别解释；安装器仍为 DSH 官方管理机制。

**证据：** `evidence/<releaseId>/tests/TST-042/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-043 · 异构应用验证

**覆盖：** REQ-043。**初始状态：** NOT_RUN。

**准备与动作：** 以 Hallmark+Notes 完成组合展示和写笔记任务。

**通过标准：** 两种领域正常工作；通用层无 storeId/productId 分支；无需改 Hallmark 源文件。

**证据：** `evidence/<releaseId>/tests/TST-043/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-044 · 可定位观测记录

**覆盖：** REQ-044。**初始状态：** NOT_RUN。

**准备与动作：** 制造 API 失败，从 UI 诊断标识查 Runtime 与 Provider 记录。

**通过标准：** 可定位到同一次调用；包含分发/结果证据；没有仅写 unknown error 的不可定位日志。

**证据：** `evidence/<releaseId>/tests/TST-044/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-045 · 自动化故障矩阵

**覆盖：** REQ-045。**初始状态：** NOT_RUN。

**准备与动作：** 执行 TST-011/017/018/019/027/033/038 组合故障套件。

**通过标准：** 全部强制断言通过；失败项阻止候选版通过 G5。

**证据：** `evidence/<releaseId>/tests/TST-045/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-046 · 性能与上下文基准

**覆盖：** REQ-046。**初始状态：** NOT_RUN。

**准备与动作：** 固定 1000 能力、10000 行和 30 次只读流程测试；记录环境与原始数据。

**通过标准：** 报告原始样本和分位数；无未经测量的提速承诺；预算硬限制通过。

**证据：** `evidence/<releaseId>/tests/TST-046/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-047 · 可复现交付证据

**覆盖：** REQ-047。**初始状态：** NOT_RUN。

**准备与动作：** 检查 traceability.csv 与一次候选发布证据目录。

**通过标准：** 48 个需求无遗漏；未运行测试保留 NOT_RUN；真实业务验收缺口明确。

**证据：** `evidence/<releaseId>/tests/TST-047/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


### TST-048 · 不扩张本期目标

**覆盖：** REQ-048。**初始状态：** NOT_RUN。

**准备与动作：** 审查 PR 目录和变更记录；插入一个未批准的流程引擎模块夹具。

**通过标准：** 越界变更被评审标为 scope_change；未纳入 V1 放行声明。

**证据：** `evidence/<releaseId>/tests/TST-048/result.json`，并附输入夹具和请求计数/日志。验证人必须记录 PASS、FAIL、BLOCKED 或 NOT_RUN；不支持的强制项使用 BLOCKED，不能写 N/A 后放行。


## 16 评审与放行记录模板

| 项目 | 待填内容 |
|---|---|
| releaseId / commit | ______ |
| 本机 DSH / Node / Runtime 版本 | ______ |
| G0/G1/G2/G3/G4/G5 | 每项 PASS/FAIL/BLOCKED，证据路径与验证者 |
| 48 项需求追踪 | 未覆盖项必须为 0；未执行真实验收单列 |
| 未决操作数量与处置 | ______ |
| 备份 ID / 迁移 ID | ______ |
| 可用回退分支 | PROC-RBK-01 A 或 B；不得不判断直接恢复旧库 |
| 发布限制 | ______ |
| 架构 / 验证 / 发布签认 | 姓名与时间；不得由文档生成器代签 |


## 90 参考资料与证据边界

以下仓库资料均按基线提交固定。引用只证明所读源码或文档中的事实；不证明当前本机安装、真实接口在线或业务修改已验收。

### SRC-01 · 仓库基线及交付边界
`README.md`

已有版本、源码组件交付记录及未完成验收；历史测试结果不是本次重跑结果。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/README.md)

### SRC-02 · 工具与结果契约
`packages/contracts/src/index.ts`

26 个 define 条目；现有结果状态、hallmark_* 名称、输入 Schema。README 的 25 工具为历史口径，本规范以此文件清单为迁移依据。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/contracts/src/index.ts)

### SRC-03 · DSH Host 接入
`packages/dsh-plugin/server/index.ts`

工具注册、动态指令、生命周期、工具目录一致性检查。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/dsh-plugin/server/index.ts)

### SRC-04 · Host 结构类型
`packages/dsh-plugin/server/types.ts`

来自 0.2.0-rc.2 Inspect 的本地结构声明；不能当作新接口已获支持的证据。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/dsh-plugin/server/types.ts)

### SRC-05 · 应用目录
`packages/dsh-plugin/client/registry.ts`

静态 APPLICATIONS 与 Hallmark 判断。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/dsh-plugin/client/registry.ts)

### SRC-06 · 业务与会话分发
`packages/core/src/index.ts`

业务动作和通用组件动作混合分发。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/core/src/index.ts)

### SRC-07 · 单应用状态与领域类型
`packages/core/src/types.ts`

sessionId 单键、Hallmark 领域对象、参考利润解释。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/core/src/types.ts)

### SRC-08 · 服务进程及路由
`packages/service/src/main.ts`

独立进程组装、操作恢复和调度；路由另见 packages/service/src/server.ts。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/service/src/main.ts)

### SRC-09 · SQLite 状态
`packages/store/index.ts`

SCHEMA_VERSION=2、现有集合、幂等键索引和快照保留。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/store/index.ts)

### SRC-10 · 源码组件协议
`packages/component-runtime/src/client.ts`

现有五种桥接方法及商品专属选择类型。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/component-runtime/src/client.ts)

### SRC-11 · 展示与版本
`packages/presentation/src/index.ts`

源码/构建归档、草稿和组件保存；绑定限制另见 validation.ts。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/presentation/src/index.ts)

### SRC-12 · Agent 与组件交互
`docs/agent-component-interaction.md`

代码编译、登记构建、勾选与提交消息的实际区分。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/docs/agent-component-interaction.md)

### SRC-13 · 原生接入决策
`docs/decisions/0001-接入决策.md`

原生优先、实际运行时契约核实要求。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/docs/decisions/0001-接入决策.md)

### SRC-14 · 模型结果预算
`packages/dsh-plugin/server/render.ts`

完整值与模型内容分离、默认 16384 字节预算和文件引用。

[基线源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/cb871b4086508988485dc4a0a5d6aa5440901267/packages/dsh-plugin/server/render.ts)

### SRC-15 · DSH 官方架构
读取于 2026-10-06；所读文件 blob SHA：8514fd8bd3e7312f2b25d0fe2f28d2da778cf8ff。用于插件、服务、可撤销注册及 bundle 概念；不据此确认用户本机接口。

[来源](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
