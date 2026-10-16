import test from 'node:test';
import assert from 'node:assert/strict';
import {realSourceProducts,realStores,realStoreProducts} from '../real-data/corpus.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

test('provider rejects an outdated preparation source revision before saving another draft',async t=>{
  const source=realSourceProducts().find(product=>product.skus.some((sku:any)=>typeof sku.sourceSkuId==='string'&&sku.sourceSkuId))!;
  assert.ok(source,'A recorded source product with a stable SKU identity is required');
  const sku=source.skus.find((sku:any)=>typeof sku.sourceSkuId==='string'&&sku.sourceSkuId),stores=realStores(),storeId=String(stores[0].id),products=realStoreProducts();
  assert.ok(sku,'The selected recorded source SKU must exist');
  const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'revision-control'),runtime=new AppsRuntime(db);let networkCalls=0,serial=0;
  t.mock.method(globalThis,'fetch',async()=>{networkCalls++;throw Error('Network is forbidden in this local revision test');});
  const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getStoreProducts:async()=>({status:'ok',raw:structuredClone(products)}),getCollectedItemDetail:async(id:string)=>{assert.equal(id,source.id);return {status:'ok',raw:structuredClone(source)};}} as unknown as CoreClient;
  const collection=new CollectionService({store:port,client}),packaging=new BusinessPackagingRepository(port);
  runtime.register(new HallmarkProvider({store:port,client,broker:{} as any,collection,packaging}));
  runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Revision control',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const invoke=async(capabilityId:string,input:JsonValue)=>runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId,capabilityVersion:'1.0.0',input,invocationId:`revision-${++serial}`,traceId:'revision-control',source:{kind:'agent',sessionId:'local',nativeCallId:`revision-${serial}`},deadlineAt:new Date(Date.now()+30000).toISOString()});
  try{
    // Composition/offer IDs are local workflow controls; source IDs, SKU and product facts are unchanged.
    const saleId='revision-control-sale',prepared:any=await invoke('hallmark.listing.prepare',{storeId,selections:[{id:source.id,skuIds:[sku.sourceSkuId]}],compositions:[{id:saleId,members:[{itemId:source.id,sourceSkuId:sku.sourceSkuId,quantity:1}]}]});
    assert.equal(prepared.status,'ok',JSON.stringify(prepared));let page=prepared.data,found=false;
    for(let count=0;;count++){
      assert.ok(count<20);found||=page.sales.some((sale:any)=>sale.id===saleId);if(!page.continuation)break;
      const next:any=await invoke(page.continuation.capability,page.continuation.input);assert.equal(next.status,'ok',JSON.stringify(next));page=next.data;
    }
    assert.ok(found,'the sale reference must be delivered by the real preparation flow');
    const original:any=port.get('business_listing_preparations',prepared.data.preparationRevision),current=await collection.getProduct(source.id);
    assert.ok(original,'The real preparation must persist its source revision snapshot');
    assert.equal(original.sourceRevisions[source.id],current.revision);
    const row={action:'listing',saleId,target:{offerId:'revision-control-offer'},payload:{name:source.title}};
    const fresh:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:prepared.data.preparationRevision,rows:[row]});
    assert.equal(fresh.status,'ok',JSON.stringify(fresh));assert.equal(port.list('business_plans').length,1);
    assert.deepEqual(fresh.data.rows[0].procurement,[{itemId:source.id,sourceSkuId:sku.sourceSkuId,quantity:1}]);
    // Only snapshot lifecycle metadata changes. No recorded business field or sale-ID fixture is rewritten.
    const stale=structuredClone(original);stale.revision='outdated-preparation-control';stale.sourceRevisions[source.id]='outdated-source-revision-control';port.put('business_listing_preparations',stale.revision,stale);
    const rejected:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:stale.revision,rows:[row]});
    assert.equal(rejected.status,'failed','provider must pass the current source revision reader into draft resolution');assert.equal(rejected.error.code,'LISTING_SOURCE_REVISION_CHANGED');
    const model=JSON.parse(projectModelResult(db,rejected).content);
    if(!model.error.details?.recovery)t.diagnostic('Baseline: source revision failure has no verified source identity or executable read route.');
    assert.equal(model.error.retryPolicy,'never');
    assert.equal(model.error.details.recovery.capability,'hallmark.collection.read');
    assert.deepEqual(model.error.details.recovery.input,{id:source.id,skuIds:[sku.sourceSkuId],revision:current.revision,limit:10,maxBytes:8000});
    const read:any=await invoke(model.error.details.recovery.capability,model.error.details.recovery.input);assert.equal(read.status,'ok',JSON.stringify(read));
    assert.equal(read.data.items[0].revision,current.revision);
    assert.ok(Buffer.byteLength(JSON.stringify(model))<5000);assert.equal(projectModelResult(db,rejected).fullResultRef,undefined);
    // Neither a huge caller payload nor an untrusted preparation reference is echoed into recovery.
    const huge='negative-input-control-'.repeat(10000);
    const hugePayload:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:stale.revision,rows:[{...row,payload:{name:huge}}]});
    assert.equal(hugePayload.error.code,'LISTING_SOURCE_REVISION_CHANGED');assert.deepEqual(hugePayload.error.details,model.error.details);assert.ok(!JSON.stringify(hugePayload).includes(huge));
    const missing:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:huge,rows:[row]});
    assert.equal(missing.error.code,'LISTING_PREPARATION_NOT_FOUND');assert.equal(missing.error.details,undefined);assert.ok(Buffer.byteLength(JSON.stringify(missing))<1000);
    assert.ok(stores.length>1);
    const wrongStore:any=await invoke('hallmark.listing.draft.create',{storeId:String(stores[1].id),preparationRevision:stale.revision,rows:[row]});
    assert.equal(wrongStore.error.code,'LISTING_PREPARATION_NOT_FOUND');assert.equal(wrongStore.error.details,undefined);
    const wrongSale:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:stale.revision,rows:[{...row,saleId:'missing-sale-control'}]});
    assert.equal(wrongSale.error.code,'LISTING_SALE_NOT_FOUND');assert.equal(wrongSale.error.details,undefined);
    // A changed source after the error must fail a pinned read rather than silently accept a newer revision.
    const getProduct=collection.getProduct.bind(collection);
    const mocked=t.mock.method(collection,'getProduct',async(...args:Parameters<typeof getProduct>)=>({...await getProduct(...args),revision:'newer-source-revision-control'}));
    const raced:any=await invoke(model.error.details.recovery.capability,model.error.details.recovery.input);
    assert.equal(raced.status,'failed');assert.equal(raced.error.code,'COLLECTION_REVISION_CHANGED');mocked.mock.restore();
    // A removed original SKU remains blocked; recovery never broadens to other source SKUs.
    const removed=t.mock.method(collection,'getProduct',async(...args:Parameters<typeof getProduct>)=>({...await getProduct(...args),skus:[]}));
    const missingSku:any=await invoke(model.error.details.recovery.capability,model.error.details.recovery.input);
    assert.equal(missingSku.status,'failed');assert.equal(missingSku.error.code,'COLLECTION_SKU_NOT_FOUND');removed.mock.restore();
    // Oversized verified source metadata is omitted atomically, with no partial executable scope.
    const oversized=t.mock.method(collection,'getProduct',async(...args:Parameters<typeof getProduct>)=>({...await getProduct(...args),revision:huge}));
    const bounded:any=await invoke('hallmark.listing.draft.create',{storeId,preparationRevision:stale.revision,rows:[row]});
    assert.equal(bounded.error.code,'LISTING_SOURCE_REVISION_CHANGED');assert.equal(bounded.error.details.recovery,undefined);
    assert.equal(bounded.error.details.recoveryOmitted,'verified_scope_exceeds_budget');assert.ok(Buffer.byteLength(JSON.stringify(bounded))<2000);oversized.mock.restore();
    assert.equal(port.list('business_plans').length,1,'outdated material references must not create a second draft');assert.equal(db.list('operations').length,0);assert.equal(networkCalls,0);
  }finally{await runtime.dispose();db.close();}
});
