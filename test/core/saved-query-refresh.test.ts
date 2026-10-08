import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager,bindingDatasetKey} from '../../packages/presentation/src/index.ts';
import {DatasetRefresher} from '../../packages/core/src/refresh.ts';
import type {AdapterResponse,CoreClient} from '../../packages/core/src/types.ts';

const ok=(raw:any):AdapterResponse=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',fetchedAt:'2026-10-05T12:00:00Z'}});
function setup(){
 const store=new AppStore(':memory:'),presentation=new PresentationManager(store);
 const shops=[{id:'A',shopName:'Alpha shop',aliases:['A-shop']},{id:'B',shopName:'Alpine shop'},{id:'C',shopName:'Beta shop'}];
 const source={stores:shops.map(shop=>({id:shop.id,lastSuccessAt:'2026-10-05T00:00:00Z'})),products:[{storeId:'A',offerId:'A1',productId:1,price:100,stock:1,profit:{costMinor:30,actualMargin:0.1},unknownSourceField:'retained'},{storeId:'A',offerId:'A2',productId:2,price:50,stock:0,profit:{costMinor:null,actualMargin:null}},{storeId:'B',offerId:'B1',productId:3,profit:{costMinor:20,actualMargin:0.4}},{storeId:'C',offerId:'C1',productId:4,profit:{costMinor:20,actualMargin:0.2}}]};
 const counts={stores:0,sync:0,products:0,business:0},syncArguments:any[][]=[],readArguments:any[][]=[];
 const forbidden=async()=>{counts.business++;return {status:'failed' as const,error:{code:'TEST_BUSINESS_FORBIDDEN',message:'No other business API expected',retryable:false}};};
 const client:CoreClient={getStores:async()=>{counts.stores++;return ok(shops);},syncStoreProducts:async(...args)=>{counts.sync++;syncArguments.push(args);return ok({});},getStoreProducts:async(...args)=>{counts.products++;readArguments.push(args);return ok(source);},getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,platformCall:forbidden,platformRead:forbidden};
 const refresher=new DatasetRefresher(store,client);
 function saveQuery(tool:string,params:any,title='Explicit saved query'){
  const binding={id:'data',query:{tool,params},fieldMap:{}};presentation.saveEntry(binding,title,'明确保存此只读查询');return bindingDatasetKey(binding);
 }
 return {store,presentation,shops,source,counts,syncArguments,readArguments,client,refresher,saveQuery};
}
function deferred(){let release!:()=>void;const promise=new Promise<void>(resolve=>release=resolve);return {promise,release};}
const context={sessionId:'background'};

test('saved exact-status queries retain their filtered page on refresh without replacing the store snapshot',async()=>{
 const f=setup(),source={...f.source,products:[
  {storeId:'A',offerId:'A1',status:'on_sale',title:'needle first'},
  {storeId:'A',offerId:'false-title',status:'archived',title:'on_sale needle'},
  {storeId:'A',offerId:'A2',status:'on_sale',title:'needle second'},
  {storeId:'A',offerId:'false-history',status:'archived',title:'needle',history:{status:'on_sale'}},
  {storeId:'A',offerId:'missing',title:'needle',platformStatus:'Продается'},
  {storeId:'A',offerId:'A3',status:'on_sale',title:'needle third'},
  {storeId:'A',offerId:'A4',status:'on_sale',title:'other'},
  {storeId:'B',offerId:'B1',status:'on_sale',title:'needle foreign'},
 ]},spill={path:'synthetic-products.json',bytes:2000000,summary:{count:8},cursor:'spill:fixture:0'},original=structuredClone(source);
 f.client.getStoreProducts=async()=>({...ok(source),spill});
 try{
  await f.refresher.refresh('store_products:A',context);const base=f.store.get('snapshots','store_products:A');
  for(const cursor of [undefined,'2']){
   const params={storeId:'A',status:'on_sale',query:'NEEDLE',limit:2,...(cursor?{cursor}:{})},key=f.saveQuery('hallmark_list_store_products',params),query=f.store.get('queries',key.slice(6));
   const result=await f.refresher.refresh(key,context);assert.equal(result.status,'ok',JSON.stringify(result));
   const snapshot=f.store.get('snapshots',key)!;assert.deepEqual(snapshot.payload.products.map((row:any)=>row.offerId),cursor?['A3']:['A1','A2']);assert.equal(snapshot.payload.total,3);assert.equal(snapshot.payload.cursor,cursor?undefined:'2');assert.deepEqual(snapshot.sourceSpill,spill);assert.equal(snapshot.payload.spill,undefined);assert.equal((result.data as any).spill,undefined);
   const view=f.presentation.renderView({id:`status-page-${cursor??'first'}`,title:'Status page',layout:{type:'column',children:['note']},widgets:[{id:'note',type:'text',text:'Products'}],bindings:[{id:'products',datasetKey:key,fieldMap:{}}]});
   assert.deepEqual(f.presentation.getViewData(view.id).data!.bindings[0].payload,snapshot.payload);
   assert.deepEqual(f.store.get('queries',key.slice(6)),query);assert.deepEqual(f.store.get('snapshots','store_products:A'),base);
  }
  const legacyKey=f.saveQuery('hallmark_list_store_products',{storeId:'A',query:'needle',limit:1,cursor:'1'});assert.equal((await f.refresher.refresh(legacyKey,context)).status,'ok');assert.equal(f.store.get('snapshots',legacyKey)!.payload.products.length,6);
  assert.deepEqual(source,original);assert.equal(f.counts.business,0);
 }finally{f.store.close();}
});

