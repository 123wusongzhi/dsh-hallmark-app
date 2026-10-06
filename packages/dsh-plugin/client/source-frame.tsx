import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {BindingData,SourceView} from '../../presentation/src/types.ts';
import {SOURCE_CHANNEL} from '../../component-runtime/src/client.ts';
import type {SourceContext} from '../../component-runtime/src/client.ts';
import {handleSourceRequest,isSourceRequest,sourceData,sourceSelection} from './source-bridge.ts';
import {selectionInputBridge} from './selection.ts';
import {readSourceTheme} from './source-theme.ts';

/** Runs the exact registered dist, with its own React/CSS and normal JavaScript state. */
export function SourceFrame({sessionId,spec,data,disabled=false,onRefresh}:{sessionId:string;spec:SourceView;data:BindingData[];disabled?:boolean;onRefresh:()=>Promise<BindingData[]>}){
  const frame=useRef<HTMLIFrameElement>(null);const [height,setHeight]=useState(680);const [error,setError]=useState('');
  const [theme,setTheme]=useState<'light'|'dark'>(()=>typeof document==='undefined'?'light':readSourceTheme());
  useEffect(()=>{
    const update=()=>setTheme(readSourceTheme());const observer=new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true});if(document.body)observer.observe(document.body,{attributes:true});
    const media=window.matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',update);update();
    return()=>{observer.disconnect();media.removeEventListener('change',update);};
  },[]);
  const counter=useRef(0);const instance=useRef(`${Date.now()}-${Math.random()}`);
  const cachedPacket=useRef<{spec:SourceView;data:BindingData[];packet:ReturnType<typeof sourceData>}>();
  const packetFor=(currentSpec:SourceView,currentData:BindingData[])=>{
    if(cachedPacket.current?.spec===currentSpec&&cachedPacket.current.data===currentData)return cachedPacket.current.packet;
    const next=sourceData(currentSpec,currentData,`${instance.current}:${++counter.current}`);cachedPacket.current={spec:currentSpec,data:currentData,packet:next};return next;
  };
  const packet=packetFor(spec,data);
  const inputRevision=useSyncExternalStore(selectionInputBridge.subscribe,selectionInputBridge.getSnapshot,selectionInputBridge.getSnapshot);
  const context=useMemo<SourceContext>(()=>({sessionId,viewId:spec.id,buildId:spec.source.buildId,theme,attachment:disabled?{available:false,disabledReason:'数据正在刷新，请完成后重新选择。'}:selectionInputBridge.availability(sessionId)}),[sessionId,spec.id,spec.source.buildId,theme,disabled,inputRevision]);
  const live=useRef({packet,context,spec,data,onRefresh});live.current={packet,context,spec,data,onRefresh};
  const identity=JSON.stringify([sessionId,spec.id,spec.source.buildId]);
  useEffect(()=>{
    let active=true;const currentFrame=frame.current;
    const receive=async(event:MessageEvent)=>{
      if(event.source!==currentFrame?.contentWindow||event.origin!==window.location.origin||!isSourceRequest(event.data))return;
      if(JSON.stringify([live.current.context.sessionId,live.current.context.viewId,live.current.context.buildId])!==identity)return;
      const request=event.data;const target=currentFrame.contentWindow;const owner=live.current.context;
      try{
        const result=await handleSourceRequest(request,{
          data:()=>live.current.packet,context:()=>live.current.context,
          refresh:async()=>{
            const next=await live.current.onRefresh();
            if(!active||live.current.context.sessionId!==owner.sessionId||live.current.context.viewId!==owner.viewId||live.current.context.buildId!==owner.buildId)throw new Error('会话或构建已切换，请重新打开组件。');
            // Publish the same revision returned to this request, even before React commits its new props.
            const nextPacket=packetFor(live.current.spec,next);
            live.current={...live.current,data:next,packet:nextPacket};
            return nextPacket;
          },
          attach:params=>{
            const current=live.current;if(!current.context.attachment.available)return {ok:false,message:current.context.attachment.disabledReason??'原聊天附件接口尚未就绪。'};
            return selectionInputBridge.attach(current.context.sessionId,sourceSelection(current.context.sessionId,current.spec,current.data,params,current.packet.revision));
          },resize:setHeight,
        });
        if(active&&target===currentFrame.contentWindow)target?.postMessage({channel:SOURCE_CHANNEL,requestId:request.requestId,result},window.location.origin);
      }catch(reason){if(active&&target===currentFrame.contentWindow)target?.postMessage({channel:SOURCE_CHANNEL,requestId:request.requestId,error:reason instanceof Error?reason.message:String(reason)},window.location.origin);}
    };
    window.addEventListener('message',receive);return()=>{active=false;window.removeEventListener('message',receive);};
  },[identity]);
  useEffect(()=>{frame.current?.contentWindow?.postMessage({channel:SOURCE_CHANNEL,event:'data',data:packet},window.location.origin);},[packet]);
  useEffect(()=>{frame.current?.contentWindow?.postMessage({channel:SOURCE_CHANNEL,event:'context',data:context},window.location.origin);},[context]);
  const url=`/api/hallmark-source/${encodeURIComponent(spec.source.buildId)}/${spec.source.entry.split('/').map(encodeURIComponent).join('/')}`;
  return <div className="hm-source-container" style={{width:'100%',minWidth:0}}>
    {error?<p className="hm-error" role="alert">{error}</p>:null}
    <iframe ref={frame} key={identity} src={url} title={spec.title} className="hm-source-frame" style={{display:'block',width:'100%',height,border:0,background:'transparent'}} onLoad={()=>setError('')} onError={()=>setError('组件构建页面未能加载，请重新读取或重新构建。')}/>
  </div>;
}
