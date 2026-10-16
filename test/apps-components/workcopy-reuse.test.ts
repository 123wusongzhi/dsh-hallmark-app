import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import type {AppsView} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityDescriptor,DatasetBinding,SessionAppBinding} from '../../packages/app-contracts/src/index.ts';

function fixture(t:{after:(action:()=>void)=>void}){
 const directory=mkdtempSync(join(tmpdir(),'workcopy-reuse-')),store=new RuntimeStore(':memory:'),sources=new SourceComponentStore(join(directory,'archive'),join(directory,'workspaces'));
 t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 const descriptor:CapabilityDescriptor={capabilityId:'shop.list',version:'1.0.0',title:'Products',description:'Test products',effect:'query',inputSchema:{type:'object',properties:{storeId:{type:'string'},query:{type:'string'}},required:['storeId'],additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
 const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),bind:(value:SessionAppBinding)=>value,invoke:async()=>{throw new Error('Opening a copy must not query business data');}};
 const presentation=new AppsPresentationService({store,runtime,sources}),authoring=presentation.configureAuthoring(),project=join(directory,'project');
 mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist/index.html'),'<p>Saved version</p>');writeFileSync(join(project,'component.ts'),'saved source');
 const binding:DatasetBinding={bindingId:'products',appId:'shop',connectionId:'shop',capabilityId:'shop.list',capabilityMajor:1,input:{storeId:'A'},projection:[],refresh:{mode:'manual'}};
 const original=presentation.openSource('chat',project,{title:'Saved',bindings:[binding],context:{storeId:'A'}}),saved=presentation.saveComponent('chat',original.viewId,'Save',{mode:'save_as'});
 return {directory,project,store,sources,presentation,authoring,original,saved};
}

test('ordinary opens select the same owned workcopy and preserve dirty source and design',t=>{
 const f=fixture(t),before=f.store.list('components');
 writeFileSync(join(f.project,'component.ts'),'unsaved source');
 f.presentation.createView('chat',{viewId:f.original.viewId,title:'Unsaved title',design:{local:'unsaved'}});
 const first=f.presentation.openComponent('chat',f.saved.componentId),second=f.presentation.openComponent('chat',f.saved.componentId);
 assert.equal(first.viewId,f.original.viewId);assert.deepEqual(second,first);assert.equal(first.title,'Unsaved title');assert.deepEqual(first.design,{local:'unsaved'});
 assert.equal(readFileSync(join(first.source!.directory,'component.ts'),'utf8'),'unsaved source');assert.equal(f.store.list('views').length,1);assert.deepEqual(f.store.list('components'),before);
});

test('different session, store, explicit copy and directory remain independent',t=>{
 const f=fixture(t),other=f.presentation.openComponent('other',f.saved.componentId),shop=f.presentation.openComponent('chat',f.saved.componentId,{context:{storeId:'B'}}),copy=f.presentation.openComponent('chat',f.saved.componentId,{newCopy:true});
 assert.equal(new Set([f.original.viewId,other.viewId,shop.viewId,copy.viewId]).size,4);assert.equal((shop.bindings[0].input as {storeId:string}).storeId,'B');
 assert.equal(f.presentation.openComponent('other',f.saved.componentId).viewId,other.viewId);assert.equal(f.presentation.openComponent('chat',f.saved.componentId,{context:{storeId:'B'}}).viewId,shop.viewId);
 const directory=join(f.directory,'independent'),located=f.presentation.openComponent('chat',f.saved.componentId,{directory});assert.notEqual(located.viewId,copy.viewId);assert.equal(f.presentation.openComponent('chat',f.saved.componentId,{directory}).viewId,located.viewId);
 assert.notEqual(f.presentation.openComponent(null,f.saved.componentId).viewId,f.presentation.openComponent(null,f.saved.componentId).viewId);
});

test('a workcopy with changed bindings is kept but not used for another source configuration',t=>{
 const f=fixture(t),{datasetId:_,...binding}=f.original.bindings[0];
 f.presentation.createView('chat',{viewId:f.original.viewId,title:'Filtered draft',bindings:[{...binding,input:{storeId:'A',query:'local'}}]});
 const reopened=f.presentation.openComponent('chat',f.saved.componentId);assert.notEqual(reopened.viewId,f.original.viewId);assert.deepEqual(reopened.bindings[0].input,{storeId:'A'});
 assert.deepEqual(f.presentation.getView(f.original.viewId)!.bindings[0].input,{storeId:'A',query:'local'});
});

test('save advances current revision identity without treating it as its historical selected revision',t=>{
 const f=fixture(t),edit=f.presentation.openComponent('chat',f.saved.componentId,{newCopy:true}),stale=f.presentation.openComponent('chat',f.saved.componentId,{newCopy:true});
 const second=f.presentation.saveComponent('chat',edit.viewId,'Update',{mode:'update',componentId:f.saved.componentId,expectedRevision:1,title:'Second'});
 assert.equal(second.view.selectedSourceRevision,1);assert.equal(second.view.baseRevision,2);assert.equal(f.presentation.openComponent('chat',f.saved.componentId).viewId,edit.viewId);
 const historical=f.presentation.openComponent('chat',f.saved.componentId,{revision:1});assert.notEqual(historical.viewId,edit.viewId);assert.notEqual(historical.viewId,stale.viewId);assert.equal(historical.title,'Saved');assert.equal(historical.baseRevision,2);assert.equal(historical.selectedSourceRevision,1);
 assert.equal(f.presentation.openComponent('chat',f.saved.componentId,{revision:1}).viewId,historical.viewId);assert.equal(f.presentation.getView(stale.viewId)!.baseRevision,1);
 assert.throws(()=>f.presentation.saveComponent('chat',stale.viewId,'Stale',{mode:'update',componentId:f.saved.componentId,expectedRevision:1}),{code:'COMPONENT_CONFLICT'});
});

