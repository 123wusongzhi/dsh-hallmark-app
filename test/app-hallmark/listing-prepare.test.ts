import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import {BusinessPricingRepository,dynamicReferenceDraft} from '../../packages/business-pricing/src/index.ts';
import {prepareListing,collectionListingStates} from '../../packages/app-hallmark/src/listing-prepare.ts';
import {HallmarkBusinessAdapter} from '../../packages/app-hallmark/src/operations-adapter.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';

function fixture(count=6,productCount=1){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'source');let detailReads=0,categoryReads=0;
 const details=new Map(Array.from({length:productCount},(_,i)=>{const id=`p${i+1}`;return [id,{id,source:'taobao_tmall',title:`组合杯 ${id}`,currency:'CNY',attributes:{材料:'陶瓷',包装单位:'件'},package:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}},skus:Array.from({length:count},(_,j)=>({sourceSkuId:`sku-${j}`,spec:`颜色：${j}`,goodsPrice:3.43,price:4,currency:'CNY'}))}];}));
 const client:CoreClient={getStores:async()=>({status:'ok',raw:[{id:'bill'},{id:'other'}]}),getStoreProducts:async()=>({status:'ok',raw:{stores:[{id:'bill'}],products:[]}}),syncStoreProducts:async()=>({status:'ok'}),getTargetMargin:async()=>({status:'ok'}),searchCollectedItems:async()=>({status:'ok',raw:[]}),getCollectedItem:async()=>{throw Error('raw not expected');},getCollectedItemDetail:async id=>{detailReads++;return {status:'ok',raw:details.get(id)};},platformCall:async()=>{throw Error('write not expected');},platformRead:async()=>{throw Error('platform read not expected');},getCategoryData:async input=>{categoryReads++;return input.mode==='search'?{status:'ok',raw:{items:[{description_category_id:1,type_id:2,name:'杯子',children:[{huge:'discard'}]}],total:1}}:{status:'ok',raw:{result:Array.from({length:100},(_,i)=>({id:i+1,name:`属性 ${i+1}`,is_required:i<2,type:'string',max_value_count:1,...(i===0?{dictionary_id:12,values:Array.from({length:1000},(_,j)=>({id:j,value:'large choice'.repeat(100)}))}:{})}))}};}};
 const collection=new CollectionService({client,store}),packaging=new BusinessPackagingRepository(store),pricing=new BusinessPricingRepository(store);pricing.save('bill',dynamicReferenceDraft(),0);
 return {database,store,client,collection,packaging,pricing,details,counts:()=>({detailReads,categoryReads}),options:{client,store,collection,packaging,pricing}};
}

test('one preparation refreshes each distinct category once and later preparations can refresh again',async()=>{
 const f=fixture(1,3);try{
  const input={storeId:'bill',selections:[{id:'p1'},{id:'p2'},{id:'p3'}],categories:Object.fromEntries(['p1','p2','p3'].map(id=>[id,id==='p2'?{typeId:'2',descriptionCategoryId:'1'}:{descriptionCategoryId:'1',typeId:'2'}])),refresh:true};
  const first=await prepareListing(input,f.options);
  assert.equal(f.counts().categoryReads,1);
  for(const id of ['p1','p2','p3'])assert.deepEqual(first.categories[id].attributes,first.categories.p1.attributes);
  await prepareListing({...input,refresh:false},f.options);assert.equal(f.counts().categoryReads,1);
  await prepareListing(input,f.options);assert.equal(f.counts().categoryReads,2);
  await prepareListing({...input,categories:{...input.categories,p3:{descriptionCategoryId:'3',typeId:'4'}}},f.options);assert.equal(f.counts().categoryReads,4);
 }finally{f.database.close();}
});

