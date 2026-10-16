import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {APP_PRESENTATION_DESCRIPTORS} from '../../packages/app-presentation/src/descriptors.ts';
import {APP_AUTHORING_DESCRIPTORS} from '../../packages/app-presentation/src/authoring-descriptors.ts';
import {BUSINESS_PRICING_DESCRIPTORS} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {AppProvider,CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(done=>resolve=done),resolve:()=>resolve()};};
const immediate=()=>new Promise<void>(accept=>setImmediate(accept));
const session='queue-authoring-session';
const slowDescriptor:CapabilityDescriptor={capabilityId:'slowfixture.rows.read',version:'1.0.0',title:'Controlled slow data',description:'Fixture only',effect:'query',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'exclusive',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const binding:DatasetBinding={bindingId:'rows',appId:'slowfixture',connectionId:'business',capabilityId:slowDescriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
function request(capabilityId:string,input:JsonValue={},extra:Partial<InvocationRequest>={}):InvocationRequest{return {protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId,capabilityVersion:'1.0.0',invocationId:randomUUID(),traceId:randomUUID(),input,source:{kind:'agent',sessionId:session,nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+5000).toISOString(),...extra};}
function setup(){
 const directory=mkdtempSync(join(tmpdir(),'agent-chain-queue-')),store=new RuntimeStore(':memory:'),started=deferred(),release=deferred(),cancelled:{attemptId:string;epoch:number}[]=[];let denied=false;
 const runtime=new AppsRuntime(store,{admit:()=>{if(denied)throw new Error('fixture admission stopped');}}),sources=new SourceComponentStore(join(directory,'sources'));
 const provider:AppProvider={manifest:{manifestVersion:1,appId:'slowfixture',displayName:'Controlled slow business fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[slowDescriptor],execute:async context=>{started.resolve();await release.promise;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{rows:[]}};},dispose:async()=>{}};
 runtime.register(provider);const presentation=new AppsPresentationService({store,runtime,sources});presentation.configureAuthoring({onCancel:(attemptId,epoch)=>cancelled.push({attemptId,epoch})});runtime.register(presentation.provider());
 for(const [appId,connectionId] of [['apps','presentation'],['slowfixture','business']]){runtime.addConnection({appId,connectionId,displayName:connectionId,config:{},configRevision:1,enabled:true});runtime.bind({sessionId:session,appId,connectionId,enabled:true,boundAt:new Date().toISOString()});}
 const project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<main>queue fixture</main>');
 const view=presentation.openSource(session,project,{title:'Slow component',bindings:[binding]});
 return {store,runtime,presentation,started,release,cancelled,deny:()=>{denied=true;},render:(required=false)=>runtime.invoke(request('apps.presentation.render_view',{viewId:view.viewId,title:view.title,...(required?{bindings:[binding as unknown as JsonValue],requiredBindingIds:['rows']}:{})})),async close(){release.resolve();await runtime.dispose();store.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'agent-chain-queue-'));rmSync(directory,{recursive:true,force:true});}};
}
async function promptly<T>(work:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Local metadata waited behind slow business hydration')),600);})]);}finally{clearTimeout(timer);}}

test('background hydration frees the presentation lane for metadata and explicit saved-asset writes',async t=>{
 const f=setup();let rendering:Promise<CapabilityResult>|undefined,saving:Promise<CapabilityResult>|undefined,nextBegin:Promise<CapabilityResult>|undefined;
 try{
  const begun=await f.runtime.invoke(request('apps.authoring.begin',{mode:'new',title:'Cancelable draft'}));assert.equal(begun.status,'ok');
  const begin=(begun as unknown as {data:{attempt:{attemptId:string;epoch:number}}}).data;
  f.presentation.authoring!.markBuilding(session,begin.attempt);
  rendering=f.render();const opened=await promptly(rendering);assert.equal(opened.status,'ok');assert.equal((opened as unknown as {data:{initialData:{status:string}[]}}).data.initialData[0].status,'preparing');await f.started.promise;assert.equal(f.runtime.connectionState('apps','presentation').active,0);assert.equal(f.runtime.connectionState('slowfixture','business').active,1);
  let saved=false;saving=f.runtime.invoke(request('apps.presentation.save_entry',{title:'Explicit save',binding:binding as unknown as JsonValue,userRequest:'Save fixture'},{idempotencyKey:'save-fixture'})).then(result=>{saved=true;return result;});
  let begunAgain=false;nextBegin=f.runtime.invoke(request('apps.authoring.begin',{mode:'new',title:'Later draft'})).then(result=>{begunAgain=true;return result;});
  const localStarted=performance.now(),results=await promptly(Promise.all([
   f.runtime.invoke(request('apps.presentation.list_saved')),
   f.runtime.invoke(request('apps.authoring.inspect',{attemptId:begin.attempt.attemptId})),
   f.runtime.invoke(request('apps.authoring.cancel',{attemptId:begin.attempt.attemptId,expectedEpoch:begin.attempt.epoch,reason:'Stop only this draft'})),
  ]));
  t.diagnostic(`list_saved + inspect + cancel completed in ${(performance.now()-localStarted).toFixed(2)} ms while business hydration remained gated`);
  assert.deepEqual(results.map(result=>result.status),['ok','ok','ok']);await promptly(Promise.all([saving,nextBegin]));assert.equal(saved,true);assert.equal(begunAgain,true);assert.equal(f.store.list('saved_assets').length,1);
  assert.equal(f.presentation.authoring!.inspect(session,{attemptId:begin.attempt.attemptId}).attempt.state,'cancelled');assert.deepEqual(f.cancelled,[{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch}]);
  assert.equal(f.runtime.connectionState('apps','presentation').active,0);assert.equal(f.runtime.connectionState('slowfixture','business').active,1);f.release.resolve();assert.equal((await rendering).status,'ok');assert.equal((await saving).status,'ok');assert.equal((await nextBegin).status,'ok');assert.equal(f.store.list('saved_assets').length,1);
 }finally{f.release.resolve();await Promise.allSettled([rendering,saving,nextBegin]);await f.close();}
});

test('resource-scoped metadata declarations are explicit and do not relax other authoring paths',()=>{
 const independent=[...APP_PRESENTATION_DESCRIPTORS,...APP_AUTHORING_DESCRIPTORS].filter(item=>item.execution.lockScope==='resources').map(item=>item.capabilityId).sort();
 assert.deepEqual(independent,['apps.authoring.await_display','apps.authoring.cancel','apps.authoring.inspect','apps.presentation.list_data_sources','apps.presentation.list_materials','apps.presentation.list_saved']);
 const quote=BUSINESS_PRICING_DESCRIPTORS.find(item=>item.capabilityId==='hallmark.pricing.quote')!;
 assert.equal(quote.effect,'compute');assert.equal(quote.execution.concurrency,'declared_safe');assert.equal(quote.execution.lockScope,'resources');
});

test('metadata bypass still honors session authorization, global admission and connection drain',async()=>{
 const f=setup();let rendering:Promise<CapabilityResult>|undefined,update:Promise<unknown>|undefined;
 try{
  const unauthorized=await f.runtime.invoke(request('apps.presentation.list_saved',{}, {source:{kind:'agent',sessionId:'unbound-session',nativeCallId:randomUUID()}}));assert.equal('error' in unauthorized?unauthorized.error.code:null,'APP_NOT_ACTIVE');
  // Explicit required bindings remain synchronous; use that path to test connection drain, not background open.
  rendering=f.render(true);await f.started.promise;update=f.runtime.updateConnection({appId:'apps',connectionId:'presentation',expectedConfigRevision:1,config:{generation:'next'}});await immediate();
  assert.equal(f.runtime.connectionState('apps','presentation').state,'draining');const blocked=await f.runtime.invoke(request('apps.presentation.list_saved'));assert.equal('error' in blocked?blocked.error.code:null,'CONNECTION_UPDATING');
  f.release.resolve();await rendering;await update;assert.equal(f.runtime.connectionState('apps','presentation').configRevision,2);
  const active=await f.runtime.invoke(request('apps.presentation.list_saved'));assert.equal(active.status,'ok');
  f.deny();const denied=await f.runtime.invoke(request('apps.presentation.list_saved'));assert.equal('error' in denied?denied.error.code:null,'RUNTIME_ADMISSION_BLOCKED');
 }finally{f.release.resolve();await Promise.allSettled([rendering,update]);await f.close();}
});

test('declared-safe compute remains pinned to its connection until actual execution ends after caller abort',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),started=deferred(),release=deferred();
 const descriptor:CapabilityDescriptor={...slowDescriptor,capabilityId:'slowfixture.local.compute',effect:'compute',execution:{...slowDescriptor.execution,concurrency:'declared_safe',lockScope:'resources'}};
 const provider:AppProvider={manifest:{manifestVersion:1,appId:'slowfixture',displayName:'Compute fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],execute:async context=>{started.resolve();await release.promise;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{}};},dispose:async()=>{}};
 runtime.register(provider);runtime.addConnection({appId:'slowfixture',connectionId:'business',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({appId:'slowfixture',connectionId:'business',sessionId:session,enabled:true,boundAt:new Date().toISOString()});
 try{
  const controller=new AbortController(),work=runtime.invoke(request(descriptor.capabilityId,{}, {appId:'slowfixture',connectionId:'business'}),controller.signal);await started.promise;controller.abort();assert.equal((await work).status,'unavailable');assert.equal(runtime.connectionState('slowfixture','business').active,1);
  await assert.rejects(runtime.updateConnection({appId:'slowfixture',connectionId:'business',expectedConfigRevision:1,config:{next:true},drainTimeoutMs:20}),/CONNECTION_DRAIN_TIMEOUT/);assert.equal(runtime.getConnection('slowfixture','business')?.configRevision,1);
  release.resolve();await immediate();assert.equal(runtime.connectionState('slowfixture','business').active,0);assert.equal((await runtime.updateConnection({appId:'slowfixture',connectionId:'business',expectedConfigRevision:1,config:{next:true}})).configRevision,2);
 }finally{release.resolve();await runtime.dispose();store.close();}
});

test('resource-scoped declared-safe mutation still serializes while explicit compute can pass it',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),started=deferred(),release=deferred(),calls:string[]=[];
 const write:CapabilityDescriptor={...slowDescriptor,capabilityId:'slowfixture.rows.write',effect:'mutation',execution:{...slowDescriptor.execution,concurrency:'declared_safe',lockScope:'resources',idempotency:'runtime_dedup'}},compute:CapabilityDescriptor={...write,capabilityId:'slowfixture.rows.compute',effect:'compute',execution:{...write.execution,idempotency:'not_applicable'}};
 const provider:AppProvider={manifest:{manifestVersion:1,appId:'slowfixture',displayName:'Boundary fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[write,compute],execute:async context=>{calls.push(context.request.capabilityId);if(context.request.capabilityId===write.capabilityId&&calls.length===1){started.resolve();await release.promise;}return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{}};},dispose:async()=>{}};
 runtime.register(provider);runtime.addConnection({appId:'slowfixture',connectionId:'business',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({appId:'slowfixture',connectionId:'business',sessionId:session,enabled:true,boundAt:new Date().toISOString()});
 const invoke=(capabilityId:string,idempotencyKey?:string)=>runtime.invoke(request(capabilityId,{}, {appId:'slowfixture',connectionId:'business',...(idempotencyKey?{idempotencyKey}:{})}));
 let first:Promise<CapabilityResult>|undefined,second:Promise<CapabilityResult>|undefined;
 try{first=invoke(write.capabilityId,'first');await started.promise;second=invoke(write.capabilityId,'second');const read=await promptly(invoke(compute.capabilityId));assert.equal(read.status,'ok');assert.deepEqual(calls,[write.capabilityId,compute.capabilityId]);release.resolve();assert.equal((await first).status,'ok');assert.equal((await second).status,'ok');assert.deepEqual(calls,[write.capabilityId,compute.capabilityId,write.capabilityId]);}
 finally{release.resolve();await Promise.allSettled([first,second]);await runtime.dispose();store.close();}
});
