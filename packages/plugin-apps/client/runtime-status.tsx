import React,{useEffect,useState} from 'react';
import {appsResource} from './api.ts';

/** What the Host's health monitor reports (cached in the Host; reading it never calls the Runtime). */
export interface RuntimeHealthView {state:'unknown'|'healthy'|'degraded'|'down';recovering?:boolean;restart?:{enabled:boolean;restarting?:boolean}}
export function runtimeNotice(health:RuntimeHealthView|undefined):{title:string;detail:string}|undefined {
  if(!health||health.state==='healthy'||health.state==='unknown')return undefined;
  if(health.state==='down'){
    if(health.restart?.enabled&&health.restart.restarting)return {title:'Runtime 重启中…',detail:'数据暂时无法读取，恢复后会自动重试，已显示的内容不受影响。'};
    return {title:'Runtime 恢复中…',detail:'正在等待数据服务恢复，已显示的内容会保留，恢复后自动重试读取。'};
  }
  return {title:'Runtime 响应较慢',detail:'数据服务正忙，读取可能稍有延迟。'};
}
/** Polls only while `active`: every 15 s when healthy, every 4 s while not. A failed poll changes nothing. */
export function useRuntimeHealth(active:boolean,recoveryPending=false):RuntimeHealthView|undefined {
  const [health,setHealth]=useState<RuntimeHealthView>();
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,current:RuntimeHealthView|undefined;
    const poll=async()=>{
      try{current=await appsResource<RuntimeHealthView>('runtimeHealth',{},controller.signal);if(!controller.signal.aborted)setHealth(current);}catch{/* the Host itself is unreachable or older: keep the last known state */}
      if(!controller.signal.aborted)timer=setTimeout(()=>void poll(),recoveryPending?1000:current&&current.state!=='healthy'&&current.state!=='unknown'?4000:15000);
    };
    void poll();
    return()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[active,recoveryPending]);
  return active?health:undefined;
}
export function RuntimeRecoveryNotice({active}:{active:boolean}) {
  const notice=runtimeNotice(useRuntimeHealth(active));
  return notice?<div className="apps-sidebar-preparing" role="status" data-runtime-state="recovering"><span className="apps-sidebar-breath" aria-hidden="true"/><div><strong>{notice.title}</strong><p>{notice.detail}</p></div></div>:null;
}
