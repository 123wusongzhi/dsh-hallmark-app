import { createHash } from 'node:crypto';
import type { AdapterResponse, CoreStore, RecordData } from '../../core/src/types.ts';
import type { CollectionPackage, CollectionProduct } from '../../collection/src/types.ts';
import { localBusinessProducts } from './operations-client.ts';

export interface PackagingEvidenceReadInput { storeId: string; path: string; body: Record<string, unknown> }
export type PackagingEvidenceReader = (input: PackagingEvidenceReadInput) => Promise<AdapterResponse>;
export interface PackagingEvidenceOptions { storeIds?: string[]; now?: () => number; cacheTtlMs?: number }
type Binding = { storeId: string; offerId: string; productId: string; itemId: string; sourceSkuId: string; stamp: string };
export interface ExistingCategoryHint { descriptionCategoryId: number; typeId: number; observedAt: string; source: 'exact-platform-binding' }
type Evidence = { binding: Binding; observedAt: string; weightGrams: number | null; dimensionsMm: CollectionPackage['dimensionsMm']; category: Pick<ExistingCategoryHint, 'descriptionCategoryId' | 'typeId'> | null };
type CachedEvidence = { stamp: string; expiresAt: number; evidence: Evidence };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = (itemId: string, sourceSkuId: string) => JSON.stringify([itemId, sourceSkuId]);
const positive = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const safeString = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

function exactSingleBinding(row: RecordData): { itemId: string; sourceSkuId: string } | undefined {
  const components = row.procurementBinding?.components;
  if (Array.isArray(components)) {
    const part = components[0];
    return components.length === 1 && part.quantity === 1 && part.itemId && part.sourceSkuId ? { itemId: String(part.itemId), sourceSkuId: String(part.sourceSkuId) } : undefined;
  }
  if (!Array.isArray(row.sources) || row.sources.length !== 1) return undefined;
  const source = row.sources[0];
  if (source.sourceSkuMatched !== true || !source.productId) return undefined;
  if (Array.isArray(source.components)) {
    const part = source.components[0];
    return source.components.length === 1 && part.quantity === 1 && part.sourceSkuId ? { itemId: String(source.productId), sourceSkuId: String(part.sourceSkuId) } : undefined;
  }
  if (!source.skuCode || String(source.skuCode).startsWith('composition:')) return undefined;
  return { itemId: String(source.productId), sourceSkuId: String(source.skuCode) };
}

function responseRows(response: AdapterResponse): RecordData[] {
  if (response.status !== 'ok') return [];
  const raw = response.raw?.response ?? response.raw;
  const rows = raw?.result?.items ?? raw?.result ?? raw?.items;
  return Array.isArray(rows) ? rows : [];
}

function packageEvidence(binding: Binding, row: RecordData, observedAt: string): Evidence {
  const weight = positive(row.weight);
  const weightFactor = row.weight_unit === 'g' ? 1 : row.weight_unit === 'kg' ? 1000 : null;
  const dimensionFactor = row.dimension_unit === 'mm' ? 1 : row.dimension_unit === 'cm' ? 10 : null;
  const length = positive(row.depth), width = positive(row.width), height = positive(row.height);
  return {
    binding, observedAt,
    weightGrams: weight !== null && weightFactor !== null ? weight * weightFactor : null,
    dimensionsMm: length !== null && width !== null && height !== null && dimensionFactor !== null ? { length: length * dimensionFactor, width: width * dimensionFactor, height: height * dimensionFactor } : null,
    category: Number.isSafeInteger(row.description_category_id) && row.description_category_id > 0 && Number.isSafeInteger(row.type_id) && row.type_id > 0 ? { descriptionCategoryId: row.description_category_id, typeId: row.type_id } : null,
  };
}

function unique<T>(values: Array<T | null>): T | null {
  const candidates = new Map(values.filter((value): value is T => value !== null).map(value => [JSON.stringify(value), value]));
  return candidates.size === 1 ? candidates.values().next().value! : null;
}

/** The same attribute read supplies a useful category candidate, never approval. */
export function readExistingCategoryHint(store: CoreStore, itemId: string): ExistingCategoryHint | undefined {
  const record = store.get<{ category: ExistingCategoryHint | null }>('business_listing_category_hints', itemId);
  return record?.category ? structuredClone(record.category) : undefined;
}

/**
 * Reuses an existing exact single-SKU shipping declaration only when the source has
 * no value. This enriches a returned copy, not the collector or historical records.
 * Multiple conflicting platform declarations remain unknown for that field.
 */
