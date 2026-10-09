import type {BridgeHello, BridgeIdentity, BridgeRequest, FailureInfo, JsonValue} from '../../app-contracts/src/index.ts';
import {COMPONENT_CHANNEL, COMPONENT_METHODS, ComponentBridgeError, isBridgeIdentity, sameBridgeIdentity} from './apps-client.ts';
import type {ComponentEvent, ComponentHello, ComponentResponse} from './apps-client.ts';

export interface ComponentHostHandlers {
  getData: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  getContext: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  refresh?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  attachSelection?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  resize?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  invokeCapability?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  updateContext?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
  requestAgent?: (request: BridgeRequest)=>Promise<JsonValue>|JsonValue;
}
export interface ComponentExtensionRequest extends BridgeIdentity {channel:string;type:'extension';feature:'renderReadyV1'|'uiStateV1'|'bindingPagesV1';action:string;requestId:string;params:JsonValue}
export type ComponentExtensionHandlers=Partial<Record<ComponentExtensionRequest['feature'],(request:ComponentExtensionRequest)=>Promise<JsonValue>|JsonValue>>;
const unsupported=(method:string):FailureInfo=>({code:'UNSUPPORTED_HOST_CAPABILITY',message:`Host has no verified ${method} path. Attach a selection to the input and send it manually.`,retryPolicy:'never'});
function messageBytes(value:unknown):number {
  const ancestors=new Set<object>();
  function check(item:unknown):void {
    if(item===null||typeof item==='boolean'||typeof item==='string'||typeof item==='number'&&Number.isFinite(item))return;
    if(typeof item!=='object'||ancestors.has(item))throw new Error('Only finite acyclic JSON messages are accepted.');
    const prototype=Object.getPrototypeOf(item);if(!Array.isArray(item)&&prototype!==Object.prototype&&prototype!==null)throw new Error('Only plain JSON messages are accepted.');
    ancestors.add(item);for(const entry of Object.values(item))check(entry);ancestors.delete(item);
  }
  check(value);return new TextEncoder().encode(JSON.stringify(value)).length;
}
/** Pure dispatch boundary: browser adapters must additionally verify MessageEvent source and origin. */
export class ComponentHost {
  readonly identity: BridgeIdentity;
  readonly supportedMethods: BridgeRequest['method'][];
  readonly maxMessageBytes:number;
  private active=true;
  private handlers:ComponentHostHandlers;
  private contextRevision:()=>number;
  private extensionHandlers:ComponentExtensionHandlers;
  private negotiatedFeatures=new Set<string>();
  constructor(identity:BridgeIdentity,handlers:ComponentHostHandlers,options:{maxMessageBytes?:number;contextRevision?:()=>number;extensionHandlers?:ComponentExtensionHandlers;clientFeatures?:string[]}={}) {
    if(!isBridgeIdentity(identity))throw new Error('INVALID_BRIDGE_IDENTITY');
    this.identity={...identity};this.handlers=handlers;this.maxMessageBytes=options.maxMessageBytes??262144;
    this.contextRevision=options.contextRevision??(()=>0);
    this.extensionHandlers=options.extensionHandlers??{};
    for(const feature of options.clientFeatures??[])if(Object.hasOwn(this.extensionHandlers,feature))this.negotiatedFeatures.add(feature);
    if(!Number.isSafeInteger(this.maxMessageBytes)||this.maxMessageBytes<1)throw new Error('INVALID_BRIDGE_BYTE_LIMIT');
    this.supportedMethods=COMPONENT_METHODS.filter(method=>typeof handlers[method as keyof ComponentHostHandlers]==='function') as BridgeRequest['method'][];
  }
  hello(requestId?:string):ComponentHello {const contextRevision=this.contextRevision();if(!Number.isSafeInteger(contextRevision)||contextRevision<0)throw new Error('INVALID_CONTEXT_REVISION');return {...this.identity,channel:COMPONENT_CHANNEL,type:'hello',supportedMethods:[...this.supportedMethods],maxMessageBytes:this.maxMessageBytes,contextRevision,...(this.negotiatedFeatures.size?{features:[...this.negotiatedFeatures]}:{}),...(requestId?{requestId}:{})};}
  event(event:'data'|'context',data:JsonValue):ComponentEvent {return {...this.identity,channel:COMPONENT_CHANNEL,event,data};}
  async handle(message:unknown):Promise<ComponentResponse|ComponentHello|undefined> {
    if(!this.active||!message||typeof message!=='object')return;
    const item=message as Record<string,unknown>;
    if(item.channel!==COMPONENT_CHANNEL||typeof item.requestId!=='string')return;
    const response=(error:FailureInfo):ComponentResponse=>{
      const output:ComponentResponse={...this.identity,channel:COMPONENT_CHANNEL,requestId:item.requestId as string,error};
      let code='BRIDGE_MESSAGE_TOO_LARGE';
      try {if(messageBytes(output)<=this.maxMessageBytes)return output;}catch{code='INVALID_BRIDGE_MESSAGE';}
      const details:Record<string,JsonValue>={},source=error.details&&typeof error.details==='object'&&!Array.isArray(error.details)?error.details:{};
      const bounded:FailureInfo={code,message:'Component failure exceeds the JSON or message limit.',retryPolicy:['never','read_retry','inspect_only'].includes(error.retryPolicy)?error.retryPolicy:'never'};
      const fallback:ComponentResponse={...this.identity,channel:COMPONENT_CHANNEL,requestId:item.requestId as string,error:bounded};
      for(const key of ['invocationId','traceId','operationId','doNotResubmitMutation','requestId','idempotencyKey','appId','connectionId','capabilityId','capabilityVersion']){
        const value=source[key];if(!(typeof value==='string'&&value.length<=512||typeof value==='boolean'))continue;
        details[key]=value;bounded.details=details;if(messageBytes(fallback)>this.maxMessageBytes)delete details[key];
      }
      if(!Object.keys(details).length)delete bounded.details;
      return fallback;
    };
    if(item.protocolVersion!=='2.0')return response({code:'UNSUPPORTED_PROTOCOL',message:'Unsupported component protocol major.',retryPolicy:'never'});
    try{if(messageBytes(message)>this.maxMessageBytes)return response({code:'BRIDGE_MESSAGE_TOO_LARGE',message:'Component request exceeds the negotiated byte limit.',retryPolicy:'never'});}catch(error){return response({code:'INVALID_BRIDGE_MESSAGE',message:error instanceof Error?error.message:String(error),retryPolicy:'never'});}
    if(item.type==='hello'){
      if(Object.keys(item).some(key=>!['channel','type','protocolVersion','requestId','documentNonce','clientFeatures','sessionId','viewId','buildId','frameInstanceId'].includes(key))||item.clientFeatures!==undefined&&(!Array.isArray(item.clientFeatures)||item.clientFeatures.some(feature=>typeof feature!=='string')))return response({code:'INVALID_BRIDGE_MESSAGE',message:'Invalid hello envelope.',retryPolicy:'never'});
      this.negotiatedFeatures.clear();for(const feature of item.clientFeatures as string[]??[])if(Object.hasOwn(this.extensionHandlers,feature))this.negotiatedFeatures.add(feature);
      try{return this.hello(item.requestId);}catch(error){return response({code:'CONTEXT_UNAVAILABLE',message:error instanceof Error?error.message:String(error),retryPolicy:'never'});}
    }
    if(!isBridgeIdentity(message)||!sameBridgeIdentity(this.identity,message))return;
    if(item.type==='extension'){
      const allowed=new Set(['channel','type','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','feature','action','params']);
      if(Object.keys(item).some(key=>!allowed.has(key))||!Object.hasOwn(item,'params')||typeof item.action!=='string'||!this.negotiatedFeatures.has(String(item.feature)))return response({code:'UNSUPPORTED_HOST_CAPABILITY',message:'Extension was not negotiated.',retryPolicy:'never'});
      const handler=this.extensionHandlers[item.feature as ComponentExtensionRequest['feature']];
      if(!handler)return response(unsupported(String(item.feature)));
      try {const result=await handler(message as ComponentExtensionRequest);if(!this.active)return;const output:ComponentResponse={...this.identity,channel:COMPONENT_CHANNEL,requestId:String(item.requestId),result};if(messageBytes(output)>this.maxMessageBytes)return response({code:'BRIDGE_MESSAGE_TOO_LARGE',message:'Extension response exceeds limit.',retryPolicy:'never'});return output;}
      catch(error){if(error instanceof ComponentBridgeError)return response(error.failure);const problem=error as {code?:string;message?:string};return response({code:problem.code??'COMPONENT_ACTION_FAILED',message:problem.message??String(error),retryPolicy:'never'});}
    }
    const allowed=new Set(['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId','method','params']);
    if(Object.keys(item).some(key=>!allowed.has(key))||!Object.hasOwn(item,'params'))return response({code:'INVALID_BRIDGE_MESSAGE',message:'Bridge requests require params and reject unknown envelope fields.',retryPolicy:'never'});
    const request=message as BridgeRequest;
    if(!COMPONENT_METHODS.includes(request.method))return response({code:'UNKNOWN_BRIDGE_METHOD',message:'Unknown component method.',retryPolicy:'never'});
    if(!this.supportedMethods.includes(request.method))return response(unsupported(request.method));
    if(request.method==='refresh'&&request.params!==null){
      const params=request.params as Record<string,unknown>;
      if(typeof params!=='object'||Array.isArray(params)||Object.keys(params).some(key=>!['bindingIds','forceRefresh'].includes(key))||params.bindingIds!==undefined&&(!Array.isArray(params.bindingIds)||params.bindingIds.some(id=>typeof id!=='string'||!id))||params.forceRefresh!==undefined&&typeof params.forceRefresh!=='boolean')return response({code:'INVALID_BRIDGE_MESSAGE',message:'Refresh accepts bindingIds and a boolean forceRefresh.',retryPolicy:'never'});
    }
    try{
      const handler=this.handlers[request.method as keyof ComponentHostHandlers]!;
      const result=await handler(request);
      if(!this.active)return;
      const output:ComponentResponse={...this.identity,channel:COMPONENT_CHANNEL,requestId:request.requestId,result};
      if(messageBytes(output)>this.maxMessageBytes)return response({code:'BRIDGE_MESSAGE_TOO_LARGE',message:'Component response exceeds the negotiated byte limit. Use a smaller data page.',retryPolicy:'never'});
      return output;
    }catch(error){
      if(!this.active)return;
      if(error instanceof ComponentBridgeError)return response(error.failure);
      const problem=error as {code?:string;message?:string};
      return response({code:problem.code??'COMPONENT_ACTION_FAILED',message:problem.message??String(error),retryPolicy:'never'});
    }
  }
  dispose():void {this.active=false;}
}
