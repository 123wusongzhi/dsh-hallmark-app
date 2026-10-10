import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, cpSync, copyFileSync, symlinkSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const [mode, baselineArg, candidateArg, outputArg] = process.argv.slice(2);
assert.ok(['smoke', 'functional', 'timing'].includes(mode) && baselineArg && candidateArg && outputArg,
  'Usage: bash run.sh smoke|functional|timing BASELINE_ROOT CANDIDATE_ROOT NEW_OUTPUT_DIRECTORY');
assert.equal(process.env.HALLMARK_C72_CPU_LOCK_HELD, '1', 'Use run.sh: the complete command group must hold the CPU lock.');
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../..');
const docs = join(repo, 'docs/performance/candidate72-revalidation');
const manifest = JSON.parse(readFileSync(join(docs, 'source-manifest.json'), 'utf8'));
const base = realpathSync(baselineArg), candidate = realpathSync(candidateArg), output = resolve(outputArg);
assert.notEqual(base, candidate);
for (const root of [base, candidate]) assert.ok(output !== root && !output.startsWith(root + sep), 'Output must be outside both source trees.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => {
  const child = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); return child.stdout.trim();
};
assert.equal(git(base, 'rev-parse', 'HEAD'), manifest.commit, 'Baseline must be the fixed candidate72 commit.');
assert.equal(git(base, 'rev-parse', 'HEAD^{tree}'), manifest.tree);
assert.equal(git(base, 'diff', '--name-only', 'HEAD', '--', 'packages'), '', 'Baseline production tree must be unchanged.');
const expected = Object.keys(manifest.sourceFiles).sort();
assert.deepEqual(git(candidate, 'diff', '--name-only', manifest.commit, '--', 'packages').split('\n').filter(Boolean).sort(), expected,
  'Use an isolated three-patch candidate: unrelated production changes would confound attribution.');
for (const [file, hashes] of Object.entries(manifest.sourceFiles)) {
  assert.equal(sha(readFileSync(join(base, file))), hashes.baseline, 'Baseline source drift: ' + file);
  assert.equal(sha(readFileSync(join(candidate, file))), hashes.candidate, 'Candidate source drift: ' + file);
}
for (const [file, hash] of Object.entries(manifest.dependencyManifests)) {
  assert.equal(sha(readFileSync(join(base, file))), hash, 'Baseline dependency manifest drift: ' + file);
  assert.equal(sha(readFileSync(join(candidate, file))), hash, 'Candidate dependency manifest drift: ' + file);
}
for (const [file, hash] of Object.entries(manifest.portableScripts)) assert.equal(sha(readFileSync(join(here, file))), hash, 'Portable script drift: ' + file);
if (mode !== 'smoke') for (const [file, hash] of Object.entries(manifest.regressionFiles)) assert.equal(sha(readFileSync(join(candidate, file))), hash, 'Regression source drift: ' + file);
for (const [file, entry] of Object.entries(manifest.archives)) {
  const compressed = readFileSync(join(docs, file));
  assert.equal(sha(compressed), entry.sha256); assert.equal(sha(gunzipSync(compressed)), entry.uncompressedSha256);
}
mkdirSync(output); // Deliberately fail rather than overwrite a previous run.
symlinkSync(base, join(output, 'hallmark-c72-baseline'), 'dir');
symlinkSync(candidate, join(output, 'hallmark-c72-three-repro'), 'dir');
const stage = join(output, 'hallmark-c72-performance-evidence'); mkdirSync(stage);
for (const folder of ['frontend', 'collection', 'data-transfer']) cpSync(join(here, folder), join(stage, folder), { recursive: true });
copyFileSync(join(here, 'count-array-callbacks.mjs'), join(stage, 'count-array-callbacks.mjs'));
copyFileSync(join(candidate, 'packages/component-runtime/src/data-transfer-client.ts'), join(stage, 'data-transfer/patched-data-transfer-client.ts'));
const env = { ...process.env, TZ: 'Asia/Shanghai', C72_BASELINE: base, C72_CANDIDATE: candidate,
  PATH: dirname(process.execPath) + ':' + process.env.PATH };
const identity = { mode, scope: mode === 'timing' ? 'formal-requested-ABBA' : 'functional-only-no-speed-claim',
  base, candidate, baseCommit: manifest.commit, candidateHead: git(candidate, 'rev-parse', 'HEAD'),
  candidateStatus: git(candidate, 'status', '--porcelain'), sourceFiles: manifest.sourceFiles,
  node: process.version, versions: process.versions, lock: '/tmp/hallmark-c72-cpu.lock', steps: [] };
