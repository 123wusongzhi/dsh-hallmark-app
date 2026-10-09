import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../packages/app-presentation/src/authoring.ts';
import {APP_AUTHORING_DESCRIPTORS} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import type {AuthoringAttempt,AuthoringDraft,AuthoringView,BuildExecutionEvidence,BuildReceipt,DisplayFrameAuthorizationInput,FrameAuthorizationInput,PreviewReceipt,PreviewValidationEvidence,RenderReadyInput,StartMountInput,UiStateSnapshot,ViewPublication} from '../../packages/app-presentation/src/authoring-types.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsRuntime} from '../../packages/app-runtime/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue,ResourceRef} from '../../packages/app-contracts/src/index.ts';

const session='original-session-a';
const assertions=[{id:'unit-coverage',required:true,expected:'Fixture metadata passes',actual:'Fixture metadata passes',status:'PASS' as const,evidenceRefs:[]}];
const descriptor:CapabilityDescriptor={capabilityId:'notes.list',version:'1.0.0',title:'Notes fixture',description:'Read-only test data',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const binding:DatasetBinding={bindingId:'notes',appId:'notes',connectionId:'notes-test',capabilityId:'notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
type BeginResult=ReturnType<AppsAuthoringService['begin']>;
function setup(t:{after:(action:()=>void)=>void},options:{noBuildValidator?:boolean;noPreviewValidator?:boolean;clock?:()=>Date;maxUiStateBytes?:number}={}){
  const directory=mkdtempSync(join(tmpdir(),'apps-authoring-')),store=new RuntimeStore(':memory:'),sources=new SourceComponentStore(join(directory,'sources')),runner=new AuthoringEvidenceRunner(join(directory,'evidence'));
  t.after(()=>{store.close();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'apps-authoring-'))));rmSync(directory,{recursive:true,force:true});});
  let resources:ResourceRef[]=['a','b'].map(resourceId=>({appId:'notes',connectionId:'notes-test',resourceType:'note',resourceId}));
  const runtime={describe:()=>descriptor,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{resources:structuredClone(resources)} as unknown as JsonValue})};
  const presentation=new AppsPresentationService({store,sources,runtime});
  const serviceOptions={store,sources,presentation,evidenceRoot:runner.root,...(options.clock?{clock:options.clock}:{}),...(options.maxUiStateBytes?{maxUiStateBytes:options.maxUiStateBytes}:{}),
    ...(!options.noBuildValidator?{validateBuildEvidence:(ref:Parameters<typeof runner.verifyBuild>[0])=>runner.verifyBuild(ref,sources,{allowFailure:true})}:{}),
    // These are backend state-machine fixtures, not browser/SOURCE_EXEC verification.
    ...(!options.noPreviewValidator?{validatePreviewEvidence:(ref:Parameters<typeof runner.readReport>[0])=>runner.readReport<PreviewValidationEvidence>(ref)}:{}),};
  const authoring=new AppsAuthoringService(serviceOptions);
  return {directory,store,sources,runner,runtime,presentation,authoring,serviceOptions,resources,replaceResources:(value:ResourceRef[])=>{resources=value;}};
}
function project(begin:BeginResult,title='First build',extra=''){
  const directory=begin.draft.workspacePath;mkdirSync(join(directory,'src'),{recursive:true});
  writeFileSync(join(directory,'package-lock.json'),'{}');writeFileSync(join(directory,'package.json'),'{}');
  writeFileSync(join(directory,'src','Component.tsx'),`export const title=${JSON.stringify(title)};`);
  writeFileSync(join(directory,'build.mjs'),`import {mkdirSync,writeFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html',${JSON.stringify(`<button>${title}</button>`)});${extra}`);
}
async function build(f:ReturnType<typeof setup>,begin:BeginResult){
  const executed=await f.runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.sources});
  const receipt=await f.authoring.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef});
  return {...executed,receipt};
}
function unitPreview(f:ReturnType<typeof setup>,begin:BeginResult,receipt:BuildReceipt,change?:(value:PreviewValidationEvidence)=>void){
  const screenshotPath=join(f.runner.root,`fixture-${begin.attempt.attemptId}.png`);
  // Only a hashed evidence-file fixture. This deliberately does not claim actual viewport captures.
  writeFileSync(screenshotPath,Buffer.from('backend-fixture-evidence'));
  const screenshot=evidenceFile(screenshotPath),at=new Date().toISOString();
  const report:PreviewValidationEvidence={schemaVersion:1,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,buildId:receipt.archiveBuildId!,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'backend-unit-fixture/1',startedAt:at,finishedAt:at,viewportResults:[420,1040].map(width=>({id:`fixture-${width}`,contentWidthCssPx:width,heightCssPx:800,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['unit-coverage']})),assertionResults:structuredClone(assertions),verdict:'PASS'};
  change?.(report);return {report,reportRef:f.runner.writeReport('preview',report)};
}
async function preview(f:ReturnType<typeof setup>,begin:BeginResult,receipt:BuildReceipt,change?:(value:PreviewValidationEvidence)=>void){
  const evidence=unitPreview(f,begin,receipt,change),result=await f.authoring.recordPreview(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,reportRef:evidence.reportRef});return {...evidence,receipt:result};
}
function openInput(publication:ViewPublication):StartMountInput {return {viewId:publication.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,expectedViewRevision:publication.expectedViewRevision};}
async function prepared(f:ReturnType<typeof setup>,begin=f.authoring.begin(session,{mode:'new'}),title='First build',open=true){
  project(begin,title);const built=await build(f,begin),tested=await preview(f,begin,built.receipt);
  let publication=f.authoring.publish(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:built.receipt.archiveBuildId!,buildReceiptId:built.receipt.receiptId,previewReceiptId:tested.receipt.receiptId});
  if(open)publication=f.authoring.startMount(session,openInput(publication));
  const identity:FrameAuthorizationInput={publicationId:publication.publicationId,attemptId:begin.attempt.attemptId,attemptEpoch:begin.attempt.epoch,buildId:publication.candidateBuildId,frameInstanceId:`frame-${begin.attempt.attemptId}`,documentNonce:`nonce-${begin.attempt.attemptId}`};
  if(open)f.authoring.authorizeFrame(session,identity);const ready:RenderReadyInput={...identity,viewId:begin.view.viewId,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:structuredClone(assertions)}};
  return {begin,built,tested,publication,identity,ready};
}
function displayFrame(publication:ViewPublication,display:{displayId:string;generation:number},suffix:string):DisplayFrameAuthorizationInput {
 return {publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,viewId:publication.viewId,buildId:publication.candidateBuildId,displayId:display.displayId,displayGeneration:display.generation,frameInstanceId:'display-frame-'+suffix,documentNonce:'display-nonce-'+suffix};
}

test('independent display retries preserve one verified build and retire old documents without advancing authoring',async t=>{
 let now=new Date('2026-10-07T00:00:00.000Z');const f=setup(t,{clock:()=>now}),candidate=await prepared(f,undefined,'Reopen',false),target=openInput(candidate.publication);
 now=new Date(now.getTime()+120000);
 const first=f.authoring.openDisplay(session,{...target,displayId:'display-first'});assert.equal(first.display.state,'opening');assert.equal(first.publication.state,'prepared');assert.equal(first.publication.readyDeadlineAt,null);
 assert.deepEqual(f.authoring.openDisplay(session,{...target,displayId:'display-first'}),first);assert.equal(f.authoring.inspect(session,{publicationId:target.publicationId}).displays.length,1);
 const firstFrame=displayFrame(first.publication,first.display,'first');f.authoring.authorizeDisplayFrame(session,firstFrame);
 assert.throws(()=>f.authoring.authorizeDisplayFrame(session,{...firstFrame,documentNonce:'another-document'}),{code:'BRIDGE_IDENTITY_STALE'});
 assert.throws(()=>f.authoring.confirmDisplayReady(session,{...candidate.ready,...firstFrame,checks:{...candidate.ready.checks,dataRead:false}}),{code:'FRAME_RUNTIME_ERROR'});
 const failed=f.authoring.reportDisplayError(session,{...firstFrame,error:{phase:'script',code:'COMPONENT_SCRIPT_ERROR',message:'Actual component exception'}});assert.equal(failed.state,'failed');assert.equal(failed.errors[0].message,'Actual component exception');
 const inspected=f.authoring.inspect(session,{publicationId:target.publicationId});assert.equal(inspected.latestDisplay?.state,'failed');assert.equal(inspected.attempt.state,'publish_ready');assert.equal(inspected.publication?.state,'prepared');assert.equal(inspected.view.viewRevision,1);
 const second=f.authoring.openDisplay(session,{...target,displayId:'display-second'}),secondFrame=displayFrame(second.publication,second.display,'second');assert.equal(second.display.generation,2);f.authoring.authorizeDisplayFrame(session,secondFrame);
 assert.equal(f.authoring.acceptsDisplayFrame({...firstFrame,protocolVersion:'2.0',sessionId:session}),false);assert.throws(()=>f.authoring.confirmDisplayReady(session,{...candidate.ready,...firstFrame}),{code:'BRIDGE_IDENTITY_STALE'});
 for(const assertionResults of [[],[{...assertions[0],status:'FAIL' as const}], [{...assertions[0],required:false}]]){const before=canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')});assert.throws(()=>f.authoring.confirmDisplayReady(session,{...candidate.ready,...secondFrame,checks:{...candidate.ready.checks,assertionResults}}),{code:'FRAME_RUNTIME_ERROR'});assert.equal(canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')}),before);}
 const confirmed=f.authoring.confirmDisplayReady(session,{...candidate.ready,...secondFrame});assert.equal(confirmed.display.state,'ready');assert.equal(confirmed.view.viewRevision,2);assert.equal(confirmed.view.source?.buildId,target.buildId);
 assert.equal(f.authoring.confirmDisplayReady(session,{...candidate.ready,...secondFrame}).view.viewRevision,2);
 const third=f.authoring.openDisplay(session,{...target,displayId:'display-third'}),thirdFrame=displayFrame(third.publication,third.display,'third');f.authoring.authorizeDisplayFrame(session,thirdFrame);
 assert.equal(f.authoring.inspect(session,{publicationId:target.publicationId}).displays[1].state,'retired');assert.equal(f.authoring.confirmDisplayReady(session,{...candidate.ready,...thirdFrame}).view.viewRevision,2);
 assert.equal(f.store.list('build_receipts').length,1);assert.equal(f.store.list('preview_receipts').length,1);assert.equal(f.store.list('view_publications').length,1);assert.equal(f.store.list('components').length,0);
 assert.equal(f.authoring.saveComponent(session,{viewId:target.viewId,expectedViewRevision:2,userRequest:'Save this displayed component',mode:'save_as'}).view.source?.buildId,target.buildId);
});

