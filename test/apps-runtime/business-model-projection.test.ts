import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { CapabilityResult,InvocationRequest,JsonValue } from '../../packages/app-contracts/src/index.ts';
import { AppsRuntime } from '../../packages/app-runtime/src/index.ts';
import { RuntimeStore,type InvocationRecord } from '../../packages/app-runtime/src/store.ts';
import { projectModelResult,readResultPage } from '../../packages/app-runtime/src/projection.ts';
import { BUSINESS_DESCRIPTORS,executeBusiness } from '../../packages/app-hallmark/src/operations-provider.ts';
import type { BusinessOperations } from '../../packages/app-hallmark/src/operations/index.ts';
import type { BusinessPlan } from '../../packages/app-hallmark/src/operations/types.ts';
import type { CoreStore } from '../../packages/core/src/types.ts';

function row(index:number) {
  return {rowId:`stable-row-${index}`,revision:2,action:'listing',target:{offerId:`bill-new-20261010-${index}`,productId:10000+index},status:index===3?'rejected':'succeeded',
    payload:{name:'Русское название товара '.repeat(100),description:'实际商品说明'.repeat(3000),images:Array.from({length:20},(_,image)=>`https://cdn.example.invalid/${index}/${image}.png`),attributes:[{id:4191,values:[{value:'详情'.repeat(5000)}]}],price:'27.45',currency_code:'CNY',weight:20,weight_unit:'g',depth:100,width:80,height:20,dimension_unit:'mm'},
    issues:index===3?[{code:'ATTRIBUTE_VALUE_INVALID',field:'attributes.颜色',message:'“蓝色”不能用于这个来源为红色的 SKU。',suggestion:'将颜色修正为红色，再只修改这行。',requiresUser:false}]:[],corrections:['已自动换算包装单位'],
    binding:{amount:6.63,currency:'CNY',missing:[],components:[{itemId:'source-1',sourceSkuId:'source-sku-'+index,quantity:1,unitPrice:6.63,currency:'CNY'}]},
    pricingQuote:{status:'ready',storeId:'bill',configRevision:2,planId:'economy',planName:'方案1',selectionMode:'automatic',selectionReason:'按售价及重量选择；重叠按较贵方案',matchedPlanIds:['economy'],currency:'CNY',targetMarginPpm:600000,minimumMarginPpm:null,suggestedPriceMinor:2745,minimumAllowedPriceMinor:null,evaluatedPriceMinor:2745,breakdown:{purchaseMinor:663,fixedMinor:316,logisticsMinor:79,commissionMinor:549,totalCostMinor:1607,profitMinor:1138,marginPpm:414571},issues:[],warnings:[]},
    review:[{status:'passed',questions:[{content:'Agent already wrote this content '.repeat(3000)}]}],
    receipt:{executionId:'exec-'+index,requestId:'request-'+index,importTaskId:800+index,transport:'ozon-direct',completion:'imported; moderation and sellability are separate',product:{id:10000+index,sku:20000+index,statuses:{is_created:true},is_archived:false},fullPlatformReply:'unneeded'.repeat(1000)},
    context:{source:{raw:'large source'.repeat(4000)}}};
}
function result(count=11):CapabilityResult {return {status:'ok',invocationId:'business-invocation',traceId:'trace-1',data:{planId:'plan-1',revision:4,storeId:'bill',status:'partial',title:'Agent already knows this title',rows:Array.from({length:count},(_,index)=>row(index))}};}

test('all 11 real-shaped SKU results fit without echoing content or audit objects',()=>{
  const store=new RuntimeStore(':memory:');try{
    const original=result(),before=JSON.stringify(original),projected=projectModelResult(store,original),view=JSON.parse(projected.content);
    assert.ok(Buffer.byteLength(projected.content)<=16384);
    assert.equal(view.data.planId,'plan-1');assert.equal(view.data.revision,4);assert.equal(view.data.rows.length,11);
    assert.deepEqual(view.data.page,{offset:0,total:11,returned:11,nextCursor:null});
    assert.equal(view.data.rows[3].status,'rejected');assert.deepEqual(view.data.rows[3].issues,row(3).issues);
    assert.deepEqual(view.data.rows[3].target,row(3).target);assert.equal(view.data.rows[3].revision,2);
    assert.equal(view.data.rows[0].pricingQuote.breakdown.purchaseMinor,663);assert.equal(view.data.rows[0].values.weight,20);
    assert.equal(view.data.rows[0].receipt.importTaskId,800);assert.equal(view.data.rows[0].receipt.product.id,10000);
    for(const item of view.data.rows){assert.equal(item.payload,undefined);assert.equal(item.review,undefined);assert.equal(item.context,undefined);}
    assert.equal(view.sample,undefined);assert.equal(view.fullResultRef,undefined);assert.doesNotMatch(projected.content,/authoringGuidance/);
    assert.equal(JSON.stringify(original),before,'the UI/provider result remains byte-for-byte unchanged');
  }finally{store.close();}
});

