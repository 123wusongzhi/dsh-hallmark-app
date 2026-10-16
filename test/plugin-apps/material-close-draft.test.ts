import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
const REPO_ROOT=fileURLToPath(new URL('../..',import.meta.url));

// Real workspace/material components; transport outcomes and schema-only rows are local controls.
async function fixture(body:string,prepare=''){
 const root=resolve(REPO_ROOT,'.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'material-close-')),entry=join(directory,'fixture.mjs');let passed=false;
 try{
  await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:setup+prepare+`
try{await act(async()=>{tree=create(draw());});await settle();
`+body+`
assert.equal(confirmations,0,'never call a global confirmation');}finally{if(tree)await act(async()=>tree.unmount());}`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','react-test-renderer'],outfile:entry,logLevel:'silent'});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000,cwd:REPO_ROOT,windowsHide:true});writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');assert.equal(result.status,0,(result.stdout??'')+(result.stderr??'')+'\nFixture retained at '+directory);passed=true;
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'material-close-'));if(passed)rmSync(directory,{recursive:true,force:true,maxRetries:3});}
}
const setup=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {AppsDirectory} from './packages/plugin-apps/client/directory.tsx';
import {ModuleConfig,configuredColumns} from './packages/plugin-apps/client/module-config.tsx';
import {MATERIAL_CATALOG,createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.window=new EventTarget();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let confirmations=0;globalThis.confirm=window.confirm=()=>{confirmations++;return false;};
const source={id:'source-a',kind:'data_source',revision:1,title:'Audit source',appId:'hallmark',connectionId:'audit',capabilityId:'audit.table',input:{},parameters:[],fields:[{key:'name',role:'product.name',confirmed:true,path:'name',label:'名称'},{key:'price',role:'price.current',confirmed:true,path:'price',label:'价格'},{key:'sku',role:'sku.id',confirmed:true,path:'sku',label:'SKU'}],rowsPath:'rows',operations:{search:{scope:'local'},sort:{scope:'local'},pagination:{mode:'none'}},validation:{status:'valid',issues:[]}};
const design=createMaterialView('data-table'); design.widgets[0].columns=[{field:'name',label:'名称'},{field:'price',label:'价格'}];
let board={kind:'workbench',workbenchId:'audit-board',appId:'hallmark',revision:1,instances:[{instanceId:'existing',title:'已保存组件',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source-a',revision:1,params:{}}},position:{order:0,span:12}}],savedComponents:[],updatedAt:'2026-10-16T00:00:00Z'};
let calls=[],tree,visible=true,session='audit-session',holdSave=false,releaseSave,failSave=false,holdCatalog=false,holdPreview=false,normalizeSaved=false,delaySources=false,releaseSources;
const snapshot=instance=>({instanceId:instance.instanceId,view:{viewId:instance.instanceId,ownerSessionId:null,title:instance.title,design:instance.design,bindings:[]},data:{viewId:instance.instanceId,bindings:[]},dataSources:{main:source},pages:{}});
globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;calls.push({resource,body});let value;
if(resource==='dataSources'&&delaySources)await new Promise(resolve=>releaseSources=resolve);
if(holdCatalog&&['dataSources','materials'].includes(resource))return new Promise(()=>{});
if(body){assert.equal(body.action,'workbench');if(body.operation==='read')value=snapshot(board.instances.find(x=>x.instanceId===body.params.instanceId));else if(body.operation==='preview'){if(holdPreview)return new Promise(()=>{});value=snapshot(body.params.instance);}else if(body.operation==='save'){if(holdSave)await new Promise(resolve=>releaseSave=resolve);if(failSave)return Response.json({status:'failed',error:{message:'audit revision conflict'}},{status:409});const instances=structuredClone(body.params.instances);if(normalizeSaved){for(const instance of instances)for(const ref of Object.values(instance.dataSources??{}))if(ref.draft){delete ref.draft;ref.revision++;source.revision=ref.revision;}}board={...board,instances,revision:board.revision+1};value=board;}else throw Error('Unexpected mutation '+JSON.stringify(body));}
else if(resource==='apps')value={apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'},{appId:'notes',displayName:'Notes',runtimeState:'ready',hostProjectionState:'ready'}]};else if(resource==='connectionStatus')value={state:'connected',node:{state:'healthy'},data:{message:'isolated'},checkedAt:'2026-10-16T00:00:00Z',canRestart:false};else if(resource==='businessSettings')value={connections:[],stores:[],pricing:null};else if(resource==='workbench')value=new URL(String(url),'http://fixture').searchParams.get('appId')==='notes'?{...board,appId:'notes',instances:[]}:board;else if(resource==='stores')value={stores:[]};else if(resource==='views')value={views:[]};else if(resource==='connections'||resource==='bindings')value=[];else if(resource==='diagnostics')value={invocations:[]};else if(resource==='saved')value={components:[],assets:[]};else if(resource==='materials')value={materials:MATERIAL_CATALOG};else if(resource==='dataSources')value={dataSources:[source]};else throw Error('Unexpected resource '+resource);
return Response.json(value);};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const buttons=()=>tree.root.findAllByType('button'),button=t=>buttons().find(n=>text(n).trim()===t),label=l=>buttons().find(n=>n.props['aria-label']===l),input=l=>tree.root.findAllByType('input').find(n=>n.props['aria-label']===l),lib=()=>tree.root.findByType(MaterialLibrary),config=()=>tree.root.findByType(ModuleConfig),columns=()=>configuredColumns(config().props.spec.widgets[0]);
const settle=()=>act(async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));});
const click=async n=>{assert.ok(n,'button exists');assert.ok(!n.props.disabled,'button enabled '+text(n));await act(async()=>n.props.onClick());await settle();};
const change=async(n,value)=>{await act(async()=>n.props.onChange({target:{value}}));await settle();};
const draw=()=>React.createElement(AppsWorkspace,{currentSessionId:session,usePanelInfo:selector=>selector({activePanelId:visible?'hallmark-apps':'chat'})});

const mounted=()=>tree.root.findAllByType(MaterialLibrary).length===1;
const prompt=()=>tree.root.findAllByProps({'aria-label':'确认关闭素材库'}).length===1;
const writes=()=>calls.filter(c=>c.body?.operation==='save').length;
`;

test('material close preserves meaningful configuration until explicit discard and invalidates stale confirmation',()=>fixture(`
await click(button('配置'));await click(button('调整显示'));await click(label('重命名名称'));await change(input('名称显示名称'),'手工列名');await click(buttons().find(n=>n.props['aria-label']?.endsWith('紧凑')));await click(button('完成'));await change(input('工作台组件名称'),'未保存配置');
await click(button('工作台'));await click(button('素材库'));assert.equal(input('工作台组件名称').props.value,'未保存配置');
visible=false;await act(async()=>tree.update(draw()));visible=true;await act(async()=>tree.update(draw()));assert.equal(input('工作台组件名称').props.value,'未保存配置');
await click(label('关闭素材库'));assert.ok(mounted());assert.ok(prompt());assert.equal(writes(),0);const stale=button('放弃并关闭').props.onClick;
await click(button('继续编辑'));assert.ok(!prompt());await act(async()=>stale());assert.ok(mounted());assert.equal(input('工作台组件名称').props.value,'未保存配置');
await click(label('关闭素材库'));const beforeEdit=button('放弃并关闭').props.onClick;await change(input('工作台组件名称'),'继续编辑');await act(async()=>beforeEdit());assert.ok(mounted());assert.ok(!prompt());
await click(label('关闭素材库'));const beforeNav=button('放弃并关闭').props.onClick;await click(button('工作台'));await act(async()=>beforeNav());assert.ok(mounted());await click(button('素材库'));assert.ok(!prompt());
await click(label('关闭素材库'));const beforeSession=button('放弃并关闭').props.onClick;session='other-session';await act(async()=>tree.update(draw()));await act(async()=>beforeSession());assert.ok(mounted());session='audit-session';await act(async()=>tree.update(draw()));
await click(label('关闭素材库'));await click(button('放弃并关闭'));assert.ok(!mounted());assert.equal(writes(),0);await click(button('配置'));assert.equal(input('工作台组件名称').props.value,'已保存组件');await click(button('调整显示'));assert.equal(columns()[0].label,'名称');assert.equal(config().props.spec.widgets[0].options.density,'comfortable');
`));

test('material close ignores pristine browsing, effective net-zero edits, cancelled fields and confirmed saves',()=>fixture(`
await click(button('添加组件'));await click(label('选择数据表'));await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(writes(),0);
await click(button('配置'));await click(button('调整显示'));await click(label('重命名名称'));await change(input('名称显示名称'),'临时');await change(input('名称显示名称'),'名称');await click(buttons().find(n=>n.props['aria-label']?.endsWith('紧凑')));await click(buttons().find(n=>n.props['aria-label']?.endsWith('舒适')));await click(label('显示价格'));await click(label('显示价格'));await click(label('下移名称'));await click(label('上移名称'));await click(button('添加信息'));await click(label('添加SKU'));await click(button('取消'));assert.deepEqual(columns().map(c=>c.field),['name','price']);await click(label('关闭素材库'));assert.ok(!mounted());
await click(button('配置'));await click(button('调整显示'));await click(button('添加信息'));await click(label('添加SKU'));await click(button('应用并预览'));assert.deepEqual(columns().map(c=>c.field),['name','price','sku']);await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));await click(button('完成'));await change(input('工作台组件名称'),' 已确认保存 ');await click(button('保存配置'));assert.equal(writes(),1);assert.equal(board.instances[0].title,'已确认保存');await click(label('关闭素材库'));assert.ok(!mounted());await click(button('配置'));assert.equal(input('工作台组件名称').props.value,'已确认保存');await click(button('调整显示'));assert.deepEqual(columns().map(c=>c.field),['name','price','sku']);await click(label('关闭素材库'));assert.ok(!mounted());
`));

test('pending material save blocks only close, keeps errors and retains edits newer than the saved request',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'请求中名称');holdSave=true;await click(button('保存配置'));assert.ok(releaseSave);assert.equal(label('关闭素材库').props.disabled,true);await act(async()=>label('关闭素材库').props.onClick());await settle();assert.ok(mounted());assert.ok(!prompt());
await click(button('工作台'));assert.ok(mounted());await click(button('素材库'));await change(input('工作台组件名称'),'请求后继续编辑');await act(async()=>releaseSave());await settle();assert.equal(board.instances[0].title,'请求中名称');assert.equal(label('关闭素材库').props.disabled,false);await click(button('素材库'));assert.equal(input('工作台组件名称').props.value,'请求后继续编辑');await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));
failSave=true;releaseSave=undefined;await click(button('保存配置'));assert.ok(releaseSave);await act(async()=>releaseSave());await settle();assert.ok(mounted());assert.ok(JSON.stringify(tree.toJSON()).includes('audit revision conflict'));assert.equal(input('工作台组件名称').props.value,'请求后继续编辑');assert.equal(label('关闭素材库').props.disabled,false);await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));
failSave=false;holdSave=false;await click(button('保存配置'));await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(board.instances[0].title,'请求后继续编辑');assert.equal(writes(),3);
`));

