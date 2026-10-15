import { recordedProduct } from '../adapter/real-scenarios.ts';
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
  const put=(id:string,offerId:string,skus:string[])=>store.put('business_catalog',id,recordedProduct({storeId:'shop',offerId,storeName:'Shop',status:'on_sale',saleState:'on_sale',observedAt:now,sources:skus.map(skuCode=>({productId:'p',sourceSkuMatched:true,skuCode}))}));
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
  store.put('business_catalog','bad',recordedProduct({storeId:'shop',offerId:'bad',sources:'invalid'}));
  assert.throws(()=>collectionListingStates(store,['shop'],['p']),/some is not a function/);assert.equal(reads,1);
  store.put('business_catalog','bad',recordedProduct({storeId:'shop',offerId:'bad',sources:[]}));store.put('business_plans','bad',{storeId:'shop',rows:{invalid:true}});reads=0;
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


// Exact-ID association queries use recorded products with explicit identity/status variations.
import {readCollectionAssociations} from '../../packages/app-hallmark/src/collection-associations.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';

test('association query ignores matching titles, deduplicates offers and retains source composition',()=>{
 const {database,store,now}=fixture();try{
  const product=recordedProduct({storeId:'shop',offerId:'linked',productId:'platform-1',title:'Same model',saleState:'on_sale',statusObservation:'observed',observedAt:now,sources:[{productId:'p',sourceSkuMatched:true,components:[{sourceSkuId:'sku-a',quantity:10}]}]});
  store.put('business_catalog','a',product);store.put('business_catalog','b',product);
  store.put('business_catalog','other-item',{...product,offerId:'same-title',sources:[{productId:'different',sourceSkuMatched:true,skuCode:'sku-a'}]});
  store.put('business_catalog','other-store',{...product,storeId:'other',offerId:'cross-store'});
  const result=readCollectionAssociations(store,{id:'p',storeId:'shop'});
  assert.equal(result.conclusion,'linked_offers');assert.equal(result.currentSale,'on_sale');assert.equal(result.total,1);
  assert.equal(result.offers[0].productId,'platform-1');assert.deepEqual(result.offers[0].sources[0].components,[{sourceSkuId:'sku-a',quantity:10}]);
  assert.equal(result.historyExhaustive,false);
 }finally{database.close();}
});

test('no links, unlinked history, saved drafts and failed status are distinct conclusions',()=>{
 const {database,store,now}=fixture();try{
  assert.equal(readCollectionAssociations(store,{id:'p',storeId:'shop'}).conclusion,'no_linked_record');
  store.put('business_catalog','unlinked',recordedProduct({storeId:'shop',offerId:'unlinked',sources:[],observedAt:now}));
  let result=readCollectionAssociations(store,{id:'p',storeId:'shop'});assert.equal(result.conclusion,'unresolved_history');assert.equal(result.currentSale,'unknown');
  store.put('business_plans','draft',{storeId:'shop',rows:[{action:'listing',procurement:[{itemId:'p',sourceSkuId:'a'}]}]});
  result=readCollectionAssociations(store,{id:'p',storeId:'shop'});assert.equal(result.conclusion,'saved_listing_only');assert.equal(result.total,0);
  store.put('business_catalog_status_sync','shop',{state:'failed',attemptedAt:now});
  assert.equal(readCollectionAssociations(store,{id:'absent',storeId:'shop'}).conclusion,'unavailable');
  store.put('business_catalog','linked',recordedProduct({storeId:'shop',offerId:'linked',saleState:'on_sale',observedAt:'2026-01-01T00:00:00Z',sources:[{productId:'p',sourceSkuMatched:true,skuCode:'a'}]}));
  result=readCollectionAssociations(store,{id:'p',storeId:'shop'});assert.equal(result.conclusion,'linked_offers');assert.equal(result.currentSale,'unknown');assert.equal(result.offers[0].saleState,'unknown');
 }finally{database.close();}
});

test('association pages preserve scope, reject changed evidence and stay below host spill budget',()=>{
 const {database,store,now}=fixture();try{
  for(let i=0;i<65;i++)store.put('business_catalog',String(i),recordedProduct({storeId:'shop',offerId:'offer-'+String(i).padStart(3,'0'),title:'长标题'.repeat(80),saleState:'archived',observedAt:now,statusObservation:'observed',sources:[{productId:'p',sourceSkuMatched:true,skuCode:'sku-'+i}]}));
  const first=readCollectionAssociations(store,{id:'p',storeId:'shop',limit:50});assert.ok(first.nextCursor);assert.equal(first.currentSale,'not_on_sale');
  assert.throws(()=>readCollectionAssociations(store,{id:'other',storeId:'shop',cursor:first.nextCursor!}),/不一致/);
  for(const value of [null,[],true,42,'cursor'])assert.throws(()=>readCollectionAssociations(store,{id:'p',storeId:'shop',cursor:Buffer.from(JSON.stringify(value)).toString('base64url')}),{code:'COLLECTION_CURSOR_INVALID'});
  const seen=new Set<string>();let page=first;
  for(;;){assert.ok(Buffer.byteLength(JSON.stringify(page))<=14*1024);for(const p of page.offers){assert.ok(!seen.has(p.offerId));seen.add(p.offerId);}if(!page.continuation)break;page=readCollectionAssociations(store,page.continuation.input);}
  assert.equal(seen.size,65);
  store.put('business_catalog','new',recordedProduct({storeId:'shop',offerId:'new',sources:[{productId:'p',sourceSkuMatched:true,skuCode:'new'}]}));
  assert.throws(()=>readCollectionAssociations(store,{id:'p',storeId:'shop',cursor:first.nextCursor!}),/已更新/);
 }finally{database.close();}
});

test('provider association route uses stable IDs without collection search and guards connection identity',async()=>{
 const {database,store}=fixture();try{
  const forbidden=async()=>{throw Error('must not search source or titles');};
  const source=new Proxy({},{get:()=>forbidden}) as any;
  const gateway={listStores:()=>[{id:'shop',name:'Shop',sourceConnectionId:'c'}],hasStore:(id:string)=>id==='shop',getStore:(id:string)=>id==='shop'?{id}:undefined,request:forbidden} as any;
  const make=(matches=true)=>new HallmarkProvider({client:source,store,businessStore:store,businessGateway:gateway,collectionSourceMatches:matches,broker:{} as any});
  const call=(provider:HallmarkProvider,storeId='shop')=>provider.execute({request:{appId:'hallmark',connectionId:'c',capabilityId:'hallmark.collection.associations',capabilityVersion:'1.0.0',input:{id:'p',storeId},invocationId:'association',traceId:'association',source:{kind:'agent',sessionId:'s'}},signal:new AbortController().signal,configRevision:1} as any);
  const result:any=await call(make());assert.equal(result.status,'ok');assert.equal(result.data.conclusion,'no_linked_record');
  assert.equal((await call(make(),'other') as any).error.code,'STORE_CONNECTION_MISMATCH');
  assert.equal((await call(make(false)) as any).error.code,'COLLECTION_SOURCE_MISMATCH');
 }finally{database.close();}
});
