import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisibleDeadline,dataProgressKey,DISPLAY_ABSOLUTE_MS,DISPLAY_NO_PROGRESS_MS,remainingDisplayBudget} from '../../packages/component-runtime/src/visible-deadline.ts';
import {DISPLAY_READY_DEADLINE_MS} from '../../packages/app-presentation/src/authoring-types.ts';
function clock(){let now=0,id=0;const pending=new Map<number,{at:number;fn:()=>void}>();return {timers:{now:()=>now,set:(fn:()=>void,ms:number)=>{const key=++id;pending.set(key,{at:now+ms,fn});return key as unknown as ReturnType<typeof setTimeout>;},clear:(key:ReturnType<typeof setTimeout>)=>{pending.delete(key as unknown as number);}},advance(ms:number){const until=now+ms;while(true){const next=[...pending].sort((a,b)=>a[1].at-b[1].at).find(([,value])=>value.at<=until);if(!next)break;now=next[1].at;pending.delete(next[0]);next[1].fn();}now=until;},pending};}
test('new data stages extend idle allowance but unchanged successful polls, elapsed heartbeats and retries do not',()=>{
 const f=clock(),errors:string[]=[];const deadline=createVisibleDeadline(reason=>errors.push(reason!),DISPLAY_NO_PROGRESS_MS,f.timers);deadline.visible(true);
 const packet=(phase:string,elapsedMs:number)=>({bindings:[{bindingId:'a',datasetId:'d',state:'preparing',revision:null,preparation:{phase,elapsedMs}}]});
 deadline.progress('bridge:authorized');f.advance(29000);deadline.progress(dataProgressKey(packet('queued',1)));f.advance(29000);assert.deepEqual([...errors],[]);
 deadline.progress(dataProgressKey(packet('query',29001)));f.advance(29000);assert.deepEqual([...errors],[]);
 deadline.progress(dataProgressKey(packet('query',99999)));f.advance(1000);assert.deepEqual([...errors],['idle']);assert.equal(f.pending.size,0);
});
test('even continually new substantive milestones cannot exceed the absolute wall-clock cap',()=>{
 const f=clock(),errors:string[]=[];const deadline=createVisibleDeadline(reason=>errors.push(reason!),30000,f.timers);deadline.visible(true);
 for(let i=0;i<8;i++){f.advance(20000);deadline.progress('revision:'+i);assert.deepEqual([...errors],[]);}
 f.advance(19999);assert.deepEqual([...errors],[]);f.advance(1);assert.deepEqual([...errors],['absolute']);assert.equal(f.pending.size,0);assert.equal(DISPLAY_ABSOLUTE_MS,180000);assert.ok(DISPLAY_READY_DEADLINE_MS>=DISPLAY_ABSOLUTE_MS+30000);
});
test('hidden idle allowance pauses, but hiding cannot evade the absolute cap; ready stops both timers',()=>{
 const f=clock(),errors:string[]=[];const deadline=createVisibleDeadline(reason=>errors.push(reason!),30000,f.timers);deadline.visible(true);f.advance(10000);deadline.visible(false);f.advance(60000);deadline.visible(true);f.advance(19999);assert.deepEqual([...errors],[]);f.advance(1);assert.deepEqual([...errors],['idle']);
 const hidden=createVisibleDeadline(reason=>errors.push(reason!),30000,f.timers);hidden.visible(false);f.advance(180000);assert.deepEqual([...errors],['idle','absolute']);
 const ready=createVisibleDeadline(()=>assert.fail('ready must not expire'),30000,f.timers);ready.visible(true);ready.stop();f.advance(300000);assert.equal(f.pending.size,0);
});
test('preparation and iframe share the remaining absolute budget instead of each receiving 180 seconds',()=>{
 const now=Date.now(),openedAt=new Date(now-175000).toISOString(),remaining=remainingDisplayBudget(openedAt);assert.ok(remaining<=5000&&remaining>4500);
 const f=clock(),errors:string[]=[];const frame=createVisibleDeadline(reason=>errors.push(reason!),30000,f.timers,remaining);frame.visible(true);frame.progress('bridge:authorized');f.advance(remaining-1);assert.deepEqual([...errors],[]);f.advance(1);assert.deepEqual([...errors],['absolute']);assert.equal(remainingDisplayBudget(new Date(now-200000).toISOString()),0);
});
