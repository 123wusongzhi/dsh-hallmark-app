/**
 * A.2 TST-055/TST-056: retained evidence, not a desktop or model acceptance.
 * Run from the repository with: node test/acceptance/authoring-build-archive-a2.mjs
 * Uses the installed candidate.10 build/preview CLIs, actual esbuild/React and
 * headless Chrome. Runtime HTTP/state/storage are current-HEAD source helpers.
 * Every Runtime, request, archive and damaged copy is a fresh private fixture.
 * Synthetic frame-ready is explicitly FIXTURE and never touches the live host.
 */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {sourceInputDigest, evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const installed = 'C:/Users/wubil/.dsh/profiles/desktop/node_modules/dsh-plugin-apps-bundle';
const buildCli = join(installed, 'lib/apps-authoring-build.js');
const previewCli = join(installed, 'lib/apps-authoring-preview.js');
const lockFilename = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'].find(name => existsSync(join(repository, name)));
assert.ok(lockFilename, 'Repository ordinary dependency lockfile is required');
const expectedBuildSha = '3de42a6726c7f08a768f76f8f660dd0d5a5eeea955fef4e628540178449b4958';
const expectedPreviewSha = 'c3afef42b3a707985cae57ae4c360833c3362368485ebbcdfca99432dfa18635';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => sha(readFileSync(path));
const runId = `a2-build-archive-${randomUUID()}`;
const root = join(repository, 'evidence/apps-a2-20261007/formal-build-archive', runId);
const sessionId = `fixture-${runId}`;
const forbiddenPorts = new Set(['36994', '4280', '4180']);
const startedAt = new Date().toISOString();
const assertions = [], cases = [], traces = [], instances = [];
let executionIdentity = null, executionIdentityRef = null;
const writeJson = (path, value) => { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); return evidenceFile(path); };
const fixture = value => structuredClone(value);
function check(id, expected, actual, condition) {
  const row = {id, expected, actual, result: condition ? 'PASS' : 'FAIL', observedAt: new Date().toISOString()};
  assertions.push(row); assert.ok(condition, JSON.stringify(row)); return row;
}
const ignored = new Set(['node_modules', '.git', '.preview']);
function inventory(directory, current = directory) {
  return readdirSync(current, {withFileTypes: true}).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const path = join(current, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Unexpected non-dependency symlink: ${path}`);
    return entry.isDirectory() ? inventory(directory, path) : entry.isFile() ? [{path: relative(directory, path).split(sep).join('/'), bytes: statSync(path).size, sha256: hashFile(path)}] : [];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
function preservedCopy(source, destination) {
  assert.equal(existsSync(destination), false, 'Preserved copy must have a new path');
  mkdirSync(destination, {recursive: true});
  for (const item of inventory(source)) { const target = join(destination, item.path); mkdirSync(dirname(target), {recursive: true}); copyFileSync(join(source, item.path), target); }
  return {directory: destination, files: inventory(destination)};
}
function snap(runtime, viewId, componentId, workspacePath, directory, label) {
  const view = runtime.store.get('views', viewId), component = componentId ? runtime.store.get('components', componentId) : null;
  const source = view?.source?.buildId;
  const state = {
    observedAt: new Date().toISOString(), view, component,
    viewSha256: sha(canonicalJson(view)), componentSha256: sha(canonicalJson(component)),
    workspacePath, sourceInputDigest: sourceInputDigest(workspacePath),
    lockFile: lockFilename, lockSha256: hashFile(join(workspacePath, lockFilename)),
    distFiles: inventory(workspacePath).filter(item => item.path.startsWith('dist/')),
    archive: source ? {buildId: source, verify: runtime.presentation.sources.verify(source), manifest: runtime.presentation.sources.manifest(source), files: inventory(join(runtime.presentation.sources.directory, 'builds', source))} : null,
    buildReceipts: runtime.store.list('build_receipts'), publications: runtime.store.list('view_publications'),
    preservedWorkspace: preservedCopy(workspacePath, join(directory, label + '-project')),
  };
  writeJson(join(directory, label + '.json'), state); return state;
}
function sameCommitted(id, before, after) {
  check(id + '.view', before.viewSha256, after.viewSha256, before.viewSha256 === after.viewSha256);
  check(id + '.C1', before.componentSha256, after.componentSha256, before.componentSha256 === after.componentSha256);
  check(id + '.archive', before.archive.files, after.archive.files, canonicalJson(before.archive.files) === canonicalJson(after.archive.files));
}
function attachDependencies(workspace) {
  // F-SOURCE deliberately shares installed, locked dependencies. No npm install,
  // user profile change, vendored dependency capture or clean-install claim.
  symlinkSync(join(repository, 'node_modules'), join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
}
function tsx(title) {
  return `import React,{useState} from 'react';\nimport{createRoot}from'react-dom/client';\nimport'./style.css';\nfunction App(){const[selected,setSelected]=useState(false);return <main><h1>${title}</h1><p>Explicit synthetic source fixture</p><button id="toggle" onClick={()=>setSelected(!selected)}>Select</button><output id="result">{selected?'selected':'unselected'}</output></main>}\ncreateRoot(document.getElementById('root')).render(<App/>);\nwindow.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;const m=e.data;if(m.type==='hello')parent.postMessage({channel:m.channel,protocolVersion:'2.0',sessionId:m.sessionId,viewId:m.viewId,buildId:m.buildId,frameInstanceId:m.frameInstanceId,requestId:'fixture-data',method:'getData',params:null},location.origin)});\nparent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'fixture-hello',documentNonce:'fixture-document'},location.origin);\n`;
}
function project(workspace, title) {
  mkdirSync(join(workspace, 'src'), {recursive: true});
  copyFileSync(join(repository, 'package.json'), join(workspace, 'package.json'));
  copyFileSync(join(repository, lockFilename), join(workspace, lockFilename));
  writeFileSync(join(workspace, 'src/Component.tsx'), tsx(title));
  writeFileSync(join(workspace, 'src/style.css'), 'body{margin:0;font-family:system-ui}main{padding:24px}button{margin-right:16px}h1{font-size:24px}');
  writeFileSync(join(workspace, 'build.mjs'), `import{build,version}from'esbuild';import{existsSync,mkdirSync,writeFileSync}from'node:fs';import{join}from'node:path';\nconst gate=process.argv[2];if(gate){writeFileSync(gate+'.started','actual build process reached controlled gate');for(let n=0;!existsSync(gate+'.resume');n++){if(n>1000)throw Error('fixture gate timeout');await new Promise(r=>setTimeout(r,20))}}\nmkdirSync('dist',{recursive:true});await build({entryPoints:['src/Component.tsx'],bundle:true,format:'esm',outfile:'dist/app.js',minify:false});writeFileSync('dist/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>');console.log(JSON.stringify({compiler:'esbuild',version,entry:'src/Component.tsx',output:'dist/app.js'}));\n`);
  attachDependencies(workspace);
}
async function runtimeAt(directory, label) {
  assert.ok(directory.startsWith(root + sep));
  const instance = composeAppsRuntime(directory, {connections: []}), token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const server = createAppsServer({...instance, token});
  await new Promise((accept, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', accept);});
  const port = server.address().port; assert.equal(forbiddenPorts.has(String(port)), false);
  const url = `http://127.0.0.1:${port}`; const keyFile = join(directory, 'service-key'); writeFileSync(keyFile, token, {flag: 'wx', mode: 0o600});
  const f = {...instance, server, directory, url, keyFile, label, async call(path, input) {
    const target = new URL(path, url); assert.equal(target.origin, url); assert.equal(forbiddenPorts.has(target.port), false);
    const response = await fetch(target, {method: input === undefined ? 'GET' : 'POST', headers: {authorization: 'Bearer ' + token, ...(input === undefined ? {} : {'content-type': 'application/json'})}, ...(input === undefined ? {} : {body: JSON.stringify(input)})});
    const body = await response.json(), row = {traceId: randomUUID(), at: new Date().toISOString(), runtime: label, url: target.href, method: input === undefined ? 'GET' : 'POST', input: input ?? null, inputSha256: sha(canonicalJson(input ?? null)), httpStatus: response.status, output: body, outputSha256: sha(canonicalJson(body))}; traces.push(row); return {status: response.status, body, traceId: row.traceId};
  }, async action(capabilityId, input) {
    const result = await this.call('/v1/presentation-actions', {sessionId, capabilityId, input, requestId: randomUUID()}); assert.equal(result.status, 200); return result;
  }, async closeFixture() {server.closeAllConnections(); await new Promise(accept => server.close(accept)); await instance.close();}};
  instances.push(f); return f;
}
async function begin(f, mode, viewId, componentId) {
  const result = await f.action('apps.authoring.begin', {mode, ...(viewId ? {viewId} : {}), ...(componentId ? {componentId} : {})}); assert.equal(result.body.status, 'ok', JSON.stringify(result)); return result.body.data;
}
function spawnCli(cli, request, directory, label) {
  const requestPath = join(directory, label + '-request.json'); const requestRef = writeJson(requestPath, request);
  const child = spawn(process.execPath, [cli, requestPath], {cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = ''; child.stdout.on('data', bytes => {stdout += bytes;}); child.stderr.on('data', bytes => {stderr += bytes;});
  const finished = new Promise((accept, reject) => {child.once('error', reject); child.once('close', exitCode => {
    const stdoutPath = join(directory, label + '-stdout.txt'), stderrPath = join(directory, label + '-stderr.txt'); writeFileSync(stdoutPath, stdout, {flag: 'wx'}); writeFileSync(stderrPath, stderr, {flag: 'wx'});
    let result = null; try {result = JSON.parse(stdout.trim());} catch {}
    const record = {command: [process.execPath, cli, requestPath], pid: child.pid, exitCode, request: requestRef, stdout: evidenceFile(stdoutPath), stderr: evidenceFile(stderrPath), result};
    writeJson(join(directory, label + '-execution.json'), record); accept(record);
  });}); return {child, finished};
}
function buildRequest(f, attempt, command) {
  return {sessionId, attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, sourceRevision: attempt.attempt.sourceRevision, workspacePath: attempt.draft.workspacePath, command, evidenceRoot: f.evidenceRunner.root, archiveRoot: f.presentation.sources.directory, runtime: {url: f.url, keyFile: f.keyFile}};
}
async function actualBuild(f, attempt, directory, label, command = [process.execPath, 'build.mjs']) {
  const executed = await spawnCli(buildCli, buildRequest(f, attempt, command), directory, label).finished;
  assert.ok(executed.result?.reportRef, JSON.stringify(executed)); const report = f.evidenceRunner.readReport(executed.result.reportRef);
  const recorded = await f.action('apps.authoring.record_build', {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, reportRef: executed.result.reportRef});
  return {executed, report, recorded, receipt: recorded.body.data};
}
async function actualPreview(f, attempt, built, directory, label) {
  assert.equal(built.recorded.body.status, 'ok', JSON.stringify(built.recorded));
  const request = {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, buildReceiptId: built.receipt.receiptId, buildReportRef: built.executed.result.reportRef, mode: 'fixture', evidenceRoot: f.evidenceRunner.root, archiveRoot: f.presentation.sources.directory, assertions: [{id: 'selection', action: 'click', selector: '#toggle', checkSelector: '#result', check: 'text', expected: 'selected'}]};
  const executed = await spawnCli(previewCli, request, directory, label).finished;
  assert.equal(executed.exitCode, 0, JSON.stringify(executed)); const report = f.evidenceRunner.verifyPreview(executed.result.reportRef, f.presentation.sources);
  const recorded = await f.action('apps.authoring.record_preview', {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, buildReceiptId: built.receipt.receiptId, reportRef: executed.result.reportRef});
  assert.equal(recorded.body.status, 'ok', JSON.stringify(recorded)); return {executed, report, receipt: recorded.body.data};
}
function publicationInput(attempt, built, preview) {
  // A failed execution has no archiveBuildId. Use the residual old dist's
  // real buildId so negative publication reaches the state/evidence gate,
  // rather than passing merely because a null ID fails input schema.
  return {attemptId: attempt.attempt.attemptId, epoch: attempt.attempt.epoch, viewId: attempt.view.viewId, expectedViewRevision: attempt.attempt.expectedViewRevision, buildId: built.receipt.archiveBuildId ?? preview.receipt.buildId, buildReceiptId: built.receipt.receiptId, previewReceiptId: preview.receipt.receiptId};
}
async function rejected(f, capabilityId, input, codes, id) {
  const result = await f.action(capabilityId, input);
  check(id, codes, {status: result.body.status, code: result.body.error?.code, traceId: result.traceId}, result.body.status === 'failed' && codes.includes(result.body.error?.code)); return result;
}
async function waitFile(path) {
  for (let n = 0; n < 500; n++) {if (existsSync(path)) return; await new Promise(accept => setTimeout(accept, 20));}
  throw new Error('Controlled real build gate was not reached');
}

mkdirSync(root, {recursive: true});
let outcome = 'FAIL';
try {
  const executedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repository, encoding: 'utf8'}).trim();
  const gitStatus = execFileSync('git', ['status', '--porcelain'], {cwd: repository, encoding: 'utf8'});
  const productionDiff = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim();
  assert.equal(productionDiff, '', 'Source Runtime helpers must match recorded HEAD');
  const trackedSourceFiles = execFileSync('git', ['ls-files', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(?:ts|tsx|json|yml|yaml)$/.test(path));
  for (const path of trackedSourceFiles) {const destination = join(root, 'executed-source', path); mkdirSync(dirname(destination), {recursive: true}); copyFileSync(join(repository, path), destination);}
  copyFileSync(fileURLToPath(import.meta.url), join(root, 'executed-harness.mjs'));
  const sourceSnapshot = {executedCommit, fileCount: trackedSourceFiles.length, files: inventory(join(root, 'executed-source'))};
  const sourceSnapshotRef = writeJson(join(root, 'executed-source-manifest.json'), sourceSnapshot);
  const versions = JSON.parse(readFileSync(join(installed, 'versions.json'), 'utf8'));
  const identity = {
    executedCommit, gitStatus, node: process.version, platform: process.platform, architecture: process.arch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    harness: evidenceFile(join(root, 'executed-harness.mjs')), harnessSourcePath: fileURLToPath(import.meta.url), sourceSnapshot: sourceSnapshotRef, installedPackage: JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version,
    installedVersions: versions, buildCli: evidenceFile(buildCli), previewCli: evidenceFile(previewCli),
    acceptanceCards: {source: evidenceFile(join(repository, 'docs/requirements/A2/docs/03_ACCEPTANCE.md')), ids: ['TST-055', 'TST-056'], lines: [886, 902, 906, 922]},
    sourceHelpers: ['packages/service/src/apps-main.ts', 'packages/service/src/apps-server.ts', 'packages/app-presentation/src/authoring.ts', 'packages/app-presentation/src/index.ts', 'packages/source-components/src/index.ts', 'packages/source-components/src/authoring-evidence.ts', 'packages/app-runtime/src/store.ts'].map(path => ({path, ...evidenceFile(join(repository, path))})),
    dependencies: ['esbuild', 'react', 'react-dom'].map(name => ({name, version: JSON.parse(readFileSync(join(repository, 'node_modules', name, 'package.json'), 'utf8')).version})),
    fixtureScope: 'Runtime HTTP/state/storage/source helpers are current HEAD; actual command dispatch/build/preview runners are installed candidate.10. Shared locked dependencies are fixtures, not a clean npm install. Synthetic frame-ready is FIXTURE only. No DSH UI/model or real shop calls.',
    protectedPorts: [...forbiddenPorts], cleanup: 'Only fixture HTTP servers, fixture leases and preview-owned headless processes are closed. All evidence and bad copies retained.',
  };
  executionIdentity = identity; executionIdentityRef = writeJson(join(root, 'identity.json'), identity);
  check('identity.candidate', '1.0.0-candidate.10', identity.installedPackage, identity.installedPackage === '1.0.0-candidate.10');
  check('identity.buildCli', expectedBuildSha, identity.buildCli.sha256, identity.buildCli.sha256 === expectedBuildSha);
  check('identity.previewCli', expectedPreviewSha, identity.previewCli.sha256, identity.previewCli.sha256 === expectedPreviewSha);

  const f = await runtimeAt(join(root, 'runtime-current'), 'TST-055-source-runtime');
  writeJson(join(root, 'isolated-runtime-identity.json'), {url: f.url, identity: (await f.call('/v1/runtime')).body, sourceHelpers: identity.sourceHelpers, configuredConnections: []});
  const baselineDir = join(root, 'TST-055/00-V0-C1'); mkdirSync(baselineDir, {recursive: true});
  const initial = await begin(f, 'new'); project(initial.draft.workspacePath, 'Version 0');
  const initialBuild = await actualBuild(f, initial, baselineDir, 'build');
  check('055.V0.build', {exitCode: 0, verdict: 'PASS'}, {exitCode: initialBuild.executed.exitCode, reportExit: initialBuild.report.exitCode, verdict: initialBuild.report.verdict}, initialBuild.executed.exitCode === 0 && initialBuild.report.exitCode === 0 && initialBuild.report.verdict === 'PASS');
  const initialPreview = await actualPreview(f, initial, initialBuild, baselineDir, 'preview');
  const pubResult = await f.action('apps.authoring.publish', publicationInput(initial, initialBuild, initialPreview)); assert.equal(pubResult.body.status, 'ok');
  const publication = pubResult.body.data;
  const params = {publicationId: publication.publicationId, attemptId: initial.attempt.attemptId, attemptEpoch: initial.attempt.epoch, viewId: initial.view.viewId, buildId: initialBuild.receipt.archiveBuildId, frameInstanceId: 'FIXTURE-' + randomUUID(), documentNonce: 'FIXTURE-' + randomUUID(), clientFeatures: ['renderReadyV1', 'uiStateV1']};
  const granted = await f.call('/v1/authoring/authorizeFrame', {sessionId, params}); assert.equal(granted.status, 200);
  const fixtureReady = await f.call('/v1/component-extension', {protocolVersion: '2.0', sessionId, viewId: params.viewId, buildId: params.buildId, frameInstanceId: params.frameInstanceId, channel: 'dsh.apps.component.v2', type: 'extension', feature: 'renderReadyV1', action: 'ready', requestId: randomUUID(), params: {documentNonce: params.documentNonce, checks: {rendered: true, bridgeReady: true, dataRead: true, unhandledErrors: [], assertionResults: initialPreview.receipt.assertionResults}}});
  assert.equal(fixtureReady.status, 200); assert.equal(fixtureReady.body.result.publication.state, 'mounted');
  writeJson(join(baselineDir, 'synthetic-frame-ready-FIXTURE.json'), {scope: 'FIXTURE', actualDesktopFrame: false, reason: 'Establish last-good fixture view for rejection invariants only', authorizationTrace: granted.traceId, readyTrace: fixtureReady.traceId});
  const saved = await f.action('apps.authoring.save_component', {viewId: params.viewId, expectedViewRevision: 2, mode: 'save_as', title: 'C1 synthetic baseline', userRequest: 'Explicit fixture setup: save C1 before rejection cases'}); assert.equal(saved.body.status, 'ok');
  const viewId = params.viewId, componentId = saved.body.data.componentId, workspace = initial.draft.workspacePath;
  const baseline = snap(f, viewId, componentId, workspace, baselineDir, 'baseline');
  check('055.V0.uniqueReceipt', 1, f.store.list('build_receipts').length, f.store.list('build_receipts').length === 1);
  cases.push({testId: 'TST-055', caseId: 'V0-C1-baseline', scope: 'FIXTURE+SOURCE_EXEC', result: 'PASS', directory: baselineDir});

  const staleDir = join(root, 'TST-055/01-TSX-without-build'); mkdirSync(staleDir, {recursive: true});
  const stale = await begin(f, 'edit', viewId); const staleBefore = snap(f, viewId, componentId, workspace, staleDir, 'before');
  writeFileSync(join(workspace, 'src/Component.tsx'), tsx('TSX edited without build'));
  await rejected(f, 'apps.authoring.record_build', {attemptId: stale.attempt.attemptId, epoch: stale.attempt.epoch, reportRef: initialBuild.executed.result.reportRef}, ['BUILD_INPUT_CHANGED'], '055.stale.recordRejected');
  await rejected(f, 'apps.authoring.publish', publicationInput(stale, initialBuild, initialPreview), ['ATTEMPT_STATE_INVALID'], '055.stale.publishRejected');
  const staleAfter = snap(f, viewId, componentId, workspace, staleDir, 'after'); sameCommitted('055.stale', staleBefore, staleAfter);
  check('055.stale.distPreserved', staleBefore.distFiles, staleAfter.distFiles, canonicalJson(staleBefore.distFiles) === canonicalJson(staleAfter.distFiles));
  check('055.stale.lockPreserved', staleBefore.lockSha256, staleAfter.lockSha256, staleBefore.lockSha256 === staleAfter.lockSha256);
  check('055.stale.noReceipt', 1, f.store.list('build_receipts').length, f.store.list('build_receipts').length === 1);
  writeJson(join(staleDir, 'case.json'), {scope: 'FIXTURE+SOURCE_EXEC', buildExecutedForEditedSource: false, reusedBuildReport: initialBuild.executed.result.reportRef, originalView: viewId, savedC1: componentId, outcome: 'PASS'});
  cases.push({testId: 'TST-055', caseId: 'TSX-no-build-old-receipt', scope: 'FIXTURE+SOURCE_EXEC', result: 'PASS', directory: staleDir});

  const failDir = join(root, 'TST-055/02-exit1-residual-dist'); mkdirSync(failDir, {recursive: true});
  const failing = await begin(f, 'edit', viewId), failingBefore = snap(f, viewId, componentId, workspace, failDir, 'before');
  const failedBuild = await actualBuild(f, failing, failDir, 'build', [process.execPath, '-e', "console.error('Explicit negative fixture: exit1 with residual dist kept');process.exit(1)"]);
  check('055.exit1.process', {cliExit: 1, buildExit: 1, archive: null}, {cliExit: failedBuild.executed.exitCode, buildExit: failedBuild.report.exitCode, archive: failedBuild.report.archiveBuildId}, failedBuild.executed.exitCode === 1 && failedBuild.report.exitCode === 1 && failedBuild.report.archiveBuildId === null);
  check('055.exit1.failedReceipt', 'FAIL, not a publishable PASS', failedBuild.receipt, failedBuild.recorded.body.status === 'ok' && failedBuild.receipt.verdict === 'FAIL');
  let invalid = null; try {f.evidenceRunner.verifyBuild(failedBuild.executed.result.reportRef, f.presentation.sources);} catch (error) {invalid = error.message;}
  check('055.exit1.strictVerifier', 'BUILD_EVIDENCE_INVALID', invalid, invalid === 'BUILD_EVIDENCE_INVALID');
  await rejected(f, 'apps.authoring.publish', publicationInput(failing, failedBuild, initialPreview), ['ATTEMPT_STATE_INVALID'], '055.exit1.publishRejected');
  const failingAfter = snap(f, viewId, componentId, workspace, failDir, 'after'); sameCommitted('055.exit1', failingBefore, failingAfter);
  check('055.exit1.oldDistStillPresent', failingBefore.distFiles, failingAfter.distFiles, failingBefore.distFiles.length > 0 && canonicalJson(failingBefore.distFiles) === canonicalJson(failingAfter.distFiles));
  check('055.exit1.lockPreserved', failingBefore.lockSha256, failingAfter.lockSha256, failingBefore.lockSha256 === failingAfter.lockSha256);
  cases.push({testId: 'TST-055', caseId: 'exit1-residual-dist', scope: 'FIXTURE+SOURCE_EXEC', result: 'PASS', directory: failDir});

  const changeDir = join(root, 'TST-055/03-input-change-during-real-build'); mkdirSync(changeDir, {recursive: true});
  const changing = await begin(f, 'edit', viewId), changeBefore = snap(f, viewId, componentId, workspace, changeDir, 'before');
  const gate = join(changeDir, 'controlled-build-gate');
  const pending = spawnCli(buildCli, buildRequest(f, changing, [process.execPath, 'build.mjs', gate]), changeDir, 'build');
  await waitFile(gate + '.started'); const mutatedAt = new Date().toISOString(); writeFileSync(join(workspace, 'src/Component.tsx'), tsx('Changed during real esbuild execution')); writeFileSync(gate + '.resume', 'Resume the same owned build process after input mutation', {flag: 'wx'});
  const changedExecution = await pending.finished; assert.ok(changedExecution.result?.reportRef); const changeReport = f.evidenceRunner.readReport(changedExecution.result.reportRef);
  const changedRecording = await f.action('apps.authoring.record_build', {attemptId: changing.attempt.attemptId, epoch: changing.attempt.epoch, reportRef: changedExecution.result.reportRef});
  const changedBuild = {executed: changedExecution, report: changeReport, receipt: changedRecording.body.data};
  const mutatedSourceCopy = join(changeDir, 'mutated-source.tsx'); copyFileSync(join(workspace, 'src/Component.tsx'), mutatedSourceCopy);
  writeJson(join(changeDir, 'controlled-mutation.json'), {gateReached: evidenceFile(gate + '.started'), resumed: evidenceFile(gate + '.resume'), mutatedAt, workspaceFileAtMutation: join(workspace, 'src/Component.tsx'), mutatedFile: evidenceFile(mutatedSourceCopy), sourceBefore: changeBefore.sourceInputDigest, sourceAfter: sourceInputDigest(workspace)});
  check('055.inputChange.process', {cliExit: 1, buildExit: 0, inputUnchanged: false, archive: null}, {cliExit: changedExecution.exitCode, buildExit: changeReport.exitCode, inputUnchanged: changeReport.inputUnchanged, archive: changeReport.archiveBuildId}, changedExecution.exitCode === 1 && changeReport.exitCode === 0 && changeReport.inputUnchanged === false && changeReport.archiveBuildId === null);
  check('055.inputChange.failedReceipt', 'FAIL receipt', changedRecording.body, changedRecording.body.status === 'ok' && changedBuild.receipt.verdict === 'FAIL');
  await rejected(f, 'apps.authoring.publish', publicationInput(changing, changedBuild, initialPreview), ['ATTEMPT_STATE_INVALID'], '055.inputChange.publishRejected');
  const changeAfter = snap(f, viewId, componentId, workspace, changeDir, 'after'); sameCommitted('055.inputChange', changeBefore, changeAfter);
  check('055.inputChange.lockPreserved', changeBefore.lockSha256, changeAfter.lockSha256, changeBefore.lockSha256 === changeAfter.lockSha256);
  cases.push({testId: 'TST-055', caseId: 'input-change-during-build', scope: 'FIXTURE+SOURCE_EXEC', result: 'PASS', directory: changeDir});

  const cleanDir = join(root, 'TST-055/04-clean-real-rebuild'); mkdirSync(cleanDir, {recursive: true});
  const clean = await begin(f, 'edit', viewId); writeFileSync(join(workspace, 'src/Component.tsx'), tsx('Clean rebuilt source'));
  const cleanBefore = snap(f, viewId, componentId, workspace, cleanDir, 'before');
  const cleanBuild = await actualBuild(f, clean, cleanDir, 'build'); assert.equal(cleanBuild.recorded.body.status, 'ok');
  const verified = f.evidenceRunner.verifyBuild(cleanBuild.executed.result.reportRef, f.presentation.sources);
  const cleanAfter = snap(f, viewId, componentId, workspace, cleanDir, 'after'); sameCommitted('055.clean', cleanBefore, cleanAfter);
  const manifest = f.presentation.sources.manifest(cleanBuild.receipt.archiveBuildId);
  check('055.clean.sourceDigest', sourceInputDigest(workspace), verified.sourceInputDigest, verified.sourceInputDigest === sourceInputDigest(workspace) && verified.sourceInputDigest === verified.sourceInputDigestAfter);
  check('055.clean.uniqueNewReceipt', initialBuild.receipt.receiptId, cleanBuild.receipt.receiptId, initialBuild.receipt.receiptId !== cleanBuild.receipt.receiptId);
  check('055.clean.distMatchesManifest', 'every real output byte matches current v2 manifest', manifest.fileManifest.filter(item => item.path.startsWith('dist/')), manifest.fileManifest.filter(item => item.path.startsWith('dist/')).every(item => item.sha256 === hashFile(join(workspace, item.path)) && item.size === statSync(join(workspace, item.path)).size));
  check('055.clean.lockPreserved', cleanBefore.lockSha256, cleanAfter.lockSha256, cleanBefore.lockSha256 === cleanAfter.lockSha256);
  check('055.clean.onlySuccessfulReceipts', 2, f.store.list('build_receipts').filter(row => row.verdict === 'PASS').length, f.store.list('build_receipts').filter(row => row.verdict === 'PASS').length === 2);
  writeJson(join(cleanDir, 'verified-rebuild.json'), {report: verified, receipt: cleanBuild.receipt, manifest, outputFiles: cleanAfter.distFiles, baselineStillAvailable: {viewId, activeBuildId: cleanAfter.view.activeBuildId, C1: componentId}, noDistDeletion: true});
  cases.push({testId: 'TST-055', caseId: 'clean-rebuild-source-dist-comparison', scope: 'FIXTURE+SOURCE_EXEC', result: 'PASS', directory: cleanDir});

  const historicalDir = join(root, 'TST-056'); mkdirSync(historicalDir, {recursive: true});
  const legacy = await runtimeAt(join(root, 'runtime-legacy'), 'TST-056-legacy-runtime');
  const oldBuildId = initialBuild.receipt.archiveBuildId, currentArchive = join(f.presentation.sources.directory, 'builds', oldBuildId), oldArchive = join(legacy.presentation.sources.directory, 'builds', oldBuildId);
  preservedCopy(join(currentArchive, 'project'), join(oldArchive, 'project'));
  const oldManifest = fixture(f.presentation.sources.manifest(oldBuildId)); delete oldManifest.fileManifest; delete oldManifest.manifestVersion; oldManifest.createdAt = '2025-01-01T00:00:00.000Z';
  const oldManifestRef = writeJson(join(oldArchive, 'manifest.json'), oldManifest);
  writeJson(join(historicalDir, 'legacy-fixture-provenance.json'), {scope: 'FIXTURE', fixtureFormat: 'legacy-v1', historicalProductionClaim: false, constructedBy: 'First write to a separate isolated archive, omitting fileManifest and manifestVersion; project bytes copied from verified V0', buildId: oldBuildId, sourceCurrentManifest: evidenceFile(join(currentArchive, 'manifest.json')), legacyManifest: oldManifestRef});
  const oldFilesBefore = inventory(oldArchive), oldVerify = legacy.presentation.sources.verify(oldBuildId);
  check('056.legacy.format', 'no fileManifest; no manifestVersion', oldManifest, !Object.hasOwn(oldManifest, 'fileManifest') && !Object.hasOwn(oldManifest, 'manifestVersion'));
  check('056.legacy.verify', {valid: true, errors: []}, oldVerify, oldVerify.valid && oldVerify.errors.length === 0);
  const legacyBackup = join(historicalDir, 'verified-legacy-backup'); preservedCopy(oldArchive, join(legacyBackup, 'builds', oldBuildId));
  const backupStore = new SourceComponentStore(legacyBackup); check('056.legacy.backupVerified', true, backupStore.verify(oldBuildId), backupStore.verify(oldBuildId).valid);
  const legacyWorkspace = join(historicalDir, 'legacy-first-checkout');
  const oldSource = {buildId: oldBuildId, directory: 'historical-v1-fixture', entry: oldManifest.entry, files: oldManifest.files};
  const checkedOut = legacy.presentation.sources.checkout(oldSource, legacyWorkspace);
  const oldProjectFiles = inventory(join(oldArchive, 'project'));
  check('056.legacy.checkout', oldProjectFiles, inventory(legacyWorkspace), canonicalJson(oldProjectFiles) === canonicalJson(inventory(legacyWorkspace)));
  mkdirSync(join(legacyWorkspace, '.preview'), {recursive: true});
  const image = initialPreview.report.viewportResults[0].screenshot; copyFileSync(image.path, join(legacyWorkspace, '.preview/latest.png'));
  writeJson(join(legacyWorkspace, '.preview/latest.json'), {buildId: oldBuildId, viewport: {width: 420, height: 900}, capturedAt: initialPreview.report.finishedAt, provenance: 'Actual installed candidate.10 fixture preview screenshot; associated with exact historical project bytes'});
  const withPreview = legacy.presentation.sources.withPreview(checkedOut), oldFilesAfterPreview = inventory(oldArchive);
  check('056.preview.buildAddress', oldBuildId, withPreview.buildId, withPreview.buildId === oldBuildId && legacy.presentation.sources.verify(oldBuildId).valid);
  check('056.preview.manifestUnchanged', oldManifestRef.sha256, hashFile(join(oldArchive, 'manifest.json')), oldManifestRef.sha256 === hashFile(join(oldArchive, 'manifest.json')));
  check('056.preview.oldBytesUnchanged', oldFilesBefore, oldFilesAfterPreview.filter(row => oldFilesBefore.some(old => old.path === row.path)), oldFilesBefore.every(old => oldFilesAfterPreview.some(row => row.path === old.path && row.bytes === old.bytes && row.sha256 === old.sha256)));
  writeJson(join(historicalDir, 'legacy-preview-history.json'), {before: oldFilesBefore, after: oldFilesAfterPreview, sourceBefore: checkedOut, sourceAfter: withPreview, sourcePreviewPng: image, manifestUnchanged: oldManifestRef, verifyAfter: legacy.presentation.sources.verify(oldBuildId)});

  const badRoot = join(historicalDir, 'bad-archive-kept'); preservedCopy(oldArchive, join(badRoot, 'builds', oldBuildId));
  const badStore = new SourceComponentStore(badRoot), badFile = join(badRoot, 'builds', oldBuildId, 'project/src/Component.tsx');
  const badBeforePath = join(historicalDir, 'bad-archive-before-input.tsx'); copyFileSync(badFile, badBeforePath); const badBefore = evidenceFile(badBeforePath);
  writeFileSync(badFile, 'tampered historical archive bytes, do not rehash as accepted\n');
  const badVerification = badStore.verify(oldBuildId);
  check('056.archive.tamperRejected', 'SOURCE_BUILD_HASH_MISMATCH', badVerification, !badVerification.valid && badVerification.errors.includes('SOURCE_BUILD_HASH_MISMATCH'));
  writeJson(join(historicalDir, 'bad-archive-verification.json'), {beforeFile: badBefore, afterFile: evidenceFile(badFile), originalBuildIdRetained: oldBuildId, verification: badVerification, badCopyRetained: badRoot, originalVerify: legacy.presentation.sources.verify(oldBuildId), noSilentRehash: true});
  const restoredRoot = join(historicalDir, 'verified-backup-restored'); preservedCopy(join(legacyBackup, 'builds', oldBuildId), join(restoredRoot, 'builds', oldBuildId));
  const restoredStore = new SourceComponentStore(restoredRoot); check('056.archive.recovery', {valid: true, unchangedHash: oldManifestRef.sha256}, {verify: restoredStore.verify(oldBuildId), manifestSha256: hashFile(join(restoredRoot, 'builds', oldBuildId, 'manifest.json'))}, restoredStore.verify(oldBuildId).valid && hashFile(join(restoredRoot, 'builds', oldBuildId, 'manifest.json')) === oldManifestRef.sha256);

  // Public legacy compatibility route reads the v1 fixture; its saved component
  // is explicitly seeded by a legacy save, then reopened through authoring.
  const legacyOpened = await legacy.action('apps.presentation.open_source_component', {directory: legacyWorkspace, title: 'Legacy v1 fixture'}); assert.equal(legacyOpened.body.status, 'ok');
  const legacySaved = await legacy.action('apps.presentation.save_component', {viewId: legacyOpened.body.data.viewId, mode: 'save_as', userRequest: 'Explicit legacy fixture setup', title: 'Legacy C1'}); assert.equal(legacySaved.body.status, 'ok');
  const legacyComponentId = legacySaved.body.data.componentId;
  const opened = await begin(legacy, 'open_saved', undefined, legacyComponentId); attachDependencies(opened.draft.workspacePath);
  const legacyBuildDir = join(historicalDir, 'old-work-copy-new-build'); mkdirSync(legacyBuildDir, {recursive: true});
  const oldCopyBuild = await actualBuild(legacy, opened, legacyBuildDir, 'build'); assert.equal(oldCopyBuild.recorded.body.status, 'ok');
  check('056.legacy.newReceipt', {verdict: 'PASS', uniqueReceipt: true}, {verdict: oldCopyBuild.receipt.verdict, receiptId: oldCopyBuild.receipt.receiptId}, oldCopyBuild.receipt.verdict === 'PASS' && oldCopyBuild.receipt.receiptId !== initialBuild.receipt.receiptId);
  check('056.legacy.newReceiptSameFrozenBuild', oldBuildId, oldCopyBuild.receipt.archiveBuildId, oldCopyBuild.receipt.archiveBuildId === oldBuildId);
  check('056.legacy.captureDoesNotRewriteManifest', oldManifestRef.sha256, hashFile(join(oldArchive, 'manifest.json')), hashFile(join(oldArchive, 'manifest.json')) === oldManifestRef.sha256);
  const editedLegacy = await begin(legacy, 'edit', opened.view.viewId), editDir = join(historicalDir, 'edited-checkout-old-receipt-rejected'); mkdirSync(editDir, {recursive: true});
  const editedBefore = snap(legacy, opened.view.viewId, legacyComponentId, opened.draft.workspacePath, editDir, 'before');
  writeFileSync(join(opened.draft.workspacePath, 'src/Component.tsx'), tsx('Edited legacy working copy, no new build'));
  await rejected(legacy, 'apps.authoring.record_build', {attemptId: editedLegacy.attempt.attemptId, epoch: editedLegacy.attempt.epoch, reportRef: oldCopyBuild.executed.result.reportRef}, ['BUILD_INPUT_CHANGED'], '056.legacy.editReceiptRejected');
  await rejected(legacy, 'apps.authoring.publish', {attemptId: editedLegacy.attempt.attemptId, epoch: editedLegacy.attempt.epoch, viewId: editedLegacy.view.viewId, expectedViewRevision: editedLegacy.attempt.expectedViewRevision, buildId: oldCopyBuild.receipt.archiveBuildId, buildReceiptId: oldCopyBuild.receipt.receiptId, previewReceiptId: initialPreview.receipt.receiptId}, ['ATTEMPT_STATE_INVALID'], '056.legacy.editPublishRejected');
  const editedAfter = snap(legacy, opened.view.viewId, legacyComponentId, opened.draft.workspacePath, editDir, 'after'); sameCommitted('056.legacy.edit', editedBefore, editedAfter);
  check('056.legacy.editDistPreserved', editedBefore.distFiles, editedAfter.distFiles, canonicalJson(editedBefore.distFiles) === canonicalJson(editedAfter.distFiles));
  check('056.legacy.editLockPreserved', editedBefore.lockSha256, editedAfter.lockSha256, editedBefore.lockSha256 === editedAfter.lockSha256);
  check('056.legacy.finalManifestUnchanged', oldManifestRef.sha256, hashFile(join(oldArchive, 'manifest.json')), hashFile(join(oldArchive, 'manifest.json')) === oldManifestRef.sha256);
  writeJson(join(historicalDir, 'legacy-final-state.json'), {historicalManifest: evidenceFile(join(oldArchive, 'manifest.json')), originalProjectFiles: inventory(join(oldArchive, 'project')), verify: legacy.presentation.sources.verify(oldBuildId), currentV2Manifest: evidenceFile(join(currentArchive, 'manifest.json')), badCopyStillRejected: badStore.verify(oldBuildId), recovery: restoredStore.verify(oldBuildId), savedLegacyComponent: legacy.store.get('components', legacyComponentId), receiptCount: legacy.store.list('build_receipts').length});
  cases.push({testId: 'TST-056', caseId: 'legacy-v1-verify-checkout-preview-bad-copy-edit-receipt', scope: 'FIXTURE', result: 'PASS', directory: historicalDir});
  check('source.helpersUnchangedDuringRun', sourceSnapshot.files, inventory(join(root, 'executed-source')), sourceSnapshot.files.every(item => hashFile(join(repository, item.path)) === item.sha256));
  check('candidate.buildCliUnchangedDuringRun', expectedBuildSha, hashFile(buildCli), hashFile(buildCli) === expectedBuildSha);
  check('candidate.previewCliUnchangedDuringRun', expectedPreviewSha, hashFile(previewCli), hashFile(previewCli) === expectedPreviewSha);
  outcome = 'PASS';
} catch (error) {
  writeJson(join(root, 'failure.json'), {name: error.name, message: error.message, stack: error.stack, at: new Date().toISOString()});
  process.exitCode = 1;
} finally {
  const cleanup = [];
  for (const f of instances.reverse()) {try {await f.closeFixture(); cleanup.push({runtime: f.label, url: f.url, serverClosed: !f.server.listening, leaseReleased: true});} catch (error) {cleanup.push({runtime: f.label, error: error.message}); outcome = 'FAIL'; process.exitCode = 1;}}
  const traceRef = writeJson(join(root, 'http-traces.json'), traces);
  const assertionRef = writeJson(join(root, 'assertions.json'), assertions);
  const result = {
    runId, releaseId: 'apps-a2-20261007', executedCommit: executionIdentity?.executedCommit ?? null, identity: executionIdentityRef, startedAt, finishedAt: new Date().toISOString(), result: outcome, cards: [
      {testId: 'TST-055', scope: 'FIXTURE+SOURCE_EXEC', result: outcome, completeScope: outcome === 'PASS', steps: ['actual installed CLI successful build', 'TSX-only edit rejects old receipt and publication', 'actual exit1 preserves old dist and cannot publish', 'actual command input changed during execution rejects publish', 'fresh successful build compares source/lock/dist/manifest; V0/C1 unchanged'], desktopAcceptance: 'NOT_RUN'},
      {testId: 'TST-056', scope: 'FIXTURE', result: outcome, completeScope: outcome === 'PASS', steps: ['true legacy-v1 fixture lacks fileManifest; verify and checkout', 'preview evidence added without manifest/buildId/address change', 'tampered bad copy rejected and kept', 'verified-backup recovery without accepting a rehash', 'edited old work copy rejects old receipt/publish and preserves history'], historicalProductionMigration: 'NOT_RUN'},
    ], cases, assertions: assertionRef, httpTraces: traceRef, assertionCounts: {total: assertions.length, passed: assertions.filter(row => row.result === 'PASS').length, failed: assertions.filter(row => row.result === 'FAIL').length},
    syntheticReady: 'FIXTURE baseline only; no DSH desktop/model/native composer claim', cleanup,
    roles: {I: 'Codex /root/formal_build_archive_evidence harness author', V: 'Same agent executed retained fixture assertions; independent review and release approval pending', R: null},
    releaseApproval: 'NOT_ACCEPTED: these cards do not satisfy LIVE_HOST/LIVE_MODEL or the four overall gates',
  };
  const cardRefs = result.cards.map(card => {
    const prefix = card.testId.slice(4);
    const row = {
      recordKind: 'EXECUTED_ACCEPTANCE', testId: card.testId, requirementIds: ['REQ-' + prefix], runId, releaseId: result.releaseId,
      targetCommit: result.executedCommit, executedCommit: result.executedCommit, scope: card.scope, status: outcome,
      environment: {node: process.version, os: process.platform, architecture: process.arch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, browser: card.testId === 'TST-055' ? 'Actual fresh headless Chrome launched by installed preview CLI; see request/logs and PNGs' : 'not required for FIXTURE', dependencies: executionIdentity?.dependencies ?? []},
      versions: {bundle: executionIdentity?.installedPackage ?? null, host: 'metadata only; LIVE_HOST NOT_RUN', runtime: executionIdentity?.installedVersions.runtimeVersion ?? null, databaseSchema: executionIdentity?.installedVersions.databaseSchemaVersion ?? null, transportMajor: 1, catalogSchemaVersion: 1, bridgeProtocol: '2.0', dshHost: 'NOT_RUN', externalModel: 'NOT_RUN'},
      fixtureRefs: [executionIdentityRef, ...cases.filter(item => item.testId === card.testId).map(item => ({caseId: item.caseId, directory: item.directory}))],
      steps: card.steps.map((description, index) => ({index: index + 1, description, status: outcome})),
      assertions: assertions.filter(row => row.id.startsWith(prefix + '.')), artifactRefs: [traceRef, assertionRef, executionIdentityRef],
      limitations: ['Isolated source Runtime helpers at recorded HEAD, installed candidate.10 build/preview CLIs', 'Synthetic baseline frame-ready is FIXTURE, never actual DSH', 'Shared locked dependencies; clean dependency installation NOT_RUN', 'No LIVE_HOST/LIVE_MODEL/REAL_BUSINESS or overall release approval', ...(card.testId === 'TST-056' ? ['Legacy-v1 manifest is an explicit first-written synthetic historical fixture, not real production migration'] : [])],
      startedAt, finishedAt: result.finishedAt, executor: result.roles.I, reviewer: null, independentReview: 'PENDING', releaseApproval: result.releaseApproval,
    };
    return writeJson(join(root, card.testId, card.scope, 'result.json'), row);
  });
  result.formalCardRefs = cardRefs;
  const resultRef = writeJson(join(root, 'result.json'), result);
  console.log(JSON.stringify({runId, root, result: outcome, resultRef, assertions: result.assertionCounts, cases: cases.length, cleanup}, null, 2));
}
