# DSH Apps · A.2 后续实施工作包

**文件编号：DSH-APPS-TODO-002　｜　修订：A.2　｜　日期：2026-10-07**

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



## 00 执行纪律

本清单从TODO-027续号，不覆盖原TODO-001..026的历史记录。旧任务有实现并不免除本次回归，回归集中于TODO-049。每个工作包必须提交真实diff、相关Schema、测试原始日志、可复核证据、原行为回归和回退说明。

状态为TODO→DOING→REVIEW→VERIFIED；外部前提缺失为BLOCKED；回归失败退回DOING。任务全部子项完成且V签认后才可VERIFIED；“开发完成”“界面像原型”“570个测试”均不是单独完成条件。

变更行为或持久格式先签CR。本文中的“拟新增”文件/能力是实施目标，不是当前checkout可运行命令。除明确进入独立发布/迁移程序外，开发测试使用隔离目录与合成后端，不改用户正在运行的DB/DSH。


## 01 阶段门禁与依赖

| 阶段 | 内容 / 主任务 | 进入 / 离开条件 |
|---|---|---|
| R0 | 审计与宿主契约 / 027–028 | 输入固定；离开须CR与真实Host能力矩阵。 |
| R1 | 原会话入口与定位 / 029–031 | R0通过；离开须@、绑定、A/B目标一致。 |
| R2 | 源码与真实预览证据 / 032–035 | R1可定位工作副本；离开须真实build及v2两视口证据。 |
| R3 | 候选发布与恢复 / 036–039 | R2回执有效；离开须CAS/就绪/失败/取消/恢复。 |
| R4 | 日常创作与组件库 / 040–044 | R3基础就绪；离开须真实原输入/Agent/保存历史闭环。 |
| R5 | 后台/配置/回归/迁移 / 045–049 | 按工作包依赖并行；真实写/切库缺前提可独立BLOCKED。 |
| R6 | 整体验收 / 050 | 可先汇总各范围；只有范围内全部强制项通过才签该范围。 |
阶段编号不表示工期，也不要求所有工作串行。TODO-042需要保存UI，因此依赖TODO-044；TODO-048需要回归结果，因此依赖TODO-049，即使数字较小也不得先跳过。完整机器依赖见 `validation/tasks.csv`。图FIG-19显示按范围放行。

TODO-050可以在某范围BLOCKED时形成**未放行结论**，这不等于TODO-050整体VERIFIED。AUTHORING签认可先完成；未执行真实写/切库的范围仍为NOT_ACCEPTED，不因独立候选发布而免检。
| 工作包 | 阶段 / 责任 | 前置 | 状态 |
|---|---|---|---|
| TODO-027 冻结差异基线并批准语义变更 | R0 / A / V | 无 | TODO |
| TODO-028 现场核实原生输入与会话扩展契约 | R0 / I / V | TODO-027 | TODO |
| TODO-029 实现 @ 目录候选与原引用生命周期 | R1 / I / V | TODO-028 | TODO |
| TODO-030 实现引用与多连接绑定状态机 | R1 / I / V | TODO-029 | TODO |
| TODO-031 建立多组件编辑定位与消息引用 | R1 / I / V | TODO-030 | TODO |
| TODO-032 新增轻量草稿与创作 attempt 持久模型 | R2 / I / A / V | TODO-027, TODO-031 | TODO |
| TODO-033 记录真实构建并关联不可变存档 | R2 / I / V | TODO-032 | TODO |
| TODO-034 接通 v2 同份 dist 预览载体 | R2 / I / V | TODO-033 | TODO |
| TODO-035 生成真实视觉/交互报告并供原 Agent 读取 | R2 / I / V | TODO-034 | TODO |
| TODO-036 实现候选发布与同 view 事务 CAS | R3 / I / A / V | TODO-033, TODO-035 | TODO |
| TODO-037 新增 frame 就绪与最后可用界面恢复 | R3 / I / V | TODO-036 | TODO |
| TODO-038 处理取消、重启和迟到创作结果 | R3 / I / V | TODO-032, TODO-036, TODO-037 | TODO |
| TODO-039 增加声明式 UI 状态恢复契约 | R3 / I / V | TODO-037 | TODO |
| TODO-040 完善现有选择附件桥的生产边界 | R4 / I / V | TODO-030, TODO-037 | TODO |
| TODO-041 区分手动发送与可选主动请求 Agent | R4 / I / V | TODO-040 | TODO |
| TODO-042 跑真实原 Agent 的创作与迭代整链 | R4 / V / I | TODO-031, TODO-035, TODO-038, TODO-039, TODO-041, TODO-044 | TODO |
| TODO-043 落地局部工作台、组件库与交互状态 | R4 / I / V | TODO-031, TODO-039 | TODO |
| TODO-044 完成明确保存、历史回退和 CAS 冲突 UI | R4 / I / V | TODO-036, TODO-043 | TODO |
| TODO-045 统一副本、删除、历史及引用清理 | R5 / I / V | TODO-032, TODO-038, TODO-044 | TODO |
| TODO-046 补齐后台刷新和多绑定数据状态 | R5 / I / V | TODO-030, TODO-039 | TODO |
| TODO-047 明确连接配置更新及缓存失效 | R5 / I / A / V | TODO-030 | TODO |
| TODO-048 分开演练业务写、schema升级和真实切换 | R5 / V / R / I | TODO-045, TODO-046, TODO-047, TODO-049 | TODO |
| TODO-049 重跑原 48 项架构回归与兼容分发 | R5 / V / I | TODO-033, TODO-034, TODO-036, TODO-040 | TODO |
| TODO-050 整个架构按范围验收并形成发布包 | R6 / V / R / A | TODO-042, TODO-043, TODO-044, TODO-045, TODO-046, TODO-047, TODO-048, TODO-049 | TODO |


