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
export const APP_BOUNDARIES={
 listing:'仅完整 importItems 与已有采集 SKU 一对一匹配、素材可追溯、类目/属性/价格由用户明确提供时直连；资产可访问性以平台导入结果核实；原四工具准备链路未接入',
 storeTask:'仍无通用无商品店铺任务创建：优先复用现有任务；仅 broker 明确 TASK_CONTEXT_REQUIRED、用户明确普通 CNY 售价且无 actionId/oldPrice、原同店商品映射唯一及三个 Source 适配方法可用时，允许已有原操作令牌授权的普通 CNY Source 接口作为条件替代，不创建假任务；其他币种/活动/库存及通用平台读取仍不支持无任务替代',
 ordinaryCnyVerification:'Source GET/inspect 只核实既有普通 CNY 操作的历史 price-state，非实时价格或平台 /v5 回读；404 不是未发送证据，恢复不重新提交；stock 0 仅原接口结构占位，不是库存修改',
 profit:METRIC_BASIS,credentials:'仅由原 Hallmark 管理；不读取原凭据',localCapabilitiesAvailableOffline:true,
 notCovered:['活动价/活动报名管理','商品归档','采购成本修改','原四工具 WorkPlan/素材交付链路','命名规则定义解析及自动数值应用'],
 valueSource:'仅明确用户值可执行；rule: 分支缺可核实规则定义、版本及数值证据时必须澄清 ruleEvidence，不凭规则名称写入'
};
export function profitRows(products:RecordData[]):RecordData[] {return products.map(product=>{
 const profit=product.profit??{};const missing=profit.costMinor == null || !Number.isFinite(Number(profit.costMinor));
 const margin=!missing&&typeof profit.actualMargin==='number'&&Number.isFinite(profit.actualMargin)?profit.actualMargin:null;
 return {...product,referenceProfit:{margin,profitMinor:missing?null:profit.profitMinor??null,costMinor:missing?null:profit.costMinor,costMissing:missing,missing:missing?['costMinor']:[],metricBasis:METRIC_BASIS}};
});}
/** Missing source timestamps stay unknown; fetch/cache times are never substituted. */
export function sourceTime(...values:unknown[]):string|null {return values.find((value):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value)))??null;}
export function now():string {return new Date().toISOString();}
export function clean<T>(value:T):T {return JSON.parse(JSON.stringify(value));}
