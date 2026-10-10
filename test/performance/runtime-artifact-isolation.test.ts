import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// @ts-expect-error Standalone artifact validation runner has no declaration file.
import {validateArtifact} from '../../scripts/performance/six-batch/packaging/validate-artifact.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const versions = JSON.parse(readFileSync(new URL('../../bundles/apps/versions.json', import.meta.url), 'utf8'));
const archive = new URL(`../../artifacts/dsh-plugin-apps-bundle-${versions.bundleVersion}.tgz`, import.meta.url);

test('actual packaged Runtime validates pricing and packaging without checkout dependencies', {
  skip: existsSync(archive) ? false : 'Run npm run build:apps to produce the candidate archive before this packaging regression.',
  timeout: 60000,
}, () => {
  const result = validateArtifact(root);
  assert.equal(result.acceptance, true);
  assert.equal(result.manifest.dependencyProvisioning, null);
  assert.equal(result.parity.validConfig.revision, 1);
  assert.equal(result.parity.invalidConfigs.length, 15);
  assert.equal(result.parity.packagingInvalid.ok, false);
  assert.equal(result.parity.invalidPackaging.length, 10);
  assert.equal(result.parity.packagingResolved.weightGrams, 1350);
  assert.equal(result.parity.profit.data.products[0].profit.actualMinor, 13499);
});