test('business summaries are consistent even when the original result is small',()=>{
  const store=new RuntimeStore(':memory:');try{
    const original:CapabilityResult={status:'ok',invocationId:'small',traceId:'trace',data:{planId:'p',revision:1,status:'draft',rows:[{rowId:'r',revision:1,action:'price',target:{offerId:'x'},payload:{price:'12.50',currency_code:'CNY'},status:'draft',issues:[]}]}};
    const view=JSON.parse(projectModelResult(store,original).content);
    assert.deepEqual(view.data.rows[0].values,{price:'12.50',currency_code:'CNY'});assert.equal(view.data.modelView,'business-operation-summary');
  }finally{store.close();}
});

test('large batches page whole rows through callable plan.get, preserving issue text and offsets',()=>{
  const store=new RuntimeStore(':memory:');try{
    const original=result(60),all=(original as unknown as {data:{rows:JsonValue[]}}).data.rows,seen:string[]=[];
    let offset=0,next:string|null='0',rounds=0;
    while(next!==null){
      const rows=all.slice(offset,offset+20),upstreamNext=offset+rows.length<all.length?String(offset+rows.length):null;
      const page:CapabilityResult={...original,status:'ok',data:{planId:'plan-1',revision:4,status:'partial',connectionId:'bill-source-board',rows,page:{offset,total:all.length,returned:rows.length,nextCursor:upstreamNext}}};
      const projection=projectModelResult(store,page,4096),view=JSON.parse(projection.content);
      assert.ok(Buffer.byteLength(projection.content)<=4096);assert.ok(view.data.page.returned>0);
      assert.equal(view.data.page.offset,offset);assert.equal(view.data.page.total,60);
      seen.push(...view.data.rows.map((item:{rowId:string})=>item.rowId));
      const problem=view.data.rows.find((item:{rowId:string})=>item.rowId==='stable-row-3');if(problem)assert.deepEqual(problem.issues,row(3).issues);
      next=view.data.page.nextCursor;
      if(next!==null){const read=view.data.continuation;assert.equal(read.tool,'apps_invoke');assert.equal(read.arguments.capabilityId,'hallmark.plan.get');assert.equal(read.arguments.connectionId,'bill-source-board');assert.deepEqual(read.arguments.input,{planId:'plan-1',cursor:next,limit:20});offset=Number(next);}
      assert.ok(++rounds<70,'pagination must progress');
    }
    assert.deepEqual(seen,all.map(item=>(item as {rowId:string}).rowId));
  }finally{store.close();}
});

test('partial operation identity and source connection survive compact projection',()=>{
  const store=new RuntimeStore(':memory:');try{
    const base=result(20),original:CapabilityResult={...base,status:'partial',data:(base as {data:JsonValue}).data,operation:{operationId:'operation-1',state:'partial'},errors:[{code:'BUSINESS_PARTIAL',message:'只处理失败的行',retryPolicy:'never'}]};
    store.put('invocations',original.invocationId,{request:{connectionId:'actual-connection'}});
    const view=JSON.parse(projectModelResult(store,original,4096).content);
    assert.deepEqual(view.operation,original.operation);assert.deepEqual(view.errors,original.errors);
    assert.equal(view.data.continuation.arguments.connectionId,'actual-connection');
  }finally{store.close();}
});

