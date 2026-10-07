import type {BridgeRequest,FailureInfo,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {ComponentHandlerFactory} from '../../dsh-plugin/client/component-handlers.ts';
import type {ComponentResponse} from '../../component-runtime/src/apps-client.ts';
import {COMPONENT_CHANNEL,ComponentBridgeError,sameBridgeIdentity} from '../../component-runtime/src/apps-client.ts';
import {selectionInputBridge} from '../../dsh-plugin/client/selection.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
import type {ExtendedComponentHandlers} from '../../dsh-plugin/client/component-frame.tsx';
export interface PublicationFrame {publicationId:string;attemptId:string;attemptEpoch:number}

function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
function record(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function isFailure(value:unknown):value is FailureInfo {const item=record(value);return typeof item.code==='string'&&typeof item.message==='string'&&['never','read_retry','inspect_only'].includes(String(item.retryPolicy));}
/** Browser transport carries the complete parent-owned identity to the native Host proxy. */
export const createAppsComponentHandlers:ComponentHandlerFactory=(identity,signal)=>createAppsPresentationHandlers(identity,signal,undefined,false);
export async function createAppsPresentationHandlers(identity:Parameters<ComponentHandlerFactory>[0],signal:AbortSignal,publication?:PublicationFrame,extensionsEnabled=true):Promise<ExtendedComponentHandlers>{
  // Unknown, unreachable and disabled Hosts keep formal session input methods out of hello.
  let features:{updateContext:boolean;requestAgent:boolean;nativeSessionAdapter:string;adapterReady:boolean;hostVersion:string|null}={updateContext:false,requestAgent:false,nativeSessionAdapter:'disabled',adapterReady:false,hostVersion:null};
  try {
    const response=await fetch('/api/dsh-apps?resource=hostCapabilities',{credentials:'same-origin',signal}),value=record(await response.json());
    if(response.ok&&value.adapterReady===true&&value.nativeSessionAdapter==='dsh-0.2.0-rc.2'&&value.hostVersion==='0.2.0-rc.2')features={updateContext:value.updateContext===true,requestAgent:value.requestAgent===true,nativeSessionAdapter:value.nativeSessionAdapter,adapterReady:true,hostVersion:value.hostVersion};
  }catch(error){if(signal.aborted)throw error;}
  let extensionFeatures:string[]=[];
  if(extensionsEnabled)try{const response=await fetch('/api/dsh-apps?resource=componentFeatures',{credentials:'same-origin',signal}),value=record(await response.json());if(response.ok&&Array.isArray(value.features))extensionFeatures=value.features.filter((feature):feature is string=>feature==='renderReadyV1'||feature==='uiStateV1');}catch(error){if(signal.aborted)throw error;}
  const call=async(request:BridgeRequest):Promise<JsonValue>=>{
    if(request.sessionId!==identity.sessionId||request.viewId!==identity.viewId||request.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component owner or build changed. Reopen it.');
    if(signal.aborted)throw new ComponentBridgeError({code:'BRIDGE_CLOSED',message:'The component was closed before the proxy request.',retryPolicy:'never'});
    const body=JSON.stringify({action:'componentBridge',request});
    const uncertain=(code:string,message:string)=>{
      const input=record(request.params),mutation=request.method==='requestAgent'||request.method==='invokeCapability'&&typeof input.idempotencyKey==='string'&&input.idempotencyKey.length>0;
      const details:Record<string,JsonValue>={sessionId:request.sessionId,viewId:request.viewId,buildId:request.buildId,frameInstanceId:request.frameInstanceId,requestId:request.requestId};
      if(request.method==='invokeCapability')for(const key of ['appId','connectionId','capabilityId','capabilityVersion','idempotencyKey'])if(typeof input[key]==='string')details[key]=input[key];
      if(mutation)details.doNotResubmitMutation=true;
      return new ComponentBridgeError({code,message,retryPolicy:mutation?'inspect_only':request.method==='invokeCapability'||['getData','getContext','refresh'].includes(request.method)?'read_retry':'never',details});
    };
    let response:Response,value:ComponentResponse;
    try {response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body,signal});value=await response.json() as ComponentResponse;}
    catch(error){throw uncertain('BRIDGE_PROXY_UNAVAILABLE',error instanceof Error?error.message:'Apps component proxy response is unavailable.');}
    const packet=record(value),hasBridgeEnvelope=['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId'].some(key=>Object.hasOwn(packet,key));
    if(hasBridgeEnvelope&&(value.channel!==COMPONENT_CHANNEL||value.requestId!==request.requestId||!sameBridgeIdentity(request,value)))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned a different component identity. Inspect this original request only.');
    if(!response.ok){if(isFailure(packet.error))throw new ComponentBridgeError(packet.error);fail(record(packet.error).code as string??'BRIDGE_PROXY_UNAVAILABLE',record(packet.error).message as string??'Apps component proxy is unavailable.');}
    if(!hasBridgeEnvelope)throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned no correlated component response.');
    if(value.error){if(!isFailure(value.error))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned an invalid component failure.');throw new ComponentBridgeError(value.error);}
    if(!Object.hasOwn(value,'result'))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned no component result.');
    return value.result!;
  };
  const extension=async(request:ComponentExtensionRequest)=>{
    if(request.sessionId!==identity.sessionId||request.viewId!==identity.viewId||request.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component owner or build changed.');
    const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'componentExtension',request}),signal}),value=await response.json() as ComponentResponse;
    if(!response.ok||value.error)fail(value.error?.code??'EXTENSION_UNAVAILABLE',value.error?.message??'Component extension is unavailable.');
    if(value.channel!==COMPONENT_CHANNEL||value.requestId!==request.requestId||!sameBridgeIdentity(request,value)||!Object.hasOwn(value,'result'))fail('INVALID_BRIDGE_RESPONSE','Extension response has a different frame identity.');
    if(request.feature==='renderReadyV1')window.dispatchEvent(new CustomEvent('apps-authoring-published',{detail:{sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,...(publication?{publicationId:publication.publicationId}:{})}}));
    return value.result!;
  };
  return {
    getData:call,
    getContext:async request=>({ ...record(await call(request)),...(publication?{publication}:{}),nativeFeatures:features,attachment:selectionInputBridge.availability(identity.sessionId)} as unknown as JsonValue),
    refresh:call,
    invokeCapability:call,
    ...(features.updateContext?{updateContext:call}:{}),
    ...(features.requestAgent?{requestAgent:call}:{}),
    ...(extensionFeatures.length?{extensions:Object.fromEntries(extensionFeatures.map(feature=>[feature,extension])),authorizeFrame:async(frame,documentNonce,clientFeatures)=>{
      const granted=clientFeatures.filter(feature=>extensionFeatures.includes(feature));
      const params=publication?{...publication,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce,clientFeatures:granted}:{viewId:frame.viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce,clientFeatures:granted};
      const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:publication?'authorizeFrame':'negotiateFrame',sessionId:frame.sessionId,params}),signal}),value=record(await response.json());
      if(!response.ok)fail('FRAME_AUTHORIZATION_FAILED',String(record(value.error).message??'The Runtime did not authorize this iframe document.'));
      if(!Array.isArray(value.features))fail('INVALID_FRAME_GRANT','The Runtime did not return a feature grant.');
      return value.features.filter((feature):feature is string=>typeof feature==='string'&&granted.includes(feature));
    },retireFrame:async(frame,documentNonce)=>{await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:'retireFrame',sessionId:frame.sessionId,params:{viewId:frame.viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce}}),keepalive:true,signal:AbortSignal.timeout(3000)});}}:{}),
    attachSelection:async request=>{
      const availability=selectionInputBridge.availability(identity.sessionId);if(!availability.available)fail('UNSUPPORTED_HOST_CAPABILITY',availability.disabledReason??'Native file attachments are unavailable.');
      const verified=record(await call(request));if(verified.status!=='validated')fail('INVALID_ATTACHMENT_RECEIPT','The Runtime must validate resource selection before native insertion.');
      const selection=verified.selection as SelectionEnvelope,input=request.params as unknown as SelectionEnvelope;
      if(!selection||selection.bindingId!==input.bindingId||selection.datasetRevision!==input.datasetRevision||!Array.isArray(selection.resources)||selection.resources.length!==input.resources.length||selection.resources.some((resource,index)=>{const supplied=input.resources[index];return !supplied||resource.appId!==supplied.appId||resource.connectionId!==supplied.connectionId||resource.resourceType!==supplied.resourceType||resource.resourceId!==supplied.resourceId||resource.revision!==supplied.revision;}))fail('INVALID_ATTACHMENT_RECEIPT','Validated selection differs from the component request.');
      const result=selectionInputBridge.attachResources(identity.sessionId,{...selection,...identity});
      if(!result.ok)fail('NATIVE_ATTACHMENT_UNAVAILABLE',result.message);
      return {status:result.pending?'pending':'attached',message:result.message};
    },
  };
}
