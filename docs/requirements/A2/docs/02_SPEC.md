# DSH Apps · A.2 软件规格与接口控制说明

**文件编号：DSH-APPS-SPEC-002　｜　修订：A.2　｜　日期：2026-10-07**

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



## 00 与 A.0 / A.1 的关系及冲突处理

A.0的REQ-001..048继续有效，原文副本在`references/A0/02_SPEC.md`；本文件第10章同时列出这些继承要求。仓库A.1的FIG-13/14、PR-01..24和AC-13-01..09是本次细化输入。REQ-049..080是新增加的可验收约束，不是声称当前仓库已具备的API。

发生冲突时按“用户最新明确文字要求 → 经签认的本版CR/编号需求 → A.1编号产品行为与工程图关系表 → A.0保留条款 → 示意图 → 原型实现”的顺序处理。不能由图形箭头或原型mock代码覆盖明确保存、多应用绑定及原会话约束。未签CR时保持当前生产行为、停止有争议的新行为。

本版不重新设计权限/安全沙箱，也不额外增加业务每次审批流程。会话归属、数据修订、幂等、结果核实、取消/迟到和恢复属于正确性要求，仍必须保留。

| CR | 本版拟采用的明确决定 | 批准前限制 |
|---|---|---|
| CR-01 图面与原会话 | 只扩展插件区域；展示不自动保存；重开库版本生成目标会话独立副本；三图不指定先后取代。 | 不按无条件箭头做自动save；不复制HTML全聊天。 |
| CR-02 保存/管理 | 保留生产CAS和重命名增revision；删除库项不立即物理删除历史；历史恢复生成新revision。 | 保持现有生产语义，原型rename/delete不直接移植。 |
| CR-03 创作与兼容 | 新增轻量authoring状态及receipt；拟定schema4独立迁移；新增apps.authoring命名空间；v2能力协商扩展。 | 不修改原app.db；不在旧v2握手中无条件塞入未知方法。 |
| CR-04 配置与刷新 | DB为活动配置、文件初始播种；配置变更排空并失效缓存；无worker不宣称scheduled。 | 不静默覆盖连接；不虚构固定12小时刷新承诺。 |
这些决定的直接依据是实际代码与原型差异，见AUDIT GAP-01..20。[S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md) [S06](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [U01](../references/inputs/chat-component-authoring.html)

## 01 本版目标与非目标

**目标完成定义：** 在任意原DSH会话，用户用原输入`@`引用应用并手动发送；原Agent定位/新建普通React工程，实际构建、读取同份dist的真实反馈并继续迭代；合格候选装载后更新本会话展示；本地交互不反复唤醒模型；明确保存后形成可重开的历史资产。多应用能力和业务记录保持原Apps V1统一路径。

不要求每个应用独立进程，不新做插件市场或第二套管理器，不增加新的模型循环，不把模板/旧widget当表达上限，不把图标/示例数据当真实应用接入。A.2的新增状态只保证创作过程的可解释和可恢复，不编排Agent的思考过程。

日常创作候选与业务写验收、数据库切换验收分别发布范围。未跑真实写不自动否定只读创作成果，但产品介绍必须列出限制。


## 02 固定部署、职责与依赖边界

| 边界 | 保留实现 | 新增责任 / 不得承担 |
|---|---|---|
| P1 DSH Host | AppsHost、四网关、认证代理、原会话适配；legacy Host复用资源路由。 | 核实会话/版本；代理@绑定和创作引用；不得写P2 SQLite或复制能力Schema。 |
| P2 Apps Runtime | AppsRuntime、Hallmark/Notes Provider、AppsPresentationService、SourceComponentStore。 | authoring记录、receipt验证、候选发布CAS、统一状态；不得启动另一个Agent Loop。 |
| P3 Client / frame | 原插件slots、AppsWorkspace/NativeView、v2 bridge和原附件inputActions。 | @UI、库UI、候选frame就绪与声明式UI状态；不得拥有另一套聊天日志或业务数据库。 |
| P4 原业务应用 | 原Hallmark接口与账本；Notes作为最小本地应用拥有自己的命名空间。 | 业务事实、领域核实仍由应用解释；共享层不把所有对象当商品。 |
| 构建 / 预览进程 | 原DSH命令工具启动的实际编译器/浏览器辅助进程。 | 记录真实执行证据；可以是临时子进程，不因此成为新的常驻应用服务。 |
唯一具体Provider装配仍留在`service/src/apps-main.ts`；通用层不加入Hallmark/Notes业务分支。源代码目录名中遗留hallmark不单独构成缺陷，是否通用以依赖和职责判定。[S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S11](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/client/index.tsx) [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts)

## 03 身份与状态所有者：不得混用的字段

| 字段 / 对象 | 意义 / 所有者 | 不得当作 |
|---|---|---|
| sessionId | 原DSH会话身份；由原宿主获取/Host核实。 | 当前UI标签、最近会话或Agent自行填的身份。 |
| appId + connectionId | 运行时应用与后端连接；域内storeId仍是业务参数。 | 组件标题、店铺名、单个global activeApp。 |
| draftId + workspacePath | 独立可编辑源码副本，P2记录、原文件工具编辑。 | 不可变archive路径或保存资产本体。 |
| sourceRevision | 该工作副本的编辑代际；单调递增。 | 源码内容哈希；也不是组件保存revision。 |
| attemptId + epoch | 一次创作尝试及取消/替代代际。 | 一次领域mutation的operationId。 |
| sourceInputDigest | 源码/资源/配置/锁文件的冻结输入摘要，不含dist。 | 含旧dist的目录混合哈希。 |
| buildId + distDigest | buildId沿用归档内容地址；distDigest单列输出文件摘要。 | 构建命令已执行、截图已通过的证明。 |
| buildReceiptId / previewReceiptId | 真实构建与真实预览的不可变证据记录。 | 自由文本“已构建/已检查”。 |
| viewId + viewRevision | 某会话展示身份及当前发布CAS版本。 | componentId；同build可供多个view用。 |
| publicationId / candidateBuildId | 一次向特定view提交候选装载的过程。 | 已可见/已就绪；尚未成功就不得称展示完成。 |
| lastGoodBuildId / previousGoodBuildId | 最近已确认可用和此前确认可用的构建引用。 | 在预览失败后自动标可用的新build。 |
| frameInstanceId + documentNonce | 实际frame/document的桥接代际。 | viewRevision；iframe onLoad也不代表React可用。 |
| datasetId + datasetRevision | 规范查询身份与快照版本，P2拥有。 | 源码版本、保存版本或模型上下文版本。 |
| uiStateSchemaVersion | 组件声明的UI状态格式。 | Agent上下文版本；不搬运原输入草稿。 |
| componentId + revision | 明确保存资产及不可变历史版本。 | 临时view；新建/预览不分配正式资产版本。 |
| selectedSourceRevision / baseRevisionAtOpen | 打开的历史内容版本 / 打开时最新更新比较基线。 | 两者可能不同，不能用历史v1冒充最新v3的CAS前提。 |
| contextRevision / snapshotId | 可被正式模型投影消费的上下文版本。 | 已发送/已消费；需要独立队列和会话证据。 |
组件设计的默认配置与会话UI状态分开：搜索、排序、临时筛选只改变UI快照；用户明确要求“保存为默认条件”时才更新待保存的设计/查询配置并标dirty。普通点控件不得静默改组件库。

buildId可以被A/B两个view引用；编辑同view保持viewId而提高viewRevision；打开同一保存资产到新会话分配新view和workspace。原型自增build字符串只是示意，生产保持原内容地址规则。[S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts) [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [S05](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/03_ARCHITECTURE.md)

## 04 新增编号需求（REQ-049..080）


### REQ-049 · 只扩展原聊天，不移植原型外壳

必须保留 DSH 原窗口、导航、会话日志、输入正文、附件、模型选择及原发送流程。原型的侧栏/聊天 HTML 仅是展示参照，不得成为生产中的第二套会话系统。图片中任何无条件保存箭头由本规格的显式保存规则取代；本次 CR 未签认前不得将争议箭头实现为自动保存。

**验证：** TST-049；范围 LIVE_HOST。**工作包：** TODO-027、TODO-028、TODO-043。

**继承细化：** REQ-001、REQ-002、REQ-048；AC-13-01。

### REQ-050 · 原生 @ 候选、引用与清理

候选必须来自 Runtime 的可用应用目录，经已核实宿主扩展注册。选择候选不发送、不跳转、不新建会话、不执行领域写。候选或引用卸载必须释放注册；输入中文组合键时 Enter 不得由插件提前发送。

**验证：** TST-050；范围 LIVE_HOST。**工作包：** TODO-028、TODO-029。

**继承细化：** REQ-005、REQ-006、REQ-009、REQ-041；AC-13-01。

### REQ-051 · 引用绑定状态机与迟到响应

引用状态与绑定状态分别记录。只有 Host 验证 sessionId 并收到 Runtime 的具体 appId/connectionId enabled 结果才可显示“可调用”。用 bindRequestId 与 epoch 拒绝迟到结果；移除引用只撤销用户指定绑定，不影响其他已启用连接。持久绑定提交前取消为无变化；提交后移除为新的明确关闭动作。

**验证：** TST-051；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-029、TODO-030。

**继承细化：** REQ-007、REQ-008、REQ-009、REQ-034；AC-13-01。

### REQ-052 · 不把多应用模型退化为单 activeApp

同一会话必须保留多 app+connection 绑定集合；编辑焦点、工作台焦点和引用显示不得覆写集合。不同会话状态独立。开组件所需连接不明确时澄清，不通过打开资产静默将会话替换为 Hallmark。

**验证：** TST-052；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-030、TODO-031。

**继承细化：** REQ-007、REQ-008、REQ-009、REQ-032、REQ-043；AC-13-01、AC-13-08。

### REQ-053 · 编辑目标与历史消息引用明确

每次创作请求必须可定位到 sessionId/viewId/draftId/workspacePath；新建请求明确生成新view。多个可能目标且文字无指代时才澄清。消息卡必须保存自身view引用，不能读取全局“当前组件”。旧构建内容是否跟随view最新状态须显示说明；已保存历史版本入口必须固定revision。

**验证：** TST-053；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-031。

**继承细化：** REQ-025、REQ-026、REQ-031；AC-13-03、AC-13-08。

### REQ-054 · 创作工作副本与尝试账本

必须在P2保存轻量DraftRecord和AuthoringAttempt；workspacePath为独立可编辑目录。attemptId唯一、sourceRevision单调、epoch区分取消/替代；文件由原DSH文件/命令工具处理，不新建Agent Loop。业务operation与创作attempt分开命名，允许用invocationId关联但不得混用状态。

**验证：** TST-054；范围 FIXTURE。**工作包：** TODO-032。

**继承细化：** REQ-025、REQ-026、REQ-034、REQ-044；AC-13-02、AC-13-08。

### REQ-055 · 真实构建输入与输出回执

必须对冻结的构建输入计算sourceInputDigest，记录实际命令、cwd、工具链、锁文件摘要、退出码、完整日志引用及输出distDigest。构建期间源码输入发生变化，或退出码非0，均不得生成可发布BuildReceipt。存在dist/index.html不是构建成功证据。

**验证：** TST-055；范围 FIXTURE+SOURCE_EXEC。**工作包：** TODO-033。

**继承细化：** REQ-025、REQ-026、REQ-047；AC-13-02、AC-13-04。

### REQ-056 · 不可变归档和历史兼容

必须保留SourceComponentStore的内容地址与文件摘要机制。新BuildReceipt将源码输入、输出和最终archive buildId关联；preview存档不改变buildId。历史无回执构建可继续只读打开并标legacy_unverified，不能自动填“已预览通过”；本次编辑发布适用新门禁。

**验证：** TST-056；范围 FIXTURE。**工作包：** TODO-033、TODO-045。

**继承细化：** REQ-026、REQ-036、REQ-039、REQ-040；AC-13-05。

### REQ-057 · v2 同份 dist 的真实预览

新源码组件预览必须使用dsh.apps.component.v2，并复用相同能力/数据字段语义；v1独立兼容分支保留。预览服务提供冻结的实际dist字节，记录previewMode=fixture或live_readonly；未执行真实业务操作时不得用预览按钮模拟成功冒充业务证据。

**验证：** TST-057；范围 SOURCE_EXEC。**工作包：** TODO-034。

**继承细化：** REQ-025、REQ-027、REQ-028；AC-13-02。

### REQ-058 · 真实预览报告与 Agent 可消费反馈

PreviewReceipt必须关联buildId/buildReceiptId，包含至少窄侧栏与宽工作台两种实测视口、截图文件SHA256、pageerror、未处理异常、失败请求、握手与交互断言。PASS要求必需断言全通过；NOT_RUN/UNKNOWN不是PASS。报告/截图经原工具或原附件可供原Agent读取，消费证据另记，不由报告生成推断。

**验证：** TST-058；范围 SOURCE_EXEC+LIVE_MODEL。**工作包：** TODO-035、TODO-042。

**继承细化：** REQ-025、REQ-027、REQ-031、REQ-047；AC-13-02、AC-13-03。

### REQ-059 · 候选存档、允许发布与实际发布分离

新源码流程必须区分captured候选和当前view引用。缺BuildReceipt或匹配PASS预览时只能保存候选，不能改activeBuildId。已有open_source_component的名称可保留，但应以版本化契约表达新门禁，不捏造原生registerBuild API。候选存档不自动进入组件库。

**验证：** TST-059；范围 FIXTURE。**工作包：** TODO-036。

**继承细化：** REQ-025、REQ-026、REQ-027；AC-13-02、AC-13-04。

### REQ-060 · 同 view 发布 CAS 与代际一致性

更新同一草稿保持viewId，但发布必须带expectedViewRevision和attemptEpoch。CAS在P2同一事务核实owner、取消状态、候选证据和最新版本；成功后递增viewRevision。两次发布有序竞争，过期者报告VIEW_CONFLICT或ATTEMPT_SUPERSEDED，不自动换新revision重试。

**验证：** TST-060；范围 FIXTURE。**工作包：** TODO-036。

**继承细化：** REQ-017、REQ-020、REQ-026、REQ-034；AC-13-03、AC-13-08。

### REQ-061 · 展示就绪确认和 last-good 恢复

hello只确认桥接身份，iframe onLoad只确认文档加载。新构建必须收到同session/view/build/frame/attempt的renderReady检查结果后才可对用户称“已展示”。加载/React运行失败或超时保持lastGoodBuildId并显示原因；首次创建失败无旧构建时呈现错误空态而非示例数据。

**验证：** TST-061；范围 SOURCE_EXEC+LIVE_HOST。**工作包：** TODO-037。

**继承细化：** REQ-025、REQ-027、REQ-033；AC-13-04。

### REQ-062 · 取消与晚到结果的确定性语义

取消只阻止未提交阶段，不谎称撤销已发生变化。取消epoch先持久化，构建/预览协作停止；发布事务再检查epoch。取消早于发布提交则active不变；取消晚于提交则明确返回已发布事实，并仅经新的显式操作恢复last-good。

**验证：** TST-062；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-038。

**继承细化：** REQ-019、REQ-020、REQ-026；AC-13-04、AC-13-08。

### REQ-063 · 草稿恢复、关闭与进程重启

关闭view不删除工作目录或保存资产。打开另一组件前对未保存草稿提供保留/保存/放弃；恢复必须找回明确目录和最近成功build。进程重启后running attempt标interrupted并查询已提交状态，不自动重跑构建、发布或业务修改。

**验证：** TST-063；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-032、TODO-038、TODO-045。

**继承细化：** REQ-026、REQ-033、REQ-034、REQ-039；AC-13-04、AC-13-08。

### REQ-064 · 组件本地状态恢复和版本迁移

组件仅在声明UI状态契约时承诺恢复。UI快照按sessionId/viewId保存，带uiStateSchemaVersion、来源build、datasetRevision；换frame恢复搜索/排序/页码等可序列化状态。选择逐资源验证，失效项明确移除或要求重选；不自动搬运DSH输入正文。

**验证：** TST-064；范围 SOURCE_EXEC+LIVE_HOST。**工作包：** TODO-039。

**继承细化：** REQ-028、REQ-029、REQ-033；AC-13-03、AC-13-07、AC-13-08。

### REQ-065 · 选择验证、附件去重与输入保护

附加动作复用既有SelectionEnvelope与attachResources。去重范围为同会话、同view、同binding、同datasetRevision与规范化资源集合；不同快照不伪认为相同。只添加新附件，不替换原正文/旧附件；失败保留原输入与待选对象。

**验证：** TST-065；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-040。

**继承细化：** REQ-028、REQ-029、REQ-031；AC-13-06、AC-13-07。

### REQ-066 · 附加、上传、手动发送与消费分段验收

validated只表示Runtime校验，attached只表示原输入接纳，submitted/accepted仅表示正式会话队列接收；消费和业务完成另有证据。默认路径必须用户原发送；插件不得把attached改写成“Agent已收到”。可移除附件必须真正从原草稿移除。

**验证：** TST-066；范围 LIVE_HOST+LIVE_MODEL。**工作包：** TODO-041。

**继承细化：** REQ-029、REQ-030、REQ-031；AC-13-06、AC-13-09。

### REQ-067 · 原 Agent 自主创作整链必须用真实模型复核

至少一条实际配置外部模型的原会话完成“需求→源码修改→实际构建→读取真实反馈→再修改→展示→明确保存→重开编辑”。确定性模型、手工预置组件、规则关键词脚本分别标scope，不能冒充这条验收。模型/版本、输入和人工介入必须记录。

**验证：** TST-067；范围 LIVE_MODEL。**工作包：** TODO-042。

**继承细化：** REQ-025、REQ-043、REQ-045、REQ-047；AC-13-02、AC-13-03、AC-13-06。

### REQ-068 · 手动创作不依赖可选 requestAgent

默认原输入手动发送路径不依赖nativeSessionAdapter。可选updateContext只更新可重建上下文且不唤醒模型；requestAgent只在实际Host能力可用时公开，经原正式队列返回回执。adapter disabled时原聊天仍能创建/编辑组件；可选主动请求明确不支持。

**验证：** TST-068；范围 LIVE_HOST。**工作包：** TODO-041、TODO-042。

**继承细化：** REQ-030、REQ-031、REQ-041；AC-13-09。

### REQ-069 · 应用目录与组件库的局部 UI 完整性

工作台必须在原导航旁提供应用列表和应用内容区；组件库接共享Presentation接口，支持查询、搜索、明确打开、历史版本、另存和管理。一个会话可管理多个view；同view重复打开应复用展示意图。不得复制HTML全局聊天或重新维护组件资产副本。

**验证：** TST-069；范围 LIVE_HOST。**工作包：** TODO-043。

**继承细化：** REQ-002、REQ-005、REQ-025、REQ-033；AC-13-05、AC-13-08。

### REQ-070 · 新建、编辑、展示和明确保存是四个不同动作

新建/编辑只更新工作副本；展示发布只更新view引用；只有用户明确保存指令或保存按钮产生组件资产revision。图中展示到库的路径必须经过显式保存条件。用户已用自然语言明确保存并给齐名称时，不额外强制其重复点击保存按钮。

**验证：** TST-070；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-043、TODO-044。

**继承细化：** REQ-026、REQ-033；AC-13-02、AC-13-05。

### REQ-071 · 源版本、更新基线与保存 CAS

打开历史版本时selectedSourceRevision记录所选源码，baseRevisionAtOpen取打开时最新组件revision。保存update必须比较expectedRevision=该基线并核对viewRevision；冲突保留工作副本。恢复历史版本是将历史内容保存成新revision，不倒改历史。

**验证：** TST-071；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-044。

**继承细化：** REQ-020、REQ-026、REQ-033；AC-13-05、AC-13-08。

### REQ-072 · 重命名、移除视图与删除库项的语义

本版拟确认生产既有规则：重命名组件生成元数据新revision；删除组件从可发现库目录移除，不等于清除历史bytes。关闭/移除会话view不删除库项；删除库项不销毁已打开工作副本。历史永久清除属于另行明确的保留/GC策略，不能用HTML delete逻辑替代。

**验证：** TST-072；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-027、TODO-044、TODO-045。

**继承细化：** REQ-026、REQ-033、REQ-039；AC-13-05。

### REQ-073 · 新增创作证据与状态必须纳入备份和 GC

新增Draft/Attempt/BuildReceipt/PreviewReceipt/last-good/UI状态必须列入引用图和迁移备份。仍被view、组件历史、未决attempt或验收证据引用的build和截图不得清理。GC默认dry-run，apply核对同一计划和唯一writer；时间未知保守保留。

**验证：** TST-073；范围 FIXTURE。**工作包：** TODO-045、TODO-048。

**继承细化：** REQ-034、REQ-036、REQ-039；无新增原AC编号，见本版专用用例。

### REQ-074 · 刷新与构建分离且每个绑定独立报告

手动或聊天刷新仅调用已登记query/compute，不触发构建或业务mutation；design、buildId、component revision不变。一个绑定失败时仅其状态标stale/unavailable并保留最近成功数据，其余绑定可更新。旧选择须重新验证，sourceDataTime不能用读取时刻替代。

**验证：** TST-074；范围 FIXTURE+LIVE_HOST。**工作包：** TODO-039、TODO-046。

**继承细化：** REQ-016、REQ-028、REQ-032、REQ-033、REQ-035；AC-13-07。

### REQ-075 · 后台计划真实装配或明确不可用

scheduled能力必须由实际worker提供并报告状态，不能仅接收scheduleId。先选用已有DSH调度能力或当前P2可复用调度模块；只在无合适模块时补最小持久执行器。计划明确时区/下次执行/错过执行策略/停用/去重；本版采用错过多次最多补一次，禁止追赶风暴。

**验证：** TST-075；范围 FIXTURE+CLOCK_CONTROL。**工作包：** TODO-046。

**继承细化：** REQ-032、REQ-033、REQ-035、REQ-045；无新增原AC编号，见本版专用用例。

### REQ-076 · 连接配置权威与 client 缓存一致

本版拟固定：Runtime数据库为活动连接配置，配置文件仅首次播种；差异须报告，不静默覆盖。受控配置更新校验expectedConfigRevision，停止该连接新派发、排空、提交递增revision、失效client/broker/domain缓存后恢复。每次调用记录所用configRevision；在途调用不得迁到新后端。

**验证：** TST-076；范围 FIXTURE。**工作包：** TODO-047。

**继承细化：** REQ-007、REQ-009、REQ-020、REQ-034；无新增原AC编号，见本版专用用例。

### REQ-077 · 证据范围、版本和引用不可混用

每项测试须记录目标commit、执行commit、bundle/Host/Client/Runtime/协议版本、scope、运行状态、原始证据URI与SHA256。仓库旧VERIFIED/PASS保留为reported列；本次sourceObservation与newRunStatus另列。fixture、prototype、local_model、live_host、external_model、real_business、cutover不得互相替代。

**验证：** TST-077；范围 DOC+FIXTURE。**工作包：** TODO-027、TODO-049、TODO-050。

**继承细化：** REQ-041、REQ-042、REQ-044、REQ-046、REQ-047；无新增原AC编号，见本版专用用例。

### REQ-078 · 真实 Hallmark 核心业务按动作分别验收

查询、参考利润、已有采集上品、价格与库存分别定义验收对象和结果证据。真实写测试仅在用户明确的店铺/商品/SKU/仓库和参数范围内执行；复用原业务实现、幂等和inspect。上品平台接受不等于上架；普通CNY历史price-state不冒充实时平台价格。必须维护源API→能力→三入口→代码/夹具/真实验收覆盖表；未登记的功能明确未覆盖，不以有限目录声称全量API。

**验证：** TST-078；范围 REAL_BUSINESS。**工作包：** TODO-048。

**继承细化：** REQ-003、REQ-004、REQ-013、REQ-017、REQ-018、REQ-043；无新增原AC编号，见本版专用用例。

### REQ-079 · 生产数据切换与入口升级分开签认

插件安装/重开成功不等于旧app.db已迁移。切库必须验证离线副本、一致WAL备份、逐记录映射、文件hash、未决操作、唯一writer和回退增量。原业务数据库及凭据仍由原应用拥有；切换本项目接入库不撤销任何外部业务。

**验证：** TST-079；范围 FIXTURE+DATA_CUTOVER。**工作包：** TODO-048、TODO-050。

**继承细化：** REQ-036、REQ-037、REQ-038、REQ-039、REQ-042；无新增原AC编号，见本版专用用例。

### REQ-080 · 整架构分范围放行与可复现交付

发布必须由明确范围的门禁决定，不计算一个混合百分比。CORE、AUTHORING、BUSINESS-WRITE、DATA-CUTOVER分别给出必需用例、版本适用、状态和限制；整体完成要求所有用户承诺范围均满足。安装后核对内存实际版本，卸载后按宿主要求正常重开再验注册清理。

**验证：** TST-080；范围 DOC+LIVE_HOST。**工作包：** TODO-049、TODO-050。

**继承细化：** REQ-006、REQ-041、REQ-042、REQ-045、REQ-046、REQ-047、REQ-048；无新增原AC编号，见本版专用用例。


## 05 接口控制：新增项目协议，非现成 DSH API

### 05.1 命名、版本和兼容策略

当前Runtime按capabilityId保存一个活动descriptor，不能假定同一ID的v1/v2可并行注册。为避免在重构中破坏旧能力，本版采用**新增`apps.authoring.*@1.0.0`项目命名空间**；实际四个原生网关不增加，详细能力仍通过describe/invoke或SDK调用。下表是待实现契约，不是目前可直接调用的接口。

旧`apps.presentation.open_source_component@1.0.0`、26个legacy工具和历史v1构建继续兼容；旧直开结果必须明确`legacy_unverified`，不得冒充通过A.2新创作门禁。新Skill与UI默认走authoring路径。新建/编辑的合格交付须具备新receipt，不依赖禁用旧工具来制造“通过”。

[S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)
| 拟新增能力 | 必需输入 / 前提 | 输出 / 效果 |
|---|---|---|
| apps.authoring.begin | session来源由Host确认；mode=new/edit/open_saved；edit明确viewId；open_saved明确componentId及可选source revision。 | DraftRecord与attempt定位；只生成/关联工作副本，不运行模型、不执行领域写。 |
| apps.authoring.record_build | attemptId/epoch、工作副本、实际构建证据引用；输入/输出一致且exit0。 | BuildReceipt+候选buildId；只归档，不改active view。 |
| apps.authoring.record_preview | attemptId、buildReceiptId、同build的真实验证报告与截图。 | PreviewReceipt；状态PASS/FAIL/INCOMPLETE；不自动发布。 |
| apps.authoring.publish | attemptId/epoch、viewId、expectedViewRevision、buildId、有效Build/PreviewReceipt。 | publicationId/state=mounting；候选装载允许，不等于已展示。 |
| apps.authoring.inspect | attemptId或publicationId的明确一种身份。 | 当前状态、已完成事实、可恢复工作目录和缺失证据；只读。 |
| apps.authoring.cancel | attemptId、expectedEpoch、原因。 | 取消是否早于提交、已提交publication/active信息；不能伪造撤销。 |
| 现有save_component | 明确保存意图、view、mode、componentId/expectedRevision（update）、本次保存视图版本。 | 仍共用共享库与历史CAS；新增expectedViewRevision需用可兼容新descriptor或独立authoring保存包装适配，不能破坏旧schema。 |
最后一行不是复制保存算法。A.2包装校验viewRevision和receipt后调用同一个Presentation保存实现；旧能力仍解释旧输入。`begin/record/publish`需有幂等尝试标识和结构化错误，但不得因其是本地展示元数据操作就执行Hallmark业务mutation。

### 05.2 数据记录的最小字段

所有记录为可序列化JSON；日期用带时区ISO8601；文件引用采用内容摘要与Runtime管理路径。源码/预览路径可定位但不得混入业务密钥。以下新增字段是目标模型，当前`AppsView`并不已拥有全部字段。

| 记录 | 必需字段 | 不变量 |
|---|---|---|
| DraftRecord | schemaVersion, draftId, ownerSessionId, viewId, workspacePath, sourceRevision, epoch, status, createdAt, updatedAt；可选sourceComponentId/selectedSourceRevision/baseRevisionAtOpen。 | workspace可编辑；archive不可编辑；owner不可因焦点改变。 |
| AuthoringAttempt | attemptId, draftId, epoch, sourceRevision, state, startedAt, expectedViewRevision, invocationRefs, evidenceRefs；terminalReason可空。 | 同attempt结果不可改称另一源revision；取消/替代增加epoch。 |
| BuildReceipt | receiptId, attemptId, sourceRevision, sourceInputDigest, lockfileDigest, command, cwd, toolchain, exitCode, startedAt, finishedAt, logRef, distDigest, archiveBuildId, fileManifestRef, verdict。 | PASS需exit0、输入前后不变、每个输出字节可核实；receipt不可覆写。 |
| PreviewReceipt | receiptId, attemptId, buildReceiptId, buildId, protocol, mode, runnerVersion, startedAt, finishedAt, viewportResults[], assertionResults[], verdict。 | 每视口包含截图sha/路径、错误与网络/桥接结果；所有必需项才可PASS。 |
| ViewPublication | publicationId, viewId, ownerSessionId, attemptId, expectedViewRevision, candidateBuildId, priorActiveBuildId, state, readyDeadlineAt, evidenceRefs。 | 只有该候选frame可申请确认；两尝试通过同view CAS只允许一个。 |
| View状态扩展 | viewRevision, activeBuildId, lastGoodBuildId, previousGoodBuildId, pendingPublicationId, validationStatus。 | 失败候选不覆盖active；legacy无证据状态明确。 |
| UiStateSnapshot | sessionId, viewId, sourceBuildId, uiStateSchemaVersion, stateRevision, value, capturedAt, selectionEvidence[]。 | 按view隔离；不是全应用global状态；不包含原聊天草稿副本。 |
### 05.3 BuildReceipt 因果性检查顺序

1. 列出构建输入：源码、CSS、资源、component配置、构建配置、package manifest和lock；排除dist、node_modules、.git与.preview。规范化路径按字节排序，记录每个文件SHA256及长度。
2. 冻结或获得编辑锁；计算构建前sourceInputDigest。使用原命令执行器运行实际构建，记录可核实的command/cwd与工具链版本。
3. 取得exitCode、日志及构建后输入摘要。exit非0、缺输出、输入变动任一发生，receipt为FAIL，不采纳残留dist。
4. 对dist逐文件计算输出摘要；用现有capture归档源码+dist。归档buildId与fileManifest可复核，整个archive可与BuildReceipt反向追溯。
5. 预览优先服务该冻结archive的dist，而不是后续可能被编辑的workspace。候选归档可发生在预览之前，**归档不是发布/保存**，不改变图中“通过检查后才展示”的要求。

这保证的是工程过程可验证。若仅有一份手填的exitCode=0 JSON，仍不足以通过TST055；验收须有实际命令日志和输入/输出证据。

### 05.4 PreviewReceipt 通过条件

每个必测视口必须有实际截图；每个必须交互用例有输入动作与可观察断言；预览装载字节必须匹配buildId/fileManifest；bridge协议/方法与该场景相符；未处理运行异常必须为0。预先声明的可忽略日志需逐条理由，不能运行后为通过临时删掉失败项。

本版示例视口为组件内容宽420/1040 CSS像素，测试必须另记deviceScaleFactor与高度。它们是初始验收样例，不是强制改变原DSH窗口。布局仍要按实际侧栏宽度补测；原型画布尺寸不能替代组件内容尺寸。

previewMode=fixture能证明渲染与受控交互，不能证明真实店铺数据/附件上传/模型消费；mode=live_readonly也不证明真实写。向原Agent提供截图时记录真实文件引用及工具读取事件，不以文件存在推断模型已看见。

### 05.5 Frame 扩展的兼容协商

现有v2 SDK会拒绝supportedMethods里不认识的方法名。因此**不能直接给所有v2客户端追加`renderReady`或`restoreState`字符串**。目标采用hello中可选clientFeatures，Host只返回交集features；不支持/未声明的旧客户端继续获得原8种方法。

新客户端声明`renderReadyV1`或`uiStateV1`后，才在同一项目桥上交换`type: extension`消息，包含feature、action、requestId及原完整身份。新Host必须明确识别该消息，旧Host不广告feature；不能通过猜版本启用。此处协议是项目拥有的扩展，不是新的DSH公共服务。

[S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx)
| feature | 消息 / 检查 | 失败分支 |
|---|---|---|
| renderReadyV1 | frame在首屏渲染、约定数据读取和桥接就绪后报告；含publicationId、attemptId、identity与检查结果。 | 未协商/身份错误/迟到一律不得确认；超时返回failed_mount。 |
| uiStateV1 | 宿主请求export；收到JSON快照后新frame请求import并返回迁移/失败详情。 | 不支持则明确无跨build恢复保证；不可兼容不乱填默认值。 |
| 候选frame身份 | 当前createHost只认可已发布build；须增加明确的未过期publication候选身份校验，仅用于本view的预装载。 | 不得为任意陌生build关闭所有身份检查；取消/替代立刻使旧候选失效。 |
### 05.6 错误码与恢复操作

| 目标错误码 | 含义 | 唯一允许的下一步 |
|---|---|---|
| HOST_CAPABILITY_UNAVAILABLE | 原生@/附件/主动队列契约不可用。 | 保持默认未启用状态；按范围降级/补探针；不能DOM伪造原生输入。 |
| TARGET_AMBIGUOUS | 多个可能view/连接。 | 在原聊天澄清，零写入。 |
| BUILD_INPUT_CHANGED | 构建时源码输入变化。 | 新attempt或明确重构建；旧receipt不可复用。 |
| BUILD_EVIDENCE_INVALID | 命令/哈希/输出回执不满足规范。 | 保留文件与错误，修正证据或实际重建。 |
| PREVIEW_INCOMPLETE / PREVIEW_FAILED | 缺必测项或确有失败。 | 修正后重新真实预览；不能只改JSON verdict。 |
| PREVIEW_BUILD_MISMATCH | 截图报告与候选build不一致。 | 验证同build的新报告。 |
| VIEW_CONFLICT / ATTEMPT_SUPERSEDED | 视图版本或代际落后。 | 保留本副本，重新定位或另开，不自动抬高CAS版本。 |
| FRAME_NOT_READY / FRAME_RUNTIME_ERROR | 文档可加载但应用不可用。 | 保持last-good；检查该build错误；必要时明确恢复旧构建。 |
| UI_STATE_INCOMPATIBLE | 新源码不能接受旧UI状态。 | 保留旧快照，显示恢复失败/重置范围，重新选资源。 |
| COMPONENT_CONFLICT | 已有生产保存冲突码。 | 查看最新或另存，保留源副本；不覆盖他人保存。 |
| CONFIG_REVISION_CONFLICT / CONNECTION_DRAINING | 连接更新竞争或正在排空。 | 等候/明确重读配置；在途调用不迁移。 |
这些新增错误码为目标命名；已有的APP_NOT_ACTIVE、OUTCOME_UNKNOWN及实际选择校验错误继续保留语义，不重命名历史记录。


## 06 创作状态机、提交时点与取消

| 状态 | 允许后继 | 提交 / 失败规则 |
|---|---|---|
| editing | building / cancelled / superseded | 只改workspace；未发表。 |
| building | build_failed / previewing / cancelled / interrupted | 成功生成BuildReceipt，失败保留旧active。 |
| previewing | preview_failed / publish_ready / cancelled / interrupted | 只生成证据；未确认view。 |
| publish_ready | mounting / cancelled / superseded | 前提：匹配PASS预览、owner/epoch/viewRevision。 |
| mounting | mounted / failed_mount / cancelled / superseded / interrupted | 候选frame与当前已确认frame分离。 |
| mounted | 只读检查；新的修改生成新attempt | renderReady验证并CAS提交active为线性化点；原attempt结果不可改为从未发布。 |
| 失败 / cancelled / superseded | 只读检查；显式新attempt可复用工作目录 | 不自动重跑、不自动保存。 |
| interrupted | 只读恢复判定后已提交/未提交；新操作另记 | 依据持久publication，不按当前屏幕猜状态。 |
新建第一次成功时active与lastGood指向该build。更新成功时旧lastGood保存为previousGood，新active/lastGood指向新build。候选失败不改变这些引用。若已确认之后又发生运行错误，记录错误及原已发布事实；恢复previousGood是新的明确恢复动作，不改写历史。

同view发布事务必须原子检查：ownerSessionId相同、expectedViewRevision相同、attempt epoch最新且未取消、receipt指向同build、publication未过期且未被替代。确认时递增viewRevision并记录frame/receipt；工作副本不是该事务的可变输入。

取消先于此事务：候选不得成为active；迟到renderReady无效。取消后于此事务：返回already_published及当前viewRevision；不能声称用户已撤销展示。构建/预览进程协作取消后，其日志与已写文件可保留，事实不会因UI关闭被删除。


## 07 标准操作程序


### PROC-A2-01 原聊天引用

**前提：** 原会话已存在，@契约已核实，Runtime可访问。

1. 在原输入选择应用，保留正文和附件。
2. Host读取真正session；根据已绑定/明确选择定位connection。多个候选有真实歧义才澄清，不每次强制连接向导。
3. Runtime绑定确认后显示可调用；取消或失败按epoch处理，不自动发送。
4. 用户用原发送提交，原Agent获取能力并继续原会话。

**完成判定：** 消息数量在手动发送前不变；绑定集合与原输入引用能对账。

**验收：** TST049..052。

### PROC-A2-02 新建或继续修改

**前提：** 应用绑定与目标view/workspace已明确；首次创建可明确new。

1. begin返回工作副本/attempt；原Agent编辑TSX、CSS、依赖和绑定。
2. 执行实际build辅助程序，读取BuildReceipt及错误；失败返回原Agent继续修正。
3. 预览冻结archive，获取窄宽截图与控件断言；原Agent实际读取反馈。
4. 匹配通过后publish；候选frame装载与renderReady成功才更新active、返回已展示。
5. 用户继续要求修改时沿相同view新attempt重复；当前库资产不自动改变。

**完成判定：** 预览字节与展示相同；每次失败保留旧active；同view版本有序。

**验收：** TST053..063。

### PROC-A2-03 选择与发送

**前提：** view可用，binding/datasetRevision明确，原附件接口可用。

1. 排序/筛选/勾选只用组件状态。
2. 点附加时提交ResourceRef集合给Runtime校验，检查最新datasetRevision。
3. 原输入接纳后显示attached；正文和旧附件不变；允许移除。
4. 用户原发送后记录正式队列；原Agent读取实际JSON再处理自然语言要求。

**完成判定：** 未发送新增模型步0；attached不是消费；业务动作依原请求另行执行。

**验收：** TST065..068。

### PROC-A2-04 保存与历史编辑

**前提：** 当前要保存的view版本明确；用户有清楚保存指令。

1. 首次/另存用save_as；更新用componentId+baseRevisionAtOpen与当前viewRevision。
2. 在保存事务检查已验证view和组件CAS；只通过同一Presentation保存实现写入。
3. 保存成功新增revision并保留历史；冲突保留草稿，显示查看最新/另存。
4. 打开历史版本新建目标会话workspace/view，记录selectedSourceRevision与最新baseRevision。
5. 恢复历史内容以新revision保存，不倒写旧版本。

**完成判定：** 新建/展示/刷新不改组件库；“不错”不保存；历史hash不变。

**验收：** TST070..073。

### PROC-A2-05 刷新与配置

**前提：** 绑定query/compute已登记；存在最近快照；配置作用域明确。

1. 刷新各binding，用同一Runtime路径；每个dataset独立记录状态与时间。
2. 失败保旧并标stale；选择变旧须重新验证；设计/build/保存revision不变。
3. 后台计划只在worker实际装配时启用；记录nextRun与时区，错过最多补一次。
4. 配置更新以revision CAS先排空该连接，再提交新配置并失效客户端缓存。

**完成判定：** 刷新业务mutation/构建/保存计数为0；每个请求使用可解释configRevision。

**验收：** TST074..076。


## 08 持久化、schema 升级和历史策略

当前候选使用schema3；本版新增持久记录建议使用**schema4（拟新增，未经执行）**，而不是继续让同一个schema号代表两套结构。建议专用集合为authoring_drafts、authoring_attempts、build_receipts、preview_receipts、view_publications、view_ui_states；确切DDL与3→4迁移必须在TODO-032评审并通过副本测试。

现有构建实际根为`<APPS_DATA_DIR>/source-components/builds/<buildId>/`，不是A.0目标草图中的顶层builds目录；新方案沿用实际根，不进行无必要搬移。workspace独立于archive；receipt与UI状态由P2记录。新的日志/截图引用纳入一致备份及GC。

迁移3→4不得给旧构建补写虚假PASS。历史view视图修订可初始化为明确migration版本，validationStatus=legacy_unverified；legacy owner=null仍不得自动认领。执行必须先离线副本dry-run，再apply与恢复验证。已有2→3迁移命令只证明其声明范围；没有3→4实现前不能把它用于新schema。

保存组件物理历史保留，用户删除库项只从目录移除；版本和仍打开草稿的构建不自动清掉。清理无引用候选、旧临时view等仍走dry-run及计划校验，不扩大到操作、迁移证据或新receipt的活引用。

回退分为入口回退、代码回退、数据格式回退。入口回退不撤外部业务；旧代码不一定读schema4；有新增资产/绑定/operation/attempt后，必须导出差异并采用能读新格式的兼容代码，不能覆盖旧app.db继续写。
[S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts) [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

## 09 初始运行预算与可观测性

| 项 | 本版约束 | 验证方式 |
|---|---|---|
| 模型结果内容 | 保留当前16384 UTF-8字节预算；完整数据在Runtime句柄/分页，不冒称token。 | 在TST023/046复验实际byte值和完整结果引用。 |
| 候选frame就绪等待 | 建议初始displayReadyTimeoutMs=15000，可按实际环境调整并记录；不是SLA。 | 短/长加载与超时夹具；超时不确认，不自动save。 |
| UI状态大小 | 建议初始64KiB JSON上限；超限明确拒绝且旧状态保留；不得向模型自动注入。 | 边界值/超限/跨build迁移；可按实测调优并改配置记录。 |
| 交互次数 | 排序/勾选/展开/附加但未发送：新增模型步骤=0；业务mutation=0。 | 原DSH日志和Provider计数，不能只观察动画。 |
| 后台错过触发 | 同dataset单飞；同计划错过多次最多补一次。 | 虚拟时钟、进程恢复、请求计数。 |
| 诊断身份 | traceId/invocationId + attemptId/publicationId + owner/view/build/receipt；业务另有operationId。 | 从用户可见失败可反查唯一输入、状态与证据。 |
| 基准 | 用相同fixture和版本比较工具/SDK/混合路径，至少记录样本数、分位数和失败。 | 不把mock耗时当真实平台性能，不预先承诺改善百分比。 |


## 10 继承的 A.0 需求总纲

以下原48项保留其目标措辞，作为整个架构验收范围；新增条款是细化或按CR显式修订，不能因“已有代码”删除原断言。当前运行验收状态见ACCEPTANCE，而不是下列规范文字。


### REQ-001 · 不修改 DSH 核心（继承）

集成实现必须通过已核实的 DSH 插件、工具、会话与展示扩展点工作；不得增加第二个 Agent Loop、复制聊天历史或修改 DSH 核心文件。

**对应原验证：** TST-001；本版受影响映射见验收表。

### REQ-002 · 一个外壳与 N 个接入（继承）

共享 Apps 外壳不得 import 任何具体应用实现。每个应用必须通过清单和 Provider 注册加入；应用 UI 入口数不得随接入插件数增长。

**对应原验证：** TST-002；本版受影响映射见验收表。

### REQ-003 · 一个业务事实来源（继承）

原应用必须继续拥有商品、订单等业务事实。Runtime 只能保存连接、调用证据、查询快照和展示资产；不得把缓存标为实时源记录。

**对应原验证：** TST-003；本版受影响映射见验收表。

### REQ-004 · 一个能力执行实现（继承）

原生工具、SDK、底层 operationId 入口和组件动作必须汇聚到 Runtime invoke；一个逻辑调用只能触发一次 Provider execute。

**对应原验证：** TST-004；本版受影响映射见验收表。

### REQ-005 · 唯一运行时目录（继承）

P2 Runtime 必须维护唯一活动能力目录。DSH Host 只保存可撤销投影和目录版本缓存，不得独立定义第二份能力 Schema。

**对应原验证：** TST-005；本版受影响映射见验收表。

### REQ-006 · 生命周期与卸载（继承）

Provider 启动、Host 投影挂载、停止接收、排空及卸载必须是显式状态。卸载 Host 投影不得删除组件、快照或已提交业务操作。

**对应原验证：** TST-006；本版受影响映射见验收表。

### REQ-007 · 连接独立于应用（继承）

一个 appId 必须允许多个 connectionId。connectionId 必须绑定明确后端实例；店铺 ID 必须保留为领域参数，不得默认等同 connectionId。

**对应原验证：** TST-007；本版受影响映射见验收表。

### REQ-008 · 会话应用集合与焦点分离（继承）

SessionAppBinding 必须以 sessionId、appId、connectionId 为组合身份。focusedApp 只影响界面，不得自动禁用其他已启用会话绑定。

**对应原验证：** TST-008；本版受影响映射见验收表。

### REQ-009 · 显式路由与歧义处理（继承）

调用在多个连接候选间无法唯一解析时，必须返回 needs_clarification 和候选 connectionId；不得按最近使用、第一项或名称相似自动选择。

**对应原验证：** TST-009；本版受影响映射见验收表。

### REQ-010 · 按需工具发现（继承）

默认模型上下文必须只包含应用摘要和已选工作集能力；未验证 DSH 动态 Schema 支持前，必须使用固定 discovery/describe/invoke 投影，不得宣称执行门禁等于按需发现。

**对应原验证：** TST-010；本版受影响映射见验收表。

### REQ-011 · 兼容性握手（继承）

Host 与 Runtime 必须校验 transportMajor、catalogSchemaVersion 和能力版本；支持范围外的破坏性差异必须返回 INCOMPATIBLE_PROTOCOL，不得绕过检验继续执行。

**对应原验证：** TST-011；本版受影响映射见验收表。

### REQ-012 · 输入输出同时声明（继承）

每个能力必须声明版本化输入及输出 Schema，且注册时编译校验。成功结果的 data 必须满足输出 Schema；校验失败不得投影为成功。

**对应原验证：** TST-012；本版受影响映射见验收表。

### REQ-013 · 底层 API 不是第二套业务（继承）

底层调用必须通过注册 operationId 和对应 Provider dispatch，保留请求/响应证据。具备直接 HTTP 的应用可用生成客户端；CLI/MCP 接入可另写适配器。

**对应原验证：** TST-013；本版受影响映射见验收表。

### REQ-014 · 未知写接口显式分类（继承）

目录未登记的底层操作必须先添加效果类型、请求格式和结果解释。不得把未知 POST 当只读；这是结果可解释性要求，不是要求人工审批每次调用。

**对应原验证：** TST-014；本版受影响映射见验收表。

### REQ-015 · 生成 SDK 与调用语义（继承）

SDK 类型、能力文档和原生参数投影必须从同一能力清单生成。SDK 必须返回显式结果联合类型，不得将 unknown 静默转为空对象或自动重试写操作。

**对应原验证：** TST-015；本版受影响映射见验收表。

### REQ-016 · 数据来源时间口径（继承）

返回数据必须分别表达 fetchedAt、sourceDataTime 和 freshness；无法证明源时间时 sourceDataTime 为 null。参考利润必须保留 metricBasis，不得改称结算净利润。

**对应原验证：** TST-016；本版受影响映射见验收表。

### REQ-017 · 幂等身份与请求哈希（继承）

变更调用必须在分发前持久化 operationId；幂等唯一域为 appId+connectionId+capabilityId+idempotencyKey。相同键不同规范化请求必须返回 IDEMPOTENCY_CONFLICT。

**对应原验证：** TST-017；本版受影响映射见验收表。

### REQ-018 · 状态与业务核实（继承）

接受请求、平台接收和业务完成必须分开表示。unknown 只能由只读回查变为已知状态，不得经自动重发变为 running。

**对应原验证：** TST-018；本版受影响映射见验收表。

### REQ-019 · 取消不等于撤销（继承）

取消前未分发的变更必须记 cancelled；分发后缺少完成证据的取消必须记 unknown 或保持 pending 并回查。AbortSignal 必须逐层传递，停止新增子调用。

**对应原验证：** TST-019；本版受影响映射见验收表。

### REQ-020 · 并发与冲突域（继承）

Provider 必须声明同一连接/资源的并发规则。默认变更串行；readOnly 名称不能代替并发安全证明；冲突保存必须使用 expectedRevision。

**对应原验证：** TST-020；本版受影响映射见验收表。

### REQ-021 · 脚本子调用日志（继承）

脚本和批处理必须有 runId，所有能力子调用必须记录 parentRunId、invocationId、appId 和 connectionId。已完成子调用在后续失败时不得从记录中删除。

**对应原验证：** TST-021；本版受影响映射见验收表。

### REQ-022 · 跨应用不假装事务（继承）

跨应用流程必须按步骤汇报结果；补偿必须由应用明确提供，且补偿本身具有独立操作记录。不得承诺通用原子回滚。

**对应原验证：** TST-022；本版受影响映射见验收表。

### REQ-023 · 模型预算与数据句柄（继承）

完整数据必须能以数据集或文件引用读取；模型投影默认不得超过 16384 UTF-8 字节。分页/筛选必须明确 total、returned、cursor 和完整性。

**对应原验证：** TST-023；本版受影响映射见验收表。

### REQ-024 · 稳定错误契约（继承）

业务错误必须有 code、message、retryPolicy 和相关 operationId；retryPolicy 必须区分 never、read_retry、inspect_only。transport 超时不得统一变成业务 failed。

**对应原验证：** TST-024；本版受影响映射见验收表。

### REQ-025 · 普通源码为主路径（继承）

复杂组件必须允许普通 React/TSX/CSS 源码和正常依赖构建；静态/声明式组件可作为快速路径，不得成为自由布局上限。

**对应原验证：** TST-025；本版受影响映射见验收表。

### REQ-026 · 构建与保存分离（继承）

buildId 必须标识不可变构建；viewId 必须标识会话展示实例；componentId 必须标识已保存资产。登记草稿不得自动保存进组件库。

**对应原验证：** TST-026；本版受影响映射见验收表。

### REQ-027 · 桥接握手与协议（继承）

组件握手必须包含 protocolVersion、viewId、buildId、frameInstanceId 和宿主支持方法。旧 frame 回复不得改变新构建状态。

**对应原验证：** TST-027；本版受影响映射见验收表。

### REQ-028 · 通用资源选择（继承）

组件选择必须使用 ResourceRef，不得在通用 SDK 声明商品、店铺或利润专属字段。选择提交必须携带 bindingId 和数据 revision。

**对应原验证：** TST-028；本版受影响映射见验收表。

### REQ-029 · 本地动作不经过模型（继承）

筛选、排序、折叠、分页显示和选中状态必须在组件本地处理；明确业务按钮通过 SDK invoke，不得每次点击都生成 Agent 请求。

**对应原验证：** TST-029；本版受影响映射见验收表。

### REQ-030 · 上下文与消息分开（继承）

updateContext 必须只更新可在后续模型步消费的结构化上下文；requestAgent 必须沿 DSH 已验证会话输入路径提交任务。上下文更新不得自动唤醒模型。

**对应原验证：** TST-030；本版受影响映射见验收表。

### REQ-031 · 确定性会话投影（继承）

任何实际进入模型的组件上下文必须能从 DSH 持久会话记录或正式纯投影重建。仅保存在 iframe 内存中的状态不得被宣称为已送达 Agent。

**对应原验证：** TST-031；本版受影响映射见验收表。

### REQ-032 · 多应用绑定（继承）

单组件必须能绑定不同 appId/connectionId 的多个数据集，各绑定独立报告 freshness 和错误。跨应用实体关联必须注明匹配键与证据。

**对应原验证：** TST-032；本版受影响映射见验收表。

### REQ-033 · 离线与版本冲突（继承）

打开保存组件不得强制业务后端在线；刷新失败必须保留上次成功快照；组件更新必须提供 expectedRevision，历史版本回退必须保存为新版本。

**对应原验证：** TST-033；本版受影响映射见验收表。

### REQ-034 · 明确状态所有者（继承）

P2 Runtime 必须是应用目录、连接、调用记录和共享展示库的唯一写入者；Provider 域状态必须命名空间隔离；P1/P3 不得直接写 SQLite。

**对应原验证：** TST-034；本版受影响映射见验收表。

### REQ-035 · 确定性数据集身份（继承）

数据集键必须由协议版本、appId、connectionId、能力主版本、规范化输入和字段投影生成；对象键排序但数组保序，未知字段必须按 Schema 处理。

**对应原验证：** TST-035；本版受影响映射见验收表。

### REQ-036 · 历史数据可追溯迁移（继承）

v2 到目标数据结构必须在离线副本执行 dry-run，生成逐表计数、旧新 ID 映射和构建文件校验。未知连接/工具映射必须隔离为 needs_migration。

**对应原验证：** TST-036；本版受影响映射见验收表。

### REQ-037 · 禁止双写切换（继承）

切换前必须停止旧入口接收与写入、核实未决操作并取得一致备份。切换后只有新 Runtime 写新库；旧库必须保留且禁止新旧服务同时写同一业务请求。

**对应原验证：** TST-037；本版受影响映射见验收表。

### REQ-038 · 有条件回退（继承）

新系统已产生业务变更后，不得简单还原旧 app.db 并恢复写入。必须先冻结新入口、导出增量操作及回查，再决定兼容代码回退或数据恢复。

**对应原验证：** TST-038；本版受影响映射见验收表。

### REQ-039 · 引用驱动清理（继承）

保存组件引用的构建、数据证据和历史 revision 不得因普通临时文件清理被删除。清理必须先标记，再核对引用，最后按显式保留策略删除。

**对应原验证：** TST-039；本版受影响映射见验收表。

### REQ-040 · 保留旧工具与协议入口（继承）

迁移版本必须保留已有 26 个 hallmark_* 工具名及其参数/结果语义的兼容投影；旧源码 bridge v1 通过适配器工作，不直接强制所有组件重建。

**对应原验证：** TST-040；本版受影响映射见验收表。

### REQ-041 · DSH 兼容探针（继承）

dsh-compat 必须记录实际 Host 版本及各扩展点探针结果。无法核实的动态工具、Agent 消息或上下文接口必须关闭相关特性，不得通过猜测方法名上线。

**对应原验证：** TST-041；本版受影响映射见验收表。

### REQ-042 · 统一分发但独立版本（继承）

V1 必须采用单仓库、一个组合 bundle、一个 P2 运行时进程；逻辑上保留 1+N 原生插件。插件包版本、能力版本、桥接协议和数据库版本必须分开记录。

**对应原验证：** TST-042；本版受影响映射见验收表。

### REQ-043 · 异构应用验证（继承）

第二个验证应用必须是 Notes 等非商品领域，且至少具备 list/get/create/update 与独立 ResourceRef；第二家店铺不得作为多应用验收替代。

**对应原验证：** TST-043；本版受影响映射见验收表。

### REQ-044 · 可定位观测记录（继承）

日志必须携带 traceId、invocationId、operationId（存在时）、runId（存在时）、appId、connectionId、能力版本与耗时；UI 必须显示可复制的诊断标识。

**对应原验证：** TST-044；本版受影响映射见验收表。

### REQ-045 · 自动化故障矩阵（继承）

发布必须覆盖服务不可用、响应丢失、重启恢复、组件旧帧、重复请求、并发保存和协议不兼容；成功路径测试不得替代故障测试。

**对应原验证：** TST-045；本版受影响映射见验收表。

### REQ-046 · 性能与上下文基准（继承）

必须对同一任务比较直接工具、SDK 脚本和混合方式，报告模型输入量、总耗时及成功率；不得引用外部项目提升比例作为本项目验收结果。

**对应原验证：** TST-046；本版受影响映射见验收表。

### REQ-047 · 可复现交付证据（继承）

每个需求必须关联任务、测试和证据路径。代码完成、模拟测试通过、真实后端验收和文档发布必须分别记录，不得互相替代。

**对应原验证：** TST-047；本版受影响映射见验收表。

### REQ-048 · 不扩张本期目标（继承）

V1 不得包含插件市场、第二套权限系统、通用工作流引擎、强制 MCP 改造或自研浏览器；新需求必须经变更单确定影响与新增验收。

**对应原验证：** TST-048；本版受影响映射见验收表。


## 11 非代码交付边界

本包的类型/JSON Schema样例位于templates，均为**拟新增协议参考**，不是已经集成的SDK，也不是现有数据库迁移程序。安装、源代码实现、实际编译、截图、模型消费、真实业务写、正式切换必须分别取得证据。本次审计完成只表示发现与文档已产出。

新接口若与现场原生契约冲突，按TODO-028修改适配器而不是改DSH核心。新截图若与用户设计要求不一致，修实际TSX/CSS并重新生成证据，而不是修改报告结论。
