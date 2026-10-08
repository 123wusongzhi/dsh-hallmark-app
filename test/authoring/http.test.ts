import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,mkdirSync,symlinkSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {createAppsClient,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import {createAppsPresentationHandlers} from '../../packages/plugin-apps/client/component-handlers.ts';
import type {AuthoringDraft,AuthoringAttempt,AuthoringView,BuildReceipt,PreviewReceipt,StartMountInput,ViewPublication} from '../../packages/app-presentation/src/authoring-types.ts';
// @ts-expect-error Actual isolated browser runner is also exported by the standalone CLI.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('runners automatically register real build and preview receipts and persist diagnostics',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup();try{
  const begin=await f.begin({mode:'new'});project(begin.draft.workspacePath,'Auto record');
  const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  // @ts-expect-error Standalone build runner.
  const {runAuthoringBuild}=await import('../../scripts/apps-authoring-build.mjs');
  const input={sessionId:'original',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile},autoRecord:true};
  const built=await runAuthoringBuild(input);assert.equal(built.verdict,'PASS');assert.ok(built.buildReceiptId);assert.equal(f.store.list('build_receipts').length,1);assert.deepEqual(JSON.parse(readFileSync(built.previewRequestPath,'utf8')),built.previewRequest);
  const tested=await runAuthoringPreview({...built.previewRequest,browserExecutable:browser,assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]});
  assert.equal(tested.report.verdict,'PASS');assert.ok(tested.summary.previewReceiptId);assert.equal(f.store.list('preview_receipts').length,1);
  const summary=JSON.parse(readFileSync(tested.summaryPath,'utf8'));assert.equal(summary.failures.length,0);assert.equal(summary.viewports.length,2);assert.ok(existsSync(summary.viewports[0].screenshot));
  await assert.rejects(runAuthoringPreview({...built.previewRequest,buildReportRef:{path:'missing'}}));
  assert.equal(JSON.parse(readFileSync(tested.summaryPath,'utf8')).verdict,'PASS');
  const failed=JSON.parse(readFileSync(tested.summaryPath+'.error.json','utf8'));assert.equal(failed.verdict,'ERROR');assert.equal(failed.stage,'preview');assert.ok(failed.error.message);
 }finally{await f.cleanup();}
});

