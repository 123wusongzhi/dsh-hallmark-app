Historical bundled-Zod experiment; superseded by candidate70-vendored-zod-20261010.md. Its mixed timing results remain preserved below.

# Candidate70 standalone Runtime packaging follow-up

This follows the six-fix validation recorded in `six-batch-candidate70-20261010.md`. That earlier record's missing-zod smoke failure is preserved as pre-fix evidence, not a claim about this repaired artifact.

Base product revision: `00b5691e7801e8ec61c25993f73c0d4ec54330b5` (candidate70). The six-fix stack remains unchanged from local validation revision `ae34b306d053ef0c72381ab7c37ed550ba83a276`. Remote heads were rechecked after resuming at 14:23 UTC and candidate70 remained current.

## Minimal change

Only the explicit companion Runtime build stops treating third-party imports as external. The generated Runtime now includes the frozen zod 4.3.6 implementation. The build rejects any remaining Runtime external that is not a Node built-in. The exact Zod MIT license is copied into packed `lib/licenses/zod-LICENSE.txt`.

The current Runtime graph bundles 76 Zod input modules. These, package metadata and the license are included in source-input hashing, increasing verified inputs from 257 to 335. Host, Client and SDK build policies are untouched. Artifact comparison verifies that only `lib/runtime.js`, its sourcemap and the new license differ; all other packaged artifacts are byte-identical. JavaScript size grows from 1,344,059 to 1,865,659 bytes (+521,600).

No business logic, pricing rules, six-fix source, database schema, host peer dependency, SDK fixture or unrelated test expectation is changed. Repository/dependency acquisition uses network access; business validation uses synthetic local data and no real shop.

## Validation

The original unmodified `node scripts/smoke-apps-bundle.mjs` now passes against a fresh archive extraction, with five isolated HTTP reads and no injected checkout dependencies. Before the repair, that exact check failed with `ERR_MODULE_NOT_FOUND: zod`. The previous dependency-provisioned diagnostic is retained only as a diagnostic reference.

## Strict acceptance and regression results

- Fresh extraction under a temporary cwd/HOME; NODE_PATH and NODE_OPTIONS unset; no package or ancestor node_modules; module-resolution guard rejects any loaded file outside the extracted artifact/copied test harness. Final acceptance requires zero dependency provisioning and zero outbound fetch.
- Complete output, SQLite schema and table parity against the earlier six-fix archive with only its frozen zod 4.3.6 copied locally as a diagnostic reference. That old archive still cannot run standalone and is not an accepted release baseline.
- Actual exported composeAppsRuntime executes 15 invalid pricing schemas, 11 quote cases, 10 invalid packaging schemas, composition merge/atomic rollback, the actual profit Provider and six Notes operations. The final strict artifact regression passes 1/1.
- SDK generation, typecheck, Apps build, plugin build and original unmodified packed smoke pass. All 335 source inputs verify.
- Existing full-suite run: 1582 total, 1558 pass, 7 unchanged failures, 1 unchanged timeout cancellation, 16 unchanged skips. The new artifact regression was added after that run started and separately passes 1/1; it is not silently counted into the full-suite command. Apps subset: 569 total, 561 pass, the same 7 failures/1 cancellation.
- Four expectation/fixture mismatches, three Linux ENOTDIR cleanup failures, one mocked-time cancellation, fifteen browser skips and one Windows-only skip remain as documented in the earlier report. No unrelated fix was made.

An interrupted early full-suite log is retained; only the subsequently completed suite is used for these counts. A first pack attempt used an unavailable default npm cache; the completed build uses the documented writable cache. Neither incomplete attempt is represented as a pass.

## Packaging performance and size trade-off

Five ABBA cycles / 20 fresh actual CLI processes. Each process gets a fresh extraction, database, HOME and cwd. Thirty HTTP rounds per endpoint follow three excluded warmup rounds. Resolution-tracing hooks are disabled only for timed runs to avoid adding per-module overhead to the old external-Zod arm; clean isolation/environment checks and response assertions remain. Strict tracing is retained for separate acceptance. OS filesystem caches are not flushed. CPU/RSS cover the whole child lifecycle.

| Metric | Old + diagnostic Zod | Self-contained | Median paired-cycle change |
|---|---:|---:|---:|
| Startup ms | 214.099 | 210.944 | -3.55% |
| Lifecycle CPU ms | 454.332 | 459.642 | -2.35% |
| Peak RSS KiB | 83384.000 | 87164.000 | +5.37% |
| Health HTTP ms | 0.280 | 0.286 | +1.65% |
| Identity HTTP ms | 0.245 | 0.243 | +2.79% |
| Notes read HTTP ms | 1.455 | 1.516 | +4.52% |
| Pricing quote HTTP ms | 0.672 | 0.701 | +2.78% |
| Strict-invalid pricing HTTP ms | 0.654 | 0.697 | +4.61% |
| Archive bytes | 1944586.000 | 2143675.000 | +10.24% |
| Runtime JS bytes | 1344059.000 | 1865659.000 | +38.81% |

The two middle columns are medians across independent processes; the last column is the median of five within-cycle percentage changes, not their ratio. Their directions can differ (notably CPU/identity) and neither is hidden. RSS rises in all five cycles; Notes, quote and invalid-validation HTTP latency rises in four of five. Startup improves in three of five. The result is mixed: standalone packaging correctness is repaired at a larger artifact/memory footprint and small synthetic endpoint costs, not a performance win. The earlier six-fix source-workload improvements are separate; no percentages are added.

The original five-read isolated smoke passes without any provisioned dependencies. All 20 timing processes pass actual response and isolation assertions. Raw process samples and all five cycle values are preserved.

## Publication boundary

The authorized change is restricted to standalone packaging plus its tests/evidence. No unrelated feature/test expectation, user desktop, real shop, PR, merge or deployment is involved. Publication to a new branch is subject to final review and an unchanged remote source-head check.
