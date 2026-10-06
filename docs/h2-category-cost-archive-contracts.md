# H2 补核：类目读取、采购成本修改、商品归档

## 结论与证据边界

只读检查原项目源码与合成测试，未修改原项目、读取凭据/令牌文件、启动服务或调用业务 API。本文是能力/接入决策报告，不是已实现工具或真实业务验收。只新增本文；正式 contracts、Core 与适配实现仍由 Lead/owner 处理。

| 能力 | 源接口是否真实存在 | 可实现判断 | 关键外部条件/限制 |
|---|---|---|---|
| 类目查询 | 共享 HTTP 路由存在，业务读取 | 可薄接正式只读工具，不必创建 Task | 原服务在线；在线读取需要已授权 Ozon 店；可能写读取缓存，不保证实时、完整或最终发布权限 |
| 采购成本修改 | 人面鉴权的本地成本账本写入 | 可薄接，但必须以全局来源 SKU 成本键为授权对象 | **跨店/跨 Offer 共享**，不能伪装成单店/单 Offer 成本；需明确全局语义、CNY 值/恢复指令、版本与影响范围 |
| 商品归档 | 人面鉴权的真实平台写入 | 可薄接独立写工具，不能当本地删除/撤销 | 完整店铺+Offer 清单、当前平台 ID、原服务凭据；平台结果可 pending/unknown，不自动重写 |

三者均不要求先派发/领取 Listing Task；鉴权、DTO 与验证各自不同，不能机械套用 generic task-platform 的路径、scope 或通用售价 DTO。

## 1. 类目查询：正式路由、参数与返回

