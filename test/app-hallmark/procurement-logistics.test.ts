import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadLogisticsCatalog,matchProductLogistics} from '../../packages/app-hallmark/src/procurement-logistics.ts';
import type {LogisticsPlan} from '../../packages/app-hallmark/src/procurement-logistics.ts';
import type {AdapterResponse,CoreClient,CoreStore} from '../../packages/core/src/types.ts';
import type {PlatformCallInput} from '../../packages/hallmark-adapter/types.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';

const started=Date.parse('2026-10-09T05:00:00Z');
const plan=(id:string,warehouseId:string,active=true):LogisticsPlan=>({id,name:`方案 ${id}`,warehouseId,warehouseName:`仓库 ${warehouseId}`,providerId:'100',templateId:'200',status:active?'ACTIVE':'DISABLED',active});
const warehouses={warehouses:[{warehouse_id:10,name:'小件仓',status:'created',contact:{phone:'not-for-output'}},{warehouse_id:20,name:'大件仓',status:'created'}],has_next:false,cursor:'terminal'};
const methods={delivery_methods:[{id:1,name:'2公斤 135元 方案名称',warehouse_id:10,provider_id:100,template_id:200,status:'ACTIVE'},{id:2,name:'大件',warehouse_id:20,provider_id:101,template_id:201,status:'ACTIVE'},{id:3,name:'停用',warehouse_id:10,status:'DISABLED'}],has_next:false,cursor:'terminal'};
function fixture(respond:(path:string,body:any,storeId:string)=>any=(path)=>path==='/v2/warehouse/list'?warehouses:methods){
 const records=new Map<string,any>(),calls:{storeId:string;input:PlatformCallInput}[]=[];
 const backing={get:(_collection:string,key:string)=>records.get(key),put:(_collection:string,key:string,value:any)=>{records.set(key,structuredClone(value));return value;},list:()=>[...records.values()],transaction:(fn:()=>any)=>fn()};
 const store=new HallmarkStorePort(backing as any,'connection',1);
 const client={storeDataRead:async(storeId:string,input:PlatformCallInput):Promise<AdapterResponse>=>{calls.push({storeId,input});const response=await respond(input.path,input.body,storeId);return response?.status?response:{status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response}};}} as CoreClient&{storeDataRead:(storeId:string,input:PlatformCallInput)=>Promise<AdapterResponse>};
 const options={store,client,storeId:'bill',now:started};
 return {records,backing,store,client,calls,options};
}
function failure(httpStatus:number,retryAfterMs=15000):AdapterResponse{return {status:'failed',raw:{outcome:'response_received',httpStatus},error:{code:'PLATFORM_ERROR',message:'upstream',retryable:true,retryAfterMs}};}

test('reads top-level catalog once per endpoint and preserves returned warehouse identities',async()=>{
 const f=fixture(),result=await loadLogisticsCatalog(f.options);
 assert.deepEqual(f.calls.map(call=>call.input.path),['/v2/warehouse/list','/v2/delivery-method/list']);
 assert.deepEqual(f.calls[1].input.body,{filter:{},limit:100});
 assert.deepEqual(result.plans.map(item=>[item.id,item.warehouseId,item.warehouseName,item.active]),[['1','10','小件仓',true],['2','20','大件仓',true],['3','10','小件仓',false]]);
 assert.deepEqual(Object.keys(result.plans[0]),['id','name','warehouseId','warehouseName','providerId','templateId','status','active']);
 assert.ok(!JSON.stringify(result).includes('phone'));assert.ok(!JSON.stringify([...f.records.values()]).includes('phone'));
 assert.equal((result.plans[0] as any).priceLimit,undefined);assert.equal((result.plans[0] as any).weightLimit,undefined);assert.equal((result.plans[0] as any).rate,undefined);
 assert.equal(result.cache.ttlMs,900000);assert.equal(result.cache.fetchedAt,new Date(started).toISOString());
});

