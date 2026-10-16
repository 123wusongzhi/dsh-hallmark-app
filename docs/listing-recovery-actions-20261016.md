# Listing recovery actions candidate

## Reproduced issue

Both the integrated 27657ff baseline and current upstream 08a8ff5 allow whole-batch confirmation when every remaining row is an unchanged platform rejection, a rate-limited rejection before retryAt, or needs_user. The real engine correctly skips these rows, but the UI reports updated submission results after no source read or transport execution. A partial-success batch containing only completed and rejected rows has the same loop. Unknown-only batches already remain protected.

## Candidate

- Project next actions from status, issue code and retryAt without altering the engine.
- Provide separate correction, business-decision, wait-until and inspect guidance.
- Disable whole-batch submission when there are no rows eligible to enter checks.
- Preserve full-batch scope, hidden/unselected counts and confirmation revalidation. Show eligible, correction/decision, waiting, inspection/review and completed counts in confirmation; eligible is not a promise of successful dispatch.
- Clock expiry only updates eligibility. It does not send or inspect anything.
- Keep unknown/pending/dispatching editing and resend protection.
- Use neutral result-received wording, rather than claiming an update occurred.

## Validation

The independent audit fixture reproduces all four no-op cases against upstream 08a8ff5, with zero transport calls. The new production React test also fails red against that upstream UI on the first expected disabled button assertion (the helper is supplied solely so the test can load).

The candidate uses real React plus BusinessOperations and an isolated SQLite in-memory store. Recorded product/store/purchase facts come from the immutable corpus; rejected/decision/retry states, SKU aliases and clock changes are explicit test controls. Every fetch is local. Transport records calls in memory and never contacts merchants.

Node 22.18.0 and 24.21.0: 34/34 focused tests pass on each, including the new recovery actions journey, existing confirmation revalidation, structured listing editor, business operations, engine operations, draft recovery, error recovery and partial-status tests. Typecheck passes on both. Real-test-data audit passes on both: 323 tests, 171 required source-backed entries, 167 infrastructure entries (the registry also contains runner entries). git diff --check passes.

Covered cases include unchanged rejection, needs_user, future/due rate limit, missing/invalid retry time, known not-dispatched retry, stock-only PRODUCT_IS_NOT_CREATED retry, unknown lock, normal draft, mixed draft/succeeded/rejected/unknown batch, no automatic send on clock expiry, and edit/save/submit recovery. The backend's existing tests retain unchanged-row/no-resend rules.

No browser visual verification or real platform writes were performed. The independent verification recorded above was performed on a local, unpublished candidate at that time; it does not describe the later publication status. Subsequent integration is covered by the [dual-Node combination report](testing/upstream-ux-combination-dual-node-20261016.md), which records its exact tested source commit and boundaries.

## Review corrections

The first candidate had two additional review findings, now covered by regression tests:

- A 1Hz interval continued even after retry deadlines. It is replaced by one timeout for the nearest valid future waiting retry, with the browser's 2^31-1ms safe delay ceiling. Each deadline recomputes and schedules only the next future deadline. Invalid, missing, elapsed and non-retryable rows schedule nothing. Hidden/unmounted views clean up. Fake-timer assertions cover multiple deadlines, distant deadline chunking, hidden resume after expiry, unmount, and zero network requests on expiry.
- Engine execution may change row state without changing plan revision. Confirmation now compares a stable fingerprint of the displayed decision fields, including row identity/revision/status, payload/current values, pricing, issues and retryAt. Any material drift invalidates the old confirmation and asks for a fresh check; a render-time guard disables the stale button before the cancellation effect. Same-state resumes and equivalent object-key/issue order changes preserve confirmation. Clock passage alone and volatile receipt timestamps are excluded. Tests cover same-revision rejected/unknown/partial completion, changed issue text/retryAt and unchanged decisions.

Stable serialization is browser-local and does not import Node crypto. Backend execution, idempotency and rejection policy remain unchanged.

## Lazy fingerprint correction

Whole-plan decision serialization is now deferred until a confirmation exists. The current-plan memo depends on the plan identity and confirmation presence; the saved snapshot has its own memo. Formal serialization counters verify zero whole-plan fingerprints on initial read, ordinary edits/saves and unconfirmed refreshes; opening confirmation computes two, unrelated parent renders and retry-deadline updates add none, cancellation returns to lazy mode, and an opened confirmation still recomputes and invalidates on same-revision state drift. The content-lazy regression is included in the focused suite (35 tests).