test('pending material catalog and preview reads never lock closing or erase dirty content',()=>fixture(`
holdCatalog=true;await click(button('配置'));assert.ok(buttons().filter(n=>n.props.className==='apps-app-row').every(n=>!n.props.disabled));assert.equal(!!label('关闭素材库').props.disabled,false);await click(label('关闭素材库'));assert.ok(!mounted());
await click(button('配置'));await change(input('工作台组件名称'),'目录未就绪的修改');await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));assert.equal(input('工作台组件名称').props.value,'目录未就绪的修改');await click(label('关闭素材库'));await click(button('放弃并关闭'));assert.ok(!mounted());
holdCatalog=false;holdPreview=true;await click(button('配置'));assert.equal(button('保存配置').props.disabled,true);await change(input('工作台组件名称'),'预览未就绪的修改');await click(label('关闭素材库'));assert.ok(prompt());await click(button('放弃并关闭'));assert.ok(!mounted());assert.equal(writes(),0);
`));

test('new template edits are protected without requiring a saveable source',()=>fixture(`
await click(button('添加组件'));await click(label('选择数据表'));await change(input('工作台组件名称'),'新组件草稿');assert.equal(button('添加到工作台').props.disabled,true);await click(button('调整显示'));await click(buttons().find(n=>n.props['aria-label']?.endsWith('紧凑')));await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));assert.equal(config().props.spec.widgets[0].options.density,'compact');await click(label('关闭素材库'));await click(button('放弃并关闭'));assert.ok(!mounted());assert.equal(writes(),0);
`));

