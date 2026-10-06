import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, PRICE_REQUEST, priceArgs, LISTING_REQUEST, listingArgs, importItem, SOURCE_TIME } from './harness.ts';

const noSourceWrites = (h: Awaited<ReturnType<typeof setup>>) => assert.equal(h.state.platformWrites.length, 0, 'query/presentation/refresh must not emit platform business writes');

test('HTTP auth/session gates and persistent activation survive SQLite/service reopen', async () => {
  const h = await setup();
  try {
    const blocked = await h.tool('hallmark_list_stores'); assert.equal(blocked.error.code, 'APP_NOT_ACTIVE'); assert.equal(h.state.events.length, 0);
    const origin = await h.request('/health', undefined, 'session-main', { Origin: 'https://evil.invalid' }); assert.equal(origin.httpStatus, 403);
    const unauthorized = await fetch(h.base + '/health'); assert.equal(unauthorized.status, 401);
    await h.activate(); assert.equal((await h.tool('hallmark_list_stores')).data[0].shopName, 'Alpha');
    assert.equal((await h.tool('hallmark_list_stores', {}, undefined, 'session-other')).error.code, 'APP_NOT_ACTIVE');
    await h.restart(); assert.equal((await h.request('/sessions/session-main/app')).body.active, true);
    assert.equal((await h.tool('hallmark_app_info')).status, 'ok');
    await h.activate('session-main', false); assert.equal((await h.tool('hallmark_list_stores')).error.code, 'APP_NOT_ACTIVE');
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('real HTTP snapshot retains unknown fields, paginates exactly, and local profit isolates unknown cost', async () => {
  const h = await setup();
  try {
    await h.activate();
    const first = await h.tool('hallmark_list_store_products', { storeId: 'store-A', limit: 100 });
    assert.equal(first.status, 'ok'); assert.equal(first.data.total, 260); assert.equal(first.data.products.length, 100); assert.equal(first.data.cursor, '100');
    assert.deepEqual(first.data.products[0], h.state.products[0]); assert.equal(first.provenance.dataTime, SOURCE_TIME);
    const second = await h.tool('hallmark_list_store_products', { storeId: 'store-A', cursor: first.data.cursor, limit: 100 });
    assert.equal(second.data.products[0].offerId, 'offer-100'); assert.equal(second.data.cursor, '200');
    assert.equal(h.state.events.filter(e => e.path === '/api/store-products').length, 1, 'subsequent pages use recent local snapshot');
    const filtered = await h.tool('hallmark_filter_products', { storeId: 'store-A', maxMargin: 0.15 });
    assert.equal(filtered.data.payload.unable.length, 1); assert.equal(filtered.data.payload.products.length, 200);
    assert.equal(filtered.data.payload.matchedCount, 259); assert.equal(filtered.data.payload.truncated, true);
    assert.equal(h.store.get<any>('result_sets', filtered.data.resultSetId).payload.products.length, 259, 'bounded preview must not lose full persisted calculation results');
    assert.equal(filtered.data.payload.unable[0].referenceProfit.margin, null); assert.match(filtered.metricBasis, /非实际结算/);
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('complete collected raw endpoint preserves every original field and filters search candidates', async () => {
  const h = await setup();
  try {
    await h.activate(); const raw = await h.tool('hallmark_get_collected_item', { itemId: 'item-A' });
    assert.deepEqual(raw.data, { id: 'item-A', content: h.state.rawContent, truncated: false });
    assert.deepEqual(JSON.parse(raw.data.content).nested, { futureField: '全字段原样' }); assert.equal(raw.provenance.dataTime, undefined);
    const found = await h.tool('hallmark_search_collected_items', { query: 'Source A', limit: 100 });
    const matches = Array.isArray(found.data) ? found.data : found.data.items ?? found.data.matches;
    assert.ok(Array.isArray(matches), 'search returns an explicit candidate array');
    assert.deepEqual(matches.map((item: any) => item.id), ['item-A'], 'query must not return all unrelated collected items');
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('collected search pagination honors explicit cursor/limit without dropping source fields', async () => {
  const h = await setup();
  try {
    await h.activate(); h.state.summaries = Array.from({ length: 250 }, (_, index) => ({ id: `item-${index}`, title: 'Needle collected product', skuCount: 1, futureField: { retained: index } }));
    const first = await h.tool('hallmark_search_collected_items', { query: 'Needle', limit: 100 });
    assert.equal(first.data.items.length, 100); assert.equal(first.data.total, 250); assert.equal(first.data.cursor, '100'); assert.deepEqual(first.data.items[0], h.state.summaries[0]);
    const second = await h.tool('hallmark_search_collected_items', { query: 'Needle', limit: 100, cursor: first.data.cursor });
    assert.equal(second.data.items.length, 100); assert.equal(second.data.items[0].id, 'item-100'); assert.equal(second.data.cursor, '200'); noSourceWrites(h);
  } finally { await h.close(); }
});

test('temporary render, explicit save, view opening and both refresh paths never write or redesign', async () => {
  const h = await setup();
  try {
    await h.activate(); await h.tool('hallmark_list_store_products', { storeId: 'store-A' });
    const spec = { id: 'view-e2e', title: '固定设计', layout: { type: 'column', children: ['note'] }, widgets: [{ id: 'note', type: 'text', text: '源数据表' }], bindings: [{ id: 'data', datasetKey: 'store_products:store-A', fieldMap: {} }] };
    assert.equal((await h.tool('hallmark_render_view', { spec })).status, 'ok'); assert.equal(h.store.list('entries').length, 0);
    const missingSave = await h.request('/tools/hallmark_save_component', { sessionId: 'session-main', arguments: { viewId: spec.id } }); assert.equal(missingSave.httpStatus, 400); assert.equal(h.store.list('entries').length, 0);
    const saved = await h.tool('hallmark_save_component', { viewId: spec.id, userRequest: '保存这个组件' }, '保存这个组件'); assert.equal(saved.status, 'ok');
    const before = h.store.get<any>('components', spec.id).spec;
    assert.equal((await h.request(`/views/${spec.id}/data?sessionId=session-main`)).body.status, 'ok');
    assert.equal((await h.request('/refresh', { datasetKey: 'store_products:store-A', sessionId: 'session-main' })).body.status, 'ok');
    assert.equal((await h.tool('hallmark_refresh_data', { datasetKey: 'store_products:store-A' })).status, 'ok');
    assert.deepEqual(h.store.get<any>('components', spec.id).spec, before); assert.equal(h.state.events.filter(e => e.path === '/api/store-products/sync').length, 2);
    await h.restart(); assert.deepEqual(h.store.get<any>('components', spec.id).spec, before); assert.equal((await h.request(`/views/${spec.id}/data?sessionId=session-main`)).body.status, 'ok');
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('failed source sync preserves successful snapshot and published component binding', async () => {
  const h = await setup();
  try {
    await h.activate(); assert.equal((await h.tool('hallmark_refresh_data', { datasetKey: 'store_products:store-A' })).status, 'ok');
    const previous = h.store.get<any>('snapshots', 'store_products:store-A'); h.state.syncError = true;
    const failure = await h.tool('hallmark_refresh_data', { datasetKey: 'store_products:store-A' }); assert.equal(failure.error.code, 'STORE_SYNC_FAILED');
    const current = h.store.get<any>('snapshots', 'store_products:store-A'); assert.deepEqual(current.payload, previous.payload); assert.equal(current.lastSuccessAt, previous.lastSuccessAt); assert.equal(current.state, 'failed');
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('missing source timestamps stay null through first read, result set, refresh and restart', async () => {
  const h = await setup({ sourceTime: null });
  try {
    await h.activate(); const list = await h.tool('hallmark_list_store_products', { storeId: 'store-A' });
    assert.ok(list.provenance.dataTime == null, 'fetch time must never be fabricated as source time');
    assert.equal(h.store.get<any>('snapshots', 'store_products:store-A').dataTime, null);
    const filtered = await h.tool('hallmark_filter_products', { storeId: 'store-A', maxMargin: 0.15 }); assert.equal(filtered.data.dataTime, null);
    const refresh = await h.tool('hallmark_refresh_data', { datasetKey: 'store_products:store-A' }); assert.equal(refresh.data.snapshot.dataTime, null);
    await h.restart(); assert.equal(h.store.get<any>('snapshots', 'store_products:store-A').dataTime, null);
    noSourceWrites(h);
  } finally { await h.close(); }
});

test('ambiguous store, implicit listing scope and read-path writes never dispatch writes or tasks', async () => {
  const h = await setup();
  try {
    await h.activate(); assert.equal((await h.tool('hallmark_resolve_store', { query: 'Al' })).status, 'needs_clarification');
    assert.equal((await h.tool('hallmark_list_product', { storeId: 'store-A' }, '上品')).status, 'needs_clarification');
    const invalidRead = await h.tool('hallmark_get_platform_data', { storeId: 'store-A', path: '/v3/product/import', body: { items: [] } }); assert.equal(invalidRead.error.code, 'ENDPOINT_NOT_ALLOWED');
    const wrongMethod = await h.tool('hallmark_get_platform_data', { storeId: 'store-A', path: '/v3/product/info/list', method: 'GET', body: {} }); assert.equal(wrongMethod.error.code, 'ENDPOINT_NOT_ALLOWED');
    h.state.tasks = []; const noTask = await h.tool('hallmark_get_platform_data', { storeId: 'store-A', path: '/v3/product/info/list' }); assert.equal(noTask.error.code, 'TASK_CONTEXT_REQUIRED');
    assert.equal(h.state.assignments, 0); noSourceWrites(h);
  } finally { await h.close(); }
});

test('price/stock execute one explicit write each, verify exact currency/warehouse, and persist idempotency', async () => {
  const h = await setup();
  try {
    await h.activate(); const price = await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST); assert.equal(price.status, 'ok');
    assert.deepEqual(h.state.platformWrites[0].body, { prices: [{ offer_id: 'offer-A', price: '100', currency_code: 'RUB' }] });
    await h.restart(); assert.equal((await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST)).status, 'ok'); assert.equal(h.state.platformWrites.length, 1);
    const stockRequest = 'Alpha 的 offer-A 在仓库12库存改为0';
    const stock = await h.tool('hallmark_update_stock', { storeId: 'store-A', offerIds: ['offer-A'], warehouseId: '12', stock: 0, valueSource: 'user', clientOperationKey: 'stock-key', userRequest: stockRequest }, stockRequest);
    assert.equal(stock.status, 'ok'); assert.deepEqual(h.state.platformWrites[1].body, { stocks: [{ offer_id: 'offer-A', warehouse_id: 12, stock: 0 }] });
    assert.ok(h.state.platformReads.some(read => read.path === '/v2/product/info/stocks-by-warehouse/fbs')); assert.equal(h.state.platformWrites.length, 2);
  } finally { await h.close(); }
});

test('unknown price across reopen cannot be retried by same/new key; status query only reads', async () => {
  const h = await setup();
  try {
    await h.activate(); h.state.writeUnknown = true;
    const first = await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST); assert.equal(first.status, 'unknown');
    await h.restart(); assert.equal(h.state.platformWrites.length, 1);
    assert.equal((await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST)).status, 'unknown');
    assert.equal((await h.tool('hallmark_update_price', { ...priceArgs, clientOperationKey: 'changed-key' }, PRICE_REQUEST)).status, 'unknown');
    assert.equal(h.state.platformWrites.length, 1); h.state.price = 100;
    assert.equal((await h.tool('hallmark_get_operation', { operationId: first.operation.operationId })).status, 'ok');
    assert.equal(h.state.platformWrites.length, 1); const ids = h.state.platformReads.map(read => read.requestId); assert.equal(new Set(ids).size, ids.length);
  } finally { await h.close(); }
});

test('missing verification currency cannot claim user-required price/currency success', async () => {
  const h = await setup();
  try {
    await h.activate(); h.state.currency = null;
    const result = await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST);
    assert.equal(result.status, 'unknown', 'matching bare number without required currency is not verified success');
    assert.equal(h.state.platformWrites.length, 1);
  } finally { await h.close(); }
});

test('offer identity never aliases a numerically equal platform product ID during verification', async () => {
  const h = await setup();
  try {
    await h.activate(); const request = 'Alpha 的 offer_id 为字符串1的商品售价设为100 RUB';
    const result = await h.tool('hallmark_update_price', { ...priceArgs, offerIds: ['1'], userRequest: request }, request);
    // The synthetic read returns offer_id=offer-A with product_id=1. These are different ID domains.
    assert.equal(result.status, 'unknown'); assert.equal(h.state.platformWrites.length, 1);
  } finally { await h.close(); }
});

test('noncanonical warehouse and unsupported activity-price requests are honest no-write failures', async () => {
  const h = await setup();
  try {
    await h.activate(); const request = 'Alpha 的 offer-A库存改为0';
    const malformed = await h.tool('hallmark_update_stock', { storeId: 'store-A', offerIds: ['offer-A'], warehouseId: '012', stock: 0, valueSource: 'user', clientOperationKey: 'bad-stock', userRequest: request }, request);
    assert.equal(malformed.status, 'needs_clarification'); assert.ok(malformed.clarification.missing.includes('warehouseId'));
    const actionRequest = 'Alpha 商品1的活动9价格设为100 RUB';
    const action = await h.tool('hallmark_update_price', { ...priceArgs, offerIds: undefined, productIds: ['1'], actionId: 9, userRequest: actionRequest }, actionRequest);
    assert.equal(action.status, 'unavailable'); assert.equal(action.error.code, 'ACTION_PRICE_NOT_SUPPORTED'); noSourceWrites(h);
  } finally { await h.close(); }
});

test('traceable complete source import prepares one internal task and preserves explicit mapping/idempotency', async () => {
  const h = await setup();
  try {
    await h.activate(); const result = await h.tool('hallmark_list_product', listingArgs, LISTING_REQUEST); assert.equal(result.status, 'ok');
    assert.equal(h.state.assignments, 1); assert.equal(h.state.platformWrites.length, 1);
    const call = h.state.platformWrites[0]; assert.equal(call.path, '/v3/product/import'); assert.deepEqual(call.mappings, [{ skuCode: 'sku-A', offerId: 'listed-A' }]);
    assert.equal(call.body.items[0]._sourceSkuId, undefined); assert.deepEqual(call.body.items[0].images, importItem.images);
    assert.ok(h.store.list<any>('operations').some(op => op.kind === 'listing_task_prepared' && op.input.created === true));
    await h.restart(); assert.equal((await h.tool('hallmark_list_product', listingArgs, LISTING_REQUEST)).status, 'ok'); assert.equal(h.state.assignments, 1); assert.equal(h.state.platformWrites.length, 1);
  } finally { await h.close(); }
});

test('untraceable images/missing import fields block before assignments; imported acceptance remains pending', async () => {
  const h = await setup();
  try {
    await h.activate(); const rejected = await h.tool('hallmark_list_product', { ...listingArgs, importItems: [{ ...importItem, type_id: 0, images: ['https://example.invalid/invented.jpg'] }] }, LISTING_REQUEST);
    assert.equal(rejected.status, 'needs_clarification'); assert.equal(h.state.assignments, 0); noSourceWrites(h);
    h.state.importStatus = 'pending'; const pending = await h.tool('hallmark_list_product', { ...listingArgs, clientOperationKey: 'second-listing-key' }, LISTING_REQUEST); assert.equal(pending.status, 'unknown');
    await h.tool('hallmark_get_operation', { operationId: pending.operation.operationId }); assert.equal(h.state.platformWrites.length, 1);
    assert.equal((await h.tool('hallmark_list_product', { ...listingArgs, clientOperationKey: 'third-listing-key' }, LISTING_REQUEST)).status, 'unknown'); assert.equal(h.state.platformWrites.length, 1);
  } finally { await h.close(); }
});

test('cross-session operation visibility and idempotency keys remain isolated', async () => {
  const h = await setup();
  try {
    await h.activate(); const original = await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST); assert.equal(original.status, 'ok');
    await h.activate('session-other');
    const other = await h.tool('hallmark_get_operation', { operationId: original.operation.operationId }, undefined, 'session-other'); assert.equal(other.error.code, 'OPERATION_NOT_FOUND');
    assert.equal((await h.request(`/operations/${original.operation.operationId}?sessionId=session-other`)).httpStatus, 404);
    const stolenKey = await h.tool('hallmark_update_price', priceArgs, PRICE_REQUEST, 'session-other'); assert.equal(stolenKey.error.code, 'OPERATION_NOT_FOUND');
    const ownList = await h.tool('hallmark_list_operations', {}, undefined, 'session-other'); assert.deepEqual(ownList.data, []);
    assert.equal(h.state.platformWrites.length, 1);
  } finally { await h.close(); }
});

test('saved write-query injection is rejected and background refresh only invokes read/sync', async () => {
  const h = await setup();
  try {
    await h.activate();
    const rejected = await h.tool('hallmark_save_entry', { title: 'unsafe query', binding: { id: 'data', query: { tool: 'hallmark_update_price', params: priceArgs }, fieldMap: {} }, userRequest: '保存入口' }, '保存入口');
    assert.equal(rejected.error.code, 'QUERY_NOT_READ_ONLY'); assert.equal(h.store.list('entries').length, 0);
    h.store.put('queries', 'legacy-bad', { tool: 'hallmark_update_price', params: priceArgs });
    assert.equal((await h.core.refreshDatasetBackground('query:legacy-bad')).error?.code, 'DATASET_NOT_SUPPORTED');
    await h.activate('session-main', false); assert.equal((await h.core.refreshDatasetBackground('store_products:store-A')).status, 'ok');
    assert.ok(h.state.events.some(event => event.path === '/api/store-products/sync')); noSourceWrites(h);
  } finally { await h.close(); }
});

test('unknown dataset store cannot publish a successful empty snapshot', async () => {
  const h = await setup();
  try {
    await h.activate(); const result = await h.tool('hallmark_refresh_data', { datasetKey: 'store_products:not-a-configured-store' });
    assert.equal(result.status, 'failed', 'a missing source store must not be interpreted as a successfully refreshed empty dataset');
    assert.equal(result.error.code, 'STORE_NOT_FOUND');
    assert.ok(h.store.get<any>('snapshots', 'store_products:not-a-configured-store')?.payload == null); noSourceWrites(h);
  } finally { await h.close(); }
});

test('large raw is delivered by lossless spill reference without echoing the full inline raw', async () => {
  const h = await setup({ spillThresholdBytes: 8192 });
  try {
    await h.activate(); h.state.rawContent = JSON.stringify({ sourceBigField: 'x'.repeat(128 * 1024), future: { retained: true } });
    const result = await h.tool('hallmark_get_collected_item', { itemId: 'item-A' }); assert.equal(result.status, 'ok');
    assert.ok(result.data.spill?.path, 'large result has a complete file reference');
    assert.ok(!Object.hasOwn(result.data, 'raw'), 'spill must not duplicate 128KiB raw inline');
    assert.ok(JSON.stringify(result).length < 8192, 'tool envelope is bounded, not just accompanied by an extra file');
    const spilled = JSON.parse(await readFile(result.data.spill.path, 'utf8')); assert.equal(spilled.content, h.state.rawContent); assert.equal(spilled.truncated, false);
    noSourceWrites(h);
  } finally { await h.close(); }
});
