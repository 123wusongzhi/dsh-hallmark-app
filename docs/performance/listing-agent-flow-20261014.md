# 上品 Agent 链路统一修复

日期：2026-10-14。适用当前本地工作树，已构建，未安装或部署。原有未提交改动保留。

## 已修复

- preparationRevision 不再包含准备时间；同内容快照复用原版本和 preparedAt。增加 salesRevision，依据来源资料、采购组成、包装和成本生成，不随类目选择、分页或已有资料复用方式变化。图片进度以 factsRevision/salesRevision 判断内容变化，恢复会话保留原图和 URL，并保留 originSessionId 便于核查原回执。旧记录仍兼容，不无条件把旧资产视为新版本。
- plan.list 返回有界摘要分页，包含 planId、标题、店铺、行数、状态计数和后续读取入口，不返回整批 payload 导致通用样例截成一单。默认 30 单，字节预算自动缩页。
- listing.draft.get 和 plan.get 新增 view=payload，按行/页读取实际规范化内容、采购组成、定价模式和修正，避免同时读取全部审核及来源证据。默认摘要提供 payloadRead。超大单行仍走完整结果引用，不截断字段。
- 新增 listing.category.read，默认必填约束；scope=all 分页浏览，attributeIds 精确选字段；字典值仍按需读取。类目读取不重建销售准备，续页固定快照并校验店铺。
- 草稿 create/revise 支持顶层 preparationRevision + 行 saleId（行级 preparationRevision 亦可）。服务端在连接内解析采购组成，校验店铺、销售行和当前来源版本；显式 procurement 与引用不一致时拒绝。关联身份保留在草稿中，不进入 Ozon payload。报价入口同样支持该行引用。
- Skill、descriptor 与生成 SDK 统一推荐 listing.draft.create/revise/get/submit；plan.* 通用入口及旧 products.list_product 保留兼容，后者明确标注旧入口及直接创建并提交语义。制作清单脚本接受 prepare 原始 sales[].id，自动转为 saleId。

## 新调用方式

创建草稿调用 hallmark.listing.draft.create：

```json
{
  "storeId": "实际店铺ID",
  "preparationRevision": "prepare返回的版本",
  "rows": [{
    "action": "listing",
    "saleId": "prepare返回的sales[].id",
    "target": {"offerId": "持续复用的商品编码"},
    "pricing": {"mode": "automatic"},
    "payload": {"name": "已完成的商品标题"}
  }]
}
```

以上仅演示引用和自动定价字段；实际完整上品仍需填写类目、属性及成功发布的 listingAssets。无需逐行搬运 procurement 或自行计算 price。

保存后调用 hallmark.listing.draft.get：

```json
{"planId":"返回的planId","view":"payload","rowIds":["返回的rowId"]}
```

选定类目后调用 hallmark.listing.category.read，传 storeId、descriptionCategoryId、typeId；默认必填。选择选填属性时增加 attributeIds；查询全部约束时 scope=all 并跟随 continuation。

## 验证

使用仓库已有、校验过 SHA-256 的真实测试集：41 个来源商品（淘宝/天猫20、阿里20、拼多多1），真实店铺、类目模板及图片。

- 对其中具有稳定 SKU 标识的36个商品、461个销售组成进行重复准备，preparationRevision 与 salesRevision 均稳定。其余5个不伪造 SKU 标识来补齐。
- 新增真实数据测试覆盖：类别选择与已知资料复用、采购组合变化、错误店铺/销售行、采购引用冲突、过期来源、类目分页、列表全量遍历、规范化 payload 可读、图片跨会话复用。
- 应用层回归：863/863 通过。此后新增全真实样本重放测试和少量恢复/店铺校验完善，最终上品相关回归：295/295 通过；两组有重叠，不相加。
- 完整链路测试经过 prepare → 引用式 create → 新组成 prepare → 引用式 revise → 自动定价/审核时重算 → submit → pending 幂等 → inspect 成功。平台传输和审核结果由隔离桩控制，未向真实平台上品。
- 真实数据依赖审计、TypeScript、SDK生成、应用构建均通过。

构建包：artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.72.tgz
SHA-256：edf96f13ce891f3265febc1a8031f133113bb5f39e573f11cf1e5abb2a295d90
installed=false。构建包含工作树原有其他改动，不能视作只包含本轮修复的独立发布包。

证据：output/listing-agent-friction-audit-20261014 下的 new-tests.log、regression.log、apps-tests.log、typecheck-fix.log、generate.log、build.log。
