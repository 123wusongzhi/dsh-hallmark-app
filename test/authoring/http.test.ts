import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import type {AuthoringDraft,AuthoringAttempt,AuthoringView,BuildReceipt,PreviewReceipt,StartMountInput,ViewPublication} from '../../packages/app-presentation/src/authoring-types.ts';
// @ts-expect-error Actual isolated browser runner is also exported by the standalone CLI.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
