# Listing completion identity audit

## Scope

Current available source baseline: `256cb8c`. This is a newly discovered current-code defect, not a replay or attribution of any historical incident. Tests invoke production AppCore, WriteOperations, receipt projection, and in-memory AppStore with controlled adapter responses. No merchant service, credentials, live import, browser, or model execution was used. Captured source fixture helpers provide source-data prerequisites; response faults are explicit local variations.

## Finding

`WriteOperations.verifyListing` selected the first matching import-info row. Two rows for one offer could therefore terminalize the operation differently depending on ordering: imported-first became success; rejected-first became failure. Once terminal, ordinary inspection no longer read the original request, so a later unambiguous rejection could not resolve a false success.

The same path accepted `product_id: true` and `product_id: [22]` as positive product IDs through JavaScript number coercion. These malformed identities could produce false imported-success receipts.

## Correction

Require exactly one matching row with an exact string offer identity. Duplicate receipts remain unknown, including duplicate identical successes. Imported-success additionally requires a positive safe integer number or canonical positive decimal string. No write/replay logic, merchant permission, or terminal transition rule changes.

The existing completion boundary remains import-only: `imported-not-sellable-verified`. This does not establish stock availability, marketplace moderation, or on-sale status.

## Controlled evidence

- Baseline with all 32 focused tests: 27 passed, 5 failed. The failures establish both duplicate-order cases, duplicate identical successes, boolean IDs, and array IDs.
- Fixed focused suite: 32 passed, 0 failed.
- Fixed full core suite: 205 passed, 0 failed.
- Commands: `node --test test/core/core.test.ts` and `node --test test/core/*.test.ts`.
- Controls cover valid number/string product IDs, accepted/pending response, missing rows/identities/product IDs, delayed rejection, partial batch rows, restart read-only recovery, replacement-key blocking, one import write, and terminal monotonicity.
- Existing stock-readback tests execute in the full core suite and retain inventory/product/warehouse identity checks.

Raw execution logs remain local and are not included in this deliverable. These results establish controlled local engine behavior only; they do not claim real merchant acceptance or historical incident reproduction.
