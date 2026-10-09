import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { AppsRuntime, RuntimeStore } from '../../packages/app-runtime/src/index.ts';
import { HallmarkProvider, HallmarkStorePort, LEGACY_TOOL_MAP, HALLMARK_API_OPERATIONS, HALLMARK_DESCRIPTORS } from '../../packages/app-hallmark/src/index.ts';
import { AppsClient, HttpRuntimeTransport, generateArtifacts } from '../../packages/app-sdk/src/index.ts';
import { HallmarkClient, TaskBroker } from '../../packages/hallmark-adapter/index.ts';
import { AppsPresentationService } from '../../packages/app-presentation/src/index.ts';
import { SourceComponentStore } from '../../packages/source-components/src/index.ts';
import { createAppsServer } from '../../packages/service/src/apps-server.ts';
import { TOOL_DEFINITIONS, validate } from '../../packages/contracts/src/index.ts';
import { compileSchema, validateResult } from '../../packages/app-contracts/src/index.ts';
import type { AppProvider, InvocationRequest } from '../../packages/app-contracts/src/index.ts';
import type { InvocationRecord } from '../../packages/app-runtime/src/store.ts';

type Data = Record<string, any>;
function sourceEvidence(result: Data, source: string, endpoint: string, storeId?: string, dataTime?: string): void {
  assert.equal(result.provenance.source, source); assert.equal(result.provenance.endpoint, endpoint); assert.equal(result.provenance.storeId, storeId); assert.equal(result.provenance.dataTime, dataTime); assert.ok(Number.isFinite(Date.parse(result.provenance.fetchedAt)));
}
const token = 'r'.repeat(64), sourceAt = '2026-10-04T00:00:00Z';
const originalProducts = [
  { storeId: 's', offerId: 'A', productId: 1, price: 100, stock: 2, profit: { costMinor: 5000, profitMinor: 1000, actualMargin: 0.1 }, unknownSourceField: { foo: 'preserved' } },
  { storeId: 's', offerId: 'B', productId: 2, price: 200, stock: 0, profit: { costMinor: null, actualMargin: 0 } },
  { storeId: 'other', offerId: 'C', productId: 3, price: 1, stock: 0, profit: { costMinor: 1, actualMargin: 0.05 } },
];
const rawItem = { id: 'item', content: '{"original":"raw source"}', truncated: false, originalSourceField: 'preserved' };
const categoryRaw = { storeId: 's', partial: true, stale: true, fetchedAt: sourceAt, candidates: [{ descriptionCategoryId: '100', verified: false }], originalSourceField: { preserved: true } };
const image = 'https://example.invalid/source.jpg';
const importItem = { _sourceSkuId: 'sku1', offer_id: 'new-offer', description_category_id: 100, type_id: 200, name: 'Source product', currency_code: 'RUB', price: '100', depth: 1, height: 1, width: 1, weight: 1, dimension_unit: 'mm', weight_unit: 'g', images: [image], attributes: [{ id: 1, values: [{ value: 'Specified source value' }] }] };
const evidence: Data = { kind: 'loopback_business_http_fixture', executedAt: '', aliases: [], rejectionRules: [], baselineReferences: ['test/core/core.test.ts', 'test/core/category.test.ts', 'test/core/collected-snapshot.test.ts', 'test/core/session-views.test.ts', 'test/apps-components/legacy.test.ts'], realBusinessMutation: 'NOT_RUN' };
after(() => {
  evidence.executedAt = new Date().toISOString(); evidence.nodeVersion = process.version;
  evidence.aliasReplayStatus = evidence.aliases.length === 26 && evidence.unknownRecovery && evidence.sessionSummary && evidence.requiredWriteClarifications && evidence.topLevelContext && evidence.resultSetRendering && evidence.sessionIntentAndSaveRules && evidence.registeredApiMutation ? 'PASS' : 'INCOMPLETE';
  const root = process.env.APPS_LEGACY_REPLAY_EVIDENCE_DIR;
  if (root) { mkdirSync(resolve(root), { recursive: true }); writeFileSync(join(resolve(root), 'legacy-replay.json'), JSON.stringify(evidence, null, 2)); }
  const apiRoot = process.env.APPS_RAW_API_EVIDENCE_DIR;
  if (apiRoot) { mkdirSync(resolve(apiRoot), { recursive: true }); writeFileSync(join(resolve(apiRoot), 'registered-mutation.json'), JSON.stringify({ kind: evidence.kind, executedAt: evidence.executedAt, nodeVersion: evidence.nodeVersion, status: evidence.registeredApiMutation ? 'PASS' : 'INCOMPLETE', realBusinessMutation: evidence.realBusinessMutation, ...evidence.registeredApiMutation }, null, 2)); }
});
async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PORT_REQUIRED'); return `http://127.0.0.1:${address.port}`;
}
async function close(server: ReturnType<typeof createServer>): Promise<void> { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }

