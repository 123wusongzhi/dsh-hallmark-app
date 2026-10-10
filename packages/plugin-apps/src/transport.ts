import {APPS_DATA_REQUEST_TIMEOUT_MS,appsInvocationTimeout,HttpRuntimeTransport, type RuntimeTransport} from '../../app-sdk/src/index.ts';
import {loopbackHttpFetch} from '../../app-sdk/src/loopback-http.ts';
import type {AppManifest, BridgeRequest, CapabilityDescriptor, CapabilityResult, ComponentAgentIntent, ComponentContextSnapshot, InvocationRequest, JsonValue, SessionAppBinding} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {NativeBindingRequest,NativeBindingReceipt} from '../client/native-apps.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
import type {ComponentFavorites} from '../../service/src/component-favorites.ts';
import type {ReviewCompletion,ReviewOwner,ReviewTicket} from '../../service/src/review-bridge.ts';
export interface RuntimeApp extends AppManifest {providerState: string}
export interface RuntimeConnection {appId: string; connectionId: string; displayName: string; enabled: boolean}
export interface CapabilitySummary {appId: string; capabilityId: string; version: string; title: string; effect: CapabilityDescriptor['effect']; description: string}
export interface DiscoveryPage {items: CapabilitySummary[]; total: number; returned: number; nextCursor: string | null; catalogDigest: string}
export interface ModelProjection {content: string;fullResultRef?: JsonValue}
export interface PresentationInvocation {invocationId:string;request:InvocationRequest;state:'received'|'dispatching'|'settled';result?:CapabilityResult}
export interface InvocationDiagnostic {invocationId: string;traceId: string;operationId: string | null;runId: string | null;appId: string;connectionId: string;capabilityId: string;capabilityVersion: string;status: string;durationMs: number | null}
export interface AppsHostTransport extends RuntimeTransport {
  businessSettingsRead?(connectionId?:string,storeId?:string,signal?:AbortSignal):Promise<JsonValue>;
  businessSettingsWrite?(input:{connectionId:string;operation:string;input:JsonValue},signal?:AbortSignal):Promise<JsonValue>;
  reviewNext?(owner:ReviewOwner,signal?:AbortSignal):Promise<ReviewTicket|null>;
  reviewComplete?(ticket:ReviewTicket,completion:ReviewCompletion,signal?:AbortSignal):Promise<void>;
  listApps(signal?: AbortSignal): Promise<RuntimeApp[]>;
  discover(options?: {appId?: string;query?: string;cursor?: string;limit?: number}, signal?: AbortSignal): Promise<DiscoveryPage>;
  listConnections(appId?: string, signal?: AbortSignal): Promise<RuntimeConnection[]>;
  sessionBindings(sessionId: string, signal?: AbortSignal): Promise<SessionAppBinding[]>;
  bind(binding: SessionAppBinding, signal?: AbortSignal): Promise<SessionAppBinding>;
  projectModelResult?(invocationId: string, signal?: AbortSignal): Promise<ModelProjection>;
  readModelResult?(input:{resultRef:string;sessionId:string;path:string;cursor?:string;limit?:number},signal?:AbortSignal):Promise<JsonValue>;
  invokeRouted?(request:InvocationRequest,signal?:AbortSignal):Promise<{result:CapabilityResult;modelProjection?:ModelProjection}>;
  viewsResponse?(sessionId:string,etag?:string|null,signal?:AbortSignal):Promise<Response>;
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
  favorites?(sessionId:string,signal?:AbortSignal):Promise<ComponentFavorites>;
  setFavorite?(input:{sessionId:string;componentId:string;favorite:boolean},signal?:AbortSignal):Promise<ComponentFavorites>;
  componentThumbnail?(componentId:string,revision:number,signal?:AbortSignal):Promise<Response>;
  workbenchResource?(resource:string,appId:string,signal?:AbortSignal):Promise<JsonValue>;
  workbenchAction?(input:{appId:string;operation:string;params:JsonValue;sessionId?:string},signal?:AbortSignal):Promise<JsonValue>;
  legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal): Promise<ToolResult>;
}
/** Adds project catalogue/binding endpoints to the shared SDK transport, with no business dispatch implementation. */
export class HttpAppsHostTransport extends HttpRuntimeTransport implements AppsHostTransport {
  async businessSettingsRead(connectionId?:string,storeId?:string,signal?:AbortSignal):Promise<JsonValue>{return await this.request(`/v1/business-settings?${new URLSearchParams({...connectionId?{connectionId}:{},...storeId?{storeId}:{}})}`,undefined,signal) as JsonValue;}
  async businessSettingsWrite(input:{connectionId:string;operation:string;input:JsonValue},signal?:AbortSignal):Promise<JsonValue>{return await this.request('/v1/business-settings',input,signal) as JsonValue;}
  async reviewNext(owner:ReviewOwner,signal?:AbortSignal):Promise<ReviewTicket|null>{return (await this.request('/v1/review-requests/next',owner,signal,25000) as {ticket:ReviewTicket|null}).ticket;}
  async reviewComplete(ticket:ReviewTicket,completion:ReviewCompletion,signal?:AbortSignal):Promise<void>{await this.request('/v1/review-requests/complete',{...ticket.owner,requestId:ticket.requestId,claimToken:ticket.claimToken,...completion},signal);}
  private async request(path: string, body?: unknown, signal?: AbortSignal,timeoutMs=90000): Promise<unknown> {
    const combined = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    const send=this.nativeHttp&&timeoutMs>300000?loopbackHttpFetch:this.fetcher;
    const response = await send(new URL(path, this.url), {method: body === undefined ? 'GET' : 'POST', headers: {Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), redirect: 'error', signal: combined});
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
  async readModelResult(input:{resultRef:string;sessionId:string;path:string;cursor?:string;limit?:number},signal?:AbortSignal){const query=new URLSearchParams({sessionId:input.sessionId,path:input.path,...(input.cursor!==undefined?{cursor:input.cursor}:{}),...(input.limit!==undefined?{limit:String(input.limit)}:{})});return await this.request(`/v1/results/${encodeURIComponent(input.resultRef)}?${query}`,undefined,signal) as JsonValue;}
  async invokeRouted(request:InvocationRequest,signal?:AbortSignal){return await this.request('/v1/routed-invocations',request,signal,appsInvocationTimeout(request)) as {result:CapabilityResult;modelProjection?:ModelProjection};}
  async viewsResponse(sessionId:string,etag?:string|null,signal?:AbortSignal):Promise<Response> {
    return this.fetcher(new URL(`/v1/views?sessionId=${encodeURIComponent(sessionId)}`,this.url),{headers:{Authorization:`Bearer ${this.token}`,...(etag?{'If-None-Match':etag}:{})},redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(5000),...(signal?[signal]:[])])});
  }
  async diagnostics(sessionId: string, signal?: AbortSignal) {return await this.request(`/v1/diagnostics?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal) as {invocations: InvocationDiagnostic[]};}
  async componentBridge(request: BridgeRequest, signal?: AbortSignal) {return await this.request('/v1/component-bridge', request, signal,request.method==='invokeCapability'?appsInvocationTimeout(request.params as {appId?:unknown;capabilityId?:unknown;deadlineAt?:unknown}):request.method==='refresh'?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
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
  async componentExtension(request:ComponentExtensionRequest,signal?:AbortSignal){return await this.request('/v1/component-extension',request,signal,['bindingPagesV1','dataTransferV1'].includes(request.feature)?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
  async authoringAction(operation:string,sessionId:string,params:JsonValue,signal?:AbortSignal){return await this.request(`/v1/authoring/${encodeURIComponent(operation)}`,{sessionId,params},signal,operation==='preview'?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
  async presentationAction(input:{sessionId:string;capabilityId:string;input:JsonValue;requestId:string},signal?:AbortSignal){return await this.request('/v1/presentation-actions',input,signal,APPS_DATA_REQUEST_TIMEOUT_MS) as JsonValue;}
  async presentationRequest(requestId:string,signal?:AbortSignal){try{return await this.request(`/v1/invocations/${encodeURIComponent(requestId)}`,undefined,signal) as PresentationInvocation;}catch(error){if((error as {statusCode?:number}).statusCode===404)return null;throw error;}}
  async views(sessionId:string,signal?:AbortSignal){return await this.request(`/v1/views?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as JsonValue;}
  async componentHistory(componentId:string,signal?:AbortSignal){return await this.request(`/v1/component-history?componentId=${encodeURIComponent(componentId)}`,undefined,signal) as JsonValue;}
  async saved(signal?:AbortSignal){return await this.request('/v1/saved',undefined,signal) as JsonValue;}
  async favorites(sessionId:string,signal?:AbortSignal){return await this.request(`/v1/favorites?${new URLSearchParams({sessionId})}`,undefined,signal) as ComponentFavorites;}
  async setFavorite(input:{sessionId:string;componentId:string;favorite:boolean},signal?:AbortSignal){return await this.request('/v1/favorites',input,signal) as ComponentFavorites;}
  async componentThumbnail(componentId:string,revision:number,signal?:AbortSignal):Promise<Response>{
    const response=await this.fetcher(new URL(`/v1/component-thumbnail?${new URLSearchParams({componentId,revision:String(revision)})}`,this.url),{headers:{Authorization:`Bearer ${this.token}`},redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(10000),...(signal?[signal]:[])])});
    if(response.status===404)return new Response(null,{status:404});
    if(!response.ok)throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:response.status});
    if(response.headers.get('content-type')?.split(';')[0].trim()!=='image/png')throw new Error('INVALID_COMPONENT_THUMBNAIL');
    return response;
  }
  async workbenchResource(resource:string,appId:string,signal?:AbortSignal){return await this.request(`/v1/workbench?${new URLSearchParams({resource,appId})}`,undefined,signal) as JsonValue;}
  async workbenchAction(input:{appId:string;operation:string;params:JsonValue;sessionId?:string},signal?:AbortSignal){return await this.request('/v1/workbench',input,signal,APPS_DATA_REQUEST_TIMEOUT_MS) as JsonValue;}
  async legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal) {return await this.request('/v1/legacy-invocations', input, signal,appsInvocationTimeout({appId:'hallmark',capabilityId:({hallmark_update_price:'hallmark.products.update_price',hallmark_update_stock:'hallmark.products.update_stock',hallmark_list_product:'hallmark.products.list_product'} as Record<string,string>)[input.name],deadlineAt:input.deadlineAt},90000)) as ToolResult;}
}
