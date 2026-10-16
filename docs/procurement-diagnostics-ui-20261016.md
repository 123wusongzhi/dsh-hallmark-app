# Procurement validation diagnostics in the business editor

## Reproduction and scope

Base: `f96b355`. Candidate production/test commit: `9dbace4cb2a48c1f9c4fd53c55139c809af9dc89`.

The adapter already returned exact, bounded procurement SKU candidates with source-reference paths and completeness flags. The editor discarded this structured evidence. A failed initial preparation showed “尚无采购关联” even though the user's explicit source item, SKU and quantity remained on the row. When a previously valid SKU disappeared, the engine correctly blocked execution but retained its previous binding; the table still displayed that old binding and cost without marking it unverified.

This is distinct from the previously fixed rejection/no-op eligibility guidance and Agent-context publication display. It does not change submission eligibility or claim to solve category or cost-maintenance recovery generally.

## Narrow change

- Display the original explicit procurement item/SKU/quantity and unverified-cost wording when binding is absent or source-SKU validation has failed.
- Display backend candidates as escaped static text only. Match the exact indexed SKU field and source-reference item field to the current row before presenting candidates. Show full, incomplete and empty-candidate states separately.
- Explain that the content editor cannot edit procurement associations; the original plan's association must be corrected and saved before explicit reconfirmation. Candidates are never auto-selected.
- Hide candidates for local unsaved edits, hidden views and unverified batch reads. Non-editable/uncertain execution states do not show replacement candidates. Existing owner isolation and confirmation fingerprints remain authoritative.
- Add no read, write, retry, timer or transport operation. Rendering static diagnostics and typing edits add no reads. Existing discard, resume and explicit list-refresh paths still revalidate the batch. A list reread verifies the saved batch, not real-time source freshness.

## Test method

`test/plugin-apps/procurement-diagnostics.test.ts` mounts the actual React editor using actual HallmarkBusinessAdapter, BusinessOperations and an isolated in-memory SQLite store. Store/source facts originate in the immutable recorded corpus. Source IDs, invalid references, status controls, large spec strings and source-SKU removal are explicit derivatives. A local fetch bridge routes editor list/revise/submit requests into the real engine. Source reads are counted; reviewer and dispatch functions throw if reached.

The test verifies retained title and procurement input, exact candidates and source identity, zero extra reads/writes on rendering/editing, one source read for multiple invalid references to the same source, bounded/partial diagnostics, no candidates, mismatched reference paths, old confirmation invalidation on same-revision candidate changes, hidden and owner changes, uncertain/completed status controls, valid-binding display and stale-binding suppression after a real source failure. Existing related tests cover correction through successful local transport and engine no-repeat rules.

An opt-in baseline mode substitutes the two historical production files from `f96b355`; the same test fails because the candidate region does not exist. It is not a synthetic helper-only reproduction.

## Boundaries

These are React-renderer and runtime tests, not browser acceptance. Real browser verification remains unavailable because the ordinary browser launch was blocked by socket permissions; no workaround was attempted. No merchant, model, paid service, user-computer, GitHub-write or upload operation occurred. Raw fixtures and logs remain private local evidence; this report contains no source records.

## Frozen dual-runtime validation

Exact Node 22.18.0 and 24.21.0 each pass all 52 focused tests across eight files, TypeScript checking and the real-test-data audit (340 test files, 183 required entries, 172 infrastructure entries). The identical baseline substitution fails on both versions at the missing candidate region. `git diff --check` passes. The 836-file source manifest is unchanged after both runs: SHA-256 `e60868e8d39a894cb9d8eac03821e673340f1f05fc77a4e0d95bb889788f7c3c`. These are focused regressions, not a new full-suite run.

Sanitized validation log hashes:

- Node 22.18.0 baseline: exit 1; SHA-256 `e59e42de8deaf8d00d84ccfdb914136a3488cecbecac1eba488d85b851c3c0f8`.
- Node 22.18.0 focused: exit 0; SHA-256 `bd8f0c2fc99cade5ab1327ce291b192c12b1699f372063dede4da37a12c646ed`.
- Node 22.18.0 typecheck: exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Node 22.18.0 audit: exit 0; SHA-256 `aaaf074c476bb2158bc5d0cac0dd1d5be1b93e616519832c3b1856bb583ac296`.
- Node 24.21.0 baseline: exit 1; SHA-256 `b60c0d319895d7f4e7100512397a1b913b212b78c337f860bdb76a2cf4504abe`.
- Node 24.21.0 focused: exit 0; SHA-256 `669298ab1c01366eadb11a1cf81f0b9c0f33f17e0d10dec9c11e6f3750266627`.
- Node 24.21.0 typecheck: exit 0; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Node 24.21.0 audit: exit 0; SHA-256 `aaaf074c476bb2158bc5d0cac0dd1d5be1b93e616519832c3b1856bb583ac296`.
