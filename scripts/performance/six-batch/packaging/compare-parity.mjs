import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const [oldPath, newPath, output] = process.argv.slice(2);
if (!oldPath || !newPath) throw Error('Usage: compare-parity.mjs old-validation.json new-validation.json [output.json]');
const old = JSON.parse(readFileSync(oldPath, 'utf8')), next = JSON.parse(readFileSync(newPath, 'utf8'));
assert.equal(old.status, 'PASS'); assert.equal(next.status, 'PASS');
assert.equal(old.acceptance, false, 'old artifact is diagnostic only');
assert.equal(old.manifest.dependencyProvisioning?.version, '4.3.6');
assert.equal(next.acceptance, true); assert.equal(next.manifest.dependencyProvisioning, null);
assert.deepEqual(old.parity, next.parity, 'Complete responses, SQLite schema and table rows must match; no output normalization');
const result = {status: 'PASS', paritySha256: next.paritySha256,
  normalization: next.normalization, oldArchiveSha256: old.manifest.archiveSha256,
  newArchiveSha256: next.manifest.archiveSha256, newRuntimeSha256: next.manifest.runtimeSha256,
  rows: Object.fromEntries(Object.entries(next.parity.tables).map(([name, rows]) => [name, rows.length])),
  invalidPricingSchemas: next.parity.invalidConfigs.length, pricingQuoteCases: next.parity.quotes.length,
  invalidPackagingSchemas: next.parity.invalidPackaging.length,
  notesOperations: next.parity.notes.length, networkAttempts: next.parity.networkAttempts};
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
