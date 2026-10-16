# Batch refresh intent continuity: integrated validation

Date: 2026-10-16 UTC. Public baseline: `2ff2debe254ded3787f36b7aa01e5412408155f1`.
Tested commit: `afbf190b793a44eb50a93d148bedb5fd6c23f846`; tree: `c6b2e32cdcb8f2f4d417d0a7d9d195e5de49ed41`. This report is added after testing without changing source, tests or scripts.

## Narrow change

Approved source/test commit `aafbdaa0cc0ce3f7aeb8abd655423ed02bc3c9e1` and report `b383a6ebe1928455668292687d8a309d83a91c36` matched byte-for-byte after integration. Production business-operations.tsx SHA-256: `51b33021a8f763338d9d4b3dc1159f0ab25132f2ee1bb58833e80d23aba99b4a`.

When a batch-list refresh temporarily omits the current batch, existing bulk price/currency input or selected row IDs now keep the editor attached to that batch instead of automatically choosing another batch. This prevents silent loss of unapplied input and accidental selection transfer when another batch shares row IDs. Missing rows are not retained as executable stale rows; writes remain disabled until the current batch is available. A notice explains retry and explicit switching, which clears the old input/selection through existing navigation. This is not a permanent lock and does not change backend eligibility or authorization. Input changes do not restart list reads. See [author reproduction and controls](../business-batch-refresh-continuity-20261016.md).

## Frozen results

| Runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 164 | 1193 | 1191 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 164 | 1193 | 1191 | 0 | 2 | PASS | PASS |

All six stages exited zero naturally. No failure, cancellation, timeout or rerun occurred in this integration. Case-name/outcome multisets match. Every previous 163-file case is retained. The newly registered business-batch-refresh-continuity file adds four cases, taking the total from 1189 to 1193.

Both data audits pass: 343 test files, 186 required entries, 172 infrastructure entries and source counts 20/20/1. Matching browser fixtures were prepared offline. Existing skips are unchanged and excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Tests ran serially at concurrency one; external stage allowance was 1200 seconds, with unchanged individual case deadlines. All 1489 tracked files remained identical before/after each stage. Combined source manifest SHA-256: `4b32548596f24b10047211f3432a178a7d351e20e0a40742e476e1e090481c40`.

The exact-source candidate.76 bundle was rebuilt: 2396915 bytes, SHA-256 `684f19df1c22903cf7bb47e521c72e365760ee4c08d48400e79ae566c9e9b459`. It remained unchanged across validation and actual packaged Runtime isolation passed. It stays local and uninstalled; this does not verify installed candidate.99.

## Earlier evidence and boundaries

The author passed 17/17 tests across eleven files on each exact runtime, plus final types/audit. Independent review passed eleven tests across six files per runtime; its fixed baseline had three failures and one pass per runtime. Additional publicPlan-based controls verify newer row removal/succeeded status and cross-chat late replies. The candidate does not make removed or completed rows newly actionable and does not carry one chat's response into another.

Initial author audit rejected the unclassified new test, and initial typecheck found an implicit-any test value. Only registration and test typing were corrected before final validation; those initial failures remain disclosed in the author report. No failed combination run was replaced by this table. Earlier integration failures remain documented in the [cursor report](category-cursor-integrated-dual-node-20261016.md) and [freight/freshness report](freight-freshness-integrated-dual-node-20261016.md); this green run does not assign them a new cause.

## Reproduction

Use locked dependencies, matching recorded corpus, a writable local npm cache and each exact runtime with matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts" test/app-hallmark/business-plan-pages.test.ts test/app-hallmark/business-generation.test.ts test/app-hallmark/provider.test.ts test/apps-runtime/runtime.test.ts
npm run typecheck
```

This is the selected 164-file regression, not the default full repository suite, native browser acceptance or historical incident replay. No live merchant/model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Publication includes only selected code, tests, classification and sanitized reports. Raw logs, manifests, generated fixtures and archive remain local.
