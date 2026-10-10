import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeStore } from '../../packages/app-runtime/src/store.ts';
import { HallmarkStorePort } from '../../packages/app-hallmark/src/store.ts';
import { HallmarkBusinessAdapter, businessImageUrls, platformIssues } from '../../packages/app-hallmark/src/operations-adapter.ts';
import { BusinessOperations } from '../../packages/app-hallmark/src/operations/index.ts';
import {BusinessPricingRepository} from '../../packages/business-pricing/src/index.ts';
import {businessConnectedClient,connectionBusinessGateway,localBusinessProducts} from '../../packages/app-hallmark/src/operations-client.ts';
import { businessHash } from '../../packages/app-hallmark/src/operations/index.ts';
import type { AdapterResponse, CoreBroker, CoreClient } from '../../packages/core/src/types.ts';
import {profitRows} from '../../packages/core/src/types.ts';
import type { BusinessExecutionInput, BusinessRowInput, TrustedRowContext } from '../../packages/app-hallmark/src/operations/types.ts';
import { createDecisionReviewer } from '../../packages/service/src/decision-review.ts';
import type { IndependentReviewRequest, SemanticReviewRequest } from '../../packages/app-contracts/src/business-review.ts';
import { CollectionService } from '../../packages/collection/src/index.ts';
import { hash as collectionHash } from '../../packages/collection/src/normalize.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ok = (raw: unknown): AdapterResponse => ({ status: 'ok', raw });
const platform = (response: unknown, httpStatus = 200): AdapterResponse => ok({ outcome: 'response_received', httpStatus, response });
const row = (action: BusinessRowInput['action'] = 'price'): BusinessRowInput & { rowId: string } => ({ rowId: 'row', action, target: { offerId: 'offer', productId: 100 }, payload: action === 'listing' ? { offer_id: 'offer', name: 'Cup', price: '12', currency_code: 'CNY', attributes: [] } : { price: '12', currency_code: 'CNY' }, ...(action === 'listing' ? { procurement: [{ itemId: 'source', sourceSkuId: 'source-sku', quantity: 1 }] } : {}) });
const context: TrustedRowContext = { identity: { storeId: 'bill', offerId: 'offer', productId: '100', sku: '200' }, current: { price: '10', currency_code: 'CNY' }, source: {}, procurement: [] };

function fixture() {
  const database = new RuntimeStore(':memory:'), store = new HallmarkStorePort(database, 'connection');
  let currentPrice: string | number = 10, products: any[] = [{ storeId: 'bill', offerId: 'offer', productId: 100 }], detail: any = { id: 'source', title: 'Cup', currency: 'CNY', skus: [{ sourceSkuId: 'source-sku', price: 3.43, image: 'https://example.com/source.jpg' }] }, rawCall = platform({ result: [{ updated: true }] }), taskLog: any[] = [], importResult: any = { result: { items: [{ offer_id: 'offer', product_id: 100, status: 'imported' }] } }, onRead: ((path: string) => AdapterResponse | undefined) | undefined, archived = false;
  const writes: any[] = [], reads: any[] = [], taskReads: any[] = [];
  const read = async (_store: string, input: any): Promise<AdapterResponse> => {
    reads.push(input); const override = onRead?.(input.path); if (override) return override;
    if (input.path === '/v3/product/info/list') return platform({ items: [{ offer_id: 'offer', id: 100, sku: 200, is_archived: archived }] });
    if (input.path === '/v5/product/info/prices') return platform({ result: { items: [{ offer_id: 'offer', product_id: 100, price: { price: currentPrice, old_price: '20.00', min_price: 5, currency_code: 'CNY' } }] } });
    if (input.path === '/v1/product/import/info') return platform(importResult);
    if (input.path === '/v4/product/info/attributes') return platform({ result: [{ offer_id: 'offer', id: 100, attributes: [] }] });
    if (input.path.includes('/actions/')) return platform({ result: { products: [], last_id: 0 } });
    throw new Error(`Unexpected read ${input.path}`);
  };
  const client: CoreClient & { storeDataRead: typeof read } = {
    getStores: async () => ok([{ id: 'bill' }]), getStoreProducts: async () => ok({ stores: [{ id: 'bill' }], products }), syncStoreProducts: async () => ok({}), getTargetMargin: async () => ok({}), searchCollectedItems: async () => ok([]), getCollectedItem: async () => ok({}), getCollectedItemDetail: async () => ok(detail),
    platformRead: async (_task, input) => read('bill', input), storeDataRead: read,
    platformCall: async (taskId, input) => { writes.push({ taskId, ...input }); if (rawCall.status === 'ok' && input.path === '/v1/product/import/prices') currentPrice = (input.body as any).prices[0].price; return rawCall; },
    getTask: async taskId => { taskReads.push(taskId); return ok({ id: taskId, platformCalls: taskLog }); },
  };
  const broker: CoreBroker = { getStoreTask: async () => ok({ taskId: 'task' }), getListingTask: async () => ok({ taskId: 'listing-task' }), requestId: (_kind, executionId) => `request-${executionId}` };
  const gateway:any={hasStore:(id:string)=>id==='bill',getStore:()=>({id:'bill',enabled:true,hasCredentials:true,credentialRevision:1}),request:async(_id:string,input:any)=>['/v3/product/import','/v1/product/import/prices','/v2/products/stocks','/v1/product/archive','/v1/product/unarchive','/v1/actions/products/update','/v2/actions/products/deactivate'].includes(input.path)?client.platformCall('direct-fixture',input):read('bill',input)};
  const adapter = new HallmarkBusinessAdapter({ store, client, broker, gateway });
  const catalogList=store.list.bind(store);store.list=((collection:string)=>collection==='business_catalog'?products:catalogList(collection)) as typeof store.list;
  return { database, store, adapter, client, broker, gateway, writes, reads, taskReads, price(value: string | number) { currentPrice = value; }, products(value: any[]) { products = value; }, detail(value: any) { detail = value; }, call(value: AdapterResponse) { rawCall = value; }, taskLog(value: any[]) { taskLog = value; }, importResult(value: any) { importResult = value; }, read(fn: typeof onRead) { onRead = fn; } };
}

test('price read shapes and decimal formatting normalize to the same action fields', async () => {
  const f = fixture(); try {
    f.products([{ store_id: 'bill', offer_id: 'offer', product_id: 100 }]);
    const result = await f.adapter.load({ storeId: 'bill', row: { ...row(), payload: { price: '12.00', old_price: 20, min_price: '5.00' } }, fresh: true });
    assert.deepEqual(result.current, { price: '10', old_price: '20', min_price: '5', currency_code: 'CNY' });
    assert.deepEqual(result.normalizedPayload, { price: '12', old_price: '20', min_price: '5', currency_code: 'CNY' });
    assert.equal(result.policy?.breakEvenPrice, null);
  } finally { f.database.close(); }
});

test('native archive readback updates the catalogue immediately without deleting source or cost identity',async()=>{
  const f=fixture();try{
    const sources=[{sourceSkuMatched:true,productId:'source',skuCode:'source-sku'}];
    f.products([{storeId:'bill',offerId:'offer',productId:100,sources,price:'12.00',profit:{purchaseMinor:343}}]);
    f.call(platform({result:true}));
    f.read(path=>path==='/v3/product/info/list'?platform({items:[{id:100,offer_id:'offer',sku:200,is_archived:true,statuses:{is_created:true,moderate_status:'approved'}}]}):undefined);
    const input:BusinessExecutionInput={executionId:'archive-observation',storeId:'bill',row:{...row('archive'),payload:{archived:true}},context};
    const result=await f.adapter.execute(input);assert.equal(result.status,'succeeded');assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'/v1/product/archive');
    const saved=f.store.get<any>('business_catalog',businessHash(['bill','offer']));
    assert.equal(saved.status,'archived');assert.equal(saved.saleState,'archived');assert.equal(saved.platformProduct.is_archived,true);assert.deepEqual(saved.sources,sources);assert.equal(saved.price,'12.00');assert.equal(saved.profit.purchaseMinor,343);assert.ok(saved.observedAt);
    await f.adapter.inspect(input);assert.equal(f.writes.length,1,'observing the archive does not repeat the write');
  }finally{f.database.close();}
});

