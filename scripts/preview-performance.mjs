import {PERFORMANCE_POLICY_VERSION,PERFORMANCE_PROFILE,PERFORMANCE_IMAGE_DELAY_MS,evaluatePerformance} from '../packages/source-components/src/authoring-performance.ts';

// Installed before component scripts, in the isolated preview browser only.
export function installPerformanceObserver(){
 const state={tasks:[],shifts:[],feedback:[],started:0};
 Object.defineProperty(window,'__dshPreviewPerformance',{value:state});
 for(const [type,key] of [['longtask','tasks'],['layout-shift','shifts']]){
  const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(type!=='layout-shift'||!entry.hadRecentInput)state[key].push({at:entry.startTime,duration:entry.duration,value:entry.value??0});});
  observer.observe({type,buffered:true});
 }
 for(const name of ['click','input','change'])addEventListener(name,event=>{
  if(!event.isTrusted)return;
  const at=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>state.feedback.push({at,duration:performance.now()-at})));
 },true);
}

function imageState(url){
 const doc=document.querySelector('iframe')?.contentDocument;if(!doc)return {matched:0,hidden:false,missingSpace:false};
 const images=[...doc.images].filter(img=>(img.currentSrc||img.src)===url);
 const hidden=img=>!img.getClientRects().length||img.ownerDocument.defaultView.getComputedStyle(img).visibility==='hidden';
 const inViewport=img=>{const r=img.getBoundingClientRect();return !hidden(img)&&r.bottom>0&&r.right>0&&r.top<doc.documentElement.clientHeight&&r.left<doc.documentElement.clientWidth;};
 const first=[...doc.images].find(img=>{const r=img.getBoundingClientRect();return /^https?:/.test(img.currentSrc||img.src)&&inViewport(img)&&r.width>=40&&r.height>=40;});
 const missingSpace=images.some(img=>{
  if(hidden(img))return false;
  const rect=img.getBoundingClientRect(),parent=img.parentElement?.getBoundingClientRect();
  if(rect.top>=doc.documentElement.clientHeight||rect.left>=doc.documentElement.clientWidth||rect.bottom<0)return false;
  // A sized image wrapper also reserves the product's place before decoding.
  return !(rect.width>0&&rect.height>0)&&!(parent&&parent.width>0&&parent.height>0&&parent.width<=320&&parent.height<=320);
 });
 const dimensions=images.map(img=>{const rect=img.getBoundingClientRect(),parent=img.parentElement?.getBoundingClientRect();return {visible:inViewport(img),width:rect.width,height:rect.height,parentWidth:parent?.width??0,parentHeight:parent?.height??0};});
 return {matched:images.length,hidden:images.length>0&&images.every(hidden),missingSpace,dimensions,lazyVisible:images.some(img=>{const r=img.getBoundingClientRect();return inViewport(img)&&r.width>=40&&r.height>=40&&img.loading==='lazy';}),firstVisible:!!first&&images.includes(first),firstHigh:!!first&&first.getAttribute('fetchpriority')==='high'};
}

function sampleFrame(){
 const doc=document.querySelector('iframe')?.contentDocument,win=doc?.defaultView,state=win?.__dshPreviewPerformance;
 if(!doc||!state)throw new Error('PERFORMANCE_OBSERVER_MISSING');
 const tasks=state.tasks.filter(entry=>entry.at>=state.started),shifts=state.shifts.filter(entry=>entry.at>=state.started),feedback=state.feedback.filter(entry=>entry.at>=state.started);
 const visible=[...doc.images].filter(img=>{
  const rect=img.getBoundingClientRect();
  return /^https?:/.test(img.currentSrc||img.src)&&rect.width>=40&&rect.height>=40&&rect.bottom>0&&rect.right>0&&rect.top<win.innerHeight&&rect.left<win.innerWidth&&win.getComputedStyle(img).visibility!=='hidden'&&img.getClientRects().length>0;
 });
 const scriptEntries=win.performance.getEntriesByType('resource').filter(entry=>entry.initiatorType==='script');
 const scriptBytes=scriptEntries.reduce((sum,entry)=>sum+entry.decodedBodySize,0)+[...doc.scripts].filter(script=>!script.src).reduce((sum,script)=>sum+new TextEncoder().encode(script.textContent??'').length,0);
 return {blockingMs:tasks.reduce((sum,entry)=>sum+Math.max(0,entry.duration-50),0),maxTaskMs:Math.max(0,...tasks.map(entry=>entry.duration)),layoutShift:shifts.reduce((sum,entry)=>sum+entry.value,0),domElements:doc.querySelectorAll('*').length,renderedRows:doc.querySelectorAll('[data-product-row],[data-composed-row],tbody tr,[role=row]').length,visibleImages:visible.length,visibleImageDetails:visible.map(img=>({url:img.currentSrc||img.src,lazy:img.loading==='lazy',high:img.getAttribute('fetchpriority')==='high'})),loadedScriptBytes:scriptBytes,feedbackMs:feedback.length?Math.max(...feedback.map(entry=>entry.duration)):null};
}

