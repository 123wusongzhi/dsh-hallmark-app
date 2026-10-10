import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppsPresentationService } from '../../packages/app-presentation/src/index.ts';
import { createAppsServer } from '../../packages/service/src/apps-server.ts';
import { AppsRuntime, RuntimeStore } from '../../packages/app-runtime/src/index.ts';
import { HallmarkProvider, HallmarkStorePort, HALLMARK_DESCRIPTORS, HALLMARK_API_OPERATIONS, LEGACY_TOOL_MAP } from '../../packages/app-hallmark/src/index.ts';
import { TOOL_DEFINITIONS } from '../../packages/contracts/src/index.ts';
import { compileCapability } from '../../packages/app-contracts/src/index.ts';
import type { InvocationRequest, CapabilityResult } from '../../packages/app-contracts/src/index.ts';
import type { CoreClient, CoreBroker, AdapterResponse } from '../../packages/core/src/types.ts';
import type { OzonBusinessGateway, OzonBusinessRequest, OzonBusinessStore } from '../../packages/ozon-business/src/index.ts';

const ok=(raw:any):AdapterResponse=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',endpoint:'/fixture',fetchedAt:'2026-10-07T00:00:00Z'}});
function fixture(){
 const store=new RuntimeStore(':memory:'),ports=new Map<string,HallmarkStorePort>(),calls:any[]=[];let unknown=false,price='100',currency='RUB',unavailable=false,executes=0,direct=false;
 const port=(id:string)=>{let value=ports.get(id);if(!value){value=new HallmarkStorePort(store,id);ports.set(id,value);}return value;};
 const readResponse=()=>ok({outcome:'response_received',httpStatus:200,response:{result:{items:[{id:1,product_id:1,sku:101,offer_id:'A',price:{price,currency_code:currency}}]}}});
 const client:CoreClient={getStores:async()=>ok([{id:'shop',shopName:'Shop'}]),getStoreProducts:async()=>unavailable?{status:'unavailable',error:{code:'DOWN',message:'Down',retryable:true}}:ok({stores:[{id:'shop'}],products:[{storeId:'shop',offerId:'A',productId:1,price:100,profit:{costMinor:5000,profitMinor:1000,actualMargin:0.1},original:{preserved:true}},{storeId:'shop',offerId:'B',productId:2,profit:{costMinor:null,actualMargin:1}}]}),syncStoreProducts:async()=>unavailable?{status:'unavailable',error:{code:'DOWN',message:'Down',retryable:true}}:ok({}),getTargetMargin:async()=>ok({targetMargin:0.2}),searchCollectedItems:async()=>ok([{id:'item',title:'Original',skuCount:1}]),getCollectedItem:async(id)=>ok({id,content:'{}',truncated:false}),platformCall:async(taskId,input)=>{calls.push({write:true,taskId,...input});if(unknown)price='50';return unknown?{status:'unknown',error:{code:'OUTCOME_UNKNOWN',message:'timeout',retryable:false}}:ok({outcome:'response_received',httpStatus:200,response:{result:[{updated:true}]}});},platformRead:async(taskId,input)=>{calls.push({write:false,taskId,...input});return readResponse();}};
 const directStore:OzonBusinessStore={id:'shop',name:'Shop',platform:'ozon',enabled:true,revision:1,credentialRevision:1,hasCredentials:true,sourceConnectionId:'c',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'};
 const directWrites=new Set(['/v1/product/import/prices','/v3/product/import','/v2/products/stocks','/v1/product/archive','/v1/product/unarchive','/v1/actions/products/update','/v2/actions/products/deactivate']);
 const gateway={listStores:()=>[directStore],hasStore:(id:string)=>id==='shop',getStore:(id:string)=>id==='shop'?directStore:undefined,
  getProducts:async()=>ok({response:{items:[{id:1,product_id:1,sku:101,offer_id:'A',price:{price,currency_code:currency}}]}}),
  request:async(storeId:string,input:OzonBusinessRequest)=>{assert.equal(storeId,'shop');const write=directWrites.has(input.path);calls.push({transport:'ozon-direct',storeId,write,...input});if(!write)return readResponse();if(unknown){price='50';return {status:'unknown' as const,error:{code:'OUTCOME_UNKNOWN',message:'timeout',retryable:false}};}if(input.path==='/v1/product/import/prices')price=String((input.body?.prices as any[])[0].price);return ok({outcome:'response_received',httpStatus:200,response:{result:[{updated:true}]}});}
 } as unknown as OzonBusinessGateway;
 const broker:CoreBroker={getStoreTask:async()=>ok({taskId:'task'}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind:string,id:string,index:number)=>`${kind}-${id}-${index}`},provider=new HallmarkProvider({store:port,client,broker,businessGateway:()=>direct?gateway:undefined,inspectOperation:(id,signal)=>runtime.inspect(id,signal)});
 const original=provider.execute.bind(provider);provider.execute=async(context)=>{executes++;return original(context);};
 const runtime=new AppsRuntime(store);runtime.register(provider);
 for(const connectionId of ['c','d']){runtime.addConnection({appId:'hallmark',connectionId,displayName:connectionId,config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId,enabled:true,boundAt:new Date().toISOString()});}
 const invoke=(capabilityId:string,input:any={},extra:Partial<InvocationRequest>={})=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+60000).toISOString(),...extra});
 return {store,ports,port,provider,runtime,client,broker,gateway,calls,invoke,readResponse,enableDirect:()=>{direct=true;provider.invalidateConnection('c');provider.invalidateConnection('d');},executes:()=>executes,setUnknown:()=>{unknown=true;},confirm:()=>{price='100';},setPrice:(value:string,code='RUB')=>{price=value;currency=code;},down:()=>{unavailable=true;}};
}
function data(result:CapabilityResult):any{assert.ok('data' in result,JSON.stringify(result));return result.data;}
test('collection tools refresh status automatically and reuse it; precise native observations feed legacy cards',async()=>{
 const f=fixture();try{
  f.enableDirect();let refreshes=0;
  const product:any={id:1,offer_id:'A',sku:101,is_archived:false,statuses:{is_created:true,moderate_status:'approved',validation_status:'success',status_name:'Готов к продаже'},stocks:{has_stock:false},errors:[]};
  f.port('c').put('business_catalog','fixture',{storeId:'shop',offerId:'A',productId:'1',profit:{purchaseMinor:498},sources:[{productId:'item',skuCode:'sku-1',sourceSkuMatched:true}]});
  (f.gateway as any).getProducts=async()=>{refreshes++;return ok({response:{items:[product]}});};
  (f.gateway as any).request=async(_id:string,input:OzonBusinessRequest)=>{assert.equal(input.path,'/v3/product/info/list');return ok({response:{items:[product]}});};
  const first=data(await f.invoke('hallmark.collection.search',{store:{id:'shop',saleState:'out_of_stock'}}));
  assert.equal(first.items[0].listedIn[0].saleStates.out_of_stock,1);assert.equal(first.items[0].listedIn[0].status,'listed');
  await f.invoke('hallmark.collection.search',{});assert.equal(refreshes,1);
  product.is_archived=true;await f.invoke('hallmark.api.products.info',{storeId:'shop',body:{product_id:[1]}});
  const legacy=data(await f.invoke('hallmark.collected.search',{limit:10}));
  assert.equal(refreshes,1);assert.equal(legacy.items[0].listedIn[0].saleStates.archived,1);assert.equal(legacy.items[0].listedIn[0].association,'linked');
  assert.equal(legacy.items[0].listedIn[0].storeName,'Shop');
  assert.equal(f.port('c').get<any>('snapshots',legacy.datasetKey).payload.items[0].listedIn[0].saleStates.archived,1);
  product.is_archived=false;product.stocks.has_stock=true;product.statuses.status_name='Продается';
  const observed=await f.invoke('hallmark.platform.read',{storeId:'shop',path:'/v3/product/info/list',method:'POST',body:{product_id:[1]}});assert.equal(observed.status,'ok');
  const active=data(await f.invoke('hallmark.collection.search',{store:{id:'shop',saleState:'on_sale'}}));assert.equal(active.items[0].listedIn[0].saleStates.on_sale,1);assert.equal(refreshes,1);
  product.is_archived=true;
  const fresh=data(await f.invoke('hallmark.collection.search',{refresh:true,store:{id:'shop',saleState:'archived'}}));assert.equal(refreshes,2);assert.equal(fresh.items.length,1);
  const refreshed=data(await f.invoke('hallmark.datasets.refresh',{datasetKey:legacy.datasetKey}));assert.equal(refreshes,3);
  assert.equal(refreshed.items[0].listedIn[0].saleStates.archived,1);assert.equal(refreshed.counts.items,1);assert.equal(refreshed.snapshot.datasetKey,legacy.datasetKey);
  assert.equal(f.port('c').get<any>('snapshots',legacy.datasetKey).payload.items[0].listedIn[0].saleStates.archived,1);
 }finally{await f.runtime.dispose();f.store.close();}
});
test('failed first history import makes record lookup unavailable and recovers without Agent work',async()=>{
 const f=fixture();try{
  f.enableDirect();(f.gateway.getStore('shop') as any).legacyStoreId='legacy-shop';
  f.client.getStoreProducts=async()=>({status:'unavailable',error:{code:'DOWN',message:'Down',retryable:true}});
  const failed=data(await f.invoke('hallmark.collection.search',{store:{id:'shop',listingRecord:'not_found'}}));
  assert.equal(failed.total,null);assert.equal(failed.recordLookup.status,'unavailable');assert.equal(failed.recordLookup.unavailableItems,1);
  assert.equal(f.port('c').get<any>('business_catalog_status_sync','shop').error.code,'LISTING_HISTORY_READ_FAILED');
  f.client.getStoreProducts=async()=>ok({products:[]});
  const recovered=data(await f.invoke('hallmark.collection.search',{store:{id:'shop',listingRecord:'not_found'}}));
  assert.equal(recovered.total,1);assert.equal(recovered.recordLookup.status,'complete');assert.equal(recovered.items[0].listedIn[0].listingRecord,'not_found');
 }finally{await f.runtime.dispose();f.store.close();}
});

