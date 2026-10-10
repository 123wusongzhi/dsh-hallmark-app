import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {AppsComponent,AppsView,AppsViewData} from '../../app-presentation/src/types.ts';
import type {BindingData,ViewSpec} from '../../presentation/src/types.ts';
import {validateViewSpec} from '../../presentation/src/validation.ts';
import {AppsSourceFrame} from '../../dsh-plugin/client/component-frame.tsx';
import {createAppsPresentationHandlers} from './component-handlers.ts';
import {EmptyView,ErrorView,LoadingView,RenderBoundary,ViewRenderer} from '../../dsh-plugin/client/renderer.tsx';
import {STYLES} from '../../dsh-plugin/client/styles.ts';
import {openSessionComponents} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {NativeSidebarRight} from '../../dsh-plugin/client/sidebar-contract.ts';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {ExtendedComponentHandlers,ComponentFrameError} from '../../dsh-plugin/client/component-frame.tsx';
import type {AuthoringView,ViewPublication,ComponentDisplay} from '../../app-presentation/src/authoring-types.ts';
import {AppsIcon,appsDisplayTime} from './ui.tsx';
import {APPS_WORKSPACE_STYLES} from './styles.ts';
import {appsResource,appsAuthoring,appsRefreshView,mergeCachedAppsData} from './api.ts';
import {cacheFallbackAllowed,cacheRetryAt} from '../../presentation/src/cache-display.ts';
import {ownedPublication,openOwnedPublicationDisplay,readOwnedDisplay,latestOpenedDisplayId} from './native-publication.tsx';
import {SidebarPreparing,SIDEBAR_STATUS_STYLES} from './sidebar-status.tsx';

