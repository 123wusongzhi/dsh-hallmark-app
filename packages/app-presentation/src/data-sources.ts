import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson,compileSchema} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,InvocationRequest,InvocationSource,JsonSchema,JsonValue} from '../../app-contracts/src/index.ts';
import type {AppsPresentationOptions,DataSourceDefinition,DataSourceDraft,DataSourceValidation,RegisterDataSourceInput,WorkbenchContext} from './types.ts';
import {FIELD_ROLE_MAP} from './field-roles.ts';
import {queryRows} from './store-query.ts';

const string:JsonSchema={type:'string',minLength:1};
export const DATA_SOURCE_DRAFT_SCHEMA:JsonSchema={type:'object',properties:{
  id:string,title:string,description:{type:'string'},appId:string,connectionId:string,capabilityId:string,capabilityMajor:{type:'integer',minimum:1},storeScoped:{type:'boolean'},input:{type:'object'},rowsPath:{type:'string'},
  parameters:{type:'array',items:{type:'object',properties:{name:string,label:string,type:{enum:['string','number','integer','boolean']},required:{type:'boolean'},default:{},linked:{type:'boolean'},editable:{type:'boolean'},choices:{type:'array',minItems:1,items:{type:'object',properties:{label:string,value:{type:['string','number','boolean']}},required:['label','value'],additionalProperties:false}}},required:['name','label','type'],additionalProperties:false}},
  fields:{type:'array',minItems:1,items:{type:'object',properties:{key:string,origin:{type:'object',properties:{source:string,label:string},required:['source','label'],additionalProperties:false},path:string,role:string,confirmed:{type:'boolean'},label:string,description:{type:'string'},unit:string,currency:string,currencyPath:string,percentScale:{enum:['fraction','whole']},numericScale:{type:'number',exclusiveMinimum:0}},required:['path','role','confirmed'],additionalProperties:false}},
  operations:{type:'object',properties:{pagination:{type:'object',properties:{cursorParam:string,limitParam:string,nextCursorPath:string,totalPath:string},required:['cursorParam'],additionalProperties:false},search:{type:'object',properties:{scope:{enum:['server','loaded']},param:string},required:['scope'],additionalProperties:false},sort:{type:'object',properties:{scope:{enum:['server','loaded']},param:string,directionParam:string},required:['scope'],additionalProperties:false}},required:['search','sort'],additionalProperties:false},
},required:['id','title','appId','connectionId','capabilityId','capabilityMajor','input','parameters','fields','rowsPath','operations'],additionalProperties:false};
export const DATA_SOURCE_VALIDATION_SCHEMA:JsonSchema={type:'object',properties:{status:{enum:['verified','failed','unverified']},checkedAt:string,invocationId:string,sampleCount:{type:'integer',minimum:0},issues:{type:'array',items:string},empty:{type:'boolean'},storeId:string},required:['status','checkedAt','sampleCount','issues'],additionalProperties:false};
export const DATA_SOURCE_SCHEMA:JsonSchema={...DATA_SOURCE_DRAFT_SCHEMA,properties:{...(DATA_SOURCE_DRAFT_SCHEMA as {properties:Record<string,JsonSchema>}).properties,kind:{const:'data_source'},revision:{type:'integer',minimum:1},validation:DATA_SOURCE_VALIDATION_SCHEMA},required:[...(DATA_SOURCE_DRAFT_SCHEMA as {required:string[]}).required,'kind','revision','validation']};