test('failed category response is shared only within one preparation and next request retries',async()=>{
 const f=fixture(1,2);try{
  let attempts=0;f.client.getCategoryData=async()=>{attempts++;return attempts===1?{status:'unavailable',error:{code:'TEMPORARY',message:'retry',retryable:true}}:{status:'ok',raw:{result:[{id:1,is_required:true,name:'restored'}]}};};
  const input={storeId:'bill',selections:[{id:'p1'},{id:'p2'}],categories:{p1:{descriptionCategoryId:'1',typeId:'2'},p2:{descriptionCategoryId:'1',typeId:'2'}},refresh:true};
  const failed=await prepareListing(input,f.options);assert.equal(attempts,1);assert.equal(failed.categories.p1.status,'unavailable');assert.equal(failed.categories.p2.status,'unavailable');
  const retried=await prepareListing(input,f.options);assert.equal(attempts,2);assert.equal(retried.categories.p1.status,'selected');assert.equal(retried.categories.p2.status,'selected');
 }finally{f.database.close();}
});

test('actual preparation provider stops after cancellation without more category reads or a saved result',async()=>{
 const f=fixture(1,3),controller=new AbortController();try{
  let reads=0;const prior=f.client.getCategoryData!;
  f.client.getCategoryData=async input=>{reads++;const result=await prior(input);controller.abort();return result;};
  const provider=new HallmarkProvider({...f.options,broker:{} as any});
  const result=await provider.execute({request:{appId:'hallmark',connectionId:'c',capabilityId:'hallmark.listing.prepare',capabilityVersion:'1.0.0',input:{storeId:'bill',selections:[{id:'p1'},{id:'p2'},{id:'p3'}]},invocationId:'cancel-prepare',traceId:'cancel-prepare',source:{kind:'agent',sessionId:'s'}},signal:controller.signal,configRevision:1} as any);
  assert.equal(reads,1);assert.equal(result.status,'failed');assert.equal((result as any).error.code,'ABORTED');
  assert.equal(f.store.list('business_listing_preparations').length,0);assert.equal(f.store.list('business_category_preparation').length,0);
 }finally{f.database.close();}
});

test('pre-aborted preparation performs no reads; cancellation after stores prevents source reads',async()=>{
 for(const abortBefore of [true,false]){
  const f=fixture(),controller=new AbortController();try{
   let stores=0;f.client.getStores=async()=>{stores++;controller.abort();return {status:'ok',raw:[{id:'bill'}]};};
   if(abortBefore)controller.abort();
   await assert.rejects(prepareListing({storeId:'bill',selections:[{id:'p1'}]},{...f.options,signal:controller.signal} as any),{name:'AbortError'});
   assert.equal(stores,abortBefore?0:1);assert.equal(f.counts().detailReads,0);assert.equal(f.store.list('business_listing_preparations').length,0);
  }finally{f.database.close();}
 }
});

test('cancellation between material pages prevents continuation reads, quotes and persistence',async()=>{
 const f=fixture(),controller=new AbortController();try{
  let pages=0,quotes=0;f.collection.read=async()=>{pages++;controller.abort();return {items:[],continuation:pages===1?{input:{id:'p1',cursor:'unused'}}:null} as any;};
  const pricing={read:f.pricing.read.bind(f.pricing),quote:()=>{quotes++;throw Error('quote after abort');}};
  await assert.rejects(prepareListing({storeId:'bill',selections:[{id:'p1'}]},{...f.options,pricing,signal:controller.signal} as any),{name:'AbortError'});
  assert.equal(pages,1);assert.equal(quotes,0);assert.equal(f.counts().categoryReads,0);assert.equal(f.store.list('business_listing_preparations').length,0);
 }finally{f.database.close();}
});

