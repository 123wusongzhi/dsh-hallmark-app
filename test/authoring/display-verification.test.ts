import test from 'node:test';
import assert from 'node:assert/strict';
import fs,{mkdtempSync,mkdirSync,readFileSync,renameSync,rmSync,statSync,symlinkSync,utimesSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../packages/app-presentation/src/authoring.ts';
import type {AuthoringView,CandidateFrameIdentity,DisplayFrameAuthorizationInput,PreviewValidationEvidence,ViewPublication} from '../../packages/app-presentation/src/authoring-types.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {FileVerificationCache,regularFilePathIdentity} from '../../packages/source-components/src/file-verification-cache.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../../packages/source-components/src/authoring-evidence.ts';
import type {CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';
import {performanceEvidence} from './performance-fixture.ts';

// B1: every reuse checks archive membership and file identities; unchanged bytes avoid repeated hashing.
const session='verify-session-a',channel='dsh.apps.component.v2';
const assertions=[{id:'unit-coverage',required:true,expected:'Fixture metadata passes',actual:'Fixture metadata passes',status:'PASS' as const,evidenceRefs:[]}];
const descriptor:CapabilityDescriptor={capabilityId:'notes.list',version:'1.0.0',title:'Notes fixture',description:'Read-only test data',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const binding:DatasetBinding={bindingId:'notes',appId:'notes',connectionId:'notes-test',capabilityId:'notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
type Fixture=ReturnType<typeof setup>;
function setup(t:{after:(action:()=>void)=>void},clock?:()=>Date){
  const directory=mkdtempSync(join(tmpdir(),'apps-verify-')),store=new RuntimeStore(':memory:'),sources=new SourceComponentStore(join(directory,'sources')),runner=new AuthoringEvidenceRunner(join(directory,'evidence'));
  t.after(()=>{store.close();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'apps-verify-'))));rmSync(directory,{recursive:true,force:true});});
  // A large payload forces the chunked data-transfer path that parallel reads exercise.
  const runtime={describe:()=>descriptor,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{resources:['a','b'].map(resourceId=>({appId:'notes',connectionId:'notes-test',resourceType:'note',resourceId})),blob:'x'.repeat(400_000)} as unknown as JsonValue})};
  const presentation=new AppsPresentationService({store,sources,runtime}),authoring=new AppsAuthoringService({store,sources,presentation,evidenceRoot:runner.root,...(clock?{clock}:{}),
    validateBuildEvidence:ref=>runner.verifyBuild(ref,sources,{allowFailure:true}),validatePreviewEvidence:ref=>runner.readReport<PreviewValidationEvidence>(ref)});
  presentation.authoring=authoring;
  return {directory,store,sources,runner,runtime,presentation,authoring};
}
type Begin=ReturnType<AppsAuthoringService['begin']>;
function project(begin:Begin,title:string){
  const directory=begin.draft.workspacePath;mkdirSync(join(directory,'src'),{recursive:true});
  writeFileSync(join(directory,'package-lock.json'),'{}');writeFileSync(join(directory,'package.json'),'{}');writeFileSync(join(directory,'src','Component.tsx'),`export const title=${JSON.stringify(title)};`);
  writeFileSync(join(directory,'build.mjs'),`import {mkdirSync,writeFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html',${JSON.stringify(`<button>${title}</button>`)});`);
}
async function prepare(f:Fixture,begin:Begin,title:string){
  project(begin,title);
  const executed=await f.runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:begin.draft.workspacePath,command:[process.execPath,'build.mjs'],sources:f.sources});
  const built=await f.authoring.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef});
  const screenshotPath=join(f.runner.root,`fixture-${begin.attempt.attemptId}.png`);writeFileSync(screenshotPath,Buffer.from('backend-fixture-evidence '+title));
  const screenshot=evidenceFile(screenshotPath),at=new Date().toISOString();
  const report:PreviewValidationEvidence={schemaVersion:1,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,buildId:built.archiveBuildId!,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'backend-unit-fixture/1',startedAt:at,finishedAt:at,viewportResults:[420,1040].map(width=>({id:`fixture-${width}`,contentWidthCssPx:width,heightCssPx:800,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['unit-coverage'],interactionCaseIds:[]})),assertionResults:structuredClone(assertions),verdict:'PASS',performance:performanceEvidence()};
  const tested=await f.authoring.recordPreview(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,reportRef:f.runner.writeReport('preview',report)});
  const publication=f.authoring.publish(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:built.archiveBuildId!,buildReceiptId:built.receiptId,previewReceiptId:tested.receiptId});
  return {begin,built,tested,publication,screenshotPath};
}
const openInput=(p:ViewPublication)=>({viewId:p.viewId,publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,buildId:p.candidateBuildId,expectedViewRevision:p.expectedViewRevision});
const frameFor=(p:ViewPublication,display:{displayId:string;generation:number},suffix:string):DisplayFrameAuthorizationInput=>({publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,viewId:p.viewId,buildId:p.candidateBuildId,displayId:display.displayId,displayGeneration:display.generation,frameInstanceId:'frame-'+suffix,documentNonce:'nonce-'+suffix});
/** A published candidate with an opened display and one granted iframe document, plus a way to issue requests like the HTTP route does (one host per request). */
async function opened(t:{after:(action:()=>void)=>void},options:{clock?:()=>Date;displayId?:string}={}){
  const f=setup(t,options.clock),begin=f.authoring.begin(session,{mode:'new',bindings:[binding]}),p=await prepare(f,begin,'Verified once');
  await f.presentation.refreshView(session,begin.view.viewId,{kind:'agent',sessionId:session,nativeCallId:'initial'});
  const displayId=options.displayId??'display-one',open=f.authoring.openDisplay(session,{...openInput(p.publication),displayId}),frame=frameFor(p.publication,open.display,displayId);
  f.authoring.authorizeDisplayFrame(session,frame);
  const identity={protocolVersion:'2.0' as const,sessionId:session,viewId:frame.viewId,buildId:frame.buildId,frameInstanceId:frame.frameInstanceId},candidate:CandidateFrameIdentity={...frame,...identity};
  let id=0;
  const call=async(feature:'dataTransferV1'|'bindingPagesV1'|'uiStateV1',action:string,params:Record<string,unknown>)=>{
    const host=f.presentation.createHost(identity,{candidate,clientFeatures:['dataTransferV1','bindingPagesV1','uiStateV1','renderReadyV1']});
    try{return await host.handle({...identity,channel,requestId:'r'+(++id),type:'extension',feature,action,params:{documentNonce:frame.documentNonce,...params}}) as any;}finally{host.dispose();}
  };
  const transfer=async()=>{const prepared=await call('dataTransferV1','prepare',{method:'getData'});assert.equal(prepared.error,undefined,JSON.stringify(prepared));assert.ok(prepared.result.transfer,'payload is chunked');return prepared.result.transfer as {id:string;chunks:number};};
  return {f,begin,p,open,frame,identity,candidate,call,transfer};
}
type Opened=Awaited<ReturnType<typeof opened>>;