test('a retired display document releases its slot for exactly one new document and never displaces a live one',async t=>{
 const f=setup(t),candidate=await prepared(f,undefined,'Remount',false),target=openInput(candidate.publication);
 const opened=f.authoring.openDisplay(session,{...target,displayId:'display-remount'}),frame=(suffix:string)=>displayFrame(opened.publication,opened.display,suffix);
 const [first,second,third]=[frame('first'),frame('second'),frame('third')];
 const accepts=(value:DisplayFrameAuthorizationInput)=>f.authoring.acceptsDisplayFrame({...value,protocolVersion:'2.0',sessionId:session});
 const release=(value:DisplayFrameAuthorizationInput,sessionId=session)=>f.authoring.releaseDisplayFrame(sessionId,{displayId:value.displayId,frameInstanceId:value.frameInstanceId,documentNonce:value.documentNonce});
 f.authoring.authorizeDisplayFrame(session,first);
 // The live document keeps the slot, and releases that do not name it change nothing.
 assert.throws(()=>f.authoring.authorizeDisplayFrame(session,second),{code:'BRIDGE_IDENTITY_STALE'});
 assert.equal(release(second),false);assert.equal(release({...first,documentNonce:'another-document'}),false);assert.equal(release(first,'other-session'),false);
 assert.throws(()=>f.authoring.authorizeDisplayFrame(session,second),{code:'BRIDGE_IDENTITY_STALE'});assert.equal(accepts(first),true);
 // Closing that document releases the slot for one replacement; the retired document cannot come back or release its successor.
 assert.equal(release(first),true);assert.equal(accepts(first),false);
 f.authoring.authorizeDisplayFrame(session,second);assert.equal(accepts(second),true);assert.equal(accepts(first),false);
 assert.equal(release(first),false);assert.equal(accepts(second),true);
 assert.throws(()=>f.authoring.authorizeDisplayFrame(session,third),{code:'BRIDGE_IDENTITY_STALE'});assert.throws(()=>f.authoring.authorizeDisplayFrame(session,first),{code:'BRIDGE_IDENTITY_STALE'});
 // Readiness is confirmed once; a later remount of the same ready display reconfirms without advancing the view.
 const confirmed=f.authoring.confirmDisplayReady(session,{...candidate.ready,...second});assert.equal(confirmed.display.state,'ready');
 assert.equal(release(second),true);f.authoring.authorizeDisplayFrame(session,third);assert.throws(()=>f.authoring.confirmDisplayReady(session,{...candidate.ready,...second}),{code:'BRIDGE_IDENTITY_STALE'});
 const again=f.authoring.confirmDisplayReady(session,{...candidate.ready,...third});assert.equal(again.display.state,'ready');assert.equal(again.display.generation,1);assert.equal(again.view.viewRevision,confirmed.view.viewRevision);
 const inspected=f.authoring.inspect(session,{publicationId:target.publicationId});assert.equal(inspected.displays.length,1);assert.equal(inspected.publication?.state,'mounted');
});

test('fixed historical displays keep snapshot data, context and resource selection without replacing the current build',async t=>{
 const f=setup(t);f.presentation.authoring=f.authoring;
 const begin=f.authoring.begin(session,{mode:'new',bindings:[binding]}),first=await prepared(f,begin,'P1',false);await f.presentation.refreshView(session,begin.view.viewId,{kind:'agent',sessionId:session,nativeCallId:'initial'});
 const openAndGrant=(publication:ViewPublication,id:string)=>{const opened=f.authoring.openDisplay(session,{...openInput(publication),displayId:id}),frame=displayFrame(publication,opened.display,id);f.authoring.authorizeDisplayFrame(session,frame);return {opened,frame,identity:{...frame,protocolVersion:'2.0' as const,sessionId:session}};};
 const d1=openAndGrant(first.publication,'P1-first');f.authoring.confirmDisplayReady(session,{...first.ready,...d1.frame});const legacyUi=f.authoring.exportUiState(session,{viewId:begin.view.viewId,sourceBuildId:first.publication.candidateBuildId,uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'Legacy P1'},selectionEvidence:[]});
 const edit=f.authoring.begin(session,{mode:'edit',viewId:begin.view.viewId});f.presentation.createView(session,{viewId:begin.view.viewId,title:'P2',bindings:[]});const second=await prepared(f,edit,'P2',false),d2=openAndGrant(second.publication,'P2-first');f.authoring.confirmDisplayReady(session,{...second.ready,...d2.frame});
 const current=f.authoring.inspect(session,{publicationId:second.publication.publicationId}).view;assert.equal(current.viewRevision,3);assert.equal(f.presentation.getData(session,current.viewId).bindings.length,0);const p2Ui=f.authoring.exportUiState(session,{viewId:current.viewId,sourceBuildId:second.publication.candidateBuildId,uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'P2 state'},selectionEvidence:[]},d2.identity);
 const historical=openAndGrant(first.publication,'P1-reopen'),bridgeIdentity={protocolVersion:'2.0' as const,sessionId:session,viewId:historical.frame.viewId,buildId:historical.frame.buildId,frameInstanceId:historical.frame.frameInstanceId},host=f.presentation.createHost(bridgeIdentity,{candidate:historical.identity,clientFeatures:['renderReadyV1','uiStateV1'],attachSelection:(_identity,selection)=>({status:'validated',selection:selection as unknown as JsonValue})});t.after(()=>host.dispose());
 const request=(method:string,params:unknown,id=method)=>({...bridgeIdentity,channel:'dsh.apps.component.v2',requestId:id,method,params});
 const data=await host.handle(request('getData',null));const noteData=(data as unknown as {result:{bindings:{bindingId:string;datasetId:string;revision:string;resources:ResourceRef[]}[]}}).result.bindings[0];assert.equal(noteData.bindingId,'notes');assert.equal(noteData.resources[0].connectionId,'notes-test');
 const context=await host.handle(request('getContext',null));assert.equal((context as unknown as {result:{buildId:string;publication:{displayId:string}}}).result.buildId,first.publication.candidateBuildId);assert.equal((context as unknown as {result:{publication:{displayId:string}}}).result.publication.displayId,historical.opened.display.displayId);
 const selection={bindingId:'notes',datasetRevision:noteData.revision,resources:[noteData.resources[0]]};const selected=await host.handle(request('attachSelection',selection));assert.equal((selected as unknown as {result:{status:string}}).result.status,'validated');
 const stateRequest=(action:string,params:unknown,id=action)=>({...bridgeIdentity,channel:'dsh.apps.component.v2',type:'extension',feature:'uiStateV1',action,requestId:'state-'+id,params});const restoredLegacy=await host.handle(stateRequest('read',{uiStateSchemaVersion:1}));assert.equal((restoredLegacy as unknown as {result:{status:string}}).result.status,'restored');assert.deepEqual((restoredLegacy as unknown as {result:{snapshot:{value:unknown}}}).result.snapshot.value,{search:'Legacy P1'});const written=await host.handle(stateRequest('write',{uiStateSchemaVersion:1,expectedStateRevision:legacyUi.stateRevision,value:{search:'P1 state'},selectionEvidence:[{...selection,datasetId:noteData.datasetId}]}));assert.equal((written as unknown as {result:{sourceBuildId:string}}).result.sourceBuildId,first.publication.candidateBuildId);assert.equal((written as unknown as {result:{stateRevision:number}}).result.stateRevision,legacyUi.stateRevision+1);assert.deepEqual(f.store.get('view_ui_states',canonicalJson([session,current.viewId])),legacyUi);assert.deepEqual(f.store.get('view_ui_states',canonicalJson([session,current.viewId,second.publication.candidateBuildId])),p2Ui);
 const updated=await host.handle(request('updateContext',{expectedContextRevision:0,selections:[selection]},'historical-context'));assert.equal((updated as unknown as {result:{snapshot:{buildId:string;bindingEvidence:{datasetId:string}[]}}}).result.snapshot.buildId,first.publication.candidateBuildId);assert.equal((updated as unknown as {result:{snapshot:{bindingEvidence:{datasetId:string}[]}}}).result.snapshot.bindingEvidence[0].datasetId,noteData.datasetId);
 const ready=f.authoring.confirmDisplayReady(session,{...first.ready,...historical.frame});assert.equal(ready.view.source?.buildId,first.publication.candidateBuildId);assert.equal(f.presentation.getView(current.viewId)?.source?.buildId,second.publication.candidateBuildId);assert.equal(f.presentation.getView(current.viewId)?.viewRevision,3);
 await f.presentation.refreshBinding(begin.view.bindings[0],{kind:'agent',sessionId:session,nativeCallId:'new-data'});const stale=await host.handle(request('attachSelection',selection,'stale-selection'));assert.equal((stale as {error:{code:string}}).error.code,'SELECTION_STALE');const restored=await host.handle(stateRequest('read',{uiStateSchemaVersion:1},'prune'));assert.equal((restored as unknown as {result:{removedSelections:unknown[]}}).result.removedSelections.length,1);assert.deepEqual((restored as unknown as {result:{snapshot:{value:unknown}}}).result.snapshot.value,{search:'P1 state'});assert.deepEqual(f.store.get('view_ui_states',canonicalJson([session,current.viewId,second.publication.candidateBuildId])),p2Ui);
});

