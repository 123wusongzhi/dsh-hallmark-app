# Fresh listing category fallback binding audit

## Scope and finding

Base: `0c2bf5384672f48b26bdb2ba28aa6740d2aa2046`.

The current listing preparation path automatically selects a template from a category hint obtained during exact single-SKU packaging enrichment. The hint was returned without revalidating its source association. Removing or reassigning that association left the cached hint eligible for a later preparation. Complete source packaging skips enrichment entirely, so enrichment cannot reliably invalidate the old hint.

This is an evidence-ownership defect, not a missing default or a requirement to copy business rules across stores. No historical incident replay or release candidate is needed to reproduce it.

## Narrow change

`readExistingCategoryHint` now checks each recorded evidence binding against the current merged local catalog: store, offer, platform product, source item, source SKU, and exact one-unit composition must still match. Invalid or unverifiable hints return no fallback; the existing category search remains available. Explicit caller category selections remain unchanged.

The check is local and read-only. It neither deletes hints nor invokes a provider. Unchanged associations remain usable after unrelated status/catalog updates. Reattaching the same exact association permits reuse again. Records with their existing binding metadata remain compatible; records without verifiable binding metadata safely fall back to search. No arbitrary expiry policy was introduced.

## Reproduction and controls

The final packaging-evidence test file contains 20 tests. Applied to unchanged baseline production code, it yields 16 passing and 4 failing tests on each exact runtime, Node 22.18.0 and 24.21.0. Failures cover stale fallback after detachment, the actual preparation template-versus-search path, cross-store identity collisions, and unverifiable legacy metadata. All pre-existing tests pass on baseline.

Regression/negative controls include:

- Detached association; another source using the same SKU name; changed SKU; unverified association; replaced platform product; multi-unit composition
- Complete source packaging, so no additional provider read occurs
- Current valid hint, explicit category override, and search after invalidation
- Same offer/SKU identities in another store cannot rescue a detached owning association
- Restoring the exact original association allows reuse; another source cannot read that hint
- Archived status and unrelated catalog changes preserve valid category evidence
- Returned hints are defensive copies
- Missing binding metadata falls back without deleting records
- Local catalog read errors propagate without mutating evidence

## Commands

Set `DSH_REAL_CORPUS` to the existing verified local private corpus. Use the exact runtime executable for each version.

- `node --test test/app-hallmark/packaging-evidence.test.ts`
- `node scripts/audit-real-test-data.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node --test --test-concurrency=1 test/app-hallmark/packaging-evidence.test.ts test/app-hallmark/listing-prepare.test.ts test/app-hallmark/listing-category-reuse.test.ts test/app-hallmark/listing-category-retry.test.ts test/app-hallmark/listing-provider-revision.test.ts test/app-hallmark/listing-prepare-output.test.ts test/business-pricing/pricing.test.ts test/business-pricing/dynamic-pricing.test.ts`

## Final verification

- Node 22.18.0: corpus audit PASS; repository-wide TypeScript check PASS; selected regression tests 91/91 PASS
- Node 24.21.0: corpus audit PASS; repository-wide TypeScript check PASS; selected regression tests 91/91 PASS
- `git diff --check`: PASS

## Boundaries

This audit does not introduce brand, inventory, category, or pricing defaults; missing pricing configuration retains its existing block. The selected regression set includes pricing isolation and revision behavior, but does not certify every workspace/UI flow. No browser, live merchant/provider call, user-computer action, full-suite run, build, or GitHub publication was performed. Only sanitized source tests and this summary belong in the commit; private corpus and raw test output remain local.
