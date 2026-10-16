import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [inputArg,outputArg]=process.argv.slice(2);
if(!inputArg||!outputArg)throw Error('Usage: node analyze-tails.mjs <timing-raw.json> <new-analysis.json>');
const input=resolve(inputArg),output=resolve(outputArg);
if(input===output)throw Error('Analysis must not overwrite input');
const source=readFileSync(input),rows=JSON.parse(source);
assert.ok(Array.isArray(rows)&&rows.length,'Expected original short-run timing-raw.json');
for(const shape of ['business-small','business-medium','collected-48','collected-500'])for(const arm of ['baseline','candidate']){
 const selected=rows.filter(row=>row.shape===shape&&row.arm===arm);
 assert.ok(selected.length,`Missing ${shape}/${arm}; sustained supplements have their own summary`);
 for(const row of selected)assert.ok(shape.startsWith('business-')?row.samples?.length===15&&row.samples.every(sample=>sample.durations?.length===8):row.timing?.samples?.length===18&&row.timing.samples.every(sample=>sample.actions?.length===11),'This analyzer requires original short-run sample counts; do not reuse it for sustained supplements');
}
const median=a=>{a=[...a].sort((x,y)=>x-y);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
const stats=a=>({count:a.length,median:median(a),p90:percentile(a,.90),p95:percentile(a,.95),p99:percentile(a,.99),max:Math.max(...a)});
const percent=(base,candidate)=>base===0?null:100*(candidate/base-1);
const byArm=(rs,fn)=>Object.fromEntries(['baseline','candidate'].map(arm=>[arm,fn(rs.filter(r=>r.arm===arm))]));
const business=['business-small','business-medium'].map(shape=>{
 const rs=rows.filter(r=>r.shape===shape),cpu=r=>(r.cpu.user+r.cpu.system)/1000;
 const arms=byArm(rs,rr=>({processCpuMs:stats(rr.map(cpu)),userCpuMs:stats(rr.map(r=>r.cpu.user/1000)),systemCpuMs:stats(rr.map(r=>r.cpu.system/1000)),coldMountMs:stats(rr.map(r=>r.mountMs)),measuredCycleElapsedMs:stats(rr.flatMap(r=>r.samples.map(s=>s.totalMs))),measuredActionElapsedMs:stats(rr.flatMap(r=>r.samples.flatMap(s=>s.durations)))}));
 const pairs=[...new Set(rs.map(r=>r.cycle))].map(cycle=>{
  const pair=rs.filter(r=>r.cycle===cycle),a=pair.filter(r=>r.arm==='baseline'),b=pair.filter(r=>r.arm==='candidate');
  const baselineCpuMs=median(a.map(cpu)),candidateCpuMs=median(b.map(cpu));
  return{cycle,baselineCpuMs,candidateCpuMs,cpuChangePct:percent(baselineCpuMs,candidateCpuMs),elapsed:byArm(pair,rr=>stats(rr.flatMap(r=>r.samples.map(s=>s.totalMs))))};
 });
 return{shape,arms,pairs,cpuWorseCycles:pairs.filter(p=>p.cpuChangePct>0).length,processes:rs.map(r=>({cycle:r.cycle,position:r.position,arm:r.arm,cpuMs:cpu(r),userCpuMs:r.cpu.user/1000,systemCpuMs:r.cpu.system/1000,measuredElapsedSumMs:r.samples.reduce((n,s)=>n+s.totalMs,0),cycles:stats(r.samples.map(s=>s.totalMs)),coldMountMs:r.mountMs})),boundary:'CPU includes all 18 cycles including 3 warmup cycles; elapsed statistics include 15 post-warmup cycles. No GC/JIT attribution is possible from these counters.'};
});
const collected=['collected-48','collected-500'].map(shape=>{
 const rs=rows.filter(r=>r.shape===shape);
 const selection=r=>r.timing.samples.map(s=>({round:s.round,...s.actions[6]}));
 const extras=a=>({...stats(a),over8ms:a.filter(v=>v>8).length,over16_67ms:a.filter(v=>v>1000/60).length});
 const arms=byArm(rs,rr=>({singleSelectionMs:extras(rr.flatMap(r=>selection(r).map(a=>a.wallMs))),allActionMs:extras(rr.flatMap(r=>r.timing.samples.flatMap(s=>s.actions.map(a=>a.wallMs)))),processCpuMs:stats(rr.map(r=>r.timing.cpuUs/1000)),peaksByMeasuredRound:Array.from({length:18},(_,round)=>({round,over8ms:rr.filter(r=>selection(r)[round].wallMs>8).length,ms:stats(rr.map(r=>selection(r)[round].wallMs))}))}));
 const pairs=[...new Set(rs.map(r=>r.cycle))].map(cycle=>({cycle,arms:byArm(rs.filter(r=>r.cycle===cycle),rr=>({selectionMs:extras(rr.flatMap(r=>selection(r).map(a=>a.wallMs))),allActionMs:extras(rr.flatMap(r=>r.timing.samples.flatMap(s=>s.actions.map(a=>a.wallMs)))),cpuMs:median(rr.map(r=>r.timing.cpuUs/1000))}))}));
 return{shape,arms,pairs,processes:rs.map(r=>({cycle:r.cycle,position:r.position,arm:r.arm,selectionMs:extras(selection(r).map(a=>a.wallMs)),peaks:selection(r).filter(a=>a.wallMs>8),allActions:extras(r.timing.samples.flatMap(s=>s.actions.map(a=>a.wallMs)))})),boundary:'Thresholds are descriptive counters, not browser frame/drop guarantees. Headless event timings include fixture event/effect flush. There are no GC or JIT events in this evidence.'};
});
const analysis={input,sourceSha256:createHash('sha256').update(source).digest('hex'),readOnlyAnalysis:true,business,collected,notes:['All statistics are calculated from the supplied input; no historical performance conclusion is reused.','Short business CPU includes warmup while wall samples exclude it. Small quantized CPU deltas cannot establish steady-state gains or regressions.','Tail thresholds describe this headless harness only. These records do not identify GC or JIT causes; retain all adverse observations when interpreting the data.']};
writeFileSync(output,JSON.stringify(analysis,null,2));
console.log(JSON.stringify({output,sourceSha256:analysis.sourceSha256,business:business.map(r=>({shape:r.shape,cpuWorseCycles:r.cpuWorseCycles,cpuPairs:r.pairs.map(p=>({cycle:p.cycle,cpuChangePct:p.cpuChangePct}))})),collected:collected.map(r=>({shape:r.shape,arms:r.arms})),notes:analysis.notes}));