test('SKU reads retain exact item identity and source prices without inventing variant rows',async()=>{
 const f=fixture();try{
  f.client.getCollectedItemDetail=async id=>ok({id,title:'采集商品',currency:'CNY',skus:[{sourceSkuId:'sku-1',spec:'颜色:蓝色',price:22.68,image:'https://example.com/blue.jpg'},{sourceSkuId:'sku-2',spec:'颜色:白色'}]});
  const collected=data(await f.invoke('hallmark.collected.skus',{itemId:'item'}));
  assert.equal(collected.items[0].productId,'item');assert.equal(collected.items[0].price,22.68);assert.equal(collected.items[0].currency,'CNY');assert.equal(collected.items[1].price,null);
  f.client.getStoreProducts=async()=>ok({stores:[{id:'shop'}],products:[{storeId:'shop',productId:1,sku:'platform-sku',title:'店铺商品',currency:'CNY',pricing:{sellerMinor:4497,currency:'CNY'},sources:[{sourceSkuMatched:false,sourceSpec:'错误规格'},{sourceSkuMatched:true,sourceSpec:'颜色:蓝色'}]}]});
  const listed=data(await f.invoke('hallmark.products.skus',{storeId:'shop',productId:'1'}));
  assert.equal(listed.total,1);assert.equal(listed.items[0].price,44.97);assert.equal(listed.items[0].spec,'颜色:蓝色');
  assert.equal(data(await f.invoke('hallmark.products.skus',{storeId:'shop',productId:'unknown'})).total,0);
 }finally{await f.runtime.dispose();f.store.close();}
});
const priceInput={storeId:'shop',offerIds:['A'],price:100,currency:'RUB',valueSource:'user',userRequest:'把 A 价格改为 100 RUB'};