export async function applyExistingPackaging(products: CollectionProduct[], store: CoreStore, read: PackagingEvidenceReader, options: PackagingEvidenceOptions = {}): Promise<CollectionProduct[]> {
  const copies = structuredClone(products);
  const needed = new Set(copies.flatMap(product => product.skus.filter(sku => sku.id && ((sku.package?.weightGrams == null && product.package.weightGrams == null) || (sku.package?.dimensionsMm == null && product.package.dimensionsMm == null))).map(sku => key(product.id, sku.id!))));
  if (!needed.size) return copies;
  const now = options.now?.() ?? Date.now(), observedAt = new Date(now).toISOString();
  const storeIds = options.storeIds ?? [...new Set(store.list<RecordData>('business_catalog').map(row => String(row.storeId)).filter(Boolean))];
  const bindings = storeIds.flatMap(storeId => localBusinessProducts(store, storeId).flatMap(row => {
    const binding = exactSingleBinding(row), offerId = safeString(row.offerId), productId = safeString(row.productId);
    return binding && needed.has(key(binding.itemId, binding.sourceSkuId)) && offerId && productId ? [{ ...binding, storeId, offerId, productId, stamp: hash([productId, row.statusUpdatedAt ?? null, row.lastSeenAt ?? null, row.declaredWeight?.observedAt ?? null]) }] : [];
  }));
  const evidence: Evidence[] = [];
  const pending = new Map<string, Binding[]>();
  for (const binding of bindings) {
    const cacheId = hash([binding.storeId, binding.offerId, binding.productId]);
    const cached = store.get<CachedEvidence>('business_package_evidence', cacheId);
    if (cached && cached.stamp === binding.stamp && cached.expiresAt > now && cached.evidence.binding.itemId === binding.itemId && cached.evidence.binding.sourceSkuId === binding.sourceSkuId) evidence.push(cached.evidence);
    else pending.set(binding.storeId, [...pending.get(binding.storeId) ?? [], binding]);
  }
  for (const [storeId, group] of pending) for (let offset = 0; offset < group.length; offset += 100) {
    const batch = group.slice(offset, offset + 100);
    let rows: RecordData[];
    try { rows = responseRows(await read({ storeId, path: '/v4/product/info/attributes', body: { filter: { offer_id: batch.map(binding => binding.offerId), visibility: 'ALL' }, limit: 100 } })); }
    catch { continue; }
    for (const binding of batch) {
      const matches = rows.filter(row => safeString(row.offer_id) === binding.offerId && safeString(row.id ?? row.product_id) === binding.productId);
      if (matches.length !== 1) continue;
      const result = packageEvidence(binding, matches[0], observedAt);
      evidence.push(result);
      store.put('business_package_evidence', hash([binding.storeId, binding.offerId, binding.productId]), { stamp: binding.stamp, expiresAt: now + (options.cacheTtlMs ?? 300_000), evidence: result } satisfies CachedEvidence);
    }
  }
  for (const product of copies) {
    if (bindings.some(binding => binding.itemId === product.id)) {
      const productEvidence = evidence.filter(item => item.binding.itemId === product.id);
      const category = unique(productEvidence.map(item => item.category ?? null));
      store.put('business_listing_category_hints', product.id, { itemId: product.id, category: category ? { ...category, observedAt, source: 'exact-platform-binding' } : null, bindings: productEvidence.map(item => ({ storeId: item.binding.storeId, offerId: item.binding.offerId, productId: item.binding.productId, sourceSkuId: item.binding.sourceSkuId, category: item.category ?? null, observedAt: item.observedAt })) });
    }
    let changed = false;
    for (const sku of product.skus) {
      if (!sku.id) continue;
      const matches = evidence.filter(item => item.binding.itemId === product.id && item.binding.sourceSkuId === sku.id);
      if (!matches.length) continue;
      const weight = unique(matches.map(item => item.weightGrams)), dimensions = unique(matches.map(item => item.dimensionsMm));
      const useWeight = sku.package?.weightGrams == null && product.package.weightGrams == null && weight !== null;
      const useDimensions = sku.package?.dimensionsMm == null && product.package.dimensionsMm == null && dimensions !== null;
      if (!useWeight && !useDimensions) continue;
      const references = matches.map(item => ({ storeId: item.binding.storeId, offerId: item.binding.offerId, productId: item.binding.productId, observedAt: item.observedAt }));
      sku.package = {
        weightGrams: useWeight ? weight : sku.package?.weightGrams ?? null,
        dimensionsMm: useDimensions ? dimensions : sku.package?.dimensionsMm ?? null,
        original: {
          ...sku.package?.original,
          ...(useWeight ? { weight: { value: weight, evidence: references }, weightUnit: 'g' } : {}),
          ...(useDimensions ? { dimensions: { value: dimensions, evidence: references }, dimensionUnit: 'mm' } : {}),
        },
        basis: [sku.package?.basis, '缺项复用已精确关联单 SKU 的 Ozon 发货包装申报；非新测量'].filter(Boolean).join('；'),
      };
      changed = true;
    }
    if (changed) {
      product.unknowns = product.unknowns.flatMap(unknown => {
        const field = unknown.field === 'package.weightGrams' ? 'weightGrams' : unknown.field === 'package.dimensionsMm' ? 'dimensionsMm' : null;
        if (!field) return [unknown];
        const missing = product.skus.filter(sku => sku.id && sku.package?.[field] == null && product.package[field] == null).map(sku => sku.id!);
        return missing.length ? [{ ...unknown, skuIds: missing }] : [];
      });
      // Keep the collection revision usable for resource reads. The packaging
      // repository versions these enriched values independently for draft/price use.
    }
  }
  return copies;
}
