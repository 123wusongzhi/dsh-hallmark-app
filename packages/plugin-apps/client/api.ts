import type {CapabilityResult,JsonValue} from '../../app-contracts/src/index.ts';
import type {AppsBindingData,AppsViewData} from '../../app-presentation/src/types.ts';
import {cacheFallbackAllowed,cacheRetryAt} from '../../presentation/src/cache-display.ts';
export interface WorkbenchStoreOption {id:string;name:string;connectionId:string}
export interface WorkbenchStores {stores:WorkbenchStoreOption[]}
async function fetchRead(url:string,options:RequestInit):Promise<Response>{
  try{return await fetch(url,options);}catch(cause){if(options.signal?.aborted)throw cause;throw Object.assign(new Error(cause instanceof Error?cause.message:'网络暂时无法连接。'),{code:'RUNTIME_UNAVAILABLE',retryPolicy:'read_retry'});}
}
export async function appsRefreshView<T>(sessionId:string,viewId:string,forceRefresh:boolean,signal?:AbortSignal):Promise<T>{
  const response=await fetchRead('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refreshView',sessionId,viewId,forceRefresh}),signal}),value=await response.json();
  if(!response.ok||value?.status==='failed')throw appsApiError(value,response.status,'数据暂时无法更新。');
  return value as T;
}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function appsApiError(value:unknown,httpStatus:number,fallback:string):Error {
  const error=object(object(value).error);
  return Object.assign(new Error(String(error.message??fallback)),{...error,httpStatus:typeof error.httpStatus==='number'?error.httpStatus:httpStatus});
}
/** Keep only the same binding's successful snapshot; authorization failures invalidate it. */
function samePagingScope(next:AppsBindingData,previous:AppsBindingData,cursorParam?:string):boolean {
  if(!cursorParam||!next.query||!previous.query)return false;
  const a=next.query,b=previous.query;
  if(a.appId!==next.appId||a.connectionId!==next.connectionId||b.appId!==previous.appId||b.connectionId!==previous.connectionId||!a.input||!b.input||typeof a.input!=='object'||typeof b.input!=='object'||Array.isArray(a.input)||Array.isArray(b.input))return false;
  const nextInput={...a.input},previousInput={...b.input},nextCursor=nextInput[cursorParam],previousCursor=previousInput[cursorParam];
  if(nextCursor===previousCursor||(nextCursor!==undefined&&typeof nextCursor!=='string')||(previousCursor!==undefined&&typeof previousCursor!=='string'))return false;
  delete nextInput[cursorParam];delete previousInput[cursorParam];
  return actionKey({...a,input:nextInput} as unknown as JsonValue)===actionKey({...b,input:previousInput} as unknown as JsonValue);
}
export function mergeCachedAppsData(next:AppsViewData,previous?:AppsViewData,pagingCursorParams:Record<string,string>={}):{data:AppsViewData;retained:string[];failed:string[];retryAt:number}{
  const retained:string[]=[],failed:string[]=[];let retryAt=0;
  const bindings=next.bindings.map(binding=>{
    if(!['failed','unavailable'].includes(binding.state))return binding;
    failed.push(binding.bindingId);
    if(!cacheFallbackAllowed(binding.error))return {...binding,payload:null,lastSuccessAt:null,sourceDataTime:null};
    const at=cacheRetryAt(binding.error,binding.payload);retryAt=Math.max(retryAt,at);
    const old=previous?.viewId===next.viewId?previous.bindings.find(item=>item.bindingId===binding.bindingId&&item.appId===binding.appId&&item.connectionId===binding.connectionId&&(item.datasetId===binding.datasetId||samePagingScope(binding,item,pagingCursorParams[binding.bindingId]))):undefined;
    if(!old||old.payload===null||!old.lastSuccessAt||!Number.isFinite(Date.parse(old.lastSuccessAt))||(['failed','unavailable'].includes(old.state)&&!cacheFallbackAllowed(old.error)))return binding;
    retained.push(binding.bindingId);const payload=object(old.payload);
    return {...old,state:binding.state,error:binding.error,freshness:'stale' as const,payload:Array.isArray(old.payload)||typeof old.payload!=='object'?old.payload:{...payload,cache:{...object(payload.cache),stale:true,nextRefreshAt:new Date(at).toISOString()}} as JsonValue};
  });
  return {data:{...next,bindings},retained,failed,retryAt};
}
const actionKey=(value:JsonValue):string=>Array.isArray(value)?'['+value.map(actionKey).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+actionKey(value[key])).join(',')+'}':JSON.stringify(value);
export async function appsResource<T>(resource:string,query:Record<string,string>={},signal?:AbortSignal):Promise<T>{const response=await fetchRead(`/api/dsh-apps?${new URLSearchParams({resource,...query})}`,{credentials:'same-origin',signal}),value=await response.json();if(!response.ok||value?.status==='failed')throw appsApiError(value,response.status,'Apps Runtime暂不可用。');return value;}
export interface UnconfirmedPresentation {requestId:string;sessionId:string;capabilityId:string}
// Retain original IDs across local view/tab unmounts; no implicit retry on re-open.
const unconfirmed=new Map<string,UnconfirmedPresentation>();
export function unconfirmedPresentation(error:unknown):UnconfirmedPresentation|undefined {const value=object(error);return value.unconfirmed===true&&typeof value.requestId==='string'&&typeof value.sessionId==='string'&&typeof value.capabilityId==='string'?{requestId:value.requestId,sessionId:value.sessionId,capabilityId:value.capabilityId}:undefined;}
export async function appsPresentation<T>(sessionId:string,capabilityId:string,input:JsonValue,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();const key=actionKey({sessionId,capabilityId,input}),previous=unconfirmed.get(key);if(previous)throw Object.assign(new Error('原界面调用仍未确认，请先检查原调用。'),{...previous,unconfirmed:true});
  const requestId=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`,identity={requestId,sessionId,capabilityId};let response:Response,value:CapabilityResult;
  unconfirmed.set(key,identity);
  try{response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'presentation',sessionId,capabilityId,input,requestId}),signal});value=await response.json();}catch{unconfirmed.set(key,identity);throw Object.assign(new Error('原界面调用回执未确认；请检查原调用，不会自动重发。'),{...identity,unconfirmed:true,code:'PRESENTATION_RESPONSE_LOST'});}
  if(!response.ok||value?.status!=='ok'){const uncertain=response.status>=500||['unknown','pending'].includes(String(value?.status))||object(object(value).error).retryPolicy==='inspect_only';if(!uncertain)unconfirmed.delete(key);throw Object.assign(appsApiError(value,response.status,String(value?.status==='needs_clarification'?value.question:'共享界面操作未确认。')),{...identity,unconfirmed:uncertain,details:value});}
  unconfirmed.delete(key);
  return value.data as T;
}
/** This only reads the original invocation. Missing or in-flight receipts stay locked. */
export async function inspectPresentation<T>(pending:UnconfirmedPresentation,signal?:AbortSignal):Promise<{settled:boolean;value?:T;error?:Error}>{
  const value=await appsResource<{invocation:null|{invocationId:string;request:{capabilityId:string;source:{sessionId?:string}};state:string;result?:CapabilityResult}}>('presentationRequest',{sessionId:pending.sessionId,requestId:pending.requestId},signal),invocation=value.invocation;
  if(!invocation||invocation.state!=='settled'||!invocation.result)return {settled:false};
  if(invocation.invocationId!==pending.requestId||invocation.request.capabilityId!==pending.capabilityId||invocation.request.source.sessionId!==pending.sessionId)throw new Error('原界面调用回执身份不一致。');
  const result=invocation.result;if(result.status==='ok'){for(const [key,value]of unconfirmed)if(value.sessionId===pending.sessionId&&value.requestId===pending.requestId)unconfirmed.delete(key);return {settled:true,value:result.data as T};}
  if(['unknown','pending'].includes(result.status)||object(object(result).error).retryPolicy==='inspect_only')return {settled:false};
  for(const [key,value]of unconfirmed)if(value.sessionId===pending.sessionId&&value.requestId===pending.requestId)unconfirmed.delete(key);
  return {settled:true,error:Object.assign(new Error(String(result.status==='needs_clarification'?result.question:object(object(result).error).message??'原调用已结束，界面动作未成功。')),{code:object(object(result).error).code})};
}
export async function appsAuthoring<T>(sessionId:string,operation:string,params:JsonValue,signal?:AbortSignal):Promise<T>{const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',sessionId,operation,params}),signal}),value=await response.json();if(!response.ok||value?.status==='failed')throw appsApiError(value,response.status,'创作状态未确认。');return value;}

/** Workbench state belongs to an app; source preparation and previews use the current chat. */
export async function appsWorkbench<T>(appId:string,operation:'save'|'read'|'preview'|'initialize'|'prepare'|'pinComponent'|'unpinComponent',params:unknown,signal?:AbortSignal,sessionId?:string):Promise<T>{
  const response=await (operation==='read'||operation==='preview'?fetchRead:fetch)('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workbench',operation,appId,params,...(sessionId?{sessionId}:{})}),signal});
  const value=await response.json();
  if(!response.ok||value?.status==='failed')throw appsApiError(value,response.status,'工作台操作未完成。');
  return value as T;
}
