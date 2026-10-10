# candidate72：原 invocationId 的安全只读恢复 prototype

## 结论

已在 candidate72（commit `4e1cd98082a432e2ca89f606927da29eb26ddb67`）复现并闭合网关断链。Provider 已接受唯一变更，但写响应、即时 invocation 回查同时丢失后，原版 `apps_inspect` 拒绝唯一剩余的 `invocationId`。补丁让 Agent 下一步合法调用 `apps_inspect({invocationId})`，经实际注册工具的 `execute → output.render` 取得原调用回执。

这是确定性故障注入与工具可用性验证，不是真实 LLM 成功率。未使用实际店铺、真实凭据、付费服务或外部模型；没有 push、PR、merge、部署。

## 安全边界

- 新分支只读取原 invocation 账本；不调用业务 `invoke`、Provider `inspect` 或 `continueOperation`，不生成新的恢复 invocationId。
- 原生 Agent 对象身份由 Host 验证，sessionId 由 Host 注入，不能由工具参数覆盖。
- Runtime 核对原 session owner、原应用/connection 仍启用且绑定、原 configRevision、精确 capabilityVersion、requestHash、invocation→operation 映射、operation owner/身份/版本及结果的 invocationId/traceId。
- 新恢复端点不返回 request、input、连接 config、令牌。测试在私有输入、配置、HTTP 认证中放置合成标记并断言恢复 HTTP 输出没有这些值。
- pending/unknown 在没有可验证的终态证据时保留原状态，并给出同一 invocationId 的只读下一步。若另一个既有只读 inspection 已使 operation 终态，则严格核对其已 settled 的来源 invocation、requestHash、intent hash、operation 映射、config/version、trace 与结果全体一致，才采用该实际结果。返回仍保留被查询的原 invocationId/traceId，并在 recoveryEvidence 中明确 operation-ledger、observedInvocationId/observedTraceId、originalStatus。新入口自身不发起这个 Provider inspection，也不新增身份。
- 模型输出上限 16,384 UTF-8 字节；大回执沿用现有 resultRef 分页。此时投影可能写入 Runtime 的 datasets 结果缓存；它不改 invocation/operation 账本，更不重发业务写。因此“只读”指业务操作与原调用账本只读，并不声称整个数据库绝无缓存写入。
- 原 operationId、resultRef 分支及旧 SDK 自动恢复机制不变；旧原始 invocation 查询端点的既有接口范围不在此补丁中重新设计。

## 确定性轨迹

开始统计前已启动 Host；统计从第一个 Agent 工具调用开始，包含每次工具内握手。

|路径|原版|补丁|
|---|---|---|
|routed 第1次模型结果|unavailable / RUNTIME_UNAVAILABLE|相同|
|routed 第2次 apps_inspect|failed / INVALID_INPUT|ok，原 invocationId/traceId/operationId|
|legacy 第1次模型结果|failed / RESULT_SPILL_FAILED，保留原 ID|相同|
|legacy 第2次 apps_inspect|failed / INVALID_INPUT|ok，原 invocationId/traceId/operationId|

legacy 路径原本还会尝试模型投影查询；本用例同时令该查询不可达。原版把缺失投影呈现为 RESULT_SPILL_FAILED，这一既有降级问题未伪装成成功。补丁的下一次合法恢复能闭环。

|路径与版本|工具调用数|HTTP 调用数|请求 payload 字节|收到响应 payload 字节|两次模型输出字节|
|---|---:|---:|---:|---:|---|
|routed baseline|2|4|454|880|300、228|
|routed patched|2|6|454|1631|300、217|
|legacy baseline|2|7|500|1331|222、228|
|legacy patched|2|9|500|2060|222、217|

所有四条轨迹均为 1 次 Provider execute、0 次 Provider inspect、1 次变更 POST、1 条 invocation、1 条 operation。补丁多出的 2 个 HTTP 请求均为 GET：运行时握手和受 session 约束的原调用恢复；恢复本身没有新写提交。payload 计数是 UTF-8 JSON body，不包含请求行、URL、HTTP headers、TCP 开销；丢失的响应不算“收到响应”。没有把多一次有效恢复的开销称为性能加速。

## 验证

- 最终 35/35 新用例通过：routed/legacy 完整注册工具轨迹、互斥参数、伪 Agent、跨 owner、错误/禁用连接、配置与版本变化、hash/结果/operation 映射或状态损坏、未知/待完成结果、暂时读失败、大结果分页、并发同 ID、缺失记录，以及 pending/unknown→终态和8种终态来源证据损坏。
- 38/38 既有 transport-error-contract 回归通过。
- 最终联合回归 73/73（35 新用例 + 38 既有 transport）通过，日志为 final-tests.log；`tsc --noEmit` 通过，`git diff --check` 通过。
- 同一成功断言在独立 candidate72 原版工作树确定性 2/2 失败（实际 failed，对比预期 ok）；另一个 baseline 观察模式 2/2 通过只证明原故障被准确复现。
- 非作者审查发现 v1 原调用快照可能停留 pending、operation 却已终态的循环；已用真实 Provider pending→runtime.inspect→新入口复现 red，v2 补来源证据核验后 green。pending-terminal-red.log 保留失败，patched/trajectory.json 的 transitionTraces 保留实际转移轨迹。旧 patched-tests.log 是 v1 25项历史结果，最终以 final-tests.log 为准。
- 以上是补丁阶段验证；全仓结果另见组合门禁。未运行真实桌面、真实模型、实际业务验收或正式性能计时。

## 文件与复跑

生产入口：`packages/service/src/invocation-recovery.ts`、`packages/service/src/apps-server.ts`、`packages/plugin-apps/src/{index,transport}.ts`。测试：`test/apps-host/invocation-recovery.test.ts`；非作者 HTTP 边界：`test/apps-host/invocation-recovery-boundaries.test.ts`。

实际轨迹已收录： [基线](candidate72-toolchain-evidence/invocation-baseline.json)、[修复](candidate72-toolchain-evidence/invocation-patched.json)、[对照](candidate72-toolchain-evidence/invocation-comparison.json)。早期 red/green 日志名是补丁阶段本地记录，不表示独立公开附件；下面 runner 可重新生成。

```sh
bash test/acceptance/toolchain-c72/recovery-comparison.sh /path/to/patched /path/to/clean-c72 /path/to/new-evidence
```

runner 自带整段 flock，只新建本地 baseline worktree、复用依赖，不 fetch/install。不能重复套同一个锁。原版成功断言应 red，修复应 green。参见 [native A/B 盲测](candidate72-native-agent-evaluation.zh-CN.md) 与 [最终组合门禁](candidate72-integration-gate.zh-CN.md)。
