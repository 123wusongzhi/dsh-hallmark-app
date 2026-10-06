---
template: doc
theme: shadcn
mode: light
title: Agent 如何制作、运行和修改组件
subtitle: 源码、模板、编译、DSH、附件，各自做什么
lang: zh
source: 本地 0.3.0 源码核对 · 2026-10-06
---

**是源码编译。这里的“模板”是一份已有源码工程。** Agent 可以复制它再修改，也可以新建工程。两条路最终都运行编译后的页面。

点击左侧目录切换话题。先看 [B：两种起点](#panel-B)，再看 [C：制作过程](#panel-C) 和 [E：勾选怎样交给 Agent](#panel-E)。本页是交互说明，不连接店铺或发送聊天。

## A 先把五个名称分清

| 名称 | 在这个项目里是什么 | 谁使用它 |
|---|---|---|
| UI 组件库 | shadcn 的按钮、表格等可编辑源码 | Agent 写页面时复用 |
| 源码模板 | 一整个可复制的 React 工程 | Agent 或用户作为起点 |
| 编译产物 dist | 工程生成的 HTML、JS、CSS、图片等 | 浏览器负责执行 |
| 会话组件 | 当前聊天登记的一份构建及数据绑定 | DSH 右侧栏展示 |
| 已保存组件库 | 用户正式保存的组件和版本 | 后续打开、编辑和复用 |

```callout info 本次“采集商品”究竟从哪来
这是我随 0.3.0 提供的商品源码工程。安装时将它登记成内置源码模板，再从模板打开为当前会话组件。

它不是 DSH Agent 在那次聊天里从零写出的页面。之前我用“Agent 编译的组件”概括它，省略了这层来源。
```

## B 两种起点，最后都是普通源码

```flow
需求 -> {从哪里开始?}
{从哪里开始?} -> 新建工程: 从零编写
{从哪里开始?} -> 复制源码模板: 复用已有设计
新建工程 -> 可编辑工程
复制源码模板 -> 可编辑工程
可编辑工程 -> 修改TSX和CSS
修改TSX和CSS -> 编译dist
```

| 起点 | Agent 实际做什么 | 能否改变设计 |
|---|---|---|
| 从零写 | 新建工程，编写页面，接入需要的 SDK 能力 | 可以自由设计 |
| 复制起点 | 复制商品工程，改源码、样式和依赖 | 可以重做整个布局 |
| 打开已保存组件 | 恢复到新的工作目录，再编辑源码 | 可以继续修改并保存版本 |

**当前技能确实偏向复用。** 它先建议查看已有组件，再复制工程起点。底层打开接口并不要求使用这个模板，也没有固定页面布局。

模板已有可用 dist 时可以直接打开。Agent 修改源码后，需要重新编译才能显示修改。

## C Agent 如何把需求变成页面

```sequence num
participants: 用户, Agent, 文件与命令工具, 预览工具, Hallmark插件
用户 -> Agent: 做一个可勾选的商品清单
Agent -> Agent: 读取设计技能和视觉规范
Agent -> Hallmark插件: 查询商品，取得数据绑定
Agent -> 文件与命令工具: 新建或复制工程，编辑源码
Agent -> 文件与命令工具: 执行 npm run build
文件与命令工具 --> Agent: dist 文件或编译错误
Agent -> 预览工具: 加载 dist，截图并执行交互步骤
预览工具 --> Agent: 图片、错误与交互反馈
Agent -> Agent: 读图并判断是否需要修改
Agent -> Hallmark插件: open_source_component 登记构建
Hallmark插件 --> 用户: 在本会话组件里打开页面
```

**Agent 写代码并调用命令；TypeScript 和 Vite 执行编译。** `hallmark_open_source_component` 只登记已有构建，不负责写代码或编译。

源码可使用 React 状态、循环、事件、CSS 和普通依赖。当前页面使用 shadcn 基础源码与 TanStack Table。它的布局不是由旧 ViewSpec 或 json-render 生成。

预览可以使用已有查询数据文件。登记到 DSH 后，也可以用会话 ID 和 viewId 读取绑定数据做预览。

## D 页面运行时，Agent 不参与每次点击

```flow LR
编译dist -> 本机构建存档: 登记并产生buildId
本机构建存档 -> DSH插件Host: 提供资源
DSH插件Host -> iframe页面: 加载同一份dist
iframe页面 -> React状态: 勾选、筛选、翻页
React状态 -> iframe页面: 更新显示
```

| 层 | 负责什么 | 主要代码 |
|---|---|---|
| 源码页面 | 布局、筛选、勾选、统计与交互 | `Component.tsx`、CSS |
| 薄 SDK | 通过 postMessage 与外层通信 | `component-runtime/src/client.ts` |
| 外层 SourceFrame | 提供数据、上下文、刷新与附件桥接 | `client/source-frame.tsx` |
| DSH 插件 Host | 注册资源地址，转发本机服务请求 | `server/source-assets.ts` |
| 本机服务 | 数据绑定、构建存档、会话归属和保存 | `packages/service`、`presentation` |

`getData()` 从外层取得当前数据包。外层先从本机服务读取快照；它不为每次勾选调用 Agent 或店铺接口。

`refresh()` 请求外层刷新数据。`getContext()` 提供主题、会话及附件可用状态。`attachSelection()` 把当前选择交给附件桥接。

## E 勾选之后，Agent 什么时候知道

```sequence num
participants: 用户, 源码页面, 插件桥接, 聊天输入框, Agent
用户 -> 源码页面: 勾选商品
源码页面 -> 源码页面: 更新 selected 状态和已选数量
用户 -> 源码页面: 点击附加到聊天
源码页面 -> 插件桥接: bindingId、keys、revision
插件桥接 -> 插件桥接: 从当前快照取回稳定商品ID
插件桥接 -> 聊天输入框: 添加原生 JSON 文件附件
用户 -> 聊天输入框: 补充要求并点击发送
聊天输入框 -> Agent: 用户文字和附件
Agent -> Agent: 读取附件，查询商品并处理要求
```

```callout ok 两个不同时间点
勾选时：只有页面状态改变，Agent 尚未收到消息。

发送时：Agent 才收到文字和附件，并读取所选商品 ID。
```

附件名类似 `Hallmark-已选产品-2项.json`。输入框保留你的原有文字；附加按钮不会自动发送。

下面是协议形状示意。产品 ID 使用示意值，不代表真实商品。

```json
{
  "bindingId": "collected",
  "keys": ["宿主给出的商品选择键"],
  "revision": "当前数据版本"
}
```

页面传递选择键。外层生成的附件再包含 `products` 中的稳定商品 ID。Agent 按 ID 查详情，再结合你的文字决定下一步。

## F 保存、复用和再次修改

```flow
已登记的会话草稿 -> {用户要求保存什么?}
{用户要求保存什么?} -> 保存组件: 固定当前设计与绑定
{用户要求保存什么?} -> 保存源码模板: 作为后续复用起点
保存组件 -> 打开工作副本
保存源码模板 -> 复制新工作副本
打开工作副本 -> 编辑并重新编译
复制新工作副本 -> 编辑并重新编译
编辑并重新编译 -> 登记新构建
```

登记草稿时，源码和构建已经落盘。正式保存到组件库，是另外一个动作。

保存内容包含源码、资源、依赖锁文件、dist 和数据绑定。已有组件支持打开历史版本，再保存为新版本。

**模板复制后成为独立工作副本。** 更新母模板不会自动改写之前复制出的组件。这次我分别更新了内置模板和你正在使用的会话组件。

保存源码模板也会保留绑定配置。复用于其他店铺时，Agent 要明确更换数据绑定；不会因换了标题而自动换店铺。

## G 为什么编译通过，勾选仍会出错

| 环节 | 能确认什么 | 当前是否自动执行 |
|---|---|---|
| 模板的 npm run build | 类型检查、打包成功 | 执行该命令时会运行 |
| 截图与人工式读图 | 颜色、层级、溢出和布局 | Agent 按技能主动调用并查看 |
| 指定交互步骤 | 勾选、筛选、附加后的真实状态 | 需要传入交互步骤 |
| 本次新增回归测试 | 商品模板不再陷入渲染循环 | 运行项目测试时执行 |
| 打开源码工具 | 构建存在、登记和绑定有效 | 调用工具时执行 |

```callout warn 当前并没有统一的自动质量关卡
打开源码工具不会先替每个新组件运行全部交互测试。截图工具未传入步骤时，也不会自动推断该点击哪些按钮。

技能已经要求 Agent 查看截图并操作控件；这是工作指引，不是后端强制检查。
```

本次错误：分页数组每次渲染都改变，触发表格自动重置，再次渲染。

本次修复：缓存分页数组，并声明分页由页面管理。新增测试复现旧错误，验证单选、全选、跨页选择和附件 ID。

复用新版商品模板会带上修复。从零写新组件仍要实际验证。Agent 不会因为这次修复，就自动学会规避所有运行时错误。

## H 对照源码与操作入口

路径均相对于 `E:/project/deepseek_h/dsh-hallmark-app`。

| 想核对的问题 | 文件 |
|---|---|
| 谁让 Agent 优先复制起点 | `skills/hallmark-component-design/SKILL.md` |
| Host 给 Agent 什么指引 | `packages/dsh-plugin/server/design-guidance.ts` |
| 商品模板究竟是什么 | `component-workspace/collected-products/src/Component.tsx` |
| 打开工具有没有编译 | `packages/core/src/index.ts`、`packages/presentation/src/index.ts` |
| 源码与 dist 如何归档 | `packages/source-components/src/index.ts` |
| iframe 怎样交换数据 | `packages/dsh-plugin/client/source-frame.tsx`、`source-bridge.ts` |
| 怎样变成原生附件 | `packages/dsh-plugin/client/selection.ts`、`selection-native.ts` |
| 交互步骤怎么执行 | `scripts/source-capture.mjs` |
| 勾选循环怎样测试 | `test/source-preview/selection-interaction.test.ts` |

[回到两种源码起点](#panel-B) · [重看 Agent 制作过程](#panel-C) · [重看附件时序](#panel-E) · [查看验证边界](#panel-G)

这次只解释现有实现，没有改变 Agent 技能、接口或你的组件。
