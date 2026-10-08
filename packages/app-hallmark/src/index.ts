import { canonicalJson, validateResult } from '../../app-contracts/src/index.ts';
import type { AppProvider, AppManifest, AppRef, ResourceRef, CapabilityDescriptor, CapabilityResult, ExecutionContext, JsonSchema, JsonValue, DataProvenance, FailureInfo, OperationState } from '../../app-contracts/src/index.ts';
import { TOOL_DEFINITIONS } from '../../contracts/src/index.ts';
import type { ToolResult, InvocationContext } from '../../contracts/src/index.ts';
import type { CoreStore, CoreClient, CoreBroker, RecordData } from '../../core/src/types.ts';
import { HallmarkDomain } from './domain.ts';
import { validateLoopbackUrl } from '../../hallmark-adapter/client.ts';
export { HallmarkStorePort } from './store.ts';
export type { ProviderRecordStore } from './store.ts';
export type { HallmarkDomainOptions } from './domain.ts';
export function validateHallmarkConnection(config:JsonValue):void {
 if(!config||typeof config!=='object'||Array.isArray(config)||typeof config.baseUrl!=='string')throw new Error('EXPLICIT_HALLMARK_BACKEND_REQUIRED');
 validateLoopbackUrl(config.baseUrl);
}

export const HALLMARK_MANIFEST:AppManifest={manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'app-hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['store','product','collected-item','category','operation']};
const domainCapabilityIds:Record<string,string>={
 app_info:'hallmark.app.info',list_stores:'hallmark.stores.list',resolve_store:'hallmark.stores.resolve',list_store_products:'hallmark.products.list',get_platform_data:'hallmark.platform.read',search_collected_items:'hallmark.collected.search',get_collected_item:'hallmark.collected.get',get_category_data:'hallmark.categories.read',get_data_status:'hallmark.datasets.status',compute_profit:'hallmark.profit.compute',filter_products:'hallmark.products.filter',update_price:'hallmark.products.update_price',update_stock:'hallmark.products.update_stock',list_product:'hallmark.products.list_product',get_operation:'hallmark.operations.get',list_operations:'hallmark.operations.list',refresh_data:'hallmark.datasets.refresh',
};
const presentationNames=new Set(['render_view','update_view','open_component','open_source_component','save_component','save_entry','save_template','list_saved','manage_saved']);
const runtimeNames=new Set(['app_info','get_data_status','get_operation','list_operations','refresh_data']);
const presentationIds:Record<string,string>={render_view:'render_view',update_view:'update_view',open_component:'open_component',open_source_component:'open_source_component',save_component:'save_component',save_entry:'save_entry',save_template:'save_template',list_saved:'list_saved',manage_saved:'manage_saved'};
export const LEGACY_TOOL_MAP=Object.freeze(TOOL_DEFINITIONS.map(tool=>{const suffix=tool.name.replace(/^hallmark_/,'');return {legacyName:tool.name,capabilityId:domainCapabilityIds[suffix]??`apps.presentation.${presentationIds[suffix]}`,version:'1.0.0',owner:presentationNames.has(suffix)?'presentation':runtimeNames.has(suffix)?'runtime':'hallmark'};}));
export const HALLMARK_LEGACY_ALIASES=LEGACY_TOOL_MAP;
const text:JsonSchema={type:'string',minLength:1};
const rawObject:JsonSchema={type:'object',additionalProperties:true};
const count:JsonSchema={type:'integer',minimum:0};
const spill:JsonSchema={type:'object',properties:{path:text,bytes:count,summary:rawObject,cursor:{type:'string'}},required:['path','bytes','summary','cursor'],additionalProperties:true};
const storeRow:JsonSchema={type:'object',properties:{id:text,storeId:text,store_id:text},anyOf:[{required:['id']},{required:['storeId']},{required:['store_id']}],additionalProperties:true};
const operation:JsonSchema={type:'object',properties:{operationId:text,kind:text,storeId:{type:'string'},state:{enum:['pending','running','succeeded','failed','partial','unknown']},targets:{type:'array',items:text},input:rawObject,items:{type:'array',items:rawObject}},required:['operationId','kind','storeId','state','targets','input','items'],additionalProperties:true};
const products:JsonSchema={anyOf:[{type:'object',properties:{products:{type:'array',items:rawObject},total:count},required:['products','total'],additionalProperties:true},{type:'object',properties:{spill,storeId:text,total:count},required:['spill','storeId','total'],additionalProperties:true}]};
const outputSchemas:Record<string,JsonSchema>={
 app_info:{type:'object',properties:{appId:{const:'hallmark'},instructions:text,tools:{type:'array',items:{type:'object',properties:{name:text,kind:text},required:['name','kind'],additionalProperties:false}},boundaries:rawObject},required:['appId','instructions','tools','boundaries'],additionalProperties:true},
 list_stores:{type:'array',items:storeRow},resolve_store:storeRow,list_store_products:products,compute_profit:products,
 get_platform_data:{type:'object',properties:{response:{},httpStatus:{type:'integer'},outcome:{enum:['pending','response_received','outcome_unknown']},spill},anyOf:[{required:['response']},{required:['spill']}],additionalProperties:true},
 search_collected_items:{anyOf:[{type:'object',properties:{datasetKey:text,items:{type:'array',items:rawObject},total:count,cursor:{type:'string'}},required:['datasetKey','items','total'],additionalProperties:true},{type:'object',properties:{datasetKey:text,spill,total:count,cursor:{type:'string'},limit:count},required:['datasetKey','spill','total','cursor','limit'],additionalProperties:true}]},
 get_collected_item:{type:'object',properties:{id:text,content:{type:'string'},truncated:{type:'boolean'},spill},anyOf:[{required:['id','content','truncated']},{required:['spill']}],additionalProperties:true},
 get_category_data:{type:'object',properties:{datasetKey:text,query:{type:'object',properties:{tool:{const:'hallmark_get_category_data'},params:rawObject},required:['tool','params'],additionalProperties:false},raw:rawObject,spill},required:['datasetKey','query'],oneOf:[{required:['raw']},{required:['spill']}],additionalProperties:true},
 get_data_status:{type:'object',properties:{datasetKey:text,state:text,lastSuccessAt:{type:['string','null']},lastError:{}},required:['datasetKey','state','lastSuccessAt','lastError'],additionalProperties:true},
 filter_products:{type:'object',properties:{resultSetId:text,storeId:text,expiresAt:{type:'string',format:'date-time'},payload:{type:'object',properties:{products:{type:'array',items:rawObject},unable:{type:'array',items:rawObject},total:count,matchedCount:count,unableCount:count},required:['total'],anyOf:[{required:['products','unable']},{required:['matchedCount','unableCount']}],additionalProperties:true}},required:['resultSetId','storeId','expiresAt','payload'],additionalProperties:true},
 update_price:operation,update_stock:operation,list_product:operation,get_operation:operation,list_operations:{type:'array',items:operation},
 refresh_data:{type:'object',properties:{datasetKey:text,snapshot:rawObject,counts:{type:'object',additionalProperties:{type:'integer',minimum:0}}},required:['datasetKey','snapshot','counts'],additionalProperties:true},
};
function descriptor(suffix:string):CapabilityDescriptor{
 const tool=TOOL_DEFINITIONS.find(tool=>tool.name===`hallmark_${suffix}`)!;
 const mutation=tool.kind==='write';
 const inputSchema=structuredClone(tool.parameters) as unknown as JsonSchema;
 if(suffix==='list_store_products'){
  inputSchema.properties={...(inputSchema.properties as Record<string,JsonSchema>),fields:{type:'array',items:{type:'string',enum:['title','imageUrl','sku','status','platformStatus','currency','price','pricing','profit','stock','metrics','sources','declaredWeight','storeName']},description:'可选：只返回指定商品字段；身份字段始终保留。列表推荐 title/imageUrl/sku/status/currency/pricing/profit/stock；详情需要来源或规格时再请求 sources。省略保持完整响应。'}};
 }

 return {capabilityId:domainCapabilityIds[suffix],version:'1.0.0',title:tool.name,description:tool.description,effect:mutation?'mutation':tool.kind==='compute'?'compute':'query',inputSchema,outputSchema:outputSchemas[suffix],execution:{mode:mutation?'async':'sync',timeoutMs:mutation?120000:60000,concurrency:mutation||suffix==='refresh_data'?'exclusive':'declared_safe',lockScope:'connection',idempotency:mutation?'runtime_dedup':'not_applicable',completionEvidence:mutation?'readback':'response'},discovery:{defaultVisible:['app_info','list_stores','list_store_products'].includes(suffix),keywords:['hallmark',suffix]},aliases:[tool.name]};
}
interface ApiRoute { apiOperationId:string;capabilityId:string;description?:string;legacyName?:string;path?:string;method?:'GET'|'POST';sourceMethod?:'getStores'|'getStoreProducts'|'syncStoreProducts'|'getTargetMargin' }
/** Only interfaces already verified in HallmarkClient enter this catalogue; unknown URLs cannot dispatch. */
export const HALLMARK_API_OPERATIONS:readonly ApiRoute[]=[
 {apiOperationId:'hallmarkStoresList',capabilityId:'hallmark.api.stores.list',sourceMethod:'getStores'},
 {apiOperationId:'hallmarkStoreProductsRead',capabilityId:'hallmark.api.store_products.read',sourceMethod:'getStoreProducts'},
 {apiOperationId:'hallmarkStoreProductsSync',capabilityId:'hallmark.api.store_products.sync',sourceMethod:'syncStoreProducts'},
 {apiOperationId:'hallmarkTargetMarginRead',capabilityId:'hallmark.api.target_margin.read',sourceMethod:'getTargetMargin'},
 {apiOperationId:'hallmarkCollectedItemRawRead',capabilityId:'hallmark.api.collected_item.raw',legacyName:'hallmark_get_collected_item'},
 {apiOperationId:'hallmarkCategoryRead',capabilityId:'hallmark.api.category.read',legacyName:'hallmark_get_category_data'},
 {apiOperationId:'ozonProductsInfoRead',capabilityId:'hallmark.api.products.info',path:'/v3/product/info/list',method:'POST'},
 {apiOperationId:'ozonProductsPricesRead',capabilityId:'hallmark.api.products.prices',path:'/v5/product/info/prices',method:'POST'},
 {apiOperationId:'ozonProductsAttributesRead',capabilityId:'hallmark.api.products.attributes',path:'/v4/product/info/attributes',method:'POST'},
 {apiOperationId:'ozonActionsList',capabilityId:'hallmark.api.actions.list',path:'/v1/actions',method:'GET'},
 {apiOperationId:'ozonActionProductsList',capabilityId:'hallmark.api.actions.products',path:'/v2/actions/products',method:'POST'},
 {apiOperationId:'ozonActionCandidatesList',capabilityId:'hallmark.api.actions.candidates',path:'/v2/actions/candidates',method:'POST'},
 {apiOperationId:'ozonProductStocksRead',capabilityId:'hallmark.api.products.stocks',path:'/v2/product/info/stocks-by-warehouse/fbs',method:'POST'},
 {apiOperationId:'ozonProductImportInspect',capabilityId:'hallmark.api.products.import_inspect',path:'/v1/product/import/info',method:'POST'},
 {apiOperationId:'ozonWarehousesList',capabilityId:'hallmark.api.warehouses.list',path:'/v2/warehouse/list',method:'POST'},
 {apiOperationId:'hallmarkPriceUpdate',capabilityId:'hallmark.api.products.update_price',legacyName:'hallmark_update_price',description:'已登记的 Hallmark 普通调价适配操作，委托既有 WriteOperations 的输入核实、操作账本和只读 inspect；不是固定 URL 的直接调用。有已核实店铺任务时使用 task platform 调价并按同一商品、币种和金额回读；仅 TASK_CONTEXT_REQUIRED、CNY、无 actionId/oldPrice 且适配器具备普通 CNY 提交/读取/核实接口时，沿既有严格两位小数 CNY fallback。该 fallback 核实历史 price-state，不宣称实时平台回读。结果保留原请求编号、原始响应和 readback；unknown 仅查询原操作，不重发。'},
];
const sourceProductsSchema:JsonSchema={type:'object',properties:{products:{type:'array',items:rawObject},stores:{type:'array',items:rawObject},spill},anyOf:[{required:['products','stores']},{required:['spill']}],additionalProperties:true};
function apiDescriptor(route:ApiRoute):CapabilityDescriptor{
 const inherited=descriptor((route.legacyName??'hallmark_get_platform_data').replace(/^hallmark_/,''));
 const inputSchema=route.sourceMethod?{type:'object',properties:{},additionalProperties:false}:route.path?{type:'object',properties:{storeId:text,store:text,body:rawObject},additionalProperties:false}:inherited.inputSchema;
 const outputSchema=route.sourceMethod==='getStores'?outputSchemas.list_stores:route.sourceMethod==='getStoreProducts'?sourceProductsSchema:route.sourceMethod==='syncStoreProducts'||route.sourceMethod==='getTargetMargin'?rawObject:inherited.outputSchema;
 return {...inherited,capabilityId:route.capabilityId,title:route.apiOperationId,description:route.description??`已登记接口 ${route.apiOperationId}；使用 Hallmark 原实现并保留请求/响应证据`,inputSchema:inputSchema as JsonSchema,outputSchema,aliases:[],apiOperationId:route.apiOperationId,discovery:{defaultVisible:false,keywords:['hallmark','api',route.apiOperationId]}};
}
export const HALLMARK_DESCRIPTORS:readonly CapabilityDescriptor[]=[...Object.keys(domainCapabilityIds).map(descriptor),...HALLMARK_API_OPERATIONS.map(apiDescriptor)];
export interface HallmarkProviderOptions {
 store:CoreStore|((connectionId:string,configRevision?:number)=>CoreStore);
 client:CoreClient|((connectionId:string,configRevision?:number)=>CoreClient);
 broker:CoreBroker|((connectionId:string,configRevision?:number)=>CoreBroker);
}
const isObject=(value:unknown):value is RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const state=(legacy:string):OperationState=>legacy==='running'?'dispatching':legacy==='pending'?'pending':['unknown','succeeded','failed','partial','cancelled'].includes(legacy)?legacy as OperationState:'unknown';

export class HallmarkProvider implements AppProvider {
 readonly manifest=HALLMARK_MANIFEST;
 readonly descriptors=HALLMARK_DESCRIPTORS;
 readonly options:HallmarkProviderOptions;
 private domains=new Map<string,HallmarkDomain>();
 constructor(options:HallmarkProviderOptions){this.options=options;}
 private domain(connectionId:string,configRevision=1):HallmarkDomain{const key=canonicalJson([connectionId,configRevision]);let domain=this.domains.get(key);if(!domain){const resolve=<T>(value:T|((id:string,revision?:number)=>T)):T=>typeof value==='function'?(value as (id:string,revision?:number)=>T)(connectionId,configRevision):value;domain=new HallmarkDomain({store:resolve(this.options.store),client:resolve(this.options.client),broker:resolve(this.options.broker)});this.domains.set(key,domain);}return domain;}
 /** Runtime calls this only after the connection has drained; evidence stays in its original generation. */
 invalidateConnection(connectionId:string):void {for(const id of this.domains.keys())if((JSON.parse(id) as [string,number])[0]===connectionId)this.domains.delete(id);}
 private failure(context:ExecutionContext,code:string,message:string):CapabilityResult{return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'failed',error:{code,message,retryPolicy:'never'}};}
 async execute(context:ExecutionContext):Promise<CapabilityResult>{
  const {request}=context,descriptor=this.descriptors.find(row=>row.capabilityId===request.capabilityId&&row.version===request.capabilityVersion);
  if(request.appId!=='hallmark'||!descriptor)return this.failure(context,'CAPABILITY_NOT_FOUND','Hallmark 能力或精确版本未登记。');
  if(!isObject(request.input))return this.failure(context,'INPUT_SCHEMA_INVALID','Hallmark 输入须为对象。');
  if(descriptor.effect==='mutation'&&!context.operationId)return this.failure(context,'OPERATION_ID_REQUIRED','变更必须先由 Runtime 持久化操作身份。');
  const domain=this.domain(request.connectionId,context.configRevision),args:RecordData={...request.input};
  const fields=request.capabilityId==='hallmark.products.list'&&Array.isArray(args.fields)?args.fields as string[]:undefined;
  if(fields)delete args.fields;
  const source=request.source,sessionId='sessionId' in source?source.sessionId:`runtime:${request.connectionId}`;
  const legacyContext:InvocationContext={sessionId,signal:context.signal,...(context.operationId?{operationId:context.operationId}:{}),...(typeof args.userRequest==='string'?{userRequest:args.userRequest}:{})};
  if(descriptor.effect==='mutation')args.clientOperationKey=canonicalJson([request.appId,request.connectionId,request.capabilityId,request.idempotencyKey]);
  const route=HALLMARK_API_OPERATIONS.find(row=>row.capabilityId===request.capabilityId);
  let result:ToolResult;
  if(route?.sourceMethod){const response=await domain.options.client[route.sourceMethod]();result={status:response.status,...(response.raw!==undefined?{data:response.raw}:{}),...(response.spill?{data:{spill:response.spill}}:{}),provenance:response.provenance,error:response.error};}
  else{const legacyName=route?.legacyName??(route?.path?'hallmark_get_platform_data':descriptor.aliases[0]);if(route?.path){args.path=route.path;args.method=route.method;}result=await domain.invoke(legacyName,args,legacyContext);}
  // Keep only the original legacy envelope fields for the explicitly marked compatibility call.
  // This is invocation evidence in the same Provider store, not a second business implementation.
  if(source.kind==='agent'&&source.nativeCallId.startsWith('legacy:'))domain.options.store.put('legacy_result_metadata',request.invocationId,{sessionId,invocationId:request.invocationId,capabilityId:request.capabilityId,...(result.provenance?{provenance:result.provenance}:{}),...(result.metricBasis?{metricBasis:result.metricBasis}:{}),...(result.error?{error:result.error}:{})});
  if(fields&&isObject(result.data)&&Array.isArray(result.data.products)){
   const keys=new Set(['id','storeId','store_id','offerId','offer_id','productId','product_id',...fields]);
   result={...result,data:{...(args.storeId!==undefined?{storeId:args.storeId}:{}),products:result.data.products.map((row:RecordData)=>Object.fromEntries(Object.entries(row).filter(([key])=>keys.has(key)))),total:result.data.total,...(result.data.cursor!==undefined?{cursor:result.data.cursor}:{})}};
  }
  return this.convert(result,context,descriptor);
 }
 private convert(legacy:ToolResult,context:ExecutionContext,descriptor?:CapabilityDescriptor):CapabilityResult{
  const request=context.request,base={invocationId:request.invocationId,traceId:request.traceId};
  let operationRef=legacy.operation?{operationId:legacy.operation.operationId,state:state(legacy.operation.state)}:context.operationId?{operationId:context.operationId,state:'unknown' as const}:undefined;
  const error=(fallback:string,retryPolicy:FailureInfo['retryPolicy']):FailureInfo=>({code:legacy.error?.code==='IDEMPOTENCY_KEY_CONFLICT'?'IDEMPOTENCY_CONFLICT':legacy.error?.code??fallback,message:legacy.error?.message??'Hallmark 未取得业务结果证据。',retryPolicy,...(legacy.error?.retryAfterMs!==undefined?{retryAfterMs:legacy.error.retryAfterMs}:{})});
  let provenance:DataProvenance[]|undefined;
  if(legacy.provenance||legacy.metricBasis){const old=legacy.provenance,input:RecordData=isObject(request.input)?request.input:{},snapshot=input.storeId?this.domain(request.connectionId,context.configRevision).options.store.get('snapshots',`store_products:${input.storeId}`):undefined;provenance=[{appId:'hallmark',connectionId:request.connectionId,sourceKind:old?.source==='hallmark_compute'?'derived':old?.source==='app_snapshot'||old?.source==='hallmark_snapshot'?'snapshot':'application',sourceRef:old?.endpoint??descriptor?.capabilityId??request.capabilityId,fetchedAt:old?.fetchedAt??snapshot?.lastSuccessAt??new Date().toISOString(),sourceDataTime:old?.dataTime??null,freshness:snapshot?.state==='failed'?'stale':'unknown',...(legacy.metricBasis?{metricBasis:legacy.metricBasis}:{})}];}
  const common={...base,...(provenance?{provenance}:{}),...(operationRef?{operation:operationRef}:{})};
  let result:CapabilityResult;
  if(legacy.status==='ok')result={...common,status:'ok',data:legacy.data as JsonValue};
  else if(legacy.status==='partial')result={...common,status:'partial',data:legacy.data as JsonValue,errors:[error('PARTIAL_RESULT','never')]};
  else if(legacy.status==='needs_clarification')result={...common,status:'needs_clarification',missing:legacy.clarification?.missing??['input'],candidates:(legacy.clarification?.candidates??[]) as JsonValue[],question:legacy.clarification?.question??'请补充业务输入。'};
  else if(legacy.status==='pending'&&operationRef)result={...common,status:'pending',operation:operationRef,pollAfterMs:1000};
  else if(legacy.status==='unknown'&&operationRef)result={...common,status:'unknown',operation:operationRef,error:error('OUTCOME_UNKNOWN','inspect_only')};
  else if(legacy.status==='unknown'||legacy.status==='unavailable')result={...common,status:'unavailable',error:error('HALLMARK_UNAVAILABLE','read_retry')};
  else if(legacy.error?.code==='ABORTED'&&!context.operationId)result={...common,status:'cancelled',error:error('ABORTED','never')};
  else result={...common,status:'failed',error:error('HALLMARK_ERROR','never')};
  const errors=validateResult(result,descriptor?.outputSchema);
  if(errors.length){const failed=this.failure(context,'OUTPUT_SCHEMA_INVALID',errors.join('; '));return {...failed,...(operationRef?{operation:operationRef}:{})};}
  return result;
 }
 async inspect(operationId:string,context:ExecutionContext):Promise<CapabilityResult>{
  const domain=this.domain(context.request.connectionId,context.configRevision),legacy=await domain.writes.get(operationId);
  return this.convert(legacy,context,{...descriptor('get_operation'),capabilityId:context.request.capabilityId});
 }
 async dispose():Promise<void>{await Promise.all([...this.domains.values()].map(domain=>domain.dispose()));}
}

