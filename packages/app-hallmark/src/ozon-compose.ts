import {createHash,randomUUID} from 'node:crypto';
import {readCompleteSnapshot,SNAPSHOT_CACHE_SCHEMA,snapshotGeneration,snapshotAccessFailure,invalidateStoreSnapshots} from './snapshot-cache.ts';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonSchema} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {CoreStore,RecordData} from '../../core/src/types.ts';
import {readOzonData} from './ozon-data.ts';
import {COMPOSITION_FIELD_MAP,OZON_COMPOSITION_FIELDS,OZON_COMPOSITION_SOURCES,OZON_COMPOSITION_SOURCE_FIELDS,validateOzonCompositionRecipe} from './ozon-composition.ts';
import type {OzonCompositionRecipe,OzonCompositionSource} from './ozon-composition.ts';
import {OZON_FIELD_META} from './ozon-fields.ts';

const SOURCE_CACHE_TTL_MS=900_000;
const text:JsonSchema={type:'string',minLength:1};
const positiveId:JsonSchema={type:'string',pattern:'^[1-9][0-9]*$'};
const recipeSchema:JsonSchema={type:'object',properties:{version:{const:1},grain:{enum:['product','posting']},fields:{type:'array',minItems:1,maxItems:30,uniqueItems:true,items:{enum:OZON_COMPOSITION_FIELDS.map(field=>field.key)}}},required:['version','grain','fields'],additionalProperties:false};
const rowSchema:JsonSchema={type:'object',properties:Object.fromEntries(Object.entries(OZON_COMPOSITION_SOURCE_FIELDS).map(([source,fields])=>[source,{type:'object',properties:Object.fromEntries(fields.map(field=>[field,{type:[['integer','currency','percent'].includes(OZON_FIELD_META[field].format)?'number':'string','null']}])) ,required:fields,additionalProperties:false}])),additionalProperties:false};
const sourceStateSchema:JsonSchema={type:'object',properties:{source:text,status:{enum:['ready','empty','missing']},rowCount:{type:'integer',minimum:0},pageCount:{type:'integer',minimum:0},dataTime:{type:['string','null']},fetchedAt:{type:['string','null']},cacheHit:{type:'boolean'},freshness:{enum:['fresh','stale']},cacheReason:{enum:['none','ttl','rate_limit','upstream_unavailable','refresh_due']},nextRetryAt:text},required:['source','status','rowCount','pageCount','dataTime','fetchedAt','cacheHit','freshness','cacheReason'],additionalProperties:false};
const cacheSchema=SNAPSHOT_CACHE_SCHEMA;
export const OZON_COMPOSE_DESCRIPTOR:CapabilityDescriptor={capabilityId:'hallmark.ozon.compose',version:'1.0.0',title:'Ozon 跨接口组合数据',description:'按商品或包裹组合已封装接口字段。统一店铺，完整读取关联页后分页；费用只允许包裹粒度，不推测商品分摊。字段目录和组合定义可供工作台、Agent、源码组件复用。',effect:'query',aliases:[],inputSchema:{type:'object',properties:{storeId:text,recipe:recipeSchema,dateFrom:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},dateTo:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},warehouseId:positiveId,actionId:positiveId,participation:{enum:['joined','eligible']},limit:{type:'integer',minimum:1,maximum:100},cursor:text,loadAll:{type:'boolean'},forceRefresh:{type:'boolean'}},required:['storeId','recipe'],additionalProperties:false},outputSchema:{type:'object',properties:{items:{type:'array',items:rowSchema},cursor:text,total:{type:'integer',minimum:0},dataTime:{type:['string','null']},warnings:{type:'array',items:{type:'string'}},sourceStates:{type:'array',items:sourceStateSchema},cache:cacheSchema,fieldMeta:{type:'array',items:{type:'object',properties:{key:text,source:text,label:text,description:text,format:text,currencyPath:text,unit:text},required:['key','source','label','description','format'],additionalProperties:false}},period:{type:'object',properties:{dateFrom:text,dateTo:text},required:['dateFrom','dateTo'],additionalProperties:false}},required:['items','total','dataTime','warnings','sourceStates','fieldMeta','cache'],additionalProperties:false},execution:{mode:'sync',timeoutMs:120000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:['Ozon','组合','跨接口','字段','数据源','模板','商品','包裹']}};

