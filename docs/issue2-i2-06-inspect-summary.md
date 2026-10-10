# I2-06：inspect 状态摘要

2026-10-08。基于 candidate.25，candidate.26 已安装，运行版本与真实 inspect 摘要已核实；后续 candidate.27 保留此修复。实际 Agent 行为仍待新轨迹验证。

本次只改现有 inspect 返回、Schema、模型大结果投影和当前创作指引，不扩展 CLI 或增加自动动作。

`apps.authoring.inspect` 仍使用原 attemptId 或 publicationId。新增 `summary`：

- `lastConfirmedDisplay`：同一会话/视图中有 readyAt 证据的最近显示，可能属于旧构建。它不表示此刻仍显示。
- `preparedBuild`：被检查尝试已通过预览、尚未确认显示的构建及回执。
- `currentDisplay`：本次 publication 的最新显示，或显式指定的 display。
- `blockedStage`：已知受阻阶段；无证据时 unknown。
- `nextAction`：建议动作、原因、目标身份和已记录显示错误码；只给建议，不执行。
- `requiresRebuild`：true/false/null；null 为证据不足，不能理解成默认重建。

已知显示连接错误且 build/preview 均 PASS 时建议重开同一构建。组件脚本异常建议先定位源码再构建；不明失败建议读证据。预览 BLOCKED/NOT_RUN 且没有页面运行异常时建议补环境。构建失败先读日志，不把环境问题假定成源码问题。成功显示不自动建议保存。

大结果仍保留原始 resultRef；预算允许时单独提供完整 authoringSummary，避免摘要身份被普通样本裁剪。原详细对象保持不变。

验证：后端构造旧版成功/新版失败，检查两个 buildId 与目标 publication；覆盖已知连接错误、未知错误、源码错误、预览缺能力；检查输出 Schema，以及大结果摘要与原始引用并存。

现场建议：新插件安装后，让 Agent 对已有组件调用一次 inspect，确认它先依据 summary 给出结论；不需修改或重建商品组件。是否减少真实 Agent 调用次数，仍需新轨迹验证。
