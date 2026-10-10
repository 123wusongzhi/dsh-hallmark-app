import { z } from 'zod';
import type { BusinessPriceQuote, BusinessPricingConfig, BusinessPricingDraft, LogisticsPlan, PricingStore, QuoteInput } from './types.ts';
export type * from './types.ts';

const MILLION = 1_000_000n;
const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = nonnegative.min(1);
const ppm = nonnegative.max(999_999);
const id = z.string().trim().min(1).max(200);
const timestamp = z.iso.datetime({ offset: true });

export const logisticsPlanSchema = z.object({
  id, name: z.string().trim().min(1).max(200), enabled: z.boolean(),
  fixedMinor: nonnegative, logisticsMicrosPerGram: nonnegative, commissionPpm: ppm,
  deliveryMethodId: id.optional(), validFrom: timestamp.optional(), validUntil: timestamp.optional(),
  minWeightGrams: positive.optional(), maxWeightGrams: positive.optional(),
  minPriceMinor: nonnegative.optional(), maxPriceExclusiveMinor: positive.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.validFrom && v.validUntil && Date.parse(v.validFrom) >= Date.parse(v.validUntil))
    ctx.addIssue({ code: 'custom', path: ['validUntil'], message: '结束时间必须晚于开始时间' });
  if (v.minWeightGrams !== undefined && v.maxWeightGrams !== undefined && v.minWeightGrams > v.maxWeightGrams)
    ctx.addIssue({ code: 'custom', path: ['maxWeightGrams'], message: '最大重量不能小于最小重量' });
  if (v.minPriceMinor !== undefined && v.maxPriceExclusiveMinor !== undefined && v.minPriceMinor >= v.maxPriceExclusiveMinor)
    ctx.addIssue({ code: 'custom', path: ['maxPriceExclusiveMinor'], message: '售价上界（不含）必须大于售价下界（含）' });
});

export const businessPricingDraftSchema = z.object({
  currency: z.literal('CNY'), defaultPlanId: id.nullable(), plans: z.array(logisticsPlanSchema).max(200),
  logisticsSelection: z.enum(['automatic', 'fixed']).optional(),
  listingTargetMarginPpm: ppm, manualTargetMarginPpm: ppm, minimumMarginPpm: ppm.nullable(),
  maxAutoPriceMinor: positive.nullable(), minPriceMinor: positive.nullable(), maxPriceMinor: positive.nullable(),
  source: z.object({
    kind: z.enum(['legacy-platform', 'user']), description: z.string().trim().min(1).max(2000),
    importedAt: timestamp.optional(), sourceVersion: z.string().trim().min(1).max(200).optional(),
  }).strict().optional(),
}).strict().superRefine((v, ctx) => {
  const ids = new Set<string>();
  for (const [i, plan] of v.plans.entries()) {
    if (ids.has(plan.id)) ctx.addIssue({ code: 'custom', path: ['plans', i, 'id'], message: '物流方案 ID 不能重复' });
    ids.add(plan.id);
    for (const field of ['listingTargetMarginPpm', 'manualTargetMarginPpm', 'minimumMarginPpm'] as const) {
      const margin = v[field];
      if (v.logisticsSelection !== 'automatic' && margin !== null && margin + plan.commissionPpm >= 1_000_000)
        ctx.addIssue({ code: 'custom', path: [field], message: `利润率加方案「${plan.name}」佣金率必须低于 100%` });
    }
  }
  if (v.defaultPlanId !== null && !ids.has(v.defaultPlanId))
    ctx.addIssue({ code: 'custom', path: ['defaultPlanId'], message: '默认方案必须存在' });
  if (v.minPriceMinor !== null && v.maxPriceMinor !== null && v.minPriceMinor > v.maxPriceMinor)
    ctx.addIssue({ code: 'custom', path: ['maxPriceMinor'], message: '最高售价不能低于最低售价' });
});

