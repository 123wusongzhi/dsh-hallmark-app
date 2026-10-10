# 经营规则与报价

此模块只保存本应用经营规则和执行确定性试算，不读取旧平台、不调用 Ozon、不自行启用默认规则。采集、采购关联及重量来源由调用者提供可信事实。

## 接口

```ts
const pricing = new BusinessPricingRepository(coreStore);
const config = pricing.read(storeId); // get 是同义接口
const saved = pricing.save(storeId, draft, config?.revision ?? 0);
const quote = pricing.quote({
  storeId, action: 'listing', pricingMode: 'automatic',
  planId: 'legacy-unified-reference', purchaseMinor: 343,
  weightGrams: 100, priceMinor: 6000,
});
```

- `save` 必须传入最近读取的 `expectedRevision`；首次为 `0`。冲突不会覆盖其他修改。
- 每次保存生成完整历史版本；`readVersion(storeId, revision)` 可回查提交时依据。
- `quotePricing(config, input)`／`quoteBusinessPrice` 为纯计算接口。仓库 `quote` 支持单对象和 `(storeId, input)` 两种形式。
- 状态 `blocked` 表示 `issues` 含有明确字段问题；没有配置、缺采购价或缺包装克重均不会按零计算。
- `priceMinor` 可选：提供时核对实际售价，省略时试算建议价。`suggestedPriceMinor` 永远保留建议值，不截低到自动上品上限。
- 独立的语义审核不必随费率变化重复。实际提交需要重新读取经营配置和可信成本，对所提交售价检查最新规则。

## 金额、目标与约束

所有金额为整数分，重量为整数克，比例为百万分比。`logisticsMicrosPerGram` 单位是**百万分之一元／克**，原报价 `0.0393 元/克` 对应 `39300`。物流总费用和佣金各自向上取整到分，底线判断使用 BigInt 整数比较。

上品始终使用 `listingTargetMarginPpm`，其他试算使用 `manualTargetMarginPpm`；填写具体售价不会改变用途对应的目标。目标用于生成建议价，未达到目标本身不会拒绝明确指定的售价。`minimumMarginPpm` 是单独可选的经营底线，`null` 表示用户没有设置，不能回退为旧暂停实验的 15%。自动上品上限仅作用于 `action=listing / listing_import / listing.*` 且 `pricingMode=automatic` 的报价，手动指定售价不受此自动上限约束。

物流方案可包含渠道 ID、启停状态、起止时间、适用克重区间。多个方案分别保存，默认方案不影响单次明确选择。有效截止时刻不包含在报价有效范围内。

报价的利润只覆盖已配置采购、固定费、物流费和佣金，不宣称是完整结算净利润，未配置费用不等于实际为零。

## 旧配置导入

`legacyReferenceDraft(importedAt)` 仅返回待导入草稿，调用者必须显式保存。已核实旧已发布指南 v39：上品目标 60%、手动 ERP 目标 5%、佣金 20%、固定费 3.16 CNY、每克物流费 0.0393 CNY、自动上品上限 135 CNY。

旧平台没有逐渠道报价，因此方案名固定为“旧平台统一参考方案”，不伪称某一物流渠道的真实价格。`minimumMarginPpm`、绝对最低价和绝对最高价均为 `null`。

存储集合为 `business_pricing` 和 `business_pricing_versions`。应注入本应用稳定存储，不能让旧平台后端地址或缓存代次变化清空这些配置。