## 02 逐项工作卡


### TODO-027 · 冻结差异基线并批准语义变更

**阶段/责任：** R0；A / V。**状态：** TODO。

**前置：** 无。

**影响位置：** `docs/requirements/`；`docs/apps-product-requirements-20261007.md`；`本次A.0/HTML/三图`。

**执行步骤：**

1. 固定审计SHA、候选运行版本、原A.0及A.1文档和输入哈希。
2. 保留原48行的reported状态，建立新运行列；对42个remainingRealStatus=NOT_RUN逐行标范围。
3. 签认CR-01图面/显式保存、CR-02资产管理、CR-03新增创作持久记录/兼容协议、CR-04连接更新/后台计划。

**交付物：** 基线清单、审计差异表、四张CR、全量追踪表。

**完成判定：** A/V确认每个新任务能追溯输入或代码，不把已实现基础重新列为缺失。

**停止条件：** 任何冲突未经确认不得按图片位置自行推导。

**回退：** 文档修订可退回评审；不变更用户正在运行的程序。

**需求/验证：** REQ-049 / TST-049、REQ-072 / TST-072、REQ-077 / TST-077。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-028 · 现场核实原生输入与会话扩展契约

**阶段/责任：** R0；I / V。**状态：** TODO。

**前置：** TODO-027。

**影响位置：** `packages/dsh-compat/`；`packages/dsh-plugin/client/plugin.ts`；`test/dsh-compat/`。

**执行步骤：**

1. 通过实际安装版本Inspect/官方扩展源核实 @ source、引用、输入actions、移除和清理签名。
2. 确认原会话目标读取、中文输入法、手动发送和已有原生引用共存。
3. 输出能力矩阵；manual-send与可选requestAgent分别探测，不用master文档代替。

**交付物：** 版本绑定的host-probe.json、最小插件探针、原生签名适配和测试。

**完成判定：** 原UI不被替换；缺能力有明确降级；探针卸载零注册残留。

**停止条件：** 拿不到当前宿主/不匹配则对应能力BLOCKED。

**回退：** 卸载探针或恢复原候选投影；不改DSH核心。

**需求/验证：** REQ-049 / TST-049、REQ-050 / TST-050。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-029 · 实现 @ 目录候选与原引用生命周期

**阶段/责任：** R1；I / V。**状态：** TODO。

**前置：** TODO-028。

**影响位置：** `packages/plugin-apps/client/（新增输入source模块）`；`packages/dsh-plugin/client/plugin.ts`。

**执行步骤：**

