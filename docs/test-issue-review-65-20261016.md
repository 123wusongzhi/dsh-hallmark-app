# 测试 issue #65 独立复现与诊断改善

GitHub 实际 created_at 为 2026-10-15T21:27:12Z，符合本任务时间范围。基线 f8782c9fc0c7d95f18745a32d1f833596e5403dc；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0，使用已有锁定依赖和公开脱敏冻结数据。

## 价值与实现

接受为内部诊断改善。原测试已经检出两种错路由，但在 latest() 直接读取不存在的消息 `.data` 时产生 TypeError，掩盖实际组件错误。本次只把这行改为显式查找消息、断言消息存在并附当前 alerts、断言 data 存在后返回。没有新增故障检出能力或性能收益主张。

原四个生命周期 case、生产 React/Bridge、时序、刷新/读取次数、样本、错误保留、AbortSignal、按钮状态、iframe 与监听器清理断言全部保留。没有新增 sleep、timeout、fallback、catch、生产校验或框架。session-components 中的两个 snapshot scoped-read guards 保留，#64 的单条 sidebar guard 删除不扩展到它们。

## 独立故障对照

只临时修改 SnapshotView 的初次读取调用，保留此前修复的 `[bridge,viewId,owned,version]` 依赖。下表在两个 Node 版本均实际执行，每次只选原有的 current source refresh case；同一故障旧/新的生产输入 SHA 完全一致。

| 生产输入 | 旧测试 | 新测试 | 实际子进程定位 |
| --- | --- | --- | --- |
| sessionView → view | 0 通过 / 1 失败 | 0 通过 / 1 失败 | TypeError 改为明确消息缺失断言 |
| sessionViewData → viewData | 0 通过 / 1 失败 | 0 通过 / 1 失败 | TypeError 改为明确消息缺失断言 |

实际逐份读取八份 child stderr 并回查生成的子进程源码：旧版均在 latest2 读取 undefined.data；新版均为新增消息断言的 ERR_ASSERTION，带组件显示的 sessionId 实际 null、预期 refresh-session。最先命中的是原 fetch 夹具的 sessionId 断言，不能误称为尚未执行的 resource 断言。没有把外层退出码断言、构建/导入失败、语法错误、超时或取消冒充诊断改进。这两个故障均检验消息存在断言，不声称单独验证了第二条 payload 存在断言的负例。

## 兼容性与检查

SourceFrame 发送的 message.data 是 SourceData 对象；新断言不检查其内部 payload，不限制合法的 0、false、空字符串或 null，也不改变空 bindings 语义。alerts 闭包首次执行前已完成初始化，能读取 SnapshotView 真实 ErrorView 的 role=alert 内容。

两个版本原基线和恢复后相关三文件各 11/11，恢复后完整 plugin-client 19 文件各 129/129，均无失败、跳过或取消。断言调用多重集合从 35 到 37，删除 0。主工作区合入同一测试补丁后，两个版本相关组各 11/11；主工作区和隔离树类型检查、真实数据审计均通过。原主工作区 107 个已有未提交/未跟踪文件逐字节保持一致。

默认 npm test 发现范围包含这四个 case；test:apps 原本不包含 plugin-client，入口不变。本次没有重跑全仓、真实浏览器/桌面或线上服务。#60–62 的前序全仓仍为 Node 22 两失败、Node 24 一失败，包含 association capability 状态及 packaged parity 字符串 productId 转 NaN；这些结果在 #63–65 前取得，不能称最终树全绿，详见 [前序报告](test-issue-review-60-62-20261016.md)。

## 恢复与证据

所有临时源码故障均 finally 从原 Buffer 恢复，snapshot.tsx 最终 SHA-256 为 b3bd0b143a5af8b3eed4563dd4fc91bc0161f7edff2dc47f7ee387fa56e237c0。候选测试工作字节 SHA-256 为 984d24459f81364fd41032f305729e14d168620ae6d3d9c7ba23baba73c347fe。

本地独立 runner、每步命令/输入 SHA、八份实际 child 错误与恢复记录位于 `artifacts/issue-review-automation20-20261015T2050/issue65/`；测试生产数据未改，生产代码无永久变化。提交仅包含该测试及本报告。
