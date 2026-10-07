import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../../packages/source-components/src/authoring-evidence.ts';
import {previewTestPlan} from '../../packages/source-components/src/authoring-preview-plan.ts';
// @ts-expect-error Standalone CLI exports its browser runner for real SOURCE_EXEC checks.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

test('required preview plan rejects missing coverage, unsupported actions and duplicate IDs',()=>{
 assert.ok(previewTestPlan({}).errors.includes('PREVIEW_TEST_PLAN_REQUIRED'));
 assert.ok(previewTestPlan({assertions:[]}).errors.includes('REQUIRED_INTERACTION_MISSING'));
 const invalid=previewTestPlan({assertions:[{id:'press',action:'press',selector:'button',check:'text',expected:'initial'}]});assert.ok(invalid.errors.some(item=>item.startsWith('INVALID_TEST_CASE')));
 const valid={id:'check',action:'click',selector:'#toggle',check:'checked',expected:true};assert.deepEqual(previewTestPlan({assertions:[valid]}).errors,[]);
 assert.ok(previewTestPlan({assertions:[valid,valid]}).errors.length);
 assert.deepEqual(previewTestPlan({assertions:[{id:'title',selector:'h1',check:'text',expected:'Preview'}],noninteractiveReason:'A read-only chart has no controls.'}).errors,[]);
});

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
test('actual frozen-v2 browser preview records interactions and PNGs at 420 and 1040; missing or illegal plans never PASS',{skip:!existsSync(browser),timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'apps-browser-runner-')),workspace=join(root,'workspace');mkdirSync(workspace);
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;font:16px sans-serif}main{max-width:100%;overflow-wrap:anywhere}</style><main><h1>Frozen preview</h1><label><input id="selected" type="checkbox"> Select item</label><button id="count">Count</button><output id="result">0</output><p id="data">Loading</p></main><script>
 let identity;window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;const message=event.data;if(message.type==='hello'){identity=message;parent.postMessage({channel:message.channel,protocolVersion:'2.0',sessionId:message.sessionId,viewId:message.viewId,buildId:message.buildId,frameInstanceId:message.frameInstanceId,requestId:'data',method:'getData',params:null},location.origin);}else if(message.requestId==='data')document.querySelector('#data').textContent=JSON.stringify(message.result);});
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello-real',documentNonce:'isolated-document',clientFeatures:['renderReadyV1']},location.origin);
 document.querySelector('#count').onclick=()=>document.querySelector('#result').textContent=String(Number(document.querySelector('#result').textContent)+1);
 </script>`;
 writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
 const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
 try{
  const built=await runner.build({attemptId:'real-browser',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});assert.equal(built.report.verdict,'PASS');
  const input={attemptId:'real-browser',epoch:1,buildReceiptId:'real-build-receipt',buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data:{viewId:'preview',bindings:[]}};
  const success=await runAuthoringPreview({...input,assertions:[{id:'select',action:'click',selector:'#selected',check:'checked',expected:true},{id:'count',action:'click',selector:'#count',checkSelector:'#result',check:'text',expected:'1'}]});
  assert.equal(success.report.verdict,'PASS',JSON.stringify(success.report));assert.deepEqual(success.report.viewportResults.map((item:{contentWidthCssPx:number})=>item.contentWidthCssPx),[420,1040]);
  for(const viewport of success.report.viewportResults){assert.equal(readFileSync(viewport.screenshot.path).subarray(1,4).toString(),'PNG');assert.deepEqual(viewport.interactionCaseIds,['select','count']);}
  assert.equal(runner.verifyPreview(success.reportRef,sources).verdict,'PASS');
  const missing=await runAuthoringPreview({...input});assert.equal(missing.report.verdict,'INCOMPLETE');
  const invalid=await runAuthoringPreview({...input,assertions:[{id:'unsupported',action:'press',selector:'#result',check:'text',expected:'0'}]});assert.equal(invalid.report.verdict,'INCOMPLETE');
  const noninteractive=await runAuthoringPreview({...input,noninteractiveReason:'Caller incorrectly declared no controls',assertions:[{id:'title',selector:'h1',check:'text',expected:'Frozen preview'}]});assert.equal(noninteractive.report.verdict,'INCOMPLETE');
  const forged={...missing.report,verdict:'PASS'};assert.throws(()=>runner.verifyPreview(runner.writeReport('preview',forged),sources),/PREVIEW_INCOMPLETE/);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