1. 用Runtime目录生成 @ 候选，显示名称与稳定appId分离。
2. 接原输入选择、取消、键盘、中文组合态及错误/等待UI。
3. 挂载/卸载所有source、事件与状态订阅，新增失败及多次挂载测试。

**交付物：** 原生@source与桌面回归，不复用HTML里的伪textarea状态。

**完成判定：** TST050通过；选择不发消息/不跳转/不丢附件。

**停止条件：** 发现正文变化或选中自动发送立即停用新source。

**回退：** 移除该source即可回到现有目录按钮绑定，不删持久绑定。

**需求/验证：** REQ-050 / TST-050、REQ-051 / TST-051。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-030 · 实现引用与多连接绑定状态机

**阶段/责任：** R1；I / V。**状态：** TODO。

**前置：** TODO-029。

**影响位置：** `packages/plugin-apps/src/index.ts`；`packages/app-runtime/src/index.ts`；`packages/plugin-apps/client/`。

**执行步骤：**

1. 定义candidate→binding→bound/needs_connection/failed与取消代际。
2. Host核对session，Runtime保存tuple，Client只按回执确认。
3. 覆盖延迟响应、切会话、多个连接、移除单项和重启对账；复用现有bind不维护第二份活动目录。

**交付物：** 绑定状态机、回执接口、竞态测试与实际A/B会话记录。

**完成判定：** TST051/052；A响应不写B，focus不撤其他binding。

**停止条件：** 多连接无法唯一定位时零下游分发。

**回退：** 关闭新增输入绑定路径，保留旧目录管理和DB事实。

**需求/验证：** REQ-051 / TST-051、REQ-052 / TST-052。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-031 · 建立多组件编辑定位与消息引用

**阶段/责任：** R1；I / V。**状态：** TODO。

**前置：** TODO-030。

**影响位置：** `packages/plugin-apps/client/view.tsx`；`packages/plugin-apps/src/index.ts`；`packages/app-presentation/src/`。

**执行步骤：**

1. 将原工具结果扩展为编辑目标定位包并保留旧字段。
2. 原消息卡使用持久viewId，当前focus仅用于无歧义默认目标。
3. 为当前草稿/保存历史/新建分别提供明确入口，不把“打开原消息”映射到最后组件。

**交付物：** 定位包、消息meta适配、歧义提示与回归用例。

**完成判定：** TST053；旧生产appsToolViewReference的显式身份保证不退化。

**停止条件：** 目标目录不属于当前view时停止编辑。

**回退：** 回退新定位投影，旧消息meta继续可读。

**需求/验证：** REQ-052 / TST-052、REQ-053 / TST-053。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-032 · 新增轻量草稿与创作 attempt 持久模型

**阶段/责任：** R2；I / A / V。**状态：** TODO。

**前置：** TODO-027、TODO-031。

**影响位置：** `packages/app-contracts/`；`packages/app-presentation/`；`packages/app-runtime/src/store.ts`；`scripts/migrate-apps.mjs；拟新增authoring持久化与schema3到4迁移模块`。

**执行步骤：**

1. 按SPEC定义Draft、Attempt、发布修订及状态转移；记录元数据，不接管原Agent。
2. 实现独立workspace分配、未保存副本保留/查找、attempt关联invocation。
3. 新增数据库schema4迁移设计与3→4离线副本演练；不得直接把目标DDL施加原库。

**交付物：** 版本化Schema、存储事务、迁移器及夹具；authoring数据所有者图。

**完成判定：** TST054/063；同模板跨会话工作副本互不覆盖。

**停止条件：** 迁移存在未知记录或来源不明目录时停在dry-run。

**回退：** 只切回能读取相应schema的代码；新记录导出后再决定格式回退。

**需求/验证：** REQ-054 / TST-054、REQ-063 / TST-063。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-033 · 记录真实构建并关联不可变存档

**阶段/责任：** R2；I / V。**状态：** TODO。

**前置：** TODO-032。

**影响位置：** `scripts/create-apps-source.mjs`；`packages/source-components/src/index.ts`；`拟新增 scripts/apps-authoring-build.mjs`。

**执行步骤：**

