import test from 'node:test';
import assert from 'node:assert/strict';
import {realSourceProducts} from '../real-data/corpus.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {BUSINESS_DESCRIPTORS,executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import type {BusinessPlan} from '../../packages/app-hallmark/src/operations/types.ts';
import type {InvocationRequest} from '../../packages/app-contracts/src/index.ts';

test('payload-mode draft pagination retains exact recorded content through every emitted model continuation',async()=>{
  // Plan identities and row lifecycle are local controls; payload names and images are unchanged recorded facts.
  const sources=realSourceProducts().slice(0,3),plan:BusinessPlan={planId:'payload-pages-control',storeId:'local-store',title:'Payload pagination control',revision:1,status:'draft',createdAt:'2026-10-15',updatedAt:'2026-10-15',rows:sources.map((source,index)=>({rowId:`row-${index}`,revision:1,action:'listing',status:'draft',target:{offerId:source.id},payload:{name:source.title,images:source.images},issues:[],corrections:[],repairHistory:{}}))};
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let gets=0;
  const operations={get:(id:string)=>{assert.equal(id,plan.planId);gets++;return structuredClone(plan);}} as unknown as BusinessOperations;
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Read-only pagination control',providerPackage:'local-control',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['business-plan']},descriptors:BUSINESS_DESCRIPTORS.filter(d=>d.capabilityId==='hallmark.listing.draft.get'),execute:context=>executeBusiness(operations,{} as any,context),dispose:async()=>{}});
  runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Local read control',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  try{
    let args:any={appId:'hallmark',connectionId:'local',capabilityId:'hallmark.listing.draft.get',capabilityVersion:'1.0.0',input:{planId:plan.planId,view:'payload',limit:1}};
    const seen:any[]=[];
    for(let page=0;;page++){
      assert.ok(page<10,'continuation must terminate');
      const request:InvocationRequest={protocolVersion:'1.0',...args,invocationId:`payload-page-${page}`,traceId:'payload-pages',source:{kind:'agent',sessionId:'local',nativeCallId:`payload-page-${page}`},deadlineAt:new Date(Date.now()+5000).toISOString()};
      const result=await runtime.invoke(request);assert.equal(result.status,'ok',JSON.stringify(result));
      const projected=projectModelResult(store,result),model=JSON.parse(projected.content);
      assert.equal(projected.fullResultRef,undefined);assert.ok(Buffer.byteLength(projected.content)<=16384);
      assert.equal(model.data.page.offset,page);assert.equal(model.data.page.total,plan.rows.length);
      assert.equal(model.data.rows.length,1);assert.deepEqual(model.data.rows[0].payload,plan.rows[page].payload);
      seen.push({rowId:model.data.rows[0].rowId,payload:model.data.rows[0].payload});
      if(!model.data.continuation)break;
      assert.equal(model.data.continuation.tool,'apps_invoke');args=model.data.continuation.arguments;
    }
    assert.deepEqual(seen,plan.rows.map(row=>({rowId:row.rowId,payload:row.payload})));assert.equal(gets,3);assert.equal(store.list('operations').length,0);
  }finally{await runtime.dispose();store.close();}
});
