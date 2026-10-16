import {appendFileSync,mkdirSync} from 'node:fs';
import {appendFile,mkdir,readdir,stat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {monitorEventLoopDelay,performance} from 'node:perf_hooks';
import type {IncomingMessage,ServerResponse} from 'node:http';

/** Everything below is observation only: no function here may throw into, or block, the request path. */
export interface LogIo {
  append(path:string,data:string):Promise<void>;
  mkdir(path:string):Promise<void>;
  list(path:string):Promise<string[]>;
  size(path:string):Promise<number>;
  remove(path:string):Promise<void>;
}
const realIo:LogIo={append:(path,data)=>appendFile(path,data,'utf8'),mkdir:async path=>{await mkdir(path,{recursive:true});},list:path=>readdir(path),size:async path=>{try{return (await stat(path)).size;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return 0;throw error;}},remove:path=>unlink(path)};
export interface AsyncJsonlLogOptions {
  directory:string;
  /** File name prefix, e.g. `requests-` gives `requests-2026-10-15.jsonl`. Empty keeps the legacy `2026-10-15.jsonl` name. */
  prefix?:string;
  flushIntervalMs?:number;
  /** Lines beyond this many buffered bytes are dropped (and counted) rather than growing memory while the disk is slow. */
  maxBufferBytes?:number;
  /** A day file rolls to `.1`, `.2`… after this many bytes. 0 disables size rotation. */
  maxFileBytes?:number;
  /** Newest files kept per prefix. 0 disables retention deletion. */
  maxFiles?:number;
  now?:()=>Date;
  io?:Partial<LogIo>;
}
export interface LogStats {written:number;dropped:number;errors:number;bufferedBytes:number;lastError?:string;currentFile?:string}
const escapeRegExp=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/**
 * Buffered JSON-lines appender. `write()` only pushes onto an in-memory array; a timer (armed only while lines are
 * waiting, and unref'ed) appends them with one asynchronous write. One file per day, size-rolled, newest `maxFiles` kept.
 */
export class AsyncJsonlLog {
  readonly directory:string;
  #prefix:string;#interval:number;#maxBuffer:number;#maxFile:number;#maxFiles:number;#now:()=>Date;#io:LogIo;
  #lines:string[]=[];#bytes=0;#timer?:ReturnType<typeof setTimeout>;#chain:Promise<void>=Promise.resolve();#closed=false;
  #written=0;#dropped=0;#droppedReported=0;#errors=0;#lastError?:string;
  #segment?:{day:string;index:number;size:number};#directoryReady=false;
  constructor(options:AsyncJsonlLogOptions){
    this.directory=options.directory;this.#prefix=options.prefix??'';this.#interval=options.flushIntervalMs??250;this.#maxBuffer=options.maxBufferBytes??2*1024*1024;this.#maxFile=options.maxFileBytes??32*1024*1024;this.#maxFiles=options.maxFiles??14;this.#now=options.now??(()=>new Date());this.#io={...realIo,...options.io};
  }
  write(row:Record<string,unknown>):void {
    if(this.#closed)return;
    let line:string;try{line=JSON.stringify(row)+'\n';}catch{this.#dropped++;return;}
    const size=Buffer.byteLength(line);
    if(this.#bytes+size>this.#maxBuffer){this.#dropped++;return;}
    this.#lines.push(line);this.#bytes+=size;
    if(this.#bytes>=262144)void this.flush();else if(!this.#timer){this.#timer=setTimeout(()=>{this.#timer=undefined;void this.flush();},this.#interval);this.#timer.unref?.();}
  }
  stats():LogStats {return {written:this.#written,dropped:this.#dropped,errors:this.#errors,bufferedBytes:this.#bytes,...(this.#lastError?{lastError:this.#lastError}:{}),...(this.#segment?{currentFile:this.#file(this.#segment.day,this.#segment.index)}:{})};}
  #file(day:string,index:number){return join(this.directory,`${this.#prefix}${day}${index?`.${index}`:''}.jsonl`);}
  #take():string {
    if(this.#timer){clearTimeout(this.#timer);this.#timer=undefined;}
    let text=this.#lines.join('');this.#lines=[];this.#bytes=0;
    if(this.#dropped>this.#droppedReported){text+=JSON.stringify({ts:this.#now().toISOString(),event:'log_dropped',dropped:this.#dropped-this.#droppedReported,totalDropped:this.#dropped})+'\n';this.#droppedReported=this.#dropped;}
    return text;
  }
  /** Appends what is buffered. Calls are serialized; failures are counted, never thrown. */
  flush():Promise<void> {
    if(!this.#lines.length&&this.#dropped===this.#droppedReported)return this.#chain;
    const text=this.#take();
    this.#chain=this.#chain.then(()=>this.#append(text)).catch(()=>{});
    return this.#chain;
  }
  async #append(text:string):Promise<void> {
    try{
      const day=this.#now().toISOString().slice(0,10);
      if(!this.#directoryReady){await this.#io.mkdir(this.directory);this.#directoryReady=true;}
      let rotated=false;
      if(this.#segment?.day!==day){
        const existing=(await this.#io.list(this.directory)).map(name=>new RegExp(`^${escapeRegExp(this.#prefix)}${day}(?:\\.(\\d+))?\\.jsonl$`).exec(name)).filter(Boolean).map(match=>Number(match![1]??0)),index=existing.length?Math.max(...existing):0;
        this.#segment={day,index,size:await this.#io.size(this.#file(day,index))};rotated=true;
      }
      const segment=this.#segment!,length=Buffer.byteLength(text);
      if(this.#maxFile>0&&segment.size>0&&segment.size+length>this.#maxFile){segment.index++;segment.size=0;rotated=true;}
      await this.#io.append(this.#file(segment.day,segment.index),text);segment.size+=length;this.#written+=text.split('\n').length-1;
      if(rotated&&this.#maxFiles>0)await this.#prune().catch(()=>{});
    }catch(error){
      this.#errors++;this.#lastError=(error instanceof Error?error.message:String(error)).slice(0,200);
      this.#directoryReady=false;this.#segment=undefined;
    }
  }
  async #prune():Promise<void> {
    const pattern=new RegExp(`^${escapeRegExp(this.#prefix)}(\\d{4}-\\d{2}-\\d{2})(?:\\.(\\d+))?\\.jsonl$`);
    const files=(await this.#io.list(this.directory)).map(name=>{const match=pattern.exec(name);return match?{name,day:match[1],index:Number(match[2]??0)}:undefined;}).filter((item):item is {name:string;day:string;index:number}=>!!item)
      .sort((a,b)=>a.day===b.day?b.index-a.index:a.day<b.day?1:-1);
    for(const old of files.slice(this.#maxFiles))await this.#io.remove(join(this.directory,old.name)).catch(()=>{});
  }
  /** Last-chance synchronous drain for `process.on('exit')`. Never used while serving requests. */
  flushSync():void {
    if(!this.#lines.length)return;
    const text=this.#take();
    try{mkdirSync(this.directory,{recursive:true});const day=this.#now().toISOString().slice(0,10);appendFileSync(this.#file(day,this.#segment?.day===day?this.#segment.index:0),text,'utf8');}catch{this.#errors++;}
  }
  async close():Promise<void> {await this.flush();await this.#chain;this.#closed=true;}
}

const SAFE_ID=/^[-\w.:@]{1,200}$/;
const safeId=(value:unknown):string|undefined=>typeof value==='string'&&SAFE_ID.test(value)?value:undefined;
const object=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
/** Collapses ids so a route can be counted and read at a glance: `/v1/views/:viewId/data`. */
export function routeKind(method:string|undefined,pathname:string):string {
  const route=pathname
    .replace(/^\/v1\/views\/[^/]+/,'/v1/views/:viewId')
    .replace(/^\/v1\/operations\/[^/]+/,'/v1/operations/:operationId')
    .replace(/^\/v1\/invocations\/[^/]+/,'/v1/invocations/:invocationId')
    .replace(/^\/v1\/results\/.+?(\/(?:locate|project|read))?$/,(_all,suffix)=>`/v1/results/:resultRef${suffix??''}`)
    .replace(/^\/v1\/capabilities\/[^/]+/,'/v1/capabilities/:capabilityId')
    .replace(/^\/v1\/component-contexts\/[^/]+/,'/v1/component-contexts/:snapshotId')
    .replace(/^\/v1\/agent-requests\/[^/]+/,'/v1/agent-requests/:requestId')
    .replace(/^\/sessions\/[^/]+/,'/sessions/:sessionId')
    .replace(/^\/source-builds\/[a-f0-9]{64}\/(manifest|thumbnail|files).*$/,'/source-builds/:buildId/$1')
    .replace(/\/[0-9a-f]{16,}(?=\/|$)/gi,'/:id');
  return `${method??'GET'} ${route.slice(0,120)}`;
}
const BODY_TOP=['sessionId','viewId','displayId','publicationId','buildId','frameInstanceId','appId','connectionId','capabilityId','feature','action','operation','invocationId','traceId','name'] as const;
const BODY_PARAMS=['viewId','displayId','publicationId','buildId','attemptId','capabilityId'] as const;
const QUERY_IDS=['sessionId','viewId','displayId','publicationId','buildId','displayGeneration','resource','appId','connectionId'] as const;
export interface InflightRequest {requestId:string;route:string;elapsedMs:number;sessionId?:string;viewId?:string;displayId?:string;publicationId?:string}
interface Entry {requestId:string;method:string;pathname:string;route:string;startedAt:number;startedWall:number;bytes:number;ids:Record<string,string|number>;code?:string;resultStatus?:string}
export interface RequestObserverOptions {
  log:{write(row:Record<string,unknown>):void};
  /** Max event-loop delay over one sampling window that counts as a stall worth reporting. */
  lagThresholdMs?:number;
  lagIntervalMs?:number;
  resolutionMs?:number;
  /** Requests slower than this are flagged `slow:true`. */
  slowMs?:number;
  /** Successful, fast responses of these routes are counted but not written (health probes would be noise). */
  quietRoutes?:readonly string[];
  maxReported?:number;
  now?:()=>number;
  wall?:()=>Date;
}
/** One JSON line per request (route kind, identifiers, status, code, duration, bytes) plus an event-loop stall detector that names the requests around the stall. Never records tokens or payload data. */
export class RequestObserver {
  #log:RequestObserverOptions['log'];
  #threshold:number;#interval:number;#resolution:number;#slow:number;#quiet:Set<string>;#maxReported:number;#now:()=>number;#wall:()=>Date;
  #inflight=new Set<Entry>();#byRequest=new WeakMap<object,Entry>();
  #recent:{requestId:string;route:string;status:number;durationMs:number;endedAt:number;ids:Record<string,string|number>}[]=[];
  #histogram?:ReturnType<typeof monitorEventLoopDelay>;#timer?:ReturnType<typeof setInterval>;#lastTick=0;
  #total=0;#errors=0;#slowCount=0;
  #lag={sampledAt:null as string|null,lastMaxMs:0,p99Ms:0,meanMs:0,maxMsSinceStart:0,lagEvents:0,lastLagAt:null as string|null,lastLagMs:0};
  constructor(options:RequestObserverOptions){
    this.#log=options.log;this.#threshold=options.lagThresholdMs??500;this.#interval=options.lagIntervalMs??1000;this.#resolution=options.resolutionMs??10;this.#slow=options.slowMs??3000;
    this.#quiet=new Set(options.quietRoutes??['GET /health','GET /v1/runtime']);this.#maxReported=options.maxReported??20;this.#now=options.now??(()=>performance.now());this.#wall=options.wall??(()=>new Date());
  }
  /** Entry hook: call as soon as the request id is known. */
  begin(req:IncomingMessage,res:ServerResponse,requestId:string):void {
    try{
      const method=req.method??'GET';let pathname='/',query:URLSearchParams|undefined;
      try{const url=new URL(req.url??'/','http://127.0.0.1');pathname=url.pathname;query=url.searchParams;}catch{pathname=(req.url??'/').split('?',1)[0].slice(0,200);}
      const ids:Record<string,string|number>={};
      if(query)for(const key of QUERY_IDS){const value=query.get(key);if(value===null)continue;if(key==='displayGeneration'){const number=Number(value);if(Number.isSafeInteger(number))ids.displayGeneration=number;}else{const safe=safeId(value);if(safe)ids[key==='resource'?'resource':key]=safe;}}
      const entry:Entry={requestId,method,pathname,route:routeKind(method,pathname),startedAt:this.#now(),startedWall:this.#wall().getTime(),bytes:0,ids};
      this.#inflight.add(entry);this.#byRequest.set(req,entry);
      const write=res.write.bind(res),end=res.end.bind(res);
      res.write=((chunk:unknown,...rest:unknown[])=>{entry.bytes+=chunkSize(chunk);return (write as (...args:unknown[])=>boolean)(chunk,...rest);}) as typeof res.write;
      res.end=((chunk?:unknown,...rest:unknown[])=>{if(chunk!==undefined&&chunk!==null&&typeof chunk!=='function'){entry.bytes+=chunkSize(chunk);this.#captureOutcome(entry,res.statusCode,chunk);}return (end as (...args:unknown[])=>ServerResponse)(chunk,...rest);}) as typeof res.end;
      res.once('close',()=>this.#finish(entry,res));
    }catch{/* observation must never affect serving */}
  }
  /** Body hook: copies an allowlist of identifier fields. Payload keys and non-identifier-shaped values are never read into the log. */
  noteBody(req:IncomingMessage,input:Record<string,unknown>):void {
    try{
      const entry=this.#byRequest.get(req);if(!entry)return;
      for(const key of BODY_TOP){const safe=safeId(input[key]);if(safe)entry.ids[key]=safe;}
      const method=safeId(input.method);if(method)entry.ids.bridgeMethod=method;
      const requestId=safeId(input.requestId);if(requestId)entry.ids.componentRequestId=requestId;
      const params=object(input.params);
      if(params){for(const key of BODY_PARAMS){const safe=safeId(params[key]);if(safe&&entry.ids[key]===undefined)entry.ids[key]=safe;}const inner=safeId(params.method);if(inner)entry.ids.innerMethod=inner;if(Number.isSafeInteger(params.displayGeneration))entry.ids.displayGeneration=params.displayGeneration as number;}
    }catch{}
  }
  #captureOutcome(entry:Entry,status:number,chunk:unknown):void {
    const size=chunkSize(chunk);if(size>(status>=400?65536:2048)||size===0)return;
    try{
      const text=typeof chunk==='string'?chunk:Buffer.from(chunk as Uint8Array).toString('utf8'),first=text.charCodeAt(0);if(first!==123)return;
      const value=JSON.parse(text) as {status?:unknown;error?:unknown},error=value.error;
      const code=typeof error==='string'?error:object(error)?.code;
      if(typeof code==='string'&&/^[\w.:-]{1,128}$/.test(code))entry.code=code;
      if(typeof value.status==='string'&&/^[a-z_]{1,32}$/.test(value.status))entry.resultStatus=value.status;
    }catch{}
  }
  #finish(entry:Entry,res:ServerResponse):void {
    try{
      this.#inflight.delete(entry);
      const endedAt=this.#now(),durationMs=Math.round((endedAt-entry.startedAt)*10)/10,status=res.statusCode,aborted=!res.writableFinished;
      this.#total++;if(status>=500)this.#errors++;
      const slow=durationMs>=this.#slow;if(slow)this.#slowCount++;
      this.#recent.push({requestId:entry.requestId,route:entry.route,status,durationMs,endedAt,ids:entry.ids});if(this.#recent.length>64)this.#recent.shift();
      if(this.#quiet.has(entry.route.replace(/\?.*$/,''))&&status<400&&!slow&&!aborted)return;
      this.#log.write({ts:this.#wall().toISOString(),event:'runtime_request',requestId:entry.requestId,method:entry.method,route:entry.route.slice(entry.method.length+1),status,durationMs,bytes:entry.bytes,...(entry.code?{code:entry.code}:{}),...(entry.resultStatus?{resultStatus:entry.resultStatus}:{}),...(aborted?{aborted:true}:{}),...(slow?{slow:true}:{}),...entry.ids});
    }catch{}
  }
  inFlight():InflightRequest[] {
    const now=this.#now();
    return [...this.#inflight].map(entry=>({requestId:entry.requestId,route:entry.route,elapsedMs:Math.round(now-entry.startedAt),...pickIds(entry.ids)})).sort((a,b)=>b.elapsedMs-a.elapsedMs);
  }
  /** Starts the stall detector. `sample()` can be called directly in tests. */
  start():void {
    if(this.#timer)return;
    this.#histogram=monitorEventLoopDelay({resolution:this.#resolution});this.#histogram.enable();this.#lastTick=this.#now();
    this.#timer=setInterval(()=>this.sample(),this.#interval);this.#timer.unref?.();
  }
  /** Reads and resets the delay histogram; reports a stall line when the worst delay exceeds the threshold. */
  sample():{maxMs:number;stalled:boolean} {
    const now=this.#now(),elapsed=now-this.#lastTick,drift=Math.max(0,elapsed-this.#interval);this.#lastTick=now;
    let maxMs=drift,p99=0,mean=0;
    if(this.#histogram){
      const toMs=(value:number)=>Number.isFinite(value)?value/1e6:0;
      maxMs=Math.max(drift,toMs(this.#histogram.max)-this.#resolution);p99=Math.max(0,toMs(this.#histogram.percentile(99))-this.#resolution);mean=Math.max(0,toMs(this.#histogram.mean)-this.#resolution);this.#histogram.reset();
    }
    maxMs=Math.max(0,Math.round(maxMs*10)/10);
    const at=this.#wall().toISOString();
    this.#lag.sampledAt=at;this.#lag.lastMaxMs=maxMs;this.#lag.p99Ms=Math.round(p99*10)/10;this.#lag.meanMs=Math.round(mean*10)/10;this.#lag.maxMsSinceStart=Math.max(this.#lag.maxMsSinceStart,maxMs);
    const stalled=maxMs>=this.#threshold;
    if(stalled){
      this.#lag.lagEvents++;this.#lag.lastLagAt=at;this.#lag.lastLagMs=maxMs;
      try{
        const windowStart=now-Math.max(elapsed,this.#interval)-maxMs;
        const overlapping=this.#recent.filter(item=>item.endedAt>=windowStart&&item.durationMs>=Math.min(this.#threshold,maxMs)/2).slice(-this.#maxReported).map(item=>({requestId:item.requestId,route:item.route,status:item.status,durationMs:item.durationMs,endedAgoMs:Math.round(now-item.endedAt),...pickIds(item.ids)}));
        const inflight=this.inFlight();
        this.#log.write({ts:at,event:'event_loop_lag',level:'warn',maxMs,p99Ms:this.#lag.p99Ms,meanMs:this.#lag.meanMs,driftMs:Math.round(drift),windowMs:Math.round(elapsed),thresholdMs:this.#threshold,inFlightCount:inflight.length,inFlight:inflight.slice(0,this.#maxReported),completedDuring:overlapping});
      }catch{}
    }
    return {maxMs,stalled};
  }
  /** Additive `/health` fields. */
  stats():{eventLoop:Record<string,unknown>;requests:Record<string,unknown>} {
    return {eventLoop:{thresholdMs:this.#threshold,intervalMs:this.#interval,...this.#lag},requests:{total:this.#total,inFlight:this.#inflight.size,errors5xx:this.#errors,slow:this.#slowCount,slowMs:this.#slow}};
  }
  stop():void {if(this.#timer)clearInterval(this.#timer);this.#timer=undefined;this.#histogram?.disable();this.#histogram=undefined;}
}
function chunkSize(chunk:unknown):number {return typeof chunk==='string'?Buffer.byteLength(chunk):chunk instanceof Uint8Array?chunk.byteLength:0;}
function pickIds(ids:Record<string,string|number>):Partial<InflightRequest> {const out:Record<string,string>={};for(const key of ['sessionId','viewId','displayId','publicationId'] as const)if(typeof ids[key]==='string')out[key]=ids[key] as string;return out;}
