# Windows frontend validation

Run the following from any directory, passing absolute paths. The runner uses the current Node executable, existing repository dependencies, production React 18.3.1, and Asia/Shanghai timezone. No dependency installation, real network request, or business write is used.

```powershell
node <candidate>/scripts/performance/candidate72-windows/frontend/run.mjs build <baseline> <candidate> <output>
node <candidate>/scripts/performance/candidate72-windows/frontend/run.mjs functional <baseline> <candidate> <output>
node <candidate>/scripts/performance/candidate72-windows/frontend/run.mjs smoke <baseline> <candidate> <output>
# Run only in a coordinator-reserved window without other performance workloads:
node <candidate>/scripts/performance/candidate72-windows/frontend/run.mjs timing <baseline> <candidate> <output> 4
```

Each arm should be an isolated candidate72 checkout using existing dependencies. The component's node_modules can be a junction to the already installed component dependencies; the runner aliases React/test-renderer to the baseline root dependencies for one React identity.

The accepted frontend change is lazy initialization of business full-content JSON text. Collected-products component and formatter helpers in this repository remain at the baseline; their workloads are unchanged-code controls. A virtual `stable` bundle applies stable cell identities to the baseline for a separate correctness illustration only. Neither formal timing nor the accepted code uses that research bundle.

The original five-change trial also included render-local Intl formatter sharing. It was rejected after sustained-interaction clear-selection stalls recurred in two processes. That trial remains outside this repository at workspace-relative `output/candidate72-validation-20261011/candidate`; its historical outputs remain in the sibling `results` directory. These scripts compare the source paths supplied by the caller. Passing this repository measures the four accepted changes and unchanged collected controls; reproducing the old formatter trial requires explicitly passing its preserved tree. Existing trial timings must not be attributed to the current repository.

## Checks

`build` records source, harness and bundle hashes in `build-manifest.json`. The runner rejects modified bundles or changed production source files after build. The stable research bundle includes its transformed source and hash for audit.

`functional` compares every complete serialized host tree and stable business request from the two business editing workloads (10 rows, 0 or 20 attributes, 43 frames), including unsaved text, invalid JSON, replacement payload, save/filter/pricing, lost submit receipt and session switching. It also compares complete host trees for all 48/500-product control pages, search/source combinations, ordering and cross-page selections against independent fixture metadata. Raw complete frames are saved as `.frames.json.gz`; comparisons operate on decoded full JSON, not only hashes. The image error path is checked independently: baseline and candidate retain exactly the same result; stable research alone changes desktop fallback retention. The checked-in business-content regression covers unsaved edits, lazy JSON initialization, changed payloads and same-key field refresh. Rejected formatter-specific tests are not part of this repository's gate.

`smoke` runs one baseline/candidate process for each workload with short post-warmup action cycles. Its numbers are diagnostics, never formal evidence.

`timing` runs each workload serially in ABBA order for the requested number of cycles (default 4): 64 independent processes across four workloads. It checks bundle identity, initial/final full host hashes, fixture identity, and complete business request parity on measured runs. Business processes execute 18 eight-action cycles, discard the first 3 from elapsed samples, and preserve the original process-CPU window covering all 18 cycles. Collected processes warm up 4 eleven-action cycles and measure 18 further cycles. Cold mount is recorded independently in every fresh process.

Results are in `timing-raw.json` and `timing-summary.json`. Summary includes process-median cycle elapsed, cycle/action p95, per-action median/p95, cold-mount median/p95, total task CPU, every ABBA cycle's direction, and source/environment metadata. Negative results remain visible. All raw child JSON/stdout/stderr files are retained. These are headless React measurements including fixture event/effect-flush overhead, not browser DOM/layout/paint or real business/network acceptance; different workloads must not be added together.

`analyze-tails.mjs INPUT OUTPUT` analyzes original short-run `timing-raw.json` files only, using the four workloads and original sample counts. It calculates statistics from the supplied file and records its SHA256; it does not reuse conclusions from an earlier run. Sustained supplements use their own summary because their workloads and sample counts differ.

The harnesses are adapted from archive `15b07477`: business `scripts/performance/candidate72-revalidation/frontend/harness.tsx` and collected `docs/performance/formatter-sharing/runner/harness-full-frames.tsx`. Adaptations supply Windows-safe paths, full frame retention/comparison, an explicitly separate image behavior check, short smoke mode, serial orchestration, and detailed negative/tail reporting. No original Linux timings are reused.
