import assert from 'node:assert/strict';
import test from 'node:test';
import { BusinessPricingRepository, BusinessPricingError, legacyReferenceDraft, minimumPriceForMargin, quotePricing } from '../../packages/business-pricing/src/index.ts';
import type { BusinessPricingConfig, BusinessPricingDraft, PricingStore, QuoteInput } from '../../packages/business-pricing/src/index.ts';

const NOW = '2026-10-10T09:00:00.000Z';
function memory(): PricingStore {
  let records = new Map<string, unknown>();
  return {
    get<T>(collection: string, id: string) { return structuredClone(records.get(`${collection}/${id}`)) as T | undefined; },
    put<T>(collection: string, id: string, value: T) { records.set(`${collection}/${id}`, structuredClone(value)); return value; },
    list<T>(collection: string) { return [...records.entries()].filter(([key]) => key.startsWith(`${collection}/`)).map(([, value]) => structuredClone(value) as T); },
    transaction<T>(fn: (store: any) => T) { const snapshot = structuredClone(records); try { return fn(this); } catch (error) { records = snapshot; throw error; } },
  };
}
function repository() { return new BusinessPricingRepository(memory(), () => NOW); }
function config(patch: Partial<BusinessPricingDraft> = {}): BusinessPricingConfig {
  return { ...legacyReferenceDraft(NOW), ...patch, schemaVersion: 1, storeId: 'bill', revision: 1, updatedAt: NOW };
}
function input(patch: Partial<QuoteInput> = {}): QuoteInput {
  return { storeId: 'bill', action: 'listing', pricingMode: 'automatic', purchaseMinor: 2000, weightGrams: 100, at: NOW, ...patch };
}
function has(result: ReturnType<typeof quotePricing>, code: string) { return result.issues.some(issue => issue.code === code); }

test('legacy migration is explicit and preserves separate targets, source, fractional per-gram rate, and no global floor', () => {
  const repo = repository();
  const draft = legacyReferenceDraft(NOW);
  assert.equal(repo.read('bill'), undefined);
  assert.equal(draft.listingTargetMarginPpm, 600000);
  assert.equal(draft.manualTargetMarginPpm, 50000);
  assert.equal(draft.minimumMarginPpm, null);
  assert.equal(draft.maxAutoPriceMinor, 13500);
  assert.equal(draft.plans[0].name, '旧平台统一参考方案');
  assert.equal(draft.plans[0].logisticsMicrosPerGram, 39300);
  assert.match(draft.source!.description, /没有逐渠道报价/);
  const saved = repo.save('bill', draft, 0);
  assert.equal(saved.revision, 1);
  assert.equal(repo.list().length, 1);
});

test('settings and each historical revision survive repository reconstruction without sharing mutable references', () => {
  const store = memory();
  const repo = new BusinessPricingRepository(store, () => NOW);
  const first = repo.save('bill', legacyReferenceDraft(NOW), 0);
  const second = repo.save('bill', { ...first, minimumMarginPpm: 100000 }, 1);
  second.plans[0].fixedMinor = 99999;
  const reloaded = new BusinessPricingRepository(store);
  assert.equal(reloaded.get('bill')!.revision, 2);
  assert.equal(reloaded.get('bill')!.plans[0].fixedMinor, 316);
  assert.equal(reloaded.readVersion('bill', 1)!.minimumMarginPpm, null);
  assert.equal(reloaded.readVersion('bill', 2)!.minimumMarginPpm, 100000);
});

test('CAS prevents stale writers and rejects unspecified or fabricated revision', () => {
  const repo = repository();
  const first = repo.save('bill', legacyReferenceDraft(NOW), 0);
  assert.throws(() => repo.save('bill', first, 0), (e: unknown) => e instanceof BusinessPricingError && e.code === 'PRICING_REVISION_CONFLICT');
  assert.throws(() => repo.save('bill', first, undefined as any), (e: unknown) => e instanceof BusinessPricingError && e.code === 'EXPECTED_REVISION_REQUIRED');
  assert.equal(repo.read('bill')!.revision, 1);
  assert.equal(repo.readVersion('bill', 2), undefined);
});

