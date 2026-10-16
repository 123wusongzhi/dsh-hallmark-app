// Explicitly opt in to all C1 assertions/budgets; ordinary npm test keeps all deterministic work/index assertions, without timing gates.
import assert from 'node:assert/strict';
import {mkdirSync,openSync,writeFileSync,closeSync,unlinkSync,readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=join(root,'artifacts/component-display-reliability');
mkdirSync(out,{recursive:true});const lock=join(out,'.c1-running.lock'),fd=openSync(lock,'wx');
writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),note:'Do not run concurrently with npm test or browser/performance jobs.'}));
try{
  assert.equal(resolve(process.cwd()),resolve(root),'Run from the repository root so evidence paths are unambiguous.');
  const child=spawn(process.execPath,['--test','--test-concurrency=1',join(root,'test/acceptance/component-display/read-scale.test.ts')],{env:{...process.env,DSH_DISPLAY_PERFORMANCE:'1'},stdio:'inherit',windowsHide:true});
  const code=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',done);});process.exitCode=code??1;
  if(code===0){const evidence=JSON.parse(readFileSync(join(out,'c1-read-scale.json'),'utf8'));assert.equal(evidence.status,'PASS');assert.equal(evidence.budgetsEnforced,true);assert.equal(evidence.hotChunks.n,64);assert.equal(evidence.processCold.wall.n,3);}
}finally{closeSync(fd);unlinkSync(lock);}
