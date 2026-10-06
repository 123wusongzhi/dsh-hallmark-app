import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {readFileSync} from 'node:fs';
import {createAppServer} from '../../packages/service/src/server.ts';
import {SERVICE_IDENTITY} from '../../packages/service/src/version.ts';
import {HOST_PLUGIN_VERSION} from '../../packages/dsh-plugin/server/version.ts';
import {AppStore} from '../../packages/store/index.ts';
import {SnapshotScheduler} from '../../packages/service/src/scheduler.ts';
const token='a'.repeat(64);
async function setup() {
 const store=new AppStore(':memory:'); let calls=0;
 const core={invoke:async()=>{calls++;return {status:'ok' as const,data:{calls}};},refreshDataset:async()=>({status:'pending' as const})};
 const server=createAppServer({token,store,core,presentation:{getView:()=>({id:'v'}),getViewData:()=>({status:'ok'})},health:async()=>({status:'unavailable'})});
 server.listen(0,'127.0.0.1'); await once(server,'listening'); const port=(server.address() as any).port;
 const base=`http://127.0.0.1:${port}`;
 return {store,server,base,close:async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));store.close();},calls:()=>calls};
}
test('all routes authenticate and reject external Origin/Host',async()=>{
 const s=await setup();try{
 assert.equal((await fetch(s.base+'/health')).status,401);
 assert.equal((await fetch(s.base+'/health',{headers:{authorization:`Bearer ${token}`,origin:'https://evil.invalid'}})).status,403);
 const badHost = await new Promise<number | undefined>((resolve,reject)=>{const req=request(s.base+'/health',{headers:{authorization:`Bearer ${token}`,host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 assert.equal(badHost,403);
 const health=await fetch(s.base+'/health',{headers:{authorization:`Bearer ${token}`}});assert.equal(health.status,200);assert.equal((await health.json()).hallmark.status,'unavailable');
 }finally{await s.close();}
});
test('health identifies the loaded service release and actual exposed tool catalog independently of source availability',async()=>{
 const s=await setup();const headers={authorization:`Bearer ${token}`};
 try{
  const response=await fetch(s.base+'/health',{headers});assert.equal(response.status,200);const health=await response.json();
  const tools=await fetch(s.base+'/tools',{headers}).then(response=>response.json());
  const manifest=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  const plugin=JSON.parse(readFileSync(new URL('../../packages/dsh-plugin/package.json',import.meta.url),'utf8'));
  assert.deepEqual(health,{status:'ok',service:manifest.name,version:manifest.version,toolCount:tools.tools.length,hallmark:{status:'unavailable'}});
  // UI-only plugin releases do not require restarting the independent service.
  assert.equal(health.version,SERVICE_IDENTITY.version);assert.equal(HOST_PLUGIN_VERSION,plugin.version);
  assert.ok(tools.tools.some((tool:{name:string})=>tool.name==='hallmark_get_category_data'));
  assert.equal(health.toolCount,SERVICE_IDENTITY.toolCount);assert.ok(Object.isFrozen(SERVICE_IDENTITY));
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(s.calls(),0);
 }finally{await s.close();}
});
test('trusted session activation required and tool argument schema enforced',async()=>{
 const s=await setup(); const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
 try{
 let response=await fetch(s.base+'/tools/hallmark_list_stores',{method:'POST',headers,body:JSON.stringify({sessionId:'session-a',arguments:{}})}); assert.equal((await response.json()).error.code,'APP_NOT_ACTIVE');assert.equal(s.calls(),0);
 response=await fetch(s.base+'/sessions/session-a/app',{method:'POST',headers,body:JSON.stringify({active:true})});assert.equal(response.status,200);
 response=await fetch(s.base+'/tools/hallmark_list_stores',{method:'POST',headers,body:JSON.stringify({sessionId:'session-a',arguments:{url:'https://evil.invalid'}})});assert.equal(response.status,400);assert.equal(s.calls(),0);
 response=await fetch(s.base+'/tools/hallmark_list_stores',{method:'POST',headers,body:JSON.stringify({sessionId:'session-a',arguments:{}})});assert.equal((await response.json()).status,'ok');assert.equal(s.calls(),1);
 response=await fetch(s.base+'/tools/hallmark_list_stores',{method:'POST',headers,body:'['});assert.equal(response.status,400);
 response=await fetch(s.base+'/views/v/data?sessionId=session-b',{headers});assert.equal(response.status,403);
 }finally{await s.close();}
});
test('scheduler operates without open components and never replays operations',async()=>{
 const store=new AppStore(':memory:'); const calls:string[]=[];
 const core={getRefreshCandidates:()=>['store_products:one'],refreshDatasetBackground:async(key:string)=>{calls.push(key);return {status:'ok' as const};}};
 const scheduler=new SnapshotScheduler(core,store); const now=new Date(2026,0,10,8,30);
 try{await scheduler.tick(now);await scheduler.tick(now);assert.deepEqual(calls,['store_products:one']);assert.deepEqual(store.list('operations'),[]);}finally{scheduler.stop();store.close();}
});
