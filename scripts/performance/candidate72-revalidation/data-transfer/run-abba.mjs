import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const shapes=['inline210k','chunk333k'],records=[];
const median=values=>{const a=[...values].sort((a,b)=>a-b);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
for(const shape of shapes)for(let cycle=0;cycle<5;cycle++)for(const arm of ['baseline','patched','patched','baseline']){
  const child=spawnSync(process.execPath,['benchmark.mjs',arm,shape],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(child.status,0,child.error?.message??child.stderr);
  const result=JSON.parse(child.stdout),prior=records.find(row=>row.shape===shape);
  if(prior){assert.equal(result.samples[0].protocolHash,prior.samples[0].protocolHash);assert.deepEqual(result.samples[0].outputHashes,prior.samples[0].outputHashes);assert.equal(result.samples[0].chunkReads,prior.samples[0].chunkReads);assert.equal(result.identity.serverSha256,prior.identity.serverSha256);assert.equal(result.identity.harnessSha256,prior.identity.harnessSha256);}
  const sameArm=records.find(row=>row.arm===arm);if(sameArm)assert.deepEqual(result.identity,sameArm.identity);
  records.push({cycle,...result});writeFileSync('timing-raw.json',JSON.stringify(records,null,2));
  console.log(shape,cycle,arm,median(result.samples.map(x=>x.totalMs)).toFixed(4));
}
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const summary=shapes.map(shape=>{
  const rows=records.filter(row=>row.shape===shape),arms=Object.fromEntries(['baseline','patched'].map(arm=>{
    const samples=rows.filter(row=>row.arm===arm);return[arm,{medianMs:median(samples.map(row=>median(row.samples.map(x=>x.totalMs)))),p95Ms:p95(samples.flatMap(row=>row.samples.map(x=>x.totalMs))),stages:Object.fromEntries(['initialMs','unchangedMs','changedMs'].map(stage=>[stage,median(samples.map(row=>median(row.samples.map(x=>x[stage]))))])),rssMedian:median(samples.map(row=>row.rss))}];
  }));
  const pairs=Array.from({length:5},(_,cycle)=>{const a=median(rows.filter(row=>row.cycle===cycle&&row.arm==='baseline').map(row=>median(row.samples.map(x=>x.totalMs)))),b=median(rows.filter(row=>row.cycle===cycle&&row.arm==='patched').map(row=>median(row.samples.map(x=>x.totalMs))));return{cycle,baseline:a,patched:b,reductionPct:100*(1-b/a)};});
  return{shape,snapshotBytes:rows[0].snapshotBytes,arms,reductionPct:100*(1-arms.patched.medianMs/arms.baseline.medianMs),pairs,prepareCallsPerCycle:rows[0].samples[0].prepareCalls,chunkReadsPerCycle:rows[0].samples[0].chunkReads,protocolHash:rows[0].samples[0].protocolHash};
});
writeFileSync('timing-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
