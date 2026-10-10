import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {APP_PRESENTATION_DESCRIPTORS,AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';
import {assessRollback,rollbackBaseline} from '../../packages/app-migration/src/maintenance.ts';
import {DataSourceLibrary} from '../../packages/app-presentation/src/data-sources.ts';
import {WorkbenchLibrary} from '../../packages/app-presentation/src/workbench.ts';
import {dataSourceCompatibility,FIELD_ROLES} from '../../packages/app-presentation/src/field-roles.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import type {DataSourceDraft,WorkbenchInstance} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityDescriptor,CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

const source={kind:'agent' as const,sessionId:'s',nativeCallId:'fixture'};
const descriptor:CapabilityDescriptor={capabilityId:'shop.products',version:'1.0.0',effect:'query',title:'商品',description:'fixture',inputSchema:{type:'object',properties:{limit:{type:'integer'},cursor:{type:'string'},productId:{type:'string'},query:{type:'string',minLength:1}},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]};
const definition:DataSourceDraft={id:'products',title:'店铺商品',appId:'shop',connectionId:'shop-1',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{limit:2},parameters:[{name:'limit',label:'每页数量',type:'integer'},{name:'cursor',label:'下一页',type:'string'},{name:'productId',label:'商品编号',type:'string',linked:true},{name:'query',label:'查询',type:'string'}],rowsPath:'items',fields:[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true},{role:'price.current',path:'price',confirmed:true,currency:'CNY',numericScale:0.01},{role:'sku.id',path:'sku',confirmed:true},{role:'sku.specification',path:'spec',confirmed:true}],operations:{pagination:{cursorParam:'cursor',limitParam:'limit'},search:{scope:'loaded'},sort:{scope:'loaded'}}};
function fixture(t:{after:(fn:()=>void)=>void}) {
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());const calls:InvocationRequest[]=[];
 let payload:JsonValue={items:[{id:'p1',name:'商品一',price:1999,sku:'sku1',spec:'蓝色'}],total:3,cursor:'next'};
 const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:structuredClone(payload)};}};
 const presentation=new AppsPresentationService({store,runtime}),dataSources=new DataSourceLibrary({store,runtime}),workbench=new WorkbenchLibrary({store,runtime,dataSources,refreshBinding:(...args)=>presentation.refreshBinding(...args)});
 return {store,runtime,dataSources,workbench,calls,presentation,setPayload:(value:JsonValue)=>{payload=value;}};
}
const instance=(id='a',preset=false):WorkbenchInstance=>({instanceId:id,title:'商品',materialId:preset?'product-browser':'product-list',materialVersion:1,design:createMaterialView(preset?'product-browser':'product-list') as unknown as JsonValue,dataSources:{products:{id:'products',revision:1,params:{}},...(preset?{sku:{id:'products',revision:1,params:{}}}:{})},position:{order:0}});

test('semantic compatibility requires confirmed roles, independently of familiar raw keys',()=>{
 assert.equal(dataSourceCompatibility({fields:[{role:'product.id',path:'id',confirmed:false}]},['product.id']).compatible,false);
 assert.equal(dataSourceCompatibility({fields:[{role:'product.id',path:'completely_different',confirmed:true}]},['product.id']).compatible,true);
});
test('registration calls the real runtime, rejects missing paths and currency, and preserves revision history',async t=>{
 const f=fixture(t);const first=await f.dataSources.register({definition},source);assert.equal(f.calls.length,1);assert.equal(first.validation.status,'verified');assert.ok(first.validation.invocationId);
 const second=await f.dataSources.register({definition:{...definition,title:'商品新版'},expectedRevision:1},source);assert.equal(second.revision,2);assert.equal(f.dataSources.get('products',1).title,'店铺商品');assert.equal(f.dataSources.list().length,1);
 await assert.rejects(f.dataSources.register({definition,expectedRevision:1},source),{code:'DATA_SOURCE_CONFLICT'});
 const bad={...definition,id:'missing',fields:[...definition.fields,{role:'product.image',path:'notPresent',confirmed:true}]};
 await assert.rejects(f.dataSources.register({definition:bad},source),{code:'DATA_SOURCE_VALIDATION_FAILED'});assert.equal(f.dataSources.list().length,1);
 const missingCurrency={...definition,id:'no-currency',fields:definition.fields.map(field=>field.role==='price.current'?{role:field.role,path:field.path,confirmed:true}:field)};
 const validation=await f.dataSources.validate({definition:missingCurrency},source);assert.equal(validation.status,'failed');assert.match(validation.issues.join(' '),/币种/);
 f.setPayload({items:[]});assert.equal((await f.dataSources.validate({definition},source)).status,'failed');
});
test('workbench CAS persists explicit bindings and identical instances share a runtime read',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);f.calls.length=0;
 const board=f.workbench.save('shop',{expectedRevision:0,instances:[instance('a'),instance('b')]});assert.equal(board.workbenchId,'workbench:shop');assert.equal(board.instances[0].bindings?.[0].connectionId,'shop-1');
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:0,instances:[]}),{code:'WORKBENCH_CONFLICT'});
 const [a,b]=await Promise.all([f.workbench.read('shop','a'),f.workbench.read('shop','b')]);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].source,{kind:'workbench',workbenchId:'workbench:shop',instanceId:'a'});assert.equal(a.data.bindings[0].datasetId,b.data.bindings[0].datasetId);assert.equal(a.pages.products.nextCursor,'next');assert.equal(a.pages.products.total,3);
 const reopened=new WorkbenchLibrary({store:f.store,runtime:f.runtime,dataSources:f.dataSources,refreshBinding:(...args)=>f.presentation.refreshBinding(...args)});assert.equal(reopened.get('shop').instances.length,2);
});

