# Source attachment refusal and explicit retry regression audit

Date: 2026-10-15. Base: `ad7595fc4c207def69e8a831e3d487080ad77f78`.

## Gap and added coverage

The actual collected-products component, its checked-in SDK, host dispatch and selection resolver, and `SelectionInputBridge` are exercised together. The local native input API refuses the first add. The test verifies:

- The first draft is released, no failed draft remains registered, and the existing input attachment is retained.
- The actual component shows failure, preserves the selected product, and re-enables its attachment button.
- Native recovery alone does not resend. The test checks the button is enabled before the next manual click.
- The explicit retry creates one live replacement attachment, with the exact current snapshot revision and independently specified complete JSON file contents.
- The success feedback replaces the failure feedback. No text-modification or automatic-submit API is used.

Two unchanged summaries from the public hash-validated corpus provide the business fields. Revision, timestamps, same session/view/build, browser transport and public native input API behavior are controlled fixture inputs. No actual provider call, browser DOM/layout, installed desktop, real upload or merchant operation is claimed. React component rendering/effects run under Node with react-test-renderer; esbuild only compiles the temporary test fixture.

This is a missing regression detector, not an observed production failure: the unmodified implementation passes.

## Mutation proof

In `component-workspace/collected-products/src/Component.tsx`, change the unique attachment cleanup from `finally{setAttaching(false);}` to `finally{}`. The mutation leaves the component stuck in its attachment-in-progress UI after a definitive native rejection.

Old neighboring command:

```sh
node --test test/plugin-client/source-component.test.ts test/plugin-client/selection.test.ts test/source-preview/selection-interaction.test.ts test/source-preview/formatter-sharing-compatibility.test.ts
```

New command:

```sh
node --test test/source-preview/selection-retry-chain.test.ts
```

Observed results:

- Old neighbors under mutation: 30/30 pass.
- New test under mutation: fails because the attachment button remains disabled after native refusal.
- Restore original implementation: new test passes, 1/1.
- Final combined neighboring plus new run: 31/31 pass.
- Real-data classification/integrity audit: PASS.
- `git diff --check`: pass.
- Independent pre-publication rerun: combined 31/31 pass (1.64 s); mutation old 30/30 pass (0.90 s), new test fails at the disabled assertion (0.65 s), restored new 1/1 pass (0.70 s).
- Independent pre-publication typecheck: `tsc --noEmit`, exit 0; data audit PASS and production files unchanged.

Old native-input tests exercise the refusal and cleanup but not the actual component's retry lock. The old interaction fixture uses a success-only replacement hook and checks one attachment; it does not assert button recovery. No production code or mutation is committed. The full repository test suite was not run for this focused audit.