export function valueAtPath(value:unknown,path:string):unknown {
  if(!path)return value;
  return path.split('.').reduce<unknown>((current,key)=>current!==null&&typeof current==='object'?Object.prototype.hasOwnProperty.call(current,key)?(current as Record<string,unknown>)[key]:undefined:undefined,value);
}
export function dataSourceRows(payload:unknown,rowsPath:string):unknown[] {
  const value=valueAtPath(payload,rowsPath);
  return Array.isArray(value)?value:value!==null&&typeof value==='object'?[value]:[];
}
export function dataSourceDefinitionIssues(definition:DataSourceDraft,descriptor?:CapabilityDescriptor):string[] {
  const issues=compileSchema(DATA_SOURCE_DRAFT_SCHEMA)(definition);if(issues.length)return issues;
  if(!descriptor)issues.push('数据能力尚未登记。');
  else {
    if(!['query','compute'].includes(descriptor.effect)||/^apps\.(presentation|authoring)\./.test(definition.capabilityId))issues.push('数据源只允许读取业务能力。');
    if(Number(descriptor.version.split('.')[0])!==definition.capabilityMajor)issues.push('能力主版本不匹配。');
    // A reusable definition declares inputs to collect later; it does not pin a
    // shop, a date window or a selected product merely to satisfy registration.
    const template=resolveDataSourceInput(definition,{},definition.storeScoped?{storeId:'validation-store'}:undefined);
    const templateSchema={...descriptor.inputSchema,required:((descriptor.inputSchema.required as string[]|undefined)??[]).filter(name=>template[name]!==undefined||!definition.parameters.some(parameter=>parameter.name===name))};
    issues.push(...compileSchema(templateSchema)(template));
    const declared=(descriptor.inputSchema as {properties?:Record<string,JsonSchema>}).properties??{};
    for(const parameter of definition.parameters){
      if(!Object.hasOwn(declared,parameter.name)){issues.push(`查询参数 ${parameter.name} 不在能力声明中。`);continue;}
      const validateChoice=compileSchema(declared[parameter.name]);
      for(const choice of parameter.choices??[])if(validateChoice(choice.value).length)issues.push(`查询参数 ${parameter.name} 的选项「${choice.label}」不符合能力声明。`);
    }
  }
  for(const parameter of definition.parameters){
    const validateType=compileSchema({type:parameter.type});
    for(const choice of parameter.choices??[])if(validateType(choice.value).length)issues.push(`查询参数 ${parameter.name} 的选项「${choice.label}」与参数类型不匹配。`);
  }
  if(new Set(definition.parameters.map(parameter=>parameter.name)).size!==definition.parameters.length)issues.push('查询参数名称不能重复。');
  if(definition.storeScoped){
    const parameter=definition.parameters.find(item=>item.name==='storeId');
    if(!parameter||parameter.editable!==false||!parameter.required)issues.push('店铺上下文须声明为不可编辑的必需 storeId 参数。');
    if(Object.hasOwn(definition.input,'storeId')||parameter?.default!==undefined)issues.push('共享数据源不能保存具体店铺。');
  }
  if(new Set(definition.fields.map(field=>field.key??field.role)).size!==definition.fields.length)issues.push('字段标识不能重复映射。');
  for(const field of definition.fields) {
    const role=FIELD_ROLE_MAP[field.role];
    if(!role){issues.push(`未知语义字段：${field.role}`);continue;}
    if(!field.confirmed)continue;
    if(role.format==='currency'&&!field.currency&&!field.currencyPath&&!definition.fields.some(item=>item.confirmed&&item.role==='price.currency'))issues.push(`${role.label} 必须说明币种或币种字段。`);
    if(role.format==='percent'&&!field.percentScale)issues.push(`${role.label} 必须说明百分比比例。`);
    if(field.role.startsWith('metric.')&&!field.description)issues.push(`${role.label} 必须说明统计时间及口径。`);
  }
  const names=new Set(definition.parameters.map(parameter=>parameter.name));
  const used=[definition.operations.pagination?.cursorParam,definition.operations.pagination?.limitParam,definition.operations.search.scope==='server'?definition.operations.search.param:undefined,definition.operations.sort.scope==='server'?definition.operations.sort.param:undefined,definition.operations.sort.directionParam].filter((name):name is string=>!!name);
  for(const name of used)if(!names.has(name))issues.push(`数据操作参数 ${name} 未声明。`);
  if(definition.operations.search.scope==='server'&&!definition.operations.search.param)issues.push('服务端搜索需要明确参数。');
  if(definition.operations.sort.scope==='server'&&!definition.operations.sort.param)issues.push('服务端排序需要明确参数。');
  return issues;
}
export function resolveDataSourceInput(definition:DataSourceDraft,params:Record<string,JsonValue>,context?:WorkbenchContext):Record<string,JsonValue> {
  const input={...definition.input};
  for(const parameter of definition.parameters)if(parameter.default!==undefined&&input[parameter.name]===undefined)input[parameter.name]=parameter.default;
  return {...input,...params,...(definition.storeScoped&&context?{storeId:context.storeId}:{})};
}
function schemaAt(schema:JsonSchema|undefined,path:string):JsonSchema|undefined {
  let node=schema;
  for(const key of path.split('.').filter(Boolean))node=(node?.properties as Record<string,JsonSchema>|undefined)?.[key];
  return node;
}
export function sampleValidation(definition:DataSourceDraft,payload:unknown,invocationId:string,descriptor?:CapabilityDescriptor):DataSourceValidation {
  const rows=dataSourceRows(payload,definition.rowsPath),issues:string[]=[];
  if(valueAtPath(payload,'cache.stale')===true)issues.push('接口尚未完成最新读取，当前为过期缓存；请更新成功后再验证保存。');
  const rowSchema=schemaAt(descriptor?.outputSchema,definition.rowsPath)?.items as JsonSchema|undefined;
  const declaredEmpty=!rows.length&&Array.isArray(valueAtPath(payload,definition.rowsPath))&&!!descriptor&&!compileSchema(descriptor.outputSchema)(payload).length&&definition.fields.filter(field=>field.confirmed).every(field=>!!schemaAt(rowSchema,field.path));
  if(!rows.length&&!declaredEmpty)issues.push('真实返回没有可验证的样本，尚不能确认字段映射。');
  for(const field of definition.fields.filter(field=>field.confirmed)) {
    if(!declaredEmpty&&!rows.some(row=>valueAtPath(row,field.path)!==undefined))issues.push(`字段路径 ${field.path} 未出现在真实样本中。`);
    const role=FIELD_ROLE_MAP[field.role];
    if(role?.format==='currency'&&!field.currency&&rows.some(row=>valueAtPath(row,field.path)!=null)) {
      const currencyPath=field.currencyPath??definition.fields.find(item=>item.role==='price.currency'&&item.confirmed)?.path;
      if(!currencyPath||!rows.some(row=>typeof valueAtPath(row,currencyPath)==='string'&&String(valueAtPath(row,currencyPath)).trim()))issues.push(`${role.label} 的币种无法从样本确认。`);
    }
  }
  if(!definition.fields.some(field=>field.confirmed))issues.push('至少需要一个已确认语义的字段。');
  return {status:issues.length?'failed':'verified',checkedAt:new Date().toISOString(),invocationId,sampleCount:rows.length,issues,...(declaredEmpty?{empty:true}:{})};
}

