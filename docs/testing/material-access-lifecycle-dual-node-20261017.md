# Material editor metadata-denial lifecycle

## Scope and reproduced defect

Local baseline: `07af99fb156d9ba7c408bb47d60336c35509219f`.

The material editor owned a separate accepted workbench, source definitions, draft and preview lifecycle. Its metadata catch displayed an error but retained that accepted board. The Workspace also converted explicit denied `null` into ambiguous `undefined` when passing its snapshot to the editor. Local production React fixtures reproduce metadata HTTP 403 and 404 leaving the old preview mounted (actual 1, expected 0). This proves stale UI/capability lifecycle, not unauthorized backend access.

## Correction

The editor distinguishes explicit parent denial, temporary failures, and successful catalog/metadata acceptance. Non-fallback whole-board metadata errors follow the existing shared cache policy. They invalidate the local board, clear the accepted preview snapshot, unmount the preview, abort outstanding catalog reads and suspend related range/initialization effects. Parent denial reaches hidden editors without losing its null meaning.

A denial epoch expires previously obtained mutation/prepare handlers and late callbacks. Ordinary stale parent snapshots and successful old mutation receipts cannot clear it. A fresh successful metadata/catalog read restores access; a later 503 cannot unlock the denied state. Refreshing a catalog does not itself replay a save.

User configuration and request drafts remain local and hidden while access is denied. Recovery does not erase them. Temporary 503/network/unreadable-success responses retain legitimate drafts and preview under the existing fallback policy. A component-only data-read 404 is not promoted into whole-app denial. Store-specific draft cleanup is not triggered by the temporary absence of a denied workbench.

## Already-sent writes and limitations

A save sent before denial may still succeed on the server. The correction does not claim to cancel or undo it. A still-pending save retains its existing close/app-switch lock through metadata recovery and is never replayed by that recovery. Its late success cannot revive an expired editor capability or steal navigation.

This is not an unknown-write state machine. The existing `appsWorkbench` wrapper has no independent persistent lock for network exceptions or unreadable mutation receipts after the request promise rejects. This change neither certifies nor repairs all such states; it preserves current error behavior and adds no automatic save retry. Broader unknown-result recovery needs a separate bounded investigation.

Only local React/API-boundary mocks and repository runtime tests are used. No real unauthorized server request, live merchant write, desktop/browser acceptance, installation or publication is performed. Source changes are limited to the material editor and its Workspace wiring; service permissions and mutation admission are unchanged.

## Evidence integrity

Original red logs, intermediate candidate logs, a first workspace-only rollback timeout at the unchanged 15-second fixture deadline, and an interrupted matrix remain separate. The interruption reported an executor-key change and no stage exit; it is neither a passing nor a failed completed matrix. Equivalent boolean existence assertions subsequently produced normal behavior-red Workspace-only rollback results on both official Node versions, independently reviewed. No deadline or asserted behavior was weakened. The timeout's root cause is not established solely by this comparison.

## Independent first-commit findings

The first correction still depended on passive state updates for parent denial. Independent layout observation proved that a parent-null commit could retain the editor before those effects ran. The formal regression now observes the actual committed React tree and invokes the previously captured save handler from a layout observer; it changes no business conditions. A parent-null render edge expires the action epoch immediately and hides the editor/preview in that first commit. This is React commit-boundary evidence, not a claim of observed browser painting or visual flicker.

A second independent regression changes `active=false` to `active=true` in the same commit that provides parent `null`. The old passive-effect closures could still start a second automatic initialization or range read (2 requests instead of 1), even though the render had already marked its synchronous denial reference. Both automatic effects must check that same reference before starting work. The tests count real production fetch-boundary calls, hold metadata recovery, and use only local mocked responses. They do not establish that any real server accepted an unauthorized action.

## Final frozen-source validation (2026-10-17 UTC)

Tested source commit: `44b518deda18b5bbdd04895d8a4525dc183b8dff`.
Tested tree: `a8b1b988d5eab8e91ce10160f6ff1e6f31fc33bc`.
This report is a subsequent documentation-only commit; its commit was not independently retested. Production and tests are unchanged from the tested source.

