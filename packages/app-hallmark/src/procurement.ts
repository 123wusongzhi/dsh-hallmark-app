import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonSchema} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {AdapterResponse,CoreClient,CoreStore,RecordData} from '../../core/src/types.ts';
import {sourceTime} from '../../core/src/types.ts';
import {loadLogisticsCatalog,matchProductLogistics,type LogisticsMatch} from './procurement-logistics.ts';
import {readCompleteSnapshot,SNAPSHOT_CACHE_SCHEMA,snapshotAccessFailure,invalidateStoreSnapshots,snapshotGeneration} from './snapshot-cache.ts';
import {applicationProfit,type PricingReader} from './dynamic-profit.ts';
import {quotePricing} from '../../business-pricing/src/index.ts';

export const PROCUREMENT_CACHE_TTL_MS=900000;
export const PROCUREMENT_METRIC_BASIS='参考利润率＝（实际卖家价－采购价－物流费－佣金－固定费）÷实际卖家价；物流费和佣金按所选费用方案逐项向上取分，非平台结算净利润。';
const text:JsonSchema={type:'string'},nullableText:JsonSchema={type:['string','null']},nullableNumber:JsonSchema={type:['number','null']};
const profitSchema:JsonSchema={type:'object',properties:{...Object.fromEntries(['margin','profitMinor','logisticsMinor','commissionMinor','fixedMinor'].map(key=>[key,nullableNumber]).concat([['reason',nullableText],['metricBasis',text]])),configRevision:nullableNumber,planId:nullableText,selectionReason:nullableText},required:['margin','profitMinor','logisticsMinor','commissionMinor','fixedMinor','reason','metricBasis'],additionalProperties:false};
const logisticsMatchSchema:JsonSchema={type:'object',properties:{status:{enum:['unique','choice','unavailable','unknown']},candidatePlanIds:{type:'array',items:text},selectedPlanId:text,label:text,reason:nullableText},required:['status','candidatePlanIds','label','reason'],additionalProperties:false};
const rowSchema:JsonSchema={type:'object',properties:{productId:nullableText,offerId:nullableText,sku:nullableText,title:nullableText,imageUrl:nullableText,currency:nullableText,productUrl:nullableText,salesSpecification:nullableText,purchaseSpecification:nullableText,purchaseLinks:{type:'array',items:{type:'object',properties:{url:text,label:text},required:['url','label'],additionalProperties:false}},purchaseMinor:nullableNumber,sellerMinor:nullableNumber,packageGrams:nullableNumber,referenceProfit:profitSchema,logisticsMatch:logisticsMatchSchema},required:['productId','offerId','sku','title','imageUrl','currency','productUrl','salesSpecification','purchaseSpecification','purchaseLinks','purchaseMinor','sellerMinor','packageGrams','referenceProfit','logisticsMatch'],additionalProperties:false};
const planSchema:JsonSchema={type:'object',properties:{mode:{enum:['application','delivery','platform','custom']},label:text,settingsRevision:{type:['integer','null']},fixedFeeYuan:nullableNumber,logisticsYuanPerKg:nullableNumber,commissionPercent:nullableNumber,reason:nullableText,deliveryMethodId:nullableText,choices:{type:'array',items:{type:'object',properties:{id:text,name:text,warehouseId:text,warehouseName:nullableText,active:{type:'boolean'}},required:['id','name','warehouseId','warehouseName','active'],additionalProperties:false}},selectionNote:text},required:['mode','label','settingsRevision','fixedFeeYuan','logisticsYuanPerKg','commissionPercent','reason','deliveryMethodId','choices','selectionNote'],additionalProperties:false};
const cacheSchema=SNAPSHOT_CACHE_SCHEMA;
export const PROCUREMENT_DESCRIPTOR:CapabilityDescriptor={
 capabilityId:'hallmark.products.procurement',version:'1.0.0',title:'商品-采购对照表',description:'同一店铺在售商品与精确采购来源对照。支持全量快照读取或搜索后分页，默认使用应用独立维护的经营规则，按实际卖家价与重量自动匹配物流费用并计算利润；重叠取总费用较高方案，缺失不按零计算。',effect:'query',aliases:[],
 inputSchema:{type:'object',properties:{storeId:{type:'string',minLength:1},query:text,cursor:{type:'string',minLength:1},limit:{type:'integer',minimum:1,maximum:100},loadAll:{type:'boolean'},planMode:{enum:['application','delivery','platform','custom']},deliveryMethodId:{type:'string',minLength:1},fixedFeeYuan:{type:'number',minimum:0,maximum:1000000},logisticsYuanPerKg:{type:'number',minimum:0,maximum:100000},commissionPercent:{type:'number',minimum:0,maximum:99.9999},forceRefresh:{type:'boolean'}},required:['storeId'],additionalProperties:false},
 outputSchema:{type:'object',properties:{products:{type:'array',items:rowSchema},total:{type:'integer',minimum:0},cursor:text,dataTime:nullableText,warnings:{type:'array',items:text},plan:planSchema,cache:cacheSchema},required:['products','total','dataTime','warnings','plan','cache'],additionalProperties:false},
 execution:{mode:'sync',timeoutMs:60000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:['商品','采购','对照','利润','在售','素材库']},
};

