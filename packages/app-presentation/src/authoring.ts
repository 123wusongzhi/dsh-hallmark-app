import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityResult,ExecutionContext,JsonValue,ResourceRef} from '../../app-contracts/src/index.ts';
import {distDigest} from '../../source-components/src/authoring-evidence.ts';
import type {AppsComponent} from './types.ts';
import type {AppsAuthoringOptions,AuthoringAssertion,AuthoringAttempt,AuthoringAttemptInput,AuthoringDraft,AuthoringState,AuthoringView,BeginAuthoringInput,BuildExecutionEvidence,BuildReceipt,CandidateFrameIdentity,FileEvidenceRef,FrameAuthorizationInput,ManageAuthoringComponentInput,PreviewReceipt,PreviewValidationEvidence,PublishAuthoringInput,RecordBuildInput,RecordPreviewInput,RenderReadyInput,SaveAuthoringInput,UiStateExportInput,UiStateRestoreInput,UiStateSnapshot,ViewPublication} from './authoring-types.ts';
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
    let path:string,bytes:Buffer;try{const actual=this.resolvePath(reference.path);if(lstatSync(actual).isSymbolicLink())fail('EVIDENCE_PATH_INVALID','Evidence must resolve to a managed regular file.');path=realpathSync(actual);bytes=readFileSync(path);}catch(error){if(error instanceof AuthoringError)throw error;return fail('EVIDENCE_HASH_MISMATCH','Referenced evidence file cannot be read.');}
    const allowed=[this.evidenceRoot,this.sources.directory].some(root=>{const base=resolve(root),rel=relative(base,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);});
    if(!allowed)fail('EVIDENCE_PATH_INVALID','Evidence is outside Runtime-managed roots.');
    if(bytes.length!==reference.bytes||createHash('sha256').update(bytes).digest('hex')!==reference.sha256)fail('EVIDENCE_HASH_MISMATCH','Evidence file bytes no longer match its immutable reference.');
    return bytes;
  }
  private fileRef(ownerKind:string,ownerId:string,reference:FileEvidenceRef):void {this.store.put('artifact_refs',`${ownerKind}:${ownerId}:file:${reference.sha256}`,{ownerKind,ownerId,targetKind:'file',targetId:reference.sha256,file:reference});}
  private buildRef(ownerKind:string,ownerId:string,buildId:string):void {this.store.put('artifact_refs',`${ownerKind}:${ownerId}:build:${buildId}`,{ownerKind,ownerId,targetKind:'build',targetId:buildId});}
  private verifyReceiptFiles(attempt:AuthoringAttempt,build:BuildReceipt,preview:PreviewReceipt):void {
    for(const reference of [...attempt.evidenceRefs,build.logRef,...(build.fileManifestRef?[build.fileManifestRef]:[])])this.verifyFile(reference);
    for(const viewport of preview.viewportResults)this.verifyFile(viewport.screenshot);
    for(const assertion of preview.assertionResults)for(const reference of assertion.evidenceRefs)this.verifyFile(reference);
  }
  private failure(sessionId:string,input:AuthoringAttemptInput,state:'build_failed'|'preview_failed',error:unknown,reference:FileEvidenceRef):void {
    this.store.transaction(()=>{const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId),draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!attempt||!draft||draft.ownerSessionId!==sessionId||draft.epoch!==input.epoch||attempt.epoch!==input.epoch||terminal.has(attempt.state))return;this.transition(draft,{...attempt,evidenceRefs:[...attempt.evidenceRefs,reference]},state,error instanceof Error?error.message:String(error));});
  }
  private evidenceError(error:unknown,fallback:'BUILD_EVIDENCE_INVALID'|'PREVIEW_INCOMPLETE'):AuthoringError {
    if(error instanceof AuthoringError)return error;
    const message=error instanceof Error?error.message:String(error),code=(error as {code?:unknown})?.code;
    const known=['BUILD_INPUT_CHANGED','BUILD_ARCHIVE_MISMATCH','BUILD_MANIFEST_MISMATCH','PREVIEW_BUILD_MISMATCH','PREVIEW_EVIDENCE_INVALID','EVIDENCE_HASH_MISMATCH','EVIDENCE_PATH_INVALID'];
    return new AuthoringError(typeof code==='string'&&known.includes(code)?code:known.includes(message)?message:fallback,message);
  }
  begin(sessionId:string,input:BeginAuthoringInput){
    required(sessionId,'sessionId');if(!['new','edit','open_saved'].includes(input.mode))fail('INVALID_INPUT','Explicit begin mode is required.');
    const {invocationId,...intent}=input,attemptId=input.attemptId??randomUUID(),requestHash=digest({sessionId,input:{...intent,attemptId}}),existing=this.store.get<AuthoringAttempt>('authoring_attempts',attemptId);
    if(existing){const draft=this.store.get<AuthoringDraft>('authoring_drafts',existing.draftId);if(!draft||draft.ownerSessionId!==sessionId||existing.requestHash!==requestHash)fail('AUTHORING_REQUEST_CONFLICT','Attempt ID already describes another begin request.');const attempt=invocationId&&!existing.invocationRefs.includes(invocationId)?this.store.put('authoring_attempts',attemptId,{...existing,invocationRefs:[...existing.invocationRefs,invocationId]}):existing;return {draft,attempt,view:this.view(sessionId,draft.viewId)};}
    let view:AuthoringView,draft:AuthoringDraft|undefined;
    const draftId=randomUUID(),defaultPath=join(this.sources.workspace,`draft-${draftId}`);
    if(input.mode==='edit'){
      view=this.view(sessionId,required(input.viewId,'viewId'));draft=this.store.list<AuthoringDraft>('authoring_drafts').find(row=>row.ownerSessionId===sessionId&&row.viewId===view.viewId&&row.status!=='discarded');
      if(draft&&input.workspacePath&&this.resolvePath(input.workspacePath)!==this.resolvePath(draft.workspacePath))fail('WORKSPACE_CONFLICT','An existing draft has a different recoverable workspace.');
    }else if(input.mode==='open_saved'){
      const componentId=required(input.componentId,'componentId'),path=resolve(input.workspacePath??defaultPath);
      if(existsSync(path)&&readdirSync(path).length)fail('WORKSPACE_NOT_EMPTY','A saved component needs an independent empty checkout directory.');
      view=this.options.presentation.openComponent(sessionId,componentId,{...(input.revision!==undefined?{revision:integer(input.revision,'revision')}:{}),directory:path}) as AuthoringView;
      view=this.view(sessionId,view.viewId);
    }else{
      if(input.workspacePath&&existsSync(resolve(input.workspacePath))&&readdirSync(resolve(input.workspacePath)).length)fail('WORKSPACE_NOT_EMPTY','New authoring workspaces must be independent empty directories.');
      view=this.options.presentation.createView(sessionId,{title:input.title??'新组件',design:{kind:'source'},...(input.bindings?{bindings:input.bindings}:{})}) as AuthoringView;view=this.view(sessionId,view.viewId);
    }
    const workspacePath=draft?this.resolvePath(draft.workspacePath):resolve(input.workspacePath??(input.mode==='open_saved'?view.source?.directory:undefined)??defaultPath);
    if(!draft&&input.mode!=='open_saved'){
      if(existsSync(workspacePath)&&readdirSync(workspacePath).length)fail('WORKSPACE_NOT_EMPTY','New authoring workspaces must be independent empty directories.');
      if(view.source)this.sources.checkout(view.source,workspacePath);else mkdirSync(workspacePath,{recursive:true});
    }
    if(!existsSync(workspacePath))fail('WORKSPACE_NOT_FOUND','Recoverable draft workspace is missing; inspect instead of silently recreating it.');
    const at=this.stamp(),latest=input.componentId?this.store.get<AppsComponent>('components',input.componentId):undefined;
    const next:AuthoringDraft={schemaVersion:1,draftId:draft?.draftId??draftId,ownerSessionId:sessionId,viewId:view.viewId,workspacePath,sourceRevision:(draft?.sourceRevision??0)+1,epoch:(draft?.epoch??0)+1,status:'editing',createdAt:draft?.createdAt??at,updatedAt:at,
      ...(draft?.sourceComponentId??view.sourceComponentId?{sourceComponentId:draft?.sourceComponentId??view.sourceComponentId}:{}),
      ...(draft?.selectedSourceRevision??view.selectedSourceRevision??input.revision??latest?.revision?{selectedSourceRevision:draft?.selectedSourceRevision??view.selectedSourceRevision??input.revision??latest?.revision}:{}),
      ...(draft?.baseRevisionAtOpen??view.baseRevisionAtOpen??view.baseRevision?{baseRevisionAtOpen:draft?.baseRevisionAtOpen??view.baseRevisionAtOpen??view.baseRevision}:{}),};
    const attempt:AuthoringAttempt={attemptId,draftId:next.draftId,epoch:next.epoch,sourceRevision:next.sourceRevision,state:'editing',startedAt:at,expectedViewRevision:view.viewRevision,invocationRefs:input.invocationId?[input.invocationId]:[],evidenceRefs:[],terminalReason:null,requestHash};
    const superseded:{attemptId:string;epoch:number}[]=[];
    const result=this.store.transaction(()=>{
      for(const previous of this.store.list<AuthoringAttempt>('authoring_attempts'))if(previous.draftId===next.draftId&&!terminal.has(previous.state)){
        this.store.put('authoring_attempts',previous.attemptId,{...previous,state:'superseded',terminalReason:'An explicit newer attempt replaced this generation.'});
        superseded.push({attemptId:previous.attemptId,epoch:previous.epoch});
        if(previous.publicationId){const publication=this.store.get<ViewPublication>('view_publications',previous.publicationId);if(publication?.state==='mounting')this.store.put('view_publications',publication.publicationId,{...publication,state:'superseded',updatedAt:at});}
      }
      this.store.put('views',view.viewId,{...view,pendingPublicationId:null});this.store.put('authoring_drafts',next.draftId,next);this.store.put('authoring_attempts',attemptId,attempt);return {draft:clone(next),attempt:clone(attempt),view:clone(view)};
    });
    for(const previous of superseded)this.notifyCancellation(previous.attemptId,previous.epoch);
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
      const receipt:BuildReceipt={schemaVersion:1,receiptId:randomUUID(),attemptId:value.attemptId,sourceRevision:value.sourceRevision,sourceInputDigest:value.sourceInputDigest,lockfileDigest:value.lockfileDigest,command:[...value.command],cwd:value.cwd,toolchain:clone(value.toolchain),exitCode:value.exitCode,startedAt:value.startedAt,finishedAt:value.finishedAt,logRef:clone(value.logRef),distDigest:value.distDigest,archiveBuildId:value.archiveBuildId,fileManifestRef:clone(value.fileManifestRef),inputUnchanged:value.inputUnchanged,verdict:value.verdict};
      return this.store.transaction(()=>{context=this.context(sessionId,input);if(context.attempt.buildReceiptId)fail('BUILD_EVIDENCE_INVALID','Another receipt already completed this attempt.');this.store.put('build_receipts',receipt.receiptId,receipt);this.fileRef('build_receipt',receipt.receiptId,input.reportRef);this.fileRef('build_receipt',receipt.receiptId,receipt.logRef);if(receipt.fileManifestRef)this.fileRef('build_receipt',receipt.receiptId,receipt.fileManifestRef);if(receipt.archiveBuildId){this.buildRef('build_receipt',receipt.receiptId,receipt.archiveBuildId);this.store.put('builds',receipt.archiveBuildId,this.sources.manifest(receipt.archiveBuildId));}this.transition(context.draft,{...context.attempt,buildReceiptId:receipt.receiptId,evidenceRefs:[...context.attempt.evidenceRefs,input.reportRef]},receipt.verdict==='PASS'?'previewing':'build_failed',receipt.verdict==='FAIL'?'Actual build failed.':null);return clone(receipt);});
    }catch(error){const normalized=this.evidenceError(error,'BUILD_EVIDENCE_INVALID');this.failure(sessionId,input,'build_failed',normalized,input.reportRef);throw normalized;}
  }
  private validateBuild(value:BuildExecutionEvidence,context:ReturnType<AppsAuthoringService['context']>):void {
    if(!value||value.schemaVersion!==1||value.attemptId!==context.attempt.attemptId||value.epoch!==context.attempt.epoch||value.sourceRevision!==context.attempt.sourceRevision||this.resolvePath(value.workspacePath)!==this.resolvePath(context.draft.workspacePath))fail('BUILD_EVIDENCE_INVALID','Build evidence does not identify this source attempt.');
    dates(value.startedAt,value.finishedAt);if(!hashPattern.test(value.sourceInputDigest)||!hashPattern.test(value.sourceInputDigestAfter)||!hashPattern.test(value.lockfileDigest)||!Array.isArray(value.command)||!value.command.length||value.command.some(part=>typeof part!=='string'||!part)||!isAbsolute(value.cwd)||resolve(value.cwd)!==resolve(context.draft.workspacePath)||!Number.isInteger(value.exitCode)||typeof value.inputUnchanged!=='boolean'||!['PASS','FAIL'].includes(value.verdict)||!value.toolchain||typeof value.toolchain!=='object'||!Object.keys(value.toolchain).length||Object.values(value.toolchain).some(item=>typeof item!=='string')||!(value.distDigest===null||hashPattern.test(value.distDigest))||!(value.archiveBuildId===null||hashPattern.test(value.archiveBuildId)))fail('BUILD_EVIDENCE_INVALID','Build receipt fields are invalid.');
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
      const value=await this.options.validatePreviewEvidence(input.reportRef,{...context,buildReceipt:build});this.validatePreview(value,context,build);
      const viewportResults=value.viewportResults.map(({id,contentWidthCssPx,heightCssPx,deviceScaleFactor,screenshot,pageErrors,unhandledRejections,failedRequests,bridgeReady,assertionIds})=>({id,contentWidthCssPx,heightCssPx,deviceScaleFactor,screenshot:clone(screenshot),pageErrors:[...pageErrors],unhandledRejections:[...unhandledRejections],failedRequests:[...failedRequests],bridgeReady,assertionIds:[...assertionIds]}));
      const receipt:PreviewReceipt={schemaVersion:1,receiptId:randomUUID(),attemptId:value.attemptId,buildReceiptId:value.buildReceiptId,buildId:value.buildId,protocol:value.protocol,mode:value.mode,runnerVersion:value.runnerVersion,startedAt:value.startedAt,finishedAt:value.finishedAt,viewportResults,assertionResults:clone(value.assertionResults),verdict:value.verdict};
      return this.store.transaction(()=>{context=this.context(sessionId,input);if(context.attempt.previewReceiptId)fail('PREVIEW_BUILD_MISMATCH','Another preview completed this attempt.');this.store.put('preview_receipts',receipt.receiptId,receipt);this.fileRef('preview_receipt',receipt.receiptId,input.reportRef);for(const viewport of receipt.viewportResults)this.fileRef('preview_receipt',receipt.receiptId,viewport.screenshot);for(const assertion of receipt.assertionResults)for(const ref of assertion.evidenceRefs)this.fileRef('preview_receipt',receipt.receiptId,ref);this.buildRef('preview_receipt',receipt.receiptId,receipt.buildId);this.transition(context.draft,{...context.attempt,previewReceiptId:receipt.receiptId,evidenceRefs:[...context.attempt.evidenceRefs,input.reportRef]},receipt.verdict==='PASS'?'publish_ready':'preview_failed',receipt.verdict==='PASS'?null:`Preview ${receipt.verdict}.`);return clone(receipt);});
    }catch(error){const normalized=this.evidenceError(error,'PREVIEW_INCOMPLETE');this.failure(sessionId,input,'preview_failed',normalized,input.reportRef);throw normalized;}
  }
  private validatePreview(value:PreviewValidationEvidence,context:ReturnType<AppsAuthoringService['context']>,build:BuildReceipt):void {
    if(!value||value.schemaVersion!==1||value.attemptId!==context.attempt.attemptId||value.epoch!==context.attempt.epoch||value.buildReceiptId!==build.receiptId||value.buildId!==build.archiveBuildId||value.protocol!=='dsh.apps.component.v2'||!['fixture','live_readonly'].includes(value.mode)||!['PASS','FAIL','INCOMPLETE'].includes(value.verdict)||!this.sources.verify(value.buildId).valid)fail('PREVIEW_BUILD_MISMATCH','Preview does not identify this exact frozen v2 build.');
    required(value.runnerVersion,'runnerVersion');dates(value.startedAt,value.finishedAt);
    const passed=assertions(value.assertionResults),ids=new Set(value.assertionResults.map(item=>item.id));
    if(!Array.isArray(value.viewportResults)||!value.viewportResults.length||new Set(value.viewportResults.map(item=>item.id)).size!==value.viewportResults.length)fail('PREVIEW_INCOMPLETE','Real distinct viewport reports are required.');
    for(const viewport of value.viewportResults){required(viewport.id,'viewport.id');integer(viewport.contentWidthCssPx,'contentWidthCssPx');integer(viewport.heightCssPx,'heightCssPx');if(!Number.isFinite(viewport.deviceScaleFactor)||viewport.deviceScaleFactor<=0||!Array.isArray(viewport.pageErrors)||!Array.isArray(viewport.unhandledRejections)||!Array.isArray(viewport.failedRequests)||typeof viewport.bridgeReady!=='boolean'||!Array.isArray(viewport.assertionIds)||viewport.assertionIds.some(id=>!ids.has(id)))fail('PREVIEW_INCOMPLETE','Viewport fields or assertion coverage are invalid.');this.verifyFile(viewport.screenshot);}
    for(const assertion of value.assertionResults)for(const reference of assertion.evidenceRefs)this.verifyFile(reference);
    if(value.verdict==='PASS'&&(!passed||![420,1040].every(width=>value.viewportResults.some(item=>item.contentWidthCssPx===width&&item.deviceScaleFactor===1))||value.viewportResults.some(viewport=>viewport.pageErrors.length||viewport.unhandledRejections.length||viewport.failedRequests.length||!viewport.bridgeReady||!viewport.assertionIds.some(id=>value.assertionResults.find(item=>item.id===id)?.required))))fail('PREVIEW_INCOMPLETE','PASS requires actual 420/1040 CSS-pixel viewport coverage, successful required interactions, bridge readiness, and no unhandled failures.');
  }
  publish(sessionId:string,input:PublishAuthoringInput):ViewPublication {
    return this.store.transaction(()=>{
      const context=this.context(sessionId,input,true),{attempt,draft,view}=context;
      if(attempt.publicationId){const previous=this.store.get<ViewPublication>('view_publications',attempt.publicationId)!;if(previous.viewId===input.viewId&&previous.candidateBuildId===input.buildId&&previous.expectedViewRevision===input.expectedViewRevision&&previous.buildReceiptId===input.buildReceiptId&&previous.previewReceiptId===input.previewReceiptId&&(!input.publicationId||previous.publicationId===input.publicationId))return previous;fail('VIEW_CONFLICT','Attempt already identifies another publication.');}
      if(attempt.state!=='publish_ready')fail('ATTEMPT_STATE_INVALID','A matching PASS preview is required before publish.');
      if(input.viewId!==draft.viewId||view.viewRevision!==integer(input.expectedViewRevision,'expectedViewRevision')||attempt.expectedViewRevision!==input.expectedViewRevision||view.pendingPublicationId)fail('VIEW_CONFLICT','View revision or pending publication has changed. Keep the workspace and inspect.');
      const build=this.store.get<BuildReceipt>('build_receipts',input.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',input.previewReceiptId);
      if(!build||!preview||attempt.buildReceiptId!==build.receiptId||attempt.previewReceiptId!==preview.receiptId||build.attemptId!==attempt.attemptId||preview.attemptId!==attempt.attemptId||build.verdict!=='PASS'||preview.verdict!=='PASS'||preview.buildReceiptId!==build.receiptId||preview.buildId!==input.buildId||build.archiveBuildId!==input.buildId||!this.sources.verify(input.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Publication requires matching immutable PASS build and preview evidence.');
      this.verifyReceiptFiles(attempt,build,preview);
      const source={buildId:input.buildId,directory:draft.workspacePath,entry:'index.html',files:[...this.sources.manifest(input.buildId)!.files]},at=this.stamp();
      const publication:ViewPublication={publicationId:input.publicationId??randomUUID(),viewId:view.viewId,ownerSessionId:sessionId,attemptId:attempt.attemptId,attemptEpoch:attempt.epoch,expectedViewRevision:view.viewRevision,candidateBuildId:input.buildId,priorActiveBuildId:view.activeBuildId,state:'mounting',readyDeadlineAt:new Date(this.now().getTime()+(this.options.readyTimeoutMs??15000)).toISOString(),evidenceRefs:clone(attempt.evidenceRefs),createdAt:at,updatedAt:at,buildReceiptId:build.receiptId,previewReceiptId:preview.receiptId,source};
      if(this.store.get('view_publications',publication.publicationId))fail('VIEW_CONFLICT','Publication ID already exists.');
      this.store.put('view_publications',publication.publicationId,publication);this.store.put('views',view.viewId,{...view,pendingPublicationId:publication.publicationId});this.buildRef('publication',publication.publicationId,input.buildId);this.transition(draft,{...attempt,publicationId:publication.publicationId},'mounting');return clone(publication);
    });
  }
  private pending(sessionId:string,input:FrameAuthorizationInput){
    const publication=this.store.get<ViewPublication>('view_publications',required(input.publicationId,'publicationId'));if(!publication||publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Candidate publication does not belong to this session.');
    const context=this.context(sessionId,{attemptId:input.attemptId,epoch:input.attemptEpoch},true);
    if(publication.attemptId!==input.attemptId||publication.attemptEpoch!==input.attemptEpoch||publication.candidateBuildId!==input.buildId||publication.viewId!==context.view.viewId||publication.state!=='mounting'||context.attempt.state!=='mounting'||context.view.pendingPublicationId!==publication.publicationId||context.view.viewRevision!==publication.expectedViewRevision)fail('ATTEMPT_SUPERSEDED','Candidate identity is no longer the pending view publication.');
    if(this.now().getTime()>Date.parse(publication.readyDeadlineAt))fail('FRAME_NOT_READY','Candidate readiness deadline expired.');
    return {...context,publication};
  }
  authorizeFrame(sessionId:string,input:FrameAuthorizationInput):ViewPublication {
    required(input.frameInstanceId,'frameInstanceId');required(input.documentNonce,'documentNonce');
    return this.store.transaction(()=>{const {publication}=this.pending(sessionId,input);if(publication.frameInstanceId&&(publication.frameInstanceId!==input.frameInstanceId||publication.documentNonce!==input.documentNonce))fail('ATTEMPT_SUPERSEDED','This publication already granted a different iframe document.');return this.store.put('view_publications',publication.publicationId,{...publication,frameInstanceId:input.frameInstanceId,documentNonce:input.documentNonce,updatedAt:this.stamp()});});
  }
  acceptsFrame(identity:CandidateFrameIdentity):boolean {
    try{if(identity.protocolVersion!=='2.0')return false;const {publication}=this.pending(identity.sessionId,identity);return publication.viewId===identity.viewId&&publication.frameInstanceId===identity.frameInstanceId&&publication.documentNonce===identity.documentNonce;}catch{return false;}
  }
  confirmReady(sessionId:string,input:RenderReadyInput):{publication:ViewPublication;view:AuthoringView} {
    return this.store.transaction(()=>{
      const existing=this.store.get<ViewPublication>('view_publications',input.publicationId);
      if(existing?.state==='mounted'&&existing.ownerSessionId===sessionId&&existing.viewId===input.viewId&&existing.attemptId===input.attemptId&&existing.attemptEpoch===input.attemptEpoch&&existing.candidateBuildId===input.buildId&&existing.frameInstanceId===input.frameInstanceId&&existing.documentNonce===input.documentNonce)return {publication:existing,view:this.view(sessionId,existing.viewId)};
      const {publication,attempt,draft,view}=this.pending(sessionId,input);
      if(input.viewId!==view.viewId||publication.frameInstanceId!==input.frameInstanceId||publication.documentNonce!==input.documentNonce)fail('ATTEMPT_SUPERSEDED','renderReady must come from the authorized candidate document.');
      const checks=input.checks;if(!checks||checks.rendered!==true||checks.bridgeReady!==true||checks.dataRead!==true||!Array.isArray(checks.unhandledErrors)||checks.unhandledErrors.length||!assertions(checks.assertionResults))fail('FRAME_RUNTIME_ERROR','Candidate has not completed real render/data/bridge checks.');
      const build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId);if(build?.verdict!=='PASS'||preview?.verdict!=='PASS'||preview.buildId!==input.buildId||build.archiveBuildId!==input.buildId||!this.sources.verify(input.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Candidate evidence became invalid before confirmation.');
      this.verifyReceiptFiles(attempt,build,preview);
      const next:AuthoringView={...view,source:clone(publication.source),activeBuildId:input.buildId,previousGoodBuildId:view.lastGoodBuildId,lastGoodBuildId:input.buildId,pendingPublicationId:null,validationStatus:'verified',viewRevision:view.viewRevision+1,updatedAt:this.stamp()};
      const mounted:ViewPublication={...publication,state:'mounted',committedViewRevision:next.viewRevision,updatedAt:this.stamp()};
      const revisionRecordId='view-revision:'+canonicalJson([sessionId,view.viewId,next.viewRevision]);
      this.store.put('provider_records',revisionRecordId,{appId:'apps',connectionId:'presentation',namespace:'view_revisions',recordId:revisionRecordId,value:next});
      this.store.put('views',view.viewId,next);this.store.put('view_publications',publication.publicationId,mounted);this.buildRef('view',view.viewId,input.buildId);this.transition(draft,attempt,'mounted');return {publication:clone(mounted),view:clone(next)};
    });
  }
  failMount(sessionId:string,publicationId:string,reason:string):ViewPublication {
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
      if(publication?.state==='mounting'){this.store.put('view_publications',publication.publicationId,{...publication,state:'cancelled',terminalReason:input.reason,updatedAt:this.stamp()});if(view.pendingPublicationId===publication.publicationId)this.store.put('views',view.viewId,{...view,pendingPublicationId:null});}
      return {status:'cancelled' as const,activeBuildId:view.activeBuildId,viewRevision:view.viewRevision};
    });
    if(notify)this.notifyCancellation(input.attemptId,input.expectedEpoch);
    return result;
  }
  inspect(sessionId:string,input:{attemptId?:string;publicationId?:string}){
    if(Boolean(input.attemptId)===Boolean(input.publicationId))fail('INVALID_INPUT','Inspect exactly one attempt or publication identity.');
    const publication=input.publicationId?this.store.get<ViewPublication>('view_publications',input.publicationId):undefined;
    const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',input.attemptId??publication?.attemptId??'');
    const draft=attempt&&this.store.get<AuthoringDraft>('authoring_drafts',attempt.draftId);if(!attempt||!draft||draft.ownerSessionId!==sessionId||publication&&publication.ownerSessionId!==sessionId)fail('VIEW_NOT_OWNED','Inspection identity is not owned.');
    const selected=publication??(attempt.publicationId?this.store.get<ViewPublication>('view_publications',attempt.publicationId):undefined);
    const workspacePath=this.resolvePath(draft.workspacePath);
    return {draft:{...draft,workspacePath},attempt,publication:selected??null,view:this.view(sessionId,draft.viewId),workspaceAvailable:existsSync(workspacePath),missingEvidence:[...(!attempt.buildReceiptId?['BuildReceipt']:[]),...(!attempt.previewReceiptId?['PreviewReceipt']:[])]};
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
    return result;
  }
  saveComponent(sessionId:string,input:SaveAuthoringInput):AppsComponent {
    required(input.userRequest,'userRequest');return this.store.transaction(()=>{
      const view=this.view(sessionId,input.viewId);if(view.viewRevision!==integer(input.expectedViewRevision,'expectedViewRevision')||view.pendingPublicationId)fail('VIEW_CONFLICT','Save requires the current confirmed view revision.');
      const publication=this.store.list<ViewPublication>('view_publications').find(row=>row.viewId===view.viewId&&row.ownerSessionId===sessionId&&row.state==='mounted'&&row.committedViewRevision===view.viewRevision&&row.candidateBuildId===view.activeBuildId);
      if(view.validationStatus!=='verified'||!publication||!view.source||!this.sources.verify(view.source.buildId).valid)fail('BUILD_EVIDENCE_INVALID','Only an explicitly confirmed authoring view may be saved through the new path.');
      const draft=this.store.list<AuthoringDraft>('authoring_drafts').find(row=>row.viewId===view.viewId&&row.ownerSessionId===sessionId&&row.status!=='discarded');
      const attempt=this.store.get<AuthoringAttempt>('authoring_attempts',publication.attemptId),build=this.store.get<BuildReceipt>('build_receipts',publication.buildReceiptId),preview=this.store.get<PreviewReceipt>('preview_receipts',publication.previewReceiptId);if(!attempt||build?.verdict!=='PASS'||preview?.verdict!=='PASS')fail('BUILD_EVIDENCE_INVALID','Confirmed view evidence is missing.');this.verifyReceiptFiles(attempt,build,preview);
      if(input.mode==='update'&&draft?.sourceComponentId&&(input.componentId!==draft.sourceComponentId||input.expectedRevision!==draft.baseRevisionAtOpen))fail('COMPONENT_CONFLICT','Update must compare the latest revision baseline captured when this component was opened.');
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
  exportUiState(sessionId:string,input:UiStateExportInput):UiStateSnapshot {
    const view=this.view(sessionId,input.viewId);integer(input.uiStateSchemaVersion,'uiStateSchemaVersion');integer(input.expectedStateRevision,'expectedStateRevision',0);
    if(view.activeBuildId!==input.sourceBuildId)fail('BRIDGE_IDENTITY_STALE','UI state must come from the active build.');
    if(Buffer.byteLength(canonicalJson(input.value))>(this.options.maxUiStateBytes??65536))fail('UI_STATE_TOO_LARGE','UI state exceeds its declared JSON byte limit.');
    if(!Array.isArray(input.selectionEvidence))fail('INVALID_INPUT','selectionEvidence must be explicit.');
    return this.store.transaction(()=>{const current=this.view(sessionId,input.viewId);if(current.activeBuildId!==input.sourceBuildId)fail('BRIDGE_IDENTITY_STALE','UI state build changed before export.');for(const selection of input.selectionEvidence){const binding=current.bindings.find(item=>item.bindingId===selection.bindingId);if(!binding||binding.datasetId!==selection.datasetId)fail('SELECTION_STALE','UI selection dataset identity changed.');if(!this.options.presentation.validateSelection)fail('UI_STATE_INCOMPATIBLE','No resource-selection validator is configured.');this.options.presentation.validateSelection(sessionId,input.viewId,selection);}const id=canonicalJson([sessionId,input.viewId]),previous=this.store.get<UiStateSnapshot>('view_ui_states',id);if((previous?.stateRevision??0)!==input.expectedStateRevision)fail('UI_STATE_CONFLICT','UI state revision changed.');const snapshot:UiStateSnapshot={sessionId,viewId:input.viewId,sourceBuildId:input.sourceBuildId,uiStateSchemaVersion:input.uiStateSchemaVersion,stateRevision:input.expectedStateRevision+1,value:clone(input.value),capturedAt:this.stamp(),selectionEvidence:clone(input.selectionEvidence)};this.store.put('view_ui_states',id,snapshot);this.buildRef('ui_state',id,input.sourceBuildId);return snapshot;});
  }
  restoreUiState(sessionId:string,input:UiStateRestoreInput,authorizedCandidate?:FrameAuthorizationInput){
    const view=this.view(sessionId,input.viewId),snapshot=this.store.get<UiStateSnapshot>('view_ui_states',canonicalJson([sessionId,input.viewId]));
    integer(input.uiStateSchemaVersion,'uiStateSchemaVersion');
    if(view.activeBuildId!==input.targetBuildId){
      if(!authorizedCandidate||authorizedCandidate.buildId!==input.targetBuildId)fail('BRIDGE_IDENTITY_STALE','UI state restore must target the active or an authorized pending build.');
      const {publication}=this.pending(sessionId,authorizedCandidate);if(publication.viewId!==input.viewId||publication.frameInstanceId!==authorizedCandidate.frameInstanceId||publication.documentNonce!==authorizedCandidate.documentNonce)fail('BRIDGE_IDENTITY_STALE','Candidate UI restore requires its authorized iframe document.');
    }
    if(!snapshot)return {status:'empty' as const,snapshot:null,removedSelections:[]};
    if(snapshot.uiStateSchemaVersion!==input.uiStateSchemaVersion)return {status:'incompatible' as const,code:'UI_STATE_INCOMPATIBLE',snapshot,removedSelections:[]};
    const valid:UiStateSnapshot['selectionEvidence']=[],removedSelections:{bindingId:string;resource:ResourceRef;reason:string}[]=[];
    for(const selection of snapshot.selectionEvidence){const resources:ResourceRef[]=[];for(const resource of selection.resources){try{const binding=view.bindings.find(item=>item.bindingId===selection.bindingId);if(!binding||binding.datasetId!==selection.datasetId)fail('SELECTION_STALE','UI selection dataset identity changed.');if(!this.options.presentation.validateSelection)fail('UI_STATE_INCOMPATIBLE','No selection validator.');this.options.presentation.validateSelection(sessionId,input.viewId,{...selection,resources:[resource]});resources.push(clone(resource));}catch(error){removedSelections.push({bindingId:selection.bindingId,resource:clone(resource),reason:error instanceof Error?error.message:String(error)});}}if(resources.length)valid.push({...selection,resources});}
    return {status:'restored' as const,snapshot:{...snapshot,selectionEvidence:valid},removedSelections};
  }
  closeDraft(sessionId:string,viewId:string,action:'keep'|'discard'):AuthoringDraft {
    this.view(sessionId,viewId);if(!['keep','discard'].includes(action))fail('INVALID_INPUT','Explicit keep/discard action is required.');
    const drafts=this.store.list<AuthoringDraft>('authoring_drafts').filter(row=>row.ownerSessionId===sessionId&&row.viewId===viewId),draft=drafts.find(row=>row.status!=='discarded')??drafts.at(-1);if(!draft)fail('DRAFT_NOT_FOUND','This view has no authoring draft.');
    const active=this.store.list<AuthoringAttempt>('authoring_attempts').find(row=>row.draftId===draft.draftId&&row.epoch===draft.epoch&&!terminal.has(row.state));if(active)this.cancel(sessionId,{attemptId:active.attemptId,expectedEpoch:active.epoch,reason:`User closed draft: ${action}.`});
    return this.store.transaction(()=>{const current=this.store.get<AuthoringDraft>('authoring_drafts',draft.draftId)!;return this.store.put('authoring_drafts',current.draftId,{...current,status:action==='keep'?'closed':'discarded',updatedAt:this.stamp()});});
  }
  async execute(context:ExecutionContext):Promise<CapabilityResult> {
    const {request}=context,sessionId='sessionId' in request.source?request.source.sessionId:undefined;
    try{if(!sessionId)fail('SESSION_REQUIRED','Authoring requires an original owning session.');const input=request.input as unknown as Record<string,unknown>;let output:unknown;
      switch(request.capabilityId){
        case 'apps.authoring.begin':output=this.begin(sessionId,input as unknown as BeginAuthoringInput);break;
        case 'apps.authoring.record_build':output=await this.recordBuild(sessionId,input as unknown as RecordBuildInput);break;
        case 'apps.authoring.record_preview':output=await this.recordPreview(sessionId,input as unknown as RecordPreviewInput);break;
        case 'apps.authoring.publish':output=this.publish(sessionId,input as unknown as PublishAuthoringInput);break;
        case 'apps.authoring.inspect':output=this.inspect(sessionId,input as {attemptId?:string;publicationId?:string});break;
        case 'apps.authoring.cancel':output=this.cancel(sessionId,input as unknown as {attemptId:string;expectedEpoch:number;reason:string});break;
        case 'apps.authoring.save_component':output=this.saveComponent(sessionId,input as unknown as SaveAuthoringInput);break;
        default:fail('CAPABILITY_NOT_FOUND','Unknown authoring action.');
      }
      return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:JSON.parse(canonicalJson(output)) as JsonValue};
    }catch(error){return {status:'failed',invocationId:request.invocationId,traceId:request.traceId,error:{code:(error as {code?:string}).code??'AUTHORING_FAILED',message:error instanceof Error?error.message:String(error),retryPolicy:'never'}};}
  }
}
