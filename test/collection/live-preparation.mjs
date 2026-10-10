// Read-only development preparation; formal Agent acceptance is recorded after installation.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CollectionService } from '../../packages/collection/src/index.ts';
const base = 'http://127.0.0.1:4280';
const output = resolve('artifacts/collection-listing-20261010');
const entries = new Map();
const counts = { detail: 0, raw: 0, imageRequests: 0 };
async function get(path) { const response = await fetch(`${base}${path}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); return { status: 'ok', raw: await response.json() }; }
const service = new CollectionService({ sourceId: 'bill-source-board', cacheDir: join(output, 'source-images'), store: { get: (c, id) => entries.get(`${c}/${id}`), put: (c, id, value) => (entries.set(`${c}/${id}`, value), value) }, client: {
  searchCollectedItems: () => get('/api/items'),
  getCollectedItemDetail: id => { counts.detail++; return get(`/api/items/${encodeURIComponent(id)}`); },
  getCollectedItem: id => { counts.raw++; return get(`/api/items/${encodeURIComponent(id)}/raw?full=1`); },
} });
const ids = ['bf389170-bc70-4db3-9847-05d9ea2957d5', '55e1c06a-b01c-45df-80a3-2df0e574d0ca'];
const products = [], summary = [];
for (const id of ids) {
  const product = await service.getProduct(id); products.push(product);
  const skuRows = [];
  for (const sku of product.skus) {
    const image = sku.imageRef ? await service.resourceRead({ id, kind: 'image', assetId: sku.imageRef }) : null;
    if (image) counts.imageRequests++;
    skuRows.push({ id: sku.id, spec: sku.spec, attributes: sku.attributes, purchaseCost: sku.purchaseCost, package: sku.package, image });
  }
  const mainImages = [];
  for (const asset of product.assets.filter(a => a.roles.includes('main')).slice(0, 2)) {
    mainImages.push(await service.resourceRead({ id, kind: 'image', assetId: asset.id })); counts.imageRequests++;
  }
  summary.push({ id, title: product.title, source: product.source, revision: product.revision, package: product.package, skus: skuRows, mainImages });
}
await mkdir(output, { recursive: true });
const metadata = { purpose: 'development_preparation_not_formal_agent_acceptance', capturedAt: new Date().toISOString(), provider: 'current_collection_via_new_CollectionService', counts };
await writeFile(join(output, 'source-products.json'), JSON.stringify({ ...metadata, products }, null, 2));
await writeFile(join(output, 'source-prep-summary.json'), JSON.stringify({ ...metadata, products: summary }, null, 2));
console.log(JSON.stringify({ output, ...metadata, products: summary.map(p => ({ id: p.id, skuCount: p.skus.length, skuImages: p.skus.filter(s => s.image).length, mainImages: p.mainImages.length })) }, null, 2));
