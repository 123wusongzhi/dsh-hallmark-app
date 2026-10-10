import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {SourceComponentStore} from '../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,buildReuseSignature} from '../packages/source-components/src/authoring-evidence.ts';
import {runAuthoringBuild} from './apps-authoring-build.mjs';
import {runAuthoringPreview} from './apps-authoring-preview.mjs';
import {writeSummary} from './authoring-output.mjs';

import {inspectAttempt,checkpoint,fingerprint,buildFingerprint,newAttemptRequired} from './authoring-resume.mjs';

/** An explicit retry gets an actual new Runtime generation; repeat the same retryId to resume that generation. */
async function prepareStageRetry(input){
 const original=input.build;
 if(!['build','preview'].includes(input.retryStage)||typeof input.retryId!=='string'||!input.retryId.trim()||input.retryId.length>128)throw Object.assign(new Error('retryStage requires build or preview and a distinct nonempty retryId (repeat it only to resume).'),{code:'RETRY_INPUT_INVALID'});
 if(!original.runtime)throw new Error('RETRY_RUNTIME_REQUIRED');
 const runtimeUrl=new URL(original.runtime.url);if(runtimeUrl.protocol!=='http:'||runtimeUrl.hostname!=='127.0.0.1')throw new Error('BUILD_RUNTIME_LOCAL_ONLY');
 if(input.preview?.validationProfile==='draft')throw new Error('RETRY_FORMAL_ONLY');
 const previewPlan=input.preview?.planPath?JSON.parse(readFileSync(input.preview.planPath,'utf8')):{};
 if(previewPlan.validationProfile==='draft')throw new Error('RETRY_FORMAL_ONLY');
 const checkpointStage='retry:'+input.retryId,requestKey=fingerprint({stage:input.retryStage,buildKey:buildFingerprint(original),preview:input.preview??{},previewPlan});
 let saved=checkpoint(original,checkpointStage);
 if(saved&&saved.requestKey!==requestKey)throw Object.assign(new Error('This retryId already identifies different inputs. Use another explicit retryId.'),{code:'RETRY_REQUEST_CONFLICT'});
 if(!saved){
  const state=await inspectAttempt(original);
  if(!state||state.attempt.publicationId||!['build_failed','preview_failed','previewing'].includes(state.attempt.state))throw Object.assign(new Error('Retry requires a failed build or failed/incomplete preview before publication.'),{code:'RETRY_STATE_INVALID'});
  const runner=new AuthoringEvidenceRunner(original.evidenceRoot),sources=new SourceComponentStore(original.archiveRoot),priorBuild=checkpoint(original,'build');
  if(!priorBuild?.result?.reportRef)throw new Error('RETRY_BUILD_REPORT_REQUIRED');
  const built=runner.verifyBuild(priorBuild.result.reportRef,sources,{allowFailure:input.retryStage==='build'});
  if(built.attemptId!==original.attemptId||built.epoch!==original.epoch||built.sourceRevision!==original.sourceRevision)throw new Error('RETRY_BUILD_MISMATCH');
  let priorPreview;
  if(input.retryStage==='build'){
   if(built.verdict!=='FAIL')throw new Error('RETRY_BUILD_NOT_FAILED');
  }else{
   priorPreview=checkpoint(original,'preview');
   if(!priorPreview?.result?.reportRef)throw new Error('RETRY_PREVIEW_REPORT_REQUIRED');
   const tested=runner.verifyPreview(priorPreview.result.reportRef,sources);
   if(tested.attemptId!==original.attemptId||tested.epoch!==original.epoch||tested.buildId!==built.archiveBuildId||tested.buildReceiptId!==state.attempt.buildReceiptId||tested.verdict==='PASS')throw new Error('RETRY_PREVIEW_NOT_FAILED');
   // The runner-signed key is authoritative; the editable checkpoint alone cannot approve reuse.
   if(priorBuild.key!==buildFingerprint(original)||built.reuseInput?.key!==buildReuseSignature(original).key)throw newAttemptRequired();
  }
  saved={requestKey,retryStage:input.retryStage,retryId:input.retryId,attemptId:'retry-'+fingerprint([original.sessionId,original.attemptId,original.epoch,input.retryId]),viewId:state.view.viewId,workspacePath:state.draft.workspacePath,previousAttemptId:original.attemptId,previousBuildReportRef:priorBuild.result.reportRef,previousPreviewReportRef:priorPreview?.result.reportRef??null};
  checkpoint(original,checkpointStage,saved);
 }
 const response=await fetch(new URL('/v1/presentation-actions',original.runtime.url),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+readFileSync(original.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:original.sessionId,requestId:randomUUID(),capabilityId:'apps.authoring.begin',input:{mode:'edit',viewId:saved.viewId,workspacePath:saved.workspacePath,attemptId:saved.attemptId}}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok||result.status!=='ok')throw Object.assign(new Error(result.error?.message??'Retry begin failed'),{code:result.error?.code??'RETRY_BEGIN_FAILED'});
 const {attempt,draft,view}=result.data;
 if(attempt.attemptId!==saved.attemptId||view.viewId!==saved.viewId||draft.workspacePath!==saved.workspacePath)throw new Error('RETRY_IDENTITY_MISMATCH');
 const build={...original,attemptId:attempt.attemptId,epoch:attempt.epoch,sourceRevision:attempt.sourceRevision,workspacePath:draft.workspacePath,viewId:view.viewId,...(input.retryStage==='preview'?{reuseBuildReportRef:saved.previousBuildReportRef}:{})};
 const retry={retryStage:input.retryStage,retryId:input.retryId,previousAttemptId:saved.previousAttemptId,attemptId:attempt.attemptId,epoch:attempt.epoch,previousBuildReportRef:saved.previousBuildReportRef,previousPreviewReportRef:saved.previousPreviewReportRef};
 const requestPath=join(build.evidenceRoot,`${attempt.attemptId}-${attempt.epoch}-retry-request.json`);writeFileSync(requestPath,JSON.stringify({build,preview:input.preview??{}},null,2)+'\n');
 return {...input,build,retry,retryRequestPath:requestPath};
}