async function countFs<T>(work:()=>Promise<T>):Promise<{result:T;lstat:number;read:number}>{
  const lstat=fs.lstatSync,read=fs.readFileSync;let lstats=0,reads=0;
  (fs as unknown as {lstatSync:unknown}).lstatSync=((...args:unknown[])=>{lstats++;return (lstat as (...input:unknown[])=>unknown)(...args);}) as typeof fs.lstatSync;
  (fs as unknown as {readFileSync:unknown}).readFileSync=((...args:unknown[])=>{reads++;return (read as (...input:unknown[])=>unknown)(...args);}) as typeof fs.readFileSync;
  syncBuiltinESMExports();
  try{return {result:await work(),lstat:lstats,read:reads};}finally{(fs as unknown as {lstatSync:unknown;readFileSync:unknown}).lstatSync=lstat;(fs as unknown as {readFileSync:unknown}).readFileSync=read;syncBuiltinESMExports();}
}
/** Counts the expensive steps of one verification: displayTarget runs, receipt-file verification, manifest and archive reads. */
function instrument(f:Fixture){
  const counts={displayTarget:0,receiptFiles:0,manifest:0,archiveVerify:0};
  const wrap=(target:object,name:string,key:keyof typeof counts)=>{const original=(target as Record<string,(...args:unknown[])=>unknown>)[name].bind(target);(target as Record<string,unknown>)[name]=(...args:unknown[])=>{counts[key]++;return original(...args);};};
  wrap(f.authoring,'displayTarget','displayTarget');wrap(f.authoring,'verifyReceiptFiles','receiptFiles');wrap(f.sources,'manifest','manifest');wrap(f.sources,'verify','archiveVerify');
  return counts;
}
const noFullVerification=(counts:ReturnType<typeof instrument>)=>({displayTarget:counts.displayTarget,receiptFiles:counts.receiptFiles,manifest:counts.manifest});
const zeroFull={displayTarget:0,receiptFiles:0,manifest:0};

