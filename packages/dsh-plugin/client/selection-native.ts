/**
 * DSH 0.2.0-rc.2 compatibility surface. InputActions.addAttachments is public;
 * createDrafts/releaseDraftAttachments are exported ConversationController methods,
 * deliberately absent from the narrower IConversation face. Feature-detect them;
 * never reach into the private draft registry, editor or DOM. See docs/selection-attachments.md.
 */
export interface NativeInputActions {addAttachments:(ids:readonly string[])=>boolean}
export interface NativeInputState {phase:string;attachmentIds:readonly string[]}
export interface NativeInputBinding {
  actions:NativeInputActions;
  readState:()=>NativeInputState|undefined;
  disabledReason:()=>string|undefined;
}
export interface NativeDraftAttachment {kind:'file'|'image';id:string;file:File}
export interface NativeBlockStore {getSnapshot:()=>{reason:string}|undefined;subscribe:(listener:()=>void)=>()=>void}
export interface NativeAttachmentRuntime {
  createDrafts:(sessionId:string,files:readonly File[])=>readonly NativeDraftAttachment[];
  releaseDraftAttachments:(drafts:readonly NativeDraftAttachment[])=>void;
  blocks:{storeFor:(sessionId:string)=>NativeBlockStore};
}
export function nativeAttachmentRuntime(value:unknown):NativeAttachmentRuntime|undefined {
  if(!value||typeof value!=='object')return undefined;
  const candidate=value as Partial<NativeAttachmentRuntime>;
  return typeof candidate.createDrafts==='function'&&typeof candidate.releaseDraftAttachments==='function'&&typeof candidate.blocks?.storeFor==='function'?candidate as NativeAttachmentRuntime:undefined;
}
export function nativeAttachmentDisabledReason(input:NativeInputBinding):string|undefined {
  const reason=input.disabledReason();if(reason)return reason;
  const state=input.readState();
  if(!state||!Array.isArray(state.attachmentIds)||!state.attachmentIds.every(id=>typeof id==='string'))return '原生附件草稿尚未就绪。';
  if(state.phase==='adjudicating'||state.phase==='submitting')return '聊天正在提交，请稍后再附加附件。';
  if(state.phase!=='plain'&&state.phase!=='claimed')return '原生输入状态不支持附加附件。';
  return undefined;
}
export function nativeSessionDisabledReason(state:{removed?:boolean;subagent?:unknown}|undefined):string|undefined {
  if(!state)return '无法核实原聊天状态，请重新打开聊天。';
  if(state.removed)return '该聊天已移除，不能附加附件。';
  if(state.subagent!=null)return '当前 DSH 子代理聊天不支持原生附件。';
  return undefined;
}
