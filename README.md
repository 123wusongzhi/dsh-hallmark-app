# Hallmark × DSH 应用接入

本项目在原 Hallmark 插件项目上覆盖更新。本轮 A.2 **`1.0.0-candidate.10` 已打包并通过706项全仓测试、类型检查、26条生产React隔离视觉检查、包内实际构建/双视口10项断言及只读Runtime smoke，尚未安装。** Host candidate.10、Runtime candidate.7、DB schema4；143个打包源输入已核对，无差异。它补齐原会话可见候选发现与正式右侧渲染，重排局部应用目录/组件库；实际桌面仍为candidate.9，已请求用户正常退出后覆盖更新。candidate.9真实原Agent组件请求已结束：源码、实际构建/预览、读图反馈迭代有证据，原生挂载失败，未验收显示、原输入附加或保存。价格54.80→54.79、库存201→200的四个授权写入已succeeded并独立读回确认恢复；迁移、备份/恢复和唯一writer有记录。桌面视觉、原附件体验、卸载重开、上品和正式逐项验收仍未完成，四门禁未放行。当前范围见 [A.2 实施与验收记录](docs/apps-a2-execution.md)；前轮记录保留在[历史候选说明](docs/apps-v1-candidate.md)和[历史验证摘要](docs/apps-publication-validation-20261007.md)，不代签本轮。

2026-10-07 的架构 A.1、生图说明与可交互 HTML 明确了**原聊天中由 Agent 创建和编辑组件**的体验：任意已有 DSH 会话在原输入框 `@` 选择应用，使用原 Agent、原消息和原发送；只改应用工作台、组件区与必要输入扩展，不新增独立聊天标签，不重做整个 DSH UI。前一阶段交付设计和原型；本轮 A.2 已补创作记录、真实构建/预览回执、候选就绪、明确保存、原输入引用及库管理实现，原生桌面与真实模型整链按范围另验。

## 最新文档与体验入口

本轮进度见 [A.2 实施与验收记录](docs/apps-a2-execution.md)、[24 项任务](docs/apps-a2-tasks.md)和 [80 项对照 CSV](docs/apps-a2-progress.csv)。[用户交付的 A.2 输入包](docs/requirements/A2/README.md)保留原始状态。下表中的 Apps V1 说明和 HTML 原型保留前一阶段范围，以本轮执行记录判断最新实现与放行结果。

| 内容 | 入口 | 完成范围 |
|---|---|---|
| A.2 当前实施与逐项进度 | [执行记录](docs/apps-a2-execution.md)、[24 项任务](docs/apps-a2-tasks.md)、[80 项对照](docs/apps-a2-progress.csv) | candidate.10打包/706项检查/26条视觉fixture/实际CLI双视口通过，待安装；candidate.9现场与真实Agent挂载失败历史保留，价格/库存已恢复，四门禁分开 |
| A.2 创作与维护操作 | [源码创作](docs/source-component-authoring.md)、[升级/备份恢复](docs/apps-migration-runbook.md)、[技能安装](docs/design-skills-install.md) | 包内命令/签名回执/v2/明确保存；仓库维护工具与恢复依赖规则，保留旧版本历史 |
| Apps V1 候选实现 | [候选说明](docs/apps-v1-candidate.md)、[架构决策](docs/apps-architecture-decisions.md)、[迁移与回退](docs/apps-migration-runbook.md) | 现有实现与候选验收；不等于新增前端流程已实现 |
| 需求、架构与逐项追踪 | [TODO](docs/requirements/01_TODO.md)、[规格](docs/requirements/02_SPEC.md)、[架构 A.1](docs/requirements/03_ARCHITECTURE.md)、[traceability.csv](docs/requirements/traceability.csv) | 同仓库保存的需求基线与最新架构补充 |
| 最新桌面交互要求 | [需求整理](docs/apps-product-requirements-20261007.md)、[视觉范围](docs/apps-ui-design-reference.md) | 原聊天 `@` 引用、局部 UI 更新、明确保存与会话隔离 |
| 聊天组件创作评审 | [架构与体验说明](docs/chat-component-authoring-review.md)、[FIG-13 / FIG-14 图源](docs/architecture/chat-component-authoring/README.md) | 新建、编辑、真实预览、保存及失败处理的目标契约 |
| 可交互 HTML | [下载单文件原型](docs/prototypes/chat-component-authoring.html)、[使用说明](docs/prototypes/README.md)、[实际画面](docs/prototypes/chat-component-authoring-browser.jpg) | 离线示例数据与状态模拟；不连接 DSH、模型或真实店铺 |
| 生图说明 | [闭环图](docs/design-reference/20261007-chat-authoring-architecture-generated.png)、[完整提示词](docs/design-reference/imagegen-prompts-chat-authoring-20261007.md) | 辅助理解；工程关系以架构正文和 FIG-13 / FIG-14 为准 |