test('parallel chunk reads after open and grant trigger no further complete verification',async t=>{
  const o=await opened(t),manifest=o.f.sources.manifest(o.frame.buildId)!,counts=instrument(o.f),transfer=await o.transfer();
  assert.ok(transfer.chunks>=4,'enough chunks for parallel reads');
  const before={...o.f.authoring.verification},hashes={archive:o.f.sources.verification.hashPasses,evidence:o.f.authoring.evidenceVerification.hashes};
  const reads=await countFs(()=>Promise.all([0,1,2,3].map(index=>o.call('dataTransferV1','read',{id:transfer.id,index}))));
  for(const [index,response] of reads.result.entries()){assert.equal(response.error,undefined,JSON.stringify(response.error));assert.equal(response.result.index,index);}
  assert.deepEqual(noFullVerification(counts),zeroFull,'chunk reads reuse the complete verification');
  assert.ok(counts.archiveVerify>0,'every read still checks archive membership and file identities');
  assert.equal(o.f.sources.verification.hashPasses,hashes.archive,'unchanged archives are not rehashed');
  assert.equal(o.f.authoring.evidenceVerification.hashes,hashes.evidence,'unchanged evidence is not rehashed');
  assert.equal(o.f.authoring.verification.full,before.full);
  const hitsPerRead=(o.f.authoring.verification.cached-before.cached)/4;
  assert.ok(reads.lstat>0,'evidence/archive identities are checked on chunk reads');assert.equal(reads.read,0,'unchanged files are not reread');
  assert.ok(reads.lstat<=4*hitsPerRead*(manifest.projectFiles.length+64),'metadata work remains bounded by this archive and its receipt files');
  // getData, prepare and readBindingPage (the other read paths) also reuse the verification.
  const data=await o.call('dataTransferV1','prepare',{method:'readBindingPage',bindingId:'notes',cursor:null});assert.equal(data.error,undefined,JSON.stringify(data.error));
  assert.equal(o.f.presentation.getData(session,o.frame.viewId,{publicationId:o.frame.publicationId,buildId:o.frame.buildId,displayId:o.frame.displayId,displayGeneration:o.frame.displayGeneration}).bindings.length,1);
  assert.deepEqual(noFullVerification(counts),zeroFull);
  // The same reads with reuse disabled: every record check becomes a complete verification.
  o.f.authoring.verifiedDisplays.ttlMs=0;
  await Promise.all([0,1,2,3].map(index=>o.call('dataTransferV1','read',{id:transfer.id,index})));
  assert.ok(counts.displayTarget>=4,'without reuse each read verifies completely');
  // Emulates the former lookup (acceptsDisplayFrame, then display: two complete runs each) with reuse still disabled.
  const lookup=o.f.authoring.acceptedDisplay.bind(o.f.authoring),beforeLegacy=counts.displayTarget;
  o.f.authoring.acceptedDisplay=identity=>{lookup(identity);return lookup(identity);};
  await Promise.all([0,1,2,3].map(index=>o.call('dataTransferV1','read',{id:transfer.id,index})));
  const legacy=counts.displayTarget-beforeLegacy;
  console.log(JSON.stringify({metric:'display-read-verification',parallelChunkReads:4,completeVerificationsWithReuse:0,completeVerificationsWithoutReuse:counts.displayTarget-legacy,completeVerificationsFormerLookupPattern:legacy,fingerprintChecksPerRead:hitsPerRead,metadataChecks:reads.lstat,archiveFiles:manifest.projectFiles.length}));
});

test('a repeated frame grant verifies completely once and ready is a verification point',async t=>{
  const o=await opened(t),counts=instrument(o.f);
  o.f.authoring.authorizeDisplayFrame(session,o.frame);
  assert.equal(counts.displayTarget,1,'frame grant verifies the target once, not once per lookup');assert.ok(counts.archiveVerify>=1);assert.equal(counts.receiptFiles,1);
  counts.displayTarget=0;
  const ready=o.f.authoring.confirmDisplayReady(session,{...o.frame,viewId:o.frame.viewId,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:structuredClone(assertions)}});
  assert.equal(ready.publication.state,'mounted');assert.equal(counts.displayTarget,1,'ready receipt verifies once');
  // The commit changed the fingerprint: one verification of the mounted state, then reuse again.
  const transfer=await o.transfer();counts.displayTarget=0;
  await Promise.all([0,1,2].map(index=>o.call('dataTransferV1','read',{id:transfer.id,index})));
  assert.equal(counts.displayTarget,0);
});

