import test from 'node:test';
import assert from 'node:assert/strict';
import { HallmarkClient } from '../../packages/hallmark-adapter/client.ts';
import { TaskBroker } from '../../packages/hallmark-adapter/task-broker.ts';
import type { MappingStore } from '../../packages/hallmark-adapter/types.ts';

const input = { variants: [{ salesSkuId: 'sale-bundle', components: [{ sourceSkuId: 'source-sku', quantity: 2 }], spec: 'source-sku × 2' }], reason: 'Program sale composition' };
test('sales variant client uses the existing metadata route and preserves the actual composition', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = new HallmarkClient({ baseUrl: 'http://127.0.0.1:4173', fetchImpl: (async (url, init) => {
    calls.push({ url: String(url), init: init! });
    if (String(url).endsWith('/api/health')) return Response.json({ service: 'hallmark-board' });
    return Response.json({ taskId: 'task/id', created: true, salesVariants: input.variants, directContext: {} });
  }) as typeof fetch });
  const result = await client.registerTaskSalesVariants('task/id', input); assert.equal(result.status, 'ok');
  assert.equal(calls[1].url, 'http://127.0.0.1:4173/api/tasks/task%2Fid/sales-variants'); assert.equal(calls[1].init.method, 'POST'); assert.deepEqual(JSON.parse(String(calls[1].init.body)), input); assert.equal((calls[1].init.headers as any).Authorization, undefined);
});

test('lost registration response is unknown and the client never repeats its POST', async () => {
  let posts = 0;
  const client = new HallmarkClient({ fetchImpl: (async (url, init) => { if (String(url).endsWith('/api/health')) return Response.json({ service: 'hallmark-board' }); posts++; throw new Error('Connection dropped'); }) as typeof fetch });
  assert.equal((await client.registerTaskSalesVariants('task', input)).status, 'unknown'); assert.equal(posts, 1);
});

test('task broker recognizes source components after variant registration and unwraps cached task details', async () => {
  const records = new Map<string, unknown>();
  const store: MappingStore = { get: <T>(collection: string, id: string) => records.get(`${collection}/${id}`) as T | undefined, put: <T>(collection: string, id: string, value: T) => { records.set(`${collection}/${id}`, value); return value; } };
  const task = { id: 'task', kind: 'listing', status: 'submitted', storeId: 'bill', productId: 'source', salesVariants: input.variants };
  const generalTask = { id: 'general-task', kind: 'listing', status: 'listed', storeId: 'bill', productId: 'general-source' };
  let lists = 0;
  const client = { getTasks: async () => { lists++; return { status: 'ok', raw: [task, generalTask] }; }, getTask: async () => ({ status: 'ok', raw: { task: generalTask, platformCalls: [] } }) } as unknown as HallmarkClient;
  const broker = new TaskBroker(client, store);
  const listing = await broker.getListingTask({ storeId: 'bill', collectedItemId: 'source', skuScope: ['source-sku'] }); assert.equal(listing.status, 'ok'); assert.equal(listing.raw?.taskId, 'task');
  assert.equal((await broker.getStoreTask('bill')).raw?.taskId, 'general-task'); const before = lists; await broker.getStoreTask('bill'); assert.equal(lists, before, 'cached task envelope is usable without a full task scan');
});
