# Hallmark H1–H5 接口核实与 M1/M2 决策

## 验证边界

- 只读检查原项目源码；未修改原项目、未启动原服务、未读取平台凭据或令牌文件。
- 本轮对 `http://127.0.0.1:4173` 的 `GET /api/health`、`GET /api/stores` 均为网络不可用；不能把源码核实称作当前运行契约已验证。
- [适配测试](<../test/adapter/adapter.test.ts>) 使用[合成夹具](<../test/adapter/fixtures.ts>)，不是用户店铺录制响应。23 项通过覆盖路由、原样字段、HTTP错误、超时、限流、不确定结果、只读白名单、任务复用、显式SKU范围与spill。
- H1/H2/H4/H5 均有源码结论；H3 HTTP 链路有源码结论，真实测试店铺与完整素材交付验收未做。**不声称 A2-1/A2-3/A4-1/A5-5 或全部业务能力已运行验收。**

## H1：准确 HTTP 契约

主要证据：[control-server.ts](<E:/bill学习专区/trademind_cli/src/control-server.ts#L480-L998>)、[Hallmark service](<E:/bill学习专区/trademind_cli/src/hallmark-service.ts#L2444-L2803>)。

| 方法/路径 | 请求 | 原始响应/边界 | 鉴权 |
|---|---|---|---|
| GET `/api/health` | 无 | `{service:'hallmark-control',capabilities:string[]}` | 本机 |
| GET `/api/stores` | 可选 `all=1,status,authStatus` | Store 数组；店名是 `shopName`，含 `id/platform/status/authStatus/hasCredential`，服务本身已排除 removed，不能保证 all 恢复已移除店 | 本机 |
| GET `/api/stores/:id` | 完整ID | 单个 Store | 本机 |
| GET `/api/stores/:id/warehouses` | 完整ID | 实时 RealFBS 仓库投影 | 本机 |
| GET `/api/store-products` | **没有店铺/分页/搜索参数语义** | `{stores:[{id,name,platform,hasCredential,lastAttemptAt,lastSuccessAt,error,analytics,...}],products:[{storeId,offerId,...,sources,profit,weight,metrics,...}]}` | 本机 |
| POST `/api/store-products/sync` | `{}` | 同上；**同步全部 Ozon 店铺**，保留失败店上次成功数据，在 stores[].error 标明，不等于整体HTTP失败 | 本机 |
| POST `/api/store-products/analytics` | `{dateFrom:'YYYY-MM-DD',dateTo:'YYYY-MM-DD'}` | 同上；全部店铺日期区间流量指标，**不是利润计算接口**。读取失败保存fallback/cacheState/error | 本机 |
| POST `/api/store-products/purchase-price` | `{productId:来源采集ID,skuCode:来源SKU,price:十进制CNY字符串或null,expectedRevision:string或null}` | 源 SKU 成本覆盖跨店/Offer共享，返回完整受影响商品+affectedCount；purchaseMinor只是内部CNY分，不能当HTTP字段。null明确恢复采集价，CAS409不可自动重写 | 人面令牌 |
| POST `/api/store-products/archive` | 原项目 parseArchive 定义的明确商品选择、requestId | 逐项归档结果，业务写 | 人面令牌 |
| GET `/api/items` | 无 | `ItemSummary[]`（id/title/mainImage/skuCount/source等）；不是原始采集JSON | 本机 |
| GET `/api/items/:id` | ID支持前缀匹配，独立层需完整ID确认 | 已处理 `ItemDetail`，含 skus/images/attributes/sourceUrl | 本机 |
| GET `/api/items/:id/raw?full=1` | **full=1不可省略** | `{id,content:string,truncated:boolean}`，content是raw_data.raw的JSON原文；缺raw时是提示字符串，不是空对象 | 本机 |
| GET `/api/tasks` | 无 | 所有 Listing Task 数组 | 本机 |
| GET `/api/tasks/:id` | 完整ID | Task show 投影，保留原始字段 | 本机 |
| GET `/api/tasks/:id/context` | 完整ID | `DirectTaskContext` 或 null | 本机 |
| POST `/api/tasks/:id/verify` | `{}` | DirectTaskContext（goal/result/skus/verification/unresolvedRequestIds等）；平台只读回查并记验证事实 | 本机 |
| POST `/api/tasks/:id/checkpoint` | `{agentId,state:'working'|'waiting_platform'|'needs_human',note,nextAction?,nextCheckAt?,businessOutcome?}` | 新上下文/进度；不能伪造接受结果 | 本机 |
| POST `/api/assignments` | `{storeId,itemIds:string[],instruction?}`，非空唯一采集商品完整ID | `{ok:true,created:number,reused:number,taskIds:string[],tasks:Task[]}`，按店+商品重用活动任务；**无skuScope参数** | 人面令牌 |
| POST `/api/task-goals` | `{requestId,sourceTaskId,storeId,offerId,skuCode,instruction,kind:'sellable'|'update'|'inspect',expected}` | `{taskId,created,directContext}`；要求已有精确商品来源，**不是通用店任务创建** | 人面令牌 |
| POST `/api/tasks/:id/platform` | 下述精确契约 | PlatformCallRecord；HTTP代理状态与上游httpStatus分开 | 本机，无claim要求 |

### 平台调用与库存端点

[PlatformCallInput/Record](<E:/bill学习专区/trademind_cli/src/platform-call.ts#L8-L35>)：

```ts
{ requestId: string, agentId: string, path: '/vN/...', body: unknown,
  method?: 'GET'|'POST', note?: string,
  mappings?: Array<{skuCode:string,offerId:string,[field:string]:unknown}> }
```

- requestId：1–100位 ASCII 字母数字下划线连字符；agentId非空且≤200；path≤300；note≤2000；body必须存在。GET body必须 `{}`。
- 默认 POST，原项目序列化默认 POST 时不保留显式method字段。输入自身≤1MiB。
- 记录增加 taskId/storeId/requestHash/startedAt/finishedAt/outcome/httpStatus/response/error/retryAfter/replayed/replayWarning。
- outcome 为 pending / response_received / outcome_unknown。代理 HTTP 200 不代表上游成功，更不代表业务达成。
- 相同taskId+requestId相同请求返回旧记录 replayed:true；不同请求内容返回 PLATFORM_REQUEST_ID_REUSED。**以相同requestId重试429只会读旧429，不会重新请求平台。**
- 原项目凭据由服务持有并对记录做敏感字段遮蔽。适配层只允许注入 Hallmark 操作令牌，不存 Ozon Client-Id/Api-Key。
- 实际库存写是 **`POST /v2/products/stocks`**（stocks数组含offer_id/warehouse_id/stock），不是spec猜测的import/stocks。
- 精确仓库回读是 **`POST /v2/product/info/stocks-by-warehouse/fbs`**，现有实现用 `{sku:[平台sku...],limit:100}`；来源证据：[agent-work-platform.ts](<E:/bill学习专区/trademind_cli/src/agent-work-platform.ts#L580-L605>)。
- 第一版只读白名单严格匹配path+method：[适配层列表](<../packages/hallmark-adapter/client.ts#L7-L14>)；GET `/v1/actions`，其他POST：product/info/list、prices、attributes、actions/products、actions/candidates、stocks-by-warehouse/fbs、product/import/info、warehouse/list。未经核实的任意版本/别名不能通过读工具。

### 其他核心能力覆盖盘点（不能误报已完成）

| 能力 | 真实源接口 | 当前独立层状态 |
|---|---|---|
| 店铺/商品查询、原始采集读取、流量同步 | 上表 | M1已适配，合成测试通过 |
| 模型利润/阈值筛选 | products[].profit + 独立层筛选 | 利用已有本地投影，不误调用analytics |
| 调普通价/活动价/库存 | 受控task platform | M1调用能力；M5需独立校验和只读核实 |
| 上品 | assignments + 受控 /v3/product/import/回读 | 内部准备已实现，完整内容/素材/类目验收仍需M5 |
| 商品归档、采购价修改 | /api/store-products/archive、purchase-price | 已盘点，M1未暴露正式方法，不能称覆盖完成 |
| 促销列表/成员/报名/退出/价格/历史 | /api/manual-promotions 系列（或受控task平台调用） | 路由已核实；正式业务工具未覆盖 |
| 类目搜索/模板/字典查询、只读同步 | /api/catalog/search?q=&aspects=&requireAspects=&limit=&storeId=；show?categoryKey=&storeId=；categories/:id/types/:id/template；...attributes/:id/values?q=&limit=&storeId=；POST /sync {storeId?} | 路由已核实，正式工具未覆盖 |
| 图片导入/发布/交付诊断 | /api/images/* | 路由已核实；正式素材交付未覆盖，禁止伪造成功 |
| 店铺注册/授权/撤销、SKU覆盖、任务组拆分/修正/回收、优化域 | 源项目另有路由 | 尚未逐项业务契约验证；需要后续覆盖清单，不能把当前23工具当作全部核心能力 |

目标模型自动调价已暂停：当前看板对非GET `/api/target-margin*` 返回409。GET target-margin与manual-promotions都要求Bearer人面令牌；二者是看板路由，不保证独立control-server包含。证据：[board.ts](<E:/bill学习专区/trademind_cli/src/board.ts#L4257-L4265>)、[target-margin-http.ts](<E:/bill学习专区/trademind_cli/src/target-margin-http.ts>)、[manual-promotions-http.ts](<E:/bill学习专区/trademind_cli/src/manual-promotions-http.ts#L57-L122>)。不得把旧preview/execute自动选路当当前可用调价入口。

## H2：无任务读取与内部任务方案

**重大spec偏差：原HTTP没有凭店铺创建无商品任务的能力。**

1. 店铺/商品快照/采集资料都可无任务读。后台sync无任务，但会同步全部Ozon店。
2. 通用平台直连仍要求已有Listing（店铺决定调用身份），不要求领取/审批。某店现有非cancelled/replaced/split Listing可复用；listed任务可供普通读取、价格/库存操作，不作为新的上品活动任务。
3. TaskBroker按店保存映射，每次读取映射后的原任务验证店铺、kind与失效状态。失效则只从已有任务重新关联，**不随机采集箱选品，不凭空建任务**。无候选 => TASK_CONTEXT_REQUIRED，仍允许快照读取。
4. task-goals必须已有sourceTaskId、精确Offer/SKU/source关联，仅适合明确商品目标，不满足通用店铺任务创建。
5. 显式上品给定采集商品+店+SKU后可自动assignments（需要配置HALLMARK_OPERATOR_TOKEN；绝不自动读令牌文件）。上游按item/store复用而非SKU；独立映射包含规范化skuScope，所有业务payload/mappings/验收必须限于显式范围。现有冻结SKU范围不包含目标则SKU_SCOPE_MISMATCH，不改原任务。
6. 映射通过MappingStore接口注入，不直接依赖SQLite；AppStore可结构实现。注入audit回调记录内部关联/准备（created真假），Lead需接入M6。原项目assignments创建本身有业务账本，但新项目audit未注入时不会自动持久写操作记录。
7. 同作用域并发合并一次准备；上游同步assignments自己去重item/store。requestId用完整operationId哈希+序号保持跨重启稳定。

这是一项已知产品缺口：从未有Listing的店铺不能在不选择来源商品的情况下做通用task平台读取/写入。不是原生工具/MCP切换可解决。当前采用可用任务复用+明确错误，不暗改原项目。

**补核细化**：上述限制针对通用 Task，不代表原项目完全没有无任务店铺写入。原看板的 `StoreManualPromotions` 使用真实店铺作用域身份、原令牌、原账本；HTTP `kind:'ordinary'` 可以在实时核实未参加活动后仅改用户指定的 CNY 普通售价，无人工派发/领取，但不会创建内部 Task。活动 `/v1/actions/products/update` 是真实原实现端点，而非不存在；其公共合同强制写活动 `stock`，没有原子保留/省略选项，不能由 price-only 指令隐式写配额。完整路由、鉴权、wire、幂等/unknown、读范围和外部依赖见 [H2 与促销 HTTP 补核报告](<h2-store-execution-and-promotion-contracts.md>)。此处只核源码，尚未实现该 alternate，也未进行真实后端验收。

## H3：上品链路

- assignments只能创建/复用Listing，不自动上品。
- 原四工具 `agent_prepare / agent_deliver_assets / agent_submit / agent_inspect` 是stdio MCP，要求本地runtime文件、WorkPlan、真实检查声明；**没有对应Control HTTP四工具端点**。[工具契约](<E:/bill学习专区/trademind_cli/src/agent-work-mcp.ts#L37-L65>)。
- 已核实的薄接入候选：读源raw+detail → 显式scope创建/复用任务 → 原始内容、Ozon类目/属性、价格、图/素材等前置校验 → `/v3/product/import`含显式mappings → `/v1/product/import/info`原task_id追踪 → 明确Offer的平台info/prices回读 → 如业务指令要求库存，再 `/v2/products/stocks`+精确仓库库存回读。
- 上游verifyTask返回DirectTaskContext；只比较当前goal+mappings，不证明任意importItems的类目/素材/定价来源。普通assignment默认goal可能包含全任务SKU，独立层不得拿整任务result代替用户明确范围的验收。
- 源平台类目不是Ozon description_category_id/type_id。源图URL不是已证明的素材交付结果。缺信息须澄清；必要交付/内容无法验证须报告限制。不能声称四工具已跑通，也不能用接收200伪造上品成功。
- 本模块验证只有合成assignment复用，**没有完整合成上品链路或真实测试店铺验收**。

## H4：利润口径

[product-profit.ts](<E:/bill学习专区/trademind_cli/src/product-profit.ts#L149-L205>) 返回每个product的profit：

```ts
{ actualMinor:number|null, actualMargin:number|null, profitMinor:number|null,
  costMinor:number|null, purchaseMinor:number|null, packageGrams:number|null,
  observedAt:string|null, settingsRevision:number|null,
  targetMarginPpm:number, targetSource:'batch'|'default', reason:string|null }
```

当前源码参考费用模型可适用于所有店；bill专属历史证据只参与bill投影。文档中旧bill限定不可外推到当前全部读投影。

**metricBasis建议固定：**“Hallmark参考模型利润率=(最近已知实际卖家售价−精确来源采购成本−固定费用−按包装克重估算物流费−向上取分的佣金)/实际卖家售价；使用当前费用版本，物流实重优先、申报包装克重兜底。不是平台实际结算净利润率，非实时数据。”

整数分逻辑：[manual-profit.ts](<E:/bill学习专区/trademind_cli/src/manual-profit.ts#L1-L14>)。平台营销卖家价不是普通标价，也不是消费者券/补贴支付价。缺人民币精确来源采购价、有效重量、费用版本、卖家价或身份冲突等返回null+reason，不按0算；筛选应把无法判断单列，保留负利润。observedAt是价格观测时间，不是利润刚重算时间。GET产品纯本地投影，不发平台请求。

原文口径与暂停说明：[target-margin-pricing.md](<E:/bill学习专区/trademind_cli/docs/target-margin-pricing.md#L1-L25>)。真实5品数值比较仍待业务验收，本模块不复制参考计算公式到另一个权威层。

## H5：采集原始资料与时间缺口

- raw来源是既有商品富字段参考快照中的 `raw_data.raw`，资料仍在原项目实际文件/服务后；事实账本负责来源/任务语义，不迁移。
- `/items`摘要与`/items/:id`详情均经过处理，不能称全部原始字段。真正原始 endpoint 必须 `/items/:id/raw?full=1`。[原实现](<E:/bill学习专区/trademind_cli/src/items.ts#L311-L335>)。
- 处理后detail包含sourceUrl、skus.sourceSkuId/code/id/spec/price/stock/image、images、descriptionImages、attributes；阿里国际站价格可能是seller quotation，不作为采购价，采购字段会unknown。
- 源raw平台结构各异，并非统一带SKU、Ozon类目或采集时间。content非JSON提示意味着该源无raw，不强行parse为空对象。
- ItemSummary/ItemDetail/RawProduct没有统一collectedAt。导入账本有事件时间，但既有items HTTP不暴露统一字段；原normalized product也未保留独立采集时间字段。[类型](<E:/bill学习专区/trademind_cli/src/items.ts#L19-L120>)、[转换](<E:/bill学习专区/trademind_cli/src/collect.ts#L91-L127>)。**缺失source时间则不填写dataTime，不把本次fetchedAt冒充采集时间。**
- 源服务支持ID前缀首次匹配，独立业务解析要完整ID与多候选澄清；TaskBroker准备前检查detail.id与请求完整ID相等。

## 已导出适配 API 与集成责任

入口：[index.ts](<../packages/hallmark-adapter/index.ts>)，接口：[types.ts](<../packages/hallmark-adapter/types.ts>)，实现：[client.ts](<../packages/hallmark-adapter/client.ts>)、[task-broker.ts](<../packages/hallmark-adapter/task-broker.ts>)。

- HallmarkClient：getStores、getStoreProducts、syncStoreProducts、getAnalytics、getTargetMargin、searchCollectedItems、getCollectedItem、getCollectedItemDetail、getTasks、getTask、getTaskContext、verifyTask、createAssignment、platformCall、platformRead、health。
- 返回AdapterResult `{status,raw?,provenance?,error?,spill?}`。raw逐字段保留；大响应内部仍保留raw供计算，并lossless落spill，工具呈现层应返回summary/file/cursor而非把raw整表dump到agent上下文。
- 没有“源端分页”假设。商品快照分页/搜索应在core处理且可保留整页原始字段；平台游标/limit由body透传，平台上限按具体端点。
- 字面loopback IP（127.0.0.1或[::1]）严格校验，localhost/DNS别名/非loopback/路径/凭据URL拒绝，HTTP重定向拒绝。
- 健康检查1500ms、缓存10s；普通读30s、平台70s；网络或源不可用返回unavailable，不抛未处理异常。
- 普通只读本地HTTP识别限流与≤5秒冷却，可等一次；**平台请求绝不自动重试**，因requestId历史回放和不确定性；平台429由core安排新的只读核实操作。平台timeout/不完整/代理5xx => unknown，禁止重写。
- TaskBroker constructor(client, mappingStore, {audit?,now?})；getStoreTask(storeId)，getListingTask({storeId,collectedItemId,skuScope,instruction?})；返回raw `{taskId,task,created,reused,skuScope?}`。requestId(kind,operationId,seq=0)既可独立函数也可broker方法。
- 上述HTTP写能力仅定义代码及合成测试，未对真实业务执行。无原生/MCP并行实现。
