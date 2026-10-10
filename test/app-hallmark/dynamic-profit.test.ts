import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {HallmarkDomain} from '../../packages/app-hallmark/src/domain.ts';
import {businessConnectedClient,businessProductStatus} from '../../packages/app-hallmark/src/operations-client.ts';
import {applicationProfit,businessWeight} from '../../packages/app-hallmark/src/dynamic-profit.ts';
import {readProcurement,PROCUREMENT_DESCRIPTOR} from '../../packages/app-hallmark/src/procurement.ts';
import {BusinessPricingRepository,type BusinessPricingDraft} from '../../packages/business-pricing/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';
import type {CoreClient,CoreBroker,RecordData} from '../../packages/core/src/types.ts';
import type {OzonBusinessGateway} from '../../packages/ozon-business/src/index.ts';

const draft=():BusinessPricingDraft=>({currency:'CNY',logisticsSelection:'automatic',defaultPlanId:null,plans:[{id:'low',name:'方案 1',enabled:true,maxPriceExclusiveMinor:13500,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000},{id:'high',name:'方案 2',enabled:true,minPriceMinor:13500,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000}],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:null,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null});
function fixture(){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'dynamic'),pricing=new BusinessPricingRepository(store);pricing.save('bill',draft(),0);
 let seller:string|null='134.99',ordinary='200',actualWeight:RecordData|undefined={source:'ozon_order_actual',grams:50,revision:'actual-1'},mismatch=false,attributeWeight=30;
 const requests:string[]=[],catalogueReads:string[]=[];
 const local=(id:string)=>({storeId:id,offerId:'offer',productId:100,sources:[{sourceSkuMatched:true,sourceUrl:'https://source.test/item',sourceSpec:'单件',skuCode:'source',productId:'item'}],...(actualWeight?{weight:actualWeight}:{}),profit:{purchaseMinor:2000,packageGrams:999,actualMinor:20000,costMinor:1,profitMinor:19999,actualMargin:.999}});
 const seed=()=>{for(const id of ['bill','helen'])store.put('business_catalog',createHash('sha256').update(JSON.stringify([id,'offer'])).digest('hex'),local(id));};seed();
 const stores=[{id:'bill',name:'Bill',currency:'CNY',sourceConnectionId:'dynamic'},{id:'helen',name:'Helen',currency:'CNY',sourceConnectionId:'dynamic'}];
 const gateway={listStores:()=>stores,getProducts:async(id:string)=>{catalogueReads.push(id);return {status:'ok',raw:{response:{items:[{id:100,offer_id:'offer',sku:200,name:'杯子',price:'999',currency_code:'CNY',statuses:{status:'price_sent',status_name:'Продается',moderate_status:'approved',is_created:true},stocks:{has_stock:true},visibility_details:{has_price:true}}]}}};},request:async(_id:string,input:RecordData)=>{requests.push(input.path);return {status:'ok',raw:{response:input.path==='/v5/product/info/prices'?{result:{items:[{offer_id:'offer',product_id:mismatch?999:100,price:{price:ordinary,marketing_seller_price:seller,currency_code:'CNY'}}]}}:{result:[{offer_id:'offer',id:100,weight:attributeWeight,weight_unit:'g'}]}}};}} as unknown as OzonBusinessGateway;
 const source={getStores:async()=>({status:'ok',raw:stores}),getStoreProducts:async()=>{throw Error('Legacy catalogue must not be used');}} as unknown as CoreClient;
 const client=businessConnectedClient(source,gateway,store,'dynamic',true,pricing),domain=new HallmarkDomain({store,client,pricing,broker:{} as CoreBroker});
 return {database,store,pricing,client,domain,requests,catalogueReads,set(values:{seller?:string|null;ordinary?:string;actualWeight?:RecordData|null;mismatch?:boolean;attributeWeight?:number}){if('seller'in values)seller=values.seller!;if(values.ordinary)ordinary=values.ordinary;if('actualWeight'in values){actualWeight=values.actualWeight??undefined;seed();}if(values.mismatch!==undefined)mismatch=values.mismatch;if(values.attributeWeight!==undefined)attributeWeight=values.attributeWeight;}};
}
const data=(result:any)=>{assert.equal(result.status,'ok',JSON.stringify(result));return result.data;};

