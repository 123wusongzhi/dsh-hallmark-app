import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
// @ts-expect-error Shared fixture is executable JavaScript and uses the same private recording.
import {recordedPackaging,recordedSalesProduct} from '../../scripts/performance/six-batch/packaging/fixture.mjs';
// @ts-expect-error Standalone artifact validation runner has no declaration file.
import {validateArtifact} from '../../scripts/performance/six-batch/packaging/validate-artifact.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const versions = JSON.parse(readFileSync(new URL('../../bundles/apps/versions.json', import.meta.url), 'utf8'));
const archive = new URL(`../../artifacts/dsh-plugin-apps-bundle-${versions.bundleVersion}.tgz`, import.meta.url);

test('actual packaged Runtime validates pricing and packaging without checkout dependencies', {
  skip: existsSync(archive) ? false : 'Run npm run build:apps to produce the candidate archive before this packaging regression.',
  timeout: 60000,
}, () => {
  const result = validateArtifact(root,{temporaryRoot:resolve(root,'..','.real-corpus-isolation')});
  assert.equal(result.acceptance, true);
  assert.equal(result.manifest.dependencyProvisioning, null);
  assert.equal(result.parity.validConfig.revision, 1);
  assert.equal(result.parity.invalidConfigs.length, 15);
  assert.equal(result.parity.packagingInvalid.ok, false);
  assert.equal(result.parity.invalidPackaging.length, 10);
  assert.equal(result.parity.packagingResolved.weightGrams, Math.round(recordedPackaging.weightKg*1000)*3);
  assert.equal(result.parity.profit.data.products[0].profit.actualMinor, recordedSalesProduct.pricing.sellerMinor);
  const identities = result.parity.profitIdentities.map((row: any) => row.productId);
  assert.ok(identities.includes(1));
  assert.ok(identities.includes('1'));
  assert.ok(identities.includes('9007199254740993'), 'decimal string IDs retain precision beyond safe numeric range');
  for (const row of result.parity.profitIdentities) {
    assert.equal(row.profit.status, 'ok');
    assert.equal(String(row.profit.data.products[0].productId), String(row.productId));
    const profit = row.profit.data.products[0].profit;
    assert.equal(profit.actualMinor, recordedSalesProduct.pricing.sellerMinor);
    assert.equal(profit.pricingQuote.planId, 'low');
    assert.equal(profit.packageGrams, recordedSalesProduct.declaredWeight.grams);
  }
});
