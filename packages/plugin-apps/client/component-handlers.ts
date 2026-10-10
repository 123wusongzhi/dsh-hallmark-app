import type {BridgeRequest,FailureInfo,JsonValue} from '../../app-contracts/src/index.ts';
import type {ComponentHandlerFactory} from '../../dsh-plugin/client/component-handlers.ts';
import type {ComponentResponse} from '../../component-runtime/src/apps-client.ts';
import {COMPONENT_CHANNEL,ComponentBridgeError,sameBridgeIdentity} from '../../component-runtime/src/apps-client.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
import type {ExtendedComponentHandlers,ComponentFrameError} from '../../dsh-plugin/client/component-frame.tsx';
import {awaitDisplayRetirement,retireDisplayDocument} from './frame-retirement.ts';
export interface PublicationFrame {publicationId:string;attemptId:string;attemptEpoch:number;displayId?:string;displayGeneration?:number}

function fail(code:string,message:string):never {throw Object.assign(new Error(message),{code});}
function record(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function isFailure(value:unknown):value is FailureInfo {const item=record(value);return typeof item.code==='string'&&typeof item.message==='string'&&['never','read_retry','inspect_only'].includes(String(item.retryPolicy));}
/** Browser transport carries the complete parent-owned identity to the native Host proxy. */
export const createAppsComponentHandlers:ComponentHandlerFactory=(identity,signal)=>createAppsPresentationHandlers(identity,signal,undefined,false);
export async function createAppsPresentationHandlers(identity:Parameters<ComponentHandlerFactory>[0],signal:AbortSignal,publication?:PublicationFrame,extensionsEnabled=true,onFrameError?:(problem:ComponentFrameError)=>void,isCurrent?:()=>boolean):Promise<ExtendedComponentHandlers>{
  const checkCurrent=()=>{if(signal.aborted||isCurrent&&!isCurrent())throw new ComponentBridgeError({code:'BRIDGE_CLOSED',message:'The native component owner changed or the frame closed.',retryPolicy:'never'});};
  const retirementScope=publication?.displayId?JSON.stringify([identity.sessionId,identity.viewId,identity.buildId,publication.publicationId,publication.attemptId,publication.attemptEpoch,publication.displayId,publication.displayGeneration]):undefined;
  let authorizedDocument:{identity:Parameters<NonNullable<ExtendedComponentHandlers['authorizeFrame']>>[0];nonce:string}|undefined;
  // Unknown, unreachable and disabled Hosts keep formal session input methods out of hello.
  let features:{updateContext:boolean;requestAgent:boolean;nativeSessionAdapter:string;adapterReady:boolean;hostVersion:string|null}={updateContext:false,requestAgent:false,nativeSessionAdapter:'disabled',adapterReady:false,hostVersion:null};
  try {
    const response=await fetch('/api/dsh-apps?resource=hostCapabilities',{credentials:'same-origin',signal}),value=record(await response.json());
    if(response.ok&&value.adapterReady===true&&value.nativeSessionAdapter==='dsh-0.2.0-rc.2'&&value.hostVersion==='0.2.0-rc.2')features={updateContext:value.updateContext===true,requestAgent:value.requestAgent===true,nativeSessionAdapter:value.nativeSessionAdapter,adapterReady:true,hostVersion:value.hostVersion};
  }catch(error){if(signal.aborted)throw error;}
  let extensionFeatures:string[]=[];
  if(extensionsEnabled)try{const response=await fetch('/api/dsh-apps?resource=componentFeatures',{credentials:'same-origin',signal}),value=record(await response.json());if(response.ok&&Array.isArray(value.features))extensionFeatures=value.features.filter((feature):feature is string=>feature==='renderReadyV1'||feature==='uiStateV1'||feature==='bindingPagesV1'||feature==='dataTransferV1');}catch(error){if(signal.aborted)throw error;}
  if(publication?.displayId&&!extensionFeatures.includes('renderReadyV1'))fail('DISPLAY_EXTENSION_UNAVAILABLE','The Host did not provide the component display protocol.');
  const call=async(request:BridgeRequest):Promise<JsonValue>=>{
    checkCurrent();
    if(request.sessionId!==identity.sessionId||request.viewId!==identity.viewId||request.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component owner or build changed. Reopen it.');
    if(signal.aborted)throw new ComponentBridgeError({code:'BRIDGE_CLOSED',message:'The component was closed before the proxy request.',retryPolicy:'never'});
    const body=JSON.stringify({action:'componentBridge',request});
    const uncertain=(code:string,message:string)=>{
      const input=record(request.params),mutation=request.method==='requestAgent'||request.method==='invokeCapability'&&(typeof input.idempotencyKey==='string'&&input.idempotencyKey.length>0||isBusinessSubmission(input.appId,input.capabilityId));
      const details:Record<string,JsonValue>={sessionId:request.sessionId,viewId:request.viewId,buildId:request.buildId,frameInstanceId:request.frameInstanceId,requestId:request.requestId};
      if(request.method==='invokeCapability')for(const key of ['appId','connectionId','capabilityId','capabilityVersion','idempotencyKey'])if(typeof input[key]==='string')details[key]=input[key];
      if(mutation)details.doNotResubmitMutation=true;
      return new ComponentBridgeError({code,message,retryPolicy:mutation?'inspect_only':request.method==='invokeCapability'||['getData','getContext','refresh'].includes(request.method)?'read_retry':'never',details});
    };
    let response:Response,value:ComponentResponse;
    try {response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body,signal});value=await response.json() as ComponentResponse;}
    catch(error){throw uncertain('BRIDGE_PROXY_UNAVAILABLE',error instanceof Error?error.message:'Apps component proxy response is unavailable.');}
    checkCurrent();
    const packet=record(value),hasBridgeEnvelope=['channel','protocolVersion','sessionId','viewId','buildId','frameInstanceId','requestId'].some(key=>Object.hasOwn(packet,key));
    if(hasBridgeEnvelope&&(value.channel!==COMPONENT_CHANNEL||value.requestId!==request.requestId||!sameBridgeIdentity(request,value)))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned a different component identity. Inspect this original request only.');
    if(!response.ok){if(isFailure(packet.error))throw new ComponentBridgeError(packet.error);fail(record(packet.error).code as string??'BRIDGE_PROXY_UNAVAILABLE',record(packet.error).message as string??'Apps component proxy is unavailable.');}
    if(!hasBridgeEnvelope)throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned no correlated component response.');
    if(value.error){if(!isFailure(value.error))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned an invalid component failure.');throw new ComponentBridgeError(value.error);}
    if(!Object.hasOwn(value,'result'))throw uncertain('INVALID_BRIDGE_RESPONSE','Apps proxy returned no component result.');
    return value.result!;
  };
  const extension=async(request:ComponentExtensionRequest)=>{
    checkCurrent();
    if(request.sessionId!==identity.sessionId||request.viewId!==identity.viewId||request.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component owner or build changed.');
    const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'componentExtension',request}),signal}),value=await response.json() as ComponentResponse;
    checkCurrent();
    if(!response.ok||value.error)fail(value.error?.code??'EXTENSION_UNAVAILABLE',value.error?.message??'Component extension is unavailable.');
    if(value.channel!==COMPONENT_CHANNEL||value.requestId!==request.requestId||!sameBridgeIdentity(request,value)||!Object.hasOwn(value,'result'))fail('INVALID_BRIDGE_RESPONSE','Extension response has a different frame identity.');
    if(request.feature==='renderReadyV1'){
      if(publication?.displayId){const display=record(record(value.result).display);if(display.displayId!==publication.displayId||display.generation!==publication.displayGeneration||display.ownerSessionId!==identity.sessionId||display.viewId!==identity.viewId||display.publicationId!==publication.publicationId||display.buildId!==identity.buildId||display.state!=='ready')fail('INVALID_DISPLAY_RECEIPT','Runtime did not confirm this exact display.');}
      window.dispatchEvent(new CustomEvent(publication?.displayId?'apps-display-ready':'apps-authoring-published',{detail:{sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,viewRevision:record(record(value.result).view).viewRevision,...(publication?{publicationId:publication.publicationId,displayId:publication.displayId}:{})}}));
    }
    return value.result!;
  };
  const initialized=new Set<string>();
  const initial=async(request:BridgeRequest):Promise<JsonValue>=>{const first=!initialized.has(request.method);initialized.add(request.method);try{return await call(request);}catch(error){if(first&&publication?.displayId&&!signal.aborted)onFrameError?.({phase:request.method==='getData'?'data':'context',code:String(record(error).code??'DISPLAY_INITIALIZATION_FAILED'),message:error instanceof Error?error.message:String(error)});throw error;}};
  const displayExtension=async(request:ComponentExtensionRequest)=>{
    checkCurrent();
    // Older SDKs omitted this parameter for UI-state and binding-page calls. Only this authorized frame
    // may receive its parent-owned nonce; an explicitly wrong nonce is never changed.
    if(publication?.displayId&&(request.feature==='uiStateV1'||request.feature==='bindingPagesV1')&&authorizedDocument&&sameBridgeIdentity(request,authorizedDocument.identity)&&!Object.hasOwn(record(request.params),'documentNonce'))request={...request,params:{...record(request.params),documentNonce:authorizedDocument.nonce} as JsonValue};
    try{return await extension(request);}catch(error){if(request.feature==='renderReadyV1'&&publication?.displayId&&!signal.aborted&&(isCurrent?.()??true))onFrameError?.({phase:'readiness',code:String(record(error).code??'DISPLAY_READY_FAILED'),message:error instanceof Error?error.message:String(error)});throw error;}
  };
  return {
    getData:initial,
    getContext:async request=>({ ...record(await initial(request)),...(publication?{publication,...(publication.displayId?{display:{displayId:publication.displayId,generation:publication.displayGeneration}}:{})}:{}),nativeFeatures:features,attachment:{available:false,disabledReason:'附加到聊天暂未开放。'}} as unknown as JsonValue),
    refresh:call,
    invokeCapability:call,
    ...(features.updateContext?{updateContext:call}:{}),
    ...(features.requestAgent?{requestAgent:call}:{}),
    ...(extensionFeatures.length?{extensions:Object.fromEntries(extensionFeatures.map(feature=>[feature,displayExtension])),authorizeFrame:async(frame,documentNonce,clientFeatures)=>{
      checkCurrent();
      if(frame.sessionId!==identity.sessionId||frame.viewId!==identity.viewId||frame.buildId!==identity.buildId)fail('BRIDGE_IDENTITY_STALE','The component owner or build changed. Reopen it.');
      if(retirementScope){await awaitDisplayRetirement(retirementScope,signal);checkCurrent();}
      const granted=clientFeatures.filter(feature=>extensionFeatures.includes(feature));
      const params=publication?{...publication,...(publication.displayId?{viewId:frame.viewId}:{}),buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce,clientFeatures:granted}:{viewId:frame.viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce,clientFeatures:granted};
      const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:publication?.displayId?'authorizeDisplayFrame':publication?'authorizeFrame':'negotiateFrame',sessionId:frame.sessionId,params}),signal}),value=record(await response.json());
      checkCurrent();
      if(!response.ok)fail(String(record(value.error).code??'FRAME_AUTHORIZATION_FAILED'),String(record(value.error).message??'The Runtime did not authorize this iframe document.'));
      if(!Array.isArray(value.features))fail('INVALID_FRAME_GRANT','The Runtime did not return a feature grant.');
      if(publication?.displayId){const display=record(value.display);if(display.ownerSessionId!==identity.sessionId||display.viewId!==identity.viewId||display.publicationId!==publication.publicationId||display.buildId!==identity.buildId||display.displayId!==publication.displayId||display.generation!==publication.displayGeneration||display.frameInstanceId!==frame.frameInstanceId||display.documentNonce!==documentNonce)fail('INVALID_FRAME_GRANT','Runtime returned a different display document.');}
      authorizedDocument={identity:frame,nonce:documentNonce};
      return value.features.filter((feature):feature is string=>typeof feature==='string'&&granted.includes(feature));
    },retireFrame:(frame,documentNonce)=>{
      if(frame.sessionId!==identity.sessionId||frame.viewId!==identity.viewId||frame.buildId!==identity.buildId)return Promise.reject(Object.assign(new Error('The closing frame does not belong to this component.'),{code:'BRIDGE_IDENTITY_STALE'}));
      const retire=async()=>{try{const response=await fetch('/api/dsh-apps',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authoring',operation:'retireFrame',sessionId:frame.sessionId,params:{viewId:frame.viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId,documentNonce}}),keepalive:true,signal:AbortSignal.timeout(3000)}),value=record(await response.json());if(!response.ok||value.retired!==true)throw new Error('The Runtime did not confirm retirement.');}catch{fail('DISPLAY_RETIREMENT_UNCONFIRMED','上次预览尚未收起，请重新打开组件后再试。');}};
      return retirementScope?retireDisplayDocument(retirementScope,JSON.stringify([frame.frameInstanceId,documentNonce]),retire):retire();
    }}:{}),
    attachSelection:async()=>{checkCurrent();fail('UNSUPPORTED_HOST_CAPABILITY','附加到聊天暂未开放。');},
  };
}
import {isBusinessSubmission} from '../../app-sdk/src/deadlines.ts';