type Fees={fixedMinor:number;logisticsMicrosPerGram:number;commissionPpm:number};
type Plan={mode:'application'|'delivery'|'platform'|'custom';label:string;settingsRevision:number|null;fixedFeeYuan:number|null;logisticsYuanPerKg:number|null;commissionPercent:number|null;reason:string|null;deliveryMethodId:string|null;choices:RecordData[];selectionNote:string};
type ReadCache={payload:RecordData;fetchedAt:string;expiresAt:string;nextRetryAt?:string;failure?:{code:string;message:string;retryable:boolean;retryAfterMs?:number}};
type ReadResult={entry:ReadCache;stale:boolean};
type Snapshot={scope:string;products:RecordData[];plan:Plan;dataTime:string|null;cache:{ttlMs:number;fetchedAt:string;expiresAt:string;nextRefreshAt:string;stale:boolean};warnings:string[];expiresAt:number};
const object=(value:unknown):RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
const string=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):null;
const minor=(value:unknown,positive=false):number|null=>Number.isSafeInteger(value)&&(value as number)>=(positive?1:0)?value as number:null;
function fail(code:string,message:string,retryable=false,retryAfterMs?:number):never{throw Object.assign(new Error(message),{code,retryable,...(retryAfterMs!==undefined?{retryAfterMs}:{})});}
function safeUrl(value:unknown):string|null{if(typeof value!=='string')return null;try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function transient(response:AdapterResponse):boolean {const code=response.error?.code??'';return response.error?.retryable===true&&!/(AUTH|PERMISSION|FORBIDDEN|IDENTITY|CONNECTION|BINDING|NOT_FOUND|HTTP_(401|403|404))/.test(code);}
const flights=new WeakMap<CoreStore,Map<string,Promise<ReadResult>>>();
/** settings is a revision-scoped provider namespace; cache data never crosses a connection generation. */
async function cachedRead(store:CoreStore,key:string,read:()=>Promise<AdapterResponse>,validate:(raw:unknown)=>RecordData,force:boolean,signal?:AbortSignal):Promise<ReadResult>{
 const previous=store.get<ReadCache>('settings',key),now=Date.now();
 if(signal?.aborted)fail('ABORTED','读取已取消。');
 if(previous?.payload&&previous.nextRetryAt&&Date.parse(previous.nextRetryAt)>now)return {entry:previous,stale:true};
 if(previous?.payload&&!force&&!previous.nextRetryAt&&Date.parse(previous.expiresAt)>now)return {entry:previous,stale:false};
 const blocked=store.get<RecordData>('settings',`${key}:cooldown`);
 if(blocked&&blocked.until>now)fail(blocked.error.code,blocked.error.message,blocked.error.retryable,blocked.until-now);
 let pending=flights.get(store);if(!pending){pending=new Map();flights.set(store,pending);}const active=pending.get(key);if(active)return active;
 const promise=(async()=>{
  let response:AdapterResponse;try{response=await read();}catch(cause){const e=object(cause),code=typeof e.code==='string'?e.code:typeof e.httpStatus==='number'?`HALLMARK_HTTP_${e.httpStatus}`:'HALLMARK_UNAVAILABLE',denied=/(AUTH|PERMISSION|FORBIDDEN|IDENTITY|CONNECTION|BINDING|NOT_FOUND|HTTP_(401|403|404))/.test(code),retryable=!denied&&(e.retryable===true||code==='HALLMARK_UNAVAILABLE');response={status:retryable?'unavailable':'failed',error:{code,message:typeof e.message==='string'?e.message:'数据暂时无法更新。',retryable,...(typeof e.retryAfterMs==='number'?{retryAfterMs:e.retryAfterMs}:{})}};}
  if(response.status!=='ok'){
   const error=response.error??{code:'PROCUREMENT_READ_FAILED',message:'数据读取失败。',retryable:false};
   if(transient(response)){
    const delay=typeof error.retryAfterMs==='number'&&Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>0?error.retryAfterMs:60000,until=Date.now()+delay;
    store.put('settings',`${key}:cooldown`,{until,error});
    if(previous?.payload){const entry={...previous,nextRetryAt:new Date(until).toISOString(),failure:error};store.put('settings',key,entry);return {entry,stale:true};}
    fail(error.code,error.message,true,delay);
   }
   // Permission/identity changes must revoke previously readable values, including old paging snapshots.
   store.put('settings',key,{blocked:true});store.put('settings',`${key}:generation`,{id:randomUUID()});
   fail(error.code,error.message,false);
  }
  let payload:RecordData;try{payload=validate(response.raw);}catch(error){store.put('settings',key,{blocked:true});store.put('settings',`${key}:generation`,{id:randomUUID()});throw error;}
  const fetchedAt=sourceTime(response.provenance?.fetchedAt)??new Date().toISOString(),entry:ReadCache={payload,fetchedAt,expiresAt:new Date(Date.now()+PROCUREMENT_CACHE_TTL_MS).toISOString()};
  store.put('settings',key,entry);store.put('settings',`${key}:cooldown`,{until:0});return {entry,stale:false};
 })();pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
}
function scaled(value:unknown,scale:number,max:number,label:string):number {if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)fail('INVALID_PLAN',`${label}须明确填写且在允许范围内。`);const units=Math.round(value*scale);if(Math.abs(units-value*scale)>1e-6||!Number.isSafeInteger(units))fail('INVALID_PLAN',`${label}的小数位数超出允许范围。`);return units;}
function customFees(args:RecordData):Fees{return {fixedMinor:scaled(args.fixedFeeYuan,100,1000000,'固定费用'),logisticsMicrosPerGram:scaled(args.logisticsYuanPerKg,1000,100000,'每公斤运费'),commissionPpm:scaled(args.commissionPercent,10000,99.9999,'佣金比例')};}
function validSettings(raw:unknown):RecordData {const value=object(raw);if(value.version!==1||minor(value.revision)===null||minor(value.fixedMinor)===null||value.fixedMinor>100000000||minor(value.logisticsMicrosPerGram)===null||value.logisticsMicrosPerGram>100000000||minor(value.commissionPpm)===null||value.commissionPpm>=1000000)fail('PRICING_SETTINGS_INVALID','平台费用参数无效，暂时无法计算利润。');return {version:1,revision:value.revision,fixedMinor:value.fixedMinor,logisticsMicrosPerGram:value.logisticsMicrosPerGram,commissionPpm:value.commissionPpm,updatedAt:sourceTime(value.updatedAt)};}
function plan(mode:Plan['mode'],fees:Fees|null,revision:number|null=null,reason:string|null=null,deliveryMethodId:string|null=null):Plan{return {mode,label:mode==='application'?'应用动态利润规则':mode==='delivery'?'接口渠道辅助试算':mode==='custom'?'自定义试算':'旧平台统一费率试算',settingsRevision:revision,fixedFeeYuan:fees?fees.fixedMinor/100:null,logisticsYuanPerKg:fees?fees.logisticsMicrosPerGram/1000:null,commissionPercent:fees?fees.commissionPpm/10000:null,reason,deliveryMethodId,choices:[],selectionNote:mode==='application'?'按实际卖家售价和重量逐商品匹配应用规则；条件重叠时取固定费、运费和佣金合计最高方案。':mode==='delivery'?'按商品库存仓关联匹配渠道，费用需补充；此高级试算不改变应用利润规则。':'仅供高级参考试算，不改变应用维护的当前利润规则。'};}

