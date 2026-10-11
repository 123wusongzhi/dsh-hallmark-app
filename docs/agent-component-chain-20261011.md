# Agent 组件创建、编辑和展示链路：10 项修复

日期：2026-10-11。基线：`4c0e3d7`。验证使用隔离的工作树、内存数据库、合成数据和独立 Chrome；没有借用真实店铺、商品或上架任务作为测试数据。

## 复现与修复清单

| # | 触发方式及原问题 | 修复后的行为 | 主要回归证据 |
|---|---|---|---|
| 1 | 保存源码后重新打开，归档排除了 `.preview/plan.json`，Agent 丢失预览断言计划 | 新归档保存根目录的计划，继续排除截图/报告；旧归档保持可读 | `agent-chain-authoring.test.ts`：归档、恢复、哈希、旧版本兼容 |
| 2 | Windows 下自定义 `node --eval` 构建，检查入口误把构建参数当成自身启动参数 | 独立保存检查器的 executable/nodeArgs，准备和重试均传递；保留标准旧请求兼容 | 同上：真实 PowerShell 启动默认自定义、显式自定义、标准构建 |
| 3 | Agent 只传新标题开始编辑，接口成功但标题不变 | 标题编辑生效；同 attempt 的幂等重放不重复替换状态 | 同上：title-only + idempotency |
| 4 | Agent 编辑时指定冲突/缺失工作目录，返回失败却已经改了标题、绑定或店铺 | 先校验工作目录，元数据变更整体提交；失败回滚，提交成功后才通知取消旧尝试 | 同上：非空绑定、上下文、缺失目录和晚期事务失败 |
| 5 | 首次读取未结束，新推送或刷新已经返回；旧首次响应又覆盖新数据 | 按读取顺序接收数据，迟到的初始响应/错误不覆盖较新的状态 | `sdk-concurrency.test.ts`；真实浏览器 initialEvent/initialRefresh |
| 6 | A/B 两个区域并发翻页，原全局序号把其中一个有效结果丢弃 | 按绑定合并，单一区域的新请求仍优先；等待中的兄弟请求保持加载提示 | 同上；浏览器 bindingPages；部分刷新保留其他区域的后端分页 |
| 7 | 上下文版本冲突等明确未提交的 Agent 请求，被当成结果未知并永久锁住编辑 | 明确未提交时允许修正、更新上下文并手动重试；未知超时仍锁定且不自动重发 | `agent-recovery.test.ts`、bridge contract；浏览器 rejectedAction/unknownTimeout |
| 8 | 组件加载慢数据时持有共享连接锁，列表、检查、取消也被阻塞 | 只给 5 项已核对的本地操作独立执行声明，保存及其他编辑操作保留原队列 | `agent-chain-queue.test.ts`：真实 Runtime/Presentation 挂起数据源 |
| 9 | 两个来源刷新同一数据集，后一个沿用前一个请求，绕过自身授权或共用取消 | 只合并同来源、同取消信号和同连接版本的请求；授权失败不回退他人的缓存；晚到失败不降级较新的成功数据 | `refresh-isolation.test.ts` + 原 cache-refresh 回归 |
| 10 | 第二页可见选择可添加附件，却无法保存为组件 UI 状态 | 保存和恢复均校验当前 iframe 的分页快照，同时保留身份、构建、数据集、版本和资源校验 | `backend.test.ts`：真实 publication/display/bridge、保存、恢复、过期剔除和兄弟区域刷新 |

以上按独立根因计 10 项；配套边界修复和旧测试维护不另计数。

## 收益和范围

- 慢查询保持挂起时，`list_saved + inspect + cancel` 在基线超过 600 ms 仍无法完成；修复后同场景合计 2.52 ms。取消确实改变目标 attempt 并发出一次通知。这是解除阻塞的受控复现，不代表生产吞吐量提升倍数。
- 其他修复解决错误覆盖、遗漏更新、失败后状态污染和无法继续操作；没有将这些正确性改善伪称为 CPU 或帧率收益。
- 不再跨调用来源共享刷新，可能增加不同来源同时读取时的独立调用数；同来源的安全去重和强制刷新等待逻辑保留。
- 明确未提交的请求增加可恢复操作；结果未知的请求仍要求检查原请求，防止重复提交。
- 归档保存构建时的预览计划。既有“仅改预览断言后重试，复用原构建”的契约未改：它仍引用原构建的不可变归档，不会改写历史归档中的计划。

## 可重复验证

```powershell
npm run typecheck
node --test --test-concurrency=4 test/**/*.test.ts
npm run build:apps
node scripts/sdk-agent-chain-browser.mjs
```

定向测试文件：

- `test/authoring/agent-chain-authoring.test.ts`
- `test/authoring/backend.test.ts`
- `test/presentation/agent-chain-queue.test.ts`
- `test/apps-components/sdk-concurrency.test.ts`
- `test/apps-components/agent-recovery.test.ts`
- `test/apps-components/refresh-isolation.test.ts`
- `test/apps-components/bridge-failure-contract.test.ts`
- `test/apps-components/bridge.test.ts`

本机原始输出和截图：`E:/project/deepseek_h/output/component-agent-chain-20261011/`。包含修复前红测、修复后绿测、浏览器 `results.json` 和截图。

SDK 浏览器验证使用 Chrome 154.0.8037.95、生产 React hook/client/host 与真实 iframe postMessage：5 个场景、15 项断言通过，无页面或 iframe 错误。实际等待约 30 秒后，结果未知请求仍只提交一次且保持锁定。

全量验证时发现旧 `bridge.test.ts` 仅推进约 5 分钟模拟时间，而基线正式业务超时已是 15 分钟。基线和本次代码均可复现等待不结束。测试现读取正式超时常量并检查到期前后边界，生产超时未改，独立 10/10 通过。

另外一条旧采购来源测试仍期待 `delivery`，而基线 `c15fc3d` 起正式默认已是 `application`。仅更新这条过期断言，旧保存实例的 delivery 参数兼容测试保留。授权隔离相关旧测试改为验证每个独立来源经过准入；补了未授权工作台不能借用在途读取的真实 Runtime 测试。浏览器 HTTP fixture 明确注册并绑定合成连接，没有放松生产授权检查。

## 最终验证结果

- 全量 **1630/1630 通过，0 失败、0 跳过**，96.15 秒。执行全部原测试文件，使用 `--test-concurrency=4`，将当前测试进程的 `TEMP/TMP` 指向证据目录下独立的 `isolated-temp`。
- 首轮高并发遇到 Windows 临时目录清理失败；系统默认临时目录还存在祖先 `node_modules`，触发包隔离测试的正确拒绝。隔离工作树补齐已有组件依赖后，受控并发、独立临时目录全量复跑通过。没有删除系统临时目录中的其他依赖或关闭其他任务。
- `npm run typecheck`、`git diff --check`、`npm run build:apps` 均通过。
- 最终包 SHA-256：`31ced0a0512bbaf59864652b08d6ab472f955b27162269e1e693d90bc1edb4df`。
- 官方 base starter 的真实构建、保存、checkout、离线依赖安装、重建及 formal preview 均通过。恢复前后各 **16/16 断言**，均覆盖 420/1040 两种宽度；计划字节与 buildId 一致。证据为 `authoring-browser/result.json`。
- SDK 的独立浏览器验证 **15/15 断言**通过；生产 hook、client、host 经真实 iframe 通信，无浏览器或 iframe 错误。

修复提交合入本地 `fix/agent-binding-preview`；此前 4 个未提交的 Ozon skill 文件不纳入提交，并单独核对合并前后的哈希。安装包通过构建检查，本次目标交付为代码合并。