type Row=Record<string,any>;
type SourceState={source:string;status:'ready'|'empty'|'missing';rowCount:number;pageCount:number;dataTime:string|null;fetchedAt:string|null;cacheHit:boolean;freshness:'fresh'|'stale';cacheReason:'none'|'ttl'|'rate_limit'|'upstream_unavailable'|'refresh_due';nextRetryAt?:string};
type Collected={rows:Row[];state:SourceState};
type SourceProgress={rows:Row[];pages:number;cursors:string[];cursor?:string;dataTimes:string[];unknownTime:boolean;warnings:string[];expiresAt:number;complete:boolean;fetchedAt:string;refreshRequested?:boolean;retryAt?:number;retryReason?:'rate_limit'|'upstream_unavailable'};
const sourceInflight=new WeakMap<CoreStore,Map<string,Promise<Collected>>>();
type Snapshot={scope:string;expiresAt:number;items:Row[];warnings:string[];sourceStates:SourceState[];offset:number};
type Cursor={scope:string;expiresAt:number;snapshotId:string;offset:number};
type Reader=(kind:OzonCompositionSource,args:RecordData)=>Promise<ToolResult>;
const fail=(code:string,message:string):never=>{throw Object.assign(new Error(message),{code});};
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);
function dateRange(args:RecordData,required:boolean):void {
 if(!required&&!args.dateFrom&&!args.dateTo)return;
 if(typeof args.dateFrom!=='string'||typeof args.dateTo!=='string')fail('COMPOSITION_DATE_REQUIRED','所选信息需要开始和结束日期。');
 const from=Date.parse(`${args.dateFrom}T00:00:00Z`),to=Date.parse(`${args.dateTo}T00:00:00Z`);
 if(!Number.isFinite(from)||!Number.isFinite(to)||new Date(from).toISOString().slice(0,10)!==args.dateFrom||new Date(to).toISOString().slice(0,10)!==args.dateTo||from>to||to-from>89*86400000)fail('INVALID_DATE_RANGE','日期必须有效、先后有序且不超过90天。');
}
function selectedSources(recipe:OzonCompositionRecipe):Set<OzonCompositionSource>{return new Set(recipe.fields.map(key=>COMPOSITION_FIELD_MAP.get(key)!.source));}
function assertConditions(recipe:OzonCompositionRecipe,args:RecordData):void {
 const sources=selectedSources(recipe),dates=recipe.grain==='posting'||['analytics','orders','weights','finance'].some(source=>sources.has(source as OzonCompositionSource));
 dateRange(args,dates);
 if(sources.has('analytics')&&args.dateTo>=new Date().toISOString().slice(0,10))fail('ANALYTICS_DATE_RANGE','流量数据须使用截至昨天的完整日期。');
 if(sources.has('warehouses')&&!validId(args.warehouseId))fail('COMPOSITION_WAREHOUSE_REQUIRED','仓库详情需要选择一个仓库。');
 if(sources.has('promotions')&&!validId(args.actionId))fail('COMPOSITION_ACTION_REQUIRED','活动信息需要选择具体活动。');
 if(args.warehouseId!==undefined&&!validId(args.warehouseId)||args.actionId!==undefined&&!validId(args.actionId))fail('COMPOSITION_FILTER_INVALID','仓库或活动编号无效。');
 if(args.participation!==undefined&&!['joined','eligible'].includes(args.participation))fail('COMPOSITION_FILTER_INVALID','活动参加状态无效。');
}
function empty(source:OzonCompositionSource):Row{return Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS[source].map(field=>[field,null]));}
function numericSum(rows:Row[],field:string):number|null {if(!rows.length||rows.some(row=>typeof row[field]!=='number'||!Number.isFinite(row[field])))return null;return Number(rows.reduce((total,row)=>total+row[field],0).toFixed(6));}
function same(rows:Row[],field:string):any {const values=rows.map(row=>row[field]);if(!values.length||values.some(value=>value==null))return null;return values.every(value=>value===values[0])?values[0]:null;}
function textValues(rows:Row[],field:string):string|null {const values=[...new Set(rows.map(row=>row[field]).filter(value=>typeof value==='string'&&value.length))];return values.length?values.join(' · '):null;}
function latest(rows:Row[],time:string):Row|undefined {if(rows.length<=1)return rows[0];if(rows.some(row=>typeof row[time]!=='string'||!Number.isFinite(Date.parse(row[time]))))return;return [...rows].sort((a,b)=>Date.parse(b[time])-Date.parse(a[time])||canonicalJson(a).localeCompare(canonicalJson(b)))[0];}
function aggregate(source:OzonCompositionSource,rows:Row[],warnings:Set<string>):Row {
 const result=empty(source);if(!rows.length)return result;
 for(const field of OZON_COMPOSITION_SOURCE_FIELDS[source])result[field]=textValues(rows,field);
 const numeric=OZON_COMPOSITION_SOURCE_FIELDS[source].filter(field=>['integer','currency','percent'].includes(OZON_FIELD_META[field].format));
 for(const field of numeric)result[field]=same(rows,field);
 if(source==='stocks'||source==='analytics')for(const field of numeric)result[field]=numericSum(rows,field);
 if(source==='orders'||source==='returns'){
  result.quantity=numericSum(rows,'quantity');const recent=latest(rows,'createdAt');result.orderPrice=recent?.orderPrice??null;result.currency=recent?.currency??null;
  if(rows.length>1&&!recent)warnings.add(`${source==='orders'?'订单':'售后'}存在缺少有效时间的多条记录，最近单价保持未知。`);
 }
 if(source==='weights'){const recent=latest(rows,'shipmentAt');if(!recent)warnings.add('多条单件实重记录缺少有效交运时间，无法确认最新值，重量保持未知。');return recent??empty(source);}
 if(source==='finance'){
  result.currency=same(rows,'currency');
  for(const field of numeric)result[field]=result.currency?numericSum(rows,field):null;
  if(!result.currency&&rows.some(row=>numeric.some(field=>row[field]!=null)))warnings.add('同一包裹存在未知或不同币种的记账记录；合计金额保持未知，不自动换汇。');
 }
 return result;
}
function assertUnique(rows:Row[],keys:string[],label:string):void {const found=new Set<string>();for(const row of rows){if(keys.some(key=>row[key]==null))continue;const key=canonicalJson(keys.map(key=>row[key]));if(found.has(key))fail('COMPOSITION_AMBIGUOUS_IDENTITY',`${label}存在重复身份，无法安全关联。`);found.add(key);}}
function related(rows:Row[],product:Row|undefined):Row[]{if(!product)return [];return rows.filter(row=>validId(product.sku)&&row.sku===product.sku||validId(product.productId)&&row.productId===product.productId);}
async function collect(kind:OzonCompositionSource,args:RecordData,reader:Reader,warnings:Set<string>,store:CoreStore,signal?:AbortSignal,forceRefresh=false):Promise<Collected> {
 const key=createHash('sha256').update(canonicalJson({version:2,kind,args,generation:snapshotGeneration(store,args.storeId)})).digest('hex');
 const cooldownKey=canonicalJson([args.storeId,kind]);
 let inflight=sourceInflight.get(store);if(!inflight){inflight=new Map();sourceInflight.set(store,inflight);}
 const restoreWarnings=()=>{for(const collection of ['ozon_composition_sources','ozon_composition_source_results'])for(const warning of store.get<SourceProgress>(collection,key)?.warnings??[])warnings.add(warning);};
 const active=inflight.get(key);if(active){const value=await active;restoreWarnings();return value;}
 const work=(async():Promise<Collected>=>{
  const saved=store.get<SourceProgress>('ozon_composition_sources',key),previous=saved&&(saved.complete?Date.parse(saved.fetchedAt)+SOURCE_CACHE_TTL_MS:saved.expiresAt)>Date.now()?saved:undefined;
  const archive=store.get<SourceProgress>('ozon_composition_source_results',key),archived=archive?.complete?archive:undefined,lastGood=saved?.complete&&(!archived||saved.fetchedAt>=archived.fetchedAt)?saved:archived;
  if(lastGood)store.put('ozon_composition_source_results',key,lastGood);
  const resultOf=(value:SourceProgress,cacheHit:boolean,freshness:SourceState['freshness']='fresh',cacheReason:SourceState['cacheReason']=cacheHit?'ttl':'none',nextRetryAt?:number):Collected=>({rows:value.rows,state:{source:kind,status:value.rows.length?'ready':'empty',rowCount:value.rows.length,pageCount:value.pages,dataTime:!value.unknownTime&&value.dataTimes.length===1?value.dataTimes[0]:null,fetchedAt:value.fetchedAt,cacheHit,freshness,cacheReason,...(nextRetryAt?{nextRetryAt:new Date(nextRetryAt).toISOString()}:{})}});
  // Incomplete pages are never usable rows. Expose the missing source while keeping
  // successful sibling sources visible, and resume only this exact query after retryAt.
  const missing=(retryAt:number):Collected=>({rows:[],state:{source:kind,status:'missing',rowCount:0,pageCount:0,dataTime:null,fetchedAt:null,cacheHit:false,freshness:'stale',cacheReason:'rate_limit',nextRetryAt:new Date(retryAt).toISOString()}});
  if(previous?.complete&&!forceRefresh&&!previous.refreshRequested)return resultOf(previous,true);
  const rateUntil=Math.max(store.get<{retryAt:number}>('ozon_composition_cooldowns',cooldownKey)?.retryAt??0,kind==='analytics'&&lastGood?Date.parse(lastGood.fetchedAt)+60000:0,previous?.retryReason!=='upstream_unavailable'?previous?.retryAt??0:0);
  if(rateUntil>Date.now()){
   // A requested update must resume after cooldown even while the ordinary cache is valid.
   if(forceRefresh&&previous?.complete)store.put('ozon_composition_sources',key,{...previous,refreshRequested:true});
   if(lastGood)return resultOf(lastGood,true,'stale','rate_limit',rateUntil);
   return missing(rateUntil);
  }
  if(previous?.retryReason==='upstream_unavailable'&&(previous.retryAt??0)>Date.now()){
   if(lastGood)return resultOf(lastGood,true,'stale','upstream_unavailable',previous.retryAt);
   throw Object.assign(new Error(`${kind} 暂时无法读取，请稍后重试。`),{code:'COMPOSITION_SOURCE_UNAVAILABLE',retryable:true,retryAfterMs:previous.retryAt!-Date.now()});
  }
  const resumable=previous&&!previous.complete?previous:undefined;
  const rows=structuredClone(resumable?.rows??[]),cursors=new Set(resumable?.cursors??[]),dataTimes=new Set(resumable?.dataTimes??[]),sourceWarnings=new Set(resumable?.warnings??[]);let cursor=resumable?.cursor,pages=resumable?.pages??0,unknownTime=resumable?.unknownTime??false;
  const checkpoint=(complete:boolean,retryAfterMs?:number,retryReason?:SourceProgress['retryReason'])=>{
   const value=store.put<SourceProgress>('ozon_composition_sources',key,{rows,pages,cursors:[...cursors],...(cursor?{cursor}:{}),dataTimes:[...dataTimes],unknownTime,warnings:[...sourceWarnings],expiresAt:Date.now()+(complete?SOURCE_CACHE_TTL_MS:600000),complete,fetchedAt:new Date().toISOString(),...(retryAfterMs?{retryAt:Date.now()+retryAfterMs,retryReason}:{})});
   if(complete)store.put('ozon_composition_source_results',key,value);return value;
  };
  do{
   if(signal?.aborted)fail('ABORTED','组合读取已取消。');
   if(pages>=1000||rows.length>100000)fail('COMPOSITION_READ_LIMIT','关联数据超过完整读取上限，请缩小日期范围；未返回截断结果。');
   const result=await reader(kind,{...args,limit:100,...(cursor?{cursor}:{})});
   if(result.status!=='ok'){
    const error='error' in result?result.error:undefined,retryAfterMs=error?.retryAfterMs;
    if(result.status==='unavailable'&&error?.code==='LOCAL_RATE_LIMIT'){
     const retryAt=Date.now()+(retryAfterMs??60000);checkpoint(false,retryAfterMs??60000,'rate_limit');store.put('ozon_composition_cooldowns',cooldownKey,{retryAt});
     if(lastGood)return resultOf(lastGood,true,'stale','rate_limit',retryAt);
     return missing(retryAt);
    }else if(result.status==='unavailable'&&error?.retryable===true&&lastGood){const delay=retryAfterMs??5000;checkpoint(false,delay,'upstream_unavailable');return resultOf(lastGood,true,'stale','upstream_unavailable',Date.now()+delay);}
    throw Object.assign(new Error(`${kind}：${error?.message??'未完整返回。'}`),{code:error?.code??'COMPOSITION_SOURCE_INCOMPLETE',retryable:result.status==='unavailable',...(retryAfterMs?{retryAfterMs}:{})});
   }
   const payload=result.data;if(!object(payload)||!Array.isArray(payload.items)||payload.items.some((row:unknown)=>!object(row)))fail('COMPOSITION_SOURCE_INVALID',`${kind} 未返回有效数据行。`);
   const data=payload as Row;
   rows.push(...data.items);pages++;for(const warning of data.warnings??[])if(typeof warning==='string')sourceWarnings.add(warning);
   if(typeof data.dataTime==='string')dataTimes.add(data.dataTime);else unknownTime=true;
   cursor=typeof data.cursor==='string'&&data.cursor?data.cursor:undefined;
   if(cursor){if(cursors.has(cursor))fail('COMPOSITION_PAGINATION_STALLED',`${kind} 返回重复分页位置。`);cursors.add(cursor);}
   checkpoint(!cursor);
  }while(cursor);
  const complete=store.get<SourceProgress>('ozon_composition_sources',key)!;
  if(kind==='analytics')store.put('ozon_composition_cooldowns',cooldownKey,{retryAt:Date.parse(complete.fetchedAt)+60000});
  return resultOf(complete,false);
 })();
 inflight.set(key,work);
 try{const result=await work;restoreWarnings();return result;}finally{inflight.delete(key);}
}
async function build(recipe:OzonCompositionRecipe,args:RecordData,reader:Reader,store:CoreStore,signal?:AbortSignal):Promise<Omit<Snapshot,'scope'|'expiresAt'|'offset'>> {
 const selected=selectedSources(recipe),dependencies=new Set<OzonCompositionSource>(selected);dependencies.add(recipe.grain==='product'?'products':'orders');
 if(recipe.grain==='posting'&&[...selected].some(source=>['products','prices','stocks','analytics','promotions','warehouses'].includes(source)))dependencies.add('products');
 const rows:Partial<Record<OzonCompositionSource,Row[]>>={},sourceStates:SourceState[]=[],warnings=new Set<string>();
 for(const source of dependencies){
  const input:RecordData={storeId:args.storeId};
  if(['analytics','orders','weights','finance'].includes(source))Object.assign(input,{dateFrom:args.dateFrom,dateTo:args.dateTo});
  if(source==='analytics')input.groupBy='sku';
  if(['warehouses','stocks'].includes(source)&&args.warehouseId)input.warehouseId=args.warehouseId;
  if(source==='promotions')Object.assign(input,{actionId:args.actionId,participation:args.participation??'joined'});
  const value=await collect(source,input,reader,warnings,store,signal,args.forceRefresh===true);rows[source]=value.rows;sourceStates.push(value.state);
  if(value.state.status==='missing')warnings.add(`${OZON_COMPOSITION_SOURCES.find(item=>item.key===source)!.label}受平台频率限制，当前店铺和查询范围尚无完整缓存；相关信息暂留空，将在 ${value.state.nextRetryAt} 重试，其他信息可继续查看。`);
  else if(value.state.freshness==='stale')warnings.add(`${OZON_COMPOSITION_SOURCES.find(item=>item.key===source)!.label}${value.state.cacheReason==='rate_limit'?'受平台频率限制':'暂时无法更新'}，保留 ${value.state.fetchedAt} 的上次完整数据；将在 ${value.state.nextRetryAt??'稍后'} 重试。`);
 }
 const baseSource=recipe.grain==='product'?'products':'orders',baseState=sourceStates.find(state=>state.source===baseSource)!;
 if(baseState.status==='missing')throw Object.assign(new Error(`${recipe.grain==='product'?'商品资料':'订单包裹'}受平台频率限制，当前范围尚无完整缓存，请等待自动重试。`),{code:'LOCAL_RATE_LIMIT',retryable:true,retryAfterMs:Math.max(1,Date.parse(baseState.nextRetryAt!)-Date.now())});
 if(selected.has('promotions')){
  const catalog=await collect('promotions',{storeId:args.storeId},reader,warnings,store,signal,args.forceRefresh===true),action=catalog.rows.filter(row=>row.actionId===args.actionId);
  sourceStates.push({...catalog.state,source:'promotions.catalog'});
  if(catalog.state.status==='missing')warnings.add(`活动目录受平台频率限制且尚无完整缓存，活动名称和时间保持未知，将在 ${catalog.state.nextRetryAt} 重试。`);
  else{
   if(catalog.state.freshness==='stale')warnings.add('活动目录暂时无法更新，活动名称和时间沿用上次完整读取结果；请查看来源更新时间。');
   if(action.length!==1)fail('COMPOSITION_ACTION_NOT_FOUND','所选活动未在当前店铺活动目录中唯一找到。');
   rows.promotions=rows.promotions!.map(row=>({...row,actionName:action[0].actionName,startsAt:action[0].startsAt,endsAt:action[0].endsAt}));
  }
 }
 const products=rows.products??[];assertUnique(products,['productId'],'商品');assertUnique(products.filter(row=>validId(row.sku)),['sku'],'商品 SKU');
 assertUnique(rows.prices??[],['productId'],'价格');assertUnique((rows.stocks??[]).filter(row=>validId(row.sku)&&row.warehouseId),['sku','warehouseId'],'分仓库存');assertUnique(rows.analytics??[],['sku','date'],'每日流量');assertUnique(rows.finance??[],['accrualId'],'财务');assertUnique(rows.promotions??[],['actionId','productId'],'活动商品');assertUnique(rows.returns??[],['returnId'],'售后');
 assertUnique((rows.analytics??[]).filter(row=>row.date===null),['sku'],'期间商品流量');
 assertUnique((rows.stocks??[]).filter(row=>validId(row.productId)&&row.warehouseId),['productId','warehouseId'],'商品分仓库存');assertUnique(rows.orders??[],['postingNumber','sku'],'包裹商品');assertUnique(rows.weights??[],['postingNumber','sku'],'单件实重');
 const productBySku=new Map(products.filter(row=>validId(row.sku)).map(row=>[row.sku,row])),productById=new Map(products.filter(row=>validId(row.productId)).map(row=>[row.productId,row]));
 for(const stock of rows.stocks??[])if(validId(stock.sku)&&validId(stock.productId)){const a=productBySku.get(stock.sku),b=productById.get(stock.productId);if(a&&a.productId!==stock.productId||b&&validId(b.sku)&&b.sku!==stock.sku)fail('COMPOSITION_IDENTITY_CONFLICT','库存的商品编号和 SKU 与商品资料不一致。');}
 const postings=new Map<string,Row[]>();for(const row of rows.orders??[]){const group=postings.get(row.postingNumber)??[];group.push(row);postings.set(row.postingNumber,group);}
 const base:Row[][]=recipe.grain==='product'?products.map(row=>[row]):[...postings.values()];
 if(recipe.grain==='posting'&&(rows.orders??[]).some(row=>!row.postingNumber))fail('COMPOSITION_POSTING_ID_REQUIRED','订单缺少包裹编号，不能汇总费用。');
 if(selected.has('stocks'))warnings.add(args.warehouseId?'库存只统计所选仓库；未提供数量保持未知。':'库存为所选店铺全部返回仓库的合计；任一仓库数量未知时合计保持未知。');
 if(selected.has('analytics'))warnings.add('流量按所选完整日期汇总；访问会话总数不等于期间去重人数。');
 if(selected.has('returns'))warnings.add('售后统计平台可返回的全部记录，不套用订单的日期范围。');
 if(recipe.grain==='product'&&(selected.has('orders')||selected.has('returns')))warnings.add('商品行数量按关联记录合计，订单及售后单价取各自最近一条记录；多个文本值并列显示。');
 const items=base.map(group=>{
  const posting=recipe.grain==='posting'?group[0].postingNumber:undefined;
  const skus=[...new Set(group.map(row=>row.sku).filter(validId))];
  const singleSku=skus.length===1&&group.every(row=>row.sku===skus[0]);
  const product=recipe.grain==='product'?group[0]:singleSku?productBySku.get(skus[0]):undefined;
  const result:Row={};
  for(const source of selected){
   let matches:Row[]=[];
   if(source==='products')matches=product?[product]:[];
   else if(source==='warehouses')matches=rows.warehouses??[];
   else if(source==='finance')matches=(rows.finance??[]).filter(row=>row.postingNumber===posting);
   else if(recipe.grain==='posting'&&['orders','returns','weights'].includes(source))matches=(rows[source]??[]).filter(row=>row.postingNumber===posting);
   else matches=related(rows[source]??[],product);
   result[source]=aggregate(source,matches,warnings);
   if(source==='orders'&&recipe.grain==='posting'&&!singleSku){result[source].orderPrice=null;result[source].currency=null;}
   if(source==='weights'&&recipe.grain==='posting'&&matches.length&&(!singleSku||numericSum(group,'quantity')!==1||matches.some(row=>row.sku!==skus[0]))){result[source]=empty(source);warnings.add('实重记录与包裹单 SKU 单件身份不一致，未展示该包裹的单品实重。');}
   if(recipe.grain==='posting'&&!product&&['products','prices','stocks','analytics','promotions'].includes(source))warnings.add('多 SKU 或无法匹配商品身份的包裹不展示单品价格、库存和流量；费用仍按整个包裹展示。');
  }
  return result;
 });
 return {items,warnings:[...warnings],sourceStates};
}

