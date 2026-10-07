# DSH 多应用框架 · TODO 实施与验收清单

> **GitHub 收录说明（2026-10-07）：** 本文件由原项目工作目录收录，文档链接已调整到仓库内；历史任务、基线和验收范围保留。原始现场归档不发布，`evidence/` 路径仅作原开发机定位；公开结果见[发布验证摘要](../apps-publication-validation-20261007.md)。

**文件编号：DSH-APPS-TODO-001　｜　修订：A.1 / 1.0.0-candidate.6　｜　发布日期：2026-10-06**

**状态：候选实施与验证记录。** 26项开发交付物已实施并有隔离证据；26项本卡技术断言已独立验证，0项因现场或阶段前提保持BLOCKED。复选框按本卡完成判定，后续关联需求与正式安装/切换仍单独记录。

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


## 00A 本轮实施状态（2026-10-07）

工作目录：`E:/project/deepseek_h/dsh-hallmark-app`；基线提交保持 cb871b4，本次候选源码与最新架构/原型纳入Git发布，具体提交身份以Git记录为准；候选包已在独立DSH实例测试。用户已授权在原项目覆盖更新并替换桌面原插件；候选安装 PASS_OFFICIAL_DESKTOP_REPLACEMENT，候选显示 PASS_NATIVE_SIDEBAR_AND_WORKBENCH，当前候选已安装 true。先前临时测试的恢复记录保留为历史证据；当前状态以桌面验收记录为准。Bill读取既有商品快照，源时间为2026-10-06T16:01:20.856Z；刷新成功时间不表示平台实时同步。模型消费/前缀重放证据属于历史candidate.5，candidate.6未重跑模型路径。 SPEC/ARCH需求内容保持不变，本文件只更新执行记录。

| 任务 | 开发实现 | 本卡验收 | 本轮证据/剩余范围 |
|---|---|---|---|
| TODO-001 | IMPLEMENTED | VERIFIED | 基线、依赖锁、26工具与本地只读状态冻结；核心hash保持不变。 |
| TODO-002 | IMPLEMENTED | VERIFIED | 独立DSH会话已取得真实Inspect签名、四工具执行与注销证据；未支持的会话方法明确降级。 |
| TODO-003 | IMPLEMENTED | VERIFIED | ADR-001..008、单进程与唯一状态所有权已固定；G0范围及真实Host证据由独立审计判定。 |
| TODO-004 | IMPLEMENTED | VERIFIED | 完整类型、Schema编译/输入输出校验、规范JSON与数据集身份已实施。 |
| TODO-005 | IMPLEMENTED | VERIFIED | Hallmark纯领域Provider、真实HTTP适配与统一operationId；旧工具隔离回放通过，真实业务写入未执行。 |
| TODO-006 | IMPLEMENTED | VERIFIED | 共享展示、ResourceRef与v1转换；源码资产保持不可变版本。 |
| TODO-007 | IMPLEMENTED | VERIFIED | 显式模块目录、exact版本、统一invoke/inspect与远程Host投影已实施。 |
| TODO-008 | IMPLEMENTED | VERIFIED | 原441项回归保留；全仓570项、类型/构建与原生桌面Host技术验收通过；真实业务写入未执行。 |
| TODO-009 | IMPLEMENTED | VERIFIED | 复合连接、会话应用集合与焦点分离；歧义零分发。 |
| TODO-010 | IMPLEMENTED | VERIFIED | 单Apps入口、1+N逻辑投影、单bundle；生命周期fixture通过。 |
| TODO-011 | IMPLEMENTED | VERIFIED | Notes独立命名空间、list/get/create/update、CAS与ResourceRef已实施。 |
| TODO-012 | IMPLEMENTED | VERIFIED | 真实Bill读取与Notes异构流程、双会话/多绑定及实际双应用源码交互截图通过；图片明确为sourcefixture。 |
| TODO-013 | IMPLEMENTED | VERIFIED | 46项共享descriptor生成SDK、文档和参数投影；三SDK跨项目JS/types/starter验证通过。 |
| TODO-014 | IMPLEMENTED | VERIFIED | 固定4网关及catalogDigest/按需describe；candidate.5实际本地模型载荷的Apps4 Schema/name/hash/bytes与三应用摘要已核，旧Hallmark Schema为0；candidate.6桌面四网关另有实测。 |
| TODO-015 | IMPLEMENTED | VERIFIED | 15项只读API及1项既有调价适配API登记；完整Schema与同一写入/核实链，unknown先拒绝再显式登记并经SDK验证。 |
| TODO-016 | IMPLEMENTED | VERIFIED | 意图hash/派发屏障/单ledger/取消/unknown只读恢复/绝对deadline及持久inspect记录通过。 |
| TODO-017 | IMPLEMENTED | VERIFIED | run/step记录、跨应用partial、完成步骤复用和unknown核实后持久化通过。 |
| TODO-018 | IMPLEMENTED | VERIFIED | 20应用1000能力、10000行、三入口各30次与UTF8预算/完整句柄通过；字节量明确不冒充token或真实模型耗时。 |
| TODO-019 | IMPLEMENTED | VERIFIED | v2身份、nonce/reload、字节限制与旧协议转换；跨会话和旧帧拒绝。 |
| TODO-020 | IMPLEMENTED | VERIFIED | candidate.5实际上下文更新零wake、固定Native请求落盘/消费、同RPC去重、跨会话隔离与重启后历史前缀重建通过；candidate.6未重跑模型消费。 |
| TODO-021 | IMPLEMENTED | VERIFIED | 每绑定独立刷新/stale、CAS保存、不可变history、显式版本恢复通过。 |
| TODO-022 | IMPLEMENTED | VERIFIED | 双应用React源码101本地动作无新增RPC及fixture附件/save/restore通过；candidate.5原生消费/重放与candidate.6原桌面显示、本地动作和只读刷新分别留证。 |
| TODO-023 | IMPLEMENTED | VERIFIED | 离线schema2→独立schema3、一致DB+源码/dist/预览/spill/outbox备份、hash/隔离/reentry通过。 |
| TODO-024 | IMPLEMENTED | VERIFIED | 复制环境停写/迁移/切换与两类回退按独立审计记录；successful+unknown增量保留，生产目录尚未切换。 |
| TODO-025 | IMPLEMENTED | VERIFIED | 引用/保留驱动GC dry-run、旧计划拒绝、会话诊断IDs复制和故障关联通过；磁盘spill保守保留。 |
| TODO-026 | IMPLEMENTED | VERIFIED | 单candidate.6 tgz、版本矩阵、打包Runtime/SDK smoke与48需求证据通过；原桌面替换、查询/显示、重启后卸载清理及最终保留新版均已验。 |

