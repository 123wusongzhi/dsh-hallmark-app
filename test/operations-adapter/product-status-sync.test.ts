import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {businessHash} from '../../packages/app-hallmark/src/operations/index.ts';
import {businessConnectedClient,businessProductSaleState,businessProductStatus,recordBusinessProductObservations} from '../../packages/app-hallmark/src/operations-client.ts';
import type {AdapterResponse,CoreClient,RecordData} from '../../packages/core/src/types.ts';
import type {OzonBusinessGateway} from '../../packages/ozon-business/src/index.ts';

const product=(overrides:RecordData={}):RecordData=>({id:100,offer_id:'offer',sku:200,statuses:{is_created:true,moderate_status:'approved',status:'price_sent'},stocks:{has_stock:false,stocks:[]},errors:[],...overrides});
const response=(items:RecordData[]):AdapterResponse=>({status:'ok',raw:{response:{items}}});
function fixture(){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'status-fixture');let reads=0,read:()=>Promise<AdapterResponse>=async()=>response([product()]);
 const gateway={listStores:()=>[{id:'bill',name:'Bill',sourceConnectionId:'connection'}],getProducts:async()=>{reads++;return read();},request:async()=>{throw Error('status refresh must not read prices, attributes or source data');}} as unknown as OzonBusinessGateway;
 const client=()=>businessConnectedClient({} as CoreClient,gateway,store,'connection');
 const saved=()=>store.get<RecordData>('business_catalog',businessHash(['bill','offer']))!;
 return {database,store,gateway,client,saved,reads:()=>reads,setRead:(fn:typeof read)=>{read=fn;}};
}

test('native failure, unfinished card, sale, empty stock and archive have distinct states',()=>{
 const cases:Array<[RecordData,string,string]>=[
  [product(),'out_of_stock','not_sellable'],
  [product({statuses:{is_created:false,moderate_status:'',status_failed:'imported',validation_status:'pending'},errors:[{attribute_id:85,code:'error_attribute_values_out_of_range',level:'ERROR_LEVEL_ERROR'}]}),'failed','rejected'],
  [product({errors:[{code:'error_attribute_values_out_of_range'}]}),'failed','rejected'],
  [product({statuses:{is_created:false,moderate_status:'approved'}}),'pending','pending'],
  [product({statuses:{is_created:false,moderate_status:'in-moderating'}}),'pending','pending'],
  [product({statuses:{is_created:true,moderate_status:'declined'}}),'failed','rejected'],
  [product({stocks:{has_stock:true,stocks:[{present:2}]},visibility_details:{has_price:true}}),'on_sale','on_sale'],
  [product({is_archived:true,errors:[{code:'ATTRIBUTE_INVALID'}]}),'archived','archived'],
  [product({is_autoarchived:true}),'archived','archived'],
  [product({statuses:{status:'archived',status_failed:'imported'}}),'archived','archived'],
  [product({statuses:{},stocks:{has_stock:false}}),'unknown','unknown'],
 ];
 for(const [value,saleState,status] of cases){assert.equal(businessProductSaleState(value),saleState,JSON.stringify(value));assert.equal(businessProductStatus(value),status);}
 assert.equal(businessProductSaleState(product({errors:[{level:'ERROR_LEVEL_WARNING',code:'notice'}]})),'out_of_stock');
});

