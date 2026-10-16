# 店铺读取与关联总览错误恢复：双版本组合验证

比较基线为公开 `707142c833e6e4036ecbbb88f91347e059b8abdc`。实际双版本运行的精确本地整合为 `da58a23b39efe78e882ebe23d1650cefa4b25046`；本报告在运行完成后补入，不改变已测生产或测试。发布提交可能具有不同父链。

本轮是两项独立交互改进：

1. 店铺读取失败可恢复。经营操作区分读取中、错误、列表为空及选中 ID 不可用，提供重新读取和已有选店入口。挂起可取消重读，500ms 防双击，忽略取消的旧响应仍不能污染新身份；成功编辑器保活及原草稿缓存不被清除。工作台新增独立店铺列表重试，错误→错误→成功为 stores 读取1→2→3，已成功 workbench 目录始终只读1次，保存/完成回调均0。不默认替用户换店。
2. 关联总览在旧请求被取消、替换上下文没有可发请求时，结束遗留 busy。原版切到无店铺连接会永远显示读取中、遮住配置空态；修复后显示准确空态或错误。无店铺时刷新仍应禁用，不把解除假 loading 理解为可查询不存在的店铺。旧响应隔离保持。

指定14文件双Node各28/28通过，零失败/跳过/取消；两版来源审计（320测试文件）和类型检查通过，逐阶段源码哈希不变。这不是全仓测试，也不是浏览器截图、真实桌面或商家服务验收；未执行商家写入。其他页面已有正确重试路径的情况已排除，不为凑数量计入问题。

分别参见 [经营操作](../business-store-read-recovery-ux-20261016.md)、[工作台](../workbench-store-read-recovery-20261016.md)、[关联总览](../association-loading-lifecycle-20261016.md) 的真实组件复现和边界。以下为完整组合运行记录。

---

# Store recovery and association lifecycle: bounded integration regression

Exact HEAD: da58a23b39efe78e882ebe23d1650cefa4b25046. Date: 2026-10-16 UTC.

This is a related regression run, NOT the complete repository suite. Earlier full-suite results on another HEAD must not be presented as full-suite validation of this HEAD.

## Scope and results

All 14 files matching these exact fourteen file paths were included, with test concurrency 1 and no name filters or modified skips: test/plugin-apps/business-store-entry.test.ts, test/plugin-apps/business-draft-recovery.test.ts, test/plugin-apps/business-draft-recovery-cache.test.ts, test/plugin-apps/business-operations.test.ts, test/plugin-apps/business-price-journey.test.ts, test/plugin-apps/listing-draft-editor.test.ts, test/plugin-apps/workspace-resume.test.ts, test/plugin-apps/workbench-ui.test.ts, test/plugin-apps/workbench-store-context.test.ts, test/plugin-apps/workspace-tab-close.test.ts, test/plugin-apps/business-store-read-recovery.test.ts, test/plugin-apps/workbench-store-retry.test.ts, test/plugin-apps/association-loading-lifecycle.test.ts, test/plugin-apps/association-overview-ui.test.ts.

- Node 24.21.0 / npm 11.19.0: 28 tests = 28 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.
- Node 22.18.0 / npm 10.9.3: 28 tests = 28 pass, 0 fail, 0 skip, 0 cancelled, 0 todo. Audit and typecheck exit 0.

Both recorded-data audits PASS: 320 test files, 169 required files, 166 infrastructure files, zero audit failures. Native and per-case parsed totals agree. Both Node versions have exactly the same name/outcome multiset, including repeat counts. No failure was hidden or relaxed.

Skipped cases (none if no names follow):

## Integrity and execution

1404 tracked files have identical SHA256 byte manifests before and after all six stages. Aggregate: b4912058cab918dec18b2f939051bb0da5f048d5aef779f54b652fbea89d2127. No source edits, installation, full build, source-preview tests or publication were performed by the validator. Source HEAD is unchanged.

Each stage has a 600-second bound; all stages exited naturally without timing out. Order is Node24 audit, related tests, typecheck, then Node22 audit, related tests, typecheck. Each command uses the specified Node absolute path and a per-process PATH prefix for its bin directory.

- Actual execPath: /opt/codex/cua_node/bin/node; PATH node: /opt/codex/cua_node/bin/node; npm CLI: /opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T05:01:01.498949+00:00 to 2026-10-16T05:01:02.987454+00:00, exit 0.
  - related: 2026-10-16T05:01:03.054521+00:00 to 2026-10-16T05:01:16.809953+00:00, exit 0.
  - typecheck: 2026-10-16T05:01:16.878764+00:00 to 2026-10-16T05:01:33.177691+00:00, exit 0.

- Actual execPath: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; PATH node: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node; npm CLI: /workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js.
  - audit: 2026-10-16T05:01:33.357867+00:00 to 2026-10-16T05:01:35.293035+00:00, exit 0.
  - related: 2026-10-16T05:01:35.366050+00:00 to 2026-10-16T05:01:49.722243+00:00, exit 0.
  - typecheck: 2026-10-16T05:01:49.785070+00:00 to 2026-10-16T05:02:07.985042+00:00, exit 0.

The changed recovery UI fixture overrides global fetch with local mock routes; operations/adapter cases use their recorded fixture adapters. No live merchant workflow or real merchant write was invoked. Tests may simulate writes to fixture boundaries. This run does not prove desktop-host behavior or real merchant integration. No skipped cases are counted as passed. No claim is made about known SQLite tests outside this scope.

## Reproduction

From the exact checkout with the already prepared data and matching existing dependencies, use NODE from each specified runtime, prepend its bin to PATH, and execute sequentially:

```sh
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1 "test/plugin-apps/business-store-entry.test.ts" "test/plugin-apps/business-draft-recovery.test.ts" "test/plugin-apps/business-draft-recovery-cache.test.ts" "test/plugin-apps/business-operations.test.ts" "test/plugin-apps/business-price-journey.test.ts" "test/plugin-apps/listing-draft-editor.test.ts" "test/plugin-apps/workspace-resume.test.ts" "test/plugin-apps/workbench-ui.test.ts" "test/plugin-apps/workbench-store-context.test.ts" "test/plugin-apps/workspace-tab-close.test.ts" "test/plugin-apps/business-store-read-recovery.test.ts" "test/plugin-apps/workbench-store-retry.test.ts" "test/plugin-apps/association-loading-lifecycle.test.ts" "test/plugin-apps/association-overview-ui.test.ts"
"$NODE" "$NPMCLI" run typecheck
```

## Evidence

metadata.json lists all 14 selected files, exact commands, runtimes, stage timestamps and exit codes. node*-related.log contains complete test output; node*-audit.log and node*-typecheck.log contain complete other-stage logs. node*-outcomes.json contains parsed individual results. All tracked manifests and checks.json are preserved. EVIDENCE-SHA256.json records artifact checksums. These are local evidence paths, not public URLs.
