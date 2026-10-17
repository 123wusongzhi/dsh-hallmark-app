# Material save receipt contract: integrated regression supplement

## Result and exact source

This is a **test-only contract supplement**, not a new production defect or a forty-third production improvement. No production files differ from the public baseline. Existing CAS and stable-instance-ID behavior already pass these tests.

Fresh remote fetch verified baseline `4a02eedb1fe37de7b536546c5ae6b515542c5afb`, tree `e5c4db84afe1eee3961748a682bcff5c3d388c0c`. Only final author commit `1d90eb309c0cd17a9e5587d0a89f635077ca3010` was cherry-picked; its superseded checkpoint was not imported.

Tested integration commit: `7446f93fc37e1b97ca2dfbc613f39ddc8bd68206`.
Tested tree: `0aea5a3881f73537b25e9dbe1b5b58280c9fc5c8`.

Exact official Node **22.18.0** and **24.21.0** each passed **168 files /1224 tests /1222 passed /zero failed /zero cancelled /two skipped**. Both audits and typechecks passed. All six stages naturally exited zero on the first attempt, with identical test-name/outcome multisets. The previous 167 files and all their case-name/outcome multiplicities remain covered; one new test file adds six cases.

All 1501 tracked files remained byte-identical before and after every stage. Sorted source-manifest digest: `eb41b564de761d8f530c99ada8e225613d7646b31abfabe84ff7776d0846efc7`. This report-only commit is the sole post-gate change; tests, production and scripts match the tested freeze.

Both audits: PASS, 346 classified test files, 188 required and 173 infrastructure files, recorded-source counts 20/20/1. Classification totals are distinct from executed-file counts.

## What was exercised

The six new scenarios mount the real React editor/workspace, invoke real `WorkbenchLibrary.save`, and persist through SQLite-backed `RuntimeStore(':memory:')`. The controlled fetch boundary loses or makes unreadable the response after a real local commit. Tests cover original-revision CAS rejection, stable new-instance identity, rejection before commit, concurrent remote change and deletion, same-title distinct identities, and mounted chat/application changes. Readback explicitly makes zero automatic save POSTs and never establishes a receipt for the original request.

An explicit save after readback is a new user action against the newly read revision. It can update the same retained instance ID without creating a duplicate. It is not authenticated attribution of the earlier request, a merge of later remote edits, or an automatic write retry. Matching current fields do not prove that the particular lost-response request succeeded.

All six scenarios use already-saved source references and execute `save`. `saveWithDrafts` checks were static inspection only, not dynamic validation of source registration/commit side effects. The app-scoped store and mounted-workspace chat assertions do not establish cross-process receipt durability or account authorization. Pending requests retain the separate existing lifecycle behavior. No new unknown-write coordinator was introduced.

Regression test SHA-256: `268e22831c8cd4afdf02e995182477169eef2b31921f5b7fa6e85a6fb60e2925`.

## Author and independent evidence

Author validation on both exact runtimes: 38/38 related tests, including all six new cases; prepare, audit and typecheck exit zero. Independent final review: six of six cases on each runtime. Isolated mutations removing the real save CAS comparison produced two normal failures per runtime. Regenerating the draft instance ID in the error catch produced one normal identity failure per runtime. These controls demonstrate detection of removed guards; they are not baseline defects or production fixes.

Each new child fixture has a fixed 15-second deadline with status, signal, process error, stdout and stderr failure diagnostics. The final candidate additionally asserts that explicit readback sends no save POST. No deadline or behavioral assertion was relaxed. The aggregate needed no retry and had no first-attempt failure to conceal.

Historical intermittent workspace-resume failures remain a separate, unresolved observation. Its existing diagnostic enhancement and original deadline are retained; this green run does not establish a cause or repair. No browser/desktop, live merchant, real Host transport, paid service, or cross-process acceptance is claimed.

## Bundle and skips

The exact-source candidate.76 bundle was rebuilt before the gate: 2397819 bytes, SHA-256 `3bd0893c3309aac2580d1c4c5025d434ec0245cbe6578f5d88087aa582e9b3b4`. It matches the prior production integration byte-for-byte and remained unchanged after tests. It is local and uninstalled. Runtime artifact-isolation passed.

Original skips, unchanged and not counted as passes:
- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

The former is platform-dependent; the latter requires a separate prepared/legacy archive fixture. The ordinary bundle build does not activate that fixture. This is the stated related group, not the entire repository suite or exact-public-SHA CI.

## Reproduction

Use the repository lockfile dependencies, prepare offline data with `node scripts/prepare-real-test-data.mjs`, and build the exact source with `node scripts/build-apps-bundle.mjs`. Select official Node 22.18.0 and then 24.21.0 in PATH. For each, run serially:

1. `node scripts/audit-real-test-data.mjs`
2. `node --test --test-reporter=tap --test-concurrency=1` with the sorted deduplicated matches below.
3. `npm run typecheck`

The outer stage allowance is 1200 seconds. Existing case deadlines, skips and assertions remain unchanged. No test-name filtering or aggregate rerun was used.

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

Stage durations in seconds: Node 22.18.0 audit 3.313, Node 22.18.0 related 430.48, Node 22.18.0 typecheck 45.756, Node 24.21.0 audit 2.742, Node 24.21.0 related 415.812, Node 24.21.0 typecheck 30.378.

Raw logs, manifests, SQLite/probe artifacts, generated corpus files and archives remain local. Only tests, additive classification and sanitized reports are included. No publication or new issue was performed by this integration.
