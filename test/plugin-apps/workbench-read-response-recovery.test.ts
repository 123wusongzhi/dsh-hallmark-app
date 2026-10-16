import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workbench malformed read recovery preserves filters and pages while authorization failures discard data',async()=>{
 const baseline=process.env.DSH_READ_RESPONSE_BASELINE;const old=baseline?spawnSync('git',['show',baseline+':packages/plugin-apps/client/api.ts'],{encoding:'utf8'}):undefined;if(old)assert.equal(old.status,0,old.stderr);
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-read-response-')),entry=join(directory,'fixture.mjs');
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
const count=35,storeId=uiStore().id;let mode='ok',active=true,tree;
const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async request=>{calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:uiProducts(count),total:70,cursor:request.input.cursor?null:'second-batch',cache:{fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),nextRefreshAt:new Date(Date.now()+900000).toISOString(),stale:false,refreshing:false}}};}};
const service=new AppsPresentationService({store,runtime});
await service.registerDataSource({definition:{id:'browse-source',appId:'hallmark',connectionId:'offline-connection',capabilityId:descriptor.capabilityId,capabilityMajor:1,title:'Recorded products',input:{limit:35},parameters:[{name:'storeId',label:'店铺',type:'string'},{name:'cursor',label:'分页',type:'string'},{name:'limit',label:'条数',type:'integer',default:35}],fields:[{role:'product.name',path:'title',confirmed:true}],rowsPath:'items',operations:{pagination:{cursorParam:'cursor',limitParam:'limit'},search:{scope:'loaded'},sort:{scope:'loaded'}}}},{kind:'agent',sessionId:'offline',nativeCallId:'register'});
const design=createMaterialView('data-table'),bindingId=design.bindings[0].id;
design.widgets[0].columns=[{field:'product.name',label:'商品'}];design.widgets[0].options={...design.widgets[0].options,pageSize:10};
const instance={instanceId:'browse',title:'商品表',materialId:'data-table',materialVersion:1,design,dataSources:{[bindingId]:{id:'browse-source',revision:1,params:{}}},position:{order:0}};
service.saveWorkbench('hallmark',{expectedRevision:0,instances:[instance],context:{storeId}});
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);assert.equal(body.operation,'read','the rendered journey only reads');if(mode==='gateway')return new Response('<html>Temporary gateway outage</html>',{status:502});if(mode==='truncated')return new Response('{"incomplete":',{status:200});if(mode==='html-401'||mode==='html-403')return new Response('<html>Access denied</html>',{status:Number(mode.slice(5))});const {instanceId,...input}=body.params;return Response.json(await service.readWorkbenchInstance(body.appId,instanceId,input,options.signal));};
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>act(async()=>{assert.ok(button(name),'button '+name);button(name).props.onClick();await flush();});
const content=()=>JSON.stringify(tree.toJSON());
const range=expected=>assert.ok(content().includes(expected),'table range '+expected+'; actual '+tree.root.findAllByProps({className:'hm-muted hm-table-range'}).map(text).join('')+'; alerts '+tree.root.findAllByProps({role:'alert'}).map(text).join(''));
const draw=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId}} active={active}/>;
try{
 await act(async()=>{tree=create(draw());await flush();});range('1–10 / 35');
 await click('下一页');await click('下一页');range('21–30 / 35');
 const readsBefore=requests.length,callsBefore=calls.length;
 mode='gateway';await click('立即更新');
 assert.equal(tree.root.findAllByType('table').length,1,'temporary non-JSON gateway errors must not discard the mounted table');range('21–30 / 35');
 assert.match(content(),/继续显示上次成功的数据/);assert.doesNotMatch(content(),/<html>|Unexpected token/);
 assert.equal(requests.length,readsBefore+1);assert.equal(calls.length,callsBefore);
 mode='ok';await click('立即更新');range('21–30 / 35');assert.doesNotMatch(content(),/继续显示上次成功的数据/);
 await act(async()=>{tree.root.findByProps({'aria-label':'搜索当前快照'}).props.onChange({target:{value:uiProduct({},7).title}});await flush();});
 const filtered=()=>assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,uiProduct({},7).title);
 filtered();mode='truncated';await click('立即更新');filtered();assert.match(content(),/继续显示上次成功的数据/);
 mode='gateway';await click('立即更新');filtered();
 const beforeHide=requests.length;active=false;await act(async()=>{tree.update(draw());await flush();});active=true;await act(async()=>{tree.update(draw());await flush();});filtered();assert.equal(requests.length,beforeHide,'tab hide/resume retains the valid snapshot without an extra read');
 mode='ok';await click('立即更新');filtered();assert.doesNotMatch(content(),/继续显示上次成功的数据/);
 // A non-JSON permission response must never be classified as a retryable outage.
 for(const status of [403,401]){mode='html-'+status;await click('立即更新');assert.equal(tree.root.findAllByType('table').length,0,'HTTP '+status+' removes protected rows');assert.ok(button('重试读取'));
 mode='ok';await click('重试读取');range('1–10 / 35');assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,'');}
 await act(async()=>tree.unmount());tree=undefined;mode='gateway';await act(async()=>{tree=create(draw());await flush();});assert.equal(tree.root.findAllByType('table').length,0);assert.ok(button('重试读取'),'initial malformed read is explicitly retryable');assert.doesNotMatch(content(),/暂无成功快照/);mode='ok';await click('重试读取');range('1–10 / 35');
 assert.ok(requests.every(request=>request.operation==='read'));
 console.log('WORKBENCH_READ_RESPONSE_RECOVERY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());store.close();}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer'],plugins:old?[{name:'historical-read-api',setup(plugin){plugin.onLoad({filter:/plugin-apps[\\/]client[\\/]api\.ts$/},()=>({contents:old.stdout,loader:'ts'}));}}]:[]});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_READ_RESPONSE_RECOVERY_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'workbench-read-response-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});


