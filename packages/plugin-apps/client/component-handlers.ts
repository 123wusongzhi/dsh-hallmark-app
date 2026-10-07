import type {BridgeRequest,JsonValue,SelectionEnvelope} from '../../app-contracts/src/index.ts';
import type {ComponentHandlerFactory} from '../../dsh-plugin/client/component-handlers.ts';
import type {ComponentResponse} from '../../component-runtime/src/apps-client.ts';
import {COMPONENT_CHANNEL,sameBridgeIdentity} from '../../component-runtime/src/apps-client.ts';
import {selectionInputBridge} from '../../dsh-plugin/client/selection.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
import type {ExtendedComponentHandlers} from '../../dsh-plugin/client/component-frame.tsx';
export interface PublicationFrame {publicationId:string;attemptId:string;attemptEpoch:number}

function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
function record(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
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
    const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'componentBridge',request}),signal});
    const value=await response.json() as ComponentResponse;
    if(!response.ok)fail(record(value.error).code as string??'BRIDGE_PROXY_UNAVAILABLE',record(value.error).message as string??'Apps component proxy is unavailable.');
    if(value.channel!==COMPONENT_CHANNEL||value.requestId!==request.requestId||!sameBridgeIdentity(request,value))fail('INVALID_BRIDGE_RESPONSE','Apps proxy returned a different component identity.');
    if(value.error)fail(value.error.code,value.error.message);
    if(!Object.hasOwn(value,'result'))fail('INVALID_BRIDGE_RESPONSE','Apps proxy returned no component result.');
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
