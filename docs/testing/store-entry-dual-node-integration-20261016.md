# 选店继续入口与草稿保护：双版本组合回归

实际完整运行以下 10 个相关文件的本地提交：`198b1802eeb9dde7327bbe5d8512bc224526ed73`。Node 24.21 / 22.18 各 19/19 通过，零失败/跳过/取消；两版类型检查和来源审计通过，1397 个跟踪文件逐阶段字节不变。报告在测试后补入，未改变生产或测试。

只优化经营操作未选店铺的空态：显式入口复用工作台选择器，保存成功且当前身份/页面仍匹配才返回。没有第二份店铺状态，也不更改关联总览与经营设置的独立选择语义。已复现的 React 导航/change 事件由 3 个降到 2 个，不是浏览器点击或真实用户用时。保存失败、用户另行导航或身份变化均不能被旧结果抢走页面。

本次是有界组合回归，不是本提交全仓测试，未验浏览器截图、真实桌面或商家服务。公开比较基线 `47f9be21e1697059f4989fac4dc7cc1d411187af` 与原本地红测基线生产代码相同，可用于 Git 历史复现。以下保留完整验证记录。

---

# Store selection entry and draft protection: bounded integration regression

Exact HEAD: 198b1802eeb9dde7327bbe5d8512bc224526ed73. Date: 2026-10-16 UTC.

This is a related regression run, NOT the complete repository suite. Earlier full-suite results on another HEAD must not be presented as full-suite validation of this HEAD.

## Scope and results

All 10 files matching these exact ten file paths were included, with test concurrency 1 and no name filters or modified skips: test/plugin-apps/business-store-entry.test.ts, test/plugin-apps/business-draft-recovery.test.ts, test/plugin-apps/business-draft-recovery-cache.test.ts, test/plugin-apps/business-operations.test.ts, test/plugin-apps/business-price-journey.test.ts, test/plugin-apps/listing-draft-editor.test.ts, test/plugin-apps/workspace-resume.test.ts, test/plugin-apps/workbench-ui.test.ts, test/plugin-apps/workbench-store-context.test.ts, test/plugin-apps/workspace-tab-close.test.ts.

- Node 24.21.0 / npm 11.19.0: 19 tests = 19 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.
- Node 22.18.0 / npm 10.9.3: 19 tests = 19 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.

Both recorded-data audits PASS: 317 test files, 167 required files, 165 infrastructure files, zero audit failures. Native and per-case parsed totals agree. Both Node versions have exactly the same name/outcome multiset, including repeat counts. No failure was hidden or relaxed.

Skipped cases (none if no names follow):

## Integrity and execution

1397 tracked files have identical SHA256 byte manifests before and after all six stages. Aggregate: a23c4003ff69a3e6827d802ee1a3daff844d7bec359d60925bb6f835f90a571d. No source edits, installation, full build, source-preview tests or publication were performed by the validator. Source HEAD is unchanged.

Each stage has a 600-second bound; all stages exited naturally without timing out. Order is Node24 audit, related tests, typecheck, then Node22 audit, related tests, typecheck. Each command uses the specified Node absolute path and a per-process PATH prefix for its bin directory.

- Actual execPath: /opt/codex/cua_node/bin/node; PATH node: /opt/codex/cua_node/bin/node; npm CLI: /opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T04:49:16.176636+00:00 to 2026-10-16T04:49:17.509790+00:00, exit 0.
  - related: 2026-10-16T04:49:17.572977+00:00 to 2026-10-16T04:49:29.172709+00:00, exit 0.
  - typecheck: 2026-10-16T04:49:29.242756+00:00 to 2026-10-16T04:49:44.667684+00:00, exit 0.

- Actual execPath: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; PATH node: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; npm CLI: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T04:49:44.863663+00:00 to 2026-10-16T04:49:46.797243+00:00, exit 0.
  - related: 2026-10-16T04:49:46.873813+00:00 to 2026-10-16T04:49:59.125708+00:00, exit 0.
  - typecheck: 2026-10-16T04:49:59.191495+00:00 to 2026-10-16T04:50:16.931016+00:00, exit 0.

The changed recovery UI fixture overrides global fetch with local mock routes; operations/adapter cases use their recorded fixture adapters. No live merchant workflow or real merchant write was invoked. Tests may simulate writes to fixture boundaries. This run does not prove desktop-host behavior or real merchant integration. No skipped cases are counted as passed. No claim is made about known SQLite tests outside this scope.

## Reproduction

From the exact checkout with the already prepared data and matching existing dependencies, use NODE from each specified runtime, prepend its bin to PATH, and execute sequentially:

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/plugin-apps/business-store-entry.test.ts" "test/plugin-apps/business-draft-recovery.test.ts" "test/plugin-apps/business-draft-recovery-cache.test.ts" "test/plugin-apps/business-operations.test.ts" "test/plugin-apps/business-price-journey.test.ts" "test/plugin-apps/listing-draft-editor.test.ts" "test/plugin-apps/workspace-resume.test.ts" "test/plugin-apps/workbench-ui.test.ts" "test/plugin-apps/workbench-store-context.test.ts" "test/plugin-apps/workspace-tab-close.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

## Evidence

metadata.json lists all 10 selected files, exact commands, runtimes, stage timestamps and exit codes. node*-related.log contains complete test output; node*-audit.log and node*-typecheck.log contain complete other-stage logs. node*-outcomes.json contains parsed individual results. All tracked manifests and checks.json are preserved. EVIDENCE-SHA256.json records artifact checksums. These are local evidence paths, not public URLs.
