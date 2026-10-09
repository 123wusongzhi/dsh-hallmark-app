import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {AdapterResponse,CoreClient,CoreStore,RecordData} from '../../core/src/types.ts';
import type {PlatformCallInput} from '../../hallmark-adapter/types.ts';
import {invalidateStoreSnapshots,snapshotGeneration} from './snapshot-cache.ts';

const TTL_MS=900000 as const;
const MAX_PAGES=100;
type LogisticsClient=CoreClient&{storeDataRead?:(storeId:string,input:PlatformCallInput)=>Promise<AdapterResponse>};
type ReadOptions={store:CoreStore;client:LogisticsClient;storeId:string;forceRefresh?:boolean;now?:number|(()=>number)};
export interface LogisticsPlan {
 id:string;name:string;warehouseId:string;warehouseName:string|null;
 providerId:string|null;templateId:string|null;status:string|null;active:boolean;
}
export interface LogisticsMatch {id:string;planIds:string[];status:'unique'|'choice'|'unavailable'|'unknown';reason:string}
export interface LogisticsCache {fetchedAt:string;expiresAt:string;nextRefreshAt:string;ttlMs:typeof TTL_MS;stale:boolean}
export interface LogisticsCatalog {plans:LogisticsPlan[];cache:LogisticsCache;warnings:string[];assertAuthorization:()=>void}
type Cached<T>={value?:T;fetchedAt?:number;expiresAt?:number;retryAt?:number;error?:{code:string;message:string;retryable:boolean;retryAfterMs?:number};blocked?:boolean};
type CacheResult<T>={value:T;cache:LogisticsCache;warnings:string[];assertAuthorization:()=>void};
type LogisticsError=Error&{code?:string;retryable?:boolean;retryAfterMs?:number};
type Stock={sku:string;warehouseId:string;present:number|null;available:number|null};
const inflight=new WeakMap<CoreStore,Map<string,Promise<CacheResult<unknown>>>>();
const object=(value:unknown):RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value:null;
const id=(value:unknown):string|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value))?value:null;
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;
function fail(code:string,message:string,retryable=false,retryAfterMs?:number):never {throw Object.assign(new Error(message),{code,retryable,...(retryAfterMs!==undefined?{retryAfterMs}:{})});}
const time=(options:ReadOptions):number=>typeof options.now==='function'?options.now():options.now??Date.now();
const denied=(error:LogisticsError):boolean=>/AUTH|PERMISSION|FORBIDDEN|UNAUTHORIZED|STORE_MISMATCH|CONNECTION|HTTP_40[13]/i.test(error.code??'');
const authorizationDenied=(error:LogisticsError):boolean=>/AUTH|PERMISSION|FORBIDDEN|UNAUTHORIZED|HTTP_40[13]/i.test(error.code??'');

async function read(options:ReadOptions,path:string,body:RecordData):Promise<RecordData>{
 if(!options.client.storeDataRead)fail('STORE_DATA_GATEWAY_UNAVAILABLE','当前连接尚未提供店铺数据读取接口。');
 const response=await options.client.storeDataRead(options.storeId,{path,method:'POST',body,requestId:randomUUID(),agentId:'dsh-hallmark-app'});
 const receipt=object(response.raw),http=receipt.httpStatus;
 if(receipt.storeId!==undefined&&receipt.storeId!==options.storeId)fail('OZON_STORE_MISMATCH','物流数据回执与当前店铺不一致。');
 if(http===401||http===403)fail(`OZON_HTTP_${http}`,'当前店铺授权无法读取物流数据，请检查授权。');
 if(response.error&&denied(Object.assign(new Error(response.error.message),response.error)))throw Object.assign(new Error(response.error.message),response.error,{retryable:false});
 if(receipt.outcome==='response_received'&&(http===429||http===408||http>=500))fail(http===429?'LOCAL_RATE_LIMIT':'OZON_UPSTREAM_UNAVAILABLE','物流数据暂时无法更新。',true,response.error?.retryAfterMs??(http===429?60000:5000));
 if(receipt.outcome==='response_received'&&typeof http==='number'&&(http<200||http>=300))fail('OZON_UPSTREAM_ERROR',`物流接口返回 HTTP ${http}。`);
 if(response.status!=='ok'){
  const error=response.error;
  fail(error?.code??'OZON_LOGISTICS_UNAVAILABLE',error?.message??'物流数据暂时无法读取。',error?.retryable===true,error?.retryAfterMs);
 }
 if(receipt.outcome!=='response_received'||typeof http!=='number')fail('OZON_OUTCOME_UNKNOWN','物流接口未返回完整读取回执。');
 if(http<200||http>=300)fail('OZON_UPSTREAM_ERROR',`物流接口返回 HTTP ${http}。`);
 if(!receipt.response||typeof receipt.response!=='object'||Array.isArray(receipt.response))fail('OZON_RESPONSE_INVALID','物流接口未返回有效数据。');
 return receipt.response;
}

