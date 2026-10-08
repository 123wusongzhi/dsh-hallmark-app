# 加载、刷新与分页

从组件库打开已保存组件、重开编辑或使用模板时，宿主沿用保存的精确 `appId + connectionId`，并为当前聊天启用这些已有连接引用；不会选择默认连接、迁移凭据或改变其他聊天的绑定。连接已删除或全局停用时，打开会先给出恢复/启用指引，不创建工作副本。新聊天沿用保存的查询条件，翻页和刷新使用当前聊天身份。

- `useApps` 建立桥接并读取 getData。它不会因为 binding.state 为 empty 就自动查询业务数据。
- 首次得到 empty binding 时调用一次 `refresh([bindingId])`。用 ref 记住已初始化的 binding，失败显示错误和重试按钮，不建立循环重试。
- `refresh([bindingId])` 读取绑定的基础查询并更新 apps.data；示例回到第一页，清空游标历史。
- `readBindingPage(bindingId, nextCursor)` 沿用绑定的条件、字段和页大小，只更换 cursor；payload/resources/revision 一起更新到 apps.data。
- 上一页使用组件保存的已访问游标；不要从页码猜服务端 cursor。第一页传 null。
- 分页或快照重读期间避免同类请求竞争，成功后再更新页码，失败保留当前页并展示错误。耗时平台同步使用独立 busy 状态并合并重复同步，不阻塞旧快照搜索和翻页；同步成功后等待在途分页结束，再 refresh 并明确回到第一页。
- 搜索、排序、统计如果仅针对本页，界面写明“当前页”。全局筛选必须由已支持的业务查询能力完成。

`invokeCapability` 用于独立查询或明确提供的平台同步能力；列表分页统一使用 readBindingPage，不自行拼接接口结果。

分页 payload/resources/revision 按组件实例保存在 Runtime，getData 对同一实例返回当前页；不修改共享绑定的基础查询，也不影响其他窗口。Agent 普通读取视图绑定仍读取基础快照，不会自动获得侧边栏当前页；不得声称 Agent 已看到用户翻页后的内容。附加到聊天暂未开放。

“刷新快照”不等于触发外部平台同步。显示 sourceDataTime；只有真实业务能力明确提供平台同步时才承诺实时同步。

## 保存与历史

用户明确要求保存后，调用 `apps.authoring.save_component`，携带当前 `viewId` 和 `expectedViewRevision`。从组件库普通打开或重开编辑的已验证组件，如果当前构建、设计和绑定定义与保存版本一致，可以直接保存；仅刷新数据或翻页不要求重新构建、预览、发布。未发布的源码编辑不会被保存为新设计；要保存这些修改，先完成检查与发布。新发布仍在加载时，等待展示确认后再保存。

`update` 使用当前工作副本的 `sourceComponentId` 和 `baseRevision`。成功回执 `component.view` 给出新的目标和基线，后续保存继续使用它；`save_as` 成功后更新目标是新组件。不要继续使用打开时的旧基线，也不要自行读取库中最新版本来提高旧副本的预期版本。

`selectedSourceRevision` 保留选中的历史版本，`baseRevisionAtOpen` 保留打开时库中最新版本。它们用于说明来源，当前更新基线以 `baseRevision` 为准。未改的历史版本可直接保存为新增版本；只有修改设计时才重走检查发布，旧版本不被覆盖。其他旧工作副本发生冲突时，保留它并让用户查看最新版或另存。
