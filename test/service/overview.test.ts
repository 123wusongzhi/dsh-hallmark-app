import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { HallmarkClient } from '../../packages/hallmark-adapter/index.ts';
import { readOverview, type OverviewClient } from '../../packages/service/src/overview.ts';
import { createAppServer } from '../../packages/service/src/server.ts';
import { AppStore } from '../../packages/store/index.ts';
import { assertJsonCompatible } from '../../packages/contracts/src/json.ts';

const readAt = '2026-10-06T05:00:00.000Z', firstAt = '2026-10-05T02:00:00.000Z', secondAt = '2026-10-06T02:00:00.000Z';
const now = () => new Date(readAt);
const ok = (raw: unknown) => ({ status: 'ok', raw });
function fixture(overrides: Partial<OverviewClient> = {}): OverviewClient {
  return {
    health: async () => ok({ service: 'hallmark-board' }),
    searchCollectedItems: async () => ok([{ id: 'item-a' }, { id: 'item-b' }]),
    getStores: async () => ok([{ id: 'a', shopName: '店铺 A' }, { id: 'b', shopName: '店铺 B' }]),
    getStoreProducts: async () => ok({
      stores: [{ id: 'a', storeId: 'a', lastSuccessAt: firstAt }, { id: 'b', lastSuccessAt: secondAt }],
      products: [{ storeId: 'a', offerId: 'same-offer', status: 'archived' }, { storeId: 'b', offerId: 'same-offer', status: 'on_sale' }],
    }),
    ...overrides,
  };
}

test('overview uses only the four fixed local GET routes, counts archived inventory, and projects no sensitive source fields', async () => {
  const calls: string[] = [], marker = 'synthetic-private-never-forward';
  const payloads: Record<string, unknown> = {
    '/api/health': { service: 'hallmark-board', apiKey: marker },
    '/api/items': [{ id: 'item-a', raw: marker }, { id: 'item-b', title: marker }],
    '/api/stores': [{ id: 'a', shopName: '店铺 A', apiKey: marker, hasCredential: true }, { id: 'b', shopName: '店铺 B', remark: marker }],
    '/api/store-products': { stores: [{ id: 'a', lastSuccessAt: firstAt, analytics: { raw: marker } }, { id: 'b', lastSuccessAt: secondAt }],
      products: [{ storeId: 'a', offerId: 'same-offer', status: 'archived', profit: marker }, { storeId: 'b', offerId: 'same-offer', status: 'on_sale' }] },
  };
  const client = new HallmarkClient({ baseUrl: 'http://127.0.0.1:4280', fetchImpl: (async (input, init) => {
    const path = new URL(String(input)).pathname;
    assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).get('authorization'), null);
    assert.ok(Object.hasOwn(payloads, path), `Forbidden route: ${path}`);
    calls.push(path); return new Response(JSON.stringify(payloads[path]));
  }) as typeof fetch });
  const result = await readOverview(client, now);
  assert.deepEqual(calls.sort(), Object.keys(payloads).sort());
  assert.deepEqual(result, { fetchedAt: readAt, collected: { status: 'ok', count: 2 }, products: { status: 'ok', count: 2, lastSuccessAt: firstAt },
    stores: { status: 'ok', count: 2, rows: [{ id: 'a', name: '店铺 A', productCount: 1, lastSuccessAt: firstAt, status: 'ok' }, { id: 'b', name: '店铺 B', productCount: 1, lastSuccessAt: secondAt, status: 'ok' }] } });
  assertJsonCompatible(result); assert.equal(JSON.stringify(result).includes(marker), false);
  assert.notEqual(result.fetchedAt, result.products.lastSuccessAt);
});

test('unavailable health never sends inventory requests and unknown counts remain null', async () => {
  let calls = 0, dataCalls = 0;
  const forbidden = async () => { dataCalls++; throw new Error('Data request must not be dispatched'); };
  const client = fixture({ health: async () => { calls++; return { status: 'unavailable' }; }, searchCollectedItems: forbidden, getStores: forbidden, getStoreProducts: forbidden });
  const result = await readOverview(client, now);
  assert.equal(calls, 1); assert.equal(dataCalls, 0); assert.equal(result.collected.count, null); assert.equal(result.products.count, null); assert.equal(result.stores.count, null);
  assert.equal(result.products.lastSuccessAt, null); assert.deepEqual(result.stores.rows, []);
});

test('a failed collection read does not erase independently known store and product counts', async () => {
  const result = await readOverview(fixture({ searchCollectedItems: async () => { throw new Error('synthetic-private-error'); } }), now);
  assert.deepEqual(result.collected, { status: 'unavailable', count: null });
  assert.equal(result.stores.count, 2); assert.equal(result.products.count, 2);
  assert.equal(JSON.stringify(result).includes('synthetic-private-error'), false);
});

