# Six-patch integration checks

Compare two complete checkouts, not independently swapped source files:

- clean candidate70 `00b5691e7801e8ec61c25993f73c0d4ec54330b5`
- the combined branch containing issues 4, 5, 6, corrected 7 R2, 8 and 11

See `docs/performance/six-batch-candidate70-20261010.md` for exact toolchain, fixture setup, limits and measured results. These are offline synthetic experiments; they make no live business requests.

## Functional and build checks

Run from each repository root with writable package-manager caches, after frozen root and component-workspace installs:

```
TZ=Asia/Shanghai bash scripts/performance/six-batch/checks.sh /absolute/evidence-directory
node scripts/performance/six-batch/verify-build.mjs . evidence/apps-a2-20261007/candidates/1.0.0-candidate.70/build-manifest.json
```

Current upstream bridge timeout test awaits after advancing only 300,001 ms although production now allows 900,000 ms. The runner bounds isolated test files at 60 seconds in both arms; cancellations are not passes. A separate timer-only diagnostic is recorded without replacing the original suite.

The check runner preserves each command's exit code and keeps running to collect all results. Read `status.txt`; the runner exits nonzero if any stage fails. Compare completed logs:

```
node scripts/performance/six-batch/summarize-tests.mjs /baseline/full-tests.log /combined/full-tests.log comparison.json
```

## Coupled measurements

Use the backend and client READMEs. Do not run benchmarks concurrently with each other, builds, installs or tests. Each benchmark executes actual combined source against real SQLite/runtime or React production renderer. Both workload-level comparisons are reported separately; no whole-application percentage is obtained by adding or averaging independent issue percentages.

Keep raw results outside the repository. Client build/parity scripts emit generated output in their working directory; run from an isolated copy of that harness with access to the checkout's dependencies, or use the included generated-output ignore rules. Commit only source harnesses and sanitized summaries, not generated bundles, databases, caches, package installations or large raw tables.

## Candidate70 diagnostics (not original-suite passes)

The unmodified candidate70 bundle smoke currently fails because its extracted Runtime imports external zod without a declared package dependency. Both original logs must be retained. The dependency-provisioned diagnostic links only that arm's frozen root dependencies into its newly extracted candidate; it does not fix the shipped manifest.

```
python3 scripts/performance/six-batch/timer-diagnostic.py /absolute/check-out /absolute/evidence-dir
python3 scripts/performance/six-batch/smoke-dependency-diagnostic.py /absolute/check-out /absolute/evidence-dir
```

The timer diagnostic copies the test and changes only its second mocked time advance, so total elapsed matches the current 900,000 ms business timeout. Both diagnostics remove temporary source copies and keep original files unchanged. Never fold their passes into the unmodified test/smoke totals.