[完整证据索引](../apps-publication-validation-20261007.md) · [桌面验收记录](../apps-publication-validation-20261007.md) · [候选包说明](../apps-v1-candidate.md) · [迁移运行手册](../apps-migration-runbook.md)

本轮任务卡与需求技术验收均已通过；桌面安装保留新版，原业务数据库切换与外部发布未执行。 不冒填人工现场签字或Git提交。

## 00 执行规则

本文件按工作包管理重构。复选框只表示有证据的完成，不表示已开始。本轮开发交付物已实施；本卡技术验证完成的任务标 VERIFIED，缺外部或完整阶段门禁的任务保持 BLOCKED。

任务生命周期为 TODO → DOING → REVIEW → VERIFIED；遇到缺外部前提时为 BLOCKED，发现回归时退回 DOING。只有验证者确认验收断言并附证据才可标 VERIFIED；代码合并、开发者口头确认或测试数量增加均不自动完成任务。

角色：A 决定架构与范围；I 实施代码；V 验证独立断言；R 控制发布、迁移和回退。同一人可兼任，但必须分别填写记录，不把“我写完了”当作验证签认。

每个工作包必须提交：目标与 diff、相关 REQ、测试命令与输出、原行为回归、已知限制和回退说明。发生协议/状态机/部署边界变化先提交 CR，不能边实现边改变需求含义。

### 00.1 开始前的停机判断

P0 至 P4 默认在开发环境或隔离副本实施，不需要对真实业务停机。P5 只有在明确进入首次切换流程时才停止旧入口。禁止为了架构探索就重启用户正在运行的 DSH 或变更其业务服务。

本手册不提供虚构的“已存在迁移命令”。TODO-023 实现迁移器后，必须将真实命令、参数和版本记录到发布证据，再用于 P5 演练。


## 01 阶段门禁

| 门禁 | 必须具备的证据 | 不足时动作 |
|---|---|---|
| G0 / P0 | 基线、26 工具目录、Host 探针、固定架构与职责 | 不开始通用层实现；未核实 Host 功能采用明确降级 |
| G1 / P1 | 通用层抽取、Hallmark 原语义回归、旧源码组件仍可用 | 恢复旧代码入口，不触碰外部业务 |
| G2 / P2 | Hallmark + Notes 异构闭环；双会话、多连接与焦点分离 | 修协议边界，不能用第二家店铺替代 |
| G3 / P3 | SDK/API/工具单实现；幂等与 unknown 恢复；发现与预算基准 | 关键故障不通过则冻结新入口 |
| G4 / P4 | 源码→构建→展示→交互→保存→恢复整链 | 静态截图不能替代真实交互；不支持的 Host 方法明确降级 |
| G5 / P5 | 完整迁移与回退演练；版本矩阵；48 项测试证据 | 不发布完整验收版；保留候选包和限制清单 |

阶段允许内部并行，但每个任务必须满足其具体前置任务。P0 → P1 → P2 → P3 → P4 → P5 是门禁顺序，不是交付时间承诺。图示见 FIG-12。


## 02 总清单

当前状态：实施 IMPLEMENTED；26项本卡已 VERIFIED、0项 BLOCKED。具体证据和后续范围见下面执行记录。

- [x] **TODO-001 / P0 — 冻结基线与状态清单**；前置：无。

- [x] **TODO-002 / P0 — 核实 DSH 扩展点**；前置：TODO-001。

- [x] **TODO-003 / P0 — 确认职责、流程与需求基线**；前置：TODO-001, TODO-002。

- [x] **TODO-004 / P1 — 定义通用协议与完整 Schema**；前置：TODO-003。

- [x] **TODO-005 / P1 — 拆出 Hallmark 领域 Provider**；前置：TODO-004。

- [x] **TODO-006 / P1 — 抽取共享展示和资源模型**；前置：TODO-004。

- [x] **TODO-007 / P1 — 建立单一 Runtime 目录和统一调用链**；前置：TODO-004, TODO-005, TODO-006。

- [x] **TODO-008 / P1 — 执行原功能回归并通过 G1**；前置：TODO-005, TODO-006, TODO-007。

- [x] **TODO-009 / P2 — 连接与多应用会话模型**；前置：TODO-008。

- [x] **TODO-010 / P2 — 1+N 原生插件与应用目录**；前置：TODO-009。

- [x] **TODO-011 / P2 — 异构 Notes Provider**；前置：TODO-010。

- [x] **TODO-012 / P2 — 验证多应用闭环并通过 G2**；前置：TODO-011。

- [x] **TODO-013 / P3 — 语义工具与 SDK 生成**；前置：TODO-012。

- [x] **TODO-014 / P3 — 按需发现与兼容降级**；前置：TODO-013, TODO-002。

- [x] **TODO-015 / P3 — 底层 API 操作目录**；前置：TODO-013。

- [x] **TODO-016 / P3 — 幂等账本、取消与恢复**；前置：TODO-007, TODO-012。

- [x] **TODO-017 / P3 — 脚本运行、子调用与跨应用恢复**；前置：TODO-013, TODO-016。

- [x] **TODO-018 / P3 — 执行/预算基准并通过 G3**；前置：TODO-014, TODO-015, TODO-016, TODO-017。

- [x] **TODO-019 / P4 — bridge v2 与旧协议转换**；前置：TODO-018。

- [x] **TODO-020 / P4 — 组件调用、上下文与 Agent 消息**；前置：TODO-019, TODO-002。

- [x] **TODO-021 / P4 — 多应用绑定和组件版本交互**；前置：TODO-019。

- [x] **TODO-022 / P4 — 源码到交互闭环并通过 G4**；前置：TODO-020, TODO-021。

- [x] **TODO-023 / P5 — 离线迁移器和完整资产备份**；前置：TODO-022, TODO-004。

