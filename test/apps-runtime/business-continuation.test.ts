import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type RuntimeOperation,type InvocationRecord} from '../../packages/app-runtime/src/index.ts';
import type {AppProvider,CapabilityDescriptor,CapabilityResult,ExecutionContext,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};};
function fixture(){
  const store=new RuntimeStore(':memory:');let admitted=true;
  const runtime=new AppsRuntime(store,{admit(){if(!admitted)throw Error('LEASE_LOST');}}),calls:{kind:string;context:ExecutionContext}[]=[];
  const descriptor:CapabilityDescriptor={capabilityId:'businessfixture.plan.submit',version:'1.0.0',title:'Continuation fixture',description:'An already authorized operation',effect:'mutation',inputSchema:{type:'object',properties:{target:{type:'string'}},required:['target'],additionalProperties:false},outputSchema:{type:'object',properties:{done:{type:'boolean'}},required:['done'],additionalProperties:false},execution:{mode:'async',timeoutMs:3000,concurrency:'exclusive',lockScope:'resources',idempotency:'upstream_supported',completionEvidence:'upstream_operation'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const result=(context:ExecutionContext,status:'ok'|'pending'='ok'):CapabilityResult=>status==='ok'?{invocationId:context.request.invocationId,traceId:context.request.traceId,status,data:{done:true}}:{invocationId:context.request.invocationId,traceId:context.request.traceId,status,operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:1000};
  let continued=(context:ExecutionContext):Promise<CapabilityResult>=>Promise.resolve(result(context));
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'businessfixture',displayName:'Continuation fixture',providerPackage:'test',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[descriptor],mutationScope(request){return [(request.input as {target:string}).target];},async execute(context){calls.push({kind:'submit',context});return result(context,'pending');},async inspect(_id,context){calls.push({kind:'inspect',context});return result(context,'pending');},async continueOperation(_id,context){calls.push({kind:'continue',context});return continued(context);},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'businessfixture',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'session',appId:'businessfixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const invoke=(target='shop/A')=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'businessfixture',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{target},source:{kind:'agent',sessionId:'session',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+3000).toISOString()} satisfies InvocationRequest);
  return {store,runtime,calls,result,invoke,onContinue(fn:typeof continued){continued=fn;},admit(value:boolean){admitted=value;},async close(){await runtime.dispose();store.close();}};
}

test('inspect stays read-only; continuation keeps the original operation, backend revision and durable events',async()=>{
  const f=fixture();try{
    const submitted=await f.invoke(),operationId=submitted.operation!.operationId;
    await f.runtime.inspect(operationId);assert.deepEqual(f.calls.map(call=>call.kind),['submit','inspect']);
    const result=await f.runtime.continueAuthorized(operationId);assert.equal(result.status,'ok');assert.equal(result.operation?.operationId,operationId);assert.equal(f.store.list('operations').length,1);
    const context=f.calls[2].context;assert.equal(context.configRevision,1);assert.deepEqual(context.request.source,{kind:'recovery',operationId});assert.equal(context.operationId,operationId);
    assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'succeeded');
    const attempts=f.store.list<InvocationRecord>('invocations');assert.equal(attempts.length,3);assert.ok(attempts.every(row=>row.state==='settled'&&row.operationId===operationId));
    const events=JSON.stringify(f.store.list('operation_events'));assert.match(events,/continuation_intent/);assert.match(events,/continuation_result/);
    await f.runtime.continueAuthorized(operationId);assert.equal(f.calls.filter(call=>call.kind==='continue').length,1,'completed work cannot run again');
  }finally{await f.close();}
});

test('concurrent background attempts use one provider execution',async()=>{
  const f=fixture(),started=deferred<void>(),finish=deferred<void>();try{
    f.onContinue(async context=>{started.resolve();await finish.promise;return f.result(context);});
    const operationId=(await f.invoke()).operation!.operationId;
    const first=f.runtime.continueAuthorized(operationId);await started.promise;const second=f.runtime.continueAuthorized(operationId);assert.equal(first,second);
    finish.resolve();assert.equal((await first).status,'ok');await second;assert.equal(f.calls.filter(call=>call.kind==='continue').length,1);
  }finally{finish.resolve();await f.close();}
});

test('missing or changed backend revision, disabled connection and admission loss refuse before continuation',async()=>{
  for(const mode of ['changed','missing','disabled','admission'] as const){const f=fixture();try{
    const operationId=(await f.invoke()).operation!.operationId;
    if(mode==='admission')f.admit(false);
    else if(mode==='missing'){const op=f.store.get<RuntimeOperation>('operations',operationId)!;delete op.configRevision;f.store.put('operations',operationId,op);}
    else{const connection=f.runtime.getConnection('businessfixture','C1')!;f.store.put('connections',JSON.stringify(['businessfixture','C1']),{...connection,...(mode==='changed'?{configRevision:2}:{enabled:false})});}
    const result=await f.runtime.continueAuthorized(operationId);assert.notEqual(result.status,'ok');assert.equal(f.calls.filter(call=>call.kind==='continue').length,0);assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'pending');
  }finally{await f.close();}}
});

