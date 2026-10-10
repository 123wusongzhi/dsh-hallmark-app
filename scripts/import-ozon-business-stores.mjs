import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { OzonBusinessGateway } from '../packages/ozon-business/src/index.ts';

const args = process.argv.slice(2);
const arg = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const destination = arg('--directory'), sourceConnectionId = arg('--source-connection-id');
if (!destination || !sourceConnectionId || (!arg('--secrets-file') && !arg('--legacy-root'))) {
  console.error('用法：node scripts/import-ozon-business-stores.mjs --directory <新经营目录> --source-connection-id <原连接ID> --legacy-root <原平台目录> [--source-url http://127.0.0.1:4280] [--stores-file <公开店铺JSON>] [--store-id <原店铺ID>]');
  process.exitCode = 1;
} else {
  try {
    const secretsPath = arg('--secrets-file') ?? join(resolve(arg('--legacy-root')), 'data', 'secrets.json');
    // Read original secrets only into this backend process. Do not print errors, paths or request headers.
    const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
    let metadata;
    if (arg('--stores-file')) metadata = JSON.parse(readFileSync(resolve(arg('--stores-file')), 'utf8'));
    else {
      const url = new URL('/api/stores', arg('--source-url') ?? 'http://127.0.0.1:4280');
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(); metadata = await response.json();
    }
    const stores = Array.isArray(metadata) ? metadata : metadata.stores ?? metadata.data?.stores ?? metadata.data;
    if (!Array.isArray(stores) || !secrets.stores || typeof secrets.stores !== 'object') throw new Error();
    const gateway = new OzonBusinessGateway(resolve(destination)), selected = arg('--store-id'), results = [];
    for (const store of stores) {
      const id = String(store.id ?? store.storeId ?? '');
      if (selected && id !== selected || store.removed || store.platform !== 'ozon') continue;
      const credential = secrets.stores[id];
      if (!credential || credential.platform !== 'ozon' || typeof credential.clientId !== 'string' || typeof credential.apiKey !== 'string') continue;
      const imported = gateway.importLegacyStore({ name: String(store.shopName ?? store.name ?? id), legacyStoreId: id, sourceConnectionId,
        enabled: store.status !== 'disabled', ...(typeof store.currency === 'string' && /^[A-Z]{3}$/.test(store.currency) ? { currency: store.currency } : {}),
        credentials: { clientId: credential.clientId, apiKey: credential.apiKey } });
      results.push({ id: imported.id, name: imported.name, credentialRevision: imported.credentialRevision });
    }
    if (selected && !results.length) throw new Error();
    console.log(JSON.stringify({ imported: results.length, stores: results }));
  } catch {
    console.error('店铺导入未完成；请检查源店铺、私有凭据和目标目录。原平台文件未修改。'); process.exitCode = 1;
  }
}
