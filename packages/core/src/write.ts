import { randomUUID, createHash } from 'node:crypto';
import { clarify, failed } from '../../contracts/src/index.ts';
import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
import { clean, now, wrapped } from './types.ts';
import { projectOperationReceipt } from './receipt.ts';
import { OrdinaryCnyOperations } from './ordinary-cny.ts';
import type { CoreOptions, Operation, RecordData, AdapterResponse } from './types.ts';
const AGENT='dsh-hallmark-app';
function canonical(value:any):any {if(Array.isArray(value))return value.map(canonical);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export function operationResult(op:Operation):ToolResult {
 const status=op.state==='succeeded'?'ok':op.state==='running'||op.state==='pending'?'pending':op.state;
 return {status,data:op.kind==='list_product'&&['succeeded','partial'].includes(op.state)?{...op,acceptance:'imported-not-sellable-verified'}:op,operation:{operationId:op.operationId,state:op.state},...(op.error?{error:op.error as any}:{})};
}
export class WriteOperations {
 options:CoreOptions;inflight=new Map<string,Promise<ToolResult>>();
 private ordinary:OrdinaryCnyOperations;
 constructor(options:CoreOptions){this.options=options;this.ordinary=new OrdinaryCnyOperations(options,op=>this.save(op,{}));}
 async invoke(kind:string,args:RecordData,storeId:string,context:InvocationContext):Promise<ToolResult>{
  const missing:string[]=[];
  const request=context.userRequest??args.userRequest;
  if(!request?.trim())missing.push('userRequest');
  if(context.userRequest&&args.userRequest&&context.userRequest!==args.userRequest)return failed('USER_REQUEST_MISMATCH','写入原话必须与当前调用上下文一致。');
  if(!args.clientOperationKey)missing.push('clientOperationKey');
  if(!(args.valueSource==='user'||typeof args.valueSource==='string'&&args.valueSource.startsWith('rule:')&&args.valueSource.slice(5).trim()))missing.push('valueSource');
  const offers=args.offerIds??[],products=args.productIds??[];
  if(offers.length&&products.length)return clarify(['targetIdentifier'],'请只使用 offerIds 或 productIds，避免目标重复或映射含糊。');
  const targets:string[]=kind==='list_product'?(args.skuScope??[]):(offers.length?offers:products);
  if(kind==='list_product'){
   if(!args.collectedItemId)missing.push('collectedItemId');if(!targets.length)missing.push('skuScope');if(!args.importItems?.length)missing.push('importItems');
  }else if(!targets.length)missing.push('offerIds/productIds');
  if(new Set(targets).size!==targets.length)return clarify(['targets'],'商品清单含重复标识，请给出唯一清单。');
  if(targets.length>1&&args.scopeConfirmed!==true)missing.push('scopeConfirmed');
  if(kind==='update_price'){if(args.price==null)missing.push('price');if(!args.currency)missing.push('currency');}
  if(kind==='update_stock'){if(args.stock==null)missing.push('stock');if(!args.warehouseId)missing.push('warehouseId');}
  if(missing.length)return clarify(missing,'请明确缺失业务输入；不会猜测目标、价格或库存。',targets);
   if(args.valueSource.startsWith('rule:'))return clarify(['ruleEvidence'],'未取得可核实规则定义、版本及数值来源。请提供或确认显式业务值，确认来自用户后使用 valueSource: user；当前不能仅凭规则名称写入。');
  if(context.signal?.aborted)return failed('ABORTED','写入前已取消。');
  if(kind==='update_price'&&(!Number.isFinite(args.price)||args.price<=0))return failed('INVALID_PRICE','价格必须大于零。');
  if(kind==='update_stock'&&(!Number.isSafeInteger(args.stock)||args.stock<0))return failed('INVALID_STOCK','库存必须为非负整数。');
  if(kind==='update_stock'&&(!/^[1-9]\d*$/u.test(args.warehouseId)||!Number.isSafeInteger(Number(args.warehouseId))))return clarify(['warehouseId'],'仓库 ID 须为规范正整数标识（不带前导零），请核对具体仓库。');
   if(kind!=='list_product'&&products.some((id:string)=>!/^[1-9]\d*$/u.test(id)||!Number.isSafeInteger(Number(id))))return clarify(['productIds'],'平台 productId 须为规范正整数标识（不带前导零）。');
   if(kind==='update_price'&&args.actionId)return {status:'unavailable',error:{code:'ACTION_PRICE_NOT_SUPPORTED',message:'活动调价需要独立活动成员、库存及币种验证链路；当前仅支持普通价格，绝不以普通价格回读冒充活动价成功。',retryable:false}};
   const input=clean({...args,storeId,userRequest:request});
  const fingerprint=createHash('sha256').update(JSON.stringify(canonical({kind,storeId,targets:[...targets].sort(),price:args.price,oldPrice:args.oldPrice,currency:args.currency,stock:args.stock,warehouseId:args.warehouseId,collectedItemId:args.collectedItemId,importItems:args.importItems,actionId:args.actionId}))).digest('hex');
  const reserved=this.options.store.transaction(()=>{
   const existing=this.options.store.getOperationByClientKey<Operation>(args.clientOperationKey);
   if(existing){if(existing.sessionId!==context.sessionId)return failed('OPERATION_NOT_FOUND','幂等键属于其他会话。');return existing.input.fingerprint===fingerprint?operationResult(existing):failed('IDEMPOTENCY_KEY_CONFLICT','同一幂等键的目标或数值不可改变。');}
   const blocked=this.options.store.list<Operation>('operations').find(op=>['pending','running','unknown'].includes(op.state)&&op.kind!=='refresh'&&op.storeId===storeId&&(op.targets.some(t=>targets.includes(t))||op.state==='unknown'&&op.kind===kind));
   if(blocked){
    if(blocked.sessionId!==context.sessionId)return failed('OPERATION_UNRESOLVED','目标暂不能修改；请等待既有修改核实，不得换键重写。');
    return {...operationResult(blocked),error:{code:'OPERATION_UNRESOLVED',message:'目标存在未核实的修改。先查询操作，不得换键重写。',retryable:false}};
   }
   const id=context.operationId??randomUUID(),timestamp=now();const op:Operation={operationId:id,kind,sessionId:context.sessionId,clientKey:args.clientOperationKey,storeId,targets,input:{...input,fingerprint},state:'pending',hallmarkRefs:[],items:[],createdAt:timestamp,updatedAt:timestamp};
   this.options.store.put('operations',id,op);projectOperationReceipt(this.options.store,id);return op;
  });
  if('status' in reserved)return reserved as ToolResult;
  const op=reserved as Operation;
  const promise=this.run(op,context).finally(()=>this.inflight.delete(op.operationId));this.inflight.set(op.operationId,promise);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const result=await Promise.race([promise,new Promise<ToolResult>(resolve=>{timer=setTimeout(()=>resolve(operationResult(this.options.store.get<Operation>('operations',op.operationId)!)),25000);timer.unref();})]);
  if(timer)clearTimeout(timer);return result;
 }
 private async run(op:Operation,context:InvocationContext):Promise<ToolResult>{
  try {
   this.save(op,{state:'running'});
   if(op.kind==='list_product')return await this.runListing(op,context);
   const task=await this.options.broker.getStoreTask(op.storeId);
   if(task.status!=='ok'){
    if(this.ordinary.canFallback(op,task)){
     const prepared=await this.ordinary.prepare(op);if('result' in prepared)return this.finish(op,'failed',prepared.result);
     if(context.signal?.aborted)return this.finish(op,'failed',failed('ABORTED','未发送普通 CNY 请求。'));
     const refused=await this.ordinary.submit(op,prepared.products);return refused?this.finish(op,'failed',refused):this.finishItems(op);
    }
    return this.finish(op,'failed',wrapped(task));
   }
   const taskId=task.raw?.taskId;if(!taskId)return this.finish(op,'failed',failed('TASK_CONTEXT_REQUIRED','缺少有效店铺任务。'));
   for(let i=0;i<op.targets.length;i++){
    if(context.signal?.aborted){op.items.push({target:op.targets[i],state:'failed',error:{code:'ABORTED',message:'未发送写请求'}});this.save(op,{});continue;}
    const target=op.targets[i],a=op.input,identifier=a.offerIds?.length?{offer_id:target}:{product_id:Number(target)};
    if(!a.offerIds?.length&&!Number.isSafeInteger(Number(target))){op.items.push({target,state:'failed',error:{code:'INVALID_PRODUCT_ID'}});this.save(op,{});continue;}
    const path=op.kind==='update_stock'?'/v2/products/stocks':'/v1/product/import/prices';
    const body=op.kind==='update_stock'?{stocks:[{...identifier,stock:a.stock,warehouse_id:Number(a.warehouseId)}]}:{prices:[{...identifier,price:String(a.price),currency_code:a.currency,...(a.oldPrice!=null?{old_price:String(a.oldPrice)}:{})}]};
    if(a.actionId&&a.offerIds?.length){op.items.push({target,state:'failed',error:{code:'ACTION_PRODUCT_ID_REQUIRED',message:'活动价格需显式 productIds。'}});this.save(op,{});continue;}
    if(op.kind==='update_stock'&&(!Number.isSafeInteger(Number(a.warehouseId))||Number(a.warehouseId)<=0)){op.items.push({target,state:'failed',error:{code:'INVALID_WAREHOUSE_ID'}});this.save(op,{});continue;}
    const requestId=this.options.broker.requestId(op.kind,op.operationId,i);
    const ref={taskId,requestId,target,path};op.hallmarkRefs.push(ref);
    const item:RecordData={target,state:'unknown',requestId,taskId};op.items.push(item);this.save(op,{}); // Persist intent before any network write.
    let response:AdapterResponse;
    try {response=await this.options.client.platformCall(taskId,{requestId,agentId:AGENT,path,method:'POST',body,note:a.userRequest});}
    catch(error){response={status:'unknown',error:{code:'OUTCOME_UNKNOWN',message:error instanceof Error?error.message:'写入响应未知',retryable:false}};}
    item.write=clean(response);
    if(response.status==='unavailable'||response.status==='failed')item.state='failed';
    else if(response.status==='unknown'||response.raw?.outcome==='outcome_unknown'||response.raw?.outcome==='pending')item.state='unknown';
    else if(this.itemErrors(response.raw?.response))item.state='failed';
    else item.state='unknown'; // Success requires readback, not just transport acknowledgement.
    this.save(op,{});
    if(item.state==='unknown')await this.verifyItem(op,item,i);
    if(item.state==='unknown'){
     for(let j=i+1;j<op.targets.length;j++)op.items.push({target:op.targets[j],state:'failed',error:{code:'NOT_SENT_AFTER_UNKNOWN'}});
     break;
    }
   }
   return this.finishItems(op);
  }catch(error){
   const state=op.hallmarkRefs.length?'unknown':'failed';
   const result:ToolResult={...failed(state==='unknown'?'OUTCOME_UNKNOWN':'OPERATION_ERROR',error instanceof Error?error.message:'操作失败'),status:state};
   this.finish(op,state,result);
   return operationResult(op); // Preserve diagnostics, references and every item; never report failed after a possible write.
  }
 }
 private async runListing(op:Operation,context:InvocationContext):Promise<ToolResult>{
  const a=op.input,client=this.options.client;
  if(!client.getCollectedItemDetail)return this.finish(op,'failed',{status:'unavailable',error:{code:'VERIFIED_IMPORT_REQUIRED',message:'缺少完整采集商品 SKU/素材资料接口。',retryable:false}});
  const original=await client.getCollectedItem(a.collectedItemId);if(original.status!=='ok')return this.finish(op,'failed',wrapped(original));
  if(original.raw?.id!==a.collectedItemId||original.raw?.truncated!==false)return this.finish(op,'failed',failed('INVALID_SOURCE_RESPONSE','完整采集原文 ID 或截断状态不符。'));
  const detail=await client.getCollectedItemDetail(a.collectedItemId);if(detail.status!=='ok')return this.finish(op,'failed',wrapped(detail));
  if(detail.raw?.id!==a.collectedItemId||!Array.isArray(detail.raw.skus))return this.finish(op,'failed',failed('INVALID_SOURCE_RESPONSE','缺少完整采集 SKU 资料。'));
  const sourceSkus:RecordData[]=detail.raw.skus;
  const sourceImages=new Set<string>([...(detail.raw.images??[]),...sourceSkus.map(s=>s.image).filter(Boolean)]);
  const missing:string[]=[],mappings:Array<{skuCode:string;offerId:string}>=[],items:RecordData[]=[];
  for(let i=0;i<a.importItems.length;i++){
   const item=a.importItems[i],sku=String(item._sourceSkuId??item.offer_id??'');
   const source=sourceSkus.find(s=>String(s.sourceSkuId??s.code??s.id)===sku);
   if(!source||!op.targets.includes(sku)){missing.push(`importItems[${i}]._sourceSkuId（必须匹配明确采集 SKU）`);continue;}
   if(!item.offer_id||typeof item.offer_id!=='string')missing.push(`importItems[${i}].offer_id`);
   for(const key of ['description_category_id','type_id'])if(!Number.isSafeInteger(item[key])||item[key]<=0)missing.push(`importItems[${i}].${key}（明确 Ozon 类目，不可用来源平台类目代替）`);
   for(const key of ['name','currency_code','dimension_unit','weight_unit'])if(typeof item[key]!=='string'||!item[key].trim())missing.push(`importItems[${i}].${key}`);
   for(const key of ['price','depth','height','width','weight'])if(!Number.isFinite(Number(item[key]))||Number(item[key])<=0)missing.push(`importItems[${i}].${key}`);
   if(!Array.isArray(item.attributes)||!item.attributes.length||item.attributes.some((x:any)=>!Number.isSafeInteger(x.id)||x.id<=0||!Array.isArray(x.values)||!x.values.length))missing.push(`importItems[${i}].attributes（完整类目属性）`);
   if(!Array.isArray(item.images)||!item.images.length||item.images.some((url:any)=>typeof url!=='string'||!/^https:\/\//u.test(url)||!sourceImages.has(url)))missing.push(`importItems[${i}].images（必须来自所选商品源素材 HTTPS URL）`);
   if(item.primary_image&&!sourceImages.has(item.primary_image))missing.push(`importItems[${i}].primary_image（必须可追溯源素材）`);
   mappings.push({skuCode:sku,offerId:item.offer_id});const {_sourceSkuId,...payload}=item;items.push(payload);
  }
  if(mappings.length!==op.targets.length||new Set(mappings.map(m=>m.skuCode)).size!==op.targets.length||new Set(mappings.map(m=>m.offerId)).size!==mappings.length)missing.push('importItems 与 skuScope 必须一对一完整映射，不允许额外或遗漏 SKU');
  if(missing.length)return this.finish(op,'failed',{...clarify(missing,'需要完整、可追溯的导入字段；不会虚构类目、属性、价格或资产。'),error:{code:'VERIFIED_IMPORT_REQUIRED',message:'尚未满足完整可追溯的导入前置条件。',retryable:false}});
  if(context.signal?.aborted)return this.finish(op,'failed',failed('ABORTED','上品准备后已取消。'));
  const task=await this.options.broker.getListingTask({storeId:op.storeId,collectedItemId:a.collectedItemId,skuScope:op.targets,instruction:a.userRequest});
  if(task.status!=='ok')return this.finish(op,task.status==='unknown'?'unknown':'failed',wrapped(task));
  const taskId=task.raw?.taskId;if(!taskId)return this.finish(op,'failed',failed('TASK_CONTEXT_REQUIRED','缺少上品上下文。'));
  const requestId=this.options.broker.requestId('list_product',op.operationId,0);
  op.hallmarkRefs.push({taskId,requestId,path:'/v3/product/import',created:task.raw.created,reused:task.raw.reused,collectedItemId:a.collectedItemId,mappings});
  op.items=op.targets.map(target=>({target,offerId:mappings.find(m=>m.skuCode===target)!.offerId,taskId,requestId,state:'unknown'}));this.save(op,{});
  let response:AdapterResponse;try {response=await client.platformCall(taskId,{requestId,agentId:AGENT,path:'/v3/product/import',method:'POST',body:{items},mappings,note:a.userRequest});}catch(error){response={status:'unknown',error:{code:'OUTCOME_UNKNOWN',message:error instanceof Error?error.message:'导入响应未知',retryable:false}};}
  const importTaskId=response.raw?.response?.result?.task_id;
  for(const item of op.items){item.write=clean(response);if(importTaskId!=null)item.importTaskId=importTaskId;if(response.status==='failed'||response.status==='unavailable'||this.itemErrors(response.raw?.response))item.state='failed';}
  this.save(op,{});
  if(importTaskId!=null)await this.verifyListing(op);
  return this.finishItems(op);
 }
 private async verifyListing(op:Operation):Promise<void>{
  const item=op.items.find(item=>item.state==='unknown'&&item.importTaskId!=null);if(!item)return;
  try {
   const readSequence=op.input.verificationAttempt??0;op.input.verificationAttempt=readSequence+1;this.save(op,{});
   const response=await this.options.client.platformRead(item.taskId,{requestId:this.options.broker.requestId('import_verify',op.operationId,readSequence),agentId:AGENT,path:'/v1/product/import/info',method:'POST',body:{task_id:item.importTaskId}});
   const rows=response.raw?.response?.result?.items??response.raw?.response?.items;if(response.status!=='ok'||!Array.isArray(rows))return;
   for(const target of op.items){if(target.state!=='unknown')continue;target.readback=clean(response);const row=rows.find((row:RecordData)=>String(row.offer_id)===target.offerId);if(!row)continue;
    if(row.errors?.length||row.status==='failed'||row.status==='rejected'){target.state='failed';target.importErrors=row.errors??row.status;}
    else if(row.status==='imported'&&Number.isSafeInteger(Number(row.product_id))&&Number(row.product_id)>0){target.state='succeeded';target.productId=row.product_id;target.verifiedAt=now();}
   }
   this.save(op,{});
  }catch(error){item.verificationError=error instanceof Error?error.message:'导入回读失败';this.save(op,{});}
 }
 private itemErrors(response:any):boolean {
  if(response?.error||response?.errors?.length)return true;const rows=response?.result?.items??response?.result??response?.items;
  return Array.isArray(rows)&&rows.some(row=>row.errors?.length||row.error||row.updated===false||row.status==='failed');
 }
 private async verifyItem(op:Operation,item:RecordData,seq:number):Promise<void>{
  const a=op.input,isStock=op.kind==='update_stock';
  if(a.actionId)return; // Old unresolved promotion records are not ordinary-price operations.
  const matchesIdentity=(row:RecordData)=>a.offerIds?.length?String(row.offer_id??row.offerId??'')===item.target:String(row.product_id??row.productId??row.id??'')===item.target;
  const path=isStock?'/v2/product/info/stocks-by-warehouse/fbs':'/v5/product/info/prices';
  const filter=a.offerIds?.length?{offer_id:[item.target]}:{product_id:[Number(item.target)]};
  let body:RecordData={filter:{...filter,visibility:'ALL'},limit:1000};
  try {
   const readSequence=seq+(item.verificationAttempt??0)*200;item.verificationAttempt=(item.verificationAttempt??0)+1;this.save(op,{});
   if(isStock){
    const info=await this.options.client.platformRead(item.taskId,{requestId:this.options.broker.requestId('stock_info',op.operationId,readSequence),agentId:AGENT,path:'/v3/product/info/list',method:'POST',body:filter});item.infoReadback=clean(info);
    const infoRows=info.raw?.response?.items??info.raw?.response?.result?.items??info.raw?.response?.result;
    const matchedInfo=Array.isArray(infoRows)?infoRows.filter(matchesIdentity):[];
    const infoRow=matchedInfo.length===1?matchedInfo[0]:undefined;
    if(info.status!=='ok'||!Number.isSafeInteger(infoRow?.sku)||infoRow.sku<=0){this.save(op,{});return;}
    item.platformSku=infoRow.sku;item.resolvedOfferId=infoRow.offer_id;body={sku:[infoRow.sku],limit:100};
   }
   const response=await this.options.client.platformRead(item.taskId,{requestId:this.options.broker.requestId('verify',op.operationId,readSequence),agentId:AGENT,path,method:'POST',body});item.readback=clean(response);
   if(response.status!=='ok')return;
   const payload=response.raw?.response??response.raw;
   const rows=payload?.result?.items??payload?.result??payload?.items;
   if(!Array.isArray(rows))return;
   const matchedRows=rows.filter((row:RecordData)=>isStock?((typeof item.resolvedOfferId==='string'&&String(row.offer_id??row.offerId)===item.resolvedOfferId)||row.sku===item.platformSku)&&(row.warehouse_id==null||String(row.warehouse_id)===String(a.warehouseId)):matchesIdentity(row));
   const row=matchedRows.length===1?matchedRows[0]:undefined;
   if(!row)return;
   let observed:any;
   if(isStock){const stocks=row.stocks??row.warehouses??[row];const warehouse=stocks.find((s:RecordData)=>String(s.warehouse_id??s.warehouseId)===String(a.warehouseId));observed=warehouse?.present??warehouse?.stock;}
   else observed=row.price?.price??row.price;
   const currency=row.price?.currency_code??row.currency_code;
   item.observed=observed??null;
   if(observed!=null&&Number(observed)===(isStock?a.stock:a.price)&&(isStock||currency===a.currency)&&(a.oldPrice==null||Number(row.price?.old_price??row.old_price)===a.oldPrice)){item.state='succeeded';item.verifiedAt=now();}
   // A mismatching immediate read can be eventual consistency, so leave unknown rather than retry.
   this.save(op,{});
  }catch(error){item.verificationError=error instanceof Error?error.message:'回读失败';this.save(op,{});}
 }
 async get(id:string,context?:InvocationContext):Promise<ToolResult>{
  const op=this.options.store.get<Operation>('operations',id);if(!op||context&&op.sessionId!==context.sessionId)return failed('OPERATION_NOT_FOUND','操作不存在。');
  if(op.state==='unknown'&&op.kind!=='refresh'&&!this.inflight.has(id)){
   if(op.kind==='list_product')await this.verifyListing(op);
   else if(op.ordinaryCny&&op.hallmarkRefs.some(ref=>ref.transport==='ordinary_cny'))await this.ordinary.verify(op);
   else for(let i=0;i<op.items.length;i++){if(op.items[i].state==='unknown'&&op.items[i].taskId)await this.verifyItem(op,op.items[i],i);}
   return this.finishItems(op);
  }
  return operationResult(op);
 }
 async recover():Promise<ToolResult[]> {
  const results:ToolResult[]=[];
  for(const op of this.options.store.list<Operation>('operations')){
   if(!['pending','running','unknown'].includes(op.state)||this.inflight.has(op.operationId))continue;
   if(op.kind==='refresh')continue; // Isolated DatasetRefresher owns refresh recovery.
   if(op.state!=='unknown'){
    const restart={code:'PROCESS_RESTARTED',message:'仅回读核实，不自动重放写请求',retryable:false};
    this.save(op,{state:'unknown',error:op.error??restart,diagnostics:[...(op.diagnostics??[]),{kind:'recovery',error:restart,recordedAt:now()}]});
   }
   results.push(await this.get(op.operationId));
  }
  return results;
 }
 private finishItems(op:Operation):ToolResult {
  if(op.items.length)for(const target of op.targets)if(!op.items.some(item=>item.target===target))op.items.push({target,state:'failed',error:{code:'NOT_SENT_AFTER_INTERRUPTION',message:'没有已持久化发送意图；不在恢复时补发写请求。'}});
  const states=op.items.map(i=>i.state);const state=op.ordinaryCny?.unresolved||states.includes('unknown')?'unknown':states.length&&states.every(s=>s==='succeeded')?'succeeded':states.includes('succeeded')?'partial':'failed';
  // Never resolve an operation without evidence of attempted items (e.g. crash before dispatch).
  if(!states.length&&op.state==='unknown')return operationResult(op);
  if(state==='succeeded'&&(op.error as RecordData|undefined)?.code==='PROCESS_RESTARTED'){
   const diagnostics=op.diagnostics?.some(entry=>entry.kind==='recovery'&&entry.error?.code==='PROCESS_RESTARTED')?op.diagnostics:[...(op.diagnostics??[]),{kind:'recovery',error:clean(op.error),recordedAt:null}];
   this.save(op,{state,error:null,diagnostics});
  }else this.save(op,{state});
  return operationResult(op);
 }
 private finish(op:Operation,state:Operation['state'],result:ToolResult):ToolResult {this.save(op,{state,result,error:result.error??null});return {...result,operation:{operationId:op.operationId,state}};}
 private save(op:Operation,patch:RecordData):void {Object.assign(op,patch,{updatedAt:now()});this.options.store.put('operations',op.operationId,clean(op));projectOperationReceipt(this.options.store,op.operationId);}
 async idle():Promise<void>{await Promise.all(this.inflight.values());}
}
