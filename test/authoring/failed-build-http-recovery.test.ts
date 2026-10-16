import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename,dirname,resolve} from 'node:path';
import {randomInt,randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {AuthoringAttempt,BuildReceipt} from '../../packages/app-presentation/src/authoring-types.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../../packages/source-components/src/authoring-evidence.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
// @ts-expect-error Exercise the same executable module used by the check CLI.
import {runAuthoringCheck} from '../../scripts/apps-authoring-check.mjs';

function bounded<T>(operation:Promise<T>,label:string,ms=3000):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(label+' did not settle')),ms);
    operation.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}

async function listenForFetch(server:Server,signal:AbortSignal):Promise<string>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((resolve,reject)=>{
        const ready=()=>{server.off('error',failed);resolve();};
        const failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('listening',ready);server.once('error',failed);
        server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    }catch(error){
      if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;
    }
  }
  throw new Error('No free Fetch-compatible fixture port');
}

// This is a real failing subprocess, signed evidence, SQLite and loopback HTTP.
// It neither builds an application nor runs/simulates a browser or preview.
test('failed check recovers a committed HTTP receipt after the response is lost without rerunning the command', {timeout:12000}, async t=>{
  const directory=mkdtempSync(join(tmpdir(),'failed-build-recovery-'));
  const lifetime=new AbortController(),signal=AbortSignal.any([t.signal,lifetime.signal]);
  const originalFetch=globalThis.fetch,pending=new Set<Promise<unknown>>();
  let completed=false;
  let cleanupStore:RuntimeStore|undefined,cleanupRuntime:AppsRuntime|undefined,server:Server|undefined;
  t.after(async()=>{
    lifetime.abort(new Error('failed-build fixture closing'));
    const failures:Error[]=[];
    const clean=async(label:string,work:()=>unknown|Promise<unknown>)=>{
      try{await bounded(Promise.resolve().then(work),label,2000);}catch(error){failures.push(new Error(label,{cause:error}));}
    };
    await clean('close HTTP connections',()=>server?.closeAllConnections());
    await clean('close HTTP server',()=>server?.listening?new Promise<void>((done,reject)=>server!.close(error=>error?reject(error):done())):undefined);
    // The runner receives the same cancellation signal; join its owned subprocess
    // before disposing Runtime or removing its evidence/workspace.
    await clean('settle check runners',()=>Promise.allSettled([...pending]));
    globalThis.fetch=originalFetch;
    await clean('dispose Runtime',()=>cleanupRuntime?.dispose());
    await clean('close Store',()=>cleanupStore?.close());
    if(completed)await clean('remove fixture',()=>{
      assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
      assert.match(basename(directory),/^failed-build-recovery-/);
      rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:20});
    });
    else t.diagnostic('Retained failed fixture: '+directory);
    if(failures.length)throw new AggregateError(failures,'failed-build fixture cleanup failed');
  });
  const store=cleanupStore=new RuntimeStore(':memory:'),runtime=cleanupRuntime=new AppsRuntime(store);
  const sources=new SourceComponentStore(join(directory,'archive'));
  const evidenceRoot=join(directory,'evidence'),runner=new AuthoringEvidenceRunner(evidenceRoot);
  const presentation=new AppsPresentationService({store,runtime,sources});
  presentation.configureAuthoring({evidenceRoot,onCancel:(attemptId,epoch)=>runner.cancel(attemptId,epoch),validateBuildEvidence:(ref,context)=>runner.verifyBuild(ref,context.sources,{allowFailure:true})});
  runtime.register(presentation.provider());
  runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Fixture presentation',config:{},configRevision:1,enabled:true});
  const token=randomUUID(),sessionId='failed-build-recovery-control';
  server=createAppsServer({runtime,presentation,token,log:()=>{}});
  let recordRequests=0,dropped=false,committedAtDrop:BuildReceipt[]=[];
  server.prependListener('request',(request,response)=>{
    if(request.url!=='/v1/presentation-actions')return;
    let body='';request.on('data',chunk=>{body+=chunk;});
    const end=response.end;
    response.end=(function(this:typeof response,...args:Parameters<typeof end>){
      const input=JSON.parse(body);
      if(input.capabilityId==='apps.authoring.record_build'){
        recordRequests++;
        if(!dropped){
          // The actual route has completed and committed before it tries to send.
          committedAtDrop=store.list<BuildReceipt>('build_receipts');dropped=true;
          this.destroy();return this;
        }
      }
      return end.apply(this,args);
    }) as typeof end;
  });
  const origin=await bounded(listenForFetch(server,signal),'listen'),requests:string[]=[];
  globalThis.fetch=(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    assert.equal(url.origin,origin,'only this test loopback server may be contacted');
    requests.push(url.pathname);
    return originalFetch(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(2000),...(init?.signal?[init.signal]:[])])});
  };
  const response=await fetch(origin+'/v1/presentation-actions',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sessionId,requestId:randomUUID(),capabilityId:'apps.authoring.begin',input:{mode:'new'}})});
  assert.equal(response.status,200);const begun=await response.json();assert.equal(begun.status,'ok');
  const {attempt,draft,view}=begun.data;
  const counter=join(directory,'command-count.txt'),keyFile=join(directory,'fixture-key');
  writeFileSync(keyFile,token);writeFileSync(join(draft.workspacePath,'package-lock.json'),'{}');
  // Count outside the source tree so this control cannot change its source digest.
  writeFileSync(join(draft.workspacePath,'fail.mjs'),`import{existsSync,readFileSync,writeFileSync}from'node:fs';const path=${JSON.stringify(counter)};writeFileSync(path,String((existsSync(path)?Number(readFileSync(path,'utf8')):0)+1));console.error('intentional failure control');process.exit(7);`);
  const request={build:{sessionId,viewId:view.viewId,attemptId:attempt.attemptId,epoch:attempt.epoch,sourceRevision:attempt.sourceRevision,workspacePath:draft.workspacePath,command:[process.execPath,'fail.mjs'],environmentKeys:[],archiveRoot:sources.directory,evidenceRoot,runtime:{url:origin,keyFile},timeoutMs:2000,signal}};
  const check=async()=>{
    const operation=runAuthoringCheck(request) as Promise<any>;pending.add(operation);
    try{return await bounded(operation,'check');}finally{operation.then(()=>pending.delete(operation),()=>pending.delete(operation));}
  };
  const executions=()=>Number(readFileSync(counter,'utf8'));
  let errorPath='';
  await assert.rejects(check(),(error:Error&{summaryPath?:string})=>{assert.match(error.message,/fetch failed/);assert.ok(error.summaryPath);errorPath=error.summaryPath;return true;});
  assert.equal(dropped,true);assert.equal(recordRequests,1);assert.equal(committedAtDrop.length,1);
  const receipt=committedAtDrop[0];
  assert.equal(receipt.verdict,'FAIL');assert.equal(receipt.exitCode,7);assert.equal(receipt.archiveBuildId,null);
  assert.equal(receipt.attemptId,attempt.attemptId);assert.equal(receipt.inputUnchanged,true);assert.equal(executions(),1);
  t.diagnostic(JSON.stringify({committedBeforeResponseLoss:true,receiptId:receipt.receiptId,executionId:receipt.executionId,exitCode:receipt.exitCode}));
  const errorSummary=JSON.parse(readFileSync(errorPath,'utf8'));
  assert.equal(errorSummary.attemptId,attempt.attemptId);assert.equal(errorSummary.epoch,attempt.epoch);
  assert.equal(errorSummary.verdict,'ERROR');assert.equal(errorSummary.stage,'record_build');assert.equal(errorSummary.nextAction,'retry_same_request');
  assert.equal(errorSummary.error.message,'fetch failed');
  const state=store.get<AuthoringAttempt>('authoring_attempts',attempt.attemptId)!;
  assert.equal(state.state,'build_failed');assert.equal(state.buildReceiptId,receipt.receiptId);assert.equal(state.evidenceRefs.length,1);
  const reportRef=state.evidenceRefs[0],reportBytes=readFileSync(reportRef.path),logBytes=readFileSync(receipt.logRef.path);
  assert.match(logBytes.toString(),/intentional failure control/);
  const evidenceFiles=readdirSync(evidenceRoot).filter(name=>/^build-.*\.(json|log)$/.test(name)).sort();
  const resumeRequestStart=requests.length,resumed=await check();
  assert.ok(requests.slice(resumeRequestStart).includes('/v1/authoring/inspect'),'recovery inspects the committed attempt');
  assert.equal(resumed.verdict,'FAIL');assert.equal(resumed.stage,'build');assert.equal(resumed.nextAction,'inspect_build_log');
  assert.equal(resumed.build.verdict,'FAIL');assert.equal(resumed.build.reusedBuild,true);
  assert.equal(resumed.build.buildReceiptId,receipt.receiptId);assert.equal(resumed.build.executionId,receipt.executionId);
  assert.deepEqual(resumed.build.reportRef,reportRef);assert.equal(resumed.build.archiveBuildId,null);
  const repeatRequestStart=requests.length,repeated=await check();
  assert.ok(requests.slice(repeatRequestStart).includes('/v1/authoring/inspect'),'repeating inspects the existing receipt');
  assert.equal(repeated.verdict,'FAIL');assert.equal(repeated.build.reusedBuild,true);
  assert.equal(repeated.build.buildReceiptId,receipt.receiptId);assert.equal(repeated.build.executionId,receipt.executionId);
  assert.equal(executions(),1,'recovering and repeating a receipt never reruns the owned command');
  assert.equal(recordRequests,1,'recovery obtains the committed receipt through inspect, without another record action');
  assert.equal(requests.filter(path=>path==='/v1/authoring/markBuilding').length,1);
  assert.deepEqual(store.list('build_receipts'),[receipt]);assert.deepEqual(store.get('authoring_attempts',attempt.attemptId),state);
  assert.deepEqual(readFileSync(reportRef.path),reportBytes);assert.deepEqual(readFileSync(receipt.logRef.path),logBytes);
  assert.deepEqual(readdirSync(evidenceRoot).filter(name=>/^build-.*\.(json|log)$/.test(name)).sort(),evidenceFiles);
  for(const table of ['preview_receipts','view_publications','components'] as const)assert.deepEqual(store.list(table),[]);
  assert.equal(presentation.ownedView(sessionId,view.viewId).source,undefined);
  t.diagnostic(JSON.stringify({commandExecutions:executions(),recordBuildRequests:recordRequests,buildReceipts:store.list('build_receipts').length,previewReceipts:store.list('preview_receipts').length}));
  completed=true;
});
