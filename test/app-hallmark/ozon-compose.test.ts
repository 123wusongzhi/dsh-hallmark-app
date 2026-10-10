import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readOzonComposition,OZON_COMPOSE_DESCRIPTOR} from '../../packages/app-hallmark/src/ozon-compose.ts';
import {createOzonCompositionDraft,DEFAULT_PRODUCT_FIELDS,OZON_COMPOSITION_SOURCE_FIELDS,validateOzonCompositionRecipe} from '../../packages/app-hallmark/src/ozon-composition.ts';
import type {OzonCompositionRecipe,OzonCompositionSource} from '../../packages/app-hallmark/src/ozon-composition.ts';
import {compileCapability,compileSchema} from '../../packages/app-contracts/src/index.ts';
import {dataSourceDefinitionIssues,sampleValidation} from '../../packages/app-presentation/src/data-sources.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';
import type {CoreStore,CoreClient} from '../../packages/core/src/types.ts';
import type {ToolResult} from '../../packages/contracts/src/index.ts';
const range={dateFrom:'2026-09-01',dateTo:'2026-09-02'};
const recipe=(fields:string[]=DEFAULT_PRODUCT_FIELDS,grain:'product'|'posting'='product'):OzonCompositionRecipe=>({version:1,grain,fields});
const normalize=(source:OzonCompositionSource,row:any)=>({...Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS[source].map(key=>[key,null])),...row});
function fixture(respond:(source:OzonCompositionSource,input:any)=>any){
 const records=new Map<string,any>(),calls:{source:OzonCompositionSource;input:any}[]=[];
 const store={get:(collection:string,id:string)=>records.get(`${collection}:${id}`),put:(collection:string,id:string,value:any)=>{records.set(`${collection}:${id}`,structuredClone(value));return value;}} as CoreStore;
 const reader=async(source:OzonCompositionSource,input:any):Promise<ToolResult>=>{calls.push({source,input});const response=await respond(source,input);if(response?.status)return response;return {status:'ok',data:{items:(response?.items??response??[]).map((row:any)=>normalize(source,row)),warnings:[],dataTime:null,...(response?.cursor?{cursor:response.cursor}:{})}};};
 const read=(input:any)=>readOzonComposition({storeId:'bill',recipe:recipe(),...range,...input},store,{} as CoreClient,undefined,reader);
 return {read,reader,store,calls,records};
}
function data(result:any):any{assert.equal(result.status,'ok',JSON.stringify(result));assert.deepEqual(compileSchema(OZON_COMPOSE_DESCRIPTOR.outputSchema)(result.data),[]);return result.data;}
test('browser-safe recipe source has stable column keys, source currency paths and no embedded shop',()=>{
 assert.doesNotThrow(()=>compileCapability(OZON_COMPOSE_DESCRIPTOR));
 const draft=createOzonCompositionDraft('c',recipe(['products.status','orders.status','prices.price']));
 assert.equal(draft.input.storeId,undefined);assert.equal(draft.parameters.find(p=>p.name==='storeId')?.editable,false);
 assert.deepEqual(draft.fields.map(field=>field.key),['products.status','orders.status','prices.price']);assert.equal(draft.fields[2].currencyPath,'prices.currency');
 assert.deepEqual(dataSourceDefinitionIssues(draft,OZON_COMPOSE_DESCRIPTOR),[]);
 assert.throws(()=>validateOzonCompositionRecipe(recipe(['finance.amount'])),/不能/);
 assert.throws(()=>validateOzonCompositionRecipe(recipe(['products.title','products.title'])),/不同字段/);
 assert.throws(()=>validateOzonCompositionRecipe(recipe(['unknown.title'])),/不能/);
 assert.equal(createOzonCompositionDraft('c',recipe(['warehouses.warehouseName'])).parameters.find(p=>p.name==='warehouseId')?.required,true);
 assert.equal(createOzonCompositionDraft('c',recipe(['stocks.stockAvailable'])).parameters.find(p=>p.name==='warehouseId')?.required,undefined);
 assert.notEqual(createOzonCompositionDraft('c',recipe(['products.title'])).id,createOzonCompositionDraft('c',recipe(['products.title','prices.price'])).id);
 assert.equal(createOzonCompositionDraft('c',recipe(['products.title']),'explicit-source').id,'explicit-source');
 assert.deepEqual(compileSchema(OZON_COMPOSE_DESCRIPTOR.inputSchema)({storeId:'s',recipe:recipe(),dateFrom:'2026-10-01',dateTo:'2026-10-02'}),[]);
});
test('joins all upstream pages by confirmed product and SKU identities before snapshot pagination',async()=>{
 const f=fixture((source,input)=>{
  if(source==='products')return input.cursor?[{productId:'2',sku:'202',title:'Two'}]:{items:[{productId:'1',sku:'101',title:'One'}],cursor:'products-next'};
  if(source==='prices')return input.cursor?[{productId:'1',price:12,currency:'CNY'}]:{items:[{productId:'2',price:22,currency:'CNY'}],cursor:'prices-next'};
  if(source==='stocks')return [{productId:'1',sku:'101',warehouseId:'10',stockAvailable:3},{sku:'101',warehouseId:'11',stockAvailable:4},{sku:'202',warehouseId:'10',stockAvailable:0}];
  return [{sku:'101',date:'2026-09-01',orderedUnits:2},{sku:'101',date:'2026-09-02',orderedUnits:3}];
 });
 const first=data(await f.read({limit:1}));assert.equal(first.total,2);assert.equal(first.items[0].products.title,'One');assert.equal(first.items[0].prices.price,12);assert.equal(first.items[0].stocks.stockAvailable,7);assert.equal(first.items[0].analytics.orderedUnits,5);assert.ok(first.cursor);assert.equal(first.items[0]['products.title'],undefined);
 const calls=f.calls.length,second=data(await f.read({limit:1,cursor:first.cursor}));assert.equal(f.calls.length,calls);assert.equal(second.items[0].prices.price,22);assert.equal(second.items[0].stocks.stockAvailable,0);assert.equal(second.items[0].analytics.orderedUnits,null);assert.equal(second.cursor,undefined);
 for(const change of [{storeId:'helen'},{dateTo:'2026-09-03'},{warehouseId:'99'},{recipe:recipe(['products.title'])},{limit:2}])assert.equal((await f.read({limit:1,cursor:first.cursor,...change})).error?.code,'INVALID_CURSOR');
});
test('unknown quantities remain null and ambiguous identities cannot fan out joins',async()=>{
 let f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{sku:'10',warehouseId:'1',stockAvailable:3},{sku:'10',warehouseId:'2',stockAvailable:null}]);
 assert.equal(data(await f.read({recipe:recipe(['stocks.stockAvailable'])})).items[0].stocks.stockAvailable,null);
 f=fixture(source=>source==='products'?[{productId:'1',sku:'10'},{productId:'2',sku:'10'}]:[]);assert.equal((await f.read({recipe:recipe(['prices.price'])})).error?.code,'COMPOSITION_AMBIGUOUS_IDENTITY');
 f=fixture(source=>source==='products'?[{productId:'1',sku:'10'},{productId:'2',sku:'20'}]:[{productId:'2',sku:'10',warehouseId:'1',stockAvailable:7}]);assert.equal((await f.read({recipe:recipe(['stocks.stockAvailable'])})).error?.code,'COMPOSITION_IDENTITY_CONFLICT');
});
test('source failures, partial results and stalled page loops never become zero or empty success',async()=>{
 for(const failure of [{status:'failed',error:{code:'PERMISSION_DENIED',message:'No permission',retryable:false}},{status:'partial',data:{items:[]}}]){
  const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:failure);const result=await f.read({recipe:recipe(['prices.price'])});assert.equal(result.status,'failed');assert.equal(result.data,undefined);
 }
 const f=fixture(()=>({items:[{productId:'1',sku:'10'}],cursor:'same'}));assert.equal((await f.read({recipe:recipe(['products.title'])})).error?.code,'COMPOSITION_PAGINATION_STALLED');
});
test('typed legitimate empty result verifies selected nested mappings without sample values',async()=>{
 const f=fixture(()=>[]),r=data(await f.read({recipe:recipe(['products.title','prices.price'])}));assert.equal(r.total,0);assert.equal(r.sourceStates[0].status,'empty');
 const validation=sampleValidation(createOzonCompositionDraft('c',recipe(['products.title','prices.price'])),r,'i',OZON_COMPOSE_DESCRIPTOR);assert.equal(validation.status,'verified');assert.equal(validation.empty,true);
});
test('required source conditions fail before reads and optional warehouse filter is forwarded',async()=>{
 const f=fixture(()=>[]);
 for(const input of [{recipe:recipe(['analytics.views']),dateFrom:undefined},{recipe:recipe(['warehouses.warehouseName'])},{recipe:recipe(['promotions.actionPrice'])},{dateFrom:'2026-02-30'}])assert.equal((await f.read(input)).status,'failed');
 assert.equal(f.calls.length,0);data(await f.read({recipe:recipe(['stocks.stockAvailable']),warehouseId:'22'}));assert.equal(f.calls.find(call=>call.source==='stocks')?.input.warehouseId,'22');
});
test('one posting row holds full package fees without replicating them per SKU',async()=>{
 const f=fixture(source=>source==='orders'?[{postingNumber:'p1',sku:'10',quantity:2,orderPrice:12,currency:'CNY',createdAt:'2026-09-01T00:00:00Z'},{postingNumber:'p1',sku:'20',quantity:1,orderPrice:30,currency:'CNY',createdAt:'2026-09-01T00:00:00Z'}]:source==='finance'?[{accrualId:'a1',postingNumber:'p1',amount:-10,currency:'CNY'},{accrualId:'a2',postingNumber:'p1',amount:-3,currency:'CNY'}]:source==='products'?[{productId:'1',sku:'10'},{productId:'2',sku:'20'}]:[{productId:'1',price:12,currency:'CNY'}]);
 const result=data(await f.read({recipe:recipe(['orders.postingNumber','orders.quantity','orders.orderPrice','finance.amount','prices.price'],'posting')}));assert.equal(result.total,1);assert.equal(result.items[0].finance.amount,-13);assert.equal(result.items[0].orders.quantity,3);assert.equal(result.items[0].orders.orderPrice,null);assert.equal(result.items[0].prices.price,null);assert.ok(result.warnings.some((text:string)=>text.includes('多 SKU')));
});
test('mixed currencies do not sum and duplicate financial identity fails',async()=>{
 let f=fixture(source=>source==='orders'?[{postingNumber:'p',sku:'10',quantity:1}]:[{accrualId:'a',postingNumber:'p',amount:1,currency:'CNY'},{accrualId:'b',postingNumber:'p',amount:2,currency:'RUB'}]);
 const result=data(await f.read({recipe:recipe(['finance.amount'],'posting')}));assert.equal(result.items[0].finance.amount,null);assert.equal(result.items[0].finance.currency,null);assert.ok(result.warnings.some((text:string)=>text.includes('币种')));
 f=fixture(source=>source==='orders'?[{postingNumber:'p',sku:'10'}]:[{accrualId:'a',postingNumber:'p',amount:1,currency:'CNY'},{accrualId:'a',postingNumber:'p',amount:1,currency:'CNY'}]);assert.equal((await f.read({recipe:recipe(['finance.amount'],'posting')})).error?.code,'COMPOSITION_AMBIGUOUS_IDENTITY');
});
test('a package with an unknown SKU cannot masquerade as a known single-product package',async()=>{
 const f=fixture(source=>source==='orders'?[{postingNumber:'p',sku:'10',quantity:1,orderPrice:12,currency:'CNY',createdAt:'2026-09-01T00:00:00Z'},{postingNumber:'p',sku:null,quantity:1,orderPrice:9,currency:'CNY',createdAt:'2026-09-01T00:00:00Z'}]:source==='products'?[{productId:'1',sku:'10'}]:source==='prices'?[{productId:'1',price:12,currency:'CNY'}]:[{postingNumber:'p',sku:'10',actualWeight:310,shipmentAt:'2026-09-01T00:00:00Z'}]);
 const r=data(await f.read({recipe:recipe(['orders.orderPrice','prices.price','weights.actualWeight'],'posting')}));assert.equal(r.items[0].orders.orderPrice,null);assert.equal(r.items[0].prices.price,null);assert.equal(r.items[0].weights.actualWeight,null);
});
test('duplicate order-product rows reject quantity double counting and zero SKU never joins',async()=>{
 const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{postingNumber:'p',sku:'10',quantity:1},{postingNumber:'p',sku:'10',quantity:1}]);assert.equal((await f.read({recipe:recipe(['orders.quantity'])})).error?.code,'COMPOSITION_AMBIGUOUS_IDENTITY');
 const g=fixture(source=>source==='products'?[{productId:'1',sku:'0'}]:[{sku:'0',warehouseId:'1',stockAvailable:10}]);assert.equal(data(await g.read({recipe:recipe(['stocks.stockAvailable'])})).items[0].stocks.stockAvailable,null);
});
test('latest verified weight is selected per product and report pending propagates',async()=>{
 const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{sku:'10',actualWeight:300,shipmentAt:'2026-09-01T00:00:00Z'},{sku:'10',actualWeight:310,shipmentAt:'2026-09-02T00:00:00Z'}]);assert.equal(data(await f.read({recipe:recipe(['weights.actualWeight'])})).items[0].weights.actualWeight,310);
 const g=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:{status:'unavailable',error:{code:'REPORT_PENDING',message:'pending',retryable:true}});assert.equal((await g.read({recipe:recipe(['weights.actualWeight'])})).status,'unavailable');
});
test('activity price uses selected action products and activity metadata, never activity catalog as products',async()=>{
 const f=fixture((source,input)=>source==='products'?[{productId:'1',sku:'10'}]:input.actionId?[{actionId:'7',productId:'1',actionPrice:9,currency:'CNY'}]:[{actionId:'7',actionName:'Autumn',startsAt:'2026-09-01',endsAt:'2026-09-30'}]);
 const r=data(await f.read({recipe:recipe(['promotions.actionName','promotions.actionPrice']),actionId:'7'}));assert.equal(r.items[0].promotions.actionName,'Autumn');assert.equal(r.items[0].promotions.actionPrice,9);assert.equal(f.calls.filter(call=>call.source==='promotions').length,2);
});
test('composition cursor storage is isolated by connection configuration revision',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'compose-store-')),runtime=new RuntimeStore(join(directory,'runtime.sqlite'));
 try{const old=new HallmarkStorePort(runtime,'c',1),current=new HallmarkStorePort(runtime,'c',2);old.put('ozon_composition_cursors','cursor',{scope:'old'});assert.equal(current.get('ozon_composition_cursors','cursor'),undefined);assert.equal(current.list('ozon_composition_cursors').length,0);}finally{runtime.close();await rm(directory,{recursive:true,force:true});}
});
test('provider catalog exposes composition through the same executable capability contract',()=>{
 const provider=new HallmarkProvider({store:{} as any,client:{} as any,broker:{} as any});assert.equal(provider.descriptors.find(descriptor=>descriptor.capabilityId==='hallmark.ozon.compose'),OZON_COMPOSE_DESCRIPTOR);
});
test('Runtime invokes real normalized child reads and validates nested output for both shops',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),calls:any[]=[];
 const client={storeDataRead:async(storeId:string,input:any)=>{calls.push({storeId,path:input.path});let response:any;
  if(input.path==='/v3/product/list')response={result:{items:[{product_id:1}],total:1}};
  else if(input.path==='/v3/product/info/list')response={items:[{id:1,sku:101,name:storeId,offer_id:'o'}]};
  else if(input.path==='/v5/product/info/prices')response={items:[{product_id:1,price:{marketing_seller_price:storeId==='bill'?'20':'30',currency_code:'CNY'}}],total:1};
  else throw new Error(`unexpected ${input.path}`);
  return {status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response}};}} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:new HallmarkStorePort(store,'c'),client,broker:{} as any}));runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'c',config:{fixture:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 try{for(const shop of ['bill','helen']){const result=await runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',input:{storeId:shop,recipe:recipe(['products.title','prices.price']) as any},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+60000).toISOString()});const payload=data(result);assert.equal(payload.items[0].products.title,shop);assert.equal(payload.items[0].prices.price,shop==='bill'?20:30);assert.equal(result.provenance?.[0].sourceDataTime,null);}assert.equal(calls.length,6);assert.equal(store.list('operations').length,0);}finally{await runtime.dispose();store.close();}
});
test('persisted composition snapshot survives restart and cursor storage never copies all rows',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'compose-restart-')),path=join(directory,'runtime.sqlite');let database=new RuntimeStore(path),port=new HallmarkStorePort(database,'c');
 const f=fixture(()=>[{productId:'1',sku:'10',title:'A'},{productId:'2',sku:'20',title:'B'}]);
 const args={storeId:'s',recipe:recipe(['products.title']),limit:1};
 try{const first=data(await readOzonComposition(args,port,{} as CoreClient,undefined,f.reader));assert.ok(first.cursor);const cursor=port.get<any>('ozon_composition_cursors',first.cursor);assert.equal(cursor.items,undefined);assert.equal(port.list('ozon_composition_snapshots').length,1);database.close();database=new RuntimeStore(path);port=new HallmarkStorePort(database,'c');const second=data(await readOzonComposition({...args,cursor:first.cursor},port,{} as CoreClient,undefined,async()=>{throw Error('must not requery');}));assert.equal(second.items[0].products.title,'B');assert.equal(second.cursor,undefined);}finally{database.close();await rm(directory,{recursive:true,force:true});}
});
test('same-condition previews reuse completed source reads and keep the actual source fetch timestamp',async()=>{
 const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{sku:'10',orderedUnits:4}]);
 const input={recipe:recipe(['products.title','analytics.orderedUnits'])},first=data(await f.read(input)),count=f.calls.length,second=data(await f.read(input));assert.equal(f.calls.length,count);assert.ok(first.sourceStates.every((state:any)=>state.cacheHit===false));assert.ok(second.sourceStates.every((state:any)=>state.cacheHit===true));assert.deepEqual(second.sourceStates.map((state:any)=>state.fetchedAt),first.sourceStates.map((state:any)=>state.fetchedAt));assert.equal(f.calls.find(call=>call.source==='analytics')?.input.groupBy,'sku');
 await f.read({...input,storeId:'other'});assert.ok(f.calls.length>count);
});
test('rate-limited partial source resumes its saved cursor and honors retryAfter without re-reading completed pages',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let limited=true;const f=fixture((source,input)=>source==='products'?[{productId:'1',sku:'10'},{productId:'2',sku:'20'}]:!input.cursor?{items:[{sku:'10',orderedUnits:2}],cursor:'next'}:limited?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'wait',retryable:true,retryAfterMs:55000}}:[{sku:'20',orderedUnits:3}]);
 const input={recipe:recipe(['products.title','analytics.orderedUnits'])},first=data(await f.read(input));assert.deepEqual(first.items.map((row:any)=>row.analytics.orderedUnits),[null,null]);assert.equal(first.sourceStates.find((state:any)=>state.source==='analytics').status,'missing');assert.equal(first.cache.nextRefreshAt,'2026-10-09T00:00:55.000Z');const count=f.calls.length;const stillWaiting=data(await f.read(input));assert.equal(stillWaiting.cache.stale,true);assert.equal(f.calls.length,count);
 t.mock.timers.tick(55001);limited=false;
 const result=data(await f.read(input));assert.deepEqual(result.items.map((row:any)=>row.analytics.orderedUnits),[2,3]);assert.equal(f.calls.length,count+1);assert.equal(f.calls.at(-1)?.input.cursor,'next');assert.equal(result.sourceStates.find((state:any)=>state.source==='analytics').pageCount,2);
});
test('concurrent same-source composition queries coalesce the first upstream read',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const f=fixture(async()=>{await gate;return [{productId:'1',sku:'10'}];});
 const input={recipe:recipe(['products.title'])},first=f.read(input),second=f.read(input);await Promise.resolve();release();data(await first);data(await second);assert.equal(f.calls.length,1);
});
test('legacy persisted snapshot cursor expires explicitly instead of failing new output schema',async()=>{
 const f=fixture(()=>[{productId:'1',sku:'10'},{productId:'2',sku:'20'}]),input={recipe:recipe(['products.title']),limit:1},first=data(await f.read(input));
 const position=f.store.get<any>('ozon_composition_cursors',first.cursor),snapshot=f.store.get<any>('ozon_composition_snapshots',position.snapshotId);for(const state of snapshot.sourceStates){delete state.fetchedAt;delete state.cacheHit;}
 const response=await f.read({...input,cursor:first.cursor});assert.equal(response.status,'failed');assert.equal(response.error?.code,'INVALID_CURSOR');assert.match(response.error?.message??'',/旧执行版本/);
});