1. 复用原DSH命令运行工程真实build，捕获command/cwd/exit/log和输入摘要。
2. 防止变动输入和旧dist被当新构建；成功后capture仅归档候选。
3. 兼容旧manifest；所有新回执与源码/锁/dist/fileManifest可相互校验。

**交付物：** BuildReceipt、构建执行辅助脚本、旧dist/输入变化/exit1测试。

**完成判定：** TST055/056；使用正常React依赖，不重新限制成固定widget。

**停止条件：** 构建失败或输入变化不允许发布。

**回退：** 候选归档可保留诊断；现有active/保存组件不变。

**需求/验证：** REQ-055 / TST-055、REQ-056 / TST-056。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-034 · 接通 v2 同份 dist 预览载体

**阶段/责任：** R2；I / V。**状态：** TODO。

**前置：** TODO-033。

**影响位置：** `scripts/source-preview.mjs`；`packages/component-runtime/src/apps-client.ts`；`packages/component-runtime/src/host.ts`。

**执行步骤：**

1. 保留readDist冻结资源实现，增加基于v2 Host的明确协议分支。
2. 预览数据采用真实DatasetBinding/ResourceRef结构，标fixture/live_readonly。
3. 双协议测试；版本不匹配明确失败，预览不假扮原生发送或业务写成功。

**交付物：** v2预览命令、协议能力报告、逐资源hash测试、v1回归。

**完成判定：** TST057；新SDK不在旧协议超时或使用假数据替代。

**停止条件：** 待展示字节与预览manifest不一致停止。

**回退：** 旧v1路径保留；新v2能力未通过不设为默认。

**需求/验证：** REQ-057 / TST-057。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-035 · 生成真实视觉/交互报告并供原 Agent 读取

**阶段/责任：** R2；I / V。**状态：** TODO。

**前置：** TODO-034。

**影响位置：** `拟新增预览验证runner`；`packages/source-components/src/index.ts`；`skills/`。

**执行步骤：**

1. 对同一冻结build实际运行窄/宽视口；记录截图、pageerrors、网络失败、握手及主要控件断言。
2. 验证报告/图片SHA、build一致、必测项覆盖；PASS不可由Agent自由文本声明。
3. 技能只指导读报告和图、迭代修改；实际消费通过原会话证据核对。

**交付物：** PreviewReceipt、可读取截图/报告入口、真实样例和反例。

**完成判定：** TST058；失效截图/空白页/运行错不会进可发布状态。

**停止条件：** 缺浏览器环境或图像读取能力按范围BLOCKED，不生成假截图。

**回退：** 撤销无效preview引用，保留构建与错误日志。

**需求/验证：** REQ-058 / TST-058。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-036 · 实现候选发布与同 view 事务 CAS

**阶段/责任：** R3；I / A / V。**状态：** TODO。

**前置：** TODO-033、TODO-035。

**影响位置：** `packages/app-presentation/src/index.ts`；`packages/app-contracts/`；`packages/service/`。

**执行步骤：**

1. 新增apps.authoring.*项目能力（拟新增），不误称DSH现成API。
2. 归档与可见view更新分离，发布核对receipt、owner、epoch、expectedViewRevision。
3. 按SPEC保留旧open_source_component兼容入口并明确legacy_unverified，不把其直开当新链通过。

**交付物：** 候选/发布事务、新能力Schema、幂等publish与竞争测试。

**完成判定：** TST059/060；同view更新只换build引用，不自动save。

**停止条件：** 任一门禁缺失，旧active保持不变。

**回退：** 关闭新发布入口；不抹去已提交publication，恢复需显式记录。

**需求/验证：** REQ-059 / TST-059、REQ-060 / TST-060。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-037 · 新增 frame 就绪与最后可用界面恢复

**阶段/责任：** R3；I / V。**状态：** TODO。

**前置：** TODO-036。

**影响位置：** `packages/dsh-plugin/client/component-frame.tsx`；`packages/plugin-apps/client/view.tsx`；`packages/component-runtime/`。

**执行步骤：**

1. 协商可选renderReadyV1扩展；旧v2 SDK仍只接收到认识的方法列表。
2. 候选frame必须被明确登记为候选身份，避免现有current-build校验拒绝合法候选或放行任意build。
3. 确认可用后CAS提升；React白屏、失败数据、超时及旧nonce不影响旧frame。