test('catalog follows cursor, deduplicates repeated identical methods and excludes disabled or missing warehouses',async()=>{
 const f=fixture((path,body)=>path==='/v2/warehouse/list'?{...warehouses,warehouses:[...warehouses.warehouses,{warehouse_id:30,name:'已停仓',status:'disabled'}]}:!body.cursor?{delivery_methods:[methods.delivery_methods[0]],has_next:true,cursor:'next'}:{delivery_methods:[methods.delivery_methods[0],{id:4,name:'未知仓',warehouse_id:40,status:'ACTIVE'},{id:5,name:'已停仓',warehouse_id:30,status:'ACTIVE'}],has_next:false,cursor:'last'});
 const result=await loadLogisticsCatalog(f.options);assert.deepEqual(result.plans.map(item=>[item.id,item.active]),[['1',true],['4',false],['5',false]]);assert.equal((f.calls[2].input.body as any).cursor,'next');assert.match(result.warnings.join(),/完整仓库目录/);
});

test('missing or looping cursor and conflicting method identity never cache partial catalog',async()=>{
 for(const response of [{delivery_methods:[methods.delivery_methods[0]],has_next:true},{delivery_methods:[methods.delivery_methods[0]],has_next:true,cursor:'same'},{delivery_methods:[methods.delivery_methods[0],{...methods.delivery_methods[0],warehouse_id:20}],has_next:false}]){
  const f=fixture(path=>path==='/v2/warehouse/list'?warehouses:response);await assert.rejects(loadLogisticsCatalog(f.options),/分页|不一致/);assert.equal(f.records.size,0);
 }
});

test('fifteen-minute cache and temporary errors preserve original data time and obey cooldown even on refresh',async()=>{
 for(const http of [429,503,408]){
  let fail=false;const f=fixture(path=>fail?failure(http):path==='/v2/warehouse/list'?warehouses:methods);
  const initial=await loadLogisticsCatalog(f.options);await loadLogisticsCatalog({...f.options,now:started+899999});assert.equal(f.calls.length,2);
  fail=true;const stale=await loadLogisticsCatalog({...f.options,now:started+900000});assert.equal(stale.cache.stale,true);assert.equal(stale.cache.fetchedAt,initial.cache.fetchedAt);assert.equal(stale.cache.expiresAt,initial.cache.expiresAt);assert.equal(stale.cache.nextRefreshAt,new Date(started+915000).toISOString());
  const count=f.calls.length;await loadLogisticsCatalog({...f.options,now:started+900001,forceRefresh:true});assert.equal(f.calls.length,count);
  fail=false;const recovered=await loadLogisticsCatalog({...f.options,now:started+915000});assert.equal(recovered.cache.stale,false);assert.equal(recovered.cache.fetchedAt,new Date(started+915000).toISOString());
 }
});

test('first rate limit stores no partial data and throttles repeated calls',async()=>{
 const f=fixture(path=>path==='/v2/warehouse/list'?warehouses:failure(429));
 await assert.rejects(loadLogisticsCatalog(f.options),{code:'LOCAL_RATE_LIMIT',retryable:true,retryAfterMs:15000});
 const count=f.calls.length;await assert.rejects(loadLogisticsCatalog({...f.options,now:started+1000,forceRefresh:true}),{code:'LOCAL_RATE_LIMIT',retryAfterMs:14000});assert.equal(f.calls.length,count);
 assert.ok([...f.records.values()].every(row=>row.value.value===undefined));
});

test('manual refresh retried after cooldown even when old cache has not reached its fifteen-minute expiry',async()=>{
 let limited=false;const f=fixture(path=>limited?failure(429):path==='/v2/warehouse/list'?warehouses:methods);await loadLogisticsCatalog(f.options);
 limited=true;await loadLogisticsCatalog({...f.options,forceRefresh:true,now:started+1000});const count=f.calls.length;
 limited=false;const result=await loadLogisticsCatalog({...f.options,now:started+16000});assert.equal(f.calls.length,count+2);assert.equal(result.cache.fetchedAt,new Date(started+16000).toISOString());
});

test('non-transient HTTP errors do not fall back even when adapter marks a generic error retryable',async()=>{
 for(const status of [400,404,422]){
  let bad=false;const f=fixture(path=>bad?failure(status):path==='/v2/warehouse/list'?warehouses:methods);await loadLogisticsCatalog(f.options);bad=true;
  await assert.rejects(loadLogisticsCatalog({...f.options,forceRefresh:true}),{code:'OZON_UPSTREAM_ERROR',retryable:false});
 }
});

