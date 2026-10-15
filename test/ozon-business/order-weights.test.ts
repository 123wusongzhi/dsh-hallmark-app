import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { RuntimeStore } from '../../packages/app-runtime/src/store.ts';
import { HallmarkStorePort } from '../../packages/app-hallmark/src/store.ts';
import { businessConnectedClient, connectionBusinessGateway } from '../../packages/app-hallmark/src/operations-client.ts';
import { OzonBusinessGateway, OzonOrderWeightReports, ozonBusinessEndpoint } from '../../packages/ozon-business/src/index.ts';
import { parseOrderWeightReport } from '../../packages/ozon-business/src/order-weight-csv.ts';
import { realStoreProducts } from '../real-data/corpus.ts';

const credential = { clientId: 'fixture-weight-client', apiKey: 'fixture-weight-secret' };
const range = { dateFrom: '2026-09-01', dateTo: '2026-09-02', requestId: 'query-one' };
const headers = ['Shipment number', 'Article code', 'SKU', 'Quantity', 'Status', 'Cancellation date', 'Linked shipments', 'Actual date of handing over to delivery', 'Total actual weight of the shipment', 'Declared total weight of the shipment', 'Customer name'];
const recorded = realStoreProducts().products[0];
// Shipment, quantity and fractional kg are explicit parser boundaries on a recorded sales identity.
const row = ['posting-one', recorded.offerId, recorded.sku, '1', 'Delivered', '', '', '2026-09-01 12:00:00', '0.01201', '0.02', 'private customer'];
const csv = (rows = [row]) => [headers, ...rows].map(values => values.map(value => /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(';')).join('\r\n');
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

function fixture(t: test.TestContext, fetchImpl: typeof fetch) {
  const directory = mkdtempSync(join(tmpdir(), 'ozon-weight-test-')), path = join(directory, 'runtime.sqlite');
  let database = new RuntimeStore(path), store = new HallmarkStorePort(database, 'source-one');
  const gateway = new OzonBusinessGateway(directory, { fetchImpl });
  gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 0, credentials: credential, sourceConnectionId: 'source-one' });
  t.after(() => { database.close(); assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}ozon-weight-test-`)); rmSync(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 }); });
  return { directory, gateway, get store() { return store; }, reader: (revision = 1, connection = 'source-one') => new OzonOrderWeightReports(gateway, store, connection, revision), restart() { database.close(); database = new RuntimeStore(path); store = new HallmarkStorePort(database, 'source-one'); } };
}

test('independent weights reuse pending report across restart and expose only parsed evidence', async t => {
  const calls: { url: string; init?: RequestInit }[] = []; let ready = false;
  const f = fixture(t, async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/create')) return Response.json({ result: { code: 'private-report-code' } });
    if (String(url).endsWith('/info')) { assert.deepEqual(JSON.parse(String(init?.body)), { code: 'private-report-code' }); return Response.json({ result: ready ? { status: 'success', file: 'https://cdn.ozon.ru/report.csv?signature=private-download-value' } : { status: 'waiting' } }); }
    assert.equal(String(url), 'https://cdn.ozon.ru/report.csv?signature=private-download-value');
    assert.equal(new Headers(init?.headers).get('Api-Key'), null); assert.equal(new Headers(init?.headers).get('Client-Id'), null);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    return new Response(csv());
  });
  const first = await f.reader().read('bill', range); assert.equal(first.raw.status, 'pending');
  f.restart(); ready = true;
  const result = await f.reader().read('bill', range);
  assert.equal(result.raw.status, 'ready'); assert.equal(result.raw.items[0].grams, 13); assert.equal(result.raw.items[0].declaredGrams, 20);
  assert.equal(result.raw.items[0].shipmentAt, '2026-09-01T12:00:00.000Z'); assert.match(result.raw.reportHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(await f.reader().read('bill', range), result); assert.equal(calls.length, 4);
  const body = JSON.parse(String(calls[0].init?.body)); assert.equal(body.language, 'EN'); assert.equal(body.with.customer_data, false); assert.equal(body.with.additional_data, true);
  for (const privateValue of ['private customer', 'private-download-value', credential.apiKey, credential.clientId]) { assert.equal(JSON.stringify(result).includes(privateValue), false); assert.equal(JSON.stringify(f.store.list('business_weight_reports')).includes(privateValue), false); }
  assert.equal(JSON.stringify(result).includes('private-report-code'), false);
  assert.equal(ozonBusinessEndpoint('/v1/report/postings/create')?.readOnly, false);
});

test('private report handles containing Client-Id survive redaction boundaries exactly, without public exposure', async t => {
  const code = `POSTINGS_${credential.clientId}_opaque-handle`, file = `https://cdn.ozon.ru/${credential.clientId}/report.csv?signature=opaque`;
  let creates = 0, polls = 0, downloads = 0;
  const f = fixture(t, async (url, init) => {
    if (String(url).endsWith('/create')) { creates++; return Response.json({ result: { code, unexpected_private_field: credential.apiKey } }); }
    if (String(url).endsWith('/info')) { polls++; assert.equal(JSON.parse(String(init?.body)).code, code); return Response.json({ result: { status: 'success', file, customer_data: { name: 'private-report-customer' } } }); }
    assert.equal(String(url), file); downloads++; return new Response(csv());
  });
  const result = await f.reader().read('bill', range); assert.equal(result.raw?.status, 'ready'); assert.deepEqual([creates, polls, downloads], [1, 1, 1]);
  assert.equal(f.store.list<any>('business_weight_reports')[0].code, code);
  for (const value of [code, file, credential.apiKey, credential.clientId, 'private-report-customer']) assert.equal(JSON.stringify(result).includes(value), false);
});

