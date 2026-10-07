import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {canonicalJson,datasetId} from '../../app-contracts/src/index.ts';
import type {CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../app-contracts/src/index.ts';
import type {AppsRuntime} from '../../app-runtime/src/index.ts';
import {APP_PRESENTATION_DESCRIPTORS,AppsPresentationError} from '../../app-presentation/src/index.ts';
import type {AppsPresentationService,AppsView,AppsComponent,DatasetSnapshot} from '../../app-presentation/src/index.ts';
import {applyPatch} from '../../presentation/src/patch.ts';
import {safeJSON,validateBinding,validateViewSpec} from '../../presentation/src/validation.ts';
import {INITIAL_TEMPLATES} from '../../presentation/src/design.ts';
import type {DataBinding,Patch,SourceArtifact,Template,ViewSpec} from '../../presentation/src/types.ts';
import type {ToolResult} from '../../contracts/src/index.ts';

type LegacyRuntime=Pick<AppsRuntime,'store'|'describe'|'resolveConnection'|'invoke'>;
const clone=<T>(value:T):T=>structuredClone(value);
const json=(value:unknown):JsonValue=>JSON.parse(canonicalJson(value)) as JsonValue;
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
function fail(code:string,message:string):never {throw new AppsPresentationError(code,message);}
function text(value:unknown,label:string):string {if(typeof value!=='string'||!value.trim())fail('INVALID_UI_INPUT',`${label} is required.`);return value;}
function keys(input:Record<string,unknown>,allowed:readonly string[]):void {if(Object.keys(input).some(key=>!allowed.includes(key)))fail('INVALID_UI_INPUT','Unexpected UI input field.');}
const compact=(value:Record<string,unknown>):Record<string,unknown>=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined));
const suffix=(name:string)=>name.startsWith('hallmark_')?name.slice('hallmark_'.length):name;
export function isLegacyPresentationTool(name:string):boolean {return APP_PRESENTATION_DESCRIPTORS.some(item=>item.aliases.includes(name));}

