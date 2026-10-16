import { recordedNormalizedProduct, recordedProduct } from '../adapter/real-scenarios.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareListing } from '../../packages/app-hallmark/src/listing-prepare.ts';
import { BusinessPackagingRepository } from '../../packages/business-packaging/src/index.ts';
import { applyExistingPackaging, readExistingCategoryHint } from '../../packages/app-hallmark/src/packaging-evidence.ts';
import type { PackagingEvidenceReader } from '../../packages/app-hallmark/src/packaging-evidence.ts';
import type { CollectionProduct } from '../../packages/collection/src/types.ts';
import type { CoreStore, RecordData } from '../../packages/core/src/types.ts';

function memory(): CoreStore {
  const records = new Map<string, unknown>();
  return {
    get<T>(collection: string, id: string) { return structuredClone(records.get(`${collection}/${id}`)) as T | undefined; },
    put<T>(collection: string, id: string, value: T) { records.set(`${collection}/${id}`, structuredClone(value)); return value; },
    list<T>(collection: string) { return [...records.entries()].filter(([key]) => key.startsWith(`${collection}/`)).map(([, value]) => structuredClone(value) as T); },
    transaction<T>(fn: (store: any) => T) { return fn(this); },
  } as CoreStore;
}
const blank = () => ({ weightGrams: null, dimensionsMm: null, original: {}, basis: 'source' });
function product(): CollectionProduct {
  return recordedNormalizedProduct({
    id: 'source-cup', sourceId: 'source-a', revision: 'source-1', fetchedAt: '2026-10-10T00:00:00.000Z', source: 'taobao_tmall', title: 'Cup', originalTitle: null, sourceUrl: null, category: { id: null, path: [] }, attributes: {}, package: blank(), unit: 'piece', minimumOrder: null, customsCodes: [], description: '', assets: [], mapping: { version: '1', coverage: 'verified_structure' },
    unknowns: [{ field: 'package.weightGrams', reason: 'missing', skuIds: ['red'] }, { field: 'package.dimensionsMm', reason: 'missing', skuIds: ['red'] }, { field: 'purchaseCost', reason: 'missing', skuIds: ['red'] }],
    skus: [{ id: 'red', spec: 'red', attributes: {}, purchaseCost: null, sourceDisplayPrice: null, package: null, imageRef: null, stock: null, enabled: null }],
  });
}
function catalog(store: CoreStore, patch: RecordData = {}) {
  const row = recordedProduct({ storeId: 'bill', offerId: 'cup-red', productId: '123', sources: [{ productId: 'source-cup', skuCode: 'red', sourceSkuMatched: true }], ...patch });
  store.put('business_catalog', `${row.storeId}/${row.offerId}`, row);
}
const attr = (patch: RecordData = {}) => ({ offer_id: 'cup-red', id: 123, weight: 330, weight_unit: 'g', depth: 250, width: 100, height: 100, dimension_unit: 'mm', ...patch });
function reader(rows = [attr()]): { calls: any[]; read: PackagingEvidenceReader } {
  const calls: any[] = [];
  return { calls, read: async input => { calls.push(input); return { status: 'ok', raw: { response: { result: rows } } }; } };
}

test('exact declared package fills only missing fields, leaves source revision usable and caller objects intact', async () => {
  const store = memory(); catalog(store);
  const source = product(), gateway = reader();
  const [result] = await applyExistingPackaging([source], store, gateway.read, { storeIds: ['bill'], now: () => 1000 });
  assert.equal(result.skus[0].package?.weightGrams, 330);
  assert.deepEqual(result.skus[0].package?.dimensionsMm, { length: 250, width: 100, height: 100 });
  assert.match(result.skus[0].package!.basis, /精确关联/);
  assert.equal(result.revision, source.revision);
  assert.equal(source.skus[0].package, null);
  assert.deepEqual(result.unknowns.map(row => row.field), ['purchaseCost']);
  assert.equal(gateway.calls.length, 1);
  assert.equal(gateway.calls[0].path, '/v4/product/info/attributes');
  assert.deepEqual(gateway.calls[0].body.filter.offer_id, ['cup-red']);
});

test('valid common fields remain authoritative and do not trigger platform reads', async () => {
  const store = memory(); catalog(store);
  const source = product(); source.package = { ...blank(), weightGrams: 999, dimensionsMm: { length: 9, width: 8, height: 7 } };
  const gateway = reader();
  const [result] = await applyExistingPackaging([source], store, gateway.read);
  assert.equal(gateway.calls.length, 0);
  assert.equal(result.package.weightGrams, 999);
  assert.equal(result.skus[0].package, null);
});

