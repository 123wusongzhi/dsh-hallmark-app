import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionStatusLines,filterCollectionRecords} from '../../packages/dsh-plugin/client/widgets/collection-status.ts';

test('collection cards distinguish archived and empty stock while preserving store scope',()=>{
 const rows=collectionStatusLines([{storeId:'bill',storeName:'bill',association:'linked',freshness:'fresh',saleStates:{on_sale:3,out_of_stock:1,archived:2,failed:1},observedAt:'2026-10-10T00:00:00Z'},{storeId:'helen',association:'none',saleStates:{},freshness:'fresh'}]);
 assert.equal(rows[0].text,'bill：在售 3 · 无库存 1 · 已归档 2 · 发布失败 1');
 assert.match(rows[0].detail,/按销售商品计数/);assert.equal(rows[1].text,'helen：尚无商品关联');
});

test('record filters use target-store facts and archived, failed and saved drafts stay found',()=>{
 const rows=[{id:'candidate',listedIn:[{storeId:'bill',listingRecord:'not_found',association:'unknown'},{storeId:'helen',listingRecord:'found'}]},{id:'archived',listedIn:[{storeId:'bill',listingRecord:'found',saleStates:{archived:2}}]},{id:'draft',listedIn:[{storeId:'bill',listingRecord:'found',savedListingCount:1}]},{id:'failed',listedIn:[{storeId:'bill',listingRecord:'found',saleStates:{failed:1}}]},{id:'unavailable',listedIn:[{storeId:'bill',listingRecord:'unavailable',listingRecordReason:'RECORD_SYNC_FAILED'}]}];
 assert.deepEqual(filterCollectionRecords(rows,'bill','not_found').map(r=>r.id),['candidate']);assert.equal(filterCollectionRecords(rows,'bill','found').length,3);assert.equal(filterCollectionRecords(rows,'bill','unavailable').length,1);
 assert.match(collectionStatusLines(rows[0].listedIn)[0].text,/本店无上品记录/);assert.match(collectionStatusLines(rows[1].listedIn)[0].text,/本店有上品记录 · 已归档 2/);assert.match(collectionStatusLines(rows[2].listedIn)[0].text,/已保存上品行 1/);assert.match(collectionStatusLines(rows[4].listedIn)[0].text,/记录暂不可查/);
});
test('stale and unknown links cannot display an invented on-sale label',()=>{
 assert.equal(collectionStatusLines([{storeId:'bill',freshness:'stale',saleStates:{unknown:2},association:'linked'}])[0].text,'bill：待刷新 · 状态待确认 2');
 assert.equal(collectionStatusLines([{storeId:'bill',freshness:'unknown',saleStates:{},association:'unknown'}])[0].text,'bill：关联待确认');
 assert.deepEqual(collectionStatusLines(undefined),[]);
});
