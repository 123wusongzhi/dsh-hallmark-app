import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import type {AdapterResponse,CoreOptions} from '../../packages/core/src/types.ts';

const request='把 Shop 商品 A 在仓库 12 的库存设为 201';
const context={sessionId:'session',userRequest:request};
const args={storeId:'shop',offerIds:['A'],warehouseId:'12',stock:201,valueSource:'user',clientOperationKey:'one-stock-write',userRequest:request};
const exactRow={offer_id:'A',sku:33,warehouse_id:12,present:201,free_stock:201};
const ok=(raw:any):AdapterResponse=>({status:'ok',raw});

function setup(stockResponse:any){
 const store=new AppStore(':memory:');store.put('session_apps','session',{appId:'hallmark',active:true});
 const calls:Array<{write:boolean;taskId:string;input:any}>=[];
 const fixture={stockResponse,infoRows:[{id:1,offer_id:'A',sku:33,stocks:{stock:201}}]};
 const client:CoreOptions['client']={
  getStores:async()=>ok([{id:'shop',shopName:'Shop'}]),getStoreProducts:async()=>ok({stores:[],products:[]}),syncStoreProducts:async()=>ok({}),getTargetMargin:async()=>ok({}),searchCollectedItems:async()=>ok([]),getCollectedItem:async()=>ok({}),
  platformCall:async(taskId,input)=>{calls.push({write:true,taskId,input});return ok({outcome:'response_received',httpStatus:200,response:{result:[{offer_id:'A',updated:true,errors:[]}]}});},
  platformRead:async(taskId,input)=>{calls.push({write:false,taskId,input});return ok({outcome:'response_received',httpStatus:200,response:input.path==='/v3/product/info/list'?{items:fixture.infoRows}:fixture.stockResponse});}
 };
 const broker:CoreOptions['broker']={getStoreTask:async()=>ok({taskId:'original-task'}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind,id,sequence)=>`${kind}-${id}-${sequence}`};
 const core=new AppCore({store,client,broker,presentation:new PresentationManager(store)});
 return {store,core,calls,fixture};
}

const shapes:Array<[string,(row:any)=>any]>=[
 ['Source products envelope',row=>({products:[row],has_next:false,cursor:''})],
 ['wrapped products envelope',row=>({result:{products:[row]}})],
 ['legacy result items envelope',row=>({result:{items:[row]}})],
 ['legacy result array',row=>({result:[row]})],
 ['legacy items envelope',row=>({items:[row]})]
];
for(const [name,shape] of shapes)test(`stock readback accepts ${name} for the exact product and warehouse`,async()=>{
 const f=setup(shape(exactRow));try{
  const result=await f.core.invoke('hallmark_update_stock',args,context);
  assert.equal(result.status,'ok');assert.equal(result.operation?.state,'succeeded');
  const operation=result.data as any;assert.equal(operation.items[0].observed,201);assert.equal(operation.items[0].platformSku,33);
  assert.deepEqual(operation.items[0].readback.raw.response,shape(exactRow));
  assert.deepEqual(f.calls.map(call=>call.input.path),['/v2/products/stocks','/v3/product/info/list','/v2/product/info/stocks-by-warehouse/fbs']);
  assert.deepEqual(f.calls[2].input.body,{sku:[33],limit:100});assert.equal(f.calls.filter(call=>call.write).length,1);
 }finally{f.store.close();}
});

for(const [name,row] of [
 ['offer-only legacy identity',{offer_id:'A',warehouse_id:12,present:201}],
 ['SKU-only identity',{sku:33,warehouse_id:12,present:201}],
 ['nested warehouses',{offer_id:'A',sku:33,warehouses:[{warehouse_id:11,present:0},{warehouse_id:12,present:201}]}],
 ['nested stocks legacy names',{offerId:'A',sku:33,stocks:[{warehouseId:'12',stock:201}]}],
 ['nested warehouse carries consistent product identity',{offer_id:'A',sku:33,stocks:[{warehouse_id:12,offer_id:'A',sku:33,present:201}]}],
 ['only the selected warehouse supplies product evidence',{offer_id:'A',sku:33,stocks:[{warehouse_id:11,offer_id:'B',sku:34,present:201},{warehouse_id:12,offer_id:'A',sku:33,present:201}]}]
] as const)test(`stock readback retains ${name} compatibility without weakening exact warehouse matching`,async()=>{
 const f=setup({products:[row]});try{const result=await f.core.invoke('hallmark_update_stock',args,context);assert.equal(result.status,'ok');assert.equal((result.data as any).items[0].observed,201);assert.equal(f.calls.filter(call=>call.write).length,1);}finally{f.store.close();}
});

