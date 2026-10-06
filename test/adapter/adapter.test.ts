import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HallmarkClient, PLATFORM_READ_ENDPOINTS, TaskBroker, requestId, validateLoopbackUrl } from '../../packages/hallmark-adapter/index.ts';
import type { HallmarkTask, MappingStore, PlatformCallInput, TaskAuditEvent } from '../../packages/hallmark-adapter/index.ts';
import { stores, products, summary, detail, task, rawItem, platformInput, platformRecord } from './fixtures.ts';

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
function mockClient(responder: (path: string, init: RequestInit) => Response | Promise<Response>, options: Record<string, unknown> = {}) {
  const requests: Array<{ path: string; init: RequestInit }> = [];
  const client = new HallmarkClient({ ...options, fetchImpl: (async (url, init = {}) => {
    const path = new URL(String(url)).pathname + new URL(String(url)).search;
    requests.push({ path, init });
    if (path === '/api/health') return json({ service: 'hallmark-control' });
    return responder(path, init);
  }) as typeof fetch });
  return { client, requests };
}
function memoryStore(): MappingStore {
  const values = new Map<string, unknown>();
  return { get<T>(collection: string, id: string): T | undefined { return values.get(collection + id) as T | undefined; }, put<T>(collection: string, id: string, value: T): T { values.set(collection + id, structuredClone(value)); return value; } };
}

test('literal loopback URL only, no alternate host, credentials, path or redirect destination', () => {
  assert.equal(validateLoopbackUrl('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
  assert.equal(validateLoopbackUrl('http://[::1]:4173'), 'http://[::1]:4173');
  for (const url of ['http://example.com', 'http://localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://127.0.0.1.example.com', 'http://192.168.0.1', 'file:///tmp/x', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/api', 'http://127.0.0.1/?token=secret']) assert.throws(() => new HallmarkClient({ baseUrl: url }));
});

test('all verified adapter routes keep synthetic raw fixtures untouched', async () => {
  const routes: Record<string, unknown> = {
    '/api/stores': stores, '/api/store-products': products, '/api/store-products/sync': products, '/api/store-products/analytics': products,
    '/api/target-margin': { settings: { revision: 1 } }, '/api/items': summary, '/api/items/item-A/raw?full=1': rawItem,
    '/api/items/item-A': detail, '/api/tasks': [task], '/api/tasks/task-A': task,
    '/api/tasks/task-A/context': { taskId: task.id, result: { state: 'unverified' } },
    '/api/tasks/task-A/verify': { taskId: task.id, result: { state: 'achieved' } },
    '/api/assignments': { ok: true, created: 1, reused: 0, taskIds: [task.id], tasks: [task] }, '/api/tasks/task-A/platform': platformRecord,
  };
  const { client, requests } = mockClient(path => { assert.ok(Object.hasOwn(routes, path), path); return json(routes[path]); }, { operatorToken: 'test-operator-token' });
  const calls: Array<[string, () => Promise<{ status: string; raw?: unknown }>]> = [
    ['/api/stores', () => client.getStores()], ['/api/store-products', () => client.getStoreProducts()], ['/api/store-products/sync', () => client.syncStoreProducts()],
    ['/api/store-products/analytics', () => client.getAnalytics({ dateFrom: '2026-10-01', dateTo: '2026-10-05' })],
    ['/api/target-margin', () => client.getTargetMargin()], ['/api/items', () => client.searchCollectedItems('采集')], ['/api/items/item-A/raw?full=1', () => client.getCollectedItem('item-A')],
    ['/api/items/item-A', () => client.getCollectedItemDetail('item-A')], ['/api/tasks', () => client.getTasks()], ['/api/tasks/task-A', () => client.getTask('task-A')],
    ['/api/tasks/task-A/context', () => client.getTaskContext('task-A')], ['/api/tasks/task-A/verify', () => client.verifyTask('task-A')],
    ['/api/assignments', () => client.createAssignment({ storeId: 'store-A', itemIds: ['item-A'] })], ['/api/tasks/task-A/platform', () => client.platformCall('task-A', platformInput)],
  ];
  for (const [path, invoke] of calls) {
    const result = await invoke(); assert.equal(result.status, 'ok', path); assert.deepEqual(result.raw, JSON.parse(JSON.stringify(routes[path])));
  }
  assert.equal(requests.filter(x => x.path === '/api/health').length, 1);
  for (const req of requests) assert.equal(req.init.redirect, 'error');
  assert.equal(new Headers(requests.find(x => x.path === '/api/assignments')?.init.headers).get('Authorization'), 'Bearer test-operator-token');
  assert.equal(requests.find(x => x.path === '/api/store-products/sync')?.init.body, '{}');
});

test('preserves raw search array, adds matches separately, and never invents collection time', async () => {
  const { client } = mockClient(() => json(summary));
  const result = await client.searchCollectedItems('not-found');
  assert.deepEqual(result.raw, summary); assert.deepEqual(result.matches, []);
  assert.equal(result.provenance?.dataTime, undefined);
});

test('operator token is injected and absent token never sends assignment', async () => {
  const { client, requests } = mockClient(() => { throw Error('must not send'); }, { operatorToken: () => undefined });
  const result = await client.createAssignment({ storeId: 's', itemIds: ['i'] });
  assert.equal(result.error?.code, 'HUMAN_AUTH_REQUIRED');
  assert.ok(requests.every(x => x.path === '/api/health'));
});

for (const status of [400, 404, 500, 503]) test(`HTTP ${status} normalized and raw error preserved`, async () => {
  const raw = { ok: false, code: 'SOURCE_ERROR', error: 'synthetic failure', future: true };
  const { client, requests } = mockClient(() => json(raw, status));
  const result = await client.getStores(); assert.deepEqual(result.raw, raw);
  assert.equal(result.status, status >= 500 ? 'unavailable' : 'failed'); assert.equal(result.error?.code, raw.code);
  assert.equal(requests.filter(x => x.path === '/api/stores').length, 1);
});

test('local rate limit read waits at most five seconds and retries once', async () => {
  let count = 0; const delays: number[] = [];
  const { client } = mockClient(() => ++count === 1 ? json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 25 }, 429) : json(stores), { sleep: async (ms: number) => { delays.push(ms); } });
  assert.equal((await client.getStores()).status, 'ok'); assert.equal(count, 2); assert.deepEqual(delays, [25]);
  const second = mockClient(() => json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 5001 }, 429));
  const result = await second.client.getStores(); assert.equal(result.status, 'unavailable'); assert.equal(result.error?.retryAfterMs, 5001);
  assert.equal(second.requests.length, 2);
});

