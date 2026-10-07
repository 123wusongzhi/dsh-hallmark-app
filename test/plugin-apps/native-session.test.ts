import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider,resolveNotesResources} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type AppsPluginContext,type NativePromptAssembly,type NativeAssembleContext} from '../../packages/plugin-apps/src/index.ts';
import type {BridgeRequest,ComponentAgentIntent,ComponentContextSnapshot} from '../../packages/app-contracts/src/index.ts';
import {nativeInputReceipt} from '../../packages/dsh-compat/src/native-receipt.ts';

async function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'apps-native-session-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
  runtime.register(new NotesProvider({store}));
  const presentation=new AppsPresentationService({store,runtime,sources:new SourceComponentStore(join(directory,'builds')),resources:resolveNotesResources});runtime.register(presentation.provider());
  for(const [appId,connectionId] of [['notes','n'],['apps','presentation']]){runtime.addConnection({appId,connectionId,displayName:appId,enabled:true,config:{},configRevision:1});runtime.bind({sessionId:'A',appId,connectionId,enabled:true,boundAt:new Date().toISOString()});}
  await runtime.invoke({protocolVersion:'1.0',appId:'notes',connectionId:'n',invocationId:'seed',traceId:'seed',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id:'note-a',title:'Original note',content:'Evidence'},source:{kind:'agent',sessionId:'A',nativeCallId:'seed'},deadlineAt:new Date(Date.now()+30000).toISOString(),idempotencyKey:'seed'});
  const project=join(directory,'source');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'package-lock.json'),'{}');writeFileSync(join(project,'dist','index.html'),'<button>Native context fixture</button>');
  const view=presentation.openSource('A',project,{title:'Notes context',bindings:[{bindingId:'notes',appId:'notes',connectionId:'n',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
  await presentation.refreshView('A',view.viewId,{kind:'agent',sessionId:'A',nativeCallId:'initial-read'});
  const server=createAppsServer({runtime,presentation,token:'x'.repeat(64)});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const transport=new HttpAppsHostTransport(`http://127.0.0.1:${(server.address() as {port:number}).port}`,'x'.repeat(64));
  const A={id:'A',session:{id:'A'}},B={id:'B',session:{id:'B'}},agents=new Map([['A',A],['B',B]]),events=new Map<string,unknown[]>([['A',[]],['B',[]]]);
  const metrics={prompts:0,flushes:0,inspects:0,modelRequests:0},controls:{durable:boolean;throwAfterAppend:boolean;beforeAppend?:()=>Promise<void>}={durable:true,throwAfterAppend:false};
  const hooks=new Map<string,unknown>(),tools=new Set<string>();
  const ctx:AppsPluginContext={tools:{register:tool=>{tools.add(tool.name);return()=>{tools.delete(tool.name);};}},agents:{get:id=>agents.get(id)},systemPrompt:{context:()=>()=>{}},sessions:{get:id=>agents.get(id)?.session,flush:async session=>{assert.equal(session,agents.get(session.id)?.session);metrics.flushes++;return controls.durable;}},on:(event,listener)=>{hooks.set(event,listener);return()=>{hooks.delete(event);};},sessionController:{
    async resolveAgent(id){const agent=agents.get(id);return agent?{agent}:{error:'session/not-found'};},
    async prompt(request,signal){signal.throwIfAborted();metrics.prompts++;await controls.beforeAppend?.();assert.equal(request.mode,'queue');events.get(request.sessionId)!.push({type:'agent/inbox/spliced',seq:events.get(request.sessionId)!.length,time:Date.now(),data:{target:'next-turn',inserted:[{id:`message-${request.requestId}`,source:{kind:'user',rpcId:request.requestId},content:request.content}]}});if(controls.throwAfterAppend)throw new Error('fixture lost admission response');return {accepted:true};},
    async inspect(id,signal){signal?.throwIfAborted();metrics.inspects++;return {events:events.get(id)??[]};},
  }};
  let host=new AppsHost(ctx,transport,undefined,{nativeSessionAdapter:'dsh-0.2.0-rc.2'});await host.start();
  const identity={channel:'dsh.apps.component.v2',protocolVersion:'2.0' as const,sessionId:'A',viewId:view.viewId,buildId:view.source!.buildId,frameInstanceId:'frame-A'};
  async function bridge(method:BridgeRequest['method'],params:unknown,requestId:string,signal?:AbortSignal) {const response=await host.ui(new Request('http://native.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'componentBridge',request:{...identity,method,params,requestId}}),signal}));return await response.json() as {result?:ComponentAgentIntent|{snapshot:ComponentContextSnapshot};error?:{code:string}};}
  async function assemble(agent:typeof A=A,signal=new AbortController().signal) {const hook=hooks.get('system-prompt/assemble') as (assembly:NativePromptAssembly,context:NativeAssembleContext,next:()=>Promise<NativePromptAssembly>)=>Promise<NativePromptAssembly>;const original={contexts:[{name:'other',text:'keep'}],tools:[]};return hook(original,{scope:agent,signal},async()=>original);}
  async function restart(){await host.dispose();host=new AppsHost(ctx,transport,undefined,{nativeSessionAdapter:'dsh-0.2.0-rc.2'});await host.start();}
  async function close(){await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();const target=resolve(directory);assert.match(target,/apps-native-session-[^\\/]+$/);rmSync(target,{recursive:true,force:true});}
  return {ctx,A,B,agents,events,metrics,controls,hooks,tools,transport,presentation,store,runtime,view,identity,bridge,assemble,restart,close,get host(){return host;}};
}

test('verified native async assembly fetches immutable per-session context on every step and restart, failing closed on stale/unavailable reads',async()=>{
  const f=await fixture();try {
    assert.deepEqual(f.host.hostCapabilities(),{updateContext:true,requestAgent:true,nativeSessionAdapter:'dsh-0.2.0-rc.2',adapterReady:true,hostVersion:'0.2.0-rc.2'});
    assert.equal((await f.assemble()).contexts.length,1);
    const data=f.presentation.getData('A',f.view.viewId),selection={bindingId:'notes',datasetRevision:data.bindings[0].revision,resources:data.bindings[0].resources};
    const update=await f.bridge('updateContext',{expectedContextRevision:0,selections:[selection],summary:'explicit one'},'context-one');assert.ok(update.result);assert.equal(f.metrics.prompts,0);
    const assembled=await f.assemble(),text=assembled.contexts.find(item=>item.name==='dsh-apps-component-context')!.text,one=JSON.parse(text);assert.equal(one.snapshot.summary,'explicit one');assert.equal(one.snapshot.contextRevision,1);assert.equal(one.snapshot.bindingEvidence[0].datasetRevision,selection.datasetRevision);assert.ok(Buffer.byteLength(text)<=8192);
    assert.equal((await f.assemble(f.B)).contexts.length,1);
    const fetch=f.transport.componentContexts.bind(f.transport);let reads=0;f.transport.componentContexts=async(...args)=>{reads++;return fetch(...args);};
    const hook=f.hooks.get('system-prompt/assemble') as (assembly:NativePromptAssembly,context:NativeAssembleContext,next:()=>Promise<NativePromptAssembly>)=>Promise<NativePromptAssembly>,original={contexts:[]};assert.deepEqual(await hook(original,{scope:{id:'A'}},async()=>original),original);assert.equal(reads,0);
    await f.bridge('updateContext',{expectedContextRevision:1,selections:[selection],summary:'explicit two'},'context-two');const two=JSON.parse((await f.assemble()).contexts[1].text);assert.equal(two.snapshot.contextRevision,2);assert.equal(one.snapshot.summary,'explicit one');assert.equal(f.presentation.contexts.history('A',one.snapshot.snapshotId)!.snapshot.summary,'explicit one');
    await f.restart();assert.equal(JSON.parse((await f.assemble()).contexts[1].text).snapshot.snapshotId,two.snapshot.snapshotId);assert.ok(reads>=2);
    f.transport.componentContexts=async()=>{throw new Error('fixture read lost');};await assert.rejects(f.assemble(),/fixture read lost/);
    f.transport.componentContexts=async()=>({sessionId:'B',snapshot:null});await assert.rejects(f.assemble(),/CONTEXT_NOT_OWNED/);
    f.transport.componentContexts=async()=>({sessionId:'A',snapshot:{...two.snapshot,summary:'x'.repeat(9000)}});await assert.rejects(f.assemble(),/CONTEXT_BUDGET_EXCEEDED/);assert.equal(f.metrics.modelRequests,0);
  }finally{await f.close();}
});

test('native request is claimed once, queued with exact text, flushed and inspected before accepted; same input survives lost HTTP receipt and Host restart',async()=>{
  const f=await fixture();try {
    const input={text:'Explicit user action',expectedContextRevision:0};const first=await f.bridge('requestAgent',input,'request-one');const intent=first.result as ComponentAgentIntent;assert.equal(intent.status,'accepted');assert.equal((intent.receipt as {durable:boolean}).durable,true);assert.equal((intent.receipt as {eventSeq:number}).eventSeq,0);assert.equal(f.metrics.prompts,1);assert.equal(f.metrics.flushes,1);assert.equal(f.metrics.inspects,1);
    assert.equal((await f.bridge('requestAgent',input,'request-one')).result&&f.metrics.prompts,1);
    const conflict=await f.bridge('requestAgent',{...input,text:'Changed'},'request-one');assert.equal(conflict.error?.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.metrics.prompts,1);
    const receipt=f.transport.agentReceipt.bind(f.transport);f.transport.agentReceipt=async(...args)=>{await receipt(...args);throw new Error('lost receipt response');};
    const lost=await f.bridge('requestAgent',input,'request-two');assert.equal((lost.result as ComponentAgentIntent).status,'unknown');assert.equal((await f.transport.agentIntent('A','request-two')).status,'accepted');assert.equal(f.metrics.prompts,2);
    f.transport.agentReceipt=receipt;await f.restart();assert.equal((await f.bridge('requestAgent',input,'request-two')).result&&(await f.transport.agentIntent('A','request-two')).status,'accepted');assert.equal(f.metrics.prompts,2);assert.equal(f.metrics.modelRequests,0);
  }finally{await f.close();}
});

test('lost native acknowledgement and uncertain durability inspect the original rpcId without resubmission',async()=>{
  const f=await fixture();try {
    const input={text:'Durability action',expectedContextRevision:0};f.controls.throwAfterAppend=true;
    assert.equal(((await f.bridge('requestAgent',input,'ack-lost')).result as ComponentAgentIntent).status,'accepted');assert.equal(f.metrics.prompts,1);
    f.controls.throwAfterAppend=false;f.controls.durable=false;
    const unknown=await f.bridge('requestAgent',input,'flush-failed');assert.equal((unknown.result as ComponentAgentIntent).status,'unknown');assert.equal(f.metrics.prompts,2);
    assert.equal(((await f.bridge('requestAgent',input,'flush-failed')).result as ComponentAgentIntent).status,'unknown');assert.equal(f.metrics.prompts,2);
    f.controls.durable=true;await f.restart();const inspected=await f.host.ui(new Request('http://native.invalid/api/dsh-apps?resource=agentRequest&sessionId=A&requestId=flush-failed'));assert.equal((await inspected.json() as ComponentAgentIntent).status,'accepted');assert.equal(f.metrics.prompts,2);assert.equal((await f.host.ui(new Request('http://native.invalid/api/dsh-apps?resource=agentRequest&sessionId=B&requestId=flush-failed'))).status,404);
    let release!:()=>void;f.controls.beforeAppend=()=>new Promise<void>(done=>{release=done;});const waiting=f.bridge('requestAgent',input,'concurrent');while(!release)await new Promise(done=>setTimeout(done,1));
    const second=await f.bridge('requestAgent',input,'concurrent');assert.equal((second.result as ComponentAgentIntent).status,'unknown');assert.equal(f.metrics.prompts,3);release();assert.equal(((await waiting).result as ComponentAgentIntent).status,'accepted');assert.equal(f.metrics.prompts,3);
  }finally{await f.close();}
});

test('default, missing services, and pre-dispatch cancellation never advertise or submit optional native actions',async()=>{
  const f=await fixture();try {
    const disabled=new AppsHost(f.ctx,f.transport);await disabled.start();assert.equal(disabled.hostCapabilities().requestAgent,false);assert.equal(disabled.hostCapabilities().updateContext,false);await disabled.dispose();
    const missing=new AppsHost({...f.ctx,sessionController:undefined},f.transport,undefined,{nativeSessionAdapter:'dsh-0.2.0-rc.2'});await missing.start();assert.equal(missing.hostCapabilities().requestAgent,false);await missing.dispose();
    await f.restart();const signal=AbortSignal.abort();await f.bridge('requestAgent',{text:'cancelled',expectedContextRevision:0},'cancelled',signal);assert.equal(f.metrics.prompts,0);assert.equal(f.presentation.contexts.intent('A','cancelled'),undefined);
    const bridge={...f.identity,method:'requestAgent',params:{text:'disabled',expectedContextRevision:0},requestId:'disabled'};
    const response=await disabled.ui(new Request('http://native.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'componentBridge',request:bridge})}));assert.equal((await response.json() as {error:{code:string}}).error.code,'APPS_HOST_CLOSED');assert.equal(f.metrics.prompts,0);
  }finally{await f.close();}
});

test('native event receipt accepts only the exact rpcId/content hash and formal queued or consumed event shapes',()=>{
  const event={type:'user/message',seq:4,time:1,data:{source:{kind:'user',rpcId:'r'},content:[{type:'text',text:'Original'}]}};
  assert.equal(nativeInputReceipt([event],'A','r','Original')!.eventType,'user/message');assert.equal(nativeInputReceipt([event],'A','other','Original'),undefined);assert.throws(()=>nativeInputReceipt([event],'A','r','Changed'),/NATIVE_REQUEST_CONTENT_CONFLICT/);
  assert.equal(nativeInputReceipt([{...event,type:'agent/inbox/spliced'}],'A','r','Original'),undefined);
});

test('request pins its immutable snapshot in actual native content while later explicit context updates remain independent',async()=>{
  const f=await fixture();try {
    const binding=f.presentation.getData('A',f.view.viewId).bindings[0],selection={bindingId:'notes',datasetRevision:binding.revision,resources:binding.resources};
    const published=await f.bridge('updateContext',{expectedContextRevision:0,selections:[selection],summary:'pinned original'},'pin-context');
    let release!:()=>void;f.controls.beforeAppend=()=>new Promise<void>(done=>{release=done;});const request=f.bridge('requestAgent',{text:'Use the published original',expectedContextRevision:1},'pin-request');while(!release)await new Promise(done=>setTimeout(done,1));
    const original=f.presentation.contexts.intent('A','pin-request')!;assert.equal(original.contextSnapshotId,(published.result as {snapshot:ComponentContextSnapshot}).snapshot.snapshotId);
    await f.bridge('updateContext',{expectedContextRevision:1,selections:[selection],summary:'new latest'},'pin-context-two');release();const receipt=(await request).result as ComponentAgentIntent;assert.equal(receipt.status,'accepted');
    const recorded=f.events.get('A')![0] as {data:{inserted:{content:{type:'text';text:string}[]}[]}};assert.deepEqual(recorded.data.inserted[0].content,original.content);assert.equal(JSON.parse(recorded.data.inserted[0].content[1].text).snapshot.summary,'pinned original');assert.equal(JSON.parse((await f.assemble()).contexts[1].text).snapshot.summary,'new latest');assert.equal((receipt.receipt as {contentHash:string}).contentHash,original.contentHash);assert.equal(f.metrics.prompts,1);
  }finally{await f.close();}
});

test('aggregate Apps input, context, summary and gateway budget rejects before native dispatch without truncation',async()=>{
  const f=await fixture();try {
    for(let index=0;index<19;index++){const id=`note-${index}-`+'r'.repeat(110);assert.equal((await f.runtime.invoke({protocolVersion:'1.0',appId:'notes',connectionId:'n',invocationId:`budget-${index}`,traceId:`budget-${index}`,capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id,title:'Budget note',content:'fixture'},source:{kind:'agent',sessionId:'A',nativeCallId:`budget-${index}`},deadlineAt:new Date(Date.now()+30000).toISOString(),idempotencyKey:`budget-${index}`})).status,'ok');}
    await f.presentation.refreshView('A',f.view.viewId,{kind:'agent',sessionId:'A',nativeCallId:'budget-read'});const binding=f.presentation.getData('A',f.view.viewId).bindings[0];
    const published=await f.bridge('updateContext',{expectedContextRevision:0,selections:[{bindingId:'notes',datasetRevision:binding.revision,resources:binding.resources}],summary:'s'.repeat(2048)},'budget-context');assert.ok(published.result);
    const response=await f.bridge('requestAgent',{text:'t'.repeat(4096),expectedContextRevision:1},'budget-request');assert.equal(response.error?.code,'APPS_CONTEXT_BUDGET_EXCEEDED');assert.equal(f.presentation.contexts.intent('A','budget-request')!.status,'prepared');assert.equal(f.metrics.prompts,0);assert.equal(f.metrics.modelRequests,0);
  }finally{await f.close();}
});

test('exact Cordis optional service lookup uses get without accessing an undeclared direct property',async()=>{
  const f=await fixture();let host:AppsHost|undefined;try {
    const controller=f.ctx.sessionController!,sessions=f.ctx.sessions!;await f.host.dispose();let reads=0;
    const cordis=Object.create(f.ctx) as AppsPluginContext;for(const name of ['sessionController','sessions'])Object.defineProperty(cordis,name,{get(){throw new Error('Cordis undeclared direct property');}});cordis.get=name=>{reads++;return name==='sessionController'?controller:sessions;};
    host=new AppsHost(cordis,f.transport,undefined,{nativeSessionAdapter:'dsh-0.2.0-rc.2'});await host.start();assert.ok(reads>=2);assert.equal(host.hostCapabilities().adapterReady,true);assert.equal(f.tools.size,4);assert.equal(f.metrics.prompts,0);
  }finally{await host?.dispose();await f.close();}
});

test('strict ACTIVE service publication activates the adapter once, invalidation blocks stale consumption, and reads re-resolve a missed notification',async()=>{
  const f=await fixture();let host:AppsHost|undefined;try {
    const controller=f.ctx.sessionController!,sessions=f.ctx.sessions!;await f.host.dispose();let active=false,assemblyRegistrations=0;
    const cordis=Object.create(f.ctx) as AppsPluginContext;cordis.get=name=>active?(name==='sessions'?sessions:controller):undefined;
    cordis.on=((event:string,listener:unknown)=>{if(event==='system-prompt/assemble')assemblyRegistrations++;f.hooks.set(event,listener);return()=>{f.hooks.delete(event);};}) as AppsPluginContext['on'];
    host=new AppsHost(cordis,f.transport,undefined,{nativeSessionAdapter:'dsh-0.2.0-rc.2'});await host.start();assert.equal(host.hostCapabilities().adapterReady,false);assert.equal(f.hooks.has('system-prompt/assemble'),false);assert.equal(f.tools.size,4);
    active=true;const notify=f.hooks.get('internal/service') as(name:string,value:unknown)=>void;notify('sessions',sessions);assert.equal(host.hostCapabilities().adapterReady,true);assert.equal(assemblyRegistrations,1);notify('sessionController',controller);assert.equal(assemblyRegistrations,1);
    const hook=f.hooks.get('system-prompt/assemble') as(assembly:NativePromptAssembly,context:NativeAssembleContext,next:()=>Promise<NativePromptAssembly>)=>Promise<NativePromptAssembly>,original={contexts:[]};assert.deepEqual(await hook(original,{scope:f.A},async()=>original),original);
    active=false;notify('sessions',undefined);assert.equal(host.hostCapabilities().adapterReady,false);await assert.rejects(hook(original,{scope:f.A},async()=>original),/NATIVE_ADAPTER_NOT_READY/);
    active=true;assert.equal(host.hostCapabilities().adapterReady,true);assert.equal(assemblyRegistrations,1);assert.deepEqual(await hook(original,{scope:f.A},async()=>original),original);assert.equal(f.metrics.prompts,0);await host.dispose();assert.equal(f.hooks.size,0);assert.equal(host.hostCapabilities().adapterReady,false);
  }finally{await host?.dispose();await f.close();}
});
