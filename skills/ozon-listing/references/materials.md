# 资料代理：清洗资料，交付 product.json

先读 [共同前提](shared.md)。你是唯一阅读全部来源文字和图片的角色。你的产出 product.json 是下游唯一的事实源。

## 输入

主 Agent 给你：
- 商品 `id`、`sourceSkuId` 和资料版本；
- 读取入口；
- 输出目录。

## 步骤

1. **取资料**：用 `hallmark.collection.read({id})` 读精简事实，再用 `hallmark.collection.resource.read({id, kind:"images", role:"main"|"sku"|"detail"})` 展开图片；单张图用 `kind:"image", assetId`。有 continuation 就按它续读，没展开完不等于来源缺失。
2. **看图**：真的打开每张图看，不凭文件名判断。逐张判定类别：
   - `subject`：主体正确、清楚、完整，可作为生图参考；
   - `specification`：尺寸图、参数表、包装或套装说明；
   - `detail`：结构、细节、配件或用途，且有新增信息；
   - 其余（无关商品、企业宣传、联系方式、重复图）是噪音，不进 product.json。
3. **清洗文字**：只保留身份、用途、规格、材质、尺寸、重量、包装、SKU 差异、包含物和有效限制。认证、性能、兼容性要分清"来源声称"和"有依据"。
4. **定规格**：数值从图片标注和文字综合得出，记清楚它指的是什么（商品还是包装、单件还是整套、净重还是含包装）。可以按件数换算；缺少包装数据时，可以给出有依据的运营估算。
5. **解决矛盾**：结合所选 SKU、规格图和上下文选最合适的值，写进 decisions。只有影响必填字段时才列入 blockers。
6. **发布**：写 product.draft.json，然后运行：

```bash
node <本 skill 目录>/scripts/handoff.mjs finalize <product.draft.json> <product.json>
```

   成功后报告 product.json 的绝对路径和 factsRevision。以后修订也是先改草稿再 finalize，不直接改正式文件；内容没变时，版本也不会增加。

## product.json 结构

```json
{
  "itemId": "程序商品 id",
  "sourceRevision": "资料版本",
  "sourceRefs": [{"capability":"hallmark.collection.read","input":{"id":"…"}}],
  "summary": "商品是什么、做什么用",
  "commonFacts": ["所有 SKU 共用的材质、结构、包含物、单位"],
  "skus": [{"sourceSkuId":"…","spec":"原规格","meaning":"采用的规格含义","diff":"与其他 SKU 的差异"}],
  "purchaseBasis": [{"sourceSkuId":"…","goodsPrice":0,"freight":0,"freightIncluded":false,"currency":"CNY","unit":"采购单位"}],
  "measurements": [{"name":"长","value":50,"unit":"mm","sourceSkuIds":["…"],"scope":"商品·单件","basis":"source","reason":"尺寸图标注","refs":["img-3"]}],
  "images": [{"id":"img-1","purpose":"subject","path":"/abs/img-1.jpg","sourceImageUrl":"https://…","sourceSkuIds":["…"],"note":"左侧绿色 2 位端子"}],
  "decisions": [{"topic":"…","result":"…","basis":"…"}],
  "blockers": [],
  "changes": []
}
```

各字段的规则：
- `basis` 只能取三个值：`source`（来源标注）、`inferred`（换算或解读得出）、`estimated`（运营估算）。估算值不能写成实测。
- `images[]` 每项都要有 `path`（绝对路径）或 `resource`，以及 `sourceSkuIds`。下游必须能直接打开，不能只写"图3"。
- 全量的逐图分类记录另存为 source-audit.json，只供你自己回查，不放进 product.json。

## 红线

- 不凭外观编造精确尺寸、重量，不创造品牌、认证或性能。
- 不改销售组成，不写草稿，不提交平台。
- 不伪造 revision 或 saleId。
