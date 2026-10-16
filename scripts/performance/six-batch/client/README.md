# Six-patch combined client verification on candidate70

Compare the complete clean candidate70 checkout (`00b5691e7801e8ec61c25993f73c0d4ec54330b5`) against that same current checkout with all six fixes applied. Candidate69 results remain separate and are not relabeled as candidate70. The baseline is not the former candidate55, and no individual-patch gains are added together. Production changes remain limited to the agreed six fixes; current application pricing and collection status behavior is retained. No live store/platform is contacted.

## Reproduce

Install both checkouts from their frozen lockfiles. From this directory, run:

```
node build-review.mjs /absolute/baseline-root /absolute/combined-root
python3 run-parity.py
python3 run-coupled.py
```

Run timing only in a quiet, exclusive CPU window, after inspecting the functional output. To run one workload group separately, use `python3 run-coupled.py --workloads application-default` (or `platform` / `collection-loaded`). Preserve each group's `coupled-summary.json` before another invocation. Raw files include workload, size, page size, ABBA cycle, phase, and arm.

Each bundle is rebuilt from its own checkout's complete production dependency graph. React and the production test renderer also resolve from that checkout's dependency tree. `source-identity.json` records Git HEAD, the staged plus unstaged diff, status, source/dependency/harness hashes, and final bundle hashes. Instrumentation anchors must match exactly once. Both runners verify the manifest and refuse stale input or bundle bytes. There are no per-issue source swaps. The E-only bundle adds observation counters; timed Workbench bundles use uninstrumented production components.

Node 24 / React 18.3.1 production test renderer is used, with UTC for deterministic timestamps. No browser layout, paint, real network, native DSH, or user-hardware time is claimed. The HTTP boundary returns deterministic offline Workbench snapshots. Actual `WorkbenchInstanceView`, `ProductList`, `ProcurementCell`, and collection name/status components render normally.

## Current workloads

- `platform`: retains the previous legacy platform fixture and five timing shapes for comparability. It is explicitly an advanced/reference plan, not the current provider default.
- `application-default`: omits a plan parameter and obtains rows from the actual current `readProcurement` and `BusinessPricingRepository` in each checkout. Rows span the below/at-135 CNY tiers, missing price/cost/weight, and non-CNY values. Fixture/provider preparation happens before the client timer starts. Only wall-clock Date is frozen; `performance.now()` and CPU clocks are real.
- `application-explicit`: the same current provider path with explicit application parameters; included in functional parity.
- `collection-loaded`: actual collected-source field mappings with synthetic `listedIn` state rows, multiple stores, fresh/stale observations, and known/missing status counts, found/not_found/unavailable records, saved drafts, archived/failed records, missing per-store evidence, and legacy records without the new field. It exercises ordinary ProductNameWithStatus, local record/store controls, loaded-range text filtering, formatting, sorting, and display edits. The 267-row case is explicitly a synthetic already-loaded client stress shape: a real collected-source single-page request is capped at 200. The 10-row case is within the normal source-page contract. Neither case claims to benchmark the collection provider.

Candidate69 currently excludes application plans when passing a snapshot plan to `ProcurementPlanControls`, and `material-library.tsx` still initializes new procurement references as delivery. These pre-existing behaviors are not changed by this port. The application Workbench fixture therefore measures its real current fallback plan display while its table renders actual application-rule rows. It must not be reported as verification that the rule-revision summary is shown correctly.

## Functional gates

The fresh candidate70 paired run on 2026-10-10 passed all gates below; candidate69 evidence was not reused:

- E: 75 mounted ProductList/TanStack cases compare complete filtered IDs, visible IDs, pagination, full rendered trees, selection callbacks, and query callbacks. Existing Unicode/null/array/object, role, format, snapshot, store, column and search-scope cases remain. Candidate70 adds record-found/not-found/unavailable filtering, exact target-store changes, pagination reset, search intersection, selection, loaded/full scope, new snapshots and disappearance of the target store. Archived, failed and saved-draft rows remain found; legacy/missing store evidence remains unavailable. Store-specific history warnings are checked.
- O: 1,159 formatting outcomes independently rerun in each pricing mode for platform, application-default, and application-explicit, including negative zero, invalid currencies/numbers/scales, cache eviction/revisits, mutable rows, constructor replacement and recovery.
- Application O: 13 complete Workbench frames per parameter mode and provider payloads cover initial rules, overlap at revision 2, first validity window at revision 3, next window, and expiry before source TTL. Provider payloads are validated against the current descriptor schema.
- Collection coupled parity: 27 complete host trees compare thirteen actions per cycle: target store A, found, not_found, unavailable, switch to B, clear record status, clear store, followed by the previous six search/sort/display actions. Tests assert visible counts, rendered record/status lines and store-specific warning behavior.

Small 10-row controls were also independently rerun: application-default matched 13 frames and six actions per cycle; collection-loaded matched 27 frames and thirteen actions per cycle. Final build identities cover 747 baseline and 748 combined input hashes, including the complete current production graphs and each checkout’s own renderer dependencies.

Detailed output is generated into `review-summary.json` and the raw parity files. These are generated local evidence, not committed source. Rebuild and rerun after any source changes; a historical run is not a blanket future pass.

## Measurement protocol

- Platform: 10, 76, 267, and 1,000 loaded rows with page size 10, plus 267 rows with page size 20.
- Application-default and collection-loaded: 10 and 267 loaded rows, page size 10, separately identified in all output.
- Five ABBA process cycles per shape: ten fresh processes per arm.
- Fifteen complete action cycles per process; discard three warm-up cycles and retain every raw sample.
- Same mounted Workbench repeats miss, selective offer/collection-ID search, all-match search, clear, numeric sort, and display edits. Collection adds the seven record/store actions above, making thirteen actions rather than six; its whole-cycle values must not be compared directly with candidate69 six-action cycles. First/last cycle host-tree hashes plus requests/events must match across every process and arm.
- Report median of per-process medians, all-sample median, and p95; CPU and process RSS are supplementary, not browser memory claims.
- Whole-cycle time sums that cycle's actual action durations, never independent percentages. Initial mount is retained separately. Small/all-match controls and regressions must be disclosed.

No new timed result is asserted by this source README. The integration lead owns the serialized measurement window, backend gates, and final evidence. Client fixture results alone cannot establish whole-application performance or approve publication.
