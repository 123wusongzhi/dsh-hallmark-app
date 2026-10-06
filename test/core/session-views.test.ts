import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import type {ViewSpec} from '../../packages/presentation/src/types.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import type {CoreOptions} from '../../packages/core/src/types.ts';

function setup(){
 const store=new AppStore(':memory:');
 for(const sessionId of ['A','B'])store.put('session_apps',sessionId,{appId:'hallmark',active:true});
 const remoteCalls:any[]=[];
 const blocked=async(...args:any[])=>{remoteCalls.push(args);return {status:'unavailable' as const,error:{code:'TEST_REMOTE_FORBIDDEN',message:'No remote call expected',retryable:false}};};
 const client:CoreOptions['client']={getStores:blocked,getStoreProducts:blocked,syncStoreProducts:blocked,getTargetMargin:blocked,searchCollectedItems:blocked,getCollectedItem:blocked,platformRead:blocked,platformCall:blocked};
 const broker:CoreOptions['broker']={getStoreTask:blocked,getListingTask:blocked,requestId:(kind,id,seq)=>`${kind}-${id}-${seq}`};
 const presentation=new PresentationManager(store),options={store,presentation,client,broker},core=new AppCore(options);
 return {store,presentation,core,options,remoteCalls};
}
const spec=(id:string,title='会话组件'):ViewSpec=>({id,title,layout:{type:'column',children:['text']},widgets:[{id:'text',type:'text',text:'Display only'}],bindings:[]});
const render=(core:AppCore,sessionId:string,view=spec('view'))=>core.invoke('hallmark_render_view',{spec:view},{sessionId});

test('session rename is temporary and removal revokes reads/updates/saves without deleting saved designs or source data',async()=>{
 const f=setup();try{
  await render(f.core,'A',spec('managed','Original'));await render(f.core,'B',spec('other','Other'));
  f.presentation.saveComponent('managed','显式保存');f.presentation.saveTemplate('managed','Reusable','显式保存模板');f.store.updateSnapshotSuccess('fixture',{items:[{id:'source-1'}]},null);
  const components=f.store.list('components'),entries=f.store.list('entries'),templates=f.store.list('templates'),snapshot=f.store.get('snapshots','fixture'),other=f.core.listSessionViews('B');
  f.store.put('session_apps','A',{active:false}); // Local list management does not activate chat or dispatch a business tool.
  const renamed=f.core.manageSessionView('A','managed',{action:'rename',title:'  Session name  '});assert.deepEqual(renamed,{sessionId:'A',viewId:'managed',action:'rename',title:'Session name'});
  assert.equal(f.core.getSessionView('A','managed')?.title,'Session name');assert.equal(f.core.listSessionViews('A').views[0].title,'Session name');assert.deepEqual(f.store.list('components'),components);
  assert.deepEqual(f.core.manageSessionView('A','managed',{action:'remove'}),{sessionId:'A',viewId:'managed',action:'remove'});
  assert.deepEqual(f.core.listSessionViews('A').views,[]);assert.equal(f.core.getSessionView('A','managed'),undefined);assert.equal(f.core.getSessionViewData('A','managed'),undefined);
  assert.equal(f.presentation.getView('managed')?.title,'Session name'); // In-memory backing object remains; owned routes revoke access.
  f.store.put('session_apps','A',{appId:'hallmark',active:true});
  assert.equal((await f.core.invoke('hallmark_update_view',{viewId:'managed',patch:[{op:'replace',path:'/title',value:'stale'}]},{sessionId:'A'})).error?.code,'VIEW_NOT_FOUND');
  for(const sessionId of ['A','B'])assert.equal((await f.core.invoke('hallmark_save_component',{viewId:'managed',userRequest:'保存'},{sessionId,userRequest:'保存'})).error?.code,sessionId==='A'?'VIEW_NOT_FOUND':'VIEW_NOT_OWNED');
  assert.equal((await render(f.core,'B',spec('managed','Claim removed'))).error?.code,'VIEW_NOT_OWNED');
  assert.deepEqual(f.core.listSessionViews('B'),other);assert.deepEqual(f.store.list('components'),components);assert.deepEqual(f.store.list('entries'),entries);assert.deepEqual(f.store.list('templates'),templates);assert.deepEqual(f.store.get('snapshots','fixture'),snapshot);assert.equal(f.remoteCalls.length,0);
  const opened=await f.core.invoke('hallmark_open_component',{componentId:'managed'},{sessionId:'A'});assert.equal(opened.status,'ok');assert.notEqual((opened.data as any).spec.id,'managed');
 }finally{f.store.close();}
});