/** An old dataset-only binding is accepted only through an exact stored mapping, never a port or display name. */
export function normalizeLegacyBinding(raw:unknown,sessionId:string|null,runtime:LegacyRuntime):DatasetBinding {
  const value=record(raw);
  if(typeof value.capabilityId==='string'&&typeof value.bindingId==='string')return clone(value) as unknown as DatasetBinding;
  validateBinding(value);
  const id=text(value.id,'binding.id'),query=record(value.query),legacyKey=typeof value.datasetKey==='string'?value.datasetKey:undefined;
  let known:DatasetBinding|undefined;
  if(legacyKey){
    const snapshot=runtime.store.get<DatasetSnapshot>('datasets',legacyKey),alias=runtime.store.get<Record<string,unknown>>('legacy_aliases',`dataset:${legacyKey}`);
    const mappedId=typeof alias?.datasetId==='string'?alias.datasetId:typeof alias?.targetId==='string'?alias.targetId:undefined;
    const mapped=snapshot??(mappedId?runtime.store.get<DatasetSnapshot>('datasets',mappedId):undefined),canonical=record(mapped?.canonicalBinding??alias?.canonicalBinding);
    if(typeof canonical.appId==='string'&&typeof canonical.connectionId==='string'&&typeof canonical.capabilityId==='string'&&Number.isSafeInteger(canonical.capabilityMajor))known={appId:canonical.appId,connectionId:canonical.connectionId,capabilityId:canonical.capabilityId,capabilityMajor:canonical.capabilityMajor as number,input:canonical.input as JsonValue,projection:canonical.projection as string[]??[],bindingId:id,refresh:{mode:'manual'}};
    if(!known)known=runtime.store.list<AppsView>('views').flatMap(view=>view.bindings).find(binding=>binding.datasetId===legacyKey||mappedId&&binding.datasetId===mappedId);
  }
  if(!query.tool){if(!known)fail('LEGACY_BINDING_NEEDS_MIGRATION',`needs_migration: no verified query/connection mapping for ${legacyKey??id}.`);return {...clone(known),bindingId:id};}
  const descriptor=runtime.describe(text(query.tool,'query.tool'));if(!descriptor)fail('CAPABILITY_NOT_FOUND','Legacy binding query is unavailable.');
  if(!['query','compute'].includes(descriptor.effect))fail('QUERY_NOT_READ_ONLY','Legacy data bindings cannot invoke mutations.');
  const appId=descriptor.capabilityId.split('.')[0],legacyConnection=runtime.store.get<{appId?:string;connectionId?:string;status?:string}>('legacy_aliases','connection:default');
  const connectionId=known?.appId===appId?known.connectionId:legacyConnection?.appId===appId&&legacyConnection.status!=='needs_migration'?legacyConnection.connectionId:undefined;
  const route=runtime.resolveConnection(appId,sessionId??undefined,connectionId);
  if('status' in route)fail('LEGACY_CONNECTION_NEEDS_MIGRATION','needs_migration: legacy query connection is absent or ambiguous.');
  const result:DatasetBinding={appId:route.appId,connectionId:route.connectionId,bindingId:id,capabilityId:descriptor.capabilityId,capabilityMajor:Number(descriptor.version.split('.')[0]),input:json(query.params??{}),projection:[],refresh:{mode:'manual'}};
  return {...result,datasetId:datasetId(result)};
}
function normalizeBindings(raw:unknown,sessionId:string|null,runtime:LegacyRuntime):DatasetBinding[] {if(raw===undefined)return [];if(!Array.isArray(raw))fail('INVALID_BINDING','bindings must be an array.');return raw.map(binding=>normalizeLegacyBinding(binding,sessionId,runtime));}
function legacyBindings(view:AppsView):DataBinding[] {
  const originals=Array.isArray(record(view.design).bindings)?record(view.design).bindings as DataBinding[]:[];
  return view.bindings.map(binding=>{
    const old=originals.find(value=>value.id===binding.bindingId);
    return {id:binding.bindingId,datasetKey:old?.datasetKey??binding.datasetId??datasetId(binding),fieldMap:clone(old?.fieldMap??{}),...(old?.query?{query:clone(old.query)}:{})};
  });
}
export function projectLegacySpec(view:AppsView):ViewSpec {
  const design=record(view.design);
  const spec={layout:{type:'column',children:[]},widgets:[],...clone(design),id:view.viewId,title:view.title,bindings:legacyBindings(view)} as ViewSpec;
  if(view.source){spec.kind='source';spec.source=clone(view.source);spec.layout={type:'column',children:[]};spec.widgets=[];}
  return spec;
}
function projectComponent(component:AppsComponent,runtime?:Pick<LegacyRuntime,'store'>):Record<string,unknown> {const revisions=component.revisions??(component.view.source&&runtime?runtime.store.list<AppsComponent>('component_versions').filter(version=>version.componentId===component.componentId).sort((a,b)=>a.revision-b.revision).map(version=>({revision:version.revision,title:version.title,savedAt:version.savedAt,...(version.view.source?{buildId:version.view.source.buildId}:{})})):undefined);return {id:component.componentId,title:component.title,spec:projectLegacySpec({...component.view,viewId:component.componentId}),userRequest:component.userRequest,savedAt:component.savedAt,revision:component.revision,...(component.legacyTemplate?{template:clone(component.legacyTemplate)}:{}),...(revisions?{revisions:clone(revisions)}:{})};}
function projectEntry(asset:Record<string,unknown>,persisted=false):Record<string,unknown> {
  const binding=asset.binding as DatasetBinding|undefined;
  return {id:asset.assetId,appId:'hallmark',kind:asset.componentId?'component':'data',title:asset.title,pinned:asset.pinned??false,order:asset.order??0,...(asset.componentId?{viewId:asset.componentId}:{}),...(binding?{binding:asset.legacyBinding?clone(asset.legacyBinding):{id:binding.bindingId,datasetKey:binding.datasetId??datasetId(binding),fieldMap:{}}}:{}),...(persisted&&typeof asset.userRequest==='string'?{userRequest:asset.userRequest}:{})};
}
function componentEntry(componentId:string,runtime:Pick<LegacyRuntime,'store'>|undefined):Record<string,unknown> {
  const entry=runtime?.store.list<Record<string,unknown>>('saved_assets').find(asset=>asset.kind==='entry'&&asset.componentId===componentId);
  if(!entry)fail('ENTRY_NOT_FOUND','The saved component entry is unavailable.');return entry;
}
const sortedEntries=(assets:Record<string,unknown>[])=>assets.filter(asset=>asset.kind==='entry').map(asset=>projectEntry(asset,true)).sort((a,b)=>Number(a.order)-Number(b.order));
function projectTemplate(asset:Record<string,unknown>,persisted=false):Template {
  const design=record(asset.design),bindings=asset.bindings as DatasetBinding[]??[];
  const spec=projectLegacySpec({viewId:String(asset.assetId),ownerSessionId:null,title:String(asset.title),design:json(design),bindings,createdAt:'',updatedAt:'',...(asset.source?{source:asset.source as SourceArtifact}:{})});
  return {id:String(asset.assetId),name:String(asset.title),description:typeof asset.description==='string'?asset.description:'',theme:spec.theme??{},layout:spec.layout,widgetStyles:spec.widgets,contentRules:{bindingIds:bindings.map(binding=>binding.bindingId)},version:1,...(asset.source?{kind:'source',source:asset.source as SourceArtifact,bindings:spec.bindings}:{}),...(persisted&&typeof asset.userRequest==='string'?{userRequest:asset.userRequest}:{}),...(persisted&&typeof asset.savedAt==='string'?{savedAt:asset.savedAt}:{})};
}
function legacyTemplate(id:string,runtime:Pick<LegacyRuntime,'store'>):Template|undefined {
  const asset=runtime.store.get<Record<string,unknown>>('saved_assets',`template:${id}`);return asset?projectTemplate(asset,true):clone(INITIAL_TEMPLATES.find(template=>template.id===id));
}
function legacyInitialData(view:AppsView,rows:unknown,runtime?:Pick<LegacyRuntime,'store'>):Record<string,unknown>[] {
  if(!Array.isArray(rows))return [];
  const bindings=legacyBindings(view);
  return rows.map(row=>{const value=record(row),binding=bindings.find(item=>item.id===value.bindingId),snapshot=typeof value.datasetId==='string'?runtime?.store.get<DatasetSnapshot>('datasets',value.datasetId):undefined,error=snapshot?.error;return {bindingId:value.bindingId,datasetKey:binding?.datasetKey??value.datasetId,status:value.status==='ready'?'ok':value.status==='empty'?'failed':value.status,...(error?{error:{code:error.code,message:error.message,retryable:error.retryPolicy==='read_retry'}}:{})};});
}
function patchLegacy(view:AppsView,patch:unknown):ViewSpec {
  if(!Array.isArray(patch))fail('INVALID_PATCH','JSON Patch array is required.');
  const current=projectLegacySpec(view);
  return applyPatch(current,patch as Patch[],current.kind==='source'?value=>{safeJSON(value);if(value.id!==current.id||value.kind!=='source'||!value.source||canonicalJson(value.source)!==canonicalJson(current.source)||!value.title||!Array.isArray(value.bindings))fail('INVALID_SPEC','Source metadata requires its existing immutable source artifact and bindings.');for(const binding of value.bindings)validateBinding(binding);}:validateViewSpec);
}

