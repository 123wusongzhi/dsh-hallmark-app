import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {AppProvider,CapabilityDescriptor} from '../../packages/app-contracts/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsClient} from '../../packages/app-sdk/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {AppsHost} from '../../packages/plugin-apps/src/index.ts';
import type {AppsHostTransport,NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/client.ts';
import {ScriptRun} from '../../packages/app-runtime/src/runs.ts';

test('audit REQ-018/024: unavailable mutation response after dispatch retains unknown instead of definitive failure',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
  const descriptor:CapabilityDescriptor={capabilityId:'audit.mutate',version:'1.0.0',title:'Synthetic mutation',description:'Audit fixture for lost completion evidence',effect:'mutation',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',additionalProperties:true},execution:{mode:'sync',timeoutMs:5000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'readback'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  let dispatches=0;
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'audit',displayName:'Audit fixture',providerPackage:'audit-fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['record']},descriptors:[descriptor],async execute(context){dispatches++;return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'unavailable',error:{code:'RESPONSE_LOST',message:'Backend may have received the mutation.',retryPolicy:'read_retry'}};},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'audit',connectionId:'C1',displayName:'C1',enabled:true,config:{},configRevision:1});runtime.bind({sessionId:'A',appId:'audit',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  try {
    const result=await runtime.invoke({protocolVersion:'1.0',appId:'audit',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{},invocationId:randomUUID(),traceId:randomUUID(),source:{kind:'agent',sessionId:'A',nativeCallId:'fixture'},deadlineAt:new Date(Date.now()+5000).toISOString(),idempotencyKey:'same-intent'});
    assert.equal(dispatches,1);assert.equal(result.status,'unknown');assert.equal(result.operation?.state,'unknown');assert.equal('error' in result&&result.error.retryPolicy,'inspect_only');
    assert.equal(store.list<{state:string}>('operations')[0].state,'unknown');
  }finally{await runtime.dispose();store.close();}
});

test('audit REQ-019: cancelled script retains completed write and stops before adding another child invocation',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),notes=new NotesProvider({store});let calls=0;const original=notes.execute.bind(notes);notes.execute=async context=>{calls++;return original(context);};runtime.register(notes);runtime.addConnection({appId:'notes',connectionId:'N1',displayName:'N1',config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:'A',appId:'notes',connectionId:'N1',enabled:true,boundAt:new Date().toISOString()});
  const cancellation=new AbortController(),run=new ScriptRun(runtime,'A',{signal:cancellation.signal});
  try{const result=await run.execute(async current=>{const first=await current.call('first',{appId:'notes',connectionId:'N1'},'notes.notes.create',{id:'first',title:'Completed',content:'Keep'},{idempotencyKey:'first'});assert.equal(first.status,'ok');cancellation.abort();await current.call('second',{appId:'notes',connectionId:'N1'},'notes.notes.create',{id:'second',title:'Must not dispatch',content:'Stop'},{idempotencyKey:'second'});});assert.equal(result.run.state,'partial');assert.equal(result.run.error,'RUN_CANCELLED');assert.equal(calls,1);assert.equal(store.list('invocations').length,1);assert.equal(store.list('operations').length,1);assert.equal(result.steps.length,1);assert.equal(result.steps[0].result?.status,'ok');}
  finally{await runtime.dispose();store.close();}
});

test('audit REQ-004: same Notes read through native gateway, SDK and component dispatches once per entry with identical errors',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),provider=new NotesProvider({store});let calls=0;const original=provider.execute.bind(provider);provider.execute=async context=>{calls++;return original(context);};runtime.register(provider);runtime.addConnection({appId:'notes',connectionId:'N1',displayName:'N1',enabled:true,config:{backend:'fixture'},configRevision:1});runtime.bind({sessionId:'A',appId:'notes',connectionId:'N1',enabled:true,boundAt:new Date().toISOString()});
  const transport:AppsHostTransport={async identity(){return runtime.identity();},async listApps(){return runtime.listApps();},async describe(id,version){return runtime.describe(id,version);},async discover(options){return runtime.discover(options);},async listConnections(appId){return runtime.listConnections(appId);},async sessionBindings(sessionId){return runtime.sessionBindings(sessionId);},async bind(binding){return runtime.bind(binding);},async invoke(request,signal){return runtime.invoke(request,signal);},async inspect(id,signal){return runtime.inspect(id,signal);},async projectModelResult(id){return projectModelResult(store,store.get<any>('invocations',id).result);},async legacyInvoke(){throw new Error('unused');}};
  const agent={id:'A'},tools=new Map<string,NativeGatewayTool>(),host=new AppsHost({agents:{get:id=>id==='A'?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}}},transport),sdk=new AppsClient(transport,{kind:'script',sessionId:'A',runId:'audit-run',stepKey:'audit'}),presentation=new AppsPresentationService({store,runtime});
  await host.start();host.attachApp('notes');
  const create=runtime.describe('notes.notes.create')!;await sdk.invoke({appId:'notes',connectionId:'N1'},create,{id:'n',title:'Same record',content:'Same result'},{idempotencyKey:'seed'});calls=0;
  const view=presentation.createView('A',{title:'Audit',bindings:[{bindingId:'note',appId:'notes',connectionId:'N1',capabilityId:'notes.notes.get',capabilityMajor:1,input:{id:'n'},projection:[],refresh:{mode:'manual'}}]}),identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:view.viewId,buildId:'audit',frameInstanceId:'frame'},component=presentation.createHost(identity),descriptor=runtime.describe('notes.notes.get')!,tool=tools.get('apps_invoke')!;
  try{
    for(const id of ['n','missing']){
      const input={id},native=await tool.execute({appId:'notes',connectionId:'N1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input},{agent,signal:new AbortController().signal}) as {result:any},script=await sdk.invoke({appId:'notes',connectionId:'N1'},descriptor,input),reply=await component.handle({...identity,channel:COMPONENT_CHANNEL,requestId:randomUUID(),method:'invokeCapability',params:{appId:'notes',connectionId:'N1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input,deadlineAt:new Date(Date.now()+5000).toISOString()}}) as {result:any};
      const results=[native.result,script,reply.result];assert.ok(results.every(result=>result.status===(id==='n'?'ok':'failed')));if(id==='n')assert.deepEqual(results.map(result=>result.data),[results[1].data,results[1].data,results[1].data]);else assert.ok(results.every(result=>result.error.code==='RESOURCE_NOT_FOUND'&&result.error.retryPolicy==='never'));
    }
    assert.equal(calls,6);const records=store.list<any>('invocations').filter(row=>row.request.capabilityId===descriptor.capabilityId);assert.equal(records.length,6);assert.deepEqual(records.map(row=>row.request.source.kind).sort(),['agent','agent','component','component','script','script']);
  }finally{await host.dispose();await runtime.dispose();store.close();}
});
