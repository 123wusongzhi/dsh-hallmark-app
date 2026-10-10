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
test('formal runner exercises paged capability fixtures and does not pass a caught selection failure',{skip:!existsSync(browser),timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'apps-paging-preview-')),workspace=join(root,'workspace');mkdirSync(workspace);
 const resource={appId:'notes',connectionId:'notes',resourceType:'note',resourceId:'a'},query={appId:'notes',connectionId:'notes',capabilityId:'notes.notes.list',capabilityVersion:'1.0.0',input:{limit:1}};
 const data={viewId:'preview',bindings:[{bindingId:'notes',...query,query:{...query,projection:[]},revision:'r1',state:'ready',resources:[resource],payload:{items:[{id:'a'}]}}]};delete (data.bindings[0] as any).capabilityId;delete (data.bindings[0] as any).capabilityVersion;delete (data.bindings[0] as any).input;
 const html=`<main><button id="page">Next</button><button id="attach">Attach</button><output id="result">loading</output></main><script>
 let identity,binding,selected;function call(id,method,params){parent.postMessage({...identity,type:undefined,requestId:id,method,params},location.origin)}
 addEventListener('message',e=>{const m=e.data;if(m.type==='hello'){identity={channel:m.channel,protocolVersion:m.protocolVersion,sessionId:m.sessionId,viewId:m.viewId,buildId:m.buildId,frameInstanceId:m.frameInstanceId};call('data','getData',null)}else if(m.requestId==='data'){binding=m.result.bindings[0];selected=binding.resources[0];document.querySelector('#result').textContent='a'}else if(m.requestId==='page'){if(m.error){document.querySelector('#result').textContent='unavailable';return}selected=m.result.data.resource;document.querySelector('#result').textContent=m.result.data.id}else if(m.requestId==='attach'){document.querySelector('#result').textContent=m.error?'selection failed':'validated'}});
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'preview-paging'},location.origin);
 document.querySelector('#page').onclick=()=>{const {projection,...q}=binding.query;call('page','invokeCapability',{...q,input:{...q.input,cursor:'1'}})};
 document.querySelector('#attach').onclick=()=>call('attach','attachSelection',{bindingId:binding.bindingId,datasetRevision:binding.revision,resources:[selected]});
 </script>`;
 // No synthetic capability fields on the outer binding; the component uses only binding.query.
 writeFileSync(join(workspace,'input.html'),html.replace('type:undefined,',''));writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
 const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
 try{
  const built=await runner.build({attemptId:'paging',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
  const input={attemptId:'paging',epoch:1,buildReceiptId:'receipt',buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data,requiredMethods:['invokeCapability','attachSelection']};
  const fixtures=[{request:{...query,input:{limit:1,cursor:'1'}},result:{status:'ok',data:{id:'b',resource:{...resource,resourceId:'b'}}}}];
  const passed=await runAuthoringPreview({...input,capabilityFixtures:fixtures,assertions:[{id:'attach-current',action:'click',selector:'#attach',checkSelector:'#result',check:'text',expected:'validated'},{id:'next',action:'click',selector:'#page',checkSelector:'#result',check:'text',expected:'b'}]});assert.equal(passed.report.verdict,'PASS');
  const failed=await runAuthoringPreview({...input,capabilityFixtures:fixtures,assertions:[{id:'next',action:'click',selector:'#page',checkSelector:'#result',check:'text',expected:'b'},{id:'attach-next',action:'click',selector:'#attach',checkSelector:'#result',check:'text',expected:'selection failed'}]});assert.notEqual(failed.report.verdict,'PASS');assert.ok(failed.report.assertionResults.some((a:any)=>a.actual?.includes('SELECTION_STALE')));
  const missing=await runAuthoringPreview({...input,requiredMethods:['invokeCapability'],assertions:[{id:'next',action:'click',selector:'#page',checkSelector:'#result',check:'text',expected:'unavailable'}]});assert.equal(missing.report.verdict,'INCOMPLETE');
 }finally{rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('actual frozen-v2 browser preview records interactions and PNGs at 420 and 1040; missing or illegal plans never PASS',{skip:!existsSync(browser),timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'apps-browser-runner-')),workspace=join(root,'workspace');mkdirSync(workspace);
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;font:16px sans-serif}main{max-width:100%;overflow-wrap:anywhere}</style><main><h1>Frozen preview</h1><img width="40" height="40" src="http://127.0.0.1:1/unavailable-product.png"><label><input id="selected" type="checkbox"> Select item</label><button id="scoped">Scoped</button><button id="count">Count</button><output id="result">0</output><input id="search" value="old"><button id="show" onclick="document.querySelector('#overlay').hidden=false">Show details</button><div id="overlay" hidden aria-hidden="true" style="position:fixed;inset:0;z-index:40"><button id="close" onclick="document.querySelector('#overlay').hidden=true">Close details</button></div><p id="data">Loading</p></main><script>
 let identity;window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;const message=event.data;if(message.type==='hello'){identity=message;parent.postMessage({channel:message.channel,protocolVersion:'2.0',sessionId:message.sessionId,viewId:message.viewId,buildId:message.buildId,frameInstanceId:message.frameInstanceId,requestId:'data',method:'getData',params:null},location.origin);}else if(message.requestId==='data')document.querySelector('#data').textContent=JSON.stringify(message.result);});
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello-real',documentNonce:'isolated-document',clientFeatures:['renderReadyV1']},location.origin);
 document.querySelector('#scoped').onclick=()=>{if(innerWidth<500)parent.postMessage({channel:identity.channel,protocolVersion:'2.0',sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,frameInstanceId:identity.frameInstanceId,requestId:'context',method:'getContext',params:null},location.origin);document.querySelector('#result').textContent='scoped'};
 document.querySelector('#count').onclick=()=>document.querySelector('#result').textContent=String(Number(document.querySelector('#result').textContent)+1);
 </script>`;
 writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
 const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
 try{
  const built=await runner.build({attemptId:'real-browser',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});assert.equal(built.report.verdict,'PASS');
  const input={attemptId:'real-browser',epoch:1,buildReceiptId:'real-build-receipt',buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data:{viewId:'preview',bindings:[]}};
  const success=await runAuthoringPreview({...input,assertions:[{id:'select',action:'click',selector:'#selected',check:'checked',expected:true,screenshot:{}},{id:'count',action:'click',selector:'#count',checkSelector:'#result',check:'text',expected:'1',screenshot:{selector:'#result'}},{id:'search',action:'fill',selector:'#search',valueFromSelector:'h1',check:'value',expected:'Frozen preview'},{id:'show',action:'click',selector:'#show',checkSelector:'#overlay',check:'visible',expected:true},{id:'close',action:'click',selector:'#close',checkSelector:'#overlay',check:'visible',expected:false},{id:'clear',action:'fill',selector:'#search',value:'',check:'value',expected:''}]});
  const scoped=await runAuthoringPreview({...input,requiredMethods:['getContext'],assertions:[{id:'scoped',action:'click',selector:'#scoped',checkSelector:'#result',check:'text',expected:'scoped'}]});
  assert.equal(scoped.report.verdict,'INCOMPLETE');assert.ok(scoped.report.assertionResults.some((a:any)=>a.id==='width-1040:bridge:getContext'&&a.status==='NOT_RUN'));assert.ok(!scoped.report.assertionResults.some((a:any)=>a.id==='width-420:bridge:getContext'));
  assert.equal(success.report.verdict,'PASS',JSON.stringify(success.report));assert.ok(success.diagnostics.images.some((image:any)=>image.status==='placeholder'));assert.ok(success.diagnostics.images.some((image:any)=>image.status==='unavailable'));assert.ok(success.diagnostics.timings.totalMs>0);assert.deepEqual(success.report.viewportResults.map((item:{contentWidthCssPx:number})=>item.contentWidthCssPx),[420,1040]);
  for(const viewport of success.report.viewportResults){assert.equal(readFileSync(viewport.screenshot.path).subarray(1,4).toString(),'PNG');assert.deepEqual(viewport.interactionCaseIds,['select','count','search','show','close','clear']);}
  for(const viewport of success.report.viewportResults){assert.deepEqual(viewport.screenshots.map((shot:any)=>shot.afterCase),['select','count']);for(const shot of viewport.screenshots)assert.equal(readFileSync(shot.file.path).subarray(1,4).toString(),'PNG');assert.equal(success.report.assertionResults.find((item:any)=>item.id===viewport.id+':count').evidenceRefs[0].path,viewport.screenshots[1].file.path);}
  assert.equal(runner.verifyPreview(success.reportRef,sources).verdict,'PASS');
  const blocked=await runAuthoringPreview({...input,assertions:[{id:'show',action:'click',selector:'#show',checkSelector:'#overlay',check:'visible',expected:true},{id:'covered-click',action:'click',selector:'#selected',check:'checked',expected:false},{id:'covered-fill',action:'fill',selector:'#search',value:'new',check:'value',expected:'old'}]});
  assert.equal(blocked.report.verdict,'FAIL');
  for(const viewport of blocked.report.viewportResults)assert.deepEqual(viewport.interactionCaseIds,['show']);
  for(const assertion of blocked.report.assertionResults.filter((item:{id:string})=>/covered-/.test(item.id))){assert.equal(assertion.status,'FAIL');assert.match(assertion.actual,/covered by DIV/);}
  const missing=await runAuthoringPreview({...input});assert.equal(missing.report.verdict,'INCOMPLETE');
  const invalid=await runAuthoringPreview({...input,assertions:[{id:'unsupported',action:'press',selector:'#result',check:'text',expected:'0'}]});assert.equal(invalid.report.verdict,'INCOMPLETE');
  const noninteractive=await runAuthoringPreview({...input,noninteractiveReason:'Caller incorrectly declared no controls',assertions:[{id:'title',selector:'h1',check:'text',expected:'Frozen preview'}]});assert.equal(noninteractive.report.verdict,'INCOMPLETE');
  const forged={...missing.report,verdict:'PASS'};assert.throws(()=>runner.verifyPreview(runner.writeReport('preview',forged),sources),/PREVIEW_INCOMPLETE/);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});


test('slow business work completes once before the next viewport; timeout stops later work',{skip:!existsSync(browser),timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'apps-slow-operation-')),workspace=join(root,'workspace');mkdirSync(workspace);
 const html=`<main><button id="local" onclick="this.textContent='Clicked'">Local</button><button id="sync">Sync</button><output id="state">idle</output></main><script>
 let identity;function call(id,method,params){parent.postMessage({channel:identity.channel,protocolVersion:identity.protocolVersion,sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,frameInstanceId:identity.frameInstanceId,requestId:id,method,params},location.origin)}
 addEventListener('message',e=>{const m=e.data;if(m.type==='hello'){identity=m;call('data','getData',null)}if(m.requestId==='sync'){document.querySelector('#state').textContent=m.error?'failed':'done'}});
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'slow'},location.origin);
 document.querySelector('#sync').onclick=()=>{document.querySelector('#state').textContent='running';call('sync','invokeCapability',{appId:'shop',connectionId:'shop',capabilityId:'shop.sync',capabilityVersion:'1.0.0',input:{}})};
 </script>`;
 writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
 const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
 try{
  const built=await runner.build({attemptId:'slow',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
  // Use an actual HTTP fixture endpoint with a delayed response via the preview adapter.
  const {createServer}=await import('node:http');let calls=0;
  const server=createServer(async(req,res)=>{let input='';for await(const chunk of req)input+=chunk;const action=JSON.parse(input).params.action;if(action==='invoke'){calls++;await new Promise(resolve=>setTimeout(resolve,6100));}res.setHeader('content-type','application/json');res.end(JSON.stringify(action==='invoke'?{status:'ok',data:{done:true}}:{viewId:'preview',bindings:[]}));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const keyFile=join(root,'key');writeFileSync(keyFile,'test');
  const input={attemptId:'slow',epoch:1,viewId:'preview',sessionId:'s',buildReceiptId:'build',buildReportRef:built.reportRef,mode:'live_readonly',sources,runner,browserExecutable:browser,runtime:{url:`http://127.0.0.1:${(server.address() as any).port}`,keyFile},requiredMethods:['getData'],requiredMethodsOnce:['invokeCapability'],assertions:[{id:'local',action:'click',selector:'#local',check:'text',expected:'Clicked'},{id:'sync',action:'click',selector:'#sync',checkSelector:'#state',check:'text',expected:'done',viewports:[420]}]};
  try{
   const passed=await runAuthoringPreview(input);assert.equal(passed.report.verdict,'PASS',JSON.stringify(passed.report));assert.equal(calls,1);runner.verifyPreview(passed.reportRef,sources);
   assert.ok(passed.report.viewportResults[0].bridgeCalls.some((event:any)=>event.method==='invokeCapability'&&event.durationMs>=6000));
   const timeout=await runAuthoringPreview({...input,assertions:[input.assertions[0],{...input.assertions[1],operationTimeoutMs:200}]});assert.equal(timeout.report.verdict,'INCOMPLETE');assert.equal(timeout.report.viewportResults.length,1);assert.ok(timeout.report.assertionResults.some((a:any)=>a.actual?.includes('PREVIEW_OPERATION_TIMEOUT')));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
 }finally{rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
