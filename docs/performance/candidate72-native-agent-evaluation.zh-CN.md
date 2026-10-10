# candidate72：平台 native agent 受限 CLI 任务对照

这是每任务每臂一个全新平台 native agent 的小样本观察，通过本地 CLI 调用真实 Host/Runtime。不是部署中 DSH 宿主模型评测，不能推断通用成功率、总体节省或生产时延。没有外部 LLM API 或真实店铺。

## 条件与限制

每个 agent 只得到同一个合成任务与不透明 CLI 入口，要求只能 list-tools / call-tool，不读源码、不绕过网关。此信息边界是任务约束，不是操作系统沙箱。两臂同字节种子，冻结真实源文件并记录哈希；业务 Provider 写入口被禁用。每条轨迹记录实际参数、模型文本 UTF-8 字节、受保护状态一致性。

初期修复快照包含渐进 describe 与 invocation recovery v1。最终恢复终态衔接及 operation-owner v2 在这些盲测之后完成，有独立确定性/安全回归；这些盲测不冒充最终版本所有变化的模型验证。

基线源快照 SHA256：5bc541d649376c2aa5b475245cf1bbc8d9e4bf052593970b8341e85761d58cda。修复快照：f3d14c150f883113fd20cca6a2de37865d4ecc39cea3451c33e1a0b94d02184a。快照哈希标识选定源码集合，不是 Git commit。

## A：解释已有组件草稿为何被阻塞

|版本|结果|业务工具调用|工具返回字节|
|---|---|---:|---:|
|baseline|成功，尽管 describe 失败，agent 自行猜出合法 attemptId 输入|3|4882|
|patched|成功，先 full 目录，再 input，最后 inspect|4|7088|

两者均正确报告需要首次 build、requiresRebuild=false，无写操作。修复在这一小样本中多一次调用、更多字节；保留为负面证据，不能声称现版本让实际 agent 更少步骤。

metadata 单次 list-tools 基线2526B，修复3328B，单次计入合计7408B与10416B。基线原始日志有两次 list-tools，第一条来源仍需核实；原始本地两条均保留，仓库收录摘要及响应哈希，不擅自归因或丢弃。若把两条都计入日志总量，基线合计9934B。这不影响3次业务工具调用/4882B结论。

轨迹：[A baseline](candidate72-toolchain-evidence/blind-a-baseline.jsonl)、[A patched](candidate72-toolchain-evidence/blind-a-patched.jsonl)。

## B：只用原 invocationId 找回已提交但回执丢失的写入结果

|版本|结果|业务工具调用|工具返回字节|
|---|---|---:|---:|
|baseline|诚实报告无法确认原调用回执|3|9691|
|patched|一次 apps_inspect 返回原调用成功回执|1|782|

含各一次 metadata 总字节12217→4110。修复返回原 invocationId、traceId、operationId、revision=1。两臂无 Provider execute/inspect，也没有重发写入、创建新业务调用或修改受保护状态。基线未把“找到相似记录”冒充该调用的可靠回执。

轨迹：[B baseline](candidate72-toolchain-evidence/blind-b-baseline.jsonl)、[B patched](candidate72-toolchain-evidence/blind-b-patched.jsonl)。

## 后续与复跑

A 的额外 full/input 决策是下一轮协议设计实验的依据，未混入当前首批生产修复。可移植 harness 位于 `scripts/evidence/portable-harness.mjs`，准备/冻结/只读网关方式见同目录 README.native-agent-harness.md。重新运行可能得到不同 agent 行为；确定性 smoke 只验证真实网关与约束，不代替新 agent 任务试验。
