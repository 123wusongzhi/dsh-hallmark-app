import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
const binding:DatasetBinding={bindingId:'control',appId:'notes',connectionId:'local',capabilityId:'notes.control',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
const descriptor:CapabilityDescriptor={capabilityId:'notes.control',version:'1.0.0',title:'Control read',description:'Controlled non-business input',effect:'query',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:10000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const pause=(ms=10)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function fixture(t:{after:(action:()=>void)=>void},invoke:(request:InvocationRequest,signal?:AbortSignal)=>Promise<CapabilityResult>){
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());let revision=1,enabled=true;const sessions=new Set(['A','B']);
 const runtime={invoke,describe:()=>descriptor,getConnection:()=>({enabled,configRevision:revision}),sessionBindings:(sessionId:string)=>sessions.has(sessionId)?[{sessionId,appId:'notes',connectionId:'local',enabled:true,boundAt:'2026-10-15T00:00:00Z'}]:[]};
 const service=new AppsPresentationService({store,runtime}),view=service.createView('A',{title:'Controlled preparation',bindings:[binding]}),source={buildId:'controlled-build',directory:'controlled',entry:'index.html',files:['index.html']};store.put('views',view.viewId,{...view,source});
 return {store,service,view:{...view,source},sessions,bump:()=>revision++,disable:()=>{enabled=false;}};
}
const ok=(request:InvocationRequest):CapabilityResult=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{control:'settled'}});
test('a controlled five-second provider does not block open and getData transitions from preparing to ready',async t=>{
 let calls=0;const f=fixture(t,async request=>{calls++;await pause(5000);return ok(request);}),start=performance.now();
 const opened=await f.service.hydrateSourceView(f.view,{kind:'agent',sessionId:'A',nativeCallId:'open'});assert.ok(performance.now()-start<200);assert.equal(opened.initialData?.[0].status,'preparing');
 const first=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(first.state,'preparing');assert.equal(first.payload,null);assert.ok(first.preparation?.elapsedMs!==undefined);
 await pause(5100);const next=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(calls,1);assert.equal(next.state,'ready');assert.equal(next.preparation?.state,'ready');assert.ok(next.preparation?.finishedAt);assert.deepEqual(next.payload,{control:'settled'});
});
test('a preparation exception is observable as a classified failure before a retry can replace it',async t=>{
 let calls=0;const f=fixture(t,async request=>{if(++calls===1)throw Object.assign(new Error('database is locked'),{code:'SQLITE_BUSY'});return ok(request);});f.service.prepareViewData(f.view);await pause(500);
 const failed=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(failed.state,'failed');assert.equal(failed.error?.code,'RUNTIME_STORE_BUSY');assert.equal(failed.error?.retryPolicy,'read_retry');assert.equal(failed.preparation?.state,'failed');assert.ok(failed.preparation?.finishedAt);assert.equal(failed.payload,null);assert.equal(calls,1);
 assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'preparing');await pause();assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'ready');assert.equal(calls,2);
});
test('preparation keeps connection and session admission, and revoked work cannot overwrite another session snapshot',async t=>{
 const pending:{request:InvocationRequest;resolve:(value:CapabilityResult)=>void}[]=[];const f=fixture(t,request=>new Promise(resolve=>pending.push({request,resolve}))),other=f.service.createView('B',{title:'Other owner',bindings:[binding]});f.store.put('views',other.viewId,{...other,source:f.view.source});
 f.service.prepareViewData(f.view);f.service.prepareViewData({...other,source:f.view.source});await pause();assert.equal(pending.length,2);assert.deepEqual(new Set(pending.map(item=>'sessionId' in item.request.source?item.request.source.sessionId:'')),new Set(['A','B']));assert.throws(()=>f.service.getData('B',f.view.viewId),{code:'VIEW_NOT_OWNED'});
 f.sessions.delete('A');for(const item of pending)item.resolve(ok(item.request));await pause();const denied=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(denied.state,'failed');assert.equal(denied.error?.code,'APP_NOT_ACTIVE');assert.equal(denied.error?.retryPolicy,'never');assert.equal(f.service.getData('B',other.viewId).bindings[0].state,'ready');assert.equal(f.store.list('datasets').length,1);
 const before=pending.length;f.disable();f.service.prepareViewData({...other,source:f.view.source});assert.equal(f.service.getData('B',other.viewId).bindings[0].error?.code,'CONNECTION_NOT_FOUND');assert.equal(pending.length,before);
});
test('a changed connection revision isolates late old preparation from the new single-flight',async t=>{
 const pending:{request:InvocationRequest;resolve:(value:CapabilityResult)=>void}[]=[];const f=fixture(t,request=>new Promise(resolve=>pending.push({request,resolve})));f.service.prepareViewData(f.view);await pause();f.bump();f.service.prepareViewData(f.view);await pause();assert.equal(pending.length,2);
 pending[0].resolve(ok(pending[0].request));await pause();assert.equal(f.store.list('datasets').length,0);assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'preparing');pending[1].resolve(ok(pending[1].request));await pause();assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'ready');assert.equal(f.store.list('datasets').length,1);
});

