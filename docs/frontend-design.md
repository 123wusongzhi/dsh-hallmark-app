# Hallmark 前端：常驻三栏应用页面

## 2026-10-06 新增视觉要求

用户要求有颜色的成熟组件设计，并指定[《人人都是 UI 设计师》](https://x.com/longhaiqwe123/status/2106216781174251724)作为设计依据。当前方向为蓝白品牌色、完整色阶、清楚的信息与操作层级、合理间距和真实状态设计。灰度仅用于过程检查，成品预览应提供完整配色。具体规则统一维护在[Hallmark 视觉规范](../skills/hallmark-component-design/references/visual-direction.md)，组件设计技能按需加载。

用户正在比较 A 表格、B 图文列表、C 商品卡、D 看板；未选定新模板。本次仅更新技能与设计要求，插件 0.2.3 的渲染器与已保存组件不因此自动改变。下文早期“单一宿主强调色”等实现记录不取代这项新要求。

## 2026-10-06 聊天态确认

用户以截图确认：聊天态保留 DSH 原生左侧导航，中间为原会话，右侧为组件工作区；不在应用页面嵌入第二个聊天框。0.2.1 的进入按钮仅激活并返回会话，未自动展开组件栏，是本轮要修复的入口缺口。

当前 0.2.2 插件开发采用单次导航意图：目标会话的原生输入槽提交后，再核对会话与右栏挂载身份，打开本会话组件列表。右栏宽度及拖动由 DSH 管理，插件适配现有面板空间。视觉采用与工作台一致的 Hallmark 蓝白标题、组件卡片与可理解的空态。具体完成和加载状态见发布记录；代码检查或合成截图不代表原生界面已验收。

草稿与工作区标签目前仅在应用页面仍挂载时保留；进入原生聊天、刷新页面或插件重载后，未保存草稿和临时标签尚未跨页面恢复，已保存组件不受影响。以下早期实现说明中的标签保留范围均指应用页面内部切换。

## 最新布局与设计方向

用户最新参考图明确否定此前浮动窗口。当前实现是 **DSH 原侧栏 + 页面内约 230px 应用列表 + 右工作区**；不注册 shell.overlay、不使用 dialog/showModal、不自动跳回聊天。此前浮窗方案已退役，不能作为当前验收描述。

设计读取：本机单人经营工作台，克制、可信、高可读，遵循 DSH 原生主题。参考 [taste-skill v2](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)，已阅读全文；其 dashboard/data-table 排除说明意味着只借鉴情境化原则，不套用营销 Hero 或引入 GSAP、外部字体、重图表库。

参数：`DESIGN_VARIANCE=4`、`MOTION_INTENSITY=2`、`VISUAL_DENSITY=6`。浅色以白/轻暖灰、细边框、单一宿主强调色及选中浅色背景形成层级；深色继承宿主 token。使用系统字体、tabular numbers、8px 圆角、少阴影、focus-visible、reduced-motion，小屏堆叠布局与容器查询防止编辑器溢出。不复制参考图的示例指标或虚构业务数值。

## 入口、目录与真实会话

- `sidebar.panellist` 新增 id `hallmark-apps`，order 10，label「应用」，位于插件菜单下、工作区上，不修改宿主核心布局。
- `main` keyed `hallmark-apps` 直接渲染常驻应用页面；**中间应用列表从进入页面起始终可见，默认未选择应用**，右侧提示「选择应用进入工作台」。不会直接默认进入 Hallmark。
- [类型化应用目录](../packages/dsh-plugin/client/registry.ts)目前只包含真正接入的 Hallmark；支持按名称/能力搜索。新增 metadata 不授予业务权限：聊天动作必须通过 `canStartChat(appId)` 明确匹配已接入的 Hallmark，不将其他应用误路由到 Hallmark。
- 单击列表行只更新右工作台，不启用聊天。双击、右键菜单、ContextMenu/Shift+F10、触屏「更多」菜单或右上「进入聊天」走同一明确激活操作。
- 指针单击采用可取消的 500ms 意图区分双击，键盘 Enter 立即选择；打开菜单或卸载会取消待执行单击，避免竞态。
- 侧栏 entry 是始终挂载的 root 组件，使用已核实 `useSessions`、`usePanelInfo` 观察唯一 `retainedBy.mainView > 0` 的真实会话。进入应用页面可能解除 conversation retention，因此只在 `activePanelId === hallmark-apps` 保留进入前明确观察到的 ID；每次通过 byId 校验存在。其他页面无候选、删除或多个候选都清理/拒绝，不猜“最近会话”或选择第一行。
- 激活成功使用已核实公开 `uiWorkspace.openSession(exactId)` 精确回到该原有聊天。不访问私有 currentSession，不新建会话。无明确会话时只读工作台仍可用，但不能启动聊天。
- 菜单「关闭当前聊天应用」是独立明确操作；离开应用页面不关闭聊天应用。

实现：[主页面](../packages/dsh-plugin/client/page.tsx)、[会话选择规则](../packages/dsh-plugin/client/session-selection.ts)、[原生槽注册及清理契约](../packages/dsh-plugin/client/plugin.ts)。

## 右侧工作台

右侧保留「常用组件」「已保存」「组件控制台」。常用/已保存入口为响应式 tiles；模板为真实设计：店铺商品总览、利润筛选、操作结果回执，不放虚构销售数、利润率或更新时间。页面未取得对应数据时明确为空态。

顶部连接状态来自 Host 窄 GET health DTO `{serviceStatus, hallmarkStatus}`：分别区分本机服务未就绪、业务源未连接/已连接。**不会把聊天 active 当作业务连接状态，也不会写死绿色已连接或图例更新时间。** 通用刷新按钮没有明确绑定时禁用并解释；具体组件仍可显式刷新支持的只读绑定，不重放业务修改。

[组件控制台](../packages/dsh-plugin/client/builder.tsx)是实际表单，支持七类组件、标题/说明、字段、列/格式、增删/重排、网格/行/列/选项卡与嵌套分组、只读数据集绑定、逐条 fieldMap、强调色/圆角与宿主主题恢复。高级 Spec 编辑仅是补充，不以 JSON textarea 冒充搭建器。

默认草稿/临时预览不持久化。明确「保存为组件」「保存为模板」按钮才调用窄配置接口；Host/service 记录真实 UI 操作来源，不由客户端伪造聊天原话或传 userRequest。只保存 Spec、绑定和内联模板版本，不保存业务整表、截图或迁移 Hallmark 账本。非法/原型污染 Spec、凭据字段、inline 业务数据或写工具绑定被校验拒绝。

## 顶部工作区标签栏

右侧品牌 header **上方**新增独立 [WorkspaceDockTabs](../packages/dsh-plugin/client/workspace-dock.tsx)，不替代下方「常用组件/已保存/组件控制台」功能 tabs：

- 默认固定「工作台」，不能关闭。保持先选择应用的初始空态，不提前创建设计器。
- 点击真实保存的组件/数据入口，先通过既有 openEntry 得到验证过的 ViewSpec，再将真实 viewId/title 回传页面打开 SnapshotView 标签；同 app/viewId 去重并切换，而非固定示例“利润筛选”标签。
- 关闭非当前标签不改当前页，关闭当前标签回到固定工作台。
- `+` 新建有唯一序号的临时组件设计标签，不自动预览、不保存、不发业务写。inactive 标签 pane 使用 hidden 而不是卸载，切换后保留草稿输入；退出应用选择再回来同一页面也保持草稿。
- 左右箭头/Home/End 切换并转移焦点；Delete 关闭非固定标签。关闭按钮有明确名称，`+` 可聚焦，关闭后焦点回有效当前/工作台标签。
- Workbench 的 useId 前缀保证多实例 aria/tab/panel ID 唯一；SnapshotView 已分离为[独立模块](../packages/dsh-plugin/client/snapshot.tsx)，避免工作台与根入口循环依赖。
- [纯状态 reducer](../packages/dsh-plugin/client/workspace-tabs.ts)负责唯一 ID、去重、切换、关闭与 unsupported-app guard，完全不进行 fetch 或保存。已关闭/变更的工作台不会因过期 openEntry 结果重新打开标签。

## 原聊天现有右侧栏：本会话组件

[会话组件 Pane](../packages/dsh-plugin/client/sidebar.tsx)复用现有原生右栏，不插入宿主 DOM、不创建聊天框、不覆盖 `rightbar.session` 或复制输入表单。

- 公开 `sidebarRightTabs.register` 两阶段注册 id `dsh-plugin-hallmark/session-components`、kind `hallmark-components`；body/title 分别注册 keyed/session 的 `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`，**key 是 definition.id，不是 kind**。真实 guide 入口提供「本会话组件」，每 pane 单 kind 页内展示列表和所选组件。所有 registry/body/title/input 注册都有清理函数。
- 对应公开合同由官方 exact 0.2.0-rc.2 [SDK registry](../test/spike/sdk-sidebar-right-0.2.0-rc.2/package/lib/types/client/tab-registry.d.ts)、[controller](../test/spike/sdk-sidebar-right-0.2.0-rc.2/package/lib/types/client/service.d.ts)、[TabInfo/Slots](../test/spike/sdk-sidebar-right-0.2.0-rc.2/package/lib/types/client/contract/slots.d.ts)读取确认，Spike 已对当前 ASAR 行为 JS 做逐字节比对（差异仅 CSS 编译路径/hash）。这两个 plain reflection face 不在 Generic Service Inspector 的静态目录，不将 provider-error/timeout 冒充 live Service schema 成功。硬 inject exact faces 是原生支持的：Spike 核实 Cordis Reflect/Inject 源码，且[内置 SidebarFiles 消费者](../test/spike/evidence/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-files/lib/client.js#L934-L940)明确同样依赖 `sidebarRightTabs/sidebarRight`；不是因为目录未 catalog 就推断服务不存在。
- 原工具卡「侧栏查看」、`conversation.input.left`「会话组件」以及 native Guide 入口打开现有右栏；全局 openTab 前必须 `sidebarRight.mounted.getSnapshot() === props.sessionId`。否则提示切回对应会话，不调用 private openTabIn、不选默认聊天。栏内导航用 useTabInfo 的 bound-session `tab.actions.openTab`。
- GET `sessionViews(sessionId)` 返回 `{sessionId,views:[{viewId,title,createdAt,updatedAt,state}]}`，客户端校验同 SID 并只保留窄字段。列表不是全局已保存入口的冒名投影；组件 createdAt/updatedAt 是组件生成/修改时间，不是业务数据时间。
- 选中 ID 必须在此会话列表且 ready；随后使用 **sessionView/sessionViewData** 获取真实 Spec/ToolResult。侧栏与原生工具卡都是 owned SnapshotView，绝不失败后回退全局 getter。未知/foreign/expired/旧无归属临时结果明确为空态或错误；Owner 元数据仅 Host/Core 内存，不保存 Spec/整表或新增常用入口。
- 「在标签页打开」仅传 SID/viewId/title 的一次性意图，再通过 `layout.selectPanel('hallmark-apps')` 进入原应用工作区；页面/reducer 双层检查 current SID，owned 标签存储真实 SID，切换会话立即隐藏并移除 foreign owned 页，不把 A 的视图移成 B。全局保存设计/临时草稿仍是独立配置上下文。
- 异步列表使用 loadedOwner，Snapshot 使用 scope/SID/viewId identity，仅在当前身份一致时显示；abort/epoch 防止关闭、Actor 变化或迟到响应错开视图。这里只读查看/重新读取，不新增业务写入、自动保存或自动刷新经营数据。

## 原聊天组件保持可交互

[根入口](../packages/dsh-plugin/client/index.tsx)保留 `tool.call.toolview` keyed `hallmark_render_view` / `hallmark_update_view`，只读取 `block.meta.hallmark.viewId`，不猜 block.result 内部形状。

[React ViewRenderer](../packages/dsh-plugin/client/renderer.tsx)直接渲染于原聊天，不用工作台跳转链接代替：七类 widgets、稳定排序、真分页/页大小、列格式、fieldMap、递归布局、键盘 tabs、SVG 图表及可访问数值明细。没有 dangerouslySetInnerHTML。统一页脚展示来源、源时间、上次成功时间和口径；源时间未知不被缓存读取时间替代。

真实商品字段采用 `offerId/title/imageUrl/price/currency/stock`，利润使用 `referenceProfit.margin/costMissing`。货币格式接受有限数值或严格 numeric 字符串，null/空串不变零；缺成本/缺口径显示无法判断，不把参考模型利润写成实际结算净利润。

## 权限与验证边界

[Browser bridge](../packages/dsh-plugin/client/api.ts)只访问 DSH `/api/hallmark-app` same-origin 认证代理，不持有服务 Bearer，不直接联系 Hallmark，没有任意 tool/HTTP 执行器。本地配置/快照 UI 不要求聊天激活；只有 activate/close 要明确 session。所有读、预览、刷新与配置保存不执行上品、调价、库存业务修改。

- 本前端整合核验时全项目 TypeScript 检查通过；最终并行全项目复查另发现 Adapter 新测试 assertion-narrowing 错误，已通知对应 owner 修复，不归入前端失败。客户端、存储、展示合计 **47/47** Node tests 通过，含无 overlay 注册、所有 inject 返回 disposer、会话缓存丢 retention/删除/歧义、目录权限隔离、窄 health、双击意图及数据口径。
- Lead 已报告最新[隔离合成浏览器 fixture](../test/browser/fixture.tsx) **25/25 检查通过**：真实控件编辑未保存草稿后切换保留、pinned/view 去重/关闭/键盘、public native input/sidebar exact scoped list/viewer、工具卡 mounted-mismatch 不跨打开、foreign 导航无 member getter/无 global fallback、owned 一次性意图准确进工作区、0 implicit-save/0 business-source calls。原框架在 fixture 中明确模拟，不以此宣称实际 DSH DOM 或 Hallmark 真实数据已验收；新截图由 Lead 生成与视觉复核。此前无 dock 三栏 12/12 与浮窗 8/8 只属于历史测试。
- [浅色](../test/browser/artifacts/workbench-light.png)、[深色](../test/browser/artifacts/workbench-dark.png)、[小屏](../test/browser/artifacts/workbench-mobile.png)产物属于明确合成截图，不是用户实际 DSH GUI，不是用户业务数据；文件可能由 Lead 的新测试覆盖，不能替代原生页面/真实 Hallmark 数据验收。
- 构建、bundle 安装/重启与当前 GUI 验证由 Lead 负责。本任务不修改 DSH 核心/profile。Lead 已通过当前 Client Inspect 确认 main/sidebar 新 Slot 形态生效，Hallmark shell.overlay 不再存在；Host 仍报告 restart flag，不能一概说客户端未加载，也不能据此宣称本次新增 dock/owned native sidebar 已部署或真实业务视觉已验收。本轮新增 owner 接口/客户端源码目标为 0.1.3；最新已安装证据仍为 0.1.2，0.1.3 构建/正式安装及后续 Host 重启回归由 Lead 接续。
