import test from 'node:test';
import assert from 'node:assert/strict';
import {APPS_DATA_REQUEST_TIMEOUT_MS,APPS_BUSINESS_REQUEST_TIMEOUT_MS,appsInvocationTimeout,HttpRuntimeTransport} from '../../packages/app-sdk/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type AppsHostTransport,type AppsPluginContext,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {BridgeRequest,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import type {ComponentExtensionRequest} from '../../packages/component-runtime/src/host.ts';
import {createServer} from 'node:http';
import {loopbackHttpFetch} from '../../packages/app-sdk/src/loopback-http.ts';

test('data requests survive the old 90 second limit while caller cancellation and metadata limits remain effective',async t=>{
 const deadlines:{at:number;controller:AbortController}[]=[];let now=0;
 t.mock.method(AbortSignal,'timeout',(ms:number)=>{const controller=new AbortController();deadlines.push({at:now+ms,controller});return controller.signal;});
 const advance=(ms:number)=>{now+=ms;for(const timer of deadlines)if(timer.at<=now)timer.controller.abort(new DOMException('Timed out','TimeoutError'));};
 let signal:AbortSignal|undefined,release:()=>void=()=>{};
 const fetcher:typeof fetch=async(_url,options)=>{signal=options?.signal??undefined;await new Promise<void>((resolve,reject)=>{release=resolve;signal?.addEventListener('abort',()=>reject(signal!.reason),{once:true});});return Response.json({apps:[],status:'ok',invocationId:'I',traceId:'T',data:{}});};
 const host=new HttpAppsHostTransport('http://127.0.0.1:3000','test',fetcher),sdk=new HttpRuntimeTransport('http://127.0.0.1:3000','test',fetcher);
 const bridge={method:'refresh'} as BridgeRequest,extension={feature:'bindingPagesV1'} as ComponentExtensionRequest;
 const reads=[()=>host.refreshView('A','V',true),()=>host.workbenchAction({appId:'hallmark',operation:'preview',params:{}}),()=>host.componentBridge(bridge),()=>host.componentExtension(extension),()=>host.presentationAction({sessionId:'A',capabilityId:'apps.presentation.render_view',input:{},requestId:'R'}),()=>host.authoringAction('preview','A',{}),()=>sdk.invoke({invocationId:'I',traceId:'T',deadlineAt:new Date(Date.now()+120000).toISOString()} as InvocationRequest)];
 for(const read of reads){const pending=read();advance(91000);assert.equal(signal?.aborted,false,'data read must survive 90 seconds');release();await pending;}
 const metadata=host.listApps();const observed=assert.rejects(metadata,{name:'TimeoutError'});advance(90000);await observed;
 const controller=new AbortController(),cancelled=host.refreshView('A','V',true,controller.signal),cancelledResult=assert.rejects(cancelled,{name:'AbortError'});controller.abort();await cancelledResult;
 assert.equal(APPS_DATA_REQUEST_TIMEOUT_MS,150000);
});

