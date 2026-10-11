import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
const root=resolve(args.root),mode=args.mode??'parity',size=args.size??'medium';
const cases={tiny:{items:8,offers:8,plans:2,rows:4,stores:1},medium:{items:367,offers:600,plans:60,rows:15,stores:2},large:{items:1000,offers:2000,plans:160,rows:30,stores:2}};
const dimensions=cases[size];assert.ok(dimensions);
const RealDate=Date;let current=Date.parse('2026-10-10T12:00:00.000Z');
globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[current]));}static now(){return current;}};
if(mode==='parity')Object.defineProperty(globalThis,'performance',{value:{now:()=>0},configurable:true});
const imp=p=>import(pathToFileURL(join(root,p)).href);
const {AppsRuntime,RuntimeStore}=await imp('packages/app-runtime/src/index.ts');
const {HallmarkProvider}=await imp('packages/app-hallmark/src/index.ts');
const {HallmarkStorePort,StableHallmarkBusinessStore}=await imp('packages/app-hallmark/src/store.ts');
const {collectionListingStates}=await imp('packages/app-hallmark/src/listing-prepare.ts');
const {projectModelResult}=await imp('packages/app-runtime/src/projection.ts');
const dir=mkdtempSync(join(tmpdir(),'collection-audit-')),dbPath=join(dir,'runtime.db');
const database=new RuntimeStore(dbPath),store=new HallmarkStorePort(database,'c'),business=new StableHallmarkBusinessStore(database,{connectionId:'c',scopeId:'source'});
const iso=(ms=0)=>new Date(current+ms).toISOString(),calls=[],events=[],sql=[],methodCalls=[];
const shopIds=Array.from({length:dimensions.stores},(_,i)=>`shop-${i}`);
const shops=shopIds.map(id=>({id,name:`Store ${id}`,platform:'ozon',enabled:true,revision:1,credentialRevision:1,hasCredentials:true,sourceConnectionId:'c',createdAt:iso(),updatedAt:iso()}));
const items=Array.from({length:dimensions.items},(_,i)=>({id:`p-${i}`,title:`Collected product ${i}`,source:'taobao_tmall',categoryPath:['Home','Cups'],skuCount:2,goodsMinPrice:3,goodsMaxPrice:8,currency:'CNY'}));
const saleStates=['on_sale','out_of_stock','pending','archived','failed','not_sellable','unknown'];
const product=(s,j)=>{const item=`p-${j%dimensions.items}`,state=saleStates[j%7];return {storeId:s,storeName:`Store ${s}`,offerId:`offer-${j}`,productId:String(j+1),title:`Sale ${j}`,status:state,saleState:state,observedAt:iso(j%13===0?-301000:0),statusObservation:j%19===0?'missing':'observed',listingHistory:{created:j%3!==0},sources:j%17===0?[]:[{productId:item,sourceSkuMatched:j%11!==0,skuCode:`sku-${j%2}`},...(j%5===0?[{productId:item,sourceSkuMatched:true,skuCode:`sku-${j%2}`},{productId:`p-${(j+1)%dimensions.items}`,sourceSkuMatched:true,components:[{sourceSkuId:'sku-0',quantity:2},{sourceSkuId:'sku-1',quantity:1}]}]:[])]};};
database.transaction(()=>{
 for(const s of shopIds){
  for(let j=0;j<dimensions.offers;j++)business.put('business_catalog',`${s}-${j}`,product(s,j));
  // Duplicate offer has last value and retains first offer position.
  business.put('business_catalog',`${s}-duplicate`,{...product(s,0),title:'last duplicate',sources:[{productId:'p-0',sourceSkuMatched:true,skuCode:'sku-1'}]});
  business.put('business_catalog_status_sync',s,{storeId:s,state:'fresh',observedAt:iso(),attemptedAt:iso(),expiresAt:iso(300000),total:dimensions.offers,missing:0});
 }
 for(let i=0;i<dimensions.plans;i++)business.put('business_plans',`plan-${i}`,{planId:`plan-${i}`,storeId:shopIds[i%shopIds.length],rows:Array.from({length:dimensions.rows},(_,j)=>({rowId:`r-${j}`,action:j%7===0?'price':'listing',procurement:[{itemId:`p-${(i*dimensions.rows+j)%dimensions.items}`,sourceSkuId:'sku-0',quantity:1},{itemId:`p-${(i*dimensions.rows+j)%dimensions.items}`,sourceSkuId:'sku-1',quantity:1},{itemId:`p-${(i+j+1)%dimensions.items}`,sourceSkuId:'sku-0',quantity:1}]}))});
});
const ok=raw=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',fetchedAt:iso()}});
const client={getStores:async()=>{calls.push(['getStores']);return ok(shops);},getStoreProducts:async()=>{calls.push(['getStoreProducts']);return ok({stores:shops,products:[]});},syncStoreProducts:async()=>ok({}),getTargetMargin:async()=>ok({}),searchCollectedItems:async q=>{calls.push(['searchCollectedItems',q]);return ok(items);},getCollectedItem:async()=>{throw Error('unexpected raw read');},getCollectedItemDetail:async id=>{calls.push(['getCollectedItemDetail',id]);return ok({id,source:'taobao_tmall',title:`Detail ${id}`,currency:'CNY',skus:[{sourceSkuId:'sku-0',spec:'red',goodsPrice:3},{sourceSkuId:'sku-1',spec:'blue',goodsPrice:4}]});},platformCall:async()=>{throw Error('unexpected business write');},platformRead:async()=>{throw Error('unexpected platform read');}};
let failRefresh=false;
const gateway={listStores:()=>shops,getStore:id=>shops.find(s=>s.id===id),hasStore:id=>shopIds.includes(id),getProducts:async id=>{calls.push(['getProducts',id]);return failRefresh?{status:'failed',error:{code:'FIXTURE_DOWN',message:'fixture unavailable',retryable:true}}:ok({response:{items:[]}});},request:async()=>{throw Error('unexpected gateway request');}};
const broker={getStoreTask:async()=>{throw Error('unexpected task');},getListingTask:async()=>{throw Error('unexpected task');},requestId:()=>''};
const provider=new HallmarkProvider({store,client,broker,businessStore:business,businessGateway:gateway});
const runtime=new AppsRuntime(database,{log:event=>events.push(event)});runtime.register(provider);
runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'Fixture',config:{backend:'fixture'},configRevision:1,enabled:true});
runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:iso()});
let sequence=0;
const invoke=(input={},capabilityId='hallmark.collection.search')=>runtime.invoke({protocolVersion:'1.0',invocationId:`invoke-${++sequence}`,traceId:`trace-${sequence}`,appId:'hallmark',connectionId:'c',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${sequence}`},deadlineAt:iso(60000)});
function trace(){
 for(const method of ['get','put','list','query','delete','collectionVersion']){const original=database[method].bind(database);database[method]=(...args)=>{methodCalls.push([method,...structuredClone(args)]);return original(...args);};}
 const prepare=database.db.prepare.bind(database.db);database.db.prepare=statement=>{const prepared=prepare(statement);return new Proxy(prepared,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;return (...params)=>{sql.push([statement,key,...params]);return value.apply(target,params);};}});};
 const exec=database.db.exec.bind(database.db);database.db.exec=statement=>{sql.push([statement,'exec']);return exec(statement);};
}
const allRows=()=>Object.fromEntries(database.collections.map(table=>[table,database.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
try{
 if(mode==='parity'){
  trace();const responses=[],projections=[];
  for(const input of [{limit:10},{limit:10,store:{id:'shop-0',listingRecord:'found'}},{limit:10,store:{id:'shop-0',listingRecord:'not_found'}},{limit:10,store:{id:'shop-0',saleState:'archived'}},{limit:10,source:'missing'},{limit:10,query:'red'}]){const result=await invoke(input);assert.equal(result.status,'ok',JSON.stringify(result));responses.push(result);projections.push(projectModelResult(database,result));}
  const first=responses[0].data;
  if(first.nextCursor)responses.push(await invoke({limit:10,cursor:first.nextCursor}));
  // Updates after one request must be visible to the next request.
  business.put('business_plans','new-plan',{planId:'new-plan',storeId:'shop-0',rows:[{action:'listing',procurement:[{itemId:'p-0',sourceSkuId:'sku-0',quantity:1},{itemId:'p-0',sourceSkuId:'sku-1',quantity:1}]}]});
  responses.push(await invoke({limit:10}));
  if(first.nextCursor)responses.push(await invoke({limit:10,cursor:first.nextCursor}));
  current+=300001;failRefresh=true;
  responses.push(await invoke({limit:10,store:{id:'shop-0',listingRecord:'not_found'}}));
  current+=1;failRefresh=false;
  responses.push(await invoke({refresh:true,limit:10}));
  // Duplicate summaries must retain first-match behavior; duplicate item/store IDs preserve output ordering.
  business.put('business_catalog','edge',{storeId:'shop-0',offerId:'edge',productId:'99999',status:'on_sale',saleState:'on_sale',observedAt:iso(),sources:[{productId:'edge-item',sourceSkuMatched:true,components:[{sourceSkuId:'a',quantity:1},{sourceSkuId:'b',quantity:1}]}]});
  business.put('business_plans','edge-plan',{planId:'edge-plan',storeId:'shop-0',rows:[{action:'listing',procurement:[{itemId:'edge-item',sourceSkuId:'a',quantity:1},{itemId:'edge-item',sourceSkuId:'b',quantity:1}]},{action:'price',procurement:[{itemId:'edge-item',sourceSkuId:'a',quantity:1}]}]});
  const direct=collectionListingStates(business,[...shopIds,shopIds[0]],['edge-item','p-1','edge-item'],[{id:'edge-item',skuCount:2,skuIds:['a','b']},{id:'edge-item',skuCount:1,skuIds:['b']}]);
  assert.equal(direct['edge-item'][0].status,'listed');assert.equal(direct['edge-item'][0].savedListingCount,1);assert.equal(direct['edge-item'].length,shopIds.length+1);
  // Commit through a different SQLite connection after the first status get.
  // Subsequent reads in the same synchronous Runtime request must remain observable.
  const external=new DatabaseSync(dbPath),get=business.get.bind(business);let syncReads=0,externalCommits=0;
  business.get=(collection,id)=>{const value=get(collection,id);if(collection==='business_catalog_status_sync'&&id==='shop-0'&&++syncReads===1){
   const recordId=JSON.stringify(['hallmark-business','c','source',collection,id]);
   const row=external.prepare('SELECT value_json FROM provider_records WHERE id=?').get(recordId),record=JSON.parse(row.value_json);
   record.value={...record.value,state:'failed',attemptedAt:iso(),expiresAt:iso()};
   external.prepare('UPDATE provider_records SET value_json=? WHERE id=?').run(JSON.stringify(record),recordId);externalCommits++;
  }return value;};
  items.push({id:'external-unlinked',title:'External observation boundary',source:'taobao_tmall',skuCount:1});
  const externallyChanged=await invoke({limit:10,store:{id:'shop-0',listingRecord:'unavailable'}});assert.equal(externallyChanged.status,'ok');
  assert.equal(externallyChanged.data.items.find(row=>row.id==='external-unlinked')?.listedIn.find(row=>row.storeId==='shop-0')?.listingRecordReason,'RECORD_SYNC_FAILED');
  responses.push(externallyChanged);assert.equal(externalCommits,1);business.get=get;external.close();
  const malformed=[];
  business.put('business_catalog','malformed',{storeId:'shop-0',offerId:'malformed',sources:'invalid'});
  malformed.push(await invoke({limit:10}));assert.equal(malformed.at(-1).status,'failed');
  business.put('business_catalog','malformed',{storeId:'shop-0',offerId:'malformed',sources:[]});
  business.put('business_plans','malformed',{storeId:'shop-0',rows:{invalid:true}});
  malformed.push(await invoke({limit:10}));assert.equal(malformed.at(-1).status,'failed');
  const noStores=collectionListingStates(business,[],['p-0']);
  business.put('business_plans','malformed',{storeId:'shop-0',rows:[]});
  try{collectionListingStates(business,shopIds,['p-0'],[null]);assert.fail('malformed summary should fail');}catch(error){malformed.push({name:error.name,message:error.message});}
  const empty=collectionListingStates(business,shopIds,[],[]);
  const traces={sql:structuredClone(sql),methodCalls:structuredClone(methodCalls)};
  const output={dimensions,responses,projections,direct,empty,noStores,malformed,events,calls,traces,database:allRows()};
  writeFileSync(args.output,JSON.stringify(output));
  console.log(JSON.stringify({mode,size,responses:responses.length,sql:traces.sql.length,methodCalls:traces.methodCalls.length,events:events.length,calls:calls.length,output:args.output}));
 }else{
  const iterations=Number(args.iterations??12),warmup=Number(args.warmup??5);
  for(let i=0;i<warmup;i++){const result=await invoke({limit:30});assert.equal(result.status,'ok');}
  const wall=[],cpu=[],digests=[];for(let i=0;i<iterations;i++){const start=process.hrtime.bigint(),usage=process.cpuUsage();const result=await invoke({limit:30});const elapsed=process.cpuUsage(usage);wall.push(Number(process.hrtime.bigint()-start)/1e6);cpu.push((elapsed.user+elapsed.system)/1000);assert.equal(result.status,'ok');digests.push(createHash('sha256').update(JSON.stringify(result.data)).digest('hex'));}
  assert.equal(new Set(digests).size,1);const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
  const output={mode,size,dimensions,iterations,warmup,wall,cpu,wallMedian:median(wall),cpuMedian:median(cpu),dataDigest:digests[0],calls,events:events.length,memory:process.memoryUsage(),maxRss:process.resourceUsage().maxRSS};
  writeFileSync(args.output,JSON.stringify(output));console.log(JSON.stringify({size,wallMedian:output.wallMedian,cpuMedian:output.cpuMedian,output:args.output}));
 }
}finally{await runtime.dispose();database.close();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('collection-audit-'));rmSync(dir,{recursive:true,force:true});}
