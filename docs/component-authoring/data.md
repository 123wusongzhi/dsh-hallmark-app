# 组件收到的数据

数据展示遵循[统一用户偏好](user-preferences.md)：完整快照优先、15 分钟后台刷新、中文字段与真实缺失。读取下面的协议不代表任一能力已经支持全量，须核实该能力的 schema 和完整性语义。

`useApps().data` 是视图数据包，不是 products 数组：

```ts
{
  viewId: string,
  bindings: [{
    bindingId: string, appId: string, connectionId: string,
    datasetId: string, revision: string | null,
    state: 'empty' | 'ready' | 'failed' | 'unavailable',
    payload: unknown, resources: ResourceRef[],
    sourceDataTime: string | null, lastSuccessAt: string | null,
    freshness: string, provenance: unknown[], error?: {code:string,message:string},
    query?: {appId, connectionId, capabilityId, capabilityVersion, input, projection}
  }]
}
```

这是字段说明，不是可粘贴的真实数据。bindings 使用 begin 时传入的 bindingId 查找；单绑定示例使用首项。revision 是不透明字符串，分页时可为 `page:…`，不要自行递增或推算。

Hallmark `products.list` 的 payload 包含 products、total、cursor。cursor 是服务端返回的下一页游标；total 是查询总数，不是本页数量，也不自动等于在售总数。空 cursor 表示没有下一页。列表使用 input.fields 精简字段，projection 不负责裁剪商品响应。

商品金额：pricing.sellerMinor 是实际售价，profit.purchaseMinor 是采购成本，均除以 100 显示。profit.actualMargin 是比率，乘以 100 显示百分比。null 显示“—”，不补成 0。price / ordinaryMinor 是标价，不能替代实际售价。利润率是数据源的参考口径，保留 reason，勿称作结算净利润。不同币种不要直接求和。

resources 是当前快照的资源标识。附加到聊天暂未开放，商品组件不提供附加按钮或为附加而设置的勾选入口。

首次无快照且绑定为空时显示轻量准备状态；失败显示原因和重试。已有合法完整快照时后台刷新或临时失败不清空当前内容，保留真实时间；权限失效不能继续暴露旧数据。不要用样本替代正式业务数据。
