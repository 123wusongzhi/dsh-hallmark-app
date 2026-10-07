import { randomUUID, createHash } from 'node:crypto';
import { TOOL_DEFINITIONS, APP_INSTRUCTIONS, clarify, failed, validate } from '../../contracts/src/index.ts';
import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
import { DatasetRefresher } from './refresh.ts';
import { prepareCategory, readCategory } from './category.ts';
import { prepareCollected, readCollected } from './collected.ts';
import { SessionViewRegistry } from './views.ts';
import { projectOperationReceipt } from './receipt.ts';
import type { SessionViewList, SessionViewChange, SessionViewChangeResult } from './views.ts';
import type { ViewSpec } from '../../presentation/src/types.ts';
import { hydrateSourceBindings } from '../../presentation/src/source-data.ts';
export type { SessionViewList, SessionViewSummary } from './views.ts';
import { WriteOperations, operationResult } from './write.ts';
import { active, wrapped, storeId, productStoreId, productId, offerId, profitRows, METRIC_BASIS, APP_BOUNDARIES, clean, now, sourceTime } from './types.ts';
import type { CoreOptions, RecordData, Operation } from './types.ts';
export type { CoreOptions } from './types.ts';
const READ_PATHS=new Set(['/v3/product/info/list','/v5/product/info/prices','/v4/product/info/attributes','/v1/actions','/v2/actions/products','/v2/actions/candidates','/v2/product/info/stocks-by-warehouse/fbs','/v1/product/import/info','/v2/warehouse/list']);
export class AppCore {
 options:CoreOptions;refresher:DatasetRefresher;writes:WriteOperations;
 #sessionViews:SessionViewRegistry;
 constructor(options:CoreOptions){this.options=options;this.refresher=new DatasetRefresher(options.store,options.client);this.writes=new WriteOperations(options);this.#sessionViews=new SessionViewRegistry(options.presentation,options.store);}
 /** Local migration hook for trusted pre-upgrade session exports; never dispatches business tools. */
 restoreSessionView(sessionId:string,spec:ViewSpec):ViewSpec {
  this.#sessionViews.assertNotForeign(sessionId,spec.id);this.#sessionViews.assertCanReadSpec(sessionId,spec);
  if(!this.options.presentation.restoreDraft)throw new Error('DRAFT_RESTORE_UNAVAILABLE');
  const restored=this.options.presentation.restoreDraft(spec);this.#sessionViews.recordSuccess(sessionId,restored);return restored;
 }
 async invoke(name:string,args:RecordData={},context:InvocationContext):Promise<ToolResult>{
  if(!active(this.options.store,context))return failed('APP_NOT_ACTIVE','当前会话未激活 Hallmark。');
  const definition=TOOL_DEFINITIONS.find(t=>t.name===name);if(!definition)return failed('TOOL_NOT_FOUND','未知工具。');
  const missing=(definition.parameters.required??[]).filter(key=>!Object.hasOwn(args,key));
  if(missing.length){if(definition.kind==='save'&&missing.includes('userRequest'))return failed('SAVE_NOT_REQUESTED','保存须记录本轮明确保存原话。');return clarify(missing,'请补充必要信息。');}
  const errors=validate(definition.parameters,args);if(errors.length)return failed('INVALID_PARAMS',errors.join('; '));
  if(context.signal?.aborted)return failed('ABORTED','调用已取消。');
  try {
   const kind=name.replace(/^hallmark_/,'');const p=this.options.presentation;
   if(kind==='app_info')return {status:'ok',data:{appId:'hallmark',sessionComponents:this.sessionComponentSummary(context.sessionId),instructions:APP_INSTRUCTIONS,tools:TOOL_DEFINITIONS.map(t=>({name:t.name,kind:t.kind})),boundaries:APP_BOUNDARIES}};
   if(kind==='list_stores')return wrapped(await this.options.client.getStores());
   if(kind==='resolve_store'){const resolved=await this.resolve({store:args.query});return resolved.result??{status:'ok',data:resolved.store};}
   if(kind==='search_collected_items'){
    const prepared=prepareCollected(args);return 'result' in prepared?prepared.result:readCollected(this.options.store,this.options.client,prepared);
   }
   if(kind==='get_collected_item')return wrapped(await this.options.client.getCollectedItem(args.itemId));
   if(kind==='get_operation')return this.getOperation(args.operationId,context);
   if(kind==='list_operations'){const data=this.options.store.list<Operation>('operations').filter(op=>op.sessionId===context.sessionId&&(!args.storeId||op.storeId===args.storeId)&&(!args.since||op.createdAt>=args.since)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,args.limit??100);return {status:'ok',data};}
   if(kind==='get_data_status'&&args.datasetKey)return this.dataStatus(args.datasetKey);
   if(kind==='refresh_data'&&args.datasetKey)return this.refreshDataset(args.datasetKey,context);
   if(['render_view','update_view','open_component','open_source_component','save_component','save_entry','save_template','list_saved','manage_saved'].includes(kind)){
    if(definition.kind==='save'){
     if(!args.userRequest?.trim())return failed('SAVE_NOT_REQUESTED','仅本轮明确保存要求允许持久保存。');
     if(context.userRequest&&args.userRequest!==context.userRequest)return failed('USER_REQUEST_MISMATCH','保存原话必须与当前指令一致。');
    }
    if(kind==='open_component'){
     const saved=this.options.store.get('components',args.componentId);
     if(!saved?.spec)return failed('SAVED_NOT_FOUND','已保存组件不存在。');
     this.#sessionViews.assertCanReadSpec(context.sessionId,saved.spec);
     if(!p.openComponent)return failed('CAPABILITY_UNAVAILABLE','组件后端未提供打开可编辑草稿的能力。');
     const draft=p.openComponent(args.componentId,clean({revision:args.revision,directory:args.directory}));this.#sessionViews.assertCanReadSpec(context.sessionId,draft.spec);this.#sessionViews.recordSuccess(context.sessionId,draft.spec);
     const initialData=await hydrateSourceBindings(draft.spec,id=>p.getViewData?.(id),key=>this.refresher.refresh(key,context));
     return {status:'ok',data:{viewId:draft.spec.id,...draft,...(initialData.length?{initialData}:{})}};
    }
    if(kind==='open_source_component'){
     if(!p.openSourceComponent)return failed('CAPABILITY_UNAVAILABLE','源码组件后端尚未接入。');
     if(args.viewId)this.#sessionViews.requireOwnedView(context.sessionId,args.viewId);
     const view=p.openSourceComponent(args.directory,clean({viewId:args.viewId,title:args.title,bindings:args.bindings}));this.#sessionViews.assertCanReadSpec(context.sessionId,view);this.#sessionViews.recordSuccess(context.sessionId,view);
     const initialData=await hydrateSourceBindings(view,id=>p.getViewData?.(id),key=>this.refresher.refresh(key,context));
     return {status:'ok',data:{viewId:view.id,spec:view,...(initialData.length?{initialData}:{})}};
    }
    if(kind==='render_view'){
     let bindings=args.bindings??args.spec?.bindings;
     if(args.resultSetId){const result=this.resultSet(args.resultSetId);if(result.result)return result.result;bindings=[{id:'data',datasetKey:`result_set:${args.resultSetId}`,fieldMap:{}}];}
     let view:any;
     if(args.spec){this.#sessionViews.assertCanRender(context.sessionId,args.spec.id);view=p.renderView({...args.spec,...(bindings?{bindings}:{})});}
     else if(args.templateId&&p.renderFromTemplate)view=p.renderFromTemplate(args.templateId,args.title??'Hallmark',bindings??[]);
     else return clarify(['spec/templateId'],'请给出 ViewSpec 或已有模板与绑定。');
     this.#sessionViews.recordSuccess(context.sessionId,view);
     const initialData=await hydrateSourceBindings(view,id=>p.getViewData?.(id),key=>this.refresher.refresh(key,context));
     return {status:'ok',data:{viewId:view.id,spec:view,...(initialData.length?{initialData}:{})}};
    }
    if(kind==='update_view'){this.#sessionViews.requireOwnedView(context.sessionId,args.viewId);const view=p.updateView(args.viewId,args.patch);this.#sessionViews.recordSuccess(context.sessionId,view);return {status:'ok',data:{viewId:view.id,spec:view}};}
    if(kind==='save_component'){
     this.#sessionViews.assertNotForeign(context.sessionId,args.viewId);
     if(args.mode==='update'){
      const missing=['componentId','expectedRevision'].filter(key=>!Object.hasOwn(args,key));if(missing.length)return clarify(missing,'更新原组件需要明确原组件 ID 和打开时的版本。');
      this.#sessionViews.requireOwnedView(context.sessionId,args.viewId);
     }
     return {status:'ok',data:p.saveComponent(args.viewId,args.userRequest,args.title,clean({mode:args.mode,componentId:args.componentId,expectedRevision:args.expectedRevision}))};
    }
    if(kind==='save_entry')return {status:'ok',data:p.saveEntry(args.binding,args.title,args.userRequest)};
    if(kind==='save_template'){this.#sessionViews.assertNotForeign(context.sessionId,args.viewId);return {status:'ok',data:p.saveTemplate(args.viewId,args.name,args.userRequest,args.description)};}
    if(kind==='list_saved')return {status:'ok',data:p.listSaved()};
    if(context.userRequest&&args.userRequest&&context.userRequest!==args.userRequest)return failed('USER_REQUEST_MISMATCH','管理原话不符。');
    return {status:'ok',data:p.manageSaved(args.kind,args.id,clean({action:args.action,name:args.name,order:args.order,pinned:args.pinned}))};
   }
   if(kind==='filter_products'&&args.resultSetId){const result=this.resultSet(args.resultSetId);return result.result??{status:'ok',data:this.resultSetOutput(result.value!),metricBasis:METRIC_BASIS,provenance:result.value?.provenance};}
   if(definition.kind==='write'&&args.clientOperationKey){const existing=this.options.store.getOperationByClientKey<Operation>(args.clientOperationKey);if(existing&&args.storeId===existing.storeId)return this.writes.invoke(kind,args,existing.storeId,context);}
   if(kind==='get_category_data'){const prepared=prepareCategory(args);if('result' in prepared)return prepared.result;}
   const resolved=await this.resolve(args);if(resolved.result)return resolved.result;
   const id=storeId(resolved.store!);
   if(kind==='get_category_data'){const prepared=prepareCategory(args,id);return 'result' in prepared?prepared.result:readCategory(this.options.store,this.options.client,prepared);}
   this.options.store.put('settings',`queried_store:${id}`,{storeId:id,lastQueriedAt:now()});
   if(definition.kind==='write')return this.writes.invoke(kind,args,id,context);
   if(kind==='refresh_data')return this.refreshDataset(`store_products:${id}`,context);
   if(kind==='get_data_status')return this.dataStatus(`store_products:${id}`);
   if(kind==='get_platform_data'){
    if(!READ_PATHS.has(args.path))return failed('ENDPOINT_NOT_ALLOWED','仅允许已核实只读白名单。');
    const method=args.method??(args.path==='/v1/actions'?'GET':'POST');
    if(args.path==='/v1/actions'&&method!=='GET')return failed('ENDPOINT_NOT_ALLOWED','/v1/actions 仅允许 GET。');
    const task=await this.options.broker.getStoreTask(id);if(task.status!=='ok')return wrapped(task);
    const operationId=randomUUID(),timestamp=now();const requestId=this.options.broker.requestId('read',operationId,0);
    const op:Operation={operationId,kind:'platform_read',sessionId:context.sessionId,storeId:id,targets:[],input:args,state:'running',hallmarkRefs:[{taskId:task.raw.taskId,requestId}],items:[],createdAt:timestamp,updatedAt:timestamp};this.options.store.put('operations',operationId,op);projectOperationReceipt(this.options.store,operationId);
    try {const response=await this.options.client.platformRead(task.raw.taskId,{requestId,agentId:'dsh-hallmark-app',path:args.path,method,body:args.body??{}});const result=wrapped(response);const state=response.status==='ok'?'succeeded':response.status==='unknown'?'unknown':'failed';this.options.store.put('operations',operationId,clean({...op,state,result,updatedAt:now()}));projectOperationReceipt(this.options.store,operationId);return {...result,operation:{operationId,state}};}
    catch(error){this.options.store.put('operations',operationId,{...op,state:'failed',error:{code:'PLATFORM_READ_FAILED'},updatedAt:now()});projectOperationReceipt(this.options.store,operationId);throw error;}
   }
   if(['list_store_products','compute_profit','filter_products'].includes(kind)){
    const source=await this.products(id);if(source.result)return source.result;
    const payload=source.payload!,rawProducts:RecordData[]=payload.products;
    if(kind==='list_store_products'){
     const queried=args.query?rawProducts.filter(row=>JSON.stringify(row).toLowerCase().includes(args.query.toLowerCase())):rawProducts;
     const offset=args.cursor?Number(args.cursor):0;if(!Number.isSafeInteger(offset)||offset<0)return failed('INVALID_CURSOR','分页 cursor 须为非负偏移。');
     const limit=args.limit??100;if(source.spill)return {status:'ok',data:{spill:source.spill,storeId:id,total:queried.length,cursor:String(offset),limit},provenance:source.provenance};return {status:'ok',data:{...payload,products:queried.slice(offset,offset+limit),total:queried.length,...(offset+limit<queried.length?{cursor:String(offset+limit)}:{})},provenance:source.provenance};
    }
    const selected=rawProducts.filter(row=>(!args.offerIds&&!args.productIds)||args.offerIds?.includes(offerId(row))||args.productIds?.includes(productId(row)));
    const computed=profitRows(selected);
    if(kind==='compute_profit')return {status:'ok',data:source.spill?{spill:source.spill,storeId:id,total:computed.length}:{...payload,products:computed.slice(0,200),total:computed.length},provenance:{...source.provenance,source:'hallmark_compute'},metricBasis:METRIC_BASIS};
    const products:RecordData[]=[],unable:RecordData[]=[];
    for(const row of computed){
     const margin=row.referenceProfit.margin;
     if((args.minMargin!=null||args.maxMargin!=null)&&margin==null){unable.push(row);continue;}
     if(args.minMargin!=null&&margin<args.minMargin||args.maxMargin!=null&&margin>args.maxMargin)continue;
     const price=typeof row.price==='object'?Number(row.price.price):Number(row.price??row.priceMinor/100);
     const stock=Number(row.stock??row.stockTotal??row.stocks?.reduce((sum:number,s:RecordData)=>sum+Number(s.present??s.stock??0),0));
     if(args.minPrice!=null&&(!Number.isFinite(price)||price<args.minPrice)||args.maxPrice!=null&&(!Number.isFinite(price)||price>args.maxPrice)||args.minStock!=null&&(!Number.isFinite(stock)||stock<args.minStock)||args.maxStock!=null&&(!Number.isFinite(stock)||stock>args.maxStock)||args.status&&row.status!==args.status)continue;
     products.push(row);
    }
    const resultSetId=randomUUID(),dataTime=sourceTime(source.provenance?.dataTime);
    const value=clean({resultSetId,storeId:id,sourceSpill:source.spill,payload:{products,unable,total:computed.length},dataTime,expiresAt:new Date(Date.now()+86400000).toISOString(),provenance:{...source.provenance,source:'hallmark_compute'},metricBasis:METRIC_BASIS});this.options.store.put('result_sets',resultSetId,value);
    return {status:'ok',data:this.resultSetOutput(value),provenance:value.provenance,metricBasis:METRIC_BASIS};
   }
   return {status:'unavailable',error:{code:'CAPABILITY_UNAVAILABLE',message:'当前能力未开放。',retryable:false}};
  }catch(error){return failed((error as any)?.code??'CORE_ERROR',error instanceof Error?error.message:'工具执行失败');}
 }
 private async resolve(args:RecordData):Promise<{store?:RecordData;result?:ToolResult}>{
  if(!args.storeId&&!args.store)return {result:clarify(['storeId/store'],'请明确指定目标店铺；不使用默认店铺。')};
  const response=await this.options.client.getStores();if(response.status!=='ok')return {result:wrapped(response)};
  if(!Array.isArray(response.raw))return {result:failed('INVALID_SOURCE_RESPONSE','店铺响应须为数组。')};
  const query=String(args.storeId??args.store).toLocaleLowerCase();
  const exact=response.raw.filter((row:RecordData)=>[storeId(row),row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])].some(v=>String(v??'').toLocaleLowerCase()===query));
  const matches=exact.length?exact:args.storeId?[]:response.raw.filter((row:RecordData)=>[row.shopName,row.name,...(Array.isArray(row.aliases)?row.aliases:[])].some(v=>v&&String(v).toLocaleLowerCase().includes(query)));
  if(matches.length!==1)return {result:clarify(['storeId'],matches.length?'店铺匹配不唯一，请选择。':'没有匹配店铺，请核对。',matches)};
  if(args.storeId&&args.store&&!matches.some((row:RecordData)=>String(row.shopName??row.name??'').toLocaleLowerCase().includes(String(args.store).toLocaleLowerCase())))return {result:clarify(['store'],'店铺 ID 与名称不一致。',matches)};
  return {store:matches[0]};
 }
 private async products(id:string):Promise<{payload?:RecordData;provenance?:any;spill?:unknown;result?:ToolResult}>{
  const cached=this.options.store.get('snapshots',`store_products:${id}`);
  if(cached?.payload){const {dataTime:previousSourceTime,...sourceProvenance}=cached.provenance??{};const dataTime=sourceTime(cached.dataTime,previousSourceTime);return {payload:cached.payload,spill:cached.sourceSpill,provenance:{...sourceProvenance,source:'app_snapshot',storeId:id,...(dataTime?{dataTime}:{})}};}
  const response=await this.options.client.getStoreProducts();if(response.status!=='ok')return {result:wrapped(response)};
  if(!Array.isArray(response.raw?.products))return {result:failed('INVALID_SOURCE_RESPONSE','商品响应缺少 products 数组。')};
  const payload={...response.raw,products:response.raw.products.filter((row:RecordData)=>productStoreId(row)===id)};
  const store=response.raw.stores?.find((r:RecordData)=>storeId(r)===id);const dataTime=sourceTime(store?.lastSuccessAt,response.raw.dataTime,response.provenance?.dataTime);
  const {dataTime:ignoredSourceTime,...sourceProvenance}=response.provenance??{};
  const provenance=clean({...sourceProvenance,source:response.provenance?.source??'hallmark_snapshot',storeId:id,...(dataTime?{dataTime}:{})});this.options.store.updateSnapshotSuccess(`store_products:${id}`,payload,dataTime,clean({provenance,sourceSpill:response.spill}));return {payload,provenance,spill:response.spill};
 }
 private dataStatus(key:string):ToolResult {const snapshot=this.options.store.get('snapshots',key);if(!snapshot)return {status:'ok',data:{datasetKey:key,state:'empty',lastSuccessAt:null,lastError:null}};const {payload,...status}=snapshot;return {status:'ok',data:status};}
 private resultSetOutput(value:RecordData):RecordData {const rows=value.payload.products,unable=value.payload.unable;return {...value,payload:value.sourceSpill?{total:value.payload.total,matchedCount:rows.length,unableCount:unable.length}:{...value.payload,products:rows.slice(0,200),unable:unable.slice(0,200),...(rows.length>200||unable.length>200?{truncated:true,matchedCount:rows.length,unableCount:unable.length}:{})}};}
 private resultSet(id:string):{value?:RecordData;result?:ToolResult}{const value=this.options.store.get('result_sets',id);if(!value)return {result:failed('RESULT_SET_NOT_FOUND','结果集不存在。')};if(Date.parse(value.expiresAt)<=Date.now())return {result:failed('RESULT_SET_EXPIRED','结果集已超过 24 小时，请重新查询。')};return {value};}
 listSessionViews(sessionId:string):SessionViewList{return this.#sessionViews.list(sessionId);}
 private sessionComponentSummary(sessionId:string):RecordData[] {
  return this.#sessionViews.list(sessionId).views.flatMap(summary=>{
   const spec=this.#sessionViews.get(sessionId,summary.viewId);if(!spec)return [];
   return [{viewId:spec.id,title:spec.title,kind:spec.kind??'view-spec',...(spec.kind==='source'&&spec.source?{source:{directory:spec.source.directory,buildId:spec.source.buildId}}:{})}];
  });
 }
 manageSessionView(sessionId:string,viewId:string,change:SessionViewChange):SessionViewChangeResult{return this.#sessionViews.manage(sessionId,viewId,change);}
 getSessionView(sessionId:string,viewId:string):ViewSpec|undefined{return this.#sessionViews.get(sessionId,viewId);}
 getSessionViewData(sessionId:string,viewId:string):ToolResult|undefined{return this.#sessionViews.getData(sessionId,viewId);}
 async refreshDataset(key:string,context:InvocationContext):Promise<ToolResult>{if(!/^operation:.+$/u.test(key)&&!active(this.options.store,context))return failed('APP_NOT_ACTIVE','当前会话未激活 Hallmark。');return this.refresher.refresh(key,context);}
 /** Scheduler-only read synchronization bypasses interactive session activation, never business writes. */
 async refreshDatasetBackground(key:string):Promise<ToolResult>{return this.refresher.refresh(key,{sessionId:'background'});}
 async getOperation(id:string,context?:InvocationContext):Promise<ToolResult>{return this.writes.get(id,context);}
 async recoverOperations():Promise<ToolResult[]>{const refreshed=this.refresher.recover();return [...refreshed,...await this.writes.recover()];}
 async waitForIdle():Promise<void>{await Promise.all([this.writes.idle(),this.refresher.idle()]);}
 getRefreshCandidates(date=new Date()):string[]{
  const keys=new Set<string>();
  for(const collection of ['components','entries'])for(const row of this.options.store.list(collection))for(const binding of row.spec?.bindings??(row.binding?[row.binding]:[])){const key=binding.datasetKey??(binding.query?`query:${createHash('sha256').update(JSON.stringify(binding.query)).digest('hex').slice(0,24)}`:'');if(/^(store_products|profit|query|operation|category|collected):.+$/.test(key))keys.add(key);}
  for(const row of this.options.store.list('settings'))if(row.storeId&&Date.parse(row.lastQueriedAt)>date.getTime()-7*86400000)keys.add(`store_products:${row.storeId}`);
  return [...keys];
 }
}

