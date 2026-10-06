import type { ToolResult, Provenance, InvocationContext, OperationState } from '../../contracts/src/index.ts';
import type { PlatformCallInput, SubmitOrdinaryCnyPriceInput, OrdinaryCnyOperationResult, CategoryDataInput } from '../../hallmark-adapter/types.ts';
import type { ViewSpec } from '../../presentation/src/types.ts';
export type RecordData = Record<string, any>;
export interface CoreStore {
 get<T = RecordData>(collection:string,id:string):T|undefined;
 put<T>(collection:string,id:string,value:T):T;
 list<T = RecordData>(collection:string):T[];
 transaction<T>(fn:(store:any)=>T):T;
 getOperationByClientKey<T = RecordData>(key:string):T|undefined;
 updateSnapshotSuccess(key:string,payload:unknown,dataTime:string|null,metadata?:RecordData):RecordData;
 updateSnapshotState(key:string,state:'empty'|'refreshing'|'failed',error?:unknown):RecordData;
}
export interface AdapterResponse {status:'ok'|'failed'|'unknown'|'unavailable';raw?:any;provenance?:Provenance;error?:{code:string;message:string;retryable:boolean;retryAfterMs?:number};spill?:unknown;matches?:any[]}
export interface CoreClient {
 getStores():Promise<AdapterResponse>;getStoreProducts():Promise<AdapterResponse>;syncStoreProducts():Promise<AdapterResponse>;
 getTargetMargin():Promise<AdapterResponse>;searchCollectedItems(query?:string):Promise<AdapterResponse>;getCollectedItem(id:string):Promise<AdapterResponse>;getCollectedItemDetail?(id:string):Promise<AdapterResponse>;
 platformCall(taskId:string,input:PlatformCallInput):Promise<AdapterResponse>;platformRead(taskId:string,input:PlatformCallInput):Promise<AdapterResponse>;
 getTask?(taskId:string):Promise<AdapterResponse>;verifyTask?(taskId:string):Promise<AdapterResponse>;
 submitOrdinaryCnyPrice?(input:SubmitOrdinaryCnyPriceInput):Promise<OrdinaryCnyOperationResult>;
 getOrdinaryCnyOperation?(storeId:string,operationId:string):Promise<OrdinaryCnyOperationResult>;
 inspectOrdinaryCnyOperation?(storeId:string,operationId:string):Promise<OrdinaryCnyOperationResult>;
 getCategoryData?(input:CategoryDataInput):Promise<AdapterResponse>;
}
export interface CoreBroker {getStoreTask(storeId:string):Promise<any>;getListingTask(input:{storeId:string;collectedItemId:string;skuScope:string[];instruction?:string}):Promise<any>;requestId(kind:string,opId:string,seq:number):string}
export interface CorePresentation {
 renderView(spec:any):any;renderFromTemplate?(templateId:string,title:string,bindings:any[]):any;updateView(id:string,patch:any):any;
 openComponent?(componentId:string,options?:{revision?:number;directory?:string}):{spec:ViewSpec;sourceComponentId:string;baseRevision:number};
 openSourceComponent?(directory:string,options?:{title?:string;bindings?:any[];viewId?:string}):ViewSpec;
 restoreDraft?(spec:ViewSpec):ViewSpec;
 saveComponent(id:string,userRequest:string,title?:string,options?:{mode?:'save_as'|'update';componentId?:string;expectedRevision?:number}):any;saveEntry(binding:any,title:string,userRequest:string):any;
 saveTemplate(id:string,name:string,userRequest:string,description?:string):any;listSaved():any;
 manageSaved(kind:any,id:string,change:any):any;getView?(id:string):ViewSpec|undefined;getViewData?(id:string):ToolResult;
}
export interface CoreOptions {store:CoreStore;client:CoreClient;broker:CoreBroker;presentation:CorePresentation}
export interface Operation {
 operationId:string;kind:string;sessionId:string;clientKey?:string;storeId:string;targets:string[];input:RecordData;state:OperationState;
 hallmarkRefs:RecordData[];items:RecordData[];createdAt:string;updatedAt:string;result?:unknown;error?:unknown;ordinaryCny?:RecordData;diagnostics?:RecordData[];
}
export function wrapped(response:AdapterResponse):ToolResult {return {status:response.status,...(response.raw !== undefined?{data:response.raw}:{}),provenance:response.provenance,...(response.error?{error:response.error}:{}),...(response.spill?{data:{spill:response.spill}}:{})};}
export function active(store:CoreStore,context:InvocationContext):boolean {const row=store.get('session_apps',context.sessionId);return !!row?.active && (row.appId??row.app_id)==='hallmark';}
export function storeId(row:RecordData):string {return String(row.storeId??row.store_id??row.id??'');}
export function productStoreId(row:RecordData):string {return String(row.storeId??row.store_id??'');}
export function offerId(row:RecordData):string {return String(row.offerId??row.offer_id??'');}
export function productId(row:RecordData):string {return String(row.productId??row.product_id??row.id??'');}
export const METRIC_BASIS='Hallmark 参考利润模型（售价减采购成本、佣金和物流等估算），沿用源 profit.actualMargin/profitMinor/costMinor；非实际结算净利润率；actualMargin 为比例，缺成本无法判断。';
export function profitRows(products:RecordData[]):RecordData[] {return products.map(product=>{
 const profit=product.profit??{};const missing=profit.costMinor == null || !Number.isFinite(Number(profit.costMinor));
 const margin=!missing&&typeof profit.actualMargin==='number'&&Number.isFinite(profit.actualMargin)?profit.actualMargin:null;
 return {...product,referenceProfit:{margin,profitMinor:missing?null:profit.profitMinor??null,costMinor:missing?null:profit.costMinor,costMissing:missing,missing:missing?['costMinor']:[],metricBasis:METRIC_BASIS}};
});}
/** Missing source timestamps stay unknown; fetch/cache times are never substituted. */
export function sourceTime(...values:unknown[]):string|null {return values.find((value):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value)))??null;}
export function now():string {return new Date().toISOString();}
export function clean<T>(value:T):T {return JSON.parse(JSON.stringify(value));}
