import test from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {SnapshotScheduler} from '../../packages/service/src/scheduler.ts';
const stamp=(seconds:number)=>new Date(2026,0,10,8,30,seconds);
function fixture(){const store=new AppStore(':memory:');const calls:string[]=[];let candidates=['store_products:one'];let limited=true;const core={getRefreshCandidates:()=>candidates,refreshDatasetBackground:async(key:string)=>{calls.push(key);return limited?{status:'unavailable' as const,error:{code:'LOCAL_RATE_LIMIT',message:'fixture cooldown',retryable:true,retryAfterMs:60_000}}:{status:'ok' as const};}};return{store,calls,core,success:()=>{limited=false;},candidates:(next:string[])=>{candidates=next;}};}
test('completed schedule still performs one delayed read after retryAfter, including scheduler restart',async()=>{
 const f=fixture();const first=new SnapshotScheduler(f.core,f.store);
 try{await first.tick(stamp(0));await first.tick(stamp(30));assert.equal(f.calls.length,1);assert.ok(f.store.get('settings','schedule:2026-01-10:08:30'));first.stop();
  const restored=new SnapshotScheduler(f.core,f.store);f.success();await restored.tick(stamp(60));await restored.tick(stamp(90));assert.equal(f.calls.length,2);assert.equal(f.store.get<any>('settings','cooldown:store_products:one')?.pending,false);assert.deepEqual(f.store.list('operations'),[]);restored.stop();
 }finally{first.stop();f.store.close();}
});
test('repeated rate limits have a bounded retry budget and removed candidates are not replayed',async()=>{
 const f=fixture();const scheduler=new SnapshotScheduler(f.core,f.store);
 try{for(let minute=0;minute<6;minute++)await scheduler.tick(stamp(minute*60));assert.equal(f.calls.length,4);assert.equal(f.store.get<any>('settings','cooldown:store_products:one')?.pending,false);
  f.store.put('settings','cooldown:removed',{until:stamp(0).getTime(),pending:true,attempts:1});await scheduler.tick(stamp(500));assert.equal(f.calls.length,4);
  scheduler.stop();await scheduler.tick(stamp(600));assert.equal(f.calls.length,4);
 }finally{scheduler.stop();f.store.close();}
});
test('a scheduled key and due retry coalesce, retaining single-flight tick protection',async()=>{
 const f=fixture();const scheduler=new SnapshotScheduler(f.core,f.store);f.store.put('settings','cooldown:store_products:one',{until:stamp(0).getTime(),pending:true,attempts:1});
 try{await Promise.all([scheduler.tick(stamp(0)),scheduler.tick(stamp(0))]);assert.deepEqual(f.calls,['store_products:one']);}
 finally{scheduler.stop();f.store.close();}
});
