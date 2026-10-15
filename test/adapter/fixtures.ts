import { recordedProduct } from './real-scenarios.ts';
import { realSourceSummaries, realRaw, realScenarioDetail, realScenarioSku, realStores, realTasks } from '../real-data/corpus.ts';
/** Recorded source goods and store data; aliases and transport outcomes are local scenario patches. */
export const stores: any[] = [{ ...realStores()[0], id: 'store-A', additive: { preserved: true } }];
export const task = { ...realTasks()[0], id: 'task-A', kind: 'listing', status: 'working', storeId: 'store-A', productId: 'item-A', assignmentSnapshot: { item: { skuCodes: ['sku-A', 'sku-B'] } } };
export const products = { stores: [{ id: 'store-A', name: stores[0].shopName, lastSuccessAt: '2026-10-05T00:00:00Z', error: undefined }], products: [recordedProduct({ storeId: 'store-A', offerId: 'offer-A', profit: { actualMinor: 10000, actualMargin: 0.1, profitMinor: 1000, costMinor: 9000, purchaseMinor: 4000, packageGrams: 20, reason: null }, sources: [], unknownFutureField: { retained: true } })] };
export const summary = [{ ...realSourceSummaries()[1], id: 'item-A', skuCount: 2, custom: true }];
export const detail = realScenarioDetail({ id: 'item-A', skus: [realScenarioSku({ code: 'sku-A', sourceSkuId: 'sku-A' }, 1, 0), realScenarioSku({ code: 'sku-B', sourceSkuId: 'sku-B' }, 1, 1)] },1);
export const rawItem = { ...realRaw(1), id: 'item-A' };
export const platformInput = { requestId: 'read-operation-0', agentId: 'dsh-hallmark-app', path: '/v3/product/info/list', body: { offer_id: ['offer-A'] } };
export const platformRecord = { ...platformInput, taskId: 'task-A', storeId: 'store-A', requestHash: 'hash', startedAt: '2026-10-05T00:00:00Z', outcome: 'response_received', httpStatus: 200, response: { items: [{ offer_id: 'offer-A', sourceField: true }] } };
