# Context and pricing feedback: integrated dual-runtime validation

Date: 2026-10-16 UTC. Public baseline: `de509221a5a79f6b6faa247bfa0341796086420c`.
Tested source: `a4ca0ed52e4ccb12e1a3f167edb1d676094dd7e6`; tree: `1be9e99f32574713c238c63f5e109dd5a1653046`.
This report is added after validation and changes no tested source or tests.

## Two user-visible corrections

1. After a previously published Agent context changes locally, its editable status explains that the user must update context before requesting the Agent. Existing in-flight progress and locked submission guidance retain priority. This is display feedback only; submission, identity, revision, retry and busy-state behavior are unchanged. See [context reproduction and controls](agent-context-feedback-audit-20261016.md).
2. Rejected pricing-rule saves now expose actionable field guidance through the existing public error envelope, including logistics-plan ordinals and limits in UI units. Static labels and application-owned guidance do not echo arbitrary names, unknown keys or input values. Calculations, validation acceptance, persistence, permissions and submission semantics are unchanged. See [pricing reproduction and controls](../pricing-validation-recovery-20261016.md).

Both regressions were reproduced through production React/local service boundaries on the unchanged baseline. Controls cover recovery, retained drafts, duplicate prevention, unchanged revisions for rejected saves, and no merchant calls. Independent review cleared both source candidates before integration.

## Complete results

| Actual runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 117 | 687 | 685 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 117 | 687 | 685 | 0 | 2 | PASS | PASS |

Both versions have identical complete case-name/outcome multisets. Against the previous 115-file, 683-case combination, two files and four cases were added; no existing case was removed or renamed and no skip changed:
- agent context feedback distinguishes unpublished edits from the prior local service snapshot without loosening pending locks
- invalid settings expose localized field recovery without relying on raw schema details
- pricing validation guidance does not echo user-controlled names, unknown keys or values
- pricing validation identifies invalid fields and preserves editable rules through correction and retry

Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both corpus audits pass with 332 test files, 178 required entries, 169 infrastructure entries and source counts 20/20/1. Integration preserves both new registrations exactly once. Browser fixture data was prepared offline from the matching tracked corpus.

## Initial timeout and completed retry

The initial Node 24 related-test attempt reached reported case 683 without a `not ok` result, but the external 600-second stage limit interrupted it before the final four cases and TAP summary were recorded. That attempt is incomplete and is not counted as a pass. Its raw evidence is retained locally. Node 22 completed its entire related stage in approximately 524 seconds. No resource-exhaustion cause was established by the subsequent disk/memory snapshot.

After the initial attempt, Node 24 typecheck completed successfully. The exact same frozen 117-file Node 24 command then ran with a 900-second external allowance and completed naturally in **620.469 seconds**, exit zero, with all 687 terminal results shown above. Test-specific timeouts, assertions, concurrency and case selection were unchanged; no failures were filtered or skipped. Node 22 was not needlessly rerun. Both audits, both typechecks and both completed related-test results are now confirmed. The initial timeout remains part of the history rather than being rewritten as a passing first attempt.

All 1448 tracked files remained byte-identical before and after every stage and the retry. Combined source SHA-256: `1d3394be50e04de660cec9fd9583f39956467dd8c98a41b0e2ebd5dafb19588b`. The separate report commit preserves the tested production and test bytes.

## Reproduction

Use the repository's frozen dependency lock and offline recorded-data preparation. Select each exact Node version and its matching npm/PATH, then run:

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

Allow at least 900 seconds externally for the related stage on this machine. The two new files are already included by the patterns; do not append them again.

## Boundaries

This is a 117-file related combination, not the full repository suite. It does not establish browser visual/layout acceptance, installed Native Host behavior, a live Agent/model result, merchant-network behavior, Windows/macOS acceptance or performance improvement. No deployment or desktop installation occurred. Publication is a separate reviewed step.

Only selected source/tests, classification and human-readable reports are in the publication tree. Raw logs, internal manifests, generated fixtures and diagnostic probes remain local.
