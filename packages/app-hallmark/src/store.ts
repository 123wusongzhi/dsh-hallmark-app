import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { CoreStore, RecordData } from '../../core/src/types.ts';
import type { RecordStore } from '../../app-contracts/src/index.ts';

export type ProviderRecordStore = RecordStore;
interface ProviderRecord { appId:string; connectionId:string; namespace:string; recordId:string; configRevision?:number; value:RecordData }
const connectionCaches=new Set(['snapshots','queries','result_sets','settings','internal_tasks','ozon_read_cursors','ozon_weight_queries','ozon_composition_cursors','ozon_composition_snapshots','ozon_composition_sources','ozon_composition_source_results','ozon_composition_cooldowns','complete_snapshots','complete_snapshot_authorization','business_plans','business_executions','business_target_locks','business_review_cache','business_procurement_bindings','business_transport_receipts','business_runtime_operations','business_policies']);

/** Domain evidence lives in provider_records; Runtime operations remain the sole public ledger. */
export class HallmarkStorePort implements CoreStore {
 readonly store:ProviderRecordStore;
 readonly connectionId:string;
 readonly configRevision:number;
 constructor(store:ProviderRecordStore,connectionId:string,configRevision=1){if(!Number.isSafeInteger(configRevision)||configRevision<1)throw new Error('INVALID_CONFIG_REVISION');this.store=store;this.connectionId=connectionId;this.configRevision=configRevision;}
 private id(namespace:string,recordId:string):string{return canonicalJson(['hallmark',this.connectionId,namespace,recordId,...(connectionCaches.has(namespace)&&this.configRevision>1?[this.configRevision]:[])]);}
 get<T=RecordData>(collection:string,id:string):T|undefined{return this.store.get<ProviderRecord>('provider_records',this.id(collection,id))?.value as T|undefined;}
 put<T>(collection:string,id:string,value:T):T {
  canonicalJson(value);
  const rejectCredentials=(item:unknown):void=>{if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){if(['clientid','apikey','ozoncredentials'].includes(key.toLowerCase().replace(/[-_]/g,'')))throw new Error(`CREDENTIAL_FIELD_FORBIDDEN: ${key}`);rejectCredentials(child);}};
  rejectCredentials(value);
  this.store.put('provider_records',this.id(collection,id),{appId:'hallmark',connectionId:this.connectionId,namespace:collection,recordId:id,configRevision:this.configRevision,value});return value;
 }
 list<T=RecordData>(collection:string):T[]{return this.store.list<ProviderRecord>('provider_records').filter(row=>row.appId==='hallmark'&&row.connectionId===this.connectionId&&row.namespace===collection&&(!connectionCaches.has(collection)||(row.configRevision??1)===this.configRevision)).map(row=>row.value as T);}
 transaction<T>(fn:(store:HallmarkStorePort)=>T):T{return this.store.transaction(()=>fn(this));}
 getOperationByClientKey<T=RecordData>(key:string):T|undefined{return this.list<RecordData>('operations').find(row=>row.clientKey===key) as T|undefined;}
 updateSnapshotSuccess(key:string,payload:unknown,dataTime:string|null,metadata:RecordData={}):RecordData {
  return this.transaction(()=>{const previous=this.get('snapshots',key);return this.put('snapshots',key,{...previous,...metadata,datasetKey:key,payload,dataTime,lastSuccessAt:new Date().toISOString(),lastError:null,state:'ready',version:Number(previous?.version??0)+1});});
 }
 updateSnapshotState(key:string,state:'empty'|'refreshing'|'failed',error?:unknown):RecordData {
  return this.transaction(()=>{const previous=this.get('snapshots',key);return this.put('snapshots',key,{...previous,datasetKey:key,state,lastError:error??null,lastSuccessAt:previous?.lastSuccessAt??null,dataTime:previous?.dataTime??null,version:previous?.version??0});});
 }
}

