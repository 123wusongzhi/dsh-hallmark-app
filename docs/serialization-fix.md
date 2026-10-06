# DSH request/header 序列化修复

2026-10-06：普通聊天失败，提示 `session event "request/header" carries non-JSON-serializable data`。

Hallmark 的字符串参数构造器在未提供说明时仍生成 `description: undefined`，23 个工具中累计存在 42 个此类字段。工具全局注册，因此未激活 Hallmark 的普通聊天也会携带这些参数。DSH 的无损 JSON 检查拒绝 undefined，模型请求尚未发送便失败。

修复位于 `packages/contracts/src/index.ts`：未提供 description 时省略该字段，保留已有说明、参数类型和约束。`test/contracts/serialization.test.ts` 对所有工具在请求头中的 JSON 往返进行深度相等校验，防止静默丢失可选字段。

验证：

- TypeScript 类型检查通过。
- 序列化与插件服务端相关测试：12 项通过。
- 从实际安装的 DSH 提取的 `snapshotJsonValue`：修复前拒绝请求头；修复后接受全部 23 个工具。
- 重新构建 Host/Client，将修复后的 Host 文件同步到 desktop profile 安装目录，并保留原文件于 `test/serialization/installed-backup-20261006/`。
- 仅停用并重新启用插件仍使用旧模块缓存；通过应用菜单正常退出并重新打开 DSH 后生效。
- 在原报错会话“你好问候”中发送“重启后验证：请只回复‘验证通过’，不要调用任何工具。”，DSH 显示“已完成，用时 1秒”，模型回复“验证通过”。Hallmark 保持启用。

原失败轮次作为历史记录保留，修复后新请求正常完成。
