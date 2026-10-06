import type { ViewSpec, Entry, SavedComponent, Template, BindingData, ComponentDraft, SaveComponentOptions } from '../../presentation/src/types.ts';
import type { ToolResult } from '../../contracts/src/index.ts';
import type { OverviewDto } from '../../contracts/src/overview.ts';
export interface HealthDto {serviceStatus:'ok'|'unavailable';hallmarkStatus:'ok'|'unavailable'}
export interface AppState {sessionId:string;appId:'hallmark';active:boolean;activatedAt?:string}
export interface Saved {components:SavedComponent[];entries:Entry[];templates:Template[]}
export interface SessionViewSummary {viewId:string;title:string;createdAt:string;updatedAt:string;state:'ready'|'expired'}
export interface SessionViewsDto {sessionId:string;views:SessionViewSummary[]}
export interface SessionViewChangeResult {sessionId:string;viewId:string;action:'rename'|'remove';title?:string}
export interface ViewData {viewId:string;bindings:BindingData[];missing:string[]}
export class BridgeError extends Error {code:string;constructor(code:string,message:string){super(message);this.code=code;}}
function notifyChange(detail:{viewId?:string;datasetKey?:string}){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('hallmark:component-changed',{detail}));}
export class HallmarkBridge {
  sessionId:string; fetcher:typeof fetch;
  constructor(sessionId:string,fetcher:typeof fetch = globalThis.fetch.bind(globalThis)){this.sessionId=sessionId;this.fetcher=fetcher;}
  private async request<T>(resource?:string,params:Record<string,string>={},body?:Record<string,unknown>,signal?:AbortSignal):Promise<T>{
    if((resource==='state'||resource==='sessionViews'||resource==='sessionView'||resource==='sessionViewData'||body?.action==='activate'||body?.action==='close'||body?.action==='manageSessionView')&&!this.sessionId)throw new BridgeError('SESSION_REQUIRED','当前会话尚未就绪，请稍后重试。');
    const query=new URLSearchParams({...((['state','sessionViews','sessionView','sessionViewData'].includes(resource??'')&&this.sessionId)?{sessionId:this.sessionId}:{}),...(resource?{resource}:{}),...params});
    const attachSession=body&&(body.action==='activate'||body.action==='close'||body.action==='manageSessionView'||this.sessionId&&(body.action==='openComponent'||body.action==='openTemplate'));
    const response=await this.fetcher(`/api/hallmark-app${body?'':'?'+query}`,{method:body?'POST':'GET',credentials:'same-origin',signal,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify({...(attachSession?{sessionId:this.sessionId}:{}),...body})}:{})});
    const value=await response.json().catch(()=>undefined);
    if(!response.ok)throw new BridgeError(value?.error?.code??`HTTP_${response.status}`,value?.error?.message??'应用连接失败，请检查本机接入服务。');
    return value as T;
  }
  async health(signal?:AbortSignal):Promise<HealthDto>{const value=await this.request<HealthDto>('health',{},undefined,signal);if(!['ok','unavailable'].includes(value?.serviceStatus)||!['ok','unavailable'].includes(value?.hallmarkStatus))throw new BridgeError('INVALID_HEALTH_RESPONSE','连接状态响应不完整。');return {serviceStatus:value.serviceStatus,hallmarkStatus:value.hallmarkStatus};}
  state(signal?:AbortSignal):Promise<AppState>{return this.request('state',{},undefined,signal);}
  async saved(signal?:AbortSignal):Promise<Saved>{
    const result=await this.request<Saved>('saved',{},undefined,signal);
    if(!Array.isArray(result?.entries)||!Array.isArray(result?.components)||!Array.isArray(result?.templates))throw new BridgeError('INVALID_SAVED_RESPONSE','已保存配置响应不完整，请重试。');
    return result;
  }
  async sessionViews(signal?:AbortSignal):Promise<SessionViewsDto>{const value=await this.request<SessionViewsDto>('sessionViews',{},undefined,signal);if(value?.sessionId!==this.sessionId||!Array.isArray(value?.views)||value.views.some(view=>!view||typeof view!=='object'||typeof view.viewId!=='string'||!view.viewId||typeof view.title!=='string'||typeof view.createdAt!=='string'||typeof view.updatedAt!=='string'||!['ready','expired'].includes(view.state)))throw new BridgeError('INVALID_SESSION_VIEWS','会话组件响应不匹配或不完整。');return {sessionId:value.sessionId,views:value.views.map(({viewId,title,createdAt,updatedAt,state})=>({viewId,title,createdAt,updatedAt,state}))};}
  sessionView(viewId:string,signal?:AbortSignal):Promise<ViewSpec>{return this.request('sessionView',{viewId},undefined,signal);}
  sessionViewData(viewId:string,signal?:AbortSignal):Promise<ToolResult<ViewData>>{return this.request('sessionViewData',{viewId},undefined,signal);}
  async manageSessionView(viewId:string,operation:'rename'|'remove',title?:string,signal?:AbortSignal):Promise<SessionViewChangeResult>{
    if(!/^[-a-zA-Z0-9_.:]{1,180}$/.test(viewId)||!['rename','remove'].includes(operation)||operation==='rename'&&(typeof title!=='string'||!title.trim()||title.trim().length>200)||operation==='remove'&&title!==undefined)throw new BridgeError('INVALID_INPUT','名称需要 1–200 个字符；移除只作用于本会话。');
    const result=await this.request<SessionViewChangeResult>(undefined,{}, {action:'manageSessionView',viewId,operation,...(operation==='rename'?{title:title!.trim()}:{})},signal);
    if(result?.sessionId!==this.sessionId||result?.viewId!==viewId||result?.action!==operation||operation==='rename'&&(typeof result.title!=='string'||!result.title.trim()))throw new BridgeError('INVALID_SESSION_VIEW_CHANGE','会话组件管理响应不匹配，请重新读取列表。');
    const detail={sessionId:this.sessionId,viewId,action:operation};
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('hallmark-view-updated',{detail}));
    return result;
  }
  view(viewId:string,signal?:AbortSignal):Promise<ViewSpec>{return this.request('view',{viewId},undefined,signal);}
  viewData(viewId:string,signal?:AbortSignal):Promise<ToolResult<ViewData>>{return this.request('viewData',{viewId},undefined,signal);}
  activate(signal?:AbortSignal):Promise<AppState>{return this.request(undefined,{}, {action:'activate'},signal);}
  close(signal?:AbortSignal):Promise<AppState>{return this.request(undefined,{}, {action:'close'},signal);}
  openEntry(entryId:string,signal?:AbortSignal):Promise<ViewSpec>{return this.request(undefined,{}, {action:'openEntry',entryId},signal);}
  templates(signal?:AbortSignal):Promise<Template[]>{return this.request('templates',{},undefined,signal);}
  overview(signal?:AbortSignal):Promise<OverviewDto>{return this.request('overview',{},undefined,signal);}
  datasets(signal?:AbortSignal):Promise<{datasetKey:string;state:string;dataTime?:string|null;lastSuccessAt?:string}[]>{return this.request('datasets',{},undefined,signal);}
  preview(spec:ViewSpec,signal?:AbortSignal):Promise<ViewSpec>{return this.request(undefined,{}, {action:'preview',spec},signal);}
  async saveComponent(viewId:string,title:string,signal?:AbortSignal,options:SaveComponentOptions={}):Promise<{component:SavedComponent;entry:Entry}>{const result=await this.request<{component:SavedComponent;entry:Entry}>(undefined,{}, {action:'saveComponent',viewId,title,...options},signal);if(result.component?.id)notifyChange({viewId:result.component.id});return result;}
  openComponent(componentId:string,signal?:AbortSignal,options:{revision?:number;directory?:string}={}):Promise<ComponentDraft>{return this.request(undefined,{}, {action:'openComponent',componentId,...options},signal);}
  openTemplate(templateId:string,signal?:AbortSignal):Promise<{spec:ViewSpec}>{return this.request(undefined,{}, {action:'openTemplate',templateId},signal);}
  saveTemplate(viewId:string,name:string,signal?:AbortSignal):Promise<unknown>{return this.request(undefined,{}, {action:'saveTemplate',viewId,name},signal);}
  manage(kind:'component'|'entry'|'template',id:string,operation:'rename'|'delete'|'reorder'|'pin',values:{name?:string;order?:number;pinned?:boolean}={}):Promise<unknown>{return this.request(undefined,{}, {action:'manage',kind,id,operation,...values});}
  async refresh(datasetKey:string,signal?:AbortSignal,notify=true):Promise<ToolResult>{const result=await this.request<ToolResult>(undefined,{}, {action:'refresh',datasetKey},signal);if(result.status==='ok'&&notify)notifyChange({datasetKey});return result;}
}
