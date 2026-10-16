# Native workspace asynchronous checkpoint audit

## Scope

The related-suite run at `f58955bc434f3563aaed5dcaaf5cc20dd4474f00` reached the corrected close/remount checks, then failed at the native source draft's preparing-status assertion. Its `view` response had not finished within the test's fixed 40 ms sleep. A targeted delay reproduces that same draft-status failure on public baseline `67374c97f03a1b91bef920fd50abdc2f3960ac72`.

This change audits the complete `native-workspace.test.ts` workflow rather than patching only that final symptom. Production code is unchanged. All 60 original assertion statements, exact expected values, the 3-second readiness deadline, and the 15-second fixture-process timeout are preserved.

## Audited boundaries

For each of the following ten boundaries, a diagnostic transport delay reproduces failure against the pre-change `f58955b` test, and the corrected test passes the same targeted delay:

| Boundary | Completion evidence before original assertions |
| --- | --- |
| First component-history expansion | Historical open action has loaded and is enabled before collapse/reopen cache checks |
| Open historical revision | One open callback received and library action no longer busy |
| Library-change event | Updated saved title rendered and catalogue no longer busy |
| Restore closed view | Original close tab rendered and original view selected |
| Begin new component | New component tab rendered and authoring action no longer busy |
| Mount save controls | Owned view's title loaded before the user edits it |
| Display-ready save refresh | Save eligibility reflects the verified response |
| Mount native source draft | Preparing status rendered |
| Mount historical unbuilt card | Unbuilt status rendered |
| Mount historical built card | Open action rendered |

The first history wait is important: reopening before the initial read completes tests an aborted read rather than the intended successful-history cache reuse. The initial save-controls wait also matters: editing before initial form hydration can let that hydration overwrite the test's purported existing user edit.

Existing readiness checks continue to cover the initial library, rename, renamed history, workspace catalogue, close, and remount. The explicit workspace refresh now requires a newly recorded successful views response, a completed application-list refresh, and the retained restore entry before its original negative closed-tab assertion. This avoids treating an unchanged old UI as evidence that refresh finished.

Local form changes, history collapse/reopen after a completed read, saved-tab activation, opening an already-owned tab, and saved-library intent initialization are synchronous React state/effect transitions. They use `act` without arbitrary sleeps. The sole remaining 40 ms delay is the polling interval inside the bounded readiness helper; it is not a completion assumption.

## Verification and fault sensitivity

- Final uninstrumented focused tests and the 329-file corpus audit pass on Node 22.18.0 and Node 24.21.0. Node 24.21.0 typecheck and `git diff --check` pass.
- Actual Node 22.18.0 and Node 24.21.0 each pass whole-workflow stress with every API request delayed by 150 ms and, separately, every API response delayed by 150 ms. Each run exercises 74 delayed calls.
- All ten targeted-delay cases pass on Node 24.21.0 after correction.
- All ten corresponding rejected-operation fault probes still fail; waits do not swallow errors or accept failed work.
- A successful historical-open receipt corrupted to source revision 99 still fails the unchanged expected-revision-1 assertion.
- Wrong-owner view responses remain rejected at native draft, unbuilt-card, and built-card checkpoints.

All injected delays, faults, generated probes, and raw logs remain local. Earlier aggregate failures are preserved, not replaced by focused successes. These checks establish this test's checkpoint behavior, not a full related-suite pass; the integrated source still requires its final dual-runtime gate.