test('hidden material close prompt is visible without stealing the active task, and old target actions expire',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'隐藏草稿');await click(button('工作台'));await click(label('关闭素材库'));assert.ok(prompt());const group=tree.root.findByProps({'aria-label':'确认关闭素材库'});for(let node=group;node;node=node.parent)assert.notEqual(node.props.hidden,true,'prompt must be visible outside hidden editor');
assert.equal(button('工作台').props['aria-pressed'],true);await click(button('继续编辑'));assert.equal(button('工作台').props['aria-pressed'],true);assert.equal(input('工作台组件名称').props.value,'隐藏草稿');
await click(label('关闭素材库'));const old=button('放弃并关闭').props.onClick;await click(button('添加组件'));assert.ok(mounted());await act(async()=>old());assert.ok(mounted());assert.ok(!prompt());assert.notEqual(input('工作台组件名称').props.value,'隐藏草稿');
await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(button('工作台').props['aria-pressed'],true);
`));

test('save receipt registration is reconciled against the request without overwriting later user edits',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'请求快照名称');holdSave=true;await click(button('保存配置'));assert.ok(releaseSave);const request=calls.find(c=>c.body?.operation==='save').body.params.instances[0];assert.ok(request.dataSources.main.draft);assert.equal(request.dataSources.main.revision,1);
await change(input('工作台组件名称'),'请求后名称');await click(button('调整显示'));await click(label('重命名名称'));await change(input('名称显示名称'),'请求后列名');await act(async()=>releaseSave());await settle();assert.equal(board.instances[0].title,'请求快照名称');assert.equal(board.instances[0].dataSources.main.draft,undefined);assert.equal(board.instances[0].dataSources.main.revision,2);
await click(button('素材库'));assert.equal(columns()[0].label,'请求后列名');assert.equal(tree.root.findByType(WorkbenchInstanceView).props.instance.dataSources.main.draft,undefined);assert.equal(tree.root.findByType(WorkbenchInstanceView).props.instance.dataSources.main.revision,2);await click(button('完成'));assert.equal(input('工作台组件名称').props.value,'请求后名称');await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));
holdSave=false;await click(button('保存配置'));await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(board.instances[0].title,'请求后名称');assert.equal(configuredColumns(board.instances[0].design.widgets[0])[0].label,'请求后列名');
`, `const {kind,revision,validation,...definition}=source;board.instances[0].dataSources.main.draft=definition;normalizeSaved=true;`));

