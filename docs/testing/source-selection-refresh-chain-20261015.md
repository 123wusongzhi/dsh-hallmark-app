# Source selection refresh chain regression audit

Date: 2026-10-15. Base: `e0a40cde0d85b771b16d836143a602aecc2a5d79`.

## Coverage added

`test/source-preview/selection-refresh-chain.test.ts` exercises the unchanged production chain:

1. `sourceData` and `handleSourceRequest` expose the current source snapshot.
2. The actual collected-products component imports its checked-in `useHallmark` and `createHallmarkClient` SDK, with no hook replacement.
3. Selection crosses local table pagination and a host refresh.
4. `sourceSelection` resolves the submitted keys against the current snapshot.
5. `SelectionInputBridge` registers an actual JSON `File` through a local adapter for the public native attachment API.

The two cases check that removing one selected row retains the other selections, and that a refreshed snapshot revision reaches the host attachment request. They independently assert the complete final file object, including exact corpus product IDs and refreshed timestamps. Existing attachments remain present, the composer text/submit APIs throw if invoked, and SDK listeners are released on unmount.

The 25 summaries come directly from the hash-validated public deidentified corpus. The refresh subsets and reverses the summaries without changing any product field. Snapshot revisions, timestamps, view/session metadata, transport, and native file API are controlled infrastructure inputs. This is an offline source-rendering/SDK/selection integration test; it does not claim a real provider call, desktop execution, network access, or merchant operation.

## Proven old-suite misses

Neighbor command, 29 tests:

```sh
node --test test/source-preview/selection-interaction.test.ts test/plugin-client/source-component.test.ts test/plugin-client/selection.test.ts
```

New command, 2 tests:

```sh
node --test test/source-preview/selection-refresh-chain.test.ts
```

Each mutation was applied alone, both commands were run, the original production file was restored, and the new command was rerun.

| Mutation | Old neighbors | New tests | Restored |
| --- | --- | --- | --- |
| `component-workspace/collected-products/src/Component.tsx`: change the selection-pruning effect dependency `[products]` to `[]` | 29/29 pass | Removed-row case fails: `已选 3 件商品`, expected `已选 2 件商品`; revision case passes | 2/2 pass |
| `component-workspace/collected-products/src/lib/runtime/react.tsx`: change attachment callback dependency `[data?.revision]` to `[Boolean(data)]` | 29/29 pass | Both cases fail: attachment carries `snapshot-1`, expected `snapshot-2` | 2/2 pass |

Both are single-point dependency regressions that preserve the initial render and existing static-fixture tests. The old interaction test substitutes the entire hook; the host/selection tests call the lower layers separately. Neither executes the real hook across a refreshed table selection.

No production changes or mutation code are included in the deliverable. Test fixture transpilation uses the existing esbuild dependency; no install, project build, browser, or performance measurement is required.

## Final checks

- Combined new plus neighboring command: 31/31 pass; independently repeated before publication (1.15 seconds; no failures, cancellations, or skips).
- `node scripts/audit-real-test-data.mjs`: PASS; new file classified as a corpus-backed business scenario.
- `git diff --check`: pass.
- Direct Node TypeScript --noEmit: pass. Full repository suite was not run.
