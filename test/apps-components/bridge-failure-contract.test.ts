import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import {ComponentBridgeError,createAppsClient,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {createAppsPresentationHandlers} from '../../packages/plugin-apps/client/component-handlers.ts';
import type {BridgeIdentity,BridgeRequest,FailureInfo,JsonValue} from '../../packages/app-contracts/src/index.ts';
import type {ComponentHostHandlers} from '../../packages/component-runtime/src/host.ts';

const identity:BridgeIdentity={protocolVersion:'2.0',sessionId:'failure-fixture',viewId:'view-fixture',buildId:'build-fixture',frameInstanceId:'frame-fixture'};
const invocation=(mutation=false):JsonValue=>({appId:'fixtureapp',connectionId:'C1',capabilityId:mutation?'fixtureapp.rows.write':'fixtureapp.rows.read',capabilityVersion:'1.0.0',input:{},deadlineAt:new Date(Date.now()+1000).toISOString(),...(mutation?{idempotencyKey:'original-write-intent'}:{})});
function bridge(handlers:Partial<ComponentHostHandlers>,timeoutMs=30){
  const listeners=new Set<(event:any)=>void>(),requests:BridgeRequest[]=[],host=new ComponentHost(identity,{getData:()=>null,getContext:()=>null,...handlers});
  const origin='http://127.0.0.1:45222';
  const parent={postMessage(message:any,target:string){assert.equal(target,origin);if(message.method)requests.push(structuredClone(message));void Promise.resolve(host.handle(message)).then(reply=>{if(reply)for(const listener of listeners)listener({source:parent,origin,data:reply});});}};
  const child={location:{origin},parent,addEventListener(type:string,listener:any){if(type==='message')listeners.add(listener);},removeEventListener(type:string,listener:any){if(type==='message')listeners.delete(listener);}} as unknown as Window;
  const client=createAppsClient({window:child,timeoutMs});
  return {client,host,requests,listeners,close(){client.dispose();host.dispose();assert.equal(listeners.size,0);}};
}
async function rejected(action:Promise<unknown>):Promise<ComponentBridgeError>{try{await action;assert.fail('Expected a bridge failure');}catch(error){assert.ok(error instanceof ComponentBridgeError);return error;}}

test('an unanswered submitted read bridge request permits a read retry',async()=>{
  const f=bridge({invokeCapability:()=>new Promise(()=>{})});try{
    await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation()));
    assert.equal(error.code,'BRIDGE_TIMEOUT');assert.equal(error.failure.retryPolicy,'read_retry');assert.equal(f.requests.length,1);
    assert.equal((error.failure.details as any).requestId,f.requests[0].requestId);
  }finally{f.close();}
});

test('an unanswered submitted mutation bridge request retains the original intent and permits inspection only',async()=>{
  const f=bridge({invokeCapability:()=>new Promise(()=>{})});try{
    await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));
    assert.equal(error.code,'BRIDGE_TIMEOUT');assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal(f.requests.length,1);
    const details=error.failure.details as any;assert.equal(details.requestId,f.requests[0].requestId);assert.equal(details.idempotencyKey,'original-write-intent');assert.equal(details.doNotResubmitMutation,true);assert.equal(details.appId,'fixtureapp');assert.equal(details.connectionId,'C1');
    assert.equal(details.operationId,undefined,'A bridge cannot invent a Runtime operation identity');
  }finally{f.close();}
});

test('a business submission without a caller key still permits only original request inspection',async()=>{
  const f=bridge({invokeCapability:()=>new Promise(()=>{})});try{
    await f.client.hello();const error=await rejected(f.client.invokeCapability({appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:'P1'}}));
    assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal((error.failure.details as any).doNotResubmitMutation,true);assert.equal(f.requests.length,1);
  }finally{f.close();}
});

for(const retryPolicy of ['never','read_retry','inspect_only'] as const){
  test(`an explicit backend bridge ${retryPolicy} failure retains its code, policy and details`,async()=>{
    const failure:FailureInfo={code:retryPolicy==='never'?'INVALID_INPUT':'RESPONSE_UNAVAILABLE',message:'Explicit original backend failure',retryPolicy,details:{field:'input.price',invocationId:'original-backend-invocation'}};
    const f=bridge({invokeCapability:()=>{throw new ComponentBridgeError(failure);}});try{
      await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));assert.deepEqual(error.failure,failure);assert.equal(f.requests.length,1);
    }finally{f.close();}
  });
}

test('disposing a component with an unanswered mutation keeps inspection-only recovery',async()=>{
  const f=bridge({invokeCapability:()=>new Promise(()=>{})},1000);try{
    await f.client.hello();const promise=rejected(f.client.invokeCapability(invocation(true)));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,1);f.client.dispose();
    const error=await promise;assert.equal(error.code,'BRIDGE_CLOSED');assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal((error.failure.details as any).idempotencyKey,'original-write-intent');
  }finally{f.close();}
});

test('the browser proxy passes through an explicit original error without losing its recovery policy',async()=>{
  const originalFetch=globalThis.fetch,requests:any[]=[];
  const failure:FailureInfo={code:'RUNTIME_RESPONSE_UNAVAILABLE',message:'Inspect the original attempt',retryPolicy:'inspect_only',details:{invocationId:'known-original',doNotResubmitMutation:true}};
  globalThis.fetch=async(input:any,init:any)=>{
    if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});
    const body=JSON.parse(init.body);requests.push(body);return Response.json({...body.request,error:failure});
  };
  let f:ReturnType<typeof bridge>|undefined;
  try{
    const handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,undefined,false);f=bridge(handlers);await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));
    assert.deepEqual(error.failure,failure);assert.equal(requests.length,1);assert.equal(requests[0].action,'componentBridge');assert.equal(requests[0].request.channel,COMPONENT_CHANNEL);
  }finally{f?.close();globalThis.fetch=originalFetch;}
});

