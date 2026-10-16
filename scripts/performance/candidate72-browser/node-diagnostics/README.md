# Collected-list GC diagnostics

These tools reproduce the second diagnostic pass from already bundled `collected-baseline.mjs` and `collected-candidate.mjs`. They do not build code, install packages, or edit production files. Measurements run serially. Do not run beside browser benchmarks, tests, or builds.

## Files to commit

Copy only these ten files together:

- `README.md`, `diagnostic-paths.mjs`, `analyze.mjs`
- `micro-prepare.mjs`, `micro-run.mjs`, `micro-instrumentation.txt`
- `fiber-host-lookup.txt`, `wrapper-free-prepare.mjs`, `wrapper-free-run.mjs`, `wrapper-free-analyze.mjs`

The first-pass heavy instrumentation files `prepare.mjs`, `run.mjs`, and `instrumentation.txt` remain local for the historical `trace-01` evidence and are not part of this minimal submission. Keep all existing result directories, raw traces, logs, profiles and generated bundles as local evidence; do not copy them into the scripts directory or commit them. The submitted tools have no dependency on those first-pass files.

## Inputs and portability

The input bundles must have the reviewed harness shape: 500 fixture rows, 30 warmup cycles, 100 measured cycles, 11 actions per cycle, four `setImmediate` settles per action. `round=70` is the 71st measured cycle. Exact replacement counts fail on an incompatible bundle; original and edited hashes are recorded. No generic React benchmark support is claimed.

Output ownership defaults to the scripts' directory via `import.meta.url`, not a hardcoded machine path. Set `CANDIDATE72_DIAGNOSTICS_ROOT` to use an explicit external results root. Run/prepare output must be a fresh child directory of that root; never use a raw evidence directory as preparation output. The scripts do not delete or clean up files.

The analyzer derives file paths from each validated run label and the directory containing `runs.json`. Recorded absolute paths are provenance only; moving an evidence directory does not redirect analysis back to its original location. Analysis writes derived `.analysis.json` / summary files in the supplied directory, so analyze a copy if existing derived reports must remain byte-for-byte unchanged. Raw measurement JSON, logs and traces are read only.

The experiment was observed on Windows x64, Node 24.12.0 / V8 13.6.233.17-node.37, React/TestRenderer 18.3.1, timezone `Asia/Shanghai`. Runners deliberately retain that timezone. Other Node/V8 releases can change flags, trace names, clock behavior and GC timing; manifests record the actual runtime. There are no external script dependencies beyond Node built-ins and the supplied standalone bundles.

## Minimal observation

`micro-run.mjs` adds only `startPerfMs: start` and `endPerfMs: start + wallMs` to the existing return object. It adds no diagnostic arrays, per-action markers, helpers or clock reads during the workload. EOF code records the clock anchor, expands the existing samples and optionally calibrates GC after all actions and unmount. Two added properties can still alter object sizes/hidden classes; this is not observation-free.

Modes: `control` copies the original bytes; `micro` adds return fields without trace flags; `micro-trace` adds GC NVP and V8 trace events; `micro-profile` collects a separate 500 microsecond CPU profile. One round is serial baseline/candidate/candidate/baseline. Complete initial/warm/final frames, fixture hash, bridge and network results are checked across all runs in that invocation. Include `control` for a fresh original-bundle output comparison.

Run from the directory containing the submitted scripts, substituting your input/evidence paths:

```powershell
$env:CANDIDATE72_DIAGNOSTICS_ROOT = 'D:/diagnostic-evidence'
$bundles = 'D:/saved-frontend-supplement'
node ./micro-run.mjs $bundles "$env:CANDIDATE72_DIAGNOSTICS_ROOT/micro-01" 2 control,micro-trace
node ./analyze.mjs "$env:CANDIDATE72_DIAGNOSTICS_ROOT/micro-01"
```

`micro-prepare.mjs <bundle-directory> <fresh-output-directory>` only prepares copies. The optional second analyzer argument sets the tail threshold in milliseconds (default 16.6667).

## Private Fiber lookup control

`wrapper-free-run.mjs` changes only timing-mode `hostByLabel` and the clear-selection button lookup. It traverses the current Component Fiber's committed host props instead of creating ReactTestInstance wrappers for all descendants. One root TestInstance, a small `{props}` adapter per lookup and bounded traversal checks remain. Event order/handlers, timers, fixture, initial/warm/final snapshots, GC and EOF observation stay intact.

The helper deliberately uses the pinned TestRenderer 18.3.1 private `_currentFiber()` API. Unsupported version, root shape, host props or unsafe traversal fails; it never supplies substitute/fake controls. This is a diagnostic intervention, not production code. Reduced allocation/lookup cost changes GC scheduling too, so a reduction supports a harness contribution and does not prove the WeakMap alone caused a tail.

Default modes are `original-trace,wrapper-free-trace`. A quick new-control-only trial runs one baseline and two candidate processes:

```powershell
node ./wrapper-free-run.mjs $bundles "$env:CANDIDATE72_DIAGNOSTICS_ROOT/wrapper-01" 1 wrapper-free-trace baseline,candidate,candidate
node ./wrapper-free-analyze.mjs "$env:CANDIDATE72_DIAGNOSTICS_ROOT/wrapper-01"
```

Saved original reference JSON is mandatory even for the new-control-only trial. Defaults are `timing-collected-500-0-0-baseline.json` and `timing-collected-500-0-1-candidate.json` in the input directory. The optional sixth argument names a JSON manifest with `baseline` and `candidate` path strings; relative paths resolve from that manifest's directory. Every run checks complete initial/warm/final output, fixture metadata, final selection, bridge and all 1,100 action names/rounds against its saved reference. Use original references from the same fixture/runtime/locale.

For fresh paired conditions, select `original-trace,wrapper-free-trace` and optionally order `baseline,candidate,candidate,baseline`. Odd rounds reverse the mode order. All child processes remain serial.

## Evidence boundaries

- `analyze.mjs` outputs per-run and combined tail statistics, every round-70 clear-selection action, and action overlap with main-thread GC/compiler spans. Nested GC spans are unioned, not double-counted. Missing clocks remain unavailable.
- Trace clocks use User Timing anchors when available. The observed Windows Node build emitted no such marks; fallback uses saved hrtime/performance brackets plus matching main-thread metadata and requires agreement with the post-workload calibration GC. The recorded uncertainty is retained.
- Native stdout can buffer/interleave GC and JS marker lines. GC log candidate windows are conservative; log ordering alone does not attribute an action. CPU-profile attribution is statistical and requires plausible clock bounds; action windows include asynchronous settles.
- `wrapper-free-gc-summary.json` adds MajorGC pause and before/after heap bytes within the first-to-last measured-action window (including gaps). NVP stages attach only when pause duration and post-GC heap bytes uniquely match. Startup, warmup and post-run calibration are excluded. Nested/parallel stage counters must not be summed as independent elapsed time.
- Diagnostic overlap explains that occurrence, not an earlier untraced event. These tools do not establish browser layout/paint/input behavior or formal product performance. Keep raw results and observation modes distinct.