for(const tool of ['hallmark_list_store_products','hallmark_compute_profit','hallmark_filter_products'])test(`saved ${tool} resolves a unique store name without modifying its query definition`,async()=>{
 const f=setup(),params={store:'Alpha shop',...(tool==='hallmark_filter_products'?{maxMargin:0.15}:{})};const key=f.saveQuery(tool,params);const before=f.store.get('queries',key.slice(6));
 const result=await f.refresher.refresh(key,context);assert.equal(result.status,'ok');const snapshot=f.store.get('snapshots',key)!;assert.equal(snapshot.provenance.storeId,'A');assert.equal(snapshot.dataTime,'2026-10-05T00:00:00Z');assert.ok(snapshot.payload.products.every((row:any)=>row.storeId==='A'));assert.equal(snapshot.payload.products[0].unknownSourceField,'retained');
 if(tool==='hallmark_filter_products'){assert.equal(snapshot.payload.products.length,1);assert.equal(snapshot.payload.unable.length,1);}else assert.equal(snapshot.payload.products.length,2);
 if(tool!=='hallmark_list_store_products')assert.ok(snapshot.metricBasis);
 assert.deepEqual(f.store.get('queries',key.slice(6)),before);assert.equal(Object.hasOwn(f.store.get('queries',key.slice(6))!.params,'storeId'),false);assert.equal(f.counts.stores,1);assert.equal(f.counts.sync,1);assert.equal(f.counts.products,1);assert.equal(f.counts.business,0);assert.deepEqual(f.syncArguments,[[]]);assert.deepEqual(f.readArguments,[[]]);f.store.close();
});

test('known aliases and unique fuzzy names resolve, while exact names take precedence over fuzzy matches',async()=>{
 const f=setup();for(const name of ['a-SHOP','Alpha s','Beta shop']){const key=f.saveQuery('hallmark_list_store_products',{store:name},name);const result=await f.refresher.refresh(key,context);assert.equal(result.status,'ok');assert.equal(f.store.get('snapshots',key)!.provenance.storeId,name==='Beta shop'?'C':'A');}
 f.client.getStores=async()=>ok([{id:'A',shopName:'Alpha'},{id:'B',shopName:'Alpha extra'}]);const key=f.saveQuery('hallmark_list_store_products',{store:'Alpha'},'Exact match');assert.equal((await f.refresher.refresh(key,context)).status,'ok');assert.equal(f.store.get('snapshots',key)!.provenance.storeId,'A');assert.equal(f.counts.business,0);f.store.close();
});

