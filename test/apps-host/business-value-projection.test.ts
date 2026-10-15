import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime, RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import {BUSINESS_DESCRIPTORS, executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import {BusinessPricingRepository, legacyReferenceDraft} from '../../packages/business-pricing/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost, HttpAppsHostTransport, type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {BusinessRowInput, TrustedRowContext} from '../../packages/app-hallmark/src/operations/types.ts';
import type {CapabilityResult, JsonValue} from '../../packages/app-contracts/src/index.ts';
import {realAncillary, realPricingSettings, realStoreProducts} from '../real-data/corpus.ts';

const NOW = '2026-10-15T00:00:00.000Z';

async function fixture() {
  const product = realStoreProducts().products[0], capturedRules = realPricingSettings();
  const store = new RuntimeStore(':memory:'), runtime = new AppsRuntime(store);
  const cleanup: Array<() => void | Promise<unknown>> = [() => store.close(), () => runtime.dispose()];
  const close = async () => {
    const errors: unknown[] = [];
    for (const dispose of cleanup.splice(0).reverse()) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Business projection fixture cleanup failed');
  };
  try {
  const businessStore = new HallmarkStorePort(store, 'projection-values');
  const pricing = new BusinessPricingRepository(businessStore, () => NOW);
  const draft = legacyReferenceDraft(NOW);
  draft.plans[0] = {...draft.plans[0], fixedMinor: capturedRules.fixedMinor,
    logisticsMicrosPerGram: capturedRules.logisticsMicrosPerGram, commissionPpm: capturedRules.commissionPpm};
  pricing.save(product.storeId, draft, 0);
  pricing.save(product.storeId, {...draft, maxAutoPriceMinor: null}, 1);
  let reads = 0, sourceLoads = 0;
  const forbidden = async (): Promise<never> => { throw new Error('Draft projection must never review or submit a platform operation'); };
  const operations = new BusinessOperations({
    store: businessStore, now: () => NOW,
    source: {async load({storeId, row}) {
      sourceLoads++;
      const context: TrustedRowContext = {identity: {storeId, ...row.target},
        current: {price: product.price, currency_code: product.currency}, source: product, procurement: []};
      if (row.action === 'price') context.pricingQuote = pricing.quote({storeId, action: row.action,
        pricingMode: 'manual', purchaseMinor: product.profit.purchaseMinor,
        weightGrams: product.profit.packageGrams, priceMinor: Math.round(Number(row.payload.price) * 100), at: NOW});
      return context;
    }},
    transport: {execute: forbidden, inspect: forbidden}, reviewer: {review: forbidden},
  });
  runtime.register({manifest: {manifestVersion: 1, appId: 'hallmark', displayName: 'Offline business values',
    providerPackage: 'offline-business-values', providerVersion: '1.0.0', runtimeProtocolMajor: 1, resourceTypes: ['business-plan']},
    descriptors: BUSINESS_DESCRIPTORS.filter(d => ['hallmark.plan.create', 'hallmark.plan.get'].includes(d.capabilityId)),
    execute(context) { reads++; return executeBusiness(operations, businessStore, context); }, async dispose() {}});
  const agent = {id: 'business-values-session'}, tools = new Map<string, NativeGatewayTool>();
  runtime.addConnection({appId: 'hallmark', connectionId: 'projection-values', displayName: 'Offline replay', config: {}, configRevision: 1, enabled: true});
  runtime.bind({sessionId: agent.id, appId: 'hallmark', connectionId: 'projection-values', enabled: true, boundAt: NOW});
  const token = randomUUID() + randomUUID();
  const server = createAppsServer({runtime, presentation: new AppsPresentationService({store, runtime}), token});
  cleanup.push(async () => {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const host = new AppsHost({agents: {get: id => id === agent.id ? agent : undefined}, tools: {
    register: tool => { tools.set(tool.name, tool); return () => { tools.delete(tool.name); }; },
  }}, new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`, token));
  cleanup.push(() => host.dispose());
  await host.start(); host.attachApp('hallmark');
  const call = async (capabilityId: string, input: Record<string, JsonValue>) => {
    const tool = tools.get('apps_invoke')!;
    const args = {appId: 'hallmark', connectionId: 'projection-values', capabilityId, capabilityVersion: '1.0.0', input};
    const value = await tool.execute(args, {agent, signal: new AbortController().signal}) as {
      result: CapabilityResult; modelProjection: {content: string; fullResultRef?: string};
    };
    assert.equal(value.result.status, 'ok');
    const rendered = tool.output.render(args, value) as Array<{type: string; text: string}>;
    assert.equal(rendered[0].text, value.modelProjection.content);
    assert.ok(Buffer.byteLength(rendered[0].text) <= 16384);
    assert.equal(value.modelProjection.fullResultRef, undefined);
    const model = JSON.parse(rendered[0].text);
    assert.equal(model.data.modelView, 'business-operation-summary');
    return {model: model.data, original: (value.result as {data: any}).data};
  };
  return {product, capturedRules, store, operations, call,
    counts: () => ({reads, sourceLoads}),
    close,
  };
  } catch (error) {
    try { await close(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Business projection fixture setup and cleanup failed', {cause: error});
    }
    throw error;
  }
}

test('saved stock zero, unarchive false and unknown binding costs remain distinct in native model output over HTTP', async () => {
  const f = await fixture();
  try {
    const target = {offerId: f.product.offerId, productId: f.product.productId};
    const warehouses = realAncillary('ozonWarehouses');
    const warehouseId = warehouses.response.warehouses[0].warehouse_id;
    // These are explicit offline change intents, not claims that the captured product was changed.
    const rows: BusinessRowInput[] = [
      {rowId: 'set-zero-stock', action: 'stock', target, payload: {stock: 0, warehouse_id: warehouseId}},
      {rowId: 'remove-archive', action: 'archive', target, payload: {archived: false}},
    ];
    const created = await f.call('hallmark.plan.create', {storeId: f.product.storeId, rows: rows as unknown as JsonValue});
    for (const data of [created, await f.call('hallmark.plan.get', {planId: created.original.planId})]) {
      assert.deepEqual(data.model.rows.map((row: any) => ({rowId: row.rowId, action: row.action, values: row.values})), [
        {rowId: 'set-zero-stock', action: 'stock', values: {stock: 0, warehouse_id: warehouseId}},
        {rowId: 'remove-archive', action: 'archive', values: {archived: false}},
      ]);
      for (const row of data.model.rows) {
        assert.deepEqual(row.binding, {amount: null, currency: null, missing: []}, 'unknown cost and currency must remain explicit null, never zero or omitted');
        assert.deepEqual(row.issues, []); assert.equal(row.status, 'draft');
      }
      assert.deepEqual(data.original.rows.map((row: any) => row.payload), rows.map(row => row.payload));
    }
    assert.deepEqual(f.operations.get(created.original.planId).rows.map(row => row.payload), rows.map(row => row.payload));
    assert.deepEqual(f.counts(), {reads: 2, sourceLoads: 2}); assert.equal(f.store.list('operations').length, 0);
  } finally { await f.close(); }
});

test('saved price quotation keeps monetary units, ppm, nullable hard floors and rule revision through native HTTP model rendering', async () => {
  const f = await fixture();
  try {
    // Independent numeric oracle: frozen cost 2663 cents, 100 g, fees 316 + 393 + 2700 cents.
    // 13500 - 6072 = 7428 cents profit; floor(7428 / 13500 * 1000000) = 550222 ppm.
    assert.equal(f.product.profit.purchaseMinor, 2663); assert.equal(f.product.profit.packageGrams, 100);
    assert.equal(f.capturedRules.fixedMinor, 316); assert.equal(f.capturedRules.logisticsMicrosPerGram, 39300); assert.equal(f.capturedRules.commissionPpm, 200000);
    const row: BusinessRowInput = {rowId: 'manual-price', action: 'price',
      target: {offerId: f.product.offerId, productId: f.product.productId}, payload: {price: '135.00', currency_code: f.product.currency}};
    const created = await f.call('hallmark.plan.create', {storeId: f.product.storeId, rows: [row] as unknown as JsonValue});
    for (const data of [created, await f.call('hallmark.plan.get', {planId: created.original.planId})]) {
      const projected = data.model.rows[0], quote = projected.pricingQuote;
      assert.deepEqual(projected.values, {price: '135.00', currency_code: 'CNY'});
      assert.equal(quote.status, 'ready'); assert.equal(quote.configRevision, 2); assert.equal(quote.currency, 'CNY');
      assert.equal(quote.planId, 'legacy-unified-reference'); assert.equal(quote.selectionMode, 'fixed');
      assert.equal(quote.targetMarginPpm, 50000); assert.equal(quote.minimumMarginPpm, null);
      assert.equal(quote.minimumAllowedPriceMinor, null); assert.equal(quote.evaluatedPriceMinor, 13500);
      assert.equal(quote.suggestedPriceMinor, 4497);
      assert.deepEqual(quote.breakdown, {purchaseMinor: 2663, fixedMinor: 316, logisticsMinor: 393,
        commissionMinor: 2700, totalCostMinor: 6072, profitMinor: 7428, marginPpm: 550222});
      assert.deepEqual(quote.issues, []); assert.ok(quote.warnings.length > 0);
      assert.equal(projected.context, undefined); assert.equal(projected.payload, undefined);
      assert.deepEqual(data.original.rows[0].pricingQuote.breakdown, quote.breakdown);
    }
    assert.equal(f.operations.get(created.original.planId).rows[0].context?.pricingQuote?.configRevision, 2);
    assert.deepEqual(f.counts(), {reads: 2, sourceLoads: 1}); assert.equal(f.store.list('operations').length, 0);
  } finally { await f.close(); }
});
