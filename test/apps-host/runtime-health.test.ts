import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppsHost, RuntimeHealthMonitor, classifyProbeFailure, labelRuntimeDown, type AppsHostTransport, type AppsPluginContext, type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const refused = () => Object.assign(new TypeError('fetch failed'), {cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4181'), {code: 'ECONNREFUSED'})});
function probeFixture() {
  const state = {mode: 'ok' as 'ok' | 'refused' | 'hang' | 'bad-status' | 'slow', calls: 0}, rows: Record<string, unknown>[] = [];
  const probe = async (signal: AbortSignal) => {
    state.calls++;
    if (state.mode === 'refused') throw refused();
    if (state.mode === 'hang') return new Promise<never>((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})), {once: true}));
    if (state.mode === 'bad-status') return {status: 'starting'};
    if (state.mode === 'slow') {await sleep(30);}
    return {status: 'ok', version: '1.0.0-test', observability: {eventLoop: {lastMaxMs: 12, maxMsSinceStart: 900}, requests: {inFlight: 2}}};
  };
  const monitor = new RuntimeHealthMonitor({probe, timeoutMs: 40, slowMs: 25, log: row => rows.push(row)});
  return {state, rows, monitor};
}

test('health monitor: unknown → healthy → degraded → down after consecutive failures, and back to healthy with the downtime logged', async () => {
  const {state, rows, monitor} = probeFixture();
  assert.equal(monitor.state, 'unknown');assert.equal(monitor.snapshot().recovering, false);
  await monitor.check();assert.equal(monitor.state, 'healthy');
  assert.deepEqual(monitor.snapshot().runtime, {version: '1.0.0-test', eventLoopLastMaxMs: 12, eventLoopMaxMsSinceStart: 900, inFlight: 2});
  state.mode = 'refused';
  await monitor.check();assert.equal(monitor.state, 'degraded');assert.equal(monitor.snapshot().consecutiveFailures, 1);assert.equal(monitor.snapshot().recovering, false);
  await monitor.check();assert.equal(monitor.state, 'degraded');
  await monitor.check();assert.equal(monitor.state, 'down');
  const down = monitor.snapshot();
  assert.equal(down.consecutiveFailures, 3);assert.equal(down.failureKind, 'unreachable');assert.equal(down.lastError?.code, 'RUNTIME_CONNECTION_LOST');assert.equal(down.recovering, false);assert.ok(down.downSince);
  assert.deepEqual(down.restart, {enabled: false, reason: 'NO_LAUNCH_SPEC'});
  await sleep(5);state.mode = 'ok';
  await monitor.check();assert.equal(monitor.state, 'healthy');assert.equal(monitor.snapshot().consecutiveFailures, 0);assert.equal(monitor.snapshot().downSince, null);
  assert.deepEqual(rows.map(row => `${row.from}>${row.to}`), ['unknown>healthy', 'healthy>degraded', 'degraded>down', 'down>healthy']);
  assert.equal(typeof rows[3].downForMs, 'number');assert.equal(rows[2].failureKind, 'unreachable');assert.equal(rows[2].code, 'RUNTIME_CONNECTION_LOST');
});

test('health monitor: a hung Runtime is unresponsive (timeout), a bad status is unhealthy, a slow answer degrades without failing', async () => {
  const {state, monitor} = probeFixture();
  state.mode = 'hang';await monitor.check();
  assert.equal(monitor.snapshot().lastError?.code, 'RUNTIME_REQUEST_TIMEOUT');assert.equal(monitor.snapshot().failureKind, 'unresponsive');
  state.mode = 'bad-status';await monitor.check();assert.equal(monitor.snapshot().lastError?.code, 'RUNTIME_UNHEALTHY');assert.equal(monitor.snapshot().consecutiveFailures, 2);
  state.mode = 'slow';await monitor.check();
  assert.equal(monitor.state, 'degraded');assert.equal(monitor.snapshot().consecutiveFailures, 0, 'a slow success is not a failure');
  state.mode = 'ok';await monitor.check();assert.equal(monitor.state, 'healthy');
  assert.equal(classifyProbeFailure(Object.assign(new Error('x'), {statusCode: 503})).code, 'RUNTIME_HTTP_503');
});