test('provider cancellation before or during history import never starts the following status sync',async()=>{
 for(const when of ['before','during','throw']){
  const f=fixture(),controller=new AbortController();try{
   let historyReads=0,statusReads=0;const entry={id:'bill',legacyStoreId:'old-bill',sourceConnectionId:'c'};
   f.client.getStoreProducts=async()=>{historyReads++;controller.abort();if(when==='throw')throw new DOMException('cancelled','AbortError');return {status:'ok',raw:{products:[]}};};
   const businessGateway={listStores:()=>[entry],getStore:()=>entry,getProducts:async()=>{statusReads++;return {status:'ok',raw:{items:[]}};}} as any;
   const provider=new HallmarkProvider({...f.options,businessGateway,broker:{} as any});if(when==='before')controller.abort();
   const result=await provider.execute({request:{appId:'hallmark',connectionId:'c',capabilityId:'hallmark.listing.prepare',capabilityVersion:'1.0.0',input:{storeId:'bill',selections:[{id:'p1'}]},invocationId:'cancel-history',traceId:'cancel-history',source:{kind:'agent',sessionId:'s'}},signal:controller.signal,configRevision:1} as any);
   assert.equal(result.status,'failed');assert.equal((result as any).error.code,'ABORTED');assert.equal(historyReads,when==='before'?0:1);assert.equal(statusReads,0);assert.equal(f.counts().detailReads,0);
   assert.equal(f.store.list('business_catalog_status_sync').length,0);assert.equal(f.store.list('business_listing_preparations').length,0);
  }finally{f.database.close();}
 }
});
test('prepare provides content facts, package and cost once, then draft uses the same normalized source without extra source calls',async()=>{
 const f=fixture();try{
  const ready=await prepareListing({storeId:'bill',selections:[{id:'p1'}],categories:{p1:{descriptionCategoryId:'1',typeId:'2'}}},f.options);
  assert.equal(ready.completeness,'complete');assert.equal(ready.sales.length,6);assert.equal(ready.materials?.items.length,1);assert.equal(ready.sales[0].packaging.weightGrams,330);assert.equal(ready.sales[0].purchaseMinor,343);
  assert.equal(ready.categories.p1.attributes.length,2);assert.equal(ready.categories.p1.optionalAttributes,98);assert.equal(ready.categories.p1.attributes[0].values,undefined);assert.equal(ready.categories.p1.attributes[0].max_value_count,1);assert.equal(ready.categories.p1.attributes[0].available.input.attributeId,'1');
  const adapter=new HallmarkBusinessAdapter({...f.options,broker:{getStoreTask:async()=>{throw Error('no task');},getListingTask:async()=>{throw Error('no task');},requestId:()=>''}});
  const draft=await adapter.load({storeId:'bill',fresh:false,row:{rowId:'r1',action:'listing',target:{offerId:'new-cup'},procurement:ready.sales[0].procurement,pricing:{mode:'automatic'},payload:{offer_id:'new-cup',name:'Кружка керамическая',description_category_id:1,type_id:2,attributes:[]}}});
  assert.equal(draft.normalizedPayload?.weight,330);assert.equal(draft.normalizedPayload?.depth,250);assert.equal(draft.normalizedPayload?.weight_unit,'g');assert.equal(draft.pricingQuote?.breakdown.purchaseMinor,343);assert.equal(draft.pricingQuote?.suggestedPriceMinor,ready.sales[0].quote.suggestedPriceMinor);assert.equal((draft.source as any)?.packaging.version,ready.sales[0].packaging.version);
  assert.deepEqual(f.counts(),{detailReads:1,categoryReads:1});
  assert.equal(JSON.stringify(ready).includes('我已检查'),false);assert.equal(JSON.stringify(ready).includes('preflight'),false);
 }finally{f.database.close();}
});
test('listing accepts draft packaging when collection rules are empty and prices that same package',async()=>{
 const f=fixture();try{
  delete (f.details.get('p1') as any).package;
  f.client.storeDataRead=async()=>({status:'ok',raw:{items:[]}});
  const adapter=new HallmarkBusinessAdapter({...f.options,broker:{getStoreTask:async()=>{throw Error('no task');},getListingTask:async()=>{throw Error('no task');},requestId:()=>''}});
  const row={rowId:'r1',action:'listing' as const,target:{offerId:'new-cup'},procurement:[{itemId:'p1',sourceSkuId:'sku-0',quantity:2}],pricing:{mode:'automatic' as const},payload:{offer_id:'new-cup',name:'Кружка',description_category_id:1,type_id:2,attributes:[],weight:0.25,weight_unit:'kg',depth:10,width:8,height:3,dimension_unit:'cm'}};
  for(const fresh of [false,true]){
   const draft=await adapter.load({storeId:'bill',fresh,row});
   assert.equal(draft.normalizedPayload?.weight,250);
   assert.equal(draft.normalizedPayload?.depth,100);
   assert.equal(draft.normalizedPayload?.dimension_unit,'mm');
   assert.deepEqual((draft.source as any).packaging.origin,{weight:'draft',dimensions:'draft'});
   assert.equal(JSON.stringify(draft).includes('PACKAGING_VALUE_MISSING'),false);
   assert.equal(draft.pricingQuote?.status,'ready');
   assert.equal(draft.pricingQuote?.breakdown.logisticsMinor,983);
  }
  assert.deepEqual(f.packaging.list(),[]);
  const missing=await adapter.load({storeId:'bill',fresh:false,row:{...row,payload:{...row.payload,height:0}}});
  assert.equal((missing.source as any).packaging.missing.length,1);
  assert.ok(JSON.stringify(missing).includes('无需先保存包装设置'));
 }finally{f.database.close();}
});

