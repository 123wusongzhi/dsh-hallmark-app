# 分页商品列表示例

这是服务端游标分页的兼容示例，不代表新组件的默认数据体验。新组件遵循[统一用户偏好](../../user-preferences.md)：优先完整逻辑快照和本地分页，15 分钟后台刷新，使用 `apps.refreshing` 显示更新状态并保留 `apps.data`。确认所用数据源已经返回完整结果后再改为本地分页，不能把当前页称作全量。

运行 Host 的 starterPath：`--directory <begin.workspacePath> --sdk <sdkDirectory> --template product-list`。示例覆盖生成的 main.tsx/style.css，同时生成 .preview/plan.json；随后正常安装依赖和检查。它是可编辑源码，不是另一套组件框架。

begin.bindings 使用一条明确店铺的绑定：

```json
{"bindingId":"products","appId":"hallmark","connectionId":"<真实连接>","capabilityId":"hallmark.products.list","capabilityMajor":1,"input":{"storeId":"<真实店铺>","limit":20,"fields":["title","sku","currency","pricing","profit"]},"projection":[],"refresh":{"mode":"manual"}}
```

先用少量样本确认字段。示例展示当前页采购成本、实际售价与参考利润率，不包含额外试算或业务写入。

`list_store_products` / `hallmark.products.list` 支持可选 `status` 精确筛选：只与源数据顶层 `row.status` 精确相等，缺失状态不匹配，不翻译或推断状态。仅在售绑定设置 `input.status: "on_sale"`；`query` 只做全文搜索，与 `status` 条件取交集，`total` 是过滤后的总数。接口探索只读少量样本；正式全量采集与筛选由 Provider 负责，不让 Agent 或组件自行 HTTP 遍历拼接。

.preview/plan.json 假设至少两页。按实际数据修改验证计划（单页时不声明 readBindingPage）。附加到聊天暂未开放，示例仅展示、搜索当前页、刷新和翻页。分页不自动更新 Agent 上下文。

示例只主动发起一次初始刷新；支持缓存元数据的数据源由 SDK 根据 `cache.refreshing` / `nextRefreshAt` 自动续读。手动刷新使用同一绑定，后台更新保留当前数据与操作；不额外实现竞争定时器。沿用服务端分页时保留 binding 分页和失败保留当前页的逻辑。

只维护 `.preview/plan.json`；用 Host checkRunner.prepareRequest 自动准备检查请求，禁止把请求放在源码根目录。默认只做用户要求的字段，不增加页级利润汇总。使用 `npm install` 生成一个锁文件；若使用 pnpm，应在项目内明确允许 esbuild 所需安装脚本，不反复更换包管理器。
