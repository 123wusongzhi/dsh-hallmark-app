import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import {NativeAppsReferences,browserNativeAppsTransport,type NativeAppsInputState} from './native-apps.ts';
interface TriggerRegistry {registerSource(source:NativeAppsReferences['source']):()=>void}
interface NativeContext {get(name:string):unknown;inject?(services:string[],effect:(ctx:NativeContext)=>void|(()=>void)):unknown;effect?(factory:()=>()=>void):unknown}
let active:NativeAppsReferences|undefined;
let lifecycleRevision=0;const lifecycleListeners=new Set<()=>void>();const lifecycle={subscribe:(listener:()=>void)=>{lifecycleListeners.add(listener);return()=>{lifecycleListeners.delete(listener);};},getSnapshot:()=>lifecycleRevision};
const changed=()=>{lifecycleRevision++;for(const listener of lifecycleListeners)listener();};
export function registerNativeApps(ctx:NativeContext):()=>void {
  let manager:NativeAppsReferences|undefined,off:(()=>void)|undefined,closed=false;
  const attach=(scope:NativeContext)=>{const registry=scope.get('inputTriggers') as TriggerRegistry|undefined;if(!registry||typeof registry.registerSource!=='function')return;const register=()=>{manager=new NativeAppsReferences(browserNativeAppsTransport);active=manager;changed();const owner=manager;off=registry.registerSource(owner.source);return()=>{off?.();off=undefined;owner.dispose();if(active===owner){active=undefined;changed();}};};if(scope.effect)scope.effect(register);else register();};
  if(ctx.inject)ctx.inject(['inputTriggers'],scope=>{if(!closed)attach(scope);});else attach(ctx);
  return()=>{closed=true;off?.();manager?.dispose();if(active===manager){active=undefined;changed();}};
}
const empty={subscribe:(_listener:()=>void)=>()=>{},getSnapshot:()=>0};
/** Standard session slot supplies actual useInput projection. It never changes the original draft. */
export function NativeAppsInputObserver({sessionId,input,disabledReason}:{sessionId?:string;input?:unknown;disabledReason?:string}){
  useSyncExternalStore(lifecycle.subscribe,lifecycle.getSnapshot,lifecycle.getSnapshot);
  const manager=active,token=useRef({}).current;
  useSyncExternalStore(manager?.subscribe??empty.subscribe,manager?.getSnapshot??empty.getSnapshot,empty.getSnapshot);
  useEffect(()=>{if(sessionId&&input&&manager)manager.observe(sessionId,input as NativeAppsInputState,token,disabledReason);},[manager,sessionId,input,disabledReason,token]);
  useEffect(()=>()=>{if(sessionId)manager?.release(sessionId,token);},[manager,sessionId,token]);
  const entries=sessionId?manager?.states(sessionId)??[]:[];
  return <span className="hm-root" aria-label="Apps引用绑定">{entries.map(entry=><span key={entry.referenceId} role="status" style={{display:'inline-flex',gap:6,alignItems:'center',margin:4,fontSize:12}}><strong>{entry.label}</strong>{entry.status==='bound'?'可调用':entry.status==='needs_connection'?'请选择连接':entry.status==='failed'?(entry.message??'绑定未确认'):'绑定中'}{entry.status==='needs_connection'?<select aria-label={`${entry.label}连接`} value="" onChange={event=>void manager?.choose(entry.referenceId,event.target.value)}><option value="">选择连接</option>{entry.connections?.map(connection=><option key={connection.connectionId} value={connection.connectionId}>{connection.displayName}</option>)}</select>:null}</span>)}</span>;
}