test('large preparations page the entire response without duplicate sales or rereading sources and preserve a fixed preparation',async()=>{
 const f=fixture(60,2);try{
  let result=await prepareListing({storeId:'bill',selections:[{id:'p1'},{id:'p2'}],maxBytes:18000,salesLimit:12},f.options);const revision=result.preparationRevision,sales:any[]=[],materials:any[]=[],pages:any[]=[];
  for(let i=0;i<30;i++){pages.push(result);assert.ok(Buffer.byteLength(JSON.stringify(result))<=18000);assert.ok(result.sales.length<=12);assert.equal(result.preparationRevision,revision);sales.push(...result.sales);materials.push(...result.materials?.items??[]);if(!result.continuation)break;result=await prepareListing(result.continuation.input,f.options);}
  assert.equal(result.completeness,'complete');assert.equal(sales.length,120);assert.equal(new Set(sales.map(row=>row.id)).size,120);assert.equal(materials.length,2);assert.ok(pages.length>1);assert.deepEqual(f.counts(),{detailReads:2,categoryReads:2});
  const cursor=pages[0].continuation.input.cursor;await assert.rejects(prepareListing({storeId:'other',cursor},f.options),/CURSOR_INVALID/);await assert.rejects(prepareListing({storeId:'bill',cursor,selections:[{id:'p1'}]},f.options),/CURSOR_SCOPE/);
 }finally{f.database.close();}
});
test('known revisions reuse materials, explicit refresh reloads once, and selected composition scopes are exact',async()=>{
 const f=fixture();try{
  const source=await f.collection.getProduct('p1'),selected={id:'p1',skuIds:['sku-0','sku-1']};
  const ready=await prepareListing({storeId:'bill',selections:[selected],knownRevisions:{p1:source.revision},compositions:[{id:'pair',members:[{itemId:'p1',sourceSkuId:'sku-0',quantity:2},{itemId:'p1',sourceSkuId:'sku-1',quantity:1}]}]},f.options);
  assert.equal(ready.materials,null);assert.equal(ready.reused[0].revision,source.revision);assert.equal(ready.sales[0].packaging.weightGrams,990);assert.equal(ready.sales[0].purchaseMinor,1029);assert.equal(f.counts().detailReads,1);
  await prepareListing({storeId:'bill',selections:[selected],refresh:true},f.options);assert.equal(f.counts().detailReads,2);
  for(const selections of [[],[{id:'p1'},{id:'p1'}],[{id:'p1',skuIds:[]}],[{id:'p1',skuIds:['sku-0','sku-0']}]])await assert.rejects(prepareListing({storeId:'bill',selections},f.options));
  await assert.rejects(prepareListing({storeId:'bill',selections:[selected],compositions:[{id:'bad',members:[{itemId:'p1',sourceSkuId:'sku-5',quantity:1}]}]},f.options),/OUTSIDE_SELECTION/);
  await assert.rejects(prepareListing({storeId:'bill',selections:[selected],compositions:[{id:'bad',members:[{itemId:'p1',sourceSkuId:'sku-0',quantity:1.5}]}]},f.options),/QUANTITY_INVALID/);
 }finally{f.database.close();}
});
test('large requested pages remain intact through the real 16 KiB Host projection',async()=>{
 const f=fixture(6,2);try{
  let result=await prepareListing({storeId:'bill',selections:[{id:'p1'},{id:'p2'}],maxBytes:65536},f.options);
  const sales=new Set<string>();let pages=0;
  for(;;){
   pages++;assert.ok(Buffer.byteLength(JSON.stringify(result))<=14000);
   const envelope={invocationId:`actual-host-${pages}`,traceId:'trace',status:'ok' as const,data:result};
   const projected=projectModelResult(f.database,envelope);assert.equal(projected.fullResultRef,undefined);
   assert.deepEqual(JSON.parse(projected.content).data,result);
   for(const sale of result.sales){assert.ok(!sales.has(sale.id));sales.add(sale.id);}
   if(!result.continuation)break;
   result=await prepareListing(result.continuation.input,f.options);
  }
  assert.equal(sales.size,12);assert.deepEqual(f.counts(),{detailReads:2,categoryReads:2});
 }finally{f.database.close();}
});
test('packaging enrichment is a prepared copy and missing values remain explicit without a separate review',async()=>{
 const f=fixture();try{
  delete (f.details.get('p1') as any).package;
  const ready=await prepareListing({storeId:'bill',selections:[{id:'p1',skuIds:['sku-0']}]},{...f.options,prepareProducts:async products=>{const copy=structuredClone(products);copy[0].package.weightGrams=450;copy[0].package.dimensionsMm={length:100,width:120,height:130};return copy;}});
  assert.equal(ready.sales[0].packaging.weightGrams,450);assert.equal((await f.collection.getProduct('p1')).package.weightGrams,null);
  const missing=await prepareListing({storeId:'bill',selections:[{id:'p1',skuIds:['sku-1']}]},f.options);assert.equal(missing.sales[0].packaging.weightGrams,null);assert.ok(missing.sales[0].packaging.missing.length);assert.equal(missing.sales[0].quote.status,'blocked');
 }finally{f.database.close();}
});
test('listing history is separate from deduplicated current offers, including archives and empty stock',()=>{
 const f=fixture();try{
  const observedAt=new Date().toISOString(),add=(key:string,offerId:string,sku:string,saleState:string,created=false)=>f.store.put('business_catalog',key,{storeId:'bill',offerId,productId:offerId,status:saleState==='out_of_stock'?'not_sellable':saleState,saleState,observedAt,statusObservation:'observed',platformStatus:{is_created:created,moderate_status:created?'approved':''},sources:[{productId:'p1',sourceSkuMatched:true,skuCode:sku}]});
  add('one','one','sku-0','on_sale',true);add('duplicate','one','sku-0','on_sale',true);
  add('archive','archive','sku-0','archived',true);add('empty','empty','sku-1','out_of_stock',true);add('failed','failed','sku-1','failed');add('pending','pending','sku-1','pending');
  const state=collectionListingStates(f.store,['bill'],['p1'],[{id:'p1',skuCount:2,skuIds:['sku-0','sku-1']}]).p1[0];
  assert.equal(state.status,'listed');assert.equal(state.association,'linked');assert.equal(state.associatedSkuCount,2);assert.equal(state.offerCount,5);assert.equal(state.countUnit,'offers');
  assert.deepEqual(state.saleStates,{on_sale:1,out_of_stock:1,pending:1,archived:1,failed:1,not_sellable:0,unknown:0});assert.equal(state.freshness,'fresh');
  assert.equal(collectionListingStates(f.store,['bill'],['absent']).absent[0].status,'unknown');
 }finally{f.database.close();}
});

