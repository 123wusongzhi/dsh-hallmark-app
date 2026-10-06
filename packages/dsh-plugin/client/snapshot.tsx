import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BindingData, ViewSpec } from '../../presentation/src/types.ts';
import { validateViewSpec } from '../../presentation/src/validation.ts';
import { HallmarkBridge } from './api.ts';
import { refreshDatasetKeys, sourceTime } from './model.ts';
import { EmptyView, ErrorView, LoadingView, RenderBoundary, ViewRenderer } from './renderer.tsx';
import { STYLES } from './styles.ts';
import { ProductSelectionProvider } from './selection-context.tsx';
import { AppIcon } from './icons.tsx';
import { isSourceView } from './source-bridge.ts';
import { SourceFrame } from './source-frame.tsx';
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'应用连接失败，请重试。';
export function SnapshotView({sessionId,viewId,owned=false,onOpenSidebar}:{sessionId:string;viewId:string;owned?:boolean;onOpenSidebar?:()=>void}){
  const bridge=useMemo(()=>new HallmarkBridge(sessionId),[sessionId]);const identity=JSON.stringify([owned?'session':'global',sessionId,viewId]);const [loadedIdentity,setLoadedIdentity]=useState<string|undefined>();
  const [spec,setSpec]=useState<ViewSpec|undefined>();const [data,setData]=useState<BindingData[]>([]);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [version,setVersion]=useState(0);const refreshAbort=useRef<AbortController|undefined>(undefined);
  const currentIdentity=useRef(identity);currentIdentity.current=identity;const sourceRefreshPromise=useRef<Promise<BindingData[]>|undefined>();
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setNotice('');setSpec(undefined);setLoadedIdentity(undefined);setData([]);
    (async()=>{try{
      const [view,result]=await Promise.all(owned?[bridge.sessionView(viewId,controller.signal),bridge.sessionViewData(viewId,controller.signal)]:[bridge.view(viewId,controller.signal),bridge.viewData(viewId,controller.signal)]);if(!isSourceView(view))validateViewSpec(view);if(view.id!==viewId||result.data&&result.data.viewId!==viewId)throw new Error('组件响应标识不匹配。');
      if(controller.signal.aborted)return;setSpec(view);setLoadedIdentity(identity);setData((result.data?.bindings??[]).map(binding=>({...binding,dataTime:sourceTime(binding.dataTime),lastSuccessAt:sourceTime(binding.lastSuccessAt)})));
      if(result.error?.code==='SNAPSHOT_EMPTY')setNotice('部分或全部数据暂无成功快照，可查询或主动刷新。');
      else if(result.status!=='ok'&&result.status!=='partial')setError(result.error?.message??'快照读取失败。');
    }catch(e){if(!controller.signal.aborted)setError(errorMessage(e));}finally{if(!controller.signal.aborted)setLoading(false);}})();
    return()=>controller.abort();
  },[bridge,viewId,version,owned]);
  useEffect(()=>{setRefreshing(false);sourceRefreshPromise.current=undefined;return()=>refreshAbort.current?.abort();},[bridge,viewId,owned]);
  useEffect(()=>{
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(!detail||detail.sessionId&&detail.sessionId!==sessionId)return;
      const matchesDataset=typeof detail.datasetKey==='string'&&loadedIdentity===identity&&spec?.bindings.some(binding=>binding.datasetKey===detail.datasetKey);
      if(detail.viewId===viewId||matchesDataset)setVersion(value=>value+1);
    };
    window.addEventListener('hallmark:component-changed',changed);
    window.addEventListener('hallmark-view-updated',changed);
    return()=>{window.removeEventListener('hallmark:component-changed',changed);window.removeEventListener('hallmark-view-updated',changed);};
  },[sessionId,viewId,spec,loadedIdentity,identity]);
  const currentSpec=loadedIdentity===identity?spec:undefined;
  const keys=currentSpec?refreshDatasetKeys(currentSpec):[];
  const refreshSource=():Promise<BindingData[]>=>{
    if(sourceRefreshPromise.current)return sourceRefreshPromise.current;
    if(!keys.length)return Promise.reject(new Error('此组件没有可刷新的数据绑定，请让 Agent 更新数据。'));
    const controller=new AbortController();refreshAbort.current=controller;setRefreshing(true);setError('');setNotice('');
    const request=(async()=>{
      try{
        for(const datasetKey of keys){const result=await bridge.refresh(datasetKey,controller.signal,false);if(result.status==='pending')throw new Error('刷新任务处理中，请稍后重试读取。');if(result.status!=='ok')throw new Error(result.error?.message??'刷新失败，仍可使用上次成功数据。');}
        const result=await (owned?bridge.sessionViewData(viewId,controller.signal):bridge.viewData(viewId,controller.signal));
        if(controller.signal.aborted||currentIdentity.current!==identity)throw new Error('会话已切换，请重新打开组件。');
        if(!result.data||result.data.viewId!==viewId||!['ok','partial'].includes(result.status))throw new Error(result.error?.message??'刷新后的数据尚未就绪。');
        const next=result.data.bindings.map(binding=>({...binding,dataTime:sourceTime(binding.dataTime),lastSuccessAt:sourceTime(binding.lastSuccessAt)}));setData(next);return next;
      }catch(reason){if(!controller.signal.aborted&&currentIdentity.current===identity)setError(errorMessage(reason));throw reason;}
      finally{if(!controller.signal.aborted&&currentIdentity.current===identity){setRefreshing(false);sourceRefreshPromise.current=undefined;}}
    })();sourceRefreshPromise.current=request;return request;
  };
  const refresh=async()=>{
    if(currentSpec&&isSourceView(currentSpec)){try{await refreshSource();}catch{}return;}
    if(refreshing||!keys.length)return;const controller=new AbortController();refreshAbort.current=controller;setRefreshing(true);setError('');
    try{for(const datasetKey of keys){const result=await bridge.refresh(datasetKey,controller.signal);
      if(result.status!=='ok'&&result.status!=='pending')throw new Error(result.error?.message??'刷新失败，仍可使用上次成功数据。');
      if(result.status==='pending'){if(!controller.signal.aborted)setNotice('刷新任务处理中，可稍后点击重试读取查看进度。');return;}
    }if(!controller.signal.aborted)setVersion(v=>v+1);}catch(e){if(!controller.signal.aborted)setError(errorMessage(e));}finally{if(!controller.signal.aborted)setRefreshing(false);}
  };
  const singleWidget=currentSpec?.widgets.length===1?currentSpec.widgets[0]:undefined;
  const subtitle=singleWidget?.title&&singleWidget.title!==currentSpec?.title?singleWidget.title:undefined;
  return <section className="hm-root hm-view hm-snapshot" data-single-widget={Boolean(singleWidget)} aria-busy={loading||refreshing}>
    <style>{STYLES}</style>
    <header className="hm-snapshot-header">
      <div className="hm-snapshot-heading"><span className="hm-snapshot-icon"><AppIcon name={singleWidget?.type==='table'?'table':'layers'} size={21}/></span><div><h3>{currentSpec?.title??'组件视图'}</h3>{subtitle?<p>{subtitle}</p>:null}</div></div>
      <div className="hm-actions hm-snapshot-actions">
        {onOpenSidebar?<button type="button" onClick={onOpenSidebar} disabled={loading||!currentSpec}>侧栏查看</button>:null}
        <button className="hm-snapshot-reload" type="button" aria-label="重试读取" title="重试读取已保存的组件与快照" onClick={()=>setVersion(v=>v+1)} disabled={loading}><AppIcon name="refresh" size={15}/><span>重试读取</span></button>
        <button className="hm-snapshot-refresh" type="button" onClick={refresh} disabled={loading||refreshing||!keys.length} title={keys.length?'仅更新绑定数据，不修改业务或布局':'该临时结果或数据集不支持刷新'}><AppIcon name="refresh" size={15}/>{refreshing?'更新中…':'刷新数据'}</button>
      </div>
    </header>
    {notice?<p className="hm-live" role="status">{notice}</p>:null}{error?<ErrorView message={error}/>:null}
    {loading?<LoadingView/>:currentSpec?<RenderBoundary key={`${identity}:${version}`}>{isSourceView(currentSpec)?<SourceFrame sessionId={sessionId} spec={currentSpec} data={data} disabled={refreshing} onRefresh={refreshSource}/>:<ProductSelectionProvider sessionId={sessionId} spec={currentSpec} data={data} disabled={refreshing}><ViewRenderer spec={currentSpec} data={data}/></ProductSelectionProvider>}</RenderBoundary>:!error?<EmptyView/>:null}
  </section>;
}
