# DSH Apps · 整个架构的验收与放行手册

**文件编号：DSH-APPS-ACCEPT-002　｜　修订：A.2　｜　日期：2026-10-07**

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



## 00 验收职责与状态

本手册覆盖原TST-001..048和新增TST-049..080，共80个编号。每个编号可在不同scope运行多次，结果用testId+runId+scope+executedCommit唯一标识。用例数不等于已经执行的测试数；本包所有产品用例的新运行状态均为NOT_RUN。

验证人V执行并记录原始结果；实施人I修复；架构人A签规范偏离；发布人R按适用范围放行。角色可以由同一人承担，但记录中仍须分别给出执行与批准日期，不得用文档作者代签。

状态PASS仅用于该范围全部断言通过且证据可读取；FAIL是实际观察违背断言；BLOCKED是已知缺环境/能力/资料而不能完成；NOT_RUN是未执行。N/A仅允许用于已批准不包含的可选发布范围，不能用来跳过用户承诺的主链。出现P0异常停止受影响操作，先保留证据，再恢复明确last-good或冻结入口。

仓库公布的570项测试/12项原型流程检查属于REPORTED。原CSV的VERIFIED/PASS不被抹去，但它们不是本轮的80项运行结果。本次HTML语法PASS与浏览器BLOCKED_ENV单列在环境报告，不计入产品用例通过数。
[S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S04](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv) [S27](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/package.json) [U01](../references/inputs/chat-component-authoring.html)

## 01 试验范围与四张放行单

| scope | 能证明什么 | 不能替代什么 |
|---|---|---|
| DOC / STATIC | 材料一致、依赖/源码路径存在、字段规则可审阅。 | 运行成功、真实数据或用户流程。 |
| FIXTURE / CLOCK_CONTROL | 合成数据、mock后端、故障/时间可控下的代码行为。 | 真实店铺、原生输入上传、外部模型。 |
| SOURCE_EXEC | 真实源码构建、浏览器加载实际dist与交互。 | 真实DSH装配和原模型消费，除非另有相应范围。 |
| LIVE_HOST | 实际目标DSH版本、原会话、原输入/附件/slots、安装卸载重开。 | 原模型已经读取或真实业务完成。 |
| LOCAL_MODEL | 本地确定性模型的队列/投影机制。 | 外部真实模型自主写代码和视觉迭代。 |
| LIVE_MODEL | 实际配置的外部模型在原会话消费真实输入与反馈。 | 未被执行的业务写入和原数据迁移。 |
| REAL_BUSINESS | 指定真实业务对象的前态/操作/回执/核实。 | 其他动作或未经测试店铺/接口的结果。 |
| DATA_CUTOVER | 实际接入库/资产迁移和唯一writer切换。 | 撤销外部业务效果或所有UI功能完成。 |

| 放行范围 | 必须满足的集合与最低层次 | 未完成时的正确结论 |
|---|---|---|
| CORE | 原48项按本手册最小范围回归 + TST076/077/080；含实际Host装配和卸载、隔离迁移夹具，不含未声明的真实业务写。 | 架构候选未验收；不能仅用源码目录齐全放行。 |
| AUTHORING | CORE通过；新增TST049..075全部适用断言通过；其中@/输入/显示/原Agent/视觉消费必须LIVE_HOST/LIVE_MODEL，默认manual路径必测。 | 可保留底座候选，但“任意原聊天自主制作编辑组件”未验收。 |
| BUSINESS-WRITE | CORE通过 + TST078；上品、价格、库存各自实际范围单列；不以其中一项PASS覆盖其他。 | 该动作未验收；只读/创作成果可独立保留。 |
| DATA-CUTOVER | CORE通过 + TST073新增状态备份恢复 + TST079的真实切换，不只fixture。 | 继续隔离运行或旧接入库；安装插件不是切库通过。 |
**整体通过**要求本次产品承诺的四范围全部达到其最低证据层级。仅一个范围通过的发布只能写“该范围已验收，其他范围未验收”。可选requestAgent关闭时测试其拒绝与默认手动可用；若发布宣称主动请求功能已可用，则其启用路径也必须真实验收。


## 02 固定试验夹具与准备清单

| 夹具ID | 准备内容 | 污染控制 / 证据 |
|---|---|---|
| F-ENV | 干净checkout锁定待测commit；记录Node/pnpm/OS/时区/浏览器/屏幕缩放；生成SDK及Host/Client包。 | 不复用未经说明的旧dist；记录git status与包sha。 |
| F-HOST | 用户明确允许的目标DSH测试配置；原会话A/B，各有正文和原生附件；能力探针。 | 保留用户当前会话；不得擅改核心或以另一实例签当前实例。 |
| F-APPS | Hallmark H1/H2指向可控独立mock；Notes N1/N2；可记录准确请求计数。 | mock名称与真实连接分开；所有路由由明确ID决定。 |
| F-DATA | 固定8条商品：含成本缺失、相同展示名不同ID、低库存边界、来源时间缺失；Notes含同标题不同noteId。 | 数字均为合成；JSON内容与sha存档，不能显示成用户实际店铺事实。 |
| F-SOURCE | 普通React/TSX/CSS工程，锁文件；B0好构建、B1真实修改、Bbad运行错、Bstale旧dist、Bslow无就绪。 | 这些是预期夹具名称，不假称本包已提供可运行测试工程；由TODO033实现。 |
| F-FRAME | v1与v2旧SDK、新协商SDK；窄/宽视口；重复nonce/迟到response可控。 | 截图必须来自这些真实运行工程，不用示意图占位。 |
| F-FAULT | 网络超时、断线、响应丢失、schema不匹配、延迟、Provider未归静止。 | 只在mock/隔离进程注入，不对真实店铺故意制造错误写。 |
| F-CLOCK | 可控时钟，计划跨日/时区/错过触发，两个相同dataset消费者。 | 记录实际/模拟时钟来源，模拟耗时不计真实性能。 |
| F-MIG | schema2离线副本含11旧集合、历史两版和未决操作；schema3含新增Notes/绑定；拟schema4新attempt/receipt。 | 源/目标路径隔离；WAL一致备份；保留哈希，不直接读写原业务凭据。 |
| F-MODEL | 明确外部模型/版本和原DSH会话；只读业务目标和可写测试Notes；原始输入/工具流水。 | 记录人工介入；local_model不得改标签冒充。 |
| F-BIZ | 由用户给定真实店铺、商品/SKU/仓库、值来源和测试参数；上品完整类目/素材。 | 本手册不替用户选真实对象；缺前提该动作BLOCKED。 |
**开测前逐项检查：** 当前commit与包hash相同；待测协议/DB版本明确；原会话A/B已记录；无未解释在途真实写；所有测试连接可辨别；模型步骤计数基线在前一轮已静止后采集；输出目录为本次run的新目录；异常恢复人和方式明确。

开发命令参见TODO第03章。发布包/实际Host/Client/Runtime版本必须分别读取。根package.json的0.3.0与bundle candidate.6可同时存在，不按一个字段判整套运行版本。生成新schema4后，旧迁移命令必须经新版本实现确认，不能直接照抄对原库执行。


## 03 每个用例的执行规程

1. 创建runId目录，写执行身份、commit、版本、scope、输入fixture的hash及前态。
2. 在清楚的时间/日志边界内执行步骤。每个断言记录expected、actual、result及证据文件，而不只在末尾写“通过”。
3. 失败立即保留控制台、网络/工具流水、Runtime状态、frame身份、截图或数据库备份。只读核实已提交事实，不为获取好结果自动重发业务。
4. 按用例清理：停止隔离服务、解绑测试连接、清理明确无引用测试资源。真实业务状态不能由删除本地记录“恢复”。
5. V审查证据完整性，记录PASS/FAIL/BLOCKED/NOT_RUN；R只按范围聚合，A审核偏离。

