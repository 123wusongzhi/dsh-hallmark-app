# Data/navigation independent review — 2026-10-16

Reviewed baseline `fd95bc22929bfbfa850e0312357322578287a10c` plus navigation `14e528bd574c02171a9e2dc5dd4263416f63c43e` and information selection `cd22c82be8ff6c977280871be38816e8bdf2a902` together in an isolated worktree. No publication, merchant writes, dependency installation, or browser acceptance was performed.

## Reproduced and repaired

- Pending information choices survived store changes because their identity omitted store/session. The independent real `MaterialLibrary` test observed `['field0','field1']` after changing stores instead of `['field0']`. Draft identity now includes both owners and obsolete drafts are cleared, including when returning to a previous owner.
- A hidden material editor still loaded its directory and initial instance on changed props. The before-fix probe observed read count `10` instead of `9`. Directory/store effects now pause and abort on hide, resume interrupted loads, and reuse successfully loaded keys. Automatic procurement initialization also pauses and can retry an interrupted initialization; completed/failed attempts retain their existing deduplication behavior.
- Information helper text now distinguishes cancellation/return/closing the information panel from switching outer tabs. Same-owner outer navigation retains the draft; closing the material tab unmounts it and discards unsaved configuration.

## Independent executable coverage

`test/plugin-apps/information-owner-review.test.ts` mounts production React components, without substituting their implementations. Only the transport is controlled, and all transport writes are forbidden.

- Store/session draft invalidation, no resurrection, same-owner navigation retention.
- Batched 35 toggle events cannot exceed 30 selected fields; cancellation restores applied configuration.
- Unmount aborts a deferred preview; its late response cannot restore a closed editor. Reopening starts from saved configuration.
- Hidden initial-instance changes produce neither directory nor instance reads; activation completes the suspended load.
- Hidden production board owner/revision changes produce no reads or refresh timers; old requests abort; late success cannot replace a new owner's permission error.

Existing production-component tests additionally cover composed preview batching, minimum one field, net-zero/cancel/back/panel-close reads, partial-source warnings, local search/page retention, and the three-instance LRU.

## Limits and state cost

The new data-instance pool holds at most three panes in the current workspace, not three per historical store/app. App, chat and store scope changes replace old mounts. Existing native component views have a separate pool of up to three, so this is **not** a claim that every page type combined has a global three-pane bound. Native-view policy was left unchanged.

This is executable component/lifecycle validation with mocked transport, not browser layout or real-platform end-to-end acceptance.

## Verification

Node v24.19.0:

- 30/30 tests passed: `node --test --test-concurrency=1 test/plugin-apps/*workbench*.test.ts test/plugin-apps/*workspace*.test.ts test/plugin-apps/cross-source-material-ui.test.ts test/plugin-apps/information-owner-review.test.ts test/plugin-apps/procurement-plan.test.ts test/plugin-apps/procurement-paging.test.ts`.
- `tsc --noEmit` passed after generating the ignored private browser fixture.
- Formal `node scripts/audit-real-test-data.mjs`: PASS, 310 discovered test files, 163 required files, 162 infrastructure files, zero failures. Navigation tests use recorded uiProduct/uiStore fixtures and explicit variations; the new lifecycle-only test uses schema/owner marker controls, not fabricated commercial facts.
- The prior handoff test loaded a hidden material editor to suppress previews. Its setup now loads visibly without a chat, then hides before exercising handoff; its connection-selection, prepare-before-insert and failure assertions remain intact.
