import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort,StableHallmarkBusinessStore} from '../../packages/app-hallmark/src/store.ts';

test('business drafts, receipts and cost bindings cannot cross a changed backend connection',()=>{
 const database=new RuntimeStore(':memory:');
 try{
  const original=new HallmarkStorePort(database,'bill',1),changed=new HallmarkStorePort(database,'bill',2);
  for(const collection of ['business_plans','business_executions','business_target_locks','business_review_cache','business_procurement_bindings','business_transport_receipts','business_runtime_operations','business_policies']){
   original.put(collection,'same-id',{backend:'original'});
   assert.equal(changed.get(collection,'same-id'),undefined);
   assert.deepEqual(changed.list(collection),[]);
   changed.put(collection,'same-id',{backend:'changed'});
   assert.deepEqual(original.get(collection,'same-id'),{backend:'original'});
  }
 }finally{database.close();}
});

test('explicit business migration keeps every current-generation ledger and unresolved lock across revisions',()=>{
 const database=new RuntimeStore(':memory:');try{
  const old=new HallmarkStorePort(database,'bill',3),other=new HallmarkStorePort(database,'bill',2);
  const names=['business_plans','business_executions','business_target_locks','business_review_cache','business_procurement_bindings','business_transport_receipts','business_runtime_operations','business_policies','business_assets','business_future_ledger'];
  for(const namespace of names){old.put(namespace,'id',{generation:3,status:'unknown',active:true,taskId:'original-task'});other.put(namespace,'other',{generation:2});}
  const independent=new StableHallmarkBusinessStore(database,{connectionId:'bill',scopeId:'original-source-identity',legacyConfigRevision:3});
  for(const namespace of names){assert.equal(independent.list(namespace).length,1);assert.equal(independent.get(namespace,'id')?.taskId,'original-task');assert.equal(independent.get(namespace,'other'),undefined);}
  independent.put('business_plans','new',{status:'draft'});
  const restarted=new StableHallmarkBusinessStore(database,{connectionId:'bill',scopeId:'original-source-identity',legacyConfigRevision:4});
  assert.equal(restarted.get('business_plans','new')?.status,'draft');assert.equal(restarted.get('business_target_locks','id')?.active,true);
  assert.equal(restarted.get('business_migrations','provider_records')?.configRevision,3);
  const foreign=new StableHallmarkBusinessStore(database,{connectionId:'bill',scopeId:'different-source',legacyConfigRevision:4});assert.equal(foreign.get('business_plans','id'),undefined);assert.equal(foreign.get('business_plans','new'),undefined);
  assert.equal(old.get('business_plans','id')?.generation,3,'migration preserves original evidence');
 }finally{database.close();}
});

test('business storage rejects credentials and migration conflicts atomically',()=>{
 const database=new RuntimeStore(':memory:');try{
  const business=new StableHallmarkBusinessStore(database,{connectionId:'bill',scopeId:'source'});
  assert.throws(()=>business.put('business_plans','bad',{nested:{api_key:'secret'}}),/CREDENTIAL_FIELD_FORBIDDEN/);
  business.put('business_plans','collision',{version:'new'});new HallmarkStorePort(database,'bill',1).put('business_plans','collision',{version:'old'});
  assert.throws(()=>new StableHallmarkBusinessStore(database,{connectionId:'bill',scopeId:'source',legacyConfigRevision:1}),/BUSINESS_MIGRATION_CONFLICT/);
  assert.equal(business.get('business_migrations','provider_records'),undefined);assert.equal(business.get('business_plans','collision')?.version,'new');
 }finally{database.close();}
});
