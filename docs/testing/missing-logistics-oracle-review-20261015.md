# 缺失物流费用 unknown 断言：独立复核

结论：PASS。建议接受仅测试候选 `9c5329fa883a5e8748ac1e03c9d06c701694a1b6`。当前生产返回正确的 null；本项是防回归测试缺口，不是已发生的线上错费。

## 独立输入

- 新建隔离 clone，精确基线 `cc15343411cfa24c4af5af69a9334c8ed2259889`，tree `32d605918596cecb1c68952898c6834025b1b851`。
- `git ls-tree -r` 与 `git ls-files` 均 1352 项，其中 packages 272 项，没有筛选排除。候选父提交为该基线。
- 读取 README、CONTEXT.md、真实测试数据说明；仅离线 prepare，从现有依赖加载；没有调用真实接口、业务操作、部署、push 或建 issue。
- 作者提供的三个复现脚本已审读并在独立目录实际重新执行；另外编写并执行 `review-extra.py` 和 `finalize-review.py`，没有引用作者的旧运行结果作为本次通过依据。

## 核验结果

| 运行时 | 原生产/旧测试 | 错接佣金/旧测试 | 错接佣金/新断言 | 恢复生产/新断言 |
|---|---:|---:|---:|---:|
| Node 22.18.0 | 183/0 | 183/0 | 182/1 | 183/0 |
| Node 24.19.0 | 183/0 | 183/0 | 182/1 | 183/0 |

表格是 pass/fail。每格同15文件，无名称过滤；skip、cancel、todo 全0。唯一失败是原 financial case，`ERR_ASSERTION / strictEqual / actual -28.08 / expected null`。

- 两版本均 prepare 成功；恢复生产且保留新断言时，真实数据审计 PASS（308 testFiles、20/20/1来源、0 failures），`tsc --noEmit` exit0。
- 双版本默认 `readOzonComposition`，不注入 normalized reader：物流费 `null → -28.08 → null`；amount 161.92、commission -28.08、currency RUB 不变；仍标注“物流费用”。每次在内存 client 中只处理 finance、orders 两条路径。
- 搜索整个基线 `test/`，没有 `logisticsFee` 或 `logistics_fee` 字样。现有 composer 财务聚合测试使用自定义 reader，绕过原始财务映射。
- 搜索发现的额外 `source-reuse.test.ts` 是 recipe/组件缓存控制；双版本原生产、变异旧测试各7/7通过，共4轮，未捕获本变异。
- 公开 finance schema 明确字段是 required `number|null`，说明为“平台明确列出的物流费用，未提供时显示未知”；既有 fixture 未给 logistics_fee。因此新增 literal null 来自契约，没有调用 producer helper、复制映射或反算预期。
- 候选与父提交只差原 case 一条 `assert.equal(result.items[0].logisticsFee,null);`。没有改 fixture、生产逻辑、其他断言、测试数量、依赖或公开快照。

## 恢复与边界

所有阶段结束后，1352个 tracked 输入 SHA-256 都与最初独立基线相同，含272个 packages 文件；工作树干净。生产文件 SHA-256：`d3e6fc267f7ba844b2d7bf9ead919e82d87df9153ae834f72b636f371a779b48`。原测试：`4de485dfbd7bde9acc42c53c9e9de95b321194eec77ecb3541fbc5b5e8b259c8`；候选测试：`92ef478876ccd2e697a9eeec1091a16c7620d0c495f55087c061cb797841dffd`。

未跑 full、benchmark 或任何线上验收，不把局部测试扩大为全仓通过。变异仅证明缺少独立断言时，错误可穿过真实默认组合链路进入费用结果；不能据此声称当前发生收费、扣款或利润错误。

## 交付材料

下列为本地归档文件索引，未随报告发布；完整自足复现脚本见[问题 #70](https://github.com/123wusongzhi/dsh-hallmark-app/issues/70)。

- `ISSUE.md`：可独立阅读的中文 issue，完整 patch、全部5个实跑脚本与可复制命令。
- `node22/`、`node24/`：四态TAP、审计/类型检查输出、1352项前后清单、summary。
- `compose-node22/`、`compose-node24/`：默认 composer 三态值证据。
- `extra/`：契约/补丁检查和额外邻接测试日志。
- `final-state.json`：独立最终验收、候选父子关系与字节验证。
- `SHA256SUMS`：本目录全部交付文件的校验清单。
