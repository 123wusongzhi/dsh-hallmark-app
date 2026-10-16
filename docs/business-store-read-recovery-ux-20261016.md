# 经营操作：店铺连接读取可恢复

基线：9542fb263b66a0f8b65db5aca6c493b337e4d50b。只调整 BusinessOperations 的店铺目录读取状态和恢复入口，不修改业务接口、工作台保存、商家执行或其他页面。

## 已复现的问题

真实生产 React 组件在网络拒绝、HTTP 403、成功空列表、列表不包含已选 storeId 时，均一直显示“正在读取所选店铺的连接…”。错误在仅有 store 才渲染的分支内；唯一“刷新批次”按钮禁用，也不负责目录重试。挂起读取同样没有区域内恢复入口。既有无选店 CTA、有效店铺后的批次/规则报错均正常，未将它们列为缺陷。

## 最小修复

- 显式区分 loading、ready、error。成功空列表和已选 ID 不存在分别解释原因，不断言一定撤权。
- 未解析店铺时提供“重新读取店铺”或“取消并重新读取”，以及原 onChooseStore 的“重新选择店铺”；缺少回调时引导返回工作台。
- 显式重试先 abort 前一读取；同步 500ms 防双击冷却同时覆盖同批处理与分开事件，过期后可再次取消挂起读取。无定时后台重试。
- 聊天/店铺身份变化立即隐藏前一店铺；请求在切身份、隐藏未完成页面或卸载时取消。即便 fetch 忽略 AbortSignal 后仍完成，也不能写入状态。
- 只有已选 ID 的精确匹配可形成 scope，不替用户选择首店。重新读取失败不能清除原身份经营草稿暂存。
- 已 ready 的普通标签隐藏/显示保留原编辑器，不再次读取稳定目录；未保存字段、筛选、选中状态保留。

## 验证

新增 test/plugin-apps/business-store-read-recovery.test.ts，使用真实 BusinessOperations、React renderer、录制 uiStore/uiProduct 数据和隔离 fetch。空列表、身份别名、故障、延迟及价格编辑均为显式本地派生控制，不向商家执行请求。冷却使用可控测试时钟，不依赖真实 sleep。

专项覆盖网络失败、403 及重试仍拒绝、空列表、ID 失效、成功重试、回调选择、挂起取消重读、同批次/分开事件双击、冷却过期再取消、忽略 abort 的晚成功、active 隐藏/重开、聊天/店铺切换、卸载晚回执、逐提交旧店铺名隔离、未选店、ready 编辑器保活、目录 403 后同身份草稿手动恢复。

原生产基线红测精准失败于 `Settled network must not look pending`。复现：

```sh
DSH_STORE_READ_BASELINE=9542fb263b66a0f8b65db5aca6c493b337e4d50b node --test test/plugin-apps/business-store-read-recovery.test.ts
node --test --test-concurrency=1 test/plugin-apps/business-store-read-recovery.test.ts test/plugin-apps/business-store-entry.test.ts test/plugin-apps/business-draft-recovery.test.ts test/plugin-apps/workbench-store-context.test.ts test/plugin-apps/business-operations.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
```

Node 22.18.0 与 24.21.0 的上述五文件各 8/8 通过，0 失败/跳过/取消；两版 tsc 和正式数据 audit 通过（318 testFiles、168 requiredFiles、165 infrastructureFiles，0 failures）。新测试已登记 test-scope requiredFiles/fileModes。未修改录制事实或 browser fixture；本树 browser-data.ts 已是独立普通文件，不经软链接写其他目录。

独立只读审查首轮指出原实现仅防同批次重复；补 500ms 冷却、分开事件测试及草稿恢复场景后，复审无阻断。结果为组件级交互验证，不代替浏览器视觉测试或全仓测试。外层工作台导航本来可离开；不宣称全应用被锁死。

执行记录位于 /workspace/shared/store-read-recovery-evidence-20261016/。无安装、复制依赖、全包构建、商家写入或发布。
