import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
import {createDataTransferReader} from '../../packages/component-runtime/src/data-transfer-client.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {createVisibleDeadline} from '../../packages/component-runtime/src/visible-deadline.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';

async function fixture(authoring=false) {
  mkdirSync(resolve('artifacts/performance/gateway'),{recursive:true});
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),provider=new NotesProvider({store}),presentation=new AppsPresentationService({store,runtime,...(authoring?{sources:new SourceComponentStore(mkdtempSync(resolve('artifacts/performance/gateway/source-')))}:{})});
  if(authoring)presentation.configureAuthoring();
  let providerCalls=0;const original=provider.execute.bind(provider);provider.execute=async context=>{providerCalls++;return original(context);};runtime.register(provider);
  runtime.addConnection({appId:'notes',connectionId:'N',displayName:'N',enabled:true,configRevision:1,config:{backend:'local-notes'}});
  const binding={sessionId:'A',appId:'notes',connectionId:'N',enabled:true,boundAt:new Date().toISOString()};runtime.bind(binding);
  const token='t'.repeat(64),server=createAppsServer({runtime,presentation,token});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port,paths:string[]=[],tools=new Map<string,NativeGatewayTool>(),agent={id:'A'};
  let corrupt:''|'missing'|'query'='';const fetcher:typeof fetch=async(input,init)=>{const path=new URL(String(input)).pathname;paths.push(path);const response=await fetch(input,init);if(path==='/v1/routed-invocations'&&corrupt){const mode=corrupt;corrupt='';if(mode==='missing')return Response.json({});const value=await response.json();value.result.data={unexpected:true};return Response.json(value);}return response;};
  const transport=new HttpAppsHostTransport(url,token,fetcher),host=new AppsHost({agents:{get:id=>id==='A'?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
  await host.start();host.attachApp('notes');paths.length=0;
  const invoke=(capabilityId='notes.notes.list',input:JsonValue={},extra:Record<string,JsonValue>={})=>tools.get('apps_invoke')!.execute({appId:'notes',connectionId:'N',capabilityId,capabilityVersion:'1.0.0',input,...extra},{agent,signal:new AbortController().signal});
  const close=async()=>{await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();};
  return {store,runtime,presentation,host,transport,paths,tools,agent,url,token,binding,invoke,close,providerCalls:()=>providerCalls,corrupt:(value:typeof corrupt)=>{corrupt=value;}};
}
test('real HTTP gateway reduces list and pinned invocation requests while retaining dynamic authorization and Host schema validation',async()=>{
  const f=await fixture();try {
    const args={appId:'notes',connectionId:'N',capabilityId:'notes.notes.list',capabilityVersion:'1.0.0',input:{}};
    assert.equal(f.tools.get('apps_invoke')!.isConcurrencySafe(args),false);
    await f.tools.get('apps_list')!.execute({},{agent:f.agent,signal:new AbortController().signal});assert.equal(f.paths.length,3);const listRequests=f.paths.splice(0);
    const first=await f.invoke() as any;assert.equal(first.result.status,'ok');assert.equal(f.paths.length,3);const coldRequests=f.paths.splice(0);
    assert.equal(f.tools.get('apps_invoke')!.isConcurrencySafe(args),true);assert.equal(f.tools.get('apps_invoke')!.isConcurrencySafe({...args,capabilityId:'notes.notes.create'}),false);
    const warm=await f.invoke() as any;assert.equal(warm.result.status,'ok');assert.equal(f.paths.length,2);const warmRequests=f.paths.splice(0);
    const before=f.providerCalls();f.runtime.bind({...f.binding,enabled:false});const rejected=await f.invoke() as any;assert.equal(rejected.status,'needs_clarification');assert.equal(f.providerCalls(),before);assert.equal(f.store.list<any>('invocations').filter(row=>row.request.capabilityId==='notes.notes.list').length,2);
    f.runtime.bind(f.binding);f.corrupt('query');const malformed=await f.invoke() as any;assert.equal(malformed.result.error.code,'OUTPUT_SCHEMA_INVALID');assert.equal(JSON.parse(malformed.modelProjection.content).error.code,'OUTPUT_SCHEMA_INVALID');
    const evidence={scope:'REAL_AUTHENTICATED_LOCAL_HTTP_GATEWAY',list:{before:4,after:listRequests.length,paths:listRequests},coldInvoke:{before:6,after:coldRequests.length,paths:coldRequests},warmInvoke:{before:6,after:warmRequests.length,paths:warmRequests},revokedBindingProviderCalls:0,hostSchemaStillEnforced:true};mkdirSync(resolve('artifacts/performance/gateway'),{recursive:true});writeFileSync(resolve('artifacts/performance/gateway/measurements.json'),JSON.stringify(evidence,null,2));
  }finally{await f.close();}
});
test('lost fast-route mutation response recovers the original invocation and never falls back to a second dispatch',async()=>{
  const f=await fixture();try{f.corrupt('missing');const result=await f.invoke('notes.notes.create',{id:'one',title:'T',content:'C'},{idempotencyKey:'create-once'}) as any;assert.equal(result.result.status,'ok');assert.equal(f.providerCalls(),1);assert.equal(f.paths.filter(path=>path==='/v1/routed-invocations').length,1);assert.equal(f.paths.filter(path=>path==='/v1/invocations').length,0);assert.equal(f.store.list('operations').length,1);assert.equal(f.store.list('provider_records').filter((row:any)=>row.appId==='notes'&&row.namespace==='notes').length,1);}finally{await f.close();}
});
test('real conditional views response bypasses parsing and serialization while authorization and per-session identity remain live',async()=>{
  const f=await fixture();let reads=0;const original=f.store.viewsForSession.bind(f.store);f.store.viewsForSession=<T>(sessionId:string)=>{reads++;return original<T>(sessionId);};
  try{const view=f.presentation.createView('A',{title:'V'}),request=(etag?:string,sessionId='A')=>new Request('http://native/api/dsh-apps?resource=views&sessionId='+sessionId,{headers:etag?{'If-None-Match':etag}:{}});const first=await f.host.ui(request()),etag=first.headers.get('ETag')!;assert.equal(first.status,200);assert.ok(etag);await first.json();
    for(let i=0;i<20;i++){const next=await f.host.ui(request(etag));assert.equal(next.status,304);assert.equal(await next.text(),'');}assert.equal(reads,1);
    const other=await f.transport.viewsResponse('B',etag);assert.equal(other.status,200);assert.deepEqual((await other.json()).views,[]);
    const unauthorized=await fetch(f.url+'/v1/views?sessionId=A',{headers:{Authorization:'Bearer bad','If-None-Match':etag}});assert.equal(unauthorized.status,401);
    f.store.put('views',view.viewId,{...view,title:'Changed'});const changed=await f.host.ui(request(etag));assert.equal(changed.status,200);assert.notEqual(changed.headers.get('ETag'),etag);assert.equal((await changed.json()).views[0].title,'Changed');
    const unknown=await f.host.ui(request(etag,'missing'));assert.notEqual(unknown.status,304);
  }finally{await f.close();}
});
test('real HTTP data transfer keeps the old message ceiling and rejects wrong nonce, revoked connection, changed binding and retired frame',async()=>{
  const f=await fixture(true);try {
    const view=f.presentation.createView('A',{title:'Large',bindings:[{bindingId:'items',appId:'notes',connectionId:'N',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
    const stored={...view,source:{buildId:'build',directory:'/fixture',entry:'index.html',files:['index.html']}};f.store.put('views',view.viewId,stored);
    const datasetId=view.bindings[0].datasetId!,payload={text:'中😀国'.repeat(33300)};f.store.put('datasets',datasetId,{datasetId,revision:'1',payload,resources:[],state:'ready',freshness:'fresh',lastSuccessAt:new Date().toISOString(),sourceDataTime:null,provenance:[]});
    const identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:view.viewId,buildId:'build',frameInstanceId:'frame'},documentNonce='nonce';
    const grant=await f.transport.authoringAction('negotiateFrame','A',{viewId:view.viewId,buildId:'build',frameInstanceId:'frame',documentNonce,clientFeatures:['dataTransferV1']}) as any;assert.deepEqual(grant.features,['dataTransferV1']);
    let seq=0;const packets:any[]=[];const extension=async(action:string,params:JsonValue)=>{const response=await f.transport.componentExtension({...identity,channel:COMPONENT_CHANNEL,type:'extension',feature:'dataTransferV1',action,requestId:'R'+(++seq),params:{...(params as any),documentNonce}}) as any;packets.push(response);assert.ok(Buffer.byteLength(JSON.stringify(response))<262144);if(response.error)throw Object.assign(new Error(response.error.code),response.error);return response.result;};
    const reader=createDataTransferReader(extension);assert.deepEqual(await reader({method:'getData'}),f.presentation.getData('A',view.viewId));const old=await f.transport.componentBridge({...identity,channel:COMPONENT_CHANNEL,requestId:'legacy',method:'getData',params:null} as any) as any;assert.equal(old.error.code,'BRIDGE_MESSAGE_TOO_LARGE');
    const header=await extension('prepare',{method:'getData'}) as any;
    await assert.rejects(f.transport.componentExtension({...identity,channel:COMPONENT_CHANNEL,type:'extension',feature:'dataTransferV1',action:'read',requestId:'badnonce',params:{id:header.transfer.id,index:0,documentNonce:'wrong'}}));
    f.runtime.bind({...f.binding,enabled:false});await assert.rejects(extension('read',{id:header.transfer.id,index:0}),{code:'CONNECTION_NOT_BOUND'});f.runtime.bind(f.binding);
    f.store.put('views',view.viewId,{...stored,bindings:stored.bindings.map(binding=>({...binding,input:{limit:20}}))});await assert.rejects(extension('read',{id:header.transfer.id,index:0}),{code:'DATA_TRANSFER_EXPIRED'});f.store.put('views',view.viewId,stored);
    await f.transport.authoringAction('retireFrame','A',{viewId:view.viewId,buildId:'build',frameInstanceId:'frame',documentNonce});await assert.rejects(extension('read',{id:header.transfer.id,index:0}));
    const evidence={scope:'REAL_AUTHENTICATED_LOCAL_HTTP_TRANSFER',snapshotBytes:Buffer.byteLength(JSON.stringify(f.presentation.getData('A',view.viewId))),maxPacketBytes:Math.max(...packets.map(packet=>Buffer.byteLength(JSON.stringify(packet)))),legacyCeiling:262144,legacyOversizeRejected:true,nonceRevocationBindingAndRetirementGuards:true};mkdirSync(resolve('artifacts/performance/gateway'),{recursive:true});writeFileSync(resolve('artifacts/performance/gateway/data-transfer-http.json'),JSON.stringify(evidence,null,2));
  }finally{await f.close();}
});
test('readiness timeout counts visible time, resumes its remaining allowance, and stops permanently after ready',()=>{
  let now=0,nextId=0,errors=0;const pending=new Map<any,{fn:()=>void,at:number}>(),timers={now:()=>now,set:(fn:()=>void,ms:number)=>{const id=++nextId as any;pending.set(id,{fn,at:now+ms});return id;},clear:(id:any)=>{pending.delete(id);}},advance=(ms:number)=>{now+=ms;for(const [id,timer] of pending)if(timer.at<=now){pending.delete(id);timer.fn();}};
  const deadline=createVisibleDeadline(()=>errors++,30000,timers);deadline.visible(true);advance(10000);deadline.visible(false);advance(60000);assert.equal(errors,0);deadline.visible(true);advance(19999);assert.equal(errors,0);advance(1);assert.equal(errors,1);deadline.visible(true);advance(30000);assert.equal(errors,1);
  const ready=createVisibleDeadline(()=>errors++,30000,timers);ready.visible(true);ready.stop();ready.visible(false);ready.visible(true);advance(60000);assert.equal(errors,1);assert.equal(pending.size,0);
});
