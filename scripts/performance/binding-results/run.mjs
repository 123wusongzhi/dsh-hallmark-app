import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,statSync,appendFileSync} from 'node:fs';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {repositoryIdentity} from './identity.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['--baseline','--candidate','--output','--mode','--rounds','--arms','--suites','--timeout-ms','--baseline-head','--candidate-head','--candidate-label']);
const options={};
for(const value of process.argv.slice(2)){
 const i=value.indexOf('='),key=value.slice(0,i);
 if(i<1||!allowed.has(key)||!value.slice(i+1)||Object.hasOwn(options,key))throw Error('Use a unique supported --name=value argument: '+value);
 options[key]=value.slice(i+1);
}
if(!options['--baseline']||!options['--candidate'])throw Error('Provide both --baseline=<checkout> and --candidate=<checkout>.');
const timeoutMs=Number(options['--timeout-ms']??900000);
if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('timeout-ms must be positive');
const mode=options['--mode']??'calibrate';if(!['calibrate','formal'].includes(mode))throw Error('mode must be calibrate or formal');
if(process.version!=='v24.12.0')throw Error('This protocol is pinned to Node v24.12.0; actual '+process.version);
const roots={A:resolve(options['--baseline']),B:resolve(options['--candidate'])};
if(roots.A===roots.B)throw Error('Baseline and candidate must be separate checkouts.');
const suiteNames=['category','fields','literal-long','literal-absent','literal-short','arrays-whole','unicode','collection','sku','namespace'];
const suites=options['--suites']?options['--suites'].split(','):suiteNames;if(suites.some(x=>!suiteNames.includes(x))||new Set(suites).size!==suites.length)throw Error('Unknown or repeated suite');
const rounds=mode==='formal'?Number(options['--rounds']??5):1;if(mode==='formal'&&(!Number.isInteger(rounds)||rounds<5))throw Error('Formal requires at least five independent pairs');
const arms=mode==='formal'?['A','B']:(options['--arms']??'A').split(',');if(arms.some(a=>!roots[a])||new Set(arms).size!==arms.length)throw Error('Unknown or repeated arm');
if(mode==='formal'&&options['--arms']&&options['--arms']!=='A,B')throw Error('Formal measurements require both A and B.');
const output=resolve(options['--output']??join(process.cwd(),'artifacts','performance','binding-results',`${mode}-${new Date().toISOString().replaceAll(':','-')}`));if(existsSync(output))throw Error('Refuse to overwrite an existing run: '+output);mkdirSync(join(output,'raw'),{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function treeFiles(root){return ['packages','scripts'].flatMap(top=>{function walk(dir){return readdirSync(dir,{withFileTypes:true}).filter(e=>!['node_modules','.git'].includes(e.name)).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);}return walk(join(root,top));}).concat(['package.json','pnpm-lock.yaml'].map(p=>join(root,p)).filter(existsSync)).sort();}
function freeze(root){return treeFiles(root).map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:hash(readFileSync(path))}));}
const gitIdentities=Object.fromEntries(arms.map(arm=>[arm,repositoryIdentity(roots[arm])])),identities=Object.fromEntries(arms.map(arm=>[arm,freeze(roots[arm])])),harnesses=readdirSync(join(here,'fixtures')).sort().map(name=>({name,sha256:hash(readFileSync(join(here,'fixtures',name)))}));
const runnerFiles=['run.mjs','metrics.mjs','identity.mjs','summarize.mjs','literal-oracle.mjs','reader-parity.mjs','provenance.json'],runnerHashes=()=>runnerFiles.map(name=>({name,sha256:hash(readFileSync(join(here,name)))})),runners=runnerHashes();
for(const arm of arms){const expected=options[arm==='A'?'--baseline-head':'--candidate-head'];if(expected&&gitIdentities[arm].head!==expected)throw Error('BENCH_UNEXPECTED_COMMIT: '+arm+' '+gitIdentities[arm].head);if(gitIdentities[arm].unmerged.length)throw Error('BENCH_UNMERGED_SOURCE: '+arm);}
writeFileSync(join(output,'manifest-before.json'),JSON.stringify({mode,rounds,suites,arms,expectedProcesses:suites.length*rounds*arms.length,roots,gitIdentities,identities,harnesses,runners,literalFixtures:{long:{clauses:240,literal:'冷藏运输'},absent:{clauses:240,literal:'不存在的完整关键词'},short:{clauses:12,literal:'冷藏运输'}},candidateLabel:options['--candidate-label']??'Selected binding changes and local compatibility fixes; exact files identified by hashes',node:{version:process.version,execPath:process.execPath,sha256:hash(readFileSync(process.execPath))},platform:{platform:process.platform,arch:process.arch,cpus:os.cpus()[0]?.model,totalMemory:os.totalmem()},createdAt:new Date().toISOString(),protocol:'Serial independent processes; alternating pair order AB/BA; no discarded or replacement samples; calibration excluded from formal.'},null,2));
let sequence=0;const samples=[];
async function sample(suite,arm,round){
 const name=`${String(++sequence).padStart(3,'0')}-${suite}-r${round}-${arm}`,prefix=join(output,'raw',name),env={...process.env,TZ:'Asia/Shanghai',BENCH_METRICS_PATH:prefix+'.metrics.json'},args=[];
 for(const key of ['HOST_ROOT','SPLIT_SERVICE','SERVICE_CHILD','RAW','EXPECT_UNSUPPORTED','LOCATE','LITERAL','CLAUSES','SCENARIO','SIZES','REPEATS','REPORT','HEALTHY','MIXED','LEGACY','UNINSTRUMENTED','CASE_FILTER','UNICODE_SCALE'])delete env[key];
 let file=suite;
 if(suite==='fields'){file='fields';args.push(roots[arm],arm==='A'?'whole':'projection');if(mode==='calibrate')env.CASE_FILTER='small-2,skinny-100';}
 else if(suite==='arrays-whole'){file='arrays';args.push(roots[arm],'whole');if(mode==='calibrate')env.CASE_FILTER='small-2,skinny-100';}
 else if(suite.startsWith('literal-')){file='literal';args.push(roots[arm],prefix+'.trace.json');env.LOCATE=arm==='B'?'1':'0';env.CLAUSES=suite==='literal-short'?'12':'240';env.LITERAL=suite==='literal-absent'?'不存在的完整关键词':'冷藏运输';env.SCENARIO='catalog';}
 else{args.push(roots[arm]);if(suite==='unicode'){args.push(arm);if(mode==='calibrate')env.UNICODE_SCALE='.002';}if(suite==='collection'){Object.assign(env,{HEALTHY:'1',MIXED:'1',UNINSTRUMENTED:'1',SIZES:mode==='calibrate'?'16':'100,5000',REPORT:prefix+'.report.json'});}if(suite==='sku')Object.assign(env,{SIZES:mode==='calibrate'?'32':'32,2048',REPEATS:'1',REPORT:prefix+'.report.json'});if(suite==='namespace')env.SIZES=mode==='calibrate'?'32':'32,5000';}
 const entry=join(here,'fixtures',file+(['category','fields','arrays','unicode'].includes(file)?'.ts':'.mjs'));
 appendFileSync(join(output,'progress.jsonl'),JSON.stringify({event:'start',name,at:new Date().toISOString()})+'\n');console.log('START '+name);
 const started=performance.now(),child=spawn(process.execPath,['--expose-gc','--import',pathToFileURL(join(here,'metrics.mjs')).href,entry,...args],{cwd:here,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;
 child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
 const exitCode=await new Promise((accept,reject)=>{child.once('error',reject);child.once('close',code=>accept(code));});clearTimeout(timer);
 writeFileSync(prefix+'.stdout',stdout);writeFileSync(prefix+'.stderr',stderr);writeFileSync(prefix+'.exit.json',JSON.stringify({exitCode,timedOut}));
 let data=null,parseError=null;try{data=JSON.parse(stdout);writeFileSync(prefix+'.json',JSON.stringify(data,null,2));}catch(error){parseError=error.message;}
 const result={name,suite,arm,round,exitCode,timedOut,parseError,processWallMs:performance.now()-started,stdoutBytes:Buffer.byteLength(stdout),dataPath:prefix+'.json',metricsPath:prefix+'.metrics.json'};samples.push(result);appendFileSync(join(output,'progress.jsonl'),JSON.stringify({event:'end',...result,at:new Date().toISOString()})+'\n');writeFileSync(join(output,'samples.json'),JSON.stringify(samples,null,2));console.log('END '+name+' '+exitCode+' '+Math.round(result.processWallMs)+'ms');
 if(exitCode!==0||timedOut||parseError)throw Error('Sample failed; retained without replacement: '+name);
}
try{
 for(const suite of suites)for(let round=1;round<=rounds;round++){const order=round%2===1?['A','B']:['B','A'];for(const arm of order.filter(a=>arms.includes(a)))await sample(suite,arm,round);}
 const after=Object.fromEntries(arms.map(arm=>[arm,freeze(roots[arm])])),gitAfter=Object.fromEntries(arms.map(arm=>[arm,repositoryIdentity(roots[arm])])),harnessAfter=readdirSync(join(here,'fixtures')).sort().map(name=>({name,sha256:hash(readFileSync(join(here,'fixtures',name)))}));writeFileSync(join(output,'manifest-after.json'),JSON.stringify(after,null,2));writeFileSync(join(output,'git-identities-after.json'),JSON.stringify(gitAfter,null,2));
 if(JSON.stringify(after)!==JSON.stringify(identities))throw Error('Source changed during measurements; run is invalid and retained.');
 if(JSON.stringify(harnessAfter)!==JSON.stringify(harnesses))throw Error('Harness changed during measurements; run is invalid and retained.');
 if(JSON.stringify(runnerHashes())!==JSON.stringify(runners))throw Error('Benchmark runner changed during measurements; run is invalid and retained.');
 if(arms.some(arm=>gitAfter[arm].head!==gitIdentities[arm].head||gitAfter[arm].unmerged.length))throw Error('Git HEAD or merge state changed during measurements; run is invalid and retained.');
 writeFileSync(join(output,'complete.json'),JSON.stringify({completedAt:new Date().toISOString(),mode,rounds,processes:samples.length,sourceUnchanged:true},null,2));console.log(JSON.stringify({output,mode,processes:samples.length}));
}catch(error){writeFileSync(join(output,'failed.json'),JSON.stringify({error:error.message,at:new Date().toISOString(),samples:samples.length},null,2));throw error;}
