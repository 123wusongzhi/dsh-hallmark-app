import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type RuntimeOperation} from '../../packages/app-runtime/src/index.ts';
import type {AppProvider,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

type Plan={targets?:string[];status:'ok'|'pending'|'unknown';scopeError?:boolean};
function fixture(lockScope:'resources'|'connection'='resources'){
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),plans=new Map<string,Plan>(),executed:string[]=[],resolved:Array<{planId:string;configRevision?:number}>=[];
  const descriptor:CapabilityDescriptor={capabilityId:'businessfixture.plan.submit',version:'1.0.0',title:'Stored business targets',description:'Synthetic provider-owned targets',effect:'mutation',inputSchema:{type:'object',properties:{planId:{type:'string'},resourceScope:{type:'array',items:{type:'string'}}},required:['planId'],additionalProperties:false},outputSchema:{type:'object',properties:{done:{type:'boolean'}},required:['done'],additionalProperties:false},execution:{mode:'async',timeoutMs:3000,concurrency:'exclusive',lockScope,idempotency:'upstream_supported',completionEvidence:'upstream_operation'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'businessfixture',displayName:'Business scope fixture',providerPackage:'test',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[descriptor],mutationScope(request,configRevision){const id=(request.input as {planId:string}).planId;resolved.push({planId:id,configRevision});const plan=plans.get(id)!;if(plan.scopeError)throw Error('Stored targets unavailable');return plan.targets;},async execute(context){const id=(context.request.input as {planId:string}).planId,plan=plans.get(id)!;executed.push(id);const base={invocationId:context.request.invocationId,traceId:context.request.traceId};if(plan.status==='pending')return {...base,status:'pending',operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:1000};if(plan.status==='unknown')return {...base,status:'unknown',operation:{operationId:context.operationId!,state:'unknown'},error:{code:'OUTCOME_UNKNOWN',message:'Synthetic lost response',retryPolicy:'inspect_only'}};return {...base,status:'ok',data:{done:true}};},async dispose(){}};
  runtime.register(provider);
  for(const connectionId of ['C1','C2']){runtime.addConnection({appId:'businessfixture',connectionId,displayName:connectionId,config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'session',appId:'businessfixture',connectionId,enabled:true,boundAt:new Date().toISOString()});}
  const invoke=(planId:string,extra:Partial<InvocationRequest>={},input:Record<string,unknown>={})=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'businessfixture',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{planId,...input} as InvocationRequest['input'],source:{kind:'agent',sessionId:'session',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+3000).toISOString(),...extra});
  return {store,runtime,plans,executed,resolved,invoke,async close(){await runtime.dispose();store.close();}};
}

for(const status of ['pending','unknown'] as const)test(`${status} A permits disjoint B but blocks A, using stored targets rather than caller scope`,async()=>{
  const f=fixture();try{
    f.plans.set('first',{targets:['shop/A','shop/A'],status});f.plans.set('other',{targets:['shop/B'],status:'ok'});f.plans.set('overlap',{targets:['shop/A'],status:'ok'});
    const first=await f.invoke('first');assert.equal(first.status,status);
    const operation=f.store.get<RuntimeOperation>('operations',first.operation!.operationId)!;assert.deepEqual(operation.resourceScope,['shop/A']);assert.match(operation.idempotencyKey,/^provider-intent:/);
    const other=await f.invoke('other');assert.equal(other.status,'ok');
    const overlap=await f.invoke('overlap',{}, {resourceScope:['shop/C']});assert.equal(overlap.status,'failed');assert.ok('error'in overlap);assert.equal(overlap.error.code,'OPERATION_UNRESOLVED');
    assert.deepEqual(f.executed,['first','other']);assert.deepEqual(f.resolved.map(row=>row.configRevision),[1,1,1]);
    assert.deepEqual(f.store.get<RuntimeOperation>('operations',overlap.operation!.operationId)?.resourceScope,['shop/A']);
  }finally{await f.close();}
});

test('a pending request with no provider scope blocks the full connection',async()=>{
  const f=fixture();try{
    f.plans.set('unscoped',{status:'pending'});f.plans.set('B',{targets:['shop/B'],status:'ok'});
    const first=await f.invoke('unscoped',{}, {resourceScope:['invented/A']});assert.equal(first.status,'pending');assert.equal(f.store.get<RuntimeOperation>('operations',first.operation!.operationId)?.resourceScope,undefined);
    const next=await f.invoke('B');assert.equal(next.status,'failed');assert.ok('error'in next);assert.equal(next.error.code,'OPERATION_UNRESOLVED');assert.deepEqual(f.executed,['unscoped']);
  }finally{await f.close();}
});

test('an unscoped incoming request cannot bypass a pending scoped request',async()=>{
  const f=fixture();try{
    f.plans.set('A',{targets:['shop/A'],status:'pending'});f.plans.set('unscoped',{status:'ok'});await f.invoke('A');
    const next=await f.invoke('unscoped',{}, {resourceScope:['invented/B']});assert.equal(next.status,'failed');assert.deepEqual(f.executed,['A']);
  }finally{await f.close();}
});

test('resource locks do not cross connections and unresolved overlap checks every target',async()=>{
  const f=fixture();try{
    f.plans.set('batch',{targets:['shop/C','shop/A'],status:'pending'});f.plans.set('C',{targets:['shop/C'],status:'ok'});
    const first=await f.invoke('batch');assert.deepEqual(f.store.get<RuntimeOperation>('operations',first.operation!.operationId)?.resourceScope,['shop/A','shop/C']);
    assert.equal((await f.invoke('C',{connectionId:'C2'})).status,'ok');assert.equal((await f.invoke('C')).status,'failed');assert.deepEqual(f.executed,['batch','C']);
  }finally{await f.close();}
});

test('connection-scoped descriptors never narrow their lock using an optional provider hook',async()=>{
  const f=fixture('connection');try{
    f.plans.set('A',{targets:['shop/A'],status:'pending'});f.plans.set('B',{targets:['shop/B'],status:'ok'});await f.invoke('A');assert.equal((await f.invoke('B')).status,'failed');assert.deepEqual(f.resolved,[]);assert.deepEqual(f.executed,['A']);
  }finally{await f.close();}
});

test('unavailable stored scope refuses before any mutation is reserved or dispatched',async()=>{
  const f=fixture();try{f.plans.set('bad',{scopeError:true,status:'ok'});const result=await f.invoke('bad');assert.equal(result.status,'failed');assert.ok('error'in result);assert.equal(result.error.code,'MUTATION_TARGETS_UNAVAILABLE');assert.equal(f.store.list('operations').length,0);assert.deepEqual(f.executed,[]);}finally{await f.close();}
});

test('explicit duplicate intent retains the original pending operation and its durable scope',async()=>{
  const f=fixture();try{f.plans.set('A',{targets:['shop/A'],status:'pending'});const first=await f.invoke('A',{idempotencyKey:'same-intent'}),again=await f.invoke('A',{idempotencyKey:'same-intent'});assert.equal(again.status,'pending');assert.equal(again.operation?.operationId,first.operation?.operationId);assert.equal(f.store.list('operations').length,1);assert.deepEqual(f.executed,['A']);}finally{await f.close();}
});
