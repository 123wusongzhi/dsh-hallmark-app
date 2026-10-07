import type { CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';
import type { RuntimeStore } from './store.ts';
export function projectModelResult(store:RuntimeStore,result:CapabilityResult,budget=16384):{content:string;fullResultRef?:string} {
  if(!Number.isSafeInteger(budget)||budget<512||budget>16384)throw new Error('INVALID_MODEL_BUDGET');
  const full=JSON.stringify(result);if(Buffer.byteLength(full,'utf8')<=budget)return {content:full};
  const id=`result:${result.invocationId}`;
  try{store.put('datasets',id,{datasetId:id,kind:'invocation-result',revision:'1',result,createdAt:new Date().toISOString()});}
  catch {return {content:JSON.stringify({status:'failed',error:{code:'RESULT_SPILL_FAILED',message:'Use a smaller page or projection.',retryPolicy:'never'}})};}
  const summary={status:result.status,invocationId:result.invocationId,traceId:result.traceId,operation:result.operation??null,fullResultRef:id,bytes:Buffer.byteLength(full,'utf8'),completeness:'partial',message:'Full result is available through the Runtime result handle.'};
  let content=JSON.stringify(summary);if(Buffer.byteLength(content,'utf8')>budget)content=JSON.stringify({status:result.status,fullResultRef:id,completeness:'partial'});
  if(Buffer.byteLength(content,'utf8')>budget)throw new Error('MODEL_BUDGET_EXCEEDED');
  return {content,fullResultRef:id};
}
export function readResultPage(store:RuntimeStore,id:string,cursor='0',limit=100) {
  const stored=store.get<{result:CapabilityResult}>('datasets',id);if(!stored)throw new Error('RESULT_NOT_FOUND');
  const offset=Number(cursor);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('INVALID_PAGE');
  const data='data' in stored.result?stored.result.data:null;
  if(Array.isArray(data)){const items=data.slice(offset,offset+limit);return {datasetId:id,revision:'1',items,total:data.length,returned:items.length,nextCursor:offset+items.length<data.length?String(offset+items.length):null,completeness:offset===0&&items.length===data.length?'complete':'partial'};}
  return {datasetId:id,revision:'1',result:stored.result as unknown as JsonValue,returned:1,total:1,nextCursor:null,completeness:'complete'};
}
