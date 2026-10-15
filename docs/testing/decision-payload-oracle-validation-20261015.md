# 视觉 Decisions 请求上下文：独立复核通过

日期：2026-10-15。冻结公开基线：`6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d`。候选：`c603f4f52159f67eb9b040c5e0c295359f5eb119`，只改 `test/decisions/decision-review.test.ts`（+11/-4），没有新增测试或生产修改。

## 结论

通过，可以合入这项测试补强。证实的是旧测试漏检，不是当前生产已经丢失草稿。独立新建隔离 checkout，从公开基线应用完整补丁；未修改作者工作树，也未借用其他基线的全量结果作为候选验证。

两版 Node 均独立得到以下四态：

| 状态 | Node 22.18.0 | Node 24.19.0 |
|---|---:|---:|
| 原生产 + 旧测试 | 20/20 | 20/20 |
| 真实序列化删除 `draft` + 旧测试 | 20/20 | 20/20 |
| 同一生产变异 + 新测试 | 19 通过 / 1 失败 | 19 通过 / 1 失败 |
| 恢复生产 + 新测试 | 20/20 | 20/20 |

唯一失败是原有 `a host-provided verified image protocol sends image parts rather than a text URL`，在新增上下文深比较处精确报告缺少 `draft`。已分别实跑作者原脚本与内嵌完整补丁的自足脚本；另外从未应用候选的公开原测试再跑自足脚本，四态一致，退出后原测试字节也恢复。

## 路径、预期与错误归因

- 真正调用 `createDecisionReviewer → createDecisionImageProtocol.buildState → fetchImpl`。只替换网络边界，捕获实际 `POST` 的 JSON body；没有 mock 待测序列化或自行拼装 actual。
- 预期 `source` 来自调用者输入对象；草稿、版本及图片角色使用测试输入中明确给定的值。没有从 image protocol 输出反推 expected。语料的 `realCollection()` 正常映射不影响此次对独立序列化边界的验证。
- [语义审核请求类型](https://github.com/123wusongzhi/dsh-hallmark-app/blob/6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d/packages/app-contracts/src/business-review.ts)和[上品审核调用者](https://github.com/123wusongzhi/dsh-hallmark-app/blob/6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d/packages/app-hallmark/src/operations-adapter.ts)表明视觉请求也会比较草稿标题/属性与来源证据。丢失已提供的草稿会失去审核对象。
- 真正漏洞是旧断言只验证 `typeof state[0] === 'string'`。旧 fetch 内断言若抛错，会被 reviewer 转成 pending，但旧用例还有 `result.status === 'passed'`，因此不能声称这些断言必然被吞成假绿。移到 `review` 之后，使错误直接定位到传输契约，不是本次假绿的唯一成因。
- 图片标签位置、图片项位置、完整 data URL、成功状态和协议名称检查均保留。另在两版 Node 实跑省略 source、省略 versions、交换标签/图片顺序、损坏图片 URL、改协议名五种变异，均只在该目标用例精确失败；生产恢复后 Decisions 20/20。

## 可空和可选字段边界

`source` / `draft` 类型为 `unknown`，没有因此新增非空约束；`versions.policy` 可省略。两版 Node 的独立七项探针均通过：null、空对象、primitive、undefined 输入；未提供 policy；空 source/draft 版本或显式空 policy 被现有校验拒绝。undefined 按当前 JSON 语义省略字段。

候选只断言本例已经提供的值保持完整。版本及图片 metadata 的比较保护当前项目上下文封装，不宣称它们是 OpenRouter 接口强制参数，不将 policy 升为必填，也不把未知类型收窄为 fixture 的对象形状。以后有意改变上下文 envelope 时应同步评审该断言。

## 其他独立验证

- 两版 Node：`node --test --test-reporter=tap --test-concurrency=1 test/decisions/*.test.ts test/operations/business-operations.test.ts test/operations-adapter/adapter.test.ts`，各 90/90。
- `node scripts/audit-real-test-data.mjs`：PASS，308 个测试文件；随后 `node node_modules/typescript/bin/tsc --noEmit`：exit 0。
- `git diff --check`：通过。
- 422 个受跟踪 packages/scripts 文件逐一 SHA-256 对照冻结基线全部一致；其他 1332 个受跟踪文件也无 Git 差异。唯一修改仍是候选测试。
- 未跑全仓、未调用真实模型或商城、未安装部署、未 push 或创建 issue。

## 可复现交付

[问题 #63](https://github.com/123wusongzhi/dsh-hallmark-app/issues/63) 自足包含完整 patch 与已执行的完整 Python 脚本，不依赖本地候选提交或未公开 evidence 文件。保存脚本后对公开基线独立 checkout 执行即可；脚本在 finally 中恢复传入的生产与测试字节。

- 自足脚本 SHA-256：`ec8ccd9079f53cfbbfef088eb5264119358309ceed0b45ba15b7596a7af6c1a0`
- 补丁 SHA-256：`90fac977dd5f8e5a1406f9875f341bc53be59879a627ea1ae5c472fa8b32fce4`
- 候选测试 SHA-256：`8b9257baeb252fc27767773c1aba16da5e910295c9b087c80a1dde1841dfd402`
- 恢复后生产序列化 SHA-256：`ff9fc1e9f16dfe27f71c7e91a2b09ff77dc74685559c2b4771b7fd4ab2ad510a`
