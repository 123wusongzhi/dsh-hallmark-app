/** Synthetic Core/SQLite tests; no Hallmark or platform server is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppStore } from '../../packages/store/index.ts';
import { AppCore } from '../../packages/core/src/index.ts';
import type { CoreClient, AdapterResponse } from '../../packages/core/src/types.ts';
import { PresentationManager, bindingDatasetKey } from '../../packages/presentation/src/index.ts';
import { prepareCategory } from '../../packages/core/src/category.ts';

const context={sessionId:'session'},pair={descriptionCategoryId:'123',typeId:'456'};
const inputs=[{mode:'search',q:'鞋子'}, {mode:'show',...pair}, {mode:'template',...pair},
 {mode:'values',...pair,attributeId:'789',q:'蓝色'},
 {mode:'validate_value',...pair,attributeId:'789',valueId:'11',dictionaryId:'22'}, {mode:'sync'}];
function setup(path=':memory:'){
 const store=new AppStore(path),presentation=new PresentationManager(store);
 store.put('session_apps',context.sessionId,{appId:'hallmark',active:true});
 const calls={stores:0,categories:[] as any[],other:0};
 const raw={storeId:'A',results:[{id:'candidate',verified:false}],capabilityStatus:'partial',stale:true,complete:false,treeFetchedAt:'2026-10-01T01:00:00Z',future:{keep:'raw'}};
 let response:AdapterResponse={status:'ok',raw,provenance:{source:'hallmark_snapshot',fetchedAt:'2026-10-06T00:00:00Z'}};
 const forbidden=async()=>{calls.other++;throw Error('Only category read expected');};
 const client:CoreClient={getStores:async()=>{calls.stores++;return {status:'ok',raw:[{id:'A',shopName:'Alpha'},{id:'B',shopName:'Alpine'}]};},
  getCategoryData:async input=>{calls.categories.push(structuredClone(input));return response;},
  getStoreProducts:forbidden,syncStoreProducts:forbidden,getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,platformRead:forbidden,platformCall:forbidden};
 const options={store,presentation,client,broker:{getStoreTask:forbidden,getListingTask:forbidden,requestId:()=>{calls.other++;throw Error('No task');}}};
 return {store,presentation,client,options,core:new AppCore(options),calls,raw,setResponse:(next:AdapterResponse)=>response=next};
}

for(const input of inputs)test(`Core category ${input.mode} resolves explicit store, preserves source quality, and creates only a scoped snapshot`,async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_get_category_data',{store:'Alpha',...input},context);
  assert.equal(result.status,'ok');const data=result.data as any;assert.match(data.datasetKey,/^category:[a-f0-9]{64}$/);
  assert.deepEqual(data.raw,f.raw);assert.equal(result.provenance?.dataTime,f.raw.treeFetchedAt);
  const snapshot=f.store.get('snapshots',data.datasetKey)!;assert.deepEqual(snapshot.payload,f.raw);assert.equal(snapshot.dataTime,f.raw.treeFetchedAt);assert.equal(snapshot.sourceQuery.params.storeId,'A');assert.equal(snapshot.sourceQuery.params.store,undefined);
  assert.equal(f.calls.categories.length,1);assert.equal(f.calls.categories[0].mode,input.mode);assert.equal(f.calls.other,0);
  for(const table of ['components','entries','queries','operations','settings'])assert.equal(f.store.list(table).length,0);
  assert.deepEqual(f.core.getRefreshCandidates(),[]);
 }finally{f.store.close();}
});

test('category missing scope/mode-specific IDs clarify, incompatible and unsafe fields fail before remote resolution',async()=>{
 const f=setup();try{
  for(const args of [{mode:'search'}, {mode:'show',storeId:'A'}, {mode:'validate_value',storeId:'A',...pair,attributeId:'789',valueId:'11'}]){
   const result=await f.core.invoke('hallmark_get_category_data',args,context);assert.equal(result.status,'needs_clarification');
  }
  for(const args of [{mode:'sync',storeId:'A',q:'unexpected'}, {mode:'search',storeId:'A',q:'*'}, {mode:'search',storeId:'A',q:'x',limit:21},
   {mode:'search',storeId:'A',q:'x',requireAspects:true}, {mode:'search',storeId:'A',q:'x',aspects:['a',' a ']},
   {mode:'show',storeId:'A',...pair,typeId:'01'}, {mode:'values',storeId:'A',...pair,attributeId:'789',q:'a'},
   {mode:'sync',storeId:'../A'}, {mode:'sync',storeId:'A',body:{}}, {mode:'delete',storeId:'A'}]){
   assert.equal((await f.core.invoke('hallmark_get_category_data',args,context)).status,'failed');
  }
  assert.deepEqual(f.calls,{stores:0,categories:[],other:0});assert.equal(f.store.list('snapshots').length,0);
 }finally{f.store.close();}
});

test('category ambiguous/mismatched store never enters source capability or creates a snapshot',async()=>{
 const f=setup();try{
  for(const scope of [{store:'Al'},{storeId:'A',store:'Alpine'},{storeId:'Missing'}])assert.equal((await f.core.invoke('hallmark_get_category_data',{...scope,mode:'sync'},context)).status,'needs_clarification');
  assert.equal(f.calls.categories.length,0);assert.equal(f.calls.other,0);assert.equal(f.store.list('snapshots').length,0);
 }finally{f.store.close();}
});

test('category key includes actual full request while equivalent defaults/whitespace/field order share identity',()=>{
 const key=(params:any)=>{const value=prepareCategory(params);assert.ok(!('result' in value));return value.datasetKey;};
 const base={mode:'search',storeId:'A',q:'鞋子'};
 assert.equal(key(base),key({limit:10,requireAspects:false,q:' 鞋子 ',storeId:'A',mode:'search',aspects:[]}));
 const distinct=[base,{...base,q:'衣服'},{...base,storeId:'B'},{...base,limit:11},{...base,aspects:['颜色']},
  {...base,aspects:['颜色'],requireAspects:true},...inputs.slice(1).map(input=>({...input,storeId:'A'})),
  {mode:'values',storeId:'A',...pair,attributeId:'789'},
  {mode:'values',storeId:'A',...pair,attributeId:'790'},
  {mode:'validate_value',storeId:'A',...pair,attributeId:'789',valueId:'12',dictionaryId:'22'},
  {mode:'validate_value',storeId:'A',...pair,attributeId:'789',valueId:'11',dictionaryId:'23'},
  {mode:'template',storeId:'A',...pair,typeId:'457'}];
 assert.equal(new Set(distinct.map(key)).size,distinct.length);
});

test('category missing source time never substitutes read time; spill is retained alongside full local payload',async()=>{
 const f=setup();try{
  const raw={values:[],stale:true,search:{candidates:[{id:1}],validation:'unavailable'}};
  f.setResponse({status:'ok',raw,provenance:{source:'hallmark_snapshot',fetchedAt:'2026-10-06T00:00:00Z',dataTime:'2026-10-06T00:00:00Z'},spill:{path:'synthetic.json'}});
  const result=await f.core.invoke('hallmark_get_category_data',{...inputs[3],storeId:'A'},context),data=result.data as any;
  assert.equal(result.provenance?.dataTime,undefined);assert.equal(data.raw,undefined);assert.deepEqual(data.spill,{path:'synthetic.json'});
  const snapshot=f.store.get('snapshots',data.datasetKey)!;assert.equal(snapshot.dataTime,null);assert.deepEqual(snapshot.payload,raw);assert.deepEqual(snapshot.sourceSpill,data.spill);
 }finally{f.store.close();}
});

test('category source failures preserve last successful data and source time and propagate retry cooldown',async()=>{
 const f=setup();try{
  const first=await f.core.invoke('hallmark_get_category_data',{mode:'search',storeId:'A',q:'鞋子'},context),key=(first.data as any).datasetKey,before=f.store.get('snapshots',key)!;
  f.setResponse({status:'unavailable',error:{code:'SOURCE_COOLDOWN',message:'Read cooldown',retryable:true,retryAfterMs:3000}});
  const result=await f.core.refreshDatasetBackground(key);assert.equal(result.status,'unavailable');assert.equal(result.error?.retryAfterMs,3000);
  const after=f.store.get('snapshots',key)!;for(const field of ['payload','dataTime','lastSuccessAt','version','sourceQuery'])assert.deepEqual(after[field],before[field]);assert.equal(after.state,'failed');assert.equal(f.calls.other,0);
  delete f.client.getCategoryData;assert.equal((await f.core.refreshDatasetBackground(key)).error?.code,'CAPABILITY_UNAVAILABLE');
 }finally{f.store.close();}
});

test('saved category query validates fixed capability parameters and resolves name without editing its saved recipe',async()=>{
 const f=setup();try{
  const binding={id:'data',query:{tool:'hallmark_get_category_data',params:{mode:'template',store:'Alpha',...pair}},fieldMap:{}};
  f.presentation.saveEntry(binding,'类目模板','保存类目模板');const key=bindingDatasetKey(binding),before=f.store.get('queries',key.slice(6));
  assert.ok(f.core.getRefreshCandidates().includes(key));const result=await f.core.refreshDatasetBackground(key);assert.equal(result.status,'ok');assert.deepEqual(f.store.get('queries',key.slice(6)),before);assert.equal(f.store.get('snapshots',key)!.provenance.storeId,'A');assert.equal(f.calls.other,0);
  for(const params of [{mode:'delete',storeId:'A'},{mode:'values',storeId:'A',...pair,attributeId:'789',path:'/write'}]){
   f.store.put('queries','invalid',{tool:'hallmark_get_category_data',params});const count=f.calls.categories.length;assert.equal((await f.core.refreshDatasetBackground('query:invalid')).status,'failed');assert.equal(f.calls.categories.length,count);
  }
 }finally{f.store.close();}
});

test('tampered category snapshot scope cannot be refreshed under a different key',async()=>{
 const f=setup();try{
  const result=await f.core.invoke('hallmark_get_category_data',{mode:'search',storeId:'A',q:'鞋子'},context),key=(result.data as any).datasetKey,snapshot=f.store.get('snapshots',key)!;
  snapshot.sourceQuery.params.q='different';f.store.put('snapshots',key,snapshot);const before=f.calls.stores;
  assert.equal((await f.core.refreshDatasetBackground(key)).error?.code,'DATASET_QUERY_MISMATCH');assert.equal(f.calls.categories.length,1);assert.equal(f.calls.stores,before);
 }finally{f.store.close();}
});

test('category snapshot recipe survives a real SQLite close/reopen without creating saved components',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hallmark-category-')),path=join(dir,'app.sqlite');let f=setup(path);
 try{
  const initial=await f.core.invoke('hallmark_get_category_data',{mode:'values',storeId:'A',...pair,attributeId:'789'},context),key=(initial.data as any).datasetKey;
  f.store.close();f=setup(path);const result=await f.core.refreshDatasetBackground(key);assert.equal(result.status,'ok');assert.equal(f.calls.categories.length,1);assert.equal(f.calls.categories[0].attributeId,'789');assert.equal(f.store.get('snapshots',key)!.version,2);assert.equal(f.store.list('components').length,0);assert.equal(f.store.list('entries').length,0);assert.equal(f.calls.other,0);
 }finally{f.store.close();await rm(dir,{recursive:true,force:true});}
});
