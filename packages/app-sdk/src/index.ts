import { randomUUID } from 'node:crypto';
import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { AppRef, CapabilityDescriptor, CapabilityResult, InvocationRequest, InvocationSource, JsonSchema, JsonValue } from '../../app-contracts/src/index.ts';
export interface RuntimeTransport {
  identity(signal?:AbortSignal): Promise<{transportMajor:number;catalogSchemaVersion:number;catalogDigest:string}>;
  describe(id:string,version?:string): Promise<CapabilityDescriptor|undefined>;
  invoke(request:InvocationRequest,signal?:AbortSignal):Promise<CapabilityResult>;
  inspect(operationId:string,signal?:AbortSignal):Promise<CapabilityResult>;
}
export class AppsClient {
  readonly transport:RuntimeTransport;
  readonly source:InvocationSource;
  readonly options:{traceId?:string;deadlineAt?:string};
  constructor(transport:RuntimeTransport, source:InvocationSource, options:{traceId?:string;deadlineAt?:string}={}) {this.transport=transport;this.source=source;this.options=options;}
  async invoke(ref:AppRef, descriptor:Pick<CapabilityDescriptor,'capabilityId'|'version'|'effect'|'execution'>, input:JsonValue, options:{idempotencyKey?:string;expectedResourceRevision?:string;signal?:AbortSignal;invocationId?:string}={}):Promise<CapabilityResult> {
    const invocationId=options.invocationId??randomUUID(),traceId=this.options.traceId??randomUUID();
    const deadlineAt=this.options.deadlineAt??new Date(Date.now()+descriptor.execution.timeoutMs).toISOString(),remaining=Date.parse(deadlineAt)-Date.now();
    if(!Number.isFinite(remaining))return {invocationId,traceId,status:'failed',error:{code:'INVALID_DEADLINE',message:'An absolute valid deadline is required.',retryPolicy:'never'}};
    const signal=AbortSignal.any([AbortSignal.timeout(Math.max(0,Math.min(remaining,2147483647))),...(options.signal?[options.signal]:[])]);
    if(signal.aborted||remaining<=0)return {invocationId,traceId,status:'cancelled',error:{code:'CANCELLED_BEFORE_DISPATCH',message:'Call cancelled before Runtime dispatch.',retryPolicy:'never'}};
    let identity:Awaited<ReturnType<RuntimeTransport['identity']>>;
    try{identity=await this.transport.identity(signal);}catch{return {invocationId,traceId,status:signal.aborted?'cancelled':'unavailable',error:{code:signal.aborted?'CANCELLED_BEFORE_DISPATCH':'RUNTIME_UNAVAILABLE_BEFORE_DISPATCH',message:'Runtime handshake did not complete; no capability invocation was submitted.',retryPolicy:descriptor.effect==='mutation'?'never':'read_retry'}};}
    if(identity.transportMajor!==1||identity.catalogSchemaVersion!==1)return {invocationId,traceId,status:'failed',error:{code:'INCOMPATIBLE_PROTOCOL',message:`Expected transport 1 and catalog schema 1; received transport ${identity.transportMajor} and catalog schema ${identity.catalogSchemaVersion}.`,retryPolicy:'never',details:{expected:{transportMajor:1,catalogSchemaVersion:1},actual:{transportMajor:identity.transportMajor,catalogSchemaVersion:identity.catalogSchemaVersion}}}};
    if(signal.aborted)return {invocationId,traceId,status:'cancelled',error:{code:'CANCELLED_BEFORE_DISPATCH',message:'Deadline elapsed before capability invocation.',retryPolicy:'never'}};
    const request:InvocationRequest={protocolVersion:'1.0',...ref,invocationId,traceId,capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input,source:this.source,deadlineAt,...(options.idempotencyKey?{idempotencyKey:options.idempotencyKey}:{}),...(options.expectedResourceRevision?{expectedResourceRevision:options.expectedResourceRevision}:{})};
    return this.transport.invoke(request,signal);
  }
}
/** Transport does not retry mutation requests; a lost response retains the original invocation ID. */
export class HttpRuntimeTransport implements RuntimeTransport {
  readonly url:string;
  readonly token:string;
  readonly fetcher:typeof fetch;
  constructor(url:string,token:string,fetcher:typeof fetch=fetch) {
    this.url=url;this.token=token;this.fetcher=fetcher;
    const parsed=new URL(url);if(parsed.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.username||parsed.password||parsed.pathname!=='/')throw new Error('LOOPBACK_RUNTIME_REQUIRED');
  }
  private async read(path:string,body?:unknown,signal?:AbortSignal):Promise<unknown> {
    const bounded=AbortSignal.any([AbortSignal.timeout(90000),...(signal?[signal]:[])]);
    const response=await this.fetcher(new URL(path,this.url),{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${this.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:bounded});
    const value:unknown=await response.json();if(!response.ok)throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:response.status,details:value});return value;
  }
  async identity(signal?:AbortSignal) {return await this.read('/v1/runtime',undefined,signal) as {transportMajor:number;catalogSchemaVersion:number;catalogDigest:string};}
  async describe(id:string,version?:string):Promise<CapabilityDescriptor|undefined> {try{return await this.read(`/v1/capabilities/${encodeURIComponent(id)}${version?`?version=${encodeURIComponent(version)}`:''}`) as CapabilityDescriptor;}catch(error){if((error as {statusCode?:number}).statusCode===404)return undefined;throw error;}}
  async invoke(request:InvocationRequest,signal?:AbortSignal):Promise<CapabilityResult> {
    const remaining=Date.parse(request.deadlineAt)-Date.now(),deadline=Number.isFinite(remaining)?AbortSignal.timeout(Math.max(0,Math.min(remaining,2147483647))):AbortSignal.abort();
    const bounded=AbortSignal.any([deadline,...(signal?[signal]:[])]);
    try{return await this.read('/v1/invocations',request,bounded) as CapabilityResult;}
    catch(error){
      // Read the same attempt record. Never submit another mutation after a lost response.
      if(request.idempotencyKey){
        try{const record=await this.getInvocation(request.invocationId,bounded) as {result?:CapabilityResult;operationId?:string};if(record.result)return record.result;if(record.operationId)return {invocationId:request.invocationId,traceId:request.traceId,status:'unknown',operation:{operationId:record.operationId,state:'unknown'},error:{code:'OUTCOME_UNKNOWN',message:'Read-only inspection is required after losing the response.',retryPolicy:'inspect_only'}};}catch{/* Runtime may still be unavailable. */}
      }
      return {invocationId:request.invocationId,traceId:request.traceId,status:'unavailable',error:{code:'RUNTIME_RESPONSE_UNAVAILABLE',message:request.idempotencyKey?'Resolve the original invocation ID when Runtime returns; mutation resubmission is disabled.':'Runtime response unavailable.',retryPolicy:request.idempotencyKey?'inspect_only':'read_retry',details:{invocationId:request.invocationId,doNotResubmitMutation:!!request.idempotencyKey}}};
    }
  }
  async inspect(operationId:string,signal?:AbortSignal) {return await this.read(`/v1/operations/${encodeURIComponent(operationId)}/inspect`,{},signal) as CapabilityResult;}
  async getInvocation(invocationId:string,signal?:AbortSignal) {return this.read(`/v1/invocations/${encodeURIComponent(invocationId)}`,undefined,signal);}
}
function schemaType(schema:JsonSchema):string {
  if(Array.isArray(schema.enum))return schema.enum.map(item=>JSON.stringify(item)).join(' | ');
  if('const' in schema)return JSON.stringify(schema.const);
  if(Array.isArray(schema.anyOf)||Array.isArray(schema.oneOf))return ((schema.anyOf??schema.oneOf) as JsonSchema[]).map(schemaType).join(' | ');
  if(Array.isArray(schema.allOf))return (schema.allOf as JsonSchema[]).map(schemaType).join(' & ');
  if(Array.isArray(schema.type))return schema.type.map(type=>schemaType({...schema,type})).join(' | ');
  if(schema.type==='array')return `Array<${schemaType((schema.items??{}) as JsonSchema)}>`;
  if(schema.type==='object'){
    const properties=(schema.properties??{}) as Record<string,JsonSchema>, required=(schema.required??[]) as string[];
    const fields=Object.entries(properties).map(([name,item])=>`${JSON.stringify(name)}${required.includes(name)?'':'?'}: ${schemaType(item)}`);
    return schema.additionalProperties===false?`{ ${fields.join('; ')} }`:`({ ${fields.join('; ')} } & { [key: string]: JsonValue })`;
  }
  return schema.type==='integer'?'number':schema.type==='null'?'null':['string','number','boolean'].includes(String(schema.type))?String(schema.type):'JsonValue';
}
/** All three artifacts are generated from the exact same descriptors. */
export function generateArtifacts(descriptors:readonly CapabilityDescriptor[]) {
  const ordered=[...descriptors].sort((a,b)=>a.capabilityId.localeCompare(b.capabilityId));
  const declarations=ordered.map((descriptor,index)=>`export type Input${index} = ${schemaType(descriptor.inputSchema)};\nexport type Output${index} = ${schemaType(descriptor.outputSchema)};\nexport function call${index}(client: AppsClient, ref: AppRef, input: Input${index}, options?: Parameters<AppsClient['invoke']>[3]): Promise<CapabilityResult<Output${index}>> { return client.invoke(ref, catalog[${index}], input as JsonValue, options) as Promise<CapabilityResult<Output${index}>>; }`);
  const source=`// Generated. Do not edit.\nimport { AppsClient } from './index.ts';\nimport type { AppRef, CapabilityResult, JsonValue } from '../../app-contracts/src/index.ts';\nexport const catalog = ${JSON.stringify(ordered,null,2)} as const;\n${declarations.join('\n\n')}\n`;
  const documentation=ordered.map(descriptor=>`### ${descriptor.capabilityId} @ ${descriptor.version}\n\n${descriptor.description}\n\nEffect: ${descriptor.effect}; completion: ${descriptor.execution.completionEvidence}.\n\nInput: \`${canonicalJson(descriptor.inputSchema)}\`\n\nOutput: \`${canonicalJson(descriptor.outputSchema)}\`\n`).join('\n');
  const tools=ordered.map(descriptor=>({name:descriptor.capabilityId,description:descriptor.description,parameters:descriptor.inputSchema,outputSchema:descriptor.outputSchema,version:descriptor.version}));
  return {source,documentation,tools};
}