test('fallback fills dimensions without overriding SKU or common weight and accepts explicit kg/cm units', async () => {
  const store = memory(); catalog(store);
  const source = product(); source.skus[0].package = { ...blank(), weightGrams: 777 };
  const gateway = reader([attr({ weight: 0.33, weight_unit: 'kg', depth: 25, width: 10, height: 10, dimension_unit: 'cm' })]);
  const [result] = await applyExistingPackaging([source], store, gateway.read);
  assert.equal(result.skus[0].package?.weightGrams, 777);
  assert.equal(result.skus[0].package?.dimensionsMm?.length, 250);
});

test('explicit one-unit procurement bindings apply; multiple or multi-unit compositions do not', async () => {
  for (const components of [[{ itemId: 'source-cup', sourceSkuId: 'red', quantity: 2 }], [{ itemId: 'source-cup', sourceSkuId: 'red', quantity: 1 }, { itemId: 'source-cup', sourceSkuId: 'blue', quantity: 1 }]]) {
    const store = memory(); catalog(store, { procurementBinding: { components } });
    const gateway = reader();
    const [result] = await applyExistingPackaging([product()], store, gateway.read);
    assert.equal(result.skus[0].package, null);
    assert.equal(gateway.calls.length, 0);
  }
  const store = memory(); catalog(store, { procurementBinding: { components: [{ itemId: 'source-cup', sourceSkuId: 'red', quantity: 1 }] } });
  assert.equal((await applyExistingPackaging([product()], store, reader().read))[0].skus[0].package?.weightGrams, 330);
});

test('unproven source association and unowned store are never used', async () => {
  const store = memory(); catalog(store, { sources: [{ productId: 'source-cup', skuCode: 'red', sourceSkuMatched: false }] });
  catalog(store, { storeId: 'other' });
  const gateway = reader();
  const [result] = await applyExistingPackaging([product()], store, gateway.read, { storeIds: ['bill'] });
  assert.equal(result.skus[0].package, null);
  assert.equal(gateway.calls.length, 0);
});

test('Ozon offer and product identity must both match exactly with one row', async () => {
  for (const rows of [[attr({ id: 124 })], [attr({ offer_id: 'wrong' })], [attr(), attr()]]) {
    const store = memory(); catalog(store);
    const [result] = await applyExistingPackaging([product()], store, reader(rows).read);
    assert.equal(result.skus[0].package, null);
    assert.equal(store.list('business_package_evidence').length, 0);
  }
});

test('conflicting declarations stay null per field while equal dimensions can be reused', async () => {
  const store = memory(); catalog(store); catalog(store, { offerId: 'cup-red-second', productId: '124' });
  const gateway = reader([attr(), attr({ offer_id: 'cup-red-second', id: 124, weight: 500 })]);
  const [result] = await applyExistingPackaging([product()], store, gateway.read);
  assert.equal(result.skus[0].package?.weightGrams, null);
  assert.equal(result.skus[0].package?.dimensionsMm?.length, 250);
  assert.deepEqual(result.unknowns.filter(row => row.field.startsWith('package.')).map(row => row.field), ['package.weightGrams']);
});

test('only finite positive values with recognized explicit units can be used', async () => {
  const store = memory(); catalog(store);
  const [result] = await applyExistingPackaging([product()], store, reader([attr({ weight_unit: 'lb', depth: 0 })]).read);
  assert.equal(result.skus[0].package, null);
});

test('cached exact evidence avoids repeated platform calls and expires or invalidates on catalog observation', async () => {
  const store = memory(); catalog(store); const gateway = reader();
  await applyExistingPackaging([product()], store, gateway.read, { now: () => 1000, cacheTtlMs: 100 });
  await applyExistingPackaging([product()], store, gateway.read, { now: () => 1050, cacheTtlMs: 100 });
  assert.equal(gateway.calls.length, 1);
  await applyExistingPackaging([product()], store, gateway.read, { now: () => 1101, cacheTtlMs: 100 });
  assert.equal(gateway.calls.length, 2);
  catalog(store, { declaredWeight: { observedAt: 'changed' } });
  await applyExistingPackaging([product()], store, gateway.read, { now: () => 1110, cacheTtlMs: 100 });
  assert.equal(gateway.calls.length, 3);
});