export const businessPricingConfigSchema = businessPricingDraftSchema.safeExtend({
  schemaVersion: z.literal(1), storeId: id, revision: positive, updatedAt: timestamp,
});

export class BusinessPricingError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message); this.name = 'BusinessPricingError'; this.code = code; this.details = details;
  }
}

function asDraft(raw: unknown): BusinessPricingDraft {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // The fixed settings UI may send the complete record it previously read.
    const { schemaVersion: _s, storeId: _i, revision: _r, updatedAt: _t, ...draft } = raw as Record<string, unknown>;
    const parsed = businessPricingDraftSchema.safeParse(draft);
    if (parsed.success) return parsed.data;
    throw new BusinessPricingError('INVALID_PRICING_CONFIG', '经营规则格式不正确', parsed.error.issues);
  }
  throw new BusinessPricingError('INVALID_PRICING_CONFIG', '经营规则必须是对象');
}

function safeNumber(value: bigint): number {
  if (value > SAFE || value < -SAFE) throw new BusinessPricingError('MONEY_OVERFLOW', '费用或售价超过支持的整数金额范围');
  return Number(value);
}
const ceil = (numerator: bigint, denominator: bigint) => (numerator + denominator - 1n) / denominator;
const commission = (price: bigint, rate: number) => ceil(price * BigInt(rate), MILLION);
const meetsMargin = (price: bigint, fixed: bigint, rate: number, margin: number) =>
  (price - fixed - commission(price, rate)) * MILLION >= price * BigInt(margin);

/** Finds the first representable cent that meets the exact margin after commission rounds up. */
export function minimumPriceForMargin(fixedMinor: number, commissionPpm: number, marginPpm: number, priceFloorMinor = 1): number {
  nonnegative.parse(fixedMinor); ppm.parse(commissionPpm); ppm.parse(marginPpm);
  positive.parse(priceFloorMinor);
  const divisor = MILLION - BigInt(commissionPpm) - BigInt(marginPpm);
  if (divisor <= 0n) throw new BusinessPricingError('IMPOSSIBLE_MARGIN', '佣金与目标利润率之和必须低于 100%');
  const fixed = BigInt(fixedMinor);
  let price = ceil(fixed * MILLION, divisor);
  if (price < BigInt(priceFloorMinor)) price = BigInt(priceFloorMinor);
  // Any rounding deficit is less than one cent; at most one million candidates are needed.
  while (!meetsMargin(price, fixed, commissionPpm, marginPpm)) price += 1n;
  return safeNumber(price);
}

function validInteger(value: unknown, allowZero: boolean): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1);
}

