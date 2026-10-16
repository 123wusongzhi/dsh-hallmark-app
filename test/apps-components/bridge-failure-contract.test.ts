import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import {ComponentBridgeError,createAppsClient,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {createAppsPresentationHandlers} from '../../packages/plugin-apps/client/component-handlers.ts';
import type {BridgeIdentity,BridgeRequest,FailureInfo,JsonValue} from '../../packages/app-contracts/src/index.ts';
import type {ComponentHostHandlers,ComponentExtensionRequest} from '../../packages/component-runtime/src/host.ts';

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

test('an authoritative Agent pre-admission failure keeps its recovery policy and evidence',async()=>{
  const failure:FailureInfo={code:'CONTEXT_REVISION_CONFLICT',message:'Publish the current context before requesting.',retryPolicy:'never',details:{submitted:false,expectedRevision:1,currentRevision:2}};
  const f=bridge({requestAgent:()=>{throw new ComponentBridgeError(failure);}});try{
    await f.client.hello();const error=await rejected(f.client.requestAgent({text:'Analyze this',expectedContextRevision:1}));
    assert.deepEqual(error.failure,failure);assert.equal(f.requests.length,1);
  }finally{f.close();}
});

test('a locally oversized Agent request proves that no request was submitted',async()=>{
  const f=bridge({requestAgent:()=>assert.fail('Local validation must not dispatch')});try{
    const hello=await f.client.hello();const error=await rejected(f.client.requestAgent({text:'x'.repeat(hello.maxMessageBytes),expectedContextRevision:1}));
    assert.equal(error.code,'BRIDGE_MESSAGE_TOO_LARGE');assert.equal(error.failure.retryPolicy,'never');assert.equal((error.failure.details as any).submitted,false);assert.equal(f.requests.length,0);
  }finally{f.close();}
});

for(const mode of ['timeout','dispose'] as const)test(`an unanswered Agent request remains inspect-only after ${mode}`,async()=>{
  const f=bridge({requestAgent:()=>new Promise(()=>{})},mode==='dispose'?1000:30);try{
    await f.client.hello();const promise=rejected(f.client.requestAgent({text:'Analyze this',expectedContextRevision:1}));
    if(mode==='dispose'){await new Promise(resolve=>setImmediate(resolve));f.client.dispose();}
    const error=await promise;assert.equal(error.failure.retryPolicy,'inspect_only');assert.equal((error.failure.details as any).requestId,f.requests[0].requestId);assert.equal(f.requests.length,1);
  }finally{f.close();}
});

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

test('extension proxy failures keep a read_retry policy and the Runtime evidence instead of dropping them',async()=>{
  const originalFetch=globalThis.fetch;let mode:'network'|'blank'|'busy'|'rejected'|'gateway'='network';
  const extensionRequest=(feature:ComponentExtensionRequest['feature'],action:string,params:JsonValue):ComponentExtensionRequest=>({channel:COMPONENT_CHANNEL,type:'extension',...identity,requestId:'ext-1',feature,action,params});
  const read=extensionRequest('dataTransferV1','prepare',{method:'getData',documentNonce:'doc'}),write=extensionRequest('renderReadyV1','ready',{});
  globalThis.fetch=async(input:any)=>{
    if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});
    if(String(input).includes('resource=componentFeatures'))return Response.json({features:['dataTransferV1','renderReadyV1']});
    if(mode==='network')throw new TypeError('fetch failed');
    if(mode==='blank')return new Response('',{status:200});
    if(mode==='busy')return Response.json({status:'failed',error:{code:'RUNTIME_STORE_BUSY',message:'busy',retryPolicy:'read_retry',details:{requestId:'srv',cause:'boom',attempts:2}}},{status:503});
    if(mode==='rejected')return Response.json({status:'failed',error:{code:'BRIDGE_IDENTITY_STALE',message:'stale',retryPolicy:'never'}},{status:409});
    return Response.json({},{status:502});
  };
  try{
    const handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,undefined,true),extension=async(request:ComponentExtensionRequest)=>await handlers.extensions!.dataTransferV1!(request),ready=async(request:ComponentExtensionRequest)=>await handlers.extensions!.renderReadyV1!(request);
    const fails=async(action:Promise<unknown>):Promise<ComponentBridgeError>=>{try{await action;}catch(error){assert.ok(error instanceof ComponentBridgeError,String(error));return error;}throw new Error('Expected a failure');};
    let error=await fails(extension(read));assert.equal(error.code,'BRIDGE_PROXY_UNAVAILABLE');assert.equal(error.failure.retryPolicy,'read_retry');assert.match(String((error.failure.details as any).cause),/fetch failed/);assert.equal((error.failure.details as any).feature,'dataTransferV1');
    error=await fails(ready(write));assert.equal(error.code,'BRIDGE_PROXY_UNAVAILABLE');assert.equal(error.failure.retryPolicy,'inspect_only','a non-read extension is never marked safe to repeat');
    mode='blank';error=await fails(extension(read));assert.equal(error.code,'INVALID_BRIDGE_RESPONSE');assert.equal(error.failure.retryPolicy,'read_retry');assert.equal((error.failure.details as any).httpStatus,200);
    mode='busy';error=await fails(extension(read));assert.equal(error.code,'RUNTIME_STORE_BUSY');assert.equal(error.failure.retryPolicy,'read_retry');assert.deepEqual({requestId:(error.failure.details as any).requestId,cause:(error.failure.details as any).cause,attempts:(error.failure.details as any).attempts,httpStatus:(error.failure.details as any).httpStatus},{requestId:'srv',cause:'boom',attempts:2,httpStatus:503});
    mode='rejected';error=await fails(extension(read));assert.equal(error.code,'BRIDGE_IDENTITY_STALE');assert.equal(error.failure.retryPolicy,'never');
    mode='gateway';error=await fails(extension(read));assert.equal(error.code,'EXTENSION_UNAVAILABLE');assert.equal(error.failure.retryPolicy,'read_retry');
    error=await fails(ready(write));assert.equal(error.failure.retryPolicy,'inspect_only');
  }finally{globalThis.fetch=originalFetch;}
});