test('HTTP permissions and permission error codes reject fallback and erase reusable old cache',async()=>{
 for(const response of [failure(401),failure(403),{status:'unavailable',error:{code:'PERMISSION_DENIED',message:'no access',retryable:true}}]){
  let denied=false;const f=fixture(path=>denied?response:path==='/v2/warehouse/list'?warehouses:methods);await loadLogisticsCatalog(f.options);denied=true;
  await assert.rejects(loadLogisticsCatalog({...f.options,now:started+1,forceRefresh:true}));const count=f.calls.length;
  await assert.rejects(loadLogisticsCatalog({...f.options,now:started+2}));assert.equal(f.calls.length,count+1);
  assert.ok([...f.records.values()].every(row=>row.value.value===undefined));
 }
});

test('cache scopes shop, connection and connection revision',async()=>{
 const f=fixture();await loadLogisticsCatalog(f.options);
 await loadLogisticsCatalog({...f.options,storeId:'helen'});assert.equal(f.calls.length,4);
 await loadLogisticsCatalog({...f.options,store:new HallmarkStorePort(f.backing as any,'connection',2)});assert.equal(f.calls.length,6);
 await loadLogisticsCatalog({...f.options,store:new HallmarkStorePort(f.backing as any,'other',1)});assert.equal(f.calls.length,8);
});

test('receipt store mismatch does not return cache',async()=>{
 let wrong=false;const f=fixture(path=>wrong?{status:'ok',raw:{storeId:'helen',outcome:'response_received',httpStatus:200,response:warehouses}}:path==='/v2/warehouse/list'?warehouses:methods);
 await loadLogisticsCatalog(f.options);wrong=true;await assert.rejects(loadLogisticsCatalog({...f.options,forceRefresh:true}),{code:'OZON_STORE_MISMATCH'});
});

test('matching uses exact SKU and positive warehouse stock, excludes disabled methods, and never infers tariff',async()=>{
 const f=fixture(()=>({products:[{sku:101,warehouse_id:10,present:5,free_stock:3},{sku:101,warehouse_id:20,present:6,free_stock:0},{sku:102,warehouse_id:20,present:1},{sku:999,warehouse_id:10,free_stock:100}],has_next:false}));
 const result=await matchProductLogistics({...f.options,products:[{id:'a',sku:'101'},{id:'b',sku:'102'}],plans:[plan('1','10'),plan('2','20'),plan('3','10',false)]});
 assert.deepEqual(f.calls[0].input.body,{sku:[101,102],limit:1000});assert.deepEqual(result.matches.map(item=>[item.id,item.planIds,item.status]),[['a',['1'],'unique'],['b',['2'],'unique']]);
 assert.ok(result.matches.every(item=>item.reason.includes('尚需确认')));assert.match(result.warnings.join(),/候选不代表已确认运费/);
});

test('multiple candidates require choice; missing SKU, absent and unknown quantities stay unknown',async()=>{
 const f=fixture(()=>({products:[{sku:101,warehouse_id:10,available:3},{sku:101,warehouse_id:20,available:2},{sku:102,warehouse_id:10},{sku:103,warehouse_id:10,present:0},{sku:104,warehouse_id:90,present:5}],has_next:false}));
 const result=await matchProductLogistics({...f.options,products:[{id:'many',sku:'101'},{id:'unknown',sku:'102'},{id:'zero',sku:'103'},{id:'no-plan',sku:'104'},{id:'absent',sku:'105'},{id:'no-sku',sku:null},{id:'unsafe',sku:'9007199254740993'}],plans:[plan('1','10'),plan('2','20')]});
 assert.deepEqual(result.matches.map(item=>[item.id,item.status,item.planIds]),[['many','choice',['1','2']],['unknown','unknown',[]],['zero','unavailable',[]],['no-plan','unavailable',[]],['absent','unknown',[]],['no-sku','unknown',[]],['unsafe','unknown',[]]]);
});

