import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {evaluatePerformance,verifyPerformanceEvidence,requirePassingPerformance,PERFORMANCE_LIMITS} from '../../packages/source-components/src/authoring-performance.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {previewTestPlan} from '../../packages/source-components/src/authoring-preview-plan.ts';
import {performanceEvidence,performanceSample} from './performance-fixture.ts';

test('controlled performance budgets accept exact boundaries and measured image-free components',()=>{
  const value=performanceEvidence(['filter']);
  for(const view of value.viewports){view.initial=performanceSample({readyMs:2500,blockingMs:300,maxTaskMs:200,layoutShift:0.1,domElements:3000,renderedRows:100,loadedScriptBytes:2*1024*1024});view.interactions[0].feedbackMs=250;}
  assert.deepEqual(evaluatePerformance(value),{verdict:'PASS',failures:[]});assert.equal(requirePassingPerformance(value,{'420':['filter'],'1040':['filter']}).verdict,'PASS');
});

test('each first-screen budget produces a repairable failure instead of trusting PASS',()=>{
  const violations={readyMs:2501,blockingMs:301,maxTaskMs:201,layoutShift:0.10001,domElements:3001,renderedRows:101,hiddenImageRequests:1,lazyVisibleImages:1,missingImageSpace:1,unprioritizedFirstImage:1,loadedScriptBytes:PERFORMANCE_LIMITS.loadedScriptBytes+1};
  for(const [metric,value] of Object.entries(violations)){
    const evidence=performanceEvidence();Object.assign(evidence.viewports[0].initial,{[metric]:value});const result=evaluatePerformance(evidence);
    assert.equal(result.verdict,'FAIL',metric);assert.ok(result.failures.some(failure=>failure.id.endsWith(':'+metric)&&failure.repair&&failure.message));
    assert.throws(()=>verifyPerformanceEvidence(evidence),{code:'PREVIEW_PERFORMANCE_INVALID'});
    evidence.verdict='FAIL';assert.equal(verifyPerformanceEvidence(evidence).verdict,'FAIL');assert.throws(()=>requirePassingPerformance(evidence),{code:'PREVIEW_PERFORMANCE_FAILED'});
  }
  const interaction=performanceEvidence(['filter']);interaction.viewports[0].interactions[0].feedbackMs=251;assert.equal(evaluatePerformance(interaction).failures[0].code,'INTERACTION_FEEDBACK_BUDGET');
});

test('missing, nonfinite, negative and fractional counts cannot satisfy the performance gate',()=>{
  for(const value of [undefined,NaN,Infinity,-1,0.5]){
    const evidence=performanceEvidence();Object.assign(evidence.viewports[0].initial,{imageRequests:value});assert.equal(evaluatePerformance(evidence).verdict,'INCOMPLETE');
    assert.throws(()=>requirePassingPerformance(evidence),{code:'PREVIEW_PERFORMANCE_INVALID'});
  }
  const missing=performanceEvidence();missing.viewports.pop();missing.verdict='INCOMPLETE';assert.equal(verifyPerformanceEvidence(missing).verdict,'INCOMPLETE');assert.throws(()=>requirePassingPerformance(missing),{code:'PREVIEW_PERFORMANCE_INCOMPLETE'});
  const duplicate=performanceEvidence();duplicate.viewports[1].width=420;assert.equal(evaluatePerformance(duplicate).verdict,'INCOMPLETE');
  const noFeedback=performanceEvidence(['filter']);noFeedback.viewports[0].interactions[0].feedbackMs=null;assert.equal(evaluatePerformance(noFeedback).verdict,'INCOMPLETE');
});

