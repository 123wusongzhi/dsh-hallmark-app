import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppsPresentationHandlers} from '../../packages/plugin-apps/client/component-handlers.ts';

const identity={sessionId:'A',viewId:'view',buildId:'build'};
const nativeCapabilities={adapterReady:true,nativeSessionAdapter:'dsh-0.2.0-rc.2',hostVersion:'0.2.0-rc.2',updateContext:true,requestAgent:true};
function deferredProbes(t:{after:(fn:()=>void)=>void}) {
  const original=globalThis.fetch;
  const requests=new Map<string,{resolve:(response:Response)=>void;reject:(reason:unknown)=>void;signal:AbortSignal|null|undefined}>();
  globalThis.fetch=((input:unknown,init?:RequestInit)=>new Promise<Response>((resolve,reject)=>{
    const resource=new URL(String(input),'http://fixture').searchParams.get('resource');
    assert.ok(resource);assert.equal(init?.credentials,'same-origin');assert.equal(requests.has(resource),false);
    requests.set(resource,{resolve,reject,signal:init?.signal});
    init?.signal?.addEventListener('abort',()=>reject(init.signal!.reason),{once:true});
  })) as typeof fetch;
  t.after(()=>{globalThis.fetch=original;});
  const reply=(resource:string,value:unknown)=>{const request=requests.get(resource);assert.ok(request);request.resolve(Response.json(value));};
  const fail=(resource:string)=>{const request=requests.get(resource);assert.ok(request);request.reject(new Error('probe unavailable'));};
  return {requests,reply,fail};
}

test('capability probes start together and handlers await both independent results',async t=>{
  const f=deferredProbes(t);let settled=false;
  const pending=createAppsPresentationHandlers(identity,new AbortController().signal).then(value=>{settled=true;return value;});
  assert.deepEqual([...f.requests.keys()],['hostCapabilities','componentFeatures'],'neither probe waits for the other response');
  f.reply('componentFeatures',{features:['renderReadyV1','dataTransferV1','unknown-feature']});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
  f.reply('hostCapabilities',nativeCapabilities);const handlers=await pending;
  assert.equal(typeof handlers.updateContext,'function');assert.equal(typeof handlers.requestAgent,'function');
  assert.deepEqual(Object.keys(handlers.extensions??{}),['renderReadyV1','dataTransferV1']);
});

test('a failed native capability probe preserves display extensions',async t=>{
  const f=deferredProbes(t),pending=createAppsPresentationHandlers(identity,new AbortController().signal,{publicationId:'publication',attemptId:'attempt',attemptEpoch:1,displayId:'display',displayGeneration:1});
  f.fail('hostCapabilities');f.reply('componentFeatures',{features:['renderReadyV1']});
  const handlers=await pending;
  assert.equal(handlers.updateContext,undefined);assert.equal(handlers.requestAgent,undefined);
  assert.deepEqual(Object.keys(handlers.extensions??{}),['renderReadyV1']);assert.equal(typeof handlers.authorizeFrame,'function');
});

test('a failed extension probe preserves verified native capabilities',async t=>{
  const f=deferredProbes(t),pending=createAppsPresentationHandlers(identity,new AbortController().signal);
  f.fail('componentFeatures');f.reply('hostCapabilities',nativeCapabilities);
  const handlers=await pending;
  assert.equal(typeof handlers.updateContext,'function');assert.equal(typeof handlers.requestAgent,'function');
  assert.equal(handlers.extensions,undefined);assert.equal(handlers.authorizeFrame,undefined);
});

test('aborting startup rejects pending parallel probes instead of returning fallback handlers',async t=>{
  const f=deferredProbes(t),controller=new AbortController(),pending=createAppsPresentationHandlers(identity,controller.signal);
  const rejected=assert.rejects(pending,{name:'AbortError'});controller.abort();await rejected;
  assert.equal(f.requests.size,2);for(const request of f.requests.values())assert.equal(request.signal?.aborted,true);
});

test('disabled extension negotiation makes only the native capability probe',async t=>{
  const f=deferredProbes(t),pending=createAppsPresentationHandlers(identity,new AbortController().signal,undefined,false);
  assert.deepEqual([...f.requests.keys()],['hostCapabilities']);f.reply('hostCapabilities',nativeCapabilities);
  const handlers=await pending;assert.equal(typeof handlers.updateContext,'function');assert.equal(handlers.extensions,undefined);
});

test('a fixed display still rejects missing required extensions',async t=>{
  const f=deferredProbes(t),pending=createAppsPresentationHandlers(identity,new AbortController().signal,{publicationId:'publication',attemptId:'attempt',attemptEpoch:1,displayId:'display',displayGeneration:1});
  f.fail('componentFeatures');f.reply('hostCapabilities',nativeCapabilities);
  await assert.rejects(pending,{code:'DISPLAY_EXTENSION_UNAVAILABLE'});
});
