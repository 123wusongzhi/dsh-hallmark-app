# Candidate 72: string reader allocation change

This isolates the string-page hunk in `packages/app-runtime/src/projection.ts`: count Unicode code points without allocating an array for the complete source string, retaining only boundaries for one possible page. It does not add literal search, row filters, endpoints, descriptor paging, or new response fields.

Run from a shell with Node >= 22.18. No dependency installation is needed; end-to-end runs use the dependencies already available in the target checkout. Paths passed to dynamic imports are converted with `pathToFileURL` for Windows.

## Functional equivalence

```powershell
node scripts/performance/candidate72-windows/reader/validate.mjs ../baseline .
node --test test/apps-runtime/result-reader-string-equivalence.test.ts test/apps-runtime/result-reader.test.ts
node scripts/performance/candidate72-windows/reader/bench-result-reader.mjs . small mixed --verify-only
```

The differential validator imports the actual reader from both checkouts and compares the complete serialized response or error. Cases cover ASCII, Chinese, mixed scripts, emoji, paired and lone UTF-16 surrogates, JSON escapes, empty strings, first/middle/final/past-end cursors, byte budgets, invalid arguments, and complete reconstruction. It does not measure performance or change the stores.

## Serial end-to-end benchmark

The benchmark adapts the attachment's `scripts/bench-result-reader.mjs`. It reads through AppsHost -> HTTP -> runtime -> stored result, verifies reconstruction and hashes every rendered page. Setup and teardown are outside the measured interval. The interval includes page requests, render parsing, assertions, hashing, and collecting chunks. `maxRssKb` is the process lifetime peak, including setup. No warm-up page is excluded.

```powershell
$env:BENCH_VARIANT='baseline'
$env:BENCH_ROUND='1'
$env:BENCH_ORDER='1'
node --expose-gc scripts/performance/candidate72-windows/reader/bench-result-reader.mjs ../baseline large mixed
$env:BENCH_VARIANT='candidate'
$env:BENCH_ORDER='2'
node --expose-gc scripts/performance/candidate72-windows/reader/bench-result-reader.mjs . large mixed
```

Run baseline and candidate serially, repeat independent processes, alternate AB/BA order, and keep the same Node version and flags. Workloads are `small=10`, `moderate=1000`, and `large=10000` pattern repetitions. A positive integer may replace the workload name. Patterns are `ascii`, `chinese`, `emoji`, and `mixed`.

Each process prints one JSON record. Compare `inputHash`, `outputHash`, `pages`, and `bytes` for equality before evaluating `elapsedMs`, `cpuMs`, or `maxRssKb`. `--verify-only` suppresses timing and resource fields. Store raw JSON lines separately, and report medians plus variability for each workload/pattern; small inputs may have no measurable benefit because HTTP overhead dominates.

The full string is still loaded and scanned for each page, and its JSON byte size is still computed. This is an allocation optimization, not an index or a streaming storage change.
