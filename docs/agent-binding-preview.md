# Binding 查询信息与正式预览

> 当前产品范围（2026-10-08）：附加到聊天暂未开放，原生 Apps Host 拒绝附加请求；新商品组件不生成选择与附加入口。列表统一使用 `readBindingPage`，详见 [分页契约](component-authoring/lifecycle.md)。以下保留早期修补记录，其中附加预览仅代表资源校验，不代表当前产品开放该功能。

本修补只解决调用信息和验证契约，不实现跨页选择、业务分页快照更新或自动创作循环。

## 查询信息

getData 的每个 binding 新增可选 query：appId、connectionId、capabilityId、capabilityVersion、input、projection。精确版本来自 Runtime 目录，input 和 projection 来自绑定定义。没有快照时仍返回 query；能力不可解析或主版本不匹配时不返回 query，但保留已有快照数据。

SDK 导出 BindingQuery 类型，starter 提供 src/bindingRequest.ts：

```ts
const result = await apps.invokeCapability(
  bindingRequest(binding.query, {cursor: nextCursor, limit: 60})
);
```

projection 不属于 invokeCapability 请求。组件按实际能力返回结构处理 result，不能从 payload 猜路由。新页资源不会自动加入绑定快照；下一页附加仍可能返回 SELECTION_STALE，此修补让预览如实暴露这个问题。

## 真实只读预览

在原 preview request 中使用：

```json
{
  "mode": "live_readonly",
  "sessionId": "<begin 所属会话>",
  "viewId": "<begin.view.viewId>",
  "runtime": {"url": "<guidance.runtime.url>", "keyFile": "<guidance.runtime.keyFile>"},
  "requiredMethods": ["invokeCapability", "attachSelection"]
}
```

继续携带现有 attempt/epoch/buildReceiptId/buildReportRef/archiveRoot/evidenceRoot 和 assertions。runner 自动从 Runtime 读取当前 view 数据，忽略手工 data；refresh 复用绑定刷新，invokeCapability 调用已绑定连接上的 query/compute 能力；选择使用宿主校验，预览不向聊天实际附加。

内部 POST /v1/authoring/preview 使用既有本机认证，参数为 sessionId 与 params:{viewId,action,...}。action 为 data、refresh、invoke、selection。无需直接读数据库或手动构造 Runtime 调用身份。

## 离线夹具预览

fixture data 应保留真实 getData 结构。capabilityFixtures 为 [{request,result}]，request 是精确的 invokeCapability 参数，result 是实际 CapabilityResult 形状。只有配置了对应请求才返回夹具结果，不能无条件返回第一页。refreshData 可显式配置刷新后的 viewData，不配置就报告该功能未验证。

requiredMethods 声明关键桥接调用；未执行成功的必需调用产生 NOT_RUN，缺少回调/夹具产生 BLOCKED，整体为 INCOMPLETE。实际资源验证或能力执行失败产生失败记录，页面自行 catch 也不会变成 PASS。既有真实鼠标、键盘、截图检查继续保留；异步交互结果最多等待 5 秒，提前满足立即继续。

## 已验证与限制

- query 与 payload 分离；空快照可提供查询配置，读取不可改变持久绑定。
- 隔离 Runtime 的真实预览适配器支持第二页查询、刷新和当前快照选择验证。
- 正式浏览器 runner 能使用 binding.query 请求下一页；缺少调用路径返回 INCOMPLETE。
- 下一页资源未进入快照时附加失败，即使组件显示“已处理失败”也不通过完整验证。

未执行已安装 DSH 的桌面验收。未修改既有组件，也未安装插件。已有旧组件不会自动使用新增 query，需按示例更新其数据接入代码。
