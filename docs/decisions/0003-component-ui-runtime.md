# 组件渲染接入：React 18 宿主与分阶段 json-render

核实日期：2026-10-06。此记录描述工作区的 0.2.0 待安装代码；不表示运行中的 DSH 已更新。

## 已核实的宿主

只读读取已安装的 `C:/Users/wubil/AppData/Local/Programs/DeepSeek Harness/resources/app.asar`，未修改 ASAR 或 profile。

- `dsh/node_modules/@deepseek-ai/dsh-web-frontend/package.json`：DSH `0.2.0-rc.2`。
- `dsh-web-frontend/dist/assets/index-5SrrfWpU.js`：React `18.3.1`；ReactDOM 导出的版本为 `18.3.1-next-f1338f8080-20240426`，renderer 报告 `18.3.1`。
- 同一 shell 的平台模块表包含 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`。
- `dsh-client-ui-renderer/lib/client.js` 通过上述种子共享 React/ReactDOM。

因此插件继续使用宿主 React 实例。构建新增 ReactDOM external，并固定本地开发 React/ReactDOM 为 `18.3.1`、types 为 `18.3.1` / `18.3.0`。本地稳定 ReactDOM 不等于宿主构建的完整复刻，仍需实际 DSH GUI 验收。

## 实际接入

| 依赖 | 固定版本 / 来源 | 实际调用路径 |
| --- | --- | --- |
| TanStack Table | `8.21.3` | `widgets/product-table.tsx` 使用 `useReactTable`、排序、分页、稳定行身份与行选择 |
| Recharts | `3.10.1`，`react-is 18.3.1` | `widgets/business-chart.tsx` 使用折线/柱图、坐标轴、Tooltip、响应式容器 |
| shadcn/ui | 官方 `new-york-v4/ui/table.tsx` 局部源码 | `ui/table.tsx` 保留结构，Tailwind utilities 替换为 `hm-*` 作用域规则；MIT 许可随包保留 |
| json-render core | `0.21.0` + `zod 4.3.6` | `render-catalog.ts` 建立 catalog、校验、产生平面树；`renderer.tsx` 实际读取派生树渲染 |

TanStack 有更新的 v9，本次固定 v8 与成熟 `useReactTable` API 对齐，升级需单独迁移。shadcn 是局部源码适配，不宣称已接入完整 Tailwind/shadcn 组件集。

## json-render 的边界

官方 npm 元数据显示所有已发布 `@json-render/react` 版本要求 React 19：早期要求 `^19.0.0`，从 `0.5.0` 起要求 `^19.2.3`。当前宿主为 React 18，因此不安装它，不忽略 peer，不引入第二份 React，不修改 DSH 核心。

当前采用 core 支持的自定义 renderer 方式：ViewSpec → 确定性转换 → catalog 验证与本地严格字段校验 → 宿主兼容的 React 渲染器。派生树只含组件 ID 和布局参数，不含商品数据/查询、任意表达式或业务动作；ViewSpec 仍是唯一保存格式。

`catalog.validate()` 对动态 props 的归一化不能替代本地严格白名单，因此另用各组件 Zod schema 明确拒绝额外属性。自定义 schema 未引入 json-render/react 的默认示例数据提示规则。未来只有在宿主官方支持兼容 React 版本后，再评估直接切换其 React runtime。

## 交互与数据保留

- 表格选择仅在可信来源、稳定原始业务 ID、明确当前会话成立时启用；显示别名和行号不能成为业务身份。
- 排序/分页保留已选商品，快照/绑定/会话/视图替换时立即使旧选择失效；上限 100 个。
- “附加到当前聊天”通过公开原生输入 API 写入可见结构化上下文，用户补充要求后自行发送，不自动提交消息或操作店铺。
- 排序只针对已加载快照，文案明确范围，不假装实现服务端全店查询。
- 图表保留来源/数据时间/利润口径与数值表；缺成本的利润不当零。非利润指标不因成本缺失被排除。
- 不引入全局 CSS reset，原宿主主题通过现有 `--hm-*` token 继承；图表关闭入场动画，容器有明确高度。

## 证据与待验

本次开发阶段：依赖安装禁用 lifecycle 脚本；root 类型检查、预构建和插件客户端 50 项测试通过。产物未压缩约 1.85 MB（后续改动会变化），外部 require 只有 React / JSX runtime / ReactDOM，未捆入第二份 React/ReactDOM。选择与图表独立浏览器 fixture 19 项断言通过，包括真实折线 SVG、正负柱形、隐藏标签后恢复、340px 容器缩窄/恢复、缺成本/缺数值不当零，以及不完整布局草稿的行内错误和修正恢复（无 React error 日志）。截图位于 `test/browser/selection-artifacts/recharts-line-wide.png` 和 `recharts-bar-narrow.png`。以上是合成验证，不替代实际宿主/真实商品验收。

上游来源：[TanStack v8](https://github.com/TanStack/table/tree/v8.21.3)、[Recharts](https://github.com/recharts/recharts)、[shadcn Table](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/table.tsx)、[json-render core](https://github.com/vercel-labs/json-render/tree/main/packages/core)、[json-render React peer](https://github.com/vercel-labs/json-render/blob/main/packages/react/package.json)。