test('TTL expires from actual source reads and the next query obtains new values',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let title='old';const f=fixture(()=>[{productId:'1',sku:'10',title}]),input={recipe:recipe(['products.title'])};
 const first=data(await f.read(input));assert.equal(first.cache.ttlMs,900000);assert.equal(first.cache.stale,false);assert.equal(first.cache.fetchedAt,'2026-10-09T00:00:00.000Z');assert.equal(first.cache.expiresAt,'2026-10-09T00:15:00.000Z');
 title='new';t.mock.timers.tick(899999);const cached=data(await f.read(input));assert.equal(cached.items[0].products.title,'old');assert.equal(cached.sourceStates[0].cacheReason,'ttl');assert.equal(cached.cache.fetchedAt,first.cache.fetchedAt);assert.equal(f.calls.length,1);
 t.mock.timers.tick(1);const renewed=data(await f.read(input));assert.equal(renewed.items[0].products.title,'new');assert.equal(renewed.sourceStates[0].cacheReason,'none');assert.equal(renewed.cache.fetchedAt,'2026-10-09T00:15:00.000Z');assert.equal(f.calls.length,2);
});
test('full composition returns a durable full snapshot while all refreshed sources finish in the background',async()=>{
 let phase=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const f=fixture(async(source)=>{if(phase===1&&source==='prices')await gate;return source==='products'?[{productId:'1',sku:'10',title:phase===0?'old':'new'},{productId:'2',sku:'20',title:phase===0?'old2':'new2'}]:[{productId:'1',price:phase===0?1:2,currency:'CNY'}];}),input={recipe:recipe(['products.title','prices.price']),loadAll:true,limit:1};
 const first=data(await f.read(input));assert.equal(first.items.length,2);assert.equal(first.total,2);assert.equal(first.cursor,undefined);
 phase=1;const old=data(await f.read({...input,forceRefresh:true}));assert.deepEqual(old.items,first.items);assert.equal(old.cache.refreshing,true);await new Promise<void>(resolve=>setImmediate(resolve));assert.deepEqual(data(await f.read(input)).items,first.items);
 release();await new Promise<void>(resolve=>setImmediate(resolve));const updated=data(await f.read(input));assert.equal(updated.items[0].products.title,'new');assert.equal(updated.items[0].prices.price,2);assert.equal(updated.cache.refreshing,false);assert.equal(f.calls.length,4);
});

