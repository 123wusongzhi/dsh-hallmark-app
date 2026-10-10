Final standalone packaging follow-up: candidate70-vendored-zod-20261010.md. Six-fix source workload results below remain unchanged.

Historical pre-packaging-fix record. The standalone Runtime repair and new validation are documented in candidate70-zod-packaging-20261010.md.

# Candidate70 six-fix combined validation

## Identity and scope

Repository: `123wusongzhi/dsh-hallmark-app`. An initial candidate69 pass completed, but the final remote check at 13:51 UTC revealed candidate70, published at 13:37:48 UTC. Candidate69 evidence is retained as historical only; both checkouts, functional suites, bundles and timing processes are recreated for candidate70. The target product head is `fix/agent-binding-preview`, candidate70 commit `00b5691e7801e8ec61c25993f73c0d4ec54330b5`, tree `a3307ed87402f7e75531c51c95e94ef5ba18cbbf`. This experiment compares that clean complete checkout against that same checkout plus issues #4, #5, #6, #7 R2, #8 and #11. Original six-fix source: `fa9a2e1f51b389d2ea9b784e1a4fbd2a6e8f2521`; its candidate55 results are not reused.

Nine production files change (68 added / 13 removed lines). The combined production-only tree is `888f1887224c1d937bc9f7d80221257017128984`; the production patch SHA-256 is `e757a987addd344efa379db170974db539eb77a72487fb45ca94562479493432`. Per-file baseline/combined hashes are in `six-batch-candidate70-source-hashes.json`. The port applies cleanly on candidate70, retaining candidate70's `OzonCompositionSource`, `RuntimeStore.query`, collection versions and existing JSON expression indexes alongside the scoped scheduler API. The latest application pricing, collection `listedIn` status rendering, listingRecord found/not_found/unavailable semantics, store-switching filters and other candidate70 features remain in both arms. Withdrawn #9, conditional #10, #7 appendices, Collator and prepared-statement experiments are excluded. Independent client/backend reviewers inspected the final production scope.

All execution is cloud-only. Business workloads use offline synthetic data; repository/dependency acquisition uses network access. No user desktop, real shop, credentials, live business operation, installation into DSH, push, PR, merge or deployment is performed.

## Reproduction and integrity

- Node 24.19.0, pnpm 11.25.0, npm 11.9.0, SQLite 3.53.3, ICU 78.3, React/test-renderer 18.3.1; Linux cloud executor. Full native version metadata is retained.
- Each root has its own frozen `pnpm install --frozen-lockfile --ignore-scripts` and both current component workspace lockfile installs (`npm ci --ignore-scripts` in `helen-margin` and `collected-products`). No lockfile changes.
- Each arm independently generates SDK and builds Apps/plugin bundles. Source manifests verify 256 baseline and 257 combined source inputs. Final typecheck, both builds and SDK generation pass.
- Production React harness bundles are freshly built for each whole checkout, use that arm's React/renderer dependency tree and record every source/output hash (747 baseline / 748 combined hashed inputs). Verification runs immediately before measurements. These are actual latest source imports, not an old bundle or one-patch substitution.
- Tests use `TZ=Asia/Shanghai`, concurrency 1 and identical `--test-timeout=60000`. Receipt schema fixtures are copied byte-identically from tracked baseline requirements into the test's expected external fixture directory. Original frozen SDK fixture bytes are untouched.
- The initial candidate69 unbounded suite demonstrably stalled on a new upstream mocked-time test and is preserved. Bounded test workers continue to all subsequent files; timeout cancellation is distinct from an assertion failure or pass.
- Fresh Chromium launch fails creating its singleton socket (`Operation not permitted`). Fifteen browser-gated tests remain skipped; a separate Windows-only installer test is also skipped. This is not browser/paint or Windows certification.

## Full current-repository functional checks

| Arm | Tests | Passed | Failed | Cancelled | Skipped |
|---|---:|---:|---:|---:|---:|
| Clean candidate70 | 1562 | 1538 | 7 | 1 | 16 |
| Candidate70 plus six fixes | 1582 | 1558 | 7 | 1 | 16 |

The separately executed Apps subset records baseline 565 total / 557 pass / 7 fail / 1 cancelled and combined 569 total / 561 pass / 7 fail / 1 cancelled; no skips and the same named failures.

All 20 added regressions pass. The failure/cancellation names match exactly; no new matched failure. All current test directories are included, including current collection, pricing, packaging, operations, business HTTP/scope, performance, session/favorites and retirement suites.

### Seven matched assertion/cleanup failures

