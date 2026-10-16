import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {JsonSchema} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {CoreStore,RecordData} from '../../core/src/types.ts';

export const SNAPSHOT_TTL_MS=900000;
export const SNAPSHOT_CACHE_SCHEMA:JsonSchema={type:'object',properties:{ttlMs:{const:SNAPSHOT_TTL_MS},fetchedAt:{type:'string'},expiresAt:{type:'string'},nextRefreshAt:{type:'string'},stale:{type:'boolean'},refreshing:{type:'boolean'}},required:['ttlMs','fetchedAt','expiresAt','nextRefreshAt','stale'],additionalProperties:false};
type Entry={result:ToolResult;expiresAt:number;retryAt?:number;failed?:boolean;failure?:ToolResult};
const flights=new WeakMap<CoreStore,Map<string,Promise<ToolResult>>>();
const record=(value:unknown):RecordData=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
export const snapshotAccessFailure=(code:string)=>/AUTH|PERMISSION|FORBIDDEN|UNAUTHORIZED|STORE_MISMATCH|CONNECTION|IDENTITY|HTTP_40[13]/i.test(code);
export function snapshotGeneration(store:CoreStore,storeId:string):string{return store.get<{generation:string}>('complete_snapshot_authorization',storeId)?.generation??'initial';}
export function invalidateStoreSnapshots(store:CoreStore,storeId:string):void{store.put('complete_snapshot_authorization',storeId,{generation:randomUUID()});}
function denied():ToolResult{return {status:'failed',error:{code:'SNAPSHOT_AUTH_CHANGED',message:'店铺授权状态已变化，请重新读取数据。',retryable:false}};}

/** Persist only complete successes; existing data never waits for a refresh or shares a partial batch. */
export async function readCompleteSnapshot(options:{store:CoreStore;storeId:string;scope:unknown;force:boolean;build:(refresh:boolean)=>Promise<ToolResult>}):Promise<ToolResult>{
 const {store,storeId}=options,generation=snapshotGeneration(store,storeId),key=createHash('sha256').update(canonicalJson({version:1,storeId,generation,scope:options.scope})).digest('hex');
 let pending=flights.get(store);if(!pending){pending=new Map();flights.set(store,pending);}
 const previous=store.get<Entry>('complete_snapshots',key),now=Date.now(),active=pending.get(key);
 const present=(entry:Entry,refreshing=false):ToolResult=>{
  const result=structuredClone(entry.result),data=record(result.data),cache=record(data.cache),stale=entry.failed===true||cache.stale===true||entry.expiresAt<=Date.now();
  data.cache={...cache,ttlMs:SNAPSHOT_TTL_MS,expiresAt:new Date(entry.expiresAt).toISOString(),stale,refreshing,nextRefreshAt:new Date(refreshing?Date.now()+2000:entry.retryAt??entry.expiresAt).toISOString()};
  if(entry.failed)data.warnings=[...new Set([...(Array.isArray(data.warnings)?data.warnings:[]),'暂时保留上次完整快照，稍后后台重试。'])];
  result.data=data;return result;
 };
 const start=():Promise<ToolResult>=>{
  const work=Promise.resolve().then(async()=>{
   let result:ToolResult;try{result=await options.build(!!previous||options.force);}catch(error){const e=error as Error&{code?:string;retryable?:boolean;retryAfterMs?:number};result={status:e.retryable?'unavailable':'failed',error:{code:e.code??'SNAPSHOT_REFRESH_FAILED',message:e.message,retryable:e.retryable===true,...(e.retryAfterMs?{retryAfterMs:e.retryAfterMs}:{})}};}
   if(snapshotGeneration(store,storeId)!==generation)return denied();
   if(result.status!=='ok'){
    if(snapshotAccessFailure(result.error?.code??'')){invalidateStoreSnapshots(store,storeId);return result;}
    if(previous){
     if(result.error?.retryable!==true){store.put('complete_snapshots',key,{...previous,failure:result});return result;}
     store.put('complete_snapshots',key,{...previous,failed:true,retryAt:Date.now()+Math.max(1000,result.error?.retryAfterMs??60000)});return present(store.get<Entry>('complete_snapshots',key)!);
    }
    return result;
   }
   const data=record(result.data),cache=record(data.cache),complete=cache.stale!==true&&!(Array.isArray(data.sourceStates)&&data.sourceStates.some((state:RecordData)=>state.status==='missing'||state.freshness==='stale'));
   const expiresAt=Date.parse(cache.expiresAt) || Date.now()+SNAPSHOT_TTL_MS;
   if(!complete&&previous){store.put('complete_snapshots',key,{...previous,failed:true,retryAt:Math.max(Date.now()+1000,Date.parse(cache.nextRefreshAt)||Date.now()+60000)});return present(store.get<Entry>('complete_snapshots',key)!);}
   const fetchedAt=typeof cache.fetchedAt==='string'?cache.fetchedAt:result.provenance?.fetchedAt??new Date().toISOString();
   data.cache={...cache,ttlMs:SNAPSHOT_TTL_MS,fetchedAt,expiresAt:new Date(expiresAt).toISOString(),nextRefreshAt:cache.nextRefreshAt??new Date(expiresAt).toISOString(),stale:!complete,refreshing:false};result.data=data;
   if(complete)store.put('complete_snapshots',key,{result:structuredClone(result),expiresAt} satisfies Entry);
   return result;
  }).finally(()=>{if(pending!.get(key)===work)pending!.delete(key);});
  pending!.set(key,work);return work;
 };
 if(previous){
  if(active)return present(previous,true);
  if(previous.failure&&!options.force)return structuredClone(previous.failure);
  if((previous.retryAt??0)>now)return present(previous);
  if(options.force||previous.failed||previous.expiresAt<=now){void start().catch(()=>{});return present(previous,true);}
  return present(previous);
 }
 return active??start();
}