test('listing description alias is saved, reviewed and imported as the same complete 4191 text', async () => {
  const f = fixture(); try {
    f.products([]); f.detail({ id: 'source', title: 'Cup', source: 'taobao_tmall', currency: 'CNY', skus: [{ sourceSkuId: 'source-sku', goodsPrice: 3.43 }] });
    f.read(path => path === '/v3/product/info/list' ? platform({ items: [] }) : path === '/v1/product/import/info' ? platform({ result: { items: [{ offer_id: 'offer', status: 'pending' }] } }) : undefined);
    f.call(platform({ result: { task_id: 1234 } }));
    const reviewed: any[] = [];
    const engine = new BusinessOperations({ store: f.store, source: f.adapter, transport: f.adapter, reviewer: { async review(request) {
      reviewed.push(request);
      return { status: 'passed', questions: request.questions.map(q => ({ id: q.id, version: q.version, status: 'passed', reviewer: 'decisions', reasonCode: 'MATCH' })), evidence: { versions: request.versions, requests: [], thresholds: { pass: .95, reject: .1 } } };
    } } });
    const description = 'Подставка для тарелок.\nВ комплекте одна подставка.\n不含餐具。';
    const listing = { ...row('listing'), target: { offerId: 'offer' }, payload: { ...row('listing').payload, description } };
    const original = structuredClone(listing);
    const draft = await engine.create({ storeId: 'bill', rows: [listing] });
    assert.deepEqual(listing, original, 'normalization does not mutate the caller input');
    assert.equal(Object.hasOwn(draft.rows[0].payload, 'description'), false);
    assert.deepEqual(draft.rows[0].payload.attributes, [{ id: 4191, complex_id: 0, values: [{ value: description }] }]);
    assert.ok(draft.rows[0].corrections.some(text => text.includes('4191')));
    assert.equal(reviewed.length, 0, 'saving still performs no semantic review');
    const submitted = await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(submitted.rows[0].status, 'pending');
    const details = reviewed.find(request => request.questions[0].id === 'description-facts');
    assert.deepEqual(details?.draft.attributes, draft.rows[0].payload.attributes);
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].path, '/v3/product/import');
    assert.deepEqual(f.writes[0].body.items[0].attributes, details.draft.attributes);
    assert.equal(Object.hasOwn(f.writes[0].body.items[0], 'description'), false);
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(f.writes.length, 1, 'a pending execution is inspected, never reimported');
  } finally { f.database.close(); }
});

test('explicit 4191 wins over equal or conflicting description aliases without blocking or duplicate attributes', async () => {
  const f = fixture(); try {
    f.products([]);
    const canonical = { id: 4191, complex_id: 0, values: [{ value: 'Уже подготовленное описание.\nВторая строка.' }] };
    const rich = { id: 11254, complex_id: 0, values: [{ value: '{"content":[]}' }] }, other = { id: 85, values: [{ dictionary_value_id: 7 }] };
    for (const alias of [canonical.values[0].value, 'Другое описание.']) {
      const loaded = await f.adapter.load({ storeId: 'bill', row: { ...row('listing'), payload: { ...row('listing').payload, description: alias, attributes: [other, { ...canonical, id: '4191' }, rich] } }, fresh: false });
      assert.deepEqual(loaded.normalizedPayload?.attributes, [other, canonical, rich]);
      assert.equal(Object.hasOwn(loaded.normalizedPayload!, 'description'), false);
      assert.equal(loaded.issues?.length, 0);
      assert.ok(loaded.corrections?.some(text => text.includes(alias === canonical.values[0].value ? '相同' : '保留')));
      assert.deepEqual((loaded.reviewUnits?.find(unit => unit.id === 'shared-description')?.draft as any).attributes, [canonical, rich]);
    }
  } finally { f.database.close(); }
});

test('empty 4191 is filled once and fresh normalization preserves text, other attributes and review content', async () => {
  const f = fixture(); try {
    f.products([]); f.read(path => path === '/v3/product/info/list' ? platform({ items: [] }) : undefined);
    const description = '  Серебристая подставка.\n\n中文尺寸说明。  ', rich = { id: 11254, values: [{ value: '{"content":[]}' }] };
    for (const values of [undefined, [], [{ value: '' }], [{ value: ' \n ' }]]) {
      const listing = { ...row('listing'), payload: { ...row('listing').payload, description, attributes: [{ id: 4191, values }, rich] } };
      const first = await f.adapter.load({ storeId: 'bill', row: listing, fresh: false });
      assert.deepEqual(first.normalizedPayload?.attributes, [{ id: 4191, complex_id: 0, values: [{ value: description }] }, rich]);
      const second = await f.adapter.load({ storeId: 'bill', row: { ...listing, payload: first.normalizedPayload! }, fresh: true });
      assert.deepEqual(second.normalizedPayload, first.normalizedPayload);
      assert.deepEqual(second.reviewUnits, first.reviewUnits);
      assert.equal(second.corrections?.some(text => text.includes('description') || text.includes('4191')), false);
    }
  } finally { f.database.close(); }
});

test('blank description does not create an empty attribute, and description normalization applies only to listing', async () => {
  const f = fixture(); try {
    f.products([]);
    for (const description of ['', ' \n ', null]) {
      const loaded = await f.adapter.load({ storeId: 'bill', row: { ...row('listing'), payload: { ...row('listing').payload, description } }, fresh: false });
      assert.deepEqual(loaded.normalizedPayload?.attributes, []);
      assert.equal(Object.hasOwn(loaded.normalizedPayload!, 'description'), false);
      assert.equal(loaded.reviewUnits?.some(unit => unit.id === 'shared-description'), false);
    }
    const price = await f.adapter.load({ storeId: 'bill', row: { ...row(), payload: { ...row().payload, description: 'unchanged outside listing' } }, fresh: false });
    assert.equal(price.normalizedPayload?.description, 'unchanged outside listing');
  } finally { f.database.close(); }
});

test('listing facts and shared description carry source images to independent vision review and cache their exact evidence', async () => {
  const f = fixture(); try {
    f.products([]); f.read(path => path === '/v3/product/info/list' ? platform({ items: [] }) : undefined);
    const source = { id: 'source', title: '支架', description: '来源正文：表面镀铬。', sourceDetails: { material: '金属' }, mainImage: 'https://example.com/structure.jpg', images: ['https://example.com/structure.jpg'], skus: [
      { sourceSkuId: 'source-sku', spec: '单只', goodsPrice: 3.43, image: 'https://example.com/dimensions.jpg' },
      { sourceSkuId: 'unselected', spec: '其他规格', image: 'https://example.com/other.jpg' },
    ] };
    f.detail(source);
    const reviewed: IndependentReviewRequest[] = []; let decisionCalls = 0;
    const reviewer = createDecisionReviewer({ key: 'fixture', fetchImpl: async () => {
      decisionCalls++; throw new Error('Source pixels require the independent vision reviewer');
    }, fallback: async request => {
      reviewed.push(request);
      return { reviewer: 'independent-agent', reviewerId: 'fixture-vision', model: 'fixture-vision', versions: request.versions,
        questions: request.questions.map(question => ({ id: question.id, version: question.version, status: 'rejected' })) };
    } });
    const engine = new BusinessOperations({ store: f.store, source: f.adapter, transport: f.adapter, reviewer });
    const listings = ['one', 'two'].map(offerId => ({ ...row('listing'), rowId: offerId, target: { offerId }, payload: {
      ...row('listing').payload, name: `Зажимная вставка ${offerId}`, description: 'Зажимная вставка, 7/20 мм.',
    } }));
    const draft = await engine.create({ storeId: 'bill', rows: listings });
    const submitted = await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.deepEqual(submitted.rows.map(row => row.status), ['blocked', 'blocked'], 'the independent verdict still controls both rows');
    assert.equal(f.writes.length, 0);
    assert.equal(decisionCalls, 0, 'image-dependent facts must not be judged as text-only Decisions requests');
    assert.deepEqual(reviewed.map(request => request.questions[0].id), ['sku-facts', 'description-facts', 'sku-facts'], 'identical shared evidence is reviewed once across offers');
    const expectedImages = [
      { id: 'source-0', role: 'source', url: source.skus[0].image },
      { id: 'source-1', role: 'source', url: source.mainImage },
    ];
    for (const request of reviewed) {
      assert.deepEqual(request.images, expectedImages, 'preserve actual source pixel references and exclude unselected SKU images');
      assert.deepEqual(request.questions[0].imageIds, ['source-0', 'source-1'], 'no empty imageIds may suppress the source images');
      assert.match(request.questions[0].instructions, /实际查看/);
      assert.deepEqual(request.context.reasons, [{ id: request.questions[0].id, reasonCode: 'image_protocol_unverified' }]);
    }
    assert.equal(reviewed[0].questions[0].version, '3');
    const details = reviewed.find(request => request.questions[0].id === 'description-facts')!;
    assert.equal(details.questions[0].version, '4');
    assert.equal((details.source as any).items[0].description, source.description);
    assert.deepEqual((details.source as any).items[0].sourceDetails, source.sourceDetails);
    assert.deepEqual((details.source as any).composition, listings[0].procurement);
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 3, 'unchanged text and pixels reuse the completed review');
    source.description = '来源正文：表面镀铬，安装方式见图。';
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 6, 'changed source text invalidates both fact checks and shares the new description check');
    source.skus[0].image = 'https://example.com/revised-dimensions.jpg';
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 9, 'changed source pixel references invalidate both dependent checks');
    for (const request of reviewed.slice(6)) assert.equal(request.images?.[0].url, source.skus[0].image);
    assert.equal(f.writes.length, 0);
  } finally { f.database.close(); }
});

