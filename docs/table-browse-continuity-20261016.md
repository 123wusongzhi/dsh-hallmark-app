# Preserve a table's reading position on refresh

Baseline: `ff5af785` (2026-10-16). This is a local candidate, not a published or installed release.

## Reproduced user journey

Open a generic data table backed by a paginated source, browse to local page 3 of the current 35-row batch, then refresh the same query. The baseline unexpectedly returns from rows 21–30 to rows 1–10. The same regression expectation fails against the baseline production table. A user must advance twice again to resume the same position.

The test mounts production `WorkbenchInstanceView` and `ProductTable`, and routes their read requests into the real `AppsPresentationService` and in-memory `RuntimeStore`. Only the capability provider and HTTP error conditions are controlled locally. Product fields and store identities come from the verified recorded corpus; the 35-row page size, cursor, cache metadata and failures are explicit offline test conditions. No live store is contacted.

## Minimal change

A non-full table now resets its local page when the dataset identity changes, rather than whenever React receives a replacement binding, data object or rows array. This matches the existing product-list reset policy. Same-query refreshes retain the page; a shorter result clamps to its last valid page. Different remote batches and owner changes still reset to page one. Search and sort continue to reset the local page intentionally. Existing selection invalidation is unchanged.

## Executable coverage

`test/plugin-apps/table-browse-continuity.test.ts` verifies:

- Same-query success keeps rows 21–30; the refresh still makes exactly one UI read and one provider invocation.
- Local page changes make zero UI reads and zero provider invocations.
- HTTP 503 fallback and service-generated failed snapshots retain the current page and display recovery notices.
- Shrinking to 12 rows clamps to rows 11–12; subsequent growth keeps that valid page.
- Next remote batch and return to first batch reset the local page and send the expected cursor.
- Local search is preserved across refresh; search and sorting reset the page without extra local-navigation reads.
- A persisted store change resets the page; a permission failure removes the old table.

The baseline red run stops at the first successful-refresh assertion; later negative cases are candidate regression coverage, not separately measured baseline failures.

## Verification limits

These are real React/service integration checks with an isolated transport/provider, not browser interaction or visual acceptance. No browser timing, latency, merchant request reduction, full-suite pass, publication, deployment or desktop installation is claimed. The query count is unchanged: the improvement is preserving reading position.

## Completed validation

Both exact runtimes from the shared recovery manifest were used:

- Node v22.18.0: focused group 37/37 passed; final added local-sort request-count assertion rerun 1/1 passed; real-data audit passed; TypeScript `--noEmit` passed.
- Node v24.21.0: final focused group 37/37 passed; real-data audit passed; TypeScript `--noEmit` passed.
- `git diff --check` passed. The real-data audit found 330 test files and zero failures.

Focused group: `test/plugin-apps/{table-browse-continuity,workbench-cache-ui,workbench-cache-fallback,workbench-ui,workspace-resume}.test.ts`, `test/plugin-client/{table-format,selection}.test.ts`, and `test/apps-components/product-list-paging.test.ts`, run with `--test --test-concurrency=1`. Generated browser fixture preparation was offline; no full bundle build or full repository suite was run.
