import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import fs, {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {AsyncJsonlLog, RequestObserver, routeKind} from '../../packages/service/src/request-log.ts';

const token = 'b'.repeat(64);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function listening(server: ReturnType<typeof createServer>): Promise<string> {await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));const address = server.address();if (!address || typeof address === 'string') throw new Error('PORT_REQUIRED');return `http://127.0.0.1:${address.port}`;}
async function closed(server: ReturnType<typeof createServer>) {server.closeAllConnections();await new Promise<void>(resolve => server.close(() => resolve()));}
const lines = (directory: string, prefix: string) => readdirSync(directory).filter(name => name.startsWith(prefix)).sort().flatMap(name => readFileSync(join(directory, name), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>));

test('route kinds collapse identifiers into low-cardinality names', () => {
  assert.equal(routeKind('GET', '/v1/views/7d199700-3159-4a23-8944-c5cd489a58b0/data'), 'GET /v1/views/:viewId/data');
  assert.equal(routeKind('POST', '/v1/authoring/openDisplay'), 'POST /v1/authoring/openDisplay');
  assert.equal(routeKind('POST', '/v1/results/result:abc/read'), 'POST /v1/results/:resultRef/read');
  assert.equal(routeKind('GET', `/source-builds/${'a'.repeat(64)}/files/index.html`), 'GET /source-builds/:buildId/files');
  assert.equal(routeKind('GET', '/v1/operations/op-1/inspect'), 'GET /v1/operations/:operationId/inspect');
});

test('async log buffers lines, appends them in one asynchronous write and never touches sync fs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'request-log-'));
  const appendSync = mock.method(fs, 'appendFileSync'), mkdirSyncSpy = mock.method(fs, 'mkdirSync');syncBuiltinESMExports();
  try {
    const log = new AsyncJsonlLog({directory, prefix: 'requests-', now: () => new Date('2026-10-15T08:00:00Z')});
    for (let index = 0; index < 500; index++) log.write({event: 'runtime_request', index});
    assert.deepEqual(readdirSync(directory), [], 'write() alone must not touch the disk');
    assert.equal(log.stats().bufferedBytes > 0, true);
    await log.flush();await log.close();
    assert.equal(appendSync.mock.callCount(), 0);assert.equal(mkdirSyncSpy.mock.callCount(), 0);
    assert.deepEqual(readdirSync(directory), ['requests-2026-10-15.jsonl']);
    const rows = lines(directory, 'requests-');assert.equal(rows.length, 500);assert.equal(rows[499].index, 499);
    assert.equal(log.stats().written, 500);
  } finally {appendSync.mock.restore();mkdirSyncSpy.mock.restore();syncBuiltinESMExports();rmSync(directory, {recursive: true, force: true});}
});

test('async log rolls by size, keeps the newest files of its own prefix only, and reports overflow instead of growing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'request-log-rotate-'));
  try {
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) writeFileSync(join(directory, `requests-${day}.jsonl`), '{}\n');
    writeFileSync(join(directory, '2026-10-01.jsonl'), '{"event":"invocation"}\n');writeFileSync(join(directory, 'host-2026-10-01.jsonl'), '{}\n');
    const log = new AsyncJsonlLog({directory, prefix: 'requests-', maxFiles: 3, maxFileBytes: 400, now: () => new Date('2026-10-15T08:00:00Z')});
    for (let batch = 0; batch < 3; batch++) {for (let index = 0; index < 5; index++) log.write({event: 'runtime_request', batch, index, pad: 'x'.repeat(40)});await log.flush();}
    await log.close();
    const names = readdirSync(directory).sort();
    assert.deepEqual(names.filter(name => name.startsWith('requests-')), ['requests-2026-10-15.1.jsonl', 'requests-2026-10-15.2.jsonl', 'requests-2026-10-15.jsonl'].sort());
    assert.ok(names.includes('2026-10-01.jsonl') && names.includes('host-2026-10-01.jsonl'), 'files of other prefixes are never pruned');
    assert.equal(lines(directory, 'requests-2026-10-15').length, 15);

    const overflow = new AsyncJsonlLog({directory: join(directory, 'overflow'), maxBufferBytes: 300, now: () => new Date('2026-10-15T08:00:00Z')});
    for (let index = 0; index < 10; index++) overflow.write({event: 'x', pad: 'y'.repeat(60)});
    assert.ok(overflow.stats().dropped > 0);await overflow.close();
    assert.ok(lines(join(directory, 'overflow'), '').some(row => row.event === 'log_dropped'));
  } finally {rmSync(directory, {recursive: true, force: true});}
});

test('async log survives a failing disk: errors are counted, never thrown, and later writes recover', async () => {
  let fail = true;const appended: string[] = [];
  const log = new AsyncJsonlLog({directory: 'unused', io: {mkdir: async () => {}, list: async () => [], size: async () => 0, append: async (_path, data) => {if (fail) throw new Error('EIO: simulated');appended.push(data);}, remove: async () => {}}});
  log.write({event: 'a'});await log.flush();assert.equal(log.stats().errors, 1);assert.match(log.stats().lastError ?? '', /EIO/);
  fail = false;log.write({event: 'b'});await log.flush();assert.equal(appended.length, 1);assert.match(appended[0], /"event":"b"/);
});