test('native gateway respects long capability deadlines and keeps short deadlines',async()=>{
 const tools=new Map<string,NativeGatewayTool>(),agent={id:'A'},requests:InvocationRequest[]=[];
 let timeoutMs=120000,capabilityId='hallmark.read';
 const descriptor=():CapabilityDescriptor=>({capabilityId,version:'1.0.0',title:'Read',description:'Read fixture',effect:'query',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]});
 const transport={async identity(){return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'test-'+timeoutMs};},async listApps(){return [{appId:'hallmark'}];},async describe(){return descriptor();},async listConnections(){return [{appId:'hallmark',connectionId:'C',enabled:true}];},async sessionBindings(){return [{appId:'hallmark',connectionId:'C',enabled:true}];},async invoke(request:InvocationRequest){requests.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{}};}} as unknown as AppsHostTransport;
 const ctx={tools:{register(tool:NativeGatewayTool){tools.set(tool.name,tool);return()=>{};}},agents:{get:()=>agent}} as AppsPluginContext;
 const host=new AppsHost(ctx,transport);await host.start();host.attachApp('hallmark');
 try{assert.equal(tools.get('apps_invoke')?.timeoutMs,900000);assert.equal(tools.get('apps_list')?.timeoutMs,90000);
  for(const [declared,expected]of [[5000,5000],[120000,120000],[180000,150000]]){timeoutMs=declared;const before=Date.now();await host.call('apps_invoke',{appId:'hallmark',capabilityId:'hallmark.read',capabilityVersion:'1.0.0',input:{}},'A');const remaining=Date.parse(requests.at(-1)!.deadlineAt)-before;assert.ok(remaining>=expected&&remaining<=expected+1000,`${declared} must receive ${expected} ms`);}
  capabilityId='hallmark.plan.submit';timeoutMs=900000;const before=Date.now();await host.call('apps_invoke',{appId:'hallmark',capabilityId,capabilityVersion:'1.0.0',input:{}},'A');assert.ok(Date.parse(requests.at(-1)!.deadlineAt)-before>=900000);
  const deadlineAt=new Date(Date.now()+4000).toISOString();await host.call('apps_invoke',{appId:'hallmark',capabilityId,capabilityVersion:'1.0.0',input:{},deadlineAt},'A');assert.equal(requests.at(-1)!.deadlineAt,deadlineAt);
 }finally{await host.dispose();}
});

test('business HTTP paths allow a multi-SKU vision review while explicit deadlines still terminate early',async t=>{
 const deadlines:{at:number;controller:AbortController}[]=[];let now=Date.now(),signal:AbortSignal|undefined,release:()=>void=()=>{};
 t.mock.method(Date,'now',()=>now);t.mock.method(AbortSignal,'timeout',(ms:number)=>{const controller=new AbortController();deadlines.push({at:now+ms,controller});return controller.signal;});
 const advance=(ms:number)=>{now+=ms;for(const timer of deadlines)if(timer.at<=now)timer.controller.abort(new DOMException('Timed out','TimeoutError'));};
 const fetcher:typeof fetch=async(_url,options)=>{signal=options?.signal??undefined;await new Promise<void>((resolve,reject)=>{release=resolve;signal?.addEventListener('abort',()=>reject(signal!.reason),{once:true});});return Response.json({status:'ok',invocationId:'I',traceId:'T',data:{}});};
 const host=new HttpAppsHostTransport('http://127.0.0.1:3000','test',fetcher),sdk=new HttpRuntimeTransport('http://127.0.0.1:3000','test',fetcher);
 const request=()=>({appId:'hallmark',capabilityId:'hallmark.plan.submit',invocationId:'I',traceId:'T',deadlineAt:new Date(now+900000).toISOString()} as InvocationRequest);
 const operations=[()=>sdk.invoke(request()),()=>host.invokeRouted(request()),()=>host.componentBridge({method:'invokeCapability',params:request()} as unknown as BridgeRequest),()=>host.legacyInvoke({name:'hallmark_list_product',arguments:{},sessionId:'A',invocationId:'I',traceId:'T',deadlineAt:new Date(now+900000).toISOString()})];
 for(const invoke of operations){const pending=invoke();advance(301000);assert.equal(signal?.aborted,false,'business submission survives the old five minute limit');release();await pending;}
 const limited=host.invokeRouted({...request(),deadlineAt:new Date(now+4000).toISOString()}),rejected=assert.rejects(limited,{name:'TimeoutError'});advance(4000);await rejected;
 assert.equal(appsInvocationTimeout({appId:'hallmark',capabilityId:'hallmark.plan.submit'}),900000);
 assert.equal(appsInvocationTimeout({appId:'hallmark',capabilityId:'hallmark.plan.get'}),150000);
 assert.equal(appsInvocationTimeout({appId:'other',capabilityId:'hallmark.plan.submit'}),150000);
 assert.equal(APPS_BUSINESS_REQUEST_TIMEOUT_MS,900000);
});

