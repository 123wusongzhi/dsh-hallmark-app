import { randomUUID } from 'node:crypto';
import { TOOL_DEFINITIONS, APP_INSTRUCTIONS, clarify, failed, validate } from '../../contracts/src/index.ts';
import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
import { DatasetRefresher } from '../../core/src/refresh.ts';
import { prepareCategory, readCategory } from '../../core/src/category.ts';
import { prepareCollected, readCollected } from '../../core/src/collected.ts';
import { projectOperationReceipt } from '../../core/src/receipt.ts';
import { WriteOperations } from '../../core/src/write.ts';
import { wrapped, storeId, productStoreId, productId, offerId, profitRows, METRIC_BASIS, APP_BOUNDARIES, clean, now, sourceTime } from '../../core/src/types.ts';
import type { AdapterResponse, CoreOptions, CoreStore, CoreClient, CoreBroker, RecordData, Operation } from '../../core/src/types.ts';
import { PLATFORM_READ_ENDPOINTS } from '../../hallmark-adapter/client.ts';
import type {HallmarkClient} from '../../hallmark-adapter/client.ts';
import {OZON_STORE_READ_ENDPOINTS} from '../../hallmark-adapter/ozon-read-routes.ts';

export interface HallmarkDomainOptions { store:CoreStore; client:CoreClient; broker:CoreBroker }
/** Compatibility domain implementation. Session routing and presentation belong to Runtime. */
export class HallmarkDomain {
 readonly options:HallmarkDomainOptions;
 readonly refresher:DatasetRefresher;
 readonly writes:WriteOperations;
 constructor(options:HallmarkDomainOptions){this.options=options;this.refresher=new DatasetRefresher(options.store,options.client);this.writes=new WriteOperations({...options,presentation:{} as CoreOptions['presentation']});}
 /** One platform product row is one SKU; do not invent sibling variants. */
 async readProductSku(store:string,id:string):Promise<ToolResult>{
  const source=await this.products(store);if(source.result)return source.result;
  const row=(source.payload?.products as RecordData[]??[]).find(item=>String(item.productId??item.product_id??item.offerId??item.offer_id)===id);
  if(!row)return {status:'ok',data:{items:[],total:0},provenance:source.provenance};
  const matched=Array.isArray(row.sources)?row.sources.find((item:RecordData)=>item.sourceSkuMatched===true):undefined;
  const minor=row.pricing?.sellerMinor;
  return {status:'ok',data:{items:[{productId:id,title:row.title??null,sku:row.sku??null,spec:matched?.sourceSpec??null,image:row.imageUrl??null,price:typeof minor==='number'?minor/100:null,currency:row.pricing?.currency??row.currency??null}],total:1},provenance:source.provenance};
 }
 async invoke(name:string,args:RecordData,context:InvocationContext):Promise<ToolResult>{
  const definition=TOOL_DEFINITIONS.find(tool=>tool.name===name);if(!definition)return failed('TOOL_NOT_FOUND','未知工具。');
  const missing=(definition.parameters.required??[]).filter(key=>!Object.hasOwn(args,key));if(missing.length)return clarify(missing,'请补充必要信息。');
  const errors=validate(definition.parameters,args);if(errors.length)return failed('INVALID_PARAMS',errors.join('; '));
  if(context.signal?.aborted)return failed('ABORTED','调用已取消。');
  const kind=name.replace(/^hallmark_/,'');
  try {
   if(kind==='app_info')return {status:'ok',data:{appId:'hallmark',instructions:APP_INSTRUCTIONS,tools:TOOL_DEFINITIONS.map(({name,kind})=>({name,kind})),boundaries:APP_BOUNDARIES}};
   if(kind==='list_stores')return wrapped(await this.options.client.getStores());
   if(kind==='resolve_store'){const resolved=await this.resolve({store:args.query});return resolved.result??{status:'ok',data:resolved.store};}
   if(kind==='search_collected_items'){const prepared=prepareCollected(args);return 'result' in prepared?prepared.result:readCollected(this.options.store,this.options.client,prepared);}
   if(kind==='get_collected_item')return wrapped(await this.options.client.getCollectedItem(args.itemId));
   if(kind==='get_operation')return this.writes.get(args.operationId,context);
   if(kind==='list_operations')return {status:'ok',data:this.options.store.list<Operation>('operations').filter(op=>op.sessionId===context.sessionId&&(!args.storeId||op.storeId===args.storeId)&&(!args.since||op.createdAt>=args.since)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,args.limit??100)};
   if(kind==='get_data_status'&&args.datasetKey)return this.dataStatus(args.datasetKey);
   if(kind==='refresh_data'&&args.datasetKey)return this.refresher.refresh(args.datasetKey,context);
   if(kind==='filter_products'&&args.resultSetId){const result=this.resultSet(args.resultSetId);return result.result??{status:'ok',data:this.resultSetOutput(result.value!),metricBasis:METRIC_BASIS,provenance:result.value?.provenance};}
   if(definition.kind==='write'&&args.clientOperationKey){const existing=this.options.store.getOperationByClientKey<Operation>(args.clientOperationKey);if(existing&&args.storeId===existing.storeId)return this.writes.invoke(kind,args,existing.storeId,context);}
   if(kind==='get_category_data'){const prepared=prepareCategory(args);if('result' in prepared)return prepared.result;}
   const resolved=await this.resolve(args);if(resolved.result)return resolved.result;
   const id=storeId(resolved.store!);
   if(kind==='get_category_data'){const prepared=prepareCategory(args,id);return 'result' in prepared?prepared.result:readCategory(this.options.store,this.options.client,prepared);}
   this.options.store.put('settings',`queried_store:${id}`,{storeId:id,lastQueriedAt:now()});
   if(definition.kind==='write')return this.writes.invoke(kind,args,id,context);
   if(kind==='refresh_data')return this.refresher.refresh(`store_products:${id}`,context);
   if(kind==='get_data_status')return this.dataStatus(`store_products:${id}`);
   if(kind==='get_platform_data'){
    if(!Object.hasOwn(PLATFORM_READ_ENDPOINTS,args.path))return failed('ENDPOINT_NOT_ALLOWED','仅允许已核实只读白名单。');
    const method=args.method??PLATFORM_READ_ENDPOINTS[args.path];if(method!==PLATFORM_READ_ENDPOINTS[args.path])return failed('ENDPOINT_NOT_ALLOWED','接口方法与已登记只读契约不一致。');
    const operationId=context.operationId??randomUUID(),timestamp=now(),requestId=this.options.broker.requestId('read',operationId,0);
    const op:Operation={operationId,kind:'platform_read',sessionId:context.sessionId,storeId:id,targets:[],input:args,state:'running',hallmarkRefs:[],items:[],createdAt:timestamp,updatedAt:timestamp};
    const persist=()=>{this.options.store.put('operations',operationId,clean(op));projectOperationReceipt(this.options.store,operationId);};
    const finish=(response:AdapterResponse):ToolResult=>{const result=wrapped(response),state=response.status==='ok'?'succeeded':response.status==='unknown'?'unknown':'failed';this.options.store.put('operations',operationId,clean({...op,state,result,updatedAt:now()}));projectOperationReceipt(this.options.store,operationId);return {...result,operation:{operationId,state}};};
    const client=this.options.client as CoreClient&Partial<Pick<HallmarkClient,'storeDataRead'>>,input={requestId,agentId:'dsh-hallmark-app',path:args.path,method,body:args.body??{}};
    if(client.storeDataRead&&OZON_STORE_READ_ENDPOINTS[args.path]===method){
     op.hallmarkRefs.push({storeId:id,requestId,route:'store_data_read'});persist();
     const response=await client.storeDataRead(id,input);
     // Only a missing local gateway can use the existing read path. An upstream
     // 404, denied authorization, malformed response or timeout must stay visible.
     if(response.error?.code!=='HALLMARK_HTTP_404')return finish(response);
    }
    const task=await this.options.broker.getStoreTask(id);if(task.status!=='ok')return op.hallmarkRefs.length?finish(task):wrapped(task);
    op.hallmarkRefs.push({taskId:task.raw.taskId,requestId});persist();
    return finish(await this.options.client.platformRead(task.raw.taskId,input));
   }
   if(['list_store_products','compute_profit','filter_products'].includes(kind)){
    const source=await this.products(id);if(source.result)return source.result;
    const payload=source.payload!,rawProducts:RecordData[]=payload.products;
    if(kind==='list_store_products'){
     const queried=rawProducts.filter(row=>(args.status===undefined||row.status===args.status)&&(!args.query||JSON.stringify(row).toLowerCase().includes(args.query.toLowerCase()))),offset=args.cursor?Number(args.cursor):0;
     if(!Number.isSafeInteger(offset)||offset<0)return failed('INVALID_CURSOR','分页 cursor 须为非负偏移。');
     // An unfiltered spill is source evidence in the snapshot, never a status-filtered page.
     const limit=args.limit??100;if(source.spill&&args.status===undefined)return {status:'ok',data:{spill:source.spill,storeId:id,total:queried.length,cursor:String(offset),limit},provenance:source.provenance};
     return {status:'ok',data:{...payload,products:queried.slice(offset,offset+limit),total:queried.length,...(offset+limit<queried.length?{cursor:String(offset+limit)}:{})},provenance:source.provenance};
    }
    const selected=rawProducts.filter(row=>(!args.offerIds&&!args.productIds)||args.offerIds?.includes(offerId(row))||args.productIds?.includes(productId(row))),computed=profitRows(selected);
    if(kind==='compute_profit')return {status:'ok',data:source.spill?{spill:source.spill,storeId:id,total:computed.length}:{...payload,products:computed.slice(0,200),total:computed.length},provenance:{...source.provenance,source:'hallmark_compute'},metricBasis:METRIC_BASIS};
    const products:RecordData[]=[],unable:RecordData[]=[];
    for(const row of computed){const margin=row.referenceProfit.margin;if((args.minMargin!=null||args.maxMargin!=null)&&margin==null){unable.push(row);continue;}if(args.minMargin!=null&&margin<args.minMargin||args.maxMargin!=null&&margin>args.maxMargin)continue;const price=typeof row.price==='object'?Number(row.price.price):Number(row.price??row.priceMinor/100),stock=Number(row.stock??row.stockTotal??row.stocks?.reduce((sum:number,item:RecordData)=>sum+Number(item.present??item.stock??0),0));if(args.minPrice!=null&&(!Number.isFinite(price)||price<args.minPrice)||args.maxPrice!=null&&(!Number.isFinite(price)||price>args.maxPrice)||args.minStock!=null&&(!Number.isFinite(stock)||stock<args.minStock)||args.maxStock!=null&&(!Number.isFinite(stock)||stock>args.maxStock)||args.status&&row.status!==args.status)continue;products.push(row);}
    const resultSetId=randomUUID(),dataTime=sourceTime(source.provenance?.dataTime),value=clean({resultSetId,storeId:id,sourceSpill:source.spill,payload:{products,unable,total:computed.length},dataTime,expiresAt:new Date(Date.now()+86400000).toISOString(),provenance:{...source.provenance,source:'hallmark_compute'},metricBasis:METRIC_BASIS});this.options.store.put('result_sets',resultSetId,value);return {status:'ok',data:this.resultSetOutput(value),provenance:value.provenance,metricBasis:METRIC_BASIS};
   }
   return {status:'unavailable',error:{code:'CAPABILITY_UNAVAILABLE',message:'领域能力未开放。',retryable:false}};
  }catch(error){return failed((error as {code?:string})?.code??'CORE_ERROR',error instanceof Error?error.message:'领域工具执行失败');}
 }
 private async resolve(args:RecordData):Promise<{store?:RecordData;result?:ToolResult}>{
  if(!args.storeId&&!args.store)return {result:clarify(['storeId/store'],'请明确指定目标店铺；不使用默认店铺。')};
  const response=await this.options.client.getStores();if(response.status!=='ok')return {result:wrapped(response)};if(!Array.isArray(response.raw))return {result:failed('INVALID_SOURCE_RESPONSE','店铺响应须为数组。')};
  const query=String(args.store??'').toLocaleLowerCase(),exact=args.storeId?response.raw.filter((row:RecordData)=>storeId(row)===args.storeId):response.raw.filter((row:RecordData)=>[storeId(row),row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])].some(value=>String(value??'').toLocaleLowerCase()===query)),matches=exact.length?exact:args.storeId?[]:response.raw.filter((row:RecordData)=>[row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])].some(value=>value&&String(value).toLocaleLowerCase().includes(query)));
  if(matches.length!==1)return {result:clarify(['storeId'],matches.length?'店铺匹配不唯一，请选择。':'没有匹配店铺，请核对。',matches)};
  if(args.storeId&&args.store&&!matches.some((row:RecordData)=>String(row.shopName??row.name??'').toLocaleLowerCase().includes(String(args.store).toLocaleLowerCase())))return {result:clarify(['store'],'店铺 ID 与名称不一致。',matches)};return {store:matches[0]};
 }
 private async products(id:string):Promise<{payload?:RecordData;provenance?:any;spill?:unknown;result?:ToolResult}>{
  const cached=this.options.store.get('snapshots',`store_products:${id}`);if(cached?.payload){const {dataTime:previousSourceTime,...provenance}=cached.provenance??{},dataTime=sourceTime(cached.dataTime,previousSourceTime);return {payload:cached.payload,spill:cached.sourceSpill,provenance:{...provenance,source:'app_snapshot',storeId:id,...(dataTime?{dataTime}:{})}};}
  const response=await this.options.client.getStoreProducts();if(response.status!=='ok')return {result:wrapped(response)};if(!Array.isArray(response.raw?.products))return {result:failed('INVALID_SOURCE_RESPONSE','商品响应缺少 products 数组。')};
  const payload={...response.raw,products:response.raw.products.filter((row:RecordData)=>productStoreId(row)===id)},row=response.raw.stores?.find((item:RecordData)=>storeId(item)===id),dataTime=sourceTime(row?.lastSuccessAt,response.raw.dataTime,response.provenance?.dataTime),{dataTime:ignored,...original}=response.provenance??{},provenance=clean({...original,source:response.provenance?.source??'hallmark_snapshot',storeId:id,...(dataTime?{dataTime}:{})});this.options.store.updateSnapshotSuccess(`store_products:${id}`,payload,dataTime,clean({provenance,sourceSpill:response.spill}));return {payload,provenance,spill:response.spill};
 }
 private dataStatus(key:string):ToolResult{const snapshot=this.options.store.get('snapshots',key);if(!snapshot)return {status:'ok',data:{datasetKey:key,state:'empty',lastSuccessAt:null,lastError:null}};const {payload,...status}=snapshot;return {status:'ok',data:status};}
 private resultSetOutput(value:RecordData):RecordData{const rows=value.payload.products,unable=value.payload.unable;return {...value,payload:value.sourceSpill?{total:value.payload.total,matchedCount:rows.length,unableCount:unable.length}:{...value.payload,products:rows.slice(0,200),unable:unable.slice(0,200),...(rows.length>200||unable.length>200?{truncated:true,matchedCount:rows.length,unableCount:unable.length}:{})}};}
 private resultSet(id:string):{value?:RecordData;result?:ToolResult}{const value=this.options.store.get('result_sets',id);if(!value)return {result:failed('RESULT_SET_NOT_FOUND','结果集不存在。')};if(Date.parse(value.expiresAt)<=Date.now())return {result:failed('RESULT_SET_EXPIRED','结果集已超过 24 小时，请重新查询。')};return {value};}
 async dispose():Promise<void>{await Promise.all([this.writes.idle(),this.refresher.idle()]);}
}