test('live preview adapter reads real binding shape, invokes pages, validates selection and refreshes',async()=>{
 const f=await setup();try{
  f.runtime.addConnection({appId:'notes',connectionId:'preview-notes',displayName:'Preview notes',config:{},configRevision:1,enabled:true});f.runtime.bind({sessionId:'original',appId:'notes',connectionId:'preview-notes',enabled:true,boundAt:new Date().toISOString()});
  const at=new Date().toISOString();for(const id of ['a','b'])f.store.put('provider_records',canonicalJson(['notes','preview-notes','notes',id]),{appId:'notes',connectionId:'preview-notes',namespace:'notes',recordId:id,value:{id,title:id,content:'Preview fixture',revision:'1',createdAt:at,updatedAt:at}});
  const begin=await f.begin({mode:'new',bindings:[{bindingId:'notes',appId:'notes',connectionId:'preview-notes',capabilityId:'notes.notes.list',capabilityMajor:1,input:{limit:1},projection:[],refresh:{mode:'manual'}}]});
  await f.presentation.refreshView('original',begin.view.viewId,{kind:'agent',sessionId:'original',nativeCallId:'preview-init'});
  const keyFile=join(f.directory,'preview-key');writeFileSync(keyFile,f.token);
  // @ts-expect-error Standalone runner adapter.
  const {previewData}=await import('../../scripts/preview-data.mjs');
  const adapter=await previewData({mode:'live_readonly',sessionId:'original',viewId:begin.view.viewId,runtime:{url:f.url,keyFile},data:{fake:true}});
  assert.deepEqual(adapter.data,f.presentation.getData('original',begin.view.viewId));
  const binding=adapter.data.bindings[0],{projection,...query}=binding.query;assert.equal(query.capabilityId,'notes.notes.list');
  const page=await adapter.readOnlyCapability({...query,input:{...query.input,cursor:'1'}});assert.equal(page.status,'ok');assert.equal(page.data.items[0].note.id,'b');
  assert.equal((await adapter.validateSelection({bindingId:binding.bindingId,datasetRevision:binding.revision,resources:binding.resources})).status,'validated');
  await assert.rejects(adapter.validateSelection({bindingId:binding.bindingId,datasetRevision:binding.revision,resources:[page.data.items[0].resource]}),/not present/);
  const boundPage=(await adapter.readBindingPage({bindingId:'notes',cursor:'1'})).bindings[0];
  assert.equal(boundPage.resources[0].resourceId,'b');
  assert.equal((await adapter.validateSelection({bindingId:'notes',datasetRevision:boundPage.revision,resources:boundPage.resources})).status,'validated');
  await assert.rejects(adapter.validateSelection({bindingId:'notes',datasetRevision:binding.revision,resources:binding.resources}),/current ready dataset/);
  assert.deepEqual(await adapter.refreshData({bindingIds:['notes']}),f.presentation.getData('original',begin.view.viewId));
  await adapter.closeData();
  await assert.rejects(adapter.readOnlyCapability({...query,capabilityId:'notes.notes.create',input:{title:'No write'}}),/PREVIEW_CAPABILITY_NOT_READ_ONLY/);
 }finally{await f.cleanup();}
});
async function setup(){
 const directory=mkdtempSync(join(tmpdir(),'apps-authoring-http-')),instance=composeAppsRuntime(directory,{connections:[]}),token='a'.repeat(64),server=createAppsServer({...instance,token});
 await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const call=async(path:string,input?:unknown)=>{const response=await fetch(url+path,{method:input===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...(input===undefined?{}:{'content-type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,body:await response.json()};};
 const action=async(capabilityId:string,input:unknown,requestId=randomUUID())=>{const result=await call('/v1/presentation-actions',{sessionId:'original',capabilityId,input,requestId});assert.equal(result.status,200);return result.body;};
 const begin=async(input:unknown)=>{const result=await action('apps.authoring.begin',input);assert.equal(result.status,'ok',JSON.stringify(result));return result.data as {draft:AuthoringDraft;attempt:AuthoringAttempt;view:AuthoringView};};
 return {...instance,directory,url,token,call,action,begin,async cleanup(){server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));await instance.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())));rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}};
}
function project(workspace:string,title:string){
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>${title}</h1><button id="toggle">Select</button><output id="result">unselected</output><script>window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;const m=e.data;if(m.type==='hello')parent.postMessage({channel:m.channel,protocolVersion:'2.0',sessionId:m.sessionId,viewId:m.viewId,buildId:m.buildId,frameInstanceId:m.frameInstanceId,requestId:'data',method:'getData',params:null},location.origin);});parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'document'},location.origin);document.querySelector('#toggle').onclick=()=>document.querySelector('#result').textContent='selected';</script>`;
 writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
}
function openInput(publication:ViewPublication):StartMountInput{return {viewId:publication.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,expectedViewRevision:publication.expectedViewRevision};}
test('HTTP authoring validates real receipt schemas, authorizes candidate document, commits once and keeps fixed historical publications',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup();try{
  const prepare=async(mode:'new'|'edit',viewId?:string,title='First')=>{
   const begin=await f.begin({mode,...(viewId?{viewId}:{})});project(begin.draft.workspacePath,title);
   const build=await f.evidenceRunner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.presentation.sources!,onStart:async()=>{const marked=await f.call('/v1/authoring/markBuilding',{sessionId:'original',params:{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch}});assert.equal(marked.body.state,'building');}});
   const built=await f.action('apps.authoring.record_build',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:build.reportRef});assert.equal(built.status,'ok',JSON.stringify(built));const receipt=built.data as BuildReceipt;
   const tested=await runAuthoringPreview({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,buildReportRef:build.reportRef,mode:'fixture',runner:f.evidenceRunner,sources:f.presentation.sources,browserExecutable:browser,data:{viewId:begin.view.viewId,bindings:[]},assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]});assert.equal(tested.report.verdict,'PASS',JSON.stringify(tested.report));
   const recorded=await f.action('apps.authoring.record_preview',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,reportRef:tested.reportRef});assert.equal(recorded.status,'ok',JSON.stringify(recorded));const preview=recorded.data as PreviewReceipt;
   assert.deepEqual(Object.keys(preview.viewportResults[0]).sort(),['id','contentWidthCssPx','heightCssPx','deviceScaleFactor','screenshot','pageErrors','unhandledRejections','failedRequests','bridgeReady','assertionIds'].sort());
   const published=await f.action('apps.authoring.publish',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:receipt.archiveBuildId,buildReceiptId:receipt.receiptId,previewReceiptId:preview.receiptId});assert.equal(published.status,'ok',JSON.stringify(published));const publication=published.data as ViewPublication;
   const params={publicationId:publication.publicationId,attemptId:begin.attempt.attemptId,attemptEpoch:begin.attempt.epoch,viewId:begin.view.viewId,buildId:receipt.archiveBuildId,frameInstanceId:randomUUID(),documentNonce:randomUUID(),clientFeatures:['renderReadyV1','uiStateV1']};
   const identity={protocolVersion:'2.0',sessionId:'original',viewId:params.viewId,buildId:params.buildId,frameInstanceId:params.frameInstanceId};
   return {begin,build,preview,publication,params,identity};
  };
  const first=await prepare('new'),viewId=first.begin.view.viewId;
  const fixed=(value:typeof first)=>`/v1/views/${viewId}?${new URLSearchParams({sessionId:'original',publicationId:value.publication.publicationId,buildId:value.publication.candidateBuildId})}`;
  const pending=await f.call(fixed(first));assert.equal(pending.status,200);assert.equal(pending.body.source,undefined);assert.equal(pending.body.publication.source.buildId,first.publication.candidateBuildId);assert.equal(pending.body.activeBuildId,null);assert.equal(pending.body.publication.state,'prepared');assert.equal(pending.body.publication.readyDeadlineAt,null);assert.equal(pending.body.publication.mountStartedAt,null);assert.equal(f.presentation.getView(viewId)?.source,undefined);
  const unauthorized=await f.call('/v1/component-extension',{...first.identity,channel:'dsh.apps.component.v2',type:'extension',feature:'renderReadyV1',action:'ready',requestId:'not-granted',params:{}});assert.equal(unauthorized.status,400);
  assert.equal((await f.call('/v1/authoring/authorizeFrame',{sessionId:'foreign',params:first.params})).status,400);
  const notOpened=await f.call('/v1/authoring/authorizeFrame',{sessionId:'original',params:first.params});assert.equal(notOpened.status,400);assert.equal(notOpened.body.error.code,'ATTEMPT_SUPERSEDED');
  const target=openInput(first.publication);
  for(const params of [{...target,unexpected:true},{...target,expectedViewRevision:undefined}])assert.equal((await f.call('/v1/authoring/startMount',{sessionId:'original',params})).status,400);
  const foreign=await f.call('/v1/authoring/startMount',{sessionId:'foreign',params:target});assert.equal(foreign.status,400);assert.equal(foreign.body.error.code,'VIEW_NOT_OWNED');
  const mismatched=await f.call('/v1/authoring/startMount',{sessionId:'original',params:{...target,buildId:'f'.repeat(64)}});assert.equal(mismatched.status,400);assert.equal(mismatched.body.error.code,'PUBLICATION_TARGET_MISMATCH');
  assert.deepEqual((await f.call(fixed(first))).body,pending.body);assert.equal(f.store.list('view_publications').length,1);assert.equal(f.store.list<{namespace:string}>('provider_records').filter(value=>value.namespace==='frame_grants').length,0);
  const opened=await f.call('/v1/authoring/startMount',{sessionId:'original',params:target});assert.equal(opened.status,200);assert.equal(opened.body.state,'mounting');assert.equal(Date.parse(opened.body.readyDeadlineAt)-Date.parse(opened.body.mountStartedAt),15000);
  const repeated=await Promise.all([f.call('/v1/authoring/startMount',{sessionId:'original',params:target}),f.call('/v1/authoring/startMount',{sessionId:'original',params:target})]);for(const result of repeated){assert.equal(result.status,200);assert.deepEqual(result.body,opened.body);}assert.equal(f.store.list('view_publications').length,1);const mounting=await f.call(fixed(first));assert.equal(mounting.body.publication.state,'mounting');assert.equal(mounting.body.source.buildId,first.publication.candidateBuildId);assert.equal(mounting.body.activeBuildId,null);assert.equal(f.presentation.getView(viewId)?.source,undefined);
  const grant=await f.call('/v1/authoring/authorizeFrame',{sessionId:'original',params:first.params});assert.deepEqual(grant.body.features,['renderReadyV1','uiStateV1']);
  const extension={...first.identity,channel:'dsh.apps.component.v2',type:'extension',feature:'renderReadyV1',action:'ready',requestId:'ready',params:{documentNonce:first.params.documentNonce,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:first.preview.assertionResults}}};
  const beforeForeignNonce=canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')});const foreignNonce=await f.call('/v1/component-extension',{...extension,params:{...extension.params,documentNonce:'foreign-document'}});assert.equal(foreignNonce.status,400);assert.equal(foreignNonce.body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')}),beforeForeignNonce);
  const bad=await f.call('/v1/component-extension',{...extension,params:{...extension.params,checks:{...extension.params.checks,dataRead:false}}});assert.equal(bad.body.error.code,'FRAME_RUNTIME_ERROR');assert.equal(f.presentation.getView(viewId)?.source,undefined);
  const ready=await f.call('/v1/component-extension',extension);assert.equal(ready.body.result.publication.state,'mounted');const revision=ready.body.result.view.viewRevision;
  assert.equal((await f.call(fixed(first))).body.viewRevision,revision);
  const ui=await f.call('/v1/component-extension',{...extension,feature:'uiStateV1',action:'write',params:{uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'saved'},selectionEvidence:[]}});assert.equal(ui.body.result.stateRevision,1);
  const second=await prepare('edit',viewId,'Second');assert.equal(f.presentation.getView(viewId)?.source?.buildId,first.publication.candidateBuildId);
  const secondPending=await f.call(fixed(second));assert.equal(secondPending.status,200);assert.equal(secondPending.body.publication.state,'prepared');assert.equal(secondPending.body.publication.source.buildId,second.publication.candidateBuildId);assert.equal(secondPending.body.source.buildId,first.publication.candidateBuildId);assert.equal(secondPending.body.activeBuildId,first.publication.candidateBuildId);assert.equal(secondPending.body.lastGoodBuildId,first.publication.candidateBuildId);assert.deepEqual(secondPending.body.source,f.presentation.getView(viewId)?.source);
  assert.equal((await f.call('/v1/authoring/startMount',{sessionId:'original',params:openInput(first.publication)})).status,400);assert.equal(f.store.list('view_publications').length,2);assert.equal((await f.call('/v1/authoring/startMount',{sessionId:'original',params:openInput(second.publication)})).body.state,'mounting');
  assert.equal((await f.call('/v1/authoring/authorizeFrame',{sessionId:'original',params:second.params})).status,200);
  const ready2=await f.call('/v1/component-extension',{...extension,...second.identity,params:{documentNonce:second.params.documentNonce,checks:{...extension.params.checks,assertionResults:second.preview.assertionResults}}});assert.equal(ready2.body.result.view.viewRevision,revision+1);
  const historical=await f.call(fixed(first));assert.equal(historical.body.source.buildId,first.publication.candidateBuildId);assert.equal(historical.body.viewRevision,revision);assert.equal(f.presentation.getView(viewId)?.source?.buildId,second.publication.candidateBuildId);
  const retired=await f.call('/v1/authoring/retireFrame',{sessionId:'original',params:{viewId,buildId:second.params.buildId,frameInstanceId:second.params.frameInstanceId,documentNonce:second.params.documentNonce}});assert.equal(retired.body.retired,true);
  assert.equal((await f.call('/v1/component-bridge',{...second.identity,channel:'dsh.apps.component.v2',method:'getData',requestId:'late',params:null})).body.error.code,'BRIDGE_IDENTITY_STALE');
  assert.equal((await f.call('/v1/authoring/negotiateFrame',{sessionId:'original',params:{viewId,buildId:second.params.buildId,frameInstanceId:second.params.frameInstanceId,documentNonce:randomUUID(),clientFeatures:['uiStateV1']}})).status,400);
  assert.equal((await f.call(fixed(first).replace('original','foreign'))).status,400);
 }finally{await f.cleanup();}
});

test('HTTP display opens the previewed archive, rejects invalid grants atomically and reopens after an inspectable actual-load error',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup();try{
  f.runtime.addConnection({appId:'notes',connectionId:'notes-display',displayName:'Isolated display notes',config:{},configRevision:1,enabled:true});f.runtime.bind({sessionId:'original',appId:'notes',connectionId:'notes-display',enabled:true,boundAt:new Date().toISOString()});
  const at=new Date().toISOString();for(const id of ['note-a','note-b'])f.store.put('provider_records',canonicalJson(['notes','notes-display','notes',id]),{appId:'notes',connectionId:'notes-display',namespace:'notes',recordId:id,value:{id,title:'Original data '+id,content:'P1 fixture',revision:'1',createdAt:at,updatedAt:at}});
  const prepare=async(begin:Awaited<ReturnType<typeof f.begin>>,title:string)=>{
   project(begin.draft.workspacePath,title);const build=await f.evidenceRunner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.presentation.sources!});const built=await f.action('apps.authoring.record_build',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:build.reportRef});assert.equal(built.status,'ok');const receipt=built.data as BuildReceipt;
   const tested=await runAuthoringPreview({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,buildReportRef:build.reportRef,mode:'fixture',runner:f.evidenceRunner,sources:f.presentation.sources,browserExecutable:browser,data:f.presentation.getData('original',begin.view.viewId),assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]});assert.equal(tested.report.verdict,'PASS');const recorded=await f.action('apps.authoring.record_preview',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:receipt.receiptId,reportRef:tested.reportRef});assert.equal(recorded.status,'ok');const preview=recorded.data as PreviewReceipt;
   const published=await f.action('apps.authoring.publish',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:receipt.archiveBuildId,buildReceiptId:receipt.receiptId,previewReceiptId:preview.receiptId});assert.equal(published.status,'ok');return {publication:published.data as ViewPublication,preview,receipt};
  };
  const begin=await f.begin({mode:'new',title:'Display P1',bindings:[{bindingId:'notes',appId:'notes',connectionId:'notes-display',capabilityId:'notes.notes.list',capabilityMajor:1,input:{limit:1},projection:[],refresh:{mode:'manual'}}]});await f.presentation.refreshView('original',begin.view.viewId,{kind:'agent',sessionId:'original',nativeCallId:'fixture-read'});const first=await prepare(begin,'P1'),target=openInput(first.publication),viewId=target.viewId;
  const state=()=>canonicalJson({views:f.store.list('views'),publications:f.store.list('view_publications'),records:f.store.list('provider_records')});
  const callOpen=(publication:ViewPublication,displayId:string)=>f.call('/v1/authoring/openDisplay',{sessionId:'original',params:{...openInput(publication),displayId}});
  const opened=await callOpen(first.publication,'http-display-one');assert.equal(opened.status,200,JSON.stringify(opened));assert.equal(opened.body.publication.state,'prepared');assert.equal(opened.body.publication.readyDeadlineAt,null);assert.equal(opened.body.source.buildId,target.buildId);assert.equal(opened.body.data.bindings[0].resources[0].resourceId,'note-a');
  const params={...target,displayId:opened.body.display.displayId,displayGeneration:opened.body.display.generation,frameInstanceId:randomUUID(),documentNonce:randomUUID(),clientFeatures:['renderReadyV1','uiStateV1','bindingPagesV1']};const {expectedViewRevision:_unused,...frameParams}=params;
  for(const bad of [{...frameParams,viewId:'foreign-view'},{...frameParams,clientFeatures:[123]},{...frameParams,buildId:'f'.repeat(64)}]){const before=state(),result=await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:bad});assert.equal(result.status,400);assert.equal(state(),before);}
  f.runtime.bind({sessionId:'original',appId:'notes',connectionId:'notes-display',enabled:false,boundAt:new Date().toISOString()});const beforeUnbound=state(),unbound=await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:frameParams});assert.equal(unbound.body.error.code,'CONNECTION_NOT_BOUND');assert.equal(state(),beforeUnbound);f.runtime.bind({sessionId:'original',appId:'notes',connectionId:'notes-display',enabled:true,boundAt:new Date().toISOString()});
  const authorized=await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:frameParams});assert.equal(authorized.status,200);assert.deepEqual(authorized.body.features,['renderReadyV1','uiStateV1','bindingPagesV1']);
  const identity={protocolVersion:'2.0',sessionId:'original',viewId,buildId:target.buildId,frameInstanceId:frameParams.frameInstanceId},extension={...identity,channel:'dsh.apps.component.v2',type:'extension',feature:'renderReadyV1',action:'ready',requestId:'display-ready',params:{documentNonce:frameParams.documentNonce,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:first.preview.assertionResults}}};
  const beforeNonce=state(),nonce=await f.call('/v1/component-extension',{...extension,params:{...extension.params,documentNonce:'foreign-nonce'}});assert.equal(nonce.status,400);assert.equal(nonce.body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(state(),beforeNonce);
  const failed=await f.call('/v1/authoring/reportDisplayError',{sessionId:'original',params:{viewId,publicationId:target.publicationId,buildId:target.buildId,displayId:params.displayId,displayGeneration:params.displayGeneration,error:{phase:'script',code:'COMPONENT_SCRIPT_ERROR',message:'Actual iframe script failure fixture'}}});assert.equal(failed.body.state,'failed');
  const inspected=await f.call('/v1/authoring/inspect',{sessionId:'original',params:{publicationId:target.publicationId}});assert.equal(inspected.body.latestDisplay.errors[0].code,'COMPONENT_SCRIPT_ERROR');assert.equal(inspected.body.attempt.state,'publish_ready');assert.equal(inspected.body.view.viewRevision,1);
  const reopened=await callOpen(first.publication,'http-display-two');assert.equal(reopened.status,200);assert.equal(reopened.body.display.generation,2);const secondParams={...frameParams,displayId:reopened.body.display.displayId,displayGeneration:2,frameInstanceId:randomUUID(),documentNonce:randomUUID()};
  // Use the real SDK and parent proxy against the HTTP grant boundary, including a
  // legacy SDK packet that omits its nonce. Preview's direct binding calls skip it.
  const nativeFetch=globalThis.fetch,originalWindow=globalThis.window,posts:any[]=[],listeners=new Set<(event:MessageEvent)=>void>(),displayIdentity={...identity,protocolVersion:'2.0' as const,frameInstanceId:secondParams.frameInstanceId};
  let sdk:ReturnType<typeof createAppsClient>|undefined,bridge:ComponentHost|undefined;
  try{
   globalThis.window={dispatchEvent:()=>true} as unknown as typeof window;
   globalThis.fetch=async(url,options)=>{
    if(!String(url).startsWith('/api/dsh-apps'))return nativeFetch(url,options);
    const resource=new URL(String(url),'http://display.test').searchParams.get('resource');
    if(resource==='hostCapabilities')return Response.json({adapterReady:false});
    if(resource==='componentFeatures')return Response.json({features:secondParams.clientFeatures});
    const body=JSON.parse(String(options?.body)),path=body.action==='authoring'?'/v1/authoring/'+body.operation:body.action==='componentBridge'?'/v1/component-bridge':'/v1/component-extension';
    const response=await f.call(path,body.action==='authoring'?{sessionId:body.sessionId,params:body.params}:body.request);return Response.json(response.body,{status:response.status});
   };
   const handlers=await createAppsPresentationHandlers(displayIdentity,new AbortController().signal,{publicationId:target.publicationId,attemptId:target.attemptId,attemptEpoch:target.attemptEpoch,displayId:secondParams.displayId,displayGeneration:secondParams.displayGeneration});
   bridge=new ComponentHost(displayIdentity,handlers,{extensionHandlers:handlers.extensions});
   const parent={postMessage:async(message:any)=>{
    posts.push(message);
    if(message.type==='hello'){secondParams.documentNonce=message.documentNonce;await handlers.authorizeFrame!(displayIdentity,message.documentNonce,message.clientFeatures);}
    const response=await bridge!.handle(message);if(response)for(const listener of listeners)listener({source:parent,origin:'http://display.test',data:response} as unknown as MessageEvent);
   }};
   const child={parent,location:{origin:'http://display.test'},addEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.add(listener),removeEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.delete(listener)} as unknown as Window;
   sdk=createAppsClient({window:child,timeoutMs:3000,clientFeatures:['renderReadyV1','uiStateV1','bindingPagesV1']});await sdk.hello();
   assert.equal((await sdk.getData() as any).bindings[0].resources[0].resourceId,'note-a');
   const ready=await sdk.renderReady({publicationId:target.publicationId,attemptId:target.attemptId,attemptEpoch:target.attemptEpoch,checks:extension.params.checks}) as any;assert.equal(ready.display.state,'ready');assert.equal(ready.view.viewRevision,2);
   const beforeCalls=f.store.list('invocations').length;
   assert.equal((await sdk.readBindingPage('notes','1') as any).bindings[0].resources[0].resourceId,'note-b');
   assert.equal(posts.at(-1).params.documentNonce,secondParams.documentNonce,'the SDK itself must send the authorized document nonce');
   assert.equal((await sdk.refresh(['notes']) as any).bindings[0].resources[0].resourceId,'note-a');
   const beforeInvoke=Date.now(),read=await sdk.invokeCapability({appId:'notes',connectionId:'notes-display',capabilityId:'notes.notes.get',capabilityVersion:'1.0.0',input:{id:'note-b'}});assert.equal(read.status,'ok',JSON.stringify(read));assert.equal((read as any).data.note.id,'note-b');assert.equal(Object.hasOwn(posts.at(-1).params,'deadlineAt'),false);
   const calls=f.store.list<any>('invocations').slice(beforeCalls);assert.deepEqual(calls.map(row=>row.request.capabilityId),['notes.notes.list','notes.notes.list','notes.notes.get']);assert.ok(calls.every(row=>row.request.source.kind==='component'&&row.request.source.frameInstanceId===secondParams.frameInstanceId&&row.result.status==='ok'));assert.ok(Date.parse(calls.at(-1).request.deadlineAt)>beforeInvoke);
   const legacyPage={...displayIdentity,channel:COMPONENT_CHANNEL,type:'extension' as const,feature:'bindingPagesV1' as const,action:'read',requestId:'old-sdk-page',params:{bindingId:'notes',cursor:'1'}};
   assert.equal((await f.call('/v1/component-extension',legacyPage)).body.error.code,'BRIDGE_IDENTITY_STALE');
   const legacyResult=await bridge.handle(legacyPage) as any;assert.equal(legacyResult.error,undefined);assert.equal(legacyResult.result.bindings[0].resources[0].resourceId,'note-b');
   const beforeWrong=f.store.list('invocations').length,wrong=await bridge.handle({...legacyPage,requestId:'wrong-sdk-page',params:{...legacyPage.params,documentNonce:'explicitly-wrong-document'}}) as any;assert.equal(wrong.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(f.store.list('invocations').length,beforeWrong);
  }finally{sdk?.dispose();bridge?.dispose();globalThis.fetch=nativeFetch;globalThis.window=originalWindow;}
  assert.equal((await f.call('/v1/component-extension',extension)).body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal((await f.call('/v1/component-bridge',{...identity,channel:'dsh.apps.component.v2',method:'getData',requestId:'old-frame',params:null})).body.error.code,'BRIDGE_IDENTITY_STALE');
  const ready2={...extension,frameInstanceId:secondParams.frameInstanceId,params:{...extension.params,documentNonce:secondParams.documentNonce}},ready=await f.call('/v1/component-extension',ready2);assert.equal(ready.body.result.display.state,'ready');assert.equal(ready.body.result.view.viewRevision,2);assert.equal((await f.call('/v1/component-extension',ready2)).body.result.view.viewRevision,2);
  const oldSdkUi={...ready2,feature:'uiStateV1',action:'write',params:{uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'SDK16-compatible'},selectionEvidence:[]}},uiBeforeMissingNonce=state(),missingUiNonce=await f.call('/v1/component-extension',oldSdkUi);assert.equal(missingUiNonce.body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(state(),uiBeforeMissingNonce);const writtenUi=await f.call('/v1/component-extension',{...oldSdkUi,params:{...oldSdkUi.params,documentNonce:secondParams.documentNonce}});assert.equal(writtenUi.status,200);assert.equal(writtenUi.body.result.stateRevision,1);const readUi=await f.call('/v1/component-extension',{...oldSdkUi,action:'read',params:{uiStateSchemaVersion:1,documentNonce:secondParams.documentNonce}});assert.deepEqual(readUi.body.result.snapshot.value,{search:'SDK16-compatible'});const uiBeforeNonce=state(),wrongUiNonce=await f.call('/v1/component-extension',{...oldSdkUi,params:{...oldSdkUi.params,documentNonce:'wrong-old-ui-document'}});assert.equal(wrongUiNonce.body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(state(),uiBeforeNonce);
  const directUiBefore=canonicalJson(f.store.list('view_ui_states'));for(const [operation,params] of [['exportUiState',{viewId,sourceBuildId:target.buildId,uiStateSchemaVersion:1,expectedStateRevision:0,value:{search:'bypass'},selectionEvidence:[]}],['restoreUiState',{viewId,targetBuildId:target.buildId,uiStateSchemaVersion:1}]] as const){const bypass=await f.call('/v1/authoring/'+operation,{sessionId:'original',params});assert.equal(bypass.body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal(canonicalJson(f.store.list('view_ui_states')),directUiBefore);}
  const next=await f.begin({mode:'edit',viewId});f.presentation.createView('original',{viewId,title:'P2',bindings:[]});const second=await prepare(next,'P2'),p2=await callOpen(second.publication,'http-P2'),p2Params={...secondParams,...openInput(second.publication),displayId:p2.body.display.displayId,displayGeneration:p2.body.display.generation,frameInstanceId:randomUUID(),documentNonce:randomUUID()};const {expectedViewRevision:_p2Revision,...p2Frame}=p2Params;assert.equal((await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:p2Frame})).status,200);const p2Ready={...ready2,buildId:second.publication.candidateBuildId,frameInstanceId:p2Frame.frameInstanceId,params:{...extension.params,documentNonce:p2Frame.documentNonce}};assert.equal((await f.call('/v1/component-extension',p2Ready)).body.result.view.viewRevision,3);
  const historical=await callOpen(first.publication,'http-P1-history');assert.equal(historical.status,200);assert.equal(historical.body.view.source.buildId,first.publication.candidateBuildId);assert.equal(historical.body.data.bindings[0].resources[0].resourceId,'note-a');const historicalData=await f.call(`/v1/views/${viewId}/data?`+new URLSearchParams({sessionId:'original',publicationId:target.publicationId,buildId:target.buildId,displayId:historical.body.display.displayId,displayGeneration:String(historical.body.display.generation)}));assert.equal(historicalData.status,200);assert.equal(historicalData.body.bindings[0].bindingId,'notes');assert.equal((await f.call(`/v1/views/${viewId}/data?sessionId=original`)).body.bindings.length,0);
  const historyFrame={...secondParams,displayId:historical.body.display.displayId,displayGeneration:historical.body.display.generation,frameInstanceId:randomUUID(),documentNonce:randomUUID()};assert.equal((await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:historyFrame})).status,200);const historyReady={...ready2,frameInstanceId:historyFrame.frameInstanceId,params:{...extension.params,documentNonce:historyFrame.documentNonce}},historyResult=await f.call('/v1/component-extension',historyReady);assert.equal(historyResult.body.result.view.source.buildId,first.publication.candidateBuildId);assert.equal(f.presentation.getView(viewId)?.source?.buildId,second.publication.candidateBuildId);assert.equal(f.presentation.getView(viewId)?.viewRevision,3);
  const retireHistory=(frame:typeof historyFrame)=>f.call('/v1/authoring/retireFrame',{sessionId:'original',params:{viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce:frame.documentNonce}});
  const remountFrame={...historyFrame,frameInstanceId:randomUUID(),documentNonce:randomUUID()},historyBridge=(frame:{frameInstanceId:string},requestId:string)=>f.call('/v1/component-bridge',{protocolVersion:'2.0',sessionId:'original',viewId,buildId:historyFrame.buildId,frameInstanceId:frame.frameInstanceId,channel:'dsh.apps.component.v2',method:'getData',requestId,params:null});
  const liveHolds=await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:remountFrame});assert.equal(liveHolds.body.error.code,'BRIDGE_IDENTITY_STALE');
  assert.equal((await historyBridge(historyFrame,'live-document')).status,200);
  const closed=await retireHistory(historyFrame);assert.equal(closed.status,200);assert.equal(closed.body.retired,true);
  assert.equal((await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:remountFrame})).status,200);
  assert.equal((await historyBridge(historyFrame,'retired-document')).body.error.code,'BRIDGE_IDENTITY_STALE');assert.equal((await historyBridge(remountFrame,'remounted-document')).status,200);
  const anotherDocument={...remountFrame,frameInstanceId:randomUUID(),documentNonce:randomUUID()};assert.equal((await f.call('/v1/authoring/authorizeDisplayFrame',{sessionId:'original',params:anotherDocument})).body.error.code,'BRIDGE_IDENTITY_STALE');
  const remountedReady=await f.call('/v1/component-extension',{...historyReady,frameInstanceId:remountFrame.frameInstanceId,requestId:'remount-ready',params:{...historyReady.params,documentNonce:remountFrame.documentNonce}});assert.equal(remountedReady.body.result.display.state,'ready');assert.equal(remountedReady.body.result.view.source.buildId,first.publication.candidateBuildId);
  assert.equal(f.store.list('build_receipts').length,2);assert.equal(f.store.list('preview_receipts').length,2);assert.equal(f.store.list('components').length,0);
 }finally{await f.cleanup();}
});

test('original command CLI marks building before dispatch; cancellation stops that process and rejects a late completion',{timeout:30000},async()=>{
 const f=await setup();try{
  const begin=await f.begin({mode:'new'});project(begin.draft.workspacePath,'Cancel');writeFileSync(join(begin.draft.workspacePath,'hang.mjs'),"console.log('started owned build');setInterval(()=>{},1000);");writeFileSync(join(f.directory,'service-key'),f.token);
  const input=join(f.directory,'build-request.json');writeFileSync(input,JSON.stringify({sessionId:'original',attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'hang.mjs'],evidenceRoot:f.evidenceRunner.root,archiveRoot:f.presentation.sources!.directory,runtime:{url:f.url,keyFile:join(f.directory,'service-key')}}));
  const child=spawn(process.execPath,[resolve('scripts/apps-authoring-build.mjs'),input],{stdio:['ignore','pipe','pipe'],windowsHide:true});let output='',errors='';child.stdout.on('data',value=>{output+=value});child.stderr.on('data',value=>{errors+=value});
  const completed=new Promise<number|null>((accept,reject)=>{child.once('error',reject);child.once('close',accept);});
  for(let n=0;n<100&&f.store.get<AuthoringAttempt>('authoring_attempts',begin.attempt.attemptId)?.state!=='building';n++)await new Promise(accept=>setTimeout(accept,20));assert.equal(f.store.get<AuthoringAttempt>('authoring_attempts',begin.attempt.attemptId)?.state,'building');
  const cancelled=await f.action('apps.authoring.cancel',{attemptId:begin.attempt.attemptId,expectedEpoch:begin.attempt.epoch,reason:'Explicit test cancellation'});assert.equal(cancelled.status,'ok');assert.equal(cancelled.data.status,'cancelled');assert.equal(await completed,1,errors);
  const report=JSON.parse(output.trim());assert.equal(report.verdict,'FAIL');const late=await f.action('apps.authoring.record_build',{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:report.reportRef});assert.equal(late.status,'failed');assert.equal(late.error.code,'ATTEMPT_SUPERSEDED');assert.equal(f.store.list('build_receipts').length,0);
 }finally{await f.cleanup();}
});


test('active source reopens after another build has display history',async()=>{
 const f=await setup();try{
  const view=f.presentation.createView('original',{title:'Existing product table'}),buildId='active-build';
  f.store.put('views',view.viewId,{...view,source:{buildId,directory:f.directory,entry:'index.html',files:['index.html']},activeBuildId:buildId,validationStatus:'legacy_unverified'});
  f.store.put('provider_records','component-display:newer',{appId:'apps',connectionId:'presentation',namespace:'component_displays',recordId:'component-display:newer',value:{displayId:'newer',ownerSessionId:'original',viewId:view.viewId,buildId:'new-build',state:'opening'}});
  const identity={protocolVersion:'2.0',sessionId:'original',viewId:view.viewId,buildId,frameInstanceId:randomUUID()},documentNonce=randomUUID();
  const params={viewId:view.viewId,buildId,frameInstanceId:identity.frameInstanceId,documentNonce,clientFeatures:['renderReadyV1']};
  const granted=await f.call('/v1/authoring/negotiateFrame',{sessionId:'original',params});
  assert.equal(granted.status,200,JSON.stringify(granted.body));
  const request={...identity,channel:'dsh.apps.component.v2',method:'getData',requestId:randomUUID(),params:null};
  const data=await f.call('/v1/component-bridge',request);assert.equal(data.status,200,JSON.stringify(data.body));assert.equal(data.body.result.viewId,view.viewId);
  await f.call('/v1/authoring/retireFrame',{sessionId:'original',params:{viewId:view.viewId,buildId,frameInstanceId:identity.frameInstanceId,documentNonce}});
  assert.equal((await f.call('/v1/component-bridge',{...request,requestId:randomUUID()})).body.error.code,'BRIDGE_IDENTITY_STALE');
 }finally{await f.cleanup();}
});


test('check resumes lost registration responses without rebuilding or repeating preview and never publishes',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup(),originalFetch=globalThis.fetch;try{
  f.runtime.addConnection({appId:'notes',connectionId:'resume-notes',displayName:'Resume notes',config:{},configRevision:1,enabled:true});f.runtime.bind({sessionId:'original',appId:'notes',connectionId:'resume-notes',enabled:true,boundAt:new Date().toISOString()});
  const begin=await f.begin({mode:'new',bindings:[{bindingId:'notes',appId:'notes',connectionId:'resume-notes',capabilityId:'notes.notes.list',capabilityMajor:1,input:{limit:1},projection:[],refresh:{mode:'manual'}}]});project(begin.draft.workspacePath,'Resume check');const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  // @ts-expect-error Standalone combined runner.
  const {runAuthoringCheck}=await import('../../scripts/apps-authoring-check.mjs');
  const request={build:{sessionId:'original',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile}},preview:{browserExecutable:browser,requiredMethods:['getData'],assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]}};
  const drop=new Set(['apps.authoring.record_build','apps.authoring.record_preview']);
  globalThis.fetch=async(url,options)=>{const response=await originalFetch(url,options);const capability=typeof options?.body==='string'?JSON.parse(options.body).capabilityId:undefined;if(drop.delete(capability))throw Error('Simulated lost receipt response');return response;};
  await assert.rejects(runAuthoringCheck(request),/lost receipt/);
  assert.equal(f.store.list('build_receipts').length,1);assert.equal(f.store.list('preview_receipts').length,0);
  await assert.rejects(runAuthoringCheck(request),/lost receipt/);
  assert.equal(f.store.list('preview_receipts').length,1);
  const count=()=>readdirSync(request.build.evidenceRoot).filter(name=>/^(build|preview)-.*\.json$/.test(name)).length;
  const before=count(),resumed=await runAuthoringCheck(request);
  const oldData=f.presentation.getData('original',begin.view.viewId);
  await f.presentation.refreshView('original',begin.view.viewId,{kind:'agent',sessionId:'original',nativeCallId:'refresh-after-success'});
  assert.notDeepEqual(f.presentation.getData('original',begin.view.viewId),oldData);
  const repeated=await runAuthoringCheck(request);
  assert.equal(resumed.verdict,'PASS');assert.equal(resumed.reusedBuild,true);assert.equal(resumed.reusedPreview,true);assert.equal(repeated.buildId,resumed.buildId);assert.equal(repeated.verifiedAt,resumed.verifiedAt);assert.equal(count(),before);
  assert.equal(f.store.list('view_publications').length,0);assert.equal(f.store.list('components').length,0);
  await assert.rejects(runAuthoringCheck({...request,preview:{...request.preview,assertions:[{...request.preview.assertions[0],expected:'changed'}]}}),{code:'NEW_ATTEMPT_REQUIRED'});assert.equal(count(),before);
  assert.equal(JSON.parse(readFileSync(resumed.summaryPath,'utf8')).verdict,'PASS');
  assert.equal(JSON.parse(readFileSync(resumed.summaryPath+'.error.json','utf8')).error.code,'NEW_ATTEMPT_REQUIRED');
  writeFileSync(join(begin.draft.workspacePath,'input.html'),'changed source');
  await assert.rejects(runAuthoringCheck(request),{code:'NEW_ATTEMPT_REQUIRED'});assert.equal(count(),before);
 }finally{globalThis.fetch=originalFetch;await f.cleanup();}
});

test('unregistered changed preview plan reruns only preview while build is reused',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup();try{
  const begin=await f.begin({mode:'new'});project(begin.draft.workspacePath,'Preview change');const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  // @ts-expect-error Standalone build runner.
  const {runAuthoringBuild}=await import('../../scripts/apps-authoring-build.mjs');
  const input={sessionId:'original',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile},autoRecord:true};
  const built=await runAuthoringBuild(input),plan={...built.previewRequest,autoRecord:false,browserExecutable:browser,assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]};
  const first=await runAuthoringPreview(plan),second=await runAuthoringPreview({...plan,assertions:[...plan.assertions,{id:'heading',selector:'h1',check:'text',expected:'Preview change'}]});
  assert.equal(second.report.verdict,'PASS');assert.equal(second.summary.reusedPreview,false);assert.notEqual(first.reportRef.sha256,second.reportRef.sha256);
  const reused=await runAuthoringBuild(input);assert.equal(reused.reusedBuild,true);assert.equal(reused.reportRef.sha256,built.reportRef.sha256);assert.equal(f.store.list('build_receipts').length,1);
 }finally{await f.cleanup();}
});


test('packed check CLI completes four steps and repeats without new execution',{skip:!existsSync(browser)||!existsSync('bundles/apps/lib/apps-authoring-check.js'),timeout:60000},async()=>{
 const f=await setup();try{
  const begin=await f.begin({mode:'new'});project(begin.draft.workspacePath,'Packed check');const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  const request={build:{sessionId:'original',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:existsSync('C:/Users/wubil/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe')?['C:/Users/wubil/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe','--expose-internals','build.mjs']:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile}},preview:{browserExecutable:browser,requiredMethods:['getData'],assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]}};
  const path=join(f.directory,'check.json');writeFileSync(path,JSON.stringify(request));const entry=resolve('bundles/apps/lib/apps-authoring-check.js');
  const run=()=>new Promise<any>((accept,reject)=>{const child=spawn(process.platform==='win32'?'pwsh':process.execPath,process.platform==='win32'?['-NoProfile','-File',resolve('bundles/apps/lib/apps-authoring-check.ps1'),path]:[entry,path],{cwd:f.directory,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error(err||out));try{const value=JSON.parse(out);if(process.platform==='win32'){assert.equal(value.exitCode,0);assert.ok(existsSync(value.stdoutPath));assert.ok(existsSync(value.stderrPath));accept(value.result);}else accept(value);}catch(error){reject(error);}});});
  writeFileSync(path,JSON.stringify({...request,prepare:true,build:{...request.build,sourceRevision:999}}));
  const prepared=await run();assert.equal(prepared.stage,'prepared');const ready=JSON.parse(readFileSync(prepared.requestPath,'utf8'));assert.equal(ready.build.sourceRevision,begin.attempt.sourceRevision);writeFileSync(path,JSON.stringify(ready));
  const first=await run(),second=await run();assert.equal(first.verdict,'PASS');assert.equal(first.reusedBuild,false);assert.equal(second.reusedBuild,true);assert.equal(second.reusedPreview,true);assert.equal(first.buildReceiptId,second.buildReceiptId);assert.equal(first.previewReceiptId,second.previewReceiptId);assert.equal(f.store.list('view_publications').length,0);assert.equal(f.store.list('components').length,0);
 }finally{await f.cleanup();}
});


test('prepared product template checks its single plan, pages without attachments and resumes after refresh',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup();try{
  // Real presentation/HTTP/SDK/browser; only the external business provider is a fixture.
  const invoke=f.runtime.invoke.bind(f.runtime);
  f.runtime.invoke=async request=>{if(request.capabilityId!=='hallmark.products.list')return invoke(request);const input=request.input as {cursor?:string;limit:number},offset=Number(input.cursor??0);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{total:5,cursor:offset+2<5?String(offset+2):null,products:Array.from({length:Math.min(2,5-offset)},(_,index)=>({storeId:'store',productId:String(offset+index),offerId:'offer-'+(offset+index),title:'Product '+(offset+index),sku:'sku-'+(offset+index),currency:'CNY',pricing:{sellerMinor:4497},profit:{purchaseMinor:2663,actualMargin:0.05}}))}};};
  const begin=await f.begin({mode:'new',bindings:[{bindingId:'products',appId:'hallmark',connectionId:'fixture-products',capabilityId:'hallmark.products.list',capabilityMajor:1,input:{storeId:'store',limit:2},projection:[],refresh:{mode:'manual'}}]});
  // @ts-expect-error Installable generator.
  const {createAppsSource}=await import('../../scripts/create-apps-source.mjs');
  await createAppsSource({directory:begin.draft.workspacePath,sdkDirectory:resolve('bundles/apps/sdk/component-runtime'),template:'product-list'});
  const modules=join(begin.draft.workspacePath,'node_modules');mkdirSync(join(modules,'@dsh'),{recursive:true});
  for(const name of ['react','react-dom','esbuild'])symlinkSync(resolve('node_modules',name),join(modules,name),'junction');
  symlinkSync(resolve('bundles/apps/sdk/component-runtime'),join(modules,'@dsh/apps-component-runtime'),'junction');
  writeFileSync(join(begin.draft.workspacePath,'package-lock.json'),'{}');const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  // @ts-expect-error Standalone runner.
  const {runAuthoringCheck}=await import('../../scripts/apps-authoring-check.mjs');
  const request={build:{sessionId:'original',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile}},preview:{...JSON.parse(readFileSync(join(begin.draft.workspacePath,'.preview','plan.json'),'utf8')),browserExecutable:browser}};
  const prepared=await runAuthoringCheck({prepare:true,build:{...request.build,epoch:undefined,sourceRevision:999,viewId:'wrong',workspacePath:'wrong'},preview:{browserExecutable:browser}});
  assert.equal(prepared.stage,'prepared');assert.ok(prepared.requestPath.startsWith(request.build.evidenceRoot));
  const preparedRequest=JSON.parse(readFileSync(prepared.requestPath,'utf8'));
  assert.equal(preparedRequest.build.sourceRevision,begin.attempt.sourceRevision);assert.equal(preparedRequest.build.workspacePath,begin.draft.workspacePath);
  assert.equal(preparedRequest.preview.assertions,undefined);
  const first=await runAuthoringCheck(preparedRequest);assert.equal(first.verdict,'PASS',JSON.stringify(first));
  const previewSummary=JSON.parse(readFileSync(first.previewSummaryPath,'utf8')),report=JSON.parse(readFileSync(previewSummary.reportRef.path,'utf8')).report;
  for(const view of report.viewportResults)assert.ok(new Set(view.bindingSnapshots.map((binding:any)=>binding.revision)).size>1,'records the revisions read during refresh and paging');
  const second=await runAuthoringCheck(preparedRequest);assert.equal(second.reusedBuild,true);assert.equal(second.reusedPreview,true);assert.equal(second.verifiedAt,first.verifiedAt);
  const plan=JSON.parse(readFileSync(preparedRequest.preview.planPath,'utf8'));plan.assertions.push({id:'extra',selector:'h1',check:'visible',expected:true});writeFileSync(preparedRequest.preview.planPath,JSON.stringify(plan));
  await assert.rejects(runAuthoringCheck(preparedRequest),(error:any)=>{assert.equal(error.code,'NEW_ATTEMPT_REQUIRED');assert.equal(JSON.parse(readFileSync(error.summaryPath,'utf8')).stage,'preview');return true;});
  assert.equal(first.viewports.length,2);for(const view of first.viewports){assert.deepEqual(view.screenshots.map((shot:any)=>shot.afterCase),['initial','next']);assert.ok(existsSync(view.screenshots[1].path));}
  assert.equal(f.store.list('view_publications').length,0);
 }finally{await f.cleanup();}
});


test('failed build and incomplete preview are recorded and lost responses resume original reports',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await setup(),originalFetch=globalThis.fetch;
 try{
  const begin=await f.begin({mode:'new'});project(begin.draft.workspacePath,'Failure receipt');
  writeFileSync(join(begin.draft.workspacePath,'build.mjs'),'process.exit(1)');
  const keyFile=join(f.directory,'key');writeFileSync(keyFile,f.token);
  // @ts-expect-error standalone CLI
  const {runAuthoringCheck}=await import('../../scripts/apps-authoring-check.mjs');
  const request={build:{sessionId:'original',attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,viewId:begin.view.viewId,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],archiveRoot:join(f.directory,'source-components'),evidenceRoot:join(f.directory,'authoring-evidence'),runtime:{url:f.url,keyFile}},preview:{browserExecutable:browser,assertions:[{id:'click',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}],requiredMethods:['readBindingPage']}};
  const drop=new Set(['apps.authoring.record_build','apps.authoring.record_preview']);
  globalThis.fetch=async(url,options)=>{const response=await originalFetch(url,options);const cap=typeof options?.body==='string'?JSON.parse(options.body).capabilityId:undefined;if(drop.delete(cap))throw Error('lost failure response');return response;};
  await assert.rejects(runAuthoringCheck(request),/lost failure response/);
  const failed=await runAuthoringCheck(request);assert.equal(failed.verdict,'FAIL');assert.equal(failed.build.reusedBuild,true);assert.ok(failed.build.buildReceiptId);
  assert.equal(f.store.list<AuthoringAttempt>('authoring_attempts').find(a=>a.attemptId===begin.attempt.attemptId)?.state,'build_failed');
  const next=await f.begin({mode:'edit',viewId:begin.view.viewId});project(next.draft.workspacePath,'Incomplete preview');
  Object.assign(request.build,{attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,sourceRevision:next.attempt.sourceRevision});
  await assert.rejects(runAuthoringCheck(request),/lost failure response/);
  const incomplete=await runAuthoringCheck(request);assert.equal(incomplete.verdict,'INCOMPLETE');assert.equal(incomplete.reusedBuild,true);assert.equal(incomplete.reusedPreview,true);assert.ok(incomplete.previewReceiptId);
  assert.equal(f.store.list<AuthoringAttempt>('authoring_attempts').find(a=>a.attemptId===next.attempt.attemptId)?.state,'preview_failed');
  assert.equal(f.store.list('build_receipts').length,2);assert.equal(f.store.list('preview_receipts').length,1);assert.equal(f.store.list('view_publications').length,0);
 }finally{globalThis.fetch=originalFetch;await f.cleanup();}
});
