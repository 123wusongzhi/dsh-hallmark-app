import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../../packages/store/index.ts';
import {PresentationManager} from '../../packages/presentation/src/index.ts';
import {AppCore} from '../../packages/core/src/index.ts';
import {cnyMinor} from '../../packages/core/src/ordinary-cny.ts';
import type {CoreOptions} from '../../packages/core/src/types.ts';
import type {OrdinaryCnyOperationResult,SubmitOrdinaryCnyPriceInput,OrdinaryCnyOperationRow} from '../../packages/hallmark-adapter/types.ts';
const ok=(raw:any)=>({status:'ok' as const,raw});
type Mode='verified'|'rejected'|'mixed'|'pending'|'not_found'|'opaque'|'throw';
function receipt(input:SubmitOrdinaryCnyPriceInput,mode:Mode):OrdinaryCnyOperationResult {
 if(mode==='throw')throw new Error('mock Source connection lost after submission');
 if(mode==='opaque')return {status:'unknown',stage:'outcome_unknown',error:{code:'OUTCOME_UNKNOWN',message:'opaque mock Source response',retryable:false}};
 if(mode==='not_found')return {status:'unknown',stage:'not_found',error:{code:'SOURCE_OPERATION_NOT_FOUND',message:'GET404 is not proof of no submission',retryable:false}};
 const products=input.products.map(product=>({...product,stock:'0' as const}));const results=products.map((product,index)=>{const status:OrdinaryCnyOperationRow['status']=mode==='pending'?'pending':mode==='rejected'||mode==='mixed'&&index>0?'rejected':'verified';return {...product,status,reason:status==='rejected'?'actual Source rejection reason':'',actualMinor:status==='verified'?cnyMinor(product.price)!:null,sellerMinor:status==='verified'?cnyMinor(product.price)!:null};});
 return {status:mode==='pending'?'unknown':mode==='verified'?'ok':'failed',stage:mode,raw:{id:input.operationId,storeId:input.storeId,kind:'ordinary',actionId:0,products,results,title:'Source ordinary record',createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:05:00Z',requestId:`human-promo-${input.operationId}`,status:mode==='pending'?'pending':'finished',error:mode==='rejected'||mode==='mixed'?'Source rejected selected rows':null,additive:{realRaw:'preserved'}}};
}
function setup(){
 const store=new AppStore(':memory:');store.put('session_apps','session',{appId:'hallmark',active:true});const presentation=new PresentationManager(store);
 const state={submit:'verified' as Mode,get:'not_found' as Mode,inspect:'verified' as Mode,missingToken:false};
 const calls={sourceSubmitAttempts:0,sourcePosts:0,sourceGet:0,inspectAttempts:0,sourceInspect:0,snapshots:0,taskPosts:0,taskRead:0};const inputs:SubmitOrdinaryCnyPriceInput[]=[];
 const products:any[]=[{storeId:'shop',productId:10,offerId:'A',untouchedStock:9},{storeId:'shop',productId:20,offerId:'B',untouchedStock:7},{storeId:'other',productId:99,offerId:'A'}];let storedInput:SubmitOrdinaryCnyPriceInput|undefined;
 const client:CoreOptions['client']={getStores:async()=>ok([{id:'shop',shopName:'Shop'}]),getStoreProducts:async()=>{calls.snapshots++;return ok({stores:[{id:'shop'}],products});},syncStoreProducts:async()=>{throw new Error('Must not sync during mapping');},getTargetMargin:async()=>ok({}),searchCollectedItems:async()=>ok([]),getCollectedItem:async()=>ok({}),
  platformCall:async()=>{calls.taskPosts++;return ok({outcome:'response_received',response:{result:[{updated:true,errors:[]}]}});},platformRead:async()=>{calls.taskRead++;return ok({response:{result:{items:[{offer_id:'A',product_id:10,price:{price:'100',currency_code:'CNY'}}]}}});},
  submitOrdinaryCnyPrice:async(input)=>{
   calls.sourceSubmitAttempts++;const intent=store.get('operations',input.operationId)!;assert.equal(intent.ordinaryCny.sourceOperationId,input.operationId);assert.deepEqual(intent.ordinaryCny.products,input.products);assert.equal(intent.items.length,input.products.length);assert.equal(intent.hallmarkRefs.length,input.products.length);assert.ok(intent.hallmarkRefs.every((ref:any)=>ref.transport==='ordinary_cny'&&ref.storeId===input.storeId&&ref.sourceOperationId===input.operationId&&!Object.hasOwn(ref,'taskId')));
   if(state.missingToken)return {status:'unavailable',error:{code:'HUMAN_AUTH_REQUIRED',message:'Configure explicit HALLMARK_OPERATOR_TOKEN; no Source POST sent',retryable:false}};
   calls.sourcePosts++;storedInput=structuredClone(input);inputs.push(structuredClone(input));return receipt(input,state.submit);
  },getOrdinaryCnyOperation:async(storeId,id)=>{calls.sourceGet++;assert.equal(storeId,storedInput!.storeId);assert.equal(id,storedInput!.operationId);return receipt(storedInput!,state.get);},
  inspectOrdinaryCnyOperation:async(storeId,id)=>{calls.inspectAttempts++;const existing=await client.getOrdinaryCnyOperation!(storeId,id);if(existing.stage!=='pending')return existing;calls.sourceInspect++;return receipt(storedInput!,state.inspect);}};
 const broker:CoreOptions['broker']={getStoreTask:async()=>({status:'unavailable',error:{code:'TASK_CONTEXT_REQUIRED',message:'No existing Listing task',retryable:false}}),getListingTask:async()=>ok({taskId:'listing'}),requestId:(kind,id,index)=>`${kind}-${id}-${index}`};
 let core=new AppCore({store,presentation,client,broker});
 async function execute(overrides:any={},name='hallmark_update_price',signal?:AbortSignal,sessionId='session'){
  const args={storeId:'shop',offerIds:['A'],price:100,currency:'CNY',valueSource:'user',clientOperationKey:'key',...overrides,userRequest:`明确把 Shop 指定商品 ${JSON.stringify(overrides.offerIds??overrides.productIds??['A'])} 普通价设为 ${overrides.price??100} ${overrides.currency??'CNY'}`};return core.invoke(name,JSON.parse(JSON.stringify(args)),{sessionId,userRequest:args.userRequest,signal});
 }
 const get=async(id:string)=>core.invoke('hallmark_get_operation',{operationId:id},{sessionId:'session'});
 return {store,presentation,client,broker,state,calls,products,inputs,execute,get,info:()=>core.invoke('hallmark_app_info',{},{sessionId:'session'}),restart:()=>{core=new AppCore({store,presentation,client,broker});return core;}};
}

test('only task-context absence uses one durable immutable whole CNY batch and a lowercase Core UUID',async()=>{
 const f=setup();const result=await f.execute({offerIds:['A','B'],scopeConfirmed:true,price:0.01});assert.equal(result.status,'ok');assert.equal(result.operation?.state,'succeeded');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,0);assert.equal(f.calls.taskPosts,0);assert.equal(f.calls.taskRead,0);const input=f.inputs[0];assert.match(input.operationId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.equal(input.operationId,result.operation?.operationId);assert.deepEqual(input.products,[{productId:10,offerId:'A',price:'0.01'},{productId:20,offerId:'B',price:'0.01'}]);assert.deepEqual(Object.keys(input).sort(),['operationId','products','storeId']);assert.ok(input.products.every(product=>!Object.hasOwn(product,'stock')));assert.deepEqual(f.products.map(row=>row.untouchedStock),[9,7,undefined]);
 const operation=f.store.get('operations',input.operationId)!;assert.equal(operation.items[0].observedMinor,1);assert.equal(operation.items[1].observedMinor,1);assert.deepEqual(operation.ordinaryCny.write.raw.additive,{realRaw:'preserved'});assert.equal(Object.hasOwn(operation.ordinaryCny.write.raw,'stage'),false);assert.match(operation.items[0].verificationBasis,/历史 price-state/);assert.equal(f.store.get('snapshots',`operation:${input.operationId}`)!.payload.state,'succeeded');await f.execute({offerIds:['B','A'],scopeConfirmed:true,price:0.01});assert.equal(f.calls.sourcePosts,1);assert.equal(f.store.list('entries').length,0);f.store.close();
});

test('available task retains old platform path rather than using ordinary CNY fallback',async()=>{
 const f=setup();f.broker.getStoreTask=async()=>ok({taskId:'existing'});const result=await f.execute();assert.equal(result.status,'ok');assert.equal(f.calls.taskPosts,1);assert.equal(f.calls.taskRead,1);assert.equal(f.calls.sourceSubmitAttempts,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

for(const [label,overrides,code] of [['RUB',{currency:'RUB'},undefined],['old price',{oldPrice:120},undefined],['activity',{actionId:1},'ACTION_PRICE_NOT_SUPPORTED']] as const)test(`${label} never selects CNY-only fallback`,async()=>{
 const f=setup(),result=await f.execute(overrides);assert.equal(result.status,'unavailable');if(code)assert.equal(result.error?.code,code);assert.equal(f.calls.sourceSubmitAttempts,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

for(const code of ['HALLMARK_UNAVAILABLE','HUMAN_AUTH_REQUIRED','TASK_PREPARATION_FAILED'])test(`broker ${code} is not silently replaced by another transport`,async()=>{
 const f=setup();f.broker.getStoreTask=async()=>({status:'unavailable',error:{code,message:'original broker refusal',retryable:false}});const result=await f.execute();assert.equal(result.error?.code,code);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

for(const method of ['submitOrdinaryCnyPrice','getOrdinaryCnyOperation','inspectOrdinaryCnyOperation'] as const)test(`missing optional ${method} keeps legacy clients compatible and does not submit`,async()=>{
 const f=setup();delete f.client[method];const result=await f.execute();assert.equal(result.error?.code,'TASK_CONTEXT_REQUIRED');assert.equal(f.calls.sourceSubmitAttempts,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

test('stock changes and rules never enter ordinary CNY Source route',async()=>{
 const f=setup();const stock=await f.execute({offerIds:['A'],warehouseId:'1',stock:0,price:undefined,currency:undefined},'hallmark_update_stock');assert.equal(stock.error?.code,'TASK_CONTEXT_REQUIRED');const rules=await f.execute({valueSource:'rule:unverified'});assert.equal(rules.status,'needs_clarification');assert.equal(f.calls.sourceSubmitAttempts,0);f.store.close();
});

for(const price of [1.005,1e21,90071992547410])test(`price ${price} is rejected rather than rounded or inferred before any mapping/submission`,async()=>{
 const f=setup();const result=await f.execute({price});assert.equal(result.status,'needs_clarification');assert.deepEqual(result.clarification?.missing,['price']);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

test('decimal 0.07 is exact CNY 7 cents and product-ID scope maps the real Offer',async()=>{
 const f=setup();const result=await f.execute({offerIds:undefined,productIds:['10'],price:0.07});assert.equal(result.status,'ok');assert.deepEqual(f.inputs[0].products,[{productId:10,offerId:'A',price:'0.07'}]);assert.equal((result.data as any).items[0].observedMinor,7);f.store.close();
});

for(const variant of ['missing','ambiguous','missing-platform-id','unsafe-id','duplicate-platform-mapping'] as const)test(`snapshot ${variant} cannot guess or shadow-map a source SKU`,async()=>{
 const f=setup();if(variant==='missing')f.products.splice(0,1);if(variant==='ambiguous')f.products.push({storeId:'shop',productId:30,offerId:'A'});if(variant==='missing-platform-id')f.products[0]={storeId:'shop',id:10,sourceSkuId:'shadow',offerId:'A'};if(variant==='unsafe-id')f.products[0].productId=9007199254740992;if(variant==='duplicate-platform-mapping')f.products[1].productId=10;
 const result=await f.execute(variant==='duplicate-platform-mapping'?{offerIds:['A','B'],scopeConfirmed:true}:{});assert.equal(result.status,'needs_clarification');assert.deepEqual(result.clarification?.missing,['productMapping']);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.sourceGet,0);f.store.close();
});

test('numeric Offer cannot resolve via an unrelated product ID or another store',async()=>{
 const f=setup();f.products[0]={storeId:'shop',productId:10,offerId:'different'};f.products.push({storeId:'other',productId:1,offerId:'10'});const result=await f.execute({offerIds:['10']});assert.equal(result.status,'needs_clarification');assert.equal(f.calls.sourcePosts,0);f.store.close();
});

test('explicit missing operator token ends unavailable/failed with zero Source wire writes and no phantom pending',async()=>{
 const f=setup();f.state.missingToken=true;const result=await f.execute();assert.equal(result.status,'unavailable');assert.equal(result.operation?.state,'failed');assert.equal(result.error?.code,'HUMAN_AUTH_REQUIRED');assert.equal(f.calls.sourceSubmitAttempts,1);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.sourceGet,0);assert.equal(f.calls.sourceInspect,0);const op=f.store.get('operations',result.operation!.operationId)!;assert.equal(op.state,'failed');assert.equal(op.items[0].state,'failed');await f.execute();assert.equal(f.calls.sourceSubmitAttempts,1);f.store.close();
});

for(const mode of ['opaque','throw'] as const)test(`${mode} submission stays unknown; same/new keys and restart never re-submit, GET404 never means not sent`,async()=>{
 const f=setup();f.state.submit=mode;const first=await f.execute();assert.equal(first.status,'unknown');assert.equal(first.operation?.state,'unknown');const id=first.operation!.operationId;assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,1);assert.equal(f.calls.inspectAttempts,0);const sourceUuid=f.store.get('operations',id)!.ordinaryCny.sourceOperationId;await f.execute();const blocked=await f.execute({clientOperationKey:'new-key'});assert.equal(blocked.status,'unknown');assert.equal(blocked.error?.code,'OPERATION_UNRESOLVED');assert.equal(f.calls.sourcePosts,1);const core=f.restart();await core.recoverOperations();assert.equal(f.store.get('operations',id)!.state,'unknown');assert.equal(f.store.get('operations',id)!.ordinaryCny.sourceOperationId,sourceUuid);assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.inspectAttempts,0);f.state.get='verified';const verified=await f.get(id);assert.equal(verified.status,'ok');assert.equal(verified.operation?.state,'succeeded');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.taskRead,0);assert.equal(f.calls.taskPosts,0);f.store.close();
});

test('pending Source performs one Core GET followed by only the SDK fresh-GET/readonly inspect chain',async()=>{
 const f=setup();f.state.submit='pending';f.state.get='pending';f.state.inspect='verified';const result=await f.execute();assert.equal(result.status,'ok');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,2);assert.equal(f.calls.sourceInspect,1);assert.equal(f.calls.taskPosts,0);assert.equal(f.calls.taskRead,0);assert.equal((result.data as any).ordinaryCny.inspection.stage,'verified');f.store.close();
});

test('all-terminal verified/rejected mixture is partial and retains every exact Source reason',async()=>{
 const f=setup();f.state.submit='mixed';const result=await f.execute({offerIds:['A','B'],scopeConfirmed:true});assert.equal(result.status,'partial');assert.equal(result.operation?.state,'partial');const items=(result.data as any).items;assert.deepEqual(items.map((item:any)=>item.state),['succeeded','failed']);assert.equal(items[1].message,'actual Source rejection reason');assert.equal(items[1].sourceResult.reason,items[1].error.message);assert.equal(f.calls.sourceGet,0);assert.equal(f.calls.sourcePosts,1);f.store.close();
});

test('all-terminal Source rejection is failed, not a fabricated unknown or a retried request',async()=>{
 const f=setup();f.state.submit='rejected';const result=await f.execute();assert.equal(result.status,'failed');assert.equal(result.operation?.state,'failed');assert.equal((result.data as any).items[0].error.message,'actual Source rejection reason');await f.execute();assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,0);f.store.close();
});

for(const corruption of ['amount','identity','source-store','source-uuid','ordinary-kind','stage-only','null-row','pending-in-mixed','raw-state-alias'] as const)test(`unverified Source ${corruption} cannot turn the Core operation successful`,async()=>{
 const f=setup();f.client.submitOrdinaryCnyPrice=async(input)=>{f.calls.sourcePosts++;const response=receipt(input,'verified');if(corruption==='amount')response.raw!.results[0].actualMinor=99;if(corruption==='identity')response.raw!.results[0].offerId='other';if(corruption==='source-store')response.raw!.storeId='other';if(corruption==='source-uuid')response.raw!.id='00000000-0000-0000-0000-000000000000';if(corruption==='ordinary-kind')(response.raw as any).kind='promotion';if(corruption==='stage-only')delete response.raw;if(corruption==='null-row')(response.raw!.results as any)[0]=null;if(corruption==='pending-in-mixed'){response.stage='mixed';response.status='failed';response.raw!.results[0].status='pending';response.raw!.results[0].actualMinor=null;}if(corruption==='raw-state-alias'){(response.raw as any).state='succeeded';delete (response.raw as any).status;}return response;};f.client.getOrdinaryCnyOperation=async()=>{f.calls.sourceGet++;return {status:'unknown',stage:'not_found'};};const result=await f.execute();assert.equal(result.status,'unknown');assert.equal(result.operation?.state,'unknown');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,1);assert.equal(f.calls.sourceInspect,0);assert.equal(f.calls.taskRead,0);f.store.close();
});

test('mixed verified/rejected/pending source rows remain unknown with all original evidence, never terminal partial',async()=>{
 const f=setup();f.products.push({storeId:'shop',productId:30,offerId:'C'});f.client.submitOrdinaryCnyPrice=async(input)=>{f.calls.sourcePosts++;const response=receipt(input,'mixed');response.raw!.results[2].status='pending';response.raw!.results[2].actualMinor=null;return response;};f.client.getOrdinaryCnyOperation=async()=>{f.calls.sourceGet++;return {status:'unknown',stage:'not_found'};};const result=await f.execute({offerIds:['A','B','C'],scopeConfirmed:true});assert.equal(result.status,'unknown');assert.equal(result.operation?.state,'unknown');assert.deepEqual((result.data as any).ordinaryCny.write.raw.results.map((row:any)=>row.status),['verified','rejected','pending']);assert.equal((result.data as any).ordinaryCny.write.raw.results[1].reason,'actual Source rejection reason');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,1);f.store.close();
});

test('post-transport ledger processing exception preserves source intent and unknown envelope, including later GET404',async()=>{
 const f=setup(),put=f.store.put.bind(f.store);let fired=false;f.store.put=function<T>(collection:string,id:string,value:T):T{if(!fired&&collection==='operations'&&(value as any).state==='running'&&(value as any).ordinaryCny?.write){fired=true;throw new Error('mock ledger processing exception after Source transport');}return put(collection,id,value);};const first=await f.execute();assert.equal(first.status,'unknown');assert.equal(first.operation?.state,'unknown');const id=first.operation!.operationId,record=f.store.get('operations',id)!;assert.equal(record.ordinaryCny.write.stage,'verified');assert.equal(record.hallmarkRefs[0].sourceOperationId,id);await f.execute();assert.equal(f.calls.sourcePosts,1);const reread=await f.get(id);assert.equal(reread.status,'unknown');assert.equal(reread.operation?.state,'unknown');assert.equal(f.calls.sourcePosts,1);f.state.get='verified';assert.equal((await f.get(id)).status,'ok');assert.equal(f.calls.sourcePosts,1);f.store.close();
});

test('cancellation after mapping read is checked before persisting any source send refs or posting',async()=>{
 const f=setup(),controller=new AbortController();f.client.getStoreProducts=async()=>{f.calls.snapshots++;controller.abort();return ok({products:f.products});};const result=await f.execute({},'hallmark_update_price',controller.signal);assert.equal(result.status,'failed');assert.equal(result.error?.code,'ABORTED');assert.equal(f.calls.sourceSubmitAttempts,0);assert.equal((result.operation&&f.store.get('operations',result.operation.operationId)!.hallmarkRefs.length),0);f.store.close();
});

test('app_info advertises only conditional ordinary CNY Source replacement, not generic task creation or realtime price reads',async()=>{
 const f=setup(),result=await f.info();const boundaries=(result.data as any).boundaries;assert.match(boundaries.storeTask,/仍无通用无商品店铺任务创建/);assert.match(boundaries.storeTask,/TASK_CONTEXT_REQUIRED/);assert.match(boundaries.storeTask,/普通 CNY/);assert.match(boundaries.storeTask,/不创建假任务/);assert.match(boundaries.ordinaryCnyVerification,/历史 price-state/);assert.match(boundaries.ordinaryCnyVerification,/非实时价格/);assert.match(boundaries.ordinaryCnyVerification,/404 不是未发送证据/);assert.equal(f.calls.sourcePosts,0);f.store.close();
});

test('real Adapter-shaped Source HTTP401 is a clear auth refusal, not unknown/GET404 forever locking a zero-write request',async()=>{
 const f=setup(),submit=f.client.submitOrdinaryCnyPrice!;
 f.client.submitOrdinaryCnyPrice=async()=>{f.calls.sourceSubmitAttempts++;return {status:'failed',raw:{error:'Unauthorized: original operator token required'} as any,error:{code:'HALLMARK_HTTP_401',message:'Unauthorized: original operator token required',retryable:false}};};
 const refused=await f.execute();assert.equal(refused.status,'failed');assert.equal(refused.operation?.state,'failed');assert.equal(refused.error?.code,'HALLMARK_HTTP_401');const record=f.store.get('operations',refused.operation!.operationId)!;assert.equal(record.state,'failed');assert.equal(record.items[0].state,'failed');assert.deepEqual(record.ordinaryCny.write.raw,{error:'Unauthorized: original operator token required'});assert.equal(record.ordinaryCny.write.stage,undefined);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.sourceGet,0);assert.equal(f.calls.inspectAttempts,0);assert.equal((await f.execute()).operation?.operationId,refused.operation!.operationId);assert.equal(f.calls.sourceSubmitAttempts,1);
 f.client.submitOrdinaryCnyPrice=submit;const afterExplicitConfiguration=await f.execute({clientOperationKey:'new-user-confirmed-key'});assert.equal(afterExplicitConfiguration.status,'ok');assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,0);f.store.close();
});

test('Adapter-shaped Source503 remains unknown with GET404 evidence and never receives auth-refusal treatment or retry',async()=>{
 const f=setup();f.client.submitOrdinaryCnyPrice=async()=>{f.calls.sourcePosts++;return {status:'unknown',stage:'outcome_unknown',raw:{error:'Source503 proxy/service error after possible dispatch'} as any,error:{code:'OUTCOME_UNKNOWN',message:'Source503 may have sent the price request',retryable:false}};};f.client.getOrdinaryCnyOperation=async()=>{f.calls.sourceGet++;return {status:'unknown',stage:'not_found',error:{code:'SOURCE_OPERATION_NOT_FOUND',message:'GET404 does not prove not sent',retryable:false}};};const first=await f.execute();assert.equal(first.status,'unknown');assert.equal(first.operation?.state,'unknown');assert.equal((first.data as any).ordinaryCny.write.raw.error,'Source503 proxy/service error after possible dispatch');await f.execute();await f.execute({clientOperationKey:'new-key-after-503'});assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,1);assert.equal(f.calls.inspectAttempts,0);f.store.close();
});

for(const phase of ['pending','running','unknown'] as const)test(`foreign-session ${phase} keeps the same global block but never discloses its state, UUID, title, input, refs or evidence`,async()=>{
 const f=setup(),foreignId='a0000000-0000-4000-a000-000000000001';const foreign={operationId:foreignId,kind:'update_price',sessionId:'FOREIGN-PRIVATE-SESSION',clientKey:'foreign-private-key',storeId:'shop',targets:['A'],state:phase,input:{price:100,currency:'CNY',userRequest:'FOREIGN-PRIVATE-REQUEST'},items:[{target:'A',state:'unknown',sourceResult:{privateEvidence:'FOREIGN-PRIVATE-EVIDENCE'}}],hallmarkRefs:[{transport:'ordinary_cny',sourceOperationId:foreignId,privateRef:'FOREIGN-PRIVATE-REF'}],title:'FOREIGN-PRIVATE-TITLE',createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:01:00Z'};f.store.put('operations',foreignId,foreign);
 const blocked=await f.execute({clientOperationKey:`new-key-${phase}`});assert.equal(blocked.status,'failed');assert.equal(blocked.error?.code,'OPERATION_UNRESOLVED');assert.equal(Object.hasOwn(blocked,'data'),false);assert.equal(Object.hasOwn(blocked,'operation'),false);assert.doesNotMatch(JSON.stringify(blocked),new RegExp(`${foreignId}|FOREIGN-PRIVATE|${phase}`));assert.deepEqual(f.store.get('operations',foreignId),foreign);assert.equal(f.store.list('operations').length,1);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.sourceGet,0);assert.equal(f.calls.snapshots,0);f.store.close();
});

test('own-session unknown different-key guard retains its readable operation link and same-key idempotence while another session receives only generic refusal',async()=>{
 const f=setup();f.state.submit='opaque';const own=await f.execute(),id=own.operation!.operationId;const same=await f.execute();assert.equal(same.status,'unknown');assert.equal(same.operation?.operationId,id);assert.equal((same.data as any).sessionId,'session');const ownBlocked=await f.execute({clientOperationKey:'own-different-key'});assert.equal(ownBlocked.status,'unknown');assert.equal(ownBlocked.error?.code,'OPERATION_UNRESOLVED');assert.equal(ownBlocked.operation?.operationId,id);assert.equal((ownBlocked.data as any).ordinaryCny.sourceOperationId,id);
 f.store.put('session_apps','other-session',{active:true,appId:'hallmark'});const foreign=await f.execute({clientOperationKey:'other-session-key'},'hallmark_update_price',undefined,'other-session');assert.equal(foreign.error?.code,'OPERATION_UNRESOLVED');assert.equal(foreign.status,'failed');assert.equal(Object.hasOwn(foreign,'data'),false);assert.equal(Object.hasOwn(foreign,'operation'),false);assert.doesNotMatch(JSON.stringify(foreign),new RegExp(id));assert.equal(f.calls.sourcePosts,1);assert.equal(f.calls.sourceGet,1);assert.equal(f.store.list('operations').length,1);f.store.close();
});

for(const phase of ['pending','running'] as const)test(`crash-seeded ${phase} Source intent recovers only by GET, archives restart evidence and clears only stale top restart error after success`,async()=>{
 const f=setup(),id='b0000000-0000-4000-a000-000000000002',product={productId:10,offerId:'A',price:'100'};f.store.put('operations',id,{operationId:id,kind:'update_price',sessionId:'session',clientKey:`crash-${phase}`,storeId:'shop',targets:['A'],input:{price:100,currency:'CNY',offerIds:['A'],userRequest:'confirmed original source CNY request'},state:phase,ordinaryCny:{sourceOperationId:id,storeId:'shop',products:[product],unresolved:true},items:[{target:'A',state:'unknown',transport:'ordinary_cny',sourceOperationId:id,storeId:'shop',...product,expectedMinor:10000}],hallmarkRefs:[{transport:'ordinary_cny',sourceOperationId:id,storeId:'shop',target:'A',productId:10,offerId:'A'}],createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:00:00Z'});f.client.getOrdinaryCnyOperation=async(storeId,operationId)=>{f.calls.sourceGet++;assert.equal(storeId,'shop');assert.equal(operationId,id);return receipt({operationId:id,storeId:'shop',products:[product]},'verified');};const states:string[]=[],put=f.store.put.bind(f.store);f.store.put=function<T>(collection:string,key:string,value:T):T{if(collection==='operations'&&key===id)states.push((value as any).state);return put(collection,key,value);};const recovered=await f.restart().recoverOperations();assert.equal(recovered[0].status,'ok');assert.equal(recovered[0].operation?.state,'succeeded');assert.equal(Object.hasOwn(recovered[0],'error'),false);const record=f.store.get('operations',id)!;assert.equal(record.error,null);assert.equal(record.diagnostics[0].kind,'recovery');assert.equal(record.diagnostics[0].error.code,'PROCESS_RESTARTED');assert.match(record.diagnostics[0].error.message,/不自动重放/);assert.ok(Number.isFinite(Date.parse(record.diagnostics[0].recordedAt)));assert.equal(states[0],'unknown');assert.ok(states.every(state=>state==='unknown'||state==='succeeded'));assert.equal(f.store.get('snapshots',`operation:${id}`)!.payload.error,null);assert.equal(f.store.get('snapshots',`operation:${id}`)!.payload.diagnostics[0].error.code,'PROCESS_RESTARTED');assert.equal(f.calls.sourceGet,1);assert.equal(f.calls.sourceSubmitAttempts,0);assert.equal(f.calls.sourcePosts,0);assert.equal(f.calls.taskPosts,0);assert.equal(f.calls.taskRead,0);f.store.close();
});

test('successful readonly resolution clears only legacy PROCESS_RESTARTED, never discards genuine transport/row failure evidence',async()=>{
 const f=setup();f.state.submit='opaque';const first=await f.execute(),id=first.operation!.operationId;const sourceError={code:'ACTUAL_SOURCE_FAILURE',message:'real earlier source failure evidence',retryable:false};let record=f.store.get('operations',id)!;f.store.put('operations',id,{...record,error:sourceError});f.state.get='verified';const resolved=await f.get(id);assert.equal(resolved.status,'ok');assert.deepEqual(resolved.error,sourceError);record=f.store.get('operations',id)!;assert.deepEqual(record.error,sourceError);assert.equal(record.ordinaryCny.write.error.code,'OUTCOME_UNKNOWN');assert.equal(f.calls.sourcePosts,1);
 // Legacy persisted restart errors may predate the diagnostics field; their original event time is unknown, not fabricated as now.
 const older=setup();older.state.submit='opaque';const prior=await older.execute(),legacyId=prior.operation!.operationId;const seed=older.store.get('operations',legacyId)!;older.store.put('operations',legacyId,{...seed,error:{code:'PROCESS_RESTARTED',message:'legacy diagnostic'}});older.state.get='verified';const legacy=await older.get(legacyId);assert.equal(legacy.status,'ok');assert.equal(Object.hasOwn(legacy,'error'),false);const legacyRecord=older.store.get('operations',legacyId)!;assert.equal(legacyRecord.diagnostics[0].error.message,'legacy diagnostic');assert.equal(legacyRecord.diagnostics[0].recordedAt,null);assert.equal(older.calls.sourcePosts,1);assert.equal(f.calls.sourcePosts,1);older.store.close();f.store.close();
});

test('receipt cache failure does not overturn a confirmed conditional CNY source result',async()=>{
 const f=setup();const update=f.store.updateSnapshotSuccess.bind(f.store);f.store.updateSnapshotSuccess=(key,payload,time,metadata)=>{if(key.startsWith('operation:'))throw new Error('mock receipt projection down');return update(key,payload,time,metadata);};const result=await f.execute();assert.equal(result.status,'ok');assert.equal(result.operation?.state,'succeeded');assert.equal(f.store.get('operations',result.operation!.operationId)!.state,'succeeded');assert.equal(f.store.get('snapshots',`operation:${result.operation!.operationId}`)!.state,'failed');assert.equal(f.calls.sourcePosts,1);f.store.close();
});
