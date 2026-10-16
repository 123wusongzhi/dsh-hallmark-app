# Pricing-rule validation recovery audit — 2026-10-16

## Confirmed defect and fix

Base: `cc075fb`. Source/test fix: `cc7cf2806bd5fbd5319d3b62580f6c70ef2e5dd2`.

Through enabled production React controls, enter minimum allowed price 100 and maximum allowed price 50, then save. The real pricing repository rejects the inconsistent limits without changing its revision, but the UI previously displayed only `经营规则格式不正确`. The specific validator guidance was present only in internal details, which the HTTP failure boundary intentionally does not expose. Clearing a required fixed fee had the same recovery problem.

Validation failures now carry a localized field label, the applicable logistics-plan ordinal, and actionable guidance in the public error message. Numeric limits use the UI's units. The inconsistent-price example now reads:

> 经营规则未保存，请修正：最高允许售价（元）：最高售价不能低于最低售价。

Raw schema details remain internal. Arbitrary names, unknown field keys and values are not echoed in the public validation message. This change does not alter pricing calculation, validation acceptance, persistence, submission, or permission behavior.

## Evidence and recovery controls

- Production `BusinessSettings` React component, `BusinessSettingsService`, `BusinessPricingRepository`, SQLite `RuntimeStore`, and server error classification, with recorded store/pricing inputs and explicit invalid-value derivatives.
- The UI fixture checks that controls and ancestor fieldsets are enabled before interaction. Every transport call is local. The gateway rejects any merchant-network attempt; count remains zero.
- Invalid limits and blank required fixed fee preserve entered values and leave repository revision unchanged.
- Cancelling discard preserves the rejected draft and makes no additional write.
- Correcting each invalid value saves once: two rejected requests, two successful requests, final revision 3 from initial revision 1.
- Actual HTTP/Host regression confirms the field guidance survives the existing production error envelope and failed validation does not mutate the saved rule.
- Unit controls cover price bounds, percentage limits, required fee, empty plan name, plan-specific price bounds, and non-echo of HTML-like names/unknown fields.
- Existing manual-price journey and settings suites cover save/submit separation, errors, cancellation, receipt recovery, draft retention, stale confirmations and external-store behavior. No additional defect is claimed for those covered flows.

## Verification

Exact runtimes: Node **22.18.0** and **24.21.0**.

- Historical baseline replay: the same actionable-guidance regression fails on both runtimes against `cc075fb` because `/最高允许售价/` does not match `经营规则格式不正确`.
- Final focused suites: **72 passed, 0 failed** on each runtime.
- Typecheck and real-data audit: passed on both runtimes (331 test files, 178 required-data files; no data-audit failures).
- `git diff --check`: passed.

Focused command (run under each exact runtime):

```sh
node --test --test-concurrency=1 \
  test/plugin-apps/pricing-validation-recovery.test.ts \
  test/plugin-apps/business-price-journey.test.ts \
  test/plugin-apps/business-settings.test.ts \
  test/business-pricing/*.test.ts \
  test/apps-runtime/business-settings-http.test.ts
```

Historical regression:

```sh
DSH_PRICING_VALIDATION_BASELINE=1 node --test test/plugin-apps/pricing-validation-recovery.test.ts
```

The historical switch replaces only the pricing implementation; assertions are unchanged. Raw runtime logs are local-only and excluded from publication. No browser visual/layout pass, full repository suite, native host session, merchant calls, push, or deployment is claimed.
