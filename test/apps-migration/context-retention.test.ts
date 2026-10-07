import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {gcDryRun,applyGC} from '../../packages/app-migration/src/maintenance.ts';
import type {DatasetSnapshot} from '../../packages/app-presentation/src/types.ts';
import type {BridgeIdentity,CapabilityDescriptor,CapabilityResult,ComponentAgentIntent,DatasetBinding,InvocationRequest,JsonValue,ResourceRef,SelectionEnvelope} from '../../packages/app-contracts/src/index.ts';

const old='2000-01-01T00:00:00.000Z';
function evidence(name:string,value:unknown):void {
  const directory=process.env.APPS_CONTEXT_EVIDENCE_DIR;
  if(directory){mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`${name}.json`),JSON.stringify({kind:'synthetic_fixture',status:'PASS',executedAt:new Date().toISOString(),evidence:value},null,2));}
}
function fixture(t:{after:(action:()=>void)=>void}) {
  const directory=mkdtempSync(join(tmpdir(),'apps-context-retention-')),database=join(directory,'apps.db'),project=join(directory,'project');
  mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'package.json'),'{}');writeFileSync(join(project,'source.tsx'),'export default function Component(){ return "retained"; }');writeFileSync(join(project,'dist','index.html'),'<div>Context build</div>');
  const sources=new SourceComponentStore(join(directory,'source-components')),calls:InvocationRequest[]=[];
  const descriptor:CapabilityDescriptor={capabilityId:'fixture.notes.list',version:'1.0.0',title:'Fixture notes',description:'Local deterministic read fixture',effect:'query',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const runtime={describe:(id:string)=>id===descriptor.capabilityId?descriptor:undefined,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{
    calls.push(request);const resource:ResourceRef={appId:'fixture',connectionId:'fixture-local',resourceType:'note',resourceId:'note-1',revision:String(calls.length)};
    return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:[{title:`Revision ${calls.length}`}],resources:[{...resource}]}};
  }};
  let store=new RuntimeStore(database),service=new AppsPresentationService({store,runtime,sources});
  const binding:DatasetBinding={bindingId:'notes',appId:'fixture',connectionId:'fixture-local',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
  const view=service.openSource('context-owner',project,{title:'Owned source',bindings:[binding]}),identity:BridgeIdentity={protocolVersion:'2.0',sessionId:'context-owner',viewId:view.viewId,buildId:view.source!.buildId,frameInstanceId:'frame-context'};
  t.after(()=>{store.close();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('apps-context-retention-'));rmSync(target,{recursive:true,force:true});});
  return {directory,database,sources,calls,view,identity,get store(){return store;},get service(){return service;},restart(){store.close();store=new RuntimeStore(database);service=new AppsPresentationService({store,runtime,sources});},async refresh(){return service.refreshView(identity.sessionId,view.viewId,{kind:'agent',sessionId:identity.sessionId,nativeCallId:`read-${calls.length}`});},selection():SelectionEnvelope{const data=service.getData(identity.sessionId,view.viewId).bindings[0];return {bindingId:data.bindingId,datasetRevision:data.revision!,resources:data.resources};}};
}