test('display target or archive rejection cannot retire a valid iframe or create an unauthorized display',async t=>{
 const f=setup(t),candidate=await prepared(f,undefined,'Protected',false),target=openInput(candidate.publication),opened=f.authoring.openDisplay(session,{...target,displayId:'protected'}),frame=displayFrame(candidate.publication,opened.display,'protected');f.authoring.authorizeDisplayFrame(session,frame);
 const before=canonicalJson(f.store.list('provider_records'));
 assert.throws(()=>f.authoring.openDisplay('other-session',{...target,displayId:'foreign'}),{code:'VIEW_NOT_OWNED'});assert.throws(()=>f.authoring.openDisplay(session,{...target,buildId:'f'.repeat(64),displayId:'wrong-build'}),{code:'PUBLICATION_TARGET_MISMATCH'});assert.throws(()=>f.authoring.reportDisplayError(session,{...frame,displayGeneration:999,error:{phase:'render',code:'STALE',message:'stale report'}}),{code:'BRIDGE_IDENTITY_STALE'});
 assert.equal(canonicalJson(f.store.list('provider_records')),before);assert.equal(f.authoring.acceptsDisplayFrame({...frame,protocolVersion:'2.0',sessionId:session}),true);
 const archived=join(f.sources.directory,'builds',target.buildId,'project','dist','index.html');writeFileSync(archived,'changed verified archive');assert.throws(()=>f.authoring.openDisplay(session,{...target,displayId:'bad-archive'}),{code:'BUILD_EVIDENCE_INVALID'});assert.equal(canonicalJson(f.store.list('provider_records')),before);
});

test('a legacy failed mount reopens the same archive while cancelled or superseded displays remain fenced',async t=>{
 const f=setup(t),failed=await prepared(f),publication=f.authoring.failMount(session,failed.publication.publicationId,'Legacy document failed to mount'),opened=f.authoring.openDisplay(session,{...openInput(publication),displayId:'legacy-failure-reopened'}),frame=displayFrame(publication,opened.display,'legacy-retry');f.authoring.authorizeDisplayFrame(session,frame);const ready=f.authoring.confirmDisplayReady(session,{...failed.ready,...frame});assert.equal(ready.publication.state,'mounted');assert.equal(ready.view.source?.buildId,failed.built.receipt.archiveBuildId);assert.equal(f.store.list('build_receipts').length,1);assert.equal(f.store.list('preview_receipts').length,1);
 const pending=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:publication.viewId}),'New candidate',false),candidate=f.authoring.openDisplay(session,{...openInput(pending.publication),displayId:'cancelled-display'}),candidateFrame=displayFrame(pending.publication,candidate.display,'cancelled');f.authoring.authorizeDisplayFrame(session,candidateFrame);f.authoring.cancel(session,{attemptId:pending.publication.attemptId,expectedEpoch:pending.publication.attemptEpoch,reason:'Explicit cancellation'});
 const before=canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')});assert.equal(f.authoring.acceptsDisplayFrame({...candidateFrame,protocolVersion:'2.0',sessionId:session}),false);assert.throws(()=>f.authoring.confirmDisplayReady(session,{...pending.ready,...candidateFrame}),{code:'PUBLICATION_UNAVAILABLE'});assert.throws(()=>f.authoring.openDisplay(session,{...openInput(pending.publication),displayId:'revive-cancelled'}),{code:'PUBLICATION_UNAVAILABLE'});assert.equal(canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')}),before);assert.equal(f.presentation.getView(publication.viewId)?.source?.buildId,ready.view.source?.buildId);
});

test('begin is explicitly idempotent across native invocation IDs and isolates original session workspaces',t=>{
  const f=setup(t),first=f.authoring.begin(session,{mode:'new',attemptId:'stable-attempt',invocationId:'native-1'}),replayed=f.authoring.begin(session,{mode:'new',attemptId:'stable-attempt',invocationId:'native-2'});
  assert.equal(replayed.draft.draftId,first.draft.draftId);assert.deepEqual(replayed.attempt.invocationRefs,['native-1','native-2']);assert.equal(f.store.list('views').length,1);
  const other=f.authoring.begin('original-session-b',{mode:'new'});assert.notEqual(other.draft.workspacePath,first.draft.workspacePath);
  assert.throws(()=>f.authoring.inspect('original-session-b',{attemptId:first.attempt.attemptId}),{code:'VIEW_NOT_OWNED'});
  assert.throws(()=>f.authoring.begin(session,{mode:'new',attemptId:'stable-attempt',title:'Different'}),{code:'AUTHORING_REQUEST_CONFLICT'});
  writeFileSync(join(other.draft.workspacePath,'keep.txt'),'work in progress');const views=f.store.list('views').length;
  assert.throws(()=>f.authoring.begin(session,{mode:'new',workspacePath:other.draft.workspacePath}),{code:'WORKSPACE_NOT_EMPTY'});assert.equal(f.store.list('views').length,views);
});

test('actual subprocess BuildReceipt records exact template fields without publishing or saving',async t=>{
  const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin);const result=await build(f,begin);
  assert.equal(result.receipt.verdict,'PASS');assert.deepEqual(result.receipt.command,[process.execPath,'build.mjs']);assert.equal(result.receipt.inputUnchanged,true);assert.ok(result.receipt.fileManifestRef);
  assert.ok(f.sources.verify(result.receipt.archiveBuildId!).valid);assert.equal(f.presentation.getView(begin.view.viewId)?.source,undefined);assert.equal(f.store.list('components').length,0);
  assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',begin.attempt.attemptId)?.state,'previewing');
  assert.deepEqual(await f.authoring.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:result.reportRef}),result.receipt);
});

test('missing validators and caller-authored JSON cannot manufacture a PASS build',async t=>{
  const f=setup(t,{noBuildValidator:true}),begin=f.authoring.begin(session,{mode:'new'});project(begin);const executed=await f.runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.sources});
  await assert.rejects(f.authoring.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef}),{code:'BUILD_EVIDENCE_INVALID'});assert.equal(f.store.list('build_receipts').length,0);
  const f2=setup(t),next=f2.authoring.begin(session,{mode:'new'});project(next);const manual=join(f2.runner.root,'manual.json');writeFileSync(manual,JSON.stringify({report:{verdict:'PASS'},signature:'00'}));
  await assert.rejects(f2.authoring.recordBuild(session,{attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,reportRef:evidenceFile(manual)}),/EVIDENCE_RUNNER_ATTESTATION_INVALID/);assert.equal(f2.store.list('build_receipts').length,0);
});

test('nonzero command and changed build inputs persist FAIL receipts and preserve an empty canvas',async t=>{
  for(const extra of ['process.exitCode=7;','writeFileSync("src/changed.txt","changed during build");']){
    const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin,'Bad build',extra);const result=await build(f,begin);
    assert.equal(result.receipt.verdict,'FAIL');assert.equal(result.receipt.archiveBuildId,null);assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',begin.attempt.attemptId)?.state,'build_failed');
    assert.equal(f.presentation.getView(begin.view.viewId)?.source,undefined);assert.equal(f.store.list('components').length,0);
  }
});

test('preview gates reject missing required interactions, invalid width coverage and changed screenshot bytes',async t=>{
  for(const change of [(value:PreviewValidationEvidence)=>{value.assertionResults[0].status='NOT_RUN';value.assertionResults[0].actual=null;},(value:PreviewValidationEvidence)=>{value.viewportResults[1].contentWidthCssPx=420;},(value:PreviewValidationEvidence)=>{value.viewportResults[0].failedRequests.push('failed data read');}]){
    const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin);const built=await build(f,begin);
    await assert.rejects(preview(f,begin,built.receipt,change),{code:'PREVIEW_INCOMPLETE'});assert.equal(f.store.list('preview_receipts').length,0);assert.equal(f.presentation.getView(begin.view.viewId)?.source,undefined);
  }
  const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin);const built=await build(f,begin),evidence=unitPreview(f,begin,built.receipt);writeFileSync(evidence.report.viewportResults[0].screenshot.path,'altered');
  await assert.rejects(f.authoring.recordPreview(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receipt.receiptId,reportRef:evidence.reportRef}),{code:'EVIDENCE_HASH_MISMATCH'});
});

test('mounting holds the old view until one authorized document confirms render/data/bridge readiness',async t=>{
  const f=setup(t),candidate=await prepared(f);let view=f.store.get<AuthoringView>('views',candidate.begin.view.viewId)!;
  assert.equal(view.activeBuildId,null);assert.equal(view.lastGoodBuildId,null);assert.equal(view.pendingPublicationId,candidate.publication.publicationId);assert.equal(view.source,undefined);assert.equal(f.store.list('components').length,0);
  assert.equal(f.authoring.acceptsFrame({...candidate.identity,protocolVersion:'2.0',sessionId:session,viewId:view.viewId}),true);
  assert.equal(f.authoring.acceptsFrame({...candidate.identity,protocolVersion:'2.0',sessionId:'other-session',viewId:view.viewId}),false);
  assert.throws(()=>f.authoring.confirmReady(session,{...candidate.ready,documentNonce:'foreign'}),{code:'ATTEMPT_SUPERSEDED'});
  assert.throws(()=>f.authoring.confirmReady(session,{...candidate.ready,checks:{...candidate.ready.checks,dataRead:false}}),{code:'FRAME_RUNTIME_ERROR'});
  const confirmed=f.authoring.confirmReady(session,candidate.ready);view=confirmed.view;assert.equal(view.viewRevision,2);assert.equal(view.activeBuildId,candidate.publication.candidateBuildId);assert.equal(view.lastGoodBuildId,view.activeBuildId);assert.equal(view.pendingPublicationId,null);assert.equal(f.store.list('components').length,0);
  assert.equal(f.authoring.confirmReady(session,candidate.ready).view.viewRevision,2);assert.throws(()=>f.authoring.confirmReady(session,{...candidate.ready,viewId:'another-view'}));
});

