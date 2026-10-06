import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import {createAppServer} from '../../packages/service/src/server.ts';
import {inspectSourceProject} from '../../packages/source-components/src/index.ts';
import {executeUI} from '../../packages/service/src/ui.ts';

function setup(t:any){
 const directory=mkdtempSync(join(tmpdir(),'hallmark-source-')),project=join(directory,'project'),sources=join(directory,'sources');
 mkdirSync(join(project,'dist','assets'),{recursive:true});mkdirSync(join(project,'src'));
 writeFileSync(join(project,'package.json'),JSON.stringify({name:'sample',dependencies:{react:'18.3.1'}}));writeFileSync(join(project,'package-lock.json'),'{}');
 writeFileSync(join(project,'component.json'),JSON.stringify({title:'彩色商品',bindings:[{id:'products',datasetKey:'collected:test',fieldMap:{}}]}));
 writeFileSync(join(project,'src','Component.tsx'),'export default () => <div>自由源码</div>;');writeFileSync(join(project,'dist','index.html'),'<script type="module" src="./assets/a.js"></script>');writeFileSync(join(project,'dist','assets','a.js'),'document.body.textContent="真实产物";');
 const store=new AppStore(join(directory,'app.db'));t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 const presentation=new PresentationManager(store,{sourceDirectory:sources});store.put('session_apps','A',{appId:'hallmark',active:true});store.put('session_apps','B',{appId:'hallmark',active:true});
 const unavailable=async()=>({status:'unavailable' as const}),client:any={getStores:unavailable,getStoreProducts:unavailable,syncStoreProducts:unavailable,getTargetMargin:unavailable,searchCollectedItems:unavailable,getCollectedItem:unavailable},broker:any={getStoreTask:unavailable,getListingTask:unavailable,requestId:()=>''};
 const core=new AppCore({store,presentation,client,broker});return {directory,project,sources,store,presentation,core,client,broker};
}

test('source captures TSX, arbitrary CSS/assets and exact dist as immutable content; only registered assets are served',t=>{
 const f=setup(t),view=f.presentation.openSourceComponent(f.project),build=view.source.buildId;
 assert.equal(view.widgets.length,0);assert.equal(view.kind,'source');assert.equal(f.presentation.sources.readFile(build,'assets/a.js')?.mime,'text/javascript; charset=utf-8');
 writeFileSync(join(f.project,'dist','assets','a.js'),'changed');assert.equal(f.presentation.sources.readFile(build,'assets/a.js')?.bytes.toString(),'document.body.textContent="真实产物";');
 assert.equal(f.presentation.sources.readFile(build,'../src/Component.tsx'),undefined);assert.equal(f.presentation.sources.readFile(build,'missing.js'),undefined);
 const changed=f.presentation.openSourceComponent(f.project);assert.notEqual(changed.source.buildId,build);
 const restored=f.presentation.sources.checkout(view.source);assert.equal(readFileSync(join(restored.directory,'src','Component.tsx'),'utf8'),'export default () => <div>自由源码</div>;');assert.equal(readFileSync(join(restored.directory,'package-lock.json'),'utf8'),'{}');
 assert.throws(()=>f.presentation.sources.checkout(view.source,restored.directory),{code:'SOURCE_DIRECTORY_NOT_EMPTY'});
});

test('matching screenshot reports are archived outside the build hash; stale preview cannot label a new build',t=>{
 const f=setup(t),view=f.presentation.openSourceComponent(f.project),build=view.source.buildId;mkdirSync(join(f.project,'.preview'));
 writeFileSync(join(f.project,'.preview','latest.png'),Buffer.from([137,80,78,71]));writeFileSync(join(f.project,'.preview','latest.json'),JSON.stringify({buildId:build,viewport:{width:420,height:900},capturedAt:'2026-10-06T00:00:00Z'}));
 assert.equal(inspectSourceProject(f.project).buildId,build);
 const saved=f.presentation.saveComponent(view.id,'保存已验证的源码').component;assert.equal(saved.spec.source?.preview?.width,420);assert.deepEqual(readFileSync(saved.spec.source!.thumbnail!),Buffer.from([137,80,78,71]));
 writeFileSync(join(f.project,'src','Component.tsx'),'changed after preview');assert.equal(f.presentation.openSourceComponent(f.project).source.preview,undefined);
});

