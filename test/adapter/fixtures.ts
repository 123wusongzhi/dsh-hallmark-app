/** Synthetic fixtures derived from source contracts, NOT recordings of a live shop. */
export const stores = [{ id: 'store-A', shopName: '合成店铺', platform: 'ozon', authStatus: 'authorized', hasCredential: true, additive: { preserved: true } }];
export const task = { id: 'task-A', kind: 'listing', status: 'working', storeId: 'store-A', productId: 'item-A', assignmentSnapshot: { item: { skuCodes: ['sku-A', 'sku-B'] } } };
export const products = { stores: [{ id: 'store-A', name: '合成店铺', lastSuccessAt: '2026-10-05T00:00:00Z', error: undefined }], products: [{ storeId: 'store-A', offerId: 'offer-A', title: '产品', profit: { actualMinor: 10000, actualMargin: 0.1, profitMinor: 1000, costMinor: 9000, purchaseMinor: 4000, packageGrams: 20, reason: null }, sources: [], unknownFutureField: { retained: true } }] };
export const summary = [{ id: 'item-A', title: '采集产品', skuCount: 2, source: 'taobao_tmall', custom: true }];
export const detail = { id: 'item-A', title: '采集产品', skus: [{ code: 'sku-A', sourceSkuId: 'sku-A' }, { code: 'sku-B', sourceSkuId: 'sku-B' }] };
export const rawItem = { id: 'item-A', content: JSON.stringify({ captured: true, nested: { all: 'source-fields' } }), truncated: false };
export const platformInput = { requestId: 'read-operation-0', agentId: 'dsh-hallmark-app', path: '/v3/product/info/list', body: { offer_id: ['offer-A'] } };
export const platformRecord = { ...platformInput, taskId: 'task-A', storeId: 'store-A', requestHash: 'hash', startedAt: '2026-10-05T00:00:00Z', outcome: 'response_received', httpStatus: 200, response: { items: [{ offer_id: 'offer-A', sourceField: true }] } };
