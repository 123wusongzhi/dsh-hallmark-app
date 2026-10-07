# DSH Apps · 最新实现、原型与目标架构差距审计

**文件编号：DSH-APPS-AUDIT-002　｜　修订：A.2　｜　日期：2026-10-07**

**状态：审计后续实施评审稿，未批准生产放行。** 新任务均为 TODO，新一轮产品验收均为 NOT_RUN。历史候选记录保留原标签，不由本次文件代签。

| 控制项 | 规定 |
|---|---|
| 审计快照 | `caea8175b5c7507bf942b2e752a7327063bfdd43`（main 读取时的固定提交） |
| 原始目标基线 | A.0 / `cb871b4086508988485dc4a0a5d6aa5440901267`；仓库 A.1 增加原聊天创作要求 |
| 已读版本 | bundle/Host candidate.6；Runtime candidate.4；DB 3；HTTP/目录 1；bridge 2.0。根 package.json 仍为 0.3.0，不代表整个运行系统版本。 |
| 文档体系 | AUDIT 说明证据与差距；TODO 规定工作包；SPEC 规定目标；ACCEPTANCE 规定验证；ARCH 规定图面关系 |
| 适用范围 | 本机优先；一个 Apps 入口、1+N 逻辑插件、原 DSH Agent/会话、一个 P2 Runtime；不重建 DSH 聊天或插件管理器 |
| 规范词 | 必须＝放行条件；不得＝禁止；应＝偏离须登记理由；可＝可选；“已实现”仅指本次见到的代码路径 |
| 角色 | A 架构责任人；I 实施人；V 验证人；R 发布责任人。姓名/日期/签认在执行时填写，不预先代填。 |

> **使用前检查：** SHA、实际进程/包版本和宿主契约与本文件不一致时，先生成差异表。不得将拟新增项目接口当作现有 DSH 服务。不得将文档检查、语法检查或原型演示计为生产验收。



## 00 结论与审计边界

**结论：底座已经从 Hallmark 单应用推进到 Apps V1 候选，不需要重新做一遍 A.0 的架构拆分；尚不能称“原聊天创建/编辑组件的整个产品闭环已验收”。** 后续应把投入集中到原生入口、真实创作证据、候选发布、界面状态、组件管理与分范围验收。

本报告是固定提交下关键调用链的静态审计与需求比对，不是逐行覆盖全仓的漏洞审计，也没有对用户桌面进行远程运行验收。“GAP”指在已核对链路中缺少满足目标的步骤；“STATIC_RISK”指可由代码推导但仍应复现的风险；“EVIDENCE_GAP”指有实现或声明，却没有当前范围可直接核验的运行证据。

优先级P0表示阻止相应承诺范围放行，不表示本次发生安全事故。真实业务写或数据切库未通过，不必阻止一个**明确只包含创作/只读能力**的候选发布；但不得将该候选称为全部业务完成。

[S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md) [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts)

## 01 材料身份与本次实际检查

| 对象 | 固定身份 / 本次结论 |
|---|---|
| 代码 | caea8175b5c7507bf942b2e752a7327063bfdd43；旧比较基线 cb871b4086508988485dc4a0a5d6aa5440901267 |
| 安装/运行版本 | 未连接用户当前DSH进程；只能核对源码与仓库版本声明，不把磁盘/根package版本当运行版本。 |
| 上传HTML与仓库原型 | 本地按Git blob算法计算为699650d19f2bdcb66029e5b31780ff4b61f6c903，与仓库原型blob相同；可确认本次上传对应同一文件内容。 |
| 原型语法 | 提取script后执行node --check，exitCode=0；仅证明JavaScript语法可解析。 |
| 原型浏览器 | file URL和隔离127.0.0.1 HTTP两次均在导航时被环境策略拒绝；执行UI断言0条，状态BLOCKED_ENV。 |
| 仓库测试 | 本次NOT_RUN；完整checkout/依赖/DSH不在本审计环境，Node22.16低于仓库声明>=22.18。 |
| 外部效果 | 本次未写GitHub、未安装/重启用户服务、未迁移数据库、未执行真实业务修改。 |
本次环境与输入校验结果见 `evidence/environment-report.json` 和 `evidence/input-manifest.json`；原型源码副本与三图在 `references/inputs/`。哈希相同不是运行通过。[S27](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/package.json) [S28](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/prototypes/chat-component-authoring.html) [U01](../references/inputs/chat-component-authoring.html)

## 02 已完成基础：保留并复核，不重新开工

