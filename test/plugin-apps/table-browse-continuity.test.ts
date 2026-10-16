import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('loaded table keeps its local page across same-query reads and fallback but resets for a different batch or owner',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'table-continuity-')),entry=join(directory,'fixture.mjs');
 try{
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';
import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const store=new RuntimeStore(':memory:'),calls=[],requests=[];
const descriptor={capabilityId:'hallmark.fixture.products',version:'1.0.0',effect:'query',title:'商品',description:'offline recorded table paging',inputSchema:{type:'object',properties:{cursor:{type:'string'},limit:{type:'integer'},storeId:{type:'string'}},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]};
let count=35,mode='ok',storeId=uiStore().id,tree;
const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async request=>{calls.push(request);if(mode==='snapshot-failure')return {status:'unavailable',invocationId:request.invocationId,traceId:request.traceId,error:{code:'BACKEND_OFFLINE',message:'offline snapshot failure',retryPolicy:'read_retry'}};return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:uiProducts(count),total:70,cursor:request.input.cursor?null:'second-batch',cache:{fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),nextRefreshAt:new Date(Date.now()+900000).toISOString(),stale:false,refreshing:false}}};}};
const service=new AppsPresentationService({store,runtime});
await service.registerDataSource({definition:{id:'browse-source',appId:'hallmark',connectionId:'offline-connection',capabilityId:descriptor.capabilityId,capabilityMajor:1,title:'Recorded products',input:{limit:35},parameters:[{name:'storeId',label:'店铺',type:'string'},{name:'cursor',label:'分页',type:'string'},{name:'limit',label:'条数',type:'integer',default:35}],fields:[{role:'product.name',path:'title',confirmed:true}],rowsPath:'items',operations:{pagination:{cursorParam:'cursor',limitParam:'limit'},search:{scope:'loaded'},sort:{scope:'loaded'}}}},{kind:'agent',sessionId:'offline',nativeCallId:'register'});
const design=createMaterialView('data-table'),bindingId=design.bindings[0].id;
design.widgets[0].columns=[{field:'product.name',label:'商品'}];design.widgets[0].options={...design.widgets[0].options,pageSize:10};
const instance={instanceId:'browse',title:'商品表',materialId:'data-table',materialVersion:1,design,dataSources:{[bindingId]:{id:'browse-source',revision:1,params:{}}},position:{order:0}};
service.saveWorkbench('hallmark',{expectedRevision:0,instances:[instance],context:{storeId}});
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);assert.equal(body.operation,'read','the rendered journey only reads');if(mode==='temporary')return Response.json({error:{code:'SERVICE_UNAVAILABLE',message:'offline temporary read failure'}},{status:503});if(mode==='forbidden')return Response.json({error:{code:'ACCESS_DENIED',message:'offline permission denied'}},{status:403});const {instanceId,...input}=body.params;return Response.json(await service.readWorkbenchInstance(body.appId,instanceId,input,options.signal));};
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>act(async()=>{assert.ok(button(name),'button '+name);button(name).props.onClick();await flush();});
const content=()=>JSON.stringify(tree.toJSON());
const range=expected=>assert.ok(content().includes(expected),'table range '+expected+'; actual '+tree.root.findAllByProps({className:'hm-muted hm-table-range'}).map(text).join('')+'; alerts '+tree.root.findAllByProps({role:'alert'}).map(text).join(''));
const draw=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId}}/>;
try{
 await act(async()=>{tree=create(draw());await flush();});range('1–10 / 35');
 const startReads=requests.length,startCalls=calls.length;
 await click('下一页');await click('下一页');range('21–30 / 35');assert.equal(requests.length,startReads);assert.equal(calls.length,startCalls);
 await click('立即更新');range('21–30 / 35');assert.equal(requests.length,startReads+1);assert.equal(calls.length,startCalls+1);
 mode='temporary';await click('立即更新');range('21–30 / 35');assert.match(content(),/offline temporary read failure/);assert.equal(requests.length,startReads+2);assert.equal(calls.length,startCalls+1);
 mode='snapshot-failure';await click('立即更新');range('21–30 / 35');assert.match(content(),/继续显示上次成功的数据/);
 mode='ok';count=12;await click('立即更新');range('11–12 / 12');
 count=35;await click('立即更新');range('11–20 / 35');
 // A new remote batch must not inherit the local page number of the old batch.
 await click('下一批数据');range('1–10 / 35');assert.equal(calls.at(-1).input.cursor,'second-batch');
 await click('下一页');range('11–20 / 35');await click('返回第一批');range('1–10 / 35');assert.equal(calls.at(-1).input.cursor,undefined);
 // Search and sorting remain local and reset to the first matching page.
 await click('下一页');const beforeLocal=requests.length;
 await act(async()=>{tree.root.findByProps({'aria-label':'搜索当前快照'}).props.onChange({target:{value:uiProduct({},7).title}});await flush();});assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,uiProduct({},7).title);assert.equal(requests.length,beforeLocal);
 await click('立即更新');assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,uiProduct({},7).title);
 await act(async()=>{tree.root.findByProps({'aria-label':'清除快照搜索'}).props.onClick();await flush();});range('1–10 / 35');
 await click('下一页');const beforeSort=requests.length;await act(async()=>{tree.root.findByProps({'aria-label':'商品，点击排序'}).props.onClick({persist(){}});await flush();});range('1–10 / 35');assert.equal(requests.length,beforeSort,'local sorting does not read');
 await click('下一页');storeId=uiStore({},1).id;const board=service.getWorkbench('hallmark');service.saveWorkbench('hallmark',{expectedRevision:board.revision,instances:board.instances,context:{storeId}});await act(async()=>{tree.update(draw());await flush();});range('1–10 / 35');
 mode='forbidden';await click('立即更新');assert.equal(tree.root.findAllByType('table').length,0,'permission errors discard rows');assert.match(content(),/offline permission denied/);
 console.log('TABLE_BROWSE_CONTINUITY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());store.close();}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/TABLE_BROWSE_CONTINUITY_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'table-continuity-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