- [x] **TODO-024 / P5 — 切换与回退演练**；前置：TODO-023, TODO-016。

- [x] **TODO-025 / P5 — 资产清理与运行诊断**；前置：TODO-023。

- [x] **TODO-026 / P5 — 统一产物、发布矩阵与 G5**；前置：TODO-024, TODO-025。

## 03 工作包执行卡

卡片中的“文件定位”为基线移动点或拟新增目录，不承诺当前仓库已有对应路径。每张卡的证据目录以 `evidence/<releaseId>/` 为根。实施完成后必须同时检查编号需求、同号测试和本卡的停止条件。


### TODO-001 · 冻结基线与状态清单

**阶段/状态：** P0 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** 已明确以 cb871b4 为基线，尚未修改运行中的服务。。

**需求：** REQ-001, REQ-047。**验证：** TST-001, TST-047。

**文件定位：** `根目录、docs、现有测试`。

**执行动作：** 记录 commit、依赖锁、26 个工具名和构建清单；复制本地状态时先使用一致快照；逐项标记代码证据、模拟证据和真实证据。

**交付物：** baseline.json；tool-catalog-v0.3.0.json；现状/缺口清单。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P0/TODO-001/baseline.json`。

**停止/回退：** 基线变化时停止后续任务并重新编号快照；不修改业务库。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 基线、依赖锁、26工具与本地只读状态冻结；核心hash保持不变。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P0/TODO-001/execution.json`。


### TODO-002 · 核实 DSH 扩展点

**阶段/状态：** P0 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-001 VERIFIED。

**需求：** REQ-010, REQ-030, REQ-031, REQ-041。**验证：** TST-010, TST-030, TST-031, TST-041。

**文件定位：** `packages/dsh-compat/（拟新增）`。

**执行动作：** 对工具注册/卸载、输出投影、会话输入、上下文持久化、Client bridge 和动态 Schema 分别运行探针；每项保存真实签名和支持状态。

**交付物：** host-capabilities.json；实际运行时版本矩阵；不支持功能的降级行为。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P0/TODO-002/host-probes/`。

**停止/回退：** 不得以官方 master 文档替代本机探针；未核实功能设 unsupported，保留已验原生入口。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 独立DSH会话已取得真实Inspect签名、四工具执行与注销证据；未支持的会话方法明确降级。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P0/TODO-002/execution.json`。


### TODO-003 · 确认职责、流程与需求基线

**阶段/状态：** P0 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-001 VERIFIED, TODO-002 VERIFIED。

**需求：** REQ-002, REQ-003, REQ-034, REQ-042, REQ-048。**验证：** TST-002, TST-003, TST-034, TST-042, TST-048。

**文件定位：** `三份手册及 architecture-decision.md`。

**执行动作：** 确认 P1/P2/P3/P4 边界、单进程 Provider 放置和双半部应用交付；逐项登记变更需求；批准 P0 门禁。

**交付物：** ADR-001..ADR-008；G0 签认记录；需求追踪矩阵。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P0/TODO-003/G0.json`。

**停止/回退：** 任何进程归属或状态所有者仍有两个答案时不进入 P1。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 ADR-001..008、单进程与唯一状态所有权已固定；G0范围及真实Host证据由独立审计判定。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P0/TODO-003/execution.json`。


### TODO-004 · 定义通用协议与完整 Schema

**阶段/状态：** P1 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-003 VERIFIED。

**需求：** REQ-007, REQ-009, REQ-011, REQ-012, REQ-016, REQ-024, REQ-035。**验证：** TST-007, TST-009, TST-011, TST-012, TST-016, TST-024, TST-035。

**文件定位：** `packages/app-contracts/（拟新增）`。

**执行动作：** 实现 SPEC 的身份、调用、结果和绑定协议；给能力补齐输出 Schema；定义 JSON 规范化、版本兼容和错误联合类型。

**交付物：** 类型声明；Schema 编译器接口；协议测试夹具。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P1/TODO-004/contracts/`。

**停止/回退：** 注册必须拒绝错误 Schema；不可用 any 隐藏未知结构；旧 contracts 暂保留。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 完整类型、Schema编译/输入输出校验、规范JSON与数据集身份已实施。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Provider business and installed Host acceptance are owned by later stage gates.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P1/TODO-004/execution.json`。


### TODO-005 · 拆出 Hallmark 领域 Provider

**阶段/状态：** P1 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-004 VERIFIED。

**需求：** REQ-003, REQ-004, REQ-012, REQ-016。**验证：** TST-003, TST-004, TST-012, TST-016。

**文件定位：** `packages/core、hallmark-adapter → packages/app-hallmark/`。

**执行动作：** 移出展示分发，保留 HallmarkClient、TaskBroker、写入/恢复语义；26 个旧工具逐个建立目标映射；本阶段不改变实际 HTTP 路由与默认数据目录。

**交付物：** HallmarkProvider；旧工具兼容门面；对照回归结果。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P1/TODO-005/hallmark-regression/`。

**停止/回退：** HTTP 请求内容或业务状态非预期变化即停止；恢复旧入口模块，不回滚真实业务。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 Hallmark纯领域Provider、真实HTTP适配与统一operationId；旧工具隔离回放通过，真实业务写入未执行。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Loopback business HTTP is a fixture; original external Hallmark writes remain NOT_RUN under TODO-008/026.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P1/TODO-005/execution.json`。


### TODO-006 · 抽取共享展示和资源模型

**阶段/状态：** P1 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-004 VERIFIED。

**需求：** REQ-025, REQ-026, REQ-028, REQ-032, REQ-033。**验证：** TST-025, TST-026, TST-028, TST-032, TST-033。

**文件定位：** `packages/presentation、source-components、component-runtime`。

**执行动作：** 移动通用组件动作；通用 SDK 替换商品类型为 ResourceRef；Hallmark 提供选择解析器；保留 bridge v1 转换层。

**交付物：** 共享 PresentationService；通用选择协议；源码构建回归夹具。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P1/TODO-006/components/`。

**停止/回退：** 历史构建或绑定不可读即停止；不得批量改写历史组件。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 共享展示、ResourceRef与v1转换；源码资产保持不可变版本。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P1/TODO-006/execution.json`。


### TODO-007 · 建立单一 Runtime 目录和统一调用链

