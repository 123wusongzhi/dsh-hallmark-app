import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {cpus,platform,release} from 'node:os';
const [baseArg,candidateArg,outputArg,roundsArg='5']=process.argv.slice(2);
if(!baseArg||!candidateArg||!outputArg)throw new Error('Usage: node run-reader-abba.mjs BASE CANDIDATE OUTPUT [ROUNDS]');
const baseline=resolve(baseArg),candidate=resolve(candidateArg),output=resolve(outputArg),rounds=Number(roundsArg);
assert.ok(Number.isSafeInteger(rounds)&&rounds>0&&rounds<=20);
mkdirSync(output,{recursive:false});
const bench=join(import.meta.dirname,'reader/bench-result-reader.mjs');
const shapes=[['small','mixed'],['moderate','mixed'],['172000','ascii'],['40000','mixed'],['80000','emoji']];
const rows=[];
const median=values=>{const a=[...values].sort((a,b)=>a-b);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
for(let round=1;round<=rounds;round++)for(const [size,pattern] of shapes){
  for(const [order,variant] of ['baseline','candidate','candidate','baseline'].entries()){
    const label=`${size}-${pattern}-r${round}-${order}-${variant}`;
    const args=['--expose-gc',bench,variant==='baseline'?baseline:candidate,size,pattern];
    const child=spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:10*1024*1024,env:{...process.env,BENCH_VARIANT:variant,BENCH_ROUND:String(round),BENCH_ORDER:String(order)}});
    writeFileSync(join(output,label+'.stdout.log'),child.stdout??'');writeFileSync(join(output,label+'.stderr.log'),child.stderr??'');
    if(child.status!==0)throw new Error(`${label}: ${child.error?.message??child.stderr}`);
    const result=JSON.parse(child.stdout.trim().split('\n').at(-1));
    rows.push({...result,round,order,variant,size,pattern});
    writeFileSync(join(output,'observations.json'),JSON.stringify(rows,null,2));
  }
  console.log(`completed reader ${size}/${pattern} round ${round}/${rounds}`);
}
const summary=shapes.map(([size,pattern])=>{
  const group=rows.filter(row=>row.size===size&&row.pattern===pattern);
  for(const key of ['inputHash','outputHash','pages','bytes'])assert.equal(new Set(group.map(row=>row[key])).size,1,`${size}/${pattern} ${key} differs`);
  const before=group.filter(row=>row.variant==='baseline'),after=group.filter(row=>row.variant==='candidate');
  const metrics=Object.fromEntries(['elapsedMs','cpuMs','maxRssKb'].map(key=>{const a=median(before.map(row=>row[key])),b=median(after.map(row=>row[key]));return[key,{baseline:a,candidate:b,ratio:a>0?b/a:null,reductionPct:a>0?(1-b/a)*100:null,...(a===0?{comparison:'unavailable: timing resolution is insufficient'}:{})}];}));
  const roundRatios=Array.from({length:rounds},(_,i)=>median(after.filter(row=>row.round===i+1).map(row=>row.elapsedMs))/median(before.filter(row=>row.round===i+1).map(row=>row.elapsedMs)));
  return{size,pattern,observationsPerVariant:before.length,inputBytes:group[0].inputBytes,pages:group[0].pages,bytes:group[0].bytes,metrics,roundRatios};
});
const report={node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,baseline,candidate,rounds,scope:'First complete read per independent process after Host setup; includes Host/HTTP/JSON/render hashing/assertions. No read-chain warmup. Synthetic original data, no business network. RSS is process-wide.',summary};
writeFileSync(join(output,'timing-summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