test('failed or unavailable evidence reads retain source nulls without inventing fallback values', async () => {
  const store = memory(); catalog(store);
  for (const read of [async () => ({ status: 'failed' as const }), async () => { throw new Error('offline'); }]) {
    const [result] = await applyExistingPackaging([product()], store, read);
    assert.equal(result.skus[0].package, null);
  }
});

test('reads across stores are batched to at most 100 offers', async () => {
  const store = memory();
  for (let i = 0; i < 101; i++) catalog(store, { offerId: `offer-${i}`, productId: String(i) });
  const gateway = reader([]);
  await applyExistingPackaging([product()], store, gateway.read);
  assert.deepEqual(gateway.calls.map(call => call.body.filter.offer_id.length), [100, 1]);
});

test('packaging abort stops subsequent batches and leaves evidence and category cache untouched',async()=>{
 for(const rejects of [false,true]){
  const store=memory(),controller=new AbortController();for(let i=0;i<201;i++)catalog(store,{offerId:`offer-${i}`,productId:String(i+1)});
  let reads=0;const read:PackagingEvidenceReader=async()=>{reads++;controller.abort();if(rejects)throw new DOMException('cancelled','AbortError');return {status:'ok',raw:{result:[attr({offer_id:'offer-0',id:1})]}};};
  await assert.rejects(applyExistingPackaging([product()],store,read,{signal:controller.signal} as any),{name:'AbortError'});
  assert.equal(reads,1);assert.equal(store.list('business_package_evidence').length,0);assert.equal(store.list('business_listing_category_hints').length,0);
 }
});

test('packaging propagates reader AbortError even when no caller signal was supplied',async()=>{
 const store=memory();for(let i=0;i<201;i++)catalog(store,{offerId:`offer-${i}`,productId:String(i+1)});
 let reads=0;await assert.rejects(applyExistingPackaging([product()],store,async()=>{reads++;throw new DOMException('cancelled','AbortError');}),{name:'AbortError'});assert.equal(reads,1);
});

test('category hint comes from the same exact attribute read, without another request', async () => {
  const store = memory(); catalog(store);
  const gateway = reader([attr({ description_category_id: 1234, type_id: 5678 })]);
  await applyExistingPackaging([product()], store, gateway.read, { now: () => 1000 });
  assert.deepEqual(readExistingCategoryHint(store, 'source-cup'), { descriptionCategoryId: 1234, typeId: 5678, observedAt: '1970-01-01T00:00:01.000Z', source: 'exact-platform-binding' });
  assert.equal(gateway.calls.length, 1);
});

test('conflicting or absent linked categories yield no category hint', async () => {
  const store = memory(); catalog(store); catalog(store, { offerId: 'cup-red-second', productId: '124' });
  await applyExistingPackaging([product()], store, reader([attr({ description_category_id: 1234, type_id: 5678 }), attr({ offer_id: 'cup-red-second', id: 124, description_category_id: 1234, type_id: 9999 })]).read);
  assert.equal(readExistingCategoryHint(store, 'source-cup'), undefined);
  const empty = memory(); catalog(empty);
  await applyExistingPackaging([product()], empty, reader().read);
  assert.equal(readExistingCategoryHint(empty, 'source-cup'), undefined);
  assert.equal(readExistingCategoryHint(empty, 'unrelated'), undefined);
});

test('category fallback rejects a detached or reassigned exact source binding', async () => {
  for (const patch of [
    { sources: [] },
    { sources: [{ productId: 'another-source', skuCode: 'red', sourceSkuMatched: true }] },
    { sources: [{ productId: 'source-cup', skuCode: 'blue', sourceSkuMatched: true }] },
    { sources: [{ productId: 'source-cup', skuCode: 'red', sourceSkuMatched: false }] },
    { productId: '456' },
    { procurementBinding: { components: [{ itemId: 'source-cup', sourceSkuId: 'red', quantity: 2 }] } },
  ]) {
    const store = memory(); catalog(store);
    const gateway = reader([attr({ description_category_id: 1234, type_id: 5678 })]);
    await applyExistingPackaging([product()], store, gateway.read);
    assert.ok(readExistingCategoryHint(store, 'source-cup'));
    catalog(store, patch);
    // A later preparation may have complete packaging and skip enrichment entirely.
    const source = product(); source.package = { ...blank(), weightGrams: 999, dimensionsMm: { length: 9, width: 8, height: 7 } };
    await applyExistingPackaging([source], store, gateway.read);
    assert.equal(gateway.calls.length, 1);
    assert.equal(readExistingCategoryHint(store, 'source-cup'), undefined, JSON.stringify(patch));
  }
});

