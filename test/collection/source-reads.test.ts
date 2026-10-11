import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectionService } from '../../packages/collection/src/index.ts';
import type { CollectionClient, CollectionOptions, CollectionStore } from '../../packages/collection/src/index.ts';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(options: Partial<CollectionOptions> = {}) {
  const values = new Map<string, any>();
  const calls = { detail: [] as string[], raw: [] as string[], index: 0, listing: [] as string[][] };
  let rawValue: any = { note: 'before', rows: Array.from({ length: 70 }, (_, i) => i) };
  const details = new Map(['a', 'b'].map(id => [id, { id, title: 'terminal', source: 'taobao_tmall', currency: 'CNY', skus: [{ sourceSkuId: `${id}-sku`, goodsPrice: 1 }] }]));
  let rows: any[] = [...details.values()].map((item, i) => ({ id: item.id, title: item.title, source: item.source, currency: 'CNY', goodsMinPrice: i + 1, goodsMaxPrice: i + 1, skuCount: 1 }));
  const store: CollectionStore = {
    get: <T>(collection: string, id: string) => values.get(`${collection}/${id}`) as T | undefined,
    put: <T>(collection: string, id: string, value: T) => { values.set(`${collection}/${id}`, structuredClone(value)); return value; },
  };
  const client: CollectionClient = {
    async getCollectedItemDetail(id) { calls.detail.push(id); return { status: 'ok', raw: details.get(id) }; },
    async getCollectedItem(id) { calls.raw.push(id); return { status: 'ok', raw: { id, content: JSON.stringify(rawValue), truncated: false } }; },
    async searchCollectedItems() { calls.index++; return { status: 'ok', raw: rows }; },
  };
  const service = new CollectionService({ client, store, listingStates: async ids => { calls.listing.push([...ids]); return {}; }, ...options });
  return { service, client, store, calls, values, details, setRaw(value: any) { rawValue = value; }, setRows(value: any[]) { rows = value; } };
}
const readNote = (service: CollectionService, id = 'a') => service.resourceRead({ id, path: '/source/note' });

test('explicit detail refresh invalidates original evidence even when normalized facts are unchanged', async () => {
  const f = fixture();
  const before = await readNote(f.service);
  f.setRaw({ note: 'after' });
  await f.service.getProduct('a', { refresh: true });
  const after = await readNote(f.service);
  assert.equal(after.revision, before.revision, 'raw-only changes do not invent normalized fact changes');
  assert.equal(after.value, 'after');
  assert.equal(f.calls.raw.length, 2);
});

test('expired detail cache invalidates original evidence while unchanged pages share one original read', async () => {
  const f = fixture();
  const first = await f.service.resourceRead({ id: 'a', path: '/source/rows', limit: 40 });
  const second = await f.service.resourceRead({ id: 'a', path: '/source/rows', cursor: first.nextCursor });
  assert.deepEqual([...first.value, ...second.value], Array.from({ length: 70 }, (_, i) => i));
  assert.equal(f.calls.raw.length, 1);
  const cached = f.store.get<any>('collection_products', 'legacy-collection:a');
  f.store.put('collection_products', 'legacy-collection:a', { ...cached, fetchedAtMs: 0 });
  f.setRaw({ note: 'expired-then-new' });
  assert.equal((await readNote(f.service)).value, 'expired-then-new');
  assert.equal(f.calls.raw.length, 2);
});

test('raw-only refresh rejects an old original cursor instead of mixing document versions', async () => {
  const f = fixture();
  const first = await f.service.resourceRead({ id: 'a', path: '/source/rows', limit: 10 });
  f.setRaw({ rows: Array.from({ length: 70 }, (_, i) => i + 100) });
  await f.service.getProduct('a', { refresh: true });
  await assert.rejects(f.service.resourceRead({ id: 'a', path: '/source/rows', cursor: first.nextCursor }), (error: any) => error.code === 'COLLECTION_REVISION_CHANGED');
  const current = await f.service.resourceRead({ id: 'a', path: '/source/rows', limit: 10 });
  assert.deepEqual(current.value, Array.from({ length: 10 }, (_, i) => i + 100));
  assert.equal(f.calls.raw.length, 2);
});

test('old original read finishing after a refresh cannot replace the new cache generation', async () => {
  const f = fixture(), started = deferred(), release = deferred();
  let calls = 0;
  f.client.getCollectedItem = async id => {
    const sequence = ++calls;
    if (sequence === 1) { started.resolve(); await release.promise; }
    return { status: 'ok', raw: { id, content: JSON.stringify({ note: sequence === 1 ? 'old-inflight' : 'new-generation' }), truncated: false } };
  };
  const old = readNote(f.service); await started.promise;
  await f.service.getProduct('a', { refresh: true });
  assert.equal((await readNote(f.service)).value, 'new-generation');
  release.resolve(); await old;
  assert.equal((await readNote(f.service)).value, 'new-generation');
  assert.equal(calls, 2);
});

