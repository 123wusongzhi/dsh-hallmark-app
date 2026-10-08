import {randomUUID} from 'node:crypto';
import {canonicalBinding,canonicalJson,compileSchema,datasetId,requestHash} from '../../app-contracts/src/index.ts';
import type {AppManifest,AppProvider,BridgeIdentity,CapabilityDescriptor,CapabilityResult,DatasetBinding,ExecutionContext,FailureInfo,InvocationRequest,InvocationSource,JsonValue,ResourceRef,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import {ComponentHost} from '../../component-runtime/src/host.ts';
import type {AppsBindingData,AppsComponent,AppsPresentationOptions,AppsView,AppsViewData,DatasetSnapshot,SaveAppsComponentOptions} from './types.ts';
export * from './types.ts';
export * from './descriptors.ts';
import {APP_PRESENTATION_DESCRIPTORS} from './descriptors.ts';
import {ComponentContexts} from './context.ts';
import {validateDataSelection} from './selection.ts';
import {AppsAuthoringService} from './authoring.ts';
import type {AppsAuthoringOptions,CandidateFrameIdentity,ViewPublication} from './authoring-types.ts';
import {APP_AUTHORING_DESCRIPTORS} from './authoring-descriptors.ts';
export * from './authoring.ts';

export class AppsPresentationError extends Error {
  code:string;
  constructor(code:string,message:string){super(message);this.name='AppsPresentationError';this.code=code;}
}
const clone=<T>(value:T):T=>structuredClone(value);
const json=(value:unknown):JsonValue=>JSON.parse(canonicalJson(value)) as JsonValue;
const problem=(code:string,message:string):FailureInfo=>({code,message,retryPolicy:'never'});
function fail(code:string,message:string):never {throw new AppsPresentationError(code,message);}
const text=(value:unknown,label:string):string=>typeof value==='string'&&value.trim()?value:fail('INVALID_INPUT',`${label} is required.`);
const resourceKey=(resource:ResourceRef)=>canonicalJson(resource);
// Exact invocation versions are resolved at read time, not persisted as binding metadata.
function storedBinding(value:DatasetBinding):DatasetBinding {
  const {capabilityVersion:_,...binding}=value as DatasetBinding&{capabilityVersion?:string};
  return clone(binding);
}
function savedAsset(value:JsonValue):JsonValue {
  const asset=value as Record<string,JsonValue>;
  return {...asset,...(Array.isArray(asset.bindings)?{bindings:json((asset.bindings as unknown as DatasetBinding[]).map(storedBinding))}:{})};
}
const declaredResources=(result:CapabilityResult):ResourceRef[]=>{
  if(result.status!=='ok'&&result.status!=='partial')return [];
  const payload=result.data as {resources?:ResourceRef[]}|null;
  return payload&&typeof payload==='object'&&!Array.isArray(payload)&&Array.isArray(payload.resources)?payload.resources:[];
};

/** Shared presentation state. Its only business execution path is the injected Runtime. */
export class AppsPresentationService {
  readonly store:AppsPresentationOptions['store'];
  readonly runtime:AppsPresentationOptions['runtime'];
  readonly sources:AppsPresentationOptions['sources'];
  readonly contexts:ComponentContexts;
  authoring?:AppsAuthoringService;
  private options:AppsPresentationOptions;
  private refreshes=new Map<string,Promise<DatasetSnapshot>>();
  private pages=new Map<string,Map<string,{token:string;data?:AppsBindingData}>>();
  /** A page belongs to one iframe/preview, never to the shared saved binding. */
  clearBindingPages(scope:string):void {this.pages.delete(scope);}
  scopedData(view:AppsView,scope:string):AppsViewData {
    const data=this.dataForView(view),pages=this.pages.get(scope);
    return {...data,bindings:data.bindings.map(binding=>clone(pages?.get(binding.bindingId)?.data??binding))};
  }
  async readBindingPage(view:AppsView,scope:string,input:{bindingId:string;cursor?:string|null},source:InvocationSource,stillCurrent:()=>void=()=>{},signal?:AbortSignal):Promise<AppsViewData> {
    const binding=view.bindings.find(item=>item.bindingId===input.bindingId);
    if(!binding)fail('BINDING_NOT_FOUND','Requested binding is not part of this view.');
    const descriptor=this.runtime.describe(binding.capabilityId)!;
    const original=binding.input as Record<string,JsonValue>;
    const query={...original};if(input.cursor===null||input.cursor===undefined)delete query.cursor;else query.cursor=text(input.cursor,'cursor');
    const errors=compileSchema(descriptor.inputSchema)(query);if(errors.length)fail('INVALID_INPUT',errors.join('; '));
    let pages=this.pages.get(scope);if(!pages){pages=new Map();this.pages.set(scope,pages);}
    const token=randomUUID(),entry={token,data:pages.get(binding.bindingId)?.data};pages.set(binding.bindingId,entry);
    const request:InvocationRequest={protocolVersion:'1.0',appId:binding.appId,connectionId:binding.connectionId,capabilityId:binding.capabilityId,capabilityVersion:descriptor.version,input:query,source,invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString()};
    const result=await this.runtime.invoke(request,signal);stillCurrent();
    if(this.pages.get(scope)?.get(binding.bindingId)!==entry)fail('PAGE_SUPERSEDED','A newer page request replaced this response.');
    if(result.status!=='ok'&&result.status!=='partial')fail('error' in result?result.error.code:'DATASET_NOT_READY','error' in result?result.error.message:'Page data is not ready.');
    const resources=this.options.resources?this.options.resources({...binding,input:query},result):declaredResources(result);this.checkResources(binding,resources);
    const base=this.dataForView(view).bindings.find(item=>item.bindingId===binding.bindingId)!;
    const provenance=result.provenance??[],now=new Date().toISOString();
    const next:AppsBindingData={...base,revision:`page:${token}`,payload:json(result.data),resources:clone(resources),state:'ready',freshness:provenance.some(item=>item.freshness==='stale')?'stale':provenance.length&&provenance.every(item=>item.freshness==='fresh')?'fresh':'unknown',provenance:clone(provenance),lastSuccessAt:now,sourceDataTime:provenance.find(item=>item.sourceDataTime)?.sourceDataTime??null,query:base.query?{...base.query,input:query}:undefined};
    if(result.status==='partial')next.error=clone(result.errors[0]);else delete next.error;
    const data=this.scopedData(view,scope);data.bindings=data.bindings.map(item=>item.bindingId===binding.bindingId?next:item);
    // Do not advance selection state to a page that cannot reach the iframe.
    if(Buffer.byteLength(JSON.stringify(data),'utf8')>250000)fail('BRIDGE_MESSAGE_TOO_LARGE','Page is too large; reduce binding limit or select fewer fields.');
    entry.data=next;return clone(data);
  }
  constructor(options:AppsPresentationOptions){this.options=options;this.store=options.store;this.runtime=options.runtime;this.sources=options.sources;this.contexts=new ComponentContexts(this);}
  configureAuthoring(options:Pick<AppsAuthoringOptions,'validateBuildEvidence'|'validatePreviewEvidence'|'evidenceRoot'|'clock'|'readyTimeoutMs'|'maxUiStateBytes'|'onCancel'|'resolveEvidencePath'|'withEvidencePathScope'>={}):AppsAuthoringService {
    if(!this.sources)fail('SOURCE_STORE_UNAVAILABLE','Authoring requires the existing source archive.');
    if(this.authoring)fail('AUTHORING_ALREADY_CONFIGURED','Authoring service has already been configured.');
    return this.authoring=new AppsAuthoringService({store:this.store,sources:this.sources,presentation:this,...options});
  }
  private binding(value:DatasetBinding):DatasetBinding {
    json(value);text(value.bindingId,'bindingId');text(value.appId,'appId');text(value.connectionId,'connectionId');
    if(!Number.isSafeInteger(value.capabilityMajor)||value.capabilityMajor<1)fail('INVALID_BINDING','A positive capability major is required.');
    if(!Array.isArray(value.projection)||value.projection.some(field=>typeof field!=='string'||!field)||new Set(value.projection).size!==value.projection.length)fail('INVALID_BINDING','Projection must contain unique field names.');
    if(!value.refresh||!['manual','scheduled'].includes(value.refresh.mode))fail('INVALID_BINDING','Refresh mode must be explicit.');
    if(value.refresh.mode==='scheduled'){text(value.refresh.scheduleId,'scheduleId');if(!this.options.scheduledBinding)fail('SCHEDULER_UNAVAILABLE','No running refresh worker is configured.');this.options.scheduledBinding(value);}
    const descriptor=this.runtime.describe(value.capabilityId);
    if(!descriptor)fail('CAPABILITY_UNAVAILABLE',`Binding capability ${value.capabilityId} is unavailable.`);
    if(Number(descriptor.version.split('.')[0])!==value.capabilityMajor)fail('INCOMPATIBLE_CAPABILITY','Binding capability major does not match.');
    if(!['query','compute'].includes(descriptor.effect))fail('QUERY_NOT_READ_ONLY','A data binding cannot invoke a mutation.');
    if(/^apps\.(presentation|authoring)\./.test(descriptor.capabilityId))fail('QUERY_NOT_READ_ONLY','Presentation lifecycle actions cannot serve as their own dataset source.');
    const errors=compileSchema(descriptor.inputSchema)(value.input);if(errors.length)fail('INVALID_BINDING',errors.join('; '));
    const id=datasetId(value);if(value.datasetId!==undefined&&value.datasetId!==id)fail('DATASET_ID_MISMATCH','Binding identity does not match its canonical query.');
    return {...storedBinding(value),datasetId:id};
  }
  createView(sessionId:string|null,input:{title:string;design?:JsonValue;bindings?:DatasetBinding[];viewId?:string;legacyViewId?:string}):AppsView {
    if(sessionId!==null)text(sessionId,'sessionId');text(input.title,'title');
    if(input.viewId&&input.legacyViewId&&input.viewId!==input.legacyViewId)fail('INVALID_INPUT','Historical and current view identities must agree.');
    const existingLegacy=input.legacyViewId?this.getView(input.legacyViewId):undefined;
    const previous=input.viewId?this.ownedView(sessionId,input.viewId):existingLegacy?this.ownedView(sessionId,existingLegacy.viewId):undefined;
    if(input.legacyViewId&&!previous){const saved=this.store.get<AppsComponent>('components',input.legacyViewId);if(saved&&saved.view.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Historical view identity belongs to another session.');}
    const bindings=(input.bindings??previous?.bindings??[]).map(binding=>this.binding(binding));
    if(new Set(bindings.map(binding=>binding.bindingId)).size!==bindings.length)fail('DUPLICATE_BINDING','Binding IDs must be unique within a view.');
    const now=new Date().toISOString();
    const view:AppsView={...(previous??{}),viewId:previous?.viewId??input.legacyViewId??randomUUID(),ownerSessionId:sessionId,title:input.title,design:json(input.design??previous?.design??{}),bindings,createdAt:previous?.createdAt??now,updatedAt:now};
    return clone(this.store.put('views',view.viewId,view));
  }
  openSource(sessionId:string|null,directory:string,input:{title?:string;bindings?:DatasetBinding[];viewId?:string;legacyBindings?:JsonValue[]}={}):AppsView {
    if(!this.sources)fail('SOURCE_STORE_UNAVAILABLE','Source archive is not configured.');
    const previous=input.viewId?this.ownedView(sessionId,input.viewId):undefined;
    // Capture must succeed before the old view is changed.
    const {source,metadata}=this.sources.capture(directory);
    return this.store.transaction(()=>{
      const design=input.legacyBindings?{kind:'source',bindings:json(input.legacyBindings)}:previous?.design??{kind:'source'};
      const view=this.createView(sessionId,{...input,title:input.title??previous?.title??String(metadata.title??metadata.name??'Source component'),design,...(input.bindings?{bindings:input.bindings}:previous?{}:Array.isArray(metadata.bindings)?{bindings:metadata.bindings as DatasetBinding[]}:{} )});
      view.source=source;
      view.validationStatus='legacy_unverified';
      view.viewRevision=(previous?.viewRevision??0)+1;view.activeBuildId=source.buildId;
      const snapshotId='view-revision:'+canonicalJson([sessionId,view.viewId,view.viewRevision]);this.store.put('provider_records',snapshotId,{appId:'apps',connectionId:'presentation',namespace:'view_revisions',recordId:snapshotId,value:clone(view)});
      this.store.put('builds',source.buildId,this.sources!.manifest(source.buildId));this.store.put('artifact_refs',`view:${view.viewId}:${source.buildId}`,{ownerKind:'view',ownerId:view.viewId,targetKind:'build',targetId:source.buildId});return clone(this.store.put('views',view.viewId,view));
    });
  }
  getView(viewId:string):AppsView|undefined{return clone(this.store.get<AppsView>('views',viewId));}
  ownedView(sessionId:string|null,viewId:string):AppsView {
    const view=this.getView(viewId);if(!view)fail('VIEW_NOT_FOUND','View does not exist.');
    if(view.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','View belongs to another session.');
    return view;
  }
  getData(sessionId:string|null,viewId:string,display?:{publicationId:string;buildId:string;displayId:string;displayGeneration:number}):AppsViewData {
    const view=display?this.authoring!.display(sessionId!,{...display,viewId}).view:this.ownedView(sessionId,viewId);
    return this.dataForView(view);
  }
  private dataForView(view:AppsView):AppsViewData {
    return {viewId:view.viewId,bindings:view.bindings.map(binding=>{
      const id=binding.datasetId??datasetId(binding),snapshot=this.store.get<DatasetSnapshot>('datasets',id);
      const descriptor=this.runtime.describe(binding.capabilityId);
      const query=descriptor&&Number(descriptor.version.split('.')[0])===binding.capabilityMajor?{appId:binding.appId,connectionId:binding.connectionId,capabilityId:binding.capabilityId,capabilityVersion:descriptor.version,input:clone(binding.input),projection:clone(binding.projection)}:undefined;
      const base:AppsBindingData={bindingId:binding.bindingId,appId:binding.appId,connectionId:binding.connectionId,datasetId:id,revision:null,payload:null,resources:[],freshness:'unknown',state:'empty',lastSuccessAt:null,sourceDataTime:null,provenance:[]};
      if(query)base.query=query;
      if(!snapshot)return base;
      return {...base,revision:snapshot.revision,payload:clone(snapshot.payload),resources:clone(snapshot.resources),freshness:snapshot.freshness,state:snapshot.state,lastSuccessAt:snapshot.lastSuccessAt,sourceDataTime:snapshot.sourceDataTime,provenance:clone(snapshot.provenance),...(snapshot.error?{error:clone(snapshot.error)}:{})};
    })};
  }
  async refreshView(sessionId:string|null,viewId:string,source:InvocationSource,bindingIds?:string[],signal?:AbortSignal):Promise<AppsViewData> {
    const view=this.ownedView(sessionId,viewId),selected=bindingIds?new Set(bindingIds):undefined;
    if(selected&&[...selected].some(id=>!view.bindings.some(binding=>binding.bindingId===id)))fail('BINDING_NOT_FOUND','Requested binding is not part of this view.');
    await Promise.all(view.bindings.filter(binding=>!selected||selected.has(binding.bindingId)).map(async binding=>{
      try{await this.refreshBinding(binding,source,signal);}catch(error){
        const id=binding.datasetId??datasetId(binding),previous=this.store.get<DatasetSnapshot>('datasets',id);
        const snapshot:DatasetSnapshot={datasetId:id,canonicalBinding:json(canonicalBinding(binding)),revision:previous?.revision??'0',payload:previous?.payload??null,resources:previous?.resources??[],fetchedAt:previous?.fetchedAt??new Date().toISOString(),sourceDataTime:previous?.sourceDataTime??null,lastSuccessAt:previous?.lastSuccessAt??'',provenance:previous?.provenance??[],state:'unavailable',freshness:previous?'stale':'unknown',error:problem((error as AppsPresentationError).code??'REFRESH_FAILED',error instanceof Error?error.message:String(error))};
        this.store.put('datasets',id,snapshot);
      }
    }));
    return this.getData(sessionId,viewId);
  }
  async refreshBinding(raw:DatasetBinding,source:InvocationSource,signal?:AbortSignal):Promise<DatasetSnapshot> {
    const binding=this.binding(raw),id=binding.datasetId!;
    const active=this.refreshes.get(id);if(active)return active;
    const work=this.load(binding,source,signal);this.refreshes.set(id,work);
    try{return await work;}finally{if(this.refreshes.get(id)===work)this.refreshes.delete(id);}
  }
  private async load(binding:DatasetBinding,source:InvocationSource,signal?:AbortSignal):Promise<DatasetSnapshot> {
    const id=binding.datasetId!,descriptor=this.runtime.describe(binding.capabilityId)!;
    const request:InvocationRequest={protocolVersion:'1.0',appId:binding.appId,connectionId:binding.connectionId,invocationId:randomUUID(),traceId:randomUUID(),capabilityId:binding.capabilityId,capabilityVersion:descriptor.version,input:clone(binding.input),source:clone(source),deadlineAt:new Date(Date.now()+descriptor.execution.timeoutMs).toISOString()};
    let result:CapabilityResult;
    try{result=await this.runtime.invoke(request,signal);}catch(error){result={status:'unavailable',invocationId:request.invocationId,traceId:request.traceId,error:problem('REFRESH_FAILED',error instanceof Error?error.message:String(error))};}
    return this.store.transaction(()=>{
      const previous=this.store.get<DatasetSnapshot>('datasets',id),now=new Date().toISOString(),canonical=json(canonicalBinding(binding));
      if(previous&&canonicalJson(previous.canonicalBinding)!==canonicalJson(canonical))fail('DATASET_HASH_CONFLICT','Stored dataset has a different canonical binding.');
      if(result.status!=='ok'&&result.status!=='partial'){
        const error='error' in result?result.error:problem('DATASET_NOT_READY',`Query returned ${result.status}.`);
        const failed:DatasetSnapshot={datasetId:id,canonicalBinding:canonical,revision:previous?.revision??'0',payload:previous?.payload??null,resources:previous?.resources??[],fetchedAt:previous?.fetchedAt??now,sourceDataTime:previous?.sourceDataTime??null,lastSuccessAt:previous?.lastSuccessAt??'',freshness:previous?'stale':'unknown',state:result.status==='unavailable'?'unavailable':'failed',provenance:previous?.provenance??[],error};
        return clone(this.store.put('datasets',id,failed));
      }
      const resources=this.options.resources?this.options.resources(binding,result):declaredResources(result);
      this.checkResources(binding,resources);
      const provenance=result.provenance??[],sourceDataTime=provenance.find(item=>item.sourceDataTime!==null)?.sourceDataTime??null;
      const snapshot:DatasetSnapshot={datasetId:id,canonicalBinding:canonical,revision:String(Number(previous?.revision??0)+1),payload:json(result.data),resources:clone(resources),fetchedAt:now,sourceDataTime,lastSuccessAt:now,freshness:provenance.some(item=>item.freshness==='stale')?'stale':provenance.length&&provenance.every(item=>item.freshness==='fresh')?'fresh':'unknown',state:'ready',provenance:clone(provenance),...(result.status==='partial'?{error:result.errors[0]}:{})};
      return clone(this.store.put('datasets',id,snapshot));
    });
  }
  private checkResources(binding:DatasetBinding,resources:ResourceRef[]):void {
    if(!Array.isArray(resources))fail('INVALID_RESOURCE_REFERENCE','Provider resource resolver must return ResourceRef[].');
    const seen=new Set<string>();
    for(const resource of resources){if(resource.appId!==binding.appId||resource.connectionId!==binding.connectionId||!resource.resourceType||!resource.resourceId)fail('INVALID_RESOURCE_REFERENCE','Resource identity must match its explicit binding.');const key=resourceKey(resource);if(seen.has(key))fail('AMBIGUOUS_RESOURCES','Dataset contains duplicate resource identities.');seen.add(key);}
  }
  validateSelection(sessionId:string,viewId:string,envelope:SelectionEnvelope):SelectionEnvelope {
    return this.selectionForView(this.ownedView(sessionId,viewId),envelope);
  }
  validateDisplaySelection(sessionId:string,identity:CandidateFrameIdentity,envelope:SelectionEnvelope):SelectionEnvelope {
    if(identity.sessionId!==sessionId||!identity.displayId||!identity.displayGeneration||!this.authoring?.acceptsDisplayFrame(identity))fail('BRIDGE_IDENTITY_STALE','Selection is not from the current display document.');
    return this.selectionForView(this.authoring.display(sessionId,{...identity,displayId:identity.displayId,displayGeneration:identity.displayGeneration}).view,envelope);
  }
  private selectionForView(view:AppsView,envelope:SelectionEnvelope):SelectionEnvelope {
    return validateDataSelection(this.dataForView(view),envelope);
  }
  saveComponent(sessionId:string|null,viewId:string,userRequest:string,options:SaveAppsComponentOptions):AppsComponent {
    text(userRequest,'userRequest');const original=this.ownedView(sessionId,viewId),view={...original,title:options.title!==undefined?text(options.title,'title'):original.title};
    if(!['save_as','update'].includes(options.mode))fail('INVALID_SAVE_MODE','Explicit save mode is required.');
    if(options.mode==='update'&&(!options.componentId||!Number.isSafeInteger(options.expectedRevision)||options.expectedRevision!<1))fail('EXPECTED_REVISION_REQUIRED','Update requires componentId and expectedRevision.');
    if(options.mode==='save_as'&&(options.componentId!==undefined||options.expectedRevision!==undefined))fail('INVALID_INPUT','Save-as does not accept update preconditions.');
    return this.store.transaction(()=>{
      // The generic capability shares this write path with explicit authoring saves.
      // Views outside authoring retain their established static/legacy save behavior.
      if(this.store.list<{viewId:string}>('authoring_drafts').some(draft=>draft.viewId===view.viewId)){
        if(view.pendingPublicationId)fail('VIEW_CONFLICT','Open and confirm the pending authoring publication before saving.');
        const mounted=this.store.list<ViewPublication>('view_publications').find(publication=>publication.viewId===view.viewId&&publication.ownerSessionId===sessionId&&publication.state==='mounted'&&publication.committedViewRevision===view.viewRevision&&publication.candidateBuildId===view.activeBuildId);
        if(view.validationStatus!=='verified'||!Number.isSafeInteger(view.viewRevision)||!view.source||view.activeBuildId!==view.source.buildId||!mounted||!this.sources?.verify(view.source.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Authoring views require a confirmed mounted build before saving.');
      }
      if(options.legacyComponentId!==undefined&&(options.mode!=='save_as'||options.legacyComponentId!==view.viewId))fail('INVALID_INPUT','Historical component identity must match its owning draft.');
      const componentId=options.mode==='save_as'?options.legacyComponentId??randomUUID():options.componentId!,previous=this.store.get<AppsComponent>('components',componentId);
      if(options.legacyComponentId!==undefined&&previous)fail('COMPONENT_CONFLICT','Historical component already exists. Reopen it before updating.');
      if(options.mode==='update'&&(!previous||previous.revision!==options.expectedRevision))fail('COMPONENT_CONFLICT','Component changed. Reopen it or save as a new component.');
      if(view.source&&this.sources)view.source=this.sources.withPreview(view.source);
      const revision=(previous?.revision??0)+1,component:AppsComponent={componentId,revision,title:view.title,view:clone(view),userRequest,savedAt:new Date().toISOString(),...(options.legacyTemplate??previous?.legacyTemplate?{legacyTemplate:clone(options.legacyTemplate??previous!.legacyTemplate!)}:{})};
      this.store.put('views',view.viewId,view);
      this.store.put('component_versions',`${componentId}:${revision}`,component);this.store.put('components',componentId,component);
      const entries=this.store.list<Record<string,JsonValue>>('saved_assets').filter(asset=>asset.kind==='entry'),entry=entries.find(asset=>asset.componentId===componentId),assetId=entry?.assetId??randomUUID();
      this.store.put('saved_assets',`entry:${assetId}`,{...entry,assetId,kind:'entry',entryKind:'component',componentId,title:view.title,userRequest,pinned:entry?.pinned??false,order:entry?.order??entries.length});
      if(view.source)this.store.put('artifact_refs',`component:${componentId}:${revision}:${view.source.buildId}`,{ownerKind:'component_version',ownerId:`${componentId}:${revision}`,targetKind:'build',targetId:view.source.buildId});
      return clone(component);
    });
  }
  private openSaved(sessionId:string|null,bindings:DatasetBinding[],open:()=>AppsView):AppsView {
    if(sessionId===null||!bindings.length)return open();
    if(!this.runtime.getConnection||!this.runtime.bind)fail('SAVED_CONNECTION_UNAVAILABLE','当前宿主无法启用保存内容的数据连接，请更新宿主后重试。');
    const connections=[...new Map(bindings.map(({appId,connectionId})=>[canonicalJson([appId,connectionId]),{appId,connectionId}])).values()];
    // Validate every exact connection before creating a checkout or changing session bindings.
    for(const {appId,connectionId} of connections){
      const connection=this.runtime.getConnection(appId,connectionId);
      if(!connection)fail('SAVED_CONNECTION_MISSING',`保存内容使用的连接 ${appId}/${connectionId} 已不存在。请在应用设置中恢复该连接后重试；如需换连接，请明确重新配置数据绑定。`);
      if(!connection.enabled)fail('SAVED_CONNECTION_DISABLED',`保存内容使用的连接 ${appId}/${connectionId} 已停用。请在应用设置中启用该连接后重试。`);
    }
    return this.store.transaction(()=>{
      const view=open(),enabled=this.runtime.sessionBindings?.(sessionId)??[];
      for(const connection of connections)if(!enabled.some(binding=>binding.appId===connection.appId&&binding.connectionId===connection.connectionId&&binding.enabled))this.runtime.bind!({sessionId,...connection,enabled:true,boundAt:new Date().toISOString()});
      return view;
    });
  }
  openComponent(sessionId:string|null,componentId:string,options:{revision?:number;directory?:string}={}):AppsView {
    if(sessionId!==null)text(sessionId,'sessionId');const latest=this.store.get<AppsComponent>('components',componentId);if(!latest)fail('COMPONENT_NOT_FOUND','Saved component does not exist.');
    const selected=options.revision===undefined?latest:this.store.get<AppsComponent>('component_versions',`${componentId}:${options.revision}`);if(!selected)fail('COMPONENT_REVISION_NOT_FOUND','Saved revision does not exist.');
    return this.openSaved(sessionId,selected.view.bindings,()=>{
      const now=new Date().toISOString(),view:AppsView={...clone(selected.view),viewId:randomUUID(),ownerSessionId:sessionId,createdAt:now,updatedAt:now,sourceComponentId:componentId,baseRevision:latest.revision,baseRevisionAtOpen:latest.revision,selectedSourceRevision:selected.revision,pendingPublicationId:null};
      if(view.source){if(!this.sources)fail('SOURCE_STORE_UNAVAILABLE','Source archive is not configured.');view.source=this.sources.checkout(view.source,options.directory);}
      // Opening reuses connection references without executing business queries.
      return this.store.transaction(()=>{if(view.source)this.store.put('artifact_refs',`view:${view.viewId}:${view.source.buildId}`,{ownerKind:'view',ownerId:view.viewId,targetKind:'build',targetId:view.source.buildId});return clone(this.store.put('views',view.viewId,view));});
    });
  }
  componentVersions(componentId:string):AppsComponent[]{return clone(this.store.list<AppsComponent>('component_versions').filter(item=>item.componentId===componentId).sort((a,b)=>a.revision-b.revision));}
  saveTemplate(sessionId:string|null,viewId:string,name:string,userRequest:string,description=''):Record<string,JsonValue> {
    const view=this.ownedView(sessionId,viewId);text(userRequest,'userRequest');text(name,'name');
    const asset={assetId:randomUUID(),kind:'template',title:name,description,design:clone(view.design),bindings:view.bindings.map(storedBinding),...(view.source?{source:this.sources?this.sources.withPreview(clone(view.source)):clone(view.source)}:{}),userRequest,savedAt:new Date().toISOString()};
    return this.store.transaction(()=>{if(view.source)this.store.put('artifact_refs',`template:${asset.assetId}:${view.source.buildId}`,{ownerKind:'saved_asset',ownerId:`template:${asset.assetId}`,targetKind:'build',targetId:view.source.buildId});return json(this.store.put('saved_assets',`template:${asset.assetId}`,asset)) as Record<string,JsonValue>;});
  }
  openTemplate(sessionId:string|null,templateId:string,options:{title?:string;bindings?:DatasetBinding[];directory?:string;legacyBindings?:JsonValue[]}={}):AppsView {
    const asset=this.store.get<{title:string;design:JsonValue;bindings:DatasetBinding[];source?:AppsView['source']}>('saved_assets',`template:${templateId}`);if(!asset)fail('TEMPLATE_NOT_FOUND','Saved template does not exist.');
    const title=options.title??asset.title,bindings=options.bindings?.length?options.bindings:asset.bindings,design={...(asset.design&&typeof asset.design==='object'&&!Array.isArray(asset.design)?asset.design:{}),...(options.legacyBindings?{bindings:json(options.legacyBindings)}:{}),templateId};
    return this.openSaved(sessionId,bindings,()=>{
      if(asset.source){if(!this.sources)fail('SOURCE_STORE_UNAVAILABLE','Source archive is not configured.');const source=this.sources.checkout(asset.source,options.directory);const view=this.openSource(sessionId,source.directory,{title,bindings});view.design=clone(design);return clone(this.store.put('views',view.viewId,view));}
      return this.createView(sessionId,{title,bindings,design});
    });
  }
  async hydrateSourceView(view:AppsView,source:InvocationSource,signal?:AbortSignal):Promise<AppsView & {initialData?:{bindingId:string;datasetId:string;status:string}[]}> {
    if(!view.source)return view;
    const design=view.design&&typeof view.design==='object'&&!Array.isArray(view.design)?view.design:{},legacy=Array.isArray(design.bindings)?design.bindings as unknown as {id?:string;query?:unknown}[]:undefined;
    const missing=this.getData(view.ownerSessionId,view.viewId).bindings.filter(binding=>binding.payload===null&&(!legacy||legacy.find(value=>value.id===binding.bindingId)?.query)).map(binding=>binding.bindingId);
    if(!missing.length)return view;
    const data=await this.refreshView(view.ownerSessionId,view.viewId,source,missing,signal);
    return {...view,initialData:data.bindings.filter(binding=>missing.includes(binding.bindingId)).map(binding=>({bindingId:binding.bindingId,datasetId:binding.datasetId,status:binding.state}))};
  }
  createHost(identity:BridgeIdentity,options:{signal?:AbortSignal;attachSelection?:NonNullable<AppsPresentationOptions['attachSelection']>;candidate?:CandidateFrameIdentity;clientFeatures?:string[]}={}):ComponentHost {
    const displayIdentity=options.candidate?.displayId&&options.candidate.displayGeneration?{...options.candidate,displayId:options.candidate.displayId,displayGeneration:options.candidate.displayGeneration}:undefined;
    const current=()=>{const view=this.ownedView(identity.sessionId,identity.viewId);if(displayIdentity){if(!this.authoring?.acceptsDisplayFrame(displayIdentity))fail('BRIDGE_IDENTITY_STALE','The display document was replaced; reopen the component.');return this.authoring.display(identity.sessionId,displayIdentity).view;}if((view.source&&view.source.buildId!==identity.buildId||view.validationStatus==='draft_unpublished')&&!this.authoring?.acceptsFrame(options.candidate??identity as CandidateFrameIdentity))fail('BRIDGE_IDENTITY_STALE','View build changed. Reopen the component.');return view;};
    const initial=current(),pageScope=canonicalJson(identity),data=()=>this.scopedData(current(),pageScope);
    // A fixed historical display gets its own build context pointer; immutable evidence
    // and the session's active context remain in the existing Runtime-owned store.
    const contextKey=(key:string)=>displayIdentity&&key===`view:${identity.sessionId}:${identity.viewId}`?`${key}:build:${identity.buildId}`:key;
    const contexts=new ComponentContexts({store:{...this.store,get:<T>(collection:string,key:string)=>this.store.get<T>(collection,collection==='component_contexts'?contextKey(key):key),put:<T>(collection:string,key:string,value:T)=>this.store.put(collection,collection==='component_contexts'?contextKey(key):key,value),list:<T>(collection:string)=>this.store.list<T>(collection),delete:(collection:string,key:string)=>this.store.delete(collection,collection==='component_contexts'?contextKey(key):key),transaction:<T>(action:()=>T)=>this.store.transaction(action)},ownedView:()=>current(),getData:data,validateSelection:(_session,_view,selection)=>validateDataSelection(data(),selection)});
    const contextInfo=()=>{const view=current();return {...contexts.get({...identity,buildId:view.source?.buildId??identity.buildId}),...identity};};
    const source:InvocationSource={kind:'component',sessionId:identity.sessionId,viewId:identity.viewId,frameInstanceId:identity.frameInstanceId};
    return new ComponentHost(identity,{
      getData:()=>json(data()),
      getContext:()=>{current();const publication=options.candidate?this.store.get<ViewPublication>('view_publications',options.candidate.publicationId):undefined;return json({...contextInfo(),...(publication?{publication:{publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,documentNonce:displayIdentity?.documentNonce??publication.documentNonce,...(displayIdentity?{displayId:displayIdentity.displayId,displayGeneration:displayIdentity.displayGeneration}:{})}}:{})});},
      ...(initial.source?{
        updateContext:(request:import('../../app-contracts/src/index.ts').BridgeRequest)=>{current();return json(contexts.update(identity,request.requestId,request.params as never));},
        requestAgent:(request:import('../../app-contracts/src/index.ts').BridgeRequest)=>{current();return json(contexts.prepare(identity,request.requestId,request.params as never));},
      }:{}),
      refresh:async request=>{this.clearBindingPages(pageScope);const view=current(),bindingIds=(request.params as {bindingIds?:string[]}|null)?.bindingIds;if(!displayIdentity)return this.refreshView(identity.sessionId,identity.viewId,source,bindingIds,options.signal).then(json);if(bindingIds?.some(id=>!view.bindings.some(binding=>binding.bindingId===id)))fail('BINDING_NOT_FOUND','Requested binding is not part of this fixed display.');await Promise.all(view.bindings.filter(binding=>!bindingIds||bindingIds.includes(binding.bindingId)).map(binding=>this.refreshBinding(binding,source,options.signal)));return json(this.dataForView(current()));},
      attachSelection:async request=>{const selection=validateDataSelection(data(),request.params as unknown as SelectionEnvelope),attach=options.attachSelection??this.options.attachSelection;if(!attach)fail('UNSUPPORTED_HOST_CAPABILITY','Native attachments are unavailable.');return attach(identity,selection);},
      invokeCapability:async request=>{
        const view=current();
        const input=request.params as unknown as Omit<InvocationRequest,'protocolVersion'|'invocationId'|'traceId'|'source'|'deadlineAt'>&{deadlineAt?:string};
        if(!input||typeof input!=='object')fail('INVALID_INPUT','Capability invocation requires explicit routing and input.');
        if(!view.bindings.some(binding=>binding.appId===input.appId&&binding.connectionId===input.connectionId))fail('CONNECTION_NOT_BOUND','Capability route is not bound to this component.');
        const deadlineAt=input.deadlineAt===undefined?new Date(Date.now()+Math.min(90000,this.runtime.describe(input.capabilityId,input.capabilityVersion)?.execution.timeoutMs??30000)).toISOString():input.deadlineAt;
        const result=await this.runtime.invoke({protocolVersion:'1.0',appId:input.appId,connectionId:input.connectionId,capabilityId:input.capabilityId,capabilityVersion:input.capabilityVersion,input:input.input,deadlineAt,invocationId:randomUUID(),traceId:randomUUID(),source,...(input.idempotencyKey?{idempotencyKey:input.idempotencyKey}:{}),...(input.expectedResourceRevision?{expectedResourceRevision:input.expectedResourceRevision}:{})},options.signal);
        return json(result);
      },
    },{contextRevision:()=>contextInfo().contextRevision,clientFeatures:options.clientFeatures,extensionHandlers:{bindingPagesV1:async request=>{if(request.action!=='read')fail('INVALID_INPUT','Unknown binding page action.');return json(await this.readBindingPage(current(),pageScope,request.params as unknown as {bindingId:string;cursor?:string|null},source,current,options.signal));},...(this.authoring?{
      renderReadyV1:request=>{if(request.action!=='ready'||!options.candidate)fail('FRAME_NOT_READY','No authorized candidate publication.');const params=request.params as unknown as {checks:Parameters<AppsAuthoringService['confirmReady']>[1]['checks']};return json(displayIdentity?this.authoring!.confirmDisplayReady(identity.sessionId,{...displayIdentity,...identity,checks:params.checks}):this.authoring!.confirmReady(identity.sessionId,{...options.candidate,...identity,checks:params.checks}));},
      uiStateV1:request=>{const params=request.params as unknown as {uiStateSchemaVersion:number;expectedStateRevision?:number;value?:JsonValue;state?:JsonValue;selectionEvidence?:Parameters<AppsAuthoringService['exportUiState']>[1]['selectionEvidence']};current();if(request.action==='read')return json(this.authoring!.restoreUiState(identity.sessionId,{viewId:identity.viewId,targetBuildId:identity.buildId,uiStateSchemaVersion:params.uiStateSchemaVersion},options.candidate));if(request.action==='write')return json(this.authoring!.exportUiState(identity.sessionId,{viewId:identity.viewId,sourceBuildId:identity.buildId,uiStateSchemaVersion:params.uiStateSchemaVersion,expectedStateRevision:params.expectedStateRevision??0,value:params.value??params.state??null,selectionEvidence:params.selectionEvidence??[]},displayIdentity));fail('INVALID_INPUT','Unknown UI state action.');},
    }:{})}});
  }
  /** Runtime registration adapter. The shared provider has no application-domain imports. */
  provider():AppProvider {
    const manifest:AppManifest={manifestVersion:1,appId:'apps',displayName:'Shared presentation',providerPackage:'@dsh/app-presentation',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['component','template','entry']};
    return {manifest,descriptors:[...APP_PRESENTATION_DESCRIPTORS,...APP_AUTHORING_DESCRIPTORS],execute:context=>this.execute(context),inspect:async(operationId,context)=>this.inspectMutation(operationId,context),dispose:async()=>{}};
  }
  async execute(context:ExecutionContext):Promise<CapabilityResult> {
    const {request}=context,params=request.input as Record<string,JsonValue>;
    const sessionId='sessionId' in request.source?request.source.sessionId:undefined;
    const output=(data:unknown):CapabilityResult=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:json(data)});
    try{
      if(!sessionId)fail('SESSION_REQUIRED','Presentation actions require an explicit owning session.');
      const descriptor=[...APP_PRESENTATION_DESCRIPTORS,...APP_AUTHORING_DESCRIPTORS].find(item=>item.capabilityId===request.capabilityId);
      if(descriptor?.effect==='mutation')return this.executeMutation(context,sessionId,descriptor);
      if(request.capabilityId.startsWith('apps.authoring.')){
        if(!this.authoring)fail('AUTHORING_UNAVAILABLE','Authoring is not configured.');
        const action=request.capabilityId.slice('apps.authoring.'.length);
        switch(action){
          case 'begin':return output(this.authoring.begin(sessionId,{...params,invocationId:request.invocationId} as never));
          case 'record_build':return output(await this.authoring.recordBuild(sessionId,params as never));
          case 'record_preview':return output(await this.authoring.recordPreview(sessionId,params as never));
          case 'publish':return output(this.authoring.publish(sessionId,params as never));
          case 'inspect':return output(this.authoring.inspect(sessionId,params as never));
          case 'cancel':return output(this.authoring.cancel(sessionId,params as never));
          default:fail('CAPABILITY_NOT_FOUND','Unknown authoring action.');
        }
      }
      switch(request.capabilityId){
        case 'apps.presentation.render_view':{
          const required=params.requiredBindingIds as unknown as string[]|undefined,bindings=params.bindings as unknown as DatasetBinding[]??[];
          if(required)for(const id of required){const binding=bindings.find(value=>value.bindingId===id);if(!binding)fail('BINDING_NOT_FOUND','Required binding is not part of this view.');const snapshot=await this.refreshBinding(binding,request.source,context.signal);if(snapshot.state!=='ready')fail(snapshot.error?.code??'DATASET_NOT_READY',snapshot.error?.message??'Required data is unavailable.');}
          if(params.legacyNeedsSpecification)return {status:'needs_clarification',invocationId:request.invocationId,traceId:request.traceId,missing:['spec/templateId'],candidates:[],question:'请给出 ViewSpec 或已有模板与绑定。'};
          const view=typeof params.templateId==='string'?this.openTemplate(sessionId,params.templateId,params as unknown as Parameters<AppsPresentationService['openTemplate']>[2]):this.createView(sessionId,params as unknown as Parameters<AppsPresentationService['createView']>[1]);return output(await this.hydrateSourceView(view,request.source,context.signal));
        }
        case 'apps.presentation.update_view':{
          const view=this.ownedView(sessionId,text(params.viewId,'viewId'));
          // New callers update complete design JSON; historical JSON Patch stays in PresentationManager.
          return output(this.createView(sessionId,{viewId:view.viewId,title:typeof params.title==='string'?params.title:view.title,design:params.design??view.design,bindings:params.bindings as unknown as DatasetBinding[]|undefined}));
        }
        case 'apps.presentation.open_source_component':{
          const view=this.openSource(sessionId,text(params.directory,'directory'),params as unknown as Parameters<AppsPresentationService['openSource']>[2]);return output(await this.hydrateSourceView(view,request.source,context.signal));
        }
        case 'apps.presentation.open_component':return output(await this.hydrateSourceView(this.openComponent(sessionId,text(params.componentId,'componentId'),params as unknown as Parameters<AppsPresentationService['openComponent']>[2]),request.source,context.signal));
        case 'apps.presentation.list_saved':return output({components:this.store.list<AppsComponent>('components').map(component=>({...component,revisions:this.componentVersions(component.componentId).map(version=>({revision:version.revision,title:version.title,savedAt:version.savedAt,...(version.view.source?{buildId:version.view.source.buildId}:{})}))})),assets:this.store.list<JsonValue>('saved_assets').map(savedAsset)});
        default:fail('CAPABILITY_NOT_FOUND','Unknown shared presentation action.');
      }
    }catch(error){return {status:'failed',invocationId:request.invocationId,traceId:request.traceId,error:problem((error as AppsPresentationError).code??'PRESENTATION_FAILED',error instanceof Error?error.message:String(error))};}
  }
  /** Local mutations commit their validated result and receipt with the asset in one SQLite transaction. */
  private executeMutation(context:ExecutionContext,sessionId:string,descriptor:CapabilityDescriptor):CapabilityResult {
    const {request,operationId}=context,params=request.input as Record<string,JsonValue>;
    const output=(data:unknown):CapabilityResult=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:json(data)});
    const write=():CapabilityResult=>{
      switch(request.capabilityId){
        case 'apps.authoring.save_component':
          if(!this.authoring)fail('AUTHORING_UNAVAILABLE','Authoring is not configured.');
          return output(this.authoring.saveComponent(sessionId,params as never));
        case 'apps.presentation.save_component':return output(this.saveComponent(sessionId,text(params.viewId,'viewId'),text(params.userRequest,'userRequest'),params as unknown as SaveAppsComponentOptions));
        case 'apps.presentation.save_entry':{
          text(params.userRequest,'userRequest');const binding=this.binding(params.binding as unknown as DatasetBinding),asset={assetId:randomUUID(),kind:'entry',entryKind:'data',title:text(params.title,'title'),binding,...(params.legacyBinding?{legacyBinding:json(params.legacyBinding),...(params.legacyFieldOrder?{legacyFieldOrder:json(params.legacyFieldOrder)}:{})}:{}),userRequest:params.userRequest,pinned:false,order:this.store.list<Record<string,JsonValue>>('saved_assets').filter(asset=>asset.kind==='entry').length};return output(this.store.put('saved_assets',`entry:${asset.assetId}`,asset));
        }
        case 'apps.presentation.save_template':{
          return output(this.saveTemplate(sessionId,text(params.viewId,'viewId'),text(params.name,'name'),text(params.userRequest,'userRequest'),typeof params.description==='string'?params.description:''));
        }
        case 'apps.presentation.manage_saved':return output(params.kind==='component'&&params.expectedRevision!==undefined&&this.authoring?this.authoring.manageSavedComponent(sessionId,{componentId:String(params.id),expectedRevision:Number(params.expectedRevision),action:params.action,title:params.name} as never):this.manageSaved(params));
        default:fail('CAPABILITY_NOT_FOUND','Unknown shared presentation mutation.');
      }
    };
    const remember=(result:CapabilityResult)=>{
      if(operationId){const recordId=`presentation-mutation:${operationId}`;this.store.put('provider_records',recordId,{appId:'apps',connectionId:request.connectionId,namespace:'presentation_mutations',recordId,value:{capabilityId:request.capabilityId,requestHash:requestHash(request),result}});}
      return result;
    };
    try{return this.store.transaction(()=>{
      const result=write(),errors='data' in result?compileSchema(descriptor.outputSchema)(result.data):[];
      if(errors.length)fail('OUTPUT_SCHEMA_INVALID',errors.join('; '));
      return remember(result);
    });}catch(error){
      return remember({status:'failed',invocationId:request.invocationId,traceId:request.traceId,error:problem((error as AppsPresentationError).code??'PRESENTATION_FAILED',error instanceof Error?error.message:String(error))});
    }
  }
  private inspectMutation(operationId:string,{request}:ExecutionContext):CapabilityResult {
    const receipt=this.store.get<{connectionId:string;value:{capabilityId:string;requestHash:string;result:CapabilityResult}}>('provider_records',`presentation-mutation:${operationId}`);
    if(receipt&&receipt.connectionId===request.connectionId&&receipt.value.capabilityId===request.capabilityId&&receipt.value.requestHash===requestHash(request))return {...receipt.value.result,invocationId:request.invocationId,traceId:request.traceId};
    // Pre-receipt template saves can be recovered only from one matching asset within the original dispatch window.
    const operation=this.store.get<{request:InvocationRequest;createdAt:string;updatedAt:string;result?:CapabilityResult}>('operations',operationId);
    if(request.capabilityId==='apps.presentation.save_template'&&operation?.result&&'error' in operation.result&&operation.result.error.code==='OUTPUT_SCHEMA_INVALID'&&/^\$\.bindings\[\d+\]\.capabilityVersion: unknown field$/.test(operation.result.error.message)){
      const original=operation.request,params=original.input as Record<string,JsonValue>,sessionId='sessionId' in original.source?original.source.sessionId:undefined;
      const view=this.getView(String(params.viewId));
      if(view&&view.ownerSessionId===sessionId){
        const sourceIdentity=(source:unknown)=>{const value=source as AppsView['source'];return value?{buildId:value.buildId,directory:value.directory,entry:value.entry,files:value.files}:null;};
        const candidates=this.store.list<Record<string,JsonValue>>('saved_assets').filter(asset=>
          asset.kind==='template'&&asset.title===params.name&&asset.userRequest===params.userRequest&&asset.description===(params.description??'')&&
          typeof asset.savedAt==='string'&&asset.savedAt>=operation.createdAt&&asset.savedAt<=operation.updatedAt&&
          canonicalJson(asset.design)===canonicalJson(view.design)&&canonicalJson(sourceIdentity(asset.source))===canonicalJson(sourceIdentity(view.source))&&
          Array.isArray(asset.bindings)&&canonicalJson((asset.bindings as unknown as DatasetBinding[]).map(storedBinding))===canonicalJson(view.bindings.map(storedBinding)));
        if(candidates.length===1)return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:savedAsset(candidates[0])};
      }
    }
    return {status:'unknown',invocationId:request.invocationId,traceId:request.traceId,error:{code:'PRESENTATION_RECEIPT_NOT_FOUND',message:'No conclusive local mutation receipt; the original action was not repeated.',retryPolicy:'inspect_only'},operation:{operationId,state:'unknown'}};
  }
  manageSaved(params:Record<string,JsonValue>):JsonValue {
    const kind=text(params.kind,'kind'),id=text(params.id,'id'),action=text(params.action,'action');
    if(kind==='component'){
      const current=this.store.get<AppsComponent>('components',id);if(!current)fail('COMPONENT_NOT_FOUND','Component does not exist.');
      if(action==='delete'){this.store.transaction(()=>{this.store.delete('components',id);for(const entry of this.store.list<Record<string,JsonValue>>('saved_assets'))if(entry.kind==='entry'&&entry.componentId===id)this.store.delete('saved_assets',`entry:${entry.assetId}`);});return {deleted:true,id};}
      if(action!=='rename')fail('INVALID_INPUT','Components support rename or delete.');
      const title=text(params.name,'name');return json(this.store.transaction(()=>{const next={...current,revision:current.revision+1,title,view:{...current.view,title},savedAt:current.view.source?new Date().toISOString():current.savedAt};this.store.put('component_versions',`${id}:${next.revision}`,next);for(const entry of this.store.list<Record<string,JsonValue>>('saved_assets'))if(entry.kind==='entry'&&entry.componentId===id)this.store.put('saved_assets',`entry:${entry.assetId}`,{...entry,title});return this.store.put('components',id,next);}));
    }
    if(!['entry','template'].includes(kind))fail('INVALID_INPUT','Unknown asset kind.');
    const key=`${kind}:${id}`,current=this.store.get<Record<string,JsonValue>>('saved_assets',key);if(!current)fail('SAVED_NOT_FOUND','Saved asset does not exist.');
    if(action==='delete'){this.store.delete('saved_assets',key);return {deleted:true,id};}
    if(action==='rename')current.title=text(params.name,'name');
    else if(action==='pin'&&kind==='entry'&&typeof params.pinned==='boolean')current.pinned=params.pinned;
    else if(action==='reorder'&&kind==='entry'&&Number.isSafeInteger(params.order))current.order=params.order;
    else fail('INVALID_INPUT','Invalid saved asset action.');
    return savedAsset(json(this.store.put('saved_assets',key,current)));
  }
}
