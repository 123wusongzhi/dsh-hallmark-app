# Native gateway test readiness diagnosis

## Scope and cause

The Node 24.21.0 related-suite run exposed a pre-existing readiness race in
`test/apps-components/native-client.test.ts`: the test waited 50 ms after mounting
the gateway card and immediately dereferenced its open button. The button is only
rendered after the card's asynchronous HTTP view read establishes that it is not
a source draft. A mounted card and its metadata alone do not establish readiness.

The test and `packages/plugin-apps/client/view.tsx` are unchanged between published
baseline `67374c97f03a1b91bef920fd50abdc2f3960ac72` and the evaluated candidate
`cad4e15b03952177e16b6ddc0213dc18ad527a4e`. Both unchanged revisions passed a focused
run. Delaying local view responses by 150 ms reproduced the same missing-button
`undefined.props` failure on both revisions. This is evidence for an existing
fixed-sleep test race, not a refresh/range production regression. It does not
establish that Node 24 itself is defective or that every unrelated test is sound.

## Minimal repair

The test now waits for the exact gateway open button inside React `act`, polling
at 10 ms with a two-second deadline and an explicit readiness assertion. The
original metadata, no-inline-iframe, sidebar identity, real Runtime invocation,
legacy route, attachment prohibition, and model-request assertions remain intact.
No production source changes, retries of the whole test, skipped assertions, or
additional unconditional sleeps are included.

## Controlled verification

- Node 24.21.0, original test, published baseline: focused pass.
- Node 24.21.0, original test, candidate: focused pass.
- Original test with a 150 ms local view-response delay: baseline and candidate
  both fail at the original missing-button dereference.
- Repaired test with that same delay: baseline and candidate both pass.
- Repaired candidate with incorrect Runtime note content: fails the original
  strict note-title assertion.
- Repaired candidate with the wrong gateway button label: fails the explicit
  bounded readiness assertion.
- Repaired candidate, no injected faults: three consecutive Node 24.21.0 passes
  and one Node 22.18.0 pass.
- TypeScript no-emit check: passed after the documented offline test-data
  preparation. The initial fresh-worktree check lacked its generated browser-data
  fixture; no source fix was needed for that prerequisite.
- Whitespace diff check: passed.

Delay and fault probes were temporary local controls and were restored. Raw logs,
generated bundles, dependency links, and probe scripts are not publication inputs.
These focused results do not replace a fresh aggregate gate on the final integrated
commit. Installed desktop behavior and external merchant writes were not tested.