test('stock cursor pages must complete before matching and requests contain only current-page SKUs',async()=>{
 const f=fixture((_path,body)=>!body.cursor?{products:[{sku:101,warehouse_id:10,present:1}],has_next:true,cursor:'second'}:{products:[{sku:101,warehouse_id:20,present:1}],has_next:false,cursor:'last'});
 const result=await matchProductLogistics({...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10'),plan('2','20')]});
 assert.equal(result.matches[0].status,'choice');assert.deepEqual(f.calls[1].input.body,{sku:[101],limit:1000,cursor:'second'});
 const g=fixture((_path,body)=>!body.cursor?{products:[{sku:101,warehouse_id:10,present:1}],has_next:true,cursor:'second'}:failure(429));
 await assert.rejects(matchProductLogistics({...g.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]}),{code:'LOCAL_RATE_LIMIT'});
 assert.ok([...g.records.values()].every(row=>row.value.value===undefined));
});

test('stock cache remains page-specific, retains old timestamp on rate limit and rematches current catalog',async()=>{
 let rateLimited=false;const f=fixture(()=>rateLimited?failure(429):{products:[{sku:101,warehouse_id:10,present:1}],has_next:false});
 const options={...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]};const first=await matchProductLogistics(options);rateLimited=true;
 const old=await matchProductLogistics({...options,now:started+900000,plans:[plan('1','10',false)]});assert.equal(old.cache.stale,true);assert.equal(old.cache.fetchedAt,first.cache.fetchedAt);assert.equal(old.matches[0].status,'unavailable');
 await assert.rejects(matchProductLogistics({...options,now:started+900001,products:[{id:'b',sku:'102'}]}),{code:'LOCAL_RATE_LIMIT'});
});

test('invalid page, conflicting stock identity and malformed stock responses fail explicitly',async()=>{
 const f=fixture(()=>({products:[],has_next:false}));
 await assert.rejects(matchProductLogistics({...f.options,products:Array.from({length:101},(_,i)=>({id:String(i),sku:String(i+1)})),plans:[]}),{code:'OZON_LOGISTICS_BATCH_LIMIT'});
 await assert.rejects(matchProductLogistics({...f.options,products:[{id:'a',sku:'1'},{id:'a',sku:'2'}],plans:[]}),{code:'OZON_LOGISTICS_IDENTITY_CONFLICT'});assert.equal(f.calls.length,0);
 for(const response of [{wrong:[]},{products:[{sku:1,present:2}],has_next:false},{products:[{sku:1,warehouse_id:1,present:2},{sku:1,warehouse_id:1,present:3}],has_next:false}]){
  const g=fixture(()=>response);await assert.rejects(matchProductLogistics({...g.options,products:[{id:'a',sku:'1'}],plans:[]}));assert.equal(g.records.size,0);
 }
});

test('empty SKU page avoids upstream requests and concurrent equal catalog reads share work',async()=>{
 const f=fixture(),empty=await matchProductLogistics({...f.options,products:[{id:'a',sku:null}],plans:[]});assert.equal(empty.matches[0].status,'unknown');assert.equal(f.calls.length,0);
 await Promise.all([loadLogisticsCatalog(f.options),loadLogisticsCatalog(f.options)]);assert.equal(f.calls.length,2);
});

test('one stock-page authorization denial revokes every cached page and catalog for only that shop',async()=>{
 for(const rejection of [failure(401),failure(403),{status:'unavailable',error:{code:'PERMISSION_DENIED',message:'not permitted',retryable:true}}]){
  let denyBill=false;
  const f=fixture((path,body,storeId)=>denyBill&&storeId==='bill'?rejection:path==='/v2/warehouse/list'?warehouses:path==='/v2/delivery-method/list'?methods:{products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false});
  const a={...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]},b={...a,products:[{id:'b',sku:'102'}]},helen={...b,storeId:'helen'};
  await loadLogisticsCatalog(f.options);await loadLogisticsCatalog({...f.options,storeId:'helen'});
  await matchProductLogistics(a);await matchProductLogistics(b);await matchProductLogistics(helen);
  denyBill=true;await assert.rejects(matchProductLogistics({...a,forceRefresh:true}));
  let count=f.calls.length;await assert.rejects(matchProductLogistics(b));assert.equal(f.calls.length,count+1);
  count=f.calls.length;await assert.rejects(loadLogisticsCatalog(f.options));assert.equal(f.calls.length,count+1);
  count=f.calls.length;assert.equal((await matchProductLogistics(helen)).matches[0].status,'unique');await loadLogisticsCatalog({...f.options,storeId:'helen'});assert.equal(f.calls.length,count);
  denyBill=false;const recovered=await matchProductLogistics({...b,now:started+100});assert.equal(recovered.matches[0].status,'unique');assert.equal(recovered.cache.fetchedAt,new Date(started+100).toISOString());assert.equal(f.calls.length,count+1);
 }
});

