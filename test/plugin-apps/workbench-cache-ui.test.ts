import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workbench and saved native views refresh on expiry, pause when hidden, preserve rows on failure and discard previous owners',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'cache-ui-')),entry=join(dir,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {AppsNativeView} from './packages/plugin-apps/client/view.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const document=new EventTarget();document.hidden=false;globalThis.document=document;globalThis.window=new EventTarget();
const timers=new Map();let timerId=0,now=100000;Date.now=()=>now;
globalThis.setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const tick=async()=>{const [id,timer]=[...timers].sort((a,b)=>a[1].delay-b[1].delay)[0]??[];assert.ok(timer,'scheduled refresh');timers.delete(id);now+=timer.delay;await act(async()=>{timer.fn();await flush();});};
const design=createMaterialView('data-table');design.bindings=[{id:'main',datasetKey:'data',fieldMap:{title:'title'}}];design.widgets[0].bindingId='main';design.widgets[0].fields={title:'title'};design.widgets[0].columns=[{field:'title',label:'商品'}];design.widgets[0].options={rowsPath:'items'};
const instance={instanceId:'test',title:'缓存测试',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,fields:[],parameters:[],operations:{pagination:{},search:{scope:'loaded'},sort:{scope:'loaded'}}};
let tree,requests=[],mode='board',fail=false,hold=false,releases=[],rowVersion=0,swr=false;
const bindings=(viewId)=>({viewId,bindings:[{bindingId:'main',datasetId:'data',payload:{items:[{title:viewId+'商品'+rowVersion}],cache:{ttlMs:900000,fetchedAt:new Date(now).toISOString(),expiresAt:new Date(now+900000).toISOString(),nextRefreshAt:new Date(now+(swr?2000:900000)).toISOString(),stale:false,refreshing:swr}},state:'ready',lastSuccessAt:new Date(now).toISOString(),sourceDataTime:null,freshness:'fresh',provenance:[]}]});
globalThis.fetch=async(url,options)=>{const body=options?.body?JSON.parse(options.body):undefined;requests.push({url:String(url),body,signal:options?.signal});const id=mode==='board'?body.params.context.storeId:new URL(String(url),'http://fixture').searchParams.get('viewId')??body.viewId;const captured=bindings(id);if(hold&&body)await new Promise(resolve=>releases.push(resolve));if(fail&&body)return Response.json({error:{message:'临时网络故障'}},{status:503});
 if(mode==='board')return Response.json({instanceId:'test',view:{viewId:id,design},dataSources:{main:source},pages:{main:{hasMore:false,loadedCount:1}},data:captured});
 if(body)return Response.json(captured);const resource=new URL(String(url),'http://fixture').searchParams.get('resource');return Response.json(resource==='view'?{viewId:id,ownerSessionId:'chat',title:'保存的组件',viewRevision:1,design,bindings:[{bindingId:'main',datasetId:'data'}]}:captured);
};
const contents=()=>JSON.stringify(tree.toJSON()),text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const mount=async(id)=>{await act(async()=>{const element=mode==='board'?<WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId:id}}/>:<AppsNativeView sessionId='chat' viewId={id}/>;if(tree)tree.update(element);else tree=create(element);await flush();});};
const hidden=async(value)=>{await act(async()=>{document.hidden=value;document.dispatchEvent(new Event('visibilitychange'));await flush();});};
for(mode of ['board','native']){
 requests=[];rowVersion=0,swr=false;await mount('A');assert.match(contents(),/A商品0/);assert.equal(timers.size,1);
 await hidden(true);assert.equal(timers.size,0,'hidden document cancels automatic refresh');await hidden(false);assert.equal(timers.size,1);
 rowVersion=1;await tick();assert.match(contents(),/A商品1/);const automatic=requests.at(-1).body;assert.equal(mode==='board'?automatic.params.forceRefresh:automatic.forceRefresh,false);
 hold=true;rowVersion=2;await act(async()=>{button('立即更新').props.onClick();await flush();});assert.match(contents(),/A商品1/,'keep existing rows while requesting');assert.equal(timers.size,0,'no overlapping refresh');const manual=requests.at(-1).body;assert.equal(mode==='board'?manual.params.forceRefresh:manual.forceRefresh,true);
 fail=true;await act(async()=>{releases.shift()();await flush();});assert.match(contents(),/A商品1/);assert.match(contents(),/临时网络故障/);assert.equal(timers.size,1,'failed read schedules retry');fail=false;hold=false;
 await tick();assert.match(contents(),/A商品2/);
 swr=true;await act(async()=>{button('立即更新').props.onClick();await flush();});assert.match(contents(),/A商品2/);assert.match(contents(),/正在后台更新/);assert.equal(button('更新中…').props.disabled,true);assert.equal([...timers.values()][0].delay,2000,'poll the pending snapshot without waiting for TTL');
 swr=false;rowVersion=3;await tick();assert.match(contents(),/A商品3/);assert.equal(mode==='board'?requests.at(-1).body.params.forceRefresh:requests.at(-1).body.forceRefresh,false);assert.equal([...timers.values()][0].delay,900000,'the next regular update waits fifteen minutes');
 hold=true;await act(async()=>{button('立即更新').props.onClick();await flush();});const old=requests.at(-1);hold=false;rowVersion=3;await mount('B');assert.equal(old.signal.aborted,true);assert.match(contents(),/B商品3/);await act(async()=>{releases.shift()();await flush();});assert.doesNotMatch(contents(),/A商品/);assert.equal(button('立即更新').props.disabled,false,'new owner is not stuck refreshing');
 await act(async()=>tree.unmount());tree=undefined;assert.equal(timers.size,0,'unmount clears timers');
}
console.log('TTL_NATIVE_AND_WORKBENCH_PASS');
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/TTL_NATIVE_AND_WORKBENCH_PASS/);
 }finally{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});}
});

