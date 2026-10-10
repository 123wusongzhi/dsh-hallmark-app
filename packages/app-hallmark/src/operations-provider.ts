import type {CapabilityDescriptor,CapabilityResult,ExecutionContext,JsonSchema,JsonValue} from '../../app-contracts/src/index.ts';
import type {CoreStore,CoreClient,RecordData} from '../../core/src/types.ts';
import {BusinessOperations} from './operations/index.ts';
import type {BusinessPlan,BusinessRowInput} from './operations/types.ts';

const text:JsonSchema={type:'string',minLength:1};
const object:JsonSchema={type:'object',additionalProperties:true};
const target:JsonSchema={type:'object',properties:{offerId:text,productId:{type:['string','number']},sku:{type:['string','number']}},required:['offerId'],additionalProperties:false};
const procurement:JsonSchema={type:'array',items:{type:'object',properties:{itemId:text,sourceSkuId:text,quantity:{type:'number',exclusiveMinimum:0}},required:['itemId','sourceSkuId','quantity'],additionalProperties:false}};
const referenceSubjects:JsonSchema={type:'array',maxItems:8,items:{type:'object',properties:{sourceImageUrl:text,subject:{type:'string',minLength:1,maxLength:500}},required:['sourceImageUrl','subject'],additionalProperties:false}};
const row:JsonSchema={type:'object',properties:{rowId:text,action:{enum:['price','stock','archive','promotion.enroll','promotion.update','promotion.exit','listing']},target,payload:object,procurement,referenceSubjects,pricing:{type:'object',properties:{planId:text,mode:{enum:['automatic','manual']}},required:['mode'],additionalProperties:false},dependsOn:{type:'array',items:text}},required:['action','target','payload'],additionalProperties:false};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',properties,required,additionalProperties:false});
const inputs:Record<string,JsonSchema>={
 create:schema({storeId:text,title:text,rows:{type:'array',items:row,minItems:1,maxItems:200}},['storeId','rows']),
 revise:schema({planId:text,expectedRevision:{type:'integer',minimum:1},rows:{type:'array',items:row,minItems:1,maxItems:200}},['planId','expectedRevision','rows']),
 get:{...schema({planId:text,operationId:text,includeEvidence:{type:'boolean'},rowIds:{type:'array',items:text,minItems:1},cursor:{type:'string',pattern:'^(0|[1-9][0-9]*)$'},limit:{type:'integer',minimum:1,maximum:200}},[]),oneOf:[{required:['planId'],not:{required:['operationId']}},{required:['operationId'],not:{required:['planId']}}]},
 list:schema({storeId:text},[]),
 submit:schema({planId:text,expectedRevision:{type:'integer',minimum:1}},['planId','expectedRevision']),
 inspect:schema({planId:text},['planId']),
 restore:schema({planId:text,rowIds:{type:'array',items:text,minItems:1}},['planId']),
};
const titles:Record<string,string>={create:'创建经营草稿',revise:'修改经营草稿',get:'读取经营变更单',list:'经营变更记录',submit:'审核并提交经营变更',inspect:'核查原经营请求',restore:'恢复经营变更'};
const descriptions:Record<string,string>={
 create:'保存一张经营操作表，不触发模型或平台提交。程序读取原商品与采购SKU、绑定组成并补齐确定性数据。payload填写一次：价格 price/currency_code；库存 stock/warehouse_id；归档 archived；活动 action_id/price/stock（活动配额）；listing为原生Ozon item。上品procurement引用完整来源itemId/sourceSkuId及quantity。多主体参考图可在行级referenceSubjects填写真实sourceImageUrl和主体位置，例如“左侧银色贴片”；单一明确主体可省略。它只指定比较对象，不手填采购价或审核声明。',
 revise:'按稳定rowId修改尚未执行的行，程序更新版本和受影响的审核依赖。rows每项提供完整目标行；成功或未决行不可改写。草稿保存不调用模型。',
 get:'读取一张经营变更单，或凭原runtime operationId找到它。默认精简表格；includeEvidence可读取完整来源和审核证据，不执行平台写入。',
 list:'列出此连接（可筛选店铺）的经营操作记录，包含逐行价格、采购关联、审核问题和执行状态。',
 submit:'明确提交当前草稿版本。规则可确定的直接执行；图文/语义由独立模型审核，必要时Host启动独立子代理。通过行自动执行。缺事实只返回具体字段问题；无需userRequest/valueSource/scopeConfirmed或已审阅声明。程序负责行级幂等；pending/unknown仅inspect，勿另建同目标重复操作。',
 inspect:'只读核查原请求、异步导入及实际价格等结果，更新逐行状态；不重新发送未决平台请求。',
 restore:'根据已成功变更生成反向单并通过同一审核入口执行。先比较当前值是否仍为原写入值，有冲突不覆盖。库存须单独确定新目标；新上品通过归档恢复。',
};
function descriptor(operation:string,prefix='hallmark.plan'):CapabilityDescriptor{
 const mutation=['submit','restore'].includes(operation),query=['get','list','inspect'].includes(operation);
 return {capabilityId:`${prefix}.${operation}`,version:'1.0.0',title:titles[operation],description:descriptions[operation],effect:mutation?'mutation':query?'query':'compute',inputSchema:inputs[operation],outputSchema:object,execution:{mode:mutation?'async':'sync',timeoutMs:mutation?900000:90000,concurrency:query?'declared_safe':'exclusive',lockScope:mutation||['get','list'].includes(operation)?'resources':'connection',idempotency:mutation?'upstream_supported':'not_applicable',completionEvidence:mutation?'readback':'response'},discovery:{defaultVisible:false,keywords:['ozon','经营','上品','调价','库存','归档','促销','草稿',operation]},aliases:[]};
}
export const BUSINESS_PRICING_DESCRIPTORS:readonly CapabilityDescriptor[]=[
 {capabilityId:'hallmark.pricing.read',version:'1.0.0',title:'读取经营规则',description:'读取经营应用保存的物流渠道报价、默认方案、目标利润与实际硬底线。不会返回店铺凭据。',effect:'query',inputSchema:schema({storeId:text},['storeId']),outputSchema:object,execution:{mode:'sync',timeoutMs:30000,concurrency:'declared_safe',lockScope:'resources',idempotency:'not_applicable',completionEvidence:'response'},aliases:[],discovery:{defaultVisible:true,keywords:['物流','定价','利润','经营规则']}},
 {capabilityId:'hallmark.pricing.quote',version:'1.0.0',title:'按采购与物流规则试算',description:'按经营行读取真实采购组成与成本、包装重量和店铺规则，返回建议售价、费用明细和阻塞字段。自动按本次售价和重量匹配物流方案，重叠取总费用最高；planId仅用于旧固定方案兼容模式。不会提交平台。',effect:'compute',inputSchema:schema({storeId:text,row},['storeId','row']),outputSchema:object,execution:{mode:'sync',timeoutMs:90000,concurrency:'declared_safe',lockScope:'resources',idempotency:'not_applicable',completionEvidence:'response'},aliases:[],discovery:{defaultVisible:false,keywords:['物流','报价','试算','定价']}}
];
export const BUSINESS_DESCRIPTORS:readonly CapabilityDescriptor[]=[...Object.keys(inputs).map(operation=>descriptor(operation)),...['create','revise','get','submit'].map(operation=>descriptor(operation,'hallmark.listing.draft'))];
export const businessOperation=(id:string):string|undefined=>id.startsWith('hallmark.plan.')?id.slice('hallmark.plan.'.length):id.startsWith('hallmark.listing.draft.')?id.slice('hallmark.listing.draft.'.length):undefined;
export const legacyBusinessKind=(id:string)=>id==='hallmark.products.update_price'||id==='hallmark.api.products.update_price'?'price':id==='hallmark.products.update_stock'?'stock':id==='hallmark.products.list_product'?'listing':undefined;
export function publicPlan(plan:BusinessPlan,includeEvidence=false):JsonValue {
 if(includeEvidence)return JSON.parse(JSON.stringify(plan));
 return JSON.parse(JSON.stringify({...plan,rows:plan.rows.map(({context,repairHistory,beforeHash,...row})=>({...row,...(context?.pricingQuote?{pricingQuote:context.pricingQuote}:{}),receipt:row.receipt?{executionId:(row.receipt as RecordData).executionId,requestId:(row.receipt as RecordData).requestId,taskId:(row.receipt as RecordData).taskId,transport:(row.receipt as RecordData).transport,importTaskId:(row.receipt as RecordData).importTaskId,completion:(row.receipt as RecordData).completion,observed:(row.receipt as RecordData).observed,product:(row.receipt as RecordData).product?{id:(row.receipt as RecordData).product.id,sku:(row.receipt as RecordData).product.sku,statuses:(row.receipt as RecordData).product.statuses,is_archived:(row.receipt as RecordData).product.is_archived}:undefined}:undefined}))}));
}
export function businessResult(plan:BusinessPlan,context:ExecutionContext):CapabilityResult {
 const authorized=(row:BusinessPlan['rows'][number])=>plan.submitted?.rowRevisions[row.rowId]===row.revision;
 const willProgress=(row:BusinessPlan['rows'][number],seen=new Set<string>()):boolean=>{
  if(seen.has(row.rowId))return false;seen.add(row.rowId);
  if(['succeeded','dispatching','pending','unknown'].includes(row.status))return true;
  if(!authorized(row))return false;
  if(row.status==='rejected'&&row.retryAt&&row.issues.some(issue=>issue.code==='OZON_RATE_LIMIT'||row.action==='stock'&&issue.code==='PRODUCT_IS_NOT_CREATED'))return true;
  return row.status==='blocked'&&!!row.dependsOn?.length&&row.issues.length>0&&row.issues.every(issue=>issue.code==='DEPENDENCY_PENDING')&&row.dependsOn.every(id=>{const dependency=plan.rows.find(candidate=>candidate.rowId===id);return !!dependency&&willProgress(dependency,new Set(seen));});
 };
 const base={invocationId:context.request.invocationId,traceId:context.request.traceId},data=publicPlan(plan),unresolved=plan.rows.some(r=>['dispatching','pending','unknown'].includes(r.status)||r.status!=='succeeded'&&willProgress(r));
 if(context.operationId&&unresolved){
  if(plan.rows.some(r=>r.status==='unknown'))return {...base,status:'unknown',operation:{operationId:context.operationId,state:'unknown'},error:{code:'BUSINESS_OUTCOME_UNKNOWN',message:'部分平台请求结果尚未核实；按原 operationId/planId 查询，不要重复提交。',retryPolicy:'inspect_only',details:{planId:plan.planId}}};
  return {...base,status:'pending',operation:{operationId:context.operationId,state:'pending'},pollAfterMs:5000};
 }
 if(plan.rows.some(r=>r.status==='succeeded')&&plan.rows.some(r=>r.status!=='succeeded'))return {...base,status:'partial',data,errors:[{code:'BUSINESS_PARTIAL',message:'已完成的商品不会重发，其余商品的问题见表格。',retryPolicy:'never'}]};
 return {...base,status:'ok',data};
}
function link(store:CoreStore,context:ExecutionContext,planId:string):void {if(context.operationId)store.put('business_runtime_operations',context.operationId,{operationId:context.operationId,planId,sessionId:'sessionId'in context.request.source?context.request.source.sessionId:null});}
export async function executeBusiness(operations:BusinessOperations,store:CoreStore,context:ExecutionContext):Promise<CapabilityResult>{
 const args=context.request.input as RecordData,operation=businessOperation(context.request.capabilityId)!,base={invocationId:context.request.invocationId,traceId:context.request.traceId};
 try{
  if(operation==='list')return {...base,status:'ok',data:{plans:operations.list(args.storeId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>publicPlan(p)),total:operations.list(args.storeId).length}};
  if(operation==='get'){
   const planId=args.planId??store.get<RecordData>('business_runtime_operations',args.operationId)?.planId;if(!planId)throw new Error('BUSINESS_PLAN_NOT_FOUND');
   const plan=operations.get(planId);
   if(args.cursor===undefined&&args.limit===undefined&&args.rowIds===undefined)return {...base,status:'ok',data:publicPlan(plan,args.includeEvidence===true)};
   const rows=args.rowIds?plan.rows.filter(row=>args.rowIds.includes(row.rowId)):plan.rows,offset=Number(args.cursor??0),limit=Number(args.limit??50);
   if(!Number.isSafeInteger(offset)||offset<0||offset>rows.length||!Number.isInteger(limit)||limit<1||limit>200)throw new Error('BUSINESS_PLAN_PAGE_INVALID');
   if(args.rowIds&&new Set(args.rowIds).size!==rows.length)throw new Error('BUSINESS_PLAN_ROW_NOT_FOUND');
   const selected=rows.slice(offset,offset+limit),data=publicPlan({...plan,rows:selected},args.includeEvidence===true) as Record<string,JsonValue>;
   return {...base,status:'ok',data:{...data,page:{offset,total:rows.length,returned:selected.length,nextCursor:offset+selected.length<rows.length?String(offset+selected.length):null}}};
  }
  if(operation==='create')return {...base,status:'ok',data:publicPlan(await operations.create(args as {storeId:string;rows:BusinessRowInput[]},context.signal))};
  if(operation==='revise')return {...base,status:'ok',data:publicPlan(await operations.revise(args as {planId:string;expectedRevision:number;rows:BusinessRowInput[]},context.signal))};
  if(operation==='inspect')return {...base,status:'ok',data:publicPlan(await operations.inspect(args.planId,context.signal))};
  let plan=operation==='restore'?await operations.restore({planId:args.planId,rowIds:args.rowIds},context.signal):operations.get(args.planId);
  link(store,context,plan.planId);
  plan=await operations.submit({planId:plan.planId,expectedRevision:operation==='restore'?plan.revision:args.expectedRevision},context.signal);
  return businessResult(plan,context);
 }catch(error){return {...base,status:'failed',error:{code:error instanceof Error?error.message:'BUSINESS_OPERATION_FAILED',message:error instanceof Error?error.message:'经营操作未完成。',retryPolicy:'never'}};}
}
export async function executeLegacyBusiness(operations:BusinessOperations,store:CoreStore,client:CoreClient,context:ExecutionContext):Promise<CapabilityResult>{
 const args=context.request.input as RecordData,action=legacyBusinessKind(context.request.capabilityId)!,storeId=args.storeId;
 if(action==='price'&&args.actionId!==undefined)return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'failed',error:{code:'PROMOTION_OPERATION_REQUIRED',message:'活动调价请创建 promotion.update 经营变更，明确 action_id、活动价格和 stock 活动配额后提交；不会改成普通价格。',retryPolicy:'never'}};
 if(!storeId)return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'needs_clarification',missing:['storeId'],candidates:[],question:'请明确目标店铺。'};
 const existing=context.operationId?store.get<RecordData>('business_runtime_operations',context.operationId):undefined;
 if(existing)return businessResult(await operations.inspect(existing.planId,context.signal),context);
 let rows:BusinessRowInput[];
 if(action==='listing')rows=(args.importItems??[]).map((raw:RecordData)=>{const {_sourceSkuId,...item}=raw;const sku=_sourceSkuId??(args.skuScope?.includes(raw.offer_id)?raw.offer_id:undefined);if(!sku)throw new Error('SOURCE_SKU_REFERENCE_REQUIRED');if(!args.skuScope?.includes(sku))throw new Error('SOURCE_SKU_OUTSIDE_SCOPE');return {action,target:{offerId:raw.offer_id},payload:item,procurement:[{itemId:args.collectedItemId,sourceSkuId:sku,quantity:1}]};});
 else{
  if(!args.offerIds?.length&&!args.productIds?.length)return {invocationId:context.request.invocationId,traceId:context.request.traceId,status:'needs_clarification',missing:['offerIds/productIds'],candidates:[],question:'请提供要修改的商品清单。'};
  const response=await client.getStoreProducts();if(response.status!=='ok'||!Array.isArray(response.raw?.products))throw new Error('PRODUCT_IDENTITY_UNAVAILABLE');
  const selected=response.raw.products.filter((product:RecordData)=>String(product.storeId??product.store_id)===storeId&&(args.offerIds?.includes(String(product.offerId??product.offer_id))||args.productIds?.map(String).includes(String(product.productId??product.product_id))));
  if(selected.length!==(args.offerIds?.length??args.productIds?.length??0)||args.offerIds&&selected.some((product:RecordData)=>!args.offerIds.includes(String(product.offerId??product.offer_id)))||args.productIds&&(selected.length!==args.productIds.length||selected.some((product:RecordData)=>!args.productIds.map(String).includes(String(product.productId??product.product_id)))))throw new Error('PRODUCT_SCOPE_NOT_EXACT');
  rows=selected.map((product:RecordData)=>({action,target:{offerId:String(product.offerId??product.offer_id),productId:product.productId??product.product_id},payload:action==='price'?{price:String(args.price),currency_code:args.currency,...(args.oldPrice!==undefined?{old_price:String(args.oldPrice)}:{})}:{stock:args.stock,warehouse_id:args.warehouseId}}));
 }
 const plan=await operations.create({storeId,title:typeof args.userRequest==='string'?args.userRequest:'经营操作',rows},context.signal);link(store,context,plan.planId);
 return businessResult(await operations.submit({planId:plan.planId,expectedRevision:plan.revision},context.signal),context);
}
