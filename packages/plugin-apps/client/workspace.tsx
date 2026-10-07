import React,{useEffect,useRef,useState} from 'react';
import {AppsDirectory} from './directory.tsx';
import {AppsNativeView} from './view.tsx';
import {observeCurrentSession,type SessionSnapshot} from '../../dsh-plugin/client/session-selection.ts';
import {ownedWorkspaceIntent,type OwnedWorkspaceIntent} from '../../dsh-plugin/client/workspace-intent.ts';
export function AppsWorkspace(props:{useSessions?:(selector:(state:SessionSnapshot)=>string|undefined)=>string|undefined;currentSessionId?:string;onReturn?:(sessionId:string)=>void}){
  const sessionId=props.useSessions?props.useSessions(observeCurrentSession):props.currentSessionId;
  const [opened,setOpened]=useState<OwnedWorkspaceIntent>(),[notice,setNotice]=useState(''),owner=useRef(sessionId);owner.current=sessionId;
  useEffect(()=>{setOpened(current=>current?.sessionId===sessionId?current:undefined);const receive=()=>{const intent=ownedWorkspaceIntent.take();if(!intent)return;if(intent.sessionId!==owner.current){setNotice('会话已切换，请切回组件所属聊天后重新打开。');return;}setOpened(intent);setNotice('');};const dispose=ownedWorkspaceIntent.subscribe(receive);receive();return dispose;},[sessionId]);
  const current=opened?.sessionId===sessionId?opened:undefined;
  return current?<main style={{padding:24}}><header style={{display:'flex',gap:12,marginBottom:16}}><button onClick={()=>setOpened(undefined)}>返回 Apps 目录</button>{props.onReturn?<button onClick={()=>props.onReturn!(current.sessionId)}>返回当前聊天</button>:null}</header><AppsNativeView sessionId={current.sessionId} viewId={current.viewId}/></main>:<>{notice?<p role="status">{notice}</p>:null}<AppsDirectory {...props}/></>;
}
