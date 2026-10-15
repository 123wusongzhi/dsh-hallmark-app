# 定时检查：测试 Issue #42–#43

Automation 20 批次结束复查发现 [#42](https://github.com/123wusongzhi/dsh-hallmark-app/issues/42)、[#43](https://github.com/123wusongzhi/dsh-hallmark-app/issues/43)，实际 created_at 为 UTC 2026-10-15 15:52:18、15:57:59，均晚于限定的 15:02:44。已读完整正文及各一条评论。对方发布的另一分支提交仅作参考；在本任务原分支独立验证，不导入其生产改动或提交历史。

两项都有实际回归价值，当前生产实现正确，仅需最小测试补充。Windows / Node 24.12.0；与本批同时工作的人员改动均保留。

| Issue | 缺口与真实执行链 | 独立隔离对照 |
| --- | --- | --- |
| #42 本页取消全选保留他页选择 | 25 条未改字段的冻结摘要，经实际 collected-products 组件、原 SDK、Host sourceSelection、SelectionInputBridge、真实 native File。第一页 20 项加另一页 1 项得到 21 项精确附件；取消当前页后，另一页原选择仍 enabled、再次用户点击只附加该 1 项。保留既有和首份附件，无重读、改正文或自动发送 | 旧邻近 33/33（含 #35、#39）；仅把取消分支 next.delete 改 next.clear，旧仍 33/33，新 0/1 准确发现禁用按钮；不绕过 disabled 继续点击。原字节恢复后新 1/1、组合 34/34；外 cwd 1/1 |
| #43 下载脚本透传非零 cursor | 实际 Host tool / renderer 的 fullResultRef → Runtime HTTP / SQLite spill → 原 apps-read-result.mjs 子进程 → 落盘分页。五条显式非业务传输记录，包含 Unicode、孤立代理项、转义、null、false、0。逐页精确验证 cursor 0/2/4、limit 2、长度 2/2/1、完整拼回原值，不能重新调用 Provider | 旧 5 文件 32/32；只将脚本 cursor 固定 0 后旧仍 32/32，新在第二页 exact requested slice 处准确失败（实际 index 0/1，预期 2/3）；原字节恢复组合 33/33、外 cwd 新 1/1 |

#42 与刷新后选择、附件拒绝恢复是不同用户动作；既有本页批量操作测试在取消后未再检查他页并附加，故新增断言有用。#43 保留脚本每次只读一页、由调用者续读的既有契约，不要求自动下载所有页，也不重复现有长结果 Unicode/权限用例。

## 适配与最终验证

#42 登记 recorded，#43 登记 infrastructure。数据事实不作合成替代，冻结 corpus 不变。两项都保留有效旧断言，无新增 skip 或生产行为变更。#42 用 import.meta.url 定位、有界 15 秒/1 MiB 子进程与 30 秒总测试；补充 windowsHide、失败 stdout/stderr 保存、成功时在验证根目录后删除及 Windows 重试。该最终 harness 小改不变业务断言，新测与外 cwd 再次各 1/1。

#43 真实 HTTP 只走 127.0.0.1，端口在 Fetch 允许范围有界重试，Host/CLI 各有取消和 5 秒界限，外层 20 秒。失败请求、两次下载的 JSON 和日志保留；成功自产目录验证根路径后清理。独立只读交叉审查无阻塞。所用 API 与项目 Node >=22.18 兼容，但未实机重跑该版本或其他操作系统。

- 独立工作树与主工作区去重组合均 **67/67，零失败、零跳过**。
- 两处 TypeScript noEmit 均通过。独立冻结数据审计 PASS：300 测试文件，160 recorded 条目、155 infrastructure 条目；分类含 helper，不将条目数相加当作文件总数。
- 主工作区数据审计仍 FAIL：用户原有新增、未提交 `test/business-pricing/purchase-cost.test.ts` 尚未分类。本批两文件均已分类，不代改无关工作。
- 合并本批前的 35 个用户修改/新增文件 SHA-256 均未变；scope 单独合并保留既有条目。Component 与下载脚本临时变异均原字节恢复；已提交的 #41 一行 version 修复保持完整。

不重复全仓套件，不宣称全仓全绿。上一批主区四项既有 Host 工具/请求清单断言冲突，以及此前全套两项环境失败、两项打包前提跳过，均未以本批定向通过消除或忽略。详见 `docs/test-issue-review-38-41-20261015.md` 与 `docs/test-issue-review-33-37-20261015.md`。

本地证据：`artifacts/issue-review-automation20-20261015T1600/`，#43 失败自产下载另在 `artifacts/result-reader-runtime/download-a1lUtu/`。这是离线 React renderer/SDK/native API 边界及回环 HTTP/CLI 集成测试，不代表真实浏览器布局、聊天窗口、上传、平台或商家写入验收。本批仅提交两个测试、分类和报告。
