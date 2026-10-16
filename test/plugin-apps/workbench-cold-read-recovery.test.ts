import test from 'node:test';
import assert from 'node:assert/strict';
import {build,type PluginBuild} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('unread workbench is neither an empty catalogue nor a removed component; explicit retry and return remain available',async t=>{
 const baseline=process.env.DSH_COLD_BOARD_BASELINE;
 const old=baseline?spawnSync('git',['show',baseline+':packages/plugin-apps/client/workbench-board.tsx'],{encoding:'utf8'}):undefined;
 if(old)assert.equal(old.status,0,old.stderr);
 const workspaceBaseline=process.env.DSH_COLD_WORKSPACE_BASELINE;
 const oldWorkspace=workspaceBaseline?spawnSync('git',['show',workspaceBaseline+':packages/plugin-apps/client/workspace.tsx'],{encoding:'utf8'}):undefined;
 if(oldWorkspace)assert.equal(oldWorkspace.status,0,oldWorkspace.stderr);
 const output=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchBoard} from './packages/plugin-apps/client/workbench-board.tsx';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
const design=createMaterialView('data-table'),bindingId=design.bindings[0].id;
design.widgets[0].columns=[{field:'product.name',label:'商品'}];
const instance={instanceId:'products',title:'商品表',materialId:'data-table',materialVersion:1,design,dataSources:{[bindingId]:{id:'source',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,title:'商品',appId:'hallmark',connectionId:'offline',capabilityId:'products',capabilityMajor:1,parameters:[],fields:[{role:'product.name',path:'title',confirmed:true}],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},rowsPath:'items'};
let board={kind:'workbench',appId:'hallmark',workbenchId:'main',revision:1,context:{storeId:uiStore().id},instances:[instance],savedComponents:[]};
let tree,mode=503,held,requests=[],returns=0,changes=[],holdData=false,heldData;
globalThis.fetch=async(url,options)=>{
 const body=options?.body?JSON.parse(options.body):undefined;requests.push(body??String(url));
 if(body){assert.equal(body.operation,'read','no writes during recovery');if(holdData)return new Promise(resolve=>{heldData={resolve,signal:options.signal};});return Response.json({instanceId:'products',view:{viewId:'read',design:{...design,bindings:design.bindings.map(binding=>({...binding,fieldMap:{'product.name':'title'}}))}},dataSources:{[bindingId]:source},pages:{[bindingId]:{hasMore:false,loadedCount:2}},data:{viewId:'read',bindings:[{bindingId,datasetId:'recorded-products',payload:{items:uiProducts(2)},state:'ready',lastSuccessAt:'2026-10-16T00:00:00Z',freshness:'fresh',provenance:[]}]}});}
 const query=new URL(String(url),'http://fixture').searchParams;
 const resource=query.get('resource');
 if(resource==='apps')return Response.json({apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'},{appId:'notes',displayName:'笔记',runtimeState:'ready',hostProjectionState:'ready'}]});
 if(resource==='views')return Response.json({views:[]});
 if(resource==='connections'||resource==='bindings')return Response.json([]);
 if(resource==='diagnostics')return Response.json({invocations:[]});
 if(resource==='connectionStatus')return Response.json({state:'connected',node:{state:'healthy'},data:{state:'healthy',message:'本地测试'},checkedAt:'2026-10-16T00:00:00Z',canRestart:false});
 if(query.get('resource')==='stores')return Response.json({stores:[uiStore()]});
 assert.equal(query.get('resource'),'workbench');
 if(mode==='html403'||mode==='html404')return new Response('<html>denied</html>',{status:Number(mode.slice(4))});
 if(mode==='hold')return new Promise(resolve=>{held={resolve,signal:options.signal};});
 return typeof mode==='number'?Response.json({error:{code:mode===503?'UNAVAILABLE':mode===404?'NOT_FOUND':'ACCESS_DENIED',message:'工作台读取未成功。',retryPolicy:mode===503?'read_retry':'never'}},{status:mode}):Response.json({...board,appId:query.get('appId')});
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const content=()=>text(tree.root),button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name);
const draw=(detail,active=true,key='hallmark',snapshot,revision=0)=> <WorkbenchBoard key={key} appId={key} detailInstanceId={detail} active={active} snapshot={snapshot} revision={revision} onAdd={()=>{}} onConfigure={()=>{}} onReturn={()=>returns++} onChange={value=>changes.push(value.appId)}/>;
const update=async node=>act(async()=>{tree.update(node);await flush();});
const click=async name=>act(async()=>{assert.ok(button(name),'button '+name);button(name).props.onClick();await flush();});
const unknown=()=>{assert.doesNotMatch(content(),/此组件已从工作台移除|0 个常用组件/,'failed reads must not assert absence');assert.match(content(),/尚未读取到工作台.*重新读取工作台/);assert.ok(button('重新读取工作台'));};
try{
 for(const detail of ['products',undefined])for(const status of [503,403,404]){
  mode=status;await act(async()=>{tree=create(draw(detail));await flush();});unknown();
  const before=requests.length;await click('重新读取工作台');unknown();assert.ok(requests.length>before,'repeat failure issues a new read');
  mode='hold';await click('重新读取工作台');assert.match(content(),/正在打开工作台/);assert.doesNotMatch(content(),/此组件已从工作台移除|0 个常用组件/);
  await act(async()=>{held.resolve(Response.json(board));await flush();});assert.doesNotMatch(content(),/尚未读取到工作台|工作台读取未成功/);
  if(detail){assert.equal(tree.root.findAllByType('table').length,1);assert.match(JSON.stringify(tree.toJSON()),uiText(uiProduct({},0).title));await click('返回工作台');assert.ok(returns>0);}
  else assert.match(content(),/1 个常用组件/);
  await act(async()=>tree.unmount());tree=undefined;
 }
 // A transient metadata reload with an accepted snapshot preserves the reader and local filter.
 mode='ok';await act(async()=>{tree=create(draw('products',true,'hallmark',board));await flush();});
 const search=()=>tree.root.findByProps({'aria-label':'搜索当前快照'});
 await act(async()=>{search().props.onChange({target:{value:uiProduct({},0).title}});await flush();});
 const dataReads=requests.filter(request=>request?.operation==='read').length;
 mode=503;await update(draw('products',true,'hallmark',board,1));assert.equal(tree.root.findAllByType('table').length,1);assert.equal(search().props.value,uiProduct({},0).title);assert.ok(button('重新读取工作台'));
 await click('重新读取工作台');assert.equal(search().props.value,uiProduct({},0).title);
 mode='ok';await click('重新读取工作台');assert.equal(search().props.value,uiProduct({},0).title);assert.doesNotMatch(content(),/工作台读取未成功/);assert.equal(requests.filter(request=>request?.operation==='read').length,dataReads,'metadata retry must not refetch or replace the data reader');
 await act(async()=>tree.unmount());tree=undefined;
 // A denied metadata read must invalidate an already accepted snapshot, unlike temporary failure.
 for(const denied of [401,403,404,'html403','html404']){
  mode='ok';await act(async()=>{tree=create(draw('products',true,'hallmark',board));await flush();});
  await act(async()=>{search().props.onChange({target:{value:uiProduct({},0).title}});await flush();});
  mode=denied;await update(draw('products',true,'hallmark',board,1));
  assert.equal(tree.root.findAllByType('table').length,0,'metadata HTTP '+denied+' removes previously accepted data');unknown();
  await update(draw('products',true,'hallmark',{...board},1));assert.equal(tree.root.findAllByType('table').length,0,'a fresh reference to the rejected parent snapshot cannot restore protected content');
  await click('重新读取工作台');assert.equal(tree.root.findAllByType('table').length,0);
  mode='ok';await click('重新读取工作台');assert.equal(tree.root.findAllByType('table').length,1);assert.equal(search().props.value,'','authorized reread starts fresh local selection/filter state');
  await act(async()=>tree.unmount());tree=undefined;
 }
 // Confirmed success, unlike failure, may report an empty board or removed instance.
 board={...board,revision:2,instances:[]};mode='ok';await act(async()=>{tree=create(draw('products'));await flush();});assert.match(content(),/此组件已从工作台移除/);assert.doesNotMatch(content(),/尚未读取到工作台/);
 await update(draw(undefined));assert.match(content(),/0 个常用组件/);assert.doesNotMatch(content(),/尚未读取到工作台/);await act(async()=>tree.unmount());tree=undefined;
 // Hidden read cancellation and the production app-key boundary discard stale replies.
 mode='hold';await act(async()=>{tree=create(draw('products'));await flush();});const paused=held;
 await update(draw('products',false));assert.equal(paused.signal.aborted,true);mode=503;await update(draw('products'));unknown();await act(async()=>{paused.resolve(Response.json(board));await flush();});unknown();
 mode='hold';await click('重新读取工作台');const oldOwner=held;mode='ok';await update(draw(undefined,true,'notes'));assert.equal(oldOwner.signal.aborted,true);const accepted=changes.length;await act(async()=>{oldOwner.resolve(Response.json({...board,instances:[instance]}));await flush();});assert.equal(changes.length,accepted);assert.match(content(),/0 个常用组件/);assert.equal(tree.root.findAllByType('table').length,0);
 await act(async()=>tree.unmount());tree=undefined;
 // Real parent + directory + retained tabs: metadata rejection invalidates the shared board.
 board={...board,revision:3,instances:[instance,{...instance,instanceId:'other',title:'另一个商品表'}]};mode='ok';
 await act(async()=>{tree=create(<AppsWorkspace currentSessionId='workspace-A'/>);await flush();});
 const home=()=>tree.root.findAllByType(WorkbenchBoard).find(node=>!node.props.detailInstanceId);
 const open=async id=>act(async()=>{home().props.onOpenInstance(board.instances.find(row=>row.instanceId===id));await flush();});
 await open('products');await open('other');assert.equal(tree.root.findAllByType('table').length,2,'two retained detail readers are genuinely mounted');
 await click('商品表');holdData=true;
 await act(async()=>{tree.root.findByProps({'aria-label':'刷新商品表'}).props.onClick();await flush();});assert.ok(heldData);
 mode=403;await click('刷新列表');
 assert.equal(tree.root.findAllByType('table').length,0,'metadata denial clears both current and hidden parent-owned snapshots');
 assert.equal(home().props.snapshot,null,'parent records explicit board invalidation');await act(async()=>{window.dispatchEvent(new CustomEvent('apps-workbench-changed',{detail:{appId:'hallmark',board:{...board}}}));await flush();});assert.equal(home().props.snapshot,null,'a stale parent publication cannot bypass the denied scope');assert.equal(heldData.signal.aborted,true,'denial unmount cancels the child data read');
 assert.equal(tree.root.findAllByProps({'aria-label':'刷新商品表'}).length,0,'old detail interactions are removed');
 await act(async()=>{heldData.resolve(Response.json({}));await flush();});assert.equal(tree.root.findAllByType('table').length,0);
 holdData=false;await click('另一个商品表');assert.equal(tree.root.findAllByType('table').length,0,'switching retained tabs cannot rehydrate the rejected board');
 await click('工作台');assert.equal(tree.root.findAllByProps({'aria-label':'打开商品表'}).length,0,'returning to catalogue cannot restore rejected cards');
 const chooseApp=async label=>act(async()=>{tree.root.findAllByType('button').find(node=>node.props.className==='apps-app-row'&&text(node).includes(label)).props.onClick();await flush();});
 mode='ok';await chooseApp('笔记');assert.equal(home().props.snapshot.appId,'notes');
 mode='hold';await chooseApp('Hallmark');const returnRead=held;
 await act(async()=>{window.dispatchEvent(new CustomEvent('apps-workbench-changed',{detail:{appId:'hallmark',board:{...board}}}));await flush();});assert.equal(home().props.snapshot,undefined,'app navigation cannot clear the rejected-scope guard before a successful read');assert.equal(tree.root.findAllByProps({'aria-label':'打开商品表'}).length,0);
 mode='ok';await act(async()=>{returnRead.resolve(Response.json(board));await flush();});assert.ok(tree.root.findByProps({'aria-label':'打开商品表'}));await open('products');assert.equal(tree.root.findAllByType('table').length,1);

 // A delayed denial for an unmounted app must not clear a newer app's accepted snapshot.
 mode='hold';await click('刷新列表');const oldApp=held;mode='ok';
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.props.className==='apps-app-row'&&text(node).includes('笔记')).props.onClick();await flush();});
 assert.equal(oldApp.signal.aborted,true);assert.equal(home().props.appId,'notes');assert.equal(home().props.snapshot.appId,'notes');
 await act(async()=>{oldApp.resolve(Response.json({error:{code:'ACCESS_DENIED',message:'旧应用拒绝'}},{status:403}));await flush();});assert.equal(home().props.snapshot.appId,'notes');assert.ok(tree.root.findByProps({'aria-label':'打开商品表'}));
 assert.ok(requests.filter(request=>typeof request==='object').every(request=>request.operation==='read'));
 console.log('WORKBENCH_COLD_READ_RECOVERY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[...(old?[{name:'historical-board',setup(plugin:PluginBuild){plugin.onLoad({filter:/plugin-apps[\\/]client[\\/]workbench-board\.tsx$/},()=>({contents:old.stdout,loader:'tsx'}));}}]:[]),...(oldWorkspace?[{name:'historical-workspace',setup(plugin:PluginBuild){plugin.onLoad({filter:/plugin-apps[\\/]client[\\/]workspace\.tsx$/},()=>({contents:oldWorkspace.stdout,loader:'tsx'}));}}]:[])]});
 const result=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);assert.match(result.stdout,/WORKBENCH_COLD_READ_RECOVERY_PASS/);t.diagnostic(result.stdout.trim());
});