test('health monitor: concurrent checks share one probe; start() never overlaps probes and stop() ends polling', async () => {
  const {state, monitor} = probeFixture();
  await Promise.all([monitor.check(), monitor.check(), monitor.check()]);assert.equal(state.calls, 1);
  let active = 0, peak = 0, calls = 0;
  const polled = new RuntimeHealthMonitor({intervalMs: 10, probe: async () => {calls++;active++;peak = Math.max(peak, active);await sleep(15);active--;return {status: 'ok'};}});
  polled.start();await sleep(120);polled.stop();const stoppedAt = calls;await sleep(60);
  assert.ok(stoppedAt >= 3, `polled ${stoppedAt}`);assert.equal(peak, 1);assert.equal(calls, stoppedAt, 'no probes after stop');assert.equal(polled.snapshot().monitoring, false);
});

test('down label: only transport-class failures of a down Runtime are relabelled; restarting needs a restarter', async () => {
  const {state, monitor} = probeFixture();
  assert.equal(labelRuntimeDown(monitor, {}), undefined);
  state.mode = 'refused';for (let index = 0; index < 3; index++) await monitor.check();
  assert.equal(labelRuntimeDown(monitor, {code: 'RUNTIME_CONNECTION_LOST'})?.code, 'RUNTIME_DOWN');
  assert.equal(labelRuntimeDown(monitor, {})?.code, 'RUNTIME_DOWN');
  assert.equal(labelRuntimeDown(monitor, {code: 'BRIDGE_IDENTITY_STALE'}), undefined, 'an explicit server answer proves the Runtime is alive');
  assert.equal(labelRuntimeDown(monitor, {code: 'RUNTIME_INVALID_RESPONSE', httpStatus: 404}), undefined);
  monitor.markRestarting(true);
  assert.equal(labelRuntimeDown(monitor, {code: 'RUNTIME_REQUEST_TIMEOUT'})?.code, 'RUNTIME_RESTARTING');
  assert.deepEqual(monitor.snapshot().restart, {enabled: true, restarting: true});
});

function context() {
  const agent = {id: 'A'}, routes = new Map<string, {fetch(request: Request): Promise<Response>}>();
  const ctx = {tools: {register(_tool: NativeGatewayTool) {return () => {};}}, agents: {get: (id: string) => id === 'A' ? agent : undefined}, sessions: {get: (id: string) => id === 'A' ? agent : undefined}, connection: {fetch: {register(route: {path: string; fetch(request: Request): Promise<Response>}) {routes.set(route.path, route);return async () => {routes.delete(route.path);};}}}, systemPrompt: {context() {return () => {};}}} as unknown as AppsPluginContext;
  return {ctx, route: () => routes.get('/api/dsh-apps')!};
}
function hostFixture(overrides: Partial<AppsHostTransport> = {}) {
  const calls = {viewData: 0, extension: 0, bridge: 0};
  const transport = {
    async identity() {return {transportMajor: 1, catalogSchemaVersion: 1, catalogDigest: 'digest'};}, async listApps() {return [];},
    async viewData() {calls.viewData++;throw refused();},
    async componentExtension() {calls.extension++;throw Object.assign(new Error('RUNTIME_CONNECTION_LOST'), {statusCode: 502, details: {status: 'failed', error: {code: 'RUNTIME_CONNECTION_LOST', message: '与 Runtime 的连接中断，进程是否退出尚未确认。', retryPolicy: 'read_retry', details: {requestId: 'ext-1', runtimeRequestId: 'rt-ext-1', attempts: 2}}}});},
    async componentBridge() {calls.bridge++;throw Object.assign(refused(), {requestId: 'rt-bridge-1'});},
    ...overrides,
  } as unknown as AppsHostTransport;
  const rows: Record<string, unknown>[] = [], {state, monitor} = probeFixture(), fixture = context();
  const host = new AppsHost(fixture.ctx, transport, undefined, {health: monitor, log: row => rows.push(row)});
  const get = (query: string) => fixture.route().fetch(new Request(`http://dsh.local/api/dsh-apps?${query}`));
  const post = (body: unknown) => fixture.route().fetch(new Request('http://dsh.local/api/dsh-apps', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}));
  return {host, rows, state, monitor, calls, get, post, start: async () => {await host.start();await sleep(15);}};
}
const VIEW_QUERY = 'resource=viewData&sessionId=A&viewId=V1&publicationId=P1&displayId=D1&displayGeneration=2&buildId=B1';
const bridgeRequest = (method: string, params: Record<string, unknown>) => ({action: 'componentBridge', request: {protocolVersion: '2.0', sessionId: 'A', viewId: 'V1', buildId: 'B1', frameInstanceId: 'F1', requestId: 'comp-1', method, params}});

