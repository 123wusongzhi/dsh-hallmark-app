import React, {useEffect, useRef, useState} from 'react';
import {observeCurrentSession, type SessionSnapshot} from '../../dsh-plugin/client/session-selection.ts';
import {AppsLibrary} from './library.tsx';
import {AppsAppMark,AppsIcon} from './ui.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import type {AppsView} from '../../app-presentation/src/types.ts';
interface AppRow {appId:string;displayName:string;runtimeState:string;hostProjectionState:string;description?:string}
interface ConnectionRow {appId:string;connectionId:string;displayName:string;enabled:boolean}
interface BindingRow {appId:string;connectionId:string;enabled:boolean;sessionId:string}
interface DiagnosticRow {invocationId:string;traceId:string;operationId:string|null;runId:string|null;appId:string;connectionId:string;capabilityId:string;capabilityVersion:string;status:string;durationMs:number|null}
async function api(resource:string,signal?:AbortSignal) {const response=await fetch(`/api/dsh-apps?${resource}`,{signal});const value:unknown=await response.json();if(!response.ok)throw new Error('应用列表暂不可用。');return value;}
const description=(app:AppRow)=>app.description??(app.appId==='hallmark'?'店铺数据与日常运营':app.appId==='notes'?'笔记与资料管理':'已接入应用');
interface DirectoryProps {
  useSessions?:(selector:(state:SessionSnapshot)=>string|undefined)=>string|undefined;
  currentSessionId?:string;
  onReturn?:(sessionId:string)=>void;
  onOpenView?:(view:AppsView)=>void;
  onCreate?:()=>void;
  creationDisabled?:boolean;
  onRefreshViews?:()=>void;
  summaryRefreshKey?:number;
  navigation?:React.ReactNode;
  children?:React.ReactNode;
}
export function AppsDirectory({useSessions,currentSessionId,onReturn,onOpenView,onCreate,creationDisabled,onRefreshViews,summaryRefreshKey=0,navigation,children}:DirectoryProps) {
  const sessionId=useSessions?useSessions(observeCurrentSession):currentSessionId;
  const [apps,setApps]=useState<AppRow[]>([]),[connections,setConnections]=useState<ConnectionRow[]>([]),[bindings,setBindings]=useState<BindingRow[]>([]);
  const [selected,setSelected]=useState<string>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  const [query,setQuery]=useState(''),[management,setManagement]=useState(false);
  const [diagnostics,setDiagnostics]=useState<DiagnosticRow[]>([]),[diagnosticNotice,setDiagnosticNotice]=useState('');
  const liveSession=useRef(sessionId);liveSession.current=sessionId;
  useEffect(()=>{const controller=new AbortController();setError('');setLoading(true);
    Promise.all([api('resource=apps',controller.signal),api('resource=connections',controller.signal),sessionId?api(`resource=bindings&sessionId=${encodeURIComponent(sessionId)}`,controller.signal):Promise.resolve([])]).then(([directory,available,active])=>{
      if(controller.signal.aborted)return;
      setApps((directory as {apps:AppRow[]}).apps);setConnections(available as ConnectionRow[]);setBindings(active as BindingRow[]);
    }).catch(()=>{if(!controller.signal.aborted)setError('应用列表暂时无法读取，请刷新重试或查看连接设置。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[sessionId,refresh,summaryRefreshKey]);
  useEffect(()=>{setDiagnostics([]);setDiagnosticNotice('');if(!sessionId)return;const controller=new AbortController();
    api(`resource=diagnostics&sessionId=${encodeURIComponent(sessionId)}`,controller.signal).then(value=>{if(!controller.signal.aborted)setDiagnostics((value as {invocations?:DiagnosticRow[]}).invocations??[]);}).catch(()=>{if(!controller.signal.aborted)setDiagnosticNotice('此会话调用记录暂不可用。');});
    return()=>controller.abort();
  },[sessionId,refresh]);
  const copyDiagnostic=async(row:DiagnosticRow)=>{const detail=JSON.stringify({invocationId:row.invocationId,traceId:row.traceId,operationId:row.operationId,runId:row.runId,appId:row.appId,connectionId:row.connectionId,capabilityId:row.capabilityId,capabilityVersion:row.capabilityVersion},null,2);try{await navigator.clipboard.writeText(detail);setDiagnosticNotice('调用诊断标识已复制。');}catch{setDiagnosticNotice('请从下方调用标识选择文字并复制。');}};
  const bind=async(connection:ConnectionRow,enabled:boolean)=>{
    if(!sessionId||busy)return;
    const owner=sessionId;setBusy(true);setError('');
    try{const response=await fetch('/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bind',sessionId:owner,appId:connection.appId,connectionId:connection.connectionId,enabled})});const value=await response.json() as {status?:string;error?:{message?:string}};
      if(!response.ok||value.status==='failed')throw new Error(value.error?.message??'连接启用尚未确认。');
      if(liveSession.current===owner)setRefresh(value=>value+1);
    }catch(cause){if(liveSession.current===owner)setError(cause instanceof Error?cause.message:'连接启用失败。');}finally{setBusy(false);}
  };
  const businessApps=apps.filter(app=>app.appId!=='apps');
  const current=businessApps.find(app=>app.appId===selected)??businessApps.find(app=>app.appId==='hallmark')??businessApps[0];
  const matches=businessApps.filter(app=>`${app.appId} ${app.displayName} ${description(app)}`.normalize('NFKC').toLocaleLowerCase().includes(query.normalize('NFKC').toLocaleLowerCase()));
  const visible=connections.filter(connection=>connection.appId===current?.appId);
  const enabled=(connection:ConnectionRow)=>bindings.some(binding=>binding.sessionId===sessionId&&binding.appId===connection.appId&&binding.connectionId===connection.connectionId&&binding.enabled);
  const active=visible.some(connection=>connection.enabled&&enabled(connection));
  const providerUnavailable=!!current&&['unavailable','stopped','stopping'].includes(current.runtimeState);
  const status=error?'状态待确认':loading?'正在读取':!current?'未选择应用':providerUnavailable?'应用暂不可用':current.runtimeState==='registered'?'应用准备中':current.runtimeState==='degraded'?'应用状态受限':active?'当前聊天已启用':visible.some(connection=>connection.enabled)?'尚未在当前聊天启用':'暂无可用连接';
  const refreshLists=()=>{setRefresh(value=>value+1);onRefreshViews?.();};
  const connectionList=(rows:ConnectionRow[])=>rows.length?<ul className="apps-connection-list">{rows.map(connection=><li key={`${connection.appId}:${connection.connectionId}`}><div><strong>{connection.displayName}</strong><span>{!connection.enabled?'连接已停用':enabled(connection)?'当前聊天已启用':'可在当前聊天启用'}</span></div><button disabled={!sessionId||busy||!connection.enabled} onClick={()=>void bind(connection,!enabled(connection))}>{enabled(connection)?'在此会话停用':'在此会话启用'}</button></li>)}</ul>:<div className="apps-empty-inline">此应用暂无已配置连接。</div>;
  return <div className="apps-directory apps-workspace"><style>{APPS_WORKSPACE_STYLES}</style>
    <aside className="apps-rail" aria-label="应用列表">
      <div className="apps-rail-heading"><h1>应用</h1>{onCreate?<button className="apps-icon-button" aria-label="新建组件工作副本" title="新建组件工作副本" disabled={creationDisabled} onClick={onCreate}><AppsIcon name="plus"/></button>:null}</div>
      <label className="apps-search"><AppsIcon name="search"/><input aria-label="搜索应用" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索应用"/></label>
      <p className="apps-rail-caption">全部应用</p>
      <nav aria-label="应用" className="apps-app-list">{matches.map(app=><button key={app.appId} className="apps-app-row" aria-pressed={current?.appId===app.appId} onClick={()=>setSelected(app.appId)}><AppsAppMark appId={app.appId}/><span><strong>{app.displayName}</strong><small>{description(app)}</small></span>{['unavailable','stopped','stopping'].includes(app.runtimeState)?<span className="apps-badge is-muted">不可用</span>:app.runtimeState==='degraded'?<span className="apps-badge is-muted">受限</span>:null}</button>)}</nav>
      {!matches.length?<p className="apps-rail-empty">{loading?'正在读取应用…':query?'没有匹配的应用':'暂无已接入应用'}</p>:null}
      <button className="apps-manage-button" aria-pressed={management} onClick={()=>setManagement(value=>!value)}><AppsIcon name="settings"/>管理应用</button>
    </aside>
    <section className="apps-main" aria-label="应用工作区">
      {navigation}
      <header className="apps-brand-header"><div className="apps-brand"><AppsAppMark appId={current?.appId} large/><div><h2>{current?.displayName??'应用工作台'}</h2><p>{current?description(current):'选择应用，查看组件与连接'}</p></div><span className={`apps-connection-status${active&&!error&&!loading&&current?.runtimeState==='ready'?' is-enabled':''}${error||providerUnavailable||current?.runtimeState==='degraded'?' is-warning':''}`}><i/>{status}</span></div><div className="apps-header-actions"><button onClick={refreshLists} disabled={loading} className="apps-refresh-button">刷新列表</button>{sessionId&&onReturn?<button className="apps-primary" onClick={()=>onReturn(sessionId)}>返回当前聊天</button>:null}</div></header>
      <div className="apps-main-scroll">
        {error?<p className="apps-notice is-error" role="alert">{error}</p>:null}
        {management?<section className="apps-panel apps-connection-settings" aria-label="连接设置"><div className="apps-section-heading"><div><h3>连接设置</h3><p>选择应用只切换工作台。在任意原聊天输入 @，也可以直接引用应用。</p></div><button onClick={()=>setManagement(false)}>收起设置</button></div>{connectionList(visible)}{!sessionId?<p className="apps-muted">请先打开已有聊天，再启用连接。</p>:null}</section>:null}
        {children??<><div className="apps-workbench-intro"><div><h2>组件库</h2><p>保存常用组件，随时在当前聊天打开和继续编辑。</p></div>{onCreate?<button className="apps-primary" disabled={creationDisabled} onClick={onCreate}>新建组件工作副本</button>:null}</div><AppsLibrary sessionId={sessionId} onOpenView={onOpenView} refreshKey={refresh}/></>}
        <details className="apps-diagnostics"><summary>连接与调用诊断</summary><div className="apps-diagnostics-content"><p className="apps-muted">当前会话：<span>{sessionId??'请先打开已有聊天'}</span> · 固定发现网关</p><h3>当前应用连接</h3>{connectionList(visible)}<details><summary>应用与内部创作服务</summary><ul className="apps-diagnostic-catalog">{apps.map(app=><li key={app.appId}><strong>{app.displayName}</strong><span>{app.appId} · {app.runtimeState} · {app.hostProjectionState}</span></li>)}</ul>{connectionList(connections.filter(connection=>connection.appId==='apps'))}</details><section aria-label="当前会话调用记录"><div className="apps-section-heading"><h3>当前会话调用记录</h3><button disabled={!sessionId} onClick={refreshLists}>刷新记录</button></div>{diagnosticNotice?<p role="status">{diagnosticNotice}</p>:null}{diagnostics.length?<ul className="apps-diagnostic-list">{diagnostics.map(row=><li key={row.invocationId}><strong>{row.appId} / {row.connectionId} · {row.capabilityId} @ {row.capabilityVersion}</strong><p>{row.status} · {row.durationMs??'—'} ms</p><div>invocationId: <code>{row.invocationId}</code></div><div>traceId: <code>{row.traceId}</code></div>{row.operationId?<div>operationId: <code>{row.operationId}</code></div>:null}{row.runId?<div>runId: <code>{row.runId}</code></div>:null}<button onClick={()=>void copyDiagnostic(row)}>复制诊断标识</button></li>)}</ul>:<p>当前会话暂无调用记录。</p>}</section></div></details>
      </div>
    </section>
  </div>;
}