test('read body failures preserve HTTP policy and never mark mutations or aborts retryable',async()=>{
 const {appsResource,appsRefreshView,appsWorkbench}=await import('../../packages/plugin-apps/client/api.ts');
 const {cacheFallbackAllowed}=await import('../../packages/presentation/src/cache-display.ts');
 const original=globalThis.fetch;
 try{
  for(const status of [200,401,403,404,429,502,503]){
   globalThis.fetch=async()=>new Response('<html>unreadable</html>',{status});
   const retryable=[200,429,502,503].includes(status);
   for(const read of [()=>appsResource('workbench',{appId:'hallmark'}),()=>appsRefreshView('offline','view',true),()=>appsWorkbench('hallmark','read',{}),()=>appsWorkbench('hallmark','preview',{})]){
    await assert.rejects(read,error=>{assert.equal((error as any).httpStatus,status);assert.equal(cacheFallbackAllowed(error),retryable);assert.doesNotMatch(String(error),/<html>|Unexpected token/);return true;});
   }
  }
  // These calls use a local response stub; none reaches a service or persists anything.
  for(const operation of ['save','initialize','prepare','pinComponent','unpinComponent'] as const){
   await assert.rejects(()=>appsWorkbench('hallmark',operation,{}),error=>{assert.equal(cacheFallbackAllowed(error),false);assert.equal((error as any).retryPolicy,undefined);return true;});
  }
  const controller=new AbortController(),aborted=new Error('cancelled body');
  globalThis.fetch=async()=>{const response=new Response('{}');response.json=async()=>{controller.abort();throw aborted;};return response;};
  await assert.rejects(()=>appsWorkbench('hallmark','read',{},controller.signal),error=>error===aborted);
  globalThis.fetch=async()=>Response.json({error:{code:'ACCESS_DENIED',message:'denied',retryPolicy:'never'}},{status:403});
  await assert.rejects(()=>appsWorkbench('hallmark','read',{}),error=>(error as any).code==='ACCESS_DENIED'&&!cacheFallbackAllowed(error));
 }finally{globalThis.fetch=original;}
});