test('session management rejects foreign/invalid edits and leaves a failed rename retryable; expired items can be removed',async()=>{
 const f=setup();try{
  await render(f.core,'A',spec('managed'));const initial=f.core.listSessionViews('A');
  for(const action of ['rename','remove'] as const)assert.throws(()=>f.core.manageSessionView('B','managed',action==='rename'?{action,title:'Cross owner'}:{action}),{code:'VIEW_NOT_OWNED'});
  for(const change of [{action:'delete'},{action:'rename',title:''},{action:'rename',title:' '.repeat(4)},{action:'rename',title:'a'.repeat(201)},{action:'remove',title:'extra'}])assert.throws(()=>f.core.manageSessionView('A','managed',change as any),{code:'INVALID_INPUT'});
  const update=f.presentation.updateView.bind(f.presentation);f.presentation.updateView=()=>{throw new Error('Synthetic save failure');};assert.throws(()=>f.core.manageSessionView('A','managed',{action:'rename',title:'Retry'}),/Synthetic save failure/);assert.deepEqual(f.core.listSessionViews('A'),initial);
  f.presentation.updateView=update;f.core.manageSessionView('A','managed',{action:'rename',title:'Retry'});assert.equal(f.core.getSessionView('A','managed')?.title,'Retry');
  f.presentation.saveComponent('managed','Explicit fixture save');f.presentation.manageSaved('component','managed',{action:'delete'});assert.equal(f.core.listSessionViews('A').views[0].state,'expired');
  f.core.manageSessionView('A','managed',{action:'remove'});assert.deepEqual(f.core.listSessionViews('A').views,[]);assert.throws(()=>f.core.manageSessionView('A','managed',{action:'remove'}),{code:'VIEW_NOT_OWNED'});assert.equal(f.remoteCalls.length,0);
 }finally{f.store.close();}
});

