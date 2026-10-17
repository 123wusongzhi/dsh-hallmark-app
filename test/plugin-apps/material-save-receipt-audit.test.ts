import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

// Configuration-only transport faults; actual SQLite-backed workbench CAS and derivation run locally.
async function fixture(body:string){
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'material-receipts-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:setup+`
try{await act(async()=>{tree=create(draw());});await settle();
`+body+`
assert.equal(confirmations,0,'never call a global confirmation');}finally{if(tree)await act(async()=>tree.unmount());store.close();}`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','react-test-renderer'],outfile:entry,logLevel:'silent'});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,JSON.stringify({status:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout,stderr:result.stderr}));
  }finally{rmSync(directory,{recursive:true,force:true});}
}
const setup=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';
import {WorkbenchLibrary} from './packages/app-presentation/src/workbench.ts';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {AppsDirectory} from './packages/plugin-apps/client/directory.tsx';
import {MATERIAL_CATALOG,createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.window=new EventTarget();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let confirmations=0;globalThis.confirm=window.confirm=()=>{confirmations++;return false;};
const source={capabilityMajor:1,id:'source-a',kind:'data_source',revision:1,title:'Audit source',appId:'hallmark',connectionId:'audit',capabilityId:'audit.table',input:{},parameters:[],fields:[{key:'name',role:'product.name',confirmed:true,path:'name',label:'名称'},{key:'price',role:'price.current',confirmed:true,path:'price',label:'价格'},{key:'sku',role:'sku.id',confirmed:true,path:'sku',label:'SKU'}],rowsPath:'rows',operations:{search:{scope:'local'},sort:{scope:'local'},pagination:{mode:'none'}},validation:{status:'valid',issues:[]}};
const design=createMaterialView('data-table'); design.widgets[0].columns=[{field:'name',label:'名称'},{field:'price',label:'价格'}];
let board={kind:'workbench',workbenchId:'workbench:hallmark',appId:'hallmark',revision:1,instances:[{instanceId:'existing',title:'已保存组件',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source-a',revision:1,params:{}}},position:{order:0,span:12}}],savedComponents:[],updatedAt:'2026-10-16T00:00:00Z'};
let failureMode='',commits=0;
const store=new RuntimeStore(':memory:');store.put('saved_assets',board.workbenchId,board);
const backend=new WorkbenchLibrary({store,runtime:{describe:()=>({version:'1.0.0',effect:'query',inputSchema:{type:'object'}})},dataSources:{get:(id,revision)=>{assert.equal(id,source.id);assert.equal(revision,source.revision);return structuredClone(source);}}});
let calls=[],tree,visible=true,session='audit-session';
const snapshot=instance=>({instanceId:instance.instanceId,view:{viewId:instance.instanceId,ownerSessionId:null,title:instance.title,design:instance.design,bindings:[]},data:{viewId:instance.instanceId,bindings:[]},dataSources:{main:source},pages:{}});
globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;calls.push({resource,body});let value;
if(body){assert.equal(body.action,'workbench');if(body.operation==='read')value=snapshot(board.instances.find(x=>x.instanceId===body.params.instanceId));else if(body.operation==='preview'){value=snapshot(body.params.instance);}else if(body.operation==='save'){if(failureMode==='rejected')return Response.json({status:'failed',error:{code:'INVALID_INPUT',message:'明确拒绝，未写入'}},{status:400});try{board=backend.save(body.appId,body.params);commits++;}catch(error){return Response.json({status:'failed',error:{code:error.code,message:error.message}},{status:409});}if(failureMode==='lost')throw new TypeError('Failed to fetch');if(failureMode==='unreadable')return new Response('not JSON');value=board;}else throw Error('Unexpected mutation '+JSON.stringify(body));}
else if(resource==='apps')value={apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'},{appId:'notes',displayName:'Notes',runtimeState:'ready',hostProjectionState:'ready'}]};else if(resource==='connectionStatus')value={state:'connected',node:{state:'healthy'},data:{message:'isolated'},checkedAt:'2026-10-16T00:00:00Z',canRestart:false};else if(resource==='businessSettings')value={connections:[],stores:[],pricing:null};else if(resource==='workbench')value=backend.get(new URL(String(url),'http://fixture').searchParams.get('appId'));else if(resource==='stores')value={stores:[]};else if(resource==='views')value={views:[]};else if(resource==='connections'||resource==='bindings')value=[];else if(resource==='diagnostics')value={invocations:[]};else if(resource==='saved')value={components:[],assets:[]};else if(resource==='materials')value={materials:MATERIAL_CATALOG};else if(resource==='dataSources')value={dataSources:[source]};else throw Error('Unexpected resource '+resource);
return Response.json(value);};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const buttons=()=>tree.root.findAllByType('button'),button=t=>buttons().find(n=>text(n).trim()===t),label=l=>buttons().find(n=>n.props['aria-label']===l),input=l=>tree.root.findAllByType('input').find(n=>n.props['aria-label']===l),lib=()=>tree.root.findByType(MaterialLibrary);
const settle=()=>act(async()=>{await new Promise(r=>setTimeout(r,10));});
const click=async n=>{assert.ok(n,'button exists');assert.ok(!n.props.disabled,'button enabled '+text(n));await act(async()=>n.props.onClick());await settle();};
const change=async(n,value)=>{await act(async()=>n.props.onChange({target:{value}}));await settle();};
const draw=()=>React.createElement(AppsWorkspace,{currentSessionId:session,usePanelInfo:selector=>selector({activePanelId:visible?'hallmark-apps':'chat'})});

const prompt=()=>tree.root.findAllByProps({'aria-label':'确认关闭素材库'}).length===1;
const saveCalls=()=>calls.filter(call=>call.body?.operation==='save').length;
`;


for(const mode of ['lost','unreadable'])test('audit material '+mode+' response: CAS protects retries, reread allows explicit save',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'保存意图');failureMode='${mode}';await click(button('保存配置'));
assert.equal(commits,1);assert.equal(board.revision,2);assert.equal(board.instances[0].title,'保存意图');assert.equal(input('工作台组件名称').props.value,'保存意图');assert.ok(!button('保存配置').props.disabled);
failureMode='';await click(button('保存配置'));assert.equal(commits,1);assert.match(text(tree.root),/工作台已修改/);
{const beforeRead=saveCalls();await click(button('重新读取'));assert.equal(saveCalls(),beforeRead,'reread sends no save request');}assert.equal(commits,1);assert.equal(input('工作台组件名称').props.value,'保存意图');await click(button('保存配置'));assert.equal(commits,2);assert.equal(board.instances.length,1);
`));
test('audit material definitive prewrite rejection permits deliberate retry',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'拒绝后重试');failureMode='rejected';await click(button('保存配置'));assert.equal(commits,0);assert.equal(board.revision,1);assert.match(text(tree.root),/明确拒绝/);
failureMode='';await click(button('保存配置'));assert.equal(commits,1);assert.equal(board.instances[0].title,'拒绝后重试');
`));
test('audit material remote update and deletion after lost response do not get implicit writes',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'本地意图');failureMode='lost';await click(button('保存配置'));assert.equal(commits,1);
board=backend.save('hallmark',{expectedRevision:board.revision,instances:[{...board.instances[0],title:'远端新内容'},{...board.instances[0],instanceId:'same-name-other',title:'本地意图'}]});
failureMode='';await click(button('保存配置'));assert.equal(commits,1);assert.equal(board.instances[0].title,'远端新内容');{const beforeRead=saveCalls();await click(button('重新读取'));assert.equal(saveCalls(),beforeRead,'reread sends no save request');}assert.equal(commits,1);assert.equal(input('工作台组件名称').props.value,'本地意图');
board=backend.save('hallmark',{expectedRevision:board.revision,instances:board.instances.filter(i=>i.instanceId!=='existing')});await click(button('保存配置'));assert.equal(commits,1);assert.equal(board.instances.length,1);{const beforeRead=saveCalls();await click(button('重新读取'));assert.equal(saveCalls(),beforeRead,'reread sends no save request');}assert.equal(commits,1);assert.equal(board.instances[0].instanceId,'same-name-other');
`));
test('audit material returned unknown receipt stays scoped through chat and application changes',()=>fixture(`
await click(button('配置'));await change(input('工作台组件名称'),'原应用保存');failureMode='lost';await click(button('保存配置'));assert.equal(commits,1);
session='other-session';await act(async()=>tree.update(draw()));await settle();assert.equal(commits,1);assert.equal(board.instances[0].title,'原应用保存');
await act(async()=>tree.root.findByType(AppsDirectory).props.onAppChange('notes'));await settle();assert.equal(commits,1);assert.equal(backend.get('notes').revision,0);assert.equal(backend.get('notes').instances.length,0);
await act(async()=>tree.root.findByType(AppsDirectory).props.onAppChange('hallmark'));await settle();assert.equal(commits,1);assert.equal(backend.get('hallmark').revision,2);assert.equal(backend.get('hallmark').instances.length,1);
`));
test('audit new material keeps its identity after lost save and reread without duplicate append',()=>fixture(`
await click(button('添加组件'));await click(label('选择数据表'));await change(tree.root.findAllByType('select').find(n=>n.props['aria-label']?.endsWith('数据来源')),'source-a');await change(input('工作台组件名称'),'已保存组件');failureMode='lost';await click(button('添加到工作台'));assert.equal(commits,1);assert.equal(board.instances.length,2);const savedId=board.instances[1].instanceId;assert.notEqual(savedId,'existing');
failureMode='';await click(button('添加到工作台'));assert.equal(commits,1);{const beforeRead=saveCalls();await click(button('重新读取'));assert.equal(saveCalls(),beforeRead,'reread sends no save request');}assert.equal(commits,1);assert.equal(board.instances.length,2);assert.equal(lib().findByType(WorkbenchInstanceView).props.instance.instanceId,savedId);await click(label('关闭素材库'));assert.ok(prompt(),'matching current remote fields do not mark the unconfirmed draft as successfully saved');await click(button('继续编辑'));await click(button('添加到工作台'));assert.equal(commits,2);assert.equal(board.instances.length,2);assert.equal(board.instances[1].instanceId,savedId);
`));
