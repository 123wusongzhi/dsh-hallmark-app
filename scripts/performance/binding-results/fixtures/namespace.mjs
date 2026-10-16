import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]),{RuntimeStore}=await import(pathToFileURL(join(root,'packages/app-runtime/src/store.ts')).href),{HallmarkStorePort,StableHallmarkBusinessStore}=await import(pathToFileURL(join(root,'packages/app-hallmark/src/store.ts')).href);
const records=[];
for(const size of (process.env.SIZES??'32,5000').split(',').map(Number))for(const adapter of ['legacy','stable'])for(const occupancy of ['all','sparse','none']){
 const store=new RuntimeStore(':memory:'),port=adapter==='legacy'?new HallmarkStorePort(store,'fixture'):new StableHallmarkBusinessStore(store,{connectionId:'fixture',scopeId:'synthetic-scope'}),expected=[];
 try{
  store.transaction(()=>{for(let i=0;i<size;i++){const matches=occupancy==='all'||occupancy==='sparse'&&i%20===0,namespace=matches?'business_target':'business_noise',value={id:String(i).padStart(8,'0'),payload:'Synthetic 商品 value '.repeat(64),nullable:i%2?null:0};port.put(namespace,value.id,value);if(matches)expected.push(value);}});
  const selected=typeof port.listForCollection==='function'?port.listForCollection.bind(port):port.list.bind(port),callDurations=[],cpu={user:0,system:0};
  for(let call=0;call<10;call++){const startCpu=process.cpuUsage(),start=performance.now(),actual=selected('business_target'),elapsed=performance.now()-start,used=process.cpuUsage(startCpu);callDurations.push(elapsed);cpu.user+=used.user;cpu.system+=used.system;assert.deepEqual(actual,expected);}
  records.push({scenario:`${adapter}-${occupancy}`,size,elapsedMs:callDurations.reduce((a,b)=>a+b,0),cpu,calls:10,callDurations,matchingRows:expected.length,totalRows:size,maxRssKB:process.resourceUsage().maxRSS,memory:process.memoryUsage(),oracleSha256:createHash('sha256').update(JSON.stringify(expected)).digest('hex')});
 }finally{store.close();}
}
console.log(JSON.stringify({fixture:'Direct collection listing adapter, in-memory SQLite, synthetic rows. Ten measured calls, no discarded warm-up. Each result checked exactly outside measured wall/CPU.',records},null,2));
