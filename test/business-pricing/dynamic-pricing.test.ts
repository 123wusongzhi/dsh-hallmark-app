import assert from 'node:assert/strict';
import test from 'node:test';
import { businessPricingDraftSchema, dynamicReferenceDraft, quotePricing } from '../../packages/business-pricing/src/index.ts';
import type { BusinessPricingConfig, BusinessPricingDraft, LogisticsPlan, QuoteInput } from '../../packages/business-pricing/src/index.ts';

const NOW = '2026-10-10T09:00:00.000Z';
function config(patch: Partial<BusinessPricingDraft> = {}): BusinessPricingConfig {
  return { ...dynamicReferenceDraft(), ...patch, schemaVersion: 1, storeId: 'bill', revision: 2, updatedAt: NOW };
}
function input(patch: Partial<QuoteInput> = {}): QuoteInput {
  return { storeId: 'bill', action: 'price', pricingMode: 'manual', purchaseMinor: 2000, weightGrams: 100, priceMinor: 13500, at: NOW, ...patch };
}
function plan(id: string, patch: Partial<LogisticsPlan> = {}): LogisticsPlan {
  return { id, name: id, enabled: true, fixedMinor: 0, logisticsMicrosPerGram: 0, commissionPpm: 0, ...patch };
}
function has(result: ReturnType<typeof quotePricing>, code: string) { return result.issues.some(issue => issue.code === code); }

test('confirmed dynamic draft records two schemes, no imported 135 cap, and no new hard margin', () => {
  const draft = dynamicReferenceDraft();
  assert.equal(draft.logisticsSelection, 'automatic');
  assert.equal(draft.defaultPlanId, null);
  assert.equal(draft.maxAutoPriceMinor, null);
  assert.equal(draft.minimumMarginPpm, null);
  assert.equal(draft.source?.kind, 'user');
  assert.deepEqual(draft.plans.map(p => [p.fixedMinor, p.logisticsMicrosPerGram, p.commissionPpm]), [[316, 39300, 200000], [1800, 39300, 200000]]);
  assert.equal(businessPricingDraftSchema.safeParse(draft).success, true);
});

test('actual and promotional prices switch at exactly 135 without trusting stale selected plan IDs', () => {
  const low = quotePricing(config(), input({ priceMinor: 13499, action: 'promotion', planId: 'dynamic-from-135' }));
  const exact = quotePricing(config(), input({ priceMinor: 13500, planId: 'dynamic-below-135' }));
  const high = quotePricing(config(), input({ priceMinor: 13501 }));
  assert.equal(low.planId, 'dynamic-below-135');
  assert.equal(low.breakdown.fixedMinor, 316);
  assert.equal(exact.planId, 'dynamic-from-135');
  assert.equal(high.planId, 'dynamic-from-135');
  assert.equal(exact.breakdown.fixedMinor, 1800);
  assert.equal(exact.breakdown.logisticsMinor, 393);
  assert.equal(exact.breakdown.commissionMinor, 2700);
  assert.equal(exact.breakdown.profitMinor, 6607);
  assert.equal(exact.selectionMode, 'automatic');
  assert.deepEqual(exact.matchedPlanIds, ['dynamic-from-135']);
  assert.equal(exact.configRevision, 2);
  assert.equal(exact.status, 'ready');
});

test('overlapping schemes use the highest total fee at current price and weight, with stable ties', () => {
  const draft = config({ plans: [plan('a', { fixedMinor: 100 }), plan('b', { commissionPpm: 200000, logisticsMicrosPerGram: 10000 })] });
  const cheapPrice = quotePricing(draft, input({ purchaseMinor: 0, priceMinor: 100, weightGrams: 1 }));
  const expensivePrice = quotePricing(draft, input({ purchaseMinor: 0, priceMinor: 1000, weightGrams: 1 }));
  const heavy = quotePricing(draft, input({ purchaseMinor: 0, priceMinor: 100, weightGrams: 100 }));
  assert.equal(cheapPrice.planId, 'a');
  assert.equal(expensivePrice.planId, 'b');
  assert.equal(heavy.planId, 'b');
  assert.deepEqual(heavy.matchedPlanIds, ['a', 'b']);
  assert.match(heavy.selectionReason!, /总|之和最高/);
  const ties = [plan('z', { fixedMinor: 50 }), plan('a', { fixedMinor: 50 })];
  for (const plans of [ties, [...ties].reverse()]) assert.equal(quotePricing(config({ plans }), input()).planId, 'a');
});

