import { randomUUID } from 'node:crypto';
import { canonicalJson, requestHash, validateInvocation, validateResult } from '../../app-contracts/src/index.ts';
import type { AppProvider, AppRef, CapabilityDescriptor, CapabilityResult, ExecutionContext, JsonSchema, JsonValue, ResourceRef, DataProvenance, RecordStore } from '../../app-contracts/src/index.ts';

export interface Note { id:string;title:string;content:string;revision:string;createdAt:string;updatedAt:string }
interface NoteRecord { appId:'notes';connectionId:string;namespace:'notes'|'operations';recordId:string;value:Note|NoteEvidence }
interface NoteEvidence { operationId:string;requestHash:string;result:CapabilityResult }
const text:JsonSchema={type:'string',minLength:1,maxLength:4000};
const content:JsonSchema={type:'string',maxLength:1000000};
const noteSchema:JsonSchema={type:'object',properties:{id:text,title:text,content,revision:{type:'string',pattern:'^[1-9][0-9]*$'},createdAt:{type:'string',format:'date-time'},updatedAt:{type:'string',format:'date-time'}},required:['id','title','content','revision','createdAt','updatedAt'],additionalProperties:false};
const resourceSchema:JsonSchema={type:'object',properties:{appId:{const:'notes'},connectionId:text,resourceType:{const:'note'},resourceId:text,revision:text},required:['appId','connectionId','resourceType','resourceId','revision'],additionalProperties:false};
const noteOutput:JsonSchema={type:'object',properties:{note:noteSchema,resource:resourceSchema},required:['note','resource'],additionalProperties:false};
function descriptor(action:string,inputSchema:JsonSchema,outputSchema:JsonSchema,mutation=false):CapabilityDescriptor{return {capabilityId:`notes.notes.${action}`,version:'1.0.0',title:`Notes ${action}`,description:`${action} 本地 Notes 原始笔记；按精确连接与资源身份执行。`,effect:mutation?'mutation':'query',inputSchema,outputSchema,execution:{mode:'sync',timeoutMs:10000,concurrency:mutation?'exclusive':'declared_safe',lockScope:'connection',idempotency:mutation?'runtime_dedup':'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:action==='list',keywords:['notes',action]},aliases:[]};}
export const NOTES_DESCRIPTORS:readonly CapabilityDescriptor[]=[
 descriptor('list',{type:'object',properties:{query:{type:'string',maxLength:4000},cursor:{type:'string',pattern:'^(0|[1-9][0-9]*)$'},limit:{type:'integer',minimum:1,maximum:200}},additionalProperties:false},{type:'object',properties:{items:{type:'array',items:noteOutput},total:{type:'integer',minimum:0},returned:{type:'integer',minimum:0},nextCursor:{type:['string','null']},completeness:{enum:['complete','partial']}},required:['items','total','returned','nextCursor','completeness'],additionalProperties:false}),
 descriptor('get',{type:'object',properties:{id:text},required:['id'],additionalProperties:false},noteOutput),
 descriptor('create',{type:'object',properties:{id:text,title:text,content},required:['title','content'],additionalProperties:false},noteOutput,true),
 descriptor('update',{type:'object',properties:{id:text,title:text,content},required:['id'],anyOf:[{required:['title']},{required:['content']}],additionalProperties:false},noteOutput,true),
];
export interface NotesProviderOptions { store:RecordStore }

/** This minimal application owns notes in its namespace; other apps never infer product fields. */
export class NotesProvider implements AppProvider {
 readonly manifest={manifestVersion:1 as const,appId:'notes',displayName:'Notes',providerPackage:'app-notes',providerVersion:'1.0.0',runtimeProtocolMajor:1 as const,resourceTypes:['note']};
 readonly descriptors=NOTES_DESCRIPTORS;
 readonly store:RecordStore;
 constructor(options:NotesProviderOptions){this.store=options.store;}
 private key(connectionId:string,namespace:string,id:string):string{return canonicalJson(['notes',connectionId,namespace,id]);}
 private note(connectionId:string,id:string):Note|undefined{return this.store.get<NoteRecord>('provider_records',this.key(connectionId,'notes',id))?.value as Note|undefined;}
 private put(connectionId:string,namespace:'notes'|'operations',id:string,value:Note|NoteEvidence):void{this.store.put('provider_records',this.key(connectionId,namespace,id),{appId:'notes',connectionId,namespace,recordId:id,value});}
 private resource(connectionId:string,note:Note):ResourceRef{return {appId:'notes',connectionId,resourceType:'note',resourceId:note.id,revision:note.revision};}
 private provenance(connectionId:string,updatedAt:string|null):DataProvenance[]{return [{appId:'notes',connectionId,sourceKind:'application',sourceRef:'local:notes',fetchedAt:new Date().toISOString(),sourceDataTime:updatedAt,freshness:'fresh'}];}
 private failure(context:ExecutionContext,code:string,message:string):CapabilityResult{return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'failed',...(context.operationId?{operation:{operationId:context.operationId,state:'failed' as const}}:{}),error:{code,message,retryPolicy:'never'}};}
 async execute(context:ExecutionContext):Promise<CapabilityResult>{
  const request=context.request,descriptor=this.descriptors.find(row=>row.capabilityId===request.capabilityId&&row.version===request.capabilityVersion);
  if(request.appId!=='notes'||!descriptor)return this.failure(context,'CAPABILITY_NOT_FOUND','Notes 能力或精确版本未登记。');
  const errors=validateInvocation(request,descriptor);if(errors.length)return this.failure(context,'INPUT_SCHEMA_INVALID',errors.join('; '));
  if(context.signal.aborted)return {invocationId:request.invocationId,traceId:request.traceId,status:'cancelled',error:{code:'ABORTED',message:'尚未执行 Notes 变更。',retryPolicy:'never'}};
  const input=request.input as Record<string,JsonValue>,connectionId=request.connectionId,base={invocationId:request.invocationId,traceId:request.traceId},action=request.capabilityId.split('.').at(-1)!;
  if(descriptor.effect==='mutation'&&!context.operationId)return this.failure(context,'OPERATION_ID_REQUIRED','Notes 变更必须先由 Runtime 持久化操作身份。');
  const result=this.store.transaction(()=>{
   if(action==='list'){
    const all=this.store.list<NoteRecord>('provider_records').filter(row=>row.appId==='notes'&&row.connectionId===connectionId&&row.namespace==='notes').map(row=>row.value as Note).filter(note=>typeof input.query!=='string'||`${note.title}\n${note.content}`.includes(input.query)).sort((a,b)=>a.id.localeCompare(b.id)),offset=Number(input.cursor??0),limit=Number(input.limit??100);
    if(!Number.isSafeInteger(offset))return this.failure(context,'INVALID_CURSOR','Notes cursor 超过有效整数范围。');
    const items=all.slice(offset,offset+limit).map(note=>({note,resource:this.resource(connectionId,note)}));
    return {...base,status:'ok' as const,data:{items,total:all.length,returned:items.length,nextCursor:offset+items.length<all.length?String(offset+items.length):null,completeness:offset===0&&items.length===all.length?'complete':'partial'},provenance:this.provenance(connectionId,all.map(note=>note.updatedAt).sort().at(-1)??null)};
   }
   if(action==='get'){const note=this.note(connectionId,String(input.id));return note?{...base,status:'ok' as const,data:{note,resource:this.resource(connectionId,note)},provenance:this.provenance(connectionId,note.updatedAt)}:this.failure(context,'RESOURCE_NOT_FOUND','该连接没有指定笔记。');}
   const hash=requestHash({capabilityVersion:request.capabilityVersion,input:{input:request.input,expectedResourceRevision:request.expectedResourceRevision??null}}),evidence=this.store.get<NoteRecord>('provider_records',this.key(connectionId,'operations',context.operationId!))?.value as NoteEvidence|undefined;
   if(evidence)return evidence.requestHash===hash?{...evidence.result,...base}:this.failure(context,'IDEMPOTENCY_CONFLICT','同一操作身份不能改变请求。');
   const id=typeof input.id==='string'?input.id:randomUUID(),previous=this.note(connectionId,id),at=new Date().toISOString();
   let output:CapabilityResult;
   if(action==='create'&&previous)output=this.failure(context,'REVISION_CONFLICT','指定资源 ID 已存在。');
   else if(action==='update'&&!previous)output=this.failure(context,'RESOURCE_NOT_FOUND','该连接没有指定笔记。');
   else if(action==='update'&&!request.expectedResourceRevision)output={...base,status:'needs_clarification',missing:['expectedResourceRevision'],candidates:[],question:'请先读取笔记，并提供当时的 revision。'};
   else if(action==='update'&&request.expectedResourceRevision!==previous!.revision)output=this.failure(context,'REVISION_CONFLICT','笔记已更新，请重新读取后修改。');
   else{
    const note:Note={id,title:typeof input.title==='string'?input.title:previous!.title,content:typeof input.content==='string'?input.content:previous!.content,revision:String(Number(previous?.revision??0)+1),createdAt:previous?.createdAt??at,updatedAt:at};
    this.put(connectionId,'notes',id,note);
    output={...base,status:'ok',data:{note:note as unknown as JsonValue,resource:this.resource(connectionId,note) as unknown as JsonValue},operation:{operationId:context.operationId!,state:'succeeded'},provenance:this.provenance(connectionId,note.updatedAt)};
   }
   this.put(connectionId,'operations',context.operationId!,{operationId:context.operationId!,requestHash:hash,result:output});return output;
  }) as CapabilityResult;
  const invalid=validateResult(result,descriptor.outputSchema);return invalid.length?this.failure(context,'OUTPUT_SCHEMA_INVALID',invalid.join('; ')):result;
 }
 async inspect(operationId:string,context:ExecutionContext):Promise<CapabilityResult>{
  const evidence=this.store.get<NoteRecord>('provider_records',this.key(context.request.connectionId,'operations',operationId))?.value as NoteEvidence|undefined;
  return evidence?{...evidence.result,invocationId:context.request.invocationId,traceId:context.request.traceId}:this.failure(context,'OPERATION_NOT_FOUND','没有该连接 Notes 操作的完成证据；不会重新执行写入。');
 }
 async dispose():Promise<void>{}
}

export function resolveNotesResources(binding:AppRef,result:CapabilityResult):ResourceRef[]{
 if(binding.appId!=='notes'||!('data' in result)||!result.data||typeof result.data!=='object'||Array.isArray(result.data))return [];
 const data=result.data as Record<string,JsonValue>,rows=Array.isArray(data.items)?data.items:[data];
 return rows.flatMap(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))return [];
  const resource=row.resource;
  if(!resource||typeof resource!=='object'||Array.isArray(resource)||resource.appId!=='notes'||resource.connectionId!==binding.connectionId||resource.resourceType!=='note'||typeof resource.resourceId!=='string')return [];
  return [{appId:'notes',connectionId:binding.connectionId,resourceType:'note',resourceId:resource.resourceId,...(typeof resource.revision==='string'?{revision:resource.revision}:{})}];
 });
}
export const notesResources=resolveNotesResources;
