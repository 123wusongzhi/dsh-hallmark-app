import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {AppsBindingData,DataSourceDefinition,ReadWorkbenchInstanceInput,Workbench,WorkbenchInstance,WorkbenchInstanceData,WorkbenchSavedComponent} from '../../app-presentation/src/types.ts';
import type {BindingData,ViewSpec} from '../../presentation/src/types.ts';
import {ViewRenderer,RenderBoundary} from '../../dsh-plugin/client/renderer.tsx';
import type {MaterialQuery,ViewInteractions} from '../../dsh-plugin/client/material-interactions.ts';
import {STYLES} from '../../dsh-plugin/client/styles.ts';
import {valueAt} from '../../dsh-plugin/client/model.ts';
import {appsResource,appsWorkbench,mergeCachedAppsData,type WorkbenchStoreOption,type WorkbenchStores} from './api.ts';
import {cacheFallbackAllowed,cacheRetryAt} from '../../presentation/src/cache-display.ts';
import {AppsIcon,appsDisplayTime} from './ui.tsx';
import {OZON_COMPOSITION_SOURCES} from '../../app-hallmark/src/ozon-composition.ts';
import {ProcurementPlanControls,procurementParametersForStore,procurementResultSummary,type ProcurementPlan} from './procurement-plan.tsx';
import {MaterialThumbnail} from './material-thumbnail.tsx';
import {WORKBENCH_CARDS_STYLES} from './workbench-cards.css.ts';

export const workbenchRefs=(instance:WorkbenchInstance)=>instance.dataSources??(instance.dataSource?{[(instance.design as unknown as ViewSpec).bindings[0]?.id??'main']:instance.dataSource}:{});
const failure=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);

export function workbenchBindingData(binding:AppsBindingData):BindingData{
  return {bindingId:binding.bindingId,datasetKey:binding.datasetId,payload:binding.payload,state:binding.state,lastSuccessAt:binding.lastSuccessAt??undefined,dataTime:binding.sourceDataTime??undefined,lastError:binding.error,provenance:{source:'app_snapshot',endpoint:binding.provenance[0]?.sourceRef,freshness:binding.freshness}};
}

/** The edited display configuration is independent of a fetched data snapshot. */
export function workbenchDisplaySpec(instance:WorkbenchInstance,result:WorkbenchInstanceData):ViewSpec{
  const display=instance.design as unknown as ViewSpec,derived=result.view.design as unknown as ViewSpec;
  return {...derived,...display,id:result.view.viewId,bindings:derived.bindings,links:derived.links,widgets:display.widgets.map(widget=>{
    const bound=derived.widgets.find(item=>item.id===widget.id);
    const options={...bound?.options,...widget.options};
    // Dataset interpretation is owned by the chosen source, never a previous preview.
    for(const key of ['rowsPath','fieldMeta','operations']){delete options[key];if(bound?.options&&Object.hasOwn(bound.options,key))options[key]=bound.options[key];}
    options.example=false;
    return {...widget,...(widget.type==='table'&&!widget.columns?.length&&!Array.isArray(widget.options?.displayColumns)?{columns:bound?.columns??widget.columns}:{}),fields:bound?.fields??widget.fields,options};
  })};
}

