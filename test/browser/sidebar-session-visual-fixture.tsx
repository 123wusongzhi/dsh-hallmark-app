import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppsSidebarPane} from '../../packages/plugin-apps/client/sidebar.tsx';
import type {AppsView} from '../../packages/app-presentation/src/types.ts';
import type {NativeSidebarRight} from '../../packages/dsh-plugin/client/sidebar-contract.ts';

// Synthetic directory metadata only. Every request is intercepted; no user Host or shop is contacted.
const checks:string[]=[],errors:string[]=[],requests:{resource?:string;action?:string;operation?:string;capabilityId?:string;sessionId?:string;componentId?:string;favorite?:boolean}[]=[];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const originalSession='sidebar-visual-A',otherSession='sidebar-visual-B';
const view=(sessionId:string,viewId:string,title:string,options:Partial<AppsView>={}):AppsView=>({viewId,ownerSessionId:sessionId,title,design:{kind:'source'},bindings:[],createdAt:'2026-10-09T10:00:00Z',updatedAt:'2026-10-09T10:00:00Z',panelState:'open',viewRevision:1,validationStatus:'verified',...options});
const viewsA=[
  view(originalSession,'current','店铺经营一览',{validationStatus:'draft_unpublished',updatedAt:'2026-10-09T12:00:00Z'}),
  view(originalSession,'procurement','商品-采购对照表',{sourceComponentId:'saved-procurement',baseRevision:2}),
  view(originalSession,'collection','采集箱 · 渠道商品与 SKU 采购价',{sourceComponentId:'saved-collection',baseRevision:1}),
],viewsB=[view(otherSession,'other-private','另一会话的组件',{validationStatus:'draft_unpublished'})];
type Favorite={componentId:string;appId:string;title:string;revision:number;hasPreview?:boolean;createdAt:string;available:boolean};
const saved:Record<string,Favorite>={
  'saved-procurement':{componentId:'saved-procurement',appId:'hallmark',title:'商品-采购对照表',revision:2,createdAt:'2026-10-09T10:00:00Z',available:true},
  'saved-collection':{componentId:'saved-collection',appId:'hallmark',title:'采集箱 · 渠道商品与 SKU 采购价',revision:1,createdAt:'2026-10-09T10:00:00Z',available:true},
};
let favorites=[saved['saved-collection']],holdFavorite=false,holdViewData=false,releaseFavorite:(()=>void)|undefined;
globalThis.fetch=(async(input,options)=>{
  const url=new URL(String(input),'http://isolated-sidebar-fixture'),resource=url.searchParams.get('resource')??undefined,body=options?.body?JSON.parse(String(options.body)):undefined,sessionId=body?.sessionId??url.searchParams.get('sessionId')??undefined;
  requests.push({resource,action:body?.action,operation:body?.operation,capabilityId:body?.capabilityId,sessionId,componentId:body?.componentId,favorite:body?.favorite});
  if(resource==='views')return Response.json({views:sessionId===originalSession?viewsA:viewsB});
  if(resource==='favorites')return Response.json({sessionId,favorites:sessionId===originalSession?favorites:[]});
  if(resource==='view'){
    const current=(sessionId===originalSession?viewsA:viewsB).find(item=>item.viewId===url.searchParams.get('viewId'));
    if(!current)throw Error('Unknown isolated view');return Response.json(current);
  }
  if(resource==='viewData'){if(holdViewData)await new Promise<void>(()=>{});return Response.json({viewId:url.searchParams.get('viewId'),bindings:[]});}
  if(resource==='workbench')return Response.json({kind:'workbench',workbenchId:'hallmark',appId:'hallmark',revision:1,context:{},instances:[],savedComponents:[],updatedAt:'2026-10-09T12:00:00Z'});
  if(body?.action==='presentation'&&body.capabilityId==='apps.authoring.save_component'){
    const current=(sessionId===originalSession?viewsA:viewsB).find(item=>item.viewId===body.input.viewId);
    if(!current?.sourceComponentId)throw Error('Only the explicitly selected saved fixture component may be saved');
    return Response.json({status:'ok',data:{componentId:current.sourceComponentId,revision:current.baseRevision,title:current.title,view:current,userRequest:body.input.userRequest,savedAt:'2026-10-09T12:00:00Z'}});
  }
  if(body?.action==='presentation'&&body.capabilityId==='apps.presentation.open_component'){
    const current=(sessionId===originalSession?viewsA:viewsB).find(item=>item.sourceComponentId===body.input.componentId);
    if(!current)throw Error('Only an existing isolated favorite may be opened');return Response.json({status:'ok',data:current});
  }
  if(body?.action==='favorite'){
    if(body.favorite)favorites=[...favorites.filter(item=>item.componentId!==body.componentId),saved[body.componentId]];
    else favorites=favorites.filter(item=>item.componentId!==body.componentId);
    const value={sessionId,favorites:[...favorites]};
    if(holdFavorite){holdFavorite=false;await new Promise<void>(resolve=>{releaseFavorite=resolve;});}
    return Response.json(value);
  }
  throw Error('Unexpected isolated sidebar request: '+JSON.stringify({resource,action:body?.action,operation:body?.operation}));
}) as typeof fetch;

