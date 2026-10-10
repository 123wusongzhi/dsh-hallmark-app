import type {AppsRuntime,RuntimeOperation} from '../../app-runtime/src/index.ts';

/** Inspects original requests, then uses a distinct runtime path for already-authorized continuations. */
export class BusinessOperationPoller {
  private timer?:ReturnType<typeof setTimeout>;
  private active?:Promise<void>;
  private closed=false;
  private controller=new AbortController();
  private attempts=new Map<string,{count:number;next:number}>();
  readonly runtime:AppsRuntime;
  constructor(runtime:AppsRuntime){this.runtime=runtime;}
  start():void {if(this.timer||this.closed)return;this.timer=setTimeout(()=>{this.timer=undefined;this.active=this.tick().finally(()=>{this.active=undefined;this.start();});},2000);this.timer.unref();}
  async tick():Promise<void>{
    if(this.closed)return;
    const pending=this.runtime.store.list<RuntimeOperation>('operations').filter(op=>op.appId==='hallmark'&&['pending','unknown'].includes(op.state)&&/^(?:hallmark\.plan\.|hallmark\.listing\.draft\.|hallmark\.(?:api\.)?products\.(?:update_price|update_stock|list_product)$)/.test(op.capabilityId));
    for(const op of pending){
      if(this.closed)return;const progress=this.attempts.get(op.operationId)??{count:0,next:0};if(progress.next>Date.now())continue;
      try{
        await this.runtime.inspect(op.operationId,this.controller.signal);
        if(!this.closed&&['pending','unknown'].includes(this.runtime.store.get<RuntimeOperation>('operations',op.operationId)?.state??''))await this.runtime.continueAuthorized(op.operationId,this.controller.signal);
      }catch{/* Preserve the original unresolved operation. */}
      progress.count++;progress.next=Date.now()+Math.min(60000,2000*2**Math.min(progress.count,5));this.attempts.set(op.operationId,progress);
    }
    const live=new Set(pending.map(op=>op.operationId));for(const id of this.attempts.keys())if(!live.has(id))this.attempts.delete(id);
  }
  async stop():Promise<void>{this.closed=true;this.controller.abort(new Error('BUSINESS_POLLER_STOPPED'));if(this.timer)clearTimeout(this.timer);await this.active;}
}
