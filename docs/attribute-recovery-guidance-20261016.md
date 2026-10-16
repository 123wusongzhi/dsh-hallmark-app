# Unknown listing attribute recovery (2026-10-16)

## Scope and evidence

Local cloud-only source audit based on `f96b355` (the supplied integrated tree), not an incident replay or historical candidate acceptance. The change addresses one current defect: `hallmark.listing.category.read` rejected an unknown requested attribute with only `LISTING_CATEGORY_READ_FAILED` / `LISTING_CATEGORY_ATTRIBUTE_NOT_FOUND`, losing the invalid identities and actionable recovery path.

The reproduction uses the repository's authorized public sanitized recorded category/store corpus and the actual AppsRuntime and model projection. Unknown IDs, a very long unknown string, and a changed template are explicit negative controls, not marketplace facts. Client methods are local stubs; no network, merchant, model, paid, credential, desktop, or publication actions occurred.

## Repair

The request still fails with `retryPolicy: never`; it cannot silently succeed with only the valid subset. A typed error retains its specific code and supplies:

- Exact zero-based unknown attribute indexes (input schema limits the request to 100 attributes).
- At most 20 unknown IDs, each at most 128 characters, and an explicit omitted-ID count.
- Original category selection and exact inspected snapshot revision.
- An executable bounded `hallmark.listing.category.read` cursor input on the same store, reusing the existing pagination reader.

The recovery snapshot includes all inspected constraints, including optional attributes. Refreshing the category afterward cannot replace this snapshot. Existing per-attribute dictionary read routes remain available; no dictionary value is guessed or silently selected. These dictionary routes preserve category/type identity but are live/current reads, not a new promise of frozen provider dictionary versions.

Only this known typed error receives structured details; unrelated failures are unchanged. The snapshot is local read-cache state, not a listing draft, merchant write, or successful business operation.

## Measured two-request control

Baseline: the initial request and one identical retry produced two failed responses, zero executable recovery routes, and one cached category-provider read.

Fixed: the initial rejected request and its supplied recovery request produced one failed response and one successful one-attribute page, with the same one category-provider read. This removes one failed repeat in this explicit two-call control; total calls remain two. It does not establish universal request savings or model/merchant conversion improvements.

The complete one-attribute pagination control returned all 31 recorded attribute identities in 31 successful recovery reads, with zero additional category-provider reads. A forced refresh between rejection and recovery returned a different current template while recovery retained the original revision and category.

## Validation

- Baseline red reproduction: one pre-existing test passed and the new regression failed on the generic error code; two-call diagnostic confirmed absent recovery.
- Final focused tests: 2/2 passed on exact Node 22.18.0 and 24.21.0. This is one new regression test with several controls, not a count of many new tests.
- Related category/preparation tests: 110/110 passed on each runtime.
- Controls: mixed valid/invalid IDs, multiple invalid IDs, 20,000-character invalid string, 100 invalid IDs with explicit omissions, refreshed snapshot, full pagination, a different existing recorded store, malformed cursor, unchanged successful selected-attribute read, and no business operation records.
- Final `tsc --noEmit` and `audit-real-test-data.mjs`: exit 0 on both exact runtimes, after offline test-data preparation.

Initial setup failures were retained in local logs: strip-only Node rejected an initial TypeScript parameter-property draft (corrected to an ordinary field); the first typecheck also lacked generated browser-data. Offline `prepare-real-test-data.mjs` supplied that prerequisite before final checks. A first pagination assertion assumed provider order; it was corrected to compare identity sets because the established reader orders required constraints first.

No full repository suite, generated bundle build, native UI, live model, or live merchant acceptance was performed. Broader category/dictionary behavior was not established as defective by this narrow result.
