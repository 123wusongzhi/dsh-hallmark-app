import {randomUUID} from 'node:crypto';
import type {ViewSpec, DataBinding, Patch, Entry, SaveComponentOptions, ComponentDraft} from '../../presentation/src/types.ts';
import {INITIAL_TEMPLATES} from '../../presentation/src/design.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {StoreLike} from './server.ts';
import type {SourceComponentStore} from '../../source-components/src/index.ts';
import {hydrateSourceBindings} from '../../presentation/src/source-data.ts';
export interface UIManager {
 sources?:SourceComponentStore;
 getView(id:string):unknown;getViewData(id:string):unknown;
 renderView?(spec:ViewSpec):ViewSpec;
 renderFromTemplate?(templateId:string,title:string,bindings:DataBinding[],options?:{directory?:string}):ViewSpec;
 updateView?(id:string,patch:Patch[]):ViewSpec;
 saveComponent?(id:string,userRequest:string,title?:string,options?:SaveComponentOptions):unknown;
 openComponent?(id:string,options?:{revision?:number;directory?:string}):ComponentDraft;
 saveTemplate?(id:string,name:string,userRequest:string,description?:string):unknown;
 listSaved?():unknown;
 manageSaved?(kind:'component'|'entry'|'template',id:string,change:{action:'rename'|'delete'|'reorder'|'pin';name?:string;order?:number;pinned?:boolean}):unknown;
}
function assertKeys(input:Record<string,unknown>,keys:string[]):void {if(Object.keys(input).some(key=>!keys.includes(key)))throw Object.assign(new Error('Unexpected UI input field'),{code:'INVALID_UI_INPUT'});}
function text(value:unknown,name:string):string {if(typeof value!=='string'||!value.trim()||value.length>4000)throw Object.assign(new Error(`${name} required`),{code:'INVALID_UI_INPUT'});return value;}
/** Narrow local-display API. Never invokes AppCore.invoke or any platform/write Tool. */
export async function executeUI(path:string,method:string,input:Record<string,unknown>,manager:UIManager,store:StoreLike,refresh?:(key:string)=>Promise<ToolResult>,registerDraft?:(sessionId:string,spec:ViewSpec)=>unknown):Promise<unknown> {
 const ownDraft=(spec:ViewSpec)=>{
  if(input.sessionId===undefined)return;
  if(typeof input.sessionId!=='string'||!/^[-a-zA-Z0-9_]{1,160}$/.test(input.sessionId)||!registerDraft)throw Object.assign(new Error('Valid session registration required'),{code:'INVALID_UI_INPUT'});
  registerDraft(input.sessionId,spec);
 };
 const view=path.match(/^\/ui\/views\/([^/]+)(\/data)?$/);
 if(method==='GET'&&view){const id=decodeURIComponent(view[1]);return view[2]?manager.getViewData(id):manager.getView(id);}
 if(method==='GET'&&path==='/ui/saved')return manager.listSaved?.();
 if(method==='GET'&&path==='/ui/templates')return INITIAL_TEMPLATES;
 if(method==='GET'&&path==='/ui/datasets')return store.list('snapshots').map(row=>({datasetKey:row.datasetKey,state:row.state,dataTime:row.dataTime??null,lastSuccessAt:row.lastSuccessAt??null}));
 if(method!=='POST')throw Object.assign(new Error('UI route not found'),{code:'UI_ROUTE_NOT_FOUND'});
 if(path==='/ui/render'){
  assertKeys(input,['spec','templateId','title','bindings']);
  if(input.spec){if(!manager.renderView)throw new Error('UI render unavailable');return manager.renderView(input.spec as ViewSpec);}
  if(!Array.isArray(input.bindings)||!manager.renderFromTemplate)throw Object.assign(new Error('template bindings required'),{code:'INVALID_UI_INPUT'});
  return manager.renderFromTemplate(text(input.templateId,'templateId'),text(input.title,'title'),input.bindings as DataBinding[]);
 }
 if(path==='/ui/update'){
  assertKeys(input,['viewId','patch']);if(!Array.isArray(input.patch)||!manager.updateView)throw Object.assign(new Error('JSON Patch array required'),{code:'INVALID_UI_INPUT'});
  return manager.updateView(text(input.viewId,'viewId'),input.patch as Patch[]);
 }
 if(path==='/ui/save'){
  assertKeys(input,['viewId','title','action','mode','componentId','expectedRevision']);if(input.action!=='save-component'||!manager.saveComponent)throw Object.assign(new Error('Explicit save-component action required'),{code:'SAVE_NOT_REQUESTED'});
  const title=text(input.title,'title');return manager.saveComponent(text(input.viewId,'viewId'),`用户在应用组件控制台点击“保存组件”：${title}`,title,{...(input.mode!==undefined?{mode:input.mode as SaveComponentOptions['mode']}:{}),...(input.componentId!==undefined?{componentId:input.componentId as string}:{}),...(input.expectedRevision!==undefined?{expectedRevision:input.expectedRevision as number}:{})});
 }
 if(path==='/ui/open-component'){
  assertKeys(input,['componentId','revision','directory','sessionId']);if(!manager.openComponent)throw new Error('组件草稿接口不可用。');
  if(input.revision!==undefined&&(!Number.isSafeInteger(input.revision)||(input.revision as number)<1))throw Object.assign(new Error('Invalid component revision'),{code:'INVALID_UI_INPUT'});
  const draft=manager.openComponent(text(input.componentId,'componentId'),{...(typeof input.revision==='number'?{revision:input.revision}:{}),...(input.directory!==undefined?{directory:text(input.directory,'directory')}:{})});ownDraft(draft.spec);
  const initialData=await hydrateSourceBindings(draft.spec,id=>manager.getViewData(id),refresh);return {...draft,...(initialData.length?{initialData}:{})};
 }
 if(path==='/ui/open-template'){
  assertKeys(input,['templateId','title','bindings','directory','sessionId']);if(!manager.renderFromTemplate)throw new Error('模板草稿接口不可用。');
  const templateId=text(input.templateId,'templateId'),template=store.get<{name:string}>('templates',templateId)??INITIAL_TEMPLATES.find(template=>template.id===templateId);
  if(input.bindings!==undefined&&!Array.isArray(input.bindings))throw Object.assign(new Error('bindings must be an array'),{code:'INVALID_UI_INPUT'});
  const spec=manager.renderFromTemplate(templateId,input.title!==undefined?text(input.title,'title'):template?.name??'模板草稿',(input.bindings??[]) as DataBinding[],{...(input.directory!==undefined?{directory:text(input.directory,'directory')}:{})});
  ownDraft(spec);const initialData=await hydrateSourceBindings(spec,id=>manager.getViewData(id),refresh);return {spec,...(initialData.length?{initialData}:{})};
 }
 if(path==='/ui/save-template'){
  assertKeys(input,['viewId','name','description','action']);if(input.action!=='save-template'||!manager.saveTemplate)throw Object.assign(new Error('Explicit save-template action required'),{code:'SAVE_NOT_REQUESTED'});
  const name=text(input.name,'name');return manager.saveTemplate(text(input.viewId,'viewId'),name,`用户在应用组件控制台点击“保存模板”：${name}`,typeof input.description==='string'?input.description:'');
 }
 if(path==='/ui/manage'){
  assertKeys(input,['kind','id','action','name','order','pinned']);if(!['component','entry','template'].includes(String(input.kind))||!['rename','delete','reorder','pin'].includes(String(input.action))||!manager.manageSaved)throw Object.assign(new Error('Explicit saved item/action required'),{code:'INVALID_UI_INPUT'});
  return manager.manageSaved(input.kind as 'component'|'entry'|'template',text(input.id,'id'),{action:input.action as 'rename'|'delete'|'reorder'|'pin',...(typeof input.name==='string'?{name:input.name}:{}),...(typeof input.order==='number'?{order:input.order}:{}),...(typeof input.pinned==='boolean'?{pinned:input.pinned}:{})});
 }
 if(path==='/ui/open-entry'){
  assertKeys(input,['entryId']);const entry=store.get<Entry>('entries',text(input.entryId,'entryId'));
  if(!entry)throw Object.assign(new Error('Saved entry not found'),{code:'ENTRY_NOT_FOUND'});
  if(entry.kind==='component'&&entry.viewId)return manager.getView(entry.viewId);
  if(!entry.binding||!manager.renderView)throw Object.assign(new Error('Saved data binding required'),{code:'INVALID_BINDING'});
  const fields=Object.entries(entry.binding.fieldMap).slice(0,12).map(([field,label])=>({field,label}));
  return manager.renderView({id:randomUUID(),title:entry.title,layout:{type:'column',children:['data']},bindings:[entry.binding],widgets:[{id:'data',type:'table',bindingId:entry.binding.id,title:entry.title,columns:fields.length?fields:[{field:'offerId',label:'商品标识'},{field:'title',label:'名称'}],options:{pageSize:20}}]});
 }
 if(path==='/ui/refresh'){
  assertKeys(input,['datasetKey']);if(!refresh)throw Object.assign(new Error('Refresh unavailable'),{code:'REFRESH_UNAVAILABLE'});return refresh(text(input.datasetKey,'datasetKey'));
 }
 throw Object.assign(new Error('UI route not found'),{code:'UI_ROUTE_NOT_FOUND'});
}
