import type { BindingData, DataBinding, ViewSpec, WidgetSpec } from '../../presentation/src/types.ts';
import { payloadRows } from './model.ts';
import { nativeAttachmentDisabledReason, nativeAttachmentRuntime } from './selection-native.ts';
import type { NativeAttachmentRuntime, NativeDraftAttachment, NativeInputBinding } from './selection-native.ts';

export type ProductIdentity = {kind:'collected_item';itemId:string}|{kind:'store_product';storeId:string;offerId?:string;productId?:string};
export interface SelectableProduct {key:string;row:Record<string,unknown>;identity:ProductIdentity}
export interface ProductSelectionRows {eligible:boolean;reason?:string;rows:SelectableProduct[]}
export interface AttachSelectionResult {ok:boolean;message:string;pending?:boolean}
export interface ProductSelectionInput {widget:WidgetSpec;binding?:DataBinding;data?:BindingData;rows:Record<string,unknown>[]}
export interface ProductSelectionContext {
  type:'hallmark.product-selection';version:1;sessionId:string;viewId:string;widgetId:string;bindingId:string;datasetKey:string;
  dataTime?:string;lastSuccessAt?:string;source:{endpoint?:string;kind:'collected_items'|'store_products'};products:ProductIdentity[];
}

const id=(value:unknown):value is string=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/u.test(value);
const productId=(value:unknown):string|undefined=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):typeof value==='string'&&/^[1-9][0-9]*$/u.test(value)&&value.length<=64?value:undefined;
const deny=(reason:string):ProductSelectionRows=>({eligible:false,reason,rows:[]});
function alias(row:Record<string,unknown>,first:string,second:string):unknown {
  if(row[first]!==undefined&&row[second]!==undefined&&String(row[first])!==String(row[second]))return undefined;
  return row[first]??row[second];
}

/** Identity comes from raw source fields, never display aliases, row positions or model-authored fieldMap. */
export function getProductSelectionRows(binding:DataBinding|undefined,data:BindingData|undefined,rows:Record<string,unknown>[]):ProductSelectionRows {
  if(!binding||!data||data.bindingId!==binding.id||!data.datasetKey||binding.datasetKey&&binding.datasetKey!==data.datasetKey)return deny('此组件没有可核实的数据绑定。');
  if(data.state!=='ready')return deny('数据尚未就绪或刷新失败，请重新读取后选择产品。');
  const endpoint=data.provenance?.endpoint;
  const collected=endpoint==='/api/items';
  const store=/^(store_products|profit):.+$/u.test(data.datasetKey)||endpoint==='/api/store-products';
  if(!collected&&!store)return deny('仅支持已核实来源的采集产品和店铺商品。');
  if(collected&&binding.query&&binding.query.tool!=='hallmark_search_collected_items')return deny('查询类型与采集产品来源不一致。');
  const expectedStore=/^(?:store_products|profit):(.+)$/u.exec(data.datasetKey)?.[1];
  const sourceRows=new Set(payloadRows(data.payload));const result:SelectableProduct[]=[];const keys=new Set<string>();const platformKeys=new Set<string>();
  for(const row of rows){
    if(!sourceRows.has(row))return deny('选择已失效，请根据当前快照重新选择。');
    let identity:ProductIdentity;
    if(collected){if(!id(row.id))return deny('采集记录缺少稳定产品 ID，不能发送选择。');identity={kind:'collected_item',itemId:row.id};}
    else {
      if([['storeId','store_id'],['offerId','offer_id'],['productId','product_id']].some(([a,b])=>row[a]!==undefined&&row[b]!==undefined&&String(row[a])!==String(row[b])))return deny('商品身份字段相互冲突，不能发送选择。');
      const storeId=alias(row,'storeId','store_id'),offerId=alias(row,'offerId','offer_id'),platformId=productId(alias(row,'productId','product_id'));
      if(!id(storeId)||expectedStore&&expectedStore!==storeId||data.provenance.storeId!==undefined&&data.provenance.storeId!==storeId)return deny('商品缺少明确店铺归属或与快照店铺不一致。');
      if(!id(offerId)&&!platformId)return deny('商品缺少稳定 Offer ID 或平台产品 ID。');
      identity={kind:'store_product',storeId,...(id(offerId)?{offerId}:{}),...(platformId?{productId:platformId}:{})};
    }
    const key=identity.kind==='collected_item'?JSON.stringify(['collected_item',identity.itemId]):JSON.stringify(['store_product',identity.storeId,identity.offerId?'offer':'product',identity.offerId??identity.productId]);
    if(identity.kind==='store_product'&&identity.productId){const platformKey=JSON.stringify([identity.storeId,identity.productId]);if(platformKeys.has(platformKey))return deny('同一店铺的平台产品 ID 重复或对应不同 Offer，不能发送选择。');platformKeys.add(platformKey);}
    if(keys.has(key))return deny('当前数据含重复产品标识，无法准确区分选择。');keys.add(key);result.push({key,row,identity});
  }
  return result.length?{eligible:true,rows:result}:deny('当前没有可以选择的产品。');
}

