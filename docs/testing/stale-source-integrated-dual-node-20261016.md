# Stale listing source guidance: integrated validation

Date: 2026-10-16 UTC. Public baseline: `60150d622a51a74a2b825187d8137be1767505b0`.
Tested commit: `f904ceb7489066df32020f932543ab62cd8b35c9`; tree: `1fc9f706f308ea15c5ce510281a80f41990e1133`. This report is added afterward without changing tested source, tests or scripts.

## Single bounded production change

Approved candidate: `60d47f36d869e2fe4a17beb204c0f2b0ee11a233`. All three candidate files were byte-identical after integration. Production operations-provider.ts SHA-256: `5753bdcbed337ca28de2df5770a5f6b0c6547f026caee2054cbc199dbb4e6a90`.

The resolver already rejected stale preparation sources after verifying store, sale identity and procurement composition. The provider now retains that verified evidence as a read-only collection-read hint, pinned to the just-observed current source revision and the original selected SKU IDs. The original operation remains failed with retryPolicy never. The hint is a next read in the same connection, not a write retry, a replacement revision or permission to expand SKU scope.

The read hint uses limit 10 and maxBytes 8000. Verified metadata is included atomically within a 3000-byte UTF-8 budget; otherwise bounded omission guidance replaces the route. Wrong-store, missing preparation/sale and other unverified identities receive no new route. A source changed again rejects the pinned read; a deleted original SKU remains blocked rather than selecting another SKU. Only the first detected stale source is described, not proof that every other row is current. Target-filter optimization is not included. See [author reproduction and controls](../listing-source-revision-recovery-20261016.md).

## Frozen gate results

| Runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 158 | 1139 | 1137 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 158 | 1139 | 1137 | 0 | 2 | PASS | PASS |

All six stages exited zero naturally. No failed, cancelled or timed-out stage and no rerun occurred in this integration. Both runtime case-name/outcome multisets match and the prior 158-file case set is retained exactly. New boundary assertions extend an existing listing-provider-revision test, so the total count does not increase.

Both data audits pass: 341 test files, 184 required entries, 172 infrastructure entries, source counts 20/20/1. Matching browser fixture data was prepared offline. Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Tests ran serially at concurrency one. External stage allowance was 1200 seconds and per-case deadlines were unchanged. All 1481 tracked files stayed byte-identical before/after every stage. Tracked source manifest SHA-256: `3785eca955645d6963176d36a952e0f06db5f0699fbd2604d49b0ba1783c25b1`.

The local bundle was rebuilt from this exact freeze: 2395543 bytes, SHA-256 `79bbb2d22fc11f2d881dc9abe80abdc4bfe8fc679811cf7ea9b931114a317389`. It stayed unchanged throughout both-runtime validation; actual packaged Runtime isolation passed. This remains an uninstalled local candidate.76 archive, not verification of installed candidate.99.

## Earlier evidence and limits

The author reproduced missing recovery metadata on both baseline runtimes. Final author focused/related results were 20/20 per runtime with audit and typecheck; independent review passed 31/31 on each exact runtime and verified the final production hash. Controls exercise actual Runtime/model projection, pinned revision races, deleted original SKU, oversized Unicode metadata, untrusted identities, unchanged blockers and no additional operation/draft. These are local recorded-corpus and explicit boundary controls, not live source/merchant acceptance.

An initial author typecheck lacked ignored generated browser fixtures; offline preparation supplied the prerequisite before final checks. The [preceding cursor report](category-cursor-integrated-dual-node-20261016.md) retains its initial Node22 display-readiness failure and test-only causal repair. The earlier sidebar timeout remains documented separately. This green gate does not establish an explanation for those earlier observations or count another reliability fix as a new user-facing change.

## Reproduction

Use locked dependencies, matching recorded corpus, a writable npm cache, each exact Node runtime and matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts"
npm run typecheck
```

This is a selected 158-file regression, not the default full repository suite, native browser acceptance or historical incident replay. No live merchant/model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Publication includes only source, tests and sanitized reports. Raw logs, manifests, generated fixtures and archives remain local.
