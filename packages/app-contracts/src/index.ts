import { createHash } from 'node:crypto';
export * from './context.ts';
export * from './authoring-ui.ts';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonSchema = { [key: string]: JsonValue };
export type AppId = string;
export type ConnectionId = string;
export type CapabilityId = string;
export interface AppRef { appId: AppId; connectionId: ConnectionId }
export interface ResourceRef extends AppRef { resourceType: string; resourceId: string; revision?: string }
export type InvocationSource =
 | { kind: 'agent'; sessionId: string; nativeCallId: string }
 | { kind: 'script'; sessionId: string; runId: string; stepKey: string }
 | { kind: 'component'; sessionId: string; viewId: string; frameInstanceId: string }
 | { kind: 'scheduler'; scheduleId: string; runId: string }
 | { kind: 'recovery'; operationId: string };
export interface InvocationRequest extends AppRef {
 protocolVersion: '1.0'; invocationId: string; traceId: string; capabilityId: CapabilityId;
 capabilityVersion: string; input: JsonValue; source: InvocationSource; deadlineAt: string;
 idempotencyKey?: string; expectedResourceRevision?: string;
}
export interface ExecutionContext { request: Readonly<InvocationRequest>; signal: AbortSignal; operationId?: string; parentRunId?: string; configRevision?: number }
export type OperationState = 'queued' | 'dispatching' | 'pending' | 'unknown' | 'succeeded' | 'failed' | 'partial' | 'cancelled';
export interface OperationRef { operationId: string; state: OperationState }
export type Freshness = 'fresh' | 'stale' | 'unknown';
export interface DataProvenance extends AppRef {
 sourceKind: 'application' | 'snapshot' | 'derived'; sourceRef: string; fetchedAt: string;
 sourceDataTime: string | null; freshness: Freshness; metricBasis?: string; derivedFrom?: string[];
}
export type RetryPolicy = 'never' | 'read_retry' | 'inspect_only';
export interface FailureInfo { code: string; message: string; retryPolicy: RetryPolicy; retryAfterMs?: number; details?: JsonValue }
export interface ResultBase { invocationId: string; traceId: string; provenance?: DataProvenance[]; operation?: OperationRef }
export type CapabilityResult<T extends JsonValue = JsonValue> = ResultBase & (
 | { status: 'ok'; data: T }
 | { status: 'partial'; data: T; errors: FailureInfo[]; unresolvedOperationIds?: string[] }
 | { status: 'pending'; operation: OperationRef; pollAfterMs: number }
 | { status: 'unknown'; operation: OperationRef; error: FailureInfo }
 | { status: 'failed' | 'unavailable' | 'cancelled'; error: FailureInfo }
 | { status: 'needs_clarification'; missing: string[]; candidates: JsonValue[]; question: string }
);
export interface CapabilityDescriptor {
 capabilityId: CapabilityId; version: string; title: string; description: string;
 effect: 'query' | 'compute' | 'mutation'; inputSchema: JsonSchema; outputSchema: JsonSchema;
 execution: {
  mode: 'sync' | 'async'; timeoutMs: number; concurrency: 'exclusive' | 'declared_safe';
  lockScope: 'connection' | 'resources'; idempotency: 'not_applicable' | 'runtime_dedup' | 'upstream_supported';
  completionEvidence: 'response' | 'readback' | 'upstream_operation';
 };
 discovery: { defaultVisible: boolean; keywords: string[] }; aliases: string[];
 apiOperationId?: string;
}
export interface AppManifest {
 manifestVersion: 1; appId: AppId; displayName: string; providerPackage: string; providerVersion: string;
 runtimeProtocolMajor: 1; resourceTypes: string[];
}
export interface AppProvider {
 manifest: AppManifest; descriptors: readonly CapabilityDescriptor[];
 execute(context: ExecutionContext): Promise<CapabilityResult>;
 inspect?(operationId: string, context: ExecutionContext): Promise<CapabilityResult>;
 dispose(): Promise<void>;
}
export interface SessionAppBinding extends AppRef { sessionId: string; enabled: boolean; boundAt: string }
export interface DatasetBinding extends AppRef {
 bindingId: string; capabilityId: CapabilityId; capabilityMajor: number; input: JsonValue; projection: string[];
 datasetId?: string; refresh: { mode: 'manual' | 'scheduled'; scheduleId?: string };
}
export interface SelectionEnvelope { bindingId: string; datasetRevision: string; resources: ResourceRef[] }
export interface BridgeIdentity { protocolVersion: '2.0'; sessionId: string; viewId: string; buildId: string; frameInstanceId: string }
export interface BridgeRequest extends BridgeIdentity {
 requestId: string; method: 'getData' | 'getContext' | 'refresh' | 'attachSelection' | 'resize' | 'invokeCapability' | 'updateContext' | 'requestAgent'; params: JsonValue;
}
export interface BridgeHello extends BridgeIdentity { supportedMethods: BridgeRequest['method'][]; maxMessageBytes: number; contextRevision: number }
export interface DataPage<T extends JsonValue = JsonValue> {
 datasetId: string; revision: string; items: T[]; returned: number; total: number | null;
 nextCursor: string | null; completeness: 'complete' | 'partial' | 'unknown'; provenance: DataProvenance[];
}
export interface Connection extends AppRef { displayName: string; backendRef: string; enabled: boolean; createdAt: string }
export interface RecordStore {
 get<T=Record<string,unknown>>(collection:string,id:string):T|undefined;
 put<T>(collection:string,id:string,value:T):T;
 list<T=Record<string,unknown>>(collection:string):T[];
 transaction<T>(fn:(store:any)=>T):T;
}
export type ProviderState = 'registered' | 'ready' | 'degraded' | 'stopping' | 'stopped';
export type HostProjectionState = 'detached' | 'attaching' | 'attached' | 'unsupported' | 'failed';
export const PROTOCOL_VERSION = '1.0' as const;
export const CATALOG_SCHEMA_VERSION = 1;

