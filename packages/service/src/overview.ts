import type { OverviewDto, OverviewStatus } from '../../contracts/src/overview.ts';

interface SourceResponse { status: string; raw?: unknown }
/** Deliberately excludes synchronization, platform calls, Core tools, and persistence. */
export interface OverviewClient {
  health(): Promise<SourceResponse>;
  searchCollectedItems(query?: string): Promise<SourceResponse>;
  getStores(): Promise<SourceResponse>;
  getStoreProducts(): Promise<SourceResponse>;
}
type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const time = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
async function read(fn: () => Promise<SourceResponse>): Promise<unknown> {
  try { const response = await fn(); return response.status === 'ok' ? response.raw : undefined; }
  catch { return undefined; }
}
function uniqueRows(value: unknown, key: (row: Row) => string | undefined): Row[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  for (const row of value) {
    if (!object(row)) return undefined;
    const id = key(row);
    if (!id || seen.has(id)) return undefined;
    seen.add(id);
  }
  return value;
}
function inventory(value: unknown): { count: number | null; status: OverviewStatus; lastSuccessAt: string | null; stores: Map<string, { productCount: number | null; lastSuccessAt: string | null; status: OverviewStatus }> } | undefined {
  if (!object(value)) return undefined;
  const stores = uniqueRows(value.stores, row => identity(row.id) && (row.storeId === undefined || row.storeId === row.id) ? row.id : undefined);
  const products = uniqueRows(value.products, row => identity(row.storeId) && identity(row.offerId) ? JSON.stringify([row.storeId, row.offerId]) : undefined);
  if (!stores || !products) return undefined;
  const counts = new Map(stores.map(row => [row.id as string, 0]));
  for (const row of products) {
    if (!counts.has(row.storeId as string)) return undefined;
    counts.set(row.storeId as string, counts.get(row.storeId as string)! + 1);
  }
  const summaries = new Map(stores.map(row => {
    const count = counts.get(row.id as string)!;
    const lastSuccessAt = time(row.lastSuccessAt), lastAttemptAt = time(row.lastAttemptAt);
    // An unsynchronized empty source file is not evidence that the shop has zero products.
    const known = lastSuccessAt !== null || count > 0;
    const stale = !lastSuccessAt || !!row.error || row.state === 'stale' || row.status === 'stale'
      || !!lastAttemptAt && Date.parse(lastAttemptAt) > Date.parse(lastSuccessAt);
    return [row.id as string, { productCount: known ? count : null, lastSuccessAt, status: (known ? stale ? 'stale' : 'ok' : 'unavailable') as OverviewStatus }] as const;
  }));
  const rows = [...summaries.values()];
  const complete = rows.every(row => row.productCount !== null);
  const times = rows.map(row => row.lastSuccessAt);
  return {
    count: complete ? products.length : null,
    status: !complete ? 'unavailable' : rows.some(row => row.status === 'stale') ? 'stale' : 'ok',
    lastSuccessAt: times.length && times.every((value): value is string => value !== null) ? times.sort((a, b) => Date.parse(a) - Date.parse(b))[0] : null,
    stores: summaries,
  };
}

/** Reads local Source GETs only. Does not save designs, snapshots, or trigger a platform synchronization. */
export async function readOverview(client: OverviewClient, now: () => Date = () => new Date()): Promise<OverviewDto> {
  const result: OverviewDto = {
    fetchedAt: now().toISOString(),
    collected: { status: 'unavailable', count: null },
    products: { status: 'unavailable', count: null, lastSuccessAt: null },
    stores: { status: 'unavailable', count: null, rows: [] },
  };
  try { if ((await client.health()).status !== 'ok') return result; } catch { return result; }
  const [collectedRaw, storesRaw, productsRaw] = await Promise.all([
    read(() => client.searchCollectedItems()), read(() => client.getStores()), read(() => client.getStoreProducts()),
  ]);
  const collected = uniqueRows(collectedRaw, row => identity(row.id) ? row.id : undefined);
  if (collected) result.collected = { status: 'ok', count: collected.length };
  const products = inventory(productsRaw);
  if (products) result.products = { count: products.count, status: products.status, lastSuccessAt: products.lastSuccessAt };
  const stores = uniqueRows(storesRaw, row => identity(row.id) && identity(row.shopName) ? row.id : undefined);
  if (stores) result.stores = {
    status: 'ok', count: stores.length,
    rows: stores.map(row => ({ id: row.id as string, name: row.shopName as string,
      ...(products?.stores.get(row.id as string) ?? { productCount: null, lastSuccessAt: null, status: 'unavailable' as const }),
    })),
  };
  if (stores && products && (stores.length !== products.stores.size || stores.some(row => !products.stores.has(row.id as string)))) {
    // Separate local GETs can straddle a store change; do not label a partial inventory as the total.
    result.products = { count: null, status: 'unavailable', lastSuccessAt: null };
  }
  return result;
}
