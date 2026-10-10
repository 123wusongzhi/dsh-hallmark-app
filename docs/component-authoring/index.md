# 组件开发入口

这是随当前插件交付的协议说明和创作流程。历史聊天、旧临时 JSON、旧工程 README 不作为新组件接口依据。

先遵循[组件体验与用户偏好](user-preferences.md)：蓝白简洁、中文业务字段、共享数据源与店铺分离、跨接口组合；优先全量逻辑数据、本地分页搜索排序。每次先显示上次成功完整快照，默认有效期 15 分钟，到期或手动刷新都在后台。首次无快照、权限隔离和接口能力不足按该政策处理，不能虚构“完整”或“实时”。Host 已通过 `authoringInstructions.userPreferences` 直接提供核心规则，完整政策路径见 `developerDocs.userPreferences`。

## 先选现有入口

- 用户要打开已有组件：使用 `apps.presentation.open_component`，返回的工作副本属于当前会话。仅查看、搜索、翻页、刷新数据无需初始化工程、构建或预览。
- 用户要保存或另存当前已有组件：源码构建、设计和绑定定义未变时，直接 `apps.authoring.save_component`；无需为保存而重新构建或发布。连续更新使用上次成功回执的 `view.sourceComponentId` 和 `view.baseRevision`，详见 [保存与历史](lifecycle.md#保存与历史)。
- 用户要使用已有模板：使用 `apps.presentation.render_view` 的 `templateId`，复用已有设计和绑定。连接的复用与不可用提示见 [加载与复用](lifecycle.md)。
- 已登记数据源先用 `apps.presentation.resolve_data_source` 解析 `id + revision + context + params`，把返回的 `sourceRef` 放入 `render_view` / `authoring.begin` 的 `sourceRefs`。保存组件和模板后，打开传目标 `context` 即可换店使用同一版本；共享定义不保存店铺。详见 [跨接口复用](cross-source.md)。
- 用户要修改已有组件的源码或增加新交互：使用 `apps.authoring.begin` 的 `edit` / `open_saved`，继续原工程，再走下方检查发布流程。
- 没有合适的已有组件或模板时，才开始新源码工程。修改绑定定义后需验证新的真实查询并发布；不要把修改前的展示或回执当作新绑定的验证结果。

## 源码创作流程

1. `apps_describe` 查精确能力版本；明确连接、店铺后读取 1～5 条业务样本。字段不够再补查，不为了解接口遍历全店。
2. `apps.authoring.begin`（appId `apps`，connectionId `presentation`）传入真实 bindings，保留返回的 workspacePath、attemptId、epoch、sourceRevision、viewRevision。
3. 用 Host 返回的 starterPath 和 sdkDirectory 初始化空工程。商品列表加 `--template product-list`；安装依赖，按用户需求修改源码。
4. 按 [数据结构](data.md) 和 [加载与分页](lifecycle.md) 使用 `useApps`。无需读取预览器内部代码或旧临时数据来推测协议。
5. 使用 `checkRunner.prepareRequest` 填 attemptId 并运行，自动生成源码目录之外的请求，再执行返回的 requestPath；只维护 `.preview/plan.json`；Windows 优先 windowsCommand。见 [检查与发布](check-and-publish.md)。
6. 读检查摘要和必要截图。存在具体失败或可见缺陷才修改；通过后 publish，再 inspect.summary 确认展示。

## 按需索引

| 内容 | 文档 |
| --- | --- |
| 用户偏好、完整快照、15 分钟后台刷新与能力边界 | [user-preferences.md](user-preferences.md) |
| getData / payload / resources / revision / 商品金额单位 | [data.md](data.md) |
| 快照优先、首次准备、刷新、分页降级、保存与历史 | [lifecycle.md](lifecycle.md) |
| 检查请求、Windows 启动、续跑、截图、发布 | [check-and-publish.md](check-and-publish.md) |
| 显式阶段重试、构建环境依赖、单视口草稿诊断 | [performance-cli.md](performance-cli.md) |
| 可直接初始化的分页商品列表 | [示例说明](examples/product-list/README.md) |
| Agent 组合源、锁定版本、模板切店与源码消费 | [跨接口复用](cross-source.md) |
| 可直接初始化的跨接口数据表 | [组合表示例](examples/composed-table/README.md) |

业务字段以当前 capability descriptor 和少量真实样本为准。只有遇到文档未覆盖的具体错误时才调查实现；不预先编写探测脚本或自建截图 Host。
