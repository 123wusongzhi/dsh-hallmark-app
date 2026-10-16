import { recordedSample, recordedDetail, recordedSku } from '../adapter/real-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {categoryToolId} from '../../packages/app-hallmark/src/category-identities.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';

const baseline=process.env.HANDOFF_BASELINE==='1';
const ok=(raw:any)=>({status:'ok' as const,raw});
function fixture(id:any=123,direct=true){
 const database=new RuntimeStore(':memory:'),runtime=new AppsRuntime(database),store=new HallmarkStorePort(database,'c');let sequence=0,providerCalls=0;const calls:any[]=[];
 const item={description_category_id:id,type_id:456,type_name:'Cup',children:[]};
 const client:any={getStores:async()=>ok([{id:'shop'}]),getStoreProducts:async()=>ok({stores:[{id:'shop'}],products:[]}),syncStoreProducts:async()=>ok({}),getTargetMargin:async()=>ok({}),searchCollectedItems:async()=>ok([]),getCollectedItem:async()=>{throw Error('no raw');},getCollectedItemDetail:async()=>ok(recordedDetail({id:'p1',source:'taobao_tmall',title:'Cup',currency:'CNY',skus:[recordedSku({sourceSkuId:'sku1',spec:'red',goodsPrice:3,currency:'CNY'}, recordedSample({id:'p1',source:'taobao_tmall',nonempty:true}), undefined, ["properties","id","code"])]}, recordedSample({id:'p1',source:'taobao_tmall',nonempty:true}))),getCategoryData:async(input:any)=>{calls.push(input);return input.mode==='search'?ok({items:[item]}):ok({result:[{id:85,is_required:true,dictionary_id:1}]});},platformCall:async()=>{throw Error('WRITE FORBIDDEN');},platformRead:async()=>{throw Error('NETWORK FORBIDDEN');}};
 const directStore={id:'shop',name:'Shop',platform:'ozon',enabled:true,revision:1,credentialRevision:1,hasCredentials:true,sourceConnectionId:'c'};
 const gateway:any={listStores:()=>[directStore],hasStore:(id:string)=>id==='shop',getStore:()=>directStore,getProducts:async()=>ok({response:{items:[]}}),request:async(storeId:string,input:any)=>{calls.push(input);if(input.path==='/v1/description-category/tree')return ok({result:[item]});if(input.path==='/v1/description-category/attribute')return ok({result:[{id:85,is_required:true,dictionary_id:1}]});throw Error('UNEXPECTED '+input.path);}};
 const provider=new HallmarkProvider({store:()=>store,client,businessGateway:direct?gateway:undefined,broker:{getStoreTask:async()=>{throw Error('NO TASK');},getListingTask:async()=>{throw Error('NO TASK');},requestId:()=>''}}),execute=provider.execute.bind(provider);
 provider.execute=async context=>{providerCalls++;return execute(context);};runtime.register(provider);
 runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'fixture',config:{backend:'fixture'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 const invoke=async(capabilityId:string,input:any)=>{const n=++sequence;const result=await runtime.invoke({protocolVersion:'1.0',invocationId:`h-${n}`,traceId:`h-${n}`,appId:'hallmark',connectionId:'c',capabilityId,capabilityVersion:'1.0.0',input:JSON.parse(JSON.stringify(input)),source:{kind:'agent',sessionId:'s',nativeCallId:`h-${n}`},deadlineAt:new Date(Date.now()+60000).toISOString()});return JSON.parse(projectModelResult(database,result).content);};
 return {invoke,calls,providerCalls:()=>providerCalls,close:async()=>{await runtime.dispose();database.close();}};
}
const cases=[{id:123,label:'numeric'},{id:Number.MAX_SAFE_INTEGER,label:'safe-boundary'},{id:'123',label:'string'}];
const measurements:any[]=[];
for(const direct of [true,false])for(const origin of ['prepare','read']){if(!direct&&origin==='read')continue;for(const value of cases)for(const target of ['prepare','read'])test(`${direct?'direct':'legacy'} ${origin} ${value.label} -> ${target}`,async()=>{
 const f=fixture(value.id,direct);try{
  const started=performance.now();const first=await f.invoke(origin==='prepare'?'hallmark.listing.prepare':'hallmark.categories.read',origin==='prepare'?{storeId:'shop',selections:[{id:'p1'}]}:{storeId:'shop',mode:'search',q:'Cup'});assert.equal(first.status,'ok');
  const candidate=origin==='prepare'?first.data.categories.p1.items[0]:first.data.raw.items[0];
  if(origin==='prepare'){assert.equal(first.data.categories.p1.status,'candidates');assert.equal(first.data.categories.p1.selection,undefined);}
  const selected={descriptionCategoryId:candidate.descriptionCategoryId,typeId:candidate.typeId};
  let result=await f.invoke(target==='prepare'?'hallmark.listing.prepare':'hallmark.categories.read',target==='prepare'?{storeId:'shop',selections:[{id:'p1'}],categories:{p1:selected}}:{storeId:'shop',mode:'template',...selected});
  const firstAttempt=result.status;let attempts=1;
  if(baseline){assert.equal(result.status,'failed');assert.equal(result.error.code,'INPUT_SCHEMA_INVALID');
   // Explicit deterministic recovery oracle; only benchmark after exact failure, never claim this is an actual agent.
   const repaired={descriptionCategoryId:String(candidate.descriptionCategoryId),typeId:String(candidate.typeId)};
   result=await f.invoke(target==='prepare'?'hallmark.listing.prepare':'hallmark.categories.read',target==='prepare'?{storeId:'shop',selections:[{id:'p1'}],categories:{p1:repaired}}:{storeId:'shop',mode:'template',...repaired});attempts++;
  }
  assert.equal(result.status,'ok',JSON.stringify(result));assert.equal(String(value.id),target==='prepare'?result.data.categories.p1.selection.descriptionCategoryId:result.data.query.params.descriptionCategoryId);
  const last=f.calls.at(-1);assert.equal(direct?last.body.description_category_id:last.descriptionCategoryId,direct?Number(value.id):String(value.id));
  measurements.push({direct,origin,target,label:value.label,firstAttempt,attempts,ms:performance.now()-started});
 }finally{await f.close();}
});}
for(const id of [null,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'001','9007199254740993','bad'])test(`invalid identity remains unusable: ${id}`,async()=>{
 const f=fixture(id,false);try{const first=await f.invoke('hallmark.listing.prepare',{storeId:'shop',selections:[{id:'p1'}]});assert.equal(first.status,'ok');const candidate=first.data.categories.p1.items[0];assert.equal(candidate.descriptionCategoryId,id);
 const selected={descriptionCategoryId:candidate.descriptionCategoryId,typeId:candidate.typeId};const before=f.calls.length;
 const result=await f.invoke('hallmark.categories.read',{storeId:'shop',mode:'template',...selected});assert.equal(result.status,'failed');assert.equal(f.calls.length,before,'invalid identity never reaches transport');
 }finally{await f.close();}
});
test('report replay measurements',()=>{console.log('HANDOFF_METRICS '+JSON.stringify({baseline,measurements}));});

// Persist the independent review's 39 actual JSON -> Runtime boundaries.
for(const field of ['descriptionCategoryId','typeId'])for(const value of [Number.MAX_SAFE_INTEGER+1,NaN,Infinity,-Infinity,undefined,null,0,-1,1.5])for(const target of ['read','prepare'])test(`JSON boundary ${field}=${String(value)} -> ${target}`,async()=>{
 const f=fixture();try{
  const selected={descriptionCategoryId:'123',typeId:'456',[field]:categoryToolId(value)};
  const result=await f.invoke(target==='read'?'hallmark.categories.read':'hallmark.listing.prepare',target==='read'?{storeId:'shop',mode:'template',...selected}:{storeId:'shop',selections:[{id:'p1'}],categories:{p1:selected}});
  // Current category contracts require both identities before provider dispatch,
  // including fields omitted by JSON serialization (verified on baseline 92b2890).
  assert.equal(result.status,'failed');assert.equal(result.error.code,'INPUT_SCHEMA_INVALID');
  assert.equal(f.providerCalls(),0,'invalid or missing IDs do not dispatch the provider');
  assert.equal(f.calls.length,0,'invalid IDs do not reach category transport');
 }finally{await f.close();}
});
for(const value of [1,Number.MAX_SAFE_INTEGER,'123'])test(`JSON boundary valid ${value} -> read`,async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.categories.read',{storeId:'shop',mode:'template',descriptionCategoryId:categoryToolId(value),typeId:categoryToolId(value)});assert.equal(result.status,'ok');assert.equal(f.calls.length,1);assert.equal(result.data.query.params.descriptionCategoryId,String(value));assert.equal(result.data.query.params.typeId,String(value));}finally{await f.close();}
});
test('direct search preserves native raw IDs while camelCase IDs are reusable',async()=>{
 const f=fixture();try{const result=await f.invoke('hallmark.categories.read',{storeId:'shop',mode:'search',q:'Cup'});assert.equal(result.status,'ok');const item=result.data.raw.items[0];assert.equal(item.description_category_id,123);assert.equal(item.type_id,456);assert.equal(item.descriptionCategoryId,baseline?123:'123');assert.equal(item.typeId,baseline?456:'456');assert.equal(item.type_name,'Cup');assert.deepEqual(item.children,[]);assert.equal(result.data.raw.total,1);}finally{await f.close();}
});
test('legacy raw category search remains exact native data',async()=>{
 const f=fixture(123,false);try{const result=await f.invoke('hallmark.categories.read',{storeId:'shop',mode:'search',q:'Cup'});assert.equal(result.status,'ok');assert.deepEqual(result.data.raw,{items:[{description_category_id:123,type_id:456,type_name:'Cup',children:[]}]});}finally{await f.close();}
});
test('helper preserves nonfinite and preexisting string identities without guessing',()=>{
 for(const value of [undefined,null,NaN,Infinity,-Infinity,0,-0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'001','9007199254740993','bad','123'])assert.ok(Object.is(categoryToolId(value),value));
 assert.deepEqual(JSON.parse(JSON.stringify({descriptionCategoryId:categoryToolId(undefined),typeId:'456'})),{typeId:'456'});
});
