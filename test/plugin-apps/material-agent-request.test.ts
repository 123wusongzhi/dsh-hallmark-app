import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

// Only transport receipts, field definitions and UI edits are fixture controls; no merchant data or writes.
async function fixture(body:string,prepare='',countKeys=false){
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'material-close-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:setup+prepare+`
try{await act(async()=>{tree=create(draw());});await settle();
`+body+`
assert.equal(confirmations,0,'never call a global confirmation');}finally{if(tree)await act(async()=>tree.unmount());}`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:countKeys?[{name:'count-semantic-keys',setup(builder){builder.onLoad({filter:/[\\/]plugin-apps[\\/]client[\\/]material-library\.tsx$/},args=>({contents:readFileSync(args.path,'utf8').replace('  const spec=instance.design as unknown as ViewSpec,refs=workbenchRefs(instance);','  globalThis.materialKeyCalls=(globalThis.materialKeyCalls??0)+1;\n  const spec=instance.design as unknown as ViewSpec,refs=workbenchRefs(instance);'),loader:'tsx',resolveDir:resolve(args.path,'..')}));}}]:[],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','react-test-renderer'],outfile:entry,logLevel:'silent'});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});if(countKeys)process.stdout.write(result.stdout);assert.equal(result.status,0,result.error?.message??result.stderr);
  }finally{rmSync(directory,{recursive:true,force:true});}
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
let extraSources=[];
let holdPrepare=false,releasePrepare,failPrepare=false,handoffs=[],holdHandoff=false,releaseHandoff;
let calls=[],tree,visible=true,session='audit-session',holdSave=false,releaseSave,failSave=false,holdCatalog=false,holdPreview=false,normalizeSaved=false,delaySources=false,releaseSources;
const snapshot=instance=>({instanceId:instance.instanceId,view:{viewId:instance.instanceId,ownerSessionId:null,title:instance.title,design:instance.design,bindings:[]},data:{viewId:instance.instanceId,bindings:[]},dataSources:{main:source},pages:{}});
globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;calls.push({resource,body});let value;
if(resource==='dataSources'&&delaySources)await new Promise(resolve=>releaseSources=resolve);
if(holdCatalog&&['dataSources','materials'].includes(resource))return new Promise(()=>{});
if(body){assert.equal(body.action,'workbench');if(body.operation==='prepare'){if(holdPrepare)await new Promise(resolve=>releasePrepare=resolve);if(failPrepare)return Response.json({status:'failed',error:{message:'prepare unavailable'}},{status:503});value={};}else if(body.operation==='read')value=snapshot(board.instances.find(x=>x.instanceId===body.params.instanceId));else if(body.operation==='preview'){if(holdPreview)return new Promise(()=>{});value=snapshot(body.params.instance);}else if(body.operation==='save'){if(holdSave)await new Promise(resolve=>releaseSave=resolve);if(failSave)return Response.json({status:'failed',error:{message:'audit revision conflict'}},{status:409});const instances=structuredClone(body.params.instances);if(normalizeSaved){for(const instance of instances)for(const ref of Object.values(instance.dataSources??{}))if(ref.draft){delete ref.draft;ref.revision++;source.revision=ref.revision;}}board={...board,instances,revision:board.revision+1};value=board;}else throw Error('Unexpected mutation '+JSON.stringify(body));}
else if(resource==='apps')value={apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'},{appId:'notes',displayName:'Notes',runtimeState:'ready',hostProjectionState:'ready'}]};else if(resource==='connectionStatus')value={state:'connected',node:{state:'healthy'},data:{message:'isolated'},checkedAt:'2026-10-16T00:00:00Z',canRestart:false};else if(resource==='businessSettings')value={connections:[],stores:[],pricing:null};else if(resource==='workbench')value=new URL(String(url),'http://fixture').searchParams.get('appId')==='notes'?{...board,appId:'notes',instances:[]}:board;else if(resource==='stores')value={stores:[]};else if(resource==='views')value={views:[]};else if(resource==='connections'||resource==='bindings')value=[];else if(resource==='diagnostics')value={invocations:[]};else if(resource==='saved')value={components:[],assets:[]};else if(resource==='materials')value={materials:MATERIAL_CATALOG};else if(resource==='dataSources')value={dataSources:[source,...extraSources]};else throw Error('Unexpected resource '+resource);
return Response.json(value);};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const buttons=()=>tree.root.findAllByType('button'),button=t=>buttons().find(n=>text(n).trim()===t),label=l=>buttons().find(n=>n.props['aria-label']===l),input=l=>tree.root.findAllByType('input').find(n=>n.props['aria-label']===l),lib=()=>tree.root.findByType(MaterialLibrary),config=()=>tree.root.findByType(ModuleConfig),columns=()=>configuredColumns(config().props.spec.widgets[0]);
const settle=()=>act(async()=>{await new Promise(r=>setTimeout(r,10));});
const click=async n=>{assert.ok(n,'button exists');assert.ok(!n.props.disabled,'button enabled '+text(n));await act(async()=>n.props.onClick());await settle();};
const change=async(n,value)=>{await act(async()=>n.props.onChange({target:{value}}));await settle();};
const draw=()=>React.createElement(AppsWorkspace,{currentSessionId:session,onPrepareDataSource:async(id,text)=>{handoffs.push({id,text});if(holdHandoff)await new Promise(resolve=>releaseHandoff=resolve);},usePanelInfo:selector=>selector({activePanelId:visible?'hallmark-apps':'chat'})});

const mounted=()=>tree.root.findAllByType(MaterialLibrary).length===1;
const prompt=()=>tree.root.findAllByProps({'aria-label':'确认关闭素材库'}).length===1;
const request=()=>tree.root.findAllByType('textarea').find(n=>n.props['aria-label']==='数据源需求');
const openRequest=()=>click(button('没有需要的数据？让 Agent 创建数据源'));
const custom='请增加近30天退货率，按SKU关联，排除已取消订单；保留RUB币种。';
const writes=()=>calls.filter(c=>c.body?.operation==='save').length;
`;

test('agent request collapse and repeated creation preserve hand-edited text without changing configuration',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);
await click(button('工作台'));await click(button('素材库'));assert.equal(request().props.value,custom);
await click(button('收起'));assert.equal(request(),undefined);await openRequest();assert.equal(request().props.value,custom);
await openRequest();assert.equal(request().props.value,custom);assert.equal(writes(),0);assert.equal(handoffs.length,0);
`));

test('only hand-edited unsent request blocks close and stale close confirmation cannot discard a newer draft',()=>fixture(`
await click(button('配置'));await openRequest();await click(label('关闭素材库'));assert.ok(!mounted());
await click(button('配置'));await openRequest();const template=request().props.value;await change(request(),custom);
await click(label('关闭素材库'));assert.ok(prompt());assert.ok(JSON.stringify(tree.toJSON()).includes('未放入聊天的需求修改'));const stale=button('放弃并关闭').props.onClick;
await change(request(),custom+'保留修改');assert.ok(!prompt());await act(async()=>stale());assert.ok(mounted());
await click(label('关闭素材库'));await click(button('继续编辑'));assert.equal(request().props.value,custom+'保留修改');
await change(request(),template);await click(label('关闭素材库'));assert.ok(!mounted());
await click(button('配置'));await openRequest();await change(request(),custom);await click(label('关闭素材库'));await click(button('放弃并关闭'));assert.ok(!mounted());
await click(button('配置'));assert.equal(request(),undefined);assert.equal(writes(),0);
`));

test('clearing the request keeps its editor mounted and disables empty handoff',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),'');assert.ok(request());assert.equal(button('放入原聊天输入框').props.disabled,true);await change(request(),custom);assert.equal(button('放入原聊天输入框').props.disabled,false);
`));

