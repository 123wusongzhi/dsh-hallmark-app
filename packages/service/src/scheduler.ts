import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
export interface SchedulerCore { getRefreshCandidates(now?: Date): string[]; refreshDatasetBackground(key: string): Promise<ToolResult> }
export interface SchedulerStore { get<T = any>(collection: string,id: string): T | undefined; put<T>(collection: string,id: string,value: T): T }
interface SnapshotTickWorkerOptions {tick:(now:Date,startup:boolean)=>Promise<void>;now?:()=>Date;report?:(error:unknown)=>void;intervalMs?:number}
/** Shared timer and single-flight mechanism for both legacy snapshots and Runtime-bound Apps plans. */
export class SnapshotTickWorker {
  private timer?:ReturnType<typeof setInterval>;
  private work?:Promise<void>;
  private stopped=true;
  private options:SnapshotTickWorkerOptions;
  constructor(options:SnapshotTickWorkerOptions){this.options=options;}
  start():void {if(this.timer)return;this.stopped=false;this.timer=setInterval(()=>{void this.tick().catch(this.options.report??console.error);},this.options.intervalMs??30000);this.timer.unref();void this.tick(this.options.now?.()??new Date(),true).catch(this.options.report??console.error);}
  stop():void {this.stopped=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;}
  get running():boolean{return !!this.work;}
  get online():boolean{return !this.stopped&&!!this.timer;}
  async idle():Promise<void>{await this.work;}
  async tick(now=this.options.now?.()??new Date(),startup=false):Promise<void>{
    if(this.work)return;
    const work=this.options.tick(now,startup);this.work=work;
    try{await work;}finally{if(this.work===work)this.work=undefined;}
  }
}
/** Data-only scheduler. No write module or stored operation replay dependency. */
export class SnapshotScheduler {
  readonly core: SchedulerCore;
  readonly store: SchedulerStore;
  readonly times: string[];
  private worker:SnapshotTickWorker;
  private stopped=false;
  private tickCount=0;
  readonly report: (error: unknown) => void;
  constructor(core: SchedulerCore,store: SchedulerStore,options: {times?:string[]; report?:(error:unknown)=>void}={}) {
    this.core=core; this.store=store; this.times=options.times??['08:30','20:30']; this.report=options.report??console.error;
    if(!this.times.length||this.times.some(time=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('INVALID_SCHEDULE_TIMES');
    this.worker=new SnapshotTickWorker({tick:(now,startup)=>this.refresh(now,startup),report:this.report});
  }
  start(): void {this.stopped=false;this.worker.start();}
  stop(): void {this.stopped=true;this.worker.stop();}
  async tick(now=new Date(),startup=false): Promise<void> {
    if(this.stopped)return;await this.worker.tick(now,startup);
  }
  private async refresh(now:Date,startup:boolean):Promise<void> {
    try {
      const localDay=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const minute=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const due=this.times.filter(time=>time<=minute && !this.store.get('settings',`schedule:${localDay}:${time}`));
      const candidates=[...new Set(this.core.getRefreshCandidates(now))];
      // A completed schedule means dispatched, not that a delayed rate-limited read was lost.
      const retries=candidates.filter(key=>{const entry=this.store.get('settings',`cooldown:${key}`);return entry?.pending===true&&entry.until<=now.getTime();});
      if(!startup&&!due.length&&!retries.length) return;
      const keys=startup||due.length?candidates:retries;
      for(const key of keys) {
        if(this.stopped) break;
        const snapshot=this.store.get('snapshots',key);
        const retry=retries.includes(key);
        if(startup&&!due.length&&!retry&&snapshot?.lastSuccessAt&&now.getTime()-Date.parse(snapshot.lastSuccessAt)<12*3600_000) continue;
        // Rate-limit cooldown survives ticks and restart. Three deferred reads per episode,
        // then only a later planned refresh may start another bounded episode.
        const cooldown=this.store.get('settings',`cooldown:${key}`);
        if(cooldown?.until>now.getTime()) continue;
        const result=await this.core.refreshDatasetBackground(key);
        const delay=result.error?.retryAfterMs;
        if(typeof delay==='number'&&Number.isFinite(delay)&&delay>0) {
          const attempts=(retry&&Number.isSafeInteger(cooldown?.attempts)?cooldown.attempts:0)+1;
          this.store.put('settings',`cooldown:${key}`,{until:now.getTime()+delay,pending:attempts<=3,attempts});
        } else if(cooldown) this.store.put('settings',`cooldown:${key}`,{until:0,pending:false,attempts:0});
      }
      for(const time of due) this.store.put('settings',`schedule:${localDay}:${time}`,{completedAt:now.toISOString()});
      this.tickCount++;
    } finally { /* The shared worker releases its single-flight barrier after this batch. */ }
  }
  get stats(): {ticks:number;running:boolean} {return {ticks:this.tickCount,running:this.worker.running};}
}