test('publish waits for an explicit open without a readiness deadline, frame grant or save',async t=>{
  let now=new Date('2026-10-07T00:00:00.000Z');const f=setup(t,{clock:()=>now}),candidate=await prepared(f,undefined,'Waiting',false),publication=candidate.publication;
  assert.equal(publication.state,'prepared');assert.equal(publication.readyDeadlineAt,null);assert.equal(publication.mountStartedAt,null);
  assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId)?.state,'publish_ready');
  now=new Date(now.getTime()+60000);
  const repeated=f.authoring.publish(session,{attemptId:publication.attemptId,epoch:publication.attemptEpoch,viewId:publication.viewId,expectedViewRevision:publication.expectedViewRevision,buildId:publication.candidateBuildId,buildReceiptId:publication.buildReceiptId,previewReceiptId:publication.previewReceiptId});assert.deepEqual(repeated,publication);
  assert.throws(()=>f.authoring.authorizeFrame(session,candidate.identity),{code:'ATTEMPT_SUPERSEDED'});assert.throws(()=>f.authoring.confirmReady(session,candidate.ready),{code:'ATTEMPT_SUPERSEDED'});
  assert.equal(f.authoring.acceptsFrame({...candidate.identity,protocolVersion:'2.0',sessionId:session,viewId:publication.viewId}),false);
  assert.throws(()=>f.authoring.saveComponent(session,{viewId:publication.viewId,expectedViewRevision:publication.expectedViewRevision,userRequest:'Save before display',mode:'save_as'}),{code:'VIEW_CONFLICT'});
  assert.deepEqual(f.authoring.failMount(session,publication.publicationId,'UI binding failed before open'),publication);
  assert.equal(f.store.list('view_publications').length,1);assert.equal(f.store.list('components').length,0);const view=f.store.get<AuthoringView>('views',publication.viewId)!;assert.equal(view.activeBuildId,null);assert.equal(view.pendingPublicationId,publication.publicationId);
});

test('explicit open starts one fresh deadline after waiting and duplicate clicks never renew or grant a second frame',async t=>{
  let now=new Date('2026-10-07T00:00:00.000Z');const f=setup(t,{clock:()=>now}),candidate=await prepared(f,undefined,'Waiting',false);
  now=new Date(now.getTime()+60000);const opened=f.authoring.startMount(session,openInput(candidate.publication));assert.equal(opened.state,'mounting');assert.equal(opened.mountStartedAt,now.toISOString());assert.equal(opened.readyDeadlineAt,new Date(now.getTime()+15000).toISOString());
  assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',opened.attemptId)?.state,'mounting');now=new Date(now.getTime()+1000);assert.deepEqual(f.authoring.startMount(session,openInput(opened)),opened);assert.equal(f.store.list('view_publications').length,1);
  f.authoring.authorizeFrame(session,candidate.identity);const granted=f.store.get<ViewPublication>('view_publications',opened.publicationId)!;assert.deepEqual(f.authoring.startMount(session,openInput(opened)),granted);
  assert.throws(()=>f.authoring.authorizeFrame(session,{...candidate.identity,frameInstanceId:'another-frame',documentNonce:'another-document'}),{code:'ATTEMPT_SUPERSEDED'});
  assert.equal(f.authoring.confirmReady(session,candidate.ready).publication.state,'mounted');assert.throws(()=>f.authoring.startMount(session,openInput(opened)),{code:'ATTEMPT_SUPERSEDED'});
});

test('restart retains prepared publications while legacy in-flight mounting is interrupted without re-preparing',async t=>{
  const f=setup(t),waiting=await prepared(f,undefined,'Waiting',false),mounting=await prepared(f);
  const {mountStartedAt:_started,...legacy}=f.store.get<ViewPublication>('view_publications',mounting.publication.publicationId)!;f.store.put('view_publications',legacy.publicationId,legacy);
  const restarted=new AppsAuthoringService(f.serviceOptions),result=restarted.recoverInterrupted();assert.deepEqual(result.interruptedAttemptIds,[mounting.begin.attempt.attemptId]);
  assert.deepEqual(restarted.inspect(session,{publicationId:waiting.publication.publicationId}).publication,waiting.publication);assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',waiting.begin.attempt.attemptId)?.state,'publish_ready');
  assert.equal(f.store.get<AuthoringView>('views',waiting.publication.viewId)?.pendingPublicationId,waiting.publication.publicationId);assert.equal(restarted.startMount(session,openInput(waiting.publication)).state,'mounting');
  assert.equal(f.store.get<ViewPublication>('view_publications',legacy.publicationId)?.state,'interrupted');assert.throws(()=>restarted.startMount(session,openInput(legacy)),{code:'ATTEMPT_SUPERSEDED'});assert.equal(f.store.list('view_publications').length,2);
});

test('cancel and a newer edit supersede prepared publications without changing the last good view',async t=>{
  const f=setup(t),first=await prepared(f),good=f.authoring.confirmReady(session,first.ready).view,waiting=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:good.viewId}),'Waiting',false);
  f.authoring.cancel(session,{attemptId:waiting.publication.attemptId,expectedEpoch:waiting.publication.attemptEpoch,reason:'Cancel unopened component'});assert.equal(f.store.get<ViewPublication>('view_publications',waiting.publication.publicationId)?.state,'cancelled');assert.throws(()=>f.authoring.startMount(session,openInput(waiting.publication)),{code:'ATTEMPT_SUPERSEDED'});
  const next=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:good.viewId}),'Next unopened',false);f.authoring.begin(session,{mode:'edit',viewId:good.viewId});assert.equal(f.store.get<ViewPublication>('view_publications',next.publication.publicationId)?.state,'superseded');assert.throws(()=>f.authoring.startMount(session,openInput(next.publication)),{code:'ATTEMPT_SUPERSEDED'});
  const view=f.store.get<AuthoringView>('views',good.viewId)!;assert.equal(view.activeBuildId,good.activeBuildId);assert.equal(view.lastGoodBuildId,good.lastGoodBuildId);assert.equal(view.pendingPublicationId,null);assert.equal(f.store.list('components').length,0);
});

test('open rejects foreign or mismatched fixed identities and changed view CAS without touching prepared metadata',async t=>{
  const f=setup(t),candidate=await prepared(f,undefined,'Waiting',false),input=openInput(candidate.publication),before=f.authoring.inspect(session,{publicationId:input.publicationId});
  assert.throws(()=>f.authoring.startMount('other-session',input),{code:'VIEW_NOT_OWNED'});
  for(const patch of [{viewId:'other-view'},{buildId:'f'.repeat(64)},{expectedViewRevision:input.expectedViewRevision+1}])assert.throws(()=>f.authoring.startMount(session,{...input,...patch}),{code:'PUBLICATION_TARGET_MISMATCH'});
  assert.throws(()=>f.authoring.startMount(session,{...input,attemptEpoch:input.attemptEpoch+1}),{code:'ATTEMPT_SUPERSEDED'});assert.deepEqual(f.authoring.inspect(session,{publicationId:input.publicationId}),before);
  f.store.put('authoring_attempts',input.attemptId,{...before.attempt,expectedViewRevision:before.attempt.expectedViewRevision+1});assert.throws(()=>f.authoring.startMount(session,input),{code:'ATTEMPT_SUPERSEDED'});f.store.put('authoring_attempts',input.attemptId,before.attempt);
  f.store.put('authoring_drafts',before.draft.draftId,{...before.draft,sourceRevision:before.draft.sourceRevision+1});assert.throws(()=>f.authoring.startMount(session,input),{code:'ATTEMPT_SUPERSEDED'});f.store.put('authoring_drafts',before.draft.draftId,before.draft);assert.deepEqual(f.authoring.inspect(session,{publicationId:input.publicationId}),before);
  f.store.put('views',before.view.viewId,{...before.view,viewRevision:before.view.viewRevision+1});assert.throws(()=>f.authoring.startMount(session,input),{code:'ATTEMPT_SUPERSEDED'});assert.deepEqual(f.store.get('view_publications',input.publicationId),candidate.publication);
});

test('opening revalidates receipt ownership, evidence bytes and immutable archive before starting any deadline',async t=>{
  const f=setup(t),candidate=await prepared(f,undefined,'Waiting',false),input=openInput(candidate.publication),other=await prepared(f,undefined,'Other waiting',false),attempt=f.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId)!;
  // Receipts remain immutable; simulate corrupted mutable pointers to a real receipt owned by another attempt.
  f.store.put('authoring_attempts',input.attemptId,{...attempt,previewReceiptId:other.tested.receipt.receiptId});f.store.put('view_publications',input.publicationId,{...candidate.publication,previewReceiptId:other.tested.receipt.receiptId});assert.throws(()=>f.authoring.startMount(session,input),{code:'BUILD_EVIDENCE_INVALID'});f.store.put('authoring_attempts',input.attemptId,attempt);f.store.put('view_publications',input.publicationId,candidate.publication);
  const log=readFileSync(candidate.built.receipt.logRef.path);writeFileSync(candidate.built.receipt.logRef.path,'changed');assert.throws(()=>f.authoring.startMount(session,input),{code:'EVIDENCE_HASH_MISMATCH'});writeFileSync(candidate.built.receipt.logRef.path,log);
  const wrongSource={...candidate.publication,source:{...candidate.publication.source,files:['wrong.html']}};f.store.put('view_publications',input.publicationId,wrongSource);assert.throws(()=>f.authoring.startMount(session,input),{code:'BUILD_EVIDENCE_INVALID'});f.store.put('view_publications',input.publicationId,candidate.publication);
  const archived=join(f.sources.directory,'builds',candidate.publication.candidateBuildId,'project','dist','index.html');writeFileSync(archived,'changed archive');assert.throws(()=>f.authoring.startMount(session,input),{code:'BUILD_EVIDENCE_INVALID'});
  assert.equal(f.store.get<ViewPublication>('view_publications',input.publicationId)?.readyDeadlineAt,null);assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId)?.state,'publish_ready');assert.equal(f.store.get<AuthoringView>('views',input.viewId)?.activeBuildId,null);
});