test('manual refresh bypasses valid source cache and does not change subsequent cursor identity',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let title='old';const f=fixture(()=>[{productId:'1',sku:'10',title},{productId:'2',sku:'20',title}]),input={recipe:recipe(['products.title']),limit:1};
 data(await f.read(input));title='new';t.mock.timers.tick(1000);const forced=data(await f.read({...input,forceRefresh:true}));assert.equal(forced.items[0].products.title,'new');assert.equal(f.calls.length,2);
 const next=data(await f.read({...input,cursor:forced.cursor}));assert.equal(next.items[0].products.title,'new');assert.equal(f.calls.length,2);
 assert.equal((await f.read({...input,forceRefresh:true,cursor:forced.cursor})).error?.code,'INVALID_REFRESH_CURSOR');assert.equal((await f.read({...input,forceRefresh:'yes'})).error?.code,'INVALID_REFRESH');
 const draft=createOzonCompositionDraft('c',recipe(['products.title']));assert.equal(draft.input.forceRefresh,undefined);assert.equal(draft.parameters.some(parameter=>parameter.name==='forceRefresh'),false);
});

test('manual analytics refresh respects cooldown and returns visibly stale last-good data until expiry',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let units=4;const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{sku:'10',orderedUnits:units}]),input={recipe:recipe(['products.title','analytics.orderedUnits'])};
 const first=data(await f.read(input));units=8;t.mock.timers.tick(1000);const forced=data(await f.read({...input,forceRefresh:true})),analytics=forced.sourceStates.find((state:any)=>state.source==='analytics');
 assert.equal(f.calls.filter(call=>call.source==='analytics').length,1);assert.equal(forced.items[0].analytics.orderedUnits,4);assert.equal(forced.cache.stale,true);assert.equal(forced.cache.fetchedAt,first.cache.fetchedAt);assert.equal(forced.cache.nextRefreshAt,'2026-10-09T00:01:00.000Z');assert.equal(analytics.freshness,'stale');assert.equal(analytics.cacheReason,'rate_limit');assert.equal(analytics.nextRetryAt,'2026-10-09T00:01:00.000Z');assert.ok(forced.warnings.some((warning:string)=>warning.includes('频率限制')));
 const validation=sampleValidation(createOzonCompositionDraft('c',input.recipe),forced,'stale',OZON_COMPOSE_DESCRIPTOR);assert.notEqual(validation.status,'verified');
 t.mock.timers.tick(59000);const renewed=data(await f.read(input));assert.equal(renewed.items[0].analytics.orderedUnits,8);assert.equal(renewed.cache.stale,false);assert.equal(f.calls.filter(call=>call.source==='analytics').length,2);
});