test('saved component pins persist without queries or work copies and survive store and instance saves',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 const view=f.presentation.createView('s',{title:'采购组件',bindings:[{bindingId:'products',appId:'shop',connectionId:'shop-1',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
 const component=f.presentation.saveComponent('s',view.viewId,'保存采购组件',{mode:'save_as'}),beforeViews=f.store.list('views'),beforeComponents=f.store.list('components');f.calls.length=0;
 let board=f.workbench.pinComponent('shop',{componentId:component.componentId,revision:component.revision,expectedRevision:0});
 assert.equal(board.revision,1);assert.equal(board.instances.length,0);assert.deepEqual(board.savedComponents?.map(item=>[item.componentId,item.revision,item.title]),[[component.componentId,1,'采购组件']]);
 assert.deepEqual(f.workbench.pinComponent('shop',{componentId:component.componentId,revision:1,expectedRevision:0}),board,'an identical retry is idempotent even after its original CAS version advances');
 board=f.workbench.save('shop',{expectedRevision:board.revision,instances:[instance()],context:{storeId:'Bill'}});
 board=f.workbench.save('shop',{expectedRevision:board.revision,instances:board.instances,context:{storeId:'Helen'}});
 assert.equal(board.savedComponents?.[0].componentId,component.componentId);assert.equal(board.context?.storeId,'Helen');assert.equal(board.instances.length,1);
 assert.deepEqual(f.store.list('views'),beforeViews);assert.deepEqual(f.store.list('components'),beforeComponents);assert.equal(f.calls.length,0);
 const reopened=new WorkbenchLibrary({store:f.store,runtime:f.runtime,dataSources:f.dataSources,refreshBinding:(...args)=>f.presentation.refreshBinding(...args)});
 assert.deepEqual(reopened.get('shop').savedComponents,board.savedComponents);
 const draft={...definition,id:'new-products'},newInstance={...instance('new-source'),dataSources:{products:{id:draft.id,revision:1,params:{},draft}}};
 const withSource=await f.workbench.saveWithDrafts('shop',{expectedRevision:board.revision,instances:[...board.instances,newInstance]},source);
 assert.deepEqual(withSource.savedComponents,board.savedComponents);assert.equal(withSource.instances.length,2);assert.equal(f.dataSources.get(draft.id).revision,1);
});

test('pins enforce component, application, revision and board CAS while removed components remain unpinnable',async t=>{
 const f=fixture(t),view=f.presentation.createView('s',{title:'组件',bindings:[{bindingId:'products',appId:'shop',connectionId:'shop-1',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
 const first=f.presentation.saveComponent('s',view.viewId,'保存',{mode:'save_as'}),pin={componentId:first.componentId,revision:1,expectedRevision:0};
 assert.throws(()=>f.workbench.pinComponent('other',pin),{code:'COMPONENT_APP_MISMATCH'});
 assert.throws(()=>f.workbench.pinComponent('shop',{...pin,componentId:'missing'}),{code:'COMPONENT_NOT_FOUND'});
 assert.throws(()=>f.workbench.pinComponent('shop',{...pin,revision:42}),{code:'COMPONENT_REVISION_NOT_FOUND'});
 assert.throws(()=>f.workbench.pinComponent('shop',{...pin,revision:0}),{code:'INVALID_INPUT'});
 const initial=f.workbench.pinComponent('shop',pin),second=f.presentation.saveComponent('s',view.viewId,'更新',{mode:'update',componentId:first.componentId,expectedRevision:1,title:'新版组件'});
 assert.throws(()=>f.workbench.pinComponent('shop',{...pin,revision:second.revision}),{code:'WORKBENCH_CONFLICT'});
 const updated=f.workbench.pinComponent('shop',{...pin,revision:second.revision,expectedRevision:initial.revision});
 assert.equal(updated.savedComponents?.length,1);assert.equal(updated.savedComponents?.[0].title,'新版组件');
 assert.throws(()=>f.workbench.unpinComponent('shop',{componentId:first.componentId,expectedRevision:0}),{code:'WORKBENCH_CONFLICT'});
 f.store.delete('components',first.componentId);
 assert.throws(()=>f.workbench.pinComponent('shop',{...pin,revision:2,expectedRevision:updated.revision}),{code:'COMPONENT_NOT_FOUND'});
 assert.equal(f.workbench.get('shop').savedComponents?.length,1,'a removed saved component remains visible so its launcher can be removed explicitly');
 const cleared=f.workbench.unpinComponent('shop',{componentId:first.componentId,expectedRevision:updated.revision});assert.deepEqual(cleared.savedComponents,[]);
 assert.deepEqual(f.workbench.unpinComponent('shop',{componentId:first.componentId,expectedRevision:0}),cleared);assert.equal(f.calls.length,0);
});
test('workbench source references reject omitted and invalid revisions, including previously persisted instances',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 for(const revision of [undefined,null,0,-1,1.5,'1']){
  const draft=instance(),ref=draft.dataSources!.products as unknown as Record<string,unknown>;
  if(revision===undefined)delete ref.revision;else ref.revision=revision;
  assert.throws(()=>f.workbench.save('shop',{expectedRevision:0,instances:[draft]}),{code:'DATA_SOURCE_REVISION_REQUIRED'});
 }
 assert.equal(f.workbench.get('shop').revision,0);
 const legacy=instance();delete (legacy.dataSources!.products as unknown as Record<string,unknown>).revision;
 f.store.put('saved_assets','workbench:shop',{kind:'workbench',workbenchId:'workbench:shop',appId:'shop',revision:1,instances:[legacy],updatedAt:new Date().toISOString()});
 f.calls.length=0;
 await assert.rejects(f.workbench.read('shop','a'),{code:'DATA_SOURCE_REVISION_REQUIRED'});
 assert.equal(f.calls.length,0,'an unfixed legacy source must not fall back to the latest revision or perform a read');
});
test('a saved instance keeps its data source revision when newer mappings are registered',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 f.workbench.save('shop',{expectedRevision:0,instances:[instance()]});
 f.setPayload({items:[{id:'p1',name:'原字段',updatedName:'新版字段',price:1999,sku:'sku1',spec:'蓝色'}]});
 await f.dataSources.register({definition:{...definition,fields:definition.fields.map(field=>field.role==='product.name'?{...field,path:'updatedName'}:field)},expectedRevision:1},source);
 const result=await f.workbench.read('shop','a');
 assert.equal(f.dataSources.get('products').revision,2);assert.equal(result.dataSources.products.revision,1);
 const design=result.view.design as unknown as {bindings:{id:string;fieldMap:Record<string,string>}[]};
 assert.equal(design.bindings.find(binding=>binding.id==='products')?.fieldMap['product.name'],'name');
 assert.equal(f.workbench.get('shop').instances[0].dataSources?.products.revision,1);
});
test('linked detail waits for selection and only declared link or paging parameters can change',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);f.workbench.save('shop',{expectedRevision:0,instances:[instance('a',true)]});f.calls.length=0;
 const initial=await f.workbench.read('shop','a');assert.equal(initial.data.bindings.find(binding=>binding.bindingId==='sku')?.state,'empty');assert.equal(f.calls.length,1);
 await assert.rejects(f.workbench.read('shop','a',{bindingId:'sku',params:{query:'not-declared-link'}}),{code:'PARAMETER_NOT_ALLOWED'});
 const selected=await f.workbench.read('shop','a',{bindingId:'sku',params:{productId:'p2'}});assert.equal((selected.data.bindings.find(binding=>binding.bindingId==='sku')?.query?.input as {productId:string}).productId,'p2');
 await f.workbench.read('shop','a',{bindingId:'products',cursor:'next'});assert.equal((f.calls.at(-1)?.input as {cursor:string}).cursor,'next');
 await f.workbench.read('shop','a',{bindingId:'sku'});assert.equal((f.calls.at(-1)?.input as {productId:string}).productId,'p2');
});
test('a newer linked request replaces slow old results while unrelated instances stay readable',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);f.workbench.save('shop',{expectedRevision:0,instances:[instance('a',true),instance('b')]});
 let release!:()=>void,started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});const original=f.runtime.invoke;
 f.runtime.invoke=async request=>{if((request.input as {productId?:string}).productId==='slow'){started();await new Promise<void>(resolve=>{release=resolve;});}return original(request);};
 const slow=f.workbench.read('shop','a',{bindingId:'sku',params:{productId:'slow'}});await pending;
 const latest=await f.workbench.read('shop','a',{bindingId:'sku',params:{productId:'fast'}});assert.equal((latest.data.bindings.find(binding=>binding.bindingId==='sku')?.query?.input as {productId:string}).productId,'fast');
 release();await assert.rejects(slow,{code:'PAGE_SUPERSEDED'});assert.equal((await f.workbench.read('shop','b')).data.bindings[0].state,'ready');
});

