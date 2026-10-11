import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkProvider,HallmarkStorePort,HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import {compileCapability} from '../../packages/app-contracts/src/index.ts';
import {OzonBusinessGateway} from '../../packages/ozon-business/src/index.ts';
import {platformFailureDetails} from '../../packages/app-hallmark/src/failure-details.ts';
import {legacyListingIssue} from '../../packages/app-hallmark/src/input-contracts.ts';

function fixture(t:any,fetchImpl?:typeof fetch){
 const directory=mkdtempSync(join(tmpdir(),'hallmark-diagnostics-'));
 const gateway=new OzonBusinessGateway(directory,{fetchImpl:fetchImpl??(async()=>{throw new Error('unexpected upstream');})});
 gateway.saveStore({id:'shop',name:'Shop',expectedRevision:0,currency:'CNY',sourceConnectionId:'c',credentials:{clientId:'fixture-client',apiKey:'fixture-secret'}});
 const store=new RuntimeStore(':memory:'),port=new HallmarkStorePort(store,'c');let executed=0;
 const provider=new HallmarkProvider({store:port,client:{} as any,broker:{} as any,businessGateway:gateway});
 const execute=provider.execute.bind(provider);provider.execute=async context=>{executed++;return execute(context);};
 const runtime=new AppsRuntime(store);runtime.register(provider);
 runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'Fixture',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 t.after(async()=>{await runtime.dispose();store.close();assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}hallmark-diagnostics-`));rmSync(directory,{recursive:true,force:true});});
 const invoke=(capabilityId:string,input:any)=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+10000).toISOString()});
 return {invoke,executed:()=>executed};
}

test('previously underspecified inputs are rejected with field paths before the provider runs',async t=>{
 const f=fixture(t);
 const cases:[string,any,string][]=[
  ['hallmark.collection.read',{},'id'],
  ['hallmark.categories.read',{storeId:'shop',mode:'search'},'q'],
  ['hallmark.api.category.read',{storeId:'shop',mode:'sync',q:'invalid'},'q'],
  ['hallmark.products.update_price',{storeId:'shop',price:12},'offerIds'],
  ['hallmark.api.products.update_price',{storeId:'shop',price:12},'offerIds'],
  ['hallmark.products.list_product',{storeId:'shop',collectedItemId:'source',skuScope:['sku'],importItems:[{}]},'offer_id'],
  ['hallmark.products.list_product',{storeId:'shop',collectedItemId:'source',skuScope:['sku'],importItems:[{_sourceSkuId:'sku'}]},'offer_id'],
  ['hallmark.api.products.info',{storeId:'shop',body:{}},'product_id'],
  ['hallmark.api.products.info',{storeId:'shop',body:{product_id:[],sku:[],offer_id:[]}},'few items'],
 ];
 for(const [id,input,field] of cases){const result=await f.invoke(id,input);assert.equal(result.status,'failed',id);assert.match(JSON.stringify(result),new RegExp(field));}
 assert.equal(f.executed(),0);
});

test('refined contracts retain category modes, selection continuations and valid product identifiers',()=>{
 const check=(id:string,input:any)=>{const descriptor=HALLMARK_DESCRIPTORS.find(d=>d.capabilityId===id)!;assert.deepEqual(compileCapability(descriptor).input(input),[],`${id}: ${JSON.stringify(input)}`);};
 for(const prefix of ['hallmark.categories.read','hallmark.api.category.read']){
  check(prefix,{store:'Shop',mode:'search',q:'connector',limit:20});
  check(prefix,{storeId:'shop',mode:'sync'});
  for(const mode of ['show','template'])check(prefix,{storeId:'shop',mode,descriptionCategoryId:'1',typeId:'2'});
  check(prefix,{storeId:'shop',mode:'values',descriptionCategoryId:'1',typeId:'2',attributeId:'3',q:'ab',limit:100});
  check(prefix,{storeId:'shop',mode:'validate_value',descriptionCategoryId:'1',typeId:'2',attributeId:'3',valueId:'4',dictionaryId:'5'});
 }
 for(const selection of [{id:'item',cursor:'sku-cursor'},{ids:['one','two']},{selections:[{id:'one',skuIds:['s']}]},{cursor:'batch:opaque'}])check('hallmark.collection.read',selection);
 for(const body of [{product_id:['9007199254740993']},{product_id:[1],offer_id:[]},{sku:['1']},{offer_id:['SKU-A']}])check('hallmark.api.products.info',{storeId:'shop',body});
 check('hallmark.products.list_product',{storeId:'shop',collectedItemId:'source',skuScope:['legacy-offer'],importItems:[{offer_id:'legacy-offer',name:'arbitrary native fields preserved'}]});
 check('hallmark.products.list_product',{storeId:'shop',collectedItemId:'source',skuScope:['legacy-offer'],importItems:[{offer_id:'legacy-offer',_sourceSkuId:null}]});
 assert.equal(legacyListingIssue({skuScope:['legacy-offer'],importItems:[{offer_id:'legacy-offer'}]}),undefined);
});

test('listing source reference diagnostics name the exact offending item without dispatching',async t=>{
 const f=fixture(t);
 for(const [item,code] of [[{offer_id:'a'},'SOURCE_SKU_REFERENCE_REQUIRED'],[{offer_id:'a',_sourceSkuId:'other'},'SOURCE_SKU_OUTSIDE_SCOPE']] as const){
  const result=await f.invoke('hallmark.products.list_product',{storeId:'shop',collectedItemId:'source',skuScope:['sku'],importItems:[item]});
  assert.equal(result.status,'failed');if(result.status!=='failed')continue;
  assert.equal(result.error.code,code);assert.deepEqual(result.error.details,{field:'importItems[0]._sourceSkuId'});assert.match(result.error.message,/skuScope/);
 }
});

test('real gateway field errors survive provider conversion with credential redaction',async t=>{
 let calls=0;const f=fixture(t,async()=>{calls++;return Response.json({code:3,message:'fixture-secret rejected for fixture-client',details:[{field:'product_id',message:'product not found'}],api_key:'fixture-secret'},{status:400});});
 const result=await f.invoke('hallmark.api.products.info',{storeId:'shop',body:{product_id:[1]}});
 assert.equal(calls,1);assert.equal(result.status,'failed');if(result.status!=='failed')return;
 assert.equal(result.error.code,'OZON_REJECTED');assert.equal(result.error.retryPolicy,'never');
 const details=result.error.details as any;assert.equal(details.httpStatus,400);assert.equal(details.response.details[0].field,'product_id');
 assert.doesNotMatch(JSON.stringify(result),/fixture-secret|fixture-client/);assert.equal(details.response.api_key,'[redacted]');
});

test('unavailable platform responses retain useful diagnostics and success remains unchanged',async t=>{
 let broken=true;const f=fixture(t,async()=>broken?Response.json({message:'maintenance'},{status:503}):Response.json({items:[{id:1,offer_id:'a',sku:1001}]}));
 const unavailable=await f.invoke('hallmark.api.products.info',{storeId:'shop',body:{product_id:[1]}});
 assert.equal(unavailable.status,'unavailable');if(unavailable.status==='unavailable')assert.deepEqual(unavailable.error.details,{httpStatus:503,response:{message:'maintenance'}});
 broken=false;const success=await f.invoke('hallmark.api.products.info',{storeId:'shop',body:{product_id:[1]}});assert.equal(success.status,'ok');if(success.status==='ok')assert.equal((success.data as any).response.items[0].id,1);
});

test('platform error details are bounded and do not expose unrelated receipt data',()=>{
 const result=platformFailureDetails({status:'failed',data:{httpStatus:400,response:{details:Array.from({length:1000},()=>({message:'错误'.repeat(5000)}))},credentialRevision:7,request:{private:'must-not-copy'}}});
 assert.ok(Buffer.byteLength(JSON.stringify(result))<8192);assert.equal((result as any).truncated,true);assert.doesNotMatch(JSON.stringify(result),/must-not-copy|credentialRevision/);
 assert.equal(platformFailureDetails({status:'failed',data:{secret:'not a platform response'}}),undefined);
 const legacy=platformFailureDetails({status:'failed',data:{httpStatus:400,response:{message:'Authorization: Bearer synthetic-bearer; api_key="synthetic-api-key" password=synthetic-password',field:'price',details:[{message:'invalid price',token:'synthetic-token'}]}}});
 assert.doesNotMatch(JSON.stringify(legacy),/synthetic-/);assert.match(JSON.stringify(legacy),/invalid price/);
});
