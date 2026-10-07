# 原聊天组件创作架构补充 · A.1

日期：2026-10-07。正式说明位于仓库内 [03_ARCHITECTURE.md](../../requirements/03_ARCHITECTURE.md) 的 FIG-13、FIG-14。此目录是新增目标架构的可编辑图源与说明，不是新界面部署或旧测试通过证据。

SVG、PNG、Mermaid 和 DOT 图源均已提交。阅读架构与查看 PNG 无需安装或运行渲染工具。

用户最新边界是：任意已有 DSH 会话原输入框 `@` 应用，使用原聊天、原 Agent 和原发送；只改应用工作台、组件区和必要输入扩展，不创建独立聊天标签，不改整个 DSH UI。

| 文件 | 用途 |
|---|---|
| FIG-13.svg / FIG-13.png | 闭环总图：引用、绑定、原发送、源码副本、构建/预览、会话草稿、继续反馈、明确保存 |
| FIG-13.mmd / FIG-13.dot | 相同节点与主关系的编辑源；自动排版与固定 SVG 的布局可以不同 |
| FIG-14.svg / FIG-14.png | 六角色详细顺序，包含编辑已有资产、下一轮修改、保存和冲突 |
| FIG-14.mmd | 序列图语义源，使用原聊天手动发送路径 |
| FIG-14.dot | 相同步骤的有序展开图，顺序箭头不是额外调用 |
| render_diagrams.py | 单一节点/关系模型生成 SVG、Mermaid、DOT；不调用 DSH 或业务接口 |
| capture_diagrams.mjs / diagram-render-check.json | 使用已安装的本地浏览器将同份 SVG 栅格化为 PNG 的可选脚本与文档渲染检查；未操作 DSH |

## 谁做什么

| 角色 | 主要责任 |
|---|---|
| 用户 | 在原聊天选择应用、描述组件目标、继续反馈、明确保存；原生附件由用户手动发送。 |
| DSH 原会话与输入机制 | 保存真实会话消息、正文、引用和附件；执行原发送、模型选择与原 Agent 生命周期。 |
| Apps Client 与 Host | 官方扩展点呈现 `@` 候选；核实真实会话；代理连接绑定与组件展示；清理候选；隔离跨会话和 frame 的迟到结果。 |
| 同一个原 Agent | 发现能力工具；查询/加工数据；用已有文件与命令工具创建、checkout、编辑、构建；读取截图/运行错误/交互反馈并修改。 |
| 工程与预览载体 | 可编辑工作副本；构建同份 dist；取得对应 buildId 的真实运行、截图和交互报告；不把示意 HTML 当实际 dist 验收。 |
| P2 Runtime / Presentation / SourceComponentStore | 连接与会话绑定、调用、快照、内容地址归档、view 所有权、组件资产 CAS 与历史版本的唯一写入路径。 |
| 当前组件 frame | bridge 握手；本地过滤、排序、分页、勾选；显示数据/freshness；明确附件或业务动作。 |

`buildId`、`viewId`、`componentId/revision`、`datasetRevision`、`contextRevision`、`frameInstanceId` 各有用途，不能互相替代。保存草稿或构建归档不等于保存组件库。

## 实现接线仍需验证

- 官方 `@` 扩展已有本机代码依据，当前插件尚需候选/引用/Runtime 绑定/取消与跨会话生命周期接线；引用 chip 不等于连接已激活。
- 当前 `openSource()` 集成 `capture()` 与草稿更新，图中的“登记构建”是逻辑阶段，没有虚构一个 `registerBuild` API。
- 旧预览载体使用 `hallmark.source.v1`，新组件使用 `dsh.apps.component.v2`；需要适配新协议和 Agent 可读的真实反馈，或在真实 v2 宿主中检查。
- 手动原聊天路径与 FIG-08 的可选 `requestAgent` 分开。adapter disabled 时，不能以主动请求未支持阻断原聊天创建/编辑，也不能假报主动请求已发送。
- frame 替换时保留/恢复本地筛选和未发送草稿需要 Client 策略；旧数据的选择必须重新验证。

## 重新生成

在此目录执行 `python render_diagrams.py` 生成 SVG、DOT、Mermaid。PNG 应由同一份 SVG 在浏览器中栅格化；当前图面为 FIG-13 1720 × 1230、FIG-14 1870 × 1950。截图只验证这份文档图的可读性，不验证 DSH 功能。

仅当你主动修改图源并要更新 PNG 时，手动执行 `node capture_diagrams.mjs`。该脚本是文档工具，不属于项目运行路径，不新增生产依赖，也不会安装包、联网下载浏览器或启动 DSH / Runtime / 业务服务。它会覆盖本目录的两张 PNG 与 `diagram-render-check.json`。

需要已有 Node.js、Playwright 文档渲染工具与本地浏览器。脚本默认从自己的模块解析路径加载 `playwright`；如果工具安装在其他位置，可用 `DSH_DIAGRAM_PLAYWRIGHT_PATH` 指向已有 Playwright 包目录或入口文件。工具不必安装到本项目。

浏览器默认使用 Playwright 已安装的 Chromium；也可以使用本机 Chrome 或指定可执行文件。脚本不会自动下载缺失的浏览器。

| 环境变量 | 可选配置 |
|---|---|
| `DSH_DIAGRAM_PLAYWRIGHT_PATH` | 已安装 Playwright 包目录或入口文件；相对路径按当前工作目录解析，建议用绝对路径 |
| `DSH_DIAGRAM_BROWSER_CHANNEL` | 使用 Playwright 支持的已安装浏览器通道，例如 `chrome` |
| `DSH_DIAGRAM_BROWSER_EXECUTABLE` | 已安装 Chrome / Chromium 可执行文件的路径；与 browser channel 二选一 |

例如，在此目录用 PowerShell 选择本机已安装的 Chrome：

```powershell
# Playwright 已能通过标准模块解析找到时，不需要设置包路径。
# 若工具另行安装，则先设置为该已有包的真实位置：
# $env:DSH_DIAGRAM_PLAYWRIGHT_PATH = '<已有 Playwright 包目录的绝对路径>'
$env:DSH_DIAGRAM_BROWSER_CHANNEL = 'chrome'
node ./capture_diagrams.mjs
```

如果标准通道不能定位浏览器，清除 `DSH_DIAGRAM_BROWSER_CHANNEL` 后设置 `DSH_DIAGRAM_BROWSER_EXECUTABLE` 为本机浏览器的实际路径。没有本地工具或浏览器时，直接查看已提交的 PNG 即可；脚本会给出错误提示，不代为安装。
