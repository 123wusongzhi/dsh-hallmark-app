---
name: hallmark-component-design
description: 在原 DSH 会话中用普通 React 源码创建和编辑 Hallmark 组件，执行冻结构建、真实双视口预览与迭代，通过 Apps 网关确认显示、明确保存及历史恢复。
user-invocable: true
---

# Hallmark 组件设计 · A.2

先读取 [Hallmark 视觉规范](references/visual-direction.md)。当前用户偏好蓝白业务界面、有颜色和清晰信息层级，窄栏使用图文列表、宽页可以使用表格；这些是可修改的设计起点。只调整应用目录、工作台、组件库、聊天消息中的组件入口与右侧组件视图，保留 DSH 原侧栏、已有会话与原输入框。

用户在任意已有会话输入 `@` 选择应用，然后自己发送原聊天请求。同一个原 Agent 使用原文件、命令与 Apps 网关处理创建或编辑请求。不要建立独立聊天标签、额外 Agent 循环或替代 DSH 的聊天界面。引用 chip、会话应用/连接绑定与 Agent 手动发送是三个不同事实；不能把一次选中直接当作 Runtime 已授权绑定。

## 先核实正在执行的能力

使用原 `apps_list` 和 `apps_describe` 网关确认应用、连接及精确能力版本。新路径是 `apps.authoring.begin / record_build / record_preview / publish / inspect / cancel / save_component@1.0.0`，通过 `apps_invoke` 调用；组件库操作继续使用 `apps.presentation.*`。所有调用使用正在处理的原 sessionId 与明确启用的 appId/connectionId，不猜店铺、数据集或组件身份。

Host 提供的 `authoringGuidance` 是安装目录、source starter、SDK、构建/预览 CLI 与本机 Runtime 参数的定位来源。使用其中实际返回的路径，先检查文件存在和当前版本。当前安装包包含 `source-starter/create-apps-source.mjs`、`lib/apps-authoring-build.js`、`lib/apps-authoring-preview.js`，不要求访问原 monorepo TS 源码。若正在执行的 Host 没有新能力，说明实际版本及缺少的能力；旧 `hallmark_open_source_component` 只保留旧兼容语义，不能冒充已验证的新 authoring 发布。

## 当前创作路径（替代历史步骤）

以当前 Host 的 authoringGuidance 为准。历史交接、旧组件 README、旧预览脚本中的调用方式只作历史证据，不作为新组件的步骤。不要按旧文档强制再改一版、使用默认 fixture 或自行猜测宿主是否支持分页。

- apps_describe 只传 capabilityId/version，不传 appId。
- 商品列表在 input.fields 指定所需字段，建议 title、imageUrl、sku、status、currency、pricing、profit、stock；身份字段和 total/cursor 自动保留。详情需要 sources 等字段时再读取，省略 fields 保留完整响应。binding.projection 不负责裁剪响应。
- `list_store_products` / `hallmark.products.list` 的可选 `status` 只与源数据顶层 `row.status` 精确相等，缺失状态不匹配，不翻译或推断状态。仅在售绑定设置 `input.status: "on_sale"`；`query` 只做全文搜索，与 `status` 取交集，`total` 为过滤后的总数。禁止 Agent 遍历全店或客户端拉取全量后筛选在售商品，保留现有分页、`fields` 和同步语义。
- 大结果的 sample 是截断样本；需要完整内容时按 authoringGuidance.resultReader 写 request.json 并运行读取器，使用返回的 outputPath。不要重复查询、猜结果文件或查 SQLite。
- 列表分页统一使用 useApps.readBindingPage(bindingId, cursor)，协商 bindingPagesV1 后由宿主同步更新当前页 payload/resources/revision。页大小固定取 binding.query.input.limit；附加到聊天暂未开放，不生成附加按钮或为附加设置勾选；分页不自动同步 Agent 上下文。invokeCapability 仅做独立查询，不用于这条分页链路。
- 先执行标准 build 和 live_readonly preview，出现具体失败后再定位相关实现；不要预先遍历安装包源码、旧报告或数据库。
- 复用未变源码的 build 回执和预览生成的两张截图。外网图片使用预览缓存/占位，图片慢不触发重建或额外等待截图。

## 普通源码、构建与反馈循环

