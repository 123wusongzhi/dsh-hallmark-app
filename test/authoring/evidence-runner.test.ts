import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';

function setup(){const root=mkdtempSync(join(tmpdir(),'apps-runner-')),workspace=join(root,'workspace');mkdirSync(workspace);writeFileSync(join(workspace,'package-lock.json'),JSON.stringify({name:'fixture',lockfileVersion:3,packages:{}}));writeFileSync(join(workspace,'source.html'),'<main>actual fixture</main>');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('source.html','dist/index.html');console.log('built fixture');");const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));return {root,workspace,sources,runner,cleanup(){assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true});}};}
test('actual build report binds real command, unchanged input, complete archive and immutable log',async()=>{
 const f=setup();try{const result=await f.runner.build({attemptId:'actual-build',epoch:1,sourceRevision:1,workspacePath:f.workspace,command:[process.execPath,'build.mjs'],sources:f.sources});assert.equal(result.report.verdict,'PASS');assert.equal(result.report.exitCode,0);assert.match(readFileSync(result.report.logRef.path,'utf8'),/built fixture/);assert.deepEqual(f.runner.verifyBuild(result.reportRef,f.sources),result.report);writeFileSync(join(f.workspace,'source.html'),'changed');assert.throws(()=>f.runner.verifyBuild(result.reportRef,f.sources),/BUILD_INPUT_CHANGED/);}finally{f.cleanup();}
});
test('failed command and input mutation never produce a publishable build',async()=>{
 const f=setup();try{const result=await f.runner.build({attemptId:'failed-build',epoch:1,sourceRevision:1,workspacePath:f.workspace,command:[process.execPath,'-e','process.exit(7)'],sources:f.sources});assert.equal(result.report.verdict,'FAIL');assert.equal(result.report.exitCode,7);assert.equal(result.report.archiveBuildId,null);assert.throws(()=>f.runner.verifyBuild(result.reportRef,f.sources),/BUILD_EVIDENCE_INVALID/);assert.equal(f.runner.verifyBuild(result.reportRef,f.sources,{allowFailure:true}).verdict,'FAIL');const changed=await f.runner.build({attemptId:'input-change',epoch:1,sourceRevision:1,workspacePath:f.workspace,command:[process.execPath,'-e',"require('node:fs').writeFileSync('source.html','changed during build')"],sources:f.sources});assert.equal(changed.report.inputUnchanged,false);assert.equal(changed.report.verdict,'FAIL');}finally{f.cleanup();}
});
test('caller-authored PASS and modified evidence are rejected by runner attestation and file hash',async()=>{
 const f=setup();try{const fake=join(f.runner.root,'fake.json');writeFileSync(fake,JSON.stringify({report:{verdict:'PASS'},signature:'0'.repeat(64)}));assert.throws(()=>f.runner.readReport(evidenceFile(fake)),/ATTESTATION_INVALID/);const result=await f.runner.build({attemptId:'tamper',epoch:1,sourceRevision:1,workspacePath:f.workspace,command:[process.execPath,'build.mjs'],sources:f.sources});writeFileSync(result.report.logRef.path,'tampered');assert.throws(()=>f.runner.verifyBuild(result.reportRef,f.sources),/EVIDENCE_HASH_MISMATCH/);}finally{f.cleanup();}
});

test('a persisted cancellation stops only its owned running build epoch and cannot archive a success',async()=>{
 const f=setup();try{
  writeFileSync(join(f.workspace,'hang.mjs'),"import{writeFileSync}from'node:fs';writeFileSync('started.json',JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);");
  const running=f.runner.build({attemptId:'cancel-running',epoch:2,sourceRevision:2,workspacePath:f.workspace,command:[process.execPath,'hang.mjs'],sources:f.sources,timeoutMs:10000});
  for(let i=0;i<100;i++){try{JSON.parse(readFileSync(join(f.workspace,'started.json'),'utf8'));break;}catch{}await new Promise(accept=>setTimeout(accept,25));}
  const pid=JSON.parse(readFileSync(join(f.workspace,'started.json'),'utf8')).pid;
  const restartedRunner=new AuthoringEvidenceRunner(f.runner.root);restartedRunner.cancel('cancel-running',1);
  assert.doesNotThrow(()=>process.kill(pid,0));restartedRunner.cancel('cancel-running',2);
  const stopped=await running;assert.equal(stopped.report.verdict,'FAIL');assert.equal(stopped.report.archiveBuildId,null);assert.match(readFileSync(stopped.report.logRef.path,'utf8'),/cancelled/);
  assert.throws(()=>process.kill(pid,0));
  const newEpoch=await f.runner.build({attemptId:'cancel-running',epoch:3,sourceRevision:3,workspacePath:f.workspace,command:[process.execPath,'build.mjs'],sources:f.sources});assert.equal(newEpoch.report.verdict,'PASS');
 }finally{f.cleanup();}
});
