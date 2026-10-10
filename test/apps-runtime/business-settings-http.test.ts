import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BusinessSettingsService} from '../../packages/service/src/business-settings.ts';
import {OzonBusinessGateway} from '../../packages/ozon-business/src/index.ts';
import {BusinessPricingRepository,legacyReferenceDraft,dynamicReferenceDraft} from '../../packages/business-pricing/src/index.ts';
import {StableHallmarkBusinessStore,HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';

test('ERP settings retain store ownership, private credentials, pricing revisions and authenticated Host flow',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'business-settings-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let reads=0;
 runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[],execute:async()=>{throw Error('not expected');},dispose:async()=>{}});
 for(const id of ['local','other'])runtime.addConnection({appId:'hallmark',connectionId:id,displayName:id,enabled:true,configRevision:1,config:{}});
 runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
 const gateway=new OzonBusinessGateway(directory,{fetchImpl:async()=>{reads++;return Response.json({name:'Fixture store'});}});
 const pricing=new BusinessPricingRepository(new StableHallmarkBusinessStore(store,{connectionId:'local',scopeId:'fixture'}));
 const packaging=new BusinessPackagingRepository(new StableHallmarkBusinessStore(store,{connectionId:'local',scopeId:'fixture'}));
 const collection=new CollectionService({store:new HallmarkStorePort(store,'local'),client:{searchCollectedItems:async()=>({status:'ok',raw:[{id:'source-product',title:'测试杯',source:'taobao_tmall',skuCount:1}]}),getCollectedItem:async()=>{throw Error('Raw collection is not needed');},getCollectedItemDetail:async()=>({status:'ok',raw:{id:'source-product',title:'测试杯',source:'taobao_tmall',currency:'CNY',package:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}},skus:[{sourceSkuId:'red',spec:'红色',goodsPrice:3,currency:'CNY'}]}})}});
 const settings=new BusinessSettingsService(runtime,gateway,()=>pricing,{packagingFor:()=>packaging,collectionFor:()=>collection}),presentation=new AppsPresentationService({store,runtime});
 const token='fixture-token'.repeat(4),server=createAppsServer({runtime,presentation,businessSettings:settings,token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 const host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>id==='s'?{id}:undefined},sessions:{get:id=>id==='s'?{id}:undefined}},new HttpAppsHostTransport(base,token));await host.start();
 const post=async(operation:string,input:unknown,connectionId='local',sessionId='s')=>host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'businessSettings',sessionId,connectionId,operation,input})}));
 try{
  assert.equal((await fetch(`${base}/v1/business-settings`)).status,401);
  assert.equal((await post('store.save',{name:'No',expectedRevision:0},'local','absent')).status,400);
  const saved=await post('store.save',{name:'Fixture',expectedRevision:0,credentials:{clientId:'private-client',apiKey:'private-key'}});assert.equal(saved.status,200);const savedText=await saved.text();assert.ok(!savedText.includes('private-key')&&!savedText.includes('private-client'));const id=JSON.parse(savedText).store.id;
  assert.equal((await post('store.check',{storeId:id})).status,200);assert.equal(reads,1);
  assert.notEqual((await post('store.check',{storeId:id},'other')).status,200);
  const result=await post('pricing.save',{storeId:id,expectedRevision:0,config:legacyReferenceDraft()});assert.equal(result.status,200);assert.equal((await result.json()).pricing.revision,1);
  assert.notEqual((await post('pricing.save',{storeId:id,expectedRevision:0,config:legacyReferenceDraft()})).status,200);
  const quote=await post('pricing.quote',{storeId:id,action:'price',purchaseMinor:343,weightGrams:35,priceMinor:1037,pricingMode:'manual'});assert.equal(quote.status,200);const value=(await quote.json()).quote;assert.equal(value.configRevision,1);assert.equal(value.breakdown.purchaseMinor,343);assert.equal(value.breakdown.fixedMinor,316);assert.equal(value.breakdown.logisticsMinor,138);
  const read=await host.ui(new Request(`http://localhost/api/dsh-apps?resource=businessSettings&connectionId=local&storeId=${id}`));assert.equal(read.status,200);assert.equal((await read.json()).pricing.minimumMarginPpm,null);
  const detached=await host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'businessSettings',connectionId:'local',operation:'pricing.quote',input:{storeId:id,action:'price',purchaseMinor:343,weightGrams:35,pricingMode:'automatic'}})}));assert.equal(detached.status,200,'ERP settings do not require an active chat');
  const dynamic=dynamicReferenceDraft();
  const dynamicSave=await post('pricing.save',{storeId:id,expectedRevision:1,config:dynamic});assert.equal(dynamicSave.status,200);assert.equal((await dynamicSave.json()).pricing.revision,2);
  for(const [priceMinor,fixedMinor] of [[13499,316],[13500,1800],[13501,1800]]){
   const response=await post('pricing.quote',{storeId:id,action:'promotion.price',purchaseMinor:343,weightGrams:35,priceMinor,pricingMode:'manual',planId:dynamic.plans[0].id});assert.equal(response.status,200);const actual=(await response.json()).quote;
   assert.equal(actual.selectionMode,'automatic');assert.equal(actual.breakdown.fixedMinor,fixedMinor);assert.equal(actual.configRevision,2);assert.equal(actual.evaluatedPriceMinor,priceMinor);
  }
  dynamic.plans.push({...dynamic.plans[0],id:'overlap-expensive',name:'重合取贵',maxPriceExclusiveMinor:undefined,fixedMinor:2500});
  assert.equal((await post('pricing.save',{storeId:id,expectedRevision:2,config:dynamic})).status,200);
  const overlapping=await post('pricing.quote',{storeId:id,action:'price',purchaseMinor:343,weightGrams:35,priceMinor:13499,pricingMode:'manual'});const expensive=(await overlapping.json()).quote;
  assert.equal(expensive.planId,'overlap-expensive');assert.equal(expensive.breakdown.fixedMinor,2500);assert.equal(pricing.readVersion(id,1)?.maxAutoPriceMinor,13500,'original fixed rule history remains immutable');
  const second=gateway.saveStore({name:'Second',expectedRevision:0,sourceConnectionId:'other'});
  assert.equal(settings.read(undefined,second.id).connectionId,'other');
  assert.equal(settings.read(undefined,'legacy-not-imported').store,null);assert.equal(settings.read(undefined,'legacy-not-imported').connections.length,2);
  assert.throws(()=>settings.read('local',second.id),/店铺不属于/);
  const sourceSearch=await post('packaging.search',{query:''});assert.equal(sourceSearch.status,200);assert.equal((await sourceSearch.json()).items[0].id,'source-product');
  const sourceRead=await post('packaging.read',{itemIds:['source-product']});assert.equal(sourceRead.status,200,await sourceRead.clone().text());const packageRow=(await sourceRead.json()).rows[0];assert.equal(packageRow.result.weightKg,.33);
  const savedPackage=await post('packaging.save',{rows:[{target:packageRow.target,values:{weightKg:.45},expectedRevision:0}]});assert.equal(savedPackage.status,200);assert.equal(packaging.readOverride(packageRow.target)?.values.weightKg,.45,'Host forwards maintenance through the real Runtime repository');
  const stalePackage=await post('packaging.save',{rows:[{target:packageRow.target,values:{weightKg:.5},expectedRevision:0}]});assert.notEqual(stalePackage.status,200);assert.equal(packaging.readOverride(packageRow.target)?.values.weightKg,.45);
  const resetPackage=await post('packaging.remove',{rows:[{target:packageRow.target,expectedRevision:1}]});assert.equal(resetPackage.status,200);assert.equal(packaging.readOverride(packageRow.target)?.values.weightKg,undefined);
  const detachedPackage=await host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'businessSettings',connectionId:'local',operation:'packaging.read',input:{itemIds:['source-product']}})}));assert.equal(detachedPackage.status,200,'packaging read follows the existing POST settings envelope without requiring a chat');
  assert.equal((await post('packaging.execute',{itemIds:['source-product']})).status,400,'undeclared operations remain blocked');
  assert.notEqual((await post('packaging.read',{itemIds:['source-product']},'missing')).status,200,'Runtime still checks the selected connection');
  assert.equal(reads,1,'saving and calculating local rules never calls Ozon');
 }finally{host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'business-settings-'));rmSync(directory,{recursive:true,force:true});}
});
