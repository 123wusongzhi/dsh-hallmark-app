import test from 'node:test';
import assert from 'node:assert/strict';
import { HallmarkClient } from '../../packages/hallmark-adapter/index.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test('default health deadline allows a slow Board response but remains bounded', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let requests = 0;
  const slow = new HallmarkClient({ fetchImpl: (async (_url, init) => {
    requests++;
    return new Promise<Response>((resolve, reject) => {
      const reply = setTimeout(() => resolve(json({ service: 'hallmark-board' })), 3900);
      init?.signal?.addEventListener('abort', () => { clearTimeout(reply); reject(Error('timeout')); }, { once: true });
    });
  }) as typeof fetch });
  const slowHealth = slow.health();
  t.mock.timers.tick(3900);
  assert.equal((await slowHealth).status, 'ok');
  assert.equal(requests, 1);

  let aborted = false;
  const hung = new HallmarkClient({ fetchImpl: (async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(Error('timeout')); }, { once: true });
  })) as typeof fetch });
  const hungHealth = hung.health();
  t.mock.timers.tick(9999);
  assert.equal(aborted, false);
  t.mock.timers.tick(1);
  assert.equal((await hungHealth).status, 'unavailable');
  assert.equal(aborted, true);
});

test('concurrent health checks share a probe and transient failure expires after one second', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let healthRequests = 0;
  let businessRequests = 0;
  let reply!: (response: Response) => void;
  const client = new HallmarkClient({ fetchImpl: (async url => {
    if (new URL(String(url)).pathname !== '/api/health') { businessRequests++; return json([]); }
    healthRequests++;
    return healthRequests === 1 ? new Promise<Response>(resolve => { reply = resolve; }) : json({ service: 'hallmark-board' });
  }) as typeof fetch });
  const first = client.getStores();
  const concurrent = client.getStores();
  assert.equal(healthRequests, 1);
  reply(json({ code: 'SOURCE_BUSY', error: 'Board is busy' }, 503));
  const failures = await Promise.all([first, concurrent]);
  for (const failure of failures) {
    assert.equal(failure.status, 'unavailable');
    assert.equal(failure.error?.code, 'SOURCE_BUSY');
  }
  assert.equal(businessRequests, 0);
  t.mock.timers.tick(999);
  assert.equal((await client.getStores()).status, 'unavailable');
  assert.equal(healthRequests, 1);
  t.mock.timers.tick(1);
  assert.equal((await client.getStores()).status, 'ok');
  assert.equal(healthRequests, 2);
  assert.equal(businessRequests, 1);
});

test('an in-flight forced probe takes precedence over an earlier cached success', async () => {
  let healthRequests = 0;
  let businessRequests = 0;
  let reply!: (response: Response) => void;
  const client = new HallmarkClient({ fetchImpl: (async url => {
    if (new URL(String(url)).pathname !== '/api/health') { businessRequests++; return json([]); }
    healthRequests++;
    return healthRequests === 1 ? json({ service: 'hallmark-board' }) : new Promise<Response>(resolve => { reply = resolve; });
  }) as typeof fetch });
  assert.equal((await client.health()).status, 'ok');
  const forced = client.health(true);
  const read = client.getStores();
  assert.equal(healthRequests, 2);
  assert.equal(businessRequests, 0);
  reply(json({ code: 'AUTH_REVOKED', error: 'Health authorization was revoked' }, 401));
  assert.equal((await forced).error?.code, 'AUTH_REVOKED');
  const refused = await read;
  assert.equal(refused.status, 'failed');
  assert.equal(refused.error?.code, 'AUTH_REVOKED');
  assert.equal(refused.error?.retryable, false);
  assert.equal(businessRequests, 0);
});

test('successful health retains its cache interval and a shorter explicit failure cache is honored', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let requests = 0;
  const healthy = new HallmarkClient({ fetchImpl: (async () => { requests++; return json({ service: 'hallmark-control' }); }) as typeof fetch });
  assert.equal((await healthy.health()).status, 'ok');
  t.mock.timers.tick(9999);
  assert.equal((await healthy.health()).status, 'ok');
  assert.equal(requests, 1);
  t.mock.timers.tick(1);
  assert.equal((await healthy.health()).status, 'ok');
  assert.equal(requests, 2);

  let failures = 0;
  const shortCache = new HallmarkClient({ healthCacheMs: 200, fetchImpl: (async () => { failures++; return json({ error: 'unavailable' }, 503); }) as typeof fetch });
  assert.equal((await shortCache.health()).status, 'unavailable');
  t.mock.timers.tick(199);
  assert.equal((await shortCache.health()).status, 'unavailable');
  assert.equal(failures, 1);
  t.mock.timers.tick(1);
  assert.equal((await shortCache.health()).status, 'unavailable');
  assert.equal(failures, 2);
});

test('wrong service identity and health authorization errors never dispatch a write', async () => {
  for (const fixture of [
    { raw: { service: 'other-service' }, httpStatus: 200, status: 'unavailable', code: 'HALLMARK_UNAVAILABLE', message: '健康响应不是 Hallmark Control 或 Hallmark Board' },
    { raw: { code: 'AUTH_REQUIRED', error: 'Health authorization required' }, httpStatus: 401, status: 'failed', code: 'AUTH_REQUIRED', message: 'Health authorization required' },
  ]) {
    const requests: string[] = [];
    const client = new HallmarkClient({ fetchImpl: (async url => {
      const path = new URL(String(url)).pathname;
      requests.push(path);
      assert.equal(path, '/api/health');
      return json(fixture.raw, fixture.httpStatus);
    }) as typeof fetch });
    const result = await client.platformCall('task-A', { requestId: 'write-A', agentId: 'agent-A', path: '/v1/product/import/prices', body: {} });
    assert.equal(result.status, fixture.status);
    assert.equal(result.error?.code, fixture.code);
    assert.equal(result.error?.message, fixture.message);
    assert.deepEqual(requests, ['/api/health']);
  }
});