test('a retryable first read is reported only after the third failure; a deterministic one at once',async()=>{
  const originalFetch=globalThis.fetch;let failure:FailureInfo={code:'RUNTIME_INTERNAL_ERROR',message:'busy',retryPolicy:'read_retry',details:{requestId:'srv-1',cause:'boom'}};
  globalThis.fetch=async(input:any,init:any)=>{
    if(String(input).includes('resource=hostCapabilities'))return Response.json({adapterReady:false});
    if(String(input).includes('resource=componentFeatures'))return Response.json({features:['renderReadyV1']});
    return Response.json({...JSON.parse(init.body).request,error:failure});
  };
  const publication={publicationId:'P',attemptId:'A',attemptEpoch:1,displayId:'D',displayGeneration:1},getData=(requestId:string):BridgeRequest=>({channel:COMPONENT_CHANNEL,...identity,requestId,method:'getData',params:null} as unknown as BridgeRequest);
  try{
    let problems:any[]=[];let handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,publication,true,problem=>problems.push(problem));
    for(let attempt=1;attempt<=3;attempt++){await assert.rejects(async()=>await handlers.getData!(getData('r'+attempt)));assert.equal(problems.length,attempt<3?0:1,`failure ${attempt}`);}
    assert.deepEqual(problems[0],{phase:'data',code:'RUNTIME_INTERNAL_ERROR',message:'busy',requestId:'srv-1',retryPolicy:'read_retry',cause:'boom',attempts:3});
    problems=[];handlers=await createAppsPresentationHandlers(identity,new AbortController().signal,publication,true,problem=>problems.push(problem));
    failure={code:'BRIDGE_IDENTITY_STALE',message:'stale',retryPolicy:'never'};await assert.rejects(async()=>await handlers.getData!(getData('r4')));
    assert.equal(problems.length,1);assert.equal(problems[0].code,'BRIDGE_IDENTITY_STALE');assert.equal(problems[0].attempts,1);assert.equal(problems[0].retryPolicy,'never');
  }finally{globalThis.fetch=originalFetch;}
});