test('every change to a record the verification depended on invalidates the next read',async t=>{
  const scenarios:[string,(o:Opened)=>void|Promise<void>][]=[
    ['cancel',o=>{o.f.authoring.cancel(session,{attemptId:o.open.display.attemptId,expectedEpoch:o.open.display.attemptEpoch,reason:'Explicit cancellation'});}],
    ['supersede by a new explicit attempt',o=>{o.f.authoring.begin(session,{mode:'edit',viewId:o.frame.viewId});}],
    ['failed display',o=>{o.f.authoring.reportDisplayError(session,{...o.frame,error:{phase:'render',code:'COMPONENT_SCRIPT_ERROR',message:'boom'}});}],
    ['a newer display retires this one',o=>{o.f.authoring.openDisplay(session,{...openInput(o.p.publication),displayId:'display-newer'});}],
    ['publication marked superseded',o=>{o.f.store.put('view_publications',o.frame.publicationId,{...o.f.store.get<ViewPublication>('view_publications',o.frame.publicationId)!,state:'superseded',updatedAt:new Date().toISOString()});}],
    ['view revision changed',o=>{const view=o.f.store.get<AuthoringView>('views',o.frame.viewId)!;o.f.store.put('views',o.frame.viewId,{...view,viewRevision:view.viewRevision+1});}],
    ['view bindings changed',o=>{const view=o.f.store.get<AuthoringView>('views',o.frame.viewId)!;o.f.store.put('views',o.frame.viewId,{...view,bindings:[]});}],
    ['another pending publication',o=>{const view=o.f.store.get<AuthoringView>('views',o.frame.viewId)!;o.f.store.put('views',o.frame.viewId,{...view,pendingPublicationId:'someone-else'});}],
    ['attempt epoch changed',o=>{const attempt=o.f.store.get<{epoch:number}>('authoring_attempts',o.frame.attemptId)!;o.f.store.put('authoring_attempts',o.frame.attemptId,{...attempt,epoch:attempt.epoch+1});}],
  ];
  for(const [name,change] of scenarios){
    const o=await opened(t,{displayId:'display-'+name.replace(/\W+/g,'-')});
    assert.ok(o.f.authoring.acceptedDisplay(o.candidate),name+': accepted before');assert.equal(o.f.authoring.verifiedDisplays.size>0,true,name+': remembered');
    const hits=o.f.authoring.verification.cached;assert.ok(o.f.authoring.acceptedDisplay(o.candidate));assert.equal(o.f.authoring.verification.cached,hits+1,name+': served from the remembered verification');
    await change(o);
    assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined,name+': rejected after the change');
    assert.equal(o.f.authoring.acceptsDisplayFrame(o.candidate),false,name);
    await assert.rejects(()=>o.call('dataTransferV1','prepare',{method:'getData'}),{code:'BRIDGE_IDENTITY_STALE'},name+': data transfer refused');
    assert.throws(()=>o.f.presentation.getData(session,o.frame.viewId,{publicationId:o.frame.publicationId,buildId:o.frame.buildId,displayId:o.frame.displayId,displayGeneration:o.frame.displayGeneration}),Error,name+': getData refused');
  }
});

test('mounted displays are rejected once a newer display retires them',async t=>{
  const o=await opened(t),ready=o.f.authoring.confirmDisplayReady(session,{...o.frame,viewId:o.frame.viewId,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:structuredClone(assertions)}});
  assert.equal(ready.display.state,'ready');assert.ok(o.f.authoring.acceptedDisplay(o.candidate));assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
  const second=o.f.authoring.begin(session,{mode:'edit',viewId:o.frame.viewId}),next=await prepare(o.f,second,'Second build');
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'a newer unopened publication does not displace the live display');
  o.f.authoring.openDisplay(session,{...openInput(next.publication),displayId:'display-two'});
  assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);
  assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'BRIDGE_IDENTITY_STALE'});
});

