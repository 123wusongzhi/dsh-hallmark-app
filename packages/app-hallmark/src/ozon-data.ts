import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonSchema} from '../../app-contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {AdapterResponse,CoreClient,CoreStore,RecordData} from '../../core/src/types.ts';
import {clean} from '../../core/src/types.ts';
import type {PlatformCallInput} from '../../hallmark-adapter/types.ts';
import type {DataSourceDraft,DataSourceParameter} from '../../app-presentation/src/types.ts';
import {OZON_FIELD_META} from './ozon-fields.ts';
import {readCompleteSnapshot,SNAPSHOT_CACHE_SCHEMA,snapshotGeneration,snapshotAccessFailure,invalidateStoreSnapshots} from './snapshot-cache.ts';

export const OZON_KINDS=['products','prices','warehouses','stocks','analytics','orders','weights','finance','promotions','returns'] as const;
export type OzonKind=typeof OZON_KINDS[number];
type Row=Record<string,string|number|null>;
interface SourceSpec {title:string;description:string;fields:string[];parameters?:string[];required?:string[]}
const specs:Record<OzonKind,SourceSpec>={
 products:{title:'商品资料与状态',description:'读取店铺商品资料、平台状态和异常说明。',fields:['productId','offerId','sku','title','image','status','statusCode','statusRaw','errorReason'],parameters:['productId','sku']},
 prices:{title:'商品价格',description:'当前卖家价、普通售价与划线价；币种由平台返回。',fields:['productId','offerId','price','ordinaryPrice','oldPrice','currency'],parameters:['productId']},
 warehouses:{title:'仓库与配送渠道',description:'读取仓库履约方式和对应配送渠道；仓库名称不作为规则。',fields:['warehouseId','warehouseName','fulfillment','status','statusCode','statusRaw','deliveryMethods'],parameters:['warehouseId']},
 stocks:{title:'商品分仓库存',description:'按商品和仓库展示平台库存；缺失的可售或预留数量保持未知。',fields:['productId','sku','offerId','warehouseId','warehouseName','stockPresent','stockReserved','stockAvailable'],parameters:['sku','warehouseId']},
 analytics:{title:'商品流量与订购表现',description:'按 SKU 与日期读取自有商品表现；可选择按商品汇总整个期间。不包含选品数据。日期须截至昨天，最长90天。',fields:['sku','title','date','impressions','views','cartEvents','orderedUnits','visitors'],parameters:['dateFrom','dateTo','groupBy'],required:['dateFrom','dateTo']},
 orders:{title:'订单与发货进度',description:'rFBS/FBS 订单按包裹商品展开；保留商品件数和原币金额。',fields:['orderId','orderNumber','postingNumber','sku','offerId','title','quantity','orderPrice','currency','status','statusCode','statusRaw','createdAt','shipmentAt','trackingNumber'],parameters:['dateFrom','dateTo','postingNumber','status'],required:['dateFrom','dateTo']},
 weights:{title:'物流实重与重量差异',description:'展示已核实单件商品的物流实重与申报重量差异；多件包裹不计入单品实重。',fields:['postingNumber','sku','offerId','quantity','actualWeight','declaredWeight','weightDifference','weightScope','shipmentAt'],parameters:['dateFrom','dateTo'],required:['dateFrom','dateTo']},
 finance:{title:'订单费用与平台记账',description:'逐日读取平台记账记录，保留有符号金额和币种；不当作净利润。',fields:['accrualId','unitNumber','postingNumber','date','accrualType','amount','commission','logisticsFee','feeDetails','currency'],parameters:['dateFrom','dateTo'],required:['dateFrom','dateTo']},
 promotions:{title:'活动商品与活动价格',description:'活动目录及指定活动商品；2026-10-13 协议切换后的兼容性须以实店返回验证。',fields:['actionId','actionName','productId','participation','actionPrice','maxActionPrice','currency','startsAt','endsAt'],parameters:['actionId','participation']},
 returns:{title:'rFBS 退货退款申请',description:'读取 rFBS 售后申请；传入售后单编号可读详情原因。不执行退款或售后处理。',fields:['returnId','postingNumber','orderId','orderNumber','sku','offerId','title','quantity','returnReason','status','statusCode','statusRaw','createdAt','orderPrice','currency'],parameters:['returnId']},
};
const text:JsonSchema={type:'string',minLength:1};
const paramSchemas:Record<string,JsonSchema>={storeId:text,cursor:text,loadAll:{type:'boolean'},forceRefresh:{type:'boolean'},limit:{type:'integer',minimum:1,maximum:100},dateFrom:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},dateTo:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},productId:{type:'string',pattern:'^[1-9][0-9]*$'},sku:{type:'string',pattern:'^[1-9][0-9]*$'},warehouseId:{type:'string',pattern:'^[1-9][0-9]*$'},actionId:{type:'string',pattern:'^[1-9][0-9]*$'},returnId:{type:'string',pattern:'^[1-9][0-9]*$'},postingNumber:text,status:text,participation:{enum:['joined','eligible']},groupBy:{enum:['day','sku']}};
const paramLabels:Record<string,string>={storeId:'店铺',loadAll:'完整快照',cursor:'分页位置',limit:'每页条数',dateFrom:'开始日期',dateTo:'结束日期',productId:'商品编号',sku:'平台 SKU',warehouseId:'仓库编号',actionId:'活动编号',returnId:'售后单编号',postingNumber:'包裹编号',status:'平台状态',participation:'参加状态',groupBy:'统计方式'};
const numberFields=new Set(['price','ordinaryPrice','oldPrice','orderPrice','stockPresent','stockReserved','stockAvailable','impressions','views','cartEvents','orderedUnits','visitors','quantity','actualWeight','declaredWeight','weightDifference','amount','commission','logisticsFee','actionPrice','maxActionPrice']);
export const OZON_DESCRIPTORS:CapabilityDescriptor[]=OZON_KINDS.map(kind=>{
 const spec=specs[kind],parameters=['storeId','limit','cursor','loadAll','forceRefresh',...spec.parameters??[]];
 return {capabilityId:`hallmark.ozon.${kind}`,version:'1.0.0',title:`Ozon ${spec.title}`,description:spec.description,effect:'query',aliases:[],inputSchema:{type:'object',properties:Object.fromEntries(parameters.map(key=>[key,paramSchemas[key]])),required:['storeId',...spec.required??[]],additionalProperties:false},outputSchema:{type:'object',properties:{items:{type:'array',items:{type:'object',properties:Object.fromEntries(spec.fields.map(key=>[key,{type:[numberFields.has(key)?'number':'string','null'],description:OZON_FIELD_META[key].description}])),required:spec.fields,additionalProperties:false}},cursor:text,total:{type:'integer',minimum:0},dataTime:{type:['string','null']},period:{type:'object',properties:{dateFrom:text,dateTo:text},required:['dateFrom','dateTo'],additionalProperties:false},warnings:{type:'array',items:{type:'string'}},cache:SNAPSHOT_CACHE_SCHEMA},required:['items','dataTime','warnings'],additionalProperties:false},execution:{mode:'sync',timeoutMs:60000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:['Ozon','数据源',spec.title]}};
});
export function hallmarkOzonSources(connectionId:string):DataSourceDraft[]{return OZON_KINDS.map(kind=>{
 const spec=specs[kind],parameters:DataSourceParameter[]=['storeId','loadAll',...spec.parameters??[]].map(name=>({name,label:paramLabels[name],type:name==='loadAll'?'boolean':name==='limit'?'integer':'string',...(name==='storeId'?{required:true,editable:false}:{}),...(spec.required?.includes(name)?{required:true}:{}),...(name==='loadAll'?{default:true,editable:false}:{}),...(name==='limit'?{default:20}:{}),...(name==='participation'?{choices:[{label:'已参加',value:'joined'},{label:'可参加',value:'eligible'}]}:{}),...(name==='groupBy'?{choices:[{label:'每日明细',value:'day'},{label:'期间商品合计',value:'sku'}]}:{})}));
 return {id:`hallmark:${connectionId}:ozon:${kind}`,title:`Ozon ${spec.title}`,description:spec.description,appId:'hallmark',connectionId,capabilityId:`hallmark.ozon.${kind}`,capabilityMajor:1,storeScoped:true,input:{loadAll:true},parameters,rowsPath:'items',fields:spec.fields.map(key=>({path:key,role:`ozon.${key}`,confirmed:true,label:OZON_FIELD_META[key].label,description:OZON_FIELD_META[key].description,...(OZON_FIELD_META[key].unit?{unit:OZON_FIELD_META[key].unit}:{}),...(OZON_FIELD_META[key].format==='currency'?{currencyPath:'currency'}:{})})),operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
});}

interface OzonClient extends CoreClient {storeDataRead?:(storeId:string,input:PlatformCallInput)=>Promise<AdapterResponse>;readOrderWeights?:(storeId:string,input:RecordData)=>Promise<AdapterResponse>}
interface Page {items:Row[];next?:RecordData;total?:number;dataTime?:string|null;warnings?:string[]}
interface SavedCursor extends Page {scope:string;expiresAt:number;buffer:Row[];continuation?:RecordData}
const record=(v:unknown):RecordData=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as RecordData:{};
const str=(v:unknown):string|null=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):null;
const num=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const fail=(code:string,message:string):never=>{throw Object.assign(new Error(message),{code});};
const statusLabels:Record<string,Record<string,string>>={products:{'Продается':'在售','Не продается':'暂不可售','На модерации':'审核中','Отклонен':'审核未通过','В архиве':'已归档','Архив':'已归档'},orders:{awaiting_packaging:'待打包',awaiting_deliver:'待交运',delivering:'运输中',delivered:'已送达',cancelled:'已取消',awaiting_registration:'待登记',not_accepted:'未接收',arbitration:'争议处理中',client_arbitration:'买家争议处理中',driver_pickup:'司机揽收中'},warehouses:{working:'正常工作',disabled:'已停用',ACTIVE:'已启用',DISABLED:'已停用'},returns:{Utilizing:'销毁处理中',Utilized:'已销毁'}};
function statusFields(kind:string,code:unknown,raw:unknown=code):RecordData{const statusCode=str(code),statusRaw=str(raw),label=statusLabels[kind]?.[statusCode??'']??statusLabels[kind]?.[statusRaw??''];return {status:label??(statusRaw||statusCode?`未映射：${statusRaw??statusCode}`:null),statusCode,statusRaw};}
function array(v:unknown,label:string):RecordData[]{if(!Array.isArray(v)||v.some(row=>!row||typeof row!=='object'||Array.isArray(row)))fail('OZON_RESPONSE_INVALID',`${label} 缺少有效列表；不将未知响应当作无数据。`);return v as RecordData[];}
function rowsAt(raw:RecordData,...paths:string[]):RecordData[]{for(const path of paths){let value:unknown=raw;for(const key of path.split('.'))value=record(value)[key];if(Array.isArray(value))return array(value,path);}return fail('OZON_RESPONSE_INVALID',`Ozon 响应未包含 ${paths.join('/')}。`);}
function monetary(v:unknown):{amount:number|null;currency:string|null}{const r=record(v);return {amount:num(r.amount??v),currency:str(r.currency??r.currency_code)};}
function normalized(kind:OzonKind,row:RecordData):Row{return Object.fromEntries(specs[kind].fields.map(key=>[key,(numberFields.has(key)?num(row[key]):str(row[key]))??null]));}
function dateRange(args:RecordData,kind:OzonKind):void {if(!specs[kind].required?.includes('dateFrom'))return;const from=Date.parse(`${args.dateFrom}T00:00:00Z`),to=Date.parse(`${args.dateTo}T00:00:00Z`);if(!Number.isFinite(from)||!Number.isFinite(to)||new Date(from).toISOString().slice(0,10)!==args.dateFrom||new Date(to).toISOString().slice(0,10)!==args.dateTo||from>to||to-from>89*86400000)fail('INVALID_DATE_RANGE','请选择真实且前后顺序正确的日期，最多90天。');if(kind==='analytics'&&args.dateTo>=new Date().toISOString().slice(0,10))fail('ANALYTICS_DATE_RANGE','流量数据只能查询截至昨天的完整日期。');}
function nextToken(raw:RecordData,state:RecordData,rows:RecordData[],limit:number,key='last_id'):RecordData|undefined {
 const envelope=record(raw.result),next=raw[key]??envelope[key],has=raw.has_next??envelope.has_next,total=num(raw.total_items??envelope.total_items??raw.total??envelope.total),seen=(state.seen??0)+rows.length;
 if(has===false||rows.length===0||total!==null&&seen>=total)return undefined;
 if(next===''&&has!==true&&(total===null||seen>=total))return undefined;
 if(next!==undefined&&next!==null&&String(next)!==''){if(String(next)===String(state.after??''))fail('OZON_PAGINATION_STALLED','平台重复返回相同分页位置。');return {after:String(next),seen};}
 if(has===true||rows.length>=limit||total!==null&&seen<total)fail('OZON_PAGINATION_MISSING','平台返回完整页但缺少继续分页的位置。');return undefined;
}