test('a newer explicit refresh settles pending preparation and a late prewarm response cannot replace it',async t=>{
 let calls=0,release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 const f=fixture(t,async request=>{const call=++calls;if(call===1)await pending;return {...ok(request),data:{control:call===1?'old prewarm':'explicit refresh'}} as CapabilityResult;});
 f.service.prepareViewData(f.view);await pause();const refreshed=await f.service.refreshView('A',f.view.viewId,{kind:'agent',sessionId:'A',nativeCallId:'manual'});
 assert.equal(refreshed.bindings[0].state,'ready');assert.deepEqual(refreshed.bindings[0].payload,{control:'explicit refresh'});release();await pause();const next=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(next.state,'ready');assert.deepEqual(next.payload,{control:'explicit refresh'});assert.equal(calls,2);
});

test('never preparation failure clears only for a provably newer explicit same-owner success under current authorization',async t=>{
 let calls=0;const f=fixture(t,async request=>{if(++calls===1)throw Object.assign(new Error('controlled invalid input'),{code:'INVALID_INPUT'});return ok(request);});
 f.service.prepareViewData(f.view);await pause();const failed=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(failed.error?.retryPolicy,'never');assert.equal(failed.state,'failed');
 await pause(450);assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'failed');assert.equal(calls,1,'never failures do not automatically retry');
 const other=f.service.createView('B',{title:'Other owner',bindings:[binding]});await f.service.refreshView('B',other.viewId,{kind:'agent',sessionId:'B',nativeCallId:'other-session'});
 assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'failed','another session success cannot clear the failure');assert.equal(calls,2);
 const dataset=f.store.get<import('../../packages/app-presentation/src/types.ts').DatasetSnapshot>('datasets',failed.datasetId)!,owner=JSON.parse(dataset.preparationOwner!);owner[0]='A';owner[1]=f.view.viewId;owner[3]=f.view.source.buildId;owner[4]=999;
 f.store.put('datasets',failed.datasetId,{...dataset,preparationOwner:JSON.stringify(owner)});assert.equal(f.service.getData('A',f.view.viewId).bindings[0].state,'failed','another connection version is not recovery evidence');
 owner[4]=1;f.sessions.delete('A');f.store.put('datasets',failed.datasetId,{...dataset,revision:'2',preparationOwner:JSON.stringify(owner)});
 assert.equal(f.service.getData('A',f.view.viewId).bindings[0].error?.code,'APP_NOT_ACTIVE','a matching owner cannot bypass revoked admission');assert.equal(calls,2);
 f.sessions.add('A');const fresh=await f.service.refreshView('A',f.view.viewId,{kind:'agent',sessionId:'A',nativeCallId:'explicit-recovery'});assert.equal(fresh.bindings[0].state,'ready');assert.equal(fresh.bindings[0].error,undefined);assert.equal(fresh.bindings[0].preparation?.state,'ready');assert.equal(calls,3);
 const saved=f.store.get<import('../../packages/app-presentation/src/types.ts').DatasetSnapshot>('datasets',failed.datasetId)!;assert.ok(Number(saved.revision)>2);assert.equal(saved.preparationOwner,JSON.stringify(owner));
});

test('scheduler unavailable snapshots retain data without starting unauthorized closed-UI preparation, while frame access still checks admission',async t=>{
 let calls=0,offline=false;const f=fixture(t,async request=>{calls++;return offline?{status:'unavailable',invocationId:request.invocationId,traceId:request.traceId,error:{code:'OFFLINE',message:'controlled scheduler offline',retryPolicy:'read_retry'}}:ok(request);});
 await f.service.refreshBinding(binding,{kind:'scheduler',scheduleId:'closed-ui',runId:'first'});const first=f.service.getData('A',f.view.viewId).bindings[0];offline=true;await f.service.refreshBinding(binding,{kind:'scheduler',scheduleId:'closed-ui',runId:'second'});f.sessions.delete('A');
 const next=f.service.getData('A',f.view.viewId).bindings[0];assert.equal(next.state,'unavailable');assert.equal(next.freshness,'stale');assert.deepEqual(next.payload,first.payload);assert.equal(next.lastSuccessAt,first.lastSuccessAt);assert.equal(next.error?.code,'OFFLINE');assert.equal(next.preparation,undefined);await pause();assert.equal(calls,2,'snapshot observation must not dispatch session-owned prewarm');assert.throws(()=>f.service.getData('B',f.view.viewId),{code:'VIEW_NOT_OWNED'});
 const identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:f.view.viewId,buildId:f.view.source.buildId,frameInstanceId:'cached-frame'},host=f.service.createHost(identity,{clientFeatures:['dataTransferV1']});t.after(()=>host.dispose());
 const read=()=>host.handle({...identity,channel:'dsh.apps.component.v2',requestId:'snapshot',type:'extension',feature:'dataTransferV1',action:'prepare',params:{method:'getData'}}) as Promise<{error?:{code:string}}>;
 assert.equal((await read()).error?.code,'CONNECTION_NOT_BOUND');f.sessions.add('A');f.disable();assert.equal((await read()).error?.code,'CONNECTION_NOT_BOUND');assert.equal(calls,2);
});
