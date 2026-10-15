# 测试 issue #64 独立复现与取舍

核对 GitHub 实际 created_at：2026-10-15T21:17:40Z，晚于本任务起点。基线为 d797ced58793f8c19b91745ce32863dc26511437。Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0；复用锁定依赖，无安装、真实商家写入或桌面操作。

## 价值与最小修改

删除 session-components.test.ts 中唯一的 `assert.ok(sidebar.includes('bridge.sessionViews'));`，补一行指向 application-surfaces.test.ts 的说明。收益是避免局部变量等价改名导致假红。两个 snapshot 调用、身份、所有权、原生集成和架构 guards 均保留；原测试数量和其余断言不变。没有生产代码修改，也不主张性能收益。

## 独立对照

下表均为 Node 24、同一组三文件的 11 个外层测试。每种故障在旧/新测试下使用完全相同的生产字节；不使用名称筛选。

| 输入 | 旧测试 | 修改后 | 实际结论 |
| --- | --- | --- | --- |
| 原生产源码 | 11 通过 | 恢复后 11 通过 | 基线及恢复正常 |
| sidebar 非 import 局部变量 bridge 改名 sessionBridge | 10 通过 / 1 失败 | 11 通过 | 消除唯一的字串误报 |
| UI list 使用 foreign-session | 9 通过 / 2 失败 | 10 通过 / 1 失败 | 保留 React ready-card 断言检出真实错会话 |
| API list 请求 saved 而非 sessionViews | 9 通过 / 2 失败 | 9 通过 / 2 失败 | Bridge INVALID_SESSION_VIEWS 及 ready-card 均检出 |
| API list params 指定 foreign-session | 9 通过 / 2 失败 | 9 通过 / 2 失败 | narrow-GET sessionId 断言及 ready-card 均检出 |

逐一读取六份实际 UI 子进程 TAP：均为 3 项中 2 通过、1 失败，失败是 ready sidebar card 的 ERR_ASSERTION（应有 1 张卡，实际 0）。API 错资源的直接 Bridge 错误为明确的 INVALID_SESSION_VIEWS，错会话为 every-URL sessionId 断言。没有把加载错误、TypeError、语法错误、超时、取消或仅非零退出当作覆盖证据。

## 复测与兼容性

- 两个 Node 版本：恢复后相关三文件各 11/11、完整 plugin-client 19 文件各 129/129；无失败、跳过、取消。
- 主工作区合入同一补丁：两个版本相关组各 11/11；主工作区和隔离树类型检查、脱敏真实数据审计均通过。
- 默认 npm test 发现范围包含关联行为测试。test:apps 原本不含 plugin-client，本次未改变入口。
- 单跑 session-components 在 UI 错会话下通过 6/6，确实失去了该单文件静态拦截；最低关联入口需包含 application-surfaces。相邻注释明确说明关联测试。
- 本次没有重跑全仓测试或真实浏览器/桌面。React + 实际 Bridge 离线夹具不证明浏览器点击、焦点或线上集成。

此前 #60–62 的实际全仓结果为 Node 22：2261/2263，Node 24：2262/2263，均无跳过/取消。仍存在 Node 22 的 association capability 状态失败，以及两个版本的 packaged parity probe 把公开 corpus 的字符串 productId 转成 NaN 后被 JSON 校验拒绝；这些全仓结果在 #63/#64 前取得，不能称为最终树全绿。详见 [#60–62 报告](test-issue-review-60-62-20261016.md)。未导入主工作区用户对 parity probe 的既有未提交修复。

## 字节恢复与证据

每个临时故障均在 finally 中用原 Buffer 恢复。snapshot 从未写入。最终 SHA-256：

- sidebar：b781c2afb63a3e196f01d005733220bbf3a7747f903b7062fd1a8f147ed0d8b9
- API：246a32446f66f64f2db115c52012e05bc9b5629a54e5290c3ee379e4008de888
- snapshot：b3bd0b143a5af8b3eed4563dd4fc91bc0161f7edff2dc47f7ee387fa56e237c0
- 候选测试：c6050f88d8664f948b40417b37c5ece79d172d08b39c33d746db7fc931ed45b8
- 测试补丁：c4814d0380c2a4d9cb7d866ea7ccb22ba3918f6279aac1b2bada3865978ce337

本地可复查 runner、逐步输入哈希、完整 TAP、子进程断言和恢复检查位于 `artifacts/issue-review-automation20-20261015T2050/issue64/`，总说明为 REVIEW.md，汇总为 summary.json。主工作区原有文件逐字节保护，提交只包含该测试和本报告。
