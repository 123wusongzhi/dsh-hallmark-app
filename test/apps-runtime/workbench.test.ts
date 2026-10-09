import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {validateInvocation} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

test('workbench queries require saved explicit instance binding and never gain mutation admission',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let calls=0;
 const descriptor=(effect:'query'|'mutation'):CapabilityDescriptor=>({capabilityId:`sample.rows.${effect}`,version:'1.0.0',title:'Rows',description:'Rows',effect,inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:effect==='query'?'not_applicable':'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]});
 runtime.register({manifest:{manifestVersion:1,appId:'sample',displayName:'Sample',providerPackage:'sample',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor('query'),descriptor('mutation')],execute:async context=>{calls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{}};},dispose:async()=>{}});
 runtime.addConnection({appId:'sample',connectionId:'enabled',displayName:'Enabled',enabled:true,config:{},configRevision:1});
 const request=(effect='query',instanceId='one'):InvocationRequest=>({protocolVersion:'1.0',appId:'sample',connectionId:'enabled',capabilityId:`sample.rows.${effect}`,capabilityVersion:'1.0.0',invocationId:randomUUID(),traceId:randomUUID(),input:{},source:{kind:'workbench',workbenchId:'workbench:sample',instanceId},deadlineAt:new Date(Date.now()+1000).toISOString(),...(effect==='mutation'?{idempotencyKey:randomUUID()}: {})});
 try {
  assert.deepEqual(validateInvocation(request()),[]);
  const missing=await runtime.invoke(request());assert.equal(missing.status,'failed');assert.equal('error' in missing&&missing.error.code,'WORKBENCH_BINDING_REQUIRED');
  store.put('saved_assets','workbench:sample',{kind:'workbench',workbenchId:'workbench:sample',instances:[{instanceId:'one',bindings:[{appId:'sample',connectionId:'enabled',capabilityId:'sample.rows.query',capabilityMajor:1}]}]});
  assert.equal((await runtime.invoke(request())).status,'ok');assert.equal(calls,1);
  const other=await runtime.invoke(request('query','two'));assert.equal('error' in other&&other.error.code,'WORKBENCH_BINDING_REQUIRED');
  const write=await runtime.invoke(request('mutation'));assert.equal('error' in write&&write.error.code,'WORKBENCH_READ_ONLY');assert.equal(calls,1);
  store.put('saved_assets','workbench:sample',{kind:'workbench',workbenchId:'workbench:sample',context:{storeId:'A'},instances:[{instanceId:'one',bindings:[{appId:'sample',connectionId:'enabled',capabilityId:'sample.rows.query',capabilityMajor:1,input:{storeId:'A'}}]}]});
  const crossStore=await runtime.invoke({...request(),input:{storeId:'B'}});assert.equal('error' in crossStore&&crossStore.error.code,'WORKBENCH_STORE_MISMATCH');assert.equal(calls,1);
  assert.equal((await runtime.invoke({...request(),input:{storeId:'A'}})).status,'ok');assert.equal(calls,2);
  store.delete('saved_assets','workbench:sample');assert.equal((await runtime.invoke(request())).status,'failed');
 }finally{await runtime.dispose();store.close();}
});
