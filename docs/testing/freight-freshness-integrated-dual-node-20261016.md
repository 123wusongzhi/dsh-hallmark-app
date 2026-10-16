# Freight validation and execution source freshness: integrated regression

Date: 2026-10-16 UTC. Public baseline: `ed8fb7b4426fd7454ee2a8b8ae89dc0f19f15bcb`.
Tested commit: `43337d6360ca505aee5412a9cfa0b167b9bec633`; tree: `099d74648d012cfc15adca39e423cc2c79464e1a`. This document is added after testing; source and tests remain unchanged.

## Changes and boundaries

- Explicit malformed captured freight now makes procurement cost unknown instead of silently using goods-only cost. Mapping version collection-4 reinterprets persisted older source details. Absent/null freight retains existing zero-when-not-collected semantics; valid zero, same-currency addition and already-inclusive legacy Taobao prices remain compatible. Currency conversion is not introduced. [Freight reproduction](../audits/listing-cost-freight-20261016.md).
- The adapter's existing fresh execution/review read reaches CollectionService source refresh. Normalized procurement uses the refreshed cache without a second forced fetch; failed refresh rejects rather than returning old cost. Ordinary draft reads remain cached. [Freshness reproduction](../audits/listing-source-freshness-20261016.md).

CollectionService still merges same-item in-flight requests: a fresh call may join a request already started, and ordinary drafts may read cached facts while it is pending. A failed fresh read leaves that ordinary cache available. This repair does not provide new transaction isolation or guarantee a distinct request starts after each fresh call. Pricing policy, review authorization and outbox rules are unchanged. Polling design reports are outside this integration.

Approved author commits: `6212e20c09d304165bed36a1441bfc2788d7b62b` and `86c9252e973921fc0fb84c151059c7923f0cc2de`.
Source SHA-256s matched independent review:
- normalize.ts: `3eea225773a2dbf1178205cca8da51e1fdddb7b1621eb78aaef5fe6d4261113d`
- operations-adapter.ts: `eed02b7b6311e3e7ee38e71fcdb99d1447d269ad5bde6778587fb5403539ab93`

## Complete results, including the initial failure

| Run | Files | Tests | Pass | Fail | Skip | Audit | Types |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 initial | 156 | 1134 | 1132 | 0 | 2 | PASS | PASS |
| Node 24.21.0 initial | 156 | 1134 | 1131 | 1 | 2 | PASS | PASS |
| Node 24.21.0 authorized unchanged-source repeat | 156 | 1134 | 1132 | 0 | 2 | PASS | PASS |

The initial Node24 failure was `same-view native navigation revision recovers an earlier HTTP legacy catalogue decision into the production Apps iframe`, the recover-legacy case in native-sidebar-recovery.test.ts. Its child spawnSync exceeded the unchanged 12000 ms deadline; total case duration was 16073.52 ms including fixture preparation. Captured stdout/stderr were empty, so the original stalled stage is unknown.

Independent inspection found the sidebar test and its 66 production inputs byte-identical to the public baseline, without either changed cost/source module. Replaying the original bundle passed four times on Node24 and twice on Node22 under the original deadline; three diagnostic runs and the original complete six-case file also passed. These observations do not prove resource pressure, a leak, a baseline failure, or a fixed timeout. No code or deadline was changed for the repeat. One complete Node24 audit/test/typecheck repeat was explicitly authorized, separately recorded and passed. The initial failure remains part of this result.

Final Node22/Node24 case-name/outcome multisets match. All previous 153 files and cases are retained; three existing collection files were added for normalization, recorded corpus and source-read/cache coverage. The increase from 1038 to 1134 cases includes existing coverage, not 96 new tests.

Unchanged skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both runtimes' data audits pass: 339 test files, 182 required entries, 172 infrastructure entries, source counts 20/20/1. Actual Node versions were 22.18.0 and 24.21.0, with matching npm 10.9.3 and 11.19.0. Test concurrency was one; external stage allowance 1200 seconds; individual test deadlines were unchanged.

All 1471 tracked files were unchanged before/after each initial and repeated stage. Combined source manifest SHA-256: `d0cc927aa54f3e32118da97986f155288f4cbecb84edfb411652af2334a3ca74`. The rebuilt local candidate.76 archive was 2390427 bytes, SHA-256 `614ad97aae73bbf4e3f96d16d7ba6a2e6e3eba0fe9d755e608d4410bc2403ba8`, and stayed unchanged through validation. Actual packaged Runtime isolation passed. This archive remains local and uninstalled; it is not validation of installed candidate.99.

## Earlier red/green evidence

Freight author baseline: 29 cases, 27 pass/2 fail per runtime; final author collection/listing group 114/114 per runtime. Independent freight baseline group: 67 cases, 57 pass/10 fail per runtime, then final 128/128 per runtime. Both author typechecks/audits passed.

Freshness author's original three regression cases failed 3/3 on both baselines; final broader groups passed 166+124=290 cases per runtime with audits/types. Independent final review passed 31/31 per runtime; its bounded baseline controls were 30 cases, 25 pass/5 fail/0 cancelled. The author's new concurrency test originally used an unbounded started wait; this was corrected to an explicit bounded wait before final freeze. Reverting fresh wiring then failed normally with zero cancellations on both runtimes. Final listing preparation 28/28 and final timeout-line typechecks passed on both runtimes. These focused results do not replace the integrated table above.

## Reproduction and scope

Use locked dependencies, matching recorded corpus, a writable npm cache and each exact runtime on PATH. Prepare matching browser fixture data offline, then rebuild the bundle from the frozen source:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts"
npm run typecheck
```

This is a selected 156-file regression, not the default full suite, native desktop acceptance, historical incident replay or real platform freshness validation. Local HTTP/service and transport stubs do not establish live merchant/model behavior. No merchant write, paid call, deployment or user-tree merge occurred. Only code/tests and sanitized reports belong in publication; raw logs, manifests, generated fixtures and archive remain local.
