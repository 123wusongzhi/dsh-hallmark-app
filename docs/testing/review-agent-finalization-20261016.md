# Independent-review finalization recovery (2026-10-16)

## Scope and defect

Base: `0c2bf5384672f48b26bdb2ba28aa6740d2aa2046`.

The host review pump owns one invocation. Its finalizer aborts the pump and awaits cleanup. Previously, an admitted independent reviewer whose `run.result` never settled prevented that cleanup: `runIndependentReview` observed cancellation only *after* awaiting the result. Even a completed or failed invocation could therefore remain stuck before returning its original outcome.

The repair observes the result with the existing invocation cancellation signal. Cancellation rejects observation, keeps a handler attached to late child rejection, and enters the existing child-disposal path. Disposal is still awaited and the scoped tool guard remains installed until disposal finishes. This is not a timeout that approves or skips a required review. An active invocation still waits for reviewer findings; no finding is synthesized.

## Reproduction and boundaries

Nine new lifecycle-only cases use deferred promises and opaque identities, with zero network, provider or model calls:

- Success, failure and cancellation of the owning invocation, each followed by a late reviewer success or rejection.
- Original invocation outcome retained; no late review completion sent; exactly one child disposal and guard release.
- Subsequent independent review works normally.
- An active review remains pending; cancellation is never an approval.
- Asynchronous disposal remains awaited with the guard held throughout.

The initial eight-case test file fails 8/8 against the original production source on both exact runtimes and passes against the repair. Tests release deferred promises after baseline assertions so the baseline is a deterministic assertion failure rather than an abandoned process. Node's test runner also checks late unhandled rejections.

The ninth case reproduces cancellation after successful findings but while disposal is pending. Before the additional pump check, it attempted a late completion on both runtimes. The pump now checks cancellation again after disposal and does not enter completion transport. Cleanup is still awaited.

## Commands

Select each exact Node version locally and verify it with `node --version`:

- Node `22.18.0`
- Node `24.21.0`

For each executable, from the worktree root:

1. `--test --test-reporter=tap test/apps-host/review-agent-lifecycle.test.ts` (initial eight-case file against baseline production source; eight expected assertion failures).
2. `--test --test-reporter=tap --test-concurrency=1 test/apps-host/review-agent.test.ts test/apps-host/review-agent-lifecycle.test.ts test/plugin-apps/native-session.test.ts` (candidate; 37 cases).
3. `node_modules/typescript/bin/tsc --noEmit`.
4. `scripts/audit-real-test-data.mjs`.

The new file is classified as infrastructure: it contains only lifecycle controls, no merchant facts. Existing review tests consume the repository's recorded corpus; corpus bytes are unchanged. An initial typecheck before copying the ignored generated browser fixture reported its missing module; final typechecks use the prepared fixture and are recorded separately.

The additional disposal-race baseline command was `--test --test-reporter=tap --test-name-pattern="cancellation during successful-review disposal" test/apps-host/review-agent-lifecycle.test.ts`; it failed once on each runtime before the final pump check.

## Final author verification

Both exact runtimes passed all 37 related tests with identical case names, zero failures, zero skips and zero cancellations. Typecheck and recorded-data audit exited 0 on both runtimes. `git diff --check` passed. The final source hash equals the independently reviewed hash below. No raw logs or generated corpus data are included in the commit.

## Independent review

An independent isolated review approved source SHA-256 `907a06612bbc099d9f2cec1fb38c4cd17cbf3fe9f2bc87e75de437a88ba7c001`. Its combined scope passed 63/63 on both runtimes (these 37 related cases, 23 category cases from a separate candidate, and three independent lifecycle boundaries). That combined result is not a full-suite claim for this change. Independent checks covered cancellation before an admitted start returns, a settled child result racing cancellation, and cancellation during asynchronous disposal.

## Limitations

Focused local source tests only. No full suite, browser/native desktop acceptance, actual reviewer/model calls, live merchant/provider, generated bundle, install, push or deployment. This change covers an admitted child's stalled result. It does not claim to bound a stalled `subagents.start`, transport implementation that ignores abort, or a stalled child `dispose`; cleanup is deliberately not detached or declared finished early.
