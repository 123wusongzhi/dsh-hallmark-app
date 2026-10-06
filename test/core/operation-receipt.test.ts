import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import {readOperationReceipt,projectOperationReceipt,OPERATION_RECEIPT_TIME_BASIS} from '../../packages/core/src/receipt.ts';
import type {CoreOptions} from '../../packages/core/src/types.ts';

const ok=(raw:any)=>({status:'ok' as const,raw});
const request='把 Shop 商品 A 的普通售价改为100 RUB';
const context={sessionId:'alice',userRequest:request};
function setup(){
 const store=new AppStore(':memory:');for(const sid of ['alice','bob'])store.put('session_apps',sid,{active:true,appId:'hallmark'});
 const presentation=new PresentationManager(store),calls={stores:0,sync:0,products:0,write:0,read:0,other:0};
 const forbidden=async()=>{calls.other++;throw new Error('unexpected remote invocation');};
 const client:CoreOptions['client']={getStores:async()=>{calls.stores++;return ok([{id:'shop',shopName:'Shop'}]);},syncStoreProducts:async()=>{calls.sync++;throw new Error('unexpected source sync');},getStoreProducts:async()=>{calls.products++;throw new Error('unexpected source read');},getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,
  platformCall:async()=>{calls.write++;return ok({outcome:'response_received',httpStatus:200,response:{result:[{offer_id:'A',updated:true,errors:[]}]}});},platformRead:async()=>{calls.read++;return ok({outcome:'response_received',httpStatus:200,response:{result:{items:[{offer_id:'A',product_id:1,price:{price:'100',currency_code:'RUB'}}]}}});}};
 const broker:CoreOptions['broker']={getStoreTask:async()=>ok({taskId:'task'}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind,id,index)=>`${kind}-${id}-${index}`};
 const core=new AppCore({store,presentation,client,broker});
 const ledger=(id='op',state='running',sessionId:string|null='alice')=>({operationId:id,kind:'update_price',sessionId,storeId:'shop',targets:['A'],input:{price:100,currency:'RUB',userRequest:request},state,hallmarkRefs:[{taskId:'task',requestId:'real-recorded-request',path:'/v1/product/import/prices'}],items:[] as any[],createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:01:00Z'});
 async function render(id:string,operationId='op',sid='alice',fieldMap:Record<string,string>={}){return core.invoke('hallmark_render_view',{templateId:'operation-receipt',title:id,bindings:[{id:'main',datasetKey:`operation:${operationId}`,fieldMap}]},{sessionId:sid});}
 return {store,presentation,client,core,calls,ledger,render};
}
function collections(store:AppStore){return JSON.parse(store.exportJSON()).collections;}
const priceArgs={storeId:'shop',offerIds:['A'],price:100,currency:'RUB',valueSource:'user',clientOperationKey:'receipt-write',userRequest:request};

test('pure ledger receipt and local refresh expose pending/running/unknown/succeeded record states and actual record timestamps only',async()=>{
 const f=setup();let operation=f.ledger('op','pending');
 for(const [index,state] of ['pending','running','unknown','succeeded'].entries()){
  operation={...operation,state,updatedAt:`2026-10-05T00:0${index+1}:00Z`,items:index>=2?[{target:'A',state:index===2?'unknown':'succeeded',write:{status:'unknown',error:{code:'SOURCE_UNKNOWN',message:'actual recorded transport diagnostic'}},readback:{rawEvidence:'retained'}}]:[]};f.store.put('operations','op',operation);
  const before=collections(f.store),receipt=readOperationReceipt(f.store,'op')!;assert.equal(receipt.payload.state,state);assert.equal(receipt.dataTime,operation.updatedAt);assert.equal(receipt.recordUpdatedAt,operation.updatedAt);assert.equal(receipt.timeBasis,OPERATION_RECEIPT_TIME_BASIS);assert.deepEqual(collections(f.store),before);
  const refresh=await f.core.refreshDataset('operation:op',{sessionId:'not-a-selected-real-session'});assert.equal(refresh.status,'ok');const snapshot=f.store.get('snapshots','operation:op')!;assert.equal(snapshot.payload.state,state);assert.equal(snapshot.sessionId,'alice');assert.equal(snapshot.dataTime,operation.updatedAt);assert.equal(snapshot.provenance.source,'app_snapshot');assert.equal(snapshot.provenance.endpoint,'local:operations');assert.equal(snapshot.timeBasis,OPERATION_RECEIPT_TIME_BASIS);assert.match(snapshot.metricBasis,/不是平台商品\/价格源数据时间/);
  assert.equal(f.store.list('operations').length,1);if(index>=2){assert.equal(snapshot.payload.items[0].message,'actual recorded transport diagnostic');assert.deepEqual(snapshot.payload.items[0].write,operation.items[0].write);assert.deepEqual(snapshot.payload.items[0].readback,operation.items[0].readback);}
 }
 assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});assert.equal(f.store.list('entries').length,0);assert.equal(f.store.list('components').length,0);assert.equal(f.store.list('queries').length,0);f.store.close();
});

