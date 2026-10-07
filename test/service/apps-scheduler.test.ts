import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsSnapshotScheduler,nextScheduleRun} from '../../packages/service/src/apps-scheduler.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import type {AppProvider,CapabilityDescriptor,DatasetBinding,ExecutionContext,InvocationRequest,JsonValue,ResourceRef} from '../../packages/app-contracts/src/index.ts';

const at='2026-10-07T00:59:00.000Z',sourceTime='2026-10-01T00:00:00.000Z';
function evidence(name:string,facts:unknown){const directory=resolve('evidence/apps-a2-20261007/runtime-refresh-config');mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`scheduler-${name}.json`),JSON.stringify({schemaVersion:1,scope:'FIXTURE+CLOCK_CONTROL',requirements:['REQ-074','REQ-075'],tests:['TST-074','TST-075'],status:'PASS',executedAt:new Date().toISOString(),verifier:'domain_map automated apps-scheduler.test.ts',noRealBusinessCalls:true,liveHostScope:'NOT_RUN',sourceHashes:Object.fromEntries(['packages/service/src/scheduler.ts','packages/service/src/apps-scheduler.ts','packages/app-presentation/src/index.ts','packages/service/src/apps-main.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),facts},null,2)+'\n');}
function descriptor(appId:string):CapabilityDescriptor{return {capabilityId:`${appId}.rows.list`,version:'1.0.0',title:'Fixture read',description:'Explicit isolated dataset',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:10000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};}
const binding=(appId:string,bindingId=appId):DatasetBinding=>({bindingId,appId,connectionId:'local',capabilityId:`${appId}.rows.list`,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}});
function fixture(path=':memory:',sources?:SourceComponentStore){
  let store=new RuntimeStore(path),runtime:AppsRuntime,service:AppsPresentationService,scheduler:AppsSnapshotScheduler,clock=new Date(at),revision=1;const requests:InvocationRequest[]=[],offline=new Set<string>();let hold:(()=>Promise<void>)|undefined;
  const open=()=>{runtime=new AppsRuntime(store);for(const appId of ['hallmark','notes']){const provider:AppProvider={manifest:{manifestVersion:1,appId,displayName:appId,providerPackage:appId,providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor(appId)],execute:async(context:ExecutionContext)=>{requests.push(context.request);if(hold)await hold();if(offline.has(appId))return {status:'unavailable',invocationId:context.request.invocationId,traceId:context.request.traceId,error:{code:'OFFLINE',message:'Fixture backend is offline',retryPolicy:'read_retry'}};const resource:ResourceRef={appId,connectionId:'local',resourceType:'row',resourceId:appId,revision:String(appId==='notes'?revision:1)};return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:[{title:appId,revision:resource.revision}],resources:[resource]} as unknown as JsonValue,provenance:[{appId,connectionId:'local',sourceKind:'snapshot',sourceRef:'fixture',fetchedAt:clock.toISOString(),sourceDataTime:appId==='hallmark'?sourceTime:null,freshness:'unknown'}]};},dispose:async()=>{}};runtime.register(provider);if(!runtime.getConnection(appId,'local'))runtime.addConnection({appId,connectionId:'local',displayName:appId,config:{backend:'fixture'},configRevision:1,enabled:true});}
    service=new AppsPresentationService({store,runtime,...(sources?{sources}:{}),scheduledBinding:value=>scheduler.requireSchedule(value.refresh.scheduleId!,value)});scheduler=new AppsSnapshotScheduler({store,describe:id=>runtime.describe(id),refresh:(value,source)=>service.refreshBinding(value,source),isConnectionEnabled:(appId,id)=>runtime.getConnection(appId,id)?.enabled===true,now:()=>clock,intervalMs:3600000});};open();
  return {get store(){return store;},get runtime(){return runtime;},get service(){return service;},get scheduler(){return scheduler;},requests,offline,time(value:string){clock=new Date(value);},revision(value:number){revision=value;},hold(value:(()=>Promise<void>)|undefined){hold=value;},async restart(){await scheduler.stop();await runtime.dispose();store.close();store=new RuntimeStore(path);open();scheduler.start();await scheduler.idle();},async close(){await scheduler.stop();await runtime.dispose();store.close();}};
}
const plan=(appId:string,scheduleId=appId)=>({scheduleId,binding:binding(appId),timeZone:'Asia/Shanghai',times:['09:00','21:00']});

test('plans require a live worker, registered read schema, timezone and CAS; next run is explicit UTC',async()=>{
  const f=fixture();try{
    assert.throws(()=>f.scheduler.create(plan('hallmark')),/SCHEDULER_UNAVAILABLE/);assert.equal(f.scheduler.status().state,'stopped');
    f.scheduler.start();await f.scheduler.idle();const current=f.scheduler.create(plan('hallmark'));assert.equal(current.nextRunAt,'2026-10-07T01:00:00.000Z');assert.equal(current.misfirePolicy,'coalesce_once');f.scheduler.requireSchedule('hallmark',binding('hallmark'));
    assert.throws(()=>f.scheduler.create({...plan('notes'),timeZone:'Invented/Clock'}),/INVALID_SCHEDULE_TIMEZONE/);assert.throws(()=>f.scheduler.create({...plan('notes'),binding:{...binding('notes'),input:{invented:true}}}),/INVALID_SCHEDULE_BINDING/);
    const unsafe:AppProvider={manifest:{manifestVersion:1,appId:'unsafe',displayName:'Unsafe fixture',providerPackage:'unsafe',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[{...descriptor('unsafe'),effect:'mutation',execution:{...descriptor('unsafe').execution,idempotency:'runtime_dedup'}}],execute:async()=>{throw new Error('MUTATION_MUST_NOT_DISPATCH');},dispose:async()=>{}};f.runtime.register(unsafe);assert.throws(()=>f.scheduler.create(plan('unsafe')),/QUERY_NOT_READ_ONLY/);
    assert.throws(()=>f.scheduler.requireSchedule('hallmark',binding('notes')),/SCHEDULE_BINDING_MISMATCH/);assert.throws(()=>f.scheduler.update('hallmark',{expectedRevision:2,enabled:false}),/SCHEDULE_REVISION_CONFLICT/);
    const changed=f.scheduler.update('hallmark',{expectedRevision:1,times:['10:00']});assert.equal(changed.revision,2);assert.equal(changed.nextRunAt,'2026-10-07T02:00:00.000Z');const removed=f.scheduler.delete('hallmark',2);assert.equal(removed.enabled,false);assert.equal(removed.nextRunAt,null);assert.equal(f.scheduler.get('hallmark'),undefined);assert.throws(()=>f.scheduler.requireSchedule('hallmark',binding('hallmark')),/SCHEDULE_NOT_FOUND/);
    evidence('worker-crud',{workerId:f.scheduler.workerId,workerState:f.scheduler.status().state,initialNextRunAt:current.nextRunAt,timeZone:current.timeZone,changedNextRunAt:changed.nextRunAt,changedRevision:changed.revision,deleted:true,invalidClockRejected:true,unknownInputRejected:true,absentWorkerRejected:true});
  }finally{await f.close();}
});

test('actual worker refreshes two closed-UI datasets independently, preserves failed data and never builds or saves',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-schedule-source-')),project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<h1>Immutable scheduler fixture</h1>');writeFileSync(join(project,'source.ts'),'const localCounter = 0;');writeFileSync(join(project,'package-lock.json'),'{}');const f=fixture(':memory:',new SourceComponentStore(join(directory,'archive')));try{
    const view=f.service.openSource('unused-ui-session',project,{title:'Closed UI',bindings:[binding('hallmark'),binding('notes')]}),saved=f.service.saveComponent('unused-ui-session',view.viewId,'Explicit fixture setup save',{mode:'save_as'}),beforeCounts=Object.fromEntries(['builds','components','component_versions','operations'].map(collection=>[collection,f.store.list(collection).length]));f.scheduler.start();await f.scheduler.idle();f.scheduler.create(plan('hallmark'));f.scheduler.create(plan('notes'));
    f.time('2026-10-07T01:00:00.000Z');await f.scheduler.tick();const first=f.service.getData('unused-ui-session',view.viewId);assert.equal(f.requests.length,2);assert.ok(f.requests.every(request=>request.source.kind==='scheduler'));assert.equal(first.bindings[0].sourceDataTime,sourceTime);
    const selection={bindingId:'hallmark',datasetRevision:first.bindings[0].revision!,resources:first.bindings[0].resources};f.offline.add('hallmark');f.revision(2);f.time('2026-10-07T13:00:00.000Z');await f.scheduler.tick();const second=f.service.getData('unused-ui-session',view.viewId);
    assert.equal(second.bindings[0].state,'unavailable');assert.equal(second.bindings[0].freshness,'stale');assert.deepEqual(second.bindings[0].payload,first.bindings[0].payload);assert.equal(second.bindings[0].sourceDataTime,sourceTime);assert.equal(second.bindings[0].lastSuccessAt,first.bindings[0].lastSuccessAt);assert.equal(second.bindings[1].revision,'2');assert.equal(second.bindings[1].resources[0].revision,'2');
    assert.throws(()=>f.service.validateSelection('unused-ui-session',view.viewId,selection),{code:'SELECTION_STALE'});assert.deepEqual(f.service.getView(view.viewId),view);for(const collection of ['builds','components','component_versions','operations'])assert.equal(f.store.list(collection).length,beforeCounts[collection]);assert.equal(f.store.get<{revision:number}>('components',saved.componentId)?.revision,1);
    f.offline.clear();f.time('2026-10-08T01:00:00.000Z');await f.scheduler.tick();const restored=f.service.getData('unused-ui-session',view.viewId);assert.equal(restored.bindings[0].state,'ready');assert.equal(restored.bindings[0].sourceDataTime,sourceTime);assert.throws(()=>f.service.validateSelection('unused-ui-session',view.viewId,selection),{code:'SELECTION_STALE'});
    evidence('independent-bindings',{workerId:f.scheduler.workerId,viewId:view.viewId,buildId:view.source!.buildId,componentRevision:1,sourceDataTime:sourceTime,first,failedAndUpdated:second,restored,beforeCounts,afterCounts:Object.fromEntries(Object.keys(beforeCounts).map(collection=>[collection,f.store.list(collection).length])),queries:f.requests.map(request=>({appId:request.appId,capabilityId:request.capabilityId,source:request.source})),staleSelectionRejected:true,allUiClosed:true});
  }finally{await f.close();rmSync(directory,{recursive:true,force:true});}
});

