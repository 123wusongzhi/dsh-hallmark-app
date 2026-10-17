# Manual settings switch recovery: integrated dual-Node gate

## Exact integration and completed result

Fresh remote fetch verified baseline `23ae17ac5a14eea5f66ad9963393c3f717d4e54e`, tree `726eb0cb87c02c9a081104906656d9008c11e080`. All forty-two prior production improvements and the receipt-contract test supplement are retained.

The complete candidate sequence `4c5b9d4`, `35d60089df7dfcb7d28e375d452d251fc93e00c4`, and documentation `b9d99ac2c0b6c98354dd6306530e68b6c2c3f032` was cherry-picked. One documentation-only sanitization removed a private evidence location before the freeze.

Tested commit: `06569bdbb8efe5e10754002bd920da0e9251b027`.
Tested tree: `a91d50f6146f48bead9c39b16dc19d10542d90ab`.

The completed recovery matrix on exact official Node **22.18.0** and **24.21.0** passed **168 files /1228 tests /1226 passed /zero failed /zero cancelled /two skipped** per runtime. Both audits and typechecks exited zero. All six serial stages naturally completed, with matching test-name/outcome multisets. All previous 168 files and prior case-name/outcome multiplicities are retained. Four new cases are in the existing business-settings test file; no classification exemption was added.

All 1503 tracked files match the original pre-interruption freeze and remained unchanged before and after every recovery stage. Manifest digest: `b915076fffb5e881ba7e2e20ff1a426788e8b5bbe132d4bdb47eefac0b66108d`. The subsequent final commit adds only this report; production, tests and scripts remain byte-identical to the tested freeze.

Both audits report PASS: 346 classified test files, 188 required and 173 infrastructure files, recorded-source counts 20/20/1. These are classification counts, not executed-file totals.

## Interrupted attempt, preserved separately

The initial integration run was interrupted when its cloud execution environment became unavailable. Its only terminal stage was Node22 audit exit zero. Related-test output stopped after case 274 with no final TAP summary or stage exit. No Node22 typecheck or Node24 completion was established in that attempt. It is not a successful matrix or an established test assertion failure.

After the environment recovered, the old runner was no longer running. HEAD/tree, all tracked hashes and the built archive were verified against the original freeze. The full six stages then ran in a separate evidence directory without overwriting the incomplete output. No deadline, skip, dependency version or production/test file was changed. This report claims the completed recovery matrix above, not a first-attempt uninterrupted pass.

## Reproduced behavior and correction

The baseline manual connection selector could show a new connection while retaining the old store and editor after its target read failed. Clicking test-connection produced the new connectionId with the old storeId. A real local BusinessSettingsService dependency fixture rejects that mixed identity as a store not belonging to the connection. No merchant miswrite or incorrect persistence was established.

Manual selection now uses the existing owned switch intent. Accepted connection/store/rules remain coherent until the selected target read succeeds and is installed together. Pending or failed target reads disable the old editor's writes and expose reread, another selection or cancellation. Explicit target identity is checked, while a legitimate connection with no stores remains valid. Existing abort/intent generations reject stale completions.

Independent review found that the first candidate's add-store action could resurrect a failed request target. Final cancellation restores both request fields to the accepted scope; a deliberate new selection installs its own target in the same event. Failed/pending add-store and late-response tests cover that correction. Dirty rules, connection and packaging guards remain in place. Backend permissions, credentials protocols and pricing mathematics are unchanged.

Production `business-settings.tsx` SHA-256: `5ef41089c3787720a1ecbef9bed9a9c90ed30883de97bf55238fa5a696816d58`.
Test SHA-256: `a8769e3fe7ed411994e6444387f947625b2f4fafc2bf49ca8efbd5240cf77c4c`.

## Focused review and evidence boundaries