test('failed mounts and expired readiness preserve last good bytes and a recoverable edit workspace',async t=>{
  let now=new Date('2026-10-07T00:00:00.000Z');const f=setup(t,{clock:()=>now}),first=await prepared(f);const good=f.authoring.confirmReady(session,first.ready).view;
  const next=f.authoring.begin(session,{mode:'edit',viewId:good.viewId}),second=await prepared(f,next,'Second build');
  assert.equal(f.store.get<AuthoringView>('views',good.viewId)?.activeBuildId,good.activeBuildId);now=new Date(now.getTime()+16000);
  assert.throws(()=>f.authoring.confirmReady(session,second.ready),{code:'FRAME_NOT_READY'});assert.throws(()=>f.authoring.startMount(session,openInput(second.publication)),{code:'FRAME_NOT_READY'});assert.equal(f.store.get<ViewPublication>('view_publications',second.publication.publicationId)?.readyDeadlineAt,second.publication.readyDeadlineAt);f.authoring.failMount(session,second.publication.publicationId,'Timed out while loading');
  const view=f.store.get<AuthoringView>('views',good.viewId)!;assert.equal(view.activeBuildId,good.activeBuildId);assert.equal(view.lastGoodBuildId,good.lastGoodBuildId);assert.equal(view.source?.buildId,good.source?.buildId);assert.equal(view.pendingPublicationId,null);assert.ok(existsSync(join(next.draft.workspacePath,'src','Component.tsx')));
  const restarted=new AppsAuthoringService({...f.serviceOptions});assert.equal(restarted.recoverInterrupted().interruptedAttemptIds.includes(second.publication.attemptId),false);assert.throws(()=>restarted.startMount(session,openInput(second.publication)),{code:'ATTEMPT_SUPERSEDED'});assert.equal(f.store.get<ViewPublication>('view_publications',second.publication.publicationId)?.state,'failed_mount');assert.equal(f.store.list('components').length,0);
});

test('new attempt supersedes old candidates and stale publication view CAS is never auto-retried',async t=>{
  const f=setup(t),first=await prepared(f),next=f.authoring.begin(session,{mode:'edit',viewId:first.begin.view.viewId});
  assert.equal(next.attempt.epoch,first.begin.attempt.epoch+1);assert.equal(next.draft.sourceRevision,2);assert.throws(()=>f.authoring.confirmReady(session,first.ready),{code:'ATTEMPT_SUPERSEDED'});
  project(next,'Next');const built=await build(f,next),tested=await preview(f,next,built.receipt);
  const before=f.store.get<AuthoringView>('views',next.view.viewId)!;f.store.put('views',before.viewId,{...before,viewRevision:before.viewRevision+1});
  assert.throws(()=>f.authoring.publish(session,{attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,viewId:next.view.viewId,expectedViewRevision:next.attempt.expectedViewRevision,buildId:built.receipt.archiveBuildId!,buildReceiptId:built.receipt.receiptId,previewReceiptId:tested.receipt.receiptId}),{code:'VIEW_CONFLICT'});
  assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',next.attempt.attemptId)?.state,'publish_ready');assert.ok(existsSync(next.draft.workspacePath));
});

test('cancel before ready invalidates frame identity while cancel after commit reports already_published',async t=>{
  const f=setup(t),first=await prepared(f);assert.equal(f.authoring.cancel(session,{attemptId:first.begin.attempt.attemptId,expectedEpoch:first.begin.attempt.epoch,reason:'Stop this draft'}).status,'cancelled');
  assert.throws(()=>f.authoring.confirmReady(session,first.ready),{code:'ATTEMPT_SUPERSEDED'});assert.equal(f.store.get<AuthoringView>('views',first.begin.view.viewId)?.activeBuildId,null);assert.ok(existsSync(first.begin.draft.workspacePath));
  const second=await prepared(f);const confirmed=f.authoring.confirmReady(session,second.ready);assert.equal(f.authoring.cancel(session,{attemptId:second.begin.attempt.attemptId,expectedEpoch:second.begin.attempt.epoch,reason:'Too late'}).status,'already_published');assert.equal(f.store.get<AuthoringView>('views',second.begin.view.viewId)?.activeBuildId,confirmed.view.activeBuildId);
});

test('cancel persisted during asynchronous evidence validation rejects a late build completion',async t=>{
  const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin);const executed=await f.runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.sources});
  let release!:(value:BuildExecutionEvidence)=>void;const delayed=new AppsAuthoringService({...f.serviceOptions,validateBuildEvidence:()=>new Promise<BuildExecutionEvidence>(accept=>{release=accept;})});
  const recording=delayed.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef});delayed.cancel(session,{attemptId:begin.attempt.attemptId,expectedEpoch:begin.attempt.epoch,reason:'Stop waiting'});release(executed.report);
  await assert.rejects(recording,{code:'ATTEMPT_SUPERSEDED'});assert.equal(f.store.list('build_receipts').length,0);assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',begin.attempt.attemptId)?.state,'cancelled');
});

test('cooperative cancel hooks observe committed exact-epoch cancellation, supersession and restart facts',t=>{
  const f=setup(t),signals:{attemptId:string;epoch:number;state:string;draftEpoch:number}[]=[],authoring=new AppsAuthoringService({...f.serviceOptions,onCancel:(attemptId,epoch)=>{const attempt=f.store.get<AuthoringAttempt>('authoring_attempts',attemptId)!,draft=f.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId)!;signals.push({attemptId,epoch,state:attempt.state,draftEpoch:draft.epoch});}});
  const first=authoring.begin(session,{mode:'new'}),second=authoring.begin(session,{mode:'edit',viewId:first.view.viewId});assert.deepEqual(signals,[{attemptId:first.attempt.attemptId,epoch:1,state:'superseded',draftEpoch:2}]);
  authoring.cancel(session,{attemptId:second.attempt.attemptId,expectedEpoch:second.attempt.epoch,reason:'Stop subprocess'});authoring.cancel(session,{attemptId:second.attempt.attemptId,expectedEpoch:second.attempt.epoch,reason:'Repeat stop'});assert.equal(signals.length,2);assert.deepEqual(signals[1],{attemptId:second.attempt.attemptId,epoch:2,state:'cancelled',draftEpoch:3});
  const third=authoring.begin(session,{mode:'edit',viewId:first.view.viewId});assert.equal(authoring.markBuilding(session,{attemptId:third.attempt.attemptId,epoch:third.attempt.epoch}).state,'building');assert.throws(()=>authoring.markBuilding('other-session',{attemptId:third.attempt.attemptId,epoch:third.attempt.epoch}),{code:'VIEW_NOT_OWNED'});authoring.recoverInterrupted();assert.equal(signals.length,3);assert.deepEqual(signals[2],{attemptId:third.attempt.attemptId,epoch:4,state:'interrupted',draftEpoch:4});
});

test('confirmed view revisions remain immutable historical build snapshots when the same view advances',async t=>{
  const f=setup(t),first=await prepared(f),initial=f.authoring.confirmReady(session,first.ready).view,id='view-revision:'+canonicalJson([session,initial.viewId,initial.viewRevision]);
  const old=f.store.get<{value:AuthoringView}>('provider_records',id)!;assert.deepEqual(old.value,initial);
  const second=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:initial.viewId}),'New build');const current=f.authoring.confirmReady(session,second.ready).view;assert.equal(current.viewRevision,3);assert.notEqual(current.activeBuildId,initial.activeBuildId);assert.deepEqual(f.store.get<{value:AuthoringView}>('provider_records',id)!.value,initial);
});

test('restart marks only unfinished build/preview/mount attempts interrupted and never reruns them',async t=>{
  const f=setup(t),building=f.authoring.begin(session,{mode:'new'}),previewing=f.authoring.begin(session,{mode:'new'});project(building);project(previewing);await build(f,previewing);
  f.authoring.markBuilding(session,{attemptId:building.attempt.attemptId,epoch:building.attempt.epoch});const mounting=await prepared(f),completed=await prepared(f);f.authoring.confirmReady(session,completed.ready);
  const result=new AppsAuthoringService(f.serviceOptions).recoverInterrupted();assert.deepEqual(new Set(result.interruptedAttemptIds),new Set([building.attempt.attemptId,previewing.attempt.attemptId,mounting.begin.attempt.attemptId]));
  assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',completed.begin.attempt.attemptId)?.state,'mounted');assert.equal(f.store.get<AuthoringView>('views',mounting.begin.view.viewId)?.pendingPublicationId,null);assert.ok(existsSync(building.draft.workspacePath));assert.equal(f.store.list('components').length,0);
});

for(const mode of ['open_component','open_saved'])test(`unchanged verified ${mode} saves without new receipts and advances only its own current baseline`,async t=>{
  const f=setup(t),candidate=await prepared(f),mounted=f.authoring.confirmReady(session,candidate.ready).view;
  const seed=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save verified seed',mode:'save_as'});
  const opened=mode==='open_saved'?f.authoring.begin(session,{mode:'open_saved',componentId:seed.componentId,newCopy:true}).view:f.presentation.openComponent(session,seed.componentId,{newCopy:true}),stale=f.presentation.openComponent(session,seed.componentId,{newCopy:true});
  const evidence={builds:f.store.list('build_receipts'),previews:f.store.list('preview_receipts'),publications:f.store.list('view_publications')};
  assert.equal(f.store.list<AuthoringDraft>('authoring_drafts').some(draft=>draft.viewId===opened.viewId),mode==='open_saved');
  const second=f.authoring.saveComponent(session,{viewId:opened.viewId,expectedViewRevision:opened.viewRevision!,userRequest:'Update reusable component',mode:'update',componentId:seed.componentId,expectedRevision:opened.baseRevision,title:'Second'});
  assert.equal(second.revision,2);assert.equal(second.view.sourceComponentId,seed.componentId);assert.equal(second.view.baseRevision,2);assert.equal(second.view.baseRevisionAtOpen,1);assert.equal(second.view.selectedSourceRevision,1);assert.deepEqual(second.view,f.presentation.getView(opened.viewId));
  const third=f.presentation.saveComponent(session,opened.viewId,'Update through shared entry',{mode:'update',componentId:seed.componentId,expectedRevision:second.view.baseRevision,title:'Third'});assert.equal(third.revision,3);
  const editing=f.authoring.begin(session,{mode:'edit',viewId:opened.viewId});assert.equal(editing.view.baseRevision,3);assert.equal(editing.draft.baseRevisionAtOpen,1);
  const fourth=f.authoring.saveComponent(session,{viewId:opened.viewId,expectedViewRevision:editing.view.viewRevision,userRequest:'Save unchanged edit',mode:'update',componentId:seed.componentId,expectedRevision:editing.view.baseRevision,title:'Fourth'});assert.equal(fourth.revision,4);
  assert.equal(f.store.get<AuthoringDraft>('authoring_drafts',editing.draft.draftId)?.sourceComponentId,seed.componentId);assert.deepEqual(fourth.view.source,second.view.source);assert.equal(fourth.view.viewRevision,opened.viewRevision);assert.equal(fourth.view.selectedSourceRevision,1);
  assert.throws(()=>f.authoring.saveComponent(session,{viewId:stale.viewId,expectedViewRevision:stale.viewRevision!,userRequest:'Stale update',mode:'update',componentId:seed.componentId,expectedRevision:stale.baseRevision}),{code:'COMPONENT_CONFLICT'});
  assert.throws(()=>f.presentation.saveComponent(session,stale.viewId,'Do not retarget stale copy',{mode:'update',componentId:seed.componentId,expectedRevision:4}),{code:'COMPONENT_CONFLICT'});
  assert.deepEqual(f.presentation.getView(stale.viewId),stale);assert.deepEqual({builds:f.store.list('build_receipts'),previews:f.store.list('preview_receipts'),publications:f.store.list('view_publications')},evidence);
});

