# Batch-price refresh continuity — 2026-10-16

## Confirmed gap

Baseline: `be66b2a8c78d9ed38bcc4d08a2925699458b97cc`.

With the new-action form empty, select a price row and optionally enter an unapplied batch price or choose a batch currency. If a successful refresh omits the selected batch but returns a different batch, the original UI automatically selects that other batch and clears the unapplied price. If both plans contain the same locally valid row ID, the other plan inherits the checked selection. This was observed through the production React component and the real BusinessOperations engine, not inferred from source alone.

This differs from the existing missing-batch new-form protection: the new-action form here is clean. It also differs from inspection-selection preservation: this uses the batch-list refresh path, not platform inspection.

## Minimal change

The latest committed presence of selection, unapplied batch price or explicit batch currency retains the current batch identity when refreshed results omit it. The response still replaces the server-derived plan list; old rows are not retained. The missing-batch placeholder explains that local work is retained and offers refresh or explicit navigation to another batch. Existing explicit navigation clears selection and batch inputs, including from the placeholder. Clean, net-zero input still permits the ordinary automatic fallback.

No new write, save, submission, permission bypass, cache persistence or price computation is introduced. Selection alone does not block explicit navigation. Switching stores still retires the editor rather than carrying these transient batch inputs to another store.

## Evidence

`test/plugin-apps/business-batch-refresh-continuity.test.ts` has four independent paths: unapplied price, selection only, explicit currency without selection, and clean/net-zero control. It uses recorded product/store bases with explicit local offer aliases and a shared cross-plan row ID. Local reads use the actual business engine; merchant transport/review are forbidden and all UI requests remain list reads.

Covered paths include ordinary same-batch refresh with a filter, missing and empty lists, failed reads, HTTP 401 and 403, no retained editable stale rows, disabled new-action writes while missing, recovery of the original batch, explicit navigation from the missing placeholder, clearing bulk inputs/selection on that navigation, retired delayed response after newer navigation, and store isolation.

Historical replay uses `DSH_BATCH_REFRESH_BASELINE=1`; guard-removal negative control uses `DSH_BATCH_REFRESH_REMOVE_GUARD=1`. Both retain identical assertions and the fixed 20-second subprocess timeout. Against both exact Node 22.18.0 and 24.21.0, baseline and negative control each produce 3 failures and 1 passing clean control; the candidate passes all 4. Baseline diagnostics explicitly observe the other batch's inherited checked row.

The initial typecheck exposed missing contextual types in the new test plugin, and the initial corpus audit rejected an unclassified new test. Both initial logs were retained; the test plugin was typed and the required recorded-data classification was added. No assertion or timeout was relaxed.

## Final focused validation

Source/test commit: `aafbdaa0cc0ce3f7aeb8abd655423ed02bc3c9e1`.
Production file SHA-256 (`business-operations.tsx`): `51b33021a8f763338d9d4b3dc1159f0ab25132f2ee1bb58833e80d23aba99b4a`.

On exact Node **22.18.0** and **24.21.0**:

- Eleven related test files: **17 passed, 0 failed** on each runtime.
- `prepare-real-test-data.mjs` ran before types; final `tsc --noEmit` passed on both runtimes.
- Final real-data audit passed on both: 343 test files, 186 required recorded-data files, no failures.
- `git diff --check` passed.

The related set includes the new continuity test, price journey, inspection selection, new-form refresh/navigation, restore-input recovery, discard recovery, confirmation revalidation, draft recovery, ordinary operations and store-read recovery. Raw logs remain local-only.

## Boundaries

This is not a full repository, browser visual/layout, native-host or live merchant acceptance pass. It does not claim a new defect for input during disabled batch controls, nor does it change explicit navigation's existing discard semantics, whole-workspace refresh persistence, or same-plan row identity contracts. Missing rows are not a permission to write. No publication or deployment was performed.
