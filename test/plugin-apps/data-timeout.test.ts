import test from 'node:test';
import assert from 'node:assert/strict';
import {APPS_DATA_REQUEST_TIMEOUT_MS,HttpRuntimeTransport} from '../../packages/app-sdk/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type AppsHostTransport,type AppsPluginContext,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {BridgeRequest,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import type {ComponentExtensionRequest} from '../../packages/component-runtime/src/host.ts';

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
 let timeoutMs=120000;
 const descriptor=():CapabilityDescriptor=>({capabilityId:'hallmark.read',version:'1.0.0',title:'Read',description:'Read fixture',effect:'query',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]});
 const transport={async identity(){return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'test'};},async listApps(){return [{appId:'hallmark'}];},async describe(){return descriptor();},async listConnections(){return [{appId:'hallmark',connectionId:'C',enabled:true}];},async sessionBindings(){return [{appId:'hallmark',connectionId:'C',enabled:true}];},async invoke(request:InvocationRequest){requests.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{}};}} as unknown as AppsHostTransport;
 const ctx={tools:{register(tool:NativeGatewayTool){tools.set(tool.name,tool);return()=>{};}},agents:{get:()=>agent}} as AppsPluginContext;
 const host=new AppsHost(ctx,transport);await host.start();host.attachApp('hallmark');
 try{assert.equal(tools.get('apps_invoke')?.timeoutMs,150000);assert.equal(tools.get('apps_list')?.timeoutMs,90000);
  for(const [declared,expected]of [[5000,5000],[120000,120000],[180000,150000]]){timeoutMs=declared;const before=Date.now();await host.call('apps_invoke',{appId:'hallmark',capabilityId:'hallmark.read',capabilityVersion:'1.0.0',input:{}},'A');const remaining=Date.parse(requests.at(-1)!.deadlineAt)-before;assert.ok(remaining>=expected&&remaining<=expected+1000,`${declared} must receive ${expected} ms`);}
 }finally{await host.dispose();}
});