test('analytics cooldown covers changed ranges but never substitutes an unrelated prior range',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:[{sku:'10',orderedUnits:4}]),input={recipe:recipe(['analytics.orderedUnits'])};
 data(await f.read(input));const count=f.calls.length,response=data(await f.read({...input,dateTo:'2026-09-03'}));assert.equal(response.items[0].analytics.orderedUnits,null);assert.equal(response.sourceStates.find((state:any)=>state.source==='analytics').status,'missing');assert.equal(response.cache.stale,true);assert.equal(response.cache.nextRefreshAt,'2026-10-09T00:01:00.000Z');assert.equal(f.calls.length,count);
});

test('temporary failures retain only a complete last-good source, preserve times and throttle retries',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let unavailable=false;const f=fixture(()=>unavailable?{status:'unavailable',error:{code:'OZON_UPSTREAM_UNAVAILABLE',message:'HTTP 503',retryable:true}}:[{productId:'1',sku:'10',title:'kept'}]),input={recipe:recipe(['products.title'])};
 const first=data(await f.read(input));t.mock.timers.tick(900001);unavailable=true;const fallback=data(await f.read(input));assert.equal(fallback.items[0].products.title,'kept');assert.equal(fallback.cache.stale,true);assert.equal(fallback.cache.fetchedAt,first.cache.fetchedAt);assert.equal(fallback.sourceStates[0].cacheReason,'upstream_unavailable');assert.equal(fallback.cache.nextRefreshAt,'2026-10-09T00:15:05.001Z');
 const count=f.calls.length,waiting=data(await f.read({...input,forceRefresh:true}));assert.equal(f.calls.length,count);assert.equal(waiting.sourceStates[0].cacheReason,'upstream_unavailable');
 t.mock.timers.tick(5000);unavailable=false;const recovered=data(await f.read(input));assert.equal(recovered.cache.stale,false);assert.equal(f.calls.length,count+1);
 const empty=fixture(()=>({status:'unavailable',error:{code:'OZON_UPSTREAM_UNAVAILABLE',message:'HTTP 503',retryable:true}})),failed=await empty.read(input);assert.equal(failed.status,'unavailable');assert.equal(failed.data,undefined);
});

