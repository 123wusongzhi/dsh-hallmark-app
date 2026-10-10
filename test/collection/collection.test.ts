import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CollectionService, CollectionError, normalizeProduct, COLLECTION_RESPONSE_MAX_BYTES } from '../../packages/collection/src/index.ts';
import type { CollectionOptions } from '../../packages/collection/src/index.ts';

function fixture(id = 'product-a', count = 3): any {
  return { id, source: 'taobao_tmall', title: `商品 ${id}`, currency: 'CNY', attributes: { 材质: '不锈钢', 型号: 'FM07-12D' },
    images: ['https://images.example/main.jpg'], descriptionImages: ['https://images.example/detail.jpg'],
    package: { weightKg: 0.33, dimensionsCm: [25, 10, 10] }, description: '😀商品资料'.repeat(700),
    skus: Array.from({ length: count }, (_, i) => ({ sourceSkuId: `sku-${i}`, spec: `材质:不锈钢 | 颜色:颜色${i}`, properties: { 材质: '不锈钢', 颜色: `颜色${i}` }, goodsPrice: `${i + 1}.25`, price: i + 10, image: `https://images.example/sku-${i}.jpg` })) };
}
function setup(details: any[], extras: Partial<CollectionOptions> = {}) {
  const values = new Map<string, any>(); const calls = { detail: 0, raw: 0, search: 0 };
  const client = {
    async searchCollectedItems() { calls.search++; return { status: 'ok' as const, raw: details.map(d => ({ id: d.id, title: d.title, source: d.source, categoryPath: ['配件'], skuCount: d.skus.length, currency: d.currency, goodsMinPrice: 1.25, goodsMaxPrice: d.skus.length + .25, taskRelations: [{ store: 'bill' }] })) }; },
    async getCollectedItemDetail(id: string) { calls.detail++; return { status: 'ok' as const, raw: details.find(d => d.id === id) }; },
    async getCollectedItem(id: string) { calls.raw++; return { status: 'ok' as const, raw: { id, content: JSON.stringify({ bulky: '原始字典'.repeat(5000), rows: Array.from({ length: 70 }, (_, i) => ({ id: i, value: 'raw' })) }), truncated: false } }; },
  };
  const service = new CollectionService({ client, store: { get: <T>(c: string, id: string) => values.get(`${c}/${id}`) as T | undefined, put: <T>(c: string, id: string, v: T) => { values.set(`${c}/${id}`, structuredClone(v)); return v; } }, ...extras });
  return { service, calls, details, values };
}

test('normalization preserves procurement meaning, common package and selected facts only', () => {
  const detail = fixture(); detail.sourceDetails = { editorFields: { dictionary: 'noise'.repeat(10000) }, companyProfile: { about: 'noise' } };
  const p = normalizeProduct(detail);
  assert.equal(p.package.weightGrams, 330); assert.deepEqual(p.package.dimensionsMm, { length: 250, width: 100, height: 100 });
  assert.equal(p.skus[0].purchaseCost?.amount, '1.25'); assert.equal(p.skus[0].purchaseCost?.meaning, 'purchase_cost');
  assert.equal(p.attributes.型号, 'FM07-12D'); assert(!JSON.stringify(p).includes('dictionary'));
  detail.source = 'alibaba_com'; detail.skus = [{ sourceSkuId: 'A', price: 2, sourceSellingPrice: { amount: 2, currency: 'USD' } }];
  const alibaba = normalizeProduct(detail);
  assert.equal(alibaba.skus[0].purchaseCost, null); assert.equal(alibaba.skus[0].sourceDisplayPrice?.amount, '2');
  assert(alibaba.unknowns.some(u => u.field === 'purchaseCost'));
});

test('Alibaba logistics packages and SKU images bind by stable identity, never row order', () => {
  const d = fixture(); d.source = 'alibaba_com'; delete d.package;
  d.skus = [{ id: 'native-b', sourceSkuId: 'B', properties: { 颜色: '蓝' } }, { id: 'native-a', sourceSkuId: 'A', properties: { 颜色: '红' } }];
  d.sourceDetails = { packaging: { pkgWeight: .33, pkgMeasure: { inputArray: ['25', '10', '10'] } }, logistics: { logisticsSku: [{ skuId: 'native-a', skuOuterId: 'A', pkgWeightSku: .5, pkgMeasureLengthSku: 30, pkgMeasureWidthSku: 20, pkgMeasureHeightSku: 10 }], tariffsHsCode: [{ hsCode: '85369060' }] }, editorFields: { priceUnit: { text: 'Piece/Pieces' }, minOrderQuantity: 1, saleProp: { color: [{ text: '红', imageUrl: 'https://images.example/red.jpg' }] } } };
  const p = normalizeProduct(d);
  assert.equal(p.skus[0].package, null); assert.equal(p.skus[1].package?.weightGrams, 500);
  assert.equal(p.package.weightGrams, 330); assert.equal(p.unit, 'Piece/Pieces'); assert.equal(p.minimumOrder, 1);
  assert.deepEqual(p.customsCodes, ['85369060']); assert.deepEqual(p.assets.find(a => a.id === p.skus[1].imageRef)?.skuIds, ['A']);
});

