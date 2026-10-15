import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore,type RuntimeOperation,type InvocationRecord} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,ExecutionContext} from '../../packages/app-contracts/src/index.ts';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
async function bounded<T>(work:Promise<T>,label:string):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} did not settle within 5000 ms`)),5000);})]);}
  finally{clearTimeout(timer);}
}

test('a late pending inspection delivers the already settled evidence through HTTP and Host rendering',async()=>{
  // Entire provider payload is a non-business protocol control; no merchant operation or source facts are invented.
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>(),agent={id:'inspection-control'};
  const started=deferred(),release=deferred(),token='inspection-race-control-token-'.repeat(2);let executes=0,inspections=0,serial=0,slow:Promise<any>|undefined;
  const descriptor:CapabilityDescriptor={capabilityId:'inspectionfixture.operation.start',version:'1.0.0',title:'Inspection control',description:'Non-business asynchronous result control',effect:'mutation',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{mode:'async',timeoutMs:3000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'upstream_operation'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const pending=(context:ExecutionContext):CapabilityResult=>({invocationId:context.request.invocationId,traceId:context.request.traceId,status:'pending',operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:1000});
  runtime.register({manifest:{manifestVersion:1,appId:'inspectionfixture',displayName:'Inspection control',providerPackage:'test-control',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],async execute(context){executes++;return pending(context);},async inspect(_id,context){if(++inspections===1){started.resolve();await release.promise;return pending(context);}return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'ok',data:{value:'settled-control-evidence'}};},async dispose(){}});
  runtime.addConnection({appId:'inspectionfixture',connectionId:'local',displayName:'Local control',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'inspectionfixture',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`,transport=new HttpAppsHostTransport(base,token,(url,options)=>{assert.equal(new URL(String(url)).origin,base);return fetch(url,options);});
  const requests=new AbortController();
  const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
  try{
    await host.start();host.attachApp('inspectionfixture');
    const call=async(name:string,args:any)=>{const tool=tools.get(name)!,raw:any=await bounded(tool.execute(args,{agent,signal:requests.signal,callId:`inspection-${++serial}`}),`${name} response`);return {raw:raw.result??raw,model:JSON.parse(tool.output.render(args,raw)[0].text)};};
    const submitted=await call('apps_invoke',{appId:'inspectionfixture',connectionId:'local',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{},idempotencyKey:'inspection-control-intent'});assert.equal(submitted.model.status,'pending',JSON.stringify(submitted.model));const operationId=submitted.model.operation.operationId;
    slow=call('apps_inspect',{operationId});
    await bounded(Promise.race([started.promise,slow.then(()=>assert.fail('First inspection completed before provider.inspect was entered'))]),'provider.inspect entry');
    const fast=await call('apps_inspect',{operationId});assert.equal(fast.model.status,'ok');assert.deepEqual(fast.model.data,{value:'settled-control-evidence'});assert.equal(store.get<RuntimeOperation>('operations',operationId)?.state,'succeeded');
    release.resolve();const late=await slow;
    assert.equal(late.model.status,'ok','a late inspection must return the latest durable terminal evidence, not its entry snapshot');
    assert.deepEqual(late.model.data,fast.model.data);assert.deepEqual(late.model.operation,{operationId,state:'succeeded'});assert.notEqual(late.raw.invocationId,fast.raw.invocationId);
    const durable=store.get<RuntimeOperation>('operations',operationId)!;assert.equal(durable.state,'succeeded');assert.equal(durable.result?.status,'ok');assert.deepEqual((durable.result as any).data,fast.model.data);
    for(const answer of [fast,late]){const persisted=store.get<InvocationRecord>('invocations',answer.raw.invocationId)!;assert.equal(persisted.result?.status,'ok');assert.equal(persisted.operationId,operationId);assert.equal(persisted.result?.operation?.state,durable.state);assert.deepEqual((persisted.result as any).data,answer.model.data);assert.equal(answer.model.operation.state,durable.state);}
    const reread=await call('apps_inspect',{operationId});assert.deepEqual(reread.model.data,fast.model.data);assert.equal(reread.model.status,'ok');
    assert.equal(executes,1,'inspection never repeats the original operation');assert.equal(inspections,2,'terminal reread does not inspect the provider again');assert.equal(store.list('operations').length,1);
  }finally{release.resolve();requests.abort();if(slow)await Promise.allSettled([slow]);await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}
});