1. 先查询现有组件、模板与真实业务数据。仅使用已有组件调用 `apps.presentation.open_component`，不开始源码创作；新建调用 `apps.authoring.begin` 的 `mode:new`；修改当前会话组件源码使用 `mode:edit` 和原 viewId；从保存版本修改源码使用 `mode:open_saved`、componentId 及可选 revision。保留返回的 draftId、attemptId、epoch、sourceRevision、expectedViewRevision、workspacePath。同一 begin 重试使用相同 attemptId；新一轮源码修改明确开始下一 attempt。
2. `begin` 已创建独立工作副本目录。用安装包 starter 初始化该空目录，或复制合适模板的源码、资源、package.json 与锁文件；不复制 node_modules。生成器拒绝覆盖非空目录。普通 npm 依赖可按实际设计安装，保留真实产生的锁文件，不能伪造 lockfile 或 build PASS。
3. 直接编辑 TSX、CSS、JavaScript、图片与其他资源。允许条件、循环、局部状态、搜索、排序、图表与派生计算，不把旧 ViewSpec 词表或宿主 React 版本当作源码上限。新 A.2 页面使用 `@dsh/apps-component-runtime/apps/react` 的 v2 SDK，旧 v1 页面继续使用原根入口与 `/react`；协议必须与预览和 Host 匹配。新 SDK 的 required readiness assertions 必须实际读取 React commit 后的 DOM/数据，不能返回固定 PASS。
4. 先读 authoringGuidance.developerDocs.index，按其中流程用 checkRunner.prepareRequest 自动准备请求（仅填 attemptId）；只维护 `.preview/plan.json`，不要将请求放在源码根目录或手改 epoch/sourceRevision。build 使用 Host 的实际路径与 begin 返回身份；preview 使用 live_readonly 和真实交互断言。搜索、勾选、分页、刷新、附加按实际功能验证，requiredMethods 与动作对应。fixture 仅用于明确离线测试。
5. 优先运行 checkRunner，Windows 使用 windowsCommand。薄启动脚本等待真实进程退出；现有检查器顺序构建、自动登记构建回执、双视口预览、自动登记预览回执。无需再手动执行这四步。凭据从 keyFile 读取，不把令牌内容写入聊天或命令行；不手造 PASS 报告。
6. 阅读 result/summaryPath 的失败项、回执及 420/1040 截图。需要顶部、底部或交互后画面时提前在 assertion 配置 screenshot，不额外搭建 Host/CDP。仅在发现具体布局或交互缺陷时修改源码；通过后复用成功回执。异常读返回的独立错误摘要路径，并结合 inspect.summary 定位。
7. 调用 publish，带同一 attemptId、epoch、buildId、两份回执 ID、viewId 与 expectedViewRevision。publish 仅表示 prepared，当前聊天自动加载；inspect.summary 确认实际展示。展示失败不自动重建；保存由用户明确要求后单独执行。

单独 build/preview CLI 仍可用于只需要某一阶段的任务，正常新建走上面的 checkRunner 流程。

组件设计与数据绑定分别管理。数据刷新只更新原绑定的数据与 freshness，保留设计、源码 buildId、组件版本、本地排序和可兼容 UI 状态。多绑定分别报告成功、失败或陈旧时间，不能用一个绑定的成功覆盖另一个绑定的错误。

## 用户选择、原聊天与可选主动请求

组件通过薄 v2 SDK 获取数据、刷新、读取上下文与附加选择。使用宿主返回的 ResourceRef、bindingId、datasetId 和当前 datasetRevision；不能通过显示名称猜业务身份。选择附件必须附到该原会话输入区，保留用户已经输入的正文，等待用户手动发送。Agent 收到附件后先读取并核实稳定身份，再按用户指令处理。

筛选、排序、分页、勾选属于组件本地 UI 动作，不等于发消息、调价、库存或上品授权。`updateContext` 与可选 `requestAgent` 是另一路经过 feature/adapter 协商的主动请求；未广告能力则明确不可用。accepted 只说明已持久排队，Agent 实际读取附件、截图或上下文仍需原 native history 的消费证据；不要复制整段原输入草稿到 UI snapshot。

## 明确保存、冲突、历史与 UI 状态

新建、编辑、显示与正式保存是独立动作。用户明确说“保存为某名称”或点击保存，就调用同一个 `apps.authoring.save_component`；不增加第二次无必要审批。必须使用当前已确认的 viewRevision，并记录用户保存原话。已验证保存版本的构建、设计和绑定定义未变时，普通打开或重开编辑后均可直接保存，无需重新构建、预览或发布。尚未发布的源码修改不在当前保存内容中，需先检查并发布才能保存新设计。

