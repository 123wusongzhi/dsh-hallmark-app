import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppsSourceFrame} from '../../../packages/dsh-plugin/client/component-frame.tsx';
import {createAppsPresentationHandlers} from '../../../packages/plugin-apps/client/component-handlers.ts';

// Real production parent bridge, not an iframe onLoad -> ready shortcut.
const state={events:[] as unknown[],problems:[] as unknown[],reports:[] as unknown[],messages:[] as unknown[]};
(window as any).__displayAcceptance=state;
window.addEventListener('apps-display-ready',event=>state.events.push((event as CustomEvent).detail));
window.addEventListener('message',event=>{if(event.data?.feature==='renderReadyV1')state.messages.push({type:'iframe-ready-request',identity:{buildId:event.data.buildId,frameInstanceId:event.data.frameInstanceId},checks:event.data.params?.checks,domRows:document.querySelector('iframe')?.contentDocument?.querySelectorAll('[data-product-id]').length});});
async function start(){
  const config=await (await fetch('/config')).json(),controller=new AbortController();
  const report=(problem:unknown)=>{state.problems.push(problem);void fetch('/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'authoring',operation:'reportDisplayError',sessionId:config.identity.sessionId,params:{viewId:config.identity.viewId,publicationId:config.publication.publicationId,buildId:config.identity.buildId,displayId:config.publication.displayId,displayGeneration:config.publication.displayGeneration,error:problem}})}).then(async response=>state.reports.push({status:response.status,body:await response.json()}));};
  const handlers=await createAppsPresentationHandlers(config.identity,controller.signal,config.publication,true,report);
  function Parent(){const [active,setActive]=useState(!config.hiddenInitially);(window as any).__setDisplayVisible=setActive;return <AppsSourceFrame {...config.identity} title="Offline captured record display" url="/frame/index.html" data={null} handlers={handlers} onFrameError={report} active={active}/>;}
  createRoot(document.getElementById('root')!).render(<Parent/>);
}
void start().catch(error=>{state.problems.push({code:'ACCEPTANCE_PARENT_FAILED',message:String(error)});});
