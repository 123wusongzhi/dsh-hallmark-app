/** Entirely synthetic Source HTTP fixtures. No original server, credentials, tasks or platform writes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HallmarkClient } from '../../packages/hallmark-adapter/index.ts';
import type { HallmarkClientOptions, OrdinaryCnyOperationRaw, SubmitOrdinaryCnyPriceInput } from '../../packages/hallmark-adapter/index.ts';

const id = '11111111-1111-4111-8111-111111111111';
const storeId = 'synthetic-shop-a';
const token = 'synthetic-original-operator-token';
const input: SubmitOrdinaryCnyPriceInput = { operationId: id, storeId, products: [{ productId: 123456789, offerId: 'synthetic-offer-a', price: '12.34' }] };
const submitPath = `/api/manual-promotions/operations?storeId=${storeId}`;
const getPath = `/api/manual-promotions/operations/${id}?storeId=${storeId}`;
const inspectPath = `/api/manual-promotions/operations/${id}/inspect?storeId=${storeId}`;
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers });
function receipt(status: 'pending' | 'finished' = 'finished', selection = input): OrdinaryCnyOperationRaw {
  const products = selection.products.map(p => ({ ...p, price: Number(p.price).toFixed(2), stock: '0' as const }));
  return { id: selection.operationId, storeId: selection.storeId, kind: 'ordinary', actionId: 0, products,
    title: '普通售价', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z',
    requestId: `human-promo-${selection.operationId}`, status, error: null,
    results: products.map(p => ({ ...p, status: status === 'finished' ? 'verified' as const : 'pending' as const,
      reason: '合成只读核实结果', actualMinor: status === 'finished' ? Math.round(Number(p.price) * 100) : null, sellerMinor: null })),
    unknownSourceField: { retained: true },
  };
}
function mock(responder: (path: string, init: RequestInit) => Response | Promise<Response>, options: HallmarkClientOptions = {}) {
  const requests: Array<{ path: string; init: RequestInit }> = [];
  const client = new HallmarkClient({ operatorToken: token, ...options, fetchImpl: (async (url, init = {}) => {
    const parsed = new URL(String(url)); const path = parsed.pathname + parsed.search;
    requests.push({ path, init });
    if (path === '/api/health') return json({ service: 'hallmark-control' });
    return responder(path, init);
  }) as typeof fetch });
  return { client, requests, submits: () => requests.filter(r => r.path === submitPath && r.init.method === 'POST') };
}

test('exact no-Task ordinary CNY HTTP, original bearer, user price preserved and Source raw untouched', async () => {
  const raw = receipt(); const selection = { ...input, products: [{ ...input.products[0], price: '00012.34' }] };
  const { client, requests, submits } = mock((path, init) => {
    assert.equal(path, submitPath); assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
    assert.deepEqual(JSON.parse(String(init.body)), { id, kind: 'ordinary', actionId: 0,
      products: [{ productId: 123456789, offerId: 'synthetic-offer-a', price: '00012.34', stock: '0' }] });
    return json(raw);
  });
  const result = await client.submitOrdinaryCnyPrice(selection);
  assert.equal(result.status, 'ok'); assert.equal(result.stage, 'verified'); assert.deepEqual(result.raw, raw);
  assert.equal(result.raw?.stage, undefined); assert.equal(result.raw?.state, undefined); assert.equal(result.raw?.outcome, undefined);
  assert.equal(result.provenance?.source, 'hallmark_snapshot'); assert.equal(result.provenance?.storeId, storeId);
  assert.equal(result.provenance?.endpoint, submitPath); assert.equal(result.provenance?.dataTime, undefined);
  assert.equal(submits().length, 1); assert.ok(requests.every(r => !r.path.includes('/tasks')));
  assert.ok(requests.every(r => r.init.redirect === 'error'));
});

test('strict explicit identity, safe integer IDs, price precision/scope and unsupported fields fail before any HTTP', async () => {
  const cases: unknown[] = [null, { ...input, storeId: '' }, { ...input, storeId: '../synthetic' }, { ...input, storeId: `${storeId}&storeId=other` },
    { ...input, operationId: 'new-random-id' }, { ...input, operationId: 'aaaaaaaa-aaaa-aaaa-aaaa-AAAAAAAAAAAA' },
    { ...input, products: [] }, { ...input, currency: 'RUB' }, { ...input, oldPrice: 20 }, { ...input, actionId: 1 },
    { ...input, products: [input.products[0], input.products[0]] },
    { ...input, products: [input.products[0], { ...input.products[0], productId: 2 }] },
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '123456789', NaN, Infinity].map(productId => ({ ...input, products: [{ ...input.products[0], productId }] })),
    ...['', ' ', ' synthetic-offer-a '].map(offerId => ({ ...input, products: [{ ...input.products[0], offerId }] })),
    ...['0', '-1', '1.234', '1e2', 'NaN', 'Infinity', '90071992547409.92', 12.34].map(price => ({ ...input, products: [{ ...input.products[0], price }] })),
    ...['stock', 'warehouseId', 'oldPrice', 'currency', 'actionId'].map(key => ({ ...input, products: [{ ...input.products[0], [key]: '0' }] })),
    { ...input, products: [{ ...input.products[0], offerId: '汉'.repeat(100000) }] },
    { ...input, products: Array.from({ length: 1001 }, (_, index) => ({ productId: index + 1, offerId: `synthetic-${index}`, price: '1.00' })) },
  ];
  for (const value of cases) {
    const { client, requests } = mock(() => assert.fail('invalid arguments cannot invoke Source'));
    const result = await client.submitOrdinaryCnyPrice(value as SubmitOrdinaryCnyPriceInput);
    assert.equal(result.error?.code, 'ORDINARY_PRICE_INPUT_INVALID'); assert.equal(requests.length, 0);
  }
});

test('only explicit original token or original-token environment supplies bearer; an App key never does', async () => {
  const { client, requests } = mock(() => assert.fail('must not invoke Source'), { operatorToken: () => undefined,
    ...{ appKey: 'synthetic-app-key-not-source-token' } } as HallmarkClientOptions);
  assert.equal((await client.submitOrdinaryCnyPrice(input)).error?.code, 'HUMAN_AUTH_REQUIRED');
  assert.equal((await client.getOrdinaryCnyOperation(storeId, id)).error?.code, 'HUMAN_AUTH_REQUIRED');
  assert.equal((await client.inspectOrdinaryCnyOperation(storeId, id)).error?.code, 'HUMAN_AUTH_REQUIRED');
  assert.ok(requests.every(r => r.path === '/api/health'));
  const previous = process.env.HALLMARK_OPERATOR_TOKEN;
  try {
    process.env.HALLMARK_OPERATOR_TOKEN = 'synthetic-explicit-env-original-token';
    const configured = mock((_path, init) => { assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer synthetic-explicit-env-original-token'); return json(receipt()); }, { operatorToken: undefined });
    assert.equal((await configured.client.submitOrdinaryCnyPrice(input)).status, 'ok');
  } finally { if (previous === undefined) delete process.env.HALLMARK_OPERATOR_TOKEN; else process.env.HALLMARK_OPERATOR_TOKEN = previous; }
});

test('health gate settles below two seconds without source submit and without unhandled rejection', async () => {
  let submits = 0;
  const client = new HallmarkClient({ operatorToken: token, healthTimeoutMs: 15, fetchImpl: (async (url, init) => {
    if (!String(url).endsWith('/api/health')) submits++;
    return await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Error('synthetic timeout')), { once: true }));
  }) as typeof fetch });
  const start = Date.now(); assert.equal((await client.submitOrdinaryCnyPrice(input)).status, 'unavailable');
  assert.ok(Date.now() - start < 2000); assert.equal(submits, 0);
});

for (const status of [400, 401, 403, 409, 413]) test(`Source HTTP ${status} refusal raw preserved, no retry`, async () => {
  const raw = { error: '合成准备/权限/格式拒绝', additive: { retained: true } };
  const { client, submits } = mock(() => json(raw, status));
  const result = await client.submitOrdinaryCnyPrice(input);
  assert.equal(result.status, 'failed'); assert.equal(result.error?.retryable, false); assert.deepEqual(result.raw, raw);
  assert.equal(submits().length, 1); assert.equal(result.provenance?.storeId, storeId);
});

for (const status of [408, 500, 502, 503]) test(`Source HTTP ${status} submit stays unknown and same UUID never sends again`, async () => {
  const raw = { error: '合成可能在发平台之后的错误' };
  const { client, submits } = mock(() => json(raw, status));
  const first = await client.submitOrdinaryCnyPrice(input); const second = await client.submitOrdinaryCnyPrice(input);
  assert.equal(first.status, 'unknown'); assert.equal(first.stage, 'outcome_unknown'); assert.equal(first.error?.retryable, false);
  assert.deepEqual(first.raw, raw); assert.deepEqual(second, first); assert.equal(submits().length, 1);
});

test('write 429/LOCAL_RATE_LIMIT retains hint but never sleeps or retries; GET may retry a bounded local read', async () => {
  const delays: number[] = [];
  const limited = mock(() => json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 25 }, 429), { sleep: async ms => { delays.push(ms); } });
  const result = await limited.client.submitOrdinaryCnyPrice(input);
  assert.equal(result.status, 'unavailable'); assert.equal(result.error?.retryable, false); assert.equal(result.error?.retryAfterMs, 25);
  assert.equal(limited.submits().length, 1); assert.equal(delays.length, 0);
  let attempts = 0;
  const reader = mock(path => { assert.equal(path, getPath); return ++attempts === 1 ? json({ code: 'LOCAL_RATE_LIMIT', retryAfterMs: 25 }, 429) : json(receipt()); }, { sleep: async ms => { delays.push(ms); } });
  assert.equal((await reader.client.getOrdinaryCnyOperation(storeId, id)).stage, 'verified');
  assert.equal(attempts, 2); assert.deepEqual(delays, [25]); assert.equal(reader.submits().length, 0);
});

test('network/incomplete submit receipt remains unknown, no automatic retry or new UUID', async () => {
  for (const responder of [() => { throw Error('synthetic disconnect after receive'); }, () => new Response('partial{"id":')]) {
    const { client, submits } = mock(responder);
    const result = await client.submitOrdinaryCnyPrice(input);
    assert.equal(result.status, 'unknown'); assert.equal(result.stage, 'outcome_unknown'); assert.equal(result.error?.retryable, false);
    await client.submitOrdinaryCnyPrice(input); assert.equal(submits().length, 1);
  }
});

test('submit timeout during Source preparation, then GET404, never re-submit or inspect guessed operation', async () => {
  let available = false;
  const { client, requests, submits } = mock(async (path, init) => {
    if (path === submitPath) return await new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Error('synthetic Source preparation timeout')), { once: true });
    });
    assert.equal(path, getPath); assert.equal(init.method, 'GET');
    return available ? json(receipt('pending')) : json({ error: '合成操作尚未落盘，准备仍可能继续' }, 404);
  }, { platformTimeoutMs: 15 });
  assert.equal((await client.submitOrdinaryCnyPrice(input)).stage, 'outcome_unknown');
  const absent = await client.getOrdinaryCnyOperation(storeId, id);
  assert.equal(absent.status, 'unknown'); assert.equal(absent.stage, 'not_found'); assert.equal(absent.error?.retryable, false);
  assert.equal((await client.inspectOrdinaryCnyOperation(storeId, id)).stage, 'not_found');
  await client.submitOrdinaryCnyPrice(input);
  assert.equal(submits().length, 1); assert.ok(requests.every(r => !r.path.includes('/inspect')));
  available = true;
  assert.equal((await client.getOrdinaryCnyOperation(storeId, id)).stage, 'pending'); assert.equal(submits().length, 1);
});

test('concurrent same-ID submit is single-flight; changed contents same-ID blocked and returned raw is isolated', async () => {
  const { client, submits } = mock(async () => json(receipt()));
  const results = await Promise.all([client.submitOrdinaryCnyPrice(input), client.submitOrdinaryCnyPrice(structuredClone(input))]);
  assert.equal(submits().length, 1); assert.deepEqual(results[0], results[1]);
  results[0].raw!.products[0].price = '99.99';
  assert.equal((await client.submitOrdinaryCnyPrice(input)).raw?.products[0].price, '12.34');
  const changed = await client.submitOrdinaryCnyPrice({ ...input, products: [{ ...input.products[0], price: '99.99' }] });
  assert.equal(changed.error?.code, 'ORDINARY_PRICE_OPERATION_ID_REUSED'); assert.equal(submits().length, 1);
});

test('a new client restart keeps caller UUID/body exactly; caller must persist unknown before any explicit resubmission', async () => {
  const bodies: string[] = [];
  for (let restart = 0; restart < 2; restart++) {
    const instance = mock((_path, init) => { bodies.push(String(init.body)); return json(receipt()); });
    await instance.client.submitOrdinaryCnyPrice(structuredClone(input));
    assert.equal(instance.submits().length, 1);
  }
  assert.equal(bodies[0], bodies[1]); assert.equal(JSON.parse(bodies[0]).id, id);
});

test('get only reads; explicit inspect confirms pending with GET first, then proved readonly POST and stage-only normalization', async () => {
  const pending = receipt('pending'), verified = receipt();
  const { client, requests, submits } = mock((path, init) => {
    assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
    if (path === getPath) { assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); return json(pending); }
    assert.equal(path, inspectPath); assert.equal(init.method, 'POST'); assert.equal(init.body, '{}'); return json(verified);
  });
  const before = await client.getOrdinaryCnyOperation(storeId, id);
  assert.equal(before.status, 'unknown'); assert.equal(before.stage, 'pending'); assert.deepEqual(before.raw, pending);
  assert.equal(requests.filter(r => r.path === inspectPath).length, 0);
  const result = await client.inspectOrdinaryCnyOperation(storeId, id);
  assert.equal(result.status, 'ok'); assert.equal(result.stage, 'verified'); assert.deepEqual(result.raw, verified);
  assert.equal(result.provenance?.endpoint, inspectPath); assert.equal(result.provenance?.dataTime, undefined);
  assert.equal(submits().length, 0); assert.equal(requests.filter(r => r.path === inspectPath).length, 1);
});

test('inspect never runs on absent, malformed or already-finished records, or on arbitrary invalid route identifiers', async () => {
  for (const response of [json(receipt()), json({ error: 'not recorded' }, 404), json({ ...receipt('pending'), kind: 'enroll' })]) {
    const { client, requests } = mock(path => { assert.equal(path, getPath); return response; });
    await client.inspectOrdinaryCnyOperation(storeId, id); assert.ok(requests.every(r => !r.path.includes('/inspect')));
  }
  const { client, requests } = mock(() => assert.fail('invalid identifiers must not fetch'));
  for (const [shop, operation] of [['../shop', id], [storeId, '../operation'], ['', id]]) {
    assert.equal((await client.getOrdinaryCnyOperation(shop, operation)).error?.code, 'ORDINARY_PRICE_INPUT_INVALID');
    assert.equal((await client.inspectOrdinaryCnyOperation(shop, operation)).error?.code, 'ORDINARY_PRICE_INPUT_INVALID');
  }
  assert.equal(requests.length, 0);
});

test('fresh Source inspect 5xx remains outcome_unknown and preserves original error body, not fabricated raw stage', async () => {
  const raw = { error: '合成平台只读查询失败', additive: true };
  const { client, submits } = mock(path => path === getPath ? json(receipt('pending')) : json(raw, 503));
  const result = await client.inspectOrdinaryCnyOperation(storeId, id);
  assert.equal(result.status, 'unknown'); assert.equal(result.stage, 'outcome_unknown'); assert.deepEqual(result.raw, raw);
  assert.equal(result.error?.retryable, false); assert.equal(submits().length, 0);
});

test('finished is not success: all-rejected and mixed preserve exact per-product Source results', async () => {
  const rejected = receipt(); rejected.results[0].status = 'rejected'; rejected.results[0].actualMinor = 1000;
  const first = mock(() => json(rejected));
  const result = await first.client.getOrdinaryCnyOperation(storeId, id);
  assert.equal(result.status, 'failed'); assert.equal(result.stage, 'rejected'); assert.deepEqual(result.raw, rejected);
  const selection = { ...input, products: [...input.products, { productId: 234567891, offerId: 'synthetic-offer-b', price: '23.45' }] };
  const mixed = receipt('finished', selection); mixed.results[1].status = 'rejected'; mixed.results[1].actualMinor = null;
  const second = mock(() => json(mixed)); const partial = await second.client.submitOrdinaryCnyPrice(selection);
  assert.equal(partial.status, 'failed'); assert.equal(partial.stage, 'mixed'); assert.deepEqual(partial.raw, mixed);
});

test('wrong identity, target, CNY contract shape or readback amount never become verified', async () => {
  const source = receipt();
  const mutations: Array<(raw: OrdinaryCnyOperationRaw) => void> = [
    raw => { raw.storeId = 'synthetic-other-store'; }, raw => { raw.id = '22222222-2222-4222-8222-222222222222'; },
    raw => { raw.kind = 'update' as 'ordinary'; }, raw => { raw.actionId = 1 as 0; }, raw => { raw.requestId = 'synthetic-different-source-request'; },
    raw => { raw.results = []; }, raw => { raw.results[0].actualMinor = 999; }, raw => { raw.results[0].actualMinor = null; },
    raw => { raw.results[0].status = 'pending'; }, raw => { raw.results[0].offerId = 'synthetic-other-offer'; },
    raw => { raw.products[0].stock = '7' as '0'; }, raw => { raw.results[0].stock = '7' as '0'; },
    raw => { raw.products[0].price = '99.99'; raw.results[0].price = '99.99'; raw.results[0].actualMinor = 9999; },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(source); mutate(raw);
    const { client } = mock(() => json(raw)); const result = await client.submitOrdinaryCnyPrice(input);
    assert.equal(result.status, 'unknown'); assert.equal(result.stage, 'outcome_unknown'); assert.deepEqual(result.raw, raw);
  }
});

test('large Source raw spills losslessly; unknown/additive fields and historical times are never projected away', async () => {
  const prefix = join(tmpdir(), 'ordinary-contract-'); const directory = await mkdtemp(prefix);
  assert.ok(directory.startsWith(prefix));
  try {
    const raw = { ...receipt(), largeFutureField: '合成'.repeat(2000) };
    const { client } = mock(() => json(raw), { spillThresholdBytes: 100, spillDirectory: directory });
    const result = await client.getOrdinaryCnyOperation(storeId, id);
    assert.equal(result.stage, 'verified'); assert.deepEqual(result.raw, raw); assert.ok(result.spill);
    assert.deepEqual(JSON.parse(await readFile(result.spill.path, 'utf8')), raw); assert.equal(result.provenance?.dataTime, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
