# Listing image handoff freshness audit

Baseline: `c7b26cf1ec79e8275918f5e3f4b1a9326a786783`.

## Confirmed current behavior

The current listing-image Host extension cached a prepared `generating` job. After
pre-execution approval, a ledger completion, durable success receipt, or completed
first image call could arrive before execution. The execute hook checked only
whether another call was still running, then invoked generation again. Local
regressions execute the actual extension hooks with controlled asynchronous
ordering and a counting image-tool continuation. No image provider is called.

Independent review additionally reproduced retargeting: preparing asset B after
asset A was approved could checkpoint A's result against B. Equal prompts did not
prevent this; replacing the preparation while downstream approval awaited was
also reachable in the hook lifecycle.

## Fix

- Check durable recovery state and prepared owner/content snapshot before approval
  and immediately before starting generation. Completed results and receipts win
  over the cached pending state.
- Bind approved call IDs to the exact prepared job, reject preparation changes
  across the permission await, and consume approval only at execution. Recheck
  the actual prompt/reference presence at execution; a denied repeat approval
  invalidates the earlier permit.
- Preserve `stage_existing` and other recovery actions instead of translating
  every `generating` ledger stage into a new-generation instruction.
- Keep unarmed ordinary image calls unaffected. Existing successful receipt
  checkpointing, stage monotonicity, origin identity, and version protections
  remain in place. A failed call can be freshly approved and retried.

The armed-image contract requires the normal pre-execute/execute lifecycle; a
bare execute call without matching approval fails closed. The tests exercise both
hooks. This audit did not run the native desktop engine or establish its event
contract independently of the repository's integration interfaces.

## Reproduction and validation

Use the installed exact Node **22.18.0** and **24.21.0** runtimes. For each:

```
node --test test/apps-host/listing-image-jobs.test.ts
node --test test/apps-host/listing-image-jobs.test.ts test/plugin-apps/host.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
```

The final 19 image-hook cases on baseline: **4 pass, 15 fail** on each runtime.
The final fixed image-hook suite: **19 pass** on each runtime, included in the
combined Host suite: **30 pass, 0 fail, 1 skip** out of 31 on each runtime. The skip
is the existing real-bundle preview archive test, whose local archive is absent.
Typecheck and the real-test-data provenance audit pass on both runtimes.
The baseline is run in an isolated temporary tree with the baseline extension,
unchanged handoff helper, and the final regression file.

Private browser fixtures are regenerated locally using
`node scripts/prepare-real-test-data.mjs`; raw logs and runtime recovery metadata
remain local. No merchant, external model, image generation, or cost-bearing
service was contacted. No source was pushed.

## Limits

This is a bounded local extension/Host regression result, not an end-to-end native
DSH run or a full repository-suite claim. It proves prevention of duplicate
continuation calls and cross-asset checkpointing in these orderings, not a measured
real-provider cost or latency improvement. No generic polling/context cache was
changed; no historical incident or missing feature was treated as a requirement.
