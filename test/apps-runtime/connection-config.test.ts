import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {CapabilityResult,ExecutionContext,InvocationRequest,AppProvider,CapabilityDescriptor} from '../../packages/app-contracts/src/index.ts';
import {HallmarkProvider,HallmarkStorePort,validateHallmarkConnection} from '../../packages/app-hallmark/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {TaskBroker} from '../../packages/hallmark-adapter/task-broker.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import type {AppsConfiguration} from '../../packages/service/src/apps-main.ts';
function evidence(name:string,facts:unknown){const directory=resolve('evidence/apps-a2-20261007/runtime-refresh-config');mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`config-${name}.json`),JSON.stringify({schemaVersion:1,scope:'FIXTURE',requirements:['REQ-076'],tests:['TST-076'],status:'PASS',executedAt:new Date().toISOString(),verifier:'domain_map automated connection-config.test.ts',noRealBusinessCalls:true,sourceHashes:Object.fromEntries(['packages/app-runtime/src/index.ts','packages/app-runtime/src/connection-lifecycle.ts','packages/app-hallmark/src/index.ts','packages/app-hallmark/src/store.ts','packages/service/src/apps-main.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),facts},null,2)+'\n');}
function descriptor(effect:'query'|'mutation'='query'):CapabilityDescriptor{return {capabilityId:`sample.rows.${effect}`,version:'1.0.0',title:'Fixture rows',description:'Connection lifecycle fixture',effect,inputSchema:{type:'object',properties:{value:{type:'string'}},additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{mode:'sync',timeoutMs:10000,concurrency:effect==='mutation'?'exclusive':'declared_safe',lockScope:'connection',idempotency:effect==='mutation'?'runtime_dedup':'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};}
function request(effect:'query'|'mutation'='query'):InvocationRequest{return {protocolVersion:'1.0',appId:'sample',connectionId:'a',capabilityId:`sample.rows.${effect}`,capabilityVersion:'1.0.0',invocationId:randomUUID(),traceId:randomUUID(),input:{value:'A'},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+10000).toISOString(),...(effect==='mutation'?{idempotencyKey:'intent'}:{})};}
function fixture(execute:AppProvider['execute'],store=new RuntimeStore(':memory:'),inspect?:AppProvider['inspect']){const runtime=new AppsRuntime(store),provider:AppProvider={manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor(),descriptor('mutation')],execute,dispose:async()=>{},...(inspect?{inspect}:{})};runtime.register(provider);runtime.addConnection({appId:'sample',connectionId:'a',displayName:'A',config:{backend:'A'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'sample',connectionId:'a',enabled:true,boundAt:new Date().toISOString()});return {runtime,store,provider};}

const immediate=()=>new Promise<void>(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve:()=>void=()=>{};const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
async function backend(name:string){
  const calls:string[]=[],started=deferred(),release=deferred();let hold=false;
  const server=createServer(async(req,res)=>{calls.push(req.url!);res.setHeader('Content-Type','application/json');if(req.url==='/api/health')return res.end('{"service":"hallmark-control"}');if(req.url==='/api/stores'){if(hold){started.resolve();await release.promise;}return res.end(JSON.stringify([{id:'store',shopName:name}]));}if(req.url==='/api/store-products')return res.end(JSON.stringify({stores:[{id:'store',lastSuccessAt:'2026-10-01T00:00:00Z'}],products:[{storeId:'store',offerId:'same',origin:name}]}));res.statusCode=404;res.end('{}');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('PORT_REQUIRED');
  return {url:`http://127.0.0.1:${address.port}`,calls,started:started.promise,release:release.resolve,hold(){hold=true;},async close(){release.resolve();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
function query(capabilityId='hallmark.stores.list',input:InvocationRequest['input']={}):InvocationRequest{return {protocolVersion:'1.0',appId:'hallmark',connectionId:'h',invocationId:randomUUID(),traceId:randomUUID(),capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+10000).toISOString()};}
function composed(url:string){
  const store=new RuntimeStore(':memory:'),events:Record<string,unknown>[]=[],runtime=new AppsRuntime(store,{log:event=>events.push(event)}),clients=new Map<string,HallmarkClient>(),ports=new Map<string,HallmarkStorePort>(),brokers=new Map<string,TaskBroker>();
  const port=(id:string,revision=1)=>{const key=JSON.stringify([id,revision]);let value=ports.get(key);if(!value){value=new HallmarkStorePort(store,id,revision);ports.set(key,value);}return value;};
  const client=(id:string,revision=1)=>{const key=JSON.stringify([id,revision]);let value=clients.get(key);if(!value){const active=runtime.getConnection('hallmark',id)!;assert.equal(active.configRevision,revision);value=new HallmarkClient({baseUrl:(active.config as {baseUrl:string}).baseUrl});clients.set(key,value);}return value;};
  const broker=(id:string,revision=1)=>{const key=JSON.stringify([id,revision]);let value=brokers.get(key);if(!value){value=new TaskBroker(client(id,revision),port(id,revision));brokers.set(key,value);}return value;};
  const provider=new HallmarkProvider({store:port,client,broker});runtime.register(provider);runtime.registerConnectionLifecycle('hallmark',{validate:next=>validateHallmarkConnection(next.config),invalidate:(_previous,next)=>{provider.invalidateConnection(next.connectionId);clients.clear();ports.clear();brokers.clear();}});
  runtime.addConnection({appId:'hallmark',connectionId:'h',displayName:'Fixture',config:{baseUrl:url},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'h',enabled:true,boundAt:new Date().toISOString()});
  return {runtime,store,events,port,async close(){await runtime.dispose();store.close();}};
}

test('controlled configuration drains Mock A, refuses new dispatch, then records new Mock B revision',async()=>{
  const a=await backend('A'),b=await backend('B'),f=composed(a.url);try{
    a.hold();const old=query(),oldWork=f.runtime.invoke(old);await a.started;
    const update=f.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:b.url}});await immediate();assert.equal(f.runtime.connectionState('hallmark','h').state,'draining');
    const denied=await f.runtime.invoke(query());assert.equal(denied.status,'unavailable');assert.equal(a.calls.filter(path=>path==='/api/stores').length,1);assert.equal(b.calls.length,0);
    a.release();assert.equal((await oldWork).status,'ok');const active=await update;assert.equal(active.configRevision,2);
    const next=query(),result=await f.runtime.invoke(next);assert.equal(result.status,'ok');assert.deepEqual('data' in result?result.data:null,[{id:'store',shopName:'B'}]);
    assert.equal(f.store.get<{configRevision:number}>('invocations',old.invocationId)?.configRevision,1);assert.equal(f.store.get<{configRevision:number}>('invocations',next.invocationId)?.configRevision,2);
    assert.equal(f.runtime.connectionState('hallmark','h').cacheGeneration,1);assert.ok(f.events.some(event=>event.invocationId===next.invocationId&&event.event==='dispatch_intent'&&event.configRevision===2));
    await assert.rejects(f.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:a.url}}),/CONFIG_REVISION_CONFLICT/);
    assert.throws(()=>f.runtime.addConnection({...active,configRevision:3}),/CONTROLLED_CONNECTION_UPDATE_REQUIRED/);
    evidence('mock-a-to-b',{beforeRevision:1,afterRevision:active.configRevision,cacheGeneration:f.runtime.connectionState('hallmark','h').cacheGeneration,mockARequests:a.calls,mockBRequests:b.calls,oldInvocationRevision:f.store.get<{configRevision:number}>('invocations',old.invocationId)?.configRevision,newInvocationRevision:f.store.get<{configRevision:number}>('invocations',next.invocationId)?.configRevision,newDispatchDuringDrain:0,oldExpectedRevisionRejected:true});
  }finally{a.release();await f.close();await a.close();await b.close();}
});

test('backend generations exclude old persisted product/task caches while preserving original operation evidence',async()=>{
  const a=await backend('A'),b=await backend('B'),f=composed(a.url);try{
    const first=await f.runtime.invoke(query('hallmark.products.list',{storeId:'store',limit:3}));assert.equal(first.status,'ok');assert.equal((first as unknown as {data:{products:{origin:string}[]}}).data.products[0].origin,'A');
    f.port('h',1).put('internal_tasks','mapping',{taskId:'task-A'});f.port('h',1).put('operations','original',{operationId:'original',state:'succeeded'});
    await f.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:b.url}});
    assert.equal(f.port('h',2).get('snapshots','store_products:store'),undefined);assert.equal(f.port('h',2).get('internal_tasks','mapping'),undefined);assert.equal(f.port('h',2).get<{operationId:string}>('operations','original')?.operationId,'original');
    const second=await f.runtime.invoke(query('hallmark.products.list',{storeId:'store',limit:3}));assert.equal((second as unknown as {data:{products:{origin:string}[]}}).data.products[0].origin,'B');assert.equal(b.calls.filter(path=>path==='/api/store-products').length,1);
    assert.equal(f.port('h',1).get<{payload:{products:{origin:string}[]}}>('snapshots','store_products:store')?.payload.products[0].origin,'A');
    evidence('provider-cache-generations',{currentRevision:2,oldProductOrigin:'A',newProductOrigin:'B',newGenerationTaskMapping:null,originalOperationPreserved:true,mockBProductReads:b.calls.filter(path=>path==='/api/store-products').length});
  }finally{await f.close();await a.close();await b.close();}
});

test('timeout and aborted caller do not release actual execution or commit a new configuration',async()=>{
  const started=deferred(),release=deferred();const f=fixture(async context=>{started.resolve();await release.promise;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:'A'}};});
  try{const controller=new AbortController(),work=f.runtime.invoke(request(),controller.signal);await started.promise;controller.abort();await work;assert.equal(f.runtime.connectionState('sample','a').active,1);
    await assert.rejects(f.runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:1,config:{backend:'B'},drainTimeoutMs:10}),/CONNECTION_DRAIN_TIMEOUT/);assert.equal(f.runtime.getConnection('sample','a')?.configRevision,1);assert.equal(f.runtime.connectionState('sample','a').state,'ready');
    release.resolve();await immediate();assert.equal(f.runtime.connectionState('sample','a').active,0);assert.equal((await f.runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:1,config:{backend:'B'}})).configRevision,2);
    evidence('actual-execution-idle',{callerAborted:true,actualExecutionActiveAfterCallerAbort:1,drainTimeoutRejected:true,revisionAfterFailedUpdate:1,revisionAfterActualIdleUpdate:2});
  }finally{release.resolve();await f.runtime.dispose();f.store.close();}
});

