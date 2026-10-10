import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

// Each fixture runs the actual hook in a separate process. Only its bridge and
// browser clock are replaced, so no test waits for a TTL or calls a live service.
const harness=`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
const NativeDate=Date;
let now=NativeDate.parse('2026-10-09T00:00:00.000Z'),timerId=0,disposed=0;
const timers=new Map(),documentListeners=new Map(),windowListeners=new Map(),requests=[];
class ClockDate extends NativeDate {
  constructor(...args){if(args.length)super(...args);else super(now);}
  static now(){return now;}
}
globalThis.Date=ClockDate;
globalThis.setTimeout=(callback,delay=0,...args)=>{
  const id=++timerId;
  timers.set(id,{at:now+Math.max(1,Number(delay)||0),callback:()=>callback(...args)});
  return id;
};
globalThis.clearTimeout=id=>{timers.delete(id);};
function addListener(listeners,type,listener){
  if(!listeners.has(type))listeners.set(type,new Set());
  listeners.get(type).add(listener);
}
globalThis.document={hidden:false,get visibilityState(){return this.hidden?'hidden':'visible';},
  addEventListener:(type,listener)=>addListener(documentListeners,type,listener),
  removeEventListener:(type,listener)=>documentListeners.get(type)?.delete(listener)};
globalThis.window={document:globalThis.document,setTimeout,clearTimeout,
  addEventListener:(type,listener)=>addListener(windowListeners,type,listener),
  removeEventListener:(type,listener)=>windowListeners.get(type)?.delete(listener)};
const binding=(bindingId,after,stale=false)=>({bindingId,state:'ready',revision:'r1',payload:{items:[bindingId],cache:{nextRefreshAt:new Date(now+after).toISOString(),stale}}});
const packet=(...bindings)=>({bindings});
const queue=(method,...args)=>new Promise((resolve,reject)=>requests.push({method,args,at:now,resolve,reject}));
let api,tree,subscriber,visibilitySubscriber;
function Component(){api=useApps();return null;}
async function mount(data){
  globalThis.fakeClient={hello:async()=>({features:[]}),getData:async()=>data,getContext:async()=>({}),
    isVisible:()=>true,subscribeVisibility:listener=>{visibilitySubscriber=listener;return()=>{visibilitySubscriber=undefined;};},
    subscribe:listener=>{subscriber=listener;return()=>{subscriber=undefined;};},
    dispose(){disposed++;},reportFrameError(){},
    refresh:(...args)=>queue('refresh',...args),readBindingPage:(...args)=>queue('page',...args)};
  await act(async()=>{tree=create(React.createElement(Component));});
  assert.equal(api.loading,false);
}
async function advance(milliseconds){
  const until=now+milliseconds;
  for(let count=0;;count++){
    const next=[...timers.entries()].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next)break;
    assert.ok(count<1000,'timer loop did not settle');
    now=next[1].at;timers.delete(next[0]);
    await act(async()=>{next[1].callback();});
  }
  now=until;
  await act(async()=>{});
}
async function visibility(hidden){
  await act(async()=>{
    document.hidden=hidden;
    for(const listener of documentListeners.get('visibilitychange')??[])listener({type:'visibilitychange'});
  });
}
async function settle(index,value){await act(async()=>{requests[index].resolve(value);});}
async function unmount(){await act(async()=>{tree.unmount();});}
`;

