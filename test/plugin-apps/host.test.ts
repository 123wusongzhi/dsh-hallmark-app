import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {randomInt,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime, RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
// @ts-expect-error The standalone preview CLI also exposes its actual browser runner.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';
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

const previewBrowser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
// Windows may assign a Fetch-restricted low port (for example 2049) to listen(0).
async function listenForFetch(server:ReturnType<typeof createAppsServer>):Promise<string>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((accept,reject)=>{
        const ready=()=>{server.off('error',failed);accept();};
        const failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('error',failed);server.once('listening',ready);server.listen(randomInt(20000,65536),'127.0.0.1');
      });
      return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    }catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}
test('Host manual refresh forwards force mode only for valid known sessions',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),f=context(),calls:unknown[]=[];
  const transport={...inProcessTransport(runtime),async refreshView(sessionId:string,viewId:string,forceRefresh:boolean){calls.push({sessionId,viewId,forceRefresh});return {viewId,bindings:[]};}} as AppsHostTransport;
  const host=new AppsHost(f.ctx,transport);await host.start();
  const post=(input:unknown)=>host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
  try{for(const forceRefresh of [true,false])assert.equal((await post({action:'refreshView',sessionId:'A',viewId:'V',forceRefresh})).status,200);
    assert.deepEqual(calls,[{sessionId:'A',viewId:'V',forceRefresh:true},{sessionId:'A',viewId:'V',forceRefresh:false}]);
    for(const bad of [{sessionId:'unknown'},{viewId:'../V'},{forceRefresh:'true'},{ignored:true}])assert.equal((await post({action:'refreshView',sessionId:'A',viewId:'V',forceRefresh:true,...bad})).status,400);
    assert.equal(calls.length,2);
  }finally{await host.dispose();await runtime.dispose();store.close();}
});

