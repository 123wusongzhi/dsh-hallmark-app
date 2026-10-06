# H2 店铺执行身份与促销 HTTP 合同补核（只读）

## 结论和验证边界

本报告只读取原项目源代码和已有说明，不启动原项目、不读取令牌/平台密钥文件、不调用业务写入、不修改原项目。4173 后端仍不可用；下文是**源码合同**，不是当前平台兼容性或真实店铺验收。样例全部合成，不能拿样例 ID 调用真实服务。

1. **通用无商品店铺 Task 不存在。** M2/A2-1 的“每店自动创建直连 Task”字面验收仍不能成立；不能伪造采集商品、SKU、Task kind 或借用其他店铺 Task。
2. **存在合法、无需 Listing Task 的店铺执行身份**：原看板的 `StoreManualPromotions` 绑定 `readStorePromotion/writeStorePromotion`。它用于有限促销业务，不是可任意调用 Seller API 的公共 store-platform HTTP 接口。
3. **CNY 普通售价可无需人工派发/领取**：已有 HTTP `kind:'ordinary'` 只发送普通售价字段，使用真实店铺凭据并保留原账本与操作记录。前提：用户明确 CNY 和商品/价格，不要求修改划线价、库存或活动；原服务实时确认商品未参加任何活动。只能说明业务目标可由合法 alternate 达到，不能称内部 Task 已创建。
4. **活动 price-only 仍不可安全实现**：`/v1/actions/products/update` 确实存在于当前原源码及历史核实说明，不应称其不存在；但原 HTTP 强制传活动 `stock`，没有 omit/CAS/version-preserving 选项。“保持先前读取数值”仍会写字段并有并发覆盖风险，不能由仅改价授权隐式执行。
5. 源商品精确关联可用于有条件自动创建真正 Listing 目标 Task；无历史 Listing 的店铺没有这种来源链，不能凭店铺或平台商品 ID 自动补造。

## 1. H2 的完整候选路径