test('partial receipt preserves every original item, error, result and request reference without inventing sale success',()=>{
 const f=setup(),operation={...f.ledger('partial','partial'),kind:'list_product',items:[{target:'A',state:'succeeded',productId:10,importTaskId:99,write:{response:{status:'imported'}},evidence:{platformSku:123}},{target:'B',state:'failed',error:{code:'SKU_REJECTED',message:'recorded rejected attribute'}}],result:{accepted:1,rejected:1},error:{code:'PARTIAL',message:'one source SKU rejected'}};f.store.put('operations','partial',operation);
 const result=projectOperationReceipt(f.store,'partial');assert.equal(result.status,'ok');const payload=f.store.get('snapshots','operation:partial')!.payload;assert.equal(payload.state,'partial');assert.equal(payload.items.length,2);assert.equal(payload.items[1].message,'recorded rejected attribute');assert.deepEqual(payload.items[0].evidence,operation.items[0].evidence);assert.deepEqual(payload.hallmarkRefs,operation.hallmarkRefs);assert.deepEqual(payload.result,operation.result);assert.deepEqual(payload.error,operation.error);assert.equal(payload.acceptance,'imported-not-sellable-verified');assert.equal(Object.hasOwn(payload,'on_sale'),false);assert.match(f.store.get('snapshots','operation:partial')!.metricBasis,/不表示 on_sale/);assert.equal(f.calls.write,0);f.store.close();
});

test('unknown operation record time stays null and is not substituted by receipt fetch/cache time',async()=>{
 const f=setup(),operation={...f.ledger(),updatedAt:null};f.store.put('operations','op',operation);const result=await f.core.refreshDataset('operation:op',{sessionId:'alice'});assert.equal(result.status,'ok');const snapshot=f.store.get('snapshots','operation:op')!;assert.equal(snapshot.dataTime,null);assert.equal(snapshot.recordUpdatedAt,null);assert.equal(Object.hasOwn(snapshot.provenance,'dataTime'),false);assert.ok(snapshot.lastSuccessAt);const rendered=await f.render('unknown-time');assert.equal(rendered.status,'ok');const data=f.core.getSessionViewData('alice',(rendered.data as any).viewId)!;const binding=(data.data as any).bindings[0];assert.equal(Object.hasOwn(binding,'dataTime'),false);assert.equal(binding.provenance.recordUpdatedAt,null);assert.equal(Object.hasOwn(binding,'lastSuccessAt'),false);f.store.close();
});

test('owned Spec/data enforce actual ledger ownership before exposing title/state, even when cached scope is forged',async()=>{
 const f=setup(),operation={...f.ledger('foreign','unknown','bob'),privateTitle:'BOB-PRIVATE-TITLE',items:[{target:'BOB-PRIVATE-SKU',state:'unknown'}]};f.store.put('operations','foreign',operation);f.store.updateSnapshotSuccess('operation:foreign',{state:'succeeded',items:[{target:'forged',state:'succeeded'}]},'2026-10-05T00:00:00Z',{sessionId:'alice'});
 const rendered=await f.render('BOB-PRIVATE-TITLE','foreign');assert.equal(rendered.status,'ok');const viewId=(rendered.data as any).viewId;const before=collections(f.store);assert.equal(f.core.getSessionView('alice',viewId),undefined);assert.equal(f.core.getSessionViewData('alice',viewId),undefined);const list=f.core.listSessionViews('alice');assert.equal(list.views[0].title,'组件不可用');assert.equal(list.views[0].state,'expired');assert.doesNotMatch(JSON.stringify(list),/BOB-PRIVATE/);assert.deepEqual(collections(f.store),before);assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});f.store.close();
});