test('report lookup diagnostics retain field errors but hide handles, URLs, credentials and customer fields', async t => {
  const code = `POSTINGS_${credential.clientId}_private-code`;
  const f = fixture(t, async url => String(url).endsWith('/create') ? Response.json({ result: { code } }) : Response.json({
    code: 5, message: `report ${code} not found; source https://cdn.ozon.ru/private?signature=private-signature`,
    details: [{ field: 'code', message: 'report does not exist', customer_name: 'private-customer', file: 'private-file' }],
    customer_data: 'private-customer-data', file: 'private-file', token: credential.apiKey,
  }, { status: 404 }));
  const result = await f.reader().read('bill', range);
  assert.equal(result.error?.code, 'OZON_REJECTED'); assert.match(result.error!.message, /HTTP 404/); assert.match(result.error!.message, /report does not exist/);
  for (const value of [code, credential.clientId, credential.apiKey, 'private-signature', 'private-customer', 'private-file']) assert.equal(JSON.stringify(result).includes(value), false);
  const scoped = connectionBusinessGateway(f.gateway, 'other-source');
  assert.equal((await scoped.createOrderWeightReport('bill', range.dateFrom, range.dateTo, 1)).error?.code, 'STORE_CONNECTION_MISMATCH');
  assert.equal((await scoped.inspectOrderWeightReport('bill', code, 1)).error?.code, 'STORE_CONNECTION_MISMATCH');
});