**交付物：** 就绪回执、候选frame装载/恢复逻辑、真实运行错误测试。

**完成判定：** TST061；onLoad不等于成功，无旧构建有真实空态。

**停止条件：** 失败时不销毁唯一last-good；不循环自动发布坏构建。

**回退：** 恢复前一确认build或关闭未确认候选，保留失败publication。

**需求/验证：** REQ-061 / TST-061。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-038 · 处理取消、重启和迟到创作结果

**阶段/责任：** R3；I / V。**状态：** TODO。

**前置：** TODO-032、TODO-036、TODO-037。

**影响位置：** `packages/app-presentation/`；`packages/app-runtime/`；`packages/plugin-apps/client/`。

**执行步骤：**

1. 取消epoch持久化后协作中止未来阶段；发布内再次核验。
2. 恢复running为interrupted并只读判定已提交事实，不自动重跑。
3. 测试取消前后事务边界、Host/Runtime独立重开、A/B切换、同view旧attempt晚到。

**交付物：** 取消与恢复状态机、故障注入夹具、重启前后证据。

**完成判定：** TST062/063；已发布不假称撤销，未发布不会晚到覆盖。

**停止条件：** 原业务操作unknown与创作取消分开处理，不用UI取消去撤业务。

**回退：** 冻结相关view发布后恢复明确build，工作副本继续保留。

**需求/验证：** REQ-062 / TST-062、REQ-063 / TST-063。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-039 · 增加声明式 UI 状态恢复契约

**阶段/责任：** R3；I / V。**状态：** TODO。

**前置：** TODO-037。

**影响位置：** `packages/component-runtime/`；`packages/plugin-apps/client/view.tsx`；`packages/app-presentation/`。

**执行步骤：**

1. 协商uiStateV1与schema版本；提供导出、恢复和迁移hooks但不规定布局语言。
2. 宿主以session/view保存状态，frame切换导入，错误恢复明确提示。
3. 选择按ResourceRef和最新datasetRevision重验；独立于Agent contextRevision及原输入草稿。

**交付物：** UI状态SDK、版本迁移样例、宽窄/重开/换build回归。

**完成判定：** TST064/074；承诺保留的字段逐一对账，失效选择不猜行号。

**停止条件：** 不兼容时保留旧快照并提示，不能静默恢复错误选择。

**回退：** 组件未声明扩展仍可显示，但UI明确未承诺跨build保留。

**需求/验证：** REQ-064 / TST-064、REQ-074 / TST-074。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-040 · 完善现有选择附件桥的生产边界

**阶段/责任：** R4；I / V。**状态：** TODO。

**前置：** TODO-030、TODO-037。

**影响位置：** `packages/plugin-apps/client/component-handlers.ts`；`packages/dsh-plugin/client/selection.ts`；`packages/dsh-plugin/client/selection-native.ts`。

**执行步骤：**

1. 复用现有Runtime校验与原inputActions，补稳定去重键和阶段回执。
2. 保留正文/旧附件；处理插入失败、切会话、数据刷新及重复点击。
3. 完成真实附件移除/上传可读性验证，不新写浏览器私有会话存储。

**交付物：** 附件去重与失败回归、真实原输入A/B操作证据。

**完成判定：** TST065；不存在直接清空输入或validated当attached。

**停止条件：** 原生API不可用时显示原因，保留选择，不偷偷发送文本替代。

**回退：** 关闭新附加动作不删除原输入现有附件。

**需求/验证：** REQ-065 / TST-065。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-041 · 区分手动发送与可选主动请求 Agent

**阶段/责任：** R4；I / V。**状态：** TODO。

**前置：** TODO-040。

**影响位置：** `packages/plugin-apps/src/index.ts`；`packages/dsh-compat/`；`packages/component-runtime/`。

**执行步骤：**

1. 分别声明validated/attached/submitted/consumed语义及显示文案。
2. adapter disabled条件下核实默认创作与手动附件发送。
3. 对可选updateContext/requestAgent保留已实现正式投影，重验实际版本而非重新写一套。