let owner=originalSession,changeSession:(sessionId:string)=>void=()=>{},showSidebar:(visible:boolean)=>void=()=>{},navigateSidebar:(viewId?:string)=>void=()=>{};
const ownerListeners=new Set<()=>void>(),controller=new AbortController();
const sidebar:NativeSidebarRight={mounted:{getSnapshot:()=>owner,subscribe:listener=>{ownerListeners.add(listener);return()=>ownerListeners.delete(listener);}},openTab(){throw Error('The fixture expects local component tabs, not a native duplicate.');}};
function Shell(){const [sessionId,setSessionId]=useState(originalSession),[visible,setVisible]=useState(true),[navigation,setNavigation]=useState<{params:{viewId?:string};revision:number}>({params:{},revision:1});changeSession=next=>{owner=next;for(const listener of ownerListeners)listener();setSessionId(next);};showSidebar=setVisible;navigateSidebar=viewId=>setNavigation(previous=>({params:viewId?{viewId}:{},revision:previous.revision+1}));return <AppsSidebarPane sessionId={sessionId} sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible,actions:{openTab:sidebar.openTab}}})}/>;}
const style=document.createElement('style');style.textContent='html,body,#root{margin:0;width:100%;height:100%;min-width:0}body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#fff}#sidebar-session-result{display:none}';document.head.append(style);
createRoot(document.getElementById('root')!).render(<Shell/>);
const pause=(ms=25)=>new Promise(resolve=>setTimeout(resolve,ms));
function check(condition:unknown,label:string){if(!condition)throw Error(label);checks.push(label);}
async function until(predicate:()=>unknown,label:string){for(let i=0;i<150&&!predicate();i++)await pause();check(predicate(),label);await pause();}
const buttons=()=>[...document.querySelectorAll<HTMLButtonElement>('button')];
const tab=(name:string)=>buttons().find(button=>button.getAttribute('role')==='tab'&&button.querySelector('span:last-child')?.textContent?.trim()===name);
const named=(name:string)=>buttons().find(button=>button.getAttribute('aria-label')===name);
const visibleText=()=>document.querySelector('[role="tabpanel"]')?.textContent??'';
const dataReads=()=>requests.filter(row=>row.resource==='viewData'||row.action==='refreshView').length;
async function click(button:HTMLButtonElement|undefined,label:string){check(button&&!button.disabled,label);button!.click();await pause();}

