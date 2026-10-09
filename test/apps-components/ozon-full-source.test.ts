import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {DataSourceLibrary} from '../../packages/app-presentation/src/data-sources.ts';
import {WorkbenchLibrary} from '../../packages/app-presentation/src/workbench.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import {hallmarkOzonSources,OZON_DESCRIPTORS} from '../../packages/app-hallmark/src/ozon-data.ts';
import {createOzonCompositionDraft} from '../../packages/app-hallmark/src/ozon-composition.ts';
import {OZON_COMPOSE_DESCRIPTOR} from '../../packages/app-hallmark/src/ozon-compose.ts';
import type {DataSourceDraft,WorkbenchInstance} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

test('historical Ozon sources read full snapshots without rewriting shop filters or saved revisions',async t=>{
 const store=new RuntimeStore(':memory:');t.after(()=>store.close());
 const descriptors=[...OZON_DESCRIPTORS,OZON_COMPOSE_DESCRIPTOR],calls:InvocationRequest[]=[];
 const runtime={describe:(id:string)=>descriptors.find(d=>d.capabilityId===id),getConnection:()=>({enabled:true}),invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{
  calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:Array.from({length:31},(_,i)=>({productId:String(i)})),total:31}};
 }};
 const presentation=new AppsPresentationService({store,runtime}),sources=new DataSourceLibrary({store,runtime});
 const board=new WorkbenchLibrary({store,runtime,dataSources:sources,refreshBinding:(...args)=>presentation.refreshBinding(...args)});
 const definitions=[...hallmarkOzonSources('connection'),createOzonCompositionDraft('connection',{version:1,grain:'product',fields:['products.title','prices.price']})];
 for(const definition of definitions){
  const legacy:DataSourceDraft={...structuredClone(definition),input:{...definition.input,limit:20},parameters:[...definition.parameters.filter(p=>!['loadAll','limit','cursor'].includes(p.name)),{name:'limit',label:'每页条数',type:'integer',default:20},{name:'cursor',label:'分页位置',type:'string'}],operations:{pagination:{cursorParam:'cursor',limitParam:'limit'},search:{scope:'loaded'},sort:{scope:'loaded'}}};
  delete legacy.input.loadAll;sources.installCatalog([legacy]);
  const params:Record<string,JsonValue>={limit:10,cursor:'old-page'};
  for(const parameter of legacy.parameters.filter(p=>p.required&&p.editable!==false))params[parameter.name]=parameter.name==='dateFrom'?'2026-10-01':parameter.name==='dateTo'?'2026-10-07':'123';
  const instance:WorkbenchInstance={instanceId:definition.id,title:definition.title,materialId:'data-table',materialVersion:1,design:createMaterialView('data-table') as unknown as JsonValue,dataSources:{main:{id:definition.id,revision:1,params}},position:{order:0}};
  const before=structuredClone(instance);
  board.save('hallmark',{expectedRevision:board.get('hallmark').revision,instances:[instance],context:{storeId:'shop-A'}});
  const read=await board.read('hallmark',instance.instanceId),input=calls.at(-1)!.input as Record<string,JsonValue>;
  assert.equal(input.loadAll,true,definition.capabilityId);assert.equal(input.cursor,undefined);assert.equal(input.limit,undefined);assert.equal(input.storeId,'shop-A');
  for(const [key,value] of Object.entries(params).filter(([key])=>!['limit','cursor'].includes(key)))assert.deepEqual(input[key],value);
  assert.deepEqual(input.recipe,definition.input.recipe);assert.equal(read.pages.main.loadedCount,31);assert.equal(read.pages.main.hasMore,false);
  assert.deepEqual(read.dataSources.main.operations,{search:{scope:'loaded'},sort:{scope:'loaded'}});
  assert.deepEqual(sources.get(definition.id,1).input,legacy.input);assert.deepEqual(board.get('hallmark').instances[0].dataSources,before.dataSources);
  await board.read('hallmark',instance.instanceId,{forceRefresh:true});assert.deepEqual(calls.at(-1)!.input,{...input,forceRefresh:true});
 }
});
