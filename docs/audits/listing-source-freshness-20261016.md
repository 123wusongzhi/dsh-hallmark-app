# Listing execution must refresh source facts

Scope: independent follow-on repair from `6212e20c09d304165bed36a1441bfc2788d7b62b` (malformed-freight repair), whose original integration base was `2840d5ac5c94e35eddbd78976d4f0f80012847d1`. This is a current-code finding, not historical incident replay.

## Defect

BusinessOperations requests `source.load({fresh:true})` both when submitting a row and after semantic review. HallmarkBusinessAdapter used this flag for platform reads and image checks, but read source details and normalized procurement from CollectionService without refreshing. During the collection TTL, a changed source SKU price/identity or unavailable source could therefore remain invisible to the pre-dispatch review guard.

A local adapter/engine regression proved the consequence: changing source cost during a simulated semantic review still produced a successful simulated dispatch on the baseline instead of blocking. Another regression proved that a failing current source read was never attempted, so the old procurement cost remained usable.

## Narrow repair

Pass the existing `fresh` flag to `getLegacyDetail(itemId, {refresh:fresh})`. Read the normalized product from that refreshed cache immediately afterward, without a second forced fetch. Ordinary draft/preparation reuse remains cached. Failed refreshes propagate; they never fall back to old captured costs.

No new freshness policy, currency conversion, pricing target, inventory authorization, review rule, dispatch rule, or retry rule was added. The existing outbox is unchanged.

CollectionService continues to merge same-item in-flight requests: a fresh call may join a source fetch that started earlier. It does not promise a new request starting after each fresh call. Ordinary draft reads may keep their cached facts while a refresh is pending. A failed refresh rejects for the fresh caller while leaving the existing cache usable by ordinary draft reads; a later refresh can retry. These are existing cache semantics, not new submission authorization.

## Evidence and controls

All tests are offline and use the existing sanitized recorded corpus plus named boundary mutations. Platform reads, semantic decisions, and transport receipts in the integration test are local stubs; no real merchant write or model call occurs.

Three new tests on both exact Node v22.18.0 and v24.21.0 fail against the original adapter:

1. `fresh:true` continues using 686 minor units rather than the changed 2000; after repair it refreshes exactly once and refuses a replaced SKU identity. `fresh:false` is a negative control and still uses cached facts without another fetch.
2. An unavailable source fails to reject; after repair it rejects instead of returning cached cost.
3. Actual HallmarkBusinessAdapter → BusinessOperations review → outbox path dispatches despite a review-time source change. After repair a changed source or failed refresh blocks before transport and before any execution record. Unchanged source is a compatibility control: one simulated successful dispatch and three total source reads (draft, submission, post-review).

A fourth concurrency control confirms two execution refreshes share one in-flight source fetch while an ordinary draft still sees its cached facts. Failure/recovery assertions verify that a fresh failure never returns cached cost and a later successful refresh updates it.

Focused regression command:

```
node --test --test-name-pattern='fresh execution source|fresh source failure|actual adapter refresh|concurrent execution refreshes' test/app-hallmark/listing-prepare.test.ts
```

Broader commands, with each exact runtime executable:

```
node --test test/collection/*.test.ts test/app-hallmark/listing-prepare.test.ts test/operations/*.test.ts
node --test test/operations-adapter/*.test.ts test/business-pricing/*.test.ts
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Final results on each exact runtime: 166/166 passed in the collection/listing/operations group, 124/124 passed in adapter/pricing (290 total), real-data audit PASS, and TypeScript no-emit exit 0. The original three regression tests failed 3/3 on each baseline runtime; the fourth concurrency test is a final compatibility control. Full suite, native UI, live source freshness, merchant endpoints, model flow, deployment, and historical causality remain unverified. This repair does not claim transaction isolation across concurrent source readers; it specifically ensures that the existing execution refresh request reaches the source service and honors its read/error contract.
