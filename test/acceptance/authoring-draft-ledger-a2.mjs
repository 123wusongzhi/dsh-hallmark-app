/** TST-054 FIXTURE. Public Runtime actions, real ordinary React build, retained SQL/FS evidence.
 * No desktop/model calls, database seeding, synthetic receipts, real business or automatic save.
 * Run: node test/acceptance/authoring-draft-ledger-a2.mjs
 */
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from 'node:net';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {evidenceFile, sourceInputDigest} from '../../packages/source-components/src/authoring-evidence.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const installed = 'C:/Users/wubil/.dsh/profiles/desktop/node_modules/dsh-plugin-apps-bundle';
const buildCli = join(installed, 'lib/apps-authoring-build.js');
const lockFilename = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'].find(name => existsSync(join(repository, name)));
assert.ok(lockFilename, 'A normal dependency lockfile is required');
const manifestPath = join(repository, 'evidence/apps-a2-20261007/candidates/1.0.0-candidate.10/build-manifest.json');
const frozen = JSON.parse(readFileSync(manifestPath, 'utf8'));
const runId = `a2-draft-ledger-${randomUUID()}`;
const root = join(repository, 'evidence/apps-a2-20261007/formal-draft-ledger', runId);
const startedAt = new Date().toISOString();
const sessionA = `fixture-${runId}-A`, sessionB = `fixture-${runId}-B`;
const forbiddenPorts = new Set(['36994', '4180', '4280']);
const assertions = [], traces = [], edits = [], stages = [], executions = [];
let f = null, outcome = 'FAIL', identityRef = null, identity = null;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => sha(readFileSync(path));
function json(path, value) { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); return evidenceFile(path); }
function check(id, expected, actual, condition) {
  const row = {id, expected, actual, result: condition ? 'PASS' : 'FAIL', observedAt: new Date().toISOString()};
  assertions.push(row); assert.ok(condition, JSON.stringify(row)); return row;
}
function inventory(directory, current = directory) {
  if (!existsSync(current)) return [];
  return readdirSync(current, {withFileTypes: true}).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    const path = join(current, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Unexpected source link: ${path}`);
    return entry.isDirectory() ? inventory(directory, path) : entry.isFile() ? [{path: relative(directory, path).split(sep).join('/'), bytes: statSync(path).size, sha256: hashFile(path)}] : [];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
function copyTree(source, target) {
  assert.ok(!existsSync(target) || !readdirSync(target).length, 'Copy only into an independent empty directory');
  mkdirSync(target, {recursive: true});
  for (const file of inventory(source)) { const to = join(target, file.path); mkdirSync(dirname(to), {recursive: true}); copyFileSync(join(source, file.path), to); }
}
function sourceInputs() { return Object.entries(frozen.sourceInputs).map(([path, expected]) => ({path, expected, actual: hashFile(join(repository, path)), match: hashFile(join(repository, path)) === expected})); }
function sqlSnapshot(label, draftWorkspaces = []) {
  // SQL SELECTs inspect the fixture writer's committed state. No test INSERT/UPDATE/DELETE.
  const tables = Object.fromEntries(f.store.collections.map(table => [table, f.store.db.prepare(`SELECT id,value_json,created_at,updated_at FROM ${table} ORDER BY id`).all().map(row => ({...row, value: JSON.parse(row.value_json)}))]));
  const directories = draftWorkspaces.map(path => ({path, files: inventory(path), sourceInputDigest: sourceInputDigest(path)}));
  const value = {label, observedAt: new Date().toISOString(), tables, directories};
  const ref = json(join(root, 'states', label + '.json'), value); stages.push({label, ref}); return {value, ref};
}
function stateDiff(label, before, after) {
  const changes = Object.fromEntries(Object.keys(before.value.tables).map(table => {
    const prior = new Map(before.value.tables[table].map(row => [row.id, row]));
    const next = new Map(after.value.tables[table].map(row => [row.id, row]));
    return [table, [...new Set([...prior.keys(), ...next.keys()])].flatMap(id => canonicalJson(prior.get(id) ?? null) === canonicalJson(next.get(id) ?? null) ? [] : [{id, before: prior.get(id) ?? null, after: next.get(id) ?? null}])];
  }));
  return json(join(root, 'diffs', label + '.json'), {before: before.ref, after: after.ref, changes});
}
async function call(path, input) {
  const target = new URL(path, f.url); assert.equal(target.origin, f.url); assert.equal(forbiddenPorts.has(target.port), false);
  const response = await fetch(target, {method: input === undefined ? 'GET' : 'POST', headers: {authorization: 'Bearer ' + f.token, ...(input === undefined ? {} : {'content-type': 'application/json'})}, ...(input === undefined ? {} : {body: JSON.stringify(input)})});
  const output = await response.json(); const row = {traceId: randomUUID(), at: new Date().toISOString(), url: target.href, method: input === undefined ? 'GET' : 'POST', input: input ?? null, inputSha256: sha(canonicalJson(input ?? null)), httpStatus: response.status, output, outputSha256: sha(canonicalJson(output))};
  traces.push(row); return {status: response.status, body: output, traceId: row.traceId};
}
async function action(sessionId, capabilityId, input) {
  const requestId = randomUUID(), result = await call('/v1/presentation-actions', {sessionId, capabilityId, input, requestId});
  assert.equal(result.status, 200, JSON.stringify(result)); return {...result, requestId};
}
async function begin(sessionId, input) { const result = await action(sessionId, 'apps.authoring.begin', input); assert.equal(result.body.status, 'ok', JSON.stringify(result)); return {data: result.body.data, requestId: result.requestId, traceId: result.traceId}; }
async function inspect(sessionId, attemptId) { const result = await action(sessionId, 'apps.authoring.inspect', {attemptId}); assert.equal(result.body.status, 'ok', JSON.stringify(result)); return result; }
function tsx(title) {
  return `import React,{useState}from'react';\nimport{createRoot}from'react-dom/client';\nimport{createAppsClient}from'./apps-client.js';\nimport'./style.css';\nconst sdk=createAppsClient();\nfunction App(){const[n,setN]=useState(0);return <main><h1>${title}</h1><p>Explicit synthetic fixture, no Bill shop data.</p><button onClick={()=>setN(n+1)}>Count</button><output>{n}</output></main>}\ncreateRoot(document.getElementById('root')).render(<App/>);\nwindow.fixtureSdk=sdk;\n`;
}
function makeTemplate() {
  const path = join(root, 'shared-template'); mkdirSync(join(path, 'src'), {recursive: true});
  // Reuse the repository's normal registry lock and existing dependencies. This
  // is a documented shared fixture, not a clean install or a different framework.
  copyFileSync(join(repository, 'package.json'), join(path, 'package.json'));
  copyFileSync(join(repository, lockFilename), join(path, lockFilename));
  copyFileSync(join(installed, 'sdk/component-runtime/apps-client.js'), join(path, 'src/apps-client.js'));
  writeFileSync(join(path, 'src/Component.tsx'), tsx('Shared source template'), {flag: 'wx'});
  writeFileSync(join(path, 'src/style.css'), 'body{margin:0;font-family:system-ui}main{padding:24px;color:#14213d}button{padding:8px 16px}output{margin-left:16px}\n', {flag: 'wx'});
  writeFileSync(join(path, 'build.mjs'), `import{build,version}from'esbuild';import{mkdirSync,writeFileSync}from'node:fs';\nmkdirSync('dist',{recursive:true});await build({entryPoints:['src/Component.tsx'],bundle:true,format:'esm',outfile:'dist/app.js'});writeFileSync('dist/index.html','<!doctype html><html><head><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>');console.log(JSON.stringify({compiler:'esbuild',version,source:'src/Component.tsx'}));\n`, {flag: 'wx'});
  return path;
}
function filesForAttempt(label, beginResult, change) {
  const {draft, attempt} = beginResult.data, before = inventory(draft.workspacePath), current = f.store.get('authoring_attempts', attempt.attemptId);
  assert.equal(current.state, 'editing'); assert.equal(f.store.get('authoring_drafts', draft.draftId).epoch, attempt.epoch);
  const prior = join(root, 'file-edits', label, 'before'), next = join(root, 'file-edits', label, 'after');
  copyTree(draft.workspacePath, prior); change(draft.workspacePath); copyTree(draft.workspacePath, next);
  const after = inventory(draft.workspacePath), row = {label, changedAt: new Date().toISOString(), scope: 'FIXTURE_HARNESS_FILE_EDIT', sourceSessionId: draft.ownerSessionId, draftId: draft.draftId, viewId: draft.viewId, componentId: draft.sourceComponentId ?? null, attemptId: attempt.attemptId, epoch: attempt.epoch, sourceRevision: attempt.sourceRevision, beginInvocationId: beginResult.requestId, workspacePath: draft.workspacePath, beforeDirectory: prior, afterDirectory: next, beforeFiles: before, afterFiles: after, beforeDigest: sourceInputDigest(prior), afterDigest: sourceInputDigest(next)};
  edits.push(row); json(join(root, 'file-edits', label, 'ownership.json'), row); return row;
}
async function actualBuild(beginResult, label) {
  const {draft, attempt} = beginResult.data, request = {sessionId: draft.ownerSessionId, attemptId: attempt.attemptId, epoch: attempt.epoch, sourceRevision: attempt.sourceRevision, workspacePath: draft.workspacePath, command: [process.execPath, 'build.mjs'], evidenceRoot: f.evidenceRunner.root, archiveRoot: f.presentation.sources.directory, runtime: {url: f.url, keyFile: f.keyFile}};
  const directory = join(root, 'builds', label); mkdirSync(directory, {recursive: true});
  const workspaceBefore = inventory(draft.workspacePath);
  const requestRef = json(join(directory, 'request.json'), request);
  const child = spawn(process.execPath, [buildCli, requestRef.path], {cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = ''; child.stdout.on('data', bytes => stdout += bytes); child.stderr.on('data', bytes => stderr += bytes);
  const exitCode = await new Promise((accept, reject) => {child.once('error', reject); child.once('close', accept);});
  writeFileSync(join(directory, 'stdout.txt'), stdout, {flag: 'wx'}); writeFileSync(join(directory, 'stderr.txt'), stderr, {flag: 'wx'});
  const output = JSON.parse(stdout.trim()), report = f.evidenceRunner.readReport(output.reportRef);
  const recorded = await action(draft.ownerSessionId, 'apps.authoring.record_build', {attemptId: attempt.attemptId, epoch: attempt.epoch, reportRef: output.reportRef});
  assert.equal(recorded.body.status, 'ok', JSON.stringify(recorded));
  const workspaceAfter = inventory(draft.workspacePath);
  const execution = {label, scope: 'FIXTURE_REAL_BUILD_COMMAND', sourceSessionId: draft.ownerSessionId, draftId: draft.draftId, viewId: draft.viewId, attemptId: attempt.attemptId, epoch: attempt.epoch, sourceRevision: attempt.sourceRevision, workspaceBefore, workspaceAfter, modifiedWorkspaceFiles: workspaceAfter.filter(file => !workspaceBefore.some(before => canonicalJson(before) === canonicalJson(file))), command: [process.execPath, buildCli, requestRef.path], pid: child.pid, exitCode, request: requestRef, stdout: evidenceFile(join(directory, 'stdout.txt')), stderr: evidenceFile(join(directory, 'stderr.txt')), output, signedReport: report, recordedInvocationId: recorded.requestId, recordedOutput: recorded.body, fixtureCliProcessTerminal: true};
  executions.push(execution); json(join(directory, 'execution.json'), execution); return execution;
}
async function rejectUnchanged(label, owner, capabilityId, input, code, paths) {
  const before = sqlSnapshot(label + '-before', paths), result = await action(owner, capabilityId, input), after = sqlSnapshot(label + '-after', paths);
  const diff = stateDiff(label, before, after);
  check('054.' + label + '.rejected', code, {status: result.body.status, code: result.body.error?.code, traceId: result.traceId}, result.body.status === 'failed' && result.body.error?.code === code);
  const domain = ['authoring_drafts', 'authoring_attempts', 'views', 'build_receipts', 'preview_receipts', 'builds', 'components', 'component_versions', 'view_publications'];
  check('054.' + label + '.domainUnchanged', 'All authoring/domain records unchanged; failure invocation is retained', diff, domain.every(table => canonicalJson(before.value.tables[table]) === canonicalJson(after.value.tables[table])));
  check('054.' + label + '.directoriesUnchanged', before.value.directories, after.value.directories, canonicalJson(before.value.directories) === canonicalJson(after.value.directories));
  return result;
}
function linkedBegin(label, beginResult) {
  const {draft, attempt, view} = beginResult.data, stored = f.store.get('authoring_attempts', attempt.attemptId), invocation = f.store.get('invocations', beginResult.requestId);
  check('054.' + label + '.realInvocation', {settled: true, owner: draft.ownerSessionId, capability: 'apps.authoring.begin'}, invocation, invocation?.state === 'settled' && invocation.request.source.sessionId === draft.ownerSessionId && invocation.request.capabilityId === 'apps.authoring.begin' && invocation.result.status === 'ok');
  check('054.' + label + '.identities', {draftId: draft.draftId, viewId: draft.viewId, attemptId: attempt.attemptId, sourceRevision: draft.sourceRevision, epoch: draft.epoch, componentId: null}, {draft, attempt, view}, stored.invocationRefs.includes(beginResult.requestId) && invocation.result.data.attempt.attemptId === attempt.attemptId && invocation.result.data.draft.draftId === draft.draftId && view.ownerSessionId === draft.ownerSessionId && !draft.sourceComponentId && !attempt.buildReceiptId && !attempt.previewReceiptId && new Set([draft.draftId, draft.viewId, attempt.attemptId]).size === 3);
}

mkdirSync(root, {recursive: true});
try {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: repository, encoding: 'utf8'}).trim();
  const status = execFileSync('git', ['status', '--porcelain'], {cwd: repository, encoding: 'utf8'});
  assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim(), '', 'Executed source helpers must match HEAD');
  const sourcePaths = execFileSync('git', ['ls-files', '--', 'packages'], {cwd: repository, encoding: 'utf8'}).trim().split('\n').filter(path => /\.(?:ts|tsx|json|yaml|yml)$/.test(path));
  for (const path of sourcePaths) {const target = join(root, 'executed-source', path); mkdirSync(dirname(target), {recursive: true}); copyFileSync(join(repository, path), target);}
  copyFileSync(fileURLToPath(import.meta.url), join(root, 'executed-harness.mjs'));
  const sourceSnapshot = json(join(root, 'executed-source-manifest.json'), {executedCommit: commit, files: inventory(join(root, 'executed-source'))});
  const beforeInputs = sourceInputs(); json(join(root, 'candidate-source-inputs-before.json'), beforeInputs);
  const versions = JSON.parse(readFileSync(join(installed, 'versions.json'), 'utf8'));
  identity = {executedCommit: commit, gitStatus: status, node: process.version, platform: process.platform, architecture: process.arch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, sourceSnapshot, harness: evidenceFile(join(root, 'executed-harness.mjs')), harnessSource: fileURLToPath(import.meta.url), acceptanceCard: evidenceFile(join(repository, 'docs/requirements/A2/docs/03_ACCEPTANCE.md')), candidate: JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version, versions, buildCli: evidenceFile(buildCli), sdk: evidenceFile(join(installed, 'sdk/component-runtime/apps-client.js')), sourceInputManifest: evidenceFile(manifestPath), dependencies: ['esbuild', 'react', 'react-dom'].map(name => ({name, version: JSON.parse(readFileSync(join(repository, 'node_modules', name, 'package.json'), 'utf8')).version, package: evidenceFile(join(repository, 'node_modules', name, 'package.json'))})), sessions: {A: sessionA, B: sessionB}, forbiddenPorts: [...forbiddenPorts], modelClass: 'NO_MODEL', businessWriteCount: 0, actualDshHost: 'NOT_RUN', scope: 'FIXTURE', limitation: 'Current-HEAD isolated Runtime helpers + installed candidate.10 real build CLI and SDK. Locked repository dependencies shared by junction; no clean-install, actual Agent or desktop claim.'};
  identityRef = json(join(root, 'identity.json'), identity);
  check('054.candidate.identity', '1.0.0-candidate.10 / 143 unchanged source inputs', {version: identity.candidate, sourceCount: beforeInputs.length, mismatches: beforeInputs.filter(row => !row.match)}, identity.candidate === '1.0.0-candidate.10' && beforeInputs.length === 143 && beforeInputs.every(row => row.match));
  check('054.candidate.buildCliAndSdk', frozen.artifacts, {buildCli: identity.buildCli.sha256, sdk: identity.sdk.sha256}, identity.buildCli.sha256 === frozen.artifacts['lib/apps-authoring-build.js'] && identity.sdk.sha256 === frozen.artifacts['sdk/component-runtime/apps-client.js']);
  const instance = composeAppsRuntime(join(root, 'runtime'), {connections: []}), token = randomUUID() + randomUUID(), server = createAppsServer({...instance, token});
  f = {...instance, server, token, url: null, keyFile: join(root, 'runtime/service-key')};
  writeFileSync(f.keyFile, token, {flag: 'wx', mode: 0o600});
  await new Promise((accept, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', accept);});
  f.url = `http://127.0.0.1:${server.address().port}`; assert.equal(forbiddenPorts.has(String(server.address().port)), false);
  json(join(root, 'isolated-runtime-identity.json'), {url: f.url, identity: (await call('/v1/runtime')).body, configuredConnections: [], actualDshInstance: false});
  const empty = sqlSnapshot('00-empty');
  check('054.empty.precondition', 'no draft, attempt, view, component', ['authoring_drafts', 'authoring_attempts', 'views', 'components'].map(table => ({table, rows: empty.value.tables[table].length})), ['authoring_drafts', 'authoring_attempts', 'views', 'components'].every(table => empty.value.tables[table].length === 0));
  const template = makeTemplate(), templateBefore = inventory(template); json(join(root, 'template-manifest.json'), {source: 'New ordinary React/TSX/CSS template; installed SDK; copied normal repository lock/package', path: template, files: templateBefore});
  const A = await begin(sessionA, {mode: 'new', title: 'A synthetic source draft'}), B = await begin(sessionB, {mode: 'new', title: 'B synthetic source draft'}); linkedBegin('A-new', A); linkedBegin('B-new', B);
  const workspaceA = A.data.draft.workspacePath, workspaceB = B.data.draft.workspacePath;
  check('054.AB.emptyIndependentDirectories', true, {A: workspaceA, B: workspaceB}, workspaceA !== workspaceB && !readdirSync(workspaceA).length && !readdirSync(workspaceB).length && A.data.draft.draftId !== B.data.draft.draftId && A.data.view.viewId !== B.data.view.viewId);
  filesForAttempt('A-new-template', A, directory => copyTree(template, directory));
  filesForAttempt('B-new-template', B, directory => copyTree(template, directory));
  const initialA = inventory(workspaceA), untouchedB = inventory(workspaceB);
  check('054.AB.sameTemplateBytes', templateBefore, {A: initialA, B: untouchedB}, canonicalJson(templateBefore) === canonicalJson(initialA) && canonicalJson(templateBefore) === canonicalJson(untouchedB));
  for (const workspace of [workspaceA, workspaceB]) symlinkSync(join(repository, 'node_modules'), join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const templated = sqlSnapshot('01-A-B-templated', [workspaceA, workspaceB]); stateDiff('step1-create-A-B', empty, templated);
  const baseline = await actualBuild(A, 'A-new-good-build');
  check('054.A-new.realBuild', 'exit0/PASS real React/TSX archive', {exit: baseline.exitCode, report: baseline.signedReport, receipt: baseline.recordedOutput.data}, baseline.exitCode === 0 && baseline.signedReport.verdict === 'PASS' && baseline.recordedOutput.data.attemptId === A.data.attempt.attemptId && baseline.recordedOutput.data.sourceRevision === 1 && f.presentation.sources.verify(baseline.signedReport.archiveBuildId).valid);
  const archivePath = join(f.presentation.sources.directory, 'builds', baseline.signedReport.archiveBuildId), archiveBefore = inventory(archivePath);
  const preEdit = sqlSnapshot('02-A-initial-build', [workspaceA, workspaceB]);
  const A1 = await begin(sessionA, {mode: 'edit', viewId: A.data.view.viewId}); linkedBegin('A-edit1', A1);
  check('054.A-edit1.revisionDirectory', {draft: A.data.draft.draftId, workspace: workspaceA, epoch: 2, sourceRevision: 2}, A1.data.draft, A1.data.draft.draftId === A.data.draft.draftId && A1.data.draft.workspacePath === workspaceA && A1.data.draft.sourceRevision === 2 && A1.data.attempt.epoch === 2 && A1.data.attempt.attemptId !== A.data.attempt.attemptId);
  filesForAttempt('A-edit1-real-compile-error', A1, directory => writeFileSync(join(directory, 'src/Component.tsx'), tsx('Editing attempt 1') + '\nconst brokenTsx = <div>missing closing tag;\n'));
  const bad = await actualBuild(A1, 'A-edit1-actual-TSX-failure');
  check('054.A-edit1.actualError', 'real esbuild compiler error, exit1, signed FAIL receipt bound to attempt/revision/cwd', {exit: bad.exitCode, receipt: bad.recordedOutput.data, log: readFileSync(bad.signedReport.logRef.path, 'utf8')}, bad.exitCode !== 0 && bad.signedReport.verdict === 'FAIL' && bad.signedReport.archiveBuildId === null && bad.signedReport.attemptId === A1.data.attempt.attemptId && bad.signedReport.sourceRevision === 2 && readFileSync(bad.signedReport.logRef.path, 'utf8').includes('Component.tsx'));
  const failedInspect = await inspect(sessionA, A1.data.attempt.attemptId);
  json(join(root, 'queries/A-edit1-error.json'), failedInspect);
  check('054.A-edit1.errorLocatable', {state: 'build_failed', workspace: workspaceA, missing: 'PreviewReceipt'}, failedInspect.body.data, failedInspect.body.data.attempt.state === 'build_failed' && !!failedInspect.body.data.attempt.terminalReason && failedInspect.body.data.workspaceAvailable && failedInspect.body.data.draft.workspacePath === workspaceA && failedInspect.body.data.attempt.buildReceiptId === bad.recordedOutput.data.receiptId && failedInspect.body.data.attempt.evidenceRefs.some(ref => ref.sha256 === bad.output.reportRef.sha256));
  const failedState = sqlSnapshot('03-A-edit1-failed', [workspaceA, workspaceB]); stateDiff('step2-A-first-edit-failure', preEdit, failedState);
  const A2 = await begin(sessionA, {mode: 'edit', viewId: A.data.view.viewId}); linkedBegin('A-edit2', A2);
  check('054.A-edit2.revisionDirectory', {draft: A.data.draft.draftId, workspace: workspaceA, epoch: 3, sourceRevision: 3}, A2.data.draft, A2.data.draft.draftId === A.data.draft.draftId && A2.data.draft.workspacePath === workspaceA && A2.data.draft.sourceRevision === 3 && A2.data.attempt.epoch === 3 && new Set([A.data.attempt.attemptId, A1.data.attempt.attemptId, A2.data.attempt.attemptId]).size === 3);
  filesForAttempt('A-edit2-repair-unfinished', A2, directory => writeFileSync(join(directory, 'src/Component.tsx'), tsx('Editing attempt 2 repaired source')));
  const unfinished = await inspect(sessionA, A2.data.attempt.attemptId); json(join(root, 'queries/A-edit2-unfinished.json'), unfinished);
  check('054.A-edit2.unfinishedQuery', {state: 'editing', sourceRevision: 3, workspace: workspaceA, missing: ['BuildReceipt', 'PreviewReceipt']}, unfinished.body.data, unfinished.body.data.attempt.state === 'editing' && unfinished.body.data.workspaceAvailable && unfinished.body.data.draft.workspacePath === workspaceA && unfinished.body.data.attempt.sourceRevision === 3 && canonicalJson(unfinished.body.data.missingEvidence) === canonicalJson(['BuildReceipt', 'PreviewReceipt']));
  const old = await inspect(sessionA, A1.data.attempt.attemptId); json(join(root, 'queries/A-edit1-superseded-history.json'), old);
  check('054.A-edit1.historyRetained', {state: 'superseded', receipt: bad.recordedOutput.data.receiptId}, old.body.data, old.body.data.attempt.state === 'superseded' && old.body.data.attempt.sourceRevision === 2 && old.body.data.attempt.buildReceiptId === bad.recordedOutput.data.receiptId && old.body.data.attempt.invocationRefs.includes(A1.requestId) && f.store.get('build_receipts', bad.recordedOutput.data.receiptId).verdict === 'FAIL');
  const unfinishedState = sqlSnapshot('04-A-edit2-unfinished', [workspaceA, workspaceB]); stateDiff('step2-A-second-edit-unfinished', failedState, unfinishedState);
  check('054.AB.BUnchangedAfterAEdits', untouchedB, inventory(workspaceB), canonicalJson(untouchedB) === canonicalJson(inventory(workspaceB)) && f.store.get('authoring_drafts', B.data.draft.draftId).sourceRevision === 1 && f.store.get('authoring_attempts', B.data.attempt.attemptId).state === 'editing');
  await rejectUnchanged('foreign-owner-edit', sessionB, 'apps.authoring.begin', {mode: 'edit', viewId: A.data.view.viewId}, 'VIEW_NOT_OWNED', [workspaceA, workspaceB, archivePath]);
  await rejectUnchanged('foreign-workspace-edit', sessionA, 'apps.authoring.begin', {mode: 'edit', viewId: A.data.view.viewId, workspacePath: workspaceB}, 'WORKSPACE_CONFLICT', [workspaceA, workspaceB, archivePath]);
  await rejectUnchanged('archive-workspace-edit', sessionA, 'apps.authoring.begin', {mode: 'edit', viewId: A.data.view.viewId, workspacePath: archivePath}, 'WORKSPACE_CONFLICT', [workspaceA, workspaceB, archivePath]);
  await rejectUnchanged('archive-workspace-new', sessionA, 'apps.authoring.begin', {mode: 'new', workspacePath: archivePath}, 'WORKSPACE_NOT_EMPTY', [workspaceA, workspaceB, archivePath]);
  await rejectUnchanged('other-owner-inspect', sessionB, 'apps.authoring.inspect', {attemptId: A2.data.attempt.attemptId}, 'VIEW_NOT_OWNED', [workspaceA, workspaceB, archivePath]);
  await rejectUnchanged('late-old-result', sessionA, 'apps.authoring.record_build', {attemptId: A1.data.attempt.attemptId, epoch: A1.data.attempt.epoch, reportRef: bad.output.reportRef}, 'ATTEMPT_SUPERSEDED', [workspaceA, workspaceB, archivePath]);
  const cancelBefore = sqlSnapshot('05-before-cancel', [workspaceA, workspaceB]);
  const cancelled = await action(sessionA, 'apps.authoring.cancel', {attemptId: A2.data.attempt.attemptId, expectedEpoch: A2.data.attempt.epoch, reason: 'Explicit synthetic fixture cancellation; keep recoverable files.'});
  assert.equal(cancelled.body.status, 'ok', JSON.stringify(cancelled));
  const cancellation = await inspect(sessionA, A2.data.attempt.attemptId); json(join(root, 'queries/A-edit2-cancelled.json'), cancellation);
  check('054.cancel.preservedWorkspace', {attempt: 'cancelled', epoch: 4, filesUnchanged: true}, cancellation.body.data, cancellation.body.data.attempt.state === 'cancelled' && cancellation.body.data.draft.epoch === 4 && cancellation.body.data.workspaceAvailable && canonicalJson(cancelBefore.value.directories[0].files) === canonicalJson(inventory(workspaceA)));
  const cancelAfter = sqlSnapshot('06-after-cancel', [workspaceA, workspaceB]); stateDiff('cancel-A-edit2', cancelBefore, cancelAfter);
  await rejectUnchanged('cancelled-late-result', sessionA, 'apps.authoring.record_build', {attemptId: A2.data.attempt.attemptId, epoch: A2.data.attempt.epoch, reportRef: bad.output.reportRef}, 'ATTEMPT_SUPERSEDED', [workspaceA, workspaceB, archivePath]);
  const finalState = sqlSnapshot('07-final-ledger-export', [workspaceA, workspaceB, archivePath]);
  const links = f.store.list('authoring_attempts').map(attempt => ({attempt, draft: f.store.get('authoring_drafts', attempt.draftId), beginInvocations: attempt.invocationRefs.map(id => f.store.get('invocations', id)), resultInvocations: f.store.list('invocations').filter(row => row.request.input?.attemptId === attempt.attemptId), buildReceipt: attempt.buildReceiptId ? f.store.get('build_receipts', attempt.buildReceiptId) : null}));
  const linkRef = json(join(root, 'draft-attempt-invocation-links.json'), links);
  check('054.ledger.allBeginInvocationsExist', '4 real attempts, every invocationRef resolves to exact begin output', linkRef, links.length === 4 && links.every(link => link.beginInvocations.length > 0 && link.beginInvocations.every(row => row?.state === 'settled' && row.request.source.sessionId === link.draft.ownerSessionId && row.result.status === 'ok' && row.result.data.attempt.attemptId === link.attempt.attemptId)));
  check('054.ledger.buildIdentity', 'two distinct real receipts; no component identity reused as build/attempt/view', links, links.filter(link => link.buildReceipt).length === 2 && links.every(link => !link.buildReceipt || link.buildReceipt.attemptId === link.attempt.attemptId && link.buildReceipt.sourceRevision === link.attempt.sourceRevision && link.buildReceipt.cwd === link.draft.workspacePath));
  check('054.edits.attemptOwnership', '4 file changes attributed to current begin invocation/revision; compiler writes attributed to real command', edits, edits.length === 4 && edits.every(edit => links.some(link => link.attempt.attemptId === edit.attemptId && link.attempt.sourceRevision === edit.sourceRevision && link.attempt.epoch === edit.epoch && link.attempt.invocationRefs.includes(edit.beginInvocationId))));
  check('054.originals.retained', 'shared template, B and immutable baseline archive unchanged', {template: inventory(template), B: inventory(workspaceB), archive: inventory(archivePath)}, canonicalJson(templateBefore) === canonicalJson(inventory(template)) && canonicalJson(untouchedB) === canonicalJson(inventory(workspaceB)) && canonicalJson(archiveBefore) === canonicalJson(inventory(archivePath)) && f.presentation.sources.verify(baseline.signedReport.archiveBuildId).valid);
  check('054.noAutoSaveOrPublish', '0 saved component/version/publication; no domain writes; original host/model not called', {components: finalState.value.tables.components.length, revisions: finalState.value.tables.component_versions.length, publications: finalState.value.tables.view_publications.length, connections: f.runtime.listConnections?.() ?? 'see SQL'}, ['components', 'component_versions', 'view_publications', 'operations'].every(table => finalState.value.tables[table].length === 0) && traces.every(trace => trace.url.startsWith(f.url + '/')));
  const afterInputs = sourceInputs(); json(join(root, 'candidate-source-inputs-after.json'), afterInputs);
  check('054.candidate.143InputsUnchanged', beforeInputs, afterInputs, canonicalJson(beforeInputs) === canonicalJson(afterInputs) && afterInputs.every(row => row.match));
  check('054.sourceHelpersUnchanged', sourceSnapshot, null, inventory(join(root, 'executed-source')).every(file => hashFile(join(repository, file.path)) === file.sha256));
  check('054.installedCliSdkUnchanged', {cli: identity.buildCli.sha256, sdk: identity.sdk.sha256}, {cli: hashFile(buildCli), sdk: hashFile(identity.sdk.path)}, hashFile(buildCli) === identity.buildCli.sha256 && hashFile(identity.sdk.path) === identity.sdk.sha256);
  outcome = 'PASS';
} catch (error) {
  json(join(root, 'failure.json'), {name: error.name, message: error.message, stack: error.stack, observedAt: new Date().toISOString()}); process.exitCode = 1;
} finally {
  const cleanup = [];
  if (f) { try { const url = f.url, leasePath = f.lease.path; f.server.closeAllConnections(); await new Promise(accept => f.server.close(accept)); await f.close();
    // A new TCP socket avoids observing an HTTP client's previously pooled connection.
    const probe = await new Promise(accept => {const socket = connect({host: '127.0.0.1', port: Number(new URL(url).port)}); socket.setTimeout(1500); socket.once('connect', () => {socket.destroy(); accept('UNEXPECTED_CONNECTION');}); socket.once('error', error => {socket.destroy(); accept(error.code);}); socket.once('timeout', () => {socket.destroy(); accept('PROBE_TIMEOUT');});});
    const ownedBuildCliProcesses = executions.map(execution => {let exists = true; try {process.kill(execution.pid, 0);} catch (error) {if (error.code === 'ESRCH') exists = false; else throw error;} return {pid: execution.pid, terminalExitCode: execution.exitCode, terminal: execution.fixtureCliProcessTerminal, processExistsAfterClose: exists};});
    const row = {url, serverClosed: !f.server.listening, leasePath, leaseAbsent: !existsSync(leasePath), afterCloseProbe: probe, ownedBuildCliProcesses, browserProcessCount: 0, browserWasNeverLaunched: true};
    cleanup.push(row); check('054.cleanup', 'fresh fixture TCP connection ECONNREFUSED, lease absent, real build process PIDs absent; no browser launched', row, row.serverClosed && row.leaseAbsent && probe === 'ECONNREFUSED' && row.ownedBuildCliProcesses.every(child => child.terminal && !child.processExistsAfterClose));
  } catch (error) { cleanup.push({error: error.message}); outcome = 'FAIL'; process.exitCode = 1; } }
  const tracesRef = json(join(root, 'http-traces.json'), traces), assertionsRef = json(join(root, 'assertions.json'), assertions), editsRef = json(join(root, 'file-edit-journal.json'), edits), cleanupRef = json(join(root, 'cleanup.json'), cleanup);
  const result = {recordKind: 'EXECUTED_ACCEPTANCE', testId: 'TST-054', requirementIds: ['REQ-054'], acceptanceCriteria: ['AC-13-02', 'AC-13-08'], releaseId: 'apps-a2-20261007', runId, targetCommit: identity?.executedCommit ?? null, executedCommit: identity?.executedCommit ?? null, scope: 'FIXTURE', status: outcome, completeScope: outcome === 'PASS', startedAt, finishedAt: new Date().toISOString(), identity: identityRef, environment: {node: process.version, os: process.platform, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, browser: 'Not required by FIXTURE; never launched'}, versions: {bundle: identity?.candidate, runtime: identity?.versions.runtimeVersion, databaseSchema: identity?.versions.databaseSchemaVersion, dshHost: 'NOT_RUN', externalModel: 'NOT_RUN'}, modelClass: 'NO_MODEL', steps: [
    {index: 1, description: 'Create A/B new drafts through Runtime capabilities; populate separate empty workspaces from identical ordinary React/TSX/CSS template; real begin invocations link to durable attempts', assertionPrefix: ['054.A-new.', '054.B-new.', '054.AB.'], status: outcome},
    {index: 2, description: 'A edit 1 at revision/epoch2 actually compiles invalid TSX to failure receipt/log; A edit 2 at revision/epoch3 repairs source and remains unfinished in same recoverable directory', assertionPrefix: ['054.A-edit1.', '054.A-edit2.', '054.edits.'], status: outcome},
    {index: 3, description: 'Query unfinished/current/historical attempts and actual related invocation rows, recover workspace and compiler-error log; reject foreign owner/workspace/archive and late results without file/domain alteration; cancel with files retained', assertionPrefix: ['054.ledger.', '054.foreign-', '054.archive-', '054.other-owner-', '054.late-', '054.cancel'], status: outcome},
  ], assertions, fixtureRefs: [identityRef, ...stages.map(stage => stage.ref)], artifactRefs: [identityRef, tracesRef, assertionsRef, editsRef, cleanupRef], assertionCounts: {total: assertions.length, passed: assertions.filter(row => row.result === 'PASS').length, failed: assertions.filter(row => row.result === 'FAIL').length}, executor: 'Codex /root/formal_draft_ledger_fixture', reviewer: null, independentReview: 'PENDING', roles: {I: 'Harness author and fixture executor', V: null, R: null}, limitations: ['FIXTURE only. No actual DSH UI/Agent/native composer; no external model requests.', 'Files are changed by the acceptance harness after current attempt ownership is verified; immutable edit snapshots identify the responsible attempt. Runtime owns metadata, not an added file-edit/model loop.', 'Normal locked dependencies reused through documented node_modules junction; clean installation NOT_RUN.', 'Failed and cancelled attempts, source originals, immutable archives and all historical evidence are retained.', 'No saved component or real business mutation, no release approval.'], releaseApproval: 'NOT_ACCEPTED', cleanup};
  const resultRef = json(join(root, 'TST-054/FIXTURE/result.json'), result);
  const references = new Map(), errors = [];
  function visit(value, owner) { if (!value || typeof value !== 'object') return; if (typeof value.path === 'string' && isAbsolute(value.path) && /^[a-f0-9]{64}$/.test(value.sha256 ?? '') && Number.isSafeInteger(value.bytes)) {const key = `${value.path}|${value.sha256}|${value.bytes}`; if (!references.has(key)) {try { const actual = evidenceFile(value.path); references.set(key, {...value, actual, owner}); if (actual.sha256 !== value.sha256 || actual.bytes !== value.bytes) errors.push({owner, expected: value, actual}); } catch (error) { errors.push({owner, expected: value, error: error.message}); }} } for (const item of Object.values(value)) visit(item, owner); }
  const jsonFiles = inventory(root).filter(file => file.path.endsWith('.json') && !file.path.startsWith('executed-source/') && !file.path.endsWith('package-lock.json') && !file.path.endsWith('package.json'));
  for (const file of jsonFiles) { const path = join(root, file.path); try {visit(JSON.parse(readFileSync(path, 'utf8')), path);} catch (error) { errors.push({path, error: error.message});} }
  const integrityRef = json(join(root, 'reference-integrity.json'), {checkedJsonFiles: jsonFiles.length, referencedFiles: references.size, errors, records: [...references.values()]});
  if (errors.length) process.exitCode = 1;
  const indexRef = json(join(root, 'artifact-index.json'), {files: inventory(root).map(file => ({...file, path: join(root, file.path)})), excluded: ['node_modules dependency junction', 'SQLite WAL/SHM after normal close if absent'], keyAndDatabasePrivate: true});
  const finalRef = json(join(root, 'result.json'), {runId, root, status: errors.length ? 'FAIL' : outcome, result: resultRef, identity: identityRef, integrity: integrityRef, artifactIndex: indexRef, assertionCounts: result.assertionCounts, completeScope: outcome === 'PASS' && !errors.length, cleanup, independentReview: 'PENDING'});
  console.log(JSON.stringify({runId, root, status: errors.length ? 'FAIL' : outcome, result: finalRef, formalResult: resultRef, assertions: result.assertionCounts, referenceErrors: errors.length, cleanup}, null, 2));
}
