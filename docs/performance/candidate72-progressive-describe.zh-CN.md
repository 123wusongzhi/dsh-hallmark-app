# [candidate.72] 修复 Agent 读取组件诊断 Schema 的死路，并按需交付完整工具契约

## 结论

candidate.72 的 `apps.authoring.inspect` 精确能力说明实际为 **19,842 UTF-8 字节**，超过 Host 统一 **16,384 字节**模型输出上限。`apps_describe` 执行后，`output.render` 把整个说明（包括构造调用必需的输入 Schema）替换为 `RESULT_SPILL_FAILED`。错误建议缩小分页，但原 `apps_describe` 没有分页/路径参数，Agent 无法照提示继续。

本修复采用自适应渐进说明：小契约保持旧完整返回；对确有字节收益的大契约，先给**完整输入约束和执行/幂等元数据**，明确输出 Schema 延后，并提供可直接执行的精确只读续读参数。完整契约没有删除约束，输出及超大输入都能无损恢复。

## 精确基线与范围

- 仓库：`123wusongzhi/dsh-hallmark-app`
- 注解标签：`v1.0.0-candidate.72`
- 标签对象：`52d12f7ee593fe04944c63b5d01fb0e924a6eee5`
- 执行提交：`4e1cd98082a432e2ca89f606927da29eb26ddb67`
- tree：`fc82c44d9aae05812173b03e2f107b9b51612c96`
- 仅云端隔离目录、真实仓库 Host/Runtime 与合成 authoring 草稿。没有真实店铺、平台凭据、付费服务或外部 LLM 请求。
- 这是确定性工具协议/任务轨迹验证，不是部署中的真实模型成功率评测。

## 复现步骤

1. 构造真实 `composeAppsRuntime` 隔离实例，注册真实 `AppsHost` 四个网关。
2. 从真实目录发现91项能力。
3. 对每项调用注册的 `apps_describe.execute`，再调用它的 `output.render`，检测实际到达模型的文本，而不只检查内部 JS 返回值。
4. 对 `apps.authoring.inspect@1.0.0`，内部响应19,842字节，最终模型文本只有150字节的失败消息，`inputSchema` 不存在。
5. 合成任务轨迹先通过真实 `apps_invoke` 创建隔离草稿，再发现 inspect 的 Schema。基线在第二步被堵住，未伪造第三步输入或绕过工具读取源码。

## 修复后的可执行轨迹

同一隔离任务：

1. `apps_invoke(apps.authoring.begin)` 建立真实草稿/attempt。
2. `apps_describe(apps.authoring.inspect)` 返回1,726字节有效说明；保留完整互斥输入 Schema。
3. 用该 Schema 验证 `{attemptId}` 后调用真实 `apps_invoke(apps.authoring.inspect)`，成功返回现有 `summary.nextAction`、阻塞阶段和 `requiresRebuild`。

基线：2次工具调用后失败。修复：3次工具调用完成诊断。这里**不是宣称调用数减少**，而是在严格依赖工具返回精确 Schema 的确定性测试中，原来不能完成的合法链路变为可完成；增加的第三次调用是实际诊断工作，不是重试。原版 native agent 在一个盲测中猜出合法参数并完成；修复版反而多一次读取。参见 [A/B 正负盲测](candidate72-native-agent-evaluation.zh-CN.md)。

## 上下文/字节对照

所有数字均为实际 `output.render` 文本 UTF-8 字节，未使用未公开 tokenizer；不能当作精确 token 数。

| 测试对象 | 基线 | 修复 | 解释 |
|---|---:|---:|---|
| inspect 描述 | 150（失败消息；内部19,842） | 1,726（有效完整输入） | 不拿150字节错误当正常压缩基准 |
| begin 描述（含合成路径 guidance） | 16,356 | 12,372 | 完整输入与 guidance 保留 |
| record_build 描述 | 5,169 | 1,816 | 输出 Schema 按需 |
| record_preview 描述 | 6,651 | 1,892 | 输出 Schema 按需 |
| publish 描述 | 3,116 | 1,912 | 输出 Schema 按需 |
| list_saved 描述 | 8,454 | 1,384 | 输出 Schema 按需 |
| ozon.compose 描述 | 11,298 | 4,256 | 仅发现描述，没有真实业务执行 |
| products.list 描述 | 2,538 | 2,538 | 小契约保留旧路径 |
| plan.get 描述 | 1,212 | 1,212 | 小契约保留旧路径 |
| 91项目录全描述的模型文本合计 | 238,589 | 166,891 | 约减少30.05%，是目录总量，不是某次真实用户任务token |

91项中，36项字节减少、54项逐字节同长度；唯一字节增加的是原来只有失败消息的 inspect，现变成可用输入契约。91项默认读取全部保留可用完整输入。单项输出仍经过统一16KB渲染上限；分页内部预算14KB，为封装留余量。

五个 authoring 阶段（begin、record_build、record_preview、publish、save_component）的**发现描述集合**33,053→19,753字节，约减少40.24%。这是 schema discovery 集合，不声称已执行完整 build/preview/保存业务流程。

## 功能/协议变化

