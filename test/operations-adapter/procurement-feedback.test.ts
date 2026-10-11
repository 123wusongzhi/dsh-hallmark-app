import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {HallmarkBusinessAdapter} from '../../packages/app-hallmark/src/operations-adapter.ts';
import {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import {executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import {CollectionService} from '../../packages/collection/src/index.ts';
import {BusinessPackagingRepository} from '../../packages/business-packaging/src/index.ts';

function fixture(options:{count?:number; packaging?:boolean; failSecond?:boolean; duplicate?:boolean}={}){
 const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'fixture');
 let sourceReads=0,writes=0,reviews=0,packageCalls=0;
 const details=Object.fromEntries(['cup','lid'].map(id=>[id,{id,title:id,source:'taobao_tmall',currency:'CNY',package:{weightKg:.1,dimensionsCm:{length:10,width:10,height:10}},skus:Array.from({length:options.count??1},(_,i)=>({sourceSkuId:options.duplicate?'duplicate':`${id}-verified-${i}`,spec:`${id} variant ${i}`,goodsPrice:3,currency:'CNY'}))}]));
 const client:any={getStoreProducts:async()=>({status:'ok',raw:{stores:[{id:'bill'}],products:[]}}),getCollectedItemDetail:async(id:string)=>{sourceReads++;if(options.failSecond&&id==='lid')throw Error('SOURCE_READ_FAILED');return {status:'ok',raw:details[id]};},storeDataRead:async()=>({status:'ok',raw:{outcome:'response_received',httpStatus:200,response:{items:[]}}})};
 const collection=new CollectionService({client,store});const packaging=new BusinessPackagingRepository(store);
 const resolve=packaging.resolve.bind(packaging);packaging.resolve=(...args:any[])=>{packageCalls++;return (resolve as any)(...args);};
 const adapter=new HallmarkBusinessAdapter({client,store,broker:{} as any,...(options.packaging!==false?{collection,packaging}:{})});
 const engine=new BusinessOperations({store,source:adapter,transport:{execute:async()=>{writes++;return {status:'succeeded'};},inspect:async()=>{throw Error('not expected');}},reviewer:{review:async(request:any)=>{reviews++;return {status:'passed',questions:request.questions.map((q:any)=>({id:q.id,version:q.version,status:'passed',reviewer:'fixture',reasonCode:'MATCH'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}}});
 const invoke=async(operation:string,input:any)=>executeBusiness(engine,store,{request:{capabilityId:`hallmark.plan.${operation}`,input,invocationId:'fixture',traceId:'fixture'}} as any);
 const row:any={rowId:'sale',action:'listing',target:{offerId:'new-sale'},payload:{name:'cup with lid',price:'20',currency_code:'CNY',attributes:[]},procurement:[{itemId:'cup',sourceSkuId:'wrong-cup',quantity:1},{itemId:'lid',sourceSkuId:'wrong-lid',quantity:1}]};
 return {database,store,engine,adapter,collection,invoke,row,details,counts:()=>({sourceReads,writes,reviews,packageCalls})};
}

for(const [rawId,selected] of [[7,'7'],[' x ',' x ']] as const)test(`explicit legacy procurement selection preserves exact raw lookup: ${JSON.stringify(rawId)}`,async()=>{
 const f=fixture({packaging:false});try{
  (f.details.cup.skus[0] as any).sourceSkuId=rawId;
  f.row.procurement[0].sourceSkuId=selected;
  f.row.procurement[1].sourceSkuId='lid-verified-0';
  const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});
  assert.deepEqual(draft.data.rows[0].issues,[]);
  assert.equal(draft.data.rows[0].procurement[0].sourceSkuId,selected);
  const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:draft.data.revision});
  assert.equal(done.data.rows[0].status,'succeeded');assert.equal(f.counts().writes,1);
 }finally{f.database.close();}
});

test('provider gives all exact SKU paths; correction completes the original plan without any invalid dispatch',async()=>{
 const f=fixture();try{
  const original=structuredClone(f.row),created:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.equal(created.status,'ok');
  const plan=created.data,issues=plan.rows[0].issues;
  assert.deepEqual(issues.map((i:any)=>i.field),['procurement[0].sourceSkuId','procurement[1].sourceSkuId']);
  assert.deepEqual(issues.map((i:any)=>i.candidates[0].sourceSkuId),['cup-verified-0','lid-verified-0']);
  assert.deepEqual(f.row,original);assert.deepEqual(f.counts(),{sourceReads:2,writes:0,reviews:0,packageCalls:0});
  const blocked:any=await f.invoke('submit',{planId:plan.planId,expectedRevision:plan.revision});assert.equal(blocked.data.rows[0].status,'blocked');assert.equal(f.counts().writes,0);assert.equal(f.counts().reviews,0);
  const fixed=structuredClone(f.row);for(const issue of issues){const i=Number(issue.field.match(/\[(\d+)\]/)[1]);fixed.procurement[i].sourceSkuId=issue.candidates[0].sourceSkuId;}
  const revised:any=await f.invoke('revise',{planId:plan.planId,expectedRevision:plan.revision,rows:[fixed]});assert.deepEqual(revised.data.rows[0].issues,[]);
  const done:any=await f.invoke('submit',{planId:plan.planId,expectedRevision:revised.data.revision});assert.equal(done.data.status,'done');assert.equal(done.data.rows[0].status,'succeeded');assert.equal(f.counts().writes,1);assert.ok(f.counts().reviews>0);
 }finally{f.database.close();}
});

test('valid input retains normal preparation and submit behavior',async()=>{
 const f=fixture();try{f.row.procurement.forEach((s:any)=>s.sourceSkuId=`${s.itemId}-verified-0`);const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues,[]);assert.ok(f.counts().packageCalls>0);const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:1});assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);}finally{f.database.close();}
});