test('presentation registration gateway commits a receipt and saved listing filters new asset kinds',async t=>{
 const f=fixture(t);
 const request:InvocationRequest={protocolVersion:'1.0',appId:'apps',connectionId:'presentation',capabilityId:'apps.presentation.register_data_source',capabilityVersion:'1.0.0',input:{definition:definition as unknown as JsonValue},source,invocationId:'register-1',traceId:'register-1',deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:'register-1'};
 const context={request,signal:new AbortController().signal,operationId:'operation-1'};
 const registered=await f.presentation.execute(context);assert.equal(registered.status,'ok');assert.equal(f.calls.length,1);
 assert.ok(f.store.get('provider_records','presentation-mutation:operation-1'));
 const inspected=await f.presentation.provider().inspect!('operation-1',context);assert.equal(inspected.status,'ok');assert.equal(f.calls.length,1);
 f.presentation.saveWorkbench('shop',{expectedRevision:0,instances:[instance()]});
 f.store.put('saved_assets','entry:entry-1',{assetId:'entry-1',kind:'entry',componentId:'component-1',title:'旧入口',userRequest:'保存',pinned:false,order:0});
 const listed=await f.presentation.execute({...context,request:{...request,capabilityId:'apps.presentation.list_saved',input:{}}});assert.equal(listed.status,'ok');
 if(listed.status==='ok'){
  const schema=APP_PRESENTATION_DESCRIPTORS.find(item=>item.capabilityId==='apps.presentation.list_saved')!.outputSchema;
  assert.deepEqual(compileSchema(schema)(listed.data),[]);assert.deepEqual((listed.data as {assets:{kind:string}[]}).assets.map(asset=>asset.kind),['entry']);
 }
 const sources=await f.presentation.execute({...context,request:{...request,capabilityId:'apps.presentation.list_data_sources',input:{appId:'shop'}}});assert.equal(sources.status,'ok');
 if(sources.status==='ok')assert.equal((sources.data as {sources:unknown[]}).sources.length,1);
 const materials=await f.presentation.execute({...context,request:{...request,capabilityId:'apps.presentation.list_materials',input:{}}});assert.equal(materials.status,'ok');
 if(materials.status==='ok'){
  const catalog=materials.data as {materials:unknown[];fieldRoles:unknown[]};
  assert.ok(catalog.materials.length);assert.deepEqual(catalog.fieldRoles,FIELD_ROLES);
  const schema=APP_PRESENTATION_DESCRIPTORS.find(item=>item.capabilityId==='apps.presentation.list_materials')!.outputSchema;
  assert.deepEqual(compileSchema(schema)(catalog),[]);assert.ok(compileSchema(schema)({materials:catalog.materials}).length,'Agent discovery requires the shared field dictionary');
 }
});