| 架构能力 | 本次所见 | 后续动作 |
|---|---|---|
| 1+N与唯一P2 | apps-main组装Hallmark/Notes/共享展示；bundle装配Apps及应用投影。 | 保留组合根；不要求一个应用一个进程。 |
| 目录/连接/会话集合 | AppsRuntime有注册、Schema、发现、连接和tuple绑定；UI焦点独立。 | 接@与管理UI，不再维护另一份目录。 |
| 三入口单实现 | Runtime、Hallmark原业务适配、生成SDK、组件代理已连接。 | 回归语义一致/幂等；不是再写三套HTTP。 |
| 异构Notes | 真正list/get/create/update及revision、操作证据，不只是占位名称。 | 做真实多绑定展示与脚本回归。 |
| 执行可靠性 | 分发前记账、unknown inspect、连接锁、取消后等待Provider归静止。 | 按实际新版本复验；不因不考虑安全而删除正确性。 |
| 源码/保存 | capture/checkout、manifest校验、历史版本和save CAS已存在。 | 增加构建因果、预览和发布门禁；不回退为固定widget。 |
| v2桥和附件 | 完整frame身份、nonce、能力调用、真实原inputActions链已存在。 | 补生产入口、状态恢复、端到端证据，不从零重建。 |
| 兼容发现 | 四固定网关、可选26旧Schema、旧HTTP/alias/v1兼容。 | 属于A.0允许的降级与迁移策略；不强制动态加载。 |
| 迁移维护 | 仓库提供离线迁移/回退/GC手册与夹具范围说明。 | 其真实切库证据仍独立；本次新增状态还须纳入。 |
[S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S14](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx) [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts) [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

## 03 三张图与 HTML 的逐项审计

三张图片没有给出替代关系，因此本次不擅自指定“最后一张一定是最终版”。三者共同的原聊天/普通源码/真实构建/明确保存/刷新分离原则被保留；有歧义的连线通过A.2编号关系确定。

| 材料 / 位置 | 支持的目标 | 不得推导的结论 / 后续处理 |
|---|---|---|
| 图1 / 绿色重开与保存路径 | 工作副本与组件库可循环复用。 | 分叉线没有触发/对象标注；不能当自动保存。以FIG-17中的SAVE边为准。 |
| 图2 / 当前会话展示→组件库 | 展示结果可以成为保存来源。 | 直达箭头缺少显式保存门禁；在工程图中插入用户保存条件。 |
| 图3 / 绿色重开线 | 有“重新打开并编辑”的意图。 | 线段未明确接到库节点，不能据此确定数据所有者。工程图明确从componentId/revision到新workspace/view。 |
| 三图 / buildId→viewId | 展示引用某个已构建产物。 | 不是一对一关系；多view可复用同build，同view编辑可切build。 |
| 三图 / 根据真实反馈修改 | 原Agent读实际预览继续改源码。 | 截图图标不是已执行截图证据；不能用另画的商品页替代实际dist。 |
| HTML / L55, L185–215 | 交互流程可以离线演示。 | 无网络、无原DSH/真实模型；关键词+sleep模拟，不是生产编译器。 |
| HTML / L183, L256 | 可选择应用并打开组件。 | activeApp单值、单component是原型限制，不能覆盖真实多应用集合。 |
| HTML / L149, L291 | 消息中能打开组件区。 | 旧消息仅open-pane指向当前component，是原型风险；生产必须保留消息自己的viewId。 |
| HTML / L242–256 | 版本冲突、历史源版本和更新基线有清楚演示。 | localStorage CAS不证明真实SQLite/双会话并发已验证。 |
| HTML / L251 | 可以重命名。 | 没有增加revision；与生产manageSaved不同，按CR-02确认生产规则。 |
| HTML / L179, L185 | 模拟构建时暂时限制示例操作。 | 不得复制为禁用整个原聊天发送；原DSH的输入/队列语义仍由宿主拥有。 |
| HTML / L217–232 | 刷新不改设计，附加不自动发送。 | 数字在本地被改动；没有真实快照读取/文件上传/模型消费证据。 |
[U01](../references/inputs/chat-component-authoring.html) [U02](../references/inputs/image-044804.png) [U03](../references/inputs/image-044809.png) [U04](../references/inputs/image-044814.png) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S21](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/view.tsx)

## 04 差距总表

