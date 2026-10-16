# New-action form navigation protection and verification

Date: 2026-10-16 UTC. Baseline: `f654c2b46ba887d59253a2a8e86c9feba7cfa840`.

## Reproduction and behavior

The previous behavior discarded unfinished new-action input during ordinary local batch navigation:

1. Open business operations with an existing batch selected.
2. Enter a new action's offer identifier and price without adding it to the draft.
3. Select another batch, then return. Alternatively, click **New Batch**, then return.
4. Previously, the input was empty without a discard warning.

The repaired flow asks whether to continue editing or explicitly discard the new input and switch. Continue Editing preserves input. Explicit discard switches to the selected target and clears that form. Pristine and fully reverted forms navigate without a warning.

The form snapshot includes action type, pricing choice, and hidden stock, warehouse, and promotion inputs. Defaults arriving from settings do not themselves make the form dirty. New-form state is separate from existing-row edits, so adding a new action remains available. Failed or unknown receipts retain input.

Confirmation is bound to the current owner, original batch, destination, and form snapshot. Further edits, a newer destination, returning to the current destination, owner changes, hidden/busy state, and replacement batch lists invalidate stale confirmation callbacks. Discarding existing-row edits is independent and preserves new-action input.

The regression uses actual React components and the actual in-memory business engine. It covers normal enabled event handlers, cancel/discard, clean and net-zero forms, hidden fields, stale callbacks, owner/activity changes, existing-row edits, revision conflicts, successful local revise, and unknown receipts. Transport/model callbacks deny external execution. Direct calls to retired callbacks are adversarial controls, not a bypass of disabled user paths.

## Verification result

All production and test files in this distribution were verified byte-for-byte identical to the source used for the final checks. The distribution change adds this human-readable report and omits private execution evidence; it does not alter tested behavior.

The related combination ran **113 unique test files**, adding the new navigation regression to the prior 112-file scope. There was no test-name filter, new skip, or weakened assertion.

| Actual runtime | Tests | Pass | Fail | Skip | Cancelled | Data audit / typecheck |
|---|---:|---:|---:|---:|---:|---|
| Node 22.18.0 / npm 10.9.3 | 678 | 676 | 0 | 2 | 0 | PASS / PASS |
| Node 24.21.0 / npm 11.19.0 | 678 | 676 | 0 | 2 | 0 | PASS / PASS |

Both data audits covered 328 test files, 175 required recorded-data entries, and 168 infrastructure entries, with recorded-source counts 20/20/1. The newly added regression is explicitly registered as required and uses the shared recorded-data fixture. Generated browser data came from the matching tracked corpus.

The runtime case-name/outcome multisets match. Case-name and skip multisets are unchanged from the initial failing combination. The two existing skips are not passes:

- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Source bytes remained unchanged throughout each final audit → related tests → typecheck sequence. Both sequences completed naturally; no stage timed out. These are related-combination results, not a claim that the default full repository suite ran.

## Initial failures retained in the account

The first integration attempt failed the data audit because the new regression had not been classified. It was added to requiredFiles; the audit policy was not relaxed. That interrupted attempt is not represented as a completed passing gate.

The first completed 113-file combination then produced:

- Node 22.18.0: 678 total, 675 pass, 1 fail, 2 skip; audit and typecheck passed.
- Node 24.21.0: 678 total, 674 pass, 2 fail, 2 skip; audit and typecheck passed.

Two independent pre-existing timing issues explained those failures:

1. **Diagnostic identifiers:** Both runtimes asserted visible identifiers after a fixed 50 ms sleep, before the real local HTTP response had arrived. Unchanged-baseline replay reproduced the same empty-list failure. The test now waits for bounded readiness and retains the exact identifier equality assertions. Five focused repeats per runtime passed, as did a 200 ms delayed-response control. Wrong trace identifiers still fail equality, and missing diagnostics fail the three-second bound.
2. **Library rename revision:** Node 24 asserted stored revision 3 while it was still 2, before an already-existing wait for the refreshed renamed library. A diagnostic-only 120 ms request delay reproduced the failure on both baseline and candidate. The identical revision-3 assertion now follows that existing readiness wait. All 60 assertion statements remain unchanged. Normal and delayed focused tests passed on both runtimes; deliberately corrupting the stored revision to 2 still failed the moved assertion.

These are test reliability corrections, not additional product UX improvements. Neither correction changes production code, skip policy, expected identifiers, or expected revision. Fresh-worktree typechecks initially lacking generated browser data were rerun only after the documented offline preparation and audit; those setup failures are not counted as successful checks. The final complete combination above was run after both reliability corrections.

## Reproduce the checks

Use the root project's frozen pnpm lock and its documented preparation steps. No package or lockfile version changed. Select the intended Node runtime and its matching bundled npm; ensure subprocess PATH resolves that same runtime. Commands below run from the repository root and use only the tracked recorded corpus for preparation.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  "test/apps-components/*.test.ts" \
  "test/plugin-apps/*.test.ts" \
  "test/operations/*.test.ts" \
  "test/business-pricing/*.test.ts" \
  "test/operations-adapter/*.test.ts" \
  test/apps-runtime/business-settings-http.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/business-packaging/packaging.test.ts \
  test/service/packaging-settings.test.ts \
  test/app-hallmark/packaging-evidence.test.ts
npm run typecheck
```

Repeat audit, related tests, and typecheck with Node 22.18.0 and 24.21.0. The new test is already included by the plugin-apps wildcard; do not add it twice. Tests perform their required isolated builds. No installation into a running DSH instance is needed for this scope.

## Boundaries

The change protects explicit local batch navigation. External owner replacement, automatic fallback when a selected batch disappears, and closing/reloading the workspace remain outside its guarantee. No persistent global new-form cache was added.

No real-browser visual acceptance, installed native Host acceptance, Windows/macOS validation, default full-repository suite, real merchant end-to-end run, deployment, or production installation is claimed. Raw execution logs and internal manifests are not part of this publication.
