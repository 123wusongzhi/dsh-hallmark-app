import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Provide a run output directory.');
const read=path=>JSON.parse(readFileSync(path,'utf8')),samples=read(join(root,'samples.json')),manifest=read(join(root,'manifest-before.json')),complete=existsSync(join(root,'complete.json'))?read(join(root,'complete.json')):null;
const interrupted=existsSync(join(root,'interrupted.json'))?read(join(root,'interrupted.json')):null,failed=existsSync(join(root,'failed.json'))?read(join(root,'failed.json')):null;
const comparisonStatus=interrupted?'interrupted_historical':failed?'failed_incomplete':!complete?'incomplete':manifest.mode==='calibrate'?'calibration_only':'completed_formal',completed=!!complete&&!interrupted&&!failed;
const canonical=value=>JSON.stringify(value,(_key,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;};
const records=[],checks=[];
if(manifest.expectedProcesses!==undefined&&samples.length!==manifest.expectedProcesses)checks.push({kind:'process-count',expected:manifest.expectedProcesses,actual:samples.length});
for(const suite of manifest.suites??[])if(!samples.some(sample=>sample.suite===suite))checks.push({kind:'missing-suite',suite});
function categoryOracle(raw){const value=structuredClone(raw),hints=[];for(const [p,part]of value.parts.entries())if(part.kind==='category'&&Array.isArray(part.data?.attributes))for(const [i,attribute]of part.data.attributes.entries())if(Object.hasOwn(attribute,'available')){const expected={capability:'hallmark.categories.read',input:{storeId:value.storeId,mode:'values',...part.data.selection,attributeId:String(attribute.id),limit:100}};if(canonical(attribute.available)!==canonical(expected))throw Error('Unexpected category availability hint');hints.push({path:`/parts/${p}/data/attributes/${i}/available`,value:attribute.available});delete attribute.available;}return {value,hints};}
for(const sample of samples){
 if(sample.exitCode!==0||sample.parseError||sample.timedOut){checks.push({sample:sample.name,kind:'process-failed'});continue;}
 const data=read(sample.dataPath),metrics=existsSync(sample.metricsPath)?read(sample.metricsPath):null;
 let rows=sample.suite==='category'?data.rows:sample.suite.startsWith('literal-')?[data]:Array.isArray(data)?data:data.records;
 for(const row of rows){
  let scenario=row.scenario??row.label??(sample.suite==='category'?canonical(row.control):sample.suite),oracle,hints=[];
  if(sample.suite==='category'){const normalized=categoryOracle(row.oracle);oracle=normalized.value;hints=normalized.hints;}
  else if(sample.suite==='fields')oracle=row.oracle;
  else if(sample.suite.startsWith('literal-'))oracle={inputHash:row.inputHash,answer:row.answer};
  else if(sample.suite==='sku')oracle={rowHash:row.rowHash,error:row.error??null,rows:row.rows};
  else if(sample.suite==='collection')oracle={status:row.status??null,total:row.total??null,ids:row.ids??null,error:row.error??null,data:row.data??null};
  else oracle={oracleSha256:row.oracleSha256};
  const cpuMs=row.cpu?(row.cpu.user+row.cpu.system)/1000:row.hostAndServiceProcessCpuMs??null;
  records.push({sample:sample.name,suite:sample.suite,scenario,size:row.size??null,arm:sample.arm,round:sample.round,wallMs:row.elapsedMs??row.ms??null,cpuMs,calls:row.calls??row.toolCalls??row.hostCalls??null,sourceReads:row.sourceReads??null,categoryFailures:row.failures??null,httpCalls:row.httpRequests?.length??null,requestBytes:row.requestBytes??null,modelBytes:row.modelBytes??row.renderedBytes??null,schemaBytes:data.schemaBytes??null,totalTaskBytes:row.totalTaskBytes??null,maxRssKB:row.maxRssKB??metrics?.maxRssKB??null,processWallMs:sample.processWallMs,processCpuMs:metrics?(metrics.processCpu.user+metrics.processCpu.system)/1000:null,oracleHash:hash(oracle),validatedCategoryHints:hints.length,oracle,rawPath:sample.dataPath});
 }
}
const keys=[...new Set(records.map(r=>canonical([r.suite,r.size,r.scenario])))],summary=[];
for(const key of keys){const [suite,size,scenario]=JSON.parse(key),group=records.filter(r=>canonical([r.suite,r.size,r.scenario])===key),arms={};for(const arm of ['A','B']){const armRows=group.filter(r=>r.arm===arm);arms[arm]={n:armRows.length,samples:armRows.map(r=>r.sample)};for(const metric of ['wallMs','cpuMs','calls','sourceReads','categoryFailures','httpCalls','requestBytes','modelBytes','schemaBytes','totalTaskBytes','maxRssKB','processWallMs','processCpuMs']){const values=armRows.map(r=>r[metric]).filter(v=>typeof v==='number');if(values.length)arms[arm][metric]={median:median(values),min:Math.min(...values),max:Math.max(...values),values};}}
 const oracleHashes=[...new Set(group.map(r=>r.oracleHash))],oracleEqual=oracleHashes.length===1;
 if(!oracleEqual)checks.push({suite,size,scenario,kind:'oracle-difference',samples:group.map(r=>({sample:r.sample,oracleHash:r.oracleHash,rawPath:r.rawPath}))});
 if(manifest.mode==='formal'&&(['A','B'].some(arm=>arms[arm].n!==manifest.rounds)))checks.push({suite,size,scenario,kind:'sample-count',A:arms.A.n,B:arms.B.n,expected:manifest.rounds});
 const pairs=Array.from({length:manifest.rounds},(_,i)=>i+1).map(round=>{const A=group.find(r=>r.round===round&&r.arm==='A'),B=group.find(r=>r.round===round&&r.arm==='B');return {round,order:round%2?'AB':'BA',wallChangePct:A?.wallMs&&B?.wallMs?(B.wallMs/A.wallMs-1)*100:null,cpuChangePct:A?.cpuMs&&B?.cpuMs?(B.cpuMs/A.cpuMs-1)*100:null};});
 summary.push({suite,size,scenario,A:arms.A,B:arms.B,oracleEqual,oracleHashes,validatedAdditiveCategoryHints:group.reduce((n,r)=>n+r.validatedCategoryHints,0),wallChangePct:arms.A.wallMs&&arms.B.wallMs?(arms.B.wallMs.median/arms.A.wallMs.median-1)*100:null,pairs});
}
writeFileSync(join(root,'measurements.json'),JSON.stringify(records.map(({oracle,...r})=>r),null,2));
const result={mode:manifest.mode,comparisonStatus,completed,interrupted,failed,gitIdentities:manifest.gitIdentities??null,gitIdentityCaution:manifest.gitIdentities?null:'Original manifest did not record Git HEAD. Do not infer its commit from the current contents of reused source paths.',processes:samples.length,scenarioObservations:records.length,checks,allOraclesEqual:checks.every(c=>c.kind!=='oracle-difference'),notes:['Interrupted/incomplete runs are historical evidence only, never final current-baseline acceptance.','Calibration is excluded from formal results.','Task timing excludes fixture/setup; process metrics include them.','RSS is cumulative process high-water, not per-scenario isolated memory.','Windows short-task CPU measurements can be quantized to zero/coarse increments; wall time and calls are more interpretable there.','Category comparison separately validates additive dictionary hints and compares every pre-existing field.','No pooled headline across different tasks. All samples and negative controls retained.'],summary};
writeFileSync(join(root,'summary.json'),JSON.stringify(result,null,2));
const lines=['# Windows isolated A/B measurements','',`Status: **${comparisonStatus}**. Mode: ${manifest.mode}; complete: ${completed}; processes: ${samples.length}; observations: ${records.length}; issues requiring review: ${checks.length}.`,...(interrupted?['',`Historical interrupted run: ${interrupted.reason??'See interrupted.json'}`,'**Do not use these partial samples as final latest-baseline gains.**']:[]),'','| Suite | Size | Scenario | A ms | B ms | Change | A/B n | Oracle |','|---|---:|---|---:|---:|---:|---:|---|'];for(const r of summary)lines.push(`| ${r.suite} | ${r.size??''} | ${r.scenario.replaceAll('|','\\|')} | ${r.A.wallMs?.median.toFixed(3)??''} | ${r.B.wallMs?.median.toFixed(3)??''} | ${r.wallChangePct?.toFixed(1)??''}% | ${r.A.n}/${r.B.n} | ${r.oracleEqual?'equal':'REVIEW'} |`);writeFileSync(join(root,'TABLE.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({root,mode:manifest.mode,comparisonStatus,processes:samples.length,observations:records.length,issues:checks.length,complete:completed}));
