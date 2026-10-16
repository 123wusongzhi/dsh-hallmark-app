# Restore navigation preserves unfinished new-action input

## Reproduction and scope

Baseline: `e847b11a0a9f15da5bd1b7d98ae0c699a9a0d7a2`.
Candidate source/test commit: `aac6aa99d0a191f7020bc829651aca7836160e15`.
Production `packages/plugin-apps/client/business-operations.tsx` SHA-256:
`d97048423c1c48ed18692bdae58fb3250cee87343517838e12857c4a6e559a95`.

A mixed listing batch contains a completed listing and another row awaiting user input. The user selects the completed listing, fills the separate new-action form, then clicks “恢复所选已完成项”. Baseline creates a recovery batch and selects it immediately. The keyed new-action form remounts, discarding its input without the discard confirmation already used for explicit batch navigation.

The final regression runs the production React component and real BusinessOperations engine against an in-memory StorePort with all fetches intercepted locally. Both exact Node 22.18.0 and 24.21.0 fail on the unchanged baseline at the observable batch selection assertion: expected original batch, received a new UUID. Initial failing runs were retained, then the final expanded test was also rerun against the unchanged baseline on both runtimes. No timeout was enlarged.

## Narrow change

Reuse the existing navigation confirmation instead of introducing a reset form or requiring users to manually clear hidden fields. The restore-specific wording explicitly says it generates a recovery draft, enters a new batch and discards the displayed new-action inputs. It distinguishes already-added actions, which remain saved in the original batch, from inputs not yet added. The existing dirty snapshot may still include already-added values, so the message does not claim every visible input is unsaved.

No restore request is made until approval. Cancel retains the form and selection. Approval is tied to the current owner, batch object, selected completed row IDs and complete new-action snapshot. Changes retire the confirmation. A current-render permit also prevents a previously captured clean-form restore handler from bypassing the later dirty state. Existing single-flight and pending receipt handling are retained.

The input is not reset at approval: known failure preserves it; only successful navigation replaces it. During the request, existing busy protection locks form inputs, batch selection and checkboxes. Clean forms still restore directly. No engine, provider, authorization, restore eligibility or merchant behavior is changed.

## Controls

The new regression covers:
- Cancel with zero restore calls, zero new plans and unchanged input/selection.
- Old clean handler; stale confirmations after input, selection, same-revision saved content refresh, tab hiding and chat changes.
- Known failed restore keeps the input and selected original batch.
- A late response cannot select a recovery batch in a different chat.
- Hidden stock input remains protected after switching back to price.
- Repeated clean clicks and repeated confirmation invoke restore once per explicit attempt.
- Busy fields cannot receive ordinary user edits while an approved restore is pending.
- Real engine produces an archive draft for the selected completed listing. Original completed/needs-user statuses and plan revision remain unchanged.
- No review, transport execute, transport inspect or submit occurs. Source unavailability is an explicit local control; source facts and store presentation use the recorded UI corpus.

## Validation

Offline browser fixtures were prepared before type checking. Final focused tests run serially with default case timeouts:

```
node --test --test-concurrency=1 \
 test/plugin-apps/business-restore-input-recovery.test.ts \
 test/plugin-apps/business-new-form-navigation.test.ts \
 test/plugin-apps/business-new-form-refresh.test.ts \
 test/plugin-apps/business-operations.test.ts \
 test/plugin-apps/business-inspect-selection.test.ts \
 test/plugin-apps/business-recovery-actions.test.ts \
 test/plugin-apps/business-discard-recovery.test.ts \
 test/plugin-apps/business-confirmation-revalidation.test.ts \
 test/plugin-apps/listing-draft-editor.test.ts \
 test/operations/business-operations.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
git diff --check
```

Final focused regression: 38/38 tests pass on each runtime, with zero failures, cancellations or skips. All ten listed files were retained. Typecheck and real-data audit pass on both Node 22.18.0 and 24.21.0. All final validation stages exited zero naturally without reruns. `git diff --check` passes. The data registry contains 342 test files, 185 required source-backed entries and 172 infrastructure entries; source counts remain 20/20/1.

## Boundaries

This is local React/engine verification, not browser visual acceptance, full repository regression, installed bundle validation or real merchant testing. No desktop, external agent, paid model/image service, credentials or platform write was used. Nothing was published. The initial disable-only experiment was superseded after review found no practical one-click clear operation and the existing dirty snapshot could retain already-added values; its passing tests are not used as final-candidate evidence.
