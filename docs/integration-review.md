# 跨模块 HTTP 合成验收与安全审查

## 结论与验证层级

本轮采用真实 TCP/HTTP、真实 HallmarkClient/TaskBroker、真实 SQLite AppStore、AppCore、PresentationManager 和 AppServer 串联，**不是用 fake CoreClient 代替适配层**。原 Hallmark 源用合成HTTP服务替身；该替身、应用服务均绑定随机高位 `127.0.0.1` 端口，SQLite/spill仅保存在测试临时目录。

- 未修改/启动原项目，未访问真实平台写接口，未读取原平台凭据或令牌文件。
- 合成夹具的图片域名为 example.invalid；不声称图片实际可达、Ozon实际接受或商品实际上架。
- 本轮最终集成测试 **22/22 通过**（19项业务/持久化 + 3项UI边界），无跳过项。
- 本机4173原Hallmark离线，真实店铺/真实上品验收仍待用户环境。
- 此审查覆盖接入服务与UI API安全边界，**不等于DSH真实桌面交互、插件HMR、七组件视觉/无障碍验收**。官方hello现场结果另由Lead记录。

## 可复现材料

- [合成HTTP与真实模块装配](<../test/integration/harness.ts>)：隔离源服务、严格协议断言、平台requestId回放、未知结果、SQLite重开、临时目录清理。源协议断言错误单独记录并在收尾断言，不能被误当正常unknown而让测试假绿。
- [业务与持久化HTTP集成测试](<../test/integration/http-e2e.test.ts>)：19项。
- [未激活聊天的UI HTTP审查](<../test/integration/ui-http.test.ts>)：3项。

运行（使用 load_workspace_dependencies 提供的 Node ≥22.18）：

```powershell
& $node --test test/integration/http-e2e.test.ts test/integration/ui-http.test.ts
```

Windows端口0可能分配fetch的WHATWG禁用端口；高随机端口也可能落入系统保留范围。测试仅在20000–59999随机选择本机空闲端口，跳过EADDRINUSE/EACCES系统保留，不影响既有19387/4173/4180服务；未申请权限提升。失败前置路径也清理本测试创建的目录。

## 验收覆盖

| 检查 | 已核实的合成行为 |
|---|---|
| 认证、聊天激活、重开 | 无Bearer或非信任Origin被拒；未激活会话不能调用业务；激活写入SQLite，服务重开后持续可用，关闭后再次拒绝 |
| 会话隔离 | 另一个已激活会话不能读取原操作、抢用幂等键或列出原会话操作；不额外调用平台 |
| 源字段与分页 | 产品260条，指定店铺后100/100分页，每条未来字段原样；二页读取本地成功快照。采集搜索250条按query再100条分页，不返回不匹配候选 |
| 真正采集raw | 确实调用`/items/:id/raw?full=1`；id/content/truncated逐字段保留，无源时间则不造dataTime |
| 利润 | 使用源profit参考模型，缺costMinor单列无法判断；不把缺成本当零，标注非实际结算。结果集完整259条持久化，仅200条预览，并带完整计数/截断标记 |
| 临时/保存/入口 | render不自动存入口；保存必须有明确原话，存设计与绑定；打开/查询不会触发业务写 |
| 刷新隔离 | 工具刷新、HTTP主动刷新、后台刷新只走全店sync和本地读；失败保留旧payload与lastSuccessAt；保存组件设计不被刷新重做 |
| 源时间 | 源缺lastSuccessAt/dataTime时，首次产品查询、结果集、主动刷新、SQLite重开均保持null或缺字段；本次fetchedAt与缓存成功时间不冒充源时间 |
| 写入前澄清 | 含糊店铺、无明确上品范围、不规范仓库ID、未知店铺无Listing、读工具中写端点均拒绝或澄清；不会随机采集商品建任务 |
| 价格/库存 | 一次明确price普通价写入后回读同Offer与币种；库存0有效，具体仓库12精确回读。每个操作一笔业务写，重开后相同幂等键不重写 |
| 回读证据完整 | 只有数字价格没有要求币种保持unknown；Offer字符串1不等于平台product_id数值1，不能错误匹配另一个商品 |
| unknown | 断回执后跨重开、同键、新键均不能重写；操作查询只发新身份的只读核实，平台达到目标后可读证据结束unknown |
| 受控上品导入 | 完整importItems由明确item-A/sku-A与可追溯源图校验，内部assignment只创建一次，显式skuCode→offerId mappings，平台body去掉内部_sourceSkuId；同键重开不重导入 |
| 上品前置与处理中 | 缺类目、未追溯图片先阻止，尚未创建assignment；导入pending保持unknown，状态查询不重写 |
| 大数据 | 128KiB采集raw完整落spill，HTTP工具仅输出summary/file/cursor引用，不再次内联全原文；文件内容与源完整原文一致 |
| saved query注入 | 写工具不能作为展示binding保存；即使遗留存储里有写query，后台刷新也拒绝，绝不调用任意工具 |
| 活动调价 | 当前明确unavailable且零写入，不能拿普通售价回读冒充活动价核实 |
| UI独立能力 | 认证UI可render/update/显式save/open/reopen，不创建session_apps状态；未选应用的聊天仍APP_NOT_ACTIVE |
| UI安全边界 | tool/arguments注入、写query、apiKey字段、prototype JSON Patch均拒绝；UI refresh委派隔离的只读后台刷新，chat持续inactive |

