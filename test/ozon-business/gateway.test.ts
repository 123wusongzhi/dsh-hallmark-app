import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { OzonBusinessGateway, OzonBusinessError, ozonBusinessEndpoint } from '../../packages/ozon-business/src/index.ts';

const credential = { clientId: 'fixture-client-first', apiKey: 'fixture-secret-first' };
function fixture(t: test.TestContext, fetchImpl?: typeof fetch) {
  const directory = mkdtempSync(join(tmpdir(), 'ozon-business-test-'));
  t.after(() => { assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}ozon-business-test-`)); rmSync(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 50 }); });
  const gateway = new OzonBusinessGateway(directory, { fetchImpl });
  const store = gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 0, currency: 'CNY', credentials: credential, legacyStoreId: 'old-bill', sourceConnectionId: 'source-one' });
  return { directory, gateway, store };
}
function code(expected: string) { return (error: unknown) => error instanceof OzonBusinessError && error.code === expected; }
const write = { path: '/v1/product/import/prices', body: { prices: [{ product_id: 17, price: '10.38', currency_code: 'CNY' }] } };

test('private vault is encrypted, public stores are redacted and restart preserves identity', async t => {
  const { directory, gateway, store } = fixture(t);
  assert.equal(store.revision, 1); assert.equal(store.credentialRevision, 1); assert.equal(store.hasCredentials, true);
  for (const file of ['stores.json', 'private/credentials.enc.json', 'private/vault-key.json']) {
    const content = readFileSync(join(directory, file), 'utf8');
    for (const secret of Object.values(credential)) assert.equal(content.includes(secret), false);
  }
  assert.deepEqual(new OzonBusinessGateway(directory).listStores(), gateway.listStores());
  if (process.platform === 'win32') assert.equal(JSON.parse(readFileSync(join(directory, 'private/vault-key.json'), 'utf8')).protection, 'dpapi-current-user');
  let key: string | null = null;
  const restarted = new OzonBusinessGateway(directory, { fetchImpl: async (_url, init) => { key = new Headers(init?.headers).get('Api-Key'); return Response.json({ company: { currency: 'CNY' } }); } });
  assert.equal((await restarted.checkStore('bill')).status, 'ok'); assert.equal(key, credential.apiKey);
});

test('store saves require current revision and keep source and account stable', t => {
  const { gateway, directory } = fixture(t);
  const second = new OzonBusinessGateway(directory);
  const updated = gateway.saveStore({ id: 'bill', name: 'New name', expectedRevision: 1 });
  assert.equal(updated.revision, 2); assert.equal(updated.credentialRevision, 1); assert.equal(updated.sourceConnectionId, 'source-one');
  assert.throws(() => second.saveStore({ id: 'bill', name: 'stale', expectedRevision: 1 }), code('STORE_REVISION_CONFLICT'));
  assert.throws(() => second.saveStore({ id: 'bill', name: 'other source', expectedRevision: 2, legacyStoreId: 'old-bill', sourceConnectionId: 'source-two' }), code('STORE_SOURCE_IMMUTABLE'));
  assert.throws(() => second.saveStore({ id: 'bill', name: 'other account', expectedRevision: 2, credentials: { clientId: 'another-client', apiKey: 'other-secret' } }), code('STORE_ACCOUNT_CHANGED'));
  assert.throws(() => second.saveStore({ id: 'bill', name: credential.apiKey, expectedRevision: 2 }), code('STORE_METADATA_CONTAINS_CREDENTIAL'));
  assert.throws(() => second.saveStore({ id: '__proto__', name: 'invalid id', expectedRevision: 0, credentials: credential }), code('STORE_INPUT_INVALID'));
  assert.equal(second.getStore('bill')?.name, 'New name');
});

test('legacy IDs are scoped to source and repeat import does not overwrite current settings', t => {
  const { gateway } = fixture(t);
  const a = gateway.importLegacyStore({ name: 'one', legacyStoreId: 'shared', sourceConnectionId: 'one', credentials: credential });
  const b = gateway.importLegacyStore({ name: 'two', legacyStoreId: 'shared', sourceConnectionId: 'two', credentials: credential });
  assert.equal(a.id, 'shared'); assert.notEqual(a.id, b.id); assert.match(b.id, /^shared~/);
  const again = gateway.importLegacyStore({ name: 'changed source name', legacyStoreId: 'shared', sourceConnectionId: 'two', credentials: credential });
  assert.deepEqual(again, b);
});

test('credential rotation retains historical read access but rejects stale writes', async t => {
  const used: string[] = [];
  const { gateway } = fixture(t, async (_url, init) => { used.push(new Headers(init?.headers).get('Api-Key')!); return Response.json({ items: [] }); });
  const updated = gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 1, credentials: { ...credential, apiKey: 'fixture-secret-second' } });
  assert.equal(updated.credentialRevision, 2);
  assert.equal((await gateway.request('bill', { path: '/v1/product/import/info', body: { task_id: 9 }, credentialRevision: 1 })).status, 'ok');
  assert.equal((await gateway.request('bill', { ...write, credentialRevision: 1 })).error?.code, 'OZON_CREDENTIAL_REVISION_CHANGED');
  assert.equal((await gateway.request('bill', { ...write, credentialRevision: 2 })).status, 'ok');
  assert.deepEqual(used, ['fixture-secret-first', 'fixture-secret-second']);
});

test('corrupt encrypted vault is not overwritten or exposed', async t => {
  const { gateway, directory } = fixture(t);
  const path = join(directory, 'private', 'credentials.enc.json'); writeFileSync(path, '{broken secret fixture');
  assert.throws(() => gateway.saveStore({ id: 'bill', name: 'changed', expectedRevision: 1 }), code('CREDENTIAL_VAULT_UNAVAILABLE'));
  assert.equal(readFileSync(path, 'utf8'), '{broken secret fixture');
  const result = await gateway.request('bill', write); assert.equal(result.status, 'unavailable'); assert.equal(JSON.stringify(result).includes('broken secret'), false);
  assert.equal(readdirSync(join(directory, 'private')).includes('directory.lock'), false);
});

test('only exact supported endpoints/methods are dispatched to the fixed Seller origin', async t => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const { gateway } = fixture(t, async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ result: true }); });
  for (const path of ['https://other.test/v3/product/import', '/v1/actions/products/deactivate', '/v1/actions/products/activate', '/v99/product/info/list', '/v3/product/import?x=1']) {
    assert.equal((await gateway.request('bill', { path })).error?.code, 'OZON_ENDPOINT_UNSUPPORTED');
  }
  assert.equal((await gateway.request('bill', { path: '/v1/actions', method: 'POST' })).status, 'failed');
  assert.equal((await gateway.request('bill', { path: '/v1/actions', method: 'GET' })).status, 'ok');
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api-seller.ozon.ru/v1/actions'); assert.equal(calls[0].init?.body, undefined); assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(new Headers(calls[0].init?.headers).get('Api-Key'), credential.apiKey);
  assert.deepEqual(ozonBusinessEndpoint('/v2/actions/products/deactivate'), { method: 'POST', readOnly: false });
});

test('verified promotion amount objects and v2 exit payloads are forwarded unchanged', async t => {
  const bodies: unknown[] = [];
  const { gateway } = fixture(t, async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return Response.json({ result: { updated: true } }); });
  const update = { action_id: 7, products: [{ product_id: 17, action_price: { amount: '9.99', currency: 'CNY' }, stock: '10' }] };
  const exit = { action_id: 7, product_ids: ['17'] };
  await gateway.request('bill', { path: '/v1/actions/products/update', body: update }); await gateway.request('bill', { path: '/v2/actions/products/deactivate', body: exit });
  assert.deepEqual(bodies, [update, exit]);
});

test('write network errors, 408 and 5xx stay unknown and send exactly once', async t => {
  const { directory } = fixture(t);
  for (const status of [0, 408, 500, 503]) {
    let count = 0;
    const gateway = new OzonBusinessGateway(directory, { fetchImpl: async () => { count++; if (!status) throw new Error(`private ${credential.apiKey}`); return Response.json({ error: 'server failure' }, { status }); } });
    const result = await gateway.request('bill', write);
    assert.equal(result.status, 'unknown'); assert.equal(result.raw.outcome, 'outcome_unknown'); assert.equal(result.error?.retryable, false); assert.equal(count, 1); assert.equal(JSON.stringify(result).includes(credential.apiKey), false);
  }
});

test('definite rejection retains platform field errors and rate limits expose retry delay without retry', async t => {
  const { directory } = fixture(t);
  for (const status of [400, 403, 429]) {
    let count = 0;
    const gateway = new OzonBusinessGateway(directory, { fetchImpl: async () => { count++; return Response.json({ code: 'price_invalid', message: 'change price', field: 'price' }, { status, headers: { 'Retry-After': '2' } }); } });
    const result = await gateway.request('bill', write);
    assert.equal(result.status, 'failed'); assert.equal(result.raw.response.field, 'price'); assert.equal(result.error?.retryable, status === 429); assert.equal(result.error?.retryAfterMs, 2000); assert.equal(count, 1);
  }
});

test('response errors redact echoed credentials and private fields', async t => {
  const { gateway } = fixture(t, async () => Response.json({ message: `echo ${credential.clientId} ${credential.apiKey}`, nested: { api_key: 'hidden-token', authorization: 'hidden-auth' } }, { status: 400 }));
  const result = await gateway.request('bill', write), encoded = JSON.stringify(result);
  for (const secret of [...Object.values(credential), 'hidden-token', 'hidden-auth']) assert.equal(encoded.includes(secret), false);
  assert.equal(result.raw.response.nested.api_key, '[redacted]');
});

test('invalid request content and pre-aborted requests never reach transport', async t => {
  let count = 0; const { gateway } = fixture(t, async () => { count++; return Response.json({}); });
  const cyclic: any = {}; cyclic.value = cyclic;
  for (const body of [{ headers: { authorization: 'private' } }, { field: Infinity }, cyclic, { text: credential.apiKey }]) assert.equal((await gateway.request('bill', { path: write.path, body })).status, 'failed');
  const controller = new AbortController(); controller.abort();
  assert.equal((await gateway.request('bill', write, controller.signal)).error?.code, 'OZON_REQUEST_CANCELLED'); assert.equal(count, 0);
});

test('cancellation after dispatch and malformed successful response remain unknown', async t => {
  const { directory } = fixture(t);
  const controller = new AbortController();
  const cancel = new OzonBusinessGateway(directory, { fetchImpl: async () => { controller.abort(); throw new DOMException('aborted', 'AbortError'); } });
  assert.equal((await cancel.request('bill', write, controller.signal)).status, 'unknown');
  const malformed = new OzonBusinessGateway(directory, { fetchImpl: async () => new Response('<html>upstream intermediary</html>', { status: 200 }) });
  assert.equal((await malformed.request('bill', write)).status, 'unknown');
  assert.equal((await malformed.checkStore('bill')).status, 'unavailable');
});

test('disabled stores reject new writes and still allow historical inspection', async t => {
  let calls = 0; const { gateway } = fixture(t, async () => { calls++; return Response.json({ result: { items: [] } }); });
  gateway.saveStore({ id: 'bill', name: 'bill', expectedRevision: 1, enabled: false });
  assert.equal((await gateway.request('bill', write)).error?.code, 'OZON_STORE_DISABLED');
  assert.equal((await gateway.request('bill', { path: '/v1/product/import/info', body: { task_id: 4 }, credentialRevision: 1 })).status, 'ok'); assert.equal(calls, 1);
});

test('full product scan follows cursor and returns native details without legacy calls', async t => {
  const paths: string[] = [];
  const { gateway } = fixture(t, async (url, init) => {
    const path = new URL(String(url)).pathname; paths.push(path); const body = JSON.parse(String(init?.body));
    if (path === '/v3/product/list') return Response.json({ result: body.last_id ? { items: [], last_id: '' } : { items: [{ product_id: 17 }, { product_id: 18 }], last_id: 'next' } });
    assert.deepEqual(body, { product_id: [17, 18] }); return Response.json({ items: [{ id: 17, offer_id: 'red', stocks: { has_stock: false } }, { id: 18, offer_id: 'blue' }] });
  });
  const result = await gateway.getProducts('bill');
  assert.equal(result.status, 'ok'); assert.deepEqual(result.raw.response.items.map((p: any) => p.offer_id), ['red', 'blue']);
  assert.deepEqual(paths, ['/v3/product/list', '/v3/product/info/list', '/v3/product/list', '/v3/product/list', '/v3/product/list']);
});

test('full product scan independently includes archived pages absent from ALL and joins details by stable product IDs', async t => {
  const calls: { path: string; body: any }[] = [];
  const { gateway } = fixture(t, async (url, init) => {
    const path = new URL(String(url)).pathname, body = JSON.parse(String(init?.body)); calls.push({ path, body });
    if (path === '/v3/product/list') {
      if (body.filter.visibility === 'ALL') return Response.json({ result: { items: [{ product_id: 17, offer_id: 'active' }], last_id: '', total: 1 } });
      assert.equal(body.filter.visibility, 'ARCHIVED');
      return Response.json({ result: body.last_id === ''
        ? { items: [{ product_id: '18', offer_id: 'archived-blue' }, { product_id: 19, offer_id: 'archived-red' }], last_id: 'archive-page-2', total: 3 }
        : { items: [{ product_id: 20, offer_id: 'archived-green' }], last_id: '', total: 3 } });
    }
    const names: Record<string, string> = { 17: 'active', 18: 'archived-blue', 19: 'archived-red', 20: 'archived-green' };
    return Response.json({ items: body.product_id.slice().reverse().map((id: string | number) => ({ id, offer_id: names[String(id)], is_archived: String(id) !== '17' })) });
  });
  const result = await gateway.getProducts('bill');
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.raw.response.items.map((p: any) => String(p.id)).sort(), ['17', '18', '19', '20']);
  assert.deepEqual(calls.filter(call => call.path === '/v3/product/list').map(call => [call.body.filter.visibility, call.body.last_id]), [['ALL', ''], ['ARCHIVED', ''], ['ARCHIVED', 'archive-page-2']]);
  assert.deepEqual(calls.filter(call => call.path === '/v3/product/info/list').map(call => call.body.product_id), [[17], ['18', 19], [20]]);
});

test('products already returned by ALL or earlier pages are not fetched again from ARCHIVED', async t => {
  const details: any[] = [];
  const { gateway } = fixture(t, async (url, init) => {
    const path = new URL(String(url)).pathname, body = JSON.parse(String(init?.body));
    if (path === '/v3/product/list') return Response.json({ result: body.filter.visibility === 'ALL'
      ? { items: [{ product_id: 17, offer_id: 'active' }, { product_id: 18, offer_id: 'archived' }], last_id: '', total: 2 }
      : { items: [{ product_id: '18', offer_id: 'archived' }, { product_id: 19, offer_id: 'extra' }], last_id: '', total: 2 } });
    details.push(body.product_id);
    return Response.json({ items: body.product_id.map((id: number) => ({ id, offer_id: id === 17 ? 'active' : id === 18 ? 'archived' : 'extra' })) });
  });
  const result = await gateway.getProducts('bill');
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.raw.response.items.map((p: any) => p.id), [17, 18, 19]);
  assert.deepEqual(details, [[17, 18], [19]]);
});

test('failure on an archived page never returns successful partial ALL products', async t => {
  const { gateway } = fixture(t, async (url, init) => {
    const path = new URL(String(url)).pathname, body = JSON.parse(String(init?.body));
    if (path === '/v3/product/info/list') return Response.json({ items: body.product_id.map((id: number) => ({ id })) });
    if (body.filter.visibility === 'ALL') return Response.json({ result: { items: [{ product_id: 17 }], last_id: '', total: 1 } });
    if (body.last_id === '') return Response.json({ result: { items: [{ product_id: 18 }], last_id: 'archive-next', total: 2 } });
    return Response.json({ message: 'temporary failure' }, { status: 503 });
  });
  const result = await gateway.getProducts('bill');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error?.code, 'OZON_READ_UNAVAILABLE');
  assert.equal(result.raw.response.items, undefined);
});

test('missing, foreign, or misidentified details do not masquerade as a complete catalogue', async t => {
  const { directory } = fixture(t);
  for (const rows of [[{ id: 17 }], [{ id: 17 }, { id: 19 }], [{ id: 17 }, { offer_id: 'no-product-id' }]]) {
    const gateway = new OzonBusinessGateway(directory, { fetchImpl: async url => new URL(String(url)).pathname === '/v3/product/list'
      ? Response.json({ result: { items: [{ product_id: 17 }, { product_id: 18 }], last_id: '', total: 2 } })
      : Response.json({ items: rows }) });
    const result = await gateway.getProducts('bill');
    assert.equal(result.status, 'unavailable');
    assert.ok(['OZON_PRODUCT_DETAILS_INCOMPLETE', 'OZON_PRODUCTS_INVALID'].includes(result.error!.code));
  }
});

test('catalogue totals and pagination must finish completely for each visibility', async t => {
  const { directory } = fixture(t);
  for (const archived of [
    { items: [{ product_id: 18 }], last_id: '', total: 2 },
    { items: [], last_id: '', total: 1 },
    { items: [{ product_id: 18 }] },
  ]) {
    const gateway = new OzonBusinessGateway(directory, { fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (new URL(String(url)).pathname === '/v3/product/info/list') return Response.json({ items: body.product_id.map((id: number) => ({ id })) });
      return Response.json({ result: body.filter.visibility === 'ALL' ? { items: [], last_id: '', total: 0 } : archived });
    } });
    assert.equal((await gateway.getProducts('bill')).error?.code, 'OZON_PRODUCT_PAGINATION_INCOMPLETE');
  }
});

test('a missing archived detail does not return the active products as complete', async t => {
  const { gateway } = fixture(t, async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (new URL(String(url)).pathname === '/v3/product/info/list') return Response.json({ items: body.product_id[0] === 17 ? [{ id: 17 }] : [] });
    return Response.json({ result: { items: [{ product_id: body.filter.visibility === 'ALL' ? 17 : 18 }], last_id: '', total: 1 } });
  });
  const result = await gateway.getProducts('bill');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error?.code, 'OZON_PRODUCT_DETAILS_INCOMPLETE');
  assert.equal(result.raw?.response?.items, undefined);
});

test('product and offer identity conflicts across scopes or between list and details are explicit', async t => {
  const { directory } = fixture(t);
  for (const archived of [{ product_id: 17, offer_id: 'changed-offer' }, { product_id: 18, offer_id: 'original-offer' }, { id: 18, product_id: 17, offer_id: 'other' }]) {
    const gateway = new OzonBusinessGateway(directory, { fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (new URL(String(url)).pathname === '/v3/product/info/list') return Response.json({ items: [{ id: 17, offer_id: 'original-offer' }] });
      return Response.json({ result: { items: [body.filter.visibility === 'ALL' ? { product_id: 17, offer_id: 'original-offer' } : archived], last_id: '', total: 1 } });
    } });
    assert.equal((await gateway.getProducts('bill')).error?.code, 'OZON_PRODUCT_IDENTITY_CONFLICT');
  }
  const mismatch = new OzonBusinessGateway(directory, { fetchImpl: async url => new URL(String(url)).pathname === '/v3/product/list'
    ? Response.json({ result: { items: [{ product_id: 17, offer_id: 'listed' }], last_id: '' } })
    : Response.json({ items: [{ id: 17, offer_id: 'detail-other' }] }) });
  assert.equal((await mismatch.getProducts('bill')).error?.code, 'OZON_PRODUCT_IDENTITY_CONFLICT');
});

test('targeted product scan batches explicit IDs and empty target set never means all', async t => {
  const bodies: any[] = [];
  const { gateway } = fixture(t, async (url, init) => { assert.equal(new URL(String(url)).pathname, '/v3/product/info/list'); const body = JSON.parse(String(init?.body)); bodies.push(body); return Response.json({ items: (body.offer_id ?? []).map((offer_id: string) => ({ offer_id })) }); });
  assert.deepEqual((await gateway.getProducts('bill', {})).raw.response.items, []); assert.equal(bodies.length, 0);
  const result = await gateway.getProducts('bill', { offerIds: Array.from({ length: 1001 }, (_, i) => `offer-${i}`) });
  assert.equal(result.raw.response.items.length, 1001); assert.deepEqual(bodies.map(b => b.offer_id.length), [1000, 1]);
  assert.equal((await gateway.getProducts('bill', { productIds: [0] })).status, 'failed');
});

test('selected offer, product and SKU requests never expand into catalogue visibility scans', async t => {
  const requests: any[] = [];
  const { gateway } = fixture(t, async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/v3/product/info/list');
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ items: [{ id: 17, offer_id: 'selected', sku: 29 }] });
  });
  const result = await gateway.getProducts('bill', { offerIds: ['selected'], productIds: [17], skus: ['29'] });
  assert.equal(result.status, 'ok');
  assert.deepEqual(requests, [{ offer_id: ['selected'] }, { product_id: [17] }, { sku: ['29'] }]);
  assert.equal(result.raw.response.items.length, 1);
});

test('pagination loops and partial lookup failure never masquerade as complete products', async t => {
  const { directory } = fixture(t);
  const looping = new OzonBusinessGateway(directory, { fetchImpl: async url => new URL(String(url)).pathname === '/v3/product/list' ? Response.json({ result: { items: [{ product_id: 17 }], last_id: 'repeated' } }) : Response.json({ items: [{ id: 17 }] }) });
  assert.equal((await looping.getProducts('bill')).error?.code, 'OZON_PRODUCT_PAGINATION_INCOMPLETE');
  const failing = new OzonBusinessGateway(directory, { fetchImpl: async url => new URL(String(url)).pathname === '/v3/product/list' ? Response.json({ result: { items: [{ product_id: 17 }], last_id: '' } }) : Response.json({ message: 'no' }, { status: 500 }) });
  assert.equal((await failing.getProducts('bill')).status, 'unavailable');
});

test('migration script reads fixture secrets privately and does not alter legacy files or call Ozon', t => {
  const { directory } = fixture(t), sourceSecrets = join(directory, 'legacy-secrets.json'), publicStores = join(directory, 'public-stores.json');
  const secrets = JSON.stringify({ stores: { 'legacy-shop': { platform: 'ozon', ...credential, savedAt: '2026-10-10' } } });
  writeFileSync(sourceSecrets, secrets); writeFileSync(publicStores, JSON.stringify([{ id: 'legacy-shop', platform: 'ozon', shopName: 'Imported shop', currency: 'CNY', status: 'active' }]));
  const destination = join(directory, 'imported');
  const args = ['scripts/import-ozon-business-stores.mjs', '--directory', destination, '--source-connection-id', 'legacy-connection', '--secrets-file', sourceSecrets, '--stores-file', publicStores];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).imported, 1);
  for (const secret of Object.values(credential)) assert.equal((result.stdout + result.stderr).includes(secret), false);
  assert.equal(readFileSync(sourceSecrets, 'utf8'), secrets);
  const imported = new OzonBusinessGateway(destination).getStore('legacy-shop'); assert.equal(imported?.sourceConnectionId, 'legacy-connection'); assert.equal(imported?.credentialRevision, 1);
  const rerun = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true }); assert.equal(rerun.status, 0); assert.equal(new OzonBusinessGateway(destination).getStore('legacy-shop')?.revision, 1);
});
