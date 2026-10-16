# Table refresh continuity: integrated dual-runtime validation

Date: 2026-10-16 UTC. Public baseline: `5c98536651f449d3db599ed71a539994804e9327`.
Tested source commit: `776fa770202f573b540622bc193f32e4791fbcc3`. Tested tree: `17c7162c21c9c56808786fbe2c3a5a5520f6d421`.
This report is added after the gate and changes no tested source or tests.

## Scope and behavior

The sole production change preserves a generic table's current local page when a replacement snapshot has the same dataset identity. A changed dataset, remote batch or owner still resets its local page; smaller results clamp to a valid page. Local search/sort reset behavior and permission-error removal remain covered. It does not reduce provider requests or promise faster refresh. See [table continuity reproduction and focused coverage](../table-browse-continuity-20261016.md).

A supplemental [listing validation feedback audit](listing-validation-feedback-audit-20261016.md) extends an existing regression with source validation and source-unavailable faults. It confirms saved input and diagnostics survive, correction revalidates, unrelated fields remain intact, and no review or submission occurs. No new production defect was established there, so it adds no UX-fix count.

## Frozen integration gate

| Actual runtime | Unique files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 115 | 683 | 681 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 115 | 683 | 681 | 0 | 2 | PASS | PASS |

Both versions have identical case-name/outcome multisets. Against the previous 114-file, 682-case combination, one table continuity file and one test were added; no cases were removed or renamed and no skips changed. The listing controls extend an existing case.

Existing skips, not counted as passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both corpus audits report 330 files, 177 required entries, 168 infrastructure entries, and source counts 20/20/1. The new test is registered as required. Browser fixture data was generated offline from this checkout's matching tracked corpus.

Each runtime ran audit, related tests, then typecheck serially, with test concurrency one and a 600-second limit per stage. All six stages exited zero naturally. All 1442 tracked file hashes remained unchanged before and after every stage. Combined source SHA-256: `5d42f618041d67a244b0c5f611dcf8152de70806bb314b17913d5434e53a8f91`. This integration gate had no failing stage. The table regression failed against baseline in the author's and independent reviewer's checks; that red result is retained as reproduction evidence, not counted as a successful candidate test. The earlier refresh/range gate's three failures and readiness corrections remain documented in its [unchanged report](refresh-range-integrated-dual-node-20261016.md).

## Reproduction

Install the frozen lockfile dependencies and follow repository instructions to prepare the recorded data offline. For each exact Node version, select the matching npm and PATH, then run:

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

The new test is already included by the plugin-apps pattern. Do not append it again.

## Limits and distribution

This is the related 115-file combination, not the default full repository suite. There was no live merchant request or write, model review, desktop installation, deployment, real-browser interaction or visual acceptance test. Independent identity controls checked changed query/source identity as well as the committed batch/owner controls. The production change concerns local reading continuity; browser latency and real provider performance were not measured.

Publication material contains only selected source/tests, classification and human-readable reports. Raw execution logs, source/file manifests, diagnostic probes and generated fixtures remain local. Publication is a separate reviewed step.