test('concurrent readers share one creation; a separate CoreStore wrapper cannot duplicate an in-flight intent', async t => {
  const receipt = deferred<Response>(); let creates = 0, polls = 0;
  const f = fixture(t, async url => { if (String(url).endsWith('/create')) { creates++; return receipt.promise; } polls++; return Response.json({ result: { status: 'waiting' } }); });
  const first = f.reader().read('bill', range), second = f.reader().read('bill', range); await tick();
  const independentStore = new Proxy(f.store, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
  assert.equal((await new OzonOrderWeightReports(f.gateway, independentStore, 'source-one').read('bill', range)).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN');
  receipt.resolve(Response.json({ result: { code: 'one-code' } }));
  assert.deepEqual(await first, await second); assert.equal(creates, 1); assert.equal(polls, 1);
});

test('late pending or failed polls cannot demote ready across store instances, nor overwrite a newer report intent', async t => {
  for (const delayedState of ['waiting', 'failed']) for (const replaceIntent of [false, true]) {
    const receipt = deferred<Response>(); let polls = 0, creates = 0;
    const f = fixture(t, async url => {
      if (String(url).endsWith('/create')) return Response.json({ result: { code: `code-${++creates}` } });
      if (String(url).endsWith('/info')) { polls++; if (polls === 2) return receipt.promise; return Response.json({ result: polls === 1 || polls === 4 ? { status: 'waiting' } : { status: 'success', file: 'https://ozon.ru/report.csv' } }); }
      return new Response(csv());
    });
    await f.reader().read('bill', range);
    const other = new Proxy(f.store, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
    const late = new OzonOrderWeightReports(f.gateway, other, 'source-one').read('bill', range); await tick();
    assert.equal((await f.reader().read('bill', range)).raw.status, 'ready');
    if (replaceIntent) await f.reader().read('bill', { ...range, requestId: 'new-request' });
    const before = f.store.list<any>('business_weight_reports')[0];
    receipt.resolve(Response.json({ result: { status: delayedState } })); const delayed = await late;
    assert.deepEqual(f.store.list('business_weight_reports')[0], before);
    if (!replaceIntent) assert.equal(delayed.raw.status, 'ready');
    assert.equal(creates, replaceIntent ? 2 : 1);
  }
});

test('unknown creation, malformed success and lost process intent never cause another create', async t => {
  let creates = 0;
  const f = fixture(t, async () => { creates++; throw Error('unknown private network detail'); });
  assert.equal((await f.reader().read('bill', range)).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN');
  f.restart();
  for (const requestId of ['query-one', 'fresh-query']) assert.equal((await f.reader().read('bill', { ...range, requestId })).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN');
  assert.equal(creates, 1);
  const rows = f.store.list<any>('business_weight_reports'); assert.equal(rows[0].state, 'unknown');
  assert.equal(JSON.stringify(rows).includes('private network detail'), false);
  const g = fixture(t, async () => { creates++; return Response.json({ result: {} }); });
  assert.equal((await g.reader().read('bill', range)).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN');
  assert.equal((await g.reader().read('bill', range)).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN'); assert.equal(creates, 2);
});

test('config, credential, connection and date scopes cannot reuse each other reports', async t => {
  const used: string[] = []; let creates = 0;
  const f = fixture(t, async (url, init) => { if (String(url).endsWith('/create')) { creates++; used.push(new Headers(init?.headers).get('Api-Key')!); return Response.json({ result: { code: `code-${creates}` } }); } return Response.json({ result: { status: 'waiting' } }); });
  await f.reader().read('bill', range); await f.reader(2).read('bill', range); await f.reader().read('bill', { ...range, dateTo: '2026-09-03' });
  assert.equal((await f.reader(1, 'other-source').read('bill', range)).error?.code, 'STORE_CONNECTION_MISMATCH');
  f.gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 1, credentials: { ...credential, apiKey: 'fixture-weight-rotated' } });
  await f.reader().read('bill', range);
  assert.equal(creates, 4); assert.deepEqual(used, [credential.apiKey, credential.apiKey, credential.apiKey, 'fixture-weight-rotated']);
});

test('definite rate-limit rejection respects Retry-After then permits the same query; unknown never retries', async t => {
  let creates = 0, now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = fixture(t, async url => {
    if (String(url).endsWith('/create')) { creates++; return creates === 1 ? Response.json({ message: 'rate limited' }, { status: 429, headers: { 'Retry-After': '2' } }) : Response.json({ result: { code: 'after-limit' } }); }
    return Response.json({ result: { status: 'waiting' } });
  });
  const limited = await f.reader().read('bill', range); assert.equal(limited.error?.code, 'OZON_RATE_LIMITED'); assert.equal(limited.error?.retryAfterMs, 2000);
  now += 1000; assert.equal((await f.reader().read('bill', { ...range, requestId: 'new-query' })).error?.retryAfterMs, 1000); assert.equal(creates, 1);
  now += 1000; assert.equal((await f.reader().read('bill', range)).raw.status, 'pending'); assert.equal(creates, 2);
});

test('confirmed failed report can recover after backoff even when the public query id stays unchanged', async t => {
  let creates = 0, polls = 0, now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = fixture(t, async url => {
    if (String(url).endsWith('/create')) return Response.json({ result: { code: `code-${++creates}` } });
    polls++; return Response.json({ result: { status: polls === 1 ? 'failed' : 'waiting' } });
  });
  const failed = await f.reader().read('bill', range); assert.equal(failed.error?.code, 'WEIGHT_REPORT_FAILED'); assert.equal(failed.error?.retryable, true);
  now += 30_000; assert.equal((await f.reader().read('bill', range)).error?.retryAfterMs, 30_000); assert.equal(creates, 1);
  now += 30_000; assert.equal((await f.reader().read('bill', range)).raw.status, 'pending'); assert.equal(creates, 2); assert.equal(polls, 2);
});

test('failed inspection and unsafe download retain the original code without creating a replacement', async t => {
  let creates = 0, polls = 0, downloads = 0;
  const f = fixture(t, async url => {
    if (String(url).endsWith('/create')) { creates++; return Response.json({ result: { code: 'retained-code' } }); }
    if (String(url).endsWith('/info')) { polls++; return polls === 1 ? Response.json({ message: 'unavailable' }, { status: 500 }) : Response.json({ result: { status: 'success', file: 'https://evil.test/private-report' } }); }
    downloads++; throw Error('unsafe download must not run');
  });
  assert.equal((await f.reader().read('bill', range)).error?.code, 'OZON_READ_UNAVAILABLE');
  assert.equal((await f.reader().read('bill', { ...range, requestId: 'new' })).error?.code, 'WEIGHT_REPORT_UNREADABLE');
  f.restart(); assert.equal((await f.reader().read('bill', range)).error?.code, 'WEIGHT_REPORT_UNREADABLE');
  assert.equal(creates, 1); assert.equal(polls, 3); assert.equal(downloads, 0);
});

test('pending reports survive new query ids; only completed results can start a fresh report', async t => {
  let creates = 0, ready = false;
  const f = fixture(t, async url => {
    if (String(url).endsWith('/create')) return Response.json({ result: { code: `code-${++creates}` } });
    if (String(url).endsWith('/info')) return Response.json({ result: ready ? { status: 'success', file: 'https://ozon.ru/report.csv' } : { status: 'processing' } });
    return new Response(csv());
  });
  await f.reader().read('bill', range); await f.reader().read('bill', { ...range, requestId: 'new' }); assert.equal(creates, 1);
  ready = true; await f.reader().read('bill', { ...range, requestId: 'new' }); await f.reader().read('bill', { ...range, requestId: 'new' }); assert.equal(creates, 1);
  await f.reader().read('bill', { ...range, requestId: 'newer' }); assert.equal(creates, 2);
});

test('cancellation before dispatch is empty; cancelled waiter does not abort a remaining waiter', async t => {
  const receipt = deferred<Response>(); let calls = 0, transport: AbortSignal | undefined;
  const f = fixture(t, async (url, init) => { calls++; if (String(url).endsWith('/create')) { transport = init?.signal as AbortSignal; return receipt.promise; } return Response.json({ result: { status: 'waiting' } }); });
  const before = new AbortController(); before.abort(); assert.equal((await f.reader().read('bill', range, before.signal)).error?.code, 'OZON_REQUEST_CANCELLED'); assert.equal(calls, 0); assert.equal(f.store.list('business_weight_reports').length, 0);
  const controller = new AbortController(), first = f.reader().read('bill', range, controller.signal), second = f.reader().read('bill', range); await tick(); controller.abort();
  assert.equal((await first).error?.code, 'OZON_REQUEST_CANCELLED'); assert.equal(transport?.aborted, false);
  receipt.resolve(Response.json({ result: { code: 'saved-code' } })); assert.equal((await second).raw.status, 'pending'); assert.equal(calls, 2);
});

test('cancelled last waiter still saves a late complete receipt, then reuses it without creation', async t => {
  const receipt = deferred<Response>(); let creates = 0, polls = 0;
  const f = fixture(t, async url => { if (String(url).endsWith('/create')) { creates++; return receipt.promise; } polls++; return Response.json({ result: { status: 'waiting' } }); });
  const controller = new AbortController(), pending = f.reader().read('bill', range, controller.signal); await tick(); controller.abort();
  assert.equal((await pending).error?.code, 'OZON_REQUEST_CANCELLED'); receipt.resolve(Response.json({ result: { code: 'saved-after-cancel' } })); await tick();
  assert.equal(polls, 0); assert.equal(f.store.list<any>('business_weight_reports')[0].code, 'saved-after-cancel');
  assert.equal((await f.reader().read('bill', range)).raw.status, 'pending'); assert.equal(creates, 1); assert.equal(polls, 1);
});

test('aborting a dispatched creation with no receipt records unknown and never repeats it', async t => {
  let creates = 0;
  const f = fixture(t, async (_url, init) => { creates++; return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Error('aborted')), { once: true })); });
  const controller = new AbortController(), pending = f.reader().read('bill', range, controller.signal); await tick(); controller.abort(); await pending; await tick();
  assert.equal((await f.reader().read('bill', range)).error?.code, 'WEIGHT_REPORT_OUTCOME_UNKNOWN'); assert.equal(creates, 1);
});

test('credential rotation while creating saves receipt without polling with stale credentials', async t => {
  let calls = 0; const receipt = deferred<Response>();
  const f = fixture(t, async () => { calls++; return receipt.promise; });
  const pending = f.reader().read('bill', range); await tick();
  f.gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 1, credentials: { ...credential, apiKey: 'fixture-weight-next' } });
  receipt.resolve(Response.json({ result: { code: 'old-revision-report' } }));
  assert.equal((await pending).error?.code, 'OZON_CREDENTIAL_REVISION_CHANGED'); assert.equal(calls, 1); assert.equal(f.store.list<any>('business_weight_reports')[0].code, 'old-revision-report');
});