test('oversized single issue reports an explicit budget failure without truncation or a retry loop',()=>{
  const store=new RuntimeStore(':memory:');try{
    const original:CapabilityResult={status:'ok',invocationId:'huge-issue',traceId:'trace',data:{planId:'p',revision:9,status:'blocked',rows:[{...row(0),issues:[{code:'LONG_PLATFORM_ERROR',field:'attributes',message:'真实平台返回'.repeat(15000),suggestion:'使用平台返回的正确字段'}]}]}};
    const view=JSON.parse(projectModelResult(store,original).content);
    assert.equal(view.data.modelProjectionError.code,'ROW_MODEL_BUDGET_EXCEEDED');assert.equal(view.data.planId,'p');assert.equal(view.data.revision,9);
    assert.equal(view.data.modelProjectionError.rowId,'stable-row-0');assert.deepEqual(view.data.modelProjectionError.issues.map((issue:{code:string;field:string})=>[issue.code,issue.field]),[['LONG_PLATFORM_ERROR','attributes']]);
    assert.equal(view.data.completeness,'incomplete');assert.equal(view.data.page.nextCursor,null);assert.equal(view.data.read,undefined);assert.equal(view.data.continuation,undefined);assert.match(view.data.modelProjectionError.message,/Repeating the same get will not fix/);
    assert.ok(Buffer.byteLength(projectModelResult(store,original,512).content)<=512);
  }finally{store.close();}
});

test('ordinary nonbusiness results and pending receipts retain the existing contract',()=>{
  const store=new RuntimeStore(':memory:');try{
    for(const original of [
      {status:'ok',invocationId:'normal',traceId:'trace',data:{planId:'not-business',revision:1,rows:[{id:'x'}]}},
      {status:'pending',invocationId:'pending',traceId:'trace',operation:{operationId:'pending-op',state:'pending'},pollAfterMs:5000},
    ] as CapabilityResult[])assert.deepEqual(JSON.parse(projectModelResult(store,original).content),original);
  }finally{store.close();}
});

function evidenceRuntime(plan:BusinessPlan){
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
  const operations={get:(planId:string)=>{assert.equal(planId,plan.planId);return structuredClone(plan);}} as unknown as BusinessOperations;
  const sourceStore={get:()=>{throw new Error('a plan ID read needs no other lookup');}} as unknown as CoreStore;
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['business-plan']},
    descriptors:BUSINESS_DESCRIPTORS.filter(item=>item.capabilityId.endsWith('.get')),
    execute:context=>executeBusiness(operations,sourceStore,context),dispose:async()=>{}});
  runtime.addConnection({appId:'hallmark',connectionId:'bill-source-board',displayName:'bill',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:'evidence-session',appId:'hallmark',connectionId:'bill-source-board',enabled:true,boundAt:new Date().toISOString()});
  const read=async(capabilityId:string,input:Record<string,JsonValue>)=>{
    const request:InvocationRequest={protocolVersion:'1.0',appId:'hallmark',connectionId:'bill-source-board',capabilityId,capabilityVersion:'1.0.0',invocationId:randomUUID(),traceId:randomUUID(),
      input:{planId:plan.planId,...input},source:{kind:'agent',sessionId:'evidence-session',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+30000).toISOString()};
    const original=await runtime.invoke(request);
    assert.equal(original.status,'ok',JSON.stringify(original));
    const invocation=store.get<InvocationRecord>('invocations',original.invocationId)!;
    assert.equal(invocation.state,'settled');assert.deepEqual(invocation.request,request);
    return {original,projected:projectModelResult(store,original)};
  };
  return {runtime,store,read};
}

test('actual plan and draft evidence invocations preserve the selected row and its complete small result',async()=>{
  const plan={...(result() as {data:object}).data,rows:[{...row(0),payload:{name:'Чёрный зажим',attributes:[{id:4191,values:[{value:'Первая строка\nВторая строка'}]}]},context:{source:{material:'metal'}},review:{status:'passed'},receipt:undefined},row(1)]} as unknown as BusinessPlan;
  // Public results are JSON; keep this fixture free of undefined just like persisted plans.
  delete plan.rows[0].receipt;
  const f=evidenceRuntime(plan);
  try{
    for(const capabilityId of ['hallmark.plan.get','hallmark.listing.draft.get']){
      const {original,projected}=await f.read(capabilityId,{rowIds:['stable-row-0'],includeEvidence:true});
      assert.deepEqual(JSON.parse(projected.content),original);
      const data=(original as {data:any}).data;
      assert.deepEqual(data.rows.map((item:any)=>item.rowId),['stable-row-0']);
      assert.deepEqual(data.rows[0].payload,plan.rows[0].payload);assert.deepEqual(data.rows[0].context,plan.rows[0].context);assert.deepEqual(data.rows[0].review,plan.rows[0].review);
      assert.deepEqual(data.page,{offset:0,total:1,returned:1,nextCursor:null});
      assert.equal(projected.fullResultRef,undefined);assert.ok(Buffer.byteLength(projected.content)<=16384);
    }
  }finally{await f.runtime.dispose();f.store.close();}
});

