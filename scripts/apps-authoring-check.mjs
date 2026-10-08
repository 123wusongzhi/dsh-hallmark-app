import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runAuthoringBuild} from './apps-authoring-build.mjs';
import {runAuthoringPreview} from './apps-authoring-preview.mjs';
import {writeSummary} from './authoring-output.mjs';

/** Only build -> record -> preview -> record. Display and save remain explicit actions. */
export async function runAuthoringCheck(input){
 const request={...input.build,autoRecord:true},output={...request,summaryPath:input.summaryPath};
 let stage='build',build,preview;
 try{
  build=await runAuthoringBuild(request);
  if(build.verdict!=='PASS'){const summary={verdict:'FAIL',stage,build,nextAction:'inspect_build_log'};return {...summary,summaryPath:writeSummary(output,'check',summary)};}
  stage='preview';
  preview=await runAuthoringPreview({...build.previewRequest,...input.preview,...Object.fromEntries(['sessionId','viewId','attemptId','epoch','buildReceiptId','buildReportRef','archiveRoot','evidenceRoot','runtime','autoRecord'].map(key=>[key,build.previewRequest[key]]))});
  const summary={verdict:preview.report.verdict,stage:preview.report.verdict==='PASS'?'complete':'preview',buildId:build.archiveBuildId,buildReceiptId:build.buildReceiptId,previewReceiptId:preview.summary.previewReceiptId??null,reusedBuild:build.reusedBuild,reusedPreview:preview.summary.reusedPreview,buildSummaryPath:build.summaryPath,previewSummaryPath:preview.summaryPath,nextAction:preview.report.verdict==='PASS'?'inspect_or_publish':'inspect_preview_report'};
  return {...summary,summaryPath:writeSummary(output,'check',summary)};
 }catch(error){
  const path=stage==='build'?request.summaryPath??`${request.evidenceRoot}/${request.attemptId}-${request.epoch}-build-summary.json`:`${request.evidenceRoot}/${request.attemptId}-${request.epoch}-preview-summary.json`;
  let detail;try{detail=JSON.parse(readFileSync(path,'utf8'));}catch{}
  writeSummary(output,'check',{verdict:'ERROR',stage:detail?.stage??stage,buildId:build?.archiveBuildId??null,buildSummaryPath:build?.summaryPath??null,nextAction:detail?.nextAction??'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one check request JSON path.');
 const result=await runAuthoringCheck(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify(result));process.exitCode=result.verdict==='PASS'?0:result.verdict==='INCOMPLETE'?2:1;
}
