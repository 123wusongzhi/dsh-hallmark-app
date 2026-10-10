/** Executes the actual exported artifact implementation, never a rebuilt test entry. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {configuration,draft,quote,invocation,fixedAt} from './fixture.mjs';
const [entryArg,directoryArg,outArg]=process.argv.slice(2);
if(!entryArg||!directoryArg||!outArg)throw Error('Usage: parity-probe.mjs entry data-dir output.json');
const entry=resolve(entryArg),directory=resolve(directoryArg),out=resolve(outArg);
const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixedAt]));}static now(){return RealDate.parse(fixedAt);}};
let uuid=0;crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`;syncBuiltinESMExports();
let networkAttempts=0;globalThis.fetch=async()=>{networkAttempts++;throw Error('EXTERNAL_NETWORK_FORBIDDEN_IN_PARITY_PROBE');};
const artifact=await import(pathToFileURL(entry));assert.equal(typeof artifact.composeAppsRuntime,'function');
mkdirSync(directory,{recursive:true});
const instance=artifact.composeAppsRuntime(directory,structuredClone(configuration)),results={};
const capture=fn=>{try{return {ok:true,value:fn()};}catch(error){return {ok:false,error:{name:error.name,code:error.code??null,message:error.message,details:error.details??null,issues:error.issues??null}};}};
try{
 await instance.scheduler.stop();await instance.businessPoller.stop();
 for(const [appId,connectionId] of [['notes','n'],['hallmark','h']])instance.runtime.bind({sessionId:'s',appId,connectionId,enabled:true,boundAt:fixedAt});
 const pricing=instance.pricingFor('h');
 results.missingQuote=pricing.quote(quote('missing'));assert.equal(results.missingQuote.issues[0].code,'CONFIG_NOT_FOUND');
 results.validConfig=pricing.save('bill',draft(),0);assert.equal(results.validConfig.revision,1);
 const invalids=[
 ['unknown root',{...draft(),extra:true}],['wrong currency',{...draft(),currency:'RUB'}],
 ['negative fee',{...draft(),plans:[{...draft().plans[0],fixedMinor:-1}]}],
 ['fractional fee',{...draft(),plans:[{...draft().plans[0],fixedMinor:1.5}]}],
 ['unsafe integer',{...draft(),plans:[{...draft().plans[0],fixedMinor:Number.MAX_SAFE_INTEGER+1}]}],
 ['unknown plan key',{...draft(),plans:[{...draft().plans[0],extra:true}]}],
 ['bad timestamp',{...draft(),plans:[{...draft().plans[0],validFrom:'2026-99-99'}]}],
 ['reverse validity',{...draft(),plans:[{...draft().plans[0],validFrom:fixedAt,validUntil:fixedAt}]}],
 ['reverse weights',{...draft(),plans:[{...draft().plans[0],minWeightGrams:2,maxWeightGrams:1}]}],
 ['reverse prices',{...draft(),plans:[{...draft().plans[0],minPriceMinor:13500}]}],
 ['duplicate plans',{...draft(),plans:[draft().plans[0],draft().plans[0]]}],
 ['missing default',{...draft(),defaultPlanId:'absent'}],
 ['excess commission',{...draft(),plans:[{...draft().plans[0],commissionPpm:1000000}]}],
 ['unknown source key',{...draft(),source:{kind:'user',description:'test',extra:true}}],
 ['config bounds',{...draft(),minPriceMinor:200,maxPriceMinor:100}],
 ];
 results.invalidConfigs=invalids.map(([label,value])=>({label,result:capture(()=>pricing.save('invalid',value,0))}));
 for(const row of results.invalidConfigs){assert.equal(row.result.ok,false,row.label);assert.equal(row.result.error.code,'INVALID_PRICING_CONFIG');}
 results.revisionConflict=capture(()=>pricing.save('bill',draft(),0));assert.equal(results.revisionConflict.error.code,'PRICING_REVISION_CONFLICT');
 results.trimmed=pricing.save('trimmed',{...draft(),plans:[{...draft().plans[0],id:' low ',name:'  名称  '}]},0);assert.equal(results.trimmed.plans[0].id,'low');
 const patches=[{priceMinor:13499},{priceMinor:13500},{priceMinor:13501},{action:'listing',pricingMode:'automatic',priceMinor:undefined},{priceMinor:null},{priceMinor:0},{purchaseMinor:-1},{weightGrams:0},{weightGrams:1.5},{purchaseMinor:Number.MAX_SAFE_INTEGER},{pricingMode:'invalid'}];
 results.quotes=patches.map(patch=>({input:quote('bill',patch),result:capture(()=>pricing.quote(quote('bill',patch)))}));
 assert.equal(results.quotes[0].result.value.planId,'low');assert.equal(results.quotes[1].result.value.breakdown.profitMinor,6607);assert.equal(results.quotes[3].result.value.suggestedPriceMinor,20965);
 const overlap=draft(), expensive={...overlap.plans[0],id:'expensive',fixedMinor:2500};delete expensive.maxPriceExclusiveMinor;overlap.plans.push(expensive);
 pricing.save('bill',overlap,1);results.overlap=pricing.quote(quote('bill',{priceMinor:13499}));assert.equal(results.overlap.planId,'expensive');results.savedVersion=pricing.readVersion('bill',1);
 const bounded={...draft(),plans:[{...draft().plans[0],minWeightGrams:100,maxWeightGrams:200,validFrom:fixedAt,validUntil:'2026-10-11T00:00:00Z'}]};delete bounded.plans[0].maxPriceExclusiveMinor;
 pricing.save('bounded',bounded,0);results.boundaries=[99,100,200,201].map(weightGrams=>pricing.quote(quote('bounded',{weightGrams})));results.expiry=pricing.quote(quote('bounded',{at:'2026-10-11T00:00:00Z'}));assert.equal(results.boundaries[1].planId,'low');assert.equal(results.expiry.status,'blocked');
 const packaging=instance.businessSettings.packagingOptions.packagingFor('h');
 results.packagingValid=packaging.saveOverrides([{target:{kind:'sku',itemId:'item',sourceSkuId:'sku'},values:{weightKg:.45,dimensionsCm:{length:25,width:10,height:10}},expectedRevision:0}]);
 results.packagingInvalid=capture(()=>packaging.saveOverrides([{target:{kind:'sku',itemId:'item',sourceSkuId:'sku'},values:{weightKg:-1},expectedRevision:1}]));assert.equal(results.packagingInvalid.ok,false);
 const target={kind:'sku',itemId:'item',sourceSkuId:'sku'};
 const packagingCases=[
  ['unknown value',{target,values:{weightKg:1,extra:true}}],
  ['incomplete dimensions',{target,values:{dimensionsCm:{length:1,width:1}}}],
  ['zero dimension',{target,values:{dimensionsCm:{length:0,width:1,height:1}}}],
  ['excess weight',{target,values:{weightKg:Number.MAX_SAFE_INTEGER}}],
  ['unknown target',{target:{...target,extra:true},values:{weightKg:1}}],
  ['unknown discriminator',{target:{kind:'invalid'},values:{weightKg:1}}],
  ['blank id',{target:{...target,itemId:' '},values:{weightKg:1}}],
  ['empty composition',{target:{kind:'combination',id:'combo',composition:[]},values:{weightKg:1}}],
  ['fractional quantity',{target:{kind:'combination',id:'combo',composition:[{itemId:'item',sourceSkuId:'sku',quantity:1.5}]},values:{weightKg:1}}],
  ['negative revision',{target,values:{weightKg:1},expectedRevision:-1}],
 ];
 results.invalidPackaging=packagingCases.map(([label,input])=>({label,result:capture(()=>packaging.saveOverrides([input]))}));
 for(const row of results.invalidPackaging){assert.equal(row.result.ok,false,row.label);assert.equal(row.result.error.code,'INVALID_PACKAGING');}
 results.packagingConflict=capture(()=>packaging.saveOverrides([{target:{...target,sourceSkuId:'new'},values:{weightKg:1},expectedRevision:0},{target,values:{weightKg:1},expectedRevision:0}]));
 assert.equal(results.packagingConflict.error.code,'PACKAGING_REVISION_CONFLICT');assert.equal(packaging.readRevision({...target,sourceSkuId:'new'}),0,'batch rollback');
 results.packagingResolved=packaging.resolve({members:[{itemId:'item',sourceSkuId:'sku',quantity:2},{itemId:'item',sourceSkuId:'sku',quantity:1}]});
 assert.equal(results.packagingResolved.weightGrams,1350);assert.equal(results.packagingResolved.composition[0].quantity,3);
 const stored=instance.businessGateway.saveStore({name:'Fixture',currency:'CNY',sourceConnectionId:'h',expectedRevision:0});
 pricing.save(stored.id,draft(),0);
 const port=instance.businessStoreFor('h'),local={storeId:stored.id,offerId:'offer',productId:100,sources:[{sourceSkuMatched:true,sourceUrl:'https://example.invalid/item',sourceSpec:'单件',skuCode:'source',productId:'item'}],weight:{source:'ozon_order_actual',grams:50,revision:'actual-1'},profit:{purchaseMinor:2000,packageGrams:999,actualMinor:20000,costMinor:1,profitMinor:19999,actualMargin:.999}};
 port.put('business_catalog',crypto.createHash('sha256').update(JSON.stringify([stored.id,'offer'])).digest('hex'),local);
 const gatewayCalls=[];
 instance.businessGateway.getProducts=async id=>{gatewayCalls.push(['products',id]);return {status:'ok',raw:{response:{items:[{id:100,offer_id:'offer',sku:200,name:'杯子',currency_code:'CNY',statuses:{status_name:'Продается',moderate_status:'approved',is_created:true},stocks:{has_stock:true},visibility_details:{has_price:true}}]}}};};
 instance.businessGateway.request=async(id,input)=>{gatewayCalls.push([input.path,id]);return {status:'ok',raw:{response:input.path==='/v5/product/info/prices'?{result:{items:[{offer_id:'offer',product_id:100,price:{price:'200',marketing_seller_price:'134.99',currency_code:'CNY'}}]}}:{result:[{offer_id:'offer',id:100,weight:30,weight_unit:'g'}]}}};};
 results.profit=await instance.runtime.invoke(invocation('profit','hallmark.profit.compute',{storeId:stored.id}));assert.equal(results.profit.status,'ok',JSON.stringify(results.profit));
 assert.equal(results.profit.data.products[0].profit.actualMinor,13499);assert.equal(results.profit.data.products[0].profit.pricingQuote.planId,'low');assert.equal(results.profit.data.products[0].profit.packageGrams,50);
 results.gatewayCalls=gatewayCalls;
 results.notes=[];
 for(const [id,cap,input,extra] of [
  ['create','create',{id:'note',title:'包装回归',content:'isolated fixture'},{idempotencyKey:'create'}],
  ['read','get',{id:'note'},{}],['list','list',{limit:1},{}],['invalid','list',{limit:0},{}],
  ['update','update',{id:'note',title:'updated'},{idempotencyKey:'update',expectedResourceRevision:'1'}],
  ['stale','update',{id:'note',title:'stale'},{idempotencyKey:'stale',expectedResourceRevision:'1'}],
 ])results.notes.push(await instance.runtime.invoke(invocation(id,`notes.notes.${cap}`,input,extra)));
 assert.deepEqual(results.notes.map(r=>r.status),['ok','ok','ok','failed','ok','failed']);assert.equal(results.notes[3].error.code,'INPUT_SCHEMA_INVALID');assert.equal(results.notes[5].error.code,'REVISION_CONFLICT');
 results.identity=instance.runtime.identity();results.catalog=instance.runtime.discover({limit:200});
 results.schema=instance.store.db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY type,name").all();
 results.tables=Object.fromEntries(instance.store.collections.map(table=>[table,instance.store.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
 results.networkAttempts=networkAttempts;assert.equal(networkAttempts,0);
 writeFileSync(out,JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',artifactExports:Object.keys(artifact),invalidSchemas:invalids.length,quoteCases:results.quotes.length,notesCases:results.notes.length,networkAttempts}));
}finally{await instance.close();}