function quoteFixedPricing(config: BusinessPricingConfig | undefined, input: QuoteInput): BusinessPriceQuote {
  const result: BusinessPriceQuote = {
    status: 'blocked', storeId: input.storeId, configRevision: config?.revision ?? null,
    planId: input.planId ?? config?.defaultPlanId ?? null, planName: null, currency: 'CNY',
    selectionMode: 'fixed', selectionReason: '按已保存的固定方案计算',
    targetMarginPpm: null, minimumMarginPpm: config?.minimumMarginPpm ?? null,
    suggestedPriceMinor: null, minimumAllowedPriceMinor: config?.minPriceMinor ?? null, evaluatedPriceMinor: null,
    breakdown: { purchaseMinor: null, fixedMinor: null, logisticsMinor: null, commissionMinor: null, totalCostMinor: null, profitMinor: null, marginPpm: null },
    issues: [], warnings: ['按已配置采购、固定费、物流费和佣金计算参考利润；未配置费用不代表实际结算为零。'],
  };
  const issue = (code: string, field: string, message: string) => { result.issues.push({ code, field, message }); };
  if (!config) { issue('CONFIG_NOT_FOUND', 'storeId', '该店铺尚未保存经营规则'); return result; }
  const validated = businessPricingConfigSchema.safeParse(config);
  if (!validated.success) { issue('INVALID_PRICING_CONFIG', 'config', '已保存的经营规则格式不正确'); return result; }
  if (input.storeId !== config.storeId) { issue('STORE_MISMATCH', 'storeId', '规则与目标店铺不一致'); return result; }
  if (!['automatic', 'manual'].includes(input.pricingMode)) issue('INVALID_PRICING_MODE', 'pricingMode', '请选择自动或手动定价');
  if (typeof input.action !== 'string' || !input.action.trim()) issue('ACTION_MISSING', 'action', '需要明确本次定价动作');
  const listing = input.action === 'listing' || input.action === 'listing_import' || (typeof input.action === 'string' && input.action.startsWith('listing.'));
  result.targetMarginPpm = listing ? config.listingTargetMarginPpm : config.manualTargetMarginPpm;
  const plan = config.plans.find(p => p.id === result.planId);
  if (!plan) { issue('PLAN_NOT_FOUND', 'planId', '请选择一个已保存的物流方案'); return result; }
  result.planName = plan.name;
  result.breakdown.fixedMinor = plan.fixedMinor;
  if (!plan.enabled) issue('PLAN_DISABLED', 'planId', '所选物流方案已停用');
  const at = input.at ?? new Date().toISOString();
  if (!timestamp.safeParse(at).success) issue('INVALID_QUOTE_TIME', 'at', '试算时间必须包含有效日期、时间和时区');
  else {
    if (plan.validFrom && Date.parse(at) < Date.parse(plan.validFrom)) issue('PLAN_NOT_YET_VALID', 'planId', '所选物流方案尚未生效');
    if (plan.validUntil && Date.parse(at) >= Date.parse(plan.validUntil)) issue('PLAN_EXPIRED', 'planId', '所选物流方案报价已过期');
  }
  if (!validInteger(input.purchaseMinor, true)) issue('PURCHASE_COST_MISSING', 'purchaseMinor', '采购成本必须是已确定的非负整数分，缺失时不能按零计算');
  else result.breakdown.purchaseMinor = input.purchaseMinor;
  if (!validInteger(input.weightGrams, false)) issue('PACKAGE_WEIGHT_MISSING', 'weightGrams', '请提供已确定的正整数包装克重');
  else if ((plan.minWeightGrams !== undefined && input.weightGrams < plan.minWeightGrams)
    || (plan.maxWeightGrams !== undefined && input.weightGrams > plan.maxWeightGrams))
    issue('WEIGHT_OUTSIDE_PLAN', 'weightGrams', '包装重量不在所选物流方案适用范围内');
  const providedPrice = input.priceMinor !== undefined && input.priceMinor !== null;
  if (providedPrice && !validInteger(input.priceMinor, false)) issue('INVALID_PRICE', 'priceMinor', '售价必须是正整数分');
  if (!validInteger(input.purchaseMinor, true) || !validInteger(input.weightGrams, false) || (providedPrice && !validInteger(input.priceMinor, false))) return result;
  try {
    const logistics = ceil(BigInt(input.weightGrams) * BigInt(plan.logisticsMicrosPerGram), 10_000n);
    const fixed = BigInt(input.purchaseMinor) + BigInt(plan.fixedMinor) + logistics;
    result.breakdown.logisticsMinor = safeNumber(logistics);
    const base = safeNumber(fixed);
    result.suggestedPriceMinor = minimumPriceForMargin(base, plan.commissionPpm,
      Math.max(result.targetMarginPpm, config.minimumMarginPpm ?? 0), config.minPriceMinor ?? 1);
    if (config.minimumMarginPpm !== null) {
      const marginFloor = minimumPriceForMargin(base, plan.commissionPpm, config.minimumMarginPpm, config.minPriceMinor ?? 1);
      result.minimumAllowedPriceMinor = Math.max(result.minimumAllowedPriceMinor ?? 1, marginFloor);
    }
    const priceMinor = providedPrice ? input.priceMinor! : result.suggestedPriceMinor;
    const price = BigInt(priceMinor);
    const fee = commission(price, plan.commissionPpm);
    const total = fixed + fee;
    const profit = price - total;
    result.evaluatedPriceMinor = priceMinor;
    result.breakdown.commissionMinor = safeNumber(fee);
    result.breakdown.totalCostMinor = safeNumber(total);
    result.breakdown.profitMinor = safeNumber(profit);
    const scaled = profit * MILLION;
    result.breakdown.marginPpm = safeNumber(scaled >= 0n ? scaled / price : -ceil(-scaled, price));
    if (config.minimumMarginPpm !== null && !meetsMargin(price, fixed, plan.commissionPpm, config.minimumMarginPpm))
      issue('MARGIN_BELOW_MINIMUM', 'priceMinor', '售价低于已设置的最低利润要求');
    if (config.minPriceMinor !== null && priceMinor < config.minPriceMinor)
      issue('PRICE_BELOW_MINIMUM', 'priceMinor', '售价低于已设置的最低售价');
    if (config.maxPriceMinor !== null && priceMinor > config.maxPriceMinor)
      issue('PRICE_ABOVE_MAXIMUM', 'priceMinor', '售价高于已设置的最高售价');
    if (listing && input.pricingMode === 'automatic' && config.maxAutoPriceMinor !== null
      && Math.max(result.suggestedPriceMinor, priceMinor) > config.maxAutoPriceMinor)
      issue('AUTO_LISTING_PRICE_LIMIT', 'priceMinor', '自动上品建议价超过已设置上限，请调整方案或明确指定售价；程序不会截低售价');
    if (!meetsMargin(price, fixed, plan.commissionPpm, result.targetMarginPpm))
      result.warnings.push('当前售价未达到目标利润率；目标用于建议价，只有另行设置的最低利润会阻止提交。');
  } catch (error) {
    issue(error instanceof BusinessPricingError ? error.code : 'PRICING_CALCULATION_FAILED', 'priceMinor', error instanceof Error ? error.message : '定价计算失败');
  }
  result.status = result.issues.length ? 'blocked' : 'ready';
  return result;
}

