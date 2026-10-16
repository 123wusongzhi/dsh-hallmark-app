# Selective candidate72 Windows reproduction

Compare separate source checkouts, never a moving branch in place. The reference baseline is `4e1cd98082a432e2ca89f606927da29eb26ddb67`. The first acceptance integrated four performance changes from archive `15b07477`: request-local listing-state indexes, direct byte copying after base64 decoding, page-local string-reader boundaries, and lazy initialization of business full-content JSON text. API shapes, pagination, error recovery and procurement defaults are unchanged.

The collected-products formatter-sharing trial was initially withheld after repeated roughly 200 ms clear-selection events in two sustained-interaction processes. A subsequent GC investigation and real Chrome validation accepted it as a fifth optimization; see [browser reproduction](../candidate72-browser/README.md) and the [follow-up report](../../../docs/performance/candidate72-browser-20261011.md). The four-change commit `d5a41f3b216532768180a533975e4a87f4bdc169` is the browser baseline; current source includes formatter sharing. Historical collected workloads against that four-change commit were unchanged-code controls.

The original five-change trial and its results remain outside this repository under workspace-relative `output/candidate72-validation-20261011/candidate` and the sibling `results` directory. Those historical measurements used that trial tree, not the later integrated checkout. To reproduce the historical trial, pass the preserved trial tree explicitly as `CANDIDATE`; to validate accepted changes, pass an isolated checkout of this repository and create new outputs. Do not relabel historical results as new current-code runs.

Use existing frozen dependencies in both roots. The component also needs its existing `component-workspace/collected-products/node_modules`. Dependency provisioning is outside the benchmark. Run timing families sequentially; do not run builds, tests or another benchmark at the same time. Each output label must be fresh. Raw results and failures are retained.

With `BASE`, `CANDIDATE` and `OUT` replaced by absolute paths:

```text
node CANDIDATE/scripts/performance/candidate72-windows/backend/run.mjs --baseline=BASE --candidate=CANDIDATE --output=OUT/backend-parity --mode=parity
node CANDIDATE/scripts/performance/candidate72-windows/backend/run.mjs --baseline=BASE --candidate=CANDIDATE --output=OUT/backend-timing --mode=timing --rounds=5 --iterations=15 --warmup=5
node CANDIDATE/scripts/performance/candidate72-windows/frontend/run.mjs build BASE CANDIDATE OUT/frontend
node CANDIDATE/scripts/performance/candidate72-windows/frontend/run.mjs functional BASE CANDIDATE OUT/frontend
node CANDIDATE/scripts/performance/candidate72-windows/frontend/run.mjs timing BASE CANDIDATE OUT/frontend 5
node CANDIDATE/scripts/performance/candidate72-windows/reader/validate.mjs BASE CANDIDATE
node CANDIDATE/scripts/performance/candidate72-windows/run-reader-abba.mjs BASE CANDIDATE OUT/reader-timing 5
node CANDIDATE/scripts/performance/candidate72-windows/check.mjs CANDIDATE OUT/checks
```

`check.mjs` runs affected regression tests, root and component type checking, the independent component build, Runtime/Host builds, and the packaged Runtime isolation regression. The last check uses an output-local temporary root so unrelated system-temp dependencies cannot make the package appear self-contained. Keep `OUT` outside any checkout or parent containing node_modules for that isolation check.

Statistics are per-process medians and serial ABBA observations, with small controls, cold mount and tail measurements preserved. The frontend short business CPU window includes warmup while its wall samples exclude warmup; those are different intervals. Reader timing is the first complete retained-result read in each independent process after Host setup, including HTTP, JSON, hash and assertion overhead. It is not a prewarmed helper microbenchmark. Small CPU deltas below Windows timing resolution are not evidence of gain or regression. Process-wide RSS is not deployed application memory.

The tests use real local code and synthetic business inputs. They do not measure Ozon network time, live merchant operations, model success rates, browser layout/paint, or a running DSH deployment. Different workload improvements must not be added into an overall percentage. See the checked-in review report for the acceptance decision and all material negative observations.
