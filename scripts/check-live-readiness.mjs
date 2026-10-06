// Read-only live checks. Credentials stay inside the existing local service client.
import { writeFileSync } from 'node:fs';
import { AppServiceClient } from '../packages/dsh-plugin/server/service-client.ts';
import { HallmarkClient } from '../packages/hallmark-adapter/index.ts';
import { TOOL_DEFINITIONS } from '../packages/contracts/src/index.ts';
import { SERVICE_IDENTITY } from '../packages/service/src/version.ts';

const sourceUrl = process.argv[2];
if (!sourceUrl) throw new Error('Usage: node scripts/check-live-readiness.mjs <explicit-source-url> [new-report.json]');
const source = new HallmarkClient({ baseUrl: sourceUrl });
const service = new AppServiceClient();
const report = { at: new Date().toISOString(), sourceUrl, readOnly: true, platformWrites: 0 };
const sourceHealth = await source.health();
report.source = { status: sourceHealth.status, service: sourceHealth.raw?.service, error: sourceHealth.error?.code };
try {
  const health = await service.request('/health');
  const catalog = await service.request('/tools');
  const actual = (catalog.tools ?? []).map(tool => tool.name).sort();
  const expected = TOOL_DEFINITIONS.map(tool => tool.name).sort();
  report.service = {
    version: health.version,
    toolCount: actual.length,
    catalogMatches: JSON.stringify(actual) === JSON.stringify(expected),
    sourceStatus: health.hallmark?.status,
  };
} catch (error) {
  report.service = { error: error.code ?? 'SERVICE_CHECK_FAILED' };
}
if (sourceHealth.status === 'ok') {
  const collected = await source.searchCollectedItems();
  const stores = await source.getStores();
  const rows = Array.isArray(collected.raw) ? collected.raw : [];
  const ids = rows.map(row => row.id);
  report.collected = {
    status: collected.status,
    arrayResponse: Array.isArray(collected.raw),
    count: rows.length,
    allStableStringIds: ids.every(id => typeof id === 'string' && id.length > 0),
    uniqueIds: new Set(ids).size === ids.length,
    endpoint: collected.provenance?.endpoint,
    error: collected.error?.code,
  };
  report.stores = { status: stores.status, count: Array.isArray(stores.raw) ? stores.raw.length : null, error: stores.error?.code };
}
report.ready = report.source.status === 'ok'
  && report.service.version === SERVICE_IDENTITY.version && report.service.catalogMatches === true
  && report.service.sourceStatus === 'ok'
  && report.collected?.status === 'ok' && report.collected.arrayResponse
  && report.collected.allStableStringIds && report.collected.uniqueIds
  && report.stores?.status === 'ok';
const output = JSON.stringify(report, null, 2);
if (process.argv[3]) writeFileSync(process.argv[3], output + '\n', { encoding: 'utf8', flag: 'wx' });
console.log(output);
if (!report.ready) process.exitCode = 1;
