import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {DataSourceLibrary,dataSourceDefinitionIssues,sampleValidation} from '../../packages/app-presentation/src/data-sources.ts';
import {WorkbenchLibrary} from '../../packages/app-presentation/src/workbench.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import {hallmarkOzonSources,OZON_DESCRIPTORS} from '../../packages/app-hallmark/src/ozon-data.ts';
import type {DataSourceDraft,WorkbenchInstance} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityDescriptor,CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

const descriptor:CapabilityDescriptor={capabilityId:'shop.rows',version:'1.0.0',effect:'query',title:'库存',description:'库存',inputSchema:{type:'object',properties:{storeId:{type:'string',minLength:1},warehouseId:{type:'string'},cursor:{type:'string'},limit:{type:'integer'},dateFrom:{type:'string'}},required:['storeId'],additionalProperties:false},outputSchema:{type:'object',properties:{items:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'}},required:['id','name'],additionalProperties:false}}},required:['items'],additionalProperties:false},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]};
const definition:DataSourceDraft={id:'shared',title:'Ozon 库存',appId:'shop',connectionId:'one',capabilityId:descriptor.capabilityId,capabilityMajor:1,storeScoped:true,input:{limit:10},parameters:[{name:'storeId',label:'店铺',type:'string',required:true,editable:false},{name:'warehouseId',label:'仓库',type:'string'},{name:'dateFrom',label:'开始日期',type:'string'},{name:'limit',label:'每页条数',type:'integer'},{name:'cursor',label:'分页',type:'string'}],fields:[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true}],rowsPath:'items',operations:{pagination:{cursorParam:'cursor'},search:{scope:'loaded'},sort:{scope:'loaded'}}};
const instance=():WorkbenchInstance=>({instanceId:'table',title:'库存',materialId:'data-table',materialVersion:1,design:createMaterialView('data-table') as unknown as JsonValue,dataSources:{main:{id:'shared',revision:1,params:{warehouseId:'warehouse-A',dateFrom:'2026-10-01'}}},position:{order:0,span:2}});
function fixture(t:{after:(fn:()=>void)=>void}){
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());const calls:InvocationRequest[]=[];
 let execute=async(request:InvocationRequest):Promise<JsonValue>=>({items:[{id:(request.input as {storeId:string}).storeId,name:'真实记录'}]});
 const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:await execute(request)};}};
 const presentation=new AppsPresentationService({store,runtime}),sources=new DataSourceLibrary({store,runtime}),board=new WorkbenchLibrary({store,runtime,dataSources:sources,refreshBinding:(...args)=>presentation.refreshBinding(...args)});
 sources.installCatalog([definition]);return {store,calls,sources,board,setExecute:(fn:typeof execute)=>{execute=fn;}};
}
test('ten Ozon catalog definitions are reusable without shops or frozen dates',()=>{
 const sources=hallmarkOzonSources('connection');assert.equal(sources.length,10);assert.equal(new Set(sources.map(item=>item.id)).size,10);
 for(const source of sources){assert.equal(source.storeScoped,true);assert.equal(source.input.storeId,undefined);assert.equal(source.parameters.find(p=>p.name==='storeId')?.default,undefined);assert.deepEqual(dataSourceDefinitionIssues(source,OZON_DESCRIPTORS.find(d=>d.capabilityId===source.capabilityId)),[]);}
});
test('store switch retains columns and dates, drops local identities, and separates cached datasets',async t=>{
 const f=fixture(t),a=f.board.save('shop',{expectedRevision:0,instances:[instance()],context:{storeId:'A'}});
 const readA=await f.board.read('shop','table');assert.equal((f.calls.at(-1)!.input as {storeId:string}).storeId,'A');
 const b=f.board.save('shop',{expectedRevision:a.revision,instances:a.instances,context:{storeId:'B'}});
 assert.deepEqual(b.instances[0].design,a.instances[0].design);assert.deepEqual(b.instances[0].dataSources!.main.params,{dateFrom:'2026-10-01'});
 const readB=await f.board.read('shop','table');assert.equal((f.calls.at(-1)!.input as {storeId:string}).storeId,'B');assert.notEqual(readA.data.bindings[0].datasetId,readB.data.bindings[0].datasetId);
 assert.equal(f.sources.list().length,1);assert.equal(f.sources.list()[0].input.storeId,undefined);assert.equal(f.board.get('shop').context?.storeId,'B');
 await assert.rejects(f.board.read('shop','table',{context:{storeId:'A'}}),{code:'PAGE_SUPERSEDED'});
 assert.throws(()=>f.board.save('shop',{expectedRevision:b.revision,instances:[{...instance(),dataSources:{main:{id:'shared',revision:1,params:{storeId:'A'}}}}]}),{code:'PARAMETER_NOT_ALLOWED'});
});
test('an in-flight previous store response cannot replace the new store page',async t=>{
 const f=fixture(t);f.board.save('shop',{expectedRevision:0,instances:[instance()],context:{storeId:'A'}});
 let release!:()=>void,entered!:()=>void;const start=new Promise<void>(resolve=>{entered=resolve;});
 f.setExecute(async request=>{const id=(request.input as {storeId:string}).storeId;if(id==='A'){entered();await new Promise<void>(resolve=>{release=resolve;});}return {items:[{id,name:id}]};});
 const a=f.board.read('shop','table');const rejected=assert.rejects(a,{code:'PAGE_SUPERSEDED'});await start;
 f.board.save('shop',{expectedRevision:1,instances:[instance()],context:{storeId:'B'}});const b=await f.board.read('shop','table');release();await rejected;
 assert.equal(((b.data.bindings[0].payload as {items:{id:string}[]}).items[0].id),'B');
 const saved=await f.board.read('shop','table',{refresh:false});assert.equal(((saved.data.bindings[0].payload as {items:{id:string}[]}).items[0].id),'B');
});
test('typed empty responses validate without inventing a sample; unknown empty schemas do not',()=>{
 const accepted=sampleValidation(definition,{items:[]},'read',descriptor);assert.equal(accepted.status,'verified');assert.equal(accepted.sampleCount,0);assert.equal(accepted.empty,true);
 assert.equal(sampleValidation(definition,{items:[]},'read',{...descriptor,outputSchema:{type:'object'}}).status,'failed');
 assert.equal(sampleValidation(definition,{wrong:[]},'read',descriptor).status,'failed');
 assert.ok(dataSourceDefinitionIssues({...definition,input:{storeId:'A'}},descriptor).some(issue=>issue.includes('不能保存具体店铺')));
});

