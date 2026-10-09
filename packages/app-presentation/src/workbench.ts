import {randomUUID} from 'node:crypto';
import {canonicalJson,compileSchema,datasetId} from '../../app-contracts/src/index.ts';
import type {DatasetBinding,InvocationSource,JsonValue} from '../../app-contracts/src/index.ts';
import type {ViewSpec} from '../../presentation/src/types.ts';
import {validateViewSpec} from '../../presentation/src/validation.ts';
import type {AppsBindingData,AppsComponent,AppsPresentationOptions,AppsView,DataSourceDefinition,DataSourceDraft,DataSourceValidation,DatasetSnapshot,ReadWorkbenchInstanceInput,SaveWorkbenchInput,Workbench,WorkbenchInstance,WorkbenchInstanceData,WorkbenchPage,WorkbenchContext,WorkbenchSavedComponent} from './types.ts';
import {DataSourceLibrary,dataSourceDefinitionIssues,dataSourceRows,presentationFailure,resolveDataSourceInput,sampleValidation,valueAtPath} from './data-sources.ts';
import {FIELD_ROLE_MAP,dataSourceCompatibility} from './field-roles.ts';
import {getMaterial,MATERIAL_CATALOG} from './materials/catalog.ts';

type WorkbenchOptions=Pick<AppsPresentationOptions,'store'|'runtime'>&{dataSources:DataSourceLibrary;refreshBinding:(binding:DatasetBinding,source:InvocationSource,signal?:AbortSignal,options?:{forceRefresh?:boolean})=>Promise<DatasetSnapshot>};
const clone=<T>(value:T):T=>structuredClone(value);
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function validateWorkbenchContext(value:unknown):WorkbenchContext|undefined {
  if(value===undefined)return undefined;
  if(!object(value)||Object.keys(value).some(key=>key!=='storeId')||typeof value.storeId!=='string'||!value.storeId.trim())presentationFailure('INVALID_CONTEXT','请选择有效店铺。');
  return {storeId:value.storeId as string};
}
const storeLocalParams=new Set(['storeId','store','productId','productIds','sku','skus','offerId','offerIds','warehouseId','actionId','postingNumber','returnId','cursor','deliveryMethodId']);
export function clearStoreLocalParams(instance:WorkbenchInstance):WorkbenchInstance {
  const next=clone(instance);
  for(const ref of Object.values(next.dataSources??(next.dataSource?{main:next.dataSource}:{}))){
    const delivery=ref.params.planMode==='delivery'||ref.params.planMode===undefined&&typeof ref.params.deliveryMethodId==='string';
    for(const key of Object.keys(ref.params))if(storeLocalParams.has(key)||delivery&&['fixedFeeYuan','logisticsYuanPerKg','commissionPercent'].includes(key))delete ref.params[key];
  }
  return next;
}

