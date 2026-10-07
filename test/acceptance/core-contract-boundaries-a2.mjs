/** A.2 TST-003/004/011/012 FIXTURE: public API executions and raw evidence.
 * No original DSH UI/model/business/profile access. No direct database writes.
 * Run: node test/acceptance/core-contract-boundaries-a2.mjs --candidate 1.0.0-candidate.11 --sdk-root bundles/apps
 * --sdk-root is the bundle package root containing package.json, versions.json and sdk/.
 */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {connect} from 'node:net';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {AppsRuntime, RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {RuntimeWriterLease} from '../../packages/app-runtime/src/lease.ts';
import {HallmarkProvider, HallmarkStorePort, resolveHallmarkResources} from '../../packages/app-hallmark/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsClient, generateArtifacts} from '../../packages/app-sdk/src/index.ts';
import {AppsHost} from '../../packages/plugin-apps/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/client.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argumentsMap = new Map();
for (let n = 2; n < process.argv.length; n += 2) {const name = process.argv[n], value = process.argv[n + 1]; assert.ok(['--candidate', '--sdk-root'].includes(name) && value && !argumentsMap.has(name), 'Use unique --candidate VERSION / --sdk-root BUNDLE_ROOT arguments'); argumentsMap.set(name, value);}
const candidate = argumentsMap.get('--candidate') ?? '1.0.0-candidate.10';
assert.match(candidate, /^1\.0\.0-candidate\.(?:10|11)$/);
const bundleRoot = resolve(repository, argumentsMap.get('--sdk-root') ?? (candidate === '1.0.0-candidate.10' ? 'C:/Users/wubil/.dsh/profiles/desktop/node_modules/dsh-plugin-apps-bundle' : 'bundles/apps'));
const manifestPath = join(repository, 'evidence/apps-a2-20261007/candidates', candidate, 'build-manifest.json');
const packageManifestPath = join(dirname(manifestPath), 'package-manifest.json');
const frozen = JSON.parse(readFileSync(manifestPath, 'utf8'));
const packageManifest = JSON.parse(readFileSync(packageManifestPath, 'utf8'));
const runId = `a2-core-contract-${randomUUID()}`, root = join(repository, 'evidence/apps-a2-20261007/formal-core-contract', runId);
const startedAt = new Date().toISOString(), assertions = [], transactions = [], spies = [], http = [], fixtures = [], hosts = [], bridges = [];
const inflightProviderCalls = new Set();
const outcomes = new Map(['003', '004', '011', '012'].map(id => [id, 'NOT_RUN']));
const forbiddenPorts = new Set(['36994', '4180', '4280']);
let identity = null, identityRef = null;
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), hashFile = path => sha(readFileSync(path));
function json(path, value) {mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); return evidenceFile(path);}
function check(id, expected, actual, condition, required = true) {
  const row = {id, required, expected, actual, result: condition ? 'PASS' : 'FAIL', observedAt: new Date().toISOString()}; assertions.push(row); return row;
}
function must(id, expected, actual, condition) {const row = check(id, expected, actual, condition); assert.ok(condition, JSON.stringify(row));}
function inventory(directory, current = directory) {
  return readdirSync(current, {withFileTypes: true}).flatMap(entry => {if (['node_modules', '.git'].includes(entry.name)) return []; const path = join(current, entry.name); assert.equal(entry.isSymbolicLink(), false); return entry.isDirectory() ? inventory(directory, path) : entry.isFile() ? [{path: relative(directory, path).split(sep).join('/'), sha256: hashFile(path), bytes: statSync(path).size}] : [];}).sort((a, b) => a.path.localeCompare(b.path));
}
function candidateInputs() {return Object.entries(frozen.sourceInputs).map(([path, expected]) => ({path, expected, actual: hashFile(join(repository, path)), matches: expected === hashFile(join(repository, path))}));}
function bundleArtifacts() {return Object.entries(frozen.artifacts).map(([path, expected]) => ({path, expected, actual: hashFile(join(bundleRoot, path)), matches: expected === hashFile(join(bundleRoot, path))}));}
function createFixture(label) {
  const path = join(root, 'runtimes', label), lease = new RuntimeWriterLease(path), store = new RuntimeStore(join(path, 'apps.db'));
  const logs = [], runtime = new AppsRuntime(store, {log: row => logs.push(structuredClone(row))});
  const f = {label, path, lease, store, runtime, logs, sessionId: `fixture-${runId}-${label}`, registrations: []}; fixtures.push(f); return f;
}
function bind(f, appId, connectionId) {f.runtime.addConnection({appId, connectionId, displayName: `${appId}/${connectionId} synthetic`, config: {backend: 'isolated-fixture'}, configRevision: 1, enabled: true}); f.runtime.bind({sessionId: f.sessionId, appId, connectionId, enabled: true, boundAt: new Date().toISOString()});}
function snapshot(f, label) {
  const tables = Object.fromEntries(f.store.collections.map(table => [table, f.store.db.prepare(`SELECT id,value_json,created_at,updated_at FROM ${table} ORDER BY id`).all().map(row => ({...row, value: JSON.parse(row.value_json)}))]));
  return json(join(root, 'states', f.label, label + '.json'), {observedAt: new Date().toISOString(), fixture: f.label, tables});
}
function delta(label, beforeRef, afterRef) {
  const before = JSON.parse(readFileSync(beforeRef.path, 'utf8')), after = JSON.parse(readFileSync(afterRef.path, 'utf8'));
  const changes = Object.fromEntries(Object.keys(before.tables).map(table => {const prior = new Map(before.tables[table].map(row => [row.id, row])), next = new Map(after.tables[table].map(row => [row.id, row])); return [table, [...new Set([...prior.keys(), ...next.keys()])].flatMap(id => canonicalJson(prior.get(id) ?? null) === canonicalJson(next.get(id) ?? null) ? [] : [{id, before: prior.get(id) ?? null, after: next.get(id) ?? null}])];}));
  return json(join(root, 'diffs', label + '.json'), {before: beforeRef, after: afterRef, changes});
}
function request(f, appId, connectionId, descriptor, input, extra = {}) {return {protocolVersion: '1.0', appId, connectionId, capabilityId: descriptor.capabilityId, capabilityVersion: descriptor.version, input, invocationId: randomUUID(), traceId: randomUUID(), source: {kind: 'script', sessionId: f.sessionId, runId, stepKey: descriptor.capabilityId}, deadlineAt: new Date(Date.now() + 6000).toISOString(), ...extra};}
async function invoke(f, req, label) {const before = snapshot(f, label + '-before'), output = await f.runtime.invoke(req), after = snapshot(f, label + '-after'); const row = {label, fixture: f.label, request: req, output, before, after, diff: delta(f.label + '-' + label, before, after)}; transactions.push(row); json(join(root, 'executions', f.label, label + '.json'), row); return output;}
function runtimeTransport(f, identityOverride) {
  const trace = (method, input, output) => transactions.push({fixture: f.label, boundary: 'in-process-source-transport', method, input: structuredClone(input), output: structuredClone(output), at: new Date().toISOString()});
  return {
    async identity() {const output = {...f.runtime.identity(), ...identityOverride?.()}; trace('identity', {}, output); return output;},
    async listApps() {const output = f.runtime.listApps(); trace('listApps', {}, output); return output;},
    async describe(id, version) {const output = f.runtime.describe(id, version); trace('describe', {id, version: version ?? null}, output ?? null); return output;},
    async discover(options) {const output = f.runtime.discover(options); trace('discover', options ?? {}, output); return output;},
    async listConnections(appId) {return f.runtime.listConnections(appId);}, async sessionBindings(sessionId) {return f.runtime.sessionBindings(sessionId);}, async bind(binding) {return f.runtime.bind(binding);},
    async invoke(input, signal) {const output = await f.runtime.invoke(input, signal); trace('invoke', input, output); return output;}, async inspect(id, signal) {return f.runtime.inspect(id, signal);},
    async projectModelResult(id) {return projectModelResult(f.store, f.store.get('invocations', id).result);}, async legacyInvoke() {throw new Error('Legacy route not used by this acceptance');},
  };
}
async function hostFor(f, transport) {
  const tools = new Map(), agent = {id: f.sessionId}, host = new AppsHost({agents: {get: id => id === f.sessionId ? agent : undefined}, tools: {register: tool => {tools.set(tool.name, tool); return () => tools.delete(tool.name);}}}, transport);
  hosts.push({host, tools, fixture: f.label}); await host.start(); return {host, tools, agent};
}
function descriptor(appId, suffix = 'query', effect = 'query') {return {capabilityId: `${appId}.rows.${suffix}`, version: '1.0.0', title: 'Synthetic rows', description: 'Explicitly synthetic contract acceptance fixture', effect, inputSchema: {type: 'object', properties: {value: {type: 'string'}}, required: ['value'], additionalProperties: false}, outputSchema: {type: 'object', properties: {value: {type: 'string'}}, required: ['value'], additionalProperties: false}, execution: {mode: 'sync', timeoutMs: 6000, concurrency: effect === 'mutation' ? 'exclusive' : 'declared_safe', lockScope: 'connection', idempotency: effect === 'mutation' ? 'runtime_dedup' : 'not_applicable', completionEvidence: 'response'}, discovery: {defaultVisible: true, keywords: ['synthetic']}, aliases: []};}
function provider(appId, descriptors, execute, inspect) {return {manifest: {manifestVersion: 1, appId, displayName: `${appId} synthetic`, providerPackage: 'acceptance-fixture', providerVersion: '1.0.0', runtimeProtocolMajor: 1, resourceTypes: ['row']}, descriptors, async execute(context) {const row = {kind: 'execute', appId, at: new Date().toISOString(), request: structuredClone(context.request), operationId: context.operationId ?? null, configRevision: context.configRevision ?? null}; spies.push(row); inflightProviderCalls.add(row); try {const output = await execute(context); row.output = structuredClone(output); return output;} finally {inflightProviderCalls.delete(row);}}, ...(inspect ? {async inspect(id, context) {const row = {kind: 'inspect', appId, id, at: new Date().toISOString(), request: structuredClone(context.request)}; spies.push(row); inflightProviderCalls.add(row); try {const output = await inspect(id, context); row.output = structuredClone(output); return output;} finally {inflightProviderCalls.delete(row);}}} : {}), async dispose() {}};}
const ok = (context, data) => ({invocationId: context.request.invocationId, traceId: context.request.traceId, status: 'ok', data});
async function stoppedPort(url) {return new Promise(accept => {const socket = connect({host: '127.0.0.1', port: Number(new URL(url).port)}); socket.setTimeout(1500); socket.once('connect', () => {socket.destroy(); accept('UNEXPECTED_CONNECTION');}); socket.once('error', error => {socket.destroy(); accept(error.code);}); socket.once('timeout', () => {socket.destroy(); accept('PROBE_TIMEOUT');});});}

