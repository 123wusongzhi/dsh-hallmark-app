# 原聊天中创建、编辑组件：架构与体验评审

日期：2026-10-07。按最新要求保留现有 DSH 桌面外壳：任意已有会话在原输入框 `@` 应用，使用同一个 Agent；只补应用工作台、右侧组件和必要输入扩展，不新增聊天标签或全局工作台顶栏。

## 查看成果

| 成果 | 入口 | 用途 |
|---|---|---|
| 目标架构 | [03_ARCHITECTURE.md 的 FIG-13 / FIG-14](requirements/03_ARCHITECTURE.md#fig-13--原聊天中创建编辑与保存组件的闭环) | 状态所有者、稳定身份、源码与构建、真实预览、保存版本、失败与冲突 |
| 可编辑工程图 | [FIG-13](architecture/chat-component-authoring/FIG-13.svg)、[FIG-14](architecture/chat-component-authoring/FIG-14.svg)、[图源说明](architecture/chat-component-authoring/README.md) | 精确核对关系与顺序；工程解释以这些图和正文为准 |
| 生图说明 | [模型生成的闭环图](design-reference/20261007-chat-authoring-architecture-generated.png)、[完整提示词与修改记录](design-reference/imagegen-prompts-chat-authoring-20261007.md) | 帮助直观理解原聊天、工作副本、预览迭代与明确保存 |
| 可交互原型 | [单文件 HTML](prototypes/chat-component-authoring.html)、[使用说明](prototypes/README.md) | 双击离线打开，实际点击体验界面流程 |
| 浏览器评审记录 | [实际原型画面](prototypes/chat-component-authoring-browser.jpg)、[检查记录](prototypes/chat-component-authoring-browser-check.json) | 本地 HTML 的操作检查；与生产桌面验收分开 |

## 打开与体验

clone 仓库后双击 `docs/prototypes/chat-component-authoring.html`，或在 GitHub 文件页选择 **Download raw file** 下载后用浏览器打开。它是单文件离线 HTML，没有 CDN 或网络请求，不依赖原开发机的本地服务地址。界面顶部的“应用工作台”打开插件范围内的工作台，左侧原会话列表可切换示例会话。

建议按以下顺序操作：

1. 在原会话输入 `@` 选择 Hallmark，输入要求并手动发送，或使用示例指令体验创建/编辑阶段。
2. 在右侧组件搜索、筛选、排序、勾选商品；先写正文，再附加 JSON，确认正文保留且没有自动发送。
3. 继续聊天修改组件；明确保存后在应用入口的组件库查看版本，或在另一个原会话打开独立副本。
4. 切换“补货计划讨论”后再切回，确认正文、引用、附件与草稿按会话隔离。明确打开同一保存资产会创建属于目标会话的独立工作副本。
5. 点击“查看架构流程”查看身份与阶段，演示构建失败保留、保存冲突、工作副本恢复。失败尝试不能保存，冲突不会静默覆盖已有版本。

筛选、排序和勾选只改变当前展示；刷新只更新示例数据快照并处理失效选择，保留组件设计。附加 JSON 保留输入正文与右侧组件，相同快照和选择去重；只有用户手动发送才成为消息。保存不是构建后的自动动作，需要明确确认名称或新版本。

原型使用浏览器 `localStorage`（`dsh-chat-component-authoring-v3`）保存演示状态。“架构流程”可导出本地 JSON 或确认重置；重置仅影响原型示例。更多细节和检查入口见[原型使用说明](prototypes/README.md)。

## 完成范围与后续接线

[Apps V1 candidate.6](apps-v1-candidate.md) 是此前候选实现及验收范围；本轮 A.1 补充则是最新前端创作体验的架构和原型。原有候选测试、旧桌面组件显示记录与这份 HTML 的检查各有范围，不能互相替代。新增 AC-13-01 至 AC-13-09 是生产实现后的验证计划。

HTML 使用示例数据和本地状态模拟；其中“编辑、构建、预览、登记”和 Agent 回复不调用真实模型、源码构建器、DSH 或店铺。原型交互检查与图的渲染检查只覆盖评审材料，不能用来证明 FIG-13 / FIG-14 的生产桌面验收已通过。

实际接线缺口仍按架构正文保留：原生 `@` 候选与 Runtime 绑定、真实会话/附件桥、v2 预览协议及 Agent 可读取的真实截图和交互反馈。原引用 chip 不能替代 `sessionId/appId/connectionId` 绑定；真实编辑需构建同一份 dist 并取得对应 build 的截图、运行错误和交互反馈。图与原型不替代这些实现。

保存或重开资产时，工作副本、构建、会话 view 与保存版本分别拥有稳定身份。保存更新比较 `expectedRevision`；迟到结果不能修改另一会话，失败或取消保留旧可用展示。可编辑源码、不可变构建和明确保存资产的精确关系见[FIG-13](architecture/chat-component-authoring/FIG-13.svg)；完整顺序和冲突路径见[FIG-14](architecture/chat-component-authoring/FIG-14.svg)。
