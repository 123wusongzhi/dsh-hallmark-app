# Workbench metadata recovery: integrated dual-Node validation

## Frozen source and result

Fresh remote fetch verified public baseline `455eedecf37dcb1d732ec45d5bdfc3d0414328e1`, tree `fbae6ebcb9ec1d2e519f6190f5472626e0d8a63e`. The existing forty production improvements are retained. The two author commits `7c1e02beb1ce5c013dc278e6ec253c84efe2fbcd` and `8b1930abe82a671d795ec217e3d21fb32152d313` were selectively cherry-picked, in order, into a separate integration branch.

Tested commit: `f1bef715213c401ea4e4305ef8e20bfb6b822ec0`. Tested tree: `94c2d590b523a87504a3ff786a2b739024a3c650`. All 1496 tracked file hashes remained unchanged before and after every gate stage. Sorted source-manifest digest: `d35d871e99fa023ab8673a949ffd226400c622bf110faa035182bf0e969c7f9b`. This final report is the only post-gate change; production, tests, classification, and scripts remain byte-identical to the tested freeze.

Both official Node **22.18.0** and **24.21.0** completed the same **166-file** related group: **1203 tests, 1201 passed, zero failed, zero cancelled, two skipped**. All six stages (audit, related tests, typecheck per runtime) naturally exited zero on the first aggregate attempt. Case-name/outcome multisets match across runtimes. All previous 165 files and their test-name/outcome multiset are retained; the additional file is `test/plugin-apps/workbench-cold-read-recovery.test.ts`.

Audit on both runtimes: PASS, 345 classified test files, 188 required files, 172 infrastructure files; recorded source counts 20/20/1. These classification counts are not aggregate executed-file counts.

## Correction and boundaries

A cold metadata failure cannot establish that a board is empty or a component removed. It now offers an explicit metadata reread without a false absence claim. Successfully read empty/missing cases retain their ordinary meaning.

After accepted metadata, non-fallback metadata failures clear the Board and parent Workspace's same-app cached board and retained hidden details. A denial guard blocks stale snapshots and ordinary board events from repopulating them. Only a successful metadata read clears the guard. Temporary network/503/502 HTML and malformed successful JSON preserve the accepted read/search snapshot under the existing fallback policy. A workbench metadata 404 invalidates that app's board scope; it does not promote a component-data 404 to whole-app revocation. No automatic mutation replay is added.

The MaterialLibrary has an independent permission, read/write and draft lifecycle. It is outside this correction's certified scope. This does not establish unauthorized backend reads/writes there. Verification is production React with controlled local HTTP/API boundaries, not browser typing, visual acceptance, live merchant access, or a full repository suite.

Production SHA-256:
- `packages/plugin-apps/client/workbench-board.tsx`: `41c5af67e4f43747e2082bd597e2355ee6c8262c47e31ac810e2180e16e68416`
- `packages/plugin-apps/client/workspace.tsx`: `7824ef2d952a373d1ef7b9e733feecf295a88d033a2fe597ac3805a91a0a2028`

## Earlier evidence and limitations

The author report records the baseline cold-read false-absence failure and the accepted-board denial failure. The first cold-only checkpoint was insufficient: independent review found retained accepted snapshots/hidden tabs, which the final two-module fix addresses. Board-only and Workspace-only rollbacks each fail their corresponding assertion on both runtimes. Final author related group: 12 files, 44/44 per runtime plus typecheck/audit. Independent permission JSON/HTML 403/404 matrix: 8/8 per runtime, and adjacent group 9/9. These focused counts are separate from the aggregate above. Initial test-only implicit-parameter type errors and intermediate checkpoints are retained as local historical evidence, not represented as final passes.

The preceding composition integration had one Node24 `workspace-resume` child-status-null failure at the unchanged 20-second child limit, with no useful stdout/stderr. Independent replay did not establish its cause. The prior approved diagnostic-only supplement is retained byte-for-byte (`workspace-resume.test.ts` SHA-256 `65e514d174c3f51a34f5fb919336f215596328dae130fa3e69ecb350d8871a1a`). It records bounded status/signal/error and whitelisted stages on failure without changing the original deadline/assertions. This round's first-attempt green result does not establish that the intermittent timeout was fixed or caused by load.

Two unchanged skips:
- Project skill installer platform-dependent install case.
- Real-bundle Host prepared/recoverable legacy-preview archive case requiring its separate fixture.

The ordinary runtime artifact-isolation test passed. The rebuilt candidate.76 bundle is local and uninstalled: 2397306 bytes, SHA-256 `a30e8cde93cc1fd96c7df98f20bc6977e4b5e0e6391da2f32b32c0dacdfb29c3`. Its presence does not activate the separate skipped archive fixture. No exact-public-SHA CI claim is made before publication.

## Reproduction

Use the repository lockfile dependencies and documented offline `scripts/prepare-real-test-data.mjs` setup. Build once from the frozen source using `node scripts/build-apps-bundle.mjs`. Select each exact official runtime in PATH and run, serially:

1. `node scripts/audit-real-test-data.mjs`
2. `node --test --test-reporter=tap --test-concurrency=1` with the sorted, deduplicated matches of the patterns below.
3. `npm run typecheck`

The outer supervisor allowance is 1200 seconds per stage; all existing test-case deadlines and skips are unchanged. No tests are retried or filtered to obtain this result.

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
```

Stage durations in seconds: Node 22.18.0 audit 3.576, Node 22.18.0 related 469.198, Node 22.18.0 typecheck 43.707, Node 24.21.0 audit 5.54, Node 24.21.0 related 380.929, Node 24.21.0 typecheck 38.71.

Raw logs, test manifests, generated corpus files, probes, failure artifacts and the bundle remain local. This report contains only sanitized reproduction instructions and bounded results. The author report’s public-object-unavailable statement describes its earlier isolated checkout; this integration independently fetched and verified the public baseline above.