test('open_saved continues the recoverable draft without checkout or a second panel',t=>{
 const f=fixture(t),first=f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId});
 writeFileSync(join(first.draft.workspacePath,'component.ts'),'work in progress');
 const next=f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId});
 assert.equal(next.view.viewId,first.view.viewId);assert.equal(next.draft.draftId,first.draft.draftId);assert.equal(next.draft.workspacePath,first.draft.workspacePath);assert.equal(next.draft.epoch,first.draft.epoch+1);
 assert.equal(readFileSync(join(next.draft.workspacePath,'component.ts'),'utf8'),'work in progress');assert.equal(f.store.list('views').length,1);
 const copy=f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId,newCopy:true});assert.notEqual(copy.view.viewId,next.view.viewId);assert.notEqual(copy.draft.workspacePath,next.draft.workspacePath);
 const a=f.authoring.begin('chat',{mode:'new'}),b=f.authoring.begin('chat',{mode:'new'});assert.notEqual(a.view.viewId,b.view.viewId);
});

test('an explicit existing draft workspace is reused while a different workspace creates a separate copy',t=>{
 const f=fixture(t),edit=f.authoring.begin('chat',{mode:'edit',viewId:f.original.viewId});
 assert.notEqual(edit.draft.workspacePath,f.project);
 writeFileSync(join(edit.draft.workspacePath,'component.ts'),'unsaved edit');
 const same=f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId,workspacePath:edit.draft.workspacePath});
 assert.equal(same.view.viewId,edit.view.viewId);assert.equal(same.draft.draftId,edit.draft.draftId);assert.equal(readFileSync(join(same.draft.workspacePath,'component.ts'),'utf8'),'unsaved edit');
 const separate=f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId,workspacePath:join(f.directory,'separate')});assert.notEqual(separate.view.viewId,edit.view.viewId);assert.notEqual(separate.draft.workspacePath,edit.draft.workspacePath);
});

test('missing recoverable workspaces fail without silently replacing the draft or its saved archive',t=>{
 const f=fixture(t),edit=f.authoring.begin('chat',{mode:'edit',viewId:f.original.viewId}),before=f.store.list('authoring_drafts');
 assert.ok(edit.draft.workspacePath.startsWith(f.directory));rmSync(edit.draft.workspacePath,{recursive:true,force:true});
 assert.throws(()=>f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId}),{code:'WORKSPACE_NOT_FOUND'});
 assert.equal(existsSync(edit.draft.workspacePath),false);assert.equal(f.store.list('views').length,1);assert.deepEqual(f.store.list('authoring_drafts'),before);assert.equal(f.sources.verify(f.saved.view.source!.buildId).valid,true);
});

test('closing copies with and without drafts is durable, recoverable and does not delete saved history',t=>{
 const f=fixture(t),before={saved:f.store.list('components'),versions:f.store.list('component_versions'),assets:f.store.list('saved_assets')};
 f.authoring.closeView('chat',f.original.viewId,'keep');assert.equal(f.presentation.getView(f.original.viewId)!.panelState,'closed');assert.ok(f.presentation.getView(f.original.viewId)!.closedAt);
 assert.throws(()=>f.authoring.restoreView('other',f.original.viewId),{code:'VIEW_NOT_OWNED'});
 assert.equal(f.authoring.restoreView('chat',f.original.viewId).panelState,'open');assert.equal(f.presentation.getView(f.original.viewId)!.closedAt,undefined);
 const draft=f.authoring.begin('chat',{mode:'new'});writeFileSync(join(draft.draft.workspacePath,'notes.txt'),'keep this unfinished draft');
 f.authoring.closeView('chat',draft.view.viewId,'keep');assert.equal(f.presentation.getView(draft.view.viewId)!.panelState,'closed');assert.ok(existsSync(join(draft.draft.workspacePath,'notes.txt')));
 const restored=f.authoring.begin('chat',{mode:'edit',viewId:draft.view.viewId});assert.equal(restored.view.panelState,'open');assert.equal(restored.draft.workspacePath,draft.draft.workspacePath);
 assert.deepEqual({saved:f.store.list('components'),versions:f.store.list('component_versions'),assets:f.store.list('saved_assets')},before);assert.equal(f.store.list<AppsView>('views').length,2);
});

test('closed copies reopen in place while discarded authoring drafts are not implicitly reused',t=>{
 const f=fixture(t);f.authoring.closeView('chat',f.original.viewId,'keep');assert.equal(f.presentation.openComponent('chat',f.saved.componentId).viewId,f.original.viewId);assert.equal(f.presentation.getView(f.original.viewId)!.panelState,'open');
 f.authoring.begin('chat',{mode:'open_saved',componentId:f.saved.componentId});f.authoring.closeView('chat',f.original.viewId,'discard');
 assert.notEqual(f.presentation.openComponent('chat',f.saved.componentId).viewId,f.original.viewId);assert.ok(existsSync(f.project));assert.equal(f.presentation.getView(f.original.viewId)!.panelState,'closed');
});
