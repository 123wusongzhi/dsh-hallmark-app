// Actual production React surfaces, isolated synthetic responses. No desktop, user session or business access.
import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppsWorkspace} from '../../packages/plugin-apps/client/workspace.tsx';
import {SessionComponentsPane} from '../../packages/dsh-plugin/client/sidebar.tsx';
import type {AppsComponent,AppsView} from '../../packages/app-presentation/src/types.ts';
import type {SidebarNavigationParams} from '../../packages/dsh-plugin/client/sidebar-contract.ts';

const errors:string[]=[],checks:string[]=[],requests:{resource?:string;body?:any}[]=[],returns:string[]=[];
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const createdAt='2026-10-07T02:15:00Z',updatedAt='2026-10-07T02:30:00Z';
const design={layout:{type:'column',children:['copy']},widgets:[{id:'copy',type:'text',title:'隔离组件内容',text:'这是实际组件渲染器展示的合成说明。此预览不包含真实商品或经营指标。'}]};
const makeView=(id:string,title:string,ownerSessionId:string|null='A'):AppsView=>({viewId:id,title,ownerSessionId,design,bindings:[],createdAt,updatedAt,viewRevision:1,validationStatus:'legacy_unverified'});
let views=[makeView('view-a-one','商品明细 · 合成验证'),makeView('view-a-two','采集资料 · 合成验证'),makeView('view-b-one','另一会话组件 · 合成验证','B')];
let components:AppsComponent[]=[{componentId:'component-one',revision:2,title:'商品明细 · 合成验证',view:makeView('saved-one','商品明细 · 合成验证',null),userRequest:'fixture explicit save',savedAt:updatedAt,revisions:[{revision:1,title:'商品列表 · 合成验证',savedAt:createdAt},{revision:2,title:'商品明细 · 合成验证',savedAt:updatedAt}]},{componentId:'component-two',revision:1,title:'采集资料 · 合成验证',view:makeView('saved-two','采集资料 · 合成验证',null),userRequest:'fixture explicit save',savedAt:createdAt,revisions:[{revision:1,title:'采集资料 · 合成验证',savedAt:createdAt}]}];
let providerState='ready',savedState:'populated'|'empty'|'failed'='populated';
let bindings=[{sessionId:'A',appId:'hallmark',connectionId:'bill-fixture',enabled:true}],serial=0,connectionRevision=0;
let switchSession:(id:string)=>void,switchMode:(mode:'apps'|'side')=>void,switchSidebarWidth:(width:number)=>void,navigate:(params:SidebarNavigationParams)=>void;
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
globalThis.fetch=(async(input:unknown,options?:RequestInit)=>{
  const url=new URL(String(input),'http://isolated.fixture'),resource=url.searchParams.get('resource')??'',body=options?.body?JSON.parse(String(options.body)):undefined;
  requests.push({resource,body});
  if(url.pathname==='/api/hallmark-app'){
    if(options?.method!=='GET')throw Error('Sidebar fixture denies mutations');
    if(resource==='sessionViews')return json({sessionId:url.searchParams.get('sessionId'),views:views.filter(view=>view.ownerSessionId===url.searchParams.get('sessionId')).map(view=>({viewId:view.viewId,title:view.title,createdAt:view.createdAt,updatedAt:view.updatedAt,state:'ready'}))});
    const view=views.find(view=>view.viewId===url.searchParams.get('viewId')&&view.ownerSessionId===url.searchParams.get('sessionId'));if(!view)throw Error('Owned fixture view not found');
    if(resource==='sessionView')return json({...design,id:view.viewId,title:view.title,bindings:[]});
    if(resource==='sessionViewData')return json({status:'ok',data:{viewId:view.viewId,bindings:[],missing:[]}});
    throw Error('Unexpected legacy fixture read '+resource);
  }
  if(url.pathname!=='/api/dsh-apps')throw Error('No network allowed outside isolated UI fixture');
  if(body){
    if(body.action==='bind'){bindings=bindings.filter(item=>!(item.sessionId===body.sessionId&&item.appId===body.appId&&item.connectionId===body.connectionId));bindings.push({sessionId:body.sessionId,appId:body.appId,connectionId:body.connectionId,enabled:body.enabled});connectionRevision++;return json({status:'ok'});}
    if(body.action==='authoring'&&body.operation==='closeDraft')return json({closed:true});
    const capability=body.capabilityId;
    if(capability==='apps.presentation.manage_saved'){
      const input=body.input,component=components.find(item=>item.componentId===input.id);if(!component||component.revision!==input.expectedRevision)return json({status:'failed',error:{message:'COMPONENT_CONFLICT'}});
      if(input.action==='rename')components=components.map(item=>item===component?{...item,title:input.name,revision:item.revision+1}:item);else components=components.filter(item=>item!==component);return json({status:'ok',data:{}});
    }
    if(capability==='apps.presentation.open_component'){
      const component=components.find(item=>item.componentId===body.input.componentId)!;
      const opened={...makeView('opened-'+(++serial),component.title,body.sessionId),sourceComponentId:component.componentId,baseRevision:component.revision,baseRevisionAtOpen:component.revision,selectedSourceRevision:body.input.revision??component.revision};views.push(opened);return json({status:'ok',data:opened});
    }
    if(capability==='apps.authoring.begin'){
      const view=makeView('new-'+(++serial),'新组件',body.sessionId);views.push(view);return json({status:'ok',data:{view,draft:{workspacePath:'C:/private/fixture-workspace'},attempt:{attemptId:'private-attempt',epoch:1}}});
    }
    throw Error('Unexpected fixture action '+capability);
  }
  if(resource==='apps')return json({apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:providerState,hostProjectionState:'attached'},{appId:'notes',displayName:'Notes',runtimeState:'ready',hostProjectionState:'attached'},{appId:'apps',displayName:'Shared presentation',runtimeState:'ready',hostProjectionState:'attached'}]});
  if(resource==='connections')return json([{appId:'hallmark',connectionId:'bill-fixture',displayName:'Bill · 隔离连接示意',enabled:true},{appId:'notes',connectionId:'notes-fixture',displayName:'本机笔记 · 隔离连接示意',enabled:true},{appId:'apps',connectionId:'presentation',displayName:'Shared presentation',enabled:true}]);
  if(resource==='bindings')return json(bindings.filter(item=>item.sessionId===url.searchParams.get('sessionId')));
  if(resource==='diagnostics')return json({invocations:[{invocationId:'private-invocation-A',traceId:'private-trace-A',operationId:null,runId:null,appId:'hallmark',connectionId:'bill-fixture',capabilityId:'hallmark.stores.list',capabilityVersion:'1.0.0',status:'ok',durationMs:120}]});
  if(resource==='saved'){if(savedState==='failed')throw Error('组件库连接暂时不可用 · 合成失败场景');return json({components:savedState==='empty'?[]:components,assets:[]});}
  if(resource==='views')return json({views:views.filter(view=>view.ownerSessionId===url.searchParams.get('sessionId'))});
  const view=views.find(view=>view.viewId===url.searchParams.get('viewId')&&view.ownerSessionId===url.searchParams.get('sessionId'));
  if(resource==='view'&&view)return json(view);
  if(resource==='viewData'&&view)return json({viewId:view.viewId,bindings:[]});
  throw Error('Unexpected fixture read '+resource);
}) as typeof fetch;