test('never-synchronized empty shops stay unknown; a successful empty snapshot is a real zero', async () => {
  for (const [lastSuccessAt, expected] of [[undefined, null], [firstAt, 0]] as const) {
    const result = await readOverview(fixture({ searchCollectedItems: async () => ok([]), getStores: async () => ok([{ id: 'a', shopName: '店铺 A' }]),
      getStoreProducts: async () => ok({ stores: [{ id: 'a', lastSuccessAt }], products: [] }) }), now);
    assert.equal(result.collected.count, 0); assert.equal(result.stores.count, 1);
    assert.equal(result.products.count, expected); assert.equal(result.stores.rows[0].productCount, expected);
    assert.equal(result.products.status, expected === null ? 'unavailable' : 'ok');
  }
});

test('failed later synchronization preserves prior count and timestamps with a stale status, without leaking source error', async () => {
  const result = await readOverview(fixture({ getStoreProducts: async () => ok({
    stores: [{ id: 'a', lastSuccessAt: firstAt, lastAttemptAt: secondAt, error: 'synthetic-private-error' }, { id: 'b', lastSuccessAt: secondAt }],
    products: [{ storeId: 'a', offerId: 'x' }],
  }) }), now);
  assert.deepEqual(result.products, { count: 1, status: 'stale', lastSuccessAt: firstAt });
  assert.equal(result.stores.rows[0].status, 'stale'); assert.equal(result.stores.rows[0].productCount, 1);
  assert.equal(result.stores.rows[1].productCount, 0); assert.equal(JSON.stringify(result).includes('synthetic-private-error'), false);
});

test('partial store coverage cannot masquerade as an overall inventory total', async () => {
  const result = await readOverview(fixture({ getStoreProducts: async () => ok({ stores: [{ id: 'a', lastSuccessAt: firstAt }], products: [{ storeId: 'a', offerId: 'x' }] }) }), now);
  assert.deepEqual(result.products, { count: null, status: 'unavailable', lastSuccessAt: null });
  assert.equal(result.stores.rows[0].productCount, 1); assert.equal(result.stores.rows[1].productCount, null);
});

test('malformed collections, duplicate identities, and orphan inventory do not become plausible totals', async () => {
  const duplicate = await readOverview(fixture({ searchCollectedItems: async () => ok([{ id: 'same' }, { id: 'same' }]), getStores: async () => ok({ stores: [] }),
    getStoreProducts: async () => ok({ stores: [{ id: 'a', lastSuccessAt: firstAt }], products: [{ storeId: 'b', offerId: 'unknown-shop' }] }) }), now);
  assert.equal(duplicate.collected.count, null); assert.equal(duplicate.stores.count, null); assert.equal(duplicate.products.count, null);
  const invalidTime = await readOverview(fixture({ getStores: async () => ok([{ id: 'a', shopName: '店铺 A' }]),
    getStoreProducts: async () => ok({ stores: [{ id: 'a', lastSuccessAt: 'not-a-date' }], products: [] }) }), now);
  assert.equal(invalidTime.products.count, null); assert.equal(invalidTime.stores.rows[0].lastSuccessAt, null);
});

test('authenticated overview GET needs no active chat and cannot dispatch tools, synchronize, or save', async () => {
  const store = new AppStore(':memory:'); let overviewReads = 0, forbiddenCalls = 0;
  const forbidden = async () => { forbiddenCalls++; assert.fail('Overview must never dispatch Core or synchronization'); };
  const token = 'd'.repeat(64), headers = { authorization: `Bearer ${token}` };
  const server = createAppServer({ token, store, core: { invoke: forbidden, refreshDataset: forbidden, refreshDatasetBackground: forbidden },
    presentation: { getView: () => undefined, getViewData: () => undefined }, health: async () => ({}),
    overview: async () => { overviewReads++; return readOverview(fixture(), now); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(base + '/ui/overview')).status, 401);
    assert.equal((await fetch(base + '/ui/overview?sync=true', { headers })).status, 400);
    assert.equal((await fetch(base + '/ui/overview', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal(overviewReads, 0);
    const response = await fetch(base + '/ui/overview', { headers }); assert.equal(response.status, 200);
    assert.equal((await response.json()).products.count, 2); assert.equal(overviewReads, 1);
    assert.equal(forbiddenCalls, 0);
    for (const collection of ['components', 'entries', 'operations', 'session_apps', 'snapshots']) assert.deepEqual(store.list(collection), []);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); store.close(); }
});
