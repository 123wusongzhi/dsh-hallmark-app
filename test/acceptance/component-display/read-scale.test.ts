import test from 'node:test';
import assert from 'node:assert/strict';
import fs,{mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {join,resolve} from 'node:path';
import {cpus,freemem,totalmem,release} from 'node:os';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {spawn} from 'node:child_process';
import {PROVIDER_RECORD_SCOPE_SQL} from '../../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../../packages/app-presentation/src/authoring.ts';
import {SourceComponentStore} from '../../../packages/source-components/src/index.ts';
import {createFixture,openInput,session,features,environment,sleep,sha} from './fixture.ts';

// These are broad regression tripwires, not a service SLA. Work counts are the primary assertions.
const budgets={coldDisplayMs:10_000,chunkP95Ms:500,eventLoopMaxMs:1500};
const samples={coldDisplays:3,chunkRequests:64,parallelism:4,eventLoopResolutionMs:10};
const timing=process.env.DSH_DISPLAY_PERFORMANCE==='1';
const output=resolve('artifacts/component-display-reliability',timing?'c1-read-scale.json':`c1-workload-${process.pid}-${Date.now()}.json`);
function stats(values:number[]){const sorted=[...values].sort((a,b)=>a-b);return {n:values.length,minMs:sorted[0],p50Ms:sorted[Math.ceil(sorted.length*.5)-1],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),samplesMs:values};}
async function counted<T>(work:()=>Promise<T>){
  const read=fs.readFileSync,lstat=fs.lstatSync,parse=JSON.parse;const counts={fileReads:0,lstats:0,jsonParses:0,jsonParseBytes:0};
  fs.readFileSync=((...args:any[])=>{counts.fileReads++;return (read as any)(...args);}) as typeof read;
  (fs as unknown as {lstatSync:typeof fs.lstatSync}).lstatSync=((...args:any[])=>{counts.lstats++;return (lstat as any)(...args);}) as typeof lstat;
  JSON.parse=((text:string,...args:any[])=>{counts.jsonParses++;counts.jsonParseBytes+=Buffer.byteLength(String(text));return (parse as any)(text,...args);}) as typeof parse;
  syncBuiltinESMExports();try{return {value:await work(),counts};}finally{fs.readFileSync=read;(fs as unknown as {lstatSync:typeof fs.lstatSync}).lstatSync=lstat;JSON.parse=parse;syncBuiltinESMExports();}
}

