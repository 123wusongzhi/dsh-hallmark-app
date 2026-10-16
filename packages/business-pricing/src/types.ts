import type { CoreStore } from '../../core/src/types.ts';

/** Money is integer CNY cents; logistics rates are integer millionths of one CNY per gram. */
export interface LogisticsPlan {
  id: string;
  name: string;
  enabled: boolean;
  fixedMinor: number;
  logisticsMicrosPerGram: number;
  commissionPpm: number;
  deliveryMethodId?: string;
  validFrom?: string;
  validUntil?: string;
  minWeightGrams?: number;
  maxWeightGrams?: number;
  /** Inclusive lower bound and exclusive upper bound, in CNY cents. */
  minPriceMinor?: number;
  maxPriceExclusiveMinor?: number;
}

export interface PricingSource {
  kind: 'legacy-platform' | 'user';
  description: string;
  importedAt?: string;
  sourceVersion?: string;
}

export interface BusinessPricingConfig {
  schemaVersion: 1;
  storeId: string;
  revision: number;
  updatedAt: string;
  currency: 'CNY';
  defaultPlanId: string | null;
  /** Missing on historical configurations means fixed selection. */
  logisticsSelection?: 'automatic' | 'fixed';
  plans: LogisticsPlan[];
  listingTargetMarginPpm: number;
  manualTargetMarginPpm: number;
  minimumMarginPpm: number | null;
  maxAutoPriceMinor: number | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  source?: PricingSource;
}

export type BusinessPricingDraft = Omit<BusinessPricingConfig, 'schemaVersion' | 'storeId' | 'revision' | 'updatedAt'>;
export type PricingStore = Pick<CoreStore, 'get' | 'put' | 'list' | 'transaction'>;

export interface QuoteInput {
  storeId: string;
  action: string;
  planId?: string;
  purchaseMinor: number | null;
  weightGrams: number | null;
  priceMinor?: number | null;
  pricingMode: 'automatic' | 'manual';
  at?: string;
}

export interface PricingIssue { code: string; field: string; message: string }
export interface PricingBreakdown {
  purchaseMinor: number | null;
  fixedMinor: number | null;
  logisticsMinor: number | null;
  commissionMinor: number | null;
  totalCostMinor: number | null;
  profitMinor: number | null;
  /** Display value, rounded toward minus infinity. Rule checks use exact integers. */
  marginPpm: number | null;
}

export interface BusinessPriceQuote {
  status: 'ready' | 'blocked';
  storeId: string;
  configRevision: number | null;
  planId: string | null;
  planName: string | null;
  selectionMode?: 'automatic' | 'fixed';
  selectionReason?: string;
  matchedPlanIds?: string[];
  suggestedPlanId?: string | null;
  suggestedPlanName?: string | null;
  currency: 'CNY';
  targetMarginPpm: number | null;
  minimumMarginPpm: number | null;
  suggestedPriceMinor: number | null;
  minimumAllowedPriceMinor: number | null;
  evaluatedPriceMinor: number | null;
  breakdown: PricingBreakdown;
  issues: PricingIssue[];
  warnings: string[];
}
