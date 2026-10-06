import React, { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { HallmarkBridge } from './api.ts';
import type { AppState, HealthDto } from './api.ts';
import { HallmarkWorkbench } from './workbench.tsx';
import { EmptyView, ErrorView } from './renderer.tsx';
import { APPLICATIONS, canStartChat, searchApplications } from './registry.ts';
import { observeCurrentSession, mainSessionSelection } from './session-selection.ts';
import type { SessionSnapshot } from './session-selection.ts';
import { createClickIntent } from './click-intent.ts';
import { STYLES } from './styles.ts';
import { MutationGate } from './mutation-gate.ts';
import { createWorkspaceState, workspaceReducer } from './workspace-tabs.ts';
import { WorkspaceDockTabs, workspaceDOMId } from './workspace-dock.tsx';
import { SnapshotView } from './snapshot.tsx';
import { ownedWorkspaceIntent } from './workspace-intent.ts';
import { AppIcon } from './icons.tsx';
import { refreshDatasetKeys } from './model.ts';
export interface SessionHooks {useSessions?:(selector:(state:SessionSnapshot)=>string|undefined)=>string|undefined;usePanelInfo?:(selector:(state:{activePanelId:string|null})=>string|null)=>string|null}
export function ApplicationsSidebarIcon({size=20,active=false,useSessions,usePanelInfo}:{size?:number;active?:boolean}&SessionHooks){
  const panelId=usePanelInfo?.(state=>state.activePanelId)??null;
  // Always-mounted root entry observes a unique current Session BEFORE conversation unmounts.
  useSessions?.(snapshot=>mainSessionSelection.observe(snapshot,panelId));
  return <span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:size,height:size,opacity:active?1:.8}}><AppIcon name="apps" size={size}/></span>;
}
export function AppRegistryPage({useSessions,currentSessionId,bridgeFactory,onReturn}:{currentSessionId?:string;bridgeFactory?:(sessionId:string)=>HallmarkBridge;onReturn?:(sessionId?:string)=>void}&SessionHooks){
  const sessionId=useSessions?useSessions(observeCurrentSession):currentSessionId;
  const currentSession=useRef(sessionId);currentSession.current=sessionId;
  const sessionTitle=useSessions?useSessions(snapshot=>sessionId?snapshot.byId[sessionId]?.title:undefined):undefined;
  const bridge=useMemo(()=>bridgeFactory?.(sessionId??'')??new HallmarkBridge(sessionId??''),[bridgeFactory,sessionId]);
  const dockPrefix=useId();const [workspace,dispatchWorkspace]=useReducer(workspaceReducer,createWorkspaceState());const [hasWorkspace,setHasWorkspace]=useState(false);
  const [selected,setSelected]=useState<string|undefined>();const [search,setSearch]=useState('');const [menu,setMenu]=useState<string|undefined>();
  const [managing,setManaging]=useState(false);const [refreshing,setRefreshing]=useState(false);const [notice,setNotice]=useState('');const refreshes=useMemo(()=>new MutationGate(),[]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [chatState,setChatState]=useState<AppState|undefined>();const [health,setHealth]=useState<HealthDto|undefined>();
  const menuItem=useRef<HTMLButtonElement|null>(null);const mutations=useMemo(()=>new MutationGate(),[]);
  useEffect(()=>{setChatState(undefined);if(!sessionId||typeof bridge.state!=='function')return;const controller=new AbortController();bridge.state(controller.signal).then(state=>{if(!controller.signal.aborted)setChatState(state);}).catch(()=>{});return()=>controller.abort();},[bridge,sessionId]);
  useEffect(()=>{setHealth(undefined);if(typeof bridge.health!=='function')return;const controller=new AbortController();bridge.health(controller.signal).then(value=>{if(!controller.signal.aborted)setHealth(value);}).catch(()=>{if(!controller.signal.aborted)setHealth({serviceStatus:'unavailable',hallmarkStatus:'unavailable'});});return()=>controller.abort();},[bridge]);
  useEffect(()=>{setBusy(false);return()=>mutations.reset();},[bridge,mutations]);useEffect(()=>{if(menu)queueMicrotask(()=>menuItem.current?.focus());},[menu]);
  useEffect(()=>{setRefreshing(false);setNotice('');return()=>refreshes.reset();},[bridge,refreshes]);
  useEffect(()=>{dispatchWorkspace({type:'session-change',sessionId});const apply=()=>{const intent=ownedWorkspaceIntent.take();if(!intent)return;const target=currentSession.current;if(!target||intent.sessionId!==target){setError('会话已切换或尚未就绪，请回到原会话后重新打开组件。');return;}setSelected('hallmark');setManaging(false);setHasWorkspace(true);dispatchWorkspace({type:'open-view',appId:'hallmark',owned:true,currentSessionId:target,...intent});};const dispose=ownedWorkspaceIntent.subscribe(apply);apply();return dispose;},[sessionId]);
  const startChat=async(appId:string)=>{
    if(!canStartChat(appId)){setError('该应用的聊天能力尚未接入，不会调用其他应用的业务接口。');return;}
    if(!sessionId){setError('请先在原界面选择一个聊天，再启动 Hallmark；不会猜测或创建会话。');return;}
    if(busy)return;if(!onReturn){setError('原生会话导航未就绪，请在原聊天中使用应用，或稍后重试。');return;}
    const ticket=mutations.begin();const controller=ticket.controller;setBusy(true);setError('');
    try{const state=await bridge.activate(controller.signal);if(!mutations.current(ticket))return;if(!state.active)throw new Error('当前聊天应用状态未确认。');setChatState(state);window.dispatchEvent(new CustomEvent('hallmark-app-state',{detail:{sessionId}}));setMenu(undefined);onReturn(sessionId);}
    catch(e){if(mutations.current(ticket))setError(e instanceof Error?e.message:'应用启用失败，请重试。');}finally{if(mutations.current(ticket))setBusy(false);}
  };
  const closeChat=async(appId:string)=>{
    if(!canStartChat(appId)){setError('该应用的聊天能力尚未接入。');return;}if(!sessionId||busy)return;
    const ticket=mutations.begin();const controller=ticket.controller;setBusy(true);setError('');
    try{const state=await bridge.close(controller.signal);if(mutations.current(ticket)){setChatState(state);setMenu(undefined);window.dispatchEvent(new CustomEvent('hallmark-app-state',{detail:{sessionId}}));}}
    catch(e){if(mutations.current(ticket))setError(e instanceof Error?e.message:'应用关闭失败，请重试。');}finally{if(mutations.current(ticket))setBusy(false);}
  };
  const startRef=useRef(startChat);startRef.current=startChat;const selectedRef=useRef('hallmark');
  const clickIntent=useMemo(()=>createClickIntent(()=>{if(selectedRef.current==='hallmark')setHasWorkspace(true);setSelected(selectedRef.current);setManaging(false);setMenu(undefined);setError('');},()=>{void startRef.current(selectedRef.current);}),[]);
  useEffect(()=>()=>clickIntent.cancel(),[clickIntent]);
  const openApp=(appId:string,detail:number)=>{selectedRef.current=appId;clickIntent.single(detail);};
  const openMenu=(appId:string)=>{clickIntent.cancel();setMenu(appId);};
  const renderMenu=(appId:string)=>menu===appId?<div role="menu" className="hm-context-menu" aria-label={`${appId} 操作`} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();setMenu(undefined);document.getElementById(`hm-more-${appId}`)?.focus();}
    else if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}
  }}><button type="button" role="menuitem" ref={menuItem} disabled={!sessionId||busy||!canStartChat(appId)} onClick={()=>{clickIntent.cancel();void startChat(appId);}}>{busy?'正在启用…':'启动聊天'}</button>
    {canStartChat(appId)&&sessionId&&chatState?.active!==false?<button type="button" role="menuitem" disabled={busy} onClick={()=>{clickIntent.cancel();void closeChat(appId);}}>关闭当前聊天应用</button>:null}
    {!sessionId?<p className="hm-muted">请先选择原有聊天。工作台和本地组件无需启用聊天即可使用。</p>:null}
  </div>:null;
  const app=APPLICATIONS.find(item=>item.id===selected);
  const shownApplications=searchApplications(search);
  const connectionStatus=health?.serviceStatus==='ok'&&health.hallmarkStatus==='ok'?'connected':health?'disconnected':'checking';
  const connectionLabel=connectionStatus==='connected'?'已连接':health?.serviceStatus==='ok'?'业务源未连接':health?'服务未连接':'检查连接中';
  const refresh=async()=>{
    if(refreshing)return;const ticket=refreshes.begin();setRefreshing(true);setNotice('');setError('');
    try{
      const tab=workspace.tabs.find(item=>item.id===workspace.activeId);
      if(tab?.kind==='view'&&tab.viewId){
        if(tab.owned&&tab.sessionId!==currentSession.current)throw new Error('请先返回该组件所属的聊天。');
        const spec=await (tab.owned?bridge.sessionView(tab.viewId,ticket.controller.signal):bridge.view(tab.viewId,ticket.controller.signal));
        if(!refreshes.current(ticket))return;
        for(const datasetKey of refreshDatasetKeys(spec)){
          const result=await bridge.refresh(datasetKey,ticket.controller.signal);
          if(!refreshes.current(ticket))return;
          if(result.status==='pending'){setNotice('数据刷新处理中。');return;}
          if(result.status!=='ok')throw new Error(result.error?.message??'数据更新失败，请稍后重试。');
        }
        window.dispatchEvent(new CustomEvent('hallmark:component-changed',{detail:{viewId:tab.viewId,...(tab.owned?{sessionId:tab.sessionId}:{})}}));
      }else window.dispatchEvent(new CustomEvent('hallmark:workspace-refresh',{detail:{appId:'hallmark'}}));
      if(typeof bridge.health==='function'){const value=await bridge.health(ticket.controller.signal);if(refreshes.current(ticket))setHealth(value);}
    }catch(e){if(refreshes.current(ticket))setError(e instanceof Error?e.message:'更新失败，请稍后重试。');}
    finally{if(refreshes.current(ticket))setRefreshing(false);}
  };
  return <section className="hm-root hm-page hm-registry-page" aria-label="应用页面"><style>{STYLES}</style>
    <aside className="hm-directory-rail hm-app-rail" aria-label="应用列表"><header className="hm-directory-header"><div className="hm-directory-title"><h2>应用</h2><span className="hm-app-count">{APPLICATIONS.length}</span></div><label className="hm-search-field"><AppIcon name="search" size={17}/><input type="search" aria-label="搜索应用" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索应用"/></label></header>
      <div className="hm-rail-section-label">全部应用</div>
      <div className="hm-directory-list">{shownApplications.map(definition=><article key={definition.id} className="hm-application-card hm-application-row" data-selected={selected===definition.id} onContextMenu={event=>{event.preventDefault();openMenu(definition.id);}} onKeyDown={event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();openMenu(definition.id);}}}>
        <button type="button" className="hm-card-open" disabled={busy} aria-current={selected===definition.id?'page':undefined} onClick={event=>openApp(definition.id,event.detail)} onDoubleClick={()=>{selectedRef.current=definition.id;clickIntent.double();}} aria-label={`进入 ${definition.name} 工作台（双击启动聊天）`}><span className="hm-app-letter" aria-hidden="true">{definition.name.slice(0,1)}</span><span className="hm-rail-app-copy"><strong>{definition.name}</strong><span className="hm-row-description">{definition.category}</span></span></button>
        <button id={`hm-more-${definition.id}`} type="button" className="hm-row-more" aria-label={`${definition.name} 更多操作`} aria-haspopup="menu" aria-expanded={menu===definition.id} onClick={()=>{if(menu===definition.id){clickIntent.cancel();setMenu(undefined);}else openMenu(definition.id);}}><AppIcon name="more" size={17}/></button>{renderMenu(definition.id)}
      </article>)}</div>
      {!shownApplications.length?<div className="hm-directory-empty" role="status">未找到应用</div>:null}
      <footer className="hm-directory-footer"><button type="button" className="hm-manage-button" aria-current={managing?'page':undefined} onClick={()=>{clickIntent.cancel();setSelected(undefined);setMenu(undefined);setManaging(true);setError('');}}><AppIcon name="settings" size={18}/><span>管理应用</span></button></footer>
    </aside>
    <div className="hm-page-right">{app?.id==='hallmark'?<WorkspaceDockTabs state={workspace} onAction={dispatchWorkspace} idPrefix={dockPrefix}/>:null}<header className="hm-page-header"><div className="hm-page-heading">
      {app?<button type="button" className="hm-back-apps hm-icon-button" aria-label="应用列表" title="返回应用列表" onClick={()=>{clickIntent.cancel();setSelected(undefined);setMenu(undefined);setManaging(false);}}><AppIcon name="apps" size={17}/><span className="hm-sr-only">应用列表</span></button>:null}
      <div className="hm-page-title">{app?<span className="hm-brand-letter" aria-hidden="true">{app.name.slice(0,1)}</span>:<span className="hm-page-mark" aria-hidden="true"><AppIcon name={managing?'settings':'apps'} size={25}/></span>}<div><h2>{app?.name??(managing?'管理应用':'应用工作区')}</h2><div className="hm-page-meta"><span className="hm-muted">{app?.category??(managing?'管理已接入的应用':'选择应用，开始工作')}</span>{app?<span className="hm-connection-state" data-status={connectionStatus} role="status"><span className="hm-status-dot"/>{connectionLabel}</span>:null}</div></div></div>
      </div>{app?<div className="hm-page-actions-wrap"><div className="hm-header-actions hm-actions"><button type="button" className="hm-action-secondary" disabled={refreshing} onClick={()=>{clickIntent.cancel();void refresh();}}><AppIcon name="refresh" size={17}/>{refreshing?'更新中…':'刷新数据'}</button><button type="button" className="hm-action-primary" disabled={!sessionId||busy||!canStartChat(app.id)||!onReturn} onClick={()=>{clickIntent.cancel();void startChat(app.id);}}><AppIcon name="chat" size={17}/>{busy?'正在进入…':'进入聊天'}</button></div><p className="hm-chat-context" title={sessionTitle??undefined}>{sessionId?(sessionTitle??'已选择当前聊天'):'先选择一个聊天'}</p></div>:null}</header>
      {notice?<p className="hm-page-notice" role="status">{notice}</p>:null}
      {error?<div className="hm-page-alert"><ErrorView message={error}/></div>:null}
      <main className="hm-work-area">{hasWorkspace?<div className="hm-workspace-panes" hidden={app?.id!=='hallmark'}>{workspace.tabs.map(tab=><section key={tab.id} className="hm-workspace-pane" role="tabpanel" id={workspaceDOMId(dockPrefix,tab.id,'panel')} aria-labelledby={workspaceDOMId(dockPrefix,tab.id,'tab')} hidden={tab.id!==workspace.activeId||!!tab.owned&&tab.sessionId!==sessionId} tabIndex={0}>{tab.kind==='view'&&tab.viewId?<SnapshotView sessionId={tab.owned?tab.sessionId??'':sessionId??''} viewId={tab.viewId} owned={tab.owned}/>:<HallmarkWorkbench sessionId={sessionId} bridge={bridge} embedded initialTab={tab.kind==='draft'?'builder':'common'} onEnterChat={sessionId&&onReturn?()=>{clickIntent.cancel();void startChat('hallmark');}:undefined} onOpenView={view=>dispatchWorkspace({type:'open-view',appId:tab.appId,...view})}/>}</section>)}</div>:null}{app?.id!=='hallmark'?(managing?<section className="hm-app-management"><div className="hm-section-heading"><h3>已接入应用</h3><span className="hm-muted">{APPLICATIONS.length} 个应用</span></div><div className="hm-management-list">{APPLICATIONS.map(definition=><article className="hm-management-app" key={definition.id}><span className="hm-app-letter" aria-hidden="true">{definition.name.slice(0,1)}</span><div className="hm-management-copy"><h3>{definition.name}</h3><p className="hm-muted">{definition.description}</p></div><div className="hm-actions"><button type="button" onClick={()=>openApp(definition.id,0)}>打开工作台<AppIcon name="arrow-up-right" size={15}/></button>{sessionId&&chatState?.active?<button type="button" disabled={busy} onClick={()=>void closeChat(definition.id)}>关闭当前聊天应用</button>:null}</div></article>)}</div></section>:<div className="hm-page-placeholder"><span className="hm-empty-mark" aria-hidden="true"><AppIcon name="apps" size={36}/></span><EmptyView message="选择应用进入工作台" detail="从左侧打开 Hallmark，查看店铺数据、常用组件与已保存的设计。"/></div>):null}</main>
    </div>
  </section>;
}