test('C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded', {timeout:120_000},async()=>{
  const started=performance.now(),f=await createFixture(),report:any={status:'FAIL',scope:timing?'ISOLATED_OFFLINE_READ_SCALE':'DETERMINISTIC_OFFLINE_READ_WORKLOAD',budgetsEnforced:timing,notSLA:true,environment:{...environment(),concurrency:timing?'dedicated opt-in runner; do not run alongside the full suite':'ordinary test runner; deterministic assertions only, timings are diagnostics',os:release(),cpu:cpus()[0]?.model,cpuCount:cpus().length,totalMemoryBytes:totalmem(),freeMemoryAtStartBytes:freemem()},budgets,samplePlan:samples,previewAdmission:'Existing backend control receipts; not browser preview or UI performance certification',pending:['W6 asynchronous preparation/progress/no-progress deadline','W7 actual process restart and display recovery']};
  let delay:ReturnType<typeof monitorEventLoopDelay>|undefined;
  try{
    const candidate=await f.prepare('C1 read-scale'),p=candidate.publication;
    // Existing immutable revision records and a separately-owned view exercise the production build index.
    const historical=f.presentation.openSource(session,join(candidate.begin.draft.workspacePath),{title:'Historical lookup'});
    const lookup=()=>f.request(`/v1/views/${historical.viewId}?sessionId=${session}&buildId=${historical.source!.buildId}`);
    await lookup(); // Exclude one-time HTTP/Undici initialization from the identical warm-work comparison.
    const quietScope=await counted(async()=>f.store.providerRecordScopeCandidates('displayreplay','offline','captured_load'));assert.deepEqual(quietScope.value,[]);
    const quiet=await counted(lookup);assert.equal(quiet.value.viewId,historical.viewId);
    report.load=f.seedBytes();assert.ok(report.load.bytes>=49_000_000&&report.load.bytes<50_000_000);
    const loaded=await counted(lookup);assert.deepEqual(loaded.value,quiet.value);
    assert.deepEqual(loaded.counts,quiet.counts,'unrelated 49 MB must not increase parsed work or archive reads');
    const query="SELECT json_extract(value_json,'$.value') AS value_json FROM provider_records WHERE json_extract(value_json,'$.namespace')='view_revisions' AND json_extract(value_json,'$.value.ownerSessionId')=?1 AND json_extract(value_json,'$.value.viewId')=?2 AND json_extract(value_json,'$.value.source.buildId')=?3 ORDER BY created_at,id";
    const plan=f.store.db.prepare('EXPLAIN QUERY PLAN '+query).all({'?1':session,'?2':historical.viewId,'?3':historical.source!.buildId});
    assert.match(JSON.stringify(plan),/SEARCH.*provider_records_view_revisions/);
    const scopePlan=f.store.db.prepare('EXPLAIN QUERY PLAN '+PROVIDER_RECORD_SCOPE_SQL).all({'?1':'displayreplay','?2':'offline','?3':'captured_load'});assert.match(JSON.stringify(scopePlan),/SEARCH.*provider_records_namespace_connection/);assert.match(JSON.stringify(scopePlan),/provider_records_irregular/);
    const loadedScope=await counted(async()=>f.store.providerRecordScopeCandidates('displayreplay','offline','captured_load'));assert.deepEqual(loadedScope.value,[]);assert.deepEqual(loadedScope.counts,quietScope.counts);
    report.index={before:quiet.counts,after:loaded.counts,plan,scopePlan,scopeBefore:quietScope.counts,scopeAfter:loadedScope.counts};
    const processes=[];
    for(let index=0;index<(timing?samples.coldDisplays:0);index++){
      const at=performance.now(),child=spawn(process.execPath,[resolve('test/acceptance/component-display/cold-start.mjs'),f.directory,p.publicationId,'cold-process-'+index],{stdio:['ignore','pipe','pipe'],windowsHide:true});
      let stdout='',stderr='';child.stdout.on('data',part=>stdout+=part);child.stderr.on('data',part=>stderr+=part);
      const timer=setTimeout(()=>child.kill(),15_000);
      try{const code=await new Promise<number|null>((done,reject)=>{child.once('error',reject);child.once('exit',done);});assert.equal(code,0,stderr);processes.push({...JSON.parse(stdout),processWallMs:performance.now()-at});}finally{clearTimeout(timer);}
    }
    report.processCold={wall:processes.length?stats(processes.map(item=>item.processWallMs)):null,samples:processes,definition:'Fresh child Node imports + RuntimeStore/AppsRuntime/Presentation/Authoring/Source caches -> first snapshot; prebuilt DB/receipts, no scheduler/provider/HTTP bootstrap, OS cache not flushed'};
    if(timing){assert.ok(report.processCold.wall!.maxMs!<=budgets.coldDisplayMs);assert.ok(processes.every(item=>item.eventLoopMaxMs<=budgets.eventLoopMaxMs));}
    // Fresh service/source/evidence caches over the preseeded SQLite connection. Disk/OS cache is explicitly not cold.
    const coldMs:number[]=[],coldVerifications:number[]=[];delay=monitorEventLoopDelay({resolution:samples.eventLoopResolutionMs});delay.enable();await sleep(30);
    for(let index=0;index<samples.coldDisplays;index++){
      await sleep(0);const at=performance.now(),sources=new SourceComponentStore(f.sources.directory),presentation=new AppsPresentationService({store:f.store,runtime:f.runtime,sources});
      const authoring=new AppsAuthoringService({store:f.store,sources,presentation,evidenceRoot:f.runner.root});presentation.authoring=authoring;
      const opened=authoring.openDisplay(session,{...openInput(p),displayId:'cold-'+index}),frame={...openInput(p),displayId:opened.display.displayId,displayGeneration:opened.display.generation,frameInstanceId:'cold-frame-'+index,documentNonce:'cold-nonce-'+index};
      authoring.authorizeDisplayFrame(session,frame);
      const data=presentation.getData(session,p.viewId,{publicationId:p.publicationId,buildId:p.candidateBuildId,displayId:frame.displayId,displayGeneration:frame.displayGeneration});
      assert.equal((data.bindings[0].payload as any).items.length,41);assert.equal(authoring.verification.full,2,'cold display open and frame grant each validate genuine evidence once');coldVerifications.push(authoring.verification.full);coldMs.push(performance.now()-at);
    }
    report.coldDisplay={...stats(coldMs),completeVerifications:coldVerifications,definition:'New Presentation/Authoring/SourceComponentStore caches -> openDisplay -> authorizeDisplayFrame -> first snapshot getData; SQLite connection, prebuilt receipts, snapshots and OS cache already exist; excludes record seeding and build subprocess'};
    // Re-open through the real HTTP route so every hot request goes through Runtime grants and createHost.
    f.authoring.invalidateVerifiedDisplays();
    const opened=await f.request('/v1/authoring/openDisplay',{sessionId:session,params:{...openInput(p),displayId:'hot-display'}});
    const frame={...openInput(p),displayId:opened.display.displayId,displayGeneration:opened.display.generation,frameInstanceId:'hot-frame',documentNonce:'hot-nonce',clientFeatures:features};
    const {expectedViewRevision:_,...grant}=frame;
    await f.request('/v1/authoring/authorizeDisplayFrame',{sessionId:session,params:grant});
    const identity={protocolVersion:'2.0',sessionId:session,viewId:p.viewId,buildId:p.candidateBuildId,frameInstanceId:frame.frameInstanceId};let sequence=0;
    const extension=(action:string,params:unknown)=>f.request('/v1/component-extension',{...identity,channel:'dsh.apps.component.v2',type:'extension',feature:'dataTransferV1',action,requestId:'measured-'+(++sequence),params:{documentNonce:frame.documentNonce,...params as object}});
    const prepared=await extension('prepare',{method:'getData'}),transfer=prepared.result.transfer;
    assert.ok(transfer?.chunks>=4,'unchanged real records must exercise concurrent chunk transfers');
    const before={...f.authoring.verification},callsBefore=f.providerCalls(),durations:number[]=[];
    const warm=await counted(async()=>{
      for(let batch=0;batch<samples.chunkRequests/samples.parallelism;batch++)await Promise.all(Array.from({length:samples.parallelism},async(_,index)=>{const at=performance.now(),packet=await extension('read',{id:transfer.id,index});durations.push(performance.now()-at);assert.equal(packet.error,undefined);assert.equal(packet.result.index,index);return packet;}));
    });
    await sleep(30);delay.disable();
    report.hotChunks={...stats(durations),work:warm.counts,completeEvidenceVerifications:f.authoring.verification.full-before.full,fingerprintChecks:f.authoring.verification.cached-before.cached,transferChunks:transfer.chunks,providerInvocations:f.providerCalls()-callsBefore};
    report.eventLoop={resolutionMs:samples.eventLoopResolutionMs,meanMs:delay.mean/1e6,p95Ms:delay.percentile(95)/1e6,maxMs:delay.max/1e6,window:'cold display loops and 64 hot HTTP chunk reads only; excludes seeding, build and corpus integrity loading'};
    const manifest=f.sources.manifest(p.candidateBuildId)!;assert.equal(manifest.projectFiles.filter(file=>file.startsWith('src/recordings/')).length,41);report.archive={distFiles:manifest.files.length,projectFiles:manifest.projectFiles.length,archiveBytes:manifest.fileManifest!.reduce((n,file)=>n+file.size,0),originalRecordFiles:41,serializedDetailBytes:f.originals.reduce((n,row)=>n+Buffer.byteLength(JSON.stringify(row.detail)),0)};
    const metadataChecksPerRequest=manifest.fileManifest!.length*8+128;
    report.hotChunks.metadataCheckBudget={perRequest:metadataChecksPerRequest,total:samples.chunkRequests*metadataChecksPerRequest,definition:'Fresh archive member/path and evidence identity checks; unchanged bytes reuse their verified hash'};
    assert.equal(report.hotChunks.completeEvidenceVerifications,0,'no full verification on the verified hot path');assert.equal(warm.counts.fileReads,0,'unchanged immutable files reuse their verified hash');assert.ok(warm.counts.lstats>=samples.chunkRequests,'every read rechecks file identity');assert.ok(warm.counts.lstats<=samples.chunkRequests*metadataChecksPerRequest,'file checks remain bounded by archive members, independent of business record count');assert.equal(report.hotChunks.providerInvocations,0,'reads consume prepared snapshots, not provider recomputation');
    assert.ok(warm.counts.jsonParses<=samples.chunkRequests*80,'bounded per-request JSON work, independent of record count');
    if(timing){assert.ok(report.coldDisplay.maxMs<=budgets.coldDisplayMs,JSON.stringify(report.coldDisplay));assert.ok(report.hotChunks.p95Ms<=budgets.chunkP95Ms,JSON.stringify(report.hotChunks));assert.ok(report.eventLoop.maxMs<=budgets.eventLoopMaxMs,JSON.stringify(report.eventLoop));}
    // Full source records are still immutable after all replay/measurement work.
    for(const row of f.originals)assert.equal(sha(JSON.stringify(row.detail)),row.sha256);
    report.status='PASS';
  }catch(error){report.error=error instanceof Error?{message:error.message,stack:error.stack}:String(error);throw error;}
  finally{delay?.disable();report.totalMs=performance.now()-started;await f.close();mkdirSync(join(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({artifact:output,status:report.status,totalMs:report.totalMs,cold:report.coldDisplay,processCold:report.processCold?.wall,chunkP95Ms:report.hotChunks?.p95Ms,eventLoop:report.eventLoop}));}
});
