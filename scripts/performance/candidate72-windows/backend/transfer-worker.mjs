import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
const root=resolve(args.root),arm=args.arm,shape=args.shape;
assert.ok(['baseline','candidate'].includes(arm));
const {DataTransfers}=await import(pathToFileURL(join(root,'packages/app-presentation/src/data-transfers.ts')).href);
const {createDataTransferReader:factory}=await import(pathToFileURL(join(root,'packages/component-runtime/src/data-transfer-client.ts')).href);
const sha=value=>createHash('sha256').update(value).digest('hex');
const identity={baseCommit:'4e1cd98082a432e2ca89f606927da29eb26ddb67',readerSha256:sha(readFileSync(join(root,'packages/component-runtime/src/data-transfer-client.ts'))),serverSha256:sha(readFileSync(join(root,'packages/app-presentation/src/data-transfers.ts'))),harnessSha256:sha(readFileSync(new URL(import.meta.url)))};
const texts={inline1k:'中文😀'.repeat(100),inline210k:'中😀国'.repeat(21000),chunk333k:'中😀国'.repeat(33300),chunk2m:'商品𠮷😀'.repeat(150000)};
assert.equal(typeof texts[shape],'string');
const text=texts[shape];
const snapshot=(content,revision,cache)=>({viewId:'v',bindings:[{bindingId:'main',appId:'app',connectionId:'connection',datasetId:'dataset-A',revision,payload:{text:content,cache:{nextRefreshAt:cache}},resources:[{appId:'app',connectionId:'connection',kind:'row',key:'第一条'}],state:'ready',freshness:'fresh'}]});
const data=[snapshot(text,'dataset-1','2026-10-10T00:00:00Z'),snapshot(text,'dataset-2','2026-10-10T01:00:00Z'),snapshot(text+'改','dataset-3','2026-10-10T02:00:00Z')];
const normalizedTraceHash=trace=>{const ids=new Map();return sha(JSON.stringify(trace,(_key,value)=>{if(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(value)){if(!ids.has(value))ids.set(value,'transfer-'+(ids.size+1));return ids.get(value);}return value;}));};
const samples=[],warmups=Number(args.warmup??3),iterations=Number(args.iterations??15),turns=warmups+iterations,cpuStart=process.cpuUsage();
let firstProtocolHash;
for(let turn=0;turn<turns;turn++){
  const server=new DataTransfers(),trace=[];let current=data[0];
  const reader=factory(async(action,params)=>{
    const response=action==='prepare'?server.prepare('owner',current,params.knownRevision,'guard'):server.read('owner',params.id,params.index,'guard');
    trace.push({action,params,response});return response;
  });
  const times=[],cpuTimes=[],hashes=[];
  for(let stage=0;stage<3;stage++){
    current=data[stage];const start=performance.now(),cpuStart=process.cpuUsage();
    const result=await reader({method:stage===0?'getData':'refresh'});
    const elapsedCpu=process.cpuUsage(cpuStart);times.push(performance.now()-start);cpuTimes.push((elapsedCpu.user+elapsedCpu.system)/1000);
    assert.deepEqual(result,data[stage]);const hash=sha(JSON.stringify(result));hashes.push(hash);
  }
  const protocolHash=normalizedTraceHash(trace);
  if(firstProtocolHash)assert.equal(protocolHash,firstProtocolHash);else firstProtocolHash=protocolHash;
  const sample={totalMs:times.reduce((a,b)=>a+b,0),cpuMs:cpuTimes.reduce((a,b)=>a+b,0),initialMs:times[0],unchangedMs:times[1],changedMs:times[2],outputHashes:hashes,protocolHash,prepareCalls:trace.filter(x=>x.action==='prepare').length,chunkReads:trace.filter(x=>x.action==='read').length,inlinePackets:trace.filter(x=>x.action==='prepare'&&x.response.body).length,unchangedPackets:trace.filter(x=>x.action==='prepare'&&x.response.unchanged).length};
  if(turn>=warmups)samples.push(sample);
}
const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
const output={arm,shape,identity,warmup:warmups,iterations,snapshotBytes:Buffer.byteLength(JSON.stringify(data[0])),samples,wallMedian:median(samples.map(s=>s.totalMs)),cpuMedian:median(samples.map(s=>s.cpuMs)),cpuWholeProcessIncludingValidation:process.cpuUsage(cpuStart),rss:process.memoryUsage().rss,node:process.version,versions:process.versions};
writeFileSync(args.output,JSON.stringify(output));console.log(JSON.stringify({arm,shape,wallMedian:output.wallMedian,cpuMedian:output.cpuMedian,output:args.output}));