test('unresolved business outcome blocks configuration switch and inspect remains pinned until actually idle',async()=>{
  const started=deferred(),release=deferred();let disposed=false;
  const f=fixture(async context=>({status:'unknown',invocationId:context.request.invocationId,traceId:context.request.traceId,operation:{operationId:context.operationId!,state:'unknown'},error:{code:'LOST',message:'Fixture response loss',retryPolicy:'inspect_only'}}),new RuntimeStore(':memory:'),async(_id,context)=>{started.resolve();await release.promise;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:'A'}};});f.provider.dispose=async()=>{disposed=true;};
  try{const original=await f.runtime.invoke(request('mutation'));await assert.rejects(f.runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:1,config:{backend:'B'}}),/OPERATION_UNRESOLVED/);
    const controller=new AbortController(),inspection=f.runtime.inspect(original.operation!.operationId,controller.signal);await started.promise;controller.abort();assert.equal((await inspection).status,'unknown');assert.equal(f.runtime.connectionState('sample','a').active,1);
    const stop=f.runtime.stopProvider('sample');await immediate();assert.equal(disposed,false);release.resolve();await stop;assert.equal(disposed,true);assert.equal(f.runtime.getConnection('sample','a')?.configRevision,1);
    evidence('unknown-and-inspect',{unknownOperationId:original.operation!.operationId,unknownPreventsSwitch:true,inspectAbortedCallerStillActualActive:1,disposeWaitsForActualInspect:true,configRevision:1});
  }finally{release.resolve();await f.runtime.dispose();f.store.close();}
});