test('335 SKUs paginate completely; common attributes cover selected set and source cost stays exact', async () => {
  const { service, calls } = setup([fixture('large', 335)]);
  const seen: string[] = []; let cursor: string | undefined;
  do {
    const r = await service.read({ id: 'large', cursor });
    const item = r.items[0]; assert(item.skus.returned <= 40); assert.equal(item.skus.total, 335);
    assert.deepEqual(item.skus.common.attributes, { 材质: '不锈钢' });
    seen.push(...item.skus.rows.map((row: any[]) => row[0])); cursor = item.skus.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(seen.length, 335); assert.equal(new Set(seen).size, 335); assert.equal(calls.detail, 1); assert.equal(calls.raw, 0);
  const r = await service.read({ id: 'large', skuIds: ['sku-330'] });
  assert.equal(r.items[0].skus.rows[0][0], 'sku-330'); assert.equal(r.items[0].skus.common.purchaseCost.amount, '331.25');
  assert.equal(r.items[0].skus.common.scope, 'selected_skus');
});

test('search excludes task text and searches model facts; facets count all matches before pagination', async () => {
  const details = Array.from({ length: 35 }, (_, i) => fixture(`item-${i}`));
  const { service } = setup(details);
  assert.equal((await service.search({ query: 'bill' })).total, 0);
  const page = await service.search({ query: 'fm07', limit: 30 });
  assert.equal(page.total, 35); assert.equal(page.returned, 30); assert.equal(page.facets.sources.taobao_tmall, 35);
  const second = await service.search({ query: 'fm07', cursor: page.nextCursor });
  assert.equal(second.returned, 5); assert.equal(second.nextCursor, null);
  await assert.rejects(service.search({ query: 'different', cursor: page.nextCursor }), (e: any) => e.code === 'COLLECTION_CURSOR_INVALID');
});

test('not-listed filter never treats absent operating data as proof; status callback gets SKU totals', async () => {
  const details = [fixture('a'), fixture('b')];
  const unknown = setup(details).service;
  assert.equal((await unknown.search({ store: { id: 'bill', status: 'not_listed' } })).total, 0);
  const { service } = setup(details, { listingStates: async (ids, summaries) => {
    assert.deepEqual(ids, ['a', 'b']); assert.equal(summaries?.[0].skuCount, 3);
    return { a: [{ storeId: 'bill', status: 'listed', listedSkuIds: ['sku-0', 'sku-1', 'sku-2'] }], b: [{ storeId: 'bill', status: 'partial', listedSkuIds: ['sku-0'] }] };
  } });
  const r = await service.search({ store: { id: 'bill', status: 'partial' } });
  assert.equal(r.total, 1); assert.equal(r.items[0].id, 'b');
});

test('store association and sale-state filters combine before paging and facets, and refresh reaches operating data', async () => {
  const details = Array.from({ length: 35 }, (_, i) => fixture(`item-${i}`));
  const { service } = setup(details, { listingStates: async (ids, _summaries, options) => {
    assert.equal(options?.refresh, true);
    return Object.fromEntries(ids.map((id, index) => [id, [{ storeId: 'bill', status: 'listed', association: 'linked', offerCount: 2,
      // Mixed freshness must not hide a different, freshly observed archived offer.
      freshness: 'stale', saleStates: { on_sale: 0, out_of_stock: 0, pending: 0, archived: index < 32 ? 1 : 0, failed: index >= 32 ? 1 : 0, not_sellable: 0, unknown: 1 } }]]));
  } });
  const input = { store: { id: 'bill', saleState: 'archived' as const, association: 'linked' as const }, refresh: true, limit: 10 };
  const result = await service.search(input);
  assert.equal(result.total, 32); assert.equal(result.returned, 10); assert.equal(result.facets.sources.taobao_tmall, 32);
  assert.equal((await service.search({ ...input, cursor: result.nextCursor })).items[0].id, 'item-10');
  assert.equal((await service.search({ ...input, store: { id: 'bill', saleState: 'on_sale' } })).total, 0);
  assert.equal((await service.search({ ...input, store: { id: 'bill', saleState: 'failed', status: 'listed' } })).total, 3);
  assert.equal((await service.search({ ...input, store: { id: 'missing', association: 'none' } })).total, 0);
  assert.equal((await service.search({ ...input, store: { id: 'missing', saleState: 'unknown', association: 'unknown' } })).total, 35);
});

test('large SKU associations keep exact offer counts in bounded cards and expose complete IDs through a resource', async () => {
  const ids = Array.from({ length: 335 }, (_, i) => `sku-${i}`);
  const { service } = setup(Array.from({ length: 30 }, (_, i) => fixture(`item-${i}`, 335)), { listingStates: async productIds => Object.fromEntries(productIds.map(id => [id, [{ storeId: 'bill', status: 'listed', listedSkuIds: ids, listedSkuCount: 335, associatedSkuIds: ids, associatedSkuCount: 335, association: 'linked', offerCount: 402, countUnit: 'offers', freshness: 'fresh', observedAt: '2026-10-10T00:00:00Z', saleStates: { on_sale: 200, out_of_stock: 100, pending: 0, archived: 102, failed: 0, not_sellable: 0, unknown: 0 } }]])) });
  let page = await service.search(), count = 0;
  const first = page.items[0].listedIn[0];
  assert.equal(first.offerCount, 402); assert.equal(first.associatedSkuCount, 335); assert.equal(first.skuIdsComplete, false); assert.equal(first.associatedSkuIds.length, 12); assert.equal(first.saleStates.archived, 102);
  const expanded = await service.resourceRead(first.available); assert.deepEqual(expanded.value.associatedSkuIds, ids);
  for (;;) { assert.ok(Buffer.byteLength(JSON.stringify(page)) <= COLLECTION_RESPONSE_MAX_BYTES); count += page.items.length; if (!page.nextCursor) break; page = await service.search({ cursor: page.nextCursor }); }
  assert.equal(count, 30);
});

test('changed source version invalidates SKU cursor and original processed detail shares cache', async () => {
  const details = [fixture('large', 70)]; const { service, calls } = setup(details);
  const r = await service.read({ id: 'large' });
  const original = await service.getLegacyDetail('large'); assert.equal(original.skus.length, 70); assert.equal(calls.detail, 1);
  details[0].skus[0].goodsPrice = '999.00'; await service.getProduct('large', { refresh: true });
  await assert.rejects(service.read({ id: 'large', cursor: r.items[0].skus.nextCursor }), (e: any) => e.code === 'COLLECTION_REVISION_CHANGED');
});

test('batch budget continues with explicit selections and unknowns stay distinct from omitted content', async () => {
  const { service } = setup(Array.from({ length: 10 }, (_, i) => fixture(`item-${i}`, 40)));
  let input: any = { ids: Array.from({ length: 10 }, (_, i) => `item-${i}`), maxBytes: 8192 };
  const seen: string[] = [];
  while (input) {
    const r = await service.read(input);
    assert(Buffer.byteLength(JSON.stringify(r)) <= 8192);
    seen.push(...r.items.map((item: any) => item.id));
    for (const item of r.items) { assert(item.available.length); assert(!item.unknowns?.some((u: any) => u.reason.includes('未加载'))); }
    input = r.continuation?.input;
  }
  assert.equal(seen.length, 10); assert.equal(new Set(seen).size, 10);
});

test('one hundred product references cannot bypass a small response budget through continuation metadata', async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `long-product-reference-${String(i).padStart(3, '0')}-${'x'.repeat(50)}`);
  const { service } = setup(ids.map(id => fixture(id, 10)));
  const r = await service.read({ ids, maxBytes: 2048 });
  assert(Buffer.byteLength(JSON.stringify(r)) <= 2048);
  assert(r.continuation.remaining > 0);
  assert(r.continuation.input.cursor.startsWith('batch:'));
  const second = await service.read(r.continuation.input);
  assert(second.items[0].id !== r.items[0].id);
});