test('an incomplete refresh never replaces last-good rows and resumes at the failing page',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let phase=0;const f=fixture((_source,input)=>phase===0?[{productId:'1',sku:'10',title:'old'}]:!input.cursor?{items:[{productId:'1',sku:'10',title:'new1'}],cursor:'next'}:phase===1?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'wait',retryable:true,retryAfterMs:1000}}:[{productId:'2',sku:'20',title:'new2'}]),input={recipe:recipe(['products.title'])};
 const first=data(await f.read(input));phase=1;t.mock.timers.tick(900000);const stale=data(await f.read(input));assert.equal(stale.total,1);assert.equal(stale.items[0].products.title,'old');assert.equal(stale.cache.fetchedAt,first.cache.fetchedAt);assert.equal(stale.sourceStates[0].cacheReason,'rate_limit');
 const count=f.calls.length;phase=2;t.mock.timers.tick(1000);const result=data(await f.read(input));assert.deepEqual(result.items.map((row:any)=>row.products.title),['new1','new2']);assert.equal(f.calls.length,count+1);assert.equal(f.calls.at(-1)?.input.cursor,'next');assert.equal(result.cache.stale,false);
});

test('permanent permission failure cannot be hidden by cached data',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let denied=false;const f=fixture(()=>denied?{status:'failed',error:{code:'PERMISSION_DENIED',message:'denied',retryable:false}}:[{productId:'1',sku:'10'}]),input={recipe:recipe(['products.title'])};
 data(await f.read(input));denied=true;const response=await f.read({...input,forceRefresh:true});assert.equal(response.status,'failed');assert.equal(response.error?.code,'PERMISSION_DENIED');assert.equal(response.data,undefined);
});