/** Measures the rendered archive; no caller-provided timing or PASS values are accepted. */
export function previewPerformance({command,evaluate}){
 const viewports=[],requests=new Map();let viewport,phase,previousPhase,started=0;
 const network=message=>{
  const params=message.params;
  if(message.method==='Network.requestWillBeSent')requests.set(params.requestId,{type:params.type,url:params.request.url,initialPriority:params.request.initialPriority,phase,viewport,bytes:0});
  if(message.method==='Network.loadingFinished'){const request=requests.get(params.requestId);if(request)request.bytes=params.encodedDataLength;}
 };
 async function imageRequest(params){
  const owner=phase,view=viewport;
  if(!owner||!view)return;
  const detail=await evaluate(`(${imageState.toString()})(${JSON.stringify(params.request.url)})`);
  // Preserve request-time facts even if onload changes attributes or removes the image.
  owner.images.push({url:params.request.url,networkId:params.networkId,measureVisual:!owner.sample,...detail});
 }
 async function install(){
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`(${installPerformanceObserver.toString()})();`});
  await command('Network.setCacheDisabled',{cacheDisabled:true});
 }
 function startViewport(width){viewport={width,initial:undefined,interactions:[]};viewports.push(viewport);phase={images:[]};viewport.initial=phase;started=performance.now();}
 async function closePhase(){
  if(!phase?.sample)return;
  const snapshot=await evaluate(`(${sampleFrame.toString()})()`);
  for(const key of ['blockingMs','maxTaskMs','layoutShift','domElements','renderedRows','loadedScriptBytes'])phase.sample[key]=Math.max(phase.sample[key],snapshot[key]);
 }
 async function startInteraction(id){
  await closePhase();previousPhase=phase;
  phase={id,images:[]};started=performance.now();
  await evaluate("(()=>{const w=document.querySelector('iframe').contentWindow;w.__dshPreviewPerformance.started=w.performance.now();})()");
 }
 async function finish({readyMs,interaction=false}={}){
  const owner=phase;
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const snapshot=await evaluate(`(${sampleFrame.toString()})()`);
  for(const image of owner.images.filter(image=>image.measureVisual&&image.dimensions?.length)){
   const after=await evaluate(`(${imageState.toString()})(${JSON.stringify(image.url)})`);
   image.missingSpace||=image.dimensions.some((before,index)=>{
    const next=after.dimensions?.[index];if(!before.visible||!next)return false;
    const wrapperStable=before.parentWidth>=40&&before.parentHeight>=40&&before.parentWidth<=320&&before.parentHeight<=320&&Math.abs(before.parentWidth-next.parentWidth)<=1&&Math.abs(before.parentHeight-next.parentHeight)<=1;
    return !wrapperStable&&(Math.abs(before.width-next.width)>1||Math.abs(before.height-next.height)>1);
   });
  }
  owner.sample={readyMs:readyMs??Math.round(performance.now()-started),...snapshot};
  if(!interaction)owner.sample.feedbackMs=null;
  else viewport.interactions.push(owner);
 }
 function result(){
  const convert=(owner,view)=>{
   if(!owner?.sample)throw new Error('PERFORMANCE_SAMPLE_MISSING');
   const networkScriptBytes=[...requests.values()].filter(request=>request.viewport===view&&request.type==='Script').reduce((sum,request)=>sum+request.bytes,0);
   const {visibleImageDetails,...sample}=owner.sample;
   // Scrolling the test driver to a control must not reclassify already loaded lazy images.
   const visible=visibleImageDetails.filter(image=>!owner.id||owner.images.some(request=>request.url===image.url));
   const first=visibleImageDetails[0],checkFirst=!!first&&(!owner.id||visible.includes(first)),request=checkFirst&&[...requests.values()].find(request=>request.viewport===view&&request.phase===owner&&request.type==='Image'&&request.url===first.url);
   const firstPriorityWrong=checkFirst&&(!first.high||!!request&&!['High','VeryHigh'].includes(request.initialPriority));
   const fresh=owner.images.filter(image=>image.measureVisual),requestPriorityWrong=fresh.some(image=>{if(!image.firstVisible)return false;const request=requests.get(image.networkId);return !image.firstHigh||!!request&&!['High','VeryHigh'].includes(request.initialPriority);});
   return {...sample,...(owner.id?{id:owner.id}:{}),lazyVisibleImages:Math.max(visible.filter(image=>image.lazy).length,fresh.filter(image=>image.lazyVisible).length),unprioritizedFirstImage:firstPriorityWrong||requestPriorityWrong?1:0,imageRequests:owner.images.length,hiddenImageRequests:owner.images.filter(image=>image.hidden).length,missingImageSpace:fresh.filter(image=>image.missingSpace).length,loadedScriptBytes:Math.max(sample.loadedScriptBytes,networkScriptBytes)};
  };
  const evidence={policyVersion:PERFORMANCE_POLICY_VERSION,profile:PERFORMANCE_PROFILE,imageDelayMs:PERFORMANCE_IMAGE_DELAY_MS,viewports:viewports.map(view=>({width:view.width,initial:convert(view.initial,view),interactions:view.interactions.map(owner=>convert(owner,view))})),verdict:'INCOMPLETE'};
  evidence.verdict=evaluatePerformance(evidence).verdict;return evidence;
 }
 return {network,imageRequest,install,startViewport,startInteraction,cancelInteraction:()=>{if(!phase?.sample)phase=previousPhase;},finish,finishViewport:closePhase,result,imageDelayMs:PERFORMANCE_IMAGE_DELAY_MS};
}