test('SDK business submission without a caller key reads the original receipt and never resubmits',async()=>{
 const paths:string[]=[];
 const sdk=new HttpRuntimeTransport('http://127.0.0.1:3000','test',async url=>{paths.push(new URL(url instanceof Request?url.url:url).pathname);throw new Error('connection lost');});
 const result=await sdk.invoke({appId:'hallmark',capabilityId:'hallmark.plan.submit',invocationId:'original',traceId:'trace',deadlineAt:new Date(Date.now()+900000).toISOString()} as InvocationRequest);
 assert.deepEqual(paths,['/v1/invocations','/v1/invocations/original']);assert.equal(result.status,'unavailable');assert.equal('error'in result&&result.error?.retryPolicy,'inspect_only');
});

test('default long business transports use real loopback HTTP without fetch header deadlines',async t=>{
 const requests:Array<{path:string;authorization:string|undefined;body:Record<string,unknown>}>=[];
 const server=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;requests.push({path:req.url!,authorization:req.headers.authorization,body:JSON.parse(body)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',invocationId:'I',traceId:'T',data:{complete:true}}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const url=`http://127.0.0.1:${address.port}`,fetchSpy=t.mock.method(globalThis,'fetch',async()=>{throw new Error('long request reached fetch and its independent header timeout');});
 const host=new HttpAppsHostTransport(url,'fixture-token'),sdk=new HttpRuntimeTransport(url,'fixture-token'),request=()=>({appId:'hallmark',capabilityId:'hallmark.plan.submit',invocationId:'I',traceId:'T',deadlineAt:new Date(Date.now()+900000).toISOString()} as InvocationRequest);
 try{
  assert.equal((await sdk.invoke(request())).status,'ok');await host.invokeRouted(request());await host.componentBridge({method:'invokeCapability',params:request()} as unknown as BridgeRequest);await host.legacyInvoke({name:'hallmark_list_product',arguments:{},sessionId:'A',invocationId:'I',traceId:'T',deadlineAt:new Date(Date.now()+900000).toISOString()});
  assert.deepEqual(requests.map(row=>row.path),['/v1/invocations','/v1/routed-invocations','/v1/component-bridge','/v1/legacy-invocations']);assert.ok(requests.every(row=>row.authorization==='Bearer fixture-token'));assert.equal(fetchSpy.mock.callCount(),0);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('long loopback HTTP preserves cancellation, deadline, response errors and redirect refusal',async()=>{
 let accepted:()=>void=()=>{};const requests:string[]=[];
 const server=createServer(async(req,res)=>{for await(const _part of req){}requests.push(req.url!);if(req.url==='/wait'){accepted();return;}if(req.url==='/redirect'){res.writeHead(302,{Location:'http://example.invalid'});res.end();return;}res.writeHead(429,{'Content-Type':'application/json','Retry-After':'2'});res.end(JSON.stringify({error:'slow down'}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
 const call=(path:string,signal=new AbortController().signal)=>loopbackHttpFetch(new URL(path,url),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal});
 try{
  const controller=new AbortController(),ready=new Promise<void>(resolve=>{accepted=resolve;}),pending=call('/wait',controller.signal),cancelled=assert.rejects(pending,{name:'AbortError'});await ready;controller.abort();await cancelled;
  await assert.rejects(call('/wait',AbortSignal.timeout(20)),{name:'AbortError'});
  const rejected=await call('/reject');assert.equal(rejected.status,429);assert.equal(rejected.headers.get('Retry-After'),'2');assert.deepEqual(await rejected.json(),{error:'slow down'});
  await assert.rejects(call('/redirect'),/RUNTIME_REDIRECT_DISALLOWED/);assert.deepEqual(requests,['/wait','/wait','/reject','/redirect']);
  assert.throws(()=>loopbackHttpFetch(new URL('http://example.invalid'),{method:'POST',headers:{},signal:controller.signal}),/LOOPBACK_RUNTIME_REQUIRED/);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
