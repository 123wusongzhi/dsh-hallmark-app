import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppsNativeView} from '../../../packages/plugin-apps/client/view.tsx';

// W6 acceptance mounts the production parent gate, not just AppsSourceFrame.
const state={events:[] as unknown[],problems:[] as unknown[],reports:[] as unknown[],messages:[] as unknown[]};
(window as any).__displayAcceptance=state;
window.addEventListener('apps-display-ready',event=>state.events.push((event as CustomEvent).detail));
window.addEventListener('apps-display-failed',event=>state.problems.push((event as CustomEvent).detail));
window.addEventListener('message',event=>{if(event.data?.feature==='renderReadyV1')state.messages.push({type:'iframe-ready-request',identity:{buildId:event.data.buildId,frameInstanceId:event.data.frameInstanceId},checks:event.data.params?.checks,domRows:document.querySelector('iframe')?.contentDocument?.querySelectorAll('[data-product-id]').length});});
async function start(){
  const config=await (await fetch('/config')).json(),visibility=new AbortController();
  function Parent(){
    const [active,setActive]=useState(true),[switched,setSwitched]=useState(false);
    (window as any).__nativeControl={visible:setActive,switchSession:()=>{visibility.abort();setSwitched(true);}};
    return <AppsNativeView sessionId={switched?'other-offline-session':config.identity.sessionId} viewId={config.identity.viewId} expectedBuildId={config.identity.buildId} expectedPublicationId={config.publication.publicationId} expectedDisplayId={config.publication.displayId} active={active&&!switched} visibilitySignal={visibility.signal} isCurrentOwner={()=>!switched}/>;
  }
  createRoot(document.getElementById('root')!).render(<Parent/>);
}
void start().catch(error=>state.problems.push({code:'ACCEPTANCE_PARENT_FAILED',message:String(error)}));