test('pre-dispatch cancellation leaves original pending state and does not call provider',async()=>{
  const f=fixture();try{const operationId=(await f.invoke()).operation!.operationId,controller=new AbortController();controller.abort();const result=await f.runtime.continueAuthorized(operationId,controller.signal);assert.equal(result.status,'unavailable');assert.equal(f.calls.filter(call=>call.kind==='continue').length,0);assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'pending');}finally{await f.close();}
});

test('cancelled continuation retains execution/lifecycle tracking until provider really settles',async()=>{
  const f=fixture(),started=deferred<void>(),finish=deferred<void>();let closed=false;
  try{
    f.onContinue(async context=>{started.resolve();await finish.promise;return f.result(context);});
    const operationId=(await f.invoke()).operation!.operationId,controller=new AbortController(),work=f.runtime.continueAuthorized(operationId,controller.signal);await started.promise;
    assert.equal(f.runtime.connectionState('businessfixture','C1').active,1);controller.abort();assert.equal((await work).status,'unknown');assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'unknown');assert.equal(f.runtime.connectionState('businessfixture','C1').active,1);
    const closing=f.runtime.dispose().then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,false);
    const rejected=await f.runtime.continueAuthorized(operationId);assert.equal(rejected.status,'unavailable');assert.equal(f.calls.filter(call=>call.kind==='continue').length,1);
    finish.resolve();await closing;assert.equal(closed,true);assert.equal(f.runtime.connectionState('businessfixture','C1').active,0);
  }finally{finish.resolve();await f.close();}
});

test('malformed or lost continuation responses remain unknown and keep original durable operation',async()=>{
  for(const mode of ['malformed','throws'] as const){const f=fixture();try{
    f.onContinue(async context=>{if(mode==='throws')throw Error('RESPONSE_LOST');return {...f.result(context),data:{wrong:true}} as CapabilityResult;});
    const operationId=(await f.invoke()).operation!.operationId,result=await f.runtime.continueAuthorized(operationId);assert.equal(result.status,'unknown');assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'unknown');assert.equal(f.store.list('operations').length,1);
  }finally{await f.close();}}
});

test('another unresolved operation sharing a durable target prevents background writes',async()=>{
  const f=fixture();try{
    const operationId=(await f.invoke()).operation!.operationId,secondId=(await f.invoke('shop/B')).operation!.operationId;
    const second=f.store.get<RuntimeOperation>('operations',secondId)!;f.store.put('operations',secondId,{...second,resourceScope:['shop/A']});
    const result=await f.runtime.continueAuthorized(operationId);assert.equal(result.status,'failed');assert.ok('error'in result);assert.equal(result.error.code,'OPERATION_UNRESOLVED');assert.equal(f.calls.filter(call=>call.kind==='continue').length,0);assert.equal(f.store.get<RuntimeOperation>('operations',operationId)?.state,'pending');
  }finally{await f.close();}
});
