import { COMPONENTS_SIDEBAR_KIND } from './sidebar-contract.ts';
import type { NativeSidebarRight } from './sidebar-contract.ts';

interface EntryIntent {sessionId:string;expiresAt:number;arrived:boolean;unsubscribe?:()=>void;timer?:ReturnType<typeof setTimeout>}
const WAIT_LIMIT_MS=10_000;
const OPEN_FAILED='未能自动打开组件栏，请点击「本会话组件」重试。';
const WAIT_EXPIRED='进入聊天已超时，请点击「本会话组件」打开组件栏。';

/** One explicit application-to-chat navigation; ordinary conversation renders never open tabs. */
export class ChatEntryIntent {
  private pending:EntryIntent|undefined;
  private current:string|undefined;
  private revision=0;
  private listeners=new Set<()=>void>();
  private notices=new Map<string,string>();
  private now:()=>number;
  constructor(now:()=>number=Date.now){this.now=now;}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  notice(sessionId:string){return this.notices.get(sessionId);}
  private changed(){this.revision++;for(const listener of this.listeners)listener();}
  private clear(){const intent=this.pending;this.pending=undefined;if(intent?.timer!==undefined)clearTimeout(intent.timer);intent?.unsubscribe?.();}
  /** The root Session observer remains mounted when the application replaces native chat. */
  observeSession(sessionId:string|undefined){
    this.current=sessionId;
    if(this.pending&&this.pending.sessionId!==sessionId){this.clear();this.changed();}
  }
  /** Register before synchronous native navigation so no on-screen transition is missed. */
  enter(sessionId:string,navigate:(sessionId:string)=>void,sidebar:NativeSidebarRight|undefined){
    if(!sessionId.trim())throw new Error('请先选择原有聊天，再进入应用聊天。');
    this.clear();this.notices.delete(sessionId);
    const intent:EntryIntent={sessionId,expiresAt:this.now()+WAIT_LIMIT_MS,arrived:false};
    this.pending=intent;
    intent.timer=setTimeout(()=>this.fail(intent,WAIT_EXPIRED),WAIT_LIMIT_MS);
    const observeMounted=()=>{
      if(this.pending!==intent)return;
      let mounted:string|undefined;
      try{mounted=sidebar?.mounted.getSnapshot();}catch{this.fail(intent);return;}
      if(mounted===sessionId){if(!intent.arrived){intent.arrived=true;this.changed();}}
      else if(mounted!==undefined||intent.arrived){this.clear();this.changed();}
    };
    try{
      intent.unsubscribe=sidebar?.mounted.subscribe?.(observeMounted);
      navigate(sessionId);
      observeMounted();
      this.changed();
    }catch(error){if(this.pending===intent){this.clear();this.changed();}throw error;}
  }
  /** Called from a committed native Session slot; microtask avoids opening within React effects. */
  inputCommitted(sessionId:string|undefined,sidebar:NativeSidebarRight|undefined):()=>void {
    const intent=this.pending;let live=true;
    if(intent&&sessionId===intent.sessionId)queueMicrotask(()=>{
      if(!live||this.pending!==intent)return;
      if(this.now()>=intent.expiresAt){this.fail(intent,WAIT_EXPIRED);return;}
      let mounted:string|undefined;
      try{mounted=sidebar?.mounted.getSnapshot();}catch{this.fail(intent);return;}
      if(this.current!==sessionId||mounted!==undefined&&mounted!==sessionId){this.clear();this.changed();return;}
      // A subscribing host may publish its mounted Session after this input commit.
      // Its invalidation re-runs the input effect; the bounded intent does not guess readiness.
      if(mounted!==sessionId){if(!sidebar?.mounted.subscribe)this.fail(intent);return;}
      // Consume before a re-entrant host open. StrictMode and duplicate input seats cannot replay it.
      this.clear();
      try{
        if(!sidebar||typeof sidebar.openTab!=='function')throw new Error('Sidebar unavailable');
        sidebar.openTab(COMPONENTS_SIDEBAR_KIND,{params:{}});
        this.notices.delete(sessionId);
      }catch{this.notices.set(sessionId,OPEN_FAILED);}
      this.changed();
    });
    return()=>{live=false;};
  }
  private fail(intent:EntryIntent,message=OPEN_FAILED){if(this.pending!==intent)return;this.clear();this.notices.set(intent.sessionId,message);this.changed();}
  /** Plugin/root lifetime end cancels late work and releases the public mounted subscription. */
  reset(){this.clear();this.current=undefined;this.notices.clear();this.changed();}
}
export const chatEntryIntent=new ChatEntryIntent();
