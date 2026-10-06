import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { randomUUID, randomInt } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import assert from 'node:assert/strict';
import { AppStore } from '../../packages/store/index.ts';
import { HallmarkClient, TaskBroker, PLATFORM_READ_ENDPOINTS } from '../../packages/hallmark-adapter/index.ts';
import { AppCore } from '../../packages/core/src/index.ts';
import { PresentationManager } from '../../packages/presentation/src/index.ts';
import { createAppServer } from '../../packages/service/src/server.ts';

export const TOKEN = 'e'.repeat(64);
export const SOURCE_IMAGE = 'https://example.invalid/collected-image.jpg';
export const SOURCE_TIME = '2026-10-05T00:00:00.000Z';
export interface HttpEvent { method: string; path: string; body?: any }
export interface FakeState {
  events: HttpEvent[]; fixtureErrors: string[]; platformWrites: any[]; platformReads: any[]; assignments: number;
  price: number; stock: number; currency: string | null; writeUnknown: boolean; applyUnknownWrite: boolean;
  importStatus: 'imported' | 'pending'; sourceTime: string | null; syncError: boolean;
  rawContent: string; summaries: any[]; tasks: any[]; products: any[];
}
async function readBody(req: IncomingMessage): Promise<any> { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; }
function send(res: ServerResponse, value: any, status = 200): void { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); }
async function listening(server: Server): Promise<string> {
  // Windows port 0 can allocate sequential low ports, including fetch's WHATWG blocked ports.
  for (let attempt = 0; attempt < 20; attempt++) {
    server.listen(randomInt(20000, 60000), '127.0.0.1');
    try { await once(server, 'listening'); }
    catch (error) { if (['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) continue; throw error; }
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }
  throw new Error('No fetch-compatible random high loopback port available');
}
async function closeServer(server: Server): Promise<void> { if (!server.listening) return; server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); }

/** A synthetic source with its own ephemeral loopback socket; no original project code is imported. */
function fakeHallmark(state: FakeState): Server {
  const replay = new Map<string, { input: string; result: any }>();
  const snapshot = () => ({ stores: [{ id: 'store-A', name: 'Alpha', platform: 'ozon', ...(state.sourceTime ? { lastSuccessAt: state.sourceTime } : {}), ...(state.syncError ? { error: 'synthetic sync failed' } : {}) }], products: state.products });
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1'); const path = url.pathname;
      const body = await readBody(req); state.events.push({ method: req.method!, path, ...(body !== undefined ? { body } : {}) });
      if (path === '/api/health') return send(res, { service: 'hallmark-control', capabilities: ['assignment-v1'] });
      if (path === '/api/stores') return send(res, [{ id: 'store-A', shopName: 'Alpha', platform: 'ozon', authStatus: 'authorized', hasCredential: true }, { id: 'store-B', shopName: 'Alpine', platform: 'ozon', authStatus: 'authorized', hasCredential: true }]);
      if (path === '/api/store-products' || path === '/api/store-products/sync') return send(res, snapshot());
      if (path === '/api/items') return send(res, state.summaries);
      if (path === '/api/items/item-A/raw') {
        assert.equal(url.searchParams.get('full'), '1', 'raw access must be complete');
        return send(res, { id: 'item-A', content: state.rawContent, truncated: false });
      }
      if (path === '/api/items/item-A') return send(res, { id: 'item-A', title: 'Source A', skus: [{ sourceSkuId: 'sku-A', code: 'sku-A', image: SOURCE_IMAGE }], images: [SOURCE_IMAGE], descriptionImages: [], attributes: { sourceFeature: '真实源特征' }, sourceUrl: 'https://example.invalid/source-A' });
      if (path === '/api/tasks') return send(res, state.tasks);
      if (path === '/api/assignments') {
        assert.equal(req.headers.authorization, 'Bearer synthetic-operator');
        assert.deepEqual(body.itemIds, ['item-A']); assert.equal(body.storeId, 'store-A');
        const current = state.tasks.find(t => t.productId === 'item-A' && t.storeId === 'store-A');
        if (current) return send(res, { ok: true, created: 0, reused: 1, taskIds: [current.id], tasks: [current] });
        state.assignments++; const task = { id: 'listing-new', kind: 'listing', status: 'submitted', storeId: 'store-A', productId: 'item-A', assignmentSnapshot: { item: { skuCodes: ['sku-A'] } } };
        state.tasks.push(task); return send(res, { ok: true, created: 1, reused: 0, taskIds: [task.id], tasks: [task] });
      }
      const platform = path.match(/^\/api\/tasks\/([^/]+)\/platform$/);
      if (platform) {
        const taskId = platform[1]; const task = state.tasks.find(t => t.id === taskId);
        if (!task) return send(res, { code: 'TASK_NOT_FOUND', error: 'task missing' }, 404);
        const key = `${taskId}:${body.requestId}`; const input = JSON.stringify(body); const prior = replay.get(key);
        if (prior) return prior.input === input ? send(res, { ...prior.result, replayed: true }) : send(res, { code: 'PLATFORM_REQUEST_ID_REUSED', error: 'identity mismatch' }, 400);
        const isRead = PLATFORM_READ_ENDPOINTS[body.path] === (body.method ?? 'POST');
        if (isRead) state.platformReads.push(body); else state.platformWrites.push(body);
        let payload: any = { result: [] };
        if (body.path === '/v1/product/import/prices') { if (!state.writeUnknown || state.applyUnknownWrite) state.price = Number(body.body.prices[0].price); payload = { result: [{ offer_id: body.body.prices[0].offer_id, updated: true, errors: [] }] }; }
        else if (body.path === '/v2/products/stocks') { if (!state.writeUnknown || state.applyUnknownWrite) state.stock = Number(body.body.stocks[0].stock); payload = { result: [{ updated: true, errors: [] }] }; }
        else if (body.path === '/v5/product/info/prices') payload = { result: { items: [{ offer_id: 'offer-A', product_id: 1, price: { price: String(state.price), ...(state.currency ? { currency_code: state.currency } : {}) } }] } };
        else if (body.path === '/v3/product/info/list') payload = { items: [{ id: 1, offer_id: 'offer-A', sku: 33, price: String(state.price), stock: state.stock }] };
        else if (body.path === '/v2/product/info/stocks-by-warehouse/fbs') { assert.deepEqual(body.body, { sku: [33], limit: 100 }); payload = { result: [{ offer_id: 'offer-A', sku: 33, warehouse_id: 12, present: state.stock }] }; }
        else if (body.path === '/v3/product/import') payload = { result: { task_id: 987 } };
        else if (body.path === '/v1/product/import/info') { assert.equal(body.body.task_id, 987); payload = { result: { items: [{ offer_id: 'listed-A', product_id: 22, status: state.importStatus, errors: [] }] } }; }
        else if (body.path === '/v1/actions') payload = { result: [] };
        else assert.fail(`Unknown synthetic endpoint ${body.path}`);
        const result = { ...body, taskId, storeId: task.storeId, requestHash: 'synthetic-hash', startedAt: SOURCE_TIME, finishedAt: SOURCE_TIME,
          outcome: !isRead && state.writeUnknown ? 'outcome_unknown' : 'response_received',
          ...(!isRead && state.writeUnknown ? { error: 'synthetic connection lost' } : { httpStatus: 200, response: payload }) };
        replay.set(key, { input, result }); return send(res, result);
      }
      const task = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (task) { const value = state.tasks.find(t => t.id === task[1]); return value ? send(res, value) : send(res, { code: 'TASK_NOT_FOUND', error: 'missing' }, 404); }
      send(res, { code: 'NOT_FOUND', error: path }, 404);
    } catch (error) { const message = error instanceof Error ? error.message : String(error); state.fixtureErrors.push(message); send(res, { code: 'FIXTURE_ERROR', error: message }, 500); }
  });
}
export async function setup(options: { spillThresholdBytes?: number; sourceTime?: string | null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'hallmark-integration-'));
  const state: FakeState = {
    events: [], fixtureErrors: [], platformWrites: [], platformReads: [], assignments: 0, price: 50, stock: 5, currency: 'RUB', writeUnknown: false, applyUnknownWrite: false,
    importStatus: 'imported', sourceTime: options.sourceTime === undefined ? SOURCE_TIME : options.sourceTime, syncError: false,
    rawContent: JSON.stringify({ title: '原始采集', nested: { futureField: '全字段原样' }, skus: [{ id: 'sku-A', image: SOURCE_IMAGE }] }),
    summaries: [{ id: 'item-A', title: 'Source A', skuCount: 1, mainImage: SOURCE_IMAGE }, { id: 'item-B', title: 'Completely different B', skuCount: 1 }],
    tasks: [{ id: 'task-existing', kind: 'listing', status: 'listed', storeId: 'store-A', productId: 'existing-item' }],
    products: Array.from({ length: 260 }, (_, i) => ({ storeId: 'store-A', offerId: i === 0 ? 'offer-A' : `offer-${i}`, productId: i + 1, title: `产品-${i}`, price: '50', stock: 5, profit: { actualMargin: i === 1 ? null : 0.1, costMinor: i === 1 ? null : 4500, profitMinor: i === 1 ? null : 500, reason: i === 1 ? '缺采购价' : null }, untouchedFuture: { index: i } })),
  };
  state.products.push({ storeId: 'store-B', offerId: 'other-offer', untouchedFuture: true });
  const sourceServer = fakeHallmark(state); const sourceBase = await listening(sourceServer);
  let store!: AppStore; let core!: AppCore; let presentation!: PresentationManager; let server!: Server; let base = '';
  const client = new HallmarkClient({ baseUrl: sourceBase, operatorToken: 'synthetic-operator', spillDirectory: join(directory, 'spill'), spillThresholdBytes: options.spillThresholdBytes ?? 1024 * 1024 });
  async function boot() {
    store = new AppStore(join(directory, 'app.db')); presentation = new PresentationManager(store);
    const broker = new TaskBroker(client, store, { audit(event) { const id = randomUUID(); store.put('operations', id, { operationId: id, kind: event.kind, sessionId: null, storeId: event.storeId, targets: event.skuScope ?? [], input: event, state: 'succeeded', hallmarkRefs: [{ taskId: event.taskId }], createdAt: event.at, updatedAt: event.at }); } });
    core = new AppCore({ store, client, broker, presentation });
    server = createAppServer({ token: TOKEN, core, store, presentation, health: () => client.health() }); base = await listening(server);
  }
  try { await boot(); } catch (error) { await closeServer(sourceServer); store?.close(); assert.ok(basename(directory).startsWith('hallmark-integration-')); await rm(directory, { recursive: true, force: true }); throw error; }
  return {
    state, sourceBase, directory, client,
    get store() { return store; }, get core() { return core; }, get base() { return base; },
    async request(path: string, body?: any, sessionId = 'session-main', extra: Record<string, string> = {}) {
      const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${TOKEN}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { httpStatus: res.status, body: await res.json() as any };
    },
    async activate(sessionId = 'session-main', active = true) { const res = await this.request(`/sessions/${sessionId}/app`, { active }); assert.equal(res.httpStatus, 200); return res.body; },
    async tool(name: string, args: any = {}, userRequest?: string, sessionId = 'session-main') {
      const res = await this.request(`/tools/${name}`, { sessionId, arguments: args, ...(userRequest ? { userRequest } : {}) });
      assert.equal(res.httpStatus, 200, `${name}: ${JSON.stringify(res.body)}`); return res.body;
    },
    async restart() { await closeServer(server); await core.waitForIdle(); store.close(); await boot(); await core.recoverOperations(); },
    async close() { await closeServer(server); await core.waitForIdle(); store.close(); await closeServer(sourceServer); assert.ok(basename(directory).startsWith('hallmark-integration-')); assert.equal(resolve(directory), directory); await rm(directory, { recursive: true, force: true }); assert.deepEqual(state.fixtureErrors, [], 'synthetic source assertions must not masquerade as product unknown outcomes'); },
  };
}
export const PRICE_REQUEST = '把 Alpha 的 offer-A 普通售价设为 100 RUB';
export const priceArgs = { storeId: 'store-A', offerIds: ['offer-A'], price: 100, currency: 'RUB', valueSource: 'user', clientOperationKey: 'price-key', userRequest: PRICE_REQUEST };
export const LISTING_REQUEST = '把 Alpha 的采集 item-A 的 sku-A 上品，按我明确提供的 Ozon 类目、属性、价和源图片字段';
export const importItem = { _sourceSkuId: 'sku-A', offer_id: 'listed-A', description_category_id: 100, type_id: 200, name: '用户指定品名', currency_code: 'RUB', price: '100', depth: 1, height: 1, width: 1, weight: 1, dimension_unit: 'mm', weight_unit: 'g', images: [SOURCE_IMAGE], attributes: [{ id: 1, values: [{ value: '用户明确值' }] }] };
export const listingArgs = { storeId: 'store-A', collectedItemId: 'item-A', skuScope: ['sku-A'], importItems: [importItem], valueSource: 'user', clientOperationKey: 'listing-key', userRequest: LISTING_REQUEST };