test('owned live GET uses current ledger not old/failed cache, preserves field-map aliases, and performs no SQL changes while inactive',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger('op','running'));projectOperationReceipt(f.store,'op');const rendered=await f.render('Live receipt','op','alice',{statusAlias:'state',detailAlias:'message'}),viewId=(rendered.data as any).viewId;
 const ledger={...f.ledger('op','succeeded'),updatedAt:'2026-10-05T00:04:00Z',items:[{target:'A',state:'succeeded',message:'recorded confirmation',verification:{currency:'RUB',price:100}}]};f.store.put('operations','op',ledger);f.store.updateSnapshotState('operation:op','failed',{code:'OLD_CACHE_FAILURE'});f.store.put('session_apps','alice',{appId:'hallmark',active:false});const before=collections(f.store);
 const spec=f.core.getSessionView('alice',viewId)!;assert.deepEqual(spec.bindings[0].fieldMap,{statusAlias:'state',detailAlias:'message'});const data=f.core.getSessionViewData('alice',viewId)!;assert.equal(data.status,'ok');const binding=(data.data as any).bindings[0];assert.equal(binding.payload.state,'succeeded');assert.equal(binding.payload.items[0].message,'recorded confirmation');assert.deepEqual(binding.payload.items[0].verification,ledger.items[0].verification);assert.equal(binding.dataTime,ledger.updatedAt);assert.equal(binding.provenance.timeBasis,OPERATION_RECEIPT_TIME_BASIS);assert.equal(binding.state,'ready');assert.equal(binding.lastError,null);assert.deepEqual(collections(f.store),before);assert.equal(f.store.get('snapshots','operation:op')!.payload.state,'running');assert.equal(f.calls.read,0);assert.equal(f.calls.write,0);f.store.close();
});

test('ownership changes and missing ledger records are denied even with an existing owner view and old cached success',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger());projectOperationReceipt(f.store,'op');const rendered=await f.render('Previously owned'),viewId=(rendered.data as any).viewId;assert.ok(f.core.getSessionViewData('alice',viewId));f.store.put('operations','op',{...f.ledger(),sessionId:'bob'});assert.equal(f.core.getSessionView('alice',viewId),undefined);assert.equal(f.core.getSessionViewData('alice',viewId),undefined);f.store.delete('operations','op');assert.equal(f.core.getSessionViewData('alice',viewId),undefined);const refreshed=await f.core.refreshDataset('operation:op',{sessionId:'alice'});assert.equal(refreshed.status,'failed');assert.equal(refreshed.error?.code,'OPERATION_RECEIPT_NOT_FOUND');assert.equal(f.store.get('snapshots','operation:op')!.state,'failed');assert.equal(f.calls.write,0);assert.equal(f.calls.read,0);f.store.close();
});

test('mixed view replaces only authorized operation bindings while retaining genuine missing snapshot status',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger());const spec={id:'mixed',title:'Mixed',layout:{type:'column',children:['status','table']},widgets:[{id:'status',type:'status_badge',bindingId:'main',fields:{status:'state'}},{id:'table',type:'table',bindingId:'other',columns:[{field:'offerId',label:'商品'}]}],bindings:[{id:'main',datasetKey:'operation:op',fieldMap:{}},{id:'other',datasetKey:'store_products:absent',fieldMap:{}}]};assert.equal((await f.core.invoke('hallmark_render_view',{spec},context)).status,'ok');const result=f.core.getSessionViewData('alice','mixed')!;assert.equal(result.status,'partial');assert.deepEqual((result.data as any).missing,['other']);assert.equal((result.data as any).bindings[0].payload.state,'running');assert.equal(f.calls.write,0);assert.equal(f.calls.read,0);f.store.close();
});

test('write reserve and every state save automatically project receipts without saving entries or replaying the write',async()=>{
 const f=setup(),phases:string[]=[];const put=f.store.put.bind(f.store);f.store.put=function<T>(collection:string,id:string,value:T):T{const result=put(collection,id,value);if(collection==='snapshots'&&id.startsWith('operation:')&&(value as any).payload)phases.push((value as any).payload.state);return result;};
 const result=await f.core.invoke('hallmark_update_price',priceArgs,context);assert.equal(result.status,'ok');assert.equal(result.operation?.state,'succeeded');const id=result.operation!.operationId,snapshot=f.store.get('snapshots',`operation:${id}`)!;assert.equal(snapshot.payload.state,'succeeded');assert.equal(snapshot.dataTime,f.store.get('operations',id)!.updatedAt);assert.ok(phases.includes('pending'));assert.ok(phases.includes('running'));assert.equal(phases.at(-1),'succeeded');assert.equal(snapshot.payload.items[0].state,'succeeded');assert.equal(snapshot.payload.hallmarkRefs.length,1);assert.equal(f.calls.write,1);assert.equal(f.calls.read,1);await f.core.invoke('hallmark_update_price',priceArgs,context);assert.equal(f.calls.write,1);assert.equal(f.store.list('entries').length,0);assert.equal(f.store.list('components').length,0);assert.equal(f.store.list('queries').length,0);f.store.close();
});

