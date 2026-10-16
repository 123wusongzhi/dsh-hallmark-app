import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]);
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
const {AppsRuntime,RuntimeStore}=await import(pathToFileURL(root+'/packages/app-runtime/src/index.ts').href);
const {HallmarkProvider,HallmarkStorePort,StableHallmarkBusinessStore}=await import(pathToFileURL(root+'/packages/app-hallmark/src/index.ts').href);
const {AppsPresentationService}=await import(pathToFileURL(root+'/packages/app-presentation/src/index.ts').href);
const {createAppsServer}=await import(pathToFileURL(root+'/packages/service/src/apps-server.ts').href);
const {AppsHost,HttpAppsHostTransport}=await import(pathToFileURL(root+'/packages/plugin-apps/src/index.ts').href);
const {CollectionService,normalizeProduct}=await import(pathToFileURL(root+'/packages/collection/src/index.ts').href);
const {collectionListingStates}=await import(pathToFileURL(root+'/packages/app-hallmark/src/listing-prepare.ts').href);
const {businessConnectedClient}=await import(pathToFileURL(root+'/packages/app-hallmark/src/operations-client.ts').href);

const report=[];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
for(const size of (process.env.SIZES??'32,512,2048').split(',').map(Number)) {
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'fixture'),tools=new Map(),agent={id:'owner'};
 const details=Array.from({length:3},(_,p)=>({id:`p${p}`,source:'taobao_tmall',title:`Cup ${p}`,categoryId:'1',categoryPath:['Kitchen','Cup'],package:{weightGrams:100,dimensionsMm:[10,20,30]},description:'Known source evidence',skus:Array.from({length:size},(_,i)=>({sourceSkuId:`sku-${String(i).padStart(6,'0')}`,properties:{color:i%2?'red':'blue'},goodsPrice:12,currency:'CNY'}))}));
 let reads=0;const forbidden=async()=>{throw Error('Unexpected source call');};
 const client={getStores:async()=>({status:'ok',raw:[]}),getStoreProducts:forbidden,syncStoreProducts:forbidden,getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,getCollectedItemDetail:async id=>{reads++;return {status:'ok',raw:details[Number(id.slice(1))]};},platformCall:forbidden,platformRead:forbidden};
 const broker={getStoreTask:forbidden,getListingTask:forbidden,requestId:()=>{throw Error('Unexpected request');}};
 const collection=new CollectionService({client,sourceId:'fixture-source',store:{get:(ns,id)=>port.get(`business_collection_${ns}`,id),put:(ns,id,value)=>port.put(`business_collection_${ns}`,id,value)}});
 const provider=new HallmarkProvider({store:port,collection,client,broker});runtime.register(provider);
 runtime.addConnection({appId:'hallmark',connectionId:'fixture',displayName:'Fixture',config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'fixture',enabled:true,boundAt:new Date().toISOString()});
 const httpRequests=[];let modelBytes=0,requestBytes=0,hostCalls=0;const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token:'fixture-token-research-local-only-0123456789'});server.on('request',req=>httpRequests.push(`${req.method} ${req.url}`));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,transport=new HttpAppsHostTransport(base,'fixture-token-research-local-only-0123456789'),host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}},transport);await host.start();host.attachApp('hallmark');httpRequests.length=0;
 let seq=0;async function call(input){const id=++seq,args={appId:'hallmark',connectionId:'fixture',capabilityId:'hallmark.collection.read',capabilityVersion:'1.0.0',input,invocationId:`call-${size}-${id}`,traceId:`trace-${size}-${id}`},tool=tools.get('apps_invoke'),raw=await tool.execute(args,{agent,signal:new AbortController().signal,callId:`native-${id}`}),rendered=tool.output.render(args,raw).map(x=>x.text).join(''),result=JSON.parse(rendered);assert.ok(Buffer.byteLength(rendered)<=16384);hostCalls++;modelBytes+=Buffer.byteLength(rendered);requestBytes+=Buffer.byteLength(JSON.stringify(args));return result;}
 const normalized=details.map(d=>normalizeProduct(d,'fixture-source'));
 const all=details[0].skus.map(s=>s.sourceSkuId);
 const cases=[['one',[all.at(-1)]],['few',all.filter((_,i)=>i%Math.max(1,Math.floor(size/5))===0)],['half',all.filter((_,i)=>i%2===0)],['all',all],['implicit',undefined],['duplicate',[all[1],all[1],all[0]]],['unknown',['unknown']],['case',[all[1].toUpperCase()]],['empty',[]],['unknown-large',[...all.slice(0,16),'unknown']],['duplicate-large',[...all.slice(0,16).reverse(),all[0]]],['null',null],['batch-half',all.filter((_,i)=>i%2===0)]];
 for(let repeat=0;repeat<Number(process.env.REPEATS??2);repeat++)for(const [label,skuIds] of cases){
  global.gc?.();const memoryBefore=process.memoryUsage();const cpu=process.cpuUsage(),t=performance.now(),r0=reads,results=[],rows=[];let calls=0,peakHeap=memoryBefore.heapUsed;
  let input={selections:(label==='batch-half'?['p0','p1','p2']:['p0']).map(id=>({id,...(skuIds!==undefined?{skuIds}:{})})),maxBytes:14336};const queue=[];
  for(;;){const result=await call(input);calls++;results.push(result.data??result.error);if(result.status!=='ok')break;const item=result.data.items[0];assert.ok(!item.omitted,'Projection omitted');for(const item of result.data.items){
 const product=normalized[Number(item.id.slice(1))];const selected=product.skus.filter(s=>skuIds===undefined||skuIds.includes(s.id));
 assert.equal(item.skus.total,selected.length);
 for(const row of item.skus.rows){const sku=product.skus.find(s=>s.id===row[0]);assert.ok(sku);assert.ok(selected.includes(sku));
 const expected=item.skus.columns.map(c=>c==='id'?sku.id:c==='spec'?sku.spec:c in sku.attributes?sku.attributes[c]:sku[c]);assert.deepEqual(row,expected);
 for(const [key,value] of Object.entries(item.skus.common.attributes))assert.equal(sku.attributes[key],value);
 if(item.skus.common.purchaseCost!==undefined)assert.deepEqual(sku.purchaseCost,item.skus.common.purchaseCost);}
 rows.push(...item.skus.rows.map(row=>[item.id,...row]));if(item.skus.nextCursor)queue.push({selections:[{id:item.id,...(skuIds!==undefined?{skuIds}:{}),cursor:item.skus.nextCursor,revision:item.revision}],maxBytes:14336});}if(result.data.continuation)queue.push(result.data.continuation.input);peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);if(!queue.length)break;input=queue.shift();if(calls>1000)throw Error('Page loop');}
  const elapsedMs=performance.now()-t;const expected=['unknown','unknown-large','case','null'].includes(label)?0:(skuIds?all.filter(id=>skuIds.includes(id)).length:size);assert.equal(rows.length,expected*(label==='batch-half'?3:1),label);assert.equal(new Set(rows.map(r=>r[0]+'/'+r[1])).size,rows.length);
 const expectedIds=expected?Array.from({length:label==='batch-half'?3:1},(_,p)=>all.filter(id=>skuIds===undefined||skuIds.includes(id)).map(id=>[`p${p}`,id])).flat():[];
 for(let p=0;p<(label==='batch-half'?3:1);p++)assert.deepEqual(rows.filter(r=>r[0]===`p${p}`).map(r=>r.slice(0,2)),expectedIds.filter(r=>r[0]===`p${p}`));
 if(size===2048){if(label==='all')assert.equal(calls,52);if(label==='half')assert.equal(calls,26);if(label==='batch-half')assert.equal(calls,76);}report.push({size,label,repeat,ms:elapsedMs,cpu:process.cpuUsage(cpu),maxRssKB:process.resourceUsage().maxRSS,httpRequests:httpRequests.splice(0),modelBytes,requestBytes,calls,sourceReads:reads-r0,rows:rows.length,hash:hash(results),rowHash:hash(rows),error:results[0]?.code,heapDelta:process.memoryUsage().heapUsed-memoryBefore.heapUsed,peakHeapDelta:peakHeap-memoryBefore.heapUsed,rssDelta:process.memoryUsage().rss-memoryBefore.rss});hostCalls=0;modelBytes=0;requestBytes=0;
 }
 await host.dispose();server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.dispose();store.close();
 writeFileSync(process.env.REPORT,JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));