在 GitHub 的 HTML 文件页面选择 **Download raw file**，保存后双击用浏览器打开；也可以 clone 仓库后打开 `docs/prototypes/chat-component-authoring.html`。无须启动服务。先输入 `@` 选择 Hallmark 并手动发送要求，再体验继续聊天修改、商品搜索/勾选、附加 JSON 后手动发送、明确保存和版本冲突。“查看架构流程”可观察身份与失败保留。浏览器交互检查通过，仅证明这份原型的流程与显示，详见[检查记录](docs/prototypes/chat-component-authoring-browser-check.json)。

## Apps V1 开发与验证

使用 Node ≥22.18，在仓库根目录执行。组合 bundle 的版本测试需要读取本机生成的 Host、Client 与 Runtime，因此先构建再测试；编译结果和安装归档由命令生成，不提交到 Git。

```powershell
pnpm install --ignore-scripts
pnpm run generate:apps-sdk
pnpm run build:apps
pnpm run typecheck
pnpm test
node scripts/smoke-apps-bundle.mjs
```

这组命令生成候选包并做隔离验证，不安装到正在运行的 DSH。连接配置、实际插件安装、原生宿主验收及数据迁移见[候选说明](docs/apps-v1-candidate.md)与[迁移运行手册](docs/apps-migration-runbook.md)。

## 历次 Hallmark 交付背景

**0.3.0 历史版本**支持 Agent 编写普通 React/TSX/CSS 源码组件、预览与截图反馈、源码模板复用、保存版本与恢复，以及将勾选商品作为原生附件加入聊天输入框。包含蓝白商品模板、独立能力服务和 DSH 原生插件。详见[源码组件作者指南](docs/source-component-authoring.md)和[0.3.0 交付记录](docs/release-0.3.0.md)。该版本当时通过 440 项测试、类型检查和构建；其交付记录中的待验收项保留当时语境，当前候选状态以上方 Apps V1 说明为准。

新增源码示例：[helen 店铺利润率组件](component-workspace/helen-margin/DESIGN.md)。Agent 与组件的交互流程见[说明文档](docs/agent-component-interaction.md)或[交互 HTML](docs/agent-component-interaction.html)（下载后用浏览器打开）。示例构建通过；真实数据和本地截图不随源码上传。

仓库仅保存开发代码、测试、技能、模板及文档。本地业务数据库、凭据、浏览器配置、构建归档和原始运行证据不纳入 Git；`evidence/` 仅保留在本机归档，公开仓库使用[验证摘要](docs/apps-publication-validation-20261007.md)。历史文档中的 `artifacts/` 路径指向本地验收材料。原型的示例检查记录随评审文档发布。`scripts/install-desktop-*`、`reload-local-service-*` 是原开发机的版本部署记录，其他机器应先配置实际路径和进程信息。

以下为历次交付背景；旧版本号、工具数量及现场数据描述保留其当时语境。

0.2.3 已通过 DSH 官方 CLI 安装并启用，Host、Client 和 patch 与发布归档一致；DSH 于 2026-10-06 15:01:06（+08:00）重开。实际商品表、Host 设计流程和三份合法配方已发布；403 项 Node、26 项专用组件浏览器及现有 UI 回归通过。五个设计技能已安装到本机 DSH 技能目录，推荐通过 `/hallmark-component-design` 使用本项目适配入口；原生技能发现、完整 GUI 交互及真实 Agent 设计效果仍待验收。见 [0.2.3 记录](docs/release-0.2.3.md)、[技能安装与使用](docs/design-skills-install.md)和[源码选型研究](docs/agent-design-github-research.md)。