test('listing facts without source images remain text-only and prefer configured Decisions', async () => {
  const f = fixture(); try {
    f.products([]); f.read(path => path === '/v3/product/info/list' ? platform({ items: [] }) : undefined);
    f.detail({ id: 'source', title: 'Cup', description: 'One cup.', skus: [{ sourceSkuId: 'source-sku', goodsPrice: 3.43 }] });
    const reviewed: SemanticReviewRequest[] = [], submitted: any[] = []; let fallbackCalls = 0;
    const reviewer = createDecisionReviewer({ key: 'fixture', fetchImpl: async (_url, options) => {
      const body = JSON.parse(String(options?.body)); submitted.push(body);
      return new Response(JSON.stringify({ model: 'fixture-decisions', answers: Object.fromEntries(Object.keys(body.questions).map(id => [id, { type: 'noul', noul: 0 }])) }));
    }, fallback: async () => { fallbackCalls++; throw new Error('Clear text-only Decisions verdicts need no fallback'); } });
    const engine = new BusinessOperations({ store: f.store, source: f.adapter, transport: f.adapter, reviewer: { review(request, signal) {
      reviewed.push(request); return reviewer.review(request, signal);
    } } });
    const draft = await engine.create({ storeId: 'bill', rows: [{ ...row('listing'), payload: { ...row('listing').payload, description: 'One cup.' } }] });
    const result = await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.deepEqual(reviewed.map(request => request.questions[0].id), ['sku-facts', 'description-facts']);
    for (const request of reviewed) { assert.equal(request.images, undefined); assert.deepEqual(request.questions[0].imageIds, []); }
    assert.deepEqual(submitted.map(request => Object.keys(request.questions)), [['sku-facts'], ['description-facts']]);
    assert.equal(submitted[1].state.source.items[0].description, 'One cup.');
    assert.equal(fallbackCalls, 0);
    assert.equal(result.rows[0].status, 'blocked');
    assert.ok(result.rows[0].review?.every(review => review.questions[0].reviewer === 'decisions'));
    assert.equal(f.writes.length, 0);
  } finally { f.database.close(); }
});

