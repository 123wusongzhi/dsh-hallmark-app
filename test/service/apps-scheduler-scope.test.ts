import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsSnapshotScheduler} from '../../packages/service/src/apps-scheduler.ts';
import type {PresentationStore} from '../../packages/app-presentation/src/types.ts';
const now=new Date('2026-10-10T00:00:00Z');
function scheduler(store:PresentationStore){return new AppsSnapshotScheduler({store,describe:()=>undefined,refresh:async()=>{throw new Error('unexpected');},isConnectionEnabled:()=>true,now:()=>now});}
test('scoped query selects exactly the prior filter and preserves created_at/id tie ordering',()=>{
  const store=new RuntimeStore(':memory:');try {
    const rows=[
      ['z',{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'10'}}],
      ['a',{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'2'}}],
      ['b',{appId:'apps',connectionId:'other',namespace:'apps_schedules',value:{scheduleId:'bad'}}],
      ['c',{appId:'other',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'bad'}}],
      ['d',{appId:'apps',connectionId:'presentation',namespace:'apps_schedule_history',value:{scheduleId:'bad'}}],
      ['e',{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'ä'}}],
      ['f',{namespace:'apps_schedules',value:{scheduleId:'bad'}}],
      ['g',{appId:1,connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'bad'}}],
    ] as const;
    for(const [key,value] of rows)store.put('provider_records',key,value);
    store.db.exec("UPDATE provider_records SET created_at='2026-10-10T00:00:00Z'");
    const expected=store.list<any>('provider_records').filter(row=>row.appId==='apps'&&row.connectionId==='presentation'&&row.namespace==='apps_schedules');
    assert.deepEqual(store.providerRecordScopeCandidates('apps','presentation','apps_schedules'),expected);
    assert.equal(store.providerRecordScopeCandidates('apps','other','apps_schedules').length,1);
    assert.equal(store.providerRecordScopeCandidates('other','presentation','apps_schedules').length,1);
    assert.equal(store.providerRecordScopeCandidates('apps','presentation','apps_schedule_history').length,1);
    assert.deepEqual(scheduler(store).list(),expected.map(row=>row.value).sort((a,b)=>a.scheduleId.localeCompare(b.scheduleId)));
    const fallback:PresentationStore={get:store.get.bind(store),list:store.list.bind(store),put:store.put.bind(store),delete:store.delete.bind(store),transaction:store.transaction.bind(store)};
    assert.deepEqual(scheduler(fallback).list(),scheduler(store).list());
    store.put('provider_records','z',{appId:'apps',connectionId:'elsewhere',namespace:'apps_schedules',value:{scheduleId:'10'}});
    assert.equal(store.providerRecordScopeCandidates('apps','presentation','apps_schedules').length,2);
    store.delete('provider_records','a');assert.equal(store.providerRecordScopeCandidates('apps','presentation','apps_schedules').length,1);
    assert.throws(()=>store.transaction(()=>{store.put('provider_records','new',rows[0][1]);throw Error('rollback');}),/rollback/);
    assert.equal(store.providerRecordScopeCandidates('apps','presentation','apps_schedules').length,1);
  }finally{store.close();}
});
test('scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'scheduler-scope-'));try{for(const schemaVersion of [3,4] as const){
   const path=join(dir,`${schemaVersion}.db`);let old=new RuntimeStore(path,{schemaVersion});old.put('provider_records','plan',{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'persisted'}});old.close();
   for(let i=0;i<2;i++){const current=new RuntimeStore(path,{schemaVersion});assert.equal(current.db.prepare('PRAGMA user_version').get()?.user_version,schemaVersion);assert.equal(scheduler(current).list()[0].scheduleId,'persisted');assert.match(JSON.stringify(current.db.prepare("EXPLAIN QUERY PLAN SELECT value_json FROM provider_records WHERE json_extract(value_json,'$.appId')=? AND json_extract(value_json,'$.connectionId')=? AND json_extract(value_json,'$.namespace')=? ORDER BY created_at,id").all('apps','presentation','apps_schedules')),/SCAN provider_records/);current.close();assert.throws(()=>current.providerRecordScopeCandidates('apps','presentation','apps_schedules'),/STORE_CLOSED/);}
 }}finally{rmSync(dir,{recursive:true,force:true});}
});
test('scoped scheduler dispatch preserves scheduleId order and dataset grouping across unrelated records',async()=>{
 const store=new RuntimeStore(':memory:'),seen:string[]=[];const worker=new AppsSnapshotScheduler({store,describe:()=>undefined,isConnectionEnabled:()=>true,now:()=>now,refresh:async(_binding,source)=>{if(source.kind==='scheduler')seen.push(source.scheduleId);return {state:'ready',revision:'1'} as any;}});
 try{for(const name of ['z','a','m']){const plan={scheduleId:name,binding:{bindingId:name,appId:'hallmark',connectionId:'local',capabilityId:'hallmark.rows.list',capabilityMajor:1,input:{dataset:name==='m'?'a':name},projection:[],refresh:{mode:'scheduled',scheduleId:name}},timeZone:'UTC',times:['00:01'],enabled:true,misfirePolicy:'coalesce_once',revision:1,nextRunAt:'2026-10-09T00:01:00.000Z',createdAt:now.toISOString(),updatedAt:now.toISOString()};store.put('provider_records',JSON.stringify(['apps','presentation','apps_schedules',name]),{appId:'apps',connectionId:'presentation',namespace:'apps_schedules',recordId:name,value:plan});}
  store.put('provider_records','noise',{appId:'hallmark',connectionId:'local',namespace:'snapshots',value:{payload:'unrelated'}});worker.start();await worker.idle();assert.deepEqual(seen,['a','z']);assert.equal(worker.get('a')?.lastRunId,worker.get('m')?.lastRunId);assert.equal(worker.get('z')?.executionState,'settled');
 }finally{await worker.stop();store.close();}
});
