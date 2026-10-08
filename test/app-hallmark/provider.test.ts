import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppsRuntime, RuntimeStore } from '../../packages/app-runtime/src/index.ts';
import { HallmarkProvider, HallmarkStorePort, HALLMARK_DESCRIPTORS, HALLMARK_API_OPERATIONS, LEGACY_TOOL_MAP } from '../../packages/app-hallmark/src/index.ts';
import { TOOL_DEFINITIONS } from '../../packages/contracts/src/index.ts';
import { compileCapability } from '../../packages/app-contracts/src/index.ts';
import type { InvocationRequest, CapabilityResult } from '../../packages/app-contracts/src/index.ts';
import type { CoreClient, CoreBroker, AdapterResponse } from '../../packages/core/src/types.ts';

const ok=(raw:any):AdapterResponse=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',endpoint:'/fixture',fetchedAt:'2026-10-07T00:00:00Z'}});
function fixture(){
 const store=new RuntimeStore(':memory:'),ports=new Map<string,HallmarkStorePort>(),calls:any[]=[];let unknown=false,price='100',unavailable=false,executes=0;
 const port=(id:string)=>{let value=ports.get(id);if(!value){value=new HallmarkStorePort(store,id);ports.set(id,value);}return value;};
 const client:CoreClient={getStores:async()=>ok([{id:'shop',shopName:'Shop'}]),getStoreProducts:async()=>unavailable?{status:'unavailable',error:{code:'DOWN',message:'Down',retryable:true}}:ok({stores:[{id:'shop'}],products:[{storeId:'shop',offerId:'A',productId:1,price:100,profit:{costMinor:5000,profitMinor:1000,actualMargin:0.1},original:{preserved:true}},{storeId:'shop',offerId:'B',productId:2,profit:{costMinor:null,actualMargin:1}}]}),syncStoreProducts:async()=>unavailable?{status:'unavailable',error:{code:'DOWN',message:'Down',retryable:true}}:ok({}),getTargetMargin:async()=>ok({targetMargin:0.2}),searchCollectedItems:async()=>ok([{id:'item',title:'Original',skuCount:1}]),getCollectedItem:async(id)=>ok({id,content:'{}',truncated:false}),platformCall:async(taskId,input)=>{calls.push({write:true,taskId,...input});return unknown?{status:'unknown',error:{code:'OUTCOME_UNKNOWN',message:'timeout',retryable:false}}:ok({outcome:'response_received',httpStatus:200,response:{result:[{updated:true}]}});},platformRead:async(taskId,input)=>{calls.push({write:false,taskId,...input});return ok({outcome:'response_received',httpStatus:200,response:{result:{items:[{offer_id:'A',price:{price,currency_code:'RUB'}}]}}});}};
 const broker:CoreBroker={getStoreTask:async()=>ok({taskId:'task'}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind:string,id:string,index:number)=>`${kind}-${id}-${index}`},provider=new HallmarkProvider({store:port,client,broker});
 const original=provider.execute.bind(provider);provider.execute=async(context)=>{executes++;return original(context);};
 const runtime=new AppsRuntime(store);runtime.register(provider);
 for(const connectionId of ['c','d']){runtime.addConnection({appId:'hallmark',connectionId,displayName:connectionId,config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId,enabled:true,boundAt:new Date().toISOString()});}
 const invoke=(capabilityId:string,input:any={},extra:Partial<InvocationRequest>={})=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+60000).toISOString(),...extra});
 return {store,ports,port,provider,runtime,client,broker,calls,invoke,executes:()=>executes,setUnknown:()=>{unknown=true;price='50';},confirm:()=>{price='100';},down:()=>{unavailable=true;}};
}
function data(result:CapabilityResult):any{assert.ok('data' in result,JSON.stringify(result));return result.data;}
const priceInput={storeId:'shop',offerIds:['A'],price:100,currency:'RUB',valueSource:'user',userRequest:'把 A 价格改为 100 RUB'};

