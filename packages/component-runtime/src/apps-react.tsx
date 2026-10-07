import {useCallback,useEffect,useRef,useState} from 'react';
import type {BridgeHello,ComponentAgentReceipt,ComponentAgentRequest,ComponentContextUpdate,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import {createAppsClient} from './apps-client.ts';
import type {AppsComponentClient} from './apps-client.ts';

/** Local sorting, selection and display state belong in the component's ordinary React state. */
export function useApps(){
  const client=useRef<AppsComponentClient>();
  const [data,setData]=useState<JsonValue>(),[context,setContext]=useState<JsonValue>(),[hello,setHello]=useState<BridgeHello>();
  const [loading,setLoading]=useState(true),[error,setError]=useState<Error>();
  useEffect(()=>{
    const connection=createAppsClient();client.current=connection;let active=true;
    const unsubscribe=connection.subscribe(event=>{if(active)(event.event==='data'?setData:setContext)(event.data);});
    Promise.all([connection.hello(),connection.getData(),connection.getContext()]).then(([handshake,nextData,nextContext])=>{if(active){setHello(handshake);setData(nextData);setContext(nextContext);}}).catch(reason=>{if(active)setError(reason instanceof Error?reason:new Error(String(reason)));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;unsubscribe();connection.dispose();if(client.current===connection)client.current=undefined;};
  },[]);
  const connection=()=>{if(!client.current)throw new Error('Component host is not connected.');return client.current;};
  const refresh=useCallback(async(bindingIds?:string[])=>{const owner=connection();setLoading(true);try{const next=await owner.refresh(bindingIds);if(client.current===owner){setData(next);setError(undefined);}return next;}catch(reason){if(client.current===owner)setError(reason instanceof Error?reason:new Error(String(reason)));throw reason;}finally{if(client.current===owner)setLoading(false);}},[]);
  const updateContext=useCallback(async(input:ComponentContextUpdate)=>{const owner=connection(),receipt=await owner.updateContext(input);if(client.current===owner)setContext(previous=>({...object(previous),contextRevision:receipt.contextRevision,snapshotId:receipt.snapshotId,snapshot:receipt.snapshot} as unknown as JsonValue));return receipt;},[]);
  return {data,context,hello,loading,error,refresh,attachSelection:useCallback((selection:SelectionEnvelope)=>connection().attachSelection(selection),[]),invokeCapability:useCallback((input:JsonValue)=>connection().invokeCapability(input),[]),updateContext,requestAgent:useCallback((input:ComponentAgentRequest)=>connection().requestAgent(input),[]),resize:useCallback((height:number)=>connection().resize(height),[])};
}

function object(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
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
