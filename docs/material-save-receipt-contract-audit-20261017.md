# Material save receipt recovery contract audit · 2026-10-17

## Finding

No new production defect was established in the inspected **returned network / unreadable-response** path using already-saved source references. Do not add an unknown-write coordinator solely for this case. A lost save response remains unconfirmed: a subsequent matching workbench read is not proof that this particular request succeeded.

Baseline: `0c64b87eca5156da766ea1efea9c86fb2b91855a`. This audit adds configuration-only regression coverage, not a production change or a new counted issue.

## Existing contract

- `packages/app-presentation/src/workbench.ts`: `save` validates instances and performs `expectedRevision` comparison inside the store transaction before changing the workbench. Duplicate instance IDs are rejected. `saveWithDrafts` also checks revision before validation and again transactionally before committing sources and the board; this is a static code observation, not exercised by the new tests.
- Workbench storage is app-scoped (`workbench:${appId}`), not chat-scoped. This path has no operation ID or durable per-save receipt. The route in `packages/service/src/workbench-routes.ts` allows only `expectedRevision`, `instances`, and `context` for save.
- `packages/plugin-apps/client/material-library.tsx`: a returned save error retains the local draft and its instance ID, releases the pending UI lock, and exposes the existing “重新读取” action. It does not automatically resend, declare completion, or infer completion from equal fields.
- Retrying with the original revision after a committed write is rejected by CAS. Reading again does not send a save request (directly asserted in the new regression). An explicit save after reading uses the newly read revision and the retained instance ID; it is a **new user action**, not recovery of an authenticated receipt for the old request.
- Existing remote instances are selected by instance ID, not title. An explicit re-save after reading replaces the matching instance rather than appending another copy, including a newly added draft whose first response was lost.

## Local executable evidence

`test/plugin-apps/material-save-receipt-audit.test.ts` bundles the production React workspace and material editor. Its local fetch adapter invokes the real `WorkbenchLibrary.save`, including derivation and CAS, backed by the real SQLite `RuntimeStore(':memory:')`. All six scenarios use already-saved source references and execute `save`, not `saveWithDrafts`. Capability metadata and preview payloads are isolated configuration fixtures; no merchant records, merchant writes, network services, or external agents are used.

Six scenarios cover:

1. Real store commit followed by thrown transport error; original-revision retry cannot commit twice, explicit read plus save can proceed.
2. Real store commit followed by unreadable JSON; same CAS and recovery result.
3. Explicit rejection before any store write; deliberate retry can succeed.
4. Later remote modification, same-title different identity, and deletion; stale saves are rejected, reads do not write or claim completion.
5. Returned lost-response error followed by chat/application changes in the mounted workspace; no implicit resend and no write to the other application's workbench.
6. New-instance addition with a same-title existing instance; lost response retains the original generated ID, read does not clear dirty state as if a receipt had arrived, and a subsequent explicit add updates that ID without duplicating it.

## Limits

- This is local React / repository-runtime evidence, not native desktop, real Host transport, or merchant acceptance. Committing embedded source drafts through `saveWithDrafts` is outside the executed scope; its validation/registration side effects are not covered by these six scenarios.
- Cross-chat assertions concern the currently mounted workspace lifecycle only. They establish neither cross-process persistence nor a user-account authorization boundary.
- A read is current state, not a historical receipt. The original request's attribution remains unknown after a lost response, even when the fields match.
- Reading a later remote change does not perform a merge or guarantee that a subsequent explicit save preserves that changed instance. The user is making a fresh save of their retained draft against the new revision. No automatic write is performed.
- A request that has not returned is a different pending-lifecycle case, covered by existing material-close tests; this audit does not add timers or change that behavior.
- No failed baseline reproduction was manufactured: all six targeted baseline scenarios passed. Original run logs are retained locally, not included in this source-only deliverable.

## Validation

Completed validation is recorded below; no full-suite or deployment claim is made.

Commands use the exact Node executable for each version, not a version range:

```sh
node --version
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
node --test --test-concurrency=1 \
  test/plugin-apps/material-save-receipt-audit.test.ts \
  test/plugin-apps/material-close-draft.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts
```

Results on Node **v22.18.0** and **v24.21.0**:

- Prepare: exit 0 on both.
- Real-data classification/hash audit: PASS on both, 346 discovered test files, no failures.
- TypeScript `--noEmit`: exit 0 on both.
- Related group above: **38/38** on each version.
- New regression cases within that related group: **6/6** on each version.
- `git diff --check`: clean.

Each new React fixture subprocess has a fixed 15-second timeout, matching the adjacent material-close fixture; failure diagnostics preserve status, signal, process error, stdout and stderr. No existing deadline was extended.

These are baseline-green contract tests; there is no red-to-green production-fix claim. The six new regression cases do not increase the count of confirmed user-facing defects.

## Independent negative controls

An independent reviewer replayed the original six cases on both exact Node versions, then changed only isolated copies:

- Removing the `save` transaction's revision comparison made both lost/unreadable-response tests fail normally on both versions: a second commit occurred where one was expected.
- Regenerating a new draft's instance ID only in the save-error catch made the new-instance identity test fail normally on both versions: the post-read identity no longer matched the originally committed instance.

These deliberate mutations establish that the new coverage detects loss of the existing guards. They are not defects in the baseline, production patches, or timeout failures. Mutated copies and their raw diagnostics are not part of this deliverable.
