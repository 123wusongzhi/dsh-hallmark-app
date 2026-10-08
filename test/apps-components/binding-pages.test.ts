import test from 'node:test';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import assert from 'node:assert/strict';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import type {CapabilityDescriptor,CapabilityResult,InvocationRequest,BridgeIdentity} from '../../packages/app-contracts/src/index.ts';

function setup(t:any){
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());
 const calls:InvocationRequest[]=[];
 const descriptor:CapabilityDescriptor={capabilityId:'products.list',version:'1.0.0',title:'Products',description:'Products',effect:'query',inputSchema:{type:'object',properties:{limit:{type:'integer'},cursor:{type:'string'}},required:['limit'],additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 const runtime={describe:()=>descriptor,invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{calls.push(request);const {cursor='0',limit}=request.input as {cursor?:string;limit:number},start=Number(cursor),items=Array.from({length:Math.min(limit,338-start)},(_,i)=>({id:String(start+i)}));return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items,total:338,...(start+limit<338?{cursor:String(start+limit)}:{})}};}};
 const service=new AppsPresentationService({store,runtime,resources:(binding,result)=>'data' in result?(result.data as any).items.map((row:any)=>({appId:binding.appId,connectionId:binding.connectionId,resourceType:'product',resourceId:row.id})):[]});
 const view=service.createView('session',{title:'Products',bindings:[{bindingId:'products',appId:'shop',connectionId:'shop-1',capabilityId:'products.list',capabilityMajor:1,input:{limit:20},projection:[],refresh:{mode:'manual'}}]});
 const identity:BridgeIdentity={protocolVersion:'2.0',sessionId:'session',viewId:view.viewId,buildId:'build',frameInstanceId:'frame'};
 let requestId=0;
 const call=async(frame:BridgeIdentity,method:string,params:any,extension=false)=>{const host=service.createHost(frame,{clientFeatures:['bindingPagesV1'],attachSelection:async(_identity,selection)=>({status:'validated',selection} as any)});try{return await host.handle({...frame,channel:COMPONENT_CHANNEL,requestId:String(++requestId),...(extension?{type:'extension',feature:'bindingPagesV1',action:'read'}:{method}),params}) as any;}finally{host.dispose();}};
 return {store,service,view,identity,call,calls,runtime};
}
test('page 4 and final page attach across recreated HTTP hosts, without changing saved binding or another frame',async t=>{
 const f=setup(t);await f.service.refreshView('session',f.view.viewId,{kind:'agent',sessionId:'session',nativeCallId:'initial'});
 const initial=f.service.getData('session',f.view.viewId).bindings[0];
 for(const cursor of ['60','320']){
  const response=await f.call(f.identity,'readBindingPage',{bindingId:'products',cursor},true);assert.equal(response.error,undefined);
  const binding=response.result.bindings[0];assert.equal(binding.resources[0].resourceId,cursor);assert.equal(binding.resources.length,cursor==='320'?18:20);assert.equal(binding.datasetId,initial.datasetId);
  const selection={bindingId:'products',datasetRevision:binding.revision,resources:[binding.resources[0]]};
  assert.equal((await f.call(f.identity,'attachSelection',selection)).result.status,'validated');
  assert.equal((await f.call({...f.identity,frameInstanceId:'other'},'attachSelection',selection)).error.code,'SELECTION_STALE');
 }
 assert.deepEqual(f.service.getData('session',f.view.viewId).bindings[0],initial);
 assert.deepEqual(f.service.getView(f.view.viewId)!.bindings[0].input,{limit:20});
 assert.equal((await f.call(f.identity,'attachSelection',{bindingId:'products',datasetRevision:initial.revision,resources:initial.resources})).error.code,'SELECTION_STALE');
});
test('late page replies and retired scopes cannot overwrite the current page',async t=>{
 const f=setup(t),invoke=f.runtime.invoke,waiting: (()=>void)[]=[];
 f.runtime.invoke=async request=>{await new Promise<void>(resolve=>waiting.push(resolve));return invoke(request);};
 const first=f.call(f.identity,'readBindingPage',{bindingId:'products',cursor:'60'},true),second=f.call(f.identity,'readBindingPage',{bindingId:'products',cursor:'80'},true);
 waiting[1]();const latest=await second;waiting[0]();assert.equal((await first).error.code,'PAGE_SUPERSEDED');
 assert.equal((await f.call(f.identity,'getData',null)).result.bindings[0].revision,latest.result.bindings[0].revision);
 const pending=f.call(f.identity,'readBindingPage',{bindingId:'products',cursor:'100'},true);f.service.clearBindingPages(canonicalJson(f.identity));waiting[2]();assert.equal((await pending).error.code,'PAGE_SUPERSEDED');
});
test('failed page read preserves the visible page and its selection',async t=>{
 const f=setup(t),page=await f.call(f.identity,'readBindingPage',{bindingId:'products',cursor:'60'},true),binding=page.result.bindings[0];
 f.runtime.invoke=async request=>({status:'failed',invocationId:request.invocationId,traceId:request.traceId,error:{code:'OFFLINE',message:'Offline',retryPolicy:'read_retry'}});
 assert.equal((await f.call(f.identity,'readBindingPage',{bindingId:'products',cursor:'80'},true)).error.code,'OFFLINE');
 assert.equal((await f.call(f.identity,'attachSelection',{bindingId:'products',datasetRevision:binding.revision,resources:[binding.resources[0]]})).result.status,'validated');
});