test('selected rack review includes downloaded shared dimensions before redundant main images, with exact SKU scope and cache revisions', async t => {
  const f = fixture(), directory = await mkdtemp(join(tmpdir(), 'listing-review-cache-'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t8sAAAAASUVORK5CYII=', 'base64');
  const downloads: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => new Response(png, { headers: { 'content-type': 'image/png' } }));
  try {
    f.products([]); f.read(path => path === '/v3/product/info/list' ? platform({ items: [] }) : undefined);
    const source = { id: 'source', title: '碗盘架', currency: 'CNY', mainImage: 'https://example.com/main-0.jpg', images: Array.from({ length: 6 }, (_, i) => `https://example.com/main-${i}.jpg`), descriptionImages: ['https://example.com/detail.jpg'], skus: [
      { sourceSkuId: 'fixture-bowl-single', spec: '碗架【1个装】', goodsPrice: 5.9, image: 'https://example.com/bowl.jpg' },
      { sourceSkuId: 'fixture-plate-single', spec: '盘架【1个装】', goodsPrice: 5.9, image: 'https://example.com/plate.jpg' },
      { sourceSkuId: 'fixture-bowl-plate-set', spec: '碗架+盘架【共2个】', goodsPrice: 10.9, image: 'https://example.com/shared-dimensions.jpg' },
      ...Array.from({ length: 332 }, (_, i) => ({ sourceSkuId: `other-${i}`, spec: `其他规格 ${i}`, goodsPrice: 5.9, image: `https://example.com/uncached-${i}.jpg` })),
    ] };
    f.detail(source);
    const collection = new CollectionService({ client: f.client, store: f.store, sourceId: 'review-fixture', cacheDir: directory, fetch: async url => { downloads.push(String(url)); return new Response(png); } });
    const product = await collection.getProduct('source');
    const cached = [product.skus[0].imageRef!, product.skus[1].imageRef!, product.skus[2].imageRef!, product.assets.find(asset => asset.roles.includes('detail'))!.id];
    for (const assetId of cached) await collection.resourceRead({ id: product.id, kind: 'image', assetId });
    const adapter = new HallmarkBusinessAdapter({ store: f.store, client: f.client, broker: f.broker, gateway: f.gateway, collection });
    const reviewed: SemanticReviewRequest[] = [];
    const engine = new BusinessOperations({ store: f.store, source: adapter, transport: f.adapter, reviewer: { async review(request) {
      reviewed.push(request);
      return { status: 'rejected', questions: request.questions.map(question => ({ id: question.id, version: question.version, status: 'rejected', reviewer: 'independent-agent', reasonCode: 'FIXTURE' })), evidence: { versions: request.versions, requests: [], thresholds: { pass: .95, reject: .05 } } };
    } } });
    const listings = source.skus.slice(0, 2).map(sku => ({ ...row('listing'), rowId: sku.sourceSkuId, target: { offerId: sku.sourceSkuId }, procurement: [{ itemId: source.id, sourceSkuId: sku.sourceSkuId, quantity: 1 }], payload: {
      ...row('listing').payload, name: sku.spec, description: 'Размеры по изображению продавца.', images: ['https://example.com/draft.jpg'], attributes: [{ id: 85, values: [{ value: 'Нет бренда' }] }],
    } }));
    const draft = await engine.create({ storeId: 'bill', rows: listings });
    const result = await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.deepEqual(result.rows.map(row => row.status), ['blocked', 'blocked']);
    assert.equal(reviewed.length, 10);
    for (const [index, request] of reviewed.entries()) {
      const selected = source.skus[Math.floor(index / 5)], images = request.images!.filter(image => image.role === 'source');
      assert.equal(images.length, 8); assert.equal(new Set(images.map(image => image.url)).size, 8);
      assert.equal(images[0].url, selected.image); assert.equal(images[1].url, source.mainImage);
      assert.ok(images.some(image => image.url === source.skus[2].image), 'both single-SKU rows receive the shared empty-rack dimensions image');
      assert.ok(images.some(image => image.url === source.descriptionImages[0]), 'downloaded detail evidence is eligible');
      assert.ok(images.every(image => !image.url.includes('uncached-')), 'unrequested SKU images are never added');
      const evidence = (request.source as any).imageEvidence;
      assert.equal(evidence.length, images.length);
      assert.deepEqual(evidence[0].origins[0].skus, [{ sourceSkuId: selected.sourceSkuId, spec: selected.spec }]);
      assert.equal(evidence[0].origins[0].scope, 'selected-sku'); assert.equal(evidence[1].origins[0].scope, 'main');
      const shared = evidence.find((entry: any) => entry.imageId === images.find(image => image.url === source.skus[2].image)!.id).origins[0];
      assert.equal(shared.scope, 'other-sku-reference');
      assert.deepEqual(shared.skus, [{ sourceSkuId: 'fixture-bowl-plate-set', spec: '碗架+盘架【共2个】' }]);
      assert.match(shared.contentHash, /^[a-f0-9]{64}$/); assert.equal(shared.sourceRevision, product.revision);
      assert.deepEqual((request.source as any).composition, [{ itemId: 'source', sourceSkuId: selected.sourceSkuId, quantity: 1 }]);
      if(!['image-specification-text','image-text-legibility:draft-0'].includes(request.questions[0].id))assert.match(request.questions[0].instructions, /其他 SKU 图中的件数或组合不是当前销售组成/);
    }
    assert.deepEqual(reviewed.slice(0, 5).map(request => request.questions[0].version), ['3', '4', '1', '1', '1']);
    assert.deepEqual((result.rows[0].payload.attributes as any[])[0], listings[0].payload.attributes[0], 'brand conflict is never silently corrected or auto-passed');
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 10, 'identical evidence reuses the completed reviews');
    const cacheKey = `review-fixture:source:${collectionHash(source.skus[2].image)}`;
    f.store.put('collection_assets', cacheKey, { ...f.store.get('collection_assets', cacheKey), revision: 'b'.repeat(64) });
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 20, 'new downloaded bytes at the same source URL invalidate all dependent reviews');
    assert.ok(reviewed.slice(10).every(request => JSON.stringify((request.source as any).imageEvidence).includes('b'.repeat(64))));
    source.skus.at(-1)!.goodsPrice = 6.9;
    const revised = await collection.getProduct('source', { refresh: true });
    assert.notEqual(revised.revision, product.revision);
    await engine.submit({ planId: draft.planId, expectedRevision: draft.revision });
    assert.equal(reviewed.length, 30, 'source revision invalidates shared-description evidence even when its selected text and image URLs are unchanged');
    assert.equal(downloads.length, 4, 'review never downloads the other 332 SKU images');
    assert.equal(f.writes.length, 0);
  } finally { f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test('engine and real adapter restore a numerically equivalent price without a false conflict', async () => {
  const f = fixture(); try {
    const engine = new BusinessOperations({ store: f.store, source: f.adapter, transport: f.adapter, reviewer: { review: async () => { throw new Error('Price should not use model'); } } });
    const draft = await engine.create({ storeId: 'bill', rows: [{ ...row(), payload: { price: '12.00' } }] });
    const changed = await engine.submit({ planId: draft.planId, expectedRevision: 1 }); assert.equal(changed.status, 'done');
    f.price(12);
    const restore = await engine.restore({ planId: draft.planId }); assert.equal(restore.rows[0].payload.price, '10');
    const restored = await engine.submit({ planId: restore.planId, expectedRevision: 1 }); assert.equal(restored.status, 'done'); assert.equal(f.writes.length, 2);
  } finally { f.database.close(); }
});

test('only exact existing source links infer one-unit procurement and never manufacture a full cost', async () => {
  const f = fixture(); try {
    f.products([{ storeId: 'bill', offerId: 'offer', productId: 100, sources: [{ sourceSkuMatched: true, productId: 'source', skuCode: 'source-sku' }], profit: { costMinor: 999 } }]);
    const linked = await f.adapter.load({ storeId: 'bill', row: row(), fresh: true });
    assert.deepEqual(linked.normalizedProcurement, [{ itemId: 'source', sourceSkuId: 'source-sku', quantity: 1 }]); assert.equal(linked.procurement[0].unitPrice, 3.43); assert.equal(linked.policy?.breakEvenPrice, null);
    f.products([{ storeId: 'bill', offerId: 'offer', productId: 100, sources: [{ sourceSkuMatched: true, productId: 'source', skuCode: 'source-sku', salesSpec: 'two-pack' }] }]);
    const ambiguous = await f.adapter.load({ storeId: 'bill', row: row(), fresh: true }); assert.equal(ambiguous.normalizedProcurement, undefined); assert.deepEqual(ambiguous.procurement, []);
    f.products([{ storeId: 'bill', offerId: 'offer', productId: 100, sources: [{ sourceSkuMatched: true, productId: 'source', skuCode: 'sale-bundle', salesSpec: 'two-pack', components: [{ sourceSkuId: 'source-sku', quantity: 2 }] }] }]);
    const composed = await f.adapter.load({ storeId: 'bill', row: row(), fresh: true }); assert.deepEqual(composed.normalizedProcurement, [{ itemId: 'source', sourceSkuId: 'source-sku', quantity: 2 }]);
  } finally { f.database.close(); }
});

test('an import whose response was lost recovers the original task without resending', async () => {
  const f = fixture(); try {
    f.call({ status: 'unknown', error: { code: 'OUTCOME_UNKNOWN', message: 'Lost response', retryable: false } });
    const input: BusinessExecutionInput = { executionId: 'one', storeId: 'bill', row: row('listing'), context };
    f.store.put('business_transport_receipts','one',{executionId:'one',storeId:'bill',taskId:'historical-task',requestId:'request-one',path:'/v3/product/import',body:{},dispatchStarted:true,response:{status:'unknown'}});
    const first = await f.adapter.inspect(input); assert.equal(first.status, 'unknown'); assert.equal(f.writes.length, 0);
    f.taskLog([{ storeId: 'bill', requestId: 'request-one', outcome: 'response_received', httpStatus: 200, response: { result: { task_id: 777 } } }]);
    const recovered = await f.adapter.inspect({ ...input, receipt: first.receipt }); assert.equal(recovered.status, 'succeeded'); assert.equal(recovered.identity?.productId, '100'); assert.equal(f.writes.length, 0); assert.ok(f.taskReads.length >= 2);
    await f.adapter.execute(input); assert.equal(f.writes.length, 0, 'existing historical receipt is inspect-only');
  } finally { f.database.close(); }
});

test('import inspection uses its original task even when the older store gateway rejects that read', async () => {
  const f = fixture(); try {
    const gateway=f.client.storeDataRead,taskReads: any[]=[];
    f.client.storeDataRead=async (storeId,input)=>input.path==='/v1/product/import/info'?{status:'failed',error:{code:'ENDPOINT_NOT_ALLOWED',message:'店铺数据查询需要已登记只读接口',retryable:false}}:gateway(storeId,input);
    f.client.platformRead=async (taskId,input)=>{taskReads.push({taskId,...input});return platform({result:{items:[{offer_id:'offer',product_id:100,status:'imported'}]}});};
    f.call(platform({result:{task_id:5787296567}}));
    const input: BusinessExecutionInput={executionId:'original-import',storeId:'bill',row:row('listing'),context};
    f.store.put('business_transport_receipts','original-import',{executionId:'original-import',storeId:'bill',taskId:'listing-task',requestId:'historical-request',path:'/v3/product/import',body:{},dispatchStarted:true,importTaskId:5787296567,response:platform({result:{task_id:5787296567}})});
    const result=await f.adapter.inspect(input);assert.equal(result.status,'succeeded');assert.deepEqual(result.identity,{offerId:'offer',productId:'100',sku:'200'});
    assert.equal(f.writes.length,0);assert.equal(taskReads[0].taskId,'listing-task');assert.deepEqual(taskReads[0].body,{task_id:5787296567});assert.equal(taskReads[0].path,'/v1/product/import/info');
    await f.adapter.inspect({...input,receipt:result.receipt});assert.equal(f.writes.length,0);assert.ok(taskReads.every(read=>read.taskId==='listing-task'&&read.body.task_id===5787296567));assert.equal(f.reads.filter(read=>read.path==='/v1/product/import/info').length,0);
  } finally { f.database.close(); }
});

test('inspected Ozon product and SKU merge into the exact saved procurement composition', async () => {
  const f = fixture(); try {
    f.products([]);f.detail({id:'source',title:'Cup',source:'taobao_tmall',currency:'CNY',skus:[{sourceSkuId:'source-sku',goodsPrice:3.43}]});
    let imported=false;f.read(path=>path==='/v3/product/info/list'&&!imported?platform({items:[]}):undefined);
    f.call(platform({result:{task_id:5787296567}}));f.read(path=>path==='/v1/product/import/info'?platform({result:{items:[{offer_id:'offer',product_id:100,status:imported?'imported':'pending'}]}}):path==='/v3/product/info/list'&&!imported?platform({items:[]}):undefined);
    const engine=new BusinessOperations({store:f.store,source:f.adapter,transport:f.adapter,reviewer:{async review(request){return {status:'passed',questions:request.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'decisions',reasonCode:'MATCH'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}}});
    const listing=row('listing');listing.target={offerId:'offer'};const draft=await engine.create({storeId:'bill',rows:[listing]});
    const first=await engine.submit({planId:draft.planId,expectedRevision:1});assert.equal(first.rows[0].status,'pending');assert.equal(f.writes.length,1);
    imported=true;const finished=await engine.inspect(draft.planId);assert.equal(finished.rows[0].status,'succeeded');assert.deepEqual(finished.rows[0].target,{offerId:'offer',productId:'100',sku:'200'});
    const saved=f.store.get<any>('business_procurement_bindings',businessHash(['bill','offer']))!;assert.deepEqual(saved.target,finished.rows[0].target);assert.equal(saved.binding.amount,3.43);assert.deepEqual(saved.binding.components,[{itemId:'source',sourceSkuId:'source-sku',quantity:1,unitPrice:3.43,currency:'CNY',unit:'来源 SKU 销售单位'}]);assert.equal(f.writes.length,1);
  } finally { f.database.close(); }
});

test('unknown goods cost never falls back to freight-inclusive or unverified selling prices', async () => {
  const f = fixture(); try {
    f.products([{ storeId: 'bill', offerId: 'offer', productId: 100, sources: [{ sourceSkuMatched: true, productId: 'source', skuCode: 'source-sku' }] }]);
    for (const source of ['taobao_tmall', 'alibaba_com']) {
      f.detail({ id: 'source', source, currency: 'CNY', description: 'Original product description', delivery: { freightVerified: false }, skus: [{ sourceSkuId: 'source-sku', price: 30 }] });
      const missing = await f.adapter.load({ storeId: 'bill', row: row(), fresh: true }); assert.equal(missing.procurement[0].unitPrice, null); assert.equal(missing.policy?.breakEvenPrice, null);
      assert.equal((missing.source as any).items[0].description, 'Original product description'); assert.equal((missing.source as any).items[0].delivery.freightVerified, false);
    }
    f.detail({ id: 'source', source: 'taobao_tmall', currency: 'CNY', skus: [{ sourceSkuId: 'source-sku', goodsPrice: 17, price: 25 }] });
    assert.equal((await f.adapter.load({ storeId: 'bill', row: row(), fresh: true })).procurement[0].unitPrice, 17);
  } finally { f.database.close(); }
});

test('created but moderation-rejected listing retains Ozon identity and purchase binding without reimport', async () => {
  const f = fixture(); try {
    f.products([]);f.detail({id:'source',title:'Cup',source:'taobao_tmall',currency:'CNY',skus:[{sourceSkuId:'source-sku',goodsPrice:3.43}]});
    let imported=false;f.read(path=>path==='/v3/product/info/list'&&!imported?platform({items:[]}):undefined);
    f.call(platform({result:{task_id:5787296567}}));f.read(path=>path==='/v1/product/import/info'?platform({result:{items:[{offer_id:'offer',product_id:100,status:imported?'imported':'pending',errors:imported?[{code:'SPU_ALREADY_EXISTS_IN_ANOTHER_ACCOUNT',attribute_id:0,field:'spu',state:'moderated',level:'error',description:'Duplicate original product'}]:[]}]}}):path==='/v3/product/info/list'&&!imported?platform({items:[]}):undefined);
    const engine=new BusinessOperations({store:f.store,source:f.adapter,transport:f.adapter,reviewer:{async review(request){return {status:'passed',questions:request.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'decisions',reasonCode:'MATCH'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}}});
    const listing=row('listing');listing.target={offerId:'offer'};const draft=await engine.create({storeId:'bill',rows:[listing]});await engine.submit({planId:draft.planId,expectedRevision:1});imported=true;
    const finished=await engine.inspect(draft.planId),saved=f.store.get<any>('business_procurement_bindings',businessHash(['bill','offer']))!;
    assert.equal(finished.rows[0].status,'rejected');assert.deepEqual(finished.rows[0].target,{offerId:'offer',productId:'100',sku:'200'});assert.equal((finished.rows[0].receipt as any).completion,'imported; moderation rejected');assert.equal(finished.rows[0].issues[0].code,'SPU_ALREADY_EXISTS_IN_ANOTHER_ACCOUNT');assert.equal(finished.rows[0].issues[0].field,'spu');assert.match(finished.rows[0].issues[0].suggestion!,/平台已分配商品编号/);
    assert.match(finished.rows[0].issues[0].message,/重复/);assert.match(finished.rows[0].issues[0].suggestion!,/使用现有商品记录/);assert.equal((finished.rows[0].receipt as any).inspection.result.items[0].errors[0].description,'Duplicate original product');
    assert.deepEqual(saved.target,finished.rows[0].target);assert.equal(saved.binding.amount,3.43);assert.equal(saved.binding.components[0].sourceSkuId,'source-sku');assert.equal(saved.binding.components[0].quantity,1);
    await engine.submit({planId:draft.planId,expectedRevision:1});await engine.continueSubmitted(draft.planId);await f.adapter.execute({executionId:finished.rows[0].executionId!,storeId:'bill',row:listing,context});assert.equal(f.writes.length,1);
  } finally { f.database.close(); }
});

test('moderation failure keeps its created product ID even if the detail read is temporarily unavailable', async () => {
  const f = fixture(); try {
    f.call(platform({result:{task_id:5787296567}}));f.importResult({result:{items:[{offer_id:'offer',product_id:100,status:'imported',errors:[{code:'SPU_ALREADY_EXISTS_IN_ANOTHER_ACCOUNT',field:'spu',level:'error',description:'Duplicate'}]}]}});
    f.read(path=>path==='/v3/product/info/list'?{status:'unavailable',error:{code:'READ_TIMEOUT',message:'Unavailable',retryable:true}}:undefined);
    const result=await f.adapter.execute({executionId:'created-rejected',storeId:'bill',row:row('listing'),context});assert.equal(result.status,'rejected');assert.deepEqual(result.identity,{offerId:'offer',productId:'100'});assert.equal((result.receipt as any).completion,'imported; moderation rejected');assert.equal(f.writes.length,1);
  } finally { f.database.close(); }
});

test('live-shaped brand validation failure names the field without claiming moderation rejection or losing repair advice', async () => {
  const f=fixture();try{
    const error={code:'error_attribute_values_out_of_range',field:'',attribute_id:85,state:'new',level:'error',attribute_name:'Бренд',description:'Проверьте значение. В личном кабинете выберите вариант из списка.'};
    f.call(platform({result:{task_id:5791496972}}));
    f.importResult({result:{items:[{offer_id:'offer',product_id:100,status:'imported',errors:[error]}]}});
    f.read(path=>path==='/v3/product/info/list'?platform({items:[{id:100,offer_id:'offer',sku:0,statuses:{is_created:false,moderate_status:'',status_failed:'imported',validation_status:'pending'},stocks:{has_stock:false,stocks:[]}}]}):undefined);
    const input={executionId:'brand-invalid',storeId:'bill',row:row('listing'),context};
    const result=await f.adapter.execute(input),receipt=result.receipt as any;
    assert.equal(result.status,'rejected');assert.deepEqual(result.identity,{offerId:'offer',productId:'100'});
    assert.equal(receipt.completion,'imported; card not created; field validation failed');
    assert.doesNotMatch(receipt.completion,/moderation rejected/);
    assert.deepEqual(receipt.inspection.result.items[0].errors[0],error,'retain the raw platform evidence');
    assert.equal(result.issues?.[0].code,error.code);assert.equal(result.issues?.[0].field,'85');
    assert.match(result.issues![0].message,/品牌.*85/);assert.match(result.issues![0].suggestion!,/真实品牌/);
    assert.match(result.issues![0].suggestion!,/dictionary_value_id/);assert.match(result.issues![0].suggestion!,/保持原 Offer/);
    assert.match(result.issues![0].suggestion!,/平台已分配商品编号（100）/);
    const observed=f.store.get<any>('business_catalog',businessHash(['bill','offer']));
    assert.equal(observed.saleState,'failed');assert.equal(observed.status,'rejected');assert.equal(observed.platformStatus.is_created,false);assert.equal(observed.statusObservation,'observed');
    await f.adapter.inspect(input);assert.equal(f.writes.length,1,'inspection never reimports rejected goods');
  }finally{f.database.close();}
});

test('explicit native moderation rejection is distinct from an unknown import failure',async()=>{
  const f=fixture();try{
    f.call(platform({result:{task_id:123}}));
    f.importResult({result:{items:[{offer_id:'offer',product_id:100,status:'imported',errors:[]}]}});
    f.read(path=>path==='/v3/product/info/list'?platform({items:[{id:100,offer_id:'offer',sku:200,statuses:{is_created:true,moderate_status:'declined'}}]}):undefined);
    const moderated=await f.adapter.execute({executionId:'native-moderation',storeId:'bill',row:row('listing'),context});
    assert.equal(moderated.status,'rejected');assert.equal((moderated.receipt as any).completion,'imported; moderation rejected');
    assert.equal(moderated.issues?.[0].code,'OZON_MODERATION_REJECTED');assert.match(moderated.issues![0].message,/审核拒绝/);
    f.importResult({result:{items:[{offer_id:'offer',product_id:100,status:'failed',errors:[{code:'NEW_PLATFORM_REASON',description:'Preserve this unknown reason'}]}]}});
    f.read(path=>path==='/v3/product/info/list'?platform({items:[{id:100,offer_id:'offer',sku:0,statuses:{is_created:false,moderate_status:''}}]}):undefined);
    const unknown=await f.adapter.execute({executionId:'unknown-reason',storeId:'bill',row:row('listing'),context});
    assert.equal((unknown.receipt as any).completion,'import rejected; card not created; platform rejected');
    assert.equal(unknown.issues?.[0].message,'Preserve this unknown reason');
  }finally{f.database.close();}
});

test('known required attributes get precise repair guidance and successful imports do not imply a created card',async()=>{
  const f=fixture();try{
    const required=platformIssues([{code:'ATTRIBUTE_REQUIRED',attribute_id:85}])[0];
    assert.match(required.message,/品牌.*85/);assert.match(required.suggestion!,/必填属性/);
    f.call(platform({result:{task_id:123}}));
    f.importResult({result:{items:[{offer_id:'offer',product_id:100,status:'imported',errors:[]}]}});
    f.read(path=>path==='/v3/product/info/list'?platform({items:[{id:100,offer_id:'offer',sku:0,statuses:{is_created:false,moderate_status:''}}]}):undefined);
    const result=await f.adapter.execute({executionId:'imported-only',storeId:'bill',row:row('listing'),context});
    assert.equal(result.status,'succeeded');assert.equal((result.receipt as any).completion,'imported; card not created; moderation and sellability are separate');
  }finally{f.database.close();}
});

test('an assigned product ID with sku zero permits only a verified repair of the original rejected listing row', async () => {
  const f = fixture(); try {
    f.products([]);f.detail({id:'source',title:'Cup',source:'taobao_tmall',currency:'CNY',skus:[{sourceSkuId:'source-sku',goodsPrice:3.43}]});
    let exists=false,rejected=true;
    f.read(path=>path==='/v3/product/info/list'?platform({items:exists?[{offer_id:'offer',id:100,sku:rejected?'0':200,statuses:{is_created:!rejected,status:rejected?'moderated':'processed'},is_archived:false}]:[]}):undefined);
    const send=f.client.platformCall!;f.call(platform({result:{task_id:5787296567}}));f.client.platformCall=async (taskId,input)=>{const result=await send(taskId,input);exists=true;return result;};
    f.read(path=>path==='/v1/product/import/info'?platform({result:{items:[{offer_id:'offer',product_id:100,status:'imported',errors:rejected?[{code:'ATTRIBUTE_INVALID',field:'attributes',level:'error',state:'moderated',description:'Correct the option'}]:[]}]}}):path==='/v3/product/info/list'?platform({items:exists?[{offer_id:'offer',id:100,sku:rejected?'0':200,statuses:{is_created:!rejected,status:rejected?'moderated':'processed'},is_archived:false}]:[]}):undefined);
    const engine=new BusinessOperations({store:f.store,source:f.adapter,transport:f.adapter,reviewer:{async review(request){return {status:'passed',questions:request.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'decisions',reasonCode:'MATCH'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}}});
    const listing=row('listing');listing.target={offerId:'offer'};const draft=await engine.create({storeId:'bill',rows:[listing]});const first=await engine.submit({planId:draft.planId,expectedRevision:1});
    assert.equal(first.rows[0].status,'rejected');assert.deepEqual(first.rows[0].target,{offerId:'offer',productId:'100'});assert.equal((first.rows[0].receipt as any).completion,'imported; card not created; field validation failed');assert.equal(f.store.get<any>('business_procurement_bindings',businessHash(['bill','offer']))!.target.sku,undefined);
    const foreign=await engine.create({storeId:'bill',rows:[{...listing,rowId:first.rows[0].rowId,target:first.rows[0].target}]});const refused=await engine.submit({planId:foreign.planId,expectedRevision:1});assert.equal(refused.rows[0].status,'blocked');assert.ok(refused.rows[0].issues.some(issue=>issue.code==='OFFER_ALREADY_EXISTS'));assert.equal(f.writes.length,1,'copying a row ID and product ID does not authorize an existing product');
    await assert.rejects(engine.revise({planId:draft.planId,expectedRevision:1,rows:[{...listing,target:{offerId:'different'}}]}),/LISTING_REPAIR_TARGET_CHANGED/);
    await assert.rejects(engine.revise({planId:draft.planId,expectedRevision:1,rows:[{...listing,procurement:[{itemId:'source',sourceSkuId:'source-sku',quantity:2}]}]}),/LISTING_REPAIR_COMPOSITION_CHANGED/);
    const fixed=await engine.revise({planId:draft.planId,expectedRevision:1,rows:[{...listing,payload:{...listing.payload,name:'Corrected cup'}}]});assert.equal(fixed.rows[0].target.productId,'100');assert.equal(fixed.rows[0].listingRepairExecutionId,first.rows[0].executionId);assert.ok(!fixed.rows[0].issues.some(issue=>issue.code==='OFFER_ALREADY_EXISTS'));
    f.call(platform({code:'ATTRIBUTE_INVALID',message:'Another field rejected before task creation'},400));const againRejected=await engine.submit({planId:draft.planId,expectedRevision:fixed.revision});assert.equal(againRejected.rows[0].status,'rejected');assert.equal(f.writes.length,2);
    const fixedAgain=await engine.revise({planId:draft.planId,expectedRevision:fixed.revision,rows:[{...listing,payload:{...listing.payload,name:'Final corrected cup'}}]});assert.equal(fixedAgain.rows[0].listingRepairExecutionId,first.rows[0].executionId,'a later field rejection cannot erase known original product provenance');
    rejected=false;f.call(platform({result:{task_id:5787296568}}));const repaired=await engine.submit({planId:draft.planId,expectedRevision:fixedAgain.revision});assert.equal(repaired.rows[0].status,'succeeded');assert.equal(f.writes.length,3);assert.ok(f.writes.every(write=>write.body.items[0].offer_id==='offer'));assert.notEqual(first.rows[0].executionId,repaired.rows[0].executionId);assert.equal(repaired.rows[0].target.sku,'200');
    const saved=f.store.get<any>('business_procurement_bindings',businessHash(['bill','offer']))!;assert.equal(saved.binding.amount,3.43);assert.equal(saved.target.sku,'200');
    await assert.rejects(engine.revise({planId:draft.planId,expectedRevision:fixedAgain.revision,rows:[listing]}),/BUSINESS_ROW_ALREADY_EXECUTED/);
  } finally { f.database.close(); }
});

test('an unresolved transport failure is unknown, while a received Ozon error is rejected with its field', async () => {
  const f = fixture(); try {
    const input: BusinessExecutionInput = { executionId: 'unknown', storeId: 'bill', row: row(), context };
    f.call({ status: 'unavailable', error: { code: 'NETWORK_ERROR', message: 'Connection dropped', retryable: false } });
    assert.equal((await f.adapter.execute(input)).status, 'unknown');
    f.call({ status: 'failed', raw: { outcome: 'response_received', httpStatus: 400, response: { code: 'ATTRIBUTE_INVALID', message: 'Wrong option', attribute_id: 10096 } } });
    const rejected = await f.adapter.execute({ ...input, executionId: 'bad-field' }); assert.equal(rejected.status, 'rejected'); assert.equal(rejected.issues?.[0].field, '10096'); assert.match(rejected.issues?.[0].suggestion ?? '', /属性选项/);
  } finally { f.database.close(); }
});

test('import row errors and product-not-created rejection preserve actionable codes', async () => {
  const f = fixture(); try {
    f.call(platform({ result: { task_id: 777 } }));
    f.importResult({ result: { items: [{ offer_id: 'offer', status: 'failed', errors: [{ code: 'ATTRIBUTE_REQUIRED', attribute_id: 55, message: 'Required' }] }] } });
    const rejected = await f.adapter.execute({ executionId: 'import', storeId: 'bill', row: row('listing'), context }); assert.equal(rejected.status, 'rejected'); assert.equal(rejected.issues?.[0].code, 'ATTRIBUTE_REQUIRED');
    f.call(platform({ result: [{ offer_id: 'offer', updated: false, errors: [{ code: 'PRODUCT_IS_NOT_CREATED', message: 'Wait for product creation' }] }] }));
    const waiting = await f.adapter.execute({ executionId: 'stock', storeId: 'bill', row: { ...row('stock'), payload: { stock: 1, warehouse_id: '7' } }, context }); assert.equal(waiting.status, 'rejected'); assert.ok(waiting.issues?.some(i => i.code === 'PRODUCT_IS_NOT_CREATED'));
  } finally { f.database.close(); }
});

test('rich images include nested Ozon JSON and HTML, while ordinary links are excluded', () => {
  const urls = businessImageUrls({ primary_image: 'https://cdn/main.jpg', images: ['https://cdn/extra.jpg'], attributes: [{ id: 11254, values: [{ value: JSON.stringify({ content: [{ widgetName: 'raShowcase', blocks: [{ img: { src: 'https://cdn/rich.jpg' } }] }] }) }] }], description: '<a href="https://shop/">shop</a><img src="https://cdn/detail.jpg">' });
  assert.deepEqual(urls.sort(), ['https://cdn/main.jpg', 'https://cdn/extra.jpg', 'https://cdn/rich.jpg', 'https://cdn/detail.jpg'].sort());
});

test('listing source loads bind rich-content image bytes and include them in independent visual review', async () => {
  const f = fixture(), originalFetch = globalThis.fetch; try {
    f.products([]);
    const fetched: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => { fetched.push(String(url)); return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { 'content-type': 'image/png' } }); }) as typeof fetch;
    const target = row('listing'); target.payload.images = ['https://cdn.test/main.png']; target.payload.attributes = [{ id: 11254, values: [{ value: JSON.stringify({ content: [{ img: { src: 'https://cdn.test/rich.png' } }] }) }] }];
    const loaded = await f.adapter.load({ storeId: 'bill', row: target, fresh: false });
    assert.deepEqual(fetched.sort(), ['https://cdn.test/main.png', 'https://cdn.test/rich.png']); assert.equal(loaded.assets?.length, 2); assert.ok(loaded.assets?.every(a => /^[a-f0-9]{64}$/.test(a.contentHash)));
    const visual = loaded.reviewUnits?.find(unit => unit.id === 'sku-images'); assert.equal(visual?.images?.filter(image => image.role === 'draft').length, 2);
  } finally { globalThis.fetch = originalFetch; f.database.close(); }
});

test('primary image selection is explicit and only genuine source references can select a comparison subject', async t => {
  const f=fixture();
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}}));
  try{
    f.products([]);
    const gallery=Array.from({length:12},(_,i)=>`https://source.test/gallery-${i}.jpg`),subjectUrl=gallery[11];
    f.detail({id:'source',title:'金属支架',mainImage:gallery[0],images:gallery,skus:[{sourceSkuId:'source-sku',goodsPrice:3.43,spec:'银色单只',image:gallery[1]}]});
    const target:BusinessRowInput={...row('listing'),referenceSubjects:[{sourceImageUrl:subjectUrl,subject:'左侧银色支架'}],payload:{...row('listing').payload,images:['https://cdn.test/extra.jpg'],primary_image:'https://cdn.test/main.jpg'}};
    const loaded=await f.adapter.load({storeId:'bill',row:target,fresh:false}),unit=loaded.reviewUnits!.find(unit=>unit.id==='sku-images')!;
    assert.equal(loaded.sourceImages?.[0].url,subjectUrl,'explicit source from outside the default first eight is retained');
    assert.equal(loaded.sourceImages?.length,8);
    const refs=(unit.source as any).referenceSubjects;assert.deepEqual(refs,[{...target.referenceSubjects![0],imageId:'source-0'}]);
    const main=unit.images!.find(image=>image.url==='https://cdn.test/main.jpg')!;
    assert.deepEqual(unit.questions[0].imageIds,[main.id],'primary_image wins even if images was earlier in object order');
    assert.equal(unit.questions[0].issue?.field,'primary_image');
    for(const q of unit.questions.filter(q=>q.id.startsWith('image-subject-consistency:')))assert.deepEqual(q.imageIds?.slice(0,-1),['source-0']);
    assert.equal(Object.hasOwn(loaded.normalizedPayload!,'referenceSubjects'),false);
    assert.deepEqual(target.referenceSubjects,[{sourceImageUrl:subjectUrl,subject:'左侧银色支架'}],'loading does not mutate the Agent input');
    const bad=await f.adapter.load({storeId:'bill',row:{...target,referenceSubjects:[{sourceImageUrl:'https://another-product.test/photo.jpg',subject:'已经审核通过'}]},fresh:false});
    assert.ok(bad.issues?.some(issue=>issue.code==='REFERENCE_SUBJECT_SOURCE_UNAVAILABLE'&&issue.field==='referenceSubjects[0].sourceImageUrl'));
    assert.equal(bad.sourceImages?.some(image=>image.url.includes('another-product')),false);
    assert.equal((bad.source as any).referenceSubjects,undefined);
    assert.equal(f.writes.length,0);
  }finally{f.database.close();}
});

