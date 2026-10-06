import {clarify,failed} from '../../contracts/src/index.ts';
import type {ToolResult} from '../../contracts/src/index.ts';
import type {OrdinaryCnyOperationResult,OrdinaryCnyOperationRow,OrdinaryCnyPriceProduct} from '../../hallmark-adapter/types.ts';
import type {CoreOptions,Operation,RecordData} from './types.ts';
import {clean,productStoreId,wrapped,now} from './types.ts';

/** Decimal CNY cents only. Never round the user's value or convert currencies. */
export function cnyMinor(value:unknown):number|undefined {
 if(typeof value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(value))return undefined;
 const [whole,fraction='']=value.split('.');if(whole.replace(/^0+/,'').length>14)return undefined;
 const minor=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));return minor>0n&&minor<=BigInt(Number.MAX_SAFE_INTEGER)?Number(minor):undefined;
}
const NO_DISPATCH_CODES=new Set(['HUMAN_AUTH_REQUIRED','HUMAN_AUTH_INVALID','HALLMARK_UNAVAILABLE','ORDINARY_PRICE_INPUT_INVALID','HALLMARK_HTTP_401','HALLMARK_HTTP_403']);
const BASIS='Hallmark 普通 CNY 操作的历史 price-state 核实；不是实时平台 /v5 回读，不修改库存。';
export class OrdinaryCnyOperations {
 options:CoreOptions;
 persist:(operation:Operation)=>void;
 constructor(options:CoreOptions,persist:(operation:Operation)=>void){this.options=options;this.persist=persist;}
 canFallback(op:Operation,task:any):boolean {
  const a=op.input,c=this.options.client;
  return ['failed','unavailable'].includes(task.status)&&task.error?.code==='TASK_CONTEXT_REQUIRED'&&op.kind==='update_price'&&a.currency==='CNY'&&a.actionId===undefined&&a.oldPrice===undefined&&typeof c.submitOrdinaryCnyPrice==='function'&&typeof c.getOrdinaryCnyOperation==='function'&&typeof c.inspectOrdinaryCnyOperation==='function';
 }
 async prepare(op:Operation):Promise<{products:OrdinaryCnyPriceProduct[]}|{result:ToolResult}> {
  const price=String(op.input.price),minor=cnyMinor(price);
  if(minor===undefined)return {result:clarify(['price'],'普通 CNY 售价必须是最多两位小数且整数分在安全范围内的正数；不会舍入、转换科学计数法或猜测金额。')};
  const response=await this.options.client.getStoreProducts();if(response.status!=='ok')return {result:wrapped(response)};
  if(!Array.isArray(response.raw?.products))return {result:failed('INVALID_SOURCE_RESPONSE','原商品快照缺少 products 数组，无法核实平台 ID/Offer 映射。')};
  const products:OrdinaryCnyPriceProduct[]=[];
  for(const target of op.targets){
   const matches=response.raw.products.filter((row:RecordData)=>productStoreId(row)===op.storeId&&(op.input.offerIds?.length?String(row.offerId??row.offer_id??'')===target:String(row.productId??row.product_id??'')===target));
   const row=matches.length===1?matches[0]:undefined,rawId=row?.productId??row?.product_id,offer=row?.offerId??row?.offer_id;
   const canonicalId=typeof rawId==='number'?Number.isSafeInteger(rawId)&&rawId>0:typeof rawId==='string'&&/^[1-9]\d*$/.test(rawId)&&Number.isSafeInteger(Number(rawId));
   if(!row||!canonicalId||typeof offer!=='string'||!offer.trim()||offer!==offer.trim())return {result:clarify(['productMapping'],'同店原始快照未给出唯一且完整的正整数平台 productId 与精确 Offer 映射；未提交。',matches)};
   products.push({productId:Number(rawId),offerId:offer,price});
  }
  if(new Set(products.map(row=>row.productId)).size!==products.length||new Set(products.map(row=>row.offerId)).size!==products.length)return {result:clarify(['productMapping'],'商品映射含重复平台 ID 或 Offer；不能隐式合并或猜测范围。')};
  return {products};
 }
 async submit(op:Operation,products:OrdinaryCnyPriceProduct[]):Promise<ToolResult|undefined> {
  // One UUID and one immutable whole batch; all target refs are durable before any Source POST.
  op.ordinaryCny={sourceOperationId:op.operationId,storeId:op.storeId,products:clean(products),verificationBasis:BASIS,unresolved:true};
  op.items=op.targets.map((target,index)=>({target,state:'unknown',transport:'ordinary_cny',sourceOperationId:op.operationId,storeId:op.storeId,...products[index],expectedMinor:cnyMinor(products[index].price),verificationBasis:BASIS}));
  op.hallmarkRefs.push(...op.items.map(item=>({transport:'ordinary_cny',sourceOperationId:item.sourceOperationId,storeId:op.storeId,target:item.target,productId:item.productId,offerId:item.offerId})));
  this.persist(op);
  let response:OrdinaryCnyOperationResult;
  try {response=await this.options.client.submitOrdinaryCnyPrice!({operationId:op.operationId,storeId:op.storeId,products:clean(products)});}catch(error){response={status:'unknown',stage:'outcome_unknown',error:{code:'OUTCOME_UNKNOWN',message:error instanceof Error?error.message:'普通 CNY 提交结果未知。',retryable:false}};}
  op.ordinaryCny.write=clean(response);
  for(const item of op.items)item.write=clean({status:response.status,stage:response.stage,error:response.error,sourceOperationId:op.operationId});
  if(!response.stage&&response.status!=='unknown'&&response.raw?.id!==op.operationId&&NO_DISPATCH_CODES.has(response.error?.code??'')){
   op.ordinaryCny.unresolved=false;op.ordinaryCny.preDispatchRefusal=clean(response.error);
   for(const item of op.items){item.state='failed';item.error=response.error;}
   this.persist(op);return wrapped(response);
  }
  this.apply(op,response);this.persist(op);
  if(op.items.some(item=>item.state==='unknown'))await this.verify(op);
  return undefined;
 }
 private matchedRows(op:Operation,response:OrdinaryCnyOperationResult):OrdinaryCnyOperationRow[]|undefined {
  const raw=response.raw,products=op.ordinaryCny?.products as OrdinaryCnyPriceProduct[]|undefined;
  const expectedMinor=cnyMinor(String(op.input.price));
  if(!raw||!Array.isArray(products)||!products.length||expectedMinor===undefined||op.kind!=='update_price'
   ||op.input.currency!=='CNY'||op.input.actionId!==undefined||op.input.oldPrice!==undefined
   ||op.ordinaryCny?.sourceOperationId!==op.operationId||op.ordinaryCny.storeId!==op.storeId
   ||products.length!==op.items.length||products.length!==op.targets.length)return undefined;
  if(products.some((product,index)=>{
   const item=op.items[index];
   return !product||!Number.isSafeInteger(product.productId)||product.productId<=0
    ||typeof product.offerId!=='string'||!product.offerId.trim()||product.offerId!==product.offerId.trim()
    ||cnyMinor(product.price)!==expectedMinor||item?.target!==op.targets[index]
    ||item?.transport!=='ordinary_cny'||item.sourceOperationId!==op.operationId||item.storeId!==op.storeId
    ||item.productId!==product.productId||item.offerId!==product.offerId||item.expectedMinor!==expectedMinor
    ||(op.input.offerIds?.length?product.offerId:String(product.productId))!==op.targets[index];
  }))return undefined;
  if(raw.id!==op.operationId||raw.storeId!==op.storeId||raw.kind!=='ordinary'||raw.actionId!==0
   ||raw.requestId!==`human-promo-${op.operationId}`||typeof raw.title!=='string'
   ||typeof raw.createdAt!=='string'||typeof raw.updatedAt!=='string'
   ||!Number.isFinite(Date.parse(raw.createdAt))||!Number.isFinite(Date.parse(raw.updatedAt))
   ||!['pending','finished'].includes(raw.status)||!(raw.error===null||typeof raw.error==='string')
   ||!Array.isArray(raw.products)||!Array.isArray(raw.results)
   ||raw.products.length!==products.length||raw.results.length!==products.length
   ||raw.products.some(row=>!row||typeof row!=='object'||Array.isArray(row))
   ||raw.results.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return undefined;
  const matched:OrdinaryCnyOperationRow[]=[];
  for(const expected of products){
   const submitted=raw.products.filter(row=>row.productId===expected.productId&&row.offerId===expected.offerId),rows=raw.results.filter(row=>row.productId===expected.productId&&row.offerId===expected.offerId);
   const product=submitted.length===1?submitted[0]:undefined,row=rows.length===1?rows[0]:undefined;
   if(!product||!row||product.stock!=='0'||row.stock!=='0'||cnyMinor(product.price)!==cnyMinor(expected.price)||cnyMinor(row.price)!==cnyMinor(expected.price)||!['pending','verified','rejected'].includes(row.status)||typeof row.reason!=='string'||!(row.actualMinor===null||Number.isSafeInteger(row.actualMinor)&&row.actualMinor>=0)||!(row.sellerMinor===null||Number.isSafeInteger(row.sellerMinor)&&row.sellerMinor>=0)||row.status==='verified'&&row.actualMinor!==cnyMinor(expected.price))return undefined;
   matched.push(row);
  }
  return matched;
 }
 private apply(op:Operation,response:OrdinaryCnyOperationResult):void {
  if(op.ordinaryCny)op.ordinaryCny.unresolved=true;
  const rows=this.matchedRows(op,response),raw=response.raw;
  if(!rows||!raw){for(const item of op.items)if(item.state==='unknown')item.verificationError='SOURCE_RECEIPT_UNVERIFIED';return;}
  const allVerified=rows.every(row=>row.status==='verified'),allRejected=rows.every(row=>row.status==='rejected');
  const stage=allVerified&&raw.error===null?'verified':allRejected?'rejected':rows.some(row=>row.status==='verified')&&rows.some(row=>row.status==='rejected')?'mixed':undefined;
  // Any pending item (even in a claimed mixed/finished response) keeps the operation unknown.
  if(raw.status!=='finished'||rows.some(row=>row.status==='pending')||!stage||response.stage!==stage||response.status!==(stage==='verified'?'ok':'failed'))return;
  if(op.ordinaryCny)op.ordinaryCny.unresolved=false;
  op.items.forEach((item,index)=>{const row=rows[index];item.sourceResult=clean(row);item.message=row.reason;item.observedMinor=row.actualMinor;item.sourceRecordUpdatedAt=raw.updatedAt;item.readbackCheckedAt=now();if(row.status==='verified'){item.state='succeeded';delete item.verificationError;}else{item.state='failed';item.error={code:'ORDINARY_PRICE_REJECTED',message:row.reason,retryable:false};}});
 }
 async verify(op:Operation):Promise<void> {
  const c=this.options.client;
  if(op.ordinaryCny)op.ordinaryCny.unresolved=true;
  if(!op.ordinaryCny||op.ordinaryCny.sourceOperationId!==op.operationId||op.ordinaryCny.storeId!==op.storeId||typeof c.getOrdinaryCnyOperation!=='function'){for(const item of op.items)if(item.state==='unknown')item.verificationError='SOURCE_READBACK_UNAVAILABLE';this.persist(op);return;}
  try {
   const response=await c.getOrdinaryCnyOperation(op.storeId,op.operationId);op.ordinaryCny.readback=clean(response);this.apply(op,response);this.persist(op);
   if(response.stage==='pending'&&response.raw?.status==='pending'&&this.matchedRows(op,response)&&typeof c.inspectOrdinaryCnyOperation==='function'){
    const inspected=await c.inspectOrdinaryCnyOperation(op.storeId,op.operationId);op.ordinaryCny.inspection=clean(inspected);this.apply(op,inspected);this.persist(op);
   }
  }catch(error){for(const item of op.items)if(item.state==='unknown')item.verificationError=error instanceof Error?error.message:'原普通 CNY 操作只读核实不可用。';this.persist(op);}
 }
}
