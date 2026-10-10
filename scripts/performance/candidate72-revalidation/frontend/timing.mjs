import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('build-manifest.json','utf8'));
for(const entry of manifest){if(createHash('sha256').update(readFileSync(entry.outfile)).digest('hex')!==entry.sha256)throw Error('Bundle hash mismatch '+entry.arm);}
const shapes=[{name:'ten-small',rows:10,attributes:0},{name:'ten-listing',rows:10,attributes:20}];
const records=[];
for(const shape of shapes)for(let cycle=0;cycle<5;cycle++)for(const arm of ['baseline','lazy','lazy','baseline']){
 const run=spawnSync(process.execPath,[`${arm}.mjs`,String(shape.rows),String(shape.attributes),'timing'],{encoding:'utf8',env:{...process.env,TZ:'Asia/Shanghai'},timeout:120000,maxBuffer:4*1024*1024});
 if(run.status!==0)throw Error(run.error?.message??run.stderr);
 const result=JSON.parse(run.stdout);if(result.bundleSha256!==manifest.find(x=>x.arm===arm).sha256)throw Error('Child bundle mismatch');const existing=records.find(r=>r.shape===shape.name);if(existing&&(result.initialTreeHash!==existing.initialTreeHash||result.finalTreeHash!==existing.finalTreeHash||JSON.stringify(result.requests)!==JSON.stringify(existing.requests)||JSON.stringify(result.initialRequests)!==JSON.stringify(existing.initialRequests)))throw Error('Measured output parity mismatch '+shape.name+' '+arm);records.push({shape:shape.name,cycle,arm,...result});writeFileSync('timing-raw.json',JSON.stringify(records,null,2));
 console.log(shape.name,cycle,arm,result.samples.map(x=>x.totalMs).sort((a,b)=>a-b)[7].toFixed(3));
}
const median=a=>{a=[...a].sort((x,y)=>x-y);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
const p95=a=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*.95)-1];
const summaries=shapes.map(shape=>{
 const each=records.filter(r=>r.shape===shape.name).map(r=>({...r,median:median(r.samples.map(s=>s.totalMs))}));
 const arms=Object.fromEntries(['baseline','lazy'].map(arm=>{const rs=each.filter(r=>r.arm===arm);return[arm,{median:median(rs.map(r=>r.median)),p95:p95(rs.flatMap(r=>r.samples.map(s=>s.totalMs))),mountMedian:median(rs.map(r=>r.mountMs)),cpuUserMedian:median(rs.map(r=>r.cpu.user)),cpuSystemMedian:median(rs.map(r=>r.cpu.system)),rssMedian:median(rs.map(r=>r.rss)),actionMedians:Array.from({length:8},(_,i)=>median(rs.flatMap(r=>r.samples.map(s=>s.durations[i]))))}]}));
 const pairs=Array.from({length:5},(_,cycle)=>{const a=median(each.filter(r=>r.cycle===cycle&&r.arm==='baseline').map(r=>r.median)),b=median(each.filter(r=>r.cycle===cycle&&r.arm==='lazy').map(r=>r.median));return{cycle,baseline:a,lazy:b,reductionPct:100*(1-b/a)}});
 return{...shape,payloadBytes:each[0].payloadBytes,textChars:each[0].textChars,arms,reductionPct:100*(1-arms.lazy.median/arms.baseline.median),pairs};
});
writeFileSync('timing-summary.json',JSON.stringify(summaries,null,2));console.log(JSON.stringify(summaries,null,2));