export class WorkbenchLibrary {
  private options:WorkbenchOptions;
  private pages=new Map<string,Map<string,{token:string;data?:AppsBindingData;page?:WorkbenchPage}>>();
  private signatures=new Map<string,string>();
  constructor(options:WorkbenchOptions){this.options=options;}
  get(appId:string):Workbench {
    if(!appId?.trim())presentationFailure('INVALID_INPUT','需要应用编号。');
    return clone(this.options.store.get<Workbench>('saved_assets',`workbench:${appId}`)??{kind:'workbench',workbenchId:`workbench:${appId}`,appId,revision:0,instances:[],updatedAt:new Date().toISOString()});
  }
  /** Pinning only records a saved identity; data and source workspaces are untouched. */
  pinComponent(appId:string,input:{componentId:string;revision:number;expectedRevision:number}):Workbench {
    this.validatePinInput(input);
    if(!Number.isSafeInteger(input.revision)||input.revision<1)presentationFailure('INVALID_INPUT','请选择有效的组件版本。');
    return this.options.store.transaction(()=>{
      const current=this.get(appId),latest=this.options.store.get<AppsComponent>('components',input.componentId);
      if(!latest)presentationFailure('COMPONENT_NOT_FOUND','组件已从素材库移除，请重新选择。');
      const component=this.options.store.get<AppsComponent>('component_versions',`${input.componentId}:${input.revision}`)??(latest.revision===input.revision?latest:undefined);
      if(!component)presentationFailure('COMPONENT_REVISION_NOT_FOUND','所选组件版本不存在。');
      if(component.view.bindings.some(binding=>binding.appId!==appId))presentationFailure('COMPONENT_APP_MISMATCH','组件的数据源不属于当前应用。');
      const existing=current.savedComponents?.find(item=>item.componentId===input.componentId);
      if(existing?.revision===input.revision)return current;
      if(current.revision!==input.expectedRevision)presentationFailure('WORKBENCH_CONFLICT','工作台已修改，请重新读取后再添加。');
      const source=component.view.source,order=existing?.position?.order??Math.max(-1,...(current.savedComponents??[]).map((item,index)=>item.position?.order??index))+1;
      const pinned:WorkbenchSavedComponent={componentId:component.componentId,revision:component.revision,title:component.title,position:{order},...(source?{buildId:source.buildId,hasPreview:!!source.preview&&!!source.thumbnail}:{})};
      const savedComponents=existing?current.savedComponents!.map(item=>item.componentId===input.componentId?pinned:item):[...(current.savedComponents??[]),pinned];
      return clone(this.options.store.put('saved_assets',current.workbenchId,{...current,savedComponents,revision:current.revision+1,updatedAt:new Date().toISOString()}));
    });
  }
  unpinComponent(appId:string,input:{componentId:string;expectedRevision:number}):Workbench {
    this.validatePinInput(input);
    return this.options.store.transaction(()=>{
      const current=this.get(appId);
      if(!current.savedComponents?.some(item=>item.componentId===input.componentId))return current;
      if(current.revision!==input.expectedRevision)presentationFailure('WORKBENCH_CONFLICT','工作台已修改，请重新读取后再移除。');
      return clone(this.options.store.put('saved_assets',current.workbenchId,{...current,savedComponents:current.savedComponents.filter(item=>item.componentId!==input.componentId),revision:current.revision+1,updatedAt:new Date().toISOString()}));
    });
  }
  private validatePinInput(input:{componentId:string;expectedRevision:number}):void {
    if(typeof input.componentId!=='string'||!/^[-a-zA-Z0-9_.:]{1,180}$/.test(input.componentId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)presentationFailure('INVALID_INPUT','需要有效组件编号与工作台版本。');
  }
  save(appId:string,input:SaveWorkbenchInput):Workbench {
    if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Array.isArray(input.instances))presentationFailure('INVALID_INPUT','工作台必须提供 expectedRevision 与实例列表。');
    if(new Set(input.instances.map(instance=>instance.instanceId)).size!==input.instances.length)presentationFailure('DUPLICATE_INSTANCE','工作台实例编号不能重复。');
    const currentBefore=this.get(appId),context=validateWorkbenchContext(input.context??currentBefore.context);
    if(input.instances.some(instance=>Object.values(instance.dataSources??(instance.dataSource?{main:instance.dataSource}:{})).some(ref=>ref.draft)))presentationFailure('DATA_SOURCE_DRAFT_UNSAVED','请验证并保存组合数据源后再保存工作台。');
    const switched=!!currentBefore.context&&context?.storeId!==currentBefore.context.storeId;
    const instances=input.instances.map(value=>{const instance=switched?clearStoreLocalParams(value):clone(value);return {...instance,bindings:this.derive(appId,instance,context).view.bindings};});
    return this.options.store.transaction(()=>{
      const current=this.get(appId);if(current.revision!==input.expectedRevision)presentationFailure('WORKBENCH_CONFLICT','工作台已修改，请重新读取后再保存。');
      const next:Workbench={...current,revision:current.revision+1,instances,updatedAt:new Date().toISOString(),...(context?{context}:{})};
      const saved=clone(this.options.store.put('saved_assets',next.workbenchId,next));
      for(const scope of this.pages.keys())if(scope.includes(`:${appId}:`)){this.pages.delete(scope);this.signatures.delete(scope);}
      return saved;
    });
  }
  /** Preview definitions stay transient. Commit sources and the board together only after real validation. */
  async saveWithDrafts(appId:string,input:SaveWorkbenchInput,source:InvocationSource,signal?:AbortSignal):Promise<Workbench> {
    const current=this.get(appId),context=validateWorkbenchContext(input.context??current.context);
    if(current.revision!==input.expectedRevision)presentationFailure('WORKBENCH_CONFLICT','工作台已修改，请重新读取后再保存。');
    if(!Array.isArray(input.instances))presentationFailure('INVALID_INPUT','工作台必须提供实例列表。');
    const switched=!!current.context&&context?.storeId!==current.context.storeId;
    const instances=input.instances.map(instance=>switched?clearStoreLocalParams(instance):clone(instance));
    const pending=new Map<string,{definition:DataSourceDraft;validation:DataSourceValidation;expectedRevision:number;reuse?:DataSourceDefinition}>();
    for(const instance of instances){
      this.derive(appId,instance,context);
      for(const ref of Object.values(instance.dataSources??(instance.dataSource?{main:instance.dataSource}:{}))){
        if(!ref.draft)continue;
        const definition=ref.draft,prior=pending.get(definition.id);
        if(prior){
          if(canonicalJson(prior.definition as unknown as JsonValue)!==canonicalJson(definition as unknown as JsonValue))presentationFailure('DATA_SOURCE_CONFLICT','同一数据源编号包含不同组合，请重新选择。');
          const validation=await this.options.dataSources.validate({definition,context,params:ref.params},source,signal);
          if(validation.status!=='verified')presentationFailure('DATA_SOURCE_VALIDATION_FAILED',validation.issues.join('；'));
          continue;
        }
        const latest=this.options.dataSources.list(appId).find(item=>item.id===definition.id);
        const draftOf=(value:DataSourceDefinition)=>{const {kind:_kind,revision:_revision,validation:_validation,...draft}=value;return draft;};
        const same=latest&&canonicalJson(draftOf(latest) as unknown as JsonValue)===canonicalJson(definition as unknown as JsonValue);
        if(latest&&!same&&ref.revision!==latest.revision)presentationFailure('DATA_SOURCE_CONFLICT','组合数据源已更新，请重新读取后再保存。');
        const validation=await this.options.dataSources.validate({definition,context,params:ref.params},source,signal);
        if(validation.status!=='verified')presentationFailure('DATA_SOURCE_VALIDATION_FAILED',validation.issues.join('；'));
        pending.set(definition.id,{definition,validation,expectedRevision:latest?.revision??0,...(same?{reuse:latest}:{})});
      }
    }
    return this.options.store.transaction(()=>{
      if(this.get(appId).revision!==input.expectedRevision)presentationFailure('WORKBENCH_CONFLICT','验证期间工作台已修改，请重新读取后保存。');
      const registered=new Map<string,DataSourceDefinition>();
      for(const [id,item] of pending){
        const latest=this.options.dataSources.list(appId).find(value=>value.id===id);
        if((latest?.revision??0)!==item.expectedRevision)presentationFailure('DATA_SOURCE_CONFLICT','验证期间组合已更新，请重新读取后保存。');
        const saved=item.reuse??this.options.dataSources.commit({definition:item.definition,expectedRevision:item.expectedRevision},item.validation);
        this.options.dataSources.recordValidation(saved,item.validation);registered.set(id,saved);
      }
      for(const instance of instances)for(const ref of Object.values(instance.dataSources??(instance.dataSource?{main:instance.dataSource}:{}))){if(!ref.draft)continue;const saved=registered.get(ref.draft.id)!;ref.id=saved.id;ref.revision=saved.revision;delete ref.draft;}
      return this.save(appId,{...input,instances,...(context?{context}:{})});
    });
  }
  derive(appId:string,instance:WorkbenchInstance,context:WorkbenchContext|undefined=this.get(appId).context):{view:AppsView;dataSources:Record<string,DataSourceDefinition>} {
    context=validateWorkbenchContext(context);
    if(!instance.instanceId?.trim()||!instance.title?.trim()||!Number.isFinite(instance.position?.order))presentationFailure('INVALID_INSTANCE','组件需要编号、标题和布局位置。');
    const material=getMaterial(instance.materialId);if(!material||material.version!==instance.materialVersion)presentationFailure('MATERIAL_UNAVAILABLE','素材或对应版本不可用。');
    const design=clone(instance.design) as unknown as ViewSpec;
    validateViewSpec(design);
    if(!object(design)||!Array.isArray(design.widgets)||!Array.isArray(design.bindings)||!design.layout)presentationFailure('INVALID_DESIGN','组件需要完整的原生 ViewSpec。');
    const moduleTypes=new Set(MATERIAL_CATALOG.filter(item=>item.category==='module').flatMap(item=>item.widgetTypes));
    if(design.kind==='source'||design.widgets.some(widget=>!moduleTypes.has(widget.type)))presentationFailure('INVALID_DESIGN','工作台仅接受素材库已登记的原生模块。');
    const refs=instance.dataSources??(instance.dataSource?{[design.bindings[0]?.id??'main']:instance.dataSource}:{});
    const dataSources:Record<string,DataSourceDefinition>={},bindings:DatasetBinding[]=[];
    for(const legacy of design.bindings){
      if(!design.widgets.some(widget=>widget.bindingId===legacy.id))continue;
      const ref=refs[legacy.id];if(!ref)presentationFailure('DATA_SOURCE_REQUIRED',`请选择 ${legacy.id} 的数据源。`);
      if(!Number.isSafeInteger(ref.revision)||ref.revision<1)presentationFailure('DATA_SOURCE_REVISION_REQUIRED','数据源引用必须明确指定正整数版本，请重新选择数据源。');
      if(!object(ref.params))presentationFailure('INVALID_INPUT','数据源查询参数必须是对象。');
      let definition:DataSourceDefinition;
      if(ref.draft){
        if(ref.draft.id!==ref.id)presentationFailure('INVALID_DATA_SOURCE','组合草稿编号与引用不一致。');
        const issues=dataSourceDefinitionIssues(ref.draft,this.options.runtime.describe(ref.draft.capabilityId));
        if(issues.length)presentationFailure('INVALID_DATA_SOURCE',issues.join('；'));
        definition={...clone(ref.draft),kind:'data_source',revision:ref.revision,validation:{status:'unverified',checkedAt:new Date().toISOString(),sampleCount:0,issues:[]}};
      }else definition=this.options.dataSources.get(ref.id,ref.revision);
      // Keep historical mappings/settings while adopting complete snapshots for
      // providers that explicitly support them. Other APIs retain their contract.
      const fullProcurement=definition.capabilityId==='hallmark.products.procurement'&&design.widgets.some(widget=>widget.bindingId===legacy.id&&widget.type==='product_list'&&widget.options?.materialId==='product-procurement');
      const inputProperties=this.options.runtime.describe(definition.capabilityId)?.inputSchema.properties as Record<string,{type?:string}>|undefined;
      const fullOzon=definition.capabilityId.startsWith('hallmark.ozon.')&&inputProperties?.loadAll?.type==='boolean';
      if(fullProcurement||fullOzon){
        definition=clone(definition);
        for(const key of ['cursor','limit',...(fullProcurement?['query']:[])])delete definition.input[key];
        definition.input.loadAll=true;
        definition.operations={search:{scope:'loaded'},sort:{scope:'loaded'}};
      }
      dataSources[legacy.id]=definition;
      if(definition.appId!==appId)presentationFailure('DATA_SOURCE_APP_MISMATCH','数据源不属于当前应用。');
      const names=new Set(definition.parameters.filter(parameter=>parameter.editable!==false).map(parameter=>parameter.name));
      for(const key of Object.keys(ref.params??{}))if(!names.has(key))presentationFailure('PARAMETER_NOT_ALLOWED',`查询参数 ${key} 未声明。`);
      if(definition.storeScoped&&!context)presentationFailure('STORE_CONTEXT_REQUIRED','请先选择工作台店铺。');
      const input=resolveDataSourceInput(definition,ref.params??{},context),descriptor=this.options.runtime.describe(definition.capabilityId);
      if(fullProcurement||fullOzon){
        input.loadAll=true;
        // query remains on the saved reference for the table's local search.
        for(const key of ['cursor','limit',...(fullProcurement?['query']:[])])delete input[key];
      }
      if(!descriptor||Number(descriptor.version.split('.')[0])!==definition.capabilityMajor)presentationFailure('CAPABILITY_UNAVAILABLE','数据源能力不可用。');
      if(!['query','compute'].includes(descriptor.effect))presentationFailure('QUERY_NOT_READ_ONLY','工作台不允许写入业务数据。');
      const validationInput={...input};
      for(const parameter of definition.parameters.filter(parameter=>parameter.linked&&(design.links??[]).some(link=>link.to.bindingId===legacy.id&&link.to.param===parameter.name)))if(validationInput[parameter.name]===undefined)validationInput[parameter.name]=parameter.type==='string'?'awaiting-selection':1;
      const awaiting=definition.parameters.filter(parameter=>parameter.name!=='storeId'&&storeLocalParams.has(parameter.name)&&((descriptor.inputSchema.required as string[]|undefined)??[]).includes(parameter.name)&&input[parameter.name]===undefined);
      const inputSchema={...descriptor.inputSchema,required:((descriptor.inputSchema.required as string[]|undefined)??[]).filter(name=>!awaiting.some(parameter=>parameter.name===name))};
      const errors=compileSchema(inputSchema)(validationInput);if(errors.length)presentationFailure('INVALID_INPUT',errors.join('; '));
      const binding:DatasetBinding={bindingId:legacy.id,appId:definition.appId,connectionId:definition.connectionId,capabilityId:definition.capabilityId,capabilityMajor:definition.capabilityMajor,input,projection:[],refresh:{mode:'manual'}};binding.datasetId=datasetId(binding);bindings.push(binding);
      const confirmed=definition.fields.filter(field=>field.confirmed),fieldMap=Object.fromEntries(confirmed.map(field=>[field.key??field.role,field.path]));
      const fieldMeta=Object.fromEntries(confirmed.map(field=>{const {key:_,...meta}=FIELD_ROLE_MAP[field.role]??{};return [field.key??field.role,{...meta,...field,label:field.label??FIELD_ROLE_MAP[field.role]?.label??field.role}];}));
      for(const field of confirmed)if(confirmed.filter(item=>item.role===field.role).length===1&&!Object.hasOwn(fieldMap,field.role)){fieldMap[field.role]=field.path;fieldMeta[field.role]=fieldMeta[field.key??field.role];}
      legacy.fieldMap=fieldMap;legacy.datasetKey=binding.datasetId;delete legacy.query;
      for(const widget of design.widgets.filter(widget=>widget.bindingId===legacy.id)) {
        const roles=getMaterial(widget.type==='sku_detail'?'sku-detail':widget.type==='table'?(instance.materialId==='data-table'||widget.options?.materialId==='data-table'?'data-table':'activity-list'):'product-list')!.requiredRoles;
        const compatibility=dataSourceCompatibility(definition,roles);if(!compatibility.compatible)presentationFailure('INCOMPATIBLE_DATA_SOURCE',`数据源缺少：${compatibility.missingRoles.map(role=>FIELD_ROLE_MAP[role]?.label??role).join('、')}`);
        widget.fields=fieldMap;
        widget.options={...widget.options,rowsPath:definition.rowsPath,fieldMeta,example:false};
        if(widget.type==='table'&&(instance.materialId==='data-table'||widget.options.materialId==='data-table')&&!widget.columns?.length&&!Array.isArray(widget.options.displayColumns))widget.columns=confirmed.filter(field=>FIELD_ROLE_MAP[field.role]?.format!=='image').slice(0,8).map(field=>({field:field.key??field.role,label:field.label??FIELD_ROLE_MAP[field.role]?.label??field.role}));
        if(widget.type==='sku_detail')widget.options.requiresSelection=(design.links??[]).some(link=>link.to.bindingId===legacy.id)||awaiting.length>0;
      }
    }
    for(const link of design.links??[]){
      const definition=dataSources[link.to.bindingId],parameters=definition?.parameters.filter(parameter=>parameter.linked)??[];
      if(!parameters.some(parameter=>parameter.name===link.to.param)&&parameters.length===1)link.to.param=parameters[0].name;
      if(!parameters.some(parameter=>parameter.name===link.to.param))presentationFailure('LINK_PARAMETER_NOT_ALLOWED','联动目标参数未由数据源声明。');
      if(!design.widgets.some(widget=>widget.id===link.from.widgetId&&widget.fields?.[link.from.field]))presentationFailure('LINK_SOURCE_NOT_FOUND','联动来源字段不可用。');
    }
    if(!bindings.length)presentationFailure('DATA_SOURCE_REQUIRED','组件至少需要一个数据绑定。');
    validateViewSpec(design);
    const now=new Date().toISOString();
    const sourceRefs=Object.fromEntries(Object.entries(refs).filter(([,ref])=>!ref.draft).map(([id,ref])=>[id,clone(ref)]));
    return {view:{viewId:`workbench:${appId}:${instance.instanceId}`,ownerSessionId:null,title:instance.title,design:design as unknown as JsonValue,bindings,...(Object.keys(sourceRefs).length?{sourceRefs}:{}),...(context?{context}:{}),createdAt:now,updatedAt:now},dataSources};
  }
  private bindingData(binding:DatasetBinding,snapshot?:DatasetSnapshot):AppsBindingData {
    const descriptor=this.options.runtime.describe(binding.capabilityId);
    return {bindingId:binding.bindingId,appId:binding.appId,connectionId:binding.connectionId,datasetId:binding.datasetId??datasetId(binding),revision:snapshot?.revision??null,payload:clone(snapshot?.payload??null),resources:clone(snapshot?.resources??[]),freshness:snapshot?.freshness??'unknown',state:snapshot?.state??'empty',lastSuccessAt:snapshot?.lastSuccessAt??null,sourceDataTime:snapshot?.sourceDataTime??null,provenance:clone(snapshot?.provenance??[]),...(snapshot?.error?{error:clone(snapshot.error)}:{}),...(descriptor?{query:{appId:binding.appId,connectionId:binding.connectionId,capabilityId:binding.capabilityId,capabilityVersion:descriptor.version,input:clone(binding.input),projection:clone(binding.projection)}}:{})};
  }
  private page(binding:DatasetBinding,definition:DataSourceDefinition,data:AppsBindingData):WorkbenchPage {
    const pagination=definition.operations.pagination,payload=data.payload,next=pagination?valueAtPath(payload,pagination.nextCursorPath??'cursor'):null,total=valueAtPath(payload,pagination?.totalPath??'total');
    const cursor=pagination?(binding.input as Record<string,JsonValue>)[pagination.cursorParam]:null;
    return {cursor:typeof cursor==='string'?cursor:null,nextCursor:typeof next==='string'&&next?next:null,hasMore:typeof next==='string'&&!!next,...(typeof total==='number'?{total}:{}),loadedCount:dataSourceRows(payload,definition.rowsPath).length};
  }
  private async load(appId:string,instance:WorkbenchInstance,source:InvocationSource,input:ReadWorkbenchInstanceInput={},signal?:AbortSignal,stillCurrent:()=>void=()=>{}):Promise<WorkbenchInstanceData> {
    const context=input.context??this.get(appId).context,scope=`${source.kind}:${appId}:${instance.instanceId}:${input.scope??'default'}`;
    const previousSignature=this.signatures.get(scope),previousStore=previousSignature?(JSON.parse(previousSignature) as {context?:WorkbenchContext}).context?.storeId:undefined;
    if(previousStore&&context?.storeId!==previousStore)instance=clearStoreLocalParams(instance);
    const derived=this.derive(appId,instance,context),{view,dataSources}=derived;
    const signature=canonicalJson({context:context??null,materialId:instance.materialId,materialVersion:instance.materialVersion,design:instance.design,dataSources:instance.dataSources??instance.dataSource??null});
    if(this.signatures.get(scope)!==signature){this.pages.delete(scope);this.signatures.set(scope,signature);}
    let scoped=this.pages.get(scope);if(!scoped){scoped=new Map();this.pages.set(scope,scoped);}
    if(input.bindingId&&!view.bindings.some(binding=>binding.bindingId===input.bindingId))presentationFailure('BINDING_NOT_FOUND','组件中不存在该绑定。');
    if((input.cursor!==undefined||input.params)&&!input.bindingId)presentationFailure('BINDING_REQUIRED','翻页和联动必须指定绑定。');
    const results=await Promise.all(view.bindings.map(async base=>{
      const definition=dataSources[base.bindingId],target=!input.bindingId||input.bindingId===base.bindingId;
      const previous=scoped!.get(base.bindingId);
      let binding=clone(base);
      const requiresSelection=(view.design as unknown as ViewSpec).widgets.some(widget=>widget.bindingId===base.bindingId&&widget.options?.requiresSelection);
      const refreshAll=!input.bindingId&&input.refresh!==false;
      // Scoped query state is valid only while the signature above is unchanged.
      // Refresh retains current filters/selection and returns each binding to page one.
      if((requiresSelection||refreshAll)&&previous?.data?.query)binding.input=clone(previous.data.query.input);
      if(refreshAll&&definition.operations.pagination)delete (binding.input as Record<string,JsonValue>)[definition.operations.pagination.cursorParam];
      const linked=new Set(((view.design as unknown as ViewSpec).links??[]).filter(link=>link.to.bindingId===base.bindingId).map(link=>link.to.param));
      if(target&&input.params){
        if(!object(input.params))presentationFailure('INVALID_INPUT','筛选与联动参数必须是对象。');
        const allowed=new Set([...definition.parameters.filter(parameter=>parameter.linked&&linked.has(parameter.name)).map(parameter=>parameter.name),...(definition.operations.search.scope==='server'&&definition.operations.search.param?[definition.operations.search.param]:[]),...(definition.operations.sort.scope==='server'?[definition.operations.sort.param,definition.operations.sort.directionParam].filter((value):value is string=>!!value):[])]);
        for(const key of Object.keys(input.params))if(!allowed.has(key))presentationFailure('PARAMETER_NOT_ALLOWED',`参数 ${key} 不允许由联动或筛选覆盖。`);
        binding.input={...base.input as Record<string,JsonValue>,...input.params};
      }
      if(target&&input.cursor!==undefined){
        const pagination=definition.operations.pagination;if(!pagination)presentationFailure('PAGINATION_UNAVAILABLE','数据源不支持服务端分页。');
        const current=previous?.data?.query?.input as Record<string,JsonValue>|undefined;
        binding.input={...(current??binding.input as Record<string,JsonValue>),...input.params};
        if(input.cursor===null)delete (binding.input as Record<string,JsonValue>)[pagination.cursorParam];else (binding.input as Record<string,JsonValue>)[pagination.cursorParam]=input.cursor;
      }
      // An empty search means no filter. Normalize after merging page state so
      // a previous query cannot be restored, and optional minLength APIs accept it.
      const search=definition.operations.search;
      if(target&&search.scope==='server'&&search.param){
        const query=binding.input as Record<string,JsonValue>,value=query[search.param];
        if(typeof value==='string'&&!value.trim())delete query[search.param];
      }
      if(definition.capabilityId==='hallmark.products.procurement'&&(view.design as unknown as ViewSpec).widgets.some(widget=>widget.bindingId===base.bindingId&&widget.type==='product_list'&&widget.options?.materialId==='product-procurement')){
        binding.input={...binding.input as Record<string,JsonValue>,loadAll:true};
        for(const key of ['cursor','limit','query'])delete (binding.input as Record<string,JsonValue>)[key];
      }
      if(definition.capabilityId.startsWith('hallmark.ozon.')&&definition.input.loadAll===true){
        binding.input={...binding.input as Record<string,JsonValue>,loadAll:true};
        for(const key of ['cursor','limit'])delete (binding.input as Record<string,JsonValue>)[key];
      }
      binding.datasetId=datasetId(binding);
      const selectionSupplied=!!input.params&&Object.keys(input.params).some(key=>linked.has(key));
      const needsRead=target&&(input.refresh!==false||input.cursor!==undefined||input.params!==undefined)&&(!requiresSelection||selectionSupplied||!!previous?.data);
      if(!needsRead){const data=previous?.data??this.bindingData(binding,requiresSelection?undefined:this.options.store.get('datasets',binding.datasetId));return {data,page:previous?.page??this.page(binding,definition,data)};}
      const entry={token:randomUUID(),data:previous?.data,page:previous?.page};scoped!.set(base.bindingId,entry);
      try{
        const snapshot=await this.options.refreshBinding(binding,source,signal,{forceRefresh:input.forceRefresh===true});stillCurrent();
        if(this.pages.get(scope)?.get(base.bindingId)!==entry)presentationFailure('PAGE_SUPERSEDED','较新的请求已替换本次结果。');
        const data=this.bindingData(binding,snapshot),page=this.page(binding,definition,data);entry.data=data;entry.page=page;
        const ref=instance.dataSources?.[binding.bindingId]??instance.dataSource;
        if(!ref?.draft)this.options.dataSources.recordValidation(definition,snapshot.state==='ready'?{...sampleValidation(definition,snapshot.payload,binding.datasetId!,this.options.runtime.describe(definition.capabilityId)),...(definition.storeScoped&&context?{storeId:context.storeId}:{})}:{status:'failed',checkedAt:new Date().toISOString(),sampleCount:0,issues:[snapshot.error?.message??'读取未成功。'],...(definition.storeScoped&&context?{storeId:context.storeId}:{})});
        return {data,page};
      }catch(error){
        stillCurrent();
        if(this.pages.get(scope)?.get(base.bindingId)!==entry)presentationFailure('PAGE_SUPERSEDED','较新的请求已替换本次结果。');
        if((error as {code?:string}).code==='PAGE_SUPERSEDED')throw error;
        const data={...this.bindingData(binding),state:'unavailable' as const,error:{code:(error as {code?:string}).code??'REFRESH_FAILED',message:error instanceof Error?error.message:String(error),retryPolicy:'never' as const}};
        return {data,page:this.page(binding,definition,data)};
      }
    }));
    return {instanceId:instance.instanceId,view,data:{viewId:view.viewId,bindings:results.map(result=>result.data)},dataSources,dataSource:Object.values(dataSources)[0],pages:Object.fromEntries(results.map(result=>[result.data.bindingId,result.page]))};
  }
  async read(appId:string,instanceId:string,input:ReadWorkbenchInstanceInput={},signal?:AbortSignal):Promise<WorkbenchInstanceData> {
    const workbench=this.get(appId),instance=workbench.instances.find(item=>item.instanceId===instanceId);if(!instance)presentationFailure('INSTANCE_NOT_FOUND','工作台实例不存在。');
    if(input.context&&input.context.storeId!==workbench.context?.storeId)presentationFailure('PAGE_SUPERSEDED','所选店铺已变化，请重新读取工作台。');
    const stillCurrent=()=>{const current=this.get(appId);if(current.revision!==workbench.revision)presentationFailure('PAGE_SUPERSEDED','工作台已更新，本次数据响应已过期。');};
    return this.load(appId,instance,{kind:'workbench',workbenchId:workbench.workbenchId,instanceId},input,signal,stillCurrent);
  }
  async preview(appId:string,instance:WorkbenchInstance,source:InvocationSource,input:ReadWorkbenchInstanceInput={},signal?:AbortSignal):Promise<WorkbenchInstanceData> {
    if(!('sessionId' in source))presentationFailure('SESSION_REQUIRED','预览需要当前聊天的数据访问上下文。');
    return this.load(appId,instance,source,{...input,scope:`preview:${source.sessionId}:${input.scope??'default'}`},signal);
  }
}
