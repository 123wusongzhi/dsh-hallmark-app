# Category binding and review cancellation: integrated validation

Date: 2026-10-16 UTC. Public baseline: `05a9fd1cb5b09864f6679067c10d8d899ec9ca0e`.
Tested commit: `2840d5ac5c94e35eddbd78976d4f0f80012847d1`; tree: `72cb1e271bd4efb378ee20ab8f20c7024dbd39a4`.
This report is added after the gate and changes no tested source or tests.

## Bounded changes

**Category fallback evidence:** cached category hints are revalidated against their exact current source associations before reuse. Detached, replaced, ambiguous or unverified bindings cannot supply the former hint, even when complete packaging bypasses enrichment. Valid associations, explicit overrides and search remain covered; no category, brand, stock or pricing defaults were introduced. See [category binding reproduction and controls](fresh-listing-category-binding-20261016.md).

**Review cancellation:** an admitted review child's stalled result can be abandoned when its invocation is cancelled so that required cleanup starts. Late resolution or rejection does not become a finding. Cancellation during asynchronous disposal prevents a late review-complete callback. Tool restrictions remain installed through cleanup; cleanup is awaited rather than detached or declared complete early. See [review finalization reproduction and controls](review-agent-finalization-20261016.md).

This does **not** bound a `subagents.start` that never returns, a child `dispose` that never returns, or a transport implementation that ignores abort. It does not claim all review hangs are recoverable, or a real model/native lifecycle was exercised.

Approved candidate commits: `110cb771a63231f431c1e05c1dd9d2380adced19` and `169c29b8bfe5c2f61798e021af6d4fe2abf991d4`. Integration matched both independently approved source SHA-256s exactly:
- Category source: `72063968bc65bbfd6650d2141e2785f1de8039d1edc3fb2694d4254c92ee2f1c`
- Review source: `907a06612bbc099d9f2cec1fb38c4cd17cbf3fe9f2bc87e75de437a88ba7c001`

## Complete frozen results

| Actual runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 153 | 1038 | 1036 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 153 | 1038 | 1036 | 0 | 2 | PASS | PASS |

Case-name/outcome multisets are identical. The previous 149-file combination is retained and four files added: review-agent, new review-agent-lifecycle, review-http, and snapshot-during-review. Category, pricing and native-session adjacent coverage was already included. The increase from 1009 to 1038 cases includes added coverage of existing tests; it is not a claim of 29 newly written tests. No previous case was removed or renamed and skips remain unchanged.

Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both audits pass: 339 test files, 182 required entries, 172 infrastructure entries and source counts 20/20/1. The new lifecycle file is classified as infrastructure. Matching browser data was prepared offline from the tracked corpus.

Each runtime ran audit, selected tests and typecheck serially; test concurrency remained one, external stage allowance was 1200 seconds, and test-specific deadlines were unchanged. All six stages exited zero naturally. There was no failed, cancelled or timed-out integration stage; native-session passed on both runs. All 1468 tracked files stayed byte-identical before and after every stage. Combined source SHA-256: `e3631436e9b1ca5c27130fe6e67968182f2d61521369179c217ee2e1f287cd2d`.

The exact source was rebuilt locally before testing. Its archive remains version **1.0.0-candidate.76**, not an installed candidate.99 build. Archive: 2390153 bytes, SHA-256 `25a171e9527806319ac26058fc4bc1102fac504e27a2e93219c8bff388617802`. Archive bytes remained fixed during both-runtime validation, and actual packaged Runtime isolation passed twice. The archive remains local and uninstalled.

## Earlier evidence retained

The category author and independent review reproduced stale binding behavior on the baseline and verified invalidation plus positive valid-binding controls. The final author's selected category/pricing regression group passed 91/91 on each exact runtime.

The review author's initial eight lifecycle cases failed against baseline on each runtime; a later cancellation-during-successful-disposal control also failed on each runtime before the final pump check. The final related author group passed 37/37 per runtime, and independent review passed its separate 63-case combined/control group on each runtime. Those focused numbers are not substituted for this complete 153-file gate.

The review author's fresh-worktree typecheck initially lacked generated browser fixture data; its prepared-fixture retry passed. The linked reports preserve those initial failures and exact scope. No failure from this integration was silently omitted or retried into the table above.

## Reproduction

Use frozen-lock dependencies, matching recorded data, each exact Node runtime with matching npm/PATH, and a writable local npm cache:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  "test/apps-components/*.test.ts" \
  "test/plugin-apps/*.test.ts" \
  "test/operations/*.test.ts" \
  "test/business-pricing/*.test.ts" \
  "test/operations-adapter/*.test.ts" \
  "test/core/*.test.ts" \
  "test/app-hallmark/listing-*.test.ts" \
  test/apps-host/listing-image-jobs.test.ts \
  test/apps-host/review-agent.test.ts \
  test/apps-host/review-agent-lifecycle.test.ts \
  test/apps-host/review-http.test.ts \
  test/apps-runtime/snapshot-during-review.test.ts \
  test/apps-runtime/business-settings-http.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/business-packaging/packaging.test.ts \
  test/service/packaging-settings.test.ts \
  test/app-hallmark/packaging-evidence.test.ts \
  test/materials/business-recovery.test.ts \
  test/performance/runtime-artifact-isolation.test.ts \
  test/performance/directory-draft-etag.test.ts
npm run typecheck
```

Allow 1200 seconds externally per stage. This is a 153-file selected combination, not the default full repository suite, browser visual acceptance or real historical incident replay. No merchant/provider/model call, desktop installation or deployment occurred. The user's uncommitted tree and installed candidate.99 are outside this exact-source result. Only selected source/tests, classification and human-readable reports belong in publication; raw logs, manifests, generated fixtures and archives remain local. Publication is a separate reviewed step.
