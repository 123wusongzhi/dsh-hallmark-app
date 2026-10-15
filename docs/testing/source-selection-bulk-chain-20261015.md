# Source page-bulk selection and attachment regression audit

Date: 2026-10-15. Base: `ad7595fc4c207def69e8a831e3d487080ad77f78`.

## Contract and excluded alternatives

The checked-in collected-products and helen-margin templates offer read-only business data, local search/sort/page controls and selection; neither exposes product field editing. `ProductSelectionContext` in `packages/dsh-plugin/client/selection.ts` contains stable identities and provenance, not edited product values. The existing `collected selection uses original IDs despite display mappings and excludes all product content` test confirms this boundary. No edited-value requirement is added.

The existing `duplicate selection uses the existing native attachment, including after table order changes` test already covers order-independent attachment deduplication. This audit does not redefine attachment ordering: `sourceSelection` resolves selected identities in source snapshot order, not click order.

The added boundary is page-local bulk deselection. The actual control is labelled `选择本页商品`, while a separate `清空选择` action clears the whole selection. The component stores a selection across pages and `docs/source-component-authoring.md` requires cross-page selection checks. Cancelling selection on one page must not remove choices from another page.

## Added coverage

`test/source-preview/selection-bulk-chain.test.ts` runs the actual collected-products Component, its checked-in `useHallmark`/client, `handleSourceRequest`/`sourceSelection`, and `SelectionInputBridge` together. It uses 25 unchanged public corpus summaries, ordered by their provided timestamps.

1. Select one product on page 1 and another on page 2.
2. Return to page 1, select that page, and attach. Independently specified complete File JSON must contain exactly the first 21 source identities, with no duplicate of the already selected first product.
3. Deselect page 1. All 20 visible checkboxes become unchecked, but the attachment button must remain enabled.
4. Return to page 2 and verify the same product remains checked and the other four are unchecked. Attach again and check the complete File JSON contains only that retained product.
5. Verify two native drafts/add calls, the existing attachment preserved, no draft release, exact current revision, and no refresh/text modification/automatic submit.

The test checks enabled controls before clicking. It uses Node/react-test-renderer; this is actual React rendering/effects, not browser DOM/layout or desktop acceptance. Provider calls, postMessage delivery, native input/file registration, revision and session/view/build metadata are controlled fixtures. No source product fields are rewritten, and no merchant operation or actual upload is performed. Repository paths are resolved from import.meta.url, not the invocation working directory. Corpus initialization precedes temporary-directory creation, fixture processes have a 15-second deadline, and the enclosing finally removes the temporary fixture directory.

## Mutation proof

In `component-workspace/collected-products/src/Component.tsx`, replace the single expression:

```ts
all?next.delete(item.key):next.add(item.key)
```

with:

```ts
all?next.clear():next.add(item.key)
```

This conflates cancelling the current page with clearing the global selection. No mutation is committed.

Old neighbors:

```sh
node --test test/plugin-client/source-component.test.ts test/plugin-client/selection.test.ts test/source-preview/selection-interaction.test.ts test/source-preview/formatter-sharing-compatibility.test.ts
```

The old UI test attaches before its page-bulk operations and subsequently checks only a current-page checkbox. It never rechecks or reattaches the off-page selection. Lower layers receive an already prepared selection and do not exercise this component update.

Observed: original new 1/1 pass; mutated old 30/30 pass; mutated new fails at `deselecting the current page must retain the other-page product and leave attachment available` (disabled true, expected false); restored new 1/1 pass; final combined 31/31 pass; real-data audit PASS; `git diff --check` pass. Independent pre-publication checks: combined old 30 + new 1 + the two published refresh-chain tests passed 33/33 (1.28 s); under mutation old 30/30 and both refresh-chain tests remained green, new failed at the exact disabled assertion, restored new passed 1/1. Repository-external cwd passed 1/1 after path hardening. `tsc --noEmit` exited 0; data audit passed and production files were unchanged. Missing-corpus initialization and a mounted component/SDK fault each failed explicitly without leaving a temporary directory; the mounted-fault cleanup left zero listeners. The full repository test suite was not run for this focused audit. The unmodified production code passes; this is a missing detector, not a production defect or fix.
