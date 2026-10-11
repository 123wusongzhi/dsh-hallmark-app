import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const at=value.indexOf('=');assert.ok(at>0,'Use --key=value');return[value.slice(0,at).replace(/^--/,''),value.slice(at+1)];}));
for(const key of ['baseline','candidate','output'])assert.ok(args[key],`Missing --${key}`);
const roots={baseline:resolve(args.baseline),candidate:resolve(args.candidate)},output=resolve(args.output),here=dirname(fileURLToPath(import.meta.url));
const mode=args.mode??'parity',rounds=Number(args.rounds??5),iterations=Number(args.iterations??15),warmup=Number(args.warmup??5);
assert.ok(['parity','timing'].includes(mode));
for(const [name,value]of Object.entries({rounds,iterations,warmup}))assert.ok(Number.isSafeInteger(value)&&value>0,`Invalid ${name}`);
const collectionSizes=(args['collection-sizes']??'tiny,medium').split(',').filter(Boolean),transferShapes=(args['transfer-shapes']??'inline1k,chunk333k,chunk2m').split(',').filter(Boolean);
mkdirSync(output,{recursive:true});
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const median=values=>{const ordered=values.toSorted((a,b)=>a-b),middle=Math.floor(ordered.length/2);return ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;};
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
function run(worker,parameters,name){
 const destination=join(output,name+'.json');
 const command=[join(here,worker),...Object.entries({...parameters,output:destination}).map(([k,v])=>`${k}=${v}`)];
 const child=spawnSync(process.execPath,command,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
 writeFileSync(join(output,name+'.log'),(child.stdout??'')+(child.stderr??''));
 assert.equal(child.status,0,`${name} failed: ${child.error?.message??child.stderr}`);
 return JSON.parse(readFileSync(destination,'utf8'));
}
const identity={mode,node:process.version,execPath:process.execPath,platform:process.platform,roots,rounds,iterations,warmup,startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(roots).map(([arm,root])=>[arm,Object.fromEntries(['packages/app-hallmark/src/listing-prepare.ts','packages/component-runtime/src/data-transfer-client.ts','packages/app-presentation/src/data-transfers.ts'].map(path=>[path,hash(readFileSync(join(root,path),'utf8'))]))]))};
if(mode==='parity'){
 const collection=[];
 for(const size of collectionSizes){
  const baseline=run('collection-worker.mjs',{root:roots.baseline,mode:'parity',size},`collection-${size}-baseline`);
  const candidate=run('collection-worker.mjs',{root:roots.candidate,mode:'parity',size},`collection-${size}-candidate`);
  assert.deepEqual(candidate,baseline,`Collection ${size}: full response/projection/SQL/database parity`);
  collection.push({size,equal:true,responses:baseline.responses.length,sql:baseline.traces.sql.length,storeCalls:baseline.traces.methodCalls.length,sha256:hash(baseline)});
 }
 const transfer=run('transfer-parity.mjs',roots,'transfer-parity');
 const result={identity,collection,transfer,equal:true};writeFileSync(join(output,'parity-summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({equal:true,collection,transferRecords:transfer.records.length,output}));
}else{
 const summaries=[];
 for(const [kind,scenarios]of [['collection',collectionSizes],['transfer',transferShapes]])for(const scenario of scenarios){
  const rows=[],cycles=[];
  for(let round=1;round<=rounds;round++){
   const cycle=[];
   for(const [slot,arm]of ['baseline','candidate','candidate','baseline'].entries()){
    const row=run(kind==='collection'?'collection-worker.mjs':'transfer-worker.mjs',{root:roots[arm],arm,mode:'timing',...(kind==='collection'?{size:scenario}:{shape:scenario}),iterations,warmup},`${kind}-${scenario}-r${round}-s${slot+1}-${arm}`);
    row.arm=arm;row.round=round;row.slot=slot+1;rows.push(row);cycle.push(row);
   }
   const digest=row=>kind==='collection'?row.dataDigest:hash(row.samples[0].outputHashes);
   assert.equal(new Set(cycle.map(digest)).size,1,`${kind}/${scenario}: output changed`);
   if(kind==='transfer')assert.equal(new Set(cycle.map(row=>row.samples[0].protocolHash)).size,1,`${scenario}: protocol changed`);
   const ratios=Object.fromEntries(['wallMedian','cpuMedian'].map(key=>{const base=mean(cycle.filter(row=>row.arm==='baseline').map(row=>row[key]));return[key,base?mean(cycle.filter(row=>row.arm==='candidate').map(row=>row[key]))/base:null];}));
   cycles.push({round,...ratios});console.log(JSON.stringify({kind,scenario,round,ratios}));
  }
  const summarize=arm=>Object.fromEntries(['wallMedian','cpuMedian'].map(key=>[key,median(rows.filter(row=>row.arm===arm).map(row=>row[key]))]));
  summaries.push({kind,scenario,processes:rows.length,baseline:summarize('baseline'),candidate:summarize('candidate'),pairedMedianRatio:Object.fromEntries(['wallMedian','cpuMedian'].map(key=>[key,cycles.every(row=>row[key]!==null)?median(cycles.map(row=>row[key])):null])),cycles});
  writeFileSync(join(output,'timing-summary.json'),JSON.stringify({identity,summaries},null,2));
 }
 console.log(JSON.stringify({summaries,output}));
}