test('source draft and removed-owner tombstone survive a manager/core restart; data fields are delivered unchanged',async t=>{
 const f=setup(t);f.store.updateSnapshotSuccess('collected:test',{items:[{id:'product',profit:{actualMargin:.3},arbitrary:{label:'真实'}}]},null);
 const result=await f.core.invoke('hallmark_open_source_component',{directory:f.project},{sessionId:'A'});assert.equal(result.status,'ok');const id=(result.data as any).viewId;
 const presentation=new PresentationManager(f.store,{sourceDirectory:f.sources}),core=new AppCore({...f,presentation});assert.equal(core.listSessionViews('A').views.length,1);assert.equal(core.getSessionView('B',id),undefined);
 assert.equal((core.getSessionViewData('A',id)?.data as any).bindings[0].payload.items[0].profit.actualMargin,.3);
 assert.equal((await core.invoke('hallmark_open_source_component',{directory:f.project,viewId:id},{sessionId:'B'})).error?.code,'VIEW_NOT_OWNED');
 core.manageSessionView('A',id,{action:'remove'});const restarted=new AppCore({...f,presentation:new PresentationManager(f.store,{sourceDirectory:f.sources})});assert.equal(restarted.listSessionViews('A').views.length,0);assert.equal(restarted.getSessionView('A',id),undefined);
 assert.equal(f.store.list('components').length,0);
});

test('failed first query load still opens the source draft and a later explicit refresh recovers data',async t=>{
 const f=setup(t),opened=await f.core.invoke('hallmark_open_source_component',{directory:f.project,bindings:[{id:'collected',query:{tool:'hallmark_search_collected_items',params:{limit:2}},fieldMap:{}}]},{sessionId:'A'});
 assert.equal(opened.status,'ok');const {spec,initialData}=opened.data as any;assert.equal(initialData[0].status,'unavailable');assert.ok(f.core.getSessionView('A',spec.id));assert.equal(f.core.getSessionViewData('A',spec.id)?.error?.code,'SNAPSHOT_EMPTY');
 f.client.searchCollectedItems=async()=>({status:'ok',raw:[{id:'recovered',title:'恢复的数据'}]});
 assert.equal((await f.core.refreshDataset(spec.bindings[0].datasetKey,{sessionId:'A'})).status,'ok');assert.equal(f.core.getSessionViewData('A',spec.id)?.status,'ok');assert.equal(f.core.getSessionView('A',spec.id)?.source?.buildId,spec.source.buildId);assert.equal(f.store.list('components').length,0);
});

test('source saved versions, templates, CAS updates and rollback produce reproducible editable projects',t=>{
 const f=setup(t),v1=f.presentation.openSourceComponent(f.project),saved=f.presentation.saveComponent(v1.id,'保存源码','版本一',{mode:'save_as'}).component;
 const template=f.presentation.saveTemplate(v1.id,'产品模板','保存模板');assert.equal(template.kind,'source');
 const based=f.presentation.renderFromTemplate(template.id,'另一个设计',[]);assert.equal(based.kind,'source');assert.notEqual(based.source?.directory,f.project);assert.equal(based.source?.buildId,v1.source.buildId);
 const draft=f.presentation.openComponent(saved.id);writeFileSync(join(draft.spec.source!.directory,'src','Component.tsx'),'export default () => <div>版本二</div>;');
 const v2=f.presentation.openSourceComponent(draft.spec.source!.directory,{viewId:draft.spec.id});const saved2=f.presentation.saveComponent(v2.id,'更新组件','版本二',{mode:'update',componentId:saved.id,expectedRevision:draft.baseRevision}).component;
 assert.equal(saved2.revision,2);assert.equal(saved2.revisions?.length,2);assert.throws(()=>f.presentation.saveComponent(v2.id,'再次更新',undefined,{mode:'update',componentId:saved.id,expectedRevision:1}),{code:'COMPONENT_CONFLICT'});
 const rollback=f.presentation.openComponent(saved.id,{revision:1});assert.equal(rollback.baseRevision,2);assert.equal(rollback.spec.source?.buildId,v1.source.buildId);
 const reverted=f.presentation.saveComponent(rollback.spec.id,'恢复版本一',undefined,{mode:'update',componentId:saved.id,expectedRevision:rollback.baseRevision}).component;
 assert.equal(reverted.revision,3);assert.equal(reverted.revisions?.length,3);assert.equal(reverted.spec.source?.buildId,v1.source.buildId);assert.equal(f.presentation.openComponent(saved.id,{revision:2}).spec.source?.buildId,v2.source.buildId);
 f.presentation.updateView(saved.id,[{op:'replace',path:'/title',value:'未发布草稿'}]);f.presentation.manageSaved('component',saved.id,{action:'rename',name:'库中名称'});
 const reloaded=new PresentationManager(f.store,{sourceDirectory:f.sources});assert.equal(reloaded.getView(saved.id)?.title,'库中名称');assert.equal(reloaded.openComponent(saved.id,{revision:3}).spec.title,'版本一');
 f.presentation.manageSaved('component',saved.id,{action:'delete'});assert.throws(()=>f.presentation.openComponent(saved.id),{code:'SAVED_NOT_FOUND'});assert.equal(f.presentation.sources.manifest(v1.source.buildId)?.buildId,v1.source.buildId);
});

