# Task 19：类目只读工具与可恢复数据集

日期：2026-10-06。此记录对应本轮源码；未安装、发布、重启 DSH，未执行真实 Hallmark 或平台写。

## 已接通

- `hallmark_get_category_data` 已在 Core 分派 `search / show / template / values / validate_value / sync` 六模式。`sync` 仅调用已有 Source 类目缓存同步，不调用商品同步、任务创建或业务写。
- 执行前复用 `categoryRequest` 的模式字段白名单、规范正整数 ID、有界查询与通配拒绝；缺必要参数或店铺歧义返回澄清。
- `category:<sha256>` 基于实际规范请求的方法、完整端点和请求体，隔离店铺、模式、类目、类型、属性、字典值、字典、关键词、限制与 aspects。等价默认值/空白不制造重复键。
- 工具返回 `datasetKey`、`query` 和 `raw`；原数据较大时返回 spill，SQLite 快照 payload 仍保留完整原文。`ok` 只代表请求成功，原 `partial / stale / complete / candidates` 等字段保留，不能当作允许值证明。
- `dataTime` 只取原响应 `fetchedAt / treeFetchedAt`。没有源时间则保持未知，不使用本次读取时间替代。
- 快照 `sourceQuery` 保存固定只读配方；不会隐式创建常用入口、组件或用户保存查询。已明确保存的 `query:` 配方也可恢复。刷新再次严格校验，直接快照须校验配方与数据集键一致。
- 失败保留最后成功 payload、版本和源时间，透传冷却信息。后台只调用固定类目能力，不通过任意工具名动态分派。

## 同轮必要连接

- `hallmark_search_collected_items` 返回 `collected:<sha256>` 数据集键，快照 payload 是有界源摘要页 `{items,total,cursor?}`，保留源 item ID 和 provenance endpoint `/api/items`。不同关键词/页码/页大小隔离；保持源顺序，不承诺按采集时间排序。
- 采集摘要快照可直接绑定表格并经固定只读配方恢复刷新。无新采集、无店铺默认选择、无业务写；过大数据仍保留 spill。
- 新增 `hallmark_open_component`：从持久保存配置复制新草稿并登记本会话归属。返回 `viewId/spec/sourceComponentId/baseRevision`。返回前按权威操作账本检查私有 operation 绑定，拒绝跨会话泄漏。
- `hallmark_save_component` 接入 `save_as / update` 与 `componentId / expectedRevision`；`update` 要求当前会话拥有草稿。保存请求原话守卫保留。
- `hallmark_manage_saved` 接入 `pin + pinned:boolean`；仅用于配置入口。
- 工具广告测试按实际定义比对，并显式检查类目与打开组件工具，避免陈旧的 23 工具断言。目前这组改动使契约定义为 25 项，运行中旧版本工具数另行核实。

## 本轮合成证据

执行：`node --test test/core/*.test.ts test/adapter/category-archive.test.ts test/contracts/serialization.test.ts`

结果：**187 / 187 通过**。日志：[task19-core-regression.log](../artifacts/task19-core-regression.log)。包括六模式、缺字段/非法范围/歧义、精确键、原字段与时间保留、spill、失败保留、SQLite 实际关闭重开、已保存配方、采集快照、跨会话打开隔离、版本冲突、pin 与既有 Core 写安全回归。

`pnpm typecheck` 在本组源码和测试完成后通过。

这不是全项目最终回归、真实 Source 类目验收、DSH 原 GUI 交互验收或生产业务验收。类目渲染仍须遵循原响应字段结构；实时类目候选是否适用需真实 Source 能力与校验结果证明。