test('a lost browser proxy mutation response keeps inspection-only recovery with the original bridge identity',async()=>{
  const originalFetch=globalThis.fetch,requests:any[]=[];
  globalThis.fetch=async(input:any,init:any)=>{
    if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});
    requests.push(JSON.parse(init.body));throw new TypeError('Response lost after submitting the isolated proxy request');
  };
  let f:ReturnType<typeof bridge>|undefined;
  try{
    const handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,undefined,false);f=bridge(handlers);await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));
    assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal(requests.length,1);assert.equal((error.failure.details as any).requestId,requests[0].request.requestId);assert.equal((error.failure.details as any).idempotencyKey,'original-write-intent');assert.equal((error.failure.details as any).doNotResubmitMutation,true);
  }finally{f?.close();globalThis.fetch=originalFetch;}
});

test('a stale non-success proxy bridge response cannot be relabelled as the current frame',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input:any,init:any)=>{
    if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});
    const body=JSON.parse(init.body);return Response.json({...body.request,frameInstanceId:'retired-frame',error:{code:'OLD_WRITE_UNKNOWN',message:'An unrelated operation',retryPolicy:'inspect_only',details:{invocationId:'other-operation'}}},{status:503});
  };
  let f:ReturnType<typeof bridge>|undefined;
  try {const handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,undefined,false);f=bridge(handlers);await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));assert.equal(error.code,'INVALID_BRIDGE_RESPONSE');assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal((error.failure.details as any).requestId,f.requests[0].requestId);assert.equal((error.failure.details as any).idempotencyKey,'original-write-intent');assert.equal((error.failure.details as any).invocationId,undefined);assert.equal((error.failure.details as any).operationId,undefined);}
  finally{f?.close();globalThis.fetch=originalFetch;}
});

test('a malformed response after submitting a mutation keeps the original inspection target',async()=>{
  const originalFetch=globalThis.fetch,requests:any[]=[];
  globalThis.fetch=async(input:any,init:any)=>{if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});requests.push(JSON.parse(init.body));return Response.json(null);};
  let f:ReturnType<typeof bridge>|undefined;
  try {const handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,undefined,false);f=bridge(handlers);await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));assert.equal(error.code,'INVALID_BRIDGE_RESPONSE');assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal((error.failure.details as any).idempotencyKey,'original-write-intent');assert.equal(requests.length,1);}
  finally{f?.close();globalThis.fetch=originalFetch;}
});

test('bounded errors retain known operation identities when other individually allowed fields do not fit',async()=>{
  const host=new ComponentHost(identity,{getData:()=>null,getContext:()=>null,invokeCapability:()=>{throw new ComponentBridgeError({code:'UNCERTAIN',message:'Inspect existing operation',retryPolicy:'inspect_only',details:{invocationId:'known-original',traceId:'known-trace',operationId:'known-operation',doNotResubmitMutation:true,idempotencyKey:'k'.repeat(512),connectionId:'c'.repeat(512),large:'x'.repeat(10000)}});}},{maxMessageBytes:1024});
  try {const response=await host.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'bounded-original',method:'invokeCapability',params:invocation(true)});assert.ok(response&&'error'in response&&response.error);const details=response.error.details as any;assert.equal(details.invocationId,'known-original');assert.equal(details.traceId,'known-trace');assert.equal(details.operationId,'known-operation');assert.equal(details.doNotResubmitMutation,true);assert.equal(response.error.retryPolicy,'inspect_only');assert.ok(new TextEncoder().encode(JSON.stringify(response)).length<=1024);}
  finally{host.dispose();}
});

test('an already aborted browser bridge does not submit a mutation',async()=>{
  const originalFetch=globalThis.fetch,requests:any[]=[];
  globalThis.fetch=async(input:any,init:any)=>{if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});requests.push(JSON.parse(init.body));throw new Error('A cancelled request must not be dispatched');};
  let f:ReturnType<typeof bridge>|undefined;
  try {const controller=new AbortController(),handlers=await createAppsPresentationHandlers(identity,controller.signal,undefined,false);controller.abort();f=bridge(handlers);await f.client.hello();const error=await rejected(f.client.invokeCapability(invocation(true)));assert.equal(error.failure.retryPolicy,'never');assert.equal(requests.length,0);}
  finally{f?.close();globalThis.fetch=originalFetch;}
});

for(const malformed of [false,true])test(`structured component errors respect JSON and byte limits (${malformed?'non-JSON':'oversized'})`,async()=>{
  const details:any=malformed?{invalid:()=>{}}:{large:'x'.repeat(10000)};
  const host=new ComponentHost(identity,{getData:()=>null,getContext:()=>null,invokeCapability:()=>{throw new ComponentBridgeError({code:'ORIGINAL_UNCERTAIN',message:'Inspect original submission',retryPolicy:'inspect_only',details});}},{maxMessageBytes:1024});
  try {const response=await host.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'bounded-error-request',method:'invokeCapability',params:invocation(true)});assert.ok(response&&'error' in response&&response.error);assert.equal(response.error.retryPolicy,'inspect_only');assert.equal(response.error.details,undefined);assert.ok(new TextEncoder().encode(JSON.stringify(response)).length<=1024);assert.equal(response.error.code,malformed?'INVALID_BRIDGE_MESSAGE':'BRIDGE_MESSAGE_TOO_LARGE');}
  finally{host.dispose();}
});
