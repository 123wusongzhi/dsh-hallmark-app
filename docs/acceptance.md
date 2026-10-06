# 0.2.0 本轮开发记录

2026-10-06：[交付与加载检查](release-0.2.0.md)。连接修复后 373/373 Node 测试与全项目类型检查通过；此前 Host/Client 构建、28/28 工作台及 19/19 选择到输入框浏览器断言通过。UI 测试是隔离合成证据。用户退出 DSH 后已通过自带官方 CLI 安装 0.2.0 并重开，包版本/启用状态及初始化/会话请求已核实。独立服务实际 0.2.0/25 工具、来源 4280 hallmark-board 健康正常，真实采集 367 个/店铺 2 家。原生 Host 版本自报与完整 UI 尚未验收；未执行店铺写。Board 缺少旧 `/api/assignments` 分派路由，不能将只读联通宣称为上品写链完成。

以下保留既有版本的验收历史。

# 当前迭代验收记录

完整目标以[全规格逐项追踪](<spec-status.md>)为准；本记录不把阶段性开发测试当作全部规格或真实平台验收。

## 最新交互与边界

用户最新参考图覆盖此前浮窗要求：原 DSH 导航 → 常驻应用列表 → 右工作台；进入“应用”先展示真实应用列表，不默认选择 Hallmark、不弹窗。单击选工作台，右键菜单或双击启动明确的原会话；工作区顶部使用可切换、关闭和新增临时组件设计的标签。原聊天交互组件与应用工作台并行，不替换 Conversation。

业务源离线不等于本机组件控制台不可用。不得复制参考图中的经营数字、假设已连接或以系统当前时间伪造数据更新时间。当前只接入 Hallmark，不能通过添加另一个应用名称就借用其权限。

## 已有真实证据

