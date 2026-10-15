import test from 'node:test';
import assert from 'node:assert/strict';
import {realAncillary,realStores} from '../real-data/corpus.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';

test('ordinary category reads recover after a transient failure and then reuse the recovered recorded constraints',async()=>{
  const stores=realStores(),storeId=String(stores[0].id),template=realAncillary('ozonCategoryTemplate');
  const input={storeId,descriptionCategoryId:String(template.descriptionCategoryId),typeId:String(template.typeId)};
  const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'category-retry-control'),runtime=new AppsRuntime(db);let attempts=0;
  // Only the transport failure is synthetic; recovered business constraints are unchanged recorded facts.
  const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCategoryData:async(request:any)=>{
    assert.deepEqual(request,{mode:'template',...input});attempts++;
    if(attempts===1)return {status:'unavailable',error:{code:'CONTROL_TEMPORARY',message:'Local transient read control',retryable:true}};
    return {status:'ok',raw:{result:structuredClone(template.attributes)}};
  }} as unknown as CoreClient;
  runtime.register(new HallmarkProvider({store:port,client,broker:{} as any}));
  runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Category retry control',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const read=async(sequence:number)=>{
    const result=await runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId:'hallmark.listing.category.read',capabilityVersion:'1.0.0',input,invocationId:`category-read-${sequence}`,traceId:'category-retry-control',source:{kind:'agent',sessionId:'local',nativeCallId:`category-read-${sequence}`},deadlineAt:new Date(Date.now()+5000).toISOString()});
    assert.equal(result.status,'ok',JSON.stringify(result));const projection=projectModelResult(db,result);assert.equal(projection.fullResultRef,undefined);return JSON.parse(projection.content).data;
  };
  try{
    const failed=await read(1);assert.equal(failed.status,'unavailable');assert.equal(failed.error.code,'CONTROL_TEMPORARY');assert.equal(attempts,1);
    const recovered=await read(2);assert.equal(recovered.status,'selected','normal retry must reread after a transient failure without requiring refresh:true');assert.equal(attempts,2);
    const required=template.attributes.filter((attribute:any)=>attribute.is_required===true||attribute.required===true);
    assert.ok(required.length>0);assert.equal(recovered.page.total,required.length);assert.equal(recovered.page.nextCursor,null);
    assert.deepEqual(recovered.attributes.map((attribute:any)=>({id:attribute.id,name:attribute.name,is_required:attribute.is_required})),required.map((attribute:any)=>({id:attribute.id,name:attribute.name,is_required:attribute.is_required})));
    assert.deepEqual(await read(3),recovered);assert.equal(attempts,2,'a successful recovered response should still be cached');assert.equal(db.list('operations').length,0);
  }finally{await runtime.dispose();db.close();}
});
