import type { InvocationContext, ToolResult } from '../../contracts/src/index.ts';
export interface SchedulerCore { getRefreshCandidates(now?: Date): string[]; refreshDatasetBackground(key: string): Promise<ToolResult> }
export interface SchedulerStore { get<T = any>(collection: string,id: string): T | undefined; put<T>(collection: string,id: string,value: T): T }
/** Data-only scheduler. No write module or stored operation replay dependency. */
export class SnapshotScheduler {
  readonly core: SchedulerCore;
  readonly store: SchedulerStore;
  readonly times: string[];
  private timer?: ReturnType<typeof setInterval>;
  private running=false;
  private stopped=false;
  private tickCount=0;
  readonly report: (error: unknown) => void;
  constructor(core: SchedulerCore,store: SchedulerStore,options: {times?:string[]; report?:(error:unknown)=>void}={}) {
    this.core=core; this.store=store; this.times=options.times??['08:30','20:30']; this.report=options.report??console.error;
    if(!this.times.length||this.times.some(time=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('INVALID_SCHEDULE_TIMES');
  }
  start(): void {if(this.timer) return; this.stopped=false; void this.tick(new Date(),true).catch(this.report); this.timer=setInterval(()=>{void this.tick().catch(this.report);},30_000); this.timer.unref();}
  stop(): void {this.stopped=true; if(this.timer) clearInterval(this.timer); this.timer=undefined;}
  async tick(now=new Date(),startup=false): Promise<void> {
    if(this.running||this.stopped) return;
    this.running=true;
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
    } finally {this.running=false;}
  }
  get stats(): {ticks:number;running:boolean} {return {ticks:this.tickCount,running:this.running};}
}