export function buildProductSelection(sessionId:string,spec:ViewSpec,input:ProductSelectionInput):ProductSelectionContext {
  if(!id(sessionId)||!id(spec.id)||!id(input.widget.id))throw new Error('缺少明确的会话或组件身份。');
  if(!spec.widgets.includes(input.widget)||!input.binding||!spec.bindings.includes(input.binding)||input.widget.bindingId!==input.binding.id)throw new Error('组件与数据绑定已经变化，请重新选择。');
  if(input.widget.type!=='table'&&input.widget.type!=='product_card')throw new Error('该组件不支持产品选择。');
  if(input.rows.length<1||input.rows.length>100)throw new Error('请明确选择 1 至 100 个产品。');
  return buildBoundProductSelection(sessionId,spec,input.widget.id,input.binding,input.data,input.rows);
}

/** Shared identity-to-native-attachment path; source components do not need a preset widget. */
export function buildBoundProductSelection(sessionId:string,spec:ViewSpec,componentId:string,binding:DataBinding,data:BindingData|undefined,rows:Record<string,unknown>[]):ProductSelectionContext {
  if(!id(sessionId)||!id(spec.id)||!id(componentId))throw new Error('缺少明确的会话或组件身份。');
  if(!spec.bindings.includes(binding))throw new Error('组件与数据绑定已经变化，请重新选择。');
  if(!rows.length)throw new Error('请先选择产品。');
  // Validate the complete snapshot as well: selecting one of two duplicate identities is still ambiguous.
  const all=getProductSelectionRows(binding,data,payloadRows(data?.payload));
  if(!all.eligible)throw new Error(all.reason);
  const selected=getProductSelectionRows(binding,data,rows);if(!selected.eligible)throw new Error(selected.reason);
  const snapshot=data!;
  return {type:'hallmark.product-selection',version:1,sessionId,viewId:spec.id,widgetId:componentId,bindingId:binding.id,datasetKey:snapshot.datasetKey,
    ...(snapshot.dataTime?{dataTime:snapshot.dataTime}:{}),...(snapshot.lastSuccessAt?{lastSuccessAt:snapshot.lastSuccessAt}:{}),
    source:{...(['/api/items','/api/store-products'].includes(String(snapshot.provenance.endpoint))?{endpoint:String(snapshot.provenance.endpoint)}:{}),kind:snapshot.provenance.endpoint==='/api/items'?'collected_items':'store_products'},products:selected.rows.map(row=>row.identity)};
}