test('valid raw procurement never normalizes unselected SKU packages or editor image galleries',async()=>{
 const f=fixture({count:256,packaging:false});let packageReads=0,galleryReads=0;
 try{
  const gallery=Array.from({length:512},(_,i)=>({text:`unused-${i}`,imageUrl:`https://images.example/unused-${i}.jpg`}));
  for(const detail of Object.values(f.details)){
   const sourcePackage=detail.package;
   // Non-enumerable source metadata is intentionally not part of the retained evidence.
   // Its access counters expose unnecessary normalization without mocking its implementation.
   Object.defineProperty(detail,'package',{get(){packageReads++;return sourcePackage;},enumerable:false});
   const editor={};Object.defineProperty(editor,'saleProp',{get(){galleryReads++;return {color:gallery};},enumerable:false});
   (detail as any).sourceDetails={editorFields:editor};
  }
  f.row.procurement.forEach((selection:any)=>selection.sourceSkuId=`${selection.itemId}-verified-255`);
  const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues,[]);
  assert.equal(packageReads,0);assert.equal(galleryReads,0);
  const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:draft.data.revision});
  assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);
  assert.equal(packageReads,0);assert.equal(galleryReads,0);
 }finally{f.database.close();}
});

test('raw-source diagnostic candidates remain exact collection selections and submit after correction',async()=>{
 const f=fixture({count:3,packaging:false});try{
  (f.details.cup.skus[0] as any).sourceSkuId=7;f.details.cup.skus[1].sourceSkuId='7';
  const original=structuredClone(f.row),draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});
  const issues=draft.data.rows[0].issues;assert.equal(issues.length,2);
  assert.deepEqual(issues[0].candidates,[{sourceSkuId:'cup-verified-2',spec:'cup variant 2'}]);
  assert.equal(issues[0].candidatesComplete,false);assert.deepEqual(f.row,original);assert.equal(f.counts().writes,0);
  const fixed=structuredClone(f.row);
  for(const issue of issues){
   const index=Number(issue.field.match(/\[(\d+)\]/)[1]),selected=issue.candidates[0].sourceSkuId;
   const exact=await f.collection.read({id:fixed.procurement[index].itemId,skuIds:[selected]});
   const idColumn=exact.items[0].skus.columns.indexOf('id');
   assert.deepEqual(exact.items[0].skus.rows.map((row:any[])=>row[idColumn]),[selected]);
   fixed.procurement[index].sourceSkuId=selected;
  }
  const revised:any=await f.invoke('revise',{planId:draft.data.planId,expectedRevision:draft.data.revision,rows:[fixed]});
  assert.deepEqual(revised.data.rows[0].issues,[]);
  const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:revised.data.revision});
  assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);
 }finally{f.database.close();}
});