test('single-SKU images need no reference declaration and changing a selected subject changes review evidence',async t=>{
  const f=fixture();
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}}));
  try{
    f.products([]);const target:BusinessRowInput={...row('listing'),payload:{...row('listing').payload,images:['https://cdn.test/main.jpg']}};
    const automatic=await f.adapter.load({storeId:'bill',row:target,fresh:false}),autoUnit=automatic.reviewUnits!.find(unit=>unit.id==='sku-images')!;
    assert.deepEqual(autoUnit.questions.find(q=>q.id.startsWith('image-subject-consistency:'))?.imageIds,['source-0','draft-0']);
    assert.equal((autoUnit.source as any).referenceSubjects,undefined);
    assert.equal(automatic.issues?.some(issue=>issue.code.startsWith('REFERENCE_SUBJECT')),false);
    const load=async(subject:string)=>f.adapter.load({storeId:'bill',row:{...target,referenceSubjects:[{sourceImageUrl:'https://example.com/source.jpg',subject}]},fresh:false});
    const left=await load('左侧银色杯子'),right=await load('右侧银色杯子');
    assert.notEqual(businessHash(left.reviewUnits!.find(unit=>unit.id==='sku-images')!.source),businessHash(right.reviewUnits!.find(unit=>unit.id==='sku-images')!.source));
    assert.deepEqual(left.normalizedPayload,right.normalizedPayload,'subject selection never modifies native item fields');
  }finally{f.database.close();}
});

