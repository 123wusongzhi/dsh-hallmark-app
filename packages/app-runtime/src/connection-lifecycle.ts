/** Admission is separate from the execution queue: pausing never moves an admitted call to a new backend. */
export class ConnectionLifecycle {
  private active=0;
  private draining=false;
  private generation=0;
  private idle=new Set<()=>void>();
  get state(){return {state:this.draining?'draining' as const:'ready' as const,active:this.active,cacheGeneration:this.generation};}
  assertReady():void {if(this.draining)throw new Error('CONNECTION_UPDATING');}
  enter():()=>void {
    this.assertReady();this.active++;let released=false;
    return ()=>{if(released)return;released=true;this.active--;if(!this.active){for(const done of this.idle)done();this.idle.clear();}};
  }
  pause():void {this.assertReady();this.draining=true;}
  resume(committed=false):void {if(committed)this.generation++;this.draining=false;}
  async drain(timeoutMs:number,signal?:AbortSignal):Promise<void> {
    if(signal?.aborted)throw new Error('CONNECTION_DRAIN_ABORTED');
    if(!this.active)return;
    await new Promise<void>((resolve,reject)=>{
      const done=()=>{cleanup();resolve();};
      const abort=()=>{cleanup();reject(new Error('CONNECTION_DRAIN_ABORTED'));};
      const timer=setTimeout(()=>{cleanup();reject(new Error('CONNECTION_DRAIN_TIMEOUT'));},timeoutMs);
      const cleanup=()=>{clearTimeout(timer);this.idle.delete(done);signal?.removeEventListener('abort',abort);};
      this.idle.add(done);signal?.addEventListener('abort',abort,{once:true});
    });
  }
}
