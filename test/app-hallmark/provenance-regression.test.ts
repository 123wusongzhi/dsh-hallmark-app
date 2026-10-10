import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort,HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';
test('self-contained compose/procurement provenance skips unrelated payload, while every metadata fallback is retained',()=>{
 const runtime=new RuntimeStore(':memory:'),port=new HallmarkStorePort(runtime,'fixture');
 try{
  port.put('snapshots','store_products:synthetic',{state:'failed',lastSuccessAt:'2026-09-01T00:00:00Z',payload:{products:[]}});
  let reads=0;const get=port.get.bind(port);port.get=(collection,id)=>{if(collection==='snapshots')reads++;return get(collection,id);};
  const provider=new HallmarkProvider({store:port,client:{} as any,broker:{} as any});
  const context=(capabilityId:string)=>({request:{invocationId:'i',traceId:'t',connectionId:'fixture',capabilityId,input:{storeId:'synthetic'}},configRevision:1});
  const old={source:'hallmark_compute',endpoint:'fixture',fetchedAt:'2026-10-01T00:00:00Z'};
  for(const cap of ['hallmark.ozon.compose','hallmark.products.procurement'])for(const stale of [false,true]){
   reads=0;const r=(provider as any).convert({status:'ok',data:{cache:{stale}},provenance:old},context(cap));assert.equal(r.status,'ok');assert.equal(reads,0);assert.equal(r.provenance[0].fetchedAt,old.fetchedAt);assert.equal(r.provenance[0].freshness,stale?'stale':'fresh');
  }
  for(const cap of ['hallmark.ozon.compose','hallmark.products.procurement'])for(const fetchedAt of [undefined,null]){
   reads=0;const r=(provider as any).convert({status:'ok',data:{cache:{stale:false}},provenance:{source:'hallmark_compute',...(fetchedAt===null?{fetchedAt:null}:{})}},context(cap));assert.equal(r.status,'ok');assert.equal(reads,1);assert.equal(r.provenance[0].fetchedAt,'2026-09-01T00:00:00Z');assert.equal(r.provenance[0].freshness,'fresh');
  }
  for(const cap of ['hallmark.ozon.compose','hallmark.products.procurement','hallmark.products.list']){
   reads=0;const r=(provider as any).convert({status:'ok',data:{items:[]},provenance:old},context(cap));assert.equal(r.status,'ok');assert.equal(reads,1);assert.equal(r.provenance[0].freshness,'stale');assert.equal(r.provenance[0].fetchedAt,old.fetchedAt);
  }
  reads=0;const metric=(provider as any).convert({status:'ok',data:{items:[]},metricBasis:'fixture only'},context('hallmark.products.list'));assert.equal(metric.status,'ok');assert.equal(reads,1);assert.equal(metric.provenance[0].fetchedAt,'2026-09-01T00:00:00Z');assert.equal(metric.provenance[0].metricBasis,'fixture only');
 }finally{runtime.close();}
});
