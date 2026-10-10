/** Time the real extracted CLI, never a source-built stand-in. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Agent, request} from 'node:http';
import {createServer} from 'node:net';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {prepareRun} from './validate-artifact.mjs';
import {configuration, draft, quote, invocation} from './fixture.mjs';

export async function measureHttpProcess(root, {diagnostic = false, rounds = 30, measure = true} = {}) {
  const run = prepareRun(root, {provisionDiagnosticZod: diagnostic});
  const agent = new Agent({keepAlive: true, maxSockets: 1});
  let child, stdout = '', stderr = '', exitPromise, exit;
  try {
    const reserve = createServer();
    await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    const config = join(run.directory, 'connections.json');
    writeFileSync(config, JSON.stringify(configuration));
    const launched = performance.now();
    child = spawn(process.execPath, [...run.args, run.artifact.entry], {
      cwd: run.directory, env: {...run.env, PACKAGING_AUDIT_MODE: measure ? 'timing-no-resolver-hook' : 'strict-module-resolution',
        APPS_DATA_DIR: join(run.directory, 'data'),
        APPS_CONNECTIONS_FILE: config, APPS_PORT: String(port)}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    exitPromise = new Promise(resolve => child.once('exit', (code, signal) => { exit = {code, signal}; resolve(exit); }));
    child.stderr.on('data', chunk => { stderr += chunk; });
    const startupMs = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('RUNTIME_START_TIMEOUT\n' + stderr)), 15000);
      const settle = (callback, value) => { clearTimeout(timer); callback(value); };
      child.once('error', error => settle(reject, error));
      child.once('exit', code => settle(reject, Error(`RUNTIME_START_EXIT_${code}\n${stderr}`)));
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (stdout.includes('"event":"apps-runtime-start"')) settle(resolve, performance.now() - launched);
      });
    });
    const token = readFileSync(join(run.directory, 'data/service-key'), 'utf8').trim();
    const samples = {}, requestCounts = {}, responseBytes = {};
    const call = async (label, path, input, expectedStatus = 200, timed = false) => {
      const payload = input === undefined ? undefined : JSON.stringify(input);
      const began = performance.now();
      const response = await new Promise((resolve, reject) => {
        const req = request({hostname: '127.0.0.1', port, path, method: payload === undefined ? 'GET' : 'POST', agent,
          headers: {authorization: `Bearer ${token}`, ...(payload === undefined ? {} : {'content-type': 'application/json', 'content-length': Buffer.byteLength(payload)})}}, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve({status: res.statusCode, bytes: Buffer.concat(chunks)}));
          res.on('error', reject);
        });
        req.setTimeout(10000, () => req.destroy(Error('HTTP_TIMEOUT')));
        req.on('error', reject); req.end(payload);
      });
      const elapsed = performance.now() - began;
      assert.equal(response.status, expectedStatus, response.bytes.toString());
      requestCounts[label] = (requestCounts[label] ?? 0) + 1;
      responseBytes[label] = (responseBytes[label] ?? 0) + response.bytes.length;
      if (measure && timed) (samples[label] ??= []).push(elapsed);
      return JSON.parse(response.bytes);
    };
    assert.equal((await call('health-first', '/health', undefined, 200, true)).status, 'ok');
    const bind = {sessionId: 's', appId: 'notes', connectionId: 'n', enabled: true, boundAt: new Date().toISOString()};
    await call('setup-bind', '/v1/session-bindings', bind);
    const created = await call('setup-note', '/v1/invocations', invocation('create', 'notes.notes.create',
      {id: 'note', title: 'Packaging benchmark', content: 'synthetic local only'}, {idempotencyKey: 'create'}));
    assert.equal(created.status, 'ok');
    const settings = (operation, input) => ({connectionId: 'h', operation, input});
    const store = (await call('setup-store', '/v1/business-settings', settings('store.save',
      {name: 'Synthetic', currency: 'CNY', expectedRevision: 0}))).store;
    const saved = await call('setup-pricing', '/v1/business-settings', settings('pricing.save',
      {storeId: store.id, config: draft(), expectedRevision: 0}));
    assert.equal(saved.pricing.revision, 1);
    for (let i = -3; i < rounds; i++) {
      const timed = i >= 0;
      const health = await call('health', '/health', undefined, 200, timed);
      assert.equal(health.status, 'ok');
      const identity = await call('identity', '/v1/runtime', undefined, 200, timed);
      assert.equal(identity.runtimeVersion, run.artifact.versions.runtimeVersion);
      const note = await call('notes-get', '/v1/invocations', invocation(`get-${i}`, 'notes.notes.get', {id: 'note'}), 200, timed);
      assert.equal(note.status, 'ok'); assert.equal(note.data.note.title, 'Packaging benchmark');
      const priced = await call('pricing-quote', '/v1/business-settings', settings('pricing.quote', quote(store.id)), 200, timed);
      assert.equal(priced.quote.planId, 'high'); assert.equal(priced.quote.breakdown.profitMinor, 6607);
      const rejected = await call('pricing-strict-invalid', '/v1/business-settings', settings('pricing.save',
        {storeId: store.id, config: {...draft(), unexpected: true}, expectedRevision: 1}), 400, timed);
      assert.equal(rejected.error.code, 'INVALID_PRICING_CONFIG');
    }
    agent.destroy(); child.kill('SIGTERM');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('RUNTIME_STOP_TIMEOUT')), 10000);
      exitPromise.then(value => { clearTimeout(timer); resolve(value); });
    });
    assert.equal(exit.code, 0, stderr);
    const resources = JSON.parse(readFileSync(run.resourceFile, 'utf8'));
    assert.equal(resources.networkAttempts, 0);
    assert.equal(resources.moduleResolutionGuard, !measure);
    if (!diagnostic && !measure) assert.deepEqual(resources.loadedModules, ['candidate/package/lib/runtime.js']);
    return {status: 'PASS', diagnosticOnly: diagnostic, measurement: measure,
      manifest: run.artifact.manifest, ...(measure ? {startupMs, samplesMs: samples, resources} : {isolation: resources}),
      rounds, warmupRounds: 3, requestCounts, responseBytes, stdout, stderr};
  } finally {
    agent.destroy();
    if (child && !exit) { child.kill('SIGKILL'); await exitPromise; }
    run.cleanup();
  }
}
