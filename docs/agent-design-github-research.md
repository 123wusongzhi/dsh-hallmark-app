---
template: doc
theme: shadcn
title: 让 DSH Agent 具备组件设计能力
subtitle: GitHub 源码核对 · 2026-10-06 · 基于当前 Hallmark 插件
lang: zh
---

推荐组合：**Impeccable 的设计方法 + shadcn 官方技能 + 面向 Hallmark 的组件目录与配方**。保留当前 TanStack Table、Recharts 与 React 18 渲染器。

## A 找到了哪些项目

| 项目 | 能教 Agent 什么 | 对本项目的判断 |
| --- | --- | --- |
| [Impeccable](https://github.com/pbakaus/impeccable) | 布局、排版、设计审查与打磨 | 优先采用设计流程；有 DSH 技能适配 |
| [shadcn 官方 Skill](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md) | 查找现有组件，正确组合和定制 | 与技术路线最贴近；开发阶段使用 |
| [json-render 官方 Skills](https://github.com/vercel-labs/json-render/tree/main/skills) | 给组件定义用途、参数、示例与生成规则 | 借用目录机制，接到运行中的 Agent |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 查询配色、字体、图表和 UX 规则 | 可选的设计知识库，支持 shadcn 技术栈 |
| [Tool UI](https://github.com/assistant-ui/tool-ui) | 表格、选项列表、图表与交互回执 | 可参考源码；2026-09-26 已归档 |

上述结论来自官方仓库和源码。推荐程度是结合本项目的判断。

## B 最推荐：Impeccable + shadcn

Impeccable 提供设计、审查、排版、布局、打磨等操作。它还区分操作型产品与展示型页面。店铺工具应优先保证清晰、统一和高效。[技能源码](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md)

仓库已有 `.dsh/skills/impeccable`。这说明有 DSH 分发适配，不代表装好后就会识别 Hallmark 的组件协议。[DSH 版本](https://github.com/pbakaus/impeccable/blob/main/.dsh/skills/impeccable/SKILL.md)

shadcn 官方技能强调先查现有组件，再组合 Card、Table、Chart、Tabs 等。它提供组件用法、主题规则和注册表工作流。[官方技能](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md)

我的建议：用前者建立设计标准，用后者实现稳定的组件底座。

## C 关键：开发 Agent 和聊天 Agent 是两层

| 层级 | 实际工作 | 应接入的能力 |
| --- | --- | --- |
| 开发插件的 Agent | 修改 React、CSS 和组件源码 | Impeccable + shadcn 技能 |
| DSH 聊天中的 Hallmark Agent | 查询数据，生成和编辑 ViewSpec | 组件用途、合法参数、组合配方、设计规则 |
| 插件渲染器 | 将 ViewSpec 显示成可交互组件 | 精致的默认样式与一致的交互 |

只把技能装到 Codex，不会自动传给 DSH 的聊天 Agent。这一结论来自本项目的 Host 指令注入和工具注册链路。

```flow
用户需求 -> 真实数据: 查询字段
真实数据 -> 设计配方: 选择版式
设计配方 -> ViewSpec: 生成或编辑
ViewSpec -> 组件渲染: 显示界面
组件渲染 -> 用户选择: 勾选商品
用户选择 -> 聊天输入框: 附加并确认发送
```

## D json-render 能借用什么

官方 catalog 为组件声明用途、参数和示例，再生成模型提示。这个机制适合本项目。[catalog 源码](https://github.com/vercel-labs/json-render/blob/main/packages/shadcn/src/catalog.ts) · [prompt 源码](https://github.com/vercel-labs/json-render/blob/main/packages/core/src/schema.ts)

但官方默认生成 `root/elements/state`，本项目持久化的是 `ViewSpec`。应为本项目编写相应的组件说明，不能直接套默认提示。[React schema](https://github.com/vercel-labs/json-render/blob/main/packages/react/src/schema.ts)

当前本地 core 已是 0.21.0。官方 React 实现要求 React 19，shadcn 实现还要求 Tailwind 4。DSH 使用 React 18，不能直接替换。[React 依赖](https://github.com/vercel-labs/json-render/blob/main/packages/react/package.json) · [shadcn 依赖](https://github.com/vercel-labs/json-render/blob/main/packages/shadcn/package.json)

因此建议保留现有商品身份、选择和附加逻辑，借用官方的组件描述方式。

## E 落到“列出采集商品”这个需求

Agent 应先识别：这是供用户浏览和选择的商品列表。然后按真实字段决定列顺序、日期格式和展示密度。

- 主信息放商品名称，辅助信息放已核实的时间与属性。
- 窄栏少放列；更多信息放明细或另一标签。
- 使用搜索、分页、清晰的选中态和附加按钮。
- 日期按时间语义命名。导入时间不能写成采集时间。
- 不为视觉效果虚构图片、售价、利润或增长率。
- 用户要求修改布局时，编辑现有组件；要求保存时再保存。

这个过程需要设计规则，也需要渲染器支持相应的组件变化。技能本身不能补出未实现的组件类型。

## F 已安装与使用入口

本地已改实际商品表，并把初步设计规则接入 Host。新增了商品选择、趋势明细、操作回执三类合法配方。

当前通过 403 项 Node 测试和 26 项专用组件浏览器检查。另通过选择/图表 19 项、聊天面板 20 项、工作台 39 项检查。浏览器数据均为合成数据。

[查看新版商品表预览](dsh-hallmark-app/test/browser/component-artifacts/component-wide-light.png) · [查看窄栏深色预览](dsh-hallmark-app/test/browser/component-artifacts/component-narrow-dark.png)

2026-10-06 已通过官方 CLI 安装 Hallmark 0.2.3，并重新打开 DSH。后端未重启，只读连接检查通过。

DSH 全局技能目录已安装 Impeccable、shadcn、json-render-core、json-render-shadcn。另有 Hallmark 专用技能，负责衔接现有组件协议。

在 DSH 的下一条消息中使用：

`/hallmark-component-design 把采集商品做成清晰、好看的可选组件`

文件哈希与 Impeccable Windows 引擎检查已通过。实际 Agent 生成的视觉效果仍待聊天验收。shadcn 为模型自动加载技能，没有独立斜杠入口。
