# Analytics 指标独立断言补强（2026-10-15）

## 结论与最小改动

确认的是测试漏检；受测基线的生产映射符合本次固定请求/响应契约。仅在既有 `analytics carries exact date/dimension/metric order and preserves zero instead of null` case 中增加两行、三个字面断言：`views === 1`、`cartEvents === 2`，以及完整请求 `metrics` 数组的顺序。不新增 case、fixture 或生产改动，原有零值、订购件数、访问会话、dimension、period 和无效日期断言全部保留。

独立复核基线：`7b87aabf1e7f61c182a0ca0feb00dee99d8d2535`；Linux，Node `v24.19.0`。作者基线 `606f51842b42d11ead8818e01d24e3833ee9c982` 到复核基线仅增加 collection 的一个断言及对应说明。`ozon-data.ts` 和原 `ozon-data.test.ts` 的 Git blob 分别仍为 `6f343c177aba5c56a1319672983ea8c7d3d63573`、`d74daa2cf57074da10cd4150d4ec2124cceb857c`。

## 预期依据与原缺口

原 fixture 已提供 `metrics: [0, 1, 2, 3, 4]`。独立请求捕获核验了固定顺序：

```text
hits_view_search, hits_view_pdp, hits_tocart, ordered_units, session_view_pdp
```

`packages/app-hallmark/src/ozon-fields.ts` 和 `docs/apps-capabilities.md` 分别将 `views` 定义为商品详情页浏览次数、`cartEvents` 定义为加购次数。结合请求位置与既有响应字面数组，第二项应为详情浏览 1，第三项应为加购 2。新增 expected 直接写死，不调用生产 mapper、不读取生产字段表，也不从实际输出反算。

原 case 标题包含 “metric order”，但只检查请求 `dimension`，没有 `metrics` 顺序断言；结果只检查第 0、3、4 项。其他 analytics case 保护 SKU/schema 或分页数量，provider case 只验状态、provenance 与不获取 listing task。直接造值的 UI 和注入 reader 的 compose 测试无法独立锁住此映射下标。两种实际故障实验验证了这不是重复保护。

## 独立故障矩阵

前五阶段运行完整 `ozon-data.test.ts` 与 `provider.test.ts`，统一采用 `node --test --test-reporter=tap --test-concurrency=1`，不使用测试名过滤。

| 阶段 | 结果 |
| --- | --- |
| 正确生产 + 旧测试 | 64 pass / 0 fail |
| `cartEvents:r.metrics[2]` 临时改为 `[1]` + 旧测试 | 64 pass / 0 fail |
| 同一下标故障 + 新断言 | 63 pass / 1 fail |
| 仅互换请求第二、第三个指标 + 旧测试 | 64 pass / 0 fail |
| 同一请求顺序故障 + 新断言 | 63 pass / 1 fail |
| 恢复生产 + 新断言，并加入 `ozon-compose.test.ts` | 101 pass / 0 fail |

所有阶段均 0 skipped、0 cancelled、0 todo。下标故障唯一失败在原 analytics case 的 `cartEvents` 断言（`:180:47`，`1 !== 2`）；请求顺序故障唯一失败在同一 case 的数组断言（`:181:9`，`hits_view_pdp` 与 `hits_tocart` 顺序不同）。没有导入失败、超时或其他故障混入。

恢复后 `node scripts/audit-real-test-data.mjs` PASS（308 个测试文件，来源 20/20/1），`npm run typecheck` exit 0，`git diff --check` 通过。复现脚本已在新的 detached 7b87 工作树完整执行，非仅语法检查。

## 字节恢复与边界

- 实验后先恢复全部 1327 个 tracked 文件，逐项 SHA-256 与基线相同；随后仅重新应用已测试的两行断言，再新增本说明。
- `packages` 下全部 272 个 tracked 文件逐项 SHA-256 前后一致。
- 最终 `ozon-data.test.ts` SHA-256：`64e5b90ee441231229a32969a36fc4d24113f7ef97129bd05811dae40825d252`；Git blob：`a068c2115bca49a870d48e2ab21e5a6b57c9c237`。
- 未改动的 `ozon-data.ts` SHA-256：`d3e6fc267f7ba844b2d7bf9ead919e82d87df9153ae834f72b636f371a779b48`。
- 两行测试 patch SHA-256：`4fb18de8cb2cf635f589fa067e2c46fc56528a78480f69a2744c066bce5f35ac`，与作者候选字节一致。

本记录只覆盖上述相关集合、审计、类型检查与恢复。未运行本次全仓、浏览器、安装包或线上验收；未在线重验 Ozon API，不将当前请求契约扩展为平台整体正确性。本 analytics 实验仅声明 Node 24.19.0 实测，不借用其他批次的 Node 22.18 时钟验证。未接入真实商城、未改写冻结数据、未做业务写入或部署，两个临时生产故障均已恢复。