test('Host forwards fixed display data identity and rejects malformed generations before transport',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),f=context(),calls:unknown[]=[];
  const transport={...inProcessTransport(runtime),async viewData(sessionId:string,viewId:string,_signal?:AbortSignal,target?:unknown){calls.push({sessionId,viewId,target});return {viewId,bindings:[]};}} as AppsHostTransport;
  const host=new AppsHost(f.ctx,transport);await host.start();
  const query={resource:'viewData',sessionId:'A',viewId:'V',publicationId:'P1',buildId:'build',displayId:'display',displayGeneration:'2'},get=(params:Record<string,string>)=>host.ui(new Request('http://dsh.invalid/api/dsh-apps?'+new URLSearchParams(params)));
  try{const response=await get(query);assert.equal(response.status,200);assert.deepEqual(calls,[{sessionId:'A',viewId:'V',target:{publicationId:'P1',buildId:'build',displayId:'display',displayGeneration:2}}]);
    for(const params of [{...query,sessionId:'unknown'},{...query,displayId:''},{...query,displayGeneration:''},{...query,displayGeneration:'0'},{...query,displayGeneration:'1.5'},{...query,resource:'view'},{...query,ignored:'unsafe'}])assert.equal((await get(params)).status,400);
    const {displayId:_,...partial}=query;assert.equal((await get(partial)).status,400);assert.equal(calls.length,1);
  }finally{await host.dispose();await runtime.dispose();store.close();}
});
test('real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe',{skip:!existsSync(previewBrowser),timeout:60000},async()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-host-prepared-')),instance=composeAppsRuntime(directory,{connections:[]}),token='c'.repeat(64),server=createAppsServer({...instance,token});
  let bundle:Awaited<ReturnType<typeof createAppsBundle>>|undefined;
  try{
    writeFileSync(join(directory,'service-key'),token);
    const url=await listenForFetch(server);
    const call=async(path:string,input:unknown)=>{const response=await fetch(url+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,200);return response.json();};
    const action=async(capabilityId:string,input:unknown)=>{const result=await call('/v1/presentation-actions',{sessionId:'A',capabilityId,input,requestId:randomUUID()});assert.equal(result.status,'ok',JSON.stringify(result));return result.data;};
    const f=context(),transport=new HttpAppsHostTransport(url,token);bundle=await createAppsBundle(f.ctx,{serviceUrl:url,dataDirectory:directory,autoStart:false},transport);
    const {draft,attempt,view}=await action('apps.authoring.begin',{mode:'new',title:'Prepared archive'}),workspace=draft.workspacePath;
    const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Prepared archive</h1><button id="toggle">Select</button><output id="result">unselected</output><script>window.addEventListener("message",e=>{if(e.source!==parent||e.origin!==location.origin)return;const m=e.data;if(m.type==="hello")parent.postMessage({channel:m.channel,protocolVersion:"2.0",sessionId:m.sessionId,viewId:m.viewId,buildId:m.buildId,frameInstanceId:m.frameInstanceId,requestId:"data",method:"getData",params:null},location.origin);});parent.postMessage({channel:"dsh.apps.component.v2",type:"hello",protocolVersion:"2.0",requestId:"hello",documentNonce:"prepared-document"},location.origin);document.querySelector("#toggle").onclick=()=>document.querySelector("#result").textContent="selected";</script>';
    writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'input.html'),html);writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
    const built=await instance.evidenceRunner.build({attemptId:attempt.attemptId,epoch:attempt.epoch,sourceRevision:draft.sourceRevision,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources:instance.presentation.sources!,onStart:async()=>{await call('/v1/authoring/markBuilding',{sessionId:'A',params:{attemptId:attempt.attemptId,epoch:attempt.epoch}});}});
    const receipt=await action('apps.authoring.record_build',{attemptId:attempt.attemptId,epoch:attempt.epoch,reportRef:built.reportRef});
    const tested=await runAuthoringPreview({attemptId:attempt.attemptId,epoch:attempt.epoch,buildReceiptId:receipt.receiptId,buildReportRef:built.reportRef,mode:'fixture',runner:instance.evidenceRunner,sources:instance.presentation.sources,browserExecutable:previewBrowser,data:{viewId:view.viewId,bindings:[]},assertions:[{id:'select',action:'click',selector:'#toggle',checkSelector:'#result',check:'text',expected:'selected'}]});assert.equal(tested.report.verdict,'PASS');
    const preview=await action('apps.authoring.record_preview',{attemptId:attempt.attemptId,epoch:attempt.epoch,buildReceiptId:receipt.receiptId,reportRef:tested.reportRef});
    const publication=await action('apps.authoring.publish',{attemptId:attempt.attemptId,epoch:attempt.epoch,viewId:view.viewId,expectedViewRevision:attempt.expectedViewRevision,buildId:receipt.archiveBuildId,buildReceiptId:receipt.receiptId,previewReceiptId:preview.receiptId});
    const query=new URLSearchParams({resource:'view',sessionId:'A',viewId:view.viewId,publicationId:publication.publicationId,buildId:publication.candidateBuildId}),response=await bundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps?'+query));
    assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const prepared=await response.json();assert.equal(prepared.publication.state,'prepared');assert.equal(prepared.publication.readyDeadlineAt,null);assert.equal(prepared.source,undefined);
    const asset=f.routes.get(`/api/hallmark-source/${publication.candidateBuildId}/index.html`) as {fetch(request:Request):Promise<Response>};assert.ok(asset,'Host registered the exact successful preview archive');const loaded=await asset.fetch(new Request('http://dsh.invalid/api/hallmark-source/'+publication.candidateBuildId+'/index.html'));assert.equal(loaded.status,200);assert.equal(await loaded.text(),html);
    assert.equal(instance.store.list<{namespace:string}>('provider_records').filter(row=>row.namespace==='frame_grants').length,0);assert.equal(instance.presentation.getView(view.viewId)?.source,undefined);assert.equal(instance.store.list('operations').length,0);
    const foreign=await bundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps?'+new URLSearchParams({...Object.fromEntries(query),sessionId:'B'})));assert.notEqual(foreign.status,200);
    // Persisted legacy-state fixtures reuse the actual PASS receipts and archive; this is not a desktop restart test.
    for(const state of ['failed_mount','interrupted']){
      instance.store.transaction(()=>{const original=instance.store.get<any>('view_publications',publication.publicationId),oldAttempt=instance.store.get<any>('authoring_attempts',attempt.attemptId),oldDraft=instance.store.get<any>('authoring_drafts',draft.draftId),oldView=instance.presentation.getView(view.viewId)!;instance.store.put('view_publications',publication.publicationId,{...original,state});instance.store.put('authoring_attempts',attempt.attemptId,{...oldAttempt,state});instance.store.put('authoring_drafts',draft.draftId,{...oldDraft,status:state});instance.store.put('views',view.viewId,{...oldView,pendingPublicationId:null});});
      const recovered=await bundle.host.ui(new Request('http://dsh.invalid/api/dsh-apps?'+query));assert.equal(recovered.status,200,JSON.stringify(await recovered.clone().json()));const fixed=await recovered.json();assert.equal(fixed.publication.state,state);assert.equal(fixed.publication.source.buildId,publication.candidateBuildId);assert.equal(await (await asset.fetch(new Request('http://dsh.invalid/api/hallmark-source/'+publication.candidateBuildId+'/index.html'))).text(),html);
    }
    assert.equal(instance.store.list<{namespace:string}>('provider_records').filter(row=>row.namespace==='frame_grants').length,0);assert.equal(instance.presentation.getView(view.viewId)?.source,undefined);
  }finally{try{await bundle?.dispose();}finally{server.closeAllConnections();await new Promise<void>(accept=>server.close(()=>accept()));await instance.close();assert.match(resolve(directory),/apps-host-prepared-[^\\/]+$/);rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}}
});

