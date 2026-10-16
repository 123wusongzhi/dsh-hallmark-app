# Packaging combination reread: keep unsaved edits

## Frozen scope and reproduction

Baseline: `6ac157a1dc8ad1717d48dca5d6e9665e756671e9` (the cumulative local integration). Public comparison reference supplied for this task: `test/cross-module-regression-20261015` at `abe630b626165aa6b179cc3ef38a07d9ab1fd168`; this report does not claim a test run on that public commit.

Code/test candidate: `04c54fb3b9291f5145f950f3cef9fadfc55af947`, tree `4518deddfdf098aafd003c40c8e3d598034ac7b5`.

A user saves a two-SKU combination, changes its weight to 0.88 kg and dimensions to 30 × 12 × 8 cm, then opens “修改组成另存” and clicks “计算组合并加入表格” without changing the composition. The unchanged baseline replaces the dirty row from the read response: weight becomes blank and the entered dimensions are lost. With an intervening writer, the read instead replaces weight with that writer's 0.99 kg and would adopt its newer revision.

The new regression exercises real React `BusinessSettings`, its real API request bodies, `BusinessSettingsService`, `BusinessPackagingRepository`, and an isolated SQLite `RuntimeStore`. Product/package/SKU facts come from the integrity-checked frozen corpus; identifiers, edited numbers, deferred/failed reads, and the second local writer are explicit controls. All exercised ordinary controls and their ancestors must be enabled. There are no merchant calls.

## Minimal change

Only `packages/plugin-apps/client/business-settings.tsx` changes in production. After a successful combination read, if the returned key already has unsaved edits, preserve the existing row, values and original compare-and-swap revision. Close the composition editor and explicitly say that this read did not replace the original draft. Do not save, retry a write, or claim the read's new values have been applied.

- An unchanged clean combination still accepts fresh read values and revision.
- A different quantity creates a separate combination; the original dirty row remains intact.
- The guard checks the latest state when the read resolves, including a directly exercised late callback.
- A failed read leaves both composition editor and table draft available for an explicit read retry.
- A conflicting external write still produces `PACKAGING_REVISION_CONFLICT` on explicit save; it is not silently overwritten or presented as successful.

Identity follows the existing service/repository contract: composition keys contain item ID, source SKU ID and quantity, and exclude the cosmetic combination alias. Duplicate members are combined while preserving first-seen order. The existing key is order-sensitive; this change does not sort, migrate or merge distinct ordered keys. A reversed-order transport control verifies it remains separate. Packaging storage and the UI component are scoped by collection connection, not individual business store; no new cross-connection state is introduced.

## Reproduction and controls

The original reproduction was run before production edits on both exact Node 22.18.0 and 24.21.0 runtimes and failed at the lost-weight assertion (`''` instead of `'0.88'`). The final eight-case test was subsequently replayed against the exact baseline production file with unchanged assertions on both runtimes:

- Four failures: dirty same-key reread, successful reread after a read failure, intervening writer, late-handler edit.
- Four passing negative controls: clean reread, changed quantity, cancel composition editing, reversed member order.

The late-handler case directly calls an already captured React handler during a held read. Ordinary table inputs are disabled while that read is pending. This is a robustness probe, not evidence of browser typing through disabled inputs.

Two intermediate harness errors were retained locally: the initial conflict oracle used `PACKAGING_CONFLICT` rather than the service's actual `PACKAGING_REVISION_CONFLICT`; an early reversed-order injection also affected initial setup and changed the input label. These were corrected without changing production or relaxing timeouts. They are not additional product defects. The original failing logs and first reproduction source remain available locally.

## Verification commands

Use the frozen corpus via `DSH_REAL_CORPUS`, and each exact runtime:

```
node scripts/prepare-real-test-data.mjs
node --test --test-concurrency=1 test/plugin-apps/packaging-composition-continuity.test.ts test/plugin-apps/packaging-input-recovery.test.ts test/plugin-apps/packaging-settings.test.ts test/service/packaging-settings.test.ts test/business-packaging/packaging.test.ts test/apps-runtime/business-settings-http.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
```

On frozen candidate `04c54fb3b9291f5145f950f3cef9fadfc55af947`, both exact Node 22.18.0 and 24.21.0 runtimes passed:

- Six related test files: 48/48 each, including all eight new cases.
- TypeScript `tsc --noEmit`: exit 0 each.
- Real-data audit: PASS each, 344 test files and 187 required files.
- `git diff --check`: clean.

Production SHA-256: `f169cb3ad46a7e99389aa5d2ef09c47e475a7a59c114b33d839bd74fe312d3ef`.
Test driver SHA-256: `659cb0489ae7a63b090c57fb77d6ac701af021574b607e95a15be21e3e2c9881`.
Fixture SHA-256: `936dfb92264028fafc38f85998738f1a3e242e019cdd3620129c65e43b848614`.

Independent read-only review approved this same production hash. Its isolated extension covered explicit clearing, conflict recovery by explicit reread (revision 2) followed by save (revision 3), and connection isolation; its related runs passed 26/26 on each runtime. Those isolated probes are review evidence, not extra tests in this candidate or a claim of native browser typing. Raw evidence and SHA-256 manifests remain local; no private corpus or raw log is published.

## Boundaries

No publication, push, installation, real merchant access, external agent, model review, live browser interaction, native host validation, or raw data upload occurred. No full-repository suite is claimed. Material-library indefinite pending/unknown saves, save-panel unknown writes, and packaging write-outcome reconciliation are unchanged. This is protection of a local dirty combination from an explicit read, not a new persistent draft system or a general product-detail editor redesign.