/** Pure input translation for the old nine aliases; execution still enters the single Runtime. */
export function normalizeLegacyPresentationInput(name:string,args:Record<string,unknown>,sessionId:string|null,runtime:LegacyRuntime):Record<string,unknown> {
  switch(suffix(name)){
    case 'render_view':{
      const spec=clone(record(args.spec)),resultSetId=typeof args.resultSetId==='string'?text(args.resultSetId,'resultSetId'):undefined;
      let raw=clone(args.bindings??spec.bindings??[]) as DataBinding[],canonical:DatasetBinding[]|undefined;
      if(resultSetId){raw=[{id:'data',datasetKey:`result_set:${resultSetId}`,fieldMap:{}}];canonical=[normalizeLegacyBinding({id:'data',fieldMap:{},query:{tool:'hallmark_filter_products',params:{resultSetId}}},sessionId,runtime)];}
      const required=(bindings:DatasetBinding[])=>resultSetId?{requiredBindingIds:bindings.map(binding=>binding.bindingId)}:{};
      if(args.spec){
        spec.bindings=raw;
        if(typeof spec.templateId==='string'){const template=legacyTemplate(spec.templateId,runtime);if(!template)fail('TEMPLATE_NOT_FOUND','Template does not exist.');spec.theme={...template.theme,...record(spec.theme)};}
        validateViewSpec(spec);const bindings=canonical??normalizeBindings(raw,sessionId,runtime);
        return {title:spec.title,design:json(spec),bindings,legacyViewId:spec.id,...required(bindings)};
      }
      if(typeof args.templateId==='string'){
        const template=legacyTemplate(args.templateId,runtime);if(!template)fail('TEMPLATE_NOT_FOUND','Template does not exist.');
        if(template.kind==='source'){
          const bindings=canonical??(raw.length?normalizeBindings(raw,sessionId,runtime):undefined);
          return compact({templateId:args.templateId,title:args.title??'Hallmark',bindings,...(raw.length?{legacyBindings:raw}:{}),...(bindings?required(bindings):{})});
        }
        const ids=template.contentRules.bindingIds as string[];
        if(raw.length!==ids.length)fail('INVALID_SPEC','Template binding count does not match.');
        raw.forEach((binding,index)=>{binding.id=ids[index];});
        const bindings=canonical?canonical.map((binding,index)=>({...binding,bindingId:ids[index]})):normalizeBindings(raw,sessionId,runtime),design={id:randomUUID(),title:args.title??'Hallmark',templateId:template.id,theme:template.theme,layout:template.layout,widgets:template.widgetStyles,bindings:raw};validateViewSpec(design);
        return {title:design.title,design,bindings,legacyViewId:design.id,...required(bindings)};
      }
      const bindings=canonical??normalizeBindings(raw,sessionId,runtime);return {title:'Hallmark',bindings,legacyNeedsSpecification:true,...required(bindings)};
    }
    case 'update_view':{
      const id=text(args.viewId,'viewId'),view=runtime.store.get<AppsView>('views',id);if(!view)fail('VIEW_NOT_FOUND','View does not exist.');if(view.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','View belongs to another session.');
      const spec=patchLegacy(view,args.patch);return {viewId:id,title:spec.title,design:json(spec),bindings:normalizeBindings(spec.bindings,sessionId,runtime)};
    }
    case 'open_source_component':{
      let bindings=args.bindings;
      let metadata:Record<string,unknown>={};if(typeof args.directory==='string'){const path=join(args.directory,'component.json');if(existsSync(path))metadata=record(JSON.parse(readFileSync(path,'utf8')));}
      if(bindings===undefined&&args.viewId===undefined)bindings=metadata.bindings;
      const previous=typeof args.viewId==='string'?runtime.store.get<AppsView>('views',args.viewId):undefined;
      return compact({directory:args.directory,title:args.title??previous?.title??metadata.title??metadata.name??'源码组件',viewId:args.viewId,...(bindings!==undefined?{bindings:normalizeBindings(bindings,sessionId,runtime),legacyBindings:(bindings as unknown[]).filter(binding=>typeof record(binding).id==='string').map(clone)}:{})});
    }
    case 'open_component':return compact({componentId:args.componentId,revision:args.revision,directory:args.directory});
    case 'save_component':{
      const previous=args.mode===undefined?runtime.store.list<AppsComponent>('components').find(item=>item.componentId===args.viewId||item.view.viewId===args.viewId):undefined;
      const view=typeof args.viewId==='string'?runtime.store.get<AppsView>('views',args.viewId):undefined,templateId=record(view?.design).templateId,template=typeof templateId==='string'?legacyTemplate(templateId,runtime):undefined;
      return compact({viewId:args.viewId,userRequest:args.userRequest,title:args.title,mode:args.mode??(previous?'update':'save_as'),componentId:args.componentId??previous?.componentId,expectedRevision:args.expectedRevision??previous?.revision,...(args.mode===undefined&&!previous?{legacyComponentId:args.viewId}:{}),...(template?{legacyTemplate:template}:{})});
    }
    case 'save_entry':return {title:args.title,binding:normalizeLegacyBinding(args.binding,sessionId,runtime),...(typeof record(args.binding).id==='string'?{legacyBinding:clone(args.binding),legacyFieldOrder:Object.keys(record(record(args.binding).fieldMap))}:{}),userRequest:args.userRequest};
    case 'save_template':return compact({viewId:args.viewId,name:args.name,description:args.description,userRequest:args.userRequest});
    case 'list_saved':return {};
    case 'manage_saved':return compact({kind:args.kind,id:args.id,action:args.action,name:args.name,order:args.order,pinned:args.pinned});
    default:fail('TOOL_NOT_FOUND','Unknown presentation alias.');
  }
}
/** Old ToolResult projection does not invent submission receipts or execution success. */
export function projectLegacyPresentationResult(name:string,result:CapabilityResult,runtime?:Pick<LegacyRuntime,'store'>):ToolResult {
  if(result.status==='needs_clarification')return {status:'needs_clarification',clarification:{missing:result.missing,candidates:result.candidates,question:result.question}};
  const output:ToolResult={status:result.status==='cancelled'?'failed':result.status,...('error' in result?{error:{code:result.error.code,message:result.error.message,retryable:result.error.retryPolicy==='read_retry'}}:{})};
  if(result.operation)output.operation={operationId:result.operation.operationId,state:result.operation.state==='queued'?'pending':result.operation.state==='dispatching'?'running':result.operation.state==='cancelled'?'failed':result.operation.state};
  if(!('data' in result))return output;
  const data=record(result.data);
  switch(suffix(name)){
    case 'render_view':case 'update_view':case 'open_source_component':output.data={viewId:data.viewId,spec:projectLegacySpec(data as unknown as AppsView),...(record(data.source).directory?{directory:record(data.source).directory}:{}),...(Array.isArray(data.initialData)?{initialData:legacyInitialData(data as unknown as AppsView,data.initialData,runtime)}:{})};break;
    case 'open_component':{const spec=projectLegacySpec(data as unknown as AppsView);if(spec.templateId&&runtime&&!legacyTemplate(spec.templateId,runtime))delete spec.templateId;output.data={viewId:data.viewId,spec,sourceComponentId:data.sourceComponentId,baseRevision:data.baseRevision,...(Array.isArray(data.initialData)?{initialData:legacyInitialData(data as unknown as AppsView,data.initialData,runtime)}:{})};break;}
    case 'save_component':output.data={component:projectComponent(data as unknown as AppsComponent,runtime),entry:projectEntry(componentEntry(String(data.componentId),runtime))};break;
    case 'save_entry':output.data=projectEntry(data);break;
    case 'save_template':output.data=projectTemplate(data);break;
    case 'list_saved':output.data={components:(data.components as AppsComponent[]??[]).map(component=>projectComponent(component,runtime)),entries:sortedEntries(data.assets as Record<string,unknown>[]??[]),templates:(data.assets as Record<string,unknown>[]??[]).filter(asset=>asset.kind==='template').map(asset=>projectTemplate(asset,true))};break;
    case 'manage_saved':output.data=data.deleted===true?clone(data):typeof data.componentId==='string'&&typeof data.revision==='number'?projectComponent(data as unknown as AppsComponent,runtime):data.kind==='entry'?projectEntry(data,true):data.kind==='template'?projectTemplate(data,true):clone(data);break;
    default:output.data=clone(result.data);
  }
  return output;
}

export function createLegacyPresentationAdapter(presentation:AppsPresentationService,runtime:LegacyRuntime) {
  const view=(id:string,sessionId?:string|null):AppsView=>{
    const found=presentation.getView(id);if(found){if(sessionId!==undefined&&found.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','View belongs to another session.');return found;}
    const saved=runtime.store.get<AppsComponent>('components',id);if(!saved)fail('VIEW_NOT_FOUND','View does not exist.');
    if(sessionId!==undefined)fail('VIEW_NOT_OWNED','Saved asset is not an owning-session draft. Open it first.');
    return {...clone(saved.view),viewId:id,ownerSessionId:null};
  };
  const libraryView=(id:string):AppsView=>{const component=runtime.store.get<AppsComponent>('components',id);return component?{...clone(component.view),viewId:id,ownerSessionId:null}:view(id);};
  const data=(current:AppsView):ToolResult=>{
    const bindings=current.bindings.map(binding=>{const snapshot=runtime.store.get<DatasetSnapshot>('datasets',binding.datasetId??datasetId(binding));if(!snapshot||snapshot.payload===null)return undefined;
      const datasetKey=legacyBindings(current).find(value=>value.id===binding.bindingId)?.datasetKey??binding.datasetId??datasetId(binding),resultSet=datasetKey.startsWith('result_set:'),payload=record(snapshot.payload);
      if(resultSet&&typeof payload.expiresAt==='string'&&Date.parse(payload.expiresAt)<=Date.now())return undefined;
      const provenance=snapshot.provenance[0];return {bindingId:binding.bindingId,datasetKey,payload:clone(resultSet?payload.payload:snapshot.payload),dataTime:snapshot.sourceDataTime??undefined,lastSuccessAt:snapshot.lastSuccessAt,state:snapshot.state,lastError:snapshot.error??null,provenance:{source:'app_snapshot',...(provenance?{endpoint:provenance.sourceRef,fetchedAt:provenance.fetchedAt}:{}),freshness:snapshot.freshness},...(provenance?.metricBasis?{metricBasis:provenance.metricBasis}:{})};
    });const missing=current.bindings.filter((_,index)=>!bindings[index]).map(binding=>binding.bindingId);
    return {status:missing.length?bindings.some(Boolean)?'partial':'failed':'ok',data:{viewId:current.viewId,bindings:bindings.filter(Boolean),missing},...(missing.length?{error:{code:'SNAPSHOT_EMPTY',message:`No successful snapshot for: ${missing.join(', ')}`,retryable:false}}:{})};
  };
  const saved=()=>{
    const components=runtime.store.list<AppsComponent>('components').map(component=>({...projectComponent(component),revisions:presentation.componentVersions(component.componentId).map(version=>({revision:version.revision,title:version.title,savedAt:version.savedAt,...(version.view.source?{buildId:version.view.source.buildId}:{})}))})),assets=runtime.store.list<Record<string,unknown>>('saved_assets');
    return {components,entries:sortedEntries(assets),templates:assets.filter(asset=>asset.kind==='template').map(asset=>projectTemplate(asset,true))};
  };
  const execute=async(name:string,args:Record<string,unknown>,sessionId:string):Promise<ToolResult>=>{
    try{
    if(['save_component','save_entry','save_template'].includes(suffix(name))&&(!args.userRequest||typeof args.userRequest==='string'&&!args.userRequest.trim()))return {status:'failed',error:{code:'SAVE_NOT_REQUESTED',message:'Saving requires the explicit current user instruction.',retryable:false}};
    if(suffix(name)==='save_component'&&args.mode==='update'){const missing=['componentId','expectedRevision'].filter(key=>!Object.hasOwn(args,key));if(missing.length)return {status:'needs_clarification',clarification:{missing,question:'更新原组件需要明确原组件 ID 和打开时的版本。'}};}
    const descriptor=runtime.describe(name);if(!descriptor)fail('CAPABILITY_NOT_FOUND','Legacy presentation capability is unavailable.');
    const route=runtime.resolveConnection('apps',sessionId,'presentation');if('status' in route)fail('APP_NOT_ACTIVE','Shared presentation must be enabled in this session.');
    const input=normalizeLegacyPresentationInput(name,args,sessionId,runtime),id=randomUUID(),request:InvocationRequest={protocolVersion:'1.0',appId:route.appId,connectionId:route.connectionId,invocationId:id,traceId:randomUUID(),capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:json(input),source:{kind:'agent',sessionId,nativeCallId:id},deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString(),...(descriptor.effect==='mutation'?{idempotencyKey:`legacy:${id}`}:{})};
    return projectLegacyPresentationResult(name,await runtime.invoke(request),runtime);
    }catch(error){return {status:'failed',error:{code:(error as {code?:string}).code??'INVALID_PARAMS',message:error instanceof Error?error.message:String(error),retryable:false}};}
  };
  return {normalizeLegacyPresentationInput:(name:string,args:Record<string,unknown>,sessionId:string|null)=>normalizeLegacyPresentationInput(name,args,sessionId,runtime),projectLegacyPresentationResult:(name:string,result:CapabilityResult)=>projectLegacyPresentationResult(name,result,runtime),async handle(path:string,method:string,input:Record<string,unknown>={},sessionId?:string):Promise<unknown|undefined>{
    const sessionRoute=path.match(/^\/sessions\/([^/]+)\/views(?:\/([^/]+)(\/data)?)?$/);
    if(sessionRoute){const owner=decodeURIComponent(sessionRoute[1]);if(method==='GET'&&!sessionRoute[2])return {sessionId:owner,views:runtime.store.list<AppsView>('views').filter(item=>item.ownerSessionId===owner).map(item=>({viewId:item.viewId,title:item.title,createdAt:item.createdAt,updatedAt:item.updatedAt,state:'ready'}))};
      if(sessionRoute[2]){const id=decodeURIComponent(sessionRoute[2]),current=view(id,owner);if(method==='GET')return sessionRoute[3]?data(current):projectLegacySpec(current);if(method==='POST'&&!sessionRoute[3]){keys(input,input.action==='rename'?['action','title']:['action']);if(input.action==='remove'){runtime.store.delete('views',id);return {sessionId:owner,viewId:id,action:'remove'};}if(input.action==='rename'){const title=text(input.title,'title');presentation.createView(owner,{viewId:id,title});return {sessionId:owner,viewId:id,action:'rename',title};}fail('INVALID_UI_INPUT','Invalid session view action.');}}return undefined;
    }
    const tool=path.match(/^\/tools\/(hallmark_[a-z_]+)$/);if(method==='POST'&&tool&&isLegacyPresentationTool(tool[1])){keys(input,['arguments','sessionId','userRequest']);if(!input.arguments||typeof input.arguments!=='object'||Array.isArray(input.arguments))fail('INVALID_PARAMS','Tool arguments must be an object.');return execute(tool[1],record(input.arguments),text(input.sessionId,'sessionId'));}
    const read=path.match(/^\/ui\/views\/([^/]+)(\/data)?$/);if(method==='GET'&&read){const current=libraryView(decodeURIComponent(read[1]));return read[2]?data(current):projectLegacySpec(current);}
    if(method==='GET'&&path==='/ui/saved')return saved();
    if(method==='GET'&&path==='/ui/templates')return [...INITIAL_TEMPLATES,...saved().templates];
    if(method==='GET'&&path==='/ui/datasets')return runtime.store.list<DatasetSnapshot>('datasets').map(item=>({datasetKey:item.datasetId,state:item.state,dataTime:item.sourceDataTime,lastSuccessAt:item.lastSuccessAt||null}));
    if(method!=='POST'||!path.startsWith('/ui/'))return undefined;
    const allowed:Record<string,string[]>={'/ui/render':['spec','templateId','title','bindings'],'/ui/update':['viewId','patch'],'/ui/save':['viewId','title','action','mode','componentId','expectedRevision'],'/ui/open-component':['componentId','revision','directory','sessionId'],'/ui/open-template':['templateId','title','bindings','directory','sessionId'],'/ui/save-template':['viewId','name','description','action'],'/ui/open-entry':['entryId'],'/ui/refresh':['datasetKey'],'/ui/manage':['kind','id','action','name','order','pinned']};
    if(allowed[path])keys(input,allowed[path]);
    if(input.sessionId!==undefined)text(input.sessionId,'sessionId');
    if(input.revision!==undefined&&(!Number.isSafeInteger(input.revision)||Number(input.revision)<1))fail('INVALID_UI_INPUT','Invalid component revision.');
    if(input.directory!==undefined)text(input.directory,'directory');
    const owner=typeof input.sessionId==='string'?input.sessionId:sessionId??null;
    if(path==='/ui/render'){const normalized=normalizeLegacyPresentationInput('hallmark_render_view',input,owner,runtime),current=typeof normalized.templateId==='string'?presentation.openTemplate(owner,normalized.templateId,normalized as never):presentation.createView(owner,normalized as never);return projectLegacySpec(current);}
    if(path==='/ui/update'){const current=view(text(input.viewId,'viewId')),normalized=normalizeLegacyPresentationInput('hallmark_update_view',input,current.ownerSessionId,runtime);return projectLegacySpec(presentation.createView(current.ownerSessionId,normalized as never));}
    if(path==='/ui/save'){if(input.action!=='save-component')fail('SAVE_NOT_REQUESTED','Explicit save-component action is required.');const current=view(text(input.viewId,'viewId')),title=text(input.title,'title'),args=normalizeLegacyPresentationInput('hallmark_save_component',{...input,userRequest:`User clicked Save component: ${title}`},current.ownerSessionId,runtime),component=presentation.saveComponent(current.ownerSessionId,current.viewId,String(args.userRequest),args as never);return {component:projectComponent(component,runtime),entry:projectEntry(componentEntry(component.componentId,runtime))};}
    if(path==='/ui/open-component'){const current=await presentation.hydrateSourceView(presentation.openComponent(owner,text(input.componentId,'componentId'),{...(typeof input.revision==='number'?{revision:input.revision}:{}),...(typeof input.directory==='string'?{directory:input.directory}:{})}),owner?{kind:'agent',sessionId:owner,nativeCallId:randomUUID()}:{kind:'scheduler',scheduleId:'ui-open-component',runId:randomUUID()}),result=record(projectLegacyPresentationResult('hallmark_open_component',{status:'ok',invocationId:'ui-open',traceId:'ui-open',data:json(current)},runtime).data);delete result.viewId;return result;}
    if(path==='/ui/open-template'){
      const templateId=text(input.templateId,'templateId'),template=legacyTemplate(templateId,runtime),normalized=normalizeLegacyPresentationInput('hallmark_render_view',{...input,templateId,title:input.title??template?.name??'模板草稿'},owner,runtime),current=await presentation.hydrateSourceView(typeof normalized.templateId==='string'?presentation.openTemplate(owner,templateId,{...normalized,...(input.directory?{directory:input.directory}:{})} as never):presentation.createView(owner,normalized as never),owner?{kind:'agent',sessionId:owner,nativeCallId:randomUUID()}:{kind:'scheduler',scheduleId:'ui-open-template',runId:randomUUID()});return {spec:projectLegacySpec(current),...(current.initialData?{initialData:legacyInitialData(current,current.initialData,runtime)}:{})};
    }
    if(path==='/ui/save-template'){if(input.action!=='save-template')fail('SAVE_NOT_REQUESTED','Explicit save-template action is required.');const current=view(text(input.viewId,'viewId')),name=text(input.name,'name');return projectTemplate(presentation.saveTemplate(current.ownerSessionId,current.viewId,name,`User clicked Save template: ${name}`,typeof input.description==='string'?input.description:''));}
    if(path==='/ui/open-entry'){
      const asset=runtime.store.get<Record<string,unknown>>('saved_assets',`entry:${text(input.entryId,'entryId')}`);if(!asset)fail('ENTRY_NOT_FOUND','Saved entry does not exist.');
      if(typeof asset.componentId==='string')return projectLegacySpec(libraryView(asset.componentId));
      const binding=asset.binding as DatasetBinding,legacy=record(projectEntry(asset).binding),fieldMap=record(legacy.fieldMap),order=Array.isArray(asset.legacyFieldOrder)?asset.legacyFieldOrder as string[]:Object.keys(fieldMap),fields=order.filter(field=>typeof fieldMap[field]==='string').slice(0,12).map(field=>({field,label:String(fieldMap[field])})),current=presentation.createView(owner,{title:String(asset.title),bindings:[binding],design:{layout:{type:'column',children:['data']},widgets:[{id:'data',type:'table',bindingId:binding.bindingId,title:String(asset.title),columns:fields.length?fields:[{field:'offerId',label:'商品标识'},{field:'title',label:'名称'}],options:{pageSize:20}}],bindings:[json(legacy)]}});return projectLegacySpec(current);
    }
    if(path==='/ui/refresh'){
      const key=text(input.datasetKey,'datasetKey'),binding=runtime.store.list<AppsView>('views').flatMap(item=>item.bindings.filter(value=>value.datasetId===key||legacyBindings(item).some(old=>old.id===value.bindingId&&old.datasetKey===key))).at(0);
      if(!binding)fail('LEGACY_BINDING_NEEDS_MIGRATION','needs_migration: dataset refresh recipe is unavailable.');
      const result=await presentation.refreshBinding(binding,{kind:'scheduler',scheduleId:'ui-manual-refresh',runId:randomUUID()});return result.state==='ready'?{status:'ok',data:{datasetKey:result.datasetId,snapshot:result}}:{status:'unavailable',error:{code:result.error?.code??'REFRESH_FAILED',message:result.error?.message??'Refresh failed',retryable:true}};
    }
    if(path==='/ui/manage'){
      const kind=text(input.kind,'kind'),id=text(input.id,'id');
      const result=presentation.manageSaved(json(compact({kind,id,action:input.action,name:input.name,order:input.order,pinned:input.pinned})) as Record<string,JsonValue>);
      return projectLegacyPresentationResult('hallmark_manage_saved',{status:'ok',invocationId:'ui-manage',traceId:'ui-manage',data:result},runtime).data;
    }
    return undefined;
  }};
}
