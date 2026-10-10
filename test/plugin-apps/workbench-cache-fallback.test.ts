import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('cache UI preserves only matching binding snapshots, partial results, page selection and platform retry deadlines',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'cache-fallback-ui-')),entry=join(dir,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {AppsNativeView} from './packages/plugin-apps/client/view.tsx';
import {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
import {appsRefreshView,appsResource,appsWorkbench,mergeCachedAppsData} from './packages/plugin-apps/client/api.ts';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
import {datasetId} from './packages/app-contracts/src/index.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const document=new EventTarget();document.hidden=false;globalThis.document=document;globalThis.window=new EventTarget();
let now=100000;Date.now=()=>now;const timers=new Map();let sequence=0;globalThis.setTimeout=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const limited={code:'LOCAL_RATE_LIMIT',message:'平台暂时繁忙',retryPolicy:'read_retry',retryAfterMs:233000};
globalThis.fetch=async()=>Response.json({status:'failed',error:limited},{status:429});
for(const call of [()=>appsRefreshView('chat','A',true),()=>appsResource('view'),()=>appsWorkbench('hallmark','read',{})])await assert.rejects(call,error=>error.code==='LOCAL_RATE_LIMIT'&&error.httpStatus===429&&error.retryPolicy==='read_retry'&&error.retryAfterMs===233000);
const design=createMaterialView('data-table');design.bindings=['main','other'].map(id=>({id,datasetKey:id,fieldMap:{title:'title'}}));
design.widgets=['main','other'].map(id=>({...design.widgets[0],id,bindingId:id,fields:{title:'title'},columns:[{field:'title',label:'商品'},{field:'quantity',label:'库存'}],options:{rowsPath:'items'}}));design.layout.children=['main','other'];
const instance={instanceId:'test',title:'缓存测试',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:'source',revision:1,params:{}},other:{id:'other',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,appId:'hallmark',connectionId:'connection',capabilityId:'hallmark.ozon.compose',capabilityMajor:1,fields:[],parameters:[],rowsPath:'items',operations:{pagination:{cursorParam:'cursor'},search:{scope:'server',param:'search'},sort:{scope:'loaded'}}};
const query=input=>({appId:'hallmark',connectionId:'connection',capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',projection:['title','quantity'],input:{storeId:'store',search:'old',dateFrom:'2026-10-01',limit:100,...input}});
const success=(id,input={})=>({bindingId:id,appId:'hallmark',connectionId:'connection',datasetId:datasetId(query(input)),query:query(input),payload:{items:[{title:id+'商品'+version,quantity:5}],cache:{ttlMs:180000,fetchedAt:new Date(now).toISOString(),expiresAt:new Date(now+180000).toISOString(),nextRefreshAt:new Date(now+180000).toISOString(),stale:false}},state:'ready',lastSuccessAt:new Date(now).toISOString(),sourceDataTime:null,freshness:'fresh',provenance:[]});
let tree,mode='board',scenario='normal',version=0,requests=[],snapshot,ready;
const responseData=(input={})=>{const data={viewId:'A',bindings:['main','other'].map(id=>success(id,id==='main'?input:{}))},main=data.bindings[0];
 if(['failed','wrong-dataset','connection','forbidden'].includes(scenario)){Object.assign(main,{state:'failed',payload:null,error:scenario==='connection'?{...limited,code:'CONNECTION_CONFIG_CHANGED'}:scenario==='forbidden'?{...limited,code:'HALLMARK_HTTP_403'}:limited,lastSuccessAt:null});if(scenario==='wrong-dataset'){main.query=query({storeId:'another-store'});main.datasetId=datasetId(main.query);}}
 if(scenario==='missing'){main.payload.items[0].quantity=null;main.payload.sourceStates=[{source:'products',fetchedAt:new Date(now-90000).toISOString(),cacheHit:false,status:'ready'},{source:'stocks',fetchedAt:null,cacheHit:false,status:'missing',nextRetryAt:new Date(now+233000).toISOString()}];main.payload.cache.stale=true;main.payload.cache.nextRefreshAt=new Date(now+233000).toISOString();}
 return data;
};
globalThis.fetch=async(url,options)=>{const body=options?.body?JSON.parse(options.body):undefined;requests.push({url,body});
 if(body&&scenario==='http-rate')return Response.json({error:limited},{status:429});if(body&&scenario==='http-forbidden')return Response.json({error:{...limited,code:'ACCESS_DENIED'}},{status:403});
 const data=responseData(mode==='board'?{...body.params.params,...(typeof body.params.cursor==='string'?{cursor:body.params.cursor}:{})}:{});if(mode==='board')return Response.json({instanceId:'test',view:{viewId:'A',design},dataSources:{main:source,other:{...source,id:'other'}},pages:{main:{cursor:body.params.cursor??null,nextCursor:'page2',hasMore:true,loadedCount:1},other:{hasMore:false,loadedCount:1}},data});
 if(body)return Response.json(data);return Response.json(new URL(url,'http://fixture').searchParams.get('resource')==='view'?{viewId:'A',ownerSessionId:'chat',title:'组件',viewRevision:1,design,bindings:design.bindings.map(binding=>({bindingId:binding.id,datasetId:binding.id}))}:data);
};
const rendered=()=>JSON.stringify(tree.toJSON()),text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node)===name),renderer=()=>tree.root.findByType(ViewRenderer),update=async()=>act(async()=>{button('立即更新').props.onClick();await flush();});
const mount=async()=>{await act(async()=>{tree=create(mode==='board'?<WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId:'store'}} onSnapshot={value=>snapshot=value} onReady={value=>ready=value}/>:<AppsNativeView sessionId='chat' viewId='A'/>);await flush();});};
const unmount=async()=>{await act(async()=>tree.unmount());tree=undefined;assert.equal(timers.size,0);};
for(mode of ['board','native']){
 scenario='normal';version=0;await mount();const firstTime=renderer().props.data[0].payload.cache.fetchedAt;
 scenario='failed';version=1;await update();assert.match(rendered(),/main商品0/);assert.match(rendered(),/other商品1/);assert.equal(renderer().props.data[0].payload.cache.fetchedAt,firstTime);assert.equal(renderer().props.data[0].payload.cache.stale,true);assert.equal([...timers.values()][0].delay,233000);assert.equal(tree.root.findAll(node=>node.props.role==='alert').length,0,'cached failure is non-blocking');
 if(mode==='board')assert.equal(ready,false,'cached preview cannot validate a new definition');
 scenario='normal';await update();scenario='http-rate';await update();assert.match(rendered(),/main商品1/);assert.equal([...timers.values()][0].delay,233000);assert.equal(tree.root.findAll(node=>node.props.role==='alert').length,0);
 scenario='wrong-dataset';await update();assert.doesNotMatch(rendered(),/main商品1/);assert.match(rendered(),/other商品1/);
 for(const denied of ['connection','forbidden']){scenario='normal';await update();scenario=denied;await update();assert.doesNotMatch(rendered(),/main商品1/,'authorization and connection failures discard cached contents');assert.match(rendered(),/other商品1/);}
 scenario='normal';await update();scenario='missing';await update();assert.match(rendered(),/部分信息待更新，其余可继续查看/);assert.equal(renderer().props.data[0].payload.items[0].quantity,null);assert.equal(renderer().props.data[0].payload.sourceStates[1].fetchedAt,null);if(mode==='board'){assert.match(rendered(),/库存.*待更新/);assert.equal(ready,false);}
 scenario='normal';await update();scenario='http-forbidden';await update();assert.doesNotMatch(rendered(),/main商品1|other商品1/);assert.equal(timers.size,0,'denied read must not schedule background retries');await unmount();
}
mode='board';scenario='normal';version=2;await mount();const initialTime=snapshot.data.bindings[0].payload.cache.fetchedAt,firstDataset=snapshot.data.bindings[0].datasetId;assert.equal(renderer().props.interactions.bindings.main.appliedSearch,'old','reopened workbench passes its actual persisted search to the widget');
await act(async()=>{renderer().props.interactions.onSelect({widgetId:'main',field:'title',value:'picked'});await flush();});
scenario='failed';await act(async()=>{button('下一批数据').props.onClick();await flush();});assert.notEqual(datasetId(query({cursor:'page2'})),firstDataset,'real cursor pagination changes the dataset id');assert.equal(snapshot.pages.main.cursor,null,'failed next-page keeps displayed page');assert.equal(snapshot.data.bindings[0].datasetId,firstDataset,'cached page retains its original dataset id');assert.equal(snapshot.data.bindings[0].payload.cache.fetchedAt,initialTime);assert.equal(renderer().props.interactions.selectedByWidget.main,'picked');assert.deepEqual(snapshot.data.bindings[0].query,query({}));
scenario='normal';version=3;await act(async()=>{button('下一批数据').props.onClick();await flush();});assert.equal(snapshot.pages.main.cursor,'page2');const secondDataset=snapshot.data.bindings[0].datasetId;assert.notEqual(secondDataset,firstDataset);scenario='failed';await update();assert.equal(snapshot.pages.main.cursor,'page2','rate-limited refresh to first page keeps current page');assert.equal(snapshot.data.bindings[0].datasetId,secondDataset);assert.equal(snapshot.data.bindings[0].query.input.cursor,'page2');await act(async()=>{button('返回第一批').props.onClick();await flush();});assert.equal(snapshot.pages.main.cursor,'page2','explicit first-page failure also keeps current page');
await act(async()=>{renderer().props.interactions.bindings.main.onQueryChange({search:'new'});await flush();});assert.equal(snapshot.data.bindings[0].payload,null,'a changed query must not inherit the old page');assert.equal(snapshot.data.bindings[0].query.input.search,'new');assert.equal(renderer().props.interactions.bindings.main.appliedSearch,'new');await act(async()=>{button('下一批数据').props.onClick();await flush();});assert.notEqual(requests.at(-1).body.params.params?.search,'new','failed query must not replace committed paging query');scenario='normal';await act(async()=>{renderer().props.interactions.bindings.main.onQueryChange({search:''});await flush();});assert.equal(renderer().props.interactions.bindings.main.appliedSearch,'','clearing search is passed as an empty string');await unmount();
const original={viewId:'A',bindings:[success('main')]};
for(const changes of [{input:{storeId:'other'}},{input:{search:'new'}},{input:{dateFrom:'2026-10-02'}},{input:{limit:20}},{connectionId:'different'},{capabilityId:'another.capability'},{capabilityVersion:'2.0.0'},{projection:['title']}]){const changedQuery={...query({cursor:'page2'}),...changes,input:{...query({cursor:'page2'}).input,...changes.input}},bad={viewId:'A',bindings:[{...success('main'),query:changedQuery,datasetId:datasetId(changedQuery),payload:null,state:'failed',error:limited,...(changes.connectionId?{connectionId:changes.connectionId}:{})}]};assert.equal(mergeCachedAppsData(bad,original,{main:'cursor'}).data.bindings[0].payload,null,'pagination never crosses store, filter, date, connection or query definition scopes');}
const pageFailure={viewId:'A',bindings:[{...success('main',{cursor:'page2'}),payload:null,state:'failed',error:limited}]};assert.equal(mergeCachedAppsData(pageFailure,original).data.bindings[0].payload,null,'dataset exception requires explicit pagination permission');assert.equal(mergeCachedAppsData(pageFailure,original,{main:'cursor'}).data.bindings[0].datasetId,original.bindings[0].datasetId);
console.log('CACHE_FALLBACK_UI_PASS');
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/CACHE_FALLBACK_UI_PASS/);
 }finally{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});}
});
