# Saved business draft recovery, isolated next-batch candidate

Baseline: `ba1849ea13c18c8235d5077c786effdcaf8d4bc5`. This candidate is separate from the frozen integration build. No install, merchant write, full build, publication or full repository test run was performed here.

## Scope and mechanism

- Saved listing/price batches retain payload edits, pricing choices and unapplied raw JSON across externally forced session/store changes while BusinessOperations remains mounted.
- A private outer cache keys snapshots by the exact session, connection and store. An inner editor is keyed by that identity, so a new owner never renders the old owner's state before effects clear it.
- Returning to an owner starts with no plan fields or recovery action. Only a successful list with the same plan ID, store and revision enables explicit “恢复修改”. No automatic merge. A mismatching/missing batch offers discard only; failed/403 reads expose neither cached content nor restoration, and ordinary refresh can retry safely.
- Restored edits remain dirty and use the existing save-draft path, never submit automatically. Invalid JSON can be restored verbatim, then corrected/applied or discarded using existing controls.
- Cache bounds: 4 owners, 1 MiB total serialized UTF-8 data, 256 KiB per owner, 30 minutes. Exceeding the entry cap rejects retention; count/total limits evict the oldest snapshot. Expiry and loss reasons are visible generic notices with no old product titles. Cache access respects expiry immediately; a minute timer removes expired data and is cleaned up on unmount.
- Actual workspace/component unmount clears this private cache; no localStorage, module-global draft pool or server persistence was added. The new UI explicitly calls this temporary unsaved state, not a saved draft.

## Deliberate exclusions

No promise of recovery after app changes that unmount BusinessOperations, browser refresh, close, process restart or crash. Newly typed not-yet-added actions, unfilled batch-price input, navigation save/discard/stay prompts and persistence remain separate work. Local retained tabs already preserve edits and remain interruption-free.

## Files

- `packages/plugin-apps/client/business-operations.tsx`: keyed owner editor, snapshot capture and explicit verified restoration; parent-owned raw JSON.
- `packages/plugin-apps/client/business-draft-recovery.ts`: private bounded cache, clone isolation, TTL, explicit retention outcomes.
- `test/plugin-apps/business-draft-recovery.test.ts`: real AppsWorkspace→BusinessOperations lifecycle using recorded listing/store data with explicit UI aliases and controlled failures.
- `test/plugin-apps/business-draft-recovery-cache.test.ts`: pure cache count/byte/expiry/clone boundaries.
- `test/real-data/test-scope.json`: both tests classified; recorded/infrastructure distinction retained.

## Verification

Focused seven tests passed: new recovery/cache tests plus existing business-content-lazy, business-operations and listing-draft-editor tests. Coverage includes:

- Every observed committed new-owner frame excludes private old-owner title/description/raw text.
- Same plan/row IDs across different owners never hydrate one another.
- Held initial list does not display old fields or a restoration action.
- Explicit restoration followed by dirty-state controls, rejected-save retry and successful draft save.
- Invalid raw JSON and applied structured edits survive chat changes together.
- 403 read failure, successful explicit retry, plan/revision mismatch.
- Late old-owner save and list responses cannot update the new owner.
- Four-owner eviction, oversized input rejection, exact byte bounds, TTL and timer cleanup.

TypeScript `tsc --noEmit` passed. Formal recorded-data audit passed with 316 tests, 166 required files, 165 infrastructure files, immutable source counts 20/20/1, zero failures. All component fetches are local mocked boundaries; no merchant submit route is allowed.

Reproduction evidence and targeted output are retained in the isolated worktree's `evidence/draft-loss/` directory. Initial red probes are historical evidence of the baseline and now pass against the implementation; the initial characterization scenario deliberately asserts baseline loss and should not be treated as a candidate regression gate.

## Adjacent checks and independent review

Four adjacent tests also passed: business-price-journey and workspace-resume (both paused data modes plus owner/read cancellation). Total focused/adjacent checks: 11 passed.

A read-only independent review found a P2 stale restoration panel on staggered cache expiry: the second expiry reused the same notice value, allowing React to skip the needed update. The candidate now increments an independent cache-render generation for every successful timer prune. A formal regression leaves the first expiry notice visible and verifies that the second expiry removes the recovery action and re-enables editing. The reviewer independently reran both new files (3/3 passed) and approved within the stated mounted-wrapper scope. No other blockers were reported.
