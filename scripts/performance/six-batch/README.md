# Six-patch integration checks

Compare two complete checkouts, not independently swapped source files:

- clean candidate55 `0d2d4c1e801d35b6ea62581ad4259ffd518c4533`
- the combined branch containing issues 4, 5, 6, corrected 7 R2, 8 and 11

See `docs/performance/six-batch-20261010.md` for exact toolchain, fixture setup, limits and measured results. These are offline synthetic experiments; they make no live business requests.

## Functional and build checks

Run from each repository root with writable package-manager caches, after frozen root and component-workspace installs:

```
TZ=Asia/Shanghai bash scripts/performance/six-batch/checks.sh /absolute/evidence-directory
node scripts/performance/six-batch/verify-build.mjs . evidence/apps-a2-20261007/candidates/1.0.0-candidate.55/build-manifest.json
```

The check runner preserves each command's exit code and keeps running to collect all results. Read `status.txt`; the runner exits nonzero if any stage fails. Compare completed logs:

```
node scripts/performance/six-batch/summarize-tests.mjs /baseline/full-tests.log /combined/full-tests.log comparison.json
```

## Coupled measurements

Use the backend and client READMEs. Do not run benchmarks concurrently with each other, builds, installs or tests. Each benchmark executes actual combined source against real SQLite/runtime or React production renderer. Both workload-level comparisons are reported separately; no whole-application percentage is obtained by adding or averaging independent issue percentages.

Keep raw results outside the repository. Client build/parity scripts emit generated output in their working directory; run from an isolated copy of that harness with access to the checkout's dependencies, or use the included generated-output ignore rules. Commit only source harnesses and sanitized summaries, not generated bundles, databases, caches, package installations or large raw tables.
