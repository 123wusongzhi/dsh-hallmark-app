# Save-panel metadata read recovery

Baseline: `0747ab5` (2026-10-16). Narrow local source change in `AppsSaveControls`.

## Observed gap

When the first view-metadata GET fails, the save form has no local retry. The Save button remains disabled, and the original UI describes the unknown view as not formally previewed/published. Users can recover by leaving and reopening the panel; the bug is missing in-place recovery, not data loss or an irreversible lockout.

The regression mounts the real React component with a genuinely verified saved source component. Requests go through AppsHost, HTTP transport, an ephemeral local server, AppsRuntime and AppsPresentationService. Only the selected view GET receives an injected 503. The unchanged baseline fails specifically at the missing retry-button assertion on Node 22.18.0 and 24.21.0, before production edits.

## Change

- Separate metadata-read failure from save-operation notices.
- Offer explicit “重新读取保存信息” after failure; synchronous in-flight protection coalesces repeated retry clicks.
- Preserve a name typed before the first successful metadata load, plus existing notes. Load the correct update target from the successful response.
- Preserve existing verified metadata on subsequent refresh failure and allow the same local retry.
- Expose read busy state and avoid claiming an unread view is unpublished.

This adds no automatic retry, write replay, new service API, or changed save/conflict policy.

## Verification

The new regression covers initial read failure, retained name/notes, repeated retry clicks producing one GET, recovered update mode, a later metadata-refresh failure/recovery, and zero save invocations/unchanged component revision throughout recovery.

Related regressions cover actual save updates/save-as/conflicts/pending publication and READY, plus lost library-mutation receipts, duplicate clicks and owner-checked read-only receipt inspection. All three scoped tests pass with no skips on both exact vendor runtimes Node 22.18.0 and 24.21.0; TypeScript checks also pass on both.

The first typecheck attempt in the fresh worktree failed because generated `test/real-data/browser-data.ts` was absent. The documented offline preparation was run before the final checks; the initial diagnostic log is retained locally.

The source-data audit passes after registering the new test as a local framework/protocol fixture; its initial unclassified-test failure is retained locally.

A negative control removes only the edited-title guard: the regression fails at the exact user-title preservation assertion (`原组件` versus `用户保留的名字`). This is separate from the original missing-retry red.

## Limits

This is local React renderer plus real local HTTP/service coverage. Source build/archive evidence uses the existing explicitly labeled backend preview fixture; it does not claim browser pixels, desktop interaction, live model/merchant behavior, production deployment, or full-suite completion. No new issue is claimed for existing library rename/cancel or unknown-write architecture. Raw logs remain local and are not committed.
