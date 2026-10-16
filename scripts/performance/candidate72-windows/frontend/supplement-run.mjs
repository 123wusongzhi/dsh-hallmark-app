import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';

const [mode,baseArg,candidateArg,outArg,cyclesArg='5']=process.argv.slice(2);
assert.ok(['build','functional','smoke','timing'].includes(mode),'mode: build | functional | smoke | timing');
assert.ok(baseArg&&candidateArg&&outArg,'arguments: mode baseline candidate output [ABBA cycles=5]');
const baseline=resolve(baseArg),candidate=resolve(candidateArg),output=resolve(outArg),here=dirname(fileURLToPath(import.meta.url));
const cycles=Number(cyclesArg);assert.ok(Number.isInteger(cycles)&&cycles>0);
mkdirSync(output,{recursive:true});
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=(file,value)=>writeFileSync(join(output,file),JSON.stringify(value,null,2));
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const componentPath='component-workspace/collected-products/src/Component.tsx';
const productPath='component-workspace/collected-products/src/lib/products.ts';
const businessPath='packages/plugin-apps/client/business-operations.tsx';
const manifestPath=join(output,'build-manifest.json');
const configSource=readFileSync(join(here,'supplement-config.json')),supplementConfig=JSON.parse(configSource),configSha256=digest(configSource);
const harnessSnapshots=['business','collected'].map(kind=>{const file=join(here,kind+'-supplement-harness.tsx'),contents=readFileSync(file,'utf8');return{kind,file,sha256:digest(contents),contents};});
const environment={node:process.version,execPath:process.execPath,platform:process.platform,arch:process.arch,versions:process.versions,TZ:'Asia/Shanghai'};
const replaceOnce=(source,from,to)=>{assert.equal(source.split(from).length,2,from);return source.replace(from,to);};
function stableOnly(source){
 source=replaceOnce(source,"type ColumnDef}","type ColumnDef,type CellContext}");
 source=replaceOnce(source,'const PAGE_SIZE=20;',`function ProductCell({row}:CellContext<Product,unknown>){return <div className="product-cell"><ProductImage product={row.original}/><ProductName product={row.original}/></div>;}
function PriceCell({row}:CellContext<Product,unknown>){return <span className={row.original.price===undefined?'missing-value':'product-price'}>{displayPrice(row.original)}</span>;}
function DateCell({row}:CellContext<Product,unknown>){return <time title={\u0060\u0024{row.original.timeLabel} · \u0024{row.original.collectedAt??'未提供'}\u0060} dateTime={row.original.collectedAt}>{displayDate(row.original.collectedAt)}<span className="time-kind">{row.original.collectedAt?row.original.timeLabel:''}</span></time>;}
const PAGE_SIZE=20;`);
 source=replaceOnce(source,'cell:({row})=><div className="product-cell"><ProductImage product={row.original}/><ProductName product={row.original}/></div>','cell:ProductCell');
 source=replaceOnce(source,"cell:({row})=><span className={row.original.price===undefined?'missing-value':'product-price'}>{displayPrice(row.original)}</span>",'cell:PriceCell');
 source=replaceOnce(source,"cell:({row})=><time title={`${row.original.timeLabel} · ${row.original.collectedAt??'未提供'}`} dateTime={row.original.collectedAt}>{displayDate(row.original.collectedAt)}<span className=\"time-kind\">{row.original.collectedAt?row.original.timeLabel:''}</span></time>",'cell:DateCell');
 return source;
}

