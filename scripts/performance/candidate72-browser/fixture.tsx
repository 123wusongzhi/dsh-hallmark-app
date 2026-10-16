// Build aliases: PROFILE_COMPONENT -> selected production Component.tsx,
// PROFILE_CSS -> the same production src/styles.css processed by the normal CSS pipeline.
// React and react-dom must resolve to one React 18.3.1 installation.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Component from 'PROFILE_COMPONENT';
import 'PROFILE_CSS';
import {BROKEN_IMAGE,createRecords,fixtureData,FIXTURE_CONTEXT,type FixtureRecord} from './fixture-data';

type ActionSample={index:number;name:string;phase:string;round:number;startTime:number;endTime:number;dispatchToLayoutMs:number;layoutHeight:number;markPrefix:string};
type RunOptions={profileWindow?:{from:number;to:number};captureFrames?:boolean};
type BenchApi={ready:Promise<any>;run:(warmup?:number,rounds?:number,options?:RunOptions)=>Promise<any>;parity:(options?:{includeFrames?:boolean;imageFailure?:boolean})=>Promise<any>;snapshot:()=>any;reset:()=>Promise<any>};
declare global{interface Window{__BENCH__:BenchApi;__BENCH_HOST__?:{messages:any[];publish:(data:any)=>void;ready:(value:any)=>void;fail:(value:any)=>void};}}
const CHANNEL='hallmark.source.v1',params=new URLSearchParams(location.search),size=Number(params.get('size')??500);
const records=createRecords(size),networkAttempts:any[]=[];
function invariant(value:unknown,message:string):asserts value{if(!value)throw Error(`Fixture invariant: ${message}`);}
const same=(actual:any,expected:any,message:string)=>invariant(JSON.stringify(actual)===JSON.stringify(expected),`${message}\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}`);
const metadata=()=>({size,react:React.version,ua:navigator.userAgent,locale:Intl.DateTimeFormat().resolvedOptions(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},imageMode:'authentic captured source pixels; invalid PNG is an explicit byte-decode fault',clock:performance.timeOrigin});
function installNetworkGuard(){
 const deny=(kind:string,url:unknown)=>{networkAttempts.push({kind,url:String(url),at:performance.now()});throw Error(`Unexpected network operation: ${kind}`);};
 window.fetch=((input:any)=>Promise.reject(deny('fetch',input?.url??input))) as typeof fetch;
 XMLHttpRequest.prototype.open=function(_method:string,url:string|URL){deny('XHR',url);} as typeof XMLHttpRequest.prototype.open;
 const BlockedSocket=function(url:string){deny('WebSocket',url);};
 const BlockedEvents=function(url:string){deny('EventSource',url);};
 Object.defineProperty(window,'WebSocket',{value:BlockedSocket,configurable:true});
 Object.defineProperty(window,'EventSource',{value:BlockedEvents,configurable:true});
 try{Object.defineProperty(navigator,'sendBeacon',{value:(url:string)=>deny('sendBeacon',url),configurable:true});}catch{}
}
installNetworkGuard();