| 候选 | 源码证据 | 准确边界 |
|---|---|---|
| Task 类型 | [tasks:44–49](<E:/bill学习专区/trademind_cli/src/tasks.ts#L44-L49>)、[task shape:92–116](<E:/bill学习专区/trademind_cli/src/tasks.ts#L92-L116>) | 仅 collect/listing；autonomous 是执行策略，不是新的 store/platform Task kind。 |
| 通用 task platform | [control:181–183/237–239](<E:/bill学习专区/trademind_cli/src/control-server.ts#L181-L239>)、[service:2759–2799](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2759-L2799>)、[requireListingTask](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L4647-L4652>) | URL 必须已有 taskId，服务要求真实 Listing + storeId；没有 claim 必填，但不能用 collect/authorization/storeId 替代 Task。 |
| assignments / 看板 POST tasks | [control:922–930](<E:/bill学习专区/trademind_cli/src/control-server.ts#L922-L930>)、[board:4945–4962](<E:/bill学习专区/trademind_cli/src/board.ts#L4945-L4962>)、[dispatchListing](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L6798-L6880>) | 同一 dispatchListing：非空真实 inbox itemIds、授权店铺、真实 detail、不可变 assignment snapshot；不是平台商品 ID 的无商品操作 Task。请求没有 skuScope/agentId/kind 参数。 |
| Listing fact 构造 | [task-cmds:10–44](<E:/bill学习专区/trademind_cli/src/task-cmds.ts#L10-L44>) | storeId/productId 均必填，kind 固定 Listing；不是可绕过 HTTP 校验的公开操作接口。 |
| task-goals | [control:488–492](<E:/bill学习专区/trademind_cli/src/control-server.ts#L488-L492>)、[service:2444–2497](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2444-L2497>) | 人面授权；必须既有 source Listing、同店、Offer 和 SKU 精确来源。创建真实 autonomous Listing，继承真实源商品与 SKU，而非空商品店铺任务。 |
| claim/autonomy/execute/authorization/verify | [task action 集合](<E:/bill学习专区/trademind_cli/src/control-server.ts#L159-L183>)、[publish authorization HTTP](<E:/bill学习专区/trademind_cli/src/control-server.ts#L939-L955>) | 在已有 Task 上领取、迁移、授权、执行、回读；没有凭店铺创建新通用任务的路由。 |
| revise/split/correction/recovery | [revision 源 Task 和 claim](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2912-L2928>)、[recovery 输入](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L3191-L3222>) | 衍生/替代既有 Listing 的真实范围；不是无来源 bootstrap。取消组恢复还要求人面理由，不能作为无关调价的隐式修复。 |
| collect | [createCollectTask](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L6622-L6645>) | 真实采集业务任务，不绑定店铺平台执行身份；禁止为调价触发新采集或提交虚构结果。 |
| optimization card/authorization/claim/cycle | [HTTP port](<E:/bill学习专区/trademind_cli/src/optimization-http.ts#L8-L31>)、[authorization](<E:/bill学习专区/trademind_cli/src/optimization-service.ts#L75-L121>)、[production registry](<E:/bill学习专区/trademind_cli/src/optimization-capabilities.ts#L81-L97>) | 真实优化域，不是普通 Task。生产可写 capability 仅 description/rich/images；不能借该域塞价格、仓库库存或任意 Seller API 路径。 |
| manual promotions 店铺身份 | [StoreManualPromotions](<E:/bill学习专区/trademind_cli/src/store-manual-promotions.ts#L5-L12>)、[read/write types](<E:/bill学习专区/trademind_cli/src/manual-promotions-types.ts#L25-L51>)、[service binding](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1740-L1817>) | 合法无 Listing 的有限业务身份；HTTP 仅促销 cache/operations，不暴露内部 read/write 端口的任意调用。 |
| 店铺仓库/商品同步/类目等专用读取、归档 | [既有接口盘点](<hallmark-contracts.md#L14-L35>) | 业务专用店铺入口，不生成通用 Task；专用同步投影不能冒充 M3 指定端点的完整原始平台响应，归档不能冒充改价/库存。 |

### 精确来源自动创建的可行条件

[StoreProduct/ProductSource](<E:/bill学习专区/trademind_cli/src/store-products.ts#L15-L71>) 区分平台 `productId` 与来源链 `sources[].productId`（采集商品 ID），不得混用。

[来源构造](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2614-L2664>) 只遍历已有 Listing 的发布 attempt 与平台 mappings，产生同店同 Offer 的 `{taskId,productId,skuCode,sourceSkuId?,sourceSkuMatched,...}`。返回时覆盖为该真实链生成的 sources；**完全没有 Listing 时 sources 必为空**。不能通过 Offer 命名格式、标题或外部 URL 模糊匹配发明关联。

若用户明确的目标 Offer 有唯一可信来源，可先核实完整 source Task、同店、真实采集 ID、精确源/销售 SKU，随后 POST task-goals。服务要求该 Offer 的 sources 真有 sourceTaskId + skuCode，继承 source.salesVariants 并冻结 source SKU；原服务不要求 source Task 当前 active。因此旧取消/替换/已完成来源也可能提供合法创建依据，但须验证真实来源且不改变旧 Task。无需用户先手工分派。

这不解决全新无任务店铺：来源本身依赖历史 Task。task-goals 也是单 Offer、固定 expected 的真实目标任务，不能声称每店无商品通用 Task，或假称复用 Task 时其旧 expected 已被更新。未找到来源时应保持明确受阻；合法外部依赖是原服务新增经正式授权/审计的通用店铺 read/price/warehouse-stock 能力，或已有真实商品来源关联/任务，而不是让用户手工造占位任务。当前原服务已经有下面的**有限普通价 alternate**，无需等待通用接口即可覆盖其严格子集。

## 2. 无 Task 促销 HTTP 入口、授权与选择范围

证据：[HTTP handler](<E:/bill学习专区/trademind_cli/src/manual-promotions-http.ts#L47-L122>)、[board 注册](<E:/bill学习专区/trademind_cli/src/board.ts#L4257-L4265>)、[store registry](<E:/bill学习专区/trademind_cli/src/manual-promotions-stores.ts#L13-L51>)。

- 此 handler 在原 **board** 注册；[独立 control server 的 handlers](<E:/bill学习专区/trademind_cli/src/control-server.ts#L933-L938>) 不注册它。部署入口必须实际提供该路由；不能因 health 成功便假定可用，也不自动启动另一原服务。
- 每个 GET/POST **均要求** `Authorization: Bearer <原项目人面令牌>`，不是 App 自己的 operator/API token。此 handler 不支持 `x-hallmark-human-token` 替代头。
- [原验证函数](<E:/bill学习专区/trademind_cli/src/human-token.ts#L100-L104>) 由原服务验证其 own human token；适配器只能使用用户明确提供的原操作令牌/显式环境配置，不能调用 loadHumanToken、读取文件、抓取页面内嵌令牌或读取 Ozon Api-Key/Client-Id。当前适配器约定可用显式 `HALLMARK_OPERATOR_TOKEN`；其值必须真是原项目令牌，不能由 App token 替代。
- 所有请求显式 `?storeId=...`。只允许一个此 query 参数；格式 `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`。**不能省略**后让原服务选择默认/第一个店铺。
- 原服务再次校验登记、Ozon、启用、授权、实际可用凭据；凭据仅原服务持有：[promotionCredential](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1740-L1756>)。
- handler 请求 body 最大 **256 KiB UTF-8 字节**；下层 store-write 结构最大 1 MiB，最多 1000 件，但公共 HTTP 受更小 256 KiB 约束。App 现有 200 件上限可以更严格。
- 只接受已有固定业务路由，不接受任意 path/body/service method。原 HTTP 无 dsh agentId 字段，源账本 actor 为 human/system；App M6 自己记录真实 caller、用户原话、选择、值来源、Source UUID/requestId，不能伪称源 Task 的 agentId 为 dsh-hallmark-app。

| 方法/路径（均显式 storeId） | 请求 | 结果/副作用 |
|---|---|---|
| GET `/api/manual-promotions` | 无 body | `PromotionCacheResponse`：选中店 cache + operationsAvailable + 所有 Ozon storeCaches；只读缓存，不直接发平台请求。 |
| POST `/api/manual-promotions/refresh` | `{}` 或 `{storeId}`（需与 query 一致） | 202，当前 cache view；后台只读同步，不能视作刷新已成功。 |
| GET `/api/manual-promotions/actions/:actionId` | 正整数 | `PromotionDetail`：缓存的成员/候选合并列表；没有该缓存为 404。 |
| GET `/api/manual-promotions/operations` | 无 body | `{operations: PromotionOperation[]}`，当前店本地历史，无分页。 |
| POST `/api/manual-promotions/operations` | 严格 `PromotionSelection` | 200 `PromotionOperation`，**不等于业务成功**；先准备/校验、记录、一次平台写、只读 inspect。 |
| GET `/api/manual-promotions/operations/:uuid` | 无 body | 原请求/逐商品状态，只读本地；不存在 404。 |
| POST `/api/manual-promotions/operations/:uuid/inspect` | handler 不读取 body，建议 `{}` | 200 原 operation 更新；仅平台回读和原记录更新，不重发原写；之后安排只读 cache refresh。 |

## 3. CNY 普通售价：可行的严格子集

[选择解析](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L21-L48>)：

```ts
// 公共 HTTP 类型；这是源合同，不是可直接执行的用户数据。
{
  id: string,                 // lowercase UUID；同逻辑修改稳定复用
  actionId: 0,
  kind: 'ordinary',
  products: [{
    productId: number,        // 正的 JS safe integer 平台 ID，不是采集 ID
    offerId: string,          // 非空、每批唯一，与平台 ID 必须精确配对
    price: string,            // 用户指定，大于零，最多两位小数；非 cents
    stock: '0'                // 原 HTTP 固定占位；ordinary 不向平台发 stock
  }]
}
```

顶层仅 id/actionId/kind/products，普通价 row 仅 productId/offerId/price/stock；未知字段拒绝。没有 `currency/oldPrice/minPrice/warehouseId/autoAction` 输入。用户需要的币种须由 App **先明确校验为 CNY**，不能省略确认后默认为 CNY；原下层固定 CNY。用户显式要求 oldPrice 等此合同不支持的修改时，不得丢弃该要求后调用此 alternate。

真正平台 wire：[manual-promotions:261–266](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L261-L266>)：

```json
{"prices":[{"product_id":123456789,"price":"12.34","currency_code":"CNY"}]}
```

`stock:'0'` 不进入 wire，**没有仓库/活动库存写**；不设置 old_price、VAT、自动促销选路字段，不报名、退出或更换活动。禁止从 SourceSnapshot/成本模型推导新的价格；源快照只能帮助核实明确所选商品的身份，源实时检查不匹配便拒绝。

写前 [submit:194–254](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L194-L254>)：

1. 同 UUID 已存在且内容一致，直接返回旧记录；内容不同 409。
2. 店铺写锁覆盖准备和提交；其他正在准备/提交的写入拒绝。目标商品已有 pending 结果时拒绝新写。
3. 实时 GET 全部活动，并完整读每个活动 members；**目标商品参加任一活动即 409**，不会自动退出活动或转另一接口。准备过程中会读取未选商品/活动，但写范围仍只取显式 selection.products。
4. `/v5/product/info/prices` 每批 100，实时确认 product_id、offer_id 精确对应，`price.currency_code === 'CNY'`。不满足即 409；并非仅信任旧店铺快照。
5. 保存操作意图，再执行一次 `/v1/product/import/prices`。HTTP submit 返回后安排 cache refresh，此 refresh 仍只读平台。

### UTF-8 wire 样例（全部合成，未发送）

以下 host、shop、UUID、商品均是说明占位，不代表可用服务或真实目标；令牌仅符号占位。

```http
POST /api/manual-promotions/operations?storeId=synthetic-shop-a HTTP/1.1
Host: 127.0.0.1:4173
Authorization: Bearer <EXPLICIT_SOURCE_OPERATOR_TOKEN>
Content-Type: application/json; charset=utf-8

{"id":"11111111-1111-4111-8111-111111111111","actionId":0,"kind":"ordinary","products":[{"productId":123456789,"offerId":"synthetic-offer-a","price":"12.34","stock":"0"}]}
```

合成的 pending 200 body（由公共 HTTP operation 类型返回，不是平台 wire 回执）：

```json
{"id":"11111111-1111-4111-8111-111111111111","actionId":0,"kind":"ordinary","products":[{"productId":123456789,"offerId":"synthetic-offer-a","price":"12.34","stock":"0"}],"storeId":"synthetic-shop-a","title":"普通售价","createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:01.000Z","status":"pending","requestId":"human-promo-11111111-1111-4111-8111-111111111111","error":null,"results":[{"productId":123456789,"offerId":"synthetic-offer-a","price":"12.34","stock":"0","status":"pending","reason":"普通售价尚未回读一致，请稍后核实","actualMinor":null,"sellerMinor":null}]}
```

只有同一目标 `actualMinor === 1234`、row.status verified 且身份/币种已核实才表示普通价回读一致；sellerMinor 是另一个实际卖家价，可与普通价不同。results 实际包含 stock 兼容字段，即使源 TS interface 未列出，也必须原样保留。[operation 输出校验](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L161-L183>)。

## 4. 意图、原账本、幂等与 unknown

[operation 类型](<E:/bill学习专区/trademind_cli/src/manual-promotions-types.ts#L57-L68>)、[public submit/inspect](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L194-L320>)、[store-write journal](<E:/bill学习专区/trademind_cli/src/store-promotion-write.ts#L73-L130>)、[service 串行及 replay](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1763-L1789>)：

- 源先持久化 `{status:'pending',requestId:'human-promo-'+UUID,selected products,results:pending}`，再追加真实店铺主体 `STORE_PROMOTION_WRITE_STARTED`（包含 canonical requestHash、path/body、startedAt、outcome pending），之后才发送平台。
- 收到完整平台响应时 `STORE_PROMOTION_WRITE_FINISHED` 为 response_received + httpStatus/脱敏 response；传输失败/超时/不完整响应为 outcome_unknown。开始事实保存失败不发平台；结束事实保存失败可在平台已发后报 503，必须按未知处理。
- 同店同 requestId+同 requestHash 只回放历史记录，包括 pending/unknown，不重新发送；改内容则 PROMOTION_REQUEST_ID_REUSED。一次 sender 自身缓存 Promise，源没有平台写自动重试。
- 公共 HTTP operation 没有直接暴露该 PlatformWriteRecord/outcome 字段；不能在 App 中发明 outcome 伪称原字段。公共 op.status 只有 pending/finished，逐件结果 pending/verified/rejected。finished 可能是全部 rejected 或混合结果，不等于 success。
- 明确平台普通价 `updated:false` 或 errors 非空、rejected、deactivated、以及源逻辑判定的 4xx（408 例外）会记 rejected。原逻辑也可能把 429 记 rejected；不能因此自动用新 UUID 重写。同 UUID始终回放旧结果。
- 网络/代理 5xx/超时应在 App 记录 unknown，保留原 UUID、精确店铺/选择/内容。先 GET 原 operation；需要继续核实时只 POST 原 UUID `/inspect`，不得自动重新 POST submit 或生成新 UUID。
- **尤其重要：准备先发生，operation 保存在准备完成之后。** submit 可耗费多个串行平台查询。App HTTP 超时后源 handler 不保证停止；当时 GET UUID 返回 404 只表示尚未落盘，不证明“没有/不会发写”。保持未知、查询原 ID，不因 404 自动重提。
- inspect 不重发写。ordinary 逐目标读取 prices，要求原 offer_id + CNY，比较普通 `price.price` 与提交用户值；保存实际 marketing_seller_price 单独参考。既有 verified/rejected 不再被重写。[inspect:289–320](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L289-L320>)。
- 发生网络 outcome_unknown 但实际普通价随后与目标一致时源可将 operation 标为 verified；这证明状态回读一致，不证明未知 HTTP 写已明确接收或能确定因果。App应保留原未知传输证据及最新只读核实，不把它改称录制了明确平台成功回执。

## 5. 活动 update 与 stock 的不可省略边界

实际 source update：

```ts
{ id, actionId: positiveInteger, kind: 'update',
  products: [{productId: positiveSafeInteger, offerId, price: decimalString, stock: nonnegativeIntegerString}] }
```

实际 Seller API wire：

```json
{"action_id":12345,"products":[{"product_id":123456789,"action_price":{"amount":"12.34","currency":"CNY"},"stock":"7"}]}
```

以上均合成，**不是仅改价授权下允许执行的样例**。

- `/v1/actions/products/update` 是现行原实现的共用报名/更新接口；[源文档](<E:/bill学习专区/trademind_cli/docs/manual-promotions.md#L20-L32>)、[历史协议核实](<E:/bill学习专区/trademind_cli/docs/promotion-enrollment.md#L9-L19>)、[历史改价验证](<E:/bill学习专区/trademind_cli/docs/ozon-promotion-price-verification-20260926.md#L5-L16>) 提供过去接口/行为证据，不是本轮真实平台运行验收或永久兼容保证。禁止换成 activate/enroll 来实现 price-only。
- kind update 实时查询所选活动成员；**不在 members 就 409**。仅 kind enroll 查询候选且可报名；update 不会自动转 enroll。[submit:214–250](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L214-L250>)。
- 价格须用户指定、CNY、身份对应且不超过 max_action_price；普通价不是活动价，营销卖家价也不是活动报价本身。
- 公共 [parseSelection:35–44](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L35-L44>) 与内部 [parseStorePromotionWrite:45–49](<E:/bill学习专区/trademind_cli/src/store-promotion-write.ts#L45-L49>) **都强制 stock**，wire 明确发送。没有 version/expectedStock/CAS/If-Match/omit-stock 的公开合同。
- 这是**活动库存/促销配额**，不是 warehouse 库存；原请求没有 warehouse_id，也不调用 stocks API。但仍是额外写字段，不能因不是仓库库存就说“没有库存写”。不能填 0，也不能复制先前读到的值并假称不修改：read→write 有竞态，且没有原子条件更新。
- [inspect:313–315](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L313-L315>) 仅核活动成员/报价，不核活动 stock。因此也不能声称原 HTTP 原生验收保证 quota 未变。
- **后续实现边界**：仅 price 用户指令继续 ACTION_PRICE_NOT_SUPPORTED/明确澄清，说明必须额外提交活动 stock。若用户另行明确授权活动 quota 值，这是另一更宽业务范围，非当前 price-only 工具验收。要在价格单字段授权下完成本需求，外部依赖是当前平台/原服务提供并核实真正省略 stock 的更新合同，或服务端原子 preserve-with-version；当前源码不能提供。未修改原项目，不做猜测实现。

## 6. read-only 覆盖、分页、刷新和限制

[read types](<E:/bill学习专区/trademind_cli/src/manual-promotions-types.ts#L25-L29>) 与 [source read binding](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1792-L1817>) 内部白名单：GET `/v1/actions`；POST `/v2/actions/products`、`/v2/actions/candidates`、`/v3/product/info/list`、`/v5/product/info/prices`。不支持库存、仓库、attributes、import-info 的任意转发。

这些原服务内部 port 不是公开 HTTP 方法。公共 GET 只返回加工后的持久 cache/actions/detail，丢弃原平台未知字段、改名/金额转 minor，不能替代 M3 “指定原平台 endpoint 原文响应”。detail 合并 members/candidates，包含 participating/eligible、actionMinor/maxActionMinor/sellerMinor、stock/minStock/currency；**没有独立 raw prices/candidates/products HTTP**。

[cache](<E:/bill学习专区/trademind_cli/src/manual-promotions-cache.ts#L60-L129>)：

- GET 不触发平台请求；缓存 checkedAt 表示完整缓存成功生成时间，不假称平台采集时间。
- 源启动/定时刷新四小时一次；POST refresh 返回 202 + refreshing 状态，之后需 GET 查询 checkedAt/error。失败保留旧完整快照。
- refresh 先调用 `syncStoreProducts()`，该调用同步全部 Ozon 店铺；再查询当前店全部活动/详情。`storeId` 不是原商品同步的隔离参数。所选店 cache.refresh 不代表只读请求绝不涉及其他店；应如实提示读范围，禁止声称只刷新该店所有数据。
- 全活动分页 [rows](<E:/bill学习专区/trademind_cli/src/manual-promotions.ts#L113-L152>)：每页 100、最多 1000 页，last_id 游标、total 完整性/去重；不完整即 503，不当作“无活动成员”。price/info 每次 100 个商品。公共历史/cache无分页、无 HTTP 响应字节封顶：App自身需要完整保存、spill/限制对话预览，不能假称原响应有服务端分页。

[Ozon rate limit](<E:/bill学习专区/trademind_cli/src/ozon-rate-limit.ts#L4-L38>) 默认账户/端点 1000 ms 间隔，`HALLMARK_OZON_INTERVAL_MS` 只接受 100–3,600,000 ms；analytics另至少60秒。排队等待超过5秒、或账户cooldown返回429 LOCAL_RATE_LIMIT；真实429 Retry-After进入账户cooldown（缺失通常60秒）。这是过程内共享限流，不是每个业务 operation 固定 1 req/s 上限，也不是平台永久限额保证。

源促销 read 使用 OzonWriteClient maxAttempts=1，单次默认30秒、响应10 MiB；source service 将读失败映射 PROMOTION_READ_FAILED 503，公共 handler又返回泛化 error，没有向客户端完整暴露 retryAfter。[source read](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L1806-L1816>)、[client limits](<E:/bill学习专区/trademind_cli/src/ozon-write-client.ts#L15-L17>)、[request loop](<E:/bill学习专区/trademind_cli/src/ozon-write-client.ts#L449-L521>)。原 store-write 一次60秒、10 MiB、redirect:error，不重试。[write sender](<E:/bill学习专区/trademind_cli/src/store-promotion-write.ts#L94-L130>)。App仍需自己的快速health gate；一个复杂submit可能超过现有70秒适配timeout，超时必须按未知处理，不能把延长timeout当作幂等保护。

## 7. 公共 HTTP 错误和后续本地验收建议

[HTTP catch](<E:/bill学习专区/trademind_cli/src/manual-promotions-http.ts#L119-L122>) 返回 `{error:string}`，不是 App ToolResult，也不是稳定 machine code schema。

| HTTP | 源含义举例 | App应如何处理 |
|---|---|---|
| 401 | 原 Bearer缺失/无效 | 原令牌配置缺失或拒绝；绝不读文件自动恢复。 |
| 400 | JSON/UUID/商品身份格式、价格精度、未知字段、额外query/坏storeId | 发写前校验/澄清；不猜值。 |
| 404 | 店铺/缓存活动/操作不存在 | 普通GET可明确not found；**未知提交后的operation404仍不能证明未发写**。 |
| 409 | 无操作权限、同UUID改内容、写锁、目标未决、普通商品已参加活动、币种/实时身份未核实、update非成员、超价 | 保留原条件、解释拒绝；不能改变用户目标或换路报名。 |
| 413 | 原HTTP body超过256KiB | 输出边界错误，不做隐式更大范围或不同UUID重写。 |
| 503 / 连接失败 / 超时 | 原服务存储/平台读取/服务异常；部分错误可能发生在平台写后 | unknown（已提交风险场景），查询原UUID，不自动重发。 |
| 200 | 原operation对象 | 按每件pending/verified/rejected解释；不得由HTTP200或finished直接报告成功。 |
| 202 | cache refresh已安排 | pending refresh，不报告更新完成。 |

若 Lead 决定实现 CNY ordinary alternate，建议在独立本地合成HTTP测试中先覆盖：

- 无Listing + 明确CNY + 明确Offer/product pair普通价成功；源原账本店主体记录；Task计数始终零，不伪称Task创建。
- 独立App token有效但原operator token缺失/无效时无源写；query固定显式目标店。
- 不支持币种、price精度、oldPrice/活动/warehouse要求时拒绝，不改值、不drop要求。
- 源现有活动成员/坏实时pair/非CNY/已未决/写锁拒绝，写计数零。
- UUID/body hash跨重启稳定、相同id回放/不同body冲突、不生成新id重试未知。
- 源准备时App超时，操作GET暂404，随后源写发生：App必须保持unknown且从未重写。
- 源意图落盘前失败无写；平台已写但账本finish或HTTP失败，App查询原id回读，不误称“未执行”。
- 普通价readback错误身份/币种/金额/pending/partial rejected；完整原op和stage/spill保留；状态匹配不假称明确写回执。
- price-only action指令仍无源submit；源码强制活动stock的合同以专门guard/test解释，而不是不存在endpoint。

本报告不修改 Core/Runner/Adapter 的价格执行路径；实现与验证须由 Lead 另行明确分配。当前不能报告 A2-1 字面 Task 验收、活动价格单字段能力或真实平台验收已完成。