test('persisted nextRun survives SQLite restart and missed days coalesce to one read per dataset',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-schedule-')),f=fixture(join(directory,'apps.db'));try{
    f.scheduler.start();await f.scheduler.idle();f.scheduler.create(plan('hallmark'));f.scheduler.create(plan('notes'));const worker=f.scheduler.workerId;
    f.time('2026-10-15T14:00:00.000Z');await f.restart();assert.notEqual(f.scheduler.workerId,worker);assert.equal(f.requests.length,2);assert.equal(f.scheduler.get('hallmark')?.nextRunAt,'2026-10-16T01:00:00.000Z');assert.equal(f.scheduler.get('hallmark')?.lastScheduledAt,'2026-10-07T01:00:00.000Z');await f.scheduler.tick();assert.equal(f.requests.length,2);assert.equal(f.store.list('operations').length,0);
    evidence('restart-missed-once',{firstWorkerId:worker,newWorkerId:f.scheduler.workerId,clockNow:'2026-10-15T14:00:00.000Z',readCount:f.requests.length,plans:f.scheduler.list(),sqliteRestart:true,missedSlotsCoalesced:true,repeatTickAdditionalReads:0});
  }finally{await f.close();rmSync(directory,{recursive:true,force:true});}
});

test('same-dataset plans and overlapping manual refresh are single-flight; disabled plans/connections stop new reads',async()=>{
  const f=fixture();let release:()=>void=()=>{};try{
    f.scheduler.start();await f.scheduler.idle();f.scheduler.create(plan('hallmark','one'));f.scheduler.create({...plan('hallmark','two'),binding:binding('hallmark','another-binding')});
    f.time('2026-10-07T01:00:00.000Z');let started:()=>void=()=>{};const start=new Promise<void>(resolve=>{started=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});f.hold(async()=>{started();await barrier;});
    const manual=f.service.refreshBinding(binding('hallmark'),{kind:'scheduler',scheduleId:'manual-fixture',runId:'manual'});await start;const first=f.scheduler.tick(),overlap=f.scheduler.tick();release();await Promise.all([manual,first,overlap]);assert.equal(f.requests.length,1);assert.equal(f.scheduler.get('one')?.lastRunId,f.scheduler.get('two')?.lastRunId);
    f.hold(undefined);f.scheduler.delete('one',1);f.scheduler.delete('two',1);f.scheduler.create(plan('notes'));await f.runtime.updateConnection({appId:'notes',connectionId:'local',expectedConfigRevision:1,enabled:false});f.time('2026-10-07T13:00:00.000Z');await f.scheduler.tick();assert.equal(f.requests.length,1);assert.equal(f.scheduler.get('notes')?.lastResult?.code,'CONNECTION_DISABLED');await f.scheduler.stop();assert.throws(()=>f.scheduler.requireSchedule('notes',binding('notes')),/SCHEDULER_UNAVAILABLE/);
    evidence('single-flight-disable',{physicalReads:f.requests.length,overlappingManualAndTwoPlans:1,disabledPlansAdditionalReads:0,disabledConnectionResult:f.scheduler.get('notes')?.lastResult,workerState:f.scheduler.status().state,absentWorkerRejectsExecution:true});
  }finally{release();await f.close();}
});