interface PlanCost { plan: LogisticsPlan; logistics: bigint; base: bigint }

function priceMatches(plan: LogisticsPlan, price: bigint): boolean {
  return price >= BigInt(plan.minPriceMinor ?? 1)
    && price < (plan.maxPriceExclusiveMinor === undefined ? SAFE + 1n : BigInt(plan.maxPriceExclusiveMinor));
}

function mostExpensive(costs: PlanCost[], price: bigint): PlanCost | undefined {
  // Purchase cost is identical across plans, so comparing base + commission also compares scheme fees.
  return costs.slice().sort((a, b) => {
    const aCost = a.base + commission(price, a.plan.commissionPpm);
    const bCost = b.base + commission(price, b.plan.commissionPpm);
    return aCost === bCost ? (a.plan.id < b.plan.id ? -1 : a.plan.id > b.plan.id ? 1 : 0) : aCost > bCost ? -1 : 1;
  })[0];
}

const gcd = (a: bigint, b: bigint): bigint => b === 0n ? a : gcd(b, a % b);

/** The active plans are constant within this interval. All must meet the margin because fees use their maximum. */
function minimumCommonPrice(costs: PlanCost[], margin: number, lower: bigint, upperExclusive: bigint): bigint | null {
  let candidate = lower;
  let step = 1n;
  for (const { plan, base } of costs) {
    const divisor = MILLION - BigInt(plan.commissionPpm) - BigInt(margin);
    if (divisor < 0n || (divisor === 0n && base > 0n)) return null;
    if (divisor === 0n) {
      // With zero fixed costs and zero net slope, only prices without fractional commission can satisfy the target.
      const period = MILLION / gcd(MILLION, BigInt(plan.commissionPpm));
      step = step / gcd(step, period) * period;
    } else {
      const continuousFloor = ceil(base * MILLION, divisor);
      if (continuousFloor > candidate) candidate = continuousFloor;
    }
  }
  candidate = ceil(candidate, step) * step;
  // The continuous lower bound misses less than one cent of rounding per plan. Increasing cents here
  // terminates within one million candidates; it never reselects plans or loops between price tiers.
  while (candidate < upperExclusive) {
    if (costs.every(({ plan, base }) => meetsMargin(candidate, base, plan.commissionPpm, margin))) return candidate;
    candidate += step;
  }
  return null;
}

