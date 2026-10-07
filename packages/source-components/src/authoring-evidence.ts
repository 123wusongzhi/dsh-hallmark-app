import {createHash, createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {SourceComponentStore} from './index.ts';
import type {PreviewValidationEvidence} from '../../app-presentation/src/authoring-types.ts';
import {previewTestPlan} from './authoring-preview-plan.ts';
import type {PreviewTestPlan} from './authoring-preview-plan.ts';

export interface EvidenceFile {path:string;sha256:string;bytes:number}
export interface BuildExecutionReport {
  schemaVersion:1; runnerVersion:'dsh-authoring-build/1'; attemptId:string; epoch:number; sourceRevision:number;
  workspacePath:string; sourceInputDigest:string; sourceInputDigestAfter:string; lockfileDigest:string;
  command:string[]; cwd:string; toolchain:Record<string,string>; exitCode:number; startedAt:string; finishedAt:string;
  logRef:EvidenceFile; distDigest:string|null; archiveBuildId:string|null; fileManifestRef:EvidenceFile|null;
  inputUnchanged:boolean; verdict:'PASS'|'FAIL'; executionId:string;
}
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const ignored=new Set(['node_modules','.git','.preview','dist']);
function files(root:string, current=root):string[] {
  return readdirSync(current,{withFileTypes:true}).flatMap(entry=>{
    if(ignored.has(entry.name))return [];
    const path=join(current,entry.name);
    if(entry.isSymbolicLink())throw new Error('SOURCE_INPUT_SYMLINK');
    return entry.isDirectory()?files(root,path):entry.isFile()?[relative(root,path).split(sep).join('/')]:[];
  }).sort();
}
export function sourceInputDigest(directory:string):string {
  const root=realpathSync(directory), hash=createHash('sha256');
  for(const path of files(root)){const bytes=readFileSync(join(root,path));hash.update(`${Buffer.byteLength(path)}:${path}:${bytes.length}:`).update(bytes);}
  return hash.digest('hex');
}
export function distDigest(sources:SourceComponentStore, buildId:string):string {
  const manifest=sources.manifest(buildId);if(!manifest)throw new Error('SOURCE_BUILD_NOT_FOUND');
  const hash=createHash('sha256');
  for(const path of [...manifest.files].sort()){const file=sources.readFile(buildId,path);if(!file)throw new Error('SOURCE_BUILD_INCOMPLETE');hash.update(`${Buffer.byteLength(path)}:${path}:${file.bytes.length}:`).update(file.bytes);}
  return hash.digest('hex');
}
export function evidenceFile(path:string):EvidenceFile {const bytes=readFileSync(path);return {path:resolve(path),sha256:sha(bytes),bytes:bytes.length};}
export function verifyEvidenceFile(root:string, reference:EvidenceFile):Buffer {
  const base=realpathSync(root),path=resolve(reference.path),rel=relative(base,path);
  if(!rel||isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)||lstatSync(path).isSymbolicLink()||!realpathSync(path).startsWith(base+sep))throw new Error('EVIDENCE_PATH_INVALID');
  const bytes=readFileSync(path);if(bytes.length!==reference.bytes||sha(bytes)!==reference.sha256)throw new Error('EVIDENCE_HASH_MISMATCH');return bytes;
}
/** Runner attestation separates actual process output from a caller-supplied PASS JSON. */
export class AuthoringEvidenceRunner {
  readonly root:string;
  private key:Buffer;
  private resolvePath:(path:string)=>string;
  constructor(root:string,options:{resolvePath?:(path:string)=>string}={}){
    this.root=resolve(root);mkdirSync(this.root,{recursive:true});
    this.resolvePath=options.resolvePath??resolve;
    const keyPath=join(this.root,'.runner-key');
    if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{flag:'wx',mode:0o600});
    this.key=readFileSync(keyPath);if(this.key.length!==32)throw new Error('RUNNER_KEY_INVALID');
  }
  private verifyFile(reference:EvidenceFile):Buffer {return verifyEvidenceFile(this.root,{...reference,path:this.resolvePath(reference.path)});}
  writeReport(kind:'build'|'preview',report:unknown):EvidenceFile {
    const payload=canonicalJson(report),signature=createHmac('sha256',this.key).update(payload).digest('hex');
    const path=join(this.root,`${kind}-${randomUUID()}.json`);writeFileSync(path,JSON.stringify({report,signature},null,2),{flag:'wx',mode:0o600});return evidenceFile(path);
  }
  readReport<T>(reference:EvidenceFile):T {
    const envelope=JSON.parse(this.verifyFile(reference).toString('utf8'));
    const signature=createHmac('sha256',this.key).update(canonicalJson(envelope.report)).digest();
    const actual=Buffer.from(String(envelope.signature),'hex');
    if(actual.length!==signature.length||!timingSafeEqual(actual,signature))throw new Error('EVIDENCE_RUNNER_ATTESTATION_INVALID');return envelope.report as T;
  }
  private cancelPath(attemptId:string,epoch:number):string {return join(this.root,`cancel-${sha(canonicalJson([attemptId,epoch]))}.json`);}
  cancel(attemptId:string,epoch:number):void {
    if(!attemptId||!Number.isSafeInteger(epoch)||epoch<1)throw new Error('BUILD_INPUT_INVALID');
    const path=this.cancelPath(attemptId,epoch);if(existsSync(path)){this.readReport(evidenceFile(path));return;}
    const report={attemptId,epoch,cancelledAt:new Date().toISOString()},signature=createHmac('sha256',this.key).update(canonicalJson(report)).digest('hex');
    writeFileSync(path,JSON.stringify({report,signature}),{flag:'wx',mode:0o600});
  }
  private cancelled(attemptId:string,epoch:number):boolean {
    const path=this.cancelPath(attemptId,epoch);if(!existsSync(path))return false;
    const report=this.readReport<{attemptId:string;epoch:number}>(evidenceFile(path));if(report.attemptId!==attemptId||report.epoch!==epoch)throw new Error('CANCEL_IDENTITY_INVALID');return true;
  }
  async build(input:{attemptId:string;epoch:number;sourceRevision:number;workspacePath:string;command:string[];sources:SourceComponentStore;signal?:AbortSignal;timeoutMs?:number;onStart?:()=>Promise<void>|void}):Promise<{report:BuildExecutionReport;reportRef:EvidenceFile}> {
    if(!input.attemptId||!Number.isSafeInteger(input.epoch)||!Number.isSafeInteger(input.sourceRevision)||!Array.isArray(input.command)||!input.command.length||input.command.some(part=>typeof part!=='string'||!part))throw new Error('BUILD_INPUT_INVALID');
    const cwd=realpathSync(input.workspacePath);if(relative(this.root,cwd)===''||this.root.startsWith(cwd+sep))throw new Error('EVIDENCE_MUST_BE_OUTSIDE_WORKSPACE');
    const before=sourceInputDigest(cwd),locks=['package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock'].filter(path=>existsSync(join(cwd,path)));
    if(locks.length!==1)throw new Error('EXACT_LOCKFILE_REQUIRED');
    const lockfileDigest=sha(readFileSync(join(cwd,locks[0]))),startedAt=new Date().toISOString(),executionId=randomUUID();
    const logs:Buffer[]=[];let exitCode=-1;
    const cancellation=new AbortController(),timeout=AbortSignal.timeout(input.timeoutMs??120000),signal=AbortSignal.any([cancellation.signal,timeout,...(input.signal?[input.signal]:[])]);
    const poll=()=>{try{if(this.cancelled(input.attemptId,input.epoch))cancellation.abort(new Error('AUTHORING_CANCELLED'));}catch(error){cancellation.abort(error);}};
    poll();const cancellationTimer=setInterval(poll,100);
    try {
      await input.onStart?.();signal.throwIfAborted();
      exitCode=await new Promise<number>((accept,reject)=>{
        const child=spawn(input.command[0],input.command.slice(1),{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
        let stopping=false;
        const abort=()=>{if(stopping||!child.pid||child.exitCode!==null)return;stopping=true;logs.push(Buffer.from('\nRunner cancelled this owned build process.\n'));
          // Only the process just spawned by this runner is stopped, including its build-tool children.
          if(process.platform==='win32'){const terminator=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});terminator.once('error',()=>child.kill());}
          else child.kill('SIGTERM');
        };
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
        child.stdout.on('data',bytes=>logs.push(Buffer.from(bytes)));child.stderr.on('data',bytes=>logs.push(Buffer.from(bytes)));
        child.once('error',error=>{signal.removeEventListener('abort',abort);logs.push(Buffer.from(String(error)));reject(error);});
        child.once('close',code=>{signal.removeEventListener('abort',abort);accept(stopping?-1:code??-1);});
      });
    }catch(error){logs.push(Buffer.from(`\nRunner: ${error instanceof Error?error.message:String(error)}\n`));}finally{clearInterval(cancellationTimer);}
    if(signal.aborted||this.cancelled(input.attemptId,input.epoch))exitCode=-1;
    const after=sourceInputDigest(cwd),inputUnchanged=before===after;
    const logPath=join(this.root,`build-${executionId}.log`);
    let archiveBuildId:string|null=null,dist:string|null=null,fileManifestRef:EvidenceFile|null=null;
    if(exitCode===0&&inputUnchanged){
      try{const capture=input.sources.capture(cwd);archiveBuildId=capture.source.buildId;if(!input.sources.verify(archiveBuildId).valid)throw new Error('ARCHIVE_VERIFICATION_FAILED');dist=distDigest(input.sources,archiveBuildId);const path=join(this.root,`manifest-${executionId}.json`);writeFileSync(path,JSON.stringify(input.sources.manifest(archiveBuildId),null,2),{flag:'wx'});fileManifestRef=evidenceFile(path);}catch(error){logs.push(Buffer.from(String(error)));archiveBuildId=null;dist=null;}
    }
    const finishedAt=new Date().toISOString();writeFileSync(logPath,Buffer.concat(logs),{flag:'wx'});
    const report:BuildExecutionReport={schemaVersion:1,runnerVersion:'dsh-authoring-build/1',attemptId:input.attemptId,epoch:input.epoch,sourceRevision:input.sourceRevision,workspacePath:cwd,sourceInputDigest:before,sourceInputDigestAfter:after,lockfileDigest,command:[...input.command],cwd,toolchain:{node:process.version,platform:process.platform,architecture:process.arch},exitCode,startedAt,finishedAt,logRef:evidenceFile(logPath),distDigest:dist,archiveBuildId,fileManifestRef,inputUnchanged,verdict:exitCode===0&&inputUnchanged&&archiveBuildId?'PASS':'FAIL',executionId};
    return {report,reportRef:this.writeReport('build',report)};
  }
  verifyBuild(reference:EvidenceFile, sources:SourceComponentStore, options:{allowFailure?:boolean}={}):BuildExecutionReport {
    const report=this.readReport<BuildExecutionReport>(reference);
    if(report.runnerVersion!=='dsh-authoring-build/1'||report.schemaVersion!==1)throw new Error('BUILD_EVIDENCE_INVALID');
    this.verifyFile(report.logRef);
    if(options.allowFailure&&report.verdict==='FAIL')return report;
    if(report.verdict!=='PASS'||report.exitCode!==0||!report.inputUnchanged||report.sourceInputDigest!==report.sourceInputDigestAfter||!report.archiveBuildId||!report.fileManifestRef||!sources.verify(report.archiveBuildId).valid)throw new Error('BUILD_EVIDENCE_INVALID');
    if(sourceInputDigest(this.resolvePath(report.cwd))!==report.sourceInputDigest)throw new Error('BUILD_INPUT_CHANGED');
    if(distDigest(sources,report.archiveBuildId)!==report.distDigest)throw new Error('BUILD_ARCHIVE_MISMATCH');
    const manifest=JSON.parse(this.verifyFile(report.fileManifestRef).toString('utf8'));
    if(canonicalJson(manifest)!==canonicalJson(sources.manifest(report.archiveBuildId)))throw new Error('BUILD_MANIFEST_MISMATCH');return report;
  }
  verifyPreview(reference:EvidenceFile,sources:SourceComponentStore):PreviewValidationEvidence {
    const report=this.readReport<Omit<PreviewValidationEvidence,'viewportResults'>&{testPlan?:PreviewTestPlan;viewportResults:(PreviewValidationEvidence['viewportResults'][number]&{interactionCaseIds?:string[];interactiveControlCount?:number})[]}>(reference);
    if(report.runnerVersion!=='dsh-authoring-preview/1'||report.schemaVersion!==1||report.protocol!=='dsh.apps.component.v2'||!['fixture','live_readonly'].includes(report.mode)||!sources.verify(report.buildId).valid)throw new Error('PREVIEW_BUILD_MISMATCH');
    if(!Array.isArray(report.viewportResults)||!Array.isArray(report.assertionResults))throw new Error('PREVIEW_INCOMPLETE');
    for(const view of report.viewportResults){this.verifyFile(view.screenshot);if(!Array.isArray(view.assertionIds)||view.assertionIds.some(id=>!report.assertionResults.some(assertion=>assertion.id===id)))throw new Error('PREVIEW_INCOMPLETE');}
    for(const assertion of report.assertionResults)for(const file of assertion.evidenceRefs)this.verifyFile(file);
    if(report.verdict==='PASS'){
      const plan=report.testPlan,validated=previewTestPlan({assertions:plan?.cases,...(plan?.mode==='noninteractive'?{noninteractiveReason:plan.reason}:{})});
      if(!plan||plan.version!==1||plan.errors.length||validated.errors.length||canonicalJson(plan)!==canonicalJson(validated))throw new Error('PREVIEW_INCOMPLETE');
      if(![420,1040].every(width=>report.viewportResults.some(view=>view.contentWidthCssPx===width&&view.deviceScaleFactor===1&&view.bridgeReady&&!view.pageErrors.length&&!view.unhandledRejections.length&&!view.failedRequests.length&&Number.isSafeInteger(view.interactiveControlCount)&&Number(view.interactiveControlCount)>=0&&(plan.mode!=='noninteractive'||view.interactiveControlCount===0)&&plan.cases.every(item=>report.assertionResults.some(assertion=>assertion.id===`${view.id}:${item.id}`&&assertion.required===(item.required!==false)&&(item.required===false||assertion.status==='PASS'))&&(!item.action||view.interactionCaseIds?.includes(item.id)))))||report.assertionResults.some(assertion=>assertion.required&&assertion.status!=='PASS'))throw new Error('PREVIEW_EVIDENCE_INVALID');
    }
    return report;
  }
}