async function fixture(options: { deferHallmarkRegistration?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-legacy-replay-')), httpCalls: Data[] = [], executions = new Map<string, number>();
  let price = 100, stock = 2, unknownPrice = false;
  const task = { id: 'task', kind: 'listing', storeId: 's', status: 'active', productId: 'item', salesVariants: [{ salesSkuId: 'sku1' }] };
  const upstream = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1'), chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(chunk); const text = Buffer.concat(chunks).toString(); const input: Data = text ? JSON.parse(text) : {};
      httpCalls.push({ route: url.pathname, method: req.method, ...(text ? { input } : {}) });
      const send = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
      if (url.pathname === '/api/health') return send({ service: 'hallmark-control' });
      if (url.pathname === '/api/stores') return send([{ id: 's', shopName: 'Alpha', originalStoreField: 'preserved' }, { id: 'other', shopName: 'Alpine' }]);
      if (url.pathname === '/api/store-products' || url.pathname === '/api/store-products/sync') return send({ stores: [{ id: 's', lastSuccessAt: sourceAt }, { id: 'other', lastSuccessAt: sourceAt }], products: originalProducts });
      if (url.pathname === '/api/target-margin') return send({ targetMargin: 0.2 });
      if (url.pathname === '/api/items') return send([{ id: 'item', title: 'Existing Source item', skuCount: 1, originalSummaryField: 'preserved' }, { id: 'other-item', title: 'Another item', skuCount: 1 }]);
      if (url.pathname === '/api/items/item/raw') { assert.equal(url.searchParams.get('full'), '1'); return send(rawItem); }
      if (url.pathname === '/api/items/item') return send({ id: 'item', skus: [{ sourceSkuId: 'sku1', image }], images: [image] });
      if (url.pathname === '/api/catalog/search') { assert.equal(url.searchParams.get('storeId'), 's'); assert.equal(url.searchParams.get('q'), 'lamp'); return send(categoryRaw); }
      if (url.pathname === '/api/tasks') return send([task]);
      if (url.pathname === '/api/tasks/task') return send(task);
      if (url.pathname === '/api/tasks/task/platform') {
        let payload: unknown;
        if (input.path === '/v1/product/import/prices') { price = unknownPrice ? 50 : Number(input.body.prices[0].price); payload = { result: [{ updated: true }] }; }
        else if (input.path === '/v2/products/stocks') { stock = Number(input.body.stocks[0].stock); payload = { result: [{ updated: true }] }; }
        else if (input.path === '/v3/product/import') payload = { result: { task_id: 99 } };
        else if (input.path === '/v5/product/info/prices') payload = { result: { items: [{ offer_id: 'A', product_id: 1, price: { price: String(price), currency_code: 'RUB' } }] } };
        else if (input.path === '/v3/product/info/list') payload = { result: { items: [{ offer_id: 'A', id: 1, sku: 501 }] } };
        else if (input.path === '/v2/product/info/stocks-by-warehouse/fbs') payload = { result: { items: [{ offer_id: 'A', sku: 501, warehouse_id: 1, present: stock }] } };
        else if (input.path === '/v1/product/import/info') payload = { result: { items: [{ offer_id: 'new-offer', product_id: 22, status: 'imported', errors: [] }] } };
        else if (input.path === '/v2/warehouse/list') payload = { result: [{ warehouse_id: 1, name: 'Fixture warehouse' }] };
        else return send({ error: 'Unregistered fixture platform path' }, 500);
        const raw = { requestId: input.requestId, taskId: 'task', storeId: 's', path: input.path, method: input.method, body: input.body, agentId: input.agentId, ...(input.note ? { note: input.note } : {}), startedAt: sourceAt, outcome: unknownPrice && input.path === '/v1/product/import/prices' ? 'outcome_unknown' : 'response_received', httpStatus: 200, response: payload, originalBackendEvidence: { retained: true } };
        httpCalls.at(-1)!.rawResponse = raw; return send(raw);
      }
      send({ error: 'Unregistered fixture route' }, 404);
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
  });
  const backend = await listen(upstream), store = new RuntimeStore(join(directory, 'apps.db')), runtime = new AppsRuntime(store), port = new HallmarkStorePort(store, 'h');
  const client = new HallmarkClient({ baseUrl: backend, operatorToken: 'fixture-operator', spillDirectory: join(directory, 'spill') });
  const provider = new HallmarkProvider({ store: port, client, broker: new TaskBroker(client, port) });
  function counted(value: AppProvider): AppProvider { return { ...value, manifest: value.manifest, descriptors: value.descriptors, execute: context => { executions.set(context.request.capabilityId, (executions.get(context.request.capabilityId) ?? 0) + 1); return value.execute(context); }, ...(value.inspect ? { inspect: value.inspect.bind(value) } : {}), dispose: value.dispose.bind(value) }; }
  const registerHallmark = () => {
    runtime.register(counted(provider));
    runtime.addConnection({ appId: 'hallmark', connectionId: 'h', displayName: 'Hallmark fixture', config: { baseUrl: backend }, configRevision: 1, enabled: true });
    runtime.bind({ sessionId: 'session', appId: 'hallmark', connectionId: 'h', enabled: true, boundAt: new Date().toISOString() });
    store.put('legacy_aliases', 'connection:default', { appId: 'hallmark', connectionId: 'h', status: 'resolved' });
  };
  if (!options.deferHallmarkRegistration) registerHallmark();
  const sources = new SourceComponentStore(join(directory, 'source-components')), presentation = new AppsPresentationService({ store, runtime, sources }); runtime.register(counted(presentation.provider()));
  runtime.addConnection({ appId: 'apps', connectionId: 'presentation', displayName: 'Apps', config: {}, configRevision: 1, enabled: true }); runtime.bind({ sessionId: 'session', appId: 'apps', connectionId: 'presentation', enabled: true, boundAt: new Date().toISOString() });
  const service = createAppsServer({ runtime, presentation, token }), address = await listen(service);
  const call = async (path: string, input: unknown): Promise<Data> => { const result = await fetch(new URL(path, address), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); assert.equal(result.status, 200); return await result.json() as Data; };
  const legacy = (name: string, input: Data, invocationId: string, userRequest?: string, sessionId = 'session') => call('/v1/legacy-invocations', { name, arguments: input, sessionId, invocationId, traceId: `trace:${invocationId}`, deadlineAt: new Date(Date.now() + 10000).toISOString(), ...(userRequest === undefined ? {} : { userRequest }) });
  const platform = () => httpCalls.filter(row => row.route === '/api/tasks/task/platform');
  const mutations = () => platform().filter(row => ['/v1/product/import/prices', '/v2/products/stocks', '/v3/product/import'].includes(row.input.path));
  const cleanup = async () => { await close(service); await runtime.dispose(); store.close(); await close(upstream); const path = resolve(directory); assert.ok(path.startsWith(resolve(tmpdir()) + sep) && path.includes('dsh-legacy-replay-')); rmSync(path, { recursive: true, force: true }); };
  return { directory, address, registerHallmark, store, runtime, provider, port, presentation, sources, client, executions, httpCalls, legacy, call, platform, mutations, setUnknownPrice: () => { unknownPrice = true; }, confirmPrice: () => { unknownPrice = false; price = 100; }, cleanup };
}

