import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {DataTransfers} from '../../hallmark-c72-baseline/packages/app-presentation/src/data-transfers.ts';
import {createDataTransferReader as baseline} from '../../hallmark-c72-baseline/packages/component-runtime/src/data-transfer-client.ts';
import {createDataTransferReader as patched} from './patched-data-transfer-client.ts';

const arm=process.argv[2],shape=process.argv[3];
assert.ok(['baseline','patched'].includes(arm));
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceBaseline=readFileSync(new URL('../../hallmark-c72-baseline/packages/component-runtime/src/data-transfer-client.ts',import.meta.url),'utf8');
const sourcePatched=readFileSync(new URL('./patched-data-transfer-client.ts',import.meta.url),'utf8');
const old='return Uint8Array.from(atob(value.chunk),character=>character.charCodeAt(0));';
const replacement='const decoded=atob(value.chunk),chunk=new Uint8Array(decoded.length);\n          for(let index=0;index<decoded.length;index++)chunk[index]=decoded.charCodeAt(index);\n          return chunk;';
assert.equal(sourceBaseline.split(old).length,2);
assert.equal(sourcePatched,sourceBaseline.replace(old,replacement));
const identity={baseCommit:'4e1cd98082a432e2ca89f606927da29eb26ddb67',readerSha256:sha(arm==='baseline'?sourceBaseline:sourcePatched),serverSha256:sha(readFileSync(new URL('../../hallmark-c72-baseline/packages/app-presentation/src/data-transfers.ts',import.meta.url))),harnessSha256:sha(readFileSync(new URL(import.meta.url)))};
const texts={inline1k:'中文😀'.repeat(100),inline210k:'中😀国'.repeat(21000),chunk333k:'中😀国'.repeat(33300),chunk2m:'商品𠮷😀'.repeat(150000)};
assert.equal(typeof texts[shape],'string');
const text=texts[shape],factory=arm==='baseline'?baseline:patched;
const snapshot=(content,revision,cache)=>({viewId:'v',bindings:[{bindingId:'main',appId:'app',connectionId:'connection',datasetId:'dataset-A',revision,payload:{text:content,cache:{nextRefreshAt:cache}},resources:[{appId:'app',connectionId:'connection',kind:'row',key:'第一条'}],state:'ready',freshness:'fresh'}]});
const data=[snapshot(text,'dataset-1','2026-10-10T00:00:00Z'),snapshot(text,'dataset-2','2026-10-10T01:00:00Z'),snapshot(text+'改','dataset-3','2026-10-10T02:00:00Z')];
const normalizedTraceHash=trace=>{const ids=new Map();return sha(JSON.stringify(trace,(_key,value)=>{if(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(value)){if(!ids.has(value))ids.set(value,'transfer-'+(ids.size+1));return ids.get(value);}return value;}));};
const samples=[],warmups=3,turns=18,cpuStart=process.cpuUsage();
let firstProtocolHash;
for(let turn=0;turn<turns;turn++){
  const server=new DataTransfers(),trace=[];let current=data[0];
  const reader=factory(async(action,params)=>{
    const response=action==='prepare'?server.prepare('owner',current,params.knownRevision,'guard'):server.read('owner',params.id,params.index,'guard');
    trace.push({action,params,response});return response;
  });
  const times=[],hashes=[];
  for(let stage=0;stage<3;stage++){
    current=data[stage];const start=performance.now();
    const result=await reader({method:stage===0?'getData':'refresh'});
    times.push(performance.now()-start);
    assert.deepEqual(result,data[stage]);const hash=sha(JSON.stringify(result));hashes.push(hash);
  }
  const protocolHash=normalizedTraceHash(trace);
  if(firstProtocolHash)assert.equal(protocolHash,firstProtocolHash);else firstProtocolHash=protocolHash;
  const sample={totalMs:times.reduce((a,b)=>a+b,0),initialMs:times[0],unchangedMs:times[1],changedMs:times[2],outputHashes:hashes,protocolHash,prepareCalls:trace.filter(x=>x.action==='prepare').length,chunkReads:trace.filter(x=>x.action==='read').length,inlinePackets:trace.filter(x=>x.action==='prepare'&&x.response.body).length,unchangedPackets:trace.filter(x=>x.action==='prepare'&&x.response.unchanged).length};
  if(turn>=warmups)samples.push(sample);
}
console.log(JSON.stringify({arm,shape,identity,snapshotBytes:Buffer.byteLength(JSON.stringify(data[0])),samples,cpuWholeProcessIncludingValidation:process.cpuUsage(cpuStart),rss:process.memoryUsage().rss,node:process.version,versions:process.versions}));
