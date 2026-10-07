import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {SessionComponentsPane} from '../../dsh-plugin/client/sidebar.tsx';
import {COMPONENTS_SIDEBAR_KIND,readSidebarNavigation} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarProps,NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import {AppsNativeView} from './view.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import {appsResource} from './api.ts';
import type {AppsView} from '../../app-presentation/src/types.ts';
import {ErrorView,LoadingView} from '../../dsh-plugin/client/renderer.tsx';
const absentMounted={getSnapshot:()=>undefined,subscribe:(_listener:()=>void)=>()=>{}};
/** The selected Apps view negotiates the real SDK; the existing native list remains intact. */
export function AppsSidebarPane(props:NativeSidebarProps&{sidebarRight?:NativeSidebarRight;onOpenWorkspace?:(view:{sessionId:string;viewId:string;title:string})=>void}) {
  const info=props.useTabInfo?.(),navigation=readSidebarNavigation(info?.tab.navigation.params);
  const store=props.sidebarRight?.mounted??absentMounted,owner=useSyncExternalStore(store.subscribe??absentMounted.subscribe,store.getSnapshot,store.getSnapshot);
  const [aborted,setAborted]=useState(info?.tab.signal.aborted??false);
  const identity=JSON.stringify([props.sessionId,navigation.viewId,navigation.publicationId]),visible=!!props.sessionId&&owner===props.sessionId&&info?.tab.visible===true&&!aborted&&!info.tab.signal.aborted;
  const [renderer,setRenderer]=useState<{identity:string;kind:'apps'|'legacy'|'error';message?:string}>();
  useEffect(()=>{const signal=info?.tab.signal;setAborted(signal?.aborted??false);const abort=()=>setAborted(true);signal?.addEventListener('abort',abort,{once:true});return()=>signal?.removeEventListener('abort',abort);},[info?.tab.signal]);
  useEffect(()=>{
    if(!visible||!navigation.valid||!navigation.viewId||!props.sessionId){setRenderer(undefined);return;}
    // A native reopen retries a cached catalogue failure without replacing a working frame.
    setRenderer(current=>current?.identity===identity&&current.kind==='apps'?current:undefined);
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,info!.tab.signal]);
    appsResource<{views:AppsView[]}>('views',{sessionId:props.sessionId},signal).then(value=>{if(!Array.isArray(value.views)||value.views.some(view=>view.ownerSessionId!==props.sessionId))throw new Error('组件目录的会话归属不一致。');if(!signal.aborted)setRenderer({identity,kind:value.views.some(view=>view.viewId===navigation.viewId)?'apps':'legacy'});}).catch(error=>{
      if(!signal.aborted){const message=error instanceof Error?error.message:String(error);setRenderer(current=>current?.identity===identity&&current.kind==='apps'?{...current,message}:{identity,kind:'error',message});}
    });
    return()=>controller.abort();
  },[identity,visible,info?.tab.signal,info?.tab.navigation.revision]);
  if(!navigation.valid||!navigation.viewId)return <SessionComponentsPane {...props} useTabInfo={()=>info!}/>;
  if(!props.sessionId||owner!==props.sessionId||info?.tab.visible!==true||aborted||info.tab.signal.aborted)return null;
  const sessionId=props.sessionId,viewId=navigation.viewId;
  if(renderer?.identity!==identity)return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><LoadingView/></section>;
  if(renderer.kind==='legacy')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><SessionComponentsPane {...props} useTabInfo={()=>info}/></section>;
  if(renderer.kind==='error')return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><ErrorView message={renderer.message??'组件归属暂时无法确认，请重新打开。'}/></section>;
  return <section className="apps-native-sidebar"><style>{APPS_WORKSPACE_STYLES}</style><div className="apps-component-actions"><button onClick={()=>info.tab.actions.openTab(COMPONENTS_SIDEBAR_KIND,{params:{}})}>组件列表</button>{props.onOpenWorkspace?<button onClick={()=>props.onOpenWorkspace?.({sessionId,viewId,title:'应用组件'})}>在标签页打开</button>:null}</div>{renderer.message?<p className="hm-error" role="status">组件目录重新读取失败，当前视图继续保留：{renderer.message}</p>:null}<AppsNativeView key={`${sessionId}:${viewId}:${navigation.publicationId??''}`} sessionId={sessionId} viewId={viewId} expectedPublicationId={navigation.publicationId} visibilitySignal={info.tab.signal} isCurrentOwner={()=>props.sidebarRight?.mounted.getSnapshot()===sessionId&&info.tab.visible&&!info.tab.signal.aborted}/></section>;
}
