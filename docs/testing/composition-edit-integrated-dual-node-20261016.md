# Packaging composition edit continuity: integrated validation

Date: 2026-10-16 UTC. Public baseline: `abe630b626165aa6b179cc3ef38a07d9ab1fd168`.
Final tested commit: `0ffb43c7719bbf7a2a273f954f71cc65425da38e`; tree: `7c187f8d733790413fbf797ef5a0980fc19ec2f8`. This report is added afterward without changing tested code, tests or scripts.

## Single production repair

Approved commits: `04c54fb3b9291f5145f950f3cef9fadfc55af947` and report `664d431198f26378bd234c9b6a45dd7c22b3a6c1`. All candidate files matched after integration. business-settings.tsx SHA-256: `f169cb3ad46a7e99389aa5d2ef09c47e475a7a59c114b33d839bd74fe312d3ef`.

Recomputing an already displayed packaging composition is a read, but previously replaced an unsaved edited row. A same-key dirty row is now preserved as a whole, including blank edited fields and its original compare-and-swap revision, with a notice that the new read did not overwrite the draft. Quantity or order changes remain distinct composition keys. Keeping the old revision does not silently rebase over a concurrent saved override; conflict still requires explicit reread and reconciliation. Unknown-write behavior is unchanged. See [author reproduction and controls](../packaging-composition-draft-continuity-20261016.md).

## Initial failure and diagnostic-only supplement

Initial freeze: `d5820a77c723e519e4f7e23701603eb597b72967`, tree `8b798408fcbfa676b94ae20a7533745862d53b34`. Initial results remain part of this validation:

| Run | Files | Tests | Pass | Fail | Skip | Audit | Types |
|---|---:|---:|---:|---:|---:|---|---|
| Initial Node 22.18.0 | 165 | 1201 | 1199 | 0 | 2 | PASS | PASS |
| Initial Node 24.21.0 | 165 | 1201 | 1198 | 1 | 2 | PASS | PASS |
| Diagnostic freeze Node 22.18.0 | 165 | 1202 | 1200 | 0 | 2 | PASS | PASS |
| Diagnostic freeze Node 24.21.0 | 165 | 1202 | 1200 | 0 | 2 | PASS | PASS |

The first Node24 run failed `workspace returns to a bounded, paused full data task with its real React search and page intact` in workspace-resume.test.ts. Its child status was null under the existing 20000 ms spawn limit; total case duration was 25489.46 ms including setup. Original stdout/stderr did not establish the stuck stage. The first failure and retained child bundle were kept.

Independent replay of that exact child bundle exited naturally twice on Node24 and once on Node22. The original four-case file passed with both candidate and public production source. No causal evidence tied the packaging handler to the failure, and the original root cause remains unknown. A small test-only diagnostic supplement records bounded child status/signal/errorCode, whitelisted stage markers and a separate cleanup marker without replacing the last progress stage. Successful runs add no console noise. All original assertions and the 20000 ms child deadline remain unchanged.

The diagnostic helper was validated with controlled exit 7, a short 100 ms ETIMEDOUT/SIGTERM child, unknown-stage redaction and independent cleanup markers. The focused file passed 5/5 on both runtimes. Its final SHA-256 is `65e514d174c3f51a34f5fb919336f215596328dae130fa3e69ecb350d8871a1a`. One diagnostic control was added; this is not another production UX fix. The subsequent complete gate passed, but neither diagnostics nor a passing rerun is claimed to have fixed the timeout or proved environmental pressure.

## Final exact-source gate

All six stages on the diagnostic freeze exited zero naturally. Actual runtimes were Node 22.18.0/npm 10.9.3 and Node 24.21.0/npm 11.19.0. Case-name/outcome multisets match. The previous 164-file scope is retained and one composition-continuity file with eight regression cases is added; the separate diagnostic control raises the final total to 1202.

Both data audits pass: 344 test files, 187 required entries, 172 infrastructure entries, source counts 20/20/1. Matching browser fixtures were prepared offline. Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Test concurrency stayed one, external stage allowance 1200 seconds, existing case deadlines unchanged. All 1493 tracked files stayed byte-identical before/after every final stage. Source manifest SHA-256: `1ed26196c9e125c531f1efb94bb2f06472276f48c20c947763f9d3711dfe3f87`.

The exact-source bundle was rebuilt after the diagnostic change: 2396997 bytes, SHA-256 `5c7d0d5c10bfbff3641f1f63fa59eb0e124c746c16461a2c12fbe794c36c65ed`. It is byte-identical to the initial bundle because only test diagnostics changed. Archive bytes stayed fixed through validation and actual packaged Runtime isolation passed. It remains local and uninstalled candidate.76, not validation of installed candidate.99.

## Earlier repair evidence and limits

Author final six-file group: 48/48 per runtime with types/audit. Author baseline eight-case group: four pass/four fail per runtime. Independent review: 26/26 per runtime and nine-case baseline four pass/five fail, with no cancellations. Additional controls cover clearing all fields, explicit reread then save after conflict, and connection isolation. Deliberately invoking a late captured handler is a race probe, not a claim about browser typing while disabled. Unknown-write semantics were not changed.

Previous unrelated failures remain disclosed in the [cursor report](category-cursor-integrated-dual-node-20261016.md) and [freight/freshness report](freight-freshness-integrated-dual-node-20261016.md). No first-run failure is erased by the final table.

## Reproduction

Use locked dependencies, matching recorded corpus, writable npm cache and each exact runtime with matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts" test/app-hallmark/business-plan-pages.test.ts test/app-hallmark/business-generation.test.ts test/app-hallmark/provider.test.ts test/apps-runtime/runtime.test.ts
npm run typecheck
```

This selected 165-file gate is not the default full repository suite, native browser acceptance or historical incident replay. No live merchant/model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Publication contains only selected code, tests, classification and sanitized reports. Raw logs, retained diagnostics, manifests, fixtures and archive remain local.
