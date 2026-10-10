// Candidate70 listing-record contracts through the real offline Runtime and Provider.
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
 assert.deepEqual(a.responses,b.responses,'All complete collection and preparation responses');
 assert.deepEqual(a.tables,b.tables,'All persisted Runtime and business records');
 assert.deepEqual(a.schema,b.schema,'Current tables and expression indexes');
 assert.deepEqual(a.calls,b.calls,'Identical offline source and gateway calls');
 assert.equal(a.externalRequests,0);assert.equal(b.externalRequests,0);
 const result={status:'PASS',responsesCompared:a.responses.length,contracts:['failed first import','recovery','found','not_found','unavailable','pagination','saved draft preparation','refresh failure'],allTablesExactlyEqual:true,externalRequests:0};
 if(args[3])writeFileSync(args[3],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}else{
 const root=resolve(args[0]),out=args[1],load=path=>import(pathToFileURL(join(root,path))),RealDate=Date;
 const now=RealDate.parse('2026-10-10T00:00:00Z');let uuid=0,externalRequests=0;
 globalThis.Date=class extends RealDate{constructor(...values){super(...(values.length?values:[now]));}static now(){return now;}};
 crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`;syncBuiltinESMExports();Object.defineProperty(performance,'now',{value:()=>100,configurable:true});
 globalThis.fetch=async()=>{externalRequests++;throw Error('External I/O forbidden');};
 const {RuntimeStore,AppsRuntime}=await load('packages/app-runtime/src/index.ts');
 const {HallmarkStorePort,HallmarkProvider}=await load('packages/app-hallmark/src/index.ts');
 const {BusinessPricingRepository,dynamicReferenceDraft}=await load('packages/business-pricing/src/index.ts');
 const store=new RuntimeStore(':memory:'),port=new HallmarkStorePort(store,'source'),runtime=new AppsRuntime(store),pricing=new BusinessPricingRepository(port),responses=[],calls=[];
 pricing.save('bill',dynamicReferenceDraft(),0);
 const ids=['absent-a','absent-b','archived','failed','draft-only'],details=new Map(ids.map(id=>[id,{id,source:'taobao_tmall',title:`合成资料 ${id}`,currency:'CNY',attributes:{材料:'陶瓷'},package:{weightKg:.33,dimensionsCm:{length:25,width:10,height:10}},skus:[{sourceSkuId:'sku-0',spec:'蓝色',goodsPrice:3.43,price:4,currency:'CNY'}]}]));
 let historyDown=true,gatewayDown=false;
 const ok=raw=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',fetchedAt:new Date().toISOString()}});
 const source={getStores:async()=>ok([{id:'bill'}]),getStoreProducts:async()=>{calls.push('legacy-products');return historyDown?{status:'unavailable',error:{code:'OFFLINE_FIXTURE_DOWN',message:'Synthetic history unavailable',retryable:true}}:ok({products:[]});},searchCollectedItems:async()=>{calls.push('collection-search');return ok([...details.values()].map(({id,title,source,skus})=>({id,title,source,skuCount:skus.length})));},getCollectedItemDetail:async id=>{calls.push(`collection-detail:${id}`);return ok(details.get(id));},getCategoryData:async input=>{calls.push(`category:${input.mode}`);return ok({items:[],total:0});}};
 const native=[{id:101,offer_id:'archived-offer',sku:1001,is_archived:true,statuses:{is_created:true,moderate_status:'approved'},stocks:{has_stock:false}},{id:102,offer_id:'failed-offer',sku:1002,statuses:{is_created:false,status_name:'Отклонен'},stocks:{has_stock:false}},{id:103,offer_id:'unmapped-offer',sku:1003,statuses:{is_created:true,moderate_status:'approved',status_name:'Продается'},stocks:{has_stock:true}}];
 const entry={id:'bill',name:'Bill',sourceConnectionId:'source',legacyStoreId:'legacy-bill'};
 const gateway={listStores:()=>[entry],getStore:id=>id==='bill'?entry:undefined,getProducts:async id=>{calls.push(`gateway-products:${id}`);return gatewayDown?{status:'unavailable',error:{code:'OFFLINE_FIXTURE_DOWN',message:'Synthetic gateway unavailable',retryable:true}}:ok({response:{items:native}});},request:async(id,input)=>{calls.push({gateway:id,input});assert.equal(input.path,'/v1/description-category/tree');return ok({response:{result:[]}});}};
 for(const [id,offer,productId] of [['archived','archived-offer','101'],['failed','failed-offer','102']])port.put('business_catalog',id,{storeId:'bill',offerId:offer,productId,sources:[{productId:id,sourceSkuMatched:true,skuCode:'sku-0'}]});
 port.put('business_plans','saved-draft',{planId:'saved-draft',storeId:'bill',rows:[{action:'listing',status:'draft',procurement:[{itemId:'draft-only',sourceSkuId:'sku-0',quantity:1}]}]});
 const provider=new HallmarkProvider({store:port,client:source,broker:{},businessGateway:gateway,pricing});runtime.register(provider);
 runtime.addConnection({appId:'hallmark',connectionId:'source',displayName:'Offline listing fixture',config:{offline:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'source',enabled:true,boundAt:new Date().toISOString()});
 const invoke=async(capabilityId,input)=>{const id=`listing-${responses.length}`,response=await runtime.invoke({protocolVersion:'1.0',invocationId:id,traceId:`trace-${id}`,appId:'hallmark',connectionId:'source',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${id}`},deadlineAt:new Date(Date.now()+120000).toISOString()});responses.push(response);assert.equal(response.status,'ok',JSON.stringify(response));return response.data;};
 try{
  const search=(listingRecord,extra={})=>invoke('hallmark.collection.search',{store:{id:'bill',listingRecord},...extra});
  const unavailable=await search('not_found');assert.equal(unavailable.total,null);assert.equal(unavailable.recordLookup.status,'partial');assert.equal(unavailable.recordLookup.unavailableItems,2);assert.equal(port.get('business_catalog_status_sync','bill').error.code,'LISTING_HISTORY_READ_FAILED');
  historyDown=false;
  const first=await search('not_found',{limit:1});assert.equal(first.total,2);assert.equal(first.recordLookup.status,'complete');assert.equal(first.items[0].listedIn[0].listingRecord,'not_found');assert.ok(first.nextCursor);
  const second=await search('not_found',{limit:1,cursor:first.nextCursor});assert.equal(second.total,2);assert.notEqual(first.items[0].id,second.items[0].id);assert.equal(second.items[0].listedIn[0].listingRecord,'not_found');
  const found=await search('found');assert.deepEqual(found.items.map(item=>item.id).sort(),['archived','draft-only','failed']);assert.equal(found.items.find(item=>item.id==='draft-only').listedIn[0].savedListingCount,1);
  const prepared=await invoke('hallmark.listing.prepare',{storeId:'bill',selections:[{id:'draft-only'},{id:'absent-a'}]});assert.equal(prepared.completeness,'complete');const listing=new Map(prepared.listingRecords.map(row=>[row.itemId,row]));assert.equal(listing.get('draft-only').listingRecord,'found');assert.equal(listing.get('draft-only').savedListingCount,1);assert.equal(listing.get('draft-only').available.capability,'hallmark.plan.list');assert.equal(listing.get('absent-a').listingRecord,'not_found');assert.ok(prepared.sales.every(row=>row.existingLinks.length===0));
  const unknownStore=await invoke('hallmark.collection.search',{store:{id:'not-configured',listingRecord:'not_found'}});assert.equal(unknownStore.total,null);assert.equal(unknownStore.recordLookup.status,'unavailable');
  gatewayDown=true;const failed=await search('not_found',{refresh:true});assert.equal(failed.total,null);assert.equal(failed.recordLookup.unavailableItems,2);assert.equal(failed.returned,0);
  const retained=await search('found');assert.equal(retained.total,null);assert.deepEqual(retained.items.map(item=>item.id).sort(),['archived','draft-only','failed']);
  const result={root,mode:'strict-functional-parity',responses,calls,externalRequests,schema:store.db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY type,name").all(),tables:Object.fromEntries(store.collections.map(table=>[table,store.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()])),sourceHashes:Object.fromEntries(['packages/app-hallmark/src/index.ts','packages/app-hallmark/src/collection-provider.ts','packages/app-hallmark/src/listing-prepare.ts','packages/collection/src/index.ts'].map(path=>[path,crypto.createHash('sha256').update(readFileSync(join(root,path))).digest('hex')]))};
  assert.equal(externalRequests,0);if(out)writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:'PASS',responses:responses.length,calls,externalRequests}));
 }finally{await runtime.dispose();store.close();}
}
