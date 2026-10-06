/** Synthetic Source contracts only. Never invokes a real Hallmark or Seller API server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HallmarkClient } from '../../packages/hallmark-adapter/index.ts';
import type { ArchiveProductsRaw, CategoryDataInput, HallmarkClientOptions, SubmitArchiveProductsInput } from '../../packages/hallmark-adapter/index.ts';

const storeId = 'synthetic-shop-a';
const pair = { descriptionCategoryId: '123', typeId: '456' };
const archive: SubmitArchiveProductsInput = { requestId: 'synthetic-archive-001', selected: [{ storeId, offerId: 'synthetic-offer-a' }] };
const archivePath = '/api/store-products/archive';
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
function mock(responder: (url: URL, init: RequestInit) => Response | Promise<Response>, options: HallmarkClientOptions = {}) {
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const client = new HallmarkClient({ operatorToken: 'synthetic-original-token', ...options, fetchImpl: (async (url, init = {}) => {
    const parsed = new URL(String(url)); requests.push({ url: parsed, init });
    return parsed.pathname === '/api/health' ? json({ service: 'hallmark-control' }) : await responder(parsed, init);
  }) as typeof fetch });
  return { client, requests, submits: () => requests.filter(r => r.url.pathname === archivePath && r.init.method === 'POST') };
}
const archived = (selection = archive): ArchiveProductsRaw => ({ requestId: selection.requestId,
  results: selection.selected.map(row => ({ ...row, state: 'archived' })), additive: { retained: true } });

for (const [input, path, expected, body] of [
  [{ mode: 'search', storeId, q: '  合成 & 颜色  ', aspects: [' 颜色 ', '尺寸'], requireAspects: true, limit: 7 }, '/api/catalog/search', { storeId, q: '合成 & 颜色', aspects: '颜色,尺寸', requireAspects: 'true', limit: '7' }],
  [{ mode: 'show', storeId, ...pair }, '/api/catalog/show', { storeId, categoryKey: '123:456' }],
  [{ mode: 'template', storeId, ...pair }, '/api/catalog/categories/123/types/456/template', { storeId }],
  [{ mode: 'values', storeId, ...pair, attributeId: '789', q: '  蓝色  ', limit: 17 }, '/api/catalog/categories/123/types/456/attributes/789/values', { storeId, q: '蓝色', limit: '17' }],
  [{ mode: 'validate_value', storeId, ...pair, attributeId: '789', valueId: '11', dictionaryId: '22' }, '/api/catalog/categories/123/types/456/attributes/789/values/11/validation', { storeId, dictionaryId: '22' }],
  [{ mode: 'sync', storeId }, '/api/catalog/sync', {}, { storeId }],
] as const) test(`category ${input.mode} uses exact Source route and parameters without Task or operator token`, async () => {
  const raw = { sourceMode: input.mode, stale: true, complete: false, additive: { preserved: true } };
  let tokenReads = 0;
  const { client, requests } = mock((url, init) => {
    assert.equal(url.pathname, path); assert.deepEqual(Object.fromEntries(url.searchParams), expected);
    assert.equal(init.method, input.mode === 'sync' ? 'POST' : 'GET');
    assert.equal(init.body, input.mode === 'sync' ? JSON.stringify(body) : undefined);
    assert.equal(new Headers(init.headers).get('Authorization'), null);
    return json(raw);
  }, { operatorToken: () => { tokenReads++; throw Error('category reads do not access operator token'); } });
  const result = await client.getCategoryData(input as unknown as CategoryDataInput);
  assert.equal(result.status, 'ok'); assert.deepEqual(result.raw, raw); assert.equal(tokenReads, 0);
  assert.equal(result.provenance?.storeId, storeId); assert.equal(result.provenance?.dataTime, undefined);
  assert.ok(requests.every(r => !r.url.pathname.includes('/tasks') && r.init.redirect === 'error'));
});

test('bounded Source defaults are explicit, booleans canonical and 200 Unicode characters counted as code points', async () => {
  const { client } = mock(url => {
    if (url.pathname === '/api/catalog/search') {
      assert.equal(url.searchParams.get('limit'), '10'); assert.equal(url.searchParams.get('requireAspects'), 'false');
      assert.equal(url.searchParams.get('q'), '😀'.repeat(200));
    } else { assert.equal(url.searchParams.get('limit'), '50'); assert.equal(url.searchParams.has('q'), false); }
    return json({ additive: true });
  });
  assert.equal((await client.getCategoryData({ mode: 'search', storeId, q: '😀'.repeat(200) })).status, 'ok');
  assert.equal((await client.getCategoryData({ mode: 'values', storeId, ...pair, attributeId: '789' })).status, 'ok');
});

test('category missing/extra/unsafe/wildcard/unbounded/ill-typed fields fail before any HTTP', async () => {
  const search = { mode: 'search', storeId, q: '合成' };
  const values = { mode: 'values', storeId, ...pair, attributeId: '789' };
  const invalid: unknown[] = [null, {}, { ...search, storeId: undefined }, { ...search, storeId: '' }, { ...search, storeId: '../shop' },
    { ...search, storeId: `${storeId}&other=true` }, { ...search, mode: 'write' }, { ...search, mode: '__proto__' },
    { ...search, q: '' }, { ...search, q: ' * ' }, { ...search, q: '😀'.repeat(201) }, { ...search, q: 1 },
    ...[0, 21, 100000, 1.5, '10', Infinity].map(limit => ({ ...search, limit })),
    ...['true', 1, {}, null].map(requireAspects => ({ ...search, requireAspects })),
    { ...search, requireAspects: true }, { ...search, requireAspects: true, aspects: [] },
    ...['颜色', [''], ['a,a'], ['a', ' a '], [1], Array.from({ length: 11 }, (_, i) => `aspect-${i}`)].map(aspects => ({ ...search, aspects })),
    { ...search, path: '/v3/product/import' }, { ...search, body: { write: true } }, { mode: 'sync', storeId, selected: ['all'] },
    { mode: 'show', storeId, categoryKey: '123:456' }, { mode: 'template', storeId, descriptionCategoryId: '123' },
    ...['0', '-1', '01', '1/../../archive', '9007199254740992', 123].map(descriptionCategoryId => ({ mode: 'template', storeId, ...pair, descriptionCategoryId })),
    { ...values, q: 'a' }, { ...values, q: '*' }, { ...values, limit: 101 }, { ...values, limit: '50' },
    { mode: 'validate_value', storeId, ...pair, attributeId: '789', valueId: '11' },
    { mode: 'validate_value', storeId, ...pair, attributeId: '789', valueId: '11', dictionaryId: '-1' },
  ];
  for (const value of invalid) {
    const { client, requests } = mock(() => assert.fail('invalid category cannot fetch'));
    assert.equal((await client.getCategoryData(value as CategoryDataInput)).error?.code, 'CATALOG_INPUT_INVALID');
    assert.equal(requests.length, 0);
  }
});

test('category Source partial/unknown/stale/candidate flags remain raw, never converted to allowed values', async () => {
  const raw = { ...pair, categoryKey: '123:456', attributeId: '789', dictionaryId: '22', values: [], complete: false, stale: true,
    fetchedAt: '2026-01-01T00:00:00.000Z', search: { candidates: [{ id: '11', value: '合成未验证候选' }], validation: 'unavailable',
      fallbackReason: { stage: 'validation', code: 'SOURCE_UNAVAILABLE' } }, capabilityStatus: 'partial', aspectMatch: 'unknown', future: true };
  const { client } = mock(() => json(raw), { now: () => new Date('2026-02-01T00:00:00Z') });
  const result = await client.getCategoryData({ mode: 'values', storeId, ...pair, attributeId: '789', q: '合成' });
  assert.deepEqual(result.raw, raw); assert.equal(result.provenance?.dataTime, raw.fetchedAt);
  assert.equal(result.provenance?.fetchedAt, '2026-02-01T00:00:00.000Z'); assert.deepEqual(result.raw?.values, []);
  assert.equal(result.raw?.complete, false); assert.equal(Object.hasOwn(result.raw ?? {}, 'verified'), false);
});

test('category Source treeFetchedAt is source time, absent source time never becomes adapter now', async () => {
  for (const raw of [{ treeFetchedAt: '2026-01-01T00:00:00Z', treeStale: true, results: [] }, { treeStale: true, results: [] }]) {
    const { client } = mock(() => json(raw)); const result = await client.getCategoryData({ mode: 'search', storeId, q: '合成' });
    assert.equal(result.provenance?.dataTime, raw.treeFetchedAt); assert.deepEqual(result.raw, raw);
  }
});

test('category errors, bounded local read retry and wrong store response do not invent verified capabilities', async () => {
  let attempts = 0; const delays: number[] = [];
  const { client } = mock(() => ++attempts === 1 ? json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 25 }, 429) : json({ storeId, results: [], treeStale: true }), { sleep: async ms => { delays.push(ms); } });
  assert.equal((await client.getCategoryData({ mode: 'search', storeId, q: '合成' })).status, 'ok');
  assert.equal(attempts, 2); assert.deepEqual(delays, [25]);
  const raw = { storeId: 'synthetic-other', results: [] };
  const wrong = mock(() => json(raw)); const result = await wrong.client.getCategoryData({ mode: 'search', storeId, q: '合成' });
  assert.equal(result.error?.code, 'CATALOG_IDENTITY_MISMATCH'); assert.deepEqual(result.raw, raw);
  const failure = mock(() => json({ code: 'CATALOG_READ_FAILED', error: 'synthetic' }, 503));
  assert.equal((await failure.client.getCategoryData({ mode: 'sync', storeId })).status, 'unavailable');
});

test('archive exact explicit original-token body sends once, Source archived result remains untouched', async () => {
  const raw = archived();
  const { client, requests, submits } = mock((url, init) => {
    assert.equal(url.pathname, archivePath); assert.equal(url.search, ''); assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(String(init.body)), archive); assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer synthetic-original-token');
    return json(raw);
  });
  const result = await client.submitArchiveProducts(archive);
  assert.equal(result.status, 'ok'); assert.equal(result.stage, 'archived'); assert.deepEqual(result.raw, raw);
  assert.equal(result.raw?.stage, undefined); assert.equal(result.provenance?.dataTime, undefined); assert.equal(result.provenance?.storeId, undefined);
  assert.equal(submits().length, 1); assert.ok(requests.every(r => !r.url.pathname.includes('/tasks')));
});

test('archive rejects implicit/oversized/duplicate/extra scope and underscore request IDs before HTTP', async () => {
  const invalid: unknown[] = [null, {}, { ...archive, requestId: '' }, { ...archive, requestId: 'bad_underscore' }, { ...archive, requestId: 'a'.repeat(81) },
    { ...archive, selected: [] }, { ...archive, storeId }, { ...archive, path: '/v2/products/delete' },
    { ...archive, selected: [archive.selected[0], archive.selected[0]] },
    { ...archive, selected: [{ storeId: '../shop', offerId: 'offer' }] }, { ...archive, selected: [{ storeId, offerId: ' ' }] },
    { ...archive, selected: [{ storeId, offerId: ' offer ' }] }, { ...archive, selected: [{ storeId, offerId: 'offer', productId: 1 }] },
    { ...archive, selected: Array.from({ length: 201 }, (_, i) => ({ storeId, offerId: `synthetic-${i}` })) },
    { ...archive, selected: Array.from({ length: 200 }, (_, i) => ({ storeId, offerId: `${i}${'汉'.repeat(3990)}` })) },
  ];
  for (const input of invalid) {
    const { client, requests } = mock(() => assert.fail('invalid archive cannot fetch'));
    assert.equal((await client.submitArchiveProducts(input as SubmitArchiveProductsInput)).error?.code, 'ARCHIVE_INPUT_INVALID'); assert.equal(requests.length, 0);
  }
});

test('archive does not use App key or credential-file fallback when original operator token absent', async () => {
  const { client, submits } = mock(() => assert.fail('missing Source token cannot submit'), { operatorToken: () => undefined,
    ...{ appKey: 'synthetic-not-original-token' } } as HallmarkClientOptions);
  assert.equal((await client.submitArchiveProducts(archive)).error?.code, 'HUMAN_AUTH_REQUIRED'); assert.equal(submits().length, 0);
});

for (const [code, status] of [['INVALID_ARCHIVE', 400], ['HUMAN_AUTH_REQUIRED', 401], ['HUMAN_AUTH_INVALID', 403], ['ARCHIVE_BUSY', 409], ['SYNC_BUSY', 409], ['REQUEST_TOO_LARGE', 413]] as const) test(`archive explicit ${code} pre-dispatch refusal preserved`, async () => {
  const raw = { code, error: 'synthetic refusal' }; const { client, submits } = mock(() => json(raw, status));
  const result = await client.submitArchiveProducts(archive);
  assert.equal(result.status, 'failed'); assert.equal(result.error?.retryable, false); assert.deepEqual(result.raw, raw); assert.equal(submits().length, 1);
});

test('archive HTTP400 ARCHIVE_FAILED may follow platform write; it must remain unknown and never rePOST as get', async () => {
  const raw = { code: 'ARCHIVE_FAILED', error: 'synthetic FINISHED/save error after dispatch' }; const { client, requests, submits } = mock(() => json(raw, 400));
  const first = await client.submitArchiveProducts(archive); const second = await client.submitArchiveProducts(archive);
  assert.equal(first.status, 'unknown'); assert.equal(first.stage, 'unknown'); assert.equal(first.error?.retryable, false);
  assert.deepEqual(first.raw, raw); assert.deepEqual(second, first); assert.equal(submits().length, 1);
  assert.ok(requests.every(r => r.url.pathname === '/api/health' || r.url.pathname === archivePath));
  assert.equal('getArchiveProducts' in client, false); assert.equal('getArchiveOperation' in client, false);
});

for (const status of [408, 500, 503]) test(`archive HTTP${status} transport ambiguity is unknown, no retry`, async () => {
  const raw = { error: 'synthetic uncertain error' }; const { client, submits } = mock(() => json(raw, status));
  const result = await client.submitArchiveProducts(archive);
  assert.equal(result.status, 'unknown'); assert.equal(result.stage, 'unknown'); assert.deepEqual(result.raw, raw);
  await client.submitArchiveProducts(archive); assert.equal(submits().length, 1);
});

test('archive network timeout/partial response/429 do not retry, generate IDs or turn into readback', async () => {
  for (const responder of [() => { throw Error('synthetic network loss'); }, () => new Response('partial{'), () => json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 25 }, 429)]) {
    const sleeps: number[] = []; const { client, submits } = mock(responder, { sleep: async ms => { sleeps.push(ms); } });
    const result = await client.submitArchiveProducts(archive); assert.notEqual(result.status, 'ok'); assert.equal(result.error?.retryable, false);
    await client.submitArchiveProducts(archive); assert.equal(submits().length, 1); assert.equal(sleeps.length, 0);
  }
  const timed = mock(async (_url, init) => await new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Error('synthetic timeout')), { once: true })), { platformTimeoutMs: 15 });
  assert.equal((await timed.client.submitArchiveProducts(archive)).stage, 'unknown'); assert.equal(timed.submits().length, 1);
});

test('archive result:true is only acceptance; Source pending/unknown/rejected/mixed states remain explicit', async () => {
  for (const [state, stage, status] of [['pending', 'pending', 'unknown'], ['unknown', 'unknown', 'unknown'], ['rejected', 'rejected', 'failed']] as const) {
    const raw: ArchiveProductsRaw = { requestId: archive.requestId, results: [{ ...archive.selected[0], state }] };
    const { client } = mock(() => json(raw)); const result = await client.submitArchiveProducts(archive);
    assert.equal(result.stage, stage); assert.equal(result.status, status); assert.deepEqual(result.raw, raw);
  }
  const accepted = mock(() => json({ result: true })); assert.equal((await accepted.client.submitArchiveProducts(archive)).stage, 'unknown');
  const selected = { ...archive, selected: [...archive.selected, { storeId, offerId: 'synthetic-offer-b' }] };
  const mixed = archived(selected); mixed.results[1].state = 'unknown';
  const source = mock(() => json(mixed)); const result = await source.client.submitArchiveProducts(selected);
  assert.equal(result.stage, 'mixed'); assert.equal(result.status, 'unknown'); assert.deepEqual(result.raw, mixed);
});

test('archive exact pair matching supports Source store-group result reordering but no extra/missing/mismatched rows', async () => {
  const selected: SubmitArchiveProductsInput = { ...archive, selected: [archive.selected[0], { storeId: 'synthetic-shop-b', offerId: 'same-offer' }, { storeId, offerId: 'same-offer' }] };
  const raw = archived(selected); raw.results = [raw.results[2], raw.results[0], raw.results[1]];
  const reordered = mock(() => json(raw)); assert.equal((await reordered.client.submitArchiveProducts(selected)).stage, 'archived');
  for (const mutate of [(r: ArchiveProductsRaw) => { r.requestId = 'other-request'; }, (r: ArchiveProductsRaw) => { r.results.pop(); },
    (r: ArchiveProductsRaw) => { r.results[0].storeId = 'synthetic-other'; }, (r: ArchiveProductsRaw) => { r.results[0].state = 'accepted' as 'archived'; },
    (r: ArchiveProductsRaw) => { r.results[1] = structuredClone(r.results[0]); }]) {
    const wrong = structuredClone(raw); mutate(wrong); const instance = mock(() => json(wrong));
    const result = await instance.client.submitArchiveProducts(selected); assert.equal(result.stage, 'unknown'); assert.deepEqual(result.raw, wrong);
  }
});

test('archive global request ID single-flight caches uncertainty, forbids changed selection/order and isolates raw clones', async () => {
  const selected: SubmitArchiveProductsInput = { ...archive, selected: [...archive.selected, { storeId: 'synthetic-shop-b', offerId: 'synthetic-offer-b' }] };
  const raw = archived(selected); const { client, submits } = mock(() => json(raw));
  const [one, two] = await Promise.all([client.submitArchiveProducts(selected), client.submitArchiveProducts(structuredClone(selected))]);
  assert.equal(submits().length, 1); assert.deepEqual(one, two); one.raw!.results[0].state = 'unknown';
  assert.equal((await client.submitArchiveProducts(selected)).raw?.results[0].state, 'archived');
  const changed = await client.submitArchiveProducts({ ...selected, selected: [...selected.selected].reverse() });
  assert.equal(changed.error?.code, 'ARCHIVE_REQUEST_ID_REUSED'); assert.equal(submits().length, 1);
});

test('category large Source raw spills without dropping search candidates or changing evidence fields', async () => {
  const prefix = join(tmpdir(), 'category-archive-'); const directory = await mkdtemp(prefix); assert.ok(directory.startsWith(prefix));
  try {
    const raw = { ...pair, values: [], complete: false, stale: true, fetchedAt: '2026-01-01T00:00:00Z', search: { candidates: [{ id: '11', value: '合成'.repeat(2000) }], validation: 'unavailable' } };
    const { client } = mock(() => json(raw), { spillThresholdBytes: 100, spillDirectory: directory });
    const result = await client.getCategoryData({ mode: 'values', storeId, ...pair, attributeId: '789' });
    assert.deepEqual(result.raw, raw); assert.ok(result.spill); assert.deepEqual(JSON.parse(await readFile(result.spill.path, 'utf8')), raw);
    assert.equal(result.provenance?.dataTime, raw.fetchedAt); assert.equal(result.raw?.complete, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