test('successful handoff is explicitly unsent and clears only the matching request snapshot',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);holdHandoff=true;
await click(button('放入原聊天输入框'));assert.equal(handoffs.length,1);await change(request(),custom+'新的补充');await act(async()=>releaseHandoff());await settle();
assert.ok(JSON.stringify(tree.toJSON()).includes('尚未发送'));await click(label('关闭素材库'));assert.ok(prompt());await click(button('继续编辑'));
holdHandoff=false;await click(button('放入原聊天输入框'));assert.equal(handoffs.length,2);await click(label('关闭素材库'));assert.ok(!mounted());
`));

test('failed preparation preserves edits and closing does not bypass the request warning',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);failPrepare=true;await click(button('放入原聊天输入框'));assert.equal(handoffs.length,0);assert.equal(request().props.value,custom);await click(label('关闭素材库'));assert.ok(prompt());
`));

test('session change isolates request and cancels a late prepare before native insertion',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);holdPrepare=true;await click(button('放入原聊天输入框'));assert.ok(releasePrepare);
session='other-session';await act(async()=>tree.update(draw()));assert.equal(request(),undefined);await act(async()=>releasePrepare());await settle();assert.equal(handoffs.length,0);
session='audit-session';await act(async()=>tree.update(draw()));assert.equal(request(),undefined);await openRequest();assert.notEqual(request().props.value,custom);
`));

test('discard and unmount cancel late prepare while app and instance changes never inherit a request',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);holdPrepare=true;await click(button('放入原聊天输入框'));await click(label('关闭素材库'));assert.ok(prompt());await click(button('放弃并关闭'));await act(async()=>releasePrepare());await settle();assert.equal(handoffs.length,0);
await click(button('配置'));await openRequest();await change(request(),custom);await click(button('工作台'));await click(button('添加组件'));assert.equal(request(),undefined);
await openRequest();await change(request(),custom);await click(buttons().find(n=>n.props.className==='apps-app-row'&&text(n).includes('Notes')));assert.equal(request(),undefined);
`));

test('saving component configuration never treats its independent request edits as saved',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);await change(input('工作台组件名称'),'配置已保存');await click(button('保存配置'));await click(button('素材库'));assert.equal(request().props.value,custom);await click(label('关闭素材库'));assert.ok(prompt());assert.ok(JSON.stringify(tree.toJSON()).includes('未放入聊天的需求修改'));assert.equal(writes(),1);assert.equal(handoffs.length,0);
`));

test('late native handoff receipt never reports success or settles a new session draft',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);holdHandoff=true;await click(button('放入原聊天输入框'));assert.equal(handoffs.length,1);
session='new-session';await act(async()=>tree.update(draw()));await openRequest();await change(request(),'另一会话的新需求');await act(async()=>releaseHandoff());await settle();assert.equal(request().props.value,'另一会话的新需求');assert.ok(!JSON.stringify(tree.toJSON()).includes('需求已放入原聊天输入框'));await click(label('关闭素材库'));assert.ok(prompt());
`));

test('preserving request text still prepares the currently selected source connection',()=>fixture(`
await click(button('配置'));await openRequest();await change(request(),custom);await change(tree.root.findAllByType('select').find(n=>n.props['aria-label']?.endsWith('数据来源')),'source-b');await click(button('放入原聊天输入框'));assert.deepEqual(calls.find(c=>c.body?.operation==='prepare').body.params.connectionIds,['audit-b']);assert.equal(handoffs[0].text,custom);
`, `extraSources=[{...source,id:'source-b',connectionId:'audit-b',title:'Other source'}];`));