此前 0.2.2 完成聊天态修复：进入原会话后自动展开组件右栏，并统一右栏外观。当时安装文件、启用状态、初始化及组件目录读取已核实；历史记录见 [0.2.2 记录](docs/release-0.2.2.md)。

0.2.1 完成应用侧栏、蓝白工作台、组件库、模板入口及真实只读业务概览。独立服务继续运行 0.2.1/25 工具，连接实际 4280 Hallmark Board；界面发布不会要求无改动的服务重启。详见 [0.2.1 交付记录](docs/release-0.2.1.md)。原有产品勾选附加原聊天、人工发送、组件保存编辑流程保留。

独立、本机优先的 Hallmark 能力服务 + Cordis 原生插件。使用 DSH 原有聊天，不复制业务数据库、平台凭据或原看板，不改 DSH 核心。

## Hallmark 0.3.0 接入边界（历史）

以下描述原 Hallmark 单应用服务与历史交互。Apps V1 的四个网关、连接与运行方式以[候选说明](docs/apps-v1-candidate.md)为准；新的原聊天 `@` 创作体验以[架构与体验评审](docs/chat-component-authoring-review.md)为准。

- 25 个统一 Schema 工具：源数据读取、参考利润/筛选、普通价与仓库库存修改、已有采集商品的受控导入、操作查询、刷新、组件/模板/入口管理。
- 上品输入必须完整且可追溯：明确采集商品与 SKU、Ozon 类目/属性、素材来源、价格和尺寸重量。不会自动猜类目、制作资产或上品整个采集箱。平台 `imported` 不是 `on_sale`；原四工具的 WorkPlan/资产交付流程未移植。
- 普通读取/刷新永不执行业务写；写入要求用户原话、值来源、明确范围与稳定幂等键。未知结果只读核实、不重写。
- 业务仍由原 Hallmark 保存。已核实实际后端在 4280；只读健康、367 个采集产品、2 家店铺已联通。Board 缺少旧 Control 的 `/api/assignments`，不能据此宣称上架写链已联通。
- **不是“全部核心业务已验收”**。活动管理、采购价修改、归档、类目/素材完整工作流等已盘点但未正式覆盖，详见[接口覆盖](<docs/hallmark-contracts.md#L57-L71>)、[全规格逐项追踪](<docs/spec-status.md>)及[验收记录](<docs/acceptance.md>)。

## 环境

Node ≥ 22.18（实际开发/测试使用 DSH bundled Node 24.21.0），TypeScript ESM、Node 内置 SQLite、Node test runner。独立服务运行时零第三方依赖；插件使用宿主同版 Schemastery 3.18.4 配置 Schema，编译使用 TypeScript、esbuild。

```powershell
# 位于本项目根目录，使用可用 Node/pnpm
pnpm install --ignore-scripts
npm --prefix component-workspace/collected-products ci --ignore-scripts
pnpm run typecheck
pnpm test
pnpm run build:plugin
$env:HALLMARK_CONTROL_URL='http://127.0.0.1:4280' # 本机已核实的 Board；其他部署须使用自己的实际端口
pnpm run service
```

源码商品模板需要在自己的目录安装依赖并构建：

```powershell
cd component-workspace/collected-products
npm ci
npm run build
```

然后按[作者指南](docs/source-component-authoring.md)预览、登记到 DSH，并在 Agent 中使用 `/hallmark-component-design` 继续编辑。

如果 PATH 未配置，请使用 DSH 的 `load_workspace_dependencies` 返回的 Node 和 pnpm 脚本绝对路径执行。**不更新 PATH 或替换运行中的 DSH。**

## 服务与配置

| 环境变量 | 默认/含义 |
|---|---|
| `HALLMARK_CONTROL_URL` | `http://127.0.0.1:4173`；只允许字面 loopback IP，无路径/凭据/重定向 |
| `HALLMARK_APP_PORT` | `4180`；服务只监听 `127.0.0.1` |
| `HALLMARK_APP_DATA_DIR` | `%LOCALAPPDATA%/dsh-hallmark-app`；独立配置/快照/操作/日志 |
| `HALLMARK_OPERATOR_TOKEN` | 可选；由用户明确配置的原 Hallmark 操作令牌，缺少时不会偷偷读原令牌文件 |
| `HALLMARK_APP_SCHEDULE` | `08:30,20:30`（本机时区），仅已保存引用与近7天查询过店铺 |

首次服务启动自动建立本机数据库与共享密钥文件。共享密钥只被插件 Host 读取，不给浏览器、不写配置响应或日志。所有服务路由需 Bearer key，并校验 loopback、Host、Origin。浏览器通过 DSH 现有认证通道，由插件 Host 转发。

独立服务需先启动；插件默认不猜测 Node 路径、不擅自启动原 Hallmark。不要直接通过浏览器访问4180（该端口不是公开 UI）；日常从 DSH 的“应用”入口使用。

插件提供官方静态 `Config` Schema（不是裸 JSON Schema），可通过 DSH 官方配置文档编辑。它不是自动 live 设置表单；修改后由正常插件重载/重启生效，不迁移在途业务连接。`autoStart` 默认 `false`；启用时必须显式提供绝对 `nodeExecutable`、`serviceEntry`、`serviceCwd`，launcher 还校验实际文件。不会猜 Node 路径、启动原 Hallmark 或读取原 human-token 文件。数据目录与服务地址是独立接入服务的，不是原项目凭据目录。

JSON 备份命令：

```powershell
npm run backup -- --output "E:\\backups\\hallmark-app.json"
# 可选 --database 指定已存在 app.db；默认独立应用目录
```

输出必须是新的 JSON 文件；命令以只读事务读取应用库，不创建/迁移数据库、不覆盖已有输出、不备份共享密钥文件。

## Hallmark 0.x 历史安装与交互

下述 0.2.3 归档命令、应用双击激活与旧工作区标签是历史部署记录，不是当前候选包的安装命令，也不代表最新 `@` 交互目标。安装 Apps V1 应先阅读[候选说明](docs/apps-v1-candidate.md)与[迁移手册](docs/apps-migration-runbook.md)，构建并使用其确切版本的组合 bundle；卸载/更新后需重开桌面核对实际注册。

正式包由构建命令生成预构建 Host/Client 后，以唯一版本归档通过 DSH 官方插件管理器安装。重复使用同一目录 spec 可能被 pnpm 旧元数据缓存，管理器返回 `ambiguous-install`；不要盲目重复写 profile：

```powershell
# 构建已完成后，在 packages/dsh-plugin 中执行
pnpm pack --pack-destination ../../artifacts
```

```text
install_bundle target=file:E:/project/deepseek_h/dsh-hallmark-app/artifacts/dsh-plugin-hallmark-0.2.3.tgz registry=https://registry.npmjs.org
```

管理器返回 `restart-required` 时，必须重启 DSH 才能把已安装版本当作运行版本。没有验证开发 watcher，不承诺源码自动热更新，也不强行关闭用户当前聊天。

本机镜像第一次下载既有 Codex 可选包超时，官方源重试成功；必要时使用管理器 `registry=https://registry.npmjs.org`。不手改 profile，不开版本豁免，不改核心。

左侧边栏“插件”下、“工作区”上为**应用**入口（`sidebar.panellist` 新 id + `main` 新 key，不替换原 Conversation）。按用户最新参考截图，以**原导航 → 常驻应用列表 → 右工作台**三栏呈现，初始不弹窗、不默认选 Hallmark。应用列表一直保留；右侧先提示选择应用，单击后展示该应用工作台，顶部“应用列表”可清除选择。目录使用真实应用元数据，未来可扩展多应用；当前只有已接入的 Hallmark，不能仅添加名称就借用它的聊天权限：

- **左键 Hallmark**：进入应用工作台，包括常用组件、已保存组件、自由搭建控制台。可选七类组件、布局、主题与只读数据绑定，先临时预览；点击明确“保存组件/模板”才持久保存。不自动激活聊天。
- **右键 Hallmark → 启动聊天，或双击 Hallmark**：在当前原有 DSH 会话激活应用并回到原聊天。提供菜单按钮及键盘操作替代右键。没有当前会话时提示先选择，不猜测会话或店铺。
- **工作区标签栏**：工作台固定不可关闭；打开保存组件生成按 viewId 去重的标签；＋新建临时设计，切换保留草稿，关闭不自动保存，支持键盘切换。
- **原聊天右侧栏**：输入区“会话组件”和工具卡“侧栏查看”打开原生“本会话组件”标签。仅显示该会话可信生成的组件；可在工作区标签打开，不能借当前界面打开另一会话的数据。服务重启前的无归属临时视图不自动认领，保存设计依旧可在工作台查看。
- **Agent 发送组件**：原聊天中的 `hallmark_render_view` / `hallmark_update_view` 直接呈现交互表格、图表、商品卡等，而不是只有跳转链接。默认临时，明确保存才加入工作台。

返回应用目录或离开工作台不等于关闭聊天应用；应用会在该会话持续激活直到主动关闭或切换。聊天目标来自进入页面前明确选择的原会话，不猜测最近会话；通过原生导航返回准确会话。不同会话状态隔离。也可使用 `/hallmark on|off|status`，见[服务端实现](<packages/dsh-plugin/server/index.ts>)。

示例指令：

- “查询我指定店铺的商品，保留源字段和数据时间。”
- “把参考利润率低于15%的商品列出来，缺成本单独显示。”
- “用表格展示刚才的筛选结果。”（临时展示，不保存）
- “把这个组件保存为‘低利润商品’。”（明确保存 Spec + 数据绑定）
- “刷新这个组件的数据。”（只读刷新，失败显示上次成功快照）

写入需要真实店铺明确范围及业务值。真实写验收必须由用户指定测试店铺/商品和参数；开发过程中没有对真实平台执行写入。

## 架构与证据

- [需求规格](docs/requirements/02_SPEC.md)、[TODO](docs/requirements/01_TODO.md)、[架构 A.1](docs/requirements/03_ARCHITECTURE.md)、[逐项追踪](docs/requirements/traceability.csv)。
- [M0 接入决策](<docs/decisions/0001-接入决策.md>)、[Hallmark 实际契约](<docs/hallmark-contracts.md>)。
- [统一工具契约](<packages/contracts/src/index.ts>) → [业务能力](<packages/core/src/index.ts>) → [本机服务](<packages/service/src/main.ts>)。
- [SQLite 存储](<packages/store/index.ts>)、[展示管理](<packages/presentation/src/index.ts>)。
- [前端设计说明](<docs/frontend-design.md>)：参考 [taste-skill](https://github.com/Leonxlnx/taste-skill)，按内嵌经营工具语境使用，不照搬营销页规则。

MCP 为原生方式失败时的备选，本版不并行实现第二套接入。`test/spike/evidence` 是有限只读宿主源码核实材料，不进入发布包。

## 停止、卸载与维护

停止独立能力服务：前台 Ctrl+C，或核对本实例日志 PID、Node 可执行路径与启动参数后只停止该服务进程。Windows 结束 PowerShell 后台任务可能留下 Node 子进程，不等于服务已停止；不要关闭用户 DSH 或其他 Node 进程。关闭应用不自动卸载 bundle、也不删除保存组件。

卸载：先通过官方管理器列出确切 bundle 名，再禁用/移除 `dsh-plugin-hallmark`。移除 bundle 不删除本机独立数据目录；备份后再人工决定是否删除，不自动清空数据。

后台更新时间只在能力服务进程运行时有效。**尚未注册 Windows 登录自启**；用户确认需要 DSH 关闭后继续刷新时，再配置受控常驻方式。24/48小时运行与真实平台数值对比仍需另行验收。
