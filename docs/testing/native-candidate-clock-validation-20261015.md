# Native 候选等待点击测试的受控时钟验证

日期：2026-10-15 UTC。独立基线：8947e821476bcca376a680b263e4f2da2f775911；Node v24.19.0。公开自足复现、完整补丁和故障控制见 [问题 #56](https://github.com/123wusongzhi/dsh-hallmark-app/issues/56)。本报告只概括最终 v3 局部验证，合并后的完整结果见同批完整串行对比报告。

## 范围与输入

唯一测试改动为 test/plugin-apps/native-candidate-surface.test.ts；生产 packages 无差异。

- 原测试 SHA-256：dffc0a5418016c5846b07fa8b29044479a255059280605ef0efd26797321ac71
- 最终 v3 测试 SHA-256：fa7a1a8e5a6ad03c2da18e8d3b1063b7f13add355b72b3ad35b121a646b3dd2e
- 最终 patch SHA-256：e3208cca559e0a83166e21d07933fb61f7594e36a2ae7c328c5bf7e26149e1b3

原测试通过 16050 ms 的真实等待确认“候选已准备但用户尚未点击”时不会自动打开侧栏、创建 iframe、发送写请求或启动挂载 deadline。候选在这一个隔离 fixture 的 render 前启用 Node 内置 MockTimers，控制 Date、setTimeout、setInterval；按 1 ms 推进，并在真实 I/O 排空时通过通用 tick(0) 清理已到期 timer。没有自制调度器、特定网络库 timer 分支、模拟 HTTP 响应或改变生产 timeout。

真实生产 React 组件、隔离 loopback HTTP、fetch 和 Response.json 仍在执行链内。对现有请求/body Promise 的跟踪配合 React act/setImmediate 排空；1.5 秒真实墙钟 guard 将未结束的真实请求显式判为 harness 失败。16050 ms 推进完成后，finally 恢复并逐项检查 timer、Date 和 fetch，再继续原来的明确点击、exact build、iframe onLoad 不等于 ready、hello/grant、render-ready 和 displayed 断言。

这不是实际桌面/浏览器或真实 Runtime 服务验收；renderReady 仍为原 fixture 的模拟 bridge 事件。效果只适用于命名测试命令和输入，不代表生产系统延迟。

## 正常与故障控制

最终相同测试字节连跑五次通过。在 15999、16000、16050 ms 的只读取证 checkpoint，opened、iframe、POST、pending request 均为 0，readyDeadlineAt 为 null；检查点输出不替换响应。

三个负控分别在原测试一次、最终候选五次中命中对应原业务断言：

1. 16000 ms 自动打开：精确在点击前 opened === 0 失败。
2. 16000 ms 调用 failMount：精确在点击前“没有 POST 请求”失败。
3. 丢失 render-ready UI 事件：精确在“已展示”状态断言失败。

未把缺按钮、TypeError 或排空 guard 超时算作业务负控通过。每个正常/故障 fixture 都关闭 Server、移除 listener，并通过对旧端口发起连接得到拒绝来验证关闭；最终候选负控还验证时钟和 fetch 恢复。所有临时生产变异在 finally 恢复，结束后 packages 差异为空。

其他局部门禁：数据审计通过；native-candidate-surface 与 native-frame-handshake 串行 32/32，0 fail/skip/cancel；TypeScript noEmit 通过。

## 两对串行筛选单项测量

计时命令：`node --test --test-name-pattern="^prepared original card waits" test/plugin-apps/native-candidate-surface.test.ts`。该命令按名称只执行 wait-click 单项，不是整个 native 文件，也不是前述 32/32 回归命令。

精确窗口：2026-10-15 18:52:41.823508–18:53:17.446010 UTC。顺序 old/new、new/old，无其他测试或类型检查重叠；四次命令均 exit 0。

- old：16.893153338、16.825932037 秒
- new：0.941307617、0.955919027 秒
- 两对节省：15.951845721、15.870013010 秒
- 原/新中位数：16.859542687、0.948613322 秒
- 配对节省中位数：15.910929365 秒；中位数比值减少 94.37%

只采两对以避免反复支付已知 16 秒等待；这是本机有界观察，不是任意机器的保证，也不能按该比例外推整个测试套件。

## 排除的探索结果

早期 v1 的自动打开负控错误地失败在后续找不到按钮，未通过等价性门禁；其时间数据还存在与 SDK 类型检查重叠，全部排除。v2 已有 1 ms tick 与真实 fetch/body 跟踪，但自动打开故障停在排空 guard；最终 v3 采用通用 tick(0)，使负控命中原业务断言。预最终验证脚本曾因成功结果不含 undefined failure 属性而报 KeyError，属于证据解析错误；修正后最终相同 hash 的 20 次正常/故障运行完成。不得把探索输入或 parser 失败当作最终候选证据。

## 复现与环境限制

已有依赖时，从仓库根目录执行：

```sh
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node --test --test-concurrency=1 test/plugin-apps/native-candidate-surface.test.ts test/plugin-apps/native-frame-handshake.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

完整 test-only patch、三种生产故障 diff、还原步骤和预期失败位置已内嵌 #56。请仅在独立临时 checkout 做故障注入，保存并恢复原始字节，勿与普通回归并发。

本次只复用既有依赖，没有实测新安装。仓库使用 pnpm-lock.yaml，新环境可按 pnpm install --frozen-lockfile --ignore-scripts 准备，但相应平台官方 ESBuild 二进制必须可用。只实测 Node v24.19.0，未验证声明的 Node 22.18 最低版本。此为本地云端执行证据，不声称 GitHub CI 通过。