/** Canonical bytes preserve strings and array order. Reject values JSON.stringify would silently lose. */
export function canonicalJson(value: unknown): string {
 const ancestors = new Set<object>();
 function visit(item: unknown, path: string): string {
  if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
  if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
  if (typeof item !== 'object') throw new TypeError(`${path}: expected JSON value`);
  if (ancestors.has(item)) throw new TypeError(`${path}: cyclic JSON value`);
  const proto = Object.getPrototypeOf(item);
  if (Array.isArray(item) ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new TypeError(`${path}: expected plain JSON container`);
  const keys = Reflect.ownKeys(item);
  if (Array.isArray(item)) {
   if (keys.length !== item.length + 1 || item.some((_, i) => !Object.hasOwn(item, i))) throw new TypeError(`${path}: sparse array or extra properties`);
   for (let i=0; i<item.length; i++) if (!Object.hasOwn(item,i)) throw new TypeError(`${path}[${i}]: sparse array`);
  } else if (keys.some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(item,key))) throw new TypeError(`${path}: non-JSON property`);
  ancestors.add(item);
  try {
   if (Array.isArray(item)) return `[${item.map((child,i)=>visit(child,`${path}[${i}]`)).join(',')}]`;
   return `{${Object.keys(item).sort().map(key=>`${JSON.stringify(key)}:${visit((item as Record<string,unknown>)[key],`${path}.${key}`)}`).join(',')}}`;
  } finally { ancestors.delete(item); }
 }
 return visit(value,'$');
}
export function requestHash(request: Pick<InvocationRequest, 'capabilityVersion' | 'input'>): string {
 return createHash('sha256').update(canonicalJson({capabilityVersion:request.capabilityVersion,input:request.input}),'utf8').digest('hex');
}
export interface CanonicalBinding extends AppRef { protocolMajor: number; capabilityId: string; capabilityMajor: number; input: JsonValue; projection: string[] }
export function canonicalBinding(binding: AppRef & { protocolMajor?: number; capabilityId: string; capabilityVersion?: string; capabilityMajor?: number; input: JsonValue; projection?: string[] }): CanonicalBinding {
 return {protocolMajor:binding.protocolMajor??1,appId:binding.appId,connectionId:binding.connectionId,capabilityId:binding.capabilityId,capabilityMajor:binding.capabilityMajor??Number((binding.capabilityVersion??'1').split('.')[0]),input:binding.input,projection:binding.projection??[]};
}
export function datasetId(binding: Parameters<typeof canonicalBinding>[0]): string {
 return `dataset:v1:${createHash('sha256').update(canonicalJson(canonicalBinding(binding)),'utf8').digest('hex')}`;
}

