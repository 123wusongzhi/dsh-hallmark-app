import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {CapabilityDescriptor,DatasetBinding,ExecutionContext} from '../../packages/app-contracts/src/index.ts';

function fixture(t:{after:(fn:()=>void)=>void}){
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());const runtime=new AppsRuntime(store),calls:ExecutionContext[]=[],releases:(()=>void)[]=[];
 const descriptor:CapabilityDescriptor={capabilityId:'shop.list',version:'1.0.0',title:'Rows',description:'Fixture rows',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:3000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 runtime.register({manifest:{manifestVersion:1,appId:'shop',displayName:'Shop',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],execute:async context=>{calls.push(context);await new Promise<void>(resolve=>releases.push(resolve));return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{secret:'authorized rows'}};},dispose:async()=>{}});
 runtime.addConnection({appId:'shop',connectionId:'c',displayName:'Shop',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:'a',appId:'shop',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 const service=new AppsPresentationService({store,runtime}),binding:DatasetBinding={bindingId:'rows',appId:'shop',connectionId:'c',capabilityId:'shop.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
 const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
 return {runtime,service,binding,calls,releases,tick};
}
const source=(sessionId:string)=>({kind:'agent' as const,sessionId,nativeCallId:'read'});

test('an unbound session cannot join another session refresh or poison its cached data',async t=>{
 const f=fixture(t),allowed=f.service.refreshBinding(f.binding,source('a'));await f.tick();
 const denied=f.service.refreshBinding(f.binding,source('b'));const check=assert.rejects(denied,{code:'APP_NOT_ACTIVE'});
 f.releases[0]();const ready=await allowed;await check;assert.equal(ready.state,'ready');assert.equal(f.calls.length,1);
 const view=f.service.createView('b',{title:'Unauthorized view',bindings:[f.binding]});
 await assert.rejects(f.service.refreshView('b',view.viewId,source('b')),{code:'APP_NOT_ACTIVE'});
 const a=f.service.createView('a',{title:'Authorized view',bindings:[f.binding]});assert.equal(f.service.getData('a',a.viewId).bindings[0].state,'ready');
});
test('distinct authorized callers each pass Runtime admission while identical calls still coalesce',async t=>{
 const f=fixture(t);f.runtime.bind({sessionId:'b',appId:'shop',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 const a=f.service.refreshBinding(f.binding,source('a')),duplicate=f.service.refreshBinding(f.binding,source('a')),b=f.service.refreshBinding(f.binding,source('b'));
 await f.tick();const count=f.calls.length;f.releases.forEach(release=>release());await Promise.all([a,duplicate,b]);
 assert.equal(count,2);assert.deepEqual(f.calls.map(call=>'sessionId' in call.request.source&&call.request.source.sessionId),['a','b']);
});
test('separate abort signals do not couple two refreshes from the same caller',async t=>{
 const f=fixture(t),first=new AbortController(),second=new AbortController();
 const a=f.service.refreshBinding(f.binding,source('a'),first.signal),b=f.service.refreshBinding(f.binding,source('a'),second.signal);
 await f.tick();const count=f.calls.length;first.abort();f.releases.forEach(release=>release());const [cancelled,ready]=await Promise.all([a,b]);
 assert.equal(count,2);assert.notEqual(cancelled.state,'ready');assert.equal(ready.state,'ready');
});
test('a late cancelled reader cannot downgrade a newer successful shared snapshot',async t=>{
 const f=fixture(t),first=new AbortController(),second=new AbortController(),view=f.service.createView('a',{title:'Rows',bindings:[f.binding]});
 const a=f.service.refreshBinding(f.binding,source('a'),first.signal),b=f.service.refreshBinding(f.binding,source('a'),second.signal);await f.tick();
 f.releases[1]();const ready=await b;first.abort();f.releases[0]();const cancelled=await a;
 assert.equal(ready.state,'ready');assert.notEqual(cancelled.state,'ready');
 assert.equal(f.service.getData('a',view.viewId).bindings[0].state,'ready');assert.equal(f.service.getData('a',view.viewId).bindings[0].revision,ready.revision);
});