test('fatal source read has precedence and cannot expose unverified candidates',async()=>{
 const f=fixture({failSecond:true});try{const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues,[{code:'SOURCE_UNAVAILABLE',message:'SOURCE_READ_FAILED'}]);assert.equal(f.counts().packageCalls,0);assert.equal(f.counts().writes,0);}finally{f.database.close();}
});

test('duplicate source identifiers stay invalid and are not offered as replacements',async()=>{
 const f=fixture({count:2,duplicate:true,packaging:false});try{f.row.procurement[0].sourceSkuId='duplicate';const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.equal(draft.data.rows[0].issues.length,2);assert.ok(draft.data.rows[0].issues.every((i:any)=>i.candidates.length===0));const result:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:1});assert.equal(result.data.rows[0].status,'blocked');assert.equal(f.counts().writes,0);}finally{f.database.close();}
});

test('diagnostic budget is bounded and explicitly declares omitted errors, with exact candidate IDs',async()=>{
 const f=fixture({count:1000});try{f.row.procurement=Array.from({length:100},(_,i)=>({itemId:'cup',sourceSkuId:`invalid-${i}`,quantity:1}));const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});const issues=draft.data.rows[0].issues;assert.equal(issues.length,9);assert.equal(issues[8].code,'PROCUREMENT_DIAGNOSTICS_TRUNCATED');assert.match(issues[8].message,/92/);assert.ok(Buffer.byteLength(JSON.stringify(issues))<12000);for(const issue of issues.slice(0,8)){assert.ok(issue.candidates.length<=4);for(const c of issue.candidates)assert.ok(f.details.cup.skus.some((s:any)=>s.sourceSkuId===c.sourceSkuId));}assert.equal(f.counts().writes,0);assert.equal(f.counts().packageCalls,0);}finally{f.database.close();}
});


test('source identity mismatch remains fatal even with earlier correctable SKU issues',async()=>{
 const f=fixture({packaging:false});try{f.details.lid.id='different-item';const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues,[{code:'SOURCE_UNAVAILABLE',message:'SOURCE_ITEM_IDENTITY_INVALID'}]);assert.equal(f.counts().writes,0);}finally{f.database.close();}
});

test('long IDs are never truncated into false suggestions and omitted candidates are marked incomplete',async()=>{
 const f=fixture({packaging:false});try{f.details.cup.skus[0].sourceSkuId='界'.repeat(1000);const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});const issue=draft.data.rows[0].issues[0];assert.deepEqual(issue.candidates,[]);assert.equal(issue.candidatesComplete,false);assert.equal(issue.sourceReference.itemIdField,'procurement[0].itemId');assert.ok(Buffer.byteLength(JSON.stringify(issue))<1000);}finally{f.database.close();}
});

test('identical specification labels preserve distinct IDs and never select a replacement',async()=>{
 const f=fixture({count:2,packaging:false});try{f.details.cup.skus.forEach((s:any)=>s.spec='same label');const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});const issue=draft.data.rows[0].issues[0];assert.deepEqual(issue.candidates,[{sourceSkuId:'cup-verified-0',spec:'same label'},{sourceSkuId:'cup-verified-1',spec:'same label'}]);assert.equal(issue.candidatesComplete,true);assert.equal(draft.data.rows[0].procurement[0].sourceSkuId,'wrong-cup');assert.equal(f.counts().writes,0);}finally{f.database.close();}
});

for(const malformed of [{bad:'id'},null,'   ',' x ',7])test(`malformed source ID ${JSON.stringify(malformed)} is never offered; every remaining candidate completes a real source round trip`,async()=>{
 const f=fixture({count:2});try{
  (f.details.cup.skus[0] as any).sourceSkuId=malformed;
  const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});
  const issue=draft.data.rows[0].issues[0];assert.deepEqual(issue.candidates,[{sourceSkuId:'cup-verified-1',spec:'cup variant 1'}]);assert.equal(issue.candidatesComplete,false);
  const read=await f.collection.read({id:'cup'});const idColumn=read.items[0].skus.columns.indexOf('id');assert.ok(read.items[0].skus.rows.some((row:any[])=>row[idColumn]===issue.candidates[0].sourceSkuId));
  const fixed=structuredClone(f.row);fixed.procurement[0].sourceSkuId=issue.candidates[0].sourceSkuId;fixed.procurement[1].sourceSkuId='lid-verified-0';
  const revised:any=await f.invoke('revise',{planId:draft.data.planId,expectedRevision:1,rows:[fixed]});assert.deepEqual(revised.data.rows[0].issues,[]);
  const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:revised.data.revision});assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);
 }finally{f.database.close();}
});

