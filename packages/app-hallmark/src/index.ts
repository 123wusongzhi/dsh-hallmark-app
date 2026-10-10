import { canonicalJson, validateResult } from '../../app-contracts/src/index.ts';
import type { AppProvider, AppManifest, AppRef, ResourceRef, CapabilityDescriptor, CapabilityResult, ExecutionContext, InvocationRequest, JsonSchema, JsonValue, DataProvenance, FailureInfo, OperationState } from '../../app-contracts/src/index.ts';
import { TOOL_DEFINITIONS } from '../../contracts/src/index.ts';
import type { ToolResult, InvocationContext } from '../../contracts/src/index.ts';
import type { CoreStore, CoreClient, CoreBroker, RecordData } from '../../core/src/types.ts';
import { HallmarkDomain } from './domain.ts';
import {OZON_DESCRIPTORS,OZON_KINDS,readOzonData} from './ozon-data.ts';
import type {OzonKind} from './ozon-data.ts';
import {OZON_COMPOSE_DESCRIPTOR,readOzonComposition} from './ozon-compose.ts';
import {PROCUREMENT_DESCRIPTOR,readProcurement} from './procurement.ts';
import type {SemanticReviewer} from '../../app-contracts/src/business-review.ts';
import {BusinessOperations} from './operations/index.ts';
import {HallmarkBusinessAdapter} from './operations-adapter.ts';
import {businessConnectedClient,connectionBusinessGateway,compatibilityReadResponse,recordBusinessProductObservations} from './operations-client.ts';
import type {OzonBusinessGateway} from '../../ozon-business/src/index.ts';
import type {BusinessPricingRepository} from '../../business-pricing/src/index.ts';
import {DYNAMIC_PROFIT_BASIS} from './dynamic-profit.ts';
import {CollectionService} from '../../collection/src/index.ts';
import {BusinessPackagingRepository} from '../../business-packaging/src/index.ts';
import {COLLECTION_DESCRIPTORS,LISTING_PREPARE_DESCRIPTOR} from './collection-provider.ts';
import {prepareListing,collectionListingStates} from './listing-prepare.ts';
import {applyExistingPackaging} from './packaging-evidence.ts';
import {LISTING_ASSET_DESCRIPTOR,type ListingAssetPublisher} from './listing-assets.ts';
import {BUSINESS_PRICING_DESCRIPTORS,BUSINESS_DESCRIPTORS,businessOperation,legacyBusinessKind,executeBusiness,executeLegacyBusiness,businessResult,publicPlan} from './operations-provider.ts';
export {hallmarkOzonSources} from './ozon-data.ts';
export {createOzonCompositionDraft,OZON_COMPOSITION_FIELDS,OZON_COMPOSITION_SOURCES,DEFAULT_PRODUCT_FIELDS} from './ozon-composition.ts';
import { validateLoopbackUrl } from '../../hallmark-adapter/client.ts';
export { HallmarkStorePort, StableHallmarkBusinessStore } from './store.ts';
export type { ProviderRecordStore } from './store.ts';
export type { HallmarkDomainOptions } from './domain.ts';
export function validateHallmarkConnection(config:JsonValue):void {
 if(!config||typeof config!=='object'||Array.isArray(config)||typeof config.baseUrl!=='string')throw new Error('EXPLICIT_HALLMARK_BACKEND_REQUIRED');
 validateLoopbackUrl(config.baseUrl);
 if(config.ozonDataBaseUrl!==undefined){if(typeof config.ozonDataBaseUrl!=='string')throw new Error('INVALID_OZON_DATA_BASE_URL');validateLoopbackUrl(config.ozonDataBaseUrl);}
 if(config.collectionSourceId!==undefined&&(typeof config.collectionSourceId!=='string'||!config.collectionSourceId.trim()))throw new Error('INVALID_COLLECTION_SOURCE_ID');
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
 update_price:operation,update_stock:operation,list_product:operation,get_operation:{anyOf:[operation,{type:'object',properties:{planId:text,storeId:text,status:text,revision:count,rows:{type:'array',items:rawObject}},required:['planId','storeId','status','revision','rows'],additionalProperties:true}]},list_operations:{type:'array',items:operation},
 refresh_data:{type:'object',properties:{datasetKey:text,snapshot:rawObject,counts:{type:'object',additionalProperties:{type:'integer',minimum:0}}},required:['datasetKey','snapshot','counts'],additionalProperties:true},
};
function descriptor(suffix:string):CapabilityDescriptor{
 const tool=TOOL_DEFINITIONS.find(tool=>tool.name===`hallmark_${suffix}`)!;
 const mutation=tool.kind==='write';
 const inputSchema=structuredClone(tool.parameters) as unknown as JsonSchema;
 if(mutation&&['update_price','update_stock','list_product'].includes(suffix))inputSchema.required=(inputSchema.required as string[]??[]).filter(key=>!['userRequest','valueSource','scopeConfirmed','clientOperationKey'].includes(key));
 if(suffix==='list_store_products'){
  inputSchema.properties={...(inputSchema.properties as Record<string,JsonSchema>),fields:{type:'array',items:{type:'string',enum:['title','imageUrl','sku','status','platformStatus','currency','price','pricing','profit','stock','metrics','sources','declaredWeight','storeName']},description:'可选：只返回指定商品字段；身份字段始终保留。列表推荐 title/imageUrl/sku/status/currency/pricing/profit/stock；详情需要来源或规格时再请求 sources。省略保持完整响应。'}};
 }

 return {capabilityId:domainCapabilityIds[suffix],version:'1.0.0',title:tool.name,description:mutation?`${tool.description} 现由统一经营变更审核执行；不要求检查声明或用户值证明。`:tool.description,effect:mutation?'mutation':tool.kind==='compute'?'compute':'query',inputSchema,outputSchema:mutation?rawObject:outputSchemas[suffix],execution:{mode:mutation?'async':'sync',timeoutMs:mutation?300000:60000,concurrency:mutation?'exclusive':'declared_safe',lockScope:'connection',idempotency:mutation?'upstream_supported':'not_applicable',completionEvidence:mutation?'readback':'response'},discovery:{defaultVisible:['app_info','list_stores','list_store_products'].includes(suffix),keywords:['hallmark',suffix]},aliases:[tool.name]};
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
 {apiOperationId:'hallmarkPriceUpdate',capabilityId:'hallmark.api.products.update_price',legacyName:'hallmark_update_price',description:'普通调价通过统一经营变更引擎，程序精确读取商品身份及当前价格、审核确定规则、记录逐行结果。无需审阅声明或手填幂等键；返回经营变更单。写入直接使用经营应用保存的店铺连接，不依赖旧平台任务；持久化原请求后只发送一次，保留凭据版本供只读核查。actionId 不会转换为普通调价，应使用 promotion.update 并明确活动配额。pending/unknown 只 inspect 原操作，不重新提交。'},
];
const sourceProductsSchema:JsonSchema={type:'object',properties:{products:{type:'array',items:rawObject},stores:{type:'array',items:rawObject},spill},anyOf:[{required:['products','stores']},{required:['spill']}],additionalProperties:true};
function apiDescriptor(route:ApiRoute):CapabilityDescriptor{
 const inherited=descriptor((route.legacyName??'hallmark_get_platform_data').replace(/^hallmark_/,''));
 const inputSchema=route.sourceMethod?{type:'object',properties:{},additionalProperties:false}:route.path?{type:'object',properties:{storeId:text,store:text,body:rawObject},additionalProperties:false}:inherited.inputSchema;
 const outputSchema=route.sourceMethod==='getStores'?outputSchemas.list_stores:route.sourceMethod==='getStoreProducts'?sourceProductsSchema:route.sourceMethod==='syncStoreProducts'||route.sourceMethod==='getTargetMargin'?rawObject:inherited.outputSchema;
 return {...inherited,capabilityId:route.capabilityId,title:route.apiOperationId,description:route.description??`已登记接口 ${route.apiOperationId}；使用 Hallmark 原实现并保留请求/响应证据`,inputSchema:inputSchema as JsonSchema,outputSchema,aliases:[],apiOperationId:route.apiOperationId,discovery:{defaultVisible:false,keywords:['hallmark','api',route.apiOperationId]}};
}
const skuDescriptors:CapabilityDescriptor[]=['products','collected'].map(kind=>({...descriptor('get_collected_item'),capabilityId:`hallmark.${kind}.skus`,title:kind==='products'?'商品 SKU 明细':'采集商品 SKU 明细',description:kind==='products'?'按店铺及商品编号精确读取当前商品对应SKU的已有规格、售价与币种，不推测其他规格。':'读取已有采集商品的结构化SKU规格、价格与币种，不进行选品评估或业务写入。',aliases:[],inputSchema:{type:'object',properties:kind==='products'?{storeId:text,productId:text}:{itemId:text},required:kind==='products'?['storeId','productId']:['itemId'],additionalProperties:false} as JsonSchema,outputSchema:{type:'object',properties:{items:{type:'array',items:rawObject},total:count},required:['items','total'],additionalProperties:false},discovery:{defaultVisible:false,keywords:['sku','规格','素材库']}}));
export const HALLMARK_DESCRIPTORS:readonly CapabilityDescriptor[]=[...Object.keys(domainCapabilityIds).map(descriptor),...HALLMARK_API_OPERATIONS.map(apiDescriptor),...skuDescriptors,...OZON_DESCRIPTORS,OZON_COMPOSE_DESCRIPTOR,PROCUREMENT_DESCRIPTOR,...BUSINESS_DESCRIPTORS,...BUSINESS_PRICING_DESCRIPTORS,...COLLECTION_DESCRIPTORS,LISTING_PREPARE_DESCRIPTOR,LISTING_ASSET_DESCRIPTOR];
export interface HallmarkProviderOptions {
 store:CoreStore|((connectionId:string,configRevision?:number)=>CoreStore);
 client:CoreClient|((connectionId:string,configRevision?:number)=>CoreClient);
 broker:CoreBroker|((connectionId:string,configRevision?:number)=>CoreBroker);
 businessStore?:CoreStore|((connectionId:string,configRevision?:number)=>CoreStore);
 businessGateway?:OzonBusinessGateway|((connectionId:string,configRevision?:number)=>OzonBusinessGateway|undefined);
 pricing?:Pick<BusinessPricingRepository,'read'|'quote'>|((connectionId:string,configRevision?:number)=>Pick<BusinessPricingRepository,'read'|'quote'>|undefined);
 collectionSourceMatches?:boolean|((connectionId:string,configRevision?:number)=>boolean);
 collection?:CollectionService|((connectionId:string,configRevision?:number)=>CollectionService);
 packaging?:BusinessPackagingRepository|((connectionId:string,configRevision?:number)=>BusinessPackagingRepository);
 assetPublisher?:ListingAssetPublisher|((connectionId:string,configRevision?:number)=>ListingAssetPublisher);
 reviewer?:SemanticReviewer;
 /** Runtime-owned inspection updates the public operation ledger without re-sending business writes. */
 inspectOperation?:(operationId:string,signal?:AbortSignal)=>Promise<CapabilityResult>;
}
const isObject=(value:unknown):value is RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const state=(legacy:string):OperationState=>legacy==='running'?'dispatching':legacy==='pending'?'pending':['unknown','succeeded','failed','partial','cancelled'].includes(legacy)?legacy as OperationState:'unknown';

