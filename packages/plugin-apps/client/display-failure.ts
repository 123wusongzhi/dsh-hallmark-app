import type {JsonValue} from '../../app-contracts/src/index.ts';
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown,max:number):string|undefined=>typeof value==='string'&&value?value.slice(0,max):undefined;

/** Failures the Runtime or the network may recover from; identity, binding and validation errors never appear here. */
export const TRANSIENT_FAILURE_CODES:ReadonlySet<string>=new Set(['BRIDGE_TIMEOUT','BRIDGE_PROXY_UNAVAILABLE','RUNTIME_UNAVAILABLE','RUNTIME_CONNECTION_LOST','RUNTIME_INVALID_RESPONSE','RUNTIME_STORE_BUSY','RUNTIME_INTERNAL_ERROR','RUNTIME_REQUEST_TIMEOUT']);
export function isTransientFailure(error:unknown):boolean {const value=object(error),failure=object(value.failure);return value.retryPolicy==='read_retry'||failure.retryPolicy==='read_retry'||TRANSIENT_FAILURE_CODES.has(String(value.code));}

export interface DisplayErrorBody {phase:string;code:string;message:string;requestId?:string;attempts?:number;retryPolicy?:string;cause?:string}
/** Clamp every field to the limits the Runtime validates (requestId 128, attempts 1-10, retryPolicy 32, cause 500). */
export function displayErrorBody(problem:DisplayErrorBody):DisplayErrorBody {
  const requestId=text(problem.requestId,128),retryPolicy=text(problem.retryPolicy,32),cause=text(problem.cause,500),attempts=Number.isSafeInteger(problem.attempts)?Math.min(10,Math.max(1,problem.attempts!)):undefined;
  return {phase:problem.phase.slice(0,64),code:problem.code.slice(0,128),message:(problem.message.trim()?problem.message:problem.code||'unknown').slice(0,512),...(requestId?{requestId}:{}),...(attempts!==undefined?{attempts}:{}),...(retryPolicy?{retryPolicy}:{}),...(cause?{cause}:{})};
}
/** Reads code, message and the Runtime's evidence (request id, attempts, cause) from whatever shape a failed call produced. */
export function describeFailure(error:unknown,fallbackCode:string):Omit<DisplayErrorBody,'phase'> {
  const value=object(error),failure=Object.keys(object(value.failure)).length?object(value.failure):value,details=object(failure.details);
  const requestId=text(details.runtimeRequestId,128)??text(details.requestId,128)??text(value.requestId,128),retryPolicy=text(failure.retryPolicy,32),cause=text(details.cause,500);
  const attempts=Number.isSafeInteger(value.attempts)?Number(value.attempts):Number.isSafeInteger(details.attempts)?Number(details.attempts):undefined;
  return {code:String(value.code??failure.code??fallbackCode).slice(0,128),message:(error instanceof Error?error.message:String(error)).slice(0,512),...(requestId?{requestId}:{}),...(retryPolicy?{retryPolicy}:{}),...(cause?{cause}:{}),...(attempts!==undefined?{attempts:Math.min(10,Math.max(1,attempts))}:{})};
}

const defaultSleep=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms),abort=()=>{clearTimeout(timer);reject(signal!.reason);};signal?.addEventListener('abort',abort,{once:true});
});
/** A transient read failure is retried with backoff (default 500 ms then 1500 ms: three attempts); anything else is thrown at once with `attempts` recorded. */
export async function retryTransient<T>(read:()=>Promise<T>,options:{signal?:AbortSignal;delays?:number[];sleep?:(ms:number,signal?:AbortSignal)=>Promise<void>}={}):Promise<T> {
  const delays=options.delays??[500,1500],sleep=options.sleep??defaultSleep;
  for(let attempt=1;;attempt++){
    try{return await read();}
    catch(error){
      if(options.signal?.aborted||attempt>delays.length||!isTransientFailure(error)){if(error!==null&&typeof error==='object')try{(error as {attempts?:number}).attempts=attempt;}catch{}throw error;}
      await sleep(delays[attempt-1],options.signal);
    }
  }
}

/** A definitive Runtime answer (4xx other than timeout and rate limit) will not change on a later attempt. */
export function permanentRejection(error:unknown):boolean {const status=Number(object(error).httpStatus??object(error).statusCode);return status>=400&&status<500&&status!==408&&status!==429;}

