import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type RuntimeOperation} from '../../packages/app-runtime/src/index.ts';
import type {AppProvider,ExecutionContext,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import type {SemanticReviewResult} from '../../packages/app-contracts/src/business-review.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import type {BusinessRowInput,BusinessTransportResult} from '../../packages/app-hallmark/src/operations/types.ts';
import {BUSINESS_DESCRIPTORS,businessResult,executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import {BusinessOperationPoller} from '../../packages/service/src/business-poller.ts';

function fixture(){
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),domain=new HallmarkStorePort(store,'C1'),events:string[]=[];
  let now=Date.now(),reviewStatus:SemanticReviewResult['status']='passed',reviews=0,send=(action:string):BusinessTransportResult=>action==='listing'?{status:'pending',receipt:{importTaskId:123}}:{status:'succeeded'},inspection:BusinessTransportResult={status:'succeeded'};
  const operations=new BusinessOperations({store:domain,now:()=>new Date(now).toISOString(),source:{async load({storeId,row}){return {identity:{storeId,...row.target},current:row.action==='listing'?{}:row.action==='stock'?{stock:0,warehouse_id:7}:{price:'10',currency_code:'CNY'},source:{name:'Trusted cup'},procurement:[{itemId:'source',sourceSkuId:'source-red',unitPrice:4,currency:'CNY',unit:'piece'}]};}},transport:{async execute(input){events.push(`write:${input.row.action}`);return send(input.row.action);},async inspect(){events.push('read:import');return inspection;}},reviewer:{async review(request){reviews++;return {status:reviewStatus,questions:request.questions.map(q=>({id:q.id,version:q.version,status:reviewStatus,reviewer:'decisions',reasonCode:reviewStatus})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}}});
  const planId=(id:string)=>domain.get<{planId:string}>('business_runtime_operations',id)!.planId;
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'hallmark',displayName:'Fixture Hallmark',providerPackage:'test',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:BUSINESS_DESCRIPTORS,mutationScope(request){return operations.get((request.input as {planId:string}).planId).rows.map(row=>`bill/${row.target.offerId}`);},execute:context=>executeBusiness(operations,domain,context),async inspect(id,context){events.push('runtime:inspect');return businessResult(await operations.inspect(planId(id),context.signal),context);},async continueOperation(id,context){events.push('runtime:continue');return businessResult(await operations.continueSubmitted(planId(id),context.signal),context);},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'session',appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const invoke=(id:string)=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:id,expectedRevision:operations.get(id).revision},source:{kind:'agent',sessionId:'session',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+3000).toISOString()} satisfies InvocationRequest);
  const rows:BusinessRowInput[]=[{rowId:'listing',action:'listing',target:{offerId:'red'},procurement:[{itemId:'source',sourceSkuId:'source-red',quantity:1}],payload:{offer_id:'red',name:'Cup',price:'20',currency_code:'CNY'}},{rowId:'stock',action:'stock',target:{offerId:'red'},payload:{stock:0,warehouse_id:7},dependsOn:['listing']}];
  const poller=new BusinessOperationPoller(runtime);
  return {store,runtime,domain,operations,events,rows,poller,invoke,get reviews(){return reviews;},set reviewStatus(value:typeof reviewStatus){reviewStatus=value;},set send(value:typeof send){send=value;},set inspection(value:typeof inspection){inspection=value;},advance(ms:number){now+=ms;},async tick(){const next=new BusinessOperationPoller(runtime);await next.tick();await next.stop();},async close(){await poller.stop();await runtime.dispose();store.close();}};
}

test('poller inspects original import then continues its authorized stock dependency without new review',async()=>{
  const f=fixture();try{
    const plan=await f.operations.create({storeId:'bill',rows:f.rows}),submitted=await f.invoke(plan.planId),id=submitted.operation!.operationId;
    assert.equal(submitted.status,'pending');assert.deepEqual(f.operations.get(plan.planId).rows.map(row=>row.status),['pending','blocked']);const modelCalls=f.reviews;
    await f.poller.tick();assert.deepEqual(f.events,['write:listing','runtime:inspect','read:import','runtime:continue','write:stock']);assert.equal(f.reviews,modelCalls);
    assert.equal(f.store.get<RuntimeOperation>('operations',id)?.state,'succeeded');assert.deepEqual(f.operations.get(plan.planId).rows.map(row=>row.status),['succeeded','succeeded']);
    await f.poller.tick();assert.equal(f.events.filter(event=>event.startsWith('write:')).length,2);assert.match(JSON.stringify(f.store.list('operation_events')),/continuation_intent/);
  }finally{await f.close();}
});