test('queued calls never migrate generations and failed invalidation rolls the configuration transaction back',async()=>{
  const started=deferred(),release=deferred();let calls=0;const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
  const queryDescriptor={...descriptor(),execution:{...descriptor().execution,concurrency:'exclusive' as const}};
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[queryDescriptor],execute:async context=>{calls++;started.resolve();await release.promise;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:'A'}};},dispose:async()=>{}};
  runtime.register(provider);runtime.addConnection({appId:'sample',connectionId:'a',displayName:'A',config:{backend:'A'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'sample',connectionId:'a',enabled:true,boundAt:new Date().toISOString()});
  try{const first=runtime.invoke(request()),queued=runtime.invoke(request());await started.promise;const update=runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:1,config:{backend:'B'}});release.resolve();await first;assert.equal((await queued).status,'unavailable');await update;assert.equal(calls,1);
    runtime.registerConnectionLifecycle('sample',{invalidate:()=>{throw new Error('FIXTURE_CACHE_FAILURE');}});await assert.rejects(runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:2,config:{backend:'C'}}),/FIXTURE_CACHE_FAILURE/);assert.equal(runtime.getConnection('sample','a')?.configRevision,2);assert.equal(runtime.connectionState('sample','a').state,'ready');
    evidence('queued-and-rollback',{admittedExecutions:calls,oldQueuedRequestDispatches:0,invalidationFailure:'FIXTURE_CACHE_FAILURE',preservedRevision:2,admissionResumed:true});
  }finally{release.resolve();await runtime.dispose();store.close();}
});

