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
import { OzonBusinessGateway } from '../../packages/ozon-business/src/index.ts';

type Data = Record<string, any>;
function sourceEvidence(result: Data, source: string, endpoint: string | undefined, storeId?: string, dataTime?: string): void {
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
// This fixture owns only its synthetic image; all service and adapter HTTP remains real loopback I/O.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => String(input) === image ? Promise.resolve(new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Qf8AAAAASUVORK5CYII=','base64'), {headers:{'content-type':'image/png'}})) : originalFetch(input, init);
after(() => {globalThis.fetch = originalFetch;});
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
  let price = 100, stock = 2, unknownPrice = false, imported = false;
  const task = { id: 'task', kind: 'listing', storeId: 's', status: 'active', productId: 'item' };
  const upstream = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1'), chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(chunk); const text = Buffer.concat(chunks).toString(); const input: Data = text ? JSON.parse(text) : {};
      const direct = /^\/v\d+\//.test(url.pathname);
      httpCalls.push({ route: url.pathname, method: req.method, ...(text ? { input: direct ? { path: url.pathname, method: req.method, body: input } : input } : {}) });
      const send = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
      if (url.pathname === '/api/health') return send({ service: 'hallmark-control' });
      if (url.pathname === '/api/stores') return send([{ id: 's', shopName: 'Alpha', originalStoreField: 'preserved' }, { id: 'other', shopName: 'Alpine' }]);
      if (url.pathname === '/api/store-products' || url.pathname === '/api/store-products/sync') return send({ stores: [{ id: 's', lastSuccessAt: sourceAt }, { id: 'other', lastSuccessAt: sourceAt }], products: originalProducts });
      if (url.pathname === '/api/target-margin') return send({ targetMargin: 0.2 });
      if (url.pathname === '/api/items') return send([{ id: 'item', title: 'Existing Source item', skuCount: 1, originalSummaryField: 'preserved' }, { id: 'other-item', title: 'Another item', skuCount: 1 }]);
      if (url.pathname === '/api/items/item/raw') { assert.equal(url.searchParams.get('full'), '1'); return send(rawItem); }
      if (url.pathname === '/api/items/item') return send({ id: 'item', currency:'CNY', skus: [{ sourceSkuId: 'sku1', price:10, image }], images: [image] });
      if (url.pathname === '/api/catalog/search') { assert.equal(url.searchParams.get('storeId'), 's'); assert.equal(url.searchParams.get('q'), 'lamp'); return send(categoryRaw); }
      if (url.pathname === '/api/tasks') return send([task]);
      if (url.pathname === '/api/tasks/task') return send(task);
      if (direct || url.pathname === '/api/tasks/task/platform' || url.pathname === '/api/stores/s/data/read') {
        if(direct){assert.equal(req.headers['client-id'],'fixture-replay-client');assert.equal(req.headers['api-key'],'fixture-replay-key');}
        const call = direct ? {path:url.pathname,method:req.method,body:input} : input;
        let payload: unknown;
        if (call.path === '/v1/product/import/prices') { price = unknownPrice ? 50 : Number(call.body.prices[0].price); payload = { result: [{ updated: true }] }; if(direct&&unknownPrice){req.socket.destroy();return;} }
        else if (call.path === '/v2/products/stocks') { stock = Number(call.body.stocks[0].stock); payload = { result: [{ updated: true }] }; }
        else if (call.path === '/v3/product/import') {imported = true; payload = { result: { task_id: 99 } };}
        else if (call.path === '/v5/product/info/prices') payload = { result: { items: [{ offer_id: 'A', product_id: 1, price: { price: String(price), currency_code: 'RUB' } }] } };
        else if (call.path === '/v3/product/info/list') payload = { items: call.body.offer_id?.includes('new-offer') ? (imported ? [{offer_id:'new-offer',id:22,sku:522}] : []) : [{ offer_id: 'A', id: 1, sku: 501,price:{price:String(price),currency_code:'RUB'},stocks:{has_stock:stock>0},unknownSourceField:{foo:'preserved'} },...(call.body.product_id?.includes(2)?[{offer_id:'B',id:2,sku:502,price:{price:'200',currency_code:'RUB'}}]:[])] };
        else if (call.path === '/v4/product/info/attributes') payload = { result: [] };
        else if (call.path === '/v3/product/list') payload={result:{items:[{product_id:1},{product_id:2}],last_id:''}};
        else if (call.path === '/v1/description-category/tree') payload={result:[{description_category_id:100,category_name:'Fixture category',children:[{type_id:200,type_name:'lamp'}]}]};
        else if (call.path === '/v2/product/info/stocks-by-warehouse/fbs') payload = { result: { items: [{ offer_id: 'A', sku: 501, warehouse_id: 1, present: stock }] } };
        else if (call.path === '/v1/product/import/info') payload = { result: { items: [{ offer_id: 'new-offer', product_id: 22, status: 'imported', errors: [] }] } };
        else if (call.path === '/v2/warehouse/list') payload = { result: [{ warehouse_id: 1, name: 'Fixture warehouse' }] };
        else return send({ error: 'Unregistered fixture platform path' }, 500);
        if(direct)return send(payload);
        const raw = { requestId: input.requestId, taskId: 'task', storeId: 's', path: input.path, method: input.method, body: input.body, agentId: input.agentId, ...(input.note ? { note: input.note } : {}), startedAt: sourceAt, outcome: unknownPrice && input.path === '/v1/product/import/prices' ? 'outcome_unknown' : 'response_received', httpStatus: 200, response: payload, originalBackendEvidence: { retained: true } };
        httpCalls.at(-1)!.rawResponse = raw; return send(raw);
      }
      send({ error: 'Unregistered fixture route' }, 404);
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
  });
  const backend = await listen(upstream), store = new RuntimeStore(join(directory, 'apps.db')), runtime = new AppsRuntime(store), port = new HallmarkStorePort(store, 'h');
  const client = new HallmarkClient({ baseUrl: backend, operatorToken: 'fixture-operator', spillDirectory: join(directory, 'spill') });
  const gateway = new OzonBusinessGateway(join(directory,'business'),{fetchImpl:async(url,init)=>{const parsed=new URL(String(url));assert.equal(parsed.origin,'https://api-seller.ozon.ru');return originalFetch(new URL(parsed.pathname,backend),init);}});
  for(const [id,name] of [['s','Alpha'],['other','Alpine']])gateway.saveStore({id,name,expectedRevision:0,legacyStoreId:id,sourceConnectionId:'h',credentials:{clientId:'fixture-replay-client',apiKey:'fixture-replay-key'}});
  const request=gateway.request.bind(gateway);gateway.request=async(...args)=>{const before=httpCalls.length,result=await request(...args),sent=httpCalls.slice(before).find(row=>row.route===args[1].path);if(sent)sent.rawResponse=structuredClone(result.raw);return result;};
  const provider = new HallmarkProvider({ store: port, client, broker: new TaskBroker(client, port), businessGateway:gateway, inspectOperation:(id,signal)=>runtime.inspect(id,signal), reviewer:{review:async input=>({status:'passed',questions:input.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'decisions',confidence:1,reasonCode:'FIXTURE_MATCH'})),evidence:{versions:input.versions,thresholds:{pass:0.95,reject:0.2},requests:[]}})} });
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
  const platform = () => httpCalls.filter(row => /^\/v\d+\//.test(row.route) || row.route === '/api/tasks/task/platform' || row.route === '/api/stores/s/data/read');
  const mutations = () => platform().filter(row => ['/v1/product/import/prices', '/v2/products/stocks', '/v3/product/import'].includes(row.input.path));
  const cleanup = async () => { try{assert.equal(httpCalls.some(row=>/^\/api\/tasks/.test(row.route)),false,'new business requests never use old task transport');}finally{await close(service); await runtime.dispose(); store.close(); await close(upstream); const path = resolve(directory); assert.ok(path.startsWith(resolve(tmpdir()) + sep) && path.includes('dsh-legacy-replay-')); rmSync(path, { recursive: true, force: true });} };
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
        case 'hallmark_app_info': assert.deepEqual(data.tools, TOOL_DEFINITIONS.map(({ name, kind }) => ({ name, kind }))); assert.deepEqual(data.sessionComponents, []); assert.equal(data.boundaries.localCapabilitiesAvailableOffline, true); assert.deepEqual(data.boundaries.notCovered, ['采购成本修改','自动解读任意命名规则并生成价格','主动全店巡检']); assert.match(data.boundaries.valueSource, /不要求/); assert.equal(typeof data.boundaries.storeTask, 'string'); break;
        case 'hallmark_list_stores': assert.deepEqual(data.map((row:Data)=>({id:row.id,name:row.name})),[{id:'s',name:'Alpha'},{id:'other',name:'Alpine'}]);assert.equal(data[0].hasCredentials,true);assert.equal(JSON.stringify(data).includes('fixture-replay-key'),false);sourceEvidence(result, 'hallmark_snapshot', undefined); break;
        case 'hallmark_resolve_store': assert.equal(data.id, 's'); break;
        case 'hallmark_list_store_products': assert.deepEqual(data.products.map((row:Data)=>({offerId:row.offerId,productId:row.productId})),[{offerId:'A',productId:'1'},{offerId:'B',productId:'2'}]);assert.deepEqual(data.products[0].unknownSourceField,{foo:'preserved'});assert.deepEqual(data.products[0].platformProduct.unknownSourceField,{foo:'preserved'});assert.deepEqual(data.products[0].historicalProfit.actualMargin,0.1);assert.equal(data.products[0].profit.actualMargin,null);sourceEvidence(result, 'hallmark_snapshot', undefined, 's'); break;
        case 'hallmark_get_platform_data': assert.equal(data.response.result[0].warehouse_id, 1);assert.equal(data.httpStatus,200);assert.equal(data.credentialRevision,1);assert.equal(data.outcome,'response_received');assert.equal(result.provenance,undefined,'direct response must not inherit an old platform timestamp');break;
        case 'hallmark_search_collected_items': assert.equal(data.items[0].id, 'item'); assert.equal(data.items[0].originalSummaryField, 'preserved'); assert.equal(data.total, 1); sourceEvidence(result, 'collected_item', '/api/items'); break;
        case 'hallmark_get_collected_item': assert.deepEqual(data, rawItem); sourceEvidence(result, 'collected_item', '/api/items/item/raw?full=1'); break;
        case 'hallmark_get_category_data': assert.deepEqual(data.raw.items,[{type_id:200,type_name:'lamp',description_category_id:100,descriptionCategoryId:100,typeId:200,path:['Fixture category','lamp']}]);assert.equal(data.raw.total,1);sourceEvidence(result, 'hallmark_snapshot', undefined, 's',data.raw.fetchedAt);break;
        case 'hallmark_get_data_status': assert.equal(data.datasetKey, 'store_products:s'); assert.equal(data.state, 'ready'); assert.ok(data.lastSuccessAt); break;
        case 'hallmark_compute_profit': assert.equal(data.products[0].historicalProfit.actualMargin,0.1);assert.equal(data.products[0].referenceProfit.margin,null,'historical profit cannot pass as current rule calculation');assert.equal(data.products[0].referenceProfit.costMissing,true);assert.equal(data.products[1].referenceProfit.costMissing, true); assert.match(invocation.result!.provenance![0].metricBasis!, /非实际结算/); assert.equal(result.metricBasis, invocation.result!.provenance![0].metricBasis); sourceEvidence(result, 'hallmark_compute', undefined, 's'); break;
        case 'hallmark_filter_products': assert.equal(data.payload.products.length, 0); assert.equal(data.payload.unable.length, 2); assert.equal(data.payload.unable[0].referenceProfit.margin, null); assert.ok(Date.parse(data.expiresAt) > Date.now() + 86300000); assert.equal(f.port.get<Data>('result_sets', data.resultSetId)!.expiresAt, data.expiresAt); assert.equal(result.metricBasis, invocation.result!.provenance![0].metricBasis); sourceEvidence(result, 'hallmark_compute', undefined, 's'); break;
        case 'hallmark_update_price': state.priceOperationId = result.operation.operationId; assert.equal(data.rows[0].status, 'succeeded'); assert.equal(data.rows[0].receipt.observed.price, '100'); break;
        case 'hallmark_update_stock': assert.equal(data.rows[0].status, 'succeeded'); assert.equal(data.rows[0].target.sku, '501'); assert.equal(data.rows[0].receipt.observed.stock, 0); break;
        case 'hallmark_list_product': assert.match(data.rows[0].receipt.completion, /moderation and sellability are separate/); assert.equal(data.rows[0].status, 'succeeded'); assert.equal(data.rows[0].binding.amount, 10); assert.equal(f.mutations().at(-1)!.input.body.items[0]._sourceSkuId, undefined);assert.equal(f.mutations().at(-1)!.input.mappings,undefined);assert.deepEqual(f.port.list<Data>('business_procurement_bindings').find(row=>row.target.offerId==='new-offer')!.binding.components.map((part:Data)=>({itemId:part.itemId,sourceSkuId:part.sourceSkuId,quantity:part.quantity})),[{itemId:'item',sourceSkuId:'sku1',quantity:1}]);break;
        case 'hallmark_get_operation': assert.equal(f.port.get<Data>('business_runtime_operations',state.priceOperationId)!.planId,data.planId); assert.equal(data.status, 'done'); break;
        case 'hallmark_list_operations': assert.ok(data.some((row:Data)=>row.operationId===state.priceOperationId)); assert.equal(data.filter((row:Data)=>['update_price','update_stock','list_product'].includes(row.kind)).length,3); assert.equal(f.port.list('business_plans').length,3); break;
        case 'hallmark_refresh_data': assert.equal(data.counts.products, 2); assert.equal(f.httpCalls.filter(row => row.route === '/api/store-products/sync').length, 0);assert.ok(f.httpCalls.slice(httpBefore).some(row=>row.route==='/v3/product/list')); break;
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
      if (descriptor.effect === 'mutation' && mapping.owner !== 'presentation') { assert.equal(f.port.get<Data>('business_runtime_operations',result.operation.operationId)!.planId,data.planId); assert.equal(f.store.get<Data>('operations',result.operation.operationId)!.state,'succeeded'); }
      const invalid = await f.legacy(mapping.legacyName, { ...args, unknownPublicField: true }, `invalid:${mapping.legacyName}`); assert.equal(invalid.status, 'failed'); assert.equal(invalid.error.code, 'INVALID_PARAMS'); assert.equal(invalid.error.retryable, false); assert.equal(f.executions.get(mapping.capabilityId), before + 1); assert.equal(f.store.get('invocations', `invalid:${mapping.legacyName}`), undefined);
      evidence.aliases.push({ legacyName: mapping.legacyName, capabilityId: mapping.capabilityId, owner: mapping.owner, validStatus: result.status, invalidStatus: invalid.status, providerExecutions: 1, requestSchemaValidated: true, resultSchemaValidated: true, invocationId: attempt, backendFixtureRequests: f.httpCalls.slice(httpBefore).map(row => ({ method: row.method, route: row.route, ...(row.input?.path ? { platformPath: row.input.path } : {}) })), ...(result.operation ? { operationId: result.operation.operationId } : {}), ...(result.provenance ? { originalProvenance: result.provenance } : {}), ...(result.metricBasis ? { metricBasisPreserved: true } : {}) });
    }
    assert.equal(evidence.aliases.length, 26); assert.equal(f.store.list<InvocationRecord>('invocations').filter(row=>row.request.invocationId.startsWith('valid:')).length,26); assert.equal(f.store.list('invocations').length,27,'operation get adds one read-only runtime inspection'); assert.equal(f.mutations().length, 3);
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
    const registered = await f.call('/v1/invocations', { ...request, invocationId: 'registered-query', capabilityId: 'hallmark.api.warehouses.list', input: { storeId: 's', body: {} } }); assert.equal(registered.status, 'ok',JSON.stringify(registered)); assert.equal(f.platform().length, 1); assert.equal(f.mutations().length, 0);
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
    assert.equal(descriptor.execution.idempotency, 'upstream_supported'); assert.equal(descriptor.execution.completionEvidence, 'readback');
    const artifacts = generateArtifacts(HALLMARK_DESCRIPTORS); assert.ok(artifacts.tools.some(row => row.name === capabilityId)); assert.match(artifacts.source, /hallmark\.api\.products\.update_price/); assert.match(artifacts.documentation, /不依赖旧平台任务/);assert.match(artifacts.documentation,/pending\/unknown 只 inspect 原操作/);
    const invalid = await sdk.invoke(ref, descriptor, { ...input, path: '/unregistered/direct/write', body: {} }, { idempotencyKey: 'invalid-api-wire', invocationId: 'api-invalid-wire' });
    assert.equal(invalid.status, 'failed'); assert.ok('error' in invalid); assert.equal(invalid.error.code, 'INPUT_SCHEMA_INVALID'); assert.equal(f.httpCalls.length, 0); assert.equal(f.store.list('operations').length, 0);
    const first = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-price', invocationId: 'api-price-first' });
    assert.equal(first.status, 'ok', JSON.stringify(first)); assert.ok('data' in first); const firstData = first.data as Data, firstId = first.operation!.operationId;
    assert.equal(firstData.status, 'done'); assert.equal(firstData.rows[0].action,'price'); assert.equal(firstData.rows[0].status,'succeeded'); assert.equal(firstData.title,input.userRequest);
    assert.equal(f.store.get<Data>('operations', firstId)!.capabilityId, capabilityId); assert.equal(f.port.get<Data>('business_runtime_operations',firstId)!.planId,firstData.planId); assert.equal(f.store.list('operations').length, 1); assert.equal(f.mutations().length, 1); assert.equal(f.executions.get(capabilityId), 1);
    const originalWrite = structuredClone(f.mutations()[0]), firstStored = f.port.get<Data>('business_transport_receipts', firstData.rows[0].executionId)!;
    assert.equal(originalWrite.route, '/v1/product/import/prices'); assert.equal(originalWrite.method, 'POST'); assert.equal(originalWrite.input.path, '/v1/product/import/prices'); assert.equal(firstStored.requestId,firstStored.executionId);assert.equal(firstStored.transport,'ozon-direct');assert.equal(firstStored.credentialRevision,1);assert.equal(firstStored.taskId,undefined);
    assert.deepEqual(originalWrite.input.body, { prices: [{ offer_id: 'A', price: '100', currency_code: 'RUB' }] }); assert.deepEqual(firstStored.response.raw, originalWrite.rawResponse);
    assert.deepEqual(firstData.rows[0].receipt.observed,{price:'100',currency_code:'RUB'}); assert.deepEqual(validateResult(first, descriptor.outputSchema), []);
    const duplicate = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-price', invocationId: 'api-price-duplicate' }); assert.equal(duplicate.status, 'ok'); assert.equal(duplicate.operation?.operationId, firstId);
    const conflict = await sdk.invoke(ref, descriptor, { ...input, price: 90 }, { idempotencyKey: 'registered-price', invocationId: 'api-price-conflict' }); assert.equal(conflict.status, 'failed'); assert.ok('error' in conflict); assert.equal(conflict.error.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(conflict.operation?.operationId, firstId);
    assert.equal(f.mutations().length, 1); assert.equal(f.executions.get(capabilityId), 1); assert.equal(f.store.list('operations').length, 1);
    f.setUnknownPrice();
    const unknown = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown' });
    assert.equal(unknown.status, 'unknown', JSON.stringify(unknown)); assert.ok('error' in unknown); assert.equal(unknown.error.retryPolicy, 'inspect_only'); const unknownId = unknown.operation!.operationId;
    const unknownLink=f.port.get<Data>('business_runtime_operations',unknownId)!, unknownPlan=f.port.get<Data>('business_plans',unknownLink.planId)!, unknownStored=f.port.get<Data>('business_transport_receipts',unknownPlan.rows[0].executionId)!, originalUnknownWrite = structuredClone(f.mutations()[1]);
    assert.equal(unknownPlan.rows[0].status, 'unknown'); assert.equal(unknownStored.response.raw.outcome, 'outcome_unknown'); assert.deepEqual(unknownStored.response.raw, originalUnknownWrite.rawResponse); assert.equal(f.store.get<Data>('operations', unknownId)!.capabilityId, capabilityId); assert.equal(f.store.list('operations').length, 2);
    const unknownRepeat = await sdk.invoke(ref, descriptor, input, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown-repeat' }); assert.equal(unknownRepeat.status, 'unknown'); assert.equal(unknownRepeat.operation?.operationId, unknownId);
    const unknownConflict = await sdk.invoke(ref, descriptor, { ...input, price: 90 }, { idempotencyKey: 'registered-unknown-price', invocationId: 'api-price-unknown-conflict' }); assert.equal(unknownConflict.status, 'failed'); assert.ok('error' in unknownConflict); assert.equal(unknownConflict.error.code, 'IDEMPOTENCY_CONFLICT');
    const readsBefore = f.platform().filter(row => row.input.path === '/v5/product/info/prices').length, writesBefore = f.mutations().length, executeBefore = f.executions.get(capabilityId);
    const unresolved = await transport.inspect(unknownId); assert.equal(unresolved.status, 'unknown'); assert.equal(unresolved.operation?.operationId, unknownId);
    f.confirmPrice(); const inspected = await transport.inspect(unknownId); assert.equal(inspected.status, 'ok', JSON.stringify(inspected)); assert.ok('data' in inspected); const inspectedData = inspected.data as Data;
    assert.equal(inspectedData.planId,unknownPlan.planId); assert.equal(inspectedData.rows[0].status,'succeeded'); assert.equal(inspected.operation?.operationId,unknownId); assert.deepEqual(f.port.get<Data>('business_transport_receipts',unknownPlan.rows[0].executionId)!.response.raw,originalUnknownWrite.rawResponse);
    assert.equal(f.mutations().length, writesBefore); assert.equal(f.executions.get(capabilityId), executeBefore); assert.equal(f.platform().filter(row => row.input.path === '/v5/product/info/prices').length, readsBefore + 2); assert.equal(f.store.list('operations').length, 2); assert.deepEqual(validateResult(inspected, descriptor.outputSchema), []);
    const noKey = await sdk.invoke(ref, descriptor, input, {invocationId:'api-no-intent-key'}); assert.equal(noKey.status,'ok',JSON.stringify(noKey)); assert.equal(f.store.get<Data>('operations',noKey.operation!.operationId)!.idempotencyKey,'provider-intent:api-no-intent-key'); assert.equal(f.mutations().length,writesBefore+1);
    evidence.registeredApiMutation = {
      apiOperationId: descriptor.apiOperationId, capabilityId, version: descriptor.version, effect: descriptor.effect, execution: descriptor.execution, aliases: descriptor.aliases, fixedPath: null,
      unregistered: { exactCapability: capabilityId, errorCode: unregistered.error.code, businessHttpRequests: 0, operationCount: 0 }, registration: 'same Runtime instance, then Hallmark Provider register + explicit session connection binding',
      schemaRejections: { extraWireFields: invalid.error.code, automaticIntentKey: true, businessHttpRequests: 0 }, generatedSdkCatalogIncludesOperation: true,
      succeeded: { operationId: firstId, providerExecutionId: firstStored.executionId, duplicateOperationId: duplicate.operation!.operationId, conflictError: conflict.error.code, businessMutationPosts: 1, providerExecutions: 1, originalRequest: originalWrite.input, completeRawResponse: firstStored.response.raw, completeRawReadback: firstData.rows[0].receipt.observed },
      unknown: { operationId: unknownId, providerExecutionId: unknownStored.executionId, repeatOperationId: unknownRepeat.operation!.operationId, conflictError: unknownConflict.error.code, retryPolicy: unknown.error.retryPolicy, completeOriginalRequest: originalUnknownWrite.input, completeOriginalRawResponse: originalUnknownWrite.rawResponse, unresolvedStatus: unresolved.status, inspectedStatus: inspected.status, finalState: inspected.operation!.state, readOnlyInspectionCalls: 2, additionalBusinessMutationPosts: 0, additionalProviderExecuteCalls: 0, originalRawResponsePreserved: true, completeRawReadback: inspectedData.rows[0].receipt.observed },
      automaticKey:{status:noKey.status,operationId:noKey.operation!.operationId,additionalBusinessMutationPosts:1},
      totals: { runtimeOperationCount: f.store.list('operations').length, providerMutationExecuteCalls: f.executions.get(capabilityId), businessMutationPosts: f.mutations().length, registeredQueryCount: 15, registeredMutationCount: 1 },
      actualBusinessRoutes: f.httpCalls.map(row => ({ method: row.method, route: row.route, ...(row.input?.path ? { platformPath: row.input.path } : {}) })),
      scope: 'local actual SDK/HTTP/independent Ozon gateway/domain/SQLite fixture; synthetic encrypted credentials only, no real business writes; all new mutations avoid legacy task transport',
    };
  } finally { await f.cleanup(); }
});

