import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalJson} from '../packages/app-contracts/src/index.ts';
/** The runner owns HTTP credentials; none are exposed to the component iframe. */
export async function previewData(input){
 if(input.mode==='live_readonly'){
  if(!input.runtime||!input.sessionId||!input.viewId)throw new Error('LIVE_PREVIEW_REQUIRES_RUNTIME_SESSION_VIEW');
  const scopeId=randomUUID();
  const url=new URL('/v1/authoring/preview',input.runtime.url);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('PREVIEW_RUNTIME_LOCAL_ONLY');
  const call=async(action,params={})=>{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:input.sessionId,params:{viewId:input.viewId,scopeId,action,...params}}),signal:AbortSignal.timeout(35000)});const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error?.message??result.message??'Preview Runtime request failed'),{code:result.error?.code??result.code??'PREVIEW_RUNTIME_ERROR'});return result;};
  return {data:await call('data'),readBindingPage:request=>call('page',request),closeData:()=>call('close'),resetData:async()=>{await call('close');return call('data');},readOnlyCapability:request=>call('invoke',{input:request}),refreshData:request=>call('refresh',request??{}),validateSelection:selection=>call('selection',{selection})};
 }
 const fixtures=input.capabilityFixtures;
 return {data:input.data??{viewId:'preview',bindings:[]},...(fixtures?{readOnlyCapability:async request=>{const fixture=fixtures.find(item=>canonicalJson(item.request)===canonicalJson(request));if(!fixture)throw Object.assign(new Error('No fixture for this capability request; pagination has not been verified.'),{code:'PREVIEW_CAPABILITY_UNAVAILABLE'});return fixture.result;}}:{}),...(input.refreshData!==undefined?{refreshData:async()=>input.refreshData}:{})};
}
