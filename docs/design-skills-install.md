# DSH 组件设计技能安装与使用

A.2的 `hallmark-component-design` 已更新到DSH技能目录，旧版备份/hash及其余上游技能保留。candidate.7原生发现/只读和candidate.9真实源码/构建/预览/读图迭代历史不改，9原生挂载失败。candidate.10现已通过官方插件管理器覆盖原同名插件并正常重开桌面，安装文件/冻结源输入与实际Runtime健康核对通过；GUI/原生内存身份、新技能调用与新组件挂载待用户原会话手动验收。706包检查、26视觉fixture与实际CLI双视口不代签该范围，见 [A.2执行记录](apps-a2-execution.md)。

## A.2：已更新内容及证据范围

2026-10-07T06:48:50.4361116Z 完成本地项目技能更新；再次安装检查保留一致文件。当前技能源码见 [SKILL.md](../skills/hallmark-component-design/SKILL.md)，正文 SHA-256 为 `0f41c1ecb84bdc490ec721788fcffae5453d030eab43685c3db82ae42d1a92dd`，视觉参考 SHA-256 为 `b284b00b9952a651699b27e9513306552f3b4411ffbafb2edf137f28a159a294`。原始安装 manifest 和旧版备份位于本机忽略目录；当时记录 `nativeDiscoveryObserved=false`、`actualAgentDesignQualityVerified=false` 保留原事实。后续 E-NATIVE-READ-7 观察到目录列出项目技能和当前描述，只补充发现结果，不代签模型读取或设计质量。

技能更新内容包括原会话 @、普通 React/TSX/CSS、安装包 starter/SDK、真实构建与签名回执、420/1040 实际交互预览、查看实际 PNG 后迭代、候选协商就绪、明确保存/冲突/历史，以及数据刷新与源码构建分离。详细命令和回执链见 [源码组件作者指南](source-component-authoring.md)。

## A.2：重新安装项目技能

在本项目根目录、确认目标是当前桌面实际使用的技能目录后执行：

```powershell
.\scripts\install-design-skills.ps1 -LocalOnly -DestinationDirectory '<已核实的当前 DSH skills 绝对目录>'
```

默认目录为用户配置目录下 `.dsh/skills`；当前 DSH 使用其他 profile/home 时先核实，不把默认值当目标证据。`-LocalOnly` 只安装/更新项目自己的 hallmark-component-design。脚本检查 frontmatter、逐文件 hash，并在替换前备份/校验旧版；未变文件保持不动。不要为了更新项目适配技能重装或覆盖已修改的 Impeccable、shadcn、json-render 上游技能。

省略 LocalOnly 的五技能安装需已准备好并核实上游 staging；它是初始安装/固定来源流程，不是本轮默认升级步骤。`artifacts/design-skills-backups/` 和 `evidence/apps-a2-20261007/design-skills/` 为本机私有恢复/验证材料，不是公共下载链接。技能安装不会更新插件、启动 Runtime、迁移数据或擅自重启 DSH。

## A.2：在任意原聊天中使用

用户在原输入框 `@` 选择应用，再手动发送正常要求。技能可在同一会话按需要调用，例如：

```text
/hallmark-component-design 为当前应用创建一个商品筛选组件，窄栏用图文列表、宽页用表格；使用真实只读绑定，先构建并看双视口反馈，暂不保存。
```

这只是使用示例；实际目录列出技能不代表模型已经调用它。如果当前 Host 提供原会话 authoringGuidance，Agent 按其中 nodeExecutable/nodeArgs/nodeEnvironment、starterPath/sdkDirectory、buildRunnerPath/previewRunnerPath 和 Runtime 路径执行，不猜原开发机 node 或仓库地址。密钥从本机 keyFile 读取，不写入聊天。安装包含独立 JS 命令，不要求原 monorepo TS 源码。

