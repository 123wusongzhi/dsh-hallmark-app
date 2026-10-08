import {SourceComponentStore} from '../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../packages/source-components/src/authoring-evidence.ts';
import {readFileSync} from 'node:fs';
const args=process.argv.slice(2);
if(args.length!==1)throw new Error('Provide one build request JSON path with attemptId, epoch, sourceRevision, workspacePath, command[], evidenceRoot, archiveRoot.');
const input=JSON.parse(readFileSync(args[0],'utf8')),runner=new AuthoringEvidenceRunner(input.evidenceRoot),sources=new SourceComponentStore(input.archiveRoot);
const onStart=input.runtime?async()=>{
 const url=new URL(input.runtime.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw new Error('BUILD_RUNTIME_LOCAL_ONLY');
 const response=await fetch(new URL('/v1/authoring/markBuilding',url),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},body:JSON.stringify({sessionId:input.sessionId,params:{attemptId:input.attemptId,epoch:input.epoch}})});
 if(!response.ok)throw new Error('BUILD_STAGE_REJECTED:'+response.status);const result=await response.json();if(result.state!=='building')throw new Error('BUILD_STAGE_REJECTED');
}:undefined;
const buildStarted=performance.now();
const result=await runner.build({...input,sources,onStart});console.log(JSON.stringify({reportRef:result.reportRef,verdict:result.report.verdict,archiveBuildId:result.report.archiveBuildId,buildMs:Math.round(performance.now()-buildStarted)}));
if(result.report.verdict!=='PASS')process.exitCode=1;