export type SchemaValidator = (value: unknown) => string[];
const schemaKeywords = new Set(['type','properties','required','additionalProperties','items','enum','const','minLength','maxLength','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minItems','maxItems','uniqueItems','minProperties','maxProperties','pattern','format','anyOf','oneOf','allOf','not','title','description','default','$schema','$id','examples']);
const types = new Set(['null','boolean','number','integer','string','array','object']);
const isObject = (value: unknown): value is Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const timestamp = (value: unknown): value is string => typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
/** Compile the supported JSON Schema vocabulary once; unknown keywords fail registration. */
export function compileSchema(schema: JsonSchema): SchemaValidator {
 canonicalJson(schema);
 function compile(node: unknown, path: string): (value: unknown, path:string)=>string[] {
  if (typeof node==='boolean') return (_,valuePath)=>node?[]:[`${valuePath}: disallowed value`];
  if (!isObject(node)) throw new TypeError(`${path}: schema must be an object`);
  for(const key of Object.keys(node)) if(!schemaKeywords.has(key)) throw new TypeError(`${path}.${key}: unsupported schema keyword`);
  const declared=node.type===undefined?[]:Array.isArray(node.type)?node.type:[node.type];
  if(declared.some(type=>typeof type!=='string'||!types.has(type)))throw new TypeError(`${path}.type: unsupported type`);
  if(node.required!==undefined&&(!Array.isArray(node.required)||node.required.some(key=>typeof key!=='string')||new Set(node.required).size!==node.required.length))throw new TypeError(`${path}.required: expected unique string array`);
  for(const key of ['minLength','maxLength','minItems','maxItems','minProperties','maxProperties'])if(node[key]!==undefined&&(!Number.isSafeInteger(node[key])||Number(node[key])<0))throw new TypeError(`${path}.${key}: expected nonnegative integer`);
  for(const key of ['minimum','maximum','exclusiveMinimum','exclusiveMaximum'])if(node[key]!==undefined&&(typeof node[key]!=='number'||!Number.isFinite(node[key])))throw new TypeError(`${path}.${key}: expected finite number`);
  for(const [minimum,maximum] of [['minLength','maxLength'],['minItems','maxItems'],['minProperties','maxProperties'],['minimum','maximum']])if(node[minimum]!==undefined&&node[maximum]!==undefined&&Number(node[minimum])>Number(node[maximum]))throw new TypeError(`${path}: invalid bounds`);
  if(node.enum!==undefined&&(!Array.isArray(node.enum)||!node.enum.length))throw new TypeError(`${path}.enum: expected nonempty array`);
  if(node.properties!==undefined&&!isObject(node.properties))throw new TypeError(`${path}.properties: expected object`);
  if(node.additionalProperties!==undefined&&typeof node.additionalProperties!=='boolean'&&!isObject(node.additionalProperties))throw new TypeError(`${path}.additionalProperties: expected boolean or schema`);
  if(node.uniqueItems!==undefined&&typeof node.uniqueItems!=='boolean')throw new TypeError(`${path}.uniqueItems: expected boolean`);
  const properties=new Map(Object.entries((node.properties??{}) as Record<string,unknown>).map(([key,child])=>[key,compile(child,`${path}.properties.${key}`)]));
  const additional=isObject(node.additionalProperties)?compile(node.additionalProperties,`${path}.additionalProperties`):undefined;
  const items=node.items!==undefined?compile(node.items,`${path}.items`):undefined;
  const alternatives=new Map<string,ReturnType<typeof compile>[]>();
  for(const key of ['anyOf','oneOf','allOf'])if(node[key]!==undefined){if(!Array.isArray(node[key])||!node[key].length)throw new TypeError(`${path}.${key}: expected nonempty schema array`);alternatives.set(key,(node[key] as unknown[]).map((child,index)=>compile(child,`${path}.${key}[${index}]`)));}
  const negated=node.not!==undefined?compile(node.not,`${path}.not`):undefined;
  if(node.pattern!==undefined&&typeof node.pattern!=='string')throw new TypeError(`${path}.pattern: expected string`);
  const pattern=node.pattern!==undefined?new RegExp(node.pattern as string,'u'):undefined;
  if(node.format!==undefined&&!['date-time','uuid','uri'].includes(String(node.format)))throw new TypeError(`${path}.format: unsupported format`);
  const fits=(type:unknown,value:unknown)=>type==='null'?value===null:type==='object'?isObject(value):type==='array'?Array.isArray(value):type==='integer'?typeof value==='number'&&Number.isSafeInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===type;
  return (value,valuePath)=>{
   const errors:string[]=[];
   if(declared.length&&!declared.some(type=>fits(type,value)))return [`${valuePath}: expected ${declared.join('|')}`];
   if(node.enum&&!((node.enum as unknown[]).some(item=>canonicalJson(item)===canonicalJson(value))))errors.push(`${valuePath}: unsupported value`);
   if(Object.hasOwn(node,'const')&&canonicalJson(node.const)!==canonicalJson(value))errors.push(`${valuePath}: expected constant`);
   if(typeof value==='string'){
    const length=Array.from(value).length;
    if(node.minLength!==undefined&&length<Number(node.minLength))errors.push(`${valuePath}: too short`);
    if(node.maxLength!==undefined&&length>Number(node.maxLength))errors.push(`${valuePath}: too long`);
    if(pattern&&!pattern.test(value))errors.push(`${valuePath}: pattern mismatch`);
    if(node.format==='date-time'&&!timestamp(value))errors.push(`${valuePath}: expected timezone ISO timestamp`);
    if(node.format==='uuid'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))errors.push(`${valuePath}: expected UUID`);
    if(node.format==='uri'){try{new URL(value);}catch{errors.push(`${valuePath}: expected absolute URI`);}}
   }
   if(typeof value==='number')for(const [key,compare] of [['minimum',(a:number,b:number)=>a<b],['maximum',(a:number,b:number)=>a>b],['exclusiveMinimum',(a:number,b:number)=>a<=b],['exclusiveMaximum',(a:number,b:number)=>a>=b]] as const)if(node[key]!==undefined&&compare(value,Number(node[key])))errors.push(`${valuePath}: violates ${key}`);
   if(Array.isArray(value)){
    if(node.minItems!==undefined&&value.length<Number(node.minItems))errors.push(`${valuePath}: too few items`);
    if(node.maxItems!==undefined&&value.length>Number(node.maxItems))errors.push(`${valuePath}: too many items`);
    if(node.uniqueItems&&new Set(value.map(canonicalJson)).size!==value.length)errors.push(`${valuePath}: duplicate items`);
    if(items)value.forEach((item,index)=>errors.push(...items(item,`${valuePath}[${index}]`)));
   }
   if(isObject(value)){
    for(const key of (node.required??[]) as string[])if(!Object.hasOwn(value,key))errors.push(`${valuePath}.${key}: required`);
    for(const [key,item] of Object.entries(value)){const validator=properties.get(key);if(validator)errors.push(...validator(item,`${valuePath}.${key}`));else if(node.additionalProperties===false)errors.push(`${valuePath}.${key}: unknown field`);else if(additional)errors.push(...additional(item,`${valuePath}.${key}`));}
    if(node.minProperties!==undefined&&Object.keys(value).length<Number(node.minProperties))errors.push(`${valuePath}: too few properties`);
    if(node.maxProperties!==undefined&&Object.keys(value).length>Number(node.maxProperties))errors.push(`${valuePath}: too many properties`);
   }
   for(const [key,validators] of alternatives){const matches=validators.map(validator=>validator(value,valuePath));if(key==='allOf')errors.push(...matches.flat());else if(key==='anyOf'&&!matches.some(result=>result.length===0)||key==='oneOf'&&matches.filter(result=>result.length===0).length!==1)errors.push(`${valuePath}: does not match ${key}`, ...matches.flat());}
   if(negated&&!negated(value,valuePath).length)errors.push(`${valuePath}: matches forbidden schema`);
   return errors;
  };
 }
 const check=compile(schema,'$schema');
 return value=>{try{canonicalJson(value);return check(value,'$');}catch(error){return [error instanceof Error?error.message:String(error)];}};
}

