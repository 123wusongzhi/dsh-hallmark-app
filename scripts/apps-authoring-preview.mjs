import {checkpoint,previewFingerprint,inspectAttempt,newAttemptRequired} from './authoring-resume.mjs';
import {recordEvidence,writeSummary,previewSummary} from './authoring-output.mjs';
import {previewImages} from './preview-images.mjs';
import {previewData} from './preview-data.mjs';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {SourceComponentStore} from '../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../packages/source-components/src/authoring-evidence.ts';
import {startAuthoringPreview} from '../packages/source-components/src/authoring-preview.ts';
import {previewTestPlan} from '../packages/source-components/src/authoring-preview-plan.ts';

const pause=ms=>new Promise(accept=>setTimeout(accept,ms));
/** Fresh headless browser and isolated profile; never attaches to the user's desktop or authenticated browser. */
export async function runAuthoringPreview(input){
 input={...input,evidenceRoot:input.evidenceRoot??input.runner?.root};
 let stage='preview',summary;
 try{
  const runner=input.runner??new AuthoringEvidenceRunner(input.evidenceRoot),sources=input.sources??new SourceComponentStore(input.archiveRoot);
  const build=runner.verifyBuild(input.buildReportRef,sources);if(build.attemptId!==input.attemptId||build.epoch!==input.epoch)throw new Error('PREVIEW_BUILD_MISMATCH');
  const previous=checkpoint(input,'preview'),requestKey=previewFingerprint(input),state=input.autoRecord?await inspectAttempt(input):null;
  let result,reused=false;
  if(previous?.requestKey===requestKey){
   runner.verifyPreview(previous.result.reportRef,sources);result=previous.result;reused=true;
  }else{
   if(state?.attempt.previewReceiptId)throw newAttemptRequired();
   result=await executePreview(input);checkpoint(input,'preview',{requestKey,pendingRegistration:!!input.autoRecord,result});
  }
  summary={...previewSummary(result),reusedPreview:reused};
  if(input.autoRecord){
   stage='record_preview';const receipt=await recordEvidence(input,'preview',result.reportRef);summary.previewReceiptId=receipt.receiptId;checkpoint(input,'preview',{requestKey,pendingRegistration:false,result});
  }
  summary.stage='complete';summary.nextAction=result.report.verdict==='PASS'?'inspect_or_publish':'inspect_preview_report';
  result.summary=summary;result.summaryPath=writeSummary(input,'preview',summary);return result;
 }catch(error){error.summaryPath=writeSummary(input,'preview',{...summary,verdict:'ERROR',stage,nextAction:stage==='record_preview'?'retry_same_request':error.code==='NEW_ATTEMPT_REQUIRED'?'begin_new_attempt':'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;}
}
async function executePreview(input){
 const timingStart=performance.now(),timings={};
 const sources=input.sources??new SourceComponentStore(input.archiveRoot),runner=input.runner??new AuthoringEvidenceRunner(input.evidenceRoot);
 const build=runner.verifyBuild(input.buildReportRef,sources);if(build.attemptId!==input.attemptId||build.epoch!==input.epoch)throw new Error('PREVIEW_BUILD_MISMATCH');
 const testPlan=previewTestPlan(input);
 if(!['fixture','live_readonly'].includes(input.mode))throw new Error('PREVIEW_MODE_REQUIRED');
 const startedAt=new Date().toISOString(),runDirectory=join(runner.root,'preview-'+randomUUID());mkdirSync(runDirectory,{recursive:true});
 const executable=input.browserExecutable??process.env.DSH_PREVIEW_BROWSER_PATH??['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 if(!executable)throw new Error('PREVIEW_BROWSER_UNAVAILABLE');
 const preview=await startAuthoringPreview({sources,buildId:build.archiveBuildId,mode:input.mode,...await previewData(input),context:input.context});
 const images=previewImages(join(runner.root,'preview-image-cache')),imageTasks=new Set();
 const portServer=createServer();await new Promise(accept=>portServer.listen(0,'127.0.0.1',accept));const port=portServer.address().port;await new Promise(accept=>portServer.close(accept));
 const child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(runDirectory,'browser-profile')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let socket,sequence=0;const pending=new Map(),pageErrors=[],unhandledRejections=[],failedRequests=[],responses=new Map();
 const command=(method,params={})=>new Promise((accept,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Preview command timeout: '+method));},10000);pending.set(id,{accept:value=>{clearTimeout(timer);accept(value)},reject:error=>{clearTimeout(timer);reject(error)}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
 const viewportResults=[];
 let operationBlocked=false;
 const waitForOperations=async(timeoutMs=150000)=>{
  const deadline=Date.now()+timeoutMs;
  do{
   const busy=preview.pendingCalls||await evaluate('window.__APPS_PREVIEW?.inflight??0');
   if(!busy){await pause(50);if(!preview.pendingCalls&&!await evaluate('window.__APPS_PREVIEW?.inflight??0'))return;}
   if(Date.now()>=deadline){operationBlocked=true;throw new Error('PREVIEW_OPERATION_TIMEOUT: bridge work is still running; later cases and viewports were not started');}
   await pause(50);
  }while(true);
 };
 try{
  let pages;for(let n=0;n<100;n++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(result=>result.json());if(pages.length)break;}catch{}await pause(100);}
  if(!pages?.length)throw new Error('PREVIEW_BROWSER_UNAVAILABLE');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((accept,reject)=>{socket.addEventListener('open',accept,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const item=JSON.parse(event.data),request=pending.get(item.id);if(item.method==='Fetch.requestPaused'){const task=(async()=>{const p=item.params;if(new URL(p.request.url).origin===new URL(preview.url).origin){await command('Fetch.continueRequest',{requestId:p.requestId});return;}const image=images.response(p.request.url);await command('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:image.contentType}],body:image.body});})();imageTasks.add(task);task.catch(error=>pageErrors.push(error.message)).finally(()=>imageTasks.delete(task));}else if(request){pending.delete(item.id);item.error?request.reject(new Error(item.error.message)):request.accept(item.result);}else if(item.method==='Runtime.exceptionThrown')pageErrors.push(item.params.exceptionDetails.exception?.description??item.params.exceptionDetails.text);else if(item.method==='Network.loadingFailed')failedRequests.push({requestId:item.params.requestId,error:item.params.errorText,url:responses.get(item.params.requestId)??null});else if(item.method==='Network.requestWillBeSent')responses.set(item.params.requestId,item.params.request.url);else if(item.method==='Network.responseReceived'&&item.params.response.status>=400)failedRequests.push({url:item.params.response.url,status:item.params.response.status});});
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Fetch.enable',{patterns:[{urlPattern:'http*',resourceType:'Image',requestStage:'Request'}]});timings.browserReadyMs=Math.round(performance.now()-timingStart);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:"window.__authoringUnhandled=[];window.addEventListener('unhandledrejection',event=>window.__authoringUnhandled.push(String(event.reason)));"});
  for(const width of [420,1040]){
   const viewportStart=performance.now(),eventStart=preview.events.length;
   pageErrors.length=0;failedRequests.length=0;
   await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:preview.url});
   for(let n=0;n<100;n++){if(await evaluate("Boolean(window.__APPS_PREVIEW?.bridgeReady&&window.__APPS_PREVIEW?.dataRead&&document.querySelector('iframe')?.contentDocument?.body?.innerText.trim())"))break;await pause(100);}
   const assertions=[],assert=(id,required,expected,actual,pass)=>assertions.push({id,required,expected,actual:actual===undefined?null:String(actual),status:pass?'PASS':'FAIL',evidenceRefs:[]});
   const state=await evaluate('window.__APPS_PREVIEW??null');assert('bridge.v2',true,'v2 hello and getData for frozen build',state?.identity?.buildId,Boolean(state?.bridgeReady&&state?.dataRead&&state.identity.buildId===build.archiveBuildId));
   const layout=await evaluate("(()=>{const d=document.querySelector('iframe').contentDocument;return {visible:!!d.body&&d.body.getBoundingClientRect().height>0&&d.body.innerText.trim().length>0,overflow:d.documentElement.scrollWidth>"+width+"};})()");
   assert('render.visible',true,'visible rendered content',layout?.visible,layout?.visible===true);assert('layout.viewport',true,'no document horizontal overflow',layout?.overflow,layout?.overflow===false);
   const readyAt=performance.now();
   const interactionCaseIds=[],screenshots=[];
   const interactiveControlCount=await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[role=button],[role=checkbox],[role=switch]').length");
   for(const item of testPlan.cases.filter(item=>!item.viewports||item.viewports.includes(width))){
    try{
     let actual;
     const fillValue=item.valueFromSelector?await evaluate(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(item.valueFromSelector)});if(!el?.textContent?.trim())throw Error('Search sample target missing');return el.textContent.trim()})()`):item.value;
     const selector=JSON.stringify(item.selector);
     if(item.action){
      await evaluate(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector(${selector});if(!el||el.matches(':disabled')||el.closest('[inert]'))throw Error('Unavailable interaction target');el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);
      await pause(50);
      const point=await evaluate(`(()=>{const f=document.querySelector('iframe'),d=f.contentDocument,el=d.querySelector(${selector}),r=el.getBoundingClientRect(),p=f.getBoundingClientRect();const left=Math.max(0,r.left),right=Math.min(d.documentElement.clientWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(d.documentElement.clientHeight,r.bottom);if(right<=left||bottom<=top)throw Error('Interaction target is not visible');const x=(left+right)/2,y=(top+bottom)/2,hit=d.elementFromPoint(x,y);if(!hit||!(hit===el||el.contains(hit)))throw Error('Interaction target is covered by '+(hit?.tagName??'nothing')+'.'+(hit?.className??''));const outerX=p.left+f.clientLeft+x,outerY=p.top+f.clientTop+y;if(document.elementFromPoint(outerX,outerY)!==f)throw Error('Component iframe is covered');return {x:outerX,y:outerY}})()`);
      await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      await command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
      if(item.action==='fill'){
       await evaluate(`(()=>{const d=document.querySelector('iframe').contentDocument,el=d.querySelector(${selector});if(d.activeElement!==el||!['INPUT','TEXTAREA'].includes(el.tagName)||el.readOnly)throw Error('Text target did not receive editable focus');return true})()`);
       await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
       await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
       await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
       await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
       if(fillValue)await command('Input.insertText',{text:fillValue});
      }
      interactionCaseIds.push(item.id);
     }
     await pause(50);
     const target=JSON.stringify(item.checkSelector??item.selector);
     await waitForOperations(item.operationTimeoutMs);
     const checkDeadline=Date.now()+5000;
     do{
     actual=await evaluate(`(()=>{const d=document.querySelector('iframe').contentDocument;${item.check==='count'?`return d.querySelectorAll(${target}).length`:`const el=d.querySelector(${target});return ${item.check==='checked'?'el?.checked':item.check==='value'?'el?.value':item.check==='visible'?'!!el&&el.getBoundingClientRect().height>0':'el?.textContent?.trim()'}`};})()`);
     if(item.check==='contains'?String(actual).includes(String(item.expected)):actual===item.expected)break;
     await pause(50);
     }while(Date.now()<checkDeadline);
     const pass=item.check==='contains'?String(actual).includes(String(item.expected)):actual===item.expected;
     let shot;
     if(item.screenshot){
      if(item.screenshot.selector)await evaluate(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(item.screenshot.selector)});if(!el)throw Error('Screenshot target missing');el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});})()`);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const capture=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),path=join(runDirectory,`viewport-${width}-step-${screenshots.length+1}.png`);writeFileSync(path,Buffer.from(capture.data,'base64'));shot=evidenceFile(path);screenshots.push({afterCase:item.id,selector:item.screenshot.selector??null,file:shot});
     }
     assert(item.id,item.required!==false,JSON.stringify(item.expected),actual,pass);if(shot)assertions[assertions.length-1].evidenceRefs=[shot];
    }catch(error){assert(item.id,item.required!==false,JSON.stringify(item.expected),error.message,false);if(operationBlocked)break;}
   }
   const rejections=await evaluate("[...(window.__authoringUnhandled??[]),...(document.querySelector('iframe').contentWindow.__authoringUnhandled??[])]");unhandledRejections.push(...rejections);
   const interactionsAt=performance.now();
   const capture=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(runDirectory,`viewport-${width}.png`);writeFileSync(path,Buffer.from(capture.data,'base64'));const screenshot=evidenceFile(path);for(const item of assertions)if(!item.evidenceRefs.length)item.evidenceRefs=[screenshot];
   timings[width]={readyMs:Math.round(readyAt-viewportStart),interactionMs:Math.round(interactionsAt-readyAt),screenshotMs:Math.round(performance.now()-interactionsAt)};
   const bindingSnapshots=await evaluate("window.__APPS_PREVIEW.events.flatMap(event=>(event.response?.result?.bindings??[]).map(binding=>({method:event.request.method??event.request.feature,bindingId:binding.bindingId,revision:binding.revision,sourceDataTime:binding.sourceDataTime,lastSuccessAt:binding.lastSuccessAt})))");
   const missingMethods=(input.requiredMethods??[]).filter(method=>!preview.events.slice(eventStart).some(event=>event.method===method&&!event.error));
   for(const method of missingMethods)assertions.push({id:`bridge:${method}`,required:true,expected:'A successful bridge call in this viewport',actual:'Required feature was not exercised successfully',status:'NOT_RUN',evidenceRefs:[screenshot]});
   viewportResults.push({bridgeCalls:preview.events.slice(eventStart),id:`width-${width}`,contentWidthCssPx:width,heightCssPx:900,deviceScaleFactor:1,screenshot,screenshots,bindingSnapshots,pageErrors:[...pageErrors],unhandledRejections:rejections,failedRequests:failedRequests.map(item=>JSON.stringify(item)),bridgeReady:state?.bridgeReady===true,assertionIds:assertions.map(item=>item.id),interactionCaseIds,interactiveControlCount,assertions});
   if(operationBlocked)break;
  }
  const assertionResults=viewportResults.flatMap(view=>view.assertions.map(item=>({...item,id:`${view.id}:${item.id}`})));for(const view of viewportResults){view.assertionIds=view.assertions.map(item=>`${view.id}:${item.id}`);delete view.assertions;}
  for(const method of input.requiredMethodsOnce??[]){if(!preview.events.some(event=>event.method===method&&!event.error))assertionResults.push({id:`bridge:once:${method}`,required:true,expected:'Successful operation in the declared viewport',actual:'Required operation was not completed',status:'NOT_RUN',evidenceRefs:[]});}
   const bridgeFailures=preview.events.filter(event=>event.error&&['readBindingPage','invokeCapability','refresh','attachSelection'].includes(event.method));
  for(const [index,event] of bridgeFailures.entries())assertionResults.push({id:`bridge:error:${index}`,required:true,expected:'Successful bridge operation',actual:`${event.method}: ${event.error}`,status:event.error==='PREVIEW_CAPABILITY_UNAVAILABLE'||event.error==='UNSUPPORTED_HOST_CAPABILITY'?'BLOCKED':'FAIL',evidenceRefs:[]});
  const incomplete=operationBlocked||testPlan.errors.length||assertionResults.some(item=>item.status==='NOT_RUN')||assertionResults.some(item=>item.status==='BLOCKED')||testPlan.mode==='noninteractive'&&viewportResults.some(view=>view.interactiveControlCount>0);
  const verdict=incomplete?'INCOMPLETE':viewportResults.some(view=>view.pageErrors.length||view.unhandledRejections.length||view.failedRequests.length||!view.bridgeReady)||assertionResults.some(item=>item.required&&item.status!=='PASS')?'FAIL':'PASS';
  const report={schemaVersion:1,attemptId:input.attemptId,epoch:input.epoch,buildReceiptId:input.buildReceiptId,buildId:build.archiveBuildId,protocol:'dsh.apps.component.v2',mode:input.mode,runnerVersion:'dsh-authoring-preview/1',startedAt,finishedAt:new Date().toISOString(),viewportResults,assertionResults,testPlan,verdict};
  await images.finish();await Promise.all([...imageTasks]);timings.totalMs=Math.round(performance.now()-timingStart);
  const diagnostics={imageMode:'preview-cache-and-placeholder',note:'Screenshots do not measure live image loading. Sample downloads are bounded to six URLs and five seconds total.',timings,images:images.records};
  const diagnosticsPath=join(runDirectory,'diagnostics.json');writeFileSync(diagnosticsPath,JSON.stringify(diagnostics,null,2));
  return {report,reportRef:runner.writeReport('preview',report),diagnosticsPath,diagnostics};
 }finally{socket?.close();child.kill();if(child.exitCode===null)await new Promise(accept=>{const timer=setTimeout(accept,2000);child.once('close',()=>{clearTimeout(timer);accept();});});for(const item of pending.values())item.reject(new Error('Preview closed'));pending.clear();await preview.close();}
}
if(process.argv[1]&&/apps-authoring-preview\.(mjs|js)$/.test(process.argv[1])&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one preview request JSON path.');const result=await runAuthoringPreview(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify({summaryPath:result.summaryPath,previewReceiptId:result.summary.previewReceiptId,reportRef:result.reportRef,verdict:result.report.verdict,diagnosticsPath:result.diagnosticsPath,timings:result.diagnostics.timings}));if(result.report.verdict!=='PASS')process.exitCode=1;
}