test('timezone search skips nonexistent DST minutes and does not dispatch a repeated wall-clock slot twice',()=>{
  assert.equal(nextScheduleRun(new Date('2026-03-08T06:59:00Z'),'America/New_York',['02:30']),'2026-03-09T06:30:00.000Z');
  assert.equal(nextScheduleRun(new Date('2026-11-01T05:30:00Z'),'America/New_York',['01:30'],'2026-11-01:01:30'),'2026-11-02T06:30:00.000Z');
  evidence('timezone-dst',{timeZone:'America/New_York',springMissingSlotNext:'2026-03-09T06:30:00.000Z',fallRepeatedSlotNext:'2026-11-02T06:30:00.000Z',sameWallClockSlotDispatchedAtMostOnce:true});
});

test('an interrupted read reservation recovers once even when nextRun was already persisted in the future',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-schedule-recovery-')),f=fixture(join(directory,'apps.db'));try{
    f.scheduler.start();await f.scheduler.idle();const original=f.scheduler.create(plan('hallmark'));const key=JSON.stringify(['apps','presentation','apps_schedules','hallmark']);
    // A persisted dispatch reservation models a process exit between reservation and read completion.
    const record=f.store.get<{value:typeof original}>('provider_records',key)!;f.store.put('provider_records',key,{...record,value:{...original,lastScheduledAt:original.nextRunAt,lastRunAt:'2026-10-07T01:00:00Z',lastRunId:'interrupted-read',lastWorkerId:f.scheduler.workerId,executionState:'running',nextRunAt:'2026-10-07T13:00:00Z'}});
    f.time('2026-10-07T02:00:00Z');await f.restart();assert.equal(f.requests.length,1);assert.equal(f.scheduler.get('hallmark')?.executionState,'settled');assert.equal(f.scheduler.get('hallmark')?.nextRunAt,'2026-10-07T13:00:00.000Z');await f.scheduler.tick();assert.equal(f.requests.length,1);
    evidence('interrupted-reservation',{fault:'process exit after durable read reservation before result',readCount:f.requests.length,plan:f.scheduler.get('hallmark'),repeatTickAdditionalReads:0,businessMutationCalls:0});
  }finally{await f.close();rmSync(directory,{recursive:true,force:true});}
});