| 编号 | 优先级 / 状态 | 差距 | 工作包 |
|---|---|---|---|
| GAP-01 | P0 / GAP | 原生 @ 尚未与 Runtime 绑定形成生产入口 | TODO-028, TODO-029, TODO-030 |
| GAP-02 | P0 / GAP | 预览载体 v1 与新源码 SDK v2 不一致 | TODO-034, TODO-035 |
| GAP-03 | P0 / GAP | 内容地址存档不能证明源码确实构建成当前 dist | TODO-032, TODO-033 |
| GAP-04 | P0 / GAP | openSource 没有强制预览通过门禁 | TODO-035, TODO-036 |
| GAP-05 | P0 / PARTIAL | frame 握手及 iframe onLoad 不是应用可用回执 | TODO-036, TODO-037 |
| GAP-06 | P0 / PARTIAL | 创作 attempt、取消和迟到发布缺少专门代际约束 | TODO-032, TODO-036, TODO-038 |
| GAP-07 | P1 / GAP | 新 frame 会重建 React 本地状态，恢复契约尚缺 | TODO-039 |
| GAP-08 | P1 / PARTIAL | Agent 修改对象和预览反馈需要可追踪的正式上下文 | TODO-031, TODO-035, TODO-042 |
| GAP-09 | P0 / PARTIAL / EVIDENCE_GAP | 原生附件桥已有代码，但整链生产验收仍欠缺 | TODO-040, TODO-041, TODO-042 |
| GAP-10 | P1 / PARTIAL | 应用工作台和组件库后端成熟度高于当前前端 | TODO-043, TODO-044, TODO-045 |
| GAP-11 | P1 / CONFLICT | 保存、重命名和删除语义需要显式对齐 | TODO-027, TODO-044, TODO-045 |
| GAP-12 | P1 / PROTOTYPE_LIMIT | 单应用/单组件原型不代表目标多应用模型 | TODO-030, TODO-031, TODO-043 |
| GAP-13 | P1 / AMBIGUOUS_INPUT | 图中保存/重开箭头有歧义，不能直接作为代码流程 | TODO-027, TODO-043 |
| GAP-14 | P1 / EVIDENCE_GAP | 后台刷新只有配置并不足以证明可调度 | TODO-046 |
| GAP-15 | P1 / STATIC_RISK | 连接配置更新的权威来源和缓存失效不明确 | TODO-047 |
| GAP-16 | P0 / EVIDENCE_GAP | 历史 VERIFIED/PASS 不能直接汇总为整体验收通过 | TODO-027, TODO-049, TODO-050 |
| GAP-17 | P0 / EVIDENCE_GAP | 真实外部模型、业务写和切库仍是独立验收范围 | TODO-042, TODO-048, TODO-050 |
| GAP-18 | P2 / PRESERVE | 不应重建已有基础或把合法兼容层当作缺陷 | TODO-049 |
| GAP-19 | P2 / DOC_GAP | A.0 工程图原件可恢复，仓库文档还缺统一入口 | TODO-027, TODO-049, TODO-050 |
| GAP-20 | P2 / LIMIT | 当前审计不是完整执行性或所有文件漏洞审查 | TODO-027, TODO-050 |


## 05 逐项发现、证据与整改界限


### GAP-01 · 原生 @ 尚未与 Runtime 绑定形成生产入口

**优先级：** P0。**审计分类：** GAP。

**已读事实：** Client 装配已有原输入附件与会话组件插槽，但没有 Apps inputTriggers 注册；当前绑定入口仍是 AppsDirectory 的按钮。A.1 明确把 @ 接线列为待完成。 [S22](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/plugin.ts) [S24](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/directory.tsx) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

**影响：** 用户在任意原会话直接 @ 应用的主入口不可据现有目录按钮视为完成；失败、取消、重复引用与切会话还没有闭环证据。

**整改边界：** 使用现场核实的原生 @ source；候选只带稳定 appId，Host 确认 sessionId 与明确 connectionId 后再显示已绑定。

**追踪：** REQ-049、REQ-050、REQ-051、REQ-052；TODO-028、TODO-029、TODO-030。

### GAP-02 · 预览载体 v1 与新源码 SDK v2 不一致

**优先级：** P0。**审计分类：** GAP。

**已读事实：** source-preview.mjs 的 hostHTML 只处理 hallmark.source.v1；apps-client.ts 主协议是 dsh.apps.component.v2。现有 readDist 冻结同份 dist 的实现应复用。 [S18](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/scripts/source-preview.mjs) [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts)

**影响：** 新 SDK 工程不能把旧预览页中一张截图当作完成 v2 数据、握手、选择与交互验证。

**整改边界：** 添加 v2 预览 Host 和明确 legacy v1 分支；同一冻结 dist 在预览与正式宿主加载，报告真实支持的方法与失败。

**追踪：** REQ-057、REQ-058；TODO-034、TODO-035。

### GAP-03 · 内容地址存档不能证明源码确实构建成当前 dist

**优先级：** P0。**审计分类：** GAP。

**已读事实：** projectSnapshot 要求 dist/index.html 存在，并对源码与 dist 联合取哈希；它没有构建命令成功、构建前输入摘要和输出摘要的强制回执。 [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts)

**影响：** 静态机制允许“改过源码但仍带上次 dist”的目录被 capture；哈希一致只能证明存档完整，不能证明因果关系。此场景需夹具复现。

**整改边界：** 给新创作链增加 BuildReceipt；构建输入冻结、真实命令退出码、工具链/锁文件、输出摘要和最终 buildId 必须关联。

**追踪：** REQ-054、REQ-055、REQ-056；TODO-032、TODO-033。

### GAP-04 · openSource 没有强制预览通过门禁

