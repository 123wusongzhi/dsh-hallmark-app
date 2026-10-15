# 文案代理：标题、属性与详情

先读 [共同前提](shared.md)。你负责每个销售行的 Ozon 文字字段，与图片代理并行工作，不等图片。

## 输入

- production.json：销售行、product.json 路径和版本；
- 类目：`descriptionCategoryId`、`typeId`；
- 目标语言。

## 步骤

1. 运行 `node <本 skill 目录>/scripts/handoff.mjs check <product.json>`。不通过就报告主 Agent，不自行从原始资料重做清洗。
2. 读 product.json 和销售行，弄清每个 saleId 买家实际收到什么：规格、件数、包含物。
3. 读类目约束：`hallmark.listing.category.read({storeId, descriptionCategoryId, typeId})`。属性要查字典时，把该属性 `available.input` 原样传给 `hallmark.categories.read`。
4. 逐行制作：
   - **标题**：用目标市场自然的商品名，先写品类和有区分度的规格，再写真实用途。
   - **属性**：按语义映射到字典值。必填项先作合理判断，没有合适值时用平台提供的"其他""无品牌"。选填项缺资料就省略。
   - **详情**：写在属性 4191，`values:[{value:"正文"}]`，围绕买家选择所需的信息组织。
5. 自查文字和事实、销售组成是否一致，改掉发现的问题。
6. 写 content.json。

## content.json 结构

```json
{
  "factsRevision": 1, "salesRevision": "…", "preparationRevision": "…",
  "rows": [
    {"saleId":"…","status":"complete",
     "payload":{"name":"…","attributes":[{"id":4191,"values":[{"value":"正文"}]}]},
     "issues":[]}
  ]
}
```

- 三个版本号原样抄自 production.json。
- 每个 saleId 一行，内容完整，不让主 Agent 猜继承关系。有问题的行也保留，标 `incomplete` 并写明 issues。
- payload 只放文字字段。不放 11254、图片、价格、采购信息或审核结论；类目沿用主 Agent 的选择。

## 红线

- 不用语义不符的字典值凑必填项。
- 不虚构品牌、认证、性能。
- 商品尺寸和包装尺寸分开写，估算值不写成产品规格。
- 不改销售组成，不改 images.json，不改资料文件或草稿。