function Fixture(){
  const [sessionId,setSessionId]=useState('A'),[mode,setMode]=useState<'apps'|'side'>('apps'),[sidebarWidth,setSidebarWidth]=useState(420),[navigation,setNavigation]=useState({params:{} as SidebarNavigationParams,revision:0});
  switchSession=setSessionId;switchMode=setMode;switchSidebarWidth=setSidebarWidth;navigate=params=>setNavigation(before=>({params,revision:before.revision+1}));
  const signal=useMemo(()=>new AbortController().signal,[]);
  const useTabInfo=()=>({tab:{navigation,signal,visible:true,actions:{openTab:(_kind:string,options?:{params?:SidebarNavigationParams})=>navigate(options?.params??{})}}});
  return <><div className="fixture-disclosure">真实生产 React 界面 · 隔离合成数据 · 非 DSH 桌面验收 · 不连接店铺，不调用模型</div><div id="fixture-content" className={mode==='side'?'is-sidebar':''} style={mode==='side'?{width:sidebarWidth}:undefined}>{mode==='apps'?<AppsWorkspace currentSessionId={sessionId} onReturn={id=>returns.push(id)}/>:<SessionComponentsPane sessionId={sessionId} useTabInfo={useTabInfo}/>}</div></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
const delay=(ms=25)=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(predicate:()=>unknown,label:string){for(let i=0;i<150;i++){if(predicate())return;await delay();}throw Error('Timed out: '+label);}
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);checks.push(label);};
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent?.trim()===text&&!node.closest('[hidden]'));
function input(label:string,value:string){const element=document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));}
const mutations=()=>requests.filter(request=>request.body);
(window as any).__APPS_VISUAL__={
  async initial(){await wait(()=>document.querySelectorAll('.apps-library-card').length===2,'library');check(document.querySelectorAll('.apps-app-row').length===2&&!document.querySelector('.apps-app-list')?.textContent?.includes('Shared presentation'),'internal presentation service is absent from the business application list');check(document.querySelector('.apps-brand h2')?.textContent==='Hallmark'&&document.querySelector('.apps-connection-status')?.textContent?.includes('当前聊天已启用'),'default Hallmark focus and exact chat binding status');check(!document.querySelector<HTMLElement>('.apps-main')?.innerText.includes('private-invocation-A')&&!document.querySelector<HTMLElement>('.apps-main')?.innerText.includes('固定发现网关'),'technical identifiers and call ledger are collapsed by default');check(mutations().length===0,'opening the business workbench only reads existing configuration');},
  async interactions(){
    input('搜索应用','Notes');await wait(()=>document.querySelectorAll('.apps-app-row').length===1,'app search');document.querySelector<HTMLButtonElement>('.apps-app-row')!.click();await wait(()=>document.querySelector('.apps-brand h2')?.textContent==='Notes','focus');check(mutations().length===0&&document.querySelector('.apps-connection-status')?.textContent?.includes('尚未在当前聊天启用'),'search/focus is local and cannot implicitly enable another app');
    input('搜索应用','');await wait(()=>document.querySelectorAll('.apps-app-row').length===2,'all apps');document.querySelector<HTMLButtonElement>('.apps-app-row')!.click();await delay();document.querySelector<HTMLButtonElement>('.apps-manage-button')!.click();await wait(()=>document.querySelector('[aria-label="连接设置"]'),'connection settings');button('在此会话停用')!.click();await wait(()=>connectionRevision===1&&document.querySelector('.apps-connection-status')?.textContent?.includes('尚未在当前聊天启用'),'binding off');check(mutations()[0].body.sessionId==='A'&&mutations()[0].body.connectionId==='bill-fixture'&&mutations()[0].body.enabled===false,'explicit connection switch uses the unchanged original chat and connection identity');button('在此会话启用')!.click();await wait(()=>connectionRevision===2,'binding on');button('收起设置')!.click();
    input('搜索组件库','找不到的组件');await wait(()=>document.querySelector('.apps-empty h3')?.textContent==='没有匹配的组件','library search');check(document.querySelectorAll('.apps-library-card').length===0,'library search presents a real no-result state');button('清空搜索')!.click();await wait(()=>document.querySelectorAll('.apps-library-card').length===2,'clear library search');
    const first=document.querySelector<HTMLElement>('.apps-library-card')!;first.querySelector<HTMLDetailsElement>('.apps-card-management')!.open=true;button('重命名')!.click();await wait(()=>document.querySelector('[aria-label="组件新名称"]'),'rename');input('组件新名称','明确改名 · 合成验证');button('保存名称')!.click();await wait(()=>document.querySelector('.apps-card-title')?.textContent==='明确改名 · 合成验证','rename applied');const rename=mutations().find(request=>request.body.input?.action==='rename')!.body;check(rename.input.expectedRevision===2&&rename.sessionId==='A','explicit rename keeps existing revision CAS and shared library ownership');
    document.querySelector<HTMLDetailsElement>('.apps-card-history')!.open=true;button('打开此版本')!.click();await wait(()=>document.querySelector('.apps-component h3')?.textContent==='明确改名 · 合成验证','open history');const opened=mutations().find(request=>request.body.capabilityId==='apps.presentation.open_component')!.body;check(opened.input.revision===1&&opened.sessionId==='A','opening a historical design pins the requested source revision in the current chat');check(button('保存到组件库')?.disabled===true,'unverified view does not gain an active save button');check(document.querySelector('.apps-component-times')?.textContent?.includes('源数据时间：暂无时间证据'),'missing business source time is explicit rather than invented');
    const beforeHide=mutations().length;document.querySelector<HTMLButtonElement>('[aria-label="关闭明确改名 · 合成验证"]')!.click();await wait(()=>button('只隐藏展示视图'),'close choice');button('只隐藏展示视图')!.click();await delay();check(mutations().length===beforeHide&&!document.querySelector('.apps-component'),'hide remains local and cannot remove the library item or draft');check(document.querySelectorAll('.apps-local-tab').length===2,'other original chat views stay open');
    button('新建组件工作副本')!.click();await wait(()=>document.querySelector('.apps-component h3')?.textContent==='新组件','new draft');check(!document.querySelector<HTMLElement>('.apps-main')?.innerText.includes('C:/private')&&!document.querySelector<HTMLElement>('.apps-main')?.innerText.includes('private-attempt'),'normal draft success text hides workspace paths and attempt IDs');check(!mutations().some(request=>request.body.capabilityId==='apps.authoring.save_component'),'new/view/edit actions never imply save');
    document.querySelector<HTMLButtonElement>('[aria-label="关闭新组件"]')!.click();await wait(()=>button('关闭并保留'),'close draft');button('关闭并保留')!.click();await wait(()=>!document.querySelector('.apps-component'),'close kept');check(mutations().at(-1)!.body.operation==='closeDraft'&&mutations().at(-1)!.body.params.action==='keep','explicit close/keep still reaches the existing authoring endpoint');
    button('返回当前聊天')!.click();check(returns.length===1&&returns[0]==='A','return action targets the same original chat and creates no separate chat tab');
    switchSession('B');await wait(()=>document.querySelector('.apps-local-tab')?.textContent?.includes('另一会话组件'),'switch B');check(!document.querySelector('.apps-local-tabs')?.textContent?.includes('商品明细')&&!document.querySelector('.apps-local-tabs')?.textContent?.includes('采集资料'),'work views remain isolated when the actual current session changes');switchSession('A');await wait(()=>document.querySelector('.apps-local-tab')?.textContent?.includes('商品明细'),'restore A');
    check(!mutations().some(request=>['requestAgent','componentBridge'].includes(request.body.action)),'all visual interactions leave model and business submission interfaces untouched');
  },
  async sidebar(width:number){switchMode('side');switchSidebarWidth(width);navigate({});await wait(()=>document.querySelectorAll('.hm-chat-component-card').length>=2,'sidebar list');await delay(90);const pane=document.querySelector<HTMLElement>('.hm-session-components')!;check(pane.scrollWidth<=pane.clientWidth,'sidebar '+width+'px contains no horizontal overflow');return {width:pane.clientWidth,overflow:pane.scrollWidth>pane.clientWidth};},
  async states(state:'empty'|'failed'|'stopped'|'ready'){
    providerState=state==='stopped'?'stopped':'ready';savedState=state==='empty'?'empty':state==='failed'?'failed':'populated';button('刷新列表')!.click();
    if(state==='empty'){await wait(()=>document.querySelector('.apps-empty h3')?.textContent==='还没有保存的组件','empty state');check(document.querySelector('.apps-count')?.textContent==='0','successfully read empty library shows a real zero count');}
    else if(state==='failed'){await wait(()=>document.querySelector('.apps-empty h3')?.textContent==='组件库暂时无法读取','failure state');check(document.querySelector('.apps-count')?.textContent==='—','failed library read is not presented as a confirmed empty result');}
    else if(state==='stopped'){await wait(()=>document.querySelector('.apps-connection-status')?.textContent==='应用暂不可用','provider stopped');check(!document.querySelector('.apps-connection-status')?.classList.contains('is-enabled'),'stopped provider does not claim a green enabled connection');}
    else await wait(()=>document.querySelectorAll('.apps-library-card').length===2&&document.querySelector('.apps-connection-status')?.textContent==='当前聊天已启用','restored state');
  },
  async apps(){switchMode('apps');await wait(()=>document.querySelectorAll('.apps-library-card').length===2,'apps view');await delay(100);},
  result(){check(errors.length===0,'actual production surfaces produce no browser exceptions');return {ok:true,fixtureOnly:true,installedDshGuiCovered:false,source:'production React components with isolated synthetic API responses',assertions:checks,errors,mutations:mutations().length,businessCalls:0,modelCalls:0};},
};
