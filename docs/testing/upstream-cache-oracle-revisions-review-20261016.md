# 上游 #72/#73 测试改写独立验证

发布身份：实际测试的本地候选为 `f7ffe7b398e7e1c680850515774fd41081e8be1c`；公开等内容合并提交为 `cacd1ff9a2150cd5d6d7382c372d6050b07e304e`。两者父提交相同、Git tree 均为 `9959dfc7f6ca209dbc8d43d67873de4d67f5549a`，只因提交元数据不同而SHA不同。运行记录保留实际身份，复现使用公开提交。报告随后单独添加，不属于被测输入。本地证据路径不随报告发布，不是公开下载链接。

候选：`f7ffe7b398e7e1c680850515774fd41081e8be1c`
Tree：`9959dfc7f6ca209dbc8d43d67873de4d67f5549a`

## 结论

两项改写的精准正负控在 Linux Node 22.18.0 / 24.19.0 均达到预期。保留上游 warnings 包含断言和调用前冻结的 id/title/source 预期；没有恢复旧的整数组严格预期，没有永久生产修改。

## 双版本恢复后相关回归

| 范围 | Node 22.18.0 | Node 24.19.0 |
|---|---|---|
| 原 warnings 缓存测试 | 1 pass / 0 fail / 1 total，0.323 秒 | 1 pass / 0 fail / 1 total，0.38 秒 |
| 原连接 namespace 用例 | 1 pass / 0 fail / 1 total，0.842 秒 | 1 pass / 0 fail / 1 total，0.806 秒 |
| 40 文件相关并集 | 530 pass / 0 fail / 530 total，35.497 秒 | 530 pass / 0 fail / 530 total，32.994 秒 |

并集覆盖此前 warning 429 项和 Provider 450 项验证的全部文件，去重后按当前候选实际发现 530 项；明确文件清单位于 identity.json。所有测试运行均 0 skip/cancel/todo，audit 和 tsc --noEmit 两版本均通过。

本次相关并集未出现此前报告过的 association unknown/on_sale 间歇失败；单次通过不表示那个独立问题已经修复。

## warnings：允许扩展，仍保护原警告

- 临时在实际 production checkpoint 的 sourceWarnings 后增加 additional legitimate warning，两个版本原测试各 1/1；first 与 cache hit 完整 warnings 相等断言仍保留。
- 仅把实际 checkpoint 的 warnings 改为空，两个版本均原用例精准 ERR_ASSERTION，提示 first response must retain the upstream warning。
- 不改 items、状态、时间、原 fixture 输入或冻结 corpus。全部生产变异已恢复。

## Provider：跨连接结果与调用前预期

- 仅将 collection 服务 key 从 canonicalJson([connectionId,revision]) 改为 [revision]，两个版本均原 namespace 用例精准在 d 的深比较失败；正常 c 请求仍通过。
- 透明 probe 从准确候选提取 fixture，execute 包装只记录并转调原实现，读取真实 services/indexCache：正常和恢复为 context c/d/c、返回 c/d/c、sourceReads=[c,d]、2 个服务；key 故障为 context c/d/c、返回 c/c/c、sourceReads=[c]、1 个服务。revision 全为 1，session 全为 s。
- 原测试的 c/d/c 顺序与 reads=[c,d] 断言实际通过，证明第三次 c 复用自己的缓存。没有第二次 d 请求，不外推 d 的第二次命中或 revision 切换。

## 输入原地变化不会污染 expected

- 临时在真实 CollectionService.index 收到 rows 后就地改 title。保持最终测试原字节，两个版本均精准在 c 的身份/内容预期失败。
- 透明探针确认最终 fixture 的 clone 使原始输入没有被该变异改动，调用前 expected 同样不变。
- 再临时只移除 fixture clone 保留调用前 expected：两个版本仍精准在 c 失败；探针确认原输入确实已就地改变，而 expected 仍等于调用前的值。
- 明确反向对照：保留同一原地变异、无 clone，再把预期改回读取当前 collectionRows，两个版本均假绿。这说明调用前预期独立性有实际检出价值。该对照的测试修改已恢复。
- 新增 clone 是测试数据边界；以上不代表生产增加了隔离或防拷贝能力，不声称已验证磁盘隔离或真实平台。

## 可复现性与恢复

- 共 38 个实际 subprocess 运行，8 个目标负控均预期精准红；无加载错误、runner 超时或取消伪红。
- 全部 1365 个跟踪文件 SHA-256 恢复一致，git tracked diff 为空。
- 三个临时生产路径为 ozon-compose.ts、app-hallmark/index.ts、collection/index.ts；两个测试文件也恢复为候选的原始 Buffer。
- validate.py 使用共享 Git 对象的独立 worktree、已有依赖及既有官方 Node22 可执行文件。所有变异在 finally 恢复。
- runs.json 记录准确命令、Node、UTC 时间、耗时、TAP 统计、变更字节哈希与日志 SHA。identity.json 固定候选/运行时与相关集合；tracked-before.json、restoration.json 证明恢复；probe-results.json 汇总真实探针输出。
- 没有下载、重新安装、clone/archive 大副本、商家/模型调用、push 或 issue 操作。

## 范围限制

这是针对两个上游测试调整的独立 Linux 离线/本机回环验证，未运行全仓，未做真实平台或桌面验收。全量由另一个验证任务负责。