| 层级 | 证据 | 限制 |
|---|---|---|
| 用户 JSON 修复 | 保留[契约构造器](<../packages/contracts/src/index.ts#L9>) 的可选 description 条件展开 | 原故障由用户修复，不能归功于新增守卫 |
| 防止普通聊天再次受损 | [严格 JSON 检查](<../packages/contracts/src/json.ts>)，构建前及工具注册前执行；完整普通聊天请求头回归、无损 round-trip、非法值与启动前拒绝测试通过 | `JSON.stringify` 成功不代表严格 JSON 合法；拒绝 undefined、NaN/Infinity、-0、稀疏数组、非 JSON 容器、循环等 |
| 核心/服务/存储/插件 | 最新全量317/317 Node测试、root类型检查通过（旧Host pwsh-80已收）；其中Core128、适配76、HTTP集成22。P1 Source401前置拒绝/跨会话阻挡记录泄漏、P2恢复成功保留旧顶层错误均已补回归 | 开发合成测试，不是真实平台写或完整规格验收；类别/归档适配方法尚未接正式Core工具 |
| 标签/原侧栏浏览器验证 | [合成验收结果](<../test/browser/artifacts/results.json>) 25 项通过：初始未选、原导航、真实搭建/明确保存；固定工作台、viewId 去重、关闭回退、草稿修改保留、键盘 Home；原输入区/工具卡侧栏入口、精确归属列表/交互详情、mountedSID 不同不误开、foreign不读、owned工作区标签、无隐式保存/运行错误 | Chrome 独立临时 profile，mock `/api/hallmark-app` 与原生框架；不是用户已认证 GUI 自动点击、不是业务数据验收 |
| 原生聊天链路 | 本会话实际执行 `hallmark_app_info`、`hallmark_render_view`、`hallmark_update_view` 成功；临时文本视图 `mvp-native-chat-check` 未保存 | 不包含经营示例数值，不证明真实平台写成功 |
| 保存边界 | 本会话实际 `hallmark_list_saved` 返回空组件/入口/模板 | 浏览器合成测试中的明确保存只修改隔离 fixture，不写生产数据库 |
| 本机服务 | 4180 服务保持运行，authenticated smoke 为 ok、23 tools、业务源 unavailable、credentialsExposed=false | 原 Hallmark 4173 未就绪，未自动启动原后端或读取其令牌 |
| 本机原生 Client | 最新 live Inspect 中 `sidebar.panellist` 的应用项 order10 与 `main` 的 hallmark-apps active；`shell.overlay` 已无 Hallmark 浮窗项，原 Conversation 与其他插件保留 | 这是 Slot 注册现场证据，不是当前页面 screenshot 或真实按钮自动化；未验证开发 watcher，不承诺自动热更新 |
| 官方安装与重启后Host | 官方安装0.1.3；用户明确要求重启，走原生应用菜单退出；旧桌面PID9464退出、重新打开后主进程21908。实际 hallmark_app_info.hostPluginVersion=0.1.3；Config Inspect include:hallmark-app status=schema并返回八字段Schema | 一次重启助手日志只记录等待退出，未记录自动启动，不将助手当作完整重启证据；以新PID、实际执行版本及Schema三者核实。没有改ASAR/profile或强杀其他进程 |
| 重启后Client侧栏注册 | live sidebar.right.pane.tab的 dsh-plugin-hallmark/session-components active，原guide/document/terminal/files/browser等仍在；真实WindowsUIA读到输入区“查看本会话组件”和临时工具结果“原生会话组件核验 · 0.1.3 可查看” | 已点击当前会话入口，完整详情/工作区打开的真实交互证据仍在核实；Slot注册和可访问入口不能替代全部浏览器行为 |
| 临时 hello | 官方 manager 后 inventory enabled=false | 其热重载报 root Include 条件缺失，不能把配置禁用假称当前进程所有旧注册已清除；不修 DSH 核心/profile 绕过 |

## 视觉预览（合成，不是当前真实 GUI）

- [初始应用列表](<../test/browser/artifacts/application-list-light.png>)：三栏框架，初始右侧提示选择应用。
- [选中 Hallmark 的常用组件页](<../test/browser/artifacts/workbench-overview-light.png>)：真实模板与空状态，无虚构经营数值。
- [组件控制台](<../test/browser/artifacts/workbench-light.png>)、[深色](<../test/browser/artifacts/workbench-dark.png>)、[手机](<../test/browser/artifacts/workbench-mobile.png>)。

- [多标签工作区](<../test/browser/artifacts/workspace-tabs-light.png>)：固定工作台、组件、临时设计及＋，已人工读取图片复核。
- [原聊天右侧本会话组件](<../test/browser/artifacts/chat-sidebar-light.png>)：隔离原生框架模拟，已人工读取复核；不是用户当前 GUI 截图。

最新25项回归已重生成全部预览。前端只使用宿主主题 token 和 scoped CSS，没有覆盖原 DSH shell 或启动替代 GUI。操作回执还有7项实际 React SSR 断言：根 partial 不被第一项 succeeded 覆盖、空 pending 不显示 cache ready、七组件明确显示操作记录时间及 imported≠on_sale；这也不能替代真实平台或 GUI 验收。

## 最终版本生效检查

1. 先构建并安装唯一版本归档，不盲目重复同一目录 spec。重复目录安装出现过 ambiguous-install，已通过版本归档绕过。
2. `application=restart-required` 时不强杀当前聊天。一次完整 DSH 重启后确认运行 Host，而不是只看安装列表。
3. 从 0.1.3 开始，原生 `hallmark_app_info.data.hostPluginVersion` 表示实际执行代码版本；构建检查其常量与 manifest 一致。若字段缺失或版本旧，不能宣称新 Host 已生效。
4. live Client Inspect 应仍有应用 sidebar/main，而无 Hallmark shell.overlay。真实页面首屏为应用列表，选中后右侧出现工作台；标签栏切换、关闭、＋新设计，右键/双击返回明确原会话。
5. 原聊天普通提问继续可用，预览不自动创建保存入口。未知写结果只能查询操作，不做自动重发。

## 未具备条件／未验收

- 原 Hallmark 后端、真实店铺/商品/仓库与明确业务参数：未做真实调价、改库存、上品、实际利润数值核对或可售状态验收；没有获准执行任何真实业务写。
- 活动价/活动报名、采购成本修改、归档、原四工具资产准备链路与命名规则定义：已记录覆盖限制，不以普通价接口替代。
- 24/48 小时稳定性、Windows 登录自启：未验收、未设置。调度仅在独立服务进程运行时有效。
- 当前 GUI 的视觉点击验收与完整 Host 更新需以版本证据和真实现场为准，不用隔离 fixture 冒充。
