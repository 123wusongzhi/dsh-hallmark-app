import type {NativeInputBinding} from './selection-native.ts';

interface PendingDraft {sessionId:string;text:string;resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>;navigated:boolean}
/** Only the host's revision-guarded insertion action may change the draft. */
export class NativeDraftBridge {
  private inputs=new Map<string,{token:object;binding:NativeInputBinding}>();
  private pending?:PendingDraft;
  private current?:string;
  private revision=0;
  private notices=new Map<string,string>();
  private listeners=new Set<()=>void>();
  private waitMs:number;
  constructor(waitMs=10_000){this.waitMs=waitMs;}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  notice(sessionId:string){return this.notices.get(sessionId);}
  private changed(){this.revision++;for(const listener of this.listeners)listener();}
  observeSession(sessionId:string|undefined){
    const changed=this.current!==sessionId;this.current=sessionId;
    if(changed&&sessionId&&this.pending?.navigated&&this.pending.sessionId!==sessionId)this.cancel('聊天已切换，数据源需求未填入。');
  }
  bind(sessionId:string,binding?:NativeInputBinding):()=>void{
    const token={};
    if(binding)this.inputs.set(sessionId,{token,binding});else this.inputs.delete(sessionId);
    queueMicrotask(()=>this.insertPending(sessionId));
    return()=>{if(this.inputs.get(sessionId)?.token===token)this.inputs.delete(sessionId);};
  }
  prepare(sessionId:string,text:string,navigate:(sessionId:string)=>void):Promise<void>{
    if(!sessionId.trim()||!text.trim())return Promise.reject(new Error('请选择原聊天并填写数据源需求。'));
    this.cancel('已有新的数据源需求，之前的填入请求已取消。');
    return new Promise<void>((resolve,reject)=>{
      // Queue before navigation: a synchronous host mount must not lose this intent.
      const pending:PendingDraft={sessionId,text,resolve,reject,timer:setTimeout(()=>{if(this.pending===pending)this.cancel('原聊天输入框尚未就绪，需求未填入，请返回素材库重试。');},this.waitMs),navigated:false};
      this.pending=pending;
      this.notices.set(sessionId,'正在等待原聊天输入框，尚未填入或发送需求。');this.changed();
      try{navigate(sessionId);pending.navigated=true;queueMicrotask(()=>this.insertPending(sessionId));}
      catch(cause){if(this.pending===pending)this.cancel(cause instanceof Error?cause.message:'无法返回原聊天，需求未填入。');}
    });
  }
  private insertPending(sessionId:string){
    const pending=this.pending,input=this.inputs.get(sessionId);
    if(!pending||pending.sessionId!==sessionId||!pending.navigated||!input)return;
    const {binding}=input;
    try{
      const reason=binding.disabledReason();if(reason)throw new Error(reason);
      const state=binding.readState();
      if(!state)throw new Error('原聊天输入框状态不可用，需求未填入。');
      if(!['plain','claimed'].includes(state.phase))throw new Error('聊天正在提交或暂不可编辑，需求未填入，请稍后重试。');
      const {captureInsertion,insertText}=binding.actions;
      if(typeof captureInsertion!=='function'||typeof insertText!=='function')throw new Error('当前宿主不支持保留草稿的文本插入，请复制需求后手动粘贴。');
      const span=captureInsertion.call(binding.actions);
      if(!span||!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<span.start||!Number.isInteger(span.draftRev))throw new Error('未能获取有效的草稿插入位置，需求未填入。');
      if(this.pending!==pending||this.inputs.get(sessionId)?.token!==input.token)return;
      // Consume before the public action: re-entrant renders and StrictMode cannot replay it.
      this.pending=undefined;clearTimeout(pending.timer);
      const inserted=insertText.call(binding.actions,`${span.end>0?'\n\n':''}${pending.text}`,{...span,start:span.end,end:span.end});
      if(inserted!==true)throw new Error('草稿已变化或正在提交，需求未填入，请重试。');
      this.notices.set(sessionId,'数据源需求已填入，请检查后手动发送。');this.changed();
      pending.resolve();
    }catch(cause){if(this.pending===pending){this.pending=undefined;clearTimeout(pending.timer);}const error=cause instanceof Error?cause:new Error('需求未填入，请重试。');this.notices.set(sessionId,error.message);this.changed();pending.reject(error);}
  }
  private cancel(message:string){const pending=this.pending;if(!pending)return;this.pending=undefined;clearTimeout(pending.timer);this.notices.set(pending.sessionId,message);this.changed();pending.reject(new Error(message));}
  reset(){this.cancel('聊天界面已关闭，需求未填入。');this.inputs.clear();this.current=undefined;this.notices.clear();this.changed();}
}
export const nativeDraftBridge=new NativeDraftBridge();
export function prepareNativeDraft(sessionId:string,text:string,navigate:(sessionId:string)=>void):Promise<void>{return nativeDraftBridge.prepare(sessionId,text,navigate);}
