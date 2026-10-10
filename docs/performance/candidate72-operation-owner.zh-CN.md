# candidate72：Agent operationId 回查的跨会话边界

## 已证实的问题

在 candidate72 (`4e1cd98082a432e2ca89f606927da29eb26ddb67`) 的真实 loopback Runtime 与注册网关上，拿到另一会话的 operationId 后：

1. 已绑定同一 connection 的另一会话能够通过 `apps_inspect({operationId})` 读到原 owner 回执。
2. 完全没有绑定该 connection 的另一会话也能读到相同回执。

两个 baseline 用例都呈现 `ok` 和合成 owner-only 标记，而且各新增一条 recovery invocation。Provider execute 仍为 1、Provider inspect 为 0，原因是已完成 operation 直接从账本返回。风险前提是已知 operationId；本测试没有声称可以猜出随机 ID。与 resultRef 明确允许同连接 fork 继承的既有产品语义分开评估；“完全未绑定也返回数据”已独立证明边界缺失。

## 独立最小修复

- Agent Host 改用 `inspectForSession(operationId, trustedSessionId)`，session 从已验证的原生 Agent 对象取得，工具 schema 不接受调用者覆盖它。
- 新 `/v1/operations/:id/inspect-session` 在进入现有 `runtime.inspect` 前，核原 owner、原 invocation 归属和 app/connection/capability tuple、原 connection 的启用与绑定、configRevision、精确 capabilityVersion。
- 只读 Provider inspection 的 await 前后执行同一套 scope 校验，并比较原 request/intent/config、descriptor、binding 的稳定指纹；失权后拒绝交付，但不篡改已经发生的 operation 终态。
- 最终授权检查之后，同一同步执行段完成模型投影与响应序列化，返回成对的 result/modelProjection。Host 不再发起后续无作用域 model-result 请求。
- 不支持会话作用域 transport 时 fail closed，不回退到旧无作用域接口。
- 外会话与不存在 operation 返回相同的 OPERATION_NOT_FOUND；拒绝发生在新 invocation / Provider inspection 之前。
- 原 owner 的 pending 操作仍可按旧语义进行只读 Provider inspection，原 owner 已完成回查仍返回实际回执。

边界：旧公开 SDK `transport.inspect`、Runtime 内部 `inspect` 和持有 Runtime token 的既有特权 HTTP API 没有改变。此补丁收紧 Agent 工具入口，不能宣称把整个 Runtime 特权 API 都改成了用户 session 授权模型。合法 operation inspection 仍可创建既有语义的 recovery invocation；它与 invocationId 恢复补丁的“无新调用身份”路径是两条不同接口。

## 竞态审查与修复

非作者审查发现 v1 的授权检查只发生在 await runtime.inspect 之前。实际延迟 Provider.inspect，期间通过正式 runtime.bind 撤销原 session 后，v1 仍向模型交付 ok 和回执；toctou-red.log 保存同一拒绝断言失败。v2 在 await 后重验原 scope，并把模型投影合并到同一已授权响应，相关竞态及原业务回归全部通过。

真实 session 撤销用例中，Provider execute=1、Provider inspect=1、operation 真实状态仍为 succeeded，模型只收到 CONNECTION_NOT_BOUND，绝无 owner 回执。configRevision/connection 禁用压力用例明确是隔离持久化故障注入；正常 updateConnection API 本来就对未决 operation 拒绝 OPERATION_UNRESOLVED，亦另有测试，不能把注入描述为正常接口可绕过生命周期守卫。descriptor 移除/同版本变化也采用受控 registry 读接口注入。

授权边界是服务端最终授权快照及同步序列化时刻。已经在该时刻获准并发送的响应，无法在之后的网络传输或宿主显示期间被追溯撤回；本补丁不宣称持续读取授权或撤销已交付快照。新实现消除的是原来 result 返回后、Host 另发 projection 请求的异步空隙。

## 对照数据

统计仅包含额外的跨会话回查工具调用，不包含 fixture 初始唯一变更；payload 为 UTF-8 body，不含 headers/URL。

|场景|版本|结果|HTTP数|请求字节|响应字节|模型字节|总invocation数|
|---|---|---|---:|---:|---:|---:|---:|
|另一已绑定会话|baseline|错误放行 ok|3|57|765|239|2|
|另一已绑定会话|patched|OPERATION_NOT_FOUND|2|35|390|184|1|
|另一未绑定会话|baseline|错误放行 ok|3|57|765|239|2|
|另一未绑定会话|patched|OPERATION_NOT_FOUND|2|37|390|184|1|

四条轨迹都只有原来的 1 次业务 Provider execute、0 次 Provider inspect、1 条 operation。补丁拒绝后的原 invocation/operation/event 账本字节内容保持一致。

## 验证与范围

- 最终 20/20 新安全、兼容与竞态用例通过：两类外会话、合法 owner settled/pending、撤销绑定、配置变化、伪造 session、特权 SDK 保持兼容、缺少 scoped transport、非披露式 not-found、operation owner 损坏、检查期间撤权/漂移、scope 重核与没有后续 projection 请求。
- 最终联合回归 59/59（20新 + 39旧），以 final-tests.log 为准；39/39 既有回归包括：business-inspect-projection 1 项、transport-error-contract 38 项。
- tsc --noEmit 通过；diff-check 通过。
- 两个相同拒绝断言在原版确定性 red；baseline 观察模式仅用于确认确实返回 owner 回执。
- 全部测试、typecheck 均用 `flock /tmp/hallmark-c72-cpu.lock` 包住整命令。
- 以上是独立补丁阶段验证；最终全仓与发布状态见 [组合门禁](candidate72-integration-gate.zh-CN.md)。未做实际桌面/店铺、真实模型或部署验收。

## 交付与复跑

测试与精确来源：`test/apps-host/operation-owner.test.ts`（20 项）、`test/apps-host/invocation-recovery-boundaries.test.ts`（非作者 2 项直接 HTTP 边界）。实际初期跨会话轨迹：[基线](candidate72-toolchain-evidence/operation-baseline.json)、[修复](candidate72-toolchain-evidence/operation-patched.json)。表格为初期 owner 补丁；最终 v2 还覆盖后置授权与配对 projection。

```sh
flock /tmp/hallmark-c72-cpu.lock node --test test/apps-host/operation-owner.test.ts test/apps-host/invocation-recovery-boundaries.test.ts
```

在纯 candidate72 独立树复制同一 operation-owner 测试，设 `APPS_OPERATION_OWNER_BASELINE=1` 可记录旧版错误放行；不设变量运行跨会话拒绝断言应 red。历史本地日志名只标记补丁阶段，不作为未附公开材料。
