# Category cursor recovery audit (2026-10-16)

## Scope

Cloud-only current-source audit based on `d77fdef` (tree-equivalent to supplied public `9bbbe1c088a099a70f5754ebd8c13722728f6f06`). Separate from the completed unknown-attribute repair and the earlier strict dictionary continuation change (`1701632`). No live merchant/model calls, credentials, user computer, paid operations, publication, or raw evidence uploads.

## Proven defect and repair

`hallmark.listing.category.read` decoded cursors without shape/encoding checks and collapsed cursor failures into `LISTING_CATEGORY_READ_FAILED`. A caller with a damaged offset but a valid saved snapshot received no executable recovery, even though the program retained the exact category and filter scope. Malformed JSON/null could also expose low-level parser/type error text.

The narrow repair validates canonical base64url and decoded revision shape, returns `LISTING_CATEGORY_CURSOR_INVALID` with `retryPolicy: never`, and checks store ownership before exposing snapshot information. An invalid offset referencing a verified same-store snapshot supplies a bounded executable restart at offset zero. The response explicitly says this is a restart, preserving the snapshot, scope and selected attribute filter rather than silently widening or substituting current results.

Malformed, absent, deleted and wrong-store references cannot safely identify the original category. They return bounded guidance naming `descriptionCategoryId` and `typeId` as required original inputs, without an invented executable route, snapshot metadata, or guessed values. The message also tells the caller to preserve the original filtering scope. This deliberately does not claim automatic recovery when evidence is lost.

## Measurement and controls

The deterministic reproduction uses recorded sanitized category/store facts through actual AppsRuntime invocation and actual model projection. Corrupt cursor offsets and deleted local cache records are explicit negative controls.

- Baseline on exact Node 22.18.0 and 24.21.0: the first invalid-offset request plus an identical retry both failed with the generic error, no executable recovery, and one category source read.
- Fixed: one rejection followed by the supplied one-attribute recovery succeeds, with no additional category source read. A forced current-template refresh does not replace the recovery snapshot.
- Controls cover negative/fractional/unsafe/string/null/out-of-range offsets; malformed encodings; JSON null/array/scalar/empty-object shapes; invalid revision type; absent and actually deleted snapshots; wrong existing store; valid continuation; required-only and selected-attribute scope preservation; bounded errors; and zero business operation records.
- Missing/wrong-store references expose neither revision nor category selection. No dictionary values are generated or chosen by the fix.

Category constraint snapshots currently have no TTL expiration semantics. Old valid cursors intentionally read their frozen snapshots; this audit does not relabel that behavior as stale-data failure or add an expiration policy.

Dictionary value pagination already rejects stalled, empty, malformed and non-advancing continuation evidence, distinguishes partial completeness, and preserves upstream/legacy failures. Existing dictionary continuation regressions are rerun unchanged; no separate new dictionary defect is claimed.

## Validation

- Exact Node 22.18.0 and 24.21.0: baseline regression red on the generic error code; final focused suite 17/17 passed on each runtime.
- The suite comprises the new cursor regression with negative controls, the two existing category retry/unknown-attribute tests, and 14 unchanged dictionary continuation tests. This is one new test, not 17 new tests.
- `tsc --noEmit` and `scripts/audit-real-test-data.mjs`: exit 0 on both exact runtimes; offline browser fixture preparation completed first.
- Initial audit failure correctly identified the new test as unclassified. The test was added to required recorded-source coverage, then both audits passed. An initial deleted-snapshot control used the stable-business store key against the fixture's provider store; the assertion failed, the fixture key was corrected, and both runtimes passed the actual deletion control.
- `git diff --check`: passed. No full repository suite, generated bundle rebuild, native UI, live model or merchant acceptance was performed.
