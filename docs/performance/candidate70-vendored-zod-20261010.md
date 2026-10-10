# Candidate70 final self-contained Zod packaging

## Result and scope

Recommended final layout: preserve the exact frozen Zod 4.3.6 ESM files under `lib/vendor/zod`, rather than bundling them into Runtime. The original extracted package could not start because Zod was missing. This repair restores standalone functionality; a broken original is not a valid performance baseline.

Latest source revision: `00b5691e7801e8ec61c25993f73c0d4ec54330b5`, tree `a3307ed87402f7e75531c51c95e94ef5ba18cbbf` (candidate70). Remote branches were rechecked at 14:37 UTC; publication requires another unchanged-head check. Six-fix source is unchanged from validated local commit `ae34b306d053ef0c72381ab7c37ed550ba83a276`, tree `c28208caed6a101a5b7ac78ed1ad23c02e3a9131`.

Only `scripts/build-apps-bundle.mjs` changes production packaging. Runtime keeps external-module behavior; two Zod import specifiers become relative paths. Its remaining bytes exactly match the previous six-fix Runtime (1,344,059 → 1,344,095 bytes). Exact 76 JS files, package.json and MIT LICENSE are copied from the frozen installation, with a closed dependency-graph/path guard and source hashing. No node_modules is packed. Host/client/SDK policy and six production optimizations are unchanged. No additional dependencies are introduced.

Independent review verified 180 static relative edges, no dynamic imports/require/bare dependencies/escapes, all 78 copied files byte-identical, and all 143 packed-file hashes. Windows path semantics were tested on Linux; native Windows execution was not performed.

Artifact archive SHA-256: `c6560e9d43ecd4ae2157d18ed5f077da4d392b1d2e043d18d3a4b9394a4507ab`.
Runtime SHA-256: `28f4924a4173b595b0e015f2f5e3b86c62c18e22cd74c41173ec7f714b6bf11d`.
Vendor tree SHA-256: `f665db8c0459be9f01e6e6b32231a5e5b0237b487bf581c361ced4163f1bf591`.

## Validation

Frozen root and both component installs, SDK generation, Apps/plugin builds, typecheck and the original unmodified five-read isolated smoke pass. All 335 source-input hashes are recorded. Strict acceptance uses extracted archive only, temporary cwd/HOME, no NODE_PATH/NODE_OPTIONS, no ancestor node_modules, no dependency provisioning, module-resolution confinement and zero outbound business requests. Actual pricing/packaging validation routes and profit provider are exercised, not only health.

Complete response plus SQLite schema/table parity equals the old six-fix archive with frozen Zod provisioned solely as a labeled diagnostic: SHA-256 `f4b29666c62538380c6bef6b4948fcf84a7a16db649c9d7f0077c7c024688a81`. This covers 15 invalid pricing schemas, 11 quote cases, 10 invalid packaging schemas, composition/rollback and six Notes operations. The accepted final archive receives no injected dependencies.

Final full suite: **1583 total, 1559 pass, 7 fail, 1 cancelled, 16 skipped**. Original latest baseline: **1562 total, 1538 pass, 7 fail, 1 cancelled, 16 skipped**. All 21 added tests pass; no new failures. `TZ=Asia/Shanghai`, `--test-concurrency=1`, file-level `--test-timeout=60000` allow subsequent files to finish. Node 24.19.0, pnpm 11.25.0, npm 11.9.0, SQLite 3.53.3, ICU 78.3.

Seven unchanged failures:
- native Russian statuses preserve moderation, stock and archive distinctions
- new procurement sources declare full loading and local operations without a user-editable technical switch
- ten Ozon catalog definitions are reusable without shops or frozen dates
- symlinks in Runtime, external workspaces and backup input are rejected instead of followed
- immutable archives, evidence and undeclared controlled-root directories never receive dependency-cache exclusions
- resolver rejects anchor tamper, mapped file tamper, symlink, traversal, unmanifested mappings and conflicting proven facts
- initialize migrates mixed-case shop sources into shared definitions without losing history, layout or same-ID renamed sources; repeated initialization is idempotent

Four are stale expectations/fixtures (missing is_created, delivery→application default, and two 10→11 source counts); three are Linux ENOTDIR cleanup failures. The Russian fixture failure does not demonstrate a Cyrillic classifier defect. Separately cancelled: “business component submission survives 150 seconds and retains explicit shorter deadlines”, whose mocked 300001 ms advance is shorter than the 900000 ms production deadline. The separately labeled 900001 ms timer diagnostic passes; the original test remains cancelled. Fifteen Chromium-gated and one Windows-only tests skip; cloud Chromium cannot create its singleton socket. No live-shop, desktop or native Windows acceptance is claimed.

