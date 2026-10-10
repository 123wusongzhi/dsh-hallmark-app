import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {OZON_COMPOSE_DESCRIPTOR} from '../../packages/app-hallmark/src/ozon-compose.ts';
import {createOzonCompositionDraft,OZON_COMPOSITION_SOURCE_FIELDS,COMPOSITION_FIELD_MAP} from '../../packages/app-hallmark/src/ozon-composition.ts';
import type {CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';
import {createAppsClient,COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import {composedData,formatValue} from '../../docs/component-authoring/examples/composed-table/data.ts';

const params={dateFrom:'2026-09-01',dateTo:'2026-09-07',limit:1};
const recipe={version:1 as const,grain:'product' as const,fields:['products.title','prices.price','orders.title']};
const record=(value:unknown)=>value as Record<string,any>;
function data(result:CapabilityResult){assert.equal(result.status,'ok',JSON.stringify(result));return record('data' in result?result.data:undefined);}
// Pin the saved pre-snapshot contract: these integration tests intentionally exercise
// existing versioned sources and their SDK cursor pagination after the new defaults ship.
function legacyCompositionDraft(...args:Parameters<typeof createOzonCompositionDraft>):ReturnType<typeof createOzonCompositionDraft>{
  const definition=createOzonCompositionDraft(...args),{loadAll,...input}=definition.input;
  return {...definition,input:{...input,limit:20},parameters:[...definition.parameters.filter(parameter=>parameter.name!=='loadAll'),{name:'limit',label:'每页条数',type:'integer' as const,default:20},{name:'cursor',label:'分页位置',type:'string' as const}],operations:{...definition.operations,pagination:{cursorParam:'cursor',limitParam:'limit',nextCursorPath:'cursor',totalPath:'total'}}};
}
function setup(t:TestContext){
  const directory=mkdtempSync(join(tmpdir(),'source-reuse-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'sources'),join(directory,'workspace'));
  const calls:InvocationRequest[]=[];
  runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[OZON_COMPOSE_DESCRIPTOR],execute:async({request})=>{
    calls.push(request);const input=record(request.input),page=Number(input.cursor??0),selected=input.recipe.fields as string[];
    const row=Object.fromEntries([...new Set(selected.map(key=>key.split('.')[0]))].map(source=>[source,Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS[source as keyof typeof OZON_COMPOSITION_SOURCE_FIELDS].map(field=>[field,null]))]));
    if(row.products)Object.assign(row.products,{title:`${input.storeId} 商品 ${page}`,productId:String(page+1)});
    if(row.prices)Object.assign(row.prices,{price:49.9,currency:'CNY'});
    if(row.orders)Object.assign(row.orders,{title:'下单时商品名称'});
    return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:[row],total:2,dataTime:null,warnings:[],sourceStates:[],cache:{ttlMs:900000,fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),stale:false,nextRefreshAt:new Date(Date.now()+900000).toISOString()},...(page===0?{cursor:'1'}:{}),fieldMeta:selected.map(key=>{const field=COMPOSITION_FIELD_MAP.get(key)!;return {key,source:field.source,label:field.label,description:field.description,format:field.format,...(field.format==='currency'?{currencyPath:`${field.source}.currency`}:{})};})}};
  },dispose:async()=>{}});
  const presentation=new AppsPresentationService({store,runtime,sources});runtime.register(presentation.provider());
  for(const [appId,connectionId] of [['apps','presentation'],['hallmark','shop-link']]){runtime.addConnection({appId,connectionId,displayName:appId,config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'chat',appId,connectionId,enabled:true,boundAt:new Date().toISOString()});}
  const definition=legacyCompositionDraft('shop-link',recipe,'shared-composition');presentation.dataSources.installCatalog([definition]);
  const invoke=(name:string,input:unknown)=>runtime.invoke({protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId:name.startsWith('apps.')?name:`apps.presentation.${name}`,capabilityVersion:'1.0.0',input:input as JsonValue,source:{kind:'agent',sessionId:'chat',nativeCallId:randomUUID()},invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+30000).toISOString(),idempotencyKey:randomUUID()});
  t.after(async()=>{await runtime.dispose();store.close();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'source-reuse-'))));rmSync(directory,{recursive:true,force:true});});
  return {store,runtime,presentation,sources,calls,definition,invoke,directory};
}

