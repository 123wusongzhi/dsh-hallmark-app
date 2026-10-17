# Batch results survive a late resume read

## Reproduced user problem

Baseline: `d5a0733abd763634b2e43e8b1b0110a94d8f0357`.

A user confirms a three-row listing batch, changes tabs while submission is running, then returns. Returning starts a batch-list read. That read captures the first row as dispatching and the remaining rows as draft. Before its response arrives, the real local engine finishes with succeeded, rejected and pending rows. The UI initially shows those results correctly. The late list response then restores the older dispatching/draft rows while the receipt notice still says one completed row and one platform-processing row. A late failed list response can instead remove the just-received table.

Execution changes row statuses without incrementing the plan revision: both snapshots in the reproduction are revision 1. Comparing plan revision alone would not fix this ordering problem.

This concerns same-owner, same-plan ordering between a resumed list read and a completed operation result. It is separate from progress ownership, no-op retry guidance, published-context changes, material save receipt identity, restore-form preservation and missing-batch bulk intent. It does not establish a platform duplicate-write defect.

## Narrow fix

Each editor counts accepted operation results. A list read records that count when it begins. If a result was accepted while that read was outstanding, the old success or failure cannot replace the newer receipt. Instead, the editor reads the list again. This is a read-only refresh, not a resend. Ordinary reads that complete before the operation still work, and the fresh read can show genuinely newer server state. Existing owner cancellation remains authoritative.

No backend execution, permissions, retry eligibility, timeouts, revision semantics or persistence policy changed. A pending row remains platform-processing rather than completed. Browser/workspace reload durability was not changed.

## Evidence and controls

`test/plugin-apps/business-resume-receipt-order.test.ts` mounts production React and invokes the real BusinessOperations engine backed by an isolated SQLite RuntimeStore. Product, store and purchase-cost bases use the recorded corpus; offer aliases, transport outcomes and delayed responses are explicit local controls. No merchant network or paid review is called.

Five scenarios cover:

- A late successful snapshot after a mixed succeeded/rejected/pending result
- A late failed read after that result
- A fresh replacement read accepting a later server status change
- The ordinary read-first ordering, with no extra refresh
- Owner retirement before the old response, with no receipt notice leaking to the new editor

All scenarios also cancel the first scope confirmation (zero submissions), invoke the next confirmation twice (one submission), verify toolbar refresh is disabled during submission, and observe one local execution per row. Reading again never executes rows again. The fixed subprocess deadline is 20 seconds with exit/signal/error/stdout/stderr diagnostics.

On both official Node 22.18.0 and 24.21.0, the exact baseline and a guard-removal negative control each fail three scenarios and pass the two ordinary/owner controls. The initial exploratory probe used wording that is not rendered for completed rows; that first assertion failure is retained locally. The corrected probe uses the production row-status nodes and deterministically reproduces the late overwrite. No deadline or valid behavioral assertion was relaxed.

## Frozen source

Source/test/classification commit: `89006cab0609a7f99728b2f61a717bd6ad57a891`.

- Production `business-operations.tsx` SHA-256: `527f38ede4f367d949d819c09205240c6abea27a78f276cfd1075a6e005f704e`
- Regression test SHA-256: `28cdbcbaa42e53b10bf1557bc425cfa37266a32bc5e53b6b7b69fa23a6005ffb`

## Final focused validation

Exact official Node **22.18.0** and **24.21.0** each passed the same **21 files / 114 tests / 113 passed / zero failed / zero cancelled / one existing skip**. Case-name/outcome multisets match. The unchanged skip is the platform-dependent project skill installer case. Preparation, full `tsc --noEmit`, and real-data audit all exited zero on both runtimes; the audits classified 347 test files, 189 required source-backed files and 173 infrastructure files. `git diff --check` passed. No candidate gate was retried. Production, tests and classification remained identical to the frozen commit after validation.

Independent review approved the same frozen commit. Its expanded test plus existing batch-intent and store-read tests passed **13/13** on each official runtime. Additional probes verified a later manual refresh accepts same-revision changes, two accepted results crossing one old read still cause only one replacement read, and failure of that replacement read remains bounded with explicit manual recovery. The two-result probe deliberately invokes a previously captured inspect callback; it does not claim a disabled UI button is clickable. The independent adapter initially passed the wrong argument shape to `engine.inspect`; those first failures remain retained and were corrected only in the fixture. Independent historical replay yielded 2 passes/4 failures, and its selected guard-removal cases yielded 3 failures on both runtimes.

The receipt notice describes the accepted operation. A later authoritative list may legitimately show newer outcomes; this patch does not redefine the notice as a live aggregate. It also does not solve arbitrary stale server responses for reads that begin after the receipt. Existing uncertainty/recovery and authorization contracts remain unchanged.

## Reproduction

Use the locked existing dependencies, with the exact official Node runtime on PATH. Run `node scripts/prepare-real-test-data.mjs`, then:

```sh
node --test --test-reporter=tap --test-concurrency=1 test/plugin-apps/business-*.test.ts test/operations/*.test.ts test/apps-host/business-partial-status.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
```

For the focused guard-removal control, set `DSH_BULK_REMOVE_GUARD=1` and run only the new test. For baseline replay, first save `git show d5a0733abd763634b2e43e8b1b0110a94d8f0357:packages/plugin-apps/client/business-operations.tsx` to `artifacts/bulk-feedback/baseline-business-operations.tsx`, then set `DSH_BULK_BASELINE=1` for the new test. Both substitutions keep the same assertions and deadline.

This is local React/engine verification, not native browser, live merchant, installed-bundle, full-repository or exact-public-branch acceptance. No publication, deployment or user-computer changes were made. Raw logs and generated fixtures remain local.