test('Host proxy failures are logged with Runtime request id, code, status, duration and identifiers', async () => {
  const f = hostFixture();await f.start();
  try {
    const response = await f.get(VIEW_QUERY), body = await response.json() as {error: {code: string; retryPolicy: string}};
    assert.equal(response.status, 503);assert.equal(body.error.code, 'RUNTIME_CONNECTION_LOST');assert.equal(body.error.retryPolicy, 'read_retry');
    const row = f.rows.find(item => item.event === 'host_proxy_failed' && item.surface === 'viewData')!;
    assert.ok(row);
    assert.deepEqual({code: row.code, status: row.status, retryPolicy: row.retryPolicy, sessionId: row.sessionId, viewId: row.viewId, displayId: row.displayId, publicationId: row.publicationId, buildId: row.buildId, runtimeState: row.runtimeState}, {code: 'RUNTIME_CONNECTION_LOST', status: 503, retryPolicy: 'read_retry', sessionId: 'A', viewId: 'V1', displayId: 'D1', publicationId: 'P1', buildId: 'B1', runtimeState: f.monitor.state});
    assert.equal(typeof row.durationMs, 'number');assert.match(String(row.cause), /ECONNREFUSED/);

    const extension = await f.post({action: 'componentExtension', request: {sessionId: 'A', viewId: 'V1', buildId: 'B1', frameInstanceId: 'F1', requestId: 'comp-ext', feature: 'dataTransferV1', action: 'read', params: {documentNonce: 'NONCE-SECRET', rows: ['PAYLOAD-SECRET']}}});
    assert.equal(extension.status, 502);
    const extRow = f.rows.find(item => item.surface === 'extension')!;
    assert.deepEqual({action: extRow.action, requestId: extRow.requestId, attempts: extRow.attempts, httpStatus: extRow.httpStatus, componentRequestId: extRow.componentRequestId, code: extRow.code}, {action: 'dataTransferV1.read', requestId: 'ext-1', attempts: 2, httpStatus: 502, componentRequestId: 'comp-ext', code: 'RUNTIME_CONNECTION_LOST'});

    const bridge = await f.post(bridgeRequest('getData', {displayId: 'D1', publicationId: 'P1', rows: [{price: 'PAYLOAD-SECRET'}], note: 'NONCE-SECRET'}));
    assert.equal(bridge.status, 200);
    const bridgeRow = f.rows.find(item => item.surface === 'bridge')!;
    assert.deepEqual({action: bridgeRow.action, requestId: bridgeRow.requestId, displayId: bridgeRow.displayId, publicationId: bridgeRow.publicationId, componentRequestId: bridgeRow.componentRequestId}, {action: 'getData', requestId: 'rt-bridge-1', displayId: 'D1', publicationId: 'P1', componentRequestId: 'comp-1'});

    const serialized = JSON.stringify(f.rows);
    assert.equal(serialized.includes('PAYLOAD-SECRET'), false);assert.equal(serialized.includes('NONCE-SECRET'), false);
  } finally {await f.host.dispose();}
});

