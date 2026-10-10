import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {performance} from 'node:perf_hooks';
const [rootArg,grain='product',size='267',legacySize='1000',noiseSize='100',mode='parity',out]=process.argv.slice(2);
const root=resolve(rootArg),n=Number(size),legacyRows=Number(legacySize),noiseRows=Number(noiseSize),isParity=mode==='parity';
const RealDate=Date;let clock=Date.parse('2026-10-10T00:00:00Z'),uuid=0;
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
if(isParity){crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`;syncBuiltinESMExports();Object.defineProperty(performance,'now',{value:()=>100,configurable:true});}
const load=p=>import(pathToFileURL(join(root,p)));
const {RuntimeStore,AppsRuntime}=await load('packages/app-runtime/src/index.ts');
const {HallmarkProvider,HallmarkStorePort}=await load('packages/app-hallmark/src/index.ts');
const {AppsPresentationService}=await load('packages/app-presentation/src/index.ts');
const {AppsSnapshotScheduler}=await load('packages/service/src/apps-scheduler.ts');
const {readOzonComposition}=await load('packages/app-hallmark/src/ozon-compose.ts');
const {OZON_COMPOSITION_SOURCE_FIELDS}=await load('packages/app-hallmark/src/ozon-composition.ts');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const dir=mkdtempSync(join(tmpdir(),'six-coupled-')),store=new RuntimeStore(join(dir,'apps.db')),port=new HallmarkStorePort(store,'fixture'),runtime=new AppsRuntime(store);
const sqliteVersion=store.db.prepare('select sqlite_version() AS version').get().version;
let upstream=0,providerCalls=0,snapshotReads=0,archiveWrites=0,schedulerRefreshes=0;
const client=new Proxy({},{get:(_t,key)=>{if(key==='then')return undefined;return async()=>{upstream++;throw Object.assign(Error('Synthetic upstream outage:'+String(key)),{code:'UPSTREAM_UNAVAILABLE',retryable:true,retryAfterMs:60000});};}});
const provider=new HallmarkProvider({store:port,client,broker:client}),execute=provider.execute.bind(provider);provider.execute=c=>{providerCalls++;return execute(c);};runtime.register(provider);
runtime.addConnection({appId:'hallmark',connectionId:'fixture',displayName:'Offline fixture',config:{offline:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'fixture',enabled:true,boundAt:new Date().toISOString()});
let scheduler;const presentation=new AppsPresentationService({store,runtime,scheduledBinding:b=>scheduler.requireSchedule(b.refresh.scheduleId,b)});
scheduler=new AppsSnapshotScheduler({store,describe:id=>runtime.describe(id),isConnectionEnabled:()=>true,now:()=>new Date(),intervalMs:600000,refresh:(binding,source)=>{schedulerRefreshes++;return presentation.refreshBinding(binding,source);}});
const sources={products:[],stocks:[],orders:[],finance:[],returns:[]},norm=(kind,row)=>({...Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS[kind].map(k=>[k,null])),...row});
for(let i=1;i<=n;i++){
 const productId=String(i),sku=String(i+10000),postingNumber=`posting-${i}`;
 sources.products.push(norm('products',{productId,sku,title:`合成商品 ${i}`,offerId:`offer-${i}`}));
 sources.orders.push(norm('orders',{postingNumber,sku,quantity:1,orderPrice:i%1000,currency:'RUB',createdAt:'2026-09-01T00:00:00Z'}));
 sources.stocks.push(norm('stocks',{productId,sku:null,warehouseId:'1',warehouseName:'ID first',stockAvailable:2}),norm('stocks',{productId:null,sku,warehouseId:'2',warehouseName:'SKU second',stockAvailable:3}),norm('stocks',{productId,sku,warehouseId:'3',warehouseName:'both last',stockAvailable:5}));
 sources.finance.push(norm('finance',{postingNumber,accrualId:`a-${i}`,amount:-(i%10),currency:'RUB'}));
 sources.returns.push(norm('returns',{postingNumber,returnId:`r-${i}`,sku,quantity:1,status:'returned',createdAt:'2026-09-02T00:00:00Z',orderPrice:i%900,currency:'RUB'}));
}
const input={storeId:'synthetic',dateFrom:'2026-09-01',dateTo:'2026-09-02',recipe:{version:1,grain,fields:grain==='product'?['products.title','stocks.stockAvailable','stocks.warehouseName','orders.quantity','returns.status']:['products.title','orders.quantity','finance.amount','returns.status','stocks.stockAvailable']},limit:100};
let seedCalls=0;const reader=async(kind,args)=>{seedCalls++;const rows=sources[kind],offset=Number(args.cursor??0),end=offset+100;return {status:'ok',data:{items:rows.slice(offset,end),...(end<rows.length?{cursor:String(end)}:{}),warnings:[],dataTime:'2026-09-02T00:00:00Z'}};};
try{
 const seeded=await readOzonComposition(input,port,client,undefined,reader);assert.equal(seeded.status,'ok',JSON.stringify(seeded));
 if(legacyRows)port.put('snapshots','store_products:synthetic',{state:'failed',lastSuccessAt:'2026-09-01T00:00:00Z',payload:{products:Array.from({length:legacyRows},(_,i)=>({productId:String(i),title:'旧快照'.repeat(200),price:100,currency:'RUB'}))}});
 store.transaction(()=>{for(let i=0;i<noiseRows;i++)port.put('queries',`unrelated-${i}`,{payload:{items:Array.from({length:16},(_,j)=>({id:j,title:'缓存项'.repeat(50)}))},version:1});});
 const originalGet=port.get.bind(port),originalPut=port.put.bind(port);port.get=(collection,id)=>{if(collection==='snapshots')snapshotReads++;return originalGet(collection,id);};port.put=(collection,id,value)=>{if(collection==='ozon_composition_source_results')archiveWrites++;return originalPut(collection,id,value);};
 scheduler.start();await scheduler.idle();
 const binding={bindingId:'scheduled-compose',appId:'hallmark',connectionId:'fixture',capabilityId:'hallmark.ozon.compose',capabilityMajor:1,input,projection:[],refresh:{mode:'scheduled',scheduleId:'compose-plan'}};
 scheduler.create({scheduleId:'compose-plan',binding,timeZone:'UTC',times:Array.from({length:14},(_,i)=>`00:${String(i+1).padStart(2,'0')}`),enabled:true});
 const turns=[],samples=[],snapshots=[],logs=[];let cpuStart,memoryBefore,contentDigest;
 const edgeMode=process.env.SIX_EDGE_MODE==='1';let edgeResult,tableSnapshotOverride;
 const request=i=>({protocolVersion:'1.0',invocationId:`direct-${i}`,traceId:`trace-${i}`,appId:'hallmark',connectionId:'fixture',capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:`native-${i}`},deadlineAt:new Date(Date.now()+120000).toISOString()});
 for(let i=0;i<10;i++){
  clock=RealDate.parse('2026-10-10T00:00:00Z')+(i+1)*60000;
  if(i===2){globalThis.gc?.();cpuStart=process.cpuUsage();memoryBefore=process.memoryUsage();}
  const before={snapshotReads,archiveWrites,providerCalls,schedulerRefreshes},start=performance.now();
  const response=await runtime.invoke(request(i));await scheduler.tick(new Date());
  const elapsed=performance.now()-start;assert.equal(response.status,'ok',JSON.stringify(response));assert.equal(response.data.total,n);assert.equal(response.provenance[0].freshness,'fresh');
  const plan=scheduler.get('compose-plan');assert.equal(plan.lastResult.state,'ready');assert.equal(plan.executionState,'settled');
  const digest=hash({items:response.data.items,warnings:response.data.warnings,sourceStates:response.data.sourceStates,fieldMeta:response.data.fieldMeta,total:response.data.total,provenance:response.provenance});if(contentDigest===undefined)contentDigest=digest;else assert.equal(digest,contentDigest);assert.equal(response.data.items.length,Math.min(100,n));for(const item of response.data.items)assert.equal(item.stocks.stockAvailable,10);
  turns.push({response,plan});if(i>=2)samples.push(elapsed);logs.push(Object.fromEntries(Object.entries(before).map(([key,value])=>[key,({snapshotReads,archiveWrites,providerCalls,schedulerRefreshes})[key]-value])));
 }
 assert.equal(upstream,0);assert.equal(providerCalls,20);assert.equal(schedulerRefreshes,10);
 const resources={cpuMicros:process.cpuUsage(cpuStart),memoryBefore,memoryAfter:process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS};
 if(edgeMode){
  assert.ok(isParity,'edge mode is functional only');
  const archived=store.list('provider_records').find(r=>r.namespace==='ozon_composition_source_results'&&r.value.rows[0]?.title?.startsWith('合成商品'));
  assert.ok(archived);const originalArchive=structuredClone(archived.value),changed=structuredClone(originalArchive);changed.rows[0].title='divergent archive';
  port.put(archived.namespace,archived.recordId,changed);const repaired=await runtime.invoke(request('repair'));assert.equal(repaired.status,'ok');assert.deepEqual(port.get(archived.namespace,archived.recordId),originalArchive);
  const id=JSON.stringify(['hallmark','fixture',archived.namespace,archived.recordId]);store.delete('provider_records',id);
  const missing=await runtime.invoke(request('missing'));assert.equal(missing.status,'ok');assert.deepEqual(port.get(archived.namespace,archived.recordId),originalArchive);
  const failed=await runtime.invoke({...request('forced-failure'),input:{...input,forceRefresh:true}});assert.equal(failed.status,'ok',JSON.stringify(failed));assert.equal(failed.data.cache.stale,true);assert.equal(failed.provenance[0].freshness,'stale');
  await scheduler.stop();await runtime.dispose();store.close();
  const reopened=new RuntimeStore(join(dir,'apps.db')),nextPort=new HallmarkStorePort(reopened,'fixture'),nextRuntime=new AppsRuntime(reopened),nextProvider=new HallmarkProvider({store:nextPort,client,broker:client});nextRuntime.register(nextProvider);
  try{
   const beforeUpstream=upstream,restart=await nextRuntime.invoke(request('restart'));assert.equal(restart.status,'ok',JSON.stringify(restart));assert.equal(restart.data.cache.stale,true);assert.equal(restart.provenance[0].freshness,'stale');assert.equal(upstream,beforeUpstream);
   const nextScheduler=new AppsSnapshotScheduler({store:reopened,describe:id=>nextRuntime.describe(id),isConnectionEnabled:()=>true,refresh:async()=>{throw Error('must not dispatch');}});
   edgeResult={repaired,missing,failed,restart,plans:nextScheduler.list(),upstreamAttempts:upstream,restartUpstreamAttempts:upstream-beforeUpstream};
   tableSnapshotOverride=Object.fromEntries(reopened.collections.map(table=>[table,reopened.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  }finally{await nextRuntime.dispose();reopened.close();}
 }
 const tableSnapshot=tableSnapshotOverride??(isParity?Object.fromEntries(store.collections.map(table=>[table,store.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()])):undefined);
 const result={root,mode,resources,contentDigest,...(edgeResult?{edgeResult}:{}),grain,n,legacyRows,noiseRows,seedCalls,upstream,providerCalls,schedulerRefreshes,snapshotReads,archiveWrites,samplesMs:samples,node:process.version,sqlite:sqliteVersion,turnCounters:logs,sourceHashes:Object.fromEntries(['packages/app-runtime/src/store.ts','packages/service/src/apps-scheduler.ts','packages/app-hallmark/src/index.ts','packages/app-hallmark/src/ozon-compose.ts'].map(p=>[p,crypto.createHash('sha256').update(readFileSync(join(root,p))).digest('hex')])),...(isParity?{turns,tableSnapshot,strictDigest:hash({turns,tableSnapshot,edgeResult})}:{})};
 if(out)writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,turns:undefined,tableSnapshot:undefined,edgeResult:edgeResult?{upstreamAttempts:edgeResult.upstreamAttempts,restartUpstreamAttempts:edgeResult.restartUpstreamAttempts}:undefined}));
}finally{await scheduler.stop();await runtime.dispose();store.close();rmSync(dir,{recursive:true,force:true});}