**阶段/状态：** P1 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-004 VERIFIED, TODO-005 VERIFIED, TODO-006 VERIFIED。

**需求：** REQ-004, REQ-005, REQ-011, REQ-012, REQ-034。**验证：** TST-004, TST-005, TST-011, TST-012, TST-034。

**文件定位：** `packages/app-runtime、packages/service`。

**执行动作：** P2 启动时从显式 Provider 模块清单注册；实现 register/describe/invoke/inspect；Host 仅使用远程投影；通过依赖测试禁止公共层 import 应用包。

**交付物：** Runtime 注册与调用服务；catalogDigest；模块装载清单。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P1/TODO-007/runtime/`。

**停止/回退：** 重复 capabilityId 或版本主号不兼容时拒绝注册；保留旧服务启动选项供开发回归。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 显式模块目录、exact版本、统一invoke/inspect与远程Host投影已实施。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Actual isolated Host uses the identical Runtime4; no production deployment.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P1/TODO-007/execution.json`。


### TODO-008 · 执行原功能回归并通过 G1

**阶段/状态：** P1 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-005 VERIFIED, TODO-006 VERIFIED, TODO-007 VERIFIED。

**需求：** REQ-001, REQ-003, REQ-004, REQ-025, REQ-040, REQ-047。**验证：** TST-001, TST-003, TST-004, TST-025, TST-040, TST-047。

**文件定位：** `现有 test 与迁移对照测试`。

**执行动作：** 执行既有测试、类型检查和插件构建；对照旧工具目录；验证源码登记/保存/恢复；所有未做真实写验收仍标 NOT_RUN。

**交付物：** G1 结果；基线差异；历史组件兼容报告。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P1/TODO-008/G1.json`。

**停止/回退：** 任一现有已验行为退化阻止 G1；不得用新测试总数掩盖旧失败。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 原441项回归保留；全仓570项、类型/构建与原生桌面Host技术验收通过；真实业务写入未执行。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：The card explicitly requires unexecuted real writes to remain NOT_RUN; actual installed display belongs to TST-001/026 and is not claimed here.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P1/TODO-008/execution.json`。


### TODO-009 · 连接与多应用会话模型

**阶段/状态：** P2 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-008 VERIFIED。

**需求：** REQ-007, REQ-008, REQ-009。**验证：** TST-007, TST-008, TST-009。

**文件定位：** `Runtime 连接仓储、SessionAppBinding、Client 状态`。

**执行动作：** 实现 appId/connectionId 组合引用；拆分 focusedApp；为默认旧连接建立显式别名映射，不按界面焦点选业务连接。

**交付物：** 连接 CRUD；会话绑定集合；双会话隔离测试。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P2/TODO-009/sessions/`。

**停止/回退：** 无法唯一确认旧后端连接时记录 needs_migration，不自动取默认端口。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 复合连接、会话应用集合与焦点分离；歧义零分发。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Actual isolated Native binding/ownership evidence is recorded; original production deployment is unchanged.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P2/TODO-009/execution.json`。


### TODO-010 · 1+N 原生插件与应用目录

**阶段/状态：** P2 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-009 VERIFIED。

**需求：** REQ-002, REQ-005, REQ-006, REQ-042。**验证：** TST-002, TST-005, TST-006, TST-042。

**文件定位：** `packages/plugin-apps、plugin-hallmark、bundles/apps`。

**执行动作：** 共享 Host 插件提供项目自定义 AppsHost 门面；Hallmark 插件只挂载能力投影；目录来自 Runtime 与 Host 挂载状态；注册句柄随 Cordis 生命周期撤销。

**交付物：** 一个 Apps 入口；两个逻辑插件；统一 bundle 清单。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P2/TODO-010/lifecycle/`。

**停止/回退：** 不能把 Host 卸载解释为 P2 外部业务撤销；残留工具句柄即阻止发布。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 单Apps入口、1+N逻辑投影、单bundle；生命周期fixture通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P2/TODO-010/execution.json`。


### TODO-011 · 异构 Notes Provider

**阶段/状态：** P2 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-010 VERIFIED。

**需求：** REQ-002, REQ-007, REQ-028, REQ-043。**验证：** TST-002, TST-007, TST-028, TST-043。

**文件定位：** `packages/app-notes、plugin-notes（拟新增）`。

**执行动作：** 实现 notes.list/get/create/update；独立连接与 ResourceRef；只修改新增包和分发清单；在本地测试库执行写入。

**交付物：** Notes Provider；第二应用目录条目；组合展示用固定夹具。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P2/TODO-011/notes/`。

**停止/回退：** 若必须给通用层增加 product/store 分支，先回到 TODO-004 修正协议。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 Notes独立命名空间、list/get/create/update、CAS与ResourceRef已实施。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Actual isolated Host Notes reads/writes are recorded; external Bill mutation remains NOT_RUN.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P2/TODO-011/execution.json`。


### TODO-012 · 验证多应用闭环并通过 G2

**阶段/状态：** P2 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-011 VERIFIED。

**需求：** REQ-008, REQ-009, REQ-032, REQ-043, REQ-047。**验证：** TST-008, TST-009, TST-032, TST-043, TST-047。

**文件定位：** `集成测试与 G2 记录`。

**执行动作：** 同会话查询 Hallmark 并创建 Notes；用稳定映射组合两个数据集；切换 focusedApp 不改变绑定；另一会话验证无隐式迁移。

**交付物：** G2 结果；跨应用闭环录像或截图；请求轨迹。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P2/TODO-012/G2.json`。

**停止/回退：** 只有同应用多店用例通过不算 G2；跨应用失败不自动重放已成功写入。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 真实Bill读取与Notes异构流程、双会话/多绑定及实际双应用源码交互截图通过；图片明确为sourcefixture。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Screenshots show ordinary source fixture connected to actual isolated Runtime, not installed DSH GUI; no Hallmark business write.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P2/TODO-012/execution.json`。


### TODO-013 · 语义工具与 SDK 生成

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-012 VERIFIED。

**需求：** REQ-004, REQ-012, REQ-015, REQ-023。**验证：** TST-004, TST-012, TST-015, TST-023。

**文件定位：** `packages/app-sdk 与工具投影生成器（拟新增）`。

