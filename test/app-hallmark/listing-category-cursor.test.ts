import test from 'node:test';
import assert from 'node:assert/strict';
import {realAncillary,realStores} from '../real-data/corpus.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';

const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
test('category cursor errors give bounded verified restart or explicit missing selection, never guessed scope',async t=>{
 const stores=realStores(),template=realAncillary('ozonCategoryTemplate'),storeId=String(stores[0].id);
 const selection={storeId,descriptionCategoryId:String(template.descriptionCategoryId),typeId:String(template.typeId)};
 const db=new RuntimeStore(':memory:'),runtime=new AppsRuntime(db),port=new HallmarkStorePort(db,'cursor-control');
 let calls=0,serial=0,attributes=structuredClone(template.attributes);
 const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCategoryData:async()=>{calls++;return {status:'ok',raw:{result:structuredClone(attributes)}};}} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:port,client,broker:{} as any}));
 runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Cursor control',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
 const invoke=async(input:any)=>{
  const invocationId=`cursor-${++serial}`;
  const result=await runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId:'hallmark.listing.category.read',capabilityVersion:'1.0.0',input,invocationId,traceId:'cursor-control',source:{kind:'agent',sessionId:'local',nativeCallId:invocationId},deadlineAt:new Date(Date.now()+30000).toISOString()});
  const projected=projectModelResult(db,result);assert.equal(projected.fullResultRef,undefined);return JSON.parse(projected.content);
 };
 try{
  const first=await invoke({...selection,scope:'all',limit:1});assert.equal(first.status,'ok');assert.ok(first.data.continuation);
  const position=JSON.parse(Buffer.from(first.data.continuation.input.cursor,'base64url').toString());
  const malformedOffset={storeId,cursor:encode({...position,offset:-1}),limit:1};
  const failed=await invoke(malformedOffset);
  if(!failed.error.details?.recovery){const repeated=await invoke(malformedOffset);t.diagnostic(`Baseline: two failures=${failed.status==='failed'&&repeated.status==='failed'}, executable recovery absent, category reads=${calls}`);}
  assert.equal(failed.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(failed.error.retryPolicy,'never');
  const recovery=failed.error.details.recovery;assert.equal(recovery.capability,'hallmark.listing.category.read');assert.equal(recovery.input.limit,1);
  attributes=[];await invoke({...selection,refresh:true,scope:'all'});const before=calls;
  const recovered=await invoke(recovery.input);assert.equal(recovered.status,'ok');assert.equal(recovered.data.revision,first.data.revision);assert.deepEqual(recovered.data.attributes,first.data.attributes);assert.equal(calls,before);
  for(const offset of [null,'1',0.5,9007199254740992,template.attributes.length+1]){
   const result=await invoke({storeId,cursor:encode({...position,offset}),limit:1});assert.equal(result.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.deepEqual(result.error.details.recovery,recovery);
  }
  const unavailable=['not-json',encode(null),encode([]),encode(1),encode('x'),encode({}),encode({revision:[],offset:0}),encode({revision:'0'.repeat(64),offset:0}),first.data.continuation.input.cursor+'!',first.data.continuation.input.cursor+'='];
  for(const cursor of unavailable){
   const result=await invoke({storeId,cursor});assert.equal(result.status,'failed');assert.equal(result.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(result.error.retryPolicy,'never');assert.equal(result.error.details.recovery,undefined);
   assert.deepEqual(result.error.details.requiredInput,['descriptionCategoryId','typeId']);assert.ok(!JSON.stringify(result).includes(cursor));assert.ok(Buffer.byteLength(JSON.stringify(result))<2000);
  }
  assert.ok(stores.length>1);
  const wrong=await invoke({storeId:String(stores[1].id),cursor:encode({...position,offset:-1})});assert.equal(wrong.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(wrong.error.details.recovery,undefined);assert.equal(wrong.error.details.selection,undefined);assert.equal(wrong.error.details.revision,undefined);
  const valid=await invoke(first.data.continuation.input);assert.equal(valid.status,'ok');assert.equal(valid.data.page.offset,1);assert.equal(valid.data.revision,first.data.revision);
  assert.equal(calls,before);
  attributes=structuredClone(template.attributes);
  for(const filter of [{scope:'required'},{attributeIds:[String(template.attributes[0].id??template.attributes[0].attribute_id)]}]){
   const narrow=await invoke({...selection,...filter,refresh:true,limit:1});assert.equal(narrow.status,'ok');
   const rejected=await invoke({storeId,cursor:encode({revision:narrow.data.revision,offset:-1}),limit:1});
   const reads=calls,restart=await invoke(rejected.error.details.recovery.input);
   assert.equal(restart.status,'ok');assert.equal(restart.data.scope,narrow.data.scope);assert.equal(restart.data.page.total,narrow.data.page.total);assert.deepEqual(restart.data.attributes,narrow.data.attributes);assert.equal(calls,reads);
  }
  // Simulate loss of the exact saved page rather than inventing expiration semantics.
  for(const record of db.list<any>('provider_records'))if(record.namespace==='business_listing_category_pages'&&record.recordId===position.revision){
   const key=JSON.stringify(['hallmark',record.connectionId,record.namespace,record.recordId]);assert.equal(db.delete('provider_records',key),true);
  }
  const missing=await invoke(first.data.continuation.input);assert.equal(missing.status,'failed');assert.equal(missing.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(missing.error.details.recovery,undefined);
  assert.equal(db.list('operations').length,0);t.diagnostic('Invalid offset: one rejection then one pinned bounded success; zero category rereads for recovery. Missing scope: explicit required inputs, no guessed executable route.');
 }finally{await runtime.dispose();db.close();}
});