## 本轮发现并修复的缺陷

修复由各自模块所有者完成，审查者只修改integration测试与本文档。

1. **采集搜索忽略过滤候选**：HallmarkClient保持完整raw并返回matches，core曾只包装raw导致用户query拿到所有采集商品。修为明确匹配候选，并补cursor/limit分页；[dispatch](<../packages/core/src/index.ts>)。
2. **平台币种未取得却标成功**：旧逻辑允许`!currency`，价格数字相等就succeeded；修为要求同币种，否则unknown；[回读实现](<../packages/core/src/write.ts>)。
3. **spill只是附件但继续内联全raw**：旧ToolResult仍携带大原文，突破上下文边界；修为工具只输出spill引用。内部仍保留完整raw用于计算；[包装](<../packages/core/src/types.ts>)。
4. **未知店铺刷新伪成功**：源快照没有对应stores条目时曾发布空成功快照；修为STORE_NOT_FOUND，禁止把不存在的数据集当刚更新成功；[刷新](<../packages/core/src/refresh.ts>)。
5. **源时间伪造**：此前get snapshot/refresh fallback now生成源dataTime。core-owner在审查期间改为nullable sourceTime；HTTP断言覆盖查询/刷新/结果集/重开四个路径。
6. **ID域/仓库/活动语义防护**：owner补严格Offer与ProductId身份域、不规范仓库澄清、活动价明确暂不可用；新增HTTP负面验证防回归。

## 尚未达到的业务验收与产品缺口

### 上品“导入成功”不等于“可售完成”

当前`verifyListing`以`/v1/product/import/info`单项`status='imported'`且product_id有效作为导入达成，并明确输出`data.acceptance='imported-not-sellable-verified'`。这证明导入结果，不证明：

- 商品`on_sale`、精确价格/币种/属性符合用户所有验收目标；
- 用户要求的库存已经写入并在精确仓库回读；
- 源图片URL真实可访问、全部素材交付完成、实际平台内容/类目正确；
- 原四工具agent_prepare/deliver_assets/submit/inspect完成。

因此，19项业务集成测试中的上品项应称为**“受控采集来源导入链路合成通过”**，不可称真实完整上品验收。后续需要按用户目标补明确Offer平台只读回查、库存链路与真实测试店证据；详见[H1–H5契约](<hallmark-contracts.md>)。

### 其他边界

- 从未有可复用Listing的店铺不能无商品创建通用platform任务；原接口缺口继续TASK_CONTEXT_REQUIRED，不能用隐藏随机选品“解决”。
- **规则解析未接入**：任何未核实的`rule:*`调用都会澄清并阻断写入，不伪造规则真实性；当前写入仅接受用户明确提供且与当前指令一致的值。
- 活动价格/促销报名退出、采购价修改、归档、类目字典、素材交付与其他原项目核心功能尚未完整工具覆盖。当前23工具不是“全部核心功能验收通过”。
- 采集搜索基于现有摘要字段。原摘要没有所有描述/来源URL字段，不能宣称按任意完整原始描述或来源链接搜索都支持。
- profit是模型，不能保证数值与真实结算一致；本轮不是指定真实5商品数值对比。
- UI API合成测试不证明真实桌面sidepanel、toolview渲染、浏览器响应式布局、键盘可达性、主题token或运行bundle安装正确。真实UI验收须另有独立证据。
