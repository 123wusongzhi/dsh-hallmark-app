import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../packages/app-presentation/src/authoring.ts';
import {APP_AUTHORING_DESCRIPTORS} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import type {AuthoringAttempt,AuthoringDraft,AuthoringView,BuildExecutionEvidence,BuildReceipt,FrameAuthorizationInput,PreviewReceipt,PreviewValidationEvidence,RenderReadyInput,UiStateSnapshot} from '../../packages/app-presentation/src/authoring-types.ts';
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
async function prepared(f:ReturnType<typeof setup>,begin=f.authoring.begin(session,{mode:'new'}),title='First build'){
  project(begin,title);const built=await build(f,begin),tested=await preview(f,begin,built.receipt);
  const publication=f.authoring.publish(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:built.receipt.archiveBuildId!,buildReceiptId:built.receipt.receiptId,previewReceiptId:tested.receipt.receiptId});
  const identity:FrameAuthorizationInput={publicationId:publication.publicationId,attemptId:begin.attempt.attemptId,attemptEpoch:begin.attempt.epoch,buildId:publication.candidateBuildId,frameInstanceId:`frame-${begin.attempt.attemptId}`,documentNonce:`nonce-${begin.attempt.attemptId}`};
  f.authoring.authorizeFrame(session,identity);const ready:RenderReadyInput={...identity,viewId:begin.view.viewId,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:structuredClone(assertions)}};
  return {begin,built,tested,publication,identity,ready};
}

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

test('failed mounts and expired readiness preserve last good bytes and a recoverable edit workspace',async t=>{
  let now=new Date('2026-10-07T00:00:00.000Z');const f=setup(t,{clock:()=>now}),first=await prepared(f);const good=f.authoring.confirmReady(session,first.ready).view;
  const next=f.authoring.begin(session,{mode:'edit',viewId:good.viewId}),second=await prepared(f,next,'Second build');
  assert.equal(f.store.get<AuthoringView>('views',good.viewId)?.activeBuildId,good.activeBuildId);now=new Date(now.getTime()+16000);
  assert.throws(()=>f.authoring.confirmReady(session,second.ready),{code:'FRAME_NOT_READY'});f.authoring.failMount(session,second.publication.publicationId,'Timed out while loading');
  const view=f.store.get<AuthoringView>('views',good.viewId)!;assert.equal(view.activeBuildId,good.activeBuildId);assert.equal(view.lastGoodBuildId,good.lastGoodBuildId);assert.equal(view.source?.buildId,good.source?.buildId);assert.equal(view.pendingPublicationId,null);assert.ok(existsSync(join(next.draft.workspacePath,'src','Component.tsx')));
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