for(const [name,errorCode] of [['Al','STORE_AMBIGUOUS'],['Missing shop','STORE_NOT_FOUND']] as const)test(`saved name ${name} fails safely and preserves all prior successful snapshot fields`,async()=>{
 const f=setup(),key=f.saveQuery('hallmark_filter_products',{store:name,maxMargin:0.15});const query=f.store.get('queries',key.slice(6));const previous=f.store.updateSnapshotSuccess(key,{products:[{offerId:'old-success'}],unable:[]},'2026-10-04T00:00:00Z');
 const result=await f.refresher.refresh(key,context);assert.equal(result.status,'needs_clarification');assert.equal(result.error?.code,errorCode);assert.deepEqual(result.clarification?.missing,['storeId']);if(name==='Al')assert.equal(result.clarification?.candidates?.length,2);
 const snapshot=f.store.get('snapshots',key)!;assert.equal(snapshot.state,'failed');assert.equal(snapshot.lastError.code,errorCode);for(const field of ['payload','dataTime','lastSuccessAt','version'])assert.deepEqual(snapshot[field],previous[field]);assert.deepEqual(f.store.get('queries',key.slice(6)),query);assert.equal(f.counts.sync,0);assert.equal(f.counts.products,0);assert.equal(f.counts.business,0);assert.equal(f.store.get('operations',result.operation!.operationId)!.state,'failed');f.store.close();
});

test('missing store and conflicting store ID/name never guess or synchronize',async()=>{
 const f=setup();for(const [params,errorCode] of [[{},'STORE_REQUIRED'],[{storeId:'A',store:'Beta shop'},'STORE_SELECTION_MISMATCH']] as const){const key=f.saveQuery('hallmark_list_store_products',params);const result=await f.refresher.refresh(key,context);assert.equal(result.status,'needs_clarification');assert.equal(result.error?.code,errorCode);assert.equal(f.store.get('snapshots',key)?.state,'failed');}
 assert.equal(f.counts.sync,0);assert.equal(f.counts.products,0);assert.equal(f.counts.business,0);f.store.close();
});

test('getStores unavailable or malformed response preserves prior data and never starts synchronization',async()=>{
 const f=setup(),key=f.saveQuery('hallmark_list_store_products',{store:'Alpha shop'});const before=f.store.updateSnapshotSuccess(key,{products:[{offerId:'old'}]},null);
 f.client.getStores=async()=>({status:'unavailable',error:{code:'STORES_OFFLINE',message:'Store source unavailable',retryable:true,retryAfterMs:3000}});const unavailable=await f.refresher.refresh(key,context);assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.error?.retryAfterMs,3000);assert.deepEqual(f.store.get('snapshots',key)!.payload,before.payload);assert.equal(f.store.get('snapshots',key)!.dataTime,null);
 f.client.getStores=async()=>ok({stores:f.shops});const malformed=await f.refresher.refresh(key,context);assert.equal(malformed.error?.code,'INVALID_SOURCE_RESPONSE');assert.deepEqual(f.store.get('snapshots',key)!.payload,before.payload);assert.equal(f.counts.sync,0);assert.equal(f.counts.business,0);f.store.close();
});

test('unique name followed by failed source sync keeps the last successful snapshot and saved parameters',async()=>{
 const f=setup(),key=f.saveQuery('hallmark_compute_profit',{store:'Alpha shop'}),query=f.store.get('queries',key.slice(6));const before=f.store.updateSnapshotSuccess(key,{products:[{offerId:'old-profit'}]},'2026-10-04T00:00:00Z');f.client.syncStoreProducts=async()=>{f.counts.sync++;return {status:'unavailable',error:{code:'SYNC_RATE_LIMIT',message:'Source cooldown',retryable:true,retryAfterMs:60000}};};const result=await f.refresher.refresh(key,context);assert.equal(result.status,'unavailable');assert.equal(result.error?.retryAfterMs,60000);const after=f.store.get('snapshots',key)!;for(const field of ['payload','dataTime','lastSuccessAt','version'])assert.deepEqual(after[field],before[field]);assert.deepEqual(f.store.get('queries',key.slice(6)),query);assert.equal(f.counts.sync,1);assert.equal(f.counts.products,0);assert.equal(f.counts.business,0);f.store.close();
});