if(!params.has('benchChild')){
 // A genuine same-origin parent/iframe pair exercises the unchanged runtime bridge.
 // The top-level API proxies calls; screenshots can target the iframe or whole page.
 const mount=document.getElementById('root')??document.body;
 mount.replaceChildren();document.body.style.margin='0';
 const iframe=document.createElement('iframe');iframe.id='bench-frame';iframe.title='采集商品真实浏览器基准';
 iframe.style.cssText='display:block;border:0;width:100%;height:100vh;background:#f5f7fb';
 const childUrl=new URL(location.href);childUrl.searchParams.set('benchChild','1');iframe.src=childUrl.href;
 let data=fixtureData(records),resolveReady:(value:any)=>void=()=>{},rejectReady:(value:any)=>void=()=>{};
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});const messages:any[]=[];
 window.__BENCH_HOST__={messages,publish(next){data=next;iframe.contentWindow!.postMessage({channel:CHANNEL,event:'data',data},location.origin);},ready(value){resolveReady(value);},fail(value){const error=new Error(value?.message??String(value));if(value?.stack)error.stack=value.stack;rejectReady(error);}};
 window.addEventListener('message',event=>{
  if(event.source!==iframe.contentWindow||event.origin!==location.origin||event.data?.channel!==CHANNEL||!event.data?.method)return;
  const request=event.data;messages.push({method:request.method,params:request.params});
  let result:any,error:string|undefined;
  if(request.method==='getData')result=data;
  else if(request.method==='getContext')result=FIXTURE_CONTEXT;
  else error=`Unexpected fixture bridge method: ${request.method}`;
  iframe.contentWindow!.postMessage({channel:CHANNEL,requestId:request.requestId,...(error?{error}:{result})},location.origin);
 });
 const child=()=>{invariant(iframe.contentWindow?.__BENCH__,'child API exists');return iframe.contentWindow.__BENCH__;};
 window.__BENCH__={ready,run:async(...args)=>{await ready;return child().run(...args);},parity:async(...args)=>{await ready;return child().parity(...args);},snapshot:()=>child().snapshot(),reset:async()=>{await ready;return child().reset();}};
 mount.append(iframe);
}else{
 invariant(parent!==window&&parent.location.origin===location.origin,'same-origin iframe parent');
 const mount=document.getElementById('root')??document.body.appendChild(document.createElement('div'));mount.id='root';
 const root=createRoot(mount);let generation=0,revision=1,busy=false;
 let search='',source='all',page=0;const selected=new Set<string>();
 const longTasks:any[]=[];let observer:PerformanceObserver|undefined;
 const captureLongTasks=(entries:PerformanceEntry[])=>{for(const entry of entries)longTasks.push({name:entry.name,startTime:entry.startTime,duration:entry.duration,entryType:entry.entryType,attribution:Array.from((entry as any).attribution??[],(a:any)=>({name:a.name,entryType:a.entryType,containerType:a.containerType,containerSrc:a.containerSrc,containerId:a.containerId,containerName:a.containerName}))});};
 if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){observer=new PerformanceObserver(list=>captureLongTasks(list.getEntries()));observer.observe({type:'longtask',buffered:true});}
 const nextFrame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
 const doubleFrame=async()=>{const first=await nextFrame();const second=await nextFrame();return{first,second};};
 const matches=()=>{
  const needle=search.trim().toLowerCase();const result=records.filter(r=>(source==='all'||r.oracle.source===source)&&(!needle||`${r.oracle.title} ${r.oracle.source}`.toLowerCase().includes(needle)));
  result.sort((a,b)=>{const x=a.oracle.timestamp,y=b.oracle.timestamp;if(x===undefined&&y===undefined)return a.oracle.index-b.oracle.index;if(x===undefined)return 1;if(y===undefined)return -1;return y-x||a.oracle.index-b.oracle.index;});return result;
 };
 const visibleRecords=()=>matches().slice(page*20,(page+1)*20);
 const desktopRows=()=>Array.from(mount.querySelectorAll<HTMLTableRowElement>('.desktop-table tbody tr'));
 const mobileRows=()=>Array.from(mount.querySelectorAll<HTMLElement>('.mobile-list article'));
 const visible=(element:HTMLElement)=>element.getClientRects().length>0;
 function control<T extends HTMLElement>(tag:string,label:string):T{
  const all=Array.from(mount.querySelectorAll<HTMLElement>(tag)).filter(n=>n.getAttribute('aria-label')===label);
  const found=all.find(visible)??all[0];invariant(found,`${tag} ${label}`);return found as T;
 }
 const nativeValue=(element:HTMLInputElement|HTMLSelectElement,value:string)=>{
  const prototype=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;invariant(setter,'native value setter');setter.call(element,value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
 };
 const forceLayout=()=>{const rect=mount.getBoundingClientRect();return{height:rect.height,width:rect.width,documentHeight:document.documentElement.offsetHeight};};
 const controlsSnapshot=()=>Array.from(mount.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button')).map(n=>({tag:n.tagName,ariaLabel:n.getAttribute('aria-label'),text:n.tagName==='BUTTON'?n.textContent:undefined,disabled:n.disabled,...(n instanceof HTMLInputElement?{type:n.type,value:n.value,checked:n.checked,indeterminate:n.indeterminate}:n instanceof HTMLSelectElement?{value:n.value,options:Array.from(n.options,o=>({value:o.value,text:o.text,selected:o.selected}))}:{})}));
 const displayedPrice=(record:FixtureRecord)=>{
  const row=record.row;if(row.minPrice===undefined)return '未提供报价';
  const formatter=new Intl.NumberFormat('zh-CN',{style:'currency',currency:row.currency,maximumFractionDigits:2});
  const min=formatter.format(row.minPrice);return row.maxPrice!==undefined&&row.maxPrice>row.minPrice?`${min} – ${formatter.format(row.maxPrice)}`:min;
 };
 const displayedDate=(record:FixtureRecord)=>record.oracle.timestamp===undefined?'时间未提供':new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(record.oracle.date!));
 function assertState(name:string){
  const expected=visibleRecords(),all=matches();invariant(page>=0&&page<Math.max(1,Math.ceil(all.length/20)),`${name}: page valid`);
  for(const [branch,rows]of [['desktop',desktopRows()],['mobile',mobileRows()]] as const){
   same(rows.map(row=>row.querySelector('.product-name')?.textContent),expected.map(r=>r.oracle.title),`${name}: ${branch} complete titles/order`);
   rows.forEach((row,index)=>{
    const record=expected[index],input=row.querySelector<HTMLInputElement>('input[type=checkbox]')!,time=row.querySelector('time')!;
    invariant(input.checked===selected.has(record.key),`${name}: ${branch} selection ${record.key}`);
    invariant(row.getAttribute('data-selected')===String(selected.has(record.key)),`${name}: ${branch} selected attribute`);
    same(row.querySelector('.product-name')?.getAttribute('title'),record.oracle.title,`${name}: full title attribute`);
    same(row.querySelector('.source-tag')?.textContent,record.oracle.source,`${name}: source`);
    same(row.querySelector('.product-price,.missing-value')?.textContent,displayedPrice(record),`${name}: price`);
    same(Array.from(time.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(''),displayedDate(record),`${name}: date text`);
    if(branch==='desktop'){
     same(time.getAttribute('datetime'),record.oracle.date??null,`${name}: raw date attribute`);
     same(time.getAttribute('title'),`${record.oracle.timeLabel} · ${record.oracle.date??'未提供'}`,`${name}: date title`);
    }
   });
  }
  const footer=mount.querySelector('footer')!;invariant(footer.textContent?.includes(selected.size?`已选 ${selected.size} 件商品`:'选择你想处理的商品'),`${name}: selection count`);
  invariant(networkAttempts.length===0,`${name}: no network operations`);
  const bridge=parent.__BENCH_HOST__!.messages;invariant(bridge.every(m=>m.method==='getData'||m.method==='getContext'),`${name}: only initial bridge reads`);
  return{name,search,source,page,total:all.length,keys:expected.map(r=>r.key),selected:[...selected].sort(),desktopMobileSame:true};
 }
 function snapshot(){
  return{html:mount.innerHTML,controls:controlsSnapshot(),oracle:assertState('snapshot'),layout:forceLayout(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},branches:{desktop:visible(mount.querySelector<HTMLElement>('.desktop-table')??mount),mobile:visible(mount.querySelector<HTMLElement>('.mobile-list')??mount)},bridge:parent.__BENCH_HOST__!.messages.map(x=>({...x})),networkAttempts:[...networkAttempts]};
 }
 async function waitLoaded(){
  const deadline=performance.now()+15000;
  while(!mount.querySelector('[data-ready="ready"]')||desktopRows().length!==Math.min(20,size)){
   invariant(performance.now()<deadline,'component load deadline');await nextFrame();
  }
  await document.fonts.ready;
  // Hidden/offscreen loading=lazy images may never start. Only decode images
  // already complete, leave all loading attributes untouched, and bound even
  // those decode promises so image scheduling cannot hold readiness forever.
  const completedImages=Array.from(mount.querySelectorAll('img')).filter(image=>image.complete&&image.naturalWidth>0);
  let decodeTimer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([Promise.all(completedImages.map(image=>image.decode().catch(()=>{}))),new Promise<void>(resolve=>{decodeTimer=setTimeout(resolve,500);})]);}
  finally{if(decodeTimer!==undefined)clearTimeout(decodeTimer);}
  await doubleFrame();
  assertState('loaded');
 }
 async function reset(){
  search='';source='all';page=0;selected.clear();
  // Reset with a new component identity, preserving normal runtime connection startup.
  flushSync(()=>root.render(<React.StrictMode><Component key={++generation}/></React.StrictMode>));await waitLoaded();return snapshot();
 }
 const mark=(name:string,detail?:any)=>performance.mark(name,{detail});
 function act(name:string,dispatch:()=>void,update:()=>void,index=0,phase='parity',round=0):ActionSample{
  update();const prefix=`bench:${phase}:round:${round}:action:${index}:${name}`;mark(prefix+':start');
  const startTime=performance.now();flushSync(dispatch);const layout=forceLayout();const endTime=performance.now();
  mark(prefix+':end');performance.measure(prefix,prefix+':start',prefix+':end');
  return{index,name,phase,round,startTime,endTime,dispatchToLayoutMs:endTime-startTime,layoutHeight:layout.height,markPrefix:prefix};
 }
 const searchAction=(value:string,index:number,phase:string,round:number)=>{const node=control<HTMLInputElement>('input','搜索商品');return act(`search ${JSON.stringify(value)}`,()=>nativeValue(node,value),()=>{search=value;page=0;},index,phase,round);};
 const sourceAction=(value:string,index:number,phase:string,round:number)=>{const node=control<HTMLSelectElement>('select','筛选来源');return act(`source ${value}`,()=>nativeValue(node,value),()=>{source=value;page=0;},index,phase,round);};
 const pageAction=(direction:number,index:number,phase:string,round:number)=>{const label=direction===1?'下一页':'上一页',node=control<HTMLButtonElement>('button',label);invariant(!node.disabled,`${label} available`);return act(label,()=>node.click(),()=>{page+=direction;},index,phase,round);};
 const toggleAction=(index:number,phase:string,round:number,recordIndex=0)=>{const record=visibleRecords()[recordIndex];invariant(record,'toggle record');const node=control<HTMLInputElement>('input','选择'+record.oracle.title);return act(`toggle ${record.key}`,()=>node.click(),()=>{selected.has(record.key)?selected.delete(record.key):selected.add(record.key);},index,phase,round);};
 const pageToggleAction=(index:number,phase:string,round:number)=>{const node=control<HTMLInputElement>('input','选择本页商品'),rows=visibleRecords(),all=rows.every(r=>selected.has(r.key));return act('toggle page',()=>node.click(),()=>{for(const record of rows)all?selected.delete(record.key):selected.add(record.key);},index,phase,round);};
 const clearAction=(index:number,phase:string,round:number)=>{const node=mount.querySelector<HTMLButtonElement>('.clear-selection');invariant(node,'clear selection button exists');return act('clear selection',()=>node.click(),()=>selected.clear(),index,phase,round);};
 function actions(phase:string,round:number){
  return[searchAction('Lamp',0,phase,round),searchAction('  lAmP  ',1,phase,round),sourceAction('1688',2,phase,round),searchAction('',3,phase,round),sourceAction('all',4,phase,round),pageAction(1,5,phase,round),toggleAction(6,phase,round),pageAction(-1,7,phase,round),pageToggleAction(8,phase,round),pageToggleAction(9,phase,round),clearAction(10,phase,round)];
 }
 const profileNotice=(phase:'start'|'end',round:number)=>{const detail={phase,round,at:performance.now()};mark(`bench:profile:${phase}`,detail);window.dispatchEvent(new CustomEvent('bench-profile',{detail}));parent.dispatchEvent(new CustomEvent('bench-profile',{detail}));};
 async function run(warmup=30,rounds=100,options:RunOptions={}){
  invariant(!busy,'no concurrent fixture operations');invariant(Number.isInteger(warmup)&&warmup>=0&&Number.isInteger(rounds)&&rounds>=0,'valid cycle counts');
  busy=true;
  try{
   // run(30,0) then run(0,100) preserves the mounted component and heap; no implicit
   // remount, forced GC, animation wait or idle delay is inserted between calls.
   const initialFrame=snapshot();const runStart=performance.now();const marksBefore=performance.getEntriesByType('mark').length;
   let warmupStart=performance.now();const warmupSamples:any[]=[];
   for(let round=0;round<warmup;round++){
    const prefix=`bench:warmup:round:${round}`;mark(prefix+':start');const start=performance.now();const result=actions('warmup',round);const dispatchEnd=performance.now(),raf=await doubleFrame();mark(prefix+':end');
    warmupSamples.push({round,actions:result,dispatchBatchMs:dispatchEnd-start,paintOpportunityWaitMs:raf.second-dispatchEnd,cycleToSecondRafMs:raf.second-start});
   }
   const warmupMs=performance.now()-warmupStart;const warmFrame=snapshot();const samples:any[]=[];const measurementStart=performance.now();
   for(let round=0;round<rounds;round++){
    if(options.profileWindow?.from===round)profileNotice('start',round);
    const prefix=`bench:measure:round:${round}`;mark(prefix+':start');const start=performance.now();const result=actions('measure',round);const dispatchEnd=performance.now(),raf=await doubleFrame();mark(prefix+':end');
    samples.push({round,actions:result,dispatchBatchMs:dispatchEnd-start,paintOpportunityWaitMs:raf.second-dispatchEnd,cycleToSecondRafMs:raf.second-start,rafTimestamps:raf});
    if(options.profileWindow?.to===round)profileNotice('end',round);
   }
   const measurementEnd=performance.now();const finalFrame=snapshot();await new Promise(resolve=>setTimeout(resolve,0));if(observer)captureLongTasks(observer.takeRecords());
   return{metadata:metadata(),warmup,rounds,options,initialFrame:options.captureFrames===false?undefined:initialFrame,warmFrame:options.captureFrames===false?undefined:warmFrame,finalFrame:options.captureFrames===false?undefined:finalFrame,warmupMs,measurementStart,measurementEnd,measurementMs:measurementEnd-measurementStart,warmupSamples,samples,longTaskSupported:!!observer,longTasks:longTasks.filter(t=>t.startTime+t.duration>=runStart&&t.startTime<=measurementEnd),marks:performance.getEntriesByType('mark').slice(marksBefore).map(m=>({name:m.name,startTime:m.startTime,detail:(m as any).detail})),networkAttempts:[...networkAttempts],measurementMeaning:'dispatchToLayoutMs includes native event dispatch, synchronous React commit/effects and forced style/layout. Double-rAF is recorded once per 11-action cycle as a paint opportunity, not proof of physical display paint. No per-action oracle is executed in measured loops.'};
  }finally{busy=false;}
 }
 async function parity(options:{includeFrames?:boolean;imageFailure?:boolean}={}){
  invariant(!busy,'no concurrent fixture operations');busy=true;const frames:any[]=[];let step=0;
  const capture=(name:string)=>{const oracle=assertState(name);frames.push({name,oracle,...(options.includeFrames===false?{}:{html:mount.innerHTML,controls:controlsSnapshot()})});return oracle;};
  const settleCapture=async(name:string)=>{await doubleFrame();return capture(name);};
  const invoke=async(fn:()=>any)=>{const result=fn();await settleCapture(result.name);return result;};
  const walk=async(name:string)=>{
   invariant(page===0,`${name}: starts first page`);const expected=matches().map(r=>r.key),actual:string[]=[];
   while(true){actual.push(...capture(`${name} page ${page}`).keys);if(control<HTMLButtonElement>('button','下一页').disabled)break;await invoke(()=>pageAction(1,step++,'parity',0));}
   same(actual,expected,`${name}: complete query result`);while(page>0)await invoke(()=>pageAction(-1,step++,'parity',0));
   return{name,total:actual.length,keys:actual};
  };
  try{
   await reset();capture('initial');const queries=[];
   queries.push(await walk('all sorted'));await invoke(()=>toggleAction(step++,'parity',0));await invoke(()=>pageAction(1,step++,'parity',0));await invoke(()=>toggleAction(step++,'parity',0));await invoke(()=>pageAction(-1,step++,'parity',0));
   await invoke(()=>searchAction('  LaMp  ',step++,'parity',0));queries.push(await walk('case-insensitive whitespace Lamp'));
   await invoke(()=>sourceAction('1688',step++,'parity',0));queries.push(await walk('Lamp + 1688'));
   await invoke(()=>searchAction('',step++,'parity',0));queries.push(await walk('source 1688'));await invoke(()=>pageToggleAction(step++,'parity',0));await invoke(()=>pageToggleAction(step++,'parity',0));
   await invoke(()=>sourceAction('all',step++,'parity',0));await invoke(()=>searchAction('淘宝',step++,'parity',0));queries.push(await walk('search matches source'));
   await invoke(()=>searchAction('商品',step++,'parity',0));queries.push(await walk('all Chinese titles'));
   await invoke(()=>searchAction('___no_match___',step++,'parity',0));invariant(mount.textContent?.includes('没有找到相符的商品'),'empty result notice');
   await invoke(()=>searchAction('',step++,'parity',0));await invoke(()=>sourceAction('AliExpress',step++,'parity',0));queries.push(await walk('AliExpress source'));
   await invoke(()=>sourceAction('all',step++,'parity',0));if(selected.size)await invoke(()=>clearAction(step++,'parity',0));
   await invoke(()=>pageAction(1,step++,'parity',0));await invoke(()=>searchAction('Lamp',step++,'parity',0));invariant(page===0,'search resets page');await invoke(()=>searchAction('',step++,'parity',0));
   let imageFailure:any;
   if(options.imageFailure!==false){
    const index=visibleRecords().findIndex(r=>r.row.mainImage);invariant(index>=0,'image fixture exists');const record=visibleRecords()[index],original=record.row.mainImage;
    const imageState=()=>({desktop:desktopRows()[index].querySelectorAll('img').length,mobile:mobileRows()[index].querySelectorAll('img').length});
    const imageDetails=()=>Object.fromEntries([['desktop',desktopRows()[index]],['mobile',mobileRows()[index]]].map(([branch,row])=>{const img=(row as Element).querySelector('img');return[branch,{hasImage:!!img,complete:img?.complete??null,naturalWidth:img?.naturalWidth??null,src:img?.getAttribute('src')??null,loading:img?.getAttribute('loading')??null}];}));
    const publish=async()=>{parent.__BENCH_HOST__!.publish(fixtureData(records,`synthetic-r${++revision}`));await doubleFrame();};
    const naturalErrorEvents:any[]=[];
    const observeError=(event:Event)=>{const target=event.target;if(target instanceof HTMLImageElement&&target.getAttribute('src')===BROKEN_IMAGE)naturalErrorEvents.push({branch:target.closest('.desktop-table')?'desktop':'mobile',isTrusted:event.isTrusted});};
    document.addEventListener('error',observeError,true);
    let naturalDecode:any;
    try{
     record.row.mainImage=BROKEN_IMAGE;await publish();
     // Hidden responsive images do not otherwise start lazy loading. Only this
     // untimed error case requests eager decoding; ordinary runs remain untouched.
     for(const row of [desktopRows()[index],mobileRows()[index]])for(const img of row.querySelectorAll('img'))img.loading='eager';
     const deadline=performance.now()+5000;
     while(true){
      const images=[desktopRows()[index],mobileRows()[index]].flatMap(row=>Array.from(row.querySelectorAll('img')));
      // A completed invalid image can remain mounted in the unmodified baseline.
      // Record that native behavior instead of requiring a product bug fix here.
      if(images.every(img=>img.getAttribute('src')===BROKEN_IMAGE&&img.complete&&img.naturalWidth===0))break;
      invariant(performance.now()<deadline,'actual invalid data image completes decoding');await nextFrame();
     }
     await doubleFrame();naturalDecode={branches:imageDetails(),errorEvents:naturalErrorEvents};
    }finally{document.removeEventListener('error',observeError,true);}
    // Keep the native failure observation above intact. Start the separate
    // handler contract from the same valid source and fresh component in both
    // arms, so natural error/effect scheduling cannot select different replays.
    record.row.mainImage=original;await publish();await reset();
    const controlledImages=[['desktop',desktopRows()[index].querySelector('img')],['mobile',mobileRows()[index].querySelector('img')]] as const;
    for(const [branch,img]of controlledImages){invariant(img,`${branch}: controlled error starts with an image`);same(img.getAttribute('src'),original,`${branch}: controlled error uses restored valid source`);}
    // reset already waits two frames; allow another passive-effect/commit turn
    // and require the exact same DOM nodes to remain before dispatching errors.
    flushSync(()=>{});await doubleFrame();
    const sameNodeBeforeDispatch={desktop:desktopRows()[index].querySelector('img')===controlledImages[0][1],mobile:mobileRows()[index].querySelector('img')===controlledImages[1][1]};
    same(sameNodeBeforeDispatch,{desktop:true,mobile:true},'controlled images remain stable after settling');
    const before=imageState();same(before,{desktop:1,mobile:1},'controlled error starts identically in both branches');
    const replayedBranches:string[]=[];
    const controlledEvent={type:'error',bubbles:false,cancelable:false,isTrusted:false};
    // Always deliver exactly one standard error event to desktop then mobile.
    // These synthetic handler events are never labelled native decode failures.
    flushSync(()=>{for(const [branch,img]of controlledImages){invariant(img,'controlled image exists');replayedBranches.push(branch);img.dispatchEvent(new Event('error'));}});
    const fallback=imageState();same(fallback,{desktop:0,mobile:0},'explicit error handler enters both fallbacks');
    const event=toggleAction(step++,'image',0,index),immediate=imageState();await doubleFrame();const settled=imageState();capture('after controlled image error handler and selection');
    imageFailure={key:record.key,brokenImage:BROKEN_IMAGE,naturalDecode,controlledErrorReplay:{replayedBranches,source:original,event:controlledEvent,before,sameNodeBeforeDispatch},fallback,immediateAfterSelection:immediate,settledAfterSelection:settled,event};
    record.row.mainImage=original;await publish();await reset();capture('restored after image case');
   }
   return{metadata:metadata(),queries,frames,imageFailure,final:snapshot(),networkAttempts:[...networkAttempts],oracle:'Independent fixture metadata checks every row in both responsive branches, entire ordered query results, price/date/source/title attributes, cross-page selection, empty state, reset and native image decode failure. Production adapter/filter/format helpers are not imported.'};
  }finally{busy=false;}
 }
 const ready=reset().then(value=>{const result={...metadata(),ready:true,initial:value};parent.__BENCH_HOST__!.ready(result);return result;},error=>{parent.__BENCH_HOST__!.fail({name:error?.name,message:error?.message??String(error),stack:error?.stack});throw error;});
 window.__BENCH__={ready,run,parity,snapshot,reset};
}
