import type {CapabilityResult,JsonValue} from '../../app-contracts/src/index.ts';
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const actionKey=(value:JsonValue):string=>Array.isArray(value)?'['+value.map(actionKey).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+actionKey(value[key])).join(',')+'}':JSON.stringify(value);
export async function appsResource<T>(resource:string,query:Record<string,string>={},signal?:AbortSignal):Promise<T>{const response=await fetch(`/api/dsh-apps?${new URLSearchParams({resource,...query})}`,{credentials:'same-origin',signal}),value=await response.json();if(!response.ok||value?.status==='failed')throw Object.assign(new Error(String(object(object(value).error).message??'Apps Runtime暂不可用。')),{code:object(object(value).error).code});return value;}
export interface UnconfirmedPresentation {requestId:string;sessionId:string;capabilityId:string}
// Retain original IDs across local view/tab unmounts; no implicit retry on re-open.
const unconfirmed=new Map<string,UnconfirmedPresentation>();
export function unconfirmedPresentation(error:unknown):UnconfirmedPresentation|undefined {const value=object(error);return value.unconfirmed===true&&typeof value.requestId==='string'&&typeof value.sessionId==='string'&&typeof value.capabilityId==='string'?{requestId:value.requestId,sessionId:value.sessionId,capabilityId:value.capabilityId}:undefined;}
export async function appsPresentation<T>(sessionId:string,capabilityId:string,input:JsonValue,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();const key=actionKey({sessionId,capabilityId,input}),previous=unconfirmed.get(key);if(previous)throw Object.assign(new Error('原界面调用仍未确认，请先检查原调用。'),{...previous,unconfirmed:true});
  const requestId=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`,identity={requestId,sessionId,capabilityId};let response:Response,value:CapabilityResult;
  unconfirmed.set(key,identity);
  try{response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'presentation',sessionId,capabilityId,input,requestId}),signal});value=await response.json();}catch{unconfirmed.set(key,identity);throw Object.assign(new Error('原界面调用回执未确认；请检查原调用，不会自动重发。'),{...identity,unconfirmed:true,code:'PRESENTATION_RESPONSE_LOST'});}
  if(!response.ok||value?.status!=='ok'){const uncertain=response.status>=500||['unknown','pending'].includes(String(value?.status))||object(object(value).error).retryPolicy==='inspect_only';if(!uncertain)unconfirmed.delete(key);throw Object.assign(new Error(String(value?.status==='needs_clarification'?value.question:object(object(value).error).message??'共享界面操作未确认。')),{...identity,unconfirmed:uncertain,code:object(object(value).error).code,details:value});}
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
export async function appsAuthoring<T>(sessionId:string,operation:string,params:JsonValue,signal?:AbortSignal):Promise<T>{const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',sessionId,operation,params}),signal}),value=await response.json();if(!response.ok||value?.status==='failed')throw new Error(String(object(object(value).error).message??'创作状态未确认。'));return value;}
