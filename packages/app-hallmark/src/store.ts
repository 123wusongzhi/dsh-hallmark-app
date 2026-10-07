import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { CoreStore, RecordData } from '../../core/src/types.ts';
import type { RecordStore } from '../../app-contracts/src/index.ts';

export type ProviderRecordStore = RecordStore;
interface ProviderRecord { appId:string; connectionId:string; namespace:string; recordId:string; value:RecordData }

/** Domain evidence lives in provider_records; Runtime operations remain the sole public ledger. */
export class HallmarkStorePort implements CoreStore {
 readonly store:ProviderRecordStore;
 readonly connectionId:string;
 constructor(store:ProviderRecordStore,connectionId:string){this.store=store;this.connectionId=connectionId;}
 private id(namespace:string,recordId:string):string{return canonicalJson(['hallmark',this.connectionId,namespace,recordId]);}
 get<T=RecordData>(collection:string,id:string):T|undefined{return this.store.get<ProviderRecord>('provider_records',this.id(collection,id))?.value as T|undefined;}
 put<T>(collection:string,id:string,value:T):T {
  canonicalJson(value);
  const rejectCredentials=(item:unknown):void=>{if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){if(['clientid','apikey','ozoncredentials'].includes(key.toLowerCase().replace(/[-_]/g,'')))throw new Error(`CREDENTIAL_FIELD_FORBIDDEN: ${key}`);rejectCredentials(child);}};
  rejectCredentials(value);
  this.store.put('provider_records',this.id(collection,id),{appId:'hallmark',connectionId:this.connectionId,namespace:collection,recordId:id,value});return value;
 }
 list<T=RecordData>(collection:string):T[]{return this.store.list<ProviderRecord>('provider_records').filter(row=>row.appId==='hallmark'&&row.connectionId===this.connectionId&&row.namespace===collection).map(row=>row.value as T);}
 transaction<T>(fn:(store:HallmarkStorePort)=>T):T{return this.store.transaction(()=>fn(this));}
 getOperationByClientKey<T=RecordData>(key:string):T|undefined{return this.list<RecordData>('operations').find(row=>row.clientKey===key) as T|undefined;}
 updateSnapshotSuccess(key:string,payload:unknown,dataTime:string|null,metadata:RecordData={}):RecordData {
  return this.transaction(()=>{const previous=this.get('snapshots',key);return this.put('snapshots',key,{...previous,...metadata,datasetKey:key,payload,dataTime,lastSuccessAt:new Date().toISOString(),lastError:null,state:'ready',version:Number(previous?.version??0)+1});});
 }
 updateSnapshotState(key:string,state:'empty'|'refreshing'|'failed',error?:unknown):RecordData {
  return this.transaction(()=>{const previous=this.get('snapshots',key);return this.put('snapshots',key,{...previous,datasetKey:key,state,lastError:error??null,lastSuccessAt:previous?.lastSuccessAt??null,dataTime:previous?.dataTime??null,version:previous?.version??0});});
 }
}