1. `native Russian statuses preserve moderation, stock and archive distinctions`: current classifier requires `statuses.is_created === true`; the old fixture omits that flag, so returns `unknown` where the test expects `on_sale`. The no-stock fixture also omits it. This is a stale fixture against the current guard, not evidence of broken Cyrillic matching (`operations-client.ts` lines 34/40; test line 74).
2. `new procurement sources declare full loading and local operations without a user-editable technical switch`: current default is `application`; test still expects `delivery`.
3. `ten Ozon catalog definitions are reusable without shops or frozen dates`: current source count is 11 after adding the `ratings` definition; assertion still expects 10.
4. `initialize migrates mixed-case shop sources into shared definitions without losing history, layout or same-ID renamed sources; repeated initialization is idempotent`: same ratings-driven 11 versus expected 10 mismatch at the count assertion, not evidence that the mixed-case migration lost data.
5. `symlinks in Runtime, external workspaces and backup input are rejected instead of followed`: Linux fixture cleanup returns `ENOTDIR` from `rmdir` on a symlink.
6. `immutable archives, evidence and undeclared controlled-root directories never receive dependency-cache exclusions`: same Linux symlink-cleanup `ENOTDIR`.
7. `resolver rejects anchor tamper, mapped file tamper, symlink, traversal, unmanifested mappings and conflicting proven facts`: same Linux symlink-cleanup `ENOTDIR`.

The cancelled test is `business component submission survives 150 seconds and retains explicit shorter deadlines`. Production now allows 900,000 ms; the test advances mocked timers by only 300,001 ms before awaiting rejection indefinitely. Both original suites therefore cancel it at the same 60-second test bound. A separate, identical timer-only diagnostic advances to 900,001 ms and passes on both arms. That diagnostic does not modify production, does not replace the original test and is not counted as an original-suite pass.

## Packed-bundle smoke boundary

The unmodified smoke command fails identically on both arms before Runtime startup: the build uses `packages: external`; current business pricing/packaging import `zod`, generated runtime.js retains those imports, but the current bundle package manifest declares no zod runtime dependency. The freshly extracted standalone candidate cannot resolve it (`ERR_MODULE_NOT_FOUND`). This is an upstream candidate70 packaging blocker, separate from the seven test assertions and timeout.

A separate dependency-provisioned diagnostic links each arm's own frozen root node_modules into its newly extracted package; both then start and pass five isolated HTTP reads with zero mutations. It verifies runtime behavior under provisioned dependencies, does not repair the shipped manifest and is not an unmodified-smoke pass. Original failure output is retained. Therefore candidate70 is not certified deploy-ready.

## Strict combined functional parity

Backend: 13/13 focused regressions pass. Small/product/posting actual Runtime + SQLite + scheduler comparisons match complete responses, plan state and table/index definitions. Repair, absent archive, upstream failure fallback and disk restart comparisons pass. GC, rollback and real backup→verify→restore pass in all three shapes. Application pricing checks compare 14 complete Runtime responses and SQL records through rule revision 1→2, highest-fee overlap, old result-set invalidation and first→next→expired windows. Ten procurement provenance calls eliminate exactly ten unrelated snapshot reads (17→7). Eight additional complete Runtime listing-record responses compare all SQL rows/indexes and fixture calls for first-import failure/recovery, found/not_found/unavailable, paging, saved-draft preparation and refresh failure. No external I/O.

Candidate70's expression indexes remain enabled. Malformed/deep JSON is tested at its current SQLite ingress rejection boundary; accepted JSON5, null and duplicate-key cases retain appropriate parse/error/last-key-wins behavior. Production indexes are not removed to make historic fixtures insertable.

Client: 75 mounted ProductList/TanStack cases match full filtered IDs, host trees, pagination, selection and query callbacks, including `listedIn` statuses. Platform mode has 9 full Workbench frames; application default/explicit have 13 each, with 1,159 number/error outcomes per mode. Actual provider-derived payloads match through initial, overlap-revision, first-window, next-window and expired-window stages. Collection coupled parity matches 27 full host frames, including target-store switching, found/not_found/unavailable filters, archived/failed/saved-draft rows, missing evidence, pagination reset, search intersection, selection and snapshot/store replacement. These checks use the production React test renderer, not a browser.

Existing latest-client limitation: Workbench plan controls still recognize delivery/platform/custom but not application, while the current provider default is application. The paired application fixtures retain and verify this existing fallback rather than repairing an unrelated behavior.

## Measurement methodology