test('view linked reads whitelist exact declared parameters and discard stale scope responses',async t=>{
 const f=fixture(t),view=f.presentation.createView('s',{title:'关联',design:{links:[{from:{widgetId:'products',event:'select',field:'product.id'},to:{bindingId:'sku',param:'productId'}}]},bindings:[{bindingId:'sku',appId:'shop',connectionId:'shop-1',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
 await assert.rejects(f.presentation.readLinkedBinding(view,'frame','sku',{limit:1},source),{code:'LINK_PARAMETER_NOT_ALLOWED'});
 const result=await f.presentation.readLinkedBinding(view,'frame','sku',{productId:'p1'},source);assert.equal((result.bindings[0].query?.input as {productId:string}).productId,'p1');
 assert.equal(f.presentation.scopedData(view,'other-frame').bindings[0].state,'empty');
});

test('search changes restart pagination without losing the new query, and source parameters stay fixed',async t=>{
 const f=fixture(t),searchable={...definition,operations:{...definition.operations,search:{scope:'server' as const,param:'query'}}};
 await f.dataSources.register({definition:searchable},source);f.workbench.save('shop',{expectedRevision:0,instances:[instance()]});
 await f.workbench.read('shop','a',{bindingId:'products',params:{query:'旧条件'}});
 await f.workbench.read('shop','a',{bindingId:'products',cursor:'next',params:{query:'旧条件'}});
 await f.workbench.read('shop','a',{bindingId:'products',cursor:null,params:{query:'新条件'}});
 assert.deepEqual(f.calls.at(-1)?.input,{limit:2,query:'新条件'});
 await f.dataSources.register({definition:{...definition,id:'fixed',parameters:definition.parameters.map(parameter=>parameter.name==='limit'?{...parameter,editable:false}:parameter)}},source);
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:1,instances:[{...instance(),dataSources:{products:{id:'fixed',revision:1,params:{limit:999}}}}]}),{code:'PARAMETER_NOT_ALLOWED'});
});

test('full automatic and manual refresh retain each binding server filters and linked selection while clearing cursors',async t=>{
 const f=fixture(t),sortableDescriptor={...descriptor,inputSchema:{...descriptor.inputSchema,properties:{...(descriptor.inputSchema.properties as Record<string,JsonValue>),sortBy:{type:'string'},sortDirection:{type:'string'}}}};
 f.runtime.describe=()=>sortableDescriptor;
 const searchable:DataSourceDraft={...definition,parameters:[...definition.parameters,{name:'sortBy',label:'排序字段',type:'string'},{name:'sortDirection',label:'排序方向',type:'string'}],operations:{...definition.operations,search:{scope:'server',param:'query'},sort:{scope:'server',param:'sortBy',directionParam:'sortDirection'}}};
 await f.dataSources.register({definition:searchable},source);f.workbench.save('shop',{expectedRevision:0,instances:[instance('a',true)]});
 const products={query:'商品筛选',sortBy:'name',sortDirection:'asc'},sku={productId:'p2',query:'规格筛选',sortBy:'price',sortDirection:'desc'};
 await f.workbench.read('shop','a',{bindingId:'products',params:products});await f.workbench.read('shop','a',{bindingId:'sku',params:sku});
 for(const forceRefresh of [false,true]){
  await f.workbench.read('shop','a',{bindingId:'products',cursor:'next'});await f.workbench.read('shop','a',{bindingId:'sku',cursor:'detail-next'});
  f.calls.length=0;const refreshed=await f.workbench.read('shop','a',{refresh:true,forceRefresh});
  assert.deepEqual(f.calls.map(call=>call.input),[{limit:2,...products},{limit:2,...sku}]);
  assert.equal(refreshed.pages.products.cursor,null);assert.equal(refreshed.pages.sku.cursor,null);
  assert.deepEqual(refreshed.data.bindings.map(binding=>binding.query!.input),[{limit:2,...products},{limit:2,...sku}]);
 }
});

test('full preview refresh drops previous query state when source, source parameters or shop context changes',async t=>{
 const f=fixture(t);f.runtime.describe=()=>({...descriptor,inputSchema:{...descriptor.inputSchema,properties:{...(descriptor.inputSchema.properties as Record<string,JsonValue>),storeId:{type:'string'}}}});
 const searchable:DataSourceDraft={...definition,storeScoped:true,parameters:[...definition.parameters,{name:'storeId',label:'店铺',type:'string',required:true,editable:false}],operations:{...definition.operations,search:{scope:'server',param:'query'}}};
 await f.dataSources.register({definition:searchable,context:{storeId:'A'}},source);await f.dataSources.register({definition:{...searchable,id:'other',input:{limit:1}},context:{storeId:'A'}},source);
 const draft=instance('preview');
 for(const change of ['source','parameters','store'] as const){
  const scope=change;await f.workbench.preview('shop',draft,source,{scope,context:{storeId:'A'},bindingId:'products',params:{query:'旧店旧条件'}});
  await f.workbench.preview('shop',draft,source,{scope,context:{storeId:'A'},bindingId:'products',cursor:'old-next'});
  const next=structuredClone(draft),context={storeId:change==='store'?'B':'A'};
  if(change==='source')next.dataSources!.products.id='other';
  if(change==='parameters')next.dataSources!.products.params={limit:5};
  const refreshed=await f.workbench.preview('shop',next,source,{scope,context,refresh:true,forceRefresh:true});
  assert.deepEqual(f.calls.at(-1)!.input,{limit:change==='source'?1:change==='parameters'?5:2,storeId:context.storeId});
  assert.equal(refreshed.pages.products.cursor,null);assert.equal((refreshed.data.bindings[0].query!.input as Record<string,JsonValue>).query,undefined);
 }
});

test('changing a preview source discards old selection and an obsolete response',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);await f.dataSources.register({definition:{...definition,id:'other',input:{limit:1}}},source);
 const draft=instance('preview',true);await f.workbench.preview('shop',draft,source,{bindingId:'sku',params:{productId:'old'}});
 let release!:()=>void,started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;}),original=f.runtime.invoke;
 f.runtime.invoke=async request=>{if((request.input as {productId?:string}).productId==='slow'){started();await new Promise<void>(resolve=>{release=resolve;});}return original(request);};
 const slow=f.workbench.preview('shop',draft,source,{bindingId:'sku',params:{productId:'slow'}});await pending;
 const changed={...draft,dataSources:{...draft.dataSources,sku:{id:'other',revision:1,params:{}}}};
 const result=await f.workbench.preview('shop',changed,source);assert.equal(result.data.bindings.find(binding=>binding.bindingId==='sku')?.state,'empty');
 release();await assert.rejects(slow,{code:'PAGE_SUPERSEDED'});
});

