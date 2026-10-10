# 跨接口组合源码示例

数据体验以[统一用户偏好](../../user-preferences.md)为准：优先完整逻辑快照、本地分页搜索排序与 15 分钟后台刷新。此示例保留宿主游标分页协议用于兼容；采用返回完整快照的能力时改为本地分页，不能仅改标题就声称全量。后台更新用 `apps.refreshing` 表达，并继续渲染 `apps.data`；首次无快照才使用 `apps.loading`。

此示例直接显示工作台使用的 `hallmark.ozon.compose` 封装结果。表头、来源、币种和单位取自同一个结果中的 `fieldMeta`，不自行请求 Ozon，也不在前端重复关联接口。未知值显示「暂缺」，上游警告保留在「数据说明」。

1. 调用 `apps.presentation.list_data_sources` 查找已登记的组合定义，锁定其 `id` 和 `revision`。
2. 调用 `apps.presentation.resolve_data_source`，传 `bindingId:"main"`、`context:{storeId:"目标店铺"}` 和 `params:{dateFrom:"…",dateTo:"…",limit:1}`。返回数据结构和所用币种应来自实际定义；示例日期不能照抄。
3. `apps.authoring.begin` 传 `mode:"new"`、`sourceRefs:{main:resolve结果.sourceRef}`、同一 `context`。无需手抄 capability 或 recipe。
4. 使用宿主返回的 `starterPath`：`node <starterPath> --directory <draft.workspacePath> --sdk <sdkDirectory> --template composed-table`。
5. 在项目中 `npm install`，保留锁文件，执行既有 check runner 的 build → live_readonly preview → record 流程。示例预览验证首屏、下一页、上一页、刷新，所选条件必须实际返回至少两行；真实空数据应保留空态，按实际功能修改检查计划，不能造数据通过翻页验证。
6. 按原流程 publish，查看确认结果后保存。已保存组件在另一店铺打开时传 `context`，复用代码与锁定数据定义。

`useApps().data` 是宿主绑定包；`composedData` 只读取 `main.payload`。刷新走 `apps.refresh(["main"])`，翻页走 `apps.readBindingPage("main", cursor)`；单独 `invokeCapability` 不会替换绑定页，不用于这里的分页。

页面可见时 SDK 按 Provider 的缓存期限自动更新；隐藏时暂停，恢复可见后补读。手动「立即更新」绕过正常 TTL，但尊重上游失败与限流保护。源码仅消费数据时间、缓存状态和错误，不维护另一套 Ozon 缓存。
