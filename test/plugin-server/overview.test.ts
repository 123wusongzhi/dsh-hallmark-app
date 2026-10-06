import test from 'node:test';
import assert from 'node:assert/strict';
import { HallmarkPlugin } from '../../packages/dsh-plugin/server/index.ts';
import { readOverview } from '../../packages/service/src/overview.ts';

test('overview browser resource forwards only a parameter-free GET without activating a conversation', async () => {
  const plugin = new HallmarkPlugin({} as any, { dataDirectory: process.cwd() }); let reads = 0;
  const dto = await readOverview({ health: async () => ({ status: 'unavailable' }),
    getStores: async () => assert.fail(), getStoreProducts: async () => assert.fail(), searchCollectedItems: async () => assert.fail() });
  plugin.client.request = async (path, body) => { reads++; assert.equal(path, '/ui/overview'); assert.equal(body, undefined); return dto; };
  try {
    for (const query of ['&sessionId=guessed', '&viewId=private', '&sync=true', '&path=/api/store-products/sync']) {
      assert.equal((await plugin.ui(new Request(`http://fixture.test/api/hallmark-app?resource=overview${query}`))).status, 400);
    }
    assert.equal(reads, 0);
    const response = await plugin.ui(new Request('http://fixture.test/api/hallmark-app?resource=overview'));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), dto); assert.equal(reads, 1); assert.equal(plugin.cache.size, 0);
  } finally { await plugin.dispose(); }
});