test('immutable context keeps its original payload/revision after refresh, pointer replacement, view deletion, GC and SQLite restart',async t=>{
  const f=fixture(t);await f.refresh();const selection=f.selection(),first=f.service.contexts.update(f.identity,'update-first',{expectedContextRevision:0,selections:[selection],summary:'Original note selection'}),original=f.service.contexts.history(f.identity.sessionId,first.snapshotId)!;
  assert.equal(f.calls.length,1,'context update must perform no business read or model action');
  assert.equal(original.evidence[0].revision,'1');assert.deepEqual(original.evidence[0].payload,{items:[{title:'Revision 1'}],resources:selection.resources});
  first.snapshot.summary='caller mutation';original.evidence[0].payload=null;
  assert.equal(f.service.contexts.history(f.identity.sessionId,first.snapshotId)!.snapshot.summary,'Original note selection');
  assert.throws(()=>f.store.put('component_contexts',`snapshot:${first.snapshotId}`,{}),/IMMUTABLE_EVIDENCE/);
  assert.throws(()=>f.store.delete('component_contexts',`snapshot:${first.snapshotId}`),/EVIDENCE_DELETE_FORBIDDEN/);
  await f.refresh();const second=f.service.contexts.update(f.identity,'update-second',{expectedContextRevision:1,selections:[f.selection()],summary:'Refreshed selection'});
  assert.notEqual(second.snapshotId,first.snapshotId);assert.equal(second.contextRevision,2);
  assert.deepEqual(f.service.contexts.history(f.identity.sessionId,first.snapshotId)!.evidence[0].payload,{items:[{title:'Revision 1'}],resources:selection.resources});
  const retry=f.service.contexts.update(f.identity,'update-first',{expectedContextRevision:0,selections:[selection],summary:'Original note selection'});
  assert.equal(retry.snapshotId,first.snapshotId);assert.equal(retry.contextRevision,1);
  assert.throws(()=>f.service.contexts.update(f.identity,'update-first',{expectedContextRevision:0,selections:[selection],summary:'Changed intent'}),{code:'IDEMPOTENCY_CONFLICT'});
  const id=second.snapshot.bindingEvidence[0].datasetId,dataset=f.store.get<DatasetSnapshot>('datasets',id)!;
  f.store.put('datasets',id,{...dataset,fetchedAt:old});f.store.put('builds',f.identity.buildId,{buildId:f.identity.buildId,createdAt:old});
  f.store.delete('views',f.view.viewId);f.store.delete('artifact_refs',`view:${f.view.viewId}:${f.identity.buildId}`);
  const orphan='a'.repeat(64);mkdirSync(join(f.directory,'source-components','builds',orphan));writeFileSync(join(f.directory,'source-components','builds',orphan,'orphan.txt'),'orphan');f.store.put('builds',orphan,{buildId:orphan,createdAt:old});f.store.put('datasets','dataset:v1:orphan',{datasetId:'dataset:v1:orphan',fetchedAt:old,payload:[]});
  const plan=gcDryRun(f.store,f.directory);assert.deepEqual(plan.candidates.map(row=>row.id).sort(),['dataset:v1:orphan',orphan].sort());applyGC(f.store,plan);
  assert.ok(existsSync(join(f.directory,'source-components','builds',f.identity.buildId)));assert.equal(f.sources.readFile(f.identity.buildId,'index.html')?.bytes.toString(),'<div>Context build</div>');
  const before=f.service.contexts.history(f.identity.sessionId,first.snapshotId)!;f.restart();
  assert.deepEqual(f.service.contexts.history(f.identity.sessionId,first.snapshotId),before);assert.equal(f.service.contexts.active(f.identity.sessionId).snapshot?.snapshotId,second.snapshotId);assert.equal(f.store.get<DatasetSnapshot>('datasets',id)?.revision,'2');assert.equal(f.calls.length,2,'GC/restart/history must not re-execute any data source');
  assert.throws(()=>f.service.contexts.history('other-session',first.snapshotId),{code:'CONTEXT_NOT_OWNED'});
  evidence('immutable-history',{snapshotIds:[first.snapshotId,second.snapshotId],firstRevision:before.evidence[0].revision,currentRevision:'2',retainedDataset:id,retainedBuild:f.identity.buildId,viewDeleted:true,sqliteRestart:true,fullOriginalPayloadPreserved:true,businessReads:f.calls.length,modelCalls:0,gc:plan});
});

test('explicit dataset artifact reference alone protects an old dataset from GC',t=>{
  const f=fixture(t),retained='dataset:v1:typed-reference-only',orphan='dataset:v1:unreferenced';
  for(const datasetId of [retained,orphan])f.store.put('datasets',datasetId,{datasetId,payload:[],fetchedAt:old});
  f.store.put('artifact_refs','context:synthetic:dataset',{ownerKind:'context',ownerId:'synthetic',targetKind:'dataset',targetId:retained});
  const plan=gcDryRun(f.store,f.directory);assert.deepEqual(plan.candidates.map(row=>row.id),[orphan]);applyGC(f.store,plan);assert.ok(f.store.get('datasets',retained));assert.equal(f.store.get('datasets',orphan),undefined);
  evidence('typed-dataset-reference',{retained,deleted:orphan,typedReferenceOnly:true});
});

test('a prepared native intent receives one dispatch grant across restart and unknown recovery never grants a resend',async t=>{
  const f=fixture(t);await f.refresh();const snapshot=f.service.contexts.update(f.identity,'context-for-native',{expectedContextRevision:0,selections:[f.selection()]});
  const input={text:'Review the selected local fixture note.',expectedContextRevision:1},prepared=f.service.contexts.prepare(f.identity,'native-once',input);
  assert.equal(prepared.status,'prepared');assert.equal(prepared.contextSnapshotId,snapshot.snapshotId);assert.equal(f.calls.length,1);
  assert.equal(prepared.content[0].text,input.text);assert.equal(JSON.parse(prepared.content[1].text).snapshot.snapshotId,snapshot.snapshotId);
  f.restart();assert.deepEqual(f.service.contexts.prepare(f.identity,'native-once',input),prepared);
  const grant=f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash);assert.equal(grant.dispatchGranted,true);assert.equal(grant.intent.status,'dispatching');
  assert.throws(()=>f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,'different-hash'),{code:'IDEMPOTENCY_CONFLICT'});
  f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'unknown',undefined,{code:'NATIVE_ACK_LOST'});f.restart();
  const retry=f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash);assert.equal(retry.dispatchGranted,false);assert.equal(retry.intent.status,'unknown');assert.equal(retry.intent.text,input.text);
  assert.throws(()=>f.service.contexts.prepare(f.identity,'native-once',{...input,text:'Different text'}),{code:'IDEMPOTENCY_CONFLICT'});
  const proof={accepted:true,durable:true,sessionId:f.identity.sessionId,requestId:prepared.requestId,eventSeq:7,eventType:'agent/inbox/spliced',contentHash:prepared.contentHash};
  for(const invalid of [{...proof,durable:false},{...proof,contentHash:'another-input'},{...proof,sessionId:'another-session'},{...proof,eventSeq:-1}])assert.throws(()=>f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'accepted',invalid),{code:'INVALID_NATIVE_RECEIPT'});
  assert.equal(f.service.contexts.intent(f.identity.sessionId,prepared.requestId)?.status,'unknown');
  const accepted=f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'accepted',proof);assert.equal(accepted.status,'accepted');f.restart();
  assert.deepEqual(f.service.contexts.intent(f.identity.sessionId,prepared.requestId),accepted);assert.equal(f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash).dispatchGranted,false);
  assert.throws(()=>f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'unknown'),{code:'INVALID_AGENT_REQUEST_TRANSITION'});
  accepted.text='returned object mutation';assert.equal(f.store.get<ComponentAgentIntent>('component_contexts',`agent:${f.identity.sessionId}:${prepared.requestId}`)?.text,input.text);
  assert.equal(f.calls.length,1);evidence('intent-once',{requestId:prepared.requestId,contextSnapshotId:snapshot.snapshotId,states:['prepared','dispatching','unknown','accepted'],dispatchGrants:1,sqliteRestarts:3,unknownResubmissionGranted:false,receiptKind:'synthetic_runtime_state_only',nativeHostCalls:0,modelCalls:0});
});