test('a duplicate successful intent after a configuration change retains the original operation and revision without execution',async()=>{
  let calls=0;const f=fixture(async context=>{calls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:`revision-${context.configRevision}`}};});
  try{const first=request('mutation'),result=await f.runtime.invoke(first);assert.equal(result.status,'ok');await f.runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:1,config:{backend:'B'}});
    const duplicate=request('mutation'),again=await f.runtime.invoke(duplicate);assert.equal(calls,1);assert.equal(again.operation?.operationId,result.operation?.operationId);assert.equal(f.store.get<{configRevision:number}>('invocations',duplicate.invocationId)?.configRevision,1);assert.equal(f.store.get<{configRevision:number}>('operations',result.operation!.operationId)?.configRevision,1);
    await f.runtime.updateConnection({appId:'sample',connectionId:'a',expectedConfigRevision:2,config:{backend:'A'}});assert.equal(f.runtime.getConnection('sample','a')?.configRevision,3,'rollback to A is a new revision, never an old revision overwrite');
    evidence('intent-original-revision',{executions:calls,operationId:result.operation!.operationId,duplicateOperationId:again.operation!.operationId,originalOperationConfigRevision:1,duplicateInvocationConfigRevision:1,activeRevisionAfterRollback:3});
  }finally{await f.runtime.dispose();f.store.close();}
});

test('real composition treats the persisted database as authoritative, reports changed seed file and invalidates its actual clients',async()=>{
  const a=await backend('A'),b=await backend('B'),directory=mkdtempSync(join(tmpdir(),'apps-config-seed-')),configPath=join(directory,'connections.json');let instance:ReturnType<typeof composeAppsRuntime>|undefined;const messages:unknown[]=[];
  const configuration=(url:string):AppsConfiguration=>({connections:[{appId:'hallmark',connectionId:'h',displayName:'Seed fixture',config:{baseUrl:url},configRevision:1,enabled:true}],legacyHallmarkConnectionId:'h'});
  try{
    writeFileSync(configPath,JSON.stringify(configuration(a.url)));instance=composeAppsRuntime(directory,JSON.parse(readFileSync(configPath,'utf8')) as AppsConfiguration);instance.runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'h',enabled:true,boundAt:new Date().toISOString()});assert.equal((await instance.runtime.invoke(query())).status,'ok');await instance.close();instance=undefined;
    writeFileSync(configPath,JSON.stringify(configuration(b.url)));const originalInfo=console.info;console.info=(message:unknown)=>{messages.push(typeof message==='string'?JSON.parse(message):message);};try{instance=composeAppsRuntime(directory,JSON.parse(readFileSync(configPath,'utf8')) as AppsConfiguration);}finally{console.info=originalInfo;}
    assert.equal((instance.runtime.getConnection('hallmark','h')?.config as {baseUrl:string}).baseUrl,a.url);const difference=messages.find(value=>(value as {event?:string}).event==='apps-config-seed-difference');assert.ok(difference);assert.equal((difference as {authority:string}).authority,'database');assert.equal((difference as {applied:boolean}).applied,false);
    const old=await instance.runtime.invoke(query());assert.equal((old as unknown as {data:{shopName:string}[]}).data[0].shopName,'A');assert.equal(b.calls.length,0);assert.equal(instance.scheduler.status().state,'running');
    await instance.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:b.url}});const current=await instance.runtime.invoke(query());assert.equal((current as unknown as {data:{shopName:string}[]}).data[0].shopName,'B');
    evidence('file-seed-composition',{reportedDifference:difference,fileChangeApplied:false,oldCallBackend:'A',controlledUpdateBackend:'B',activeRevision:instance.runtime.getConnection('hallmark','h')!.configRevision,workerState:instance.scheduler.status().state,mockARequests:a.calls,mockBRequests:b.calls});
  }finally{await instance?.close();await a.close();await b.close();rmSync(directory,{recursive:true,force:true});}
});
