import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppsClient,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import type {BridgeIdentity,JsonValue} from '../../packages/app-contracts/src/index.ts';

const identity:BridgeIdentity={protocolVersion:'2.0',sessionId:'session-a',viewId:'view-a',buildId:'build-a',frameInstanceId:'frame-a'};
function browser(host?:ComponentHost){
  const listeners=new Set<(event:MessageEvent)=>void>(),posts:unknown[]=[];
  const parent={postMessage:(message:unknown)=>{posts.push(message);if(host)void host.handle(message).then(response=>{if(response)emit(response);});}};
  const win={parent,location:{origin:'http://apps.test'},addEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.add(listener),removeEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.delete(listener)} as unknown as Window;
  const emit=(message:unknown,source:unknown=parent,origin='http://apps.test')=>{for(const listener of listeners)listener({data:message,source,origin} as MessageEvent);};
  return {win,parent,posts,emit,listeners};
}
test('v2 negotiates identity and methods, rejects foreign source/origin/frame replies and disposes all pending requests',async()=>{
  const f=browser(),client=createAppsClient({window:f.win,timeoutMs:1000});
  const handshake=f.posts[0] as {requestId:string};
  f.emit({...identity,channel:COMPONENT_CHANNEL,type:'hello',requestId:'hello-retired',supportedMethods:['getData','getContext'],maxMessageBytes:1000,contextRevision:0});
  f.emit({...identity,channel:COMPONENT_CHANNEL,type:'hello',requestId:handshake.requestId,supportedMethods:['getData','getContext'],maxMessageBytes:1000,contextRevision:0});
  assert.equal((await client.hello()).frameInstanceId,'frame-a');
  const pending=client.getData();await Promise.resolve();const request=f.posts.at(-1) as {requestId:string};
  f.emit({...identity,channel:COMPONENT_CHANNEL,requestId:request.requestId,result:'foreign'},{});f.emit({...identity,channel:COMPONENT_CHANNEL,requestId:request.requestId,result:'origin'},f.parent,'http://other.test');f.emit({...identity,frameInstanceId:'old-frame',channel:COMPONENT_CHANNEL,requestId:request.requestId,result:'old'});
  f.emit({...identity,channel:COMPONENT_CHANNEL,requestId:request.requestId,result:{revision:'current'}});assert.deepEqual(await pending,{revision:'current'});
  const waiting=client.getContext();await Promise.resolve();client.dispose();await assert.rejects(waiting,{code:'BRIDGE_CLOSED'});assert.equal(f.listeners.size,0);
});
test('retired frames cannot send delayed refresh responses or replace a new handshake',async()=>{
  let finish:(value:JsonValue)=>void=()=>{};
  const old=new ComponentHost(identity,{getData:()=>({revision:'A'}),getContext:()=>({}),refresh:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=old.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'refresh-a',method:'refresh',params:null});old.dispose();finish({revision:'late-A'});assert.equal(await pending,undefined);
  const current=new ComponentHost({...identity,buildId:'build-b',frameInstanceId:'frame-b'},{getData:()=>({revision:'B'}),getContext:()=>({})});
  assert.equal(await current.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'old',method:'getData',params:null}),undefined);
  const f=browser(current),client=createAppsClient({window:f.win});await client.hello();f.emit(old.hello());assert.deepEqual(await client.getData(),{revision:'B'});client.dispose();current.dispose();
});
test('unknown protocol majors, oversized requests and unverified session input paths fail explicitly',async()=>{
  const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({})},{maxMessageBytes:500});
  const unsupported=await host.handle({...identity,protocolVersion:'3.0',channel:COMPONENT_CHANNEL,requestId:'bad-version',method:'getData',params:null});assert.equal((unsupported as {error:{code:string}}).error.code,'UNSUPPORTED_PROTOCOL');
  const huge=await host.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'huge',method:'getData',params:'x'.repeat(1000)});assert.equal((huge as {error:{code:string}}).error.code,'BRIDGE_MESSAGE_TOO_LARGE');
  const cyclic:Record<string,unknown>={};cyclic.self=cyclic;const invalid=await host.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'cyclic',method:'getData',params:cyclic});assert.equal((invalid as {error:{code:string}}).error.code,'INVALID_BRIDGE_MESSAGE');
  const f=browser(host),client=createAppsClient({window:f.win});await client.hello();await assert.rejects(client.requestAgent({text:'Please analyze',expectedContextRevision:0}),{code:'UNSUPPORTED_HOST_CAPABILITY'});await assert.rejects(client.updateContext({expectedContextRevision:0,selections:[]}),{code:'UNSUPPORTED_HOST_CAPABILITY'});assert.equal(f.posts.length,1);client.dispose();
});
test('generic ResourceRef selection returns attached receipt and never reports submitted',async()=>{
  const selections:unknown[]=[];const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({}),attachSelection:request=>{selections.push(request.params);return {status:'attached',message:'Send this attachment manually.'};}});
  const f=browser(host),client=createAppsClient({window:f.win});const selection={bindingId:'notes',datasetRevision:'2',resources:[{appId:'notes',connectionId:'local',resourceType:'note',resourceId:'note-a'}]};
  assert.equal((await client.attachSelection(selection)).status,'attached');assert.deepEqual(selections,[selection]);await assert.rejects(client.requestAgent({text:'Please analyze',expectedContextRevision:0}),{code:'UNSUPPORTED_HOST_CAPABILITY'});client.dispose();
});
test('verified optional methods publish context without submitting and expose the native accepted receipt only on explicit request',async()=>{
  let updates=0,submissions=0;
  const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({contextRevision:0}),updateContext:request=>{updates++;assert.deepEqual(request.params,{expectedContextRevision:0,selections:[],summary:'Chosen resources'});return {status:'updated',contextRevision:1,snapshotId:'context-one',snapshot:{}};},requestAgent:request=>{submissions++;assert.deepEqual(request.params,{text:'Analyze the chosen resources',expectedContextRevision:1});return {status:'accepted',requestId:'native-rpc-one',contextRevision:1,contextSnapshotId:'context-one',receipt:{accepted:true,eventSeq:7}};}});
  const f=browser(host),client=createAppsClient({window:f.win});const hello=await client.hello();assert.ok(hello.supportedMethods.includes('updateContext'));assert.ok(hello.supportedMethods.includes('requestAgent'));assert.equal(updates,0);assert.equal(submissions,0);
  const context=await client.updateContext({expectedContextRevision:0,selections:[],summary:'Chosen resources'});assert.equal(context.contextRevision,1);assert.equal(updates,1);assert.equal(submissions,0);
  const receipt=await client.requestAgent({text:'Analyze the chosen resources',expectedContextRevision:1});assert.equal(receipt.status,'accepted');assert.equal(receipt.requestId,'native-rpc-one');assert.equal(submissions,1);client.dispose();
});
test('an uncertain native request retains the original request ID for inspection and is never automatically resubmitted',async()=>{
  let submissions=0;const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({}),requestAgent:()=>{submissions++;return new Promise(()=>{});}}),f=browser(host),client=createAppsClient({window:f.win,timeoutMs:20});await client.hello();
  await assert.rejects(client.requestAgent({text:'Explicit request',expectedContextRevision:0}),error=>{const problem=error as {code:string;failure:{retryPolicy:string;details:{requestId:string;sessionId:string;frameInstanceId:string}}};assert.equal(problem.code,'BRIDGE_TIMEOUT');assert.equal(problem.failure.retryPolicy,'inspect_only');assert.equal(problem.failure.details.requestId,(f.posts.at(-1) as {requestId:string}).requestId);assert.equal(problem.failure.details.sessionId,identity.sessionId);assert.equal(problem.failure.details.frameInstanceId,identity.frameInstanceId);return true;});
  assert.equal(submissions,1);assert.equal(f.posts.length,2);client.dispose();host.dispose();
});
test('hello reads the current persisted context revision and refuses an invalid revision',async()=>{
  let revision=3;const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({})},{contextRevision:()=>revision});assert.equal(host.hello().contextRevision,3);revision=4;assert.equal(host.hello().contextRevision,4);revision=-1;const response=await host.handle({channel:COMPONENT_CHANNEL,type:'hello',protocolVersion:'2.0',requestId:'bad-revision'});assert.equal((response as {error:{code:string}}).error.code,'CONTEXT_UNAVAILABLE');host.dispose();
});
test('clients issuing their first call in the same millisecond have independent request identities',async()=>{
  const originalNow=Date.now;Date.now=()=>1234567890;const host=new ComponentHost(identity,{getData:()=>({}),getContext:()=>({})}),first=browser(host),second=browser(host),a=createAppsClient({window:first.win}),b=createAppsClient({window:second.win});
  try{await Promise.all([a.hello(),b.hello()]);await Promise.all([a.getData(),b.getData()]);const one=first.posts.at(-1) as {requestId:string},two=second.posts.at(-1) as {requestId:string};assert.notEqual(one.requestId,two.requestId);assert.match(one.requestId,/^[-a-zA-Z0-9_.:]{1,160}$/);assert.match(two.requestId,/^[-a-zA-Z0-9_.:]{1,160}$/);}finally{a.dispose();b.dispose();host.dispose();Date.now=originalNow;}
});
