# 83cf 与 8947 的组合回归基线

本轮时钟优化对比的共同基线是 8947e821476bcca376a680b263e4f2da2f775911 与 83cf96d1dc04e1af77f5862f18e697d49b0a60eb 的解决后内容树 d62c32106e378b347b487e0b38bdffe324ca222e。工作树 HEAD 仍为 8947，准确输入以已暂存内容树和逐文件哈希为准；不得把本轮结果称作仅对 8947 提交的运行。

## 冲突处理

- locator：保留本分支精确五页、64 KiB 空扫描窗、精确 offset/readCursor、完整 continuation、原文上下文、retained 原始数据和 Provider 一次执行断言。结合上游 lifetime、请求 signal、逐步有界等待与清理；Provider gate 的提前拒绝和提前返回由 race 传播。listen 增加 aborted 提前检查和 abort listener 清理。清理采用有引用的 2000 ms timer，并在 finally 清除，逐层记录状态和原因。
- long-read：保留精确 result:original-read 断言，采纳上游 signal 监听、retained 存在性断言和 cleanup 诊断。
- CSV：完整有效带引号记录使用独立字面预期，再仅去掉 EOF 引号期待精确 CSV 错误。
- client：仅采完整源路径注释，业务断言保留。
- scope：逐字保留 8947；双方 required 162、infrastructure 161 集合完全一致且无重复，fileModes 相同。两个 reason 保留本分支更完整描述，而不采纳上游缩写/排序。
- 上游 docs/test-issue-review-51-54-20261016.md 作为历史记录保留。其 #53 中“移除精确页数/readCursor 约束”的说明描述上游自己的版本，不代表这个合并后的分支；本次明确保留这些已有断言。

生产 packages、component-workspace、templates 相对 8947 零改动。依赖只复用原有三处本地目录，未执行安装，symlink 未进入 index。

## 新 harness 的实际故障验证

最终基线对应的 locator 正常文件运行 2/2 通过。以下 test-only 临时控制均保留第一条测试通过，目标测试按设计自然失败，退出码 1，无外部超时/强杀，cancelled=0；完成后测试文件字节恢复，生产输入哈希不变：

1. 真实 Host 初始化请求拒绝。
2. Provider 实际进入 queryGate 后 abort，日志确认 Provider gate 已到达；清理释放 gate，等待 pending query，关闭 Server 和 Store。
3. invoke 在 Provider 进入前早拒绝，race 传播错误，不悬挂。
4. Runtime 已 dispose 后注入不结束的清理 Promise：准确报告 Runtime:failed、2000 ms 超时，继续关闭 Store，不伪称全部关闭。
5. Provider abort 叠加 Runtime 清理不结束：保留原 CONTROL_PROVIDER_ABORT 及 cleanup timeout 诊断；最终 Store 关闭。

旧 unref 清理同一个 disposal-hang 对照实际自然退出约 5.7 秒，cancelled=0。首次 beforeExit 观测 Store 尚未关闭，随后清理结束和最终 beforeExit 均确认 Store 已关闭。因此没有复现“旧实现必然取消或最终泄漏”；新 helper 仅明确 2 秒清理期限和失败诊断，不作为新生产缺陷宣称。

原始控制日志、精确 source/log SHA 和恢复结果保留在此次本地验证材料。完整回归结果单独记录，不能把这些故障控制计入全仓通过数。