test('Ozon business reads execute through store gateway with schema validation, no listing task and timezone-safe provenance',async()=>{
 const f=fixture();try{
  let taskCalls=0;f.broker.getStoreTask=async()=>{taskCalls++;throw new Error('must not obtain listing task');};
  (f.client as any).storeDataRead=async(storeId:string,input:any)=>ok({storeId,outcome:'response_received',httpStatus:200,response:input.path==='/v1/analytics/data'?{result:{data:[{dimensions:[{id:'1',name:'Product'},{id:'2026-09-01'}],metrics:[1,2,3,4,5]}]},timestamp:'2026-09-02 12:00:00'}:{items:[{product_id:1,price:{price:'100',marketing_seller_price:'80',currency_code:'CNY'}}],total:1}});
  const prices=data(await f.invoke('hallmark.ozon.prices',{storeId:'shop'}));assert.equal(prices.items[0].price,80);assert.equal(prices.items[0].ordinaryPrice,100);
  const analytics=await f.invoke('hallmark.ozon.analytics',{storeId:'shop',dateFrom:'2026-09-01',dateTo:'2026-09-02'});assert.equal(analytics.status,'ok',JSON.stringify(analytics));assert.equal(analytics.provenance?.[0].sourceDataTime,null);assert.equal(taskCalls,0);
  assert.equal((await f.invoke('hallmark.ozon.prices',{storeId:'shop',body:{}})).status,'failed');
 }finally{await f.runtime.dispose();f.store.close();}
});

