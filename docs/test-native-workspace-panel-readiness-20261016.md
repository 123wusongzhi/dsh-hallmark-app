# Native workspace panel readiness regression

## Scope and diagnosis

The Node 24.21.0 related-suite run at `5eca12cf3e3829877087801990df962bd87540a8` failed in `test/plugin-apps/native-workspace.test.ts`: one close-tab button remained when zero were expected. The immediately preceding persisted `panelState === 'closed'` assertion passed. This is distinct from the earlier renamed-component revision assertion race.

The test is unchanged from public baseline `67374c97f03a1b91bef920fd50abdc2f3960ac72`. A diagnostic fixture delayed delivery of the real `closeDraft` response by 200 ms after the host completed it. Both public baseline and candidate reproduced the same remaining-tab failure. The UI correctly waits for the close receipt before moving the tab into the restore list; a fixed 40 ms test sleep does not establish completion.

An unmodified isolated candidate run additionally failed at workspace remount because the restore entry had not rendered. Delaying only the remounted views catalogue reproduced that distinct readiness failure after the close wait was corrected.

## Minimal correction

The test uses its existing bounded `waitForUI` helper at two boundaries:

1. After closing, wait until the close tab is absent and its restore entry is present.
2. After remounting, wait until both the persisted closed view's restore entry and the other open view are present.

All 60 original assertion statements remain unchanged. No production code, expected values, or timeout limits change. The second wait requires positive catalogue evidence, avoiding a vacuous negative assertion against an empty initial render.

## Focused verification

- Node 22.18.0 and Node 24.21.0: normal focused test passes.
- Both runtimes: focused test passes with combined 200 ms close-response and remounted-catalogue delays.
- Node 24.21.0 fault check: a diagnostic fixture acknowledges close without persisting it; the original persistence assertion still fails, despite the UI showing the closed state.
- Node 24.21.0 typecheck passes after documented offline test-data preparation; corpus audit passes for 329 test files.
- `git diff --check` passes.

Diagnostic wrappers and raw logs remain local and are not part of this change. These focused checks do not establish a full related-suite pass; the final integrated source must run that gate separately. No merchant operations, external writes, or publication were performed for this diagnosis.
