import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareBrowserData } from '../../scripts/prepare-real-test-data.mjs';
import { CollectionService, normalizeProduct, COLLECTION_RESPONSE_MAX_BYTES } from '../../packages/collection/src/index.ts';
import { realCorpus, realDetail, realRaw, realSourceSummaries } from '../real-data/corpus.ts';
import { recordedDetail, recordedSku, recordedProduct } from '../adapter/real-scenarios.ts';
import { realStoreProducts } from '../real-data/corpus.ts';

const corpus = realCorpus();
test('a fresh checkout can derive browser fixtures from the private corpus without hiding tampering', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'real-browser-fixtures-'));
  const output = join(directory, 'browser-data.ts');
  try {
    prepareBrowserData({ output });
    const generated = await import(pathToFileURL(output).href);
    assert.deepEqual(generated.REAL_SOURCE_DETAILS, corpus.records.map(row => row.detail));
    assert.deepEqual(generated.REAL_SOURCE_SUMMARIES, corpus.records.map(row => row.summary));
    assert.deepEqual(generated.REAL_STORES, corpus.ancillary.stores.data);
    assert.deepEqual(generated.REAL_SALES_PRODUCTS, corpus.ancillary.storeProducts.data.products);
    for (const image of corpus.imageAssets.filter(image => image.status === 'captured')) {
      const encoded = generated.REAL_SOURCE_IMAGE_DATA[image.productId];
      assert.ok(encoded.startsWith(`data:${image.mimeType};base64,`));
      assert.equal(createHash('sha256').update(Buffer.from(encoded.split(',')[1], 'base64')).digest('hex'), image.sha256);
    }
    writeFileSync(output, '// deliberately modified');
    prepareBrowserData({ output });
    assert.equal(readFileSync(output, 'utf8'), '// deliberately modified');
    prepareBrowserData({ output, replace: true });
    assert.match(readFileSync(output, 'utf8'), /export const REAL_SOURCE_DETAILS/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
function replay() {
  const records = new Map<string, any>(), reads = { detail: 0, raw: 0, search: 0 };
  const service = new CollectionService({
    store: {
      get: <T>(collection: string, id: string) => structuredClone(records.get(`${collection}/${id}`)) as T | undefined,
      put: <T>(collection: string, id: string, value: T) => { records.set(`${collection}/${id}`, structuredClone(value)); return value; },
    },
    client: {
      searchCollectedItems: async () => { reads.search++; return { status: 'ok', raw: realSourceSummaries() }; },
      getCollectedItemDetail: async id => { reads.detail++; return { status: 'ok', raw: realDetail(id) }; },
      getCollectedItem: async id => { reads.raw++; return { status: 'ok', raw: realRaw(id) }; },
    },
  });
  return { service, reads };
}
function validPrice(value: unknown): boolean {
  return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) >= 0;
}
async function restoreRaw(service: CollectionService, id: string, originalPath = '/source'): Promise<any> {
  let path = originalPath, cursor: string | undefined, result: any;
  do {
    const page = await service.resourceRead({ id, kind: 'raw', path, cursor, maxBytes: 14000, limit: 100 });
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 14000);
    path = page.path;
    if (page.directory) {
      result ??= {};
      for (const entry of page.directory) {
        const key = entry.keyPreview ? await restoreRaw(service, entry.keyResource.id, entry.keyResource.path) : entry.key;
        result[key] = await restoreRaw(service, id, entry.path);
      }
    } else if (typeof page.value === 'string') result = (result ?? '') + page.value;
    else if (Array.isArray(page.value)) {
      result ??= [];
      for (const value of page.value) result.push(value?.expand && value.path ? await restoreRaw(service, id, value.path) : value);
    } else result = page.value;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return result;
}

test('scenario helpers retain every recorded field by default and removals require explicit fault arguments', () => {
  assert.deepEqual(recordedDetail(), realDetail());
  assert.deepEqual(recordedSku(), realDetail().skus[0]);
  for (let index = 0; index < corpus.records.length; index++) {
    const detail = realDetail(index); assert.deepEqual(recordedDetail({}, index), detail);
    for (let skuIndex = 0; skuIndex < detail.skus.length; skuIndex++) assert.deepEqual(recordedSku({}, index, skuIndex), detail.skus[skuIndex]);
  }
  const sales = realStoreProducts().products;
  for (let index = 0; index < sales.length; index++) assert.deepEqual(recordedProduct({}, index), sales[index]);
  const removed = recordedSku({}, 1, 0, ['goodsPrice']); assert.equal(Object.hasOwn(removed, 'goodsPrice'), false);
  assert.equal(Object.hasOwn(realDetail(1).skus[0], 'goodsPrice'), true);
});

test('41 unchanged source recordings retain exact source quotas, independent provenance hashes and diverse traits', () => {
  assert.equal(corpus.records.length, 41);
  assert.deepEqual(Object.fromEntries(['taobao_tmall', 'alibaba_com', 'pinduoduo'].map(source => [source, corpus.records.filter(row => row.detail.source === source).length])), { taobao_tmall: 20, alibaba_com: 20, pinduoduo: 1 });
  assert.equal(new Set(corpus.records.map(row => row.detail.id)).size, 41);
  const features = new Set(corpus.records.flatMap(row => row.sampling.features));
  for (const feature of ['sku:one', 'sku:multiple', 'sku:many-25-plus', 'sku-identity:missing', 'currency:CNY', 'currency:USD', 'package:sku-logistics', 'price:varies-by-sku']) assert.ok(features.has(feature), feature);
  for (const row of corpus.records) for (const kind of ['detail', 'raw'] as const) {
    assert.equal(createHash('sha256').update(JSON.stringify(row[kind])).digest('hex'), row.provenance[kind].valueSha256);
    assert.equal(row.provenance[kind].status, 200);
    assert.equal(row.provenance[kind].method, 'GET');
  }
});

test('all unchanged source summaries paginate and match their own title with complete source facets', async () => {
  const { service, reads } = replay();
  const ids: string[] = []; let cursor: string | null = null;
  do {
    const result = await service.search({ limit: 10, ...(cursor ? { cursor } : {}) });
    assert.equal(result.total, 41);
    assert.deepEqual(result.facets.sources, { taobao_tmall: 20, alibaba_com: 20, pinduoduo: 1 });
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= COLLECTION_RESPONSE_MAX_BYTES);
    ids.push(...result.items.map((item: any) => item.id)); cursor = result.nextCursor;
  } while (cursor);
  assert.deepEqual(ids, corpus.records.map(row => row.detail.id));
  for (const row of corpus.records) {
    const result = await service.search({ query: row.detail.title });
    assert.ok(result.items.some((item: any) => item.id === row.detail.id), row.detail.id);
  }
  assert.equal(reads.search, 1); assert.equal(reads.detail, 41); assert.equal(reads.raw, 0);
});

