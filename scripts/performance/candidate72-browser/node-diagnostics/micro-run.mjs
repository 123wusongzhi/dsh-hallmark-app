import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ownedPath,outputRoot} from './diagnostic-paths.mjs';
import {prepareMicro} from './micro-prepare.mjs';

const [sourceArg,outArg,roundsArg='2',modesArg='control,micro-trace']=process.argv.slice(2);
assert.ok(sourceArg&&outArg,'Usage: node micro-run.mjs <original-bundle-dir> <owned-results-dir> [ABBA rounds=2] [modes=control,micro,micro-trace,micro-profile]');
const output=ownedPath(outArg),rounds=Number(roundsArg),modes=modesArg.split(',');
assert.ok(Number.isInteger(rounds)&&rounds>0);assert.ok(modes.length&&modes.every(mode=>['control','micro','micro-trace','micro-profile'].includes(mode)));
assert.equal(new Set(modes).size,modes.length,'Duplicate modes would overwrite run evidence');
assert.ok(!existsSync(output),'Use a fresh output directory; existing evidence is not overwritten');mkdirSync(output,{recursive:true});
const prepared=prepareMicro(resolve(sourceArg),join(output,'bundles')),runs=[];
writeFileSync(join(output,'run-manifest.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),node:process.version,execPath:process.execPath,platform:process.platform,outputRoot,rounds,modes,order:['baseline','candidate','candidate','baseline'],prepared},null,2));
let oracle;
for(const mode of modes)for(let round=0;round<rounds;round++)for(const [position,variant]of ['baseline','candidate','candidate','baseline'].entries()){
  const label=`${mode}-r${round}-s${position}-${variant}`,prefix=join(output,label),entry=prepared.entries.find(entry=>entry.variant===variant);
  const tracePath=join(output,label+'.trace.json'),profileName=label+'.cpuprofile';
  const flags=mode==='micro-trace'?['--expose-gc','--trace-gc-nvp','--trace-event-categories=v8,node.perf,node.perf.usertiming','--trace-event-file-pattern='+tracePath]:mode==='micro-profile'?['--cpu-prof','--cpu-prof-interval=500','--cpu-prof-dir='+output,'--cpu-prof-name='+profileName]:[];
  const bundle=mode==='control'?entry.controlPath:entry.diagnosticPath,args=[...flags,bundle,'500','timing',prefix];
  const child=spawnSync(process.execPath,args,{cwd:output,encoding:'utf8',timeout:180000,maxBuffer:64*1024*1024,env:{...process.env,TZ:'Asia/Shanghai',DIAG_VARIANT:variant,DIAG_CALIBRATE_GC:mode==='micro-trace'?'1':'0'}});
  writeFileSync(prefix+'.stdout.log',child.stdout??'');writeFileSync(prefix+'.stderr.log',child.stderr??'');
  const run={label,mode,round,position,variant,args,exitCode:child.status,signal:child.signal,error:child.error?.message??null,sourceSha256:entry.originalSha256,prefix,tracePath:mode==='micro-trace'?tracePath:null,profilePath:mode==='micro-profile'?join(output,profileName):null};runs.push(run);
  writeFileSync(join(output,'runs.json'),JSON.stringify(runs,null,2));assert.equal(child.status,0,`${label}: ${child.error?.message??child.stderr}`);
  const result=JSON.parse(readFileSync(prefix+'.json','utf8')),current={initial:result.initialHostFrame,warm:result.warmHostFrame,final:result.finalHostFrame,fixture:result.fixture.sha256,bridge:result.bridge,network:result.network};
  if(oracle)assert.deepEqual(current,oracle,'Complete rendered frames, fixture and bridge remain unchanged');else oracle=current;
  assert.equal(result.timing.warmupCycles,30);assert.equal(result.timing.rounds,100);assert.equal(result.timing.actionsPerRound,11);
  console.log(JSON.stringify({label,completed:true,mode,variant,wallMs:result.timing.wallMs,cpuUs:result.timing.cpuUs}));
}
console.log(JSON.stringify({status:'PASS',output,processes:runs.length,note:'Micro instrumentation still adds two object properties; compare with unmodified controls. No construction or diagnostics allocation before EOF.'}));