test('while the Runtime is down, transport failures say RUNTIME_DOWN with read_retry; server answers and writes keep their own policy', async () => {
  const f = hostFixture();await f.start();
  try {
    f.state.mode = 'refused';for (let index = 0; index < 3; index++) await f.monitor.check();assert.equal(f.monitor.state, 'down');
    const read = await f.get(VIEW_QUERY), readBody = await read.json() as {error: {code: string; message: string; retryPolicy: string; details: {runtimeHealth: {state: string}; requestId?: string}}};
    assert.equal(read.status, 503);assert.equal(readBody.error.code, 'RUNTIME_DOWN');assert.equal(readBody.error.retryPolicy, 'read_retry');assert.match(readBody.error.message, /Runtime/);assert.equal(readBody.error.details.runtimeHealth.state, 'down');
    const logged = f.rows.filter(item => item.event === 'host_proxy_failed').at(-1)!;assert.equal(logged.code, 'RUNTIME_DOWN');assert.equal(logged.runtimeCode, 'RUNTIME_CONNECTION_LOST');assert.equal(logged.runtimeState, 'down');

    const extension = await f.post({action: 'componentExtension', request: {sessionId: 'A', viewId: 'V1', buildId: 'B1', frameInstanceId: 'F1', requestId: 'comp-ext', feature: 'dataTransferV1', action: 'read', params: {}}}), extensionBody = await extension.json() as {error: {code: string; retryPolicy: string; details: {attempts: number; runtimeCode: string}}};
    assert.equal(extension.status, 502);assert.equal(extensionBody.error.code, 'RUNTIME_DOWN');assert.equal(extensionBody.error.retryPolicy, 'read_retry');assert.equal(extensionBody.error.details.attempts, 2, 'original evidence is kept');assert.equal(extensionBody.error.details.runtimeCode, 'RUNTIME_CONNECTION_LOST');

    const readBridge = await (await f.post(bridgeRequest('getData', {}))).json() as {error: {code: string; retryPolicy: string; details: {runtimeHealth: {state: string}}}};
    assert.equal(readBridge.error.code, 'RUNTIME_DOWN');assert.equal(readBridge.error.retryPolicy, 'read_retry');assert.equal(readBridge.error.details.runtimeHealth.state, 'down');
    const writeBridge = await (await f.post(bridgeRequest('invokeCapability', {appId: 'hallmark', capabilityId: 'hallmark.plan.submit', idempotencyKey: 'k1'}))).json() as {error: {code: string; retryPolicy: string}};
    assert.equal(writeBridge.error.code, 'RUNTIME_DOWN');assert.equal(writeBridge.error.retryPolicy, 'inspect_only', 'a possible write is never marked retryable');

    f.monitor.markRestarting(true);
    assert.equal(((await (await f.get(VIEW_QUERY)).json()) as {error: {code: string}}).error.code, 'RUNTIME_RESTARTING');
  } finally {await f.host.dispose();}
});