/** New business reads never create or reuse an unrelated listing task. */
export async function readOzonData(kind:OzonKind,args:RecordData,store:CoreStore,client:OzonClient,signal?:AbortSignal):Promise<ToolResult>{
 if(args.loadAll===true){
  if(typeof args.storeId!=='string'||!args.storeId||args.cursor!==undefined||args.forceRefresh!==undefined&&typeof args.forceRefresh!=='boolean')return {status:'failed',error:{code:'INVALID_FULL_READ',message:'完整读取需要店铺，不使用分页位置，刷新标记须为布尔值。',retryable:false}};
  const {forceRefresh,loadAll,limit,...filters}=args;
  return readCompleteSnapshot({store,storeId:args.storeId,scope:{kind:`ozon:${kind}`,input:filters},force:forceRefresh===true,build:async()=>{
   const items:Row[]=[],warnings=new Set<string>(),times=new Set<string>();let cursor:string|undefined,unknownTime=false,pages=0,first:ToolResult|undefined;const cursors=new Set<string>();
   do{
    if(++pages>1000||items.length>100000)return {status:'failed',error:{code:'OZON_FULL_READ_LIMIT',message:'数据超出完整读取上限，请缩小日期范围；保留上次完整快照。',retryable:false}};
    const response=await readOzonDataPage(kind,{...filters,limit:100,...(cursor?{cursor}:{})},store,client);if(response.status!=='ok')return response;first??=response;
    const payload=record(response.data);items.push(...payload.items);for(const warning of payload.warnings??[])warnings.add(warning);if(typeof payload.dataTime==='string')times.add(payload.dataTime);else unknownTime=true;
    cursor=typeof payload.cursor==='string'?payload.cursor:undefined;if(cursor){if(cursors.has(cursor))return {status:'failed',error:{code:'OZON_PAGINATION_STALLED',message:'数据分页重复，保留上次完整快照。',retryable:false}};cursors.add(cursor);}
   }while(cursor);
   return {...first!,data:{items,total:items.length,dataTime:!unknownTime&&times.size===1?[...times][0]:null,warnings:[...warnings],...(args.dateFrom?{period:{dateFrom:args.dateFrom,dateTo:args.dateTo}}:{})}};
  }});
 }
 return readOzonDataPage(kind,args,store,client,signal);
}
async function readOzonDataPage(kind:OzonKind,args:RecordData,store:CoreStore,client:OzonClient,signal?:AbortSignal):Promise<ToolResult>{
 try {
  if(typeof args.storeId!=='string'||!args.storeId)fail('STORE_REQUIRED','请在工作台选择店铺。');dateRange(args,kind);
  const limit=args.limit??20,{cursor,...filters}=args,scope=createHash('sha256').update(canonicalJson({kind,generation:snapshotGeneration(store,args.storeId),filters:{...filters,limit}})).digest('hex');
  let page:Page;
  if(cursor){const saved=store.get<SavedCursor>('ozon_read_cursors',cursor);if(!saved||saved.scope!==scope||saved.expiresAt<Date.now())throw Object.assign(new Error('分页已过期或不属于当前店铺和筛选条件，请从第一页读取。'),{code:'INVALID_CURSOR'});page=saved.buffer.length?{...saved,items:saved.buffer,next:saved.continuation}:await fetchPage(kind,args,saved.continuation??{},client,signal);}
  else {let initial:RecordData={};if(kind==='weights'){const previous=store.get<RecordData>('ozon_weight_queries',scope);const requestId=previous&&previous.expiresAt>Date.now()?previous.requestId:randomUUID();store.put('ozon_weight_queries',scope,{requestId,expiresAt:Date.now()+3600000});initial={requestId};}page=await fetchPage(kind,args,initial,client,signal);}
  const items=page.items.slice(0,limit),buffer=page.items.slice(limit);let next:string|undefined;
  if(buffer.length||page.next){next=`ozon:${randomUUID()}`;store.put<SavedCursor>('ozon_read_cursors',next,clean({...page,items:[],scope,expiresAt:Date.now()+3600000,buffer,continuation:page.next}));}
  const zonedTime=page.dataTime&&/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(page.dataTime)?page.dataTime:undefined;
  return {status:'ok',data:{items,...(next?{cursor:next}:{}),...(page.total!==undefined?{total:page.total}:{}),dataTime:page.dataTime??null,warnings:[...page.warnings??[],...(page.dataTime&&!zonedTime?['平台数据更新时间未提供明确时区；保留原值，不推测时区。']:[])],...(args.dateFrom?{period:{dateFrom:args.dateFrom,dateTo:args.dateTo}}:{})},provenance:{source:'ozon_api',endpoint:`hallmark.ozon.${kind}`,storeId:args.storeId,fetchedAt:new Date().toISOString(),...(zonedTime?{dataTime:zonedTime}:{})}};
 }catch(error){const e=error as Error&{code?:string;retryable?:boolean;retryAfterMs?:number};if(snapshotAccessFailure(e.code??'')&&typeof args.storeId==='string')invalidateStoreSnapshots(store,args.storeId);return {status:e.code==='REPORT_PENDING'||e.retryable?'unavailable':'failed',error:{code:e.code??'OZON_QUERY_FAILED',message:e.message,retryable:e.code==='REPORT_PENDING'||(e.retryable??false),...(e.retryAfterMs!==undefined?{retryAfterMs:e.retryAfterMs}:{})}};}
}
async function fetchPage(kind:OzonKind,args:RecordData,state:RecordData,client:OzonClient,signal?:AbortSignal):Promise<Page>{
 const limit=args.limit??20;
 const read=async(path:string,body:RecordData={},method:'GET'|'POST'='POST'):Promise<RecordData>=>{
  if(signal?.aborted)fail('ABORTED','调用已取消。');if(!client.storeDataRead)fail('STORE_DATA_GATEWAY_UNAVAILABLE','连接尚未提供店铺数据读取网关。');
  const response=await client.storeDataRead!(args.storeId,{path,method,body,requestId:randomUUID(),agentId:'dsh-hallmark-app'});
  const receipt=record(response.raw);if(receipt.storeId!==undefined&&receipt.storeId!==args.storeId)fail('OZON_STORE_MISMATCH','读取回执店铺不匹配。');
  if(receipt.httpStatus===401||receipt.httpStatus===403)fail(`OZON_HTTP_${receipt.httpStatus}`,'店铺授权无法读取数据，请检查授权。');
  if(receipt.outcome==='response_received'&&(receipt.httpStatus===429||receipt.httpStatus===408||receipt.httpStatus>=500))throw Object.assign(new Error(`Ozon 暂时返回 HTTP ${receipt.httpStatus}，稍后重试。`),{code:receipt.httpStatus===429?'LOCAL_RATE_LIMIT':'OZON_UPSTREAM_UNAVAILABLE',retryable:true,retryAfterMs:response.error?.retryAfterMs??(receipt.httpStatus===429?60000:5000)});
  if(response.status!=='ok')throw Object.assign(new Error(response.error?.message??'店铺读取失败。'),response.error,{retryable:response.status==='unavailable'||response.status==='unknown'});
  if(receipt.outcome!=='response_received'||typeof receipt.httpStatus!=='number')fail('OZON_OUTCOME_UNKNOWN','平台读取没有完整回执，请稍后查询。');
  if(receipt.httpStatus<200||receipt.httpStatus>=300)fail('OZON_UPSTREAM_ERROR',`Ozon 返回 HTTP ${receipt.httpStatus}，请检查店铺权限和参数。`);
  if(!receipt.response||typeof receipt.response!=='object')fail('OZON_RESPONSE_INVALID','Ozon 没有返回 JSON 数据。');return record(receipt.response);
 };
 if(kind==='products'){
  let ids:string[]=[],next:RecordData|undefined,total:number|undefined;
  if(args.productId)ids=[args.productId];
  else if(!args.sku){const raw=await read('/v3/product/list',{filter:{visibility:'ALL'},limit,last_id:state.after??''}),rows=rowsAt(raw,'result.items','items');ids=rows.map(r=>str(r.product_id)).filter((id):id is string=>!!id);if(ids.length!==rows.length)fail('OZON_RESPONSE_INVALID','商品清单缺少商品编号。');next=nextToken(raw,state,rows,limit);total=num(raw.result?.total_items??raw.total_items??raw.result?.total??raw.total)??undefined;}
  if(!ids.length&&!args.sku)return {items:[],total:0};
  const raw=await read('/v3/product/info/list',args.sku?{sku:[args.sku]}:{product_id:ids}),rows=rowsAt(raw,'items','result.items');
  if(ids.length&&(rows.length!==ids.length||new Set(rows.map(row=>str(row.id))).size!==ids.length||rows.some(row=>!ids.includes(str(row.id)??''))))fail('OZON_PRODUCT_JOIN_INCOMPLETE','商品详情与清单编号不一致，请刷新后重试。');
  return {items:rows.map(r=>normalized(kind,{productId:r.id,offerId:r.offer_id,sku:r.sku,title:r.name,image:Array.isArray(r.primary_image)?r.primary_image[0]:r.primary_image??r.images?.[0],...statusFields(kind,r.statuses?.status,r.statuses?.status_name),errorReason:Array.isArray(r.errors)?r.errors.map((e:RecordData)=>e.message??e.description??e.code).filter(Boolean).join('；')||null:r.statuses?.status_description})),next,total};
 }
 if(kind==='prices'){
  const raw=await read('/v5/product/info/prices',{filter:{visibility:'ALL',...(args.productId?{product_id:[args.productId]}:{})},limit,cursor:state.after??''}),rows=rowsAt(raw,'items','result.items');
  return {items:rows.map(r=>normalized(kind,{productId:r.product_id,offerId:r.offer_id,price:r.price?.marketing_seller_price,ordinaryPrice:r.price?.price,oldPrice:r.price?.old_price,currency:r.price?.currency_code})),next:nextToken(raw,state,rows,limit,'cursor'),total:num(raw.total_items??raw.result?.total_items??raw.total??raw.result?.total)??undefined};
 }
 if(kind==='warehouses'){
  const raw=await read('/v2/warehouse/list',{limit:100,offset:state.offset??0}),rows=rowsAt(raw,'result','result.warehouses','warehouses'),selected=rows.filter(r=>!args.warehouseId||String(r.warehouse_id)===args.warehouseId),items:Row[]=[];
  for(const row of selected){const methods:RecordData[]=[];for(let offset=0;;offset+=100){const data=await read('/v2/delivery-method/list',{filter:{warehouse_id:Number(row.warehouse_id)},limit:100,offset}),batch=rowsAt(data,'result','result.delivery_methods','delivery_methods');methods.push(...batch);if(batch.length<100)break;if(offset>=9900)fail('OZON_PAGINATION_LIMIT','配送渠道超过读取上限，未返回截断结果。');}items.push(normalized(kind,{warehouseId:row.warehouse_id,warehouseName:row.name,fulfillment:row.is_rfbs===true?'rFBS':row.is_rfbs===false?'FBS':null,...statusFields(kind,row.status),deliveryMethods:methods.map(m=>[m.name,statusFields('warehouses',m.status).status].filter(Boolean).join(' · ')).join('；')||null}));}
  return {items,...(rows.length===100?{next:{offset:(state.offset??0)+100}}:{})};
 }
 if(kind==='stocks'){
  let skus:string[]=state.skus??(args.sku?[args.sku]:[]),productAfter=state.productAfter,nextProducts:RecordData|undefined;const missing:Row[]=[];
  if(!skus.length){const list=await read('/v3/product/list',{filter:{visibility:'ALL'},limit:100,last_id:productAfter??''}),products=rowsAt(list,'result.items','items');if(!products.length)return {items:[]};const info=await read('/v3/product/info/list',{product_id:products.map(r=>String(r.product_id))}),details=rowsAt(info,'items','result.items');if(details.length!==products.length||details.some(r=>!products.some(p=>String(p.product_id)===String(r.id))))fail('OZON_PRODUCT_JOIN_INCOMPLETE','库存商品与详情编号对应不完整。');skus=details.map(r=>str(r.sku)).filter((sku):sku is string=>!!sku&&/^[1-9][0-9]*$/.test(sku));for(const r of details.filter(r=>!str(r.sku)||!skus.includes(String(r.sku))))missing.push(normalized(kind,{productId:r.id,offerId:r.offer_id}));nextProducts=nextToken(list,{after:productAfter},products,100);productAfter=nextProducts?.after;}
  else nextProducts=state.nextProducts;
  const raw=skus.length?await read('/v2/product/info/stocks-by-warehouse/fbs',{sku:skus,limit:1000,...(state.after?{cursor:state.after}:{})}):{products:[],has_next:false},rows=rowsAt(raw,'products','result','items','result.items'),nextStocks=nextToken(raw,state,rows,1000,'cursor');
  return {items:[...rows.filter(r=>!args.warehouseId||String(r.warehouse_id)===args.warehouseId).map(r=>normalized(kind,{productId:r.product_id,sku:r.sku,offerId:r.offer_id,warehouseId:r.warehouse_id,warehouseName:r.warehouse_name,stockPresent:r.present,stockReserved:r.reserved??r.reserved_stock,stockAvailable:r.free_stock??r.available})),...missing],...(nextStocks?{next:{...nextStocks,skus,productAfter,nextProducts}}:nextProducts?{next:{productAfter}}:{}),warnings:missing.length?[`当前商品批次有 ${missing.length} 个商品尚无有效平台 SKU，保留商品身份，库存保持未知。`]:[]};
 }
 if(kind==='analytics'){
  const aggregate=args.groupBy==='sku',dimensions=aggregate?['sku']:['sku','day'],fetchLimit=aggregate?1000:limit;
  const metrics=['hits_view_search','hits_view_pdp','hits_tocart','ordered_units','session_view_pdp'],raw=await read('/v1/analytics/data',{date_from:args.dateFrom,date_to:args.dateTo,dimension:dimensions,metrics,filters:[],sort:[],limit:fetchLimit,offset:state.offset??0}),rows=rowsAt(raw,'result.data');
  const items=rows.map(r=>{if(!Array.isArray(r.dimensions)||r.dimensions.length!==dimensions.length||!Array.isArray(r.metrics)||r.metrics.length!==metrics.length)fail('OZON_RESPONSE_INVALID','流量指标数量或维度不一致。');return normalized(kind,{sku:r.dimensions[0].id,title:r.dimensions[0].name,date:aggregate?null:r.dimensions[1].id,impressions:r.metrics[0],views:r.metrics[1],cartEvents:r.metrics[2],orderedUnits:r.metrics[3],visitors:r.metrics[4]});});
  return {items,dataTime:str(raw.timestamp),...(aggregate?{warnings:['流量由平台按商品汇总所选期间；单日日期为空，时间范围见 period。']}:{}),...(rows.length===fetchLimit?{next:{offset:(state.offset??0)+fetchLimit}}:{})};
 }
 if(kind==='orders'){
  const raw=await read(args.postingNumber?'/v3/posting/fbs/get':'/v4/posting/fbs/list',args.postingNumber?{posting_number:args.postingNumber,with:{analytics_data:true,financial_data:true}}:{dir:'ASC',filter:{since:`${args.dateFrom}T00:00:00Z`,to:`${args.dateTo}T23:59:59Z`,...(args.status?{status:args.status}:{})},limit,offset:state.offset??0,with:{analytics_data:true,financial_data:true}}),rows=args.postingNumber?[record(raw.result)]:rowsAt(raw,'postings','result.postings'),items:Row[]=[];
  for(const r of rows){const products=array(r.products,'订单商品');for(const p of products)items.push(normalized(kind,{orderId:r.order_id,orderNumber:r.order_number,postingNumber:r.posting_number,sku:p.sku,offerId:p.offer_id,title:p.name,quantity:p.quantity,orderPrice:monetary(p.price).amount,currency:monetary(p.price).currency??p.currency_code,...statusFields(kind,r.status),createdAt:r.in_process_at??r.created_at,shipmentAt:r.shipment_date,trackingNumber:r.tracking_number}));}
  const has=raw.has_next??raw.result?.has_next;
  return {items,...(!args.postingNumber&&(has===true||has===undefined&&rows.length===limit)?{next:{offset:(state.offset??0)+rows.length}}:{})};
 }
 if(kind==='weights'){
  if(!client.readOrderWeights)fail('ORDER_WEIGHT_QUERY_UNAVAILABLE','连接尚未提供物流实重只读查询。');
  const response=await client.readOrderWeights!(args.storeId,{dateFrom:args.dateFrom,dateTo:args.dateTo,requestId:state.requestId,agentId:'dsh-hallmark-app'});
  if(response.status!=='ok')throw Object.assign(new Error(response.error?.message??'物流实重查询失败。'),response.error);
  const raw=record(response.raw);if(raw.storeId!==args.storeId)fail('OZON_STORE_MISMATCH','物流实重返回店铺不匹配。');if(raw.status==='pending')fail('REPORT_PENDING','物流报告正在生成，请稍后刷新；将继续查询同一报告。');if(raw.status!=='ready')fail('OZON_RESPONSE_INVALID','物流报告状态无法识别。');
  const items=rowsAt(raw,'items').map(r=>normalized(kind,{postingNumber:r.postingNumber,sku:r.sku,offerId:r.offerId,quantity:1,shipmentAt:r.shipmentAt,actualWeight:r.grams,declaredWeight:r.declaredGrams,weightDifference:r.grams!=null&&r.declaredGrams!=null?num(r.grams)!-num(r.declaredGrams)!:null,weightScope:'已核实单 SKU 单件'}));return {items,total:items.length,dataTime:null,warnings:['仅返回报告中已核实的单 SKU 单件包裹实重；多件、混装及未知重量不作为单品实重。',...(Array.isArray(raw.skipped)&&raw.skipped.length?[`报告有 ${raw.skipped.length} 条不满足单件实重条件的记录。`]:[])]};
 }
 if(kind==='finance'){
  const day=state.day??args.dateFrom,raw=await read('/v1/finance/accrual/by-day',{date:day,last_id:state.after??'',limit}),rows=rowsAt(raw,'accruals','result.accruals'),next=nextToken(raw,state,rows,limit),tomorrow=new Date(Date.parse(`${day}T00:00:00Z`)+86400000).toISOString().slice(0,10);
  const items=rows.map(r=>{
   const total=monetary(r.total_amount??r.amount),currency=total.currency??str(r.currency_code??r.currency),products=Array.isArray(r.posting?.products)?r.posting.products:[],commissions=products.map((p:RecordData)=>monetary(p.commission?.commission)),commission=commissions.length&&commissions.every((m:{amount:number|null;currency:string|null})=>m.amount!==null&&m.currency===currency)?Number(commissions.reduce((sum:number,m:{amount:number})=>sum+m.amount,0).toFixed(6)):num(r.commission);
   const fees:RecordData[]=[...(Array.isArray(r.item_fees?.fees)?r.item_fees.fees.flatMap((p:RecordData)=>Array.isArray(p.fees)?p.fees:[]):[]),...(r.non_item_fee?[r.non_item_fee]:[])],feeDetails=fees.map(f=>{const amount=monetary(f.accrued);return `费用类型 ${str(f.type_id)??'未知'}：${amount.amount??'未知'} ${amount.currency??'币种未知'}`;}).join('；')||null;
   const categories:Record<string,string>={POSTING:'包裹记账',ITEM:'商品费用',NON_ITEM:'其他费用',CONTAINER:'容器费用'},category=str(r.accrued_category);
   return normalized(kind,{accrualId:r.accrual_id??r.id,unitNumber:r.unit_number,postingNumber:r.posting?.posting_number??r.posting_number??(category==='POSTING'?r.unit_number:null),date:r.date??day,accrualType:categories[category??'']??r.accrual_type??r.type??category,amount:total.amount,currency,commission,logisticsFee:r.logistics_fee,feeDetails});
  });
  return {items,...(next?{next:{...next,day}}:tomorrow<=args.dateTo?{next:{day:tomorrow}}:{}),warnings:['平台记账金额不等于净利润；未明确提供的费用拆项保持未知。']};
 }
 if(kind==='promotions'){
  const warnings=['活动协议在2026-10-13切换；本接口保留平台真实响应，错误不视作无活动。'];
  if(!args.actionId){const raw=await read('/v1/actions',{},'GET'),rows=rowsAt(raw,'result','actions');return {items:rows.map(r=>normalized(kind,{actionId:r.id,actionName:r.title??r.name,startsAt:r.date_start,endsAt:r.date_end})),total:rows.length,warnings};}
  const raw=await read(args.participation==='eligible'?'/v2/actions/candidates':'/v2/actions/products',{action_id:Number(args.actionId),limit,...(state.after?{last_id:state.after}:{})}),rows=rowsAt(raw,'products','result.products');
  return {items:rows.map(r=>{const price=monetary(r.action_price),max=monetary(r.max_action_price);return normalized(kind,{actionId:args.actionId,productId:r.id,participation:args.participation==='eligible'?'可参加':'已参加',actionPrice:price.amount,maxActionPrice:max.amount,currency:price.currency??max.currency});}),next:nextToken(raw,state,rows,limit),total:num(raw.total_items??raw.result?.total_items??raw.total??raw.result?.total)??undefined,warnings};
 }
 const raw=await read(args.returnId?'/v2/returns/rfbs/get':'/v2/returns/rfbs/list',args.returnId?{return_id:Number(args.returnId)}:{filter:{},limit,last_id:state.after??0}),rows=args.returnId?[record(raw.returns??raw.return??raw.result)]:rowsAt(raw,'returns','result.returns');
 if(args.returnId&&!rows[0]?.posting_number)fail('OZON_RESPONSE_INVALID','售后详情缺少包裹标识，无法核对返回。');
 // rFBS returns list does not echo a cursor; the last return_id is its request continuation.
 let next:RecordData|undefined;if(!args.returnId&&rows.length===limit){const after=str(rows.at(-1)?.return_id);if(!after||after===String(state.after??''))fail('OZON_PAGINATION_STALLED','售后分页缺少新的售后单编号。');next={after};}
 return {items:rows.map(r=>{const p=record(r.product);return normalized(kind,{returnId:r.id??r.return_id??args.returnId,postingNumber:r.posting_number,orderId:r.order_id,orderNumber:r.order_number,sku:p.sku,offerId:p.offer_id,title:p.name,quantity:p.quantity??r.quantity,returnReason:r.return_reason_name??r.return_reason?.name??r.reason?.name,...statusFields(kind,r.state?.state??r.state,r.state?.name??r.state?.state_name??r.state),createdAt:r.created_at,orderPrice:monetary(p.price).amount,currency:monetary(p.price).currency??p.currency_code});}),...(next?{next}:{})};
}