export function presentationFailure(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
const fingerprint=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const registrationSourceFingerprint=(source:InvocationSource)=>fingerprint(source.kind==='agent'?{kind:source.kind,sessionId:source.sessionId}:source);
function mappingFingerprint(definition:DataSourceDraft|DataSourceDefinition):string {
  return fingerprint(Object.fromEntries(Object.entries(definition).filter(([key])=>!['title','description','kind','revision','validation'].includes(key))));
}
interface RegistrationProof {mapping:string;descriptor:string;validation:string;source:string;sampling:string}

/** Stores only verified, declarative adapters to registered Runtime capabilities. */
export class DataSourceLibrary {
  private options:Pick<AppsPresentationOptions,'store'|'runtime'|'dataSources'>;
  private registrationProofs=new WeakMap<DataSourceValidation,RegistrationProof>();
  constructor(options:Pick<AppsPresentationOptions,'store'|'runtime'|'dataSources'>){this.options=options;}
  list(appId?:string):DataSourceDefinition[] {
    return structuredClone(queryRows<DataSourceDefinition>(this.options.store,'saved_assets',{kind:'data_source',...(appId?{appId}:{})}));
  }
  suggestions(appId?:string):DataSourceDraft[] {return structuredClone((this.options.dataSources?.()??[]).filter(item=>!appId||item.appId===appId));}
  get(id:string,revision?:number):DataSourceDefinition {
    const latest=this.options.store.get<DataSourceDefinition>('saved_assets',`data_source:${id}`);
    const value=revision!==undefined&&latest?.revision!==revision?this.options.store.get<DataSourceDefinition>('saved_assets',`data_source_revision:${id}:${revision}`):latest;
    if(!value) presentationFailure('DATA_SOURCE_NOT_FOUND','数据源不存在。');
    return {...structuredClone(value),kind:'data_source'};
  }
  async validate(input:RegisterDataSourceInput,source:InvocationSource,signal?:AbortSignal):Promise<DataSourceValidation> {
    const definition=input.definition,descriptor=this.options.runtime.describe(definition?.capabilityId);
    const issues=dataSourceDefinitionIssues(definition,descriptor);
    if(input.params){
      const allowed=new Set(definition?.parameters?.filter(parameter=>parameter.editable!==false&&parameter.name!=='storeId').map(parameter=>parameter.name));
      for(const name of Object.keys(input.params))if(!allowed.has(name))issues.push(`查询参数 ${name} 未声明或不可编辑。`);
    }
    if(issues.length)return {status:'failed',checkedAt:new Date().toISOString(),sampleCount:0,issues};
    const request:InvocationRequest={protocolVersion:'1.0',appId:definition.appId,connectionId:definition.connectionId,capabilityId:definition.capabilityId,capabilityVersion:descriptor!.version,input:resolveDataSourceInput(definition,input.params??{},input.context),source,invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+descriptor!.execution.timeoutMs).toISOString()};
    try {
      const result=await this.options.runtime.invoke(request,signal);
      if(result.status!=='ok')return {status:'failed',checkedAt:new Date().toISOString(),invocationId:request.invocationId,sampleCount:0,issues:[result.status==='partial'?'接口返回不完整，需确认后重新验证。':'error' in result?result.error.message:`数据能力返回 ${result.status}。`]};
      const validation={...sampleValidation(definition,result.data,request.invocationId,descriptor),...(input.context?{storeId:input.context.storeId}:{})};
      if(validation.status==='verified')this.registrationProofs.set(validation,{mapping:mappingFingerprint(definition),descriptor:fingerprint(descriptor),validation:fingerprint(validation),source:registrationSourceFingerprint(source),sampling:fingerprint({params:input.params??{},context:input.context??null})});
      return validation;
    }catch(error){return {status:'failed',checkedAt:new Date().toISOString(),invocationId:request.invocationId,sampleCount:0,issues:[error instanceof Error?error.message:String(error)]};}
  }
  /** Reuse mapping facts for a label-only edit; explicit validate() always performs the real read. */
  async validateRegistration(input:RegisterDataSourceInput,source:InvocationSource,signal?:AbortSignal):Promise<DataSourceValidation> {
    const definition=input.definition,descriptor=this.options.runtime.describe(definition?.capabilityId),issues=dataSourceDefinitionIssues(definition,descriptor);
    if(!issues.length){
      const previous=this.options.store.get<DataSourceDefinition>('saved_assets',`data_source:${definition.id}`),record=previous?this.options.store.get<{value:RegistrationProof}>('provider_records',`data-source-proof:${definition.id}:${previous.revision}`):undefined;
      const proof=record?.value;
      if(previous?.validation.status==='verified'&&previous.revision===input.expectedRevision&&proof&&mappingFingerprint(definition)===mappingFingerprint(previous)&&proof.mapping===mappingFingerprint(definition)&&proof.descriptor===fingerprint(descriptor)&&proof.validation===fingerprint(previous.validation)&&proof.source===registrationSourceFingerprint(source)&&proof.sampling===fingerprint({params:input.params??{},context:input.context??null})){
        const validation=structuredClone(previous.validation);this.registrationProofs.set(validation,proof);return validation;
      }
    }
    return this.validate(input,source,signal);
  }
  /** Only the trusted provider catalog calls this; Agent registration still validates a real read. */
  installCatalog(definitions:DataSourceDraft[]):DataSourceDefinition[] {
    return definitions.map(definition=>{
      const issues=dataSourceDefinitionIssues(definition,this.options.runtime.describe(definition.capabilityId));
      if(issues.length)presentationFailure('INVALID_DATA_SOURCE_CATALOG',`${definition.title}：${issues.join('；')}`);
      const previous=this.options.store.get<DataSourceDefinition>('saved_assets',`data_source:${definition.id}`);
      if(previous&&JSON.stringify(Object.fromEntries(Object.entries(previous).filter(([key])=>!['kind','revision','validation'].includes(key))))===JSON.stringify(definition))return previous;
      const value:DataSourceDefinition={...structuredClone(definition),kind:'data_source',revision:(previous?.revision??0)+1,validation:{status:'unverified',checkedAt:new Date().toISOString(),sampleCount:0,issues:['接口已封装，等待所选店铺的实际读取验证。']}};
      this.options.store.put('saved_assets',`data_source_revision:${value.id}:${value.revision}`,{...value,kind:'data_source_revision'});
      return this.options.store.put('saved_assets',`data_source:${value.id}`,value);
    });
  }
  recordValidation(definition:DataSourceDefinition,validation:DataSourceValidation):void {
    const current=this.options.store.get<DataSourceDefinition>('saved_assets',`data_source:${definition.id}`);
    if(!current||current.revision!==definition.revision)return;
    this.options.store.put('saved_assets',`data_source:${definition.id}`,{...current,validation});
    this.options.store.put('saved_assets',`data_source_revision:${definition.id}:${definition.revision}`,{...current,kind:'data_source_revision',validation});
  }
  retire(id:string):void {this.options.store.delete('saved_assets',`data_source:${id}`);}
  commit(input:RegisterDataSourceInput,validation:DataSourceValidation):DataSourceDefinition {
    if(validation.status!=='verified')presentationFailure('DATA_SOURCE_VALIDATION_FAILED',validation.issues.join('；'));
    return this.options.store.transaction(()=>{
      const previous=this.options.store.get<DataSourceDefinition>('saved_assets',`data_source:${input.definition.id}`);
      if((previous?.revision??0)!==(input.expectedRevision??0))presentationFailure('DATA_SOURCE_CONFLICT','数据源已修改，请重新读取后再保存。');
      const proof=this.registrationProofs.get(validation),descriptor=this.options.runtime.describe(input.definition.capabilityId);
      if(proof&&(!descriptor||proof.mapping!==mappingFingerprint(input.definition)||proof.validation!==fingerprint(validation)||proof.descriptor!==fingerprint(descriptor)))presentationFailure('DATA_SOURCE_VALIDATION_CHANGED','验证期间数据能力或字段定义发生变化，请重新验证。');
      const value:DataSourceDefinition={...structuredClone(input.definition),kind:'data_source',revision:(previous?.revision??0)+1,validation:structuredClone(validation)};
      // History keeps existing workbench references stable when a source is edited.
      this.options.store.put('saved_assets',`data_source_revision:${value.id}:${value.revision}`,{...value,kind:'data_source_revision'});
      if(proof){const recordId=`data-source-proof:${value.id}:${value.revision}`;this.options.store.put('provider_records',recordId,{appId:'apps',connectionId:'presentation',namespace:'data_source_validation_proofs',recordId,value:proof});}
      return structuredClone(this.options.store.put('saved_assets',`data_source:${value.id}`,value));
    });
  }
  async register(input:RegisterDataSourceInput,source:InvocationSource,signal?:AbortSignal):Promise<DataSourceDefinition> {
    const validation=await this.validateRegistration(input,source,signal);return this.commit(input,validation);
  }
  async ensureBuiltIns(source:InvocationSource,appId?:string,signal?:AbortSignal):Promise<{sources:DataSourceDefinition[];issues:{id:string;message:string}[]}> {
    const issues:{id:string;message:string}[]=[];
    const existing=new Set(this.list(appId).map(item=>item.id));
    for(const definition of this.suggestions(appId)){
      if(existing.has(definition.id))continue;
      try{await this.register({definition},source,signal);existing.add(definition.id);}catch(error){issues.push({id:definition.id,message:error instanceof Error?error.message:String(error)});}
    }
    return {sources:this.list(appId),issues};
  }
}
