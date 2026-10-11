import test from 'node:test';
import {performance} from 'node:perf_hooks';

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

function fixture(count=6,productCount=1){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'source');let detailReads=0,categoryReads=0;
 const details=new Map(Array.from({length:productCount},(_,i)=>{const id=`p${i+1}`;return [id,{id,source:'taobao_tmall',title:`组合杯 ${id}`,currency:'CNY',attributes:{材料:'陶瓷',包装单位:'件'},package:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}},skus:Array.from({length:count},(_,j)=>({sourceSkuId:`sku-${j}`,spec:`颜色：${j}`,goodsPrice:3.43,price:4,currency:'CNY'}))}];}));
 const client:CoreClient={getStores:async()=>({status:'ok',raw:[{id:'bill'},{id:'other'}]}),getStoreProducts:async()=>({status:'ok',raw:{stores:[{id:'bill'}],products:[]}}),syncStoreProducts:async()=>({status:'ok'}),getTargetMargin:async()=>({status:'ok'}),searchCollectedItems:async()=>({status:'ok',raw:[]}),getCollectedItem:async()=>{throw Error('raw not expected');},getCollectedItemDetail:async id=>{detailReads++;return {status:'ok',raw:details.get(id)};},platformCall:async()=>{throw Error('write not expected');},platformRead:async()=>{throw Error('platform read not expected');},getCategoryData:async input=>{categoryReads++;return input.mode==='search'?{status:'ok',raw:{items:[{description_category_id:1,type_id:2,name:'杯子',children:[{huge:'discard'}]}],total:1}}:{status:'ok',raw:{result:Array.from({length:100},(_,i)=>({id:i+1,name:`属性 ${i+1}`,is_required:i<2,type:'string',max_value_count:1,...(i===0?{dictionary_id:12,values:Array.from({length:1000},(_,j)=>({id:j,value:'large choice'.repeat(100)}))}:{})}))}};}};
 const collection=new CollectionService({client,store}),packaging=new BusinessPackagingRepository(store),pricing=new BusinessPricingRepository(store);pricing.save('bill',dynamicReferenceDraft(),0);
 return {database,store,client,collection,packaging,pricing,details,counts:()=>({detailReads,categoryReads}),options:{client,store,collection,packaging,pricing}};
}
// Synthetic CoreClient boundary; no Ozon network, writes, credentials or artificial sleeps.
// Template shape matches /v1/description-category/attribute: result = attribute[].
const template=JSON.stringify({result:Array.from({length:80},(_,i)=>({id:i+1,name:`Attribute ${i+1}`,description:'Platform attribute definition',type:'String',is_required:i<4,is_collection:false,dictionary_id:i===0?12:0,attribute_complex_id:0,max_value_count:1,group_id:0,group_name:'Product'}))});
async function scenario(prepare:typeof prepareListing,kind:string,refresh=true){
 const f=fixture(1,20);let calls=0,failures=0;const seen:any[]=[];
 f.client.getCategoryData=async input=>{calls++;seen.push(input);if(kind==='transient'&&calls===1||kind==='429'){failures++;return {status:'failed',error:{code:'OZON_RATE_LIMIT',message:'Rate limited',retryable:true}};}if(kind==='abort'&&calls===1)throw new DOMException('Aborted','AbortError');const raw=JSON.parse(template);if(kind==='changing')raw.result[0].name=`Revision ${calls}`;return {status:'ok',raw};};
 const selections=Array.from({length:20},(_,i)=>({id:`p${i+1}`})),categories=Object.fromEntries(selections.map((p,i)=>[p.id,{descriptionCategoryId:kind==='distinct'?String(i+1):kind==='mixed'?String(i%4+1):'1',typeId:'2'}]));
 try{const start=performance.now();let page=await prepare({storeId:'bill',selections,categories,refresh},f.options),pages=1;const snapshot=f.store.get<any>('business_listing_preparations',page.preparationRevision);while(page.continuation){page=await prepare(page.continuation.input,f.options);pages++;}return {calls,failures,pages,elapsedMs:performance.now()-start,parts:snapshot.parts,seen};}finally{f.database.close();}
}
function stable(value:any):any {if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['fetchedAt','updatedAt','observedAt'].includes(key)).map(([k,v])=>[k,stable(v)]));return value;}
for(const kind of ['same','distinct','mixed','transient','429'])test(`category reuse bounds reads and retains complete preparation: ${kind}`,async()=>{
 const b=await scenario(prepareListing,kind);
 // The current local baseline already shares failures within one preparation,
 // avoiding repeated rate-limited reads; the next preparation retries them.
 assert.equal(b.calls,kind==='distinct'?20:kind==='mixed'?4:1);
 assert.equal(b.failures,kind==='429'||kind==='transient'?1:0);
 assert.equal(b.parts.filter((p:any)=>p.kind==='sale').length,20);
 const ids=new Set(b.parts.filter((p:any)=>p.kind==='category').map((p:any)=>p.id));assert.equal(ids.size,20);
 if(kind==='429'||kind==='transient')assert.ok(b.parts.filter((p:any)=>p.kind==='category').every((p:any)=>p.data.status==='unavailable'));
});
test('abort rejection propagates',async()=>{await assert.rejects(scenario(prepareListing,'abort'),{name:'AbortError'});});
test('same preparation takes one successful refreshed template snapshot; next refresh renews it',async()=>{
 const b=await scenario(prepareListing,'changing');
 assert.equal(b.calls,1);
 assert.equal(new Set(b.parts.filter((p:any)=>p.kind==='category'&&p.data.attributes.length&&p.data.attributes[0].id===1).map((p:any)=>p.data.attributes[0].name)).size,1);
 const f=fixture(1,2);let calls=0;f.client.getCategoryData=async()=>{calls++;return {status:'ok',raw:JSON.parse(template)};};
 const input={storeId:'bill',selections:[{id:'p1'},{id:'p2'}],categories:{p1:{descriptionCategoryId:'1',typeId:'2'},p2:{descriptionCategoryId:'1',typeId:'2'}},refresh:true};
 try{await prepareListing(input,f.options);assert.equal(calls,1);await prepareListing({...input,refresh:false},f.options);assert.equal(calls,1);await prepareListing(input,f.options);assert.equal(calls,2);await prepareListing({...input,storeId:'other'},f.options);assert.equal(calls,3);}finally{f.database.close();}
});
test('refresh keys distinguish category/type and concurrent preparations do not share successes',async()=>{
 const f=fixture(1,4);let calls=0;
 f.client.getCategoryData=async()=>{calls++;return {status:'ok',raw:JSON.parse(template)};};
 const selections=[1,2,3,4].map(i=>({id:`p${i}`})),categories=Object.fromEntries(selections.map((p,i)=>[p.id,{descriptionCategoryId:String(i%2+1),typeId:String(Math.floor(i/2)+1)}]));
 try{
  await prepareListing({storeId:'bill',selections,categories,refresh:true},f.options);assert.equal(calls,4);
  calls=0;const input={storeId:'bill',selections:[{id:'p1'}],categories:{p1:categories.p1},refresh:true};
  await Promise.all([prepareListing(input,f.options),prepareListing(input,f.options)]);assert.equal(calls,2);
  calls=0;await prepareListing({storeId:'bill',selections,categoryQuery:'shared search',refresh:true},f.options);assert.equal(calls,1);
 }finally{f.database.close();}
});