test('configuration validates every money, rate, identity, time and boundary field', () => {
  const repo = repository();
  const draft = legacyReferenceDraft(NOW);
  const invalid: unknown[] = [
    { ...draft, minPriceMinor: 0 }, { ...draft, maxPriceMinor: -1 }, { ...draft, maxAutoPriceMinor: 0.1 },
    { ...draft, minimumMarginPpm: 800000 }, { ...draft, manualTargetMarginPpm: 1_000_000 },
    { ...draft, minPriceMinor: 200, maxPriceMinor: 100 }, { ...draft, currency: 'USD' },
    { ...draft, defaultPlanId: 'missing' }, { ...draft, plans: [...draft.plans, ...draft.plans] },
    { ...draft, plans: [{ ...draft.plans[0], fixedMinor: null }] },
    { ...draft, plans: [{ ...draft.plans[0], logisticsMicrosPerGram: 0.2 }] },
    { ...draft, plans: [{ ...draft.plans[0], commissionPpm: -1 }] },
    { ...draft, plans: [{ ...draft.plans[0], fixedMinor: Number.MAX_SAFE_INTEGER + 1 }] },
    { ...draft, plans: [{ ...draft.plans[0], validFrom: '2026-10-10', validUntil: NOW }] },
    { ...draft, plans: [{ ...draft.plans[0], validFrom: NOW, validUntil: NOW }] },
    { ...draft, plans: [{ ...draft.plans[0], minWeightGrams: 100, maxWeightGrams: 99 }] },
    { ...draft, plans: [{ ...draft.plans[0], unsupportedFee: 5 }] },
    { ...draft, madeUpHardFloor: 150000 },
  ];
  for (const value of invalid) assert.throws(() => repo.save('bill', value as any, 0), BusinessPricingError);
  assert.equal(repo.read('bill'), undefined);
});

test('old formula is reproduced with integer ceiling: 20 + 3.16 + 3.93 and target 60%', () => {
  const result = quotePricing(config(), input({ pricingMode: 'manual', action: 'price' }));
  assert.equal(result.status, 'ready');
  assert.equal(result.targetMarginPpm, 50000);
  assert.equal(result.suggestedPriceMinor, 3613);
  assert.deepEqual(result.breakdown, { purchaseMinor: 2000, fixedMinor: 316, logisticsMinor: 393, commissionMinor: 723,
    totalCostMinor: 3432, profitMinor: 181, marginPpm: 50096 });
  const listing = quotePricing(config(), input());
  assert.equal(listing.suggestedPriceMinor, 13545);
  assert.equal(listing.breakdown.profitMinor, 8127);
  assert.equal(listing.breakdown.marginPpm, 600000);
  assert.ok(has(listing, 'AUTO_LISTING_PRICE_LIMIT'));
});

test('fractional-cent logistics and commission round upward once per charge', () => {
  const result = quotePricing(config(), input({ purchaseMinor: 343, weightGrams: 1, priceMinor: 1001, pricingMode: 'manual' }));
  assert.equal(result.breakdown.logisticsMinor, 4);
  assert.equal(result.breakdown.commissionMinor, 201);
  assert.equal(result.breakdown.totalCostMinor, 864);
  assert.equal(result.breakdown.profitMinor, 137);
});

test('manual prices can fall below targets or show a loss when no explicit hard floor exists', () => {
  const result = quotePricing(config(), input({ purchaseMinor: 343, weightGrams: 100, priceMinor: 1000, pricingMode: 'manual' }));
  assert.equal(result.status, 'ready');
  assert.equal(result.minimumAllowedPriceMinor, null);
  assert.equal(result.minimumMarginPpm, null);
  assert.equal(result.breakdown.profitMinor, -252);
  assert.ok(result.warnings.some(w => w.includes('未达到目标')));
});

test('configured hard margin is evaluated exactly, independently of displayed ppm and desired target', () => {
  const model = config({ minimumMarginPpm: 50000 });
  const below = quotePricing(model, input({ action: 'price', pricingMode: 'manual', priceMinor: 3612 }));
  const pass = quotePricing(model, input({ action: 'price', pricingMode: 'manual', priceMinor: 3613 }));
  assert.ok(has(below, 'MARGIN_BELOW_MINIMUM'));
  assert.equal(pass.status, 'ready');
  assert.equal(pass.minimumAllowedPriceMinor, 3613);
});

