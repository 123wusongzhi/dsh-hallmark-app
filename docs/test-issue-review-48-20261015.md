# 定时检查：测试 Issue #48

Automation 20 复查发现 [#48](https://github.com/123wusongzhi/dsh-hallmark-app/issues/48)，实际 created_at 为 UTC 2026-10-15 16:34:53，晚于限定的 15:02:44；完整正文及评论已读，无评论。独立基线 `344f1d04f185229085d51ff693b2d746325c8dfc`，Windows / Node 24.12.0。

这项建议的价值是可移植覆盖。原 `http.test.ts` 把不需要浏览器的失败构建恢复和后续浏览器预览放在同一 skip 条件下；缺浏览器的环境失去前半覆盖。本机 Chrome 存在，不能照搬 issue 的 Linux “旧测未检出”结论。旧浏览器相关断言保留，未制造 skip。

新增 `test/authoring/failed-build-http-recovery.test.ts` 经过真实 runAuthoringCheck→runAuthoringBuild→AuthoringEvidenceRunner→Runtime/authoring provider→实际 HTTP→SQLite。显式本地 Node 命令输出诊断并 exit(7)，计数写在源树之外。真实 record_build 路由已提交唯一 FAIL 回执后，在 response.end 边界销毁 socket；独立读取数据库确认提交先于丢响应，不伪造 fetch 或 receipt。

初次 check 返回真实网络失败及 record_build/retry_same_request；恢复和重复 check 返回原 FAIL/inspect_build_log。receiptId、executionId、reportRef、报告/日志字节和证据文件集保持；命令仅执行一次、record_build 仅一次、各恢复阶段真实 inspect。最终仍 build_failed，没有 preview、publication、components 或 view source，也不产生可发布 archive。

| 本机实际对照 | 总数 | 通过 | 失败 | 原有跳过 |
| --- | --- | --- | --- | --- |
| 原实现，17 个完整旧文件 | 144 | 142 | 1 | 1 |
| 移除失败 checkpoint verifyBuild 的 allowFailure:true，同一旧集 | 144 | 140 | 3 | 1 |
| 变异，新测试 | 1 | 0 | 1 | 0 |
| 原字节恢复，17 旧文件+新测 | 145 | 143 | 1 | 1 |

旧集保留的环境失败是 `http.test.ts:330` prepared product template 缺 `bundles/apps/sdk/component-runtime/package.json`。变异另外使 `http.test.ts:365` 和 `cli-optimizations.test.ts:72` 的既有两项准确报 BUILD_EVIDENCE_INVALID；恢复后二者通过。新测同样准确失败。因此不宣称 Windows 旧覆盖漏检，也没有把 143 通过/1 失败/1 跳过写成全绿。没有在 Linux 实机复测；新增代码无浏览器调用及 skip 条件，覆盖价值由路径与实际无浏览器调用证据支持。

最终 fixture 适配仅增强稳定性与兼容性：Fetch 安全端口有界重试，实际请求取消/时间上限，失败保留目录，成功删除前校验绝对临时父目录与前缀；外部整数执行计数；将 inspect 固定五次改为各恢复阶段至少一次，保留唯一命令/回执/原字节的核心断言。小改后新测再次 1/1、类型检查通过，不重复整组。主区新增测试 1/1、类型检查通过；合并前 41 个既有修改/新增文件 SHA 未变，scope 单独合并。

新文件登记 infrastructure。独立数据审计 PASS：305 测试文件、161 recorded 条目、159 infrastructure 条目，分类含 helper。主区审计仍 FAIL：用户新增未提交 purchase-cost.test.ts、related-products.test.ts 未分类，本批文件已分类，不改无关工作。

唯一临时生产变异在 `scripts/apps-authoring-build.mjs`，已 finally 恢复原字节，SHA-256 `53f1dd6d1c62d17451b224d35eccb13e9ee442c65189dcf921bb116bfa3f408a`，生产 diff 为空。最终仅提交测试、分类和报告，#41 永久修复保留。独立交叉审查无阻塞，未删改旧测试、放宽校验、签名或新增 skip。

本地证据在 `artifacts/issue-review-automation20-20261015T1645/`。本轮没有重跑全仓；此前主区四项 Host 精确清单冲突未处理，打包前提的原跳过仍保留。主区 SDK 文件在用户并行工作后已存在，独立树上述旧集仍缺；没有把文件存在推断成完整套件已通过。没有商家写入、应用构建发布、浏览器执行、桌面安装或真实业务数据。