[共享路由](<E:/bill学习专区/trademind_cli/src/control-server.ts#L798-L862>) 调用 [service 转发](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1820-L1849>)；这些路由没有调用 requireHumanAuth。原 control server 采用 loopback 监听，不能将“无 human token”误读成任意远端开放。商品成本和归档另外鉴权。

| 方法/路径 | 准确输入 | 准确返回 |
|---|---|---|
| GET `/api/catalog/search` | `q` 必填，trim 后 1–200 Unicode 字符；`aspects` 逗号分隔，去空项，唯一 aspect 最多 10；`requireAspects` true 时必须给 aspects；`limit` 默认 10，通常 1–20；`storeId?` | `CatalogSearchResult`，不是单纯数组，见下 |
| GET `/api/catalog/show` | `categoryKey=<descriptionCategoryId>:<typeId>`；`storeId?` | `CatalogShowResult = CategoryTemplate + name/path/breadcrumbs/disabled` |
| GET `/api/catalog/categories/:descriptionCategoryId/types/:typeId/template` | 两个正整数 ID；`storeId?` | `CategoryTemplate` |
| GET `/api/catalog/categories/:descriptionCategoryId/types/:typeId/attributes/:attributeId/values` | 三个正整数 ID；`q?` trim 后 2–200 Unicode 字符；`limit?` 默认 50、1–100 整数；`storeId?` | `DictionaryResult`，不是简单字符串/ID数组 |
| GET `/api/catalog/categories/:descriptionCategoryId/types/:typeId/attributes/:attributeId/values/:valueId/validation` | 四个正整数路径 ID；`dictionaryId` 正整数；**非空 storeId 必填** | `{value}`；已知字典值的 scoped 验证，不是未核实候选列表 |
| POST `/api/catalog/sync` | JSON object，`storeId?:string` | `{nodeCount,leafCount,disabledCount,treeHash,fetchedAt,changed}`；平台只读并更新本地缓存，不是商品写 |

控制层 `requireAspects` 只把 `1/true` 解释为 true；[看板同功能路由](<E:/bill学习专区/trademind_cli/src/board.ts#L4634-L4649>) 使用更严格的 catalogBoolean。适配器应发送规范 `true/false`，不能依赖 malformed boolean 在 control 上被静默当 false。源码另允许 `q='*'` 时 limit 至 100000；这是获取当前树的特例，不代表一般搜索允许大页。独立层宜有明确限额/spill，不默认请求整棵树。没有 source cursor 参数。

### DTO 与身份

[领域类型](<E:/bill学习专区/trademind_cli/src/catalog-types.ts#L98-L123>)、[搜索/字典 DTO](<E:/bill学习专区/trademind_cli/src/catalog-types.ts#L175-L223>)：

- `CatalogSearchResult` 保留 `query,requestedAspects,matchedTotal,candidatePoolSize,evaluatedCount,aspectCoverage,treeStale,aliasVersion,results`，可有 `storeId,treeFetchedAt,searchMode,semanticWarning,availabilityNote`。
- `results[]` 含 `categoryKey,descriptionCategoryId,typeId,name,path,breadcrumbs,relevanceScore,matchedBy,capabilityStatus,aspectMatch,supportedAspects,missingAspects,unresolvedAspects,aspectBindings,eligibleVariantAttributes,schemaHash,templateFetchedAt,templateStale`。不把 partial/unknown 降格为“支持”。
- `CategoryTemplate` 含 `kind:'ozon-category-template-v1',formatVersion,platform:'ozon',categoryKey,descriptionCategoryId,typeId,language:'ZH_HANS',attributes,variantPolicy,schemaHash,contentHash,fetchedAt,stale`，可有 store-scoped `categoryResolution` 证据。叶子身份是两个 ID 的 pair，不是源淘宝类目或单个 categoryId。
- `attributes[]` 有 `id,name,required,skuVariantEligible,skuVariantEligibilityKnown,isCollection,maxValueCount,attributeComplexId,complexIsCollection,categoryDependent` 等；字典属性可有 `dictionaryId`。variantPolicy 的 100 SKU 上限属于 Hallmark guardrail，不是伪造平台上限。
- `DictionaryResult` 含 `formatVersion,platform,categoryKey,descriptionCategoryId,typeId,attributeId,dictionaryId,values:[{id,value}],complete,fetchedAt,stale`，可有 `lastValueId,verifiedBy,prefetchedAt,query,search`。**只看顶层 values 作为允许值**；`search.candidates` 是原始远端搜索候选，不是已证明属性允许值。[查询验证与缓存](<E:/bill学习专区/trademind_cli/src/catalog-service.ts#L1028-L1078>) 明确区分候选、attribute-values 成员验证与 fallback。

### Store cardinality、读取副作用和时间

[真实店铺选择](<E:/bill学习专区/trademind_cli/src/catalog-service.ts#L411-L469>)：显式店名/ID使用原 resolveStoreReference；必须非 removed、正常状态、已授权 Ozon 且具原服务凭据。省略店铺时，在线 credential selection **恰有一个候选才自动选**；0 个或多个报 STORE_REQUIRED，不取第一店。独立层应复用唯一店铺解析并传完整 ID，不替原服务猜 shop/name。

[search](<E:/bill学习专区/trademind_cli/src/catalog-service.ts#L824-L871>) 在明确店铺缺 tree cache 时会 sync；模板/字典可在线读取并写缓存，读取失败也可能返回 stale cache。省略店铺且已有缓存允许某些离线结果，但不证明结果属于用户当前店铺。同步会写全局树和选定店的树，[sync 实现](<E:/bill学习专区/trademind_cli/src/catalog-service.ts#L727-L768>) 不写商品状态、价格、库存。展示保留原 fetchedAt/treeFetchedAt/stale/fallback，不能把本次工具时间冒充源更新时间；类目可用性不是最终发布成功或权限保证。

## 2. 采购成本：wire 不等于内部 purchaseMinor

正式 [HTTP 写路由](<E:/bill学习专区/trademind_cli/src/control-server.ts#L517-L520>)：POST `/api/store-products/purchase-price`，requireHumanAuth；[鉴权](<E:/bill学习专区/trademind_cli/src/control-server.ts#L185-L207>) 接受 `Authorization: Bearer ...` 或 `x-hallmark-human-token`，缺少 401 HUMAN_AUTH_REQUIRED，无效 403 HUMAN_AUTH_INVALID。接入仅显式配置 operator token，由后端持有；本次没有读取任何令牌文件。

**准确 HTTP body**，由 [parsePurchasePrice](<E:/bill学习专区/trademind_cli/src/purchase-price.ts#L12-L41>) 定义：

```ts
{
  productId: string;             // 来源采集商品身份/task.productId，不是 Ozon productId
  skuCode: string;               // sources[].skuCode 的精确成本键
  price: string | null;          // 非负十进制 CNY 金额，最多两位小数；null = 恢复采集价
  expectedRevision: string|null; // 初次无覆盖记录时 null；否则当前 purchaseRevision
}
```

四个字段均需符合解析条件；未知字段拒绝。**HTTP 不接受 purchaseMinor/storeId/offerIds/currency/requestId/userRequest/valueSource。** 旧 H1 表将内部 purchaseMinor 当 wire，需要由文档 owner 修正，不能据旧表发请求。

- `price:'12.34'` → 内部 `purchaseMinor:1234`，单位为 CNY 分，不是 RUB/美元、平台销售价或采购数量。0 允许；负数、数字类型、指数、>2位小数、溢出不允许。
- [money](<E:/bill学习专区/trademind_cli/src/dynamic-pricing.ts#L17-L25>) 使用 BigInt 精确乘 100，界限为安全整数；parse 另外保证转回 numeric price 不丢分。不要先浮点四舍五入出“用户值”。
- `price:null` 是用户明确恢复来源参考价的操作，不是删除商品或自动回滚。恢复后仍保留新 revision，旧编辑器不能覆盖；来源成本可能仍 unknown/非 CNY，不能称恢复成已知人民币成本。
- `sources[].productId` 来自 Task 的采集商品 ID；平台产品 ID 在外层 StoreProduct.productId。`skuCode` 取真实 sources 成本键，注册销售规格时可能是 salesSkuId；**不可用 sourceSkuId、平台 sku 或模糊原始 code 替换它**。[来源构造](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2623-L2649>) 可同时给 sourceSkuId/salesSpec 但按 task.productId+skuCode 查采购覆盖。

每次 HTTP 只修改一个来源商品+skuCode；多 SKU 批量不是原子接口，需要明确逐项范围/版本和独立部分结果。一个 Offer 若有多个有效 sources，不能默认选第一来源。影响匹配没有 presence/status 限制，不能只统计 on_sale 行而漏掉其他关联商品。

### 全局成本键、影响范围、CAS、返回

[changePurchasePrice](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2555-L2571>)：

1. 枚举所有店的商品，只要 `sources.some(sourceSkuMatched && source.productId===input.productId && source.skuCode===input.skuCode)` 即 affected。
2. 无有效精确来源关联 → 404 PURCHASE_SOURCE_NOT_FOUND；当前 `(revision??null)!==expectedRevision` → 409 PURCHASE_PRICE_CONFLICT。
3. 追加 human PURCHASE_PRICE_CHANGED 事实，键是来源商品+SKU；revision 为新 UUID，含 previousPurchaseMinor。
4. 返回 **完整 `{stores,products,affectedCount}`**，不是只返回请求店/Offer。覆盖金额投影回 purchasePrice=minor/100、purchaseCurrency='CNY'、purchaseOverride 与 purchaseRevision，并影响参考利润模型；不是平台售价写，不进行 Ozon 请求。

[源合成测试](<E:/bill学习专区/trademind_cli/src/purchase-price-service.test.ts#L24-L53>) 故意设置同来源SKU在一个店2个Offer、另一店1个Offer；[HTTP断言](<E:/bill学习专区/trademind_cli/src/purchase-price-service.test.ts#L159-L169>) 证 affectedCount=3、相同旧 revision 重发409、无平台调用。本次只读测试源码，未重跑源测试。

**接入决策：**成本工具优先显式 sourceProductId+skuCode 授权全局共享覆盖，展示精确 affected ownerRows 与影响说明；若用户只允许单店/单Offer、实际同源键另有未授权行，必须澄清/拒绝，不能发一个无 storeId 的 POST 后隐瞒其他变化。即使外层提交 ownerRows/hash，源 API 也没有原子 affected-set CAS；expectedRevision 只保护成本版本，不保护商品关联集合变化。要求绝对只影响指定行且可能同时新增关联的意图，需要外部源能力扩展，不能靠先读后写冒充事务范围保证。全局来源键授权必须明确包括该共享覆盖的语义，不能从“用户选中一行”推导。

## 3. 商品归档：真实平台写与未知状态

[路由](<E:/bill学习专区/trademind_cli/src/control-server.ts#L530-L533>)：POST `/api/store-products/archive`，同上人面鉴权，无 Task 参数。准确 [DTO/幂等逻辑](<E:/bill学习专区/trademind_cli/src/store-product-actions.ts#L113-L147>)：

```ts
{ requestId: string, selected: Array<{storeId:string,offerId:string}> }
// 返回 {requestId,results:[{storeId,offerId,state,message?}]}
// state: 'archived'|'pending'|'unknown'|'rejected'
```

- requestId 是 1–80 位 ASCII 字母/数字/连字符，**不接受下划线**；selected 是 1–500 个明确、唯一的店铺+Offer pair。原 parser 非严格未知键拒绝器，独立工具层仍须严格 DTO/拒绝附加平台 payload。
- 同一 requestId 复用必须与原 selected **顺序和内容**精确相同；完成时返回旧结果，只有 STARTED 无 FINISHED 时返回 unknown，不再次平台写。不同范围复用报错；适配应持久原 payload，不能重排后拿同键重新发。
- 每个选择必须命中当前原商品快照、presence='present'、未归档、具数字正安全整数平台 productId。不能默认整店/整箱/第一行；store name 需先唯一解析完整ID，Offer不可跨店裸匹配。
- [source service](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2703-L2729>) 阻止 ARCHIVE_BUSY、SYNC_BUSY；从原服务持有的店铺凭据建立 maxAttempts:1 客户端。缺凭据/网络故障可能落入 unknown，不能只凭文本“missing credentials”宣称无写。
- [执行](<E:/bill学习专区/trademind_cli/src/store-product-actions.ts#L148-L174>) 先 human STARTED 事实，按店每100条 POST `/v1/product/archive` `{product_id:[Number(currentSnapshotID)...]}`；result:false→rejected，true→pending并 POST `/v3/product/info/list` `{offer_id:[精确chunk...]}`。同 Offer+相同平台 ID 且 is_archived===true 才 archived；其他仍 pending。异常/非布尔结果→unknown，**不自动重试**。
- 最后记 FINISHED results；仅已确认 archived 更新原本地快照对应商品 status。不是删除原采集资料、移除 Task、删除平台商品或恢复销售；本次没核“取消归档”端点，不可赌 undo。
- [源 HTTP 测试](<E:/bill学习专区/trademind_cli/src/store-products-archive-http.test.ts#L35-L54>) 证401/400未调用平台、逐项 archived/pending/rejected、限定product_id、只确认项改变本地status、同键回读不增加平台写。本次未运行测试或平台请求。

## 4. 新工具的 Read/Write/current-marker/ownerRows 门槛

源三个能力的合同均没有 DSH sessionId、当前用户轮次、userRequest、valueSource 或 caller scope。人面 token 仅证明原人面权限，不能自动证明“本轮用户要求此笔修改”。这些必须由独立层建立，不作为额外字段发给原 parser。

1. **Read：**类目输入严格校验、唯一店铺解析、精确参数编码、保留原始 DTO/来源时间/部分与 stale 标记；大量完整结果走已有spill。不得因需要类目缓存而创建来源商品 Task 或触发扩展采集。
2. **Write/current marker：**成本和归档只在本轮明确业务修改指令下进入。可信 Session/caller 上下文与当轮 userRequest 一致，不能将模型随填字符串、旧用户原话、component saved metadata 或 GET query 当新授权。没有当轮授权则澄清，不把 read refresh 变写。
3. **值来源：**成本必须显式用户 CNY 值或明确恢复指令；规则必须有已核版本与数值证据，否则沿用 ruleEvidence 澄清，不能凭 rule:name 猜。归档没有价格数值，但必须明确动作来源/范围，不借成本、改价指令扩成归档。
4. **ownerRows：**归档按每个完整storeId+offerId核全量 selected 与身份；成本按全局来源键枚举所有精确来源关联，在本轮明确授权范围内才写。商品ID三种身份（来源Item、平台product、Offer）不能混用。保留完整影响数和准确行，不把全量返回当当前会话有权展示全部店铺。临时 view owner/Session 只是组件读取权，不是业务写授权。
5. **操作账本：**独立 clientOperationKey/fingerprint 与 session owner、精确源payload/expectedRevision持久保存，预发送记intent；成本无source requestId，归档有source requestId，要分别处理。成本未决操作冲突键必须按全局来源商品+skuCode，不可只按一个storeId/Offer/session阻挡而让其他店/会话绕过；查询返回仍守各自Session owner，不泄漏他会话账本。unknown 先get_operation/只读核查，不换键、不自动重发；成本同旧revision409不应被说成成功或自动读取新revision再覆盖。
6. **核实：**成本成功需精确 source key、CNY值/恢复状态、更新版本及影响数回读；归档只有 archived算已核实，pending/unknown单列。GET store-products是快照，不是强制实时平台证据；未知归档不能仅凭旧snapshot未归档判失败并重写。后续read-only验证可使用已核task精确查询，若无Task/原read路径不足，保留未核实状态而不创建任意来源任务。

## 覆盖状态

本报告支持 owner 实施只读 category 和独立成本/归档 guards 的决策，不证明现有23工具已覆盖全部核心业务。未变更业务 schema、Core 实现、平台白名单、README验收声明或原 Source。促销/素材/四工具 WorkPlan/命名规则等其他 gap 仍按既有报告处理，不能由本报告闭合。
