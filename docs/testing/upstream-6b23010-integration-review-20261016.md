# 上游 6b23010 测试改写融合审查

发布身份：实际测试的本地候选为 `f7ffe7b398e7e1c680850515774fd41081e8be1c`；公开等内容合并提交为 `cacd1ff9a2150cd5d6d7382c372d6050b07e304e`。两者父提交相同、Git tree 均为 `9959dfc7f6ca209dbc8d43d67873de4d67f5549a`，只因提交元数据不同而SHA不同。运行记录保留实际身份，复现使用公开提交。报告随后单独添加，不属于被测输入。本地证据路径不随报告发布，不是公开下载链接。

本地验证候选：`f7ffe7b398e7e1c680850515774fd41081e8be1c`。
Tree：`9959dfc7f6ca209dbc8d43d67873de4d67f5549a`。
Parents 按序：`787cdb9c22b3c9c81ad26dc3e306bd9f342cc296`、`6b23010e0d4fe1aed458d2c49ed6c5fdb4792718`。
共同基线：`bd23131b1b1cfd7b6db5a7c1c6e69b9eb7d05422`。

## 上游变化与最小选择

bd23131→6b23010 仅新增一个提交、两份测试改动和一份独立报告，没有生产、依赖、锁、脚本、工作流或测试发现范围变化。两份测试与 ours 同时改动，产生两个冲突；均按批准方案完整采用上游 blob。

- #72：首次 warnings 从整数组相等改为包含固定上游警告，继续独立保护该警告，并允许合法新增说明；原 hit-vs-first 深等值和缓存行为断言不变。
- #73：调用生产前从冻结输入投影 id/title/source 作为预期，client 为各连接返回 structuredClone；切断测试预期被返回对象污染的路径。c→d→c、读源顺序 [c,d] 和原持久缓存/失败保留断言不变。说明明确只测 c 的重复命中，不声称 d 重复命中或 revision 切换。
- #64 follow-up 的行为覆盖下删除 snapshot source guards、#74 的提前冻结 raw 快照预期，仍逐 blob 保留 ours。

## 精确边界

ours 原有 1364 个已跟踪路径中，除以上两测试外，其余 1362 个路径的模式和 blob 全部不变。另新增上游 `docs/test-issue-review-72-73-20261016.md`。已有 docs/testing 独立报告全部保留。

生产 packages、scripts、package.json、pnpm-lock.yaml 与上游和 ours 都相同。test-scope.json、测试入口和其余测试未改。git diff --check 通过，候选工作树干净。

## 验证边界

本次只做精确抓取、代码/报告阅读、三方冲突审查、对象核对及本地融合，没有执行测试、构建或推送。已有测试结果保留原输入身份，不能替代此候选。两份改写测试的合法额外 warning、丢失 warning、连接 key 碰撞与预期抗污染检查，以及包含 #64 follow-up/#74 的双版本最终全量，由其他验证任务执行。

上游报告保留 Node24 provider association 的 unknown/on_sale 既有间歇失败：在旧基线和恢复输入均观察到；此处未修改该断言、fixture 或生产逻辑，不宣称已修复。

## 文件身份

- `test/app-hallmark/compose-cache-regression.test.ts`：blob `f7bb6f60fda4eafce685d185270be43b77d423b9`；SHA-256 `9f55655d3e2c0091c5ab2d91cd1c8108b4a7802cece154be0543cfd925903519`。
- `test/app-hallmark/provider.test.ts`：blob `8bc0147e4e51f941301d7910c407682f0f506e36`；SHA-256 `960c2f125f78419f9471d376a927d147553e76f4620820bc0f083e5e35db99ae`。
- `docs/test-issue-review-72-73-20261016.md`：blob `5d8ab87c424ccf1b550f576797ad113451552028`；SHA-256 `7ea43a8505f82af178ceab007c13aa23bfbf6ae6decad1ca304e5d00e2b7cad1`。
