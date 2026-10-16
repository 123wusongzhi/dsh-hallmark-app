import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

// Production workspace, board, reader and table; only the outer app directory is isolated.
for(const fullDataset of [true,false])test(`workspace returns to a bounded, paused ${fullDataset?'full':'loaded'} data task with its real React search and page intact`,async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workspace-resume-')),entry=join(directory,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
import {WorkbenchBoard,WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
const design=createMaterialView('data-table');design.bindings=[{id:'main',datasetKey:'data',fieldMap:{title:'title'}}];design.widgets[0].columns=[{field:'title',label:'商品'}];design.widgets[0].options={rowsPath:'items',pageSize:10};
const source={id:'source',revision:1,capabilityId:'hallmark.ozon.products',fields:[],parameters:[],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
const instances=Array.from({length:4},(_,index)=>({instanceId:'task-'+index,title:['采购商品','库存快照','经营数据','采集资料'][index],materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}}},position:{order:index}}));
let board={kind:'workbench',workbenchId:'hallmark',appId:'hallmark',revision:1,context:{storeId:'shop-a'},instances,savedComponents:[]};
const requests=[];let tree,session='A',pageVisible=true;
globalThis.fetch=async(url,options)=>{const query=new URL(String(url),'http://fixture').searchParams,resource=query.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body,signal:options?.signal});
 if(body){assert.equal(body.action,'workbench');assert.equal(body.operation,'read','navigation is read-only');const instance=instances.find(row=>row.instanceId===body.params.instanceId);const rows=Array.from({length:24},(_,index)=>({title:uiProduct({},index).title}));return Response.json({instanceId:instance.instanceId,view:{viewId:instance.instanceId,design},dataSources:{main:source},pages:{main:{hasMore:false,loadedCount:rows.length,total:rows.length}},data:{bindings:[{bindingId:'main',datasetId:body.params.context.storeId,query:{input:{loadAll:${fullDataset}}},payload:{items:rows,total:rows.length},state:'ready',lastSuccessAt:'2026-10-15T00:00:00Z',freshness:'fresh',provenance:[]}]}});}
 if(resource==='workbench')return Response.json(query.get('appId')==='notes'?{...board,appId:'notes',instances:[]}:board);if(resource==='stores')return Response.json({stores:[uiStore({id:'shop-a'}),uiStore({id:'shop-b'})]});if(resource==='views')return Response.json({views:[]});throw Error('unexpected resource '+resource);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const draw=()=> <AppsWorkspace currentSessionId={session} usePanelInfo={selector=>selector({activePanelId:pageVisible?'hallmark-apps':'chat'})}/>;