mkdirSync(root, {recursive: true});
const servers = [];
try {
  const executedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repository, encoding: 'utf8'}).trim(), gitStatus = execFileSync('git', ['status', '--porcelain'], {cwd: repository, encoding: 'utf8'});
  const sourceDiff = execFileSync('git', ['diff', 'HEAD', '--', 'packages'], {cwd: repository, encoding: 'utf8'});
  writeFileSync(join(root, 'executed-production-source-diff.patch'), sourceDiff, {flag: 'wx'});
  const files = execFileSync('git', ['ls-files', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(?:ts|tsx|json|yaml|yml)$/.test(path));
  for (const path of files) {const to = join(root, 'executed-source', path); mkdirSync(dirname(to), {recursive: true}); copyFileSync(join(repository, path), to);}
  copyFileSync(fileURLToPath(import.meta.url), join(root, 'executed-harness.mjs'));
  const sourceManifest = json(join(root, 'executed-source-manifest.json'), {executedCommit, files: inventory(join(root, 'executed-source'))});
  const before = candidateInputs(); json(join(root, 'candidate-inputs-before.json'), before); assert.equal(before.length, 143); assert.ok(before.every(row => row.matches));
  const artifactsBefore = bundleArtifacts(); json(join(root, 'bundle-artifacts-before.json'), artifactsBefore); assert.ok(artifactsBefore.every(row => row.matches));
  const bundlePackage = JSON.parse(readFileSync(join(bundleRoot, 'package.json'), 'utf8')), bundleVersions = JSON.parse(readFileSync(join(bundleRoot, 'versions.json'), 'utf8')), sdkPackage = JSON.parse(readFileSync(join(bundleRoot, 'sdk/app-sdk/package.json'), 'utf8'));
  assert.equal(bundlePackage.version, candidate); assert.equal(bundleVersions.bundleVersion, candidate); assert.equal(bundleVersions.hostPluginVersion, candidate); assert.equal(sdkPackage.version, candidate); assert.equal(frozen.bundleVersion, candidate); assert.equal(packageManifest.package.version, candidate);
  assert.equal(canonicalJson(bundleVersions), canonicalJson(frozen.versions));
  const archive = evidenceFile(resolve(repository, packageManifest.archive)); assert.equal(archive.sha256, packageManifest.sha256);
  const packedSdk = await import(pathToFileURL(join(bundleRoot, 'sdk/app-sdk/index.js')).href), packedGenerated = await import(pathToFileURL(join(bundleRoot, 'sdk/app-sdk/generated.js')).href);
  assert.equal(typeof packedSdk.AppsClient, 'function'); assert.equal(typeof packedSdk.generateArtifacts, 'function');
  identity = {executedCommit, sourceIdentity: sourceDiff ? 'WORKTREE_SNAPSHOT_AT_BASE_COMMIT' : 'CLEAN_PRODUCTION_SOURCE_AT_COMMIT', productionSourceDiff: evidenceFile(join(root, 'executed-production-source-diff.patch')), gitStatus, harness: evidenceFile(join(root, 'executed-harness.mjs')), sourceManifest, candidatePackage: bundlePackage.version, candidateVersions: bundleVersions, candidateBundleRoot: bundleRoot, candidatePackageLocation: candidate === '1.0.0-candidate.11' ? 'Uninstalled candidate bundle; actual DSH remains on its separately installed version' : 'Explicit candidate package root; no desktop execution claim', sdkPackage: evidenceFile(join(bundleRoot, 'sdk/app-sdk/package.json')), packedSdk: evidenceFile(join(bundleRoot, 'sdk/app-sdk/index.js')), packedGeneratedSdk: evidenceFile(join(bundleRoot, 'sdk/app-sdk/generated.js')), archive, packageManifest: evidenceFile(packageManifestPath), candidateManifest: evidenceFile(manifestPath), acceptanceCards: evidenceFile(join(repository, 'docs/requirements/A2/docs/03_ACCEPTANCE.md')), node: process.version, os: process.platform, architecture: process.arch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, modelClass: 'NONE', scope: 'FIXTURE', forbiddenPorts: [...forbiddenPorts], sourceScope: `Public source APIs frozen by source snapshot and ${candidate}'s 143 input hashes. Synthetic AppsHost, source-generated wrapper/source AppsClient proxy and separate actual packed SDK wrapper calls. No actual desktop, model or browser. Candidate artifacts are unchanged.`, cleanDependencyInstallation: 'NOT_RUN'};
  identityRef = json(join(root, 'identity.json'), identity);

  // TST-003: an actual stopped HTTP Source, not a boolean pretending a network broke.
  {
    const f = createFixture('003'), sourcePath = join(root, 'fixtures/hallmark-source.json');
    const source = {fixture: true, stores: [{id: 'shop-fixture', shopName: 'Synthetic only', lastSuccessAt: '2026-10-06T12:00:00Z'}], products: Array.from({length: 8}, (_, n) => ({storeId: 'shop-fixture', offerId: `synthetic-${n}`, productId: n + 1, title: n < 2 ? 'Same synthetic name' : `Synthetic ${n}`, price: 10 + n, stock: [0, 9, 10, 11, 5, 20, 30, 40][n], profit: {costMinor: n === 2 ? null : 500, actualMargin: n === 2 ? null : 0.25}, sourceTime: n === 3 ? null : '2026-10-06T12:00:00Z', original: {owner: 'isolated HTTP source', preserved: true}}))};
    const sourceRef = json(sourcePath, source), sourceBefore = readFileSync(sourcePath);
    const server = createServer(async (req, res) => {let body = ''; for await (const bytes of req) body += bytes; const record = {at: new Date().toISOString(), method: req.method, path: req.url, body}; http.push(record); res.setHeader('Content-Type', 'application/json');
      const current = JSON.parse(readFileSync(sourcePath, 'utf8')); let output;
      if (req.method === 'GET' && req.url === '/api/health') output = {status: 'ok', service: 'hallmark-board', fixture: true};
      else if (req.method === 'GET' && req.url === '/api/stores') output = current.stores;
      else if (req.method === 'GET' && req.url === '/api/store-products') output = current;
      else {res.statusCode = 405; output = {error: 'Mock source is read-only; no accepted Source write'};}
      record.status = res.statusCode; record.outputSha256 = sha(canonicalJson(output)); res.end(JSON.stringify(output));
    });
    await new Promise((accept, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', accept);}); const url = `http://127.0.0.1:${server.address().port}`; assert.equal(forbiddenPorts.has(new URL(url).port), false); servers.push({server, url, stopped: false});
    const networkAttempts = [], client = new HallmarkClient({baseUrl: url, healthCacheMs: 0, healthTimeoutMs: 1500, readTimeoutMs: 1500, fetchImpl: async (url, options) => {const target = new URL(url); assert.equal(target.origin, servers[0].url); assert.equal(forbiddenPorts.has(target.port), false); const row = {at: new Date().toISOString(), url: target.href, method: options.method, body: options.body ?? null}; networkAttempts.push(row); try {const response = await fetch(target, options); row.status = response.status; return response;} catch (error) {row.error = error.cause?.code ?? error.code ?? error.message; throw error;}}});
    const port = new HallmarkStorePort(f.store, 'H1'), p = new HallmarkProvider({store: port, client, broker: {getStoreTask: async () => {throw new Error('No business/task call allowed');}, getListingTask: async () => {throw new Error('No listing allowed');}, requestId: () => {throw new Error('No mutation allowed');}}});
    const original = p.execute.bind(p); p.execute = async context => {const row = {kind: 'execute', appId: 'hallmark', at: new Date().toISOString(), request: structuredClone(context.request)}; spies.push(row); inflightProviderCalls.add(row); try {const output = await original(context); row.output = structuredClone(output); return output;} finally {inflightProviderCalls.delete(row);}};
    f.runtime.register(p); bind(f, 'hallmark', 'H1');
    const presentation = new AppsPresentationService({store: f.store, runtime: f.runtime, resources: resolveHallmarkResources});
    const view = presentation.createView(f.sessionId, {title: 'Existing synthetic snapshot', bindings: [{bindingId: 'products', appId: 'hallmark', connectionId: 'H1', capabilityId: 'hallmark.products.list', capabilityMajor: 1, input: {storeId: 'shop-fixture'}, projection: [], refresh: {mode: 'manual'}}]});
    const initial = await presentation.refreshView(f.sessionId, view.viewId, {kind: 'script', sessionId: f.sessionId, runId, stepKey: '003-initial'});
    json(join(root, 'TST-003/initial-view-data.json'), initial); const prior = initial.bindings[0], domainBefore = structuredClone(port.get('snapshots', 'store_products:shop-fixture'));
    must('003.source.snapshot', '8 synthetic source rows preserved with explicit source/cache times', prior, prior.state === 'ready' && prior.payload.products.length === 8 && !!prior.lastSuccessAt && prior.sourceDataTime === '2026-10-06T12:00:00Z');
    const dbBefore = snapshot(f, 'source-connected');
    server.closeAllConnections(); await new Promise(accept => server.close(accept)); servers[0].stopped = true; const downProbe = await stoppedPort(url);
    must('003.source.actualDisconnected', 'ECONNREFUSED on a new TCP connection', {url, downProbe}, downProbe === 'ECONNREFUSED');
    const bridgeIdentity = {protocolVersion: '2.0', sessionId: f.sessionId, viewId: view.viewId, buildId: 'synthetic-snapshot-view', frameInstanceId: 'synthetic-frame'};
    const bridge = presentation.createHost(bridgeIdentity); bridges.push(bridge);
    const componentRefreshInput = {...bridgeIdentity, channel: COMPONENT_CHANNEL, requestId: randomUUID(), method: 'refresh', params: {bindingIds: ['products']}}, refreshed = await bridge.handle(componentRefreshInput);
    const readInput = {...bridgeIdentity, channel: COMPONENT_CHANNEL, requestId: randomUUID(), method: 'getData', params: null}, reopened = await bridge.handle(readInput);
    json(join(root, 'TST-003/disconnected-component-refresh-and-open.json'), {componentRefreshInput, refreshed, readInput, reopened});
    const after = reopened.result.bindings[0];
    must('003.cache.staleAndUnavailable', {state: 'unavailable', freshness: 'stale', preservedTime: prior.lastSuccessAt}, after, after.state === 'unavailable' && after.freshness === 'stale' && after.lastSuccessAt === prior.lastSuccessAt && after.sourceDataTime === prior.sourceDataTime && canonicalJson(after.payload) === canonicalJson(prior.payload) && !!after.error);
    const rawRefresh = await invoke(f, request(f, 'hallmark', 'H1', f.runtime.describe('hallmark.datasets.refresh'), {datasetKey: 'store_products:shop-fixture'}), 'refresh-domain-source-down');
    must('003.domain.refreshUnavailable', 'unavailable; no fake source success', rawRefresh, rawRefresh.status === 'unavailable' && rawRefresh.error?.retryPolicy === 'read_retry');
    const domainAfter = port.get('snapshots', 'store_products:shop-fixture');
    must('003.domain.originalSnapshotRetained', {payload: domainBefore.payload, lastSuccessAt: domainBefore.lastSuccessAt}, domainAfter, canonicalJson(domainBefore.payload) === canonicalJson(domainAfter.payload) && domainBefore.lastSuccessAt === domainAfter.lastSuccessAt && domainAfter.state === 'failed');
    must('003.source.noReplacementWrite', sourceRef.sha256, evidenceFile(sourcePath), readFileSync(sourcePath).equals(sourceBefore) && http.every(row => row.method === 'GET') && !f.store.list('operations').length);
    const dbAfter = snapshot(f, 'source-disconnected'); delta('003-source-disconnection', dbBefore, dbAfter);
    json(join(root, 'TST-003/source-owner.json'), {source: sourceRef, sourceBeforeSha256: sha(sourceBefore), sourceAfter: evidenceFile(sourcePath), sourceOwner: 'Private HTTP fixture owns business facts; Runtime only keeps cache and refresh status', mockUrl: url, actualStopped: true, downProbe, domainBefore, domainAfter, networkAttempts, acceptedWriteRequests: http.filter(row => row.method !== 'GET').length});
    outcomes.set('003', assertions.filter(row => row.id.startsWith('003.')).every(row => row.result === 'PASS') ? 'PASS' : 'FAIL');
  }

  // TST-004: the generated call wrapper is actually loaded and executed.
  {
    const f = createFixture('004'), notes = new NotesProvider({store: f.store}), original = notes.execute.bind(notes);
    notes.execute = async context => {const row = {kind: 'execute', appId: 'notes', at: new Date().toISOString(), request: structuredClone(context.request)}; spies.push(row); inflightProviderCalls.add(row); try {const output = await original(context); row.output = structuredClone(output); return output;} finally {inflightProviderCalls.delete(row);}};
    f.runtime.register(notes); bind(f, 'notes', 'N1');
    const transport = runtimeTransport(f), native = await hostFor(f, transport); native.host.attachApp('notes');
    const sdk = new AppsClient(transport, {kind: 'script', sessionId: f.sessionId, runId, stepKey: '004-generated'}), get = f.runtime.describe('notes.notes.get');
    const seed = await sdk.invoke({appId: 'notes', connectionId: 'N1'}, f.runtime.describe('notes.notes.create'), {id: 'note-fixture', title: 'Synthetic note', content: 'Owned by fixture'}, {idempotencyKey: 'synthetic-note-setup'}); assert.equal(seed.status, 'ok');
    const generated = generateArtifacts([get]), generatedDirectory = join(root, 'generated-sdk'); mkdirSync(generatedDirectory, {recursive: true});
    writeFileSync(join(generatedDirectory, 'generated.ts'), generated.source, {flag: 'wx'});
    writeFileSync(join(generatedDirectory, 'index.ts'), `export {AppsClient} from ${JSON.stringify(pathToFileURL(join(repository, 'packages/app-sdk/src/index.ts')).href)};\n`, {flag: 'wx'});
    writeFileSync(join(generatedDirectory, 'documentation.md'), generated.documentation, {flag: 'wx'}); json(join(generatedDirectory, 'tools.json'), generated.tools);
    const wrappers = await import(pathToFileURL(join(generatedDirectory, 'generated.ts')).href); assert.equal(typeof wrappers.call0, 'function');
    const packedGetIndex = packedGenerated.catalog.findIndex(item => item.capabilityId === get.capabilityId && item.version === get.version);
    assert.ok(packedGetIndex >= 0 && typeof packedGenerated['call' + packedGetIndex] === 'function');
    const packedClient = new packedSdk.AppsClient(transport, {kind: 'script', sessionId: f.sessionId, runId, stepKey: '004-packed-generated'});
    const presentation = new AppsPresentationService({store: f.store, runtime: f.runtime}); const view = presentation.createView(f.sessionId, {title: 'Synthetic three-entry component', bindings: [{bindingId: 'note', appId: 'notes', connectionId: 'N1', capabilityId: get.capabilityId, capabilityMajor: 1, input: {id: 'note-fixture'}, projection: [], refresh: {mode: 'manual'}}]});
    const identity = {protocolVersion: '2.0', sessionId: f.sessionId, viewId: view.viewId, buildId: 'synthetic-three-entry', frameInstanceId: 'synthetic-frame'}, bridge = presentation.createHost(identity); bridges.push(bridge);
    const before = snapshot(f, 'entries-before'), records = [];
    for (const id of ['note-fixture', 'missing-note']) {
      const startSpies = spies.length, input = {id};
      const nativeInput = {appId: 'notes', connectionId: 'N1', capabilityId: get.capabilityId, capabilityVersion: get.version, input}, nativeOutput = await native.tools.get('apps_invoke').execute(nativeInput, {agent: native.agent, signal: new AbortController().signal});
      const sdkOutput = await wrappers.call0(sdk, {appId: 'notes', connectionId: 'N1'}, input);
      const componentInput = {...identity, channel: COMPONENT_CHANNEL, requestId: randomUUID(), method: 'invokeCapability', params: {...nativeInput, deadlineAt: new Date(Date.now() + 6000).toISOString()}}, componentOutput = await bridge.handle(componentInput);
      const results = [nativeOutput.result, sdkOutput, componentOutput.result], normalize = result => {const {invocationId, traceId, ...other} = structuredClone(result); if (other.provenance) other.provenance = other.provenance.map(row => {const {fetchedAt, ...sameSourceFacts} = row; return sameSourceFacts;}); return other;};
      const calls = spies.slice(startSpies).filter(row => row.appId === 'notes' && row.request.capabilityId === get.capabilityId);
      records.push({id, input, nativeInput, nativeOutput, sdkOutput, componentInput, componentOutput, providerCalls: calls});
      must(`004.${id}.providerExactlyOnce`, '3 distinct invocations; one Provider dispatch per entry', calls, calls.length === 3 && new Set(calls.map(row => row.request.invocationId)).size === 3 && canonicalJson(calls.map(row => row.request.source.kind).sort()) === canonicalJson(['agent', 'component', 'script']));
      must(`004.${id}.sameEnvelopeAndErrors`, id === 'note-fixture' ? 'all ok; complete envelope/source facts equal except unique invocation/trace IDs and each actual read fetchedAt' : 'all failed RESOURCE_NOT_FOUND/never with equal error envelope', results, results.every(result => result.status === (id === 'note-fixture' ? 'ok' : 'failed')) && canonicalJson(normalize(results[0])) === canonicalJson(normalize(results[1])) && canonicalJson(normalize(results[1])) === canonicalJson(normalize(results[2])) && (id === 'note-fixture' ? results.every(result => result.provenance.length === 1 && Number.isFinite(Date.parse(result.provenance[0].fetchedAt)) && Date.parse(result.provenance[0].fetchedAt) >= Date.parse(result.data.note.updatedAt)) : results.every(result => result.error.code === 'RESOURCE_NOT_FOUND' && result.error.retryPolicy === 'never')));
      must(`004.${id}.durableInvocations`, 'each provider dispatch has one settled Runtime row matching its own result/entry', results, results.every(result => f.store.get('invocations', result.invocationId)?.state === 'settled' && canonicalJson(f.store.get('invocations', result.invocationId).result) === canonicalJson(result)));
      const packedBefore = spies.length, packedOutput = await packedGenerated['call' + packedGetIndex](packedClient, {appId: 'notes', connectionId: 'N1'}, input), packedCalls = spies.slice(packedBefore);
      records.at(-1).packedSdkCrossCheck = {candidate, bundleRoot, generatedWrapperName: 'call' + packedGetIndex, packedOutput, providerCalls: packedCalls};
      must(`004.${id}.actualPackedSdk`, 'separate real packed SDK/generated wrapper read: one Provider, unique invocation, same full envelope/source facts except actual read time/IDs', records.at(-1).packedSdkCrossCheck, packedCalls.length === 1 && packedCalls[0].request.invocationId === packedOutput.invocationId && !results.some(result => result.invocationId === packedOutput.invocationId) && canonicalJson(normalize(packedOutput)) === canonicalJson(normalize(sdkOutput)) && f.store.get('invocations', packedOutput.invocationId)?.state === 'settled');
    }
    json(join(root, 'TST-004/three-entry-executions.json'), {generatedSource: evidenceFile(join(generatedDirectory, 'generated.ts')), proxy: evidenceFile(join(generatedDirectory, 'index.ts')), proxyReason: 'Original generated import ./index.ts resolves to a fixture re-export of current public source AppsClient; generated wrapper bytes are untouched. Separately recorded actual packed AppsClient and pre-generated wrapper are executed from the explicit candidate bundle.', packedSdk: identity.packedSdk, packedGeneratedSdk: identity.packedGeneratedSdk, sdkPackage: identity.sdkPackage, syntheticNativeContext: true, records});
    const after = snapshot(f, 'entries-after'); delta('004-three-entries', before, after);
    outcomes.set('004', assertions.filter(row => row.id.startsWith('004.')).every(row => row.result === 'PASS') ? 'PASS' : 'FAIL');
  }

  // TST-011: real public catalog refresh and fail-closed injected identity versions.
  {
    const f = createFixture('011'), appId = 'contractfixture', base = descriptor(appId), added = descriptor(appId, 'added'), initialProvider = provider(appId, [base], context => ok(context, {value: context.request.input.value}));
    f.runtime.register(initialProvider); bind(f, appId, 'C1'); const transport = runtimeTransport(f), native = await hostFor(f, transport); native.host.attachApp(appId);
    const nativeList = await native.tools.get('apps_list').execute({appId}, {agent: native.agent, signal: new AbortController().signal}), initialIdentity = f.runtime.identity();
    // Public stopProvider keeps a stopped manifest, intentionally preventing a
    // second registration in the same Runtime. A normal isolated service-generation
    // restart is the supported way to introduce the compatible expanded provider.
    await f.runtime.dispose();
    f.runtime = new AppsRuntime(f.store, {log: row => f.logs.push(structuredClone(row))});
    f.runtime.register(provider(appId, [base, added], context => ok(context, {value: context.request.input.value})));
    const refreshed = await native.tools.get('apps_list').execute({appId}, {agent: native.agent, signal: new AbortController().signal}), newIdentity = f.runtime.identity();
    must('011.catalog.compatibleRefresh', 'same major/schema1; changed digest; new capability visible after public Host refresh', {nativeList, refreshed, initialIdentity, newIdentity}, refreshed.status === 'ok' && refreshed.capabilities.items.some(row => row.capabilityId === added.capabilityId && row.version === '1.0.0') && nativeList.capabilities.items.length === 1 && refreshed.capabilities.items.length === 2 && initialIdentity.catalogDigest !== newIdentity.catalogDigest && newIdentity.transportMajor === 1 && newIdentity.catalogSchemaVersion === 1);
    const compat = await native.tools.get('apps_invoke').execute({appId, connectionId: 'C1', capabilityId: added.capabilityId, capabilityVersion: added.version, input: {value: 'compatible-new-capability'}}, {agent: native.agent, signal: new AbortController().signal});
    must('011.catalog.addedCapabilityExecutes', 'one Provider call and actual ok result', compat, compat.result?.status === 'ok' && spies.filter(row => row.appId === appId && row.request.capabilityId === added.capabilityId).length === 1);
    const incompatibles = [];
    for (const bad of [{transportMajor: 2, catalogSchemaVersion: 1}, {transportMajor: 1, catalogSchemaVersion: 2}]) {
      const badTransport = runtimeTransport(f, () => bad), badSdk = new packedSdk.AppsClient(badTransport, {kind: 'script', sessionId: f.sessionId, runId, stepKey: '011-packed-version-gate'}), priorCalls = spies.length;
      const sdkResult = await badSdk.invoke({appId, connectionId: 'C1'}, base, {value: 'must-not-dispatch'});
      const badHost = new AppsHost({agents: {get: id => id === f.sessionId ? native.agent : undefined}, tools: {register: () => {throw new Error('Incompatible start must not register gateways');}}}, badTransport); hosts.push({host: badHost, tools: new Map(), fixture: f.label});
      let startError = null; try {await badHost.start();} catch (error) {startError = {message: error.message, details: error.details ?? null};}
      const hostResult = await badHost.call('apps_invoke', {appId, connectionId: 'C1', capabilityId: base.capabilityId, capabilityVersion: base.version, input: {value: 'must-not-dispatch'}}, f.sessionId);
      incompatibles.push({injectedIdentity: bad, sdkResult, startError, hostResult, providerDelta: spies.length - priorCalls});
      const label = bad.transportMajor === 2 ? 'transport' : 'catalog';
      must(`011.${label}.noProviderDispatch`, 'Host start/call and SDK reject before Provider; expected/actual identities included', incompatibles.at(-1), startError?.message === 'INCOMPATIBLE_PROTOCOL' && sdkResult.status === 'failed' && hostResult.status === 'failed' && sdkResult.error.code === 'INCOMPATIBLE_PROTOCOL' && hostResult.error.code === 'INCOMPATIBLE_PROTOCOL' && canonicalJson(sdkResult.error.details.expected) === canonicalJson({transportMajor: 1, catalogSchemaVersion: 1}) && canonicalJson(sdkResult.error.details.actual) === canonicalJson(bad) && canonicalJson(hostResult.error.details.actual) === canonicalJson(bad) && spies.length === priorCalls);
    }
    const priorCalls = spies.length, unavailableVersion = '9.0.0', requestVersion = request(f, appId, 'C1', base, {value: 'must-not-dispatch'}, {capabilityVersion: unavailableVersion});
    const runtimeResult = await invoke(f, requestVersion, 'unregistered-version'), nativeResult = await native.tools.get('apps_invoke').execute({appId, connectionId: 'C1', capabilityId: base.capabilityId, capabilityVersion: unavailableVersion, input: {value: 'must-not-dispatch'}}, {agent: native.agent, signal: new AbortController().signal});
    must('011.capabilityVersion.rejectsBeforeProvider', 'requested9.0.0 is absent; current1.0.0 must not be silently selected', {runtimeResult, nativeResult, providerDelta: spies.length - priorCalls}, runtimeResult.status === 'failed' && runtimeResult.error.code === 'CAPABILITY_NOT_FOUND' && nativeResult.status === 'failed' && nativeResult.error.code === 'CAPABILITY_NOT_FOUND' && spies.length === priorCalls);
    // Inspect the product envelope itself. A separate fixture identity table is
    // not a substitute for the required expected/actual product diagnostic.
    const versionVisible = result => canonicalJson(result.error?.details ?? null) === canonicalJson({expected: {appId, capabilityId: base.capabilityId, capabilityVersion: unavailableVersion}, actual: {capabilityVersion: base.version}}) && result.error.message.includes(unavailableVersion) && result.error.message.includes(base.version);
    check('011.capabilityVersion.expectedActualDiagnostic', {expected: {appId, capabilityId: base.capabilityId, capabilityVersion: unavailableVersion}, actual: {capabilityVersion: base.version}}, {runtimeResult, nativeResult}, versionVisible(runtimeResult) && versionVisible(nativeResult));
    json(join(root, 'TST-011/compatibility-executions.json'), {initialIdentity, newIdentity, nativeList, refreshed, compat, incompatibles, missingCapabilityVersion: {registered: base, requested: requestVersion, runtimeResult, nativeResult, providerDelta: spies.length - priorCalls}, productDiagnosticGap: versionVisible(runtimeResult) && versionVisible(nativeResult) ? null : 'Exact-version product diagnostic does not disclose the requested/registered versions. Raw product envelopes are retained without harness-added fields.'});
    snapshot(f, 'final'); outcomes.set('011', assertions.filter(row => row.id.startsWith('011.')).every(row => row.result === 'PASS') ? 'PASS' : 'FAIL');
  }

  // TST-012: registration, input, query output and post-dispatch mutation output.
  {
    const f = createFixture('012'), bad = descriptor('missingoutput'); delete bad.outputSchema;
    const beforeRegister = f.runtime.identity(), malformedProvider = provider('missingoutput', [bad], context => ok(context, {value: 'must-never-run'}));
    let registrationError = null; try {f.runtime.register(malformedProvider);} catch (error) {registrationError = {message: error.message};}
    json(join(root, 'TST-012/registration-without-output-schema.json'), {provider: {manifest: malformedProvider.manifest, descriptors: malformedProvider.descriptors}, registrationError, beforeRegister, afterRegister: f.runtime.identity(), catalog: f.runtime.listApps()});
    must('012.registration.missingOutputRejected', 'registration rejects missing outputSchema with $.outputSchema path, provider absent, directory unchanged', registrationError, registrationError?.message.includes('$.outputSchema') && !f.runtime.listApps().some(row => row.appId === 'missingoutput') && f.runtime.identity().catalogDigest === beforeRegister.catalogDigest && !spies.some(row => row.appId === 'missingoutput'));
    const appId = 'schemafixture', query = descriptor(appId), mutation = descriptor(appId, 'mutate', 'mutation'), p = provider(appId, [query, mutation], context => ok(context, {wrong: true}), async (id, context) => ({invocationId: context.request.invocationId, traceId: context.request.traceId, status: 'unknown', operation: {operationId: id, state: 'unknown'}, error: {code: 'INSPECTION_NOT_CONCLUSIVE', message: 'Synthetic source completion remains unproven; no second write.', retryPolicy: 'inspect_only'}}));
    f.runtime.register(p); bind(f, appId, 'C1');
    const prior = spies.length, invalidInput = await invoke(f, request(f, appId, 'C1', query, {value: 123}), 'invalid-input');
    must('012.input.beforeProvider', 'INPUT_SCHEMA_INVALID has $.value field path and Provider0', invalidInput, invalidInput.status === 'failed' && invalidInput.error.code === 'INPUT_SCHEMA_INVALID' && invalidInput.error.message.includes('$.value') && spies.length === prior);
    const queryResult = await invoke(f, request(f, appId, 'C1', query, {value: 'query'}), 'invalid-query-output');
    must('012.query.outputInvalid', 'OUTPUT_SCHEMA_INVALID contains $.value/$.wrong field paths, no ok data', queryResult, queryResult.status === 'failed' && queryResult.error.code === 'OUTPUT_SCHEMA_INVALID' && queryResult.error.message.includes('$.value') && queryResult.error.message.includes('$.wrong') && !Object.hasOwn(queryResult, 'data'));
    const mutationRequest = request(f, appId, 'C1', mutation, {value: 'mutation'}, {idempotencyKey: 'synthetic-schema-write'}), mutationResult = await invoke(f, mutationRequest, 'invalid-mutation-output');
    const operation = f.store.get('operations', mutationResult.operation?.operationId);
    must('012.mutation.postDispatchUnknown', 'invalid output after one dispatch retains unknown operation/inspect_only and $.value/$.wrong paths, no definitive success/failure', {mutationResult, operation}, mutationResult.status === 'unknown' && mutationResult.operation.state === 'unknown' && mutationResult.error.code === 'OUTPUT_SCHEMA_INVALID' && mutationResult.error.retryPolicy === 'inspect_only' && mutationResult.error.message.includes('$.value') && mutationResult.error.message.includes('$.wrong') && operation.state === 'unknown' && !Object.hasOwn(mutationResult, 'data') && spies.filter(row => row.kind === 'execute' && row.request.capabilityId === mutation.capabilityId).length === 1);
    const projection = projectModelResult(f.store, mutationResult); json(join(root, 'TST-012/invalid-output-model-projection.json'), {invocationId: mutationResult.invocationId, result: mutationResult, projection});
    const projected = JSON.parse(projection.content);
    must('012.modelProjection.noFalseSuccess', 'projected result remains unknown/inspect_only; no successful data', projected, projected.status === 'unknown' && projected.error?.retryPolicy === 'inspect_only' && !Object.hasOwn(projected, 'data'));
    const beforeInspect = snapshot(f, 'before-inspect'), inspected = await f.runtime.inspect(mutationResult.operation.operationId), afterInspect = snapshot(f, 'after-inspect');
    const inspectDiff = delta('012-inspection-only', beforeInspect, afterInspect); json(join(root, 'TST-012/readonly-inspection.json'), {originalRequest: mutationRequest, mutationResult, operation, inspected, before: beforeInspect, after: afterInspect, diff: inspectDiff});
    must('012.inspect.noSecondWrite', 'inspect keeps original operation unknown and makes only one inspect dispatch, no mutation re-send', inspected, inspected.status === 'unknown' && inspected.error.retryPolicy === 'inspect_only' && inspected.operation.operationId === mutationResult.operation.operationId && spies.filter(row => row.kind === 'execute' && row.request.capabilityId === mutation.capabilityId).length === 1 && spies.filter(row => row.appId === appId && row.kind === 'inspect').length === 1 && f.store.get('operations', mutationResult.operation.operationId).state === 'unknown');
    outcomes.set('012', assertions.filter(row => row.id.startsWith('012.')).every(row => row.result === 'PASS') ? 'PASS' : 'FAIL');
  }
  const afterInputs = candidateInputs(); json(join(root, 'candidate-inputs-after.json'), afterInputs); assert.ok(afterInputs.every(row => row.matches));
  assert.equal(canonicalJson(afterInputs), canonicalJson(JSON.parse(readFileSync(join(root, 'candidate-inputs-before.json'), 'utf8'))));
  const artifactsAfter = bundleArtifacts(); json(join(root, 'bundle-artifacts-after.json'), artifactsAfter); assert.ok(artifactsAfter.every(row => row.matches));
  assert.equal(canonicalJson(artifactsAfter), canonicalJson(artifactsBefore)); assert.equal(hashFile(archive.path), archive.sha256);
  assert.ok(inventory(join(root, 'executed-source')).every(file => hashFile(join(repository, file.path)) === file.sha256));
} catch (error) {json(join(root, 'failure.json'), {name: error.name, message: error.message, stack: error.stack, at: new Date().toISOString()}); process.exitCode = 1;}
finally {
  const cleanup = [];
  for (const bridge of bridges) bridge.dispose();
  for (const h of hosts.reverse()) {try {await h.host.dispose(); cleanup.push({kind: 'AppsHost', fixture: h.fixture, registeredToolCountAfterDispose: h.tools.size});} catch (error) {cleanup.push({kind: 'AppsHost', fixture: h.fixture, error: error.message}); process.exitCode = 1;}}
  for (const entry of servers) {if (!entry.stopped) {entry.server.closeAllConnections(); await new Promise(accept => entry.server.close(accept)); entry.stopped = true;} const probe = await stoppedPort(entry.url); cleanup.push({kind: 'HTTP-mock', url: entry.url, listenerClosed: !entry.server.listening, freshTcpProbe: probe}); if (probe !== 'ECONNREFUSED') process.exitCode = 1;}
  for (const f of fixtures.reverse()) {try {const final = snapshot(f, 'after-host-disposal'), logs = json(join(root, 'runtime-logs', f.label + '.json'), f.logs), pendingBeforeDispose = inflightProviderCalls.size; await f.runtime.dispose(); const pendingAfterDispose = inflightProviderCalls.size; f.store.close(); f.lease.release(); cleanup.push({kind: 'Runtime', fixture: f.label, leaseAbsent: !existsSync(f.lease.path), finalState: final, logs, globalInstrumentedPendingProviderCallsBeforeDispose: pendingBeforeDispose, globalInstrumentedPendingProviderCallsAfterDispose: pendingAfterDispose}); if (pendingAfterDispose || existsSync(f.lease.path)) process.exitCode = 1;} catch (error) {cleanup.push({kind: 'Runtime', fixture: f.label, error: error.message}); process.exitCode = 1;}}
  const traceRef = json(join(root, 'transactions.json'), transactions), spyRef = json(join(root, 'provider-spies.json'), spies), httpRef = json(join(root, 'http-source-requests.json'), http), assertionsRef = json(join(root, 'assertions.json'), assertions), cleanupRef = json(join(root, 'cleanup.json'), {cleanup, browser: 'never launched', originalDSHRuntimeTouched: false, externalModelRequests: 0, noModelLoop: true, allEvidenceAndSourceDirectoriesKept: true});
  const cardRefs = [];
  const descriptions = {'003': ['Read actual HTTP source into a visible-view dataset and source cache', 'Stop mock server; component refresh and reopen cache through public bridge', 'Unavailable/stale/time/payload and source-byte immutability'], '004': ['Create synthetic Notes and source AppsHost native gateway', 'Generate source SDK artifacts and execute original generated wrapper; separately execute the selected packed SDK/pre-generated wrapper', 'Native/generated-SDK/component normal and missing-resource calls: independent invocations, one Provider per entry, equal envelopes'], '011': ['Register initial capability, then compatible provider generation adds capability; public Host catalog refresh', 'transportMajor and catalogSchemaVersion incompatible Host/SDK handshakes stop before Provider with expected/actual', 'Exact nonexistent capability version must stop before Provider and disclose expected/actual capability versions'], '012': ['Reject provider with no outputSchema before catalog/dispatch', 'Reject invalid input before Provider and invalid query output with paths', 'Post-dispatch mutation invalid output remains unknown/inspect_only; model projection and read-only inspection never show fake success']};
  for (const [id, status] of outcomes) {
    const selected = assertions.filter(row => row.id.startsWith(id + '.')), actualStatus = status === 'PASS' && process.exitCode ? 'FAIL' : status;
    const caseRoot = join(root, 'TST-' + id), caseArtifacts = existsSync(caseRoot) ? inventory(caseRoot).map(file => evidenceFile(join(caseRoot, file.path))) : [];
    const stepGroups = {'003': [['003.source.snapshot'], ['003.source.actualDisconnected', '003.cache.'], ['003.domain.', '003.source.noReplacementWrite']], '004': [['004.note-fixture.providerExactlyOnce'], ['004.note-fixture.sameEnvelopeAndErrors', '004.note-fixture.actualPackedSdk'], ['004.missing-note.', '004.note-fixture.durableInvocations']], '011': [['011.catalog.'], ['011.transport.', '011.catalog.noProvider'], ['011.capabilityVersion.']], '012': [['012.registration.'], ['012.input.', '012.query.'], ['012.mutation.', '012.modelProjection.', '012.inspect.']]}[id];
    const result = {recordKind: 'EXECUTED_ACCEPTANCE', testId: 'TST-' + id, requirementIds: ['REQ-' + id], releaseId: 'apps-a2-20261007', runId, targetCommit: identity?.executedCommit ?? null, executedCommit: identity?.executedCommit ?? null, executedSourceIdentity: identity?.sourceIdentity ?? null, productionSourceDiff: identity?.productionSourceDiff ?? null, candidateArchiveSha256: identity?.archive.sha256 ?? null, candidatePackageLocation: identity?.candidatePackageLocation ?? null, scope: 'FIXTURE', status: actualStatus, completeScope: actualStatus === 'PASS', modelClass: 'NONE', startedAt, finishedAt: new Date().toISOString(), environment: {node: process.version, os: process.platform, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, browser: 'Not required for this pure dispatch fixture; never launched'}, versions: {bundle: identity?.candidatePackage ?? null, runtime: identity?.candidateVersions.runtimeVersion ?? null, databaseSchema: identity?.candidateVersions.databaseSchemaVersion ?? null, transportMajor: 1, catalogSchemaVersion: 1, dshHost: 'NOT_RUN', externalModel: 'NOT_RUN'}, fixtureRefs: [identityRef], steps: descriptions[id].map((description, index) => {const covered = selected.filter(row => stepGroups[index].some(prefix => row.id.startsWith(prefix))); return {index: index + 1, description, assertionIds: covered.map(row => row.id), status: covered.length ? covered.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL' : 'NOT_RUN'};}), assertions: selected, artifactRefs: [identityRef, traceRef, spyRef, httpRef, assertionsRef, cleanupRef, ...caseArtifacts], assertionCounts: {total: selected.length, passed: selected.filter(row => row.result === 'PASS').length, failed: selected.filter(row => row.result === 'FAIL').length}, executor: 'Codex /root/formal_draft_ledger_fixture', reviewer: null, independentReview: 'PENDING', releaseApproval: 'NOT_ACCEPTED', limitations: ['FIXTURE only. Synthetic original-agent context is not actual DSH desktop or LIVE_HOST.', `Public source implementation is frozen by the complete executed-source snapshot and ${candidate}'s exact 143 packed input hashes; commit is the Git base, and any source diff is separately retained. The selected bundle is not installed by this fixture.`, 'Primary three-entry test retains original source-generated wrapper bytes and an explicit source AppsClient import proxy. Separate actual packed AppsClient/pre-generated wrapper calls verify the selected candidate SDK and are labelled independently.', 'Actual HTTP disconnect occurs on a separate private read-only Hallmark mock, never actual Board.', 'No external model requests, no custom Agent loop, no real business writes or automatic component save.', ...(id === '011' && actualStatus === 'FAIL' ? ['Expected/actual exact-capability-version diagnostic is missing in Runtime/Host product error envelopes; kept FAIL rather than inferred from fixture metadata.'] : [])]};
    cardRefs.push(json(join(root, 'TST-' + id, 'FIXTURE/result.json'), result));
  }
  const fileRefs = new Map(), errors = [];
  function visit(value, owner) {if (!value || typeof value !== 'object') return; if (typeof value.path === 'string' && isAbsolute(value.path) && /^[a-f0-9]{64}$/.test(value.sha256 ?? '') && Number.isSafeInteger(value.bytes)) {const key = value.path + '|' + value.sha256 + '|' + value.bytes; if (!fileRefs.has(key)) {try {const actual = evidenceFile(value.path); fileRefs.set(key, {...value, actual, owner}); if (actual.sha256 !== value.sha256 || actual.bytes !== value.bytes) errors.push({owner, expected: value, actual});} catch (error) {errors.push({owner, expected: value, error: error.message});}}} for (const entry of Object.values(value)) visit(entry, owner);}
  const jsonFiles = inventory(root).filter(file => file.path.endsWith('.json') && !file.path.startsWith('executed-source/'));
  for (const file of jsonFiles) {const path = join(root, file.path); visit(JSON.parse(readFileSync(path, 'utf8')), path);}
  const integrityRef = json(join(root, 'reference-integrity.json'), {jsonFiles: jsonFiles.length, references: fileRefs.size, errors, records: [...fileRefs.values()]}); if (errors.length) process.exitCode = 1;
  const indexRef = json(join(root, 'artifact-index.json'), {files: inventory(root).map(file => ({...file, path: join(root, file.path)})), privateDbEvidence: true});
  const result = {runId, root, executedCommit: identity?.executedCommit ?? null, scope: 'FIXTURE', status: process.exitCode ? 'FAIL' : [...outcomes.values()].every(value => value === 'PASS') ? 'PASS' : 'PARTIAL', cards: [...outcomes].map(([id, status]) => ({testId: 'TST-' + id, scope: 'FIXTURE', status})), formalResults: cardRefs, identity: identityRef, assertions: assertionsRef, assertionCounts: {total: assertions.length, passed: assertions.filter(row => row.result === 'PASS').length, failed: assertions.filter(row => row.result === 'FAIL').length}, integrity: integrityRef, artifactIndex: indexRef, cleanup: cleanupRef, independentReview: 'PENDING', releaseApproval: 'NOT_ACCEPTED'};
  const resultRef = json(join(root, 'result.json'), result); console.log(JSON.stringify({runId, root, status: result.status, cards: result.cards, assertions: result.assertionCounts, referenceErrors: errors.length, resultRef, formalResults: cardRefs}, null, 2));
}
