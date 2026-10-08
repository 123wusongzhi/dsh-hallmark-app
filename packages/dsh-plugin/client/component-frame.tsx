import React,{useEffect,useRef,useState} from 'react';
import type {BridgeIdentity,JsonValue} from '../../app-contracts/src/index.ts';
import {COMPONENT_CHANNEL} from '../../component-runtime/src/apps-client.ts';
import {ComponentHost} from '../../component-runtime/src/host.ts';
import type {ComponentHostHandlers,ComponentExtensionHandlers} from '../../component-runtime/src/host.ts';
export interface ExtendedComponentHandlers extends ComponentHostHandlers {extensions?:ComponentExtensionHandlers;authorizeFrame?:(identity:BridgeIdentity,documentNonce:string,clientFeatures:string[])=>Promise<string[]>;retireFrame?:(identity:BridgeIdentity,documentNonce:string)=>Promise<void>|void}
export interface ComponentFrameError {phase:string;code:string;message:string}

function frameId():string {return globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
export type {ComponentHandlerFactory} from './component-handlers.ts';
export {configureComponentHandlers,configuredComponentHandlers} from './component-handlers.ts';
/** The initial hello binds a single iframe document; reloaded documents dispose all old work. */
export function useComponentBridge(frame:React.RefObject<HTMLIFrameElement>,identity:Omit<BridgeIdentity,'protocolVersion'|'frameInstanceId'>,handlers:ExtendedComponentHandlers,data:JsonValue|undefined,context:JsonValue|undefined,enabled=true,onFrameError?:(problem:ComponentFrameError)=>void):void {
  const state=useRef<{host:ComponentHost;documentNonce:string;window:Window;retireFrame?:ExtendedComponentHandlers['retireFrame']}>();
  const live=useRef({handlers,data,context,onFrameError});live.current={handlers,data,context,onFrameError};
  const owner=JSON.stringify([identity.sessionId,identity.viewId,identity.buildId]);
  useEffect(()=>{
    if(!enabled)return;
    const currentFrame=frame.current;let active=true;let requestedNonce:string|undefined;
    const report=(problem:ComponentFrameError)=>{if(active)live.current.onFrameError?.({...problem,message:problem.message.slice(0,512)});};
    // This bounds actual loading after a click, never the time a prepared card waits.
    const startupTimer=onFrameError?setTimeout(()=>report({phase:state.current?'readiness':'handshake',code:state.current?'DISPLAY_READY_TIMEOUT':'DISPLAY_BRIDGE_TIMEOUT',message:state.current?'组件未完成实际加载确认，请重新打开或让 Agent 检查。':'组件未建立连接，请重新打开或让 Agent 检查加载错误。'}),30000):undefined;
    const handshakes=new Map<string,{promise:Promise<void>;host:ComponentHost}>(),retiredNonces=new Set<string>();
    const receive=async(event:MessageEvent)=>{
      if(event.source!==currentFrame?.contentWindow||event.origin!==window.location.origin||event.data?.channel!==COMPONENT_CHANNEL)return;
      const message=event.data;
      if(message.type==='display-error'){
        const current=state.current;
        if(typeof message.documentNonce!=='string'||!message.documentNonce||(current?message.documentNonce!==current.documentNonce:requestedNonce!==message.documentNonce))return;
        if(current&&['protocolVersion','sessionId','viewId','buildId','frameInstanceId'].some(key=>message[key]!==current.host.identity[key as keyof BridgeIdentity]))return;
        const problem=message.error;if(!problem||typeof problem.phase!=='string'||typeof problem.code!=='string'||typeof problem.message!=='string')return;
        report({phase:problem.phase.slice(0,64),code:problem.code.slice(0,128),message:problem.message});return;
      }
      if(message.type==='hello'&&typeof message.documentNonce==='string'&&message.documentNonce){
        if(retiredNonces.has(message.documentNonce))return;
        if(!state.current||state.current.documentNonce!==message.documentNonce){
          const pending=handshakes.get(message.documentNonce);
          if(pending){const response=await pending.host.handle(message);if(!response||!('type' in response)||response.type!=='hello'){if(active&&response&&currentFrame.contentWindow)currentFrame.contentWindow.postMessage(response,window.location.origin);return;}await pending.promise;const ready=state.current;if(active&&ready&&requestedNonce===message.documentNonce&&ready.documentNonce===message.documentNonce&&currentFrame.contentWindow===ready.window)ready.window.postMessage(ready.host.hello(message.requestId),window.location.origin);return;}
          const nonce=message.documentNonce;
          const frameHandlers=live.current.handlers;
          const delegate={} as ComponentHostHandlers;
          for(const method of ['getData','getContext','refresh','attachSelection','resize','invokeCapability','updateContext','requestAgent'] as const)if(typeof live.current.handlers[method]==='function')delegate[method]=request=>live.current.handlers[method]!(request);
          const candidate=new ComponentHost({...identity,protocolVersion:'2.0',frameInstanceId:frameId()},delegate,{extensionHandlers:frameHandlers.extensions});
          const handshake=(async()=>{let response=await candidate.handle(message);
          if(!active){candidate.dispose();return;}
          // Invalid handshakes cannot retire a working frame or change its identity.
          if(!response||!('type' in response)||response.type!=='hello'){
            candidate.dispose();if(response&&currentFrame.contentWindow)currentFrame.contentWindow.postMessage(response,window.location.origin);return;
          }
          requestedNonce=nonce;
          try{const features=await frameHandlers.authorizeFrame?.(candidate.identity,nonce,Array.isArray(message.clientFeatures)?message.clientFeatures:[]);if(features)response=await candidate.handle({...message,clientFeatures:features});}catch(error){retiredNonces.add(nonce);void Promise.resolve(frameHandlers.retireFrame?.(candidate.identity,nonce)).catch(()=>{});candidate.dispose();if(active&&requestedNonce===nonce&&currentFrame.contentWindow){report({phase:'authorization',code:String((error as {code?:string}).code??'FRAME_AUTHORIZATION_FAILED'),message:error instanceof Error?error.message:String(error)});currentFrame.contentWindow.postMessage({...candidate.identity,channel:COMPONENT_CHANNEL,requestId:message.requestId,error:{code:'FRAME_AUTHORIZATION_FAILED',message:error instanceof Error?error.message:String(error),retryPolicy:'never'}},window.location.origin);}return;}
          if(!active||requestedNonce!==nonce){void Promise.resolve(frameHandlers.retireFrame?.(candidate.identity,nonce)).catch(()=>{});candidate.dispose();return;}
          if(retiredNonces.has(message.documentNonce)){void Promise.resolve(frameHandlers.retireFrame?.(candidate.identity,message.documentNonce)).catch(()=>{});candidate.dispose();return;}
          const existing=state.current;
          if(existing&&existing.documentNonce===message.documentNonce){void Promise.resolve(frameHandlers.retireFrame?.(candidate.identity,message.documentNonce)).catch(()=>{});candidate.dispose();existing.window.postMessage(existing.host.hello(message.requestId),window.location.origin);return;}
          if(state.current){retiredNonces.add(state.current.documentNonce);void Promise.resolve(state.current.retireFrame?.(state.current.host.identity,state.current.documentNonce)).catch(()=>{});state.current.host.dispose();}
          state.current={host:candidate,documentNonce:message.documentNonce,window:currentFrame.contentWindow!,retireFrame:frameHandlers.retireFrame};
          state.current.window.postMessage(response,window.location.origin);
          })();handshakes.set(nonce,{promise:handshake,host:candidate});
          try{await handshake;}finally{if(handshakes.get(nonce)?.promise===handshake)handshakes.delete(nonce);}return;
        }
        if(requestedNonce!==undefined&&requestedNonce!==message.documentNonce)return;
      }
      const entry=state.current;if(!entry)return;
      const response=await entry.host.handle(message);
      if(message.type==='extension'&&message.feature==='renderReadyV1'&&response&&'result' in response&&startupTimer!==undefined)clearTimeout(startupTimer);
      if(response&&state.current===entry&&currentFrame.contentWindow===entry.window)entry.window.postMessage(response,window.location.origin);
    };
    window.addEventListener('message',receive);
    return()=>{active=false;if(startupTimer!==undefined)clearTimeout(startupTimer);window.removeEventListener('message',receive);const previous=state.current;if(previous){void Promise.resolve(previous.retireFrame?.(previous.host.identity,previous.documentNonce)).catch(()=>{});previous.host.dispose();}state.current=undefined;retiredNonces.clear();};
  },[owner,enabled]);
  useEffect(()=>{const entry=state.current;if(entry&&data!==undefined)entry.window.postMessage(entry.host.event('data',data),window.location.origin);},[data]);
  useEffect(()=>{const entry=state.current;if(entry&&context!==undefined)entry.window.postMessage(entry.host.event('context',context),window.location.origin);},[context]);
}
/** A generic source frame. Handlers use the Apps proxy/Runtime, and never import an application provider. */
export function AppsSourceFrame({sessionId,viewId,buildId,title,url,data,context,handlers,onLoadError,onFrameError,frameKey}:{sessionId:string;viewId:string;buildId:string;title:string;url:string;data:JsonValue;context?:JsonValue;handlers:Omit<ExtendedComponentHandlers,'resize'>;onLoadError?:()=>void;onFrameError?:(problem:ComponentFrameError)=>void;frameKey?:string}) {
  const frame=useRef<HTMLIFrameElement>(null),[height,setHeight]=useState(680),[error,setError]=useState('');
  const detachErrors=useRef<()=>void>(),liveError=useRef(onFrameError);liveError.current=onFrameError;
  const observeDocumentErrors=()=>{
    detachErrors.current?.();detachErrors.current=undefined;if(!liveError.current)return;
    try{const child=frame.current?.contentWindow;if(!child||typeof child.addEventListener!=='function'||child.location.origin!==window.location.origin)return;
      const capture=(event:Event)=>{const item=event as ErrorEvent&PromiseRejectionEvent,reason=item.reason as {name?:string}|undefined;if(reason?.name==='ComponentBridgeError')return;liveError.current?.({phase:'script',code:event.type==='error'?'COMPONENT_SCRIPT_ERROR':'COMPONENT_UNHANDLED_REJECTION',message:String(item.message??item.reason??'Unhandled component error').slice(0,512)});};
      child.addEventListener('error',capture);child.addEventListener('unhandledrejection',capture);detachErrors.current=()=>{child.removeEventListener('error',capture);child.removeEventListener('unhandledrejection',capture);};
    }catch{/* Cross-origin or unavailable documents remain covered by authorization/loading errors. */}
  };
  useEffect(()=>{observeDocumentErrors();return()=>detachErrors.current?.();},[frameKey]);
  useComponentBridge(frame,{sessionId,viewId,buildId},{...handlers,resize:request=>{const height=(request.params as {height?:number}|null)?.height;if(typeof height!=='number'||!Number.isFinite(height)||height<=0||height>20000)throw new Error('Invalid component height.');setHeight(height);return null;}},data,context,true,onFrameError);
  return <div className="hm-source-container">{error?<p role="alert" className="hm-error">{error}</p>:null}<iframe ref={frame} key={frameKey??JSON.stringify([sessionId,viewId,buildId])} src={url} title={title} className="hm-source-frame" style={{display:'block',width:'100%',height,border:0}} onLoad={()=>{setError('');observeDocumentErrors();}} onError={()=>{setError('Component build could not be loaded.');onFrameError?.({phase:'iframe',code:'DISPLAY_DOCUMENT_LOAD_FAILED',message:'Component build could not be loaded.'});onLoadError?.();}}/></div>;
}