function automaticSuggestion(costs: PlanCost[], config: BusinessPricingConfig, margin: number, automaticListing: boolean): { price: number; selected: PlanCost } | null {
  const lower = BigInt(config.minPriceMinor ?? 1);
  const caps = [config.maxPriceMinor, automaticListing ? config.maxAutoPriceMinor : null].filter((value): value is number => value !== null);
  const upper = caps.length ? BigInt(Math.min(...caps)) + 1n : SAFE + 1n;
  if (lower >= upper) return null;
  const boundaries = new Set<bigint>([lower, upper]);
  for (const { plan } of costs) for (const value of [plan.minPriceMinor, plan.maxPriceExclusiveMinor]) {
    if (value !== undefined && BigInt(value) > lower && BigInt(value) < upper) boundaries.add(BigInt(value));
  }
  const ordered = [...boundaries].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (let i = 0; i + 1 < ordered.length; i++) {
    const matching = costs.filter(({ plan }) => priceMatches(plan, ordered[i]));
    if (!matching.length) continue;
    const price = minimumCommonPrice(matching, margin, ordered[i], ordered[i + 1]);
    if (price !== null) return { price: safeNumber(price), selected: mostExpensive(matching, price)! };
  }
  return null;
}

function quoteAutomaticPricing(config: BusinessPricingConfig, input: QuoteInput): BusinessPriceQuote {
  const result: BusinessPriceQuote = {
    status: 'blocked', storeId: input.storeId, configRevision: config.revision,
    planId: null, planName: null, currency: 'CNY', selectionMode: 'automatic', matchedPlanIds: [],
    selectionReason: '按售价、重量和报价有效期匹配；重合时按总方案费用最高者计算',
    suggestedPlanId: null, suggestedPlanName: null,
    targetMarginPpm: null, minimumMarginPpm: config.minimumMarginPpm,
    suggestedPriceMinor: null, minimumAllowedPriceMinor: config.minPriceMinor, evaluatedPriceMinor: null,
    breakdown: { purchaseMinor: null, fixedMinor: null, logisticsMinor: null, commissionMinor: null, totalCostMinor: null, profitMinor: null, marginPpm: null },
    issues: [], warnings: ['按已配置采购、固定费、物流费和佣金计算参考利润；未配置费用不代表实际结算为零。'],
  };
  const issue = (code: string, field: string, message: string) => { result.issues.push({ code, field, message }); };
  if (!businessPricingConfigSchema.safeParse(config).success) { issue('INVALID_PRICING_CONFIG', 'config', '已保存的经营规则格式不正确'); return result; }
  if (input.storeId !== config.storeId) { issue('STORE_MISMATCH', 'storeId', '规则与目标店铺不一致'); return result; }
  if (!['automatic', 'manual'].includes(input.pricingMode)) issue('INVALID_PRICING_MODE', 'pricingMode', '请选择自动或手动定价');
  if (typeof input.action !== 'string' || !input.action.trim()) issue('ACTION_MISSING', 'action', '需要明确本次定价动作');
  const listing = input.action === 'listing' || input.action === 'listing_import' || (typeof input.action === 'string' && input.action.startsWith('listing.'));
  result.targetMarginPpm = listing ? config.listingTargetMarginPpm : config.manualTargetMarginPpm;
  const at = input.at ?? new Date().toISOString();
  const validTime = timestamp.safeParse(at).success;
  if (!validTime) issue('INVALID_QUOTE_TIME', 'at', '试算时间必须包含有效日期、时间和时区');
  if (!validInteger(input.purchaseMinor, true)) issue('PURCHASE_COST_MISSING', 'purchaseMinor', '采购成本必须是已确定的非负整数分，缺失时不能按零计算');
  else result.breakdown.purchaseMinor = input.purchaseMinor;
  if (!validInteger(input.weightGrams, false)) issue('PACKAGE_WEIGHT_MISSING', 'weightGrams', '请提供已确定的正整数包装克重');
  const providedPrice = input.priceMinor !== undefined && input.priceMinor !== null;
  if (providedPrice && !validInteger(input.priceMinor, false)) issue('INVALID_PRICE', 'priceMinor', '售价必须是正整数分');
  if (!validTime || !validInteger(input.purchaseMinor, true) || !validInteger(input.weightGrams, false)
    || (providedPrice && !validInteger(input.priceMinor, false))) return result;
  try {
    const now = Date.parse(at);
    const weight = input.weightGrams;
    const eligible = config.plans.filter(plan => plan.enabled
      && (!plan.validFrom || now >= Date.parse(plan.validFrom)) && (!plan.validUntil || now < Date.parse(plan.validUntil))
      && (plan.minWeightGrams === undefined || weight >= plan.minWeightGrams)
      && (plan.maxWeightGrams === undefined || weight <= plan.maxWeightGrams));
    const costs: PlanCost[] = eligible.map(plan => {
      const logistics = ceil(BigInt(weight) * BigInt(plan.logisticsMicrosPerGram), 10_000n);
      return { plan, logistics, base: BigInt(input.purchaseMinor!) + BigInt(plan.fixedMinor) + logistics };
    });
    const suggestion = automaticSuggestion(costs, config, Math.max(result.targetMarginPpm, config.minimumMarginPpm ?? 0), listing && input.pricingMode === 'automatic');
    if (suggestion) {
      result.suggestedPriceMinor = suggestion.price;
      result.suggestedPlanId = suggestion.selected.plan.id;
      result.suggestedPlanName = suggestion.selected.plan.name;
    } else if (providedPrice) {
      result.warnings.push('当前规则适用区间内没有达到目标利润的建议价；实际售价利润仍按命中的方案计算。');
    } else {
      issue('NO_FEASIBLE_PRICE', 'priceMinor', '当前物流适用区间及售价上限内，没有满足目标和最低利润的建议价');
    }
    const priceMinor = providedPrice ? input.priceMinor! : suggestion?.price;
    if (priceMinor === undefined) {
      if (!costs.length) issue('NO_MATCHING_PLAN', 'weightGrams', '当前重量与试算时间没有可用的物流方案');
      return result;
    }
    result.evaluatedPriceMinor = priceMinor;
    const price = BigInt(priceMinor);
    const matching = costs.filter(({ plan }) => priceMatches(plan, price));
    result.matchedPlanIds = matching.map(({ plan }) => plan.id).sort();
    const selected = mostExpensive(matching, price);
    if (!selected) {
      issue('NO_MATCHING_PLAN', 'priceMinor', '当前售价、重量与试算时间没有匹配的物流方案');
      return result;
    }
    const { plan, logistics, base } = selected;
    result.planId = plan.id;
    result.planName = plan.name;
    result.selectionReason = matching.length > 1
      ? `命中 ${matching.length} 个方案，按固定费、当前重量物流费与当前售价佣金之和最高的「${plan.name}」计算；费用相同按方案 ID 稳定选择`
      : `当前售价与重量匹配「${plan.name}」，且报价在有效期内`;
    result.breakdown.fixedMinor = plan.fixedMinor;
    result.breakdown.logisticsMinor = safeNumber(logistics);
    const fee = commission(price, plan.commissionPpm);
    const total = base + fee;
    const profit = price - total;
    result.breakdown.commissionMinor = safeNumber(fee);
    result.breakdown.totalCostMinor = safeNumber(total);
    result.breakdown.profitMinor = safeNumber(profit);
    const scaled = profit * MILLION;
    result.breakdown.marginPpm = safeNumber(scaled >= 0n ? scaled / price : -ceil(-scaled, price));
    if (config.minimumMarginPpm !== null && !meetsMargin(price, base, plan.commissionPpm, config.minimumMarginPpm))
      issue('MARGIN_BELOW_MINIMUM', 'priceMinor', '售价低于已设置的最低利润要求');
    if (config.minPriceMinor !== null && priceMinor < config.minPriceMinor)
      issue('PRICE_BELOW_MINIMUM', 'priceMinor', '售价低于已设置的最低售价');
    if (config.maxPriceMinor !== null && priceMinor > config.maxPriceMinor)
      issue('PRICE_ABOVE_MAXIMUM', 'priceMinor', '售价高于已设置的最高售价');
    if (listing && input.pricingMode === 'automatic' && config.maxAutoPriceMinor !== null && priceMinor > config.maxAutoPriceMinor)
      issue('AUTO_LISTING_PRICE_LIMIT', 'priceMinor', '自动上品售价超过已设置上限，请调整方案或明确指定售价；程序不会截低售价');
    if (!meetsMargin(price, base, plan.commissionPpm, result.targetMarginPpm))
      result.warnings.push('当前售价未达到目标利润率；目标用于建议价，只有另行设置的最低利润会阻止提交。');
  } catch (error) {
    issue(error instanceof BusinessPricingError ? error.code : 'PRICING_CALCULATION_FAILED', 'priceMinor', error instanceof Error ? error.message : '定价计算失败');
  }
  result.status = result.issues.length ? 'blocked' : 'ready';
  return result;
}

