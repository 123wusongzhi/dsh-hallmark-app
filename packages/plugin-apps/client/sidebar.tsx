import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {SessionComponentsPane} from '../../dsh-plugin/client/sidebar.tsx';
import {COMPONENTS_SIDEBAR_KIND,readSidebarNavigation} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarProps,NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import {AppsNativeView} from './view.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import {appsAuthoring,appsResource} from './api.ts';
import {updateOwnedAppsView} from './native-publication.tsx';
import type {AppsView} from '../../app-presentation/src/types.ts';
import {ErrorView,LoadingView} from '../../dsh-plugin/client/renderer.tsx';
import {CurrentComponentWorkbenchAction} from './workbench-component-actions.tsx';
const absentMounted={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
/** The selected Apps view negotiates the real SDK; the existing native list remains intact. */
export function AppsSidebarPane(props:NativeSidebarProps&{sidebarRight?:NativeSidebarRight;onOpenWorkspace?:(view:{sessionId:string;viewId:string;title:string})=>void}) {
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
    let requested=0;const read=()=>{const sequence=++requested;void appsResource<{views:AppsView[]}>('views',{sessionId:props.sessionId!},signal).then(value=>{if(!Array.isArray(value.views)||value.views.some(view=>view.ownerSessionId!==props.sessionId))throw new Error('组件目录的会话归属不一致。');const view=value.views.find(view=>view.viewId===navigation.viewId);if(!signal.aborted&&sequence===requested)setRenderer({identity,kind:view?.panelState==='closed'?'closed':view?'apps':'legacy',view});}).catch(error=>{
      if(!signal.aborted&&sequence===requested){const message=error instanceof Error?error.message:String(error);setRenderer(current=>current?.identity===identity&&current.kind==='apps'?{...current,message}:{identity,kind:'error',message});}
    });};read();const updated=(event:Event)=>{if((event as CustomEvent<{sessionId?:string}>).detail?.sessionId===props.sessionId)read();};window.addEventListener('hallmark-view-updated',updated);
    return()=>{controller.abort();window.removeEventListener('hallmark-view-updated',updated);};
  },[identity,visible,info?.tab.signal,info?.tab.navigation.revision]);
  if(!navigation.valid||!navigation.viewId)return <SessionComponentsPane {...props} useTabInfo={()=>info!}/>;
  if(!props.sessionId||owner!==props.sessionId||info?.tab.visible!==true||aborted||info.tab.signal.aborted)return null;
  const sessionId=props.sessionId,viewId=navigation.viewId;
  if(renderer?.identity!==identity)return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><LoadingView/></section>;
  if(renderer.kind==='legacy')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><SessionComponentsPane {...props} useTabInfo={()=>info}/></section>;
  if(renderer.kind==='closed')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><p>工作副本已关闭，内容仍保留。</p>{renderer.message?<p role="status">{renderer.message}</p>:null}<button disabled={restoring} onClick={()=>{setRestoring(true);void appsAuthoring<AppsView>(sessionId,'restoreView',{viewId},info.tab.signal).then(view=>{if(view.ownerSessionId!==sessionId||view.viewId!==viewId||view.panelState==='closed')throw new Error('工作副本恢复状态尚未确认。');if(!info.tab.signal.aborted&&props.sidebarRight?.mounted.getSnapshot()===sessionId){updateOwnedAppsView(view);setRenderer({identity,kind:'apps',view});}}).catch(error=>{if(!info.tab.signal.aborted)setRenderer({identity,kind:'closed',message:error instanceof Error?error.message:String(error)});}).finally(()=>setRestoring(false));}}>{restoring?'正在恢复…':'恢复工作副本'}</button></section>;
  if(renderer.kind==='error')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><ErrorView message={renderer.message??'组件归属暂时无法确认，请重新打开。'}/></section>;
  return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><div className="apps-component-actions"><button onClick={()=>info.tab.actions.openTab(COMPONENTS_SIDEBAR_KIND,{params:{}})}>组件列表</button>{props.onOpenWorkspace?<button onClick={()=>props.onOpenWorkspace?.({sessionId,viewId,title:'应用组件'})}>在标签页打开</button>:null}</div>{renderer.view?<CurrentComponentWorkbenchAction key={identity} appId={renderer.view.bindings[0]?.appId??'hallmark'} sessionId={sessionId} view={renderer.view}/>:null}{renderer.message?<p className="hm-error" role="status">组件目录重新读取失败，当前视图继续保留：{renderer.message}</p>:null}<AppsNativeView key={`${sessionId}:${viewId}:${navigation.publicationId??''}:${navigation.displayId??''}`} sessionId={sessionId} viewId={viewId} expectedPublicationId={navigation.publicationId} expectedDisplayId={navigation.displayId} visibilitySignal={info.tab.signal} isCurrentOwner={()=>props.sidebarRight?.mounted.getSnapshot()===sessionId&&info.tab.visible&&!info.tab.signal.aborted}/></section>;
}