test('automatic listing upper limit never clips a computed price and does not restrict manual or promotion prices', () => {
  const auto = quotePricing(config(), input());
  assert.equal(auto.suggestedPriceMinor, 13545);
  assert.ok(has(auto, 'AUTO_LISTING_PRICE_LIMIT'));
  assert.equal(quotePricing(config(), input({ pricingMode: 'manual', priceMinor: 14000 })).status, 'ready');
  assert.equal(quotePricing(config(), input({ action: 'promotion', priceMinor: 14000 })).status, 'ready');
});

test('listing keeps its own target when checking a manual price without enforcing that target or the automatic cap', () => {
  const automatic = quotePricing(config(), input());
  const manual = quotePricing(config(), input({ pricingMode: 'manual', priceMinor: 4000 }));
  assert.equal(manual.targetMarginPpm, 600000);
  assert.equal(manual.suggestedPriceMinor, automatic.suggestedPriceMinor);
  assert.equal(manual.suggestedPriceMinor, 13545);
  assert.equal(manual.evaluatedPriceMinor, 4000, 'The explicit price is evaluated rather than overwritten');
  assert.equal(manual.status, 'ready', 'A desired target is not a minimum margin or an automatic-price restriction');
  assert.ok(manual.warnings.some(message => message.includes('未达到目标')));
  const ordinary = quotePricing(config(), input({ action: 'price', pricingMode: 'manual', priceMinor: 4000 }));
  assert.equal(ordinary.targetMarginPpm, 50000);
  assert.equal(ordinary.suggestedPriceMinor, 3613);
});

test('absolute price bounds apply and a suggested price can rise above min price by one cent for rounding', () => {
  const tiny = config({ listingTargetMarginPpm: 400000, manualTargetMarginPpm: 400000, minimumMarginPpm: 400000,
    minPriceMinor: 3, maxPriceMinor: 4, plans: [{ ...config().plans[0], fixedMinor: 0, logisticsMicrosPerGram: 0, commissionPpm: 400000 }] });
  const result = quotePricing(tiny, input({ purchaseMinor: 0, weightGrams: 1 }));
  assert.equal(result.suggestedPriceMinor, 4);
  assert.equal(result.status, 'ready');
  assert.ok(has(quotePricing(tiny, input({ purchaseMinor: 0, weightGrams: 1, priceMinor: 2 })), 'PRICE_BELOW_MINIMUM'));
  assert.ok(has(quotePricing(tiny, input({ purchaseMinor: 0, weightGrams: 1, priceMinor: 5 })), 'PRICE_ABOVE_MAXIMUM'));
});

test('missing, invalid and fractional procurement facts do not become zero', () => {
  for (const value of [null, undefined, -1, 0.1, NaN, Infinity, '343', Number.MAX_SAFE_INTEGER + 1]) {
    const result = quotePricing(config(), input({ purchaseMinor: value as any }));
    assert.ok(has(result, 'PURCHASE_COST_MISSING'));
    assert.equal(result.suggestedPriceMinor, null);
  }
  for (const value of [null, undefined, 0, -1, 0.1, NaN, Infinity, '10']) {
    const result = quotePricing(config(), input({ weightGrams: value as any }));
    assert.ok(has(result, 'PACKAGE_WEIGHT_MISSING'));
  }
  const zero = quotePricing(config(), input({ purchaseMinor: 0, weightGrams: 1 }));
  assert.equal(zero.breakdown.purchaseMinor, 0);
  assert.equal(zero.status, 'ready');
});

test('provided prices require positive integer cents', () => {
  for (const value of [0, -1, 0.1, Infinity, NaN, '1000'])
    assert.ok(has(quotePricing(config(), input({ priceMinor: value as any })), 'INVALID_PRICE'));
});

test('multiple named plans persist and quotes use the selected plan without replacing the default', () => {
  const repo = repository();
  const draft = legacyReferenceDraft(NOW);
  draft.plans.push({ id: 'channel-a', name: '我的轻小件渠道', enabled: true, fixedMinor: 100,
    logisticsMicrosPerGram: 10000, commissionPpm: 100000, deliveryMethodId: 'ozon-delivery-a' });
  repo.save('bill', draft, 0);
  const result = repo.quote(input({ planId: 'channel-a' }));
  assert.equal(result.planName, '我的轻小件渠道');
  assert.equal(result.breakdown.fixedMinor, 100);
  assert.equal(result.breakdown.logisticsMinor, 100);
  assert.equal(repo.get('bill')!.defaultPlanId, 'legacy-unified-reference');
  assert.deepEqual(result, repo.quote('bill', input({ planId: 'channel-a' })));
});

