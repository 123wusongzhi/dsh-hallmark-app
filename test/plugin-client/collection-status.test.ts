import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionStatusLines} from '../../packages/dsh-plugin/client/widgets/collection-status.ts';

test('collection cards distinguish archived and empty stock while preserving store scope',()=>{
 const rows=collectionStatusLines([{storeId:'bill',storeName:'bill',association:'linked',freshness:'fresh',saleStates:{on_sale:3,out_of_stock:1,archived:2,failed:1},observedAt:'2026-10-10T00:00:00Z'},{storeId:'helen',association:'none',saleStates:{},freshness:'fresh'}]);
 assert.equal(rows[0].text,'bill：在售 3 · 无库存 1 · 已归档 2 · 发布失败 1');
 assert.match(rows[0].detail,/按销售商品计数/);assert.equal(rows[1].text,'helen：尚无商品关联');
});
test('stale and unknown links cannot display an invented on-sale label',()=>{
 assert.equal(collectionStatusLines([{storeId:'bill',freshness:'stale',saleStates:{unknown:2},association:'linked'}])[0].text,'bill：待刷新 · 状态待确认 2');
 assert.equal(collectionStatusLines([{storeId:'bill',freshness:'unknown',saleStates:{},association:'unknown'}])[0].text,'bill：关联待确认');
 assert.deepEqual(collectionStatusLines(undefined),[]);
});