test('content rating reads only direct Ozon credentials and never falls back to Hallmark',async()=>{
 const f=fixture();try{
  const noStore=await f.invoke('hallmark.ozon.ratings',{storeId:'shop',sku:'101'});assert.equal('error' in noStore?noStore.error?.code:undefined,'OZON_DIRECT_STORE_REQUIRED');
  f.enableDirect();(f.client as any).storeDataRead=async()=>{throw Error('Hallmark channel must not be used');};
  f.broker.getStoreTask=async()=>{throw Error('legacy task must not be used');};
  (f.gateway as any).request=async(storeId:string,input:OzonBusinessRequest)=>{f.calls.push({storeId,...input});return ok({outcome:'succeeded',httpStatus:200,response:input.path==='/v3/product/info/list'?{items:[{id:1,offer_id:'A',sku:101,name:'Shop A',statuses:{status_name:'Продается'}}]}:{products:[{sku:101,rating:78.5}]}});};
  const result=data(await f.invoke('hallmark.ozon.ratings',{storeId:'shop',sku:'101'}));assert.equal(result.items[0].rating,78.5);assert.equal(result.items[0].status,'在售');assert.deepEqual(f.calls.map(call=>call.path),['/v3/product/info/list','/v1/product/rating-by-sku']);
  const wrongStore=await f.invoke('hallmark.ozon.ratings',{storeId:'shop',sku:'101'},{connectionId:'d'});assert.equal('error' in wrongStore?wrongStore.error?.code:undefined,'STORE_CONNECTION_MISMATCH');
 }finally{await f.runtime.dispose();f.store.close();}
});
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
 assert.deepEqual(registered.inputSchema,domain.inputSchema);assert.deepEqual(registered.outputSchema,domain.outputSchema);assert.deepEqual(registered.execution,domain.execution);assert.equal(registered.execution.idempotency,'upstream_supported');assert.equal(registered.execution.completionEvidence,'readback');
 for(const declaration of ['userRequest','valueSource','scopeConfirmed','clientOperationKey'])assert.equal((registered.inputSchema.required as string[]??[]).includes(declaration),false);
});
test('Hallmark read/compute preserve source fields, unknown source time and reference profit basis',async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.products.list',{storeId:'shop'});assert.equal(data(result).products[0].original.preserved,true);assert.equal(result.provenance?.[0].sourceDataTime,null);assert.equal(result.provenance?.[0].freshness,'unknown');const profit=await f.invoke('hallmark.products.filter',{storeId:'shop',maxMargin:0.15});assert.equal(data(profit).payload.products.length,1);assert.equal(data(profit).payload.unable[0].referenceProfit.costMissing,true);assert.match(profit.provenance?.[0].metricBasis??'',/非实际结算/);assert.equal(f.calls.length,0);}finally{await f.runtime.dispose();f.store.close();}
});
test('Runtime operation links to the durable business row; retries and conflicts do not execute Provider again',async()=>{
 const f=fixture();f.enableDirect();try{const first=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'price'});assert.equal(first.status,'ok',JSON.stringify(first));const id=first.operation!.operationId,plan=data(first);assert.equal(plan.rows[0].status,'succeeded');assert.equal(f.port('c').get('business_runtime_operations',id)?.planId,plan.planId);assert.equal(f.port('c').get('business_transport_receipts',plan.rows[0].executionId)?.executionId,plan.rows[0].executionId);assert.equal(f.store.list('operations').length,1);const duplicate=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'price'});assert.equal(duplicate.operation?.operationId,id);assert.equal(data(duplicate).planId,plan.planId);const conflict=await f.invoke('hallmark.products.update_price',{...priceInput,price:90},{idempotencyKey:'price'});assert.equal(conflict.status,'failed');if('error' in conflict)assert.equal(conflict.error.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.executes(),1);assert.equal(f.calls.filter(row=>row.write).length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('legacy price inputs need only business fields; program-owned idempotency replaces Agent declarations',async()=>{
 const f=fixture();f.enableDirect();try{const input={storeId:'shop',offerIds:['A'],price:100,currency:'RUB'},result=await f.invoke('hallmark.products.update_price',input);assert.equal(result.status,'ok');assert.equal(data(result).rows[0].status,'succeeded');const operation=f.store.get<any>('operations',result.operation!.operationId)!;assert.match(operation.idempotencyKey,/^provider-intent:/);assert.deepEqual(operation.request.input,input);assert.equal(f.calls.filter(row=>row.write).length,1);}finally{await f.runtime.dispose();f.store.close();}
});
for(const capability of ['hallmark.products.update_price','hallmark.api.products.update_price'])test(`${capability} activity price intent never silently becomes an ordinary price mutation`,async()=>{
 const f=fixture();try{const result=await f.invoke(capability,{...priceInput,actionId:7});assert.equal(f.calls.filter(row=>row.write).length,0,'An activity price request must not write the ordinary price');assert.equal(result.status,'failed');assert.ok('error'in result);assert.equal(result.error.code,'PROMOTION_OPERATION_REQUIRED');assert.match(result.error.message,/promotion.update/);assert.match(result.error.message,/活动配额/);}finally{await f.runtime.dispose();f.store.close();}
});
test('unknown remains inspect_only; explicit readback resolves without submitting again',async()=>{
 const f=fixture();f.enableDirect();try{f.setUnknown();const result=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'uncertain'});assert.equal(result.status,'unknown',JSON.stringify(result));if('error' in result)assert.equal(result.error.retryPolicy,'inspect_only');assert.equal(f.calls.filter(row=>row.write).length,1);const plan=data(await f.invoke('hallmark.plan.get',{operationId:result.operation!.operationId,includeEvidence:true}));assert.equal(plan.rows[0].before.price,'100');assert.equal(plan.rows[0].receipt.observed.price,'50');f.confirm();const confirmed=await f.runtime.inspect(result.operation!.operationId);assert.equal(confirmed.status,'ok',JSON.stringify(confirmed));assert.equal(data(confirmed).rows[0].status,'succeeded');assert.equal(f.calls.filter(row=>row.write).length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('legacy operation query recovers a business plan and clears the Runtime unknown ledger without re-sending',async()=>{
 const f=fixture();f.enableDirect();try{f.setUnknown();const result=await f.invoke('hallmark.products.update_price',priceInput);assert.equal(result.status,'unknown');const id=result.operation!.operationId;f.confirm();const recovered=await f.invoke('hallmark.operations.get',{operationId:id});assert.equal(recovered.status,'ok');assert.equal(data(recovered).rows[0].status,'succeeded');assert.equal(f.store.get<any>('operations',id).state,'succeeded');assert.equal(f.calls.filter(row=>row.write).length,1);
 f.runtime.bind({sessionId:'other',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});const before=f.calls.length;const foreign=await f.invoke('hallmark.operations.get',{operationId:id},{source:{kind:'agent',sessionId:'other',nativeCallId:'foreign'}});assert.equal(foreign.status,'failed');assert.ok('error'in foreign);assert.equal(foreign.error.code,'OPERATION_NOT_FOUND');assert.equal(f.calls.length,before);
 }finally{await f.runtime.dispose();f.store.close();}
});
test('legacy operation list merges old and business receipts without crossing session, connection, store or time filters',async()=>{
 const f=fixture();f.enableDirect();try{
  f.setUnknown();const written=await f.invoke('hallmark.products.update_price',priceInput),id=written.operation!.operationId;
  const legacy={operationId:'old',kind:'update_price',sessionId:'s',storeId:'shop',state:'succeeded',targets:['A'],input:{},items:[],createdAt:'2020-01-01T00:00:00Z',updatedAt:'2020-01-01T00:00:00Z'};
  f.port('c').put('operations','old',legacy);f.port('c').put('operations','foreign',{...legacy,operationId:'foreign',sessionId:'other'});
  const before=f.calls.length,list=data(await f.invoke('hallmark.operations.list',{}));assert.deepEqual(list.map((r:any)=>r.operationId),[id,'old']);assert.equal(list[0].state,'unknown');assert.equal(list[0].items[0].status,'unknown');assert.equal(f.calls.length,before,'listing is a local read, not inspection');
  assert.deepEqual(data(await f.invoke('hallmark.operations.list',{storeId:'other-store'})),[]);assert.deepEqual(data(await f.invoke('hallmark.operations.list',{since:'2021-01-01T00:00:00Z'})).map((r:any)=>r.operationId),[id]);assert.deepEqual(data(await f.invoke('hallmark.operations.list',{limit:1})).map((r:any)=>r.operationId),[id]);assert.deepEqual(data(await f.invoke('hallmark.operations.list',{}, {connectionId:'d'})),[]);
  f.runtime.bind({sessionId:'other',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});assert.deepEqual(data(await f.invoke('hallmark.operations.list',{}, {source:{kind:'agent',sessionId:'other',nativeCallId:'foreign-list'}})).map((r:any)=>r.operationId),['foreign']);
  f.confirm();await f.runtime.inspect(id);assert.equal(data(await f.invoke('hallmark.operations.list',{limit:1}))[0].state,'succeeded');assert.equal(f.calls.filter(row=>row.write).length,1);
 }finally{await f.runtime.dispose();f.store.close();}
});

test('legacy SKU and product references cannot expand the supplied business scope',async()=>{
 const f=fixture();f.enableDirect();try{
  const mismatch=await f.invoke('hallmark.products.update_price',{...priceInput,productIds:['2']});assert.equal(mismatch.status,'failed');assert.ok('error'in mismatch);assert.match(mismatch.error.message,/PRODUCT_SCOPE_NOT_EXACT/);
  const outside=await f.invoke('hallmark.products.list_product',{storeId:'shop',collectedItemId:'item',skuScope:['sku-allowed'],importItems:[{_sourceSkuId:'sku-other',offer_id:'new-offer'}]});assert.equal(outside.status,'failed');assert.ok('error'in outside);assert.match(outside.error.message,/SOURCE_SKU_OUTSIDE_SCOPE/);assert.equal(f.calls.filter(row=>row.write).length,0);
 }finally{await f.runtime.dispose();f.store.close();}
});

test('legacy HTTP accepts business-only inputs, auto-manages keys, and reads back the new operation',async()=>{
 const f=fixture(),token='legacy-http-business-token'.repeat(3),server=createAppsServer({runtime:f.runtime,presentation:new AppsPresentationService({store:f.store,runtime:f.runtime}),token});
 f.enableDirect();
 f.store.put('legacy_aliases','connection:default',{appId:'hallmark',connectionId:'c'});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const invoke=async(name:string,args:Record<string,unknown>,extra:Record<string,unknown>={})=>{const response=await fetch(`http://127.0.0.1:${address.port}/v1/legacy-invocations`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name,arguments:args,sessionId:'s',invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+60000).toISOString(),...extra})});assert.equal(response.status,200);return response.json();};
 try{
  const missing=await invoke('hallmark_update_price',{storeId:'shop',offerIds:['A']});assert.equal(missing.status,'needs_clarification');assert.deepEqual(missing.clarification.missing,['price']);assert.equal(f.calls.filter(row=>row.write).length,0);
  const result=await invoke('hallmark_update_price',{storeId:'shop',offerIds:['A'],price:100});assert.equal(result.status,'ok');assert.equal(result.data.rows[0].status,'succeeded');assert.equal(result.data.rows[0].payload.currency_code,'RUB');assert.match(f.store.get<any>('operations',result.operation.operationId).idempotencyKey,/^provider-intent:/);
  const read=await invoke('hallmark_get_operation',{operationId:result.operation.operationId});assert.equal(read.status,'ok');assert.equal(read.data.planId,result.data.planId);assert.equal(f.calls.filter(row=>row.write).length,1);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await f.runtime.dispose();f.store.close();}
});
test('registered API endpoint shares the same domain execution and rejects unknown operation before dispatch',async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.api.warehouses.list',{storeId:'shop',body:{}});assert.equal(result.status,'ok');assert.equal(f.calls[0].path,'/v2/warehouse/list');assert.equal(f.calls[0].write,false);const missing=await f.invoke('hallmark.api.unregistered',{});assert.equal(missing.status,'failed');assert.equal(f.executes(),1);assert.equal(f.calls.length,1);}finally{await f.runtime.dispose();f.store.close();}
});
test('native direct read receipts preserve warehouse data while projecting the legacy outcome schema',async()=>{
 const f=fixture();f.enableDirect();let directReads=0;
 try{
  const native={outcome:'succeeded',httpStatus:200,credentialRevision:1,response:{result:[{warehouse_id:7,name:'W'}]}},original=structuredClone(native);
  f.broker.getStoreTask=async()=>{throw Error('Independent warehouse reads must not obtain an old task');};
  f.client.platformRead=async()=>{throw Error('Independent warehouse reads must not use the old task transport');};
  f.gateway.request=async(storeId,input)=>{directReads++;assert.equal(storeId,'shop');assert.equal(input.path,'/v2/warehouse/list');assert.equal(input.method,'POST');assert.deepEqual(input.body,{});return ok(native);};
  for(const [capability,input] of [
   ['hallmark.api.warehouses.list',{storeId:'shop'}],
   ['hallmark.platform.read',{storeId:'shop',path:'/v2/warehouse/list',method:'POST',body:{}}],
  ] as const){
   const result=await f.invoke(capability,input);assert.equal(result.status,'ok',JSON.stringify(result));const receipt=data(result);
   assert.equal(receipt.outcome,'response_received');assert.equal(receipt.httpStatus,200);assert.equal(receipt.credentialRevision,1);assert.deepEqual(receipt.response,native.response);
  }
  assert.equal(directReads,2);assert.equal(f.calls.length,0);assert.deepEqual(native,original,'Compatibility projection must not rewrite the gateway receipt');
 }finally{await f.runtime.dispose();f.store.close();}
});

