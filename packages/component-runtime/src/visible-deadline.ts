/** Readiness has a bounded visible lifetime; parked tabs retain the remaining allowance. */
export function createVisibleDeadline(callback:()=>void,milliseconds:number,timers={now:()=>Date.now(),set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)}) {
  let remaining=milliseconds,startedAt=0,timer:ReturnType<typeof setTimeout>|undefined,stopped=false;
  const pause=()=>{if(timer!==undefined){timers.clear(timer);timer=undefined;remaining=Math.max(0,remaining-(timers.now()-startedAt));}};
  return {
    visible(value:boolean){pause();if(stopped||!value)return;startedAt=timers.now();timer=timers.set(()=>{timer=undefined;stopped=true;callback();},remaining);},
    stop(){pause();stopped=true;},
  };
}