test('clearing server search removes the optional filter and permits subsequent pages without restoring it',async t=>{
 const f=fixture(t),searchable={...definition,input:{...definition.input,query:'默认搜索'},operations:{...definition.operations,search:{scope:'server' as const,param:'query'}}};
 await f.dataSources.register({definition:searchable},source);
 const saved=instance();saved.dataSources!.products.params={productId:'p1'};f.workbench.save('shop',{expectedRevision:0,instances:[saved]});
 for(const empty of ['', ' \t ']){
  await f.workbench.read('shop','a',{bindingId:'products',params:{query:'6138371438'}});
  await f.workbench.read('shop','a',{bindingId:'products',cursor:'next',params:{query:'6138371438'}});
  const cleared=await f.workbench.read('shop','a',{bindingId:'products',cursor:null,params:{query:empty}});
  assert.equal(cleared.data.bindings[0].state,'ready');assert.equal(cleared.pages.products.nextCursor,'next');assert.deepEqual(f.calls.at(-1)?.input,{limit:2,productId:'p1'});
  const page=await f.workbench.read('shop','a',{bindingId:'products',cursor:'next',params:{query:empty}});
  assert.equal(page.data.bindings[0].state,'ready');assert.deepEqual(f.calls.at(-1)?.input,{limit:2,productId:'p1',cursor:'next'});
  await f.workbench.read('shop','a',{bindingId:'products',cursor:'next-2'});
  assert.deepEqual(f.calls.at(-1)?.input,{limit:2,productId:'p1',cursor:'next-2'});
 }
});

