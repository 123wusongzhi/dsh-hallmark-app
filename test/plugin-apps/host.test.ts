import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime, RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost, HttpAppsHostTransport, type AppsHostTransport, type AppsPluginContext, type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {createAppsBundle} from '../../bundles/apps/server/index.ts';
import type {PluginContext, NativeTool} from '../../packages/dsh-plugin/server/types.ts';
import type {AppProvider, CapabilityDescriptor, ExecutionContext, CapabilityResult, SessionAppBinding} from '../../packages/app-contracts/src/index.ts';
function provider(appId: string, calls: ExecutionContext[], count = 1, large = false): AppProvider {
  const descriptors: CapabilityDescriptor[] = Array.from({length: count},(_,index) => ({capabilityId: `${appId}.read${index}`, version: '1.0.0',title: `${appId} query ${index}`,description: 'Synthetic read query',effect:'query',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'array',items:{type:'object',additionalProperties:true}},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:index===0,keywords:[appId]},aliases:appId==='hallmark'&&index===0?['hallmark_list_stores']:[]}));
  return {manifest:{manifestVersion:1,appId,displayName:appId,providerPackage:`app-${appId}`,providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['record']},descriptors,async execute(context){calls.push(context);return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'ok',data:large?Array.from({length:3000},(_,id)=>({id,value:'x'.repeat(100)})):[{id:context.request.connectionId}]};},async dispose(){}};
}
function context() {
  const A={id:'A'},B={id:'B'},agents=new Map([['A',A],['B',B]]),tools=new Map<string,NativeGatewayTool|NativeTool>(),routes=new Map<string,unknown>(),commands=new Map<string,unknown>(),prompts=new Map<string,unknown>(),listeners=new Map<string,unknown>();
  const ctx={tools:{register(tool:NativeGatewayTool|NativeTool){assert.equal(tools.has(tool.name),false,`duplicate ${tool.name}`);tools.set(tool.name,tool);return ()=>{tools.delete(tool.name);};}},agents:{get:(id:string)=>agents.get(id),list:()=>[A,B]},sessions:{get:(id:string)=>agents.get(id)},connection:{fetch:{register(route:{path:string}){assert.equal(routes.has(route.path),false);routes.set(route.path,route);return async()=>{routes.delete(route.path);};}}},commands:{register(command:{name:string}){commands.set(command.name,command);return()=>{commands.delete(command.name);};}},systemPrompt:{context(prompt:{name:string}){prompts.set(prompt.name,prompt);return()=>{prompts.delete(prompt.name);};}},on(event:string,listener:unknown){listeners.set(event,listener);return()=>{listeners.delete(event);};}} as unknown as PluginContext & AppsPluginContext;
  return {ctx,A,B,tools,routes,commands,prompts,listeners};
}
function inProcessTransport(runtime: AppsRuntime): AppsHostTransport {
  return {async identity(){return runtime.identity();},async listApps(){return runtime.listApps();},async discover(options){return runtime.discover(options);},async describe(id,version){return runtime.describe(id,version);},async listConnections(appId){return runtime.listConnections(appId);},async sessionBindings(sessionId){return runtime.sessionBindings(sessionId);},async bind(binding){return runtime.bind(binding);},async invoke(request,signal){return runtime.invoke(request,signal);},async inspect(id,signal){return runtime.inspect(id,signal);},async projectModelResult(id){const record=runtime.store.get<{result:CapabilityResult}>('invocations',id);if(!record)throw new Error('missing');return projectModelResult(runtime.store,record.result);},async legacyInvoke(){throw new Error('unused');}};
}
function connection(runtime: AppsRuntime,appId: string,connectionId: string,sessionId: string) {runtime.addConnection({appId,connectionId,displayName:connectionId,enabled:true,config:{},configRevision:1});runtime.bind({appId,connectionId,sessionId,enabled:true,boundAt:new Date().toISOString()});}

