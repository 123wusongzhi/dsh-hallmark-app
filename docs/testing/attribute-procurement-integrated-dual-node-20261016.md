# Attribute recovery and procurement diagnostics: integrated validation

Date: 2026-10-16 UTC. Public baseline: `5a438458d8e79d56d2f7aa25108adc8b683e72db`.
Tested commit: `d3dd9ed7417ae36a503f09829800b515fcd5515d`; tree: `621775994d307be51084a04ac9d3dd4cf95f04cd`. This report is added after the gate; tested source, tests and scripts are unchanged.

## Bounded changes

**Unknown category attribute recovery:** the original request still fails with a specific code and retryPolicy never. Its bounded structured details identify unknown input positions and limited IDs, and provide a same-store cursor into the exact inspected category constraint snapshot. Optional constraints remain available through existing pagination. This is read-cache recovery, not successful preparation, a listing draft or a merchant write. The snapshot does not freeze future provider dictionary versions. See [reproduction and controls](../attribute-recovery-guidance-20261016.md).

**Procurement diagnostics:** the editor displays existing explicit source item/SKU/quantity and bounded backend candidates as escaped static text. Failed SKU validation no longer presents a retained old binding/cost as verified. Exact indexed source-reference matching, completeness states, local edits, hidden views, unverified rereads and uncertain/completed states remain guarded. Candidates are not automatically selected or applied. Rendering and typing introduce no additional reads/writes; existing discard, resume and explicit refresh keep their necessary saved-batch rereads. A batch reread does not promise current source freshness. Submission eligibility, owner isolation and confirmation fingerprints are unchanged. See [reproduction and controls](../procurement-diagnostics-ui-20261016.md).

Selected author commits: `59ff1b235686950df908cdd4a165e357cb771d19`, `58e18b7a5556f8892500726037e437123405ec1b`, `9dbace4cb2a48c1f9c4fd53c55139c809af9dc89`, `1acf56413ddb72919a6a001c5bb1d94a1357c0f3`. All candidate production, test and classification files were verified byte-identical after integration.

## Frozen results

| Runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 157 | 1136 | 1134 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 157 | 1136 | 1134 | 0 | 2 | PASS | PASS |

All six stages exited zero naturally. Case-name/outcome multisets match. Every prior 156-file case is retained; the new procurement-diagnostics file is the sole additional file. The existing listing-category-retry file contains the other new regression. No earlier case was removed or renamed. Matching recorded browser fixture data was prepared offline.

Both audits pass: 340 test files, 183 required entries, 172 infrastructure entries and source counts 20/20/1. The new file is registered in the required test scope.

Unchanged skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

The run was serial with test concurrency one, 1200-second external stage allowance, and unchanged per-case deadlines. There was no failed, cancelled or timed-out stage and no rerun in this integration. The prior freight/freshness integration's initial Node24 recover-legacy timeout and authorized unchanged-source repeat remain documented in [the preceding report](freight-freshness-integrated-dual-node-20261016.md). Passing this gate does not establish or repair that earlier unknown cause; sidebar tests and their deadlines were not modified here.

All 1476 tracked files remained identical before and after every stage. Combined tracked-source SHA-256: `1cd6062dbc120e37a9b1449eb6ca90a75bde1b0f7349d0ae3d382c8fb296a87c`. The local candidate.76 archive was rebuilt from the frozen source: 2393224 bytes, SHA-256 `d26108b74de1eb413bcc9cbf0a06ff4ea485a0e1a5174f58fe262cde190c5992`. Its bytes stayed unchanged across both runs; actual packaged Runtime isolation passed. It remains local and uninstalled, and is not a validation of installed candidate.99.

## Earlier evidence retained

The attribute author reproduced the generic-error failure on baseline and passed 110/110 related tests on each exact runtime, with audit/typecheck. Independent review passed 111/111. The controlled two-call comparison replaces one repeated failure with one successful recovery page while retaining two total calls and one cached provider read; it does not claim universal call savings. Complete pagination, refreshed snapshot retention, long IDs, explicit omission counts, other-store and malformed-cursor controls remain covered. Initial unsupported TypeScript draft syntax, missing browser-data setup and an incorrect provider-order assertion were corrected before freezing and are disclosed in the linked author report.

The procurement author passed 52/52 focused tests per exact runtime plus types/audit. Baseline substitution failed on both at the absent candidate region. Independent review additionally verified the real publicPlan/adapter/engine/React path, raw-edit invalidation and failed batch reread behavior. These local service/React controls do not establish native browser acceptance. The attempted ordinary browser launch was blocked by socket permissions; no workaround or security change was made.

## Reproduction and limits

Use locked dependencies, matching recorded corpus, a writable npm cache, and each exact Node runtime with its matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts"
npm run typecheck
```

This is the selected 157-file regression, not the default full repository suite or historical incident replay. No real merchant/model/paid endpoint, user-computer installation, deployment or merge into the user's uncommitted tree occurred. Publication includes only selected code/tests, test classification and sanitized human-readable reports; raw logs, manifests, generated fixtures and archives remain local.
