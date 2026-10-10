import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson, compileSchema, validateResult} from '../../app-contracts/src/index.ts';
import type {BridgeRequest, CapabilityDescriptor, CapabilityResult, ComponentAgentIntent, FailureInfo, InvocationRequest, InvocationSource, JsonSchema, JsonValue, SessionAppBinding, HostProjectionState} from '../../app-contracts/src/index.ts';
import {APPS_BUSINESS_REQUEST_TIMEOUT_MS,appsInvocationTimeout,isBusinessSubmission,APPS_DATA_REQUEST_TIMEOUT_MS,recoverInvocationResult,runtimeHttpError} from '../../app-sdk/src/index.ts';
import {hostFeatureModes, requireHostCapability, type HostCapabilityMatrix, type NativeSessionAdapterMode} from '../../dsh-compat/src/index.ts';
import type {AppsHostTransport, RuntimeApp, ModelProjection} from './transport.ts';
import {nativeInputReceipt} from '../../dsh-compat/src/native-receipt.ts';
import {parseNativeReference,type NativeBindingRequest} from '../client/native-apps.ts';
import type {ComponentExtensionRequest} from '../../component-runtime/src/host.ts';
import {authoringInstructions,type AppsAuthoringGuidance} from './authoring-guidance.ts';
import {withIndependentReviewPump,type ReviewSubagents,type ReviewAttachments} from './review-agent.ts';
import {componentReviewInvocationId,type ReviewOwner} from '../../service/src/review-bridge.ts';
export * from './transport.ts';
export const name = 'dsh-plugin-apps';
export const inject = ['tools', 'agents', 'connection', 'systemPrompt'];
export const UI_PATH = '/api/dsh-apps';
export interface AgentRef {id: string;session?: {id: string};options?:{model?:string}}
export interface NativePromptAssembly {contexts: {name: string;text: string}[];[key:string]: unknown}
export interface NativeAssembleContext {agent?: AgentRef;scope?: object;signal?: AbortSignal}
export interface NativeSessionController {
  resolveAgent(sessionId: string): Promise<{agent: AgentRef}|{error: unknown}>;
  prompt(request: {requestId: string;sessionId: string;mode: 'queue';content: {type: 'text';text: string}[]},signal: AbortSignal): Promise<{accepted: true}>;
  inspect(sessionId: string,signal?: AbortSignal): Promise<{events: readonly unknown[]}>;
}
export interface NativeSessions {get(id:string):{id:string}|undefined;flush?(session:{id:string}):Promise<boolean>}
export interface NativeExecution {agent?: AgentRef;signal: AbortSignal;name?: string;callId?: string}
export interface NativeGatewayTool {name: string;description: string;parameters: JsonSchema;output: {schema: JsonSchema;render(args: unknown,value: unknown): {type: 'text';text: string}[];presentationMeta(args: unknown,value: unknown): Record<string,unknown>};execute(args: unknown,execution: NativeExecution): Promise<unknown>;timeoutMs: number;isConcurrencySafe(args: unknown): boolean}
export interface AppsPluginContext {
  tools: {register(tool: NativeGatewayTool): () => void};
  agents: {get(id: string): AgentRef | undefined};
  sessions?: NativeSessions;
  sessionController?: NativeSessionController;
  subagents?:ReviewSubagents;
  attachments?:ReviewAttachments;
  get?(name: 'sessionController'|'sessions'|'subagents'|'attachments'): unknown;
  sessionQuery?: {readTitleSnapshot(id: string,signal?: AbortSignal): Promise<{session: {id: string}}>};
  connection?: {fetch: {register(route: {path: string;methods: readonly ('GET'|'POST')[];requestBody: 'buffered';fetch(request: Request): Promise<Response>}): () => Promise<void>}};
  systemPrompt?: {context(contribution: {name: string;order: number;text(context: {agent?: AgentRef;scope?: object;signal?: AbortSignal}): string}): () => void};
  on?(event:'system-prompt/assemble',listener:(assembly:NativePromptAssembly,context:NativeAssembleContext,next:()=>Promise<NativePromptAssembly>)=>Promise<NativePromptAssembly>):()=>void;
  on?(event:'internal/service',listener:(name:string,value:unknown)=>void):()=>void;
  effect?(factory: () => () => void): unknown;
}
const text: JsonSchema = {type: 'string', minLength: 1, maxLength: 4000};
const schema = (properties: Record<string,JsonSchema>, required: string[] = []): JsonSchema => ({type: 'object', properties, required, additionalProperties: false});
const gatewaySchemas: Record<string, JsonSchema> = {
  apps_list: schema({appId: text, query: text, cursor: text, limit: {type: 'integer', minimum: 1, maximum: 100}}),
  apps_describe: schema({capabilityId: text, version: text}, ['capabilityId']),
  apps_invoke: schema({appId: text, connectionId: text, capabilityId: text, capabilityVersion: text, input: {}, idempotencyKey: text, expectedResourceRevision: text, invocationId: text, traceId: text, deadlineAt: text}, ['appId', 'capabilityId', 'capabilityVersion', 'input']),
  apps_inspect: {...schema({operationId:text,resultRef:text,path:{type:'string',maxLength:4000},cursor:{type:'string',pattern:'^[0-9]+$'},limit:{type:'integer',minimum:1,maximum:200}}),oneOf:[{required:['operationId'],not:{anyOf:[{required:['resultRef']},{required:['path']},{required:['cursor']},{required:['limit']}]}},{required:['resultRef'],not:{required:['operationId']}}]},
};
const gatewayDescriptions:Record<string,string>={apps_list:'发现应用与能力摘要；按需apps_describe获取精确Schema，当前采用固定发现网关。',apps_describe:'读取Runtime唯一目录中的精确能力说明、输入输出与版本。',apps_invoke:'用明确应用/连接/能力版本调用Runtime统一实现；unknown先查操作，不自动重新写入。',apps_inspect:'只读回查已有操作，保留原操作身份，不重发业务修改。'};
const businessUiOperations=new Set(['create','revise','get','list','submit','inspect','restore']);
const fail = (code: string,message: string,invocationId = 'host',traceId = 'host',details?: JsonValue): CapabilityResult => ({invocationId, traceId, status: 'failed', error: {code, message, retryPolicy: 'never',...(details === undefined ? {} : {details})}});
function jsonResponse(value: unknown, status = 200) {return new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});}
/** Bound observation without claiming that an admitted Native operation was cancelled. */
function observeWithin<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
  return new Promise<T>((resolve,reject)=>{const abort=()=>reject(signal.reason);if(signal.aborted){reject(signal.reason);promise.catch(()=>{});return;}signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}

/** P1 project facade. The Runtime owns the catalogue, session state and all execution. */
export class AppsHost {
  private disposers: (() => unknown)[] = [];
  private attachments = new Map<string, {owners: Set<object>; state: HostProjectionState}>();
  private apps: RuntimeApp[] = [];
  private closed = false;
  private started = false;
  private lifetime = new AbortController();
  readonly modes;
  readonly ctx: AppsPluginContext;
  readonly transport: AppsHostTransport;
  readonly capabilities: HostCapabilityMatrix;
  readonly nativeSessionAdapter: NativeSessionAdapterMode;
  private nativeController?: NativeSessionController;
  private nativeSessions?: NativeSessions;
  private nativeReady: boolean;
  private nativeHookInstalled=false;
  private catalogDigest='';
  private descriptions=new Map<string,CapabilityDescriptor>();
  private modelProjections=new Map<string,ModelProjection>();
  private routedInvocations=false;
  private independentReviews=false;
  readonly prepareView?: (view: JsonValue, sessionId: string, signal?: AbortSignal) => Promise<void>;
  readonly authoringGuidance?:AppsAuthoringGuidance;
  constructor(ctx: AppsPluginContext, transport: AppsHostTransport, capabilities: HostCapabilityMatrix = {hostVersion: null, capabilities: {}},options: {prepareView?: (view: JsonValue, sessionId: string, signal?: AbortSignal) => Promise<void>;nativeSessionAdapter?: NativeSessionAdapterMode;authoringGuidance?:AppsAuthoringGuidance} = {}) {
    this.ctx = ctx;this.transport = transport;this.capabilities = capabilities;this.prepareView=options.prepareView;this.nativeSessionAdapter=options.nativeSessionAdapter??'disabled';
    this.authoringGuidance=options.authoringGuidance?structuredClone(options.authoringGuidance):undefined;
    this.nativeReady=false;this.modes={...hostFeatureModes(capabilities),requestAgent:false,updateContext:false};this.refreshNativeAdapter();
  }
  /** Cordis strict get exposes ACTIVE providers only; an initial missing value is never cached forever. */
  private refreshNativeAdapter() {
    const ctx=this.ctx,transport=this.transport;
    try {this.nativeController=(typeof ctx.get==='function'?ctx.get('sessionController'):ctx.sessionController) as NativeSessionController|undefined;} catch {this.nativeController=undefined;}
    try {this.nativeSessions=(typeof ctx.get==='function'?ctx.get('sessions'):ctx.sessions) as NativeSessions|undefined;} catch {this.nativeSessions=undefined;}
    this.nativeReady=this.nativeSessionAdapter==='dsh-0.2.0-rc.2'&&typeof ctx.systemPrompt?.context==='function'&&typeof ctx.on==='function'&&typeof this.nativeSessions?.flush==='function'&&typeof this.nativeController?.resolveAgent==='function'&&typeof this.nativeController?.prompt==='function'&&typeof this.nativeController?.inspect==='function'&&typeof transport.componentContexts==='function'&&typeof transport.componentBridge==='function'&&typeof transport.dispatchAgent==='function'&&typeof transport.agentReceipt==='function'&&typeof transport.agentIntent==='function';
    if(this.started&&!this.closed&&this.nativeReady&&!this.nativeHookInstalled)this.installNativeContextHook();
    this.modes.requestAgent=this.nativeReady&&!this.closed;this.modes.updateContext=this.nativeReady&&!this.closed;
  }
  private installNativeContextHook() {
    this.disposers.push(this.ctx.on!('system-prompt/assemble',async(_assembly,context,next)=>{
      const assembled=await next(),agent=(context.agent??context.scope) as AgentRef|undefined,sessionId=this.trusted(agent);
      if(!sessionId||context.scope&&context.scope!==agent)return assembled;
      this.refreshNativeAdapter();
      if(!this.nativeReady||this.closed)throw new Error('NATIVE_ADAPTER_NOT_READY');
      const signal=this.combined(context.signal);signal.throwIfAborted();
      const projection=await this.transport.componentContexts!(sessionId,signal);signal.throwIfAborted();
      if(projection.sessionId!==sessionId||projection.snapshot&&projection.snapshot.sessionId!==sessionId)throw new Error('CONTEXT_NOT_OWNED');
      const contexts=assembled.contexts.filter(entry=>entry.name!=='dsh-apps-component-context');
      if(projection.snapshot){
        const snapshot=projection.snapshot;
        if(!Number.isSafeInteger(snapshot.contextRevision)||snapshot.contextRevision<1||typeof snapshot.snapshotId!=='string'||!Array.isArray(snapshot.bindingEvidence)||!Array.isArray(snapshot.selections))throw new Error('INVALID_CONTEXT_SNAPSHOT');
        const content=canonicalJson({kind:'dsh-apps-component-context',sessionId,snapshot});
        if(Buffer.byteLength(content)>8192)throw new Error('CONTEXT_BUDGET_EXCEEDED');
        contexts.push({name:'dsh-apps-component-context',text:content});
      }
      return {...assembled,contexts};
    }));
    this.nativeHookInstalled=true;
  }
  private combined(signal?: AbortSignal) {return AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]);}
  private trusted(agent?: AgentRef) {return agent && /^[-a-zA-Z0-9_]{1,160}$/.test(agent.id) && this.ctx.agents.get(agent.id) === agent ? agent.id : undefined;}
  private async knownSession(sessionId: string, signal?: AbortSignal) {
    if (!/^[-a-zA-Z0-9_]{1,160}$/.test(sessionId)) return false;
    if (this.ctx.agents.get(sessionId) || this.nativeSessions?.get(sessionId)) return true;
    try {return (await this.ctx.sessionQuery?.readTitleSnapshot(sessionId, signal))?.session.id === sessionId;} catch {return false;}
  }
  private async handshake(signal?:AbortSignal) {
    const identity = await this.transport.identity(signal);
    if (identity.transportMajor !== 1 || identity.catalogSchemaVersion !== 1) throw Object.assign(new Error('INCOMPATIBLE_PROTOCOL'),{details:{expected:{transportMajor:1,catalogSchemaVersion:1},actual:{transportMajor:identity.transportMajor,catalogSchemaVersion:identity.catalogSchemaVersion}}});
    if(identity.catalogDigest!==this.catalogDigest){this.descriptions.clear();this.catalogDigest=identity.catalogDigest;}
    this.routedInvocations=Boolean(this.transport.invokeRouted&&((identity as {hostFeatures?:string[]}).hostFeatures??[]).includes('routedInvocationsV1'));
    this.independentReviews=((identity as {hostFeatures?:string[]}).hostFeatures??[]).includes('independentReviewBridgeV1');
    return identity;
  }
  private async describe(id:string,version?:string):Promise<CapabilityDescriptor|undefined> {
    const key=version?JSON.stringify([id,version]):undefined,cached=key?this.descriptions.get(key):undefined;
    if(cached)return structuredClone(cached);
    const digest=this.catalogDigest,descriptor=await this.transport.describe(id,version);
    if(descriptor&&digest===this.catalogDigest){if(this.descriptions.size>=256)this.descriptions.delete(this.descriptions.keys().next().value!);this.descriptions.set(JSON.stringify([descriptor.capabilityId,descriptor.version]),structuredClone(descriptor));}
    return descriptor;
  }
  private concurrencySafe(input:unknown):boolean {
    if(!input||typeof input!=='object'||Array.isArray(input))return false;
    const value=input as Record<string,unknown>,descriptor=this.descriptions.get(JSON.stringify([value.capabilityId,value.capabilityVersion]));
    return !!descriptor&&value.appId===descriptor.capabilityId.split('.')[0]&&!descriptor.capabilityId.startsWith('apps.')&&['query','compute'].includes(descriptor.effect)&&descriptor.execution.concurrency==='declared_safe';
  }
  private rememberProjection(invocationId:string,projection:ModelProjection):void {if(this.modelProjections.size>=64)this.modelProjections.delete(this.modelProjections.keys().next().value!);this.modelProjections.set(invocationId,projection);}
  async start() {
    if (this.started || this.closed) throw new Error('INVALID_HOST_LIFECYCLE');
    await this.handshake();this.apps = await this.transport.listApps(this.lifetime.signal);
    if (!Array.isArray(this.apps)) throw new Error('INVALID_RUNTIME_DIRECTORY');
    try {
      for (const [name, parameters] of Object.entries(gatewaySchemas)) {
        const validate = compileSchema(parameters);
        this.disposers.push(this.ctx.tools.register({name, description:gatewayDescriptions[name], parameters, output: {schema: {}, render: (_args,value) => [{type: 'text', text: this.renderModel(value)}],presentationMeta: (args,value)=>this.presentationMeta(args,value)}, timeoutMs: name==='apps_invoke'?APPS_BUSINESS_REQUEST_TIMEOUT_MS:90000, isConcurrencySafe: args => name !== 'apps_invoke'||this.concurrencySafe(args), execute: async (args, execution) => {
          const errors = validate(args);if (errors.length) return fail('INVALID_INPUT', errors.join('; '));
          const sessionId = this.trusted(execution.agent);if (!sessionId) return fail('INVALID_SESSION', '需要当前原生会话身份。');
          let runtimeResult=false;
          const value = await this.call(name, args as Record<string,JsonValue>, sessionId, this.combined(execution.signal), execution.callId,()=>{runtimeResult=true;},execution.agent);
          if (!runtimeResult || !value || typeof value !== 'object' || !('invocationId' in value)) return value;
          let modelProjection: ModelProjection;
          try {const cached=this.modelProjections.get(String(value.invocationId));this.modelProjections.delete(String(value.invocationId));if (!cached&&!this.transport.projectModelResult) throw new Error('MODEL_RESULT_PROJECTION_UNAVAILABLE');modelProjection = cached??await this.transport.projectModelResult!(String(value.invocationId),execution.signal);if (typeof modelProjection.content !== 'string' || Buffer.byteLength(modelProjection.content) > 16384) throw new Error('MODEL_RESULT_BUDGET_EXCEEDED');}
          catch {modelProjection = {content: canonicalJson({status: 'failed', error: {code: 'RESULT_SPILL_FAILED', message: '模型结果投影不可用。请读取原invocation记录并用较小分页查询；不得重发变更。'}, invocationId: String(value.invocationId)})};}
          if((args as {capabilityId?:string}).capabilityId==='apps.authoring.begin'&&this.authoringGuidance&&(value as CapabilityResult).status==='ok'){
            let projected:JsonValue;try{projected=JSON.parse(modelProjection.content) as JsonValue;}catch{projected={invocationId:String(value.invocationId)};}
            const guidance=authoringInstructions(this.authoringGuidance,sessionId),full=canonicalJson({result:projected,authoringGuidance:guidance});
            const content=Buffer.byteLength(full)<=16384?full:canonicalJson({invocationId:String(value.invocationId),resultRef:modelProjection.fullResultRef??null,authoringGuidance:guidance});
            if(Buffer.byteLength(content)<=16384)modelProjection={...modelProjection,content};
          }
          return {result: value, modelProjection};
        }}));
      }
      if (this.ctx.connection) this.disposers.push(this.ctx.connection.fetch.register({path: UI_PATH, methods: ['GET', 'POST'], requestBody: 'buffered', fetch: request => this.ui(request)}));
      if (this.ctx.systemPrompt) this.disposers.push(this.ctx.systemPrompt.context({name: 'dsh-apps-summary', order: 510, text: context => {
        const agent = (context.agent ?? context.scope) as AgentRef | undefined;
        const sessionId=this.trusted(agent);return sessionId && (!context.scope || context.scope === agent) ? this.appSummary(sessionId) : '';
      }}));
      this.started = true;
      if(this.nativeSessionAdapter==='dsh-0.2.0-rc.2'&&typeof this.ctx.on==='function')this.disposers.push(this.ctx.on('internal/service',name=>{if(name==='sessionController'||name==='sessions')this.refreshNativeAdapter();}));
      this.refreshNativeAdapter();
    } catch (error) {await this.dispose();throw error;}
  }
  private renderModel(value: unknown): string {
    if (value && typeof value === 'object' && 'modelProjection' in value) {
      const projection = value.modelProjection as ModelProjection;
      if (typeof projection.content === 'string' && Buffer.byteLength(projection.content) <= 16384) return projection.content;
    }
    const content = canonicalJson(value);
    return Buffer.byteLength(content) <= 16384 ? content : canonicalJson({status: 'failed', error: {code: 'RESULT_SPILL_FAILED', message: '此发现/说明结果超过预算。请限制能力分页或缩小工作集。'}});
  }
  private appSummary(_sessionId?:string) {return `Apps采用固定发现网关。应用摘要：${JSON.stringify(this.apps.map(app=>({appId:app.appId,displayName:app.displayName,runtimeState:app.providerState})))}。先apps_list/describe按需发现，调用需明确连接和能力版本。变更需明确保存和幂等身份，unknown先inspect原操作。蓝白简洁、易懂中文；数据按店铺和权限隔离，缺失不填0，试算不写平台。先显示上次成功完整快照，15分钟有效期，到期后台刷新，临时失败保留旧快照和原时间。只分析数据时直接读取，无需创作组件；需要制作组件时describe apps.authoring.begin取得完整体验规则、路径和创作指引。`;}
  private presentationMeta(args: unknown,value: unknown): Record<string,unknown> {
    const input=args as {appId?:string;capabilityId?:string}|null;if(input?.appId!=='apps'||!['apps.presentation.render_view','apps.presentation.update_view','apps.presentation.open_component','apps.presentation.open_source_component','apps.authoring.begin','apps.authoring.inspect','apps.authoring.publish'].includes(input.capabilityId??''))return {};
    const result=(value&&typeof value==='object'&&'result' in value?value.result:value) as CapabilityResult|undefined;if(result?.status!=='ok'||!('data' in result)||!result.data||typeof result.data!=='object'||Array.isArray(result.data))return {};
    const payload=result.data,view=['apps.authoring.begin','apps.authoring.inspect'].includes(input.capabilityId!)?payload.view:payload;if(!view||typeof view!=='object'||Array.isArray(view)||typeof view.viewId!=='string'||typeof view.ownerSessionId!=='string')return {};const publication=input.capabilityId==='apps.authoring.publish'?view:input.capabilityId==='apps.authoring.inspect'?payload.publication:undefined,pub=publication&&typeof publication==='object'&&!Array.isArray(publication)&&publication.viewId===view.viewId&&publication.ownerSessionId===view.ownerSessionId&&typeof publication.publicationId==='string'?publication:undefined,source=pub?.source??view.source;
    return {apps:{viewId:view.viewId,sessionId:view.ownerSessionId,...(source&&typeof source==='object'&&!Array.isArray(source)&&typeof source.buildId==='string'?{buildId:source.buildId}:{}),...(pub?{publicationId:pub.publicationId,...(Number.isSafeInteger(pub.committedViewRevision)?{viewRevision:pub.committedViewRevision}:{})}:Number.isSafeInteger(view.viewRevision)?{viewRevision:view.viewRevision}:{})}};
  }
  /** Called only by an application native projection. Disposing never stops its Provider or deletes assets. */
  attachApp(appId: string): () => void {
    if (!this.started || this.closed) throw new Error('APPS_HOST_NOT_READY');
    if (!this.apps.some(app => app.appId === appId)) throw new Error('APP_NOT_FOUND');
    const owner = {};
    const attachment = this.attachments.get(appId) ?? {owners: new Set<object>(), state: 'attaching' as HostProjectionState};
    attachment.owners.add(owner);attachment.state = 'attached';this.attachments.set(appId, attachment);
    let disposed = false;
    return () => {if (disposed) return;disposed = true;attachment.owners.delete(owner);if (!attachment.owners.size) {attachment.state = 'detached';this.attachments.delete(appId);}};
  }
  async directory(signal?: AbortSignal,handshaken=false) {
    if(!handshaken)await this.handshake(signal);this.apps = await this.transport.listApps(signal);
    return {apps: this.apps.map(app => ({...app, runtimeState: app.providerState, hostProjectionState: this.attachments.get(app.appId)?.state ?? 'detached'})), discoveryMode: this.modes.discovery};
  }
  async reviewPump<T>(owner:ReviewOwner,action:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal,parent?:AgentRef):Promise<T> {
    if(!this.independentReviews)return action(this.combined(signal));
    let subagents:ReviewSubagents|undefined,attachments:ReviewAttachments|undefined;
    try{subagents=(typeof this.ctx.get==='function'?this.ctx.get('subagents'):this.ctx.subagents) as ReviewSubagents|undefined;attachments=(typeof this.ctx.get==='function'?this.ctx.get('attachments'):this.ctx.attachments) as ReviewAttachments|undefined;}catch{}
    if(!subagents||!owner.sessionId)return action(this.combined(signal));
    if(!parent)parent=this.ctx.agents.get(owner.sessionId);
    if(!parent){this.refreshNativeAdapter();const found=await this.nativeController?.resolveAgent(owner.sessionId);if(found&&'agent'in found)parent=found.agent;}
    if(!parent||this.trusted(parent)!==owner.sessionId)return action(this.combined(signal));
    return withIndependentReviewPump(this.transport,owner,parent,{subagents,attachments},action,this.combined(signal));
  }
  async call(name: string, input: Record<string,JsonValue>, sessionId: string, signal?: AbortSignal, nativeCallId?: string, onRuntimeResult?: () => void,parent?:AgentRef,invocationSource?:InvocationSource): Promise<unknown> {
    if (this.closed) return fail('APPS_HOST_CLOSED', 'Apps Host 已卸载。');
    const invocationId=typeof input.invocationId==='string'?input.invocationId:name==='apps_invoke'?randomUUID():'host',traceId=typeof input.traceId==='string'?input.traceId:name==='apps_invoke'?randomUUID():'host';
    let submitted:InvocationRequest|undefined,descriptor:CapabilityDescriptor|undefined;
    try {
      await this.handshake(signal);
      if (name === 'apps_list') return {status: 'ok', ...(await this.directory(signal,true)), capabilities: await this.transport.discover(input as {appId?: string;query?: string;cursor?: string;limit?: number}, signal)};
      if (name === 'apps_describe') {const descriptor = await this.describe(String(input.capabilityId), typeof input.version === 'string' ? input.version : undefined);return descriptor ? {status: 'ok', descriptor,...(descriptor.capabilityId==='apps.authoring.begin'&&this.authoringGuidance?{authoringGuidance:authoringInstructions(this.authoringGuidance,sessionId)}:{})} : fail('CAPABILITY_NOT_FOUND', '精确能力未登记。');}
      if (name === 'apps_inspect') {
        if(typeof input.resultRef==='string') {
          if(!this.transport.readModelResult)return fail('RESULT_READER_UNAVAILABLE','当前 Runtime 不支持结果续读。');
          return await this.transport.readModelResult({resultRef:input.resultRef,sessionId,path:typeof input.path==='string'?input.path:'',...(typeof input.cursor==='string'?{cursor:input.cursor}:{}),...(typeof input.limit==='number'?{limit:input.limit}:{})},signal);
        }
        const result=await this.transport.inspect(String(input.operationId), signal);onRuntimeResult?.();return result;
      }
      if (name !== 'apps_invoke') return fail('CAPABILITY_NOT_FOUND', '网关未登记。');
      const appId = String(input.appId);
      if (!this.attachments.has(appId)) return fail('HOST_PROJECTION_DETACHED', '此应用的DSH原生投影未挂载。', invocationId, traceId);
      const capabilityId=String(input.capabilityId),capabilityVersion=String(input.capabilityVersion);
      descriptor = await this.describe(capabilityId,capabilityVersion);
      if (!descriptor){
        const registeredVersion=(await this.transport.describe(capabilityId))?.version??null;
        return fail('CAPABILITY_NOT_FOUND',`精确能力版本未登记（请求 ${capabilityVersion}；当前 ${registeredVersion??'未登记'}）。`,invocationId,traceId,{expected:{appId,capabilityId,capabilityVersion},actual:{capabilityVersion:registeredVersion}});
      }
      const fastRoute=this.routedInvocations&&appId!=='apps'&&typeof input.connectionId==='string'&&(!invocationSource||invocationSource.kind==='agent');
      const [connections, bindings] = fastRoute?[[],[]]:await Promise.all([this.transport.listConnections(appId,signal), this.transport.sessionBindings(sessionId,signal)]);
      // Shared presentation is an internal Host service, like the existing
      // presentation-actions route. This never enables business connections.
      if(appId==='apps'&&/^apps\.(presentation|authoring)\./.test(descriptor.capabilityId)&&(input.connectionId===undefined||input.connectionId==='presentation')&&connections.some(row=>row.connectionId==='presentation'&&row.enabled)&&!bindings.some(binding=>binding.appId==='apps'&&binding.connectionId==='presentation'&&binding.enabled)){
        bindings.push(await this.transport.bind({sessionId,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()},signal));
      }
      const candidates = connections.filter(row => row.enabled && bindings.some(binding => binding.appId === appId && binding.connectionId === row.connectionId && binding.enabled));
      const matches = typeof input.connectionId === 'string' ? candidates.filter(row => row.connectionId === input.connectionId) : candidates;
      if (!fastRoute&&matches.length !== 1) return {invocationId, traceId, status: 'needs_clarification', missing: ['connectionId'], candidates: candidates.map(row => ({appId, connectionId: row.connectionId, displayName: row.displayName})), question: '请明确一个在当前会话启用的connectionId。'};
      if(signal?.aborted)return {invocationId,traceId,status:'cancelled',error:{code:'CANCELLED_BEFORE_DISPATCH',message:'Capability invocation was not submitted.',retryPolicy:'never'}};
      submitted={protocolVersion: '1.0', invocationId, traceId, appId, connectionId: fastRoute?String(input.connectionId):matches[0].connectionId, capabilityId: descriptor.capabilityId, capabilityVersion: descriptor.version, input: input.input, source: invocationSource??{kind: 'agent', sessionId, nativeCallId: nativeCallId ?? invocationId}, deadlineAt: typeof input.deadlineAt === 'string' ? input.deadlineAt : new Date(Date.now() + Math.min(appsInvocationTimeout({appId,capabilityId}), descriptor.execution.timeoutMs)).toISOString(), ...(typeof input.idempotencyKey === 'string' ? {idempotencyKey: input.idempotencyKey} : {}), ...(typeof input.expectedResourceRevision === 'string' ? {expectedResourceRevision: input.expectedResourceRevision} : {})};
      const dispatch=async(dispatchSignal:AbortSignal)=>{const routed=fastRoute?await this.transport.invokeRouted!(submitted!,dispatchSignal):undefined;if(fastRoute&&(!routed||!routed.result))throw new Error('INVALID_ROUTED_RESPONSE');return {routed,result:fastRoute?routed!.result:await this.transport.invoke(submitted!,dispatchSignal)};};
      const {routed,result}=appId==='hallmark'&&(descriptor.effect==='mutation'||/\.(?:plan|listing\.draft)\.(?:review|execute|submit)$/.test(capabilityId))?await this.reviewPump({invocationId,sessionId},dispatch,signal,parent):await dispatch(this.combined(signal));
      if(routed?.result.status==='needs_clarification'&&routed.result.invocationId===invocationId&&routed.result.traceId===traceId)return routed.result;
      onRuntimeResult?.();
      const identityMatches=result?.invocationId===invocationId&&result?.traceId===traceId;
      const errors = [...validateResult(result, descriptor.outputSchema),...(identityMatches?[]:['$.invocationId/traceId: response does not identify the original invocation'])];
      if(!errors.length){if(routed?.modelProjection)this.rememberProjection(invocationId,routed.modelProjection);return result;}
      if(descriptor.effect==='mutation'){
        const error:FailureInfo={code:'OUTPUT_SCHEMA_INVALID',message:errors.join('; '),retryPolicy:'inspect_only',details:{invocationId,doNotResubmitMutation:true}};
        const operation=result?.operation;
        const failed:CapabilityResult=identityMatches&&operation&&typeof operation.operationId==='string'&&operation.operationId?{invocationId,traceId,status:'unknown',operation:{operationId:operation.operationId,state:'unknown'},error}:{invocationId,traceId,status:'unavailable',error};
        this.rememberProjection(invocationId,{content:canonicalJson(failed)});return failed;
      }
      const failed=fail('OUTPUT_SCHEMA_INVALID',errors.join('; '),invocationId,traceId);this.rememberProjection(invocationId,{content:canonicalJson(failed)});return failed;
    } catch (error) {
      if(error instanceof Error&&error.message==='INCOMPATIBLE_PROTOCOL')return fail('INCOMPATIBLE_PROTOCOL',error.message,invocationId,traceId,(error as {details?:JsonValue}).details);
      const rejected=runtimeHttpError(error,{invocationId,traceId});if(rejected)return rejected;
      if(submitted&&descriptor?.effect==='mutation'){
        try{const recovered=await recoverInvocationResult(this.transport,submitted,signal);if(recovered&&!validateResult(recovered,descriptor.outputSchema).length){onRuntimeResult?.();return recovered;}}catch{/* Only an original read is allowed; never repeat invoke. */}
      }
      const uncertainMutation=!!submitted&&descriptor?.effect==='mutation';
      return {invocationId,traceId,status:'unavailable',error:{code:'RUNTIME_UNAVAILABLE',message:error instanceof Error?error.message:'Runtime unavailable',retryPolicy:uncertainMutation?'inspect_only':'read_retry',details:{invocationId,doNotResubmitMutation:uncertainMutation,submitted:!!submitted}}};
    }
  }
  async bind(sessionId: string, appId: string, connectionId: string, enabled: boolean, signal?: AbortSignal) {
    if (!await this.knownSession(sessionId, signal)) return fail('INVALID_SESSION', '没有此本机会话。');
    await this.handshake();
    return this.transport.bind({sessionId, appId, connectionId, enabled, boundAt: new Date().toISOString()}, signal);
  }
  private async businessOperations(value:Record<string,unknown>,signal:AbortSignal):Promise<Response> {
    if(Object.keys(value).some(key=>!['action','sessionId','connectionId','operation','input','requestId'].includes(key))
      ||typeof value.sessionId!=='string'||typeof value.connectionId!=='string'||!value.connectionId||typeof value.operation!=='string'
      ||!businessUiOperations.has(value.operation)&&value.operation!=='request'||typeof value.requestId!=='string'||!/^[-a-zA-Z0-9_.:]{1,160}$/.test(value.requestId)
      ||!value.input||typeof value.input!=='object'||Array.isArray(value.input))return jsonResponse(fail('INVALID_INPUT','经营操作参数无效。'),400);
    const {sessionId,connectionId,operation,requestId}=value;
    if(!await this.knownSession(sessionId,signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
    const bindings=await this.transport.sessionBindings(sessionId,signal);
    if(!bindings.some(binding=>binding.appId==='hallmark'&&binding.connectionId===connectionId&&binding.enabled))return jsonResponse(fail('APP_NOT_ACTIVE','请先在当前聊天启用此经营连接。'),409);
    if(operation==='request'){
      const input=value.input as Record<string,unknown>;
      if(Object.keys(input).some(key=>key!=='requestId')||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_.:]{1,160}$/.test(input.requestId))return jsonResponse(fail('INVALID_INPUT','原请求编号无效。'),400);
      if(!this.transport.getInvocation)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 未提供原请求查询。'),503);
      const record=await this.transport.getInvocation(input.requestId,signal);if(!record)return jsonResponse({settled:false});
      const original=record.request;
      if(record.invocationId!==input.requestId||!original||original.invocationId!==input.requestId||original.appId!=='hallmark'||original.connectionId!==connectionId||original.source.kind!=='script'||original.source.sessionId!==sessionId||original.source.runId!==`business-ui:${input.requestId}`||!businessUiOperations.has(original.source.stepKey)||original.capabilityId!==`hallmark.plan.${original.source.stepKey}`||original.capabilityVersion!=='1.0.0')return jsonResponse(fail('INVALID_SESSION','原请求不属于此经营操作区。'),400);
      const result=record.result;
      if(!result)return jsonResponse({settled:false});
      if(result.status==='ok'||result.status==='partial')return jsonResponse({settled:true,value:result.data});
      if(result.status==='pending'||result.status==='unknown'||result.status==='unavailable')return jsonResponse({settled:false,...(result.operation?{operationId:result.operation.operationId}:{})});
      return jsonResponse({settled:true,error:'error'in result?{code:result.error.code,message:result.error.message}:{code:'BUSINESS_INPUT_REQUIRED',message:result.question}});
    }
    // This fixed Host script represents an explicit UI action; it does not impersonate a model tool call.
    const result=await this.call('apps_invoke',{appId:'hallmark',connectionId,capabilityId:`hallmark.plan.${operation}`,capabilityVersion:'1.0.0',input:value.input as JsonValue,invocationId:requestId,traceId:requestId,...(['submit','restore'].includes(operation)?{idempotencyKey:requestId}:{})},sessionId,signal,undefined,undefined,undefined,{kind:'script',sessionId,runId:`business-ui:${requestId}`,stepKey:operation}) as CapabilityResult;
    if(['create','revise','submit','restore'].includes(operation)&&result.status==='unavailable')return jsonResponse({...result,error:{...result.error,retryPolicy:'inspect_only',details:{requestId,doNotResubmitMutation:true}}});
    return jsonResponse(result);
  }
  private async prepareWorkbench(sessionId:string,appId:string,params:unknown,signal?:AbortSignal) {
    if(!params||typeof params!=='object'||Array.isArray(params)||Object.keys(params).some(key=>key!=='connectionIds'))return fail('INVALID_INPUT','请提供明确选择的 connectionIds。');
    const connectionIds=(params as {connectionIds?:unknown}).connectionIds;
    if(!Array.isArray(connectionIds)||connectionIds.some(id=>typeof id!=='string'||!id.trim())||new Set(connectionIds).size!==connectionIds.length)return fail('INVALID_INPUT','connectionIds 必须是明确且不重复的连接编号。');
    const [business,shared]=await Promise.all([this.transport.listConnections(appId,signal),this.transport.listConnections('apps',signal)]);
    if(connectionIds.some(id=>!business.some(connection=>connection.appId===appId&&connection.connectionId===id&&connection.enabled)))return fail('CONNECTION_NOT_FOUND','所选数据连接不存在或尚未启用。');
    if(!shared.some(connection=>connection.appId==='apps'&&connection.connectionId==='presentation'&&connection.enabled))return fail('PRESENTATION_UNAVAILABLE','共享组件服务尚未启用。');
    // Validate the complete selection before enabling any binding. Use the same
    // authenticated Runtime endpoint as the ordinary application bind action.
    for(const connectionId of connectionIds)await this.transport.bind({sessionId,appId,connectionId,enabled:true,boundAt:new Date().toISOString()},signal);
    await this.transport.bind({sessionId,appId:'apps',connectionId:'presentation',enabled:true,boundAt:new Date().toISOString()},signal);
    return {status:'ok',sessionId,appId,connectionIds,presentationReady:true};
  }
  requestAgent() {return requireHostCapability(this.capabilities, 'requestAgent') ?? fail('UNSUPPORTED_HOST_CAPABILITY', '此独立入口不接收输入。需通过完整组件bridge身份、requestId与revision显式请求。');}
  updateContext() {return requireHostCapability(this.capabilities, 'persistentContext') ?? fail('UNSUPPORTED_HOST_CAPABILITY', '此独立入口不接收上下文。需通过完整组件bridge身份与revision显式发布。');}
  hostCapabilities() {this.refreshNativeAdapter();return {updateContext:this.nativeReady&&!this.closed,requestAgent:this.nativeReady&&!this.closed,nativeSessionAdapter:this.nativeSessionAdapter,adapterReady:this.nativeReady&&!this.closed,hostVersion:this.nativeSessionAdapter==='dsh-0.2.0-rc.2'?'0.2.0-rc.2':null};}
  private bridgePacket(request:BridgeRequest,value:{result?:JsonValue;error?:FailureInfo}):JsonValue {
    return JSON.parse(canonicalJson({channel:'dsh.apps.component.v2',protocolVersion:'2.0',sessionId:request.sessionId,viewId:request.viewId,buildId:request.buildId,frameInstanceId:request.frameInstanceId,requestId:request.requestId,...value})) as JsonValue;
  }
  private validateIntent(intent:ComponentAgentIntent,request:BridgeRequest,expectedHash?:string) {
    const identity={protocolVersion:request.protocolVersion,sessionId:request.sessionId,viewId:request.viewId,buildId:request.buildId,frameInstanceId:request.frameInstanceId};
    const requestHash=expectedHash??createHash('sha256').update(canonicalJson({identity,params:request.params})).digest('hex');
    if(intent.sessionId!==request.sessionId||intent.requestId!==request.requestId||intent.viewId!==request.viewId||intent.buildId!==request.buildId||intent.frameInstanceId!==request.frameInstanceId||intent.requestHash!==requestHash||intent.text!==(request.params as {text?:unknown})?.text||!['prepared','dispatching','accepted','unknown','failed'].includes(intent.status)||!Array.isArray(intent.content)||intent.content.length!==(intent.contextSnapshotId?2:1)||intent.content.some(part=>!part||part.type!=='text'||typeof part.text!=='string'||Object.keys(part).some(key=>!['type','text'].includes(key)))||intent.content[0].text!==intent.text||createHash('sha256').update(canonicalJson(intent.content)).digest('hex')!==intent.contentHash)throw new Error('INVALID_AGENT_INTENT');
    if(intent.contextSnapshotId){const pinned=JSON.parse(intent.content[1].text);if(pinned.kind!=='dsh-apps-component-request-context'||pinned.requestId!==intent.requestId||pinned.snapshot?.snapshotId!==intent.contextSnapshotId||pinned.snapshot?.sessionId!==intent.sessionId||pinned.snapshot?.viewId!==intent.viewId||pinned.snapshot?.buildId!==intent.buildId||pinned.snapshot?.contextRevision!==intent.contextRevision)throw new Error('INVALID_AGENT_PINNED_CONTEXT');}
    return intent;
  }
  private async confirmNative(intent:ComponentAgentIntent,signal:AbortSignal) {
    signal.throwIfAborted();
    this.refreshNativeAdapter();
    if(!this.nativeReady)throw new Error('NATIVE_ADAPTER_NOT_READY');
    const resolved=await observeWithin(this.nativeController!.resolveAgent(intent.sessionId),signal);
    if('error' in resolved||this.trusted(resolved.agent)!==intent.sessionId||resolved.agent.session?.id!==intent.sessionId)throw new Error('NATIVE_SESSION_UNAVAILABLE');
    const flushed=await observeWithin(this.nativeSessions!.flush!(resolved.agent.session),signal);signal.throwIfAborted();
    if(flushed!==true)throw new Error('NATIVE_DURABILITY_UNCONFIRMED');
    const inspection=await observeWithin(this.nativeController!.inspect(intent.sessionId,signal),signal);signal.throwIfAborted();
    if(!Array.isArray(inspection.events))throw new Error('INVALID_NATIVE_INSPECTION');
    const receipt=nativeInputReceipt(inspection.events,intent.sessionId,intent.requestId,intent.content);
    if(!receipt)throw new Error('NATIVE_RECEIPT_NOT_FOUND');
    return JSON.parse(canonicalJson(receipt)) as JsonValue;
  }
  private async settleAgent(intent:ComponentAgentIntent,request:BridgeRequest) {
    // Admission cannot be withdrawn after prompt() began. A fresh bounded signal settles its durable ledger even if the UI disconnected.
    const settlementSignal=AbortSignal.timeout(15000);
    let receipt:JsonValue|undefined,error:JsonValue|undefined;
    try {receipt=await this.confirmNative(intent,settlementSignal);} catch(problem) {error={code:problem instanceof Error?problem.message:'NATIVE_RECEIPT_UNAVAILABLE',message:'原生输入回执未确认；只回查原requestId，不再次提交。'};}
    try {return this.validateIntent(await this.transport.agentReceipt!(intent.sessionId,intent.requestId,intent.requestHash,receipt?'accepted':'unknown',receipt,error,AbortSignal.timeout(5000)),request,intent.requestHash);}
    catch {return {...intent,status:'unknown' as const,error:{code:'AGENT_RECEIPT_UNAVAILABLE',message:'Runtime回执保存未确认；只回查原requestId。'}};}
  }
  private async submitAgent(intent:ComponentAgentIntent,request:BridgeRequest,signal:AbortSignal):Promise<ComponentAgentIntent> {
    if(intent.status==='accepted'||intent.status==='failed')return intent;
    if(intent.status!=='prepared')return this.settleAgent(intent,request);
    signal.throwIfAborted();
    const latest=await this.transport.componentContexts!(intent.sessionId,signal);
    if(latest.sessionId!==intent.sessionId||latest.snapshot&&latest.snapshot.sessionId!==intent.sessionId)throw new Error('CONTEXT_NOT_OWNED');
    const context=latest.snapshot?canonicalJson({kind:'dsh-apps-component-context',sessionId:latest.sessionId,snapshot:latest.snapshot}):null;
    const contribution=canonicalJson({content:intent.content,contexts:[{name:'dsh-apps-summary',text:this.appSummary(intent.sessionId)},...(context?[{name:'dsh-apps-component-context',text:context}]:[])],tools:Object.entries(gatewaySchemas).map(([name,parameters])=>({name,description:gatewayDescriptions[name],parameters}))});
    if(Buffer.byteLength(contribution)>16384||context&&Buffer.byteLength(context)>8192)throw new Error('APPS_CONTEXT_BUDGET_EXCEEDED');
    let claim:{dispatchGranted:boolean;intent:ComponentAgentIntent};
    try {claim=await this.transport.dispatchAgent!(intent.sessionId,intent.requestId,intent.requestHash,signal);this.validateIntent(claim.intent,request,intent.requestHash);}
    catch {return {...intent,status:'unknown',error:{code:'AGENT_DISPATCH_UNCONFIRMED',message:'未取得明确的提交许可；没有调用原生输入。请回查原requestId。'}};}
    if(!claim.dispatchGranted)return claim.intent.status==='prepared'?claim.intent:this.submitAgent(claim.intent,request,signal);
    intent=claim.intent;
    if(intent.status!=='dispatching')throw new Error('INVALID_AGENT_DISPATCH');
    if(signal.aborted||this.closed) {
      try {return await this.transport.agentReceipt!(intent.sessionId,intent.requestId,intent.requestHash,'failed',undefined,{code:'CANCELLED_BEFORE_NATIVE_ADMISSION'},AbortSignal.timeout(15000));}
      catch {return {...intent,status:'unknown',error:{code:'AGENT_RECEIPT_UNAVAILABLE'}};}
    }
    try {
      const result=await observeWithin(this.nativeController!.prompt({sessionId:intent.sessionId,requestId:intent.requestId,mode:'queue',content:intent.content},signal),signal);
      if(result.accepted!==true)throw new Error('NATIVE_ADMISSION_UNCONFIRMED');
    } catch { /* An uncertain admission only permits inspection of the original rpcId. */ }
    return this.settleAgent(intent,request);
  }
  private async componentBridge(request:BridgeRequest,signal:AbortSignal):Promise<JsonValue> {
    if(this.closed)return this.bridgePacket(request,{error:{code:'APPS_HOST_CLOSED',message:'Apps Host 已卸载。',retryPolicy:'never'}});
    this.refreshNativeAdapter();
    if(['requestAgent','updateContext'].includes(request.method)&&!this.nativeReady)return this.bridgePacket(request,{error:{code:'UNSUPPORTED_HOST_CAPABILITY',message:'正式DSH会话适配未启用或缺必要服务。可附加所选内容后由用户发送。',retryPolicy:'never'}});
    if(!this.transport.componentBridge)return this.bridgePacket(request,{error:{code:'UNSUPPORTED_HOST_CAPABILITY',message:'当前Runtime未提供组件bridge接口。',retryPolicy:'never'}});
    if(signal.aborted)return this.bridgePacket(request,{error:{code:'CANCELLED_BEFORE_DISPATCH',message:'Component request was not submitted.',retryPolicy:'never'}});
    let packet:JsonValue;
    try{packet=request.method==='invokeCapability'?await this.reviewPump({invocationId:componentReviewInvocationId(request),sessionId:request.sessionId},dispatchSignal=>this.transport.componentBridge!(request,dispatchSignal),signal):await this.transport.componentBridge(request,signal);}
    catch(error){
      const rejected=runtimeHttpError(error,{invocationId:request.requestId,traceId:request.requestId});
      if(rejected&&'error'in rejected)return this.bridgePacket(request,{error:rejected.error});
      const params=request.params&&typeof request.params==='object'&&!Array.isArray(request.params)?request.params:{};
      const potentialWrite=request.method==='requestAgent'||request.method==='updateContext'||request.method==='invokeCapability'&&(typeof params.idempotencyKey==='string'&&params.idempotencyKey.length>0||isBusinessSubmission(params.appId,params.capabilityId));
      return this.bridgePacket(request,{error:{code:'RUNTIME_UNAVAILABLE',message:'Runtime response unavailable; retain this original component request.',retryPolicy:potentialWrite?'inspect_only':'read_retry',details:{requestId:request.requestId,method:request.method,sessionId:request.sessionId,viewId:request.viewId,buildId:request.buildId,frameInstanceId:request.frameInstanceId,params:request.params,doNotResubmitMutation:potentialWrite}}});
    }
    if(request.method!=='requestAgent'||!packet||typeof packet!=='object'||Array.isArray(packet)||packet.error)return packet;
    if(packet.channel!=='dsh.apps.component.v2'||packet.requestId!==request.requestId||packet.sessionId!==request.sessionId||packet.viewId!==request.viewId||packet.buildId!==request.buildId||packet.frameInstanceId!==request.frameInstanceId||!packet.result||typeof packet.result!=='object'||Array.isArray(packet.result))throw new Error('INVALID_AGENT_BRIDGE_RESPONSE');
    const intent=this.validateIntent(packet.result as unknown as ComponentAgentIntent,request);
    try {const result=await this.submitAgent(intent,request,signal);return this.bridgePacket(request,{result:JSON.parse(canonicalJson(result)) as JsonValue});}
    catch(problem){return this.bridgePacket(request,{error:{code:problem instanceof Error?problem.message:'NATIVE_ADAPTER_FAILED',message:'原生输入未提交。请检查上下文引用与预算后显式发起请求。',retryPolicy:'never'}});}
  }
  async ui(request: Request): Promise<Response> {
    try {
      this.refreshNativeAdapter();
      const url = new URL(request.url);
      if (request.method === 'GET') {
        const resource = url.searchParams.get('resource');
        if(resource==='componentThumbnail'&&[...url.searchParams.keys()].every(key=>['resource','componentId','revision'].includes(key))){
          const componentId=url.searchParams.get('componentId')??'',revision=url.searchParams.get('revision')??'';
          if(!/^[-a-zA-Z0-9_.:]{1,180}$/.test(componentId)||! /^[1-9][0-9]{0,9}$/.test(revision))return jsonResponse(fail('INVALID_INPUT','组件预览参数无效。'),400);
          if(!this.transport.componentThumbnail)return new Response(null,{status:404});
          const response=await this.transport.componentThumbnail(componentId,Number(revision),this.combined(request.signal));
          if(response.status===404)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
          if(!response.ok||response.headers.get('content-type')?.split(';')[0].trim()!=='image/png')return new Response(null,{status:502});
          return new Response(response.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
        }
        if(['workbench','materials','dataSources','stores'].includes(resource??'')&&[...url.searchParams.keys()].every(key=>['resource','appId'].includes(key))){
          if(!this.transport.workbenchResource)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime尚未提供工作台。'),503);
          return jsonResponse(await this.transport.workbenchResource(resource!,url.searchParams.get('appId')??'hallmark',this.combined(request.signal)));
        }
        if(resource==='businessSettings'&&[...url.searchParams.keys()].every(key=>['resource','connectionId','storeId'].includes(key)))return jsonResponse(this.transport.businessSettingsRead?await this.transport.businessSettingsRead(url.searchParams.get('connectionId')??undefined,url.searchParams.get('storeId')??undefined,this.combined(request.signal)):fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 尚未提供经营设置。'));
        if(resource==='hostCapabilities'&&[...url.searchParams.keys()].every(key=>key==='resource'))return jsonResponse(this.hostCapabilities());
        if(resource==='componentFeatures'&&[...url.searchParams.keys()].every(key=>key==='resource'))return jsonResponse(this.transport.componentFeatures?await this.transport.componentFeatures(this.combined(request.signal)):{features:[]});
        if(resource==='componentHistory'&&url.searchParams.get('componentId'))return jsonResponse(this.transport.componentHistory?await this.transport.componentHistory(url.searchParams.get('componentId')!,this.combined(request.signal)):fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供组件历史。'));
        if(resource==='saved'&&[...url.searchParams.keys()].every(key=>key==='resource'))return jsonResponse(this.transport.saved?await this.transport.saved(this.combined(request.signal)):fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供共享组件库。'));
        if (resource === 'apps' && [...url.searchParams.keys()].every(key => key === 'resource')) return jsonResponse(await this.directory(request.signal));
        if (resource === 'connections' && [...url.searchParams.keys()].every(key => ['resource','appId'].includes(key))) return jsonResponse(await this.transport.listConnections(url.searchParams.get('appId') ?? undefined, request.signal));
        const sessionId = url.searchParams.get('sessionId');
        if(resource==='favorites'){
          if([...url.searchParams.keys()].some(key=>!['resource','sessionId'].includes(key)))return jsonResponse(fail('INVALID_INPUT','收藏参数无效。'),400);
          if(!sessionId||!await this.knownSession(sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
          if(!this.transport.favorites)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 尚未提供收藏。'),503);
          return jsonResponse(await this.transport.favorites(sessionId,this.combined(request.signal)));
        }
        if(resource==='nativeBinding'&&sessionId&&[...url.searchParams.keys()].every(key=>['resource','sessionId','bindRequestId','referenceId'].includes(key))){const referenceId=url.searchParams.get('referenceId')??'',reference=parseNativeReference(referenceId),bindRequestId=url.searchParams.get('bindRequestId');if(!reference||reference.sessionId!==sessionId||reference.bindRequestId!==bindRequestId||!await this.knownSession(sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','原Apps引用与本机会话身份不一致。'),400);return jsonResponse(this.transport.inspectNativeBinding?await this.transport.inspectNativeBinding(sessionId,reference.bindRequestId,referenceId,this.combined(request.signal)):fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供原Apps引用回读。'));}
        if(resource==='views'&&sessionId&&[...url.searchParams.keys()].every(key=>['resource','sessionId'].includes(key))&&await this.knownSession(sessionId,request.signal)){
          if(this.transport.viewsResponse){const response=await this.transport.viewsResponse(sessionId,request.headers.get('If-None-Match')??undefined,this.combined(request.signal));const headers:Record<string,string>={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8'};const etag=response.headers.get('ETag');if(etag)headers.ETag=etag;return new Response(response.status===304?null:await response.text(),{status:response.status,headers});}
          return jsonResponse(this.transport.views?await this.transport.views(sessionId,this.combined(request.signal)):fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供会话组件目录。'));
        }
        if (resource === 'bindings' && sessionId && [...url.searchParams.keys()].every(key => ['resource','sessionId'].includes(key)) && await this.knownSession(sessionId, request.signal)) return jsonResponse(await this.transport.sessionBindings(sessionId,request.signal));
        if (resource === 'diagnostics' && sessionId && [...url.searchParams.keys()].every(key => ['resource','sessionId'].includes(key)) && await this.knownSession(sessionId, request.signal)) return jsonResponse(this.transport.diagnostics ? await this.transport.diagnostics(sessionId,request.signal) : fail('UNSUPPORTED_HOST_CAPABILITY','当前Runtime未提供诊断接口。'));
        const requestId=url.searchParams.get('requestId');
        if(resource==='presentationRequest'&&sessionId&&requestId&&/^[-a-zA-Z0-9_.:]{1,160}$/.test(requestId)&&[...url.searchParams.keys()].every(key=>['resource','sessionId','requestId'].includes(key))&&await this.knownSession(sessionId,request.signal)){
          if(!this.transport.presentationRequest)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供原界面调用回查。'),503);
          const invocation=await this.transport.presentationRequest(requestId,this.combined(request.signal));
          if(!invocation)return jsonResponse({invocation:null});
          if(invocation.invocationId!==requestId||invocation.request.invocationId!==requestId||invocation.request.appId!=='apps'||invocation.request.connectionId!=='presentation'||!/^apps\.(presentation|authoring)\.[a-z_]+$/.test(invocation.request.capabilityId)||!('sessionId' in invocation.request.source)||invocation.request.source.sessionId!==sessionId)return jsonResponse(fail('INVALID_SESSION','原调用不属于此会话界面动作。'),400);
          return jsonResponse({invocation});
        }
        if(resource==='agentRequest'&&sessionId&&requestId&&/^[-a-zA-Z0-9_.:]{1,160}$/.test(requestId)&&[...url.searchParams.keys()].every(key=>['resource','sessionId','requestId'].includes(key))&&await this.knownSession(sessionId,request.signal)){
          if(!this.transport.agentIntent)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','当前Runtime未提供原请求回查。'));
          const intent=await this.transport.agentIntent(sessionId,requestId,request.signal);
          if(this.nativeReady&&['dispatching','unknown'].includes(intent.status))return jsonResponse(await this.settleAgent(intent,{protocolVersion:'2.0',sessionId,requestId,viewId:intent.viewId,buildId:intent.buildId,frameInstanceId:intent.frameInstanceId,method:'requestAgent',params:{text:intent.text,expectedContextRevision:intent.contextRevision}}));
          return jsonResponse(intent);
        }
        const viewId=url.searchParams.get('viewId');
        const fixedBuild=url.searchParams.get('buildId'),fixedRevision=url.searchParams.get('viewRevision'),publicationId=url.searchParams.get('publicationId'),displayId=url.searchParams.get('displayId'),displayGeneration=url.searchParams.get('displayGeneration');
        if (['view','viewData'].includes(resource??'')&&sessionId&&viewId&&/^[-a-zA-Z0-9_.:]{1,180}$/.test(viewId)&&(fixedBuild===null||/^[-a-zA-Z0-9_]{1,180}$/.test(fixedBuild))&&(publicationId===null||/^[-a-zA-Z0-9_.:]{1,180}$/.test(publicationId))&&(fixedRevision===null||/^[1-9][0-9]{0,9}$/.test(fixedRevision))&&(displayId===null||/^[-a-zA-Z0-9_.:]{1,180}$/.test(displayId))&&(displayGeneration===null||/^[1-9][0-9]{0,9}$/.test(displayGeneration))&&((displayId===null)===(displayGeneration===null))&&(resource==='viewData'||displayId===null)&&[...url.searchParams.keys()].every(key=>['resource','sessionId','viewId','buildId','viewRevision','publicationId','displayId','displayGeneration'].includes(key))&&await this.knownSession(sessionId,request.signal)) {
          if(resource==='view'&&this.transport.view){const view=await this.transport.view(sessionId,viewId,request.signal,{...(fixedBuild?{buildId:fixedBuild}:{}),...(fixedRevision?{viewRevision:Number(fixedRevision)}:{}),...(publicationId?{publicationId}:{})});await this.prepareView?.(view,sessionId,request.signal);return jsonResponse(view);}
          if(resource==='viewData'&&this.transport.viewData)return jsonResponse(await this.transport.viewData(sessionId,viewId,request.signal,{...(publicationId?{publicationId}:{}),...(fixedBuild?{buildId:fixedBuild}:{}),...(displayId?{displayId,displayGeneration:Number(displayGeneration)}:{})}));
          return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','当前Runtime未提供组件读取接口。'));
        }
      } else if (request.method === 'POST') {
        if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return jsonResponse(fail('INVALID_INPUT', 'JSON_REQUIRED'), 400);
        const body = await request.text();if (Buffer.byteLength(body) > 65536) return jsonResponse(fail('INVALID_INPUT', 'BODY_TOO_LARGE'), 400);
        const input: unknown = JSON.parse(body);
        if (input && typeof input === 'object' && !Array.isArray(input)) {
          const value = input as Record<string,unknown>;
          if(value.action==='businessOperations')return this.businessOperations(value,this.combined(request.signal));
          if(value.action==='businessSettings'){
            if(Object.keys(value).some(key=>!['action','sessionId','connectionId','operation','input'].includes(key))||(value.sessionId!==undefined&&typeof value.sessionId!=='string')||typeof value.connectionId!=='string'||typeof value.operation!=='string'||!['store.save','store.check','pricing.save','pricing.quote','packaging.search','packaging.read','packaging.save','packaging.remove'].includes(value.operation)||!value.input||typeof value.input!=='object'||Array.isArray(value.input))return jsonResponse(fail('INVALID_INPUT','经营设置参数无效。'),400);
            if(typeof value.sessionId==='string'&&!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
            if(!this.transport.businessSettingsWrite)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 尚未提供经营设置。'),503);
            return jsonResponse(await this.transport.businessSettingsWrite({connectionId:value.connectionId,operation:value.operation,input:value.input as JsonValue},this.combined(request.signal)));
          }
          if(value.action==='favorite'){
            if(Object.keys(value).some(key=>!['action','sessionId','componentId','favorite'].includes(key))||typeof value.componentId!=='string'||!/^[-a-zA-Z0-9_.:]{1,180}$/.test(value.componentId)||typeof value.favorite!=='boolean')return jsonResponse(fail('INVALID_INPUT','收藏参数无效。'),400);
            if(typeof value.sessionId!=='string'||!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
            if(!this.transport.setFavorite)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 尚未提供收藏。'),503);
            return jsonResponse(await this.transport.setFavorite({sessionId:value.sessionId,componentId:value.componentId,favorite:value.favorite},this.combined(request.signal)));
          }
          if(value.action==='refreshView'&&Object.keys(value).every(key=>['action','sessionId','viewId','forceRefresh'].includes(key))&&typeof value.sessionId==='string'&&typeof value.viewId==='string'&&/^[-a-zA-Z0-9_.:]{1,180}$/.test(value.viewId)&&typeof value.forceRefresh==='boolean'){
            if(!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
            if(!this.transport.refreshView)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime 未提供数据更新。'),503);
            return jsonResponse(await this.transport.refreshView(value.sessionId,value.viewId,value.forceRefresh,this.combined(request.signal)));
          }
          if(value.action==='workbench'&&Object.keys(value).every(key=>['action','appId','operation','params','sessionId'].includes(key))&&typeof value.appId==='string'&&typeof value.operation==='string'&&['save','read','preview','initialize','prepare','pinComponent','unpinComponent'].includes(value.operation)){
            if(value.sessionId!==undefined&&(typeof value.sessionId!=='string'||!await this.knownSession(value.sessionId,request.signal)))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
            if(value.operation==='prepare'){
              if(typeof value.sessionId!=='string')return jsonResponse(fail('INVALID_SESSION','准备数据源需求需要明确的原聊天。'),400);
              const result=await this.prepareWorkbench(value.sessionId,value.appId,value.params,this.combined(request.signal));return jsonResponse(result,result.status==='ok'?200:400);
            }
            if(!this.transport.workbenchAction)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime尚未提供工作台。'),503);
            return jsonResponse(await this.transport.workbenchAction({appId:value.appId,operation:value.operation,params:value.params as JsonValue,...(typeof value.sessionId==='string'?{sessionId:value.sessionId}:{})},this.combined(request.signal)));
          }
          if(value.action==='presentation'&&Object.keys(value).every(key=>['action','sessionId','capabilityId','input','requestId'].includes(key))&&typeof value.sessionId==='string'&&typeof value.capabilityId==='string'&&/^apps\.(presentation|authoring)\.[a-z_]+$/.test(value.capabilityId)&&typeof value.requestId==='string'&&value.requestId.length<=160&&Object.hasOwn(value,'input')){
            if(!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);if(!this.transport.presentationAction)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供共享界面操作。'),503);
            return jsonResponse(await this.transport.presentationAction({sessionId:value.sessionId,capabilityId:value.capabilityId,input:value.input as JsonValue,requestId:value.requestId},this.combined(request.signal)));
          }
          if(value.action==='authoring'&&Object.keys(value).every(key=>['action','sessionId','operation','params'].includes(key))&&typeof value.sessionId==='string'&&typeof value.operation==='string'&&['openDisplay','authorizeDisplayFrame','reportDisplayError','startMount','authorizeFrame','negotiateFrame','retireFrame','inspect','failMount','exportUiState','restoreUiState','closeDraft','restoreView'].includes(value.operation)&&value.params&&typeof value.params==='object'&&!Array.isArray(value.params)){
            if(!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);if(!this.transport.authoringAction)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供创作界面操作。'),503);
            return jsonResponse(await this.transport.authoringAction(value.operation,value.sessionId,value.params as JsonValue,this.combined(request.signal)));
          }
          if(value.action==='componentExtension'&&Object.keys(value).every(key=>['action','request'].includes(key))&&value.request&&typeof value.request==='object'&&!Array.isArray(value.request)){
            const extension=value.request as ComponentExtensionRequest;if(typeof extension.sessionId!=='string'||!await this.knownSession(extension.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);if(!this.transport.componentExtension)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供组件扩展。'),503);
            return jsonResponse(await this.transport.componentExtension(extension,this.combined(request.signal)));
          }
          if(value.action==='nativeBinding'&&Object.keys(value).every(key=>['action','sessionId','appId','connectionId','bindRequestId','epoch','enabled','referenceId'].includes(key))&&typeof value.sessionId==='string'&&typeof value.appId==='string'&&typeof value.bindRequestId==='string'&&typeof value.referenceId==='string'&&typeof value.enabled==='boolean'&&Number.isSafeInteger(value.epoch)&&Number(value.epoch)>=0&&(value.connectionId===undefined||typeof value.connectionId==='string')){
            const reference=parseNativeReference(value.referenceId);if(!reference||reference.sessionId!==value.sessionId||reference.appId!==value.appId||reference.bindRequestId!==value.bindRequestId||!await this.knownSession(value.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','Apps引用与原会话身份不一致。'),400);
            if(!this.transport.nativeBinding)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供Apps引用绑定。'),503);
            const {action:_,...binding}=value;return jsonResponse(await this.transport.nativeBinding(binding as unknown as NativeBindingRequest,this.combined(request.signal)));
          }
          if(value.action==='serializeNativeReference'&&Object.keys(value).every(key=>['action','referenceId'].includes(key))&&typeof value.referenceId==='string'){
            const reference=parseNativeReference(value.referenceId);if(!reference||!await this.knownSession(reference.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','Apps引用不属于有效原会话。'),400);
            if(!this.transport.serializeNativeReference)return jsonResponse(fail('UNSUPPORTED_HOST_CAPABILITY','Runtime未提供Apps引用序列化。'),503);
            return jsonResponse(await this.transport.serializeNativeReference(value.referenceId,reference.sessionId,this.combined(request.signal)));
          }
          if (value.action === 'bind' && Object.keys(value).every(key => ['action','sessionId','appId','connectionId','enabled'].includes(key)) && typeof value.sessionId === 'string' && typeof value.appId === 'string' && typeof value.connectionId === 'string' && typeof value.enabled === 'boolean') return jsonResponse(await this.bind(value.sessionId,value.appId,value.connectionId,value.enabled,request.signal));
          if(value.action==='componentBridge'&&Object.keys(value).every(key=>['action','request'].includes(key))&&value.request&&typeof value.request==='object'&&!Array.isArray(value.request)) {
            const bridge=value.request as BridgeRequest;if(typeof bridge.sessionId!=='string'||!await this.knownSession(bridge.sessionId,request.signal))return jsonResponse(fail('INVALID_SESSION','没有此本机会话。'),400);
            return jsonResponse(await this.componentBridge(bridge,AbortSignal.any([this.combined(request.signal),AbortSignal.timeout(bridge.method==='invokeCapability'?appsInvocationTimeout(bridge.params as {appId?:unknown;capabilityId?:unknown;deadlineAt?:unknown}):bridge.method==='refresh'?APPS_DATA_REQUEST_TIMEOUT_MS:90000)])));
          }
          if (value.action === 'requestAgent' || value.action === 'updateContext') return jsonResponse(value.action === 'requestAgent' ? this.requestAgent() : this.updateContext());
        }
      }
      return jsonResponse(fail('INVALID_INPUT', '无效Apps代理请求。'), 400);
    } catch(error) {const detail=error as {statusCode?:number;details?:unknown};if(Number.isInteger(detail.statusCode)&&detail.statusCode!>=400&&detail.statusCode!<=599&&detail.details)return jsonResponse(detail.details,detail.statusCode);return jsonResponse(fail('RUNTIME_UNAVAILABLE', 'Runtime或目录暂不可用。'), 503);}
  }
  async dispose() {if (this.closed) return;this.closed = true;this.lifetime.abort();this.attachments.clear();await Promise.allSettled(this.disposers.splice(0).reverse().map(dispose => Promise.resolve().then(dispose)));}
}
export async function apply(ctx: AppsPluginContext, options: {transport: AppsHostTransport;capabilities?: HostCapabilityMatrix}) {const host = new AppsHost(ctx,options.transport,options.capabilities);await host.start();ctx.effect?.(() => () => {void host.dispose();});return host;}
