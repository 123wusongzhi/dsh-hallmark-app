import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppsRuntime, RuntimeStore } from '../../packages/app-runtime/src/index.ts';
import type { RuntimeOperation } from '../../packages/app-runtime/src/store.ts';
import { ScriptRun } from '../../packages/app-runtime/src/runs.ts';
import { projectModelResult, readResultPage } from '../../packages/app-runtime/src/projection.ts';
import type { AppProvider, CapabilityDescriptor, CapabilityResult, ExecutionContext, InvocationRequest } from '../../packages/app-contracts/src/index.ts';
export function descriptor(effect:'query'|'mutation'='query'):CapabilityDescriptor {return {capabilityId:`sample.rows.${effect}`,version:'1.0.0',title:'Rows',description:'Read or change sample rows.',effect,inputSchema:{type:'object',properties:{value:{type:'string'}},additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{mode:'sync',timeoutMs:30000,concurrency:effect==='mutation'?'exclusive':'declared_safe',lockScope:'connection',idempotency:effect==='mutation'?'runtime_dedup':'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:['rows']},aliases:[]};}
export function request(effect:'query'|'mutation'='query',overrides:Partial<InvocationRequest>={}):InvocationRequest {return {protocolVersion:'1.0',appId:'sample',connectionId:'a',capabilityId:`sample.rows.${effect}`,capabilityVersion:'1.0.0',invocationId:randomUUID(),traceId:randomUUID(),input:{value:'A'},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+30000).toISOString(),...(effect==='mutation'?{idempotencyKey:'intent'}:{}),...overrides};}
export function fixture(execute:(context:ExecutionContext)=>Promise<CapabilityResult>,store=new RuntimeStore(':memory:'),inspect?:AppProvider['inspect']) {
  const runtime=new AppsRuntime(store),provider:AppProvider={manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor(),descriptor('mutation')],execute,dispose:async()=>{},...(inspect?{inspect}:{})};runtime.register(provider);
  for(const id of ['a','b'])if(!runtime.getConnection('sample',id))runtime.addConnection({appId:'sample',connectionId:id,displayName:id,config:{backend:id},configRevision:1,enabled:true});
  runtime.bind({sessionId:'s',appId:'sample',connectionId:'a',enabled:true,boundAt:new Date().toISOString()});return {runtime,store,provider};
}
const ok=(context:ExecutionContext):CapabilityResult=>({status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:'done'}});
test('exact versions, output schemas and ambiguous routes stop before false success',async()=>{
  let calls=0;const {runtime,store}=fixture(async context=>{calls++;return {...ok(context),data:{wrong:true}};});
  assert.equal((await runtime.invoke(request('query',{capabilityVersion:'2.0.0'}))).status,'failed');assert.equal(calls,0);
  const result=await runtime.invoke(request());assert.equal(result.status,'failed');if('error' in result)assert.equal(result.error.code,'OUTPUT_SCHEMA_INVALID');
  runtime.bind({sessionId:'s',appId:'sample',connectionId:'b',enabled:true,boundAt:new Date().toISOString()});assert.equal('status' in runtime.resolveConnection('sample','s'),true);
  assert.deepEqual(runtime.resolveConnection('sample','s','b'),{appId:'sample',connectionId:'b'});assert.equal(runtime.sessionBindings('other').length,0);store.close();
});
test('mutation composite intent deduplicates concurrent attempts and conflicts changed input',async()=>{
  let calls=0;const {runtime,store}=fixture(async context=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));return ok(context);});
  const results=await Promise.all([runtime.invoke(request('mutation')),runtime.invoke(request('mutation'))]);assert.equal(calls,1);assert.equal(results[0].operation?.operationId,results[1].operation?.operationId);
  const conflict=await runtime.invoke(request('mutation',{input:{value:'different'}}));assert.equal(conflict.status,'failed');if('error' in conflict)assert.equal(conflict.error.code,'IDEMPOTENCY_CONFLICT');assert.equal(calls,1);
  runtime.bind({sessionId:'s',appId:'sample',connectionId:'b',enabled:true,boundAt:new Date().toISOString()});assert.equal((await runtime.invoke(request('mutation',{connectionId:'b'}))).status,'ok');assert.equal(calls,2);store.close();
});
test('same invocation never executes twice; changed attempt identity is rejected',async()=>{
  let calls=0;const {runtime,store}=fixture(async context=>{calls++;return ok(context);});const req=request();
  const a=await runtime.invoke(req),b=await runtime.invoke(req);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal((await runtime.invoke({...req,input:{value:'B'}})).status,'failed');store.close();
});
test('lost mutation response recovers using inspect only across Runtime restart',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-recovery-')),path=join(directory,'apps.db');let calls=0,inspects=0;
  const one=fixture(async()=>{calls++;throw new Error('lost response');},new RuntimeStore(path),async(_id,context)=>{inspects++;return ok(context);});
  const first=await one.runtime.invoke(request('mutation'));assert.equal(first.status,'unknown');one.store.close();
  const two=fixture(async context=>{calls++;return ok(context);},new RuntimeStore(path),async(_id,context)=>{inspects++;return ok(context);});
  const recovered=await two.runtime.recover();assert.equal(recovered[0].status,'ok');assert.equal(calls,1);assert.equal(inspects,1);const duplicate=await two.runtime.invoke(request('mutation'));assert.equal(duplicate.status,'ok');assert.equal(calls,1);
  two.store.close();rmSync(directory,{recursive:true,force:true});
});
test('cancellation before and after dispatch preserves the distinction and signal',async()=>{
  let calls=0;const first=fixture(async context=>{calls++;return ok(context);});const cancelled=new AbortController();cancelled.abort();
  assert.equal((await first.runtime.invoke(request('mutation'),cancelled.signal)).status,'cancelled');assert.equal(calls,0);first.store.close();
  let started:()=>void=()=>{};const barrier=new Promise<void>(resolve=>{started=resolve;});let idle:()=>void=()=>{};
  const second=fixture(async context=>{calls++;started();await new Promise<void>(resolve=>{idle=resolve;context.signal.addEventListener('abort',()=>{}, {once:true});});return ok(context);});
  const controller=new AbortController(),work=second.runtime.invoke(request('mutation'),controller.signal);await barrier;controller.abort();const result=await work;assert.equal(result.status,'unknown');idle();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(second.store.get<RuntimeOperation>('operations',result.operation!.operationId)?.state,'unknown');second.store.close();
});
test('default mutation serialization and declared-safe read ceiling',async()=>{
  let active=0,max=0;const {runtime,store}=fixture(async context=>{active++;max=Math.max(active,max);await new Promise(resolve=>setTimeout(resolve,5));active--;return ok(context);});
  await Promise.all(Array.from({length:8},(_,index)=>runtime.invoke(request('mutation',{idempotencyKey:`key${index}`}))));assert.equal(max,1);
  max=0;await Promise.all(Array.from({length:10},()=>runtime.invoke(request())));assert.equal(max,4);store.close();
});
test('scripts preserve completed writes and recover only incomplete read steps',async()=>{
  let writes=0;const {runtime,store}=fixture(async context=>{if(context.request.capabilityId.endsWith('mutation'))writes++;return ok(context);});
  const run=new ScriptRun(runtime,'s');const result=await run.execute(async current=>{await current.call('create',{appId:'sample',connectionId:'a'},'sample.rows.mutation',{value:'A'},{idempotencyKey:'intent'});throw new Error('chart build failed');});assert.equal(result.run.state,'partial');assert.equal(writes,1);
  const resume=new ScriptRun(runtime,'s',{runId:run.record.runId});const recovered=await resume.execute(async current=>{await current.call('create',{appId:'sample',connectionId:'a'},'sample.rows.mutation',{value:'A'},{idempotencyKey:'intent'});await current.call('read',{appId:'sample',connectionId:'a'},'sample.rows.query',{});});assert.equal(recovered.run.state,'succeeded');assert.equal(writes,1);assert.equal(store.list('run_steps').length,2);store.close();
});
test('model projection caps UTF8 and complete data remains readable; spill failure stays bounded',()=>{
  const store=new RuntimeStore(':memory:'),result:CapabilityResult={status:'ok',invocationId:'large',traceId:'trace',data:Array.from({length:1000},(_,i)=>({id:i,text:'汉字'.repeat(50)}))};
  const projection=projectModelResult(store,result);assert.ok(Buffer.byteLength(projection.content)<=16384);assert.ok(projection.fullResultRef);const page=readResultPage(store,projection.fullResultRef!,'0',100);assert.equal(page.total,1000);assert.equal(page.returned,100);assert.equal(page.nextCursor,'100');store.close();
  const failure=projectModelResult(store,result);assert.ok(Buffer.byteLength(failure.content)<=16384);assert.match(failure.content,/RESULT_SPILL_FAILED/);
});
test('registration rejects duplicate IDs and stopping removes catalog while retaining assets',async()=>{
  const {runtime,store,provider}=fixture(async context=>ok(context));assert.throws(()=>runtime.register(provider),/MANIFEST/);store.put('components','saved',{title:'Keep'});const before=runtime.catalogDigest;await runtime.stopProvider('sample');assert.notEqual(runtime.catalogDigest,before);assert.equal(runtime.describe('sample.rows.query'),undefined);assert.equal(store.get('components','saved')?.title,'Keep');store.close();
});
test('resumed unknown script steps persist inspection and finish without replay',async()=>{
  let writes=0,inspects=0;
  const {runtime,store}=fixture(async()=>{writes++;throw new Error('response lost');},new RuntimeStore(':memory:'),async(_id,context)=>{inspects++;return ok(context);});
  const first=new ScriptRun(runtime,'s');
  const interrupted=await first.execute(current=>current.call('write',{appId:'sample',connectionId:'a'},'sample.rows.mutation',{value:'A'},{idempotencyKey:'intent'}));
  assert.equal(interrupted.run.state,'failed');
  const resumed=new ScriptRun(runtime,'s',{runId:first.record.runId});
  const complete=await resumed.execute(current=>current.call('write',{appId:'sample',connectionId:'a'},'sample.rows.mutation',{value:'A'},{idempotencyKey:'intent'}));
  assert.equal(complete.run.state,'succeeded');assert.equal(complete.steps[0].result?.status,'ok');assert.equal(writes,1);assert.equal(inspects,1);
  const inspection=store.list<import('../../packages/app-runtime/src/store.ts').InvocationRecord>('invocations').find(row=>row.request.source.kind==='recovery');
  assert.equal(inspection?.state,'settled');assert.equal(inspection?.operationId,complete.steps[0].result?.operation?.operationId);store.close();
});
test('queued crash recovery cancels undispatched intents and never executes them',async()=>{
  let calls=0;const {runtime,store}=fixture(async context=>{calls++;return ok(context);});
  const req=request('mutation'),at=new Date().toISOString();
  store.put('operations','queued-intent',{operationId:'queued-intent',appId:'sample',connectionId:'a',capabilityId:req.capabilityId,capabilityVersion:req.capabilityVersion,idempotencyKey:'intent',requestHash:'persisted',request:req,state:'queued',createdAt:at,updatedAt:at} satisfies RuntimeOperation);
  await runtime.recover();assert.equal(store.get<RuntimeOperation>('operations','queued-intent')?.state,'cancelled');assert.equal(calls,0);
  assert.equal((await runtime.inspect('queued-intent')).status,'cancelled');store.close();
});
test('inspection unavailability cannot turn uncertain business outcome into failure',async()=>{
  const {runtime,store}=fixture(async()=>{throw new Error('lost');},new RuntimeStore(':memory:'),async(_id,context)=>({invocationId:context.request.invocationId,traceId:context.request.traceId,status:'failed',error:{code:'UNAVAILABLE',message:'Network unavailable',retryPolicy:'inspect_only'}}));
  const original=await runtime.invoke(request('mutation'));
  const result=await runtime.inspect(original.operation!.operationId);assert.equal(result.status,'unknown');assert.equal(result.operation?.state,'unknown');assert.equal(store.get<RuntimeOperation>('operations',original.operation!.operationId)?.state,'unknown');store.close();
});