test('a confirmed failed native intent survives restart and cannot be dispatched or changed to accepted',async t=>{
  const f=fixture(t);await f.refresh();f.service.contexts.update(f.identity,'failed-context',{expectedContextRevision:0,selections:[f.selection()]});
  const prepared=f.service.contexts.prepare(f.identity,'native-failed',{text:'Explicit local fixture request.',expectedContextRevision:1});assert.equal(f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash).dispatchGranted,true);
  const failure=f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'failed',undefined,{code:'NATIVE_INPUT_REJECTED'});f.restart();
  assert.deepEqual(f.service.contexts.intent(f.identity.sessionId,prepared.requestId),failure);assert.equal(f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash).dispatchGranted,false);
  assert.throws(()=>f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'accepted',{accepted:true}),{code:'INVALID_AGENT_REQUEST_TRANSITION'});
  assert.equal(f.calls.length,1);evidence('failed-intent',{requestId:prepared.requestId,terminalState:'failed',sqliteRestart:true,repeatDispatchGranted:false,nativeHostCalls:0});
});

test('context change before dispatch blocks submission while retaining the original prepared intent and immutable evidence',async t=>{
  const f=fixture(t);await f.refresh();const first=f.service.contexts.update(f.identity,'before',{expectedContextRevision:0,selections:[f.selection()]}),prepared=f.service.contexts.prepare(f.identity,'stale-native',{text:'Review this exact context.',expectedContextRevision:1});
  const second=f.service.contexts.update(f.identity,'after',{expectedContextRevision:1,selections:[f.selection()],summary:'Later UI context'});
  f.restart();assert.throws(()=>f.service.contexts.dispatch(f.identity.sessionId,prepared.requestId,prepared.requestHash),{code:'CONTEXT_REVISION_CONFLICT'});
  assert.deepEqual(f.service.contexts.intent(f.identity.sessionId,prepared.requestId),prepared);assert.equal(f.service.contexts.history(f.identity.sessionId,first.snapshotId)?.snapshot.contextRevision,1);assert.equal(f.service.contexts.active(f.identity.sessionId).snapshot?.snapshotId,second.snapshotId);
  assert.throws(()=>f.service.contexts.receipt(f.identity.sessionId,prepared.requestId,prepared.requestHash,'accepted',{seq:1}),{code:'INVALID_AGENT_REQUEST_TRANSITION'});
  assert.equal(f.calls.length,1);evidence('stale-dispatch',{preparedSnapshot:first.snapshotId,activeSnapshot:second.snapshotId,originalIntentPreserved:true,dispatchGrants:0,nativeHostCalls:0});
});

test('a context reference created after GC planning invalidates the plan before deleting its build or dataset',t=>{
  const f=fixture(t),buildId='b'.repeat(64),datasetId='dataset:v1:late-context';mkdirSync(join(f.directory,'source-components','builds',buildId));f.store.put('builds',buildId,{buildId,createdAt:old});f.store.put('datasets',datasetId,{datasetId,fetchedAt:old});
  const plan=gcDryRun(f.store,f.directory);assert.ok(plan.candidates.some(row=>row.id===buildId));assert.ok(plan.candidates.some(row=>row.id===datasetId));
  f.store.put('component_contexts','snapshot:late-context',{kind:'snapshot',snapshot:{snapshotId:'late-context',buildId,bindingEvidence:[{datasetId,datasetRevision:'1'}]}});
  assert.throws(()=>applyGC(f.store,plan),/GC_PLAN_STALE/);const fresh=gcDryRun(f.store,f.directory);assert.equal(fresh.candidates.some(row=>row.id===buildId||row.id===datasetId),false);assert.ok(existsSync(join(f.directory,'source-components','builds',buildId)));assert.ok(f.store.get('datasets',datasetId));
  evidence('late-context-reference',{stalePlanRejected:true,buildId,datasetId,retained:true});
});