test('actual seller price selects the tier independently from ordinary price; measured weight has provenance and missing rules are per-store',async()=>{
 const f=fixture();try{
  let response=await f.client.getStoreProducts(),bill=response.raw.products.find((p:RecordData)=>p.storeId==='bill'),helen=response.raw.products.find((p:RecordData)=>p.storeId==='helen');
  assert.equal(bill.price,'200.00');assert.equal(bill.pricing.ordinaryMinor,20000);assert.equal(bill.profit.actualMinor,13499);assert.equal(bill.profit.packageGrams,50);assert.equal(bill.declaredWeight.grams,30);assert.equal(bill.profit.weightSource,'ozon_order_actual');assert.equal(bill.profit.pricingQuote.planId,'low');assert.equal(bill.profit.pricingQuote.breakdown.fixedMinor,316);assert.equal(bill.historicalProfit.actualMargin,.999);
  assert.equal(helen.profit.actualMargin,null);assert.match(helen.profit.reason,/尚未保存/);
  f.set({seller:'135'});response=await f.client.getStoreProducts();bill=response.raw.products[0];assert.equal(bill.price,'200.00');assert.equal(bill.profit.pricingQuote.planId,'high');assert.equal(bill.profit.pricingQuote.breakdown.fixedMinor,1800);
  f.set({actualWeight:null});bill=(await f.client.getStoreProducts()).raw.products[0];assert.equal(bill.profit.packageGrams,30);assert.equal(bill.profit.weightSource,'ozon_declared');
 }finally{await f.domain.dispose();f.database.close();}
});

test('missing seller price, mismatched price identity and unverified package weight never borrow old profit or a suggested price',async()=>{
 const f=fixture();try{
  f.set({seller:null});let bill=(await f.client.getStoreProducts()).raw.products[0];assert.equal(bill.profit.actualMinor,null);assert.equal(bill.profit.profitMinor,null);assert.equal(bill.profit.actualMargin,null);assert.equal(bill.profit.pricingQuote,null);assert.match(bill.profit.reason,/实际卖家价/);
  const procurement=data(await readProcurement({storeId:'bill'},f.store,f.client,undefined,f.pricing));assert.notEqual(procurement.products[0].logisticsMatch.status,'unique');assert.deepEqual(procurement.products[0].logisticsMatch.candidatePlanIds,[]);assert.equal(procurement.products[0].referenceProfit.planId,null);
  f.set({seller:'134.99',mismatch:true});bill=(await f.client.getStoreProducts()).raw.products[0];assert.equal(bill.profit.actualMinor,null);assert.equal(bill.price,null);
  f.set({mismatch:false,actualWeight:null,attributeWeight:0});bill=(await f.client.getStoreProducts()).raw.products[0];assert.equal(bill.profit.packageGrams,null);assert.equal(bill.profit.actualMargin,null);assert.match(bill.profit.reason,/重量/);
  assert.deepEqual(businessWeight({weight:{source:'ozon_order_actual',grams:22},declaredWeight:{grams:30,reason:null}}),{grams:30,source:'ozon_declared'});
 }finally{await f.domain.dispose();f.database.close();}
});

test('list computation, filters and procurement use one quote and rule revisions invalidate computed caches and result sets',async()=>{
 const f=fixture();try{
  const context={sessionId:'test'},computed=data(await f.domain.invoke('hallmark_compute_profit',{storeId:'bill'},context)),row=computed.products[0];
  const quote=f.pricing.quote({storeId:'bill',action:'price',purchaseMinor:2000,weightGrams:50,priceMinor:13499,pricingMode:'manual'});
  assert.equal(row.referenceProfit.profitMinor,quote.breakdown.profitMinor);assert.equal(row.referenceProfit.planId,'low');assert.match(row.referenceProfit.metricBasis,/应用经营规则/);
  const filtered=data(await f.domain.invoke('hallmark_filter_products',{storeId:'bill',minMargin:.5},context));assert.equal(filtered.payload.products.length,1);
  const first=data(await readProcurement({storeId:'bill',loadAll:true},f.store,f.client,undefined,f.pricing));assert.deepEqual(compileSchema(PROCUREMENT_DESCRIPTOR.outputSchema)(first),[]);assert.equal(first.plan.mode,'application');assert.equal(first.plan.settingsRevision,1);assert.equal(first.products[0].referenceProfit.profitMinor,row.referenceProfit.profitMinor);assert.equal(first.products[0].logisticsMatch.selectedPlanId,'low');
  const changed=draft();changed.plans.push({id:'expensive',name:'重叠贵方案',enabled:true,fixedMinor:2500,logisticsMicrosPerGram:39300,commissionPpm:200000});f.pricing.save('bill',changed,1);
  const before=f.catalogueReads.length,next=data(await f.domain.invoke('hallmark_compute_profit',{storeId:'bill'},context));assert.equal(f.catalogueReads.length,before,'new fees use already verified source facts');assert.equal(next.products[0].referenceProfit.planId,'expensive');assert.equal(next.products[0].referenceProfit.configRevision,2);assert.ok(next.products[0].referenceProfit.profitMinor<row.referenceProfit.profitMinor);
  assert.equal((await f.domain.invoke('hallmark_filter_products',{resultSetId:filtered.resultSetId},context)).error?.code,'RESULT_SET_PRICING_CHANGED');
  const updated=data(await readProcurement({storeId:'bill',loadAll:true},f.store,f.client,undefined,f.pricing));assert.equal(updated.plan.settingsRevision,2);assert.equal(updated.products[0].referenceProfit.profitMinor,next.products[0].referenceProfit.profitMinor);assert.equal(updated.products[0].logisticsMatch.selectedPlanId,'expensive');
 }finally{await f.domain.dispose();f.database.close();}
});

