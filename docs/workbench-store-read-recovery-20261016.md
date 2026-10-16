# Workbench store-read recovery

Baseline: `9542fb263b66a0f8b65db5aca6c493b337e4d50b`.

When `workbench` succeeds but `stores` fails, the board previously showed the store error without a recovery action. Its existing “重新读取工作台” control was conditional on the separate board error. Leaving the tab and returning already retried the failed store request; this was a missing in-place recovery, not an unrecoverable application.

The store error now offers “重新读取店铺”, backed by its own read revision. This retries only the store directory, preserves the successful board cache, and neither selects nor saves a store. Existing explicit selection and its one-shot return callback are unchanged. This belongs to the same store-read recovery journey as the business-operations panel.

Validation:
- `DSH_STORE_RETRY_BASELINE=9542fb2 node --test test/plugin-apps/workbench-store-retry.test.ts`: RED at the missing inline recovery assertion.
- `node --test test/plugin-apps/workbench-store-retry.test.ts test/plugin-apps/business-store-entry.test.ts`: PASS (2 tests). Exercises repeated failure, successful explicit retry, no workbench reread, successful directory caching, no writes, and no selection-complete callback; also reruns the existing navigation/selection flow.
- `node scripts/audit-real-test-data.mjs`: PASS (318 tests, 168 required-file entries, 165 infrastructure entries).
- `node node_modules/typescript/bin/tsc --noEmit`: PASS.

The regression uses production React and fetch interception, recorded store data, and explicitly empty board/network control fixtures. All network activity is local simulation; no merchant action, publish, deployment, dependency installation or full bundle build occurred. No browser interaction or visual-layout claim is made.

## Requested dual-runtime verification

The focused group includes `workbench-store-retry`, `business-store-entry`, `workbench-store-context`, and `workbench-cards`: 4 files, 6 tests, all passed under each runtime. Both runtimes also passed the real-data classification audit and TypeScript check in this same checkout with its generated fixture files.

- Node v24.21.0, actual execPath `/opt/codex/cua_node/bin/node`.
- Node v22.18.0, actual execPath `/workspace/scratch/69ac72838cc8/dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/bin/node`.

The inline recovery sequence has store-read counts 1 → 2 → 3 (403 → 403 → success), with board-read count fixed at 1. Saves/POSTs and selection-completion callbacks stay at 0. No first store is selected automatically. Leaving and returning after success does not add reads.