test('failed and uncreated not-sellable links do not prove listing; fully archived successful history remains listed',()=>{
 const f=fixture();try{
  const observedAt=new Date().toISOString();
  for(const [index,status] of ['not_sellable','failed','pending'].entries())f.store.put('business_catalog',`bad${index}`,{storeId:'bill',offerId:`bad${index}`,status,saleState:status,observedAt,statusObservation:'observed',platformStatus:{is_created:false,moderate_status:''},sources:[{productId:'p1',sourceSkuMatched:true,skuCode:'sku-0'}]});
  f.store.put('business_catalog','approved-uncreated',{storeId:'bill',offerId:'approved-uncreated',status:'not_sellable',saleState:'not_sellable',observedAt,statusObservation:'observed',platformStatus:{is_created:false,moderate_status:'approved'},sources:[{productId:'p1',sourceSkuMatched:true,skuCode:'sku-0'}]});
  let state=collectionListingStates(f.store,['bill'],['p1'],[{id:'p1',skuCount:1}]).p1[0];assert.equal(state.status,'unknown');assert.equal(state.listedSkuCount,0);assert.equal(state.association,'linked');assert.equal(state.saleStates?.on_sale,0);
  for(const [index,sku] of ['sku-0','sku-1'].entries())f.store.put('business_catalog',`archive${index}`,{storeId:'bill',offerId:`archive${index}`,status:'archived',saleState:'archived',observedAt,statusObservation:'observed',listingHistory:{created:true,approved:true,observedAt},platformStatus:{is_created:false},sources:[{productId:'p2',sourceSkuMatched:true,skuCode:sku}]});
  state=collectionListingStates(f.store,['bill'],['p2'],[{id:'p2',skuCount:2}]).p2[0];assert.equal(state.status,'listed');assert.equal(state.saleStates?.archived,2);assert.equal(state.saleStates?.on_sale,0);
  f.store.put('business_catalog','legacy-archive',{storeId:'bill',offerId:'legacy-archive',status:'archived',saleState:'archived',observedAt,statusObservation:'observed',listingHistory:{created:false,approved:false,legacyOnSale:true},sources:[{productId:'legacy',sourceSkuMatched:true,skuCode:'sku-0'}]});
  state=collectionListingStates(f.store,['bill'],['legacy'],[{id:'legacy',skuCount:1}]).legacy[0];assert.equal(state.status,'listed');assert.equal(state.saleStates?.archived,1);
 }finally{f.database.close();}
});