test('cached catalogue from the previous price interpretation is read again before application profit is shown',async()=>{
 const f=fixture();try{
  f.store.updateSnapshotSuccess('store_products:bill',{products:[{storeId:'bill',offerId:'offer',productId:100,currency:'CNY',pricing:{sellerMinor:99999,currency:'CNY'},profit:{actualMinor:99999,purchaseMinor:1,packageGrams:999}}]},null);
  const result=data(await f.domain.invoke('hallmark_compute_profit',{storeId:'bill'}, {sessionId:'test'}));assert.ok(f.requests.includes('/v5/product/info/prices'));assert.equal(result.products[0].profit.actualMinor,13499);assert.equal(result.products[0].businessFactsVersion,2);
  const missing=applicationProfit({currency:'CNY',pricing:{sellerMinor:null,currency:'CNY'},profit:{purchaseMinor:2000,packageGrams:50}},'bill',f.pricing);assert.equal(missing.profit.actualMargin,null);assert.equal(missing.profit.profitMinor,null);
 }finally{await f.domain.dispose();f.database.close();}
});


test('native Russian statuses preserve moderation, stock and archive distinctions',()=>{
 assert.equal(businessProductStatus({statuses:{is_created:true,status:'price_sent',status_name:'Продается',moderate_status:'approved'},stocks:{has_stock:true}}),'on_sale');
 assert.equal(businessProductStatus({statuses:{is_created:true,status_name:'Не продается',moderate_status:'approved'},stocks:{has_stock:true}}),'not_sellable');
 assert.equal(businessProductStatus({statuses:{is_created:true,status_name:'Продается',moderate_status:'approved'},stocks:{has_stock:false}}),'not_sellable');
 assert.equal(businessProductStatus({statuses:{status_name:'Продается',moderate_status:'approved'},stocks:{has_stock:true}}),'unknown','selling text alone does not prove the card has been created');
 assert.equal(businessProductStatus({statuses:{is_created:false,status_name:'Продается',moderate_status:'approved'},stocks:{has_stock:true}}),'pending','an unfinished card cannot become on-sale from translated text');
 assert.equal(businessProductStatus({statuses:{status_name:'Отклонен'}}),'rejected');
 assert.equal(businessProductStatus({statuses:{status_name:'На модерации'}}),'pending');
 assert.equal(businessProductStatus({is_autoarchived:true,statuses:{status_name:'Продается'},stocks:{has_stock:true}}),'archived');
 assert.equal(businessProductStatus({}),'unknown');
});

test('plan validity boundaries change whole and page procurement caches before the source TTL expires',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-10T00:00:00Z')});
 const f=fixture();try{
  const timed=draft();timed.plans=[{id:'first',name:'当前方案',enabled:true,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000,validUntil:'2026-10-10T00:00:01Z'},{id:'next',name:'稍后方案',enabled:true,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000,validFrom:'2026-10-10T00:00:01Z',validUntil:'2026-10-10T00:00:02Z'}];f.pricing.save('bill',timed,1);
  for(const loadAll of [false,true])assert.equal(data(await readProcurement({storeId:'bill',loadAll},f.store,f.client,undefined,f.pricing)).products[0].logisticsMatch.selectedPlanId,'first');
  t.mock.timers.tick(1000);
  for(const loadAll of [false,true]){const result=data(await readProcurement({storeId:'bill',loadAll},f.store,f.client,undefined,f.pricing));assert.equal(result.products[0].logisticsMatch.selectedPlanId,'next');assert.equal(result.plan.settingsRevision,2);}
  t.mock.timers.tick(1000);
  for(const loadAll of [false,true]){const result=data(await readProcurement({storeId:'bill',loadAll},f.store,f.client,undefined,f.pricing));assert.notEqual(result.products[0].logisticsMatch.status,'unique');assert.equal(result.products[0].referenceProfit.margin,null);}
 }finally{await f.domain.dispose();f.database.close();}
});
