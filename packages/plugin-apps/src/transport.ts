import {APPS_DATA_REQUEST_TIMEOUT_MS,appsInvocationTimeout,HttpRuntimeTransport, type RuntimeTransport} from '../../app-sdk/src/index.ts';
import {randomUUID} from 'node:crypto';
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
  associationOverview?(query:Record<string,string>,signal?:AbortSignal):Promise<JsonValue>;
  businessSettingsRead?(connectionId?:string,storeId?:string,signal?:AbortSignal):Promise<JsonValue>;
  businessSettingsWrite?(input:{connectionId:string;operation:string;input:JsonValue},signal?:AbortSignal):Promise<JsonValue>;
  reviewNext?(owner:ReviewOwner,signal?:AbortSignal):Promise<ReviewTicket|null>;
  reviewComplete?(ticket:ReviewTicket,completion:ReviewCompletion,signal?:AbortSignal):Promise<void>;
  /** Cheap liveness probe (`/health?shallow=1`): never waits on the business backend. */
  health?(signal?:AbortSignal):Promise<JsonValue>;
  dataHealth?(signal?:AbortSignal):Promise<JsonValue>;
  restartRuntime?(signal?:AbortSignal):Promise<void>;
  listApps(signal?: AbortSignal): Promise<RuntimeApp[]>;
  discover(options?: {appId?: string;query?: string;cursor?: string;limit?: number}, signal?: AbortSignal): Promise<DiscoveryPage>;
  listConnections(appId?: string, signal?: AbortSignal): Promise<RuntimeConnection[]>;
  sessionBindings(sessionId: string, signal?: AbortSignal): Promise<SessionAppBinding[]>;
  bind(binding: SessionAppBinding, signal?: AbortSignal): Promise<SessionAppBinding>;
  projectModelResult?(invocationId: string, signal?: AbortSignal): Promise<ModelProjection>;
  readModelResult?(input:{resultRef:string;sessionId:string;path:string;cursor?:string;limit?:number;fields?:string[];literal?:string},signal?:AbortSignal):Promise<JsonValue>;
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
/** Empty or non-JSON bodies become a typed failure that keeps the HTTP status and request id. A non-2xx status stays a server response (statusCode); a 2xx one is an uncertain read. */
function invalidResponse(httpStatus: number, requestId: string, text: string, rejected: boolean): Error {
  const message = text.length === 0 ? 'Runtime 返回了空白响应。' : 'Runtime 返回了无效 JSON 响应。';
  const details = {status: 'failed', error: {code: 'RUNTIME_INVALID_RESPONSE', message, retryPolicy: 'read_retry', details: {httpStatus, requestId, ...(text.length ? {cause: text.slice(0, 200)} : {})}}};
  return Object.assign(new SyntaxError('RUNTIME_INVALID_RESPONSE'), {code: 'RUNTIME_INVALID_RESPONSE', httpStatus, requestId, details, ...(rejected ? {statusCode: httpStatus} : {})});
}
/** Records how many attempts produced a server response, without altering the response itself. */
function withAttempts(error: unknown, attempts: number): unknown {
  const details = (error as {details?: {error?: {details?: unknown}}}).details, failure = details?.error;
  if (!failure || typeof failure !== 'object') return error;
  const inner = failure.details && typeof failure.details === 'object' && !Array.isArray(failure.details) ? failure.details : {};
  return Object.assign(error as object, {details: {...details, error: {...failure, details: {...inner, attempts}}}});
}
function describeCause(error: unknown): string {
  const cause = (error as {cause?: {code?: string; message?: string}}).cause, base = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (cause?.code || cause?.message ? `${base} (${[cause.code, cause.message].filter(Boolean).join(' ')})` : base).slice(0, 300);
}
/** Adds project catalogue/binding endpoints to the shared SDK transport, with no business dispatch implementation. */
export class HttpAppsHostTransport extends HttpRuntimeTransport implements AppsHostTransport {
  async associationOverview(query:Record<string,string>,signal?:AbortSignal):Promise<JsonValue>{return await this.request(`/v1/associations?${new URLSearchParams(query)}`,undefined,signal) as JsonValue;}
  async businessSettingsRead(connectionId?:string,storeId?:string,signal?:AbortSignal):Promise<JsonValue>{return await this.request(`/v1/business-settings?${new URLSearchParams({...connectionId?{connectionId}:{},...storeId?{storeId}:{}})}`,undefined,signal) as JsonValue;}
  async businessSettingsWrite(input:{connectionId:string;operation:string;input:JsonValue},signal?:AbortSignal):Promise<JsonValue>{return await this.request('/v1/business-settings',input,signal) as JsonValue;}
  async reviewNext(owner:ReviewOwner,signal?:AbortSignal):Promise<ReviewTicket|null>{return (await this.request('/v1/review-requests/next',owner,signal,25000) as {ticket:ReviewTicket|null}).ticket;}
  async reviewComplete(ticket:ReviewTicket,completion:ReviewCompletion,signal?:AbortSignal):Promise<void>{await this.request('/v1/review-requests/complete',{...ticket.owner,requestId:ticket.requestId,claimToken:ticket.claimToken,...completion},signal);}
  private async request(path: string, body?: unknown, signal?: AbortSignal,timeoutMs=90000): Promise<unknown> {
    const combined = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    const send=this.nativeHttp&&timeoutMs>300000?loopbackHttpFetch:this.fetcher;
    const requestId = randomUUID();
    let response: Response, text: string;
    // A network or timeout failure keeps its original shape (callers classify it); only the request id is attached.
    try {
      response = await send(new URL(path, this.url), {method: body === undefined ? 'GET' : 'POST', headers: {Authorization: `Bearer ${this.token}`, 'X-Request-Id': requestId, ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), redirect: 'error', signal: combined});
      text = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
    } catch (error) {if (error !== null && typeof error === 'object') try {Object.assign(error, {requestId});} catch {}throw error;}
    const echoed = response.headers?.get?.('x-request-id') ?? requestId;
    let value: unknown, parsed = true;
    try {value = JSON.parse(text);} catch {parsed = false;}
    // Status is checked before the body is trusted: an empty 408 from the server's own timeout is not a parse error.
    if (!response.ok) {
      if (parsed) throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'), {statusCode: response.status, requestId: echoed, details: value});
      throw invalidResponse(response.status, echoed, text, true);
    }
    if (!parsed) throw invalidResponse(response.status, echoed, text, false);
    return value;
  }
  async dataHealth(signal?:AbortSignal){return await this.request('/health',undefined,signal,10000) as JsonValue;}
  async restartRuntime(signal?:AbortSignal){await this.request('/v1/runtime/restart',{},signal,5000);}
  async health(signal?:AbortSignal){return await this.request('/health?shallow=1',undefined,signal,3000) as JsonValue;}
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
  async readModelResult(input:{resultRef:string;sessionId:string;path:string;cursor?:string;limit?:number;fields?:string[];literal?:string},signal?:AbortSignal){
    if(input.fields!==undefined&&input.literal!==undefined)throw new Error('RESULT_SELECTION_CONFLICT');
    if(input.literal!==undefined){const {resultRef,...body}=input;return await this.request(`/v1/results/${encodeURIComponent(resultRef)}/locate`,body,signal) as JsonValue;}
    if(input.fields!==undefined){const {resultRef,...body}=input;return await this.request(`/v1/results/${encodeURIComponent(resultRef)}/project`,body,signal) as JsonValue;}
    const query=new URLSearchParams({sessionId:input.sessionId,path:input.path,...(input.cursor!==undefined?{cursor:input.cursor}:{}),...(input.limit!==undefined?{limit:String(input.limit)}:{})});
    const route=`/v1/results/${encodeURIComponent(input.resultRef)}`,get=`${route}?${query}`;
    // Legal Unicode pointers expand in URLs. Leave short legacy GETs byte-identical;
    // reserve header space below Node's default 16 KiB request-header ceiling.
    if(Buffer.byteLength(new URL(get,this.url).href)<=8000)return await this.request(get,undefined,signal) as JsonValue;
    const {resultRef,...body}=input;
    try{return await this.request(`${route}/read`,body,signal) as JsonValue;}
    catch(error){
      const statusCode=(error as {statusCode?:number}).statusCode;
      if(statusCode!==undefined&&statusCode!==404&&statusCode!==405)throw error;
      throw Object.assign(new Error('RESULT_READ_POST_UNAVAILABLE: Long result POST could not be read. Older Runtime peers need POST read support; no GET retry was attempted.'),{cause:error,statusCode});
    }
  }
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
  async componentExtension(request:ComponentExtensionRequest,signal?:AbortSignal){
    const params=request.params as {method?:string}|null;
    const readOnly=request.feature==='dataTransferV1'&&(request.action==='read'||request.action==='prepare'&&['getData','readBindingPage'].includes(params?.method??''));
    for(let attempt=0;;attempt++)try{return await this.request('/v1/component-extension',request,signal,['bindingPagesV1','dataTransferV1'].includes(request.feature)?APPS_DATA_REQUEST_TIMEOUT_MS:90000) as JsonValue;}
    catch(error){
      const statusCode=(error as {statusCode?:number}).statusCode,again=readOnly&&attempt===0&&!signal?.aborted;
      if(statusCode!==undefined){
        // A server response is evidence. Only a transient or unreadable status on an idempotent read earns one more attempt.
        if(again&&(statusCode===408||statusCode===502||statusCode===503||statusCode===504||(error as {code?:string}).code==='RUNTIME_INVALID_RESPONSE'))continue;
        throw attempt>0?withAttempts(error,attempt+1):error;
      }
      if(again&&(error as Error).name!=='TimeoutError')continue;
      const code=signal?.aborted?'RUNTIME_REQUEST_CANCELLED':(error as Error).name==='TimeoutError'?'RUNTIME_REQUEST_TIMEOUT':error instanceof SyntaxError?'RUNTIME_INVALID_RESPONSE':'RUNTIME_CONNECTION_LOST';
      const message=code==='RUNTIME_REQUEST_CANCELLED'?'组件请求已取消。':code==='RUNTIME_REQUEST_TIMEOUT'?'组件请求超时，不能据此认定 Runtime 进程已退出。':code==='RUNTIME_INVALID_RESPONSE'?'Runtime 返回了空白或无效 JSON 响应。':'与 Runtime 的连接中断，进程是否退出尚未确认。';
      throw Object.assign(new Error(code),{cause:error,statusCode:code==='RUNTIME_REQUEST_TIMEOUT'?504:502,details:{status:'failed',error:{code,message,retryPolicy:readOnly&&!signal?.aborted?'read_retry':'inspect_only',details:{requestId:request.requestId,runtimeRequestId:(error as {requestId?:string}).requestId,feature:request.feature,action:request.action,attempts:attempt+1,cause:describeCause(error)}}}});
    }
  }
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
