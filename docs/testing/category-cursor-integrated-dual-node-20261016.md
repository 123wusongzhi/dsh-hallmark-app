# Category cursor recovery: integrated dual-runtime validation

Date: 2026-10-16 UTC. Public baseline: `9bbbe1c088a099a70f5754ebd8c13722728f6f06`.
Final tested commit: `673801812b8ea95cf3b1adb6411158f5db7f1b47`; tree: `e8d7ea346fea6dbb0db2f0c263e53e834c0b2d22`. This document is added after the gate without altering tested code or tests.

## Production scope

The single production repair is category cursor validation and bounded recovery, from approved candidate `e6c75eeeea136582408f5ee3bc5751fd05dc09d7`. Malformed encoding/shape or missing/deleted/wrong-store snapshot references fail with a specific never-retry error and bounded instructions requiring original category inputs. They do not invent an executable route or disclose unverified snapshot metadata. An invalid offset into a verified same-store snapshot provides an explicit restart from that snapshot's first page, preserving category and selected/required attribute scope. Valid continuation remains compatible.

Snapshot constraints have no new expiry policy. Provider dictionary values are not frozen by this change and no values are guessed. The controlled initial-error-plus-recovery sequence still has two calls, replacing one repeated failure with a successful page without another category-provider read; this is not universal request savings. See [author reproduction and limitations](../category-cursor-recovery-20261016.md). Preview micro-optimization is not included.

Approved source SHA-256s matched after integration:
- listing-prepare.ts: `3f43d36b45f9467c565abe5e6a959ee7adb4874627ec57b45406d049400b0a5a`
- index.ts: `be3c41e7b4b148e9a930e4e05973361186598cec974a5b7d807ff1500bec09df`

## Initial failure and separate test reliability supplement

The first freeze was `bb73f5340fdac9bed3389c951d391b6a17f1e00d` (tree `2417c90e1f720ae1f4d59b33cce50f6a26f4eaa0`). Its results are retained:

| Run | Files | Tests | Pass | Fail | Skip | Audit | Types |
|---|---:|---:|---:|---:|---:|---|---|
| Initial Node 22.18.0 | 158 | 1137 | 1134 | 1 | 2 | PASS | PASS |
| Initial Node 24.21.0 | 158 | 1137 | 1135 | 0 | 2 | PASS | PASS |
| Corrected Node 22.18.0 | 158 | 1139 | 1137 | 0 | 2 | PASS | PASS |
| Corrected Node 24.21.0 | 158 | 1139 | 1137 | 0 | 2 | PASS | PASS |

The initial failure was `SDK keeps preparing responses loading and sends renderReady only after real data (transfer)` in display-errors.test.ts. Its child failed the readiness predicate after approximately 208 ms; it was not an outer test timeout. The test helper used up to 100 immediate event-loop turns while advancing a mocked clock. That is not a real elapsed-time bound for WebCrypto digest completion. Cursor changes did not modify this test or its component-runtime/data-transfer production dependencies.

Independent causal controls delayed the second completed real digest by a legitimate 50 ms. The original helper reproduced the same readiness failure on both runtimes. A test-only helper now waits up to 1000 real milliseconds using performance.now and real timers without advancing mock production time during the readiness wait. The original 10000 ms child-process deadline remains unchanged. Explicit mock-clock checks still verify the full 1000 ms preparation polling interval. No production timeout or polling code was modified.

Two test cases were added: delayed valid digest must eventually render ready; corrupted real digest must fail validation with zero renderReady. Independent final focused results were 14/14 on both exact runtimes. Reverting only the helper made the two new controls report one pass/one fail with zero cancellations on each runtime. The corrected test file SHA-256 is `59c70d539420597d5dfbf8d838bd74d30482a97040a09a2c2afb20b6da33a399`.

These controls demonstrate the fixture defect under legal asynchronous delay. They do not quantify the original digest duration or prove resource pressure at the time of the initial failure. The test reliability supplement is not another user-facing production fix. The earlier sidebar timeout remains a separate unresolved historical observation in the [freight/freshness report](freight-freshness-integrated-dual-node-20261016.md).

## Final frozen evidence

All six corrected stages exited zero naturally with no additional retries. Exact runtimes were Node 22.18.0/npm 10.9.3 and Node 24.21.0/npm 11.19.0. Case-name/outcome multisets match. Every preceding 157-file case was retained, and the newly registered listing-category-cursor file raises the selected scope to 158. The final count increase includes one cursor regression plus two test-only reliability controls.

Both audits pass: 341 test files, 184 required entries, 172 infrastructure entries, source counts 20/20/1. Matching browser fixtures were prepared offline. Test concurrency is one and external stage allowance is 1200 seconds; existing outer test deadlines are unchanged.

Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

All 1479 tracked files remained byte-identical before/after every corrected stage. Tracked source manifest SHA-256: `e097923b9064a82985afa03cf641d4fda04758668d088846d8dac54590b5abe1`. The bundle was rebuilt from the corrected freeze: 2394343 bytes, SHA-256 `a326cc1161f210f0f7dec6dd9e161564ffe5876a27ad1bb98518ddac8c0877ad`. Its bytes are identical to the initial bundle because the supplement changes tests only; the archive remained unchanged during the gate and actual packaged Runtime isolation passed. It remains a local uninstalled candidate.76 archive, not validation of installed candidate.99.

Earlier author evidence is preserved: the new cursor regression failed on each baseline runtime; final 17/17 focused cases, audit and typecheck passed on both runtimes. Independent review passed 82/82 per runtime with baseline counterexamples. Initial missing test classification and an incorrect fixture store key in a deletion control were corrected before final candidate freeze, as disclosed in the author report.

## Reproduction and limits

Use frozen-lock dependencies, matching recorded corpus, a writable npm cache and each exact Node runtime with matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts"
npm run typecheck
```

This is the selected 158-file regression, not the default full repository suite, native browser acceptance or historical incident replay. No merchant/model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Publication includes only source, tests, classification and sanitized human-readable reports. Raw logs, probes, manifests, generated fixtures and archives remain local.
