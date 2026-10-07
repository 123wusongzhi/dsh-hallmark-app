import React,{useEffect,useMemo,useState} from 'react';
import type {AppsView,AppsViewData} from '../../app-presentation/src/types.ts';
import type {BindingData,ViewSpec} from '../../presentation/src/types.ts';
import {validateViewSpec} from '../../presentation/src/validation.ts';
import {AppsSourceFrame} from '../../dsh-plugin/client/component-frame.tsx';
import {createAppsComponentHandlers} from './component-handlers.ts';
import {EmptyView,ErrorView,LoadingView,RenderBoundary,ViewRenderer} from '../../dsh-plugin/client/renderer.tsx';
import {STYLES} from '../../dsh-plugin/client/styles.ts';
import {openSessionComponents} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {ComponentHostHandlers} from '../../component-runtime/src/host.ts';

interface AppsViewReference {sessionId:string;viewId:string;buildId?:string}
function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function appsToolViewReference(props:{sessionId?:string;phase?:string;block?:{meta?:unknown}}):AppsViewReference|undefined {
  const meta=object(object(props.block?.meta).apps);
  if(props.phase!=='result'||!props.sessionId||meta.sessionId!==props.sessionId||typeof meta.viewId!=='string'||!meta.viewId)return;
  return {sessionId:props.sessionId,viewId:meta.viewId,...(typeof meta.buildId==='string'?{buildId:meta.buildId}:{})};
}
async function read(resource:'view'|'viewData',sessionId:string,viewId:string,signal:AbortSignal):Promise<unknown> {
  const query=new URLSearchParams({resource,sessionId,viewId}),response=await fetch(`/api/dsh-apps?${query}`,{credentials:'same-origin',signal});
  const value:unknown=await response.json();if(!response.ok)throw new Error(String(object(object(value).error).message??'Apps component could not be read.'));return value;
}
function staticView(view:AppsView):ViewSpec|undefined {
  const design=object(view.design),spec={...design,id:view.viewId,title:view.title,bindings:view.bindings.map(binding=>({id:binding.bindingId,datasetKey:binding.datasetId,fieldMap:{}}))} as unknown as ViewSpec;
  try{validateViewSpec(spec);return spec;}catch{return;}
}
/** Native Apps results use explicit presentation metadata; results are never searched for guessed view IDs. */
export function AppsNativeView({sessionId,viewId,onOpenSidebar}:{sessionId:string;viewId:string;onOpenSidebar?:()=>void}) {
  const [view,setView]=useState<AppsView>(),[data,setData]=useState<AppsViewData>(),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const identity=JSON.stringify([sessionId,viewId]),[loadedOwner,setLoadedOwner]=useState<string>();
  useEffect(()=>{const controller=new AbortController();setView(undefined);setData(undefined);setLoadedOwner(undefined);setError('');
    Promise.all([read('view',sessionId,viewId,controller.signal),read('viewData',sessionId,viewId,controller.signal)]).then(([viewValue,dataValue])=>{
      const current=viewValue as AppsView,payload=dataValue as AppsViewData;
      if(current.viewId!==viewId||current.ownerSessionId!==sessionId||payload.viewId!==viewId||!Array.isArray(payload.bindings))throw new Error('Apps component owner or view identity does not match.');
      if(!controller.signal.aborted){setView(current);setData(payload);setLoadedOwner(identity);}
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:String(cause));});return()=>controller.abort();
  },[identity,revision]);
  const current=loadedOwner===identity?view:undefined,currentData=loadedOwner===identity?data:undefined;
  const abort=useMemo(()=>new AbortController(),[identity,current?.source?.buildId]);useEffect(()=>()=>abort.abort(),[abort]);
  const [preparedHandlers,setPreparedHandlers]=useState<{identity:string;buildId:string;handlers:ComponentHostHandlers}>();
  useEffect(()=>{let active=true;setPreparedHandlers(undefined);if(current?.source){const buildId=current.source.buildId;Promise.resolve(createAppsComponentHandlers({sessionId,viewId,buildId},abort.signal)).then(handlers=>{if(active&&!abort.signal.aborted)setPreparedHandlers({identity,buildId,handlers});}).catch(cause=>{if(active&&!abort.signal.aborted)setError(cause instanceof Error?cause.message:String(cause));});}return()=>{active=false;};},[identity,current?.source?.buildId,abort]);
  const handlers=preparedHandlers?.identity===identity&&preparedHandlers.buildId===current?.source?.buildId?preparedHandlers.handlers:undefined;
  const spec=current&&!current.source?staticView(current):undefined;
  const bindings:BindingData[]=(currentData?.bindings??[]).map(binding=>({bindingId:binding.bindingId,datasetKey:binding.datasetId,payload:binding.payload,state:binding.state,lastSuccessAt:binding.lastSuccessAt??undefined,dataTime:binding.sourceDataTime??undefined,provenance:{source:'app_snapshot',endpoint:binding.provenance[0]?.sourceRef,freshness:binding.freshness},lastError:binding.error}));
  return <section className="hm-root hm-view"><style>{STYLES}</style><header><h3>{current?.title??'Apps 组件'}</h3><button type="button" onClick={()=>setRevision(value=>value+1)}>重新读取</button>{onOpenSidebar?<button type="button" onClick={onOpenSidebar}>侧栏查看</button>:null}</header>{error?<ErrorView message={error}/>:!current||!currentData||current.source&&!handlers?<LoadingView/>:<RenderBoundary key={identity}>{current.source&&handlers?<AppsSourceFrame sessionId={sessionId} viewId={viewId} buildId={current.source.buildId} title={current.title} url={`/api/hallmark-source/${encodeURIComponent(current.source.buildId)}/${current.source.entry.split('/').map(encodeURIComponent).join('/')}`} data={currentData as unknown as JsonValue} context={{sessionId,viewId,buildId:current.source.buildId,contextRevision:0}} handlers={handlers}/>:spec?<ViewRenderer spec={spec} data={bindings}/>:<EmptyView message="组件设计尚无对应展示器" detail="源码组件可按原构建打开；请查看此调用的原生文字结果。"/>}</RenderBoundary>}</section>;
}
export function AppsToolView(props:{sessionId?:string;phase?:string;block?:{meta?:unknown};sidebarRight?:NativeSidebarRight}) {
  const reference=appsToolViewReference(props),[notice,setNotice]=useState('');
  useEffect(()=>{if(reference)window.dispatchEvent(new CustomEvent('hallmark-view-updated',{detail:{sessionId:reference.sessionId,viewId:reference.viewId}}));},[reference?.sessionId,reference?.viewId]);
  const open=()=>{if(!reference)return;const result=openSessionComponents(props.sidebarRight,reference.sessionId,reference.viewId);setNotice(result.ok?'':result.message??'Native sidebar is unavailable.');};
  return <div className="hm-root">{notice?<p role="status">{notice}</p>:null}{props.phase!=='result'?<LoadingView/>:reference?<AppsNativeView sessionId={reference.sessionId} viewId={reference.viewId} onOpenSidebar={open}/>:<EmptyView message="此调用没有可展示的 Apps 组件" detail="请查看原生文字结果。"/>}</div>;
}