**优先级：** P0。**审计分类：** GAP。

**已读事实：** openSource 在 capture 成功后直接事务更新 view.source；capturePreview 可缺失，已有报告只要求 buildId 相同，未把通过状态、运行错误或交互断言作为发布前提。 [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts)

**影响：** “文件已登记”与“预览/交互通过”仍可混淆；未通过的新构建可能成为当前会话引用。

**整改边界：** 分开归档候选与发布视图；新建/编辑的正常发布要求匹配、成功的 PreviewReceipt，旧历史构建继续兼容只读打开并标验证状态。

**追踪：** REQ-058、REQ-059、REQ-060；TODO-035、TODO-036。

### GAP-05 · frame 握手及 iframe onLoad 不是应用可用回执

**优先级：** P0。**审计分类：** PARTIAL。

**已读事实：** 现有 frame 身份和 nonce 校验已实现；AppsSourceFrame 仅用 onLoad 清除错误，onError 显示装载失败，未见组件首屏可用确认或旧可用构建恢复状态机。 [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx) [S21](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/view.tsx) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

**影响：** JS 运行错误、白屏、握手后数据失败不能仅依赖 HTML load 事件发现；A.1 的“失败保留旧可用界面”没有完整落实。

**整改边界：** 为候选 frame 增加可协商 readiness，确认首屏/关键数据/错误状态后完成展示确认；失败恢复 last-good，第一版无旧构建则显示明确失败空态。

**追踪：** REQ-060、REQ-061；TODO-036、TODO-037。

### GAP-06 · 创作 attempt、取消和迟到发布缺少专门代际约束

**优先级：** P0。**审计分类：** PARTIAL。

**已读事实：** Runtime 已有 invocation 和业务 operation；presentation 的源码替换主要按 ownerSessionId/viewId，尚未见 authoring attempt 与 expectedViewRevision 的发布 CAS。 [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx)

**影响：** 业务幂等不能替代源码发布竞争控制；较早构建迟到、取消后返回、同一 view 同时编辑可能覆盖较新的展示。

**整改边界：** 在 P2 添加轻量创作状态，不建立第二 Agent Loop；attemptId/sourceRevision/epoch 与 viewRevision 检查必须在发布事务内完成。

**追踪：** REQ-054、REQ-059、REQ-062、REQ-063；TODO-032、TODO-036、TODO-038。

### GAP-07 · 新 frame 会重建 React 本地状态，恢复契约尚缺

**优先级：** P1。**审计分类：** GAP。