test('only successful trusted render persists a draft and owner without publishing entries',async()=>{
 const f=setup();assert.deepEqual(f.core.listSessionViews('A'),{sessionId:'A',views:[]});
 const invalid=await render(f.core,'A',{...spec('bad'),widgets:[]} as any);assert.equal(invalid.status,'failed');assert.deepEqual(f.core.listSessionViews('A').views,[]);
 const rendered=await render(f.core,'A');assert.equal(rendered.status,'ok');const listed=f.core.listSessionViews('A');assert.equal(listed.views.length,1);
 assert.deepEqual(Object.keys(listed.views[0]).sort(),['createdAt','state','title','updatedAt','viewId']);assert.equal(listed.views[0].viewId,'view');assert.equal(listed.views[0].state,'ready');assert.ok(Number.isFinite(Date.parse(listed.views[0].createdAt)));assert.equal(listed.views[0].createdAt,listed.views[0].updatedAt);
 assert.deepEqual(f.core.getSessionView('A','view'),spec('view'));assert.equal(f.core.getSessionViewData('A','view')?.status,'ok');
 assert.equal(f.store.list('views').length,2);for(const table of ['components','templates','entries'])assert.deepEqual(f.store.list(table),[]);
 assert.deepEqual(f.core.listSessionViews('B'),{sessionId:'B',views:[]});assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('cross-session getters, overwrite render, update and foreign temporary saves are denied without polluting the owner',async()=>{
 const f=setup();await render(f.core,'A',spec('owned','A title'));const before=f.core.listSessionViews('A');
 assert.equal(f.core.getSessionView('B','owned'),undefined);assert.equal(f.core.getSessionViewData('B','owned'),undefined);
 const overwritten=await render(f.core,'B',spec('owned','B takeover'));assert.equal(overwritten.error?.code,'VIEW_NOT_OWNED');
 const updated=await f.core.invoke('hallmark_update_view',{viewId:'owned',patch:[{op:'replace',path:'/title',value:'B edit'}]},{sessionId:'B'});assert.equal(updated.error?.code,'VIEW_NOT_OWNED');
 const request='保存此组件';const saved=await f.core.invoke('hallmark_save_component',{viewId:'owned',userRequest:request},{sessionId:'B',userRequest:request});assert.equal(saved.error?.code,'VIEW_NOT_OWNED');
 const templateRequest='保存模板';const templated=await f.core.invoke('hallmark_save_template',{viewId:'owned',name:'B template',userRequest:templateRequest},{sessionId:'B',userRequest:templateRequest});assert.equal(templated.error?.code,'VIEW_NOT_OWNED');
 assert.deepEqual(f.core.listSessionViews('A'),before);assert.deepEqual(f.core.listSessionViews('B').views,[]);assert.equal(f.presentation.getView('owned')?.title,'A title');assert.equal(f.store.list('entries').length,0);assert.equal(f.store.list('templates').length,0);assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('same-owner successful updates and rerenders preserve creation metadata; failed updates do not record changes',async()=>{
 const f=setup();await render(f.core,'A',spec('owned','Original'));const first=f.core.listSessionViews('A').views[0];
 const success=await f.core.invoke('hallmark_update_view',{viewId:'owned',patch:[{op:'replace',path:'/title',value:'Updated'}]},{sessionId:'A'});assert.equal(success.status,'ok');const second=f.core.listSessionViews('A').views[0];assert.equal(second.title,'Updated');assert.equal(second.createdAt,first.createdAt);assert.ok(Date.parse(second.updatedAt)>=Date.parse(first.updatedAt));
 const failed=await f.core.invoke('hallmark_update_view',{viewId:'owned',patch:[{op:'replace',path:'/title',value:''}]},{sessionId:'A'});assert.equal(failed.status,'failed');assert.deepEqual(f.core.listSessionViews('A').views[0],second);assert.equal(f.presentation.getView('owned')?.title,'Updated');
 const idChange=await f.core.invoke('hallmark_update_view',{viewId:'owned',patch:[{op:'replace',path:'/id',value:'other'}]},{sessionId:'A'});assert.equal(idChange.status,'failed');assert.equal(f.core.getSessionView('A','other'),undefined);
 await render(f.core,'A',spec('owned','Rerendered'));const third=f.core.listSessionViews('A').views[0];assert.equal(third.createdAt,first.createdAt);assert.equal(third.title,'Rerendered');assert.equal(f.store.list('entries').length,0);assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('history getters remain readable with the app closed and use only local snapshot data, never fabricated source time',async()=>{
 const f=setup();f.store.updateSnapshotSuccess('store_products:shop',{products:[{offerId:'A'}]},null);
 const view:ViewSpec={id:'table',title:'Store table',layout:{type:'column',children:['table']},widgets:[{id:'table',type:'table',bindingId:'data',columns:[{field:'offerId',label:'Offer'}]}],bindings:[{id:'data',datasetKey:'store_products:shop',fieldMap:{}}]};await render(f.core,'A',view);
 f.store.put('session_apps','A',{appId:'hallmark',active:false});assert.equal(f.core.listSessionViews('A').views[0].state,'ready');assert.equal(f.core.getSessionView('A','table')?.title,'Store table');
 const data=f.core.getSessionViewData('A','table');assert.equal(data?.status,'ok');const bindings=(data!.data as any).bindings;assert.deepEqual(bindings[0].payload,{products:[{offerId:'A'}]});assert.equal(bindings[0].dataTime,undefined);assert.equal(bindings[0].provenance.dataTime,undefined);
 assert.equal((await f.core.invoke('hallmark_update_view',{viewId:'table',patch:[{op:'replace',path:'/title',value:'No'}]},{sessionId:'A'})).error?.code,'APP_NOT_ACTIVE');assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('unowned global or workbench views cannot be claimed by update or rerender; explicit shared saves remain available',async()=>{
 const f=setup();f.presentation.renderView(spec('legacy','Global legacy'));f.presentation.saveComponent('legacy','Explicit prior save');
 assert.deepEqual(f.core.listSessionViews('A').views,[]);assert.equal(f.core.getSessionView('A','legacy'),undefined);
 assert.equal((await render(f.core,'A',spec('legacy','Claim'))).error?.code,'VIEW_NOT_OWNED');
 assert.equal((await f.core.invoke('hallmark_update_view',{viewId:'legacy',patch:[{op:'replace',path:'/title',value:'Claim'}]},{sessionId:'A'})).error?.code,'VIEW_NOT_OWNED');
 const request='保存共享全局组件';const saved=await f.core.invoke('hallmark_save_component',{viewId:'legacy',userRequest:request},{sessionId:'A',userRequest:request});assert.equal(saved.status,'ok');assert.equal(f.presentation.getView('legacy')?.title,'Global legacy');assert.deepEqual(f.core.listSessionViews('A').views,[]);assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('service restart restores drafts and trusted ownership without granting foreign sessions access',async()=>{
 const f=setup();await render(f.core,'A',spec('temporary'));await render(f.core,'A',spec('saved'));f.presentation.saveComponent('saved','Save explicitly');
 const restarted=new AppCore(f.options);assert.equal(restarted.listSessionViews('A').views.length,2);assert.ok(restarted.getSessionView('A','temporary'));assert.ok(restarted.getSessionViewData('A','saved'));
 assert.equal((await render(restarted,'B',spec('temporary','Claim old memory'))).error?.code,'VIEW_NOT_OWNED');
 const newManager=new PresentationManager(f.store),fresh=new AppCore({...f.options,presentation:newManager});assert.ok(newManager.getView('temporary'));assert.ok(newManager.getView('saved'));assert.equal(fresh.listSessionViews('A').views.length,2);
 assert.equal((await fresh.invoke('hallmark_update_view',{viewId:'saved',patch:[{op:'replace',path:'/title',value:'Restored edit'}]},{sessionId:'A'})).status,'ok');assert.equal((await render(fresh,'B',spec('saved','Claim saved'))).error?.code,'VIEW_NOT_OWNED');assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('list state becomes expired when the actual view disappears; getters do not serve stale Spec copies',async()=>{
 const f=setup();await render(f.core,'A',spec('gone','Delete explicitly'));const before=f.core.listSessionViews('A').views[0];f.presentation.saveComponent('gone','Save explicitly');f.presentation.manageSaved('component','gone',{action:'delete'});
 const after=f.core.listSessionViews('A').views[0];assert.deepEqual(after,{...before,state:'expired'});assert.equal(f.core.getSessionView('A','gone'),undefined);assert.equal(f.core.getSessionViewData('A','gone'),undefined);
 assert.equal((await f.core.invoke('hallmark_update_view',{viewId:'gone',patch:[{op:'replace',path:'/title',value:'No'}]},{sessionId:'A'})).error?.code,'VIEW_NOT_FOUND');assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('successful generated template results belong only to their trusted calling session and do not create saved entries',async()=>{
 const f=setup();const generated=await f.core.invoke('hallmark_render_view',{templateId:'store-overview',title:'Generated table',bindings:[{id:'data',datasetKey:'store_products:shop',fieldMap:{}}]},{sessionId:'B'});assert.equal(generated.status,'ok');const viewId=(generated.data as any).viewId;
 assert.equal(f.core.listSessionViews('B').views[0].viewId,viewId);assert.equal(f.core.listSessionViews('B').views[0].title,'Generated table');assert.deepEqual(f.core.listSessionViews('A').views,[]);assert.equal(f.core.getSessionView('A',viewId),undefined);assert.ok(f.core.getSessionView('B',viewId));assert.equal(f.store.list('entries').length,0);assert.equal(f.remoteCalls.length,0);f.store.close();
});

test('open_component clones persisted design into the requesting session without saving or claiming another temporary view',async()=>{
 const f=setup();try{
  await render(f.core,'A',spec('saved','Persisted title'));f.presentation.saveComponent('saved','保存');
  await f.core.invoke('hallmark_update_view',{viewId:'saved',patch:[{op:'replace',path:'/title',value:'A unsaved edit'}]},{sessionId:'A'});
  const opened=await f.core.invoke('hallmark_open_component',{componentId:'saved'},{sessionId:'B'});assert.equal(opened.status,'ok');const data=opened.data as any;
  assert.notEqual(data.viewId,'saved');assert.equal(data.viewId,data.spec.id);assert.equal(data.sourceComponentId,'saved');assert.equal(data.baseRevision,1);assert.equal(data.spec.title,'Persisted title');
  assert.equal(f.core.getSessionView('B',data.viewId)?.title,'Persisted title');assert.equal(f.core.getSessionView('A',data.viewId),undefined);assert.equal(f.presentation.getView('saved')?.title,'A unsaved edit');
  assert.equal(f.store.list('components').length,1);assert.equal(f.store.list('entries').length,1);assert.equal(f.remoteCalls.length,0);
 }finally{f.store.close();}
});

test('open_component is local and restores editability after restart while update saves require current revision',async()=>{
 const f=setup();try{
  f.presentation.renderView(spec('saved','Original'));f.presentation.saveComponent('saved','保存');
  const fresh=new AppCore({...f.options,presentation:new PresentationManager(f.store)});
  const opened=await fresh.invoke('hallmark_open_component',{componentId:'saved'},{sessionId:'B'}),draft=opened.data as any;
  assert.equal((await fresh.invoke('hallmark_update_view',{viewId:draft.viewId,patch:[{op:'replace',path:'/title',value:'Edited'}]},{sessionId:'B'})).status,'ok');
  const request='更新原组件',args={viewId:draft.viewId,mode:'update',componentId:'saved',expectedRevision:draft.baseRevision,userRequest:request};
  assert.equal((await fresh.invoke('hallmark_save_component',{viewId:draft.viewId,mode:'update',userRequest:request},{sessionId:'B',userRequest:request})).status,'needs_clarification');
  const saved=await fresh.invoke('hallmark_save_component',args,{sessionId:'B',userRequest:request});assert.equal(saved.status,'ok');assert.equal((saved.data as any).component.revision,2);assert.equal(f.store.get('components','saved')!.title,'Edited');
  assert.equal((await fresh.invoke('hallmark_save_component',args,{sessionId:'B',userRequest:request})).error?.code,'COMPONENT_CONFLICT');
  const copy=await fresh.invoke('hallmark_save_component',{viewId:draft.viewId,mode:'save_as',userRequest:'另存为'},{sessionId:'B',userRequest:'另存为'});assert.equal(copy.status,'ok');assert.notEqual((copy.data as any).component.id,'saved');assert.equal(f.store.list('components').length,2);assert.equal(f.remoteCalls.length,0);
 }finally{f.store.close();}
});

test('open_component checks authoritative operation ownership before exposing saved title or registering a draft',async()=>{
 const f=setup();try{
  f.store.put('operations','private',{operationId:'private',kind:'update_price',state:'succeeded',sessionId:'A',updatedAt:'2026-10-06T00:00:00Z',items:[]});
  const view={...spec('saved','Private receipt title'),bindings:[{id:'receipt',datasetKey:'operation:private',fieldMap:{}}]};
  f.presentation.renderView(view);f.presentation.saveComponent(view.id,'保存操作回执');
  const blocked=await f.core.invoke('hallmark_open_component',{componentId:'saved'},{sessionId:'B'});assert.equal(blocked.error?.code,'VIEW_NOT_OWNED');assert.equal(blocked.data,undefined);assert.deepEqual(f.core.listSessionViews('B').views,[]);
  const allowed=await f.core.invoke('hallmark_open_component',{componentId:'saved'},{sessionId:'A'});assert.equal(allowed.status,'ok');const id=(allowed.data as any).viewId;assert.ok(f.core.getSessionView('A',id));assert.equal(f.core.getSessionViewData('A',id)?.status,'ok');
  f.store.put('operations','private',{...f.store.get('operations','private'),sessionId:'B'});assert.equal(f.core.getSessionView('A',id),undefined);assert.equal(f.core.getSessionViewData('A',id),undefined);assert.equal(f.remoteCalls.length,0);
 }finally{f.store.close();}
});

test('manage_saved pin requires an explicit entry boolean and never changes component or business data',async()=>{
 const f=setup();try{
  f.presentation.renderView(spec('saved'));const {entry}=f.presentation.saveComponent('saved','保存');const before=f.store.get('components','saved');
  assert.equal((await f.core.invoke('hallmark_manage_saved',{kind:'entry',id:entry.id,action:'pin',pinned:true},{sessionId:'A'})).status,'ok');assert.equal(f.store.get('entries',entry.id)!.pinned,true);
  assert.equal((await f.core.invoke('hallmark_manage_saved',{kind:'entry',id:entry.id,action:'pin'},{sessionId:'A'})).status,'failed');assert.equal(f.store.get('entries',entry.id)!.pinned,true);
  assert.equal((await f.core.invoke('hallmark_manage_saved',{kind:'entry',id:entry.id,action:'pin',pinned:false},{sessionId:'A'})).status,'ok');assert.equal(f.store.get('entries',entry.id)!.pinned,false);assert.deepEqual(f.store.get('components','saved'),before);assert.equal(f.remoteCalls.length,0);
 }finally{f.store.close();}
});