test('concurrent paths for one original snapshot share a fetch, but each result remains independent', async () => {
  const f = fixture(), started = deferred(), release = deferred();
  let calls = 0;
  f.client.getCollectedItem = async id => { calls++; started.resolve(); await release.promise; return { status: 'ok', raw: { id, content: '{"note":"same","other":"field"}', truncated: false } }; };
  const reads = Array.from({ length: 8 }, (_, i) => f.service.resourceRead({ id: 'a', path: i % 2 ? '/source/other' : '/source/note' }));
  await started.promise; await Promise.resolve(); release.resolve();
  const results = await Promise.all(reads);
  assert.equal(calls, 1);
  assert.deepEqual(results.map(r => r.value), ['same', 'field', 'same', 'field', 'same', 'field', 'same', 'field']);
  assert.equal(f.calls.detail.length, 1);
});

test('failed shared original reads are evicted so a later request can recover', async () => {
  const f = fixture(), started = deferred(), release = deferred();
  let calls = 0;
  f.client.getCollectedItem = async id => { const first = ++calls === 1; if (first) { started.resolve(); await release.promise; return { status: 'unavailable', error: { code: 'OFFLINE', message: 'fixture offline', retryable: true } }; } return { status: 'ok', raw: { id, content: '{"note":"recovered"}', truncated: false } }; };
  const pending = Array.from({ length: 4 }, () => readNote(f.service));
  const outcomes = Promise.allSettled(pending); await started.promise; await Promise.resolve(); release.resolve();
  assert((await outcomes).every(outcome => outcome.status === 'rejected'));
  assert.equal(calls, 1);
  assert.equal((await readNote(f.service)).value, 'recovered');
  assert.equal(calls, 2);
});

test('concurrent directory reads share one fetch, preserve pagination, and refresh once', async () => {
  const f = fixture(), started = deferred(), release = deferred();
  const original = f.client.searchCollectedItems;
  f.client.searchCollectedItems = async query => { started.resolve(); await release.promise; return original(query); };
  const pending = Array.from({ length: 8 }, () => f.service.search({ limit: 1 }));
  await started.promise; release.resolve();
  const firstPages = await Promise.all(pending);
  assert.equal(f.calls.index, 1);
  assert(firstPages.every(page => page.items[0].id === 'a' && page.nextCursor === firstPages[0].nextCursor));
  const second = await f.service.search({ cursor: firstPages[0].nextCursor, limit: 1 });
  assert.equal(second.items[0].id, 'b'); assert.equal(f.calls.index, 1);
  await Promise.all(Array.from({ length: 4 }, () => f.service.search({ refresh: true })));
  assert.equal(f.calls.index, 2);
});

test('a failed directory fetch is shared and does not poison the next attempt', async () => {
  const f = fixture(), started = deferred(), release = deferred();
  let calls = 0;
  f.client.searchCollectedItems = async () => { const first = ++calls === 1; if (first) { started.resolve(); await release.promise; return { status: 'unavailable', error: { code: 'OFFLINE', message: 'fixture offline', retryable: true } }; } return { status: 'ok', raw: [] }; };
  const outcomes = Promise.allSettled(Array.from({ length: 4 }, () => f.service.search()));
  await started.promise; release.resolve(); assert((await outcomes).every(outcome => outcome.status === 'rejected'));
  assert.equal(calls, 1); assert.equal((await f.service.search()).total, 0); assert.equal(calls, 2);
});

test('original fetches remain isolated by product and service/connection scope', async () => {
  const a = fixture({ sourceId: 'connection-a' }), b = fixture({ sourceId: 'connection-b' });
  a.client.getCollectedItem = async id => { a.calls.raw.push(id); return { status: 'ok', raw: { id, content: JSON.stringify({ note: `A:${id}` }), truncated: false } }; };
  b.client.getCollectedItem = async id => { b.calls.raw.push(id); return { status: 'ok', raw: { id, content: JSON.stringify({ note: `B:${id}` }), truncated: false } }; };
  const results = await Promise.all([readNote(a.service, 'a'), readNote(a.service, 'b'), readNote(b.service, 'a')]);
  assert.deepEqual(results.map(r => r.value), ['A:a', 'A:b', 'B:a']);
  assert.deepEqual(a.calls.raw, ['a', 'b']); assert.deepEqual(b.calls.raw, ['a']);
});