export class HallmarkProvider implements AppProvider {
 readonly manifest=HALLMARK_MANIFEST;
 readonly descriptors=HALLMARK_DESCRIPTORS;
 readonly options:HallmarkProviderOptions;
 private domains=new Map<string,HallmarkDomain>();
 private businesses=new Map<string,BusinessOperations>();
 private collections=new Map<string,CollectionService>();
 private packages=new Map<string,BusinessPackagingRepository>();
 constructor(options:HallmarkProviderOptions){this.options=options;}
 private resolve<T>(value:T|((id:string,revision?:number)=>T),connectionId:string,revision=1):T{return typeof value==='function'?(value as (id:string,revision?:number)=>T)(connectionId,revision):value;}
 private businessStore(connectionId:string,revision=1):CoreStore{return this.resolve(this.options.businessStore??this.options.store,connectionId,revision);}
 private domain(connectionId:string,configRevision=1):HallmarkDomain{const key=canonicalJson([connectionId,configRevision]);let domain=this.domains.get(key);if(!domain){const gateway=this.resolve(this.options.businessGateway,connectionId,configRevision),source=this.resolve(this.options.client,connectionId,configRevision),client=gateway?businessConnectedClient(source,gateway,this.businessStore(connectionId,configRevision),connectionId,this.resolve(this.options.collectionSourceMatches,connectionId,configRevision),this.resolve(this.options.pricing,connectionId,configRevision)):source;domain=new HallmarkDomain({store:this.resolve(this.options.store,connectionId,configRevision),client,broker:this.resolve(this.options.broker,connectionId,configRevision),pricing:this.resolve(this.options.pricing,connectionId,configRevision)});this.domains.set(key,domain);}return domain;}
 private collection(connectionId:string,revision=1):CollectionService {if(this.options.collection)return this.resolve(this.options.collection,connectionId,revision);const key=canonicalJson([connectionId,revision]);let service=this.collections.get(key);if(!service){service=new CollectionService({client:this.resolve(this.options.client,connectionId,revision),store:this.resolve(this.options.store,connectionId,revision),sourceId:connectionId,listingStates:async(ids,summaries)=>this.collectionStates(connectionId,revision,ids,summaries)});this.collections.set(key,service);}return service;}
 private collectionStates(connectionId:string,revision:number=1,ids:string[],summaries?:Array<{id:string;skuCount:number}>){
  if(this.resolve(this.options.collectionSourceMatches,connectionId,revision)===false)return {};
  const gateway=this.resolve(this.options.businessGateway,connectionId,revision),stores=gateway?connectionBusinessGateway(gateway,connectionId).listStores():[];
  const states=collectionListingStates(this.businessStore(connectionId,revision),stores.map(s=>s.id),ids,summaries);
  for(const values of Object.values(states))for(const value of values)value.storeName=stores.find(s=>s.id===value.storeId)?.name;
  return states;
 }
 private async refreshCollectionStates(connectionId:string,revision:number=1,storeId?:string,refresh=false){
  if(this.resolve(this.options.collectionSourceMatches,connectionId,revision)===false)return;
  const gateway=this.resolve(this.options.businessGateway,connectionId,revision),client=this.domain(connectionId,revision).options.client as CoreClient&{ensureBusinessCatalog?:(id:string)=>Promise<void>;syncBusinessProductStates?:(id:string,options:{refresh:boolean})=>Promise<unknown>};
  if(gateway&&client.syncBusinessProductStates)await Promise.all(connectionBusinessGateway(gateway,connectionId).listStores().filter(s=>!storeId||s.id===storeId).map(async s=>{try{await client.ensureBusinessCatalog?.(s.id);}catch{const store=this.businessStore(connectionId,revision),prior=store.get<RecordData>('business_catalog_status_sync',s.id),now=new Date().toISOString();store.put('business_catalog_status_sync',s.id,{...prior,storeId:s.id,state:'failed',attemptedAt:now,expiresAt:now,error:{code:'LISTING_HISTORY_READ_FAILED',message:'历史上品记录读取未完成。'}});return;}return client.syncBusinessProductStates!(s.id,{refresh});}));
 }
 private packaging(connectionId:string,revision=1):BusinessPackagingRepository {if(this.options.packaging)return this.resolve(this.options.packaging,connectionId,revision);const key=canonicalJson([connectionId,revision]);let service=this.packages.get(key);if(!service){service=new BusinessPackagingRepository(this.businessStore(connectionId,revision));this.packages.set(key,service);}return service;}
 private adapter(connectionId:string,revision=1):HallmarkBusinessAdapter {const gateway=this.resolve(this.options.businessGateway,connectionId,revision);return new HallmarkBusinessAdapter({...this.domain(connectionId,revision).options,store:this.businessStore(connectionId,revision),gateway:gateway?connectionBusinessGateway(gateway,connectionId):undefined,pricing:this.resolve(this.options.pricing,connectionId,revision),collectionSourceMatches:this.resolve(this.options.collectionSourceMatches,connectionId,revision),collection:this.options.collection?this.collection(connectionId,revision):undefined,packaging:this.options.packaging?this.packaging(connectionId,revision):undefined});}
 /** Runtime calls this only after the connection has drained; evidence stays in its original generation. */
 invalidateConnection(connectionId:string):void {for(const cache of [this.domains,this.businesses,this.collections,this.packages])for(const id of cache.keys())if((JSON.parse(id) as [string,number])[0]===connectionId)cache.delete(id);}
 private business(connectionId:string,revision=1):BusinessOperations {
  const key=canonicalJson([connectionId,revision]);let business=this.businesses.get(key);if(business)return business;
  const adapter=this.adapter(connectionId,revision);
  const reviewer=this.options.reviewer??{review:async(input:any)=>({status:'pending' as const,questions:input.questions.map((q:any)=>({id:q.id,version:q.version,status:'pending' as const,reviewer:'none' as const,reasonCode:'REVIEWER_NOT_CONFIGURED'})),evidence:{versions:input.versions,thresholds:{pass:0.95,reject:0.2},requests:[]}})};
  business=new BusinessOperations({store:this.businessStore(connectionId,revision),source:adapter,transport:adapter,reviewer});this.businesses.set(key,business);return business;
 }
 mutationScope(request:Readonly<InvocationRequest>,revision=1):readonly string[]|undefined {
  if(!['submit','restore'].includes(businessOperation(request.capabilityId)??'')||!isObject(request.input))return undefined;
  const plan=this.business(request.connectionId,revision).get((request.input as RecordData).planId);
  return plan.rows.map(row=>canonicalJson([plan.storeId,row.target.offerId]));
 }
 private failure(context:ExecutionContext,code:string,message:string):CapabilityResult{return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'failed',error:{code,message,retryPolicy:'never'}};}
 async execute(context:ExecutionContext):Promise<CapabilityResult>{
  const {request}=context,descriptor=this.descriptors.find(row=>row.capabilityId===request.capabilityId&&row.version===request.capabilityVersion);
  if(request.appId!=='hallmark'||!descriptor)return this.failure(context,'CAPABILITY_NOT_FOUND','Hallmark 能力或精确版本未登记。');
  if(!isObject(request.input))return this.failure(context,'INPUT_SCHEMA_INVALID','Hallmark 输入须为对象。');
  if(descriptor.effect==='mutation'&&!context.operationId)return this.failure(context,'OPERATION_ID_REQUIRED','变更必须先由 Runtime 持久化操作身份。');
  const domain=this.domain(request.connectionId,context.configRevision),args:RecordData={...request.input};
  if(request.capabilityId==='hallmark.listing.assets.publish'){
   const publisher=this.resolve(this.options.assetPublisher,request.connectionId,context.configRevision);if(!publisher)return this.failure(context,'ASSET_PUBLISHER_UNAVAILABLE','未配置图片交付服务');
   try{const data=await publisher.publish(args as any,context.signal);const result=this.convert({status:data.status==='failed'?'failed':data.status==='partial'?'partial':'ok',data,...(data.failureCount?{error:{code:'ASSET_PUBLISH_INCOMPLETE',message:'部分图片未交付，具体原因见逐文件结果；已成功图片无需重发。',retryable:true}}:{})},context,descriptor);if(result.status==='failed')result.error.details=data;return result;}catch(error){return this.failure(context,'ASSET_PUBLISH_FAILED',error instanceof Error?error.message:'图片交付未完成');}
  }
  if(request.capabilityId.startsWith('hallmark.collection.')||request.capabilityId==='hallmark.listing.prepare'){
   if(request.capabilityId==='hallmark.collection.search'||request.capabilityId==='hallmark.listing.prepare'&&!args.cursor)await this.refreshCollectionStates(request.connectionId,context.configRevision,args.storeId??args.store?.id,args.refresh===true);
   try{const collection=this.collection(request.connectionId,context.configRevision),gateway=this.resolve(this.options.businessGateway,request.connectionId,context.configRevision),scoped=gateway?connectionBusinessGateway(gateway,request.connectionId):undefined,data=request.capabilityId==='hallmark.collection.search'?await collection.search(args):request.capabilityId==='hallmark.collection.read'?await collection.read(args):request.capabilityId==='hallmark.collection.resource.read'?await collection.resourceRead(args as any):await prepareListing(args as any,{collection,packaging:this.packaging(request.connectionId,context.configRevision),pricing:this.resolve(this.options.pricing,request.connectionId,context.configRevision),client:domain.options.client,store:this.businessStore(request.connectionId,context.configRevision),listingStates:ids=>this.collectionStates(request.connectionId,context.configRevision,ids),prepareProducts:async products=>scoped&&this.resolve(this.options.collectionSourceMatches,request.connectionId,context.configRevision)!==false?applyExistingPackaging(products,this.businessStore(request.connectionId,context.configRevision),({storeId,path,body})=>scoped.request(storeId,{path,body},context.signal),{storeIds:scoped.listStores().map(s=>s.id)}):products});return this.convert({status:'ok',data},context,descriptor);}catch(error){return this.failure(context,typeof (error as any)?.code==='string'?(error as any).code:'COLLECTION_PREPARATION_FAILED',error instanceof Error?error.message:'资料读取未完成');}
  }
  if(request.capabilityId==='hallmark.pricing.read')return {invocationId:request.invocationId,traceId:request.traceId,status:'ok',data:{config:this.resolve(this.options.pricing,request.connectionId,context.configRevision)?.read(args.storeId)??null} as unknown as JsonValue};
  if(request.capabilityId==='hallmark.pricing.quote'){
   try{const quote=await this.adapter(request.connectionId,context.configRevision).load({storeId:args.storeId,row:args.row,fresh:false,signal:context.signal});return {invocationId:request.invocationId,traceId:request.traceId,status:'ok',data:{quote:quote.pricingQuote??null,issues:quote.issues??[],normalizedPayload:quote.normalizedPayload??null} as unknown as JsonValue};}catch(error){return this.failure(context,'PRICING_QUOTE_UNAVAILABLE',error instanceof Error?error.message:'试算未完成');}
  }
  if(businessOperation(request.capabilityId))return executeBusiness(this.business(request.connectionId,context.configRevision),this.businessStore(request.connectionId,context.configRevision),context);
  if(legacyBusinessKind(request.capabilityId)){
   try{return await executeLegacyBusiness(this.business(request.connectionId,context.configRevision),this.businessStore(request.connectionId,context.configRevision),domain.options.client,context);}catch(error){return this.failure(context,'BUSINESS_OPERATION_FAILED',error instanceof Error?error.message:'经营操作无法完成。');}
  }
  if(request.capabilityId==='hallmark.operations.get'){
   const linked=this.businessStore(request.connectionId,context.configRevision).get<RecordData>('business_runtime_operations',args.operationId);
   if(linked){
    if(!('sessionId'in request.source)||linked.sessionId!==request.source.sessionId)return this.failure(context,'OPERATION_NOT_FOUND','操作不存在。');
    const result=this.options.inspectOperation?await this.options.inspectOperation(args.operationId,context.signal):businessResult(this.business(request.connectionId,context.configRevision).get(linked.planId),{...context,operationId:args.operationId});
    return {...result,invocationId:request.invocationId,traceId:request.traceId};
   }
  }
  const fields=request.capabilityId==='hallmark.products.list'&&Array.isArray(args.fields)?args.fields as string[]:undefined;
  if(fields)delete args.fields;
  const source=request.source,sessionId='sessionId' in source?source.sessionId:`runtime:${request.connectionId}`;
  const legacyContext:InvocationContext={sessionId,signal:context.signal,...(context.operationId?{operationId:context.operationId}:{}),...(typeof args.userRequest==='string'?{userRequest:args.userRequest}:{})};
  const ozonKind=request.capabilityId.replace(/^hallmark\.ozon\./,'') as OzonKind;
  if(request.capabilityId==='hallmark.products.procurement')return this.convert(await readProcurement(args,domain.options.store,domain.options.client,context.signal,domain.options.pricing),context,descriptor);
  if(request.capabilityId==='hallmark.ozon.compose')return this.convert(await readOzonComposition(args,domain.options.store,domain.options.client,context.signal),context,descriptor);
  if(ozonKind==='ratings'){
   const gateway=this.resolve(this.options.businessGateway,request.connectionId,context.configRevision);
   if(!gateway)return this.failure(context,'OZON_DIRECT_STORE_REQUIRED','内容评级只使用应用自有的 Ozon 店铺连接，不经过 Hallmark 数据渠道。');
   const direct=connectionBusinessGateway(gateway,request.connectionId);
   if(typeof args.storeId!=='string'||!direct.hasStore(args.storeId))return this.failure(context,'STORE_CONNECTION_MISMATCH','目标店铺未绑定当前连接的独立 Ozon 凭据。');
   return this.convert(await readOzonData('ratings',args,domain.options.store,{storeDataRead:async(id,input)=>compatibilityReadResponse(await direct.request(id,{path:input.path,method:input.method,body:input.body as RecordData},context.signal))},context.signal),context,descriptor);
  }
  if(OZON_KINDS.includes(ozonKind))return this.convert(await readOzonData(ozonKind,args,domain.options.store,domain.options.client,context.signal),context,descriptor);
  if(request.capabilityId==='hallmark.products.skus')return this.convert(await domain.readProductSku(args.storeId,args.productId),context,descriptor);
  if(request.capabilityId==='hallmark.collected.skus'){
   if(!domain.options.client.getCollectedItemDetail)return this.failure(context,'SKU_DETAILS_UNAVAILABLE','连接没有结构化 SKU 明细接口。');
   const detail=await domain.options.client.getCollectedItemDetail(args.itemId);
   if(detail.status!=='ok')return this.convert({status:detail.status,error:detail.error},context,descriptor);
   if(detail.raw?.id!==args.itemId||!Array.isArray(detail.raw.skus))return this.failure(context,'SKU_DETAILS_INVALID','采集商品编号或 SKU 列表不完整。');
   const items=detail.raw.skus.map((sku:RecordData)=>({productId:detail.raw!.id,title:detail.raw!.title??null,sku:String(sku.sourceSkuId??sku.code??sku.id??''),spec:sku.spec??null,price:typeof sku.price==='number'?sku.price:null,currency:sku.currency??detail.raw!.currency??null,image:sku.image??null}));
   return this.convert({status:'ok',data:{items,total:items.length},provenance:detail.provenance},context,descriptor);
  }
  if(descriptor.effect==='mutation')args.clientOperationKey=canonicalJson([request.appId,request.connectionId,request.capabilityId,request.idempotencyKey]);
  const route=HALLMARK_API_OPERATIONS.find(row=>row.capabilityId===request.capabilityId);
  let result:ToolResult;
  const directGateway=this.resolve(this.options.businessGateway,request.connectionId,context.configRevision);
  if(route?.path&&typeof args.storeId==='string'&&directGateway?.getStore(args.storeId)&&(!directGateway.getStore(args.storeId)!.sourceConnectionId||directGateway.getStore(args.storeId)!.sourceConnectionId===request.connectionId)){const response=compatibilityReadResponse(await directGateway.request(args.storeId,{path:route.path,method:route.method,body:args.body??{}},context.signal));if(response.status==='ok'&&route.path==='/v3/product/info/list'){const body=response.raw?.response??response.raw,items=body?.items??body?.result?.items??body?.result;if(Array.isArray(items))recordBusinessProductObservations(this.businessStore(request.connectionId,context.configRevision),args.storeId,items);}result={status:response.status,data:response.raw,error:response.error,provenance:response.provenance};}
  else if(route?.sourceMethod){const response=await domain.options.client[route.sourceMethod]();result={status:response.status,...(response.raw!==undefined?{data:response.raw}:{}),...(response.spill?{data:{spill:response.spill}}:{}),provenance:response.provenance,error:response.error};}
  else{const legacyName=route?.legacyName??(route?.path?'hallmark_get_platform_data':descriptor.aliases[0]);if(route?.path){args.path=route.path;args.method=route.method;}result=await domain.invoke(legacyName,args,legacyContext);}
  const collectedRefresh=request.capabilityId==='hallmark.datasets.refresh'&&typeof args.datasetKey==='string'&&domain.options.store.get<RecordData>('snapshots',args.datasetKey)?.sourceQuery?.tool==='hallmark_search_collected_items';
  if((request.capabilityId==='hallmark.collected.search'||collectedRefresh)&&result.status==='ok'&&isObject(result.data)&&Array.isArray(result.data.items)){
   await this.refreshCollectionStates(request.connectionId,context.configRevision,undefined,collectedRefresh);
   const rows=result.data.items as RecordData[],states=this.collectionStates(request.connectionId,context.configRevision,rows.map(r=>String(r.id)),rows.map(r=>({id:String(r.id),skuCount:Number(r.skuCount??0)})));
   const enriched:RecordData={...result.data,items:rows.map(row=>({...row,listedIn:states[String(row.id)]??[]}))};result={...result,data:enriched};
   if(typeof enriched.datasetKey==='string'){const saved=domain.options.store.get<RecordData>('snapshots',enriched.datasetKey);if(saved?.payload){domain.options.store.put('snapshots',enriched.datasetKey,{...saved,payload:{...saved.payload,items:enriched.items}});if(collectedRefresh){const {payload,...snapshot}=saved;enriched.snapshot=snapshot;enriched.counts={items:enriched.items.length};}}}
  }
  if(request.capabilityId==='hallmark.operations.list'&&Array.isArray(result.data)){
   const business=this.business(request.connectionId,context.configRevision),linked=this.businessStore(request.connectionId,context.configRevision).list<RecordData>('business_runtime_operations').filter(row=>row.sessionId===sessionId);
   const entries=linked.flatMap(link=>{
    let plan;try{plan=business.get(link.planId);}catch{return [];}
    if(args.storeId&&plan.storeId!==args.storeId||args.since&&plan.createdAt<args.since)return [];
    const projected=publicPlan(plan) as RecordData,actions=[...new Set(plan.rows.map(row=>row.action))];
    const kinds:Record<string,string>={price:'update_price',stock:'update_stock',listing:'list_product'};
    const state=plan.status==='done'?'succeeded':plan.status==='running'?'running':plan.status==='blocked'?'failed':plan.status==='draft'?'pending':plan.status;
    return [{operationId:link.operationId,planId:plan.planId,kind:actions.length===1?(kinds[actions[0]]??actions[0]):'business_plan',sessionId,storeId:plan.storeId,state,targets:plan.rows.map(row=>row.target.offerId),input:{planId:plan.planId},items:projected.rows,createdAt:plan.createdAt,updatedAt:plan.updatedAt,planStatus:plan.status}];
   });
   const byId=new Map([...result.data,...entries].map(row=>[row.operationId,row]));
   result={...result,data:[...byId.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,args.limit??100)};
  }
  if(request.capabilityId==='hallmark.app.info'&&isObject(result.data))result={...result,data:{...result.data,boundaries:{
   listing:'Agent 按 ozon-listing Skill 制作原生 Ozon item，采购 SKU 与数量只选择一次，成本由程序读取；保存草稿不审核，明确提交才统一审核并导入。图片通过独立审核子代理查看实际像素。',
   business:'hallmark.plan 提供调价、库存、归档、促销报名/调价/退出及上品。ERP 与 Agent 共用逐行审核、执行、回执和恢复；规则足够直接放行，语义才用模型。',
   storeTask:'经营应用独立保存店铺连接与原请求回执，直接调用 Ozon；旧平台任务只用于核查迁入的历史请求。采集资料仍从原平台读取。',
   verification:'精确商品身份、采购组成及成本、已配置价格边界、素材绑定、防重复由程序处理。未知结果仅核查原请求。平台业务字段错误返回具体字段与修正方向。',
   profit:DYNAMIC_PROFIT_BASIS,credentials:'平台凭据由经营应用的本地凭据库管理，Agent 不接触；审核中转密钥由服务环境读取。',
   valueSource:'接受确定的业务值；不要求 userRequest/valueSource/scopeConfirmed、手工幂等键或已检查声明。缺少真实规则或成本依据时，只阻塞依赖该依据的行。',
   notCovered:['采购成本修改','自动解读任意命名规则并生成价格','主动全店巡检'],localCapabilitiesAvailableOffline:true
  }}};
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
if(legacy.provenance||legacy.metricBasis){const old=legacy.provenance,input:RecordData=isObject(request.input)?request.input:{},snapshot=input.storeId?this.domain(request.connectionId,context.configRevision).options.store.get('snapshots',`store_products:${input.storeId}`):undefined;provenance=[{appId:'hallmark',connectionId:request.connectionId,sourceKind:old?.source==='hallmark_compute'?'derived':old?.source==='app_snapshot'||old?.source==='hallmark_snapshot'?'snapshot':'application',sourceRef:old?.endpoint??descriptor?.capabilityId??request.capabilityId,fetchedAt:old?.fetchedAt??snapshot?.lastSuccessAt??new Date().toISOString(),sourceDataTime:old?.dataTime??null,freshness:['hallmark.ozon.compose','hallmark.products.procurement'].includes(request.capabilityId)&&isObject(legacy.data)&&isObject(legacy.data.cache)?legacy.data.cache.stale?'stale':'fresh':snapshot?.state==='failed'?'stale':'unknown',...(legacy.metricBasis?{metricBasis:legacy.metricBasis}:{})}];}
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
  const domain=this.domain(context.request.connectionId,context.configRevision),business=this.businessStore(context.request.connectionId,context.configRevision).get<RecordData>('business_runtime_operations',operationId);
  if(business)return businessResult(await this.business(context.request.connectionId,context.configRevision).inspect(business.planId,context.signal),context);
  const legacy=await domain.writes.get(operationId);
  return this.convert(legacy,context,{...descriptor('get_operation'),capabilityId:context.request.capabilityId});
 }
 async continueOperation(operationId:string,context:ExecutionContext):Promise<CapabilityResult>{
  const domain=this.domain(context.request.connectionId,context.configRevision),business=this.businessStore(context.request.connectionId,context.configRevision).get<RecordData>('business_runtime_operations',operationId);
  if(!business)return this.failure(context,'CONTINUATION_UNSUPPORTED','该操作没有已提交的经营变更单。');
  return businessResult(await this.business(context.request.connectionId,context.configRevision).continueSubmitted(business.planId,context.signal),context);
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
