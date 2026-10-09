import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readProcurement,PROCUREMENT_DESCRIPTOR} from '../../packages/app-hallmark/src/procurement.ts';
import {loadLogisticsCatalog,matchProductLogistics} from '../../packages/app-hallmark/src/procurement-logistics.ts';
import {hallmarkProductSources} from '../../packages/app-hallmark/src/field-mappings.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {compileCapability,compileSchema} from '../../packages/app-contracts/src/index.ts';
import {dataSourceDefinitionIssues,sampleValidation} from '../../packages/app-presentation/src/data-sources.ts';
import type {CoreClient,CoreStore} from '../../packages/core/src/types.ts';

const settings={version:1,revision:4,updatedAt:'2026-10-01T00:00:00Z',fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000};
const row=(id=1,patch:any={})=>({storeId:'bill',productId:id,offerId:`offer-${id}`,sku:`10${id}`,title:`产品${id}`,status:'on_sale',currency:'CNY',imageUrl:'https://example.test/image.png',pricing:{sellerMinor:10001,currency:'CNY'},profit:{actualMinor:10001,purchaseMinor:2001,packageGrams:333,actualMargin:0.99},sources:[{sourceSkuMatched:true,sourceUrl:'https://example.test/purchase',sourceSpec:'蓝色 M',salesSpec:'蓝色 两件装',skuCode:'source-sku'}],...patch});
const good=(raw:any)=>({status:'ok' as const,raw,provenance:{source:'hallmark_snapshot' as const,endpoint:'/fixture',fetchedAt:new Date().toISOString()}});
function fixture(rows:any[]=[row()],providedStore?:CoreStore){
 const records=new Map<string,any>(),store=providedStore??{get:(collection:string,id:string)=>records.get(`${collection}:${id}`),put:(collection:string,id:string,value:any)=>{records.set(`${collection}:${id}`,structuredClone(value));return value;}} as CoreStore;
 const calls={products:0,settings:0};let productResponse:()=>any=()=>good({stores:[{id:'bill',hasCredential:true,lastSuccessAt:'2026-10-01T01:00:00Z'},{id:'helen',hasCredential:true}],products:rows}),settingResponse:()=>any=()=>good(settings);
 const client={getStoreProducts:async()=>{calls.products++;return productResponse();},getPricingSettings:async()=>{calls.settings++;return settingResponse();}} as CoreClient;
 return {store,client,calls,records,read:(args:any={})=>readProcurement({storeId:'bill',planMode:'platform',...args},store,client),setProducts:(next:()=>any)=>{productResponse=next;},setSettings:(next:()=>any)=>{settingResponse=next;}};
}
function data(result:any):any{assert.equal(result.status,'ok',JSON.stringify(result));assert.deepEqual(compileSchema(PROCUREMENT_DESCRIPTOR.outputSchema)(result.data),[]);return result.data;}
test('shared procurement source and executable contract expose confirmed roles, complete-list search and per-instance plans',async()=>{
 assert.doesNotThrow(()=>compileCapability(PROCUREMENT_DESCRIPTOR));const source=hallmarkProductSources('connection').find(source=>source.id.endsWith(':procurement'))!;assert.ok(source);assert.equal(source.input.storeId,undefined);assert.equal(source.storeScoped,true);assert.equal(source.input.loadAll,true);assert.equal(source.operations.search.scope,'loaded');assert.equal(source.operations.pagination,undefined);assert.deepEqual(dataSourceDefinitionIssues(source,PROCUREMENT_DESCRIPTOR),[]);assert.equal(source.fields.find(field=>field.role==='purchase.price')?.currency,'CNY');
 const result=data(await fixture().read());assert.equal(sampleValidation(source,result,'invocation',PROCUREMENT_DESCRIPTOR).status,'verified');
 assert.equal(new HallmarkProvider({store:{} as any,client:{} as any,broker:{} as any}).descriptors.find(row=>row.capabilityId===PROCUREMENT_DESCRIPTOR.capabilityId),PROCUREMENT_DESCRIPTOR);
});
test('filters exact on-sale status and searches all matching rows before pagination',async()=>{
 const f=fixture([row(1),row(2,{status:'archived'}),row(3,{status:'not_sellable'}),row(4,{status:'unknown'}),row(5,{storeId:'helen'}),row(6,{title:'unique title'}),row(7,{sources:[{sourceSkuMatched:true,sourceSpec:'黄色 大号'}]})]);
 assert.equal(data(await f.read()).total,3);assert.equal(data(await f.read({query:'YELLOW'})).total,0);assert.equal(data(await f.read({query:'UNIQUE'})).products[0].productId,'6');assert.equal(data(await f.read({query:'黄色'})).products[0].productId,'7');assert.equal(data(await f.read({query:'offer-6'})).products[0].productId,'6');assert.equal(data(await f.read({query:'107'})).products[0].productId,'7');assert.equal(f.calls.products,1);
 const first=data(await f.read({limit:1})),second=data(await f.read({limit:1,cursor:first.cursor}));assert.equal(second.products[0].productId,'6');assert.equal(f.calls.products,1);assert.equal(f.calls.settings,1);
 for(const changes of [{query:'new'},{storeId:'helen'},{planMode:'custom',fixedFeeYuan:3.16,logisticsYuanPerKg:39.3,commissionPercent:20},{limit:2}])assert.equal((await f.read({limit:1,cursor:first.cursor,...changes})).error?.code,'INVALID_CURSOR');
});
test('computes integer ceilings from confirmed costs and selected settings, never old actualMargin',async()=>{
 const f=fixture(),platform=data(await f.read());const item=platform.products[0];assert.equal(item.referenceProfit.logisticsMinor,1309);assert.equal(item.referenceProfit.commissionMinor,2001);assert.equal(item.referenceProfit.fixedMinor,316);assert.equal(item.referenceProfit.profitMinor,4374);assert.equal(item.referenceProfit.margin,4374/10001);assert.equal(platform.plan.settingsRevision,4);assert.equal(platform.plan.logisticsYuanPerKg,39.3);assert.equal(platform.dataTime,'2026-10-01T01:00:00Z');
 const custom=data(await f.read({planMode:'custom',fixedFeeYuan:100,logisticsYuanPerKg:0,commissionPercent:0}));assert.equal(custom.products[0].referenceProfit.profitMinor,-2000);assert.equal(custom.products[0].referenceProfit.margin,-2000/10001);assert.equal(custom.plan.settingsRevision,null);assert.equal(f.calls.products,1);assert.equal(f.calls.settings,1);
});
test('missing price, purchase cost, weight or explicit CNY stays unknown and zero purchase remains valid',async()=>{
 for(const patch of [{profit:{actualMinor:null,purchaseMinor:1,packageGrams:1}},{profit:{actualMinor:100,purchaseMinor:null,packageGrams:1}},{profit:{actualMinor:100,purchaseMinor:1,packageGrams:0}},{currency:'RUB',pricing:{currency:'RUB'}},{currency:null,pricing:{}}]){const result=data(await fixture([row(1,patch)]).read());assert.equal(result.products[0].referenceProfit.margin,null);assert.ok(result.products[0].referenceProfit.reason);}
 const zero=data(await fixture([row(1,{profit:{actualMinor:100,purchaseMinor:0,packageGrams:1}})]).read({planMode:'custom',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0}));assert.equal(zero.products[0].referenceProfit.margin,1);
});
test('all exact procurement sources are shown without promoting guessed links or unsafe URLs',async()=>{
 const f=fixture([row(1,{sources:[{sourceSkuMatched:false,sourceUrl:'https://wrong.test/',sourceSpec:'错'},{sourceSkuMatched:true,sourceUrl:'https://one.test/',sourceSpec:'红',salesSpec:'红两件'},{sourceSkuMatched:true,sourceUrl:'https://two.test/',sourceSpec:'蓝',salesSpec:'蓝两件'},{sourceSkuMatched:true,sourceUrl:'javascript:alert(1)',purchasePrice:999}]}),row(2,{sku:'0'}),row(3,{sku:'made-up'})]);const products=data(await f.read()).products;
 assert.deepEqual(products[0].purchaseLinks,[{url:'https://one.test/',label:'红'},{url:'https://two.test/',label:'蓝'}]);assert.equal(products[0].purchaseSpecification,'红；蓝');assert.equal(products[0].salesSpecification,'红两件；蓝两件');assert.equal(products[0].purchaseMinor,2001);assert.equal(products[0].productUrl,'https://www.ozon.ru/product/101/');assert.equal(products[1].productUrl,null);assert.equal(products[2].productUrl,null);
});
test('a procurement specification alone never becomes an asserted sales-package specification',async()=>{
 const result=data(await fixture([row(1,{sources:[{sourceSkuMatched:true,sourceSpec:'采购单件规格'}]})]).read());assert.equal(result.products[0].purchaseSpecification,'采购单件规格');assert.equal(result.products[0].salesSpecification,null);
});
test('custom inputs are complete and precise before any source call',async()=>{
 const f=fixture();for(const input of [{planMode:'custom'},{planMode:'custom',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:100},{planMode:'custom',fixedFeeYuan:0.001,logisticsYuanPerKg:0,commissionPercent:0},{planMode:'custom',fixedFeeYuan:0,logisticsYuanPerKg:-1,commissionPercent:0},{planMode:'custom',fixedFeeYuan:0,logisticsYuanPerKg:1.0001,commissionPercent:0},{planMode:'made-up'}])assert.equal((await f.read(input)).error?.code,'INVALID_PLAN');assert.deepEqual(f.calls,{products:0,settings:0});
});
test('rate limiting retains the same-store cache and real timestamps, honoring cooldown even on forceRefresh',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});const f=fixture(),first=data(await f.read());t.mock.timers.tick(900001);f.setProducts(()=>({status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'later',retryable:true,retryAfterMs:240000}}));const second=data(await f.read());assert.equal(second.cache.stale,true);assert.equal(second.cache.fetchedAt,first.cache.fetchedAt);assert.equal(second.dataTime,first.dataTime);assert.deepEqual(second.products,first.products);const count=f.calls.products;data(await f.read({forceRefresh:true}));assert.equal(f.calls.products,count);assert.ok(Date.parse(second.cache.nextRefreshAt)>=Date.now()+240000);
 assert.equal((await f.read({storeId:'helen'})).status,'unavailable');assert.equal(f.calls.products,count+1);
});
test('first-read rate limit retries only after deadline and never creates empty successful products',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});const f=fixture();f.setProducts(()=>({status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'later',retryable:true,retryAfterMs:5000}}));assert.equal((await f.read()).status,'unavailable');assert.equal((await f.read({forceRefresh:true})).status,'unavailable');assert.equal(f.calls.products,1);t.mock.timers.tick(5001);await f.read();assert.equal(f.calls.products,2);
});
test('early forced-refresh cooldown ends with an actual retry rather than relabeling old data fresh',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});const f=fixture();const first=data(await f.read());t.mock.timers.tick(1);f.setProducts(()=>({status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'later',retryable:true,retryAfterMs:5000}}));assert.equal(data(await f.read({forceRefresh:true})).cache.stale,true);t.mock.timers.tick(5001);f.setProducts(()=>good({stores:[{id:'bill'}],products:[row(2)]}));const recovered=data(await f.read());assert.equal(recovered.products[0].productId,'2');assert.equal(recovered.cache.stale,false);assert.equal(f.calls.products,3);assert.notEqual(recovered.cache.fetchedAt,first.cache.fetchedAt);
});
test('a thrown explicit permission error cannot turn into a retryable network fallback',async()=>{
 const f=fixture();data(await f.read());f.setProducts(()=>{throw Object.assign(new Error('denied'),{code:'PERMISSION_DENIED',retryable:true});});const result=await f.read({forceRefresh:true});assert.equal(result.status,'failed');assert.equal(result.error?.code,'PERMISSION_DENIED');assert.equal(result.data,undefined);
});
test('permission failures invalidate successful rows and any old pagination token',async()=>{
 const f=fixture([row(1),row(2)]),first=data(await f.read({limit:1}));f.setProducts(()=>({status:'failed',error:{code:'PERMISSION_DENIED',message:'denied',retryable:true}}));const denied=await f.read({forceRefresh:true});assert.equal(denied.status,'failed');assert.equal(denied.data,undefined);assert.equal((await f.read({limit:1,cursor:first.cursor})).error?.code,'INVALID_CURSOR');assert.equal((await f.read()).status,'failed');
});
test('unknown settings preserve useful rows with unknown profit and never hard-code default fees',async()=>{
 const f=fixture();f.setSettings(()=>({status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'方案稍后更新',retryable:true,retryAfterMs:5000}}));const result=data(await f.read());assert.equal(result.products.length,1);assert.equal(result.products[0].referenceProfit.margin,null);assert.equal(result.plan.fixedFeeYuan,null);assert.equal(result.cache.stale,true);
});
test('connection revisions isolate snapshot and pagination caches',async()=>{
 const database=new RuntimeStore(':memory:');try{const old=fixture([row(1),row(2)],new HallmarkStorePort(database,'c',1)),next=fixture([row(3)],new HallmarkStorePort(database,'c',2)),other=fixture([row(4)],new HallmarkStorePort(database,'other',1));const first=data(await old.read({limit:1}));assert.equal((await next.read({limit:1,cursor:first.cursor})).error?.code,'INVALID_CURSOR');assert.equal((await other.read({limit:1,cursor:first.cursor})).error?.code,'INVALID_CURSOR');assert.equal(data(await next.read()).products[0].productId,'3');assert.equal(next.calls.products,1);}finally{database.close();}
});
test('pricing settings adapter reads the original platform without write method or operator authorization',async()=>{
 const requests:{url:string;init:RequestInit}[]=[];const client=new HallmarkClient({baseUrl:'http://127.0.0.1:4280',ozonDataBaseUrl:'http://127.0.0.1:4281',operatorToken:'not-forwarded',fetchImpl:async(url,init={})=>{requests.push({url:String(url),init});return Response.json(String(url).endsWith('/api/health')?{service:'hallmark-board'}:settings);}});assert.deepEqual((await client.getPricingSettings()).raw,settings);const request=requests.at(-1)!;assert.equal(request.url,'http://127.0.0.1:4280/api/dynamic-pricing/settings');assert.equal(request.init.method,'GET');assert.equal(new Headers(request.init.headers).get('Authorization'),null);
});
function addLogistics(f:ReturnType<typeof fixture>,read?:(path:string,body:any)=>any){
 const calls:string[]=[];Object.assign(f.client,{storeDataRead:async(storeId:string,input:any)=>{calls.push(input.path);const response=await read?.(input.path,input.body)??(input.path==='/v2/warehouse/list'?{warehouses:[{warehouse_id:10,name:'小件仓'},{warehouse_id:20,name:'大件仓'}],has_next:false}:input.path==='/v2/delivery-method/list'?{delivery_methods:[{id:1,name:'已启用方案',warehouse_id:10,status:'ACTIVE'},{id:2,name:'其他仓方案',warehouse_id:20,status:'ACTIVE'},{id:3,name:'停用方案',warehouse_id:10,status:'DISABLED'}],has_next:false}:{products:[{sku:101,warehouse_id:10,free_stock:1},{sku:102,warehouse_id:20,free_stock:1}],has_next:false});return response.status?response:{status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response}};}});return calls;
}
test('default delivery mode reads actual plans and matches only stocked active warehouse channels without inventing fees',async()=>{
 const f=fixture([row(1),row(2)]),calls=addLogistics(f),result=data(await f.read({planMode:undefined}));assert.equal(result.plan.mode,'delivery');assert.equal(result.plan.choices.length,3);assert.equal(result.plan.choices[2].active,false);assert.equal(result.products[0].logisticsMatch.label,'已启用方案');assert.deepEqual(result.products[0].logisticsMatch.candidatePlanIds,['1']);assert.equal(result.products[0].referenceProfit.margin,null);assert.equal(result.products[0].referenceProfit.reason,'所选物流方案费用待补充');assert.equal(result.products[1].logisticsMatch.selectedPlanId,'2');assert.equal(f.calls.settings,0);assert.equal(calls.length,3);
});
test('delivery-linked custom fees calculate only products matched to the chosen actual active channel',async()=>{
 const f=fixture([row(1),row(2)]);addLogistics(f);const result=data(await f.read({planMode:'delivery',deliveryMethodId:'1',fixedFeeYuan:3.16,logisticsYuanPerKg:39.3,commissionPercent:20}));assert.equal(result.products[0].referenceProfit.profitMinor,4374);assert.equal(result.products[1].referenceProfit.margin,null);assert.match(result.products[1].referenceProfit.reason,/尚未确认适用/);assert.equal(result.plan.label,'已启用方案');assert.equal(result.plan.deliveryMethodId,'1');
 for(const id of ['3','404']){const unavailable=data(await f.read({planMode:'delivery',deliveryMethodId:id,fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0}));assert.ok(unavailable.products.every((row:any)=>row.referenceProfit.margin===null));}
 const first=data(await f.read({planMode:'delivery',deliveryMethodId:'1',limit:1}));assert.equal((await f.read({planMode:'delivery',deliveryMethodId:'2',limit:1,cursor:first.cursor})).error?.code,'INVALID_CURSOR');
});
test('automatic matching rejects floating fees and all-or-none fees must be bound to an explicit channel',async()=>{
 const f=fixture();for(const input of [{fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0},{deliveryMethodId:'1',fixedFeeYuan:0},{deliveryMethodId:''}])assert.equal((await f.read({planMode:'delivery',...input})).error?.code,'INVALID_PLAN');assert.equal(f.calls.products,0);
});
test('full snapshot with missing channel fees is usable and cached without pretending profit is known',async()=>{
 const f=fixture();const calls=addLogistics(f),args={loadAll:true,planMode:'delivery',deliveryMethodId:'1'};
 const first=data(await f.read(args));assert.equal(first.products[0].referenceProfit.margin,null);assert.equal(first.plan.reason,'所选物流方案费用待补充');assert.equal(first.cache.stale,false);
 assert.ok([...f.records.keys()].some(key=>key.startsWith('complete_snapshots:')));const count=calls.length;const next=data(await f.read(args));assert.equal(calls.length,count);assert.equal(next.cache.refreshing,false);assert.equal(next.cache.fetchedAt,first.cache.fetchedAt);
});
test('a logistics permission failure removes matched profit while retaining product details and purchase links',async()=>{
 const f=fixture();let denied=false;addLogistics(f,()=>denied?{status:'failed',error:{code:'PERMISSION_DENIED',message:'no permission',retryable:false}}:undefined);const args={planMode:'delivery',deliveryMethodId:'1',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0};assert.ok(data(await f.read(args)).products[0].referenceProfit.margin!==null);denied=true;const result=data(await f.read({...args,forceRefresh:true}));assert.equal(result.products[0].logisticsMatch.status,'unknown');assert.equal(result.products[0].referenceProfit.margin,null);assert.equal(result.products[0].title,'产品1');assert.equal(result.products[0].purchaseLinks.length,1);assert.equal(result.plan.choices.length,0);
});
test('loadAll returns 76 and 267 complete rows with one catalog and serial stock batches of at most 100',async()=>{
 for(const count of [76,267]){
  const f=fixture(Array.from({length:count},(_,index)=>row(index+1))),batches:number[][]=[];let active=0,peak=0;
  const calls=addLogistics(f,async(path,body)=>{if(path!=='/v2/product/info/stocks-by-warehouse/fbs')return;active++;peak=Math.max(peak,active);batches.push(body.sku);await Promise.resolve();active--;return {products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false};});
  const args={planMode:'delivery',loadAll:true,limit:1,deliveryMethodId:'1',fixedFeeYuan:3.16,logisticsYuanPerKg:39.3,commissionPercent:20},result=data(await f.read(args));
  assert.equal(result.total,count);assert.equal(result.products.length,count);assert.equal(result.cursor,undefined);assert.equal(result.products.at(-1).productId,String(count));assert.equal(peak,1);
  assert.deepEqual(batches.map(batch=>batch.length),count===76?[76]:[100,100,67]);assert.equal(new Set(batches.flat()).size,count);assert.equal(calls.filter(path=>path==='/v2/warehouse/list').length,1);assert.equal(calls.filter(path=>path==='/v2/delivery-method/list').length,1);
  assert.ok(result.products.every((item:any)=>item.referenceProfit.profitMinor===4374&&item.logisticsMatch.selectedPlanId==='1'));assert.equal(result.warnings.length,1);
  const callCount=calls.length,again=data(await f.read(args));assert.equal(calls.length,callCount);assert.equal(f.calls.products,1);assert.deepEqual(again.products,result.products);assert.equal(again.cache.fetchedAt,result.cache.fetchedAt);
 }
});
test('loadAll filters the entire snapshot and preserves missing calculation inputs without omitting rows',async()=>{
 const f=fixture(Array.from({length:267},(_,index)=>row(index+1,index===266?{title:'末页唯一商品',profit:{actualMinor:10001,purchaseMinor:null,packageGrams:333}}:{})));
 const full=data(await f.read({loadAll:true}));assert.equal(full.products.length,267);assert.equal(full.products[266].referenceProfit.margin,null);assert.match(full.products[266].referenceProfit.reason,/采购价/);
 const filtered=data(await f.read({loadAll:true,query:'末页唯一'}));assert.equal(filtered.total,1);assert.equal(filtered.products[0].productId,'267');assert.equal(filtered.cursor,undefined);assert.equal(f.calls.products,1);
});
test('legacy pagination remains opt-in compatible and full-list mode rejects any cursor before reading',async()=>{
 const f=fixture(Array.from({length:267},(_,index)=>row(index+1))),first=data(await f.read());assert.equal(first.products.length,10);assert.equal(first.total,267);assert.ok(first.cursor);
 const second=data(await f.read({cursor:first.cursor,loadAll:false}));assert.equal(second.products.length,10);assert.equal(second.products[0].productId,'11');
 for(const cursor of [first.cursor,''])assert.equal((await f.read({loadAll:true,cursor})).error?.code,'INVALID_CURSOR');
 assert.equal((await f.read({loadAll:'true'})).error?.code,'INVALID_LOAD_ALL');assert.equal(f.calls.products,1);assert.equal(data(await f.read({loadAll:true})).products.length,267);
});
test('a later full-list stock batch permission failure clears matching and profit for every row',async()=>{
 for(const status of [401,403]){
  const f=fixture(Array.from({length:267},(_,index)=>row(index+1)));let deny=false,batch=0;
  addLogistics(f,(path,body)=>{if(path!=='/v2/product/info/stocks-by-warehouse/fbs')return;batch++;if(deny&&batch===2)return {status:'failed',raw:{storeId:'bill',outcome:'response_received',httpStatus:status,response:{}},error:{code:`HTTP_${status}`,message:'denied',retryable:false}};return {products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false};});
  const args={planMode:'delivery',loadAll:true,deliveryMethodId:'1',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0};assert.ok(data(await f.read(args)).products.every((item:any)=>item.referenceProfit.margin!==null));
  deny=true;batch=0;const initial=data(await f.read({...args,forceRefresh:true}));assert.equal(initial.cache.refreshing,true);await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(batch,2);batch=0;const result=await f.read(args);assert.equal(result.status,'failed');assert.equal(result.error?.code,'SNAPSHOT_AUTH_CHANGED');
 }
});
test('temporary failure in a later stock batch uses its complete cache and preserves all rows and original freshness',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 const f=fixture(Array.from({length:267},(_,index)=>row(index+1)));let limited=false,batch=0;
 const calls=addLogistics(f,(path,body)=>{if(path!=='/v2/product/info/stocks-by-warehouse/fbs')return;batch++;if(limited&&batch===2)return {status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'later',retryable:true,retryAfterMs:60000}};return {products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false};});
 const args={planMode:'delivery',loadAll:true,deliveryMethodId:'1',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0},first=data(await f.read(args));t.mock.timers.tick(1000);limited=true;batch=0;
 const initial=data(await f.read({...args,forceRefresh:true}));assert.equal(initial.cache.refreshing,true);await new Promise<void>(resolve=>setImmediate(resolve));const result=data(await f.read(args));assert.deepEqual(result.products,first.products);assert.equal(result.products.length,267);assert.equal(result.cache.stale,true);assert.equal(result.cache.fetchedAt,first.cache.fetchedAt);assert.equal(batch,3);assert.ok(Date.parse(result.cache.nextRefreshAt)>=Date.now()+60000);
 const callCount=calls.length;data(await f.read(args));assert.equal(calls.length,callCount);
});
test('concurrent authorization revocation invalidates earlier full-list batches even after another read recovers',async()=>{
 const f=fixture(Array.from({length:267},(_,index)=>row(index+1)));let batch=0,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),waiting=new Promise<void>(resolve=>{entered=resolve;});
 addLogistics(f,async(path,body)=>{
  if(path!=='/v2/product/info/stocks-by-warehouse/fbs')return;
  if(body.sku.includes(999999))return {status:'failed',error:{code:'PERMISSION_DENIED',message:'revoked',retryable:false}};
  batch++;if(batch===2){entered();await gate;}
  return {products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false};
 });
 const pending=f.read({planMode:'delivery',loadAll:true,deliveryMethodId:'1',fixedFeeYuan:0,logisticsYuanPerKg:0,commissionPercent:0});await waiting;
 await assert.rejects(matchProductLogistics({store:f.store,client:f.client,storeId:'bill',products:[{id:'external',sku:'999999'}],plans:[]}),{code:'PERMISSION_DENIED'});
 const recovered=await loadLogisticsCatalog({store:f.store,client:f.client,storeId:'bill'});recovered.assertAuthorization();release();
 const result=await pending;assert.equal(batch,2);assert.equal(result.status,'failed');assert.equal(result.error?.code,'SNAPSHOT_AUTH_CHANGED');
});
test('Runtime executes the procurement capability with validated live-plan shape and true source timestamp',async()=>{
 const database=new RuntimeStore(':memory:'),runtime=new AppsRuntime(database),f=fixture();addLogistics(f);runtime.register(new HallmarkProvider({store:f.store,client:f.client,broker:{} as any}));runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'c',config:{fixture:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 try{const result=await runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId:'hallmark.products.procurement',capabilityVersion:'1.0.0',input:{storeId:'bill'},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+60000).toISOString()});const payload=data(result);assert.equal(payload.plan.mode,'delivery');assert.equal(result.provenance?.[0].sourceDataTime,'2026-10-01T01:00:00Z');assert.equal(result.provenance?.[0].freshness,'fresh');assert.equal(database.list('operations').length,0);}finally{await runtime.dispose();database.close();}
});
