# 商品选择进入原生附件栏

本轮源码把“附加到当前聊天”改为 **DSH 原生 JSON 文件附件**。选中商品本身不产生附件；点击附加后才创建 `Hallmark-已选产品-N项.json` 并交给原生附件栏。已写正文保持原样，插件不调用 `insertText`、`setDraft`、`send` 或 `submit`。

本轮未安装、未重启 DSH 或业务服务、未发送真实附件，也没有真实店铺写入。专项测试使用合成数据与原生接口的 mock；不能据此声称已完成安装版 UI 验收。

## 调用链与归属

`ProductTable → ProductSelectionProvider → buildProductSelection → SelectionInputBridge → ConversationController.createDrafts(sessionId, [File]) → inputActions.addAttachments(ids)`。

- 文件只包含 schema 类型/版本、来源 sessionId、viewId、widgetId、bindingId、datasetKey、可用时间戳、来源类型与稳定商品标识。采集产品携带 itemId；店铺商品携带 storeId 与 offerId/productId。不复制整行商品信息、凭据或显示字段映射。
- 单次最多 100 个产品；仍要求当前快照中的原始行、无重复/冲突标识、明确店铺与会话归属。排序与翻页不改变 ID；刷新使旧选择失效。
- 先验证当前会话、输入状态、业务 composer block、已删除会话与子代理限制，再创建文件。创建后再次确认 session、输入绑定 token 与附件 runtime 未变化；原生拒绝接收时，释放本次新建 draft，保留已有附件与正文。
- 接收成功后生命周期属于 DSH：上传进度、上传失败后的重试、移除附件、手动发送、消息恢复均由原生处理。组件卸载和普通会话切换不会擅自删除已接收附件。重复点击同一选择复用仍在输入框中的附件；用户移除或发送后可以重新附加。
- 工作台回聊天的延迟意图只保存文件内容，10 秒内在精确原会话输入框挂载后才注册文件；更换会话、导航失败、接口缺失或超时会取消。不会在后台猜一个会话。

## 宿主兼容契约

已核对用户安装的 **DSH 0.2.0-rc.2** ASAR，并下载同版本官方 npm SDK 作类型证据（只解包，无安装或执行脚本）。

实际安装源码证据：[conversation client.js](../test/spike/attachment-evidence/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js)。

| 契约 | 安装源码位置 | 行为 |
|---|---|---|
| 原生输入 action | `client.js:13460`、`:13555` | `addAttachments(ids)` 追加附件 ID；adjudicating/submitting 时拒绝 |
| 原生文件 draft | `client.js:3477` | `createDrafts(sessionId, files)` 注册 File，非图片立即加入上传队列 |
| 失败清理 | `client.js:3637`、`:3654` | `releaseDraftAttachment(s)` 中止上传、移除浏览器 draft 与上传状态 |
| 原生接收路径 | `client.js:18358` | 官方本身采用 createDrafts → addFiles → 拒绝时 release 的流程 |
| 原生附件 UI | `client.js:17245`、`:17458` | 附件与文字独立；附件栏接收移除/重试动作，文件未 ready 时禁用发送 |
| 手动发送 | `client.js:3404` | file draft 序列化为所属 Session 的暂存凭证，与用户文字共同提交 |

类型证据：[client/index.d.ts](../test/spike/sdk-conversation-attachments-0.2.0-rc.2/package/lib/types/client/index.d.ts)、[service.d.ts](../test/spike/sdk-conversation-attachments-0.2.0-rc.2/package/lib/types/client/service.d.ts)、[input.d.ts](../test/spike/sdk-conversation-attachments-0.2.0-rc.2/package/lib/types/client/contract/input.d.ts)。

`InputActions.addAttachments` 是公开输入接口。`createDrafts` / `releaseDraftAttachments` 是公开导出的 `ConversationController` 类方法，但不包含在 `ctx.conversation` 的窄接口 `IConversation` 中；官方内部也把这部分称为 package-internal。因此本实现是 **针对已核对版本的隔离兼容适配器**，不是对所有 DSH 版本稳定的 SDK 保证。`selection-native.ts` 检测类方法与 composer block 接口，不读取私有 map、editor 或 DOM。能力缺失时显示不可用，不退回正文。

插件 manifest `dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-conversation`；Cordis client 服务注入增加 `conversation`。没有添加独立服务或 Host API。

释放 draft 不等于删除已上传的本机附件副本：原生清理浏览器状态和活动上传，已生成的内容寻址文件可能保留，由 DSH 维护。若宿主自身在注册后同步抛错且未返回 ID，插件不能访问私有 registry 去补偿；当前标准 JSON 路径的上传失败由原生异步 error 状态处理。

## Agent 如何读取

DSH 的普通文件附件会成为带本机只读副本路径的模型输入，宿主提示模型通过文件工具读取；它不会自动把整个 JSON 展开成聊天正文。Agent 应先读取 JSON，再结合用户这条消息的要求解释商品 ID。`sessionId`、`viewId`、`datasetKey` 是来源信息，不构成业务写权限或新的会话授权。

原生切换 Workspace 可以把未发送草稿与附件移至新的聊天并重新暂存；文件里的来源 sessionId 保持原值。因此不能仅凭附件内容访问旧会话的 view，必须走现有会话、数据和工具权限校验。插件不会自动激活 Hallmark 或自动执行商品操作。

## 尚需安装版验收

1. 在普通原聊天中选择 1 个和多个产品：附件栏出现 JSON 文件卡，原正文逐字不变，上传完成前发送状态符合 DSH 原生行为。
2. 重复附加、移除、上传失败/重试、切换聊天再返回：没有重复文件、串会话或丢失原附件。
3. 工作台回原聊天附加及刷新后重选，缺接口、已删除聊天、子代理和 composer block 情况均正确解释。
4. 用户手动发送后，Agent 通过文件工具读取 JSON，核对稳定商品 ID、来源会话和 dataset，随后按用户要求操作。此项可先用只读查询验收。

原 `test/browser/selection-fixture.tsx` 已更新为文件附件 mock，保留表格排序/分页/刷新测试；本轮不启动浏览器或截图工具，只检查编译。
