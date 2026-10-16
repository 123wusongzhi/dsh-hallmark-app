// Offline application-pricing parity through actual Runtime -> Provider paths.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {performance} from 'node:perf_hooks';
const args=process.argv.slice(2);
if(args[0]==='--compare'){
 const [a,b]=args.slice(1,3).map(path=>JSON.parse(readFileSync(path)));
 assert.deepEqual(a.scenarios,b.scenarios,'Complete Runtime responses, pricing state, SQL tables and fixture reads remain identical');
 assert.equal(a.externalRequests,0);assert.equal(b.externalRequests,0);
 assert.equal(a.counters.snapshotReads-b.counters.snapshotReads,b.counters.procurementCalls,'Only self-contained procurement provenance snapshot reads are removed');
 const result={status:'PASS',scenarios:a.scenarios.map(item=>({name:item.name,responses:item.responses.length})),baselineCounters:a.counters,integrationCounters:b.counters,externalRequests:0};
 if(args[3])writeFileSync(args[3],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}else{
 const root=resolve(args[0]),out=args[1],load=p=>import(pathToFileURL(join(root,p)));
 const RealDate=Date;let now=RealDate.parse('2026-10-10T00:00:00Z'),uuid=0,externalRequests=0;
 globalThis.Date=class extends RealDate{constructor(...values){super(...(values.length?values:[now]));}static now(){return now;}};
 crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`;syncBuiltinESMExports();Object.defineProperty(performance,'now',{value:()=>100,configurable:true});
 globalThis.fetch=async()=>{externalRequests++;throw Error('External I/O is forbidden in this offline fixture');};
 const {RuntimeStore,AppsRuntime}=await load('packages/app-runtime/src/index.ts');
 const {HallmarkStorePort,HallmarkProvider}=await load('packages/app-hallmark/src/index.ts');
 const {businessConnectedClient}=await load('packages/app-hallmark/src/operations-client.ts');
 const {BusinessPricingRepository}=await load('packages/business-pricing/src/index.ts');
 const draft=()=>({currency:'CNY',logisticsSelection:'automatic',defaultPlanId:null,plans:[{id:'low',name:'方案 1',enabled:true,maxPriceExclusiveMinor:13500,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000},{id:'high',name:'方案 2',enabled:true,minPriceMinor:13500,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000}],listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:null,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null});
 const scenarios=[],counters={snapshotReads:0,procurementCalls:0};
 async function scenario(name,work){
  now=RealDate.parse('2026-10-10T00:00:00Z');
  const store=new RuntimeStore(':memory:'),port=new HallmarkStorePort(store,'dynamic'),pricing=new BusinessPricingRepository(port),runtime=new AppsRuntime(store),requests=[],catalogueReads=[],responses=[];
  pricing.save('bill',draft(),0);
  port.put('business_catalog',crypto.createHash('sha256').update(JSON.stringify(['bill','offer'])).digest('hex'),{storeId:'bill',offerId:'offer',productId:100,sources:[{sourceSkuMatched:true,sourceUrl:'https://source.test/item',sourceSpec:'单件',skuCode:'source',productId:'item'}],weight:{source:'ozon_order_actual',grams:50,revision:'actual-1'},profit:{purchaseMinor:2000,packageGrams:999,actualMinor:20000,costMinor:1,profitMinor:19999,actualMargin:.999}});
  const stores=[{id:'bill',name:'Bill',currency:'CNY',sourceConnectionId:'dynamic'}];
  const gateway={listStores:()=>stores,getProducts:async id=>{catalogueReads.push(id);return {status:'ok',raw:{response:{items:[{id:100,offer_id:'offer',sku:200,name:'杯子',price:'999',currency_code:'CNY',statuses:{status:'price_sent',status_name:'Продается',moderate_status:'approved',is_created:true},stocks:{has_stock:true},visibility_details:{has_price:true}}]}}};},request:async(id,input)=>{requests.push({id,input});assert.ok(['/v5/product/info/prices','/v4/product/info/attributes'].includes(input.path),input.path);return {status:'ok',raw:{response:input.path==='/v5/product/info/prices'?{result:{items:[{offer_id:'offer',product_id:100,price:{price:'200',marketing_seller_price:'134.99',currency_code:'CNY'}}]}}:{result:[{offer_id:'offer',id:100,weight:30,weight_unit:'g'}]}}};}};
  const source={getStores:async()=>({status:'ok',raw:stores}),getStoreProducts:async()=>{throw Error('Legacy catalogue must not be used');}};
  const client=businessConnectedClient(source,gateway,port,'dynamic',true,pricing),provider=new HallmarkProvider({store:port,client,pricing,broker:{}});
  runtime.register(provider);runtime.addConnection({appId:'hallmark',connectionId:'dynamic',displayName:'Offline pricing fixture',config:{offline:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'dynamic',enabled:true,boundAt:new Date().toISOString()});
  const get=port.get.bind(port);port.get=(collection,id)=>{if(collection==='snapshots')counters.snapshotReads++;return get(collection,id);};
  const invoke=async(capabilityId,input)=>{
   const id=`${name}-${responses.length}`;if(capabilityId==='hallmark.products.procurement')counters.procurementCalls++;
   const response=await runtime.invoke({protocolVersion:'1.0',invocationId:id,traceId:`trace-${id}`,appId:'hallmark',connectionId:'dynamic',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${id}`},deadlineAt:new Date(Date.now()+120000).toISOString()});responses.push(response);return response;
  };
  const ok=async(capabilityId,input)=>{const response=await invoke(capabilityId,input);assert.equal(response.status,'ok',JSON.stringify(response));return response.data;};
  try{
   await work({pricing,invoke,ok,catalogueReads,requests});
   scenarios.push({name,responses,requests,catalogueReads,pricing:pricing.read('bill'),schema:store.db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY type,name").all(),tables:Object.fromEntries(store.collections.map(table=>[table,store.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]))});
  }finally{await runtime.dispose();store.close();}
 }
 await scenario('revision-and-overlap',async f=>{
  const first=await f.ok('hallmark.profit.compute',{storeId:'bill'}),row=first.products[0];assert.equal(row.referenceProfit.planId,'low');
  const filtered=await f.ok('hallmark.products.filter',{storeId:'bill',minMargin:.5});assert.equal(filtered.payload.products.length,1);
  for(const loadAll of [false,true]){const data=await f.ok('hallmark.products.procurement',{storeId:'bill',loadAll});assert.equal(data.plan.mode,'application');assert.equal(data.plan.settingsRevision,1);assert.equal(data.products[0].referenceProfit.profitMinor,row.referenceProfit.profitMinor);assert.equal(data.products[0].logisticsMatch.selectedPlanId,'low');}
  const changed=draft();changed.plans.push({id:'expensive',name:'重叠贵方案',enabled:true,fixedMinor:2500,logisticsMicrosPerGram:39300,commissionPpm:200000});f.pricing.save('bill',changed,1);
  const reads=f.catalogueReads.length,next=await f.ok('hallmark.profit.compute',{storeId:'bill'});assert.equal(f.catalogueReads.length,reads);assert.equal(next.products[0].referenceProfit.configRevision,2);assert.equal(next.products[0].referenceProfit.planId,'expensive');assert.ok(next.products[0].referenceProfit.profitMinor<row.referenceProfit.profitMinor);
  const stale=await f.invoke('hallmark.products.filter',{resultSetId:filtered.resultSetId});assert.equal(stale.error?.code,'RESULT_SET_PRICING_CHANGED');
  for(const loadAll of [false,true]){const data=await f.ok('hallmark.products.procurement',{storeId:'bill',loadAll});assert.equal(data.plan.settingsRevision,2);assert.equal(data.products[0].logisticsMatch.selectedPlanId,'expensive');assert.equal(data.products[0].referenceProfit.profitMinor,next.products[0].referenceProfit.profitMinor);}
 });
 await scenario('validity-before-source-ttl',async f=>{
  const timed=draft();timed.plans=[{id:'first',name:'当前方案',enabled:true,fixedMinor:316,logisticsMicrosPerGram:39300,commissionPpm:200000,validUntil:'2026-10-10T00:00:01Z'},{id:'next',name:'稍后方案',enabled:true,fixedMinor:1800,logisticsMicrosPerGram:39300,commissionPpm:200000,validFrom:'2026-10-10T00:00:01Z',validUntil:'2026-10-10T00:00:02Z'}];f.pricing.save('bill',timed,1);
  let initialExpiresAt;
  for(const [offset,plan] of [[0,'first'],[1000,'next'],[2000,null]]){
   now=RealDate.parse('2026-10-10T00:00:00Z')+offset;
   for(const loadAll of [false,true]){const data=await f.ok('hallmark.products.procurement',{storeId:'bill',loadAll});assert.equal(data.plan.mode,'application');assert.equal(data.plan.settingsRevision,2);if(plan)assert.equal(data.products[0].logisticsMatch.selectedPlanId,plan);else{assert.notEqual(data.products[0].logisticsMatch.status,'unique');assert.equal(data.products[0].referenceProfit.margin,null);}if(initialExpiresAt===undefined)initialExpiresAt=Date.parse(data.cache.expiresAt);assert.ok(Date.now()<initialExpiresAt,'Plan changes are observed before the original source TTL expires');assert.equal(data.cache.fetchedAt,new Date().toISOString());}
   assert.equal(f.catalogueReads.length,offset/1000+1,'Latest pricing-window invalidation re-reads once per active-plan window');
  }
 });
 assert.equal(externalRequests,0);
 const result={root,mode:'strict-functional-parity',externalRequests,counters,scenarios,sourceHashes:Object.fromEntries(['packages/app-hallmark/src/index.ts','packages/app-hallmark/src/procurement.ts','packages/app-hallmark/src/dynamic-profit.ts','packages/app-hallmark/src/operations-client.ts','packages/business-pricing/src/index.ts'].map(path=>[path,crypto.createHash('sha256').update(readFileSync(join(root,path))).digest('hex')]))};
 if(out)writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,scenarios:scenarios.map(item=>({name:item.name,responses:item.responses.length,fixtureCatalogueReads:item.catalogueReads.length}))}));
}