**执行动作：** 从能力清单生成 TypeScript SDK、文档和工具参数；保留 Result 联合类型；对三入口进行同义调用测试。

**交付物：** 生成 SDK；契约快照；示例脚本。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-013/sdk/`。

**停止/回退：** 生成差异未提交或 unknown 被吞掉即失败；不引入第二套 HTTP 业务实现。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 46项共享descriptor生成SDK、文档和参数投影；三SDK跨项目JS/types/starter验证通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Actual DSH model consumption and real business acceptance remain separately recorded.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-013/execution.json`。


### TODO-014 · 按需发现与兼容降级

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-013 VERIFIED, TODO-002 VERIFIED。

**需求：** REQ-010, REQ-011, REQ-041。**验证：** TST-010, TST-011, TST-041。

**文件定位：** `dsh-compat、Host 工具投影`。

**执行动作：** 支持宿主使用原生作用域/延迟机制；不支持时仅固定 list/describe/invoke/inspect；记录每步实际模型 Schema，防止全量注入。

**交付物：** 发现工具；工作集管理；Host 能力降级测试。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-014/discovery/`。

**停止/回退：** 未获取模型侧证据不得标动态发现完成；禁止猜 deferLoading 行为。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 固定4网关及catalogDigest/按需describe；candidate.5实际本地模型载荷的Apps4 Schema/name/hash/bytes与三应用摘要已核，旧Hallmark Schema为0；candidate.6桌面四网关另有实测。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Dynamic working-set remains explicitly unsupported; real external model execution is not required for the actual Native request evidence.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-014/execution.json`。


### TODO-015 · 底层 API 操作目录

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-013 VERIFIED。

**需求：** REQ-013, REQ-014, REQ-024。**验证：** TST-013, TST-014, TST-024。

**文件定位：** `Hallmark Provider api-operations 清单`。

**执行动作：** 为已核实长尾接口登记 operationId、输入输出、effects 和 inspect 规则；直接 API 仍走 Runtime；未核实接口保留 unavailable。

**交付物：** API 目录；原始字段保真测试；长尾调用示例。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-015/raw-api/`。

**停止/回退：** 不得把接口盘点写成已完成真实业务验收；未知写操作不作 read 降级。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 15项只读API及1项既有调价适配API登记；完整Schema与同一写入/核实链，unknown先拒绝再显式登记并经SDK验证。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Raw mutation business target is loopback/isolated; real Bill writes remain NOT_RUN as required by the card.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-015/execution.json`。


### TODO-016 · 幂等账本、取消与恢复

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-007 VERIFIED, TODO-012 VERIFIED。

**需求：** REQ-017, REQ-018, REQ-019, REQ-020, REQ-024, REQ-044。**验证：** TST-017, TST-018, TST-019, TST-020, TST-024, TST-044。

**文件定位：** `Runtime operation ledger；Hallmark 写入/inspect`。

**执行动作：** 先落账再分发；按组合键 single-flight；明确 dispatch 阶段；中断传播 signal；恢复只做 inspect；输出诊断关联 ID。

**交付物：** 操作状态机；恢复器；故障注入测试。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-016/operations/`。

**停止/回退：** 未知结果出现第二次写请求即阻止阶段通过；不可声称通用 exactly-once。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 意图hash/派发屏障/单ledger/取消/unknown只读恢复/绝对deadline及持久inspect记录通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：UI clipboard/log navigation is covered by TODO-025/026; external business acceptance remains NOT_RUN.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-016/execution.json`。


### TODO-017 · 脚本运行、子调用与跨应用恢复

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-013 VERIFIED, TODO-016 VERIFIED。

**需求：** REQ-021, REQ-022, REQ-023。**验证：** TST-021, TST-022, TST-023。

**文件定位：** `SDK run context；示例流程脚本`。

**执行动作：** 给脚本运行分配 runId；记录每个子调用；中间数据留执行环境；部分失败后显式选择恢复步骤；补偿需独立能力和操作。

**交付物：** 脚本 run 记录；部分失败恢复示例；数据句柄演示。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-017/scripts/`。

**停止/回退：** 不建设第二个通用工作流引擎；无恢复依据时停止并保留操作证据。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 run/step记录、跨应用partial、完成步骤复用和unknown核实后持久化通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：External business/script execution and actual model timing belong to stage acceptance.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-017/execution.json`。


### TODO-018 · 执行/预算基准并通过 G3

**阶段/状态：** P3 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-014 VERIFIED, TODO-015 VERIFIED, TODO-016 VERIFIED, TODO-017 VERIFIED。

**需求：** REQ-023, REQ-044, REQ-045, REQ-046, REQ-047。**验证：** TST-023, TST-044, TST-045, TST-046, TST-047。

**文件定位：** `基准夹具与发布报告`。

**执行动作：** 固定同一数据集比较工具/SDK/混合；执行错误矩阵；报告 P50/P95 和输入字节/可测 token；发布 G3 结果。

**交付物：** benchmark.json；故障矩阵；G3 签认。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P3/TODO-018/G3.json`。

**停止/回退：** 性能指标无法复现或关键可靠性失败均不放行；不采用外部提速比例替代。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 20应用1000能力、10000行、三入口各30次与UTF8预算/完整句柄通过；字节量明确不冒充token或真实模型耗时。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：SPEC13 and the card permit input bytes when model tokens are unavailable; real model timing/input is NOT_RUN.；Actual Native Schema capture is recorded separately; query timing benchmark uses unchanged Runtime4, while Host5 lifecycle fix does not change its query algorithm.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P3/TODO-018/execution.json`。


### TODO-019 · bridge v2 与旧协议转换

**阶段/状态：** P4 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-018 VERIFIED。

**需求：** REQ-027, REQ-028, REQ-029, REQ-040。**验证：** TST-027, TST-028, TST-029, TST-040。

**文件定位：** `component-runtime；SourceFrame；Host bridge`。

**执行动作：** 实现握手、frameInstanceId、能力协商、超时和迟到回复丢弃；v1 方法通过兼容适配；附加选择保留 revision 检查。

**交付物：** bridge v2；v1 适配层；旧/新 frame 测试。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P4/TODO-019/bridge/`。

**停止/回退：** 旧组件渲染或附件流程退化时保留 v1 分支，不批量强制升级源码。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 v2身份、nonce/reload、字节限制与旧协议转换；跨会话和旧帧拒绝。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P4/TODO-019/execution.json`。


