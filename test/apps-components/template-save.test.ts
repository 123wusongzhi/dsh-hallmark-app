import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {RuntimeOperation} from '../../packages/app-runtime/src/store.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import type {CapabilityResult,DatasetBinding,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

function setup(t:{after:(action:()=>unknown)=>void}){
  const directory=mkdtempSync(join(tmpdir(),'template-save-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'sources'),join(directory,'workspaces'));
  const presentation=new AppsPresentationService({store,runtime,sources});runtime.register(new NotesProvider({store}));const provider=presentation.provider();runtime.register(provider);
  for(const [appId,connectionId] of [['apps','presentation'],['notes','local']]){runtime.addConnection({appId,connectionId,displayName:appId,config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'session-a',appId,connectionId,enabled:true,boundAt:new Date().toISOString()});}
  t.after(async()=>{await runtime.dispose();store.close();rmSync(directory,{recursive:true,force:true});});
  const binding:DatasetBinding&{capabilityVersion:string}={bindingId:'items',appId:'notes',connectionId:'local',capabilityId:'notes.notes.list',capabilityMajor:1,capabilityVersion:'1.0.0',input:{limit:50},projection:[],refresh:{mode:'manual'}};
  const request=(action:string,input:JsonValue):InvocationRequest=>({protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId:`apps.presentation.${action}`,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'session-a',nativeCallId:randomUUID()},invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+30000).toISOString(),idempotencyKey:randomUUID()});
  const invoke=(action:string,input:JsonValue)=>runtime.invoke(request(action,input));
  return {directory,store,runtime,sources,presentation,binding,request,invoke,provider};
}
function data(result:CapabilityResult):Record<string,any>{assert.equal(result.status,'ok',JSON.stringify(result));assert.ok('data' in result);return result.data as Record<string,any>;}

test('authoring bindings save, list and reopen a source template without invocation-only metadata',async t=>{
  const f=setup(t),authoring=f.presentation.configureAuthoring(),draft=authoring.begin('session-a',{mode:'new',title:'Reusable source',bindings:[f.binding]});
  assert.equal('capabilityVersion' in draft.view.bindings[0],false);
  const project=draft.draft.workspacePath;mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'package-lock.json'),'{}');writeFileSync(join(project,'dist','index.html'),'<p>Saved design</p>');
  const view=f.presentation.openSource('session-a',project,{viewId:draft.view.viewId});
  const input={viewId:view.viewId,name:'Template',userRequest:'Save as template'},request=f.request('save_template',input),saved=data(await f.runtime.invoke(request));
  assert.equal('capabilityVersion' in saved.bindings[0],false);assert.equal(saved.bindings[0].datasetId,view.bindings[0].datasetId);
  assert.equal(data(await f.runtime.invoke({...request,invocationId:randomUUID()})).assetId,saved.assetId);assert.equal(f.store.list('saved_assets').length,1);
  assert.equal(data(await f.invoke('list_saved',{})).assets[0].assetId,saved.assetId);
  const opened=data(await f.invoke('render_view',{title:'Reused',templateId:saved.assetId}));
  assert.notEqual(opened.source.directory,project);assert.equal(readFileSync(join(opened.source.directory,'dist','index.html'),'utf8'),'<p>Saved design</p>');
  assert.equal(opened.bindings[0].datasetId,view.bindings[0].datasetId);
});

test('invalid template output rolls back the asset and leaves subsequent saves usable',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Invalid old view',bindings:[f.binding]});
  f.store.put('views',view.viewId,{...view,bindings:[{...view.bindings[0],unsupportedMetadata:true}]});
  const failed=await f.invoke('save_template',{viewId:view.viewId,name:'Invalid',userRequest:'Save'});
  assert.equal(failed.status,'failed');assert.equal('error' in failed&&failed.error.code,'OUTPUT_SCHEMA_INVALID');assert.equal(failed.operation?.state,'failed');
  assert.equal(f.store.list('saved_assets').length,0);assert.equal(f.store.list('artifact_refs').length,0);
  f.store.put('views',view.viewId,view);data(await f.invoke('save_template',{viewId:view.viewId,name:'Valid',userRequest:'Save'}));
});