test('known rate-limit remains pending until retryAt; a due retry uses the same runtime operation',async()=>{
  const f=fixture();try{
    f.send=()=>({status:'rejected',issues:[{code:'OZON_RATE_LIMIT',message:'Slow down'}],retryAfterMs:1000});
    const plan=await f.operations.create({storeId:'bill',rows:[{action:'price',target:{offerId:'red'},payload:{price:'20',currency_code:'CNY'}}]}),submitted=await f.invoke(plan.planId),id=submitted.operation!.operationId;
    assert.equal(submitted.status,'pending');await f.tick();assert.deepEqual(f.events.filter(event=>event.startsWith('write:')),['write:price']);assert.equal(f.store.get<RuntimeOperation>('operations',id)?.state,'pending');
    f.advance(2000);f.send=()=>({status:'succeeded'});await f.tick();assert.deepEqual(f.events.filter(event=>event.startsWith('write:')),['write:price','write:price']);assert.equal(f.store.get<RuntimeOperation>('operations',id)?.state,'succeeded');assert.equal(f.store.list('operations').length,1);assert.equal(f.reviews,0);
  }finally{await f.close();}
});

test('unknown import is inspected and never resent or followed by stock',async()=>{
  const f=fixture();try{
    f.send=()=>({status:'unknown'});f.inspection={status:'unknown'};
    const plan=await f.operations.create({storeId:'bill',rows:f.rows}),submitted=await f.invoke(plan.planId),id=submitted.operation!.operationId;
    assert.equal(submitted.status,'unknown');const modelCalls=f.reviews;await f.tick();await f.tick();assert.deepEqual(f.events.filter(event=>event.startsWith('write:')),['write:listing']);assert.equal(f.store.get<RuntimeOperation>('operations',id)?.state,'unknown');assert.equal(f.reviews,modelCalls);
  }finally{await f.close();}
});

test('a pending semantic review completes this submit attempt and is never polled or retried by background',async()=>{
  const f=fixture();try{
    f.reviewStatus='pending';const plan=await f.operations.create({storeId:'bill',rows:f.rows}),submitted=await f.invoke(plan.planId);assert.equal(submitted.status,'ok');assert.equal(f.operations.get(plan.planId).rows[0].status,'review_pending');const modelCalls=f.reviews;
    await f.poller.tick();await f.tick();assert.deepEqual(f.events,[]);assert.equal(f.reviews,modelCalls);assert.equal(f.store.list<RuntimeOperation>('operations')[0].state,'succeeded');
  }finally{await f.close();}
});

test('a saved revision of the dependent stock is not covered by the earlier submit',async()=>{
  const f=fixture();try{
    const plan=await f.operations.create({storeId:'bill',rows:f.rows}),submitted=await f.invoke(plan.planId),id=submitted.operation!.operationId;
    await f.operations.revise({planId:plan.planId,expectedRevision:1,rows:[{...f.rows[1],payload:{stock:99,warehouse_id:7}}]});await f.poller.tick();
    assert.deepEqual(f.events,['write:listing','runtime:inspect','read:import']);assert.equal(f.store.get<RuntimeOperation>('operations',id)?.state,'partial');assert.equal(f.operations.get(plan.planId).rows[1].status,'draft');
  }finally{await f.close();}
});

test('dependency chains stay pending only when their authorized prerequisites can progress',async()=>{
  const f=fixture();try{
    const plan=await f.operations.create({storeId:'bill',rows:[...f.rows,{rowId:'last',action:'archive',target:{offerId:'blue'},payload:{archived:true},dependsOn:['stock']}]}),submitted=await f.invoke(plan.planId);assert.equal(submitted.status,'pending');
    const context={request:{invocationId:'test',traceId:'test'},operationId:submitted.operation!.operationId} as ExecutionContext;
    const snapshot=f.operations.get(plan.planId);snapshot.rows[0].status='succeeded';assert.equal(businessResult(snapshot,context).status,'pending');
    snapshot.rows[1].status='review_pending';assert.equal(businessResult(snapshot,context).status,'partial');
    snapshot.rows[1].status='blocked';snapshot.rows[1].issues=[{code:'DEPENDENCY_PENDING',message:'Wait'}];snapshot.rows[1].revision++;assert.equal(businessResult(snapshot,context).status,'partial');
  }finally{await f.close();}
});