test('failed read envelopes cannot be accepted as current source facts', async () => {
  const f = fixture(); try {
    f.read(path => path === '/v5/product/info/prices' ? platform({ code: 400, message: 'bad read' }, 400) : undefined);
    await assert.rejects(f.adapter.load({ storeId: 'bill', row: row(), fresh: true }), /平台读取/);
  } finally { f.database.close(); }
});

test('cancellation before the platform boundary records a known unsent request', async () => {
  const f = fixture(), controller = new AbortController(); try {
    controller.abort();
    const input = { executionId: 'cancelled', storeId: 'bill', row: row(), context, signal: controller.signal };
    const result = await f.adapter.execute(input); assert.equal(result.status, 'rejected'); assert.equal(result.issues?.[0].code, 'REQUEST_NOT_DISPATCHED'); assert.equal(f.writes.length, 0);
    const recovered = await f.adapter.inspect(input); assert.equal(recovered.issues?.[0].code, 'REQUEST_NOT_DISPATCHED'); assert.equal(f.writes.length, 0);
  } finally { f.database.close(); }
});

test('a platform server error remains unknown; explicit rate limiting has a retry time', async () => {
  const f = fixture(); try {
    f.call({ status: 'failed', raw: { outcome: 'response_received', httpStatus: 500, response: { code: 'INTERNAL', message: 'Server failed' } } });
    const unknownInput = { executionId: '500', storeId: 'bill', row: row(), context };
    const unknown = await f.adapter.execute(unknownInput); assert.equal(unknown.status, 'unknown'); assert.equal((await f.adapter.inspect(unknownInput)).status, 'unknown');
    f.call({ status: 'unavailable', raw: { outcome: 'response_received', httpStatus: 429, response: { code: 'TOO_MANY', message: 'Rate limited' } } });
    const limited = await f.adapter.execute({ executionId: '429', storeId: 'bill', row: row(), context }); assert.equal(limited.status, 'rejected'); assert.equal(limited.issues?.[0].code, 'OZON_RATE_LIMIT'); assert.ok(limited.retryAfterMs! > 0);
  } finally { f.database.close(); }
});