先 `apps_list` / `apps_describe` 核实 `apps.authoring.*@1.0.0`，再 begin → 编辑普通工程 → 真实 build → record_build → 真实预览/看图/迭代 → record_preview → publish → 协商 renderReady 确认。新源码使用 `@dsh/apps-component-runtime/apps` 和 `/apps/react` 的 v2 SDK；旧根入口和 `/react` 仍为 v1 兼容路径，不把旧 ViewSpec grammar 当普通源码上限。若 Host 没有新能力，明确报告实际旧版本；不能以旧 open_source、截图或无报错冒充 A.2 验证。

用户明确保存时才调用 save_component，以已确认的 viewRevision 和稳定请求身份保存。历史 sourceRevision 与打开时最新元数据基线分开；冲突保留副本，不自动换 revision。筛选/排序/选择不新增模型步，附加选择保留原输入内容并等待用户手动发送；validated/attached/submitted/consumed 分开记录，可选 requestAgent 不替代默认手动路径。

Impeccable、shadcn 等设计方法可用于普通 React 组件；来源/许可保留。json-render 是受约束开发参考，旧 ViewSpec 仍有自己的受支持 grammar；两种入口不要互相塞 React/CSS 或替代 JSON。技能不新增业务权限：真实数据标明来源/时间/币种，缺图/库存/利润/趋势明确缺失，不补装饰性假数据。

## A.2：尚待直接验收

- [x] candidate.9官方覆盖安装/正常重开，五项文件hash及实际Runtime candidate.7/schema4/业务源健康核对；candidate.7安装/入口历史保留，不代签原生Host/Client内存身份和完整界面。
- [x] candidate.7 一个原会话的 @ 引用、人工发送和真实外部模型只读应用调用；该范围以 E-NATIVE-READ-7 为准。
- [x] 原生技能目录列出项目技能和新描述；仅证明发现，未证明模型读取 SKILL.md。
- [x] candidate.9真实原Agent请求中出现技能工具、写源码、真实构建/双视口预览、read_image及反馈修改；E-MODEL-CREATION-9仅记录这些局部步骤，不代签设计质量或完整闭环。
- [x] candidate.10已官方同名覆盖/正常重开，五安装hash/143冻结源输入/实际Runtime7/schema4/健康/唯一writer核对；706包检查及26视觉fixture保持隔离范围，不代签原生技能或设计质量。
- [ ] 新候选的实际 Host 注册/内存身份、组件入口、卸载重开；所需辅助技能实际加载范围另验。
- [ ] 实际原输入 @、中文组合态、正文/旧附件保护、手动发送与附件消费，A/B 会话隔离。
- [ ] 候选显示确认、明确保存、历史/冲突和另一会话重开；candidate.9五条failed_mount和一条过deadline的mounting，无mounted；用户本轮明确暂不保存。

这些是AUTHORING/LIVE_HOST/LIVE_MODEL待验项，不是额外业务写授权。本次流水价格54.80→54.79、库存201→200的四个mutation各一次Source写，全部succeeded并独立读回；candidate.9只inspect旧库存原operation后恢复200，未重发测试。流水最终PASS，原STOPPED历史保留；范围为脚本/真实业务，不代签原生UI或模型业务操作，上品另验。

## 历史 0.2.3：五技能初次安装与旧 ViewSpec 用法

下文保留 2026-10-06 的初次安装、来源提交和当时未验事项。其“运行时继续提交 ViewSpec”“没有开放普通源码”等描述属于旧版本阶段；A.2 当前源码主路径与验收边界以上文为准，旧 renderer 和工具仍保持兼容。

2026-10-06 已将五个技能安装到当时用户的 `%USERPROFILE%\.dsh\skills`。安装清单记录时间为14:58:25（+08:00），文件哈希验证通过；DSH于15:01:06（+08:00）重开。此记录确认文件与引擎就绪，原生技能发现和真实Agent设计效果仍待直接验收。

同日根据用户指定文章补充[视觉规范](../skills/hallmark-component-design/references/visual-direction.md)：明确彩色成品、蓝白工作方向、色阶、层级、间距与状态设计，并增加先查询真实已有组件/模板的复用流程。源码、暂存和 DSH 全局目录的两份技能文件已同步；[更新记录](../artifacts/hallmark-design-principles-installed-2026-10-06.json)保留文件摘要与旧版备份位置。此次为技能内容更新，插件仍为 0.2.3，服务未重启，未宣称新渲染效果已实现或原生技能已重载。

