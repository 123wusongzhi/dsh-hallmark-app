import test from 'node:test';
import assert from 'node:assert/strict';
import {HallmarkPlugin} from '../../packages/dsh-plugin/server/index.ts';

test('Host session-management POST requires a real native owner and never forwards global deletion fields',async()=>{
 const ctx={agents:{get:()=>undefined},sessions:{get:(id:string)=>id==='session-A'?{id}:undefined}};
 const plugin=new HallmarkPlugin(ctx as any,{dataDirectory:process.cwd()});const calls:any[]=[];
 plugin.client.request=async(path,body)=>{calls.push({path,body});return {sessionId:'session-A',viewId:'owned',action:(body as any).action};};
 const request=(input:any)=>plugin.ui(new Request('http://fixture.test/api/hallmark-app',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
 try{
  const valid={action:'manageSessionView',sessionId:'session-A',viewId:'owned',operation:'remove'};
  for(const input of [{...valid,sessionId:undefined},{...valid,sessionId:'unknown'},{...valid,operation:'delete'},{...valid,kind:'component'},{...valid,title:'not allowed'},{...valid,operation:'rename',title:''},{...valid,operation:'rename',title:'x'.repeat(201)},{...valid,viewId:'../other'}])assert.equal((await request(input)).status,400);
  assert.equal((await request({...valid,operation:['remove']})).status,400);assert.equal(calls.length,0);assert.equal((await request(valid)).status,200);assert.equal((await request({...valid,operation:'rename',title:'Local name'})).status,200);
  assert.deepEqual(calls,[{path:'/sessions/session-A/views/owned',body:{action:'remove'}},{path:'/sessions/session-A/views/owned',body:{action:'rename',title:'Local name'}}]);assert.equal(plugin.cache.size,0);
 }finally{await plugin.dispose();}
});
test('Host component bridge validates explicit session and forwards only scoped read endpoints',async()=>{
 const ctx={agents:{get:()=>undefined},sessions:{get:(id:string)=>id==='session-A'?{id}:undefined}};
 const plugin=new HallmarkPlugin(ctx as any,{dataDirectory:process.cwd()});const reads:string[]=[];
 plugin.client.request=async(path,body)=>{assert.equal(body,undefined);reads.push(path);return path.endsWith('/views')?{sessionId:'session-A',views:[]}:{status:'ok'};};
 const request=(query:string)=>plugin.ui(new Request('http://fixture.test/api/hallmark-app?'+query));
 try{
  assert.equal((await request('resource=sessionViews')).status,400);
  assert.equal((await request('resource=sessionViews&sessionId=made-up')).status,400);
  assert.equal((await request('resource=sessionViews&sessionId=session-A&viewId=ignored')).status,400);
  assert.equal((await request('resource=sessionView&sessionId=session-A')).status,400);
  assert.equal(reads.length,0);
  assert.equal((await request('resource=sessionViews&sessionId=session-A')).status,200);
  assert.equal((await request('resource=sessionView&sessionId=session-A&viewId=owned-view')).status,200);
  assert.equal((await request('resource=sessionViewData&sessionId=session-A&viewId=owned-view')).status,200);
  assert.deepEqual(reads,['/sessions/session-A/views','/sessions/session-A/views/owned-view','/sessions/session-A/views/owned-view/data']);
  assert.equal(plugin.cache.size,0); // Read-only history does not auto-activate chat.
 }finally{await plugin.dispose();}
});