test('expired page snapshot stays consistent and explicitly reports refresh due',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 const f=fixture(()=>[{productId:'1',sku:'10',title:'a'},{productId:'2',sku:'20',title:'b'}]),input={recipe:recipe(['products.title']),limit:1};
 const first=data(await f.read(input));t.mock.timers.tick(900001);const next=data(await f.read({...input,cursor:first.cursor}));assert.equal(next.items[0].products.title,'b');assert.equal(f.calls.length,1);assert.equal(next.cache.stale,true);assert.equal(next.cache.fetchedAt,first.cache.fetchedAt);assert.equal(next.sourceStates[0].cacheReason,'refresh_due');assert.ok(Date.parse(next.cache.nextRefreshAt)>Date.now());
});

test('Runtime provenance reports a real stale fallback and never re-dates the successful source read',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let unavailable=false;
 const client={storeDataRead:async(storeId:string,input:any)=>unavailable?{status:'failed',raw:{storeId,outcome:'response_received',httpStatus:503},error:{code:'PLATFORM_ERROR',message:'HTTP 503',retryable:true}}:{status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response:input.path==='/v3/product/list'?{result:{items:[{product_id:1}],total:1}}:{items:[{id:1,sku:101,name:'last good'}]}}}} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:new HallmarkStorePort(store,'c'),client,broker:{} as any}));runtime.addConnection({appId:'hallmark',connectionId:'c',displayName:'c',config:{fixture:true},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'c',enabled:true,boundAt:new Date().toISOString()});
 const invoke=(forceRefresh=false)=>runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'hallmark',connectionId:'c',capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',input:{storeId:'bill',recipe:recipe(['products.title']) as any,forceRefresh},source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+60000).toISOString()});
 try{const first=await invoke();data(first);assert.equal(first.provenance?.[0].freshness,'fresh');t.mock.timers.tick(1000);unavailable=true;const second=await invoke(true),payload=data(second);assert.equal(payload.items[0].products.title,'last good');assert.equal(payload.cache.stale,true);assert.equal(second.provenance?.[0].freshness,'stale');assert.equal(second.provenance?.[0].fetchedAt,first.provenance?.[0].fetchedAt);assert.equal(store.list('operations').length,0);}finally{await runtime.dispose();store.close();}
});

