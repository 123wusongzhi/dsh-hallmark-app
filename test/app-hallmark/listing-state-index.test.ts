import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {StableHallmarkBusinessStore} from '../../packages/app-hallmark/src/store.ts';
import {collectionListingStates} from '../../packages/app-hallmark/src/listing-prepare.ts';

function fixture(path=':memory:'){
 const database=new RuntimeStore(path),store=new StableHallmarkBusinessStore(database,{connectionId:'c',scopeId:'source'});
 const now=new Date().toISOString();
 store.put('business_catalog_status_sync','shop',{storeId:'shop',state:'fresh',observedAt:now,attemptedAt:now,expiresAt:new Date(Date.now()+300000).toISOString(),total:0,missing:0});
 return {database,store,now};
}

test('listing-state index preserves duplicate offers, first summaries and one count per procurement row',()=>{
 const {database,store,now}=fixture();try{
  const put=(id:string,offerId:string,skus:string[])=>store.put('business_catalog',id,{storeId:'shop',offerId,storeName:'Shop',status:'on_sale',saleState:'on_sale',observedAt:now,sources:skus.map(skuCode=>({productId:'p',sourceSkuMatched:true,skuCode}))});
  put('a-first','duplicate',['obsolete']);put('b-second','other',['b']);put('z-last','duplicate',['a','a']);
  store.put('business_plans','plan',{storeId:'shop',rows:[{action:'listing',procurement:[{itemId:'p',sourceSkuId:'a'},{itemId:'p',sourceSkuId:'b'},{itemId:'q',sourceSkuId:'c'}]},{action:'price',procurement:[{itemId:'p',sourceSkuId:'a'}]}]});
  const result=collectionListingStates(store,['shop','shop'],['p','q','p'],[{id:'p',skuCount:2,skuIds:['a','b']},{id:'p',skuCount:1,skuIds:['b']}]);
  assert.equal(result.p.length,2);assert.equal(result.p[0].status,'listed');assert.equal(result.p[0].offerCount,2);assert.equal(result.p[0].savedListingCount,1);
  assert.deepEqual(result.p[0].listedSkuIds,['a','b']);assert.deepEqual(result.p[0].associatedSkuIds,['a','b']);assert.equal(result.q[0].savedListingCount,1);assert.equal(result.q[0].offerCount,0);
 }finally{database.close();}
});

test('listing-state reads still observe another SQLite commit between item status reads',()=>{
 const directory=mkdtempSync(join(tmpdir(),'listing-index-external-')),path=join(directory,'runtime.db');
 const {database,store,now}=fixture(path),external=new DatabaseSync(path);let reads=0;
 try{
  const get=store.get.bind(store);store.get=<T>(collection:string,id:string):T|undefined=>{const value=get<T>(collection,id);if(collection==='business_catalog_status_sync'&&++reads===1){
   const key=JSON.stringify(['hallmark-business','c','source',collection,id]),row=external.prepare('SELECT value_json FROM provider_records WHERE id=?').get(key)!;
   const record=JSON.parse(String(row.value_json));record.value={...record.value,state:'failed',attemptedAt:now,expiresAt:now};
   external.prepare('UPDATE provider_records SET value_json=? WHERE id=?').run(JSON.stringify(record),key);
  }return value;};
  const result=collectionListingStates(store,['shop'],['before','after']);
  assert.equal(reads,2);assert.equal(result.before[0].listingRecord,'not_found');assert.equal(result.before[0].freshness,'fresh');
  assert.equal(result.after[0].listingRecord,'unavailable');assert.equal(result.after[0].listingRecordReason,'RECORD_SYNC_FAILED');assert.equal(result.after[0].freshness,'stale');
 }finally{external.close();database.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('listing-index-external-'));rmSync(directory,{recursive:true,force:true});}
});

test('malformed catalogue and plan arrays retain lazy errors after the original status read',()=>{
 const {database,store}=fixture();try{
  let reads=0;const get=store.get.bind(store);store.get=<T>(collection:string,id:string):T|undefined=>{if(collection==='business_catalog_status_sync')reads++;return get<T>(collection,id);};
  store.put('business_catalog','bad',{storeId:'shop',offerId:'bad',sources:'invalid'});
  assert.throws(()=>collectionListingStates(store,['shop'],['p']),/some is not a function/);assert.equal(reads,1);
  store.put('business_catalog','bad',{storeId:'shop',offerId:'bad',sources:[]});store.put('business_plans','bad',{storeId:'shop',rows:{invalid:true}});reads=0;
  assert.throws(()=>collectionListingStates(store,['shop'],['p']),/filter is not a function/);assert.equal(reads,1);
  store.put('business_plans','bad',{storeId:'shop',rows:[{action:'listing',procurement:'invalid'}]});reads=0;
  assert.throws(()=>collectionListingStates(store,['shop'],['p']),/some is not a function/);assert.equal(reads,1);
 }finally{database.close();}
});

test('empty scopes do not inspect malformed plan rows or summaries',()=>{
 const {database,store}=fixture();try{
  store.put('business_plans','bad',{storeId:'shop',rows:{invalid:true}});
  assert.deepEqual(collectionListingStates(store,['shop'],[],[null as any]),{});
  assert.deepEqual(collectionListingStates(store,[],['p'],[null as any]),{p:[]});
 }finally{database.close();}
});

test('listing-state indexes are rebuilt after saved records change',()=>{
 const {database,store}=fixture();try{
  const first=collectionListingStates(store,['shop'],['p']).p[0];assert.equal(first.listingRecord,'not_found');
  store.put('business_plans','new',{storeId:'shop',rows:[{action:'listing',procurement:[{itemId:'p',sourceSkuId:'a'},{itemId:'p',sourceSkuId:'b'}]}]});
  const second=collectionListingStates(store,['shop'],['p']).p[0];assert.equal(second.listingRecord,'found');assert.equal(second.savedListingCount,1);
  store.put('business_plans','new',{storeId:'shop',rows:[]});assert.equal(collectionListingStates(store,['shop'],['p']).p[0].listingRecord,'not_found');
 }finally{database.close();}
});
