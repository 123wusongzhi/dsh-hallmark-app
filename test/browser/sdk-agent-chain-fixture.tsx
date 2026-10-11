import React from 'react';
import {createRoot} from 'react-dom/client';
import {useApps,AppsAgentActions} from '../../packages/component-runtime/src/apps-react.tsx';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import {ComponentBridgeError,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

const fixtureWindow=window as Window&{__SDK_API__?:ReturnType<typeof useApps>;__SDK_BROWSER__?:unknown};
const errors:string[]=[];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const snapshot=(a:string,b:string):JsonValue=>({viewId:'synthetic-view',bindings:[{bindingId:'a',payload:a},{bindingId:'b',payload:b}]});

if(window.parent!==window){
  function Component(){
    const apps=useApps();fixtureWindow.__SDK_API__=apps;
    const bindings=(apps.data as {bindings?:{bindingId:string;payload:unknown}[]}|undefined)?.bindings??[];
    return <main id="component-region"><h2>SDK browser fixture</h2><p>合成数据 · 实际 React 组件与跨 iframe 消息</p><div id="read-state">{apps.loading?'Loading':apps.refreshing?'Refreshing':'Ready'}</div><ul>{bindings.map(binding=><li key={binding.bindingId} data-binding={binding.bindingId}>{binding.bindingId}: <strong>{String(binding.payload)}</strong></li>)}</ul><p id="read-error">{apps.error?.message??''}</p><AppsAgentActions apps={apps} selections={[]} summary="Synthetic selection only"/><p>原始响应不确定时只允许检查；明确未提交时可以修改并显式重试。</p></main>;
  }
  createRoot(document.getElementById('root')!).render(<Component/>);
}else{
  let host:ComponentHost,iframe:HTMLIFrameElement,initialHeld=true,mode:'accept'|'reject-once'|'timeout'='accept',revision=0,mountCount=0;
  const reads:{kind:string;params:unknown;resolve:(value:JsonValue)=>void}[]=[],agentRequests:{requestId:string;text:unknown}[]=[],frameErrors:unknown[]=[],assertions:{name:string;actual:unknown;expected:unknown}[]=[];
  const wait=async(predicate:()=>boolean,label:string,timeout=4000)=>{const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw Error(`Timed out: ${label}`);await new Promise(resolve=>setTimeout(resolve,10));}};
  const equal=(name:string,actual:unknown,expected:unknown)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);assertions.push({name,actual,expected});};
  const child=()=>iframe.contentWindow as typeof fixtureWindow;
  const api=()=>child().__SDK_API__!;
  const values=()=>((api().data as {bindings:{payload:unknown}[]})?.bindings??[]).map(binding=>binding.payload);
  const documentForFrame=()=>iframe.contentDocument!;
  const button=(name:string)=>[...documentForFrame().querySelectorAll('button')].find(button=>button.textContent===name)!;
  const notice=()=>documentForFrame().querySelector('[role="status"]')?.textContent??'';
  const pendingRead=(kind:string,params:unknown)=>new Promise<JsonValue>(resolve=>reads.push({kind,params,resolve}));
  window.addEventListener('message',event=>{
    if(event.source!==iframe?.contentWindow||event.origin!==location.origin||event.data?.channel!==COMPONENT_CHANNEL)return;
    if(event.data.type==='display-error'){frameErrors.push(event.data.error);return;}
    const owner=host,target=iframe.contentWindow;
    void owner.handle(event.data).then(response=>{if(response&&owner===host)target?.postMessage(response,location.origin);});
  });
  async function mount(holdInitial:boolean,agentMode:typeof mode='accept'){
    host?.dispose();iframe?.remove();reads.length=0;agentRequests.length=0;revision=0;initialHeld=holdInitial;mode=agentMode;mountCount++;
    const identity={protocolVersion:'2.0' as const,sessionId:'synthetic-sdk-session',viewId:'synthetic-view',buildId:'synthetic-build',frameInstanceId:`synthetic-frame-${mountCount}`};
    host=new ComponentHost(identity,{
      getData:()=>initialHeld?pendingRead('initial',null):snapshot('a0','b0'),getContext:()=>({contextRevision:revision}),refresh:request=>pendingRead('refresh',request.params),
      updateContext:()=>({status:'updated',contextRevision:++revision,snapshotId:`snapshot-${revision}`,snapshot:{}}),
      requestAgent:request=>{
        agentRequests.push({requestId:request.requestId,text:(request.params as {text:string}).text});
        if(mode==='timeout')return new Promise(()=>{});
        if(mode==='reject-once'&&agentRequests.length===1)throw new ComponentBridgeError({code:'CONTEXT_REVISION_CONFLICT',message:'Publish current context before requesting.',retryPolicy:'never'});
        return {status:'accepted',requestId:request.requestId,contextRevision:revision};
      }
    },{contextRevision:()=>revision,extensionHandlers:{bindingPagesV1:request=>pendingRead('page',request.params)}});
    iframe=document.createElement('iframe');iframe.title='Actual SDK component';iframe.src=`/child?case=${mountCount}`;iframe.id='sdk-frame';document.getElementById('frames')!.append(iframe);
    await wait(()=>Boolean(child().__SDK_API__?.hello),'real bridge handshake');
    if(holdInitial)await wait(()=>reads.some(read=>read.kind==='initial'),'initial request');else await wait(()=>values().length===2&&!api().loading,'initial rendering');
  }
  async function text(value:string){
    const input=documentForFrame().querySelector('input')!,frameWindow=child() as Window&typeof globalThis;
    Object.getOwnPropertyDescriptor(frameWindow.HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new frameWindow.Event('input',{bubbles:true}));await wait(()=>!(button('请求代理') as HTMLButtonElement).disabled,'task input accepted');
  }
  async function publish(){button('更新上下文').click();await wait(()=>documentForFrame().querySelector('section')?.getAttribute('data-context-state')==='published','context published');}
  function show(title:string){document.getElementById('scenario')!.textContent=title;}
  async function initialEvent(){
    show('1 · Delayed initial response versus newer pushed snapshot');await mount(true);
    iframe.contentWindow!.postMessage(host.event('data',snapshot('pushed-a','pushed-b')),location.origin);
    await wait(()=>values()[0]==='pushed-a','pushed data rendered');reads[0].resolve(snapshot('old-a','old-b'));
    await wait(()=>!api().refreshing,'old initial settles');equal('new pushed snapshot survives old initial',values(),['pushed-a','pushed-b']);
    return {values:values(),readState:documentForFrame().getElementById('read-state')!.textContent};
  }
  async function initialRefresh(){
    show('1b · Delayed initial response versus explicit refresh');await mount(true);
    const refreshed=api().refresh();await wait(()=>reads.length===2,'refresh reached host');reads[1].resolve(snapshot('fresh-a','fresh-b'));await refreshed;
    await wait(()=>values()[0]==='fresh-a','refresh rendered');reads[0].resolve(snapshot('old-a','old-b'));await wait(()=>!api().refreshing,'initial completed');equal('explicit refresh survives old initial',values(),['fresh-a','fresh-b']);return {values:values()};
  }
  async function bindingPages(){
    show('2 · Concurrent independent binding pages');await mount(false);
    const a=api().readBindingPage('a','2'),b=api().readBindingPage('b','2');await wait(()=>reads.length===2,'both page requests');
    reads[1].resolve(snapshot('a0','b2'));await b;await wait(()=>values()[1]==='b2','second page rendered');equal('pending sibling keeps refreshing indicator',api().refreshing,true);
    reads[0].resolve(snapshot('a2','b0'));await a;await wait(()=>!api().refreshing,'all pages settled');equal('both independently requested pages survive',values(),['a2','b2']);
    const earlier=api().readBindingPage('a','3'),later=api().readBindingPage('a','4');await wait(()=>reads.length===4,'same binding races');reads[3].resolve(snapshot('a4','stale-b'));await later;reads[2].resolve(snapshot('a3','stale-b'));await earlier;await wait(()=>!api().refreshing,'same binding settled');equal('same binding latest request wins without reverting sibling',values(),['a4','b2']);return {values:values()};
  }
  async function rejectedAction(){
    show('3 · Correct a definitely rejected request, then explicitly retry');await mount(false,'reject-once');await publish();await text('Original synthetic task');button('请求代理').click();await wait(()=>notice().includes('请求未提交'),'definitive rejection presented');
    equal('rejected request unlocks editing',documentForFrame().querySelector('input')!.disabled,false);equal('rejected request unlocks context publication',button('更新上下文').disabled,false);equal('no automatic retry',agentRequests.length,1);
    await publish();await text('Corrected synthetic task');equal('editing does not wake Agent',agentRequests.length,1);button('请求代理').click();await wait(()=>notice().includes('请求已提交'),'explicit retry accepted');equal('exactly one explicit retry',agentRequests.length,2);equal('second request carries corrected text',agentRequests[1].text,'Corrected synthetic task');equal('accepted request stays locked',button('请求代理').disabled,true);
    return {requests:[...agentRequests],notice:notice()};
  }
  async function unknownTimeout(){
    show('3b · Lost response retains original request and blocks resubmission');await mount(false,'timeout');await publish();await text('Uncertain synthetic task');const start=performance.now();button('请求代理').click();await wait(()=>agentRequests.length===1,'Agent request dispatched');
    await wait(()=>notice().includes('勿重复提交'),'real 30-second client timeout',35000);
    equal('unknown timeout keeps task locked',documentForFrame().querySelector('input')!.disabled,true);equal('unknown timeout keeps submit locked',button('请求代理').disabled,true);button('请求代理').click();await new Promise(resolve=>setTimeout(resolve,50));equal('unknown timeout is never resubmitted',agentRequests.length,1);
    return {elapsedMs:Math.round(performance.now()-start),requests:[...agentRequests],notice:notice()};
  }
  fixtureWindow.__SDK_BROWSER__={initialEvent,initialRefresh,bindingPages,rejectedAction,unknownTimeout,result:()=>({assertions,errors,frameErrors,syntheticOnly:true,bridge:'Real postMessage between same-origin parent and iframe',runtime:'Production useApps, AppsAgentActions, createAppsClient and ComponentHost'})};
}
