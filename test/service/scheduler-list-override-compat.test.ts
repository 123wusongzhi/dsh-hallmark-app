import test from 'node:test';
import assert from 'node:assert/strict';
import {constants,DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsSnapshotScheduler} from '../../packages/service/src/apps-scheduler.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
const originalList=RuntimeStore.prototype.list;
const at='2026-10-10T09:00:00.000Z';
const row={appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'one'}};
function scheduler(store:RuntimeStore){return new AppsSnapshotScheduler({store,describe:()=>undefined,refresh:async()=>{throw Error('UNEXPECTED_REFRESH');},isConnectionEnabled:()=>true});}
function outcome(fn:()=>unknown){try{return {value:fn()};}catch(e){return {error:(e as Error).message};}}
class CustomStore extends RuntimeStore {
 mode:'allow'|'hide'|'deny'='allow';calls=0;
 override list<T=Record<string,JsonValue>>(collection:string):T[]{this.calls++;if(collection==='provider_records'){if(this.mode==='hide')return [];if(this.mode==='deny')throw Error('CUSTOM_LIST_DENIED');}return super.list<T>(collection);}
}
test('subclass list filter, denial and subsequent recovery retain scheduler behavior',()=>{
 const store=new CustomStore(':memory:');try{store.put('provider_records','one',row);const worker=scheduler(store);for(const mode of ['allow','hide','deny','allow'] as const){store.mode=mode;const before=store.calls;assert.deepEqual(outcome(()=>worker.list()),mode==='deny'?{error:'CUSTOM_LIST_DENIED'}:{value:mode==='hide'?[]:[row.value]});assert.equal(store.calls-before,1);}}finally{store.close();}
});
test('instance replacement receives exactly the original receiver and arguments and is re-read each call',()=>{
 const store=new RuntimeStore(':memory:');try{store.put('provider_records','one',row);let calls=0;store.list=function<T>(collection:string):T[]{assert.equal(this,store);assert.deepEqual([...arguments],['provider_records']);calls++;return [];};assert.deepEqual(scheduler(store).list(),[]);store.list=()=>{throw Error('INSTANCE_DENIED');};assert.throws(()=>scheduler(store).list(),/INSTANCE_DENIED/);store.list=originalList;assert.deepEqual(scheduler(store).list(),[row.value]);assert.equal(calls,1);}finally{store.close();}
});
test('prototype replacement after module import affects both existing and later instances',()=>{
 const one=new RuntimeStore(':memory:');let two:RuntimeStore|undefined;try{one.put('provider_records','one',row);RuntimeStore.prototype.list=()=>[];two=new RuntimeStore(':memory:');two.put('provider_records','one',row);for(const store of [one,two])assert.deepEqual(scheduler(store).list(),[]);RuntimeStore.prototype.list=()=>{throw Error('PROTOTYPE_DENIED');};for(const store of [one,two])assert.throws(()=>scheduler(store).list(),/PROTOTYPE_DENIED/);RuntimeStore.prototype.list=originalList;for(const store of [one,two])assert.deepEqual(scheduler(store).list(),[row.value]);}finally{RuntimeStore.prototype.list=originalList;two?.close();one.close();}
});
test('dynamic list getter is evaluated once and its function result is called without reading .call',()=>{
 const store=new RuntimeStore(':memory:');try{store.put('provider_records','one',row);let reads=0;const failure=Error('GETTER_DENIED');const hide=function(this:RuntimeStore,collection:string){assert.equal(this,store);assert.equal(collection,'provider_records');return [];};Object.defineProperty(hide,'call',{get(){throw Error('DO_NOT_READ_CALL');}});Object.defineProperty(store,'list',{configurable:true,get(){reads++;if(reads===1)return hide;if(reads===2)throw failure;return originalList;}});assert.deepEqual(scheduler(store).list(),[]);assert.equal(reads,1);assert.throws(()=>scheduler(store).list(),e=>e===failure);assert.equal(reads,2);assert.deepEqual(scheduler(store).list(),[row.value]);assert.equal(reads,3);}finally{store.close();}
});
test('fallback retains exact array and errors, even after the store is closed',()=>{
 const store=new RuntimeStore(':memory:'),provided=[row,null];store.close();store.list=(<T>()=>provided as T[]);assert.equal(store.providerRecordScopeCandidates('apps','presentation','apps_schedules'),provided);assert.throws(()=>scheduler(store).list(),TypeError);store.list=()=>{throw Error('CLOSED_CUSTOM_ERROR');};assert.throws(()=>store.providerRecordScopeCandidates('apps','presentation','apps_schedules'),/CLOSED_CUSTOM_ERROR/);store.list=originalList;assert.throws(()=>store.providerRecordScopeCandidates('apps','presentation','apps_schedules'),/STORE_CLOSED/);
});
test('default and restored list retain the SQL candidate path without parsing unrelated payloads',()=>{
 const store=new RuntimeStore(':memory:');try{for(let i=0;i<20;i++)store.put('provider_records','noise-'+i,{appId:'other',value:{payload:'x'.repeat(100)}});store.put('provider_records','one',row);const parse=JSON.parse;let calls=0;JSON.parse=((...args:Parameters<typeof JSON.parse>)=>{calls++;return parse(...args);}) as typeof JSON.parse;try{assert.deepEqual(scheduler(store).list(),[row.value]);assert.equal(calls,1);store.list=()=>[];assert.deepEqual(scheduler(store).list(),[]);store.list=originalList;calls=0;assert.deepEqual(scheduler(store).list(),[row.value]);assert.equal(calls,1);}finally{JSON.parse=parse;}}finally{store.close();}
});
test('default candidate query still honors changing authorizer denial and restoration',{skip:typeof DatabaseSync.prototype.setAuthorizer!=='function'},()=>{
 const store=new RuntimeStore(':memory:');try{store.put('provider_records','one',row);let deny=false,calls=0;store.db.setAuthorizer((action,table,column)=>{calls++;return deny&&action===constants.SQLITE_READ&&table==='provider_records'&&column==='value_json'?constants.SQLITE_DENY:constants.SQLITE_OK;});assert.deepEqual(scheduler(store).list(),[row.value]);const previous=calls;deny=true;assert.throws(()=>scheduler(store).list());assert.ok(calls>previous);deny=false;assert.deepEqual(scheduler(store).list(),[row.value]);store.db.setAuthorizer(null);}finally{store.close();}
});
test('external SQLite commit remains visible on the default path',()=>{
 const directory=mkdtempSync(join(tmpdir(),'r2-list-compat-')),path=join(directory,'store.db'),store=new RuntimeStore(path),external=new DatabaseSync(path);try{store.put('provider_records','one',row);assert.deepEqual(scheduler(store).list(),[row.value]);external.prepare('UPDATE provider_records SET value_json=? WHERE id=?').run(JSON.stringify({...row,value:{scheduleId:'two'}}),'one');assert.deepEqual(scheduler(store).list(),[{scheduleId:'two'}]);}finally{external.close();store.close();rmSync(directory,{recursive:true,force:true});}
});
test('real scheduler tick skips overridden hidden/denied plans and resumes after restoration',async()=>{
 for(const mode of ['hide','deny'] as const){const store=new CustomStore(':memory:');let refreshes=0;const errors:unknown[]=[];const worker=new AppsSnapshotScheduler({store,describe:()=>undefined,refresh:async()=>{refreshes++;return {state:'ready',revision:'1'} as any;},isConnectionEnabled:()=>true,now:()=>new Date(at),report:error=>errors.push(error),intervalMs:3600000});try{const plan={scheduleId:'one',binding:{bindingId:'one',appId:'sample',connectionId:'c',capabilityId:'sample.rows.read',capabilityMajor:1,input:{},projection:[],refresh:{mode:'scheduled',scheduleId:'one'}},timeZone:'UTC',times:['09:01'],enabled:true,misfirePolicy:'coalesce_once',revision:1,nextRunAt:at,createdAt:at,updatedAt:at};store.put('provider_records',JSON.stringify(['apps','presentation','apps_schedules','one']),{...row,recordId:'one',value:plan});store.mode=mode;worker.start();if(mode==='deny')await assert.rejects(()=>worker.idle(),/CUSTOM_LIST_DENIED/);else await worker.idle();assert.equal(refreshes,0);assert.equal(worker.get('one')?.executionState,undefined);store.mode='allow';await worker.tick(new Date(at));assert.equal(refreshes,1);assert.equal(worker.get('one')?.executionState,'settled');if(mode==='deny')assert.ok(errors.length);}finally{await worker.stop();store.close();}}
});
