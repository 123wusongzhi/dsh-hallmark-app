// This module intentionally has no dependency on write.ts; synchronization is read-only.
import { randomUUID } from 'node:crypto';
import { projectOperationReceipt } from './receipt.ts';
import { CATEGORY_TOOL, prepareCategory, readCategory } from './category.ts';
import { COLLECTED_TOOL, prepareCollected, readCollected } from './collected.ts';
import { failed, clarify } from '../../contracts/src/index.ts';
import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
import { clean, now, productStoreId, profitRows, METRIC_BASIS, wrapped, sourceTime, storeId as sourceStoreId } from './types.ts';
import type { CoreStore, CoreClient, Operation, RecordData, AdapterResponse } from './types.ts';
export class DatasetRefresher {
 store:CoreStore;client:CoreClient;inflight=new Map<string,Promise<ToolResult>>();
 #sourceFlight?:Promise<AdapterResponse>;
 constructor(store:CoreStore,client:CoreClient){this.store=store;this.client=client;}
 refresh(datasetKey:string,context:InvocationContext):Promise<ToolResult> {
  const running=this.inflight.get(datasetKey);if(running)return running;
  const promise=this.run(datasetKey,context).finally(()=>this.inflight.delete(datasetKey));this.inflight.set(datasetKey,promise);return promise;
 }
 private async run(datasetKey:string,context:InvocationContext):Promise<ToolResult> {
  const receipt=/^operation:(.+)$/.exec(datasetKey);
  if(receipt)return context.signal?.aborted?failed('ABORTED','刷新已取消。'):projectOperationReceipt(this.store,receipt[1]);
  const query=datasetKey.startsWith('query:')?this.store.get('queries',datasetKey.slice(6))??this.store.get('views',`draft-query:${datasetKey}`):undefined;
  if(query?.tool===CATEGORY_TOOL||datasetKey.startsWith('category:'))return this.refreshCategory(datasetKey,query,context);
  if(query?.tool===COLLECTED_TOOL||datasetKey.startsWith('collected:'))return this.refreshCollected(datasetKey,query,context);
  const supportedQuery=query&&['hallmark_list_store_products','hallmark_compute_profit','hallmark_filter_products'].includes(query.tool);
  const match=/^(store_products|profit):(.+)$/.exec(datasetKey)??(supportedQuery?[datasetKey,query.tool==='hallmark_list_store_products'?'store_products':'profit','']:null);
  if(!match)return {status:'unavailable',error:{code:'DATASET_NOT_SUPPORTED',message:'支持 operation:<operationId> 本地操作账本数据集、店铺商品/利润及已保存 hallmark_list_store_products、hallmark_compute_profit、hallmark_filter_products 查询；查询店铺须以 storeId 或 store 名称唯一解析。另支持固定类目六模式与采集摘要搜索；其他查询包括操作回执、平台与采集详情查询刷新未开放，绝不后台调用任意工具。',retryable:false}};
  if(context.signal?.aborted)return failed('ABORTED','刷新已取消。');
  let storeId=match[2];const operationId=randomUUID();const timestamp=now();
  const op:Operation={operationId,kind:'refresh',sessionId:context.sessionId,storeId,targets:[],input:{datasetKey},state:'running',hallmarkRefs:[],items:[],createdAt:timestamp,updatedAt:timestamp};
  this.store.put('operations',operationId,op);projectOperationReceipt(this.store,operationId);this.store.updateSnapshotState(datasetKey,'refreshing');
  try {
   if(query){
    const resolved=await this.resolveQueryStore(query.params??{});if('result' in resolved)return this.finishFailure(op,datasetKey,resolved.result);
    storeId=resolved.storeId;op.storeId=storeId;this.store.put('operations',operationId,op);projectOperationReceipt(this.store,operationId);
   }
   const response=await this.syncAndReadSource();if(response.status!=='ok')return this.finishFailure(op,datasetKey,wrapped(response));
   if(!Array.isArray(response.raw?.products))return this.finishFailure(op,datasetKey,failed('INVALID_SOURCE_RESPONSE','Hallmark 商品响应缺少 products 数组。'));
   const storeStatus=response.raw.stores?.find((row:RecordData)=>String(row.id??row.storeId)===storeId);
   if(!storeStatus)return this.finishFailure(op,datasetKey,failed('STORE_NOT_FOUND','源快照不存在指定店铺，不能将空数据视为刷新成功。'));
   if(storeStatus?.error)return this.finishFailure(op,datasetKey,failed('STORE_SYNC_FAILED',String(storeStatus.error),true));
   const products=response.raw.products.filter((row:RecordData)=>productStoreId(row)===storeId);
   const dataTime=sourceTime(storeStatus?.lastSuccessAt,response.raw.dataTime,response.provenance?.dataTime);
   let payload:RecordData={...response.raw,products:match[1]==='profit'?profitRows(products):products};
   if(query){
    const p=query.params;
    payload.products=payload.products.filter((row:RecordData)=>(!p.offerIds&&!p.productIds)||p.offerIds?.includes(String(row.offerId??row.offer_id))||p.productIds?.includes(String(row.productId??row.product_id)));
    if(p.query)payload.products=payload.products.filter((row:RecordData)=>JSON.stringify(row).toLowerCase().includes(String(p.query).toLowerCase()));
    if(query.tool==='hallmark_filter_products'){
     const unable:RecordData[]=[];
     payload.products=payload.products.filter((row:RecordData)=>{
      const margin=row.referenceProfit.margin;if((p.minMargin!=null||p.maxMargin!=null)&&margin==null){unable.push(row);return false;}
      const price=Number(typeof row.price==='object'?row.price.price:row.price??row.priceMinor/100),stock=Number(row.stock??row.stockTotal??row.stocks?.reduce((n:number,s:RecordData)=>n+Number(s.present??s.stock??0),0));
      return !(p.minMargin!=null&&margin<p.minMargin||p.maxMargin!=null&&margin>p.maxMargin||p.minPrice!=null&&(!Number.isFinite(price)||price<p.minPrice)||p.maxPrice!=null&&(!Number.isFinite(price)||price>p.maxPrice)||p.minStock!=null&&(!Number.isFinite(stock)||stock<p.minStock)||p.maxStock!=null&&(!Number.isFinite(stock)||stock>p.maxStock)||p.status&&row.status!==p.status);
     });payload.unable=unable;
    }
   }
   const {dataTime:ignoredSourceTime,...sourceProvenance}=response.provenance??{};
   const metadata=clean({sourceSpill:response.spill,provenance:{...sourceProvenance,source:response.provenance?.source??'hallmark_snapshot',storeId,...(dataTime?{dataTime}:{})},...(match[1]==='profit'?{metricBasis:METRIC_BASIS}:{})});
   const snapshot=this.store.updateSnapshotSuccess(datasetKey,payload,dataTime,metadata);
   const {payload:storedPayload,...snapshotStatus}=snapshot;
   const result:ToolResult={status:'ok',data:{datasetKey,snapshot:snapshotStatus,counts:{products:payload.products.length,unable:payload.unable?.length??0},...(response.spill?{spill:response.spill}:{})},provenance:metadata.provenance,operation:{operationId,state:'succeeded'},...(match[1]==='profit'?{metricBasis:METRIC_BASIS}:{})};
   this.store.put('operations',operationId,clean({...op,state:'succeeded',result,updatedAt:now()}));projectOperationReceipt(this.store,operationId);return result;
  } catch(error){return this.finishFailure(op,datasetKey,{status:'unavailable',error:{code:'REFRESH_ERROR',message:error instanceof Error?error.message:'刷新失败',retryable:true}});}
 }
 private async refreshCollected(datasetKey:string,savedQuery:RecordData|undefined,context:InvocationContext):Promise<ToolResult> {
  if(context.signal?.aborted)return failed('ABORTED','刷新已取消。');
  const recipe=savedQuery??this.store.get('snapshots',datasetKey)?.sourceQuery;
  if(recipe?.tool!==COLLECTED_TOOL)return {status:'unavailable',error:{code:'DATASET_NOT_SUPPORTED',message:'采集快照没有固定只读查询配方，请重新查询。',retryable:false}};
  const operationId=randomUUID(),timestamp=now();
  const op:Operation={operationId,kind:'refresh',sessionId:context.sessionId,storeId:'',targets:[],input:{datasetKey},state:'running',hallmarkRefs:[],items:[],createdAt:timestamp,updatedAt:timestamp};
  this.store.put('operations',operationId,op);projectOperationReceipt(this.store,operationId);
  try {
   const prepared=prepareCollected(recipe.params);if('result' in prepared)return this.finishFailure(op,datasetKey,prepared.result);
   if(!savedQuery&&prepared.datasetKey!==datasetKey)return this.finishFailure(op,datasetKey,failed('DATASET_QUERY_MISMATCH','采集快照查询或分页范围与精确数据集编号不一致。'));
   this.store.updateSnapshotState(datasetKey,'refreshing');
   const response=await readCollected(this.store,this.client,prepared,datasetKey);
   if(response.status!=='ok')return this.finishFailure(op,datasetKey,response);
   const result:ToolResult={...response,operation:{operationId,state:'succeeded'}};
   this.store.put('operations',operationId,clean({...op,state:'succeeded',result,updatedAt:now()}));projectOperationReceipt(this.store,operationId);return result;
  }catch(error){return this.finishFailure(op,datasetKey,failed('REFRESH_ERROR',error instanceof Error?error.message:'采集资料刷新失败',true));}
 }
 private async refreshCategory(datasetKey:string,savedQuery:RecordData|undefined,context:InvocationContext):Promise<ToolResult> {
  if(context.signal?.aborted)return failed('ABORTED','刷新已取消。');
  const recipe=savedQuery??this.store.get('snapshots',datasetKey)?.sourceQuery;
  if(recipe?.tool!==CATEGORY_TOOL)return {status:'unavailable',error:{code:'DATASET_NOT_SUPPORTED',message:'类目快照没有可信的固定只读查询配方，请重新查询。',retryable:false}};
  const operationId=randomUUID(),timestamp=now();
  const op:Operation={operationId,kind:'refresh',sessionId:context.sessionId,storeId:'',targets:[],input:{datasetKey},state:'running',hallmarkRefs:[],items:[],createdAt:timestamp,updatedAt:timestamp};
  this.store.put('operations',operationId,op);projectOperationReceipt(this.store,operationId);
  try {
   const prepared=prepareCategory(recipe.params);if('result' in prepared)return this.finishFailure(op,datasetKey,prepared.result);
   if(!savedQuery&&prepared.datasetKey!==datasetKey)return this.finishFailure(op,datasetKey,failed('DATASET_QUERY_MISMATCH','类目快照查询范围与精确数据集编号不一致。'));
   const resolved=await this.resolveQueryStore(recipe.params);if('result' in resolved)return this.finishFailure(op,datasetKey,resolved.result);
   const scoped=prepareCategory(recipe.params,resolved.storeId);if('result' in scoped)return this.finishFailure(op,datasetKey,scoped.result);
   if(!savedQuery&&scoped.datasetKey!==datasetKey)return this.finishFailure(op,datasetKey,failed('DATASET_QUERY_MISMATCH','店铺解析结果改变了类目快照范围。'));
   if(context.signal?.aborted)return this.finishFailure(op,datasetKey,failed('ABORTED','刷新已取消。'));
   op.storeId=resolved.storeId;this.store.put('operations',operationId,op);this.store.updateSnapshotState(datasetKey,'refreshing');
   const response=await readCategory(this.store,this.client,scoped,datasetKey);
   if(response.status!=='ok')return this.finishFailure(op,datasetKey,response);
   const result:ToolResult={...response,operation:{operationId,state:'succeeded'}};
   this.store.put('operations',operationId,clean({...op,state:'succeeded',result,updatedAt:now()}));projectOperationReceipt(this.store,operationId);return result;
  }catch(error){return this.finishFailure(op,datasetKey,failed('REFRESH_ERROR',error instanceof Error?error.message:'类目刷新失败',true));}
 }
 /** Only actual overlapping synchronizations share this promise; sequential scheduler batches are not memoized. */
 private syncAndReadSource():Promise<AdapterResponse> {
  if(this.#sourceFlight)return this.#sourceFlight;
  const job=(async()=>{const synced=await this.client.syncStoreProducts();return synced.status==='ok'?await this.client.getStoreProducts():synced;})().finally(()=>{this.#sourceFlight=undefined;});
  this.#sourceFlight=job;return job;
 }
 private async resolveQueryStore(params:RecordData):Promise<{storeId:string}|{result:ToolResult}> {
  if(!(typeof params.storeId==='string'&&params.storeId.trim())&&!(typeof params.store==='string'&&params.store.trim()))return {result:{...clarify(['storeId/store'],'已保存查询缺少明确店铺；请提供 storeId 或可唯一解析的 store 名称。'),error:{code:'STORE_REQUIRED',message:'没有可核实的查询目标店铺。',retryable:false}}};
  const response=await this.client.getStores();if(response.status!=='ok')return {result:wrapped(response)};
  if(!Array.isArray(response.raw))return {result:failed('INVALID_SOURCE_RESPONSE','Hallmark getStores 原文必须为店铺数组。')};
  const query=String(params.storeId??params.store).toLocaleLowerCase();
  const names=(row:RecordData)=>[sourceStoreId(row),row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])];
  const exact=response.raw.filter((row:RecordData)=>names(row).some(value=>String(value??'').toLocaleLowerCase()===query));
  const matches=exact.length?exact:params.storeId?[]:response.raw.filter((row:RecordData)=>[row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])].some(value=>value&&String(value).toLocaleLowerCase().includes(query)));
  if(matches.length!==1){const code=matches.length?'STORE_AMBIGUOUS':'STORE_NOT_FOUND',message=matches.length?'已保存查询的店铺名称匹配不唯一，请选择明确店铺。':'未找到已保存查询指定的店铺，请核对。';return {result:{...clarify(['storeId'],message,matches),error:{code,message,retryable:false},...(response.provenance?{provenance:response.provenance}:{})}};}
  if(params.storeId&&params.store&&!names(matches[0]).some(value=>value&&String(value).toLocaleLowerCase().includes(String(params.store).toLocaleLowerCase())))return {result:{...clarify(['store'],'已保存查询的店铺 ID 与名称不一致。',matches),error:{code:'STORE_SELECTION_MISMATCH',message:'店铺 ID 与名称未指向同一已知店铺。',retryable:false}}};
  const resolvedId=sourceStoreId(matches[0]);if(!resolvedId)return {result:failed('INVALID_SOURCE_RESPONSE','唯一店铺原文缺少店铺 ID。')};
  return {storeId:resolvedId};
 }
 private finishFailure(op:Operation,key:string,result:ToolResult):ToolResult {
  this.store.updateSnapshotState(key,'failed',result.error??{code:'REFRESH_FAILED'});
  const state=result.status==='unknown'?'unknown':'failed';const output={...result,operation:{operationId:op.operationId,state}} as ToolResult;
  this.store.put('operations',op.operationId,clean({...op,state,error:result.error??null,result:output,updatedAt:now()}));projectOperationReceipt(this.store,op.operationId);return output;
 }
 /** Startup recovery is local-only and never replays a source synchronization or business write. */
 recover():ToolResult[] {
  const results:ToolResult[]=[];
  for(const op of this.store.list<Operation>('operations')){
   if(op.kind!=='refresh'||!['pending','running','unknown'].includes(op.state)||this.inflight.has(op.input.datasetKey))continue;
   const error={code:'REFRESH_INTERRUPTED',message:'刷新进程中断；保留最近成功数据，等待单独只读刷新。',retryable:true};
   results.push(this.store.transaction(()=>this.finishFailure(op,op.input.datasetKey,{status:'failed',error})));
  }
  return results;
 }
 async idle():Promise<void>{await Promise.all(this.inflight.values());}
}
