# Listing validation feedback audit — 2026-10-16

Baseline: `ff5af785` (integrated refresh/range worktree).

## Result

No additional production defect was established in this bounded audit. No UX issue is added to the fixed-issue count, and production behavior is unchanged. The existing listing draft regression now explicitly covers source validation failures as distinct from rejected HTTP save requests.

## Reachable flow and evidence

The test mounts production `BusinessOperations` React, uses its enabled labeled fields and Save button, and routes local `/api/dsh-apps` requests to the production business engine with in-memory SQLite. Product, image, procurement cost and store facts use the verified public sanitized frozen corpus. Sales aliases, entered content, HTTP 409 and provider failures are explicit local controls, not observed merchant defects.

The existing test covers invalid advanced JSON, fixing and applying JSON, preservation through row selection and filtering, HTTP save rejection with retry, repeated Save during an outstanding request, and confirmation cancellation. Added controls throw a `BusinessSourceValidationError` with a field diagnostic and an ordinary source-read error from the source port during Save:

- The engine preserves the entered title in the saved draft for both failures.
- React retains that title and shows the corresponding diagnostic.
- Save is disabled after persistence because this is a saved draft with validation issues, not a lost or unsaved HTTP mutation.
- Correcting the title enables Save; saving revalidates, clears the superseded diagnostic, and preserves unrelated attributes, custom fields, weight and procurement composition.
- No correction requires submission or an extra confirmation. Review and transport counters stay zero; no submit request is sent.

The existing “draft saved, not submitted” notice is accurate in these controls: persistence succeeds even when validation returns issues. This audit does not reinterpret that notice as a false success. Existing packaging-specific feedback and no-action submission guards are not claimed as new fixes.

## Validation

Focused command:

```sh
node --test test/plugin-apps/listing-draft-editor.test.ts \
  test/plugin-apps/business-operations.test.ts \
  test/plugin-apps/listing-packaging.test.ts \
  test/operations/business-operations.test.ts \
  test/operations-adapter/listing-content.test.ts
```

- Node 22.18.0: 33/33 pass.
- Node 24.21.0: 33/33 pass.
- Real-data classification audit: PASS; the extended test remains an existing required corpus-backed file. No new test file requires registration.
- `tsc --noEmit`: PASS. `git diff --check`: PASS.

Raw execution logs remain local and are not part of this commit. No merchant calls, model review, publishing, native desktop run, screenshot evidence or full-suite claim. The source port failures are deterministic fault controls; this is React-renderer plus real-engine verification, not live provider/network acceptance or visual layout QA. It does not establish that every possible listing field is validated before Save.
