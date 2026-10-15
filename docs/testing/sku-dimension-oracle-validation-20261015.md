# SKU 专属尺寸独立预期补强（2026-10-15）

## 结论与改动

发现的是测试漏检，当前生产实现正确。只在既有 `Alibaba logistics packages and SKU images bind by stable identity, never row order` case 中新增一行 `assert.deepEqual`，断言第二个 SKU 的 `package.dimensionsMm` 为 `{ length: 300, width: 200, height: 100 }`。不新增 case、业务样本或生产改动，不删除服务与 normalizer 的一致性检查，不改冻结数据、身份或权限。

独立复核基线：`606f51842b42d11ead8818e01d24e3833ee9c982`；Node `v24.19.0`。作者基线 `8947e821476bcca376a680b263e4f2da2f775911` 到复核基线间，以下 7 个测试及 `packages`、`scripts`、`component-workspace`、`templates`、`skills`、`bundles` 均无差异。

## 独立预期依据

`test/collection/collection.test.ts` 既有输入按 B、A 排列 SKU；物流条目明确绑定 A，已有长/宽/高标量分别是 30、20、10。`docs/collection-blueprint-v2.md` 的“已确认的包装规则”明确来源尺寸单位 cm、程序统一为 mm。按 1 cm = 10 mm 得到 literal 300、200、100；预期值不调用生产 normalizer，也不从输出或 `realCollection` 回算。

原有第一个 SKU 无专属包装、第二个 SKU 重量 500g、公共包装和 SKU 图片关联等断言全部保留。`test/collection/real-corpus.test.ts` 服务/normalizer 一致性检查仍有集成价值，本次没有删改。

## 独立自然故障矩阵

仅在独立工作树临时将 `packages/collection/src/normalize.ts` 中 SKU 标量分支的 `[p.pkgMeasureLengthSku, p.pkgMeasureWidthSku, p.pkgMeasureHeightSku]` 改为 `[p.pkgMeasureLengthSku, p.pkgMeasureHeightSku, p.pkgMeasureWidthSku]`，模拟相邻字段写反。

| 输入组合 | 实测结果 |
| --- | --- |
| 旧测试 + 正确生产 | 143 pass / 0 fail |
| 旧测试 + Width/Height 互换 | 143 pass / 0 fail |
| 新断言 + Width/Height 互换 | 142 pass / 1 fail |
| 新断言 + 恢复生产 | 143 pass / 0 fail |

四阶段均 0 skipped、0 cancelled。唯一失败正是上述 Alibaba case 的尺寸 `ERR_ASSERTION`：预期宽 200、高 100，实际宽 100、高 200，长度均为 300。无导入失败、超时或其他故障混入。

相关集合：

- `test/collection/collection.test.ts`
- `test/collection/real-corpus.test.ts`
- `test/collection/source-reads.test.ts`
- `test/business-packaging/packaging.test.ts`
- `test/app-hallmark/packaging-evidence.test.ts`
- `test/app-hallmark/listing-prepare-output.test.ts`
- `test/app-hallmark/listing-prepare.test.ts`

统一用 `node --test --test-reporter=tap --test-concurrency=1` 执行这 7 个文件。恢复后 `node scripts/audit-real-test-data.mjs` 为 PASS（308 个测试文件、来源 20/20/1），`node node_modules/typescript/bin/tsc --noEmit` exit 0，`git diff --check` 通过。

## 字节与范围核验

- 482 个生产文件前后 SHA-256 逐项相同。
- 独立复核额外验证全部 1326 个 tracked 文件在实验恢复后均与 `606f518` 基线相同，包含冻结快照；随后仅重新应用已验证的一行测试改动，并新增本说明。
- 最终 `collection.test.ts` SHA-256：`6421f817507b16b4bdbdf7b1cdaebcd05530a60fe71d09994d6554a8e987ff3c`。
- 未改动的 `normalize.ts` SHA-256：`8796b3ff9316b77c134e059e0b3cd6d553ff8fdcf091cba0c8379f7f17608833`。
- 最小测试 patch SHA-256：`c0371ff0843f08789ac0cacae4f2f5143ab235b332b309df5651a998512e2ef9`。

本记录只证明上述局部 143 项、数据审计、类型检查和字节恢复通过，不是本次全仓回归；不借用此前 clock 优化的全仓结果，不代表真实商城或桌面安装验收。实验未接入真实商城、未重新采集、未改写冻结数据，生产故障已恢复。