test('trim collisions remain invalid instead of promoting either raw spelling to a candidate',async()=>{
 const f=fixture({count:2});try{f.details.cup.skus[0].sourceSkuId='x';f.details.cup.skus[1].sourceSkuId=' x ';const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues[0].candidates,[]);assert.equal(draft.data.rows[0].issues[0].candidatesComplete,false);const read=await f.collection.read({id:'cup'});const i=read.items[0].skus.columns.indexOf('id');assert.ok(read.items[0].skus.rows.every((r:any[])=>r[i]===null));assert.equal(f.counts().writes,0);}finally{f.database.close();}
});

test('string numeric and nullish fallback IDs remain exact executable source identifiers',async()=>{
 const f=fixture();try{f.details.cup.skus[0].sourceSkuId='7';Object.assign(f.details.lid.skus[0],{sourceSkuId:null,code:'fallback-id'});const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues.map((i:any)=>i.candidates[0].sourceSkuId),['7','fallback-id']);const fixed=structuredClone(f.row);fixed.procurement[0].sourceSkuId='7';fixed.procurement[1].sourceSkuId='fallback-id';const revised:any=await f.invoke('revise',{planId:draft.data.planId,expectedRevision:1,rows:[fixed]});assert.deepEqual(revised.data.rows[0].issues,[]);const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:revised.data.revision});assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);}finally{f.database.close();}
});

test('literal undefined and null strings are distinct from missing IDs and complete the source round trip',async()=>{
 const f=fixture();try{f.details.cup.skus[0].sourceSkuId='undefined';f.details.lid.skus[0].sourceSkuId='null';const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});assert.deepEqual(draft.data.rows[0].issues.map((i:any)=>i.candidates[0].sourceSkuId),['undefined','null']);assert.ok(draft.data.rows[0].issues.every((i:any)=>i.candidatesComplete));const read=await f.collection.read({ids:['cup','lid']});for(const item of read.items){const idx=item.skus.columns.indexOf('id');assert.equal(item.skus.rows[0][idx],item.id==='cup'?'undefined':'null');}const fixed=structuredClone(f.row);fixed.procurement[0].sourceSkuId='undefined';fixed.procurement[1].sourceSkuId='null';const revised:any=await f.invoke('revise',{planId:draft.data.planId,expectedRevision:1,rows:[fixed]});assert.deepEqual(revised.data.rows[0].issues,[]);const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:revised.data.revision});assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);}finally{f.database.close();}
});

for(const [malformed,colliding] of [[7,'7'],[{},'[object Object]'],[undefined,'undefined'],[null,'undefined']] as const)test(`raw lookup collision ${colliding} is not suggested despite a valid normalized string`,async()=>{
 const f=fixture({count:3});try{(f.details.cup.skus[0] as any).sourceSkuId=malformed;f.details.cup.skus[1].sourceSkuId=colliding;const draft:any=await f.invoke('create',{storeId:'bill',rows:[f.row]});const issue=draft.data.rows[0].issues[0];assert.deepEqual(issue.candidates,[{sourceSkuId:'cup-verified-2',spec:'cup variant 2'}]);assert.equal(issue.candidatesComplete,false);const fixed=structuredClone(f.row);fixed.procurement[0].sourceSkuId=issue.candidates[0].sourceSkuId;fixed.procurement[1].sourceSkuId='lid-verified-0';const revised:any=await f.invoke('revise',{planId:draft.data.planId,expectedRevision:1,rows:[fixed]});assert.deepEqual(revised.data.rows[0].issues,[]);const done:any=await f.invoke('submit',{planId:draft.data.planId,expectedRevision:revised.data.revision});assert.equal(done.data.status,'done');assert.equal(f.counts().writes,1);}finally{f.database.close();}
});
