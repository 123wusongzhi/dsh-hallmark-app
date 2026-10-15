import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../../packages/source-components/src/authoring-evidence.ts';
import {PERFORMANCE_IMAGE_DELAY_MS,PERFORMANCE_POLICY_VERSION,PERFORMANCE_PROFILE,evaluatePerformance} from '../../packages/source-components/src/authoring-performance.ts';
// @ts-expect-error The standalone CLI exports its real isolated browser runner.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';

function page(kind:'bad'|'repaired'|'missing-image'){
 const bad=kind==='bad';
 return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:12px;font:16px sans-serif}main{max-width:100%;overflow-wrap:anywhere}.images{display:flex;gap:12px;align-items:flex-start}.unsized{display:inline-block}img{object-fit:contain}label,output{display:block;margin:8px 0}</style>
 <main data-app-component data-ready="false"><h1>Isolated product preview</h1><p id="data">Reading fixture</p>
 <div class="images"><img id="first" fetchpriority="${bad?'low':'high'}" loading="eager" decoding="async" width="64" height="64" src="first.svg" alt="First product">
 <img fetchpriority="auto" loading="${bad?'lazy':'eager'}" ${bad?'onload="this.loading=\'eager\'"':''} decoding="async" width="64" height="64" src="second.svg" alt="Second product">
 <span class="unsized"><img fetchpriority="auto" loading="eager" decoding="async" ${bad?'':'width="64" height="64"'} src="${kind==='missing-image'?'missing.svg':'third.svg'}" alt="Unsized product"></span></div>
 <section hidden><img fetchpriority="auto" loading="${bad?'eager':'lazy'}" width="64" height="64" src="hidden.svg" alt="Hidden product"></section>
 <section id="details" hidden><img id="deferred" fetchpriority="auto" loading="lazy" width="64" height="64" src="deferred.svg" alt="Revealed product"></section>
 <button id="advance">Update</button><output id="result">0</output><label>Search<input id="search" value=""></label>
 <output id="image-delay">Waiting for the controlled image</output><div id="bulk" hidden></div></main>
 <script>
 const first=document.querySelector('#first');
 first.addEventListener('load',()=>{
  const entry=performance.getEntriesByName(first.currentSrc).at(-1);
  document.querySelector('#image-delay').textContent=entry&&entry.duration>=${PERFORMANCE_IMAGE_DELAY_MS}?'Controlled image delay observed':'Image delay too short: '+entry?.duration;
 });
 addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin)return;
  const message=event.data;
  if(message.type==='hello')parent.postMessage({channel:message.channel,protocolVersion:'2.0',sessionId:message.sessionId,viewId:message.viewId,buildId:message.buildId,frameInstanceId:message.frameInstanceId,requestId:'fixture-data',method:'getData',params:null},location.origin);
  else if(message.requestId==='fixture-data'){
   document.querySelector('#data').textContent=message.result?'Fixture products ready':'Fixture unavailable';
   document.querySelector('main').dataset.ready=String(Boolean(message.result));
  }
 });
 parent.postMessage({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello',documentNonce:'isolated-performance-fixture'},location.origin);
 document.querySelector('#advance').onclick=()=>{
  ${bad?'const end=performance.now()+400;while(performance.now()<end){}':''}
  document.querySelector('.images').style.display='none';
  const image=document.querySelector('#deferred');
  ${bad?"image.loading='eager';image.setAttribute('fetchpriority','high');":"image.setAttribute('fetchpriority','high');image.loading='eager';"}
  document.querySelector('#details').hidden=false;
  document.querySelector('#result').textContent=String(Number(document.querySelector('#result').textContent)+1);
 };
 ${bad?"document.querySelector('#bulk').innerHTML='<span>Unused</span>'.repeat(3100);const end=performance.now()+400;while(performance.now()<end){}":''}
 </script>`;
}

test('formal browser performance gate rejects a slow frozen build, accepts its repaired build, and retains local image errors',{skip:!existsSync(browser),timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'apps-performance-runner-')),workspace=join(root,'workspace');mkdirSync(workspace);
 const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
 writeFileSync(join(workspace,'package-lock.json'),'{}');
 writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');for(const name of ['first','second','third','hidden','deferred'])copyFileSync('image.svg','dist/'+name+'.svg');");
 writeFileSync(join(workspace,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1255aa"/></svg>');
 const assertions=[
  {id:'update',action:'click',selector:'#advance',checkSelector:'#result',check:'text',expected:'1'},
  {id:'search',action:'fill',selector:'#search',value:'fixture',check:'value',expected:'fixture'},
  {id:'controlled-image-delay',selector:'#image-delay',check:'text',expected:'Controlled image delay observed'},
 ];
 async function preview(kind:'bad'|'repaired'|'missing-image',revision:number){
  writeFileSync(join(workspace,'input.html'),page(kind));
  const attemptId=`performance-${kind}`,built=await runner.build({attemptId,epoch:revision,sourceRevision:revision,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
  assert.equal(built.report.verdict,'PASS');
  return runAuthoringPreview({attemptId,epoch:revision,buildReceiptId:`receipt-${kind}`,buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data:{viewId:'preview',bindings:[]},requiredMethods:['getData'],assertions});
 }
 try{
  const failed=await preview('bad',1);
  assert.equal(failed.report.verdict,'FAIL');
  const failedEvaluation=evaluatePerformance(failed.report.performance);
  assert.equal(failedEvaluation.verdict,'FAIL');
  const codes=new Set(failedEvaluation.failures.map(item=>item.code));
  for(const code of ['VISIBLE_IMAGE_PRIORITY','FIRST_IMAGE_PRIORITY','IMAGE_SPACE_MISSING','HIDDEN_IMAGE_REQUESTS','DOM_ELEMENTS_BUDGET','LONG_TASK_BUDGET','INTERACTION_FEEDBACK_BUDGET'])assert.ok(codes.has(code),`${code} missing: ${JSON.stringify(failed.report.performance)}`);
  // DOM ends with high in both versions; only actual request priority catches late updates.
  for(const viewport of failed.report.performance.viewports)assert.equal(viewport.interactions[0].unprioritizedFirstImage,1,JSON.stringify(viewport.interactions[0]));
  assert.equal(failed.summary.nextAction,'repair_performance_then_recheck');
  assert.equal(failed.summary.performance.verdict,'FAIL');
  assert.ok(failed.summary.performance.failures.every((item:{repair:string})=>item.repair.trim().length>0));
  assert.deepEqual(JSON.parse(readFileSync(failed.summaryPath,'utf8')).performance,failed.summary.performance);

  const repaired=await preview('repaired',2);
  assert.notEqual(repaired.report.buildId,failed.report.buildId);
  assert.equal(repaired.report.verdict,'PASS',JSON.stringify(repaired.summary));
  assert.equal(repaired.report.performance.policyVersion,PERFORMANCE_POLICY_VERSION);
  assert.equal(repaired.report.performance.profile,PERFORMANCE_PROFILE);
  assert.equal(repaired.report.performance.imageDelayMs,PERFORMANCE_IMAGE_DELAY_MS);
  assert.deepEqual(repaired.report.performance.viewports.map((view:{width:number})=>view.width),[420,1040]);
  for(const viewport of repaired.report.performance.viewports){
   assert.equal(viewport.initial.hiddenImageRequests,0);
   assert.ok(viewport.initial.imageRequests>=3);
   assert.equal(viewport.initial.visibleImages,3);
   assert.equal(viewport.initial.lazyVisibleImages,0);
   assert.equal(viewport.initial.unprioritizedFirstImage,0);
   assert.equal(viewport.initial.missingImageSpace,0);
   assert.equal(viewport.initial.feedbackMs,null);
   assert.deepEqual(viewport.interactions.map((item:{id:string})=>item.id),['update','search']);
   assert.equal(viewport.interactions[0].imageRequests,1);
   assert.equal(viewport.interactions[0].unprioritizedFirstImage,0);
   for(const interaction of viewport.interactions)assert.ok(interaction.feedbackMs>0&&interaction.feedbackMs<=250,JSON.stringify(interaction));
  }
  for(const result of repaired.report.assertionResults.filter((item:{id:string})=>item.id.endsWith(':controlled-image-delay')))assert.equal(result.status,'PASS',result.actual);
  assert.equal(runner.verifyPreview(repaired.reportRef,sources).verdict,'PASS');

  const missing=await preview('missing-image',3);
  assert.equal(missing.report.verdict,'FAIL');
  assert.ok(missing.report.viewportResults.every((viewport:{failedRequests:string[]})=>viewport.failedRequests.some(item=>item.includes('missing.svg')&&item.includes('404'))),JSON.stringify(missing.summary));
 }finally{
  // The runner closes its isolated browser before returning; only this test's temp tree is removed.
  assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep)&&root.includes('apps-performance-runner-'));
  rmSync(root,{recursive:true,force:true,maxRetries:15,retryDelay:200});
 }
});