test('category fallback retains unchanged bindings across unrelated catalog updates', async () => {
  const store = memory(); catalog(store);
  const gateway = reader([attr({ description_category_id: 1234, type_id: 5678 })]);
  await applyExistingPackaging([product()], store, gateway.read);
  const expected = readExistingCategoryHint(store, 'source-cup');
  catalog(store, { status: 'archived', statusUpdatedAt: '2026-10-16T00:00:00.000Z' });
  catalog(store, { storeId: 'other', offerId: 'unrelated', productId: '456', sources: [] });
  assert.deepEqual(readExistingCategoryHint(store, 'source-cup'), expected);
  const copy = readExistingCategoryHint(store, 'source-cup')!; copy.typeId = 9999;
  assert.deepEqual(readExistingCategoryHint(store, 'source-cup'), expected);
  assert.equal(gateway.calls.length, 1);
});

test('fresh preparation searches after detachment, while current hints and explicit categories still select templates', async () => {
  const store = memory(); catalog(store);
  await applyExistingPackaging([product()], store, reader([attr({ description_category_id: 1234, type_id: 5678 })]).read);
  const source = product(), requests: RecordData[] = [];
  const client: any = {
    getStores: async () => ({ status: 'ok', raw: [{ id: 'bill' }] }),
    getCategoryData: async (input: RecordData) => { requests.push(input); return { status: 'ok', raw: { result: [] } }; },
  };
  const collection: any = { getProduct: async () => structuredClone(source) };
  const options = { store, client, collection, packaging: new BusinessPackagingRepository(store) };
  const input = { storeId: 'bill', selections: [{ id: source.id }], knownRevisions: { [source.id]: source.revision }, refresh: true };
  await prepareListing(input, options);
  assert.equal(requests.at(-1)?.mode, 'template');
  assert.equal(requests.at(-1)?.descriptionCategoryId, '1234');
  catalog(store, { sources: [] });
  await prepareListing(input, options);
  assert.equal(requests.at(-1)?.mode, 'search');
  await prepareListing({ ...input, categories: { [source.id]: { descriptionCategoryId: '4321', typeId: '8765' } } }, options);
  assert.equal(requests.at(-1)?.mode, 'template');
  assert.equal(requests.at(-1)?.descriptionCategoryId, '4321');
  assert.equal(requests.at(-1)?.typeId, '8765');
  assert.equal(requests.length, 3);
});

test('category fallback keeps exact store and source ownership when SKU and offer names collide', async () => {
  const store = memory(); catalog(store);
  await applyExistingPackaging([product()], store, reader([attr({ description_category_id: 1234, type_id: 5678 })]).read);
  const expected = readExistingCategoryHint(store, 'source-cup');
  catalog(store, { storeId: 'other', sources: [{ productId: 'another-source', skuCode: 'red', sourceSkuMatched: true }] });
  assert.deepEqual(readExistingCategoryHint(store, 'source-cup'), expected);
  catalog(store, { sources: [] });
  assert.equal(readExistingCategoryHint(store, 'source-cup'), undefined);
  // A colliding row in another shop cannot replace the detached evidence owner.
  catalog(store, { storeId: 'other' });
  assert.equal(readExistingCategoryHint(store, 'source-cup'), undefined);
  catalog(store);
  assert.deepEqual(readExistingCategoryHint(store, 'source-cup'), expected);
  assert.equal(readExistingCategoryHint(store, 'another-source'), undefined);
});

test('unverifiable legacy hints fall back without deleting evidence and local read errors do not mutate it', async () => {
  const store = memory(); catalog(store);
  await applyExistingPackaging([product()], store, reader([attr({ description_category_id: 1234, type_id: 5678 })]).read);
  const saved = store.get<any>('business_listing_category_hints', 'source-cup');
  for (const bindings of [undefined, []]) {
    store.put('business_listing_category_hints', 'source-cup', { ...saved, bindings });
    assert.equal(readExistingCategoryHint(store, 'source-cup'), undefined);
    assert.deepEqual(store.get('business_listing_category_hints', 'source-cup'), { ...saved, bindings });
  }
  store.put('business_listing_category_hints', 'source-cup', saved);
  const unavailable = { ...store, list() { throw new Error('LOCAL_READ_UNAVAILABLE'); } } as CoreStore;
  assert.throws(() => readExistingCategoryHint(unavailable, 'source-cup'), /LOCAL_READ_UNAVAILABLE/);
  assert.deepEqual(store.get('business_listing_category_hints', 'source-cup'), saved);
  assert.ok(readExistingCategoryHint(store, 'source-cup'));
});
