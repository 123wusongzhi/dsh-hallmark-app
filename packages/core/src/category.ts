import { createHash } from 'node:crypto';
import { categoryRequest } from '../../hallmark-adapter/category.ts';
import type { CategoryDataInput } from '../../hallmark-adapter/types.ts';
import { TOOL_DEFINITIONS, clarify, failed, validate } from '../../contracts/src/index.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { CoreClient, CoreStore, RecordData } from './types.ts';
import { clean, sourceTime, wrapped } from './types.ts';

export const CATEGORY_TOOL = 'hallmark_get_category_data';
export interface CategoryQuery { input: CategoryDataInput; datasetKey: string }
const required: Record<string, string[]> = {
 search:['q'], show:['descriptionCategoryId','typeId'], template:['descriptionCategoryId','typeId'],
 values:['descriptionCategoryId','typeId','attributeId'],
 validate_value:['descriptionCategoryId','typeId','attributeId','valueId','dictionaryId'], sync:[],
};

/** Also used for persisted query recipes: never trust saved parameters more than a tool call. */
export function prepareCategory(args: RecordData, resolvedStoreId?: string): CategoryQuery | { result: ToolResult } {
 const errors=validate(TOOL_DEFINITIONS.find(tool=>tool.name===CATEGORY_TOOL)!.parameters,args);
 if(errors.length)return {result:failed('INVALID_PARAMS',errors.join('; '))};
 const missing=required[args.mode].filter(key=>!Object.hasOwn(args,key));
 if(!args.storeId&&!args.store)missing.unshift('storeId/store');
 if(missing.length)return {result:clarify(missing,'请明确类目查询对应的店铺与必要字段。')};
 const {store, ...params}=args;
 // A name is resolved by Core before execution. This placeholder only validates non-store fields.
 const input={...params,storeId:resolvedStoreId??args.storeId??'pending-store-resolution'} as CategoryDataInput;
 const route=categoryRequest(input);if('status' in route)return {result:wrapped(route)};
 if(input.mode==='search'){
  input.q=input.q.trim();input.limit??=10;input.requireAspects??=false;
  if(input.aspects?.length)input.aspects=input.aspects.map(value=>value.trim());else delete input.aspects;
 }else if(input.mode==='values'){input.limit??=50;if(input.q!==undefined)input.q=input.q.trim();}
 // Hash the exact canonical Source request, including all scope and bounded-query parameters.
 const identity=JSON.stringify({method:route.method,endpoint:route.endpoint,body:route.body??null});
 return {input,datasetKey:`category:${createHash('sha256').update(identity).digest('hex')}`};
}

/** Fixed read/cache capability only. Recipe persistence is snapshot metadata, not an implicit saved entry. */
export async function readCategory(store:CoreStore,client:CoreClient,query:CategoryQuery,datasetKey=query.datasetKey):Promise<ToolResult> {
 const sourceQuery={tool:CATEGORY_TOOL,params:query.input};
 const previous=store.get('snapshots',datasetKey);
 store.put('snapshots',datasetKey,{...previous,datasetKey,sourceQuery});
 const fail=(result:ToolResult)=>{
  store.updateSnapshotState(datasetKey,'failed',result.error??{code:'CATEGORY_READ_FAILED'});return result;
 };
 if(!client.getCategoryData)return fail({status:'unavailable',error:{code:'CAPABILITY_UNAVAILABLE',message:'当前 Source 适配器未提供类目只读能力。',retryable:false}});
 try {
  const response=await client.getCategoryData(query.input);
  if(response.status!=='ok')return fail(wrapped(response));
  const raw=response.raw;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail(failed('INVALID_SOURCE_RESPONSE','类目响应必须为原始 JSON 对象。'));
  if(raw.storeId!==undefined&&raw.storeId!==query.input.storeId)return fail(failed('CATALOG_IDENTITY_MISMATCH','类目响应店铺与明确选择不一致。'));
  const dataTime=sourceTime(raw.fetchedAt,raw.treeFetchedAt);
  const {dataTime:ignored,...sourceProvenance}=response.provenance??{};
  const provenance=clean({...sourceProvenance,source:response.provenance?.source??'hallmark_snapshot',storeId:query.input.storeId,...(dataTime?{dataTime}:{})});
  store.updateSnapshotSuccess(datasetKey,raw,dataTime,clean({sourceQuery,provenance,sourceSpill:response.spill}));
  // 'ok' means the read succeeded, never that partial/stale/candidate data is verified or allowed.
  return {status:'ok',data:clean({datasetKey,query:sourceQuery,...(response.spill?{spill:response.spill}:{raw})}),provenance};
 }catch(error){return fail(failed('CATEGORY_READ_FAILED',error instanceof Error?error.message:'类目查询失败',true));}
}