The completed recovery run used the original gate commands, without widening fixture timeouts. The interrupted final run had no terminal matrix summary or source-after manifest and is not counted as a pass. Earlier candidate results are historical and do not substitute for this final run.

| Runtime | Files | Tests | Pass | Fail | Cancelled | Skipped | Todo | Audit | Types |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Node 22.18.0 | 79 | 305 | 303 | 0 | 0 | 2 | 0 | exit 0 | exit 0 |
| Node 24.21.0 | 79 | 305 | 303 | 0 | 0 | 2 | 0 | exit 0 | exit 0 |

Both related suites naturally exited 0. The full test-name/result multisets match, preserving duplicate counts. Each runtime's identity log verifies its exact executable and the matching PATH prefix. Existing dependencies were reused; no clean-install or whole-repository test claim is made.

Scope: all 76 `test/plugin-apps/*.test.ts` files, plus `test/apps-runtime/workbench-http.test.ts`, `test/apps-runtime/workbench.test.ts`, and `test/apps-runtime/workbench-pins-http.test.ts`. The runner sorts this 79-file list and invokes the selected Node with `--test --test-reporter=tap --test-concurrency=1`, with no test-name filter in the positive matrix. It first runs `scripts/prepare-real-test-data.mjs` and `scripts/audit-real-test-data.mjs`, and subsequently runs `node_modules/typescript/bin/tsc --noEmit`. Each data audit reports PASS for 345 test files, 188 required files and 172 infrastructure files, with source counts 20/20/1 and zero audit failures.

The two unchanged skips, which are not passes:

- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

### Negative controls and independent approval

Each exact runtime completed four source-rollback controls with nine expected assertion failures in total, zero cancellation and no ETIMEDOUT. Source files were restored after each rollback:

- Material editor rollback to `07af99fb156d9ba7c408bb47d60336c35509219f`: five metadata-denial tests fail normally (401/403/404 JSON and 403/404 HTML).
- Workspace-only rollback to that baseline: the hidden-editor parent-denial test fails normally.
- Material editor rollback to `985ac918e3fabc032993cf2850f3ce0ebe07a98d`: the actual first-layout-tree and expired save-handler regression fails normally.
- Material editor rollback to `92b71d579d2f11b07a33a64050329c5fde0c3a3a`: the two same-commit resume/denial automatic-effect regressions fail normally, observing two requests instead of one.

Independent final review approved the exact frozen production/test commit `44b518deda18b5bbdd04895d8a4525dc183b8dff`, with 14/14 focused tests on each exact runtime, no failures or cancellations. That approval replaces earlier candidate approvals and remains bounded by the scope and limitations above. The author recovery matrix is separate corroborating evidence.

### Source integrity

All 1,497 tracked files match byte-for-byte between the before and after manifests. The runner also compared them after every preparation, audit, related-test and typecheck stage. The complete serialized manifest SHA256 is `6cfd1e63eb4ac933a6f80be0458097f4649935d19d5f0f29b56d4863445e6c71`.

Final production SHA256:

- `packages/plugin-apps/client/material-library.tsx`: `2a1e18bc462ec3a4ec65a3d027f4080f0ec0cafa9b2d0161292bee5e024a5537`
- `packages/plugin-apps/client/workspace.tsx`: `1a4b6c6f31b1c50bc18932fe0ddf9a89c7c09571c83736311df7e5531ca8f836`

Recovery positive-stage elapsed seconds:

| Runtime | Prepare | Audit | Related | Types |
| --- | ---: | ---: | ---: | ---: |
| Node 22.18.0 | 0.578 | 22.269 | 231.843 | 28.188 |
| Node 24.21.0 | 0.640 | 1.867 | 222.394 | 36.252 |

Raw local logs, test data and interruption evidence are retained privately and are not included in this documentation commit. No publication or external integration was performed by this validation step.