### TODO-020 · 组件调用、上下文与 Agent 消息

**阶段/状态：** P4 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-019 VERIFIED, TODO-002 VERIFIED。

**需求：** REQ-029, REQ-030, REQ-031, REQ-041。**验证：** TST-029, TST-030, TST-031, TST-041。

**文件定位：** `SourceFrame；dsh-compat 的会话扩展`。

**执行动作：** 实现 invokeCapability、updateContext、requestAgent；本地点击不进模型；模型可见上下文必须可重放；无原生接口时保持附加到输入框路径。

**交付物：** 交互矩阵；原生会话证据；不支持特性提示。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P4/TODO-020/interaction/`。

**停止/回退：** 未核实宿主入口不允许直接写会话文件或假造已发送状态。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 candidate.5实际上下文更新零wake、固定Native请求落盘/消费、同RPC去重、跨会话隔离与重启后历史前缀重建通过；candidate.6未重跑模型消费。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P4/TODO-020/execution.json`。


### TODO-021 · 多应用绑定和组件版本交互

**阶段/状态：** P4 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-019 VERIFIED。

**需求：** REQ-026, REQ-032, REQ-033, REQ-035。**验证：** TST-026, TST-032, TST-033, TST-035。

**文件定位：** `PresentationService；数据绑定；组件工作台`。

**执行动作：** 每绑定独立刷新和错误状态；实现 CAS 保存；版本引用不可变；回退保存为新 revision；未知匹配展示 unresolved。

**交付物：** 组合组件；离线 UI；并发保存测试。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P4/TODO-021/views/`。

**停止/回退：** 旧数据若被当作最新或跨连接复用错误数据集，停止展示并保留证据。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 每绑定独立刷新/stale、CAS保存、不可变history、显式版本恢复通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Installed GUI interaction belongs to TODO-022/026.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P4/TODO-021/execution.json`。


### TODO-022 · 源码到交互闭环并通过 G4

**阶段/状态：** P4 / VERIFIED。**实施：** I。**验证：** V。**批准：** A。

**进入条件：** TODO-020 VERIFIED, TODO-021 VERIFIED。

**需求：** REQ-025, REQ-027, REQ-029, REQ-030, REQ-031, REQ-033, REQ-047。**验证：** TST-025, TST-027, TST-029, TST-030, TST-031, TST-033, TST-047。

**文件定位：** `组件端到端测试`。

**执行动作：** 从新建源码到构建、预览、登记、调用、消息、保存与恢复完成整链；检查模型请求计数；对 unsupported 分支验证明确降级。

**交付物：** G4 结果；构建 manifest；交互截图和会话轨迹。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P4/TODO-022/G4.json`。

**停止/回退：** 仅静态截图不等于交互通过；未被宿主支持的消息方式不得标 PASS。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 双应用React源码101本地动作无新增RPC及fixture附件/save/restore通过；candidate.5原生消费/重放与candidate.6原桌面显示、本地动作和只读刷新分别留证。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：无本卡未验断言。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P4/TODO-022/execution.json`。


### TODO-023 · 离线迁移器和完整资产备份

**阶段/状态：** P5 / VERIFIED。**实施：** I。**验证：** V。**批准：** A 与 R。

**进入条件：** TODO-022 VERIFIED, TODO-004 VERIFIED。

**需求：** REQ-034, REQ-035, REQ-036, REQ-039, REQ-040。**验证：** TST-034, TST-035, TST-036, TST-039, TST-040。

**文件定位：** `scripts/migrate-apps（拟新增）；新 DB schema`。

**执行动作：** 映射所有旧集合及源码资产；先 dry-run；导出 26 名称别名和 datasetKey 映射；校验文件 SHA256、计数和孤儿引用；原库只读。

**交付物：** migration-report.json；一致备份 manifest；可重入迁移程序。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P5/TODO-023/migration/`。

**停止/回退：** 备份缺构建文件或未知连接被自动指定时停止；不得仅依赖现有 JSON 备份覆盖所有资产。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 离线schema2→独立schema3、一致DB+源码/dist/预览/spill/outbox备份、hash/隔离/reentry通过。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Personal DB migration/cutover remains NOT_RUN; TODO024 copied-environment full rehearsal passed.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P5/TODO-023/execution.json`。


### TODO-024 · 切换与回退演练

**阶段/状态：** P5 / VERIFIED。**实施：** I。**验证：** V。**批准：** A 与 R。

**进入条件：** TODO-023 VERIFIED, TODO-016 VERIFIED。

**需求：** REQ-018, REQ-037, REQ-038。**验证：** TST-018, TST-037, TST-038。

**文件定位：** `运行手册 PROC-MIG-01 / PROC-RBK-01`。

**执行动作：** 复制环境执行停写、核查、备份、迁移、验证和切换；分别演练无新写及已有新写两类回退；记录唯一写入者。

**交付物：** cutover-report.json；rollback-report.json；残留操作核查。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P5/TODO-024/rollback/`。

**停止/回退：** 存在未解释 unknown 时禁止旧服务恢复写入；优先保持冻结而非丢失证据。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 复制环境停写/迁移/切换与两类回退按独立审计记录；successful+unknown增量保留，生产目录尚未切换。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：The card explicitly requires a copied environment rehearsal, which passed. Original user DB/services and production cutover remain NOT_RUN, and production gates with NOT_RUN remain refused.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P5/TODO-024/execution.json`。


### TODO-025 · 资产清理与运行诊断

**阶段/状态：** P5 / VERIFIED。**实施：** I。**验证：** V。**批准：** A 与 R。

**进入条件：** TODO-023 VERIFIED。

**需求：** REQ-039, REQ-044。**验证：** TST-039, TST-044。

**文件定位：** `Runtime GC；操作查询；诊断面板`。

**执行动作：** 实现引用计数/标记清理 dry-run；用户保存版本默认保留；UI 复制 traceId；区分 Host 断开和 Provider 停止。