test('separate clients sharing a store and source IDs do not share in-flight original or directory requests', async () => {
  const a = fixture(), b = fixture({ store: a.store });
  a.setRaw({ note: 'client-A' }); b.setRaw({ note: 'client-B' });
  a.setRows([{ id: 'catalog-A' }]); b.setRows([{ id: 'catalog-B' }]);
  const [rawA, rawB, indexA, indexB] = await Promise.all([readNote(a.service), readNote(b.service), a.service.search(), b.service.search()]);
  assert.equal(rawA.value, 'client-A'); assert.equal(rawB.value, 'client-B');
  assert.equal(indexA.items[0].id, 'catalog-A'); assert.equal(indexB.items[0].id, 'catalog-B');
  assert.equal(a.calls.raw.length, 1); assert.equal(b.calls.raw.length, 1);
  assert.equal(a.calls.index, 1); assert.equal(b.calls.index, 1);
});

test('price exclusions avoid irrelevant detail/state reads and their failures', async () => {
  const f = fixture(); const detail = f.client.getCollectedItemDetail!;
  f.client.getCollectedItemDetail = async id => { if (id === 'b') throw new Error('excluded product is unavailable'); return detail(id); };
  const result = await f.service.search({ query: 'terminal', price: { meaning: 'purchase_cost', currency: 'CNY', min: 1, max: 1 } });
  assert.equal(result.total, 1); assert.equal(result.items[0].id, 'a');
  assert.deepEqual(f.calls.detail, ['a']); assert.deepEqual(f.calls.listing, [['a']]);
  assert.deepEqual(result.facets.sources, { taobao_tmall: 1 });
});

test('early price filtering preserves meaning/currency/missing-price semantics and inclusive boundaries', async () => {
  const f = fixture();
  f.setRows([
    { id: 'cny', currency: 'CNY', goodsMinPrice: 1, goodsMaxPrice: 2 },
    { id: 'usd', currency: 'USD', goodsMinPrice: 1, goodsMaxPrice: 2 },
    { id: 'missing-currency', goodsMinPrice: 1, goodsMaxPrice: 2 },
    { id: 'missing-price', currency: 'CNY' },
    { id: 'display', sourceSellingPrice: { amount: 2, currency: 'CNY' } },
  ]);
  const purchase = await f.service.search({ price: { meaning: 'purchase_cost', currency: 'CNY', min: 2, max: 2 } });
  assert.deepEqual(purchase.items.map((item: any) => item.id), ['cny']);
  const display = await f.service.search({ price: { meaning: 'source_display_price', currency: 'CNY', min: 2, max: 2 } });
  assert.deepEqual(display.items.map((item: any) => item.id), ['display']);
  assert.deepEqual(f.calls.listing, [['cny'], ['display']]);
  assert.deepEqual(f.calls.detail, []);
});

test('price-filtered store record counts exclude unavailable records outside the price candidates', async () => {
  const lookedUp: string[][] = [];
  const f = fixture({ listingStates: async ids => {
    lookedUp.push([...ids]);
    return { a: [{ storeId: 'bill', status: 'unknown', listingRecord: 'not_found' }] };
  } });
  const result = await f.service.search({ price: { meaning: 'purchase_cost', currency: 'CNY', min: 1, max: 1 }, store: { id: 'bill', listingRecord: 'not_found' } });
  assert.equal(result.total, 1); assert.equal(result.completeness, 'complete');
  assert.equal(result.recordLookup.status, 'complete'); assert.equal(result.recordLookup.unavailableItems, 0);
  assert.deepEqual(result.items.map((item: any) => item.id), ['a']);
  assert.deepEqual(lookedUp, [['a']]);
});

test('declared original product identity mismatch is rejected before caching and can recover', async () => {
  const f = fixture(); let calls = 0;
  f.client.getCollectedItem = async id => { calls++; return { status: 'ok', raw: { id: calls === 1 ? 'wrong-product' : id, content: '{"note":"verified"}', truncated: false } }; };
  await assert.rejects(readNote(f.service), (error: any) => error.code === 'COLLECTION_ID_MISMATCH');
  assert.equal([...f.values.keys()].filter(key => key.startsWith('collection_raw/')).length, 0);
  assert.equal((await readNote(f.service)).value, 'verified'); assert.equal(calls, 2);
});

test('legacy original envelopes without a declared identity remain readable', async () => {
  const f = fixture();
  f.client.getCollectedItem = async () => ({ status: 'ok', raw: { content: '{"note":"legacy"}', truncated: false } });
  assert.equal((await readNote(f.service)).value, 'legacy');
});

test('legacy persisted caches are upgraded once without trusting stale raw contents', async () => {
  const f = fixture(); await f.service.getProduct('a');
  const cached = f.store.get<any>('collection_products', 'legacy-collection:a'); delete cached.generation;
  f.store.put('collection_products', 'legacy-collection:a', cached);
  f.store.put('collection_raw', `legacy-collection:a:${cached.product.revision}`, { value: { note: 'old-cache' } });
  assert.equal((await readNote(f.service)).value, 'before');
  assert.equal((await readNote(f.service)).value, 'before');
  assert.equal(f.calls.raw.length, 1); assert.equal(f.calls.detail.length, 1);
});