test('display edits preserve column labels while fields and units come from the verified source',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 const configured=instance(),design=configured.design as unknown as ReturnType<typeof createMaterialView>;
 design.widgets[0].options={...design.widgets[0].options,columns:[{field:'price.current',label:'我的售价'},{field:'product.name',label:'名称'}],density:'compact'};
 design.widgets[0].fields={'price.current':'wrong','metric.margin':'unverified'};
 const derived=f.workbench.derive('shop',configured).view.design as unknown as ReturnType<typeof createMaterialView>;
 assert.deepEqual(derived.widgets[0].options?.columns,design.widgets[0].options.columns);assert.equal(derived.widgets[0].options?.density,'compact');assert.equal(derived.widgets[0].fields?.['price.current'],'price');assert.equal(derived.widgets[0].fields?.['metric.margin'],undefined);
 assert.equal((derived.widgets[0].options?.fieldMeta as Record<string,{numericScale:number}>)['price.current'].numericScale,0.01);
});

test('rollback tracks workbenches and each data source revision as distinct saved assets',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);await f.dataSources.register({definition:{...definition,id:'second'}},source);
 await f.dataSources.register({definition:{...definition,title:'更新'},expectedRevision:1},source);
 f.workbench.save('shop',{expectedRevision:0,instances:[instance()]});
 const baseline=rollbackBaseline(f.store);assert.equal(Object.keys(baseline.savedAssetDigest).length,6);assert.equal(assessRollback(f.store,baseline,new Date().toISOString()).branch,'A');
 f.store.delete('saved_assets','data_source_revision:products:1');
 const assessment=assessRollback(f.store,baseline,new Date().toISOString());assert.equal(assessment.branch,'B');assert.deepEqual(assessment.incrementalExport.deletedAssets,['data_source_revision:products:1']);assert.deepEqual(assessment.incrementalExport.savedAssets,[]);
});