test('manual startMount crosses the original-session UI route only, with fixed identity and no extra gateway tool',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),f=context(),calls:{operation:string;sessionId:string;params:unknown}[]=[];
  const transport={...inProcessTransport(runtime),async authoringAction(operation:string,sessionId:string,params:unknown){calls.push({operation,sessionId,params});return {publicationId:'P1',state:'mounting'};}} as AppsHostTransport;
  const host=new AppsHost(f.ctx,transport);await host.start();const params={viewId:'V',publicationId:'P1',attemptId:'attempt',attemptEpoch:1,buildId:'build',expectedViewRevision:4};
  const request=(sessionId:string,extra:Record<string,unknown>={})=>new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'authoring',operation:'startMount',sessionId,params,...extra})});
  try{const response=await host.ui(request('A'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{publicationId:'P1',state:'mounting'});assert.deepEqual(calls,[{operation:'startMount',sessionId:'A',params}]);
    assert.equal((await host.ui(request('unknown'))).status,400);assert.equal((await host.ui(request('A',{foreignSessionId:'B'}))).status,400);assert.equal(calls.length,1);
    assert.equal(f.tools.size,4);assert.equal([...f.tools.keys()].some(name=>name.includes('startMount')),false);
  }finally{await host.dispose();await runtime.dispose();store.close();}
});

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
  const token='b'.repeat(64),server=createAppsServer({runtime,presentation,token});let bundle:Awaited<ReturnType<typeof createAppsBundle>>|undefined;
  try {writeFileSync(join(directory,'service-key'),token);const url=await listenForFetch(server),f=context(),transport=new HttpAppsHostTransport(url,token);bundle=await createAppsBundle(f.ctx,{serviceUrl:url,dataDirectory:directory,autoStart:false},transport,{legacyToolProjection:true});
    assert.equal(f.tools.size,30);assert.equal([...f.tools.keys()].filter(name=>name.startsWith('hallmark_')).length,26);assert.equal([...f.tools.keys()].filter(name=>name.startsWith('apps_')).length,4);assert.equal(f.routes.size,2);
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
  }finally{try{await bundle?.dispose();}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();const target=resolve(directory);assert.equal(target,directory);assert.match(target,/apps-host-bundle-[^\\/]+$/);rmSync(target,{recursive:true,force:true});}}
});

test('breaking Host handshake reports expected/actual versions and stops before dispatch or registration',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:ExecutionContext[]=[];runtime.register(provider('notes',calls));connection(runtime,'notes','N1','A');const transport=inProcessTransport(runtime),f=context(),host=new AppsHost(f.ctx,transport);await host.start();host.attachApp('notes');
  try{transport.identity=async()=>({...runtime.identity(),transportMajor:2});const args={appId:'notes',connectionId:'N1',capabilityId:'notes.read0',capabilityVersion:'1.0.0',input:{}},native=f.tools.get('apps_invoke') as NativeGatewayTool,result=await native.execute(args,{agent:f.A,signal:new AbortController().signal}) as CapabilityResult;assert.equal(result.status,'failed');assert.ok('error' in result);assert.equal(result.error.code,'INCOMPATIBLE_PROTOCOL');assert.deepEqual(result.error.details,{expected:{transportMajor:1,catalogSchemaVersion:1},actual:{transportMajor:2,catalogSchemaVersion:1}});assert.match(native.output.render(args,result)[0].text,/INCOMPATIBLE_PROTOCOL/);assert.equal(calls.length,0);assert.equal(store.list('invocations').length,0);
    const second=context(),rejected=new AppsHost(second.ctx,transport);await assert.rejects(rejected.start(),{message:'INCOMPATIBLE_PROTOCOL'});assert.equal(second.tools.size,0);assert.equal(second.routes.size,0);await rejected.dispose();}
  finally{await host.dispose();await runtime.dispose();store.close();}
});
