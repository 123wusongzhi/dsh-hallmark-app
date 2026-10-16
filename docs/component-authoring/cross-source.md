# 组合数据源、组件与模板复用

组合查询仍使用标准 `DatasetBinding`。跨接口读取、商品身份关联、聚合和游标由 `hallmark.ozon.compose` 负责；原生工作台与源码不另建查询协议。

体验遵循[统一用户偏好](user-preferences.md)：优先完整逻辑结果与本地分页，先显示上次成功完整快照，15 分钟到期或手动刷新在后台进行。组合源的批次、完整性与原子替换由 Provider 负责；能力暂只提供游标页时明确范围，不把第一页称作全量。

## Agent 工作流

1. `list_materials`、`list_data_sources(appId="hallmark")`、`list_saved` 发现现有素材、定义和保存内容。
2. 优先使用已保存定义。需要补充字段时，查看 `hallmark.ozon.compose` 的最新 descriptor，使用登记的稳定字段 key；`recipe:{version:1,grain:"product"|"posting",fields:[...]}` 保存到数据源 `input.recipe`。商品与订单的名称、价格可能拥有相同 role，但字段 key 不同，必须保留各自含义。
3. `validate_data_source` 和 `register_data_source` 传 `{definition,expectedRevision,context:{storeId},params}`。本次店铺、日期和仓库是独立输入；不要冻结到共享定义。登记会再次真实验证，只有验证成功才保存版本。输出有明确 schema 的真实空数组可验证；未知字段映射不能借空数据确认。
4. `resolve_data_source` 传 `{id,revision,bindingId:"main",context,params}`，返回 `{binding,sourceRef,rowsPath,fieldMap,fieldMeta}`。解析只校验调用配置，不代替真实读取或验证。不得覆盖定义中的 recipe、能力路由或店铺参数。
5. `render_view` 或 `apps.authoring.begin` 传 `sourceRefs:{main:sourceRef},context`，服务端解析绑定。源码复杂交互才初始化工程；显示列或密度修改直接复用原生素材。

## 保存与换店

组件和模板保存 `sourceRefs`，锁定 `id + revision`。定义更新后旧组件保持原版本，需明确重新配置才能升级。

- `open_component({componentId,context:{storeId}})`：在新工作副本中复用。
- `render_view({title,templateId,context:{storeId}})`：从模板创建新视图。
- `apps.authoring.begin({mode:"open_saved",componentId,context:{storeId}})`：复用源码并进入编辑。

切店保留布局与日期，移除旧店铺 SKU、商品、仓库、活动、包裹、售后和分页身份。需要这些筛选的查询重新选择后再读；不能携带旧身份查询另一店铺。没有 sourceRefs 的历史组件仍可打开；切店仅重写明确声明的 storeId 查询并校验，不能安全转换时报告错误。未切店的历史组件允许离线展示已有快照。

同一源码构建和锁定数据定义只换店不需要重建代码；改 recipe、源版本、设计或业务参数仍需按既有流程验证。源代码构建验证和实时数据成功是不同证据。

## 源码入口

`useApps` 来自 `@dsh/apps-component-runtime/apps/react`。`data.bindings` 中每项包含当前 payload、查询、状态、版本和来源；`readBindingPage` 更新当前 iframe 的绑定页，`refresh` 重新读取首屏。

组合结果的 `payload.cache.nextRefreshAt` 是下次读取时间，`cache.refreshing` 表明后台更新尚未完成。`useApps` 在页面可见时自动按此时间读取绑定，隐藏时暂停，恢复可见后补读；自动请求使用 `forceRefresh:false`，遵守 Provider 的缓存和限流退避。用户点击「立即更新」调用 `apps.refresh(["main"])`，默认传 `forceRefresh:true`，要求 Provider 后台重新读取。此控制只作用于本次调用，不写入数据源定义或改变 datasetId。用 `apps.refreshing` 显示轻量状态并继续渲染 `apps.data`；`apps.loading` 仅用于首次准备。请求不会由自动定时器重叠发起，失败保留已有数据并暴露 `apps.error`。完整快照保留兼容的本地分页状态；服务端分页降级时，绑定回到第一页需同步本地页码。

SDK 数据请求和预览允许最长 150 秒，以覆盖组合接口的 120 秒执行窗口；握手、上下文等交互仍保留原来的短超时。自动刷新和源码预览都不替代真实成功证据。

已登记组合源的 `payload.items` 是按来源命名的对象，例如 `row.products.title`、`row.prices.price`，而 `payload.fieldMeta` 保存 `products.title` / `prices.price` 等稳定路径。金额按自身来源的币种显示，缺失保持未知，不能自行猜币种或把未知当 0。

直接使用 starter `--template composed-table` 的[可运行示例](examples/composed-table/README.md)，其首次读取、刷新和分页均调用宿主绑定，不包含 HTTP、密钥或重复关联逻辑。
