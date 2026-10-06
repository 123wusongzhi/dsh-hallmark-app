import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { AppStore } from '../../store/src/index.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { BindingData, ComponentDraft, DataBinding, Entry, Patch, SavedComponent, SaveComponentOptions, Template, ViewSpec, SourceView } from './types.ts';
import { SourceComponentStore } from '../../source-components/src/index.ts';
import { PresentationError, validateBinding, validateViewSpec } from './validation.ts';
import { applyPatch } from './patch.ts';
import { INITIAL_TEMPLATES } from './design.ts';
export * from './types.ts';
export * from './validation.ts';
export * from './patch.ts';
export * from './design.ts';
export * from './renderer.ts';
const clone = <T>(value: T): T => structuredClone(value);
function requested(request: string): void { if (typeof request !== 'string' || !request.trim()) throw new PresentationError('SAVE_NOT_REQUESTED', 'Explicit non-empty userRequest is required to save'); }
function queryId(binding: DataBinding): string { return createHash('sha256').update(JSON.stringify(binding.query)).digest('hex').slice(0,24); }
export function bindingDatasetKey(binding: DataBinding): string { return binding.datasetKey ?? `query:${queryId(binding)}`; }

export class PresentationManager {
  store: AppStore;
  sources: SourceComponentStore;
  #temporary = new Map<string, ViewSpec>();
  constructor(store: AppStore, options:{sourceDirectory?:string;sourceWorkspace?:string} = {}) {
    this.store = store;
    this.sources=new SourceComponentStore(options.sourceDirectory??join(process.env.HALLMARK_APP_DATA_DIR??join(process.env.LOCALAPPDATA??process.cwd(),'dsh-hallmark-app'),'source-components'),options.sourceWorkspace);
    for(const row of store.list<{kind?:string;spec?:ViewSpec}>('views'))if(['source-draft','component-draft'].includes(row.kind??'')&&row.spec)this.#temporary.set(row.spec.id,row.spec);
  }
  private validateSource(spec:ViewSpec):void {
    if(spec.kind!=='source'||!spec.source||!spec.id||typeof spec.title!=='string'||!spec.title.trim()||!Array.isArray(spec.bindings))throw new PresentationError('INVALID_SPEC','源码组件需要名称、构建和数据绑定。');
    if(!this.sources.manifest(spec.source.buildId))throw new PresentationError('SOURCE_BUILD_NOT_FOUND','源码构建不存在。');
    for(const binding of spec.bindings)validateBinding(binding);
  }
  private keepDraft(spec:ViewSpec):void {
    this.#temporary.set(spec.id,clone(spec));
    this.store.transaction(()=>{
      this.store.put('views',`draft:${spec.id}`,{kind:'component-draft',spec});
      // A source preview can refresh a query before publication. Keep its recipe with the draft,
      // independently of the explicitly saved queries/catalog used by the scheduler.
      if(spec.kind==='source')for(const binding of spec.bindings)if(binding.query&&bindingDatasetKey(binding).startsWith('query:')){
        const datasetKey=bindingDatasetKey(binding);this.store.put('views',`draft-query:${datasetKey}`,{kind:'draft-query',datasetKey,tool:binding.query.tool,params:clone(binding.query.params)});
      }
    });
  }
  restoreDraft(spec:ViewSpec):ViewSpec {
    if(spec.kind==='source')this.validateSource(spec);else validateViewSpec(spec);
    this.keepDraft(spec);return clone(spec);
  }
  openSourceComponent(directory:string,options:{title?:string;bindings?:DataBinding[];viewId?:string}={}):SourceView {
    const {source,metadata}=this.sources.capture(directory);
    const previous=options.viewId?this.getView(options.viewId):undefined;
    const view:SourceView={id:options.viewId??randomUUID(),title:options.title??previous?.title??metadata.title??metadata.name??'源码组件',kind:'source',source,layout:{type:'column',children:[]},widgets:[],bindings:clone(options.bindings??previous?.bindings??metadata.bindings??[])};
    this.validateSource(view);view.bindings=view.bindings.map(binding=>({...binding,datasetKey:bindingDatasetKey(binding)}));this.keepDraft(view);return clone(view);
  }
  renderView(spec: ViewSpec): ViewSpec {
    validateViewSpec(spec);
    const copy = clone(spec);
    copy.bindings = copy.bindings.map(binding => ({...binding,datasetKey:bindingDatasetKey(binding)}));
    if (copy.templateId) {
      const template = this.getTemplate(copy.templateId);
      if (!template) throw new PresentationError('TEMPLATE_NOT_FOUND', 'Template not found');
      copy.theme = {...template.theme,...copy.theme};
    }
    this.keepDraft(copy);
    return clone(copy);
  }
  renderFromTemplate(templateId: string, title: string, bindings: DataBinding[],options:{directory?:string}={}): ViewSpec {
    const template = this.getTemplate(templateId);
    if (!template) throw new PresentationError('TEMPLATE_NOT_FOUND', 'Template not found');
    if(template.kind==='source'&&template.source){
      const source=this.sources.checkout(template.source,options.directory);
      const view:SourceView={id:randomUUID(),title,kind:'source',source,templateId,layout:{type:'column',children:[]},widgets:[],bindings:clone(bindings.length?bindings:template.bindings??[])};
      this.validateSource(view);view.bindings=view.bindings.map(binding=>({...binding,datasetKey:bindingDatasetKey(binding)}));this.keepDraft(view);return clone(view);
    }
    const ids = template.contentRules.bindingIds as string[];
    if (bindings.length !== ids.length) throw new PresentationError('INVALID_SPEC', `Template requires ${ids.length} bindings`);
    const mapped = bindings.map((binding,i) => ({...clone(binding),id:ids[i]}));
    return this.renderView({id:randomUUID(),title,templateId,theme:clone(template.theme),layout:clone(template.layout),widgets:clone(template.widgetStyles),bindings:mapped});
  }
  getTemplate(id: string): Template | undefined { return this.store.get<Template>('templates',id) ?? clone(INITIAL_TEMPLATES.find(t => t.id === id)); }
  getView(id: string): ViewSpec | undefined { return clone(this.#temporary.get(id) ?? this.store.get<SavedComponent>('components',id)?.spec); }
  openComponent(id: string,options:{revision?:number;directory?:string}={}): ComponentDraft {
    const saved=this.store.get<SavedComponent>('components',id);
    if(!saved)throw new PresentationError('SAVED_NOT_FOUND','保存的组件不存在或已删除。');
    const selected=options.revision===undefined||options.revision===(saved.revision??1)?saved:this.store.get<SavedComponent>('settings',`source-revision:${id}:${options.revision}`);
    if(!selected)throw new PresentationError('COMPONENT_REVISION_NOT_FOUND','保存版本不存在。');
    const spec=clone(selected.spec);spec.id=randomUUID();
    if(spec.templateId&&!this.getTemplate(spec.templateId))delete spec.templateId;
    if(spec.kind==='source'&&spec.source){spec.source=this.sources.checkout(spec.source,options.directory);this.validateSource(spec);}else validateViewSpec(spec);
    // Saved designs already contain their resolved theme; deleted template sources do not invalidate them.
    this.keepDraft(spec);
    return {spec,sourceComponentId:id,baseRevision:saved.revision??1};
  }
  updateView(id: string, patch: Patch[]): ViewSpec {
    const current = this.getView(id); if (!current) throw new PresentationError('VIEW_NOT_FOUND', 'View not found');
    const updated = applyPatch(current,patch,current.kind==='source'?this.validateSource.bind(this):validateViewSpec);
    // Adjustments are temporary until another explicit save request.
    this.keepDraft(updated);
    return clone(updated);
  }
  private saveBindings(bindings: DataBinding[], userRequest: string): void {
    for (const binding of bindings) if (binding.query) {
      const id = binding.datasetKey?.startsWith('query:') ? binding.datasetKey.slice(6) : queryId(binding);
      this.store.put('queries',id,{id,datasetKey:bindingDatasetKey(binding),tool:binding.query.tool,params:clone(binding.query.params),userRequest});
    }
  }
  saveComponent(id: string, userRequest: string, title?: string, options: SaveComponentOptions = {}): {component: SavedComponent; entry: Entry} {
    requested(userRequest);
    if(options.mode!==undefined&&!['save_as','update'].includes(options.mode))throw new PresentationError('INVALID_SPEC','未知保存方式。');
    if(options.mode==='update'&&(typeof options.componentId!=='string'||!options.componentId.trim()||!Number.isSafeInteger(options.expectedRevision)||options.expectedRevision!<1))throw new PresentationError('INVALID_SPEC','更新原组件需要组件标识和基础版本。');
    if(options.mode!=='update'&&(options.componentId!==undefined||options.expectedRevision!==undefined))throw new PresentationError('INVALID_SPEC','只有更新原组件才能指定目标和基础版本。');
    const spec = this.getView(id); if (!spec) throw new PresentationError('VIEW_NOT_FOUND', 'View not found');
    if (title !== undefined) spec.title = title;
    if(spec.kind==='source'){this.validateSource(spec);spec.source=this.sources.withPreview(spec.source!);}else validateViewSpec(spec);
    const template = spec.templateId ? this.getTemplate(spec.templateId) ?? this.store.get<SavedComponent>('components',id)?.template : undefined;
    return this.store.transaction(() => {
      const targetId=options.mode==='update'?options.componentId!:options.mode==='save_as'?randomUUID():id;
      const previous=this.store.get<SavedComponent>('components',targetId);
      if(options.mode==='update'&&(!previous||(previous.revision??1)!==options.expectedRevision))throw new PresentationError('COMPONENT_CONFLICT','原组件已更新或删除，请重新打开，或另存为新组件。');
      spec.id=targetId;
      const revision=previous?(previous.revision??1)+1:1,savedAt=new Date().toISOString();
      const component:SavedComponent={id:targetId,title:spec.title,spec,...(template?{template:clone(template)}:{}),userRequest,savedAt,revision};
      if(spec.kind==='source'){
        if(previous)this.store.put('settings',`source-revision:${targetId}:${previous.revision??1}`,previous);
        component.revisions=[...(previous?.revisions??(previous?[{revision:previous.revision??1,title:previous.title,savedAt:previous.savedAt,...(previous.spec.source?{buildId:previous.spec.source.buildId}:{})}]:[])),{revision,title:spec.title,savedAt,buildId:spec.source!.buildId}];
      }
      const existing=this.store.list<Entry>('entries').find(e=>e.kind==='component'&&e.viewId===targetId);
      const entry:Entry={...existing,id:existing?.id??randomUUID(),appId:'hallmark',kind:'component',title:spec.title,viewId:targetId,pinned:existing?.pinned??false,order:existing?.order??this.store.list('entries').length};
      this.saveBindings(spec.bindings,userRequest);this.store.put('components',targetId,component);this.store.put('entries',entry.id,{...entry,userRequest});
      // A saved view must not remain shadowed by an older temporary copy of the same ID.
      this.#temporary.delete(targetId);
      this.store.delete('views',`draft:${targetId}`);
      return clone({component,entry});
    });
  }
  saveEntry(binding: DataBinding, title: string, userRequest: string): Entry {
    requested(userRequest); validateBinding(binding);
    if (typeof title !== 'string' || !title.trim()) throw new PresentationError('INVALID_SPEC', 'Entry title required');
    const entry: Entry = {id:randomUUID(),appId:'hallmark',kind:'data',title,binding:clone(binding),pinned:false,order:this.store.list('entries').length};
    this.store.transaction(() => {this.saveBindings([binding],userRequest); this.store.put('entries',entry.id,{...entry,userRequest});});
    return clone(entry);
  }
  saveTemplate(id: string, name: string, userRequest: string, description = ''): Template {
    requested(userRequest);
    const spec = this.getView(id); if (!spec) throw new PresentationError('VIEW_NOT_FOUND','View not found');
    if (typeof name !== 'string' || !name.trim()) throw new PresentationError('INVALID_SPEC','Template name required');
    const template: Template = {id:randomUUID(),name,description,theme:clone(spec.theme ?? {}),layout:clone(spec.layout),widgetStyles:clone(spec.widgets),contentRules:{bindingIds:spec.bindings.map(b => b.id)},version:1};
    if(spec.kind==='source'){template.kind='source';template.source=this.sources.withPreview(clone(spec.source!));template.bindings=clone(spec.bindings);}
    this.store.put('templates',template.id,{...template,userRequest,savedAt:new Date().toISOString()});
    return clone(template);
  }
  listSaved(): {components: SavedComponent[]; entries: Entry[]; templates: Template[]} {
    return {components:this.store.list<SavedComponent>('components'),entries:this.store.list<Entry>('entries').sort((a,b) => a.order-b.order),templates:this.store.list<Template>('templates')};
  }
  manageSaved(kind: 'component'|'entry'|'template', id: string, change: {action:'rename'|'delete'|'reorder'|'pin';name?:string;order?:number;pinned?:boolean}): unknown {
    const collection = {component:'components',entry:'entries',template:'templates'}[kind];
    if (!collection) throw new PresentationError('INVALID_SPEC','Invalid saved kind');
    const current = this.store.get<any>(collection,id); if (!current) throw new PresentationError('SAVED_NOT_FOUND','Saved configuration not found');
    return this.store.transaction(() => {
      if (change.action === 'delete') {
        this.store.delete(collection,id);
        if (kind === 'component') { this.#temporary.delete(id); this.store.delete('views',`draft:${id}`); for (const entry of this.store.list<Entry>('entries')) if (entry.viewId === id) this.store.delete('entries',entry.id); }
        return {deleted:true,id};
      }
      if (change.action === 'rename') {
        if (typeof change.name !== 'string' || !change.name.trim()) throw new PresentationError('INVALID_SPEC','Name required');
        if(kind==='component'&&current.spec.kind==='source')this.store.put('settings',`source-revision:${id}:${current.revision??1}`,current);
        if (kind === 'template') current.name = change.name; else current.title = change.name;
        if (kind === 'component') {
          current.spec.title = change.name;
          current.revision=(current.revision??1)+1;
          if(current.spec.kind==='source'){current.savedAt=new Date().toISOString();current.revisions=[...(current.revisions??[]),{revision:current.revision,title:change.name,savedAt:current.savedAt,buildId:current.spec.source.buildId}];}
          for (const entry of this.store.list<Entry>('entries')) if (entry.viewId === id) this.store.put('entries',entry.id,{...entry,title:change.name});
          this.#temporary.delete(id);
          this.store.delete('views',`draft:${id}`);
        }
      } else if (change.action === 'reorder') {
        if (!Number.isSafeInteger(change.order)) throw new PresentationError('INVALID_SPEC','Integer order required');
        if (kind !== 'entry') throw new PresentationError('INVALID_SPEC','Only entries can be reordered');
        current.order = change.order;
      } else if(change.action==='pin') {
        if(kind!=='entry'||typeof change.pinned!=='boolean')throw new PresentationError('INVALID_SPEC','置顶操作需要入口和明确的布尔值。');
        current.pinned=change.pinned;
      } else throw new PresentationError('INVALID_SPEC','Unknown management action');
      return this.store.put(collection,id,current);
    });
  }
  getViewData(id: string): ToolResult<{viewId:string;bindings:BindingData[];missing:string[]}> {
    const spec = this.getView(id); if (!spec) return {status:'failed',error:{code:'VIEW_NOT_FOUND',message:'View not found',retryable:false}};
    const bindings: BindingData[] = [], missing: string[] = [];
    for (const binding of spec.bindings) {
      const datasetKey = bindingDatasetKey(binding);
      const snapshot = datasetKey.startsWith('result_set:') ? this.store.get<any>('result_sets',datasetKey.slice(11)) : this.store.get<any>('snapshots',datasetKey);
      if (!snapshot || snapshot.payload == null || (snapshot.expiresAt && Date.parse(snapshot.expiresAt) <= Date.now())) { missing.push(binding.id); continue; }
      const metricBasis = snapshot.metricBasis ?? snapshot.payload?.metricBasis;
      bindings.push({bindingId:binding.id,datasetKey,payload:clone(snapshot.payload),dataTime:snapshot.dataTime ?? snapshot.data_time,lastSuccessAt:snapshot.lastSuccessAt ?? snapshot.last_success_at,state:snapshot.state ?? 'ready',lastError:snapshot.lastError ?? snapshot.last_error,provenance:{...snapshot.provenance,source:'app_snapshot',dataTime:snapshot.dataTime ?? snapshot.data_time},...(metricBasis ? {metricBasis} : {})});
    }
    return {status:missing.length ? bindings.length ? 'partial' : 'failed' : 'ok',data:{viewId:id,bindings,missing},...(missing.length ? {error:{code:'SNAPSHOT_EMPTY',message:`No successful snapshot for: ${missing.join(', ')}`,retryable:false}} : {})};
  }
}