async function run(){
  await until(()=>document.querySelector('.apps-hub-feature'),'session hub presents the current draft');
  check(!!tab('本次会话')&&!!tab('我的收藏'),'two fixed entry tabs are always available');
  check(document.querySelectorAll('[role="tab"]').length===2,'entry starts with exactly two tabs');
  check(/正在.*打磨/.test(visibleText())&&visibleText().includes('请稍候'),'editing status uses the gentle waiting copy');
  check(document.querySelectorAll('iframe').length===0&&dataReads()===0,'session entry mounts no iframe and reads zero component data');
  check(requests.every(row=>!row.action),'opening the directory makes no mutation');
  await click(named('打开商品-采购对照表'),'ready temporary component has a clear open action');
  await until(()=>tab('商品-采购对照表'),'opening creates an independent component tab');
  await until(()=>dataReads()>0,'detail data is loaded only after the user opens it');
  const close=named('关闭 商品-采购对照表'),closeRect=close?.getBoundingClientRect();
  check(closeRect&&closeRect.width>=32&&closeRect.height>=32,'component close target is at least 32 × 32 px');
  await click(tab('本次会话'),'the main entry remains reachable');
  await click(named('打开商品-采购对照表'),'the same temporary component can be selected again');
  check(document.querySelectorAll('[role="tab"]').length===3,'repeated opening reuses the existing detail tab');
  await click(named('关闭 商品-采购对照表'),'the detail tab can be closed');
  await until(()=>named('打开商品-采购对照表'),'closing the tab keeps the temporary component in the session list');
  check(!requests.some(row=>row.operation==='closeView'),'closing a local tab does not close or delete the work copy');
  navigateSidebar('procurement');await until(()=>tab('商品-采购对照表')?.getAttribute('aria-selected')==='true','an explicit native navigation opens its component');
  await click(named('关闭 商品-采购对照表'),'close the component originally selected by native navigation');
  await until(()=>tab('本次会话')?.getAttribute('aria-selected')==='true','closing a native-selected detail returns to the session entry');
  const readsBeforeVisibility=dataReads();showSidebar(false);await until(()=>!document.querySelector('.apps-sidebar-shell'),'hidden native pane unmounts its visible shell');
  showSidebar(true);await until(()=>!!document.querySelector('.apps-session-hub'),'showing the pane keeps the selected session entry');
  check(document.querySelectorAll('[role="tab"]').length===2&&dataReads()===readsBeforeVisibility,'hide and show does not reopen a closed native-selected detail or read its data');
  navigateSidebar();await pause();
  await click(named('打开采集箱 · 渠道商品与 SKU 采购价'),'a long-title temporary component can be opened');
  await until(()=>tab('采集箱 · 渠道商品与 SKU 采购价'),'the long-title detail has its own tab');
  await click(tab('本次会话'),'return to the directory with a long-title tab still open');
  await click(named('打开商品-采购对照表'),'open a second detail beside the long-title tab');
  await until(()=>document.querySelectorAll('[role="tab"]').length===4,'two detail tabs coexist with the two fixed entry tabs');
  await pause(100);
  const activeClose=named('关闭 商品-采购对照表')!.getBoundingClientRect(),tabStrip=document.querySelector('.apps-sidebar-tabs')!.getBoundingClientRect();
  check(activeClose.left>=tabStrip.left-1&&activeClose.right<=tabStrip.right+1,'active component close button stays visible even with several long tabs');
  check(['本次会话','我的收藏'].every(name=>{const button=tab(name)!,rect=button.getBoundingClientRect(),label=button.querySelector<HTMLElement>('span:last-child')!;return rect.left>=tabStrip.left-1&&rect.right<=tabStrip.right+1&&label.scrollWidth<=label.clientWidth+1;}),'both fixed entry labels remain fully visible beside long detail tabs');
  await click(named('关闭 商品-采购对照表'),'close the active detail in a crowded tab strip');
  await click(named('关闭 采集箱 · 渠道商品与 SKU 采购价'),'close the other detail independently');
  await until(()=>named('打开商品-采购对照表'),'closing all detail tabs returns to the temporary directory');
  await click(named('收藏商品-采购对照表'),'a ready component can be explicitly favorited');
  await until(()=>named('取消收藏商品-采购对照表'),'favorite confirmation updates the star');
  check(requests.filter(row=>row.action==='favorite'&&row.componentId==='saved-procurement'&&row.favorite===true).length===1,'one explicit favorite click produces one favorite mutation');
  const readsBeforeFavorites=dataReads();
  await click(tab('我的收藏'),'favorites has its own fixed tab');
  await until(()=>document.querySelector('.apps-favorites-hub')&&visibleText().includes('商品-采购对照表'),'favorite components appear in their dedicated list');
  check(!visibleText().includes('店铺经营一览'),'unfavorited temporary draft is absent from favorites');
  check(document.querySelectorAll('iframe').length===0&&dataReads()===readsBeforeFavorites,'favorites entry mounts no iframe and requests no component data');
  showSidebar(false);await until(()=>!document.querySelector('.apps-sidebar-shell'),'favorites pane can be hidden');
  showSidebar(true);await until(()=>tab('我的收藏')?.getAttribute('aria-selected')==='true'&&document.querySelector('.apps-favorites-hub'),'showing the pane preserves the selected favorites entry');
  check(document.querySelectorAll('iframe').length===0&&dataReads()===readsBeforeFavorites,'restoring favorites never mounts an iframe or reads component data');
  await click(named('打开收藏组件商品-采购对照表'),'a saved favorite has an explicit open action');
  await until(()=>tab('商品-采购对照表'),'opening a favorite creates a detail tab');
  await click(tab('我的收藏'),'favorite directory remains available after opening');
  await click(named('打开收藏组件商品-采购对照表'),'the same favorite can be opened again');
  await until(()=>tab('商品-采购对照表')?.getAttribute('aria-selected')==='true','reopening a favorite selects its existing detail');
  check(document.querySelectorAll('[role="tab"]').length===3,'reopening a favorite never duplicates its component tab');
  await click(named('关闭 商品-采购对照表'),'a favorite detail tab can be closed independently');
  await click(tab('我的收藏'),'favorite directory survives closing its detail');
  await click(named('取消收藏商品-采购对照表'),'a favorite can be removed explicitly');
  await until(()=>!visibleText().includes('商品-采购对照表'),'removed favorite disappears from the favorites list');
  await click(tab('本次会话'),'return to temporary components after removing a favorite');
  check(!!named('打开商品-采购对照表'),'removing a favorite preserves its temporary component');

  // An in-flight response for the old chat must not create content/tabs in the new chat.
  holdFavorite=true;await click(named('收藏商品-采购对照表'),'start an isolated delayed favorite action');
  await until(()=>!!releaseFavorite,'the old chat action is genuinely in flight');
  changeSession(otherSession);await until(()=>visibleText().includes('另一会话的组件'),'switching chat renders only the new session directory');
  releaseFavorite!();await pause(70);
  check(!visibleText().includes('商品-采购对照表')&&document.querySelectorAll('[role="tab"]').length===2,'late old-session completion cannot create tabs or content in the new session');
  changeSession(originalSession);await until(()=>!!document.querySelector('.apps-hub-feature')&&visibleText().includes('店铺经营一览'),'returning to the first chat restores its temporary directory');
  if(new URL(location.href).searchParams.get('screen')==='favorites'){
    await click(tab('我的收藏'),'capture the favorites directory');
    await until(()=>!!document.querySelector('.apps-favorites-hub')&&visibleText().includes('商品-采购对照表'),'favorite screenshot is settled');
  }
  if(new URL(location.href).searchParams.get('screen')==='waiting'){
    holdViewData=true;await click(document.querySelector<HTMLButtonElement>('.apps-hub-primary')??undefined,'open the draft while its data response is delayed');
    await until(()=>!!document.querySelector('.apps-sidebar-preparing'),'pending detail presents a designed waiting state');
    check(visibleText().includes('请稍候')&&!visibleText().includes('正在读取本地快照'),'waiting detail uses clear and gentle copy');
  }
  await document.fonts.ready;await pause(70);
  check(document.documentElement.scrollWidth<=innerWidth,'viewport has no horizontal overflow');
  const pane=document.querySelector<HTMLElement>('[role="tabpanel"]');
  check(pane&&pane.scrollWidth<=pane.clientWidth+1,'sidebar content has no horizontal overflow');
  check(errors.length===0,'no browser errors or unhandled rejections');
  return {ok:true,scope:'ISOLATED_PRODUCTION_REACT_FIXTURE',actualDesktop:false,actualShopData:false,viewport:{width:innerWidth,height:innerHeight},screen:new URL(location.href).searchParams.get('screen'),initialBusinessReads:0,closeTarget:{width:closeRect!.width,height:closeRect!.height},checks,errors,requests};
}
run().then(finish).catch(error=>finish({ok:false,checks,errors,message:String(error),requests}));
function finish(result:unknown){const output=document.createElement('pre');output.id='sidebar-session-result';output.textContent=JSON.stringify(result);document.body.append(output);}