test('one fixed gateway, 1000 schema catalogue stays outside default tools and connection ambiguity dispatches nothing',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('hallmark',calls,1000));runtime.register(provider('notes',calls));connection(runtime,'hallmark','H1','A');connection(runtime,'hallmark','H2','A');connection(runtime,'notes','N1','B');
  const f=context(),host=new AppsHost(f.ctx,inProcessTransport(runtime));await host.start();const removeH=host.attachApp('hallmark'),removeN=host.attachApp('notes');
  try {
    assert.equal(f.tools.size,4);assert.equal([...f.tools.values()].some(tool=>tool.name.startsWith('hallmark_')),false);
    assert.ok(Buffer.byteLength(JSON.stringify([...f.tools.values()].map(tool=>({name:tool.name,parameters:tool.parameters}))))<5000);
    const base={appId:'hallmark',capabilityId:'hallmark.read0',capabilityVersion:'1.0.0',input:{}};
    const ambiguous=await host.call('apps_invoke',base,'A') as CapabilityResult;assert.equal(ambiguous.status,'needs_clarification');assert.equal(calls.length,0);
    const native=f.tools.get('apps_invoke') as NativeGatewayTool,nativeAmbiguous=await native.execute(base,{agent:f.A,signal:new AbortController().signal});assert.match(native.output.render(base,nativeAmbiguous)[0].text,/needs_clarification/);assert.equal(calls.length,0);
    const explicit=await host.call('apps_invoke',{...base,connectionId:'H1'},'A') as CapabilityResult;assert.equal(explicit.status,'ok');assert.equal(calls.length,1);assert.equal(calls[0].request.connectionId,'H1');
    const isolated=await host.call('apps_invoke',{...base,connectionId:'H1'},'B') as CapabilityResult;assert.equal(isolated.status,'needs_clarification');assert.equal(calls.length,1);
    assert.equal((await host.call('apps_invoke',{appId:'notes',connectionId:'N1',capabilityId:'notes.read0',capabilityVersion:'1.0.0',input:{}},'B') as CapabilityResult).status,'ok');
    const rows=(await host.directory()).apps;assert.equal(rows.length,2);assert.ok(rows.every(row=>row.hostProjectionState==='attached'));
    removeH();assert.equal((await host.directory()).apps.find(row=>row.appId==='hallmark')?.hostProjectionState,'detached');assert.equal(runtime.listApps().find(row=>row.appId==='hallmark')?.providerState,'ready');
    assert.equal((await host.call('apps_invoke',{...base,connectionId:'H1'},'A') as CapabilityResult).status,'failed');assert.equal(calls.length,2);
    const oldDigest=runtime.catalogDigest;runtime.register(provider('third',calls));assert.notEqual(runtime.catalogDigest,oldDigest);await host.directory();const detachThird=host.attachApp('third');assert.equal((await host.call('apps_describe',{capabilityId:'third.read0',version:'1.0.0'},'A') as {status:string}).status,'ok');assert.equal(f.tools.size,4);detachThird();
  } finally {removeN();await host.dispose();assert.equal(f.tools.size,0);assert.equal(f.routes.size,0);await runtime.dispose();store.close();}
});

test('unverified session features do not bind, dispatch or claim agent submission',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('notes',calls));const f=context(),host=new AppsHost(f.ctx,inProcessTransport(runtime));await host.start();host.attachApp('notes');
  try {for(const method of ['requestAgent','updateContext'] as const){const response=await host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:method,sessionId:'A',params:{text:'synthetic'}})}));const result=await response.json() as {error:{code:string}};assert.equal(result.error.code,'UNSUPPORTED_HOST_CAPABILITY');}assert.equal(calls.length,0);assert.equal(runtime.sessionBindings('A').length,0);}
  finally{await host.dispose();await runtime.dispose();store.close();}
});

test('actual AssembleContext scope supplies the Apps summary only for the identical trusted Agent',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('notes',calls));const f=context(),host=new AppsHost(f.ctx,inProcessTransport(runtime));await host.start();
  try {
    const prompt=f.prompts.get('dsh-apps-summary') as {text(context:{agent?:{id:string};scope?:object;signal?:AbortSignal}):string};
    assert.ok(prompt);const signal=new AbortController().signal;
    const assembled=prompt.text({scope:f.A,signal});assert.match(assembled,/固定发现网关/);assert.match(assembled,/"appId":"notes"/);
    assert.equal(prompt.text({scope:{id:'A'},signal}),'');assert.equal(prompt.text({agent:f.A,scope:f.B,signal}),'');assert.equal(prompt.text({signal}),'');
    assert.equal(prompt.text({agent:f.A,signal}),assembled);assert.equal(calls.length,0);
    assert.equal(host.requestAgent()?.status,'failed');assert.equal(host.updateContext()?.status,'failed');
  } finally {await host.dispose();assert.equal(f.prompts.size,0);await runtime.dispose();store.close();}
});

test('native gateway rendering uses a Runtime spill projection and fails closed when projection fails',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('hallmark',calls,1,true));connection(runtime,'hallmark','H1','A');const f=context(),transport=inProcessTransport(runtime),host=new AppsHost(f.ctx,transport);await host.start();host.attachApp('hallmark');
  try {const tool=f.tools.get('apps_invoke') as NativeGatewayTool,args={appId:'hallmark',connectionId:'H1',capabilityId:'hallmark.read0',capabilityVersion:'1.0.0',input:{}};
    const value=await tool.execute(args,{agent:f.A,signal:new AbortController().signal});const text=tool.output.render(args,value)[0].text;assert.ok(Buffer.byteLength(text)<=16384);assert.match(text,/fullResultRef/);assert.equal((value as {result:CapabilityResult}).result.status,'ok');
    transport.projectModelResult=async()=>{throw new Error('fixture spill failed');};const failed=await tool.execute(args,{agent:f.A,signal:new AbortController().signal});const failure=tool.output.render(args,failed)[0].text;assert.match(failure,/RESULT_SPILL_FAILED/);assert.ok(Buffer.byteLength(failure)<512);assert.equal(calls.length,2);
  }finally{await host.dispose();await runtime.dispose();store.close();}
});

