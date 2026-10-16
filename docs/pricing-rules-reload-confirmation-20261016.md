# Pricing-rule reload confirmation

Base: `c047ad823513cce56194d5a48fee60e46f2340a1`.

## Reproduction and change

The real React BusinessSettings component, with isolated settings responses, discarded dirty pricing edits when the header reload action was clicked. The baseline regression failed both the confirmation case and the failed-save-then-cancel case (6 passed, 2 failed).

The header now opens a nonblocking inline choice: 保留修改 / 放弃并重新读取. It does not invoke a native/global dialog. Cancel retains inputs and dirty locks, with no query or write. Confirm follows the existing reload path. Clean reload remains one click. No automatic saving or permanently disabled discard action was introduced.

## Checks

- Node 24.21 and 22.18: 13/13 focused tests pass (business settings UI, packaging UI compatibility, settings HTTP contract).
- Both versions: TypeScript noEmit and real-test-data classification audit pass (320 files).
- Independent review of the initial guard found no blocking findings. The inline follow-up review also found no blockers and independently ran all 10 React cases successfully. A captured discard handler after a failed save was then added to cover its optional suggestion.
- Added React scenarios cover repeated cancel, confirmed discard, clean reload, failed pricing-save retention and retry, edits made while a discarded reload is pending, a new store selected before an old response arrives, stale confirmation callbacks after further edits or context changes, and older reads arriving after newer refresh/session reads.
- `git diff --check` passes.

Raw red/green and two-version logs: `/workspace/shared/pricing-reload-20261016/` (local evidence, not published).

## Boundaries

Only the pricing-rule reload guard and its test harness change. Packaging editing is unchanged and only regression checked. New tests never enter credential fields and allow only isolated in-process requests; no real merchant writes, credential transmission, package installation, full application build, or publication occurred. The existing contract suite uses its own local fixture service. Existing paired private data was prepared only in this checkout; original corpus bytes were not edited.

Confirmation is exercised through actual inline React buttons; a global confirm stub throws if accidentally called. New edits, saves, session/store changes and leaving the panel invalidate previous confirmation tokens. Adding sessionId to the read effect cancels old-identity reads. No visual desktop/browser validation was performed. This does not add navigation-wide draft persistence or protect unrelated shop-connection edits.

## Inline follow-up evidence

The native-confirm version fails the new inline-button regression. Local evidence uses the `inline-` log prefix. Both Node versions pass the three-file focused suite (13 tests), type checking and audit. No full-repository run was started; cumulative integration is owned by the parent task.
