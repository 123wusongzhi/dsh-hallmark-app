import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOzonData,OZON_DESCRIPTORS,hallmarkOzonSources} from '../../packages/app-hallmark/src/ozon-data.ts';
import {hallmarkProductSources} from '../../packages/app-hallmark/src/field-mappings.ts';
import {compileCapability,validateResult} from '../../packages/app-contracts/src/index.ts';
import type {CoreStore,CoreClient,RecordData} from '../../packages/core/src/types.ts';
import type {PlatformCallInput} from '../../packages/hallmark-adapter/types.ts';
import {dataSourceDefinitionIssues} from '../../packages/app-presentation/src/data-sources.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
function fixture(responder:(path:string,body:any,storeId:string)=>any){
 const records=new Map<string,any>(),calls:{storeId:string;input:PlatformCallInput}[]=[];
 const store={get:(collection:string,id:string)=>records.get(`${collection}:${id}`),put:(collection:string,id:string,value:any)=>{records.set(`${collection}:${id}`,structuredClone(value));return value;}} as CoreStore;
 const client={storeDataRead:async(storeId:string,input:PlatformCallInput)=>{calls.push({storeId,input});return {status:'ok' as const,raw:{outcome:'response_received',httpStatus:200,storeId,response:await responder(input.path,input.body,storeId)}};}} as CoreClient&{storeDataRead:any;readOrderWeights?:any};
 return {store,client,calls};
}
function data(result:any):any{assert.equal(result.status,'ok',JSON.stringify(result));return result.data;}
const range={dateFrom:'2026-09-01',dateTo:'2026-09-02'};