test('a lost local save response is recovered from its atomic receipt without writing another asset',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Receipt',bindings:[f.binding]}),provider=f.provider,execute=provider.execute;
  // The provider commits successfully, then the transport loses its result.
  provider.execute=async context=>{await execute(context);throw new Error('Lost response');};
  const unknown=await f.invoke('save_template',{viewId:view.viewId,name:'Receipt',userRequest:'Save'});assert.equal(unknown.status,'unknown');
  const asset=data(await f.runtime.inspect(unknown.operation!.operationId));assert.equal(asset.title,'Receipt');assert.equal(f.store.list('saved_assets').length,1);
  assert.equal(f.store.get<RuntimeOperation>('operations',unknown.operation!.operationId)?.state,'succeeded');
});

test('legacy output-schema failure recovers the unique matching template and lists it without rewriting history',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Old',bindings:[f.binding]}),provider=f.provider,execute=provider.execute;
  provider.execute=async context=>{
    const asset=f.presentation.saveTemplate('session-a',view.viewId,'Old','Save');
    const polluted={...asset,bindings:[{...view.bindings[0],capabilityVersion:'1.0.0'}]};f.store.put('saved_assets',`template:${asset.assetId}`,polluted);
    return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:polluted as JsonValue};
  };
  const unknown=await f.invoke('save_template',{viewId:view.viewId,name:'Old',userRequest:'Save'});assert.equal(unknown.status,'unknown');
  provider.execute=execute;
  const before=f.store.list('saved_assets'),saved=data(await f.runtime.inspect(unknown.operation!.operationId));
  assert.equal('capabilityVersion' in saved.bindings[0],false);assert.deepEqual(f.store.list('saved_assets'),before);
  assert.equal(data(await f.invoke('list_saved',{})).assets.length,1);
  data(await f.invoke('manage_saved',{kind:'template',id:saved.assetId,action:'rename',name:'Renamed'}));
  data(await f.invoke('save_template',{viewId:view.viewId,name:'Next',userRequest:'Save next'}));
});

test('legacy recovery stays unknown when matching template evidence is ambiguous',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Old',bindings:[f.binding]}),provider=f.provider,execute=provider.execute;
  provider.execute=async context=>{
    const asset=f.presentation.saveTemplate('session-a',view.viewId,'Old','Save'),polluted={...asset,bindings:[{...view.bindings[0],capabilityVersion:'1.0.0'}]};
    for(const id of [String(asset.assetId),randomUUID()])f.store.put('saved_assets',`template:${id}`,{...polluted,assetId:id});
    return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:polluted as JsonValue};
  };
  const unknown=await f.invoke('save_template',{viewId:view.viewId,name:'Old',userRequest:'Save'});
  provider.execute=execute;
  assert.equal((await f.runtime.inspect(unknown.operation!.operationId)).status,'unknown');assert.equal(f.store.list('saved_assets').length,2);
});

test('a lost delete response is recoverable after its template is gone',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Delete receipt',bindings:[f.binding]}),saved=data(await f.invoke('save_template',{viewId:view.viewId,name:'Delete me',userRequest:'Save'}));
  const execute=f.provider.execute;f.provider.execute=async context=>{await execute(context);throw new Error('Lost delete response');};
  const unknown=await f.invoke('manage_saved',{kind:'template',id:saved.assetId,action:'delete'});
  assert.equal(unknown.status,'unknown');assert.equal(f.store.list('saved_assets').length,0);
  assert.deepEqual(data(await f.runtime.inspect(unknown.operation!.operationId)),{deleted:true,id:saved.assetId});
});

test('a lost failure response uses its rollback receipt rather than blocking future saves',async t=>{
  const f=setup(t),view=f.presentation.createView('session-a',{title:'Rollback receipt',bindings:[f.binding]}),execute=f.provider.execute;
  f.store.put('views',view.viewId,{...view,bindings:[{...view.bindings[0],unsupportedMetadata:true}]});
  f.provider.execute=async context=>{await execute(context);throw new Error('Lost failure response');};
  const unknown=await f.invoke('save_template',{viewId:view.viewId,name:'Bad',userRequest:'Save'});assert.equal(unknown.status,'unknown');
  const recovered=await f.runtime.inspect(unknown.operation!.operationId);assert.equal(recovered.status,'failed');assert.equal(recovered.operation?.state,'failed');
  assert.equal(f.store.list('saved_assets').length,0);
  f.provider.execute=execute;f.store.put('views',view.viewId,view);
  data(await f.invoke('save_template',{viewId:view.viewId,name:'Good',userRequest:'Save'}));
});
