import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,buildReuseSignature} from '../../packages/source-components/src/authoring-evidence.ts';
import {buildEnvironmentSignature} from '../../packages/source-components/src/authoring-build-input.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
// @ts-expect-error Standalone CLIs exercise the real process/browser implementation.
import {runAuthoringBuild} from '../../scripts/apps-authoring-build.mjs';
// @ts-expect-error Standalone CLI.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';
// @ts-expect-error Standalone CLI.
import {runAuthoringCheck} from '../../scripts/apps-authoring-check.mjs';
// @ts-expect-error Standalone checkpoint helpers.
import {checkpoint,buildFingerprint} from '../../scripts/authoring-resume.mjs';
// @ts-expect-error Actual starter generator.
import {createAppsSource} from '../../scripts/create-apps-source.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const count=(path:string)=>existsSync(path)?readFileSync(path,'utf8').trim().split('\n').length:0;
const outputRoot=process.env.DSH_PERFORMANCE_CLI_EVIDENCE_ROOT;
function directory(name:string){if(!outputRoot)return mkdtempSync(join(tmpdir(),'apps-'+name+'-'));const path=join(resolve(outputRoot),name+'-'+randomUUID());mkdirSync(path,{recursive:true});return path;}
function cleanup(path:string){if(!outputRoot){assert.ok(resolve(path).startsWith(resolve(tmpdir())));rmSync(path,{recursive:true,force:true,maxRetries:5,retryDelay:200});}}
function retain(path:string,value:unknown){if(outputRoot)writeFileSync(join(path,'results.json'),JSON.stringify(value,null,2)+'\n');}
function project(workspace:string,counter:string,gate?:string,gateUrl?:string){
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;font:16px sans-serif}</style><h1>Performance fixture</h1><button id="toggle">Select</button><output id="result">unselected</output><script>
 addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;const m=e.data;if(m.type==='hello')parent.postMessage({channel:m.channel,protocolVersion:'2.0',sessionId:m.sessionId,viewId:m.viewId,buildId:m.buildId,frameInstanceId:m.frameInstanceId,requestId:'data',method:'getData',params:null},location.origin)});
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'fixture-document'},location.origin);
 document.querySelector('#toggle').onclick=async()=>{${gateUrl?`const value=await fetch(${JSON.stringify(gateUrl)}).then(r=>r.json());if(!value.available){document.querySelector('#result').textContent='offline';throw Error('FIXTURE_OFFLINE');}`:''}document.querySelector('#result').textContent='selected'};
 </script>`;
 writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'package-lock.json'),'{}');
 writeFileSync(join(workspace,'build.mjs'),`import{appendFileSync,readFileSync,mkdirSync,copyFileSync}from'node:fs';appendFileSync(${JSON.stringify(counter)},'started\\n');${gate?`if(readFileSync(${JSON.stringify(gate)},'utf8')!=='online')process.exit(1);`:''}mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');`);
}
async function runtime(name:string){
 const root=directory(name),instance=composeAppsRuntime(join(root,'runtime'),{connections:[]}),token='a'.repeat(64),server=createAppsServer({...instance,token});
 await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`,keyFile=join(root,'fixture-key');writeFileSync(keyFile,token);
 const action=async(capabilityId:string,input:unknown)=>{const response=await fetch(url+'/v1/presentation-actions',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sessionId:'fixture',requestId:randomUUID(),capabilityId,input})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
 const begin=(await action('apps.authoring.begin',{mode:'new'})).data;
 const build={sessionId:'fixture',viewId:begin.view.viewId,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.draft.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],environmentKeys:[],archiveRoot:join(root,'runtime','source-components'),evidenceRoot:join(root,'runtime','authoring-evidence'),runtime:{url,keyFile}};
 return {root,instance,action,begin,build,async close(){server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));await instance.close();cleanup(root);}};
}
const assertions=[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}];

test('build environment declarations exclude inert diagnostics, retain safety dependencies and preserve custom conservative fallback',async()=>{
 const root=directory('environment'),workspace=join(root,'workspace');mkdirSync(workspace);const counter=join(root,'build-count.txt');project(workspace,counter);
 const input={attemptId:'env',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],environmentKeys:[],archiveRoot:join(root,'archive'),evidenceRoot:join(root,'evidence')};
 const inert='DSH_TEST_INERT_DIAGNOSTIC',oldInert=process.env[inert],oldNode=process.env.NODE_OPTIONS;
 try{
  const built=await runAuthoringBuild(input),key=buildFingerprint(input),signature=buildReuseSignature(input);assert.equal(built.verdict,'PASS');
  process.env[inert]='synthetic-change';assert.equal(buildFingerprint(input),key);const reused=await runAuthoringBuild(input);assert.equal(reused.reusedBuild,true);assert.equal(count(counter),1);
  const conservative={...input,environmentKeys:undefined};const conservativeKey=buildFingerprint(conservative);process.env[inert]='another-change';assert.notEqual(buildFingerprint(conservative),conservativeKey);
  const nodeValue=(oldNode??'')+' --no-warnings';process.env.NODE_OPTIONS=nodeValue;assert.notEqual(buildFingerprint(input),key);await assert.rejects(runAuthoringBuild(input),{code:'NEW_ATTEMPT_REQUIRED'});assert.equal(count(counter),1);
  assert.equal(JSON.stringify(signature).includes('synthetic-change'),false);assert.equal(signature.environment.policy,'declared');
  if(oldNode===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=oldNode;
  const runner=new AuthoringEvidenceRunner(input.evidenceRoot),sources=new SourceComponentStore(input.archiveRoot),adopted=runner.reuseBuild(built.reportRef,{...input,attemptId:'new-env',epoch:2,sourceRevision:2,sources});
  assert.equal(adopted.report.executionKind,'reuse');assert.equal(adopted.report.executionId,reused.executionId);assert.equal(runner.verifyBuild(adopted.reportRef,sources).attemptId,'new-env');
  const forged={...adopted.report,executionId:'forged-execution'};assert.throws(()=>runner.verifyBuild(runner.writeReport('build',forged),sources),/BUILD_REUSE_EVIDENCE_INVALID/);
  const legacy={...runner.verifyBuild(built.reportRef,sources)};delete legacy.reuseInput;assert.throws(()=>runner.reuseBuild(runner.writeReport('build',legacy),{...input,attemptId:'legacy',epoch:2,sourceRevision:2,sources}),/BUILD_REUSE_INPUT_CHANGED/);
  const changedInput={...input,command:[process.execPath,'build.mjs','changed'],attemptId:'changed',epoch:2,sourceRevision:2,sources};assert.throws(()=>runner.reuseBuild(built.reportRef,changedInput),/BUILD_REUSE_INPUT_CHANGED/);
  const forgedCheckpoint=checkpoint(input,'build');process.env.NODE_OPTIONS=(oldNode??'')+' --no-warnings';checkpoint(input,'build',{...forgedCheckpoint,key:buildFingerprint(input)});await assert.rejects(runAuthoringBuild(input),{code:'NEW_ATTEMPT_REQUIRED'});if(oldNode===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=oldNode;checkpoint(input,'build',forgedCheckpoint);
  const sdk=join(root,'sdk');mkdirSync(sdk);writeFileSync(join(sdk,'package.json'),'{"name":"@dsh/apps-component-runtime"}');const sdkKey=buildReuseSignature({...input,sdkDirectory:sdk}).key;writeFileSync(join(sdk,'package.json'),'{"name":"@dsh/apps-component-runtime","version":"0.0.2"}');assert.notEqual(buildReuseSignature({...input,sdkDirectory:sdk}).key,sdkKey);const starter=join(root,'starter');await createAppsSource({directory:starter,sdkDirectory:sdk});
  assert.equal(buildEnvironmentSignature({workspacePath:starter,command:[process.execPath,'build.mjs']}).policy,'builtin');assert.equal(buildEnvironmentSignature({workspacePath:starter,command:[process.execPath,'--expose-internals','build.mjs']}).policy,'builtin');assert.equal(buildEnvironmentSignature({workspacePath:starter,command:[process.execPath,'--require','custom.cjs','build.mjs']}).policy,'conservative');writeFileSync(join(starter,'build.mjs'),readFileSync(join(starter,'build.mjs'),'utf8')+'\n// Custom change\n');assert.equal(buildEnvironmentSignature({workspacePath:starter,command:[process.execPath,'build.mjs']}).policy,'conservative');
  retain(root,{pass:true,buildSpawnCount:count(counter),buildReportRef:built.reportRef,adoptionReportRef:adopted.reportRef,environmentPolicy:signature.environment.policy,credentialsAndEnvironmentValuesOmitted:true});
 }finally{if(oldInert===undefined)delete process.env[inert];else process.env[inert]=oldInert;if(oldNode===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=oldNode;cleanup(root);}
});

test('explicit build retry creates a new runtime generation and reexecutes once; resume keeps immutable failure',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await runtime('build-retry'),counter=join(f.root,'build-count.txt'),gate=join(f.root,'build-gate.txt');writeFileSync(gate,'offline');project(f.build.workspacePath,counter,gate);
 const request={build:f.build,preview:{mode:'fixture',browserExecutable:browser,assertions}},originalFetch=globalThis.fetch;
 try{
  const failed=await runAuthoringCheck(request);assert.equal(failed.verdict,'FAIL');const failedBytes=readFileSync(failed.build.reportRef.path);writeFileSync(gate,'online');
  const resumed=await runAuthoringCheck(request);assert.equal(resumed.verdict,'FAIL');assert.equal(count(counter),1);
  const retry={...request,retryStage:'build',retryId:'recovered-build'};let dropped=false;
  globalThis.fetch=async(...args:Parameters<typeof fetch>)=>{const response=await originalFetch(...args),body=typeof args[1]?.body==='string'?JSON.parse(args[1].body):null;if(!dropped&&body?.capabilityId==='apps.authoring.begin'){dropped=true;throw Error('Lost retry begin response');}return response;};
  await assert.rejects(runAuthoringCheck(retry),/Lost retry begin response/);globalThis.fetch=originalFetch;
  const passed=await runAuthoringCheck(retry);assert.equal(passed.verdict,'PASS');assert.equal(count(counter),2);assert.notEqual(passed.attemptId,f.build.attemptId);assert.equal(passed.epoch,f.build.epoch+1);assert.equal(f.instance.store.list('authoring_attempts').length,2);
  const repeated=await runAuthoringCheck(retry);assert.equal(repeated.reusedBuild,true);assert.equal(repeated.reusedPreview,true);assert.equal(count(counter),2);assert.equal(repeated.attemptId,passed.attemptId);
  assert.deepEqual(readFileSync(failed.build.reportRef.path),failedBytes);assert.equal(f.instance.store.list('build_receipts').length,2);assert.equal(f.instance.store.list('view_publications').length,0);assert.equal(f.instance.store.list('components').length,0);
  retain(f.root,{pass:true,failed,resumed,passed,repeated,buildSpawnCount:count(counter),businessWrites:0,published:0,saved:0});
 }finally{globalThis.fetch=originalFetch;await f.close();}
});

test('explicit preview retry preserves old evidence, reuses signed build and reruns the browser; draft cannot register or PASS',{skip:!existsSync(browser),timeout:60000},async()=>{
 const f=await runtime('preview-retry'),counter=join(f.root,'build-count.txt');let available=false,reads=0;
 const provider=createServer((_req,res)=>{reads++;res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});res.end(JSON.stringify({available}));});await new Promise<void>(accept=>provider.listen(0,'127.0.0.1',accept));
 const gateUrl=`http://127.0.0.1:${(provider.address() as {port:number}).port}/gate`;project(f.build.workspacePath,counter,undefined,gateUrl);
 const request={build:f.build,preview:{mode:'fixture',browserExecutable:browser,assertions}};
 try{
  const failed=await runAuthoringCheck(request);assert.equal(failed.verdict,'FAIL');assert.equal(reads,2);const failedPreview=JSON.parse(readFileSync(failed.previewSummaryPath,'utf8')),oldBytes=readFileSync(failedPreview.reportRef.path),oldReceipt=f.instance.store.get('preview_receipts',failed.previewReceiptId);
  available=true;const resumed=await runAuthoringCheck(request);assert.equal(resumed.verdict,'FAIL');assert.equal(resumed.reusedPreview,true);assert.equal(reads,2);
  const retry={...request,retryStage:'preview',retryId:'recovered-preview'},passed=await runAuthoringCheck(retry);assert.equal(passed.verdict,'PASS');assert.equal(passed.reusedBuild,true);assert.equal(passed.reusedPreview,false);assert.equal(reads,4);assert.equal(count(counter),1);assert.notEqual(passed.buildReceiptId,failed.buildReceiptId);
  const adoptionSummary=JSON.parse(readFileSync(passed.buildSummaryPath,'utf8')),receipt=f.instance.store.get<any>('build_receipts',passed.buildReceiptId);assert.equal(receipt.executionKind,'reuse');assert.equal(receipt.executionId,adoptionSummary.executionId);assert.ok(receipt.reusedFrom);assert.ok(receipt.reuseVerifiedAt);
  assert.deepEqual(readFileSync(failedPreview.reportRef.path),oldBytes);assert.deepEqual(f.instance.store.get('preview_receipts',failed.previewReceiptId),oldReceipt);
  const repeated=await runAuthoringCheck(retry);assert.equal(repeated.reusedPreview,true);assert.equal(reads,4);assert.equal(count(counter),1);
  const retryRequest=JSON.parse(readFileSync(passed.retryRequestPath,'utf8')),buildInput=retryRequest.build,built=await runAuthoringBuild({...buildInput,autoRecord:true});
  const previewsBefore=readdirSync(f.build.evidenceRoot).filter(path=>/^preview-.*\.json$/.test(path)).length;
  const draft=await runAuthoringPreview({...built.previewRequest,...request.preview,autoRecord:false,validationProfile:'draft',draftViewport:420});assert.equal(draft.report.verdict,'INCOMPLETE');assert.equal(draft.report.validationProfile,'draft');assert.deepEqual(draft.report.viewportResults.map((v:any)=>v.contentWidthCssPx),[420]);assert.equal(draft.summary.nextAction,'run_formal_preview');assert.equal(reads,5);
  const formalAfterDraft=await runAuthoringCheck(retryRequest);assert.equal(formalAfterDraft.verdict,'PASS');assert.equal(formalAfterDraft.reusedPreview,true);assert.equal(reads,5);
  const formalCheckBytes=readFileSync(formalAfterDraft.summaryPath),checkDraft=await runAuthoringCheck({...retryRequest,preview:{...retryRequest.preview,validationProfile:'draft',draftViewport:420}});assert.equal(checkDraft.verdict,'INCOMPLETE');assert.equal(checkDraft.stage,'draft');assert.equal(checkDraft.reusedPreview,true);assert.notEqual(checkDraft.summaryPath,formalAfterDraft.summaryPath);assert.deepEqual(readFileSync(formalAfterDraft.summaryPath),formalCheckBytes);assert.equal(reads,5);
  assert.throws(()=>f.instance.evidenceRunner.verifyPreview(draft.reportRef,f.instance.presentation.sources!),/PREVIEW_DRAFT_ONLY/);assert.equal(f.instance.evidenceRunner.verifyPreview(draft.reportRef,f.instance.presentation.sources!,{allowDraft:true}).verdict,'INCOMPLETE');
  const forged=f.instance.evidenceRunner.writeReport('preview',{...draft.report,verdict:'PASS'});assert.throws(()=>f.instance.evidenceRunner.verifyPreview(forged,f.instance.presentation.sources!),/PREVIEW_DRAFT_ONLY/);
  await assert.rejects(runAuthoringPreview({...built.previewRequest,...request.preview,validationProfile:'draft',draftViewport:420}),{code:'PREVIEW_DRAFT_ONLY'});
  const next=(await f.action('apps.authoring.begin',{mode:'edit',viewId:f.begin.view.viewId})).data;
  const nextBuild=await runAuthoringBuild({...f.build,attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,sourceRevision:next.draft.sourceRevision,reuseBuildReportRef:built.reportRef,autoRecord:true});
  const nextDraft=await runAuthoringPreview({...nextBuild.previewRequest,...request.preview,autoRecord:false,validationProfile:'draft',draftViewport:640,assertions:[{id:'heading',selector:'h1',check:'text',expected:'Performance fixture'}]});
  const rejected=await f.action('apps.authoring.record_preview',{attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,buildReceiptId:nextBuild.buildReceiptId,reportRef:nextDraft.reportRef});assert.notEqual(rejected.status,'ok');assert.equal(rejected.error.code,'PREVIEW_INCOMPLETE');assert.equal(f.instance.store.list('preview_receipts').length,2);
  assert.equal(f.instance.store.list('view_publications').length,0);assert.equal(f.instance.store.list('components').length,0);
  retain(f.root,{pass:true,failed,resumed,passed,repeated,adoptionSummary,formalSummary:JSON.parse(readFileSync(passed.previewSummaryPath,'utf8')),formalAfterDraft,checkDraft,formalWidths:[420,1040],draft:{reportRef:draft.reportRef,summary:draft.summary},nextDraft:{reportRef:nextDraft.reportRef,summary:nextDraft.summary},rejected,fixtureReads:reads,buildSpawnCount:count(counter),previewReportsBeforeDraft:previewsBefore,businessWrites:0,published:0,saved:0});
 }finally{provider.closeAllConnections();await new Promise<void>(accept=>provider.close(()=>accept()));await f.close();}
});