test('a product preset can replace SKU with a registered activity module while validating each source semantics',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 const activities:DataSourceDraft={...definition,id:'activities',title:'活动列表',fields:[{role:'activity.id',path:'id',confirmed:true},{role:'activity.name',path:'name',confirmed:true}]};
 await f.dataSources.register({definition:activities},source);
 const combined=instance('mixed',true),design=combined.design as unknown as ReturnType<typeof createMaterialView>,activity=createMaterialView('activity-list');
 design.widgets=[design.widgets[0],activity.widgets[0]];design.bindings=[design.bindings[0],activity.bindings[0]];design.layout={type:'column',children:['activities','products']};design.links=[];
 combined.dataSources={products:{id:'products',revision:1,params:{}},activities:{id:'activities',revision:1,params:{}}};
 const saved=f.workbench.save('shop',{expectedRevision:0,instances:[combined]});assert.equal(saved.instances[0].materialId,'product-browser');
 const read=await f.workbench.read('shop','mixed');assert.deepEqual((read.view.design as unknown as ReturnType<typeof createMaterialView>).widgets.map(widget=>widget.type),['product_list','table']);assert.equal(read.data.bindings.length,2);
 await f.dataSources.register({definition:{...activities,id:'incomplete-activity',fields:[{role:'activity.id',path:'id',confirmed:true}]}},source);
 const missing={...combined,dataSources:{...combined.dataSources,activities:{id:'incomplete-activity',revision:1,params:{}}}};
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:1,instances:[missing]}),{code:'INCOMPATIBLE_DATA_SOURCE'});assert.equal(f.workbench.get('shop').revision,1);
});

test('workbench composition rejects widgets that are not registered material modules',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 const unsupported=instance(),design=unsupported.design as unknown as ReturnType<typeof createMaterialView>;
 design.widgets[0]={id:'products',bindingId:'products',type:'stat_card'};
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:0,instances:[unsupported]}),{code:'INVALID_DESIGN'});
 (design.widgets[0] as {type:string}).type='invented_widget';
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:0,instances:[unsupported]}),{code:'INVALID_SPEC'});
 assert.equal(f.workbench.get('shop').revision,0);
});

test('removing the product module makes a formerly linked SKU module independently readable',async t=>{
 const f=fixture(t);await f.dataSources.register({definition},source);
 const standalone=instance('sku-only',true),design=standalone.design as unknown as ReturnType<typeof createMaterialView>;
 design.widgets=design.widgets.filter(widget=>widget.type==='sku_detail');design.bindings=design.bindings.filter(binding=>binding.id==='sku');design.layout={type:'column',children:['sku']};design.links=[];
 standalone.dataSources={sku:{id:'products',revision:1,params:{productId:'p1'}}};
 f.workbench.save('shop',{expectedRevision:0,instances:[standalone]});f.calls.length=0;
 const data=await f.workbench.read('shop','sku-only');assert.equal(f.calls.length,1);assert.equal((f.calls[0].input as {productId:string}).productId,'p1');assert.equal(data.data.bindings[0].state,'ready');assert.equal((data.view.design as unknown as ReturnType<typeof createMaterialView>).widgets[0].options?.requiresSelection,false);
});

