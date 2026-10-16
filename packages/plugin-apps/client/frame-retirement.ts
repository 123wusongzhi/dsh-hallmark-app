/** Closing an iframe and authorizing its replacement may overlap across React mounts. */
type Retirement={promise:Promise<void>;settled:boolean;failed:boolean};
const retirements=new Map<string,Map<string,Retirement>>();
const MAX_SETTLED_FAILURES=128;
function trimFailures():void {
  // Failed documents still cannot authorize in Runtime. Keep a bounded local failure
  // history so immediate reopens explain the problem instead of racing their grant.
  const failed=[...retirements].flatMap(([scope,entries])=>[...entries].filter(([,entry])=>entry.settled&&entry.failed).map(([document])=>({scope,document})));
  for(const {scope,document} of failed.slice(0,Math.max(0,failed.length-MAX_SETTLED_FAILURES))){const entries=retirements.get(scope)!;entries.delete(document);if(!entries.size)retirements.delete(scope);}
}
export function retireDisplayDocument(scope:string,document:string,retire:()=>Promise<void>):Promise<void> {
  let entries=retirements.get(scope);if(!entries){entries=new Map();retirements.set(scope,entries);}
  const previous=entries.get(document);if(previous&&!previous.settled)return previous.promise;
  let resolve!:()=>void,reject!:(error:unknown)=>void;
  const entry:Retirement={promise:new Promise<void>((yes,no)=>{resolve=yes;reject=no;}),settled:false,failed:false};
  // Install the promise before invoking the transport, including synchronous failure.
  entries.set(document,entry);void entry.promise.catch(()=>{});
  void (async()=>{
    try{await retire();entry.settled=true;if(entries!.get(document)===entry){entries!.delete(document);if(!entries!.size&&retirements.get(scope)===entries)retirements.delete(scope);}resolve();}
    catch(error){entry.settled=true;entry.failed=true;reject(error);trimFailures();}
  })();
  return entry.promise;
}
export async function awaitDisplayRetirement(scope:string,signal:AbortSignal):Promise<void> {
  signal.throwIfAborted();
  const entries=retirements.get(scope);if(!entries?.size)return;
  let abort!:()=>void;
  const aborted=new Promise<never>((_,reject)=>{abort=()=>reject(signal.reason??new DOMException('The component was closed.','AbortError'));signal.addEventListener('abort',abort,{once:true});});
  try{await Promise.race([Promise.all([...entries.values()].map(entry=>entry.promise)),aborted]);signal.throwIfAborted();}
  finally{signal.removeEventListener('abort',abort);}
}
