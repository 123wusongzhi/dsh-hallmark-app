# SDK preparing 轮询测试受控时钟优化与独立验证

日期：2026-10-15（UTC）
基线：`8947e821476bcca376a680b263e4f2da2f775911`
环境：Linux x86_64，Node v24.19.0，React/react-test-renderer 18.3.1。

## 结论

可以合入这一测试专用改动。`test/apps-components/display-errors.test.ts` 保留原 12 个测试和全部 54 个断言位点，增加 9 个断言位点；生产文件无改动。五对交替运行的文件级墙钟中位数由 **8.210s 降至 1.552s，减少 81.09%**。独立 checkout 完整执行 `apps-components` 30 个测试文件：**211/211 通过，0 跳过，23.503s**。

这不是生产性能修复。测量范围是该测试文件，未将文件级节省比例推算成全仓收益。此次未重跑整个 `npm test`，也未执行桌面或真实平台验收。

## 修改内容与保留的执行链

- 只在六个 `preparing-*` fixture 的隔离 Node 子进程启用内置 `mock.timers`，控制 `setTimeout` 和 `Date`。非 preparing 的错误、重试、业务异常和 readiness 测试继续使用真实时间。
- 原来六次约 1100ms 的真实等待改为推进受控时间；初始 preparing 的 legacy/transfer 两条路径，以及已 ready 后收到 preparing push 的路径，额外验证 999ms 不提前读、1000ms 恰好增加一次读。
- `useApps`、`ComponentHost`、`apps-client`、`DataTransfers` 仍加载同一份生产实现。未替换其返回值、状态机、调用链或实际 Promise 响应传递。
- 每次推进仍处于真实 `await act(async()=>...)` 中。安装的 React 18.3.1 会经 `timers.setImmediate` 排空异步 act 工作；本次只模拟 `setTimeout`/`Date`，不模拟 `setImmediate`/`clearImmediate`。独立检查在每次 tick 前确认这两项仍为原函数，12/12 通过。
- 清理先卸载 React、dispose host、验证监听器归零，再在嵌套 `finally` 中 reset 时钟并严格验证 `setTimeout`、`clearTimeout`、`Date` 都恢复为原函数。独立在已 render 且进入 preparing 后主动抛错，仍完成该恢复检查；故意删掉 reset 会在原函数同一性断言失败。
- 现有协议 fixture 控制值仍仅用于基础设施状态机测试。没有新造商城业务样本，也没有将隔离 fixture 说成真实桌面或平台成功。

## 性能证据

所有正式计时均使用未加额外取证字段的实际原测试/候选源文件；每轮 12/12 通过。交替顺序为 old/new、new/old、old/new、new/old、old/new。正式运行时间：18:25:57.902–18:26:46.758 UTC。

- old 墙钟（ms）：8142.885、8146.537、8243.746、8209.517、8232.772；中位数 8209.517
- new 墙钟（ms）：1528.949、1547.433、1586.417、1621.871、1552.143；中位数 1552.143
- 减少：6657.373ms，81.093%；每个 preparing fixture 不再实际等待 1.1 秒
- 独立 checkout 在 18:48:46.694–18:48:56.725 UTC 又跑原字节 old/new 一对：8261.854/1768.507ms，均 12/12；未用这一对替换正式五对中位数


安装说明：仓库使用 `pnpm-lock.yaml`，应使用 `pnpm install --frozen-lockfile --ignore-scripts` 安装。本次验证复用已有依赖，没有在全新 checkout 实测安装；使用 `--ignore-scripts` 时，ESBuild 对应平台的官方包及其二进制须已准备可用。此次只实测 Node v24.19.0，未实测项目声明的 Node 22.18 最低版本。

## 等价性与负控

独立 checkout 于 18:47:45.617–18:48:01.204 UTC 重做完整等价与负控。

等价比较为两版添加只读输出字段，并把 fixture 的 `startedAt` 固定成相同输入，避免真实 DataTransfers 内容哈希随测试启动时间变化。只归一化随机 `requestId` 和 `documentNonce`；保留服务器诊断 request ID `srv-1`。比较全部 12 个 fixture 的子组件出站消息序列、readyRequests、dataCalls、最终 data/loading/preparing/error 和清理状态，逐项完全相等。并非逐字比较随机 ID，也未声称捕获了所有宿主返回报文。

- data、data-deterministic：1 次读、0 次 ready
- data-retry：3 次读、1 次 ready；data-exhausted：3 次读、0 次 ready
- business-script、ready：各 1 次读、1 次 ready
- preparing-legacy、preparing-transfer、preparing-hidden、preparing-push：各 2 次读、1 次 ready
- preparing-failed：2 次读、0 次 ready；preparing-unmount：1 次读、0 次 ready

旧版与新版均被以下生产故障变异精确判红：

1. 去掉 ready 的 loading/preparing 防线：legacy 和 transfer 各失败于 ready 次数 `1 !== 0`。
2. 忽略 hidden 状态并继续读取：失败于读次数 `2 !== 1`。
3. 去掉同一 publication 的 ready 去重：push 场景失败于 ready 次数 `2 !== 1`。

新增边界断言还判红四种调度变异：初始 poll 的 1000 改 999/1001（每种 legacy、transfer 均红），push poll 的 1000 改 999/1001（每种 push 均红）。999 在“不应提前读”的断言失败；1001 在“恰好增加一次读”的断言失败。所有故障注入均仅用于一次性独立工作树，结束后恢复原生产字节并再次验证。

源码断言按完整 assert 调用多重集合比较：54→63，移除列表为空。9 个新增位点是三项时钟恢复、两项边界 ready 次数、两项 999ms 读次数、两项 1000ms 读次数。循环展开的运行时断言次数更多；该统计不是测试数量。

## 完整相关回归与可复现命令

使用该基线自带公开脱敏语料，未依赖本机私人语料路径。语料 SHA-256：`9c45a56450fee1ec58438852bc991046965c8d1d91958094f5b59c038cf85a23`。

```sh
pnpm install --frozen-lockfile --ignore-scripts
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
node --test --test-reporter=tap test/apps-components/display-errors.test.ts
node --test --test-concurrency=1 --test-reporter=tap test/apps-components/*.test.ts
```

结果：数据准备通过；真实数据审计通过（308 个测试文件，0 failures）；TypeScript 检查通过；文件 12/12；目录 211/211、0 fail/skip/cancel/todo，TAP duration 23502.777ms。目录测试结束后所做变异和额外检查均恢复了候选测试与原生产文件；实际候选原字节随后再次通过 12/12，最后仅运行一次已挂载后失败恢复探针并验证字节恢复。

## 输入身份

- 基线测试 SHA-256：`a013b492c0be311181fa8f19586253ccf2a77029d43015f5e8ead4c6a4116741`
- 候选测试 SHA-256：`4550d030b0aaad753a4f66ea2dff2e3efa8d57b26a2a6382fdcc7285a60ae7b5`
- `apps-react.tsx`：`db12fe598c7f2c80337670969ac4361965ea781da168652007b412c8e4eefe72`
- `apps-client.ts`：`18f30afd1775696bb63bee5d6e071cb8c946a50646675bd2452dc7d28d620568`
- `host.ts`：`d590f5c1a70b3d041853924913d52b3c403c96f62631c82e02d110f2a3dfc814`
- `data-transfers.ts`：`14c8a865eba3ca86a75f19d0eed15276a709f41ca142f53bb42051b94d5418a4`

以上生产文件均与基线逐字节一致，整个 `packages/` 无 diff。
