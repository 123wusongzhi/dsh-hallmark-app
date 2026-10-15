# 上游 #50 与长 POST 读取错误回归整合

整合父提交：`043ab318b64e4ec8affbd75d232c7e1d7d8598d1` 与 `2b9f7a173605a31a3098cb92f881b5bf314eca9c`。本批仅测试、分类和报告，无生产或冻结数据改动。下述定向验证绑定 Git 输入树 `0299b0637c76fe792443879f20eb4831db89c9b8`；验证后只新增本报告。

## 合并取舍与保留检查

- #50 测试采用上游全文：保留原监听、取消传播、阶段界限和清理 harness；采用上游 30 秒总界限、针对 `logisticsSku` 的精确缺失守卫，以及先验证源属性均为字符串、再直接 clone 原属性的独立预期。没有调用生产规范化函数生成 oracle。上游 [#50 报告](../test-issue-review-50-20261016.md) 与既有 [#50 整合报告](collection-column-fidelity-20261015.md) 都保留。
- scope 的 #50 required 条目仍仅一次，加入上游完整 fileModes 说明。既有 #49 的加强版 infrastructure reason 原字节保留；没有被上游历史较短说明覆盖。required/infrastructure 列表均无重复。
- 新增 [#52](https://github.com/123wusongzhi/dsh-hallmark-app/issues/52) 长 POST 错误透传测试、两项基础设施分类和 [完整候选及独立复核报告](result-read-error-parity-20261015.md)。获准候选补丁 SHA-256 为 `2a292584be7acf5850f501e61f9c6cfb0da83bd177bc26fb2e7edb2782723e12`；新测试与报告同审核候选逐字一致。scope 因 #50 新说明导致上下文变化，按语义只加入新路径和 reason。
- 第一父的 1314 个文件无缺失；1312 个逐字一致，仅 #50 测试和 scope 有上述预期差异。其 321 个 `docs/` 文件全部逐字保留，包括上一批 full 报告。
- 第二父的 1297 个文件无缺失；1284 个逐字一致。13 个差异均为测试或 scope：第一父已有的 12 个加强测试和分类。第二父的 304 个 `docs/` 文件全部逐字保留，#50 新测试与第二父完全相同。
- 对两个父提交，生产代码、组件、模板、脚本、依赖清单/锁文件和冻结语料均无差异。原有断言、默认串行入口与 skip 条件未改。

第二父的 12 个既有测试差异为 `business-partial-status`、`business-value-projection`、`explicit-intent-retry`、`inspection-race`、`rate-limit-recovery`、`failed-build-http-recovery`、`result-reader-runtime`、`order-weights`、`native-workspace`、`snapshot-refresh-lifecycle`、`selection-bulk-chain`、`selection-retry-chain`，均来自第一父，未被这次合并重写。

## 最终输入定向验证

Linux、Node `v24.19.0`，复用已安装依赖；没有重新安装。依赖软链仅供本地验证，没有纳入 Git 索引。所有测试使用 `node --test --test-concurrency=1 --test-reporter=tap`。

- 两个本批测试：2/2 pass。
- 仓库外 cwd、绝对测试路径：2/2 pass，无残留文件。
- #50 的 12 个邻近文件加本测：146/146 pass，13.519 秒。
- 长 POST 的 10 个邻近文件加本测：86/86 pass，8.761 秒。
- 以上每次运行均为 0 fail、0 skip、0 cancelled。146 和 86 两组包含重复文件，不能相加声称独立测试总数。
- `node scripts/audit-real-test-data.mjs`：PASS，308 testFiles、162 requiredFiles、161 infrastructureFiles；分类可重叠。
- `node node_modules/typescript/bin/tsc --noEmit`：通过。
- `git diff --cached --check`：通过。

#50 的 146 项文件清单：

```sh
node --test --test-concurrency=1 \
  test/collection/collection.test.ts \
  test/collection/real-corpus.test.ts \
  test/collection/source-reads.test.ts \
  test/apps-host/collection-continuation-handoff.test.ts \
  test/apps-host/collection-ids-batch.test.ts \
  test/apps-runtime/result-reader.test.ts \
  test/apps-host/result-fields.test.ts \
  test/app-hallmark/listing-detail-recovery.test.ts \
  test/app-hallmark/listing-reuse-hint.test.ts \
  test/operations-adapter/procurement-feedback.test.ts \
  test/plugin-client/table-format.test.ts \
  test/plugin-client/native-materials.test.ts \
  test/apps-host/collection-column-fidelity.test.ts
```

长 POST 的 86 项清单与 [独立复核报告的复跑命令](result-read-error-parity-20261015.md#复跑) 完全相同。新测试通过真实 HTTP 400、transport、注册 Host 工具与 renderer，核对长 POST 与短 GET 的错误语义，并在修正输入后继续读取原 retained result。此整合没有重新执行临时生产突变，相关旧 85 原版/突变均绿、新测精确红、恢复 86 绿和三项清理负控制属于报告中绑定的独立复核输入；整合后只验证最终未突变输入。

1317 个测试输入文件前后 SHA 清单一致，汇总 SHA-256 为 `192ea8e75732a8485e43a5aaeac5d8083ee199a72dcbcf35a88c919f895473c7`。146 项日志 SHA-256 为 `1021a4501b03428d6466218a9778af55830a1f60073e0660a2376f5c5f9dc366`；86 项日志为 `d0681d7402cffd0b36b1f34f2c499dcb93c32087572123a2f96586df880ba02c`。所有命令自然结束，没有触发 180 秒期限或 20 MiB 日志上限。

本输入未运行完整 `npm test`，不宣称全仓通过。第一父保留的 [上一批完整回归](full-regression-14558f5-20261015.md) 只属于其精确输入：2261 tests，2221 pass，2 个既有 SQLite 失败，38 skips；不能冒充此新增测试输入的 full 结果。没有合入另行审核中的组件库历史等待候选，没有改 SQLite 生产逻辑，没有真实商家写入、浏览器或 Windows 验收。
