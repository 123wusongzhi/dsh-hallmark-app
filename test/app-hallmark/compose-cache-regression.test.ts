import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {readOzonComposition} from '../../packages/app-hallmark/src/ozon-compose.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {OZON_COMPOSITION_SOURCE_FIELDS} from '../../packages/app-hallmark/src/ozon-composition.ts';
test('identical fresh cache hit skips archive write; divergent/saved-only cache repairs archive and survives failure/restart',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hallmark-cache-regression-')),db=join(root,'runtime.sqlite');let runtime=new RuntimeStore(db),port=new HallmarkStorePort(runtime,'fixture');
 const args={storeId:'synthetic',recipe:{version:1,grain:'product',fields:['products.title']},limit:100};
 const initialReader=async()=>({status:'ok',data:{items:[{...Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS.products.map(k=>[k,null])),productId:'1',sku:'10',title:'retained'}],warnings:['retained warning'],dataTime:null}} as any);
 try{
  const first:any=await readOzonComposition(args,port,{} as any,undefined,initialReader);assert.equal(first.status,'ok');
  let puts=0;const put=port.put.bind(port);port.put=(collection,id,value)=>{puts++;return put(collection,id,value);};
  const hit:any=await readOzonComposition(args,port,{} as any,undefined,async()=>{throw Error('fresh source must not refetch');});assert.equal(hit.status,'ok');assert.equal(puts,0);assert.deepEqual(hit.data.items,first.data.items);assert.deepEqual(hit.data.warnings,first.data.warnings);
  const archived=runtime.list<any>('provider_records').find(row=>row.namespace==='ozon_composition_source_results');
  // Equal fetchedAt alone must not hide a different payload.
  const changed=structuredClone(archived.value);changed.rows[0].title='divergent archive';port.put('ozon_composition_source_results',archived.recordId,changed);puts=0;
  const repaired:any=await readOzonComposition(args,port,{} as any,undefined,initialReader);assert.equal(repaired.status,'ok');assert.equal(puts,1);assert.deepEqual(port.get<any>('ozon_composition_source_results',archived.recordId).rows,first.data.items.map((item:any)=>item.products));
  runtime.delete('provider_records',canonicalJson(['hallmark','fixture',archived.namespace,archived.recordId]));puts=0;
  const missing:any=await readOzonComposition(args,port,{} as any,undefined,initialReader);assert.equal(missing.status,'ok');assert.equal(puts,1);assert.ok(port.get('ozon_composition_source_results',archived.recordId));
  runtime.close();runtime=new RuntimeStore(db);port=new HallmarkStorePort(runtime,'fixture');
  const failed:any=await readOzonComposition({...args,forceRefresh:true},port,{} as any,undefined,async()=>({status:'unavailable',error:{code:'UPSTREAM_UNAVAILABLE',message:'fixture outage',retryable:true,retryAfterMs:60000}}));assert.equal(failed.status,'ok');assert.deepEqual(failed.data.items,first.data.items);assert.equal(failed.data.cache.stale,true);assert.equal(failed.data.cache.fetchedAt,first.data.cache.fetchedAt);
  runtime.close();runtime=new RuntimeStore(db);port=new HallmarkStorePort(runtime,'fixture');
  const restart:any=await readOzonComposition(args,port,{} as any,undefined,async()=>{throw Error('persisted retry cooldown must avoid upstream');});assert.equal(restart.status,'ok');assert.deepEqual(restart.data.items,first.data.items);assert.equal(restart.data.cache.stale,true);assert.equal(restart.data.cache.fetchedAt,first.data.cache.fetchedAt);
 }finally{runtime.close();rmSync(root,{recursive:true,force:true});}
});
