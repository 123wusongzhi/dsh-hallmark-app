import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';

// The extracted plugin supplies the entire parent; this harness supplies only its public Host faces.
const state={events:[] as unknown[],problems:[] as unknown[],reports:[] as unknown[],messages:[] as unknown[],packageRegistration:[] as unknown[]};
(window as any).__displayAcceptance=state;
window.addEventListener('apps-display-ready',event=>state.events.push((event as CustomEvent).detail));
window.addEventListener('apps-display-failed',event=>state.problems.push((event as CustomEvent).detail));
window.addEventListener('message',event=>{if(event.data?.feature==='renderReadyV1')state.messages.push({type:'iframe-ready-request',identity:{buildId:event.data.buildId,frameInstanceId:event.data.frameInstanceId},checks:event.data.params?.checks,domRows:document.querySelector('iframe')?.contentDocument?.querySelectorAll('[data-product-id]').length});});
async function start(){
  const config=await (await fetch('/config')).json(),visibility=new AbortController(),modules:Record<string,unknown>={react:React,'react/jsx-runtime':jsxRuntime,'react-dom':ReactDOM,'react-dom/client':ReactDOMClient};
  let plugin:any;
  (window as any).__ModuleLoader__={load:({id,factory}:{id:string;factory:(require:(name:string)=>unknown)=>any})=>{if(id!=='dsh-plugin-apps-bundle'||plugin)throw Error('Unexpected packed plugin registration');plugin=factory(name=>{if(!(name in modules))throw Error('Unexpected package external '+name);return modules[name];}).default;}};
  await new Promise<void>((done,reject)=>{const script=document.createElement('script');script.src='/packed-client.js';script.onload=()=>done();script.onerror=()=>reject(Error('Packed client did not load'));document.head.append(script);});
  if(typeof plugin?.apply!=='function')throw Error('Packed plugin has no apply');
  const registrations=new Map<string,React.ComponentType<any>>(),sidebar={mounted:{getSnapshot:()=>config.identity.sessionId,subscribe:()=>()=>{}},openTab:()=>{throw Error('Unexpected acceptance navigation');}};
  const services:Record<string,unknown>={sidebarRight:sidebar,sidebarRightTabs:{register:(definition:unknown)=>{state.packageRegistration.push({kind:'sidebar-definition',definition});return()=>{};}}};
  plugin.apply({get:(name:string)=>services[name],slots:{inject:(name:string,effect:()=>unknown)=>{if(name==='sidebar.right.pane.tab')effect();},register:(options:{name:string;key?:string},component:React.ComponentType<any>)=>{registrations.set(options.name+':'+options.key,component);state.packageRegistration.push({kind:'slot',...options});return()=>{};}}});
  const Pane=registrations.get('sidebar.right.pane.tab:dsh-plugin-hallmark/session-components');if(!Pane)throw Error('Packed Apps sidebar pane missing');
  const info={tab:{navigation:{params:{viewId:config.identity.viewId,publicationId:config.publication.publicationId,displayId:config.publication.displayId},revision:1},signal:visibility.signal,visible:true,actions:{openTab:sidebar.openTab}}};
  ReactDOMClient.createRoot(document.getElementById('root')!).render(<Pane sessionId={config.identity.sessionId} useTabInfo={()=>info}/>);
}
void start().catch(error=>state.problems.push({code:'ACCEPTANCE_PACKED_PARENT_FAILED',message:String(error)}));