export function WorkbenchInstanceView({appId,instance,context,previewSessionId,preview=false,onReady,onSnapshot,onRefreshing,refreshKey=0,onBindingParametersChange,parametersBusy=false}:{appId:string;instance:WorkbenchInstance;context?:Workbench['context'];previewSessionId?:string;preview?:boolean;onReady?:(ready:boolean)=>void;onSnapshot?:(snapshot:WorkbenchInstanceData|undefined)=>void;onRefreshing?:(refreshing:boolean)=>void;refreshKey?:number;onBindingParametersChange?:(bindingId:string,params:Record<string,JsonValue>)=>void|Promise<void>;parametersBusy?:boolean}){
  const [snapshot,setResult]=useState<WorkbenchInstanceData>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState<Record<string,string>>({}),[linkedProducts,setLinkedProducts]=useState<Record<string,string>>({}),[pending,setPending]=useState<Record<string,boolean>>({});
  const [retryAt,setRetryAt]=useState(0),[visible,setVisible]=useState(()=>typeof document==='undefined'||!document.hidden);
  const requests=useRef(new Map<string,AbortController>()),serial=useRef(0),resultIdentity=useRef('');
  const queryOverrides=useRef<Record<string,Record<string,JsonValue>>>({});
  const [,setLocalQueryRevision]=useState(0);
  const design=instance.design as unknown as ViewSpec;
  const identity=JSON.stringify([appId,context?.storeId,instance.instanceId,workbenchRefs(instance),design.bindings.map(binding=>binding.id),design.links,design.widgets.map(widget=>[widget.id,widget.bindingId,widget.options?.requiresSelection]),preview,previewSessionId]);
  const result=resultIdentity.current===identity?snapshot:undefined;
  const snapshotRef=useRef(result);snapshotRef.current=result;
  const live=useRef({appId,instance,context,identity,preview,previewSessionId,onReady,onSnapshot,onRefreshing});live.current={appId,instance,context,identity,preview,previewSessionId,onReady,onSnapshot,onRefreshing};
  const scope=useRef(globalThis.crypto?.randomUUID?.()??`workbench-${Date.now()}-${Math.random()}`);
  const read=async(input:ReadWorkbenchInstanceInput={})=>{
    if(input.forceRefresh&&snapshotRef.current?.data.bindings.some(binding=>{const payload=binding.payload as {cache?:{refreshing?:boolean}}|null;return payload?.cache?.refreshing===true;}))return;
    const target=live.current,slot=input.bindingId??'*',generation=serial.current,controller=new AbortController();
    requests.current.get(slot)?.abort();requests.current.set(slot,controller);
    if(slot==='*'){setLoading(true);target.onReady?.(false);}else setPending(value=>({...value,[slot]:true}));setError('');setNotice('');
    try{
      const next=await appsWorkbench<WorkbenchInstanceData>(target.appId,target.preview?'preview':'read',{...(target.preview?{instance:target.instance}:{instanceId:target.instance.instanceId}),...input,...(target.context?{context:target.context}:{}),scope:scope.current},controller.signal,target.previewSessionId);
      if(controller.signal.aborted||serial.current!==generation||live.current.identity!==target.identity)return;
      const previous=snapshotRef.current,received=input.bindingId&&previous?{...next.data,bindings:previous.data.bindings.map(binding=>binding.bindingId===input.bindingId?next.data.bindings.find(item=>item.bindingId===input.bindingId)??binding:binding)}:next.data;
      const pagingCursorParams:Record<string,string>={};
      if(previous&&(input.bindingId&&input.cursor!==undefined||!input.bindingId&&input.refresh!==false))for(const binding of received.bindings){
        if(input.bindingId&&input.bindingId!==binding.bindingId)continue;
        const before=previous.dataSources[binding.bindingId],after=next.dataSources[binding.bindingId],cursor=after?.operations.pagination?.cursorParam;
        if(cursor&&before?.operations.pagination?.cursorParam===cursor&&['id','revision','appId','connectionId','capabilityId','capabilityMajor'].every(key=>before[key as keyof DataSourceDefinition]===after[key as keyof DataSourceDefinition]))pagingCursorParams[binding.bindingId]=cursor;
      }
      const merged=mergeCachedAppsData(received,previous?.data,pagingCursorParams),failed=new Set(merged.failed),pages=input.bindingId&&previous?{...previous.pages,[input.bindingId]:next.pages[input.bindingId]}:{...next.pages};
      for(const bindingId of merged.retained)if(previous?.pages[bindingId])pages[bindingId]=previous.pages[bindingId];
      const accepted={...next,pages,data:merged.data};
      resultIdentity.current=target.identity;
      snapshotRef.current=accepted;setResult(accepted);setRetryAt(merged.retryAt);
      if(input.bindingId&&!failed.has(input.bindingId)){if(input.params)queryOverrides.current[input.bindingId]=input.params;if(Object.hasOwn(input,'cursor')||input.params)clearLinkedSelection(input.bindingId);}
      const blocking=merged.data.bindings.find(binding=>failed.has(binding.bindingId)&&!cacheFallbackAllowed(binding.error));
      if(blocking)setError(blocking.error?.message??'数据读取失败，请检查连接后重试。');
      else if(merged.retained.length)setNotice('部分信息暂时无法更新，继续显示上次成功的数据，稍后自动更新。');
      else if(merged.failed.length)setNotice('部分信息待更新，其余可继续查看。');
      target.onSnapshot?.(accepted);
      target.onReady?.(!merged.failed.length&&!accepted.data.bindings.some(binding=>{const payload=binding.payload as {sourceStates?:{status?:string}[]}|null;return Array.isArray(payload?.sourceStates)&&payload.sourceStates.some(source=>source.status==='missing');}));
    }catch(cause){if(!controller.signal.aborted&&serial.current===generation&&live.current.identity===target.identity){const fallback=cacheFallbackAllowed(cause),previous=snapshotRef.current;
      if(fallback&&previous?.data.bindings.some(binding=>binding.payload!==null))setNotice(`暂时无法更新，继续显示上次成功的数据：${failure(cause)}`);
      else {setError(failure(cause));if(!fallback){snapshotRef.current=undefined;setResult(undefined);setSelected({});setLinkedProducts({});queryOverrides.current={};target.onSnapshot?.(undefined);}}
      setRetryAt(fallback?cacheRetryAt(cause):0);target.onReady?.(false);}}
    finally{if(!controller.signal.aborted&&serial.current===generation&&live.current.identity===target.identity){if(slot==='*')setLoading(false);else setPending(value=>({...value,[slot]:false}));requests.current.delete(slot);}}
  };
  useEffect(()=>{
    serial.current++;snapshotRef.current=undefined;setResult(undefined);setError('');setNotice('');setPending({});setSelected({});setLinkedProducts({});setRetryAt(0);queryOverrides.current={};live.current.onSnapshot?.(undefined);
    void read();
    return()=>{serial.current++;for(const controller of requests.current.values())controller.abort();requests.current.clear();};
  },[identity]);
  const lastRefreshKey=useRef(refreshKey);
  useEffect(()=>{if(lastRefreshKey.current===refreshKey)return;lastRefreshKey.current=refreshKey;void read({refresh:true,forceRefresh:true});},[refreshKey]);
  useEffect(()=>{if(typeof document==='undefined')return;const changed=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
  const cacheStates=(result?.data.bindings??[]).flatMap(binding=>{const payload=binding.payload&&typeof binding.payload==='object'&&!Array.isArray(binding.payload)?binding.payload:{};const cache=payload.cache;return cache&&typeof cache==='object'&&!Array.isArray(cache)?[cache]:[];});
  const backgroundRefreshing=cacheStates.some(cache=>cache.refreshing===true);
  useEffect(()=>{live.current.onRefreshing?.(loading||backgroundRefreshing);},[identity,loading,backgroundRefreshing]);
  useEffect(()=>()=>live.current.onRefreshing?.(false),[]);
  const nextUpdates=cacheStates.map(cache=>Date.parse(String(cache.nextRefreshAt??cache.expiresAt??''))).filter(Number.isFinite),nextUpdate=nextUpdates.length?Math.min(...nextUpdates):undefined;
  useEffect(()=>{
    const next=nextUpdate??(retryAt||undefined);
    if(!visible||loading||Object.values(pending).some(Boolean)||next===undefined)return;
    const timer=setTimeout(()=>void read({refresh:true,forceRefresh:false}),Math.max(1000,Math.max(next,retryAt)-Date.now()));
    return()=>clearTimeout(timer);
  },[identity,visible,loading,JSON.stringify(pending),nextUpdate,retryAt,error]);
  const spec=result?workbenchDisplaySpec(instance,result):undefined;
  const clearLinkedSelection=(bindingId:string)=>{
    const widgets=spec?.widgets.filter(widget=>widget.bindingId===bindingId).map(widget=>widget.id)??[],links=spec?.links?.filter(link=>widgets.includes(link.from.widgetId))??[];
    setSelected(current=>Object.fromEntries(Object.entries(current).filter(([id])=>!widgets.includes(id))));
    setLinkedProducts(current=>Object.fromEntries(Object.entries(current).filter(([id])=>!links.some(link=>link.to.bindingId===id))));
    for(const link of links){requests.current.get(link.to.bindingId)?.abort();requests.current.delete(link.to.bindingId);delete queryOverrides.current[link.to.bindingId];}
  };
  const select:NonNullable<ViewInteractions['onSelect']>=event=>{
    setSelected(value=>({...value,[event.widgetId]:event.value}));
    for(const link of spec?.links??[]){if(link.from.widgetId!==event.widgetId||link.from.field!==event.field)continue;
      const bindingId=link.to.bindingId;setLinkedProducts(value=>({...value,[bindingId]:event.value}));
      const source=result?.dataSources[bindingId],parameter=source?.parameters.find(item=>item.name===link.to.param),value:JsonValue=parameter&&['number','integer'].includes(parameter.type)?Number(event.value):event.value;
      queryOverrides.current[bindingId]={...queryOverrides.current[bindingId],[link.to.param]:value};
      // Clear the old product's rows while its successor is in flight.
      setResult(previous=>previous?{...previous,data:{...previous.data,bindings:previous.data.bindings.map(binding=>binding.bindingId===bindingId?{...binding,payload:null,state:'empty'}:binding)}}:previous);
      void read({bindingId,params:queryOverrides.current[bindingId],refresh:true});
    }
  };
  const interactions:ViewInteractions={selectedByWidget:selected,onSelect:select,bindings:{}};
  if(result)for(const [bindingId,source] of Object.entries(result.dataSources)){
    const binding=result.data.bindings.find(item=>item.bindingId===bindingId),rows=source.rowsPath?valueAt(binding?.payload,source.rowsPath):binding?.payload,count=Array.isArray(rows)?rows.length:0;
    const page=result.pages?.[bindingId],payload=binding?.payload,queryInput=binding?.query?.input;
    const fullDataset=!!queryInput&&typeof queryInput==='object'&&!Array.isArray(queryInput)&&queryInput.loadAll===true&&!!payload&&typeof payload==='object'&&!Array.isArray(payload)&&typeof payload.total==='number'&&payload.total===count&&!payload.cursor&&!page?.hasMore;
    const query=(next:MaterialQuery)=>{
      const parameters={...queryOverrides.current[bindingId]};
      if(fullDataset){queryOverrides.current[bindingId]={...parameters,query:next.search};setLocalQueryRevision(value=>value+1);return;}
      if(source.operations.search.scope==='server'&&source.operations.search.param)parameters[source.operations.search.param]=next.search;
      if(source.operations.sort.scope==='server'&&source.operations.sort.param){if(next.sort){parameters[source.operations.sort.param]=source.fields.find(field=>(field.key??field.role)===next.sort?.field)?.path??next.sort.field;if(source.operations.sort.directionParam)parameters[source.operations.sort.directionParam]=next.sort.direction;}else {delete parameters[source.operations.sort.param];if(source.operations.sort.directionParam)delete parameters[source.operations.sort.directionParam];}}
      void read({bindingId,params:parameters,refresh:true});
    };
    const appliedSearch=fullDataset?(queryOverrides.current[bindingId]?.query??workbenchRefs(instance)[bindingId]?.params?.query):source.operations.search.param&&queryInput&&typeof queryInput==='object'&&!Array.isArray(queryInput)?queryInput[source.operations.search.param]:undefined;
    interactions.bindings![bindingId]={selectedProductId:linkedProducts[bindingId],appliedSearch:typeof appliedSearch==='string'?appliedSearch:'',fullDataset,operations:{search:source.operations.search.scope,sort:source.operations.sort.scope},pagination:{hasMore:page?.hasMore??false,total:fullDataset?count:page?.total,loadedCount:page?.loadedCount??count,loading:!!pending[bindingId]},...(!fullDataset&&page?.hasMore?{onPage:()=>{void read({bindingId,cursor:page.nextCursor??undefined,params:queryOverrides.current[bindingId]});}}:{}),...(fullDataset||source.operations.search.scope==='server'||source.operations.sort.scope==='server'?{onQueryChange:query}:{})};
  }
  const snapshotTimes=cacheStates.map(cache=>cache.fetchedAt).filter((time):time is string=>typeof time==='string'&&Number.isFinite(Date.parse(time)));
  const times=[...new Set(snapshotTimes.length?snapshotTimes:(result?.data.bindings??[]).map(binding=>binding.lastSuccessAt).filter((time):time is string=>!!time))];
  const tableBindings=new Set(spec?.widgets.filter(widget=>widget.type==='table').map(widget=>widget.bindingId));
  const notices=(result?.data.bindings??[]).flatMap(binding=>{const payload=binding.payload&&typeof binding.payload==='object'&&!Array.isArray(binding.payload)?binding.payload:{};return Array.isArray(payload.warnings)?payload.warnings.filter((value):value is string=>typeof value==='string'):[];});
  const sourceReads=(result?.data.bindings??[]).flatMap(binding=>{const payload=binding.payload&&typeof binding.payload==='object'&&!Array.isArray(binding.payload)?binding.payload:{};return Array.isArray(payload.sourceStates)?payload.sourceStates.filter((value):value is {source:string;fetchedAt:string|null;cacheHit:boolean;status?:string}=>!!value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.source==='string'&&(typeof value.fetchedAt==='string'||value.fetchedAt===null)&&typeof value.cacheHit==='boolean'):[];});
  const partial=sourceReads.some(item=>item.status==='missing');
  const procurementBindings=[...new Set(design.widgets.filter(widget=>widget.options?.materialId==='product-procurement').map(widget=>widget.bindingId).filter((id):id is string=>!!id))];
  return <div className="apps-workbench-render"><style>{STYLES}</style>
    {onBindingParametersChange?procurementBindings.map(bindingId=>{
      const payload=result?.data.bindings.find(binding=>binding.bindingId===bindingId)?.payload,data=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:undefined,plan=data?.plan,cache=data?.cache;
      return <ProcurementPlanControls key={`${bindingId}:${context?.storeId??''}`} params={{...workbenchRefs(instance)[bindingId]?.params,...queryOverrides.current[bindingId]}} plan={plan&&typeof plan==='object'&&!Array.isArray(plan)&&(plan.mode==='delivery'||plan.mode==='platform'||plan.mode==='custom')?plan as unknown as ProcurementPlan:undefined} resultSummary={procurementResultSummary(data?.products)} fullDataset={interactions.bindings?.[bindingId]?.fullDataset} resultLoading={loading||!!pending[bindingId]||!!cache&&typeof cache==='object'&&!Array.isArray(cache)&&cache.refreshing===true} resultStale={!!cache&&typeof cache==='object'&&!Array.isArray(cache)&&cache.stale===true} disabled={parametersBusy} onApply={async params=>{const next={...params},cursor=result?.dataSources[bindingId]?.operations.pagination?.cursorParam;if(cursor)delete next[cursor];await onBindingParametersChange(bindingId,next);}}/>;
    }):null}
    {cacheStates.length?<div className="apps-remote-page apps-cache-status"><span role="status">{loading||backgroundRefreshing?'正在后台更新 · 当前快照可继续查看':partial?'部分信息待更新，其余可继续查看':cacheStates.some(cache=>cache.stale===true)?'显示上次快照 · 稍后自动更新':'快照每 15 分钟更新'}</span><button type="button" disabled={loading||backgroundRefreshing} onClick={()=>void read({refresh:true,forceRefresh:true})}>{loading||backgroundRefreshing?'更新中…':'立即更新'}</button></div>:null}
    {notice?<p className="apps-notice" role="status">{notice}</p>:null}
    {error?<div className="apps-notice is-error" role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={()=>void read({refresh:true,forceRefresh:true})}>重试读取</button></div>:null}
    {loading&&!result?<div className="apps-instance-loading" role="status"><span className="apps-loading-dot"/>正在打开快照；首次准备完成后自动显示…</div>:spec&&result?<RenderBoundary key={`${instance.instanceId}:${context?.storeId??''}`}><ViewRenderer spec={spec} data={result.data.bindings.map(workbenchBindingData)} interactions={interactions}/></RenderBoundary>:null}
    {notices.length||sourceReads.length?<details className="apps-data-notes"><summary>数据说明</summary>{sourceReads.some(item=>item.cacheHit)?<p className="apps-muted">优先显示上次完整快照，有效期 15 分钟。自动或手动更新在后台完成，平台限流时继续保留已有数据。</p>:null}{sourceReads.length?<p className="apps-muted">来源读取时间：{sourceReads.map(item=>`${OZON_COMPOSITION_SOURCES.find(source=>source.key===item.source)?.label??'关联资料'} ${item.fetchedAt?appsDisplayTime(item.fetchedAt):'待更新'}`).join(' · ')}</p>:null}{[...new Set(notices)].map(notice=><p className="apps-muted" key={notice}>{notice}</p>)}</details>:null}
    {Object.entries(result?.pages??{}).filter(([bindingId,page])=>!interactions.bindings?.[bindingId]?.fullDataset&&(!!page.cursor||tableBindings.has(bindingId)&&page.hasMore)).map(([bindingId,page])=><div className="apps-remote-page" key={bindingId}>
      <span>{result?.dataSources[bindingId]?.title} · 本批 {page.loadedCount} 条{page.total!==undefined?` / 共 ${page.total} 条`:''}{page.cursor?' · 当前显示另一批数据':''} · 表格搜索与排序仅作用于当前批次</span>
      {page.cursor?<button type="button" disabled={pending[bindingId]} onClick={()=>{void read({bindingId,cursor:null,params:queryOverrides.current[bindingId]});}}>返回第一批</button>:null}
      {tableBindings.has(bindingId)&&page.hasMore?<button type="button" disabled={pending[bindingId]} onClick={()=>{void read({bindingId,cursor:page.nextCursor??undefined,params:queryOverrides.current[bindingId]});}}>{pending[bindingId]?'正在读取下一批…':'下一批数据'}</button>:null}
    </div>)}
    {times.length?<p className="apps-instance-time">{snapshotTimes.length?'快照更新于':'真实数据 · 读取于'} {times.map(appsDisplayTime).join(' / ')}</p>:null}
  </div>;
}

export function WorkbenchStoreSelector({stores,storeId,disabled=false,compact=false,onChange}:{stores:WorkbenchStoreOption[];storeId?:string;disabled?:boolean;compact?:boolean;onChange:(storeId:string)=>void}){
  const known=stores.some(store=>store.id===storeId);
  return <div className={`apps-store-context${compact?' is-compact':''}`}><label className="apps-config-label"><span>当前店铺</span><select aria-label="当前店铺" value={storeId??''} disabled={disabled||!stores.length} onChange={event=>{if(event.target.value)onChange(event.target.value);}}><option value="" disabled>选择已授权店铺</option>{storeId&&!known?<option value={storeId}>原店铺暂不可用</option>:null}{stores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</select></label>{compact?null:<p>组件与字段配置通用，数据随当前店铺切换。</p>}</div>;
}

function SavedComponentThumbnail({component}:{component:WorkbenchSavedComponent}){
  const [failed,setFailed]=useState(false);
  const url=`/api/dsh-apps?resource=componentThumbnail&componentId=${encodeURIComponent(component.componentId)}&revision=${component.revision}`;
  useEffect(()=>setFailed(false),[url]);
  return component.hasPreview&&!failed?<img className="apps-workbench-saved-thumbnail" alt="" loading="lazy" src={url} onError={()=>setFailed(true)}/>:<MaterialThumbnail materialId="data-table"/>;
}

export function WorkbenchBoard({appId,onAdd,onOpenSaved,onOpenInstance,onOpenComponent,onReturn,onConfigure,detailInstanceId,snapshot,highlightId,revision=0,onChange,active=true}:{appId:string;onAdd:()=>void;onOpenSaved?:()=>void;onOpenInstance?:(instance:WorkbenchInstance)=>void;onOpenComponent?:(component:WorkbenchSavedComponent)=>void;onReturn?:()=>void;onConfigure:(instance:WorkbenchInstance)=>void;detailInstanceId?:string;snapshot?:Workbench;highlightId?:string;revision?:number;onChange?:(workbench:Workbench)=>void;active?:boolean}){
  const [workbench,setWorkbench]=useState<Workbench|undefined>(snapshot?.appId===appId?snapshot:undefined),[loading,setLoading]=useState(!snapshot),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0),[refresh,setRefresh]=useState<Record<string,number>>({}),[refreshing,setRefreshing]=useState<Record<string,boolean>>({});
  const [stores,setStores]=useState<WorkbenchStoreOption[]>([]),[storesError,setStoresError]=useState(''),[switchingStore,setSwitchingStore]=useState(false);
  const saving=useRef(false),owner=useRef(appId);owner.current=appId;
  useEffect(()=>{if(snapshot?.appId===appId)setWorkbench(current=>!current||snapshot.revision>=current.revision?snapshot:current);},[appId,snapshot]);
  useEffect(()=>{const controller=new AbortController();setLoading(!snapshot);setError('');appsResource<Workbench>('workbench',{appId},controller.signal).then(value=>{if(!controller.signal.aborted){setWorkbench(current=>!current||value.revision>=current.revision?value:current);onChange?.(value);}}).catch(cause=>{if(!controller.signal.aborted)setError(failure(cause));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[appId,revision,reload]);
  useEffect(()=>{if(appId!=='hallmark')return;const controller=new AbortController();setStores([]);setStoresError('');appsResource<WorkbenchStores>('stores',{appId},controller.signal).then(value=>{if(!controller.signal.aborted)setStores(value.stores);}).catch(cause=>{if(!controller.signal.aborted)setStoresError(failure(cause));});return()=>controller.abort();},[appId,reload]);
  useEffect(()=>{if(!highlightId||!workbench?.instances.some(instance=>instance.instanceId===highlightId))return;const node=typeof document!=='undefined'?document.getElementById(`workbench-${highlightId}`):null;node?.scrollIntoView?.({behavior:'smooth',block:'nearest'});},[highlightId,workbench]);
  const save=async(instances:WorkbenchInstance[],context=workbench?.context)=>{if(!workbench||saving.current)return false;const target=appId;saving.current=true;setBusy(true);setError('');try{const next=await appsWorkbench<Workbench>(appId,'save',{expectedRevision:workbench.revision,instances,...(context?{context}:{})});if(owner.current===target){setWorkbench(next);onChange?.(next);return true;}return false;}catch(cause){if(owner.current===target)setError(failure(cause));return false;}finally{saving.current=false;if(owner.current===target){setBusy(false);setSwitchingStore(false);}}};
  const selectStore=(storeId:string)=>{if(!workbench||saving.current||storeId===workbench.context?.storeId)return;setSwitchingStore(true);void save(workbench.instances.map(instance=>{const bindings=new Set((instance.design as unknown as ViewSpec).widgets.filter(widget=>widget.options?.materialId==='product-procurement').map(widget=>widget.bindingId));return bindings.size?{...instance,dataSources:Object.fromEntries(Object.entries(workbenchRefs(instance)).map(([id,ref])=>[id,bindings.has(id)?{...ref,params:procurementParametersForStore(ref.params)}:ref]))}:instance;}),{storeId});};
  const instances=useMemo(()=>[...(workbench?.instances??[])].sort((a,b)=>a.position.order-b.position.order),[workbench]);
  const focused=instances.find(instance=>instance.instanceId===detailInstanceId);
  const savedComponents=useMemo(()=>[...(workbench?.savedComponents??[])].sort((a,b)=>(a.position?.order??0)-(b.position?.order??0)),[workbench]);
  const unpin=async(componentId:string)=>{if(!workbench||saving.current)return;const target=appId;saving.current=true;setBusy(true);setError('');try{const next=await appsWorkbench<Workbench>(appId,'unpinComponent',{expectedRevision:workbench.revision,componentId});if(owner.current===target){setWorkbench(next);onChange?.(next);}}catch(cause){if(owner.current===target)setError(failure(cause));}finally{saving.current=false;if(owner.current===target)setBusy(false);}};
  const move=(index:number,direction:-1|1)=>{const next=[...instances];[next[index],next[index+direction]]=[next[index+direction],next[index]];void save(next.map((instance,order)=>({...instance,position:{...instance.position,order}})));};
  return <section className="apps-workbench-board apps-workbench-cards" aria-label="工作台">
    <style>{WORKBENCH_CARDS_STYLES}</style>
    <div className="apps-workbench-cards-heading"><div className="apps-workbench-cards-title">{detailInstanceId?<button type="button" className="apps-workbench-back" onClick={onReturn}><AppsIcon name="back"/> 返回工作台</button>:<h2>工作台</h2>}{appId==='hallmark'?<WorkbenchStoreSelector compact stores={stores} storeId={workbench?.context?.storeId} disabled={loading||busy} onChange={selectStore}/>:null}</div>{!detailInstanceId?<div className="apps-workbench-cards-tools">{onOpenSaved?<button type="button" onClick={onOpenSaved}><AppsIcon name="grid"/> 我的组件</button>:null}<button type="button" className="apps-primary" onClick={onAdd}><AppsIcon name="plus"/> 添加组件</button></div>:null}</div>
    {storesError?<p className="apps-notice is-error" role="alert">店铺列表读取失败：{storesError}</p>:null}
    {error?<div className="apps-notice is-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>重新读取工作台</button></div>:null}
    {loading?<div className="apps-instance-loading" role="status"><span className="apps-loading-dot"/>正在打开工作台…</div>:<>
      {focused?<article className="apps-workbench-instance apps-workbench-detail" data-instance-id={focused.instanceId}>
        <header><h3>{focused.title}</h3><div className="apps-instance-actions"><button type="button" aria-label={`刷新${focused.title}`} disabled={!!refreshing[focused.instanceId]} onClick={()=>setRefresh(value=>({...value,[focused.instanceId]:(value[focused.instanceId]??0)+1}))}><AppsIcon name="refresh"/></button><button type="button" disabled={busy} onClick={()=>onConfigure(focused)}>配置</button></div></header>
        {switchingStore?<div className="apps-instance-loading" role="status">正在切换店铺…</div>:active?<WorkbenchInstanceView appId={appId} instance={focused} context={workbench?.context} refreshKey={refresh[focused.instanceId]??0} parametersBusy={busy} onRefreshing={value=>setRefreshing(current=>current[focused.instanceId]===value?current:{...current,[focused.instanceId]:value})} onBindingParametersChange={async(bindingId,params)=>{const saved=await save(instances.map(item=>item.instanceId===focused.instanceId?{...item,dataSources:{...workbenchRefs(item),[bindingId]:{...workbenchRefs(item)[bindingId],params}}}:item));if(!saved)throw Error('方案尚未保存，请重试。');}}/>:null}
      </article>:detailInstanceId?<p className="apps-notice" role="status">此组件已从工作台移除。</p>:<><div className="apps-workbench-status"><span>{instances.length+savedComponents.length} 个常用组件 · 点击打开</span><span role="status">{busy?'正在保存…':workbench?'已保存':''}</span></div>
      <div className="apps-workbench-card-grid">{instances.map((instance,index)=><article id={`workbench-${instance.instanceId}`} key={instance.instanceId} data-instance-id={instance.instanceId} className={`apps-workbench-card${highlightId===instance.instanceId?' is-highlighted':''}`}>
        <button type="button" className="apps-workbench-card-open" aria-label={`打开${instance.title}`} onClick={()=>onOpenInstance?.(instance)}><MaterialThumbnail materialId={instance.materialId}/><span className="apps-workbench-card-title">{instance.title}</span></button>
        <div className="apps-instance-actions apps-workbench-card-menu"><details><summary aria-label={`${instance.title}更多操作`}>···</summary><div><button type="button" disabled={busy} onClick={()=>onConfigure(instance)}>配置</button><button type="button" disabled={busy||index===0} onClick={()=>move(index,-1)}>向前移动</button><button type="button" disabled={busy||index===instances.length-1} onClick={()=>move(index,1)}>向后移动</button><button type="button" className="apps-danger-text" disabled={busy} onClick={()=>void save(instances.filter(item=>item.instanceId!==instance.instanceId))}>从工作台移除</button></div></details></div>
      </article>)}{savedComponents.map(component=><article key={`saved:${component.componentId}`} data-component-id={component.componentId} className="apps-workbench-card">
        <button type="button" className="apps-workbench-card-open" aria-label={`打开${component.title}`} onClick={()=>onOpenComponent?.(component)}><SavedComponentThumbnail component={component}/><span className="apps-workbench-card-title">{component.title}</span></button>
        <div className="apps-instance-actions apps-workbench-card-menu"><details><summary aria-label={`${component.title}更多操作`}>···</summary><div><button type="button" className="apps-danger-text" disabled={busy} onClick={()=>void unpin(component.componentId)}>从工作台移除</button></div></details></div>
      </article>)}<button type="button" className="apps-workbench-card-add" onClick={onAdd}><span><AppsIcon name="plus"/></span><strong>添加组件</strong></button></div></>}
    </>}
  </section>;
}
