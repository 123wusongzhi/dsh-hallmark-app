import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {RuntimeStore,AppsRuntime} from '../../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../../packages/app-presentation/src/authoring.ts';
import {SourceComponentStore} from '../../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,evidenceFile} from '../../../packages/source-components/src/authoring-evidence.ts';
import {createAppsServer} from '../../../packages/service/src/apps-server.ts';
import {realCorpus,realCorpusPath} from '../../real-data/corpus.ts';
import {performanceEvidence} from '../../authoring/performance-fixture.ts';
import type {CapabilityDescriptor,DatasetBinding} from '../../../packages/app-contracts/src/index.ts';
import type {PreviewValidationEvidence,ViewPublication} from '../../../packages/app-presentation/src/authoring-types.ts';

export const session='isolated-display-acceptance',features=['renderReadyV1','bindingPagesV1','dataTransferV1','uiStateV1'];
export const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const sleep=(ms:number)=>new Promise<void>(done=>setTimeout(done,ms));
export const environment=()=>({node:process.version,platform:process.platform,arch:process.arch,execArgv:process.execArgv,osCache:'not flushed; cold means new service/evidence caches, not physical disk cold',concurrency:'standalone targeted runner; no full-suite jobs launched by this runner'});
export const descriptor:CapabilityDescriptor={capabilityId:'displayreplay.records.list',version:'1.0.0',title:'Immutable captured records',description:'Offline GET recording replay only',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const binding:DatasetBinding={bindingId:'recordings',appId:'displayreplay',connectionId:'offline',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
export const openInput=(p:ViewPublication)=>({viewId:p.viewId,publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,buildId:p.candidateBuildId,expectedViewRevision:p.expectedViewRevision});
export const assertion=(status:'PASS'|'FAIL'='PASS')=>({id:'captured-rows-in-dom',required:true,expected:'41 original captured product ids and titles are committed',actual:status==='PASS'?'41 original captured product ids and titles are committed':'DOM differs',status,evidenceRefs:[]});

/** No shop client, credentials or write capability is registered. Original business fields are never patched. */
export async function createFixture(options:{productionLayout?:boolean}={}){
  const directory=mkdtempSync(join(tmpdir(),'display-reliability-')),databasePath=join(directory,options.productionLayout?'apps.db':'runtime.db'),store=new RuntimeStore(databasePath),runtime=new AppsRuntime(store),corpus=realCorpus();
  const originals=corpus.records.map(row=>({detail:row.detail,sha256:row.provenance.detail.valueSha256}));
  for(const row of originals)assert.equal(sha(JSON.stringify(row.detail)),row.sha256);
  let providerCalls=0;
  runtime.register({manifest:{manifestVersion:1,appId:'displayreplay',displayName:'Offline immutable recordings',providerPackage:'acceptance-only',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],async execute(context){providerCalls++;assert.equal(context.request.capabilityId,descriptor.capabilityId);return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:structuredClone(originals.map(row=>row.detail))}};},async dispose(){}});
  const sources=new SourceComponentStore(join(directory,options.productionLayout?'source-components':'sources'),options.productionLayout?join(directory,'component-workspace'):undefined),runner=new AuthoringEvidenceRunner(join(directory,options.productionLayout?'authoring-evidence':'evidence'));
  const presentation=new AppsPresentationService({store,runtime,sources});
  // Existing backend fixture mechanism, NOT formal browser preview/performance evidence.
  const authoring=new AppsAuthoringService({store,sources,presentation,evidenceRoot:runner.root,validateBuildEvidence:ref=>runner.verifyBuild(ref,sources,{allowFailure:true}),validatePreviewEvidence:ref=>runner.readReport<PreviewValidationEvidence>(ref)});
  presentation.authoring=authoring;runtime.register(presentation.provider());
  for(const [appId,connectionId]of [['displayreplay','offline'],['apps','presentation']]){runtime.addConnection({appId,connectionId,displayName:'Isolated acceptance',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:session,appId,connectionId,enabled:true,boundAt:new Date().toISOString()});}
  const token=randomUUID()+randomUUID(),http=createAppsServer({runtime,presentation,token});
  await new Promise<void>(done=>http.listen(0,'127.0.0.1',done));
  const url=`http://127.0.0.1:${(http.address() as {port:number}).port}`;
  const request=async(path:string,body?:unknown)=>{const response=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json() as any;assert.equal(response.status,200,JSON.stringify(value));return value;};
  async function prepare(label:string,options:{viewId?:string;javascript?:string}={}){
    const begin=authoring.begin(session,{mode:options.viewId?'edit':'new',...(options.viewId?{viewId:options.viewId}:{}),bindings:[binding],title:label}),workspace=begin.draft.workspacePath;
    mkdirSync(join(workspace,'src','recordings'),{recursive:true});
    for(const [index,row]of corpus.records.entries())writeFileSync(join(workspace,'src','recordings',`${index}.json`),JSON.stringify(row));
    writeFileSync(join(workspace,'package.json'),'{"type":"module","name":"isolated-display-acceptance"}');writeFileSync(join(workspace,'package-lock.json'),'{}');
    const html=`<!doctype html><html><meta charset="utf-8"><title>${label}</title><div id="root"></div>${options.javascript?'<script src="./component.js"></script>':''}</html>`;
    if(options.javascript)writeFileSync(join(workspace,'component.js'),options.javascript);
    writeFileSync(join(workspace,'build.mjs'),`import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html',${JSON.stringify(html)});${options.javascript?"copyFileSync('component.js','dist/component.js');":''}`);
    const executed=await runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
    const built=await authoring.recordBuild(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef});
    // A fixture control receipt admits the candidate. It does not stand in for renderReady.
    const screenshotPath=join(runner.root,`${begin.attempt.attemptId}.png`);writeFileSync(screenshotPath,Buffer.from('BACKEND CONTROL RECEIPT: NOT A SCREENSHOT'));
    const at=new Date().toISOString(),screenshot=evidenceFile(screenshotPath);
    const report:PreviewValidationEvidence={schemaVersion:1,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,buildId:built.archiveBuildId!,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'backend-control-only/1',startedAt:at,finishedAt:at,viewportResults:[420,1040].map(width=>({id:`control-${width}`,contentWidthCssPx:width,heightCssPx:800,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['captured-rows-in-dom'],interactionCaseIds:[]})),assertionResults:[assertion()],verdict:'PASS',performance:performanceEvidence()};
    const preview=await authoring.recordPreview(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,reportRef:runner.writeReport('preview',report)});
    const publication=authoring.publish(session,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:built.archiveBuildId!,buildReceiptId:built.receiptId,previewReceiptId:preview.receiptId});
    await presentation.refreshView(session,begin.view.viewId,{kind:'agent',sessionId:session,nativeCallId:'offline-replay-'+randomUUID()});
    return {begin,publication,built,preview};
  }
  function seedBytes(targetBytes=49_000_000){
    let bytes=0,rows=0;
    store.transaction(()=>{while(bytes<targetBytes){const source=corpus.records[rows%corpus.records.length],id=`derived-load-${rows}`,value={appId:'displayreplay',connectionId:'unrelated',namespace:'captured_load',recordId:id,configRevision:1,value:source};store.put('provider_records',id,value);bytes+=Buffer.byteLength(JSON.stringify(value));rows++;}});
    const measured=store.db.prepare("SELECT count(*) AS rows,sum(length(CAST(value_json AS BLOB))) AS bytes FROM provider_records WHERE json_extract(value_json,'$.namespace')='captured_load'").get() as {rows:number;bytes:number};
    assert.equal(measured.bytes,bytes);assert.equal(measured.rows,rows);
    return {rows,bytes,targetBytes,derivation:'Original 41 full immutable records repeated in wrappers; only wrapper ids/namespace/connection are derived. No business field is synthesized.',corpusPath:realCorpusPath,corpusSha256:sha(readFileSync(realCorpusPath)),uniqueOriginalRecords:41};
  }
  let closed=false;
  async function close(options:{preserveDirectory?:boolean}={}){if(!closed){http.closeAllConnections();await new Promise<void>(done=>http.close(()=>done()));await runtime.dispose();store.close();closed=true;}if(!options.preserveDirectory){const within=relative(resolve(tmpdir()),resolve(directory));assert.ok(within&&!within.startsWith('..')&&/^display-reliability-/.test(within));rmSync(directory,{recursive:true,force:true,maxRetries:15,retryDelay:200});}}
  return {directory,databasePath,store,runtime,sources,runner,presentation,authoring,token,url,request,prepare,seedBytes,providerCalls:()=>providerCalls,originals,close};
}