test('platform write does not retry transport failures, 429 or unknown results', async () => {
  for (const fixture of [new Error('disconnect'), { ...platformRecord, outcome: 'outcome_unknown' }, { ...platformRecord, httpStatus: 429, retryAfter: '2' }]) {
    const { client, requests } = mockClient(() => { if (fixture instanceof Error) throw fixture; return json(fixture); });
    const result = await client.platformCall('task-A', { ...platformInput, path: '/v1/product/import/prices' });
    assert.equal(result.status, fixture instanceof Error || fixture.outcome === 'outcome_unknown' ? 'unknown' : 'unavailable');
    assert.equal(result.error?.retryable, false);
    assert.equal(requests.filter(x => x.path.endsWith('/platform')).length, 1);
  }
});

test('platform HTTP envelope is separate from upstream status; replay stays byte-equivalent', async () => {
  const raw = { ...platformRecord, replayed: true, replayWarning: 'historical' };
  const { client } = mockClient(() => json(raw));
  const result = await client.platformRead('task-A', platformInput);
  assert.deepEqual(result.raw, raw); assert.equal(result.status, 'ok');
  assert.equal(result.provenance?.dataTime, raw.startedAt); assert.equal(result.provenance?.source, 'ozon_api');
  const failed = mockClient(() => json({ ...platformRecord, httpStatus: 400 }));
  assert.equal((await failed.client.platformCall('task-A', platformInput)).error?.code, 'PLATFORM_ERROR');
});

test('missing or malformed platform outcome never implies successful write', async () => {
  for (const value of [{ accepted: true }, { ...platformRecord, httpStatus: undefined }, { ...platformRecord, outcome: 'pending' }]) {
    const { client } = mockClient(() => json(value));
    assert.equal((await client.platformCall('task-A', platformInput)).status, 'unknown');
  }
});

test('every read whitelist path checks exact method; writes blocked before health fetch', async () => {
  for (const [path, method] of Object.entries(PLATFORM_READ_ENDPOINTS)) {
    const { client } = mockClient(() => json({ ...platformRecord, path }));
    assert.equal((await client.platformRead('task-A', { ...platformInput, path, method, body: {} })).status, 'ok');
  }
  for (const input of [
    { path: '/v1/product/import/prices', method: 'POST' }, { path: '/v3/product/import', method: 'POST' },
    { path: '/v1/actions', method: 'POST' }, { path: '/v3/product/info/list', method: 'GET' },
    { path: '/v3/product/info/list/../import', method: 'POST' }, { path: '/v1/actions', method: 'GET', body: { unexpected: true } },
  ]) {
    const { client, requests } = mockClient(() => { throw Error('must not fetch'); });
    const result = await client.platformRead('task-A', { ...platformInput, body: {}, ...input } as PlatformCallInput);
    assert.equal(result.error?.code, 'ENDPOINT_NOT_ALLOWED'); assert.equal(requests.length, 0);
  }
});

test('read timeout and unavailable health settle without unhandled exceptions', async () => {
  const fetchImpl = (async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Error('timeout')), { once: true });
  })) as typeof fetch;
  const client = new HallmarkClient({ fetchImpl, healthTimeoutMs: 15 });
  const started = Date.now(); assert.equal((await client.getStores()).status, 'unavailable'); assert.ok(Date.now() - started < 2000);
  const result = await client.getStoreProducts(); assert.equal(result.status, 'unavailable');
});

