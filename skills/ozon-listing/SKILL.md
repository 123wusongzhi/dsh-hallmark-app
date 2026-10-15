---
name: ozon-listing
description: 在 DSH 的 Hallmark 应用中，根据用户已配置的规格组合和利润自主完成 Ozon 上品：基于来源资料清洗、判断、制作文案图片、填写草稿、提交和处理反馈，不逐项向用户确认商品信息。
---

# Ozon 上品（主 Agent）

> 专项代理（资料、文案、图片）只读 [共同前提](references/shared.md) 和自己的专项文件，不读本文件。

用户的上品授权在已确定的店铺、商品和任务范围内持续有效，不重复征求。只要求选品、作图或草稿时，做到那一步为止。

先读 [共同前提](references/shared.md)，它同样约束主 Agent。分工如下：
- 程序：销售组成、采购绑定、包装、价格、审核和平台请求。
- 主 Agent：取数、派发、汇总、草稿与提交，并且独占经营草稿。
- 专项代理：资料清洗、文案、图片。

## 流程总览

| 步骤 | 谁做 | 产出 | 进入下一步的条件 |
| --- | --- | --- | --- |
| 1 准备 | 主 Agent | prepare 结果、选定类目 | 拿到 sales[] 与 preparationRevision |
| 2 清洗 | 资料代理 | product.json | `handoff.mjs check` 通过，且资料代理已报告完成 |
| 3 制作 | 文案代理 ∥ 图片代理 | content.json、images.json | 两份交付的版本和 saleId 与当前一致 |
| 4 草稿 | 主 Agent | planId、规范化 payload | draft.get 无阻塞 issues |
| 5 提交 | 主 Agent | 各行结果 | 按结果表处理 |

脚本都在 `<本 skill 目录>/scripts/handoff.mjs`。只运行脚本，不读源码。

## 接口速查（参数名以此为准）

| 用途 | 能力 | 关键参数 |
| --- | --- | --- |
| 找商品 | hallmark.collection.search | `query`、`store:{id,listingRecord:"not_found"}`、`cursor` |
| 查是否上过/在售 | hallmark.collection.associations | `id`、`storeId`；续页用 `continuation.input` |
| 读商品资料 | hallmark.collection.read | `id` 或 `selections:[{id,skuIds}]` |
| 展开图片或原文 | hallmark.collection.resource.read | `id`、`kind`(images/image/description/raw)、`role`、`assetId` |
| 上品准备 | hallmark.listing.prepare | `storeId`、`selections:[{id,skuIds}]`、续页只传 `cursor` |
| 类目约束 | hallmark.listing.category.read | `storeId`、`descriptionCategoryId`、`typeId`、`scope`/`attributeIds` |
| 字典值 | hallmark.categories.read | `storeId`、`mode:"values"`、`descriptionCategoryId`、`typeId`、`attributeId`、`q`（注意是 q） |
| 图片公网地址 | hallmark.listing.assets.publish | `files:[{path}]` |
| 建草稿 | hallmark.listing.draft.create | `storeId`、`preparationRevision`、`rows[]` |
| 改草稿 | hallmark.listing.draft.revise | `planId`、`expectedRevision`、`rows[]`（含原 `rowId`） |
| 读草稿 | hallmark.listing.draft.get | `planId`、`view:"payload"`、`rowIds` |
| 提交 | hallmark.listing.draft.submit | `planId`、`expectedRevision` |
| 找旧任务 | hallmark.plan.list / hallmark.plan.get | `cursor`、`limit` / `planId` |

商品 ID 的参数名一律是 `id`，不是 itemId。参数有疑问时，以 `apps_describe` 的返回为准。

## 查询采集商品是否上过或在售

已知采集商品 id 时直接调用 collection.associations(id,storeId)；只有名称时 collection.search 定位一次，选定准确 id 后调用关联查询。按返回的精确关联、currentSale、逐条 offers 和来源 SKU 回答，不再轮流换型号、中文/英文关键词搜索 products.list，也不枚举全店或草稿去猜关联。

- linked_offers 表示存在销售关联，不代表全部在售；currentSale=on_sale 才表示已观察到关联商品在售。
- saved_listing_only 只证明保存过上品记录，不证明成功上架。
- unresolved_history、unavailable、currentSale=unknown 必须保留不确定性；not_found 或无关联一律不能说“从未发过”“不是重复上品”。
- 状态过期可对同一关联查询 refresh:true 一次；失败就报告原因，不循环重试或改关键词。需要完整货号清单时只按 continuation.input 续页。

## 1. 准备

1. 从对话确定店铺和商品范围。店铺 ID 通过 Apps 网关获得，不猜。继续旧任务时，先用 plan.list / plan.get 找到原草稿。
2. 商品已选定时，直接调用 listing.prepare。还需要找商品时，先用 collection.search；`listingRecord:"unavailable"` 表示记录暂查不到，不等于无记录。
3. prepare 分页返回。续页只传 `continuation.input`；`sharedRef` 去同一页的 `shared.packaging` 或 `shared.categories` 取。
4. 销售组成直接采用 `sales[]`，不重新设计。用户明确要求改变组合或件数时，传 `compositions` 重新 prepare。
5. 按商品事实自己选类目，再用 listing.category.read 读必填约束。需要选填字段时，用 `scope:"all"` 或 `attributeIds`。

