# Ozon 可售库存字面预期补强（2026-10-15）

## 结论

在 `f11b810371671a59646e5325ceeccd76e9a97f45` 独立工作树确认一处测试漏检：原生库存响应的 `free_stock` 映射丢失后，既有相关测试仍全绿。当前生产映射在本次固定响应契约下正确；永久代码改动只有原 case 新增的一行断言：

```ts
assert.deepEqual(first.items.map((r:any)=>r.stockAvailable),[4,7]);
```

不新增 case、fixture 或生产改动。原仓库顺序 `['4','6']`、分页、告警、请求数量及缺 SKU 的未知库存断言均保留。

## 预期与排重

- [库存能力契约](../apps-capabilities.md#hallmarkozonstocks--100) 将 `stockAvailable` 定义为平台确认可销售的数量，缺失值保持未知。
- [原 case](../../test/app-hallmark/ozon-data.test.ts) 已给定仓库 4/6 的 `free_stock: 4/7`；新增 expected 直接写成 `[4,7]`，不计算 `present-reserved`，不调用生产 mapper，不读取实际输出生成 expected。原仓库顺序断言同时约束值与仓库的对应关系。
- 同文件的 `warehouse channels page independently and unknown inventory values remain unknown` 已保护 present=8、reserved=3、缺可售=null，不重复扩充。
- compose/index 的正库存值由注入 reader 提供，保护关联与求和，绕过本次原生字段映射。两个 Host 库存测试保护 join/分页，未提供 `free_stock` 非零样本。
- 此处使用已有固定响应契约；没有重新在线核实 Ozon API，也不声称脱敏快照反映实时商城库存。

## 独立实跑

Linux / Node `v24.19.0`，2026-10-15 19:52:42–19:53:32 UTC。每阶段运行下列 **7 个完整文件**，没有测试名过滤：

```sh
node --test --test-reporter=tap --test-concurrency=1 \
  test/app-hallmark/ozon-data.test.ts \
  test/app-hallmark/provider.test.ts \
  test/app-hallmark/ozon-compose.test.ts \
  test/app-hallmark/compose-index-regression.test.ts \
  test/app-hallmark/compose-cache-regression.test.ts \
  test/apps-host/ozon-stock-join-completeness.test.ts \
  test/apps-host/ozon-pagination-evidence.test.ts
```

临时故障只在真实 `packages/app-hallmark/src/ozon-data.ts` 删除一次 `free_stock` 优先分支：`stockAvailable:r.free_stock??r.available` → `stockAvailable:r.available`。不替换 loader、reader、mapper 函数或 fixture。

| 生产 / 测试 | pass | fail |
| --- | ---: | ---: |
| 正确生产 + 旧测试 | 139 | 0 |
| 同一临时故障 + 旧测试 | 139 | 0 |
| 同一临时故障 + 新断言 | 138 | 1 |
| 恢复生产 + 新断言 | 139 | 0 |

均为 139 tests、0 skipped/cancelled/todo。唯一失败为原 `current inventory products shape retains SKU-zero identities and buffers all known warehouse rows`，断言位置 `ozon-data.test.ts:229:9`，`ERR_ASSERTION/deepStrictEqual`，actual `[null,null]`、expected `[4,7]`。脚本逐字检查 TAP 的 expected/actual，不把加载失败、超时或别的错误当作命中。

另实跑：`node scripts/audit-real-test-data.mjs` PASS（308 文件，来源 20/20/1，0 failures）；`node node_modules/typescript/bin/tsc --noEmit` exit 0；`git diff --check` exit 0。

## 恢复、依赖与范围

finally 先还原原生产及原测试，1329 个 tracked 文件 SHA-256 全部一致；之后仅重新施加一行测试补强。`packages/` 的 272 个 tracked 文件、全部冻结 corpus/fixture 不变。

- 测试文件 SHA-256：`3250d483c9c0abebe0b2b1b14994810fd325b1cc1392c7cef8aeda755cbd6899`
- 一行 patch SHA-256：`d67bf7d1b9484dca42c0e830096dff92665902e7b6fa22c9778c3e01e0885513`
- 生产 `ozon-data.ts` SHA-256：`d3e6fc267f7ba844b2d7bf9ead919e82d87df9153ae834f72b636f371a779b48`
- 公开脱敏 corpus SHA-256：`9c45a56450fee1ec58438852bc991046965c8d1d91958094f5b59c038cf85a23`
- `pnpm-lock.yaml` SHA-256：`6dfa707c589d59ad4442cc26ff1b4cb1441ff0c1453c1e952bdbd1e85376840b`

本次复用已有 `node_modules`，没有 fresh install。根目录使用 `pnpm-lock.yaml`，没有根 `package-lock.json`，不能把历史 README 的 `npm ci` 当作已验证安装流程。新环境应按 pnpm 锁文件准备依赖；该安装步骤本次未实跑。

子进程移除 `DSH_REAL_CORPUS` 与 `NODE_OPTIONS`，只用提交自带公开脱敏语料和受控 fixture/本地 HTTP。没有真实商城调用或业务写入。当前结论仅涵盖 139 项相关测试、审计、类型检查与恢复；未重跑全仓，历史 2263 项结果不迁移至此，未验证 Node 22、浏览器、安装包、远端 CI 或线上验收。