test('download rejects unsafe addresses and oversized streams, without leaking report data', async t => {
  let mode = 'small', calls = 0;
  const f = fixture(t, async () => { calls++; if (mode === 'length') return new Response('small', { headers: { 'content-length': String(10 * 1024 * 1024 + 1) } }); if (mode === 'stream') return new Response(new Uint8Array(10 * 1024 * 1024 + 1)); return new Response(csv()); });
  for (const address of ['http://ozon.ru/a', 'https://ozon.ru.evil.test/a', 'https://evil.test/a', 'https://user:pass@ozon.ru/a', 'https://127.0.0.1/a', 'https://ozon.ru:444/a', 'https://ozon.ru\\@evil.test/a']) {
    // WHATWG interprets the last URL as an Ozon path; it stays on the allowed host and is harmless.
    if (new URL(address).hostname === 'ozon.ru' && address.includes('\\')) continue;
    await assert.rejects(f.gateway.downloadOrderWeightReport(address));
  }
  assert.equal(calls, 0);
  mode = 'length'; await assert.rejects(f.gateway.downloadOrderWeightReport('https://cdn.ozon.ru/a')); mode = 'stream'; await assert.rejects(f.gateway.downloadOrderWeightReport('https://cdn.ozon.ru/a'));
});

test('parser excludes mixed, multiple, cancelled and invalid evidence and never guesses changed columns', () => {
  const changed = (posting: string, index: number, value: string) => row.map((cell, i) => i === 0 ? posting : i === index ? value : cell);
  const result = parseOrderWeightReport(csv([
    row, changed('multi', 3, '2'), changed('cancelled', 4, 'Cancelled'), changed('linked', 6, 'other-posting'),
    changed('mixed', 1, 'one'), changed('mixed', 1, 'two'), changed('missing', 8, ''), changed('bad-date', 7, '2026-02-30 12:00:00'), changed('bad-weight', 8, '0.0'), changed('leading-zero-sku', 2, '001'),
  ]));
  assert.equal(result.items.length, 1); assert.equal(result.skipped.length, 8); assert.equal(result.items[0].grams, 13);
  assert.throws(() => parseOrderWeightReport(csv().replace('Total actual weight of the shipment', 'New weight header')));
  // CSV protocol negative: retain every column so a column-count error cannot hide a missing EOF quote check.
  const quotedLastColumn = csv([row.map((value, index) => index === row.length - 1 ? `${value};quoted` : value)]);
  assert.ok(quotedLastColumn.endsWith('"'));
  assert.deepEqual(parseOrderWeightReport(quotedLastColumn), parseOrderWeightReport(csv()));
  assert.throws(() => parseOrderWeightReport(quotedLastColumn.slice(0, -1)), { message: 'WEIGHT_REPORT_CSV_INVALID' });
  const quoted = row.map((value, index) => index === 1 ? 'semi;quote"line\nnext' : value); assert.equal(parseOrderWeightReport(csv([quoted])).items[0].offerId, quoted[1]);
});

