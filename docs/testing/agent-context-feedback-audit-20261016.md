# Agent context feedback audit

Date: 2026-10-16 UTC. Baseline: `cc075fb`.

## Confirmed issue and minimal change

After publishing a component context, changing its local summary or selection makes the request button unavailable until the new context is published. The visible status nevertheless retained the prior “context updated” receipt, leaving the user without an explanation for the disabled request action. The reproduction changes the summary after a real local Runtime HTTP publication, and also changes it while publication is pending.

The production change shows “上下文已更改，请先更新上下文，再请求代理。” when an editable context differs from its previously published snapshot. In-flight progress, publication failure diagnostics, and locked submission receipts keep priority. No submission, retry, identity, revision, or busy-state logic changes.

## Reproduction and controls

`test/apps-components/agent-context-feedback.test.ts` renders the production React controls and calls a real loopback HTTP Runtime bridge backed by an in-memory store. The fixture uses an empty selection and local control text, with external HTTP forbidden. It creates no native dispatch, model call, merchant request, or business mutation.

On the unchanged production baseline the new regression fails because the rendered notice remains “上下文已更新（版本 1），代理尚未唤醒。” after the context changes. With the candidate it checks:

- An unpublished edit visibly explains the required action and retains the task input.
- Attempting the disabled action never requests an agent or changes the stored snapshot.
- Returning to the exact published context restores its existing ready state and feedback.
- An explicitly injected publication failure retains its diagnostic and task input; explicit recovery publishes the current context.
- Edits during a deferred publication retain progress until settlement, then correctly require another publication of the newer context.
- A locally prepared intent remains locked after further context edits, retains its original pending guidance, and cannot be submitted twice.

Related controls cover accepted versus unknown receipts, definitive no-admission retries, identity replacement, late responses, immutable context evidence, and local Host recovery. These are source-level React/service tests, not native desktop or live Agent acceptance.

## Validation

Both exact runtimes, Node 22.18.0 and Node 24.21.0, passed the corpus audit, all 22 focused tests across seven files (zero failures or skips), and TypeScript typecheck. The audit classified 331 test files: 177 required and 169 infrastructure entries, with recorded source counts 20/20/1. Raw logs remain local and are not published.

For each exact runtime, run:

```sh
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  test/apps-components/agent-actions.test.ts \
  test/apps-components/agent-context-feedback.test.ts \
  test/apps-components/agent-feedback.test.ts \
  test/apps-components/agent-feedback-boundaries.test.ts \
  test/apps-components/agent-recovery.test.ts \
  test/apps-runtime/component-context.test.ts \
  test/plugin-apps/native-session.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

This is a focused gate, not a full-repository or desktop acceptance claim.