test('receipt and archive tampering is rejected inside the TTL, after invalidation and on every frame grant',async t=>{
  let now=Date.parse('2026-10-15T00:00:00.000Z');const o=await opened(t,{clock:()=>new Date(now)}),counts=instrument(o.f);
  const original=readFileSync(o.p.screenshotPath),tamper=()=>writeFileSync(o.p.screenshotPath,Buffer.from('tampered evidence with another length'));
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
  tamper();assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined,'changed evidence is rejected immediately inside the TTL');
  // Explicit invalidation forces the complete verification at once.
  o.f.authoring.invalidateVerifiedDisplays();assert.equal(o.f.authoring.verifiedDisplays.size,0);
  assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);
  assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'EVIDENCE_HASH_MISMATCH'});
  assert.equal(o.f.authoring.verifiedDisplays.size,0,'failures are never remembered');
  assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'EVIDENCE_HASH_MISMATCH'},'still failing, not served from a stale success');
  writeFileSync(o.p.screenshotPath,original);
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'restored evidence verifies again');assert.equal(o.f.authoring.verifiedDisplays.size,1);
  // TTL expiry: the entry is dropped and the complete verification runs again.
  const complete=counts.displayTarget;
  now+=o.f.authoring.verifiedDisplays.ttlMs-1;assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'unchanged evidence reuses the proof inside the TTL');assert.equal(counts.displayTarget,complete);
  now+=1;assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'unchanged evidence passes again after TTL expiry');assert.equal(counts.displayTarget,complete+1);
  // A frame grant always verifies completely, even while an entry is remembered.
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));tamper();
  assert.throws(()=>o.f.authoring.authorizeDisplayFrame(session,o.frame),{code:'EVIDENCE_HASH_MISMATCH'});
  writeFileSync(o.p.screenshotPath,original);
  // The archive is checked the same way.
  const archived=join(o.f.sources.directory,'builds',o.frame.buildId,'project','dist','index.html'),archivedBytes=readFileSync(archived);
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));writeFileSync(archived,'changed verified archive');
  assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined,'archive tampering is rejected without invalidation or TTL expiry');
  assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'BUILD_EVIDENCE_INVALID'});
  writeFileSync(archived,archivedBytes);assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
});

test('same-size evidence and archive writes with restored mtime invalidate warm display proofs',async t=>{
  const o=await opened(t),archived=join(o.f.sources.directory,'builds',o.frame.buildId,'project','dist','index.html');
  for(const [path,code] of [[o.p.screenshotPath,'EVIDENCE_HASH_MISMATCH'],[archived,'BUILD_EVIDENCE_INVALID']]){
    const original=readFileSync(path),time=new Date('2026-10-14T00:00:00.000Z');utimesSync(path,time,time);
    assert.ok(o.f.authoring.acceptedDisplay(o.candidate));assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
    const before=statSync(path,{bigint:true}),changed=Buffer.from(original);changed[0]^=1;
    writeFileSync(path,changed);utimesSync(path,time,time);
    const after=statSync(path,{bigint:true});assert.equal(after.size,before.size);assert.equal(after.mtimeNs,before.mtimeNs,'mtime is restored exactly');
    assert.notEqual(after.ctimeNs,before.ctimeNs,'ctime records the write even when size and mtime match');
    assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);
    assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code});
    writeFileSync(path,original);assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'restored immutable bytes verify again');
  }
});

test('warm display proofs reject added and removed archive members before the TTL expires',async t=>{
  const o=await opened(t),project=join(o.f.sources.directory,'builds',o.frame.buildId,'project'),extra=join(project,'unexpected.txt'),path=join(project,'dist','index.html'),bytes=readFileSync(path);
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));writeFileSync(extra,'new member');
  assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'BUILD_EVIDENCE_INVALID'});
  rmSync(extra);assert.ok(o.f.authoring.acceptedDisplay(o.candidate));rmSync(path);
  assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'BUILD_EVIDENCE_INVALID'});
  writeFileSync(path,bytes);assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
});

test('warm display and byte caches reject directory symlink substitutions with identical file bytes',async t=>{
  const o=await opened(t),project=join(o.f.sources.directory,'builds',o.frame.buildId,'project'),dist=join(project,'dist'),moved=join(o.f.directory,'original-dist');
  const file=join(dist,'index.html'),reference=evidenceFile(file),cache=new FileVerificationCache();
  cache.read(file,reference.sha256,reference.bytes);assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
  renameSync(dist,moved);symlinkSync(moved,dist,process.platform==='win32'?'junction':'dir');
  try{
    assert.equal(readFileSync(file).toString(),readFileSync(join(moved,'index.html')).toString(),'the link exposes the exact original bytes');
    assert.throws(()=>regularFilePathIdentity(file),/DIRECTORY_REQUIRED/);assert.throws(()=>cache.read(file,reference.sha256,reference.bytes),/DIRECTORY_REQUIRED/);
    assert.equal(o.f.sources.verify(o.frame.buildId).valid,false);assert.equal(o.f.authoring.acceptedDisplay(o.candidate),undefined);
    assert.throws(()=>o.f.authoring.display(session,o.candidate as never),{code:'BUILD_EVIDENCE_INVALID'});
  }finally{fs.unlinkSync(dist);renameSync(moved,dist);}
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'restored regular directories and bytes pass full verification');
});