test('changing a plan during its in-flight read cannot attach the old result to the new binding',async()=>{
  const f=fixture();let release:()=>void=()=>{};try{
    f.scheduler.start();await f.scheduler.idle();f.scheduler.create(plan('hallmark','replace-binding'));let entered:()=>void=()=>{};const started=new Promise<void>(resolve=>{entered=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});f.hold(async()=>{entered();await barrier;});f.time('2026-10-07T01:00:00Z');const read=f.scheduler.tick();await started;
    const changed=f.scheduler.update('replace-binding',{expectedRevision:1,binding:binding('notes')});assert.equal(changed.revision,2);assert.equal(changed.executionState,'settled');assert.equal(changed.lastResult,undefined);release();await read;assert.equal(f.scheduler.get('replace-binding')?.lastResult,undefined);assert.equal(f.scheduler.get('replace-binding')?.binding.appId,'notes');
    f.hold(undefined);f.time('2026-10-07T13:00:00Z');await f.scheduler.tick();assert.deepEqual(f.requests.map(request=>request.appId),['hallmark','notes']);assert.equal(f.scheduler.get('replace-binding')?.lastResult?.state,'ready');
    evidence('changed-plan-inflight',{revision:2,oldReadApp:'hallmark',newBindingApp:'notes',oldResultAttachedToNewBinding:false,nextReadApps:f.requests.map(request=>request.appId),executions:2});
  }finally{release();await f.close();}
});