价格不用 Agent 计算：
- 草稿行写 `pricing:{mode:"automatic"}`，不填 `payload.price`，程序按用户利润规则计算并写入。
- 只有用户指定了售价才用 `manual`；需要预览价格时调用 hallmark.pricing.read / quote。
- 程序如果报价格映射缺失，按接口问题报告，不向用户索要采购价。

## 2. 资料清洗

派资料代理。输入给这些：
- 商品 `id`、`sourceSkuId` 和资料版本；
- prepare 返回的读取入口；
- 输出目录。

让资料代理读 shared.md 和 [资料清洗](references/materials.md)。它交付 product.json 并自行 finalize。收到"完成"后，运行：

```bash
node <本 skill 目录>/scripts/handoff.mjs check <product.json>
```

check 通过才进入制作。文件已经存在、或任务被认领，都不算交付。

## 3. 派发制作

先写销售清单 sales-manifest.json。字段直接取自 prepare：
- `storeId`、`preparationRevision`、`salesRevision`；
- `sales[]`：`saleId`（即 sales[].id）、`sourceSkuId`、`procurement`、`spec`、`includedItems`；有 offerId、rowId 时一并写入；
- 选定的 `category`、`language`、`userRequirements`。

再导出制作清单：

```bash
node <本 skill 目录>/scripts/handoff.mjs production <product.json> <sales-manifest.json> <production.json>
```

文案代理和图片代理只拿 production.json，同时并行派发。派发消息只写四件事：读哪两个文件、输入、输出目录、用户额外要求。专项规则都在代理自己的文件里，不在派发消息里重述或追加。示例：

> 图片任务：读 references/shared.md、images.md、image-progress.md。输入 /abs/production.json。只写 /abs/images/。另有文案代理同时工作。

> 文案任务：读 references/shared.md、content.md。输入 /abs/production.json，类目 descriptionCategoryId=…、typeId=…。只写 /abs/content/。另有图片代理同时工作。

资料更新后，资料代理重新 finalize，factsRevision 会递增。主 Agent 重新导出 production.json，只通知受影响的代理和 saleId。

## 4. 汇总并保存草稿

1. 按 saleId 合并 content.json 和 images.json。两份文件中的 factsRevision、salesRevision 都要与当前一致。preparationRevision 不同不要求重做。
2. 每行检查：图片 7 张（首图在前）＋详情图 8 张，且都有 url。文案行状态为 complete。
3. 按 saleId 组装草稿行：

```json
{"action":"listing","saleId":"<sales[].id>","target":{"offerId":"<主 Agent 确定的货号>"},
 "payload":{"<content.json 的 payload>":"…"},"pricing":{"mode":"automatic"},
 "listingAssets":{"images":["7 个 url"],"richContentImages":["8 个 url"]},
 "referenceSubjects":[{"sourceImageUrl":"…","subject":"…"}]}
```

   - 顶层传 `preparationRevision`。采购组成由程序按 saleId 解析，不手抄 procurement。
   - offerId 由主 Agent 确定，后续一直沿用。saleId、offerId、rowId 是三件不同的东西，要记录它们的对应关系。
   - 图库、primary_image 和富文本 11254 都由程序从 listingAssets 生成，Agent 不拼。
   - 包装尺寸和重量：程序没有回填、资料里有值时，写入 payload 的 `weight`/`weight_unit` 和 `depth`/`width`/`height`/`dimension_unit`。
4. 首次保存用 draft.create。修改用 draft.revise：传完整行、原 rowId 和当前 expectedRevision。已成功的行和平台未决的行不可修改。
5. 用 `draft.get(view:"payload", rowIds)` 读规范化 payload，处理其中的 corrections 和 issues。

主 Agent 只查三件事：漏行、串行、会让买家误解所售商品规格或数量的矛盾。查到的问题按类型交回：资料问题交资料代理，文字问题交文案代理，图片问题交图片代理。

## 5. 提交与结果

用户要求完成上品且内容已就绪时，调用 `draft.submit(planId, expectedRevision)`。submit 会审核，并自动执行审核通过的行。

| 结果 | 处理 |
| --- | --- |
| blocked / rejected | 读字段和原因，交相关代理局部修正，然后 revise 原行再 submit。同一问题连续两轮仍失败时，换一种表达或省略非必需内容；仍不行就保留为受阻行 |
| needs_user | 读实际原因。属于商品判断的自行处理；属于配置或接口问题的报告给用户 |
| review_pending | 保留版本，等审核恢复后再 submit。不靠改图或新建草稿绕过 |
| pending / unknown | 只用 draft.get 或 plan.inspect 核查，不换标识重发 |
| 部分成功 | 保留成功行，只处理未完成的行 |

最后报告草稿、已提交、平台处理中、退回和导入结果。导入成功不等于买家已可购买。

## 中断恢复

图片的恢复由图片代理执行，主 Agent 不调用 listing_image_prepare 或生图工具（会话身份不符会被拒绝）。主 Agent 的步骤：
1. 运行 `handoff.mjs recover <image-progress.json>`；
2. 把每张图的 assetKey 和 nextAction 交给新的图片代理，沿用原 assetKey；
3. 恢复消息只列缺失阶段，不加设计要求。

nextAction 的含义见 [进度与恢复](references/image-progress.md)。
