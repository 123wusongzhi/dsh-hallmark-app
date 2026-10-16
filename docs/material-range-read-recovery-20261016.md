# Viewing-range read recovery

Baseline: `d4ec107`. Implementation and regression: `b78052a`.

## User journey

While configuring a platform product table, its warehouse choices can fail independently of the table preview and source catalog. Previously the range area showed “查看范围暂未更新” without a recovery action. “刷新目录” could recover, but also reread the workbench, data-source catalog, material catalog, and store directory. This was a missing focused recovery, not an unrecoverable application or proven draft-loss bug.

The range notice now has “重新读取查看范围”. It retries the failed range read, shows a loading status, and clears the stale failure on success. Existing successful range cache entries remain reusable. No save, platform initialization, agent preparation, or merchant write is added.

## Evidence

Production `MaterialLibrary` and its React effects were exercised with `react-test-renderer`, intercepted local fetch responses, and the existing recorded product/warehouse helpers. Read failures, delay, store aliases, and empty rows are explicit scenario controls. The same new test failed against the exact baseline because the inline recovery button did not exist.

The regression verifies:

- Warehouse read count progresses 1 → 2 → 3 for failure → repeated failure → successful retry.
- During those retries, other requests remain unchanged, including catalog/workbench/store reads and the table preview.
- Edited component name and material search text survive; recovered warehouse choices can be selected.
- Loading is distinguished from the failed and successful states; retry is not offered during the held single-range request.
- A late response from a previously selected store cannot replace the current store's choices.
- Returning to a store with successful cached choices makes no additional range request.
- A successful empty directory is treated as a valid empty result, without a retry error.
- No save, initialization, preparation, or completion callback is triggered by recovery.

## Validation

Related group: `cross-source-material-ui.test.ts`, `material-agent-request.test.ts`, and `material-close-draft.test.ts` under `test/plugin-apps/`.

- Node 24.21.0: 28 tests passed.
- Node 22.18.0: 28 tests passed.
- TypeScript `tsc --noEmit`: passed under Node 24.19.0.
- Real-data classification audit: passed (328 tests, 175 required-file entries, 168 infrastructure entries).
- `git diff --check`: passed.

Raw logs stay local. This is React/service-boundary evidence, not browser interaction or visual-layout verification. Full-repository suites, bundle builds, desktop/native-host acceptance, real merchant reads/writes, and deployment were not run for this change. No latency or upstream-call-saving claim is made.
