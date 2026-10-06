# DSH 组件设计技能安装记录

2026-10-06 已将五个技能安装到 `C:\Users\wubil\.dsh\skills`。安装清单记录时间为 14:58:25（+08:00），文件哈希验证通过；DSH 于 15:01:06（+08:00）重开。此记录确认文件与引擎就绪，原生技能发现和真实 Agent 设计效果仍待直接验收。

同日根据用户指定文章补充[视觉规范](../skills/hallmark-component-design/references/visual-direction.md)：明确彩色成品、蓝白工作方向、色阶、层级、间距与状态设计，并增加先查询真实已有组件/模板的复用流程。源码、暂存和 DSH 全局目录的两份技能文件已同步；[更新记录](../artifacts/hallmark-design-principles-installed-2026-10-06.json)保留文件摘要与旧版备份位置。此次为技能内容更新，插件仍为 0.2.3，服务未重启，未宣称新渲染效果已实现或原生技能已重载。

## 已安装内容

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

## 运行时用法

在已经启用 Hallmark 的原聊天中，推荐使用本地适配入口，例如：

```text
/hallmark-component-design 把已有采集商品设计成适合右侧栏的选择组件，突出商品名称和导入时间，选中后附加到当前输入框，先不要保存。
```

该入口应先读取 `hallmark_app_info.data.designCapabilities`，按正在运行 Host 的 ViewSpec 能力生成或编辑。组件可用真实数据、合理列顺序、分页或标签来组织信息；保留数据来源、稳定商品身份和用户确认发送。生成、编辑默认临时，明确要求保存时再保存。

技能文件已安装，但尚未直接观察 DSH 对它们的发现、菜单展示或模型加载；以上是推荐使用方式，不是已完成的原生调用验收。实际 Host 的版本与 `designCapabilities` 也应在原生会话中核实。

## 开发参考与运行时的区别

Impeccable 的设计方法可通过本地适配用于业务组件。shadcn、json-render 技能中的 React 源码、CLI 安装、Tailwind 配置与 `root/elements/state` 示例用于开发组件底座；运行时 Hallmark Agent 继续提交已支持的 ViewSpec，不能把那些示例原样交给 `hallmark_render_view`。

当前 DSH 宿主 React 18、TanStack Table v8 和自定义 renderer 保留。安装技能没有安装官方 React 19 renderer，也没有给组件开放任意 HTML、CSS、JS 或新业务动作。外部技能建议示例数据时，Hallmark 仍以真实只读绑定为准，不补造商品、价格、库存或利润。

## 后续验收

- [ ] 原生 DSH 发现并调用 `hallmark-component-design`；观察需要的辅助技能是否实际加载。
- [ ] 运行 `hallmark_app_info` 核实 Host 0.2.3 与 `designCapabilities`。
- [ ] 用真实商品完成生成、修改、明确保存，并检查窄栏、明暗主题及数据语义。
- [ ] 勾选后附加到原输入框，保留既有草稿，由用户确认发送。
- [ ] 取得实际渲染证据与用户反馈后再标记视觉质量通过。

当前 `nativeDiscoveryObserved=false`、`nativeGUIVerified=false`、`agentDesignQualityVerified=false`。插件发布和服务只读联通详见 [0.2.3 记录](release-0.2.3.md)。