**已读事实：** iframe key 包含 sessionId、viewId、buildId；换 build 必定重新挂载。现有方法清单无 UI 状态导出/恢复，不能假设筛选、页码、选择自动保存。 [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx) [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

**影响：** 编辑成功、侧栏/工作台切换后会有状态丢失风险；原型“保留筛选与选择”不是生产保证。

**整改边界：** 增加组件声明的 uiStateSchemaVersion、可序列化快照和迁移函数；按 view 保存，恢复选择必须重新验证 ResourceRef 与 datasetRevision。

**追踪：** REQ-064；TODO-039。

### GAP-08 · Agent 修改对象和预览反馈需要可追踪的正式上下文

**优先级：** P1。**审计分类：** PARTIAL。

**已读事实：** 已有工具结果显式 view 元数据、原生上下文 hook 和可选 requestAgent；但新创作从目标定位、工作目录、构建错误、截图到下一次修改的完整模型输入证据未提供。 [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S21](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/view.tsx) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

**影响：** “改这个组件”可能指向错误 view；不能将 iframe 状态或预览文件落盘等同模型已读取。

**整改边界：** 输出稳定创作定位包；多个 view 有歧义时才澄清；实际截图/报告通过原工具输出或原生附件进入原 Agent 的记录。

**追踪：** REQ-053、REQ-058、REQ-068；TODO-031、TODO-035、TODO-042。

### GAP-09 · 原生附件桥已有代码，但整链生产验收仍欠缺

**优先级：** P0。**审计分类：** PARTIAL / EVIDENCE_GAP。

**已读事实：** createAppsComponentHandlers 已校验选择并调用 selectionInputBridge.attachResources；原输入 actions 接线也存在。不能说附件能力从零缺失。候选说明只单列 fixture collector 的证明范围。 [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts) [S22](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/plugin.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**影响：** 仍需证明真正原输入的正文/旧附件保留、重复附加去重、移除、上传、手动发送与模型读取原 JSON；不能用返回 attached 代替。

**整改边界：** 优先复用现有桥；补双会话/刷新竞态/附件失败/人工发送的桌面回归及真实模型消费记录。

**追踪：** REQ-065、REQ-066、REQ-067；TODO-040、TODO-041、TODO-042。

### GAP-10 · 应用工作台和组件库后端成熟度高于当前前端

**优先级：** P1。**审计分类：** PARTIAL。

**已读事实：** AppsDirectory 主要展示应用按钮、连接和诊断；AppsWorkspace 展示目录或单一打开的 view。共享后端已有 list_saved、保存、历史、管理等能力。 [S24](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/directory.tsx) [S25](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/workspace.tsx) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S06](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md)

**影响：** 用户要求的常驻应用列表、可搜索组件库、历史打开/恢复、另存、保存冲突和未保存副本入口尚不能由当前 UI 证实。

**整改边界：** 只重做插件区域并接已有后端；不得再建一套组件库，更不得将 HTML 中整个 DSH 外壳搬入生产。

**追踪：** REQ-069、REQ-070、REQ-071、REQ-072；TODO-043、TODO-044、TODO-045。

### GAP-11 · 保存、重命名和删除语义需要显式对齐

**优先级：** P1。**审计分类：** CONFLICT。

**已读事实：** 生产 saveComponent 已有 CAS/版本；生产 manageSaved 重命名会增加 revision，删除保留历史记录。HTML rename 只改名称，delete 删除原型资产及其版本。 [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [U01](../references/inputs/chat-component-authoring.html)

**影响：** 把原型直接移植会改变现有版本含义、冲突触发和历史保留策略；不同文档给实施者不同答案。

**整改边界：** 本次建议保留生产规则：重命名形成元数据新 revision；删除是从库目录移除，历史保留并受 GC 引用保护。以 CR 确认，UI 文案对应真实含义。

**追踪：** REQ-071、REQ-072、REQ-073；TODO-027、TODO-044、TODO-045。

### GAP-12 · 单应用/单组件原型不代表目标多应用模型

**优先级：** P1。**审计分类：** PROTOTYPE_LIMIT。

**已读事实：** HTML 使用一个 activeApp 和一个 component；选择 Notes 替换 Hallmark，消息入口 open-pane 指向当前 component。实际 Runtime 已支持会话多绑定。 [U01](../references/inputs/chat-component-authoring.html) [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S21](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/view.tsx)

**影响：** 照搬原型会让多应用能力退化；旧消息可能打开另一新组件。后者是原型静态风险，不能归因于生产 AppsToolView。

**整改边界：** 保留真实多绑定集合；明确当前编辑目标和每条消息 view 引用；原型作为视觉样例，不作为业务状态代码。

**追踪：** REQ-052、REQ-053、REQ-069；TODO-030、TODO-031、TODO-043。

### GAP-13 · 图中保存/重开箭头有歧义，不能直接作为代码流程

**优先级：** P1。**审计分类：** AMBIGUOUS_INPUT。

**已读事实：** 三图共识一致，但图二从会话展示直接连组件库未显式画保存条件，图三重开线接点不完整，图一也未标对象与触发。用户未指定三图中哪张取代其余。 [U02](../references/inputs/image-044804.png) [U03](../references/inputs/image-044809.png) [U04](../references/inputs/image-044814.png) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

**影响：** 无法据一条无条件箭头推导“显示即保存”或“返回即发布”；buildId 到 viewId 也不是一一对应。

**整改边界：** 用 FIG-15..19 与编号关系表重画，显式保存门禁；保留三张原图作为输入，不修改原件，冲突规则登记 CR-01。

**追踪：** REQ-049、REQ-070；TODO-027、TODO-043。

### GAP-14 · 后台刷新只有配置并不足以证明可调度

**优先级：** P1。**审计分类：** EVIDENCE_GAP。

**已读事实：** 共享 binding 接受 scheduled/scheduleId；本次已读 apps-main 启动链仅见 server 和 recover，未见调度 worker 装配。不能由字段推断定时刷新已经运行。 [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S06](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md)

**影响：** PR-21 的“后台更新独立于打开”需端到端证明；也不能以 approx 半天容忍擅定 12 小时硬保证。

**整改边界：** 核实实际 worker；未装配则完成持久计划/时区/错过执行/去重/停用规则。无 worker 时不宣称 scheduled 可用。

**追踪：** REQ-075；TODO-046。

### GAP-15 · 连接配置更新的权威来源和缓存失效不明确

**优先级：** P1。**审计分类：** STATIC_RISK。

**已读事实：** composeAppsRuntime 对已存在连接跳过配置文件导入；clientFor 按 connectionId 缓存客户端，不按 configRevision。Runtime 本身又允许 addConnection 提高 revision。 [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)

**影响：** 编辑配置文件不一定改变数据库；更新数据库也不一定替换已缓存后端。此为已读路径风险，未声称实际误连店铺。

**整改边界：** 明确 DB 为活动配置、文件仅初次播种；受控配置更新先排空该连接，再递增 revision 并失效 client/broker/domain 缓存，记录新请求使用的配置版本。

**追踪：** REQ-076；TODO-047。

### GAP-16 · 历史 VERIFIED/PASS 不能直接汇总为整体验收通过

**优先级：** P0。**审计分类：** EVIDENCE_GAP。

**已读事实：** 追踪 CSV 48 行全部 VERIFIED/PASS，同时 42 行 remainingRealStatus=NOT_RUN；6 行 PASS 也仍须看实际执行范围和版本。原始 evidence 不在仓库，发布摘要区分了 deterministic model、原型与外部模型。 [S04](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**影响：** 把 fixture、旧 candidate、桌面显示、真实业务四层混合，可能错误放行 A.1 新体验和未做的业务写/切库。

**整改边界：** 保留原记录列，新增本次审计结论、executedCommit、版本、scope、原始证据可访问性、当前运行状态与签认；不覆盖历史。

**追踪：** REQ-077、REQ-079、REQ-080；TODO-027、TODO-049、TODO-050。

### GAP-17 · 真实外部模型、业务写和切库仍是独立验收范围

**优先级：** P0。**审计分类：** EVIDENCE_GAP。

**已读事实：** 候选说明公开承认真实外部模型、真实 Hallmark 调价/库存、原业务库切换未完成；候选5本地确定性模型证据不自动升级为候选6外部模型通过。已读公开低层目录为15个只读API操作和1个调价操作，不等于原应用全部API；采购价、归档、促销写、素材交付未在该已读目录登记。 [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S06](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)

**影响：** 可以发布有范围的候选，但不能宣称完整自然语言办业务、上品、写入和生产迁移已经验收。

**整改边界：** 分别建 AUTHORING、BUSINESS-WRITE、DATA-CUTOVER 放行记录；真实写入只针对用户指定测试对象和参数，读取前后领域证据；不以模拟写代签。

**追踪：** REQ-067、REQ-078、REQ-079、REQ-080；TODO-042、TODO-048、TODO-050。

### GAP-18 · 不应重建已有基础或把合法兼容层当作缺陷

**优先级：** P2。**审计分类：** PRESERVE。

**已读事实：** Runtime、Notes CRUD、通用资源、生成 SDK、四网关、操作恢复、版本保存、v1 兼容均有代码；bundle 引用旧 Host 以复用资源路由是明确兼容装配。 [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S14](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts) [B00](../references/A0/02_SPEC.md)

**影响：** 重复实现、全面改名或提前拆多个服务反而增加维护成本；固定发现网关是 A.0 允许的降级，不是必须改掉的缺口。

**整改边界：** 本次 TODO 从 027 追加；旧工作包做回归复核，不重新开工。逐步把通用 frame/selection 移到中性包可单列后续重构，不阻塞本期闭环。

**追踪：** REQ-077；TODO-049。

### GAP-19 · A.0 工程图原件可恢复，仓库文档还缺统一入口

**优先级：** P2。**审计分类：** DOC_GAP。

**已读事实：** 仓库 A.1 说明 FIG-01..12 图源未随材料提供；本会话上一版 ZIP 实际包含这些 SVG/DOT/Mermaid/PNG。本交付按原件保留，不当作最新实现图。 [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md) [B00](../references/A0/02_SPEC.md)

**影响：** 仅剩历史文字与不同版本图会使维护者错认基线；新任务和新 AC 缺少统一机器追踪。

**整改边界：** 恢复历史图到 references/A0；新图从 FIG-15 续号；清楚标注现状、目标、来源和替代范围，并提供交叉索引。

**追踪：** REQ-077、REQ-080；TODO-027、TODO-049、TODO-050。

### GAP-20 · 当前审计不是完整执行性或所有文件漏洞审查

**优先级：** P2。**审计分类：** LIMIT。

**已读事实：** 本次读取固定提交下关键链路、目标文档及上传原型；未取得完整可执行 checkout。容器 Node 22.16 低于仓库要求；浏览器两次在导航前被环境策略阻断。 [S27](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/package.json) [U01](../references/inputs/chat-component-authoring.html)

**影响：** 不能报告570项重跑通过，不能把原型浏览器未运行写成产品失败；静态未见也不证明整个仓库完全不存在某功能。

**整改边界：** 记录源码覆盖清单、HTML语法检查与同仓blob对照；产品测试均等待匹配环境执行，并保留本次 BLOCKED_ENV。

**追踪：** REQ-077、REQ-080；TODO-027、TODO-050。


## 06 原 48 项：原报告状态与本次审计分栏

原CSV共48行；48行implementationStatus=VERIFIED、testStatus=PASS、fixtureStatus=PASS。remainingRealStatus仅6行PASS，其他42行NOT_RUN。下面保留原标签，不认定其错误，也不把这些标签改成“本次重跑通过”。即便原remainingReal=PASS，仍要检查scope：例如旧候选本地确定性模型不等于新候选真实外部模型。

全部新运行状态为NOT_RUN。源代码可见也仅说明存在相应路径；本次未提供原始现场证据的记录统一标EVIDENCE_GAP。机器表 `validation/baseline_48.csv` 保留全部列。

[S04](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md)
| REQ / 名称 | 原remainingReal | 本次源码观察 |
|---|---|---|
| REQ-001 不修改 DSH 核心 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-002 一个外壳与 N 个接入 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-003 一个业务事实来源 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-004 一个能力执行实现 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-005 唯一运行时目录 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-006 生命周期与卸载 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-007 连接独立于应用 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-008 会话应用集合与焦点分离 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-009 显式路由与歧义处理 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-010 按需工具发现 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-011 兼容性握手 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-012 输入输出同时声明 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-013 底层 API 不是第二套业务 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-014 未知写接口显式分类 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-015 生成 SDK 与调用语义 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-016 数据来源时间口径 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-017 幂等身份与请求哈希 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-018 状态与业务核实 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-019 取消不等于撤销 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-020 并发与冲突域 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-021 脚本子调用日志 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-022 跨应用不假装事务 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-023 模型预算与数据句柄 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-024 稳定错误契约 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-025 普通源码为主路径 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-026 构建与保存分离 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-027 桥接握手与协议 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-028 通用资源选择 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-029 本地动作不经过模型 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-030 上下文与消息分开 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-031 确定性会话投影 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-032 多应用绑定 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-033 离线与版本冲突 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-034 明确状态所有者 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-035 确定性数据集身份 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-036 历史数据可追溯迁移 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-037 禁止双写切换 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-038 有条件回退 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-039 引用驱动清理 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-040 保留旧工具与协议入口 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-041 DSH 兼容探针 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-042 统一分发但独立版本 | PASS | CODE_PRESENT / 不等于整体验收 |
| REQ-043 异构应用验证 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-044 可定位观测记录 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |
| REQ-045 自动化故障矩阵 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-046 性能与上下文基准 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-047 可复现交付证据 | NOT_RUN | REPORTED_ONLY / 需原始证据 |
| REQ-048 不扩张本期目标 | NOT_RUN | CODE_PRESENT / 不等于整体验收 |


## 07 推进顺序与停止边界

**第一批：入口与创作证据。** 完成TODO-027..035；能在原聊天明确引用、定位副本，并生成真实构建及v2预览证据。不要先装修整个应用页。

**第二批：发布与恢复。** 完成TODO-036..039；把“可用构建”与“尝试中的候选”分开，防止错误构建覆盖旧显示；完成取消、重启与UI状态。

**第三批：日常可用产品。** 完成TODO-040..047：附件/原发送、真实Agent迭代、组件库/保存历史、计划与连接配置一致性。

**第四批：复核和发布。** TODO-048..050；原48项回归与新增32项共同组成验收。真实写和正式切库各自签认；在缺前提时只发布明确范围的候选。

不建议新增微服务集群、通用工作流引擎、插件市场、第二套Agent或“全能HTTP工具即平台”。新增创作账本只记录原Agent发起的文件/构建/预览过程，不接管其思考或任务队列。


## 90 来源索引与复核覆盖

已读的文件/符号见下表。代码URL全部固定到本次commit；文档内本机evidence路径仅是定位，不是本包已附的证据。原型行号对应上传HTML；GitHub代码按文件与符号定位，不把外层工具输出行号冒充源码行号。

| ID | 文件 / 符号 | 证据类别 |
|---|---|---|
| S01 | [最新仓库说明](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/README.md)<br>`README.md`<br>Apps V1 / 最新文档与体验入口 | 仓库声明 |
| S02 | [候选版范围和版本矩阵](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)<br>`docs/apps-v1-candidate.md`<br>运行与边界 / 插件、SDK 与源码组件 | 仓库声明 |
| S03 | [发布验证摘要](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md)<br>`docs/apps-publication-validation-20261007.md`<br>历史候选验证与新增设计分别记录 | 仓库声明；未提供原始运行档案 |
| S04 | [现有需求追踪](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv)<br>`docs/requirements/traceability.csv`<br>REQ-001..048；implementationStatus / remainingRealStatus | 仓库记录 |
| S05 | [A.1 架构](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)<br>`docs/requirements/03_ARCHITECTURE.md`<br>FIG-13 / FIG-14 / AC-13-01..09 | 目标规范 |
| S06 | [当前桌面产品要求](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md)<br>`docs/apps-product-requirements-20261007.md`<br>PR-01..24 | 目标规范 |
| S07 | [原聊天创作评审](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/chat-component-authoring-review.md)<br>`docs/chat-component-authoring-review.md`<br>完成范围与后续接线 | 目标规范与边界声明 |
| S08 | [唯一 Runtime 目录及调用](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts)<br>`packages/app-runtime/src/index.ts`<br>AppsRuntime：目录、绑定、调用、核实与恢复的已读路径 | 代码静态证据 |
| S09 | [P2 组合根](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts)<br>`packages/service/src/apps-main.ts`<br>composeAppsRuntime / clientFor / main | 代码静态证据 |
| S10 | [组合 bundle Host](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts)<br>`bundles/apps/server/index.ts`<br>Config / bundle装配 / legacy资源路由兼容 | 代码静态证据 |
| S11 | [组合 bundle Client](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/client/index.tsx)<br>`bundles/apps/client/index.tsx`<br>createClientPlugin 实参 / AppsWorkspace / AppsToolView | 代码静态证据 |
| S12 | [DSH Host 门面](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts)<br>`packages/plugin-apps/src/index.ts`<br>gatewaySchemas / AppsHost / installNativeContextHook | 代码静态证据 |
| S13 | [Hallmark Provider](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)<br>`packages/app-hallmark/src/index.ts`<br>HALLMARK_DESCRIPTORS / HALLMARK_API_OPERATIONS / execute | 代码静态证据 |
| S14 | [Notes Provider](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts)<br>`packages/app-notes/src/index.ts`<br>NOTES_DESCRIPTORS / NotesProvider.execute/inspect | 代码静态证据 |
| S15 | [SDK 与生成器](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts)<br>`packages/app-sdk/src/index.ts`<br>AppsClient / HttpRuntimeTransport / generateArtifacts | 代码静态证据 |
| S16 | [共享展示与保存](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)<br>`packages/app-presentation/src/index.ts`<br>openSource / createView / saveComponent / openComponent / manageSaved | 代码静态证据 |
| S17 | [源码构建存档](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts)<br>`packages/source-components/src/index.ts`<br>projectSnapshot / capture / capturePreview / verify / checkout | 代码静态证据 |
| S18 | [当前预览载体](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/scripts/source-preview.mjs)<br>`scripts/source-preview.mjs`<br>readDist / hostHTML；hallmark.source.v1 | 代码静态证据 |
| S19 | [v2 组件客户端](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts)<br>`packages/component-runtime/src/apps-client.ts`<br>COMPONENT_CHANNEL / COMPONENT_METHODS / createAppsClient | 代码静态证据 |
| S20 | [生产 frame 容器](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx)<br>`packages/dsh-plugin/client/component-frame.tsx`<br>useComponentBridge / AppsSourceFrame | 代码静态证据 |
| S21 | [新组件显示投影](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/view.tsx)<br>`packages/plugin-apps/client/view.tsx`<br>appsToolViewReference / AppsNativeView / AppsToolView | 代码静态证据 |
| S22 | [原生扩展装配](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/plugin.ts)<br>`packages/dsh-plugin/client/plugin.ts`<br>ClientContext / createClientPlugin / bindNativeInput | 代码静态证据 |
| S23 | [组件能力与附件接线](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts)<br>`packages/plugin-apps/client/component-handlers.ts`<br>createAppsComponentHandlers / attachSelection | 代码静态证据 |
| S24 | [当前应用目录](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/directory.tsx)<br>`packages/plugin-apps/client/directory.tsx`<br>AppsDirectory / bind | 代码静态证据 |
| S25 | [当前工作区](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/workspace.tsx)<br>`packages/plugin-apps/client/workspace.tsx`<br>AppsWorkspace | 代码静态证据 |
| S26 | [迁移和回退运行手册](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)<br>`docs/apps-migration-runbook.md`<br>PROC-MIG-01 / PROC-RBK-01 / GC | 命令与夹具范围声明 |
| S27 | [开发脚本与 Node 要求](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/package.json)<br>`package.json`<br>scripts / engines / version | 代码静态证据 |
| S28 | [仓库 HTML 原型](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/prototypes/chat-component-authoring.html)<br>`docs/prototypes/chat-component-authoring.html`<br>schema 3 / sendCommand / runBuild / saveAsset | 离线交互原型 |
| U01 | [本次上传 HTML](../references/inputs/chat-component-authoring.html)<br>`references/inputs/chat-component-authoring.html`<br>见 AUDIT 的原型逐项表 | 用户原型；可静态复核 |
| U02 | [用户架构示意图 1](../references/inputs/image-044804.png)<br>`references/inputs/image-044804.png`<br>整图与绿色保存/重开路径 | 目标示意，不是工程验收 |
| U03 | [用户架构示意图 2](../references/inputs/image-044809.png)<br>`references/inputs/image-044809.png`<br>整图与绿色保存/重开路径 | 目标示意，不是工程验收 |
| U04 | [用户架构示意图 3](../references/inputs/image-044814.png)<br>`references/inputs/image-044814.png`<br>整图与绿色保存/重开路径 | 目标示意，不是工程验收 |
| B00 | [上一轮 A.0 文档原件](../references/A0/02_SPEC.md)<br>`references/A0/02_SPEC.md`<br>REQ-001..048 / TST-001..048 | 目标基线；不是执行证据 |
