import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson, compileSchema, validateInvocation, validateResult, validateDescriptor, validateManifest } from '../../app-contracts/src/index.ts';
import type { AppProvider, CapabilityDescriptor, CapabilityResult, ExecutionContext, FailureInfo, InvocationRequest, JsonValue, SessionAppBinding, OperationState } from '../../app-contracts/src/index.ts';
import { RuntimeStore, DATABASE_SCHEMA_VERSION } from './store.ts';
import type { InvocationRecord, RuntimeOperation } from './store.ts';
export * from './store.ts';

export interface AppConnection { appId: string; connectionId: string; displayName: string; config: JsonValue; configRevision: number; enabled: boolean; }
export type ProviderState = 'registered' | 'ready' | 'degraded' | 'stopping' | 'stopped';
interface RegisteredProvider { provider: AppProvider; state: ProviderState; inputs: Map<string, (value: unknown) => string[]>; outputs: Map<string, (value: unknown) => string[]>; }
function key(...values: string[]): string { return JSON.stringify(values); }
function digest(value: unknown): string { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
function failure(request: Pick<InvocationRequest, 'invocationId' | 'traceId'>, code: string, message: string, status: 'failed' | 'unavailable' | 'cancelled' = 'failed', retryPolicy: FailureInfo['retryPolicy'] = 'never', details?: JsonValue): CapabilityResult {
  return {invocationId:request.invocationId,traceId:request.traceId,status,error:{code,message,retryPolicy,...(details === undefined ? {} : {details})}};
}
function operationResult(operation: RuntimeOperation, request: InvocationRequest): CapabilityResult {
  if (operation.result) return {...operation.result,invocationId:request.invocationId,traceId:request.traceId,operation:{operationId:operation.operationId,state:operation.state}};
  if (operation.state === 'unknown') return {...failure(request,'OUTCOME_UNKNOWN','Only read-only inspection may resolve this operation.'),status:'unknown',operation:{operationId:operation.operationId,state:'unknown'},error:{code:'OUTCOME_UNKNOWN',message:'No completion evidence is available.',retryPolicy:'inspect_only'}};
  return {invocationId:request.invocationId,traceId:request.traceId,status:'pending',operation:{operationId:operation.operationId,state:operation.state},pollAfterMs:1000};
}

/** A connection lock also bounds declared-safe reads. Queued aborts never cross the dispatch barrier. */
class ConnectionQueue {
  active = 0;
  exclusive = false;
  pending: Array<{exclusive: boolean; signal: AbortSignal; resolve: (release: () => void) => void; reject: (error: Error) => void; cleanup: () => void}> = [];
  acquire(exclusive: boolean, signal: AbortSignal): Promise<() => void> {
    return new Promise((resolve,reject) => {
      if (signal.aborted) return reject(new Error('ABORTED'));
      const item = {exclusive,signal,resolve,reject,cleanup:() => signal.removeEventListener('abort',abort)};
      const abort = () => { const index=this.pending.indexOf(item); if(index>=0) {this.pending.splice(index,1);item.cleanup();reject(new Error('ABORTED'));this.drain();} };
      signal.addEventListener('abort',abort,{once:true});
      this.pending.push(item);this.drain();
    });
  }
  private drain(): void {
    while (this.pending.length && !this.exclusive) {
      const item=this.pending[0];
      if (item.exclusive && this.active || !item.exclusive && this.active>=4) return;
      this.pending.shift();item.cleanup();this.active++;this.exclusive=item.exclusive;
      let released=false;
      item.resolve(() => {if(released)return;released=true;this.active--;if(item.exclusive)this.exclusive=false;this.drain();});
      if(item.exclusive)return;
    }
  }
}

export class AppsRuntime {
  readonly store: RuntimeStore;
  readonly runtimeVersion = '1.0.0-candidate.4';
  readonly transportMajor = 1;
  readonly catalogSchemaVersion = 1;
  #providers = new Map<string, RegisteredProvider>();
  #capabilities = new Map<string, {appId: string; descriptor: CapabilityDescriptor}>();
  #aliases = new Map<string,string>();
  #catalogDigest: string | undefined;
  #inflight = new Map<string, Promise<CapabilityResult>>();
  #executions = new Set<Promise<CapabilityResult>>();
  #queues = new Map<string, ConnectionQueue>();
  #log: (event: Record<string, unknown>) => void;
  constructor(store: RuntimeStore, options: {log?: (event: Record<string, unknown>) => void} = {}) {this.store=store;this.#log=options.log??(()=>{});}
  get catalogDigest(): string { return this.#catalogDigest??=digest([...this.#capabilities.values()].map(row=>({appId:row.appId,descriptor:row.descriptor})).sort((a,b)=>a.descriptor.capabilityId.localeCompare(b.descriptor.capabilityId))); }
  identity() { return {runtimeVersion:this.runtimeVersion,transportMajor:1,catalogSchemaVersion:1,databaseSchemaVersion:DATABASE_SCHEMA_VERSION,catalogDigest:this.catalogDigest}; }
  handshake(actual: {transportMajor: number; catalogSchemaVersion: number}) {
    if (actual.transportMajor!==this.transportMajor || actual.catalogSchemaVersion!==this.catalogSchemaVersion) throw Object.assign(new Error('INCOMPATIBLE_PROTOCOL'),{expected:{transportMajor:1,catalogSchemaVersion:1},actual});
    return this.identity();
  }
  register(provider: AppProvider): () => Promise<void> {
    const manifest=provider.manifest;
    const manifestErrors=validateManifest(manifest);if(manifestErrors.length)throw new Error(`INVALID_MANIFEST: ${manifestErrors.join('; ')}`);
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(manifest.appId) || manifest.manifestVersion!==1 || manifest.runtimeProtocolMajor!==1 || this.#providers.has(manifest.appId)) throw new Error('INVALID_OR_DUPLICATE_MANIFEST');
    const inputs=new Map<string,(value:unknown)=>string[]>(), outputs=new Map<string,(value:unknown)=>string[]>();
    const ids=new Set<string>(), aliases=new Set<string>();
    for(const descriptor of provider.descriptors) {
      const errors=validateDescriptor(descriptor);
      if(errors.length)throw new Error(`INVALID_CAPABILITY_DESCRIPTOR: ${errors.join('; ')}`);
      if(!descriptor.capabilityId.startsWith(`${manifest.appId}.`) || ids.has(descriptor.capabilityId) || this.#capabilities.has(descriptor.capabilityId)) throw new Error('DUPLICATE_OR_FOREIGN_CAPABILITY');
      ids.add(descriptor.capabilityId);
      inputs.set(descriptor.capabilityId,compileSchema(descriptor.inputSchema));outputs.set(descriptor.capabilityId,compileSchema(descriptor.outputSchema));
      for(const alias of descriptor.aliases){if(aliases.has(alias)||this.#aliases.has(alias))throw new Error('DUPLICATE_CAPABILITY_ALIAS');aliases.add(alias);}
    }
    this.#providers.set(manifest.appId,{provider,state:'registered',inputs,outputs});
    for(const descriptor of provider.descriptors){this.#capabilities.set(descriptor.capabilityId,{appId:manifest.appId,descriptor:structuredClone(descriptor)});for(const alias of descriptor.aliases)this.#aliases.set(alias,descriptor.capabilityId);}
    this.#catalogDigest=undefined;
    this.#providers.get(manifest.appId)!.state='ready';
    return () => this.stopProvider(manifest.appId);
  }
  listApps() {return [...this.#providers.values()].map(row=>({...row.provider.manifest,providerState:row.state}));}
  describe(capabilityId: string, version?: string): CapabilityDescriptor | undefined {
    const value=this.#capabilities.get(this.#aliases.get(capabilityId)??capabilityId)?.descriptor;
    return value && (!version || value.version===version) ? structuredClone(value) : undefined;
  }
  discover(options: {appId?: string; query?: string; cursor?: string; limit?: number} = {}) {
    const limit=Math.min(100,Math.max(1,options.limit??20));
    const offset=options.cursor===undefined?0:Number(options.cursor);
    if(!Number.isSafeInteger(offset)||offset<0)throw new Error('INVALID_CURSOR');
    const search=options.query?.toLowerCase();
    const all=[...this.#capabilities.values()].filter(row=>(!options.appId||row.appId===options.appId)&&(!search||[row.descriptor.capabilityId,row.descriptor.title,...row.descriptor.discovery.keywords].some(value=>value.toLowerCase().includes(search)))).sort((a,b)=>a.descriptor.capabilityId.localeCompare(b.descriptor.capabilityId));
    const items=all.slice(offset,offset+limit).map(({appId,descriptor})=>({appId,capabilityId:descriptor.capabilityId,version:descriptor.version,title:descriptor.title,effect:descriptor.effect,description:descriptor.description}));
    return {items,total:all.length,returned:items.length,nextCursor:offset+items.length<all.length?String(offset+items.length):null,catalogDigest:this.catalogDigest};
  }
  addConnection(connection: AppConnection): AppConnection {
    if(!this.#providers.has(connection.appId)||!connection.connectionId||!connection.displayName||!Number.isSafeInteger(connection.configRevision)||connection.configRevision<1||typeof connection.enabled!=='boolean')throw new Error('INVALID_CONNECTION');
    canonicalJson(connection.config);
    const rejectCredentials=(value:JsonValue):void=>{if(value&&typeof value==='object')for(const [name,item] of Object.entries(value)){if(/^(?:api_?key|client_?id|operator_?token|password|secret|ozoncredentials)$/i.test(name))throw new Error('CREDENTIAL_FIELD_FORBIDDEN');rejectCredentials(item);}};rejectCredentials(connection.config);
    const previous=this.getConnection(connection.appId,connection.connectionId);
    if(previous && connection.configRevision<=previous.configRevision)throw new Error('REVISION_CONFLICT');
    return this.store.put('connections',key(connection.appId,connection.connectionId),connection);
  }
  getConnection(appId: string, connectionId: string): AppConnection | undefined {return this.store.get('connections',key(appId,connectionId));}
  listConnections(appId?: string): AppConnection[] {return this.store.list<AppConnection>('connections').filter(row=>!appId||row.appId===appId);}
  bind(binding: SessionAppBinding): SessionAppBinding {
    if(!binding.sessionId||typeof binding.enabled!=='boolean'||!Number.isFinite(Date.parse(binding.boundAt))||!this.getConnection(binding.appId,binding.connectionId))throw new Error('INVALID_SESSION_BINDING');
    return this.store.put('session_app_bindings',key(binding.sessionId,binding.appId,binding.connectionId),binding);
  }
  sessionBindings(sessionId: string): SessionAppBinding[] {return this.store.list<SessionAppBinding>('session_app_bindings').filter(row=>row.sessionId===sessionId);}
  resolveConnection(appId: string, sessionId?: string, connectionId?: string): {appId: string; connectionId: string} | {status:'needs_clarification';missing:string[];candidates:JsonValue[];question:string} {
    const bindings=sessionId?this.sessionBindings(sessionId).filter(row=>row.appId===appId&&row.enabled):undefined;
    const candidates=this.listConnections(appId).filter(row=>row.enabled&&(!bindings||bindings.some(binding=>binding.connectionId===row.connectionId)));
    const matches=connectionId?candidates.filter(row=>row.connectionId===connectionId):candidates;
    if(matches.length===1)return {appId,connectionId:matches[0].connectionId};
    return {status:'needs_clarification',missing:['connectionId'],candidates:candidates.map(row=>({appId:row.appId,connectionId:row.connectionId,displayName:row.displayName})),question:'Specify one enabled connection ID.'};
  }
  async invoke(request: InvocationRequest, signal?: AbortSignal): Promise<CapabilityResult> {
    const errors=validateInvocation(request);
    if(errors.length)return failure({invocationId:request?.invocationId??'invalid',traceId:request?.traceId??'invalid'},request?.protocolVersion!=='1.0'?'INCOMPATIBLE_PROTOCOL':'INVALID_INPUT',errors.join('; '));
    const attemptHash=digest(request);
    const current=this.#inflight.get(request.invocationId);
    if(current){const existing=this.store.get<InvocationRecord>('invocations',request.invocationId);return existing?.requestHash===attemptHash?current:failure(request,'INVOCATION_CONFLICT','Invocation ID already identifies another request.');}
    const existing=this.store.transaction(()=>{
      const previous=this.store.get<InvocationRecord>('invocations',request.invocationId);
      if(previous)return previous;
      this.store.put('invocations',request.invocationId,{invocationId:request.invocationId,requestHash:attemptHash,request:structuredClone(request),state:'received',startedAt:new Date().toISOString(),...('runId' in request.source?{parentRunId:request.source.runId}:{})} satisfies InvocationRecord);
      return undefined;
    });
    if(existing){if(existing.requestHash!==attemptHash)return failure(request,'INVOCATION_CONFLICT','Invocation ID already identifies another request.');if(existing.result)return existing.result;if(existing.operationId){const op=this.store.get<RuntimeOperation>('operations',existing.operationId);if(op)return operationResult(op,request);}return failure(request,'INVOCATION_IN_PROGRESS','This invocation has already been received.','unavailable','read_retry');}
    const work=this.execute(request,signal).then(result=>{
      const record=this.store.get<InvocationRecord>('invocations',request.invocationId)!;
      this.store.put('invocations',request.invocationId,{...record,state:'settled',result,durationMs:Date.now()-Date.parse(record.startedAt)});
      this.log(request,'settled',{status:result.status,operationId:result.operation?.operationId??null,durationMs:Date.now()-Date.parse(record.startedAt)});
      return result;
    }).finally(()=>this.#inflight.delete(request.invocationId));
    this.#inflight.set(request.invocationId,work);return work;
  }
  private async execute(request: InvocationRequest, externalSignal?: AbortSignal): Promise<CapabilityResult> {
    this.log(request,'received');
    const entry=this.#capabilities.get(request.capabilityId);
    if(!entry||entry.appId!==request.appId||entry.descriptor.version!==request.capabilityVersion)return failure(request,'CAPABILITY_NOT_FOUND','The exact capability version is not registered.');
    const registered=this.#providers.get(request.appId)!;
    if(registered.state!=='ready'&&registered.state!=='degraded')return failure(request,'APP_STOPPING','Provider is not accepting new calls.','unavailable','read_retry');
    const connection=this.getConnection(request.appId,request.connectionId);
    if(!connection?.enabled)return failure(request,'CONNECTION_NOT_FOUND','An explicit enabled connection is required.');
    if('sessionId' in request.source&&!this.sessionBindings(request.source.sessionId).some(row=>row.appId===request.appId&&row.connectionId===request.connectionId&&row.enabled))return failure(request,'APP_NOT_ACTIVE','This connection is not enabled in the source session.');
    if(request.source.kind==='recovery')return failure(request,'INSPECT_REQUIRED','Recovery must inspect the original operation.');
    const errors=registered.inputs.get(request.capabilityId)!(request.input);
    if(errors.length)return failure(request,'INPUT_SCHEMA_INVALID',errors.join('; '),'failed','never',errors);
    const mutation=entry.descriptor.effect==='mutation';
    if(mutation&&!request.idempotencyKey)return failure(request,'IDEMPOTENCY_KEY_REQUIRED','Mutation calls require a stable intent key.');
    let operation: RuntimeOperation | undefined;
    if(mutation){
      const hash=digest({capabilityVersion:request.capabilityVersion,input:request.input,expectedResourceRevision:request.expectedResourceRevision??null});
      const reserved=this.store.transaction(()=>{
        const previous=this.store.operationByKey(request.appId,request.connectionId,request.capabilityId,request.idempotencyKey!);
        if(previous)return {previous};
        const at=new Date().toISOString();
        const op:RuntimeOperation={operationId:randomUUID(),appId:request.appId,connectionId:request.connectionId,capabilityId:request.capabilityId,capabilityVersion:request.capabilityVersion,idempotencyKey:request.idempotencyKey!,requestHash:hash,request,state:'queued',createdAt:at,updatedAt:at};
        this.store.put('operations',op.operationId,op);this.store.appendEvent(op.operationId,{event:'received',traceId:request.traceId,invocationId:request.invocationId,state:'queued'});return {created:op};
      });
      operation=reserved.previous??reserved.created!;
      this.store.put('invocation_operations',request.invocationId,{invocationId:request.invocationId,operationId:operation.operationId});
      const record=this.store.get<InvocationRecord>('invocations',request.invocationId)!;this.store.put('invocations',request.invocationId,{...record,operationId:operation.operationId});
      if(reserved.previous){if(operation.requestHash!==hash)return {...failure(request,'IDEMPOTENCY_CONFLICT','Intent key was already used with different normalized input or capability version.'),operation:{operationId:operation.operationId,state:operation.state}};return operationResult(operation,request);}
    }
    const controller=new AbortController();
    const cancel=()=>controller.abort(externalSignal?.reason);externalSignal?.addEventListener('abort',cancel,{once:true});if(externalSignal?.aborted)cancel();
    const remaining=Math.min(Date.parse(request.deadlineAt)-Date.now(),entry.descriptor.execution.timeoutMs);
    const timer=setTimeout(()=>controller.abort(new Error('DEADLINE_EXCEEDED')),Math.max(0,remaining));
    if(remaining<=0)controller.abort(new Error('DEADLINE_EXCEEDED'));
    const queueKey=key(request.appId,request.connectionId), queue=this.#queues.get(queueKey)??new ConnectionQueue();this.#queues.set(queueKey,queue);
    let release: (()=>void) | undefined, providerWork: Promise<CapabilityResult> | undefined;
    try {
      release=await queue.acquire(mutation||entry.descriptor.execution.concurrency==='exclusive',controller.signal);
      if(controller.signal.aborted)throw new Error('ABORTED');
      if(mutation){
        const unresolved=this.store.list<RuntimeOperation>('operations').find(row=>row.operationId!==operation!.operationId&&row.appId===request.appId&&row.connectionId===request.connectionId&&['unknown','pending','dispatching'].includes(row.state));
        if(unresolved){const result={...failure(request,'OPERATION_UNRESOLVED','Inspect the unresolved operation before another mutation.'),operation:{operationId:operation!.operationId,state:'failed' as const}};this.store.updateOperation(operation!.operationId,'failed',result,{blockedBy:unresolved.operationId});return result;}
        operation=this.store.updateOperation(operation!.operationId,'dispatching',undefined,{event:'dispatch_intent',traceId:request.traceId,invocationId:request.invocationId});
      }
      const record=this.store.get<InvocationRecord>('invocations',request.invocationId)!;this.store.put('invocations',request.invocationId,{...record,state:'dispatching'});
      this.log(request,'dispatch_intent',{operationId:operation?.operationId??null});
      const context:ExecutionContext={request:structuredClone(request),signal:controller.signal,...(operation?{operationId:operation.operationId}:{}),...('runId' in request.source?{parentRunId:request.source.runId}:{})};
      const execution=registered.provider.execute(context);
      providerWork=execution;
      this.#executions.add(execution);
      // Keep the connection locked until execute is actually idle, even if the caller stops waiting.
      execution.finally(()=>{this.#executions.delete(execution);}).catch(()=>{});
      const result=await this.waitForResult(execution,controller.signal);
      const envelopeErrors=validateResult(result), outputErrors=('data' in result)?registered.outputs.get(request.capabilityId)!(result.data):[];
      if(envelopeErrors.length||outputErrors.length){
        this.log(request,'output_schema_invalid',{paths:[...envelopeErrors,...outputErrors],operationId:operation?.operationId??null});
        if(operation){const unknown=this.unknown(request,operation.operationId,'OUTPUT_SCHEMA_INVALID',[...envelopeErrors,...outputErrors].join('; '));this.store.updateOperation(operation.operationId,'unknown',unknown,{reason:'invalid output'});return unknown;}
        return failure(request,'OUTPUT_SCHEMA_INVALID',[...envelopeErrors,...outputErrors].join('; '),'failed','never',[...envelopeErrors,...outputErrors]);
      }
      let normalized:CapabilityResult={...result,invocationId:request.invocationId,traceId:request.traceId};
      if(operation){
        const latest=this.store.get<RuntimeOperation>('operations',operation.operationId)!;
        if(['succeeded','failed','partial','cancelled'].includes(latest.state))return operationResult(latest,request);
        const uncertain=result.status==='cancelled'||result.status==='unavailable'||('error' in result&&result.error.retryPolicy==='inspect_only');
        const state:OperationState=result.status==='ok'?'succeeded':result.status==='partial'?'partial':result.status==='pending'?'pending':result.status==='unknown'||uncertain?'unknown':'failed';
        if(uncertain)normalized=this.unknown(request,operation.operationId,'OUTCOME_UNKNOWN','Completion was not established after dispatch; inspect the original operation.');
        normalized={...normalized,operation:{operationId:operation.operationId,state}};
        this.store.updateOperation(operation.operationId,state,normalized,{event:result.status==='pending'?'upstream_receipt':'settled'});
      }
      return normalized;
    } catch(error) {
      if(operation){
        const latest=this.store.get<RuntimeOperation>('operations',operation.operationId)!;
        if(['succeeded','failed','partial','cancelled'].includes(latest.state))return operationResult(latest,request);
        const dispatched=this.store.get<RuntimeOperation>('operations',operation.operationId)?.state!=='queued';
        const result=dispatched?this.unknown(request,operation.operationId,'OUTCOME_UNKNOWN',error instanceof Error?error.message:'Response unavailable'):{...failure(request,'CANCELLED_BEFORE_DISPATCH','Call stopped before dispatch.','cancelled'),operation:{operationId:operation.operationId,state:'cancelled' as const}};
        this.store.updateOperation(operation.operationId,dispatched?'unknown':'cancelled',result);return result;
      }
      return failure(request,controller.signal.aborted?'CALL_ABORTED':'APP_SERVICE_UNAVAILABLE',error instanceof Error?error.message:'Provider unavailable','unavailable','read_retry');
    } finally {if(release){if(providerWork)providerWork.finally(release).catch(()=>{});else release();}clearTimeout(timer);externalSignal?.removeEventListener('abort',cancel);}
  }
  private unknown(request: InvocationRequest, operationId: string, code: string, message: string): CapabilityResult {return {invocationId:request.invocationId,traceId:request.traceId,status:'unknown',operation:{operationId,state:'unknown'},error:{code,message,retryPolicy:'inspect_only'}};}
  private waitForResult(work: Promise<CapabilityResult>, signal: AbortSignal): Promise<CapabilityResult> {
    return new Promise((resolve,reject)=>{
      const aborted=()=>{cleanup();reject(new Error('CALL_ABORTED'));};
      const cleanup=()=>signal.removeEventListener('abort',aborted);
      signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)return aborted();
      work.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
    });
  }
  async inspect(operationId: string, signal?: AbortSignal): Promise<CapabilityResult> {
    const operation=this.store.get<RuntimeOperation>('operations',operationId);
    const identity={invocationId:randomUUID(),traceId:operation?.request.traceId??randomUUID()};
    if(!operation)return failure(identity,'OPERATION_NOT_FOUND','No such operation.');
    const request:InvocationRequest={...operation.request,...identity,source:{kind:'recovery',operationId},deadlineAt:new Date(Date.now()+30000).toISOString()};
    const startedAt=new Date().toISOString();
    this.store.put('invocations',request.invocationId,{invocationId:request.invocationId,requestHash:digest(request),request,state:'received',operationId,startedAt} satisfies InvocationRecord);
    this.store.put('invocation_operations',request.invocationId,{invocationId:request.invocationId,operationId});
    const work=this.inspectExisting(operation,request,signal).then(result=>{
      const row=this.store.get<InvocationRecord>('invocations',request.invocationId)!;
      const durationMs=Date.now()-Date.parse(startedAt);
      this.store.put('invocations',request.invocationId,{...row,state:'settled',result,durationMs});
      this.log(request,'inspect_settled',{operationId,status:result.status,durationMs});return result;
    }).finally(()=>this.#inflight.delete(request.invocationId));
    this.#inflight.set(request.invocationId,work);return work;
  }
  private async inspectExisting(operation:RuntimeOperation,request:InvocationRequest,signal?:AbortSignal):Promise<CapabilityResult>{
    const operationId=operation.operationId,identity={invocationId:request.invocationId,traceId:request.traceId};
    if(operation.state==='queued'||['succeeded','failed','partial','cancelled'].includes(operation.state))return operationResult(operation,request);
    const provider=this.#providers.get(operation.appId), descriptor=this.describe(operation.capabilityId,operation.capabilityVersion);
    if(!provider?.provider.inspect||!descriptor)return this.unknown(request,operationId,'INSPECT_UNSUPPORTED','Provider cannot inspect this existing operation.');
    const controller=new AbortController(), abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const timer=setTimeout(()=>controller.abort(),30000);
    try {
      this.store.appendEvent(operationId,{event:'inspect',invocationId:request.invocationId,traceId:request.traceId});this.log(request,'inspect',{operationId});
      const result=await this.waitForResult(provider.provider.inspect(operationId,{request,signal:controller.signal,operationId}),controller.signal);
      const errors=[...validateResult(result),...('data' in result?provider.outputs.get(operation.capabilityId)!(result.data):[])];
      if(errors.length)return this.unknown(request,operationId,'OUTPUT_SCHEMA_INVALID',errors.join('; '));
      const latest=this.store.get<RuntimeOperation>('operations',operationId)!;
      if(['succeeded','failed','partial','cancelled'].includes(latest.state))return operationResult(latest,request);
      const uncertain=result.status==='unavailable'||result.status==='cancelled'||('error' in result&&result.error.retryPolicy==='inspect_only');
      const next:OperationState=!uncertain&&result.status==='ok'?'succeeded':!uncertain&&result.status==='partial'?'partial':!uncertain&&result.status==='failed'?'failed':latest.state==='pending'?'pending':'unknown';
      const normalized:CapabilityResult=next==='unknown'?this.unknown(request,operationId,'OUTCOME_UNKNOWN','Inspection did not establish business completion.'):{...result,...identity,operation:{operationId,state:next}};
      this.store.updateOperation(operationId,next,normalized,{event:'inspect_result'});return normalized;
    } catch {return this.unknown(request,operationId,'OUTCOME_UNKNOWN','Read-only inspection is unavailable.');}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async recover(): Promise<CapabilityResult[]> {
    const queued=this.store.list<RuntimeOperation>('operations').filter(op=>op.state==='queued');
    for(const op of queued){
      const result:CapabilityResult={...failure(op.request,'CANCELLED_BEFORE_DISPATCH','Process stopped before dispatch intent.','cancelled'),operation:{operationId:op.operationId,state:'cancelled'}};
      this.store.updateOperation(op.operationId,'cancelled',result,{event:'recovered_before_dispatch',dispatched:false});
      const row=this.store.get<InvocationRecord>('invocations',op.request.invocationId);
      if(row)this.store.put('invocations',row.invocationId,{...row,state:'settled',result,durationMs:Date.now()-Date.parse(row.startedAt)});
    }
    const pending=this.store.list<RuntimeOperation>('operations').filter(op=>['dispatching','unknown','pending'].includes(op.state));
    for(const op of pending)if(op.state==='dispatching')this.store.updateOperation(op.operationId,'unknown',this.unknown(op.request,op.operationId,'OUTCOME_UNKNOWN','Process stopped after dispatch intent.'));
    return Promise.all(pending.map(op=>this.inspect(op.operationId)));
  }
  async stopProvider(appId: string): Promise<void> {
    const row=this.#providers.get(appId);if(!row||row.state==='stopped')return;row.state='stopping';
    await Promise.allSettled([...this.#inflight.values()]);
    await Promise.allSettled([...this.#executions]);
    await row.provider.dispose();row.state='stopped';
    for(const descriptor of row.provider.descriptors){this.#capabilities.delete(descriptor.capabilityId);for(const alias of descriptor.aliases)this.#aliases.delete(alias);}
    this.#catalogDigest=undefined;
  }
  private log(request: InvocationRequest, event: string, extra: Record<string, unknown> = {}): void {this.#log({event,at:new Date().toISOString(),traceId:request.traceId,invocationId:request.invocationId,appId:request.appId,connectionId:request.connectionId,capabilityId:request.capabilityId,capabilityVersion:request.capabilityVersion,runId:'runId' in request.source?request.source.runId:null,...extra});}
  async dispose(): Promise<void> {await Promise.all([...this.#providers.keys()].map(appId=>this.stopProvider(appId)));}
}
