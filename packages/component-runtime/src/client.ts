/** A small host bridge. The component itself is an ordinary application: no layout or style vocabulary. */
export {COMPONENT_CHANNEL, ComponentBridgeError, createAppsClient, sameBridgeIdentity} from './apps-client.ts';
export type {AppsComponentClient, ComponentEvent, ComponentHello, ComponentResponse, AttachReceipt, AgentReceipt} from './apps-client.ts';
export const SOURCE_CHANNEL = 'hallmark.source.v1';
export interface SourceBindingData {
  bindingId:string;datasetKey:string;payload:unknown;dataTime?:string;lastSuccessAt?:string;
  state:string;lastError?:unknown;provenance:Record<string,unknown>;metricBasis?:string;
}
export type SourceProductIdentity = {kind:'collected_item';itemId:string}|{kind:'store_product';storeId:string;offerId?:string;productId?:string};
export interface SourceSelection {bindingId:string;eligible:boolean;reason?:string;rows:{key:string;row:Record<string,unknown>;identity:SourceProductIdentity}[]}
export interface SourceData {bindings:SourceBindingData[];selection:SourceSelection[];revision:string}
export interface SourceContext {sessionId:string;viewId:string;buildId:string;preview?:boolean;theme?:'light'|'dark';attachment:{available:boolean;disabledReason?:string}}
export interface SourceAttachRequest {bindingId:string;keys:string[];revision?:string}
export interface SourceAttachResult {ok:boolean;message:string;pending?:boolean}
export type SourceEvent = {event:'data';data:SourceData}|{event:'context';data:SourceContext};
export type SourceMethod = 'getData'|'getContext'|'refresh'|'attachSelection'|'resize';
export interface SourceRequest {channel:typeof SOURCE_CHANNEL;requestId:string;method:SourceMethod;params?:unknown}
export interface SourceResponse {channel:typeof SOURCE_CHANNEL;requestId:string;result?:unknown;error?:string}
export interface SourceClient {
  getData():Promise<SourceData>;getContext():Promise<SourceContext>;refresh():Promise<SourceData>;
  attachSelection(request:SourceAttachRequest):Promise<SourceAttachResult>;
  resize(height:number):Promise<void>;subscribe(listener:(event:SourceEvent)=>void):()=>void;dispose():void;
}
export function createHallmarkClient(options:{window?:Window;timeoutMs?:number}={}):SourceClient {
  const current=options.window??window;
  const origin=current.location.origin;
  const pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const listeners=new Set<(event:SourceEvent)=>void>();
  let sequence=0,disposed=false;
  const receive=(event:MessageEvent)=>{
    if(event.source!==current.parent||event.origin!==origin||event.data?.channel!==SOURCE_CHANNEL)return;
    const message=event.data;
    if(message.event==='data'||message.event==='context'){
      for(const listener of listeners)listener({event:message.event,data:message.data});return;
    }
    const request=pending.get(message.requestId);if(!request)return;
    pending.delete(message.requestId);clearTimeout(request.timer);
    if(typeof message.error==='string')request.reject(new Error(message.error));else request.resolve(message.result);
  };
  current.addEventListener('message',receive);
  const call=<T>(method:SourceMethod,params?:unknown):Promise<T>=>new Promise((resolve,reject)=>{
    if(disposed){reject(new Error('组件已关闭。'));return;}
    if(current.parent===current){reject(new Error('请在 Hallmark 或组件预览宿主中打开此组件。'));return;}
    const requestId=`${Date.now()}-${++sequence}`;
    const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('宿主响应超时，请重试。'));},options.timeoutMs??30000);
    pending.set(requestId,{resolve,reject,timer});
    try{current.parent.postMessage({channel:SOURCE_CHANNEL,requestId,method,params},origin);}
    catch(error){clearTimeout(timer);pending.delete(requestId);reject(error);}
  });
  return {
    getData:()=>call('getData'),getContext:()=>call('getContext'),refresh:()=>call('refresh'),
    attachSelection:request=>call('attachSelection',request),resize:height=>call('resize',{height}),
    subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    dispose:()=>{if(disposed)return;disposed=true;current.removeEventListener('message',receive);for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('组件已关闭。'));}pending.clear();listeners.clear();},
  };
}