test('product fields trim transport while preserving identity, cursor, total and original snapshot',async()=>{
 const f=fixture();try{
  const full=data(await f.invoke('hallmark.products.list',{storeId:'shop',limit:1}));
  const slim=data(await f.invoke('hallmark.products.list',{storeId:'shop',limit:1,fields:['price','profit']}));
  assert.equal(slim.total,full.total);assert.equal(slim.cursor,full.cursor);
  assert.deepEqual(slim.products[0],{storeId:'shop',offerId:'A',productId:1,price:100,profit:full.products[0].profit});
  assert.equal(slim.stores,undefined);assert.ok(JSON.stringify(slim).length<JSON.stringify(full).length);
  const next=data(await f.invoke('hallmark.products.list',{storeId:'shop',cursor:slim.cursor,limit:1,fields:['profit']}));
  assert.equal(next.products[0].offerId,'B');assert.equal(next.cursor,undefined);
  assert.deepEqual(data(await f.invoke('hallmark.products.list',{storeId:'shop',limit:1})),full);
 }finally{await f.runtime.dispose();f.store.close();}
});
for(const useSpill of [false,true])test(`exact product status filters before paging and field projection${useSpill?' with source spill':''}`,async()=>{
 const f=fixture(),source={stores:[{id:'shop'}],products:[
  {id:'source-A',storeId:'shop',offerId:'A',productId:1,status:'on_sale',title:'needle first'},
  {storeId:'shop',offerId:'title',productId:2,status:'archived',title:'on_sale needle'},
  {storeId:'shop',offerId:'B',productId:3,status:'on_sale',title:'needle second'},
  {storeId:'shop',offerId:'history',productId:4,status:'archived',sources:{history:['on_sale']}},
  {storeId:'shop',offerId:'missing',productId:5,title:'on_sale',platformStatus:'Продается',stock:10},
  {storeId:'shop',offerId:'imported',productId:6,status:'imported',platformStatus:'Продается',stock:10},
  {storeId:'shop',offerId:'case',productId:7,status:'ON_SALE'},
  {storeId:'shop',offerId:'C',productId:8,status:'on_sale',title:'other'},
  {storeId:'other',offerId:'foreign',productId:9,status:'on_sale'},
 ]},original=structuredClone(source),spill={path:'synthetic-products.json',bytes:2000000,summary:{count:9},cursor:'spill:fixture:0'};
 f.client.getStoreProducts=async()=>({...ok(source),...(useSpill?{spill}:{})});
 try{
  const first=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'on_sale',limit:2}));
  assert.deepEqual(first.products.map((row:any)=>row.offerId),['A','B']);assert.equal(first.total,3);assert.equal(first.cursor,'2');assert.equal(first.spill,undefined);
  const last=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'on_sale',cursor:first.cursor,limit:2,fields:['title']}));
  assert.deepEqual(last.products,[{storeId:'shop',offerId:'C',productId:8,title:'other'}]);assert.equal(last.total,3);assert.equal(last.cursor,undefined);assert.equal(last.spill,undefined);
  const intersection=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'on_sale',query:'NEEDLE',limit:1,fields:['title']}));
  assert.deepEqual(intersection.products,[{id:'source-A',storeId:'shop',offerId:'A',productId:1,title:'needle first'}]);assert.equal(intersection.total,2);assert.equal(intersection.cursor,'1');
  const next=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'on_sale',query:'NEEDLE',limit:1,cursor:intersection.cursor}));
  assert.equal(next.products[0].offerId,'B');assert.equal(next.total,2);assert.equal(next.cursor,undefined);
  const empty=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'on_sale',query:'absent'}));assert.deepEqual(empty.products,[]);assert.equal(empty.total,0);assert.equal(empty.cursor,undefined);
  const exact=data(await f.invoke('hallmark.products.list',{storeId:'shop',status:'ON_SALE'}));assert.deepEqual(exact.products.map((row:any)=>row.offerId),['case']);
  const legacy=data(await f.invoke('hallmark.products.list',{storeId:'shop',query:'on_sale'}));assert.equal(legacy.total,7);
  if(useSpill){assert.deepEqual(legacy.spill,spill);assert.equal(legacy.products,undefined);assert.equal(legacy.cursor,'0');}
  else assert.deepEqual(legacy.products.map((row:any)=>row.offerId),['A','title','B','history','missing','case','C']);
  const snapshot=f.port('c').get('snapshots','store_products:shop')!;assert.equal(snapshot.payload.products.length,8);assert.deepEqual(snapshot.sourceSpill,useSpill?spill:undefined);assert.deepEqual(source,original);
 }finally{await f.runtime.dispose();f.store.close();}
});
test('all 26 legacy names have one owner and every domain/API schema compiles',()=>{
 assert.deepEqual(LEGACY_TOOL_MAP.map(row=>row.legacyName),TOOL_DEFINITIONS.map(row=>row.name));
 assert.equal(LEGACY_TOOL_MAP.filter(row=>row.owner==='presentation').length,9);
 assert.equal(LEGACY_TOOL_MAP.filter(row=>row.owner==='runtime').length,5);
 for(const descriptor of HALLMARK_DESCRIPTORS)assert.doesNotThrow(()=>compileCapability(descriptor));
});
test('API directory retains its 15 queries and declares one existing price mutation with exact inherited schemas',()=>{
 const api=HALLMARK_API_OPERATIONS.map(route=>HALLMARK_DESCRIPTORS.find(row=>row.capabilityId===route.capabilityId)!);
 assert.equal(api.filter(row=>row.effect==='query').length,15);assert.equal(api.filter(row=>row.effect==='mutation').length,1);
 const route=HALLMARK_API_OPERATIONS.find(row=>row.apiOperationId==='hallmarkPriceUpdate')!,registered=api.find(row=>row.apiOperationId==='hallmarkPriceUpdate')!,domain=HALLMARK_DESCRIPTORS.find(row=>row.capabilityId==='hallmark.products.update_price')!;
 assert.equal(route.capabilityId,'hallmark.api.products.update_price');assert.equal(route.legacyName,'hallmark_update_price');assert.equal(route.path,undefined);assert.equal(route.sourceMethod,undefined);assert.deepEqual(registered.aliases,[]);
 assert.deepEqual(registered.inputSchema,domain.inputSchema);assert.deepEqual(registered.outputSchema,domain.outputSchema);assert.deepEqual(registered.execution,domain.execution);assert.equal(registered.execution.idempotency,'runtime_dedup');assert.equal(registered.execution.completionEvidence,'readback');assert.match(registered.description,/TASK_CONTEXT_REQUIRED/);assert.match(registered.description,/历史 price-state/);
});
test('Hallmark read/compute preserve source fields, unknown source time and reference profit basis',async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.products.list',{storeId:'shop'});assert.equal(data(result).products[0].original.preserved,true);assert.equal(result.provenance?.[0].sourceDataTime,null);assert.equal(result.provenance?.[0].freshness,'unknown');const profit=await f.invoke('hallmark.products.filter',{storeId:'shop',maxMargin:0.15});assert.equal(data(profit).payload.products.length,1);assert.equal(data(profit).payload.unable[0].referenceProfit.costMissing,true);assert.match(profit.provenance?.[0].metricBasis??'',/非实际结算/);assert.equal(f.calls.length,0);}finally{await f.runtime.dispose();f.store.close();}
});
test('Runtime owns the only operation identity; retries and conflicts do not execute Provider again',async()=>{
 const f=fixture();try{const first=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'price'});assert.equal(first.status,'ok',JSON.stringify(first));const id=first.operation!.operationId;assert.equal(data(first).operationId,id);assert.equal(f.port('c').get('operations',id)?.operationId,id);assert.equal(f.store.list('operations').length,1);const duplicate=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'price'});assert.equal(duplicate.operation?.operationId,id);const conflict=await f.invoke('hallmark.products.update_price',{...priceInput,price:90},{idempotencyKey:'price'});assert.equal(conflict.status,'failed');if('error' in conflict)assert.equal(conflict.error.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.executes(),1);assert.equal(f.calls.filter(row=>row.write).length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('unknown remains inspect_only; explicit readback resolves without submitting again',async()=>{
 const f=fixture();try{f.setUnknown();const result=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'uncertain'});assert.equal(result.status,'unknown',JSON.stringify(result));if('error' in result)assert.equal(result.error.retryPolicy,'inspect_only');assert.equal(f.calls.filter(row=>row.write).length,1);f.confirm();const confirmed=await f.runtime.inspect(result.operation!.operationId);assert.equal(confirmed.status,'ok',JSON.stringify(confirmed));assert.equal(f.calls.filter(row=>row.write).length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('registered API endpoint shares the same domain execution and rejects unknown operation before dispatch',async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.api.warehouses.list',{storeId:'shop',body:{}});assert.equal(result.status,'ok');assert.equal(f.calls[0].path,'/v2/warehouse/list');assert.equal(f.calls[0].write,false);const missing=await f.invoke('hallmark.api.unregistered',{});assert.equal(missing.status,'failed');assert.equal(f.executes(),1);assert.equal(f.calls.length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('registered API price operation inherits strict conditional CNY fallback with the same source operation ID',async()=>{
 const f=fixture();let submissions=0,sourceOperationId='';
 try {
  f.broker.getStoreTask=async()=>({status:'unavailable',error:{code:'TASK_CONTEXT_REQUIRED',message:'No existing store task',retryable:false}});
  f.client.getOrdinaryCnyOperation=async()=>{throw new Error('Completed source receipt must not need another read');};f.client.inspectOrdinaryCnyOperation=async()=>{throw new Error('Completed source receipt must not need another inspect');};
  f.client.submitOrdinaryCnyPrice=async(input)=>{
   submissions++;sourceOperationId=input.operationId;const intent=f.port('c').get('operations',sourceOperationId)!;assert.equal(intent.ordinaryCny.sourceOperationId,sourceOperationId);assert.equal(f.store.get('operations',sourceOperationId)?.state,'dispatching');assert.deepEqual(input.products,[{productId:1,offerId:'A',price:'0.07'}]);
   return {status:'ok',stage:'verified',raw:{id:input.operationId,storeId:input.storeId,kind:'ordinary',actionId:0,products:input.products.map(product=>({...product,stock:'0'})),results:input.products.map(product=>({...product,stock:'0',status:'verified',reason:'',actualMinor:7,sellerMinor:7})),status:'finished',error:null,title:'Original ordinary fixture',createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:05:00Z',requestId:`human-promo-${input.operationId}`,additive:{preserved:true}}};
  };
  const input={...priceInput,price:0.07,currency:'CNY'},first=await f.invoke('hallmark.api.products.update_price',input,{idempotencyKey:'cny-api'});assert.equal(first.status,'ok',JSON.stringify(first));assert.equal(first.operation?.operationId,sourceOperationId);assert.equal(data(first).ordinaryCny.sourceOperationId,sourceOperationId);assert.equal(data(first).items[0].observedMinor,7);assert.match(data(first).items[0].verificationBasis,/历史 price-state/);assert.deepEqual(data(first).ordinaryCny.write.raw.additive,{preserved:true});assert.equal(submissions,1);assert.equal(f.calls.length,0);
  const again=await f.invoke('hallmark.api.products.update_price',input,{idempotencyKey:'cny-api'});assert.equal(again.operation?.operationId,sourceOperationId);assert.equal(submissions,1);
  const invalid=await f.invoke('hallmark.api.products.update_price',{...input,price:1.005},{idempotencyKey:'invalid-cny-api'});assert.equal(invalid.status,'needs_clarification');if(invalid.status==='needs_clarification')assert.deepEqual(invalid.missing,['price']);assert.equal(submissions,1);assert.equal(f.calls.length,0);
 } finally {await f.runtime.dispose();f.store.close();}
});
test('connection namespaces isolate snapshots and retain stale data when refresh is unavailable',async()=>{
 const f=fixture();try{await f.invoke('hallmark.products.list',{storeId:'shop'});assert.equal(f.port('d').get('snapshots','store_products:shop'),undefined);const before=f.port('c').get('snapshots','store_products:shop');f.down();const refresh=await f.invoke('hallmark.datasets.refresh',{datasetKey:'store_products:shop'});assert.equal(refresh.status,'unavailable');assert.deepEqual(f.port('c').get('snapshots','store_products:shop')?.payload,before?.payload);assert.equal(f.port('c').get('snapshots','store_products:shop')?.lastSuccessAt,before?.lastSuccessAt);const cached=await f.invoke('hallmark.products.list',{storeId:'shop'});assert.equal(cached.status,'ok');assert.equal(cached.provenance?.[0].freshness,'stale');assert.equal(f.calls.length,0);}finally{await f.runtime.dispose();f.store.close();}
});


test('platform synchronization coalesces while pagination reads the last complete snapshot',async()=>{
 const f=fixture();let release!:()=>void,started!:()=>void;const entered=new Promise<void>(resolve=>started=resolve);let syncs=0;
 try{
  const before=data(await f.invoke('hallmark.products.list',{storeId:'shop',limit:1}));
  f.client.syncStoreProducts=async()=>{syncs++;started();await new Promise<void>(resolve=>release=resolve);return ok({});};
  const first=f.invoke('hallmark.datasets.refresh',{datasetKey:'store_products:shop'});await entered;
  const second=f.invoke('hallmark.datasets.refresh',{datasetKey:'store_products:shop'});
  const page=await Promise.race([f.invoke('hallmark.products.list',{storeId:'shop',cursor:before.cursor,limit:1}),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Pagination blocked by platform sync')),1000))]);
  assert.equal(data(page).products[0].offerId,'B');assert.equal(syncs,1);assert.equal(f.port('c').get('snapshots','store_products:shop')?.state,'refreshing');
  release();const results=await Promise.all([first,second]);assert.ok(results.every(result=>result.status==='ok'));assert.equal(syncs,1);assert.equal(data(results[0]).timings.syncMs>=0,true);assert.equal(f.port('c').get('snapshots','store_products:shop')?.state,'ready');
 }finally{release?.();await f.runtime.dispose();f.store.close();}
});