test('exact observations preserve procurement and commercial facts, retain history, and refuse conflicting identities',()=>{
 const f=fixture();try{
  const preserved={sources:[{productId:'source',sourceSkuMatched:true,skuCode:'red'}],procurementBinding:{amount:7,currency:'CNY'},profit:{purchaseMinor:700},price:'25.00',pricing:{sellerMinor:2500}};
  f.store.put('business_catalog',businessHash(['bill','offer']),{storeId:'bill',offerId:'offer',productId:'100',...preserved});
  assert.deepEqual(recordBusinessProductObservations(f.store,'bill',[product()], '2026-10-10T10:00:00.000Z'),{updated:1,ignored:0});
  for(const [key,value] of Object.entries(preserved))assert.deepEqual(f.saved()[key],value);
  assert.equal(f.saved().saleState,'out_of_stock');assert.equal(f.saved().observedAt,'2026-10-10T10:00:00.000Z');
  assert.deepEqual(f.saved().listingHistory,{created:true,approved:true,observedAt:'2026-10-10T10:00:00.000Z'});
  recordBusinessProductObservations(f.store,'bill',[product({is_archived:true,statuses:{}})],'2026-10-10T10:01:00.000Z');
  assert.equal(f.saved().saleState,'archived');assert.equal(f.saved().listingHistory.created,true);
  const before=f.saved();assert.deepEqual(recordBusinessProductObservations(f.store,'bill',[product({id:999})]),{updated:0,ignored:1});assert.deepEqual(f.saved(),before);
  assert.deepEqual(recordBusinessProductObservations(f.store,'bill',[{id:100,name:'same title'}]),{updated:0,ignored:1});
 }finally{f.database.close();}
});

test('lightweight refresh merges concurrent readers, uses five-minute TTL, and supports an explicit refresh',async()=>{
 const f=fixture();try{
  let finish!:(value:AdapterResponse)=>void;f.setRead(()=>new Promise(resolve=>{finish=resolve;}));
  const first=f.client(),second=f.client(),a=first.syncBusinessProductStates('bill'),b=second.syncBusinessProductStates('bill');
  assert.equal(f.reads(),1);finish(response([product()]));const [one,two]=await Promise.all([a,b]);assert.deepEqual(one,two);assert.equal(one.state,'fresh');
  assert.equal(Date.parse(one.expiresAt!)-Date.parse(one.observedAt!),300000);
  await second.syncBusinessProductStates('bill');assert.equal(f.reads(),1);
  f.setRead(async()=>response([product({is_archived:true})]));await first.syncBusinessProductStates('bill',{refresh:true});assert.equal(f.reads(),2);assert.equal(f.saved().saleState,'archived');
  await first.syncBusinessProductStates('bill',{maxAgeMs:0});assert.equal(f.reads(),3);
 }finally{f.database.close();}
});

test('a complete missing item becomes unknown without losing its binding or history',async()=>{
 const f=fixture();try{
  recordBusinessProductObservations(f.store,'bill',[product()]);f.store.put('business_procurement_bindings','binding',{storeId:'bill',target:{offerId:'offer',productId:'100'},binding:{amount:7,currency:'CNY',components:[{itemId:'source',sourceSkuId:'red',quantity:1}]}});
  f.setRead(async()=>response([]));const sync=await f.client().syncBusinessProductStates('bill');
  assert.equal(sync.state,'fresh');assert.equal(sync.missing,1);assert.equal(f.saved().saleState,'unknown');assert.equal(f.saved().status,'unknown');assert.equal(f.saved().statusObservation,'missing');
  assert.equal(f.saved().listingHistory.created,true);assert.equal(f.saved().procurementBinding.amount,7);assert.equal(f.saved().sources[0].sourceSkuMatched,true);assert.equal(f.store.list('business_procurement_bindings').length,1);
 }finally{f.database.close();}
});

test('failed or invalid refresh never claims freshness and keeps the last observed state and identity',async()=>{
 const f=fixture();try{
  const client=f.client(),success=await client.syncBusinessProductStates('bill'),before=f.saved();
  f.setRead(async()=>({status:'unavailable',error:{code:'OZON_UNAVAILABLE',message:'fixture unavailable',retryable:true}}));
  const failed=await client.syncBusinessProductStates('bill',{refresh:true});assert.equal(failed.state,'failed');assert.equal(failed.observedAt,success.observedAt);assert.equal(failed.expiresAt,failed.attemptedAt);
  assert.equal(f.saved().observedAt,before.observedAt);assert.equal(f.saved().saleState,'out_of_stock');assert.equal(f.saved().statusObservation,'stale');
  f.setRead(async()=>response([product({id:999})]));assert.equal((await client.syncBusinessProductStates('bill')).error?.code,'PRODUCT_IDENTITY_MISMATCH');assert.equal(f.saved().productId,'100');
  f.setRead(async()=>response([product(),product()]));assert.equal((await client.syncBusinessProductStates('bill')).error?.code,'PRODUCT_CATALOG_INVALID');
 }finally{f.database.close();}
});