test('legacy unknown price retains the original operation and only readback can resolve it without another business POST', async () => {
  const f = await fixture();
  try {
    f.setUnknownPrice(); const input = { storeId:'s',offerIds:['A'],price:100,clientOperationKey:'unknown-price' };
    const first=await f.legacy('hallmark_update_price',input,'unknown-first'); assert.equal(first.status,'unknown',JSON.stringify(first)); assert.equal(first.error.retryable,false); assert.equal(f.store.get<InvocationRecord>('invocations','unknown-first')!.result!.status,'unknown'); assert.equal(f.mutations().length,1);
    const operationId=first.operation.operationId,link=f.port.get<Data>('business_runtime_operations',operationId)!,plan=f.port.get<Data>('business_plans',link.planId)!,receipt=f.port.get<Data>('business_transport_receipts',plan.rows[0].executionId)!;assert.equal(plan.rows[0].status,'unknown');assert.equal(receipt.response.raw.outcome,'outcome_unknown');
    const again=await f.legacy('hallmark_update_price',input,'unknown-repeat');assert.equal(again.operation.operationId,operationId);assert.equal(f.mutations().length,1);assert.equal(f.executions.get('hallmark.products.update_price'),1);
    const unresolved=await f.legacy('hallmark_get_operation',{operationId},'unknown-unresolved-read');assert.equal(unresolved.status,'unknown');assert.equal(unresolved.operation.operationId,operationId);assert.equal(f.mutations().length,1);
    f.confirmPrice();const inspected=await f.legacy('hallmark_get_operation',{operationId},'unknown-readback');assert.equal(inspected.status,'ok',JSON.stringify(inspected));assert.equal(inspected.data.rows[0].status,'succeeded');assert.equal(inspected.operation.operationId,operationId);assert.equal(f.mutations().length,1);assert.equal(f.store.get<Data>('operations',operationId)!.state,'succeeded');assert.deepEqual(f.port.get<Data>('business_transport_receipts',plan.rows[0].executionId)!.response.raw,receipt.response.raw);
    evidence.unknownRecovery={originalOperationId:operationId,mutationPosts:1,providerMutationExecutions:1,duplicatePreservedOperationId:true,readbackResolved:true,resubmitted:false};
  } finally {await f.cleanup();}
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

test('legacy only clarifies missing business facts; declarations and mechanical keys are optional', async () => {
  const f=await fixture();
  try {
    const missing=await f.legacy('hallmark_update_price',{storeId:'s',offerIds:['A']},'missing-price');assert.equal(missing.status,'needs_clarification');assert.deepEqual(missing.clarification.missing,['price']);assert.equal(f.mutations().length,0);
    const ambiguous=await f.legacy('hallmark_resolve_store',{query:'Al'},'ambiguous-store');assert.equal(ambiguous.status,'needs_clarification');assert.deepEqual(ambiguous.clarification.candidates.map((row:Data)=>row.id),['s','other']);
    const batch=await f.legacy('hallmark_update_stock',{storeId:'s',offerIds:['A','B'],stock:0},'missing-warehouse');assert.equal(batch.status,'needs_clarification');assert.deepEqual(batch.clarification.missing,['warehouseId']);assert.equal(f.mutations().length,0);
    const noKey=await f.legacy('hallmark_update_price',{storeId:'s',offerIds:['A'],price:100},'automatic-intent');assert.equal(noKey.status,'ok',JSON.stringify(noKey));assert.equal(noKey.data.rows[0].status,'succeeded');assert.equal(f.store.get<Data>('operations',noKey.operation.operationId)!.idempotencyKey,'provider-intent:automatic-intent');assert.equal(f.mutations().length,1);
    const rule=await f.legacy('hallmark_update_price',{storeId:'s',offerIds:['A'],price:100,valueSource:'rule:floor'},'known-value-no-statement');assert.equal(rule.status,'ok');assert.equal(rule.data.rows[0].status,'succeeded');assert.equal(f.mutations().length,2);
    evidence.requiredWriteClarifications={businessFieldsRequired:true,ambiguousCandidatesPreserved:true,warehouseRequired:true,mechanicalKeyAutomatic:true,reviewDeclarationsRemoved:true,businessMutationPosts:2};
    const originalRequest='把 A 的价格设为 100 RUB，旧调用上下文',input={storeId:'s',offerIds:['A'],price:100,clientOperationKey:'top-level-context'},before=f.executions.get('hallmark.products.update_price')??0;
    const authorized=await f.legacy('hallmark_update_price',input,'context-first',originalRequest);assert.equal(authorized.status,'ok');assert.equal(authorized.data.title,originalRequest);
    const repeated=await f.legacy('hallmark_update_price',input,'context-repeat',originalRequest);assert.equal(repeated.status,'ok');assert.equal(repeated.data.planId,authorized.data.planId);assert.equal(repeated.operation.operationId,authorized.operation.operationId);assert.equal(f.mutations().length,3);assert.equal(f.executions.get('hallmark.products.update_price'),before+1);assert.equal(f.store.list<Data>('operations').filter(operation=>operation.idempotencyKey===input.clientOperationKey).length,1);
    evidence.topLevelContext={originalUserRequestPreserved:true,sameIntentOperationId:authorized.operation.operationId,runtimeOperationsForIntent:1,providerMutationExecutions:1,businessMutationPosts:1};
  }finally{await f.cleanup();}
});
