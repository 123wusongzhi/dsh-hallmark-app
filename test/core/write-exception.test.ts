import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import type {AdapterResponse,CoreOptions} from '../../packages/core/src/types.ts';

const request='把 Shop 商品 A 的普通售价设为100 RUB';
const context={sessionId:'session',userRequest:request};
const args={storeId:'shop',offerIds:['A'],price:100,currency:'RUB',valueSource:'user',clientOperationKey:'same-logical-write',userRequest:request};
const ok=(raw:any):AdapterResponse=>({status:'ok',raw});
function setup(writeStatus:'ok'|'unknown'|'throw'='ok'){
 const store=new AppStore(':memory:');store.put('session_apps','session',{active:true,appId:'hallmark'});
 const calls:Array<{kind:'write'|'read';taskId:string;input:any}>=[];
 const client:CoreOptions['client']={getStores:async()=>ok([{id:'shop',shopName:'Shop'}]),getStoreProducts:async()=>ok({stores:[],products:[]}),syncStoreProducts:async()=>ok({}),getTargetMargin:async()=>ok({}),searchCollectedItems:async()=>ok([]),getCollectedItem:async()=>ok({}),
  platformCall:async(taskId,input)=>{calls.push({kind:'write',taskId,input});if(writeStatus==='throw')throw new Error('mock transport disconnected after sending');return writeStatus==='unknown'?{status:'unknown',raw:{outcome:'outcome_unknown'},error:{code:'SOURCE_OUTCOME_UNKNOWN',message:'mock source has no definitive response',retryable:false}}:ok({outcome:'response_received',httpStatus:200,response:{result:[{offer_id:'A',updated:true,errors:[]}]}});},
  platformRead:async(taskId,input)=>{calls.push({kind:'read',taskId,input});return ok({outcome:'response_received',httpStatus:200,response:{result:{items:[{offer_id:'A',product_id:1,price:{price:'100',currency_code:'RUB'}}]}}});}};
 const broker:CoreOptions['broker']={getStoreTask:async()=>ok({taskId:'task'}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind,id,sequence)=>`${kind}-${id}-${sequence}`};
 const core=new AppCore({store,client,broker,presentation:new PresentationManager(store)});
 return {store,core,calls};
}
function failOnePostTransportPersistence(store:AppStore):()=>boolean {
 const put=store.put.bind(store);let triggered=false;
 store.put=function<T>(collection:string,id:string,value:T):T {
  const operation=value as any;
  if(!triggered&&collection==='operations'&&operation.state==='running'&&operation.items?.some((item:any)=>item.write)){
   triggered=true;throw new Error('mock post-transport persistence failed once');
  }
  return put(collection,id,value);
 };
 return ()=>triggered;
}

for(const transportStatus of ['ok','unknown','throw'] as const)test(`post-transport ${transportStatus} processing exception is unknown, preserves evidence, and never re-sends the same key`,async()=>{
 const f=setup(transportStatus),triggered=failOnePostTransportPersistence(f.store);
 const first=await f.core.invoke('hallmark_update_price',args,context);
 assert.equal(triggered(),true);assert.equal(first.status,'unknown');assert.equal(first.operation?.state,'unknown');assert.equal(first.error?.code,'OUTCOME_UNKNOWN');assert.equal(first.error?.message,'mock post-transport persistence failed once');
 const operation=first.data as any;assert.equal(operation.state,'unknown');assert.equal(operation.hallmarkRefs.length,1);assert.equal(operation.hallmarkRefs[0].taskId,'task');assert.equal(operation.hallmarkRefs[0].path,'/v1/product/import/prices');assert.equal(operation.items.length,1);assert.equal(operation.items[0].state,'unknown');
 assert.equal(operation.items[0].write.status,transportStatus==='ok'?'ok':'unknown');
 if(transportStatus==='throw')assert.equal(operation.items[0].write.error.message,'mock transport disconnected after sending');
 if(transportStatus==='unknown')assert.equal(operation.items[0].write.error.message,'mock source has no definitive response');
 if(transportStatus==='ok')assert.equal(operation.items[0].write.raw.response.result[0].updated,true);
 const saved=f.store.get('operations',first.operation!.operationId)!;assert.equal(saved.state,'unknown');assert.equal(saved.result.status,'unknown');assert.equal(saved.error.message,first.error?.message);assert.deepEqual(saved.hallmarkRefs,operation.hallmarkRefs);assert.deepEqual(saved.items,operation.items);
 const second=await f.core.invoke('hallmark_update_price',args,context);assert.equal(second.status,'unknown');assert.equal(second.operation?.operationId,first.operation?.operationId);assert.equal(f.calls.filter(call=>call.kind==='write').length,1);assert.equal(f.calls.filter(call=>call.kind==='read').length,0);
 const verified=await f.core.invoke('hallmark_get_operation',{operationId:first.operation!.operationId},context);assert.equal(verified.status,'ok');assert.equal(verified.operation?.state,'succeeded');assert.equal(f.calls.filter(call=>call.kind==='write').length,1);assert.equal(f.calls.filter(call=>call.kind==='read').length,1);assert.equal(f.calls.at(-1)?.input.path,'/v5/product/info/prices');assert.equal((verified.data as any).items[0].state,'succeeded');assert.equal((verified.data as any).error.message,'mock post-transport persistence failed once');
 await f.core.invoke('hallmark_update_price',args,context);assert.equal(f.calls.filter(call=>call.kind==='write').length,1);f.store.close();
});

test('task preparation exception before any reference is failed and never sends or reads a business request',async()=>{
 const f=setup();let preparations=0;f.core.options.broker.getStoreTask=async()=>{preparations++;throw new Error('mock task context unavailable before dispatch');};
 const result=await f.core.invoke('hallmark_update_price',args,context);assert.equal(result.status,'failed');assert.equal(result.operation?.state,'failed');assert.equal(result.error?.code,'OPERATION_ERROR');assert.equal(result.error?.message,'mock task context unavailable before dispatch');assert.deepEqual((result.data as any).hallmarkRefs,[]);assert.deepEqual((result.data as any).items,[]);
 const saved=f.store.get('operations',result.operation!.operationId)!;assert.equal(saved.state,'failed');assert.equal(saved.result.status,'failed');const second=await f.core.invoke('hallmark_update_price',args,context);assert.equal(second.status,'failed');assert.equal(second.operation?.operationId,result.operation?.operationId);await f.core.invoke('hallmark_get_operation',{operationId:result.operation!.operationId},context);assert.equal(preparations,1);assert.equal(f.calls.length,0);f.store.close();
});

test('request identity preparation failure before a reference remains failed with no transport retry',async()=>{
 const f=setup();f.core.options.broker.requestId=()=>{throw new Error('mock request identity invalid before dispatch');};const result=await f.core.invoke('hallmark_update_price',args,context);assert.equal(result.status,'failed');assert.equal(result.operation?.state,'failed');assert.equal(result.error?.code,'OPERATION_ERROR');assert.equal(result.error?.message,'mock request identity invalid before dispatch');assert.deepEqual((result.data as any).hallmarkRefs,[]);assert.equal(f.calls.length,0);f.store.close();
});
