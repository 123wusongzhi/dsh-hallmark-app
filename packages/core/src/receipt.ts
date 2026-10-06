// Local ledger/cache projection only. No business writes, remote verification or operation replay dependencies.
import type {Provenance,ToolResult,OperationState} from '../../contracts/src/index.ts';
import type {CoreStore,RecordData} from './types.ts';
import {clean,sourceTime} from './types.ts';

export const OPERATION_RECEIPT_TIME_BASIS='operation_record_updated_at';
export const OPERATION_RECEIPT_BASIS='操作账本记录时间（operation.updatedAt），不是平台商品/价格源数据时间；回执不新增业务核实或写入。';
export interface OperationReceiptItem extends RecordData {target:string;state:string;message:string}
export interface OperationReceiptPayload extends RecordData {
 operationId:string;
 kind:string;
 state:OperationState;
 items:OperationReceiptItem[];
}
export interface OperationReceipt {
 datasetKey:string;
 operationId:string;
 sessionId:string|null;
 dataTime:string|null;
 payload:OperationReceiptPayload;
 provenance:Provenance;
 metricBasis:string;
 timeBasis:typeof OPERATION_RECEIPT_TIME_BASIS;
 recordUpdatedAt:string|null;
}
const STATES=new Set(['pending','running','unknown','succeeded','failed','partial']);
function itemMessage(item:RecordData):string {
 for(const value of [item.message,item.error?.message,item.write?.error?.message,item.verificationError,item.error?.code,item.write?.error?.code])if(typeof value==='string')return value;
 return '';
}

/** Pure read: the operations ledger, not an old receipt cache, is authoritative. */
export function readOperationReceipt(store:CoreStore,operationId:string):OperationReceipt|undefined {
 const operation=store.get<RecordData>('operations',operationId);
 if(!operation||operation.operationId!==operationId||typeof operation.kind!=='string'||!STATES.has(operation.state))return undefined;
 const dataTime=sourceTime(operation.updatedAt);
 const items:OperationReceiptItem[]=(Array.isArray(operation.items)?operation.items:[]).map((item:RecordData)=>({...clean(item),target:typeof item.target==='string'?item.target:String(item.target??''),state:typeof item.state==='string'?item.state:'unknown',message:itemMessage(item)}));
 const payload=clean({...operation,operationId,state:operation.state,items,...(operation.kind==='list_product'&&['succeeded','partial'].includes(operation.state)?{acceptance:'imported-not-sellable-verified'}:{})}) as OperationReceiptPayload;
 return {datasetKey:`operation:${operationId}`,operationId,sessionId:typeof operation.sessionId==='string'?operation.sessionId:null,dataTime,payload,provenance:{source:'app_snapshot',endpoint:'local:operations',...(dataTime?{dataTime}:{})},metricBasis:OPERATION_RECEIPT_BASIS+(payload.acceptance?' 上品只核实平台 imported，不表示 on_sale 或可售验收。':''),timeBasis:OPERATION_RECEIPT_TIME_BASIS,recordUpdatedAt:dataTime};
}

/** Nonthrowing cache update: projection failure must never alter a confirmed business operation. */
export function projectOperationReceipt(store:CoreStore,operationId:string):ToolResult {
 const datasetKey=`operation:${operationId}`;
 try {
  return store.transaction(()=>{
   const receipt=readOperationReceipt(store,operationId);
   if(!receipt){const error={code:'OPERATION_RECEIPT_NOT_FOUND',message:'没有可核实的操作账本记录。',retryable:false};store.updateSnapshotState(datasetKey,'failed',error);return {status:'failed',error} as ToolResult;}
   const snapshot=store.updateSnapshotSuccess(datasetKey,receipt.payload,receipt.dataTime,{sessionId:receipt.sessionId,operationId,provenance:receipt.provenance,metricBasis:receipt.metricBasis,timeBasis:receipt.timeBasis,recordUpdatedAt:receipt.recordUpdatedAt});
   const {payload,...metadata}=snapshot;
   return {status:'ok',data:{datasetKey,operationId,snapshot:metadata,counts:{items:receipt.payload.items.length}},provenance:receipt.provenance,metricBasis:receipt.metricBasis} as ToolResult;
  });
 }catch(error){
  const diagnostic={code:'OPERATION_RECEIPT_CACHE_FAILED',message:error instanceof Error?error.message:'本地操作回执缓存不可用。',retryable:true};
  try {store.updateSnapshotState(datasetKey,'failed',diagnostic);}catch{/* Preserve the ledger even if receipt failure metadata also cannot be cached. */}
  return {status:'failed',error:diagnostic,metricBasis:OPERATION_RECEIPT_BASIS};
 }
}
