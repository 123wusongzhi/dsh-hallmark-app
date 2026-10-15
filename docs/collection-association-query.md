# 采集商品与销售商品的精确关联查询

## 调用链

已知采集商品 ID：直接调用 hallmark.collection.associations，input 为 {id, storeId}。
只有名称：collection.search 定位准确商品 ID 一次，再调用 associations。搜索结果中的 associationLookup 指向该入口。

关联只来自指定店铺中持久化的 sources.productId / 采购绑定，不用标题、型号、图片或货号前缀推断。结果返回去重的 offerId、平台 productId、来源 SKU/组合数量、当前销售状态、观察时间和新鲜度。默认复用 5 分钟内平台观察，refresh:true 可显式刷新一次；分页照 continuation.input，不再次做业务搜索。

## 结果口径

- linked_offers：存在精确商品关联；是否在售另看 currentSale 和 offers[].saleState。
- saved_listing_only：仅有保存的上品记录，不代表成功上架。
- unresolved_history：未找到精确关联且历史关联不完整，不得声称从未上架。
- unavailable：状态/历史记录查询未完成。
- no_linked_record：当前核实的目录没有关联，不证明平台历史从未上架。
- currentSale=unknown：包括过期观察、刷新失败或关联覆盖不完整；不降级成“未在售”。

响应总量限制为 14 KiB，分页绑定商品、店铺和证据版本。跨店铺/连接、来源身份变更、错误 cursor 均拒绝。工具不加载采集详情、不执行关键词扫描、不修改采购关联或平台商品。

## 验证（2026-10-15）

109 项相关测试通过（含 Runtime 注册/输入校验/刷新复用/刷新失败/连接隔离和分页）；TypeScript 检查通过。
只读当前数据库回放 test1 的三个商品：
- 5.08mm 来源商品 1ba4d612-51b7-4f47-8a1c-488051141a79：一次返回 11 条 2EDGK508 销售关联，约 5.6 KiB。
- 5.0mm 来源商品 645255b6-6e38-4dd3-ba15-83715d45fea2：unresolved_history，不能声称从未发过。
- HM04 来源商品 472406fb-f23b-4cb8-a6a6-8482a31f8c9c：同样保留 unresolved_history。

后续源码审查已补齐 5 个新增测试的分类，全库数据审计通过；另补充拒绝解码为 null、数组或基本类型的关联 cursor，统一返回 COLLECTION_CURSOR_INVALID。最新完整验证见 [源码审查记录](source-review-20261015.md)。构建包不等于已安装：本次生成 bundle，未替换运行中的桌面插件。