/** The JSON is file content only. It is never inserted into the editor or sent automatically. */
export function selectionAttachment(context:ProductSelectionContext):{name:string;content:string;signature:string} {
  const content=JSON.stringify(context,null,2)+'\n';
  // A sorting change must not turn the same selected product set into another draft attachment.
  const signature=JSON.stringify({...context,products:[...context.products].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
  return {name:`Hallmark-已选产品-${context.products.length}项.json`,content,signature};
}

interface InputEntry {token:symbol;binding:NativeInputBinding}
interface PendingSelection {sessionId:string;attachment:ReturnType<typeof selectionAttachment>;expiresAt:number}
interface AttachedSelection {id:string;beforeIds:readonly string[]}
export class SelectionInputBridge {
  private current:string|undefined;
  private inputs=new Map<string,InputEntry>();
  private unsupported=new Set<string>();
  private navigate:((sessionId:string)=>void)|undefined;
  private pending:PendingSelection|undefined;
  private runtime:NativeAttachmentRuntime|undefined;
  private attached=new Map<string,Map<string,AttachedSelection>>();
  private revision=0;private listeners=new Set<()=>void>();
  private notices=new Map<string,string>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  private changed(){this.revision++;for(const listener of this.listeners)listener();}
  /** Runtime replacement cancels only uncommitted intent; accepted attachments belong to DSH. */
  attachmentRuntime(value:unknown){const runtime=nativeAttachmentRuntime(value);if(runtime===this.runtime)return;this.runtime=runtime;this.pending=undefined;this.attached.clear();this.changed();}
  observeSession(sessionId:string|undefined){if(this.current===sessionId)return;this.current=sessionId;if(this.pending&&this.pending.sessionId!==sessionId)this.pending=undefined;this.changed();}
  navigation(open:((sessionId:string)=>void)|undefined){this.navigate=open;this.changed();}
  notice(sessionId:string){return this.notices.get(sessionId);}
  availability(sessionId:string):{available:boolean;disabledReason?:string}{
    if(!sessionId||sessionId!==this.current)return {available:false,disabledReason:'请先选择并切回该组件对应的聊天。'};
    if(!this.runtime||typeof File!=='function')return {available:false,disabledReason:'当前宿主的原生文件附件接口不可用，未修改聊天正文。'};
    if(this.unsupported.has(sessionId))return {available:false,disabledReason:'当前宿主没有提供原生附件草稿接口。'};
    const input=this.inputs.get(sessionId);
    if(input){const reason=nativeAttachmentDisabledReason(input.binding);return reason?{available:false,disabledReason:reason}:{available:true};}
    if(this.navigate)return {available:true};
    return {available:false,disabledReason:'原生输入框的附件接口尚未就绪。'};
  }
  bind(sessionId:string,binding:NativeInputBinding|undefined):()=>void {
    const token=Symbol(sessionId);
    if(!binding||typeof binding.actions?.addAttachments!=='function'||typeof binding.readState!=='function'||typeof binding.disabledReason!=='function'){
      this.unsupported.add(sessionId);this.inputs.delete(sessionId);
      if(this.pending?.sessionId===sessionId){this.pending=undefined;this.notices.set(sessionId,'当前宿主没有提供原生附件接口，选择未附加；正文未修改。');}this.changed();
      return()=>{};
    }
    this.unsupported.delete(sessionId);
    this.inputs.set(sessionId,{token,binding});this.changed();
    const pending=this.pending;
    if(pending?.sessionId===sessionId){this.pending=undefined;if(pending.expiresAt<Date.now())this.notices.set(sessionId,'选择传递已超时，请返回组件重新附加。');else if(this.current===sessionId)this.insert(sessionId,pending.attachment);this.changed();}
    return()=>{if(this.inputs.get(sessionId)?.token===token){this.inputs.delete(sessionId);this.changed();}};
  }
  attach(sessionId:string,context:ProductSelectionContext):AttachSelectionResult {
    if(context.sessionId!==sessionId)return {ok:false,message:'附件所属会话不匹配，未附加。'};
    const state=this.availability(sessionId);if(!state.available)return {ok:false,message:state.disabledReason!};
    const attachment=selectionAttachment(context);
    if(this.inputs.has(sessionId))return this.insert(sessionId,attachment);
    if(!this.navigate)return {ok:false,message:'原生聊天导航尚未就绪。'};
    if(this.pending?.sessionId===sessionId&&this.pending.attachment.signature===attachment.signature&&this.pending.expiresAt>=Date.now())return {ok:true,pending:true,message:'正在等待原聊天输入框，请勿重复附加。'};
    this.pending={sessionId,attachment,expiresAt:Date.now()+10000};
    this.notices.set(sessionId,'正在等待原聊天输入框就绪，尚未发送消息。');this.changed();
    try{this.navigate(sessionId);return {ok:true,pending:true,message:'已返回原聊天，输入框就绪后添加产品附件；请补充要求再发送。'};}
    catch{this.pending=undefined;this.notices.set(sessionId,'原聊天导航失败，选择未附加。');this.changed();return {ok:false,message:'原聊天导航失败，选择未附加。'};}
  }
  private insert(sessionId:string,attachment:ReturnType<typeof selectionAttachment>):AttachSelectionResult {
    let result:AttachSelectionResult;
    let drafts:readonly NativeDraftAttachment[]=[];let accepted=false;const runtime=this.runtime;
    try{
      const input=this.inputs.get(sessionId);if(sessionId!==this.current||!input||!runtime)throw new Error('会话或附件接口已变化，选择未附加。');
      const reason=nativeAttachmentDisabledReason(input.binding);if(reason)throw new Error(reason);
      const attached=this.attached.get(sessionId)??new Map<string,AttachedSelection>();
      const beforeIds=input.binding.readState()!.attachmentIds;const liveIds=new Set(beforeIds);
      // A React hook can still expose the pre-add snapshot during a same-tick double click.
      // Native add/remove publish new attachmentIds arrays; a later absent ID means removal/send.
      for(const [signature,entry] of attached)if(!liveIds.has(entry.id)&&beforeIds!==entry.beforeIds)attached.delete(signature);
      if(attached.has(attachment.signature))return {ok:true,message:'这组产品已在当前聊天附件栏中，无需重复附加。'};
      const file=new File([attachment.content],attachment.name,{type:'application/json'});
      drafts=runtime.createDrafts(sessionId,[file]);
      if(drafts.length!==1||drafts[0]?.kind!=='file'||!id(drafts[0].id)||drafts[0].file!==file)throw new Error('宿主未返回有效的原生文件附件，未附加。');
      if(sessionId!==this.current||this.inputs.get(sessionId)?.token!==input.token||this.runtime!==runtime)throw new Error('会话已切换，选择未附加。');
      const changedReason=nativeAttachmentDisabledReason(input.binding);if(changedReason)throw new Error(changedReason);
      if(!input.binding.actions.addAttachments(drafts.map(draft=>draft.id)))throw new Error('输入框正在提交，附件未附加；请稍后重试。');
      accepted=true;attached.set(attachment.signature,{id:drafts[0].id,beforeIds});this.attached.set(sessionId,attached);
      result={ok:true,message:'已添加产品 JSON 附件，正文未修改。等待上传完成后，补充要求并手动发送。'};
    }catch(error){result={ok:false,message:error instanceof Error?error.message:'选择未附加，请重试。'};}
    finally {if(!accepted&&drafts.length&&runtime)try{runtime.releaseDraftAttachments(drafts);}catch{result={ok:false,message:'附件未附加，但宿主未确认取消上传；请检查附件栏。'};}}
    this.notices.set(sessionId,result.message);this.changed();return result;
  }
}
export const selectionInputBridge=new SelectionInputBridge();
