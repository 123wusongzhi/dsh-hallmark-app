import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppsClient} from '../../packages/component-runtime/src/apps-client.ts';
import {ComponentHost} from '../../packages/component-runtime/src/host.ts';
import {DataTransfers} from '../../packages/app-presentation/src/data-transfers.ts';
import {createDataTransferReader} from '../../packages/component-runtime/src/data-transfer-client.ts';
import {createVisibleDeadline,chunkProgressKey} from '../../packages/component-runtime/src/visible-deadline.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function clock(){let now=0,id=0;const pending=new Map<number,{at:number;fn:()=>void}>();const timers={now:()=>now,set:(fn:()=>void,ms:number)=>{const key=++id;pending.set(key,{at:now+ms,fn});return key as unknown as ReturnType<typeof setTimeout>;},clear:(key:ReturnType<typeof setTimeout>)=>{pending.delete(key as unknown as number);}};return {timers,pending,get now(){return now;},advance(ms:number){const until=now+ms;while(true){const next=[...pending].sort((a,b)=>a[1].at-b[1].at).find(([,value])=>value.at<=until);if(!next)break;now=next[1].at;pending.delete(next[0]);next[1].fn();}now=until;}};}
async function transferFixture(bytes:number,stall=false){
 const f=clock(),transfers=new DataTransfers(),source:JsonValue={viewId:'controlled',bindings:[{bindingId:'control',state:'ready',payload:{blob:'x'.repeat(bytes)},resources:[]}]},header=transfers.prepare('owner',source) as any;
 assert.ok(header.transfer?.chunks>4);let active=true,reads=0,last='',progress=0,resolveOutcome!:(value:{state:'ready'|'idle'|'absolute';data?:JsonValue})=>void;
 const outcome=new Promise<{state:'ready'|'idle'|'absolute';data?:JsonValue}>(resolve=>{resolveOutcome=resolve;}),deadline=createVisibleDeadline(reason=>{active=false;resolveOutcome({state:reason!});},30000,f.timers);deadline.visible(true);
 const onProgress=(key:string)=>{if(!active)return;last=key;progress++;deadline.progress(key);};
 const reader=createDataTransferReader(async(action,params)=>{
  if(action==='prepare')return header;
  const input=params as {id:string;index:number};
  if(stall&&input.index>=4)return new Promise<JsonValue>(()=>{});
  return new Promise<JsonValue>(resolve=>f.timers.set(()=>{reads++;const chunk=transfers.read('owner',input.id,input.index);assert.equal(chunkProgressKey(chunk,input),`chunk:${input.id}:${header.revision}:${input.index}`,'parent and SDK validate the same milestone');resolve(chunk);},7500));
 },onProgress);
 const raw=reader({method:'getData'});void raw.then(data=>{if(active){deadline.stop();resolveOutcome({state:'ready',data});}},()=>{});await flush();
 return {f,header,raw,outcome,get reads(){return reads;},get progress(){return progress;},duplicate(){if(last)onProgress(last);},stop(){active=false;deadline.stop();f.pending.clear();}};
}
async function advanceUntil(f:Awaited<ReturnType<typeof transferFixture>>,target:()=>boolean,limit=190000){for(let at=0;at<limit&&!target();at+=2500){f.f.advance(2500);await flush();if(f.reads===f.header.transfer.chunks)await f.raw;}assert.ok(target());}
test('validated new chunks keep a slow >30-second transfer alive with no real multi-minute wait',async()=>{
 const f=await transferFixture(1024*1024);try{let done:Awaited<typeof f.outcome>|undefined;void f.outcome.then(value=>{done=value;});await advanceUntil(f,()=>!!done);assert.equal(done?.state,'ready');assert.ok(f.f.now>30000);assert.equal(f.progress,f.header.transfer.chunks);assert.equal((done?.data as any).bindings[0].payload.blob.length,1024*1024);}finally{f.stop();}
});
test('a stopped chunk stream expires after idle time; duplicate blocks and retries do not extend it',async()=>{
 const f=await transferFixture(1024*1024,true);try{let done:Awaited<typeof f.outcome>|undefined;void f.outcome.then(value=>{done=value;});f.f.timers.set(()=>f.duplicate(),15000);f.f.timers.set(()=>f.duplicate(),25000);await advanceUntil(f,()=>!!done);assert.equal(done?.state,'idle');assert.equal(f.f.now,37500);assert.equal(f.reads,4);}finally{f.stop();}
});
test('even continuous validated new chunk progress cannot exceed the 180-second absolute cap',async()=>{
 const f=await transferFixture(8*1024*1024);try{let done:Awaited<typeof f.outcome>|undefined;void f.outcome.then(value=>{done=value;});await advanceUntil(f,()=>!!done);assert.equal(done?.state,'absolute');assert.equal(f.f.now,180000);assert.ok(f.progress>50);assert.ok(f.reads<f.header.transfer.chunks);}finally{f.stop();}
});
test('mismatched, empty and malformed chunk replies never count as progress',async()=>{
 const transfers=new DataTransfers(),data:JsonValue={bindings:[{bindingId:'control',payload:{blob:'x'.repeat(300000)},resources:[]}]},header=transfers.prepare('owner',data) as any;
 for(const defect of ['id','index','revision','empty','base64'] as const){let count=0;const reader=createDataTransferReader(async(action,params)=>{if(action==='prepare')return header;const input=params as {id:string;index:number},valid=transfers.read('owner',input.id,input.index) as Record<string,JsonValue>,bad={...valid,...(defect==='empty'?{chunk:''}:defect==='base64'?{chunk:'%%%'}:{[defect]:defect==='index'?999:'wrong'})};assert.equal(chunkProgressKey(bad,input),'');return bad;},()=>count++);await assert.rejects(reader({method:'getData'}));assert.equal(count,0);}
});

