import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../../packages/store/index.ts';
import { AppCore } from '../../packages/core/src/index.ts';
import { PresentationManager, bindingDatasetKey } from '../../packages/presentation/src/index.ts';
import type { AdapterResponse, CoreClient } from '../../packages/core/src/types.ts';

const context={sessionId:'session'};
function setup(){
 const store=new AppStore(':memory:'),presentation=new PresentationManager(store);store.put('session_apps',context.sessionId,{appId:'hallmark',active:true});
 const calls:string[]=[],items=[{id:'newer-by-source',future:{raw:true}},{id:'older-by-source'},{id:'tail'}];
 let response:AdapterResponse={status:'ok',raw:items,provenance:{source:'collected_item',endpoint:'/api/items',fetchedAt:'2026-10-06T00:00:00Z'}};
 const forbidden=async()=>{throw Error('No store, task or business calls are allowed');};
 const client:CoreClient={searchCollectedItems:async(query='')=>{calls.push(query);return response;},getStores:forbidden,getStoreProducts:forbidden,syncStoreProducts:forbidden,getTargetMargin:forbidden,getCollectedItem:forbidden,platformCall:forbidden,platformRead:forbidden};
 const options={store,presentation,client,broker:{getStoreTask:forbidden,getListingTask:forbidden,requestId:()=>{throw Error('No task');}}};
 return {store,presentation,core:new AppCore(options),options,calls,items,setResponse:(value:AdapterResponse)=>response=value};
}

test('collected search returns a bindable bounded source-order snapshot without implicit saved entries or invented time',async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_search_collected_items',{limit:2},context),data=result.data as any;
  assert.equal(result.status,'ok');assert.match(data.datasetKey,/^collected:[a-f0-9]{64}$/);assert.deepEqual(data.items,f.items.slice(0,2));assert.equal(data.cursor,'2');assert.equal(data.total,3);
  const snapshot=f.store.get('snapshots',data.datasetKey)!;assert.deepEqual(snapshot.payload.items,data.items);assert.equal(snapshot.dataTime,null);assert.equal(result.provenance?.dataTime,undefined);
  const view=f.presentation.renderView({id:'collected-view',title:'Source summaries',layout:{type:'column',children:['table']},widgets:[{id:'table',type:'table',bindingId:'data',columns:[{field:'id',label:'ID'}]}],bindings:[{id:'data',datasetKey:data.datasetKey,fieldMap:{}}]});
  const bound=f.presentation.getViewData(view.id);assert.equal(bound.status,'ok');assert.deepEqual((bound.data as any).bindings[0].payload.items,data.items);assert.equal((bound.data as any).bindings[0].provenance.endpoint,'/api/items');
  for(const collection of ['entries','components','queries'])assert.equal(f.store.list(collection).length,0);assert.deepEqual(f.calls,['']);
 }finally{f.store.close();}
});

test('collected key separates query/page/page-size; equivalent default paging shares one snapshot',async()=>{
 const f=setup();try{
  const read=async(args:any)=>(await f.core.invoke('hallmark_search_collected_items',args,context)).data as any;
  const defaults=await read({});assert.equal(defaults.datasetKey,(await read({cursor:'0',limit:100})).datasetKey);
  const pages=await Promise.all([{}, {query:'source'}, {cursor:'1'}, {limit:1}].map(read));assert.equal(new Set(pages.map(page=>page.datasetKey)).size,4);
  assert.deepEqual(pages[2].items,f.items.slice(1));assert.deepEqual(pages[3].items,f.items.slice(0,1));
 }finally{f.store.close();}
});

test('collected invalid cursor/extra fields fail before source calls',async()=>{
 const f=setup();try{
  for(const args of [{cursor:'1e2'},{cursor:'01'},{cursor:'-1'},{cursor:'9007199254740992'},{limit:201},{storeId:'A'},{path:'/write'}])assert.equal((await f.core.invoke('hallmark_search_collected_items',args,context)).status,'failed');
  assert.deepEqual(f.calls,[]);assert.equal(f.store.list('snapshots').length,0);
 }finally{f.store.close();}
});

test('collected recipe refresh survives a Core restart and retains exact search/page scope',async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_search_collected_items',{query:'source',cursor:'1',limit:1},context),key=(result.data as any).datasetKey;
  const restarted=new AppCore(f.options);assert.equal((await restarted.refreshDatasetBackground(key)).status,'ok');assert.deepEqual(f.calls,['source','source']);assert.deepEqual(f.store.get('snapshots',key)!.payload.items,[f.items[1]]);
  f.presentation.saveEntry({id:'data',datasetKey:key,fieldMap:{}},'采集摘要','保存这个组件');assert.ok(restarted.getRefreshCandidates().includes(key));
 }finally{f.store.close();}
});

test('saved collected query is refreshed through only the fixed search capability',async()=>{
 const f=setup();try{
  const binding={id:'data',query:{tool:'hallmark_search_collected_items',params:{query:'source',limit:2}},fieldMap:{}};
  f.presentation.saveEntry(binding,'采集搜索','保存搜索');const key=bindingDatasetKey(binding),before=f.store.get('queries',key.slice(6));
  assert.equal((await f.core.refreshDatasetBackground(key)).status,'ok');assert.deepEqual(f.calls,['source']);assert.deepEqual(f.store.get('queries',key.slice(6)),before);assert.deepEqual(f.store.get('snapshots',key)!.payload.items,f.items.slice(0,2));
 }finally{f.store.close();}
});

test('failed collected refresh preserves source rows, source time and version, including cooldown',async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_search_collected_items',{},context),key=(result.data as any).datasetKey,before=f.store.get('snapshots',key)!;
  f.setResponse({status:'unavailable',error:{code:'COOLDOWN',message:'Read cooldown',retryable:true,retryAfterMs:3000}});
  const refreshed=await f.core.refreshDatasetBackground(key);assert.equal(refreshed.error?.retryAfterMs,3000);const after=f.store.get('snapshots',key)!;
  for(const field of ['payload','dataTime','version','lastSuccessAt','sourceQuery'])assert.deepEqual(after[field],before[field]);assert.equal(after.state,'failed');
 }finally{f.store.close();}
});

test('collected query scope tampering cannot overwrite an existing dataset',async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_search_collected_items',{},context),key=(result.data as any).datasetKey,snapshot=f.store.get('snapshots',key)!;
  snapshot.sourceQuery.params.limit=1;f.store.put('snapshots',key,snapshot);
  assert.equal((await f.core.refreshDatasetBackground(key)).error?.code,'DATASET_QUERY_MISMATCH');assert.deepEqual(f.calls,['']);
 }finally{f.store.close();}
});

test('collected spill keeps full selected rows locally and source response remains unchanged',async()=>{
 const f=setup();try{
  const response:AdapterResponse={status:'ok',raw:f.items,matches:[f.items[1]],spill:{path:'synthetic-summary.json'}};f.setResponse(response);
  const result=await f.core.invoke('hallmark_search_collected_items',{},context),data=result.data as any;
  assert.deepEqual(data.spill,response.spill);assert.deepEqual(f.store.get('snapshots',data.datasetKey)!.payload.items,[f.items[1]]);assert.equal(data.total,1);assert.deepEqual(response.raw,f.items);
 }finally{f.store.close();}
});
