import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {AppProvider,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

test('a persisted plan snapshot stays readable while its submit awaits external review',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
 let entered!:()=>void,finish!:()=>void;
 const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>finish=resolve);
 const base:CapabilityDescriptor={capabilityId:'snapshot.plan.submit',version:'1.0.0',title:'fixture',description:'fixture',effect:'mutation',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'async',timeoutMs:3000,concurrency:'exclusive',lockScope:'resources',idempotency:'upstream_supported',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 const provider:AppProvider={manifest:{manifestVersion:1,appId:'snapshot',displayName:'fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[base,{...base,capabilityId:'snapshot.plan.get',effect:'query',execution:{...base.execution,mode:'sync',concurrency:'declared_safe',idempotency:'not_applicable'}}],async execute(context){if(context.request.capabilityId.endsWith('submit')){entered();await gate;}return{invocationId:context.request.invocationId,traceId:context.request.traceId,status:'ok',data:{state:'reviewing'}};},async dispose(){}};
 runtime.register(provider);runtime.addConnection({appId:'snapshot',connectionId:'c',displayName:'fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'snapshot',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 const invoke=(operation:string)=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'snapshot',connectionId:'c',capabilityId:'snapshot.plan.'+operation,capabilityVersion:'1.0.0',input:{},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+3000).toISOString()} satisfies InvocationRequest);
 const write=invoke('submit');
 try{await started;const result=await Promise.race([invoke('get'),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('snapshot waited on external review')),500))]);assert.equal(result.status,'ok');}
 finally{finish();await write;await runtime.dispose();store.close();}
});