test('direct writes have a durable native intent and never need a legacy task or sale registration',async()=>{
 const f=fixture();try{
  f.broker.getStoreTask=async()=>{throw Error('legacy task prohibited');};f.broker.getListingTask=async()=>{throw Error('legacy listing prohibited');};f.client.registerTaskSalesVariants=async()=>{throw Error('legacy registration prohibited');};
  f.call(platform({result:{task_id:77}}));const send=f.gateway.request;f.gateway.request=async(id:string,input:any)=>{if(input.path==='/v3/product/import'){const saved=f.store.get('business_transport_receipts','native')!;assert.equal(saved.dispatchStarted,true);assert.equal(saved.credentialRevision,1);assert.deepEqual(saved.body,input.body);}return send(id,input);};
  const input={executionId:'native',storeId:'bill',row:{...row('listing'),procurement:[{itemId:'source',sourceSkuId:'red',quantity:2},{itemId:'other-source',sourceSkuId:'blue',quantity:1}]},context};
  const result=await f.adapter.execute(input);assert.equal(result.status,'succeeded');assert.equal((result.receipt as any).transport,'ozon-direct');assert.equal((result.receipt as any).taskId,undefined);assert.equal(f.writes.length,1);assert.equal(f.taskReads.length,0);
  await f.adapter.execute(input);assert.equal(f.writes.length,1);
 }finally{f.database.close();}
});

test('lost native import response stays inspect-only with no legacy task lookup or second write',async()=>{
 const f=fixture();try{
  f.call({status:'unknown',raw:{outcome:'outcome_unknown'}});const input={executionId:'lost-native',storeId:'bill',row:row('listing'),context};
  assert.equal((await f.adapter.execute(input)).status,'unknown');assert.equal((await f.adapter.inspect(input)).status,'unknown');assert.equal((await f.adapter.execute(input)).status,'unknown');assert.equal(f.writes.length,1);assert.equal(f.taskReads.length,0);
  const withoutGateway=new HallmarkBusinessAdapter({client:f.client,store:f.store,broker:f.broker});assert.equal((await withoutGateway.inspect(input)).issues?.[0].code,'ORIGINAL_STORE_CONNECTION_REQUIRED');assert.equal(f.writes.length,1);
 }finally{f.database.close();}
});

test('native inspection keeps original credential revision after the configured key rotates',async()=>{
 const f=fixture();try{
  f.call(platform({result:{task_id:77}}));const input={executionId:'rotated',storeId:'bill',row:row('listing'),context};await f.adapter.execute(input);
  f.gateway.getStore=()=>({id:'bill',enabled:true,hasCredentials:true,credentialRevision:2});const read=f.gateway.request,used:any[]=[];f.gateway.request=async(id:string,input:any)=>{used.push(input);return read(id,input);};
  await f.adapter.inspect(input);assert.ok(used.length>=2);assert.ok(used.every(input=>input.credentialRevision===1));assert.equal(f.writes.length,1);
  const rejected=await f.adapter.execute({...input,executionId:'new',context:{...context,credentialRevision:1}});assert.equal(rejected.issues?.[0].code,'STORE_CONNECTION_CHANGED');assert.equal(f.writes.length,1);
 }finally{f.database.close();}
});

test('promotions parse object amounts and exit through the native v2 contract',async()=>{
 const f=fixture();try{
  let member=true;f.read(path=>path==='/v2/actions/products'?platform({result:{products:member?[{id:100,action_price:{amount:12,currency:'CNY'},stock:7}]:[],last_id:0}}):undefined);
  const promotion={...row('promotion.update'),payload:{action_id:9,price:12,stock:7}};const loaded=await f.adapter.load({storeId:'bill',row:promotion,fresh:true});assert.deepEqual(loaded.current,{action_id:9,price:'12',stock:7,member:true});
  assert.equal(loaded.normalizedPayload?.currency_code,'CNY');
  const update=await f.adapter.execute({executionId:'promotion-update',storeId:'bill',row:{...promotion,payload:loaded.normalizedPayload!},context:loaded});assert.equal(update.status,'succeeded');assert.deepEqual(f.writes[0].body,{action_id:9,products:[{product_id:100,action_price:{amount:'12',currency:'CNY'},stock:'7'}]});
  const send=f.gateway.request;f.gateway.request=async(id:string,input:any)=>{if(input.path==='/v2/actions/products/deactivate')member=false;return send(id,input);};
  const result=await f.adapter.execute({executionId:'exit',storeId:'bill',row:{...row('promotion.exit'),payload:{action_id:9}},context});assert.equal(result.status,'succeeded');assert.equal(f.writes[1].path,'/v2/actions/products/deactivate');assert.deepEqual(f.writes[1].body,{action_id:9,product_ids:[100]});
 }finally{f.database.close();}
});

test('pricing uses selected channel and real source cost, preserves automatic intent, and refuses an altered collection origin',async()=>{
 const f=fixture();try{
  const pricing=new BusinessPricingRepository(f.store);pricing.save('bill',{currency:'CNY',defaultPlanId:'a',plans:[{id:'a',name:'A',enabled:true,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000},{id:'b',name:'B',enabled:true,fixedMinor:100,logisticsMicrosPerGram:10000,commissionPpm:100000}],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:100000,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null},0);
  f.products([]);f.detail({id:'source',title:'Cup',currency:'CNY',skus:[{sourceSkuId:'source-sku',price:3.43}]});f.read(path=>path==='/v3/product/info/list'?platform({items:[]}):undefined);
  const adapter=new HallmarkBusinessAdapter({client:f.client,store:f.store,broker:f.broker,gateway:f.gateway,pricing}),item={...row('listing'),target:{offerId:'new'},pricing:{planId:'b',mode:'automatic' as const},payload:{name:'Cup',weight:50,weight_unit:'g',currency_code:'CNY'}};
  const quote=await adapter.load({storeId:'bill',row:item,fresh:false});assert.equal(quote.pricingQuote?.status,'ready');assert.equal(quote.pricingQuote?.breakdown.purchaseMinor,343);assert.equal(quote.pricingQuote?.planId,'b');assert.deepEqual(quote.normalizedPricing,{planId:'b',mode:'automatic'});assert.equal(quote.normalizedPayload?.price,(quote.pricingQuote!.suggestedPriceMinor!/100).toFixed(2));
  const engine=new BusinessOperations({store:f.store,source:adapter,transport:adapter,reviewer:{review:async()=>{throw Error('Draft must not review');}}});const plan=await engine.create({storeId:'bill',rows:[item]});assert.equal(plan.rows[0].pricing?.mode,'automatic');assert.equal(f.writes.length,0);
  const replaced=new HallmarkBusinessAdapter({client:f.client,store:f.store,broker:f.broker,gateway:f.gateway,pricing,collectionSourceMatches:false});await assert.rejects(replaced.load({storeId:'bill',row:item,fresh:false}),/COLLECTION_SOURCE_CHANGED/);
 }finally{f.database.close();}
});