## 历史 0.2.3：已安装内容

| 技能目录 | 用途与入口 |
|---|---|
| `hallmark-component-design` | 本地 Hallmark 适配；`user-invocable:true`，推荐 `/hallmark-component-design` 作为聊天中创建、修改组件的入口 |
| `impeccable` | 信息层级、业务操作界面、布局与视觉复核方法；Windows 引擎探测返回 `impeccable-engine 0.1.11` |
| `shadcn` | 官方组件组合、样式与开发规则；保留 `user-invocable:false`，供模型按需加载，不作为已验证的斜杠入口 |
| `json-render-core` | Schema、catalog、prompt 与受约束生成的开发参考 |
| `json-render-shadcn` | json-render 与 shadcn 组件定义、实现组合的开发参考 |

两个 json-render 技能仅将 frontmatter 名称加前缀以避免冲突；上游许可保留。具体文件摘要和核验状态见 [design-skills-installed.json](../artifacts/design-skills-installed.json)。

| 来源 | 安装时固定提交 |
|---|---|
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/f676fb4ff08eeed1e422d9869d08618819e29549) | `f676fb4ff08eeed1e422d9869d08618819e29549` |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/232d7e2c128d94d37a6dae74e3b0e1a8f08ff6e4) | `232d7e2c128d94d37a6dae74e3b0e1a8f08ff6e4` |
| [vercel-labs/json-render](https://github.com/vercel-labs/json-render/tree/fc2a696a50a30cb30c878ab1eb65e102487eea0f) | `fc2a696a50a30cb30c878ab1eb65e102487eea0f` |

## 历史 0.2.3：运行时用法

在已经启用 Hallmark 的原聊天中，推荐使用本地适配入口，例如：

```text
/hallmark-component-design 把已有采集商品设计成适合右侧栏的选择组件，突出商品名称和导入时间，选中后附加到当前输入框，先不要保存。
```

该入口应先读取 `hallmark_app_info.data.designCapabilities`，按正在运行 Host 的 ViewSpec 能力生成或编辑。组件可用真实数据、合理列顺序、分页或标签来组织信息；保留数据来源、稳定商品身份和用户确认发送。生成、编辑默认临时，明确要求保存时再保存。

技能文件已安装，但尚未直接观察 DSH 对它们的发现、菜单展示或模型加载；以上是推荐使用方式，不是已完成的原生调用验收。实际 Host 的版本与 `designCapabilities` 也应在原生会话中核实。

## 历史 0.2.3：开发参考与运行时的区别

Impeccable 的设计方法可通过本地适配用于业务组件。shadcn、json-render 技能中的 React 源码、CLI 安装、Tailwind 配置与 `root/elements/state` 示例用于开发组件底座；运行时 Hallmark Agent 继续提交已支持的 ViewSpec，不能把那些示例原样交给 `hallmark_render_view`。

当前 DSH 宿主 React 18、TanStack Table v8 和自定义 renderer 保留。安装技能没有安装官方 React 19 renderer，也没有给组件开放任意 HTML、CSS、JS 或新业务动作。外部技能建议示例数据时，Hallmark 仍以真实只读绑定为准，不补造商品、价格、库存或利润。

## 历史 0.2.3：后续验收

- [ ] 原生 DSH 发现并调用 `hallmark-component-design`；观察需要的辅助技能是否实际加载。
- [ ] 运行 `hallmark_app_info` 核实 Host 0.2.3 与 `designCapabilities`。
- [ ] 用真实商品完成生成、修改、明确保存，并检查窄栏、明暗主题及数据语义。
- [ ] 勾选后附加到原输入框，保留既有草稿，由用户确认发送。
- [ ] 取得实际渲染证据与用户反馈后再标记视觉质量通过。

当前 `nativeDiscoveryObserved=false`、`nativeGUIVerified=false`、`agentDesignQualityVerified=false`。插件发布和服务只读联通详见 [0.2.3 记录](release-0.2.3.md)。