test('source template UI opens a complete independent editable project and metadata-only updates retain its bindings',async t=>{
 const f=setup(t),source=f.presentation.openSourceComponent(f.project),template=f.presentation.saveTemplate(source.id,'独立源码模板','保存模板'),directory=join(f.directory,'new-project');
 const result=await executeUI('/ui/open-template','POST',{templateId:template.id,directory},f.presentation,f.store) as any;
 assert.equal(result.spec.source.directory,directory);assert.equal(readFileSync(join(directory,'package-lock.json'),'utf8'),'{}');
 const updated=f.presentation.openSourceComponent(directory,{viewId:result.spec.id,title:'重新构建'});assert.deepEqual(updated.bindings,result.spec.bindings);
});

test('trusted local migration recovers legacy session views and shared saved IDs without activating chat',async t=>{
 const f=setup(t),legacy={id:'old-view',title:'旧组件',layout:{type:'column' as const,children:['text']},widgets:[{id:'text',type:'text' as const,text:'旧内容'}],bindings:[]};
 f.presentation.renderView(legacy);f.presentation.saveComponent(legacy.id,'旧库保存');f.store.put('session_apps','A',{appId:'hallmark',active:false});
 f.core.restoreSessionView('A',legacy);const restarted=new AppCore({...f,presentation:new PresentationManager(f.store,{sourceDirectory:f.sources})});assert.equal(restarted.getSessionView('A',legacy.id)?.title,'旧组件');assert.equal(f.store.get('session_apps','A')?.active,false);assert.equal(f.store.list('components').length,1);
 assert.throws(()=>restarted.restoreSessionView('B',legacy),{code:'VIEW_NOT_OWNED'});
});

test('authenticated source HTTP returns identical HTML/JS bytes and content types; unavailable files fail',async t=>{
 const f=setup(t),view=f.presentation.openSourceComponent(f.project),token='a'.repeat(64),server=createAppServer({...f,token,health:async()=>({status:'ok'})});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>{server.closeAllConnections();server.close(()=>resolve());}));
 const base=`http://127.0.0.1:${(server.address() as any).port}/source-builds/${view.source.buildId}`,headers={authorization:`Bearer ${token}`};
 assert.equal((await fetch(`${base}/manifest`)).status,401);
 const manifest=await (await fetch(`${base}/manifest`,{headers})).json() as any;assert.deepEqual(manifest.files,['assets/a.js','index.html']);
 const response=await fetch(`${base}/files/assets/a.js`,{headers});assert.equal(response.headers.get('content-type'),'text/javascript; charset=utf-8');assert.equal(await response.text(),readFileSync(join(f.project,'dist','assets','a.js'),'utf8'));
 assert.equal((await fetch(`${base}/files/package.json`,{headers})).status,404);
});
