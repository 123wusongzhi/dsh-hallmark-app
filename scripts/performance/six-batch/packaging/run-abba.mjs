import {mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {measureHttpProcess} from './http-process.mjs';
const [oldRoot, newRoot, output, permission, comparisonMode] = process.argv.slice(2);
if (!oldRoot || !newRoot || !output || permission !== '--exclusive-window')
  throw Error('Usage: run-abba.mjs old-checkout new-checkout output --exclusive-window (no concurrent builds/tests/benchmarks)');
if (comparisonMode && comparisonMode !== '--both-self-contained') throw Error('Unknown comparison mode');
const baselineArm = comparisonMode ? 'old-self-contained' : 'old-diagnostic';
const out = resolve(output); mkdirSync(out, {recursive: true});
const startedAt = new Date().toISOString(), results = [];
for (let cycle = 1; cycle <= 5; cycle++) {
  for (const [index, arm] of [baselineArm, 'new-self-contained', 'new-self-contained', baselineArm].entries()) {
    const result = await measureHttpProcess(arm === baselineArm ? oldRoot : newRoot, {diagnostic: arm === baselineArm && !comparisonMode});
    const row = {cycle, step: index + 1, arm, ...result}; results.push(row);
    writeFileSync(join(out, `c${cycle}-s${index + 1}-${arm}.json`), JSON.stringify(row, null, 2) + '\n');
    console.log(JSON.stringify({cycle, step: index + 1, arm, status: row.status, startupMs: row.startupMs}));
  }
}
const median = values => { const a = [...values].sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const metrics = row => ({startupMs: row.startupMs,
  cpuMs: (row.resources.cpuMicros.user + row.resources.cpuMicros.system) / 1000,
  maxRSSKiB: row.resources.maxRSSKiB, archiveBytes: row.manifest.archiveBytes, runtimeBytes: row.manifest.runtimeBytes,
  ...Object.fromEntries(Object.entries(row.samplesMs).map(([name, values]) => [`http-${name}-medianMs`, median(values)]))});
const armMedians = Object.fromEntries([baselineArm, 'new-self-contained'].map(arm => {
  const rows = results.filter(row => row.arm === arm).map(metrics);
  return [arm, Object.fromEntries(Object.keys(rows[0]).map(key => [key, median(rows.map(row => row[key]))]))];
}));
const cycles = Array.from({length: 5}, (_, i) => {
  const rows = results.filter(row => row.cycle === i + 1);
  const sides = [baselineArm, 'new-self-contained'].map(arm => rows.filter(row => row.arm === arm).map(metrics));
  return {cycle: i + 1, changesPct: Object.fromEntries(Object.keys(sides[0][0]).map(key => {
    const old = median(sides[0].map(row => row[key])), next = median(sides[1].map(row => row[key]));
    return [key, old === 0 ? null : (next / old - 1) * 100];
  }))};
});
const summary = {status: 'PASS', startedAt, finishedAt: new Date().toISOString(), node: process.version,
  processCount: results.length, schedule: '5 ABBA cycles; fresh process, extraction, database, HOME and cwd for every observation',
  warmup: '3 rounds per process excluded from HTTP latency; startup has no process warmup. OS filesystem cache not flushed.',
  scope: 'Actual unmodified CLI startup and loopback HTTP. Synthetic Notes reads and separately labeled pricing quote / strict Zod validation. CPU covers whole child lifecycle; no production workload claims.',
  auditMode: 'timing-no-resolver-hook: clean environment/cwd/HOME, verified archive, no ancestor node_modules, outbound fetch rejection and child resource capture remain active; module-resolution hooks used only in separate strict functional acceptance',
  baselineLimitation: comparisonMode ? 'Both archives are self-contained; neither arm receives dependency provisioning.' : 'Old archive cannot start standalone; its frozen zod 4.3.6 package was copied only inside its temporary extraction. This is diagnostic, not an accepted release baseline.',
  armMedians, cycles,
  medianPairedChangesPct: Object.fromEntries(Object.keys(cycles[0].changesPct).map(key => [key, median(cycles.map(row => row.changesPct[key]))]))};
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
