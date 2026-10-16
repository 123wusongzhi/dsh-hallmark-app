import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {cleanEnvironment, extractArtifact, sha256} from './artifact.mjs';
import {realCorpus,realCorpusPath} from '../../../../test/real-data/corpus.ts';

const here = dirname(fileURLToPath(import.meta.url));
export function prepareRun(root, {provisionDiagnosticZod = false,temporaryRoot} = {}) {
  const temporaryBase=resolve(temporaryRoot??tmpdir());
  mkdirSync(temporaryBase,{recursive:true});
  const directory = mkdtempSync(join(temporaryBase, 'runtime-artifact-'));
  const cleanup=()=>{assert.equal(dirname(resolve(directory)),temporaryBase,'cleanup stays in the explicitly selected temporary root');assert.match(basename(directory),/^runtime-artifact-[A-Za-z0-9]+$/);rmSync(directory,{recursive:true,force:true});};
  try {
    const artifact = extractArtifact(root, join(directory, 'candidate'), {provisionDiagnosticZod});
    const harness = join(directory, 'harness'), home = join(directory, 'home');
    mkdirSync(harness); mkdirSync(home);
    for (const name of ['isolation-preload.mjs', 'parity-probe.mjs', 'fixture.mjs'])
      cpSync(join(here, name), join(harness, name));
    realCorpus(); // Validate the private response/image/manifest hashes before isolation.
    cpSync(realCorpusPath,join(harness,'real-data.json'));
    const resourceFile = join(directory, 'resources.json');
    return {directory, artifact, harness, home, resourceFile,
      args: ['--import', pathToFileURL(join(harness, 'isolation-preload.mjs')).href],
      env: cleanEnvironment(home, {PACKAGING_RUN_ROOT: directory, PACKAGING_RESOURCE_FILE: resourceFile}),
      cleanup};
  } catch (error) { cleanup(); throw error; }
}

export function validateArtifact(root, output, options = {}) {
  if(output&&typeof output==='object'){options={...output,...options};output=undefined;}
  const run = prepareRun(root, options);
  try {
    const resultFile = join(run.directory, 'parity.json');
    const child = spawnSync(process.execPath, [...run.args, join(run.harness, 'parity-probe.mjs'),
      run.artifact.entry, join(run.directory, 'data'), resultFile], {
      cwd: run.directory, env: run.env, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024,
    });
    if (output) { mkdirSync(output, {recursive: true}); writeFileSync(join(output, 'probe.log'), child.stdout + child.stderr); }
    assert.equal(child.status, 0, child.error?.message ?? child.stdout + child.stderr);
    const parity = JSON.parse(readFileSync(resultFile, 'utf8'));
    const isolation = JSON.parse(readFileSync(run.resourceFile, 'utf8'));
    assert.equal(parity.networkAttempts, 0); assert.equal(isolation.networkAttempts, 0);
    if (!options.provisionDiagnosticZod)
      assert.ok(isolation.loadedModules.every(path => !path.split('/').includes('node_modules')), 'self-contained final artifact');
    const result = {status: 'PASS', acceptance: !options.provisionDiagnosticZod,
      manifest: run.artifact.manifest, isolation,
      normalization: 'Identical fixed UTC Date and sequential UUIDs only. No field omission or output normalization.',
      paritySha256: sha256(JSON.stringify(parity)), parity};
    if (output) writeFileSync(join(output, 'validation.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally { run.cleanup(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, output, mode] = process.argv.slice(2);
  if (!root || !output || (mode && mode !== '--diagnostic-zod'))
    throw Error('Usage: validate-artifact.mjs checkout output-directory [--diagnostic-zod]');
  const result = validateArtifact(root, resolve(output), {provisionDiagnosticZod: mode === '--diagnostic-zod'});
  console.log(JSON.stringify({...result, parity: undefined}));
}
