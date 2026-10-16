import test from 'node:test';
import assert from 'node:assert/strict';
import {realAncillary,realStores} from '../real-data/corpus.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

test('ordinary category reads recover after a transient failure and then reuse the recovered recorded constraints',async t=>{
  const stores=realStores(),template=realAncillary('ozonCategoryTemplate');
  assert.ok(stores.length,'A recorded store is required');
  const storeId=String(stores[0].id),required=template.attributes.filter((attribute:any)=>attribute.is_required===true||attribute.required===true);
  assert.ok(required.length>0,'The recorded category must contain required constraints');
  // The identical three first-page reads omit refresh. Pagination follows actual emitted hints.
  const selection={storeId,descriptionCategoryId:String(template.descriptionCategoryId),typeId:String(template.typeId)},input={...selection,limit:1};
  const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'category-retry-control'),runtime=new AppsRuntime(db);
  let attempts=0,serial=0;
  // Only the temporary transport failure is synthetic; recovered constraints are recorded facts.
  const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCategoryData:async(request:any)=>{
    assert.deepEqual(request,{mode:'template',...selection});attempts++;
    if(attempts===1)return {status:'unavailable',error:{code:'CONTROL_TEMPORARY',message:'Local transient read control',retryable:true}};
    return {status:'ok',raw:{result:structuredClone(template.attributes)}};
  }} as unknown as CoreClient;
  runtime.register(new HallmarkProvider({store:port,client,broker:{} as any}));
  runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Category retry control',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const invoke=async(args:JsonValue)=>{
    const invocationId=`category-read-${++serial}`;
    const result=await runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId:'hallmark.listing.category.read',capabilityVersion:'1.0.0',input:args,invocationId,traceId:'category-retry-control',source:{kind:'agent',sessionId:'local',nativeCallId:invocationId},deadlineAt:new Date(Date.now()+30000).toISOString()});
    assert.equal(result.status,'ok',JSON.stringify(result));
    const projection=projectModelResult(db,result);assert.equal(projection.fullResultRef,undefined);
    return JSON.parse(projection.content).data;
  };
  const read=async()=>{
    const first=await invoke(input),attributes:any[]=[],pages:any[]=[first];
    if(first.status!=='selected')return {first,attributes,pages};
    let page=first;const seenCursors=new Set<string>();
    for(;;){
      assert.equal(page.status,'selected');assert.equal(page.page.total,required.length);
      assert.equal(page.page.offset,attributes.length);assert.equal(page.page.returned,page.attributes.length);
      attributes.push(...page.attributes);
      if(!page.continuation){assert.equal(page.page.nextCursor,null);break;}
      assert.ok(page.attributes.length>0,'each nonterminal page must advance');
      assert.ok(attributes.length<required.length,'continuation must end with the recorded constraints');
      assert.equal(page.continuation.capability,'hallmark.listing.category.read');
      const cursor=page.continuation.input.cursor;
      assert.equal(cursor,page.page.nextCursor);assert.equal(seenCursors.has(cursor),false,'continuation must not repeat');seenCursors.add(cursor);
      page=await invoke(page.continuation.input);pages.push(page);
    }
    return {first,attributes,pages};
  };
  try{
    const failed=await read();assert.equal(failed.first.status,'unavailable');assert.equal(failed.first.error.code,'CONTROL_TEMPORARY');assert.equal(attempts,1);
    const recovered=await read();
    assert.equal(recovered.first.status,'selected','normal retry must reread after a transient failure without requiring refresh:true');assert.equal(attempts,2);
    const constraint=(attribute:any)=>({id:attribute.id??attribute.attribute_id,name:attribute.name,is_required:attribute.is_required,required:attribute.required});
    assert.deepEqual(recovered.attributes.map(constraint),required.map(constraint));
    assert.deepEqual(await read(),recovered);assert.equal(attempts,2,'a successful recovered response should still be cached');
    t.diagnostic(`Recorded required attributes: ${required.length}; recovered pages: ${recovered.pages.length}`);
    assert.equal(db.list('operations').length,0);
  }finally{await runtime.dispose();db.close();}
});