const saveIdentity = () => writeFileSync(join(output, 'run-identity.json'), JSON.stringify(identity, null, 2)); saveIdentity();
function run(program, args, cwd, label, extraEnv = {}) {
  const child = spawnSync(program, args, { cwd, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(output, label + '.stdout.log'), child.stdout ?? '');
  writeFileSync(join(output, label + '.stderr.log'), child.stderr ?? '');
  identity.steps.push({ label, program, args, cwd, status: child.status, error: child.error?.message }); saveIdentity();
  assert.equal(child.status, 0, label + ': ' + (child.error?.message ?? child.stderr));
  return child.stdout;
}
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const front = join(stage, 'frontend'), coll = join(stage, 'collection'), transfer = join(stage, 'data-transfer');
run(process.execPath, ['build.mjs'], front, 'frontend-build');
const attributes = mode === 'smoke' ? '0' : '20';
for (const arm of ['baseline', 'lazy']) run(process.execPath, [arm + '.mjs', '10', attributes, 'parity', arm], front, 'frontend-' + arm);
assert.deepEqual(gunzipSync(readFileSync(join(front, 'baseline.frames.json.gz'))), gunzipSync(readFileSync(join(front, 'lazy.frames.json.gz'))));
assert.deepEqual(json(join(front, 'baseline.json')).requests, json(join(front, 'lazy.json')).requests);
const size = mode === 'smoke' ? 'tiny' : 'medium';
for (const [arm, root] of [['baseline', base], ['candidate', candidate]]) {
  const args = ['runtime-collection-harness.mjs', 'root=' + root, 'mode=parity', 'size=' + size, 'output=' + join(coll, arm + '.json')];
  run(process.execPath, args, coll, 'collection-' + arm);
  if (mode !== 'smoke') {
    run(process.execPath, ['--import', join(stage, 'count-array-callbacks.mjs'), ...args.slice(0, -1), 'output=' + join(coll, arm + '-instrumented.json')], coll,
      'collection-' + arm + '-counts', { COUNTS_OUT: join(coll, arm + '-counts.json') });
    assert.deepEqual(readFileSync(join(coll, arm + '.json')), readFileSync(join(coll, arm + '-instrumented.json')));
  }
}
assert.deepEqual(readFileSync(join(coll, 'baseline.json')), readFileSync(join(coll, 'candidate.json')));
run(process.execPath, ['count-and-parity.mjs'], transfer, 'transfer-functional');
if (mode !== 'smoke') run(process.execPath, ['--test', 'test/plugin-apps/business-content-lazy.test.ts',
  'test/app-hallmark/listing-state-index.test.ts', 'test/performance/data-transfer-byte-copy.test.ts'], candidate, 'eight-regressions');
if (mode === 'timing') {
  run(process.execPath, ['timing.mjs'], front, 'frontend-abba');
  run('python3', ['run-abba.py', '--old', base, '--new', candidate, '--label', 'c72', '--sizes', 'tiny', 'medium', '--cycles', '5'], coll, 'collection-abba');
  run(process.execPath, ['run-abba.mjs'], transfer, 'transfer-abba');
  const transferRows = json(join(transfer, 'timing-raw.json')); assert.equal(transferRows.length, 40);
  for (const shape of ['inline210k', 'chunk333k']) {
    const rows = transferRows.filter(row => row.shape === shape), reference = rows[0].samples[0];
    for (const row of rows) for (const sample of row.samples) for (const key of ['outputHashes', 'protocolHash', 'prepareCalls', 'chunkReads', 'inlinePackets', 'unchangedPackets']) assert.deepEqual(sample[key], reference[key]);
  }
  assert.equal(json(join(front, 'timing-raw.json')).length, 40);
  assert.equal(readdirSync(join(coll, 'timing/c72')).filter(file => file.endsWith('.json') && file !== 'summary.json').length, 40);
}
writeFileSync(join(output, 'RESULT.json'), JSON.stringify({ status: 'PASS', mode, baseCommit: manifest.commit,
  frontendFrames: json(join(front, 'baseline.json')).frameCount, collectionSize: size,
  collectionBytesSha256: sha(readFileSync(join(coll, 'baseline.json'))), sourceIdentity: 'run-identity.json',
  timingProcesses: mode === 'timing' ? 120 : 0, browserAcceptance: 'NOT_RUN', integrationGate: 'not run by this focused script' }, null, 2));
console.log('PASS: ' + output + '/RESULT.json');
