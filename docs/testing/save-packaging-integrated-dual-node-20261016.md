# Save-panel read recovery and packaging audit: integrated validation

Date: 2026-10-16 UTC. Public baseline: `89e10425e0c1163df11ac47df890bf042b5f4957`.
Tested source: `d4d39455105e99c3ff2402746689dad85c1ecc3e`; tree: `ec3059d681bbdd2e82806b3e1105c1352e651fc4`.
This separate report is added after testing and changes no tested source or tests.

## Product correction and supplemental audit

The save panel now distinguishes a failed metadata read from an unpublished view and offers an explicit inline read retry. Repeated retry clicks coalesce into one read. Names entered before the first successful read and existing notes survive recovery, and later read failures preserve already verified metadata. Existing save/conflict policy and uncertain-write protections remain unchanged; retry does not replay writes. See [save-panel reproduction and controls](../save-panel-read-recovery-20261016.md).

Independent review exercised late old-owner reads, busy and uncertain writes across metadata failures, retained fields, correct new-owner write targeting and no replay. Both exact runtimes passed the independent focused/adversarial checks and typechecks before integration.

The [packaging input audit](../packaging-input-audit-20261016.md) adds regression coverage only. Controlled React events and the real local service verify numeric boundaries, complete dimensions, explicit clearing, restore-automatic and discard behavior. No new production defect was established, and this audit adds no UX-fix count. Browser-native invalid numeric typing and `validity.badInput` remain unverified after an ordinary Chromium launch was blocked by process-singleton socket permissions. No sandbox/security workaround was attempted. The synthetic-event coverage does not establish browser typing semantics or a destructive-edit defect.

## Complete dual-runtime results

| Actual runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 119 | 689 | 687 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 119 | 689 | 687 | 0 | 2 | PASS | PASS |

Both versions have identical case-name/outcome multisets. Relative to the previous 117-file, 687-case combination, two files and two cases were added. No case was removed or renamed and no skip changed:
- save controls retry a failed view read in place and retain entered save fields
- packaging numeric rejection, correction, explicit clear and reset preserve service semantics

Existing skips are excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both data audits pass: 334 test files, 179 required entries, 170 infrastructure entries, recorded source counts 20/20/1. Both new classifications survived integration exactly once. Matching browser fixture data was prepared offline from this checkout's tracked corpus.

Each runtime ran audit, related tests and typecheck serially. Related-test concurrency was one, with a 900-second external stage allowance and unchanged test-specific deadlines. All six stages exited zero naturally; this integration had no failed or timed-out stage. All 1454 tracked files remained byte-identical before and after each stage. Combined source SHA-256: `c27abdd7ba31bf5ac94718bd9297bd354dd7ccabcf37ba9160c8e54a82f161c0`. The final report-only commit preserves the tested production and test bytes.

## Earlier failures and limits retained

The save-panel regression failed against the baseline at its missing retry action on both runtimes. Removing the edited-title preservation guard separately failed the exact retained-name assertion. These are recorded reproduction/fault controls, not candidate failures hidden from the final count.

Both authors' fresh-worktree checks initially lacked generated browser fixture data and initially flagged the new test as unclassified. Documented offline preparation and explicit registration preceded their successful retries. The packaging test also initially expected stored null properties after clearing; the repository intentionally stores absent properties, so the test oracle was corrected without production changes. These initial failures remain documented in the linked reports and their raw evidence remains local.

## Reproduction

Install frozen-lock dependencies and follow repository offline-data preparation instructions. Select each exact Node runtime and its matching npm/PATH, then run:

```sh
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

Allow 900 seconds externally for each stage. The new files are already included by the patterns; do not append them again.

This is the related 119-file combination, not the full repository suite. It does not establish browser pixels, installed Native Host behavior, Windows/macOS acceptance, real model/merchant behavior or performance gains. No live merchant request/write, deployment or desktop installation occurred. Publication remains a separate reviewed step. Only selected source/tests, classification and human-readable reports are in the publication tree; raw logs, internal manifests, generated fixtures and probes stay local.