/** Only complete successful reads enter the cache. The queries namespace is connection-revision scoped. */
async function cached<T>(options:ReadOptions,scope:unknown,fetchValue:()=>Promise<T>):Promise<CacheResult<T>>{
 if(!text(options.storeId))fail('STORE_REQUIRED','请先选择店铺。');
 const authorizationKey=`procurement-logistics:authorization:${createHash('sha256').update(options.storeId).digest('hex')}`;
 const currentGeneration=()=>canonicalJson([options.store.get<{generation:string}>('queries',authorizationKey)?.generation??'initial',snapshotGeneration(options.store,options.storeId)]);
 const generation=currentGeneration();
 const assertAuthorization=()=>{if(currentGeneration()!==generation)fail('OZON_LOGISTICS_AUTH_CHANGED','店铺物流授权状态已变化，请重新读取物流信息。');};
 // A denial on one SKU page revokes the shop's catalog and every stock page, including reads already in flight.
 const key=`procurement-logistics:v2:${createHash('sha256').update(canonicalJson({storeId:options.storeId,generation,scope})).digest('hex')}`;
 let pending=inflight.get(options.store);if(!pending){pending=new Map();inflight.set(options.store,pending);}
 const running=pending.get(key);if(running){const result=await running as CacheResult<T>;assertAuthorization();return result;}
 const work=(async():Promise<CacheResult<T>>=>{
  const saved=options.store.get<Cached<T>>('queries',key),now=time(options);
  const complete=saved&&!saved.blocked&&saved.value!==undefined&&saved.fetchedAt!==undefined&&saved.expiresAt!==undefined?saved:undefined;
  const result=(entry:Cached<T>,stale:boolean):CacheResult<T>=>({value:structuredClone(entry.value!),cache:{fetchedAt:new Date(entry.fetchedAt!).toISOString(),expiresAt:new Date(entry.expiresAt!).toISOString(),nextRefreshAt:new Date(stale?entry.retryAt??now:entry.expiresAt!).toISOString(),ttlMs:TTL_MS,stale},warnings:stale?['物流信息暂时无法更新，保留上次完整数据；稍后自动重试。']:[],assertAuthorization});
  if(saved?.retryAt&&saved.retryAt>now){
   if(complete)return result(complete,true);
   fail(saved.error?.code??'LOCAL_RATE_LIMIT',saved.error?.message??'物流数据稍后自动重试。',true,saved.retryAt-now);
  }
  if(complete&&complete.expiresAt!>now&&!complete.retryAt&&!options.forceRefresh)return result(complete,false);
  try{
   const value=await fetchValue(),fetchedAt=time(options),entry:Cached<T>={value,fetchedAt,expiresAt:fetchedAt+TTL_MS};
   assertAuthorization();
   options.store.put('queries',key,entry);return result(entry,false);
  }catch(cause){
   const error=cause as LogisticsError;
   assertAuthorization();
   if(denied(error)){
    // A later read must not resurrect data after authorization or connection failure.
    if(authorizationDenied(error)){options.store.put('queries',authorizationKey,{generation:randomUUID()});invalidateStoreSnapshots(options.store,options.storeId);}
    options.store.put('queries',key,{blocked:true} satisfies Cached<T>);throw error;
   }
   if(error.retryable===true){
    const delay=typeof error.retryAfterMs==='number'&&Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>0?error.retryAfterMs:60000;
    const failure={code:error.code??'OZON_LOGISTICS_UNAVAILABLE',message:error.message,retryable:true,retryAfterMs:delay};
    const entry:Cached<T>={...complete,retryAt:time(options)+delay,error:failure};options.store.put('queries',key,entry);
    if(complete)return result(entry,true);
   }
   throw error;
  }
 })();
 pending.set(key,work as Promise<CacheResult<unknown>>);
 try{const result=await work;assertAuthorization();return result;}finally{pending.delete(key);}
}

