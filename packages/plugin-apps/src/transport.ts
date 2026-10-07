import {HttpRuntimeTransport, type RuntimeTransport} from '../../app-sdk/src/index.ts';
import type {AppManifest, BridgeRequest, CapabilityDescriptor, ComponentAgentIntent, ComponentContextSnapshot, JsonValue, SessionAppBinding} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
export interface RuntimeApp extends AppManifest {providerState: string}
export interface RuntimeConnection {appId: string; connectionId: string; displayName: string; enabled: boolean}
export interface CapabilitySummary {appId: string; capabilityId: string; version: string; title: string; effect: CapabilityDescriptor['effect']; description: string}
export interface DiscoveryPage {items: CapabilitySummary[]; total: number; returned: number; nextCursor: string | null; catalogDigest: string}
export interface ModelProjection {content: string;fullResultRef?: JsonValue}
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
  view?(sessionId: string, viewId: string, signal?: AbortSignal): Promise<JsonValue>;
  viewData?(sessionId: string, viewId: string, signal?: AbortSignal): Promise<JsonValue>;
  legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal): Promise<ToolResult>;
}
/** Adds project catalogue/binding endpoints to the shared SDK transport, with no business dispatch implementation. */
export class HttpAppsHostTransport extends HttpRuntimeTransport implements AppsHostTransport {
  private async request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    const combined = AbortSignal.any([AbortSignal.timeout(90000), ...(signal ? [signal] : [])]);
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
  async componentBridge(request: BridgeRequest, signal?: AbortSignal) {return await this.request('/v1/component-bridge', request, signal) as JsonValue;}
  async componentContexts(sessionId: string,signal?: AbortSignal) {return await this.request(`/v1/component-contexts?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as {sessionId: string;snapshot: ComponentContextSnapshot|null};}
  async agentIntent(sessionId: string,requestId: string,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}?sessionId=${encodeURIComponent(sessionId)}`,undefined,signal) as ComponentAgentIntent;}
  async dispatchAgent(sessionId: string,requestId: string,requestHash: string,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}/dispatch`,{sessionId,requestHash},signal) as {dispatchGranted: boolean;intent: ComponentAgentIntent};}
  async agentReceipt(sessionId: string,requestId: string,requestHash: string,state: 'accepted'|'unknown'|'failed',receipt?: JsonValue,error?: JsonValue,signal?: AbortSignal) {return await this.request(`/v1/agent-requests/${encodeURIComponent(requestId)}/receipt`,{sessionId,requestHash,state,...(receipt===undefined?{}:{receipt}),...(error===undefined?{}:{error})},signal) as ComponentAgentIntent;}
  async view(sessionId: string, viewId: string, signal?: AbortSignal) {return await this.request(`/v1/views/${encodeURIComponent(viewId)}?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal) as JsonValue;}
  async viewData(sessionId: string, viewId: string, signal?: AbortSignal) {return await this.request(`/v1/views/${encodeURIComponent(viewId)}/data?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal) as JsonValue;}
  async legacyInvoke(input: {name: string;arguments: JsonValue;sessionId: string;invocationId: string;traceId: string;deadlineAt: string}, signal?: AbortSignal) {return await this.request('/v1/legacy-invocations', input, signal) as ToolResult;}
}