test('retryable platform HTTP failures stay distinct from authorization errors',async()=>{
 for(const status of [429,503,408,403]){
  const f=fixture(()=>({}));f.client.storeDataRead=async()=>({status:'failed',raw:{storeId:'s',outcome:'response_received',httpStatus:status},error:{code:'PLATFORM_ERROR',message:`HTTP ${status}`,retryable:true,retryAfterMs:3000}});
  const result=await readOzonData('prices',{storeId:'s'},f.store,f.client);assert.equal(result.status,status===403?'failed':'unavailable');assert.equal(result.error?.retryable,status!==403);if(status!==403)assert.equal(result.error?.retryAfterMs,3000);assert.equal(result.data,undefined);
 }
});
test('eleven sources are store-neutral, all row schemas compile and accept a legitimate empty set',()=>{
 const sources=hallmarkOzonSources('connection');assert.equal(sources.length,11);
 for(const source of sources){assert.equal(source.storeScoped,true);assert.equal(source.input.storeId,undefined);assert.equal(source.parameters.find(p=>p.name==='storeId')?.default,undefined);assert.equal(source.rowsPath,'items');assert.deepEqual(dataSourceDefinitionIssues(source,OZON_DESCRIPTORS.find(d=>d.capabilityId===source.capabilityId)),[],source.title);}
 for(const descriptor of OZON_DESCRIPTORS){assert.doesNotThrow(()=>compileCapability(descriptor));assert.deepEqual(validateResult({invocationId:'i',traceId:'t',status:'ok',data:{items:[],dataTime:null,warnings:[]}},descriptor.outputSchema),[]);}
 assert.deepEqual(hallmarkProductSources('c',{id:'bill',name:'Bill'},'sample'),hallmarkProductSources('c',{id:'helen',name:'Helen'},'other'));
 assert.deepEqual(hallmarkProductSources('c').map(s=>s.id),['hallmark:c:products','hallmark:c:sku','hallmark:c:procurement']);
 assert.equal(hallmarkProductSources('c')[1].parameters.find(p=>p.name==='productId')?.default,undefined);
});
test('content rating joins exact SKU and status, preserves missing rating as unknown across pages',async()=>{
 const f=fixture((path,body)=>{
  if(path==='/v3/product/list')return {result:{items:body.last_id?[{product_id:3}]:[{product_id:1},{product_id:2}],last_id:body.last_id?'':'next',total_items:3}};
  if(path==='/v3/product/info/list')return {items:body.product_id?.includes('3')?[{id:3,sku:33,offer_id:'third',name:'Third',statuses:{status_name:'Продается'}}]:[{id:1,sku:11,offer_id:'one',name:'One',statuses:{status_name:'Продается'}},{id:2,sku:22,offer_id:'two',name:'Two',statuses:{status_name:'Не продается'}}]};
  assert.equal(path,'/v1/product/rating-by-sku');return {products:body.skus.includes('33')?[{sku:33,rating:0}]:[{sku:11,rating:79.5,groups:[{key:'media'}]}]};
 });
 const args={storeId:'bill',limit:2},first=data(await readOzonData('ratings',args,f.store,f.client));
 assert.equal(first.items[0].rating,79.5);assert.equal(first.items[0].status,'在售');assert.equal(first.items[1].rating,null);assert.equal(first.items[1].status,'暂不可售');assert.match(first.warnings[0],/未知/);
 const second=data(await readOzonData('ratings',{...args,cursor:first.cursor},f.store,f.client));assert.equal(second.items[0].rating,0);assert.equal(second.cursor,undefined);
 assert.deepEqual(f.calls.filter(call=>call.input.path==='/v1/product/rating-by-sku').map(call=>(call.input.body as RecordData).skus),[['11','22'],['33']]);
});
test('content rating rejects foreign SKU and invalid scores rather than claiming no low-rated products',async()=>{
 for(const response of [{products:[{sku:22,rating:45}]},{products:[{sku:11,rating:101}]},{products:[{sku:11,rating:null}]}]){
  const f=fixture(path=>path==='/v3/product/info/list'?{items:[{id:1,sku:11}]}:response);
  assert.equal((await readOzonData('ratings',{storeId:'bill',sku:'11'},f.store,f.client)).error?.code,'OZON_RATING_RESPONSE_INVALID');
 }
});
test('prices preserve seller price versus ordinary price, nulls and declared currency',async()=>{
 const f=fixture(()=>({items:[{product_id:10,offer_id:'offer',price:{price:'100',marketing_seller_price:'90',old_price:'120',currency_code:'CNY'}},{product_id:11,price:{price:'20'}}],total:2}));
 const result=data(await readOzonData('prices',{storeId:'shop',limit:2},f.store,f.client));
 assert.deepEqual(result.items[0],{productId:'10',offerId:'offer',price:90,ordinaryPrice:100,oldPrice:120,currency:'CNY'});assert.equal(result.items[1].price,null);assert.equal(result.items[1].currency,null);assert.equal(result.cursor,undefined);
 assert.equal(result.dataTime,null);
});
test('full Ozon source joins all pages, returns the saved snapshot immediately and atomically publishes background refresh',async()=>{
 let phase=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const f=fixture(async(_path,body)=>{if(phase===1&&body.cursor==='next')await gate;return {items:[{product_id:body.cursor==='next'?2:1,price:{price:phase===0?'10':'20',marketing_seller_price:phase===0?'9':'19',currency_code:'CNY'}}],total:2,cursor:body.cursor==='next'?'':'next'};});
 const args={storeId:'shop',loadAll:true},first=data(await readOzonData('prices',args,f.store,f.client));assert.equal(first.total,2);assert.equal(first.items.length,2);assert.equal(first.cursor,undefined);assert.equal(first.cache.ttlMs,900000);assert.equal(f.calls.length,2);
 phase=1;const old=data(await readOzonData('prices',{...args,forceRefresh:true},f.store,f.client));assert.deepEqual(old.items,first.items);assert.equal(old.cache.refreshing,true);await new Promise<void>(resolve=>setImmediate(resolve));assert.deepEqual(data(await readOzonData('prices',args,f.store,f.client)).items,first.items);
 release();await new Promise<void>(resolve=>setImmediate(resolve));const updated=data(await readOzonData('prices',args,f.store,f.client));assert.deepEqual(updated.items.map((row:any)=>row.price),[19,19]);assert.equal(updated.cache.refreshing,false);assert.equal(f.calls.length,4);
});
test('flattened multi-item orders retain all rows across buffer and upstream pages; cursors bind shop and filters',async()=>{
 const f=fixture((path,body)=>({postings:body.offset===0?[{order_id:1,posting_number:'p1',products:[{sku:1,quantity:1},{sku:2,quantity:2},{sku:3,quantity:1}]}]:[{order_id:2,posting_number:'p2',products:[{sku:4,quantity:1}]}],has_next:body.offset===0}));
 const input={storeId:'bill',limit:2,...range},first=data(await readOzonData('orders',input,f.store,f.client));assert.deepEqual(first.items.map((x:any)=>x.sku),['1','2']);
 const foreign=await readOzonData('orders',{...input,storeId:'helen',cursor:first.cursor},f.store,f.client);assert.equal(foreign.error?.code,'INVALID_CURSOR');
 const changed=await readOzonData('orders',{...input,dateTo:'2026-09-03',cursor:first.cursor},f.store,f.client);assert.equal(changed.error?.code,'INVALID_CURSOR');assert.equal(f.calls.length,1);
 const second=data(await readOzonData('orders',{...input,cursor:first.cursor},f.store,f.client));assert.deepEqual(second.items.map((x:any)=>x.sku),['3']);assert.equal(f.calls.length,1);
 const third=data(await readOzonData('orders',{...input,cursor:second.cursor},f.store,f.client));assert.deepEqual(third.items.map((x:any)=>x.sku),['4']);assert.equal(third.cursor,undefined);assert.equal((f.calls[1].input.body as RecordData).offset,1);
});
test('unknown upstream shapes and incomplete product joins fail instead of manufacturing an empty page',async()=>{
 let f=fixture(()=>({unexpected:[]}));assert.equal((await readOzonData('prices',{storeId:'s'},f.store,f.client)).error?.code,'OZON_RESPONSE_INVALID');
 f=fixture(path=>path==='/v3/product/list'?{result:{items:[{product_id:1}],total:1}}:{items:[]});assert.equal((await readOzonData('products',{storeId:'s'},f.store,f.client)).error?.code,'OZON_PRODUCT_JOIN_INCOMPLETE');
});
test('price pagination rejects stalled tokens and does not discard missing continuation evidence',async()=>{
 const f=fixture(()=>({items:[{product_id:1,price:{}}],cursor:'same'}));const first=data(await readOzonData('prices',{storeId:'s',limit:1},f.store,f.client));
 assert.equal((await readOzonData('prices',{storeId:'s',limit:1,cursor:first.cursor},f.store,f.client)).error?.code,'OZON_PAGINATION_STALLED');
 const g=fixture(()=>({items:[{product_id:1,price:{}}]}));assert.equal((await readOzonData('prices',{storeId:'s',limit:1},g.store,g.client)).error?.code,'OZON_PAGINATION_MISSING');
});
test('analytics carries exact date/dimension/metric order and preserves zero instead of null',async()=>{
 const f=fixture(()=>({result:{data:[{dimensions:[{id:'123',name:'Product'},{id:'2026-09-01'}],metrics:[0,1,2,3,4]}]},timestamp:'2026-09-03 10:00:00'}));const result=data(await readOzonData('analytics',{storeId:'s',...range},f.store,f.client));
 assert.equal(result.items[0].impressions,0);assert.equal(result.items[0].orderedUnits,3);assert.equal(result.items[0].visitors,4);assert.deepEqual((f.calls[0].input.body as RecordData).dimension,['sku','day']);assert.deepEqual(result.period,range);
 const before=f.calls.length;assert.equal((await readOzonData('analytics',{storeId:'s',dateFrom:'2026-02-30',dateTo:'2026-03-01'},f.store,f.client)).error?.code,'INVALID_DATE_RANGE');assert.equal(f.calls.length,before);
});
test('period SKU analytics uses one 1000-row upstream batch and buffers user-sized pages without a second API request',async()=>{
 const f=fixture(()=>({result:{data:Array.from({length:230},(_,i)=>({dimensions:[{id:String(i+1),name:`Product ${i+1}`}],metrics:[1,2,3,4,5]}))},timestamp:'2026-09-03T10:00:00Z'}));
 const input={storeId:'s',...range,groupBy:'sku',limit:100};let page=data(await readOzonData('analytics',input,f.store,f.client));const all=[...page.items];
 while(page.cursor){page=data(await readOzonData('analytics',{...input,cursor:page.cursor},f.store,f.client));all.push(...page.items);}
 assert.equal(all.length,230);assert.equal(f.calls.length,1);assert.deepEqual((f.calls[0].input.body as any).dimension,['sku']);assert.equal((f.calls[0].input.body as any).limit,1000);assert.ok(all.every(row=>row.date===null));assert.deepEqual(page.period,range);assert.match(page.warnings.join(' '),/单日日期为空/);
 const descriptor=OZON_DESCRIPTORS.find(row=>row.capabilityId==='hallmark.ozon.analytics')!;assert.equal(compileCapability(descriptor).input(input).length,0);
});
test('warehouse channels page independently and unknown inventory values remain unknown',async()=>{
 const f=fixture(path=>path==='/v2/warehouse/list'?{result:[{warehouse_id:1,name:'Small items',is_rfbs:true}]}:{result:[{name:'Postal',status:'ACTIVE'}]});const result=data(await readOzonData('warehouses',{storeId:'s'},f.store,f.client));assert.equal(result.items[0].fulfillment,'rFBS');assert.equal(result.items[0].deliveryMethods,'Postal · 已启用');
 const g=fixture(()=>({result:[{sku:1,warehouse_id:2,present:8,reserved:3}]}));const stock=data(await readOzonData('stocks',{storeId:'s',sku:'1'},g.store,g.client));assert.equal(stock.items[0].stockPresent,8);assert.equal(stock.items[0].stockReserved,3);assert.equal(stock.items[0].stockAvailable,null);
});
test('pending weight report reuses the same request and never returns declared weight as measured weight',async()=>{
 const f=fixture(()=>({})),requests:RecordData[]=[];let ready=false;
 f.client.readOrderWeights=async(storeId:string,input:RecordData)=>{requests.push(input);return {status:'ok',raw:{storeId,status:ready?'ready':'pending',items:ready?[{postingNumber:'p',sku:'1',offerId:'o',grams:310,declaredGrams:250,shipmentAt:'2026-09-01T00:00:00Z'}]:[],skipped:[{postingNumber:'multi',reason:'multiple items'}]}};};
 assert.equal((await readOzonData('weights',{storeId:'s',...range},f.store,f.client)).error?.code,'REPORT_PENDING');ready=true;const result=data(await readOzonData('weights',{storeId:'s',...range},f.store,f.client));assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(result.items[0].actualWeight,310);assert.equal(result.items[0].weightDifference,60);assert.equal(result.items[0].quantity,1);assert.equal(result.items[0].weightScope,'已核实单 SKU 单件');
});
test('finance dates advance without implying first-day records are the full period',async()=>{
 const f=fixture((path,body)=>({accruals:[{accrual_id:body.date,amount:{amount:'-10.50',currency:'CNY'},posting_number:'p'}],has_next:false}));const input={storeId:'s',...range};const first=data(await readOzonData('finance',input,f.store,f.client));assert.equal(first.items[0].amount,-10.5);assert.equal(first.items[0].commission,null);assert.ok(first.cursor);
 const second=data(await readOzonData('finance',{...input,cursor:first.cursor},f.store,f.client));assert.equal(second.items[0].date,'2026-09-02');assert.equal(second.cursor,undefined);assert.deepEqual(f.calls.map(c=>(c.input.body as RecordData).date),['2026-09-01','2026-09-02']);
});
test('promotions distinguish eligible and joined prices, preserving explicit monetary currency',async()=>{
 const f=fixture(()=>({products:[{id:1,action_price:{amount:'12',currency:'CNY'},max_action_price:{amount:'13',currency:'CNY'}}],total:1}));const result=data(await readOzonData('promotions',{storeId:'s',actionId:'7',participation:'eligible',limit:1},f.store,f.client));assert.equal(f.calls[0].input.path,'/v2/actions/candidates');assert.equal(result.items[0].participation,'可参加');assert.equal(result.items[0].currency,'CNY');assert.equal(result.items[0].actionPrice,12);assert.equal(result.cursor,undefined);assert.ok(result.warnings.length);
});
test('rFBS returns preserve raw state and missing fields, and unsupported connector fails explicitly',async()=>{
 const f=fixture(()=>({returns:[{return_id:1,posting_number:'p',state:{state_name:'Awaiting'},product:{sku:5,name:'Item',price:'12',currency_code:'CNY'}}]}));const result=data(await readOzonData('returns',{storeId:'s'},f.store,f.client));assert.equal(result.items[0].returnId,'1');assert.equal(result.items[0].status,'未映射：Awaiting');assert.equal(result.items[0].statusRaw,'Awaiting');assert.equal(result.items[0].orderPrice,12);assert.equal(result.items[0].returnReason,null);
 assert.equal((await readOzonData('returns',{storeId:'s'},f.store,{} as CoreClient)).error?.code,'STORE_DATA_GATEWAY_UNAVAILABLE');
});
test('current inventory products shape retains SKU-zero identities and buffers all known warehouse rows',async()=>{
 const f=fixture((path,body)=>{
  if(path==='/v3/product/list')return {result:{items:[{product_id:1},{product_id:2}],total_items:2}};
  if(path==='/v3/product/info/list')return {items:[{id:1,offer_id:'missing',sku:0},{id:2,offer_id:'valid',sku:22}]};
  assert.deepEqual(body.sku,['22']);return {products:[{product_id:2,sku:22,offer_id:'valid',warehouse_id:4,present:5,free_stock:4,reserved:1},{product_id:2,sku:22,offer_id:'valid',warehouse_id:6,present:7,free_stock:7,reserved:0}],has_next:false,cursor:''};
 });
 const first=data(await readOzonData('stocks',{storeId:'s',limit:2},f.store,f.client));assert.deepEqual(first.items.map((r:any)=>r.warehouseId),['4','6']);assert.ok(first.cursor);assert.match(first.warnings[0],/1 个商品/);
 const second=data(await readOzonData('stocks',{storeId:'s',limit:2,cursor:first.cursor},f.store,f.client));assert.equal(second.items[0].offerId,'missing');assert.equal(second.items[0].sku,null);assert.equal(second.items[0].stockAvailable,null);assert.equal(second.cursor,undefined);assert.equal(f.calls.length,3);
});
test('current financial total_amount, same-currency commission and non-item fees preserve accounting meaning',async()=>{
 const f=fixture(()=>({accruals:[{accrual_id:1,date:'2026-10-07',total_amount:{amount:'161.92',currency:'RUB'},unit_number:'p',accrued_category:'POSTING',posting:{products:[{commission:{commission:{amount:'-28.08',currency:'RUB'}}}]}},{accrual_id:2,date:'2026-10-07',total_amount:{amount:'-15',currency:'RUB'},unit_number:'p',accrued_category:'NON_ITEM',non_item_fee:{type_id:123,accrued:{amount:'-15',currency:'RUB'}}}],last_id:''}));
 const result=data(await readOzonData('finance',{storeId:'s',dateFrom:'2026-10-07',dateTo:'2026-10-07',limit:2},f.store,f.client));assert.equal(result.items[0].amount,161.92);assert.equal(result.items[0].currency,'RUB');assert.equal(result.items[0].commission,-28.08);assert.equal(result.items[1].postingNumber,null);assert.equal(result.items[1].unitNumber,'p');assert.match(result.items[1].feeDetails,/123：-15 RUB/);assert.equal(result.cursor,undefined);
});
test('v4 order monetary object is seller order price with a separate original status',async()=>{
 const f=fixture(()=>({postings:[{order_id:1,order_number:'O-1',posting_number:'P-1',status:'delivered',products:[{sku:1,price:{amount:'19.52',currency:'CNY'},quantity:1}]}],has_next:false}));const result=data(await readOzonData('orders',{storeId:'s',...range},f.store,f.client));assert.equal(result.items[0].orderPrice,19.52);assert.equal(result.items[0].currency,'CNY');assert.equal(result.items[0].status,'已送达');assert.equal(result.items[0].statusRaw,'delivered');
});
test('rFBS returns paginate from last return id and detail reads a singular returns object',async()=>{
 const f=fixture((path,body)=>path.endsWith('/get')?{returns:{posting_number:'P-1',product:{sku:5},return_reason:{name:'Вы отменили заказ'},state:{state:'Utilized',state_name:'Утилизирован'}}}:{returns:body.last_id===0?[{return_id:10,posting_number:'P-1',product:{sku:5}}]:body.last_id==='10'?[{return_id:20,posting_number:'P-2',product:{sku:6}}]:[]});
 const first=data(await readOzonData('returns',{storeId:'s',limit:1},f.store,f.client)),second=data(await readOzonData('returns',{storeId:'s',limit:1,cursor:first.cursor},f.store,f.client)),last=data(await readOzonData('returns',{storeId:'s',limit:1,cursor:second.cursor},f.store,f.client));assert.deepEqual([first.items[0].returnId,second.items[0].returnId],['10','20']);assert.equal(last.items.length,0);assert.equal(last.cursor,undefined);
 const detail=data(await readOzonData('returns',{storeId:'s',returnId:'10'},f.store,f.client));assert.equal(detail.items[0].returnId,'10');assert.equal(detail.items[0].status,'已销毁');assert.equal(detail.items[0].returnReason,'Вы отменили заказ');
});
test('ready logistics report preserves all eleven unit-weight records across pages without recreating the report',async()=>{
 const f=fixture(()=>({}));let reads=0;
 f.client.readOrderWeights=async(storeId:string)=>{reads++;return {status:'ok',raw:{status:'ready',storeId,items:Array.from({length:11},(_,i)=>({postingNumber:`P-${i}`,offerId:`offer-${i}`,sku:String(100+i),grams:310+i,declaredGrams:250,shipmentAt:'2026-09-26T07:11:19Z'})),skipped:[{postingNumber:'mixed',reason:'multi_sku'}]}};};
 const args={storeId:'s',limit:5,...range};let result=data(await readOzonData('weights',args,f.store,f.client)),all=[...result.items];assert.equal(result.total,11);assert.equal(result.items[0].weightDifference,60);
 while(result.cursor){result=data(await readOzonData('weights',{...args,cursor:result.cursor},f.store,f.client));all.push(...result.items);}
 assert.equal(all.length,11);assert.equal(new Set(all.map(r=>r.postingNumber)).size,11);assert.equal(reads,1);assert.ok(all.every(r=>r.quantity===1&&r.weightScope==='已核实单 SKU 单件'));assert.equal(result.items.length,1);
});
test('strict RuntimeStore serializes pure-buffer pages and restores weight query/cursor after a database reopen',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ozon-restart-')),path=join(directory,'runtime.sqlite'),requests:string[]=[];let database=new RuntimeStore(path),port=new HallmarkStorePort(database,'connection'),ready=false;
 const f=fixture(()=>({}));f.client.readOrderWeights=async(storeId:string,input:RecordData)=>{requests.push(input.requestId);return {status:'ok',raw:{status:ready?'ready':'pending',storeId,items:ready?Array.from({length:3},(_,i)=>({postingNumber:`P-${i}`,sku:String(i+1),grams:300+i,declaredGrams:250})):[]}};};
 try{
  const args={storeId:'shop',...range,limit:2};assert.equal((await readOzonData('weights',args,port,f.client)).error?.code,'REPORT_PENDING');database.close();
  database=new RuntimeStore(path);port=new HallmarkStorePort(database,'connection');ready=true;
  const first=data(await readOzonData('weights',args,port,f.client));assert.equal(requests[0],requests[1]);assert.equal(first.items.length,2);assert.ok(first.cursor);
  database.close();database=new RuntimeStore(path);port=new HallmarkStorePort(database,'connection');
  const changedRevision=new HallmarkStorePort(database,'connection',2);assert.equal((await readOzonData('weights',{...args,cursor:first.cursor},changedRevision,f.client)).error?.code,'INVALID_CURSOR');
  const last=data(await readOzonData('weights',{...args,cursor:first.cursor},port,f.client));assert.equal(last.items[0].postingNumber,'P-2');assert.equal(last.cursor,undefined);assert.equal(requests.length,2);
  await readOzonData('weights',args,changedRevision,f.client);assert.notEqual(requests[2],requests[1]);
 }finally{database.close();if(!resolve(directory).startsWith(resolve(tmpdir())+requireSeparator()))throw Error('UNEXPECTED_TEST_DIRECTORY');await rm(directory,{recursive:true,force:true});}
});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
test('strict persisted finance cursor advances after an empty first day and retains all later records',async()=>{
 const database=new RuntimeStore(':memory:'),port=new HallmarkStorePort(database,'finance'),f=fixture((path,body)=>({accruals:body.date===range.dateFrom?[]:[{accrual_id:1,total_amount:{amount:'12',currency:'RUB'}},{accrual_id:2,total_amount:{amount:'-3',currency:'RUB'}}],last_id:''}));
 try{
  const args={storeId:'shop',...range,limit:1},first=data(await readOzonData('finance',args,port,f.client));assert.equal(first.items.length,0);assert.ok(first.cursor);
  const second=data(await readOzonData('finance',{...args,cursor:first.cursor},port,f.client));assert.equal(second.items[0].accrualId,'1');assert.ok(second.cursor);
  const last=data(await readOzonData('finance',{...args,cursor:second.cursor},port,f.client));assert.equal(last.items[0].accrualId,'2');assert.equal(last.cursor,undefined);assert.equal(f.calls.length,2);
 }finally{database.close();}
});