test('business client never falls back for an independent store; legitimate legacy remains available', async t => {
  let direct = 0, legacy = 0;
  const f = fixture(t, async url => { direct++; return Response.json({ result: String(url).endsWith('/create') ? { code: 'direct-code' } : { status: 'waiting' } }); });
  const source = { readOrderWeights: async () => { legacy++; return { status: 'ok', raw: { legacy: true } }; } } as any;
  const client = businessConnectedClient(source, f.gateway, f.store, 'source-one');
  assert.equal((await client.readOrderWeights('bill', range)).raw.status, 'pending'); assert.equal(direct, 2); assert.equal(legacy, 0);
  assert.equal((await client.readOrderWeights('old-only', range)).raw.legacy, true); assert.equal(legacy, 1);
  assert.equal((await businessConnectedClient(source, f.gateway, f.store, 'other-source').readOrderWeights('bill', range)).error?.code, 'STORE_CONNECTION_MISMATCH');
  assert.equal((await businessConnectedClient(source, f.gateway, f.store, 'source-one', false).readOrderWeights('old-only', range)).error?.code, 'STORE_CONNECTION_MISMATCH'); assert.equal(legacy, 1);
});

test('invalid date ranges dispatch nothing and create no intents', async t => {
  let calls = 0; const f = fixture(t, async () => { calls++; throw Error('must not fetch'); });
  for (const input of [{ ...range, dateFrom: '2026-02-30' }, { ...range, dateFrom: '2026-09-03' }, { ...range, dateFrom: '2026-01-01' }, { ...range, requestId: '' }]) assert.equal((await f.reader().read('bill', input)).error?.code, 'WEIGHT_DATE_RANGE_INVALID');
  assert.equal(calls, 0); assert.equal(f.store.list('business_weight_reports').length, 0);
});