test('receipt projection failure preserves last good cache version/time and cannot turn confirmed business success unknown',async()=>{
 const f=setup();const update=f.store.updateSnapshotSuccess.bind(f.store);let attempts=0;f.store.updateSnapshotSuccess=(key,payload,time,metadata)=>{if(key.startsWith('operation:')&&++attempts>1)throw new Error('receipt cache unavailable after initial projection');return update(key,payload,time,metadata);};
 const result=await f.core.invoke('hallmark_update_price',priceArgs,context);assert.equal(result.status,'ok');assert.equal(result.operation?.state,'succeeded');const id=result.operation!.operationId,ledger=f.store.get('operations',id)!,cache=f.store.get('snapshots',`operation:${id}`)!;assert.equal(ledger.state,'succeeded');assert.equal(ledger.error,undefined);assert.equal(cache.state,'failed');assert.equal(cache.payload.state,'pending');assert.equal(cache.version,1);assert.equal(cache.dataTime,cache.recordUpdatedAt);assert.ok(cache.lastSuccessAt);assert.equal(cache.lastError.code,'OPERATION_RECEIPT_CACHE_FAILED');assert.equal(cache.lastError.message,'receipt cache unavailable after initial projection');assert.equal(f.calls.write,1);assert.equal(f.calls.read,1);
 const rendered=await f.render('Authoritative despite cache failure',id),before=collections(f.store),viewId=(rendered.data as any).viewId;const data=f.core.getSessionViewData('alice',viewId)!;assert.equal(data.status,'ok');assert.equal((data.data as any).bindings[0].payload.state,'succeeded');assert.deepEqual(collections(f.store),before);assert.equal(f.calls.write,1);assert.equal(f.calls.read,1);f.store.close();
});

test('disabled app allows local UI receipt refresh with real owner metadata but never enables get_operation query bindings',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger('op','unknown'));f.store.put('session_apps','alice',{active:false,appId:'hallmark'});const result=await f.core.refreshDataset('operation:op',{sessionId:'arbitrary-ui-context'});assert.equal(result.status,'ok');assert.equal(f.store.get('snapshots','operation:op')!.sessionId,'alice');assert.equal(f.store.get('snapshots','operation:op')!.payload.state,'unknown');assert.equal(f.store.list('operations').length,1);assert.throws(()=>f.presentation.saveEntry({id:'main',query:{tool:'hallmark_get_operation',params:{operationId:'op'}},fieldMap:{}},'Forbidden query','保存'),/Saved queries cannot/);assert.equal((await f.core.refreshDataset('store_products:shop',{sessionId:'alice'})).error?.code,'APP_NOT_ACTIVE');assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});f.store.close();
});

test('null ledger owner stays null for global profile cache and cannot be claimed by a current native session',async()=>{
 const f=setup();f.store.put('operations','audit',f.ledger('audit','succeeded',null));assert.equal((await f.core.refreshDataset('operation:audit',{sessionId:'alice'})).status,'ok');assert.equal(f.store.get('snapshots','operation:audit')!.sessionId,null);const rendered=await f.render('Unowned audit receipt','audit'),viewId=(rendered.data as any).viewId;assert.equal(f.core.getSessionView('alice',viewId),undefined);assert.equal(f.core.getSessionViewData('alice',viewId),undefined);assert.equal(f.presentation.getViewData(viewId).status,'ok');assert.equal(f.store.list('entries').length,0);assert.equal(f.store.get('operations','audit')!.sessionId,null);assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});f.store.close();
});

test('aborted local receipt refresh does not mutate caches, ledger or invoke any source',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger());const controller=new AbortController();controller.abort();const before=collections(f.store);assert.equal((await f.core.refreshDataset('operation:op',{sessionId:'alice',signal:controller.signal})).error?.code,'ABORTED');assert.deepEqual(collections(f.store),before);assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});f.store.close();
});

test('only explicit saved operation bindings join background candidates and refresh stays pure local',async()=>{
 const f=setup();f.store.put('operations','op',f.ledger('op','unknown'));projectOperationReceipt(f.store,'op');assert.deepEqual(f.core.getRefreshCandidates(),[]);f.presentation.saveEntry({id:'main',datasetKey:'operation:op',fieldMap:{}},'Explicit receipt entry','明确保存此操作数据入口');assert.deepEqual(f.core.getRefreshCandidates(),['operation:op']);assert.equal((await f.core.refreshDatasetBackground('operation:op')).status,'ok');assert.equal(f.store.get('snapshots','operation:op')!.sessionId,'alice');assert.equal(f.store.list('operations').length,1);assert.deepEqual(f.calls,{stores:0,sync:0,products:0,write:0,read:0,other:0});f.store.close();
});
