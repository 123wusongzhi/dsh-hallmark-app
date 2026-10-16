import { REAL_SOURCE_SUMMARIES, REAL_STORES, REAL_SALES_PRODUCTS } from './browser-data.ts';
import type { OverviewDto } from '../../packages/contracts/src/overview.ts';

/** Real values, with explicit identity suffixes only when a stress workload repeats rows. */
export function browserSourceRows(size = REAL_SOURCE_SUMMARIES.length): Array<Record<string, any>> {
  return Array.from({ length: size }, (_, index) => {
    const base = structuredClone(REAL_SOURCE_SUMMARIES[index % REAL_SOURCE_SUMMARIES.length]);
    return { ...base, ...(index >= REAL_SOURCE_SUMMARIES.length ? { id: `${base.id}:repeat-${Math.floor(index / REAL_SOURCE_SUMMARIES.length)}` } : {}), collected_at: base.importedAt, collectedAt: base.importedAt, price: base.minPrice ?? base.sourceSellingPrice?.min };
  });
}
/** Counts describe subsets of real recorded rows, useful for ordered refresh scenarios. */
export function browserOverview(collectedCount = REAL_SOURCE_SUMMARIES.length, productCount = REAL_SALES_PRODUCTS.length, storeCount = REAL_STORES.length): OverviewDto {
  const products = REAL_SALES_PRODUCTS.slice(0, productCount), stores = REAL_STORES.slice(0, storeCount);
  const fetchedAt = products[0]?.lastSeenAt ?? REAL_SOURCE_SUMMARIES[0]?.importedAt;
  return { fetchedAt, collected: { status: 'ok', count: REAL_SOURCE_SUMMARIES.slice(0, collectedCount).length }, products: { status: 'ok', count: products.length, lastSuccessAt: fetchedAt }, stores: { status: 'ok', count: stores.length, rows: stores.map(store => ({ id: store.id, name: store.shopName, productCount: products.filter(product => product.storeId === store.id).length, lastSuccessAt: fetchedAt, status: 'ok' })) } };
}
