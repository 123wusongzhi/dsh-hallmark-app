import { createHash } from 'node:crypto';
import { TOOL_DEFINITIONS, failed, validate } from '../../contracts/src/index.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { CoreClient, CoreStore, RecordData } from './types.ts';
import { clean, sourceTime, wrapped } from './types.ts';

export const COLLECTED_TOOL='hallmark_search_collected_items';
export interface CollectedQuery {params:{query:string;cursor:string;limit:number};datasetKey:string}
export function prepareCollected(args:RecordData):CollectedQuery|{result:ToolResult} {
 const errors=validate(TOOL_DEFINITIONS.find(tool=>tool.name===COLLECTED_TOOL)!.parameters,args);
 if(errors.length)return {result:failed('INVALID_PARAMS',errors.join('; '))};
 const cursor=args.cursor??'0';
 if(!/^(0|[1-9]\d*)$/.test(cursor)||!Number.isSafeInteger(Number(cursor)))return {result:failed('INVALID_CURSOR','分页 cursor 须为规范非负整数偏移。')};
 const params={query:args.query??'',cursor,limit:args.limit??100};
 return {params,datasetKey:`collected:${createHash('sha256').update(JSON.stringify(params)).digest('hex')}`};
}

/** A bounded page of existing source summaries; the adapter's source order is not a recency guarantee. */
export async function readCollected(store:CoreStore,client:CoreClient,query:CollectedQuery,datasetKey=query.datasetKey):Promise<ToolResult> {
 // Empty search is represented by omission so the stored recipe passes the public non-empty string schema.
 const {query:text,...paging}=query.params,sourceQuery={tool:COLLECTED_TOOL,params:{...paging,...(text?{query:text}:{})}};
 store.put('snapshots',datasetKey,{...store.get('snapshots',datasetKey),datasetKey,sourceQuery});
 const fail=(result:ToolResult)=>{store.updateSnapshotState(datasetKey,'failed',result.error??{code:'COLLECTED_READ_FAILED'});return result;};
 try {
  const response=await client.searchCollectedItems(query.params.query);if(response.status!=='ok')return fail(wrapped(response));
  const items=response.matches??response.raw;if(!Array.isArray(items))return fail(failed('INVALID_SOURCE_RESPONSE','采集摘要搜索响应须为数组。'));
  const offset=Number(query.params.cursor),limit=query.params.limit;
  const payload={items:items.slice(offset,offset+limit),total:items.length,...(offset+limit<items.length?{cursor:String(offset+limit)}:{})};
  const dataTime=sourceTime(response.provenance?.dataTime);
  const {dataTime:ignored,...sourceProvenance}=response.provenance??{};
  const provenance=clean({...sourceProvenance,source:response.provenance?.source??'collected_item',...(dataTime?{dataTime}:{})});
  store.updateSnapshotSuccess(datasetKey,payload,dataTime,clean({sourceQuery,provenance,sourceSpill:response.spill}));
  return {status:'ok',data:{datasetKey,...(response.spill?{spill:response.spill,total:items.length,cursor:String(offset),limit}:payload)},provenance};
 }catch(error){return fail(failed('COLLECTED_READ_FAILED',error instanceof Error?error.message:'采集资料读取失败',true));}
}
