# Batch receipt/read ordering: integrated dual-Node gate

## Frozen source and result

Fresh remote fetch verified public baseline `341c5b12d65875f46dfd0ed30e186d0f59599a13`, tree `d87467c5b9b91272012ba424b2a9839d57ce5774`. All forty-three prior production improvements and the receipt-contract test supplement are retained. Candidate source `89006cab0609a7f99728b2f61a717bd6ad57a891` and report `4627669bbe7c0b436a75ac5fc76710316ae0e147` were cherry-picked into an isolated branch.

Tested commit: `b0d4ed5ed917b8d4ec3c9deedce89766a0d00c9d`.
Tested tree: `5cbd9409e9deb5e505180113d73733a18759e755`.

Official Node **22.18.0** and **24.21.0** each completed **169 files /1233 tests /1231 passed /zero failed /zero cancelled /two skipped**. Both audits and typechecks exited zero. All six stages naturally completed on the first aggregate attempt, with matching case-name/outcome multisets. All previous 168 files and case-name/outcome multiplicities are retained; the new file adds five scenarios.

All 1506 tracked file hashes remained unchanged before and after every gate stage. Manifest digest: `ae3d38f5e93cd87c57329b114390842681f53cf7d67d82267b936ce074a2c5a6`. The subsequent final commit adds only this report; production, tests and scripts are byte-identical to the tested freeze.

Both audits report PASS: 347 classified test files, 189 required and 173 infrastructure files, source counts 20/20/1. Classification totals are distinct from the 169 executed files.

## Defect and bounded correction

During a three-row submit, changing tabs and returning can start a list read that captures dispatching/draft rows. The real local engine later accepts succeeded/rejected/pending results before that old read returns. The baseline then replaces the accepted result with the older list, or removes the just-received table on late read failure. Both snapshots can have revision 1, so plan revision alone does not establish execution-status freshness.

The editor now increments a generation when accepting an operation result. Reads capture that generation on start. An old success or failure crossing a newly accepted result cannot replace it; instead, one replacement list read is scheduled for that crossing. This is read-only, not a write retry. Existing owner cancellation stays authoritative, ordinary read-first ordering remains unchanged, and later authoritative server status can be accepted.

This does not repair arbitrary stale server replies to reads started after the receipt, redefine backend revision semantics, or change execution/retry/authorization rules. A replacement read that itself fails follows existing explicit manual recovery without looping. Receipt notices describe the accepted operation's history, not a live aggregate of all later states. No platform duplicate-write defect or reload durability change is claimed.

Production SHA-256 (`business-operations.tsx`): `527f38ede4f367d949d819c09205240c6abea27a78f276cfd1075a6e005f704e`.
New test SHA-256: `28cdbcbaa42e53b10bf1557bc425cfa37266a32bc5e53b6b7b69fa23a6005ffb`.

## Local causal evidence and review

The new regression uses production React, real BusinessOperations execution and isolated SQLite state with recorded product/store/cost inputs. Delays, offer aliases and transport outcomes are explicit local controls. Cases exercise stale success, stale failure, later authoritative state, ordinary read-first order and owner retirement. They assert cancelled confirmation submits zero times, repeated confirmation submits once, and the three rows each execute once. Read replacement does not resend them.

Author focused validation on both exact runtimes: 21 files, 114 total /113 passed /one existing platform skip; prepare/audit/types pass. Baseline and guard-removal versions each produce three normal failures and two passing ordinary/owner controls. These are separate from the full related integration counts.

Independent expanded review: 13/13 on each runtime, historical baseline six-case group four failures/two passes, and three selected guard-removal failures. Additional controls verify replacement-read failure remains bounded, later manual refresh accepts same-revision state, and two accepted results crossing one old read cause only one replacement read. That two-result probe deliberately invokes a previously captured inspect callback; it does not claim the disabled UI button can be clicked.

The author's first exploratory probe expected text not rendered for completed rows. Independent initial fixture calls used an incorrect engine.inspect argument shape. Those failures remain separately recorded, corrected in fixtures only; no deadline or legitimate product assertion was weakened. They are not represented as final production failures or final passing runs.

This is local React/engine evidence, not installed native UI, visual/browser acceptance, live merchant access, a full repository suite or exact-public-SHA CI. Prior unrelated intermittent workspace-resume timeouts remain unexplained; their diagnostics and deadlines are retained unchanged, and this green gate does not establish their cause or repair.

## Bundle, skips and reproduction

Exact-source candidate.76 bundle: 2397962 bytes, SHA-256 `7a6e6f4161d81fc7af0b45164a8f059d83e37e918d149ee3e8d30e494cf527dd`. It was built before the gate and is unchanged afterward, local and uninstalled. Runtime artifact isolation passed. Dependency entries point directly to the stable existing root; no shared dependency link was replaced.

Unchanged skips, not passes:
- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

The former is platform-dependent; the latter needs its separate prepared/legacy archive fixture. The ordinary rebuilt archive does not activate that fixture.

Use locked dependencies and offline `node scripts/prepare-real-test-data.mjs`; build with `node scripts/build-apps-bundle.mjs`. Select each exact official runtime in PATH and run serially:
1. `node scripts/audit-real-test-data.mjs`
2. `node --test --test-reporter=tap --test-concurrency=1` with sorted deduplicated matches below.
3. `npm run typecheck`

Outer allowance remains 1200 seconds per stage. Existing case deadlines and skips are unchanged. No test-name filter or aggregate rerun was used.

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

Stage durations in seconds: Node 22.18.0 audit 3.113, Node 22.18.0 related 602.594, Node 22.18.0 typecheck 42.502, Node 24.21.0 audit 2.992, Node 24.21.0 related 495.741, Node 24.21.0 typecheck 44.994.

Raw logs, source/test manifests, negative probes, generated fixtures and bundle archives remain local. Only selected source/test/classification changes and sanitized reports enter the candidate. No publication, real merchant write, paid service or raw upload was performed by this integration.