test('oversized evidence selected by actual invocation spills once and attributes remain exactly readable',async()=>{
  const plan=(result() as unknown as {data:BusinessPlan}).data;
  const attributes=[{id:4191,values:[{value:'Фактическое описание\nВторая строка'}]},{id:85,values:[{value:'Без бренда'}]}];
  plan.rows[3].payload.attributes=attributes;
  const f=evidenceRuntime(plan);
  try{
    const {original,projected}=await f.read('hallmark.plan.get',{rowIds:['stable-row-3'],includeEvidence:true});
    assert.equal(projected.fullResultRef,`result:${original.invocationId}`);assert.ok(Buffer.byteLength(projected.content)<=16384);
    const summary=JSON.parse(projected.content);
    assert.equal(summary.read.tool,'apps_inspect');assert.equal(summary.completeness,'partial');assert.equal(summary.sampleTruncated,true);
    const path='/data/rows/0/payload/attributes',page=readResultPage(f.store,projected.fullResultRef!,'0',100,{path});
    assert.deepEqual(page.items,attributes);assert.equal(page.completeness,'complete');assert.equal(page.path,path);assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);
    const stored=readResultPage(f.store,projected.fullResultRef!).result as any,storedData=stored.data;
    assert.deepEqual(stored,original);assert.deepEqual(storedData.rows.map((item:any)=>item.rowId),['stable-row-3']);assert.equal(storedData.page.total,1);
    assert.throws(()=>readResultPage(f.store,projected.fullResultRef!,'0',100,{path:'/data/rows/1/payload/attributes'}),/RESULT_PATH_NOT_FOUND/);
    const ordinary=await f.read('hallmark.plan.get',{rowIds:['stable-row-3']});
    assert.equal(JSON.parse(ordinary.projected.content).data.modelView,'business-operation-summary');assert.equal(ordinary.projected.fullResultRef,undefined);
    assert.ok(Buffer.byteLength(ordinary.projected.content)<=16384);
  }finally{await f.runtime.dispose();f.store.close();}
});

test('only an explicit boolean evidence flag on the stored Hallmark read bypasses the default compact summary',()=>{
  const store=new RuntimeStore(':memory:');
  try{
    const original=result();
    for(const request of [
      {appId:'hallmark',capabilityId:'hallmark.plan.create',input:{}},
      {appId:'hallmark',capabilityId:'hallmark.plan.get',input:{}},
      {appId:'hallmark',capabilityId:'hallmark.plan.submit',input:{}},
      {appId:'hallmark',capabilityId:'hallmark.plan.get',input:{includeEvidence:false}},
      {appId:'hallmark',capabilityId:'hallmark.plan.get',input:{includeEvidence:'true'}},
      {appId:'hallmark',capabilityId:'hallmark.plan.create',input:{includeEvidence:true}},
      {appId:'hallmark',capabilityId:'hallmark.plan.submit',input:{includeEvidence:true}},
      {appId:'other',capabilityId:'hallmark.plan.get',input:{includeEvidence:true}},
    ]){
      store.put('invocations',original.invocationId,{request});
      const projected=projectModelResult(store,original),view=JSON.parse(projected.content);
      assert.equal(view.data.modelView,'business-operation-summary');assert.equal(view.data.rows.length,11);assert.equal(projected.fullResultRef,undefined);
      assert.ok(Buffer.byteLength(projected.content)<=16384);
    }
    const echoed:CapabilityResult={...original,status:'ok',invocationId:'no-stored-request',data:{...(original as {data:Record<string,JsonValue>}).data,includeEvidence:true}};
    assert.equal(JSON.parse(projectModelResult(store,echoed).content).data.modelView,'business-operation-summary');
  }finally{store.close();}
});
