# 跨接口组合源码示例

数据体验以[统一用户偏好](../../user-preferences.md)为准。示例默认每个展示页最多挂载 20 行，在已读取快照中搜索后再本地分页；Provider 返回完整结果时不发起远程翻页。只有首批无下一游标且 `total` 等于已读取行数，才显示“当前完整结果”。游标接口保留明确标注的“上一批 / 下一批”，大批次另有批内本地分页，不把当前响应冒充全量。后台更新用 `apps.refreshing` 表达，并继续渲染 `apps.data`；首次无快照才使用 `apps.loading`。

此示例直接显示工作台使用的 `hallmark.ozon.compose` 封装结果。表头、来源、币种和单位取自同一个结果中的 `fieldMeta`，不自行请求 Ozon，也不在前端重复关联接口。未知值显示「暂缺」，上游警告保留在「数据说明」。

1. 调用 `apps.presentation.list_data_sources` 查找已登记的组合定义，锁定其 `id` 和 `revision`。
2. 调用 `apps.presentation.resolve_data_source`，传 `bindingId:"main"`、`context:{storeId:"目标店铺"}` 和 `params:{dateFrom:"…",dateTo:"…",limit:1}`。返回数据结构和所用币种应来自实际定义；示例日期不能照抄。
3. `apps.authoring.begin` 传 `mode:"new"`、`sourceRefs:{main:resolve结果.sourceRef}`、同一 `context`。无需手抄 capability 或 recipe。
4. 使用宿主返回的 `starterPath`：`node <starterPath> --directory <draft.workspacePath> --sdk <sdkDirectory> --template composed-table`。
5. 在项目中 `npm install`，保留锁文件，执行既有 check runner 的 build → live_readonly preview → record 流程。示例预览验证首屏、下一页、上一页、刷新，需要至少两个本地展示页或两个服务端数据页。完整快照下翻页为本地操作；仅实际验证了游标请求时才将 readBindingPage 加入 requiredMethods。真实空数据保留空态；按实际功能修改检查计划，不能造数据通过翻页验证。
6. 按原流程 publish，查看确认结果后保存。已保存组件在另一店铺打开时传 `context`，复用代码与锁定数据定义。

`useApps().data` 是宿主绑定包；`composedData` 只读取 `main.payload`。刷新走 `apps.refresh(["main"])`，翻页走 `apps.readBindingPage("main", cursor)`；单独 `invokeCapability` 不会替换绑定页，不用于这里的分页。

页面可见时 SDK 按 Provider 的缓存期限自动更新；隐藏时暂停，恢复可见后补读。手动「立即更新」绕过正常 TTL，但尊重上游失败与限流保护。源码仅消费数据时间、缓存状态和错误，不维护另一套 Ozon 缓存。

图片列实际使用生成的 `Image` helper，固定 44×44 位置；当前展示页前 6 个图片位置为 eager/high；实际首屏的其他图片为 eager/auto，屏外保留 lazy/auto，全部 async 解码。多图片列合计也只优先 6 图，属性顺序为 fetchpriority → loading → src，失败占位在 URL 变化后恢复重试。商品行同时带 `data-composed-row` 与 `data-product-row`，便于预览检查统计行数。

连续点击刷新或远程翻页由同步 pending 标记去重，失败不推进游标。后台刷新保留内容、搜索和本地页码；仅数据缩短越界时回落。搜索与本地翻页不发请求；不另存跨店铺的旧数据缓存，不覆盖 SDK 的授权失效清理。
