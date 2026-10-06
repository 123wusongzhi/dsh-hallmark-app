import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HallmarkBridge } from './api.ts';
import type { SessionViewSummary } from './api.ts';
import { EmptyView, ErrorView, LoadingView } from './renderer.tsx';
import { SnapshotView } from './snapshot.tsx';
import { COMPONENTS_SIDEBAR_KIND, openSessionComponents, readSidebarNavigation } from './sidebar-contract.ts';
import type { NativeSidebarProps, NativeSidebarRight } from './sidebar-contract.ts';
import { STYLES } from './styles.ts';
import { CHAT_STYLES } from './chat-styles.ts';
import { AppIcon } from './icons.tsx';
function updatedTime(value:string):string|undefined {
  if(!Number.isFinite(Date.parse(value)))return;
  return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
}
export function SessionComponentsButton({sessionId,sidebarRight}:{sessionId?:string;sidebarRight?:NativeSidebarRight}){
  const [error,setError]=useState('');
  return <span className="hm-root hm-session-button hm-chat-trigger"><style>{STYLES}{CHAT_STYLES}</style><button type="button" aria-label="查看本会话组件" title="打开本会话的组件工作区" onClick={()=>{const result=openSessionComponents(sidebarRight,sessionId);setError(result.ok?'':result.message??'侧栏不可用。');}}><AppIcon name="layers" size={15}/>会话组件</button>{error?<span className="hm-button-notice" role="status">{error}</span>:null}</span>;
}
export function SessionComponentsTitle(){return <span className="hm-chat-tab-title"><style>{CHAT_STYLES}</style><AppIcon name="layers" size={15}/>本会话组件</span>;}
export function SessionComponentsPane({sessionId,useTabInfo,onOpenWorkspace}:NativeSidebarProps&{onOpenWorkspace?:(view:{sessionId:string;viewId:string;title:string})=>void}){
  const info=useTabInfo?.();const navigation=readSidebarNavigation(info?.tab.navigation.params);const selectedId=navigation.valid?navigation.viewId:undefined;
  const bridge=useMemo(()=>new HallmarkBridge(sessionId??''),[sessionId]);
  const [views,setViews]=useState<SessionViewSummary[]>([]);const [loadedOwner,setLoadedOwner]=useState<string|undefined>();const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [version,setVersion]=useState(0);
  const [managing,setManaging]=useState(false);const [editing,setEditing]=useState<{viewId:string;action:'rename'|'remove'}>();const [title,setTitle]=useState('');const [pending,setPending]=useState(false);const [managementError,setManagementError]=useState('');const [notice,setNotice]=useState('');
  const mutation=useRef<AbortController>();const currentOwner=useRef(sessionId);currentOwner.current=sessionId;
  useEffect(()=>{setManaging(false);setEditing(undefined);setPending(false);setManagementError('');setNotice('');return()=>{mutation.current?.abort();mutation.current=undefined;};},[bridge]);
  useEffect(()=>{
    const controller=new AbortController();setViews([]);setLoadedOwner(undefined);setError('');setLoading(true);
    if(!sessionId||!navigation.valid){setLoading(false);if(!navigation.valid)setError('侧栏导航参数无效，请重新打开本会话组件。');return;}
    const signal=info?.tab.signal;const abort=()=>controller.abort();if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
    bridge.sessionViews(controller.signal).then(result=>{if(!controller.signal.aborted){setViews(result.views);setLoadedOwner(result.sessionId);}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'本会话组件读取失败。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{controller.abort();signal?.removeEventListener('abort',abort);};
  },[bridge,sessionId,navigation.valid,selectedId,info?.tab.navigation.revision,info?.tab.signal,version]);
  useEffect(()=>{const listener=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.sessionId!==sessionId)return;if(detail.action==='remove'){setViews(current=>current.filter(view=>view.viewId!==detail.viewId));if(selectedId===detail.viewId)navigate();}setVersion(value=>value+1);};window.addEventListener('hallmark-view-updated',listener);return()=>window.removeEventListener('hallmark-view-updated',listener);},[sessionId,selectedId,info?.tab.actions]);
  useEffect(()=>info?.tab.actions.bindCommands?.({refresh:()=>setVersion(value=>value+1)}),[info?.tab.actions]);
  const scopedViews=loadedOwner===sessionId?views:[];
  const selected=scopedViews.find(view=>view.viewId===selectedId);
  const navigate=(viewId?:string)=>{if(!info){setError('原生会话侧栏导航尚未就绪。');return;}try{info.tab.actions.openTab(COMPONENTS_SIDEBAR_KIND,{params:viewId?{viewId}:{}});}catch{setError('原生侧栏导航失败，请重试。');}};
  const beginEdit=(view:SessionViewSummary,action:'rename'|'remove')=>{setEditing({viewId:view.viewId,action});setTitle(view.title);setManagementError('');setNotice('');};
  const applyChange=async()=>{
    if(!editing||!sessionId||mutation.current||!scopedViews.some(view=>view.viewId===editing.viewId))return;
    const controller=new AbortController();mutation.current=controller;const signal=info?.tab.signal?AbortSignal.any([controller.signal,info.tab.signal]):controller.signal;
    const owner=sessionId;setPending(true);setManagementError('');setNotice('');
    try{const result=await bridge.manageSessionView(editing.viewId,editing.action,editing.action==='rename'?title:undefined,signal);if(signal.aborted||currentOwner.current!==owner)return;
      setViews(current=>result.action==='remove'?current.filter(view=>view.viewId!==result.viewId):current.map(view=>view.viewId===result.viewId?{...view,title:result.title!}:view));setEditing(undefined);setNotice(result.action==='remove'?'已从本会话移除，保存的组件仍保留。':'本会话组件名称已更新。');
    }catch(e){if(!signal.aborted&&currentOwner.current===owner)setManagementError(e instanceof Error?e.message:'操作未确认，请重新读取列表确认，再决定是否重试。');}
    finally{if(mutation.current===controller){mutation.current=undefined;if(currentOwner.current===owner)setPending(false);}}
  };
  return <section className="hm-root hm-session-components hm-chat-workspace" aria-label="本会话组件" aria-busy={loading}><style>{STYLES}{CHAT_STYLES}</style>
    <header className="hm-chat-workspace-header"><div className="hm-chat-brand"><span className="hm-chat-brand-mark" aria-hidden="true">H</span><div><span className="hm-chat-brand-name">Hallmark</span><h3>本会话组件</h3></div></div><button className="hm-chat-refresh" type="button" title="重新读取本会话组件" disabled={loading} onClick={()=>setVersion(value=>value+1)}><AppIcon name="refresh" size={15}/>重新读取</button></header>
    <div className="hm-chat-workspace-body">
    {error?<ErrorView message={error} onRetry={()=>setVersion(value=>value+1)}/>:null}{loading?<LoadingView/>:null}
    {notice?<p className="hm-chat-management-notice" role="status">{notice}</p>:null}
    {!loading&&!error?selectedId?<>
      <div className="hm-sidebar-toolbar"><button className="hm-chat-back" type="button" title="返回组件列表" onClick={()=>navigate()}><AppIcon name="arrow-right" size={15}/>组件列表</button>{selected?.state==='ready'&&sessionId&&onOpenWorkspace?<button className="hm-chat-open-workspace" type="button" title="在工作台打开此组件" onClick={()=>{try{onOpenWorkspace({sessionId,viewId:selected.viewId,title:selected.title});}catch(e){setError(e instanceof Error?e.message:'工作区打开失败。');}}}>在标签页打开<AppIcon name="arrow-up-right" size={15}/></button>:null}</div>
      <div className="hm-chat-detail">{selected?.state==='ready'&&sessionId?<SnapshotView key={`${sessionId}:${selectedId}:${version}:${info?.tab.navigation.revision}`} sessionId={sessionId} viewId={selectedId} owned/>:<EmptyView message={selected?.state==='expired'?'组件已过期':'此组件不存在或不属于此会话'} detail="请返回组件列表，或在聊天中让 Agent 重新创建。"/>}</div>
    </>:scopedViews.length?<>
      <div className="hm-chat-list-heading"><span>当前聊天 · {scopedViews.length} 个组件</span><button className="hm-chat-manage-toggle" type="button" aria-pressed={managing} disabled={pending} onClick={()=>{setManaging(!managing);setEditing(undefined);setManagementError('');}}><AppIcon name={managing?'check':'settings'} size={13}/>{managing?'完成管理':'管理'}</button></div>
      {managing?<p className="hm-chat-management-help">重命名和移除仅作用于本会话。已保存组件请到「应用 → Hallmark → 组件库」管理。</p>:null}
      <ul className="hm-session-view-list">{scopedViews.map(view=><li key={view.viewId}><button className="hm-chat-component-card" type="button" title={view.state==='ready'?`打开 ${view.title}`:'请在聊天中让 Agent 重新创建此组件'} disabled={view.state==='expired'} onClick={()=>navigate(view.viewId)}>
        <span className="hm-chat-card-icon"><AppIcon name="layers" size={21}/></span><span className="hm-chat-card-copy"><strong>{view.title}</strong><span className="hm-chat-card-meta"><span className="hm-chat-card-status" data-state={view.state}>{view.state==='ready'?'可查看':'已过期'}</span>{updatedTime(view.updatedAt)?<time dateTime={view.updatedAt} title={`组件更新于 ${view.updatedAt}`}>{updatedTime(view.updatedAt)}</time>:null}</span></span><AppIcon name="arrow-up-right" size={17} className="hm-chat-card-open"/>
      </button>{managing?<div className="hm-chat-card-management">
        {editing?.viewId===view.viewId?<div className="hm-chat-management-editor" aria-busy={pending}>
          {editing.action==='rename'?<form onSubmit={event=>{event.preventDefault();void applyChange();}}><label>本会话组件名称<input aria-label={`重命名 ${view.title}`} value={title} maxLength={200} autoFocus disabled={pending} onChange={event=>setTitle(event.target.value)}/></label><div className="hm-chat-management-actions"><button type="submit" disabled={pending||!title.trim()}>{pending?'正在保存…':'保存名称'}</button><button type="button" disabled={pending} onClick={()=>{setEditing(undefined);setManagementError('');}}>取消</button></div></form>:<><p>从本会话移除「{view.title}」？</p><p className="hm-chat-management-help">已保存的组件、模板和店铺数据不会删除。临时组件需让 Agent 重新创建后才能再次查看。</p><div className="hm-chat-management-actions"><button className="hm-chat-remove" type="button" disabled={pending} onClick={()=>void applyChange()}>{pending?'正在移除…':'确认从本会话移除'}</button><button type="button" disabled={pending} onClick={()=>{setEditing(undefined);setManagementError('');}}>取消</button></div></>}
          {managementError?<p className="hm-chat-management-error" role="alert">{managementError}</p>:null}
        </div>:<div className="hm-chat-management-actions"><button type="button" disabled={pending||view.state==='expired'} onClick={()=>beginEdit(view,'rename')}>重命名</button><button className="hm-chat-remove" type="button" disabled={pending} onClick={()=>beginEdit(view,'remove')}>从本会话移除</button></div>}
      </div>:null}</li>)}</ul><p className="hm-chat-list-note">在聊天中继续调整，组件会同步更新。</p>
    </>:<div className="hm-chat-empty" role="status"><div className="hm-chat-empty-art" aria-hidden="true"><span className="hm-chat-empty-sheet"><AppIcon name="table" size={35}/></span><span className="hm-chat-empty-chart"><AppIcon name="chart" size={24}/></span></div><h3>{sessionId?'让聊天结果，更好用':'先打开一个聊天'}</h3><p>{sessionId?'在聊天中让 Agent 创建表格或图表，组件会显示在这里。':'打开聊天后，就可以在这里查看和使用 Agent 创建的组件。'}</p>{sessionId?<div className="hm-chat-prompt-example"><span><AppIcon name="chat" size={14}/>试着在聊天中说</span><p>“把最近采集的产品整理成表格”</p></div>:null}</div>:null}
    </div>
  </section>;
}