interface BusinessRecord {connectionId:string;scopeId:string;namespace:string;recordId:string;value:unknown;migratedFrom?:{configRevision:number}}
/** Business evidence survives configuration revisions, but never crosses an explicitly named source identity. */
export class StableHallmarkBusinessStore implements CoreStore {
 readonly store:ProviderRecordStore;readonly connectionId:string;readonly scopeId:string;
 constructor(store:ProviderRecordStore,options:{connectionId:string;scopeId:string;legacyConfigRevision?:number}) {
  if(!options.connectionId||!options.scopeId)throw new Error('BUSINESS_SCOPE_REQUIRED');
  this.store=store;this.connectionId=options.connectionId;this.scopeId=options.scopeId;
  const revision=options.legacyConfigRevision;
  if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('INVALID_CONFIG_REVISION');
  if(revision!==undefined)this.store.transaction(()=>{
   const marker=this.id('business_migrations','provider_records');if(this.store.get('provider_records',marker))return;
   // Migrate exactly the explicitly selected old generation. Unresolved requests and locks move together.
   const records=this.store.list<ProviderRecord>('provider_records').filter(row=>row.appId==='hallmark'&&row.connectionId===this.connectionId&&row.namespace.startsWith('business_')&&(row.configRevision??1)===revision);
   for(const row of records){const key=this.id(row.namespace,row.recordId),previous=this.store.get<BusinessRecord>('provider_records',key);if(previous&&canonicalJson(previous.value)!==canonicalJson(row.value))throw new Error('BUSINESS_MIGRATION_CONFLICT');this.store.put('provider_records',key,{appId:'hallmark-business',connectionId:this.connectionId,scopeId:this.scopeId,namespace:row.namespace,recordId:row.recordId,value:row.value,migratedFrom:{configRevision:revision}});}
   this.put('business_migrations','provider_records',{configRevision:revision,connectionId:this.connectionId,scopeId:this.scopeId,recordCount:records.length,at:new Date().toISOString()});
  });
 }
 private id(namespace:string,id:string):string{return canonicalJson(['hallmark-business',this.connectionId,this.scopeId,namespace,id]);}
 get<T=RecordData>(collection:string,id:string):T|undefined{return this.store.get<BusinessRecord>('provider_records',this.id(collection,id))?.value as T|undefined;}
 put<T>(collection:string,id:string,value:T):T {
  if(!collection.startsWith('business_'))throw new Error('BUSINESS_NAMESPACE_REQUIRED');canonicalJson(value);
  const inspect=(data:unknown):void=>{if(data&&typeof data==='object')for(const [key,child]of Object.entries(data)){if(['clientid','apikey','ozoncredentials'].includes(key.toLowerCase().replace(/[-_]/g,'')))throw new Error('CREDENTIAL_FIELD_FORBIDDEN');inspect(child);}};inspect(value);
  this.store.put('provider_records',this.id(collection,id),{appId:'hallmark-business',connectionId:this.connectionId,scopeId:this.scopeId,namespace:collection,recordId:id,value});return value;
 }
 list<T=RecordData>(collection:string):T[]{return this.store.list<BusinessRecord>('provider_records').filter(row=>row.connectionId===this.connectionId&&row.scopeId===this.scopeId&&row.namespace===collection).map(row=>row.value as T);}
 transaction<T>(fn:(store:StableHallmarkBusinessStore)=>T):T{return this.store.transaction(()=>fn(this));}
 getOperationByClientKey<T=RecordData>(key:string):T|undefined{return this.list<RecordData>('business_runtime_operations').find(row=>row.clientKey===key) as T|undefined;}
 updateSnapshotSuccess():RecordData{throw new Error('BUSINESS_STORE_HAS_NO_SNAPSHOTS');}
 updateSnapshotState():RecordData{throw new Error('BUSINESS_STORE_HAS_NO_SNAPSHOTS');}
}