test('large raw spills losslessly while provenance and raw stay accessible internally', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hallmark-adapter-test-'));
  try {
    const raw = [{ id: 'large', raw: 'x'.repeat(2000) }];
    const { client } = mockClient(() => json(raw), { spillDirectory: dir, spillThresholdBytes: 100 });
    const result = await client.getStores(); assert.deepEqual(result.raw, raw); assert.ok(result.spill);
    assert.deepEqual(JSON.parse(await readFile(result.spill.path, 'utf8')), raw); assert.equal(result.spill.summary.count, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('store broker reuses and revalidates task; never creates random assignments', async () => {
  const audit: TaskAuditEvent[] = [];
  const { client, requests } = mockClient(path => path === '/api/tasks' ? json([task]) : path === '/api/tasks/task-A' ? json(task) : assert.fail(path));
  const broker = new TaskBroker(client, memoryStore(), { audit: event => { audit.push(event); } });
  const first = await broker.getStoreTask('store-A'); const second = await broker.getStoreTask('store-A');
  assert.equal(first.raw?.taskId, task.id); assert.equal(second.raw?.taskId, task.id); assert.equal(audit.length, 1);
  assert.ok(requests.every(x => x.init.method === 'GET'));
  const empty = mockClient(() => json([]));
  assert.equal((await new TaskBroker(empty.client, memoryStore()).getStoreTask('store-A')).error?.code, 'TASK_CONTEXT_REQUIRED');
  assert.ok(empty.requests.every(x => x.init.method === 'GET'));
});

test('cancelled mapped store task is replaced only with an existing usable task', async () => {
  const store = memoryStore(); let current: HallmarkTask = { ...task };
  const { client } = mockClient(path => path === '/api/tasks' ? json([current]) : json(current));
  const broker = new TaskBroker(client, store);
  assert.equal((await broker.getStoreTask('store-A')).raw?.taskId, task.id);
  current = { ...task, status: 'cancelled' };
  assert.equal((await broker.getStoreTask('store-A')).error?.code, 'TASK_CONTEXT_REQUIRED');
});

test('explicit listing scope deduplicates; invalid source and SKU never prepare assignment', async () => {
  let tasks: HallmarkTask[] = []; let assignments = 0;
  const { client } = mockClient(path => {
    if (path === '/api/tasks') return json(tasks);
    if (path === '/api/items/item-A') return json(detail);
    if (path === '/api/assignments') { assignments++; tasks = [task]; return json({ ok: true, created: 1, reused: 0, tasks, taskIds: [task.id] }); }
    return assert.fail(path);
  }, { operatorToken: 'synthetic-token' });
  const broker = new TaskBroker(client, memoryStore());
  assert.equal((await broker.getListingTask({ storeId: 'store-A', collectedItemId: 'item-A', skuScope: [] })).error?.code, 'MISSING_PARAM');
  assert.equal((await broker.getListingTask({ storeId: 'store-A', collectedItemId: 'item-A', skuScope: ['bad'] })).error?.code, 'SKU_SCOPE_MISMATCH');
  assert.equal(assignments, 0);
  const input = { storeId: 'store-A', collectedItemId: 'item-A', skuScope: ['sku-A'] };
  const [first, parallel] = await Promise.all([broker.getListingTask(input), broker.getListingTask(input)]);
  assert.equal(first.raw?.taskId, task.id); assert.deepEqual(parallel.raw?.skuScope, ['sku-A']);
  assert.equal((await broker.getListingTask(input)).raw?.reused, true); assert.equal(assignments, 1);
  assert.equal((await broker.getListingTask({ ...input, skuScope: ['not-in-frozen-scope'] })).error?.code, 'SKU_SCOPE_MISMATCH');
});

test('listing detail prefix resolution cannot accidentally prepare a different item', async () => {
  const { client, requests } = mockClient(path => path === '/api/tasks' ? json([]) : json(detail));
  const result = await new TaskBroker(client, memoryStore()).getListingTask({ storeId: 'store-A', collectedItemId: 'item', skuScope: ['sku-A'] });
  assert.equal(result.error?.code, 'ITEM_AMBIGUOUS'); assert.ok(requests.every(x => x.init.method === 'GET'));
});

test('request IDs stable across restart, distinct over sequence and full identities', () => {
  const id = requestId('update_price', 'operation-long-identifier', 1);
  assert.match(id, /^[A-Za-z0-9_-]{1,100}$/);
  assert.equal(id, requestId('update_price', 'operation-long-identifier', 1));
  assert.notEqual(id, requestId('update_price', 'operation-long-identifier', 2));
  assert.notEqual(requestId('read', 'same-prefix-1'), requestId('read', 'same-prefix-2'));
  assert.throws(() => requestId('x', 'id', -1));
});