test('performance policy and completed interaction coverage are mandatory',()=>{
  assert.throws(()=>requirePassingPerformance(undefined),{code:'PREVIEW_PERFORMANCE_REQUIRED'});
  for(const change of [{policyVersion:'component-first-screen/0'},{profile:'uncontrolled'},{imageDelayMs:0}])assert.throws(()=>requirePassingPerformance({...performanceEvidence(),...change}),{code:'PREVIEW_PERFORMANCE_POLICY_MISMATCH'});
  assert.throws(()=>requirePassingPerformance(performanceEvidence(),{'420':['filter'],'1040':[]}),{code:'PREVIEW_PERFORMANCE_INVALID'});
  assert.throws(()=>requirePassingPerformance(performanceEvidence(['filter']),{'420':['other'],'1040':['filter']}),{code:'PREVIEW_PERFORMANCE_INVALID'});
});

function signedFixture(t:{after:(fn:()=>void)=>void}) {
  const root=mkdtempSync(join(tmpdir(),'performance-evidence-')),workspace=join(root,'workspace');mkdirSync(join(workspace,'dist'),{recursive:true});writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'dist','index.html'),'<main>Fixture</main>');
  const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence')),source=sources.capture(workspace).source;
  const shot=join(runner.root,'fixture.png');writeFileSync(shot,'synthetic-evidence-file');const screenshot=evidenceFile(shot),at=new Date().toISOString();
  const testPlan=previewTestPlan({noninteractiveReason:'Static evidence-contract fixture',assertions:[{id:'text',selector:'main',check:'text',expected:'Fixture'}]});
  const report={schemaVersion:1 as const,attemptId:'attempt',epoch:1,buildReceiptId:'build-receipt',buildId:source.buildId,protocol:'dsh.apps.component.v2' as const,mode:'fixture' as const,runnerVersion:'dsh-authoring-preview/1',startedAt:at,finishedAt:at,testPlan,viewportResults:[420,1040].map(width=>({id:`width-${width}`,contentWidthCssPx:width,heightCssPx:900,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:[`width-${width}:text`],interactionCaseIds:[],interactiveControlCount:0})),assertionResults:[420,1040].map(width=>({id:`width-${width}:text`,required:true,expected:'Fixture',actual:'Fixture',status:'PASS' as const,evidenceRefs:[]})),performance:performanceEvidence(),verdict:'PASS' as 'PASS'|'FAIL'|'INCOMPLETE'};
  t.after(()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));rmSync(root,{recursive:true,force:true});});
  return {runner,sources,report};
}

test('runner verifies signed performance, rejects legacy/forged PASS, and retains actual failed measurements',t=>{
  const f=signedFixture(t),reference=f.runner.writeReport('preview',f.report);assert.equal(f.runner.verifyPreview(reference,f.sources).performance?.verdict,'PASS');
  const {performance:_,...legacy}=f.report;
  assert.throws(()=>f.runner.verifyPreview(f.runner.writeReport('preview',legacy),f.sources),{code:'PREVIEW_PERFORMANCE_REQUIRED'});
  assert.throws(()=>f.runner.verifyPreview(f.runner.writeReport('preview',{...f.report,performance:{...f.report.performance,policyVersion:'component-first-screen/0'}}),f.sources),{code:'PREVIEW_PERFORMANCE_POLICY_MISMATCH'});
  const failed=structuredClone(f.report);failed.performance.viewports[0].initial.readyMs=10000;
  assert.throws(()=>f.runner.verifyPreview(f.runner.writeReport('preview',failed),f.sources),{code:'PREVIEW_PERFORMANCE_INVALID'});
  failed.performance.verdict='FAIL';failed.verdict='FAIL';assert.equal(f.runner.verifyPreview(f.runner.writeReport('preview',failed),f.sources).performance?.viewports[0].initial.readyMs,10000);
  const envelope=JSON.parse(readFileSync(reference.path,'utf8'));envelope.report.performance.viewports[0].initial.readyMs=0;writeFileSync(reference.path,JSON.stringify(envelope));
  assert.throws(()=>f.runner.verifyPreview(evidenceFile(reference.path),f.sources),/EVIDENCE_RUNNER_ATTESTATION_INVALID/);
});
