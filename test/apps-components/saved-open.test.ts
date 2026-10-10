import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {AppsView} from '../../packages/app-presentation/src/types.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

async function setup(t:{after:(action:()=>unknown)=>void},multiple=false){
 const directory=mkdtempSync(join(tmpdir(),'saved-open-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:InvocationRequest[]=[];
 const descriptor:CapabilityDescriptor={capabilityId:'shop.products.list',version:'1.0.0',title:'Products',description:'Saved connection fixture',effect:'query',inputSchema:{type:'object',properties:{storeId:{type:'string'},status:{type:'string'},limit:{type:'integer'},cursor:{type:'string'}},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 runtime.register({manifest:{manifestVersion:1,appId:'shop',displayName:'Shop',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[descriptor],execute:async context=>{
  calls.push(context.request);const input=context.request.input as {cursor?:string;limit:number},offset=Number(input.cursor??0),products=[{id:'A',status:'on_sale'},{id:'B',status:'on_sale'}];
  return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{products:products.slice(offset,offset+input.limit),total:products.length,...(offset+input.limit<products.length?{cursor:String(offset+input.limit)}:{})}};
 },dispose:async()=>{}});
 const sources=new SourceComponentStore(join(directory,'archive'),join(directory,'workspaces')),service=new AppsPresentationService({store,runtime,sources});service.configureAuthoring();runtime.register(service.provider());
 for(const [appId,connectionId] of [['apps','presentation'],['shop','saved'],['shop','alternate'],['shop','unrelated']])runtime.addConnection({appId,connectionId,displayName:connectionId,enabled:true,config:{fixture:connectionId},configRevision:1});
 for(const [sessionId,appId,connectionId] of [['owner','apps','presentation'],['new','apps','presentation'],['owner','shop','saved'],['owner','shop','alternate'],['new','shop','alternate']])runtime.bind({sessionId,appId,connectionId,enabled:true,boundAt:'2026-10-01T00:00:00Z'});
 runtime.bind({sessionId:'new',appId:'shop',connectionId:'unrelated',enabled:false,boundAt:'2026-10-01T00:00:00Z'});
 t.after(async()=>{await runtime.dispose();store.close();rmSync(directory,{recursive:true,force:true});});
 const binding:DatasetBinding={bindingId:'products',appId:'shop',connectionId:'saved',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{storeId:'exact-store',status:'on_sale',limit:1},projection:[],refresh:{mode:'manual'}},project=join(directory,'project');
 mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<p>Saved products</p>');writeFileSync(join(project,'package-lock.json'),'{}');
 const view=service.openSource('owner',project,{title:'Saved products',bindings:[binding,...(multiple?[{...binding,bindingId:'secondary',connectionId:'alternate'}]:[])]});
 await service.refreshView('owner',view.viewId,{kind:'agent',sessionId:'owner',nativeCallId:'seed-cache'});
 const saved=service.saveComponent('owner',view.viewId,'Save products',{mode:'save_as'}),template=service.saveTemplate('owner',view.viewId,'Products template','Save template');
 const invoke=(capabilityId:string,input:JsonValue):Promise<CapabilityResult>=>runtime.invoke({protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'new',nativeCallId:randomUUID()},invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+30000).toISOString()});
 const open=(kind:string,target=join(directory,`opened-${randomUUID()}`))=>kind==='component'?invoke('apps.presentation.open_component',{componentId:saved.componentId,directory:target}):kind==='edit'?invoke('apps.authoring.begin',{mode:'open_saved',componentId:saved.componentId,workspacePath:target}):invoke('apps.presentation.render_view',{title:'Reused template',templateId:template.assetId,directory:target});
 return {directory,store,runtime,calls,service,view,saved,template,open};
}

for(const kind of ['component','edit','template'])test(`${kind} opens saved exact connections in the new session and cached products can page`,async t=>{
 const f=await setup(t),connections=f.runtime.listConnections(),owner=f.runtime.sessionBindings('owner'),before=f.runtime.sessionBindings('new'),assets=f.store.list('components');
 // Cover both a fresh chat and an existing disabled reference to the same saved connection.
 if(kind==='edit')f.runtime.bind({sessionId:'new',appId:'shop',connectionId:'saved',enabled:false,boundAt:'2026-10-01T00:00:00Z'});
 const result=await f.open(kind);assert.equal(result.status,'ok',JSON.stringify(result));assert.ok('data' in result);
 const opened=(kind==='edit'?(result.data as any).view:result.data) as AppsView;
 assert.notEqual(opened.viewId,f.view.viewId);assert.equal(opened.ownerSessionId,'new');assert.deepEqual(opened.bindings,f.view.bindings);assert.equal(opened.source!.buildId,f.view.source!.buildId);
 assert.equal((f.service.getData('new',opened.viewId).bindings[0].payload as any).products[0].id,'A');
 const page=await f.service.readBindingPage(opened,'new-frame',{bindingId:'products',cursor:'1'},{kind:'component',sessionId:'new',viewId:opened.viewId,frameInstanceId:'frame'});
 assert.equal((page.bindings[0].payload as any).products[0].id,'B');assert.equal((page.bindings[0].payload as any).cursor,undefined);
 assert.equal((f.calls.at(-1)!.source as {sessionId:string}).sessionId,'new');assert.equal(f.calls.at(-1)!.connectionId,'saved');assert.deepEqual(f.calls.at(-1)!.input,{storeId:'exact-store',status:'on_sale',limit:1,cursor:'1'});
 assert.equal(f.runtime.sessionBindings('new').filter(row=>row.appId==='shop'&&row.connectionId==='saved'&&row.enabled).length,1);
 assert.deepEqual(f.runtime.sessionBindings('new').filter(row=>row.connectionId!=='saved'),before);assert.deepEqual(f.runtime.sessionBindings('owner'),owner);assert.deepEqual(f.runtime.listConnections(),connections);assert.deepEqual(f.store.list('components'),assets);
 const active=f.runtime.sessionBindings('new');assert.equal((await f.open(kind)).status,'ok');assert.deepEqual(f.runtime.sessionBindings('new'),active);
});

for(const kind of ['component','edit','template'])for(const state of ['missing','disabled'])test(`${kind} rejects a ${state} saved connection before checkout or partial session activation`,async t=>{
 const f=await setup(t,true);
 if(state==='missing')f.store.delete('connections',canonicalJson(['shop','alternate']));
 else await f.runtime.updateConnection({appId:'shop',connectionId:'alternate',expectedConfigRevision:1,enabled:false});
 const target=join(f.directory,'must-not-be-created'),views=f.store.list('views'),bindings=f.runtime.sessionBindings('new'),connections=f.runtime.listConnections(),drafts=f.store.list('authoring_drafts'),refs=f.store.list('artifact_refs');
 const result=await f.open(kind,target);assert.equal(result.status,'failed',JSON.stringify(result));assert.ok('error' in result);
 assert.equal(result.error.code,state==='missing'?'SAVED_CONNECTION_MISSING':'SAVED_CONNECTION_DISABLED');assert.match(result.error.message,/shop\/alternate/);assert.match(result.error.message,state==='missing'?/恢复该连接后重试/:/启用该连接后重试/);
 assert.equal(existsSync(target),false);assert.deepEqual(f.store.list('views'),views);assert.deepEqual(f.store.list('authoring_drafts'),drafts);assert.deepEqual(f.store.list('artifact_refs'),refs);assert.deepEqual(f.runtime.sessionBindings('new'),bindings);assert.deepEqual(f.runtime.listConnections(),connections);
});