test('catalog permission denial also prevents reuse of cached stock pages',async()=>{
 let denied=false;const f=fixture((path,body)=>denied?failure(403):path==='/v2/warehouse/list'?warehouses:path==='/v2/delivery-method/list'?methods:{products:body.sku.map((sku:number)=>({sku,warehouse_id:10,present:1})),has_next:false});
 const match={...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]};
 await loadLogisticsCatalog(f.options);await matchProductLogistics(match);denied=true;
 await assert.rejects(loadLogisticsCatalog({...f.options,forceRefresh:true}),{code:'OZON_HTTP_403'});
 const count=f.calls.length;await assert.rejects(matchProductLogistics(match),{code:'OZON_HTTP_403'});assert.equal(f.calls.length,count+1);
});

test('temporary stock failure preserves sibling page and catalog caches',async()=>{
 for(const status of [429,503]){
  let limited=false;const f=fixture((path,body)=>limited?failure(status):path==='/v2/warehouse/list'?warehouses:path==='/v2/delivery-method/list'?methods:{products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false});
  const a={...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]},b={...a,products:[{id:'b',sku:'102'}]};
  await loadLogisticsCatalog(f.options);await matchProductLogistics(a);await matchProductLogistics(b);limited=true;
  assert.equal((await matchProductLogistics({...a,forceRefresh:true})).cache.stale,true);const count=f.calls.length;
  assert.equal((await matchProductLogistics(b)).matches[0].status,'unique');assert.equal((await loadLogisticsCatalog(f.options)).cache.stale,false);assert.equal(f.calls.length,count);
 }
});

test('a captured catalog authorization guard stays revoked even after a later generation recovers',async()=>{
 let denied=false;const f=fixture((path,body)=>denied?failure(403):path==='/v2/warehouse/list'?warehouses:path==='/v2/delivery-method/list'?methods:{products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false});
 const catalog=await loadLogisticsCatalog(f.options);catalog.assertAuthorization();
 const match={...f.options,products:[{id:'a',sku:'101'}],plans:catalog.plans};await matchProductLogistics(match);denied=true;
 await assert.rejects(matchProductLogistics({...match,forceRefresh:true}),{code:'OZON_HTTP_403'});assert.throws(catalog.assertAuthorization,{code:'OZON_LOGISTICS_AUTH_CHANGED'});
 denied=false;const recovered=await loadLogisticsCatalog(f.options);recovered.assertAuthorization();assert.throws(catalog.assertAuthorization,{code:'OZON_LOGISTICS_AUTH_CHANGED'});
 assert.equal((await matchProductLogistics({...match,plans:recovered.plans})).matches[0].status,'unique');assert.throws(catalog.assertAuthorization,{code:'OZON_LOGISTICS_AUTH_CHANGED'});
});
test('in-flight catalog response cannot return or repopulate a generation revoked by stock permission denial',async()=>{
 let hold=false,denyStocks=false,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),waiting=new Promise<void>(resolve=>{entered=resolve;});
 const f=fixture(async(path,body)=>{
  if(path==='/v2/warehouse/list')return warehouses;
  if(path==='/v2/delivery-method/list'){if(hold){entered();await gate;}return methods;}
  return denyStocks?failure(403):{products:body.sku.map((sku:number)=>({sku,warehouse_id:10,free_stock:1})),has_next:false};
 });
 const match={...f.options,products:[{id:'a',sku:'101'}],plans:[plan('1','10')]};
 await loadLogisticsCatalog(f.options);await matchProductLogistics(match);hold=true;
 const pending=loadLogisticsCatalog({...f.options,forceRefresh:true});await waiting;
 denyStocks=true;await assert.rejects(matchProductLogistics({...match,forceRefresh:true}),{code:'OZON_HTTP_403'});
 const rejected=assert.rejects(pending,{code:'OZON_LOGISTICS_AUTH_CHANGED'});release();await rejected;
 hold=false;const count=f.calls.length;await loadLogisticsCatalog({...f.options,now:started+100});assert.equal(f.calls.length,count+2);
});