test('automatic composition defaults do not make a reverted user edit dirty',()=>fixture(`
delaySources=true;await click(button('添加组件'));assert.ok(releaseSources);const originalTitle=input('工作台组件名称').props.value;await change(input('工作台组件名称'),'临时人工编辑');await act(async()=>releaseSources());await settle();await click(button('调整显示'));assert.equal(config().props.sources.main.capabilityId,'hallmark.ozon.compose');await click(button('完成'));await change(input('工作台组件名称'),originalTitle);await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(writes(),0);
`, `source.capabilityId='hallmark.ozon.products';`));

test('pending save cannot be unloaded by configuring another target or switching app',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'等待回执');holdSave=true;await click(button('保存配置'));await click(button('工作台'));await click(button('添加组件'));assert.equal(input('工作台组件名称').props.value,'等待回执');assert.equal(lib().props.initial.instanceId,'existing');const notes=buttons().find(n=>n.props.className==='apps-app-row'&&text(n).startsWith('Notes'));assert.equal(notes.props.disabled,true);await act(async()=>notes.props.onClick());assert.equal(lib().props.appId,'hallmark');assert.equal(label('关闭素材库').props.disabled,true);failSave=true;await act(async()=>releaseSave());await settle();await click(button('素材库'));assert.equal(input('工作台组件名称').props.value,'等待回执');assert.ok(JSON.stringify(tree.toJSON()).includes('audit revision conflict'));assert.equal(label('关闭素材库').props.disabled,false);assert.equal(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Hallmark')).props['aria-pressed'],true);assert.equal(lib().props.appId,'hallmark');
`));

test('restoring an effective default query value is a clean configuration',()=>fixture(`
await click(button('配置'));await change(input('每次数量'),'6');await change(input('每次数量'),'5');await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(writes(),0);
`, `source.parameters=[{name:'count',label:'每次数量',type:'integer',default:5}];`));

test('registered save is clean and a newly added copy preserves later edits without treating its fresh ID as dirty',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'注册保存');await click(button('保存配置'));assert.equal(board.instances[0].dataSources.main.draft,undefined);assert.equal(board.instances[0].dataSources.main.revision,2);await click(label('关闭素材库'));assert.ok(!mounted());
await click(button('添加组件'));await click(label('选择数据表'));await change(tree.root.findAllByType('select').find(n=>n.props['aria-label']?.endsWith('数据来源')),'source-a');await change(input('工作台组件名称'),'新增请求快照');holdSave=true;releaseSave=undefined;await click(button('添加到工作台'));assert.ok(releaseSave);await change(input('工作台组件名称'),'新增后续编辑');await act(async()=>releaseSave());await settle();assert.equal(board.instances.length,2);assert.equal(board.instances[1].title,'新增请求快照');await click(button('素材库'));assert.equal(input('工作台组件名称').props.value,'新增后续编辑');await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));await change(input('工作台组件名称'),'新增请求快照');await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(writes(),2);
`, `const {kind,revision,validation,...definition}=source;board.instances[0].dataSources.main.draft=definition;normalizeSaved=true;`));