## Packaging experiment A: old external-Zod diagnostic versus final

Five ABBA cycles, 20 fresh CLI processes, 30 HTTP rounds after three excluded warmups. CPU-intensive work was serialized. Timing excludes resolver tracing (strict tracing remains in functional acceptance); isolation/environment/resource/response checks remain. OS caches are not flushed. CPU/RSS cover whole child lifecycle. Reference requires copied frozen Zod and is diagnostic only. Metrics are local synthetic measurements.

| Metric | Reference process median | Vendored process median | Median paired-cycle change |
|---|---:|---:|---:|
| startupMs | 218.553529 | 224.988113 | +0.60% |
| cpuMs | 469.113500 | 473.970500 | +6.63% |
| maxRSSKiB | 83624.000000 | 84106.000000 | +0.69% |
| archiveBytes | 1944586.000000 | 2038504.000000 | +4.83% |
| runtimeBytes | 1344059.000000 | 1344095.000000 | +0.00% |
| http-health-first-medianMs | 6.142006 | 6.701864 | +2.18% |
| http-health-medianMs | 0.291174 | 0.305105 | -0.59% |
| http-identity-medianMs | 0.259656 | 0.265074 | -6.68% |
| http-notes-get-medianMs | 1.499722 | 1.535773 | +4.54% |
| http-pricing-quote-medianMs | 0.734795 | 0.753350 | -0.10% |
| http-pricing-strict-invalid-medianMs | 0.706923 | 0.715779 | -0.22% |

## Packaging experiment B: bundled prototype versus final

A separate matched 20-process ABBA compares two fully self-contained archives, with zero dependency provisioning in either arm. No cross-window median is treated as a paired observation.

| Metric | Reference process median | Vendored process median | Median paired-cycle change |
|---|---:|---:|---:|
| startupMs | 199.499515 | 211.238957 | +8.13% |
| cpuMs | 462.527000 | 457.351500 | +4.30% |
| maxRSSKiB | 87294.000000 | 83866.000000 | -4.83% |
| archiveBytes | 2143675.000000 | 2038504.000000 | -4.91% |
| runtimeBytes | 1865659.000000 | 1344095.000000 | -27.96% |
| http-health-first-medianMs | 8.033421 | 6.294395 | -21.24% |
| http-health-medianMs | 0.295377 | 0.281056 | -0.35% |
| http-identity-medianMs | 0.274105 | 0.237721 | -9.55% |
| http-notes-get-medianMs | 1.546994 | 1.504778 | -0.65% |
| http-pricing-quote-medianMs | 0.759439 | 0.715824 | -6.40% |
| http-pricing-strict-invalid-medianMs | 0.704662 | 0.683575 | -3.31% |

Vendoring preserves native module semantics and reduces memory/archive footprint and most measured steady-state endpoints versus the bundled prototype, at a startup cost. CPU evidence is mixed: process medians and the median of within-cycle percentage changes can have opposite signs. All metrics/raw cycle values are retained. No claim of universal speedup or zero packaging overhead is made.

## Relationship to six-fix performance

The earlier **240-process** candidate70 six-fix source workload benchmark remains separate: product267 224.076→106.272 ms; posting267 228.997→126.207 ms; default-application client267/10 56.426→22.134 ms; loaded-collection267/10 62.346→35.286 ms. No source production code changed afterward. The final artifact has the exact same Runtime code apart from import paths, plus strict artifact parity and the new packaging measurements; these are not represented as a rerun of all 240 processes against the new artifact. Percentages are not added across experiments.

Small backend median 9.115→8.057 ms, but one of five cycles was 7.31% slower. Collection267 is synthetic already-loaded stress above the current single-page cap. Skipping redundant archive writes intentionally changes physical updated_at/backup fingerprints; actual GC/rollback/backup/verify/restore parity passed, without claiming byte-identical databases.

All execution was cloud-side with simulated business data; repository/dependency networking occurred, no real shop was called. Historical bundled prototype evidence is retained in candidate70-zod-packaging-*; final evidence is candidate70-vendored-zod-*. Publication remains gated on final review and remote-head verification; no PR, merge or deployment is included.