test('first-read rate limiting keeps available rows and paging visible without inventing a successful source read',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let limited=true;const f=fixture(source=>source==='analytics'?(limited?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'HTTP 429',retryable:true,retryAfterMs:233000}}:[{sku:'10',orderedUnits:8},{sku:'20',orderedUnits:9}]):source==='products'?[{productId:'1',sku:'10',title:'A'},{productId:'2',sku:'20',title:'B'}]:[{productId:'1',price:12,currency:'CNY'},{productId:'2',price:22,currency:'CNY'}]);
 const input={recipe:recipe(['analytics.orderedUnits','products.title','prices.price']),limit:1},first=data(await f.read(input)),state=first.sourceStates.find((value:any)=>value.source==='analytics');
 assert.equal(first.total,2);assert.equal(first.items[0].products.title,'A');assert.equal(first.items[0].prices.price,12);assert.equal(first.items[0].analytics.orderedUnits,null);
 assert.deepEqual(state,{source:'analytics',status:'missing',rowCount:0,pageCount:0,dataTime:null,fetchedAt:null,cacheHit:false,freshness:'stale',cacheReason:'rate_limit',nextRetryAt:'2026-10-09T00:03:53.000Z'});
 assert.equal(first.cache.stale,true);assert.equal(first.cache.fetchedAt,'2026-10-09T00:00:00.000Z');assert.equal(first.cache.nextRefreshAt,state.nextRetryAt);assert.ok(first.warnings.some((warning:string)=>warning.includes('尚无完整缓存')));
 assert.notEqual(sampleValidation(createOzonCompositionDraft('c',input.recipe),first,'missing',OZON_COMPOSE_DESCRIPTOR).status,'verified');
 const count=f.calls.length,next=data(await f.read({...input,cursor:first.cursor}));assert.equal(next.items[0].products.title,'B');assert.equal(next.items[0].analytics.orderedUnits,null);assert.equal(f.calls.length,count);
 t.mock.timers.tick(1000);data(await f.read({...input,forceRefresh:true}));assert.equal(f.calls.filter(call=>call.source==='analytics').length,1);
 t.mock.timers.tick(232000);limited=false;const recovered=data(await f.read(input));assert.equal(recovered.items[0].analytics.orderedUnits,8);assert.equal(recovered.cache.stale,false);assert.equal(recovered.sourceStates.find((value:any)=>value.source==='analytics').status,'ready');assert.equal(f.calls.filter(call=>call.source==='analytics').length,2);
});