Backend: three shapes (1-product/no noise; 267-product with 1,000 legacy snapshot rows/100 unrelated cache records; 267-posting with the same noise), five ABBA cycles each, 60 independent fresh processes. Each sample measures complete Runtime.invoke plus scheduler.tick → refreshBinding → second Runtime.invoke. Two warm-up turns precede eight measured turns. No independent issue percentages are added.

Client: five platform shapes (10/10, 76/10, 267/10, 1000/10, 267/20 loaded/visible), application-default 10/10 and 267/10, and collection-loaded 10/10 and 267/10. Five ABBA cycles each, 180 independent production-renderer processes. Fifteen same-mounted action cycles per process; discard the first three. Procurement retains six actions: miss search, selective search, all-match search, clear, numeric sort and display edit. Candidate70 collection adds seven real record/store filter actions for thirteen actions per cycle; its whole-cycle values are therefore not directly comparable to the earlier candidate69 six-action collection metric. Whole-cycle time sums actual action durations, excluding checkpoint serialization. Application rows come from actual current readProcurement plus BusinessPricingRepository. Collection267 is an explicitly synthetic already-loaded stress shape, not a claim that the current provider returns >200 rows per page; the valid 10-row control is retained.

All timing phases run serially after installs, builds, tests and functional harnesses finish. The metric is median of process medians, with five paired ABBA directions, p95, CPU, RSS and cold mount reported separately. No live-network, paint/FPS, user hardware or universal speedup claim is made.

## Archive physical metadata boundary

Avoiding an identical fresh archive write intentionally leaves raw SQL `updated_at` unchanged. Raw forensic exports and backup fingerprints may differ; complete source payloads, business timestamps, expiry/cooldown rules, API responses and row ordering remain equivalent in these fixtures. Each arm's backup verifies and restores its own metadata exactly. After the failed forced-refresh edge path, all original table rows compare exactly. Custom Store.put side effects outside the actual RuntimeStore path are not claimed equivalent.

## Measurements and final gates

### Fresh candidate70 backend measurement

| Shape | Baseline ms | Combined ms | Median reduction | ABBA cycles |
|---|---:|---:|---:|---|
| small | 9.115 | 8.057 | 11.61% | 4/5 improved |
| product | 224.076 | 106.272 | 52.57% | 5/5 improved |
| posting | 228.997 | 126.207 | 44.89% | 5/5 improved |

The small control has one 7.31% slower cycle despite a better overall median. Product/posting workloads improve in all five cycles. Small-case invariant speedups are not established. Full process, paired-cycle, CPU and RSS values are in `six-batch-candidate70-backend-summary.json`.

### Fresh candidate70 client measurement

| Workload | Loaded/visible | Actions/cycle | Baseline ms | Combined ms | Reduction |
|---|---:|---:|---:|---:|---:|
| platform | 10/10 | 6 | 37.922 | 16.903 | 55.43% |
| platform | 76/10 | 6 | 54.076 | 22.520 | 58.35% |
| platform | 267/10 | 6 | 60.324 | 25.107 | 58.38% |
| platform | 1000/10 | 6 | 92.408 | 31.912 | 65.47% |
| platform | 267/20 | 6 | 101.422 | 38.159 | 62.38% |
| application-default | 10/10 | 6 | 36.315 | 15.365 | 57.69% |
| application-default | 267/10 | 6 | 56.426 | 22.134 | 60.77% |
| collection-loaded | 10/10 | 13 | 32.108 | 20.138 | 37.28% |
| collection-loaded | 267/10 | 13 | 62.346 | 35.286 | 43.40% |

All 45 paired client ABBA cycles improve. Every measured individual-action median also improves across these nine shapes. Full p95, cold mount, CPU, RSS and process/cycle values are in `six-batch-candidate70-client-summary.json`. Complete input graphs and generated bundle hashes verify again after all measurements. This does not imply invariant performance on every input.

### Final acceptance boundary

At 2026-10-10 14:05 UTC, all five remote heads were re-read. The latest product head remained candidate70 `00b5691e7801e8ec61c25993f73c0d4ec54330b5`. Candidate69 measurements are retained separately and no values are reused here.

The six-fix combined stack is validated on the pinned latest source with zero new matched functional failure and repeatable net gains in the measured workflows. This is a conditional six-fix result, not an all-green repository or deploy-ready certification: the upstream undeclared-zod packaging blocker, four stale expectation/fixture failures, three Linux cleanup failures, one timeout cancellation, fifteen browser skips and one Windows-only skip remain explicit. The two diagnostic passes do not erase original failures. Small-control timing variation remains.

No remote branch, PR, merge, deployment, desktop installation or real-shop action was performed. The tested code, reusable harnesses and reports are local only; publication requires a separate decision.