test('weight limits are inclusive, quotation expiry exclusive, and unavailable schemes are not selected', () => {
  const bounded = plan('bounded', { minWeightGrams: 100, maxWeightGrams: 200, validFrom: NOW, validUntil: '2026-10-11T09:00:00Z' });
  const model = config({ plans: [bounded, plan('disabled', { enabled: false, fixedMinor: 99999 }), plan('future', { validFrom: '2026-10-11T00:00:00Z', fixedMinor: 99999 })] });
  assert.equal(quotePricing(model, input({ weightGrams: 100 })).planId, 'bounded');
  assert.equal(quotePricing(model, input({ weightGrams: 200 })).planId, 'bounded');
  assert.ok(has(quotePricing(model, input({ weightGrams: 99 })), 'NO_MATCHING_PLAN'));
  assert.ok(has(quotePricing(model, input({ weightGrams: 201 })), 'NO_MATCHING_PLAN'));
  assert.ok(has(quotePricing(config({ plans: [bounded] }), input({ at: bounded.validUntil })), 'NO_MATCHING_PLAN'));
});

test('automatic suggestion crosses the 135 fee increase and verifies the new scheme without clipping', () => {
  const result = quotePricing(config(), input({ action: 'listing', pricingMode: 'automatic', priceMinor: undefined }));
  assert.equal(result.status, 'ready');
  assert.equal(result.suggestedPriceMinor, 20965);
  assert.equal(result.evaluatedPriceMinor, 20965);
  assert.equal(result.planId, 'dynamic-from-135');
  assert.equal(result.suggestedPlanId, result.planId);
  assert.equal(result.breakdown.marginPpm, 600000);
});

test('nonmonotonic fees can make the first feasible price exactly a cheaper later-tier boundary', () => {
  const model = config({ manualTargetMarginPpm: 500000, plans: [
    plan('before', { fixedMinor: 95, maxPriceExclusiveMinor: 100 }),
    plan('after', { fixedMinor: 10, minPriceMinor: 100 }),
  ] });
  const result = quotePricing(model, input({ purchaseMinor: 0, weightGrams: 1, priceMinor: undefined }));
  assert.equal(result.suggestedPriceMinor, 100);
  assert.equal(result.planId, 'after');
  assert.equal(result.breakdown.marginPpm, 900000);
  assert.equal(result.minimumAllowedPriceMinor, null);
});

test('overlap suggestions satisfy the worst fee and can begin immediately after an expensive overlap ends', () => {
  const model = config({ manualTargetMarginPpm: 500000, plans: [
    plan('always', { fixedMinor: 5 }),
    plan('overlap', { fixedMinor: 100, minPriceMinor: 1, maxPriceExclusiveMinor: 50 }),
  ] });
  const result = quotePricing(model, input({ purchaseMinor: 0, weightGrams: 1, priceMinor: undefined }));
  assert.equal(result.suggestedPriceMinor, 50);
  assert.equal(result.suggestedPlanId, 'always');
  const overlapping = quotePricing(config({ manualTargetMarginPpm: 400000, minPriceMinor: 3,
    plans: [plan('rounding', { commissionPpm: 400000 }), plan('other', { commissionPpm: 333333 })] }),
  input({ purchaseMinor: 0, weightGrams: 1, priceMinor: undefined }));
  assert.equal(overlapping.suggestedPriceMinor, 4);
});

test('dynamic hard margin is checked at the actual price and never becomes a global derived floor', () => {
  const model = config({ minimumMarginPpm: 600000 });
  const low = quotePricing(model, input({ priceMinor: 13000 }));
  assert.ok(has(low, 'MARGIN_BELOW_MINIMUM'));
  assert.equal(low.minimumAllowedPriceMinor, null);
  const explicit = quotePricing({ ...model, minPriceMinor: 1000 }, input({ priceMinor: 25000 }));
  assert.equal(explicit.minimumAllowedPriceMinor, 1000);
  assert.equal(explicit.status, 'ready');
});

test('a known price still has profit when no target suggestion fits; a missing price gets a precise blocker', () => {
  const model = config({ maxPriceMinor: 100, manualTargetMarginPpm: 500000, plans: [plan('only', { fixedMinor: 100 })] });
  const actual = quotePricing(model, input({ purchaseMinor: 0, priceMinor: 80 }));
  assert.equal(actual.status, 'ready');
  assert.equal(actual.breakdown.profitMinor, -20);
  assert.equal(actual.suggestedPriceMinor, null);
  assert.ok(actual.warnings.some(w => w.includes('没有达到目标')));
  const suggested = quotePricing(model, input({ purchaseMinor: 0, priceMinor: undefined }));
  assert.equal(suggested.status, 'blocked');
  assert.ok(has(suggested, 'NO_FEASIBLE_PRICE'));
});

