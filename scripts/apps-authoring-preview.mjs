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
 const sources=input.sources??new SourceComponentStore(input.archiveRoot),runner=input.runner??new AuthoringEvidenceRunner(input.evidenceRoot);
 const build=runner.verifyBuild(input.buildReportRef,sources);if(build.attemptId!==input.attemptId||build.epoch!==input.epoch)throw new Error('PREVIEW_BUILD_MISMATCH');
 const testPlan=previewTestPlan(input);
 if(!['fixture','live_readonly'].includes(input.mode))throw new Error('PREVIEW_MODE_REQUIRED');
 const startedAt=new Date().toISOString(),runDirectory=join(runner.root,'preview-'+randomUUID());mkdirSync(runDirectory,{recursive:true});
 const executable=input.browserExecutable??process.env.DSH_PREVIEW_BROWSER_PATH??['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
 if(!executable)throw new Error('PREVIEW_BROWSER_UNAVAILABLE');
 const preview=await startAuthoringPreview({sources,buildId:build.archiveBuildId,mode:input.mode,data:input.data??{viewId:'preview',bindings:[]},context:input.context});
 const portServer=createServer();await new Promise(accept=>portServer.listen(0,'127.0.0.1',accept));const port=portServer.address().port;await new Promise(accept=>portServer.close(accept));
 const child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(runDirectory,'browser-profile')}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let socket,sequence=0;const pending=new Map(),pageErrors=[],unhandledRejections=[],failedRequests=[],responses=new Map();
 const command=(method,params={})=>new Promise((accept,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Preview command timeout: '+method));},10000);pending.set(id,{accept:value=>{clearTimeout(timer);accept(value)},reject:error=>{clearTimeout(timer);reject(error)}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
 const viewportResults=[];
 try{
  let pages;for(let n=0;n<100;n++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(result=>result.json());if(pages.length)break;}catch{}await pause(100);}
  if(!pages?.length)throw new Error('PREVIEW_BROWSER_UNAVAILABLE');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((accept,reject)=>{socket.addEventListener('open',accept,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const item=JSON.parse(event.data),request=pending.get(item.id);if(request){pending.delete(item.id);item.error?request.reject(new Error(item.error.message)):request.accept(item.result);}else if(item.method==='Runtime.exceptionThrown')pageErrors.push(item.params.exceptionDetails.exception?.description??item.params.exceptionDetails.text);else if(item.method==='Network.loadingFailed')failedRequests.push({requestId:item.params.requestId,error:item.params.errorText,url:responses.get(item.params.requestId)??null});else if(item.method==='Network.requestWillBeSent')responses.set(item.params.requestId,item.params.request.url);else if(item.method==='Network.responseReceived'&&item.params.response.status>=400)failedRequests.push({url:item.params.response.url,status:item.params.response.status});});
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');
  await command('Page.addScriptToEvaluateOnNewDocument',{source:"window.__authoringUnhandled=[];window.addEventListener('unhandledrejection',event=>window.__authoringUnhandled.push(String(event.reason)));"});
  for(const width of [420,1040]){
   pageErrors.length=0;failedRequests.length=0;
   await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:preview.url});
   for(let n=0;n<100;n++){if(await evaluate('Boolean(window.__APPS_PREVIEW?.bridgeReady&&window.__APPS_PREVIEW?.dataRead)'))break;await pause(100);}
   const assertions=[],assert=(id,required,expected,actual,pass)=>assertions.push({id,required,expected,actual:actual===undefined?null:String(actual),status:pass?'PASS':'FAIL',evidenceRefs:[]});
   const state=await evaluate('window.__APPS_PREVIEW??null');assert('bridge.v2',true,'v2 hello and getData for frozen build',state?.identity?.buildId,Boolean(state?.bridgeReady&&state?.dataRead&&state.identity.buildId===build.archiveBuildId));
   const layout=await evaluate("(()=>{const d=document.querySelector('iframe').contentDocument;return {visible:!!d.body&&d.body.getBoundingClientRect().height>0&&d.body.innerText.trim().length>0,overflow:d.documentElement.scrollWidth>"+width+"};})()");
   assert('render.visible',true,'visible rendered content',layout?.visible,layout?.visible===true);assert('layout.viewport',true,'no document horizontal overflow',layout?.overflow,layout?.overflow===false);
   const interactionCaseIds=[];
   const interactiveControlCount=await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[role=button],[role=checkbox],[role=switch]').length");
   for(const item of testPlan.cases){
    try{
     let actual;
     const selector=JSON.stringify(item.selector);
     if(item.action==='click'){await evaluate(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector(${selector});if(!el||el.disabled)throw Error('Unavailable interaction target');el.click();return true})()`);interactionCaseIds.push(item.id);}
     if(item.action==='fill'){await evaluate(`(()=>{const el=document.querySelector('iframe').contentDocument.querySelector(${selector});if(!el||el.disabled)throw Error('Unavailable interaction target');const w=el.ownerDocument.defaultView;const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype,'value')?.set;if(!setter)throw Error('Target cannot accept text');setter.call(el,${JSON.stringify(item.value)});el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));return true})()`);interactionCaseIds.push(item.id);}
     await pause(50);
     const target=JSON.stringify(item.checkSelector??item.selector);
     actual=await evaluate(`(()=>{const d=document.querySelector('iframe').contentDocument;${item.check==='count'?`return d.querySelectorAll(${target}).length`:`const el=d.querySelector(${target});return ${item.check==='checked'?'el?.checked':item.check==='value'?'el?.value':item.check==='visible'?'!!el&&el.getBoundingClientRect().height>0':'el?.textContent?.trim()'}`};})()`);
     const pass=item.check==='contains'?String(actual).includes(String(item.expected)):actual===item.expected;assert(item.id,item.required!==false,JSON.stringify(item.expected),actual,pass);
    }catch(error){assert(item.id,item.required!==false,JSON.stringify(item.expected),error.message,false);}
   }
   const rejections=await evaluate("[...(window.__authoringUnhandled??[]),...(document.querySelector('iframe').contentWindow.__authoringUnhandled??[])]");unhandledRejections.push(...rejections);
   const capture=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(runDirectory,`viewport-${width}.png`);writeFileSync(path,Buffer.from(capture.data,'base64'));const screenshot=evidenceFile(path);for(const item of assertions)item.evidenceRefs=[screenshot];
   viewportResults.push({id:`width-${width}`,contentWidthCssPx:width,heightCssPx:900,deviceScaleFactor:1,screenshot,pageErrors:[...pageErrors],unhandledRejections:rejections,failedRequests:failedRequests.map(item=>JSON.stringify(item)),bridgeReady:state?.bridgeReady===true,assertionIds:assertions.map(item=>item.id),interactionCaseIds,interactiveControlCount,assertions});
  }
  const assertionResults=viewportResults.flatMap(view=>view.assertions.map(item=>({...item,id:`${view.id}:${item.id}`})));for(const view of viewportResults){view.assertionIds=view.assertions.map(item=>`${view.id}:${item.id}`);delete view.assertions;}
  const incomplete=testPlan.errors.length||testPlan.mode==='noninteractive'&&viewportResults.some(view=>view.interactiveControlCount>0);
  const verdict=incomplete?'INCOMPLETE':viewportResults.some(view=>view.pageErrors.length||view.unhandledRejections.length||view.failedRequests.length||!view.bridgeReady)||assertionResults.some(item=>item.required&&item.status!=='PASS')?'FAIL':'PASS';
  const report={schemaVersion:1,attemptId:input.attemptId,epoch:input.epoch,buildReceiptId:input.buildReceiptId,buildId:build.archiveBuildId,protocol:'dsh.apps.component.v2',mode:input.mode,runnerVersion:'dsh-authoring-preview/1',startedAt,finishedAt:new Date().toISOString(),viewportResults,assertionResults,testPlan,verdict};
  return {report,reportRef:runner.writeReport('preview',report)};
 }finally{socket?.close();child.kill();if(child.exitCode===null)await new Promise(accept=>{const timer=setTimeout(accept,2000);child.once('close',()=>{clearTimeout(timer);accept();});});for(const item of pending.values())item.reject(new Error('Preview closed'));pending.clear();await preview.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one preview request JSON path.');const result=await runAuthoringPreview(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify({reportRef:result.reportRef,verdict:result.report.verdict}));if(result.report.verdict!=='PASS')process.exitCode=1;
}