test('Agent resolves a versioned source into a validated binding with distinct same-role fields',async t=>{
  const f=setup(t),resolved=data(await f.invoke('resolve_data_source',{id:f.definition.id,revision:1,bindingId:'main',context:{storeId:'A'},params}));
  assert.equal(resolved.binding.capabilityId,'hallmark.ozon.compose');assert.deepEqual(resolved.binding.input,{recipe,...params,storeId:'A'});
  assert.equal(resolved.fieldMap['products.title'],'products.title');assert.equal(resolved.fieldMap['orders.title'],'orders.title');assert.equal(resolved.fieldMap['ozon.title'],undefined);
  assert.equal(resolved.fieldMap['ozon.price'],'prices.price');assert.equal(resolved.fieldMeta['prices.price'].currencyPath,'prices.currency');assert.equal(f.calls.length,0);
  for(const input of [{params:{storeId:'B'}},{params:{recipe:{...recipe,fields:['finance.amount']}}},{revision:0},{context:undefined}]){
    const request={id:f.definition.id,revision:1,bindingId:'main',context:{storeId:'A'},params,...input};if(request.context===undefined)delete record(request).context;
    const result=await f.invoke('resolve_data_source',request);assert.equal(result.status,'failed');
  }
});

test('Agent validation uses runtime params without embedding the shop or dates into the reusable definition',async t=>{
  const f=setup(t),definition={...f.definition,id:'agent-composition'};
  const saved=data(await f.invoke('register_data_source',{definition,context:{storeId:'A'},params}));
  assert.equal(saved.validation.status,'verified');assert.equal(saved.validation.storeId,'A');assert.equal(record(f.calls.at(-1)!.input).dateFrom,params.dateFrom);
  assert.equal(saved.input.storeId,undefined);assert.equal(saved.input.dateFrom,undefined);assert.equal(saved.revision,1);
  assert.ok(data(await f.invoke('list_data_sources',{appId:'hallmark'})).sources.some((source:any)=>source.id==='agent-composition'));
  assert.equal(data(await f.invoke('validate_data_source',{definition,context:{storeId:'A'},params:{...params,storeId:'B'}})).status,'failed');
});

test('saved components and templates reopen using the pinned recipe in a different shop',async t=>{
  const f=setup(t),sourceRefs={main:{id:f.definition.id,revision:1,params:{...params,warehouseId:'11',cursor:'1'}}};
  // Inventory makes a warehouse filter an explicitly editable source parameter.
  const inventory=legacyCompositionDraft('shop-link',{...recipe,fields:[...recipe.fields,'stocks.stockAvailable']},f.definition.id);f.presentation.dataSources.installCatalog([inventory]);sourceRefs.main.revision=2;
  const view=data(await f.invoke('render_view',{title:'经营表',sourceRefs,context:{storeId:'A'}}));
  const component=data(await f.invoke('save_component',{viewId:view.viewId,mode:'save_as',userRequest:'保存组件'})),template=data(await f.invoke('save_template',{viewId:view.viewId,name:'经营模板',userRequest:'保存模板'}));
  const changed=legacyCompositionDraft('shop-link',{version:1,grain:'product',fields:['products.title']},f.definition.id);f.presentation.dataSources.installCatalog([changed]);
  for(const opened of [data(await f.invoke('open_component',{componentId:component.componentId,context:{storeId:'B'}})),data(await f.invoke('render_view',{title:'模板复用',templateId:template.assetId,context:{storeId:'B'}}))]){
    assert.equal(opened.context.storeId,'B');assert.equal(opened.sourceRefs.main.revision,2);assert.equal(opened.sourceRefs.main.params.warehouseId,undefined);assert.equal(opened.sourceRefs.main.params.cursor,undefined);
    assert.deepEqual(opened.bindings[0].input.recipe,inventory.input.recipe);assert.equal(opened.bindings[0].input.storeId,'B');assert.equal(opened.bindings[0].input.dateFrom,params.dateFrom);assert.notEqual(opened.bindings[0].datasetId,view.bindings[0].datasetId);
  }
  assert.equal(record(f.presentation.getView(view.viewId)!.bindings[0].input).storeId,'A');
});

test('legacy saved bindings switch shops while clearing shop-specific selectors, without requiring sourceRefs',t=>{
  const f=setup(t),resolved=f.presentation.resolveDataSource({id:f.definition.id,revision:1,bindingId:'main',context:{storeId:'A'},params:{...params,cursor:'1'}});
  const view=f.presentation.createView('chat',{title:'旧组件',bindings:[resolved.binding]}),saved=f.presentation.saveComponent('chat',view.viewId,'保存',{mode:'save_as'}),opened=f.presentation.openComponent('chat',saved.componentId,{context:{storeId:'B'}});
  assert.equal(record(opened.bindings[0].input).storeId,'B');assert.equal(record(opened.bindings[0].input).cursor,undefined);assert.equal(record(opened.bindings[0].input).dateFrom,params.dateFrom);
});

