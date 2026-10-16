# Plan conflict guidance: integrated dual-runtime validation

Date: 2026-10-16 UTC. Public baseline: `b91075409801b4013b05c315ea21b71323a4c869`.
Tested commit: `a49479fd328b6cb28b628c5df13cf2358f893536`; tree: `e7e37e73b22cb4cfff120905d3234def79701039`. This report is added afterward; tested code, tests and scripts are unchanged.

## Narrow repair and boundaries

Candidate `28f271846e68a4e75cf3bccb2d1ed6df1159d926` adds read-only guidance after a genuine plan version conflict for four public revise/submit aliases: hallmark.plan.revise, hallmark.listing.draft.revise, hallmark.plan.submit and hallmark.listing.draft.submit. All three candidate files matched after integration. operations-provider.ts SHA-256: `80869d9107f03cac48d13c175e16c68f180aa39111c1ca683e0050a547e9d95e`.

The original request remains failed with retryPolicy never. The existing same-connection business store supplies verified store identity and a hallmark.plan.get hint for the original plan. observedRevision is informational, not write authorization; the read returns the current plan and is not pinned to that observed version. Guidance requires checking current rows/content/status and relevant continuation pages, retaining original scope, reconciling only unexecuted rows and rechecking authorization before submit. It forbids replacing expectedRevision alone, blindly replaying writes or creating duplicate plans. Pending/unknown outcomes retain original-request inspection.

Verified metadata is included atomically within 1500 UTF-8 bytes; otherwise the route is omitted. Failure to read the original plan leaves the original conflict without enrichment. Caller rows, payloads and revision values are not echoed. The suggested limit 10 is a row-page bound, not a hard byte budget on plan.get. Existing model projection and isolation remain authoritative; no new per-plan ownership policy is claimed. No indexing experiment is included. See [reproduction and detailed controls](../plan-conflict-guidance-review-20261016.md).

## Frozen results

| Runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 162 | 1188 | 1186 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 162 | 1188 | 1186 | 0 | 2 | PASS | PASS |

All six stages exited zero naturally; no failed, cancelled or timed-out stage and no rerun occurred in this integration. Runtime case-name/outcome multisets match. All prior 158 files and cases are retained. Four existing files were added: app-hallmark/business-plan-pages, app-hallmark/business-generation, app-hallmark/provider and apps-runtime/runtime. The increase from 1139 to 1188 total cases includes this expanded existing coverage; it is not 49 newly authored tests.

Both data audits pass: 341 test files, 184 required entries, 172 infrastructure entries, source counts 20/20/1. Matching browser fixtures were prepared offline. Existing skips remain excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Tests ran serially at concurrency one, with 1200-second external stage allowance and unchanged per-case deadlines. All 1483 tracked files stayed byte-identical before/after every stage. Source manifest SHA-256: `fc6e20c468a0893ded3b88353fc944cdf9186138d7572b5732835f3e6098f2db`.

The exact-source local candidate.76 bundle was rebuilt: 2396595 bytes, SHA-256 `be6f7d3d4ee7fd0dde39d217230766fc8404da63999ee888d9af35a36b80ee03`. It remained unchanged throughout validation and actual packaged Runtime isolation passed. The archive remains local and uninstalled; this does not validate installed candidate.99.

## Earlier evidence retained

The author reproduced absent recovery metadata on baseline and passed 76/76 related tests per exact runtime with audit/typecheck. Independent review passed 32/32 per runtime; its baseline focused counterexample was one pass/one fail. Controls cover all four aliases, actual Runtime/model projection, executable read guidance, later revision changes, different connection, unbound session, deleted/missing plan, enrichment disappearance, oversized identity and caller content, retained unresolved rows and zero external calls/executions/review-cache entries.

The author's initial typecheck lacked ignored generated browser data; documented offline preparation supplied it before final validation. Previous integration failures remain disclosed in the [cursor report](category-cursor-integrated-dual-node-20261016.md) and [freight/freshness report](freight-freshness-integrated-dual-node-20261016.md). This natural green gate does not establish a new explanation for those earlier observations.

## Reproduction and limits

Use locked dependencies, matching recorded corpus, a writable npm cache, and each exact Node runtime with matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts" test/app-hallmark/business-plan-pages.test.ts test/app-hallmark/business-generation.test.ts test/app-hallmark/provider.test.ts test/apps-runtime/runtime.test.ts
npm run typecheck
```

This is a selected 162-file regression, not the default full repository suite, native browser acceptance or historical incident replay. No live merchant/model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Publication includes only selected code, tests and sanitized reports. Raw logs, manifests, generated fixtures and archive remain local.
