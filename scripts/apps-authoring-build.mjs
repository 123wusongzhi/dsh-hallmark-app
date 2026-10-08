import {checkpoint,buildFingerprint,inspectAttempt,newAttemptRequired} from './authoring-resume.mjs';
import {SourceComponentStore} from '../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../packages/source-components/src/authoring-evidence.ts';
import {readFileSync,writeFileSync} from 'node:fs';
import {recordEvidence,writeSummary} from './authoring-output.mjs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function runAuthoringBuild(input){
let stage='build',summary;
try{
const runner=new AuthoringEvidenceRunner(input.evidenceRoot),sources=new SourceComponentStore(input.archiveRoot);
const onStart=input.runtime?async()=>{
 const url=new URL(input.runtime.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('BUILD_RUNTIME_LOCAL_ONLY');
 const response=await fetch(new URL('/v1/authoring/markBuilding',url),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:input.sessionId,params:{attemptId:input.attemptId,epoch:input.epoch}})});
 if(!response.ok)throw new Error('BUILD_STAGE_REJECTED:'+response.status);const result=await response.json();if(result.state!=='building')throw new Error('BUILD_STAGE_REJECTED');
}:undefined;
const buildStarted=performance.now();
const key=buildFingerprint(input),previous=checkpoint(input,'build');
let result,reused=false;
if(previous?.result.report.verdict==='PASS'){
 if(previous.key!==key)throw newAttemptRequired();
 try{const report=runner.verifyBuild(previous.result.reportRef,sources);if(report.attemptId!==input.attemptId||report.epoch!==input.epoch||report.sourceRevision!==input.sourceRevision)throw newAttemptRequired();}catch(error){if(error.message==='BUILD_INPUT_CHANGED')throw newAttemptRequired();throw error;}
 await inspectAttempt(input);result=previous.result;reused=true;
}else{result=await runner.build({...input,sources,onStart});checkpoint(input,'build',{key,result});}

summary={reusedBuild:reused,reportRef:result.reportRef,verdict:result.report.verdict,archiveBuildId:result.report.archiveBuildId,buildMs:Math.round(performance.now()-buildStarted)};
if(input.autoRecord&&summary.verdict==='PASS'){
 stage='record_build';const receipt=await recordEvidence(input,'build',result.reportRef);summary.buildReceiptId=receipt.receiptId;
 summary.previewRequest={sessionId:input.sessionId,viewId:input.viewId,attemptId:input.attemptId,epoch:input.epoch,buildReceiptId:receipt.receiptId,buildReportRef:result.reportRef,archiveRoot:input.archiveRoot,evidenceRoot:input.evidenceRoot,runtime:input.runtime,mode:'live_readonly',autoRecord:true,requiredMethods:['getData']};
 summary.previewRequestPath=join(input.evidenceRoot,`${input.attemptId}-${input.epoch}-preview-request.json`);
 writeFileSync(summary.previewRequestPath,JSON.stringify(summary.previewRequest,null,2)+'\n');
}
summary.stage=summary.verdict==='PASS'?'complete':'build';summary.nextAction=summary.verdict==='PASS'?'run_preview':'inspect_build_log';
summary.summaryPath=writeSummary(input,'build',summary);return summary;
}catch(error){writeSummary(input,'build',{...summary,verdict:'ERROR',stage,nextAction:stage==='record_build'?'retry_same_request':error.code==='NEW_ATTEMPT_REQUIRED'?'begin_new_attempt':'inspect_evidence',error:{code:error.code??null,message:error.message}});throw error;}
}
if(process.argv[1]&&/apps-authoring-build\.(mjs|js)$/.test(process.argv[1])&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw new Error('Provide one build request JSON path.');
 const input=JSON.parse(readFileSync(process.argv[2],'utf8'));const result=await runAuthoringBuild(input);console.log(JSON.stringify(result));if(result.verdict!=='PASS')process.exitCode=1;
}