**交付物：** GC 报告；诊断导航；存储容量和保留策略文档。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P5/TODO-025/operations/`。

**停止/回退：** 删除计划包含有引用资产即失败；不静默清理未决操作记录。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 引用/保留驱动GC dry-run、旧计划拒绝、会话诊断IDs复制和故障关联通过；磁盘spill保守保留。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Clipboard implementation is a fixture interface, not installed DSH OS clipboard; installed Host OS clipboard/navigation is not claimed; SPEC default diagnostics interface scope has passed.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P5/TODO-025/execution.json`。


### TODO-026 · 统一产物、发布矩阵与 G5

**阶段/状态：** P5 / VERIFIED。**实施：** I。**验证：** V。**批准：** A 与 R。

**进入条件：** TODO-024 VERIFIED, TODO-025 VERIFIED。

**需求：** REQ-006, REQ-011, REQ-040, REQ-041, REQ-042, REQ-045, REQ-046, REQ-047, REQ-048。**验证：** TST-006, TST-011, TST-040, TST-041, TST-042, TST-045, TST-046, TST-047, TST-048。

**文件定位：** `bundles/apps；CI；release-manifest.json`。

**执行动作：** 构建一个 bundle 和 P2 产物；绑定包/协议/DB/能力版本矩阵；重跑所有强制测试；使用官方插件管理器演练安装/卸载和所需重启。

**交付物：** 候选发布包；G5；已知限制；安装/回退记录。

**完成判定：** 交付物已提交；上述关联测试在本任务影响范围有可复现断言；已有功能无未解释回归；需要后续阶段完成的测试明确标出剩余范围，不提前整项签认。

**证据路径：** `evidence/<releaseId>/P5/TODO-026/G5.json`。

**停止/回退：** 不把已安装版本称运行版本；缺关键测试证据或真实验收状态不清即不发布。

**执行记录：** 开始 2026-10-07；提交 工作区候选diff（独立DSH测试与桌面验收分别记录）；验证 本卡 PASS，独立V记录见 audit/task-scope-review.json，关联整项需求fixture为 PASS；差异/阻塞 单candidate.6 tgz、版本矩阵、打包Runtime/SDK smoke与48需求证据通过；原桌面替换、查询/显示、重启后卸载清理及最终保留新版均已验。；最终状态 VERIFIED（实现 IMPLEMENTED）。后续范围：Real Hallmark mutations, external-model performance and original personal business database cutover are NOT_RUN; no such events are claimed.。证据：`dsh-hallmark-app/evidence/apps-v1-20261007/P5/TODO-026/execution.json`。


## 04 现有模块迁移工作表

| 当前路径/职责 | 目标 | 实施任务 | 验收要点 |
|---|---|---|---|
| contracts 中通用 Result/Schema | app-contracts | TODO-004 | 不引入 Hallmark 专属字段；补输出 Schema |
| core 业务分发与 adapter | app-hallmark | TODO-005 | 原接口、回执和未知结果不改变 |
| core 展示分发 | 共享 PresentationService | TODO-006 | 旧工具名兼容投影指向公共实现 |
| presentation/source-components | 公共展示/资产层 | TODO-006、021 | 构建、版本、草稿与保存身份分开 |
| component-runtime 商品选择类型 | 通用 ResourceRef + Hallmark resolver | TODO-006、019 | 旧 v1 可用；Notes 无商品假设 |
| service main/server | P2 Runtime 组合器与接口 | TODO-007 | 单一目录、单一共享状态写入者 |
| dsh-plugin server | plugin-apps + plugin-hallmark + dsh-compat | TODO-010、014 | 版本相关代码集中；注册可撤销 |
| client registry 静态列表 | Runtime 目录与 Host 投影状态 | TODO-010 | 新应用无需修改公共数组 |
| session_apps 单行模型 | session_app_bindings 组合身份 | TODO-009、023 | 同会话多应用；歧义不猜连接 |
| 旧 app.db 和构建文件 | 新 apps.db + 完整资产映射 | TODO-023、024 | 离线副本、无双写、可追溯回退 |

不要一次性重命名所有包然后同时更换执行链。每一移动应保留可验证的兼容门面，直到对应门禁通过。


## 05 26 个旧工具兼容对照

基于 SRC-02 的源码清单。每行都必须有别名映射、参数/结果快照和回归用例。目标所有者是实现职责，不要求直接改掉旧工具名称。

| 旧名称 | 目标所有者 | 兼容检查 |
|---|---|---|
| `hallmark_app_info` | Runtime 门面；Hallmark 解释领域内容 | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_list_stores` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_resolve_store` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_list_store_products` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_get_platform_data` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_search_collected_items` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_get_collected_item` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_get_category_data` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_get_data_status` | Runtime 门面；Hallmark 解释领域内容 | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_compute_profit` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_filter_products` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_update_price` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_update_stock` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_list_product` | Hallmark Provider | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_get_operation` | Runtime 门面；Hallmark 解释领域内容 | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_list_operations` | Runtime 门面；Hallmark 解释领域内容 | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_refresh_data` | Runtime 门面；Hallmark 解释领域内容 | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_render_view` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_update_view` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_open_component` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_open_source_component` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_save_component` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_save_entry` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_save_template` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_list_saved` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |
| `hallmark_manage_saved` | 共享 PresentationService | [ ] 参数；[ ] 结果；[ ] 旧记录重放 |

## 06 测试执行与证据归档

现有仓库提供 `pnpm run typecheck`、`pnpm test`、`pnpm run build:plugin` 等入口。[SRC-01] 在基线依赖与 Node 环境满足后可作为回归起点；不能把新规格接口的存在与否交给这些旧测试隐式判断。

新增测试使用 SPEC 的 TST-001..048。建议证据结构如下：

```text
evidence/<releaseId>/
  baseline.json
  host-capabilities.json
  P0/ ... P5/
  tests/TST-001/result.json ... tests/TST-048/result.json
  benchmark/raw-samples.json
  migration/<migrationId>/report.json
  rollback/<attemptId>/report.json
  release-manifest.json
```

result.json 必须至少包含 testId、commit、environment、fixtureId、steps、assertions、status、executedAt 和 verifier。真实外部业务用例另附 connectionId、对象范围、原始回执和只读核实证据。真实数据不默认提交到源码仓库。

自动化断言与人工 UI 验收分开记录。GUI 点击、界面状态和错误恢复必须有实际证据；编译成功不能作为 UI 或业务成功的证明。