async function checkHook(fixture:string){
  const root=resolve('test/apps-components/artifacts');mkdirSync(root,{recursive:true});
  const directory=mkdtempSync(join(root,'sdk-cache-')),output=join(directory,'test.mjs');
  const source=readFileSync('packages/component-runtime/src/apps-react.tsx','utf8').replace(
    "import {createAppsClient,ComponentBridgeError} from './apps-client.ts';",
    'const createAppsClient=()=>globalThis.fakeClient;class ComponentBridgeError extends Error {}',
  ).replace("from './latest-state-saver.ts'","from './packages/component-runtime/src/latest-state-saver.ts'");
  await build({stdin:{contents:source+'\n'+harness+'\n'+fixture+'\nconsole.log("CACHE_PASS");',loader:'tsx',resolveDir:resolve('.')},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'});
  const result=spawnSync(process.execPath,[output],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
  assert.match(result.stdout,/CACHE_PASS/);
}

test('useApps pauses a retained hidden iframe through host visibility and resumes its overdue cache once',async()=>{
  await checkHook(`
await mount(packet(binding('products',1000)));
await act(async()=>visibilitySubscriber(false));await advance(60000);assert.equal(requests.length,0);
await act(async()=>visibilitySubscriber(true));await advance(1);assert.equal(requests.length,1);assert.deepEqual(requests[0].args,[['products'],{forceRefresh:false}]);
await settle(0,packet(binding('products',60000)));await unmount();assert.equal(visibilitySubscriber,undefined);assert.equal(timers.size,0);
`);
});

test('useApps manual refresh forces a new read and preserves the requested binding ids',async()=>{
  await checkHook(`
await mount(packet(binding('products',60000)));
let result;
await act(async()=>{result=api.refresh(['products']);});
assert.deepEqual(requests[0].args,[['products'],{forceRefresh:true}]);
const refreshed=packet(binding('products',120000));
await act(async()=>{requests[0].resolve(refreshed);await result;});
assert.deepEqual(api.data,refreshed);
await act(async()=>{result=api.refresh();});
assert.deepEqual(requests[1].args,[undefined,{forceRefresh:true}]);
await act(async()=>{requests[1].resolve(refreshed);await result;});
await unmount();
`);
});

test('useApps keeps snapshots visible during manual and background refresh and polls completion before the fifteen-minute TTL',async()=>{
  await checkHook(`
const initial=packet(binding('products',900000));
await mount(initial);assert.equal(api.loading,false);assert.equal(api.refreshing,false);
let manual;await act(async()=>{manual=api.refresh(['products']);});
assert.equal(api.loading,false,'cached content must never switch back to its initial loading screen');
assert.equal(api.refreshing,true);assert.deepEqual(api.data,initial);
const previous={...initial.bindings[0],payload:{...initial.bindings[0].payload,cache:{...initial.bindings[0].payload.cache,refreshing:true,nextRefreshAt:new Date(now+2000).toISOString()}}};
await act(async()=>{requests[0].resolve(packet(previous));await manual;});
assert.equal(api.loading,false);assert.equal(api.refreshing,true);assert.deepEqual(api.data.bindings[0].payload.items,['products']);
await act(async()=>{await api.refresh(['products']);});assert.equal(requests.length,1,'an existing background refresh must not be forced again');
await advance(1999);assert.equal(requests.length,1);
await advance(1);assert.equal(requests.length,2);assert.deepEqual(requests[1].args,[['products'],{forceRefresh:false}]);
const completed=packet({...binding('products',900000),payload:{items:['new snapshot'],cache:{ttlMs:900000,refreshing:false,nextRefreshAt:new Date(now+900000).toISOString()}}});
await settle(1,completed);assert.deepEqual(api.data,completed);assert.equal(api.loading,false);assert.equal(api.refreshing,false);
await advance(899999);assert.equal(requests.length,2);await advance(1);assert.equal(requests.length,3);
await unmount();
`);
});

test('useApps refreshes expired cache bindings at their TTL and schedules the next payload',async()=>{
  await checkHook(`
const initial=packet(binding('products',1000),binding('stock',3000));
await mount(initial);
await advance(999);assert.equal(requests.length,0);
await advance(1);assert.equal(requests.length,1);
assert.equal(requests[0].method,'refresh');
assert.deepEqual(requests[0].args,[['products'],{forceRefresh:false}]);
const refreshed=packet(binding('products',10000),binding('stock',2000));
await settle(0,refreshed);
assert.deepEqual(api.data,refreshed);assert.equal(api.loading,false);
await advance(1999);assert.equal(requests.length,1);
await advance(1);assert.equal(requests.length,2);
assert.deepEqual(requests[1].args,[['stock'],{forceRefresh:false}]);
await unmount();
`);
});

test('useApps respects provider retry deadlines for stale cache and ignores missing or malformed TTLs',async()=>{
  await checkHook(`
const invalid={bindingId:'invalid',payload:{cache:{nextRefreshAt:'not-a-date',stale:false}}};
const manual={bindingId:'manual',payload:{items:[]}};
const stale=binding('stale',60000,true);
await mount(packet(stale,binding('expired',-1000),invalid,manual));
await advance(1);
assert.equal(requests.length,1);
assert.deepEqual(requests[0].args[0],['expired']);
assert.deepEqual(requests[0].args[1],{forceRefresh:false});
await settle(0,packet(stale,invalid,manual));
await advance(59998);assert.equal(requests.length,1,'stale data must still respect the provider retry deadline');
await advance(1);assert.equal(requests.length,2);
assert.deepEqual(requests[1].args,[['stale'],{forceRefresh:false}]);
await settle(1,packet(invalid,manual));
await advance(3600000);assert.equal(requests.length,2);
assert.equal(timers.size,0);
await unmount();
`);
});

test('useApps pauses hidden-document refresh and reads overdue data after becoming visible',async()=>{
  await checkHook(`
document.hidden=true;
await mount(packet(binding('products',1000)));
await advance(2000);assert.equal(requests.length,0);
await visibility(false);await advance(1);
assert.equal(requests.length,1);
assert.deepEqual(requests[0].args,[['products'],{forceRefresh:false}]);
await settle(0,packet(binding('products',1000)));
await visibility(true);await advance(5000);
assert.equal(requests.length,1);
await visibility(false);await advance(1);
assert.equal(requests.length,2);
await unmount();
`);
});

test('useApps does not overlap automatic refreshes while a read is in flight',async()=>{
  await checkHook(`
await mount(packet(binding('products',1000)));
await advance(1000);assert.equal(requests.length,1);
await advance(30000);assert.equal(requests.length,1);
await visibility(true);await visibility(false);await advance(1);
assert.equal(requests.length,1);
const refreshed=packet(binding('products',2000));
await settle(0,refreshed);
assert.deepEqual(api.data,refreshed);
await advance(1999);assert.equal(requests.length,1);
await advance(1);assert.equal(requests.length,2);
await unmount();
await settle(1,packet(binding('products',1000)));
assert.equal(timers.size,0,'a response after unmount must not start another timer');
`);
});

for(const method of ['refresh','readBindingPage'] as const){
  test(`useApps defers automatic refresh while a manual ${method} request is in flight`,async()=>{
    await checkHook(`
await mount(packet(binding('products',1000)));
let result;
await act(async()=>{result=api.${method}(${method==='refresh' ? "['products']" : "'products','next-page'"});});
assert.equal(requests.length,1);
await advance(30000);assert.equal(requests.length,1);
await visibility(true);await visibility(false);await advance(1);
assert.equal(requests.length,1);
const refreshed=packet(binding('products',1000));
await act(async()=>{requests[0].resolve(refreshed);await result;});
assert.deepEqual(api.data,refreshed);
await advance(1000);assert.equal(requests.length,2);
assert.deepEqual(requests[1].args,[['products'],{forceRefresh:false}]);
await unmount();
`);
  });
}

test('useApps resumes automatic refresh after an older overlapping manual request finishes last',async()=>{
  await checkHook(`
await mount(packet(binding('products',1000)));
let old,newer;
await act(async()=>{old=api.refresh(['products']);newer=api.readBindingPage('products','next-page');});
assert.equal(requests.length,2);
const latest=packet(binding('products',1000));
await act(async()=>{requests[1].resolve(latest);await newer;});
assert.deepEqual(api.data,latest);
await advance(2000);assert.equal(requests.length,2);
await act(async()=>{requests[0].resolve(packet(binding('old',60000)));await old;});
assert.deepEqual(api.data,latest,'late manual completion must not replace current data');
await advance(1);assert.equal(requests.length,3,'last in-flight completion should resume overdue refresh');
assert.deepEqual(requests[2].args,[['products'],{forceRefresh:false}]);
await unmount();
`);
});

test('useApps keeps successful data and a visible error after automatic failure, then backs off',async()=>{
  await checkHook(`
const initial=packet(binding('products',1000));
await mount(initial);await advance(1000);
assert.equal(requests.length,1);
const failure=Error('temporary provider failure');
await act(async()=>{requests[0].reject(failure);});
assert.deepEqual(api.data,initial);
assert.equal(api.error?.message,failure.message);
assert.equal(api.loading,false);
const failedAt=now;
await visibility(true);await visibility(false);
await advance(4999);assert.equal(requests.length,1,'visibility must not bypass failure backoff');
assert.equal(api.error?.message,failure.message);
const nextAt=Math.min(...[...timers.values()].map(timer=>timer.at));
assert.ok(Number.isFinite(nextAt),'a failed automatic read should schedule a retry');
assert.ok(nextAt>=failedAt+5000,'automatic retries must wait at least five seconds');
await advance(nextAt-now);assert.equal(requests.length,2);
assert.deepEqual(requests[1].args,[['products'],{forceRefresh:false}]);
const refreshed=packet(binding('products',60000));
await settle(1,refreshed);
assert.deepEqual(api.data,refreshed);assert.equal(api.error,undefined);
await unmount();
`);
});

test('useApps backs off when an automatic read returns an already expired payload',async()=>{
  await checkHook(`
const initial=packet(binding('products',1000));
await mount(initial);await advance(1000);
assert.equal(requests.length,1);
const completedAt=now;
await settle(0,initial);
assert.deepEqual(api.data,initial);assert.equal(api.loading,false);
await advance(4999);assert.equal(requests.length,1);
const nextAt=Math.min(...[...timers.values()].map(timer=>timer.at));
assert.ok(Number.isFinite(nextAt),'unchanged expired data should still schedule a later retry');
assert.ok(nextAt>=completedAt+5000,'an unchanged expired payload must not create an immediate read loop');
await advance(nextAt-now);assert.equal(requests.length,2);
await unmount();
`);
});

test('useApps exposes a resolved binding error while retaining cached business data',async()=>{
  await checkHook(`
const initial=packet(binding('products',1000));
await mount(initial);await advance(1000);
const unavailable=packet({...binding('products',10000,true),state:'error',error:{code:'PROVIDER_BUSY',message:'provider is temporarily unavailable'}});
await settle(0,unavailable);
assert.equal(api.error?.message,'provider is temporarily unavailable');
assert.deepEqual(api.data.bindings[0].payload.items,initial.bindings[0].payload.items);
assert.equal(api.data.bindings[0].payload.cache.stale,true);
assert.equal(api.loading,false);
await advance(9999);assert.equal(requests.length,1,'binding errors must honor the provider future retry deadline');
await advance(1);assert.equal(requests.length,2);
assert.deepEqual(requests[1].args,[['products'],{forceRefresh:false}]);
await settle(1,packet(binding('products',60000)));
assert.equal(api.error,undefined);
await unmount();
`);
});

test('useApps exposes initial and pushed binding errors and clears them after recovery',async()=>{
  await checkHook(`
const initial=packet({...binding('products',60000,true),state:'unavailable',error:{code:'PROVIDER_BUSY',message:'initial provider failure'}});
await mount(initial);
assert.equal(api.error?.message,'initial provider failure');
assert.deepEqual(api.data,initial);
const recovered=packet(binding('products',60000));
await act(async()=>{subscriber({event:'data',data:recovered});});
assert.equal(api.error,undefined);assert.deepEqual(api.data,recovered);
const pushed=packet({...binding('products',60000,true),state:'failed',error:{code:'PROVIDER_BUSY',message:'pushed provider failure'}});
await act(async()=>{subscriber({event:'data',data:pushed});});
assert.equal(api.error?.message,'pushed provider failure');
assert.deepEqual(api.data.bindings[0].payload.items,recovered.bindings[0].payload.items);
await act(async()=>{subscriber({event:'context',data:{contextRevision:2}});});
assert.equal(api.error?.message,'pushed provider failure','a context event must not erase a data failure');
await act(async()=>{subscriber({event:'data',data:recovered});});
assert.equal(api.error,undefined);
await unmount();
`);
});

for(const state of ['failed','unavailable'] as const){
  test(`useApps retains the current page after refresh becomes ${state} only for the same dataset`,async()=>{
    await checkHook(`
const page=(datasetId,cursor,after)=>{
  const base=binding('products',after);
  return {...base,datasetId,revision:datasetId+'-'+cursor,
    resources:[{resourceId:datasetId+'-'+cursor}],query:{input:{storeId:datasetId,cursor}},lastSuccessAt:new Date().toISOString(),
    payload:{...base.payload,items:[{id:datasetId+'-'+cursor}],cursor,total:40,
      cache:{...base.payload.cache,fetchedAt:new Date(now-(cursor==='first'?60000:30000)).toISOString(),expiresAt:base.payload.cache.nextRefreshAt}}};
};
const first=page('shop-a','first',60000);
await mount(packet(first));
let read;
await act(async()=>{read=api.readBindingPage('products','second');});
const second=page('shop-a','second',1000);
await act(async()=>{requests[0].resolve(packet(second));await read;});
assert.deepEqual(api.data.bindings[0],second);
let refreshed;
await act(async()=>{refreshed=api.refresh(['products']);});
const failed={...first,state:'${state}',error:{code:'PROVIDER_BUSY',message:'refresh failed'},
  payload:{...first.payload,cache:{stale:true,fetchedAt:new Date().toISOString(),expiresAt:new Date(now+10000).toISOString(),nextRefreshAt:new Date(now+10000).toISOString()}}};
await act(async()=>{requests[1].resolve(packet(failed));await refreshed;});
const retained=api.data.bindings[0];
assert.equal(api.error?.message,'refresh failed');assert.equal(retained.state,'${state}');
assert.deepEqual(retained.payload.items,second.payload.items,'a failed refresh must not send the user back to the first page');
assert.equal(retained.payload.cursor,second.payload.cursor);
assert.equal(retained.payload.cache.fetchedAt,second.payload.cache.fetchedAt,'cached rows must retain their actual fetch time');
assert.equal(retained.payload.cache.expiresAt,second.payload.cache.expiresAt,'cached rows must retain their original expiry');
assert.equal(retained.payload.cache.nextRefreshAt,failed.payload.cache.nextRefreshAt);
assert.equal(retained.payload.cache.stale,true);
assert.deepEqual(retained.resources,second.resources);
assert.equal(retained.revision,second.revision);
assert.deepEqual(retained.query,second.query);
assert.equal(retained.lastSuccessAt,second.lastSuccessAt);
await advance(9999);
assert.equal(requests.length,2,'retaining page data must still respect the failed response provider retry deadline');
await act(async()=>{refreshed=api.refresh(['products']);});
const otherShop={...page('shop-b','first',60000),state:'${state}',payload:null,resources:[],error:{code:'PROVIDER_BUSY',message:'new shop unavailable'}};
await act(async()=>{requests[2].resolve(packet(otherShop));await refreshed;});
assert.deepEqual(api.data,packet(otherShop),'a different dataset must never retain the previous shop payload or page metadata');
assert.equal(api.error?.message,'new shop unavailable');
await unmount();
`);
  });
}

test('useApps replaces obsolete TTL timers after a host data event and clears them on unmount',async()=>{
  await checkHook(`
await mount(packet(binding('products',1000)));
const next=packet(binding('products',10000));
await act(async()=>{subscriber({event:'data',data:next});});
await advance(1000);assert.equal(requests.length,0);
assert.deepEqual(api.data,next);
assert.ok(timers.size>0);
await unmount();
assert.equal(disposed,1);
assert.equal(timers.size,0,'unmount must clear automatic refresh timers');
assert.equal(documentListeners.get('visibilitychange')?.size??0,0);
await visibility(true);await visibility(false);await advance(60000);
assert.equal(requests.length,0);
`);
});

for(const delivery of ['event','page','refresh'] as const){
  test(`useApps retains the successful page when ${delivery} returns a rate limited empty payload`,async()=>{
    await checkHook(`
const initial={...binding('products',1000),datasetId:'shop-a',revision:'page-2',resources:[{resourceId:'product-21'}],
  query:{input:{storeId:'shop-a',cursor:'second'}},lastSuccessAt:new Date(now-30000).toISOString(),
  payload:{items:[{id:'product-21'}],cursor:'second',total:40,cache:{fetchedAt:new Date(now-30000).toISOString(),expiresAt:new Date(now+1000).toISOString(),nextRefreshAt:new Date(now+1000).toISOString(),stale:false}}};
await mount(packet(initial));
const failed={...initial,state:'unavailable',payload:null,resources:[],revision:null,lastSuccessAt:null,
  query:{input:{storeId:'shop-a',cursor:'third'}},error:{code:'LOCAL_RATE_LIMIT',message:'try later',retryPolicy:'read_retry',retryAfterMs:60000}};
${delivery==='event'?"await act(async()=>{subscriber({event:'data',data:packet(failed)});});":`let result;await act(async()=>{result=api.${delivery==='page'?'readBindingPage(\'products\',\'third\')':"refresh(['products'])"};});await act(async()=>{requests[0].resolve(packet(failed));await result;});`}
const retained=api.data.bindings[0];
assert.deepEqual(retained.payload.items,initial.payload.items);assert.equal(retained.payload.cursor,'second');
assert.deepEqual(retained.query,initial.query);assert.deepEqual(retained.resources,initial.resources);
assert.equal(retained.revision,initial.revision);assert.equal(retained.lastSuccessAt,initial.lastSuccessAt);
assert.equal(retained.payload.cache.fetchedAt,initial.payload.cache.fetchedAt);assert.equal(retained.payload.cache.expiresAt,initial.payload.cache.expiresAt);
assert.equal(retained.payload.cache.nextRefreshAt,new Date(now+60000).toISOString());assert.equal(retained.payload.cache.stale,true);
assert.equal(api.error?.message,'try later');assert.equal(api.loading,false);
const count=requests.length;await advance(59999);assert.equal(requests.length,count);await advance(1);assert.equal(requests.length,count+1);
await settle(count,packet({...initial,payload:{...initial.payload,cache:{...initial.payload.cache,nextRefreshAt:new Date(now+180000).toISOString(),stale:false}}}));
assert.equal(api.error,undefined);assert.equal(api.data.bindings[0].payload.cache.stale,false);
await unmount();
`);
  });
}

test('useApps never restores another binding, shop or filter scope from a pushed empty response',async()=>{
  await checkHook(`
const initial={...binding('products',1000),datasetId:'shop-a',query:{input:{storeId:'shop-a',filter:'all',cursor:'second'}}};
await mount(packet(initial));
for(const change of [{datasetId:'shop-b'},{bindingId:'stock'},{query:{input:{storeId:'shop-a',filter:'archived',cursor:'second'}}}]){
  await act(async()=>{subscriber({event:'data',data:packet(initial)});});
  const failed={...initial,...change,state:'unavailable',payload:null,resources:[],error:{code:'LOCAL_RATE_LIMIT',message:'wait',retryPolicy:'read_retry'}};
  await act(async()=>{subscriber({event:'data',data:packet(failed)});});
  assert.deepEqual(api.data,packet(failed));assert.equal(api.error?.message,'wait');
}
await unmount();
`);
});

test('useApps clears cached values when permissions or connection identity become invalid',async()=>{
  await checkHook(`
const initial={...binding('products',1000),datasetId:'shop-a',resources:[{resourceId:'old'}],lastSuccessAt:new Date().toISOString()};
await mount(packet(initial));
for(const error of [{code:'CONNECTION_CONFIG_CHANGED',retryPolicy:'read_retry'},{code:'PERMISSION_DENIED',retryPolicy:'never'},{code:'HALLMARK_HTTP_401',retryPolicy:'read_retry'},{code:'HALLMARK_HTTP_403',retryPolicy:'read_retry'},{code:'PLATFORM_ERROR',retryPolicy:'never'},{code:'PERMANENT_FAILURE',retryPolicy:'never'},{code:'CHECK_STATE',retryPolicy:'inspect_only'}]){
  await act(async()=>{subscriber({event:'data',data:packet(initial)});});
  await act(async()=>{subscriber({event:'data',data:packet({...initial,state:'unavailable',error:{...error,message:'authorization changed'}})});});
  assert.equal(api.data.bindings[0].payload,null);assert.deepEqual(api.data.bindings[0].resources,[]);assert.equal(api.data.bindings[0].lastSuccessAt,null);
  assert.equal(api.error?.message,'authorization changed');
}
await act(async()=>{subscriber({event:'data',data:packet(initial)});});
let result;await act(async()=>{result=api.readBindingPage('products','next').catch(error=>error);});
const denied=Object.assign(Error('denied'),{failure:{code:'PERMISSION_DENIED',message:'denied',retryPolicy:'never'}});
await act(async()=>{requests[0].reject(denied);assert.equal(await result,denied);});
assert.equal(api.data.bindings[0].payload,null);assert.equal(api.error,denied);
await unmount();
`);
});

test('useApps propagates rejected page reads while keeping the visible page and respecting retry delay',async()=>{
  await checkHook(`
const initial={...binding('products',1000),datasetId:'shop-a',query:{input:{cursor:'second'}}};
await mount(packet(initial));
let result;await act(async()=>{result=api.readBindingPage('products','third').catch(error=>error);});
const limited=Object.assign(Error('limited'),{failure:{code:'LOCAL_RATE_LIMIT',message:'limited',retryPolicy:'read_retry',retryAfterMs:60000}});
await act(async()=>{requests[0].reject(limited);assert.equal(await result,limited);});
assert.deepEqual(api.data,packet(initial));assert.equal(api.error,limited);assert.equal(api.loading,false);
await advance(59999);assert.equal(requests.length,1);await advance(1);assert.equal(requests.length,2);
await unmount();
`);
});

for(const method of ['readBindingPage','refresh'] as const){
  test(`useApps keeps the previous canonical dataset after ${method} changes only cursor and is rate limited`,async()=>{
    await checkHook(`
import {datasetId as canonicalDatasetId} from './packages/app-contracts/src/index.ts';
const originalQuery={appId:'hallmark',connectionId:'shop-connection',capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',projection:['items'],
  input:{storeId:'shop-a',dateFrom:'2026-10-01',dateTo:'2026-10-09',filter:{status:'all'},cursor:'second'}};
const page=query=>({...binding('products',180000),appId:query.appId,connectionId:query.connectionId,datasetId:canonicalDatasetId(query),query,
  revision:'page-two',resources:[{resourceId:'product-21'}],lastSuccessAt:new Date(now-30000).toISOString(),
  payload:{items:[{id:'product-21'}],cursor:'second',cache:{fetchedAt:new Date(now-30000).toISOString(),expiresAt:new Date(now+180000).toISOString(),nextRefreshAt:new Date(now+180000).toISOString(),stale:false}}});
const initial=page(originalQuery);
await mount(packet(initial));
const limited=query=>({...page(query),state:'unavailable',payload:null,resources:[],revision:null,lastSuccessAt:null,
  error:{code:'LOCAL_RATE_LIMIT',message:'try later',retryPolicy:'read_retry',retryAfterMs:60000}});
const request=async()=>{let result;await act(async()=>{result=api.${method}(${method==='readBindingPage'?"'products','third'":"['products']"});});return {result,index:requests.length-1};};
const thirdQuery={...originalQuery,input:{...originalQuery.input,cursor:'third'}};
const failed=limited(thirdQuery);assert.notEqual(failed.datasetId,initial.datasetId,'canonical dataset IDs include cursor');
const attempt=await request();await act(async()=>{requests[attempt.index].resolve(packet(failed));await attempt.result;});
const retained=api.data.bindings[0];
assert.equal(retained.datasetId,initial.datasetId);assert.deepEqual(retained.query,originalQuery);assert.deepEqual(retained.resources,initial.resources);
assert.equal(retained.revision,initial.revision);assert.equal(retained.lastSuccessAt,initial.lastSuccessAt);
assert.deepEqual(retained.payload.items,initial.payload.items);assert.equal(retained.payload.cursor,'second');
assert.equal(retained.payload.cache.fetchedAt,initial.payload.cache.fetchedAt);assert.equal(retained.payload.cache.expiresAt,initial.payload.cache.expiresAt);
assert.equal(retained.payload.cache.nextRefreshAt,new Date(now+60000).toISOString());assert.equal(api.error?.message,'try later');
// A pushed event has no evidence that its new dataset is an attempted page read.
await act(async()=>{subscriber({event:'data',data:packet(failed)});});assert.deepEqual(api.data,packet(failed));
// Every non-page query change prevents fallback, even when the same API performs it.
for(const query of [
  {...thirdQuery,input:{...thirdQuery.input,storeId:'shop-b'}},
  {...thirdQuery,input:{...thirdQuery.input,dateFrom:'2026-09-01'}},
  {...thirdQuery,input:{...thirdQuery.input,dateTo:'2026-10-08'}},
  {...thirdQuery,input:{...thirdQuery.input,filter:{status:'archived'}}},
  {...thirdQuery,connectionId:'different-connection'},
  {...thirdQuery,capabilityId:'hallmark.ozon.orders'},
  {...thirdQuery,capabilityVersion:'2.0.0'},
  {...thirdQuery,projection:['other']},
  {...thirdQuery,input:{...thirdQuery.input,pageToken:'unknown-pagination-field'}}
]){
  await act(async()=>{subscriber({event:'data',data:packet(initial)});});
  const changed=limited(query),pending=await request();
  await act(async()=>{requests[pending.index].resolve(packet(changed));await pending.result;});
  assert.deepEqual(api.data,packet(changed),'a changed query scope must not restore the previous page');
}
// Without the complete BindingQuery descriptor, a different dataset stays isolated.
await act(async()=>{subscriber({event:'data',data:packet(initial)});});
const incomplete={...failed,query:{input:thirdQuery.input}},pending=await request();
await act(async()=>{requests[pending.index].resolve(packet(incomplete));await pending.result;});assert.deepEqual(api.data,packet(incomplete));
await unmount();
`);
  });
}
