# 组件收到的数据

数据展示遵循[统一用户偏好](user-preferences.md)：完整快照优先、15 分钟后台刷新、中文字段与真实缺失。读取下面的协议不代表任一能力已经支持全量，须核实该能力的 schema 和完整性语义。

`useApps().data` 是视图数据包，不是 products 数组：

```ts
{
  viewId: string,
  bindings: [{
    bindingId: string, appId: string, connectionId: string,
    datasetId: string, revision: string | null,
    state: 'empty' | 'preparing' | 'ready' | 'failed' | 'unavailable',
    preparation?: {
      state: 'preparing' | 'ready' | 'failed',
      phase: 'queued' | 'query' | 'settled',
      startedAt: string, finishedAt?: string, elapsedMs: number,
      error?: {code:string, message:string, retryPolicy:string}
    },
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

发布时会异步预热绑定快照；打开请求不等待业务计算。准备任务按会话、视图、发布、数据集和连接配置隔离，同一任务的多个绑定/并发打开不会重复计算。任务状态暂存在 Runtime 内存，`getData` 的 `preparation` 字段可观察开始/结束时间、阶段、耗时和错误；重启后缺失快照可重新准备。`preparing` 的 `payload` 是 null，既不是空结果，也不是成功或错误，不要据此显示“没有商品”或主动反复调用 refresh。

新版 `useApps()` 在准备期间保持 `loading=true`、`preparing=true`，提供 `preparationNotice='数据准备中…'`；以约 1–3 秒退避读取快照，隐藏时暂停，卸载时取消。准备失败保留 `code`、`retryPolicy` 等分类信息，可重试失败默认再试两次（500/1500ms），预算耗尽后上报 `phase:'data'`。首次快照/上下文桥接请求的响应预算是 8 秒；`initialReadRetryDelaysMs` 最多覆盖两次退避、每次最多 5 秒，仍受总就绪预算约束。只有真实数据读取和 React 提交、断言均成功，SDK 才发送 renderReady。父容器对归档的旧 SDK 先等待快照准备完成再创建 iframe，避免旧组件把准备状态当作空数据或已展示。

就绪期限是 **30 秒可见时间没有实质进展**，并有 **自展示打开起 180 秒墙钟绝对上限**；准备与 iframe 加载共享此上限。新桥接握手、绑定阶段/状态/数据修订变化、校验通过且 transferId/index 尚未收到过的非空分块算实质进展；相同成功轮询、重复块、elapsedMs 增长和重试次数本身均不延长期限。Runtime inspect 的 `display_stalled` 截止为 210 秒，预留上报余量；没有 renderReady 时不能称为已展示。
