import test from 'node:test';
import assert from 'node:assert/strict';
import {realSourceProducts,realStores} from '../real-data/corpus.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import type {CoreClient} from '../../packages/core/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

test('a failed detail refresh does not prevent later preparation through the same provider',async t=>{
  const source=realSourceProducts().find(product=>product.skus.some((sku:any)=>typeof sku.sourceSkuId==='string'&&sku.sourceSkuId))!;
  assert.ok(source);const sku=source.skus.find((sku:any)=>typeof sku.sourceSkuId==='string'&&sku.sourceSkuId),stores=realStores(),storeId=String(stores[0].id);
  const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'detail-recovery-control'),runtime=new AppsRuntime(db);let detailReads=0,networkCalls=0,serial=0;
  t.mock.method(globalThis,'fetch',async()=>{networkCalls++;throw Error('External requests are forbidden in this local recovery test');});
  const client={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCollectedItemDetail:async(id:string)=>{assert.equal(id,source.id);detailReads++;
    // A transport failure is an explicit lifecycle control; both successful replies are identical recorded source facts.
    return detailReads===2?{status:'unavailable',error:{code:'SOURCE_RETRY_CONTROL',message:'Synthetic temporary source outage',retryable:true}}:{status:'ok',raw:structuredClone(source)};
  }} as unknown as CoreClient;
  // Deliberately let the real Provider construct and reuse its own CollectionService.
  runtime.register(new HallmarkProvider({store:port,client,broker:{} as any}));
  runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Detail recovery control',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'local',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const invoke=async(capabilityId:string,input:JsonValue)=>runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId,capabilityVersion:'1.0.0',input,invocationId:`detail-${++serial}`,traceId:'detail-recovery-control',source:{kind:'agent',sessionId:'local',nativeCallId:`detail-${serial}`},deadlineAt:new Date(Date.now()+5000).toISOString()});
  try{
    const warm:any=await invoke('hallmark.collection.read',{id:source.id,skuIds:[sku.sourceSkuId]});assert.equal(warm.status,'ok');assert.equal(detailReads,1);
    const original:any=port.get('collection_products',`local:${source.id}`);assert.ok(original.generation);
    const failed:any=await invoke('hallmark.collection.read',{id:source.id,skuIds:[sku.sourceSkuId],refresh:true});assert.equal(failed.status,'failed');assert.equal(failed.error.code,'SOURCE_RETRY_CONTROL');assert.equal(detailReads,2);
    assert.equal((port.get<any>('collection_products',`local:${source.id}`)).generation,original.generation);assert.equal(port.list('business_listing_preparations').length,0);
    let prepared:any=await invoke('hallmark.listing.prepare',{storeId,selections:[{id:source.id,skuIds:[sku.sourceSkuId]}],refresh:true});
    assert.equal(prepared.status,'ok','a later preparation must retry the source after the earlier detail refresh failed');assert.equal(detailReads,3);
    const preparationRevision=prepared.data.preparationRevision,materials:any[]=[],sales:any[]=[];
    for(let pages=0;;pages++){assert.ok(pages<20);materials.push(...prepared.data.materials?.items??[]);sales.push(...prepared.data.sales);if(!prepared.data.continuation)break;prepared=await invoke(prepared.data.continuation.capability,prepared.data.continuation.input);assert.equal(prepared.status,'ok');}
    assert.equal(materials.length,1);assert.equal(materials[0].id,source.id);assert.equal(materials[0].facts.title,source.title);assert.deepEqual(materials[0].skus.rows.map((row:any[])=>row[0]),[sku.sourceSkuId]);
    assert.equal(sales.length,1);assert.deepEqual(sales[0].procurement,[{itemId:source.id,sourceSkuId:sku.sourceSkuId,quantity:1}]);
    const current:any=port.get('collection_products',`local:${source.id}`),snapshot:any=port.get('business_listing_preparations',preparationRevision);assert.notEqual(current.generation,original.generation);assert.equal(snapshot.sourceRevisions[source.id],current.product.revision);assert.equal(materials[0].revision,current.product.revision);
    assert.equal(detailReads,3);assert.equal(db.list('operations').length,0);assert.equal(networkCalls,0);
  }finally{await runtime.dispose();db.close();}
});
