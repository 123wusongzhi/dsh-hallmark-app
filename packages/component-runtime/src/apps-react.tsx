import {useCallback,useEffect,useRef,useState} from 'react';
import type {ComponentAgentReceipt,ComponentAgentRequest,ComponentContextUpdate,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {AuthoringAssertion,UiSelectionEvidence,UiStateSnapshot} from '../../app-contracts/src/index.ts';
import {createAppsClient,ComponentBridgeError} from './apps-client.ts';
import type {AppsComponentClient,AppsRefreshOptions,ComponentHello} from './apps-client.ts';
import {createLatestStateSaver} from './latest-state-saver.ts';
import {createVisibleDeadline,dataProgressKey,DISPLAY_NO_PROGRESS_MS} from './visible-deadline.ts';
export interface AppsUiStateContract {uiStateSchemaVersion:number;exportState():{value:JsonValue;selectionEvidence:UiSelectionEvidence[]};importState(value:JsonValue,selectionEvidence:UiSelectionEvidence[]):void|Promise<void>;migrateState?(snapshot:UiStateSnapshot,targetSchemaVersion:number):{value:JsonValue;selectionEvidence:UiSelectionEvidence[]}|Promise<{value:JsonValue;selectionEvidence:UiSelectionEvidence[]}>;subscribe?(listener:()=>void):()=>void}
/** `initialReadRetryDelaysMs` replaces the default backoff (500 ms, 1500 ms: three attempts) of the first data and context reads; at most two delays, each capped at 5s. Readiness has its own idle/absolute cap. */
export interface AppsHookOptions {uiState?:AppsUiStateContract;assertionResults?:()=>AuthoringAssertion[]|Promise<AuthoringAssertion[]>;initialReadRetryDelaysMs?:number[]}

/** Local sorting, selection and display state belong in the component's ordinary React state. */
export function useApps(options:AppsHookOptions={}){
  const client=useRef<AppsComponentClient>();
  const liveOptions=useRef(options);liveOptions.current=options;
  const [data,setData]=useState<JsonValue>(),[context,setContext]=useState<JsonValue>(),[hello,setHello]=useState<ComponentHello>();
  const [loading,setLoading]=useState(true),[error,setError]=useState<Error>();
  const currentData=useRef(data);currentData.current=data;
  const [hostVisible,setHostVisible]=useState(true),visibleHost=useRef(true);
  const dataRequests=useRef(0),autoRetryAt=useRef(0),[readEpoch,setReadEpoch]=useState(0);
  const dataSequence=useRef(0),fullDataSequence=useRef(0),bindingSequences=useRef(new Map<string,number>());
  const beginDataRead=(bindingIds?:string[])=>{const sequence=++dataSequence.current;if(bindingIds)for(const id of bindingIds)bindingSequences.current.set(id,sequence);else fullDataSequence.current=sequence;return sequence;};
  const currentBindings=(sequence:number,bindingIds?:string[])=>bindingIds?.filter(id=>sequence>=Math.max(fullDataSequence.current,bindingSequences.current.get(id)??0));
  const acceptData=useCallback((next:JsonValue,sequence:number,completedRead=false,pageBindings?:string[]|true)=>{
    const ids=Array.isArray(pageBindings)?currentBindings(sequence,pageBindings):undefined;
    if(ids?!ids.length:sequence<fullDataSequence.current)return;
    const nextBindings=object(next).bindings,oldBindings=object(currentData.current).bindings;
    // A page response contains the whole view. Only its requested bindings are
    // authoritative; siblings may be snapshots taken before their own reads.
    if(Array.isArray(nextBindings)){
      const old=Array.isArray(oldBindings)?oldBindings:[],selected=ids?new Set(ids):undefined,accepted=(id:string)=>selected?selected.has(id):sequence>=(bindingSequences.current.get(id)??0);
      const oldById=new Map(old.map(value=>[String(object(value).bindingId),value])),nextIds=new Set(nextBindings.map(value=>String(object(value).bindingId)));
      const bindings=ids?old.filter(value=>{const id=String(object(value).bindingId);return !accepted(id)||nextIds.has(id);}):nextBindings.flatMap(value=>{const id=String(object(value).bindingId);return accepted(id)?[value]:oldById.has(id)?[oldById.get(id)]:[];});
      if(ids){const positions=new Map(bindings.map((value,index)=>[String(object(value).bindingId),index]));for(const value of nextBindings){const id=String(object(value).bindingId);if(!accepted(id))continue;const index=positions.get(id);if(index===undefined){positions.set(id,bindings.length);bindings.push(value);}else bindings[index]=value;}}
      else for(const value of old){const id=String(object(value).bindingId);if(!nextIds.has(id)&&!accepted(id))bindings.push(value);}
      next={...object(next),...(ids?object(currentData.current):{}),bindings} as JsonValue;
    }else if(sequence!==dataSequence.current)return;
    const merged=preserveFailedData(currentData.current,next,pageBindings),problem=boundDataError(merged);currentData.current=merged;setData(merged);setError(problem);autoRetryAt.current=problem||completedRead&&cacheDeadlines(merged).some(binding=>binding.at<=Date.now())?Date.now()+5000:0;
  },[]);
  const [uiStateNotice,setUiStateNotice]=useState(''),[contextNotice,setContextNotice]=useState(''),[stateSettled,setStateSettled]=useState(false),stateRevision=useRef(0),stateSaver=useRef<ReturnType<typeof createLatestStateSaver>>(),stateReadiness=useRef<{resolve:()=>void;reject:(reason:unknown)=>void}>(),readyPublication=useRef<string>(),pageErrors=useRef<string[]>([]),migratedState=useRef(false);
  const saveUiState=useCallback(async()=>{if(!liveOptions.current.uiState)return;if(!stateSaver.current)throw new Error('UI状态连接尚未准备好。');return stateSaver.current.save();},[]);
  useEffect(()=>{
    let readProgress:(milestone:string)=>void=()=>{};
    const connection=createAppsClient({onReadProgress:milestone=>readProgress(milestone),clientFeatures:liveOptions.current.uiState?['renderReadyV1','uiStateV1','bindingPagesV1','dataTransferV1']:['renderReadyV1','bindingPagesV1','dataTransferV1']});client.current=connection;let active=true,unsubscribeState=()=>{},localStateChanges=0,importing=false,lastSaved:string|undefined;
    const initialSequence=beginDataRead();dataRequests.current++;
    let rejectBudget!:(reason:unknown)=>void;const budgetExpired=new Promise<never>((_resolve,reject)=>{rejectBudget=reject;});
    const budget=createVisibleDeadline(()=>rejectBudget(new ComponentBridgeError({code:'DISPLAY_READY_TIMEOUT',message:'数据准备长时间没有实质进展或已达到最长等待时间。',retryPolicy:'never'})),DISPLAY_NO_PROGRESS_MS);void budgetExpired.catch(()=>{});
    const within=<T,>(promise:Promise<T>):Promise<T>=>Promise.race([promise,budgetExpired]);
    readProgress=milestone=>{if(active)budget.progress(milestone);};
    budget.visible(connection.isVisible());
    const visibility=connection.subscribeVisibility(visible=>{budget.visible(visible);visibleHost.current=visible;if(active)setHostVisible(visible);});visibleHost.current=connection.isVisible();setHostVisible(visibleHost.current);
    const pendingVisibility=new Set<()=>void>();
    const waitVisible=(afterPause=false)=>new Promise<void>((resolve,reject)=>{
      if(!active){reject(new Error('Component host is not connected.'));return;}
      if(!afterPause&&connection.isVisible()){resolve();return;}
      let off=()=>{};const cancel=()=>{off();pendingVisibility.delete(cancel);reject(new Error('Component host is not connected.'));};
      off=connection.subscribeVisibility(visible=>{if(!visible)return;off();pendingVisibility.delete(cancel);if(active)resolve();else reject(new Error('Component host is not connected.'));});pendingVisibility.add(cancel);
    });
    const retryDelays=(liveOptions.current.initialReadRetryDelaysMs??[500,1500]).slice(0,2).map(ms=>Number.isFinite(ms)?Math.min(5000,Math.max(0,ms)):500),pendingPauses=new Set<()=>void>();
    const pause=(ms:number)=>new Promise<void>((resolve,reject)=>{
      if(!active){reject(new Error('Component host is not connected.'));return;}
      const cancel=()=>{clearTimeout(timer);pendingPauses.delete(cancel);reject(new Error('Component host is not connected.'));},timer=setTimeout(()=>{pendingPauses.delete(cancel);resolve();},ms);pendingPauses.add(cancel);
    });
    // A transient failure of the first read is retried within a small budget; identity, binding and validation errors are terminal at once.
    const readInitially=async<T,>(read:()=>Promise<T>):Promise<T>=>{
      await within(waitVisible());let attempts=0;
      while(active){
        try{return await within(read());}
        catch(reason){
          if(object(reason).code==='BRIDGE_PAUSED'){await within(waitVisible(true));continue;}
          attempts++;
          if(!active||attempts>retryDelays.length||!retryableFailure(reason)){if(reason!==null&&typeof reason==='object')try{(reason as {attempts?:number}).attempts=attempts;}catch{}throw reason;}
          await within(pause(retryDelays[attempts-1]));await within(waitVisible());
        }
      }
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
    const unsubscribe=connection.subscribe(event=>{if(active){if(event.event==='data')acceptData(event.data,beginDataRead());else setContext(event.data);}});
    const initial=<T,>(phase:string,promise:Promise<T>)=>promise.catch(reason=>{if(active)connection.reportFrameError({phase,code:String(object(reason).code??'COMPONENT_INITIALIZATION_FAILED'),message:reason instanceof Error?reason.message:String(reason),...reportDetails(reason)});throw reason;});
    const handshake=initial('handshake',connection.hello()).then(identity=>{if(active){budget.progress('bridge:authorized');setHello(identity);if(!identity.features?.includes('renderReadyV1'))stateReadiness.current?.resolve();}return identity;});
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
    let preparationPoll=0;
    const readPrepared=async():Promise<JsonValue>=>{
      while(active){
        const next=await connection.getData();budget.progress(dataProgressKey(next));
        const failure=initialDataFailure(next);if(failure){if(active&&!retryableFailure(failure))acceptData(next,initialSequence);throw failure;}
        if(!snapshotPreparing(next))return next;
        if(active)acceptData(next,initialSequence);
        await within(pause(Math.min(3000,1000+preparationPoll++*500)));await within(waitVisible());
      }
      throw new Error('Component host is not connected.');
    };
    Promise.all([handshake,readInitially(readPrepared)]).then(([,nextData])=>{if(active)acceptData(nextData,initialSequence);}).catch(reason=>{if(active&&initialSequence===dataSequence.current){rejectState!(reason);stateReadiness.current?.reject(reason);connection.reportFrameError({phase:'data',code:String(object(reason).code??'COMPONENT_INITIALIZATION_FAILED'),message:reason instanceof Error?reason.message:String(reason),...reportDetails(reason)});setError(reason instanceof Error?reason:new Error(String(reason)));}}).finally(()=>{budget.stop();dataRequests.current--;if(active)setLoading(dataRequests.current>0);});
    return()=>{active=false;readProgress=()=>{};budget.stop();for(const cancel of [...pendingVisibility])cancel();for(const cancel of [...pendingPauses])cancel();unsubscribe();visibility();unsubscribeState();saver.dispose();rejectState!(new Error('UI状态连接已关闭。'));stateReadiness.current?.reject(new Error('UI状态连接已关闭。'));stateReadiness.current=undefined;window.removeEventListener('error',capture);window.removeEventListener('unhandledrejection',capture);connection.dispose();if(client.current===connection)client.current=undefined;if(stateSaver.current===saver)stateSaver.current=undefined;};
  },[]);
  const pushedPreparationPoll=useRef(0);
  // A later pushed preparing state also needs snapshot polling, never a provider refresh.
  useEffect(()=>{
    if(!snapshotPreparing(data)){pushedPreparationPoll.current=0;return;}
    if(loading||error||!hostVisible)return;
    const owner=client.current;if(!owner)return;
    let disposed=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=(delay:number)=>{timer=setTimeout(()=>void poll(),delay);};
    const poll=async()=>{
      if(disposed||client.current!==owner)return;
      if(dataRequests.current||!visibleHost.current||typeof document!=='undefined'&&document.hidden){schedule(1000);return;}
      const sequence=beginDataRead();dataRequests.current++;
      try{const next=await owner.getData();if(disposed)return;const failure=initialDataFailure(next);if(failure)throw failure;acceptData(next,sequence);}
      catch(reason){if(disposed)return;if(retryableFailure(reason)&&failures++<2){schedule(failures===1?500:1500);return;}owner.reportFrameError({phase:'data',code:String(object(reason).code??'DATASET_NOT_READY'),message:reason instanceof Error?reason.message:String(reason),...reportDetails(reason)});setError(reason instanceof Error?reason:new Error(String(reason)));}
      finally{dataRequests.current--;}
    };
    schedule(Math.min(3000,1000+pushedPreparationPoll.current++*500));
    return()=>{disposed=true;if(timer!==undefined)clearTimeout(timer);};
  },[data,loading,error,hostVisible]);
  // This effect runs after the React root committed data/context, never from iframe onLoad.
  useEffect(()=>{
    const publication=object(object(context).publication),display=object(object(context).display),readyKey=JSON.stringify([publication.publicationId,display.displayId]);
    if(loading||snapshotPreparing(data)||!stateSettled||error||data===undefined||!hello?.features?.includes('renderReadyV1')||typeof publication.publicationId!=='string'||typeof publication.attemptId!=='string'||!Number.isSafeInteger(publication.attemptEpoch)||readyPublication.current===readyKey)return;
    const owner=client.current;if(!owner)return;readyPublication.current=readyKey;
    void Promise.resolve().then(()=>liveOptions.current.assertionResults?.()??[]).then(assertionResults=>owner.renderReady({publicationId:String(publication.publicationId),attemptId:String(publication.attemptId),attemptEpoch:Number(publication.attemptEpoch),checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[...pageErrors.current],assertionResults}})).then(()=>{
      if(client.current===owner)stateReadiness.current?.resolve();
      if(migratedState.current&&client.current===owner){migratedState.current=false;void saveUiState().catch(()=>{});}
    }).catch(reason=>{if(client.current===owner){stateReadiness.current?.reject(reason);owner.reportFrameError({phase:'readiness',code:String(object(reason).code??'COMPONENT_READY_FAILED'),message:reason instanceof Error?reason.message:String(reason)});setError(reason instanceof Error?reason:new Error(String(reason)));}});
  },[loading,stateSettled,error,data,context,hello]);
  const connection=()=>{if(!client.current)throw new Error('Component host is not connected.');return client.current;};
  const rejectData=(reason:unknown,sequence:number,bindingIds?:string[])=>{const bindings=object(currentData.current).bindings,ids=currentBindings(sequence,bindingIds??(Array.isArray(bindings)?bindings.map(value=>String(object(value).bindingId)):undefined));if(sequence<fullDataSequence.current||(ids?!ids.length:sequence!==dataSequence.current))return;autoRetryAt.current=retryDeadline(reason,5000);setError(reason instanceof Error?reason:new Error(String(reason)));const next=invalidateFailedData(currentData.current,reason,ids);currentData.current=next;setData(next);};
  const readBindingPage=useCallback(async(bindingId:string,cursor?:string|null)=>{const owner=connection(),sequence=beginDataRead([bindingId]);dataRequests.current++;setLoading(true);try{const next=await owner.readBindingPage(bindingId,cursor);if(client.current===owner)acceptData(next,sequence,true,[bindingId]);return next;}catch(reason){if(client.current===owner)rejectData(reason,sequence,[bindingId]);throw reason;}finally{dataRequests.current--;if(client.current===owner){setReadEpoch(value=>value+1);setLoading(dataRequests.current>0);}}},[]);
  const refresh=useCallback(async(bindingIds?:string[],refreshOptions:AppsRefreshOptions={})=>{if((refreshOptions.forceRefresh??true)&&currentData.current!==undefined&&snapshotRefreshing(currentData.current,bindingIds))return currentData.current;const owner=connection(),sequence=beginDataRead(bindingIds);dataRequests.current++;setLoading(true);try{const next=await owner.refresh(bindingIds,{forceRefresh:refreshOptions.forceRefresh??true});if(client.current===owner)acceptData(next,sequence,true,bindingIds??true);return next;}catch(reason){if(client.current===owner)rejectData(reason,sequence,bindingIds);throw reason;}finally{dataRequests.current--;if(client.current===owner){setReadEpoch(value=>value+1);setLoading(dataRequests.current>0);}}},[]);
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
  return {data,context,hello,loading:!error&&(loading&&data===undefined||snapshotPreparing(data)),preparing:snapshotPreparing(data),preparationNotice:snapshotPreparing(data)?'数据准备中…':'',refreshing,error,uiStateNotice,contextNotice,saveUiState,flushUiState:saveUiState,refresh,readBindingPage,attachSelection:useCallback((selection:SelectionEnvelope)=>connection().attachSelection(selection),[]),invokeCapability:useCallback((input:JsonValue)=>connection().invokeCapability(input),[]),updateContext,requestAgent:useCallback((input:ComponentAgentRequest)=>connection().requestAgent(input),[]),resize:useCallback((height:number)=>connection().resize(height),[])};
}

function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
const RETRYABLE_CODES=new Set(['BRIDGE_TIMEOUT','BRIDGE_PROXY_UNAVAILABLE','RUNTIME_UNAVAILABLE','RUNTIME_CONNECTION_LOST','RUNTIME_INVALID_RESPONSE','RUNTIME_STORE_BUSY','RUNTIME_INTERNAL_ERROR','RUNTIME_REQUEST_TIMEOUT']);
function retryableFailure(reason:unknown):boolean {const value=object(reason),failure=object(value.failure);return failure.retryPolicy==='read_retry'||value.retryPolicy==='read_retry'||RETRYABLE_CODES.has(String(value.code));}
/** The evidence a terminal failure report carries: attempts made, the last retry policy, request id and cause. */
function reportDetails(reason:unknown):{attempts?:number;retryPolicy?:string;requestId?:string;cause?:string} {
  const value=object(reason),failure=Object.keys(object(value.failure)).length?object(value.failure):value,details=object(failure.details),text=(item:unknown,max:number)=>typeof item==='string'&&item?item.slice(0,max):undefined;
  const attempts=Number.isSafeInteger(value.attempts)?Number(value.attempts):Number.isSafeInteger(details.attempts)?Number(details.attempts):undefined,retryPolicy=text(failure.retryPolicy,32),requestId=text(details.runtimeRequestId,128)??text(details.requestId,128),cause=text(details.cause,500);
  return {...(attempts!==undefined?{attempts:Math.min(10,Math.max(1,attempts))}:{}),...(retryPolicy?{retryPolicy}:{}),...(requestId?{requestId}:{}),...(cause?{cause}:{})};
}
function cacheDeadlines(data:unknown):{id:string;at:number}[]{const bindings=object(data).bindings;return Array.isArray(bindings)?bindings.flatMap(value=>{const binding=object(value),cache=object(object(binding.payload).cache),at=Date.parse(String(cache.nextRefreshAt??cache.expiresAt??''));return typeof binding.bindingId==='string'&&Number.isFinite(at)?[{id:binding.bindingId,at}]:[];}):[];}
function snapshotRefreshing(data:unknown,bindingIds?:string[]):boolean {const bindings=object(data).bindings;return Array.isArray(bindings)&&bindings.some(value=>{const binding=object(value);return (!bindingIds||bindingIds.includes(String(binding.bindingId)))&&object(object(binding.payload).cache).refreshing===true;});}
function snapshotPreparing(data:unknown):boolean {const bindings=object(data).bindings;return Array.isArray(bindings)&&bindings.some(value=>object(value).state==='preparing');}
function initialDataFailure(data:unknown):ComponentBridgeError|undefined {
  const bindings=object(data).bindings;if(!Array.isArray(bindings))return;
  for(const item of bindings){const binding=object(item);if(!['failed','unavailable'].includes(String(binding.state)))continue;const error=object(binding.error);return new ComponentBridgeError({code:String(error.code??'DATASET_NOT_READY'),message:String(error.message??'数据准备失败。'),retryPolicy:(error.retryPolicy??'never') as 'never',...(error.details?{details:error.details as JsonValue}:{})});}
}
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
function agentRequestNotSubmitted(error:unknown):boolean {
  const failure=object(object(error).failure),details=object(failure.details);
  if(failure.retryPolicy==='inspect_only'||details.doNotResubmitMutation===true)return false;
  // `never` alone does not prove non-admission: an oversized or malformed
  // response may arrive after execution. Only known preflight failures qualify.
  return details.submitted===false||failure.retryPolicy==='never'&&['INVALID_INPUT','CONTEXT_REVISION_CONFLICT','CONTEXT_NOT_OWNED','CONTEXT_BUDGET_EXCEEDED','APPS_CONTEXT_BUDGET_EXCEEDED','UNSUPPORTED_HOST_CAPABILITY','CANCELLED_BEFORE_DISPATCH','APPS_HOST_CLOSED'].includes(String(failure.code));
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
    catch(error){if(agentRequestNotSubmitted(error)){locked.current=false;setReceipt(undefined);setInspectRequestId(undefined);setPublished(undefined);setRevision(undefined);setNotice(`${error instanceof Error?error.message:String(error)} 请求未提交；修正后请更新上下文，再显式请求代理。`);}else{const requestId=object(object(object(error).failure).details).requestId;if(typeof requestId==='string')setInspectRequestId(requestId);setNotice(`${error instanceof Error?error.message:String(error)} 请检查原请求，勿重复提交。`);}}finally{inFlight.current=false;setBusy(false);}
  };
  return <section aria-label="组件代理操作" data-context-state={dirty?'dirty':'published'}><p role="status">{notice||(dirty?'选择尚未发布。':'选择已发布。')}</p><button type="button" onClick={publish} disabled={busy||!canUpdate||locked.current}>更新上下文</button><label>代理任务 <input value={text} onChange={event=>setText(event.target.value)} disabled={busy||locked.current}/></label><button type="button" onClick={request} disabled={busy||dirty||!canRequest||!text.trim()||locked.current}>请求代理</button>{inspectRequestId&&onInspectRequest?<button type="button" onClick={()=>onInspectRequest(inspectRequestId)}>检查原请求</button>:null}{receipt?.status==='accepted'?<button type="button" disabled={busy} onClick={()=>{locked.current=false;setReceipt(undefined);setInspectRequestId(undefined);setText('');setNotice('请输入新任务后显式提交。');}}>准备新任务</button>:null}{!canUpdate||!canRequest?<p>此宿主尚未启用正式代理路径；可添加选择附件后手动发送。</p>:null}</section>;
}