test('unchanged archive and evidence identities remain valid across fresh Node processes',async t=>{
  const o=await opened(t),archived=join(o.f.sources.directory,'builds',o.frame.buildId,'project','dist','index.html');
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
  const input={directory:o.f.sources.directory,buildId:o.frame.buildId,archivePath:archived,evidence:evidenceFile(o.p.screenshotPath)};
  const sourceModule=pathToFileURL(resolve('packages/source-components/src/index.ts')).href,cacheModule=pathToFileURL(resolve('packages/source-components/src/file-verification-cache.ts')).href;
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {SourceComponentStore} from ${JSON.stringify(sourceModule)};import {FileVerificationCache,regularFilePathIdentity} from ${JSON.stringify(cacheModule)};const input=JSON.parse(process.env.DSH_INTEGRITY_RESTART_INPUT);const sources=new SourceComponentStore(input.directory),cache=new FileVerificationCache();cache.verify(input.evidence.path,input.evidence.sha256,input.evidence.bytes);const cold=sources.verify(input.buildId),hashes=sources.verification.hashPasses,warm=sources.verify(input.buildId);process.stdout.write(JSON.stringify({cold,warm,hashes,warmHashes:sources.verification.hashPasses,archiveIdentity:regularFilePathIdentity(input.archivePath),evidenceIdentity:regularFilePathIdentity(input.evidence.path)}));`],{encoding:'utf8',windowsHide:true,timeout:15_000,env:{...process.env,DSH_INTEGRITY_RESTART_INPUT:JSON.stringify(input)}});
  assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);
  assert.deepEqual(result.cold,{valid:true,errors:[]});assert.deepEqual(result.warm,{valid:true,errors:[]});assert.equal(result.hashes,1);assert.equal(result.warmHashes,1,'fresh process validates bytes once before reusing its own proof');
  assert.equal(result.archiveIdentity,regularFilePathIdentity(archived));assert.equal(result.evidenceIdentity,regularFilePathIdentity(o.p.screenshotPath));
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
});

test('verification is never shared across sessions or other identities',async t=>{
  const o=await opened(t);assert.ok(o.f.authoring.acceptedDisplay(o.candidate));assert.ok(o.f.authoring.acceptedDisplay(o.candidate));
  assert.equal(o.f.authoring.acceptedDisplay({...o.candidate,sessionId:'other-session'}),undefined);
  assert.throws(()=>o.f.authoring.display('other-session',o.candidate as never),{code:'VIEW_NOT_OWNED'});
  for(const wrong of [{displayGeneration:o.candidate.displayGeneration!+1},{buildId:'f'.repeat(64)},{publicationId:'other-publication'},{documentNonce:'other-nonce'},{frameInstanceId:'other-frame'},{attemptEpoch:o.candidate.attemptEpoch+1},{attemptId:'other-attempt'}])
    assert.equal(o.f.authoring.acceptedDisplay({...o.candidate,...wrong}),undefined,JSON.stringify(wrong));
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'the exact identity is still accepted');
});

test('the remembered set is bounded and recovery clears it',async t=>{
  const o=await opened(t);o.f.authoring.verifiedDisplays.maxEntries=1;
  const record=o.f.store.get<{value:{generation:number}}>('provider_records','component-display:'+o.frame.displayId)!;assert.ok(record);
  // Distinct identities evict the least recently used entry.
  for(const generation of [10,11,12])(o.f.authoring as unknown as {rememberVerified(session:string,display:unknown):void}).rememberVerified(session,{...record.value,generation});
  assert.ok(o.f.authoring.verifiedDisplays.size<=1);
});

test('runtime recovery drops every remembered verification',async t=>{
  const o=await opened(t);assert.ok(o.f.authoring.verifiedDisplays.size>0);o.f.authoring.recoverInterrupted();assert.equal(o.f.authoring.verifiedDisplays.size,0);
  assert.ok(o.f.authoring.acceptedDisplay(o.candidate),'the unchanged display verifies completely again');assert.equal(o.f.authoring.verifiedDisplays.size,1);
});