test('verified source code reuses pinned source references in another shop without rebuilding, but changed definitions need evidence',async t=>{
  const f=setup(t),scoped={...descriptor,inputSchema:{type:'object',properties:{storeId:{type:'string'},limit:{type:'integer'}},required:['storeId'],additionalProperties:false}};
  f.runtime.describe=()=>scoped;Object.assign(f.runtime,{getConnection:()=>({enabled:true}),bind:(value:unknown)=>value,sessionBindings:()=>[]});
  const definition:import('../../packages/app-presentation/src/types.ts').DataSourceDraft={id:'notes-products',title:'商品',appId:'notes',connectionId:'notes-test',capabilityId:'notes.list',capabilityMajor:1,storeScoped:true,input:{limit:1},parameters:[{name:'storeId',label:'店铺',type:'string',required:true,editable:false},{name:'limit',label:'数量',type:'integer'}],rowsPath:'resources',fields:[{path:'resourceId',role:'product.id',confirmed:true}],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
  f.presentation.dataSources.installCatalog([definition]);
  const candidate=await prepared(f,f.authoring.begin(session,{mode:'new',sourceRefs:{main:{id:definition.id,revision:1,params:{}}},context:{storeId:'A'}}));
  const mounted=f.authoring.confirmReady(session,candidate.ready).view,seed=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save scoped source',mode:'save_as'});
  const opened=f.authoring.begin(session,{mode:'open_saved',componentId:seed.componentId,context:{storeId:'B'}}).view;
  assert.equal((opened.bindings[0].input as {storeId:string}).storeId,'B');assert.equal(opened.source?.buildId,seed.view.source?.buildId);assert.equal(f.presentation.canReuseSavedView(opened),true);
  const receipts=f.store.list('build_receipts');const saved=f.authoring.saveComponent(session,{viewId:opened.viewId,expectedViewRevision:opened.viewRevision,userRequest:'Reuse for shop B',mode:'save_as'});assert.equal(saved.view.context?.storeId,'B');assert.deepEqual(f.store.list('build_receipts'),receipts);
  f.presentation.dataSources.installCatalog([{...definition,input:{limit:2}}]);
  const changed=f.presentation.createView(session,{viewId:opened.viewId,title:opened.title,sourceRefs:{main:{id:definition.id,revision:2,params:{}}}});
  assert.equal(f.presentation.canReuseSavedView(changed),false);assert.throws(()=>f.presentation.saveComponent(session,changed.viewId,'Changed definition',{mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});
});

test('save-as retargets the same view and draft while preserving historical source numbers',async t=>{
  const f=setup(t),candidate=await prepared(f),mounted=f.authoring.confirmReady(session,candidate.ready).view,first=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save original',mode:'save_as'});
  const second=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Original version two',mode:'update',componentId:first.componentId,expectedRevision:1});
  const opened=f.authoring.begin(session,{mode:'open_saved',componentId:first.componentId,newCopy:true}),before=f.store.get('components',first.componentId);
  const copy=f.authoring.saveComponent(session,{viewId:opened.view.viewId,expectedViewRevision:opened.view.viewRevision,userRequest:'Save as independent copy',mode:'save_as',title:'Copy'});
  assert.notEqual(copy.componentId,first.componentId);assert.equal(copy.view.sourceComponentId,copy.componentId);assert.equal(copy.view.baseRevision,1);assert.equal(copy.view.baseRevisionAtOpen,2);assert.equal(copy.view.selectedSourceRevision,2);assert.deepEqual(copy.view,f.presentation.getView(opened.view.viewId));
  const draft=f.store.get<AuthoringDraft>('authoring_drafts',opened.draft.draftId)!;assert.equal(draft.sourceComponentId,copy.componentId);assert.equal(draft.baseRevisionAtOpen,2);assert.equal(draft.selectedSourceRevision,2);
  assert.throws(()=>f.authoring.saveComponent(session,{viewId:copy.view.viewId,expectedViewRevision:copy.view.viewRevision!,userRequest:'Must not write former target',mode:'update',componentId:first.componentId,expectedRevision:second.revision}),{code:'COMPONENT_CONFLICT'});
  const updated=f.authoring.saveComponent(session,{viewId:copy.view.viewId,expectedViewRevision:copy.view.viewRevision!,userRequest:'Update independent copy',mode:'update',componentId:copy.componentId,expectedRevision:copy.view.baseRevision});assert.equal(updated.revision,2);assert.deepEqual(updated.view,f.presentation.getView(copy.view.viewId));assert.deepEqual(f.store.get('components',first.componentId),before);
});

test('historical verified content restores without rebuilding and the restored work copy can save again',async t=>{
  const f=setup(t),candidate=await prepared(f),mounted=f.authoring.confirmReady(session,candidate.ready).view,first=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save version one',mode:'save_as'});
  const edit=f.authoring.begin(session,{mode:'open_saved',componentId:first.componentId}),changed=await prepared(f,edit,'Different version two'),newView=f.authoring.confirmReady(session,changed.ready).view;
  const second=f.authoring.saveComponent(session,{viewId:newView.viewId,expectedViewRevision:newView.viewRevision,userRequest:'Save changed source',mode:'update',componentId:first.componentId,expectedRevision:1});assert.notEqual(first.view.source!.buildId,second.view.source!.buildId);
  const historical=f.authoring.begin(session,{mode:'open_saved',componentId:first.componentId,revision:1}),history=f.presentation.componentVersions(first.componentId),receipts=f.store.list('build_receipts');
  assert.equal(historical.view.baseRevision,2);assert.equal(historical.view.selectedSourceRevision,1);
  const third=f.authoring.saveComponent(session,{viewId:historical.view.viewId,expectedViewRevision:historical.view.viewRevision,userRequest:'Restore version one as a new version',mode:'update',componentId:first.componentId,expectedRevision:historical.view.baseRevision});assert.equal(third.revision,3);assert.equal(third.view.source!.buildId,first.view.source!.buildId);
  const fourth=f.authoring.saveComponent(session,{viewId:third.view.viewId,expectedViewRevision:third.view.viewRevision!,userRequest:'Save restored work again',mode:'update',componentId:first.componentId,expectedRevision:third.view.baseRevision});assert.equal(fourth.revision,4);assert.equal(fourth.view.selectedSourceRevision,1);assert.equal(fourth.view.baseRevisionAtOpen,2);assert.equal(fourth.view.baseRevision,4);
  assert.deepEqual(f.presentation.componentVersions(first.componentId).slice(0,2),history);assert.deepEqual(f.store.list('build_receipts'),receipts);
});

test('changed design or binding cannot reuse a saved or mounted verification; template saving stays independent',async t=>{
  const f=setup(t),candidate=await prepared(f),mounted=f.authoring.confirmReady(session,candidate.ready).view,seed=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save original',mode:'save_as'});
  for(const change of ['design','bindings'])for(const entry of ['opened','mounted']){
    const view=entry==='opened'?f.authoring.begin(session,{mode:'open_saved',componentId:seed.componentId}).view:f.presentation.getView(mounted.viewId)!;
    f.presentation.createView(session,{viewId:view.viewId,title:view.title,...(change==='design'?{design:{changed:true}}:{bindings:[binding]})});
    const before=f.store.list('component_versions');
    assert.throws(()=>f.authoring.saveComponent(session,{viewId:view.viewId,expectedViewRevision:view.viewRevision!,userRequest:'Unverified change',mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});
    assert.throws(()=>f.presentation.saveComponent(session,view.viewId,'Unverified change',{mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});assert.deepEqual(f.store.list('component_versions'),before);
    const template=f.presentation.saveTemplate(session,view.viewId,'Reusable draft template','Save template');assert.equal(template.kind,'template');
    if(entry==='mounted')f.presentation.createView(session,{viewId:view.viewId,title:view.title,design:seed.view.design,bindings:seed.view.bindings});
  }
});

test('changed source and unverified saved source still require authoring validation',async t=>{
  const f=setup(t),candidate=await prepared(f),mounted=f.authoring.confirmReady(session,candidate.ready).view,seed=f.authoring.saveComponent(session,{viewId:mounted.viewId,expectedViewRevision:mounted.viewRevision,userRequest:'Save verified',mode:'save_as'});
  const other=join(f.directory,'unverified');mkdirSync(join(other,'dist'),{recursive:true});writeFileSync(join(other,'dist','index.html'),'<p>Changed source</p>');
  for(const mode of ['open_component','open_saved']){
    const opened=mode==='open_saved'?f.authoring.begin(session,{mode:'open_saved',componentId:seed.componentId}).view:f.presentation.openComponent(session,seed.componentId),changed=f.presentation.openSource(session,other,{viewId:opened.viewId});assert.notEqual(changed.source!.buildId,seed.view.source!.buildId);
    assert.throws(()=>f.authoring.saveComponent(session,{viewId:changed.viewId,expectedViewRevision:changed.viewRevision!,userRequest:'Save changed build',mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});assert.throws(()=>f.presentation.saveComponent(session,changed.viewId,'Save changed build',{mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});
  }
  const legacy=f.presentation.openSource(session,other),legacySaved=f.presentation.saveComponent(session,legacy.viewId,'Existing compatibility source save',{mode:'save_as'}),unverified=f.presentation.openComponent(session,legacySaved.componentId);
  assert.throws(()=>f.authoring.saveComponent(session,{viewId:unverified.viewId,expectedViewRevision:unverified.viewRevision!,userRequest:'No verified source to reuse',mode:'save_as'}),{code:'BUILD_EVIDENCE_INVALID'});
  assert.equal(f.presentation.saveComponent(session,unverified.viewId,'Legacy source remains compatible',{mode:'update',componentId:legacySaved.componentId,expectedRevision:unverified.baseRevision}).revision,2);
});

test('explicit save requires the confirmed view CAS and history restores compare the current metadata baseline',async t=>{
  const f=setup(t),first=await prepared(f);assert.throws(()=>f.authoring.saveComponent(session,{viewId:first.begin.view.viewId,expectedViewRevision:1,userRequest:'Save as First',mode:'save_as'}),{code:'VIEW_CONFLICT'});
  const good=f.authoring.confirmReady(session,first.ready).view,saved=f.authoring.saveComponent(session,{viewId:good.viewId,expectedViewRevision:good.viewRevision,userRequest:'Save as First',mode:'save_as',title:'First'});assert.equal(saved.revision,1);
  const opened=f.authoring.begin(session,{mode:'open_saved',componentId:saved.componentId}),second=await prepared(f,opened,'Second build'),secondView=f.authoring.confirmReady(session,second.ready).view;
  const updated=f.authoring.saveComponent(session,{viewId:secondView.viewId,expectedViewRevision:secondView.viewRevision,userRequest:'Update First',mode:'update',componentId:saved.componentId,expectedRevision:opened.draft.baseRevisionAtOpen,title:'Second'});assert.equal(updated.revision,2);
  const historical=f.authoring.begin(session,{mode:'open_saved',componentId:saved.componentId,revision:1});assert.equal(historical.draft.selectedSourceRevision,1);assert.equal(historical.draft.baseRevisionAtOpen,2);assert.notEqual(historical.draft.workspacePath,opened.draft.workspacePath);
  const restored=await prepared(f,historical,'Restored first'),restoredView=f.authoring.confirmReady(session,restored.ready).view;
  assert.throws(()=>f.authoring.saveComponent(session,{viewId:restoredView.viewId,expectedViewRevision:restoredView.viewRevision,userRequest:'Restore',mode:'update',componentId:saved.componentId,expectedRevision:1}),{code:'COMPONENT_CONFLICT'});
  const third=f.authoring.saveComponent(session,{viewId:restoredView.viewId,expectedViewRevision:restoredView.viewRevision,userRequest:'Restore history as new revision',mode:'update',componentId:saved.componentId,expectedRevision:2,title:'Restored'});assert.equal(third.revision,3);assert.equal(f.presentation.componentVersions(saved.componentId).length,3);
});

test('explicit save mutation repeat keys produce one component and changed intents conflict',async t=>{
  const f=setup(t),candidate=await prepared(f),view=f.authoring.confirmReady(session,candidate.ready).view,runtime=new AppsRuntime(f.store);
  runtime.register({manifest:{manifestVersion:1,appId:'apps',displayName:'Apps authoring fixture',providerPackage:'test-authoring',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:APP_AUTHORING_DESCRIPTORS,execute:context=>f.authoring.execute(context),dispose:async()=>{}});
  runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Presentation',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:session,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
  const base:InvocationRequest={protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId:'apps.authoring.save_component',capabilityVersion:'1.0.0',invocationId:'save-native-1',traceId:'save-trace-1',source:{kind:'agent',sessionId:session,nativeCallId:'original-tool-save'},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:'explicit-save-intent',input:{viewId:view.viewId,expectedViewRevision:view.viewRevision,userRequest:'Save this as Profit',mode:'save_as',title:'Profit'}};
  const [first,concurrent]=await Promise.all([runtime.invoke(base),runtime.invoke({...base,invocationId:'save-native-2',traceId:'save-trace-2'})]);assert.equal(first.status,'ok');assert.ok(['ok','pending'].includes(concurrent.status));assert.equal(first.operation?.operationId,concurrent.operation?.operationId);
  const replayed=await runtime.invoke({...base,invocationId:'save-native-3',traceId:'save-trace-3'});assert.equal(replayed.status,'ok');assert.deepEqual((first as {data:JsonValue}).data,(replayed as {data:JsonValue}).data);assert.equal(f.store.list('components').length,1);assert.equal(f.store.list('operations').length,1);
  const conflict=await runtime.invoke({...base,invocationId:'changed-intent',input:{...(base.input as object),title:'Changed title'}});assert.equal(conflict.status,'failed');assert.equal((conflict as {error:{code:string}}).error.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.store.list('components').length,1);
});

test('generic presentation save cannot bypass authoring readiness and delegates mounted saves without a loop',async t=>{
  const f=setup(t),runtime=new AppsRuntime(f.store);f.presentation.authoring=f.authoring;runtime.register(f.presentation.provider());
  runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Presentation',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:session,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
  let sequence=0;const invoke=(capabilityId:string,input:JsonValue)=>{const id=`generic-save-${++sequence}`;return runtime.invoke({protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId,capabilityVersion:'1.0.0',invocationId:id,traceId:id,source:{kind:'agent',sessionId:session,nativeCallId:id},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:id,input});};
  try{
    const begin=f.authoring.begin(session,{mode:'new'}),save={viewId:begin.view.viewId,userRequest:'Explicitly save component',mode:'save_as'};
    const unpublished=await invoke('apps.presentation.save_component',save);assert.equal(unpublished.status,'failed');assert.equal((unpublished as {error:{code:string}}).error.code,'BUILD_EVIDENCE_INVALID');
    const candidate=await prepared(f,begin,'Waiting',false),before=f.presentation.getView(begin.view.viewId);
    const waiting=await invoke('apps.presentation.save_component',save);assert.equal(waiting.status,'failed');assert.equal((waiting as {error:{code:string}}).error.code,'VIEW_CONFLICT');assert.deepEqual(f.presentation.getView(begin.view.viewId),before);
    f.authoring.startMount(session,openInput(candidate.publication));f.authoring.authorizeFrame(session,candidate.identity);
    const mounting=await invoke('apps.presentation.save_component',save);assert.equal(mounting.status,'failed');assert.equal((mounting as {error:{code:string}}).error.code,'VIEW_CONFLICT');assert.equal(f.store.list('components').length,0);assert.equal(f.store.list('component_versions').length,0);assert.equal(f.store.list('saved_assets').length,0);
    const mounted=f.authoring.confirmReady(session,candidate.ready).view,legal=await invoke('apps.presentation.save_component',save);assert.equal(legal.status,'ok',JSON.stringify(legal));const saved=(legal as unknown as {data:{componentId:string;revision:number}}).data;assert.equal(saved.revision,1);assert.equal(f.store.list('components').length,1);
    const delegated=await invoke('apps.authoring.save_component',{...save,mode:'update',componentId:saved.componentId,expectedRevision:1,expectedViewRevision:mounted.viewRevision});assert.equal(delegated.status,'ok',JSON.stringify(delegated));assert.equal((delegated as unknown as {data:{revision:number}}).data.revision,2);assert.equal(f.store.list('components').length,1);assert.equal(f.store.list('component_versions').length,2);
    const next=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:mounted.viewId}),'Later waiting',false),lastGood=f.presentation.getView(mounted.viewId);assert.equal(lastGood?.activeBuildId,mounted.activeBuildId);
    const pendingGood=await invoke('apps.presentation.save_component',save);assert.equal(pendingGood.status,'failed');assert.equal((pendingGood as {error:{code:string}}).error.code,'VIEW_CONFLICT');assert.deepEqual(f.presentation.getView(mounted.viewId),lastGood);assert.equal(f.store.list('component_versions').length,2);assert.equal(f.store.get<ViewPublication>('view_publications',next.publication.publicationId)?.state,'prepared');
  }finally{await runtime.dispose();}
});

test('generic provider save retains static and legacy source behavior when the view has no authoring draft',async t=>{
  const f=setup(t),runtime=new AppsRuntime(f.store);f.presentation.authoring=f.authoring;runtime.register(f.presentation.provider());
  runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Presentation',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:session,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()});
  let sequence=0;const save=(viewId:string)=>{const id=`compat-save-${++sequence}`;return runtime.invoke({protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId:'apps.presentation.save_component',capabilityVersion:'1.0.0',invocationId:id,traceId:id,source:{kind:'agent',sessionId:session,nativeCallId:id},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:id,input:{viewId,userRequest:'Explicit compatibility save',mode:'save_as'}});};
  try{
    const ordinary=f.presentation.createView(session,{title:'Static view',design:{kind:'table',columns:['title']}}),staticSaved=await save(ordinary.viewId);assert.equal(staticSaved.status,'ok',JSON.stringify(staticSaved));assert.equal((staticSaved as unknown as {data:{view:{source?:unknown}}}).data.view.source,undefined);
    const projectPath=join(f.directory,'legacy-project');mkdirSync(join(projectPath,'dist'),{recursive:true});writeFileSync(join(projectPath,'dist','index.html'),'<h1>Legacy source</h1>');
    const legacy=f.presentation.openSource(session,projectPath,{title:'Legacy source'});assert.equal(legacy.validationStatus,'legacy_unverified');const legacySaved=await save(legacy.viewId);assert.equal(legacySaved.status,'ok',JSON.stringify(legacySaved));assert.equal((legacySaved as unknown as {data:{view:{source:{buildId:string}}}}).data.view.source.buildId,legacy.source?.buildId);assert.equal(f.store.list('authoring_drafts').length,0);assert.equal(f.store.list('components').length,2);assert.equal(f.store.list('component_versions').length,2);
  }finally{await runtime.dispose();}
});

test('rename/delete compare metadata revisions while leaving history, open copies and source bytes intact',async t=>{
  const f=setup(t),candidate=await prepared(f),view=f.authoring.confirmReady(session,candidate.ready).view,saved=f.authoring.saveComponent(session,{viewId:view.viewId,expectedViewRevision:view.viewRevision,userRequest:'Save',mode:'save_as'}),opened=f.authoring.begin(session,{mode:'open_saved',componentId:saved.componentId});
  const renamed=f.authoring.manageSavedComponent(session,{componentId:saved.componentId,expectedRevision:1,action:'rename',title:'Renamed'}) as unknown as {revision:number};assert.equal(renamed.revision,2);assert.equal(f.store.get<AuthoringDraft>('authoring_drafts',opened.draft.draftId)?.baseRevisionAtOpen,1);assert.equal(f.presentation.componentVersions(saved.componentId).length,2);
  assert.throws(()=>f.authoring.manageSavedComponent(session,{componentId:saved.componentId,expectedRevision:1,action:'delete'}),{code:'COMPONENT_CONFLICT'});assert.deepEqual(f.authoring.manageSavedComponent(session,{componentId:saved.componentId,expectedRevision:2,action:'delete'}),{deleted:true,id:saved.componentId});assert.equal(f.store.get('components',saved.componentId),undefined);assert.equal(f.presentation.componentVersions(saved.componentId).length,2);assert.ok(existsSync(opened.draft.workspacePath));assert.ok(f.presentation.getView(opened.view.viewId));assert.ok(f.sources.verify(view.activeBuildId!).valid);
});

test('changed evidence between mounting and ready cannot replace good view or save a verified claim',async t=>{
  const f=setup(t),first=await prepared(f);writeFileSync(first.tested.report.viewportResults[0].screenshot.path,'changed');assert.throws(()=>f.authoring.confirmReady(session,first.ready),{code:'EVIDENCE_HASH_MISMATCH'});assert.equal(f.store.get<AuthoringView>('views',first.begin.view.viewId)?.activeBuildId,null);
  const second=await prepared(f),view=f.authoring.confirmReady(session,second.ready).view;writeFileSync(second.built.receipt.logRef.path,'changed');assert.throws(()=>f.authoring.saveComponent(session,{viewId:view.viewId,expectedViewRevision:view.viewRevision,userRequest:'Save',mode:'save_as'}),{code:'EVIDENCE_HASH_MISMATCH'});assert.equal(f.store.list('components').length,0);
});

test('UI state is per view, revisioned, schema-aware, and prunes invalid resources without altering persisted bytes',async t=>{
  const f=setup(t),begin=f.authoring.begin(session,{mode:'new',bindings:[binding]}),candidate=await prepared(f,begin),view=f.authoring.confirmReady(session,candidate.ready).view;
  const data=await f.presentation.refreshView(session,view.viewId,{kind:'agent',sessionId:session,nativeCallId:'read-fixture'}),current=data.bindings[0];
  const input={viewId:view.viewId,sourceBuildId:view.activeBuildId!,uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'Hallmark',sort:'margin',page:3},selectionEvidence:[{bindingId:current.bindingId,datasetId:current.datasetId,datasetRevision:current.revision!,resources:current.resources}]};
  const state=f.authoring.exportUiState(session,input);assert.equal(state.stateRevision,1);assert.throws(()=>f.authoring.exportUiState(session,input),{code:'UI_STATE_CONFLICT'});
  assert.throws(()=>f.authoring.restoreUiState('other-session',{viewId:view.viewId,targetBuildId:view.activeBuildId!,uiStateSchemaVersion:1}),{code:'VIEW_NOT_OWNED'});
  const incompatible=f.authoring.restoreUiState(session,{viewId:view.viewId,targetBuildId:view.activeBuildId!,uiStateSchemaVersion:2});assert.equal(incompatible.status,'incompatible');assert.deepEqual(incompatible.snapshot,state);
  const before=canonicalJson(f.store.get<UiStateSnapshot>('view_ui_states',canonicalJson([session,view.viewId])));const dataset=f.store.get<{resources:ResourceRef[]}>('datasets',current.datasetId)!;f.store.put('datasets',current.datasetId,{...dataset,resources:[current.resources[0]]});
  const restored=f.authoring.restoreUiState(session,{viewId:view.viewId,targetBuildId:view.activeBuildId!,uiStateSchemaVersion:1});assert.equal(restored.status,'restored');assert.equal(restored.snapshot!.selectionEvidence[0].resources.length,1);assert.equal(restored.removedSelections.length,1);assert.equal(restored.removedSelections[0].resource.resourceId,'b');assert.equal(canonicalJson(f.store.get('view_ui_states',canonicalJson([session,view.viewId]))),before);
  const second=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:view.viewId}),'Second UI build');assert.throws(()=>f.authoring.restoreUiState(session,{viewId:view.viewId,targetBuildId:second.identity.buildId,uiStateSchemaVersion:1}),{code:'BRIDGE_IDENTITY_STALE'});
  const candidateRead=f.authoring.restoreUiState(session,{viewId:view.viewId,targetBuildId:second.identity.buildId,uiStateSchemaVersion:1},second.identity);assert.equal(candidateRead.status,'restored');assert.throws(()=>f.authoring.restoreUiState(session,{viewId:view.viewId,targetBuildId:second.identity.buildId,uiStateSchemaVersion:1},{...second.identity,documentNonce:'wrong'}),{code:'BRIDGE_IDENTITY_STALE'});
  assert.throws(()=>f.authoring.exportUiState(session,{...input,sourceBuildId:second.identity.buildId,expectedStateRevision:1}),{code:'BRIDGE_IDENTITY_STALE'});assert.equal(canonicalJson(f.store.get('view_ui_states',canonicalJson([session,view.viewId]))),before);
});

