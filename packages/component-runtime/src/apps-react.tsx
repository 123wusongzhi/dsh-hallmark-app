import {useCallback,useEffect,useRef,useState} from 'react';
import type {ComponentAgentReceipt,ComponentAgentRequest,ComponentContextUpdate,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {AuthoringAssertion,UiSelectionEvidence,UiStateSnapshot} from '../../app-contracts/src/index.ts';
import {createAppsClient,ComponentBridgeError} from './apps-client.ts';
import type {AppsComponentClient,AppsRefreshOptions,ComponentHello} from './apps-client.ts';
import {createLatestStateSaver} from './latest-state-saver.ts';
export interface AppsUiStateContract {uiStateSchemaVersion:number;exportState():{value:JsonValue;selectionEvidence:UiSelectionEvidence[]};importState(value:JsonValue,selectionEvidence:UiSelectionEvidence[]):void|Promise<void>;migrateState?(snapshot:UiStateSnapshot,targetSchemaVersion:number):{value:JsonValue;selectionEvidence:UiSelectionEvidence[]}|Promise<{value:JsonValue;selectionEvidence:UiSelectionEvidence[]}>;subscribe?(listener:()=>void):()=>void}
export interface AppsHookOptions {uiState?:AppsUiStateContract;assertionResults?:()=>AuthoringAssertion[]|Promise<AuthoringAssertion[]>}

/** Local sorting, selection and display state belong in the component's ordinary React state. */
export function useApps(options:AppsHookOptions={}){
  const client=useRef<AppsComponentClient>();
  const liveOptions=useRef(options);liveOptions.current=options;
  const [data,setData]=useState<JsonValue>(),[context,setContext]=useState<JsonValue>(),[hello,setHello]=useState<ComponentHello>();
  const [loading,setLoading]=useState(true),[error,setError]=useState<Error>();
  const currentData=useRef(data);currentData.current=data;
  const [hostVisible,setHostVisible]=useState(true),visibleHost=useRef(true);
  const dataRequests=useRef(0),autoRetryAt=useRef(0),[readEpoch,setReadEpoch]=useState(0);
  const acceptData=useCallback((next:JsonValue,completedRead=false,pageBindings?:string[]|true)=>{const problem=boundDataError(next);setData(previous=>preserveFailedData(previous,next,pageBindings));setError(problem);autoRetryAt.current=problem||completedRead&&cacheDeadlines(next).some(binding=>binding.at<=Date.now())?Date.now()+5000:0;},[]);
  const [uiStateNotice,setUiStateNotice]=useState(''),[contextNotice,setContextNotice]=useState(''),[stateSettled,setStateSettled]=useState(false),stateRevision=useRef(0),stateSaver=useRef<ReturnType<typeof createLatestStateSaver>>(),stateReadiness=useRef<{resolve:()=>void;reject:(reason:unknown)=>void}>(),readyPublication=useRef<string>(),pageErrors=useRef<string[]>([]),migratedState=useRef(false);
  const saveUiState=useCallback(async()=>{if(!liveOptions.current.uiState)return;if(!stateSaver.current)throw new Error('UI状态连接尚未准备好。');return stateSaver.current.save();},[]);
  useEffect(()=>{
    const connection=createAppsClient({clientFeatures:liveOptions.current.uiState?['renderReadyV1','uiStateV1','bindingPagesV1','dataTransferV1']:['renderReadyV1','bindingPagesV1','dataTransferV1']});client.current=connection;let active=true,unsubscribeState=()=>{},localStateChanges=0,importing=false,lastSaved:string|undefined;
    const visibility=connection.subscribeVisibility(visible=>{visibleHost.current=visible;if(active)setHostVisible(visible);});visibleHost.current=connection.isVisible();setHostVisible(visibleHost.current);
    const pendingVisibility=new Set<()=>void>();
    const waitVisible=(afterPause=false)=>new Promise<void>((resolve,reject)=>{
      if(!active){reject(new Error('Component host is not connected.'));return;}
      if(!afterPause&&connection.isVisible()){resolve();return;}
      let off=()=>{};const cancel=()=>{off();pendingVisibility.delete(cancel);reject(new Error('Component host is not connected.'));};
      off=connection.subscribeVisibility(visible=>{if(!visible)return;off();pendingVisibility.delete(cancel);if(active)resolve();else reject(new Error('Component host is not connected.'));});pendingVisibility.add(cancel);
    });
    const readInitially=async<T,>(read:()=>Promise<T>):Promise<T>=>{
      await waitVisible();while(active){try{return await read();}catch(reason){if(object(reason).code!=='BRIDGE_PAUSED')throw reason;await waitVisible(true);}}
      throw new Error('Component host is not connected.');
    };
    let resolveState:()=>void,rejectState:(reason:unknown)=>void;
    const stateAvailable=new Promise<void>((resolve,reject)=>{resolveState=resolve;rejectState=reject;});void stateAvailable.catch(()=>{});
    const readyForState=new Promise<void>((resolve,reject)=>{stateReadiness.current={resolve,reject};});void readyForState.catch(()=>{});
    const saver=createLatestStateSaver(async()=>{
      await Promise.all([stateAvailable,readyForState]);if(!active||client.current!==connection)throw new Error('UI状态连接已关闭。');
      const contract=liveOptions.current.uiState;if(!contract)return;
      const snapshot=contract.exportState(),signature=JSON.stringify([contract.uiStateSchemaVersion,snapshot]);if(signature===lastSaved)return;
      try{const receipt=await connection.writeUiState({uiStateSchemaVersion:contract.uiStateSchemaVersion,expectedStateRevision:stateRevision.current,...snapshot});const revision=object(receipt).stateRevision;if(!Number.isSafeInteger(revision))throw new Error('UI状态保存未返回有效版本。');stateRevision.current=Number(revision);lastSaved=signature;}catch(reason){if(active)setUiStateNotice(reason instanceof Error?reason.message:String(reason));throw reason;}
    });stateSaver.current=saver;
    const capture=(event:Event)=>{const item=event as ErrorEvent&PromiseRejectionEvent;if(item.reason instanceof ComponentBridgeError)return;const message=String(item.message??item.reason??'Unhandled component error').slice(0,512);if(pageErrors.current.length<20)pageErrors.current.push(message);if(active)connection.reportFrameError({phase:'script',code:event.type==='error'?'COMPONENT_SCRIPT_ERROR':'COMPONENT_UNHANDLED_REJECTION',message});};
    window.addEventListener('error',capture);window.addEventListener('unhandledrejection',capture);
    const unsubscribe=connection.subscribe(event=>{if(active){if(event.event==='data')acceptData(event.data);else setContext(event.data);}});
    const initial=<T,>(phase:string,promise:Promise<T>)=>promise.catch(reason=>{if(active)connection.reportFrameError({phase,code:String(object(reason).code??'COMPONENT_INITIALIZATION_FAILED'),message:reason instanceof Error?reason.message:String(reason)});throw reason;});
    const handshake=initial('handshake',connection.hello());
    const restoreState=handshake.then(async identity=>{
      const contract=liveOptions.current.uiState;
      if(!contract)return;
      if(!Number.isSafeInteger(contract.uiStateSchemaVersion)||contract.uiStateSchemaVersion<1)throw new Error('UI状态必须声明正整数Schema版本。');
      if(!identity.features?.includes('uiStateV1'))throw new Error('当前宿主未协商UI状态恢复；本组件不承诺跨frame保留。');
      unsubscribeState=contract.subscribe?.(()=>{if(!active||importing)return;localStateChanges++;void saver.save().catch(()=>{});})??(()=>{});
      const restored=object(await connection.readUiState(contract.uiStateSchemaVersion)),snapshot=restored.snapshot as UiStateSnapshot|undefined;
      if(!active)return;
      if(snapshot){
        if(!Number.isSafeInteger(snapshot.stateRevision)||snapshot.stateRevision<0)throw new Error('UI状态恢复未返回有效版本。');
        stateRevision.current=snapshot.stateRevision;
        let value=snapshot.value,selectionEvidence=snapshot.selectionEvidence;
        if(restored.status==='incompatible'){
          if(!contract.migrateState)throw new Error('UI状态版本不兼容，已保留旧快照；组件未声明迁移。');
          const migrated=await contract.migrateState(snapshot,contract.uiStateSchemaVersion);value=migrated.value;selectionEvidence=migrated.selectionEvidence;migratedState.current=true;
        }
        // Data is already usable; an optional late snapshot must not overwrite user edits.
        if(!active)return;
        if(localStateChanges){setUiStateNotice('恢复期间已修改界面，保留当前操作；未覆盖为旧快照。');}
        else {importing=true;try{await contract.importState(value,selectionEvidence);}finally{importing=false;}}
        if(Array.isArray(restored.removedSelections)&&restored.removedSelections.length&&active)setUiStateNotice('部分选择已失效并移除，请根据当前数据重新选择。');
      }
    });
    void restoreState.then(()=>resolveState!(),reason=>{rejectState!(reason);if(active)setUiStateNotice(`界面状态恢复失败，当前数据仍可查看：${reason instanceof Error?reason.message:String(reason)}`);}).finally(()=>{if(active)setStateSettled(true);});
    // Context is optional for display, but readiness still requires its publication identity.
    void readInitially(()=>connection.getContext()).then(next=>{if(active){setContext(next);if(typeof object(object(next).publication).publicationId!=='string')stateReadiness.current?.resolve();}},reason=>{if(active){stateReadiness.current?.reject(reason);setContextNotice(`组件上下文暂不可用：${reason instanceof Error?reason.message:String(reason)}`);}});
    Promise.all([handshake,initial('data',readInitially(()=>connection.getData()))]).then(([identity,nextData])=>{if(active){setHello(identity);acceptData(nextData);if(!identity.features?.includes('renderReadyV1'))stateReadiness.current?.resolve();}}).catch(reason=>{rejectState!(reason);stateReadiness.current?.reject(reason);if(active)setError(reason instanceof Error?reason:new Error(String(reason)));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;for(const cancel of [...pendingVisibility])cancel();unsubscribe();visibility();unsubscribeState();saver.dispose();rejectState!(new Error('UI状态连接已关闭。'));stateReadiness.current?.reject(new Error('UI状态连接已关闭。'));stateReadiness.current=undefined;window.removeEventListener('error',capture);window.removeEventListener('unhandledrejection',capture);connection.dispose();if(client.current===connection)client.current=undefined;if(stateSaver.current===saver)stateSaver.current=undefined;};
  },[]);
  // This effect runs after the React root committed data/context, never from iframe onLoad.
  useEffect(()=>{
    const publication=object(object(context).publication),display=object(object(context).display),readyKey=JSON.stringify([publication.publicationId,display.displayId]);
    if(loading||!stateSettled||error||data===undefined||!hello?.features?.includes('renderReadyV1')||typeof publication.publicationId!=='string'||typeof publication.attemptId!=='string'||!Number.isSafeInteger(publication.attemptEpoch)||readyPublication.current===readyKey)return;
    const owner=client.current;if(!owner)return;readyPublication.current=readyKey;
    void Promise.resolve().then(()=>liveOptions.current.assertionResults?.()??[]).then(assertionResults=>owner.renderReady({publicationId:String(publication.publicationId),attemptId:String(publication.attemptId),attemptEpoch:Number(publication.attemptEpoch),checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[...pageErrors.current],assertionResults}})).then(()=>{
      if(client.current===owner)stateReadiness.current?.resolve();
      if(migratedState.current&&client.current===owner){migratedState.current=false;void saveUiState().catch(()=>{});}
    }).catch(reason=>{if(client.current===owner){stateReadiness.current?.reject(reason);owner.reportFrameError({phase:'readiness',code:String(object(reason).code??'COMPONENT_READY_FAILED'),message:reason instanceof Error?reason.message:String(reason)});setError(reason instanceof Error?reason:new Error(String(reason)));}});
  },[loading,stateSettled,error,data,context,hello]);
  const connection=()=>{if(!client.current)throw new Error('Component host is not connected.');return client.current;};
  const pageSequence=useRef(0);
  const readBindingPage=useCallback(async(bindingId:string,cursor?:string|null)=>{const owner=connection(),sequence=++pageSequence.current;dataRequests.current++;setLoading(true);try{const next=await owner.readBindingPage(bindingId,cursor);if(client.current===owner&&sequence===pageSequence.current){acceptData(next,true,[bindingId]);}return next;}catch(reason){if(client.current===owner&&sequence===pageSequence.current){autoRetryAt.current=retryDeadline(reason,5000);setError(reason instanceof Error?reason:new Error(String(reason)));setData(previous=>invalidateFailedData(previous,reason,[bindingId]));}throw reason;}finally{dataRequests.current--;if(client.current===owner){setReadEpoch(value=>value+1);if(sequence===pageSequence.current)setLoading(false);}}},[]);
  const refresh=useCallback(async(bindingIds?:string[],refreshOptions:AppsRefreshOptions={})=>{if((refreshOptions.forceRefresh??true)&&currentData.current!==undefined&&snapshotRefreshing(currentData.current,bindingIds))return currentData.current;const owner=connection(),sequence=++pageSequence.current;dataRequests.current++;setLoading(true);try{const next=await owner.refresh(bindingIds,{forceRefresh:refreshOptions.forceRefresh??true});if(client.current===owner&&sequence===pageSequence.current){acceptData(next,true,bindingIds??true);}return next;}catch(reason){if(client.current===owner&&sequence===pageSequence.current){autoRetryAt.current=retryDeadline(reason,5000);setError(reason instanceof Error?reason:new Error(String(reason)));setData(previous=>invalidateFailedData(previous,reason,bindingIds));}throw reason;}finally{dataRequests.current--;if(client.current===owner){setReadEpoch(value=>value+1);if(sequence===pageSequence.current)setLoading(false);}}},[]);
  // The Provider owns cache lifetimes. Hidden documents do not poll; a visible
  // document rechecks the advertised deadline and never overlaps a pending read.
  useEffect(()=>{
    if(typeof document==='undefined'||data===undefined)return;
    let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
    const bindings=cacheDeadlines(data);
    const schedule=()=>{
      if(timer!==undefined)clearTimeout(timer);timer=undefined;
      if(disposed||document.hidden||!visibleHost.current||loading||dataRequests.current||!bindings.length)return;
      const deadline=Math.max(Math.min(...bindings.map(binding=>binding.at)),autoRetryAt.current);
      timer=setTimeout(()=>{
        timer=undefined;if(disposed||document.hidden||!visibleHost.current||dataRequests.current)return;
        const ids=bindings.filter(binding=>binding.at<=Date.now()).map(binding=>binding.id);
        if(!ids.length){schedule();return;}
        // A stale/failed Provider response may retain an elapsed deadline.
        autoRetryAt.current=Date.now()+5000;
        void refresh(ids,{forceRefresh:false}).catch(()=>{});
      },Math.min(2147483647,Math.max(0,deadline-Date.now())));
    };
    document.addEventListener('visibilitychange',schedule);schedule();
    return()=>{disposed=true;if(timer!==undefined)clearTimeout(timer);document.removeEventListener('visibilitychange',schedule);};
  },[data,loading,error,refresh,readEpoch,hostVisible]);
  const updateContext=useCallback(async(input:ComponentContextUpdate)=>{const owner=connection(),receipt=await owner.updateContext(input);if(client.current===owner)setContext(previous=>({...object(previous),contextRevision:receipt.contextRevision,snapshotId:receipt.snapshotId,snapshot:receipt.snapshot} as unknown as JsonValue));return receipt;},[]);
  // Existing components commonly render a loading screen when `loading` is true.
  // A refresh must keep their last snapshot visible; expose it separately instead.
  const refreshing=data!==undefined&&(loading||snapshotRefreshing(data));
  return {data,context,hello,loading:loading&&data===undefined,refreshing,error,uiStateNotice,contextNotice,saveUiState,flushUiState:saveUiState,refresh,readBindingPage,attachSelection:useCallback((selection:SelectionEnvelope)=>connection().attachSelection(selection),[]),invokeCapability:useCallback((input:JsonValue)=>connection().invokeCapability(input),[]),updateContext,requestAgent:useCallback((input:ComponentAgentRequest)=>connection().requestAgent(input),[]),resize:useCallback((height:number)=>connection().resize(height),[])};
}

function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function cacheDeadlines(data:unknown):{id:string;at:number}[]{const bindings=object(data).bindings;return Array.isArray(bindings)?bindings.flatMap(value=>{const binding=object(value),cache=object(object(binding.payload).cache),at=Date.parse(String(cache.nextRefreshAt??cache.expiresAt??''));return typeof binding.bindingId==='string'&&Number.isFinite(at)?[{id:binding.bindingId,at}]:[];}):[];}
function snapshotRefreshing(data:unknown,bindingIds?:string[]):boolean {const bindings=object(data).bindings;return Array.isArray(bindings)&&bindings.some(value=>{const binding=object(value);return (!bindingIds||bindingIds.includes(String(binding.bindingId)))&&object(object(binding.payload).cache).refreshing===true;});}
function boundDataError(data:unknown):Error|undefined {const bindings=object(data).bindings;if(!Array.isArray(bindings))return;for(const binding of bindings){const value=object(binding),message=object(value.error).message;if(typeof message==='string'&&message)return new Error(message);}return;}
function failureInfo(error:unknown):Record<string,unknown> {const value=object(error);return Object.keys(object(value.failure)).length?object(value.failure):value;}
function invalidatesCache(error:unknown):boolean {const value=failureInfo(error),code=String(value.code??''),status=Number(value.httpStatus??value.statusCode);return status===401||status===403||code==='PLATFORM_ERROR'&&value.retryPolicy==='never'||/AUTH|PERMISSION|FORBIDDEN|ACCESS_DENIED|CONNECTION|BINDING|IDENTITY|OWNER|INVALID|NOT_FOUND|HTTP_40[13]/.test(code);}
function canRetainCache(error:unknown):boolean {
  const value=failureInfo(error),code=String(value.code??''),status=Number(value.httpStatus??value.statusCode);
  if(invalidatesCache(value)||value.retryPolicy==='never'||value.retryPolicy==='inspect_only')return false;
  return value.retryPolicy==='read_retry'||status===429||status>=500&&status<=599||/^(LOCAL_RATE_LIMIT|RATE_LIMITED|PROVIDER_BUSY|OZON_UPSTREAM_UNAVAILABLE|HALLMARK_UNAVAILABLE|HALLMARK_HTTP_5\d\d|REPORT_PENDING|APP_SERVICE_UNAVAILABLE|RUNTIME_UNAVAILABLE|CALL_ABORTED)$/.test(code);
}
function retryDeadline(error:unknown,fallback:number,payload?:unknown):number {const value=failureInfo(error),delay=Number(value.retryAfterMs),deadline=Date.parse(String(object(object(payload).cache).nextRefreshAt??''));return Math.max(Date.now()+(Number.isFinite(delay)&&delay>0?delay:Number.isFinite(deadline)?0:fallback),Number.isFinite(deadline)?deadline:0);}
function withoutCachedData(binding:Record<string,unknown>):Record<string,unknown> {return {...binding,payload:null,resources:[],revision:null,lastSuccessAt:null,sourceDataTime:null,provenance:[],freshness:'unknown'};}
function invalidateFailedData(previous:JsonValue|undefined,error:unknown,bindingIds?:string[]):JsonValue|undefined {
  const bindings=object(previous).bindings;if(!invalidatesCache(error)||!Array.isArray(bindings))return previous;
  return {...object(previous),bindings:bindings.map(value=>{const binding=object(value);return !bindingIds||bindingIds.includes(String(binding.bindingId))?{...withoutCachedData(binding),state:'failed',error:failureInfo(error)}:value;})} as JsonValue;
}
function queryIdentity(binding:Record<string,unknown>):string {
  const query=object(binding.query),{cursor:_cursor,forceRefresh:_force,...input}=object(query.input);
  return JSON.stringify({...query,...(query.input!==undefined?{input}: {})},(_key,value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
}
function samePagedQuery(previous:Record<string,unknown>,next:Record<string,unknown>):boolean {
  // Only the bridge's known cursor field may vary. A pushed event cannot opt in,
  // and an incomplete query is insufficient evidence to cross dataset identities.
  for(const binding of [previous,next]){const query=object(binding.query);if(!['appId','connectionId','capabilityId','capabilityVersion'].every(key=>typeof query[key]==='string'&&query[key])||!Array.isArray(query.projection)||query.input===null||typeof query.input!=='object'||Array.isArray(query.input)||query.appId!==binding.appId||query.connectionId!==binding.connectionId)return false;}
  return object(object(previous.query).input).cursor!==object(object(next.query).input).cursor&&queryIdentity(previous)===queryIdentity(next);
}
function preserveFailedData(previous:JsonValue|undefined,next:JsonValue,pageBindings?:string[]|true):JsonValue {
  const old=object(previous).bindings,bindings=object(next).bindings;if(!Array.isArray(bindings))return next;
  return {...object(next),bindings:bindings.map(value=>{const binding=object(value);
    if(invalidatesCache(binding.error)||['failed','unavailable'].includes(String(binding.state))&&['never','inspect_only'].includes(String(object(binding.error).retryPolicy)))return withoutCachedData(binding);
    if(!Array.isArray(old)||typeof binding.datasetId!=='string'||!['failed','unavailable'].includes(String(binding.state))||!canRetainCache(binding.error))return value;
    const saved=old.find(item=>{const kept=object(item),sameDataset=kept.datasetId===binding.datasetId,pageRead=pageBindings===true||pageBindings?.includes(String(binding.bindingId));return kept.bindingId===binding.bindingId&&typeof kept.datasetId==='string'&&kept.appId===binding.appId&&kept.connectionId===binding.connectionId&&queryIdentity(kept)===queryIdentity(binding)&&(sameDataset||pageRead&&samePagedQuery(kept,binding));});
    const kept=object(saved);if(kept.payload===undefined||kept.payload===null)return value;
    const payload=object(kept.payload),retained=Array.isArray(kept.payload)||typeof kept.payload!=='object'?kept.payload:{...payload,cache:{...object(payload.cache),nextRefreshAt:new Date(retryDeadline(binding.error,60000,binding.payload)).toISOString(),stale:true}};
    return {...binding,datasetId:kept.datasetId,payload:retained,resources:kept.resources??binding.resources,revision:kept.revision??binding.revision,...(kept.query?{query:kept.query}:{}),lastSuccessAt:kept.lastSuccessAt??binding.lastSuccessAt,sourceDataTime:kept.sourceDataTime??binding.sourceDataTime,provenance:kept.provenance??binding.provenance,freshness:'stale'};
  })} as JsonValue;
}
/** Opt-in controls keep local selection, context publication and explicit agent submission separate. */
export function AppsAgentActions({apps,selections,summary='',onInspectRequest}:{apps:Pick<ReturnType<typeof useApps>,'hello'|'context'|'updateContext'|'requestAgent'>;selections:SelectionEnvelope[];summary?:string;onInspectRequest?:(requestId:string)=>void}) {
  const fingerprint=JSON.stringify({selections,summary}),[published,setPublished]=useState<string>(),[revision,setRevision]=useState<number>(),[text,setText]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState<ComponentAgentReceipt>(),[inspectRequestId,setInspectRequestId]=useState<string>(),locked=useRef(false),inFlight=useRef(false);
  const advertised=apps.hello?.supportedMethods??[],canUpdate=advertised.includes('updateContext'),canRequest=advertised.includes('requestAgent'),dirty=published!==fingerprint;
  const current=object(apps.context).contextRevision,contextRevision=Number.isSafeInteger(current)&&Number(current)>=0?Number(current):apps.hello?.contextRevision??0;
  const publish=async()=>{
    if(inFlight.current||!canUpdate||locked.current)return;inFlight.current=true;setBusy(true);setNotice('');
    try{const value=await apps.updateContext({expectedContextRevision:contextRevision,selections,summary});setPublished(fingerprint);setRevision(value.contextRevision);setNotice(`上下文已更新（版本 ${value.contextRevision}），代理尚未唤醒。`);}
    catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{inFlight.current=false;setBusy(false);}
  };
  const request=async()=>{
    if(inFlight.current||locked.current||dirty||!canRequest||!text.trim()||revision===undefined)return;
    // A submission can outlive the iframe response. Never repeat an uncertain request automatically.
    locked.current=true;inFlight.current=true;setBusy(true);setNotice('');
    try{const value=await apps.requestAgent({text:text.trim(),expectedContextRevision:revision});setReceipt(value);setInspectRequestId(value.requestId);setNotice(value.status==='accepted'?'请求已提交，等待代理处理。':`请求状态：${value.status}。请检查原请求。`);}
    catch(error){const requestId=object(object(object(error).failure).details).requestId;if(typeof requestId==='string')setInspectRequestId(requestId);setNotice(`${error instanceof Error?error.message:String(error)} 请检查原请求，勿重复提交。`);}finally{inFlight.current=false;setBusy(false);}
  };
  return <section aria-label="组件代理操作" data-context-state={dirty?'dirty':'published'}><p role="status">{notice||(dirty?'选择尚未发布。':'选择已发布。')}</p><button type="button" onClick={publish} disabled={busy||!canUpdate||locked.current}>更新上下文</button><label>代理任务 <input value={text} onChange={event=>setText(event.target.value)} disabled={busy||locked.current}/></label><button type="button" onClick={request} disabled={busy||dirty||!canRequest||!text.trim()||locked.current}>请求代理</button>{inspectRequestId&&onInspectRequest?<button type="button" onClick={()=>onInspectRequest(inspectRequestId)}>检查原请求</button>:null}{receipt?.status==='accepted'?<button type="button" disabled={busy} onClick={()=>{locked.current=false;setReceipt(undefined);setInspectRequestId(undefined);setText('');setNotice('请输入新任务后显式提交。');}}>准备新任务</button>:null}{!canUpdate||!canRequest?<p>此宿主尚未启用正式代理路径；可添加选择附件后手动发送。</p>:null}</section>;
}
