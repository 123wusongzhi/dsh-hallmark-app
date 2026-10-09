import {APPS_DATA_REQUEST_TIMEOUT_MS,HttpRuntimeTransport, type RuntimeTransport} from '../../app-sdk/src/index.ts';
import type {AppManifest, BridgeRequest, CapabilityDescriptor, CapabilityResult, ComponentAgentIntent, ComponentContextSnapshot, InvocationRequest, JsonValue, SessionAppBinding} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {NativeBindingRequest,NativeBindingReceipt} from '../client/native-apps.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
export interface RuntimeApp extends AppManifest {providerState: string}
export interface RuntimeConnection {appId: string; connectionId: string; displayName: string; enabled: boolean}
export interface CapabilitySummary {appId: string; capabilityId: string; version: string; title: string; effect: CapabilityDescriptor['effect']; description: string}
export interface DiscoveryPage {items: CapabilitySummary[]; total: number; returned: number; nextCursor: string | null; catalogDigest: string}
export interface ModelProjection {content: string;fullResultRef?: JsonValue}
export interface PresentationInvocation {invocationId:string;request:InvocationRequest;state:'received'|'dispatching'|'settled';result?:CapabilityResult}
export interface InvocationDiagnostic {invocationId: string;traceId: string;operationId: string | null;runId: string | null;appId: string;connectionId: string;capabilityId: string;capabilityVersion: string;status: string;durationMs: number | null}
export interface AppsHostTransport extends RuntimeTransport {
  listApps(signal?: AbortSignal): Promise<RuntimeApp[]>;
  discover(options?: {appId?: string;query?: string;cursor?: string;limit?: number}, signal?: AbortSignal): Promise<DiscoveryPage>;
  listConnections(appId?: string, signal?: AbortSignal): Promise<RuntimeConnection[]>;
  sessionBindings(sessionId: string, signal?: AbortSignal): Promise<SessionAppBinding[]>;
  bind(binding: SessionAppBinding, signal?: AbortSignal): Promise<SessionAppBinding>;
  projectModelResult?(invocationId: string, signal?: AbortSignal): Promise<ModelProjection>;
  diagnostics?(sessionId: string, signal?: AbortSignal): Promise<{invocations: InvocationDiagnostic[]}>;
  componentBridge?(request: BridgeRequest, signal?: AbortSignal): Promise<JsonValue>;
  componentContexts?(sessionId: string, signal?: AbortSignal): Promise<{sessionId: string;snapshot: ComponentContextSnapshot|null}>;
  agentIntent?(sessionId: string,requestId: string,signal?: AbortSignal): Promise<ComponentAgentIntent>;
  dispatchAgent?(sessionId: string,requestId: string,requestHash: string,signal?: AbortSignal): Promise<{dispatchGranted: boolean;intent: ComponentAgentIntent}>;
  agentReceipt?(sessionId: string,requestId: string,requestHash: string,state: 'accepted'|'unknown'|'failed',receipt?: JsonValue,error?: JsonValue,signal?: AbortSignal): Promise<ComponentAgentIntent>;
  view?(sessionId: string, viewId: string, signal?: AbortSignal,version?:{buildId?:string;viewRevision?:number;publicationId?:string}): Promise<JsonValue>;
  viewData?(sessionId: string, viewId: string, signal?: AbortSignal, target?:{publicationId?:string;buildId?:string;displayId?:string;displayGeneration?:number}): Promise<JsonValue>;
  refreshView?(sessionId:string,viewId:string,forceRefresh:boolean,signal?:AbortSignal):Promise<JsonValue>;
  nativeBinding?(input:NativeBindingRequest,signal?:AbortSignal):Promise<NativeBindingReceipt>;
  inspectNativeBinding?(sessionId:string,bindRequestId:string,referenceId:string,signal?:AbortSignal):Promise<NativeBindingReceipt|null>;
  serializeNativeReference?(referenceId:string,sessionId:string,signal?:AbortSignal):Promise<{text:string}>;
  componentFeatures?(signal?:AbortSignal):Promise<{features:string[]}>;
  componentExtension?(request:ComponentExtensionRequest,signal?:AbortSignal):Promise<JsonValue>;
  authoringAction?(operation:string,sessionId:string,params:JsonValue,signal?:AbortSignal):Promise<JsonValue>;
  presentationAction?(input:{sessionId:string;capabilityId:string;input:JsonValue;requestId:string},signal?:AbortSignal):Promise<JsonValue>;
  presentationRequest?(requestId:string,signal?:AbortSignal):Promise<PresentationInvocation|null>;
  views?(sessionId:string,signal?:AbortSignal):Promise<JsonValue>;
  componentHistory?(componentId:string,signal?:AbortSignal):Promise<JsonValue>;
  saved?(signal?:AbortSignal):Promise<JsonValue>;
  componentThumbnail?(componentId:string,revision:number,signal?:AbortSignal):Promise<Response>;
  workbenchResource?(resource:string,appId:string,signal?:AbortSignal):Promise<JsonValue>;
  workbenchAction?(input:{appId:string;operation:string;params:JsonValue;sessionId?:string},signal?:AbortSignal):Promise<JsonValue>;
  legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal): Promise<ToolResult>;
}
/** Adds project catalogue/binding endpoints to the shared SDK transport, with no business dispatch implementation. */
export class HttpAppsHostTransport extends HttpRuntimeTransport implements AppsHostTransport {
  private async request(path: string, body?: unknown, signal?: AbortSignal,timeoutMs=90000): Promise<unknown> {
    const combined = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    const response = await this.fetcher(new URL(path, this.url), {method: body === undefined ? 'GET' : 'POST', headers: {Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), redirect: 'error', signal: combined});
    const value: unknown = await response.json();
    if (!response.ok) throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'), {statusCode: response.status, details: value});
    return value;
  }
  async listApps(signal?: AbortSignal) {return (await this.request('/v1/apps', undefined, signal) as {apps: RuntimeApp[]}).apps;}
  override async describe(id: string, version?: string): Promise<CapabilityDescriptor | undefined> {try {return await super.describe(id,version);} catch (error) {if ((error as {statusCode?: number}).statusCode === 404) return undefined;throw error;}}
  async discover(options: {appId?: string;query?: string;cursor?: string;limit?: number} = {}, signal?: AbortSignal) {
    const query = new URLSearchParams(Object.entries(options).filter(([,value]) => value !== undefined).map(([key,value]) => [key,String(value)]));
    return await this.request(`/v1/capabilities?${query}`, undefined, signal) as DiscoveryPage;
  }
  async listConnections(appId?: string, signal?: AbortSignal) {return (await this.request(`/v1/connections${appId ? `?appId=${encodeURIComponent(appId)}` : ''}`, undefined, signal) as {connections: RuntimeConnection[]}).connections;}
  async sessionBindings(sessionId: string, signal?: AbortSignal) {return (await this.request(`/v1/session-bindings?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal) as {bindings: SessionAppBinding[]}).bindings;}
  async bind(binding: SessionAppBinding, signal?: AbortSignal) {return await this.request('/v1/session-bindings', binding, signal) as SessionAppBinding;}
  async projectModelResult(invocationId: string, signal?: AbortSignal) {return await this.request('/v1/model-result', {invocationId}, signal) as ModelProjection;}
  async diagnostics(sessionId: string, signal?: AbortSignal) {return await this.request(`/v1/diagnostics?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal) as {invocations: InvocationDiagnostic[]};}
  async componentBridge(request: BridgeRequest, signal?: AbortSignal) {return await this.request('/v1/component-bridge', request, signal,['refresh','invokeCapability'].includes(request.method)?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
  async componentContexts(sessionId: string,signal?: AbortSignal) {return await this.request(`/v1/component-contexts?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as {sessionId: string;snapshot: ComponentContextSnapshot|null};}
  async agentIntent(sessionId: string,requestId: string,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as ComponentAgentIntent;}
  async dispatchAgent(sessionId: string,requestId: string,requestHash: string,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}/dispatch`,{sessionId,requestHash},signal) as {dispatchGranted: boolean;intent: ComponentAgentIntent};}
  async agentReceipt(sessionId: string,requestId: string,requestHash: string,state: 'accepted'|'unknown'|'failed',receipt?: JsonValue,error?: JsonValue,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}/receipt`,{sessionId,requestHash,state,...(receipt===undefined?{}:{receipt}),...(error===undefined?{}:{error})},signal) as ComponentAgentIntent;}
  async view(sessionId: string, viewId: string, signal?: AbortSignal,version?:{buildId?:string;viewRevision?:number;publicationId?:string}) {const query=new URLSearchParams({sessionId,...(version?.publicationId?{publicationId:version.publicationId}:{}),...(version?.buildId?{buildId:version.buildId}:{}),...(version?.viewRevision!==undefined?{viewRevision:String(version.viewRevision)}:{})});return await this.request(`/v1/views/${encodeURIComponent(viewId)}?${query}`, undefined, signal) as JsonValue;}
  async viewData(sessionId: string, viewId: string, signal?: AbortSignal, target:{publicationId?:string;buildId?:string;displayId?:string;displayGeneration?:number}={}) {const query=new URLSearchParams({sessionId});for(const [key,value]of Object.entries(target))if(value!==undefined)query.set(key,String(value));return await this.request(`/v1/views/${encodeURIComponent(viewId)}/data?${query}`, undefined, signal) as JsonValue;}
  async refreshView(sessionId:string,viewId:string,forceRefresh:boolean,signal?:AbortSignal){return await this.request(`/v1/views/${encodeURIComponent(viewId)}/refresh`,{sessionId,forceRefresh},signal,APPS_DATA_REQUEST_TIMEOUT_MS) as JsonValue;}
  async nativeBinding(input:NativeBindingRequest,signal?:AbortSignal){return await this.request('/v1/native-bindings',input,signal) as NativeBindingReceipt;}
  async inspectNativeBinding(sessionId:string,bindRequestId:string,referenceId:string,signal?:AbortSignal){return await this.request(`/v1/native-bindings?${new URLSearchParams({sessionId,bindRequestId,referenceId})}`,undefined,signal) as NativeBindingReceipt|null;}
  async serializeNativeReference(referenceId:string,sessionId:string,signal?:AbortSignal){return await this.request('/v1/native-references/serialize',{referenceId,sessionId},signal) as {text:string};}
  async componentFeatures(signal?:AbortSignal){return await this.request('/v1/authoring/features',undefined,signal) as {features:string[]};}
  async componentExtension(request:ComponentExtensionRequest,signal?:AbortSignal){return await this.request('/v1/component-extension',request,signal,request.feature==='bindingPagesV1'?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
  async authoringAction(operation:string,sessionId:string,params:JsonValue,signal?:AbortSignal){return await this.request(`/v1/authoring/${encodeURIComponent(operation)}`,{sessionId,params},signal,operation==='preview'?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
  async presentationAction(input:{sessionId:string;capabilityId:string;input:JsonValue;requestId:string},signal?:AbortSignal){return await this.request('/v1/presentation-actions',input,signal,APPS_DATA_REQUEST_TIMEOUT_MS) as JsonValue;}
  async presentationRequest(requestId:string,signal?:AbortSignal){try{return await this.request(`/v1/invocations/${encodeURIComponent(requestId)}`,undefined,signal) as PresentationInvocation;}catch(error){if((error as {statusCode?:number}).statusCode===404)return null;throw error;}}
  async views(sessionId:string,signal?:AbortSignal){return await this.request(`/v1/views?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as JsonValue;}
  async componentHistory(componentId:string,signal?:AbortSignal){return await this.request(`/v1/component-history?componentId=${encodeURIComponent(componentId)}`,undefined,signal) as JsonValue;}
  async saved(signal?:AbortSignal){return await this.request('/v1/saved',undefined,signal) as JsonValue;}
  async componentThumbnail(componentId:string,revision:number,signal?:AbortSignal):Promise<Response>{
    const response=await this.fetcher(new URL(`/v1/component-thumbnail?${new URLSearchParams({componentId,revision:String(revision)})}`,this.url),{headers:{Authorization:`Bearer ${this.token}`},redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(10000),...(signal?[signal]:[])])});
    if(response.status===404)return new Response(null,{status:404});
    if(!response.ok)throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:response.status});
    if(response.headers.get('content-type')?.split(';')[0].trim()!=='image/png')throw new Error('INVALID_COMPONENT_THUMBNAIL');
    return response;
  }
  async workbenchResource(resource:string,appId:string,signal?:AbortSignal){return await this.request(`/v1/workbench?${new URLSearchParams({resource,appId})}`,undefined,signal) as JsonValue;}
  async workbenchAction(input:{appId:string;operation:string;params:JsonValue;sessionId?:string},signal?:AbortSignal){return await this.request('/v1/workbench',input,signal,APPS_DATA_REQUEST_TIMEOUT_MS) as JsonValue;}
  async legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal) {return await this.request('/v1/legacy-invocations', input, signal) as ToolResult;}
}