async function pages(options:ReadOptions,path:string,key:string,body:RecordData,limit:number):Promise<RecordData[]>{
 const rows:RecordData[]=[],seen=new Set<string>();let cursor='';
 for(let page=0;page<MAX_PAGES;page++){
  const raw=await read(options,path,{...body,limit,...(cursor?{cursor}:{})}),envelope=object(raw.result),batch=raw[key]??envelope[key]??(Array.isArray(raw.result)?raw.result:undefined);
  if(!Array.isArray(batch)||batch.some(row=>!row||typeof row!=='object'||Array.isArray(row)))fail('OZON_RESPONSE_INVALID',`物流接口缺少有效 ${key} 列表。`);
  rows.push(...batch);
  const hasNext=raw.has_next??envelope.has_next,next=text(raw.cursor??envelope.cursor);
  if(hasNext===false||hasNext!==true&&batch.length<limit)return rows;
  if(!next)fail('OZON_PAGINATION_MISSING','物流接口缺少继续分页位置，未返回不完整结果。');
  if(seen.has(next)||next===cursor||batch.length===0)fail('OZON_PAGINATION_STALLED','物流接口重复分页，未返回不完整结果。');
  seen.add(next);cursor=next;
 }
 return fail('OZON_PAGINATION_LIMIT','物流数据超过完整读取上限，请稍后重试。');
}

export async function loadLogisticsCatalog(options:ReadOptions):Promise<LogisticsCatalog>{
 const result=await cached(options,'catalog',async()=>{
  const warehouses=await pages(options,'/v2/warehouse/list','warehouses',{},100),byWarehouse=new Map<string,RecordData>(),warnings=new Set<string>();
  for(const warehouse of warehouses){const warehouseId=id(warehouse.warehouse_id);if(!warehouseId)fail('OZON_RESPONSE_INVALID','物流仓库缺少有效编号。');const previous=byWarehouse.get(warehouseId);if(previous&&canonicalJson({name:previous.name,status:previous.status})!==canonicalJson({name:warehouse.name,status:warehouse.status}))fail('OZON_LOGISTICS_IDENTITY_CONFLICT','同一仓库返回不一致资料。');byWarehouse.set(warehouseId,warehouse);}
  // Ozon may ignore warehouse_id in filter and return every method. Fetch once and use returned identities.
  const methods=await pages(options,'/v2/delivery-method/list','delivery_methods',{filter:{}},100),byMethod=new Map<string,LogisticsPlan>();
  for(const method of methods){
   const methodId=id(method.id),warehouseId=id(method.warehouse_id);if(!methodId||!warehouseId)fail('OZON_RESPONSE_INVALID','物流方案缺少有效方案或仓库编号。');
   const warehouse=byWarehouse.get(warehouseId),status=text(method.status),warehouseDisabled=/^(disabled|archived|removed)$/i.test(String(warehouse?.status??''));
   if(!warehouse)warnings.add('部分物流方案关联的仓库未在完整仓库目录中找到，暂不参与商品匹配。');
   const plan:LogisticsPlan={id:methodId,name:text(method.name)??`物流方案 ${methodId}`,warehouseId,warehouseName:text(warehouse?.name),providerId:id(method.provider_id),templateId:id(method.template_id),status,active:status==='ACTIVE'&&!!warehouse&&!warehouseDisabled};
   const previous=byMethod.get(methodId);if(previous&&canonicalJson(previous)!==canonicalJson(plan))fail('OZON_LOGISTICS_IDENTITY_CONFLICT','同一物流方案返回不一致资料。');byMethod.set(methodId,plan);
  }
  return {plans:[...byMethod.values()],warnings:[...warnings]};
 });
 result.assertAuthorization();
 return {plans:result.value.plans,cache:result.cache,warnings:[...result.value.warnings,...result.warnings],assertAuthorization:result.assertAuthorization};
}

