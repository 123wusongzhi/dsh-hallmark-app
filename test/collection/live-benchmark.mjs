// Explicit, read-only local-provider check. Not part of the automatic test glob.
import { CollectionService } from '../../packages/collection/src/index.ts';
const base = process.argv[2] ?? 'http://127.0.0.1:4280';
const entries = new Map();
let detailCalls = 0, rawCalls = 0;
async function get(path) { const response = await fetch(`${base}${path}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); return { status: 'ok', raw: await response.json() }; }
const service = new CollectionService({ sourceId: 'live-readonly', store: { get: (c, id) => entries.get(`${c}/${id}`), put: (c, id, value) => (entries.set(`${c}/${id}`, value), value) }, client: {
  searchCollectedItems: () => get('/api/items'),
  getCollectedItemDetail: id => { detailCalls++; return get(`/api/items/${encodeURIComponent(id)}`); },
  getCollectedItem: id => { rawCalls++; return get(`/api/items/${encodeURIComponent(id)}/raw?full=1`); },
} });
const list = (await get('/api/items')).raw;
const sample = list.filter(r => r.title?.includes('FM07-12D')).slice(0, 1);
if (!sample.length) sample.push(list.find(r => r.id === '18998240-629d-41b7-a4e1-154fc997b237'));
sample.push(list.find(r => r.id === 'bf389170-bc70-4db3-9847-05d9ea2957d5'));
const readings = [];
for (const row of sample.filter(Boolean)) {
  const compact = await service.read({ id: row.id });
  const original = await service.getLegacyDetail(row.id);
  const full = await service.getProduct(row.id);
  readings.push({ id: row.id, source: row.source, skuCount: full.skus.length, beforeBytes: Buffer.byteLength(JSON.stringify(original)), afterBytes: Buffer.byteLength(JSON.stringify(compact)), attributes: Object.keys(full.attributes).length, commonWeightGrams: full.package.weightGrams, specificWeights: full.skus.map(s => s.package?.weightGrams ?? null), mainImages: full.assets.filter(a => a.roles.includes('main')).length, skuImages: full.assets.filter(a => a.roles.includes('sku')).length, customsCodes: full.customsCodes, unit: full.unit });
}
const first30 = await service.search();
const bill = await service.search({ query: 'bill' });
const oldBill = list.filter(row => JSON.stringify(row).toLocaleLowerCase().includes('bill'));
console.log(JSON.stringify({ at: new Date().toISOString(), collectionCount: list.length, readings, searchSame30: { legacyBytes: Buffer.byteLength(JSON.stringify(list.slice(0, 30))), newBytes: Buffer.byteLength(JSON.stringify(first30)), returned: first30.returned }, billSearch: { legacyCount: oldBill.length, factsOnlyCount: bill.total }, providerReads: { detailCalls, rawCalls }, tokenMeasurement: 'not measured; UTF-8 bytes only' }, null, 2));
