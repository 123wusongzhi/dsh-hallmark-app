import {authoringSummary,AWAITABLE_OUTCOMES} from './authoring-summary.ts';
import {AWAIT_DISPLAY_DEFAULT_MS,AWAIT_DISPLAY_MAX_MS,DISPLAY_READY_DEADLINE_MS} from './authoring-types.ts';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readdirSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityResult,ExecutionContext,JsonValue,ResourceRef} from '../../app-contracts/src/index.ts';
import {distDigest} from '../../source-components/src/authoring-evidence.ts';
import {FileVerificationCache,regularFilePathIdentity} from '../../source-components/src/file-verification-cache.ts';
import {requirePassingPerformance,verifyPerformanceEvidence,type PerformanceEvaluation} from '../../source-components/src/authoring-performance.ts';
import {queryRows} from './store-query.ts';
import {VerifiedDisplayCache} from './verified-displays.ts';
import type {AppsComponent,AppsView} from './types.ts';
import type {AppsAuthoringOptions,AwaitDisplayInput,AuthoringAssertion,AuthoringAttempt,AuthoringAttemptInput,AuthoringDraft,AuthoringState,AuthoringView,BeginAuthoringInput,BuildExecutionEvidence,BuildReceipt,CandidateFrameIdentity,ComponentDisplay,DisplayError,DisplayFrameAuthorizationInput,FileEvidenceRef,FrameAuthorizationInput,ManageAuthoringComponentInput,OpenDisplayInput,PreviewReceipt,PreviewValidationEvidence,PublishAuthoringInput,RecordBuildInput,RecordPreviewInput,RenderReadyInput,ReportDisplayErrorInput,SaveAuthoringInput,StartMountInput,UiStateExportInput,UiStateRestoreInput,UiStateSnapshot,ViewPublication} from './authoring-types.ts';
export * from './authoring-types.ts';

export class AuthoringError extends Error {
  readonly code:string;
  constructor(code:string,message:string){super(message);this.name='AuthoringError';this.code=code;}
}
function fail(code:string,message:string):never {throw new AuthoringError(code,message);}
function required(value:unknown,name:string):string {if(typeof value!=='string'||!value.trim())fail('INVALID_INPUT',`${name} is required.`);return value;}
function integer(value:unknown,name:string,minimum=1):number {if(!Number.isSafeInteger(value)||Number(value)<minimum)fail('INVALID_INPUT',`${name} must be an integer >= ${minimum}.`);return Number(value);}
const clone=<T>(value:T):T=>structuredClone(value);
const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
interface DisplayTarget {publication:ViewPublication;attempt:AuthoringAttempt;draft:AuthoringDraft;current:AuthoringView;view:AuthoringView}
const running=new Set<AuthoringState>(['building','previewing','mounting']);
const terminal=new Set<AuthoringState>(['mounted','cancelled','superseded','interrupted']);
function dates(start:string,end:string):void {if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<Date.parse(start))fail('BUILD_EVIDENCE_INVALID','Evidence requires ordered ISO dates.');}
function assertions(value:AuthoringAssertion[]):boolean {
  if(!Array.isArray(value)||!value.length||new Set(value.map(item=>item.id)).size!==value.length)fail('PREVIEW_INCOMPLETE','Assertions require unique IDs and an explicit coverage list.');
  for(const item of value){required(item.id,'assertion.id');required(item.expected,'assertion.expected');if(typeof item.required!=='boolean'||!['PASS','FAIL','NOT_RUN','BLOCKED'].includes(item.status)||!(item.actual===null||typeof item.actual==='string')||!Array.isArray(item.evidenceRefs))fail('PREVIEW_INCOMPLETE','Invalid assertion result.');if(item.status==='PASS'&&item.actual===null)fail('PREVIEW_INCOMPLETE','PASS needs an observed actual result.');}
  return value.some(item=>item.required)&&value.filter(item=>item.required).every(item=>item.status==='PASS');
}