test('UI state size limits and close keep/discard retain workspaces and immutable assets',async t=>{
  const f=setup(t,{maxUiStateBytes:32}),candidate=await prepared(f),view=f.authoring.confirmReady(session,candidate.ready).view;
  assert.throws(()=>f.authoring.exportUiState(session,{viewId:view.viewId,sourceBuildId:view.activeBuildId!,uiStateSchemaVersion:1,expectedStateRevision:0,value:{large:'x'.repeat(100)},selectionEvidence:[]}),{code:'UI_STATE_TOO_LARGE'});
  const saved=f.authoring.saveComponent(session,{viewId:view.viewId,expectedViewRevision:view.viewRevision,userRequest:'Save before close',mode:'save_as'}),draft=f.authoring.closeDraft(session,view.viewId,'keep');assert.equal(draft.status,'closed');assert.ok(existsSync(draft.workspacePath));
  const second=f.authoring.begin(session,{mode:'edit',viewId:view.viewId});assert.equal(second.draft.workspacePath,draft.workspacePath);assert.equal(f.authoring.closeDraft(session,view.viewId,'discard').status,'discarded');assert.ok(existsSync(second.draft.workspacePath));assert.ok(f.sources.verify(view.activeBuildId!).valid);assert.ok(f.store.get('components',saved.componentId));
});