const invalidResponses:Array<[string,any]>=[
 ['matching offer with conflicting SKU',{products:[{...exactRow,sku:34}]}],
 ['matching SKU with conflicting offer',{products:[{...exactRow,offer_id:'B'}]}],
 ['conflicting provided offer aliases',{products:[{...exactRow,offerId:'B'}]}],
 ['no product identity',{products:[{warehouse_id:12,present:201}]}],
 ['another warehouse',{products:[{...exactRow,warehouse_id:11}]}],
 ['conflicting provided warehouse aliases',{products:[{...exactRow,warehouseId:11}]}],
 ['missing warehouse',{products:[{offer_id:'A',sku:33,present:201}]}],
 ['missing present and stock',{products:[{offer_id:'A',sku:33,warehouse_id:12}]}],
 ['free_stock alone equals target',{products:[{offer_id:'A',sku:33,warehouse_id:12,free_stock:201}]}],
 ['present differs while free_stock equals target',{products:[{...exactRow,present:200}]}],
 ['duplicate exact product rows',{products:[exactRow,{...exactRow}]}],
 ['duplicate exact nested warehouses',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,present:201},{warehouse_id:12,present:201}]}]}],
 ['selected nested warehouse has conflicting SKU',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,sku:34,present:201}]}]}],
 ['selected nested warehouse has conflicting offer',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,offer_id:'B',present:201}]}]}],
 ['selected nested warehouse has conflicting offer aliases',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,offer_id:'A',offerId:'B',present:201}]}]}],
 ['selected nested warehouse has conflicting warehouse aliases',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,warehouseId:11,present:201}]}]}],
 ['duplicate nested warehouse with one conflicting SKU',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,sku:34,present:201},{warehouse_id:12,sku:33,present:201}]}]}],
 ['duplicate nested warehouse with one conflicting offer',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,offer_id:'B',present:201},{warehouse_id:12,offer_id:'A',present:201}]}]}],
 ['duplicate nested warehouse with one conflicting warehouse alias',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:12,warehouseId:11,present:201},{warehouse_id:12,present:201}]}]}],
 ['nested warehouse does not match',{products:[{offer_id:'A',sku:33,stocks:[{warehouse_id:11,present:201}]}]}],
 ['unrecognized rows envelope',{rows:[exactRow]}],
 ['empty product list despite matching info aggregate',{products:[]}]
];
for(const [name,response] of invalidResponses)test(`stock readback leaves ${name} unknown and inspect never repeats the mutation`,async()=>{
 const f=setup(response);try{
  const first=await f.core.invoke('hallmark_update_stock',args,context);assert.equal(first.status,'unknown');assert.equal(first.operation?.state,'unknown');
  const original=first.data as any;assert.equal(original.items[0].write.raw.response.result[0].updated,true);assert.equal(original.hallmarkRefs[0].taskId,'original-task');
  const inspected=await f.core.invoke('hallmark_get_operation',{operationId:first.operation!.operationId},context);assert.equal(inspected.status,'unknown');
  const repeated=await f.core.invoke('hallmark_update_stock',args,context);assert.equal(repeated.operation?.operationId,first.operation?.operationId);assert.equal(repeated.status,'unknown');
  assert.equal(f.calls.filter(call=>call.write).length,1);assert.equal(f.calls.filter(call=>!call.write&&call.input.path==='/v2/product/info/stocks-by-warehouse/fbs').length,2);
 }finally{f.store.close();}
});

test('an existing unknown stock operation resolves from products readback with its original write identity',async()=>{
 const f=setup({products:[]});try{
  const first=await f.core.invoke('hallmark_update_stock',args,context);assert.equal(first.status,'unknown');
  const original=(first.data as any).hallmarkRefs[0];const write=(first.data as any).items[0].write;
  f.fixture.stockResponse={products:[exactRow],has_next:false,cursor:''};
  const inspected=await f.core.invoke('hallmark_get_operation',{operationId:first.operation!.operationId},context);
  assert.equal(inspected.status,'ok');assert.equal(inspected.operation?.operationId,first.operation?.operationId);assert.equal(inspected.operation?.state,'succeeded');
  assert.deepEqual((inspected.data as any).hallmarkRefs[0],original);assert.deepEqual((inspected.data as any).items[0].write,write);assert.equal((inspected.data as any).items[0].observed,201);
  await f.core.invoke('hallmark_update_stock',args,context);assert.equal(f.calls.filter(call=>call.write).length,1);
 }finally{f.store.close();}
});