/** P2 metadata only. Original DSH tools edit/run the workspace; this service owns no model loop. */
export class AppsAuthoringService {
  readonly store:AppsAuthoringOptions['store'];readonly sources:AppsAuthoringOptions['sources'];readonly evidenceRoot:string;
  private options:AppsAuthoringOptions;
  private evidenceFiles=new FileVerificationCache();
  /** Identity proofs include every reused report ancestor; bounded independently of retained evidence bytes. */
  private receiptProofs=new Map<string,{references:FileEvidenceRef[];fingerprint:string}>();
  private receiptProofBytes=0;
  /** await_display wake-ups; display writes all pass through putDisplay in this process. */
  private displayWaiters=new Set<()=>void>();
  /** Displays whose complete evidence verification passed (LRU 256, TTL 10 min). A hit still needs an unchanged record fingerprint; see verifyDisplay. */
  readonly verifiedDisplays=new VerifiedDisplayCache();
  /** Counters for observability and tests: complete verifications versus fingerprint-checked reuse. */
  readonly verification={full:0,cached:0};
  get evidenceVerification():Readonly<FileVerificationCache['verification']> {return {...this.evidenceFiles.verification};}
  constructor(options:AppsAuthoringOptions){
    this.options=options;this.store=options.store;this.sources=options.sources;
    this.evidenceRoot=resolve(options.evidenceRoot??join(dirname(options.sources.directory),'authoring-evidence'));
    mkdirSync(this.evidenceRoot,{recursive:true});
    if(options.readyTimeoutMs!==undefined&&(!Number.isSafeInteger(options.readyTimeoutMs)||options.readyTimeoutMs<1))fail('INVALID_INPUT','readyTimeoutMs must be positive.');
  }
  private now():Date {const value=this.options.clock?.()??new Date();if(!Number.isFinite(value.getTime()))fail('INVALID_INPUT','Clock is invalid.');return value;}
  private stamp():string{return this.now().toISOString();}
  private resolvePath(path:string):string{return this.options.resolveEvidencePath?.(path)??resolve(path);}
  private notifyCancellation(attemptId:string,epoch:number):void {try{this.options.onCancel?.(attemptId,epoch);}catch(error){console.warn('AUTHORING_CANCEL_SIGNAL_FAILED',attemptId,epoch,error instanceof Error?error.message:String(error));}}
  private view(sessionId:string,viewId:string):AuthoringView {
    const previous=this.options.presentation.ownedView(required(sessionId,'sessionId'),required(viewId,'viewId'));
    const current=previous as Partial<AuthoringView>;
    return {...clone(previous),viewRevision:current.viewRevision??1,activeBuildId:current.activeBuildId??previous.source?.buildId??null,lastGoodBuildId:current.lastGoodBuildId??null,previousGoodBuildId:current.previousGoodBuildId??null,pendingPublicationId:current.pendingPublicationId??null,validationStatus:current.validationStatus??(previous.source?'legacy_unverified':'draft_unpublished')};
  }
  private context(sessionId:string,input:AuthoringAttemptInput,allowTerminal=false){
    required(input.attemptId,'attemptId');integer(input.epoch,'epoch');
    const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId);if(!attempt)fail('ATTEMPT_NOT_FOUND','Authoring attempt does not exist.');
    const draft=this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!draft||draft.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Authoring draft belongs to another session.');
    if(attempt.epoch!==input.epoch||draft.epoch!==input.epoch)fail('ATTEMPT_SUPERSEDED','Authoring epoch has changed; inspect the original attempt.');
    if(!allowTerminal&&terminal.has(attempt.state))fail('ATTEMPT_SUPERSEDED',`Attempt is ${attempt.state}; start an explicit new attempt.`);
    return {draft,attempt,view:this.view(sessionId,draft.viewId),sources:this.sources};
  }
  private transition(draft:AuthoringDraft,attempt:AuthoringAttempt,state:AuthoringState,reason:string|null=null):void {
    this.store.put('authoring_attempts',attempt.attemptId,{...attempt,state,terminalReason:reason});
    this.store.put('authoring_drafts',draft.draftId,{...draft,status:state,updatedAt:this.stamp()});
  }
  private verifyFile(reference:FileEvidenceRef):Buffer {
    if(!reference||!hashPattern.test(reference.sha256)||!Number.isSafeInteger(reference.bytes)||reference.bytes<0||!isAbsolute(reference.path))fail('EVIDENCE_HASH_MISMATCH','File references require an absolute path, SHA256 and byte length.');
    let path:string;try{const actual=this.resolvePath(reference.path),stat=lstatSync(actual);if(stat.isSymbolicLink()||!stat.isFile())fail('EVIDENCE_PATH_INVALID','Evidence must resolve to a managed regular file.');path=realpathSync(actual);}catch(error){if(error instanceof AuthoringError)throw error;return fail('EVIDENCE_HASH_MISMATCH','Referenced evidence file cannot be read.');}
    const allowed=[this.evidenceRoot,this.sources.directory].some(root=>{const base=resolve(root),rel=relative(base,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);});
    if(!allowed)fail('EVIDENCE_PATH_INVALID','Evidence is outside Runtime-managed roots.');
    try{return this.evidenceFiles.read(path,reference.sha256,reference.bytes);}catch{return fail('EVIDENCE_HASH_MISMATCH','Evidence file bytes no longer match its immutable reference.');}
  }
  private fileRef(ownerKind:string,ownerId:string,reference:FileEvidenceRef):void {this.store.put('artifact_refs',`${ownerKind}:${ownerId}:file:${reference.sha256}`,{ownerKind,ownerId,targetKind:'file',targetId:reference.sha256,file:reference});}
  private buildRef(ownerKind:string,ownerId:string,buildId:string):void {this.store.put('artifact_refs',`${ownerKind}:${ownerId}:build:${buildId}`,{ownerKind,ownerId,targetKind:'build',targetId:buildId});}
  private reusedBuildFiles(build:Pick<BuildReceipt,'reusedFrom'>,verify:(reference:FileEvidenceRef)=>Buffer=reference=>this.verifyFile(reference)):FileEvidenceRef[] {
    const references:FileEvidenceRef[]=[],seen=new Set<string>();let reference=build.reusedFrom;
    while(reference){
      if(seen.has(reference.sha256)||references.length>=32)fail('BUILD_EVIDENCE_INVALID','Reused build evidence chain is invalid.');
      seen.add(reference.sha256);references.push(reference);
      let report:{executionKind?:string;reusedFrom?:FileEvidenceRef};try{report=JSON.parse(verify(reference).toString('utf8')).report;}catch(error){if(error instanceof AuthoringError)throw error;return fail('BUILD_EVIDENCE_INVALID','Reused build evidence report cannot be read.');}
      if(!report||typeof report!=='object')fail('BUILD_EVIDENCE_INVALID','Reused build evidence report is invalid.');
      reference=report.executionKind==='reuse'?report.reusedFrom:undefined;
      if(report.executionKind==='reuse'&&!reference)fail('BUILD_EVIDENCE_INVALID','Reused build evidence chain is incomplete.');
    }
    return references;
  }
  private receiptKey(attempt:AuthoringAttempt,build:BuildReceipt,preview:PreviewReceipt):string {return digest([attempt.attemptId??null,attempt.evidenceRefs,build,preview]);}
  private evidenceIdentity(reference:FileEvidenceRef,checked=new Map<string,string>()):string {
    try{return regularFilePathIdentity(this.resolvePath(reference.path),checked);}catch(error){if(error instanceof AuthoringError)throw error;return fail('EVIDENCE_HASH_MISMATCH','Referenced evidence path or file identity changed.');}
  }
  /** Recheck files and relocation authorization on every reuse, without retaining screenshot/report bytes or re-reading reused-report chains. */
  private receiptIntegrity(attempt:AuthoringAttempt,build:BuildReceipt,preview:PreviewReceipt):boolean {
    const key=this.receiptKey(attempt,build,preview),proof=this.receiptProofs.get(key);if(!proof)return false;
    let fingerprint:string|undefined;const check=()=>{const checked=new Map<string,string>();fingerprint=canonicalJson(proof.references.map(reference=>[reference,this.evidenceIdentity(reference,checked)]));};
    try{if(this.options.withEvidencePathScope)this.options.withEvidencePathScope(check);else check();}catch{return false;}
    if(fingerprint!==proof.fingerprint){this.receiptProofs.delete(key);this.receiptProofBytes-=proof.fingerprint.length*2;return false;}
    this.receiptProofs.delete(key);this.receiptProofs.set(key,proof);return true;
  }
  private verifyReceiptFiles(attempt:AuthoringAttempt,build:BuildReceipt,preview:PreviewReceipt):void {
    const key=this.receiptKey(attempt,build,preview),old=this.receiptProofs.get(key);if(old){this.receiptProofs.delete(key);this.receiptProofBytes-=old.fingerprint.length*2;}
    const verify=()=>{
      const references=[...attempt.evidenceRefs,build.logRef,...(build.fileManifestRef?[build.fileManifestRef]:[]),...preview.viewportResults.map(viewport=>viewport.screenshot),...preview.assertionResults.flatMap(assertion=>assertion.evidenceRefs)];
      const verified=new Map<string,Buffer>(),dependencies=new Map<string,{reference:FileEvidenceRef;identity:string}>(),verify=(reference:FileEvidenceRef)=>{
        const key=canonicalJson(reference),cached=verified.get(key);if(cached)return cached;
        const identity=this.evidenceIdentity(reference),bytes=this.verifyFile(reference);if(this.evidenceIdentity(reference)!==identity)fail('EVIDENCE_HASH_MISMATCH','Evidence changed during verification.');
        verified.set(key,bytes);dependencies.set(key,{reference:clone(reference),identity});return bytes;
      };
      for(const reference of references)verify(reference);
      this.reusedBuildFiles(build,verify);
      const refs=[...dependencies.values()],fingerprint=canonicalJson(refs.map(({reference,identity})=>[reference,identity])),bytes=fingerprint.length*2;
      if(bytes<=8*1024*1024){while(this.receiptProofs.size>=256||this.receiptProofBytes+bytes>8*1024*1024){const first=this.receiptProofs.keys().next().value!;this.receiptProofBytes-=this.receiptProofs.get(first)!.fingerprint.length*2;this.receiptProofs.delete(first);}this.receiptProofs.set(key,{references:refs.map(item=>item.reference),fingerprint});this.receiptProofBytes+=bytes;}
    };
    if(this.options.withEvidencePathScope)this.options.withEvidencePathScope(verify);else verify();
  }
  private failure(sessionId:string,input:AuthoringAttemptInput,state:'build_failed'|'preview_failed',error:unknown,reference:FileEvidenceRef):void {
    this.store.transaction(()=>{const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId),draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!attempt||!draft||draft.ownerSessionId!==sessionId||draft.epoch!==input.epoch||attempt.epoch!==input.epoch||terminal.has(attempt.state))return;const code=(error as {code?:string})?.code,message=error instanceof Error?error.message:String(error);this.transition(draft,{...attempt,evidenceRefs:[...attempt.evidenceRefs,reference]},state,code?.startsWith('PREVIEW_PERFORMANCE_')?`${code}: ${message}`:message);});
  }
  private evidenceError(error:unknown,fallback:'BUILD_EVIDENCE_INVALID'|'PREVIEW_INCOMPLETE'):AuthoringError {
    if(error instanceof AuthoringError)return error;
    const message=error instanceof Error?error.message:String(error),code=(error as {code?:unknown})?.code;
    const known=['BUILD_INPUT_CHANGED','BUILD_ARCHIVE_MISMATCH','BUILD_MANIFEST_MISMATCH','PREVIEW_BUILD_MISMATCH','PREVIEW_EVIDENCE_INVALID','EVIDENCE_HASH_MISMATCH','EVIDENCE_PATH_INVALID','PREVIEW_PERFORMANCE_REQUIRED','PREVIEW_PERFORMANCE_POLICY_MISMATCH','PREVIEW_PERFORMANCE_INVALID','PREVIEW_PERFORMANCE_FAILED','PREVIEW_PERFORMANCE_INCOMPLETE'];
    return new AuthoringError(typeof code==='string'&&known.includes(code)?code:known.includes(message)?message:fallback,message);
  }
  begin(sessionId:string,input:BeginAuthoringInput){
    required(sessionId,'sessionId');if(!['new','edit','open_saved'].includes(input.mode))fail('INVALID_INPUT','Explicit begin mode is required.');
    const {invocationId,...intent}=input,attemptId=input.attemptId??randomUUID(),requestHash=digest({sessionId,input:{...intent,attemptId}}),existing=this.store.get<AuthoringAttempt>('authoring_attempts',attemptId);
    if(existing){const draft=this.store.get<AuthoringDraft>('authoring_drafts',existing.draftId);if(!draft||draft.ownerSessionId!==sessionId||existing.requestHash!==requestHash)fail('AUTHORING_REQUEST_CONFLICT','Attempt ID already describes another begin request.');const attempt=invocationId&&!existing.invocationRefs.includes(invocationId)?this.store.put('authoring_attempts',attemptId,{...existing,invocationRefs:[...existing.invocationRefs,invocationId]}):existing;return {draft,attempt,view:this.view(sessionId,draft.viewId)};}
    const superseded:{attemptId:string;epoch:number}[]=[];
    // View metadata, draft generations and supersession must commit together, including edit validation.
    const result=this.store.transaction(()=>{
    let view:AuthoringView,draft:AuthoringDraft|undefined;
    const draftId=randomUUID(),defaultPath=join(this.sources.workspace,`draft-${draftId}`);
    if(input.mode==='edit'){
      view=this.view(sessionId,required(input.viewId,'viewId'));draft=queryRows<AuthoringDraft>(this.store,'authoring_drafts',{ownerSessionId:sessionId,viewId:view.viewId}).find(row=>row.status!=='discarded');
      if(draft&&input.workspacePath&&this.resolvePath(input.workspacePath)!==this.resolvePath(draft.workspacePath))fail('WORKSPACE_CONFLICT','An existing draft has a different recoverable workspace.');
    }else if(input.mode==='open_saved'){
      const componentId=required(input.componentId,'componentId');
      view=this.options.presentation.openComponent(sessionId,componentId,{...(input.revision!==undefined?{revision:integer(input.revision,'revision')}:{}),...(input.workspacePath?{directory:resolve(input.workspacePath)}:{}),...(input.context?{context:input.context}:{}),...(input.newCopy?{newCopy:true}:{})}) as AuthoringView;
      view=this.view(sessionId,view.viewId);
      draft=queryRows<AuthoringDraft>(this.store,'authoring_drafts',{ownerSessionId:sessionId,viewId:view.viewId}).find(row=>row.status!=='discarded');
      if(draft&&input.workspacePath&&this.resolvePath(input.workspacePath)!==this.resolvePath(draft.workspacePath))fail('WORKSPACE_CONFLICT','An existing draft has a different recoverable workspace.');
    }else{
      if(input.workspacePath&&existsSync(resolve(input.workspacePath))&&readdirSync(resolve(input.workspacePath)).length)fail('WORKSPACE_NOT_EMPTY','New authoring workspaces must be independent empty directories.');
      view=this.options.presentation.createView(sessionId,{title:input.title??'新组件',design:{kind:'source'},...(input.bindings?{bindings:input.bindings}:{}),...(input.sourceRefs?{sourceRefs:input.sourceRefs}:{}),...(input.context?{context:input.context}:{})}) as AuthoringView;view=this.view(sessionId,view.viewId);
    }
    const workspacePath=draft?this.resolvePath(draft.workspacePath):resolve(input.workspacePath??(input.mode==='open_saved'?view.source?.directory:undefined)??defaultPath);
    if(!draft&&input.mode!=='open_saved'){
      if(existsSync(workspacePath)&&readdirSync(workspacePath).length)fail('WORKSPACE_NOT_EMPTY','New authoring workspaces must be independent empty directories.');
      if(view.source)this.sources.checkout(view.source,workspacePath);else mkdirSync(workspacePath,{recursive:true});
    }
    if(!existsSync(workspacePath))fail('WORKSPACE_NOT_FOUND','Recoverable draft workspace is missing; inspect instead of silently recreating it.');
    if(input.mode==='edit'&&(input.title!==undefined||input.context||input.sourceRefs||input.bindings))view=this.options.presentation.createView(sessionId,{viewId:view.viewId,title:input.title??view.title,...(input.bindings?{bindings:input.bindings}:{}),...(input.sourceRefs?{sourceRefs:input.sourceRefs}:{}),...(input.context?{context:input.context}:{})}) as AuthoringView;
    const at=this.stamp(),latest=input.componentId?this.store.get<AppsComponent>('components',input.componentId):undefined;
    const next:AuthoringDraft={schemaVersion:1,draftId:draft?.draftId??draftId,ownerSessionId:sessionId,viewId:view.viewId,workspacePath,sourceRevision:(draft?.sourceRevision??0)+1,epoch:(draft?.epoch??0)+1,status:'editing',createdAt:draft?.createdAt??at,updatedAt:at,
      ...(draft?.sourceComponentId??view.sourceComponentId?{sourceComponentId:draft?.sourceComponentId??view.sourceComponentId}:{}),
      ...(draft?.selectedSourceRevision??view.selectedSourceRevision??input.revision??latest?.revision?{selectedSourceRevision:draft?.selectedSourceRevision??view.selectedSourceRevision??input.revision??latest?.revision}:{}),
      ...(draft?.baseRevisionAtOpen??view.baseRevisionAtOpen??view.baseRevision?{baseRevisionAtOpen:draft?.baseRevisionAtOpen??view.baseRevisionAtOpen??view.baseRevision}:{}),};
    const attempt:AuthoringAttempt={attemptId,draftId:next.draftId,epoch:next.epoch,sourceRevision:next.sourceRevision,state:'editing',startedAt:at,expectedViewRevision:view.viewRevision,invocationRefs:input.invocationId?[input.invocationId]:[],evidenceRefs:[],terminalReason:null,requestHash};
      for(const previous of queryRows<AuthoringAttempt>(this.store,'authoring_attempts',{draftId:next.draftId}))if(!terminal.has(previous.state)){
        this.store.put('authoring_attempts',previous.attemptId,{...previous,state:'superseded',terminalReason:'An explicit newer attempt replaced this generation.'});
        superseded.push({attemptId:previous.attemptId,epoch:previous.epoch});
        if(previous.publicationId){const publication=this.store.get<ViewPublication>('view_publications',previous.publicationId);if(publication?.state==='prepared'||publication?.state==='mounting')this.store.put('view_publications',publication.publicationId,{...publication,state:'superseded',updatedAt:at});}
      }
      view={...view,panelState:'open',pendingPublicationId:null};delete view.closedAt;
      this.store.put('views',view.viewId,view);this.store.put('authoring_drafts',next.draftId,next);this.store.put('authoring_attempts',attemptId,attempt);return {draft:clone(next),attempt:clone(attempt),view:clone(view)};
    });
    for(const previous of superseded)this.notifyCancellation(previous.attemptId,previous.epoch);
    if(superseded.length)this.invalidateVerifiedDisplays({sessionId,viewId:result.view.viewId});
    return result;
  }
  /** Internal runner handshake, persisted before spawning the original command. It creates no Agent loop/capability. */
  markBuilding(sessionId:string,input:AuthoringAttemptInput):AuthoringAttempt {
    return this.store.transaction(()=>{const {draft,attempt}=this.context(sessionId,input);if(attempt.buildReceiptId||!['editing','building'].includes(attempt.state))fail('ATTEMPT_STATE_INVALID','Only an unfinished editing attempt may start a real build.');if(attempt.state!=='building')this.transition(draft,attempt,'building');return this.store.get<AuthoringAttempt>('authoring_attempts',attempt.attemptId)!;});
  }
  async recordBuild(sessionId:string,input:RecordBuildInput):Promise<BuildReceipt> {
    let context=this.context(sessionId,input);if(context.attempt.buildReceiptId){const previous=this.store.get<BuildReceipt>('build_receipts',context.attempt.buildReceiptId)!;if(context.attempt.evidenceRefs.some(ref=>ref.sha256===input.reportRef.sha256))return previous;fail('BUILD_EVIDENCE_INVALID','An attempt already has an immutable build receipt.');}
    if(!['editing','building'].includes(context.attempt.state))fail('ATTEMPT_STATE_INVALID','Build recording requires an editing attempt.');
    this.store.transaction(()=>this.transition(context.draft,context.attempt,'building'));
    try{
      this.verifyFile(input.reportRef);if(!this.options.validateBuildEvidence)fail('BUILD_EVIDENCE_INVALID','No actual build-runner evidence validator is configured.');
      const value=await this.options.validateBuildEvidence(input.reportRef,context);this.validateBuild(value,context);
      const receipt:BuildReceipt={schemaVersion:1,receiptId:randomUUID(),attemptId:value.attemptId,sourceRevision:value.sourceRevision,sourceInputDigest:value.sourceInputDigest,lockfileDigest:value.lockfileDigest,command:[...value.command],cwd:value.cwd,toolchain:clone(value.toolchain),exitCode:value.exitCode,startedAt:value.startedAt,finishedAt:value.finishedAt,logRef:clone(value.logRef),distDigest:value.distDigest,archiveBuildId:value.archiveBuildId,fileManifestRef:clone(value.fileManifestRef),inputUnchanged:value.inputUnchanged,verdict:value.verdict,...(value.executionKind?{executionKind:value.executionKind}:{}),...(value.executionId?{executionId:value.executionId}:{}),...(value.reusedFrom?{reusedFrom:clone(value.reusedFrom)}:{}),...(value.reuseVerifiedAt?{reuseVerifiedAt:value.reuseVerifiedAt}:{})};
      return this.store.transaction(()=>{context=this.context(sessionId,input);if(context.attempt.buildReceiptId)fail('BUILD_EVIDENCE_INVALID','Another receipt already completed this attempt.');this.store.put('build_receipts',receipt.receiptId,receipt);this.fileRef('build_receipt',receipt.receiptId,input.reportRef);this.fileRef('build_receipt',receipt.receiptId,receipt.logRef);if(receipt.fileManifestRef)this.fileRef('build_receipt',receipt.receiptId,receipt.fileManifestRef);for(const reference of this.reusedBuildFiles(receipt))this.fileRef('build_receipt',receipt.receiptId,reference);if(receipt.archiveBuildId){this.buildRef('build_receipt',receipt.receiptId,receipt.archiveBuildId);this.store.put('builds',receipt.archiveBuildId,this.sources.manifest(receipt.archiveBuildId));}this.transition(context.draft,{...context.attempt,buildReceiptId:receipt.receiptId,evidenceRefs:[...context.attempt.evidenceRefs,input.reportRef]},receipt.verdict==='PASS'?'previewing':'build_failed',receipt.verdict==='FAIL'?'Actual build failed.':null);return clone(receipt);});
    }catch(error){const normalized=this.evidenceError(error,'BUILD_EVIDENCE_INVALID');this.failure(sessionId,input,'build_failed',normalized,input.reportRef);throw normalized;}
  }
  private validateBuild(value:BuildExecutionEvidence,context:ReturnType<AppsAuthoringService['context']>):void {
    if(!value||value.schemaVersion!==1||value.attemptId!==context.attempt.attemptId||value.epoch!==context.attempt.epoch||value.sourceRevision!==context.attempt.sourceRevision||this.resolvePath(value.workspacePath)!==this.resolvePath(context.draft.workspacePath))fail('BUILD_EVIDENCE_INVALID','Build evidence does not identify this source attempt.');
    dates(value.startedAt,value.finishedAt);if(!hashPattern.test(value.sourceInputDigest)||!hashPattern.test(value.sourceInputDigestAfter)||!hashPattern.test(value.lockfileDigest)||!Array.isArray(value.command)||!value.command.length||value.command.some(part=>typeof part!=='string'||!part)||!isAbsolute(value.cwd)||resolve(value.cwd)!==resolve(context.draft.workspacePath)||!Number.isInteger(value.exitCode)||typeof value.inputUnchanged!=='boolean'||!['PASS','FAIL'].includes(value.verdict)||!value.toolchain||typeof value.toolchain!=='object'||!Object.keys(value.toolchain).length||Object.values(value.toolchain).some(item=>typeof item!=='string')||!(value.distDigest===null||hashPattern.test(value.distDigest))||!(value.archiveBuildId===null||hashPattern.test(value.archiveBuildId)))fail('BUILD_EVIDENCE_INVALID','Build receipt fields are invalid.');
    if(value.executionKind!==undefined&&!['executed','reuse'].includes(value.executionKind)||value.executionKind==='reuse'&&(!value.reusedFrom||!Number.isFinite(Date.parse(value.reuseVerifiedAt??''))||Date.parse(value.reuseVerifiedAt!)<Date.parse(value.finishedAt))||value.executionKind!=='reuse'&&(value.reusedFrom!==undefined||value.reuseVerifiedAt!==undefined))fail('BUILD_EVIDENCE_INVALID','Build reuse provenance is invalid.');
    required(value.runnerVersion,'runnerVersion');required(value.executionId,'executionId');if(value.fileManifestRef!==null)this.verifyFile(value.fileManifestRef);if(value.archiveBuildId!==null&&!this.sources.verify(value.archiveBuildId).valid)fail('BUILD_EVIDENCE_INVALID','Build archive is invalid.');
    this.verifyFile(value.logRef);
    if(value.verdict==='PASS'){
      if(value.exitCode!==0||!value.inputUnchanged||value.sourceInputDigest!==value.sourceInputDigestAfter)fail('BUILD_INPUT_CHANGED','Build inputs changed or the command failed.');
      if(!value.archiveBuildId||!hashPattern.test(value.archiveBuildId)||!value.distDigest||!value.fileManifestRef||!this.sources.verify(value.archiveBuildId).valid)fail('BUILD_EVIDENCE_INVALID','PASS needs a verified immutable source + dist archive.');
      const manifest=JSON.parse(this.verifyFile(value.fileManifestRef).toString('utf8'));if(canonicalJson(manifest)!==canonicalJson(this.sources.manifest(value.archiveBuildId))||distDigest(this.sources,value.archiveBuildId)!==value.distDigest)fail('BUILD_EVIDENCE_INVALID','Build manifest or output bytes do not match the archive.');
    }
  }
  async recordPreview(sessionId:string,input:RecordPreviewInput):Promise<PreviewReceipt> {
    let context=this.context(sessionId,input);if(context.attempt.previewReceiptId){const receipt=this.store.get<PreviewReceipt>('preview_receipts',context.attempt.previewReceiptId)!;if(context.attempt.evidenceRefs.some(ref=>ref.sha256===input.reportRef.sha256))return receipt;fail('PREVIEW_BUILD_MISMATCH','This attempt already recorded another immutable preview.');}
    const build=this.store.get<BuildReceipt>('build_receipts',input.buildReceiptId);if(!build||build.verdict!=='PASS'||context.attempt.buildReceiptId!==build.receiptId||build.attemptId!==input.attemptId)fail('BUILD_EVIDENCE_INVALID','Preview requires this attempt\'s PASS BuildReceipt.');
    if(context.attempt.state!=='previewing')fail('ATTEMPT_STATE_INVALID','Preview requires a built attempt.');
    try{
      this.verifyFile(input.reportRef);if(!this.options.validatePreviewEvidence)fail('PREVIEW_INCOMPLETE','No actual preview-runner evidence validator is configured.');
      const value=await this.options.validatePreviewEvidence(input.reportRef,{...context,buildReceipt:build}),performance=this.validatePreview(value,context,build);
      const viewportResults=value.viewportResults.map(({id,contentWidthCssPx,heightCssPx,deviceScaleFactor,screenshot,pageErrors,unhandledRejections,failedRequests,bridgeReady,assertionIds,interactionCaseIds})=>({id,contentWidthCssPx,heightCssPx,deviceScaleFactor,screenshot:clone(screenshot),pageErrors:[...pageErrors],unhandledRejections:[...unhandledRejections],failedRequests:[...failedRequests],bridgeReady,assertionIds:[...assertionIds],...(interactionCaseIds?{interactionCaseIds:[...interactionCaseIds]}:{})}));
      const receipt:PreviewReceipt={schemaVersion:1,receiptId:randomUUID(),attemptId:value.attemptId,buildReceiptId:value.buildReceiptId,buildId:value.buildId,protocol:value.protocol,mode:value.mode,runnerVersion:value.runnerVersion,startedAt:value.startedAt,finishedAt:value.finishedAt,viewportResults,assertionResults:clone(value.assertionResults),verdict:value.verdict,performance:clone(value.performance)};
      const firstFailure=performance.failures[0],reason=receipt.verdict==='PASS'?null:firstFailure?`PREVIEW_PERFORMANCE_${performance.verdict==='FAIL'?'FAILED':'INCOMPLETE'}: ${firstFailure.id} (${firstFailure.actual}; limit ${firstFailure.limit}). ${firstFailure.message} ${firstFailure.repair}`:`Preview ${receipt.verdict}.`;
      return this.store.transaction(()=>{context=this.context(sessionId,input);if(context.attempt.previewReceiptId)fail('PREVIEW_BUILD_MISMATCH','Another preview completed this attempt.');this.store.put('preview_receipts',receipt.receiptId,receipt);this.fileRef('preview_receipt',receipt.receiptId,input.reportRef);for(const viewport of receipt.viewportResults)this.fileRef('preview_receipt',receipt.receiptId,viewport.screenshot);for(const assertion of receipt.assertionResults)for(const ref of assertion.evidenceRefs)this.fileRef('preview_receipt',receipt.receiptId,ref);this.buildRef('preview_receipt',receipt.receiptId,receipt.buildId);this.transition(context.draft,{...context.attempt,previewReceiptId:receipt.receiptId,evidenceRefs:[...context.attempt.evidenceRefs,input.reportRef]},receipt.verdict==='PASS'?'publish_ready':'preview_failed',reason);return clone(receipt);});
    }catch(error){const normalized=this.evidenceError(error,'PREVIEW_INCOMPLETE');this.failure(sessionId,input,'preview_failed',normalized,input.reportRef);throw normalized;}
  }
  private validatePreview(value:PreviewValidationEvidence,context:ReturnType<AppsAuthoringService['context']>,build:BuildReceipt):PerformanceEvaluation {
    if(value?.validationProfile==='draft')fail('PREVIEW_INCOMPLETE','Draft diagnostics cannot satisfy publication evidence.');
    if(!value||value.schemaVersion!==1||value.attemptId!==context.attempt.attemptId||value.epoch!==context.attempt.epoch||value.buildReceiptId!==build.receiptId||value.buildId!==build.archiveBuildId||value.protocol!=='dsh.apps.component.v2'||!['fixture','live_readonly'].includes(value.mode)||!['PASS','FAIL','INCOMPLETE'].includes(value.verdict)||!this.sources.verify(value.buildId).valid)fail('PREVIEW_BUILD_MISMATCH','Preview does not identify this exact frozen v2 build.');
    required(value.runnerVersion,'runnerVersion');dates(value.startedAt,value.finishedAt);
    const passed=assertions(value.assertionResults),ids=new Set(value.assertionResults.map(item=>item.id));
    if(!Array.isArray(value.viewportResults)||!value.viewportResults.length||new Set(value.viewportResults.map(item=>item.id)).size!==value.viewportResults.length)fail('PREVIEW_INCOMPLETE','Real distinct viewport reports are required.');
    for(const viewport of value.viewportResults){required(viewport.id,'viewport.id');integer(viewport.contentWidthCssPx,'contentWidthCssPx');integer(viewport.heightCssPx,'heightCssPx');if(!Number.isFinite(viewport.deviceScaleFactor)||viewport.deviceScaleFactor<=0||!Array.isArray(viewport.pageErrors)||!Array.isArray(viewport.unhandledRejections)||!Array.isArray(viewport.failedRequests)||typeof viewport.bridgeReady!=='boolean'||!Array.isArray(viewport.assertionIds)||viewport.assertionIds.some(id=>!ids.has(id)))fail('PREVIEW_INCOMPLETE','Viewport fields or assertion coverage are invalid.');this.verifyFile(viewport.screenshot);}
    for(const assertion of value.assertionResults)for(const reference of assertion.evidenceRefs)this.verifyFile(reference);
    if(value.verdict==='PASS'&&(!passed||![420,1040].every(width=>value.viewportResults.some(item=>item.contentWidthCssPx===width&&item.deviceScaleFactor===1))||value.viewportResults.some(viewport=>viewport.pageErrors.length||viewport.unhandledRejections.length||viewport.failedRequests.length||!viewport.bridgeReady||!viewport.assertionIds.some(id=>value.assertionResults.find(item=>item.id===id)?.required))))fail('PREVIEW_INCOMPLETE','PASS requires actual 420/1040 CSS-pixel viewport coverage, successful required interactions, bridge readiness, and no unhandled failures.');
    const interactions=Object.fromEntries(value.viewportResults.map(view=>[String(view.contentWidthCssPx),view.interactionCaseIds??[]]));
    return value.verdict==='PASS'?requirePassingPerformance(value.performance,interactions):verifyPerformanceEvidence(value.performance,interactions);
  }
  publish(sessionId:string,input:PublishAuthoringInput):ViewPublication {
    return this.store.transaction(()=>{
      const context=this.context(sessionId,input,true),{attempt,draft,view}=context;
      if(attempt.publicationId){const previous=this.store.get<ViewPublication>('view_publications',attempt.publicationId);if(previous&&previous.viewId===input.viewId&&previous.candidateBuildId===input.buildId&&previous.expectedViewRevision===input.expectedViewRevision&&previous.buildReceiptId===input.buildReceiptId&&previous.previewReceiptId===input.previewReceiptId&&(!input.publicationId||previous.publicationId===input.publicationId))return previous;fail('VIEW_CONFLICT','Attempt already identifies another publication.');}
      if(attempt.state!=='publish_ready')fail('ATTEMPT_STATE_INVALID','A matching PASS preview is required before publish.');
      if(input.viewId!==draft.viewId||view.viewRevision!==integer(input.expectedViewRevision,'expectedViewRevision')||attempt.expectedViewRevision!==input.expectedViewRevision||view.pendingPublicationId)fail('VIEW_CONFLICT','View revision or pending publication has changed. Keep the workspace and inspect.');
      const build=this.store.get<BuildReceipt>('build_receipts',input.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',input.previewReceiptId);
      if(!build||!preview||attempt.buildReceiptId!==build.receiptId||attempt.previewReceiptId!==preview.receiptId||build.attemptId!==attempt.attemptId||preview.attemptId!==attempt.attemptId||build.verdict!=='PASS'||preview.verdict!=='PASS'||preview.buildReceiptId!==build.receiptId||preview.buildId!==input.buildId||build.archiveBuildId!==input.buildId||!this.sources.verify(input.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Publication requires matching immutable PASS build and preview evidence.');
      // New publications use the current policy. Existing publications keep their historical open path.
      requirePassingPerformance(preview.performance,Object.fromEntries(preview.viewportResults.map(view=>[String(view.contentWidthCssPx),view.interactionCaseIds??[]])));
      this.verifyReceiptFiles(attempt,build,preview);
      const source={buildId:input.buildId,directory:draft.workspacePath,entry:'index.html',files:[...this.sources.manifest(input.buildId)!.files]},at=this.stamp();
      const publication:ViewPublication={publicationId:input.publicationId??randomUUID(),viewId:view.viewId,ownerSessionId:sessionId,attemptId:attempt.attemptId,attemptEpoch:attempt.epoch,expectedViewRevision:view.viewRevision,candidateBuildId:input.buildId,priorActiveBuildId:view.activeBuildId,state:'prepared',readyDeadlineAt:null,mountStartedAt:null,evidenceRefs:clone(attempt.evidenceRefs),createdAt:at,updatedAt:at,buildReceiptId:build.receiptId,previewReceiptId:preview.receiptId,source};
      if(this.store.get('view_publications',publication.publicationId))fail('VIEW_CONFLICT','Publication ID already exists.');
      const publicationViewId='publication-view:'+publication.publicationId,preparedView={...clone(view),source:clone(source),pendingPublicationId:publication.publicationId};this.store.put('provider_records',publicationViewId,{appId:'apps',connectionId:'presentation',namespace:'publication_views',recordId:publicationViewId,value:preparedView});
      this.store.put('view_publications',publication.publicationId,publication);this.store.put('views',view.viewId,{...view,pendingPublicationId:publication.publicationId});this.buildRef('publication',publication.publicationId,input.buildId);this.transition(draft,{...attempt,publicationId:publication.publicationId},'publish_ready');
      // The hook reserves jobs only; provider work starts after this metadata transaction.
      try{this.options.presentation.prepareViewData?.(preparedView,publication.publicationId);}catch(error){console.warn('PUBLICATION_PREWARM_FAILED',publication.publicationId,error instanceof Error?error.message:String(error));}
      return clone(publication);
    });
  }
  startMount(sessionId:string,input:StartMountInput):ViewPublication {
    return this.store.transaction(()=>{
      required(input.viewId,'viewId');required(input.buildId,'buildId');integer(input.expectedViewRevision,'expectedViewRevision');
      const publication=this.store.get<ViewPublication>('view_publications',required(input.publicationId,'publicationId'));
      if(!publication||publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Candidate publication does not belong to this session.');
      const {attempt,draft,view}=this.context(sessionId,{attemptId:input.attemptId,epoch:input.attemptEpoch},true);
      if(publication.viewId!==input.viewId||publication.attemptId!==input.attemptId||publication.attemptEpoch!==input.attemptEpoch||publication.candidateBuildId!==input.buildId||publication.expectedViewRevision!==input.expectedViewRevision)fail('PUBLICATION_TARGET_MISMATCH','Open must identify the fixed publication from this message.');
      if(view.viewId!==publication.viewId||view.viewRevision!==publication.expectedViewRevision||attempt.expectedViewRevision!==publication.expectedViewRevision||draft.sourceRevision!==attempt.sourceRevision||view.pendingPublicationId!==publication.publicationId||attempt.publicationId!==publication.publicationId||!['prepared','mounting'].includes(publication.state)||attempt.state!==(publication.state==='prepared'?'publish_ready':'mounting'))fail('ATTEMPT_SUPERSEDED','This publication is no longer the pending view candidate.');
      const build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId);
      if(!build||!preview||attempt.buildReceiptId!==build.receiptId||attempt.previewReceiptId!==preview.receiptId||build.receiptId!==publication.buildReceiptId||preview.receiptId!==publication.previewReceiptId||build.attemptId!==attempt.attemptId||preview.attemptId!==attempt.attemptId||build.sourceRevision!==attempt.sourceRevision||build.verdict!=='PASS'||preview.verdict!=='PASS'||preview.buildReceiptId!==build.receiptId||preview.buildId!==publication.candidateBuildId||build.archiveBuildId!==publication.candidateBuildId||publication.source.buildId!==publication.candidateBuildId||!this.sources.verify(publication.candidateBuildId).valid)fail('BUILD_EVIDENCE_INVALID','Opening requires the current matching immutable PASS build and preview evidence.');
      const manifest=this.sources.manifest(publication.candidateBuildId)!;
      if(publication.source.directory!==draft.workspacePath||publication.source.entry!==manifest.entry||canonicalJson(publication.source.files)!==canonicalJson(manifest.files))fail('BUILD_EVIDENCE_INVALID','Publication source no longer identifies this exact archived build and workspace.');
      this.verifyReceiptFiles(attempt,build,preview);
      if(publication.state==='mounting'){
        if(!publication.readyDeadlineAt||!Number.isFinite(Date.parse(publication.readyDeadlineAt))||this.now().getTime()>Date.parse(publication.readyDeadlineAt))fail('FRAME_NOT_READY','Candidate readiness deadline expired.');
        return clone(publication);
      }
      const at=this.stamp(),mounting:ViewPublication={...publication,state:'mounting',mountStartedAt:at,readyDeadlineAt:new Date(Date.parse(at)+(this.options.readyTimeoutMs??15000)).toISOString(),updatedAt:at};
      this.store.put('view_publications',publication.publicationId,mounting);this.transition(draft,attempt,'mounting');return clone(mounting);
    });
  }
  private displays(viewId:string):ComponentDisplay[] {
    return queryRows<{namespace:string;value:ComponentDisplay}>(this.store,'provider_records',{namespace:'component_displays','value.viewId':viewId}).map(row=>row.value).sort((a,b)=>a.generation-b.generation);
  }
  private putDisplay(display:ComponentDisplay):ComponentDisplay {
    const recordId='component-display:'+display.displayId;
    this.store.put('provider_records',recordId,{appId:'apps',connectionId:'presentation',namespace:'component_displays',recordId,value:display});
    if(display.state!=='opening'&&display.state!=='ready')this.verifiedDisplays.invalidate({displayId:display.displayId});
    for(const wake of [...this.displayWaiters])wake();return clone(display);
  }
  /** Drops remembered verifications so the next read verifies archive, manifest and receipt files in full again. Without a filter everything is dropped. */
  invalidateVerifiedDisplays(match?:Parameters<VerifiedDisplayCache['invalidate']>[0]):number {return this.verifiedDisplays.invalidate(match);}
  private displayKey(sessionId:string,display:ComponentDisplay):string {return JSON.stringify([sessionId,display.viewId,display.publicationId,display.buildId,display.displayId,display.generation,display.attemptId,display.attemptEpoch,display.expectedViewRevision]);}
  /** By-id metadata plus fresh archive and evidence identities on EVERY reuse. TTL never licenses unchecked filesystem changes. */
  private displayFingerprint(sessionId:string,display:ComponentDisplay):string|undefined {
    const publication=this.store.get<ViewPublication>('view_publications',display.publicationId),attempt=publication&&this.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId),draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId),view=this.store.get<AuthoringView>('views',display.viewId);
    if(!publication||!attempt||!draft||!view||view.ownerSessionId!==sessionId||publication.ownerSessionId!==sessionId)return;
    const build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId),snapshot=this.store.get('provider_records',publication.state==='mounted'?'view-revision:'+canonicalJson([sessionId,display.viewId,publication.committedViewRevision]):'publication-view:'+publication.publicationId);
    if(!build||!preview||!this.sources.verify(display.buildId).valid||!this.receiptIntegrity(attempt,build,preview))return;
    return digest([sessionId,publication,attempt,draft,view,snapshot??null,build,preview,display]);
  }
  private rememberVerified(sessionId:string,display:ComponentDisplay):void {
    const fingerprint=this.displayFingerprint(sessionId,display);if(fingerprint===undefined)return;
    this.verifiedDisplays.remember(this.displayKey(sessionId,display),{sessionId,viewId:display.viewId,publicationId:display.publicationId,displayId:display.displayId,fingerprint,verifiedAt:this.now().getTime()});
  }
  /** Complete displayTarget verification, or a reuse of one that passed for the same exact identity when no record it depended on has changed and the TTL holds. Failures are never remembered and drop any earlier success. `fresh` forces the complete run (open, frame grant, ready). Returns the target only when a complete run happened. */
  private verifyDisplay(sessionId:string,display:ComponentDisplay,fresh=false):DisplayTarget|undefined {
    const key=this.displayKey(sessionId,display);
    if(!fresh&&this.verifiedDisplays.hit(key,()=>this.displayFingerprint(sessionId,display),this.now().getTime())){this.verification.cached++;return;}
    this.verifiedDisplays.forget(key);this.verification.full++;
    const target=this.displayTarget(sessionId,display);this.rememberVerified(sessionId,display);return target;
  }
  /** A display may use a fixed mounted historical snapshot, never the newer view's bindings. */
  private displayTarget(sessionId:string,input:StartMountInput):DisplayTarget{
    required(input.viewId,'viewId');required(input.buildId,'buildId');integer(input.expectedViewRevision,'expectedViewRevision');integer(input.attemptEpoch,'attemptEpoch');
    const publication=this.store.get<ViewPublication>('view_publications',required(input.publicationId,'publicationId'));
    if(!publication||publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Publication is not owned by this session.');
    if(publication.viewId!==input.viewId||publication.attemptId!==input.attemptId||publication.attemptEpoch!==input.attemptEpoch||publication.candidateBuildId!==input.buildId||publication.expectedViewRevision!==input.expectedViewRevision)fail('PUBLICATION_TARGET_MISMATCH','Display must identify the fixed publication from this message.');
    const current=this.view(sessionId,input.viewId),attempt=this.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId),draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);
    if(!attempt||!draft||draft.ownerSessionId!==sessionId||draft.viewId!==input.viewId||attempt.epoch!==input.attemptEpoch||attempt.publicationId!==publication.publicationId)fail('PUBLICATION_UNAVAILABLE','Publication authoring identity is unavailable.');
    let view:AuthoringView;
    if(publication.state==='mounted'){
      const recordId='view-revision:'+canonicalJson([sessionId,input.viewId,publication.committedViewRevision]);
      const snapshot=this.store.get<{namespace:string;value:AuthoringView}>('provider_records',recordId);
      if(!publication.committedViewRevision||snapshot?.namespace!=='view_revisions'||snapshot.value.ownerSessionId!==sessionId||snapshot.value.viewId!==input.viewId||snapshot.value.viewRevision!==publication.committedViewRevision||snapshot.value.source?.buildId!==input.buildId)fail('PUBLICATION_UNAVAILABLE','The fixed mounted view snapshot is unavailable.');
      view=clone(snapshot.value);
    }else{
      if(!['prepared','mounting','failed_mount','interrupted'].includes(publication.state)||!['publish_ready','mounting','failed_mount','interrupted'].includes(attempt.state)||draft.epoch!==attempt.epoch||draft.sourceRevision!==attempt.sourceRevision||current.viewRevision!==publication.expectedViewRevision||current.pendingPublicationId&&current.pendingPublicationId!==publication.publicationId)fail('PUBLICATION_UNAVAILABLE','This candidate was cancelled, superseded or replaced; its original result remains inspectable.');
      const snapshot=this.store.get<{namespace:string;value:AuthoringView}>('provider_records','publication-view:'+publication.publicationId);view=snapshot?.namespace==='publication_views'?clone(snapshot.value):{...current,source:clone(publication.source)};
      if(view.ownerSessionId!==sessionId||view.viewId!==input.viewId||view.viewRevision!==publication.expectedViewRevision||canonicalJson(view.bindings)!==canonicalJson(current.bindings))fail('PUBLICATION_TARGET_MISMATCH','Candidate bindings changed after preparation.');
    }
    const build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId),manifest=this.sources.manifest(input.buildId);
    if(!build||!preview||attempt.buildReceiptId!==build.receiptId||attempt.previewReceiptId!==preview.receiptId||build.attemptId!==attempt.attemptId||preview.attemptId!==attempt.attemptId||build.sourceRevision!==attempt.sourceRevision||build.verdict!=='PASS'||preview.verdict!=='PASS'||preview.buildReceiptId!==build.receiptId||preview.buildId!==input.buildId||build.archiveBuildId!==input.buildId||publication.source.buildId!==input.buildId||!manifest||!this.sources.verify(input.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Display requires the same immutable PASS build and preview.');
    if(publication.source.directory!==draft.workspacePath||publication.source.entry!==manifest.entry||canonicalJson(publication.source.files)!==canonicalJson(manifest.files)||canonicalJson(view.source)!==canonicalJson(publication.source))fail('BUILD_EVIDENCE_INVALID','Display source differs from the exact previewed archive.');
    this.verifyReceiptFiles(attempt,build,preview);return {publication,attempt,draft,current,view};
  }
  openDisplay(sessionId:string,input:OpenDisplayInput):{publication:ViewPublication;display:ComponentDisplay;source:ViewPublication['source'];view:AuthoringView} {
    required(input.displayId,'displayId');if(!/^[-a-zA-Z0-9_.:]{1,160}$/.test(input.displayId))fail('INVALID_INPUT','displayId must be a bounded explicit identity.');
    return this.store.transaction(()=>{
      this.verification.full++;const target=this.displayTarget(sessionId,input),{view,attempt,draft,current}=target,existing=this.store.get<{value:ComponentDisplay}>('provider_records','component-display:'+input.displayId)?.value;let {publication}=target;
      if(existing){if(existing.ownerSessionId!==sessionId||canonicalJson({...input})!==canonicalJson({viewId:existing.viewId,publicationId:existing.publicationId,attemptId:existing.attemptId,attemptEpoch:existing.attemptEpoch,buildId:existing.buildId,expectedViewRevision:existing.expectedViewRevision,displayId:existing.displayId}))fail('DISPLAY_ID_CONFLICT','This display ID already identifies another open.');return {publication:clone(publication),display:clone(existing),source:clone(publication.source),view:clone(existing.view)};}
      const previous=this.displays(input.viewId),at=this.stamp();
      // Only a newly opened, fully validated display revives a recoverable candidate. Cancelled/superseded candidates never reach here.
      if(publication.state==='failed_mount'||publication.state==='interrupted'){
        publication={...publication,state:'prepared',updatedAt:at};this.store.put('view_publications',publication.publicationId,publication);
        this.store.put('views',current.viewId,{...current,pendingPublicationId:publication.publicationId});this.transition(draft,attempt,'publish_ready');
      }
      for(const display of previous)if(display.state==='opening'||display.state==='ready')this.putDisplay({...display,state:'retired',updatedAt:at});
      // Retire old document grants only after the complete fixed target has validated.
      for(const row of queryRows<{namespace:string;recordId:string;value:{identity?:{sessionId?:string;viewId?:string};retired?:boolean}}>(this.store,'provider_records',{namespace:'frame_grants','value.identity.sessionId':sessionId,'value.identity.viewId':input.viewId}))this.store.put('provider_records',row.recordId,{...row,value:{...row.value,retired:true}});
      const display=this.putDisplay({...input,ownerSessionId:sessionId,generation:(previous.at(-1)?.generation??0)+1,state:'opening',view:clone(view),errors:[],createdAt:at,updatedAt:at,openedAt:at,readyDeadlineAt:new Date(Date.parse(at)+DISPLAY_READY_DEADLINE_MS).toISOString()});
      this.buildRef('display',display.displayId,input.buildId);
      // The complete verification above covers this exact display; later reads only compare record fingerprints.
      this.rememberVerified(sessionId,display);return {publication:clone(publication),display,source:clone(publication.source),view:clone(view)};
    });
  }
  display(sessionId:string,input:{viewId:string;publicationId:string;buildId:string;displayId:string;displayGeneration:number}):ComponentDisplay {
    const display=this.store.get<{namespace:string;value:ComponentDisplay}>('provider_records','component-display:'+required(input.displayId,'displayId'))?.value;
    if(!display||display.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Display is not owned by this session.');
    integer(input.displayGeneration,'displayGeneration');
    const stale=()=>fail('BRIDGE_IDENTITY_STALE','This iframe display was replaced or failed; explicitly reopen it.');
    if(display.viewId!==input.viewId||display.publicationId!==input.publicationId||display.buildId!==input.buildId||display.generation!==input.displayGeneration||!['opening','ready'].includes(display.state))stale();
    // A newer open retires older live displays in the same transaction, so a live record that is not the latest only exists before its first verification; reuse relies on the record fingerprint.
    const key=this.displayKey(sessionId,display);
    if(this.verifiedDisplays.hit(key,()=>this.displayFingerprint(sessionId,display),this.now().getTime())){this.verification.cached++;return clone(display);}
    if(this.displays(display.viewId).at(-1)?.displayId!==display.displayId)stale();
    this.verifyDisplay(sessionId,display,true);return clone(display);
  }
  /** The display record when this exact iframe document is the current authorized one; undefined otherwise. Same checks as acceptsDisplayFrame, without a second lookup for callers that need the display. */
  acceptedDisplay(identity:CandidateFrameIdentity):ComponentDisplay|undefined {
    try{if(identity.protocolVersion!=='2.0'||!identity.displayId||!identity.displayGeneration)return;const display=this.display(identity.sessionId,{...identity,displayId:identity.displayId,displayGeneration:identity.displayGeneration});return display.attemptId===identity.attemptId&&display.attemptEpoch===identity.attemptEpoch&&display.frameInstanceId===identity.frameInstanceId&&display.documentNonce===identity.documentNonce?display:undefined;}catch{return;}
  }
  authorizeDisplayFrame(sessionId:string,input:DisplayFrameAuthorizationInput):ComponentDisplay {
    required(input.frameInstanceId,'frameInstanceId');required(input.documentNonce,'documentNonce');
    // Granting a document is a verification point: the complete evidence check always runs here, then later reads reuse it.
    return this.store.transaction(()=>{
      const display=this.display(sessionId,input);if(display.attemptId!==input.attemptId||display.attemptEpoch!==input.attemptEpoch)fail('PUBLICATION_TARGET_MISMATCH','Display attempt identity differs.');this.verifyDisplay(sessionId,display,true);
      if(display.frameInstanceId&&(display.frameInstanceId!==input.frameInstanceId||display.documentNonce!==input.documentNonce))fail('BRIDGE_IDENTITY_STALE','This display already identifies another iframe document; reopen to create a new display.');
      const at=this.stamp(),{readyAt:_ready,...unready}=display;
      // Repeating the same grant is idempotent; a replacement document must report its own readiness, even on an already mounted publication.
      const granted=this.putDisplay({...(!display.frameInstanceId?{...unready,state:'opening' as const,openedAt:at,readyDeadlineAt:new Date(Date.parse(at)+DISPLAY_READY_DEADLINE_MS).toISOString()}:display),frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,updatedAt:at});this.rememberVerified(sessionId,granted);return granted;
    });
  }
  acceptsDisplayFrame(identity:CandidateFrameIdentity):boolean {return this.acceptedDisplay(identity)!==undefined;}
  /** A retired document gives up its display slot, so the same display can grant one new document. A different live document is never displaced. */
  releaseDisplayFrame(sessionId:string,input:{displayId:string;frameInstanceId:string;documentNonce:string}):boolean {
    return this.store.transaction(()=>{
      const display=this.store.get<{value:ComponentDisplay}>('provider_records','component-display:'+required(input.displayId,'displayId'))?.value;
      if(!display||display.ownerSessionId!==sessionId||!display.frameInstanceId||display.frameInstanceId!==input.frameInstanceId||display.documentNonce!==input.documentNonce)return false;
      const {frameInstanceId:_frame,documentNonce:_nonce,readyAt:_ready,...released}=display;
      const readyReceipt=display.readyReceipt??(display.readyAt?{frameInstanceId:display.frameInstanceId,documentNonce:display.documentNonce!,readyAt:display.readyAt}:undefined);
      this.putDisplay({...released,...(readyReceipt?{readyReceipt}:{}),...(display.state==='ready'?{state:'opening' as const}:{}),updatedAt:this.stamp()});return true;
    });
  }
  confirmDisplayReady(sessionId:string,input:RenderReadyInput&{displayId:string;displayGeneration:number}):{publication:ViewPublication;display:ComponentDisplay;view:AuthoringView} {
    return this.store.transaction(()=>{
      const display=this.display(sessionId,input);if(!this.acceptsDisplayFrame({...input,sessionId,protocolVersion:'2.0'}))fail('BRIDGE_IDENTITY_STALE','Ready receipt is not from the current display document.');
      const checks=input.checks;if(!checks||checks.rendered!==true||checks.bridgeReady!==true||checks.dataRead!==true||!Array.isArray(checks.unhandledErrors)||checks.unhandledErrors.length)fail('FRAME_RUNTIME_ERROR','The display has not completed actual render, bridge and data readiness.');
      let passed=false;try{passed=assertions(checks.assertionResults);}catch{}if(!passed)fail('FRAME_RUNTIME_ERROR','The actual display must pass its required component assertions.');
      // Readiness is a verification point: the complete evidence check runs before the publication is committed. The commit changes the fingerprint, so the first later read verifies the mounted state once.
      let {publication,attempt,draft,current}=this.verifyDisplay(sessionId,display,true)!,displayView=display.view;
      if(publication.state!=='mounted'){
        if(canonicalJson(current.bindings)!==canonicalJson(display.view.bindings))fail('PUBLICATION_TARGET_MISMATCH','Candidate data bindings changed during display.');
        const next:AuthoringView={...current,source:clone(publication.source),activeBuildId:input.buildId,previousGoodBuildId:current.lastGoodBuildId,lastGoodBuildId:input.buildId,pendingPublicationId:null,validationStatus:'verified',viewRevision:current.viewRevision+1,updatedAt:this.stamp()};
        publication={...publication,state:'mounted',committedViewRevision:next.viewRevision,updatedAt:this.stamp()};
        const recordId='view-revision:'+canonicalJson([sessionId,current.viewId,next.viewRevision]);
        this.store.put('provider_records',recordId,{appId:'apps',connectionId:'presentation',namespace:'view_revisions',recordId,value:next});this.store.put('views',next.viewId,next);this.store.put('view_publications',publication.publicationId,publication);this.buildRef('view',next.viewId,input.buildId);this.transition(draft,attempt,'mounted');displayView=next;
      }
      const sameReceipt=display.state==='ready'&&!!display.readyAt&&display.readyReceipt?.frameInstanceId===input.frameInstanceId&&display.readyReceipt.documentNonce===input.documentNonce&&display.readyReceipt.readyAt===display.readyAt;
      const at=this.stamp(),ready=sameReceipt?display:this.putDisplay({...display,state:'ready',readyAt:at,readyReceipt:{frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,readyAt:at},updatedAt:at,view:clone(displayView)});
      return {publication:clone(publication),display:clone(ready),view:clone(ready.view)};
    });
  }
  /** Validated, bounded error record. Optional request context (requestId/attempts/retryPolicy/cause) is stored verbatim; an empty optional string is treated as absent. */
  private displayError(error:ReportDisplayErrorInput['error']):DisplayError {
    const invalid=()=>fail('INVALID_INPUT','Display errors require bounded phase, code and message fields; optional requestId (<=128), attempts (1-10), retryPolicy (<=32) and cause (<=500) are the only extras.');
    if(!error||typeof error!=='object'||Array.isArray(error)||Object.keys(error).some(key=>!['phase','code','message','requestId','attempts','retryPolicy','cause'].includes(key)))return invalid();
    for(const [key,max] of [['phase',80],['code',160],['message',4096]] as const){const value=error[key];if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value)>max)return invalid();}
    const extra:Pick<DisplayError,'requestId'|'attempts'|'retryPolicy'|'cause'>={};
    for(const [key,max] of [['requestId',128],['retryPolicy',32],['cause',500]] as const){const value=error[key];if(value===undefined)continue;if(typeof value!=='string'||value.length>max)return invalid();if(value)extra[key]=value;}
    if(error.attempts!==undefined){if(!Number.isInteger(error.attempts)||error.attempts<1||error.attempts>10)return invalid();extra.attempts=error.attempts;}
    return {phase:error.phase,code:error.code,message:error.message,...extra};
  }
  reportDisplayError(sessionId:string,input:ReportDisplayErrorInput):ComponentDisplay {
    const error=this.displayError(input.error);
    return this.store.transaction(()=>{const display=this.display(sessionId,input),next=this.putDisplay({...display,state:'failed',errors:[...display.errors,{...error,at:this.stamp()}],updatedAt:this.stamp()});for(const row of queryRows<{namespace:string;recordId:string;value:{candidate?:{displayId?:string};retired?:boolean}}>(this.store,'provider_records',{namespace:'frame_grants','value.candidate.displayId':display.displayId}))this.store.put('provider_records',row.recordId,{...row,value:{...row.value,retired:true}});return next;});
  }
  private pending(sessionId:string,input:FrameAuthorizationInput){
    const publication=this.store.get<ViewPublication>('view_publications',required(input.publicationId,'publicationId'));if(!publication||publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Candidate publication does not belong to this session.');
    const context=this.context(sessionId,{attemptId:input.attemptId,epoch:input.attemptEpoch},true);
    if(publication.attemptId!==input.attemptId||publication.attemptEpoch!==input.attemptEpoch||publication.candidateBuildId!==input.buildId||publication.viewId!==context.view.viewId||publication.state!=='mounting'||context.attempt.state!=='mounting'||context.view.pendingPublicationId!==publication.publicationId||context.view.viewRevision!==publication.expectedViewRevision)fail('ATTEMPT_SUPERSEDED','Candidate identity is no longer the pending view publication.');
    if(!publication.readyDeadlineAt||!Number.isFinite(Date.parse(publication.readyDeadlineAt))||this.now().getTime()>Date.parse(publication.readyDeadlineAt))fail('FRAME_NOT_READY','Candidate readiness deadline expired.');
    return {...context,publication};
  }
  authorizeFrame(sessionId:string,input:FrameAuthorizationInput):ViewPublication {
    required(input.frameInstanceId,'frameInstanceId');required(input.documentNonce,'documentNonce');
    return this.store.transaction(()=>{const {publication}=this.pending(sessionId,input);if(publication.frameInstanceId&&(publication.frameInstanceId!==input.frameInstanceId||publication.documentNonce!==input.documentNonce))fail('ATTEMPT_SUPERSEDED','This publication already granted a different iframe document.');return this.store.put('view_publications',publication.publicationId,{...publication,frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,updatedAt:this.stamp()});});
  }
  acceptsFrame(identity:CandidateFrameIdentity):boolean {
    if(identity?.displayId!==undefined||identity?.displayGeneration!==undefined)return this.acceptsDisplayFrame(identity);
    try{if(identity.protocolVersion!=='2.0')return false;const {publication}=this.pending(identity.sessionId,identity);return publication.viewId===identity.viewId&&publication.frameInstanceId===identity.frameInstanceId&&publication.documentNonce===identity.documentNonce;}catch{return false;}
  }
  private recordLegacyReady(sessionId:string,publication:ViewPublication,view:AuthoringView,input:RenderReadyInput,displays:ComponentDisplay[]):void {
    const at=this.stamp();
    for(const display of displays)if(display.state==='opening'||display.state==='ready')this.putDisplay({...display,state:'retired',updatedAt:at});
    const display=this.putDisplay({displayId:'legacy-ready:'+randomUUID(),generation:(displays.at(-1)?.generation??0)+1,ownerSessionId:sessionId,viewId:view.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:input.buildId,expectedViewRevision:publication.expectedViewRevision,state:'ready',view:clone(view),errors:[],createdAt:at,updatedAt:at,openedAt:publication.mountStartedAt??at,...(publication.readyDeadlineAt?{readyDeadlineAt:publication.readyDeadlineAt}:{}),frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,readyAt:at,readyReceipt:{frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,readyAt:at}});
    this.buildRef('display',display.displayId,input.buildId);
  }
  confirmReady(sessionId:string,input:RenderReadyInput):{publication:ViewPublication;view:AuthoringView} {
    return this.store.transaction(()=>{
      const existing=this.store.get<ViewPublication>('view_publications',input.publicationId);
      if(existing?.state==='mounted'&&existing.ownerSessionId===sessionId&&existing.viewId===input.viewId&&existing.attemptId===input.attemptId&&existing.attemptEpoch===input.attemptEpoch&&existing.candidateBuildId===input.buildId&&existing.frameInstanceId===input.frameInstanceId&&existing.documentNonce===input.documentNonce){
        const displays=this.displays(existing.viewId);
        if(!displays.some(display=>display.publicationId===existing.publicationId)){
          // An upgraded mounted row is not display evidence. Only a new, fully validated ready event can fill the missing receipt.
          const {current,view}=this.displayTarget(sessionId,{...input,expectedViewRevision:existing.expectedViewRevision});
          if(current.viewRevision!==existing.committedViewRevision||current.source?.buildId!==input.buildId||displays.some(display=>display.state==='opening'||display.state==='ready'))fail('BRIDGE_IDENTITY_STALE','A newer view or display replaced this legacy document.');
          const checks=input.checks;if(!checks||checks.rendered!==true||checks.bridgeReady!==true||checks.dataRead!==true||!Array.isArray(checks.unhandledErrors)||checks.unhandledErrors.length||!assertions(checks.assertionResults))fail('FRAME_RUNTIME_ERROR','Candidate has not completed real render/data/bridge checks.');
          this.recordLegacyReady(sessionId,existing,view,input,displays);
        }
        return {publication:existing,view:this.view(sessionId,existing.viewId)};
      }
      const {publication,attempt,draft,view}=this.pending(sessionId,input);
      if(input.viewId!==view.viewId||publication.frameInstanceId!==input.frameInstanceId||publication.documentNonce!==input.documentNonce)fail('ATTEMPT_SUPERSEDED','renderReady must come from the authorized candidate document.');
      const checks=input.checks;if(!checks||checks.rendered!==true||checks.bridgeReady!==true||checks.dataRead!==true||!Array.isArray(checks.unhandledErrors)||checks.unhandledErrors.length||!assertions(checks.assertionResults))fail('FRAME_RUNTIME_ERROR','Candidate has not completed real render/data/bridge checks.');
      const build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId);if(build?.verdict!=='PASS'||preview?.verdict!=='PASS'||preview.buildId!==input.buildId||build.archiveBuildId!==input.buildId||!this.sources.verify(input.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Candidate evidence became invalid before confirmation.');
      this.verifyReceiptFiles(attempt,build,preview);
      const displays=this.displays(view.viewId),at=this.stamp();
      if(displays.some(display=>display.publicationId===publication.publicationId&&(display.state==='opening'||display.state==='ready')))fail('BRIDGE_IDENTITY_STALE','A newer explicit display replaced this legacy candidate document.');
      const next:AuthoringView={...view,source:clone(publication.source),activeBuildId:input.buildId,previousGoodBuildId:view.lastGoodBuildId,lastGoodBuildId:input.buildId,pendingPublicationId:null,validationStatus:'verified',viewRevision:view.viewRevision+1,updatedAt:at};
      const mounted:ViewPublication={...publication,state:'mounted',committedViewRevision:next.viewRevision,updatedAt:this.stamp()};
      const revisionRecordId='view-revision:'+canonicalJson([sessionId,view.viewId,next.viewRevision]);
      this.store.put('provider_records',revisionRecordId,{appId:'apps',connectionId:'presentation',namespace:'view_revisions',recordId:revisionRecordId,value:next});
      this.store.put('views',view.viewId,next);this.store.put('view_publications',publication.publicationId,mounted);this.buildRef('view',view.viewId,input.buildId);this.transition(draft,attempt,'mounted');
      // Normalize only this validated legacy ready event, never infer readiness from an old mounted publication.
      this.recordLegacyReady(sessionId,mounted,next,input,displays);return {publication:clone(mounted),view:clone(next)};
    });
  }
  failMount(sessionId:string,publicationId:string,reason:string):ViewPublication {
    this.invalidateVerifiedDisplays({sessionId,publicationId});
    return this.store.transaction(()=>{const publication=this.store.get<ViewPublication>('view_publications',publicationId);if(!publication||publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Publication is not owned.');if(publication.state==='mounted')fail('ALREADY_PUBLISHED','Confirmed publication requires a new explicit recovery operation.');if(publication.state!=='mounting')return publication;const view=this.view(sessionId,publication.viewId),attempt=this.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId)!,draft=this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId)!;const next:ViewPublication={...publication,state:'failed_mount',terminalReason:required(reason,'reason'),updatedAt:this.stamp()};this.store.put('view_publications',publicationId,next);if(view.pendingPublicationId===publicationId)this.store.put('views',view.viewId,{...view,pendingPublicationId:null});if(draft.epoch===attempt.epoch)this.transition(draft,attempt,'failed_mount',reason);return next;});
  }
  cancel(sessionId:string,input:{attemptId:string;expectedEpoch:number;reason:string}){
    let notify=false;
    const result=this.store.transaction(()=>{const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',required(input.attemptId,'attemptId')),draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!attempt||!draft||draft.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Attempt is not owned by this session.');integer(input.expectedEpoch,'expectedEpoch');required(input.reason,'reason');if(attempt.epoch!==input.expectedEpoch)fail('ATTEMPT_SUPERSEDED','Cancel epoch does not identify this attempt.');const view=this.view(sessionId,draft.viewId),publication=attempt.publicationId?this.store.get<ViewPublication>('view_publications',attempt.publicationId):undefined;
      if(publication?.state==='mounted'){if(draft.epoch===input.expectedEpoch){this.store.put('authoring_drafts',draft.draftId,{...draft,epoch:draft.epoch+1,updatedAt:this.stamp()});notify=true;}return {status:'already_published' as const,publication:clone(publication),activeBuildId:view.activeBuildId,viewRevision:view.viewRevision};}
      if(attempt.state==='cancelled')return {status:'cancelled' as const,activeBuildId:view.activeBuildId,viewRevision:view.viewRevision};
      if(draft.epoch!==input.expectedEpoch)fail('ATTEMPT_SUPERSEDED','A newer attempt already owns the draft.');
      this.store.put('authoring_drafts',draft.draftId,{...draft,epoch:draft.epoch+1,status:'cancelled',updatedAt:this.stamp()});this.store.put('authoring_attempts',attempt.attemptId,{...attempt,state:'cancelled',terminalReason:input.reason});
      notify=true;
      if(publication?.state==='prepared'||publication?.state==='mounting'){this.store.put('view_publications',publication.publicationId,{...publication,state:'cancelled',terminalReason:input.reason,updatedAt:this.stamp()});if(view.pendingPublicationId===publication.publicationId)this.store.put('views',view.viewId,{...view,pendingPublicationId:null});}
      return {status:'cancelled' as const,activeBuildId:view.activeBuildId,viewRevision:view.viewRevision};
    });
    if(notify)this.notifyCancellation(input.attemptId,input.expectedEpoch);
    this.invalidateVerifiedDisplays({sessionId});
    return result;
  }
  inspect(sessionId:string,input:{attemptId?:string;publicationId?:string;displayId?:string}){
    if(Boolean(input.attemptId)===Boolean(input.publicationId))fail('INVALID_INPUT','Inspect exactly one attempt or publication identity.');
    const publication=input.publicationId?this.store.get<ViewPublication>('view_publications',input.publicationId):undefined;
    const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId??publication?.attemptId??'');
    const draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!attempt||!draft||draft.ownerSessionId!==sessionId||publication&&publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Inspection identity is not owned.');
    const selected=publication??(attempt.publicationId?this.store.get<ViewPublication>('view_publications',attempt.publicationId):undefined);
    const workspacePath=this.resolvePath(draft.workspacePath);
    const displays=this.displays(draft.viewId).filter(display=>display.ownerSessionId===sessionId&&display.publicationId===selected?.publicationId);
    const display=input.displayId?displays.find(display=>display.displayId===input.displayId):undefined;if(input.displayId&&!display)fail('VIEW_NOT_OWNED','The requested display does not belong to this publication and session.');
    const summary=authoringSummary({attempt,publication:selected??null,build:attempt.buildReceiptId?this.store.get<BuildReceipt>('build_receipts',attempt.buildReceiptId):undefined,preview:attempt.previewReceiptId?this.store.get<PreviewReceipt>('preview_receipts',attempt.previewReceiptId):undefined,displays:this.displays(draft.viewId).filter(item=>item.ownerSessionId===sessionId),currentDisplay:display??displays.at(-1)??null,now:this.now()});
    return {summary,draft:{...draft,workspacePath},attempt,publication:selected??null,view:this.view(sessionId,draft.viewId),latestDisplay:displays.at(-1)??null,displays,...(display?{display}:{}),workspaceAvailable:existsSync(workspacePath),missingEvidence:[...(!attempt.buildReceiptId?['BuildReceipt']:[]),...(!attempt.previewReceiptId?['PreviewReceipt']:[])]};
  }
  /** Publish result for Agents: the publication plus the program-computed outcome. Publishing alone never proves a display. */
  publishWithOutcome(sessionId:string,input:PublishAuthoringInput){
    const publication=this.publish(sessionId,input),{summary}=this.inspect(sessionId,{publicationId:publication.publicationId});
    return {...publication,outcome:summary.outcome,completionStatement:summary.completionStatement};
  }
  /** Read-only and repeatable: waits (event wake-up plus a short poll) until the display settles, the deadline passes or the request is cancelled, then returns the inspect shape. */
  async awaitDisplay(sessionId:string,input:AwaitDisplayInput,signal?:AbortSignal){
    const {waitMs:requested,...identity}=input,waitMs=requested===undefined?AWAIT_DISPLAY_DEFAULT_MS:requested;
    if(!Number.isSafeInteger(waitMs)||waitMs<0||waitMs>AWAIT_DISPLAY_MAX_MS)fail('INVALID_INPUT',"waitMs must be an integer from 0 to "+AWAIT_DISPLAY_MAX_MS+".");
    const startedAt=Date.now(),limit=startedAt+waitMs;let result=this.inspect(sessionId,identity);
    while(AWAITABLE_OUTCOMES.includes(result.summary.outcome)&&!signal?.aborted){
      const left=limit-Date.now();if(left<=0)break;
      await new Promise<void>(settle=>{const done=()=>{clearTimeout(timer);this.displayWaiters.delete(done);signal?.removeEventListener('abort',done);settle();},timer=setTimeout(done,Math.min(left,500));this.displayWaiters.add(done);signal?.addEventListener('abort',done,{once:true});});
      result=this.inspect(sessionId,identity);
    }
    const elapsedMs=Date.now()-startedAt;
    return {...result,awaited:{requestedMs:waitMs,elapsedMs,timedOut:AWAITABLE_OUTCOMES.includes(result.summary.outcome)}};
  }
  recoverInterrupted():{interruptedAttemptIds:string[];committedPublicationIds:string[]} {
    const stopped:{attemptId:string;epoch:number}[]=[];
    const result=this.store.transaction(()=>{const interruptedAttemptIds:string[]=[],committedPublicationIds:string[]=[];for(const attempt of this.store.list<AuthoringAttempt>('authoring_attempts')){
      if(!running.has(attempt.state))continue;const draft=this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!draft)continue;const publication=attempt.publicationId?this.store.get<ViewPublication>('view_publications',attempt.publicationId):undefined;
      if(publication?.state==='mounted'){this.store.put('authoring_attempts',attempt.attemptId,{...attempt,state:'mounted'});committedPublicationIds.push(publication.publicationId);continue;}
      this.store.put('authoring_attempts',attempt.attemptId,{...attempt,state:'interrupted',terminalReason:'Runtime restarted; inspect completed facts before an explicit new operation.'});if(draft.epoch===attempt.epoch)this.store.put('authoring_drafts',draft.draftId,{...draft,status:'interrupted',updatedAt:this.stamp()});
      stopped.push({attemptId:attempt.attemptId,epoch:attempt.epoch});
      if(publication?.state==='mounting'){this.store.put('view_publications',publication.publicationId,{...publication,state:'interrupted',updatedAt:this.stamp()});const view=this.view(draft.ownerSessionId,draft.viewId);if(view.pendingPublicationId===publication.publicationId)this.store.put('views',view.viewId,{...view,pendingPublicationId:null});}interruptedAttemptIds.push(attempt.attemptId);
    }return {interruptedAttemptIds,committedPublicationIds};});
    for(const attempt of stopped)this.notifyCancellation(attempt.attemptId,attempt.epoch);
    this.invalidateVerifiedDisplays();
    return result;
  }
  saveComponent(sessionId:string,input:SaveAuthoringInput):AppsComponent {
    required(input.userRequest,'userRequest');return this.store.transaction(()=>{
      const view=this.view(sessionId,input.viewId);if(view.viewRevision!==integer(input.expectedViewRevision,'expectedViewRevision')||view.pendingPublicationId)fail('VIEW_CONFLICT','Save requires the current confirmed view revision.');
      if(!this.options.presentation.canReuseSavedView?.(view)){
        const publication=queryRows<ViewPublication>(this.store,'view_publications',{viewId:view.viewId,ownerSessionId:sessionId,state:'mounted',committedViewRevision:view.viewRevision,candidateBuildId:view.activeBuildId}).at(0);
        if(view.validationStatus!=='verified'||!publication||!view.source||!this.sources.verify(view.source.buildId).valid)fail('BUILD_EVIDENCE_INVALID','此工作副本没有可复用的已验证版本，请完成当前内容的预览和发布后再保存。');
        const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId),build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId);if(!attempt||build?.verdict!=='PASS'||preview?.verdict!=='PASS')fail('BUILD_EVIDENCE_INVALID','Confirmed view evidence is missing.');this.verifyReceiptFiles(attempt,build,preview);
      }
      return this.options.presentation.saveComponent(sessionId,view.viewId,input.userRequest,{mode:input.mode,...(input.componentId!==undefined?{componentId:input.componentId}:{}),...(input.expectedRevision!==undefined?{expectedRevision:input.expectedRevision}:{}),...(input.title!==undefined?{title:input.title}:{})});
    });
  }
  /** New library actions use metadata CAS; the underlying implementation preserves history and open copies. */
  manageSavedComponent(sessionId:string,input:ManageAuthoringComponentInput):JsonValue {
    required(sessionId,'sessionId');required(input.componentId,'componentId');integer(input.expectedRevision,'expectedRevision');
    if(!['rename','delete'].includes(input.action))fail('INVALID_INPUT','Explicit rename/delete action is required.');
    if(!this.options.presentation.manageSaved)fail('UNSUPPORTED_HOST_CAPABILITY','Saved component management is unavailable.');
    return this.store.transaction(()=>{const current=this.store.get<AppsComponent>('components',input.componentId);if(!current||current.revision!==input.expectedRevision)fail('COMPONENT_CONFLICT','Component metadata changed; inspect latest or keep the work copy.');return this.options.presentation.manageSaved!({kind:'component',id:input.componentId,action:input.action,...(input.action==='rename'?{name:required(input.title,'title')}:{})});});
  }
  private uiStateDisplay(sessionId:string,viewId:string,buildId:string,identity?:FrameAuthorizationInput&{displayId?:string;displayGeneration?:number}):ComponentDisplay|undefined {
    if(!identity?.displayId)return;
    const candidate={...identity,protocolVersion:'2.0' as const,sessionId,viewId,displayId:identity.displayId,displayGeneration:identity.displayGeneration!};
    const display=candidate.buildId===buildId?this.acceptedDisplay(candidate):undefined;
    if(!display)fail('BRIDGE_IDENTITY_STALE','UI state requires the current authorized display document.');return display;
  }
  private uiSnapshot(sessionId:string,viewId:string,buildId:string,display?:ComponentDisplay):UiStateSnapshot|undefined {
    const legacy=this.store.get<UiStateSnapshot>('view_ui_states',canonicalJson([sessionId,viewId]));
    if(!display)return legacy;
    return this.store.get<UiStateSnapshot>('view_ui_states',canonicalJson([sessionId,viewId,buildId]))??(legacy?.sourceBuildId===buildId?legacy:undefined);
  }
  exportUiState(sessionId:string,input:UiStateExportInput,authorizedDisplay?:CandidateFrameIdentity,validateFrameSelection?:(selection:UiStateExportInput['selectionEvidence'][number])=>void):UiStateSnapshot {
    const display=this.uiStateDisplay(sessionId,input.viewId,input.sourceBuildId,authorizedDisplay),view=display?.view??this.view(sessionId,input.viewId);integer(input.uiStateSchemaVersion,'uiStateSchemaVersion');integer(input.expectedStateRevision,'expectedStateRevision',0);
    if(!display&&view.activeBuildId!==input.sourceBuildId)fail('BRIDGE_IDENTITY_STALE','UI state must come from the active build.');
    if(Buffer.byteLength(canonicalJson(input.value))>(this.options.maxUiStateBytes??65536))fail('UI_STATE_TOO_LARGE','UI state exceeds its declared JSON byte limit.');
    if(!Array.isArray(input.selectionEvidence))fail('INVALID_INPUT','selectionEvidence must be explicit.');
    return this.store.transaction(()=>{const current=this.uiStateDisplay(sessionId,input.viewId,input.sourceBuildId,authorizedDisplay)?.view??this.view(sessionId,input.viewId);if(!display&&current.activeBuildId!==input.sourceBuildId)fail('BRIDGE_IDENTITY_STALE','UI state build changed before export.');for(const selection of input.selectionEvidence){const binding=current.bindings.find(item=>item.bindingId===selection.bindingId);if(!binding||binding.datasetId!==selection.datasetId)fail('SELECTION_STALE','UI selection dataset identity changed.');if(validateFrameSelection){validateFrameSelection(selection);}else if(display){if(!this.options.presentation.validateDisplaySelection)fail('UI_STATE_INCOMPATIBLE','No display resource validator is configured.');this.options.presentation.validateDisplaySelection(sessionId,authorizedDisplay!,selection);}else{if(!this.options.presentation.validateSelection)fail('UI_STATE_INCOMPATIBLE','No resource-selection validator is configured.');this.options.presentation.validateSelection(sessionId,input.viewId,selection);}}const id=canonicalJson(display?[sessionId,input.viewId,input.sourceBuildId]:[sessionId,input.viewId]),previous=this.uiSnapshot(sessionId,input.viewId,input.sourceBuildId,display);if((previous?.stateRevision??0)!==input.expectedStateRevision)fail('UI_STATE_CONFLICT','UI state revision changed.');const snapshot:UiStateSnapshot={sessionId,viewId:input.viewId,sourceBuildId:input.sourceBuildId,uiStateSchemaVersion:input.uiStateSchemaVersion,stateRevision:input.expectedStateRevision+1,value:clone(input.value),capturedAt:this.stamp(),selectionEvidence:clone(input.selectionEvidence)};this.store.put('view_ui_states',id,snapshot);this.buildRef('ui_state',id,input.sourceBuildId);return snapshot;});
  }
  restoreUiState(sessionId:string,input:UiStateRestoreInput,authorizedCandidate?:FrameAuthorizationInput&{displayId?:string;displayGeneration?:number},validateFrameSelection?:(selection:UiStateExportInput['selectionEvidence'][number])=>void){
    const display=this.uiStateDisplay(sessionId,input.viewId,input.targetBuildId,authorizedCandidate),view=display?.view??this.view(sessionId,input.viewId),snapshot=this.uiSnapshot(sessionId,input.viewId,input.targetBuildId,display);
    integer(input.uiStateSchemaVersion,'uiStateSchemaVersion');
    if(!display&&view.activeBuildId!==input.targetBuildId){
      if(!authorizedCandidate||authorizedCandidate.buildId!==input.targetBuildId)fail('BRIDGE_IDENTITY_STALE','UI state restore must target the active or an authorized pending build.');
      const {publication}=this.pending(sessionId,authorizedCandidate);if(publication.viewId!==input.viewId||publication.frameInstanceId!==authorizedCandidate.frameInstanceId||publication.documentNonce!==authorizedCandidate.documentNonce)fail('BRIDGE_IDENTITY_STALE','Candidate UI restore requires its authorized iframe document.');
    }
    if(!snapshot)return {status:'empty' as const,snapshot:null,removedSelections:[]};
    if(snapshot.uiStateSchemaVersion!==input.uiStateSchemaVersion)return {status:'incompatible' as const,code:'UI_STATE_INCOMPATIBLE',snapshot,removedSelections:[]};
    const valid:UiStateSnapshot['selectionEvidence']=[],removedSelections:{bindingId:string;resource:ResourceRef;reason:string}[]=[];
    for(const selection of snapshot.selectionEvidence){const resources:ResourceRef[]=[];for(const resource of selection.resources){try{const binding=view.bindings.find(item=>item.bindingId===selection.bindingId);if(!binding||binding.datasetId!==selection.datasetId)fail('SELECTION_STALE','UI selection dataset identity changed.');if(validateFrameSelection){validateFrameSelection({...selection,resources:[resource]});}else if(display){if(!this.options.presentation.validateDisplaySelection)fail('UI_STATE_INCOMPATIBLE','No display selection validator.');this.options.presentation.validateDisplaySelection(sessionId,{...authorizedCandidate!,sessionId,viewId:input.viewId,protocolVersion:'2.0'}, {...selection,resources:[resource]});}else{if(!this.options.presentation.validateSelection)fail('UI_STATE_INCOMPATIBLE','No selection validator.');this.options.presentation.validateSelection(sessionId,input.viewId,{...selection,resources:[resource]});}resources.push(clone(resource));}catch(error){removedSelections.push({bindingId:selection.bindingId,resource:clone(resource),reason:error instanceof Error?error.message:String(error)});}}if(resources.length)valid.push({...selection,resources});}
    return {status:'restored' as const,snapshot:{...snapshot,selectionEvidence:valid},removedSelections};
  }
  closeDraft(sessionId:string,viewId:string,action:'keep'|'discard'):AuthoringDraft {
    this.view(sessionId,viewId);if(!['keep','discard'].includes(action))fail('INVALID_INPUT','Explicit keep/discard action is required.');
    const drafts=queryRows<AuthoringDraft>(this.store,'authoring_drafts',{ownerSessionId:sessionId,viewId}),draft=drafts.find(row=>row.status!=='discarded')??drafts.at(-1);if(!draft)fail('DRAFT_NOT_FOUND','This view has no authoring draft.');
    const active=queryRows<AuthoringAttempt>(this.store,'authoring_attempts',{draftId:draft.draftId,epoch:draft.epoch}).find(row=>!terminal.has(row.state));if(active)this.cancel(sessionId,{attemptId:active.attemptId,expectedEpoch:active.epoch,reason:`User closed draft: ${action}.`});
    return this.store.transaction(()=>{const current=this.store.get<AuthoringDraft>('authoring_drafts',draft.draftId)!,at=this.stamp();this.store.put('views',viewId,{...this.view(sessionId,viewId),panelState:'closed',closedAt:at});return this.store.put('authoring_drafts',current.draftId,{...current,status:action==='keep'?'closed':'discarded',updatedAt:at});});
  }
  /** Panel closure is reversible even for copies opened without an authoring draft. */
  closeView(sessionId:string,viewId:string,action:'keep'|'discard'):AuthoringDraft|AppsView {
    const view=this.view(sessionId,viewId);if(!['keep','discard'].includes(action))fail('INVALID_INPUT','Explicit keep/discard action is required.');
    if(queryRows<AuthoringDraft>(this.store,'authoring_drafts',{ownerSessionId:sessionId,viewId}).length)return this.closeDraft(sessionId,viewId,action);
    return clone(this.store.put('views',viewId,{...view,panelState:'closed' as const,closedAt:this.stamp()}));
  }
  restoreView(sessionId:string,viewId:string):AppsView {
    const view={...this.view(sessionId,viewId),panelState:'open' as const};delete view.closedAt;
    return clone(this.store.put('views',viewId,view));
  }
  async execute(context:ExecutionContext):Promise<CapabilityResult> {
    const {request}=context,sessionId='sessionId' in request.source?request.source.sessionId:undefined;
    try{if(!sessionId)fail('SESSION_REQUIRED','Authoring requires an original owning session.');const input=request.input as unknown as Record<string,unknown>;let output:unknown;
      switch(request.capabilityId){
        case 'apps.authoring.begin':output=this.begin(sessionId,input as unknown as BeginAuthoringInput);break;
        case 'apps.authoring.record_build':output=await this.recordBuild(sessionId,input as unknown as RecordBuildInput);break;
        case 'apps.authoring.record_preview':output=await this.recordPreview(sessionId,input as unknown as RecordPreviewInput);break;
        case 'apps.authoring.publish':output=this.publishWithOutcome(sessionId,input as unknown as PublishAuthoringInput);break;
        case 'apps.authoring.inspect':output=this.inspect(sessionId,input as {attemptId?:string;publicationId?:string});break;
        case 'apps.authoring.await_display':output=await this.awaitDisplay(sessionId,input as AwaitDisplayInput,context.signal);break;
        case 'apps.authoring.cancel':output=this.cancel(sessionId,input as unknown as {attemptId:string;expectedEpoch:number;reason:string});break;
        case 'apps.authoring.save_component':output=this.saveComponent(sessionId,input as unknown as SaveAuthoringInput);break;
        default:fail('CAPABILITY_NOT_FOUND','Unknown authoring action.');
      }
      return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:JSON.parse(canonicalJson(output)) as JsonValue};
    }catch(error){return {status:'failed',invocationId:request.invocationId,traceId:request.traceId,error:{code:(error as {code?:string}).code??'AUTHORING_FAILED',message:error instanceof Error?error.message:String(error),retryPolicy:'never'}};}
  }
}
