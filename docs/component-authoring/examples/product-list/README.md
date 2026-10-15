# 分页商品列表示例

默认每个展示页最多渲染 20 行；收到大快照也不会把全部商品一次挂到 DOM。搜索在当前已读取结果中进行，再本地分页。首批没有下一游标、且 `total` 等于已读取数量时才显示“当前完整结果”；其他情况明确标注已读取范围。新组件遵循[统一用户偏好](../../user-preferences.md)，优先使用 Provider 的完整逻辑快照，不能把单个响应直接称作全量。

运行 Host 的 starterPath：`--directory <begin.workspacePath> --sdk <sdkDirectory> --template product-list`。示例覆盖生成的 main.tsx/style.css，同时生成 .preview/plan.json；随后正常安装依赖和检查。它是可编辑源码，不是另一套组件框架。

begin.bindings 使用一条明确店铺的绑定：

```json
{"bindingId":"products","appId":"hallmark","connectionId":"<真实连接>","capabilityId":"hallmark.products.list","capabilityMajor":1,"input":{"storeId":"<真实店铺>","limit":20,"fields":["title","imageUrl","sku","currency","pricing","profit"]},"projection":[],"refresh":{"mode":"manual"}}
```

先用少量样本确认字段。示例展示当前页采购成本、实际售价与参考利润率，不包含额外试算或业务写入。

`list_store_products` / `hallmark.products.list` 支持可选 `status` 精确筛选：只与源数据顶层 `row.status` 精确相等，缺失状态不匹配，不翻译或推断状态。仅在售绑定设置 `input.status: "on_sale"`；`query` 只做全文搜索，与 `status` 条件取交集，`total` 是过滤后的总数。接口探索只读少量样本；正式全量采集与筛选由 Provider 负责，不让 Agent 或组件自行 HTTP 遍历拼接。

.preview/plan.json 保留首屏、搜索、翻至第 2 页、返回第 1 页和刷新检查，假设存在至少两个本地展示页或服务端数据页。按真实数据调整计划；单页时删除不可执行的翻页步骤，不编造数据。已确认游标分页的计划可在 requiredMethods 加入 readBindingPage；完整快照只需本地翻页。附加到聊天暂未开放，分页不自动更新 Agent 上下文。

示例只主动发起一次初始刷新；支持缓存元数据的数据源由 SDK 根据 `cache.refreshing` / `nextRefreshAt` 自动续读。手动刷新使用同一绑定，后台更新保留当前数据与操作；不额外实现竞争定时器。服务端游标分页仍通过“上一批 / 下一批”调用 readBindingPage；大批次另外提供批内本地分页，两者不混称。失败保留当前页与游标，连续点击刷新/下一批只发送一个请求；搜索和本地翻页不发请求，后台刷新期间仍可操作。

只维护 `.preview/plan.json`；用 Host checkRunner.prepareRequest 自动准备检查请求，禁止把请求放在源码根目录。默认只做用户要求的字段，不增加页级利润汇总。使用 `npm install` 生成一个锁文件；若使用 pnpm，应在项目内明确允许 esbuild 所需安装脚本，不反复更换包管理器。

商品图片实际通过生成的 `Image` 渲染，固定 48×48 位置；当前展示页前 6 图为 eager/high；helper 根据实际视口把其他首屏图片设为 eager/auto，屏外保留 lazy/auto，全部异步解码。helper 按 fetchpriority → loading → src 设置属性，失败显示占位，URL 变化重新尝试。每行带 `data-product-row`，供预览检查统计首屏挂载数量。不得改为全表 high、用原始数据下标判断优先级，或只生成 helper 却直接写 img 绕过它。