function clientFixture(stopOnFirst=false){
 const source:JsonValue={viewId:'V',bindings:[{bindingId:'control',payload:{blob:'x'.repeat(400000)},resources:[]}]},transfers=new DataTransfers(),header=transfers.prepare('owner',source) as any,progress:string[]=[],listeners=new Set<(event:MessageEvent)=>void>(),origin='http://chunk.fixture',identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:'V',buildId:'B',frameInstanceId:'F'};
 const host=new ComponentHost(identity,{getData:()=>source,getContext:()=>({})},{extensionHandlers:{dataTransferV1:request=>{const input=request.params as {id:string;index:number};return request.action==='prepare'?header:transfers.read('owner',input.id,input.index);}}});
 const parent={postMessage(message:unknown){queueMicrotask(()=>{void host.handle(message).then(response=>{if(response)for(const listener of listeners)listener({source:parent,origin,data:response} as unknown as MessageEvent);});});}},child={parent,location:{origin},addEventListener(_type:string,listener:(event:MessageEvent)=>void){listeners.add(listener);},removeEventListener(_type:string,listener:(event:MessageEvent)=>void){listeners.delete(listener);}};
 const client=createAppsClient({window:child as unknown as Window,clientFeatures:['dataTransferV1'],onReadProgress:key=>{progress.push(key);if(stopOnFirst)client.dispose();}});
 return {client,host,progress,listeners,source,header};
}
test('AppsClient forwards verified progress once per transfer/index and suppresses repeated blocks',async()=>{
 const f=clientFixture();try{assert.deepEqual(await f.client.getData(),f.source);assert.equal(f.progress.length,f.header.transfer.chunks);const before=f.progress.length;assert.deepEqual(await f.client.getData(),f.source);assert.equal(f.progress.length,before,'replaying the same transfer is not new progress');}finally{f.client.dispose();f.host.dispose();assert.equal(f.listeners.size,0);}
});
test('AppsClient disposal during a chunk batch suppresses all late progress and completion',async()=>{
 const f=clientFixture(true);try{await assert.rejects(f.client.getData());await flush();assert.equal(f.progress.length,1);assert.equal(f.listeners.size,0);}finally{f.client.dispose();f.host.dispose();}
});
