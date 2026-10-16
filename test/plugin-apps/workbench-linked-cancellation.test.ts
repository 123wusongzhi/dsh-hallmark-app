import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';import {join,resolve,sep} from 'node:path';import {spawnSync} from 'node:child_process';import {build} from 'esbuild';
for(const scenario of ['search-success','search-failure','page-success','page-failure'])test('linked read cancellation restores refresh and protects replacement: '+scenario,async()=>{
const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'linked-cancel-')),entry=join(directory,'fixture.mjs');
try{await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
const scenario=${JSON.stringify(scenario)};
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
let lateFailure=false;let tree,active=true,storeId='shop-a',hold=false,deny=false;const requests=[],releases=[];
const result=params=>({instanceId:instance.instanceId,view:{viewId:storeId,design},dataSources:{products:source,sku:{...source,id:'sku'}},pages:{products:{hasMore:true,nextCursor:'next',loadedCount:1},sku:{hasMore:false,loadedCount:1}},data:{bindings:['products','sku'].map(bindingId=>({bindingId,datasetId:params.context.storeId+'-'+bindingId,query:{input:params.params??{}},payload:{items:[uiProduct({id:params.context.storeId+'-product',name:uiProduct({},params.context.storeId==='shop-a'?7:40).title,specification:'recorded-sku'},params.context.storeId==='shop-a'?7:40)],cache:{fetchedAt:new Date(now).toISOString(),nextRefreshAt:new Date(now+900000).toISOString(),stale:false,refreshing:false}},state:'ready',lastSuccessAt:new Date(now).toISOString(),freshness:'fresh',provenance:[]}))}});
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body),response=result(body.params),reject=deny;requests.push({body,signal:options.signal});if(hold&&body.params.bindingId==='sku')await new Promise((resolve,reject)=>releases.push(lateFailure?()=>reject(Error('late obsolete failure')):resolve));return reject?Response.json({error:{code:'ACCESS_DENIED',message:'当前店铺无读取权限'}},{status:403}):Response.json(response);};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const draw=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId}} active={active}/>;
const render=async()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const interactions=()=>tree.root.findByType(ViewRenderer).props.interactions;
const query=async value=>act(async()=>{interactions().bindings.products.onQueryChange({search:value});await flush();});

const select=async()=>act(async()=>{tree.root.findAllByType('tr').find(node=>node.props.className==='hm-material-selectable').props.onClick();await flush();});
try{
 await render();assert.equal(timers.size,1);
 hold=true;lateFailure=scenario.endsWith('failure');await select();const obsolete=requests.at(-1);
 assert.equal(interactions().bindings.sku.pagination.loading,true);assert.equal(timers.size,0);
 if(scenario.startsWith('page'))await act(async()=>{tree.root.findAllByType('button').find(node=>text(node)==='下一批').props.onClick();await flush();});
 else {await act(async()=>tree.root.findByProps({'aria-label':'搜索全部商品'}).props.onChange({target:{value:'new-query'}}));await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await flush();});}
 assert.equal(obsolete.signal.aborted,true);assert.equal(interactions().bindings.sku.selectedProductId,undefined);
 assert.equal(interactions().bindings.sku.pagination.loading,false,'cancelled linked read releases its busy flag');assert.equal(timers.size,1,'successful query/page change restores auto-refresh');
 // A new selection starts before the abort-ignoring predecessor finishes.
 lateFailure=false;await select();const current=requests.at(-1);assert.equal(current.signal.aborted,false);assert.equal(timers.size,0);
 await act(async()=>{releases.shift()();await flush();});
 assert.equal(interactions().bindings.sku.pagination.loading,true,'late success/failure must not clear the replacement read');assert.equal(timers.size,0);assert.equal(current.signal.aborted,false);
 await act(async()=>{releases.shift()();await flush();});assert.equal(interactions().bindings.sku.pagination.loading,false);assert.equal(timers.size,1);
 // Cancel a second linked request by searching, then hide/resume and deliver it late.
 hold=true;await select();await query('hide-after-cancel');assert.equal(timers.size,1);const beforeHide=requests.length;
 active=false;await render();assert.equal(timers.size,0);await act(async()=>{releases.shift()();await flush();});active=true;await render();assert.equal(requests.length,beforeHide,'a cancelled selection must not resume');assert.equal(timers.size,1);
 hold=false;const beforeTick=requests.length;const [id,timer]=[...timers][0];timers.delete(id);await act(async()=>{timer.fn();await flush();});assert.equal(requests.length,beforeTick+1,'one scheduled read only');assert.equal(timers.size,1);
 await act(async()=>{tree.root.findAllByType('button').find(node=>text(node)==='立即更新').props.onClick();await flush();});assert.equal(interactions().bindings.sku.pagination.loading,false);assert.equal(timers.size,1);
 assert.ok(requests.every(request=>request.body.operation==='read'));console.log('LINKED_CANCELLATION_PASS '+scenario);
}finally{for(const release of releases)release();if(tree)await act(async()=>tree.unmount());assert.equal(timers.size,0);}

`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/LINKED_CANCELLATION_PASS/);
}finally{assert.ok(resolve(directory).startsWith(root+sep+'linked-cancel-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}});
