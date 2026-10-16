# 切店意图与旧提交确认：双版本组合验证

本轮包含一个新交互改进（经营设置正确跟随外部店铺意图及跨连接路由）与原 #77 的补充（返回后旧提交确认失效提示），不把后者另计新项。比较基线公开 f6404b5；实际测试本地 `9da0866e0bf59a92d2bf5e7be0c39e549f0accea`。本报告在测试后补入，已测生产和测试字节不变。

Node22.18/24.21 各18文件61/61通过，零失败/跳过/取消；来源审计321文件、typecheck通过，1409个跟踪文件逐阶段字节不变。作者原小回归使用24.19与24.21，Node22结论来自这次独立完整组合运行，不来自摘要推断。

#77 原版本guard已阻止旧提交，没有误写。补修为读取核对期间正确标记并禁提交，最新版本变化/缺失/拒绝时撤销旧确认并解释，同版本仍保留，不能自动改快照后提交新内容。参见 [专项说明](business-confirmation-revalidation-20261016.md)。

以下是组合运行全文，不是此提交全仓，也未包含仍独立开发中的素材库关闭保护。真实浏览器/桌面/商家服务未验。

---

# Business confirmation and pricing store intents: bounded integration regression

Exact HEAD: 9da0866e0bf59a92d2bf5e7be0c39e549f0accea. Date: 2026-10-16 UTC.

This is a related regression run, NOT the complete repository suite. Both runtime results below are independently executed in this validation, including Node22.18; no author summary substitutes for a run. The separate Material-close guard candidate is not included. Earlier full-suite results on another HEAD must not be presented as full-suite validation of this HEAD.

## Scope and results

All 18 files matching these exact eighteen file paths were included, with test concurrency 1 and no name filters or modified skips: test/plugin-apps/business-store-entry.test.ts, test/plugin-apps/business-draft-recovery.test.ts, test/plugin-apps/business-draft-recovery-cache.test.ts, test/plugin-apps/business-operations.test.ts, test/plugin-apps/business-price-journey.test.ts, test/plugin-apps/listing-draft-editor.test.ts, test/plugin-apps/workspace-resume.test.ts, test/plugin-apps/workbench-ui.test.ts, test/plugin-apps/workbench-store-context.test.ts, test/plugin-apps/workspace-tab-close.test.ts, test/plugin-apps/business-store-read-recovery.test.ts, test/plugin-apps/workbench-store-retry.test.ts, test/plugin-apps/association-loading-lifecycle.test.ts, test/plugin-apps/association-overview-ui.test.ts, test/plugin-apps/business-confirmation-revalidation.test.ts, test/plugin-apps/business-settings.test.ts, test/plugin-apps/packaging-settings.test.ts, test/apps-runtime/business-settings-http.test.ts.

- Node 24.21.0 / npm 11.19.0: 61 tests = 61 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.
- Node 22.18.0 / npm 10.9.3: 61 tests = 61 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.

Both recorded-data audits PASS: 321 test files, 170 required files, 166 infrastructure files, zero audit failures. Native and per-case parsed totals agree. Both Node versions have exactly the same name/outcome multiset, including repeat counts. No failure was hidden or relaxed.

Skipped cases (none if no names follow):

## Integrity and execution

1409 tracked files have identical SHA256 byte manifests before and after all six stages. Aggregate: 27b3d60f4329c392a7f2143bd217532c2725d66052cbef2b089b3fa0d0c35e4d. No source edits, installation, full build, source-preview tests or publication were performed by the validator. Source HEAD is unchanged.

Each stage has a 600-second bound; all stages exited naturally without timing out. Order is Node24 audit, related tests, typecheck, then Node22 audit, related tests, typecheck. Each command uses the specified Node absolute path and a per-process PATH prefix for its bin directory.

- Actual execPath: /opt/codex/cua_node/bin/node; PATH node: /opt/codex/cua_node/bin/node; npm CLI: /opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T05:40:06.498958+00:00 to 2026-10-16T05:40:07.902619+00:00, exit 0.
  - related: 2026-10-16T05:40:07.976998+00:00 to 2026-10-16T05:40:30.454842+00:00, exit 0.
  - typecheck: 2026-10-16T05:40:30.522081+00:00 to 2026-10-16T05:40:47.471155+00:00, exit 0.

- Actual execPath: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; PATH node: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; npm CLI: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T05:40:47.645597+00:00 to 2026-10-16T05:40:49.631398+00:00, exit 0.
  - related: 2026-10-16T05:40:49.699790+00:00 to 2026-10-16T05:41:11.712342+00:00, exit 0.
  - typecheck: 2026-10-16T05:41:11.780833+00:00 to 2026-10-16T05:41:30.479765+00:00, exit 0.

The changed recovery UI fixture overrides global fetch with local mock routes; operations/adapter cases use their recorded fixture adapters. No live merchant workflow or real merchant write was invoked. Tests may simulate writes to fixture boundaries. This run does not prove desktop-host behavior or real merchant integration. No skipped cases are counted as passed. No claim is made about known SQLite tests outside this scope.

## Reproduction

From the exact checkout with the already prepared data and matching existing dependencies, use NODE from each specified runtime, prepend its bin to PATH, and execute sequentially:

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/plugin-apps/business-store-entry.test.ts" "test/plugin-apps/business-draft-recovery.test.ts" "test/plugin-apps/business-draft-recovery-cache.test.ts" "test/plugin-apps/business-operations.test.ts" "test/plugin-apps/business-price-journey.test.ts" "test/plugin-apps/listing-draft-editor.test.ts" "test/plugin-apps/workspace-resume.test.ts" "test/plugin-apps/workbench-ui.test.ts" "test/plugin-apps/workbench-store-context.test.ts" "test/plugin-apps/workspace-tab-close.test.ts" "test/plugin-apps/business-store-read-recovery.test.ts" "test/plugin-apps/workbench-store-retry.test.ts" "test/plugin-apps/association-loading-lifecycle.test.ts" "test/plugin-apps/association-overview-ui.test.ts" "test/plugin-apps/business-confirmation-revalidation.test.ts" "test/plugin-apps/business-settings.test.ts" "test/plugin-apps/packaging-settings.test.ts" "test/apps-runtime/business-settings-http.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

## Evidence

metadata.json lists all 18 selected files, exact commands, runtimes, stage timestamps and exit codes. node*-related.log contains complete test output; node*-audit.log and node*-typecheck.log contain complete other-stage logs. node*-outcomes.json contains parsed individual results. All tracked manifests and checks.json are preserved. EVIDENCE-SHA256.json records artifact checksums. These are local evidence paths, not public URLs.
