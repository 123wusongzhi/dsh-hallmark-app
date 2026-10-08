# 组件开发入口

这是随当前插件交付的协议说明和创作流程。历史聊天、旧临时 JSON、旧工程 README 不作为新组件接口依据。

## 先选现有入口

- 用户要打开已有组件：使用 `apps.presentation.open_component`，返回的工作副本属于当前会话。仅查看、搜索、翻页、刷新数据无需初始化工程、构建或预览。
- 用户要保存或另存当前已有组件：源码构建、设计和绑定定义未变时，直接 `apps.authoring.save_component`；无需为保存而重新构建或发布。连续更新使用上次成功回执的 `view.sourceComponentId` 和 `view.baseRevision`，详见 [保存与历史](lifecycle.md#保存与历史)。
- 用户要使用已有模板：使用 `apps.presentation.render_view` 的 `templateId`，复用已有设计和绑定。连接的复用与不可用提示见 [加载与复用](lifecycle.md)。
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
| getData / payload / resources / revision / 商品金额单位 | [data.md](data.md) |
| 首次加载、刷新、当前页、保存与历史 | [lifecycle.md](lifecycle.md) |
| 检查请求、Windows 启动、续跑、截图、发布 | [check-and-publish.md](check-and-publish.md) |
| 可直接初始化的分页商品列表 | [示例说明](examples/product-list/README.md) |

业务字段以当前 capability descriptor 和少量真实样本为准。只有遇到文档未覆盖的具体错误时才调查实现；不预先编写探测脚本或自建截图 Host。
