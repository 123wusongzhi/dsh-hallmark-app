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