test('raw evidence returns complete directories/array pages, unicode descriptions have lossless continuation', async () => {
  const { service, calls } = setup([fixture()]);
  const r = await service.resourceRead({ id: 'product-a', kind: 'raw', maxBytes: 1024 });
  assert(r.directory.some((e: any) => e.path === '/source/bulky'));
  const p = await service.resourceRead({ id: 'product-a', kind: 'raw', path: '/source/rows' }); assert.equal(p.returned, 40);
  const p2 = await service.resourceRead({ id: 'product-a', kind: 'raw', path: '/source/rows', cursor: p.nextCursor }); assert.equal(p2.returned, 30); assert.equal(calls.raw, 1);
  const initial = await service.read({ id: 'product-a' }); let text = initial.items[0].description.text, cursor = initial.items[0].description.nextCursor;
  while (cursor) { const part = await service.resourceRead({ id: 'product-a', kind: 'description', cursor }); text += part.text; cursor = part.nextCursor; }
  assert.equal(text, fixture().description);
  await assert.rejects(service.resourceRead({ id: 'product-a', path: '/detail/__proto__' }), CollectionError);
});

test('plain-text SKU specs survive compact output and selected missing SKU is explicit error', async () => {
  const d = fixture(); d.skus = [{ sourceSkuId: 'a', spec: '红色小款', goodsPrice: 5 }, { sourceSkuId: 'b', spec: '蓝色大款', goodsPrice: 7 }];
  const { service } = setup([d]); const r = await service.read({ id: d.id });
  assert(r.items[0].skus.columns.includes('spec')); assert(r.items[0].skus.rows[0].includes('红色小款'));
  await assert.rejects(service.read({ id: d.id, skuIds: ['bad'] }), (e: any) => e.code === 'COLLECTION_SKU_NOT_FOUND');
});

