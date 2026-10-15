import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {RuntimeHealthMonitor,HttpAppsHostTransport,labelRuntimeDown} from '../../packages/plugin-apps/src/index.ts';
import {validateRuntimeLaunchManifest,loadRuntimeLaunchManifest,runtimeChildEnvironment,runtimePortFree,spawnRuntime,RuntimeRestarter,type RuntimeLaunchManifest,type RuntimeChild} from '../../packages/plugin-apps/src/runtime-launcher.ts';
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const refused=()=>Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNREFUSED'}});
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'runtime-launch-')),entry=join(dir,'runtime.cjs'),connections=join(dir,'connections.json'),token=join(dir,'operator.json');
  writeFileSync(entry,'');writeFileSync(connections,'{}');writeFileSync(token,JSON.stringify({token:'fixture-secret'}));
  const raw:RuntimeLaunchManifest={schemaVersion:1,managedBy:'dsh-plugin-apps-bundle',serviceUrl:'http://127.0.0.1:4181',nodeExecutable:process.execPath,entry,cwd:dir,env:{APPS_DATA_DIR:dir,APPS_CONNECTIONS_FILE:connections,APPS_PORT:'4181'},credentials:[{name:'HALLMARK_OPERATOR_TOKEN',fromFile:token,jsonField:'token'},{name:'openrouter',fromEnv:'fixtureRouter'}]};
  return {dir,entry,raw,expected:{serviceUrl:raw.serviceUrl,dataDirectory:dir,entry},close:()=>rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:30})};
}
test('installer calls isolated manifest writer only after ValidateOnly and installed artifact verification',()=>{
  const source=readFileSync(new URL('../../scripts/install-desktop-apps.ps1',import.meta.url),'utf8');
  const helper=source.indexOf('function Write-RuntimeLaunchManifest'),call=source.lastIndexOf('Write-RuntimeLaunchManifest');
  assert.ok(source.includes('function New-RuntimeLaunchManifest'));assert.ok(helper>=0);assert.ok(call>helper);
  assert.ok(call>source.indexOf('if ($ValidateOnly)'));assert.ok(call>source.indexOf('Installed artifact hash mismatch'));
  assert.ok(source.includes('[IO.File]::WriteAllText('));assert.ok(source.includes('Move-Item -LiteralPath'));assert.ok(source.includes('runtime-launch.previous.json'));
  assert.ok(!source.includes('Get-Content -LiteralPath $RuntimeOperatorTokenFile'));
});
test('manifest accepts explicit managed launch paths, service and credential sources; rejects malformed/inline secret inputs',()=>{
  const f=fixture();try{
    assert.equal(validateRuntimeLaunchManifest(f.raw,f.expected).nodeExecutable,process.execPath);
    const reject=(change:(x:any)=>void)=>{const value=structuredClone(f.raw);change(value);assert.throws(()=>validateRuntimeLaunchManifest(value,f.expected));};
    reject(x=>x.schemaVersion=2);reject(x=>delete x.managedBy);reject(x=>x.managedBy='external');reject(x=>x.args=['--eval','bad']);
    reject(x=>x.nodeExecutable='node');reject(x=>x.nodeExecutable=f.entry);reject(x=>x.entry='runtime.cjs');reject(x=>x.entry=join(f.dir,'absent'));
    reject(x=>x.cwd=f.entry);reject(x=>x.env.APPS_PORT='1.5');reject(x=>x.env.APPS_PORT='65536');reject(x=>x.env.APPS_PORT=4181);reject(x=>x.env.APPS_PORT='4182');
    reject(x=>x.serviceUrl='http://127.0.0.2:4181');reject(x=>x.serviceUrl='http://localhost:4181');reject(x=>x.serviceUrl='http://[::1]:4181');reject(x=>x.serviceUrl+='/?secret=bad');
    reject(x=>x.env.NODE_OPTIONS='--eval bad');reject(x=>x.env.openrouter='INLINE_SECRET');reject(x=>x.env.APPS_DATA_DIR=f.entry);reject(x=>x.env.APPS_CONNECTIONS_FILE='connections.json');
    reject(x=>x.credentials=[{name:'openrouter',value:'INLINE_SECRET'}]);reject(x=>x.credentials[0].value='INLINE_SECRET');reject(x=>x.credentials[0].fromEnv='x');reject(x=>x.credentials[0].jsonField='password');
    reject(x=>x.credentials[1].fromEnv='bad-name');reject(x=>x.credentials[1].name='NODE_OPTIONS');reject(x=>x.credentials.push(x.credentials[0]));
    assert.throws(()=>validateRuntimeLaunchManifest(f.raw,{...f.expected,entry:join(f.dir,'different')}),/ENTRY_MISMATCH/);
    assert.deepEqual(loadRuntimeLaunchManifest(f.dir,f.raw.serviceUrl),{reason:'NO_LAUNCH_SPEC'});
    writeFileSync(join(f.dir,'runtime-launch.json'),'{}');assert.deepEqual(loadRuntimeLaunchManifest(f.dir,f.raw.serviceUrl),{reason:'INVALID_LAUNCH_SPEC'});
    writeFileSync(join(f.dir,'runtime-launch.json'),'﻿'+JSON.stringify(f.raw));assert.ok(loadRuntimeLaunchManifest(f.dir,f.raw.serviceUrl,f.entry).manifest);
  }finally{f.close();}
});
test('credentials resolve afresh only into child env, without inherited Electron/Node injection or inline values',()=>{
  const f=fixture();try{
    const m=validateRuntimeLaunchManifest(f.raw,f.expected),inherited={fixtureRouter:'router-one',NODE_OPTIONS:'--require evil',ELECTRON_RUN_AS_NODE:'1',UNRELATED_TOKEN:'no',PATH:'fixture-path'};
    const first=runtimeChildEnvironment(m,inherited);assert.equal(first.HALLMARK_OPERATOR_TOKEN,'fixture-secret');assert.equal(first.openrouter,'router-one');assert.equal(first.NODE_OPTIONS,undefined);assert.equal(first.ELECTRON_RUN_AS_NODE,undefined);assert.equal(first.UNRELATED_TOKEN,undefined);assert.equal(first.PATH,'fixture-path');
    writeFileSync(join(f.dir,'operator.json'),JSON.stringify({token:'rotated-fixture'}));assert.equal(runtimeChildEnvironment(m,{fixtureRouter:'router-two'}).HALLMARK_OPERATOR_TOKEN,'rotated-fixture');
    assert.throws(()=>runtimeChildEnvironment(m,{}),/^Error: CREDENTIAL_SOURCE_UNAVAILABLE$/);assert.ok(!JSON.stringify(m).includes('rotated-fixture'));
    writeFileSync(join(f.dir,'operator.json'),'not-json-secret');assert.throws(()=>runtimeChildEnvironment(m,inherited),/^Error: CREDENTIAL_SOURCE_UNAVAILABLE$/);
  }finally{f.close();}
});
function controlled(options:{spawn?:()=>Promise<RuntimeChild>;port?:()=>Promise<boolean>;acquire?:()=>()=>void}={}){
  const f=fixture();let now=0,mode='down',spawns=0;const rows:Record<string,unknown>[]=[];
  const monitor=new RuntimeHealthMonitor({now:()=>now,probe:async()=>{if(mode==='ok')return {status:'ok'};if(mode==='response')throw Object.assign(new Error('response'),{statusCode:503});if(mode==='invalid')throw new SyntaxError('json');throw refused();}});
  const restarter=new RuntimeRestarter({monitor,manifest:f.raw,now:()=>now,environment:()=>({}),portFree:options.port??(async()=>true),acquire:options.acquire??(()=>()=>{}),spawn:async()=>{spawns++;return options.spawn?options.spawn():Promise.reject(new Error('fixture-spawn-secret'));},log:row=>rows.push(row)});
  const sample=async()=>{await monitor.check();await restarter.tick();};
  return {...f,monitor,restarter,rows,get spawns(){return spawns;},advance:(ms:number)=>{now+=ms;},mode:(value:string)=>{mode=value;},down:async()=>{restarter.start();await sample();await sample();await sample();},sample,close:()=>{restarter.stop();monitor.stop();f.close();}};
}
test('restarter is single-flight; state is restarting only during an actual attempt, not backoff',async()=>{
  let release!:(child:RuntimeChild)=>void;const f=controlled({spawn:()=>new Promise(resolve=>{release=resolve;})});
  try{await f.down();assert.equal(f.spawns,0);assert.equal(f.monitor.snapshot().recovering,false);assert.equal(labelRuntimeDown(f.monitor,{})?.code,'RUNTIME_DOWN');f.advance(5000);
    const first=f.restarter.tick();await sleep(0);const second=f.restarter.tick();assert.equal(first,second);assert.equal(f.spawns,1);assert.equal(f.monitor.snapshot().recovering,true);assert.equal(labelRuntimeDown(f.monitor,{})?.code,'RUNTIME_RESTARTING');
    release({hasExited:()=>false});await first;await f.restarter.tick();assert.equal(f.spawns,1);
  }finally{f.close();}
});
test('failed restarts back off 5/10/20/40/60 seconds, give up at five failures in ten minutes, reset only after five minutes healthy',async()=>{
  const f=controlled();try{await f.down();for(const delay of [5000,10000,20000,40000,60000]){const before=f.spawns;f.advance(delay-1);await f.restarter.tick();assert.equal(f.spawns,before);f.advance(1);await f.restarter.tick();assert.equal(f.spawns,before+1);}
    assert.equal(f.monitor.snapshot().restart.reason,'RESTART_LIMIT_REACHED');assert.equal(f.monitor.restarting,false);f.advance(600000);await f.restarter.tick();assert.equal(f.spawns,5,'give-up is sticky until stable health');
    f.mode('ok');await f.sample();f.advance(299999);await f.sample();assert.ok(!f.rows.some(x=>x.reason==='HEALTHY_RESET'));f.advance(1);await f.sample();assert.ok(f.rows.some(x=>x.reason==='HEALTHY_RESET'));
    f.mode('down');await f.sample();await f.sample();await f.sample();f.advance(4999);await f.restarter.tick();assert.equal(f.spawns,5);f.advance(1);await f.restarter.tick();assert.equal(f.spawns,6);
    assert.ok(!JSON.stringify(f.rows).includes('fixture-spawn-secret'));
  }finally{f.close();}
});
test('failure window expires older attempts before the give-up count',async()=>{
  const f=controlled();try{await f.down();for(let i=0;i<6;i++){f.advance(600001);await f.restarter.tick();}assert.equal(f.spawns,6);assert.notEqual(f.monitor.snapshot().restart.reason,'RESTART_LIMIT_REACHED');}finally{f.close();}
});
test('port in use/unknown and actual HTTP responses (including invalid bodies) forbid spawn',async()=>{
  for(const mode of ['down','response','invalid']){
    const f=controlled({port:async()=>false});try{await f.down();f.mode(mode);if(mode!=='down')await f.sample();f.advance(5000);await f.restarter.tick();assert.equal(f.spawns,0);assert.equal(f.monitor.snapshot().restart.reason,mode==='down'?'PORT_IN_USE_OR_UNKNOWN':'RUNTIME_ANSWERED');}finally{f.close();}
  }
});
test('timed-out live owned child is never killed or duplicated, and stop cancels pending launch work',async()=>{
  const f=controlled({spawn:async()=>({hasExited:()=>false})});try{await f.down();f.advance(5000);await f.restarter.tick();f.advance(30000);await f.restarter.tick();assert.equal(f.monitor.snapshot().restart.reason,'RESTART_TIMEOUT');assert.equal(f.monitor.restarting,false);f.advance(60000);await f.restarter.tick();assert.equal(f.monitor.snapshot().restart.reason,'OWNED_CHILD_STILL_RUNNING');assert.equal(f.spawns,1);f.restarter.stop();f.advance(60000);await f.restarter.tick();assert.equal(f.spawns,1);}finally{f.close();}
});
test('stop during an in-flight port probe prevents spawn, removes listeners, and leaves no restart timer',async()=>{
  let resolve!:(free:boolean)=>void,probes=0;const f=controlled({port:()=>{probes++;return new Promise(r=>{resolve=r;});}});
  try{await f.down();f.advance(5000);const pending=f.restarter.tick();await sleep(0);assert.equal(probes,1);f.restarter.stop();resolve(true);await pending;
    f.advance(60000);await f.monitor.check();await f.restarter.tick();assert.equal(f.spawns,0);assert.equal(probes,1);assert.equal(f.monitor.snapshot().recovering,false);
  }finally{f.close();}
});
test('exclusive launch lock refusal does not spawn and exited child lock is released on stop',async()=>{
  const f=fixture();try{
    const monitor=new RuntimeHealthMonitor({probe:async()=>{throw refused();}});for(let i=0;i<3;i++)await monitor.check();let now=0,spawns=0;
    writeFileSync(join(f.dir,'runtime-launch.lock'),'other-host');
    const r=new RuntimeRestarter({monitor,manifest:f.raw,now:()=>now,portFree:async()=>true,environment:()=>({}),spawn:async()=>{spawns++;return {hasExited:()=>false};}});r.start();await r.tick();now=5000;await r.tick();assert.equal(spawns,0);assert.equal(readFileSync(join(f.dir,'runtime-launch.lock'),'utf8'),'other-host');r.stop();
    rmSync(join(f.dir,'runtime-launch.lock'));let exited=false;const r2=new RuntimeRestarter({monitor,manifest:f.raw,now:()=>now,portFree:async()=>true,environment:()=>({}),spawn:async()=>({hasExited:()=>exited})});r2.start();await r2.tick();now+=5000;await r2.tick();assert.ok(existsSync(join(f.dir,'runtime-launch.lock')));exited=true;r2.stop();assert.equal(existsSync(join(f.dir,'runtime-launch.lock')),false);
  }finally{f.close();}
});
test('a timed-out alive unbound child retains cross-Host lock, including after Host disposal',async()=>{
  const f=fixture();let now=0,first=0,second=0;const monitor=new RuntimeHealthMonitor({probe:async()=>{throw refused();}});for(let i=0;i<3;i++)await monitor.check();
  const common={monitor,manifest:f.raw,now:()=>now,portFree:async()=>true,environment:()=>({})};
  const r1=new RuntimeRestarter({...common,spawn:async()=>{first++;return {hasExited:()=>false};}}),r2=new RuntimeRestarter({...common,spawn:async()=>{second++;return {hasExited:()=>false};}});
  try{r1.start();await r1.tick();now=5000;await r1.tick();now+=30000;await r1.tick();assert.equal(first,1);assert.ok(existsSync(join(f.dir,'runtime-launch.lock')));
    r2.start();await r2.tick();now+=5000;await r2.tick();assert.equal(second,0);r1.stop();assert.ok(existsSync(join(f.dir,'runtime-launch.lock')));now+=10000;await r2.tick();assert.equal(second,0);
  }finally{r1.stop();r2.stop();monitor.stop();f.close();}
});
test('cross-Host lock covers delayed port probe across another Host becoming healthy',async()=>{
  const f=fixture();let now=0,spawns=0,release!:(free:boolean)=>void;
  const probe=async()=>{if(spawns)return {status:'ok'};throw refused();},m1=new RuntimeHealthMonitor({probe}),m2=new RuntimeHealthMonitor({probe});for(let i=0;i<3;i++){await m1.check();await m2.check();}
  const common={manifest:f.raw,now:()=>now,environment:()=>({}),spawn:async()=>{spawns++;return {hasExited:()=>false};}};
  const r1=new RuntimeRestarter({...common,monitor:m1,portFree:async()=>spawns===0}),r2=new RuntimeRestarter({...common,monitor:m2,portFree:()=>new Promise(resolve=>{release=resolve;})});
  try{r1.start();r2.start();await r1.tick();await r2.tick();now=5000;
    const pending=r2.tick();await sleep(0);await r1.tick();await m1.check();await r1.tick();release(true);await pending;
    assert.equal(spawns,1,'a second Host cannot retain a free-port answer outside the exclusive launch lock');
  }finally{r1.stop();r2.stop();m1.stop();m2.stop();f.close();}
});
async function waitFor(check:()=>boolean|Promise<boolean>,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await sleep(25);}throw new Error('fixture condition timed out');}
test('real owned child: kill → monitor down → detached safe spawn → healthy on same temp Runtime port',async()=>{
  const f=fixture(),server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
  f.raw.serviceUrl=`http://127.0.0.1:${port}`;f.raw.env.APPS_PORT=String(port);f.raw.credentials=[];
  writeFileSync(f.entry,"const http=require('node:http');console.log('fixture runtime boot');http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'ok',version:'fixture'}));}).listen(Number(process.env.APPS_PORT),'127.0.0.1');");
  const children:RuntimeChild[]=[],rows:Record<string,unknown>[]=[],transport=new HttpAppsHostTransport(f.raw.serviceUrl,'f'.repeat(64)),monitor=new RuntimeHealthMonitor({intervalMs:20,timeoutMs:300,slowMs:500,probe:signal=>transport.health(signal)});
  const launch=async(m:RuntimeLaunchManifest,env:NodeJS.ProcessEnv)=>{const child=await spawnRuntime(m,env);children.push(child);return child;};
  const restarter=new RuntimeRestarter({monitor,manifest:f.raw,spawn:launch,policy:{initialBackoffMs:25,maxBackoffMs:100,attemptTimeoutMs:3000},log:row=>rows.push(row)});
  try{
    assert.equal(await runtimePortFree(f.raw.serviceUrl),true);const first=await launch(f.raw,runtimeChildEnvironment(f.raw));await waitFor(async()=>{await monitor.check();return monitor.state==='healthy';});assert.equal(await runtimePortFree(f.raw.serviceUrl),false);
    process.kill(first.pid!);await waitFor(()=>first.hasExited());restarter.start();monitor.start();await waitFor(()=>rows.some(x=>x.reason==='WAITING_FOR_HEALTH')&&monitor.state==='healthy');
    assert.equal(children.length,2);assert.notEqual(children[0].pid,children[1].pid);assert.ok(readFileSync(join(f.dir,'logs','runtime-child.log'),'utf8').includes('fixture runtime boot'));
  }finally{restarter.stop();monitor.stop();for(const child of children)if(!child.hasExited())process.kill(child.pid!);await waitFor(()=>children.every(c=>c.hasExited()));assert.equal(await runtimePortFree(f.raw.serviceUrl),true);assert.equal(existsSync(join(f.dir,'runtime-launch.lock')),false);f.close();assert.equal(existsSync(f.dir),false);}
});

test('manual restart stops once, shares concurrent repairs and verifies recovered health',async()=>{
  const f=fixture();let online=true,spawns=0,stops=0;
  const monitor=new RuntimeHealthMonitor({probe:async()=>{if(!online)throw refused();return {status:'ok'};},downAfter:1});
  const restarter=new RuntimeRestarter({monitor,manifest:f.raw,environment:()=>({}),acquire:()=>()=>{},portFree:async()=>true,spawn:async()=>{spawns++;online=true;return {hasExited:()=>false};}});
  try{
    await monitor.check();restarter.start();
    const stop=async()=>{stops++;online=false;};
    const first=restarter.restart(stop),second=restarter.restart(stop);
    assert.equal(first,second);await first;
    assert.equal(stops,1);assert.equal(spawns,1);assert.equal(monitor.state,'healthy');
    await assert.rejects(restarter.restart(async()=>{throw new Error('busy');}),/busy/);
    assert.equal(spawns,1);
  }finally{restarter.stop();monitor.stop();f.close();}
});
