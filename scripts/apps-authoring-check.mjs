import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runAuthoringBuild} from './apps-authoring-build.mjs';
import {runAuthoringPreview} from './apps-authoring-preview.mjs';
import {writeSummary} from './authoring-output.mjs';

import {inspectAttempt} from './authoring-resume.mjs';

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
 const request={...input.build,autoRecord:true},output={...request,summaryPath:input.summaryPath};
 let stage='plan',build,preview;
 try{
  const plan=input.preview?.planPath?JSON.parse(readFileSync(input.preview.planPath,'utf8')):{};
  stage='build';
  build=await runAuthoringBuild(request);
  if(build.verdict!=='PASS'){const summary={verdict:'FAIL',stage,build,nextAction:'inspect_build_log'};return {...summary,summaryPath:writeSummary(output,'check',summary)};}
  stage='preview';
  preview=await runAuthoringPreview({...build.previewRequest,...plan,...input.preview,...Object.fromEntries(['sessionId','viewId','attemptId','epoch','buildReceiptId','buildReportRef','archiveRoot','evidenceRoot','runtime','autoRecord'].map(key=>[key,build.previewRequest[key]]))});
  const summary={verdict:preview.report.verdict,stage:preview.report.verdict==='PASS'?'complete':'preview',buildId:build.archiveBuildId,buildReceiptId:build.buildReceiptId,previewReceiptId:preview.summary.previewReceiptId??null,verifiedAt:preview.summary.verifiedAt,viewports:preview.summary.viewports,failures:preview.summary.failures,reusedBuild:build.reusedBuild,reusedPreview:preview.summary.reusedPreview,buildSummaryPath:build.summaryPath,previewSummaryPath:preview.summaryPath,nextAction:preview.report.verdict==='PASS'?'inspect_or_publish':'inspect_preview_report'};
  return {...summary,summaryPath:writeSummary(output,'check',summary)};
 }catch(error){
  let detail;try{detail=JSON.parse(readFileSync(error.summaryPath,'utf8'));}catch{}
  error.summaryPath=writeSummary(output,'check',{verdict:'ERROR',stage:detail?.stage??stage,buildId:build?.archiveBuildId??null,buildSummaryPath:build?.summaryPath??null,nextAction:detail?.nextAction??'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one check request JSON path.');
 try{const result=await runAuthoringCheck(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify(result));process.exitCode=result.verdict==='PASS'?0:result.verdict==='INCOMPLETE'?2:1;}catch(error){console.log(JSON.stringify({verdict:'ERROR',summaryPath:error.summaryPath??null,error:{code:error.code??null,message:error.message}}));process.exitCode=1;}
}
