# Restore navigation input protection: integrated validation

Date: 2026-10-16 UTC. Public baseline: `a91f43a338473ea21f55abe1b562198d3029c010`.
Tested commit: `904463293d50474d0db4da2667749404d3f258ee`; tree: `7cb0d0affa9684daef40a151f3ecffb4847023f6`. This report is added after testing; source, tests and scripts remain unchanged.

## Bounded repair

Approved commits: `aac6aa99d0a191f7020bc829651aca7836160e15` and report `1d33447e41ef501938bb08bc4e9a4911059afc3d`. All candidate files matched byte-for-byte after integration. Production business-operations.tsx SHA-256: `d97048423c1c48ed18692bdae58fb3250cee87343517838e12857c4a6e559a95`.

Restoring completed rows from a mixed listing batch previously selected the new recovery batch and discarded the separate new-action form without confirmation. The editor now reuses the existing discard/navigation confirmation. Cancel performs no restore write and retains input and selection. Confirmation is bound to the owner, batch object, selected completed rows and complete input snapshot; stale handlers cannot bypass later edits. Existing single-flight handling remains.

Approval does not immediately clear the form. Known failure preserves it; successful navigation replaces it. Busy controls protect pending requests. Clean-form restoration still works directly. Wording distinguishes already-added actions saved in the original batch from displayed inputs not yet added, since the existing dirty snapshot may retain previously added values. Engine/provider authorization, restore eligibility, receipt handling and merchant behavior are unchanged. See [author reproduction and controls](restore-new-action-input-20261016.md).

## Frozen gate

| Runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 163 | 1189 | 1187 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 163 | 1189 | 1187 | 0 | 2 | PASS | PASS |

All six stages exited zero naturally with no rerun, failure, cancellation or timeout. Case-name/outcome multisets match across runtimes. All prior 162 files and cases are retained; business-restore-input-recovery.test.ts adds one registered regression file/case with multiple boundary controls.

Both data audits pass: 342 test files, 185 required entries, 172 infrastructure entries, source counts 20/20/1. Matching browser fixture data was prepared offline.

Unchanged skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Tests ran serially at concurrency one, with 1200-second external stage allowance and unchanged individual case deadlines. All 1486 tracked files stayed byte-identical before/after every stage. Combined source manifest SHA-256: `6759f1fca1aff9ca2ef12f70ad7830ea0571dde340fc2770d332527eb789a91c`.

The bundle was rebuilt from this exact source: 2396830 bytes, SHA-256 `2988077599510be50131094b67d0da064fa33a307dfc5932a738aefc6800e0db`. Archive bytes remained fixed through both-runtime validation; actual packaged Runtime isolation passed. It remains a local uninstalled candidate.76 archive and does not validate installed candidate.99.

## Earlier red/green evidence and limits

The final regression was run against the unchanged baseline on both exact runtimes and failed at the unexpected recovery-batch selection. The author's final ten-file group passed 38/38 per runtime with audit/typecheck. Independent review passed its seven-file nine-case group per runtime, with fixed baseline one-pass/one-fail results. Additional independent controls cover previously added form values, failed list reread and unknown restore receipts.

The production React/real-engine local test covers cancellation with zero writes, failed restore input retention, stale input/selection/batch/owner/visibility decisions, hidden stock input, single-flight behavior, busy fields and actual recovery draft creation without submit/review/transport. The initial disable-only experiment was superseded and is not used as final evidence. Earlier integration failures remain disclosed in the [cursor report](category-cursor-integrated-dual-node-20261016.md) and [freight/freshness report](freight-freshness-integrated-dual-node-20261016.md); this green run does not supply a new cause for them.

## Reproduction

Use locked dependencies, matching recorded corpus, writable local npm cache and each exact Node runtime with matching npm on PATH:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 "test/apps-components/*.test.ts" "test/plugin-apps/*.test.ts" "test/operations/*.test.ts" "test/business-pricing/*.test.ts" "test/operations-adapter/*.test.ts" test/apps-runtime/business-settings-http.test.ts test/apps-runtime/workbench-http.test.ts test/apps-runtime/workbench.test.ts test/apps-host/business-value-projection.test.ts test/apps-host/business-partial-status.test.ts test/business-packaging/packaging.test.ts test/service/packaging-settings.test.ts test/app-hallmark/packaging-evidence.test.ts test/materials/business-recovery.test.ts test/performance/runtime-artifact-isolation.test.ts test/performance/directory-draft-etag.test.ts "test/core/*.test.ts" "test/app-hallmark/listing-*.test.ts" test/apps-host/listing-image-jobs.test.ts test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/apps-host/review-http.test.ts test/apps-runtime/snapshot-during-review.test.ts "test/collection/*.test.ts" test/app-hallmark/business-plan-pages.test.ts test/app-hallmark/business-generation.test.ts test/app-hallmark/provider.test.ts test/apps-runtime/runtime.test.ts
npm run typecheck
```

This is the selected 163-file regression, not the default full suite, native browser acceptance or historical incident replay. No live merchant write, model/paid call, user-computer installation, deployment or automatic merge into the user's uncommitted tree occurred. Only code, tests, classification and sanitized reports belong in publication. Raw logs, manifests, fixtures and archives remain local.