test('disabled, future, expired, unselected and out-of-weight plans are explicit blockers', () => {
  const base = config();
  const plan = base.plans[0];
  assert.ok(has(quotePricing(config({ plans: [{ ...plan, enabled: false }] }), input()), 'PLAN_DISABLED'));
  assert.ok(has(quotePricing(config({ plans: [{ ...plan, validFrom: '2026-10-11T00:00:00Z' }] }), input()), 'PLAN_NOT_YET_VALID'));
  assert.ok(has(quotePricing(config({ plans: [{ ...plan, validUntil: NOW }] }), input()), 'PLAN_EXPIRED'));
  assert.ok(has(quotePricing(config({ defaultPlanId: null }), input()), 'PLAN_NOT_FOUND'));
  assert.ok(has(quotePricing(base, input({ planId: 'absent' })), 'PLAN_NOT_FOUND'));
  assert.ok(has(quotePricing(config({ plans: [{ ...plan, minWeightGrams: 101 }] }), input()), 'WEIGHT_OUTSIDE_PLAN'));
  assert.ok(has(quotePricing(config({ plans: [{ ...plan, maxWeightGrams: 99 }] }), input()), 'WEIGHT_OUTSIDE_PLAN'));
  const exact = quotePricing(config({ plans: [{ ...plan, minWeightGrams: 100, maxWeightGrams: 100 }] }), input({ pricingMode: 'manual' }));
  assert.equal(exact.status, 'ready');
});

test('missing rules, wrong store, malformed time and action are not silently accepted', () => {
  assert.ok(has(quotePricing(undefined, input()), 'CONFIG_NOT_FOUND'));
  assert.ok(has(quotePricing(config(), input({ storeId: 'another' })), 'STORE_MISMATCH'));
  assert.ok(has(quotePricing(config(), input({ at: '2026-10-10' })), 'INVALID_QUOTE_TIME'));
  assert.ok(has(quotePricing(config(), input({ action: '' })), 'ACTION_MISSING'));
  assert.ok(has(quotePricing(config(), input({ pricingMode: 'random' as any })), 'INVALID_PRICING_MODE'));
});

test('large integer multiplication stays exact and unsupported result size is blocked', () => {
  const rate = { ...config().plans[0], fixedMinor: 0, logisticsMicrosPerGram: 9007199254740991, commissionPpm: 0 };
  const result = quotePricing(config({ listingTargetMarginPpm: 0, manualTargetMarginPpm: 0, maxAutoPriceMinor: null, plans: [rate] }), input({ purchaseMinor: 0, weightGrams: 2 }));
  assert.equal(result.status, 'ready');
  assert.equal(result.breakdown.logisticsMinor, 1801439850949);
  const overflow = quotePricing(config(), input({ purchaseMinor: Number.MAX_SAFE_INTEGER, weightGrams: 1 }));
  assert.ok(has(overflow, 'MONEY_OVERFLOW'));
});

test('inverse pricing finds the first satisfying cent under exhaustive small-input comparison', () => {
  for (const fixed of [0, 1, 2, 9, 23, 99]) for (const commission of [0, 1, 200000, 333333, 600000]) {
    for (const target of [0, 1, 50000, 150000, 333333]) {
      if (commission + target >= 1000000) continue;
      for (const floor of [1, 3, 11]) {
        const actual = minimumPriceForMargin(fixed, commission, target, floor);
        let expected = floor;
        const safe = (price: number) => (BigInt(price - fixed) - (BigInt(price) * BigInt(commission) + 999999n) / 1000000n) * 1000000n >= BigInt(price) * BigInt(target);
        while (!safe(expected)) expected++;
        assert.equal(actual, expected, `${fixed}/${commission}/${target}/${floor}`);
      }
    }
  }
});

test('settings for one store never overwrite another store', () => {
  const repo = repository();
  repo.save('bill', legacyReferenceDraft(NOW), 0);
  repo.save('another', { ...legacyReferenceDraft(NOW), manualTargetMarginPpm: 100000 }, 0);
  assert.equal(repo.get('bill')!.manualTargetMarginPpm, 50000);
  assert.equal(repo.get('another')!.manualTargetMarginPpm, 100000);
  assert.equal(repo.list().length, 2);
});
