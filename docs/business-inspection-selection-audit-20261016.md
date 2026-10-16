# Business inspection selection continuity

## Scope and result

Audited the business-operation batch screen against source baseline `c7b26cf` on 2026-10-16. One reproducible interaction defect was found: successful platform-status inspection discarded the user's selected rows and unapplied batch-price input. The same information survived a failed inspection, making the successful read unexpectedly destructive.

This is an isolated source candidate. It has not been integrated, published, installed or exercised against a merchant account. Existing refresh/new-form, discard, navigation and listing-editor fixes are outside this change.

## Reproduction

1. Open a batch containing an editable price row, a completed price row and an unresolved row.
2. Select the editable and completed rows, enter a batch price, and filter to the editable row. The completed selection remains hidden and available for restoration.
3. Click “核查平台状态”.
4. Before this fix, a successful response clears both selections and the batch-price input, disabling restoration until the user reconstructs the selection. The response may legitimately update an unresolved row without changing either selected row.

The regression uses the production React component and production BusinessOperations engine over an isolated in-memory store. Product and store labels come from the frozen source corpus. Local states, price inputs, missing execution receipt and delayed/failed responses are explicitly controlled conditions, not merchant observations. All source loading, review and merchant transport boundaries reject calls.

## Change

Successful inspection now retains selections whose row IDs still exist and retains the unapplied batch-price/currency inputs. Mutation acceptance keeps its existing reset behavior. Server outcome updates, filters, restoration eligibility and explicit save/submit boundaries remain intact.

The regression checks failed inspection, pending read, successful engine inspection, repeated inspection, hidden completed selection, editable selection, filter/currency/input continuity, and subsequent batch application without saving or submitting. It also verifies that only list and inspection requests occur.

## Validation

- Baseline regression on Node 22.18.0: failed at “Inspection must retain checked editing row”, as expected.
- Fixed focused React + engine regression: passed on Node 22.18.0 and Node 24.21.0.
- Related suite on both runtimes: 77 tests, 76 passed, zero failures, one Windows-only skill-installer skip. Command: `node --test --test-concurrency=1 test/plugin-apps/business-*.test.ts test/operations/business-operations.test.ts`.
- Typecheck (`node node_modules/typescript/bin/tsc --noEmit`) and real-data audit (`node scripts/audit-real-test-data.mjs`): passed on both runtimes.
- Whitespace check: passed.

This is React renderer and engine coverage, not browser typing, native-host or live-platform acceptance. The full repository suite and package build were not run for this isolated change. Raw logs remain local and are not part of this report.
