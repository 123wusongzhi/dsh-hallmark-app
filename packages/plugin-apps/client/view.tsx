import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {AppsView,AppsViewData} from '../../app-presentation/src/types.ts';
import type {BindingData,ViewSpec} from '../../presentation/src/types.ts';
import {validateViewSpec} from '../../presentation/src/validation.ts';
import {AppsSourceFrame} from '../../dsh-plugin/client/component-frame.tsx';
import {createAppsPresentationHandlers} from './component-handlers.ts';
import {EmptyView,ErrorView,LoadingView,RenderBoundary,ViewRenderer} from '../../dsh-plugin/client/renderer.tsx';
import {STYLES} from '../../dsh-plugin/client/styles.ts';
import {openSessionComponents} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {ExtendedComponentHandlers} from '../../dsh-plugin/client/component-frame.tsx';
import type {AuthoringView,ViewPublication} from '../../app-presentation/src/authoring-types.ts';
import {AppsIcon,appsDisplayTime} from './ui.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import {ownedPublication,startOwnedPublicationMount,useCandidateFrameLease} from './native-publication.tsx';

interface AppsViewReference {sessionId:string;viewId:string;buildId?:string;viewRevision?:number;publicationId?:string}
function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function appsToolViewReference(props:{sessionId?:string;phase?:string;block?:{meta?:unknown}}):AppsViewReference|undefined {
  const meta=object(object(props.block?.meta).apps);
  if(props.phase!=='result'||!props.sessionId||meta.sessionId!==props.sessionId||typeof meta.viewId!=='string'||!meta.viewId)return;
  return {sessionId:props.sessionId,viewId:meta.viewId,...(typeof meta.publicationId==='string'?{publicationId:meta.publicationId}:{}),...(typeof meta.buildId==='string'?{buildId:meta.buildId}:{}),...(Number.isSafeInteger(meta.viewRevision)?{viewRevision:Number(meta.viewRevision)}:{})};
}
async function read(resource:'view'|'viewData',sessionId:string,viewId:string,signal:AbortSignal,version?:{buildId?:string;viewRevision?:number;publicationId?:string}):Promise<unknown> {
  const query=new URLSearchParams({resource,sessionId,viewId,...(version?.publicationId?{publicationId:version.publicationId}:{}),...(version?.buildId?{buildId:version.buildId}:{}),...(!version?.publicationId&&version?.viewRevision!==undefined?{viewRevision:String(version.viewRevision)}:{})}),response=await fetch(`/api/dsh-apps?${query}`,{credentials:'same-origin',signal});
  const value:unknown=await response.json();if(!response.ok)throw new Error(String(object(object(value).error).message??'Apps component could not be read.'));return value;
}
function staticView(view:AppsView):ViewSpec|undefined {
  const design=object(view.design),spec={...design,id:view.viewId,title:view.title,bindings:view.bindings.map(binding=>({id:binding.bindingId,datasetKey:binding.datasetId,fieldMap:{}}))} as unknown as ViewSpec;
  try{validateViewSpec(spec);return spec;}catch{return;}
}
/** Native Apps results use explicit presentation metadata; results are never searched for guessed view IDs. */
export function AppsNativeView({sessionId,viewId,expectedBuildId,expectedViewRevision,expectedPublicationId,onOpenSidebar,visibilitySignal,isCurrentOwner}:{sessionId:string;viewId:string;expectedBuildId?:string;expectedViewRevision?:number;expectedPublicationId?:string;onOpenSidebar?:()=>void;visibilitySignal?:AbortSignal;isCurrentOwner?:()=>boolean}) {
  const [view,setView]=useState<AuthoringView>(),[data,setData]=useState<AppsViewData>(),[publication,setPublication]=useState<ViewPublication>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0),[starting,setStarting]=useState(false),startInFlight=useRef(false);
  const identity=JSON.stringify([sessionId,viewId,expectedBuildId,expectedViewRevision,expectedPublicationId]),[loadedOwner,setLoadedOwner]=useState<string>();
  const loadGeneration=useRef(0),live=useRef({identity,active:true,visibilitySignal,isCurrentOwner,publicationId:publication?.publicationId,attemptEpoch:publication?.attemptEpoch});live.current={identity,active:true,visibilitySignal,isCurrentOwner,publicationId:publication?.publicationId,attemptEpoch:publication?.attemptEpoch};
  useEffect(()=>()=>{live.current.active=false;},[]);
  const currentIdentity=()=>live.current.active&&live.current.identity===identity&&!live.current.visibilitySignal?.aborted&&(live.current.isCurrentOwner?.()??true);
  const leaseKey=publication?.state==='mounting'?JSON.stringify([sessionId,viewId,publication.publicationId,publication.attemptId,publication.attemptEpoch,publication.candidateBuildId]):undefined;
  const lease=useCandidateFrameLease(leaseKey,currentIdentity());
  useEffect(()=>{const generation=++loadGeneration.current,controller=new AbortController(),signal=visibilitySignal?AbortSignal.any([controller.signal,visibilitySignal]):controller.signal;if(loadedOwner!==identity){setView(undefined);setData(undefined);setPublication(undefined);setLoadedOwner(undefined);}setError('');setNotice('');
    if(!currentIdentity())return()=>controller.abort();
    Promise.all([read('view',sessionId,viewId,signal,{buildId:expectedBuildId,viewRevision:expectedViewRevision,publicationId:expectedPublicationId}),read('viewData',sessionId,viewId,signal)]).then(async([viewValue,dataValue])=>{
      if(signal.aborted||!currentIdentity()||loadGeneration.current!==generation)return;
      const current=viewValue as AuthoringView,payload=dataValue as AppsViewData;
      if(current.viewId!==viewId||current.ownerSessionId!==sessionId||payload.viewId!==viewId||!Array.isArray(payload.bindings))throw new Error('Apps component owner or view identity does not match.');
      let pending:ViewPublication|undefined;const pinned=(current as AuthoringView&{publication?:ViewPublication}).publication;
      if(expectedPublicationId){const original=ownedPublication({sessionId,viewId,publicationId:expectedPublicationId,buildId:expectedBuildId,viewRevision:expectedViewRevision},{...current,publication:pinned});if(original.state!=='mounted')pending=original;}
      else if(current.pendingPublicationId){const fixed=await read('view',sessionId,viewId,signal,{publicationId:current.pendingPublicationId}) as AuthoringView&{publication?:ViewPublication};if(signal.aborted||!currentIdentity()||loadGeneration.current!==generation)return;const original=ownedPublication({sessionId,viewId,publicationId:current.pendingPublicationId},fixed);if(original.state!=='mounted')pending=original;}
      if(expectedBuildId&&current.source?.buildId!==expectedBuildId&&pending?.candidateBuildId!==expectedBuildId)throw new Error('此历史消息的构建不可重建；不会用当前焦点组件替换。');
      if(pending?.state==='mounting'&&(pending.readyDeadlineAt===null||!(Date.parse(pending.readyDeadlineAt)>Date.now()))){pending=undefined;if(!signal.aborted&&currentIdentity()&&loadGeneration.current===generation)setNotice('此候选的渲染确认时间已过。请在原聊天继续处理并发布新候选；上一成功构建仍保留。');}
      if(!signal.aborted&&currentIdentity()&&loadGeneration.current===generation){setView(current);setData(payload);setPublication(pending);setLoadedOwner(identity);}
    }).catch(cause=>{if(!signal.aborted&&currentIdentity()&&loadGeneration.current===generation){const message=cause instanceof Error?cause.message:String(cause);if(loadedOwner===identity&&view?.source&&publication?.state!=='mounting')setNotice(`组件重新读取失败，上一成功展示继续保留：${message}`);else setError(message);}});return()=>{controller.abort();if(loadGeneration.current===generation)loadGeneration.current++;};
  },[identity,revision,visibilitySignal]);
  useEffect(()=>{
    const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!publication||!currentIdentity()||detail?.sessionId!==sessionId||detail?.viewId!==viewId||detail?.publicationId!==publication.publicationId||detail?.buildId!==publication.candidateBuildId)return;
      if(lease.owns()){setPublication(current=>current&&current.publicationId===detail.publicationId?{...current,state:'mounted'}:current);setNotice('组件已展示，尚未保存到组件库。');lease.settle();}
      else setRevision(value=>value+1);
    };
    const discover=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!expectedPublicationId&&currentIdentity()&&detail?.sessionId===sessionId&&detail?.viewId===viewId&&typeof detail.publicationId==='string'&&detail.publicationId!==publication?.publicationId){loadGeneration.current++;setRevision(value=>value+1);}};
    const settled=(event:Event)=>{const detail=(event as CustomEvent).detail;if(currentIdentity()&&detail?.sessionId===sessionId&&detail?.viewId===viewId&&detail.publicationId===publication?.publicationId&&!lease.owns())setRevision(value=>value+1);};
    window.addEventListener('apps-authoring-published',receive);window.addEventListener('apps-publication-discovered',discover);window.addEventListener('apps-authoring-settled',settled);
    return()=>{window.removeEventListener('apps-authoring-published',receive);window.removeEventListener('apps-publication-discovered',discover);window.removeEventListener('apps-authoring-settled',settled);};
  },[identity,publication?.publicationId,publication?.candidateBuildId,leaseKey]);
  const current=loadedOwner===identity?view:undefined,currentData=loadedOwner===identity?data:undefined;
  const source=publication&&publication.state!=='prepared'?publication.source:current?.source;
  const abort=useMemo(()=>new AbortController(),[identity,source?.buildId,visibilitySignal]);useEffect(()=>()=>abort.abort(),[abort]);
  const frameSignal=useMemo(()=>visibilitySignal?AbortSignal.any([abort.signal,visibilitySignal]):abort.signal,[abort,visibilitySignal]);
  const [preparedHandlers,setPreparedHandlers]=useState<{identity:string;buildId:string;handlers:ExtendedComponentHandlers}>();
  useEffect(()=>{let active=true;setPreparedHandlers(undefined);if(source){const buildId=source.buildId,mounting=publication?.state==='mounting';Promise.resolve(createAppsPresentationHandlers({sessionId,viewId,buildId},frameSignal,mounting?{publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch}:undefined)).then(handlers=>{if(active&&!frameSignal.aborted&&currentIdentity()){const authorize=handlers.authorizeFrame;setPreparedHandlers({identity,buildId,handlers:{...handlers,...(authorize?{authorizeFrame:async(...args:Parameters<NonNullable<ExtendedComponentHandlers['authorizeFrame']>>)=>{if(!currentIdentity())throw new Error('原生会话已切换，组件授权已停止。');if(mounting)lease.authorize();const granted=await authorize(...args);if(!currentIdentity())throw new Error('原生会话已切换，组件授权响应不再展示。');return granted;}}:{})}});}}).catch(cause=>{if(active&&!frameSignal.aborted&&currentIdentity())setError(cause instanceof Error?cause.message:String(cause));});}return()=>{active=false;};},[identity,source?.buildId,publication?.state==='prepared'?undefined:publication?.publicationId,frameSignal]);
  const handlers=preparedHandlers?.identity===identity&&preparedHandlers.buildId===source?.buildId?preparedHandlers.handlers:undefined;
  const failing=useRef<string>();
  const failCandidate=async(reason:string)=>{
    if(!publication||publication.state!=='mounting'||!lease.owns()||failing.current===publication.publicationId||!currentIdentity())return;
    const candidate=publication,generation=loadGeneration.current;
    const currentCandidate=()=>currentIdentity()&&!frameSignal.aborted&&loadGeneration.current===generation&&live.current.publicationId===candidate.publicationId&&live.current.attemptEpoch===candidate.attemptEpoch;
    const signal=()=>AbortSignal.any([frameSignal,AbortSignal.timeout(5000)]);
    const inspect=async()=>{const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:'inspect',sessionId,params:{publicationId:candidate.publicationId}}),signal:signal()}),state=object(object(await response.json()).publication);if(!response.ok||state.publicationId!==candidate.publicationId||state.ownerSessionId!==sessionId||state.viewId!==viewId)throw new Error('Publication inspection failed.');return state;};
    const confirmed=()=>{if(!currentCandidate())return;setPublication(current=>current&&current.publicationId===candidate.publicationId?{...current,state:'mounted'}:current);lease.settle();setNotice('原候选发布已确认；加载失败回执不会撤销已完成发布。');};
    failing.current=candidate.publicationId;
    try{
      let state=await inspect();if(!currentCandidate())return;
      if(state.state==='mounted'){confirmed();return;}
      if(state.state==='mounting'){
        try{const failed=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:'failMount',sessionId,params:{publicationId:candidate.publicationId,reason}}),signal:signal()});if(!failed.ok)throw new Error('Mount failure receipt unavailable.');}
        catch{if(!currentCandidate())return;state=await inspect();if(!currentCandidate())return;if(state.state==='mounted'){confirmed();return;}if(!['failed_mount','cancelled','interrupted'].includes(String(state.state)))throw new Error('Mount result remains unconfirmed.');}
      }else if(!['failed_mount','cancelled','interrupted'].includes(String(state.state)))throw new Error('Publication result is not terminal.');
      if(!currentCandidate())return;
      const previous=await read('view',sessionId,viewId,signal()) as AuthoringView;
      if(previous.ownerSessionId!==sessionId||previous.viewId!==viewId||previous.pendingPublicationId||previous.source?.buildId===candidate.candidateBuildId)throw new Error('Previous owned active build was not confirmed.');
      if(currentCandidate()){lease.settle();setView(previous);setPublication(undefined);setNotice('候选加载失败，已重新读取此视图上一成功构建，工作副本继续保留。');window.dispatchEvent(new CustomEvent('apps-authoring-settled',{detail:{sessionId,viewId,publicationId:candidate.publicationId}}));}
    }catch{if(currentCandidate())setNotice('候选加载失败，原发布结果尚未确认。请在原聊天检查原 publication；当前展示与工作副本继续保留。');}
    finally{if(failing.current===candidate.publicationId)failing.current=undefined;}
  };
  useEffect(()=>{if(publication?.state!=='mounting'||publication.readyDeadlineAt===null||!lease.allowed)return;const timeout=Math.max(0,Date.parse(publication.readyDeadlineAt)-Date.now())+25;const timer=setTimeout(()=>void failCandidate('Candidate render-ready deadline exceeded.'),Math.min(timeout,2147483647));return()=>clearTimeout(timer);},[publication?.publicationId,publication?.state,lease.allowed]);
  const openPrepared=async()=>{
    if(!publication||publication.state!=='prepared'||startInFlight.current||!currentIdentity())return;
    const original=publication,generation=loadGeneration.current,target={sessionId,viewId,publicationId:original.publicationId,buildId:original.candidateBuildId};
    const stillCurrent=()=>currentIdentity()&&loadGeneration.current===generation&&live.current.publicationId===original.publicationId;
    startInFlight.current=true;setStarting(true);setNotice('');
    try{const started=await startOwnedPublicationMount(target,original,stillCurrent,frameSignal);if(stillCurrent()){setPublication(started);setError('');}}
    catch(cause){if(stillCurrent())setNotice(cause instanceof Error?cause.message:String(cause));}
    finally{startInFlight.current=false;if(currentIdentity())setStarting(false);}
  };
  const spec=current&&!current.source?staticView(current):undefined;
  const bindings:BindingData[]=(currentData?.bindings??[]).map(binding=>{
    const metricBasis=binding.provenance.find(item=>typeof item.metricBasis==='string'&&item.metricBasis.trim())?.metricBasis;
    return {bindingId:binding.bindingId,datasetKey:binding.datasetId,payload:binding.payload,state:binding.state,lastSuccessAt:binding.lastSuccessAt??undefined,dataTime:binding.sourceDataTime??undefined,provenance:{source:'app_snapshot',endpoint:binding.provenance[0]?.sourceRef,freshness:binding.freshness,...(metricBasis?{metricBasis}:{})},...(metricBasis?{metricBasis}:{}),lastError:binding.error};
  });
  const sourceTimes=[...new Set((currentData?.bindings??[]).map(binding=>binding.sourceDataTime).filter((value):value is string=>!!value))];
  const readTimes=[...new Set((currentData?.bindings??[]).map(binding=>binding.lastSuccessAt).filter((value):value is string=>!!value))];
  if(!currentIdentity())return null;
  return <section className="hm-root hm-view apps-component"><style>{STYLES}{APPS_WORKSPACE_STYLES}</style><header><div className="apps-component-heading"><span className="apps-component-mark"><AppsIcon name="component"/></span><div><h3>{current?.title??'应用组件'}</h3><p>{publication?.state==='prepared'?'已准备好 · 点击后在此展示':publication?.state==='mounted'?'已展示 · 尚未保存':publication?.state==='mounting'?'正在加载新设计，上一成功展示继续保留':current?.validationStatus==='verified'?'已展示 · 展示与保存分别执行':'当前聊天工作视图'}</p></div></div><div className="apps-component-actions">{publication?.state==='prepared'?<button type="button" disabled={starting} onClick={()=>void openPrepared()}>{starting?'正在打开…':'打开组件'}</button>:null}<button type="button" disabled={publication?.state==='mounting'||starting} onClick={()=>setRevision(value=>value+1)}>重新读取</button>{onOpenSidebar?<button type="button" onClick={onOpenSidebar}>侧栏查看</button>:null}</div></header>{currentData?<div className="apps-component-times"><span>源数据时间：{sourceTimes.length?sourceTimes.map(time=>appsDisplayTime(time)).join(' / '):'暂无时间证据'}</span><span>读取成功：{readTimes.length?readTimes.map(time=>appsDisplayTime(time)).join(' / '):'暂无成功读取时间'}</span></div>:null}{publication&&!notice?<p role="status">{publication.state==='prepared'?'组件已完成构建和预览，等待你点击打开；工作副本尚未保存。':publication.state==='mounting'?'正在检查组件实际加载；上一成功构建保持有效。':'组件已展示，尚未保存到组件库。'}</p>:notice?<p role="status">{notice}</p>:null}{error?<ErrorView message={error}/>:!current||!currentData||source&&!handlers?<LoadingView/>:publication?.state==='mounting'&&!lease.allowed?<EmptyView message="此候选已在另一展示视图检查" detail="同一候选只授权一个原生文档。若原视图已关闭，请在原聊天检查原发布结果，再继续处理新候选。"/>:<RenderBoundary key={identity}>{source&&handlers?<AppsSourceFrame sessionId={sessionId} viewId={viewId} buildId={source.buildId} title={current.title} url={`/api/hallmark-source/${encodeURIComponent(source.buildId)}/${source.entry.split('/').map(encodeURIComponent).join('/')}`} data={currentData as unknown as JsonValue} context={{sessionId,viewId,buildId:source.buildId,contextRevision:0}} handlers={handlers} onLoadError={()=>void failCandidate('Candidate iframe load failed.')}/>:publication?.state==='prepared'?<EmptyView message="组件已准备好" detail="点击“打开组件”后显示在这里。"/>:spec?<ViewRenderer spec={spec} data={bindings}/>:<EmptyView message="组件设计尚无对应展示器" detail="源码组件可按原构建打开；请查看此调用的原生文字结果。"/>}</RenderBoundary>}</section>;
}
export function AppsToolView(props:{sessionId?:string;phase?:string;block?:{meta?:unknown};sidebarRight?:NativeSidebarRight}) {
  const reference=appsToolViewReference(props),[notice,setNotice]=useState(''),[title,setTitle]=useState('应用组件'),[publication,setPublication]=useState<ViewPublication>(),[opening,setOpening]=useState<string>(),inFlight=useRef<string>(),openingController=useRef<{fixed:string;controller:AbortController}>();
  const fixed=JSON.stringify(reference);
  const live=useRef({fixed,active:true});live.current.fixed=fixed;
  useEffect(()=>()=>{live.current.active=false;openingController.current?.controller.abort();},[]);
  useEffect(()=>{if(reference)window.dispatchEvent(new CustomEvent('hallmark-view-updated',{detail:{sessionId:reference.sessionId,viewId:reference.viewId}}));},[reference?.sessionId,reference?.viewId]);
  useEffect(()=>{setTitle('应用组件');setNotice('');setPublication(undefined);if(!reference)return;const controller=new AbortController();read('view',reference.sessionId,reference.viewId,controller.signal,reference).then(value=>{const view=value as AppsView&{publication?:ViewPublication};if(view.ownerSessionId!==reference.sessionId||view.viewId!==reference.viewId)throw new Error('原消息的组件身份不一致。');const original=reference.publicationId?ownedPublication({...reference,publicationId:reference.publicationId},view):undefined;if(!controller.signal.aborted){setTitle(view.title);setPublication(original);}}).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:String(error));});return()=>controller.abort();},[fixed]);
  useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(reference&&live.current.active&&live.current.fixed===fixed&&detail?.sessionId===reference.sessionId&&detail?.viewId===reference.viewId&&detail?.publicationId===reference.publicationId&&detail?.buildId===reference.buildId)setPublication(value=>value?{...value,state:'mounted'}:value);};window.addEventListener('apps-authoring-published',receive);return()=>window.removeEventListener('apps-authoring-published',receive);},[fixed]);
  const open=async()=>{
    if(!reference||inFlight.current===fixed)return;
    const original=reference,isCurrent=()=>live.current.active&&live.current.fixed===fixed&&props.sidebarRight?.mounted.getSnapshot()===original.sessionId;
    if(!isCurrent()){setNotice('请切回组件所属聊天后重新打开。');return;}
    openingController.current?.controller.abort();inFlight.current=fixed;setOpening(fixed);setNotice('');
    const controller=new AbortController(),signal=controller.signal;openingController.current={fixed,controller};
    try{
      if(original.publicationId){const target={...original,publicationId:original.publicationId},value=await read('view',original.sessionId,original.viewId,AbortSignal.any([signal,AbortSignal.timeout(5000)]),original) as AppsView&{publication?:ViewPublication};if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');const prepared=ownedPublication(target,value),started=await startOwnedPublicationMount(target,prepared,isCurrent,signal);if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');setPublication(started);}
      const result=openSessionComponents(props.sidebarRight,original.sessionId,original.viewId,original.publicationId);if(!result.ok)throw new Error(result.message??'Native sidebar is unavailable.');
    }catch(cause){if(live.current.active&&live.current.fixed===fixed)setNotice(cause instanceof Error?cause.message:String(cause));}
    finally{if(inFlight.current===fixed)inFlight.current=undefined;if(openingController.current?.controller===controller)openingController.current=undefined;if(live.current.active&&live.current.fixed===fixed)setOpening(undefined);}
  };
  return <div className="hm-root apps-tool-result"><style>{STYLES}{APPS_WORKSPACE_STYLES}</style>{notice?<p role="status">{notice}</p>:null}{props.phase!=='result'?<LoadingView/>:reference?<section className="hm-root apps-component" data-view-id={reference.viewId} data-publication-id={reference.publicationId} data-build-id={reference.buildId} data-view-revision={reference.viewRevision}><header><div className="apps-component-heading"><span className="apps-component-mark"><AppsIcon name="component"/></span><div><h3>{title}</h3><p>{publication?.state==='prepared'?'已准备好 · 点击后在右侧展示':publication?.state==='mounting'?'正在加载 · 等待实际展示确认':publication?.state==='mounted'?'已展示 · 尚未保存':'打开此工作视图；原发布记录保留'}</p></div></div><button type="button" disabled={opening===fixed} title="在当前聊天右侧打开原消息的固定组件发布" onClick={()=>void open()}>{opening===fixed?'正在打开…':'打开组件 ↗'}</button></header></section>:<EmptyView message="此调用没有可展示的 Apps 组件" detail="请查看原生文字结果。"/>}</div>;
}