/** Explicit advanced simulations share the application calculator, without changing active store rules. */
export function procurementProfit(sellerMinor:number|null,purchaseMinor:number|null,packageGrams:number|null,fees:Fees|null,currency:string|null,planReason?:string|null):RecordData {
 const result:RecordData={margin:null,profitMinor:null,logisticsMinor:null,commissionMinor:null,fixedMinor:null,reason:null,metricBasis:PROCUREMENT_METRIC_BASIS};
 result.reason=currency!=='CNY'?'仅在明确人民币币种时计算参考利润。':sellerMinor===null?'实际卖家价尚未核实。':purchaseMinor===null?'缺少精确来源的人民币采购价。':packageGrams===null?'缺少有效的计费重量。':!fees?planReason??'物流费用方案尚未就绪。':null;
 if(result.reason)return result;
 const quote=quotePricing({schemaVersion:1,storeId:'simulation',revision:1,updatedAt:new Date().toISOString(),currency:'CNY',defaultPlanId:'simulation',plans:[{id:'simulation',name:'高级试算',enabled:true,fixedMinor:fees!.fixedMinor,logisticsMicrosPerGram:fees!.logisticsMicrosPerGram,commissionPpm:fees!.commissionPpm}],listingTargetMarginPpm:0,manualTargetMarginPpm:0,minimumMarginPpm:null,maxAutoPriceMinor:null,minPriceMinor:null,maxPriceMinor:null},{storeId:'simulation',action:'price',purchaseMinor,weightGrams:packageGrams,priceMinor:sellerMinor,pricingMode:'manual'}),b=quote.breakdown;
 if(b.profitMinor===null)return {...result,reason:quote.issues.map(issue=>issue.message).join('；')||'金额超出安全计算范围。'};
 return {...result,margin:b.profitMinor/sellerMinor!,profitMinor:b.profitMinor,logisticsMinor:b.logisticsMinor,commissionMinor:b.commissionMinor,fixedMinor:b.fixedMinor};
}
function normalize(row:RecordData,fees:Fees|null,selectedPlan:Plan,storeId:string,pricing?:PricingReader):RecordData {
 if(selectedPlan.mode==='application')row=applicationProfit(row,storeId,pricing);
 const matched=(Array.isArray(row.sources)?row.sources:[]).filter((source:unknown)=>object(source).sourceSkuMatched===true).map(object),specs=(key:string)=>[...new Set(matched.map(source=>string(source[key])).filter((value):value is string=>!!value))],purchaseSpecs=specs('sourceSpec'),salesSpecs=specs('salesSpec'),profit=object(row.profit),currency=string(object(row.pricing).currency??row.currency),sku=string(row.sku),sellerMinor=currency==='CNY'?minor(profit.actualMinor,true):null,purchaseMinor=minor(profit.purchaseMinor),packageGrams=minor(profit.packageGrams,true);
 const links=new Map<string,{url:string;label:string}>();for(const source of matched){const url=safeUrl(source.sourceUrl);if(url){const label=string(source.sourceSpec)??string(source.skuCode)??'采购来源';links.set(`${url}\n${label}`,{url,label});}}
 const q=profit.pricingQuote,b=q?.breakdown,application=selectedPlan.mode==='application';
 return {productId:string(row.productId??row.product_id),offerId:string(row.offerId??row.offer_id),sku,title:string(row.title),imageUrl:safeUrl(row.imageUrl),currency,productUrl:sku&&/^[1-9][0-9]*$/.test(sku)?`https://www.ozon.ru/product/${sku}/`:null,salesSpecification:salesSpecs.length?salesSpecs.join('；'):null,purchaseSpecification:purchaseSpecs.length?purchaseSpecs.join('；'):null,purchaseLinks:[...links.values()],purchaseMinor,sellerMinor,packageGrams,referenceProfit:application?{margin:profit.actualMargin,profitMinor:profit.profitMinor,logisticsMinor:profit.reason?null:b?.logisticsMinor??null,commissionMinor:profit.reason?null:b?.commissionMinor??null,fixedMinor:profit.reason?null:b?.fixedMinor??null,reason:profit.reason,metricBasis:profit.metricBasis,configRevision:q?.configRevision??null,planId:q?.planId??null,selectionReason:q?.selectionReason??null}:procurementProfit(sellerMinor,purchaseMinor,packageGrams,fees,currency,selectedPlan.reason),logisticsMatch:application?{status:q?.planId?'unique':'unavailable',candidatePlanIds:q?.matchedPlanIds??(q?.planId?[q.planId]:[]),...(q?.planId?{selectedPlanId:q.planId}:{}),label:q?.planName??'待配置',reason:profit.reason??q?.selectionReason??null}:{status:'unknown',candidatePlanIds:[],label:'待确认',reason:selectedPlan.mode==='delivery'?'物流渠道待匹配。':'当前为参考试算，未匹配具体物流渠道。'}};
}
function pricingWindow(pricing:PricingReader|undefined,storeId:string):string{
 const config=pricing?.read(storeId),now=Date.now();
 return canonicalJson([config?.revision??null,config?.plans.filter(plan=>plan.enabled&&(!plan.validFrom||now>=Date.parse(plan.validFrom))&&(!plan.validUntil||now<Date.parse(plan.validUntil))).map(plan=>plan.id).sort()??[]]);
}
function input(args:RecordData,pricingRevision:number|null=null,window:string|null=null):{storeId:string;query:string;limit:number;loadAll:boolean;mode:Plan['mode'];fees:Fees|null;deliveryMethodId:string|null;scope:string}{
 if(typeof args.storeId!=='string'||!args.storeId.trim())fail('STORE_REQUIRED','请先选择店铺。');if(args.query!==undefined&&typeof args.query!=='string')fail('INVALID_QUERY','搜索内容须为文字。');
 const limit=args.limit??10;if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail('INVALID_LIMIT','每页条数须为1至100。');const mode=args.planMode??'application';if(!['application','delivery','platform','custom'].includes(mode))fail('INVALID_PLAN','请选择有效的物流费用方案。');
 if(args.loadAll!==undefined&&typeof args.loadAll!=='boolean')fail('INVALID_LOAD_ALL','全量读取标记须为布尔值。');const loadAll=args.loadAll===true;if(loadAll&&args.cursor!==undefined)fail('INVALID_CURSOR','全量读取不使用分页位置，请重新读取完整列表。');
 if(args.forceRefresh!==undefined&&typeof args.forceRefresh!=='boolean')fail('INVALID_REFRESH','刷新标记须为布尔值。');if(args.cursor&&args.forceRefresh)fail('INVALID_REFRESH_CURSOR','手动更新应从第一页开始。');
 if(args.deliveryMethodId!==undefined&&(typeof args.deliveryMethodId!=='string'||!args.deliveryMethodId.trim()))fail('INVALID_PLAN','物流渠道编号无效。');
 const deliveryMethodId=mode==='delivery'?args.deliveryMethodId??null:null,feeCount=['fixedFeeYuan','logisticsYuanPerKg','commissionPercent'].filter(key=>args[key]!==undefined).length;
 if(mode==='delivery'&&feeCount&&(!deliveryMethodId||feeCount!==3))fail('INVALID_PLAN','请明确选择物流渠道，并完整填写该渠道的三项费用。');
 if(mode==='application'&&(feeCount||args.deliveryMethodId))fail('INVALID_PLAN','应用利润使用已保存经营规则；临时费用请明确选择高级试算。');
 const fees=mode==='custom'||mode==='delivery'&&feeCount===3?customFees(args):null,query=(args.query??'').trim().toLocaleLowerCase(),scope=createHash('sha256').update(canonicalJson({version:4,storeId:args.storeId,query,limit,loadAll,mode,fees,deliveryMethodId,pricingRevision:mode==='application'?pricingRevision:null,pricingWindow:mode==='application'?window:null})).digest('hex');return {storeId:args.storeId,query,limit,loadAll,mode,fees,deliveryMethodId,scope};
}
function productPayload(raw:unknown,storeId:string):RecordData {const value=object(raw);if(!Array.isArray(value.products)||!Array.isArray(value.stores))fail('PRODUCT_SNAPSHOT_INVALID','商品快照缺少店铺或商品列表。');const stores=value.stores.filter((row:RecordData)=>String(row.id??row.storeId)===storeId);if(stores.length!==1)fail('STORE_NOT_FOUND','所选店铺不在当前已连接店铺中。');if(stores[0].hasCredential===false)fail('PERMISSION_DENIED','所选店铺尚未授权。');return {products:value.products.filter((row:RecordData)=>String(row.storeId??row.store_id)===storeId&&row.status==='on_sale'),dataTime:sourceTime(stores[0].lastSuccessAt,value.dataTime)};}
function generation(store:CoreStore,key:string):string{return store.get<RecordData>('settings',`${key}:generation`)?.id??'initial';}

