import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AppsRuntime, RuntimeStore } from '../packages/app-runtime/src/index.ts';
import { NotesProvider, NOTES_DESCRIPTORS } from '../packages/app-notes/src/index.ts';
import { AppsClient } from '../packages/app-sdk/src/index.ts';
import { ScriptRun } from '../packages/app-runtime/src/runs.ts';
import { projectModelResult, readResultPage } from '../packages/app-runtime/src/projection.ts';
const output=process.argv[2]??'evidence/apps-v1-20261007/P3/TODO-018/benchmark';
const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),notes=new NotesProvider({store});
const extra=Array.from({length:46},(_,index)=>({...NOTES_DESCRIPTORS[0],capabilityId:`notes.catalog.entry_${index}`,title:`Long tail ${index}`,discovery:{defaultVisible:false,keywords:['long-tail']}}));
runtime.register({manifest:notes.manifest,descriptors:[...notes.descriptors,...extra],execute:context=>notes.execute(context),inspect:(id,context)=>notes.inspect(id,context),dispose:()=>notes.dispose()});
const fullCatalog=[...notes.descriptors,...extra];
for(let app=1;app<20;app++){
  const appId=`catalog${String(app).padStart(2,'0')}`;
  const descriptors=Array.from({length:50},(_,index)=>({...NOTES_DESCRIPTORS[0],capabilityId:`${appId}.catalog.entry_${index}`,title:`Long tail ${app}/${index}`,discovery:{defaultVisible:false,keywords:['long-tail']}}));
  fullCatalog.push(...descriptors);runtime.register({manifest:{...notes.manifest,appId,displayName:appId,providerPackage:appId},descriptors,execute:async()=>{throw new Error('Catalog-only fixture must not execute');},dispose:async()=>{}});
}
runtime.addConnection({appId:'notes',connectionId:'benchmark',displayName:'Isolated benchmark',config:{backend:'local-fixture'},configRevision:1,enabled:true});
runtime.bind({sessionId:'benchmark',appId:'notes',connectionId:'benchmark',enabled:true,boundAt:new Date().toISOString()});
const ref={appId:'notes',connectionId:'benchmark'},source={kind:'agent',sessionId:'benchmark',nativeCallId:'benchmark'};
const request=(id,input,key)=>({protocolVersion:'1.0',...ref,invocationId:randomUUID(),traceId:randomUUID(),capabilityId:id,capabilityVersion:'1.0.0',input,source,deadlineAt:new Date(Date.now()+30000).toISOString(),...(key?{idempotencyKey:key}:{})});
await runtime.invoke(request('notes.notes.create',{id:'note',title:'Benchmark',content:'Identical fixture'},'seed'));
const seededAt=new Date().toISOString();store.transaction(()=>{
  for(let index=1;index<10000;index++){
    const id=`row-${String(index).padStart(5,'0')}`;
    store.put('provider_records',JSON.stringify(['notes','benchmark','notes',id]),{appId:'notes',connectionId:'benchmark',namespace:'notes',recordId:id,value:{id,title:`Benchmark row ${index}`,content:'Identical 10000-row fixture',revision:'1',createdAt:seededAt,updatedAt:seededAt}});
  }
});
const client=new AppsClient({identity:async()=>runtime.identity(),describe:async(id,version)=>runtime.describe(id,version),invoke:(req,signal)=>runtime.invoke(req,signal),inspect:(id,signal)=>runtime.inspect(id,signal)},source);
const descriptors=['notes.notes.list','notes.notes.get'].map(id=>runtime.describe(id));
const samples=[];
for(const mode of ['direct_tools','sdk_script','mixed'])for(let iteration=0;iteration<30;iteration++){
  const started=performance.now();let results=[];
  const collect=async(call)=>{const rows=[];let cursor='0',page=0;do{
    const result=await call(`page-${page++}`,descriptors[0],{cursor,limit:200});rows.push(result);if(result.status!=='ok')return rows;cursor=result.data.nextCursor;
  }while(cursor!==null);rows.push(await call('get',descriptors[1],{id:'note'}));return rows;};
  if(mode==='direct_tools')results=await collect((_step,descriptor,input)=>runtime.invoke(request(descriptor.capabilityId,input)));
  else if(mode==='sdk_script'){const run=new ScriptRun(runtime,'benchmark');const report=await run.execute(current=>collect((step,descriptor,input)=>current.call(step,ref,descriptor.capabilityId,input)));results=report.value??[];}
  else{const discovered=runtime.discover({appId:'notes',query:'Notes',limit:4});if(!discovered.items.length)throw new Error('DISCOVERY_EMPTY');results=await collect((_step,descriptor,input)=>client.invoke(ref,descriptor,input));}
  const rows=results.slice(0,-1).flatMap(result=>result.data?.items??[]),aggregate={status:'ok',invocationId:randomUUID(),traceId:randomUUID(),data:rows};
  const projection=projectModelResult(store,aggregate),first=projection.fullResultRef?readResultPage(store,projection.fullResultRef,'0',200):null,last=projection.fullResultRef?readResultPage(store,projection.fullResultRef,'9800',200):null;
  samples.push({mode,iteration,durationMs:performance.now()-started,success:results.length===51&&rows.length===10000&&results.every(result=>result.status==='ok'),calls:results.length,rows:rows.length,pagedHandleVerified:first?.total===10000&&last?.returned===200&&last?.nextCursor===null,modelOutputBytes:Buffer.byteLength(projection.content),maximumResultBytes:Buffer.byteLength(projection.content)});
}
const selectedSchemaBytes=Buffer.byteLength(JSON.stringify(descriptors)),fullCatalogBytes=Buffer.byteLength(JSON.stringify(fullCatalog));
const percentile=(sorted,p)=>sorted[Math.ceil(sorted.length*p)-1];
const summaries=['direct_tools','sdk_script','mixed'].map(mode=>{const rows=samples.filter(row=>row.mode===mode),times=rows.map(row=>row.durationMs).sort((a,b)=>a-b);return {mode,samples:rows.length,successRate:rows.filter(row=>row.success).length/rows.length,p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),selectedSchemaBytes,fullCatalogBytes,maximumResultBytes:Math.max(...rows.map(row=>row.maximumResultBytes))};});
let hostVersion=null;try{hostVersion=JSON.parse(await readFile('evidence/apps-v1-20261007/P0/TODO-002/host-capabilities.json','utf8')).hostVersion;}catch{}
const report={evidenceLevel:'fixture',measuredAt:new Date().toISOString(),environment:{os:platform(),osRelease:release(),node:process.version,dshHostVersion:hostVersion,cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),network:'in-process, no real model or Hallmark business network'},task:'Read all 10000 Notes rows in 50 pages, get the same note, and return a bounded model projection with complete paged handle; no measured business mutations',catalogueApplications:20,catalogueCapabilities:1000,fixtureRows:10000,modelInputMeasurement:'Selected schema UTF-8 bytes; actual model input tokens and model execution were not measured.',selectedSchemaBytes,fullCatalogBytes,summaries,samples,gates:{allSucceeded:samples.every(row=>row.success),modelBudget:samples.every(row=>row.maximumResultBytes<=16384),completeHandle:samples.every(row=>row.pagedHandleVerified),selectedSchemasOnly:selectedSchemaBytes<fullCatalogBytes,noMutationReplay:store.list('operations').length===1}};
await mkdir(output,{recursive:true});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
store.close();console.log(JSON.stringify({output,gates:report.gates,summaries}));