// Resolve identities together from the explicitly selected current attempt.
export async function prepareAuthoringCheck(input){
 const state=await inspectAttempt(input.build);
 if(!state)throw new Error('PREPARE_RUNTIME_REQUIRED');
 const {attempt,draft,view}=state;
 const build={...input.build,attemptId:attempt.attemptId,epoch:attempt.epoch,sourceRevision:attempt.sourceRevision,viewId:view.viewId,workspacePath:draft.workspacePath};
 const preview={...(input.preview?.assertions===undefined?{planPath:join(draft.workspacePath,'.preview','plan.json')}:{}),...input.preview};
 mkdirSync(build.evidenceRoot,{recursive:true});
 const requestPath=join(build.evidenceRoot,`${attempt.attemptId}-${attempt.epoch}-check-request.json`);
 writeFileSync(requestPath,JSON.stringify({build,preview},null,2)+'\n');
 return {verdict:'PASS',stage:'prepared',requestPath,attemptId:attempt.attemptId,epoch:attempt.epoch,sourceRevision:attempt.sourceRevision};
}

/** Only build -> record -> preview -> record. Display and save remain explicit actions. */
export async function runAuthoringCheck(input){
 if(input.prepare)return prepareAuthoringCheck(input);
 if(input.retryStage!==undefined){try{input=await prepareStageRetry(input);}catch(error){error.summaryPath=writeSummary(input.build,'check',{verdict:'ERROR',stage:'retry',retryStage:input.retryStage,retryId:input.retryId,nextAction:'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;}}
 const request={...input.build,autoRecord:true},output={...request,summaryPath:input.summaryPath},summaryStage=input.preview?.validationProfile==='draft'?'check-draft':'check';
 let stage='plan',build,preview;
 try{
  const plan=input.preview?.planPath?JSON.parse(readFileSync(input.preview.planPath,'utf8')):{};
  stage='build';
  build=await runAuthoringBuild(request);
  if(build.verdict!=='PASS'){const summary={verdict:'FAIL',stage,attemptId:request.attemptId,epoch:request.epoch,retry:input.retry??null,retryRequestPath:input.retryRequestPath??null,build,nextAction:'inspect_build_log'};return {...summary,summaryPath:writeSummary(output,summaryStage,summary)};}
  stage='preview';
  preview=await runAuthoringPreview({...build.previewRequest,...plan,...input.preview,...Object.fromEntries(['sessionId','viewId','attemptId','epoch','buildReceiptId','buildReportRef','archiveRoot','evidenceRoot','runtime','autoRecord'].map(key=>[key,build.previewRequest[key]])),...(input.preview?.validationProfile==='draft'?{autoRecord:false}:{})});
  const summary={verdict:preview.report.verdict,stage:preview.summary.validationProfile==='draft'?'draft':preview.report.verdict==='PASS'?'complete':'preview',attemptId:request.attemptId,epoch:request.epoch,retry:input.retry??null,retryRequestPath:input.retryRequestPath??null,buildId:build.archiveBuildId,buildReceiptId:build.buildReceiptId,previewReceiptId:preview.summary.previewReceiptId??null,verifiedAt:preview.summary.verifiedAt,viewports:preview.summary.viewports,failures:preview.summary.failures,reusedBuild:build.reusedBuild,reusedPreview:preview.summary.reusedPreview,buildSummaryPath:build.summaryPath,previewSummaryPath:preview.summaryPath,nextAction:preview.summary.nextAction};
  return {...summary,summaryPath:writeSummary(output,summaryStage,summary)};
 }catch(error){
  let detail;try{detail=JSON.parse(readFileSync(error.summaryPath,'utf8'));}catch{}
  error.summaryPath=writeSummary(output,summaryStage,{verdict:'ERROR',stage:detail?.stage??stage,buildId:build?.archiveBuildId??null,buildSummaryPath:build?.summaryPath??null,nextAction:detail?.nextAction??'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one check request JSON path.');
 try{const result=await runAuthoringCheck(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify(result));process.exitCode=result.verdict==='PASS'?0:result.verdict==='INCOMPLETE'?2:1;}catch(error){console.log(JSON.stringify({verdict:'ERROR',summaryPath:error.summaryPath??null,error:{code:error.code??null,message:error.message}}));process.exitCode=1;}
}
