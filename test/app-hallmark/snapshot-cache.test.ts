import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readCompleteSnapshot,invalidateStoreSnapshots} from '../../packages/app-hallmark/src/snapshot-cache.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {CoreStore} from '../../packages/core/src/types.ts';
import type {ToolResult} from '../../packages/contracts/src/index.ts';
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const result=(items:number[]):ToolResult=>({status:'ok',data:{items,total:items.length,warnings:[],dataTime:null},provenance:{source:'ozon_api',endpoint:'fixture',fetchedAt:new Date().toISOString()}});
function fixture(){const records=new Map<string,any>();const store={get:(collection:string,id:string)=>records.get(`${collection}:${id}`),put:(collection:string,id:string,value:any)=>{records.set(`${collection}:${id}`,structuredClone(value));return value;}} as CoreStore;return {store,records};}
const payload=(value:ToolResult):any=>{assert.equal(value.status,'ok');return value.data;};
test('complete snapshots use 15 minutes and forced/expired reads immediately share one background refresh',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});const {store}=fixture();let calls=0,release!:()=>void;
 const options={store,storeId:'bill',scope:'products',force:false,build:async()=>{calls++;return result([1,2]);}};
 const first=payload(await readCompleteSnapshot(options));assert.equal(first.cache.ttlMs,900000);assert.equal(first.cache.expiresAt,'2026-10-09T00:15:00.000Z');
 t.mock.timers.tick(899999);assert.deepEqual(payload(await readCompleteSnapshot(options)).items,[1,2]);assert.equal(calls,1);
 const gate=new Promise<void>(resolve=>{release=resolve;});options.build=async()=>{calls++;await gate;return result([3,4,5]);};t.mock.timers.tick(1);
 const stale=payload(await readCompleteSnapshot(options));assert.deepEqual(stale.items,[1,2]);assert.equal(stale.cache.refreshing,true);assert.equal(stale.cache.stale,true);
 for(let i=0;i<3;i++)assert.deepEqual(payload(await readCompleteSnapshot({...options,force:true})).items,[1,2]);assert.equal(calls,2);
 release();await flush();const fresh=payload(await readCompleteSnapshot(options));assert.deepEqual(fresh.items,[3,4,5]);assert.equal(fresh.cache.refreshing,false);assert.equal(fresh.cache.stale,false);
 const manualGate=new Promise<void>(resolve=>{release=resolve;});options.build=async()=>{calls++;await manualGate;return result([6]);};const manual=payload(await readCompleteSnapshot({...options,force:true}));assert.deepEqual(manual.items,[3,4,5]);assert.equal(manual.cache.refreshing,true);release();await flush();assert.deepEqual(payload(await readCompleteSnapshot(options)).items,[6]);
});
test('temporary and incomplete background refreshes preserve the whole previous snapshot and cooldown',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});const {store}=fixture();let calls=0;
 const options={store,storeId:'bill',scope:'combined',force:false,build:async():Promise<ToolResult>=>{calls++;return result([1,2]);}};const first=payload(await readCompleteSnapshot(options));
 options.build=async()=>{calls++;return {status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'wait',retryable:true,retryAfterMs:60000}};};payload(await readCompleteSnapshot({...options,force:true}));await flush();
 const stale=payload(await readCompleteSnapshot(options));assert.deepEqual(stale.items,[1,2]);assert.equal(stale.cache.fetchedAt,first.cache.fetchedAt);assert.equal(stale.cache.stale,true);assert.equal(stale.cache.refreshing,false);await readCompleteSnapshot({...options,force:true});assert.equal(calls,2);
 t.mock.timers.tick(60000);options.build=async()=>{calls++;return {...result([3]),data:{items:[3],total:1,warnings:[],cache:{stale:true,nextRefreshAt:new Date(Date.now()+5000).toISOString()},sourceStates:[{status:'missing'}]}};};await readCompleteSnapshot(options);await flush();assert.deepEqual(payload(await readCompleteSnapshot(options)).items,[1,2]);
});
test('authorization changes invalidate persisted snapshots and an in-flight old generation cannot restore them',async()=>{
 const {store}=fixture();let release!:()=>void;const options={store,storeId:'bill',scope:'products',force:false,build:async()=>result([1])};await readCompleteSnapshot(options);
 const gate=new Promise<void>(resolve=>{release=resolve;});options.build=async()=>{await gate;return result([2]);};await readCompleteSnapshot({...options,force:true});invalidateStoreSnapshots(store,'bill');
 const next=payload(await readCompleteSnapshot({...options,build:async()=>result([3])}));assert.deepEqual(next.items,[3]);release();await flush();assert.deepEqual(payload(await readCompleteSnapshot({...options,build:async()=>result([4])})).items,[3]);
 const denied={...options,build:async():Promise<ToolResult>=>({status:'failed',error:{code:'OZON_HTTP_403',message:'denied',retryable:false}})};await readCompleteSnapshot({...denied,force:true});await flush();assert.equal((await readCompleteSnapshot(denied)).status,'failed');
});
test('permanent errors are reported after background completion and are never presented as rate-limit fallback',async()=>{
 const {store}=fixture(),options={store,storeId:'bill',scope:'bad-input',force:false,build:async()=>result([1])};await readCompleteSnapshot(options);
 const failed={...options,build:async():Promise<ToolResult>=>({status:'failed',error:{code:'OZON_BAD_REQUEST',message:'HTTP 422',retryable:false}})};await readCompleteSnapshot({...failed,force:true});await flush();assert.equal((await readCompleteSnapshot(failed)).error?.code,'OZON_BAD_REQUEST');
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),retry={...options,build:async()=>{await gate;return result([2]);}};assert.equal(payload(await readCompleteSnapshot({...retry,force:true})).cache.refreshing,true);assert.equal(payload(await readCompleteSnapshot(retry)).cache.refreshing,true);release();await flush();assert.deepEqual(payload(await readCompleteSnapshot(retry)).items,[2]);
});
test('successful complete snapshots survive database reopen and isolate shops and connection revisions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'complete-snapshot-')),path=join(dir,'apps.db');let db=new RuntimeStore(path);let calls=0;
 try{
  await readCompleteSnapshot({store:new HallmarkStorePort(db,'c',1),storeId:'bill',scope:'products',force:false,build:async()=>{calls++;return result([1,2]);}});db.close();db=new RuntimeStore(path);
  const store=new HallmarkStorePort(db,'c',1),options={store,storeId:'bill',scope:'products',force:false,build:async()=>{calls++;return result([3]);}};assert.deepEqual(payload(await readCompleteSnapshot(options)).items,[1,2]);assert.equal(calls,1);
  assert.deepEqual(payload(await readCompleteSnapshot({...options,storeId:'helen'})).items,[3]);assert.deepEqual(payload(await readCompleteSnapshot({...options,store:new HallmarkStorePort(db,'c',2)})).items,[3]);assert.equal(calls,3);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
