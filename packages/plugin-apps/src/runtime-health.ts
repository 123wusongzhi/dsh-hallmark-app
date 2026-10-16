/** Host-side B7 monitor. A validated installer manifest enables runtime-launcher.ts; no process is ever killed. */
export type RuntimeHealthState='unknown'|'healthy'|'degraded'|'down';
export interface RuntimeHealthOptions {
  probe(signal:AbortSignal):Promise<unknown>;
  intervalMs?:number;
  timeoutMs?:number;
  /** Consecutive failures before `degraded` / `down`. */
  degradedAfter?:number;
  downAfter?:number;
  /** A successful probe slower than this marks the Runtime `degraded` (it answers, but its event loop is stalling). */
  slowMs?:number;
  now?:()=>number;
  wall?:()=>Date;
  log?:(row:Record<string,unknown>)=>void;
}
export interface RuntimeHealthFailure {code:string;message:string}
export interface RuntimeHealthSnapshot {
  monitoring:boolean;
  state:RuntimeHealthState;
  /** True only when an enabled restarter is attempting recovery; observation alone is not automatic recovery. */
  recovering:boolean;
  since:string|null;
  consecutiveFailures:number;
  consecutiveSuccesses:number;
  lastCheckAt:string|null;
  lastOkAt:string|null;
  lastFailureAt:string|null;
  downSince:string|null;
  lastLatencyMs:number|null;
  lastError?:RuntimeHealthFailure;
  /** `unreachable`: connection refused/reset (process likely gone). `unresponsive`: timed out or malformed (process busy or hung). */
  failureKind?:'unreachable'|'unresponsive';
  runtime?:{version?:string;eventLoopLastMaxMs?:number;eventLoopMaxMsSinceStart?:number;inFlight?:number};
  restart:{enabled:false;reason:string}|{enabled:true;restarting:boolean;reason?:string;nextAttemptInMs?:number};
  thresholds:{intervalMs:number;timeoutMs:number;degradedAfter:number;downAfter:number;slowMs:number};
}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
/** Maps whatever a failed probe threw to a stable code and kind. */
export function classifyProbeFailure(error:unknown):RuntimeHealthFailure&{kind:'unreachable'|'unresponsive'} {
  const item=error as {name?:string;code?:unknown;cause?:{code?:string};statusCode?:number;message?:string},cause=item?.cause?.code,code=typeof item?.code==='string'?item.code:undefined;
  const text=(error instanceof Error?`${error.name}: ${error.message}`:String(error)).slice(0,200);
  if(item?.name==='TimeoutError'||item?.name==='AbortError'||code==='RUNTIME_PROBE_TIMEOUT')return {code:'RUNTIME_REQUEST_TIMEOUT',message:'健康检查超时。',kind:'unresponsive'};
  if(Number.isInteger(item?.statusCode))return {code:`RUNTIME_HTTP_${item.statusCode}`,message:text,kind:'unresponsive'};
  if(error instanceof SyntaxError||code==='RUNTIME_INVALID_RESPONSE')return {code:'RUNTIME_INVALID_RESPONSE',message:'健康检查返回了无效响应。',kind:'unresponsive'};
  if(code==='RUNTIME_UNHEALTHY')return {code:'RUNTIME_UNHEALTHY',message:text,kind:'unresponsive'};
  return {code:'RUNTIME_CONNECTION_LOST',message:`${text}${cause?` (${cause})`:''}`.slice(0,200),kind:'unreachable'};
}
export class RuntimeHealthMonitor {
  #probe:RuntimeHealthOptions['probe'];#interval:number;#timeout:number;#degradedAfter:number;#downAfter:number;#slow:number;#now:()=>number;#wall:()=>Date;#log?:RuntimeHealthOptions['log'];
  #state:RuntimeHealthState='unknown';#since:string|null=null;#failures=0;#successes=0;#lastCheck:string|null=null;#lastOk:string|null=null;#lastFailure:string|null=null;#downSince:string|null=null;#downSinceMs=0;
  #latency:number|null=null;#error?:RuntimeHealthFailure;#kind?:'unreachable'|'unresponsive';#runtime?:RuntimeHealthSnapshot['runtime'];
  #timer?:ReturnType<typeof setTimeout>;#stopped=true;#checking?:Promise<RuntimeHealthSnapshot>;#restarting=false;#restartEnabled=false;#restartReason='NO_LAUNCH_SPEC';#restartDue?:number;
  readonly #listeners=new Set<(snapshot:RuntimeHealthSnapshot,previous:RuntimeHealthState)=>void>();
  readonly #checks=new Set<(snapshot:RuntimeHealthSnapshot)=>void>();
  constructor(options:RuntimeHealthOptions){
    this.#probe=options.probe;this.#interval=options.intervalMs??5000;this.#timeout=options.timeoutMs??2000;this.#degradedAfter=Math.max(1,options.degradedAfter??1);this.#downAfter=Math.max(this.#degradedAfter,options.downAfter??3);this.#slow=options.slowMs??1500;
    this.#now=options.now??(()=>performance.now());this.#wall=options.wall??(()=>new Date());this.#log=options.log;
  }
  get state():RuntimeHealthState {return this.#state;}
  onChange(listener:(snapshot:RuntimeHealthSnapshot,previous:RuntimeHealthState)=>void):()=>void {this.#listeners.add(listener);return ()=>{this.#listeners.delete(listener);};}
  onCheck(listener:(snapshot:RuntimeHealthSnapshot)=>void):()=>void {this.#checks.add(listener);return ()=>{this.#checks.delete(listener);};}
  disableRestart(reason:string):void {this.#restartEnabled=false;this.#restarting=false;this.#restartReason=reason;}
  restartStatus(reason:string,due?:number):void {this.#restartReason=reason;this.#restartDue=due;}
  /** Only an installed restarter calls this; observation alone never claims automatic recovery. */
  markRestarting(restarting:boolean):void {this.#restartEnabled=true;this.#restarting=restarting;}
  get restarting():boolean {return this.#restartEnabled&&this.#restarting;}
  start():void {
    if(!this.#stopped)return;this.#stopped=false;
    const loop=async()=>{if(this.#stopped)return;await this.check().catch(()=>{});if(this.#stopped)return;this.#timer=setTimeout(()=>void loop(),this.#interval);this.#timer.unref?.();};
    this.#timer=setTimeout(()=>void loop(),0);this.#timer.unref?.();
  }
  stop():void {this.#stopped=true;if(this.#timer)clearTimeout(this.#timer);this.#timer=undefined;}
  /** One probe. Concurrent calls share the same probe. Never rejects. */
  check():Promise<RuntimeHealthSnapshot> {
    if(this.#checking)return this.#checking;
    this.#checking=this.#run().then(snapshot=>{for(const listener of this.#checks)try{listener(snapshot);}catch{}return snapshot;}).finally(()=>{this.#checking=undefined;});
    return this.#checking;
  }
  async #run():Promise<RuntimeHealthSnapshot> {
    const started=this.#now(),controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('RUNTIME_PROBE_TIMEOUT'),{code:'RUNTIME_PROBE_TIMEOUT'}));},this.#timeout);});
      const body=object(await Promise.race([this.#probe(controller.signal),timeout]));
      if(typeof body.status!=='string')throw Object.assign(new Error('Runtime health response is missing status'),{code:'RUNTIME_INVALID_RESPONSE'});
      if(body.status!=='ok')throw Object.assign(new Error(`Runtime reported status ${String(body.status).slice(0,40)}`),{code:'RUNTIME_UNHEALTHY'});
      this.#succeeded(Math.round((this.#now()-started)*10)/10,body);
    }catch(error){this.#failed(classifyProbeFailure(error),Math.round((this.#now()-started)*10)/10);}
    finally{if(timer)clearTimeout(timer);}
    return this.snapshot();
  }
  #transition(next:RuntimeHealthState,extra:Record<string,unknown>={}):void {
    const previous=this.#state;if(previous===next)return;
    const at=this.#wall().toISOString();this.#state=next;this.#since=at;
    if(next==='down'){this.#downSince=at;this.#downSinceMs=this.#now();}
    const downForMs=previous==='down'&&next==='healthy'?Math.round(this.#now()-this.#downSinceMs):undefined;
    if(next==='healthy')this.#downSince=null;
    try{this.#log?.({ts:at,event:'runtime_health',level:next==='healthy'?'info':'warn',from:previous,to:next,consecutiveFailures:this.#failures,...(this.#error?{code:this.#error.code,message:this.#error.message}:{}),...(this.#kind?{failureKind:this.#kind}:{}),...(this.#latency!==null?{latencyMs:this.#latency}:{}),...(downForMs!==undefined?{downForMs}:{}),...extra});}catch{}
    const snapshot=this.snapshot();for(const listener of this.#listeners)try{listener(snapshot,previous);}catch{}
  }
  #succeeded(latencyMs:number,body:Record<string,unknown>):void {
    this.#lastCheck=this.#lastOk=this.#wall().toISOString();this.#latency=latencyMs;this.#failures=0;this.#successes++;this.#error=undefined;this.#kind=undefined;this.#restarting=false;
    const observability=object(body.observability),loop=object(observability.eventLoop),requests=object(observability.requests);
    this.#runtime={...(typeof body.version==='string'?{version:body.version.slice(0,64)}:{}),...(typeof loop.lastMaxMs==='number'?{eventLoopLastMaxMs:loop.lastMaxMs}:{}),...(typeof loop.maxMsSinceStart==='number'?{eventLoopMaxMsSinceStart:loop.maxMsSinceStart}:{}),...(typeof requests.inFlight==='number'?{inFlight:requests.inFlight}:{})};
    this.#transition(latencyMs>=this.#slow?'degraded':'healthy',latencyMs>=this.#slow?{slow:true}:{});
  }
  #failed(failure:ReturnType<typeof classifyProbeFailure>,latencyMs:number):void {
    this.#lastCheck=this.#lastFailure=this.#wall().toISOString();this.#latency=latencyMs;this.#failures++;this.#successes=0;this.#error={code:failure.code,message:failure.message};this.#kind=failure.kind;
    if(this.#failures>=this.#downAfter)this.#transition('down');
    else if(this.#failures>=this.#degradedAfter)this.#transition('degraded');
  }
  snapshot():RuntimeHealthSnapshot {
    return {
      monitoring:!this.#stopped,state:this.#state,recovering:this.#restarting&&(this.#state==='down'||this.#state==='degraded'&&this.#failures>0),since:this.#since,consecutiveFailures:this.#failures,consecutiveSuccesses:this.#successes,lastCheckAt:this.#lastCheck,lastOkAt:this.#lastOk,lastFailureAt:this.#lastFailure,downSince:this.#downSince,lastLatencyMs:this.#latency,
      ...(this.#error?{lastError:this.#error}:{}),...(this.#kind?{failureKind:this.#kind}:{}),...(this.#runtime?{runtime:this.#runtime}:{}),
      restart:this.#restartEnabled?{enabled:true,restarting:this.#restarting,...(this.#restartReason!=='NO_LAUNCH_SPEC'?{reason:this.#restartReason}:{}),...(this.#restartDue!==undefined?{nextAttemptInMs:Math.max(0,Math.round(this.#restartDue-this.#now()))}:{})}:{enabled:false,reason:this.#restartReason},
      thresholds:{intervalMs:this.#interval,timeoutMs:this.#timeout,degradedAfter:this.#degradedAfter,downAfter:this.#downAfter,slowMs:this.#slow},
    };
  }
}
/** Error codes a transport-level failure may carry; an explicit server answer (any other code, or a 4xx) proves the Runtime is alive. */
export const TRANSPORT_FAILURE_CODES:ReadonlySet<string>=new Set(['RUNTIME_UNAVAILABLE','RUNTIME_CONNECTION_LOST','RUNTIME_REQUEST_TIMEOUT','RUNTIME_INVALID_RESPONSE']);
export interface RuntimeDownLabel {code:'RUNTIME_RESTARTING'|'RUNTIME_DOWN';message:string;details:{state:RuntimeHealthState;consecutiveFailures:number;downForMs:number|null;failureKind?:string;lastErrorCode?:string}}
/** The label a failed Runtime call gets while the monitor says the Runtime is down, or `undefined` when the failure is not a transport failure or the Runtime is not down. */
export function labelRuntimeDown(health:RuntimeHealthMonitor|undefined,evidence:{code?:string;httpStatus?:number}):RuntimeDownLabel|undefined {
  if(!health||health.state!=='down')return undefined;
  if(evidence.code!==undefined&&!TRANSPORT_FAILURE_CODES.has(evidence.code))return undefined;
  if(evidence.httpStatus!==undefined&&evidence.httpStatus<500)return undefined;
  const snapshot=health.snapshot(),restarting=health.restarting,downForMs=snapshot.downSince?Math.max(0,Date.now()-Date.parse(snapshot.downSince)):null;
  const unresponsive=snapshot.failureKind==='unresponsive';
  return {code:restarting?'RUNTIME_RESTARTING':'RUNTIME_DOWN',message:restarting?'Runtime 正在重启，恢复后会自动重试读取。':unresponsive?'Runtime 暂无响应（可能正忙或已退出），正在等待恢复；只读请求可稍后重试。':'Runtime 暂时无法连接，正在等待恢复；只读请求可稍后重试。',details:{state:snapshot.state,consecutiveFailures:snapshot.consecutiveFailures,downForMs,...(snapshot.failureKind?{failureKind:snapshot.failureKind}:{}),...(snapshot.lastError?{lastErrorCode:snapshot.lastError.code}:{})}};
}
