# 外部身份切换的经营草稿恢复：双版本相关回归

比较基线为已发布的 `b823ad8137b79b4b5548e2d5afa311d9a5fa8dd4`。本次精确运行本地整合 `bff2acff36d0f1db7efe5bdeba3967fb4aab7190`，报告在测试结束后补入；发布提交父链可能不同，但测试过的生产与测试字节不变。

本项保护当前组件仍挂载时，已保存批次中尚未保存的上品/调价/原始 JSON 修改。外部切店铺或聊天后，返回原身份且服务器批次修订一致，才可手动恢复。权限失败不展示缓存，新身份首帧不显示旧草稿。不承诺刷新、真实卸载、退出应用、新增动作表单恢复；内存最多 4 个身份/1 MiB，单项 256 KiB，30 分钟到期，明确提示暂存不等于保存。

双 Node 的四目录 61 文件相关测试均为 338 项：336 通过、0 失败、2 跳过。两版数据来源审计、类型检查通过。1394 个跟踪文件各阶段字节不变。没有重新跑本提交的全仓测试，不能把前一批全仓结果挪到本提交；未验浏览器/真实桌面/商家服务，也未将跳过项算通过。

前后复现与容量/权限边界详见 [修复说明](../business-draft-recovery-review-20261016.md)。以下为完整相关运行记录。

---

# Business draft recovery: bounded related regression

Exact HEAD: bff2acff36d0f1db7efe5bdeba3967fb4aab7190. Date: 2026-10-16 UTC.

This is a related regression run, NOT the complete repository suite. Earlier full-suite results on another HEAD must not be presented as full-suite validation of this HEAD.

## Scope and results

All 61 files matching these four patterns were included, with test concurrency 1 and no name filters or modified skips: test/plugin-apps/*.test.ts, test/operations/*.test.ts, test/business-pricing/*.test.ts, test/operations-adapter/*.test.ts.

- Node 24.21.0 / npm 11.19.0: 338 tests = 336 pass, 0 fail, 2 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.
- Node 22.18.0 / npm 10.9.3: 338 tests = 336 pass, 0 fail, 2 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.

Both recorded-data audits PASS: 316 test files, 166 required files, 165 infrastructure files, zero audit failures. Native and per-case parsed totals agree. Both Node versions have exactly the same name/outcome multiset, including repeat counts. No failure was hidden or relaxed.

The two unchanged skipped cases are:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

## Integrity and execution

1394 tracked files have identical SHA256 byte manifests before and after all six stages. Aggregate: ef139ecf89808bef368f08863d319e57812a2aa2244a8025c3733a1efa512584. No source edits, installation, full build, source-preview tests or publication were performed by the validator. Source HEAD is unchanged.

Each stage has a 600-second bound; all stages exited naturally without timing out. Order is Node24 audit, related tests, typecheck, then Node22 audit, related tests, typecheck. Each command uses the specified Node absolute path and a per-process PATH prefix for its bin directory.

- Actual execPath: /opt/codex/cua_node/bin/node; PATH node: /opt/codex/cua_node/bin/node; npm CLI: /opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T04:36:40.380521+00:00 to 2026-10-16T04:36:41.820084+00:00, exit 0.
  - related: 2026-10-16T04:36:41.891952+00:00 to 2026-10-16T04:38:04.499050+00:00, exit 0.
  - typecheck: 2026-10-16T04:38:04.560419+00:00 to 2026-10-16T04:38:19.284754+00:00, exit 0.

- Actual execPath: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; PATH node: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; npm CLI: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T04:38:19.491508+00:00 to 2026-10-16T04:38:21.380843+00:00, exit 0.
  - related: 2026-10-16T04:38:21.445592+00:00 to 2026-10-16T04:39:45.910071+00:00, exit 0.
  - typecheck: 2026-10-16T04:39:45.981933+00:00 to 2026-10-16T04:40:03.286810+00:00, exit 0.

The changed recovery UI fixture overrides global fetch with local mock routes; operations/adapter cases use their recorded fixture adapters. No live merchant workflow or real merchant write was invoked. Tests may simulate writes to fixture boundaries. This run does not prove desktop-host behavior or real merchant integration. The two skips are not passes. No claim is made about known SQLite tests outside this scope.

## Reproduction

From the exact checkout with the already prepared data and matching existing dependencies, use NODE from each specified runtime, prepend its bin to PATH, and execute sequentially:

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

## Evidence

metadata.json lists all 61 selected files, exact commands, runtimes, stage timestamps and exit codes. node*-related.log contains complete test output; node*-audit.log and node*-typecheck.log contain complete other-stage logs. node*-outcomes.json contains parsed individual results. All tracked manifests and checks.json are preserved. EVIDENCE-SHA256.json records artifact checksums. These are local evidence paths, not public URLs.
