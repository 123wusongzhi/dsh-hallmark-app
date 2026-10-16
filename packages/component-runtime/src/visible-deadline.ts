export const DISPLAY_NO_PROGRESS_MS=30_000;
export const DISPLAY_ABSOLUTE_MS=180_000;
export function remainingDisplayBudget(openedAt?:string):number {const at=Date.parse(openedAt??'');return Number.isFinite(at)?Math.max(0,DISPLAY_ABSOLUTE_MS-Math.max(0,Date.now()-at)):DISPLAY_ABSOLUTE_MS;}
/** Only new milestones reset visible idle time. Elapsed heartbeats/retries are not milestones; wall time always has a cap. */
export function createVisibleDeadline(callback:(reason?:'idle'|'absolute')=>void,milliseconds:number,timers={now:()=>Date.now(),set:(fn:()=>void,ms:number)=>setTimeout(fn,ms),clear:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)},absoluteMs=DISPLAY_ABSOLUTE_MS) {
  let remaining=milliseconds,startedAt=0,timer:ReturnType<typeof setTimeout>|undefined,absolute:ReturnType<typeof setTimeout>|undefined,stopped=false,visible=false;
  const milestones=new Set<string>();
  const pause=()=>{if(timer!==undefined){timers.clear(timer);timer=undefined;remaining=Math.max(0,remaining-(timers.now()-startedAt));}};
  const stop=()=>{pause();if(absolute!==undefined)timers.clear(absolute);absolute=undefined;stopped=true;};
  const fire=(reason:'idle'|'absolute')=>{if(stopped)return;stop();callback(reason);};
  const resume=()=>{if(stopped||!visible)return;startedAt=timers.now();timer=timers.set(()=>fire('idle'),remaining);};
  absolute=timers.set(()=>fire('absolute'),absoluteMs);
  return {
    visible(value:boolean){pause();visible=value;resume();},
    progress(milestone:string){if(stopped||!milestone||milestones.has(milestone)||milestones.size>=512)return;milestones.add(milestone);pause();remaining=milliseconds;resume();},
    stop,
  };
}
/** Control responses and chunk-transfer metadata share the same substantive data milestones. */
export function dataProgressKey(value:unknown):string {
  const object=(item:unknown):Record<string,unknown>=>item!==null&&typeof item==='object'&&!Array.isArray(item)?item as Record<string,unknown>:{};
  const data=object(value),bindings=(object(data.metadata).bindings??data.bindings);
  if(!Array.isArray(bindings))return '';
  return 'data:'+JSON.stringify(bindings.map(item=>{const binding=object(item);return [binding.bindingId,binding.datasetId,binding.state,binding.revision,object(binding.preparation).phase];}).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
/** Parent-side mirror of the reader's identity/index/base64 checks, never an iframe-supplied heartbeat. */
export function chunkProgressKey(value:unknown,expected:unknown):string {
  const object=(item:unknown):Record<string,unknown>=>item!==null&&typeof item==='object'&&!Array.isArray(item)?item as Record<string,unknown>:{};
  const chunk=object(value),request=object(expected);
  if(typeof chunk.id!=='string'||!chunk.id||chunk.id.length>160||chunk.id!==request.id||!Number.isSafeInteger(chunk.index)||Number(chunk.index)<0||Number(chunk.index)>=512||chunk.index!==request.index||typeof chunk.revision!=='string'||!/^[a-f0-9]{64}$/.test(chunk.revision)||typeof chunk.chunk!=='string'||!chunk.chunk||chunk.chunk.length>90000)return '';
  try{const bytes=atob(chunk.chunk).length;if(!bytes||bytes>65536)return '';}catch{return '';}
  return `chunk:${chunk.id}:${chunk.revision}:${chunk.index}`;
}