test('source authoring accepts library refs for new and edited drafts, including shop context',async t=>{
  const f=setup(t);f.presentation.configureAuthoring();const sourceRefs={main:{id:f.definition.id,revision:1,params}};
  const created=data(await f.invoke('apps.authoring.begin',{mode:'new',title:'源码复用',sourceRefs,context:{storeId:'A'}}));
  assert.equal(created.view.bindings[0].capabilityId,'hallmark.ozon.compose');assert.deepEqual(created.view.sourceRefs,sourceRefs);
  const edited=data(await f.invoke('apps.authoring.begin',{mode:'edit',viewId:created.view.viewId,context:{storeId:'B'}}));
  assert.equal(edited.view.bindings[0].input.storeId,'B');assert.equal(edited.view.sourceRefs.main.revision,1);assert.equal(edited.draft.workspacePath,created.draft.workspacePath);
});

test('the actual component SDK reads, pages and refreshes the same resolved source as the Agent',async t=>{
  const f=setup(t),resolved=data(await f.invoke('resolve_data_source',{id:f.definition.id,revision:1,bindingId:'main',context:{storeId:'A'},params}));
  const view=f.presentation.createView('chat',{title:'源码组件',sourceRefs:{main:resolved.sourceRef},context:{storeId:'A'}});
  await f.presentation.refreshView('chat',view.viewId,{kind:'agent',sessionId:'chat',nativeCallId:'initial'});
  const host=f.presentation.createHost({protocolVersion:'2.0',sessionId:'chat',viewId:view.viewId,buildId:'build',frameInstanceId:'frame'}),listeners=new Set<(event:MessageEvent)=>void>();
  const parent={postMessage:(message:unknown)=>{void host.handle(message).then(response=>{if(response)for(const listener of listeners)listener({data:response,source:parent,origin:'http://apps.test'} as MessageEvent);});}};
  const window={parent,location:{origin:'http://apps.test'},addEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.add(listener),removeEventListener:(_type:string,listener:(event:MessageEvent)=>void)=>listeners.delete(listener)} as unknown as Window;
  const client=createAppsClient({window,clientFeatures:['bindingPagesV1']});t.after(()=>{client.dispose();host.dispose();});
  const initial=composedData(await client.getData());assert.equal(initial.rows[0].products&&record(initial.rows[0].products).title,'A 商品 0');assert.equal(formatValue(initial.rows[0],initial.fields.find(field=>field.key==='prices.price')!),'¥49.90');
  const next=composedData(await client.readBindingPage('main',initial.cursor));assert.equal(record(next.rows[0].products).title,'A 商品 1');assert.equal(next.cursor,null);
  const refreshed=composedData(await client.refresh(['main']));assert.equal(record(refreshed.rows[0].products).title,'A 商品 0');
  assert.ok(f.calls.every(call=>call.capabilityId==='hallmark.ozon.compose'));assert.ok(f.calls.slice(1).every(call=>call.source.kind==='component'));assert.equal(record(f.presentation.getView(view.viewId)!.bindings[0].input).cursor,undefined);
});

test('a source frame cannot restore the previous shop page after its view context changes',async t=>{
  const f=setup(t),view=f.presentation.createView('chat',{title:'换店',sourceRefs:{main:{id:f.definition.id,revision:1,params}},context:{storeId:'A'}});
  const identity={protocolVersion:'2.0' as const,sessionId:'chat',viewId:view.viewId,buildId:'build',frameInstanceId:'old-frame'},host=f.presentation.createHost(identity,{clientFeatures:['bindingPagesV1']});t.after(()=>host.dispose());
  let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),gate=new Promise<void>(resolve=>release=resolve),invoke=f.runtime.invoke.bind(f.runtime);
  f.runtime.invoke=async(request,signal)=>{if(request.source.kind==='component'){enter();await gate;}return invoke(request,signal);};
  const pending=host.handle({...identity,channel:COMPONENT_CHANNEL,requestId:'old-page',type:'extension',feature:'bindingPagesV1',action:'read',params:{bindingId:'main',cursor:'1'}});await entered;
  f.presentation.createView('chat',{viewId:view.viewId,title:view.title,context:{storeId:'B'}});release();
  assert.equal(record(await pending).error.code,'BRIDGE_IDENTITY_STALE');const current=f.presentation.getData('chat',view.viewId);assert.equal(current.bindings[0].payload,null);assert.equal(record(current.bindings[0].query!.input).storeId,'B');
});