for (const row of corpus.records) test(`unchanged ${row.detail.source} ${row.detail.id}: details, every SKU page and original evidence survive replay`, async () => {
  const { service, reads } = replay(), original = structuredClone(row.detail);
  const product = await service.getProduct(row.detail.id);
  assert.deepEqual(product, normalizeProduct(row.detail, 'legacy-collection', product.fetchedAt));
  assert.deepEqual(await service.getLegacyDetail(row.detail.id), row.detail);
  assert.equal(product.title, row.detail.title); assert.equal(product.source, row.detail.source);
  assert.equal(product.skus.length, row.detail.skus.length);
  const seen: Array<string | null> = []; let cursor: string | null = null;
  do {
    const result = await service.read({ id: row.detail.id, limit: 9, maxBytes: 65536, ...(cursor ? { cursor } : {}) });
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
    const item = result.items[0]; assert.equal(item.skus.total, row.detail.skus.length);
    seen.push(...item.skus.rows.map((sku: any[]) => sku[0])); cursor = item.skus.nextCursor;
  } while (cursor);
  assert.deepEqual(seen, product.skus.map(sku => sku.id));
  for (let index = 0; index < row.detail.skus.length; index++) {
    const sku = row.detail.skus[index], cost = product.skus[index].purchaseCost;
    const amount = validPrice(sku.goodsPrice) ? sku.goodsPrice : validPrice(sku.sourceSellingPrice?.amount) ? sku.sourceSellingPrice.amount : sku.price;
    const baseCurrency = validPrice(sku.goodsPrice) ? sku.currency ?? row.detail.currency : validPrice(sku.sourceSellingPrice?.amount) ? sku.sourceSellingPrice.currency ?? sku.currency ?? row.detail.currency : sku.currency ?? row.detail.currency;
    const freight = row.detail.delivery?.freightAmount;
    if (validPrice(amount) && typeof baseCurrency === 'string' && baseCurrency.trim() && (!validPrice(freight) || row.detail.currency === baseCurrency || !row.detail.currency)) {
      const addFreight = validPrice(freight) && !(row.detail.source === 'taobao_tmall' && !validPrice(sku.goodsPrice) && !validPrice(sku.sourceSellingPrice?.amount));
      assert.ok(cost, `${row.detail.id} SKU ${index} missing captured purchase price`);
      assert.equal(Number(cost!.amount), addFreight ? (Math.round(Number(amount) * 100) + Math.round(Number(freight) * 100)) / 100 : Number(amount));
      assert.equal(cost!.currency, baseCurrency); assert.equal(cost!.meaning, 'purchase_cost');
    } else {
      assert.equal(cost, null, `${row.detail.id} SKU ${index}: missing/invalid prices must stay unknown`);
      if (product.skus[index].id) assert.ok(product.unknowns.some(value => value.field === 'purchaseCost' && value.skuIds?.includes(product.skus[index].id!)), 'a missing recorded price has an explicit unknown reason');
    }
    if (cost) assert.equal(cost.unit, typeof sku.unit === 'string' && sku.unit.trim() ? sku.unit.trim() : product.unit);
  }
  const raw = realRaw(row.detail.id), rawContent = JSON.parse(raw.content);
  const evidence = await restoreRaw(service, row.detail.id);
  assert.deepEqual(evidence, rawContent, 'every nested original field and array survives bounded resource pages');
  assert.equal(createHash('sha256').update(JSON.stringify(evidence)).digest('hex'), createHash('sha256').update(JSON.stringify(rawContent)).digest('hex'));
  assert.equal(reads.detail, 1); assert.equal(reads.raw, 1);
  assert.deepEqual(row.detail, original, 'normalization and paging never modify a source recording');
  assert.deepEqual(realDetail(row.detail.id), original, 'scenario tests cannot mutate the canonical recording');
});