test('legacy activity query prefers the store gateway while retaining its raw envelope and operation receipt',async()=>{
 const f=fixture();try{
  let taskCalls=0;f.broker.getStoreTask=async()=>{taskCalls++;throw Error('unrelated listing task must not be read');};
  const response={storeId:'shop',outcome:'response_received',httpStatus:200,response:{result:[{id:7,title:'Activity'}]}};
  (f.client as any).storeDataRead=async(storeId:string,input:any)=>{assert.equal(storeId,'shop');assert.equal(input.path,'/v1/actions');assert.equal(input.method,'GET');return ok(response);};
  const result=await f.invoke('hallmark.api.actions.list',{storeId:'shop',body:{}});assert.deepEqual(data(result),response);assert.equal(taskCalls,0);assert.equal(f.calls.length,0);assert.equal(result.operation?.state,'succeeded');
  const receipt=f.port('c').get('operations',result.operation!.operationId)!;assert.equal(receipt.hallmarkRefs[0].route,'store_data_read');assert.equal(receipt.hallmarkRefs[0].taskId,undefined);
 }finally{await f.runtime.dispose();f.store.close();}
});
test('only a missing local store gateway falls back to legacy task reads; denied, invalid and unknown results do not',async()=>{
 for(const code of ['HALLMARK_HTTP_404','HALLMARK_HTTP_403','PLATFORM_ERROR','OUTCOME_UNKNOWN']){
  const f=fixture();try{
   let directCalls=0,taskCalls=0;f.broker.getStoreTask=async()=>{taskCalls++;return ok({taskId:'task'});};
   (f.client as any).storeDataRead=async()=>{directCalls++;return {status:'failed',error:{code,message:code,retryable:false}};};
   const result=await f.invoke('hallmark.api.actions.list',{storeId:'shop',body:{}});assert.equal(directCalls,1);
   if(code==='HALLMARK_HTTP_404'){assert.equal(result.status,'ok');assert.equal(taskCalls,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].write,false);assert.equal(f.calls[0].path,'/v1/actions');}
   else{assert.equal(result.status,'failed');assert.equal(taskCalls,0);assert.equal(f.calls.length,0);}
  }finally{await f.runtime.dispose();f.store.close();}
 }
});
test('business reads and writes use the independent gateway while old task transport remains unused',async()=>{
 const f=fixture();f.enableDirect();try{
  f.broker.getStoreTask=async()=>{throw Error('new business operation must not obtain an old task');};
  f.client.platformRead=async()=>{throw Error('new business operation must not read an old task');};
  f.client.platformCall=async()=>{throw Error('new business operation must not write an old task');};
  (f.client as any).storeDataRead=async()=>{throw Error('independent store must not use the old read gateway');};
  const imported=await f.invoke('hallmark.api.products.import_inspect',{storeId:'shop',body:{task_id:'existing-import'}});
  assert.equal(imported.status,'ok');assert.equal(f.calls[0].transport,'ozon-direct');assert.equal(f.calls[0].path,'/v1/product/import/info');
  const beforeDenied=f.calls.length;
  assert.equal((await f.invoke('hallmark.platform.read',{storeId:'shop',path:'/v1/product/import/prices',method:'POST',body:{}})).status,'failed');
  assert.equal(f.calls.length,beforeDenied,'A read capability cannot dispatch a write');
  const changed=await f.invoke('hallmark.products.update_price',priceInput,{idempotencyKey:'independent-price-route'});
  assert.equal(changed.status,'ok',JSON.stringify(changed));assert.equal(data(changed).rows[0].status,'succeeded');
  const writes=f.calls.filter(call=>call.write);assert.equal(writes.length,1);
  assert.deepEqual(writes.map(call=>[call.transport,call.storeId,call.path,call.credentialRevision]),[['ozon-direct','shop','/v1/product/import/prices',1]]);
  assert.ok(f.calls.some(call=>!call.write&&call.path==='/v3/product/info/list'));
  assert.ok(f.calls.some(call=>!call.write&&call.path==='/v5/product/info/prices'));
  assert.ok(f.calls.every(call=>call.transport==='ozon-direct'&&call.taskId===undefined));
 }finally{await f.runtime.dispose();f.store.close();}
});

