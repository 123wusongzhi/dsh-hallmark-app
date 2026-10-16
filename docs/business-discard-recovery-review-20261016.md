# Business draft discard and revision-conflict recovery

## Reproduced issue

Baseline: `9384e50ecb9902df2e9c7cd398c20c484457551c`.

A user edits a saved batch, another actor advances its revision, and saving the local draft fails with `BUSINESS_PLAN_VERSION_CHANGED`. The editor retains the user's input, but disables refresh, batch selection, new batch, inspection and submission. There is no way to discard applied edits in place. Restoring the original field value still counts as dirty; hiding and returning does not read the new revision. Another save sends the old expected revision again.

This is an in-place recovery dead end, not a claim that every escape is impossible: fully unmounting the workspace loses the edits and resets the editor. It is distinct from preserving drafts across store/session changes. Clearing an empty search was separately checked and preserved applied edits; no search-clearing data-loss issue was found.

## Behavior

- A dirty saved batch offers `放弃未保存修改`, followed by a local explanation and `保留修改` / `确认放弃并重新读取`.
- Opening or cancelling the prompt does not read or write anything and preserves input.
- Explicit confirmation drops only this editor owner's recovery snapshot and clears its applied payload, raw JSON, pricing edits, bulk input, selection, search and obsolete submission confirmation. It requests the latest saved batch; it does not submit a merchant operation.
- Failed reads have retry guidance. A missing original batch remains explicitly identified as unavailable instead of selecting another batch. Explicit new-batch or batch selection remains the user's choice and does not trigger a recovery read.
- The separate, not-yet-added business-action form stays mounted during the recovery read, including failures. Its fields are outside the discard scope.
- New edits, hiding, owner changes and write-state changes invalidate the discard confirmation. Old callbacks cannot discard a newer draft or submit an obsolete confirmation. In-flight or uncertain mutations keep their existing receipt-recovery lock; discard cannot bypass it.

## Verification

`test/plugin-apps/business-discard-recovery.test.ts` mounts the actual React editor and uses the actual business-operation engine with an isolated local store. Recorded product/store facts supply the fixture, with explicit local fault and revision modifications. The source adapter deliberately fails locally; semantic review and merchant execution are forbidden and counted as zero.

The test covers real revision 1 → 2 compare-and-swap failure, cancel with zero calls, explicit discard and revision-2 read, successful revision-2 save, search preservation, pricing/raw/bulk cleanup, independent form preservation, failed-read retry, missing original batch, explicit new/select navigation, stale confirmation callbacks, hide/return, cross-owner cache isolation and pending → unknown write lock.

The baseline test fails on the absent discard button after the real engine conflict. The candidate passes. Independent review additionally checked a held read, owner navigation while it is pending, late results, and submission revalidation after recovery. It found an initial explicit-new-batch regression; that was corrected and added to the formal test before final validation.

Related dual-Node validation uses Node 22.18.0 and 24.21.0: real-data classification audit, TypeScript, all `test/plugin-apps/business*.test.ts`, listing draft editor, core business operations and submission recovery. Results: 95 tests per runtime, 94 passed, 0 failed, 1 skipped. This is a related regression set, not the whole repository. The skipped test is not counted as a pass.

No real merchant traffic, external model calls, dependency installation, publication, deployment or browser visual acceptance was performed.