test('inspect distinguishes a previously confirmed build from a newer failed display and gives scoped advice',async t=>{
 const f=setup(t),first=await prepared(f,undefined,'Confirmed',false);
 const one=f.authoring.openDisplay(session,{...openInput(first.publication),displayId:'confirmed'}),frame=displayFrame(first.publication,one.display,'confirmed');
 f.authoring.authorizeDisplayFrame(session,frame);f.authoring.confirmDisplayReady(session,{...first.ready,...frame});
 const second=await prepared(f,f.authoring.begin(session,{mode:'edit',viewId:first.begin.view.viewId}),'New',false);
 const error=(code:string)=>{const two=f.authoring.openDisplay(session,{...openInput(second.publication),displayId:'failed-'+code});return f.authoring.reportDisplayError(session,{viewId:second.begin.view.viewId,publicationId:second.publication.publicationId,buildId:second.publication.candidateBuildId,displayId:two.display.displayId,displayGeneration:two.display.generation,error:{phase:'bridge',code,message:'Fixture display failure'}});};
 error('BRIDGE_TIMEOUT');
 let inspected=f.authoring.inspect(session,{publicationId:second.publication.publicationId}),summary=inspected.summary;
 assert.equal(summary.lastConfirmedDisplay?.buildId,first.publication.candidateBuildId);
 assert.equal(summary.preparedBuild?.buildId,second.publication.candidateBuildId);
 assert.equal(summary.currentDisplay?.state,'failed');assert.equal(summary.nextAction.action,'reopen_same_build');assert.equal(summary.requiresRebuild,false);
 assert.equal(summary.nextAction.target.publicationId,second.publication.publicationId);
 const {compileSchema}=await import('../../packages/app-contracts/src/index.ts');assert.deepEqual(compileSchema(APP_AUTHORING_DESCRIPTORS.find(item=>item.capabilityId==='apps.authoring.inspect')!.outputSchema)(JSON.parse(JSON.stringify(inspected))),[]);
 error('UNCLASSIFIED_ERROR');summary=f.authoring.inspect(session,{publicationId:second.publication.publicationId}).summary;assert.equal(summary.requiresRebuild,null);assert.equal(summary.nextAction.action,'inspect_evidence');
 error('COMPONENT_SCRIPT_ERROR');summary=f.authoring.inspect(session,{publicationId:second.publication.publicationId}).summary;assert.equal(summary.requiresRebuild,true);assert.equal(summary.nextAction.action,'fix_source');
 const old=f.authoring.inspect(session,{publicationId:first.publication.publicationId}).summary;assert.equal(old.currentDisplay?.buildId,first.publication.candidateBuildId);assert.equal(old.nextAction.action,'open_prepared_build');
});

test('inspect retains a successful build when preview environment is incomplete',async t=>{
 const f=setup(t),begin=f.authoring.begin(session,{mode:'new'});project(begin);const built=await build(f,begin);
 assert.equal(f.authoring.inspect(session,{attemptId:begin.attempt.attemptId}).summary.nextAction.action,'run_preview');
 await preview(f,begin,built.receipt,value=>{value.verdict='INCOMPLETE';value.assertionResults[0].status='BLOCKED';value.assertionResults[0].actual='PREVIEW_CAPABILITY_UNAVAILABLE';});
 const summary=f.authoring.inspect(session,{attemptId:begin.attempt.attemptId}).summary;
 assert.equal(summary.blockedStage,'preview');assert.equal(summary.nextAction.action,'repair_preview_environment');assert.equal(summary.requiresRebuild,false);assert.equal(summary.lastConfirmedDisplay,null);assert.equal(summary.preparedBuild,null);
});
