import type {BridgeHello, BridgeIdentity, BridgeRequest, CapabilityResult, ComponentContextUpdate, ComponentContextReceipt, ComponentAgentRequest, ComponentAgentReceipt, FailureInfo, JsonValue, SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {AuthoringAssertion,UiSelectionEvidence} from '../../app-contracts/src/index.ts';
export interface AppsRenderReadyInput {publicationId:string;attemptId:string;attemptEpoch:number;checks:{rendered:boolean;bridgeReady:boolean;dataRead:boolean;unhandledErrors:string[];assertionResults:AuthoringAssertion[]}}
export interface AppsUiStateExportInput {uiStateSchemaVersion:number;expectedStateRevision:number;value:JsonValue;selectionEvidence:UiSelectionEvidence[]}

/** Project-owned component protocol. Historical builds continue to use hallmark.source.v1. */
export const COMPONENT_CHANNEL = 'dsh.apps.component.v2';
export type {BindingQuery} from '../../app-contracts/src/index.ts';
export const COMPONENT_METHODS: BridgeRequest['method'][] = ['getData','getContext','refresh','attachSelection','resize','invokeCapability','updateContext','requestAgent'];
export interface ComponentMessage extends BridgeIdentity {channel: typeof COMPONENT_CHANNEL; requestId: string}
export interface ComponentResponse extends ComponentMessage {result?: JsonValue; error?: FailureInfo}
export interface ComponentEvent extends BridgeIdentity {channel: typeof COMPONENT_CHANNEL; event: 'data'|'context'; data: JsonValue}
export type ComponentFeature='renderReadyV1'|'uiStateV1';
export interface ComponentHello extends BridgeHello {channel: typeof COMPONENT_CHANNEL; type: 'hello'; requestId?: string;features?:string[]}
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
  hello(): Promise<ComponentHello>;
  getData(): Promise<JsonValue>;
  getContext(): Promise<JsonValue>;
  refresh(bindingIds?: string[]): Promise<JsonValue>;
  attachSelection(selection: SelectionEnvelope): Promise<AttachReceipt>;
  resize(height: number): Promise<void>;
  invokeCapability(input: JsonValue): Promise<CapabilityResult>;
  updateContext(context: ComponentContextUpdate): Promise<ComponentContextReceipt>;
  requestAgent(input: ComponentAgentRequest): Promise<AgentReceipt>;
  renderReady(input:AppsRenderReadyInput):Promise<JsonValue>;
  readUiState(uiStateSchemaVersion:number):Promise<JsonValue>;
  writeUiState(input:AppsUiStateExportInput):Promise<JsonValue>;
  /** Diagnostic only: the parent owns display identity and persists this error. */
  reportFrameError(input:{phase:string;code:string;message:string}):void;
  subscribe(listener: (event: ComponentEvent)=>void): ()=>void;
  dispose(): void;
}
const failure=(code:string,message:string):FailureInfo=>({code,message,retryPolicy:'never'});
// This module belongs to one iframe document. Reloading that document creates a new nonce.
const documentNonce=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function createAppsClient(options:{window?:Window;timeoutMs?:number;clientFeatures?:ComponentFeature[]}={}): AppsComponentClient {
  const current=options.window??window, origin=current.location.origin;
  const clientNonce=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error,submissionUncertain?:boolean)=>void;timer:ReturnType<typeof setTimeout>}>();
  const listeners=new Set<(event:ComponentEvent)=>void>();
  const helloRequestId=`hello-${documentNonce}-${Math.random().toString(36).slice(2)}`;
  let identity:ComponentHello|undefined, disposed=false, sequence=0;
  let resolveHello:(value:ComponentHello)=>void=()=>{}, rejectHello:(reason:Error)=>void=()=>{};
  const ready=new Promise<ComponentHello>((resolve,reject)=>{resolveHello=resolve;rejectHello=reject;});
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
      if(message.features!==undefined&&(!Array.isArray(message.features)||message.features.some((feature:unknown)=>!['renderReadyV1','uiStateV1'].includes(String(feature)))))return;
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
  else current.parent.postMessage({channel:COMPONENT_CHANNEL,type:'hello',protocolVersion:'2.0',requestId:helloRequestId,documentNonce,clientFeatures:options.clientFeatures??['renderReadyV1']},origin);
  const call=async<T>(method:BridgeRequest['method'],params:JsonValue=null):Promise<T>=>{
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));
    await ready;
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));
    if(!identity!.supportedMethods.includes(method))throw new ComponentBridgeError(failure('UNSUPPORTED_HOST_CAPABILITY',`Host does not support ${method}.`));
    const {protocolVersion,sessionId,viewId,buildId,frameInstanceId}=identity!;
    const request={channel:COMPONENT_CHANNEL,protocolVersion,sessionId,viewId,buildId,frameInstanceId,requestId:`${clientNonce}-${++sequence}`,method,params};
    if(new TextEncoder().encode(JSON.stringify(request)).length>identity!.maxMessageBytes)throw new ComponentBridgeError(failure('BRIDGE_MESSAGE_TOO_LARGE','Component request exceeds the negotiated byte limit.'));
    return new Promise<T>((resolve,reject)=>{
      const withInspection=(error:Error,submissionUncertain=false)=>{
        const source=error instanceof ComponentBridgeError?error.failure:failure('BRIDGE_SUBMISSION_UNKNOWN',error.message);
        if(method==='requestAgent')return new ComponentBridgeError({...source,retryPolicy:'inspect_only',details:{...((source.details&&typeof source.details==='object'&&!Array.isArray(source.details))?source.details:{}),sessionId,viewId,buildId,frameInstanceId,requestId:request.requestId}});
        if(method!=='invokeCapability'||!submissionUncertain)return error;
        const input=params!==null&&typeof params==='object'&&!Array.isArray(params)?params:{},mutation=typeof input.idempotencyKey==='string'&&input.idempotencyKey.length>0;
        const details:Record<string,JsonValue>={sessionId,viewId,buildId,frameInstanceId,requestId:request.requestId};
        for(const key of ['appId','connectionId','capabilityId','capabilityVersion','idempotencyKey'])if(typeof input[key]==='string')details[key]=input[key];
        if(mutation)details.doNotResubmitMutation=true;
        return new ComponentBridgeError({...source,retryPolicy:mutation?'inspect_only':'read_retry',details});
      };
      const timer=setTimeout(()=>{pending.delete(request.requestId);reject(withInspection(new ComponentBridgeError(failure('BRIDGE_TIMEOUT','Host response timed out.')),true));},options.timeoutMs??30000);
      pending.set(request.requestId,{resolve:value=>resolve(value as T),reject:(error,submissionUncertain)=>reject(withInspection(error,submissionUncertain)),timer});
      try{current.parent.postMessage(request,origin);}catch(error){clearTimeout(timer);pending.delete(request.requestId);reject(withInspection(error instanceof Error?error:new Error(String(error))));}
    });
  };
  const extension=async(feature:ComponentFeature,action:string,params:JsonValue):Promise<JsonValue>=>{
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));await ready;
    if(disposed)throw new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));
    if(!identity!.features?.includes(feature))throw new ComponentBridgeError(failure('UNSUPPORTED_HOST_CAPABILITY',`Host did not negotiate ${feature}.`));
    const {protocolVersion,sessionId,viewId,buildId,frameInstanceId}=identity!,request={channel:COMPONENT_CHANNEL,type:'extension',protocolVersion,sessionId,viewId,buildId,frameInstanceId,requestId:`${clientNonce}-${++sequence}`,feature,action,params};
    let bytes:number;try{bytes=new TextEncoder().encode(JSON.stringify(request)).length;}catch{throw new ComponentBridgeError(failure('INVALID_UI_STATE','Extension state must be serializable JSON.'));}
    if(bytes>Math.min(identity!.maxMessageBytes,feature==='uiStateV1'?65536:identity!.maxMessageBytes))throw new ComponentBridgeError(failure('BRIDGE_MESSAGE_TOO_LARGE','Extension exceeds the negotiated byte limit.'));
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(request.requestId);reject(new ComponentBridgeError(failure('BRIDGE_TIMEOUT','Extension response timed out.')));},options.timeoutMs??30000);pending.set(request.requestId,{resolve:value=>resolve(value as JsonValue),reject,timer});try{current.parent.postMessage(request,origin);}catch(error){clearTimeout(timer);pending.delete(request.requestId);reject(error);}});
  };
  return {hello:()=>ready,getData:()=>call('getData'),getContext:()=>call('getContext'),refresh:bindingIds=>call('refresh',bindingIds?{bindingIds}:null),attachSelection:selection=>call('attachSelection',selection as unknown as JsonValue),resize:height=>call('resize',{height}),invokeCapability:input=>call('invokeCapability',input),updateContext:context=>call('updateContext',context as unknown as JsonValue),requestAgent:input=>call('requestAgent',input as unknown as JsonValue),renderReady:input=>extension('renderReadyV1','ready',{...input,documentNonce} as unknown as JsonValue),readUiState:uiStateSchemaVersion=>extension('uiStateV1','read',{uiStateSchemaVersion,documentNonce}),writeUiState:input=>extension('uiStateV1','write',{...input,documentNonce} as unknown as JsonValue),reportFrameError:input=>{if(disposed||current.parent===current)return;try{current.parent.postMessage({channel:COMPONENT_CHANNEL,type:'display-error',...(identity?{protocolVersion:identity.protocolVersion,sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,frameInstanceId:identity.frameInstanceId}:{}),documentNonce,error:{phase:input.phase.slice(0,64),code:input.code.slice(0,128),message:input.message.slice(0,512)}},origin);}catch{}},subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},dispose:()=>{if(disposed)return;disposed=true;clearTimeout(helloTimer);const error=new ComponentBridgeError(failure('BRIDGE_CLOSED','Component is closed.'));rejectHello(error);current.removeEventListener('message',receive);for(const request of pending.values()){clearTimeout(request.timer);request.reject(error,true);}pending.clear();listeners.clear();}};
}