test('429 after a complete success preserves the same-query values and timestamps until the requested retry time',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let limited=false;const f=fixture(source=>source==='products'?[{productId:'1',sku:'10',title:'Product'}]:limited?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'HTTP 429',retryable:true,retryAfterMs:233000}}:[{sku:'10',orderedUnits:6}]);
 const input={recipe:recipe(['products.title','analytics.orderedUnits'])},first=data(await f.read(input));t.mock.timers.tick(900000);limited=true;
 const fallback=data(await f.read(input)),state=fallback.sourceStates.find((value:any)=>value.source==='analytics');assert.equal(fallback.items[0].analytics.orderedUnits,6);assert.equal(fallback.cache.stale,true);assert.equal(fallback.cache.fetchedAt,first.cache.fetchedAt);assert.equal(state.fetchedAt,first.sourceStates.find((value:any)=>value.source==='analytics').fetchedAt);assert.equal(state.cacheHit,true);assert.equal(state.cacheReason,'rate_limit');assert.equal(state.nextRetryAt,'2026-10-09T00:18:53.000Z');
 const calls=f.calls.filter(call=>call.source==='analytics').length;t.mock.timers.tick(232999);data(await f.read({...input,forceRefresh:true}));assert.equal(f.calls.filter(call=>call.source==='analytics').length,calls);
 t.mock.timers.tick(1);limited=false;const recovered=data(await f.read(input));assert.equal(recovered.cache.stale,false);assert.equal(f.calls.filter(call=>call.source==='analytics').length,calls+1);
});

test('missing base rows never become a fabricated empty success when the platform is rate limited',async()=>{
 for(const grain of ['product','posting'] as const){
  const base=grain==='product'?'products':'orders',f=fixture(source=>source===base?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'HTTP 429',retryable:true,retryAfterMs:200000}}:[]);
  const response=await f.read({recipe:recipe(grain==='product'?['products.title']:['orders.postingNumber'],grain)});assert.equal(response.status,'unavailable');assert.equal(response.error?.code,'LOCAL_RATE_LIMIT');assert.equal(response.data,undefined);assert.ok(response.error!.retryAfterMs!>190000);
 }
});

test('a missing source never borrows another shop, date range, connection or configuration generation',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-09T00:00:00Z')});
 let limited=false;const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:limited?{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'HTTP 429',retryable:true,retryAfterMs:60000}}:[{sku:'10',orderedUnits:42}]),input={storeId:'bill',...range,recipe:recipe(['products.title','analytics.orderedUnits'])};
 const runtime=new RuntimeStore(':memory:'),old=new HallmarkStorePort(runtime,'c',1);
 const invoke=(args:any,port=old)=>readOzonComposition(args,port,{} as CoreClient,undefined,f.reader);
 try{
  assert.equal(data(await invoke(input)).items[0].analytics.orderedUnits,42);limited=true;
  for(const [args,port] of [[{...input,storeId:'helen'},old],[{...input,dateTo:'2026-09-03'},old],[input,new HallmarkStorePort(runtime,'other',1)],[input,new HallmarkStorePort(runtime,'c',2)]] as const){const response=data(await invoke(args,port));assert.equal(response.items[0].analytics.orderedUnits,null);assert.equal(response.sourceStates.find((state:any)=>state.source==='analytics').cacheHit,false);assert.equal(response.sourceStates.find((state:any)=>state.source==='analytics').fetchedAt,null);}
  assert.equal(data(await invoke(input)).items[0].analytics.orderedUnits,42);
 }finally{runtime.close();}
});

test('an auxiliary permission failure still refuses cached values, while a missing activity catalog leaves only its fields unknown',async()=>{
 let denied=false;const f=fixture(source=>source==='products'?[{productId:'1',sku:'10'}]:denied?{status:'failed',error:{code:'PERMISSION_DENIED',message:'denied',retryable:false}}:[{productId:'1',price:12,currency:'CNY'}]),input={recipe:recipe(['products.title','prices.price'])};
 data(await f.read(input));denied=true;const refused=await f.read({...input,forceRefresh:true});assert.equal(refused.status,'failed');assert.equal(refused.error?.code,'PERMISSION_DENIED');assert.equal(refused.data,undefined);
 const g=fixture((source,args)=>source==='products'?[{productId:'1',sku:'10'}]:args.actionId?[{actionId:'7',productId:'1',actionPrice:9,currency:'CNY'}]:{status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'wait',retryable:true,retryAfterMs:60000}});
 const result=data(await g.read({recipe:recipe(['products.title','promotions.actionName','promotions.actionPrice']),actionId:'7'}));assert.equal(result.items[0].promotions.actionPrice,9);assert.equal(result.items[0].promotions.actionName,null);assert.equal(result.sourceStates.find((state:any)=>state.source==='promotions.catalog').status,'missing');assert.equal(result.cache.stale,true);
});