## 07 关键风险与停止线

| 风险 | 早期信号 | 必须动作 |
|---|---|---|
| 公共层仍依赖 Hallmark | 新增 Notes 需要改 source product 类型或 appId 分支 | 回到 TODO-004/006 修边界 |
| 重复执行账本 | 新旧层各自产生一个 operationId 并执行变更 | 停止 TODO-016，明确单一所有者和旧 ID 映射 |
| 假动态发现 | 全部 Schema 仍在每步模型请求，只增加执行门禁 | 按 TODO-014 检查模型输入证据 |
| Host API 猜测 | 代码调用未经探针确认的方法 | 标 unsupported，保留正式兼容路径 |
| 迁移丢资产 | JSON 备份有组件记录但无源码/dist | 停止切换，补完整备份并重新校验 |
| 数据回退丢增量 | 新系统已写入却准备直接恢复旧 app.db | 执行 PROC-RBK-01 分支 B |
| 业务验收被过度宣称 | 文档只给测试数量，没有真实范围与回执 | 分开记录模拟/真实状态，禁止完整验收声明 |

默认保持现有安全与用户确认行为，不为本次重构增加另一套审批体系，也不在重构中顺便移除现有控制。主要风险处置围绕正确性、维护性和可恢复性。


## 08 需求—任务—测试追踪表

每个需求至少映射一个任务和同号测试。CSV 为 `traceability.csv`，便于导入项目管理工具。

| 需求 | 负责实现/验收的任务 | 验证 |
|---|---|---|
| REQ-001 | TODO-001, TODO-008 | TST-001 |
| REQ-002 | TODO-003, TODO-010, TODO-011 | TST-002 |
| REQ-003 | TODO-003, TODO-005, TODO-008 | TST-003 |
| REQ-004 | TODO-005, TODO-007, TODO-008, TODO-013 | TST-004 |
| REQ-005 | TODO-007, TODO-010 | TST-005 |
| REQ-006 | TODO-010, TODO-026 | TST-006 |
| REQ-007 | TODO-004, TODO-009, TODO-011 | TST-007 |
| REQ-008 | TODO-009, TODO-012 | TST-008 |
| REQ-009 | TODO-004, TODO-009, TODO-012 | TST-009 |
| REQ-010 | TODO-002, TODO-014 | TST-010 |
| REQ-011 | TODO-004, TODO-007, TODO-014, TODO-026 | TST-011 |
| REQ-012 | TODO-004, TODO-005, TODO-007, TODO-013 | TST-012 |
| REQ-013 | TODO-015 | TST-013 |
| REQ-014 | TODO-015 | TST-014 |
| REQ-015 | TODO-013 | TST-015 |
| REQ-016 | TODO-004, TODO-005 | TST-016 |
| REQ-017 | TODO-016 | TST-017 |
| REQ-018 | TODO-016, TODO-024 | TST-018 |
| REQ-019 | TODO-016 | TST-019 |
| REQ-020 | TODO-016 | TST-020 |
| REQ-021 | TODO-017 | TST-021 |
| REQ-022 | TODO-017 | TST-022 |
| REQ-023 | TODO-013, TODO-017, TODO-018 | TST-023 |
| REQ-024 | TODO-004, TODO-015, TODO-016 | TST-024 |
| REQ-025 | TODO-006, TODO-008, TODO-022 | TST-025 |
| REQ-026 | TODO-006, TODO-021 | TST-026 |
| REQ-027 | TODO-019, TODO-022 | TST-027 |
| REQ-028 | TODO-006, TODO-011, TODO-019 | TST-028 |
| REQ-029 | TODO-019, TODO-020, TODO-022 | TST-029 |
| REQ-030 | TODO-002, TODO-020, TODO-022 | TST-030 |
| REQ-031 | TODO-002, TODO-020, TODO-022 | TST-031 |
| REQ-032 | TODO-006, TODO-012, TODO-021 | TST-032 |
| REQ-033 | TODO-006, TODO-021, TODO-022 | TST-033 |
| REQ-034 | TODO-003, TODO-007, TODO-023 | TST-034 |
| REQ-035 | TODO-004, TODO-021, TODO-023 | TST-035 |
| REQ-036 | TODO-023 | TST-036 |
| REQ-037 | TODO-024 | TST-037 |
| REQ-038 | TODO-024 | TST-038 |
| REQ-039 | TODO-023, TODO-025 | TST-039 |
| REQ-040 | TODO-008, TODO-019, TODO-023, TODO-026 | TST-040 |
| REQ-041 | TODO-002, TODO-014, TODO-020, TODO-026 | TST-041 |
| REQ-042 | TODO-003, TODO-010, TODO-026 | TST-042 |
| REQ-043 | TODO-011, TODO-012 | TST-043 |
| REQ-044 | TODO-016, TODO-018, TODO-025 | TST-044 |
| REQ-045 | TODO-018, TODO-026 | TST-045 |
| REQ-046 | TODO-018, TODO-026 | TST-046 |
| REQ-047 | TODO-001, TODO-008, TODO-012, TODO-018, TODO-022, TODO-026 | TST-047 |
| REQ-048 | TODO-003, TODO-026 | TST-048 |

## 09 每阶段复核卡与变更单

### 阶段复核卡

- [ ] 前置门禁已通过且证据可打开。
- [ ] 本阶段所有任务有提交、测试与已知限制。
- [ ] 相关需求没有被私自改成较弱描述。
- [ ] 原工具、保存组件和运行状态没有未解释回归。
- [ ] 未运行或受阻测试保持真实状态。
- [ ] 回退行为与外部业务结果的边界写清。

### CR 变更单

| 字段 | 待填内容 |
|---|---|
| changeId / 提出者 / 日期 | ______ |
| 原规则与新规则 | ______ |
| 修改理由和替代方案 | ______ |
| 影响 REQ/TODO/TST/FIG | ______ |
| 对历史工具、组件、数据库的影响 | ______ |
| 验收与回退新增步骤 | ______ |
| A / V / R 签认 | ______ |

本文件已回填本轮开发、独立DSH测试与桌面验收记录；未自动发布GitHub Issue/PR，正式业务部署另行记录。完整验收的剩余断言单独保留。


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
