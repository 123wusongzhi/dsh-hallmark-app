# 五项交互优化整合验收（2026-10-16）

## 给维护者的结论

比较基线：`fd95bc22929bfbfa850e0312357322578287a10c`。实际双版本完整运行的是本地整合提交 `03aec8bdbf38b7ddac6a17b2c2b63c48fc3303dc`，tree `0c94ea127efe61fee160179bcf3848287412a14a`。本报告在运行结束后补入，不改变运行过的生产代码或测试。发布提交可能具有不同父链；以测试源码和 tree 证据核对，不把本地 SHA 冒充已在远程公开的提交。

本轮归为五项用户体验改进：
1. 上品常用字段直接编辑；高级 JSON 未应用输入受到保护；提交确认展示完整已保存内容。
2. 批量调价明确可见勾选范围与币种；整批提交前显示实际全部范围。隔离重放中误改隐藏行由 2 行降到 0 行。
3. 平台表格字段先选择、后统一应用。补选 3 项预览请求由 3 次降到 1 次；选择后取消由旧版逐项恢复累计 6 次降到 0 次。这是预览请求，不是平台 API 节省或线上耗时。
4. 返回已打开的数据标签保留搜索、分页及选中；隐藏时取消读取/计时器；数据实例最多保留 3 个，native view 另有自身池。
5. Agent 更新与提交显示准确阶段；排队不冒充业务完成；失败更新使旧上下文版本失效，原身份晚到回执不污染新身份，未知任务不能盲重发。

