import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {SessionComponentsPane} from '../../dsh-plugin/client/sidebar.tsx';
import {COMPONENTS_SIDEBAR_KIND,readSidebarNavigation} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarProps,NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import {AppsNativeView} from './view.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import {appsAuthoring,appsResource} from './api.ts';
import {updateOwnedAppsView,useOwnedAppsViews} from './native-publication.tsx';
import type {AppsView} from '../../app-presentation/src/types.ts';
import {ErrorView} from '../../dsh-plugin/client/renderer.tsx';
import {CurrentComponentWorkbenchAction} from './workbench-component-actions.tsx';
import {AppsSessionHub,AppsFavoritesHub} from './session-hub.tsx';
import {CurrentComponentFavoriteAction} from './component-favorites.tsx';
import {SidebarPreparing,SIDEBAR_STATUS_STYLES} from './sidebar-status.tsx';
import {SIDEBAR_SHELL_STYLES} from './sidebar-shell-styles.ts';
import {closeComponentTab,initialSidebarTabs,openComponentTab} from './sidebar-tabs.ts';
import type {ComponentSidebarTabs} from './sidebar-tabs.ts';
import {sessionViewStatus} from './session-component-state.ts';
const absentMounted={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
type SidebarProps=NativeSidebarProps&{sidebarRight?:NativeSidebarRight;onOpenWorkspace?:(view:{sessionId:string;viewId:string;title:string})=>void;onOpenLibrary?:()=>void};
/** The Host owns one native pane. Its two entry tabs remain available while detail tabs come and go. */
export function AppsSidebarPane(props:SidebarProps) {
  return <AppsSidebarSession key={props.sessionId??'no-session'} {...props}/>;
}
function AppsSidebarSession(props:SidebarProps) {
  const info=props.useTabInfo?.(),navigation=readSidebarNavigation(info?.tab.navigation.params);
  const ownerStore=props.sidebarRight?.mounted??absentMounted,owner=useSyncExternalStore(ownerStore.subscribe??absentMounted.subscribe,ownerStore.getSnapshot,ownerStore.getSnapshot);
  const [aborted,setAborted]=useState(info?.tab.signal.aborted??false),[state,setState]=useState<ComponentSidebarTabs>(()=>navigation.valid&&navigation.viewId?openComponentTab(initialSidebarTabs(),{viewId:navigation.viewId,...(navigation.publicationId?{publicationId:navigation.publicationId}:{}),...(navigation.displayId?{displayId:navigation.displayId}:{})}):initialSidebarTabs());
  const [views,setViews]=useState<AppsView[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const activeTab=useRef<HTMLDivElement>(null);
  useEffect(()=>{activeTab.current?.scrollIntoView?.({block:'nearest',inline:'nearest'});},[state.active,state.tabs.length,views]);
  const visible=!!props.sessionId&&owner===props.sessionId&&info?.tab.visible===true&&!aborted&&!info.tab.signal.aborted;
  useEffect(()=>{const signal=info?.tab.signal;setAborted(signal?.aborted??false);const abort=()=>setAborted(true);signal?.addEventListener('abort',abort,{once:true});return()=>signal?.removeEventListener('abort',abort);},[info?.tab.signal]);
  const routeKey=JSON.stringify(navigation);
  const consumedNavigation=useRef<string>();
  useEffect(()=>{
    if(!visible||!navigation.valid)return;
    const delivery=JSON.stringify([routeKey,info?.tab.navigation.revision]);
    if(consumedNavigation.current===delivery)return;
    consumedNavigation.current=delivery;
    if(navigation.viewId)setState(current=>openComponentTab(current,{viewId:navigation.viewId!,...(navigation.publicationId?{publicationId:navigation.publicationId}:{}),...(navigation.displayId?{displayId:navigation.displayId}:{})}));
    else setState(current=>({...current,active:'session'}));
  },[routeKey,info?.tab.navigation.revision,visible]);
  useOwnedAppsViews(props.sessionId,(next)=>{
    setViews(next);setLoaded(true);setError('');
    setState(current=>({...current,tabs:current.tabs.map(tab=>{const view=next.find(item=>item.viewId===tab.params.viewId);return view&&view.title!==tab.title?{...tab,title:view.title}:tab;})}));
  },cause=>{setError(cause instanceof Error?cause.message:String(cause));setLoaded(true);},refresh,visible&&(state.active==='session'||state.active==='favorites'));
  const openView=(view:AppsView)=>{
    if(!visible||view.ownerSessionId!==props.sessionId)return;
    updateOwnedAppsView(view);
    setState(current=>openComponentTab(current,{viewId:view.viewId,...(view.pendingPublicationId?{publicationId:view.pendingPublicationId}:{})},view.title));
  };
  const selected=state.tabs.find(tab=>tab.id===state.active);
  const detailInfo=useMemo(()=>info&&selected?{...info,tab:{...info.tab,navigation:{params:selected.params,revision:info.tab.navigation.revision},actions:{...info.tab.actions,openTab:(kind:string,options?:{params?:import('../../dsh-plugin/client/sidebar-contract.ts').SidebarNavigationParams})=>{
    if(kind!==COMPONENTS_SIDEBAR_KIND){info.tab.actions.openTab(kind,options);return;}
    const target=readSidebarNavigation(options?.params);if(!target.valid)return;
    if(target.viewId)setState(current=>openComponentTab(current,{viewId:target.viewId!,...(target.publicationId?{publicationId:target.publicationId}:{}),...(target.displayId?{displayId:target.displayId}:{})},views.find(view=>view.viewId===target.viewId)?.title));
    else setState(current=>({...current,active:'session'}));
  }}}}:undefined,[info?.tab.signal,info?.tab.visible,info?.tab.navigation.revision,selected,views]);
  const renderTab=(tab:{id:string;title:string;icon?:string})=><div className="apps-sidebar-tab" key={tab.id} ref={state.active===tab.id?activeTab:undefined} data-active={state.active===tab.id}><button type="button" role="tab" aria-selected={state.active===tab.id} aria-controls="apps-sidebar-panel" id={`apps-sidebar-${encodeURIComponent(tab.id)}`} onClick={()=>setState(current=>({...current,active:tab.id}))}>{tab.icon?<span aria-hidden="true">{tab.icon}</span>:null}<span>{tab.title}</span></button>{tab.id.startsWith('view:')?<button className="apps-sidebar-tab-close" type="button" aria-label={`关闭 ${tab.title}`} title={`关闭 ${tab.title}`} onClick={()=>setState(current=>closeComponentTab(current,tab.id))}>×</button>:null}</div>;
  if(!visible)return null;
  return <section className="apps-sidebar-shell" aria-label="组件侧边栏"><style>{APPS_WORKSPACE_STYLES}{SIDEBAR_SHELL_STYLES}{SIDEBAR_STATUS_STYLES}</style>
    <nav className="apps-sidebar-tabs" role="tablist" aria-label="组件页面" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||(event.target as HTMLElement).getAttribute('role')!=='tab')return;const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')),index=tabs.indexOf(event.target as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();tabs[next]?.focus();tabs[next]?.click();}}>
      {renderTab({id:'session',title:'本次会话',icon:'▱'})}{renderTab({id:'favorites',title:'我的收藏',icon:'☆'})}
      <div className="apps-sidebar-component-tabs">{state.tabs.map(renderTab)}</div>
    </nav>
    <div className="apps-sidebar-content" id="apps-sidebar-panel" role="tabpanel" aria-labelledby={`apps-sidebar-${encodeURIComponent(state.active)}`}>
      {!navigation.valid?<ErrorView message="这个组件入口暂时无法打开，请从本次会话重新选择。"/>:state.active==='session'?<AppsSessionHub sessionId={props.sessionId!} views={views} loading={!loaded} error={error} onRetry={()=>setRefresh(value=>value+1)} onOpenView={openView}/>:state.active==='favorites'?<AppsFavoritesHub sessionId={props.sessionId!} onOpenView={openView} onOpenLibrary={props.onOpenLibrary}/>:selected&&detailInfo?<AppsSidebarDetail key={selected.id} {...props} useTabInfo={()=>detailInfo} onView={view=>setState(current=>({...current,tabs:current.tabs.map(tab=>tab.params.viewId===view.viewId?{...tab,title:view.title}:tab)}))}/>:null}
    </div>
  </section>;
}
/** Only the selected detail mounts a renderer and its data bridge. */
function AppsSidebarDetail(props:SidebarProps&{onView?:(view:AppsView)=>void}) {
  const info=props.useTabInfo?.(),navigation=readSidebarNavigation(info?.tab.navigation.params);
  const store=props.sidebarRight?.mounted??absentMounted,owner=useSyncExternalStore(store.subscribe??absentMounted.subscribe,store.getSnapshot,store.getSnapshot);
  const [aborted,setAborted]=useState(info?.tab.signal.aborted??false);
  const identity=JSON.stringify([props.sessionId,navigation.viewId,navigation.publicationId,navigation.displayId]),visible=!!props.sessionId&&owner===props.sessionId&&info?.tab.visible===true&&!aborted&&!info.tab.signal.aborted;
  const [renderer,setRenderer]=useState<{identity:string;kind:'apps'|'legacy'|'closed'|'error';message?:string;view?:AppsView}>(),[restoring,setRestoring]=useState(false);
  useEffect(()=>{const signal=info?.tab.signal;setAborted(signal?.aborted??false);const abort=()=>setAborted(true);signal?.addEventListener('abort',abort,{once:true});return()=>signal?.removeEventListener('abort',abort);},[info?.tab.signal]);
  useEffect(()=>{
    if(!visible||!navigation.valid||!navigation.viewId||!props.sessionId){setRenderer(undefined);return;}
    // A native reopen retries a cached catalogue failure without replacing a working frame.
    setRenderer(current=>current?.identity===identity&&current.kind==='apps'?current:undefined);
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,info!.tab.signal]);
    let requested=0;const read=()=>{const sequence=++requested;void appsResource<{views:AppsView[]}>('views',{sessionId:props.sessionId!},signal).then(value=>{if(!Array.isArray(value.views)||value.views.some(view=>view.ownerSessionId!==props.sessionId))throw new Error('组件目录的会话归属不一致。');const view=value.views.find(view=>view.viewId===navigation.viewId);if(!signal.aborted&&sequence===requested){setRenderer({identity,kind:view?.panelState==='closed'?'closed':view?'apps':'legacy',view});if(view)props.onView?.(view);}}).catch(error=>{
      if(!signal.aborted&&sequence===requested){const message=error instanceof Error?error.message:String(error);setRenderer(current=>current?.identity===identity&&current.kind==='apps'?{...current,message}:{identity,kind:'error',message});}
    });};read();const updated=(event:Event)=>{if((event as CustomEvent<{sessionId?:string}>).detail?.sessionId===props.sessionId)read();};window.addEventListener('hallmark-view-updated',updated);
    return()=>{controller.abort();window.removeEventListener('hallmark-view-updated',updated);};
  },[identity,visible,info?.tab.signal,info?.tab.navigation.revision]);
  if(!navigation.valid||!navigation.viewId)return <SessionComponentsPane {...props} useTabInfo={()=>info!}/>;
  if(!props.sessionId||owner!==props.sessionId||info?.tab.visible!==true||aborted||info.tab.signal.aborted)return null;
  const sessionId=props.sessionId,viewId=navigation.viewId;
  if(renderer?.identity!==identity)return <section className="apps-native-sidebar"><SidebarPreparing/></section>;
  if(renderer.kind==='legacy')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><SessionComponentsPane {...props} useTabInfo={()=>info}/></section>;
  if(renderer.kind==='closed')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><p>工作副本已关闭，内容仍保留。</p>{renderer.message?<p role="status">{renderer.message}</p>:null}<button disabled={restoring} onClick={()=>{setRestoring(true);void appsAuthoring<AppsView>(sessionId,'restoreView',{viewId},info.tab.signal).then(view=>{if(view.ownerSessionId!==sessionId||view.viewId!==viewId||view.panelState==='closed')throw new Error('工作副本恢复状态尚未确认。');if(!info.tab.signal.aborted&&props.sidebarRight?.mounted.getSnapshot()===sessionId){updateOwnedAppsView(view);setRenderer({identity,kind:'apps',view});}}).catch(error=>{if(!info.tab.signal.aborted)setRenderer({identity,kind:'closed',message:error instanceof Error?error.message:String(error)});}).finally(()=>setRestoring(false));}}>{restoring?'正在恢复…':'恢复工作副本'}</button></section>;
  if(renderer.kind==='error')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><ErrorView message={renderer.message??'组件归属暂时无法确认，请重新打开。'}/></section>;
  return <section className="apps-native-sidebar"><div className="apps-sidebar-detail-toolbar"><button onClick={()=>info.tab.actions.openTab(COMPONENTS_SIDEBAR_KIND,{params:{}})}>← 本次会话</button>{renderer.view?<CurrentComponentFavoriteAction key={viewId} sessionId={sessionId} view={renderer.view} compact/>:null}<details><summary>更多</summary><div>{renderer.view?<CurrentComponentWorkbenchAction key={identity} appId={renderer.view.bindings[0]?.appId??'hallmark'} sessionId={sessionId} view={renderer.view}/>:null}{props.onOpenWorkspace?<button onClick={()=>props.onOpenWorkspace?.({sessionId,viewId,title:renderer.view?.title??'应用组件'})}>在应用工作台打开</button>:null}</div></details></div>{renderer.message?<details className="apps-sidebar-refresh-notice"><summary>更新稍有延迟，当前内容仍可查看</summary><p>{renderer.message}</p></details>:null}{renderer.view?.source&&sessionViewStatus(renderer.view).kind==='making'?<SidebarPreparing editing retained/>:null}<AppsNativeView key={`${sessionId}:${viewId}`} sessionId={sessionId} viewId={viewId} expectedPublicationId={navigation.publicationId} expectedDisplayId={navigation.displayId} visibilitySignal={info.tab.signal} isCurrentOwner={()=>props.sidebarRight?.mounted.getSnapshot()===sessionId&&info.tab.visible&&!info.tab.signal.aborted}/></section>;
}
