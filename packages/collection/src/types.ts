import type { AdapterResponse } from '../../core/src/types.ts';

export interface CollectionClient {
  searchCollectedItems(query?: string): Promise<AdapterResponse>;
  getCollectedItemDetail?(id: string): Promise<AdapterResponse>;
  getCollectedItem(id: string): Promise<AdapterResponse>;
}
export interface CollectionStore {
  get<T = Record<string, any>>(collection: string, id: string): T | undefined;
  put<T>(collection: string, id: string, value: T): T;
}
export interface CollectionPackage {
  weightGrams: number | null;
  dimensionsMm: { length: number; width: number; height: number } | null;
  original: { weight?: unknown; dimensions?: unknown; weightUnit?: string; dimensionUnit?: string };
  basis: string;
}
export interface CollectionPrice {
  amount: string;
  currency: string;
  unit: string | null;
  meaning: 'purchase_cost' | 'source_display_price';
}
export interface CollectionAsset { id: string; url: string; roles: Array<'main' | 'sku' | 'detail'>; skuIds: string[] }
export interface CollectionSku {
  id: string | null;
  nativeId?: string;
  code?: string;
  spec: string;
  attributes: Record<string, string>;
  purchaseCost: CollectionPrice | null;
  sourceDisplayPrice: CollectionPrice | null;
  package: CollectionPackage | null;
  imageRef: string | null;
  stock: number | null;
  enabled: boolean | null;
}
export interface CollectionProduct {
  id: string;
  sourceId: string;
  revision: string;
  fetchedAt: string;
  source: string;
  title: string;
  originalTitle: string | null;
  sourceUrl: string | null;
  category: { id: string | null; path: string[] };
  attributes: Record<string, string>;
  package: CollectionPackage;
  unit: string | null;
  minimumOrder: number | null;
  customsCodes: string[];
  description: string;
  skus: CollectionSku[];
  assets: CollectionAsset[];
  unknowns: Array<{ field: string; reason: string; skuIds?: string[] }>;
  mapping: { version: string; coverage: 'verified_structure' | 'partial' };
}
export type CollectionSaleState = 'on_sale' | 'out_of_stock' | 'pending' | 'archived' | 'failed' | 'not_sellable' | 'unknown';
export type CollectionListingRecord = 'found' | 'not_found' | 'unavailable';
export interface CollectionListingState {
  storeId: string;
  storeName?: string;
  /** Historical successful SKU coverage, independent of current availability. */
  status: 'listed' | 'partial' | 'not_listed' | 'unknown';
  /** Exact local listing records, including saved drafts; not proof of all platform history. */
  listingRecord?: CollectionListingRecord;
  listingRecordReason?: string;
  savedListingCount?: number;
  /** Store-wide caveat, rendered once per result/table rather than on every card. */
  hasUnlinkedHistory?: boolean;
  listedSkuIds?: string[];
  listedSkuCount?: number;
  association?: 'linked' | 'none' | 'unknown';
  associatedSkuIds?: string[];
  associatedSkuCount?: number;
  /** Counts unique sale offers, not source SKUs. One source SKU can have several offers. */
  offerCount?: number;
  saleStates?: Record<CollectionSaleState, number>;
  countUnit?: 'offers';
  observedAt?: string | null;
  freshness?: 'fresh' | 'stale' | 'unknown';
  skuIdsComplete?: boolean;
  available?: { id: string; kind: 'raw'; path: string };
}
export interface CollectionOptions {
  client: CollectionClient;
  store: CollectionStore;
  sourceId?: string;
  cacheDir?: string;
  cacheTtlMs?: number;
  fetch?: typeof globalThis.fetch;
  /** Host converts service-local files into executor-readable resources when machines differ. */
  exposeAsset?: (asset: { path: string; mimeType: string; resourceId: string; revision: string }) => Promise<Record<string, unknown>>;
  listingStates?: (itemIds: string[], summaries?: Array<{ id: string; skuCount: number }>, options?: { refresh?: boolean }) => Promise<Record<string, CollectionListingState[]>>;
}
export interface CollectionSearchInput {
  query?: string;
  source?: string;
  category?: string;
  price?: { meaning: 'purchase_cost' | 'source_display_price'; currency: string; min?: number; max?: number };
  store?: { id: string; listingRecord?: CollectionListingRecord; status?: 'listed' | 'partial' | 'not_listed' | 'unknown'; saleState?: CollectionSaleState; association?: 'linked' | 'none' | 'unknown' };
  limit?: number;
  cursor?: string;
  refresh?: boolean;
}
export interface CollectionReadInput {
  id?: string;
  ids?: string[];
  skuIds?: string[];
  selections?: Array<{ id: string; skuIds?: string[]; cursor?: string; revision?: string }>;
  cursor?: string;
  revision?: string;
  limit?: number;
  maxBytes?: number;
  refresh?: boolean;
}
export interface CollectionResourceInput {
  id: string;
  kind?: 'raw' | 'description' | 'images' | 'image';
  path?: string;
  assetId?: string;
  role?: 'main' | 'sku' | 'detail';
  skuIds?: string[];
  cursor?: string;
  revision?: string;
  limit?: number;
  maxBytes?: number;
}