test('impossible target schemes can be assessed at actual price and skipped while solving other intervals', () => {
  const model = config({ manualTargetMarginPpm: 600000, plans: [
    plan('impossible', { commissionPpm: 800000, maxPriceExclusiveMinor: 100 }),
    plan('possible', { fixedMinor: 10, minPriceMinor: 100 }),
  ] });
  assert.equal(businessPricingDraftSchema.safeParse(dynamicReferenceDraft()).success, true);
  const actual = quotePricing(model, input({ purchaseMinor: 0, priceMinor: 50 }));
  assert.equal(actual.status, 'ready');
  assert.equal(actual.breakdown.profitMinor, 10);
  assert.equal(actual.suggestedPriceMinor, 100);
  assert.equal(actual.suggestedPlanId, 'possible');
  assert.equal(actual.planId, 'impossible');
});

test('zero fixed fees and commission plus target of exactly 100% use the first exact-commission cent', () => {
  const result = quotePricing(config({ manualTargetMarginPpm: 600000, plans: [plan('zero', { commissionPpm: 400000 })] }),
    input({ purchaseMinor: 0, weightGrams: 1, priceMinor: undefined }));
  assert.equal(result.suggestedPriceMinor, 5);
  assert.equal(result.breakdown.marginPpm, 600000);
  assert.equal(result.status, 'ready');
});

test('manual prices outside global limits are blocked, and configured automatic caps constrain only automatic listing suggestions', () => {
  const model = config({ minPriceMinor: 1000, maxPriceMinor: 30000, maxAutoPriceMinor: 15000 });
  assert.ok(has(quotePricing(model, input({ priceMinor: 999 })), 'PRICE_BELOW_MINIMUM'));
  assert.ok(has(quotePricing(model, input({ priceMinor: 30001 })), 'PRICE_ABOVE_MAXIMUM'));
  assert.ok(has(quotePricing(model, input({ action: 'listing', pricingMode: 'automatic', priceMinor: undefined })), 'NO_FEASIBLE_PRICE'));
  assert.equal(quotePricing(model, input({ action: 'listing', priceMinor: 20965 })).status, 'ready');
});

test('gaps and missing facts remain explicit rather than picking a nearby scheme or inventing zero', () => {
  const model = config({ plans: [plan('bounded', { minPriceMinor: 100, maxPriceExclusiveMinor: 200 })] });
  for (const priceMinor of [99, 200]) assert.ok(has(quotePricing(model, input({ priceMinor })), 'NO_MATCHING_PLAN'));
  assert.equal(quotePricing(model, input({ priceMinor: 100 })).planId, 'bounded');
  for (const patch of [{ purchaseMinor: null }, { weightGrams: null }, { priceMinor: 0 }, { at: 'tomorrow' }]) {
    const result = quotePricing(model, input(patch));
    assert.equal(result.status, 'blocked');
    assert.equal(result.planId, null);
    assert.equal(result.breakdown.profitMinor, null);
  }
});

test('dynamic fields reject inverted or fractional ranges but permit overlapping ranges', () => {
  const draft = dynamicReferenceDraft();
  for (const patch of [{ minPriceMinor: 100, maxPriceExclusiveMinor: 100 }, { minPriceMinor: -1 }, { maxPriceExclusiveMinor: 0 }, { minPriceMinor: 0.1 }]) {
    assert.equal(businessPricingDraftSchema.safeParse({ ...draft, plans: [plan('invalid', patch)] }).success, false);
  }
  assert.equal(businessPricingDraftSchema.safeParse({ ...draft, plans: [plan('a'), plan('b')] }).success, true);
});

test('piecewise inverse agrees with exhaustive exact-cent evaluation across overlaps, gaps and rounding', () => {
  const M = 1_000_000n;
  const fee = (p: number, rate: number) => (BigInt(p) * BigInt(rate) + M - 1n) / M;
  for (const purchase of [0, 1, 7]) for (const target of [0, 1, 333333, 600000]) for (const firstFixed of [0, 5, 19]) {
    const plans = [plan('a', { fixedMinor: firstFixed, commissionPpm: 200000, maxPriceExclusiveMinor: 35 }),
      plan('b', { fixedMinor: 4, commissionPpm: 333333, minPriceMinor: 13, maxPriceExclusiveMinor: 75 }),
      plan('c', { fixedMinor: 9, commissionPpm: 100000, minPriceMinor: 80 })];
    let expected: number | null = null;
    for (let p = 1; p <= 200; p++) {
      const active = plans.filter(plan => p >= (plan.minPriceMinor ?? 1) && p < (plan.maxPriceExclusiveMinor ?? Infinity));
      if (active.length && active.every(plan => (BigInt(p - purchase - plan.fixedMinor) - fee(p, plan.commissionPpm)) * M >= BigInt(p) * BigInt(target))) { expected = p; break; }
    }
    const result = quotePricing(config({ manualTargetMarginPpm: target, maxPriceMinor: 200, plans }), input({ purchaseMinor: purchase, weightGrams: 1, priceMinor: undefined }));
    assert.equal(result.suggestedPriceMinor, expected, JSON.stringify({ purchase, target, firstFixed }));
    assert.equal(result.status, expected === null ? 'blocked' : 'ready');
  }
});
