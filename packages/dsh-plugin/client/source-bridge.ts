import type {BindingData,ViewSpec,SourceView} from '../../presentation/src/types.ts';
import {SOURCE_CHANNEL} from '../../component-runtime/src/client.ts';
import type {SourceAttachRequest,SourceAttachResult,SourceContext,SourceData,SourceRequest} from '../../component-runtime/src/client.ts';
import {buildBoundProductSelection,getProductSelectionRows} from './selection.ts';
import type {ProductSelectionContext} from './selection.ts';
import {payloadRows} from './model.ts';

export function isSourceView(spec:ViewSpec):spec is SourceView {
  const candidate=spec as SourceView;return candidate.kind==='source'&&typeof candidate.source?.buildId==='string'&&typeof candidate.source.entry==='string';
}
export function sourceData(spec:ViewSpec,data:BindingData[],revision:string):SourceData {
  return {bindings:data,revision,selection:spec.bindings.map(binding=>({bindingId:binding.id,...getProductSelectionRows(binding,data.find(item=>item.bindingId===binding.id),payloadRows(data.find(item=>item.bindingId===binding.id)?.payload))}))};
}
export function sourceSelection(sessionId:string,spec:ViewSpec,data:BindingData[],request:SourceAttachRequest,revision:string):ProductSelectionContext {
  if(!request||typeof request!=='object')throw new Error('缺少产品选择。');
  if(request.revision!==undefined&&request.revision!==revision)throw new Error('数据已刷新，请根据当前数据重新选择。');
  const binding=spec.bindings.find(item=>item.id===request.bindingId);const snapshot=data.find(item=>item.bindingId===request.bindingId);
  if(!binding||!Array.isArray(request.keys)||!request.keys.length||request.keys.some(key=>typeof key!=='string'))throw new Error('请先从当前组件选择产品。');
  const available=getProductSelectionRows(binding,snapshot,payloadRows(snapshot?.payload));if(!available.eligible)throw new Error(available.reason);
  const selected=new Set(request.keys);if(selected.size!==request.keys.length)throw new Error('选择包含重复产品，请重新选择。');
  const rows=available.rows.filter(item=>selected.has(item.key));if(rows.length!==selected.size)throw new Error('选择已失效，请根据当前数据重新选择。');
  return buildBoundProductSelection(sessionId,spec,'source',binding,snapshot,rows.map(item=>item.row));
}
export function isSourceRequest(message:unknown):message is SourceRequest {
  const item=message as SourceRequest;return Boolean(item&&item.channel===SOURCE_CHANNEL&&typeof item.requestId==='string'&&typeof item.method==='string');
}
export interface SourceHostHandlers {
  data:()=>SourceData;context:()=>SourceContext;refresh:()=>Promise<SourceData>;
  attach:(request:SourceAttachRequest)=>SourceAttachResult;resize:(height:number)=>void;
}
export async function handleSourceRequest(request:SourceRequest,handlers:SourceHostHandlers):Promise<unknown> {
  switch(request.method){
    case 'getData':return handlers.data();
    case 'getContext':return handlers.context();
    case 'refresh':return handlers.refresh();
    case 'attachSelection':return handlers.attach(request.params as SourceAttachRequest);
    case 'resize':{const height=(request.params as {height?:unknown})?.height;if(typeof height!=='number'||!Number.isFinite(height)||height<=0)throw new Error('无效组件高度。');handlers.resize(height);return;}
    default:throw new Error(`未知宿主操作：${request.method}`);
  }
}
