import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import type {DataSourceDraft} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityResult,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

async function fixture(t:{after:(fn:()=>Promise<void>)=>void}) {
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:InvocationRequest[]=[],tools=new Map<string,NativeGatewayTool>(),agent={id:'original-chat',session:{id:'original-chat'}};
 runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['activity']},descriptors:[{capabilityId:'hallmark.api.actions.list',version:'1.0.0',title:'促销活动',description:'Fixture activities',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]}],execute:async context=>{calls.push(context.request);return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:[{id:'a1',title:'秋季活动'}]}};},dispose:async()=>{}});
 const presentation=new AppsPresentationService({store,runtime});runtime.register(presentation.provider());
 for(const [appId,connectionId,enabled] of [['apps','presentation',true],['hallmark','selected',true],['hallmark','other',true],['hallmark','disabled',false]] as const)runtime.addConnection({appId,connectionId,displayName:connectionId,config:{},configRevision:1,enabled});
 const token='workbench-binding-fixture-token'.repeat(2),server=createAppsServer({runtime,presentation,token});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const transport=new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token),host=new AppsHost({tools:{register(tool){tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}},agents:{get:id=>id===agent.id?agent:undefined},sessions:{get:id=>id===agent.id?{id}:undefined}},transport);await host.start();host.attachApp('apps');host.attachApp('hallmark');
 t.after(async()=>{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();});
 const invoke=async(capabilityId:string,input:unknown={},connectionId?:string,idempotencyKey?:string)=>{
  const result=await tools.get('apps_invoke')!.execute({appId:capabilityId.split('.')[0],capabilityId,capabilityVersion:'1.0.0',input,...(connectionId?{connectionId}:{}),...(idempotencyKey?{idempotencyKey}:{})},{agent,signal:new AbortController().signal});return (result&&typeof result==='object'&&'result' in result?result.result:result) as CapabilityResult;
 };
 const prepare=(params:unknown,sessionId:string|undefined=agent.id)=>host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workbench',operation:'prepare',appId:'hallmark',params,...(sessionId?{sessionId}:{})})}));
 return {runtime,presentation,host,transport,calls,invoke,prepare};
}

test('native Agent can discover presentation, then validate and register using only explicitly prepared business connections',async t=>{
 const f=await fixture(t);
 const materials=await f.invoke('apps.presentation.list_materials');assert.equal(materials.status,'ok');assert.deepEqual(f.runtime.sessionBindings('original-chat').map(binding=>[binding.appId,binding.connectionId]),[['apps','presentation']]);
 const unauthorized=await f.invoke('hallmark.api.actions.list',{},'selected');assert.equal(unauthorized.status,'needs_clarification');assert.equal(f.calls.length,0);
 const prepared=await f.prepare({connectionIds:['selected']});assert.equal(prepared.status,200);assert.equal((await prepared.json()).presentationReady,true);
 assert.deepEqual(f.runtime.sessionBindings('original-chat').filter(binding=>binding.appId==='hallmark'&&binding.enabled).map(binding=>binding.connectionId),['selected']);
 const definition:DataSourceDraft={id:'agent-created-activities',title:'Agent 促销活动',appId:'hallmark',connectionId:'selected',capabilityId:'hallmark.api.actions.list',capabilityMajor:1,input:{},parameters:[],fields:[{role:'activity.id',path:'id',confirmed:true},{role:'activity.name',path:'title',confirmed:true}],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
 const validation=await f.invoke('apps.presentation.validate_data_source',{definition});assert.equal(validation.status,'ok');if(validation.status==='ok')assert.equal((validation.data as {status:string}).status,'verified');
 const registered=await f.invoke('apps.presentation.register_data_source',{definition},'presentation','create-agent-source');assert.equal(registered.status,'ok');assert.equal(f.presentation.listDataSources('hallmark')[0].id,definition.id);assert.equal(f.calls.length,2);
 assert.equal((await f.invoke('hallmark.api.actions.list',{},'other')).status,'needs_clarification');assert.equal(f.calls.length,2);
 assert.equal(f.runtime.sessionBindings('original-chat').some(binding=>binding.connectionId==='other'),false);
});

test('prepare rejects unknown sessions, extra fields and invalid connection selections before any binding',async t=>{
 const f=await fixture(t);
 for(const [params,session] of [[{connectionIds:['selected']},'unknown'],[{connectionIds:['selected']},''],[{connectionIds:['selected','disabled']},'original-chat'],[{connectionIds:['selected','unknown']},'original-chat'],[{connectionIds:['selected','selected']},'original-chat'],[{connectionIds:['selected'],enableAll:true},'original-chat']] as const){
  assert.equal((await f.prepare(params,session)).status,400);assert.deepEqual(f.runtime.sessionBindings('original-chat'),[]);
 }
 assert.equal((await f.prepare({connectionIds:[]})).status,200);assert.deepEqual(f.runtime.sessionBindings('original-chat').map(binding=>binding.appId),['apps']);
});

test('gateway never enables a disabled presentation connection or substitutes an explicit different connection',async t=>{
 const f=await fixture(t);
 assert.equal((await f.invoke('apps.presentation.list_materials',{},'other')).status,'needs_clarification');assert.deepEqual(f.runtime.sessionBindings('original-chat'),[]);
 await f.runtime.updateConnection({appId:'apps',connectionId:'presentation',expectedConfigRevision:1,enabled:false});
 assert.equal((await f.invoke('apps.presentation.list_materials')).status,'needs_clarification');assert.deepEqual(f.runtime.sessionBindings('original-chat'),[]);
 assert.equal((await f.prepare({connectionIds:['selected']})).status,400);assert.deepEqual(f.runtime.sessionBindings('original-chat'),[]);
});
