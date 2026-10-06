import test from 'node:test';
import assert from 'node:assert/strict';
import { HallmarkClient } from '../../packages/hallmark-adapter/index.ts';
import { platformInput } from './fixtures.ts';

const response = (raw: unknown, status = 200) => new Response(JSON.stringify(raw), { status });
test('platform proxy 5xx is unknown even if it emits a syntactically complete error', async () => {
  let platforms = 0;
  const client = new HallmarkClient({ fetchImpl: (async (url) => {
    if (String(url).endsWith('/api/health')) return response({ service: 'hallmark-control' });
    platforms++; return response({ ok: false, code: 'INTERNAL_ERROR', error: 'persisting finish failed' }, 500);
  }) as typeof fetch });
  const result = await client.platformCall('task-A', { ...platformInput, path: '/v1/product/import/prices' });
  assert.equal(result.status, 'unknown'); assert.equal(result.error?.code, 'OUTCOME_UNKNOWN');
  assert.equal(result.error?.retryable, false); assert.equal(platforms, 1);
});

test('ordinary read times out separately after successful cached health', async () => {
  const client = new HallmarkClient({ readTimeoutMs: 10, fetchImpl: (async (url, init) => {
    if (String(url).endsWith('/api/health')) return response({ service: 'hallmark-control' });
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Error('timeout')), { once: true }));
  }) as typeof fetch });
  const started = Date.now(); const result = await client.getStores();
  assert.equal(result.status, 'unavailable'); assert.ok(Date.now() - started < 2000);
});

test('unrelated HTTP service cannot pass Hallmark health preflight', async () => {
  let calls = 0;
  const client = new HallmarkClient({ fetchImpl: (async () => { calls++; return response({ service: 'unrelated' }); }) as typeof fetch });
  const result = await client.getStores(); assert.equal(result.status, 'unavailable'); assert.equal(calls, 1);
});

for (const service of ['hallmark-control', 'hallmark-board']) {
  test(`${service} health permits an unauthenticated read and preserves source identity`, async () => {
    const calls: string[] = [];
    const healthRaw = { service, capabilities: ['browser-collect-v1'] };
    const client = new HallmarkClient({ baseUrl: 'http://127.0.0.1:4280', fetchImpl: (async (url, init) => {
      calls.push(String(url));
      assert.equal(new Headers(init?.headers).get('authorization'), null);
      assert.equal(init?.method, 'GET');
      return response(String(url).endsWith('/api/health') ? healthRaw : []);
    }) as typeof fetch });
    assert.deepEqual((await client.health()).raw, healthRaw);
    assert.equal((await client.getStores()).status, 'ok');
    assert.deepEqual(calls, ['http://127.0.0.1:4280/api/health', 'http://127.0.0.1:4280/api/stores']);
  });

  for (const [httpStatus, code] of [[401, 'HALLMARK_HTTP_401'], [503, 'HALLMARK_HTTP_503'], [429, 'LOCAL_RATE_LIMIT']] as const) {
    test(`${service} HTTP ${httpStatus} health still blocks data reads`, async () => {
      let calls = 0;
      const client = new HallmarkClient({ fetchImpl: (async () => {
        calls++; return response({ service }, httpStatus);
      }) as typeof fetch });
      const health = await client.health();
      assert.notEqual(health.status, 'ok');
      assert.equal(health.error?.code, code);
      assert.equal((await client.getStores()).status, 'unavailable');
      assert.equal(calls, 1);
    });
  }
}

test('board health cannot bypass a JSON rate-limit failure on HTTP 200', async () => {
  let calls = 0;
  const client = new HallmarkClient({ fetchImpl: (async () => {
    calls++; return response({ service: 'hallmark-board', code: 'LOCAL_RATE_LIMIT', retryAfterMs: 10 });
  }) as typeof fetch });
  assert.equal((await client.health()).error?.code, 'LOCAL_RATE_LIMIT');
  assert.equal((await client.getStores()).status, 'unavailable');
  assert.equal(calls, 1);
});

test('missing, non-object, and similar health identities remain rejected', async () => {
  for (const raw of [{}, [], null, { service: 'hallmark-board-other' }, { service: 'Hallmark-Board' }]) {
    let calls = 0;
    const client = new HallmarkClient({ fetchImpl: (async () => { calls++; return response(raw); }) as typeof fetch });
    assert.equal((await client.getStores()).status, 'unavailable');
    assert.equal(calls, 1);
  }
});