- `apps_describe` 新增 `view`、`path`、`cursor`、`limit`、`descriptorDigest`。
- 默认自适应：完整契约比渐进封装更小且不超预算时，返回原 `{status, descriptor, authoringGuidance?}`；否则完整输入/执行元数据优先，`schemaCompleteness.output='deferred'` 明确说明输出 Schema 尚未读取。
- 返回 `outputSchemaRead` / `fullDescriptorRead`，包含工具名和合法参数；Agent 不必猜 JSON Pointer 或版本。
- `view='full'` 对精确子树返回完整 `value`；过大容器返回可枚举目录；长字符串按 Unicode code point 续读。
- 超长属性名导致子路径超过4000字符或单目录项超过字节预算时，留在当前合法短路径，以 `kind='serialized-json'`、`encoding='json'` 分页交付完整 JSON。拼接后 `JSON.parse` 恢复原值，不删除属性。
- `descriptorDigest` 对实际完整 descriptor+guidance 根进行 SHA-256 身份绑定。相同版本内容/guidance/session变化则拒绝混页；无关目录变化不打断相同内容读取。该设计不新增每次describe的网络往返，也不把可能过时的握手目录摘要冒作内容身份。
- 没有修改 Runtime 的能力输入/输出校验、业务授权、明确保存、幂等、unknown 不重发规则或底层 Schema。
- 需要完整大输出 Schema 的调用者会多做显式只读续读；这是透明取舍，不能把输入优先说成“所有任务调用次数都更少”。

## 校验与证据

- `test/acceptance/toolchain-c72/describe-sweep.mjs`：基线/修复91项真实注册工具扫描。
- `test/acceptance/toolchain-c72/authoring-trajectory.mjs`：实际 begin→describe→inspect 确定性任务。
- `test/apps-host/descriptor-reader.test.ts`：输入互斥/禁止额外字段、精确output重组、小契约旧路径、Unicode/转义、合法超长key、内容身份变化。
- `test/acceptance/toolchain-c72/review-descriptor-pages.mjs`：独立注册工具级无损重组与边界复核。
- `test/acceptance/toolchain-c72/scan-page-budget.mjs`：中文长key预算边界扫描，防止“首段可读、下一页死路”。
- 最终回归与独立复核数字以末尾验收记录为准；不把重复套件计数相加。

## 运行

在已安装依赖的candidate72源码中：

```sh
node test/acceptance/toolchain-c72/describe-sweep.mjs /path/to/baseline /path/to/baseline.json
node test/acceptance/toolchain-c72/describe-sweep.mjs /path/to/patched /path/to/patched.json
node test/acceptance/toolchain-c72/authoring-trajectory.mjs /path/to/baseline /path/to/baseline-flow.json
node test/acceptance/toolchain-c72/authoring-trajectory.mjs /path/to/patched /path/to/patched-flow.json
node --test test/apps-host/*.test.ts test/apps-runtime/sdk-cancellation.test.ts test/apps-runtime/result-reader.test.ts
node_modules/.bin/tsc --noEmit
```

修复文件：`packages/plugin-apps/src/descriptor-reader.ts`、`packages/plugin-apps/src/index.ts`；回归：`test/apps-host/descriptor-reader.test.ts`。

## 限制

没有执行外部模型、真实DSH部署/GUI或真实店铺变更；不宣称真实LLM成功率、精确token节省或端到端生产时延改善。短功能运行有观测耗时，但未把单次毫秒数当性能基准。完整包构建/全仓门禁在统一集成分支另行执行。

## 最终独立验收

- 独立协议复核 **11/11组通过**：91份能力的默认输入、effect、execution、version精确保留；其中54份短描述保留旧完整响应，37份使用渐进返回。
- 91份真实能力的完整 output Schema 经 **105次实际注册工具读取**全部无损重组；不是只测输入或跳过render。
- 超预算输入默认返回明确可执行目录，未谎称输入完整；`required` / `allOf` / `oneOf` / `enum` 等兄弟约束与数组顺序均可恢复。
- 长Unicode、转义own-property、空key、ASCII4100字符key、中文3900字符key均可恢复；继承属性与非法Pointer拒绝。
- descriptor/guidance内容哈希覆盖原会话；跨会话guidance、同版本内容改变不能拼页；握手摘要/describe竞态不再冒用旧目录身份。
- 中文key长度1900–2349的 **450点边界扫描0失败**。独立review曾在中间prototype找到54个边界失败，最终修复完整envelope预算与游标无关的fallback判断；保留中间失败证据，没有覆盖旧失败记录。
- 所有独立调用均经过真实 `tool.execute` 与 `tool.output.render`，每条模型回复≤16,384字节。
- 去重后的Host/transport/cancellation/result-reader相关套件 **81/81通过**，TypeScript检查通过。后续统一集成含原invocation恢复补丁的联合门禁另列。

独立结果文件：`candidate72-toolchain-evidence/c72-page-review-final.json`、`candidate72-toolchain-evidence/c72-budget-scan-final.json`。基线与修复扫描：`candidate72-toolchain-evidence/c72-describe-baseline.json`、`candidate72-toolchain-evidence/c72-describe-patched.json`；合法任务轨迹：`candidate72-toolchain-evidence/c72-authoring-baseline.json`、`candidate72-toolchain-evidence/c72-authoring-patched.json`。


仓库内复跑说明见 [工具链验收README](../../test/acceptance/toolchain-c72/README.md)。结果 JSON 已收录于 candidate72-toolchain-evidence；云端绝对路径统一替换为 <cloud-workspace>。统一构建/全仓结果见 [组合门禁](candidate72-integration-gate.zh-CN.md)。
