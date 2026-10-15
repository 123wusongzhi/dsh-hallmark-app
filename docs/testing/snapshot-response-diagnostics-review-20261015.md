# Snapshot 缺失响应诊断：独立复核

日期：2026-10-15 UTC。结论：通过；可按测试诊断改善提交，不应描述为新增故障检出。

## 精确输入与方法

在新建的 detached 工作树实际执行完整自足复现脚本。源码从公开基线 `f70e210359a49ae28a90e8edc046df3c5fae442f` 取得，Git tree 为 `cfb1a398aabca5cd5b561556a52ba8cf08c69a34`。不导入作者的候选源码，脚本直接以内嵌 OLD→NEW 构造补丁与两种 mutation。

复核执行时间为 `2026-10-15T21:23:55.988477Z` 至 `2026-10-15T21:24:59.539718Z`。Linux；Node `v24.19.0`；TypeScript `5.9.3`；esbuild `0.25.0`；React / react-test-renderer `18.3.1`。复用既有锁定依赖，未执行安装；源码 pnpm-lock.yaml 与依赖目录 .pnpm/lock.yaml 的 SHA-256 均为 `6dfa707c589d59ad4442cc26ff1b4cb1441ff0c1453c1e952bdbd1e85376840b`。

最终自足脚本 SHA-256：`ffc6217a63fb05f6222da611ea72cd1e8a87e31ec734af403c29b90a5efd2fb7`。独立运行产出的测试 patch 与作者提交 `f3d9baa4e8df2ae0266d8eac066d6657199d848e` 的目标测试 diff 逐字节相同，patch SHA-256 为 `75fac688e949d3cf5e51c5f58767be15b827c19d596cb5bbf9cdfe1afd7eea8c`。

## 实跑结果

- 基线相关组合：11/11。
- 初次 `sessionView → view` 错路由：旧测试 0/1、新测试 0/1；两者都失败。
- 初次 `sessionViewData → viewData` 错路由：旧测试 0/1、新测试 0/1；两者都失败。
- 两个 mutation 分别 tsc --noEmit 通过。
- 恢复生产源码，仅保留候选测试：相关组合 11/11；完整 plugin-client 129/129，均无跳过、取消或失败。
- 恢复后真实数据审计 PASS：308 个测试文件，来源计数 20/20/1。
- 恢复后 tsc --noEmit 与 git diff --check 均通过。

相关组合为 session-components、application-surfaces、snapshot-refresh-lifecycle 三个文件。另核对旧／新相关组合的测试名称列表完全一致，原四个生命周期 case 均执行。

## 不是仅检查子进程退出码

逐项阅读四份保留的子进程 stderr，且按错误栈行号回查实际生成的 test.mjs：

- 旧版均在 `latest2` 中读取 `.at(-1).data` 时抛出 `TypeError: Cannot read properties of undefined (reading 'data')`。
- 新版均在 `latest2` 的 `assert2.ok(message, ...)` 行抛出 `AssertionError [ERR_ASSERTION]`，消息明确要求 SnapshotView 发出 `hallmark.source.v1 data`，并包含组件当前显示的 sessionId 错误：实际 `null`，预期 `refresh-session`。
- 新版没有 TypeError、SyntaxError、ReferenceError、TimeoutError 或 ERR_MODULE_NOT_FOUND。实际目标 helper 已加载并执行，不是构建／导入失败。
- 每组旧／新的生产输入 hash 相同，分别为 `0eb469a1ad6cad8990a3d388f61660933729236c31b60037ee14ddd29438b208`、`e3978ab0e98c4fe6d7f241e3538993b9eb805558cd5c877f8aa64fc78d37a977`。

实际首先命中的是 fetch fixture 的 sessionId 断言，并由组件原有错误 UI 展示；没有把它误报为尚未执行的 resource 断言。外层退出码断言原本就会产生 ERR_ASSERTION，本次改善特指子进程内的失败内容和定位。两个 mutation 均命中新增的“消息存在”断言；没有把它们当作第二条“payload 存在”断言的独立负例。

## 范围与恢复

测试补丁仅替换 latest() 的一行隐式取值为六行显式检查，新增两个 assert.ok。原四 case、样本、刷新次数、读取次数、商品 ID、时间、错误保留、AbortSignal、按钮状态、iframe 数量和监听器清理断言均保留。没有新增 sleep、等待、timeout、fallback、catch 或生产修改。

session-components.test.ts 未变，两条 snapshot scoped-read 源码 guard 保留；本实验不证明它们可以移除。

此次独立运行不传 --leave-candidate，最后将候选测试也恢复。全部 1336 个既有 tracked 文件的前后 SHA-256 清单完全相同，其中 272 个 packages 文件全部恢复。仅本地依赖符号链接是未跟踪准备项，不属于源码补丁。

恢复后的关键 SHA-256：

- snapshot-refresh-lifecycle.test.ts：`16c9a8fb21f6c0e30d1ff241f65486833fda5c01381566874fa4f4a24dc9b7ba`。
- snapshot.tsx：`d7ae2d73235207860d33fe426ad4e81eff5de99ff34a59db735bf5901f046f5b`。
- session-components.test.ts：`338fac5d8d03f18119147ab0df523c5fe819e913063047ee87d76a96d847332e`。
- 独立运行 manifest：`127a6c9ac58d591f9745af623b836d805d725c3bce9ac89e0276ae59824545a4`。

使用默认公开脱敏冻结语料，未设置 DSH_REAL_CORPUS；没有修改冻结语料。本轮没有运行全仓 npm test、test:apps、Node 22、真实浏览器／桌面或线上服务，不主张性能收益。未 push、未发布 issue、未部署。