所有用例共用证据目录`evidence/<releaseId>/<runId>/<testId>/<scope>/`。`result.json`必须指向实际存在的日志/截图；截图文件hash与报告对应；证据缺失不允许PASS。模板见`templates/acceptance-result.json`与`templates/release-gates.md`。


## 04 原 48 项架构回归：继承用例，按当前实现执行

下面保留原测试动作和通过断言，并给出本次执行适配。原A.0文档中的“初始NOT_RUN”是历史计划状态；当前仓库另有报告的PASS。本轮无一项由该历史记录自动继承为PASS。每卡当前运行状态仍为NOT_RUN，执行时填入实际scope和证据。


### TST-001 · 不修改 DSH 核心

**覆盖：** REQ-001。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 安装测试 bundle；运行查询、展示和卸载；对安装前后 DSH 核心文件清单做哈希比较。

**A.2执行补充：** 在真实目标Host安装/卸载/正常重开前后比较核心；不用另一CLI实例代替桌面。

**通过断言：** 核心文件哈希不变；任务使用原会话；卸载无残留注册。

**当前实现定位：** [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S22](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/plugin.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-002 · 一个外壳与 N 个接入

**覆盖：** REQ-002。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 增加 notes Provider 和 plugin-notes，仅修改新增包与分发清单；检查公共代码 diff。

**A.2执行补充：** Notes已存在，先核对相对A.0的新增包与组合根；再在隔离fixture注册临时异构Provider验证无需共享业务分支，不重新开发Notes。

**通过断言：** 公共源代码无 notes 分支；目录出现两个应用；仍只有一个 Apps 入口。

**当前实现定位：** [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S11](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/client/index.tsx)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-003 · 一个业务事实来源

**覆盖：** REQ-003。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-HOST/F-APPS。

**原动作：** 断开 Hallmark 后端；打开已有快照并执行刷新。

**A.2执行补充：** 断开mock或获准的只读连接；核对显示缓存和原业务所有者，不能用新库伪造业务新数据。

**通过断言：** 快照可读且明确 stale/时间；刷新报 unavailable；原业务库没有被替代写入。

**当前实现定位：** [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S14](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-004 · 一个能力执行实现

**覆盖：** REQ-004。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-HOST/F-APPS。

**原动作：** 为同一能力分别通过三种调用入口运行等价输入，记录各自独立 invocationId 和 Provider spy。

**A.2执行补充：** 原生网关、生成SDK、组件入口各一次独立调用，同一个Provider spy计数；同idempotencyKey重复调用另按017检查。

**通过断言：** 每次独立调用 Provider 恰为一次；三入口的结果包络和错误语义一致。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts) [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-005 · 唯一运行时目录

**覆盖：** REQ-005。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** Provider 注册 v1；Host 拉取；再加入一个能力并刷新目录。

**A.2执行补充：** 通过Runtime register/describe/discover及Host目录投影核对；生产连接列表也须来自同源。

**通过断言：** Host 由目录生成新投影；catalogDigest 改变；不存在手工同步的第二份 Schema。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-006 · 生命周期与卸载

**覆盖：** REQ-006。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 挂载并卸载同一应用 10 次；同时保留一个 pending 操作和一个保存组件。

**A.2执行补充：** 分开验证内存清理与正式管理器安装卸载重开；旧candidate的内存记录不能代当前执行。

**通过断言：** 无重复工具和事件监听；组件仍存在；操作可由 Runtime 回查。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-007 · 连接独立于应用

**覆盖：** REQ-007。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 创建两个 Hallmark 后端连接，其中一个含两店；查询每一组合。

**A.2执行补充：** H1/H2相同storeId也必须打不同明确后端；configRevision变化另测076。

**通过断言：** 请求只到指定连接；店铺按输入解析；不复制插件或混淆两类标识。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-008 · 会话应用集合与焦点分离

**覆盖：** REQ-008。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 同一会话启用 Hallmark 与 Notes，切换界面焦点；另一会话保持空绑定。

**A.2执行补充：** 现有多绑定不得照抄原型activeApp；原输入引用增加后重验。

**通过断言：** 原会话仍能调用两应用；另一会话未获得隐式绑定。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S24](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/directory.tsx)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-009 · 显式路由与歧义处理

**覆盖：** REQ-009。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 同名连接两个，省略 connectionId；再用完整 ID 重试只读调用。

**A.2执行补充：** 固定两个真实可区分mock连接；缺连接零分发，明确连接只分发一次。

**通过断言：** 首个请求零下游分发并返回候选；完整 ID 请求仅命中一个连接。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-010 · 按需工具发现

**覆盖：** REQ-010。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-HOST/F-APPS。

**原动作：** 构造 20 应用各 50 能力，组装模型输入；读取实际发送的 Schema 记录。

**A.2执行补充：** 默认四网关属于合格fallback；造1000能力时只读摘要/按需describe，不以执行guard代替Schema预算。

**通过断言：** 完整 1000 能力 Schema 未整体注入；加载工作集可追踪；未支持路径显式降级。

**当前实现定位：** [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-011 · 兼容性握手

**覆盖：** REQ-011。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-HOST/F-APPS。

**原动作：** 分别运行兼容新增能力和不兼容 transportMajor 的服务夹具。

**A.2执行补充：** 分别注入transportMajor不兼容、catalogSchema变更、能力版本不存在；在Provider之前停止。

**通过断言：** 前者目录刷新成功；后者在 Provider 分发前停止并显示期望/实际版本。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-012 · 输入输出同时声明

**覆盖：** REQ-012。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 提交缺输出 Schema 的 Provider，再返回一个结构错误的成功值。

**A.2执行补充：** 分别提供非法输入和Provider非法输出；mutation已经分发时非法输出不得伪成确定失败或成功。

**通过断言：** 注册失败或 OUTPUT_SCHEMA_INVALID；错误包含字段路径；模型不见伪成功。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S14](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-013 · 底层 API 不是第二套业务

**覆盖：** REQ-013。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 对未做语义工具的已登记 operationId 调用一次，检查执行入口与日志。

**A.2执行补充：** 用已登记apiOperationId且经既有Provider；比较与语义能力的相同核心调用路径。

**通过断言：** 无需新增语义工具即可调用；仍生成 invocationId 和正确来源/结果状态。

**当前实现定位：** [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-014 · 未知写接口显式分类

**覆盖：** REQ-014。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 发起未登记 operationId，再注册具备 mutation 分类和回查规则的条目。

**A.2执行补充：** 未知POST测试仅打隔离mock；登记效果和Schema后才可分发。

**通过断言：** 未登记请求为 CAPABILITY_NOT_FOUND；登记后沿统一写入链路执行。

**当前实现定位：** [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-015 · 生成 SDK 与调用语义

**覆盖：** REQ-015。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 修改一个输出字段并重新生成；对 SDK 注入 unknown 返回。

**A.2执行补充：** 实际运行生成器、编译SDK；不能仅查看模板TypeScript文本。

**通过断言：** 类型/文档/工具投影同步变化；调用方必须处理 unknown，Provider 未再次执行。

**当前实现定位：** [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-016 · 数据来源时间口径

**覆盖：** REQ-016。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 源夹具缺时间、缺成本，缓存刷新时间为已知。

**A.2执行补充：** 固定源时间null与缺成本fixture；检查JSON、组件标题和原模型描述均保留口径。

**通过断言：** sourceDataTime=null；缺成本单列；标题及结果未使用实际结算净利润。

**当前实现定位：** [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-017 · 幂等身份与请求哈希

**覆盖：** REQ-017。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 相同键相同内容并发 20 次，再以同键改变价格。

**A.2执行补充：** 同tuple并发键复用；不同app/connection可使用相同key但不互相碰撞；保留dispatch前日志。

**通过断言：** 仅一次业务分发；并发获得同一 operationId；改变价格请求冲突且零新分发。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-018 · 状态与业务核实

**覆盖：** REQ-018。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 模拟平台已接受但响应丢失；重启 Runtime 并恢复。

**A.2执行补充：** mock覆盖HTTP成功但业务pending、partial、unknown；真实应用完成语义由078另测。

**通过断言：** 操作先 unknown；仅执行 inspect；确认完成后 succeeded，原变更端点总调用数为一。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-019 · 取消不等于撤销

**覆盖：** REQ-019。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 在排队前和发出后两个位置触发取消，记录外部请求计数。

**A.2执行补充：** 取消发生在排队/分发前/分发后/Provider未归静止各分支，旧锁不得过早释放。

**通过断言：** 前者外部请求为零；后者不声称业务撤回；子调用不再增加。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-020 · 并发与冲突域

**覆盖：** REQ-020。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 同一商品两次变更与无关只读并发；两个草稿同时保存相同基础版本。

**A.2执行补充：** 同连接exclusive与不同连接并行分别测；CAS冲突不自动覆盖。

**通过断言：** 冲突域内按序；无关读取按声明执行；仅一个保存成功，另一个 REVISION_CONFLICT。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-021 · 脚本子调用日志

**覆盖：** REQ-021。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 脚本先完成 Hallmark 查询和 Notes 写入，再制造计算异常。

**A.2执行补充：** 以多步骤SDK脚本真实执行，核对run/step/invocation/operation链；本次只有候选说明，须取可访问原始结果。

**通过断言：** run=failed/partial 可定位；Notes 完成记录仍在；恢复未重放已完成写入。

**当前实现定位：** [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-022 · 跨应用不假装事务

**覆盖：** REQ-022。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** Hallmark 动作成功后 Notes 写入失败，调用恢复流程。

**A.2执行补充：** 一步成功一步失败或unknown；恢复脚本只处理未完成步骤，不能全流程从头写。

**通过断言：** 结果为 partial 并列出步骤；只恢复未完成步骤；没有自动反向 Hallmark 变更。

**当前实现定位：** [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-023 · 模型预算与数据句柄

**覆盖：** REQ-023。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 返回 1 MiB 夹具，分页获取第二页，并使 spill 写入失败。

**A.2执行补充：** 超16384字节记录完整句柄、摘要与分页；测UTF8中文字节，禁止称固定token数。

**通过断言：** 模型响应受预算限制；完整结果可查；spill 失败给明确错误/更小分页提示，不转无限文本。

**当前实现定位：** [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-024 · 稳定错误契约

**覆盖：** REQ-024。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-APPS/F-FAULT。

**原动作：** 分别制造参数错误、读超时、变更响应丢失。

**A.2执行补充：** 区分read_retry、never、inspect_only；代理/SDK/组件显示一致。

**通过断言：** 结果依次为 failed/never、unavailable/read_retry、unknown/inspect_only。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S15](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-sdk/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-025 · 普通源码为主路径

**覆盖：** REQ-025。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 从空模板创建带自定义状态的组件，再构建并登记。

**A.2执行补充：** 普通源码工程真实构建；新v2预览和原Agent自由创作另测055–058/067。

**通过断言：** 不依赖七类固定控件即可展示；构建错误不覆盖旧可用版本。

**当前实现定位：** [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts) [S18](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/scripts/source-preview.mjs) [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-026 · 构建与保存分离

**覆盖：** REQ-026。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 构建 A、打开两 view、更新其中一 view 到 B，再显式保存。

**A.2执行补充：** 调用open_source后库不增；新authoring发布后也不save；显式save才有component revision。

**通过断言：** A 构建仍可读；另一 view 未被覆盖；只有保存步骤生成组件版本。

**当前实现定位：** [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S17](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/source-components/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-027 · 桥接握手与协议

**覆盖：** REQ-027。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 加载 frame A 后切换构建 B，再送回 A 的延迟 refresh 回复。

**A.2执行补充：** v1、当前v2、带features新v2的组合；旧客户端不得收到其不认识的新方法。

**通过断言：** 旧回复被丢弃；新 frame 数据与当前 buildId 匹配；未知主版本被拒绝。

**当前实现定位：** [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [S20](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/dsh-plugin/client/component-frame.tsx)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-028 · 通用资源选择

**覆盖：** REQ-028。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 分别选择 Note 与商品；刷新数据后提交旧 revision 的选择。

**A.2执行补充：** 商品和Notes选择都用ResourceRef，不隐式加商品字段；原生附件整链另测065/066。

**通过断言：** 两种资源均可表示；旧选择返回 SELECTION_STALE，未静默映射到新行。

**当前实现定位：** [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts) [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-029 · 本地动作不经过模型

**覆盖：** REQ-029。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 连续排序/选中 100 次，再触发一次能力按钮。

**A.2执行补充：** 计数窗口在前一轮Agent静止后；组件搜索/排序/选择/附加但未发送的模型增量均0。

**通过断言：** 本地交互模型请求数为零；能力按钮产生一次 invocation。

**当前实现定位：** [S19](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/component-runtime/src/apps-client.ts) [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-030 · 上下文与消息分开

**覆盖：** REQ-030。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 更新选择上下文后观察请求计数，再执行 requestAgent。

**A.2执行补充：** adapter disabled验证正确降级；若声明启用，必须查真实Host队列；手动创作与之分离。

**通过断言：** 前者不新增模型步；后者产生可重放的原生会话输入或明确 UNSUPPORTED_HOST_CAPABILITY。

**当前实现定位：** [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S23](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/component-handlers.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-031 · 确定性会话投影

**覆盖：** REQ-031。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 上下文被模型消费后重启并重放该模型步；比较归一化输入。

**A.2执行补充：** 本地确定性模型scope保留；当前候选真实模型投影/消费需新执行，不借candidate5结果代签。

**通过断言：** 消费时的 revision 与数据引用可重建；后续 UI 状态未篡改历史输入。

**当前实现定位：** [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-032 · 多应用绑定

**覆盖：** REQ-032。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 商品绑定成功、成本绑定失败、笔记绑定成功；含一个无精确映射对象。

**A.2执行补充：** 组件两个不同app+connection绑定，独立刷新、独立来源和失败状态；不是两家同应用店铺替代异构应用。

**通过断言：** 可用区域继续显示；失败区域独立报错；未映射对象标记 unresolved，不按名称猜配。

**当前实现定位：** [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-033 · 离线与版本冲突

**覆盖：** REQ-033。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-SOURCE/F-FRAME/F-HOST。

**原动作：** 断网打开组件并刷新；同时保存冲突；将历史版本另存为新 revision。

**A.2执行补充：** 离线打开已保存source无需新业务查询；保存竞争与UI状态另测064/071。

**通过断言：** 设计可打开，数据明确 stale；冲突不覆盖；历史版本仍存在。

**当前实现定位：** [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-034 · 明确状态所有者

**覆盖：** REQ-034。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 静态检查跨层依赖并运行所有入口的存储 spy。

**A.2执行补充：** 用依赖图与实际writer进程核对；候选/attempt新增状态不得移到Client localStorage当业务主记录。

**通过断言：** 只有 Runtime 存储接口提交共享写；Host/浏览器无直接数据库访问。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-035 · 确定性数据集身份

**覆盖：** REQ-035。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 改变对象键顺序、数组顺序、连接和能力主版本分别生成键。

**A.2执行补充：** 对象键重排同hash、数组顺序改变不同hash；同查询不同connection不同id，保存canonicalBinding防异常碰撞。

**通过断言：** 仅对象键重排仍同键；其他语义变化不同键；存储保留完整规范输入以核对哈希。

**当前实现定位：** [S16](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-presentation/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-036 · 历史数据可追溯迁移

**覆盖：** REQ-036。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 迁移正常库、含孤儿 view 的库和未知工具引用库。

**A.2执行补充：** 先用既有schema2→3夹具；新增3→4另按073/079，禁止旧命令假称支持新schema。

**通过断言：** 原库不变；可解析记录有映射；孤儿不被自动认领；异常在报告中逐项列出。

**当前实现定位：** [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-037 · 禁止双写切换

**覆盖：** REQ-037。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 暂停旧服务执行切换脚本，故意尝试双启动和错误数据库路径。

**A.2执行补充：** 实际启动两个隔离writer，并核对应用入口冻结不只是lease文件；生产停止另需实测。

**通过断言：** 第二写入者被拒绝；切换检查失败不开放入口；已应答数据未遗失。

**当前实现定位：** [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-038 · 有条件回退

**覆盖：** REQ-038。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 切换后产生一成功变更和一 unknown，再触发回退演练。

**A.2执行补充：** 无增量恢复与有succeeded/unknown/资产/绑定增量阻断两分支；不能删新库使其看起来无增量。

**通过断言：** 流程阻止盲目旧库写入；两条操作仍可追踪；回退结论附校验记录。

**当前实现定位：** [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-039 · 引用驱动清理

**覆盖：** REQ-039。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-MIG/F-FAULT。

**原动作：** 构建 A 被保存组件引用，B 仅未引用草稿；执行清理 dry-run。

**A.2执行补充：** 新增receipt/attempt/UI状态必须加入引用；GC基于同一plan，apply前检查引用未变。

**通过断言：** A 不在删除计划；B 只有满足保留条件才可删除；计划含字节数和引用原因。

**当前实现定位：** [S26](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-migration-runbook.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-040 · 保留旧工具与协议入口

**覆盖：** REQ-040。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 用基线工具清单与旧构建夹具调用新版本。

**A.2执行补充：** 26旧工具名称/HTTP/结果投影/v1构建逐项对照；旧消息不能读错view；默认不注册旧Schema不等于删除旧别名。

**通过断言：** 26 名称覆盖完整；结果语义不退化；hallmark.source.v1 仍能读取和附加选择。

**当前实现定位：** [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S13](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-hallmark/src/index.ts)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-041 · DSH 兼容探针

**覆盖：** REQ-041。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 在支持与不支持 requestAgent/动态 Schema 的两个 Host 夹具运行探针。

**A.2执行补充：** 读取实际宿主版本签名；web主分支/本机另一实例不代替；未支持路径有可验证降级。

**通过断言：** 功能矩阵准确；不支持项返回固定错误并显示可用替代路径。

**当前实现定位：** [S12](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/src/index.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-042 · 统一分发但独立版本

**覆盖：** REQ-042。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 检查产物清单并安装；修改仅 UI 补丁后比对各版本域。

**A.2执行补充：** 核对bundle/Host/Client/Runtime/DB/bridge独立版本、包hash、实际内存；正常重开后才判新版运行。

**通过断言：** 无每应用一进程要求；版本字段可分别解释；安装器仍为 DSH 官方管理机制。

**当前实现定位：** [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-043 · 异构应用验证

**覆盖：** REQ-043。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 以 Hallmark+Notes 完成组合展示和写笔记任务。

**A.2执行补充：** 真实Notes CRUD和Hallmark只读用同一原会话；跨应用数据关联明确，不按同标题猜ID。

**通过断言：** 两种领域正常工作；通用层无 storeId/productId 分支；无需改 Hallmark 源文件。

**当前实现定位：** [S14](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-notes/src/index.ts) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-044 · 可定位观测记录

**覆盖：** REQ-044。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 制造 API 失败，从 UI 诊断标识查 Runtime 与 Provider 记录。

**A.2执行补充：** 从UI错误copy diagnostics反查完整原调用；新增attempt/publication/receipt与业务operation区别。

**通过断言：** 可定位到同一次调用；包含分发/结果证据；没有仅写 unknown error 的不可定位日志。

**当前实现定位：** [S08](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/app-runtime/src/index.ts) [S24](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/plugin-apps/client/directory.tsx)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-045 · 自动化故障矩阵

**覆盖：** REQ-045。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-ENV/F-HOST。

**原动作：** 执行 TST-011/017/018/019/027/033/038 组合故障套件。

**A.2执行补充：** 网络/进程/Schema/取消/冲突与新增创作错误矩阵重跑；没有相应执行证据不因总测试数增加签通过。

**通过断言：** 全部强制断言通过；失败项阻止候选版通过 G5。

**当前实现定位：** [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-046 · 性能与上下文基准

**覆盖：** REQ-046。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-ENV/F-HOST。

**原动作：** 固定 1000 能力、10000 行和 30 次只读流程测试；记录环境与原始数据。

**A.2执行补充：** 同fixture对三入口收集样本数、总耗时/分位数、模型输入字节或真实token计量、失败率；无外部模型只标LOCAL。

**通过断言：** 报告原始样本和分位数；无未经测量的提速承诺；预算硬限制通过。

**当前实现定位：** [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md) [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-047 · 可复现交付证据

**覆盖：** REQ-047。**当前运行：** NOT_RUN。**最小范围：** FIXTURE / 实际命令；对应真实范围另列。**准备：** F-ENV/F-HOST。

**原动作：** 检查 traceability.csv 与一次候选发布证据目录。

**A.2执行补充：** 实际证据包含hash、版本、scope、输入、输出、声明与断言；原开发机不可访问的路径不是本次证据附件。

**通过断言：** 48 个需求无遗漏；未运行测试保留 NOT_RUN；真实业务验收缺口明确。

**当前实现定位：** [S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S04](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。

### TST-048 · 不扩张本期目标

**覆盖：** REQ-048。**当前运行：** NOT_RUN。**最小范围：** LIVE_HOST + FIXTURE。**准备：** F-ENV/F-HOST。

**原动作：** 审查 PR 目录和变更记录；插入一个未批准的流程引擎模块夹具。

**A.2执行补充：** diff检查无第二Agent/聊天/全局tab/复制业务数据库；新authoring账本不是任务调度引擎。

**通过断言：** 越界变更被评审标为 scope_change；未纳入 V1 放行声明。

**当前实现定位：** [S09](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/packages/service/src/apps-main.ts) [S10](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/bundles/apps/server/index.ts) [S06](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-product-requirements-20261007.md)

**结束与异常：** 按第03章保存原始断言及前后态；mock恢复隔离配置。若证据缺失或范围不符，记BLOCKED，不填PASS；真实操作未决只读核实，不重发。


## 05 新增 32 项创作与整体验收用例


### TST-049 · 只扩展原聊天，不移植原型外壳

**覆盖：** REQ-049；AC-13-01。**范围：** LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** F-HOST；已有会话 A/B；安装前核心哈希与原输入记录。

**步骤：**

1. 在 A 原输入写一段正文并加入原生附件；打开应用页，再返回 A。
2. 通过原入口创建组件，收起、展开到工作台并返回；切换到 B 再回来。
3. 卸载或停用测试投影并正常重开宿主；核对核心与导航。

**通过断言：** 无新聊天系统/全局聊天标签；原消息和草稿不被替代；组件 UI 仅占允许插件区域；核心哈希不因插件改造改变。

**必须附证据：** 前后界面、会话ID、核心清单、注册清理、CR-01签认。

**停止/恢复：** 出现原正文丢失或写入另一会话：停止，保留导出，不用重新建会话掩盖。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-050 · 原生 @ 候选、引用与清理

**覆盖：** REQ-050；AC-13-01。**范围：** LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** F-HOST；Hallmark/Notes 均注册；原输入有正文和附件。

**步骤：**

1. 输入 @，分别用键盘和鼠标搜索选择两种应用；测试无匹配、Esc、中文输入法组合状态。
2. 切 A/B；使目录离线再尝试；恢复后刷新候选。
3. 重复挂载/卸载投影10次，检查候选和监听数量。

**通过断言：** 候选名称来自应用元数据且携带appId；选择前后正式消息数量不变；正文/附件不变；注册无倍增；不可用状态明确。

**必须附证据：** inputTriggers实测契约、事件计数、录屏、发送前后日志位置。

**停止/恢复：** 缺扩展契约时记BLOCKED_CAPABILITY，保留目录按钮作为旧降级；不得给 @ 验收签PASS。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-051 · 引用绑定状态机与迟到响应

**覆盖：** REQ-051；AC-13-01。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 两连接 H1/H2；延迟和失败可控；A/B 均存在。

**步骤：**

1. A 选择 Hallmark；多连接不能唯一确定时观察候选；明确选H2。
2. A绑定请求延迟时切B并取消A引用；释放旧响应。
3. 在已有H1绑定的A中添加H2后移除H2；重开宿主。

**通过断言：** 未确认时不得显示bound；只命中H2；A的响应不改变B；原H1保持；数据库与chip可对账；失败不清空原输入。

**必须附证据：** 绑定请求、epoch、tuple、Runtime状态、Client状态快照、重启前后对账。

**停止/恢复：** 无法解释客户端与Runtime差异则禁止该绑定派发；不按第一连接补齐。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-052 · 不把多应用模型退化为单 activeApp

**覆盖：** REQ-052；AC-13-01、AC-13-08。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** A启用H1和Notes N1；B未绑定；同一页面有两个应用入口。

**步骤：**

1. 切工作台焦点Hallmark/Notes，分别执行只读查询。
2. 在A打开含两个应用的组件；切B查看绑定。
3. 关闭A中的Notes，再查询Hallmark。

**通过断言：** 焦点变化不变更绑定；B无隐式授权或草稿认领；关闭Notes不影响Hallmark；共享协议不假定商品字段。

**必须附证据：** 绑定集合diff、两Provider调用计数、UI焦点快照。

**停止/恢复：** 出现单字段覆盖集合时停止并修协议，不增加第二个假Notes图标凑数。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-053 · 编辑目标与历史消息引用明确

**覆盖：** REQ-053；AC-13-03、AC-13-08。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** A打开V1/V2；保存V1的组件C1含两个版本。

**步骤：**

1. 点击早期V1消息卡，再点击V2消息卡；要求“修改第一个”。
2. 用不明确的“改这个”且两目标均无焦点，观察澄清。
3. 从C1历史v1打开，再对当前工作副本编辑。

**通过断言：** 消息卡定位正确view；修改只在目标目录发生；历史入口返回指定source revision，更新基线单独记录；不猜最近view。

**必须附证据：** 消息meta、工具输入/输出、目录diff、目标定位包。

**停止/恢复：** 无法确定目标时零文件/发布写入，等待明确指代。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-054 · 创作工作副本与尝试账本

**覆盖：** REQ-054；AC-13-02、AC-13-08。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** F-SOURCE；空工作区；A/B两会话。

**步骤：**

1. 从新工程创建A草稿；从同一模板为B创建草稿。
2. A连续发起两次编辑尝试，记录目录和revision。
3. 查询未完成attempt与关联invocation，检查可定位错误和工作副本。

**通过断言：** 两会话工作目录独立；attempt与view/component/build身份不混用；每次文件修改和结果有所属尝试；没有自制模型循环。

**必须附证据：** Draft/Attempt导出、目录清单、invocation关联。

**停止/恢复：** 目录指向不可变archive或另一会话时停止；保留原目录不覆盖。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-055 · 真实构建输入与输出回执

**覆盖：** REQ-055；AC-13-02、AC-13-04。**范围：** FIXTURE+SOURCE_EXEC。**当前运行：** NOT_RUN。

**前置与夹具：** F-SOURCE；可执行真实构建命令；保留上次dist。

**步骤：**

1. 成功构建一次；只改TSX但不运行构建，尝试登记为新发布。
2. 在构建中途改变输入；另造exit1但残留dist情形。
3. 重新干净构建并比对源摘要与输出文件。

**通过断言：** 前三类伪成功/变化输入均拒绝发布；实际成功产生唯一receipt；日志、输入、dist与buildId可校验；原可用view不变。

**必须附证据：** 命令记录、exitCode、锁摘要、输入/输出清单、拒绝原因。

**停止/恢复：** BuildReceipt来源不可证时记BUILD_EVIDENCE_INVALID，不把旧dist删除后重新声称通过。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-056 · 不可变归档和历史兼容

**覆盖：** REQ-056；AC-13-05。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** 一个历史v1manifest、一个当前manifest、一个新回执。

**步骤：**

1. 读旧构建并打开副本；新增preview证据后核对buildId。
2. 修改归档字节并执行verify。
3. 对旧工作副本编辑并尝试绕过新回执发布。

**通过断言：** 未篡改旧构建仍可读；preview不改变archive地址；篡改被拒；新编辑不得继承旧回执；历史信息不被覆写。

**必须附证据：** manifest与校验输出、legacy状态、历史版本前后hash。

**停止/恢复：** 验证失败保留坏副本和报告；从已核实备份恢复，不能静默重新哈希认可。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-057 · v2 同份 dist 的真实预览

**覆盖：** REQ-057；AC-13-02。**范围：** SOURCE_EXEC。**当前运行：** NOT_RUN。

**前置与夹具：** F-SOURCE使用新SDK；固定夹具与只读真实数据分别标明。

**步骤：**

1. 加载v2工程，执行hello/getData/getContext/resize。
2. 用v1工程走legacy载体；故意协议不匹配，观察错误。
3. 逐文件核对预览响应字节与归档dist摘要。

**通过断言：** v2可真实握手与读数据；错误协议不得假就绪；每个资源哈希一致；mock/live来源有明确标记；不泄漏为模型业务成功。

**必须附证据：** HTTP资源manifest、桥接日志、协议、数据来源、截图。

**停止/恢复：** 任何资源字节与待发布archive不符则该preview无效，停止发布。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-058 · 真实预览报告与 Agent 可消费反馈

**覆盖：** REQ-058；AC-13-02、AC-13-03。**范围：** SOURCE_EXEC+LIVE_MODEL。**当前运行：** NOT_RUN。

**前置与夹具：** 实际渲染器；F-SOURCE含搜索、选择；视口内容宽度420与1040 CSS像素作为本版测试样例。

**步骤：**

1. 实际截图并操作搜索/排序/选择；注入运行异常再执行一次。
2. 将旧build截图回执用于新build；移除截图文件后验证。
3. 让原Agent读取匹配截图和报告并据一个可观察问题修改。

**通过断言：** 错误/缺图/错build不能PASS；截图不是另画页面；Agent日志可定位实际读取的证据与后续文件diff；两视口视觉审查分别签认。

**必须附证据：** PreviewReceipt、截图sha、错误报告、Agent原会话消息/工具记录、改动diff。

**停止/恢复：** 模型不具备图像读取路径时人工视觉审核可验证图面，但LIVE_MODEL_VISUAL保持BLOCKED。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-059 · 候选存档、允许发布与实际发布分离

**覆盖：** REQ-059；AC-13-02、AC-13-04。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** V0已可用；B1有效；B2缺预览；C1已保存。

**步骤：**

1. 归档B2并尝试publish；核对V0/C1。
2. 给B1合法回执，允许进入候选装载。
3. 重复相同attempt的发布请求并检查写入次数。

**通过断言：** B2只留archive无active变化；C1从未自动新增revision；重复发布返回同一结果而不重复创建view。

**必须附证据：** 候选/active/组件库事务前后记录、拒绝日志。

**停止/恢复：** 门禁绕过视为P0，暂停新发布入口，保持现有可用view。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-060 · 同 view 发布 CAS 与代际一致性

**覆盖：** REQ-060；AC-13-03、AC-13-08。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** A同一view两尝试a1/a2；B另一view。

**步骤：**

1. a1延迟；a2先发布；释放a1。
2. 同expectedViewRevision并发提交两候选。
3. 篡改owner为B，提交A结果。

**通过断言：** 只有一个CAS获胜；active不回退旧attempt；B不变；每个冲突保留自己的工作副本和候选。

**必须附证据：** 事务序列、viewRevision、epochs、冲突包络、两个目录摘要。

**停止/恢复：** 发现后到旧尝试覆盖新view即停止，冻结发布并恢复明确last-good。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-061 · 展示就绪确认和 last-good 恢复

**覆盖：** REQ-061；AC-13-04。**范围：** SOURCE_EXEC+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** B0可用；Bbad加载后抛React错误；Bslow不发就绪。

**步骤：**

1. 发布Bbad观察候选、可见界面与结果。
2. 对Bslow等到本次配置的displayReadyTimeoutMs；送入旧frame就绪回执。
3. 在无B0的新view重复失败场景。

**通过断言：** 不因onLoad称成功；旧frame回执无效；B0仍可恢复/显示；新view显示真实错误；回复含stage与证据ID。

**必须附证据：** frame生命周期日志、可见build前后、错误截图、配置超时值。

**停止/恢复：** 本版超时建议15000ms，属于待测配置不是已测SLA；超时不得提交自动保存。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-062 · 取消与晚到结果的确定性语义

**覆盖：** REQ-062；AC-13-04、AC-13-08。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 可停在build/preview/publishBefore/publishAfter的受控夹具。

**步骤：**

1. 依次在四个时点取消，再释放所有迟到回调。
2. A取消后切B；旧frame/网络响应继续返回。
3. 断开取消回执后只读查询原attempt。

**通过断言：** 取消前事务不发布；提交后不伪称撤销；重复查询不重建/重发；B状态不变；有明确linearization日志。

**必须附证据：** 取消与提交持久化时间/sequence、attempt状态、只读核查回执。

**停止/恢复：** 提交结果未知则先查attempt，不能另造尝试自动覆盖。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-063 · 草稿恢复、关闭与进程重启

**覆盖：** REQ-063；AC-13-04、AC-13-08。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** A未保存编辑；B另有草稿；可隔离重启Runtime/Host。

**步骤：**

1. 关闭A组件并打开另一资产；再找回保留草稿。
2. 构建/预览期间重启隔离Runtime；重开A。
3. 删除保存库目录项但保持A工作副本，再尝试另存。

**通过断言：** 不静默丢草稿；恢复目标明确；未完成尝试不伪标success；无重发；B目录不变；删库不销毁打开的副本。

**必须附证据：** 草稿目录、持久记录、重启前后序列、业务计数0。

**停止/恢复：** 实际业务进程不得为测试任意杀死；只能重启明示隔离实例。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-064 · 组件本地状态恢复和版本迁移

**覆盖：** REQ-064；AC-13-03、AC-13-07、AC-13-08。**范围：** SOURCE_EXEC+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 兼容B1/B2和不兼容B3；有筛选外选择与删除资源。

**步骤：**

1. 设置搜索/页码/排序和选择，切宽窄/关闭重开，再换B2。
2. 刷新删除一个所选ResourceRef。
3. 加载不能迁移的B3，记录用户可见提示。

**通过断言：** 声明可恢复的字段值保持；仅有效选择恢复；不兼容状态不静默乱映射；另会话同组件不共享UI状态。

**必须附证据：** UI状态前后JSON、迁移版本、资源验证、录屏。

**停止/恢复：** 无法恢复则保留旧快照并明确重置范围，不填假默认值声称保留。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-065 · 选择验证、附件去重与输入保护

**覆盖：** REQ-065；AC-13-06、AC-13-07。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** A已有文字和一个其他原生附件；商品与Notes资源各一组。

**步骤：**

1. 同集合不同勾选顺序附加两次，观察待发送附件数量。
2. 在校验后插入前刷新数据版本；在插入途中切B。
3. 模拟原生附件接口失败并重试同一请求。

**通过断言：** 同一有效快照去重；过期/跨会话请求拒绝或留在原会话且可解释；文字/旧附件hash不变；资源语义不是行号。

**必须附证据：** SelectionEnvelope、原输入状态diff、附件数量/内容、失败原因。

**停止/恢复：** 正文或旧附件变更即停止；不使用DOM替换textarea来修补。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-066 · 附加、上传、手动发送与消费分段验收

**覆盖：** REQ-066；AC-13-06、AC-13-09。**范围：** LIVE_HOST+LIVE_MODEL。**当前运行：** NOT_RUN。

**前置与夹具：** 原生附件上传可用；记录原Agent步骤计数；adapter disabled。

**步骤：**

1. 勾选并附加；等待、编辑正文、移除再附加；不发送。
2. 使用原发送按钮提交；在原Agent工具里读取附件实际JSON。
3. 检查用户内容、稳定资源与来源是否在正式会话记录。

**通过断言：** 未发送阶段新增模型步为0；发送后原Agent读取真实字节；attached≠sent≠业务完成；原输入功能仍可用。

**必须附证据：** 原文件引用/内容SHA、输入阶段记录、原会话event/工具结果。

**停止/恢复：** 无原生文件上传/读取能力则BLOCKED；local collector不能替代。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-067 · 原 Agent 自主创作整链必须用真实模型复核

**覆盖：** REQ-067；AC-13-02、AC-13-03、AC-13-06。**范围：** LIVE_MODEL。**当前运行：** NOT_RUN。

**前置与夹具：** 其他基础门禁通过；真实模型可用；只读Hallmark与可写隔离Notes。

**步骤：**

1. 不提供最终成品代码，要求原Agent制作含两绑定的普通React组件。
2. 要求改变一个视觉和一个交互行为，读取本次真实预览后迭代。
3. 人工明确保存；另一原会话打开并编辑；读取选择附件。

**通过断言：** 原Agent执行可追踪；没有第二Agent；每轮截图匹配build；最终组件可用且仅保存动作改库；失败如实记录重试次数。

**必须附证据：** 完整会话/工具流水、模型版本、用户提示、人工干预表、源码diff与回执。

**停止/恢复：** 模型不可用不改用模拟后签PASS；允许保留其他范围的候选验收。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-068 · 手动创作不依赖可选 requestAgent

**覆盖：** REQ-068；AC-13-09。**范围：** LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 分别配置disabled与已核实adapter；同一模板和会话任务。

**步骤：**

1. disabled下手动创建/编辑；尝试组件requestAgent。
2. 启用真实匹配adapter，更新context不发送；再显式requestAgent。
3. 查看原队列、消费快照和重启后的可重建性。

**通过断言：** 手动链不因disabled阻断；主动不支持明确报错；updateContext新增模型步0；accepted不冒称消费完成；回放内容版本可核实。

**必须附证据：** hostCapabilities、queueReceipt、snapshotId/contextRevision与会话记录。

**停止/恢复：** 官方签名不匹配停止主动路径，不能直接写session日志。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-069 · 应用目录与组件库的局部 UI 完整性

**覆盖：** REQ-069；AC-13-05、AC-13-08。**范围：** LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 两应用；空库/多组件库；长中文标题；相同标题不同componentId。

**步骤：**

1. 搜索组件并分别打开同名不同ID；重复打开同view；查看历史。
2. 从原聊天展开到工作区，返回，切换应用焦点。
3. 模拟目录/库不可用及空结果。

**通过断言：** 稳定ID决定动作；原聊天正文/附件保持；目录不成为 @ 前置条件；加载/空/错误状态不显示虚构连接。

**必须附证据：** 界面截图、接口请求、componentId/viewId选择记录。

**停止/恢复：** 发现第二资产数据库或名称猜测，停止新UI写入。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-070 · 新建、编辑、展示和明确保存是四个不同动作

**覆盖：** REQ-070；AC-13-02、AC-13-05。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 库C0；新草稿V1；用户指令分别为“不错”和“保存为X”。

**步骤：**

1. 创建/展示/改样式/刷新；每步记录组件库计数。
2. 说“不错”后观察；随后自然语言明确保存。
3. 按钮另存为Y；取消保存对话框。

**通过断言：** 前几步库不变；“不错”不等于保存；明确指令或按钮才新增；取消无资产写；不新增无必要双重审批。

**必须附证据：** 用户原话/动作标识、库diff、保存invocation、组件revision。

**停止/恢复：** 保存意图不明确则不保存；不得以图库缩略图生成当作保存。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-071 · 源版本、更新基线与保存 CAS

**覆盖：** REQ-071；AC-13-05、AC-13-08。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 组件C历史v1/v2/v3；A打开v1，B打开v3。

**步骤：**

1. 核对A源码来自v1、baseRevisionAtOpen为3。
2. B保存v4；A以3更新并观察冲突。
3. A另存；再明确将历史内容保存为C的新版本。

**通过断言：** 冲突不改C；A源码不丢；无自动提升expectedRevision重试；历史版本hash不变；新版本记录来源与基线。

**必须附证据：** open/save输入输出、版本清单、两个目录hash、冲突UI。

**停止/恢复：** 源版本与CAS基线混用立即阻断保存。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-072 · 重命名、移除视图与删除库项的语义

**覆盖：** REQ-072；AC-13-05。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** 组件C有两个版本；A/B已打开；历史引用存在。

**步骤：**

1. 重命名，核对revision与A/B后续保存冲突行为。
2. 移除A view后检查C；删除C库项后检查B目录。
3. 从B另存并检查历史引用保留。

**通过断言：** 每类操作的影响范围与文案一致；不删除业务商品；历史未被静默purge；被删除库项update失败但save_as可用。

**必须附证据：** CR-02签认、事务diff、目录项和历史文件清单。

**停止/恢复：** CR未确认时保持现有生产行为，不按原型擅改。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-073 · 新增创作证据与状态必须纳入备份和 GC

**覆盖：** REQ-073；本版扩展验收。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** 保留与无引用构建混合；一个未决attempt；历史preview引用。

**步骤：**

1. 生成GC计划并检查每个保留原因；在计划后添加引用。
2. 对旧计划apply，观察拒绝；重新plan仅删除真正孤儿。
3. 一致备份后恢复并打开last-good及历史截图。

**通过断言：** 活引用零误删；旧计划被拒；恢复后新记录与文件hash一致；未决attempt仍可只读解释。

**必须附证据：** GCplan/diff、引用清单、备份manifest、恢复结果。

**停止/恢复：** 失效引用不可解释则停止apply，保留全部相关文件。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-074 · 刷新与构建分离且每个绑定独立报告

**覆盖：** REQ-074；AC-13-07。**范围：** FIXTURE+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** Hallmark H1+Notes N1组件；H1来源时间固定；N1可修改。

**步骤：**

1. 更新N1并断开H1，执行刷新；记录两绑定数据revision。
2. 用旧H1选择尝试附加；恢复H1后再刷新。
3. 检查构建命令、业务mutation和组件保存计数。

**通过断言：** 三种不相关计数均0；成功绑定更新，失败绑定保旧；设计build不变；实际来源时间准确；旧选择未冒充当前。

**必须附证据：** 逐binding快照、源/读时间、调用计数、UI状态diff。

**停止/恢复：** 刷新隐式触发业务写即停止并保留operationId。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-075 · 后台计划真实装配或明确不可用

**覆盖：** REQ-075；本版扩展验收。**范围：** FIXTURE+CLOCK_CONTROL。**当前运行：** NOT_RUN。

**前置与夹具：** 虚拟时钟与两个dataset；UI全关闭；故障可控。

**步骤：**

1. 计划触发时不打开任何组件，检查只读刷新。
2. 时钟前进跨多次触发并重启worker，再恢复。
3. 停用计划/连接；请求scheduled但worker未装配。

**通过断言：** 确有执行证据与nextRun；最多补一次且单dataset单飞；停用无新执行；缺worker明确unsupported；不规定虚构12小时SLA。

**必须附证据：** 时钟轨迹、计划记录、workeridentity、query计数。

**停止/恢复：** 计划启用而worker不可观测时保持disabled，不宣称后台新鲜度保证。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-076 · 连接配置权威与 client 缓存一致

**覆盖：** REQ-076；本版扩展验收。**范围：** FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** H1后端MockA/MockB记录请求；可阻塞在途读取。

**步骤：**

1. 修改播种文件后重启，观察配置差异报告。
2. 请求受控更新H1到B；已有A调用未完成时观察排空。
3. 更新完成后新调用；用旧expectedRevision再修改。

**通过断言：** 权威来源明确；旧调用只在A，新调用只在B；缓存失效；旧revision冲突；不存在UI显示B实际仍打A。

**必须附证据：** configRevision、cachegeneration、A/B请求日志、更新事务。

**停止/恢复：** 无法排空或结果未知则不切换该连接，不能只改显示地址。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-077 · 证据范围、版本和引用不可混用

**覆盖：** REQ-077；本版扩展验收。**范围：** DOC+FIXTURE。**当前运行：** NOT_RUN。

**前置与夹具：** 旧48行CSV与候选5/6记录范围；构造缺失证据、错版本样例。

**步骤：**

1. 导入旧记录而不更改其原值；生成本次追踪表。
2. 将candidate5本地模型记录用于candidate6外部模型，执行门禁判断。
3. 删除证据文件或改动字节，检查校验。

**通过断言：** 冲突和缺证据阻断对应范围；不存在总PASS遮蔽42个NOT_RUN；字节数不冒充token；语法检查不冒充UI执行。

**必须附证据：** 旧/新CSV、manifest、校验结果、scope拒绝记录。

**停止/恢复：** 缺原始档案记EVIDENCE_GAP，不从摘要自动生成PASS原始记录。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-078 · 真实 Hallmark 核心业务按动作分别验收

**覆盖：** REQ-078；本版扩展验收。**范围：** REAL_BUSINESS。**当前运行：** NOT_RUN。

**前置与夹具：** 用户提供专用测试范围；原应用连接就绪；非本次文档生成自动执行。

**步骤：**

1. 先记录源数据与前态；运行同一已登记能力的明确动作。
2. 保留requestId/taskId/operationId及逐项回执；按原后端语义只读核实。
3. 另在隔离mock注入响应丢失，检查unknown不重发；真实环境不故意制造破坏。

**通过断言：** 每种动作独立PASS/FAIL/BLOCKED；结果口径正确且范围不扩大；未知先inspect；原始账本与Runtime可对照。

**必须附证据：** 明确测试指令、前后态、原始回执与只读核实、版本与来源。

**停止/恢复：** 缺素材/类目/任务上下文/真实参数时相应动作BLOCKED，不以查询通过代签。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-079 · 生产数据切换与入口升级分开签认

**覆盖：** REQ-079；本版扩展验收。**范围：** FIXTURE+DATA_CUTOVER。**当前运行：** NOT_RUN。

**前置与夹具：** 隔离完整副本通过后，另获真实切换窗口与明确路径；现有迁移runbook。

**步骤：**

1. 在副本dry-run/apply并从真实compose根打开；核对所有历史构建与查询。
2. 演练无增量回退及有succeeded+unknown增量阻断旧库接管。
3. 实际切换前核实writer/入口冻结/备份；切后记录运行identity并按批准范围验收。

**通过断言：** 计数守恒，隔离不冒充成功；备份可恢复；无双写；新增资产/绑定/操作不被覆盖；DATA_CUTOVER独立签认。

**必须附证据：** 迁移报告、manifest、进程/端口记录、回退判定及执行日志。

**停止/恢复：** 旧writer或未解释unknown存在时禁止切换；--offline-confirmed不替操作者停机。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。

### TST-080 · 整架构分范围放行与可复现交付

**覆盖：** REQ-080；本版扩展验收。**范围：** DOC+LIVE_HOST。**当前运行：** NOT_RUN。

**前置与夹具：** TST001..080结果表；候选包及前版备份；安装/重开可控。

**步骤：**

1. 完成对应矩阵后计算每范围阻断项；缺一个必需用例演示拒绝。
2. 用官方管理器安装，在正常重开后读实际四网关/Client/Runtimeidentity。
3. 卸载/重开再核对注册、资源路由及保留数据；最后形成带限制的签认。

**通过断言：** 无自动代签；候选包hash与运行版本对得上；原始资料可访问；未完成范围显式NOT_ACCEPTED；不把磁盘更新当内存更新。

**必须附证据：** 运行版本矩阵、包hash、原始用例结果、gate-decision和四角色签认。

**停止/恢复：** 关键回归或证据不匹配则保留候选标签，按增量条件回退，不覆盖业务结果。

**记录：** runId____；executedCommit____；scope____；actual____；PASS/FAIL/BLOCKED____；I____；V____。


## 06 AC-13 和产品要求交叉索引

| A.1场景 | 本版主要用例 | 不可替代证据 |
|---|---|---|
| AC-13-01 原@/会话 | 049–052 | 真实原输入与Runtime绑定，不是HTML选择app。 |
| AC-13-02 新建源码 | 054–061、067、070 | 真实命令、同build预览、原Agent读取与实际frame就绪。 |
| AC-13-03 继续编辑 | 053、058、060、064、067 | 实际文件diff、同view CAS、本地模型计数0。 |
| AC-13-04 失败/取消 | 055、059–063 | 错误注入/取消事务顺序/最后可用显示。 |
| AC-13-05 保存/版本 | 056、069–073 | 真实库CAS和历史bytes，不是localStorage。 |
| AC-13-06 附件 | 065–067 | 原生附件上传/移除/原发送/真实JSON消费。 |
| AC-13-07 刷新 | 064、065、074、075 | 真实只读快照、逐绑定失败、无构建或业务写。 |
| AC-13-08 跨会话 | 052–054、060、062–064、069、071 | A/B独立workspace/view/输入、迟到隔离。 |
| AC-13-09 手动与主动 | 066、068 | adapter关闭手动仍工作；主动启用另有正式队列记录。 |


## 07 建议测试执行顺序与故障矩阵

先完成CORE的契约/执行/兼容fixture；再跑原生入口与源码实际构建；再用受控错误测试发布/恢复；最后跑真实原Agent自主创作、真实业务动作及真实切换。不得先在真实平台制造丢回执来测试幂等；这类故障用mock完成，真实范围通过只读核实证明正常动作语义。

| 故障注入 | 要保持的不变量 | 主要用例 |
|---|---|---|
| @绑定超时 / A切B | 迟到A不改变B，正文/附件不丢。 | 050/051 |
| 旧dist / 构建exit1 / 输入变化 | 无新active、无保存revision。 | 055/056 |
| 协议不匹配 / 错build截图 | 预览不能PASS，保持旧view。 | 057/058/059 |
| React throw / 白屏 / 握手后无数据 | onLoad不能确认，last-good仍在。 | 061 |
| 两个attempt竞争 / 取消晚到 | 一个CAS获胜，已提交事实不假撤销。 | 060/062 |
| 进程重开 / 未保存草稿 | 只读恢复，不自动重跑/发布，目录不丢。 | 063 |
| UI schema变化 / 资源被删 | 旧状态有恢复结果，失效选择不按行号迁移。 | 064/065 |
| 附件失败 / 多次点击 | 原正文/附件不变，未发送模型步0。 | 065/066 |
| 只读刷新部分失败 / 时钟跳跃 | 每绑定独立保旧；最多补一次；不构建/写业务。 | 074/075 |
| 连接地址变更 / 在途操作 | 在途不换后端；新调用使用新configRevision。 | 076 |
| migration缺资产 / 双writer / 新增unknown | 停止apply/cutover；备份/操作保留。 | 036–039/073/079 |


## 08 证据记录格式与放行判定

每个result至少记录：testId、runId、requirementIds、targetCommit、executedCommit、scope、environment、versions、fixtureRefs、steps、assertions、status、limitations、artifactRefs、startedAt、finishedAt、executor、reviewer。所有artifactRef含path/sha256/bytes；空结果使用null/NOT_RUN，不写伪造时间或虚构通过的断言。

聚合逻辑：先筛版本与scope适用，再检查强制断言与原始文件，最后签范围。执行commit不同必须由V审查实际diff并批准复用，不能默认复用。候选6未重跑的候选5模型路径仍保持原scope和commit，不改标签。

自动测试报告、截图、HTML原型检查、人工视觉审查和真实业务回执分别存储。Performance记录量纲：UTF-8 bytes、模型真实token或计费统计注明来源；不能把前者换算成未经测量的token收益。

见模板`templates/acceptance-result.json`、`templates/build-receipt.schema.json`、`templates/preview-receipt.schema.json`、`templates/release-gates.md`。这些是记录模板，空白模板不构成执行证据。


## 09 本次交付时的验收结论

| 范围 / 检查 | 当前状态 | 原因 |
|---|---|---|
| 代码静态比对 | 已完成本报告声明范围 | 已读取关键路径，明确实现/缺口/风险/证据边界。 |
| 上传HTML身份与语法 | 身份MATCH；语法PASS | 与仓库blob相同；仅node --check，不代表UI行为。 |
| 本次HTML浏览器复验 | BLOCKED_ENV；0断言 | 加载前环境策略阻断；不推断产品失败。 |
| CORE / AUTHORING | NOT_ACCEPTED（本轮） | 本轮产品用例NOT_RUN；需要匹配环境和可访问原始证据。 |
| BUSINESS-WRITE | NOT_ACCEPTED | 本轮未操作真实业务；仓库也明确列出了未执行边界。 |
| DATA-CUTOVER | NOT_ACCEPTED | 未执行用户接入库/资产正式切换；不能用安装/fixture代签。 |
本表不是否定仓库已报告的既有成果；它仅防止把静态审计自动变成新一轮生产签认。相关旧记录作为REPORTED继续保留。[S03](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-publication-validation-20261007.md) [S04](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/requirements/traceability.csv)