async function withLogistics(products:RecordData[],selectedPlan:Plan,args:RecordData,store:CoreStore,client:CoreClient,fees:Fees|null):Promise<{products:RecordData[];plan:Plan;caches:Snapshot['cache'][];warnings:string[];retryAt?:string}>{
 if(selectedPlan.mode!=='delivery')return {products,plan:selectedPlan,caches:[],warnings:[]};
 const caches:Snapshot['cache'][]=[];let nextPlan={...selectedPlan},warnings:string[]=[];
 try{
  const catalog=await loadLogisticsCatalog({store,client,storeId:args.storeId,forceRefresh:args.forceRefresh===true});caches.push(catalog.cache);warnings.push(...catalog.warnings);
  nextPlan={...nextPlan,choices:catalog.plans.map(value=>({id:value.id,name:value.name,warehouseId:value.warehouseId,warehouseName:value.warehouseName,active:value.active}))};
  const chosen=nextPlan.deliveryMethodId?catalog.plans.find(value=>value.id===nextPlan.deliveryMethodId&&value.active):undefined;
  if(nextPlan.deliveryMethodId)nextPlan.label=chosen?.name??'所选物流渠道待确认';
  nextPlan.reason=nextPlan.deliveryMethodId&&!chosen?'所选物流方案当前不可用。':!fees?'所选物流方案费用待补充':null;
  const inputs=products.map((row,index)=>({id:String(index),sku:row.sku as string|null})),matches=new Map<string,LogisticsMatch>();
  // Keep one catalog authorization generation throughout the complete list, including concurrent reads.
  for(let start=0;start<inputs.length;start+=100){
   catalog.assertAuthorization();
   const result=await matchProductLogistics({store,client,storeId:args.storeId,products:inputs.slice(start,start+100),plans:catalog.plans,forceRefresh:args.forceRefresh===true});
   caches.push(result.cache);warnings.push(...result.warnings);for(const match of result.matches)matches.set(match.id,match);
  }
  catalog.assertAuthorization();
  const enriched=products.map((row,index)=>{
   const matched=matches.get(inputs[index].id),candidatePlanIds=matched?.planIds??[],automatic=candidatePlanIds.length===1?catalog.plans.find(value=>value.id===candidatePlanIds[0]&&value.active):undefined,selected=nextPlan.deliveryMethodId?chosen&&candidatePlanIds.includes(chosen.id)?chosen:undefined:automatic;
   const status=selected?'unique':matched?.status??'unknown',reason=nextPlan.deliveryMethodId&&!selected?'该商品尚未确认适用所选物流方案。':selected?null:matched?.reason??'物流渠道待确认。',label=selected?.name??(status==='choice'?'多个候选渠道':'待确认'),canCalculate=!!(selected&&nextPlan.deliveryMethodId&&fees),profitReason=reason??nextPlan.reason??'所选物流方案费用待补充';
   return {...row,logisticsMatch:{status,candidatePlanIds,...(selected?{selectedPlanId:selected.id}:{}),label,reason},referenceProfit:procurementProfit(row.sellerMinor,row.purchaseMinor,row.packageGrams,canCalculate?fees:null,row.currency,profitReason)};
  });
  return {products:enriched,plan:nextPlan,caches,warnings:[...new Set(warnings)]};
 }catch(error){const e=error as Error&{code?:string;retryAfterMs?:number};if(snapshotAccessFailure(e.code??''))invalidateStoreSnapshots(store,args.storeId);const reason='物流方案暂时无法确认，商品资料仍可查看。';nextPlan.reason=reason;if(/AUTH|PERMISSION|FORBIDDEN|UNAUTHORIZED|HTTP_40[13]/i.test(e.code??''))nextPlan.choices=[];warnings.push(reason);return {products:products.map(row=>({...row,logisticsMatch:{status:'unknown',candidatePlanIds:[],label:'待确认',reason},referenceProfit:procurementProfit(row.sellerMinor,row.purchaseMinor,row.packageGrams,null,row.currency,reason)})),plan:nextPlan,caches,warnings:[...new Set(warnings)],retryAt:new Date(Date.now()+(e.retryAfterMs&&e.retryAfterMs>0?e.retryAfterMs:60000)).toISOString()};}
}

