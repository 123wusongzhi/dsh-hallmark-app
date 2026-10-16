# raw snapshot clone oracle 独立复核

结论：通过，可作为测试质量缺口提交 root review。本报告不主张现存生产删字段 bug；临时单点 mutation 证明既有共享 expected 会假绿，候选在调用前 structuredClone 独立保留原字段内容。不增加返回值身份约束。

基线：`457824a7813e58d811528bce2f0fd5667d8a1240`。候选：作者本地 test-only commit `04caaabbde49787b85225adf5e85aee44fa14f66`（未 push）。

| 实际阶段 | Node 22.18.0 | Node 24.19.0 | Node 24.21.0 |
|---|---|---|---|
| 原测试/原生产 | 233 pass / 0 fail | 233 pass / 0 fail | 233 pass / 0 fail |
| 原测试/同一生产故障 | 233 pass / 0 fail | 233 pass / 0 fail | 233 pass / 0 fail |
| 增强原用例/同一故障（仅精确用例） | 0 pass / 1 fail | 0 pass / 1 fail | 0 pass / 1 fail |
| 增强相关 suite/同一故障 | 232 pass / 1 fail | 232 pass / 1 fail | 232 pass / 1 fail |
| 增强相关 suite/恢复原生产 | 233 pass / 0 fail | 233 pass / 0 fail | 233 pass / 0 fail |
| 数据审计 | exit 0 | exit 0 | exit 0 |
| tsc --noEmit | exit 0 | exit 0 | exit 0 |

每版本独立完整 7 stages，相关集16 files/233 cases，全部 cancelled=0/skipped=0。唯一失败名字保持原用例，完整 expected/actual 除 `unknownSourceField: {foo:'preserved'}` 缺失外完全一致。保留原 fixture、用例总数与其余三个断言。

最终 1363 tracked 文件逐字节核验：仅 `test/core/core.test.ts` 改动；全部 production、fixture 与冻结语料恢复/不变；git diff --check 通过。mutant `683c4849ef3697fb38508590e35722bb272c3ac7272cd0bc4c5d93d31d54ad0a` 在全部旧/新故障阶段相同，恢复源 `7a7d8d25746e0b539b7c9003fc65ca0bc8cc71dc39432a8adce6290c14656014`。候选 patch 与作者冻结字节相同。

实际版本是三个现有 binary：
- `v22.18.0`：`/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`；binary SHA-256 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。
- `v24.19.0`：`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node`；binary SHA-256 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`。
- `v24.21.0`：`/opt/codex/cua_node/bin/node`；binary SHA-256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`。

额外原 fixture 诊断三版本均观测 actual===source；mutation 时源和返回值同步丢字段，但 before-call clone 不变。合法同引用继续通过，candidate 不含 identity assertion。

证据（以下为本地索引，未随报告发布；完整自足复现见[问题 #74](https://github.com/123wusongzhi/dsh-hallmark-app/issues/74)）：
- `ISSUE.md`：中文自足 issue，含完整 candidate/mutation patch 与全部三个脚本
- `verified-run/summary.json`：21-stage 原 driver 结果及全部日志 hash
- `verified-run/independent-state-checks.json`：每阶段源码/binary hash、精确失败 case/差异、全部 tracked 末态
- `reference-diagnostics/reference-observations.json`：六次引用实际观测
- `run/`：原样冻结 driver 首次独立 22.18/24.21 全矩阵（14 stages），也已通过

限制：仅上述相关 suite、全仓类型及数据接入审计；未做全仓测试或性能基准。未安装/更换 runtime，未写真实业务，未 push/issue。
