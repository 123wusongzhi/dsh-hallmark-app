# Association loading lifecycle repair — 2026-10-16

## Scope and independently reproduced failure

Baseline: `9542fb263b66a0f8b65db5aca6c493b337e4d50b`.
Isolated branch: `fix/association-loading-20261016`.

The real `AssociationOverviewPage` was mounted with React test renderer and its actual API wrapper. An isolated deferred `fetch` intercepted every read; no merchant endpoint or mutation was used. While connection A's association read remained pending, switching to B aborted A. When B's settings returned no store, the association effect returned without starting another read, leaving A's `busy=true` behind. A's guarded `finally` correctly ignored the aborted request, so it could not clear this stale flag.

The same stale status occurred after B's settings read failed. That failure already provided an explicit retry button: it was misleading loading, not a complete recovery dead end. For the no-store case the refresh button should remain disabled because there is no store; the repair restores the configuration empty state and removes the false loading status.

## Minimal repair

Only the association data effect's no-request branch now resets its own busy flag. Existing request abortion and all aborted-signal checks remain unchanged, including `finally`. No unconditional cleanup/finally reset was added: that would let an old request falsely unlock a newer pending request. Picker behavior, business settings, board code, merchant data and publication are out of scope.

## Regression evidence

New test: `test/plugin-apps/association-loading-lifecycle.test.ts`.

Six isolated scenarios exercise:
1. Pending A → B with no store: loading ends; configuration guidance appears; refresh remains correctly disabled; late A success cannot render.
2. Pending A → failed B settings: loading ends; error/retry remain available; explicit retry reloads B settings then B associations and recovers.
3. Late A success while B associations remain pending cannot overwrite results or clear B loading.
4. Late A failure while B associations remain pending cannot overwrite errors or clear B loading.
5. Normal initial read and explicit refresh complete, with correct refresh flag and button/loading transitions.
6. Deactivation during association loading aborts A and clears its loading state; reactivation into an empty B context restores configuration guidance.

Before the repair on Node 24.21.0: 3 passed / 3 failed (empty connection, failed connection, deactivation). After the repair: 6 / 6 passed.

Both Node 24.21.0 and Node 22.18.0:
- New lifecycle tests + existing association UI + association service tests: **10 / 10 passed**.
- `tsc --noEmit`: **passed**.
- `scripts/audit-real-test-data.mjs`: **PASS**, 318 test files, no failures.
- `git diff --check`: clean.

New tests are classified as infrastructure: opaque routing IDs and empty response envelopes establish request ownership and UI lifecycle, without fabricated commodity or merchant facts. Existing recorded association tests continue to pass. Browser data was prepared in this worktree's own regular file; only dependencies were reused by symlink. No dependency install, full build, merchant write, push or release occurred.

Independent code review found no new race, old-response-isolation regression or production-scope expansion. This is real React component regression coverage, not a visual browser or live merchant acceptance claim.

Runner logs are retained separately in `/workspace/shared/association-loading-20261016/`: `baseline-node24.log`, `fixed-node24.log`, `regression-node24.log`, `regression-node22.log`, `audit-node24.log`, `audit-node22.log`, `tsc-node24.log`, and `tsc-node22.log`.