export async function readProcurement(args:RecordData,store:CoreStore,client:CoreClient,signal?:AbortSignal,pricing?:PricingReader):Promise<ToolResult>{
 if(args.loadAll===true){
  try{const request=input(args,pricing?.read(args.storeId)?.revision??null,pricingWindow(pricing,args.storeId));return await readCompleteSnapshot({store,storeId:request.storeId,scope:{kind:'procurement',scope:request.scope},force:args.forceRefresh===true,build:refresh=>readProcurementNow({...args,forceRefresh:refresh},store,client,undefined,pricing)});}
  catch(error){const e=error as Error&{code?:string};return {status:'failed',error:{code:e.code??'PROCUREMENT_FAILED',message:e.message,retryable:false}};}
 }
 return readProcurementNow(args,store,client,signal,pricing);
}
async function readProcurementNow(args:RecordData,store:CoreStore,client:CoreClient,signal?:AbortSignal,pricing?:PricingReader):Promise<ToolResult>{
 try{
  const pricingRevision=pricing?.read(args.storeId)?.revision??null,window=pricingWindow(pricing,args.storeId),request=input(args,pricingRevision,window),productKey=`procurement:products:${request.storeId}:${snapshotGeneration(store,request.storeId)}:${window}`,priceKey='procurement:pricing',currentGeneration=()=>canonicalJson([generation(store,productKey),generation(store,priceKey),snapshotGeneration(store,request.storeId)]);let snapshot:Snapshot,offset=0,snapshotId:string|undefined;
  if(args.cursor){const cursor=store.get<RecordData>('settings',`procurement:cursor:${args.cursor}`),saved=cursor?store.get<Snapshot>('settings',`procurement:snapshot:${cursor.snapshotId}`):undefined;if(!cursor||cursor.scope!==request.scope||cursor.generation!==currentGeneration()||!saved||saved.scope!==request.scope||saved.expiresAt<Date.now())fail('INVALID_CURSOR','分页已过期或不属于当前店铺、搜索和方案，请从第一页读取。');snapshot=saved!;offset=cursor.offset;snapshotId=cursor.snapshotId;}
  else {
   const products=await cachedRead(store,productKey,()=>client.getStoreProducts(),raw=>productPayload(raw,request.storeId),args.forceRefresh===true,signal);let fees=request.fees,selectedPlan=plan(request.mode,fees,request.mode==='application'?pricingRevision:null,null,request.deliveryMethodId),settings:ReadResult|undefined,settingsRetryAt:number|undefined;const warnings:string[]=[];
   if(request.mode==='platform')try{if(!client.getPricingSettings)fail('PRICING_SETTINGS_UNAVAILABLE','当前连接没有提供费用方案接口。');settings=await cachedRead(store,priceKey,()=>client.getPricingSettings!(),validSettings,args.forceRefresh===true,signal);fees=settings.entry.payload as Fees;selectedPlan=plan('platform',fees,settings.entry.payload.revision);}catch(error){const e=error as Error&{retryAfterMs?:number};selectedPlan=plan('platform',null,null,e.message);warnings.push(selectedPlan.reason!);settingsRetryAt=Date.now()+(e.retryAfterMs&&e.retryAfterMs>0?e.retryAfterMs:60000);}
   const rows=(products.entry.payload.products as RecordData[]).map(row=>normalize(row,fees,selectedPlan,request.storeId,pricing)),filtered=request.query?rows.filter(row=>[row.title,row.sku,row.offerId,row.salesSpecification,row.purchaseSpecification].some(value=>typeof value==='string'&&value.toLocaleLowerCase().includes(request.query))):rows;
   const entries=[products,...settings?[settings]:[]],fetchedAt=entries.map(read=>read.entry.fetchedAt).sort()[0],expiresAt=entries.map(read=>read.entry.expiresAt).sort()[0],stale=entries.some(read=>read.stale)||!!selectedPlan.reason,nextRefreshAt=stale?new Date(Math.max(Date.now()+1000,settingsRetryAt??0,...entries.filter(read=>read.stale).map(read=>Date.parse(read.entry.nextRetryAt??read.entry.expiresAt)))).toISOString():expiresAt;
   if(entries.some(read=>read.stale))warnings.push('暂时使用已缓存的数据，稍后自动更新。');snapshot={scope:request.scope,products:filtered,plan:selectedPlan,dataTime:products.entry.payload.dataTime,cache:{ttlMs:PROCUREMENT_CACHE_TTL_MS,fetchedAt,expiresAt,nextRefreshAt,stale},warnings,expiresAt:Date.now()+3600000};
  }
  let products=request.loadAll?snapshot.products:snapshot.products.slice(offset,offset+request.limit);let cursor:string|undefined;if(!request.loadAll&&offset+products.length<snapshot.products.length){if(!snapshotId){snapshotId=randomUUID();store.put('settings',`procurement:snapshot:${snapshotId}`,snapshot);}cursor=`procurement:${randomUUID()}`;store.put('settings',`procurement:cursor:${cursor}`,{scope:request.scope,generation:currentGeneration(),snapshotId,offset:offset+products.length});}
  const stale=snapshot.cache.stale||Date.parse(snapshot.cache.expiresAt)<=Date.now(),cache={...snapshot.cache,stale,...(stale&&Date.parse(snapshot.cache.nextRefreshAt)<=Date.now()?{nextRefreshAt:new Date(Date.now()+1000).toISOString()}:{})};
  const logistics=await withLogistics(products,snapshot.plan,args,store,client,request.fees),allCaches=[cache,...logistics.caches],combinedStale=allCaches.some(cache=>cache.stale)||!!logistics.retryAt,combinedCache={ttlMs:PROCUREMENT_CACHE_TTL_MS,fetchedAt:allCaches.map(cache=>cache.fetchedAt).sort()[0],expiresAt:allCaches.map(cache=>cache.expiresAt).sort()[0],stale:combinedStale,nextRefreshAt:combinedStale?new Date(Math.max(Date.now()+1000,logistics.retryAt?Date.parse(logistics.retryAt):0,...allCaches.filter(cache=>cache.stale).map(cache=>Date.parse(cache.nextRefreshAt)))).toISOString():allCaches.map(cache=>cache.nextRefreshAt).sort()[0]};products=logistics.products;
  return {status:'ok',data:{products,total:snapshot.products.length,...cursor?{cursor}:{},plan:logistics.plan,dataTime:snapshot.dataTime,cache:combinedCache,warnings:[...snapshot.warnings,...logistics.warnings,...(args.cursor&&stale?['分页保留同一次快照；刷新第一页可更新全部数据。']:[])]},provenance:{source:'hallmark_compute',endpoint:'hallmark.products.procurement',storeId:request.storeId,fetchedAt:combinedCache.fetchedAt,...snapshot.dataTime?{dataTime:snapshot.dataTime}:{}},metricBasis:PROCUREMENT_METRIC_BASIS};
 }catch(error){const e=error as Error&{code?:string;retryable?:boolean;retryAfterMs?:number};if(snapshotAccessFailure(e.code??'')&&typeof args.storeId==='string')invalidateStoreSnapshots(store,args.storeId);return {status:e.retryable?'unavailable':'failed',error:{code:e.code??'PROCUREMENT_FAILED',message:e.message,retryable:e.retryable===true,...e.retryAfterMs!==undefined?{retryAfterMs:e.retryAfterMs}:{}}};}
}