test('expired, missing and failed-sync observations are unknown now while successful history survives',()=>{
 const f=fixture();try{
  const old=new Date(Date.now()-301000).toISOString(),fresh=new Date().toISOString();
  for(const [id,observedAt,statusObservation] of [['old',old,'observed'],['missing',fresh,'missing'],['fresh',fresh,'observed']])f.store.put('business_catalog',id,{storeId:'bill',offerId:id,status:'on_sale',saleState:'on_sale',observedAt,statusObservation,listingHistory:{created:true},sources:[{productId:'p1',sourceSkuMatched:true,skuCode:id}]});
  let state=collectionListingStates(f.store,['bill'],['p1'],[{id:'p1',skuCount:3}]).p1[0];assert.equal(state.status,'listed');assert.equal(state.saleStates?.on_sale,1);assert.equal(state.saleStates?.unknown,2);assert.equal(state.freshness,'stale');
  f.store.put('business_catalog_status_sync','bill',{state:'failed',observedAt:old,attemptedAt:new Date().toISOString()});
  state=collectionListingStates(f.store,['bill'],['p1']).p1[0];assert.equal(state.saleStates?.on_sale,0);assert.equal(state.saleStates?.unknown,3);
  f.store.put('business_catalog','no-time',{storeId:'bill',offerId:'no-time',status:'on_sale',sources:[{productId:'p2',sourceSkuMatched:true,skuCode:'sku-0'}]});
  state=collectionListingStates(f.store,['bill'],['p2']).p2[0];assert.equal(state.saleStates?.unknown,1);assert.equal(state.observedAt,null);assert.equal(state.freshness,'unknown');
 }finally{f.database.close();}
});