async function failureServer() {
  const directory = mkdtempSync(join(tmpdir(), 'request-log-server-')), instance = composeAppsRuntime(directory, {connections: [], legacyHallmarkConnectionId: undefined as unknown as string});
  const log = new AsyncJsonlLog({directory: join(directory, 'logs'), prefix: 'requests-', flushIntervalMs: 20}), observer = new RequestObserver({log, slowMs: 60000});
  const server = createAppsServer({...instance, token, observer, log: () => {}}), url = await listening(server);
  const call = (path: string, input?: unknown, headers: Record<string, string> = {}) => fetch(new URL(path, url), {method: input === undefined ? 'GET' : 'POST', headers: {Authorization: `Bearer ${token}`, ...headers, ...(input === undefined ? {} : {'Content-Type': 'application/json'})}, ...(input === undefined ? {} : {body: JSON.stringify(input)})});
  return {instance, directory, observer, log, call, rows: async () => {for (let waited = 0; (observer.stats().requests as {inFlight: number}).inFlight > 0 && waited < 1000; waited += 5) await sleep(5);await log.flush();return lines(join(directory, 'logs'), 'requests-');}, cleanup: async () => {observer.stop();await closed(server);await log.close();await instance.close();rmSync(directory, {recursive: true, force: true});}};
}

test('request line carries route, ids, status, code, duration and bytes; no tokens or payload; no sync fs on the request path', async () => {
  const appendSync = mock.method(fs, 'appendFileSync');syncBuiltinESMExports();
  const ctx = await failureServer();
  try {
    const presentation = ctx.instance.presentation as unknown as Record<string, unknown>;presentation.ownedView = () => ({viewId: 'V'});
    presentation.getData = () => {throw new TypeError('Cannot read properties of undefined (reading rows)');};
    const read = await ctx.call('/v1/views/V/data?sessionId=s1&displayGeneration=3&publicationId=P1&buildId=B1', undefined, {'X-Request-Id': 'host-req-1'});
    assert.equal(read.status, 503);await read.text();
    // The body carries a secret-looking payload; only identifier fields may reach the log.
    const secret = 'SECRET-PAYLOAD-4711';
    presentation.ownedView = () => {throw Object.assign(new Error('VIEW_NOT_OWNED'), {code: 'VIEW_NOT_OWNED'});};
    const bridge = await ctx.call('/v1/component-bridge', {channel: 'dsh.apps.component.v2', protocolVersion: '2.0', sessionId: 's2', viewId: 'V2', buildId: 'B2', frameInstanceId: 'F2', requestId: 'comp-req-9', method: 'getData', params: {viewId: 'V2', displayId: 'D2', note: secret, rows: [{price: secret}]}});
    assert.equal(bridge.status, 400);await bridge.text();
    const health = await (await ctx.call('/health?shallow=1')).json() as {hallmark: {status: string}; observability: {eventLoop: Record<string, unknown>; requests: {total: number}}};
    assert.equal(health.hallmark.status, 'skipped');assert.equal(typeof health.observability.eventLoop.thresholdMs, 'number');assert.ok(health.observability.requests.total >= 2);
    const rows = await ctx.rows(), first = rows.find(row => row.requestId === 'host-req-1')!, second = rows.find(row => row.requestId !== 'host-req-1' && row.route === '/v1/component-bridge')!;
    assert.deepEqual({event: first.event, method: first.method, route: first.route, status: first.status, code: first.code, sessionId: first.sessionId, displayGeneration: first.displayGeneration, publicationId: first.publicationId, buildId: first.buildId}, {event: 'runtime_request', method: 'GET', route: '/v1/views/:viewId/data', status: 503, code: 'RUNTIME_INTERNAL_ERROR', sessionId: 's1', displayGeneration: 3, publicationId: 'P1', buildId: 'B1'});
    assert.equal(typeof first.durationMs, 'number');assert.ok((first.bytes as number) > 0);
    assert.deepEqual({status: second.status, code: second.code, sessionId: second.sessionId, viewId: second.viewId, bridgeMethod: second.bridgeMethod, componentRequestId: second.componentRequestId, displayId: second.displayId}, {status: 400, code: 'VIEW_NOT_OWNED', sessionId: 's2', viewId: 'V2', bridgeMethod: 'getData', componentRequestId: 'comp-req-9', displayId: 'D2'});
    assert.equal(rows.some(row => row.route === '/health'), false, 'fast successful health probes are counted, not written');
    const text = readdirSync(join(ctx.directory, 'logs')).map(name => readFileSync(join(ctx.directory, 'logs', name), 'utf8')).join('');
    assert.equal(text.includes(secret), false);assert.equal(text.includes(token), false);assert.equal(/authorization/i.test(text), false);
    assert.equal(appendSync.mock.callCount(), 0, 'no appendFileSync while serving requests');
  } finally {await ctx.cleanup();appendSync.mock.restore();syncBuiltinESMExports();}
});

