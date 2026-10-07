import React, {useEffect, useRef, useState} from 'react';
import {observeCurrentSession, type SessionSnapshot} from '../../dsh-plugin/client/session-selection.ts';
interface AppRow {appId: string;displayName: string;runtimeState: string;hostProjectionState: string}
interface ConnectionRow {appId: string;connectionId: string;displayName: string;enabled: boolean}
interface BindingRow {appId: string;connectionId: string;enabled: boolean;sessionId: string}
interface DiagnosticRow {invocationId: string;traceId: string;operationId: string | null;runId: string | null;appId: string;connectionId: string;capabilityId: string;capabilityVersion: string;status: string;durationMs: number | null}
async function api(resource: string, signal?: AbortSignal) {const response = await fetch(`/api/dsh-apps?${resource}`, {signal});const value: unknown = await response.json();if (!response.ok) throw new Error('Apps目录暂不可用。');return value;}
export function AppsDirectory({useSessions,currentSessionId,onReturn}: {useSessions?: (selector: (state: SessionSnapshot) => string | undefined) => string | undefined;currentSessionId?: string;onReturn?: (sessionId: string) => void}) {
  const sessionId = useSessions ? useSessions(observeCurrentSession) : currentSessionId;
  const [apps,setApps] = useState<AppRow[]>([]), [connections,setConnections] = useState<ConnectionRow[]>([]), [bindings,setBindings] = useState<BindingRow[]>([]);
  const [selected,setSelected] = useState<string>(), [error,setError] = useState(''), [busy,setBusy] = useState(false), [refresh,setRefresh] = useState(0);
  const [diagnostics,setDiagnostics] = useState<DiagnosticRow[]>([]), [diagnosticNotice,setDiagnosticNotice] = useState('');
  const liveSession = useRef(sessionId);liveSession.current = sessionId;
  useEffect(() => {const controller = new AbortController();setError('');
    Promise.all([api('resource=apps',controller.signal), api('resource=connections',controller.signal), sessionId ? api(`resource=bindings&sessionId=${encodeURIComponent(sessionId)}`,controller.signal) : Promise.resolve([])]).then(([directory,available,active]) => {
      if (controller.signal.aborted) return;
      setApps((directory as {apps: AppRow[]}).apps);setConnections(available as ConnectionRow[]);setBindings(active as BindingRow[]);
    }).catch(() => {if (!controller.signal.aborted) setError('Apps Runtime目录不可用，请检查已配置连接。');});
    return () => controller.abort();
  },[sessionId,refresh]);
  useEffect(() => {setDiagnostics([]);setDiagnosticNotice('');if (!sessionId) return;const controller = new AbortController();
    api(`resource=diagnostics&sessionId=${encodeURIComponent(sessionId)}`,controller.signal).then(value => {if (!controller.signal.aborted) setDiagnostics((value as {invocations?: DiagnosticRow[]}).invocations ?? []);}).catch(() => {if (!controller.signal.aborted) setDiagnosticNotice('此会话调用记录暂不可用。');});
    return () => controller.abort();
  },[sessionId,refresh]);
  const copyDiagnostic = async (row: DiagnosticRow) => {const detail = JSON.stringify({invocationId: row.invocationId,traceId: row.traceId,operationId: row.operationId,runId: row.runId,appId: row.appId,connectionId: row.connectionId,capabilityId: row.capabilityId,capabilityVersion: row.capabilityVersion},null,2);try {await navigator.clipboard.writeText(detail);setDiagnosticNotice('调用诊断标识已复制。');} catch {setDiagnosticNotice('请从下方调用标识选择文字并复制。');}};
  const bind = async (connection: ConnectionRow, enabled: boolean) => {
    if (!sessionId || busy) return;
    const owner = sessionId;setBusy(true);setError('');
    try {const response = await fetch('/api/dsh-apps', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'bind', sessionId: owner, appId: connection.appId, connectionId: connection.connectionId, enabled})});const value = await response.json() as {status?: string;error?: {message?: string}};
      if (!response.ok || value.status === 'failed') throw new Error(value.error?.message ?? '连接绑定未确认。');
      if (liveSession.current === owner) setRefresh(value => value + 1);
    } catch (cause) {if (liveSession.current === owner) setError(cause instanceof Error ? cause.message : '绑定失败。');} finally {setBusy(false);}
  };
  const visible = selected ? connections.filter(connection => connection.appId === selected) : connections;
  return <main style={{padding: 24, maxWidth: 1080, margin: '0 auto', color: 'inherit', fontFamily: 'system-ui, sans-serif'}}>
    <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16}}><div><h1 style={{fontSize: 26, marginBottom: 6}}>Apps</h1><p>选择应用与明确连接，在当前原生聊天中组合使用。</p></div>{sessionId && onReturn ? <button onClick={() => onReturn(sessionId)}>返回当前聊天</button> : null}</header>
    <p>当前会话：{sessionId ?? '请先打开已有聊天'} · 固定发现网关</p>
    {error ? <p role="alert">{error}</p> : null}
    <nav aria-label="应用" style={{display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0'}}>
      <button aria-pressed={!selected} onClick={() => setSelected(undefined)}>全部应用</button>
      {apps.map(app => <button key={app.appId} aria-pressed={selected === app.appId} onClick={() => setSelected(app.appId)} style={{minWidth: 160, padding: 16, textAlign: 'left'}}><strong>{app.displayName}</strong><small style={{display: 'block', marginTop: 8}}>{app.runtimeState} · {app.hostProjectionState}</small></button>)}
    </nav>
    <h2 style={{fontSize: 19}}>连接</h2>
    {visible.length ? <ul style={{listStyle: 'none', padding: 0, display: 'grid', gap: 12}}>{visible.map(connection => {const enabled = bindings.some(binding => binding.sessionId === sessionId && binding.appId === connection.appId && binding.connectionId === connection.connectionId && binding.enabled);return <li key={`${connection.appId}:${connection.connectionId}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 16, border: '1px solid #8885', borderRadius: 10}}><div><strong>{connection.displayName}</strong><small style={{display: 'block', marginTop: 4}}>{connection.appId} / {connection.connectionId}</small></div><button disabled={!sessionId || busy || !connection.enabled} onClick={() => void bind(connection,!enabled)}>{enabled ? '在此会话停用' : '在此会话启用'}</button></li>;})}</ul> : <p>此应用暂无已配置连接。</p>}
    <p style={{marginTop: 24}}>应用焦点只影响工作台显示。当前会话可同时启用多个应用和连接；调用范围以明确的应用与连接身份为准。</p>
    <section aria-label="当前会话调用记录" style={{marginTop: 32}}><div style={{display: 'flex',justifyContent: 'space-between',alignItems: 'center'}}><h2 style={{fontSize: 19}}>当前会话调用记录</h2><button disabled={!sessionId} onClick={() => setRefresh(value => value + 1)}>刷新记录</button></div>{diagnosticNotice ? <p role="status">{diagnosticNotice}</p> : null}
      {diagnostics.length ? <ul style={{listStyle: 'none',padding: 0,display: 'grid',gap: 12}}>{diagnostics.map(row => <li key={row.invocationId} style={{padding: 16,border: '1px solid #8885',borderRadius: 10,overflowWrap: 'anywhere'}}><strong>{row.appId} / {row.connectionId} · {row.capabilityId} @ {row.capabilityVersion}</strong><p>{row.status} · {row.durationMs ?? '—'} ms</p><div>invocationId: <code>{row.invocationId}</code></div><div>traceId: <code>{row.traceId}</code></div>{row.operationId ? <div>operationId: <code>{row.operationId}</code></div> : null}{row.runId ? <div>runId: <code>{row.runId}</code></div> : null}<button style={{marginTop: 12}} onClick={() => void copyDiagnostic(row)}>复制诊断标识</button></li>)}</ul> : <p>当前会话暂无调用记录。</p>}
    </section>
  </main>;
}
