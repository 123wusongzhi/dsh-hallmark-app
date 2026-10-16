// Read-only preparation over all 41 real source samples, without listing/platform writes.
import assert from 'node:assert/strict';
import { createLiveContext, materializeSource, pages, snapshotComparison } from './live-benchmark.mjs';

const ctx = await createLiveContext('preparation'), { service, check, result } = ctx;
result.products = [];
result.counts.imageRequests = 0;
await check('exact41_current_index', async () => {
  result.searchPages = await pages(cursor => service.search({ cursor, refresh: !cursor, limit: 7 }));
  assert.deepEqual(new Set(result.searchPages.flatMap(page => page.items.map(row => row.id))), new Set(ctx.ids));
});
for (const record of ctx.corpus.records) {
  const id = record.detail.id;
  const product = await check('fresh_real_product_preparation', () => service.getProduct(id, { refresh: true }), id);
  if (!product) continue;
  const detail = await service.getLegacyDetail(id), imageResults = new Map(), imageAssets = [];
  // Every distinct SKU image and two main images are real remote resources from this product.
  const assetIds = new Set([...product.skus.map(sku => sku.imageRef).filter(Boolean), ...product.assets.filter(asset => asset.roles.includes('main')).slice(0, 2).map(asset => asset.id)]);
  let nextImage = 0;
  const queue = [...assetIds];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (nextImage < queue.length) {
      const assetId = queue[nextImage++];
      result.counts.imageRequests++;
      const image = await check(`real_image_download:${assetId}`, () => service.resourceRead({ id, kind: 'image', assetId, revision: product.revision }), id);
      imageResults.set(assetId, image ?? null);
      imageAssets.push({ assetId, sourceUrl: product.assets.find(asset => asset.id === assetId).url, status: image ? 'captured' : 'failed', image: image ?? null });
    }
  }));
  await check('full_real_source_original_preparation', async () => {
    const originalPages = [], original = await materializeSource(service, id, '/source', originalPages), raw = ctx.current.get(`${id}/raw`);
    assert.notEqual(raw.truncated, true, 'Provider original must be complete');
    assert.deepEqual(original, typeof raw.content === 'string' ? JSON.parse(raw.content) : raw);
    const descriptionPages = await pages(cursor => service.resourceRead({ id, kind: 'description', cursor, revision: product.revision, limit: 53 }));
    assert.equal(descriptionPages.map(page => page.text).join(''), product.description);
    const imagePages = await pages(cursor => service.resourceRead({ id, kind: 'images', cursor, revision: product.revision, limit: 7 }));
    assert.deepEqual(imagePages.flatMap(page => page.items), product.assets);
    result.products.push({ product, sampling: record.sampling, skus: product.skus.map(sku => ({ ...sku, image: sku.imageRef ? imageResults.get(sku.imageRef) : null })), imageAssets, originalPages, descriptionPages, imagePages, comparison: snapshotComparison(record, detail, raw) });
  }, id);
  if (result.products.length % 10 === 0) console.log(`Prepared ${result.products.length}/41 current real products`);
}
await ctx.save({ purpose: 'real_source_readonly_preparation_not_formal_listing_acceptance', imagePolicy: 'Original marketplace images only; download failures are preserved without substitute pixels.' });
