import React,{useEffect,useRef,useState} from 'react';
import {appsApiError,appsResource} from './api.ts';
import type {ConnectionStatus} from '../src/connection-status.ts';

const labels={connected:'已连接',degraded:'连接异常',disconnected:'节点未连接',unknown:'状态未确认'};
const nodes={healthy:'正常',degraded:'响应异常',down:'无法连接',unknown:'未确认'};
export function ConnectionStatusPanel({active}:{active:boolean}) {
  const [status,setStatus]=useState<ConnectionStatus>(),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const flight=useRef(false),controller=useRef<AbortController>();
  async function check(restart=false){
    if(flight.current)return;flight.current=true;
    const current=new AbortController();controller.current=current;
    setBusy(restart?'正在重启并复查…':'正在检查…');setError('');
    try{
      let result:ConnectionStatus;
      if(restart){
        const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restartRuntime'}),signal:current.signal});
        const value=await response.json();if(!response.ok)throw appsApiError(value,response.status,'重启未完成。');result=value;
      }else result=await appsResource<ConnectionStatus>('connectionStatus',{},current.signal);
      if(!current.signal.aborted)setStatus(result);
    }catch(cause){if(!current.signal.aborted){setStatus(previous=>previous?{...previous,state:'unknown',node:{state:'unknown'},data:{state:'unknown',message:'请重新检查。'}}:undefined);setError(cause instanceof Error?cause.message:'检查未完成。');}}
    finally{if(controller.current===current){flight.current=false;if(!current.signal.aborted)setBusy('');}}
  }
  useEffect(()=>{if(active)void check();return()=>{controller.current?.abort();controller.current=undefined;flight.current=false;};},[active]);
  return <section aria-label="节点连接状态" style={{padding:'12px 16px',borderBottom:'1px solid #dce3ed',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
    <div role="status" aria-live="polite" style={{flex:1,minWidth:200}}>
      <strong>{busy|| (status?labels[status.state]:'状态未确认')}</strong>
      {status&&<div style={{fontSize:12,marginTop:4}}>应用服务节点：{nodes[status.node.state]} · Hallmark 数据接口：{status.data.message}<br/>{'lastError' in status.node&&status.node.lastError?<span>{status.node.lastError.message}<br/></span>:null}检查时间：{new Date(status.checkedAt).toLocaleString()}</div>}
      {error&&<div role="alert">{error}</div>}
      {status&&!status.canRestart&&<div style={{fontSize:12}}>此节点未配置受管理的重启方式。</div>}
    </div>
    <button type="button" disabled={!!busy} onClick={()=>void check()}>检查连接</button>
    <button type="button" disabled={!!busy||!status?.canRestart} onClick={()=>void check(true)}>一键修复（重启）</button>
  </section>;
}