test('event-loop stall is logged with the request that was in flight', async () => {
  const rows: Record<string, unknown>[] = [], observer = new RequestObserver({log: {write: row => rows.push(row)}, lagThresholdMs: 100, lagIntervalMs: 50, resolutionMs: 5});
  const server = createServer(async (req, res) => {observer.begin(req, res, 'stalled-req-1');const until = Date.now() + 400;while (Date.now() < until);await sleep(150);res.end('{}');});
  const url = await listening(server);observer.start();
  try {
    await fetch(`${url}/v1/views/V9/data?sessionId=sess-9&viewId=V9`);await sleep(60);
    const lag = rows.find(row => row.event === 'event_loop_lag') as {maxMs: number; thresholdMs: number; inFlight: {requestId: string; route: string; sessionId?: string; elapsedMs: number}[]} | undefined;
    assert.ok(lag, 'a stall line is written');assert.ok(lag.maxMs >= 300, `maxMs ${lag.maxMs}`);assert.equal(lag.thresholdMs, 100);
    assert.equal(lag.inFlight[0].requestId, 'stalled-req-1');assert.equal(lag.inFlight[0].route, 'GET /v1/views/:viewId/data');assert.equal(lag.inFlight[0].sessionId, 'sess-9');
    const stats = observer.stats().eventLoop as {lagEvents: number; maxMsSinceStart: number};assert.ok(stats.lagEvents >= 1);assert.ok(stats.maxMsSinceStart >= 300);
    const finished = rows.find(row => row.event === 'runtime_request');assert.equal(finished?.requestId, 'stalled-req-1');
  } finally {observer.stop();await closed(server);}
});

test('a stall that ended before the sample still names the requests that overlapped it', async () => {
  const rows: Record<string, unknown>[] = [];let clock = 0;
  const observer = new RequestObserver({log: {write: row => rows.push(row)}, lagThresholdMs: 100, lagIntervalMs: 1000, now: () => clock});
  const server = createServer((req, res) => {observer.begin(req, res, 'finished-in-stall');clock += 900;res.end('{}');});
  const url = await listening(server);
  try {
    await fetch(`${url}/v1/operations/op-7/inspect`);await sleep(30);clock += 1500;
    const sampled = observer.sample();assert.equal(sampled.stalled, true);
    const lag = rows.find(row => row.event === 'event_loop_lag') as {completedDuring: {requestId: string; route: string; durationMs: number}[]};
    assert.equal(lag.completedDuring[0].requestId, 'finished-in-stall');assert.equal(lag.completedDuring[0].route, 'POST /v1/operations/:operationId/inspect'.replace('POST', 'GET'));assert.ok(lag.completedDuring[0].durationMs >= 900);
  } finally {observer.stop();await closed(server);}
});

test('invocation events keep their daily file and format, appended asynchronously and flushed on close', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'invocation-log-')), appendSync = mock.method(fs, 'appendFileSync');syncBuiltinESMExports();
  const instance = composeAppsRuntime(directory, {connections: [{appId: 'notes', connectionId: 'n', displayName: 'Notes', config: {backend: 'local:notes-fixture'}, enabled: true, configRevision: 1}], legacyHallmarkConnectionId: undefined as unknown as string});
  try {
    instance.runtime.bind({sessionId: 's', appId: 'notes', connectionId: 'n', enabled: true, boundAt: new Date().toISOString()});
    const result = await instance.runtime.invoke({protocolVersion: '1.0', invocationId: 'inv-log-1', traceId: 'trace-log-1', appId: 'notes', connectionId: 'n', capabilityId: 'notes.notes.list', capabilityVersion: '1.0.0', input: {}, source: {kind: 'agent', sessionId: 's', nativeCallId: 'c1'}, deadlineAt: new Date(Date.now() + 30000).toISOString()});
    assert.equal(result.status, 'ok');
    assert.equal(appendSync.mock.callCount(), 0, 'invocation logging no longer appends synchronously');
    await instance.close();
    const rows = lines(join(directory, 'logs'), '').filter(row => row.invocationId === 'inv-log-1');
    assert.ok(rows.length >= 1);assert.equal(readdirSync(join(directory, 'logs')).every(name => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)), true);
    assert.deepEqual(Object.keys(rows[0]).filter(key => ['event', 'at', 'traceId', 'invocationId', 'appId', 'connectionId', 'capabilityId'].includes(key)).sort(), ['appId', 'at', 'capabilityId', 'connectionId', 'event', 'invocationId', 'traceId']);
  } finally {appendSync.mock.restore();syncBuiltinESMExports();rmSync(directory, {recursive: true, force: true});}
});
