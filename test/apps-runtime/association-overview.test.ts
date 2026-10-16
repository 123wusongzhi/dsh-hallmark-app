import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedProduct,recordedPlatformProduct} from '../adapter/real-scenarios.ts';
import {associationRows,AssociationOverviewService} from '../../packages/service/src/association-overview.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {businessHash} from '../../packages/app-hallmark/src/operations/index.ts';

const now=Date.now(),at=new Date(now).toISOString();
const sync={storeId:'bill',state:'fresh' as const,observedAt:at,attemptedAt:at,expiresAt:new Date(now+300000).toISOString(),total:2,missing:0};
const product=(overrides={})=>recordedProduct({storeId:'bill',offerId:'offer',productId:'100',observedAt:at,statusObservation:'observed',saleState:'on_sale',sources:[{productId:'source',sourceSkuMatched:true,components:[{sourceSkuId:'sku-1',quantity:2},{sourceSkuId:'sku-2',quantity:1}]}],...overrides});
const cards=[{id:'source',title:product().title},{id:'unused',title:product().title}];

test('bidirectional edges retain combination quantities and never match equal titles',()=>{
  const rows=associationRows([product(),product({offerId:'no-link',productId:'101',sources:[]})],cards,sync,true,true,now);
  assert.equal(rows.sales[0].sales[0].sources[0].parts[0].quantity,2);
  assert.equal(rows.sales[0].sales[0].saleState,'on_sale');
  assert.equal(rows.sales[1].association,'none');
  assert.equal(rows.collection[0].sales.length,1);
  assert.equal(rows.collection[1].association,'none');
});

test('missing sources, failed sync, source mismatch and incomplete collection never prove no association',()=>{
  for(const rows of [
    associationRows([product({sources:undefined})],cards,sync,true,true,now),
    associationRows([product()],cards,{...sync,state:'failed'},true,true,now),
    associationRows([product()],cards,sync,false,true,now),
    associationRows([product()],cards,sync,true,false,now),
  ])assert.equal(rows.collection[1].association,'unknown');
  assert.equal(associationRows([product()],cards,sync,false,true,now).sales[0].association,'unknown');
  assert.equal(associationRows([product()],cards,sync,true,true,now+300001).sales[0].sales[0].saleState,'unknown');
  assert.equal(associationRows([product()],[],sync,true,false,now).sales[0].sales[0].sources[0].available,false);
});

test('overview reads all collection pages, filters before paging and rejects cross-connection stores',async()=>{
  const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'overview');
  let sourceFails=false,calls=0;
  const listed=Array.from({length:35},(_,index)=>({id:`item-${String(index).padStart(2,'0')}`,title:product().title}));
  store.put('business_catalog',businessHash(['bill','offer']),product({sources:[]}));
  const service=new AssociationOverviewService({
    runtime:{getConnection:()=>({enabled:true})} as any,
    gateway:{getStore:(id:string)=>({id,sourceConnectionId:id==='other'?'other':'connection'}),listStores:()=>[{id:'bill',sourceConnectionId:'connection'}],getProducts:async()=>({status:'ok',raw:{items:[recordedPlatformProduct({id:100,offer_id:'offer',name:product().title})]}})} as any,
    storeFor:()=>store,clientFor:()=>({} as any),sourceMatches:()=>true,
    collectionFor:()=>({search:async(input:any)=>{calls++;if(sourceFails)throw Error('offline');return {items:input.cursor?listed.slice(20):listed.slice(0,20),nextCursor:input.cursor?null:'page-2'};}}),
  });
  try{
    const query={connectionId:'connection',storeId:'bill',direction:'collection',association:'none',page:'2'};
    const result=await service.read(query);assert.equal(calls,2);assert.equal(result.total,35);assert.equal(result.rows.length,5);assert.equal(result.page,2);
    const focused=await service.read({...query,focus:'item-34'});assert.equal(focused.total,1);assert.equal(focused.rows[0].id,'item-34');assert.equal(focused.page,1);
    await assert.rejects(service.read({...query,storeId:'other'}),/不属于/);
    await assert.rejects(service.read({...query,page:'NaN'}),/参数无效/);
    sourceFails=true;const failed=await service.read(query);assert.ok(failed.warnings.length);assert.equal(failed.total,0);
  }finally{database.close();}
});