const tab=name=>tree.root.findByProps({'aria-label':'应用工作台与组件标签'}).findAllByType('button').find(node=>text(node)===name);
const home=()=>tree.root.findAllByType(WorkbenchBoard).find(node=>!node.props.detailInstanceId),detail=id=>tree.root.findAllByType(WorkbenchBoard).find(node=>node.props.detailInstanceId===id);
const click=async node=>{assert.ok(node);await act(async()=>{node.props.onClick();await flush();});};
const open=async index=>{await click(tab('工作台'));await click(home().findByProps({'aria-label':'打开'+instances[index].title}));};
const reads=()=>requests.filter(row=>row.body).length;
try{
 await act(async()=>{tree=create(draw());await flush();});assert.equal(reads(),0,'the home catalogue does not load every card');
 await open(0);const first=detail('task-0').findByType(WorkbenchInstanceView);assert.equal(reads(),1);
 await act(async()=>first.findByProps({'aria-label':'搜索当前快照'}).props.onChange({target:{value:'not-a-product'}}));
 await click(tab('工作台'));await click(tab('采购商品'));
 const resumed=detail('task-0').findByType(WorkbenchInstanceView);
 assert.equal(resumed.findByProps({'aria-label':'搜索当前快照'}).props.value,'not-a-product','returning to an open tab must retain its search');assert.equal(reads(),1,'resuming a fresh task must not reread its full snapshot');
 await act(async()=>resumed.findByProps({'aria-label':'搜索当前快照'}).props.onChange({target:{value:''}}));
 await click(resumed.findAllByType('button').find(node=>text(node)==='下一页'));assert.match(text(resumed),/11–20/);
 await open(1);await click(tab('采购商品'));assert.match(text(detail('task-0')),/11–20/,'local page remains selected');
 const beforeHide=reads();pageVisible=false;await act(async()=>{tree.update(draw());await flush();});assert.equal(tree.root.findAllByType(WorkbenchInstanceView).filter(node=>node.props.active!==false).length,0);assert.equal(reads(),beforeHide);pageVisible=true;await act(async()=>{tree.update(draw());await flush();});assert.equal(reads(),beforeHide);
 await open(2);await open(3);assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,3,'only three recently opened data panes stay mounted');assert.ok(tab('库存快照'),'eviction does not close its navigation tab');assert.equal(detail('task-1'),undefined,'least recently used pane is evicted');
 const beforeEvictedOpen=reads();await click(tab('库存快照'));assert.equal(reads(),beforeEvictedOpen+1,'an evicted tab reopens with a fresh reader');assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,3);
 const beforeClose=reads();await click(tree.root.findByProps({'aria-label':'关闭采集资料'}));assert.equal(detail('task-3'),undefined);assert.equal(reads(),beforeClose,'closing a tab does not save or reread');
 // A store switch invalidates transient state while keeping persistent workbench cards.
 board={...board,revision:2,context:{storeId:'shop-b'}};await act(async()=>{window.dispatchEvent(new CustomEvent('apps-workbench-changed',{detail:{appId:'hallmark',board}}));await flush();});
 await click(tab('采购商品'));assert.equal(detail('task-0').findByProps({'aria-label':'搜索当前快照'}).props.value,'');assert.equal(requests.filter(row=>row.body).at(-1).body.params.context.storeId,'shop-b');
 const beforeSession=reads();session='B';await act(async()=>{tree.update(draw());await flush();});assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0,'a new native chat does not inherit another chat’s transient panes');assert.equal(tab('工作台').props['aria-pressed'],true);assert.equal(reads(),beforeSession,'a session switch does not read another chat’s previously selected task');
 await open(0);const beforeApp=reads();await click(tree.root.findByProps({'data-switch-app':'notes'}));assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0);assert.equal(tab('采购商品'),undefined,'app switch drops another app’s task tabs');assert.equal(reads(),beforeApp);
 assert.ok(requests.filter(row=>row.body).every(row=>row.body.operation==='read'));console.log('WORKSPACE_RESUME_PASS');
}finally{if(tree)await act(async()=>tree.unmount());}
`},plugins:[{name:'directory-isolation',setup(builder){builder.onLoad({filter:/[\\/]plugin-apps[\\/]client[\\/]directory\.tsx$/},()=>({contents:"export function AppsDirectory(p){return <div><button data-switch-app='notes' onClick={()=>p.onAppChange('notes')}>笔记应用</button>{p.navigation}{p.children}</div>}",loader:'tsx'}));}}],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKSPACE_RESUME_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'workspace-resume-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});

test('paused data tasks cancel timers and reads, preserve selection, resume the same query and reject stale owners',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workspace-paused-')),entry=join(directory,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const timers=new Map();let nextTimer=0;const now=Date.now();
globalThis.setTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const design=createMaterialView('product-browser');
const fields=[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true},{role:'price.current',path:'price',confirmed:true,currency:'CNY'},{role:'sku.id',path:'sku',confirmed:true},{role:'sku.specification',path:'specification',confirmed:true}];
for(const widget of design.widgets){widget.fields=Object.fromEntries(fields.map(field=>[field.role,field.path]));widget.options={...widget.options,rowsPath:'items'};}
const instance={instanceId:'product-browser',title:'商品浏览',materialId:'product-browser',materialVersion:1,design,dataSources:{products:{id:'products',revision:1,params:{}},sku:{id:'sku',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,capabilityId:'products',fields,parameters:[{name:'productId',label:'商品',type:'string'}],rowsPath:'items',operations:{search:{scope:'server',param:'query'},sort:{scope:'loaded'},pagination:{cursorParam:'cursor'}}};
let tree,active=true,storeId='shop-a',hold=false,deny=false;const requests=[],releases=[];
const result=params=>({instanceId:instance.instanceId,view:{viewId:storeId,design},dataSources:{products:source,sku:{...source,id:'sku'}},pages:{products:{hasMore:false,loadedCount:1},sku:{hasMore:false,loadedCount:1}},data:{bindings:['products','sku'].map(bindingId=>({bindingId,datasetId:params.context.storeId+'-'+bindingId,query:{input:params.params??{}},payload:{items:[uiProduct({id:params.context.storeId+'-product',name:uiProduct({},params.context.storeId==='shop-a'?7:40).title,specification:'recorded-sku'},params.context.storeId==='shop-a'?7:40)],cache:{fetchedAt:new Date(now).toISOString(),nextRefreshAt:new Date(now+900000).toISOString(),stale:false,refreshing:false}},state:'ready',lastSuccessAt:new Date(now).toISOString(),freshness:'fresh',provenance:[]}))}});
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body),response=result(body.params),reject=deny;requests.push({body,signal:options.signal});if(hold)await new Promise(resolve=>releases.push(resolve));return reject?Response.json({error:{code:'ACCESS_DENIED',message:'当前店铺无读取权限'}},{status:403}):Response.json(response);};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const draw=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId}} active={active}/>;
const render=async()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const interactions=()=>tree.root.findByType(ViewRenderer).props.interactions;
const query=async value=>act(async()=>{interactions().bindings.products.onQueryChange({search:value});await flush();});
try{
 await render();assert.equal(requests.length,1);assert.equal(timers.size,1);
 const row=tree.root.findAllByType('tr').find(node=>node.props.className==='hm-material-selectable');await act(async()=>{row.props.onClick();await flush();});assert.equal(interactions().selectedByWidget.products,'shop-a-product');assert.equal(interactions().bindings.sku.selectedProductId,'shop-a-product');
 const beforeHide=requests.length;active=false;await render();assert.equal(timers.size,0,'hidden tasks have no refresh timer');assert.equal(requests.length,beforeHide);assert.equal(interactions().selectedByWidget.products,'shop-a-product');
 // Stale hidden handlers cannot start requests, even if called programmatically.
 await query('hidden-query');assert.equal(requests.length,beforeHide);active=true;await render();assert.equal(requests.length,beforeHide);assert.equal(timers.size,1);assert.equal(interactions().selectedByWidget.products,'shop-a-product');
 hold=true;await query('resume-query');const pending=requests.at(-1);assert.equal(pending.body.params.params.query,'resume-query');active=false;await render();assert.equal(pending.signal.aborted,true);assert.equal(timers.size,0);
 await act(async()=>{releases.shift()();await flush();});assert.notEqual(interactions().bindings.products.appliedSearch,'resume-query','a late aborted response cannot change a hidden task');
 hold=false;const beforeResume=requests.length;active=true;await render();assert.equal(requests.length,beforeResume+1);assert.equal(requests.at(-1).body.params.params.query,'resume-query');assert.equal(interactions().bindings.products.appliedSearch,'resume-query');
 // A different store drops the suspended query and selection before any new read.
 hold=true;await query('private-shop-a');const stale=requests.at(-1);active=false;await render();storeId='shop-b';await render();assert.equal(tree.root.findAllByType(ViewRenderer).length,0,'old store rows are removed while inactive');const beforeNewOwner=requests.length;hold=false;deny=true;active=true;await render();assert.equal(requests.length,beforeNewOwner+1);assert.equal(requests.at(-1).body.params.params,undefined);assert.equal(stale.signal.aborted,true);assert.match(text(tree.root),/当前店铺无读取权限/);assert.equal(tree.root.findAllByType(ViewRenderer).length,0,'permission failure cannot reuse old data');
 await act(async()=>{releases.shift()();await flush();});assert.match(text(tree.root),/当前店铺无读取权限/);assert.equal(tree.root.findAllByType(ViewRenderer).length,0);assert.equal(timers.size,0,'permission failures do not auto retry');
 await act(async()=>tree.unmount());tree=undefined;assert.equal(timers.size,0);assert.ok(requests.every(row=>row.body.operation==='read'));console.log('WORKSPACE_PAUSED_READS_PASS');
}finally{for(const release of releases)release();if(tree)await act(async()=>tree.unmount());}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKSPACE_PAUSED_READS_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'workspace-paused-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