/** Exact source IDs only. Product identity retains store scope because offer IDs can repeat across stores. */
export function resolveHallmarkResources(binding:AppRef & {input?:JsonValue},result:CapabilityResult):ResourceRef[]{
 if(binding.appId!=='hallmark'||!('data' in result)||!isObject(result.data))return [];
 const data:RecordData=result.data,input:RecordData=isObject(binding.input)?binding.input:{},payload=isObject(data.payload)?data.payload:data;
 const products:RecordData[]=Array.isArray(payload.products)?payload.products:[];
 if(products.length)return products.flatMap(row=>{const store=row.storeId??row.store_id??input.storeId,id=row.productId??row.product_id,offer=row.offerId??row.offer_id;if((typeof store!=='string'||!store)||id===undefined&&offer===undefined)return [];const kind=id!==undefined?'productId':'offerId',sourceId=id??offer;if(typeof sourceId!=='string'&&typeof sourceId!=='number'||String(sourceId)==='')return [];return [{appId:'hallmark',connectionId:binding.connectionId,resourceType:'product',resourceId:canonicalJson([store,kind,String(sourceId)]),...(typeof row.revision==='string'?{revision:row.revision}:{})}];});
 const rows:RecordData[]=Array.isArray(data.items)?data.items:typeof data.id==='string'&&typeof data.content==='string'?[data]:[];
 return rows.flatMap(row=>typeof row.id==='string'&&row.id?[{appId:'hallmark',connectionId:binding.connectionId,resourceType:'collected-item',resourceId:row.id,...(typeof row.revision==='string'?{revision:row.revision}:{})}]:[]);
}
export const hallmarkResources=resolveHallmarkResources;