export function quotePricing(config: BusinessPricingConfig | undefined, input: QuoteInput): BusinessPriceQuote {
  return config?.logisticsSelection === 'automatic' ? quoteAutomaticPricing(config, input) : quoteFixedPricing(config, input);
}

export const quoteBusinessPrice = quotePricing;

/** Stored in a stable application namespace; source-system cache revisions must not invalidate it. */
export class BusinessPricingRepository {
  readonly store: PricingStore;
  readonly now: () => string;
  constructor(store: PricingStore, now: () => string = () => new Date().toISOString()) { this.store = store; this.now = now; }
  read(storeId: string): BusinessPricingConfig | undefined {
    id.parse(storeId);
    const raw = this.store.get<BusinessPricingConfig>('business_pricing', storeId);
    if (raw === undefined) return undefined;
    return businessPricingConfigSchema.parse(raw);
  }
  get(storeId: string): BusinessPricingConfig | undefined { return this.read(storeId); }
  list(): BusinessPricingConfig[] { return this.store.list<BusinessPricingConfig>('business_pricing').map(row => businessPricingConfigSchema.parse(row)); }
  save(storeId: string, raw: BusinessPricingDraft | BusinessPricingConfig, expectedRevision: number): BusinessPricingConfig {
    id.parse(storeId);
    if (!validInteger(expectedRevision, true)) throw new BusinessPricingError('EXPECTED_REVISION_REQUIRED', '保存时必须提供读到的规则版本；首次保存为 0');
    const draft = asDraft(raw);
    return this.store.transaction(() => {
      const existing = this.read(storeId);
      if ((existing?.revision ?? 0) !== expectedRevision)
        throw new BusinessPricingError('PRICING_REVISION_CONFLICT', '经营规则已被更新，请读取最新版本后再保存', { expectedRevision, actualRevision: existing?.revision ?? 0 });
      if (expectedRevision === Number.MAX_SAFE_INTEGER) throw new BusinessPricingError('REVISION_OVERFLOW', '规则版本已超出支持范围');
      const config = businessPricingConfigSchema.parse({ ...draft, schemaVersion: 1, storeId, revision: expectedRevision + 1, updatedAt: this.now() });
      this.store.put('business_pricing_versions', `${storeId}:${config.revision}`, config);
      this.store.put('business_pricing', storeId, config);
      return structuredClone(config);
    });
  }
  readVersion(storeId: string, revision: number): BusinessPricingConfig | undefined {
    id.parse(storeId); positive.parse(revision);
    const raw = this.store.get<BusinessPricingConfig>('business_pricing_versions', `${storeId}:${revision}`);
    return raw === undefined ? undefined : businessPricingConfigSchema.parse(raw);
  }
  quote(input: QuoteInput): BusinessPriceQuote;
  quote(storeId: string, input: Omit<QuoteInput, 'storeId'>): BusinessPriceQuote;
  quote(inputOrStore: QuoteInput | string, raw?: Omit<QuoteInput, 'storeId'>): BusinessPriceQuote {
    const input = typeof inputOrStore === 'string' ? { ...raw!, storeId: inputOrStore } : inputOrStore;
    return quotePricing(this.read(input.storeId), { ...input, at: input.at ?? this.now() });
  }
}