test('only a complete fresh catalogue with known source associations proves no association',()=>{
 const f=fixture();try{
  const now=new Date().toISOString();f.store.put('business_catalog_status_sync','bill',{state:'fresh',observedAt:now,attemptedAt:now,expiresAt:new Date(Date.now()+300000).toISOString(),total:0,missing:0});
  let state=collectionListingStates(f.store,['bill'],['absent']).absent[0];assert.equal(state.association,'none');assert.equal(state.status,'not_listed');
  f.store.put('business_catalog','unmapped',{storeId:'bill',offerId:'unmapped',status:'on_sale'});
  state=collectionListingStates(f.store,['bill'],['absent']).absent[0];assert.equal(state.association,'unknown');assert.equal(state.status,'unknown');
 }finally{f.database.close();}
});

test('listing records are item and store scoped; unrelated unmapped or missing offers do not hide candidates',()=>{
 const f=fixture();try{
  const now=new Date().toISOString();f.store.put('business_catalog_status_sync','bill',{state:'fresh',observedAt:now,expiresAt:new Date(Date.now()+300000).toISOString(),missing:1});
  f.store.put('business_catalog','unmapped',{storeId:'bill',offerId:'old-unmapped',status:'on_sale'});
  for(const [itemId,saleState] of [['archived','archived'],['failed','failed'],['partial','on_sale']])f.store.put('business_catalog',itemId,{storeId:'bill',offerId:itemId,saleState,observedAt:now,statusObservation:'observed',sources:[{productId:itemId,sourceSkuMatched:true,skuCode:'one'}]});
  f.store.put('business_catalog','other',{storeId:'helen',offerId:'other',sources:[{productId:'absent',sourceSkuMatched:true,skuCode:'one'}]});
  f.store.put('business_plans','draft',{planId:'draft',storeId:'bill',rows:[{action:'listing',status:'draft',procurement:[{itemId:'draft-only',sourceSkuId:'red',quantity:1},{itemId:'combo-member',sourceSkuId:'blue',quantity:2}]},{action:'price',procurement:[{itemId:'price-only',sourceSkuId:'red',quantity:1}]}]});
  const states=collectionListingStates(f.store,['bill'],['absent','archived','failed','partial','draft-only','combo-member','price-only']);
  assert.equal(states.absent[0].listingRecord,'not_found');assert.equal(states.absent[0].association,'unknown');assert.equal(states.absent[0].status,'unknown');assert.equal(states.absent[0].hasUnlinkedHistory,true);
  for(const id of ['archived','failed','partial','draft-only','combo-member'])assert.equal(states[id][0].listingRecord,'found');
  assert.equal(states['draft-only'][0].savedListingCount,1);assert.equal(states['draft-only'][0].offerCount,0);assert.equal(states['price-only'][0].listingRecord,'not_found');
  f.store.put('business_catalog_status_sync','bill',{state:'failed',observedAt:now,attemptedAt:now});
  const failed=collectionListingStates(f.store,['bill'],['absent','archived','draft-only']);
  assert.equal(failed.absent[0].listingRecord,'unavailable');assert.equal(failed.absent[0].listingRecordReason,'RECORD_SYNC_FAILED');assert.equal(failed.archived[0].listingRecord,'found');assert.equal(failed['draft-only'][0].listingRecord,'found');
 }finally{f.database.close();}
});

