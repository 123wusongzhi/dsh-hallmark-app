import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {BusinessSettingsService} from '../../packages/service/src/business-settings.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import {BusinessPricingRepository} from '../../packages/business-pricing/src/index.ts';
import {OzonBusinessGateway} from '../../packages/ozon-business/src/index.ts';
import {StableHallmarkBusinessStore} from '../../packages/app-hallmark/src/store.ts';
import type {CollectionProduct} from '../../packages/collection/src/index.ts';

function product(id:string):CollectionProduct {
  return {id,sourceId:'fixture',revision:'source-1',fetchedAt:'2026-10-10',source:'fixture',title:`商品 ${id}`,originalTitle:null,sourceUrl:null,category:{id:null,path:[]},attributes:{},package:{weightGrams:330,dimensionsMm:{length:250,width:100,height:100},original:{},basis:'product'},unit:'件',minimumOrder:1,customsCodes:[],description:'',assets:[],unknowns:[],mapping:{version:'1',coverage:'verified_structure'},skus:['red','blue'].map(sku=>({id:sku,spec:sku,attributes:{},purchaseCost:null,sourceDisplayPrice:null,package:null,imageRef:null,stock:null,enabled:true}))};
}
async function fixture(run:(value:any)=>Promise<void>){
  const directory=mkdtempSync(join(tmpdir(),'packaging-settings-')),database=new RuntimeStore(':memory:'),runtime=new AppsRuntime(database);
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[],execute:async()=>{throw Error('not expected');},dispose:async()=>{}});
  runtime.addConnection({appId:'hallmark',connectionId:'source',displayName:'资料连接',enabled:true,configRevision:1,config:{}});
  const store=new StableHallmarkBusinessStore(database,{connectionId:'source',scopeId:'fixture'}),packaging=new BusinessPackagingRepository(store),pricing=new BusinessPricingRepository(store),gateway=new OzonBusinessGateway(directory,{fetchImpl:async()=>{throw Error('No Ozon calls');}});
  const products=new Map([['p1',product('p1')],['p2',product('p2')]]),reads:string[]=[],searches:any[]=[];
  const collection={getProduct:async(id:string)=>{reads.push(id);return structuredClone(products.get(id)!);},search:async(input:any)=>{searches.push(input);return {items:[{id:'p1',title:'商品 p1',skuCount:2}],total:1};}};
  const service=new BusinessSettingsService(runtime,gateway,()=>pricing,{packagingFor:()=>packaging,collectionFor:()=>collection});
  const call=(operation:string,input:unknown,connectionId='source')=>service.write({connectionId,operation,input});
  try{await run({service,packaging,products,reads,searches,call});}finally{await runtime.dispose();database.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'packaging-settings-'));rmSync(directory,{recursive:true,force:true});}
}

test('packaging settings stay lazy, source scoped and work without a store or chat',async()=>fixture(async({service,reads,searches,call})=>{
  assert.equal(service.read('source').packagingAvailable,true);assert.equal(reads.length,0);
  await call('packaging.search',{query:'型号'});assert.deepEqual(searches,[{query:'型号',cursor:undefined,limit:30}]);
  const table=await call('packaging.read',{itemIds:['p1']});assert.equal(table.rows.length,2);assert.deepEqual(reads,['p1']);
  assert.equal(table.rows[0].result.weightKg,.33);assert.deepEqual(table.rows[0].result.dimensionsCm,{length:25,width:10,height:10});assert.equal(table.rows[0].result.origin.weight,'product-common');
  await assert.rejects(call('packaging.read',{itemIds:['p1']},'other'),/连接不可用/);
}));

test('manual packaging survives source refresh and reset restores current source values',async()=>fixture(async({call,products})=>{
  let table=await call('packaging.read',{itemIds:['p1']});const target=table.rows[0].target;
  await call('packaging.save',{rows:[{target,values:{weightKg:.5},expectedRevision:0}]});
  products.get('p1').package.weightGrams=400;products.get('p1').revision='source-2';
  table=await call('packaging.read',{itemIds:['p1']});assert.equal(table.rows[0].result.weightKg,.5);assert.equal(table.rows[1].result.weightKg,.4);assert.equal(table.rows[0].result.origin.weight,'user');
  await call('packaging.remove',{rows:[{target,expectedRevision:1}]});
  table=await call('packaging.read',{itemIds:['p1']});assert.equal(table.rows[0].result.weightKg,.4);assert.equal(table.rows[0].result.origin.weight,'product-common');
}));

test('table can register auto combinations, sums quantities, exposes null and keeps stable identity across aliases',async()=>fixture(async({call,products})=>{
  const members=[{itemId:'p1',sourceSkuId:'red',quantity:2},{itemId:'p2',sourceSkuId:'blue',quantity:1}];
  let preview=await call('packaging.read',{compositions:[{id:'combo',members}]});const row=preview.rows[0];
  assert.equal(row.result.weightKg,.99);assert.deepEqual(row.result.dimensionsCm,{length:25,width:10,height:10});
  await call('packaging.save',{rows:[{target:row.target,values:{},expectedRevision:0}]});
  let table=await call('packaging.read',{itemIds:['p1']});assert.equal(table.rows.filter((row:any)=>row.kind==='combination').length,1);
  preview=await call('packaging.read',{itemIds:['p1'],compositions:[{id:'other-alias',members}]});assert.equal(preview.rows.filter((row:any)=>row.kind==='combination').length,1);
  products.get('p2').package.weightGrams=null;
  table=await call('packaging.read',{itemIds:['p1']});const combination=table.rows.find((row:any)=>row.kind==='combination');assert.equal(combination.result.weightKg,null);assert.deepEqual(combination.result.dimensionsCm,{length:25,width:10,height:10});assert.ok(combination.result.missing.some((value:any)=>value.field==='weightKg'));
  await assert.rejects(call('packaging.read',{compositions:[{id:'bad',members:[{itemId:'p1',sourceSkuId:'absent',quantity:1}]}]}),/找不到规格/);
}));

test('packaging batch writes are atomic on stale revision and reject invalid dimensions',async()=>fixture(async({call})=>{
  const table=await call('packaging.read',{itemIds:['p1']}),[a,b]=table.rows;
  await call('packaging.save',{rows:[{target:b.target,values:{weightKg:.7},expectedRevision:0}]});
  await assert.rejects(call('packaging.save',{rows:[{target:a.target,values:{weightKg:.6},expectedRevision:0},{target:b.target,values:{weightKg:.8},expectedRevision:0}]}),/已更新/);
  const fresh=await call('packaging.read',{itemIds:['p1']});assert.equal(fresh.rows[0].result.weightKg,.33);assert.equal(fresh.rows[1].result.weightKg,.7);
  await assert.rejects(call('packaging.save',{rows:[{target:a.target,values:{dimensionsCm:{length:2}},expectedRevision:0}]}));
}));