/** Explicit migration draft only; calling this helper does not save or activate any rule. */
export function legacyReferenceDraft(importedAt = new Date().toISOString()): BusinessPricingDraft {
  timestamp.parse(importedAt);
  return {
    currency: 'CNY', defaultPlanId: 'legacy-unified-reference',
    plans: [{ id: 'legacy-unified-reference', name: '旧平台统一参考方案', enabled: true, fixedMinor: 316, logisticsMicrosPerGram: 39_300, commissionPpm: 200_000 }],
    listingTargetMarginPpm: 600_000, manualTargetMarginPpm: 50_000, minimumMarginPpm: null,
    maxAutoPriceMinor: 13_500, minPriceMinor: null, maxPriceMinor: null,
    source: { kind: 'legacy-platform', sourceVersion: 'guide-v39', importedAt,
      description: '参考 trademind_cli 已发布上品规则 v39：上品目标 60%、手动 ERP 目标 5%、固定费 3.16 CNY、每克物流费 0.0393 CNY、佣金 20%、自动上品上限 135 CNY。旧平台没有逐渠道报价；未导入暂停实验的 15% 利润底线。' },
  };
}

/** User-confirmed dynamic rules. This creates a draft and never modifies a saved configuration. */
export function dynamicReferenceDraft(): BusinessPricingDraft {
  return {
    currency: 'CNY', defaultPlanId: null, logisticsSelection: 'automatic',
    plans: [
      { id: 'dynamic-below-135', name: '方案 1（售价低于 135 元）', enabled: true, fixedMinor: 316,
        logisticsMicrosPerGram: 39_300, commissionPpm: 200_000, maxPriceExclusiveMinor: 13_500 },
      { id: 'dynamic-from-135', name: '方案 2（售价 135 元及以上）', enabled: true, fixedMinor: 1800,
        logisticsMicrosPerGram: 39_300, commissionPpm: 200_000, minPriceMinor: 13_500 },
    ],
    listingTargetMarginPpm: 600_000, manualTargetMarginPpm: 50_000, minimumMarginPpm: null,
    maxAutoPriceMinor: null, minPriceMinor: null, maxPriceMinor: null,
    source: { kind: 'user', description: '用户确认：按实际售价和重量自动匹配；低于 135 元固定费 3.16 元，135 元及以上固定费 18 元，其余均为 39.3 元/kg、佣金 20%。重合时取当前价格和重量下总方案费用最高者。目标利润沿用上品 60%、日常 5%，未另加利润底线或售价上限。' },
  };
}
