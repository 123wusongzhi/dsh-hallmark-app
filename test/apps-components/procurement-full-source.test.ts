import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {DataSourceLibrary,dataSourceDefinitionIssues} from '../../packages/app-presentation/src/data-sources.ts';
import {WorkbenchLibrary} from '../../packages/app-presentation/src/workbench.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import {hallmarkProductSources} from '../../packages/app-hallmark/src/field-mappings.ts';
import {PROCUREMENT_DESCRIPTOR} from '../../packages/app-hallmark/src/procurement.ts';
import type {DataSourceDraft,WorkbenchInstance} from '../../packages/app-presentation/src/types.ts';
import type {CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

const source=hallmarkProductSources('connection').find(item=>item.capabilityId==='hallmark.products.procurement')!;
const savedParams={query:'旧搜索',cursor:'previous-page',limit:10,planMode:'delivery',deliveryMethodId:'shop-channel',fixedFeeYuan:3.16,logisticsYuanPerKg:39.3,commissionPercent:20};
function fixture(t:{after:(fn:()=>void)=>void},capabilityId=source.capabilityId){
  const store=new RuntimeStore(':memory:');t.after(()=>store.close());const calls:InvocationRequest[]=[];
  const descriptor={...PROCUREMENT_DESCRIPTOR,capabilityId};
  const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async(request:InvocationRequest):Promise<CapabilityResult>=>{
    calls.push(request);return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{products:Array.from({length:23},(_,i)=>({productId:`p${i}`,title:`商品 ${i}`,sellerMinor:100,currency:'CNY'})),total:23}};
  }};
  const presentation=new AppsPresentationService({store,runtime}),sources=new DataSourceLibrary({store,runtime}),board=new WorkbenchLibrary({store,runtime,dataSources:sources,refreshBinding:(...args)=>presentation.refreshBinding(...args)});
  const legacy:DataSourceDraft={...structuredClone(source),capabilityId,input:{limit:10,planMode:'delivery'},parameters:source.parameters.filter(item=>item.name!=='loadAll').map(item=>item.name==='limit'?{...item,default:10}:item),operations:{pagination:{cursorParam:'cursor',limitParam:'limit',nextCursorPath:'cursor',totalPath:'total'},search:{scope:'server',param:'query'},sort:{scope:'loaded'}}};
  sources.installCatalog([legacy]);
  const instance=(materialId='product-procurement'):WorkbenchInstance=>({instanceId:'procurement',title:'商品-采购对照表',materialId,materialVersion:1,design:createMaterialView(materialId) as unknown as JsonValue,dataSources:{products:{id:source.id,revision:1,params:{...savedParams}}},position:{order:0}});
  return {store,calls,sources,board,legacy,instance};
}

test('new procurement sources declare full loading and local operations without a user-editable technical switch',()=>{
  assert.deepEqual(source.input,{loadAll:true,planMode:'delivery'});
  assert.equal(source.parameters.find(item=>item.name==='loadAll')?.editable,false);
  assert.deepEqual(source.operations,{search:{scope:'loaded'},sort:{scope:'loaded'}});
  assert.deepEqual(dataSourceDefinitionIssues(source,PROCUREMENT_DESCRIPTOR),[]);
});

test('saved revision-one procurement tables load all rows without losing local search, shop, channel, or fees',async t=>{
  const f=fixture(t),instance=f.instance(),original=structuredClone(instance);
  // Existing references remain pinned even when the source catalogue is newer.
  f.sources.installCatalog([{...source,title:'新版目录标题'}]);
  f.board.save('hallmark',{expectedRevision:0,instances:[instance],context:{storeId:'shop-A'}});
  const result=await f.board.read('hallmark',instance.instanceId),binding=result.data.bindings[0];
  assert.deepEqual(f.calls[0].input,{loadAll:true,storeId:'shop-A',planMode:'delivery',deliveryMethodId:'shop-channel',fixedFeeYuan:3.16,logisticsYuanPerKg:39.3,commissionPercent:20});
  assert.equal(result.pages.products.loadedCount,23);assert.equal(result.pages.products.total,23);assert.equal(result.pages.products.hasMore,false);
  assert.equal((binding.query!.input as Record<string,JsonValue>).loadAll,true);
  assert.equal(result.dataSources.products.revision,1);assert.equal(result.dataSources.products.input.loadAll,true);
  assert.deepEqual(result.dataSources.products.operations,{search:{scope:'loaded'},sort:{scope:'loaded'}});
  assert.deepEqual(result.view.sourceRefs!.products.params,savedParams);
  assert.deepEqual(f.board.get('hallmark').instances[0].dataSources!.products,original.dataSources!.products);
  assert.deepEqual(f.sources.get(source.id,1).input,f.legacy.input);
  assert.deepEqual(f.sources.get(source.id,1).operations,f.legacy.operations);
  assert.deepEqual(instance,original,'runtime compatibility never mutates the caller or source history');
  const searched=structuredClone(instance);searched.dataSources!.products.params.query='另一个搜索';
  assert.equal(f.board.derive('hallmark',searched,{storeId:'shop-A'}).view.bindings[0].datasetId,binding.datasetId,'local searches reuse the same full dataset');
  await f.board.read('hallmark',instance.instanceId,{forceRefresh:true});
  assert.deepEqual(f.calls.at(-1)!.input,{...f.calls[0].input as Record<string,JsonValue>,forceRefresh:true},'refreshing cannot reintroduce historical paging or server search');
});

test('full loading compatibility is limited to the procurement capability and the comparison-table widget',async t=>{
  for(const [capabilityId,materialId] of [['hallmark.products.procurement','product-list'],['other.products.procurement','product-procurement']]){
    const f=fixture(t,capabilityId),instance=f.instance(materialId);
    assert.deepEqual(f.board.derive('hallmark',instance,{storeId:'shop-A'}).view.bindings[0].input,{...savedParams,storeId:'shop-A'});
    const result=await f.board.preview('hallmark',instance,{kind:'agent',sessionId:'s',nativeCallId:'preview'},{context:{storeId:'shop-A'}});
    const {cursor:_,...firstPageParams}=savedParams;
    assert.deepEqual(f.calls[0].input,{...firstPageParams,storeId:'shop-A'});
    assert.equal(result.dataSources.products.input.loadAll,undefined);
    assert.deepEqual(result.dataSources.products.operations,f.legacy.operations);
  }
});