test('equivalent category inputs reuse refresh regardless of property insertion order',async()=>{
 const f=fixture(1,2);let calls=0;f.client.getCategoryData=async()=>{calls++;return {status:'ok',raw:JSON.parse(template)};};
 try{await prepareListing({storeId:'bill',selections:[{id:'p1'},{id:'p2'}],categories:{p1:{descriptionCategoryId:'1',typeId:'2'},p2:{typeId:'2',descriptionCategoryId:'1'}},refresh:true},f.options);assert.equal(calls,1);}finally{f.database.close();}
});

test('request-local reused templates retain exact dictionary reads for every product',async()=>{
 const f=fixture(1,2);let calls=0;
 f.client.getCategoryData=async()=>{calls++;return {status:'ok',raw:{result:[{id:55,name:'Material',is_required:true,dictionary_id:99}]}};};
 try{
  const ready=await prepareListing({storeId:'bill',selections:[{id:'p1'},{id:'p2'}],categories:{p1:{descriptionCategoryId:'1',typeId:'2'},p2:{typeId:'2',descriptionCategoryId:'1'}},refresh:true},f.options);
  const snapshot=f.store.get<any>('business_listing_preparations',ready.preparationRevision);
  const attributes=snapshot.parts.filter((p:any)=>p.kind==='category').flatMap((p:any)=>p.data.attributes);
  assert.equal(calls,1);assert.equal(attributes.length,2);
  for(const attribute of attributes)assert.deepEqual(attribute.available,{capability:'hallmark.categories.read',input:{storeId:'bill',mode:'values',descriptionCategoryId:'1',typeId:'2',attributeId:'55',limit:100}});
 }finally{f.database.close();}
});
