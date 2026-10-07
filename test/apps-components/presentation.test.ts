import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {canonicalBinding,datasetId} from '../../packages/app-contracts/src/index.ts';
import type {BridgeIdentity,CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue,ResourceRef} from '../../packages/app-contracts/src/index.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';

function descriptor(appId:string,effect:'query'|'mutation'='query'):CapabilityDescriptor {
  return {capabilityId:`${appId}.list`,version:'1.0.0',title:'List resources',description:'Isolated resource fixture',effect,inputSchema:{type:'object',properties:{query:{type:'string'}},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:effect==='mutation'?'runtime_dedup':'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
}
const binding=(appId:string):DatasetBinding=>({bindingId:appId,appId,connectionId:`${appId}-local`,capabilityId:`${appId}.list`,capabilityMajor:1,input:{query:'all'},projection:[],refresh:{mode:'manual'}});
function setup(t:{after:(action:()=>void)=>void}) {
  const store=new RuntimeStore(':memory:');t.after(()=>store.close());
  const calls:InvocationRequest[]=[],offline=new Set<string>();let providerAvailable=true;
  const runtime={describe:(capabilityId:string)=>providerAvailable?descriptor(capabilityId.split('.')[0]):undefined,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{
    calls.push(request);
    if(offline.has(request.appId))return {invocationId:request.invocationId,traceId:request.traceId,status:'unavailable',error:{code:'BACKEND_OFFLINE',message:'Fixture backend is offline',retryPolicy:'read_retry'}};
    const resource:ResourceRef={appId:request.appId,connectionId:request.connectionId,resourceType:request.appId==='notes'?'note':'product',resourceId:`${request.appId}-record`};
    return {invocationId:request.invocationId,traceId:request.traceId,status:'ok',data:{items:[{title:'Isolated resource'}],resources:[{...resource}]} as JsonValue};
  }};
  const service=new AppsPresentationService({store,runtime});
  return {store,calls,offline,runtime,service,providerUnavailable:()=>{providerAvailable=false;}};
}
const source={kind:'agent' as const,sessionId:'session-a',nativeCallId:'call-a'};

test('bindings refresh independently and retain the failed backend last successful payload, revision and time',async t=>{
  const f=setup(t),view=f.service.createView('session-a',{title:'Product and note',bindings:[binding('hallmark'),binding('notes')]});
  assert.equal(f.store.list('components').length,0);
  const first=await f.service.refreshView('session-a',view.viewId,source);
  assert.equal(first.bindings.length,2);assert.equal(f.calls.length,2);
  f.offline.add('notes');const second=await f.service.refreshView('session-a',view.viewId,source);
  assert.equal(second.bindings[0].revision,'2');assert.equal(second.bindings[0].state,'ready');
  assert.equal(second.bindings[1].state,'unavailable');assert.equal(second.bindings[1].freshness,'stale');
  assert.equal(second.bindings[1].revision,first.bindings[1].revision);assert.equal(second.bindings[1].lastSuccessAt,first.bindings[1].lastSuccessAt);assert.deepEqual(second.bindings[1].payload,first.bindings[1].payload);
  assert.equal(second.bindings[1].error?.code,'BACKEND_OFFLINE');
  assert.ok(f.calls.every(call=>call.source.kind==='agent'&&call.appId===call.connectionId.split('-')[0]));
});
test('resource selection covers a Note and a product and refuses old dataset revisions or guessed identities',async t=>{
  const f=setup(t),view=f.service.createView('session-a',{title:'Selections',bindings:[binding('hallmark'),binding('notes')]});
  const data=await f.service.refreshView('session-a',view.viewId,source);
  for(const snapshot of data.bindings){const selected=f.service.validateSelection('session-a',view.viewId,{bindingId:snapshot.bindingId,datasetRevision:snapshot.revision!,resources:snapshot.resources});assert.equal(selected.resources[0].resourceType,snapshot.bindingId==='notes'?'note':'product');}
  await f.service.refreshView('session-a',view.viewId,source,['notes']);
  assert.throws(()=>f.service.validateSelection('session-a',view.viewId,{bindingId:'notes',datasetRevision:data.bindings[1].revision!,resources:data.bindings[1].resources}),{code:'SELECTION_STALE'});
  const current=f.service.getData('session-a',view.viewId).bindings[1];
  assert.throws(()=>f.service.validateSelection('session-a',view.viewId,{bindingId:'notes',datasetRevision:current.revision!,resources:[{...current.resources[0],resourceId:'same-name-in-another-app'}]}),{code:'SELECTION_STALE'});
  assert.throws(()=>f.service.getData('session-b',view.viewId),{code:'VIEW_NOT_OWNED'});
});
test('canonical dataset identity is retained with the full binding and malformed or mutation bindings are rejected',async t=>{
  const f=setup(t),input=binding('notes'),view=f.service.createView('session-a',{title:'Canonical data',bindings:[input]});
  const id=datasetId(input);assert.match(id,/^dataset:v1:[a-f0-9]{64}$/);
  assert.equal(datasetId({...input,input:{query:'all'}}),id);assert.notEqual(datasetId({...input,connectionId:'other'}),id);assert.notEqual(datasetId({...input,projection:['title']}),id);
  await f.service.refreshView('session-a',view.viewId,source);
  assert.deepEqual(f.store.get<{canonicalBinding:unknown}>('datasets',id)?.canonicalBinding,canonicalBinding(input));
  assert.throws(()=>f.service.createView('session-a',{title:'Unknown fields',bindings:[{...input,input:{guessed:'value'}}]}),{code:'INVALID_BINDING'});
  f.runtime.describe=()=>descriptor('notes','mutation');
  assert.throws(()=>f.service.createView('session-a',{title:'Unsafe data source',bindings:[input]}),{code:'QUERY_NOT_READ_ONLY'});
});
test('offline saved designs open with snapshots and static component CAS/history create new revisions',async t=>{
  const f=setup(t),view=f.service.createView('session-a',{title:'First design',design:{layout:'arbitrary'},bindings:[binding('notes')]});
  await f.service.refreshView('session-a',view.viewId,source);
  const saved=f.service.saveComponent('session-a',view.viewId,'Save this design',{mode:'save_as'});assert.notEqual(saved.componentId,view.viewId);
  const edit=f.service.openComponent('session-a',saved.componentId);f.service.createView('session-a',{viewId:edit.viewId,title:'Second design',design:{layout:'new'}});
  const second=f.service.saveComponent('session-a',edit.viewId,'Update the design',{mode:'update',componentId:saved.componentId,expectedRevision:edit.baseRevision});
  assert.equal(second.revision,2);assert.throws(()=>f.service.saveComponent('session-a',edit.viewId,'Update',{mode:'update',componentId:saved.componentId,expectedRevision:1}),{code:'COMPONENT_CONFLICT'});
  f.providerUnavailable();const historical=f.service.openComponent('session-a',saved.componentId,{revision:1});assert.equal(historical.title,'First design');assert.equal(historical.baseRevision,2);
  const data=await f.service.refreshView('session-a',historical.viewId,source);assert.equal(data.bindings[0].freshness,'stale');assert.ok(data.bindings[0].payload);
  const reverted=f.service.saveComponent('session-a',historical.viewId,'Restore first design as a new revision',{mode:'update',componentId:saved.componentId,expectedRevision:historical.baseRevision});
  assert.equal(reverted.revision,3);assert.deepEqual(f.service.componentVersions(saved.componentId).map(component=>component.title),['First design','Second design','First design']);
});
test('source build A survives view B updates, saves include immutable per-file hashes and historical checkout restores lockfile',t=>{
  const f=setup(t),directory=mkdtempSync(join(tmpdir(),'apps-components-')),project=join(directory,'project'),sources=new SourceComponentStore(join(directory,'archive'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));mkdirSync(join(project,'dist'),{recursive:true});mkdirSync(join(project,'src'));
  writeFileSync(join(project,'package-lock.json'),'{}');writeFileSync(join(project,'src','Component.tsx'),'export const Component = () => <button>Local state</button>;');writeFileSync(join(project,'dist','index.html'),'<button>Build A</button>');
  const service=new AppsPresentationService({store:f.store,runtime:f.runtime,sources}),first=service.openSource('session-a',project,{title:'Build A'}),other=service.openSource('session-a',project,{title:'Other view'}),saved=service.saveComponent('session-a',first.viewId,'Save source',{mode:'save_as'});
  writeFileSync(join(project,'dist','index.html'),'<button>Build B</button>');const next=service.openSource('session-a',project,{title:'Build B',viewId:first.viewId});
  assert.notEqual(first.source!.buildId,next.source!.buildId);assert.equal(service.getView(other.viewId)?.source?.buildId,first.source!.buildId);assert.equal(sources.readFile(first.source!.buildId,'index.html')?.bytes.toString(),'<button>Build A</button>');
  const manifest=sources.manifest(first.source!.buildId)!;assert.equal(manifest.manifestVersion,2);assert.ok(manifest.fileManifest!.every(file=>Number.isSafeInteger(file.size)&&/^[a-f0-9]{64}$/.test(file.sha256)));assert.deepEqual(sources.verify(first.source!.buildId),{valid:true,errors:[]});
  const restored=service.openComponent('session-a',saved.componentId);assert.equal(readFileSync(join(restored.source!.directory,'package-lock.json'),'utf8'),'{}');
  rmSync(join(project,'dist'),{recursive:true});assert.throws(()=>service.openSource('session-a',project,{viewId:first.viewId}),{code:'SOURCE_BUILD_REQUIRED'});assert.equal(service.getView(first.viewId)?.source?.buildId,next.source!.buildId);
});
test('component host invokes one explicitly bound capability and session methods report unsupported without a submission',async t=>{
  const f=setup(t),view=f.service.createView('session-a',{title:'Action panel',bindings:[binding('notes')]});
  const identity:BridgeIdentity={protocolVersion:'2.0',sessionId:'session-a',viewId:view.viewId,buildId:'source-fixture',frameInstanceId:'frame-a'},host=f.service.createHost(identity);
  assert.ok(host.hello().supportedMethods.includes('invokeCapability'));assert.ok(!host.hello().supportedMethods.includes('updateContext'));assert.ok(!host.hello().supportedMethods.includes('requestAgent'));
  const request=(method:string,params:unknown=null)=>({...identity,channel:COMPONENT_CHANNEL,requestId:'request-a',method,params});
  for(const [method,params] of [['updateContext',{expectedContextRevision:0,selections:[]}],['requestAgent',{text:'Analyze',expectedContextRevision:0}]])assert.equal((await host.handle(request(method as string,params)) as {error:{code:string}}).error.code,'UNSUPPORTED_HOST_CAPABILITY');
  assert.equal(f.calls.length,0);
  const response=await host.handle(request('invokeCapability',{appId:'notes',connectionId:'notes-local',capabilityId:'notes.list',capabilityVersion:'1.0.0',input:{query:'all'},deadlineAt:new Date(Date.now()+1000).toISOString()}));
  assert.equal((response as unknown as {result:{status:string}}).result.status,'ok');assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].source,{kind:'component',sessionId:'session-a',viewId:view.viewId,frameInstanceId:'frame-a'});
  assert.equal((await host.handle(request('invokeCapability',{appId:'notes',connectionId:'unbound',capabilityId:'notes.list'})) as {error:{code:string}}).error.code,'CONNECTION_NOT_BOUND');assert.equal(f.calls.length,1);
});