test('native catalogue joins exact local multi-source composition and excludes a mismatched platform identity',async()=>{
 const f=fixture();try{
  f.store.put('business_migrations','catalog:bill',{done:true});f.store.put('business_procurement_bindings',businessHash(['bill','offer']),{storeId:'bill',target:{offerId:'offer',productId:'100',sku:'200'},binding:{currency:'CNY',amount:8,components:[{itemId:'source',sourceSkuId:'red',quantity:2,unitPrice:3,currency:'CNY'},{itemId:'source2',sourceSkuId:'blue',quantity:1,unitPrice:2,currency:'CNY'}]}});
  f.client.getStoreProducts=async()=>{throw Error('old product catalogue must be offline after migration');};f.client.getStores=async()=>{throw Error('old store list must be offline');};
  f.gateway.listStores=()=>[{id:'bill',name:'Bill',enabled:true,hasCredentials:true,credentialRevision:1,sourceConnectionId:'connection'}];f.gateway.getProducts=async()=>platform({items:[{id:100,offer_id:'offer',sku:200,name:'Cup',price:'12',currency_code:'CNY'}]});
  const connected=businessConnectedClient(f.client,f.gateway,f.store,'connection'),catalog=await connected.getStoreProducts();assert.equal(catalog.status,'ok');assert.equal(catalog.raw.products[0].sources.length,2);assert.equal(catalog.raw.products[0].profit.purchaseMinor,800);assert.equal((await connected.getStores()).raw[0].name,'Bill');
  assert.equal(localBusinessProducts(f.store,'bill')[0].procurementBinding.components.length,2);
  f.gateway.getStore=()=>({id:'bill',sourceConnectionId:'other'});const scoped=connectionBusinessGateway(f.gateway,'connection');assert.equal(scoped.hasStore('bill'),false);assert.equal((await scoped.request('bill',{path:'/v3/product/info/list'})).error?.code,'STORE_CONNECTION_MISMATCH');
 }finally{f.database.close();}
});

test('category search inherits its ancestor category ID and reads template/dictionary through direct Ozon',async()=>{
 const f=fixture();try{
  f.gateway.listStores=()=>[{id:'bill',name:'Bill',sourceConnectionId:'connection'}];const requests:any[]=[];
  f.gateway.request=async(_store:string,input:any)=>{requests.push(input);return platform(input.path==='/v1/description-category/tree'?{result:[{description_category_id:100,category_name:'Дом',children:[{description_category_id:200,category_name:'Кухня',children:[{type_id:300,type_name:'Чашка'}]}]}]}:{result:[{id:55,name:'Материал',dictionary_id:99}]});};
  f.client.getCategoryData=async()=>{throw Error('legacy category service must not be required');};const client=businessConnectedClient(f.client,f.gateway,f.store,'connection');
  const search=await client.getCategoryData!({storeId:'bill',mode:'search',q:'Чашка'});assert.equal(search.raw.items[0].descriptionCategoryId,200);assert.equal(search.raw.items[0].description_category_id,200);assert.equal(search.raw.items[0].typeId,300);assert.deepEqual(search.raw.items[0].path,['Дом','Кухня','Чашка']);
  const template=await client.getCategoryData!({storeId:'bill',mode:'template',descriptionCategoryId:'200',typeId:'300'});assert.equal(template.raw.result[0].id,55);assert.deepEqual(requests[1],{path:'/v1/description-category/attribute',body:{description_category_id:200,type_id:300,language:'DEFAULT'}});
  await client.getCategoryData!({storeId:'bill',mode:'values',descriptionCategoryId:'200',typeId:'300',attributeId:'55',q:'стекло'});assert.equal(requests[2].path,'/v1/description-category/attribute/values/search');assert.equal(requests[2].body.attribute_id,55);assert.equal(requests[2].body.value,'стекло');
 }finally{f.database.close();}
});

test('a price draft naturally imports legacy procurement identity before any product-list screen is opened',async()=>{
 const f=fixture();try{
  const sourceProduct={storeId:'bill',offerId:'offer',productId:100,sources:[{sourceSkuMatched:true,productId:'source',skuCode:'source-sku',sourceUrl:'https://source.example/item'}]};
  let legacyReads=0;f.client.getStoreProducts=async()=>{legacyReads++;return ok({stores:[{id:'bill'}],products:[sourceProduct]});};
  f.gateway.listStores=()=>[{id:'bill',legacyStoreId:'bill',sourceConnectionId:'connection',name:'Bill',enabled:true,hasCredentials:true,credentialRevision:1}];
  const freshStore=new HallmarkStorePort(f.database,'cold-start'),client=businessConnectedClient(f.client,f.gateway,freshStore,'connection'),adapter=new HallmarkBusinessAdapter({client,gateway:f.gateway,store:freshStore,broker:f.broker});
  const draft=await adapter.load({storeId:'bill',row:row(),fresh:false});assert.deepEqual(draft.normalizedProcurement,[{itemId:'source',sourceSkuId:'source-sku',quantity:1}]);assert.equal(draft.procurement[0].unitPrice,3.43);assert.equal(legacyReads,1);
  f.client.getStoreProducts=async()=>{throw Error('legacy product backend must no longer be read');};await adapter.load({storeId:'bill',row:row(),fresh:true});assert.equal(legacyReads,1);assert.equal(freshStore.list('business_catalog').length,1);
 }finally{f.database.close();}
});

test('native catalogue preserves old profit only as history and never presents it as current computed profit',async()=>{
 const f=fixture();try{
  f.products([{storeId:'bill',offerId:'offer',productId:100,profit:{purchaseMinor:343,packageGrams:30,actualMinor:999,costMinor:500,profitMinor:499,actualMargin:.5}}]);f.store.put('business_migrations','catalog:bill',{done:true});
  f.gateway.listStores=()=>[{id:'bill',name:'Bill',sourceConnectionId:'connection'}];f.gateway.getProducts=async()=>platform({items:[{id:100,offer_id:'offer',sku:200,name:'Cup',price:'10.37',currency_code:'CNY'}]});
  const client=businessConnectedClient(f.client,f.gateway,f.store,'connection'),data=await client.getStoreProducts(),product=data.raw.products[0];assert.equal(product.profit.purchaseMinor,343);assert.equal(product.profit.packageGrams,null);assert.equal(product.profit.actualMinor,null);assert.equal(product.profit.costMinor,null);assert.equal(product.profit.profitMinor,null);assert.equal(product.profit.actualMargin,null);assert.equal(product.historicalProfit.actualMargin,.5);assert.match(product.historicalProfit.basis,/历史参考/);
  const [computed]=profitRows([product]);assert.equal(computed.referenceProfit.costMissing,true);assert.equal(computed.referenceProfit.margin,null);assert.equal(computed.referenceProfit.profitMinor,null);assert.deepEqual(JSON.parse(JSON.stringify(product)),product,'native projection is JSON-safe');
 }finally{f.database.close();}
});

test('automatic repricing evaluates the final suggested tier, ignores a previous price and uses verified actual weight',async()=>{
 const f=fixture();try{
  const pricing=new BusinessPricingRepository(f.store);pricing.save('bill',{currency:'CNY',logisticsSelection:'automatic',defaultPlanId:null,plans:[{id:'low',name:'Low',enabled:true,maxPriceExclusiveMinor:13500,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000},{id:'high',name:'High',enabled:true,minPriceMinor:13500,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000}],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:100000,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null},0);
  f.products([{storeId:'bill',offerId:'offer',productId:100,sources:[{sourceSkuMatched:true,productId:'source',skuCode:'source-sku'}],weight:{source:'ozon_order_actual',grams:50,revision:'verified'}}]);
  f.detail({id:'source',currency:'CNY',skus:[{sourceSkuId:'source-sku',price:100}]});f.read(path=>path==='/v4/product/info/attributes'?platform({result:[{offer_id:'offer',id:100,weight:1000,weight_unit:'g'}]}):undefined);
  const adapter=new HallmarkBusinessAdapter({client:f.client,store:f.store,broker:f.broker,gateway:f.gateway,pricing});
  const result=await adapter.load({storeId:'bill',row:{...row(),pricing:{mode:'automatic',planId:'low'},payload:{price:'1',currency_code:'CNY'}},fresh:false});
  assert.equal(result.pricingQuote?.status,'ready');assert.equal(result.pricingQuote?.planId,'high');assert.equal(result.pricingQuote?.breakdown.logisticsMinor,197);assert.equal(Math.round(Number(result.normalizedPayload?.price)*100),result.pricingQuote?.evaluatedPriceMinor);assert.equal(result.pricingQuote?.evaluatedPriceMinor,result.pricingQuote?.suggestedPriceMinor);assert.deepEqual(result.normalizedPricing,{mode:'automatic'});assert.equal(result.policy?.minimumPrice,undefined);
  const manual=await adapter.load({storeId:'bill',row:{...row(),pricing:{mode:'manual',planId:'high'},payload:{price:'134.99',currency_code:'CNY'}},fresh:false});assert.equal(manual.pricingQuote?.evaluatedPriceMinor,13499);assert.equal(manual.pricingQuote?.planId,'low');assert.equal(manual.normalizedPayload?.price,'134.99');assert.equal(f.writes.length,0);
 }finally{f.database.close();}
});