test('image read caches verified content and returns host-resolved resource with exact SKU binding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collection-test-'));
  try {
    let downloads = 0;
    const { service } = setup([fixture()], { cacheDir: directory, fetch: (async () => { downloads++; return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')); }) as typeof fetch,
      exposeAsset: async asset => ({ resourceUrl: `host-resource:${asset.resourceId}` }),
    });
    const product = await service.getProduct('product-a'); const id = product.skus[1].imageRef!;
    const first = await service.resourceRead({ id: product.id, kind: 'image', assetId: id });
    const second = await service.resourceRead({ id: product.id, kind: 'image', assetId: id });
    assert.equal(first.mimeType, 'image/png'); assert.equal(first.revision, second.revision); assert.equal(downloads, 1); assert(first.resourceUrl.startsWith('host-resource:')); assert.deepEqual(first.skuIds, ['sku-1']);
    await assert.rejects(service.resourceRead({ id: product.id, kind: 'image', assetId: 'external-url' }), (e: any) => e.code === 'COLLECTION_ASSET_NOT_FOUND');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('image resource refuses successful HTTP pages with non-image body', async () => {
  const { service } = setup([fixture()], { fetch: (async () => new Response('<html>login</html>', { headers: { 'content-type': 'image/jpeg' } })) as typeof fetch });
  const product = await service.getProduct('product-a');
  await assert.rejects(service.resourceRead({ id: product.id, kind: 'image', assetId: product.skus[0].imageRef! }), (e: any) => e.code === 'COLLECTION_IMAGE_TYPE');
});

test('cached image references are bounded, read-only, source-scoped and tied to the current product revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collection-review-cache-'));
  let downloads = 0;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t8sAAAAASUVORK5CYII=', 'base64');
  const first = fixture('first', 335), second = fixture('second', 335);
  const f = setup([first, second], { cacheDir: directory, fetch: async () => { downloads++; return new Response(png); } });
  try {
    const product = await f.service.getProduct('first'), other = await f.service.getProduct('second');
    const assetIds = [product.skus[0].imageRef!, product.skus[167].imageRef!, product.skus[334].imageRef!];
    for (const assetId of assetIds) await f.service.resourceRead({ id: product.id, kind: 'image', assetId });
    const before = structuredClone([...f.values]), calls = { ...f.calls };
    const references = f.service.cachedImageAssets(product);
    assert.deepEqual(references.map(asset => asset.id), assetIds);
    assert.ok(references.every(asset => /^[a-f0-9]{64}$/.test(asset.contentHash)));
    assert.deepEqual(f.service.cachedImageAssets(product, { excludeAssetIds: [assetIds[0]], limit: 1 }).map(asset => asset.id), [assetIds[1]]);
    assert.deepEqual(f.service.cachedImageAssets(product, { assetIds: [assetIds[2]] }).map(asset => asset.id), [assetIds[2]]);
    assert.deepEqual(f.service.cachedImageAssets(other), [], 'same URLs downloaded for another item are not its evidence');
    assert.deepEqual(f.service.cachedImageAssets({ ...product, sourceId: 'unrelated-provider' }), []);
    assert.deepEqual([...f.values], before, 'reading cache evidence never changes source or asset records');
    assert.deepEqual(f.calls, calls); assert.equal(downloads, 3, '335 SKU candidates do not trigger downloads');
    references[0].skuIds.push('caller-change');
    assert.deepEqual(f.service.cachedImageAssets(product)[0].skuIds, ['sku-0']);
    first.skus[0].image = 'https://images.example/replaced.jpg';
    const changed = await f.service.getProduct('first', { refresh: true });
    assert.deepEqual(f.service.cachedImageAssets(product), [], 'an obsolete source snapshot cannot supply reference metadata');
    assert.deepEqual(f.service.cachedImageAssets(changed).map(asset => asset.id), assetIds.slice(1), 'replaced asset URLs do not inherit old cached pixels');
    assert.equal(downloads, 3);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const assertBudget = (value: unknown, budget = COLLECTION_RESPONSE_MAX_BYTES) => assert(Buffer.byteLength(JSON.stringify(value), 'utf8') <= budget, `response exceeds ${budget} UTF-8 bytes`);

async function readString(service: CollectionService, id: string, path: string, maxBytes = 65536): Promise<string> {
  let cursor: string | undefined, result = '';
  do {
    const part = await service.resourceRead({ id, kind: 'raw', path, cursor, limit: 8000, maxBytes });
    assertBudget(part, Math.min(maxBytes, COLLECTION_RESPONSE_MAX_BYTES));
    assert.equal(typeof part.value, 'string'); result += part.value;
    path = part.path; cursor = part.nextCursor ?? undefined;
  } while (cursor);
  return result;
}

test('all collection read responses cap caller requests at 14 KiB and preserve every SKU across pages', async () => {
  const detail = fixture('large-budget', 335); detail.description = '';
  for (const sku of detail.skus) sku.properties['参数'] = '详细属性'.repeat(60) + sku.sourceSkuId;
  const { service } = setup([detail]); const ids: string[] = []; let cursor: string | undefined;
  do {
    const response = await service.read({ id: detail.id, cursor, maxBytes: 65536 }); assertBudget(response);
    const item = response.items[0]; ids.push(...item.skus.rows.map((row: any[]) => row[0]));
    cursor = item.skus.nextCursor ?? undefined;
    if (cursor) assert.equal(response.completeness, 'partial');
  } while (cursor);
  assert.deepEqual(ids, detail.skus.map((sku: any) => sku.sourceSkuId));
});

test('oversized title and one oversized SKU remain reachable without lying about completeness', async () => {
  const detail = fixture('huge-fields', 1); detail.title = '超长标题😀'.repeat(8000); detail.skus[0].properties['参数'] = '完整参数'.repeat(12000);
  const { service } = setup([detail]); const response = await service.read({ id: detail.id, maxBytes: 65536 });
  assertBudget(response); assert.equal(response.completeness, 'partial'); assert(response.items[0].omitted);
  assert.equal(await readString(service, detail.id, '/normalized/title'), detail.title);
  assert.equal(await readString(service, detail.id, '/normalized/skus/0/attributes/参数'), detail.skus[0].properties['参数']);
  const directory = await service.resourceRead({ id: detail.id, path: '/normalized', maxBytes: 65536 }); assertBudget(directory); assert(directory.directory); assert.equal(directory.completeness, 'partial');
});

test('search includes metadata in its budget, pages all long cards and exposes oversized facets losslessly', async () => {
  const details = Array.from({ length: 85 }, (_, i) => { const d = fixture(`long-card-${i}`, 1); d.source = `source-${i}-${'来源'.repeat(100)}`; d.title = `${i}-${'搜索标题'.repeat(i === 0 ? 6000 : 240)}`; return d; });
  const { service } = setup(details); let cursor: string | undefined; const ids: string[] = []; let facetResource: any, cardResource: any;
  do {
    const response = await service.search({ limit: 100, cursor }); assertBudget(response); ids.push(...response.items.map((item: any) => item.id));
    facetResource ??= response.facets.available?.[0]; cardResource ??= response.items.find((item: any) => item.deferred)?.deferred.resource;
    cursor = response.nextCursor ?? undefined; if (cursor) assert.equal(response.completeness, 'partial');
  } while (cursor);
  assert.deepEqual(ids, details.map(d => d.id)); assert(facetResource); assert(cardResource);
  assert.equal(await readString(service, cardResource.id, `${cardResource.path}/title`), details[0].title);
  const facets = await service.resourceRead({ ...facetResource, maxBytes: 65536 }); assertBudget(facets); assert(facets.directory);
  const sourcesPath = facets.directory.find((entry: any) => entry.key === 'sources').path;
  let next: string | undefined; const sources: string[] = [];
  do { const page = await service.resourceRead({ id: facetResource.id, path: sourcesPath, cursor: next, maxBytes: 2048 }); assertBudget(page, 2048); for (const entry of page.directory) { sources.push(entry.keyPreview ? await readString(service, entry.keyResource.id, entry.keyResource.path) : entry.key); const count = await service.resourceRead({ id: facetResource.id, path: entry.path }); assertBudget(count); assert.equal(count.value, 1); } next = page.nextCursor ?? undefined; } while (next);
  assert.deepEqual(new Set(sources), new Set(details.map(d => d.source)));
});

test('image listings with long URLs and large SKU associations page or defer without truncating JSON', async () => {
  const detail = fixture('long-images', 150);
  detail.images = [`https://images.example/${'signed='.repeat(6000)}`];
  for (const [i, sku] of detail.skus.entries()) sku.image = `https://images.example/${i}/${'x'.repeat(1200)}.jpg`;
  const { service } = setup([detail]); const expected = (await service.getProduct(detail.id)).assets.map(a => a.id); let cursor: string | undefined; const ids: string[] = []; let deferred: any;
  do { const response = await service.resourceRead({ id: detail.id, kind: 'images', limit: 100, maxBytes: 65536, cursor }); assertBudget(response); ids.push(...response.items.map((a: any) => a.id)); deferred ??= response.items.find((a: any) => a.deferred)?.deferred; cursor = response.nextCursor ?? undefined; } while (cursor);
  assert.deepEqual(ids, expected); assert(deferred);
  assert.equal(await readString(service, deferred.id, `${deferred.path}/url`), detail.images[0]);
});

test('raw strings, arrays, huge directory keys and full metadata all obey the caller-safe budget', async () => {
  const detail = fixture('raw-long', 1), hugeKey = '字段😀'.repeat(5000);
  detail.extra = { [hugeKey]: '值\n😀'.repeat(11000), many: Array.from({ length: 35 }, (_, i) => ({ index: i, data: '数组值'.repeat(400) })) };
  const { service } = setup([detail]);
  const directory = await service.resourceRead({ id: detail.id, path: '/detail/extra', maxBytes: 2048 }); assertBudget(directory, 2048);
  const entry = directory.directory.find((d: any) => d.keyPreview); assert(entry); assert.equal(await readString(service, entry.keyResource.id, entry.keyResource.path, 2048), hugeKey); assert.equal(await readString(service, detail.id, entry.path, 2048), detail.extra[hugeKey]);
  let cursor: string | undefined; const indices: number[] = [];
  do { const page = await service.resourceRead({ id: detail.id, path: '/detail/extra/many', maxBytes: 65536, limit: 100, cursor }); assertBudget(page); for (const item of page.value) { if (item.expand) { const restored = await service.resourceRead({ id: detail.id, path: item.path, maxBytes: 65536 }); assertBudget(restored); indices.push(restored.value.index); } else indices.push(item.index); } cursor = page.nextCursor ?? undefined; } while (cursor);
  assert.deepEqual(indices, detail.extra.many.map((item: any) => item.index));
  const description = await service.resourceRead({ id: detail.id, kind: 'description', limit: 8000, maxBytes: 2048 }); assertBudget(description, 2048); assert(description.returned > 0); assert.equal(description.completeness, 'partial');
});

test('small complete product remains one call with no new deferred facts or continuation', async () => {
  const detail = fixture('small', 1); detail.description = '简短资料';
  const { service, calls } = setup([detail]); const response = await service.read({ id: detail.id, maxBytes: 65536 });
  assertBudget(response); assert.equal(response.items.length, 1); assert.equal(response.items[0].skus.returned, 1); assert.equal(response.items[0].omitted, undefined); assert.equal(response.items[0].skus.nextCursor, null); assert.equal(response.continuation, null); assert.equal(response.completeness, 'complete'); assert.equal(calls.detail, 1); assert.equal(calls.raw, 0);
});