if(mode==='build'){
 const {build}=await import(pathToFileURL(join(baseline,'node_modules/esbuild/lib/main.js')).href);
 const builds=[];
 for(const [arm,root] of [['baseline',baseline],['candidate',candidate]])for(const kind of ['business','collected']){
  if(arm==='stable'&&kind==='business')continue;
  const file=join(root,kind==='business'?businessPath:componentPath),harness=join(here,kind+'-supplement-harness.tsx');
  const identity={arm,root,configSha256,baseCommit:'4e1cd98082a432e2ca89f606927da29eb26ddb67',sourceSha256:digest(readFileSync(file))};
  let source=readFileSync(harness,'utf8');
  if(kind==='business'){
   source=replaceOnce(source,"'BUSINESS_COMPONENT'",JSON.stringify(file.replaceAll('\\','/')));
   source=replaceOnce(source,'BUNDLE_IDENTITY',JSON.stringify(identity));
  }
  const outfile=join(output,`${kind}-${arm}.mjs`);
  const result=await build({stdin:{contents:source,sourcefile:kind+'-harness.tsx',resolveDir:root,loader:'tsx'},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',metafile:true,
   define:{'SUPPLEMENT_CONFIG':JSON.stringify(supplementConfig),'process.env.NODE_ENV':'"production"','INSTRUMENTED':'false','EXPECT_STABLE_IMAGES':String(arm==='stable')},
   alias:{react:join(baseline,'node_modules/react'),'react-test-renderer':join(baseline,'node_modules/react-test-renderer'),PROFILE_COMPONENT:join(root,componentPath)},
   banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},
   plugins:arm==='stable'?[{name:'isolated-stable-cells',setup(b){b.onLoad({filter:/[\\/]collected-products[\\/]src[\\/]Component\.tsx$/},()=>({contents:stableOnly(readFileSync(file,'utf8')),loader:'tsx'}));}}]:[]});
  const sources=Object.keys(result.metafile.inputs).map(path=>({path,sha256:digest(path==='<define:SUPPLEMENT_CONFIG>'?JSON.stringify(supplementConfig):path.endsWith(kind+'-harness.tsx')?source:readFileSync(resolve(path)))}));
  builds.push({kind,arm,root,outfile,bundleSha256:digest(readFileSync(outfile)),harnessSha256:digest(readFileSync(harness)),sourceIdentity:identity,sources,
   ...(arm==='stable'?{bundledComponent:stableOnly(readFileSync(file,'utf8')),bundledComponentSha256:digest(stableOnly(readFileSync(file,'utf8'))),variant:'pure72 plus stable cell identity only; old formatter calls unchanged'}:{}),
   productionSources:[kind==='business'?businessPath:componentPath,...(kind==='collected'?[productPath]:[])].map(path=>({path,sha256:digest(readFileSync(join(root,path)))}))});
 }
 json('build-manifest.json',{environment,supplementConfig,configSha256,harnessSnapshots,builds});console.log(JSON.stringify({mode,output,builds:builds.map(({kind,arm,bundleSha256})=>({kind,arm,bundleSha256}))}));process.exit(0);
}
assert.ok(existsSync(manifestPath),'Run build first');
const manifest=read(manifestPath);
assert.equal(manifest.configSha256,configSha256,'supplement config unchanged since build');
for(const snapshot of harnessSnapshots)assert.equal(manifest.harnessSnapshots.find(x=>x.kind===snapshot.kind).sha256,snapshot.sha256,'supplement harness unchanged since build');
for(const item of manifest.builds){
 assert.equal(digest(readFileSync(item.outfile)),item.bundleSha256,'bundle unchanged');
 for(const source of item.productionSources)assert.equal(digest(readFileSync(join(item.root,source.path))),source.sha256,'production source unchanged since build');
}
function run(kind,arm,args,label){
 const entry=manifest.builds.find(x=>x.kind===kind&&x.arm===arm),prefix=join(output,label);
 assert.ok(!existsSync(prefix+'.json')&&!existsSync(prefix+'.stdout.log'),'Result label already exists; use a fresh output directory to avoid stale measurements');
 const child=spawnSync(process.execPath,[entry.outfile,...args,prefix],{cwd:candidate,encoding:'utf8',env:{...process.env,TZ:'Asia/Shanghai'},timeout:180000,maxBuffer:24*1024*1024});
 writeFileSync(prefix+'.stdout.log',child.stdout??'');writeFileSync(prefix+'.stderr.log',child.stderr??'');
 assert.equal(child.status,0,child.error?.message??child.stderr);
 let result;
 if(existsSync(prefix+'.json'))result=read(prefix+'.json');else{result=JSON.parse(child.stdout.trim());writeFileSync(prefix+'.json',JSON.stringify(result,null,2));}
 if(result.bundleSha256)assert.equal(result.bundleSha256,entry.bundleSha256);
 return{kind,arm,label,...result};
}
function compareFrames(a,b){
 const left=gunzipSync(readFileSync(join(output,a+'.frames.json.gz'))),right=gunzipSync(readFileSync(join(output,b+'.frames.json.gz')));
 assert.deepEqual(JSON.parse(left),JSON.parse(right),'Complete output/interaction frames match');
 return{baseline:a,candidate:b,bytes:left.length,sha256:digest(left),fullFramesEqual:true};
}
if(mode==='functional'){
 const comparisons=[],images=[];
 for(const attributes of [20]){
  const labels=['baseline','candidate'].map(arm=>`business-${attributes}-${arm}-parity`);
  const results=['baseline','candidate'].map((arm,i)=>run('business',arm,['10',String(attributes),'parity'],labels[i]));
  comparisons.push({...compareFrames(...labels),kind:'business',attributes,frameCount:results[0].frameCount,counts:results.map(r=>({arm:r.arm,...r.counts}))});
 }
 for(const size of [500]){
  const labels=['baseline','candidate'].map(arm=>`collected-${size}-${arm}-oracle`);
  for(const [i,arm]of ['baseline','candidate'].entries())run('collected',arm,[String(size),'oracle'],labels[i]);
  comparisons.push({...compareFrames(labels[0],labels[1]),kind:'collected-output-parity',size});
  const imageResults=['baseline','candidate'].map(arm=>run('collected',arm,[String(size),'image'],`collected-${size}-${arm}-image`));
  assert.equal(imageResults[0].imageFailure.imageReappearsAfterSelection,true,'baseline reproduces image-state defect');
  assert.deepEqual(imageResults[1].imageFailure,imageResults[0].imageFailure,'candidate retains legacy image behavior exactly');
  images.push({size,results:imageResults.map(r=>({arm:r.arm,...r.imageFailure}))});
 }
 const tests=['test/plugin-apps/business-content-lazy.test.ts'];
 const tested=spawnSync(process.execPath,['--test','--test-concurrency=1',...tests],{cwd:candidate,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 writeFileSync(join(output,'regression-tests.tap'),tested.stdout??'');writeFileSync(join(output,'regression-tests.stderr.log'),tested.stderr??'');
 assert.equal(tested.status,0,tested.error?.message??tested.stderr??tested.stdout);
 const summary={mode,environment,comparisons,images,regression:{files:tests,exitCode:tested.status},note:'Headless React output/interaction verification; no browser, network or deployment claim.'};
 json('functional-summary.json',summary);console.log(JSON.stringify(summary));process.exit(0);
}
const records=[];
const shapes=[{kind:'business',name:'business-medium',args:['10','20',mode==='smoke'?'smoke':'timing']},{kind:'collected',name:'collected-500',args:['500',mode==='smoke'?'smoke':'timing']}];
const controlFor=shape=>'baseline';
for(const shape of shapes)for(let cycle=0;cycle<(mode==='smoke'?1:cycles);cycle++)for(const [position,arm]of (mode==='smoke'?[controlFor(shape),'candidate']:[controlFor(shape),'candidate','candidate',controlFor(shape)]).entries()){
 const result=run(shape.kind,arm,shape.args,`${mode}-${shape.name}-${cycle}-${position}-${arm}`);
 const other=records.find(r=>r.shape===shape.name);
 if(other){
  for(const key of ['initialHostFrame','warmHostFrame','finalHostFrame'])assert.deepEqual(result[key],other[key],key+' complete frame parity');
  if(shape.kind==='business')for(const key of ['initialTreeHash','finalTreeHash','initialRequests','requests'])assert.deepEqual(result[key],other[key],key);
  else{assert.deepEqual(result.final,other.final);assert.deepEqual(result.bridge,other.bridge);assert.equal(result.fixture.sha256,other.fixture.sha256);assert.equal(result.trace[0].frameHash,other.trace[0].frameHash);}
 }
 records.push({shape:shape.name,cycle,position,...result});json(mode+'-raw.json',records);
 console.log(JSON.stringify({shape:shape.name,cycle,position,arm,completed:true}));
}
const median=values=>{const v=[...values].sort((a,b)=>a-b);return(v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const measure=r=>r.kind==='business'?{cycles:r.samples.map(s=>s.totalMs),actions:r.samples.flatMap(s=>s.durations),cpuUs:r.cpu.user+r.cpu.system}: {cycles:r.timing.samples.map(s=>s.actions.reduce((n,a)=>n+a.wallMs,0)),actions:r.timing.samples.flatMap(s=>s.actions.map(a=>a.wallMs)),cpuUs:r.timing.cpuUs};
const summaries=shapes.map(shape=>{
 const rows=records.filter(r=>r.shape===shape.name);
 const control=controlFor(shape);
 const arms=Object.fromEntries([control,'candidate'].map(arm=>{const rs=rows.filter(r=>r.arm===arm);return[arm,{cycleMedianMs:median(rs.map(r=>median(measure(r).cycles))),cycleP95Ms:p95(rs.flatMap(r=>measure(r).cycles)),actionP95Ms:p95(rs.flatMap(r=>measure(r).actions)),coldMountMedianMs:median(rs.map(r=>r.mountMs)),coldMountP95Ms:p95(rs.map(r=>r.mountMs)),taskCpuMedianUs:median(rs.map(r=>measure(r).cpuUs)),perAction: (shape.kind==='business'?Array.from({length:8},(_,i)=>String(i)):rows[0].timing.samples[0].actions.map(a=>a.name)).map((name,index)=>{const vals=rs.flatMap(r=>shape.kind==='business'?r.samples.map(s=>s.durations[index]):r.timing.samples.map(s=>s.actions[index].wallMs));return{name,medianMs:median(vals),p95Ms:p95(vals),maxMs:Math.max(...vals)};})}];}));
 return{shape:shape.name,control,arms,cycleReductionPct:100*(1-arms.candidate.cycleMedianMs/arms[control].cycleMedianMs),cpuReductionPct:100*(1-arms.candidate.taskCpuMedianUs/arms[control].taskCpuMedianUs),pairs:Array.from({length:mode==='smoke'?1:cycles},(_,cycle)=>{const med=arm=>median(rows.filter(r=>r.cycle===cycle&&r.arm===arm).map(r=>median(measure(r).cycles)));return{cycle,control,baselineMs:med(control),candidateMs:med('candidate'),reductionPct:100*(1-med('candidate')/med(control))};})};
});
const tailStats=values=>({count:values.length,medianMs:median(values),p95Ms:p95(values),maxMs:Math.max(...values),over8ms:values.filter(v=>v>8).length,over16_67ms:values.filter(v=>v>1000/60).length});
const selectionTails=Object.fromEntries(['baseline','candidate'].map(arm=>{const rr=records.filter(r=>r.kind==='collected'&&r.arm===arm);return[arm,{aggregate:tailStats(rr.flatMap(r=>r.timing.samples.map(s=>s.actions[6].wallMs))),processes:rr.map(r=>({cycle:r.cycle,position:r.position,...tailStats(r.timing.samples.map(s=>s.actions[6].wallMs))}))}];}));
json(mode+'-summary.json',{supplementConfig,configSha256,harnessSha256:harnessSnapshots.map(({kind,sha256})=>({kind,sha256})),selectionTails,mode,formal:mode.startsWith('timing'),environment,cycles:mode==='smoke'?1:cycles,summaries,note:'Independent processes in serial ABBA order. Headless React; includes fixture driver/effect flush, excludes browser DOM/layout/paint and real business I/O. Different workloads cannot be added together.'});
console.log(JSON.stringify({mode,output,summaries}));
