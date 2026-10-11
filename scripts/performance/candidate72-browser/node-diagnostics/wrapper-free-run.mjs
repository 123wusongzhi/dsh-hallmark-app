import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ownedPath,outputRoot} from './diagnostic-paths.mjs';
import {prepareWrapperFree} from './wrapper-free-prepare.mjs';

const [sourceArg,outArg,roundsArg='1',modesArg='original-trace,wrapper-free-trace',orderArg='baseline,candidate,candidate',referenceArg]=process.argv.slice(2);
assert.ok(sourceArg&&outArg,'Usage: node wrapper-free-run.mjs <original-bundle-dir> <fresh-owned-results-dir> [rounds=1] [modes=original-trace,wrapper-free-trace] [order=baseline,candidate,candidate] [reference-manifest.json]');
const source=resolve(sourceArg),output=ownedPath(outArg),rounds=Number(roundsArg),modes=modesArg.split(','),order=orderArg.split(',');
assert.ok(Number.isInteger(rounds)&&rounds>0);assert.ok(modes.length&&modes.every(mode=>['original-trace','wrapper-free-trace'].includes(mode)));assert.ok(order.length&&order.every(variant=>['baseline','candidate'].includes(variant)));
assert.equal(new Set(modes).size,modes.length,'Duplicate modes would overwrite run evidence');
assert.ok(!existsSync(output),'Use a fresh result directory; evidence is never overwritten');mkdirSync(output,{recursive:true});
const prepared=prepareWrapperFree(source,join(output,'bundles')),runs=[];
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const shape=result=>({initial:result.initialHostFrame,warm:result.warmHostFrame,final:result.finalHostFrame,fixture:result.fixture,bridge:result.bridge,network:result.network,finalState:result.final,actionNames:result.timing.samples.map(sample=>({round:sample.round,names:sample.actions.map(action=>action.name)}))});
// Required saved original outputs make even a wrapper-only trial fail closed on
// output or action-sequence changes. These reads occur in the parent process.
const referenceConfig=referenceArg?read(resolve(referenceArg)):null;
if(referenceConfig)assert.ok(typeof referenceConfig.baseline==='string'&&typeof referenceConfig.candidate==='string','Reference manifest needs baseline and candidate paths');
const referencePaths=referenceConfig?Object.fromEntries(Object.entries(referenceConfig).filter(([key])=>['baseline','candidate'].includes(key)).map(([key,path])=>[key,resolve(dirname(resolve(referenceArg)),path)])):{baseline:join(source,'timing-collected-500-0-0-baseline.json'),candidate:join(source,'timing-collected-500-0-1-candidate.json')};
const references=Object.fromEntries(Object.entries(referencePaths).map(([variant,path])=>[variant,shape(read(path))]));
writeFileSync(join(output,'run-manifest.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),node:process.version,execPath:process.execPath,platform:process.platform,outputRoot,rounds,modes,order,referencePaths,prepared,boundary:'Private Fiber control-lookup diagnostic only. Not a production patch or formal performance conclusion.'},null,2));
for(let round=0;round<rounds;round++)for(const mode of (round%2?[...modes].reverse():modes))for(const [position,variant]of order.entries()){
  const label=`${mode}-r${round}-s${position}-${variant}`,prefix=join(output,label),entry=prepared.entries.find(entry=>entry.variant===variant),tracePath=prefix+'.trace.json';
  const flags=['--expose-gc','--trace-gc-nvp','--trace-event-categories=v8,node.perf,node.perf.usertiming','--trace-event-file-pattern='+tracePath];
  const bundle=mode==='original-trace'?entry.originalMicroPath:entry.wrapperFreePath,args=[...flags,bundle,'500','timing',prefix];
  const child=spawnSync(process.execPath,args,{cwd:output,encoding:'utf8',timeout:180000,maxBuffer:64*1024*1024,env:{...process.env,TZ:'Asia/Shanghai',DIAG_VARIANT:variant,DIAG_CALIBRATE_GC:'1'}});
  writeFileSync(prefix+'.stdout.log',child.stdout??'');writeFileSync(prefix+'.stderr.log',child.stderr??'');
  const run={label,mode,round,position,variant,args,exitCode:child.status,signal:child.signal,error:child.error?.message??null,sourceSha256:entry.originalSha256,bundleSha256:mode==='original-trace'?entry.diagnosticSha256:entry.wrapperFreeSha256,prefix,tracePath,profilePath:null};runs.push(run);writeFileSync(join(output,'runs.json'),JSON.stringify(runs,null,2));
  assert.equal(child.status,0,`${label}: ${child.error?.message??child.stderr}`);
  const result=read(prefix+'.json');assert.deepEqual(shape(result),references[variant],'Original complete initial/warm/final output, action sequence, final selection and bridge must remain unchanged');
  assert.equal(result.timing.warmupCycles,30);assert.equal(result.timing.rounds,100);assert.equal(result.timing.actionsPerRound,11);assert.ok(result.timing.samples.every(sample=>sample.actions.length===11));
  run.outputParity='PASS';writeFileSync(join(output,'runs.json'),JSON.stringify(runs,null,2));
  console.log(JSON.stringify({label,completed:true,outputParity:'PASS',wallMs:result.timing.wallMs,cpuUs:result.timing.cpuUs}));
}
console.log(JSON.stringify({status:'PASS',output,processes:runs.length,note:'Original snapshots and actions preserved. Private Fiber lookup diagnostic only; not production performance evidence.'}));
