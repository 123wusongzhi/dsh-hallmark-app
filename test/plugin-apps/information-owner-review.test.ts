import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
const REPO_ROOT=fileURLToPath(new URL('../..',import.meta.url));
function spawnFixture(args:string[],options:{input?:string;encoding?:string;timeout?:number}={}){
 const temporaryRoot=resolve(REPO_ROOT,'.test-tmp');mkdirSync(temporaryRoot,{recursive:true});const directory=mkdtempSync(join(temporaryRoot,'navigation-'));
 const child=spawnSync(process.execPath,args,{...options,cwd:REPO_ROOT,windowsHide:true,encoding:'utf8',timeout:20000});
 writeFileSync(join(directory,'stdout.txt'),child.stdout??'');writeFileSync(join(directory,'stderr.txt'),child.stderr??'');
 assert.equal(child.status,0,(child.stdout??'')+(child.stderr??'')+'\nFixture retained at '+directory);
 assert.ok(resolve(directory).startsWith(temporaryRoot+sep+'navigation-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});return child;
}


test('real information editor discards pending choices across store and session owners and ignores late closed previews',async()=>{
 const output=await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
import {InformationPicker} from './packages/plugin-apps/client/information-picker.tsx';
import {ModuleConfig,configuredColumns} from './packages/plugin-apps/client/module-config.tsx';
import {MATERIAL_CATALOG,createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const source={kind:'data_source',id:'source',revision:1,title:'Review source',appId:'hallmark',connectionId:'platform',capabilityId:'review.rows',capabilityMajor:1,storeScoped:true,input:{},parameters:[],fields:Array.from({length:35},(_,i)=>({key:'field'+i,role:'product.name',path:'field'+i,label:'Field '+i,confirmed:true})),rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',issues:[],sampleCount:1,checkedAt:''}};
const design=createMaterialView('data-table');design.bindings=[{id:'main',datasetKey:'data',fieldMap:{field0:'field0'}}];design.widgets[0].columns=[{field:'field0',label:'Field 0'}];design.widgets[0].bindingId='main';
let instance={instanceId:'review',title:'Review table',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}}},position:{order:0}};
let board={kind:'workbench',appId:'hallmark',workbenchId:'review',revision:1,context:{storeId:'shop-a'},instances:[instance]},session='session-a',active=true,tree,hold=false;
const requests=[],releases=[],resources=[];
globalThis.fetch=async(url,options)=>{
 const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;
 if(!body){resources.push(resource);if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});if(resource==='dataSources')return Response.json({dataSources:[source]});if(resource==='workbench')return Response.json(board);if(resource==='stores')return Response.json({stores:[]});throw Error(resource);}
 assert.ok(['preview','read'].includes(body.operation),'review forbids writes');requests.push({body,signal:options.signal});const current=structuredClone(body.params.instance??instance),owner=body.params.context?.storeId??board.context.storeId;
 const result={instanceId:current.instanceId,view:{viewId:'preview',design:current.design},dataSources:{main:source},pages:{main:{hasMore:false,loadedCount:1}},data:{bindings:[{bindingId:'main',datasetId:owner,payload:{items:[Object.fromEntries(source.fields.map(field=>[field.key,owner]))]},state:'ready',freshness:'fresh',provenance:[]}]}};
 if(hold&&body.operation==='preview')await new Promise(resolve=>releases.push(resolve));return Response.json(result);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const draw=()=> <MaterialLibrary appId='hallmark' sessionId={session} active={active} initial={instance} currentWorkbench={board} onComplete={()=>{throw Error('unexpected save')}}/>;
const render=async()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const click=async name=>{const node=tree.root.findAllByType('button').find(node=>text(node).trim()===name);assert.ok(node,name);await act(async()=>{node.props.onClick();await flush();});};
const selected=()=>tree.root.findByType(InformationPicker).props.selected;
const toggle=async key=>act(async()=>{tree.root.findByType(InformationPicker).props.onToggle(key);await flush();});
try{
 await render();await click('调整显示');await click('添加信息');const before=requests.length;
 await toggle('field1');assert.deepEqual(selected(),['field0','field1']);assert.equal(requests.length,before);
 active=false;await render();assert.deepEqual(selected(),['field0','field1'],'switching away retains pending choices');assert.equal(requests.length,before,'hidden editor does not preview');active=true;await render();assert.deepEqual(selected(),['field0','field1'],'returning to the same owner resumes pending choices');
 board={...board,revision:2,context:{storeId:'shop-b'}};await render();assert.deepEqual(selected(),['field0'],'pending information choices must not cross stores');
 await toggle('field2');session='session-b';await render();assert.deepEqual(selected(),['field0'],'pending information choices must not cross chat permissions');
 session='session-a';await render();assert.deepEqual(selected(),['field0'],'returning to an old owner must not resurrect discarded choices');
 await act(async()=>{for(let i=1;i<35;i++)tree.root.findByType(InformationPicker).props.onToggle('field'+i);});assert.equal(selected().length,30,'batched events obey 30-field limit');
 await click('取消');assert.equal(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]).length,1);
 await click('添加信息');await toggle('field1');hold=true;await click('应用并预览');session='session-c';await render();const late=requests.at(-1);assert.equal(late.body.operation,'preview');await act(async()=>tree.unmount());tree=undefined;assert.equal(late.signal.aborted,true,'closing editor aborts applied preview');await act(async()=>{releases.splice(0).forEach(resolve=>resolve());await flush();});hold=false;
 await render();await click('调整显示');assert.equal(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]).length,1,'closing without save discards applied configuration');
 active=false;await render();const hiddenRequests=requests.length,hiddenResources=resources.length;instance={...instance,instanceId:'another-review'};await render();assert.equal(requests.length,hiddenRequests,'hidden editor does not read a changed initial instance');assert.equal(resources.length,hiddenResources,'hidden editor does not reload its catalog');active=true;await render();assert.ok(requests.length>hiddenRequests,'reactivation loads the new instance');assert.ok(resources.length>hiddenResources,'reactivation loads the suspended catalog');
 console.log('INDEPENDENT_INFORMATION_OWNER_CLOSE_PASS');
}finally{releases.forEach(resolve=>resolve());if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnFixture(['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/INDEPENDENT_INFORMATION_OWNER_CLOSE_PASS/);
});

test('hidden production board rejects refresh and changed owner reads until reactivated',async()=>{
 const output=await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchBoard,WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const timers=new Map();let timerId=0;globalThis.setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id};globalThis.clearTimeout=id=>timers.delete(id);
const design=createMaterialView('data-table');design.bindings=[{id:'main',datasetKey:'data',fieldMap:{title:'title'}}];design.widgets[0].columns=[{field:'title',label:'Review'}];
const instance={instanceId:'review',title:'Review',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,fields:[],parameters:[],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
let board={kind:'workbench',appId:'hallmark',workbenchId:'review',revision:1,context:{storeId:'a'},instances:[instance]},active=true,revision=0,deny=false,hold=false,tree;const requests=[],releases=[];
globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({body,resource,signal:options.signal});if(!body)return Response.json(resource==='stores'?{stores:[]}:board);assert.equal(body.operation,'read');const owner=body.params.context.storeId,rejected=deny;const data={instanceId:'review',view:{viewId:'review',design},dataSources:{main:source},pages:{main:{hasMore:false,loadedCount:1}},data:{bindings:[{bindingId:'main',datasetId:owner,payload:{items:[{title:owner}],cache:{nextRefreshAt:new Date(Date.now()+900000).toISOString()}},state:'ready',freshness:'fresh',provenance:[]}]}};if(hold)await new Promise(resolve=>releases.push(resolve));return rejected?Response.json({error:{code:'ACCESS_DENIED',message:'review denied'}},{status:403}):Response.json(data);};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};const draw=()=> <WorkbenchBoard appId='hallmark' snapshot={board} revision={revision} active={active} detailInstanceId='review' onAdd={()=>{}} onConfigure={()=>{}}/>;const render=async()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});const reads=()=>requests.filter(request=>request.body);
try{
 await render();assert.equal(timers.size,1);active=false;await render();assert.equal(timers.size,0);const hiddenCount=requests.length;
 revision++;board={...board,revision:2,context:{storeId:'b'}};await render();assert.equal(requests.length,hiddenCount,'hidden prop updates do not issue directory or snapshot requests');assert.equal(timers.size,0);
 hold=true;active=true;await render();const pending=reads().at(-1);assert.equal(pending.body.params.context.storeId,'b');active=false;await render();assert.equal(pending.signal.aborted,true);
 deny=true;hold=false;board={...board,revision:3,context:{storeId:'c'}};revision++;await render();active=true;await render();assert.match(JSON.stringify(tree.toJSON()),/review denied/);assert.equal(timers.size,0);
 await act(async()=>{releases.splice(0).forEach(resolve=>resolve());await flush();});assert.match(JSON.stringify(tree.toJSON()),/review denied/);assert.equal(timers.size,0);console.log('INDEPENDENT_HIDDEN_BOARD_OWNER_PASS');
}finally{releases.forEach(resolve=>resolve());if(tree)await act(async()=>tree.unmount());assert.equal(timers.size,0);}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnFixture(['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/INDEPENDENT_HIDDEN_BOARD_OWNER_PASS/);
});