Author final stable-environment validation: nine files, 63/63 on each exact runtime, prepare/audit/types all pass. Independent Node24 expanded three-file matrix: 57/57. Independent Node22 initially had two packaging dependency-resolution failures overlapping replacement of an indirect dependency-link entry; those initial failures remain recorded. After using a stable direct dependency root, packaging passed 16/16; the original settings 40/40 and service 1/1 were already green. That is staged independent validation, not a claim that its original 57-case run passed. This integration creates only its own dependency entries pointing directly at the existing root and did not alter shared or author dependency links.

The initial candidate's add-store flaw and original baseline mixed-identity behavior have separate normal red controls. Expanded controls cover cancel-then-edit, late reply preserving those edits, navigation blocked during save with one write to the accepted scope, empty-store connection acceptance, and rejection of a wrong connection response. All are local production React/service-boundary evidence, not browser visual acceptance, real merchant operations, or a whole-repository suite.

Earlier intermittent workspace-resume timeouts remain unexplained; the approved diagnostics and original deadlines are unchanged. This green recovery run does not identify or repair their cause.

## Exact bundle, skips and reproduction

The frozen source bundle was rebuilt before the original gate and verified unchanged after recovery: candidate.76, 2397916 bytes, SHA-256 `fa45da3751a98ee08c00c41909de3b872489931a7206bf092e65e10a1ceec2a3`. It remains local and uninstalled. Runtime artifact isolation passed.

Two unchanged skips:
- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

The first is platform-dependent; the second needs its separate prepared/legacy archive fixture. Rebuilding the ordinary bundle does not activate that fixture. No exact-public-SHA CI result is claimed here.

Use lockfile dependencies and offline `node scripts/prepare-real-test-data.mjs`; build with `node scripts/build-apps-bundle.mjs`. Select each exact runtime in PATH and run serially:
1. `node scripts/audit-real-test-data.mjs`
2. `node --test --test-reporter=tap --test-concurrency=1` followed by the sorted deduplicated matches below.
3. `npm run typecheck`

The outer stage allowance remains 1200 seconds; individual test deadlines and skips are unchanged. The recovery matrix is complete and unfiltered.

```text
test/apps-components/*.test.ts
test/plugin-apps/*.test.ts
test/operations/*.test.ts
test/business-pricing/*.test.ts
test/operations-adapter/*.test.ts
test/apps-runtime/business-settings-http.test.ts
test/apps-runtime/workbench-http.test.ts
test/apps-runtime/workbench.test.ts
test/apps-host/business-value-projection.test.ts
test/apps-host/business-partial-status.test.ts
test/business-packaging/packaging.test.ts
test/service/packaging-settings.test.ts
test/app-hallmark/packaging-evidence.test.ts
test/materials/business-recovery.test.ts
test/performance/runtime-artifact-isolation.test.ts
test/performance/directory-draft-etag.test.ts
test/core/*.test.ts
test/app-hallmark/listing-*.test.ts
test/apps-host/listing-image-jobs.test.ts
test/apps-host/review-agent.test.ts
test/apps-host/review-agent-lifecycle.test.ts
test/apps-host/review-http.test.ts
test/apps-runtime/snapshot-during-review.test.ts
test/collection/*.test.ts
test/app-hallmark/business-plan-pages.test.ts
test/app-hallmark/business-generation.test.ts
test/app-hallmark/provider.test.ts
test/apps-runtime/runtime.test.ts
test/apps-runtime/workbench-pins-http.test.ts
```

Recovery stage durations in seconds: Node 22.18.0 audit 6.712, Node 22.18.0 related 590.169, Node 22.18.0 typecheck 49.901, Node 24.21.0 audit 3.031, Node 24.21.0 related 536.179, Node 24.21.0 typecheck 34.228.

Original interruption logs, recovery logs, source manifests, generated fixtures and archives remain local. Only selected source/test changes and sanitized human reports enter this candidate. No publication, live merchant action or raw evidence upload was performed by this integration.