完整默认测试：Node 24.21 为 2,273 项，2,233 通过、2 项既有失败、38 跳过；Node 22.18 为 2,273 项，2,235 通过、0 失败、38 跳过。两版类型检查、来源审计通过；新增 10 项全部通过，无新增失败、无删用例、跳过集合未变。Node 24 的两个 SQLite scope 查询失败没有通过放宽断言掩盖，详见 [原问题 #7](https://github.com/123wusongzhi/dsh-hallmark-app/issues/7#issuecomment-6207889537)。不能称全仓所有运行时全绿。

保留了首次整合失败记录：42 项失败包括 2 项既知、32 项旧测试 stdin 相对 import 解析失败、8 项组件依赖未链接。修复测试装载路径、复用相同锁文件对应的既有依赖后，最终完整重跑消除了新增的 40 项失败，没有修改生产逻辑规避断言。

浏览器截图、真实桌面/Windows、真实商家读写以及跳过项未完成验收。生图蓝图仅表达设计方向，不是实现截图。这里没有留存率、线上 p95 或真实发布成功率证据。外部身份切换时未保存经营草稿恢复仍属于下一批，不在本报告中宣称解决。

以下保留完整运行记录与复现命令。

---

# Integrated UX release-gate validation

Date: 2026-10-16 UTC. Exact HEAD: **03aec8bdbf38b7ddac6a17b2c2b63c48fc3303dc**.
Working directory: /workspace/scratch/69ac72838cc8/dsh-ux-integrated-20261016.

## Conclusion

The complete default suite and typecheck were run sequentially on both specified Node versions, without filtering, skipping, weakening assertions, or modifying tracked files. **No new failures remain compared with the prior complete-suite baseline. Node22 passes every non-skipped case. Node24 retains two known SQLite planner/index assertion failures and must not be described as fully green.**

| Runtime | Tests | Pass | Fail | Skipped | Cancelled | Todo | npm test exit | Typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24.21.0 / npm11.19.0 | 2273 | 2233 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22.18.0 / npm10.9.3 | 2273 | 2235 | 0 | 38 | 0 | 0 | 0 | 0 |

Each original pretest audit passed: 314 test files, zero audit failures. Native summaries agree with parsed per-case counts, including repeated names. The 38 skipped cases are not counted as passed. There are 10 added cases relative to the baseline and no removed cases; all 10 pass on both versions. The failure and skip name multisets match the baseline exactly on each runtime.

## Retained Node24 failures

1. C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded
2. scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen

Both assert /provider_records_irregular/ against the query plan. The irregular branch instead scans provider_records using sqlite_autoindex_provider_records_1. Exact diagnostics are preserved in node24.21-failure-details.txt and the raw log. These are existing failures, not resolved by this UX work. The corresponding Node22 cases pass.

## Initial failed attempt and recovery

The earlier frozen HEAD ba1849ea13c18c8235d5077c786effdcaf8d4bc5 was genuinely run and failed: Node24 had 2273 tests, 2193 pass, 42 fail, 38 skip, zero cancellations. Its evidence was retained separately at ../dsh-ux-integrated-full-suite-20261016-evidence/REPORT.md and was not overwritten.

Of those 42, 2 were known planner assertions, 32 were SDK test-harness stdin import resolution failures for the newly imported agent-action-status.ts, and 8 were missing collected-products component dependency setup failures. The parent integrated the focused harness fix and linked the existing matching-lock component dependency directories before this final run. No dependency installation occurred. All 40 additional failures from the first attempt now pass. Node22 was deliberately not started on the superseded HEAD; its absence is not reported as a pass.

## Source integrity and runtime identity

All 1389 tracked files match their exact Git blobs and their byte SHA256 values remain unchanged before and after each test/typecheck phase and across the entire run. Aggregate manifest hash: `fc2635cadfca36fb04236645a521c72b811ef36b009cbc830ae402d45c71ac8b`.

- Node24.21: actual process.execPath `/opt/codex/cua_node/bin/node`; PATH-resolved node `/opt/codex/cua_node/bin/node`; npm CLI `/opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js`; npm 11.19.0; SQLite 3.53.4.
- Node22.18: actual process.execPath `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`; PATH-resolved node `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`; npm CLI `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js`; npm 10.9.3; SQLite 3.50.2.

Only each command's PATH was prefixed with that runtime's bin directory; the package.json lifecycle and test script were unchanged. The exact default test script is `node --test --test-concurrency=1 "test/**/*.test.ts"`, reached through `npm test`, with pretest intact. NODE_OPTIONS, DSH_REAL_CORPUS, DSH_PREVIEW_BROWSER_PATH and CHROME_PATH were unset. Root and two component dependencies were reused from existing symlinks; component package-lock files were independently byte-compared to their dependency source and matched.

This validator performed no source edits, dependency install, full build, publication, skip changes or assertion relaxation. Source-preview tests generated their normal necessary artifacts. Existing dependency reuse does not validate a clean installation. These results do not cover real browser/desktop host interaction, Windows/macOS, external merchant services, skipped cases or separate .mjs entry points not selected by npm test.

## Execution order and reproduction

Each test finished naturally, then its typecheck ran; Node24 fully completed before Node22 started. No stage was interrupted or manually killed.

| Runtime | Stage | Start UTC | End UTC | Exit |
| --- | --- | --- | --- | ---: |
| 24.21 | test | 2026-10-16T04:21:59.598400+00:00 | 2026-10-16T04:26:06.571669+00:00 | 1 |
| 24.21 | typecheck | 2026-10-16T04:26:06.695634+00:00 | 2026-10-16T04:26:21.388341+00:00 | 0 |
| 22.18 | test | 2026-10-16T04:26:21.711041+00:00 | 2026-10-16T04:30:45.173519+00:00 | 0 |
| 22.18 | typecheck | 2026-10-16T04:30:45.308124+00:00 | 2026-10-16T04:31:04.965187+00:00 | 0 |

From the exact checkout with existing dependencies and prepared test data, set NODE and NPMCLI to the same runtime's absolute paths and run, completing both commands before changing runtime:

```sh
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" test
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" run typecheck
```

The baseline for per-case comparisons is the existing e4eb077 dual-version complete-suite evidence: 2263 cases, Node24.21 2223 pass/2 fail/38 skip and Node22 2225 pass/0 fail/38 skip. No performance claim is inferred from timings.

## Added cases

- agent feedback invalidates failed publications and isolates changing component identities
- agent controls show in-flight stages and original receipt state without repeating or globally blocking requests
- price journey scopes batch edits and explicitly reviews the complete submission through the production business engine
- choosing several information fields is one reversible edit and one composed preview read
- real information editor discards pending choices across store and session owners and ignores late closed previews
- hidden production board rejects refresh and changed owner reads until reactivated
- listing corrections survive interruptions and save through the real draft engine without submitting
- workspace returns to a bounded, paused full data task with its real React search and page intact
- workspace returns to a bounded, paused loaded data task with its real React search and page intact
- paused data tasks cancel timers and reads, preserve selection, resume the same query and reject stale owners

## Evidence index

- node24.21-test.log and node22.18-test.log: complete original npm lifecycle/test output
- node24.21-typecheck.log and node22.18-typecheck.log
- node24.21-outcomes.json and node22.18-outcomes.json: exact summaries, cases, baseline source and multiplicity-preserving differences for all names and each outcome
- node24.21-failure-details.txt: retained failure diagnostic blocks
- metadata.json and node*-metadata.json: runtime identity, commands, natural exits, timestamps and phase hashes
- source-integrity.json: per-file Git blob match, component lock matches and relevant environment
- tracked-before.json, tracked-after.json and all phase manifests: full byte hash evidence
- final-checks.json: machine-readable validation checks
- EVIDENCE-SHA256.json: checksums of report and evidence files

All evidence paths above are local task artifacts, not published download links.