**交付物：** 两条发送路径状态表、缺能力降级、原生队列/消费证据。

**完成判定：** TST066/068；附加/本地交互零额外模型步。

**停止条件：** 未取得正式回执不显示已发送；超时先只读查原请求。

**回退：** 禁用可选adapter，默认手动原聊天路径仍可用。

**需求/验证：** REQ-066 / TST-066、REQ-068 / TST-068。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-042 · 跑真实原 Agent 的创作与迭代整链

**阶段/责任：** R4；V / I。**状态：** TODO。

**前置：** TODO-031、TODO-035、TODO-038、TODO-039、TODO-041、TODO-044。

**影响位置：** `test/（新增原生E2E套件）`；`skills/`；`验收手册TST067`。

**执行步骤：**

1. 用实际外部模型、原会话、固定测试数据和普通React工程完成从需求到界面的链。
2. 强制至少一次依据真实反馈的源码修改；记录人工介入，不能预置最终dist充当模型创作。
3. 核对保存、另一会话重开、附件实际读取及可选adapter关闭分支。

**交付物：** 原Agent完整记录、模型版本、输入、构建/预览/发布回执和最终截图。

**完成判定：** TST067与AC-13整链映射通过；失败如实记录。

**停止条件：** 外部模型不可用则仅fixture/local_model保留结果，整链NOT_ACCEPTED。

**回退：** 只读展示任务不改真实业务；删除测试草稿按显式清理计划。

**需求/验证：** REQ-058 / TST-058、REQ-067 / TST-067、REQ-068 / TST-068。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-043 · 落地局部工作台、组件库与交互状态

**阶段/责任：** R4；I / V。**状态：** TODO。

**前置：** TODO-031、TODO-039。

**影响位置：** `packages/plugin-apps/client/directory.tsx`；`packages/plugin-apps/client/workspace.tsx`；`packages/plugin-apps/client/view.tsx`。

**执行步骤：**

1. 按原导航→应用列表→应用内容布局重做插件区，保留原聊天。
2. 连接现有list_saved、历史版本和管理能力，提供多view定位与重开。
3. 完成空/加载/失败/长标题/窄宽/键盘交互，蓝白参考仅作用插件区。

**交付物：** 局部UI与后端接线、视觉状态矩阵、视口截图。

**完成判定：** TST049/069/070；无独立聊天页，无第二组件库。

**停止条件：** 原型外壳或singleactiveApp被复制进入生产时停止评审。

**回退：** 回到现有AppsDirectory和原生组件侧栏，资产数据不迁来迁去。

**需求/验证：** REQ-049 / TST-049、REQ-069 / TST-069、REQ-070 / TST-070。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-044 · 完成明确保存、历史回退和 CAS 冲突 UI

**阶段/责任：** R4；I / V。**状态：** TODO。

**前置：** TODO-036、TODO-043。

**影响位置：** `packages/app-presentation/src/index.ts`；`packages/plugin-apps/client/`。

**执行步骤：**

1. 保留现有save_as/update实现；补source revision、baseRevision与viewRevision定位显示。
2. 自然语言明确保存或按钮都可进入同一保存能力，不增加无必要再次审批。
3. 呈现冲突：保留副本、查看最新、另存；历史恢复新增版本；重命名采用CR确认语义。

**交付物：** 保存/冲突/历史操作UI、数据回归和两会话竞争用例。

**完成判定：** TST070/071/072；不错不保存、冲突不自动换revision。

**停止条件：** 无法证明保存的view是已验证候选时拒绝新正式发布保存。

**回退：** 现有组件历史不改写；恢复前一版本以新revision记录。

**需求/验证：** REQ-070 / TST-070、REQ-071 / TST-071、REQ-072 / TST-072。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-045 · 统一副本、删除、历史及引用清理

**阶段/责任：** R5；I / V。**状态：** TODO。

**前置：** TODO-032、TODO-038、TODO-044。

**影响位置：** `packages/app-presentation/`；`packages/source-components/`；`scripts/apps-maintenance.mjs`；`实际迁移/备份实现`。

**执行步骤：**