test('preparation exposes saved listing records without claiming successful platform creation',async()=>{
 const f=fixture(1);try{
  f.store.put('business_plans','draft',{planId:'draft',storeId:'bill',rows:[{action:'listing',status:'draft',procurement:[{itemId:'p1',sourceSkuId:'sku-0',quantity:1}]}]});
  const result=await prepareListing({storeId:'bill',selections:[{id:'p1'}]},f.options);
  assert.equal(result.listingRecords[0].listingRecord,'found');assert.equal(result.listingRecords[0].savedListingCount,1);assert.equal(result.listingRecords[0].available.capability,'hallmark.plan.list');assert.equal(result.sales[0].existingLinks.length,0);
  const mismatched=await prepareListing({storeId:'bill',selections:[{id:'p1'}]},{...f.options,listingStates:()=>({})});assert.equal(mismatched.listingRecords[0].listingRecord,'unavailable');
 }finally{f.database.close();}
});

test('prepare retains associations in every state and exposes their observation freshness',async()=>{
 const f=fixture(1);try{
  for(const [index,saleState] of ['archived','out_of_stock','failed','pending','on_sale'].entries())f.store.put('business_catalog',`offer${index}`,{storeId:'bill',offerId:`offer${index}`,productId:`id${index}`,status:saleState,saleState,observedAt:new Date(Date.now()-(saleState==='on_sale'?301000:0)).toISOString(),statusObservation:'observed',sources:[{productId:'p1',sourceSkuMatched:true,skuCode:'sku-0'}]});
  const result=await prepareListing({storeId:'bill',selections:[{id:'p1'}]},f.options),links=result.sales[0].existingLinks;
  assert.equal(links.length,5);assert.deepEqual(links.map((link:any)=>link.saleState).sort(),['archived','out_of_stock','failed','pending','unknown'].sort());assert.ok(links.every((link:any)=>link.association==='linked'));assert.equal(links.find((link:any)=>link.offerId==='offer4').freshness,'stale');
 }finally{f.database.close();}
});

test('hundreds of offers for one source SKU continue through bounded preparation pages without losing an association',async()=>{
 const f=fixture(1);try{
  const observedAt=new Date().toISOString();
  for(let i=0;i<210;i++)f.store.put('business_catalog',`offer${i}`,{storeId:'bill',offerId:`offer-${i}`,productId:`product-${i}`,status:'archived',saleState:'archived',observedAt,statusObservation:'observed',sources:[{productId:'p1',sourceSkuMatched:true,skuCode:'sku-0'}]});
  let result=await prepareListing({storeId:'bill',selections:[{id:'p1'}],maxBytes:65536},f.options),saleCount=0,pages=0;const offers:string[]=[],offsets:number[]=[];
  for(;;){pages++;assert.ok(Buffer.byteLength(JSON.stringify(result))<=14000);
   for(const sale of result.sales){saleCount++;assert.equal(sale.existingLinkCount,210);assert.equal(sale.existingLinksComplete,false);offers.push(...sale.existingLinks.map((link:any)=>link.offerId));}
   for(const batch of result.existingLinks??[]){assert.equal(batch.saleId,'p1:sku-0');assert.equal(batch.total,210);offsets.push(batch.offset);offers.push(...batch.links.map((link:any)=>link.offerId));}
   const projected=projectModelResult(f.database,{invocationId:`links-${pages}`,traceId:'trace',status:'ok',data:result});assert.equal(projected.fullResultRef,undefined);
   if(!result.continuation)break;result=await prepareListing(result.continuation.input,f.options);
  }
  assert.equal(saleCount,1);assert.equal(offers.length,210);assert.equal(new Set(offers).size,210);assert.ok(pages>1);assert.deepEqual(offsets,Array.from({length:20},(_,i)=>(i+1)*10));assert.equal(f.counts().detailReads,1);
 }finally{f.database.close();}
});