const stringSchema:JsonSchema={type:'string',minLength:1};
const sourceSchema:JsonSchema={oneOf:[
 {type:'object',properties:{kind:{const:'agent'},sessionId:stringSchema,nativeCallId:stringSchema},required:['kind','sessionId','nativeCallId'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'script'},sessionId:stringSchema,runId:stringSchema,stepKey:stringSchema},required:['kind','sessionId','runId','stepKey'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'component'},sessionId:stringSchema,viewId:stringSchema,frameInstanceId:stringSchema},required:['kind','sessionId','viewId','frameInstanceId'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'scheduler'},scheduleId:stringSchema,runId:stringSchema},required:['kind','scheduleId','runId'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'recovery'},operationId:stringSchema},required:['kind','operationId'],additionalProperties:false},
]};
export const invocationSchema:JsonSchema={type:'object',properties:{protocolVersion:{const:'1.0'},invocationId:stringSchema,traceId:stringSchema,appId:{type:'string',pattern:'^[a-z][a-z0-9-]{1,63}$'},connectionId:stringSchema,capabilityId:{type:'string',pattern:'^[a-z][a-z0-9-]*(?:\\.[a-zA-Z0-9_-]+)+$'},capabilityVersion:{type:'string',pattern:'^[0-9]+\\.[0-9]+\\.[0-9]+$'},input:{},source:sourceSchema,deadlineAt:{type:'string',format:'date-time'},idempotencyKey:stringSchema,expectedResourceRevision:stringSchema},required:['protocolVersion','invocationId','traceId','appId','connectionId','capabilityId','capabilityVersion','input','source','deadlineAt'],additionalProperties:false};
const invocationValidator=compileSchema(invocationSchema);
export function validateInvocation(value:unknown,descriptor?:CapabilityDescriptor):string[]{
 const errors=invocationValidator(value);if(errors.length||!isObject(value))return errors;
 if(descriptor){if(value.capabilityId!==descriptor.capabilityId)errors.push('$.capabilityId: descriptor mismatch');if(value.capabilityVersion!==descriptor.version)errors.push('$.capabilityVersion: exact version required');if(descriptor.effect==='mutation'&&(typeof value.idempotencyKey!=='string'||!value.idempotencyKey))errors.push('$.idempotencyKey: required for mutation');errors.push(...compileSchema(descriptor.inputSchema)(value.input).map(error=>error.replace(/^\$/,'$.input')));}
 return errors;
}
const errorSchema:JsonSchema={type:'object',properties:{code:stringSchema,message:stringSchema,retryPolicy:{enum:['never','read_retry','inspect_only']},retryAfterMs:{type:'integer',minimum:0},details:{}},required:['code','message','retryPolicy'],additionalProperties:false};
const operationSchema:JsonSchema={type:'object',properties:{operationId:stringSchema,state:{enum:['queued','dispatching','pending','unknown','succeeded','failed','partial','cancelled']}},required:['operationId','state'],additionalProperties:false};
const provenanceSchema:JsonSchema={type:'object',properties:{appId:stringSchema,connectionId:stringSchema,sourceKind:{enum:['application','snapshot','derived']},sourceRef:stringSchema,fetchedAt:{type:'string',format:'date-time'},sourceDataTime:{anyOf:[{type:'null'},{type:'string',format:'date-time'}]},freshness:{enum:['fresh','stale','unknown']},metricBasis:stringSchema,derivedFrom:{type:'array',items:stringSchema}},required:['appId','connectionId','sourceKind','sourceRef','fetchedAt','sourceDataTime','freshness'],additionalProperties:false};
const baseResultProperties={invocationId:stringSchema,traceId:stringSchema,operation:operationSchema,provenance:{type:'array',items:provenanceSchema} as JsonSchema};
export function validateResult(value:unknown,output?:JsonSchema|CapabilityDescriptor):string[]{
 if(!isObject(value))return ['$: expected result object'];
 const status=value.status;const properties:Record<string,JsonSchema>={...baseResultProperties,status:{enum:['ok','partial','pending','unknown','failed','unavailable','cancelled','needs_clarification']}};const required=['invocationId','traceId','status'];
 if(status==='ok'||status==='partial'){properties.data={};required.push('data');if(status==='partial'){properties.errors={type:'array',items:errorSchema,minItems:1};properties.unresolvedOperationIds={type:'array',items:stringSchema};required.push('errors');}}
 else if(status==='pending'){properties.pollAfterMs={type:'integer',minimum:0};required.push('operation','pollAfterMs');}
 else if(status==='unknown'||status==='failed'||status==='unavailable'||status==='cancelled'){properties.error=errorSchema;required.push('error');if(status==='unknown')required.push('operation');}
 else if(status==='needs_clarification'){properties.missing={type:'array',items:stringSchema,minItems:1};properties.candidates={type:'array',items:{}};properties.question=stringSchema;required.push('missing','candidates','question');}
 const errors=compileSchema({type:'object',properties,required,additionalProperties:false})(value);
 if(status==='unknown'&&isObject(value.error)&&value.error.retryPolicy!=='inspect_only')errors.push('$.error.retryPolicy: unknown requires inspect_only');
 if((status==='ok'||status==='partial')&&output){const schema='outputSchema' in output?(output as CapabilityDescriptor).outputSchema:output as JsonSchema;errors.push(...compileSchema(schema)(value.data).map(error=>error.replace(/^\$/,'$.data')));}
 return errors;
}
export function validateCapability(descriptor:unknown):string[]{
 const descriptorSchema:JsonSchema={type:'object',properties:{capabilityId:{type:'string',pattern:'^[a-z][a-z0-9-]*(?:\\.[a-zA-Z0-9_-]+)+$'},version:{type:'string',pattern:'^[0-9]+\\.[0-9]+\\.[0-9]+$'},title:stringSchema,description:stringSchema,effect:{enum:['query','compute','mutation']},inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{type:'object',properties:{mode:{enum:['sync','async']},timeoutMs:{type:'integer',minimum:1},concurrency:{enum:['exclusive','declared_safe']},lockScope:{enum:['connection','resources']},idempotency:{enum:['not_applicable','runtime_dedup','upstream_supported']},completionEvidence:{enum:['response','readback','upstream_operation']}},required:['mode','timeoutMs','concurrency','lockScope','idempotency','completionEvidence'],additionalProperties:false},discovery:{type:'object',properties:{defaultVisible:{type:'boolean'},keywords:{type:'array',items:stringSchema,uniqueItems:true}},required:['defaultVisible','keywords'],additionalProperties:false},aliases:{type:'array',items:stringSchema,uniqueItems:true},apiOperationId:stringSchema},required:['capabilityId','version','title','description','effect','inputSchema','outputSchema','execution','discovery','aliases'],additionalProperties:false};
 const errors=compileSchema(descriptorSchema)(descriptor);
 if(!isObject(descriptor))return errors;
 if(descriptor.effect==='mutation'&&isObject(descriptor.execution)&&descriptor.execution.idempotency==='not_applicable')errors.push('$.execution.idempotency: mutations require deduplication');
 for(const key of ['inputSchema','outputSchema'] as const){if(!isObject(descriptor[key]))continue;try{compileSchema(descriptor[key] as JsonSchema);}catch(error){errors.push(`$.${key}: ${error instanceof Error?error.message:String(error)}`);}}
 return errors;
}
export const validateCapabilityDescriptor=validateCapability;
export const validateDescriptor=validateCapability;
export function validateManifest(manifest:unknown):string[]{return compileSchema({type:'object',properties:{manifestVersion:{const:1},appId:{type:'string',pattern:'^[a-z][a-z0-9-]{1,63}$'},displayName:stringSchema,providerPackage:stringSchema,providerVersion:{type:'string',pattern:'^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$'},runtimeProtocolMajor:{const:1},resourceTypes:{type:'array',items:stringSchema,uniqueItems:true}},required:['manifestVersion','appId','displayName','providerPackage','providerVersion','runtimeProtocolMajor','resourceTypes'],additionalProperties:false})(manifest);}
export function compileCapability(descriptor:CapabilityDescriptor):{input:SchemaValidator;output:SchemaValidator}{const errors=validateCapability(descriptor);if(errors.length)throw new TypeError(errors.join('; '));return {input:compileSchema(descriptor.inputSchema),output:compileSchema(descriptor.outputSchema)};}
