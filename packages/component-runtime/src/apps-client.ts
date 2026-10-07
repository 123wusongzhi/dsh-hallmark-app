import type {BridgeHello, BridgeIdentity, BridgeRequest, CapabilityResult, ComponentContextUpdate, ComponentContextReceipt, ComponentAgentRequest, ComponentAgentReceipt, FailureInfo, JsonValue, SelectionEnvelope} from '../../app-contracts/src/index.ts';

/** Project-owned component protocol. Historical builds continue to use hallmark.source.v1. */
export const COMPONENT_CHANNEL = 'dsh.apps.component.v2';
export const COMPONENT_METHODS: BridgeRequest['method'][] = ['getData','getContext','refresh','attachSelection','resize','invokeCapability','updateContext','requestAgent'];
export interface ComponentMessage extends BridgeIdentity {channel: typeof COMPONENT_CHANNEL; requestId: string}
export interface ComponentResponse extends ComponentMessage {result?: JsonValue; error?: FailureInfo}
export interface ComponentEvent extends BridgeIdentity {channel: typeof COMPONENT_CHANNEL; event: 'data'|'context'; data: JsonValue}
export interface ComponentHello extends BridgeHello {channel: typeof COMPONENT_CHANNEL; type: 'hello'; requestId?: string}
export type AgentReceipt = ComponentAgentReceipt;
export interface AttachReceipt {status: 'attached'|'pending'; message: string}
export class ComponentBridgeError extends Error {
  code: string;
  failure: FailureInfo;
  constructor(failure: FailureInfo) {super(failure.message); this.name='ComponentBridgeError'; this.code=failure.code; this.failure=failure;}
}
export function sameBridgeIdentity(a: BridgeIdentity, b: BridgeIdentity): boolean {
  return a.protocolVersion===b.protocolVersion && a.sessionId===b.sessionId && a.viewId===b.viewId && a.buildId===b.buildId && a.frameInstanceId===b.frameInstanceId;
}
export function isBridgeIdentity(value: unknown): value is BridgeIdentity {
  const item=value as BridgeIdentity;
  return Boolean(item && item.protocolVersion==='2.0' && ['sessionId','viewId','buildId','frameInstanceId'].every(key=>typeof (item as unknown as Record<string,unknown>)[key]==='string' && (item as unknown as Record<string,string>)[key].length>0));
}
export interface AppsComponentClient {
  hello(): Promise<BridgeHello>;
  getData(): Promise<JsonValue>;
  getContext(): Promise<JsonValue>;
  refresh(bindingIds?: string[]): Promise<JsonValue>;
  attachSelection(selection: SelectionEnvelope): Promise<AttachReceipt>;
  resize(height: number): Promise<void>;
  invokeCapability(input: JsonValue): Promise<CapabilityResult>;
  updateContext(context: ComponentContextUpdate): Promise<ComponentContextReceipt>;
  requestAgent(input: ComponentAgentRequest): Promise<AgentReceipt>;
  subscribe(listener: (event: ComponentEvent)=>void): ()=>void;
  dispose(): void;
}
const failure=(code:string,message:string):FailureInfo=>({code,message,retryPolicy:'never'});
// This module belongs to one iframe document. Reloading that document creates a new nonce.
const documentNonce=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createAppsClient(options:{window?:Window;timeoutMs?:number}={}): AppsComponentClient {
  const current=options.window??window, origin=current.location.origin;
  const clientNonce=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const listeners=new Set<(event:ComponentEvent)=>void>();
  const helloRequestId=`hello-${documentNonce}-${Math.random().toString(36).slice(2)}`;
  let identity:ComponentHello|undefined, disposed=false, sequence=0;
  let resolveHello:(value:BridgeHello)=>void=()=>{}, rejectHello:(reason:Error)=>void=()=>{};
  const ready=new Promise<BridgeHello>((resolve,reject)=>{resolveHello=resolve;rejectHello=reject;});
  // A handler is attached immediately, so a never-used client cannot cause an unhandled rejection.
  void ready.catch(()=>{});
  const helloTimer=setTimeout(()=>rejectHello(new ComponentBridgeError(failure('BRIDGE_TIMEOUT','Component handshake timed out.'))),options.timeoutMs??30000);
  const receive=(event:MessageEvent)=>{
    if(event.source!==current.parent||event.origin!==origin||event.data?.channel!==COMPONENT_CHANNEL)return;
    const message=event.data;
    if(!identity&&message.requestId===helloRequestId&&message.error){clearTimeout(helloTimer);rejectHello(new ComponentBridgeError(message.error));return;}
    if(message.type==='hello'){
      if(!identity&&message.requestId!==helloRequestId)return;
      if(message.protocolVersion!=='2.0'){clearTimeout(helloTimer);rejectHello(new ComponentBridgeError(failure('UNSUPPORTED_PROTOCOL','Unsupported component protocol major.')));return;}
      if(!isBridgeIdentity(message as unknown)||!Array.isArray(message.supportedMethods)||message.supportedMethods.some((method:unknown)=>!COMPONENT_METHODS.includes(method as BridgeRequest['method']))||!Number.isSafeInteger(message.maxMessageBytes)||message.maxMessageBytes<1||!Number.isSafeInteger(message.contextRevision)||message.contextRevision<0)return;
      if(identity&&!sameBridgeIdentity(identity,message))return;
      identity=message;clearTimeout(helloTimer);resolveHello(message);return;
    }
    if(!identity||!isBridgeIdentity(message as unknown)||!sameBridgeIdentity(identity,message))return;
    if(message.event==='data'||message.event==='context'){for(const listener of listeners)listener(message);return;}
    const request=pending.get(message.requestId);if(!request)return;
    pending.delete(message.requestId);clearTimeout(request.timer);
    if(message.error)request.reject(new ComponentBridgeError(message.error));else request.resolve(message.result);
  };
  current.addEventListener('message',receive);
  if(current.parent===current){clearTimeout(helloTimer);rejectHello(new ComponentBridgeError(failure('BRIDGE_UNAVAILABLE','Open this component in an Apps component host.')));}
  else current.parent.postMessage({channel:COMPONENT_CHANNEL,type:'hello',protocolVersion:'2.0',requestId:helloRequestId,documentNonce},origin);
  const call=async<T>(method:BridgeRequest['method'],params:JsonValue=null):Promise<T>=>{
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));
    await ready;
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));
    if(!identity!.supportedMethods.includes(method))throw new ComponentBridgeError(failure('UNSUPPORTED_HOST_CAPABILITY',`Host does not support ${method}.`));
    const {protocolVersion,sessionId,viewId,buildId,frameInstanceId}=identity!;
    const request={channel:COMPONENT_CHANNEL,protocolVersion,sessionId,viewId,buildId,frameInstanceId,requestId:`${clientNonce}-${++sequence}`,method,params};
    if(new TextEncoder().encode(JSON.stringify(request)).length>identity!.maxMessageBytes)throw new ComponentBridgeError(failure('BRIDGE_MESSAGE_TOO_LARGE','Component request exceeds the negotiated byte limit.'));
    return new Promise<T>((resolve,reject)=>{
      const withInspection=(error:Error)=>{if(method==='requestAgent'){const source=error instanceof ComponentBridgeError?error.failure:failure('BRIDGE_SUBMISSION_UNKNOWN',error.message);return new ComponentBridgeError({...source,retryPolicy:'inspect_only',details:{...((source.details&&typeof source.details==='object'&&!Array.isArray(source.details))?source.details:{}),sessionId,viewId,buildId,frameInstanceId,requestId:request.requestId}});}return error;};
      const timer=setTimeout(()=>{pending.delete(request.requestId);reject(withInspection(new ComponentBridgeError(failure('BRIDGE_TIMEOUT','Host response timed out.'))));},options.timeoutMs??30000);
      pending.set(request.requestId,{resolve:value=>resolve(value as T),reject:error=>reject(withInspection(error)),timer});
      try{current.parent.postMessage(request,origin);}catch(error){clearTimeout(timer);pending.delete(request.requestId);reject(withInspection(error instanceof Error?error:new Error(String(error))));}
    });
  };
  return {hello:()=>ready,getData:()=>call('getData'),getContext:()=>call('getContext'),refresh:bindingIds=>call('refresh',bindingIds?{bindingIds}:null),attachSelection:selection=>call('attachSelection',selection as unknown as JsonValue),resize:height=>call('resize',{height}),invokeCapability:input=>call('invokeCapability',input),updateContext:context=>call('updateContext',context as unknown as JsonValue),requestAgent:input=>call('requestAgent',input as unknown as JsonValue),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},dispose:()=>{if(disposed)return;disposed=true;clearTimeout(helloTimer);const error=new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));rejectHello(error);current.removeEventListener('message',receive);for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();listeners.clear();}};
}