1. 实现草稿保留/恢复入口，区分close/remove/delete/purge。
2. 把新增attempt/receipt/UI状态及candidate/last-good纳入备份与GC引用。
3. 在离线隔离库演练历史打开、增量备份、过期GC计划拒绝及恢复。

**交付物：** 删除规则、引用迁移、GC/备份报告、恢复测试。

**完成判定：** TST056/063/072/073；活引用零误删。

**停止条件：** 原型delete与生产历史保留冲突未解决则不提供永久删除。

**回退：** GC默认dry-run；apply失败保留计划与失败对象，不自动重建库。

**需求/验证：** REQ-056 / TST-056、REQ-063 / TST-063、REQ-072 / TST-072、REQ-073 / TST-073。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-046 · 补齐后台刷新和多绑定数据状态

**阶段/责任：** R5；I / V。**状态：** TODO。

**前置：** TODO-030、TODO-039。

**影响位置：** `packages/service/src/apps-main.ts`；`packages/app-presentation/src/index.ts`；`既有调度模块或新增最小调度适配`。

**执行步骤：**

1. 核对真实worker是否存在；若已存在只接线和验证，不重复实现。
2. 持久计划、时区、禁用、下一执行、单飞、重启错过最多补一次。
3. UI逐绑定显示状态与sourceDataTime，刷新不触发构建/保存/业务写。

**交付物：** 调度能力矩阵、workeridentity、计划状态与虚拟时钟/真实Runtime验证。

**完成判定：** TST074/075；关UI仍执行后台读，失败不清空快照。

**停止条件：** 无法证明worker已装配时禁止显示计划已运行。

**回退：** 停用计划即可降级手动刷新，保存设计不变。

**需求/验证：** REQ-074 / TST-074、REQ-075 / TST-075。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-047 · 明确连接配置更新及缓存失效

**阶段/责任：** R5；I / A / V。**状态：** TODO。

**前置：** TODO-030。

**影响位置：** `packages/service/src/apps-main.ts`；`packages/app-runtime/src/index.ts`；`packages/app-hallmark/src/index.ts`。

**执行步骤：**

1. 发布DB活动配置/文件初始播种规则；启动输出差异而非静默覆盖。
2. 实现revision CAS、连接排空、客户端/任务代理/领域缓存失效。
3. 记录调用configRevision并对MockA/B迁移做在途与新请求检查。

**交付物：** 配置更新程序、缓存代际规则、A/B后端精确路由测试。

**完成判定：** TST076；地址显示与实际请求一致；在途不迁移。

**停止条件：** 未决业务操作或无法排空时停止该连接切换。

**回退：** 保持旧revision活动配置；已完成切换的回退必须新revision。

**需求/验证：** REQ-076 / TST-076。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-048 · 分开演练业务写、schema升级和真实切换

**阶段/责任：** R5；V / R / I。**状态：** TODO。

**前置：** TODO-045、TODO-046、TODO-047、TODO-049。

**影响位置：** `docs/apps-migration-runbook.md`；`scripts/migrate-apps.mjs`；`scripts/apps-maintenance.mjs`；`真实Hallmark Provider`。

**执行步骤：**

1. 先完成隔离2→3与拟新增3→4完整副本链及所有新增资产引用恢复。
2. 将价格、库存、已有采集上品各自列测试范围；没有用户明确参数不执行真实写。
3. 分别签BUSINESS-WRITE与DATA-CUTOVER，核查唯一writer及含新增资产/unknown的回退分支。

**交付物：** 源API与三入口覆盖表、每类业务前后态与原回执、完整迁移/回退演练、独立切换签认。

**完成判定：** TST078/079；查询通过不代签写；插件升级不代签切库。

**停止条件：** 任一前提缺失保持对应范围BLOCKED，不影响可独立审查的创作候选。

**回退：** 冻结受影响入口；只读核查unknown，按增量决定兼容代码回退。

**需求/验证：** REQ-073 / TST-073、REQ-078 / TST-078、REQ-079 / TST-079。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-049 · 重跑原 48 项架构回归与兼容分发

**阶段/责任：** R5；V / I。**状态：** TODO。

**前置：** TODO-033、TODO-034、TODO-036、TODO-040。

