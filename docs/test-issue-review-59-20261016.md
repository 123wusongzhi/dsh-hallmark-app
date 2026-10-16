# Issue #59：两仓可售库存的独立预期

本批接续 `b821d4a62a8c97f98b8707f78aef08287d4570fc`。批末复查发现 #59，实际 `created_at=2026-10-15T20:03:00Z`，晚于本任务起点。已阅读完整 issue 和一条评论；对方其他分支的提交与 Linux 测量仅作参考，以下是本机独立复现结果。

## 判断与最小改动

问题有实际价值：原测试已固定仓库 4 的 `free_stock=4`、仓库 6 的 `free_stock=7`，也检查仓库顺序，但没有直接验证这两个已知可售值。删除原生 reader 的 `free_stock` 读取会让结果退化为未知 null，已有分页、身份和缺 SKU 检查仍可全部通过。compose 的注入 reader 检查绕过了这个原生映射分支。

仅在 `test/app-hallmark/ozon-data.test.ts` 的原两仓 case 增加一行：

```ts
assert.deepEqual(first.items.map((r:any)=>r.stockAvailable),[4,7]);
```

预期直接来自原响应，不计算 present-reserved、不调用 mapper、不读取实际输出生成 oracle。原 `warehouseId=['4','6']` 顺序断言与分页、告警、调用数量、缺 SKU 时可售库存为 null 等断言全部保留。#58 已提交的三个 analytics 断言也不变。没有新增 case/fixture、依赖、skip、生产修改或分类规则，冻结 corpus 不变。

兼容性边界：既有 `ozon-fields.ts` 和生成文档将 `stockAvailable` 定义为平台确认可用于销售的数量，缺失值保持未知。主区原生 stocks 映射与本例响应相同，用户其他产品反馈、model 证据及采购工作保留。本次只保护本仓库固定响应契约，没有在线确认完整 Ozon 协议，不将可售数推算为其他业务策略。

## 独立故障对照

Windows x64、Node v24.12.0，固定七个完整文件，无测试名过滤：ozon-data、provider、ozon-compose、compose-index-regression、compose-cache-regression、ozon-stock-join-completeness、ozon-pagination-evidence。

唯一生产 mutation 为 `stockAvailable:r.free_stock??r.available` 临时改成 `stockAvailable:r.available`。

| 实际阶段 | tests | pass | fail | skip/cancel/todo |
| --- | ---: | ---: | ---: | --- |
| 正常生产、旧测试首轮 | 139 | 138 | 1 | 0/0/0 |
| 正常生产、旧测试一次复核 | 139 | 139 | 0 | 0/0/0 |
| 临时故障、旧测试 | 139 | 139 | 0 | 0/0/0 |
| 同一故障、新断言 | 139 | 138 | 1 | 0/0/0 |
| 原字节恢复、新断言 | 139 | 139 | 0 | 0/0/0 |

首轮失败是未修改的 provider case `exact association capability refreshes sale observations once, pages without searches and validates scope`，在 `provider.test.ts:347` 得到 unknown、预期 on_sale。原失败 TAP/JSON 保留，没有覆盖、skip、放宽断言或反复重试；仅额外做一次另存日志的 baseline 复核。此前 [#38–41 报告](test-issue-review-38-41-20261015.md) 记录过同一症状及同毫秒 observation 排序的诊断，本次没有新的数据库取证，不能把首失败确定归因于该原因，也没有修复此独立偶发风险。

库存故障的新测试唯一失败准确位于原 case `current inventory products shape retains SKU-zero identities and buffers all known warehouse rows`，deepStrictEqual 预期 `[4,7]`、实际 `[null,null]`；不是上述 provider case、加载错误或超时。恢复生产后同七文件 139/139。生产保存原 Buffer 并在 finally 恢复，SHA-256 前后均为 `2eaaa81e31608424f10826db22b910626dc22e149fa174d9904c0949b3183d7d`，最终生产 diff 为零。测试正式 diff 仅一行。

## 主区集成与最终验证

主区 `ozon-data.test.ts` 有既有用户改动，只在原库存行后精确插入本批一行，保留原换行符；逆向删除本行后与原文件 SHA 一致。集成时快照保护 96 个既有修改/未跟踪文件，其他既有文件逐字未变。只提交测试一行和本报告，不将用户 WIP 纳入提交。

| 检查 | 实际结果 |
| --- | --- |
| 隔离七文件恢复回归 | 139/139，0 skip/cancel/todo |
| 隔离类型检查 | 通过 |
| 隔离冻结数据审计 | 通过 |
| 主区同七文件 | 141/141，0 fail/skip/cancel；多出两项为用户既有测试 |
| 主区类型检查 | 失败：用户新增 `test/apps-host/listing-five-concurrent.test.ts:13–14` 有三条 jobs 隐式 any[] 诊断 |
| 主区数据审计 | 失败：listing-brand、listing-draft-file、listing-policy、procurement-sync、listing-five-concurrent 五个用户新增测试尚未分类 |

主区检查反映执行当时正在变化的用户工作区；本轮未再出现上一批 operations-adapter 的十条类型诊断，不能把旧结果当成本轮结果。当前类型/审计失败与 provider 偶发风险仍明确保留，不宣称全仓全绿。原始阶段日志、首轮失败、恢复与集成哈希在本地忽略目录 `artifacts/issue-review-automation20-20261015T1953/issue59/` 留存。

限制：本次为以上定向离线验证，未重新跑全仓、Node22/Linux、真实商家或桌面安装。没有业务写入，也不改变生产接口或用户策略。继续保留每 60 分钟检查新问题。