function freshness(states:SourceState[],warnings:string[]){
 const now=Date.now(),sourceStates=states.map(state=>state.freshness==='fresh'&&state.fetchedAt&&Date.parse(state.fetchedAt)+SOURCE_CACHE_TTL_MS<=now?{...state,freshness:'stale' as const,cacheReason:'refresh_due' as const}:state);
 const fetchedAt=new Date(Math.min(...sourceStates.flatMap(state=>state.fetchedAt?[Date.parse(state.fetchedAt)]:[]))).toISOString(),expiresAt=new Date(Date.parse(fetchedAt)+SOURCE_CACHE_TTL_MS).toISOString(),stale=sourceStates.some(state=>state.freshness==='stale');
 // A page cursor keeps one consistent snapshot; it never claims that paging re-fetched Ozon.
 const nextRefreshAt=stale?new Date(Math.max(now+1000,...sourceStates.filter(state=>state.freshness==='stale').map(state=>state.nextRetryAt?Date.parse(state.nextRetryAt):now+5000))).toISOString():expiresAt;
 const messages=sourceStates.some(state=>state.cacheReason==='refresh_due')?[...warnings,'当前完整数据已超过 15 分钟缓冲期，后台更新时仍保留上次快照；后续分页仍属于同一次完整快照。']:warnings;
 return {sourceStates,warnings:messages,cache:{ttlMs:SOURCE_CACHE_TTL_MS,fetchedAt,expiresAt,stale,nextRefreshAt}};
}