test('a delayed add receipt cannot dirty a different new template selected while saving',()=>fixture(`
await click(button('添加组件'));await click(label('选择数据表'));await change(tree.root.findAllByType('select').find(n=>n.props['aria-label']?.endsWith('数据来源')),'source-a');holdSave=true;await click(button('添加到工作台'));assert.ok(releaseSave);await click(label('选择商品列表'));const title=input('工作台组件名称').props.value;await act(async()=>releaseSave());await settle();await click(button('素材库'));assert.equal(input('工作台组件名称').props.value,title);await click(label('关闭素材库'));assert.ok(!mounted());assert.equal(board.instances.length,2);assert.equal(writes(),1);
`));

test('a material save receipt updates metadata without stealing the settings page or hidden application',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'后台保存名称');holdSave=true;await click(button('保存配置'));await click(button('经营设置'));assert.equal(button('经营设置').props['aria-pressed'],true);await act(async()=>releaseSave());await settle();assert.equal(board.instances[0].title,'后台保存名称');assert.equal(button('经营设置').props['aria-pressed'],true);assert.equal(lib().props.currentWorkbench.instances[0].title,'后台保存名称');
await click(button('素材库'));await change(input('工作台组件名称'),'隐藏期间保存');releaseSave=undefined;await click(button('保存配置'));visible=false;await act(async()=>tree.update(draw()));await act(async()=>releaseSave());await settle();visible=true;await act(async()=>tree.update(draw()));assert.equal(button('素材库').props['aria-pressed'],true);assert.equal(board.instances[0].title,'隐藏期间保存');
`));

test('stale material completion cannot navigate a new editor or inject another app board',()=>fixture(`
await click(button('配置'));const old=lib().props.onComplete;await click(button('工作台'));await click(button('添加组件'));const title=input('工作台组件名称').props.value;const saved={...board.instances[0],title:'旧编辑器回执'};await act(async()=>old(saved,{...board,revision:board.revision+1,instances:[saved]}));assert.equal(button('素材库').props['aria-pressed'],true);assert.equal(input('工作台组件名称').props.value,title);assert.equal(lib().props.currentWorkbench.instances[0].title,'旧编辑器回执');
await click(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Notes')));assert.equal(lib().props.appId,'notes');await act(async()=>old(saved,{...board,revision:99,instances:[saved]}));assert.equal(lib().props.appId,'notes');assert.equal(lib().props.currentWorkbench.appId,'notes');assert.equal(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Notes')).props['aria-pressed'],true);
`));


test('pending save retains its newer draft and keeps app selection aligned until the receipt settles',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'请求中的配置');holdSave=true;await click(button('保存配置'));await change(input('工作台组件名称'),'发送后继续编辑');
const notes=buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Notes'));if(!notes.props.disabled)await click(notes);
console.log(JSON.stringify({phase:'pending-app-selection',appId:lib().props.appId,title:input('工作台组件名称').props.value,disabled:!!notes.props.disabled}));
assert.equal(lib().props.appId,'hallmark','switching applications cannot unload the pending editor and its newer edits');assert.equal(input('工作台组件名称').props.value,'发送后继续编辑');assert.equal(notes.props.disabled,true);
assert.equal(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Hallmark')).props['aria-pressed'],true);
await click(button('工作台'));assert.equal(button('工作台').props['aria-pressed'],true,'other local tasks remain available');failSave=true;await act(async()=>releaseSave());await settle();assert.equal(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Notes')).props.disabled,false);
`));