/** Candidate means positive inventory in the method's warehouse, not verified shipping eligibility or tariff. */
export async function matchProductLogistics(options:ReadOptions&{products:{id:string;sku:string|null}[];plans:LogisticsPlan[]}):Promise<{matches:LogisticsMatch[];cache:LogisticsCache;warnings:string[]}>{
 if(options.products.length>100)fail('OZON_LOGISTICS_BATCH_LIMIT','物流匹配每批最多读取 100 个商品。');
 if(options.products.some(product=>!text(product.id))||new Set(options.products.map(product=>product.id)).size!==options.products.length)fail('OZON_LOGISTICS_IDENTITY_CONFLICT','当前页商品编号缺失或重复。');
 const skus=[...new Set(options.products.map(product=>id(product.sku)).filter((value):value is string=>!!value))].sort();
 const result=await cached(options,{stocks:skus},async():Promise<Stock[]>=>{
  if(!skus.length)return [];
  const raw=await pages(options,'/v2/product/info/stocks-by-warehouse/fbs','products',{sku:skus.map(Number)},1000),stocks=new Map<string,Stock>();
  for(const row of raw){
   const sku=id(row.sku),warehouseId=id(row.warehouse_id);
   // A response may contain extra SKUs; they do not prove a relationship for this request.
   if(!sku||!skus.includes(sku))continue;
   if(!warehouseId)fail('OZON_RESPONSE_INVALID','商品库存缺少仓库编号，无法可靠匹配物流。');
   const stock:Stock={sku,warehouseId,present:number(row.present),available:number(row.free_stock??row.available)},key=`${sku}:${warehouseId}`,previous=stocks.get(key);
   if(previous&&canonicalJson(previous)!==canonicalJson(stock))fail('OZON_LOGISTICS_IDENTITY_CONFLICT','同一商品分仓库存返回不一致数据。');stocks.set(key,stock);
  }
  return [...stocks.values()];
 });
 const matches=options.products.map((product):LogisticsMatch=>{
  const sku=id(product.sku),stocks=sku?result.value.filter(stock=>stock.sku===sku):[];
  if(!sku)return {id:product.id,planIds:[],status:'unknown',reason:'商品尚无有效平台 SKU，物流方案待确认。'};
  if(!stocks.length)return {id:product.id,planIds:[],status:'unknown',reason:'接口未返回该商品的分仓库存，物流方案待确认。'};
  // Prefer explicit available inventory. Present may only establish a warehouse association when available is unknown.
  const positive=stocks.filter(stock=>stock.available!==null?stock.available>0:stock.present!==null&&stock.present>0),warehouses=new Set(positive.map(stock=>stock.warehouseId));
  const planIds=[...new Set(options.plans.filter(plan=>plan.active&&warehouses.has(plan.warehouseId)).map(plan=>plan.id))];
  if(planIds.length)return {id:product.id,planIds,status:planIds.length===1?'unique':'choice',reason:`按商品分仓库存关联到 ${planIds.length} 个已启用方案；运价和重量限制尚需确认。`};
  if(!positive.length&&stocks.some(stock=>stock.available===null&&stock.present===null))return {id:product.id,planIds:[],status:'unknown',reason:'商品分仓库存数量未知，物流方案待确认。'};
  return {id:product.id,planIds:[],status:'unavailable',reason:positive.length?'有库存仓库尚无已启用的物流方案。':'当前未发现正库存仓库，暂无可关联的物流方案。'};
 });
 result.assertAuthorization();
 return {matches,cache:result.cache,warnings:[...result.warnings,'物流方案由店铺接口读取，并按商品分仓库存关联；接口未提供运价、重量或售价限制，候选不代表已确认运费或配送资格。']};
}