test('overlapping datasets share exactly one full-store source synchronization/read while preserving per-dataset results',async()=>{
 const f=setup(),gate=deferred(),started=deferred();f.client.syncStoreProducts=async(...args)=>{f.counts.sync++;f.syncArguments.push(args);started.release();await gate.promise;return ok({});};const queryKey=f.saveQuery('hallmark_list_store_products',{store:'Beta shop'});
 const promises=[f.refresher.refresh('store_products:A',context),f.refresher.refresh('profit:B',context),f.refresher.refresh(queryKey,context)];const duplicate=f.refresher.refresh('store_products:A',context);assert.equal(duplicate,promises[0]);await started.promise;gate.release();const results=await Promise.all(promises);assert.ok(results.every(result=>result.status==='ok'));assert.equal(new Set(results.map(result=>result.operation?.operationId)).size,3);assert.equal(f.counts.sync,1);assert.equal(f.counts.products,1);assert.deepEqual(f.syncArguments,[[]]);assert.deepEqual(f.readArguments,[[]]);assert.deepEqual(f.store.get('snapshots','store_products:A')!.payload.products.map((row:any)=>row.offerId),['A1','A2']);assert.deepEqual(f.store.get('snapshots','profit:B')!.payload.products.map((row:any)=>row.offerId),['B1']);assert.deepEqual(f.store.get('snapshots',queryKey)!.payload.products.map((row:any)=>row.offerId),['C1']);assert.equal(Object.hasOwn(f.source.products[0],'referenceProfit'),false);assert.equal(f.counts.business,0);f.store.close();
});

test('sequential datasets are deliberately not batch-memoized and retain the true full-store source contract',async()=>{
 const f=setup();assert.equal((await f.refresher.refresh('store_products:A',context)).status,'ok');assert.equal((await f.refresher.refresh('profit:B',context)).status,'ok');assert.equal(f.counts.sync,2);assert.equal(f.counts.products,2);assert.deepEqual(f.syncArguments,[[],[]]);assert.equal(f.counts.business,0);f.store.close();
});

test('shared source failure propagates independently and releases the source flight for later safe reads',async()=>{
 const f=setup(),gate=deferred(),started=deferred();f.client.syncStoreProducts=async()=>{f.counts.sync++;started.release();await gate.promise;return {status:'unavailable',error:{code:'SOURCE_DOWN',message:'Unavailable',retryable:true}};};const first=f.refresher.refresh('store_products:A',context),second=f.refresher.refresh('profit:B',context);await started.promise;gate.release();const failures=await Promise.all([first,second]);assert.ok(failures.every(result=>result.status==='unavailable'));assert.equal(f.counts.sync,1);assert.equal(f.counts.products,0);f.client.syncStoreProducts=async()=>{f.counts.sync++;return ok({});};assert.equal((await f.refresher.refresh('store_products:A',context)).status,'ok');assert.equal(f.counts.sync,2);assert.equal(f.counts.products,1);assert.equal(f.counts.business,0);f.store.close();
});

for(const tool of ['hallmark_get_operation','hallmark_list_stores','hallmark_get_collected_item','hallmark_get_platform_data'])test(`unsupported saved ${tool} query is explicit and never dynamically invokes a tool`,async()=>{
 const f=setup();let key:string;
 if(tool==='hallmark_get_operation'){assert.throws(()=>f.saveQuery(tool,{operationId:'operation'}),/Saved queries cannot/);f.store.put('queries','legacy-operation-query',{tool,params:{operationId:'operation'}});key='query:legacy-operation-query';}else key=f.saveQuery(tool,{store:'Alpha shop'});
 const result=await f.refresher.refresh(key,context);assert.equal(result.status,'unavailable');assert.equal(result.error?.code,'DATASET_NOT_SUPPORTED');assert.match(result.error!.message,/操作回执、平台与采集详情查询刷新未开放/);assert.deepEqual(f.counts,{stores:0,sync:0,products:0,business:0});f.store.close();
});