test('registered API CNY prices keep native decimal values and durable direct receipts without legacy fallback or duplicate writes',async()=>{
 const f=fixture();f.enableDirect();let dispatches=0;
 try{
  f.setPrice('100','CNY');
  f.broker.getStoreTask=async()=>{throw Error('CNY price must not need an old task');};
  f.client.submitOrdinaryCnyPrice=async()=>{throw Error('CNY price must not fall back to the old ERP submit route');};
  f.client.getOrdinaryCnyOperation=async()=>{throw Error('new direct receipt has no old ordinary operation');};
  f.client.inspectOrdinaryCnyOperation=async()=>{throw Error('new direct receipt must use direct readback');};
  const original=f.gateway.request.bind(f.gateway);
  f.gateway.request=async(storeId,input,signal)=>{
   if(input.path==='/v1/product/import/prices'){
    dispatches++;assert.equal(f.store.list<any>('operations')[0].state,'dispatching');
    const receipt=f.port('c').list('business_transport_receipts')[0];assert.equal(receipt.transport,'ozon-direct');assert.equal(receipt.dispatchStarted,true);
    assert.equal(receipt.credentialRevision,1);assert.equal(receipt.requestId,receipt.executionId);assert.equal(receipt.taskId,undefined);assert.equal(receipt.ordinaryId,undefined);
    assert.deepEqual(input.body,{prices:[{offer_id:'A',price:'0.07',currency_code:'CNY'}]});
   }
   return original(storeId,input,signal);
  };
  const input={...priceInput,price:0.07,currency:'CNY'};
  const first=await f.invoke('hallmark.api.products.update_price',input,{idempotencyKey:'cny-api'});
  assert.equal(first.status,'ok',JSON.stringify(first));const plan=data(first),row=plan.rows[0];assert.equal(row.status,'succeeded');assert.equal(row.receipt.observed.price,'0.07');
  assert.equal(f.port('c').get('business_runtime_operations',first.operation!.operationId)?.planId,plan.planId);
  assert.equal(f.port('c').get('business_transport_receipts',row.executionId)?.executionId,row.executionId);
  const again=await f.invoke('hallmark.api.products.update_price',input,{idempotencyKey:'cny-api'});
  assert.equal(again.operation?.operationId,first.operation?.operationId);assert.equal(data(again).planId,plan.planId);assert.equal(dispatches,1);
  assert.equal(f.calls.filter(call=>call.write).length,1);assert.ok(f.calls.every(call=>call.transport==='ozon-direct'));
 }finally{await f.runtime.dispose();f.store.close();}
});

test('unconfigured store writes stop at connection setup and never reactivate old task or CNY submit routes',async()=>{
 const f=fixture();let oldWrites=0;
 try{
  f.setPrice('100','CNY');
  f.client.platformCall=async()=>{oldWrites++;throw Error('old task writes must not be used');};
  f.client.submitOrdinaryCnyPrice=async()=>{oldWrites++;throw Error('old CNY writes must not be used');};
  const result=await f.invoke('hallmark.api.products.update_price',{...priceInput,price:50,currency:'CNY'});
  assert.equal(result.status,'ok',JSON.stringify(result));const plan=data(result);assert.equal(plan.rows[0].status,'rejected');
  assert.ok(plan.rows[0].issues.some((issue:any)=>issue.code==='DIRECT_STORE_CONFIGURATION_REQUIRED'));
  assert.equal(oldWrites,0);assert.equal(f.calls.filter(call=>call.write).length,0);assert.equal(f.port('c').list('business_transport_receipts').length,0);
 }finally{await f.runtime.dispose();f.store.close();}
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
