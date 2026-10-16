import test from 'node:test';
import assert from 'node:assert/strict';
import {realSourceProducts,realStores} from '../real-data/corpus.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort,HallmarkProvider,HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import {prepareListing} from '../../packages/app-hallmark/src/listing-prepare.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';

test('a long recorded source description is exactly recoverable from preparation material cursors',async()=>{
  const description=(source:any)=>source.description??source.sourceDetails?.description?.textDesc;
  const source=realSourceProducts().find(product=>product.skus.some((sku:any)=>sku.sourceSkuId)&&typeof description(product)==='string'&&Array.from(description(product)).length>3000)!;
  assert.ok(source,'A recorded long source description with stable SKU identity is required');
  const expected=description(source),stores=realStores(),storeId=String(stores[0].id),db=new RuntimeStore(':memory:'),store=new HallmarkStorePort(db,'material-description');
  let reads=0;
  const client:any={getStores:async()=>({status:'ok',raw:structuredClone(stores)}),getCollectedItemDetail:async(id:string)=>{assert.equal(id,source.id);reads++;return {status:'ok',raw:structuredClone(source)};}};
  const collection=new CollectionService({store,client}),packaging=new BusinessPackagingRepository(store),options={store,client,collection,packaging},provider=new HallmarkProvider({...options,broker:{} as any});
  try{
    let prepared=await prepareListing({storeId,selections:[{id:source.id}]},options);const materials:any[]=[];
    for(let pages=0;;pages++){
      assert.ok(pages<20,'preparation continuation must terminate');materials.push(...prepared.materials?.items??[]);
      if(!prepared.continuation)break;prepared=await prepareListing(prepared.continuation.input,options);
    }
    assert.equal(materials.length,1);const material=materials[0],hint=material.available.find((entry:any)=>entry.kind==='description');
    assert.ok(hint,'the preparation must retain the full-description read reference');
    assert.equal(material.description.totalCharacters,Array.from(expected).length);assert.equal(material.description.text,Array.from(expected).slice(0,material.description.returned).join(''));
    const descriptor=HALLMARK_DESCRIPTORS.find(d=>d.capabilityId==='hallmark.collection.resource.read')!;
    let text=material.description.text,cursor=material.description.nextCursor,pages=0;
    while(cursor){
      assert.ok(pages<100,'description continuation must progress');const input={...hint,cursor};assert.deepEqual(compileSchema(descriptor.inputSchema)(input),[]);
      const result:any=await provider.execute({request:{protocolVersion:'1.0',appId:'hallmark',connectionId:'local',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input,invocationId:`description-${pages}`,traceId:'description-control',source:{kind:'agent',sessionId:'local',nativeCallId:`description-${pages}`},deadlineAt:new Date(Date.now()+30000).toISOString()},signal:new AbortController().signal,configRevision:1});
      assert.equal(result.status,'ok',JSON.stringify(result));assert.equal(result.data.id,source.id);assert.equal(result.data.revision,material.revision);
      assert.ok(Buffer.byteLength(JSON.stringify(result.data))<=14000);text+=result.data.text;pages++;
      if(result.data.nextCursor)assert.notEqual(result.data.nextCursor,cursor);cursor=result.data.nextCursor;
    }
    assert.ok(text===expected,`preparation preview and returned cursors must reconstruct the entire recorded description (received ${Array.from(text).length} of ${Array.from(expected).length} code points)`);assert.ok(pages>1);assert.equal(reads,1);
  }finally{await provider.dispose();db.close();}
});