test('combined Host registers old 26 names once and their HTTP compatibility dispatch uses the Runtime ledger',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-host-bundle-')),store=new RuntimeStore(join(directory,'apps.db')),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];
  runtime.register(provider('hallmark',calls));runtime.register(provider('notes',calls));const presentation=new AppsPresentationService({store,runtime,sources:new SourceComponentStore(join(directory,'source-components'))});runtime.register(presentation.provider());
  runtime.addConnection({appId:'hallmark',connectionId:'H1',displayName:'H1',enabled:true,config:{},configRevision:1});runtime.addConnection({appId:'notes',connectionId:'N1',displayName:'N1',enabled:true,config:{},configRevision:1});runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'Shared',enabled:true,config:{},configRevision:1});store.put('legacy_aliases','connection:default',{appId:'hallmark',connectionId:'H1',status:'resolved'});
  const token='b'.repeat(64);writeFileSync(join(directory,'service-key'),token);const server=createAppsServer({runtime,presentation,token});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port,url=`http://127.0.0.1:${port}`;
  const f=context(),transport=new HttpAppsHostTransport(url,token),bundle=await createAppsBundle(f.ctx,{serviceUrl:url,dataDirectory:directory,autoStart:false},transport,{legacyToolProjection:true});
  try {assert.equal(f.tools.size,30);assert.equal([...f.tools.keys()].filter(name=>name.startsWith('hallmark_')).length,26);assert.equal([...f.tools.keys()].filter(name=>name.startsWith('apps_')).length,4);assert.equal(f.routes.size,2);
    await bundle.legacy.setActive('A',true);const tool=f.tools.get('hallmark_list_stores') as NativeTool;const result=await tool.execute({},{agent:f.A,name:'hallmark_list_stores',arguments:{},signal:new AbortController().signal});assert.equal(result.status,'ok');assert.equal(calls.length,1);assert.equal(store.list('invocations').length,1);
    assert.equal((await tool.execute({},{agent:f.B,name:'hallmark_list_stores',arguments:{},signal:new AbortController().signal})).error?.code,'APP_NOT_ACTIVE');assert.equal(calls.length,1);
    const diagnostic=await transport.diagnostics('A');assert.equal(diagnostic.invocations.length,1);assert.equal(diagnostic.invocations[0].appId,'hallmark');assert.equal(diagnostic.invocations[0].connectionId,'H1');assert.ok(diagnostic.invocations[0].invocationId);assert.ok(diagnostic.invocations[0].traceId);assert.equal(diagnostic.invocations[0].operationId,null);assert.equal((await transport.diagnostics('B')).invocations.length,0);
    const exposed=await bundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps?resource=diagnostics&sessionId=A'));assert.equal(exposed.status,200);assert.deepEqual(await exposed.json(),diagnostic);
    const unknown=await bundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps?resource=diagnostics&sessionId=nonexistent'));assert.equal(unknown.status,400);
    await bundle.dispose();assert.equal(f.tools.size,0);assert.equal(f.routes.size,0);assert.equal(runtime.listApps().length,3);assert.equal(store.list('invocations').length,1);
    const defaultContext=context(),defaultBundle=await createAppsBundle(defaultContext.ctx,{serviceUrl:url,dataDirectory:directory,autoStart:false},transport);
    try {assert.equal(defaultContext.tools.size,4);assert.equal([...defaultContext.tools.keys()].filter(name=>name.startsWith('hallmark_')).length,0);assert.equal(defaultContext.prompts.has('hallmark-app'),false);assert.equal(runtime.describe('hallmark_list_stores')?.capabilityId,'hallmark.read0');assert.equal(defaultContext.routes.size,2);assert.equal((await defaultBundle.host.directory()).apps.find(row=>row.appId==='apps')?.hostProjectionState,'attached');
      const shared=await defaultBundle.host.call('apps_invoke',{appId:'apps',connectionId:'presentation',capabilityId:'apps.presentation.list_saved',capabilityVersion:'1.0.0',input:{}},'A') as CapabilityResult;assert.equal(shared.status,'ok',JSON.stringify(shared));
      runtime.bind({sessionId:'A',appId:'notes',connectionId:'N1',enabled:true,boundAt:new Date().toISOString()});const project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'package.json'),'{"name":"native-source-fixture","private":true}');writeFileSync(join(project,'package-lock.json'),'{"lockfileVersion":3}');writeFileSync(join(project,'Component.tsx'),'export default () => null;');writeFileSync(join(project,'dist/index.html'),'<html>Actual native source proxy fixture</html>');
      const args={appId:'apps',connectionId:'presentation',capabilityId:'apps.presentation.open_source_component',capabilityVersion:'1.0.0',input:{directory:project,title:'Native source',bindings:[{bindingId:'notes',appId:'notes',connectionId:'N1',capabilityId:'notes.read0',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]}},gateway=defaultContext.tools.get('apps_invoke') as NativeGatewayTool,result=await gateway.execute(args,{agent:defaultContext.A,signal:new AbortController().signal}) as {result:CapabilityResult};assert.equal(result.result.status,'ok',JSON.stringify(result));const view=(result.result as unknown as {data:{viewId:string;viewRevision:number;source:{buildId:string}}}).data;
      assert.deepEqual(gateway.output.presentationMeta(args,result),{apps:{viewId:view.viewId,sessionId:'A',buildId:view.source.buildId,viewRevision:view.viewRevision}});
      const viewURL=`http://dsh.invalid/api/dsh-apps?resource=view&sessionId=A&viewId=${view.viewId}`,read=await defaultBundle.host.ui(new Request(viewURL));assert.equal(read.status,200);assert.equal((await read.json() as {viewId:string}).viewId,view.viewId);assert.equal((await defaultBundle.host.ui(new Request(viewURL))).status,200);
      const asset=defaultContext.routes.get(`/api/hallmark-source/${view.source.buildId}/index.html`) as {fetch(request:Request):Promise<Response>};assert.ok(asset);assert.match(await(await asset.fetch(new Request('http://dsh.invalid/source'))).text(),/Actual native source/);assert.equal((await defaultBundle.host.ui(new Request(viewURL.replace('sessionId=A','sessionId=B')))).status,400);
      const bridge={channel:'dsh.apps.component.v2',protocolVersion:'2.0',sessionId:'A',viewId:view.viewId,buildId:view.source.buildId,frameInstanceId:'native-frame',requestId:'native-request',method:'invokeCapability',params:{appId:'notes',connectionId:'N1',capabilityId:'notes.read0',capabilityVersion:'1.0.0',input:{},deadlineAt:new Date(Date.now()+5000).toISOString()}},response=await defaultBundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'componentBridge',request:bridge})}));assert.equal(response.status,200);const packet=await response.json() as {result:CapabilityResult};assert.equal(packet.result.status,'ok');assert.equal(store.get<any>('invocations',packet.result.invocationId).request.source.kind,'component');
      const unknown=await defaultBundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'componentBridge',request:{...bridge,sessionId:'unrecognized'}})}));assert.equal(unknown.status,400);}
    finally {await defaultBundle.dispose();assert.equal(defaultContext.tools.size,0);}
  }finally{await bundle.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();const target=resolve(directory);assert.equal(target,directory);assert.match(target,/apps-host-bundle-[^\\/]+$/);rmSync(target,{recursive:true,force:true});}
});

