import {inspectAttempt} from './authoring-resume.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function writeSummary(input,stage,summary){
 const path=input.summaryPath??join(input.evidenceRoot,`${input.attemptId}-${input.epoch}-${stage}-summary.json`);
 mkdirSync(input.evidenceRoot,{recursive:true});
 writeFileSync(path,JSON.stringify({attemptId:input.attemptId,epoch:input.epoch,...summary},null,2)+'\n');
 return path;
}
export async function recordEvidence(input,stage,reportRef){
 const state=await inspectAttempt(input),receiptId=state?.attempt?.[stage==='build'?'buildReceiptId':'previewReceiptId'];
 if(receiptId){if(!state.attempt.evidenceRefs.some(ref=>ref.sha256===reportRef.sha256))throw Object.assign(new Error('Another immutable report is already registered; inspect before continuing.'),{code:'RECEIPT_CONFLICT'});return {receiptId};}

 const response=await fetch(new URL('/v1/presentation-actions',input.runtime.url),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:input.sessionId,requestId:randomUUID(),capabilityId:`apps.authoring.record_${stage}`,input:{attemptId:input.attemptId,epoch:input.epoch,...(stage==='preview'?{buildReceiptId:input.buildReceiptId}:{}),reportRef}}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok||result.status!=='ok')throw Object.assign(new Error(result.error?.message??`Record ${stage} failed: ${response.status}`),{code:result.error?.code});
 return result.data;
}
export function previewSummary(result){
 const report=result.report;
 return {verdict:report.verdict,reportRef:result.reportRef,buildId:report.buildId,buildReceiptId:report.buildReceiptId,timings:result.diagnostics.timings,diagnosticsPath:result.diagnosticsPath,
  failures:report.assertionResults.filter(item=>item.status!=='PASS').map(({id,status,required,expected,actual})=>({id,status,required,expected,actual})),
  testPlanErrors:report.testPlan.errors,
  viewports:report.viewportResults.map(view=>({id:view.id,screenshot:view.screenshot.path,pageErrors:view.pageErrors,unhandledRejections:view.unhandledRejections,failedRequests:view.failedRequests}))};
}