test('full Ozon table snapshots page and search locally and retain valid pages after background replacement',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'snapshot-table-')),entry=join(dir,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const design=createMaterialView('data-table');design.bindings=[{id:'main',datasetKey:'data',fieldMap:{title:'title',amount:'amount'}}];design.widgets[0].bindingId='main';design.widgets[0].fields={title:'title',amount:'amount'};design.widgets[0].columns=[{field:'title',label:'订单'},{field:'amount',label:'金额'}];design.widgets[0].options={rowsPath:'items',pageSize:10};
const instance={instanceId:'snapshot-table',title:'订单',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,capabilityId:'hallmark.ozon.orders',fields:[],parameters:[],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
let tree,requests=0,count=76,refreshKey=0,store='A';
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
globalThis.fetch=async()=>{requests++;return Response.json({instanceId:instance.instanceId,view:{viewId:'view',design},dataSources:{main:source},pages:{main:{hasMore:false,loadedCount:count,total:count}},data:{viewId:'view',bindings:[{bindingId:'main',datasetId:'snapshot-'+requests,query:{input:{loadAll:true,storeId:store}},payload:{items:Array.from({length:count},(_,i)=>({title:'订单'+i,amount:i})),total:count},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node)===name),contents=()=>JSON.stringify(tree.toJSON());
const render=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId:store}} refreshKey={refreshKey}/>;
await act(async()=>{tree=create(render());await flush();});assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,10);assert.match(contents(),/覆盖当前范围全部记录/);assert.doesNotMatch(contents(),/下一批数据|本批/);
await act(async()=>button('下一页').props.onClick());await act(async()=>button('下一页').props.onClick());assert.match(contents(),/21–30 \\/ 76/);assert.equal(requests,1);
refreshKey++;await act(async()=>{tree.update(render());await flush();});assert.match(contents(),/21–30 \\/ 76/,'refresh preserves the third page');
count=12;refreshKey++;await act(async()=>{tree.update(render());await flush();});assert.match(contents(),/11–12 \\/ 12/,'removed pages clamp to the last valid page');
await act(async()=>tree.root.findByProps({'aria-label':'搜索当前快照'}).props.onChange({target:{value:'订单11'}}));assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);assert.equal(requests,3,'search and pages do not query the platform');
refreshKey++;await act(async()=>{tree.update(render());await flush();});assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,'订单11');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);
store='B';await act(async()=>{tree.update(render());await flush();});assert.equal(tree.root.findByProps({'aria-label':'搜索当前快照'}).props.value,'','new store does not inherit the previous store filter');
await act(async()=>tree.unmount());console.log('FULL_SNAPSHOT_TABLE_PASS');
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/FULL_SNAPSHOT_TABLE_PASS/);
 }finally{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});}
});
