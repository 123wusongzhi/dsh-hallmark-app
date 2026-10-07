/**
 * A.2 TST-025/026 minimum FIXTURE / actual-command acceptance.
 * Run: node test/acceptance/source-view-save-boundaries-a2.mjs
 * One private leased Runtime, real installed candidate.12 build/preview CLIs,
 * actual React/TSX/CSS compilation and fresh headless browser previews.
 * Synthetic authorizeFrame/ready is labelled FIXTURE, never LIVE_HOST.
 * Only this new harness and this run's private evidence are written.
 */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer as createPortServer} from 'node:net';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {evidenceFile, sourceInputDigest} from '../../packages/source-components/src/authoring-evidence.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {startAuthoringPreview} from '../../packages/source-components/src/authoring-preview.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const installed = 'C:/Users/wubil/.dsh/profiles/desktop/node_modules/dsh-plugin-apps-bundle';
const candidateVersion = '1.0.0-candidate.12';
const candidateDirectory = join(repository, 'evidence/apps-a2-20261007/candidates', candidateVersion);
const manifest = JSON.parse(readFileSync(join(candidateDirectory, 'build-manifest.json'), 'utf8'));
const archivePath = join(repository, 'artifacts/dsh-plugin-apps-bundle-1.0.0-candidate.12.tgz');
const archiveSha256 = '4ca9cf8cc8f5f727701c3457137142ea578ec85ee47f04044658699955b6051a';
const expectedCommit = '13f80f2cb351e979fc410c2b833e37860ceaf32e';
const buildCli = join(installed, 'lib/apps-authoring-build.js');
const previewCli = join(installed, 'lib/apps-authoring-preview.js');
const sdk = join(installed, 'sdk/component-runtime/apps-client.js');
const lockFilename = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'].find(name => existsSync(join(repository, name)));
assert.ok(lockFilename, 'Ordinary dependency lockfile is required');
const runId = 'a2-source-view-save-' + randomUUID();
const root = join(repository, 'evidence/apps-a2-20261007/formal-source-view-save', runId);
const sessionId = 'FIXTURE-HOST-' + runId;
const forbiddenPorts = new Set(['36994', '4180', '4280']);
const startedAt = new Date().toISOString();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => sha(readFileSync(path));
const assertions = [], traces = [], observedHttp = [], executions = [], cases = [];
let f, identity, identityRef, sourceBefore, failureRef, outcome = 'FAIL';
assert.equal(existsSync(root), false);
mkdirSync(root, {recursive: true});
function put(name, value) {
  const path = join(root, name); mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  return evidenceFile(path);
}
function check(id, expected, actual, pass, refs = [identityRef]) {
  const row = {id, expected, actual, status: pass ? 'PASS' : 'FAIL', observedAt: new Date().toISOString(), evidenceRefs: refs.filter(Boolean)};
  assertions.push(row); assert.ok(pass, JSON.stringify(row)); return row;
}
const excluded = new Set(['node_modules', '.git', '.preview', 'browser-profile']);
function inventory(directory, current = directory) {
  return readdirSync(current, {withFileTypes: true}).flatMap(entry => {
    if (excluded.has(entry.name)) return [];
    const path = join(current, entry.name); assert.equal(entry.isSymbolicLink(), false, path);
    return entry.isDirectory() ? inventory(directory, path) : entry.isFile() ? [{path: relative(directory, path).split(sep).join('/'), bytes: statSync(path).size, sha256: hashFile(path)}] : [];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
function copyObservation(directory, label) {
  const target = join(root, label), files = inventory(directory); assert.equal(existsSync(target), false);
  for (const file of files) put(label + '/' + file.path, readFileSync(join(directory, file.path)));
  return put(label + '-manifest.json', {sourceDirectory: directory, evidenceDirectory: target, observationOnly: true, files: inventory(target)});
}
function productionInputs() {return Object.entries(manifest.sourceInputs).map(([path, expected]) => ({path, expected, actual: hashFile(join(repository, path))}));}
function database(label) {
  const rows = Object.fromEntries(f.store.collections.map(table => [table, f.store.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  const sequence = Number(f.store.db.prepare('SELECT COALESCE(MAX(sequence),0) n FROM fixture_observation').get().n);
  const ref = put(label + '/database.json', {scope: 'FIXTURE_DB_RAW_SQL', databasePath: join(f.directory, 'apps.db'), at: new Date().toISOString(), userVersion: f.store.db.prepare('PRAGMA user_version').get(), rows, sequence});
  return {rows, sequence, ref};
}
function mutations(before, label) {
  return put(label + '/mutation-sequence.json', {observationOnly: true, afterSequence: before.sequence, rows: f.store.db.prepare('SELECT * FROM fixture_observation WHERE sequence>? ORDER BY sequence').all(before.sequence)});
}
function refs(operation) {return [operation.before.ref, operation.after.ref, operation.request, operation.response, operation.sequence];}
function componentCounts(snapshot) {return Object.fromEntries(['components', 'component_versions', 'saved_assets'].map(table => [table, snapshot.rows[table].length]));}
function unchangedLibrary(id, before, after, artifacts) {
  for (const table of ['components', 'component_versions', 'saved_assets']) check(id + '.' + table, before.rows[table], after.rows[table], canonicalJson(before.rows[table]) === canonicalJson(after.rows[table]), artifacts);
}
async function runtimeAt() {
  const directory = join(root, 'runtime'), instance = composeAppsRuntime(directory, {connections: []});
  const token = randomUUID() + randomUUID(), keyFile = join(directory, 'service-key');
  writeFileSync(keyFile, token, {flag: 'wx', mode: 0o600});
  instance.store.db.exec('CREATE TABLE fixture_observation(sequence INTEGER PRIMARY KEY AUTOINCREMENT,table_name TEXT,id TEXT,kind TEXT,old_json TEXT,new_json TEXT,observed_at TEXT)');
  for (const table of instance.store.collections) for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
    const row = operation === 'DELETE' ? 'OLD' : 'NEW', old = operation === 'INSERT' ? 'NULL' : 'OLD.value_json', next = operation === 'DELETE' ? 'NULL' : 'NEW.value_json';
    instance.store.db.exec(`CREATE TRIGGER fixture_${table}_${operation} AFTER ${operation} ON ${table} BEGIN INSERT INTO fixture_observation(table_name,id,kind,old_json,new_json,observed_at) VALUES('${table}',${row}.id,'${operation}',${old},${next},strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;`);
  }
  const server = createAppsServer({...instance, token});
  // Transparent observation captures the CLI's real runStart handshake too.
  // It never writes domain rows or changes request/response bytes.
  server.on('request', (request, response) => {
    const requestChunks = [], responseChunks = [], requestId = randomUUID(), at = new Date().toISOString();
    request.on('data', bytes => requestChunks.push(Buffer.from(bytes)));
    const originalWrite = response.write, originalEnd = response.end;
    response.write = function(chunk, encoding, callback) {if (chunk != null) responseChunks.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined)); return originalWrite.apply(this, arguments);};
    response.end = function(chunk, encoding, callback) {if (chunk != null) responseChunks.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined)); return originalEnd.apply(this, arguments);};
    response.on('finish', () => observedHttp.push({requestId, dispatchAt: at, finishedAt: new Date().toISOString(), method: request.method, path: request.url, requestBytesBase64: Buffer.concat(requestChunks).toString('base64'), responseBytesBase64: Buffer.concat(responseChunks).toString('base64'), status: response.statusCode, authorization: 'private fixture bearer; value excluded'}));
  });
  await new Promise((accept, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', accept);});
  const port = server.address().port; assert.ok(!forbiddenPorts.has(String(port)));
  const url = 'http://127.0.0.1:' + port;
  return {...instance, directory, server, keyFile, url, async call(path, input, label, binary = false) {
    const target = new URL(path, url); assert.equal(target.origin, url); assert.ok(!forbiddenPorts.has(target.port));
    const before = database(label + '/before'), rawInput = input === undefined ? null : JSON.stringify(input);
    const request = put(label + '/request.json', {method: input === undefined ? 'GET' : 'POST', url: target.href, body: rawInput, headers: {authorization: 'private fixture bearer; value excluded', ...(input === undefined ? {} : {'content-type': 'application/json'})}});
    const dispatchedAt = new Date().toISOString(), response = await fetch(target, {method: input === undefined ? 'GET' : 'POST', headers: {authorization: 'Bearer ' + token, ...(input === undefined ? {} : {'content-type': 'application/json'})}, ...(input === undefined ? {} : {body: rawInput})});
    const raw = Buffer.from(await response.arrayBuffer()), rawRef = put(label + '/response-body' + (binary ? '.bin' : '.json'), raw);
    const body = binary ? null : JSON.parse(raw.toString('utf8')), responseRef = put(label + '/response.json', {status: response.status, headers: Object.fromEntries(response.headers), raw: rawRef});
    const after = database(label + '/after'), sequence = mutations(before, label), trace = {label, dispatchedAt, settledAt: new Date().toISOString(), request, response: responseRef, before: before.ref, after: after.ref, sequence}; traces.push(trace);
    return {status: response.status, body, bytes: raw, request, response: responseRef, before, after, sequence};
  }, async action(capabilityId, input, label) {return this.call('/v1/presentation-actions', {sessionId, capabilityId, input, requestId: randomUUID()}, label);}, async close() {server.closeAllConnections(); await new Promise(accept => server.close(accept)); await instance.close();}};
}
function componentSource(title, multiplier) {
  return `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{createAppsClient}from'./apps-client.js';import'./style.css';\nfunction App(){const[state,setState]=useState({score:0,steps:0}),[ready,setReady]=useState(false);useEffect(()=>{const client=createAppsClient({timeoutMs:3000});let active=true;(async()=>{await client.hello();await client.getData();await client.getContext();await client.resize(480);if(active)setReady(true)})().catch(error=>{throw error});return()=>{active=false;client.dispose()}},[]);return <main><header><p>Ordinary source fixture</p><h1>${title}</h1></header><section className="orbit"><svg viewBox="0 0 120 100" aria-label="custom geometry"><path d="M5 80 Q60 5 115 80" fill="none" stroke="currentColor" strokeWidth="7"/><circle cx="60" cy="45" r="15"/></svg><div><p id="bridge">{ready?'ready':'waiting'}</p><button id="advance" onClick={()=>setState(value=>({score:value.score+${multiplier},steps:value.steps+1}))}>Advance orbit</button><output id="state">{state.score} / {state.steps}</output></div></section><footer>Custom React object state and free CSS layout</footer></main>}createRoot(document.getElementById('root')).render(<App/>);`;
}
function project(workspace, title, multiplier) {
  mkdirSync(join(workspace, 'src'), {recursive: true});
  copyFileSync(join(repository, 'package.json'), join(workspace, 'package.json'));
  copyFileSync(join(repository, lockFilename), join(workspace, lockFilename));
  copyFileSync(sdk, join(workspace, 'src/apps-client.js'));
  writeFileSync(join(workspace, 'src/Component.tsx'), componentSource(title, multiplier));
  writeFileSync(join(workspace, 'src/style.css'), '*{box-sizing:border-box}body{margin:0;font:16px system-ui;color:#173748;background:#e9f2ef}main{padding:24px;max-width:100%;overflow-wrap:anywhere}.orbit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;border:2px solid;padding:16px}svg{width:100%;max-width:160px}button{max-width:100%;padding:8px}output{display:block;font-size:28px}h1{font-size:24px}footer{margin-top:20px}');
  writeFileSync(join(workspace, 'build.mjs'), `import{build,version}from'esbuild';import{mkdirSync,writeFileSync}from'node:fs';mkdirSync('dist',{recursive:true});const result=await build({entryPoints:['src/Component.tsx'],bundle:true,format:'esm',outfile:'dist/app.js',metafile:true});writeFileSync('dist/metafile.json',JSON.stringify(result.metafile,null,2));writeFileSync('dist/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>');console.log(JSON.stringify({compiler:'esbuild',version,entry:'src/Component.tsx',reactInputs:Object.keys(result.metafile.inputs).filter(path=>path.includes('react'))}));`);
  symlinkSync(join(repository, 'node_modules'), join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
}
async function cli(entry, input, label) {
  const request = put(label + '/cli-request.json', input), before = database(label + '/cli-before'), at = new Date().toISOString();
  const child = spawn(process.execPath, [entry, request.path], {cwd: f.directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = ''; child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const exitCode = await new Promise((accept, reject) => {child.once('error', reject); child.once('close', accept);});
  const stdoutRef = put(label + '/stdout.txt', stdout), stderrRef = put(label + '/stderr.txt', stderr);
  let result = null; try {result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));} catch {}
  const after = database(label + '/cli-after'), sequence = mutations(before, label + '/cli');
  const execution = {command: [process.execPath, entry, request.path], cwd: f.directory, pid: child.pid, startedAt: at, finishedAt: new Date().toISOString(), exitCode, request, stdout: stdoutRef, stderr: stderrRef, result, before: before.ref, after: after.ref, sequence};
  const ref = put(label + '/execution.json', execution); executions.push(execution); return {...execution, ref};
}
async function begin(mode, viewId, label) {
  const response = await f.action('apps.authoring.begin', {mode, ...(viewId ? {viewId} : {})}, label);
  assert.equal(response.body.status, 'ok', JSON.stringify(response.body)); return {...response.body.data, operation: response};
}
async function build(attempt, label, good = true) {
  const execution = await cli(buildCli, {sessionId, attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, sourceRevision: attempt.attempt.sourceRevision, workspacePath: attempt.draft.workspacePath, command: [process.execPath, 'build.mjs'], evidenceRoot: f.evidenceRunner.root, archiveRoot: f.presentation.sources.directory, runtime: {url: f.url, keyFile: f.keyFile}}, label);
  assert.ok(execution.result?.reportRef, JSON.stringify(execution));
  const report = f.evidenceRunner.readReport(execution.result.reportRef);
  assert.equal(report.verdict, good ? 'PASS' : 'FAIL');
  const operation = await f.action('apps.authoring.record_build', {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, reportRef: execution.result.reportRef}, label + '/record-build');
  assert.equal(operation.body.status, 'ok', JSON.stringify(operation.body));
  return {execution, report, receipt: operation.body.data, operation};
}
async function preview(attempt, built, multiplier, title, label, record = true) {
  const execution = await cli(previewCli, {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, buildReceiptId: built.receipt.receiptId, buildReportRef: built.execution.result.reportRef, mode: 'fixture', evidenceRoot: f.evidenceRunner.root, archiveRoot: f.presentation.sources.directory, data: {source: 'F-DATA_SYNTHETIC', rows: []}, context: {mode: 'fixture', preview: true, businessWritesAllowed: false}, assertions: [{id: 'title', selector: 'h1', check: 'text', expected: title}, {id: 'custom-state', action: 'click', selector: '#advance', checkSelector: '#state', check: 'text', expected: multiplier + ' / 1'}, {id: 'free-layout', selector: 'svg path', check: 'count', expected: 1}]}, label);
  assert.equal(execution.exitCode, 0, JSON.stringify(execution));
  const report = f.evidenceRunner.verifyPreview(execution.result.reportRef, f.presentation.sources); assert.equal(report.verdict, 'PASS');
  let operation = null; if (record) {operation = await f.action('apps.authoring.record_preview', {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, buildReceiptId: built.receipt.receiptId, reportRef: execution.result.reportRef}, label + '/record-preview'); assert.equal(operation.body.status, 'ok', JSON.stringify(operation.body));}
  return {execution, report, receipt: operation?.body.data, operation};
}
function artifact(built, label) {
  const buildId = built.receipt.archiveBuildId, directory = join(f.presentation.sources.directory, 'builds', buildId);
  return {buildId, directory, files: inventory(directory), ref: put(label + '/archive.json', {buildId, directory, verify: f.presentation.sources.verify(buildId), manifest: f.presentation.sources.manifest(buildId), files: inventory(directory)})};
}
async function readArchive(original, label) {
  const manifestResponse = await f.call('/source-builds/' + original.buildId + '/manifest', undefined, label + '/manifest');
  const fileResponses = [];
  for (const name of manifestResponse.body.files) {
    const response = await f.call('/source-builds/' + original.buildId + '/files/' + encodeURIComponent(name), undefined, label + '/file-' + name.replaceAll('/', '_'), true);
    assert.equal(response.status, 200); assert.equal(sha(response.bytes), hashFile(join(original.directory, 'project/dist', name))); fileResponses.push(...refs(response));
  }
  check(label + '.readableImmutable', original.files, inventory(original.directory), f.presentation.sources.verify(original.buildId).valid && canonicalJson(original.files) === canonicalJson(inventory(original.directory)), [original.ref, ...refs(manifestResponse), ...fileResponses]);
}
async function archivedBrowser(original, title, multiplier, label) {
  // A new-source receipt cannot be replayed against its now-edited cwd. The
  // existing frozen archive is served directly, without altering that workspace
  // or fabricating a new build/preview receipt. Raw CDP and bridge are retained.
  const before = database(label + '/before');
  const carrier = await startAuthoringPreview({sources: f.presentation.sources, buildId: original.buildId, mode: 'fixture', data: {source: 'F-DATA_SYNTHETIC', rows: []}, context: {mode: 'fixture', preview: true}});
  const carrierUrl = new URL(carrier.url); assert.equal(carrierUrl.hostname, '127.0.0.1'); assert.ok(!forbiddenPorts.has(carrierUrl.port));
  const reserve = createPortServer(); await new Promise(accept => reserve.listen(0, '127.0.0.1', accept)); const port = reserve.address().port; await new Promise(accept => reserve.close(accept)); assert.ok(!forbiddenPorts.has(String(port)));
  const executable = process.env.DSH_PREVIEW_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'; assert.ok(existsSync(executable));
  const args = ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + port, '--user-data-dir=' + join(root, label, 'browser-profile'), 'about:blank'];
  const child = spawn(executable, args, {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
  const pause = ms => new Promise(accept => setTimeout(accept, ms)), pending = new Map(), transcript = [], viewports = [];
  let stderr = '', socket, sequence = 0, version; child.stderr.on('data', bytes => stderr += bytes);
  const command = (method, params = {}) => new Promise((accept, reject) => {const id = ++sequence, message = {id, method, params}, timer = setTimeout(() => {pending.delete(id); reject(Error('CDP timeout ' + method));}, 10000); pending.set(id, {accept: value => {clearTimeout(timer); accept(value);}, reject: error => {clearTimeout(timer); reject(error);}}); transcript.push({direction: 'request', at: new Date().toISOString(), message}); socket.send(JSON.stringify(message));});
  const evaluate = async expression => {const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value;};
  try {
    let pages; for (let n = 0; n < 100; n++) {try {pages = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json()); if (pages.length) break;} catch {} await pause(100);}
    assert.ok(pages?.length); socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl); await new Promise((accept, reject) => {socket.addEventListener('open', accept, {once: true}); socket.addEventListener('error', reject, {once: true});});
    socket.addEventListener('message', event => {const message = JSON.parse(event.data); transcript.push({direction: 'response/event', at: new Date().toISOString(), message}); const request = pending.get(message.id); if (request) {pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.accept(message.result);}});
    version = await command('Browser.getVersion'); await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
    for (const width of [420, 1040]) {
      await command('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: false}); await command('Page.navigate', {url: carrier.url});
      let ready = false; for (let n = 0; n < 100; n++) {ready = await evaluate("Boolean(window.__APPS_PREVIEW?.bridgeReady&&window.__APPS_PREVIEW?.dataRead&&document.querySelector('iframe').contentDocument.querySelector('#bridge')?.textContent==='ready')"); if (ready) break; await pause(100);} assert.ok(ready, 'Archived bridge should become ready');
      await evaluate("document.querySelector('iframe').contentDocument.querySelector('#advance').click()"); await pause(80);
      const actual = await evaluate("(()=>{const d=document.querySelector('iframe').contentDocument;return {title:d.querySelector('h1').textContent,state:d.querySelector('#state').textContent,buildId:window.__APPS_PREVIEW.identity.buildId,bridge:window.__APPS_PREVIEW,svgPaths:d.querySelectorAll('svg path').length}})()");
      const screenshot = put(label + '/viewport-' + width + '.png', Buffer.from((await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false})).data, 'base64'));
      assert.equal(actual.title, title); assert.equal(actual.state, multiplier + ' / 1'); assert.equal(actual.buildId, original.buildId); assert.equal(actual.svgPaths, 1);
      viewports.push({width, height: 900, deviceScaleFactor: 1, actual, screenshot});
    }
    assert.equal(transcript.filter(row => row.message.method === 'Runtime.exceptionThrown').length, 0);
    return {ref: put(label + '/actual-browser-observations.json', {scope: 'FIXTURE', signedReceipt: false, archive: original.ref, runtimeBefore: before.ref, browserVersion: version, carrierIdentity: carrier.identity, carrierEvents: carrier.events, viewports}), viewports};
  } finally {
    if (socket) await command('Browser.close').catch(() => {});
    for (let n = 0; n < 30 && child.exitCode === null; n++) await pause(100);
    if (child.exitCode === null) child.kill(); socket?.close(); await carrier.close();
    if (child.exitCode === null) await new Promise(accept => {const timer = setTimeout(accept, 2000); child.once('close', () => {clearTimeout(timer); accept();});});
    let spawnedPidPresent = false; try {process.kill(child.pid, 0); spawnedPidPresent = true;} catch {}
    const after = database(label + '/after');
    put(label + '/raw-cdp-transcript.json', transcript);
    put(label + '/browser-process.json', {command: [executable, ...args], pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode, stderr, spawnedPidPresent, before: before.ref, after: after.ref, sequence: mutations(before, label)});
    assert.equal(spawnedPidPresent, false, 'Only owned fresh browser must be stopped');
  }
}
try {
  const executedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repository, encoding: 'utf8'}).trim(); assert.equal(executedCommit, expectedCommit);
  assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim(), '');
  sourceBefore = productionInputs(); assert.equal(sourceBefore.length, 143); assert.ok(sourceBefore.every(item => item.expected === item.actual));
  assert.equal(hashFile(archivePath), archiveSha256);
  const installedPackage = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')); assert.equal(installedPackage.version, candidateVersion);
  const installedArtifacts = Object.entries(manifest.artifacts).map(([path, expected]) => ({path, expected, actual: hashFile(join(installed, path))})); assert.ok(installedArtifacts.every(item => item.expected === item.actual));
  for (const item of installedArtifacts) put('frozen-package/' + item.path, readFileSync(join(installed, item.path)));
  const frozenArchive = put('frozen-candidate-archive.tgz', readFileSync(archivePath));
  const frozenManifest = put('frozen-candidate-build-manifest.json', readFileSync(join(candidateDirectory, 'build-manifest.json')));
  const frozenLock = put('frozen-dependency-lock/' + lockFilename, readFileSync(join(repository, lockFilename)));
  const acceptance = put('frozen-requirements/03_ACCEPTANCE.md', readFileSync(join(repository, 'docs/requirements/A2/docs/03_ACCEPTANCE.md')));
  const spec = put('frozen-requirements/02_SPEC.md', readFileSync(join(repository, 'docs/requirements/A2/docs/02_SPEC.md')));
  for (const item of sourceBefore) put('executed-source/' + item.path, readFileSync(join(repository, item.path)));
  const harness = put('executed-harness.mjs', readFileSync(fileURLToPath(import.meta.url)));
  identity = {runId, startedAt, executedCommit, targetCommit: expectedCommit, gitStatus: execFileSync('git', ['status', '--porcelain'], {cwd: repository, encoding: 'utf8'}), node: process.version, platform: process.platform, architecture: process.arch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, os: execFileSync('powershell.exe', ['-NoProfile', '-Command', '[System.Environment]::OSVersion.VersionString'], {encoding: 'utf8', windowsHide: true}).trim(), candidateVersion, versions: JSON.parse(readFileSync(join(installed, 'versions.json'), 'utf8')), archive: frozenArchive, candidateManifest: frozenManifest, harness, sourceManifest: put('executed-source-manifest.json', {files: inventory(join(root, 'executed-source')), candidateSourceInputs: sourceBefore}), installedArtifacts, executedCliPaths: {build: buildCli, preview: previewCli}, buildCli: evidenceFile(join(root, 'frozen-package/lib/apps-authoring-build.js')), previewCli: evidenceFile(join(root, 'frozen-package/lib/apps-authoring-preview.js')), sdk: evidenceFile(join(root, 'frozen-package/sdk/component-runtime/apps-client.js')), dependencies: ['react', 'react-dom', 'esbuild'].map(name => ({name, version: JSON.parse(readFileSync(join(repository, 'node_modules', name, 'package.json'), 'utf8')).version})), dependencyLock: frozenLock, acceptance, spec, scope: 'FIXTURE / actual-command; source Runtime at exact frozen candidate.12 inputs; installed candidate.12 CLIs and SDK', forbiddenPorts: [...forbiddenPorts], sharedLockedDependencies: true, cleanInstallClaimed: false};
  identityRef = put('identity.json', identity); f = await runtimeAt();
  const runtimeIdentity = await f.call('/v1/runtime', undefined, 'setup/runtime-identity');
  put('fixtures.json', {F_SOURCE: 'Empty new workspace; ordinary React/TSX/CSS, package manifest and ordinary repository lock, shared locked dependencies; A good, B actual change, Bbad real compiler syntax failure with previous dist retained', F_FRAME: 'Fresh installed candidate.12 v2 SDK and CLI headless previews at actual 420/1040 widths. Synthetic Runtime frame-ready explicitly FIXTURE.', F_HOST: {scope: 'FIXTURE', sessionId, privateRuntime: f.directory, url: f.url, writerLease: f.lease.path, ownerId: f.lease.ownerId, originalDesktopTouched: false}, F_APPS: 'No domain binding or backend required; connections=[], all source UI data explicitly synthetic', runtimeIdentity: refs(runtimeIdentity), businessWrites: 0, modelCalls: 0});

  const a = await begin('new', null, 'TST-025/01-empty-begin');
  const emptyRef = put('TST-025/01-empty-begin/workspace.json', {directory: a.draft.workspacePath, files: inventory(a.draft.workspacePath)});
  check('025.emptyTemplate', [], inventory(a.draft.workspacePath), inventory(a.draft.workspacePath).length === 0, [...refs(a.operation), emptyRef]);
  project(a.draft.workspacePath, 'A custom orbit', 7);
  const aSourceRef = copyObservation(a.draft.workspacePath, 'TST-025/02-source-A');
  const aBuild = await build(a, 'TST-025/03-build-A'), aArtifact = artifact(aBuild, 'TST-025/03-build-A');
  const meta = JSON.parse(readFileSync(join(a.draft.workspacePath, 'dist/metafile.json'), 'utf8'));
  check('025.actualReactBuildRegistered', {exitCode: 0, verdict: 'PASS', archiveValid: true}, {exitCode: aBuild.report.exitCode, verdict: aBuild.receipt.verdict, buildId: aBuild.receipt.archiveBuildId, sourceInputs: Object.keys(meta.inputs)}, aBuild.report.exitCode === 0 && aBuild.receipt.verdict === 'PASS' && f.presentation.sources.verify(aBuild.receipt.archiveBuildId).valid && Object.keys(meta.inputs).some(path => path.includes('react-dom')) && Object.keys(meta.inputs).includes('src/Component.tsx'), [aSourceRef, aBuild.execution.ref, aBuild.execution.result.reportRef, ...refs(aBuild.operation), aArtifact.ref]);
  const aPreview = await preview(a, aBuild, 7, 'A custom orbit', 'TST-025/04-preview-A');
  check('025.customStateAndFreeLayoutDisplayed', 'Ordinary React object state 7 / 1 and SVG/CSS layout passes at 420 and 1040 without fixed-control renderer imports', aPreview.report, aPreview.report.verdict === 'PASS' && aPreview.report.viewportResults.length === 2 && !Object.keys(meta.inputs).some(path => /presentation-manager|view-renderer|fixed-controls/.test(path)), [aSourceRef, aArtifact.ref, aPreview.execution.ref, aPreview.execution.result.reportRef, ...refs(aPreview.operation), ...aPreview.report.viewportResults.map(row => row.screenshot)]);

  const openOne = await f.action('apps.presentation.open_source_component', {directory: a.draft.workspacePath, viewId: a.view.viewId, title: 'View one A'}, 'TST-026/01-open-A-one'); assert.equal(openOne.body.status, 'ok');
  const openTwo = await f.action('apps.presentation.open_source_component', {directory: a.draft.workspacePath, title: 'View two A'}, 'TST-026/02-open-A-two'); assert.equal(openTwo.body.status, 'ok');
  const viewOne = openOne.body.data, viewTwo = openTwo.body.data;
  check('026.twoDistinctViewsSameA', {distinctViewIds: true, buildId: aArtifact.buildId}, [viewOne, viewTwo], viewOne.viewId !== viewTwo.viewId && viewOne.source.buildId === aArtifact.buildId && viewTwo.source.buildId === aArtifact.buildId, [...refs(openOne), ...refs(openTwo), aArtifact.ref]);
  unchangedLibrary('026.openSourceNeverSaves', openOne.before, openTwo.after, [...refs(openOne), ...refs(openTwo)]);
  check('026.noSavedVersionsBeforeB', {components: 0, component_versions: 0, saved_assets: 0}, componentCounts(openTwo.after), Object.values(componentCounts(openTwo.after)).every(value => value === 0), refs(openTwo));
  const otherRaw = openTwo.after.rows.views.find(row => row.id === viewTwo.viewId);
  const b = await begin('edit', viewOne.viewId, 'TST-026/03-begin-B');
  // The edit uses the same recoverable draft; only actual source is changed.
  writeFileSync(join(b.draft.workspacePath, 'src/Component.tsx'), componentSource('B custom orbit', 11));
  const bSourceRef = copyObservation(b.draft.workspacePath, 'TST-026/04-source-B');
  const bBuild = await build(b, 'TST-026/05-build-B'), bArtifact = artifact(bBuild, 'TST-026/05-build-B');
  const bPreview = await preview(b, bBuild, 11, 'B custom orbit', 'TST-026/06-preview-B');
  const publicationInput = {attemptId: b.attempt.attemptId, epoch: b.attempt.epoch, viewId: viewOne.viewId, expectedViewRevision: b.attempt.expectedViewRevision, buildId: bArtifact.buildId, buildReceiptId: bBuild.receipt.receiptId, previewReceiptId: bPreview.receipt.receiptId};
  const publish = await f.action('apps.authoring.publish', publicationInput, 'TST-026/07-publish-B'); assert.equal(publish.body.status, 'ok');
  unchangedLibrary('026.authoringPublishNeverSaves', publish.before, publish.after, refs(publish));
  check('026.publishIsMountingBeforeReady', 'mounting with view one still A', publish.body.data, publish.body.data.state === 'mounting' && f.store.get('views', viewOne.viewId).activeBuildId === aArtifact.buildId, refs(publish));
  const frame = {publicationId: publish.body.data.publicationId, attemptId: b.attempt.attemptId, attemptEpoch: b.attempt.epoch, viewId: viewOne.viewId, buildId: bArtifact.buildId, frameInstanceId: 'FIXTURE-' + randomUUID(), documentNonce: 'FIXTURE-' + randomUUID(), clientFeatures: ['renderReadyV1', 'uiStateV1']};
  const grant = await f.call('/v1/authoring/authorizeFrame', {sessionId, params: frame}, 'TST-026/08-synthetic-FIXTURE-frame'); assert.equal(grant.status, 200);
  const ready = await f.call('/v1/component-extension', {protocolVersion: '2.0', sessionId, viewId: frame.viewId, buildId: frame.buildId, frameInstanceId: frame.frameInstanceId, channel: 'dsh.apps.component.v2', type: 'extension', feature: 'renderReadyV1', action: 'ready', requestId: randomUUID(), params: {documentNonce: frame.documentNonce, checks: {rendered: true, bridgeReady: true, dataRead: true, unhandledErrors: [], assertionResults: bPreview.receipt.assertionResults}}}, 'TST-026/09-synthetic-FIXTURE-ready'); assert.equal(ready.status, 200); assert.equal(ready.body.result.publication.state, 'mounted');
  put('TST-026/09-synthetic-FIXTURE-ready/scope.json', {scope: 'FIXTURE', nativeDesktopFrame: false, checksSyntheticForStateTransition: true, actualBrowserPreviewSeparate: bPreview.execution.result.reportRef, grant: refs(grant), ready: refs(ready)});
  unchangedLibrary('026.confirmedPublishNeverSaves', openTwo.after, ready.after, [...refs(publish), ...refs(grant), ...refs(ready)]);
  check('026.onlyTargetViewMovedToB', {one: bArtifact.buildId, otherRawUnchanged: true}, ready.after.rows.views, f.store.get('views', viewOne.viewId).activeBuildId === bArtifact.buildId && canonicalJson(otherRaw) === canonicalJson(ready.after.rows.views.find(row => row.id === viewTwo.viewId)), [...refs(ready), ...refs(openTwo), bArtifact.ref]);
  const archivedOther = await f.call('/v1/views/' + viewTwo.viewId + '?sessionId=' + encodeURIComponent(sessionId), undefined, 'TST-026/10-read-other-A');
  check('026.otherViewPublicReadStillA', aArtifact.buildId, archivedOther.body.source.buildId, archivedOther.status === 200 && archivedOther.body.source.buildId === aArtifact.buildId, refs(archivedOther));
  await readArchive(aArtifact, 'TST-026/11-A-archive-after-B');
  const save = await f.action('apps.authoring.save_component', {viewId: viewOne.viewId, expectedViewRevision: f.store.get('views', viewOne.viewId).viewRevision, mode: 'save_as', title: 'Explicitly saved B orbit', userRequest: '明确保存 FIXTURE 的 B orbit 组件；该原话为隔离验收操作。'}, 'TST-026/12-explicit-save-B'); assert.equal(save.body.status, 'ok');
  check('026.explicitSaveCreatesExactlyOneVersion', {components: 1, component_versions: 1, saved_assets: 1, revision: 1, build: bArtifact.buildId}, {counts: componentCounts(save.after), component: save.body.data}, Object.values(componentCounts(save.before)).every(value => value === 0) && Object.values(componentCounts(save.after)).every(value => value === 1) && save.body.data.revision === 1 && save.body.data.view.source.buildId === bArtifact.buildId, refs(save));
  const versionWrites = f.store.db.prepare("SELECT * FROM fixture_observation WHERE table_name='component_versions' ORDER BY sequence").all();
  check('026.onlySaveStepWroteComponentVersion', 'Exactly one component_versions INSERT, strictly within explicit save boundary', versionWrites, versionWrites.length === 1 && versionWrites[0].kind === 'INSERT' && versionWrites[0].sequence > save.before.sequence && versionWrites[0].sequence <= save.after.sequence, refs(save));
  cases.push({testId: 'TST-026', status: 'PASS', steps: ['A actual build registered; open_source opens two independent views and zero library rows', 'B actual source build/preview and publish updates only view one after synthetic FIXTURE ready; no autosave', 'A archive and view two remain exact immutable A', 'Only explicit save creates component revision 1'], evidenceRefs: [aArtifact.ref, bSourceRef, bArtifact.ref, ...refs(save)]});

  const lastGoodView = structuredClone(f.store.get('views', viewOne.viewId)), savedComponent = structuredClone(save.body.data);
  const bad = await begin('edit', viewOne.viewId, 'TST-025/05-begin-real-compile-error');
  const oldDist = inventory(bad.draft.workspacePath).filter(row => row.path.startsWith('dist/'));
  writeFileSync(join(bad.draft.workspacePath, 'src/Component.tsx'), "import React from 'react';\nconst REAL_COMPILER_ERROR = <main>unclosed\n");
  const badSourceRef = copyObservation(bad.draft.workspacePath, 'TST-025/06-source-Bbad');
  const badBuild = await build(bad, 'TST-025/07-build-Bbad', false);
  check('025.realCompilerFailureSignedAndRecorded', {nonzeroActualCommand: true, verdict: 'FAIL', archiveBuildId: null}, badBuild.report, badBuild.report.exitCode !== 0 && badBuild.report.verdict === 'FAIL' && badBuild.receipt.archiveBuildId === null && f.store.get('authoring_attempts', bad.attempt.attemptId).state === 'build_failed', [badSourceRef, badBuild.execution.ref, badBuild.execution.result.reportRef, ...refs(badBuild.operation)]);
  const badPublish = await f.action('apps.authoring.publish', {...publicationInput, attemptId: bad.attempt.attemptId, epoch: bad.attempt.epoch, expectedViewRevision: bad.attempt.expectedViewRevision, buildReceiptId: badBuild.receipt.receiptId}, 'TST-025/08-reject-Bbad-publication');
  check('025.failedBuildCannotPublishOldResidualDist', 'State/evidence gate rejects failed attempt', badPublish.body, badPublish.body.status === 'failed' && ['ATTEMPT_SUPERSEDED', 'ATTEMPT_STATE_INVALID', 'BUILD_EVIDENCE_INVALID'].includes(badPublish.body.error?.code), refs(badPublish));
  check('025.compilerErrorPreservesLastGoodView', lastGoodView, f.store.get('views', viewOne.viewId), canonicalJson(lastGoodView) === canonicalJson(f.store.get('views', viewOne.viewId)), [...refs(bad.operation), ...refs(badBuild.operation), ...refs(badPublish)]);
  unchangedLibrary('025.compilerErrorPreservesSavedLibrary', save.after, badPublish.after, [...refs(save), ...refs(bad.operation), ...refs(badBuild.operation), ...refs(badPublish)]);
  check('025.compilerErrorPreservesSavedComponentBytes', savedComponent, f.store.get('components', savedComponent.componentId), canonicalJson(savedComponent) === canonicalJson(f.store.get('components', savedComponent.componentId)), [...refs(save), ...refs(badPublish)]);
  check('025.errorFixtureActuallyRetainedPriorDist', oldDist, inventory(bad.draft.workspacePath).filter(row => row.path.startsWith('dist/')), canonicalJson(oldDist) === canonicalJson(inventory(bad.draft.workspacePath).filter(row => row.path.startsWith('dist/'))), [badSourceRef, badBuild.execution.ref]);
  await readArchive(bArtifact, 'TST-025/09-last-good-B-readable');
  await readArchive(aArtifact, 'TST-025/10-A-still-readable');
  const recoveryPreview = await archivedBrowser(bArtifact, 'B custom orbit', 11, 'TST-025/11-last-good-real-browser-after-error');
  check('025.oldAvailableBStillRendersAfterError', 'Archived B still passes actual browser custom-state 11 / 1 at both widths after failed source build', recoveryPreview.viewports, recoveryPreview.viewports.length === 2, [recoveryPreview.ref, ...recoveryPreview.viewports.map(row => row.screenshot), ...refs(badPublish)]);
  cases.push({testId: 'TST-025', status: 'PASS', steps: ['Empty template, ordinary React/TSX/CSS compile and signed build registration', 'Actual custom React state and free SVG/CSS layout render at 420/1040; no fixed-control renderer imported', 'Real compiler syntax error leaves prior dist, publish is rejected, exact view/library bytes retained', 'Last-good immutable B loads and interacts in a fresh browser after error'], evidenceRefs: [aSourceRef, aArtifact.ref, aPreview.execution.result.reportRef, badSourceRef, badBuild.execution.ref, badBuild.execution.result.reportRef, recoveryPreview.ref]});
  const sourceAfter = productionInputs(), sourceGuard = put('production-source-drift.json', {before: sourceBefore, after: sourceAfter, sourceInputs: sourceAfter.length, mismatches: sourceAfter.filter(item => item.expected !== item.actual), candidateArchiveBeforeSha256: archiveSha256, candidateArchiveAfterSha256: hashFile(archivePath), installedArtifactsAfter: installedArtifacts.map(item => ({...item, actual: hashFile(join(installed, item.path))}))});
  check('identity.frozenProductionUnchanged', '143 frozen source inputs, candidate archive, installed artifacts and harness unchanged', sourceAfter, canonicalJson(sourceAfter) === canonicalJson(sourceBefore) && hashFile(archivePath) === archiveSha256 && installedArtifacts.every(item => hashFile(join(installed, item.path)) === item.expected) && identity.harness.sha256 === hashFile(fileURLToPath(import.meta.url)), [sourceGuard, identityRef]);
  outcome = 'PASS';
} catch (error) {failureRef = put('failure.json', {message: error.message, stack: error.stack, at: new Date().toISOString()}); process.exitCode = 1;}
finally {
  const cleanup = [];
  if (f) {try {const finalDb = database('cleanup/final-database'); await f.close(); cleanup.push({url: f.url, directory: f.directory, database: finalDb.ref, serverClosed: !f.server.listening, leasePath: f.lease.path, leaseReleased: !existsSync(f.lease.path)}); assert.ok(!f.server.listening && !existsSync(f.lease.path));} catch (error) {outcome = 'FAIL'; process.exitCode = 1; cleanup.push({error: error.message});}}
  let ownedProcesses = [];
  try {const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('chrome.exe','msedge.exe','node.exe') -and $_.ProcessId -ne ${process.pid} -and $_.CommandLine -and $_.CommandLine.Contains('${runId}') } | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Depth 4 -Compress`], {encoding: 'utf8', windowsHide: true}).trim(); ownedProcesses = raw ? JSON.parse(raw) : []; if (!Array.isArray(ownedProcesses)) ownedProcesses = [ownedProcesses]; assert.equal(ownedProcesses.length, 0);} catch (error) {outcome = 'FAIL'; process.exitCode = 1; cleanup.push({processCheckError: error.message});}
  const cleanupRef = put('cleanup.json', {cleanup, ownedProcesses, remainingOwnedProcesses: ownedProcesses.length, originalDesktopTouched: false, productionDataReadOrWritten: false, businessWrites: 0, modelCalls: 0});
  const traceRef = put('http-traces.json', traces), rawHttpRef = put('http-server-raw-transcript.json', observedHttp), executionRef = put('executions.json', executions), assertionRef = put('assertions.json', assertions);
  const finishedAt = new Date().toISOString(), records = [], reviewRecords = [];
  for (const testId of ['TST-025', 'TST-026']) {
    const selected = assertions.filter(row => row.id.startsWith(testId.slice(4) + '.')), card = cases.find(row => row.testId === testId), status = outcome === 'PASS' && card?.status === 'PASS' ? 'PASS' : 'FAIL';
    records.push(put(testId + '/FIXTURE/result.json', {recordKind: 'EXECUTED_ACCEPTANCE', testId, requirementIds: [testId.replace('TST', 'REQ')], runId, releaseId: 'apps-a2-20261007', targetCommit: expectedCommit, executedCommit: identity?.executedCommit ?? null, candidateVersion, candidateArchiveSha256: archiveSha256, scope: 'FIXTURE', executionKind: 'FIXTURE_EXECUTION', status, completeScope: status === 'PASS', modelClass: 'NONE', startedAt, finishedAt, environment: identity ?? null, versions: identity?.versions ?? null, fixtureRefs: existsSync(join(root, 'fixtures.json')) ? [evidenceFile(join(root, 'fixtures.json'))] : [], steps: card?.steps ?? [], assertions: selected, assertionCounts: {total: selected.length, passed: selected.filter(row => row.status === 'PASS').length, failed: selected.filter(row => row.status === 'FAIL').length}, artifactRefs: [identityRef, traceRef, rawHttpRef, executionRef, assertionRef, cleanupRef, ...(card?.evidenceRefs ?? []), ...(failureRef ? [failureRef] : [])].filter(Boolean), executor: 'Codex /root/source_view_save_acceptance', reviewer: null, independentReview: 'PENDING', releaseApproval: 'NOT_ACCEPTED', limitations: ['Minimum FIXTURE / actual-command only; no LIVE_HOST, original Agent, model, business or data-cutover claim.', 'Runtime source helpers match all 143 frozen candidate.12 inputs; installed candidate.12 build/preview/SDK artifact hashes are verified.', 'Actual headless v2 preview renders/interacts at 420/1040. Runtime frame authorization/ready checks are synthetic FIXTURE confirmations.', 'Ordinary repository manifest/lock and shared locked node_modules; clean install was not tested.', 'No native DSH or user Bill paths, processes, sessions, drafts or data were accessed.']}));
    reviewRecords.push(put(testId + '/FIXTURE/integrity-review-record.json', {schemaVersion: 1, recordKind: 'ACCEPTANCE_EXECUTION', testId, runId, candidate: candidateVersion, executedCommit: identity?.executedCommit ?? null, scope: ['FIXTURE'], modelClass: 'NONE', executionKind: 'FIXTURE_EXECUTION', status, assertions: selected.map(({id, expected, actual, status}) => ({id, expected, actual, status})), artifacts: [records.at(-1), identityRef, traceRef, rawHttpRef, executionRef, assertionRef, cleanupRef, ...(card?.evidenceRefs ?? [])].filter(Boolean).map(ref => ({...ref, kind: 'result'})), metrics: [{name: 'passedAssertions', value: selected.filter(row => row.status === 'PASS').length, unit: 'count'}]}));
  }
  const references = new Map();
  function visit(value) {if (!value || typeof value !== 'object') return; if (typeof value.path === 'string' && isAbsolute(value.path) && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.bytes)) references.set(value.path + '|' + value.sha256, value); for (const item of Object.values(value)) visit(item);}
  for (const file of inventory(root).filter(item => item.path.endsWith('.json'))) {try {visit(JSON.parse(readFileSync(join(root, file.path), 'utf8')));} catch (error) {if (!(error instanceof SyntaxError)) throw error;}}
  const referenceErrors = [];
  for (const ref of references.values()) {try {const bytes = readFileSync(ref.path); if (bytes.length !== ref.bytes || sha(bytes) !== ref.sha256) referenceErrors.push({reference: ref, error: 'FILE_REF_MISMATCH'});} catch (error) {referenceErrors.push({reference: ref, error: error.message});}}
  const integrityRef = put('reference-integrity.json', {checkedAt: new Date().toISOString(), uniqueReferences: references.size, references: [...references.values()], errors: referenceErrors});
  if (referenceErrors.length) {outcome = 'FAIL'; process.exitCode = 1;}
  const indexRef = put('artifact-index.json', {files: inventory(root).map(row => ({...row, path: join(root, row.path)}))});
  const resultRef = put('result.json', {runId, root, scope: 'FIXTURE', outcome, executedCommit: identity?.executedCommit ?? null, candidateVersion, candidateArchiveSha256: archiveSha256, startedAt, finishedAt, records, reviewRecords, cases, assertions: {total: assertions.length, passed: assertions.filter(row => row.status === 'PASS').length, failed: assertions.filter(row => row.status === 'FAIL').length}, identity: identityRef, httpTraces: traceRef, rawHttpTranscript: rawHttpRef, executions: executionRef, assertionRecords: assertionRef, cleanup: cleanupRef, referenceIntegrity: integrityRef, artifactIndex: indexRef, failure: failureRef ?? null, independentReview: 'PENDING', releaseApproval: 'NOT_ACCEPTED'});
  console.log(JSON.stringify({runId, root, outcome, resultRef, records, assertions: {total: assertions.length, passed: assertions.filter(row => row.status === 'PASS').length, failed: assertions.filter(row => row.status === 'FAIL').length}, referenceIntegrity: integrityRef, referenceErrors: referenceErrors.length, cleanup}, null, 2));
}
