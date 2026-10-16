# Agent 提交进度反馈：最小 UX 修补

基线：`fd95bc22929bfbfa850e0312357322578287a10c`。只修改已有 SDK 的 `AppsAgentActions`，不增加聊天、任务调度或平台接口。

## 复现与改动

真实 React 组件接入受控 deferred Promise，等待过程不依赖睡眠：

- 基线在 `updateContext` 尚未返回时仍显示“选择尚未发布。”，新测试在 `/正在更新上下文/` 断言上失败。请求 Agent 尚未返回时同样只显示旧的选择提示。
- 现在分别显示“正在更新上下文”与“正在提交任务”。对应按钮带 `aria-busy`，状态消息为原子 live status；没有假百分比。
- `prepared` 显示等待派发，`dispatching` 显示正在派发，`accepted` 明确已提交并排队、等待代理处理。后续进展仍在当前聊天中。
- `unknown` 显示结果待确认，`failed` 显示提交未完成。两者均保留原锁与检查原请求入口，不据此推断未派发。
- 明确前置拒绝仍可修改、更新上下文后显式重试。没有检查回调的宿主提供回到当前聊天核对的文字指引。
- “准备新任务”只清空输入和准备新的草稿，提示上一任务仍应在当前聊天查看，不重复提交前单。

## 状态和恢复范围

- 原生 `accepted` 只证明输入已持久排队，不证明 Agent 已消费或完成。此修补不生成“已完成”状态。
- 同一组件在提交未知时继续禁止重发。两个组件的提交锁彼此独立；其中一个挂起时，另一个仍能更新上下文并完成接收。
- 工作台普通切标签目前保留已挂载视图，其他工作仍由现有导航控制。真正卸载 iframe 后，本组件的局部提示状态不持久化；本次未宣称修复跨卸载任务提示。
- 提交控件没有可安全中断已派发 Agent 输入的取消协议，因此不新增虚假的取消按钮。独立的 authoring cancel、原界面回执检查继续沿用现有能力。
- 没有放宽平台限流、连接锁、mutation 串行、审阅/确认或不确定调用恢复语义。

## 验证

新增 `test/apps-components/agent-feedback.test.ts` 直接挂载生产 `AppsAgentActions`，断言：

1. 两次快速更新只有 1 个 context 请求，等待期间有正确进度。
2. 两次快速提交只有 1 个 Agent 请求，等待期间输入与提交仍锁定。
3. 第一个组件挂起时，第二组件可完成更新与接收。
4. 五种回执状态均显示中文及下一步；检查回调收到原 request ID，检查不产生新提交。
5. 已接受后准备新任务不提交任何内容，旧文本被清空。
6. 超时保留未知状态和锁；明确未提交的失败允许继续更正。
7. fixture 禁止所有 fetch，实际平台请求数为 0。

Node v24.19.0 与 v22.18.0 均完成相同 6 文件、10 项测试：10 pass / 0 fail / 0 skip / 0 cancelled。

测试文件：

- `test/apps-components/agent-feedback.test.ts`
- `test/apps-components/agent-actions.test.ts`
- `test/apps-components/agent-recovery.test.ts`
- `test/presentation/agent-chain-queue.test.ts`
- `test/plugin-apps/native-recovery.test.ts`
- `test/plugin-apps/session-hub.test.ts`

`tsc --noEmit` 通过。首次 typecheck 因 fresh worktree 缺少忽略的 `test/real-data/browser-data.ts` 报错；只链接已有本地 fixture 后重跑通过，没有下载、修改或提交私有数据。

未跑全量 build，未调用真实平台，未 push。此次为组件渲染/交互和本地 Host/Runtime 回归，未完成真实浏览器截图验收，也不据此声称线上任务完成更快或用户留存提高。