test('server store changes discard delivery ids and their tariffs while retaining independent fee trials, including previews',async t=>{
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());const calls:InvocationRequest[]=[];
 const planDescriptor:CapabilityDescriptor={...descriptor,capabilityId:'hallmark.products.procurement',inputSchema:{...descriptor.inputSchema,properties:{...(descriptor.inputSchema.properties as Record<string,JsonValue>),planMode:{type:'string'},deliveryMethodId:{type:'string'},fixedFeeYuan:{type:'number'},logisticsYuanPerKg:{type:'number'},commissionPercent:{type:'number'}}}};
 const runtime={describe:()=>planDescriptor,getConnection:()=>({enabled:true}),invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:[{id:'product',name:'商品'}]}};}};
 const presentation=new AppsPresentationService({store,runtime}),sources=new DataSourceLibrary({store,runtime}),board=new WorkbenchLibrary({store,runtime,dataSources:sources,refreshBinding:(...args)=>presentation.refreshBinding(...args)});
 sources.installCatalog([{...definition,capabilityId:planDescriptor.capabilityId,parameters:[...definition.parameters,...(['planMode','deliveryMethodId','fixedFeeYuan','logisticsYuanPerKg','commissionPercent'] as const).map(name=>({name,label:name,type:name==='planMode'||name==='deliveryMethodId'?'string' as const:'number' as const}))]}]);
 const make=(mode:'delivery'|'platform'|'custom',id:string=mode):WorkbenchInstance=>({...instance(),instanceId:id,dataSources:{main:{id:'shared',revision:1,params:{planMode:mode,...(mode==='delivery'?{deliveryMethodId:'channel-A'}:{}),fixedFeeYuan:3,logisticsYuanPerKg:12,commissionPercent:15,dateFrom:'2026-10-01'}}}});
 const a=board.save('shop',{expectedRevision:0,instances:[make('delivery'),make('custom'),make('platform')],context:{storeId:'A'}}),b=board.save('shop',{expectedRevision:a.revision,instances:a.instances,context:{storeId:'B'}});
 assert.deepEqual(b.instances[0].dataSources!.main.params,{planMode:'delivery',dateFrom:'2026-10-01'});
 for(const mode of ['custom','platform'])assert.deepEqual(b.instances.find(item=>item.instanceId===mode)!.dataSources!.main.params,a.instances.find(item=>item.instanceId===mode)!.dataSources!.main.params);
 await board.read('shop','delivery');assert.equal((calls.at(-1)!.input as Record<string,JsonValue>).deliveryMethodId,undefined);assert.equal((calls.at(-1)!.input as Record<string,JsonValue>).fixedFeeYuan,undefined);
 const preview=make('delivery','preview'),source={kind:'agent' as const,sessionId:'chat',nativeCallId:'preview'};
 await board.preview('shop',preview,source,{context:{storeId:'A'},scope:'same-preview'});assert.equal((calls.at(-1)!.input as Record<string,JsonValue>).deliveryMethodId,'channel-A');
 await board.preview('shop',preview,source,{context:{storeId:'B'},scope:'same-preview'});const input=calls.at(-1)!.input as Record<string,JsonValue>;assert.equal(input.storeId,'B');assert.equal(input.deliveryMethodId,undefined);assert.equal(input.fixedFeeYuan,undefined);assert.equal(input.planMode,'delivery');assert.equal(preview.dataSources!.main.params.deliveryMethodId,'channel-A','server cleanup never mutates the caller object');
});
