# Packaging maintenance input and recovery audit

## Scope and result

Baseline: `0747ab5117c8d5786e591be52c390aa8711e3271`, tree `cd90096db0e82cf056a39ca0debdd678473c25df`.

This audit adds one integrated regression, not a production fix or a new confirmed UX issue. It does not recount the existing packaging source-priority/locked-unit work or saved-receipt recovery fixes.

The regression mounts production React `BusinessSettings`, checks that every exercised control and its ancestors are enabled, and routes its actual request bodies through production `BusinessSettingsService`, `BusinessPackagingRepository`, and an isolated SQLite store. Product and package facts come from the frozen corpus; product/SKU identifiers are local aliases. The connection is enabled. No merchant request is permitted.

Verified in that controlled React event harness:

- Zero, negative and non-finite numeric values do not dispatch saves, and the editable value and saved revision remain intact.
- Partial dimensions show the completeness error without dispatching a save. Completing the dimensions saves the exact centimeter values and kilogram weight.
- The existing service maximum is unchanged. Its exact boundary is accepted by the schema; the next larger value is rejected through the UI/service path without changing saved data. Correcting the draft permits a subsequent save.
- Explicitly clearing the weight sends the established clear semantics: persisted weight override is absent, dimensions remain maintained, and automatic weight becomes visible again.
- Restore Automatic clears both override groups, preserving existing behavior. A later discarded draft performs no save.
- The final local revision is 5, with zero merchant calls.

The first isolated test run failed because its oracle expected stored null properties after clearing. The repository intentionally canonicalizes these to absent properties. The test oracle was corrected; no production behavior was changed, and this failure is not evidence of a product defect.

## Unverified browser-specific risk

Source inspection found that numeric inputs forward only `event.target.value`, and Save is an onClick button outside a form. A browser-invalid numeric edit can expose an empty value together with `validity.badInput`; loss of that distinction may be significant because empty fields intentionally clear overrides. This audit does not establish the actual browser event sequence or report a confirmed destructive edit.

An ordinary Chromium launch with an isolated temporary profile failed at process-singleton socket creation with `Operation not permitted`. The attempt stopped without disabling sandbox/security protections. Therefore native typing, number-input validity, visual layout, and browser-level reproduction remain unverified. Synthetic numeric events in the regression are not presented as browser typing evidence.

## Verification

Commands use the recovered Node 22.18.0 and 24.21.0 runtimes. Raw output remains local.

Related suite:

```
node --test --test-concurrency=1 test/plugin-apps/packaging-input-recovery.test.ts test/plugin-apps/packaging-settings.test.ts test/service/packaging-settings.test.ts test/business-packaging/packaging.test.ts test/apps-runtime/business-settings-http.test.ts
```

Both Node 22.18.0 and Node 24.21.0 passed 37/37 related tests, TypeScript checks, and the real-data audit. The initial Node 22 typecheck lacked the worktree-local generated browser data; the documented preparation command rebuilt it and the retry passed. The initial data audit flagged the unregistered new test, so its corpus-backed classification was added before retry.

No full-suite, native-host, live merchant, installation, push, or deployment claim is made.
