# Material access lifecycle: integrated dual-Node validation

## Source and first-attempt result

Fresh remote fetch verified public baseline `f06b7c602995762bb231473c3879fe15a2bc9249`, tree `e9f010ecfca33501724daf572ee1efa04162c84d`, equivalent to local `07af99fb156d9ba7c408bb47d60336c35509219f`. All forty-one previously published production improvements are retained.

The complete five-commit author sequence was cherry-picked in order: `18a8c51`, `985ac91`, `92b71d5`, `44b518d`, `da08093`. Final author commit `da0809350ddde1b3a90ce1bd0fb59a1388e61e49` and this integration have the same tested tree.

Integrated tested commit: `272d1170475fc6a55395ad450beb720f89d37d67`.
Tested tree: `4bfe101815c41ecf5bff3a6f7419771b3c6fa446`.

Both exact official Node **22.18.0** and **24.21.0** completed **167 files / 1218 tests / 1216 passed / zero failed / zero cancelled / two skipped**. Audit and typecheck also passed on both runtimes. All six serial stages naturally exited zero on the first aggregate attempt. The complete case-name/outcome multisets match across runtimes.

All previous 166 files and their case-name/outcome multiset are retained. The candidate adds cases within the existing `material-close-draft.test.ts`. The existing adjacent `test/apps-runtime/workbench-pins-http.test.ts` was additionally included to cover the author's complete related scope. The total increase of fifteen cases includes that coverage expansion; it is not fifteen newly authored tests.

Audit: PASS, 345 test files, 188 required and 172 infrastructure classifications, recorded-source counts 20/20/1. These are classification totals, not executed aggregate file counts.

All 1498 tracked file hashes remained unchanged before and after every gate stage. Manifest digest: `85ab907a384076b110a4dc6c7303675485dfaeecc0bbe605a4869e24f55d8794`. The final subsequent commit adds only this report; production, tests and scripts are byte-identical to the tested source.

## Behavior and limits

Non-fallback whole-workbench metadata denial clears the material preview and accepted metadata, hides the retained editor, aborts pending catalogue reads and expires old capability callbacks. Parent denial is propagated as explicit null to hidden editors. A synchronous denial epoch protects the first React commit from an old save handler and prevents the two resumed automatic effects from issuing work before passive state catches up. A successful fresh metadata/catalogue read can restore access; stale snapshots and late mutation success cannot do so.

Local user configuration/request drafts are retained through denial and are available after legitimate recovery. Temporary network/503/unreadable-success responses preserve the legitimate draft/preview under the existing fallback policy. Component-only data-read 404 is not whole-app metadata denial. Tests use local production React/API boundaries, not browser painting or live authorization acceptance.

A save already sent before denial is not cancelled or undone. While its request promise remains pending, the existing save/close lock survives metadata recovery. Recovery does not replay it; an expired late success cannot restore access or navigate. This is pending-request protection, not persistent unknown-write receipt coordination after a rejected promise. No broader unknown-write guarantees are claimed. Backend permissions and mutation admission remain unchanged.

Production SHA-256:
- `packages/plugin-apps/client/material-library.tsx`: `2a1e18bc462ec3a4ec65a3d027f4080f0ec0cafa9b2d0161292bee5e024a5537`
- `packages/plugin-apps/client/workspace.tsx`: `1a4b6c6f31b1c50bc18932fe0ddf9a89c7c09571c83736311df7e5531ca8f836`

## Independent and earlier evidence

The final author recovery matrix passed 79 files, 305 tests /303 passed /2 skipped on each exact runtime, with prepare/audit/types exit zero. Independent final review approved source `44b518deda18b5bbdd04895d8a4525dc183b8dff`, 14/14 focused tests on each runtime. These focused results are separate from the larger integrated gate above.

Four rollback groups produced nine normal assertion failures per runtime with zero cancellation or timeout: five original material metadata-denial cases, one Workspace-only hidden-editor case, one first-layout/expired-handler case, and two same-commit resume/denial automatic-effect cases. The latter two corrections arose during independent review; earlier checkpoint acceptance is not substituted for final-source validation.

The author's initial Workspace-only rollback hit its unchanged 15-second deadline. The diagnostic assertion representation was subsequently bounded without weakening the behavior or deadline, and the final rollback failed normally. This does not prove the cause of the original timeout. Two environment interruptions during author validation remain incomplete evidence, not terminal test passes; the final recovery run is separately identified in the author report. Initial/intermediate logs remain local.

The earlier composition integration's unrelated workspace-resume child-status-null failure remains unexplained. Its approved diagnostic supplement and original 20-second deadline are retained unchanged (test SHA-256 `65e514d174c3f51a34f5fb919336f215596328dae130fa3e69ecb350d8871a1a`). This round's green result does not establish a timeout fix or environment-pressure cause.

## Bundle and verification boundaries

The exact source bundle was rebuilt locally before gates. Candidate.76 archive: 2397819 bytes, SHA-256 `3bd0893c3309aac2580d1c4c5025d434ec0245cbe6578f5d88087aa582e9b3b4`; unchanged after tests, uninstalled. Runtime artifact-isolation passed. No real merchant writes, paid/model calls, desktop interaction, raw-log upload or publication was performed by this integration.

The two original skips are unchanged:
- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

The first is platform-dependent; the second requires its separate prepared/legacy archive fixture. Rebuilding the ordinary bundle does not activate that skipped fixture. This is the stated related group, not a whole-repository suite or exact-public-SHA CI result.

## Reproduction

Reuse the repository lockfile dependencies and documented offline fixture preparation via `node scripts/prepare-real-test-data.mjs`. Build the frozen source with `node scripts/build-apps-bundle.mjs`. Select official Node 22.18.0, then 24.21.0 in PATH. Run these stages serially on each:

1. `node scripts/audit-real-test-data.mjs`
2. `node --test --test-reporter=tap --test-concurrency=1` followed by the sorted deduplicated file matches below.
3. `npm run typecheck`

The outer supervisor allowance remains 1200 seconds per stage. No case deadline, original skip, or assertion was relaxed; no aggregate rerun or test-name filtering was used.

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

Stage durations in seconds: Node 22.18.0 audit 3.815, Node 22.18.0 related 357.986, Node 22.18.0 typecheck 28.857, Node 24.21.0 audit 2.139, Node 24.21.0 related 364.515, Node 24.21.0 typecheck 24.577.

Raw logs, manifests, interruption evidence, generated corpus files, negative probes and archives remain local. Only sanitized source-related reports are included in the publication candidate.
