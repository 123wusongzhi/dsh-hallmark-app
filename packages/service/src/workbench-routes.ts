import {createHash,randomUUID} from 'node:crypto';
import type {AppsRuntime} from '../../app-runtime/src/index.ts';
import type {AppsPresentationService} from '../../app-presentation/src/index.ts';
import type {DataSourceDraft,ReadWorkbenchInstanceInput,WorkbenchInstance,SaveWorkbenchInput,WorkbenchContext} from '../../app-presentation/src/types.ts';
import type {InvocationSource,JsonValue} from '../../app-contracts/src/index.ts';
import {MATERIAL_CATALOG} from '../../app-presentation/src/materials/catalog.ts';
import {FIELD_ROLES} from '../../app-presentation/src/field-roles.ts';
import {clearStoreLocalParams,validateWorkbenchContext} from '../../app-presentation/src/workbench.ts';
import {hallmarkProductSources,hallmarkCollectedSources} from '../../app-hallmark/src/field-mappings.ts';
import {hallmarkOzonSources} from '../../app-hallmark/src/ozon-data.ts';
import {createOzonCompositionDraft,DEFAULT_PRODUCT_FIELDS} from '../../app-hallmark/src/ozon-composition.ts';
import {HallmarkClient} from '../../hallmark-adapter/client.ts';

const fail=(message:string):never=>{throw Object.assign(new Error(message),{code:'INVALID_INPUT',statusCode:400});};
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail('参数必须是对象。');
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))fail('包含未声明的工作台参数。');}
function app(value:unknown):string {if(typeof value!=='string'||!/^[-a-z][a-z0-9-]{1,63}$/.test(value))fail('应用编号无效。');return value as string;}
interface StoreOption {id:string;name:string;connectionId:string}