interface OutboxEntry {sessionId:string;displayId:string;params:JsonValue;key:string;tries:number;nextAt:number}
export interface DisplayErrorOutbox {
  enqueue(sessionId:string,displayId:string,params:JsonValue):void;
  /** Sends due entries; `force` ignores backoff (a document that just became visible). */
  flush(force?:boolean):Promise<void>;
  size(displayId?:string):number;
  dispose():void;
}
/**
 * Holds display error reports the Runtime could not receive, so a failure the browser saw still reaches `inspect`.
 * At most `maxPerDisplay` reports per display and `maxTries` sends per report (the first, failed send counts). It only
 * sends while the document is visible: every `intervalMs` and when it becomes visible again.
 */
export function createDisplayErrorOutbox(options:{send:(sessionId:string,params:JsonValue,signal:AbortSignal)=>Promise<unknown>;now?:()=>number;visible?:()=>boolean;intervalMs?:number;maxPerDisplay?:number;maxDisplays?:number;maxTries?:number;backoffMs?:number[];sendTimeoutMs?:number;onSettled?:(entry:{sessionId:string;displayId:string;params:JsonValue},outcome:'delivered'|'rejected'|'exhausted')=>void}):DisplayErrorOutbox {
  const now=options.now??Date.now,visible=options.visible??(()=>typeof document==='undefined'||!document.hidden),intervalMs=options.intervalMs??10000,maxPerDisplay=options.maxPerDisplay??5,maxDisplays=options.maxDisplays??20,maxTries=options.maxTries??6,backoff=options.backoffMs??[2000,5000,10000,10000,20000],sendTimeoutMs=options.sendTimeoutMs??5000;
  const rows=new Map<string,OutboxEntry[]>();let timer:ReturnType<typeof setInterval>|undefined,listening=false,flushing=false,disposed=false;
  const total=()=>[...rows.values()].reduce((sum,list)=>sum+list.length,0);
  const onVisible=()=>{if(visible())void flush(true);};
  const stop=()=>{if(timer!==undefined)clearInterval(timer);timer=undefined;if(listening&&typeof document!=='undefined')document.removeEventListener('visibilitychange',onVisible);listening=false;};
  const start=()=>{
    if(disposed||timer!==undefined||!total())return;
    timer=setInterval(()=>void flush(),intervalMs);(timer as {unref?:()=>void}).unref?.();
    if(!listening&&typeof document!=='undefined'){document.addEventListener('visibilitychange',onVisible);listening=true;}
  };
  const remove=(entry:OutboxEntry)=>{const list=rows.get(entry.displayId)?.filter(item=>item!==entry);if(list?.length)rows.set(entry.displayId,list);else rows.delete(entry.displayId);};
  async function flush(force=false):Promise<void> {
    if(flushing||disposed||!visible())return;flushing=true;
    try{
      for(const list of [...rows.values()])for(const entry of [...list]){
        if(!force&&entry.nextAt>now())continue;
        try{await options.send(entry.sessionId,entry.params,AbortSignal.timeout(sendTimeoutMs));remove(entry);options.onSettled?.(entry,'delivered');}
        catch(error){
          if(permanentRejection(error)){remove(entry);options.onSettled?.(entry,'rejected');}
          else if(++entry.tries>=maxTries){remove(entry);options.onSettled?.(entry,'exhausted');}
          else entry.nextAt=now()+backoff[Math.min(entry.tries-1,backoff.length-1)];
        }
      }
    }finally{flushing=false;if(!total())stop();}
  }
  return {
    enqueue(sessionId,displayId,params){
      if(disposed)return;
      const error=object(object(params).error),key=JSON.stringify([error.phase,error.code,error.message]),list=rows.get(displayId)??[],same=list.find(item=>item.key===key);
      if(same)same.params=params;
      else{list.push({sessionId,displayId,params,key,tries:1,nextAt:now()+backoff[0]});while(list.length>maxPerDisplay)list.shift();}
      rows.delete(displayId);rows.set(displayId,list);
      while(rows.size>maxDisplays)rows.delete(rows.keys().next().value as string);
      start();
    },
    flush,
    size:displayId=>displayId===undefined?total():rows.get(displayId)?.length??0,
    dispose(){disposed=true;stop();rows.clear();},
  };
}
