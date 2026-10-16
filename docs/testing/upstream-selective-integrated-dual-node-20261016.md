# Selective upstream integration and two UI recovery fixes

Date: 2026-10-16 UTC. Public baseline: `46c31cede0257ffea2878b9a6933215da0390fc2`.
Tested commit: `256cb8cd03b80bdfe0b2d219a8fa38c3b4c9ab06`; tree: `7c8eb6aa605888dc714f2255c64303848627f141`.
This report is added after validation and changes no tested source or tests.

## Selective upstream integration

Upstream commits `624c35afc7bfabdfa7a46c8a1d03fbda65fb08e6`, `90e7366f1f5d58da93e7230f99ba9e610da83173`, and `5784fa5344f35e4e998bbadd49e4472fcd7607d1` supplied these selected changes. They are upstream-authored fixes and supplemental coverage, not newly discovered UX issues in this integration.

- Packaging receipts match canonical SKU/composition identity independently of JSON field order and combination aliases, then map back to existing UI keys. Malformed receipt values remain rejected.
- A deliberately emptied Agent-request draft survives collapse and reopening instead of being replaced by its template.
- Packaged Runtime parity keeps valid numeric/string product identities and uses explicit protocol aliases for redacted IDs, without changing recorded business facts or production validation. Separate stores cover numeric 1, string "1", and "9007199254740993" without precision loss or cached-result masking.
- The directory HTTP test's private port allocator retries EACCES and EADDRINUSE up to the same twenty attempts. Controlled transient denial, exhaustion, unrelated errors and actual occupied ports remain tested. This is fixture behavior, not a new production port policy or a Windows execution claim.
- Supplemental cases cover nineteen recovery-guidance/engine admission conditions, range-read recovery, review-ready eligibility without dispatch, pending saves with newer drafts, and independent reads surviving linked cancellation.

The integration was independently reviewed at `32d2f0ff7c3d8d8813da06875b43b3d91df3bae5`. It did not replace whole overlapping files. Existing packaging reparsing, confirmation fingerprint checks, material semantic-key checks, and all four original linked-cancellation scenarios remain. Four independent-binding scenarios were appended. Classifications were added without removing prior entries. Unrelated callback renames and upstream document histories were not imported.

## Two separately reviewed UI fixes

1. [Batch inspection continuity](../business-inspection-selection-audit-20261016.md): successful platform-status inspection retains still-valid checked rows, hidden restoration selections, filters and unapplied batch-price input. Existing mutation reset behavior remains; eligibility and stale-confirmation controls still apply. Candidate source `14eecd27830e0c98bd7449f373480e2b01d3861d` was independently reviewed with baseline reproduction and positive/negative controls.
2. [Workbench response recovery](../workbench-read-response-recovery-20261016.md): malformed/read-body failures retain the previous usable snapshot and expose retry guidance. Authorization/not-found responses still discard data; writes and aborts are not made retryable. Candidate source `05c3b09c2f219c3b369cfd4c3f6331b4a88aa3ec` was independently reviewed against baseline with HTTP-policy controls.

These are distinct from the upstream supplements. Their production files do not overlap the two selected upstream production files.

## Frozen dual-runtime gate

| Actual runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 125 | 710 | 708 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 125 | 710 | 708 | 0 | 2 | PASS | PASS |

Both complete case-name/outcome multisets match. Compared with the prior 119-file/689-case combination, 21 cases are additive; no existing case was removed or renamed and neither skip changed. Scope expands by three new related files, the materials test, and two performance tests. The parity probe is a supporting script, not a third performance test file.

Existing skips, excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

The explicit packaged Runtime isolation test passed on both runtimes and was not skipped. Both data audits passed with 338 test files, 182 required entries, 171 infrastructure entries and source counts 20/20/1. All four new classifications are present exactly once.

Each runtime ran audit, the complete selected tests and typecheck serially, with test concurrency one and a 900-second external stage limit. Test-specific deadlines were unchanged. All six stages completed naturally with exit zero. All 1461 tracked files remained byte-identical before and after each stage. Combined source SHA-256: `745ffd50fa9ea4284eb37d09170884fce07990f8fdb0488229a3a9a9138eead5`.

The final source was built locally using the documented bundle script. Its manifest still declares **1.0.0-candidate.76**; it is not an installed candidate.99 build. The generated archive is 2387435 bytes, SHA-256 `4cf47d8ed082203c812295ac6728d8759bc529b0425bd911fb71113e9ac7f244`, and remained unchanged throughout both-runtime validation. It stays local and was not installed or included in the publication tree.

## Before/after evidence and retained failures

On unchanged public production, the added empty-draft assertion failed as expected, and the canonical-receipt test failed because the next intended save remained disabled. The first two-file baseline run had 26 cases: 23 passes and three failures. Two were those intended reds; the third was an existing material-source-connection case reaching its unchanged 15-second fixture deadline. That existing case passed unchanged on an isolated recheck; no cause is asserted and no timeout was increased.

Directory tests with the original port helper reproduced two EACCES failures while EADDRINUSE/exhaustion/unrelated-error/real-port controls behaved as expected. Initially the packaged Runtime case skipped because the fresh worktree lacked an archive. The first documented build attempt failed because npm's default cache location was unavailable; selecting the existing writable local cache allowed the build. With a real baseline archive, parity then failed at `productId: expected JSON value`, reproducing the redacted-ID conversion defect.

After the precise upstream changes, all 61 selected Node 22 tests passed, including the actual archive isolation case and directory controls. The two independently reviewed UX candidates were then integrated, the final source rebuilt, and the complete dual-runtime table above executed. Initial skips, reds, setup failure and transient timeout are retained in local evidence rather than relabeled as first-pass successes.

## Reproduction and boundaries

Use the repository's frozen lockfile dependencies and matching recorded corpus. Select each exact Node and its npm/PATH, with a writable npm cache. Run:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  "test/apps-components/*.test.ts" \
  "test/plugin-apps/*.test.ts" \
  "test/operations/*.test.ts" \
  "test/business-pricing/*.test.ts" \
  "test/operations-adapter/*.test.ts" \
  test/apps-runtime/business-settings-http.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/business-packaging/packaging.test.ts \
  test/service/packaging-settings.test.ts \
  test/app-hallmark/packaging-evidence.test.ts \
  test/materials/business-recovery.test.ts \
  test/performance/runtime-artifact-isolation.test.ts \
  test/performance/directory-draft-etag.test.ts
npm run typecheck
```

This is a 125-file selected combination, not the default full repository suite. The incident report informs priorities; historical incident replay and unavailable local source are not prerequisites for these bounded checks. This report does not validate the user's uncommitted listing changes or installed candidate.99, nor establish whether any particular UI fix is present there. No automatic merge into that local branch occurred.

There was no live merchant request/write, paid model call, browser visual acceptance, desktop installation or deployment. Publication is a separate reviewed step. Only selected source/tests, classification and human-readable reports are included; raw logs, manifests, generated fixtures, archives and diagnostic probes remain local.
