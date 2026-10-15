// Explicit, read-only current-provider regression over the immutable 20/20/1 corpus.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CollectionService, COLLECTION_RESPONSE_MAX_BYTES } from '../../packages/collection/src/index.ts';
import { realCorpus, realCorpusPath } from '../real-data/corpus.ts';

export const digest = value => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');
const byteSize = value => Buffer.byteLength(JSON.stringify(value));
const sourceCounts = rows => rows.reduce((counts, row) => ({ ...counts, [row.source]: (counts[row.source] ?? 0) + 1 }), {});
const argument = name => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]; };

export async function createLiveContext(name) {
  const corpus = realCorpus();
  const base = (argument('--base') ?? process.argv.slice(2).find(value => /^https?:\/\//.test(value)) ?? process.env.DSH_REAL_PROVIDER ?? 'http://127.0.0.1:4280').replace(/\/$/, '');
  const output = resolve(argument('--output') ?? dirname(realCorpusPath));
  const responsesDir = join(output, `live-${name}-responses`);
  await mkdir(responsesDir, { recursive: true });
  const ids = corpus.records.map(row => row.detail.id), selected = new Set(ids), entries = new Map(), current = new Map();
  const counts = { list: 0, detail: 0, raw: 0 }, httpResponses = [];
  const result = { at: new Date().toISOString(), readOnly: true, platformWrites: 0, provider: base, corpusCapturedAt: corpus.capturedAt, corpusFile: realCorpusPath, selectedIds: ids, expectedSources: { taobao_tmall: 20, alibaba_com: 20, pinduoduo: 1 }, counts, httpResponses, checks: [], issues: [] };
  async function get(route, kind, id = 'index') {
    counts[kind]++;
    const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(30_000) });
    const text = await response.text(), filename = join(responsesDir, `${httpResponses.length + 1}-${id}.${kind}.json`);
    await writeFile(filename, text);
    const provenance = { method: 'GET', url: `${base}${route}`, status: response.status, fetchedAt: new Date().toISOString(), responseFile: relative(output, filename), sha256: createHash('sha256').update(text).digest('hex') };
    httpResponses.push(provenance);
    if (!response.ok) throw new Error(`GET ${route}: HTTP ${response.status}`);
    const raw = JSON.parse(text);
    provenance.valueSha256 = digest(raw);
    if (id !== 'index') current.set(`${id}/${kind}`, raw);
    return { status: 'ok', raw };
  }
  const service = new CollectionService({ sourceId: `real-live-${name}`, cacheDir: join(output, `live-${name}-images`), store: { get: (collection, id) => entries.get(`${collection}/${id}`), put: (collection, id, value) => (entries.set(`${collection}/${id}`, value), value) }, client: {
    // Keep the test index scoped to the exact 41 IDs; preserve the complete HTTP response as evidence.
    searchCollectedItems: async () => { const response = await get('/api/items', 'list'); const rows = Array.isArray(response.raw) ? response.raw : response.raw.items; assert.ok(Array.isArray(rows)); result.providerCollectionCount = rows.length; const scoped = rows.filter(row => selected.has(row.id)); assert.equal(scoped.length, ids.length, 'A selected real product is missing from the current provider'); assert.deepEqual(sourceCounts(scoped), result.expectedSources); return { status: 'ok', raw: scoped }; },
    getCollectedItemDetail: id => get(`/api/items/${encodeURIComponent(id)}`, 'detail', id),
    getCollectedItem: id => get(`/api/items/${encodeURIComponent(id)}/raw?full=1`, 'raw', id),
  } });
  async function check(label, work, id) {
    try { const value = await work(); result.checks.push({ label, ...(id ? { id } : {}), status: 'passed' }); return value; }
    catch (error) { const issue = { label, ...(id ? { id } : {}), status: 'failed', code: error.code ?? error.name, message: error.message }; result.checks.push(issue); result.issues.push(issue); return undefined; }
  }
  async function save(extra = {}) {
    Object.assign(result, extra, { finishedAt: new Date().toISOString(), passed: !result.issues.length });
    const filename = join(output, `live-${name}.json`);
    await writeFile(filename, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ output: filename, passed: result.passed, products: ids.length, sources: result.expectedSources, checks: result.checks.length, issues: result.issues.length, providerReads: counts }, null, 2));
    if (!result.passed) process.exitCode = 1;
  }
  return { corpus, ids, service, result, current, output, check, save };
}

// Exhaust every continuation. Cursor loops and response-budget violations are failures.
export async function pages(read) {
  const result = [], seen = new Set();
  let cursor;
  do {
    const page = await read(cursor);
    assert.ok(byteSize(page) <= COLLECTION_RESPONSE_MAX_BYTES, 'Collection response exceeded its byte budget');
    result.push(page);
    cursor = page.nextCursor;
    if (cursor) { assert.ok(!seen.has(cursor), 'Collection pagination repeated a cursor'); seen.add(cursor); }
  } while (cursor);
  return result;
}