`save_as` 使用稳定 idempotencyKey 防止重试生成重复组件；`update` 使用当前 view.sourceComponentId 和 view.baseRevision。成功回执的 component.view 是后续保存目标与基线；另存成功后更新新组件，同一副本连续保存无需重开。只跟随本次成功回执推进，不把其他旧副本的基线自动提高。

打开历史时，selectedSourceRevision 是选择的源码版本，baseRevisionAtOpen 是打开那一刻的库项最新元数据版本；当前更新基线由 view.baseRevision 表示。不能用选中的历史 revision 冒充当前基线。未改设计的历史副本可直接保存为新增版本；修改后才构建、预览、确认，旧版本保留。

VIEW_CONFLICT / COMPONENT_CONFLICT / ATTEMPT_SUPERSEDED 时保留工作副本，展示最新信息与“保留副本、查看最新、另存”选项；不自动提高预期版本或重试覆盖。重命名比较当前元数据 revision 并新增历史版本。关闭/从会话移除只管理视图；组件库删除移除库项，不删除已有工作副本、历史版本或仍被引用的 build。物理 purge 由独立维护流程处理。

只有声明 uiStateSchemaVersion 的组件承诺跨 frame/build 恢复。按 sessionId/viewId 保存可序列化搜索、排序、页码与选择证据；选择逐资源验证，明确移除失效项或要求重选。schema 不兼容时保留旧快照，明确执行迁移，候选确认后再按 stateRevision CAS 写回；不静默填默认值或丢弃旧状态。

## 数据表达与旧兼容

真实金额标明币种、时间与口径，采购成本不称售价，参考利润不冒充实际结算。缺失图片、价格、利润、库存、趋势明确表示缺失，不填装饰性假业务数据。趋势图要求真实有序时间数据。用户还在比较方案时展示候选，不把建议写成已确认要求。

旧 ViewSpec 的 render_view/update_view 与旧 v1 source SDK 继续维护。旧 grammar/widgets/layouts/limits 只属于旧路径，React/CSS 不塞进旧 spec。外部设计源码保留来源与许可，可参考已安装 Impeccable、shadcn 等技能；这些技能不改变原聊天的权限与提交语义。


## 同一尝试继续执行

交互计划已明确时使用当前 Host guidance 的 checkRunner：请求包含 build 和 preview，由现有脚本顺序执行构建、登记构建回执、预览、登记预览回执，不自动发布或保存。重复运行同一请求复用有效报告；登记响应丢失时先 inspect 原回执。优先读摘要里的 reusedBuild / reusedPreview、stage 和 nextAction，不另写包装脚本。

源码、锁文件、命令或相关环境改变时不能复用旧构建；已登记的预览回执也不能在同一 attempt 中替换。明确输入改变而返回 NEW_ATTEMPT_REQUIRED 时按现有 begin 流程开启新尝试；调用异常先结合 inspect.summary 确认已有成功回执，不能反复提交旧请求。尚未登记的预览计划变化只需重跑预览。仅展示失败使用 inspect，不运行 checkRunner。

## 随包开发文档与可靠检查

先读 authoringGuidance.developerDocs.index；数据结构、首次加载、分页与附加以该说明和 product-list 示例为准，不从旧临时数据或预览器源码反推。用 --template product-list 初始化后按业务需求修改。

Windows 优先 checkRunner.windowsCommand，它等待进程退出并提供 exitCode、result 和日志。相同请求恢复原报告，verifiedAt 是原验证时间；实时数据变化不要求恢复任务重建，需要验证最新数据才开启新 attempt。错误调用使用独立 .error.json，先结合 inspect.summary 判断已有成功回执。

在正式 preview 的 assertion 上配置 screenshot:{} 或 screenshot:{selector:"#pager"}，从摘要读取交互后的顶部／底部图；不另起 Host/CDP。只为具体可见缺陷修改源码，通过后发布。

真实平台同步和绑定重读分开：同步成功再重读，等待期间保留旧数据。耗时同步只在一个声明视口验证（viewports / requiredMethodsOnce），布局和分页双视口检查；不制作 FAST_CHECK 或只验证“已触发”的替代构建。详见开发者文档的“耗时同步与双尺寸验证”。