test('unknown attribute recovery is bounded, actionable and pinned to the rejected category snapshot',async t=>{
 const stores=realStores(),template=realAncillary('ozonCategoryTemplate'),storeId=String(stores[0].id);
 const selection={storeId,descriptionCategoryId:String(template.descriptionCategoryId),typeId:String(template.typeId)};
 const known=String(template.attributes[0].id??template.attributes[0].attribute_id),unknown='local-negative-control-absent-attribute';
 assert.ok(!template.attributes.some((a:any)=>String(a.id??a.attribute_id)===unknown));
 const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'attribute-recovery'),runtime=new AppsRuntime(db);
 let calls=0,serial=0,attributes=structuredClone(template.attributes);
 const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCategoryData:async(request:any)=>{
  assert.deepEqual(request,{mode:'template',...selection});calls++;return {status:'ok',raw:{result:structuredClone(attributes)}};
 }} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:port,client,broker:{} as any}));
 runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Attribute recovery control',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
 const invoke=async(input:any)=>{
  const invocationId=`attribute-${++serial}`;
  const result=await runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId:'hallmark.listing.category.read',capabilityVersion:'1.0.0',input,invocationId,traceId:'attribute-recovery',source:{kind:'agent',sessionId:'local',nativeCallId:invocationId},deadlineAt:new Date(Date.now()+30000).toISOString()});
  return JSON.parse(projectModelResult(db,result).content);
 };
 try{
  const failed=await invoke({...selection,attributeIds:[known,unknown],limit:1});
  assert.equal(failed.status,'failed');
  if(!failed.error.details?.recovery){const repeated=await invoke({...selection,attributeIds:[known,unknown],limit:1});t.diagnostic(`Baseline: 2 requests, ${Number(failed.status==='failed')+Number(repeated.status==='failed')} failures, 0 actionable recovery routes; external category reads: ${calls}`);}
  assert.equal(failed.error.code,'LISTING_CATEGORY_ATTRIBUTE_NOT_FOUND');
  assert.equal(failed.error.retryPolicy,'never');
  const detail=failed.error.details;assert.deepEqual(detail.unknownAttributeIds,[unknown]);
  assert.deepEqual(detail.selection,{descriptionCategoryId:selection.descriptionCategoryId,typeId:selection.typeId});
  assert.equal(detail.recovery.capability,'hallmark.listing.category.read');
  assert.deepEqual(Object.keys(detail.recovery.input).sort(),['cursor','limit','storeId']);
  assert.equal(detail.recovery.input.limit,1);assert.equal(detail.recovery.input.storeId,storeId);
  assert.ok(Buffer.byteLength(JSON.stringify(failed))<2000);
  const firstRecovery=await invoke(detail.recovery.input);assert.equal(firstRecovery.status,'ok');assert.equal(firstRecovery.data.revision,detail.revision);assert.equal(firstRecovery.data.attributes.length,1);assert.equal(calls,1);
  t.diagnostic('Fixed: 2 requests, 1 failure then 1 successful bounded recovery page; external category reads: 1');
  // Refresh the current category after the rejection. Recovery must retain the rejected revision.
  attributes=[];const refreshed=await invoke({...selection,refresh:true,scope:'all'});assert.equal(refreshed.status,'ok');assert.equal(refreshed.data.page.total,0);
  const beforeRecovery=calls;let page=await invoke(detail.recovery.input),seen:any[]=[];
  for(;;){
   assert.equal(page.status,'ok');assert.equal(page.data.revision,detail.revision);assert.deepEqual(page.data.selection,detail.selection);
   seen.push(...page.data.attributes);if(!page.data.continuation)break;page=await invoke(page.data.continuation.input);
  }
  const recoveryExternalReads=calls-beforeRecovery;
  assert.equal(calls,beforeRecovery,'snapshot recovery must not fetch a newer category');
  assert.deepEqual(seen.map(a=>String(a.id??a.attribute_id)).sort(),template.attributes.map((a:any)=>String(a.id??a.attribute_id)).sort());
  for(const attribute of seen)if(attribute.available){assert.deepEqual(attribute.available.input.descriptionCategoryId,selection.descriptionCategoryId);assert.deepEqual(attribute.available.input.typeId,selection.typeId);assert.ok(attribute.available.input.limit<=100);}
  assert.ok(stores.length>1,'Cross-store control requires a second recorded store');
  const wrongStore=await invoke({...detail.recovery.input,storeId:String(stores[1].id)});assert.equal(wrongStore.status,'failed');assert.equal(wrongStore.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(wrongStore.error.details.recovery,undefined);assert.deepEqual(wrongStore.error.details.requiredInput,['descriptionCategoryId','typeId']);
  attributes=structuredClone(template.attributes);const selected=await invoke({...selection,attributeIds:[known],refresh:true});assert.equal(selected.status,'ok');assert.equal(selected.data.scope,'selected');assert.equal(selected.data.attributes.length,1);
  const large=await invoke({...selection,attributeIds:[known,unknown,'x'.repeat(20000),'another-absent-control']});assert.equal(large.status,'failed');assert.deepEqual(large.error.details.unknownAttributeIndexes,[1,2,3]);assert.deepEqual(large.error.details.unknownAttributeIds,[unknown,'another-absent-control']);assert.equal(large.error.details.omittedUnknownAttributeIds,1);assert.ok(Buffer.byteLength(JSON.stringify(large))<2200);
  const many=await invoke({...selection,attributeIds:Array.from({length:100},(_,i)=>`absent-control-${i}`)});assert.equal(many.status,'failed');assert.equal(many.error.details.unknownAttributeIndexes.length,100);assert.equal(many.error.details.unknownAttributeIds.length,20);assert.equal(many.error.details.omittedUnknownAttributeIds,80);assert.ok(Buffer.byteLength(JSON.stringify(many))<3000);
  const invalidCursor=await invoke({storeId,cursor:'not-json'});assert.equal(invalidCursor.status,'failed');assert.equal(invalidCursor.error.code,'LISTING_CATEGORY_CURSOR_INVALID');assert.equal(invalidCursor.error.details.recovery,undefined);
  assert.equal(db.list('operations').length,0);
  t.diagnostic(`Recovery pages: ${seen.length}; recovery external reads: ${recoveryExternalReads}; invalid attribute errors: 1; same-request retries required: 0`);
 }finally{await runtime.dispose();db.close();}
});