**影响位置：** `test/app-* / test/apps-* / test/dsh-compat`；`scripts/generate-apps-sdk.mjs`；`scripts/build-apps-bundle.mjs`；`test旧Hallmark覆盖`。

**执行步骤：**

1. 按实际Node/构建顺序重跑仓库测试、类型、构建、smoke；重新生成SDK并检查目录一致。
2. 将原TST001..048逐项映射到本次可访问原始结果；保留原candidate记录。
3. 重验四网关、26legacy工具/HTTP/v1组件与旧历史消息；不强制改动态工具加载。

**交付物：** 原48回归矩阵、SDK/catalog一致性、兼容窗说明、测试/构建原始日志。

**完成判定：** 原功能没有因新闭环回归；据范围和版本判定，不按总测试数代替。

**停止条件：** 新代码与执行版本不同则结果不可用于当前发布。

**回退：** 停发新包；保留前候选但新schema必须由兼容版本读取。

**需求/验证：** REQ-077 / TST-077、REQ-080 / TST-080。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。

### TODO-050 · 整个架构按范围验收并形成发布包

**阶段/责任：** R6；V / R / A。**状态：** TODO。

**前置：** TODO-042、TODO-043、TODO-044、TODO-045、TODO-046、TODO-047、TODO-048、TODO-049。

**影响位置：** `本次03_ACCEPTANCE.md`；`docs/requirements/traceability.csv`；`bundle/Host/Client/Runtime运行identity`。

**执行步骤：**

1. 执行全80项适用检查，分别整理CORE、AUTHORING、BUSINESS-WRITE、DATA-CUTOVER阻断项。
2. 复核实际安装、正常重开、原会话显示、卸载重开清理与数据保留。
3. 生成可访问证据manifest、限制清单、四角色签认、回退条件和新版本图册。

**交付物：** 最终验收结论、四个范围状态、包hash与运行矩阵、完整资料包。

**完成判定：** TST077/080；任何未验范围明确NOT_ACCEPTED；不以文档完成代签。

**停止条件：** 范围内任一强制项FAIL/BLOCKED/NOT_RUN或证据缺失就不放行该范围。

**回退：** 只发布有范围的candidate；恢复入口前按新数据增量审阅，不宣称撤销业务。

**需求/验证：** REQ-077 / TST-077、REQ-079 / TST-079、REQ-080 / TST-080。

**签认栏：** I姓名/日期____；V姓名/日期____；证据manifest____；未决项____。


## 03 现有开发命令：仅用于匹配环境与隔离 checkout

以下入口在固定快照的package.json/候选说明中存在；本次未执行。先使用满足engines且与测试矩阵一致的Node与pnpm，锁文件不随意重写。源码SDK/包生成在全仓测试之前。[S27](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/package.json) [S02](https://github.com/123wusongzhi/dsh-hallmark-app/blob/caea8175b5c7507bf942b2e752a7327063bfdd43/docs/apps-v1-candidate.md)

```sh
pnpm install --ignore-scripts
pnpm run generate:apps-sdk
pnpm run build:plugin
pnpm run build:apps
pnpm run typecheck
pnpm test
node scripts/smoke-apps-bundle.mjs
```

`pnpm run service`仍指向旧Hallmark服务；Apps启动入口是`pnpm run service:apps`。启动Apps前必须显式配置APPS_DATA_DIR与APPS_CONNECTIONS_FILE，使用新隔离目录，不指向原app.db。配置中的连接地址必须来自实际核实，不复制文档里的开发机端口。

新增A.2测试、构建回执和v2验证runner的命令必须在实现后写入实际脚本清单，再用于验收；本手册不提供当前不存在的可执行命令假装已经可用。


## 04 提交与评审最小模板

每个PR至少包含：工作包ID；固定代码父提交；前后行为；改动文件；原48项受影响编号；新增用例；执行commit/环境/版本；原始日志与截图manifest；未覆盖场景；失败恢复；数据格式变更与迁移影响。对协议、所有者、保存语义、候选发布或状态机的变化，必须附对应CR。

出现缺Host契约、真实业务参数或浏览器环境时，可提交代码评审，但不可把相应测试改成PASS。未运行项保留在当前追踪表，发布决策按范围给出。
