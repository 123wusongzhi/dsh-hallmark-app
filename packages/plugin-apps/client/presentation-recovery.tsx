import React,{useRef,useState} from 'react';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import {appsPresentation,inspectPresentation,unconfirmedPresentation,type UnconfirmedPresentation} from './api.ts';

interface PendingAction extends UnconfirmedPresentation {complete:(value:unknown)=>void}
/** One explicit click owns one request ID until its original receipt is known. */
export function usePresentationRecovery(){
  const [pending,setPending]=useState<PendingAction>(),[inspecting,setInspecting]=useState(false),inFlight=useRef(false),original=useRef<PendingAction>();
  const run=async<T,>(sessionId:string,capabilityId:string,input:JsonValue,complete:(value:T)=>void)=>{
    if(inFlight.current||original.current)throw new Error('原界面动作尚未确认，请先检查原调用。');inFlight.current=true;
    try{const value=await appsPresentation<T>(sessionId,capabilityId,input);complete(value);}catch(error){const identity=unconfirmedPresentation(error);if(identity){original.current={...identity,complete:value=>complete(value as T)};setPending(original.current);}throw error;}finally{inFlight.current=false;}
  };
  const inspect=async()=>{const action=original.current;if(!action||inFlight.current)return false;inFlight.current=true;setInspecting(true);
    try{const receipt=await inspectPresentation(action);if(!receipt.settled)return false;original.current=undefined;setPending(undefined);if(receipt.error)throw receipt.error;action.complete(receipt.value);return true;}finally{inFlight.current=false;setInspecting(false);}
  };
  return {run,inspect,pending,inspecting};
}
export function PresentationRecovery({pending,inspecting,onInspect}:{pending?:UnconfirmedPresentation;inspecting:boolean;onInspect:()=>void}){
  return pending?<aside role="status"><p>原调用 {pending.requestId}（会话 {pending.sessionId}）回执未确认，重复操作保持关闭。</p><button disabled={inspecting} onClick={onInspect}>{inspecting?'正在只读检查…':'检查原调用'}</button></aside>:null;
}