test('full catalogue refresh records the same state metadata while enriching commercial facts',async()=>{
 const f=fixture();try{
  f.gateway.request=async(_id,input)=>({status:'ok',raw:{response:input.path.includes('/prices')?{items:[{offer_id:'offer',product_id:100,price:{price:'25.00',marketing_seller_price:'25.00',currency_code:'CNY'}}]}:{result:[{offer_id:'offer',id:100,weight:50,weight_unit:'g'}]}}});
  const result=await f.client().getStoreProducts();assert.equal(result.status,'ok');assert.equal(f.saved().saleState,'out_of_stock');assert.equal(f.saved().price,'25.00');assert.equal(f.store.get<RecordData>('business_catalog_status_sync','bill')?.state,'fresh');
 }finally{f.database.close();}
});

test('archive observations retain already stored native creation evidence and an unrelated connection cannot stale it',async()=>{
 const f=fixture();try{
  f.store.put('business_catalog',businessHash(['bill','offer']),{storeId:'bill',offerId:'offer',productId:'100',platformProduct:product(),observedAt:'2026-10-10T10:00:00.000Z'});
  recordBusinessProductObservations(f.store,'bill',[product({is_archived:true,statuses:{}})],'2026-10-10T11:00:00.000Z');
  assert.deepEqual(f.saved().listingHistory,{created:true,approved:true,observedAt:'2026-10-10T10:00:00.000Z'});
  const before=f.saved(),unrelated=businessConnectedClient({} as CoreClient,f.gateway,f.store,'another-connection');
  const denied=await unrelated.syncBusinessProductStates('bill');assert.equal(denied.error?.code,'STORE_CONNECTION_MISMATCH');assert.deepEqual(f.saved(),before);assert.equal(f.reads(),0);
 }finally{f.database.close();}
});

test('a legacy on-sale fact survives archive without inventing native creation or moderation flags',()=>{
 const f=fixture();try{
  f.store.put('business_catalog',businessHash(['bill','offer']),{storeId:'bill',offerId:'offer',productId:'100',status:'on_sale'});
  recordBusinessProductObservations(f.store,'bill',[product({is_archived:true,statuses:{}})]);
  assert.equal(f.saved().listingHistory.legacyOnSale,true);assert.equal(f.saved().listingHistory.created,false);assert.equal(f.saved().listingHistory.approved,false);
  recordBusinessProductObservations(f.store,'bill',[product({is_archived:false,statuses:{is_created:false,status_failed:'imported'}})]);
  assert.equal(f.saved().saleState,'failed');assert.equal(f.saved().listingHistory.legacyOnSale,true);
 }finally{f.database.close();}
});

test('direct product detail reads update observations, while other endpoints and failed reads do not',async()=>{
 const f=fixture();try{
  recordBusinessProductObservations(f.store,'bill',[product()]);
  let next:AdapterResponse={status:'ok',raw:{outcome:'succeeded',response:{result:{items:[product({is_archived:true})]}}}};
  f.gateway.request=async()=>next;
  const client=f.client(),input={requestId:'read-fixture',agentId:'fixture',path:'/v3/product/info/list',method:'POST' as const,body:{product_id:[100]}};
  const result=await client.storeDataRead('bill',input);
  assert.equal(result.raw?.outcome,'response_received');assert.equal(f.saved().saleState,'archived');assert.equal(f.saved().statusObservation,'observed');
  const archived=f.saved();next=response([product()]);
  await client.storeDataRead('bill',{...input,path:'/v5/product/info/prices'});assert.deepEqual(f.saved(),archived);
  next={status:'unavailable',raw:{response:{items:[product()]}},error:{code:'UNAVAILABLE',message:'fixture failure',retryable:true}};
  assert.equal((await client.storeDataRead('bill',input)).status,'unavailable');assert.deepEqual(f.saved(),archived);
  assert.equal(f.reads(),0,'a targeted detail read never triggers a full catalogue scan');
 }finally{f.database.close();}
});
