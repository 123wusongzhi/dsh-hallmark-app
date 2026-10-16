# Listing cost: invalid captured freight

Scope: isolated source review from `2840d5ac5c94e35eddbd78976d4f0f80012847d1`. This is a current-code boundary test, not a replay or causal diagnosis of a historical merchant incident.

## Defect and repair

`normalizePurchaseCost` previously returned the goods price whenever captured freight failed numeric validation. Thus an explicit negative, malformed, or empty freight amount became an apparently complete goods-only procurement cost and could enter automatic pricing.

The repair distinguishes absent freight from invalid captured freight and keeps existing pricing policy:

- Missing property, `undefined`, or `null`: retain the existing zero-when-not-collected behavior.
- Numeric zero or numeric string zero: valid zero freight.
- Empty/whitespace strings, negative values, nonnumeric strings, booleans, objects, arrays, or nonfinite numbers: unknown procurement cost (`null`).
- Valid nonzero same-currency freight: existing addition remains unchanged.
- Different freight/goods currencies: existing unknown-cost behavior remains unchanged; no exchange rate is invented.
- Legacy Taobao `price` with no usable goods/display-price field: retain its already-inclusive total; do not add or reinterpret freight again.

The collection mapping version advances to `collection-4`, so fresh persisted older mappings are reinterpreted from their saved source details without a network fetch. This prevents a cached goods-only amount from surviving the fix.

## Verification

Tests derive business facts from the repository's existing sanitized frozen corpus, with explicit boundary mutations. No live merchant, model, image download, or paid endpoint was called.

- Baseline with the first three new tests: 29 tests, 27 passed / 2 failed on both exact Node v22.18.0 and v24.21.0. Failures were invalid freight becoming goods-only cost and old mapping retaining it. The absent/zero/inclusive-price negative control passed.
- Final focused group: all collection tests plus listing preparation, 114 passed / 0 failed on each exact runtime.
- Real-data audit passed on each runtime.
- TypeScript no-emit checks run separately on both runtimes; completion is recorded in the accompanying delivery report.

Additional integration assertions cover exact selected SKU identity, quantity multiplication, source revision change after correction, refusal to implicitly convert USD, and actual adapter automatic pricing with and without CollectionService. Both adapter paths retain `unitPrice: null`, produce a blocked quote with no suggested price, and do not fall back to a cheaper legacy `price` field.

Commands (with each runtime's absolute Node executable):

```
node --test test/collection/*.test.ts test/app-hallmark/listing-prepare.test.ts
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
```

No stock, pricing policy, merchant write, outbox, or dispatch behavior was changed. Full suite, live platform behavior, native UI, model flow, and deployment were not tested or performed. Separate inspection of whether execution's `fresh: true` reaches source collection refresh is not part of this repair.