test('a real server answer is never relabelled while the monitor says down', async () => {
  const f = hostFixture({async viewData() {throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'), {statusCode: 409, requestId: 'srv-9', details: {status: 'failed', error: {code: 'BRIDGE_IDENTITY_STALE', message: 'stale', retryPolicy: 'never'}}});}});
  await f.start();
  try {
    f.state.mode = 'refused';for (let index = 0; index < 3; index++) await f.monitor.check();
    const response = await f.get(VIEW_QUERY), body = await response.json() as {error: {code: string; retryPolicy: string}};
    assert.equal(response.status, 409);assert.equal(body.error.code, 'BRIDGE_IDENTITY_STALE');assert.equal(body.error.retryPolicy, 'never');
  } finally {await f.host.dispose();}
});

test('runtimeHealth resource answers from the cached monitor without calling the Runtime; Host starts and stops the monitor', async () => {
  const f = hostFixture();
  assert.equal(f.state.calls, 0);await f.host.start();await sleep(15);
  assert.ok(f.state.calls >= 1, 'monitor polls while the Host is active');
  f.state.mode = 'refused';for (let index = 0; index < 3; index++) await f.monitor.check();
  const before = {viewData: f.calls.viewData, extension: f.calls.extension, bridge: f.calls.bridge}, probes = f.state.calls;
  const status = await f.get('resource=runtimeHealth'), body = await status.json() as {state: string; recovering: boolean; monitoring: boolean; restart: {enabled: boolean; reason?: string}; lastError: {code: string}; thresholds: {downAfter: number}};
  assert.equal(status.status, 200);
  assert.deepEqual({state: body.state, recovering: body.recovering, monitoring: body.monitoring, restart: body.restart, code: body.lastError.code, downAfter: body.thresholds.downAfter}, {state: 'down', recovering: false, monitoring: true, restart: {enabled: false, reason: 'NO_LAUNCH_SPEC'}, code: 'RUNTIME_CONNECTION_LOST', downAfter: 3});
  assert.deepEqual({viewData: f.calls.viewData, extension: f.calls.extension, bridge: f.calls.bridge}, before);assert.equal(f.state.calls, probes, 'reading the status does not probe');
  assert.equal((await f.get('resource=runtimeHealth&sessionId=A')).status, 400, 'unknown parameters are rejected like other resources');
  await f.host.dispose();
  const stopped = f.state.calls;await sleep(30);assert.equal(f.state.calls, stopped);assert.equal(f.monitor.snapshot().monitoring, false);
});

test('without a monitor the status resource reports unmonitored and errors keep their original codes', async () => {
  const fixture = context(), transport = {async identity() {return {transportMajor: 1, catalogSchemaVersion: 1, catalogDigest: 'd'};}, async listApps() {return [];}, async viewData() {throw refused();}} as unknown as AppsHostTransport;
  const host = new AppsHost(fixture.ctx, transport);await host.start();
  try {
    const status = await (await fixture.route().fetch(new Request('http://dsh.local/api/dsh-apps?resource=runtimeHealth'))).json() as {monitoring: boolean; state: string};
    assert.deepEqual(status, {monitoring: false, state: 'unknown', recovering: false} as typeof status);
    const response = await fixture.route().fetch(new Request(`http://dsh.local/api/dsh-apps?${VIEW_QUERY}`));
    assert.equal(((await response.json()) as {error: {code: string}}).error.code, 'RUNTIME_CONNECTION_LOST');
  } finally {await host.dispose();}
});

test('real HTTP: the shallow probe sees a killed Runtime as unreachable and recovers when a new one listens on the same port', async () => {
  const {createServer} = await import('node:http'), {HttpAppsHostTransport} = await import('../../packages/plugin-apps/src/index.ts');
  const seen: {url?: string; authorization?: string}[] = [], token = 'c'.repeat(64);
  const make = () => createServer((req, res) => {seen.push({url: req.url, authorization: req.headers.authorization});res.setHeader('content-type', 'application/json');res.end(JSON.stringify({status: 'ok', version: 'live-1', observability: {eventLoop: {lastMaxMs: 3}}}));});
  let server = make();await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as {port: number}).port, transport = new HttpAppsHostTransport(`http://127.0.0.1:${port}`, token), monitor = new RuntimeHealthMonitor({probe: signal => transport.health(signal), timeoutMs: 500});
  try {
    await monitor.check();assert.equal(monitor.state, 'healthy');assert.deepEqual(seen[0], {url: '/health?shallow=1', authorization: `Bearer ${token}`});assert.equal(monitor.snapshot().runtime?.version, 'live-1');
    server.closeAllConnections();await new Promise<void>(resolve => server.close(() => resolve()));
    for (let index = 0; index < 3; index++) await monitor.check();
    assert.equal(monitor.state, 'down');assert.equal(monitor.snapshot().failureKind, 'unreachable');assert.equal(monitor.snapshot().lastError?.code, 'RUNTIME_CONNECTION_LOST');
    server = make();await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
    await monitor.check();assert.equal(monitor.state, 'healthy');assert.equal(monitor.snapshot().consecutiveFailures, 0);
  } finally {server.closeAllConnections();await new Promise<void>(resolve => server.close(() => resolve()));}
});


test('health monitor rejects malformed JSON shapes and missing status instead of reporting recovery',async()=>{
 for(const response of [null,undefined,true,'ok',[],{}, {version:'1.0'}]){
  const monitor=new RuntimeHealthMonitor({probe:async()=>response,downAfter:1});
  const snapshot=await monitor.check();assert.equal(snapshot.state,'down');assert.equal(snapshot.lastError?.code,'RUNTIME_INVALID_RESPONSE');assert.equal(snapshot.lastOkAt,null);
 }
});
