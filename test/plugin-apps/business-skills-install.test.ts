import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

test('project skill installer validates without writing, installs both local skills and preserves unrelated skills', { skip: process.platform !== 'win32' }, () => {
  const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true }); const directory = mkdtempSync(join(root, 'business-skills-'));
  const destination = join(directory, 'skills'), evidence = join(directory, 'evidence'), source = resolve('skills');
  const childEnvironment = { ...process.env }; delete childEnvironment.PSModulePath;
  const run = (...extra: string[]) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/install-design-skills.ps1'), '-LocalOnly', '-SourceDirectory', source, '-DestinationDirectory', destination, '-EvidenceDirectory', evidence, ...extra], { encoding: 'utf8', timeout: 20000, env: childEnvironment });
  try {
    const validate = run('-ValidateOnly'); assert.equal(validate.status, 0, validate.stderr); assert.equal(existsSync(destination), false); assert.equal(existsSync(evidence), false);
    const description = JSON.parse(validate.stdout); assert.equal(description.installed, false); assert.deepEqual(description.skills.map((skill: any) => skill.name), ['hallmark-component-design', 'ozon-listing']);
    mkdirSync(join(destination, 'unrelated'), { recursive: true }); writeFileSync(join(destination, 'unrelated', 'SKILL.md'), 'user-owned');
    const installed = run(); assert.equal(installed.status, 0, installed.stderr);
    for (const name of ['hallmark-component-design', 'ozon-listing']) assert.equal(readFileSync(join(destination, name, 'SKILL.md'), 'utf8'), readFileSync(join(source, name, 'SKILL.md'), 'utf8'));
    assert.equal(readFileSync(join(destination, 'unrelated', 'SKILL.md'), 'utf8'), 'user-owned');
    const second = run(); assert.equal(second.status, 0, second.stderr);
    const reports = readdirSync(evidence).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(evidence, name), 'utf8').replace(/^\uFEFF/, '')));
    assert.equal(reports.length, 2); assert.ok(reports.some(report => report.skills.every((skill: any) => skill.changed === false)));
    assert.ok(reports.every(report => report.nativeDiscoveryObserved === false), 'file verification does not claim native discovery');
  } finally { assert.ok(directory.startsWith(root + sep + 'business-skills-')); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
});