/** Shared provider entrypoint. Tests can inject normalized reads; production always uses the existing Ozon adapter. */
export async function readOzonComposition(args:RecordData,store:CoreStore,client:Parameters<typeof readOzonData>[3],signal?:AbortSignal,read?:Reader):Promise<ToolResult> {
 if(args.loadAll===true){
  if(typeof args.storeId!=='string'||!args.storeId||args.cursor!==undefined||args.forceRefresh!==undefined&&typeof args.forceRefresh!=='boolean')return {status:'failed',error:{code:'INVALID_FULL_READ',message:'完整读取需要店铺，不使用分页位置，刷新标记须为布尔值。',retryable:false}};
  const {forceRefresh,...scope}=args;
  return readCompleteSnapshot({store,storeId:args.storeId,scope:{kind:'composition',input:scope},force:forceRefresh===true,build:refresh=>readOzonCompositionNow({...args,forceRefresh:refresh},store,client,undefined,read)});
 }
 return readOzonCompositionNow(args,store,client,signal,read);
}
async function readOzonCompositionNow(args:RecordData,store:CoreStore,client:Parameters<typeof readOzonData>[3],signal?:AbortSignal,read?:Reader):Promise<ToolResult> {
 try{
  if(typeof args.storeId!=='string'||!args.storeId)fail('STORE_REQUIRED','请选择店铺。');
  if(args.forceRefresh!==undefined&&typeof args.forceRefresh!=='boolean')fail('INVALID_REFRESH','刷新标记必须为布尔值。');
  if(args.cursor&&args.forceRefresh)fail('INVALID_REFRESH_CURSOR','手动刷新须从第一页开始，不能同时沿用旧分页位置。');
  let recipe:OzonCompositionRecipe;try{recipe=validateOzonCompositionRecipe(args.recipe);}catch(error){fail('COMPOSITION_RECIPE_INVALID',error instanceof Error?error.message:String(error));}
  assertConditions(recipe!,args);const limit=args.limit??20;if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail('INVALID_LIMIT','每页条数须为 1 至 100。');
  const {cursor,forceRefresh,...query}=args,scope=createHash('sha256').update(canonicalJson({executionVersion:3,generation:snapshotGeneration(store,args.storeId),input:{...query,recipe:recipe!,limit}})).digest('hex');let snapshot:Snapshot,snapshotId:string|undefined;
  if(cursor){const position=store.get<Cursor>('ozon_composition_cursors',cursor),cached=position?store.get<Snapshot>('ozon_composition_snapshots',position.snapshotId):undefined;if(!position||position.scope!==scope||!cached||cached.scope!==scope||cached.expiresAt<Date.now()||!cached.sourceStates.every(state=>(typeof state.fetchedAt==='string'||state.status==='missing'&&state.fetchedAt===null)&&typeof state.cacheHit==='boolean'&&['fresh','stale'].includes(state.freshness)&&typeof state.cacheReason==='string'))fail('INVALID_CURSOR','组合分页已过期、来自旧执行版本或不属于当前店铺和筛选条件，请从第一页重新读取。');snapshot={...cached!,offset:position!.offset};snapshotId=position!.snapshotId;}
  else snapshot={...await build(recipe!,args,read??((kind,input)=>readOzonData(kind,input,store,client,signal)),store,signal),scope,expiresAt:Date.now()+3600000,offset:0};
  const items=args.loadAll===true?snapshot.items:snapshot.items.slice(snapshot.offset,snapshot.offset+limit),offset=snapshot.offset+items.length;let next:string|undefined;
  if(offset<snapshot.items.length){if(!snapshotId){snapshotId=randomUUID();store.put('ozon_composition_snapshots',snapshotId,snapshot);}next=`ozon-compose:${randomUUID()}`;store.put('ozon_composition_cursors',next,{scope,expiresAt:snapshot.expiresAt,snapshotId,offset});}
  const fieldMeta=recipe!.fields.map(key=>{const field=COMPOSITION_FIELD_MAP.get(key)!;return {key,source:field.source,label:field.label,description:field.description,format:field.format,...(field.unit?{unit:field.unit}:{}),...(field.format==='currency'?{currencyPath:`${field.source}.currency`}:{})};});
  const lifecycle=freshness(snapshot.sourceStates,snapshot.warnings);
  return {status:'ok',data:{items,...(next?{cursor:next}:{}),total:snapshot.items.length,dataTime:null,...lifecycle,fieldMeta,...(args.dateFrom?{period:{dateFrom:args.dateFrom,dateTo:args.dateTo}}:{})},provenance:{source:'hallmark_compute',endpoint:'hallmark.ozon.compose',storeId:args.storeId,fetchedAt:lifecycle.cache.fetchedAt}};
 }catch(error){const e=error as Error&{code?:string;retryable?:boolean;retryAfterMs?:number};if(snapshotAccessFailure(e.code??'')&&typeof args.storeId==='string')invalidateStoreSnapshots(store,args.storeId);return {status:e.retryable||e.code==='REPORT_PENDING'?'unavailable':'failed',error:{code:e.code??'COMPOSITION_FAILED',message:e.message,retryable:!!e.retryable||e.code==='REPORT_PENDING',...(e.retryAfterMs?{retryAfterMs:e.retryAfterMs}:{})}};}
}