test('cross-source column keys keep repeated semantic roles distinct and retain hidden column configuration',async t=>{
 const f=fixture(t);
 const draft:DataSourceDraft={...definition,id:'cross-columns',fields:[{key:'a.price',role:'price.current',path:'price',currency:'CNY',confirmed:true,origin:{source:'a',label:'商品价格'}},{key:'b.price',role:'price.current',path:'price',currency:'USD',confirmed:true,origin:{source:'b',label:'订单价格'}}]};
 await f.dataSources.register({definition:draft},source);
 const row:WorkbenchInstance={instanceId:'cross',title:'跨接口',materialId:'data-table',materialVersion:1,design:createMaterialView('data-table') as unknown as JsonValue,dataSources:{main:{id:draft.id,revision:1,params:{}}},position:{order:0}};
 const design=row.design as unknown as ReturnType<typeof createMaterialView>;
 design.widgets[0].columns=[];design.widgets[0].options!.displayColumns=[{field:'a.price',label:'售价',visible:false},{field:'b.price',label:'成交价',visible:false}];
 const derived=f.workbench.derive('shop',row).view.design as unknown as ReturnType<typeof createMaterialView>;
 assert.deepEqual(derived.widgets[0].fields,{'a.price':'price','b.price':'price'});
 assert.deepEqual(derived.widgets[0].columns,[],'deliberately hidden columns are not restored by defaults');
 assert.equal((derived.widgets[0].options!.fieldMeta as Record<string,{currency:string}>)['b.price'].currency,'USD');
 await assert.rejects(f.dataSources.register({definition:{...draft,id:'duplicate',fields:[draft.fields[0],{...draft.fields[1],key:'a.price'}]}},source),{code:'DATA_SOURCE_VALIDATION_FAILED'});
});

test('inline source preview stays transient and explicit save registers source plus board atomically',async t=>{
 const f=fixture(t),draft=structuredClone(definition),row=instance();row.dataSources!.products.draft=draft;
 const preview=await f.workbench.preview('shop',row,source);
 assert.equal(preview.data.bindings[0].state,'ready');assert.equal(f.dataSources.list().length,0);assert.equal(f.workbench.get('shop').revision,0);
 assert.throws(()=>f.workbench.save('shop',{expectedRevision:0,instances:[row]}),{code:'DATA_SOURCE_DRAFT_UNSAVED'});
 const saved=await f.workbench.saveWithDrafts('shop',{expectedRevision:0,instances:[row]},source);
 assert.equal(saved.instances[0].dataSources!.products.draft,undefined);assert.equal(f.dataSources.list().length,1);assert.equal(f.dataSources.get(draft.id,1).validation.status,'verified');
 const again=await f.workbench.read('shop','a');assert.equal(again.data.bindings[0].state,'ready');assert.equal(again.view.sourceRefs?.products.revision,1);
 const same=await f.workbench.saveWithDrafts('shop',{expectedRevision:1,instances:[row]},source);assert.equal(same.instances[0].dataSources!.products.revision,1,'unchanged definition is reused');
});

test('failed draft validation or board edits during validation leave no registered partial source',async t=>{
 const f=fixture(t),row=instance();row.dataSources!.products.draft={...definition,fields:definition.fields.map(field=>field.role==='product.id'?{...field,path:'missing'}:field)};
 await assert.rejects(f.workbench.saveWithDrafts('shop',{expectedRevision:0,instances:[row]},source),{code:'DATA_SOURCE_VALIDATION_FAILED'});
 assert.equal(f.dataSources.list().length,0);assert.equal(f.workbench.get('shop').revision,0);
 row.dataSources!.products.draft=structuredClone(definition);const original=f.runtime.invoke;
 f.runtime.invoke=async request=>{const response=await original(request);f.workbench.save('shop',{expectedRevision:0,instances:[]});return response;};
 await assert.rejects(f.workbench.saveWithDrafts('shop',{expectedRevision:0,instances:[row]},source),{code:'WORKBENCH_CONFLICT'});
 assert.equal(f.dataSources.list().length,0);assert.equal(f.workbench.get('shop').revision,1);
});

test('data-source validation applies declared instance parameters and rejects undeclared overrides',async t=>{
 const f=fixture(t);
 const checked=await f.dataSources.validate({definition,params:{limit:1}},source);assert.equal(checked.status,'verified');assert.equal((f.calls.at(-1)!.input as {limit:number}).limit,1);
 const count=f.calls.length,denied=await f.dataSources.validate({definition,params:{storeId:'foreign'}},source);assert.equal(denied.status,'failed');assert.equal(f.calls.length,count);
});

test('a stale successful payload remains displayable but cannot validate a reusable definition',async t=>{
 const f=fixture(t);f.setPayload({items:[{id:'p1',name:'商品',price:19,sku:'s1',spec:'蓝色'}],cache:{stale:true}});
 const validation=await f.dataSources.validate({definition},source);assert.equal(validation.status,'failed');assert.match(validation.issues.join(' '),/过期缓存/);
 await assert.rejects(f.dataSources.register({definition},source),{code:'DATA_SOURCE_VALIDATION_FAILED'});assert.equal(f.dataSources.list().length,0);
});