test('all 26 legacy aliases replay valid inputs through schemas, HTTP, Runtime and concrete Providers once', async () => {
  const f = await fixture(), state: Data = {};
  const project = join(f.directory, 'project'); mkdirSync(join(project, 'dist'), { recursive: true }); writeFileSync(join(project, 'package-lock.json'), '{}'); writeFileSync(join(project, 'Component.tsx'), 'export default () => "fixture source";'); writeFileSync(join(project, 'dist', 'index.html'), '<div>Fixture component</div>');
  const inputs: Record<string, () => Data> = {
    hallmark_app_info: () => ({}), hallmark_list_stores: () => ({}), hallmark_resolve_store: () => ({ query: 'Alpha' }), hallmark_list_store_products: () => ({ storeId: 's' }),
    hallmark_get_platform_data: () => ({ storeId: 's', path: '/v2/warehouse/list', method: 'POST', body: {} }), hallmark_search_collected_items: () => ({ query: 'Existing', limit: 1 }), hallmark_get_collected_item: () => ({ itemId: 'item' }),
    hallmark_get_category_data: () => ({ storeId: 's', mode: 'search', q: 'lamp', limit: 10 }), hallmark_get_data_status: () => ({ datasetKey: 'store_products:s' }), hallmark_compute_profit: () => ({ storeId: 's' }), hallmark_filter_products: () => ({ storeId: 's', maxMargin: 0.15 }),
    hallmark_update_price: () => ({ storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', clientOperationKey: 'price-replay', userRequest: '把 A 的价格设为 100 RUB' }),
    hallmark_update_stock: () => ({ storeId: 's', offerIds: ['A'], stock: 0, warehouseId: '1', valueSource: 'user', clientOperationKey: 'stock-replay', userRequest: '把 A 在仓库 1 的库存设为 0' }),
    hallmark_list_product: () => ({ storeId: 's', collectedItemId: 'item', skuScope: ['sku1'], importItems: [importItem], valueSource: 'user', clientOperationKey: 'listing-replay', userRequest: '把 item 的 sku1 上品到 Alpha，使用已提供的类目与素材字段' }),
    hallmark_get_operation: () => ({ operationId: state.priceOperationId }), hallmark_list_operations: () => ({ storeId: 's' }), hallmark_refresh_data: () => ({ datasetKey: 'store_products:s' }),
    hallmark_render_view: () => ({ spec: { id: 'legacy-input-id', title: 'Replay view', layout: { type: 'column', children: ['text'] }, widgets: [{ id: 'text', type: 'text', text: 'Source fields' }], bindings: [] } }),
    hallmark_update_view: () => ({ viewId: state.viewId, patch: [{ op: 'replace', path: '/title', value: 'Patched replay' }] }), hallmark_open_component: () => ({ componentId: state.componentId }), hallmark_open_source_component: () => ({ directory: project }),
    hallmark_save_component: () => ({ viewId: state.viewId, userRequest: '保存此组件' }), hallmark_save_entry: () => ({ title: 'Product entry', binding: { id: 'products', query: { tool: 'hallmark_list_store_products', params: { storeId: 's' } }, fieldMap: { name: 'offerId' } }, userRequest: '保存数据入口' }),
    hallmark_save_template: () => ({ viewId: state.viewId, name: 'Reusable replay', userRequest: '保存设计模板' }), hallmark_list_saved: () => ({}), hallmark_manage_saved: () => ({ kind: 'component', id: state.componentId, action: 'rename', name: 'Renamed replay' }),
  };
  // The original declaration order opens a saved component before saving; execute its dependency first.
  const ordered = [...LEGACY_TOOL_MAP.filter(row => row.owner !== 'presentation'), ...['hallmark_render_view', 'hallmark_update_view', 'hallmark_save_component', 'hallmark_open_component', 'hallmark_open_source_component', 'hallmark_save_entry', 'hallmark_save_template', 'hallmark_list_saved', 'hallmark_manage_saved'].map(name => LEGACY_TOOL_MAP.find(row => row.legacyName === name)!)];
  try {
    for (const mapping of ordered) {
      const args = inputs[mapping.legacyName](), definition = TOOL_DEFINITIONS.find(row => row.name === mapping.legacyName)!, descriptor = f.runtime.describe(mapping.legacyName)!;
      assert.equal(descriptor.capabilityId, mapping.capabilityId); assert.deepEqual(validate(definition.parameters, args), []);
      const before = f.executions.get(mapping.capabilityId) ?? 0, httpBefore = f.httpCalls.length, attempt = `valid:${mapping.legacyName}`, result = await f.legacy(mapping.legacyName, args, attempt);
      assert.equal(result.status, 'ok', `${mapping.legacyName}: ${JSON.stringify(result)}`); assert.equal(f.executions.get(mapping.capabilityId), before + 1);
      const invocation = f.store.get<InvocationRecord>('invocations', attempt)!; assert.ok(invocation); assert.equal(invocation.request.capabilityId, mapping.capabilityId); assert.equal(invocation.request.capabilityVersion, mapping.version); assert.deepEqual(compileSchema(descriptor.inputSchema)(invocation.request.input), []); assert.deepEqual(validateResult(invocation.result!, descriptor), []);
      const data = result.data;
      switch (mapping.legacyName) {
        case 'hallmark_app_info': assert.deepEqual(data.tools, TOOL_DEFINITIONS.map(({ name, kind }) => ({ name, kind }))); assert.deepEqual(data.sessionComponents, []); assert.equal(data.boundaries.localCapabilitiesAvailableOffline, true); assert.deepEqual(data.boundaries.notCovered, ['活动价/活动报名管理', '商品归档', '采购成本修改', '原四工具 WorkPlan/素材交付链路', '命名规则定义解析及自动数值应用']); assert.match(data.boundaries.valueSource, /ruleEvidence/); assert.equal(typeof data.boundaries.storeTask, 'string'); break;
        case 'hallmark_list_stores': assert.equal(data[0].originalStoreField, 'preserved'); sourceEvidence(result, 'hallmark_snapshot', '/api/stores'); break;
        case 'hallmark_resolve_store': assert.equal(data.id, 's'); break;
        case 'hallmark_list_store_products': assert.deepEqual(data.products, originalProducts.slice(0, 2)); sourceEvidence(result, 'hallmark_snapshot', '/api/store-products', 's', sourceAt); break;
        case 'hallmark_get_platform_data': assert.equal(data.response.result[0].warehouse_id, 1); sourceEvidence(result, 'ozon_api', '/v2/warehouse/list', 's', sourceAt); break;
        case 'hallmark_search_collected_items': assert.equal(data.items[0].id, 'item'); assert.equal(data.items[0].originalSummaryField, 'preserved'); assert.equal(data.total, 1); sourceEvidence(result, 'collected_item', '/api/items'); break;
        case 'hallmark_get_collected_item': assert.deepEqual(data, rawItem); sourceEvidence(result, 'collected_item', '/api/items/item/raw?full=1'); break;
        case 'hallmark_get_category_data': assert.deepEqual(data.raw, categoryRaw); assert.equal(data.raw.candidates[0].verified, false); sourceEvidence(result, 'hallmark_snapshot', '/api/catalog/search?storeId=s&q=lamp&limit=10&requireAspects=false', 's', sourceAt); break;
        case 'hallmark_get_data_status': assert.equal(data.datasetKey, 'store_products:s'); assert.equal(data.state, 'ready'); assert.ok(data.lastSuccessAt); break;
        case 'hallmark_compute_profit': assert.equal(data.products[0].referenceProfit.margin, 0.1); assert.equal(data.products[1].referenceProfit.costMissing, true); assert.match(invocation.result!.provenance![0].metricBasis!, /非实际结算/); assert.equal(result.metricBasis, invocation.result!.provenance![0].metricBasis); sourceEvidence(result, 'hallmark_compute', '/api/store-products', 's', sourceAt); break;
        case 'hallmark_filter_products': assert.equal(data.payload.products.length, 1); assert.equal(data.payload.unable.length, 1); assert.equal(data.payload.unable[0].referenceProfit.margin, null); assert.ok(Date.parse(data.expiresAt) > Date.now() + 86300000); assert.equal(f.port.get<Data>('result_sets', data.resultSetId)!.expiresAt, data.expiresAt); assert.equal(result.metricBasis, invocation.result!.provenance![0].metricBasis); sourceEvidence(result, 'hallmark_compute', '/api/store-products', 's', sourceAt); break;
        case 'hallmark_update_price': state.priceOperationId = data.operationId; assert.equal(data.items[0].state, 'succeeded'); assert.equal(data.items[0].observed, '100'); break;
        case 'hallmark_update_stock': assert.equal(data.items[0].state, 'succeeded'); assert.equal(data.items[0].platformSku, 501); assert.equal(data.items[0].observed, 0); break;
        case 'hallmark_list_product': assert.equal(data.acceptance, 'imported-not-sellable-verified'); assert.equal(data.items[0].state, 'succeeded'); assert.equal(f.mutations().at(-1)!.input.body.items[0]._sourceSkuId, undefined); assert.deepEqual(f.mutations().at(-1)!.input.mappings, [{ skuCode: 'sku1', offerId: 'new-offer' }]); break;
        case 'hallmark_get_operation': assert.equal(data.operationId, state.priceOperationId); assert.equal(data.state, 'succeeded'); break;
        case 'hallmark_list_operations': assert.ok(data.some((row: Data) => row.operationId === state.priceOperationId)); assert.equal(data.filter((row: Data) => ['update_price', 'update_stock', 'list_product'].includes(row.kind)).length, 3); break;
        case 'hallmark_refresh_data': assert.equal(data.counts.products, 2); assert.equal(f.httpCalls.filter(row => row.route === '/api/store-products/sync').length, 1); break;
        case 'hallmark_render_view': state.viewId = data.viewId; assert.equal(data.spec.widgets[0].text, 'Source fields'); break;
        case 'hallmark_update_view': assert.equal(data.spec.title, 'Patched replay'); break;
        case 'hallmark_save_component': state.componentId = data.component.id; state.componentEntryId = data.entry.id; assert.equal(data.entry.viewId, state.componentId); assert.notEqual(data.entry.id, state.componentId); assert.deepEqual(data.entry, { id: state.componentEntryId, appId: 'hallmark', kind: 'component', title: 'Patched replay', pinned: false, order: 0, viewId: state.componentId }); break;
        case 'hallmark_open_component': assert.equal(data.sourceComponentId, state.componentId); assert.equal(data.viewId, state.viewId); assert.equal(f.store.list('views').length, 1); break;
        case 'hallmark_open_source_component': assert.equal(data.spec.kind, 'source'); assert.ok(f.sources.manifest(data.spec.source.buildId)); break;
        case 'hallmark_save_entry': state.dataEntryId = data.id; assert.deepEqual(data, { id: state.dataEntryId, appId: 'hallmark', kind: 'data', title: 'Product entry', binding: args.binding, pinned: false, order: 1 }); break;
        case 'hallmark_save_template': state.templateId = data.id; assert.deepEqual(data, { id: state.templateId, name: 'Reusable replay', description: '', theme: {}, layout: { type: 'column', children: ['text'] }, widgetStyles: [{ id: 'text', type: 'text', text: 'Source fields' }], contentRules: { bindingIds: [] }, version: 1 }); break;
        case 'hallmark_list_saved': assert.equal(data.components.length, 1); assert.equal(data.entries.length, 2); assert.equal(data.templates.length, 1); assert.deepEqual(data.entries.map((entry: Data) => entry.id), [state.componentEntryId, state.dataEntryId]); assert.deepEqual(data.entries.map((entry: Data) => entry.order), [0, 1]); assert.deepEqual(data.entries[1].binding, inputs.hallmark_save_entry().binding); assert.equal(data.templates[0].id, state.templateId); break;
        case 'hallmark_manage_saved': assert.equal(data.id, state.componentId); assert.equal(data.title, 'Renamed replay'); assert.equal(data.spec.title, 'Renamed replay'); assert.equal(data.revision, 2); assert.equal(data.spec.widgets[0].text, 'Source fields'); assert.equal(f.store.get<Data>('saved_assets', `entry:${state.componentEntryId}`)!.title, 'Renamed replay'); break;
      }
      if (descriptor.effect === 'mutation' && mapping.owner !== 'presentation') { assert.equal(result.operation.operationId, data.operationId); assert.equal(f.store.get<Data>('operations', data.operationId)!.operationId, f.port.get<Data>('operations', data.operationId)!.operationId); }
      const invalid = await f.legacy(mapping.legacyName, { ...args, unknownPublicField: true }, `invalid:${mapping.legacyName}`); assert.equal(invalid.status, 'failed'); assert.equal(invalid.error.code, 'INVALID_PARAMS'); assert.equal(invalid.error.retryable, false); assert.equal(f.executions.get(mapping.capabilityId), before + 1); assert.equal(f.store.get('invocations', `invalid:${mapping.legacyName}`), undefined);
      evidence.aliases.push({ legacyName: mapping.legacyName, capabilityId: mapping.capabilityId, owner: mapping.owner, validStatus: result.status, invalidStatus: invalid.status, providerExecutions: 1, requestSchemaValidated: true, resultSchemaValidated: true, invocationId: attempt, backendFixtureRequests: f.httpCalls.slice(httpBefore).map(row => ({ method: row.method, route: row.route, ...(row.input?.path ? { platformPath: row.input.path } : {}) })), ...(result.operation ? { operationId: result.operation.operationId } : {}), ...(result.provenance ? { originalProvenance: result.provenance } : {}), ...(result.metricBasis ? { metricBasisPreserved: true } : {}) });
    }
    assert.equal(evidence.aliases.length, 26); assert.equal(f.store.list('invocations').length, 26); assert.equal(f.mutations().length, 3);
    assert.deepEqual(f.mutations().map(row => row.input.path), ['/v1/product/import/prices', '/v2/products/stocks', '/v3/product/import']); evidence.businessFixtureMutations = 3;
  } finally { await f.cleanup(); }
});

test('legacy resultSetId overrides bindings, reads the registered result and rejects expired or absent results without business dispatch', async () => {
  const f = await fixture();
  try {
    const filtered = await f.legacy('hallmark_filter_products', { storeId: 's', maxMargin: 0.15 }, 'result-set-create'); assert.equal(filtered.status, 'ok'); const resultSetId = filtered.data.resultSetId, original = f.port.get<Data>('result_sets', resultSetId)!, httpBefore = f.httpCalls.length;
    const input = { resultSetId, spec: { id: 'result-set-view', title: 'Saved filtered result', layout: { type: 'column', children: ['table'] }, widgets: [{ id: 'table', type: 'table', bindingId: 'data', columns: [{ field: 'offerId', label: '商品标识' }] }], bindings: [{ id: 'discarded', query: { tool: 'hallmark_list_store_products', params: { storeId: 'other' } }, fieldMap: { name: 'ignored' } }] } };
    const rendered = await f.legacy('hallmark_render_view', input, 'result-set-render'); assert.equal(rendered.status, 'ok', JSON.stringify(rendered)); assert.deepEqual(rendered.data.spec.bindings, [{ id: 'data', datasetKey: `result_set:${resultSetId}`, fieldMap: {} }]);
    const invocation = f.store.get<InvocationRecord>('invocations', 'result-set-render')!, normalized = invocation.request.input as Data; assert.deepEqual(normalized.requiredBindingIds, ['data']); assert.equal(normalized.bindings.length, 1); assert.equal(normalized.bindings[0].connectionId, 'h'); assert.equal(normalized.bindings[0].capabilityId, 'hallmark.products.filter'); assert.deepEqual(normalized.bindings[0].input, { resultSetId }); assert.equal(normalized.bindings[0].bindingId, 'data'); assert.equal(f.executions.get('hallmark.products.filter'), 2); assert.equal(f.executions.get('apps.presentation.render_view'), 1); assert.equal(f.httpCalls.length, httpBefore); assert.equal(f.mutations().length, 0);
    const snapshot = f.presentation.getData('session', rendered.data.viewId).bindings[0]; assert.deepEqual((snapshot.payload as Data).payload, filtered.data.payload); const viewsBefore = f.store.list('views').length;
    f.port.put('result_sets', resultSetId, { ...original, expiresAt: '2000-01-01T00:00:00Z' });
    const expired = await f.legacy('hallmark_render_view', input, 'result-set-expired'); assert.equal(expired.status, 'failed', JSON.stringify(expired)); assert.equal(expired.error.code, 'RESULT_SET_EXPIRED'); assert.equal(expired.error.retryable, false); assert.equal(f.store.list('views').length, viewsBefore);
    const missing = await f.legacy('hallmark_render_view', { ...input, resultSetId: 'missing-result' }, 'result-set-missing'); assert.equal(missing.status, 'failed'); assert.equal(missing.error.code, 'RESULT_SET_NOT_FOUND'); assert.equal(f.store.list('views').length, viewsBefore); assert.equal(f.httpCalls.length, httpBefore); assert.equal(f.mutations().length, 0); assert.equal(f.executions.get('hallmark.products.filter'), 4);
    evidence.resultSetRendering = { bindingOverridePreserved: true, registeredCapability: 'hallmark.products.filter', input: { resultSetId }, exactConnectionAndSessionPreserved: true, loadedOriginalPayload: true, expiredErrorCode: expired.error.code, missingErrorCode: missing.error.code, failedRenderCreatesNoView: true, additionalBusinessHTTP: 0, businessMutationPosts: 0 };
  } finally { await f.cleanup(); }
});

test('legacy cross-session intent reuse and incomplete save requests fail before Runtime dispatch', async () => {
  const f = await fixture();
  try {
    const input = { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', clientOperationKey: 'session-intent', userRequest: '把 A 的价格设为 100 RUB' }, first = await f.legacy('hallmark_update_price', input, 'owned-intent'); assert.equal(first.status, 'ok');
    f.runtime.bind({ sessionId: 'foreign', appId: 'hallmark', connectionId: 'h', enabled: true, boundAt: new Date().toISOString() });
    const foreign = await f.legacy('hallmark_update_price', input, 'foreign-intent', undefined, 'foreign'); assert.equal(foreign.status, 'failed'); assert.equal(foreign.error.code, 'OPERATION_NOT_FOUND'); assert.equal(foreign.error.retryable, false); assert.equal(f.mutations().length, 1); assert.equal(f.executions.get('hallmark.products.update_price'), 1); assert.equal(f.store.get('invocations', 'foreign-intent'), undefined); assert.equal(f.store.list('operations').length, 1);
    const view = f.presentation.createView('session', { title: 'Explicit save only' });
    for (const [index, args] of [{ viewId: view.viewId }, { viewId: view.viewId, userRequest: '   ' }].entries()) { const result = await f.legacy('hallmark_save_component', args, `save-no-intent:${index}`, index === 0 ? '顶层原话不替代 save arguments' : undefined); assert.equal(result.status, 'failed'); assert.equal(result.error.code, 'SAVE_NOT_REQUESTED'); assert.equal(f.store.get('invocations', `save-no-intent:${index}`), undefined); }
    const update = await f.legacy('hallmark_save_component', { viewId: view.viewId, mode: 'update', userRequest: '更新已保存组件' }, 'save-no-preconditions'); assert.equal(update.status, 'needs_clarification'); assert.deepEqual(update.clarification.missing, ['componentId', 'expectedRevision']); assert.equal(f.store.get('invocations', 'save-no-preconditions'), undefined); assert.equal(f.executions.get('apps.presentation.save_component'), undefined); assert.equal(f.store.list('components').length, 0); assert.equal(f.store.list('saved_assets').length, 0); assert.equal(f.mutations().length, 1);
    evidence.sessionIntentAndSaveRules = { crossSessionIntentError: foreign.error.code, foreignProviderExecutions: 0, incompleteSaveProviderExecutions: 0, missingSaveIntentError: 'SAVE_NOT_REQUESTED', updatePreconditions: ['componentId', 'expectedRevision'], originalIntentOperationId: first.operation.operationId, originalIntentBusinessPosts: 1 };
  } finally { await f.cleanup(); }
});

test('unknown raw POST and wrong read method are rejected before platform dispatch; API directory effects are explicit', async () => {
  const f = await fixture();
  try {
    for (const input of [{ storeId: 's', path: '/v3/product/import', method: 'POST', body: { items: [] } }, { storeId: 's', path: '/v5/product/info/prices', method: 'GET', body: {} }]) {
      const result = await f.legacy('hallmark_get_platform_data', input, `reject:${input.path}`); assert.equal(result.status, 'failed'); assert.equal(result.error.code, 'ENDPOINT_NOT_ALLOWED'); assert.equal(f.platform().length, 0);
      evidence.rejectionRules.push({ input, status: result.status, errorCode: result.error.code, platformDispatches: 0 });
    }
    const request: InvocationRequest = { protocolVersion: '1.0', appId: 'hallmark', connectionId: 'h', invocationId: 'unknown-api', traceId: 'unknown-api', capabilityId: 'hallmark.api.invented', capabilityVersion: '1.0.0', input: {}, source: { kind: 'agent', sessionId: 'session', nativeCallId: 'api' }, deadlineAt: new Date(Date.now() + 10000).toISOString() };
    const unknown = await f.call('/v1/invocations', request); assert.equal(unknown.status, 'failed'); assert.equal(unknown.error.code, 'CAPABILITY_NOT_FOUND'); assert.equal(f.platform().length, 0);
    const registered = await f.call('/v1/invocations', { ...request, invocationId: 'registered-query', capabilityId: 'hallmark.api.warehouses.list', input: { storeId: 's', body: {} } }); assert.equal(registered.status, 'ok'); assert.equal(f.platform().length, 1); assert.equal(f.mutations().length, 0);
    const effects = HALLMARK_API_OPERATIONS.map(row => f.runtime.describe(row.capabilityId)!.effect); assert.equal(effects.filter(effect => effect === 'query').length, 15); assert.equal(effects.filter(effect => effect === 'mutation').length, 1);
    evidence.rawApiCoverage = { unknownPostRejected: true, exactReadMethodEnforced: true, unknownCapabilityRejected: true, registeredReadDispatched: true, registeredCount: HALLMARK_API_OPERATIONS.length, registeredEffects: { query: 15, mutation: 1 } };
  } finally { await f.cleanup(); }
});

test('explicit API price mutation uses the real SDK and one Runtime identity; dedup, conflict and unknown inspection never replay the write', async () => {
  const f = await fixture({ deferHallmarkRegistration: true });
  try {
    const capabilityId = 'hallmark.api.products.update_price', descriptor = HALLMARK_DESCRIPTORS.find(row => row.capabilityId === capabilityId)!;
    const transport = new HttpRuntimeTransport(f.address, token), sdk = new AppsClient(transport, { kind: 'agent', sessionId: 'session', nativeCallId: 'api-registration-fixture' });
    const ref = { appId: 'hallmark', connectionId: 'h' }, input = { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', userRequest: '把夹具 A 的价格设为 100 RUB' };
    assert.equal(new URL(f.address).hostname, '127.0.0.1');
    assert.equal(await transport.describe(capabilityId, descriptor.version), undefined);
    const unregistered = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'not-yet-registered', invocationId: 'api-before-registration' });
    assert.equal(unregistered.status, 'failed'); assert.ok('error' in unregistered); assert.equal(unregistered.error.code, 'CAPABILITY_NOT_FOUND'); assert.equal(f.httpCalls.length, 0); assert.equal(f.store.list('operations').length, 0); assert.equal(f.executions.size, 0);
    f.registerHallmark();
    assert.deepEqual(await transport.describe(capabilityId, descriptor.version), descriptor);
    assert.equal(descriptor.apiOperationId, 'hallmarkPriceUpdate'); assert.equal(descriptor.effect, 'mutation'); assert.deepEqual(descriptor.aliases, []);
    assert.equal(descriptor.execution.idempotency, 'runtime_dedup'); assert.equal(descriptor.execution.completionEvidence, 'readback');
    const artifacts = generateArtifacts(HALLMARK_DESCRIPTORS); assert.ok(artifacts.tools.some(row => row.name === capabilityId)); assert.match(artifacts.source, /hallmark\.api\.products\.update_price/); assert.match(artifacts.documentation, /TASK_CONTEXT_REQUIRED/);
    const invalid = await sdk.invoke(ref, descriptor, { ...input, path: '/unregistered/direct/write', body: {} }, { idempotencyKey: 'invalid-api-wire', invocationId: 'api-invalid-wire' });
    assert.equal(invalid.status, 'failed'); assert.ok('error' in invalid); assert.equal(invalid.error.code, 'INPUT_SCHEMA_INVALID'); assert.equal(f.httpCalls.length, 0); assert.equal(f.store.list('operations').length, 0);
    const noKey = await sdk.invoke(ref, descriptor, input, { invocationId: 'api-no-intent-key' }); assert.equal(noKey.status, 'failed'); assert.ok('error' in noKey); assert.equal(noKey.error.code, 'IDEMPOTENCY_KEY_REQUIRED'); assert.equal(f.httpCalls.length, 0);
    const first = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-price', invocationId: 'api-price-first' });
    assert.equal(first.status, 'ok', JSON.stringify(first)); assert.ok('data' in first); const firstData = first.data as Data, firstId = first.operation!.operationId;
    assert.equal(firstData.operationId, firstId); assert.equal(firstData.kind, 'update_price'); assert.equal(firstData.state, 'succeeded'); assert.equal(firstData.input.userRequest, input.userRequest); assert.equal(firstData.sessionId, 'session');
    assert.equal(f.store.get<Data>('operations', firstId)!.capabilityId, capabilityId); assert.equal(f.port.get<Data>('operations', firstId)!.operationId, firstId); assert.equal(f.store.list('operations').length, 1); assert.equal(f.mutations().length, 1); assert.equal(f.executions.get(capabilityId), 1);
    const originalWrite = structuredClone(f.mutations()[0]), firstStored = f.port.get<Data>('operations', firstId)!;
    assert.equal(originalWrite.route, '/api/tasks/task/platform'); assert.equal(originalWrite.method, 'POST'); assert.equal(originalWrite.input.path, '/v1/product/import/prices'); assert.equal(originalWrite.input.requestId, firstStored.hallmarkRefs[0].requestId);
    assert.deepEqual(originalWrite.input.body, { prices: [{ offer_id: 'A', price: '100', currency_code: 'RUB' }] }); assert.deepEqual(firstData.items[0].write.raw, originalWrite.rawResponse); assert.deepEqual(firstStored.items[0].write.raw, originalWrite.rawResponse);
    assert.deepEqual(firstData.items[0].readback.raw, f.platform().find(row => row.input.path === '/v5/product/info/prices')!.rawResponse); assert.deepEqual(validateResult(first, descriptor.outputSchema), []);
    const duplicate = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-price', invocationId: 'api-price-duplicate' }); assert.equal(duplicate.status, 'ok'); assert.equal(duplicate.operation?.operationId, firstId);
    const conflict = await sdk.invoke(ref, descriptor, { ...input, price: 90 }, { idempotencyKey: 'registered-price', invocationId: 'api-price-conflict' }); assert.equal(conflict.status, 'failed'); assert.ok('error' in conflict); assert.equal(conflict.error.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(conflict.operation?.operationId, firstId);
    assert.equal(f.mutations().length, 1); assert.equal(f.executions.get(capabilityId), 1); assert.equal(f.store.list('operations').length, 1);
    f.setUnknownPrice();
    const unknown = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown' });
    assert.equal(unknown.status, 'unknown', JSON.stringify(unknown)); assert.ok('error' in unknown); assert.equal(unknown.error.retryPolicy, 'inspect_only'); const unknownId = unknown.operation!.operationId;
    const unknownStored = f.port.get<Data>('operations', unknownId)!, originalUnknownWrite = structuredClone(f.mutations()[1]);
    assert.equal(unknownStored.operationId, unknownId); assert.equal(unknownStored.items[0].state, 'unknown'); assert.equal(unknownStored.items[0].write.raw.outcome, 'outcome_unknown'); assert.deepEqual(unknownStored.items[0].write.raw, originalUnknownWrite.rawResponse); assert.equal(f.store.get<Data>('operations', unknownId)!.capabilityId, capabilityId); assert.equal(f.store.list('operations').length, 2);
    const unknownRepeat = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown-repeat' }); assert.equal(unknownRepeat.status, 'unknown'); assert.equal(unknownRepeat.operation?.operationId, unknownId);
    const unknownConflict = await sdk.invoke(ref, descriptor, { ...input, price: 90 }, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown-conflict' }); assert.equal(unknownConflict.status, 'failed'); assert.ok('error' in unknownConflict); assert.equal(unknownConflict.error.code, 'IDEMPOTENCY_CONFLICT');
    const readsBefore = f.platform().filter(row => row.input.path === '/v5/product/info/prices').length, writesBefore = f.mutations().length, executeBefore = f.executions.get(capabilityId);
    const unresolved = await transport.inspect(unknownId); assert.equal(unresolved.status, 'unknown'); assert.equal(unresolved.operation?.operationId, unknownId);
    f.confirmPrice(); const inspected = await transport.inspect(unknownId); assert.equal(inspected.status, 'ok', JSON.stringify(inspected)); assert.ok('data' in inspected); const inspectedData = inspected.data as Data;
    assert.equal(inspectedData.operationId, unknownId); assert.equal(inspectedData.state, 'succeeded'); assert.equal(inspected.operation?.operationId, unknownId); assert.deepEqual(inspectedData.items[0].write.raw, originalUnknownWrite.rawResponse); assert.deepEqual(f.port.get<Data>('operations', unknownId)!.items[0].write.raw, originalUnknownWrite.rawResponse);
    assert.equal(f.mutations().length, writesBefore); assert.equal(f.executions.get(capabilityId), executeBefore); assert.equal(f.platform().filter(row => row.input.path === '/v5/product/info/prices').length, readsBefore + 2); assert.equal(f.store.list('operations').length, 2); assert.deepEqual(validateResult(inspected, descriptor.outputSchema), []);
    evidence.registeredApiMutation = {
      apiOperationId: descriptor.apiOperationId, capabilityId, version: descriptor.version, effect: descriptor.effect, execution: descriptor.execution, aliases: descriptor.aliases, fixedPath: null,
      unregistered: { exactCapability: capabilityId, errorCode: unregistered.error.code, businessHttpRequests: 0, operationCount: 0 }, registration: 'same Runtime instance, then Hallmark Provider register + explicit session connection binding',
      schemaRejections: { extraWireFields: invalid.error.code, missingIntentKey: noKey.error.code, businessHttpRequests: 0 }, generatedSdkCatalogIncludesOperation: true,
      succeeded: { operationId: firstId, providerOperationId: firstStored.operationId, duplicateOperationId: duplicate.operation!.operationId, conflictError: conflict.error.code, businessMutationPosts: 1, providerExecutions: 1, originalRequest: originalWrite.input, completeRawResponse: firstData.items[0].write.raw, completeRawReadback: firstData.items[0].readback.raw },
      unknown: { operationId: unknownId, providerOperationId: unknownStored.operationId, repeatOperationId: unknownRepeat.operation!.operationId, conflictError: unknownConflict.error.code, retryPolicy: unknown.error.retryPolicy, completeOriginalRequest: originalUnknownWrite.input, completeOriginalRawResponse: originalUnknownWrite.rawResponse, unresolvedStatus: unresolved.status, inspectedStatus: inspected.status, finalState: inspected.operation!.state, readOnlyInspectionCalls: 2, additionalBusinessMutationPosts: 0, additionalProviderExecuteCalls: 0, originalRawResponsePreserved: true, completeRawReadback: inspectedData.items[0].readback.raw },
      totals: { runtimeOperationCount: 2, providerMutationExecuteCalls: executeBefore, businessMutationPosts: writesBefore, registeredQueryCount: 15, registeredMutationCount: 1 },
      actualBusinessRoutes: f.httpCalls.map(row => ({ method: row.method, route: row.route, ...(row.input?.path ? { platformPath: row.input.path } : {}) })),
      scope: 'local actual SDK/HTTP/adapter/domain/SQLite fixture; no real business writes; existing CNY fallback remains inherited and separately covered by original ordinary-cny tests',
    };
  } finally { await f.cleanup(); }
});

test('legacy unknown price retains the original operation and only readback can resolve it without another business POST', async () => {
  const f = await fixture();
  try {
    f.setUnknownPrice(); const input = { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', clientOperationKey: 'unknown-price', userRequest: '把 A 的价格设为 100 RUB' };
    const first = await f.legacy('hallmark_update_price', input, 'unknown-first'); assert.equal(first.status, 'unknown'); assert.equal(first.error?.retryable ?? false, false); assert.equal(f.mutations().length, 1); assert.equal(first.data.operationId, first.operation.operationId); assert.equal(first.data.items[0].state, 'unknown'); assert.equal(first.data.items[0].write.raw.outcome, 'outcome_unknown');
    const again = await f.legacy('hallmark_update_price', input, 'unknown-repeat'); assert.equal(again.operation.operationId, first.operation.operationId); assert.equal(again.data.operationId, first.operation.operationId); assert.equal(f.mutations().length, 1); assert.equal(f.executions.get('hallmark.products.update_price'), 1);
    const unresolved = await f.legacy('hallmark_get_operation', { operationId: first.operation.operationId }, 'unknown-unresolved-read'); assert.equal(unresolved.status, 'unknown'); assert.equal(unresolved.data.operationId, first.operation.operationId); assert.equal(unresolved.data.items[0].state, 'unknown'); assert.equal(f.mutations().length, 1);
    f.confirmPrice(); const inspected = await f.legacy('hallmark_get_operation', { operationId: first.operation.operationId }, 'unknown-readback'); assert.equal(inspected.status, 'ok'); assert.equal(inspected.data.state, 'succeeded'); assert.equal(inspected.operation.operationId, first.operation.operationId); assert.equal(f.mutations().length, 1);
    evidence.unknownRecovery = { originalOperationId: first.operation.operationId, mutationPosts: 1, providerMutationExecutions: 1, duplicatePreservedOperationId: true, readbackResolved: true, resubmitted: false };
  } finally { await f.cleanup(); }
});

test('legacy app_info lists only this session source drafts with exact viewId, title, directory and buildId', async () => {
  const f = await fixture();
  try {
    const project = join(f.directory, 'session-project'); mkdirSync(join(project, 'dist'), { recursive: true }); writeFileSync(join(project, 'dist', 'index.html'), '<div>Owner fixture</div>');
    const opened = await f.legacy('hallmark_open_source_component', { directory: project, title: 'Owned source' }, 'session-source'); assert.equal(opened.status, 'ok');
    f.presentation.openSource('other-session', project, { title: 'Foreign source' });
    const info = await f.legacy('hallmark_app_info', {}, 'session-info'); assert.equal(info.status, 'ok');
    assert.deepEqual(info.data.sessionComponents, [{ viewId: opened.data.viewId, title: 'Owned source', kind: 'source', source: { directory: project, buildId: opened.data.spec.source.buildId } }]); assert.equal(f.mutations().length, 0);
    evidence.sessionSummary = { ownSourceVisible: true, foreignSourceAbsent: true, sourceDirectoryAndBuildIdPreserved: true, businessMutationPosts: 0 };
  } finally { await f.cleanup(); }
});

test('legacy missing intent key, ambiguous stores, unconfirmed batch and unverified rule clarify without business writes', async () => {
  const f = await fixture();
  try {
    const noKey = await f.legacy('hallmark_update_price', { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', userRequest: '把 A 的价格设为 100 RUB' }, 'missing-intent');
    assert.equal(noKey.status, 'needs_clarification'); assert.ok(noKey.clarification.missing.includes('clientOperationKey')); assert.equal(f.mutations().length, 0); assert.equal(f.store.list('operations').length, 0); assert.equal(f.executions.get('hallmark.products.update_price'), undefined); assert.equal(f.store.get('invocations', 'missing-intent'), undefined);
    const ambiguous = await f.legacy('hallmark_resolve_store', { query: 'Al' }, 'ambiguous-store'); assert.equal(ambiguous.status, 'needs_clarification'); assert.deepEqual(ambiguous.clarification.candidates.map((row: Data) => row.id), ['s', 'other']);
    const batch = await f.legacy('hallmark_update_stock', { storeId: 's', offerIds: ['A', 'B'], stock: 0, valueSource: 'user', clientOperationKey: 'batch', userRequest: '库存设为 0' }, 'unconfirmed-batch'); assert.equal(batch.status, 'needs_clarification'); assert.ok(batch.clarification.missing.includes('warehouseId')); assert.ok(batch.clarification.missing.includes('scopeConfirmed'));
    const rule = await f.legacy('hallmark_update_price', { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'rule:floor', clientOperationKey: 'rule', userRequest: '按 floor 规则修改价格' }, 'unverified-rule'); assert.equal(rule.status, 'needs_clarification'); assert.ok(rule.clarification.missing.includes('ruleEvidence'));
    assert.equal(f.mutations().length, 0); assert.equal(f.platform().length, 0);
    evidence.requiredWriteClarifications = { missingIntentKeyPreserved: true, ambiguousCandidatesPreserved: true, warehouseAndBatchConfirmationRequired: true, ruleEvidenceRequired: true, businessMutationPosts: 0 };
    const originalRequest = '把 A 的价格设为 100 RUB，原话来自旧调用上下文', input = { storeId: 's', offerIds: ['A'], price: 100, currency: 'RUB', valueSource: 'user', clientOperationKey: 'top-level-context' }, before = f.executions.get('hallmark.products.update_price') ?? 0;
    const authorized = await f.legacy('hallmark_update_price', input, 'context-first', originalRequest); assert.equal(authorized.status, 'ok', JSON.stringify(authorized)); assert.equal(authorized.data.input.userRequest, originalRequest); assert.equal(authorized.data.operationId, authorized.operation.operationId);
    const repeated = await f.legacy('hallmark_update_price', input, 'context-repeat', originalRequest); assert.equal(repeated.status, 'ok'); assert.equal(repeated.data.operationId, authorized.data.operationId); assert.equal(f.mutations().length, 1); assert.equal(f.executions.get('hallmark.products.update_price'), before + 1); assert.equal(f.store.list<Data>('operations').filter(operation => operation.idempotencyKey === input.clientOperationKey).length, 1); assert.equal(f.port.get<Data>('operations', authorized.data.operationId)!.input.userRequest, originalRequest);
    evidence.topLevelContext = { originalUserRequestPreserved: true, sameIntentOperationId: authorized.data.operationId, runtimeOperationsForIntent: 1, providerMutationExecutions: 1, businessMutationPosts: 1 };
  } finally { await f.cleanup(); }
});