// Recursively expand JSON-pointer directories and large array elements, retaining real values.
export async function materializeSource(service, id, path = '/source', evidence = []) {
  let pageLimit = 7;
  const all = await pages(async cursor => { const response = await service.resourceRead({ id, kind: 'raw', path, cursor, limit: pageLimit }); if (typeof response.value === 'string') pageLimit = 1500; evidence.push(response); return response; });
  if (all[0].directory) {
    const value = {};
    for (const entry of all.flatMap(page => page.directory)) {
      const key = entry.keyPreview ? await materializeSource(service, id, entry.keyResource.path, evidence) : entry.key;
      value[key] = await materializeSource(service, id, entry.path, evidence);
    }
    return value;
  }
  if (typeof all[0].value === 'string') return all.map(page => page.value).join('');
  if (Array.isArray(all[0].value)) {
    const value = [];
    for (const entry of all.flatMap(page => page.value)) value.push(entry?.expand === true && entry.kind === 'raw' && entry.path ? await materializeSource(service, id, entry.path, evidence) : entry);
    return value;
  }
  return all[0].value;
}

function changedPaths(before, after, path = '', result = []) {
  if (digest(before) === digest(after)) return result;
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) changedPaths(before[key], after[key], `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, result);
  } else result.push(path || '/');
  return result;
}
export function snapshotComparison(record, detail, raw) {
  const compare = (snapshot, value) => ({ capturedSha256: digest(snapshot), currentSha256: digest(value), unchanged: digest(snapshot) === digest(value), changedPaths: changedPaths(snapshot, value) });
  return { detail: compare(record.detail, detail), raw: compare(record.raw, raw), interpretation: 'Current-provider differences are live drift evidence; the captured corpus is immutable.' };
}

async function main() {
  const ctx = await createLiveContext('benchmark'), { service, result, check } = ctx;
  result.searchPages = await check('exact41_search_full_pagination', async () => {
    const responses = await pages(cursor => service.search({ cursor, limit: 7, refresh: !cursor }));
    assert.equal(responses.flatMap(page => page.items).length, 41);
    assert.deepEqual(new Set(responses.flatMap(page => page.items).map(row => row.id)), new Set(ctx.ids));
    return responses;
  });
  result.readings = [];
  for (const record of ctx.corpus.records) {
    const id = record.detail.id;
    await check('fresh_detail_sku_description_image_and_original_pagination', async () => {
      // Explicit refresh prevents cached detail generations from hiding live drift.
      const detail = await service.getLegacyDetail(id, { refresh: true }), product = await service.getProduct(id);
      const skuPages = [], seen = new Set();
      let cursor;
      do {
        const response = await service.read({ id, cursor, revision: product.revision, limit: 7 });
        assert.ok(byteSize(response) <= COLLECTION_RESPONSE_MAX_BYTES);
        skuPages.push(response.items[0]);
        cursor = response.items[0].skus.nextCursor;
        if (cursor) { assert.ok(!seen.has(cursor)); seen.add(cursor); }
      } while (cursor);
      assert.ok(skuPages.every(page => !page.omitted), 'Real product could not be projected as SKU pages');
      assert.deepEqual(skuPages.flatMap(page => page.skus.rows.map(row => row[0])), product.skus.map(sku => sku.id));
      const descriptions = await pages(cursor => service.resourceRead({ id, kind: 'description', cursor, revision: product.revision, limit: 53 }));
      assert.equal(descriptions.map(page => page.text).join(''), product.description);
      const images = await pages(cursor => service.resourceRead({ id, kind: 'images', cursor, revision: product.revision, limit: 7 }));
      assert.deepEqual(images.flatMap(page => page.items), product.assets);
      const rawPages = [], original = await materializeSource(service, id, '/source', rawPages), raw = ctx.current.get(`${id}/raw`);
      assert.notEqual(raw.truncated, true, 'Provider original must be complete');
      assert.deepEqual(original, typeof raw.content === 'string' ? JSON.parse(raw.content) : raw);
      result.readings.push({ id, source: product.source, features: record.sampling.features, skuCount: product.skus.length, mainImages: product.assets.filter(asset => asset.roles.includes('main')).length, skuImages: product.assets.filter(asset => asset.roles.includes('sku')).length, beforeBytes: byteSize(detail), afterBytes: byteSize(skuPages), attributes: Object.keys(product.attributes).length, package: product.package, specificWeights: product.skus.map(sku => sku.package?.weightGrams ?? null), customsCodes: product.customsCodes, unit: product.unit, comparison: snapshotComparison(record, detail, raw), skuPages, descriptionPages: descriptions, imagePages: images, originalPages: rawPages });
    }, id);
    if (result.readings.length % 10 === 0) console.log(`Checked ${result.readings.length}/41 current real products`);
  }
  await check('exact41_batch_read_continuation', async () => {
    const responses = [], seen = new Set();
    let input = { ids: ctx.ids, limit: 7 };
    do {
      const response = await service.read(input);
      assert.ok(byteSize(response) <= COLLECTION_RESPONSE_MAX_BYTES);
      responses.push(response);
      input = response.continuation?.input;
      if (input) { assert.ok(!seen.has(input.cursor)); seen.add(input.cursor); }
    } while (input);
    assert.deepEqual(responses.flatMap(page => page.items.map(item => item.id)), ctx.ids);
    result.batchPages = responses;
  });
  await ctx.save({ tokenMeasurement: 'UTF-8 byte comparison only; tokens not measured' });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
