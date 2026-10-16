import test from 'node:test';
import assert from 'node:assert/strict';
import {realCollections,realSourceProducts,realStores,realAncillary} from '../real-data/corpus.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import {prepareListing,readListingCategory} from '../../packages/app-hallmark/src/listing-prepare.ts';
import {executeBusiness,resolveListingRows} from '../../packages/app-hallmark/src/operations-provider.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';

// Business facts and category constraints come from the integrity-checked recorded corpus.
// Plan IDs, pagination limits and mutations below are explicit lifecycle test controls.
function fixture(t:any){
 const db=new RuntimeStore(':memory:'),store=new HallmarkStorePort(db,'real-agent-flow');t.after(()=>db.close());
 const stableIds=new Set(realCollections().filter(c=>c.skus.some(s=>s.id)).map(c=>c.id));
 const products=realSourceProducts().filter(p=>stableIds.has(p.id)),stores=realStores(),storeId=String(stores[0].id);
 const template=realAncillary('ozonCategoryTemplate');
 const client:any={getStores:async()=>({status:'ok',raw:stores}),getCollectedItemDetail:async(id:string)=>({status:'ok',raw:structuredClone(products.find(p=>p.id===id))}),getCategoryData:async()=>({status:'ok',raw:{result:template.attributes}})};
 const collection=new CollectionService({store,client}),packaging=new BusinessPackagingRepository(store);
 return {db,store,storeId,products,template,options:{store,client,collection,packaging},input:{storeId,selections:[{id:products[0].id}]}};
}
test('real preparation survives repeated calls, known-fact reuse and category selection; changed compositions invalidate sales version',async t=>{
 const f=fixture(t),first=await prepareListing(f.input,f.options);await new Promise(r=>setTimeout(r,5));
 const repeated=await prepareListing(f.input,f.options);assert.equal(repeated.preparationRevision,first.preparationRevision);assert.equal(repeated.preparedAt,first.preparedAt);
 const product=await f.options.collection.getProduct(f.products[0].id);
 const selected=await prepareListing({...f.input,knownRevisions:{[product.id]:product.revision},categories:{[product.id]:{descriptionCategoryId:String(f.template.descriptionCategoryId),typeId:String(f.template.typeId)}}},f.options);
 assert.equal(selected.salesRevision,first.salesRevision);
 const snapshot:any=f.store.get('business_listing_preparations',first.preparationRevision),sale=snapshot.parts.find((p:any)=>p.kind==='sale').data;
 const changed=await prepareListing({...f.input,compositions:[{id:sale.id,members:sale.procurement.map((p:any)=>({...p,quantity:p.quantity+1}))}]},f.options);
 assert.notEqual(changed.salesRevision,first.salesRevision);
 if(first.continuation)assert.equal((await prepareListing(first.continuation.input,f.options)).preparationRevision,first.preparationRevision);
});
test('real sales references resolve without copied procurement and reject wrong store, SKU, mismatches and stale source',async t=>{
 const f=fixture(t),prepared=await prepareListing(f.input,f.options),snapshot:any=f.store.get('business_listing_preparations',prepared.preparationRevision),sale=snapshot.parts.find((p:any)=>p.kind==='sale').data;
 const row:any={action:'listing',target:{offerId:sale.id},payload:{name:f.products[0].title},saleId:sale.id};
 const current=async(id:string)=>(await f.options.collection.getProduct(id)).revision;
 const [resolved]=await resolveListingRows(f.store,f.storeId,[row],prepared.preparationRevision,current);assert.deepEqual(resolved.procurement,sale.procurement);assert.equal(row.procurement,undefined);
 await assert.rejects(resolveListingRows(f.store,'wrong-store',[row],prepared.preparationRevision,current),/PREPARATION_NOT_FOUND/);
 await assert.rejects(resolveListingRows(f.store,f.storeId,[{...row,saleId:'missing'}],prepared.preparationRevision,current),/SALE_NOT_FOUND/);
 await assert.rejects(resolveListingRows(f.store,f.storeId,[{...row,procurement:[]}],prepared.preparationRevision,current),/PROCUREMENT_MISMATCH/);
 await assert.rejects(resolveListingRows(f.store,f.storeId,[row],prepared.preparationRevision,async()=> 'changed-source'),/SOURCE_REVISION_CHANGED/);
});
test('every eligible recorded product keeps its preparation and production versions across replay',async t=>{
 const f=fixture(t);let sales=0;
 for(let offset=0;offset<f.products.length;offset+=30){
  const selections=f.products.slice(offset,offset+30).map(p=>({id:p.id})),input={storeId:f.storeId,selections};
  const first=await prepareListing(input,f.options),again=await prepareListing(input,f.options);
  assert.equal(again.preparationRevision,first.preparationRevision);assert.equal(again.salesRevision,first.salesRevision);
  const snapshot:any=f.store.get('business_listing_preparations',first.preparationRevision);sales+=snapshot.totals.sales;
 }
 assert.ok(sales>0);t.diagnostic(`Recorded eligible products: ${f.products.length}; sales: ${sales}`);
});
test('real category constraints are paged without re-preparation or embedded dictionaries',async t=>{
 const f=fixture(t),input={storeId:f.storeId,descriptionCategoryId:String(f.template.descriptionCategoryId),typeId:String(f.template.typeId)};
 const required=await readListingCategory(input,f.options);assert.equal(required.page.total,f.template.attributes.filter((a:any)=>a.is_required===true||a.required===true).length);
 const seen:any[]=[];let page=await readListingCategory({...input,scope:'all',limit:3},f.options);
 for(;;){seen.push(...page.attributes);if(!page.continuation)break;page=await readListingCategory(page.continuation.input,f.options);}
 assert.equal(seen.length,f.template.attributes.length);assert.ok(seen.every(a=>!a.values&&!a.dictionary_values&&!a.options));
 const id=String(seen[0].id??seen[0].attribute_id),one=await readListingCategory({...input,attributeIds:[id]},f.options);assert.equal(one.attributes.length,1);
 assert.equal(f.store.list('business_listing_preparations').length,0);
});
test('real product plans list all summaries and expose exact normalized payload through explicit reads',async t=>{
 const f=fixture(t),plans=f.products.map((p,i)=>({planId:p.id,storeId:f.storeId,title:p.title,revision:1,status:'draft',createdAt:'2026-10-14',updatedAt:'2026-10-14',rows:[{rowId:String(i),revision:1,action:'listing',status:'draft',target:{offerId:p.id},payload:{name:p.title,images:p.images,attributes:p.attributes??[],price:'1'},procurement:[],issues:[],corrections:[]}]}));
 const operations:any={list:()=>structuredClone(plans),get:(id:string)=>structuredClone(plans.find(p=>p.planId===id))};
 let serial=0;
 const read=async(capabilityId:string,input:any)=>{const request:any={appId:'hallmark',connectionId:'recorded',capabilityId,input,invocationId:String(++serial),traceId:'test'};f.db.put('invocations',request.invocationId,{request});const result=await executeBusiness(operations,f.store,{request} as any);assert.equal(result.status,'ok');return JSON.parse(projectModelResult(f.db,result).content);};
 const ids:string[]=[];let input:any={storeId:f.storeId,limit:4};
 for(;;){const page=await read('hallmark.plan.list',input);assert.ok(page.data);ids.push(...page.data.plans.map((p:any)=>p.planId));assert.ok(page.data.plans.every((p:any)=>!p.rows&&p.rowCount===1));if(!page.data.continuation)break;input=page.data.continuation.arguments.input;}
 assert.deepEqual(ids.sort(),plans.map(p=>p.planId).sort());
 const summary=await read('hallmark.listing.draft.get',{planId:plans[0].planId});assert.equal(summary.data.payloadRead.arguments.input.view,'payload');
 const payload=await read('hallmark.listing.draft.get',{planId:plans[0].planId,view:'payload',rowIds:['0']});assert.deepEqual(payload.data.rows[0].payload,plans[0].rows[0].payload);assert.equal(payload.data.rows[0].context,undefined);
});