/** The Runtime owns source definitions and selected-store context; credentials remain upstream. */
export function workbenchRoutes(runtime:AppsRuntime,presentation:AppsPresentationService){
 const stores=async(appId:string,signal?:AbortSignal)=>{
  const result:StoreOption[]=[],issues:{id:string;message:string}[]=[];
  if(appId!=='hallmark')return {stores:result,issues};
  for(const connection of runtime.listConnections(appId).filter(item=>item.enabled)){
   try{
    const config=connection.config as {baseUrl?:string};if(!config.baseUrl)throw Error('未配置平台连接地址。');
    const response=await new HallmarkClient({baseUrl:config.baseUrl,fetchImpl:(url,options)=>fetch(url,{...options,...(signal?{signal:AbortSignal.any([signal,...(options?.signal?[options.signal]:[])])}:{})})}).getStores();
    if(response.status!=='ok'||!Array.isArray(response.raw))throw Error(response.error?.message??'店铺列表读取失败。');
    for(const row of response.raw){if(row.platform&&row.platform!=='ozon'||row.status&&row.status!=='active')continue;result.push({id:row.id,name:row.shopName,connectionId:connection.connectionId});}
   }catch(error){issues.push({id:connection.connectionId,message:error instanceof Error?error.message:String(error)});}
  }
  return {stores:result,issues};
 };
 const invoke=async(appId:string,connectionId:string,capabilityId:string,input:JsonValue,source:InvocationSource,signal?:AbortSignal)=>{
  const descriptor=runtime.describe(capabilityId);if(!descriptor||descriptor.effect==='mutation')fail('数据读取能力不可用。');
  const id=randomUUID(),result=await runtime.invoke({protocolVersion:'1.0',invocationId:id,traceId:id,appId,connectionId,capabilityId,capabilityVersion:descriptor!.version,input,source,deadlineAt:new Date(Date.now()+descriptor!.execution.timeoutMs).toISOString()},signal);
  if(result.status!=='ok')throw new Error('error' in result?result.error.message:'数据读取尚未成功。');return result.data;
 };
 const initialize=async(appId:string,source:InvocationSource,storeId?:string,signal?:AbortSignal)=>{
  const listed=await stores(appId,signal),issues=[...listed.issues],board=presentation.getWorkbench(appId);
  if(appId!=='hallmark')return {dataSources:presentation.listDataSources(appId),...listed,context:board.context};
  const requested=storeId??board.context?.storeId;
  if(storeId&&!listed.stores.some(store=>store.id===storeId))fail('所选店铺不属于可用的平台连接。');
  const context:WorkbenchContext|undefined=requested&&listed.stores.some(store=>store.id===requested)?{storeId:requested}:listed.stores[0]?{storeId:listed.stores[0].id}:undefined;
  const aliases=new Map<string,{id:string;revision:number}>();
  const sharedTitle=(title:string)=>{
   for(const name of listed.stores.map(store=>store.name).filter(Boolean))title=title.replace(new RegExp(`(^|[\\s·:：/\\-])${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[\\s·:：/\\-])`,'gi'),'$1');
   return title.replace(/^[\s·:：/\-]+/,'').replace(/\s{2,}/g,' ').trim();
  };
  for(const connection of runtime.listConnections(appId).filter(item=>item.enabled)){
   if('sessionId' in source)runtime.bind({sessionId:source.sessionId,appId,connectionId:connection.connectionId,enabled:true,boundAt:new Date().toISOString()});
   const previous=presentation.listDataSources(appId).filter(item=>item.connectionId===connection.connectionId);
   const drafts:DataSourceDraft[]=[...hallmarkOzonSources(connection.connectionId),createOzonCompositionDraft(connection.connectionId,{version:1,grain:'product',fields:[...DEFAULT_PRODUCT_FIELDS]}),...hallmarkProductSources(connection.connectionId,{id:'',name:''})];
   // Keep the existing collection feature, without making it one of the ten Ozon sources.
   try{const collection=object(await invoke(appId,connection.connectionId,'hallmark.collected.search',{limit:1},source,signal));const first=Array.isArray(collection.items)?collection.items[0] as Record<string,unknown>|undefined:undefined;drafts.push(...hallmarkCollectedSources(connection.connectionId,typeof first?.id==='string'?first.id:undefined));}
   catch(error){issues.push({id:`${connection.connectionId}:collection`,message:error instanceof Error?error.message:String(error)});}
   const installed=presentation.dataSources.installCatalog(drafts);
   for(const old of previous){
    if(old.storeScoped){
     const title=sharedTitle(old.title),description=old.description?sharedTitle(old.description):old.description;
     if(title!==old.title||description!==old.description){const {kind:_kind,revision:_revision,validation:_validation,...draft}=old;const updated=presentation.dataSources.installCatalog([{...draft,title,...(description!==undefined?{description}:{})}])[0];aliases.set(old.id,{id:updated.id,revision:updated.revision});}
     continue;
    }
    const oldStore=typeof old.input.storeId==='string'?old.input.storeId:undefined;
    if(!oldStore)continue;
    let target=old.capabilityId==='hallmark.products.list'?installed.find(item=>item.id===`hallmark:${connection.connectionId}:products`):old.capabilityId==='hallmark.products.skus'?installed.find(item=>item.id===`hallmark:${connection.connectionId}:sku`):undefined;
    if(!target){
     const {storeId:_storeId,store:_store,...input}=old.input;
     const id=`hallmark:${connection.connectionId}:shared:${createHash('sha256').update(JSON.stringify([old.capabilityId,input,old.fields])).digest('hex').slice(0,16)}`;
     const title=sharedTitle(old.title);
     const definition:DataSourceDraft={id,title:title.startsWith('Ozon')?title:`Ozon ${title||'业务数据'}`,...(old.description?{description:sharedTitle(old.description)}:{}),appId,connectionId:connection.connectionId,capabilityId:old.capabilityId,capabilityMajor:old.capabilityMajor,storeScoped:true,input,parameters:old.parameters.filter(parameter=>parameter.name!=='store').map(parameter=>parameter.name==='storeId'?{name:'storeId',label:'店铺',type:'string',required:true,editable:false}:parameter),fields:old.fields,rowsPath:old.rowsPath,operations:old.operations};
     if(!definition.parameters.some(parameter=>parameter.name==='storeId'))definition.parameters.push({name:'storeId',label:'店铺',type:'string',required:true,editable:false});
     try{target=presentation.dataSources.installCatalog([definition])[0];}catch(error){issues.push({id:old.id,message:error instanceof Error?error.message:String(error)});continue;}
    }
    aliases.set(old.id,{id:target.id,revision:target.revision});
   }
  }
  let changed=JSON.stringify(context)!==JSON.stringify(board.context);
  const instances=board.instances.map(value=>{
   const instance=structuredClone(value),refs=instance.dataSources??(instance.dataSource?{[(instance.design as {bindings?:{id:string}[]}).bindings?.[0]?.id??'main']:instance.dataSource}:{});
   let migrated=false;
   for(const ref of Object.values(refs)){const replacement=aliases.get(ref.id);if(replacement){ref.id=replacement.id;ref.revision=replacement.revision;migrated=true;}}
   if(Object.values(refs).some(ref=>presentation.dataSources.get(ref.id,ref.revision)?.storeScoped)){const title=sharedTitle(instance.title);if(title!==instance.title){instance.title=title;changed=true;}}
   if(migrated){changed=true;instance.dataSources=refs;delete instance.dataSource;return clearStoreLocalParams(instance);}return instance;
  });
  if(changed){
   try{presentation.saveWorkbench(appId,{expectedRevision:board.revision,instances,...(context?{context}:{})});}
   catch(error){issues.push({id:'workbench:migration',message:error instanceof Error?error.message:String(error)});return {dataSources:presentation.listDataSources(appId),stores:listed.stores,issues,context:board.context};}
  }
  for(const [id,replacement] of aliases)if(id!==replacement.id)presentation.dataSources.retire(id);
  return {dataSources:presentation.listDataSources(appId),stores:listed.stores,issues,context};
 };
 return {
  async read(resource:string,appIdValue:unknown,signal?:AbortSignal){const appId=app(appIdValue);if(resource==='stores')return stores(appId,signal);if(resource==='workbench')return presentation.getWorkbench(appId);if(resource==='materials')return {materials:MATERIAL_CATALOG,fieldRoles:FIELD_ROLES};if(resource==='dataSources')return {dataSources:presentation.listDataSources(appId)};return fail('未知工作台资源。');},
  async write(input:Record<string,unknown>,signal?:AbortSignal){
   keys(input,['appId','operation','params','sessionId']);const appId=app(input.appId),params=object(input.params);
   if(input.operation==='pinComponent'){keys(params,['componentId','revision','expectedRevision']);return presentation.workbenches.pinComponent(appId,params as unknown as {componentId:string;revision:number;expectedRevision:number});}
   if(input.operation==='unpinComponent'){keys(params,['componentId','expectedRevision']);return presentation.workbenches.unpinComponent(appId,params as unknown as {componentId:string;expectedRevision:number});}
   if(input.operation==='save'){
    keys(params,['expectedRevision','instances','context']);validateWorkbenchContext(params.context);
    const save=params as unknown as SaveWorkbenchInput;
    const hasDraft=Array.isArray(save.instances)&&save.instances.some(instance=>Object.values(instance.dataSources??(instance.dataSource?{main:instance.dataSource}:{})).some(ref=>ref.draft));
    if(!hasDraft)return presentation.saveWorkbench(appId,save);
    if(typeof input.sessionId!=='string'||!input.sessionId)fail('保存新组合需要当前聊天的数据访问上下文。');
    const source:Extract<InvocationSource,{kind:'agent'}>={kind:'agent',sessionId:input.sessionId as string,nativeCallId:randomUUID()};
    for(const instance of save.instances){
     const derived=presentation.workbenches.derive(appId,instance,save.context??presentation.getWorkbench(appId).context);
     for(const binding of derived.view.bindings){const connection=runtime.getConnection(binding.appId,binding.connectionId);if(!connection?.enabled)fail('数据源连接尚未启用。');runtime.bind({sessionId:source.sessionId,appId:binding.appId,connectionId:binding.connectionId,enabled:true,boundAt:new Date().toISOString()});}
    }
    return presentation.workbenches.saveWithDrafts(appId,save,source,signal);
   }
   if(input.operation==='read'){keys(params,['instanceId','refresh','forceRefresh','bindingId','cursor','params','scope','context']);validateWorkbenchContext(params.context);if(params.forceRefresh!==undefined&&typeof params.forceRefresh!=='boolean')fail('刷新选项必须为布尔值。');if(typeof params.instanceId!=='string')fail('需要组件实例编号。');const {instanceId,...read}=params;return presentation.readWorkbenchInstance(appId,instanceId as string,read as ReadWorkbenchInstanceInput,signal);}
   if(input.operation==='preview'||input.operation==='initialize'){
    if(typeof input.sessionId!=='string'||!input.sessionId)fail('请先打开原聊天以准备数据源或预览。');
    const source:InvocationSource={kind:'agent',sessionId:input.sessionId as string,nativeCallId:randomUUID()};
    if(input.operation==='initialize'){keys(params,['storeId']);if(params.storeId!==undefined&&(typeof params.storeId!=='string'||!params.storeId.trim()))fail('店铺编号无效。');return initialize(appId,source,params.storeId as string|undefined,signal);}
    keys(params,['instance','refresh','forceRefresh','bindingId','cursor','params','scope','context']);validateWorkbenchContext(params.context);if(params.forceRefresh!==undefined&&typeof params.forceRefresh!=='boolean')fail('刷新选项必须为布尔值。');const {instance,...read}=params;
    const derived=presentation.workbenches.derive(appId,instance as WorkbenchInstance,params.context as WorkbenchContext|undefined);
    for(const binding of derived.view.bindings){const connection=runtime.getConnection(binding.appId,binding.connectionId);if(!connection?.enabled)fail('数据源连接尚未启用。');runtime.bind({sessionId:source.sessionId,appId:binding.appId,connectionId:binding.connectionId,enabled:true,boundAt:new Date().toISOString()});}
    return presentation.previewWorkbenchInstance(appId,instance as WorkbenchInstance,source,read as ReadWorkbenchInstanceInput,signal);
   }
   return fail('未知工作台操作。');
  },
 };
}
