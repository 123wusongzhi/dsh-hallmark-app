import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {canonicalBinding,canonicalJson,datasetId} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

const source={kind:'agent' as const,sessionId:'s',nativeCallId:'read'};
function fixture(t:{after:(action:()=>void)=>void},supportsForce=true){
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());const calls:InvocationRequest[]=[];
 const descriptor:CapabilityDescriptor={capabilityId:'shop.list',version:'1.0.0',title:'Cache fixture',description:'Cache fixture',effect:'query',inputSchema:{type:'object',properties:{shop:{type:'string'},...(supportsForce?{forceRefresh:{type:'boolean'}}:{})},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:120000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 let payload:JsonValue={items:[{id:'one'}],cache:{stale:false,expiresAt:new Date(Date.now()+60000).toISOString()}},failure=false;
 const runtime={describe:()=>descriptor,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{calls.push(request);return failure?{status:'unavailable',invocationId:request.invocationId,traceId:request.traceId,error:{code:'BACKEND_OFFLINE',message:'Read failed',retryPolicy:'read_retry'}}:{status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:payload,provenance:[{appId:'shop',connectionId:'c',sourceKind:'application',sourceRef:'fixture',fetchedAt:new Date().toISOString(),sourceDataTime:null,freshness:'fresh'}]};}};
 const service=new AppsPresentationService({store,runtime}),binding:DatasetBinding={bindingId:'main',appId:'shop',connectionId:'c',capabilityId:'shop.list',capabilityMajor:1,input:{shop:'A'},projection:[],refresh:{mode:'manual'}},view=service.createView('s',{title:'Cache',bindings:[binding]});
 return {service,store,runtime,view,binding,calls,setPayload:(value:JsonValue)=>payload=value,fail:()=>failure=true};
}
test('forced refresh changes invocation input only, retains dataset identity, and expired metadata becomes stale',async t=>{
 const f=fixture(t),id=datasetId(f.binding);
 await f.service.refreshView('s',f.view.viewId,source,undefined,undefined,{forceRefresh:true});
 assert.deepEqual(f.calls[0].input,{shop:'A',forceRefresh:true});
 assert.equal(f.service.getView(f.view.viewId)!.bindings[0].datasetId,id);assert.deepEqual(f.service.getData('s',f.view.viewId).bindings[0].query!.input,{shop:'A'});
 assert.equal(canonicalJson(f.store.get<{canonicalBinding:JsonValue}>('datasets',id)!.canonicalBinding),canonicalJson(canonicalBinding(f.binding)));
 assert.equal(f.service.getData('s',f.view.viewId).bindings[0].freshness,'fresh');
 f.setPayload({items:[{id:'one'}],cache:{stale:false,expiresAt:new Date(Date.now()-1).toISOString()}});
 await f.service.refreshView('s',f.view.viewId,source,undefined,undefined,{forceRefresh:false});assert.deepEqual(f.calls[1].input,{shop:'A'});assert.equal(f.service.getData('s',f.view.viewId).bindings[0].freshness,'stale');
 f.fail();const failed=await f.service.refreshView('s',f.view.viewId,source,undefined,undefined,{forceRefresh:true});assert.equal(failed.bindings[0].state,'unavailable');assert.equal(failed.bindings[0].error!.code,'BACKEND_OFFLINE');assert.deepEqual((failed.bindings[0].payload as {items:unknown[]}).items,[{id:'one'}]);
});
test('forced refresh never sends an unsupported provider input',async t=>{const f=fixture(t,false);await f.service.refreshBinding(f.binding,source,undefined,{forceRefresh:true});assert.deepEqual(f.calls[0].input,{shop:'A'});});
test('a manual force arriving during a cached read waits, then deduplicates the forced refresh',async t=>{
 const f=fixture(t),original=f.runtime.invoke;let release:()=>void=()=>{};
 f.runtime.invoke=async request=>{await new Promise<void>(resolve=>{release=resolve;});return original(request);};
 const automatic=f.service.refreshBinding(f.binding,source),manual=f.service.refreshBinding(f.binding,source,undefined,{forceRefresh:true}),second=f.service.refreshBinding(f.binding,source,undefined,{forceRefresh:true});
 release();await automatic;await Promise.resolve();await Promise.resolve();release();await Promise.all([manual,second]);assert.equal(f.calls.length,2);assert.deepEqual(f.calls.map(call=>(call.input as {forceRefresh?:boolean}).forceRefresh),[undefined,true]);
});