test('breaking Host handshake reports expected/actual versions and stops before dispatch or registration',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('notes',calls));connection(runtime,'notes','N1','A');const transport=inProcessTransport(runtime),f=context(),host=new AppsHost(f.ctx,transport);await host.start();host.attachApp('notes');
  try{transport.identity=async()=>({...runtime.identity(),transportMajor:2});const args={appId:'notes',connectionId:'N1',capabilityId:'notes.read0',capabilityVersion:'1.0.0',input:{}},native=f.tools.get('apps_invoke') as NativeGatewayTool,result=await native.execute(args,{agent:f.A,signal:new AbortController().signal}) as CapabilityResult;assert.equal(result.status,'failed');assert.ok('error' in result);assert.equal(result.error.code,'INCOMPATIBLE_PROTOCOL');assert.deepEqual(result.error.details,{expected:{transportMajor:1,catalogSchemaVersion:1},actual:{transportMajor:2,catalogSchemaVersion:1}});assert.match(native.output.render(args,result)[0].text,/INCOMPATIBLE_PROTOCOL/);assert.equal(calls.length,0);assert.equal(store.list('invocations').length,0);
    const second=context(),rejected=new AppsHost(second.ctx,transport);await assert.rejects(rejected.start(),{message:'INCOMPATIBLE_PROTOCOL'});assert.equal(second.tools.size,0);assert.equal(second.routes.size,0);await rejected.dispose();}
  finally{await host.dispose();await runtime.dispose();store.close();}
});