interface AppsViewReference {sessionId:string;viewId:string;buildId?:string;viewRevision?:number;publicationId?:string}
function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function appsToolViewReference(props:{sessionId?:string;phase?:string;block?:{meta?:unknown}}):AppsViewReference|undefined {
  const meta=object(object(props.block?.meta).apps);
  if(props.phase!=='result'||!props.sessionId||meta.sessionId!==props.sessionId||typeof meta.viewId!=='string'||!meta.viewId)return;
  return {sessionId:props.sessionId,viewId:meta.viewId,...(typeof meta.publicationId==='string'?{publicationId:meta.publicationId}:{}),...(typeof meta.buildId==='string'?{buildId:meta.buildId}:{}),...(Number.isSafeInteger(meta.viewRevision)?{viewRevision:Number(meta.viewRevision)}:{})};
}
async function read(resource:'view'|'viewData',sessionId:string,viewId:string,signal:AbortSignal,version?:{buildId?:string;viewRevision?:number;publicationId?:string;displayId?:string;displayGeneration?:number}):Promise<unknown> {
  return appsResource(resource,{sessionId,viewId,...(version?.publicationId?{publicationId:version.publicationId}:{}),...(version?.buildId?{buildId:version.buildId}:{}),...(version?.displayId?{displayId:version.displayId}:{}),...(version?.displayGeneration!==undefined?{displayGeneration:String(version.displayGeneration)}:{}),...(!version?.publicationId&&version?.viewRevision!==undefined?{viewRevision:String(version.viewRevision)}:{})},signal);
}
function sourceDraft(view:AppsView):boolean {return !view.source&&object(view.design).kind==='source';}
function sameSavedView(saved:AppsView|undefined,current:AppsView|undefined):boolean {return !!saved&&!!current&&saved.ownerSessionId===current.ownerSessionId&&saved.viewId===current.viewId&&saved.viewRevision===current.viewRevision&&saved.source?.buildId===current.source?.buildId;}
function staticView(view:AppsView):ViewSpec|undefined {
  const design=object(view.design),spec={...design,id:view.viewId,title:view.title,bindings:view.bindings.map(binding=>({id:binding.bindingId,datasetKey:binding.datasetId,fieldMap:{}}))} as unknown as ViewSpec;
  try{validateViewSpec(spec);return spec;}catch{return;}
}
/** Visible Apps views load their prepared preview archive automatically. */
export function AppsNativeView({sessionId,viewId,expectedBuildId,expectedViewRevision,expectedPublicationId,expectedDisplayId,onOpenSidebar,visibilitySignal,isCurrentOwner,active=true}:{sessionId:string;viewId:string;expectedBuildId?:string;expectedViewRevision?:number;expectedPublicationId?:string;expectedDisplayId?:string;onOpenSidebar?:()=>void;visibilitySignal?:AbortSignal;isCurrentOwner?:()=>boolean;active?:boolean}) {
  const [view,setView]=useState<AuthoringView>(),[data,setData]=useState<AppsViewData>(),[publication,setPublication]=useState<ViewPublication>(),[display,setDisplay]=useState<ComponentDisplay>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0),[starting,setStarting]=useState(false),startInFlight=useRef(false);
  const [savedComponent,setSavedComponent]=useState<AppsComponent>();
  const [refreshedData,setRefreshedData]=useState<{identity:string;buildId:string;displayId?:string;data:AppsViewData}>();
  const identity=JSON.stringify([sessionId,viewId,expectedBuildId,expectedViewRevision,expectedPublicationId,expectedDisplayId]),[loadedOwner,setLoadedOwner]=useState<string>();
  const loadedRevision=useRef<number>(),loadGeneration=useRef(0),live=useRef({identity,active:true,visible:active,visibilitySignal,isCurrentOwner,publicationId:publication?.publicationId,displayId:display?.displayId});live.current={identity,active:true,visible:active,visibilitySignal,isCurrentOwner,publicationId:publication?.publicationId,displayId:display?.displayId};
  useEffect(()=>()=>{live.current.active=false;},[]);
  const currentIdentity=()=>live.current.active&&live.current.identity===identity&&!live.current.visibilitySignal?.aborted&&(live.current.isCurrentOwner?.()??true);
  const currentVisible=()=>currentIdentity()&&live.current.visible;
  useEffect(()=>{
    const generation=++loadGeneration.current,controller=new AbortController(),signal=visibilitySignal?AbortSignal.any([controller.signal,visibilitySignal]):controller.signal;
    if(!currentVisible())return()=>controller.abort();
    if(loadedOwner!==identity){setView(undefined);setData(undefined);setPublication(undefined);setDisplay(undefined);setLoadedOwner(undefined);}setError('');setNotice('');
    const alive=()=>!signal.aborted&&currentVisible()&&loadGeneration.current===generation;
    void (async()=>{
      const current=await read('view',sessionId,viewId,signal,{buildId:expectedBuildId,viewRevision:expectedViewRevision,publicationId:expectedPublicationId}) as AuthoringView&{publication?:ViewPublication};
      if(!alive())return;if(current.viewId!==viewId||current.ownerSessionId!==sessionId)throw new Error('Apps component owner or view identity does not match.');
      if(current.panelState==='closed')throw new Error('此工作副本已关闭，请从已关闭列表恢复。');
      let fixed:ViewPublication|undefined,opened:ComponentDisplay|undefined;
      if(expectedPublicationId)fixed=ownedPublication({sessionId,viewId,publicationId:expectedPublicationId,buildId:expectedBuildId,viewRevision:expectedViewRevision},current);
      else if(current.pendingPublicationId){const pinned=await read('view',sessionId,viewId,signal,{publicationId:current.pendingPublicationId}) as AuthoringView&{publication?:ViewPublication};if(!alive())return;fixed=ownedPublication({sessionId,viewId,publicationId:current.pendingPublicationId},pinned);}
      else if(display&&publication&&loadedRevision.current===revision&&current.viewRevision===view?.viewRevision&&current.source?.buildId===display.buildId)fixed=publication;
      const retainedDisplayId=fixed?latestOpenedDisplayId({sessionId,viewId,publicationId:fixed.publicationId})??expectedDisplayId:expectedDisplayId;
      if(retainedDisplayId){if(!fixed)throw new Error('展示缺少原消息的固定发布身份。');setPublication(fixed);opened=await readOwnedDisplay({sessionId,viewId,publicationId:fixed.publicationId,displayId:retainedDisplayId},fixed,signal);if(!alive())return;
        if(opened.state==='failed'||opened.state==='retired'){setView(opened.view);setData(undefined);setDisplay(opened);setLoadedOwner(identity);setError(opened.state==='failed'?opened.errors.at(-1)?.message??'组件加载失败，请重新打开。':'此展示已关闭，请重新打开组件。');return;}}
      const retained=loadedOwner===identity&&loadedRevision.current===revision&&!!data&&Number.isSafeInteger(current.viewRevision)&&current.viewRevision===view?.viewRevision&&current.source?.buildId===view?.source?.buildId&&current.pendingPublicationId===view?.pendingPublicationId&&opened?.displayId===display?.displayId&&opened?.generation===display?.generation;
      const payload=retained?data:await read('viewData',sessionId,viewId,signal,opened?{publicationId:opened.publicationId,buildId:opened.buildId,displayId:opened.displayId,displayGeneration:opened.generation}:undefined) as AppsViewData;
      if(!alive())return;if(payload.viewId!==viewId||!Array.isArray(payload.bindings))throw new Error('Apps component data identity does not match.');
      if(expectedBuildId&&current.source?.buildId!==expectedBuildId&&fixed?.candidateBuildId!==expectedBuildId)throw new Error('此历史消息的原构建不可用；不会替换为新候选。');
      setView(opened?.view??current);setData(payload);if(!retained)setRefreshedData(undefined);setPublication(fixed);setDisplay(opened);setLoadedOwner(identity);loadedRevision.current=revision;
      if(opened?.state==='failed')setError(opened.errors.at(-1)?.message??'组件加载失败，请重新打开。');
      if(opened?.state==='retired')setError('此展示已关闭，请重新打开组件。');
    })().catch(cause=>{if(alive()){const message=cause instanceof Error?cause.message:String(cause);if(loadedOwner===identity&&view?.source&&cacheFallbackAllowed(cause))setNotice(`组件重新读取失败，当前展示继续保留：${message}`);else {setData(undefined);setRefreshedData(undefined);setError(message);}}});
    return()=>{controller.abort();if(loadGeneration.current===generation)loadGeneration.current++;};
  },[identity,revision,visibilitySignal,active]);
  const current=loadedOwner===identity?view:undefined,currentData=loadedOwner===identity?data:undefined;
  const saved=sameSavedView(savedComponent?.view,current)?savedComponent:undefined;
  useEffect(()=>{
    const receive=(event:Event)=>{const detail=(event as CustomEvent).detail,component=detail?.component as AppsComponent|undefined;if(!currentIdentity()||detail?.sessionId!==sessionId||detail.viewId!==viewId||!component||!sameSavedView(component.view,current))return;setSavedComponent(previous=>previous?.componentId===component.componentId&&sameSavedView(previous.view,component.view)&&previous.revision>component.revision?previous:component);};
    window.addEventListener('apps-library-changed',receive);return()=>window.removeEventListener('apps-library-changed',receive);
  },[identity,current]);
  // Before an explicit candidate open, only the existing active source may remain visible.
  const source=display&&publication&&['opening','ready'].includes(display.state)?publication.source:(!display&&!expectedPublicationId||!display&&publication?.state==='prepared'?current?.source:undefined);
  const [refreshingData,setRefreshingData]=useState(false),[refreshRetryAt,setRefreshRetryAt]=useState(0),[documentVisible,setDocumentVisible]=useState(()=>typeof document==='undefined'||!document.hidden);
  const nativeRefresh=useRef<AbortController>();
  useEffect(()=>{setRefreshingData(false);setRefreshRetryAt(0);return()=>{nativeRefresh.current?.abort();nativeRefresh.current=undefined;};},[identity,revision,visibilitySignal]);
  useEffect(()=>{if(!active){nativeRefresh.current?.abort();nativeRefresh.current=undefined;setRefreshingData(false);}},[active]);
  useEffect(()=>{if(typeof document==='undefined')return;const change=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  const refreshNative=async(forceRefresh:boolean)=>{
    if(source||!current||nativeRefresh.current||forceRefresh&&nativeBackgroundRefreshing||!currentVisible())return;
    const controller=new AbortController(),generation=loadGeneration.current;nativeRefresh.current=controller;setRefreshingData(true);
    const alive=()=>!controller.signal.aborted&&currentVisible()&&loadGeneration.current===generation;
    try{
      const payload=await appsRefreshView<AppsViewData>(sessionId,viewId,forceRefresh,visibilitySignal?AbortSignal.any([controller.signal,visibilitySignal]):controller.signal);
      if(!alive())return;
      if(payload.viewId!==viewId||!Array.isArray(payload.bindings))throw new Error('数据视图身份已变化，请重新打开。');
      const merged=mergeCachedAppsData(payload,currentData);
      setData(merged.data);setError('');setNotice(merged.retained.length?'部分信息暂时无法更新，继续显示上次成功的数据，稍后自动更新。':merged.failed.length?'部分信息待更新，其余可继续查看。':'');setRefreshRetryAt(merged.retryAt);
    }catch(cause){if(alive()){const fallback=cacheFallbackAllowed(cause),message=cause instanceof Error?cause.message:String(cause);
      if(fallback&&currentData?.bindings.some(binding=>binding.payload!==null))setNotice(`暂时无法更新，继续显示上次成功的数据：${message}`);
      else {setNotice('');setError(message);if(!fallback){setData(undefined);setRefreshedData(undefined);}}
      setRefreshRetryAt(fallback?cacheRetryAt(cause):0);}}
    finally{if(nativeRefresh.current===controller){nativeRefresh.current=undefined;if(alive())setRefreshingData(false);}}
  };
  const nativeCacheTimes=(currentData?.bindings??[]).map(binding=>object(object(binding.payload).cache)).map(cache=>Date.parse(String(cache.nextRefreshAt??cache.expiresAt??''))).filter(Number.isFinite);
  const nativeBackgroundRefreshing=(currentData?.bindings??[]).some(binding=>object(object(binding.payload).cache).refreshing===true);
  const nextNativeRefresh=nativeCacheTimes.length?Math.min(...nativeCacheTimes):undefined;
  useEffect(()=>{
    const next=nextNativeRefresh??(refreshRetryAt||undefined);
    if(source||!documentVisible||refreshingData||next===undefined||!currentVisible())return;
    const timer=setTimeout(()=>void refreshNative(false),Math.max(1000,Math.max(next,refreshRetryAt)-Date.now()));return()=>clearTimeout(timer);
  },[identity,source?.buildId,documentVisible,refreshingData,nextNativeRefresh,refreshRetryAt,active]);
  const abort=useMemo(()=>new AbortController(),[identity,source?.buildId,display?.displayId,visibilitySignal]);useEffect(()=>()=>abort.abort(),[abort]);
  const frameSignal=useMemo(()=>visibilitySignal?AbortSignal.any([abort.signal,visibilitySignal]):abort.signal,[abort,visibilitySignal]);
  const failing=useRef<string>();
  const reportError=async(problem:ComponentFrameError)=>{
    const original=display;if(!original||failing.current===original.displayId||!currentIdentity())return;
    const stillCurrent=()=>currentIdentity()&&live.current.displayId===original.displayId;
    failing.current=original.displayId;setError(problem.message);setDisplay(value=>value?.displayId===original.displayId?{...value,state:'failed'}:value);
    window.dispatchEvent(new CustomEvent('apps-display-failed',{detail:{sessionId,viewId,publicationId:original.publicationId,buildId:original.buildId,displayId:original.displayId,error:problem}}));
    try{await appsAuthoring(sessionId,'reportDisplayError',{viewId,publicationId:original.publicationId,buildId:original.buildId,displayId:original.displayId,displayGeneration:original.generation,error:{phase:problem.phase,code:problem.code,message:problem.message}},visibilitySignal?AbortSignal.any([visibilitySignal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000));if(stillCurrent())setNotice('实际加载错误已记录，Agent 可检查并修复；也可以重新打开此构建。');}
    catch(cause){if(stillCurrent())setNotice(`加载错误尚未同步给 Runtime：${cause instanceof Error?cause.message:String(cause)}。可以重新打开，原构建和工作副本保留。`);}
  };
  const reportRef=useRef(reportError);reportRef.current=reportError;
  const [preparedHandlers,setPreparedHandlers]=useState<{identity:string;buildId:string;displayId?:string;handlers:ExtendedComponentHandlers}>();
  useEffect(()=>{
    let active=true;if(!source){setPreparedHandlers(undefined);return;}
    const buildId=source.buildId,frameDisplay=display,framePublication=publication;
    void createAppsPresentationHandlers({sessionId,viewId,buildId},frameSignal,frameDisplay&&framePublication?{publicationId:framePublication.publicationId,attemptId:framePublication.attemptId,attemptEpoch:framePublication.attemptEpoch,displayId:frameDisplay.displayId,displayGeneration:frameDisplay.generation}:undefined,true,problem=>{if(currentIdentity()&&live.current.displayId===frameDisplay?.displayId)void reportRef.current(problem);},currentIdentity).then(handlers=>{
      if(!active||frameSignal.aborted||!currentIdentity())return;
      const authorize=handlers.authorizeFrame,refresh=handlers.refresh;let refreshSequence=0,authorizedFrameId:string|undefined;
      const updateTimes=refresh?async(request:Parameters<NonNullable<ExtendedComponentHandlers['refresh']>>[0])=>{
        const sequence=++refreshSequence,next=await refresh(request),payload=object(next);
        // Retain timing evidence without pushing another data event into the iframe.
        if(active&&sequence===refreshSequence&&(!authorize||authorizedFrameId===request.frameInstanceId)&&!frameSignal.aborted&&currentIdentity()&&live.current.displayId===frameDisplay?.displayId&&payload.viewId===viewId&&Array.isArray(payload.bindings))setRefreshedData({identity,buildId,displayId:frameDisplay?.displayId,data:next as unknown as AppsViewData});
        return next;
      }:undefined;
      setPreparedHandlers({identity,buildId,displayId:frameDisplay?.displayId,handlers:{...handlers,...(updateTimes?{refresh:updateTimes}:{}),...(authorize?{authorizeFrame:async(...args:Parameters<NonNullable<ExtendedComponentHandlers['authorizeFrame']>>)=>{if(!currentIdentity())throw new Error('原生会话已切换，组件授权已停止。');const granted=await authorize(...args);if(!currentIdentity())throw new Error('原生会话已切换，组件授权响应不再展示。');authorizedFrameId=args[0].frameInstanceId;return granted;}}:{})}});
    }).catch(cause=>{if(active&&!frameSignal.aborted&&currentIdentity()){const problem={phase:'authorization',code:String(object(cause).code??'DISPLAY_HANDLER_UNAVAILABLE'),message:cause instanceof Error?cause.message:String(cause)};if(frameDisplay)void reportRef.current(problem);else setError(problem.message);}});
    return()=>{active=false;};
  },[identity,source?.buildId,display?.displayId,frameSignal]);
  const handlers=preparedHandlers?.identity===identity&&preparedHandlers.buildId===source?.buildId&&preparedHandlers.displayId===display?.displayId?preparedHandlers.handlers:undefined;
  useEffect(()=>{
    const ready=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!currentIdentity()||!display||detail?.sessionId!==sessionId||detail.viewId!==viewId||detail.publicationId!==display.publicationId||detail.buildId!==display.buildId||detail.displayId!==display.displayId)return;setDisplay(value=>value?.displayId===display.displayId?{...value,state:'ready'}:value);setPublication(value=>value?{...value,state:'mounted'}:value);setView(value=>value&&Number.isSafeInteger(detail.viewRevision)&&detail.viewRevision>(value.viewRevision??0)?{...value,viewRevision:detail.viewRevision}:value);setError('');setNotice('');};
    const discover=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!expectedPublicationId&&!display&&currentIdentity()&&detail?.sessionId===sessionId&&detail.viewId===viewId&&detail.publicationId!==publication?.publicationId)setRevision(value=>value+1);};
    window.addEventListener('apps-display-ready',ready);window.addEventListener('apps-publication-discovered',discover);return()=>{window.removeEventListener('apps-display-ready',ready);window.removeEventListener('apps-publication-discovered',discover);};
  },[identity,display?.displayId,publication?.publicationId]);
  const open=async()=>{
    if(!publication||startInFlight.current||!currentVisible())return;
    const fixed=publication,originalGeneration=loadGeneration.current,displayId=globalThis.crypto.randomUUID(),target={sessionId,viewId,publicationId:fixed.publicationId,buildId:fixed.candidateBuildId,displayId};
    const stillCurrent=()=>currentVisible()&&loadGeneration.current===originalGeneration&&live.current.publicationId===fixed.publicationId;
    startInFlight.current=true;setStarting(true);setNotice('');
    try{const opened=await openOwnedPublicationDisplay(target,fixed,stillCurrent,visibilitySignal??new AbortController().signal);let payload=opened.data;
      if(!payload)payload=await read('viewData',sessionId,viewId,visibilitySignal??new AbortController().signal,{publicationId:fixed.publicationId,buildId:fixed.candidateBuildId,displayId,displayGeneration:opened.display.generation}) as AppsViewData;
      if(stillCurrent()){setView(opened.view);setData(payload);setRefreshedData(undefined);setPublication(opened.publication);setDisplay(opened.display);setError('');failing.current=undefined;}}
    catch(cause){if(stillCurrent())setNotice(cause instanceof Error?cause.message:String(cause));}
    finally{startInFlight.current=false;if(currentIdentity())setStarting(false);}
  };
  const automaticAttempt=useRef<string>();
  useEffect(()=>{
    if(!current||!publication||display||expectedDisplayId||!currentVisible())return;
    const key=JSON.stringify([identity,publication.publicationId]);
    if(automaticAttempt.current===key)return;
    automaticAttempt.current=key;void open();
  },[identity,loadedOwner,publication?.publicationId,display?.displayId,active]);
  const draft=!!current&&sourceDraft(current)&&!publication;
  const spec=current&&!current.source&&!draft?staticView(current):undefined;
  const bindings:BindingData[]=(currentData?.bindings??[]).map(binding=>{
    const metricBasis=binding.provenance.find(item=>typeof item.metricBasis==='string'&&item.metricBasis.trim())?.metricBasis;
    return {bindingId:binding.bindingId,datasetKey:binding.datasetId,payload:binding.payload,state:binding.state,lastSuccessAt:binding.lastSuccessAt??undefined,dataTime:binding.sourceDataTime??undefined,provenance:{source:'app_snapshot',endpoint:binding.provenance[0]?.sourceRef,freshness:binding.freshness,...(metricBasis?{metricBasis}:{})},...(metricBasis?{metricBasis}:{}),lastError:binding.error};
  });
  const timeData=refreshedData?.identity===identity&&refreshedData.buildId===source?.buildId&&refreshedData.displayId===display?.displayId?refreshedData.data:currentData;
  const sourceTimes=[...new Set((timeData?.bindings??[]).map(binding=>binding.sourceDataTime).filter((value):value is string=>!!value))],readTimes=[...new Set((timeData?.bindings??[]).map(binding=>binding.lastSuccessAt).filter((value):value is string=>!!value))];
  if(!currentIdentity())return null;
  const status=draft?'正在打磨，请稍候':display?.state==='failed'?'暂未打开，请再试一次':display?.state==='opening'?'正在为您展开':saved?`已保存到组件库 · 版本 ${saved.revision}`:display?.state==='ready'?'':publication?'新的模样，即将呈现':current?.validationStatus==='verified'?'':'本次会话的组件';
  const partial=(timeData?.bindings??[]).some(binding=>{const states=object(binding.payload).sourceStates;return Array.isArray(states)&&states.some(state=>object(state).status==='missing');});
  const visibleNotice=notice||(nativeBackgroundRefreshing?'正在后台更新 · 当前快照可继续查看':partial?'部分信息待更新，其余可继续查看。':saved?`已明确保存“${saved.title}”版本 ${saved.revision}。`:'');
  return <section className="hm-root hm-view apps-component"><style>{STYLES}{APPS_WORKSPACE_STYLES}{SIDEBAR_STATUS_STYLES}</style><header><div className="apps-component-heading"><span className="apps-component-mark"><AppsIcon name="component"/></span><div><h3>{current?.title??'应用组件'}</h3><p>{status}</p></div></div><div className="apps-component-actions">{publication&&(error||!display&&notice||display?.state==='failed')?<button type="button" disabled={starting} onClick={()=>void open()}>{starting?'正在打开…':'重试'}</button>:null}<button type="button" disabled={starting||refreshingData||!source&&nativeBackgroundRefreshing} onClick={()=>{if(source||!current)setRevision(value=>value+1);else void refreshNative(true);}}>{source||!current?'重新读取':refreshingData||nativeBackgroundRefreshing?'更新中…':'立即更新'}</button>{onOpenSidebar?<button type="button" onClick={onOpenSidebar}>侧栏查看</button>:null}</div></header>{currentData?<div className="apps-component-times"><span>源数据时间：{sourceTimes.length?sourceTimes.map(time=>appsDisplayTime(time)).join(' / '):'暂无时间证据'}</span><span>读取成功：{readTimes.length?readTimes.map(time=>appsDisplayTime(time)).join(' / '):'暂无成功读取时间'}</span></div>:null}{visibleNotice?<p role="status">{visibleNotice}</p>:null}{error?<ErrorView message={error}/>:!current||!currentData||source&&!handlers?<SidebarPreparing editing={draft||!!publication}/>:<RenderBoundary key={JSON.stringify([identity,display?.displayId])}>{source&&handlers?<AppsSourceFrame active={active} key={display?.displayId??'active'} frameKey={display?.displayId} sessionId={sessionId} viewId={viewId} buildId={source.buildId} title={current.title} url={`/api/hallmark-source/${encodeURIComponent(source.buildId)}/${source.entry.split('/').map(encodeURIComponent).join('/')}`} data={currentData as unknown as JsonValue} context={display?undefined:{sessionId,viewId,buildId:source.buildId,contextRevision:0}} handlers={handlers} onFrameError={display?problem=>void reportRef.current(problem):undefined} onLoadError={display?undefined:()=>setError('组件构建未能加载，请重新读取。')}/>:publication?<SidebarPreparing/>:draft?<SidebarPreparing editing/>:spec?<ViewRenderer spec={spec} data={bindings}/>:<EmptyView message="组件设计尚无对应展示器" detail="源码组件可按原构建打开；请查看此调用的原生文字结果。"/>}</RenderBoundary>}</section>;
}
export function AppsToolView(props:{sessionId?:string;phase?:string;block?:{meta?:unknown};sidebarRight?:NativeSidebarRight}) {
  const reference=appsToolViewReference(props),[notice,setNotice]=useState(''),[title,setTitle]=useState('应用组件'),[draft,setDraft]=useState<boolean>(),[publication,setPublication]=useState<ViewPublication>(),[display,setDisplay]=useState<ComponentDisplay>(),[opening,setOpening]=useState<string>(),inFlight=useRef<string>(),openingController=useRef<{fixed:string;controller:AbortController}>();
  const fixed=JSON.stringify(reference);
  const live=useRef({fixed,active:true});live.current.fixed=fixed;
  useEffect(()=>()=>{live.current.active=false;openingController.current?.controller.abort();},[]);
  useEffect(()=>{setTitle('应用组件');setDraft(undefined);setNotice('');setPublication(undefined);if(!reference)return;const controller=new AbortController();read('view',reference.sessionId,reference.viewId,controller.signal,reference).then(value=>{const view=value as AppsView&{publication?:ViewPublication};if(view.ownerSessionId!==reference.sessionId||view.viewId!==reference.viewId)throw new Error('原消息的组件身份不一致。');const original=reference.publicationId?ownedPublication({...reference,publicationId:reference.publicationId},view):undefined;if(!controller.signal.aborted){setTitle(view.title);setDraft(sourceDraft(view)&&!original);setPublication(original);}}).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:String(error));});return()=>controller.abort();},[fixed]);
  useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!reference||!live.current.active||live.current.fixed!==fixed||detail?.sessionId!==reference.sessionId||detail.viewId!==reference.viewId||detail.publicationId!==reference.publicationId||reference.buildId&&detail.buildId!==reference.buildId||detail.displayId!==display?.displayId)return;if(event.type==='apps-display-ready'){setPublication(value=>value?{...value,state:'mounted'}:value);setDisplay(value=>value?{...value,state:'ready'}:value);}else{setDisplay(value=>value?{...value,state:'failed'}:value);setNotice(String(detail.error?.message??'组件加载失败，可以重新打开；Agent 可检查实际错误。'));}};window.addEventListener('apps-display-ready',receive);window.addEventListener('apps-display-failed',receive);return()=>{window.removeEventListener('apps-display-ready',receive);window.removeEventListener('apps-display-failed',receive);};},[fixed,display?.displayId]);
  const open=async()=>{
    if(!reference||inFlight.current===fixed)return;
    const original=reference,isCurrent=()=>live.current.active&&live.current.fixed===fixed&&props.sidebarRight?.mounted.getSnapshot()===original.sessionId;
    if(!isCurrent()){setNotice('请切回组件所属聊天后重新打开。');return;}
    openingController.current?.controller.abort();inFlight.current=fixed;setOpening(fixed);setNotice('');
    const controller=new AbortController(),signal=controller.signal;openingController.current={fixed,controller};
    try{
      let displayId:string|undefined;
      if(original.publicationId){const target={...original,publicationId:original.publicationId,displayId:globalThis.crypto.randomUUID()},value=await read('view',original.sessionId,original.viewId,AbortSignal.any([signal,AbortSignal.timeout(5000)]),original) as AppsView&{publication?:ViewPublication};if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');const prepared=ownedPublication(target,value),opened=await openOwnedPublicationDisplay(target,prepared,isCurrent,signal);if(!isCurrent())throw new Error('会话已切换，请切回组件所属聊天后重新打开。');setPublication(opened.publication);setDisplay(opened.display);displayId=opened.display.displayId;}
      const result=openSessionComponents(props.sidebarRight,original.sessionId,original.viewId,original.publicationId,displayId);if(!result.ok)throw new Error(result.message??'Native sidebar is unavailable.');
    }catch(cause){if(live.current.active&&live.current.fixed===fixed)setNotice(cause instanceof Error?cause.message:String(cause));}
    finally{if(inFlight.current===fixed)inFlight.current=undefined;if(openingController.current?.controller===controller)openingController.current=undefined;if(live.current.active&&live.current.fixed===fixed)setOpening(undefined);}
  };
  return <div className="hm-root apps-tool-result"><style>{STYLES}{APPS_WORKSPACE_STYLES}</style>{notice?<p role="status">{notice}</p>:null}{props.phase!=='result'?<LoadingView/>:reference?<section className="hm-root apps-component" data-view-id={reference.viewId} data-publication-id={reference.publicationId} data-build-id={reference.buildId} data-view-revision={reference.viewRevision}><header><div className="apps-component-heading"><span className="apps-component-mark"><AppsIcon name="component"/></span><div><h3>{title}</h3><p>{draft?'组件正在制作，尚未构建':display?.state==='failed'?'展示失败 · 可以重新打开':display?.state==='opening'?'正在加载原构建':display?.state==='ready'||publication?.state==='mounted'?'已展示':publication?'已准备好 · 在右侧展示':'打开此工作视图；原发布记录保留'}</p></div></div>{(draft===false||reference.publicationId)?<button type="button" disabled={opening===fixed} title="在当前聊天右侧打开原消息的固定组件发布" onClick={()=>void open()}>{opening===fixed?'正在打开…':display?'重新打开组件 ↗':'打开组件 ↗'}</button>:null}</header></section>:<EmptyView message="此调用没有可展示的 Apps 组件" detail="请查看原生文字结果。"/>}</div>;
}
