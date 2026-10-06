import test from 'node:test';
import assert from 'node:assert/strict';
import {listenAppServer} from '../../packages/service/src/server.ts';
import {assertJsonCompatible} from '../../packages/contracts/src/json.ts';
import {SessionViewError} from '../../packages/core/src/views.ts';

test('session list-management HTTP routes validate scope and actions and do not dispatch saved-config or business writes',async()=>{
 const token='a'.repeat(64);const calls:any[]=[];let writes=0;
 const server=await listenAppServer({token,port:0,health:async()=>({}),store:{get:()=>undefined,put:(_c,_i,v)=>{writes++;return v;},list:()=>[]},presentation:{getView:()=>undefined,getViewData:()=>({})},core:{invoke:async()=>{writes++;return {status:'ok'};},refreshDataset:async()=>{writes++;return {status:'ok'};},manageSessionView:(sid,id,change)=>{if(sid!=='session-A'||id!=='owned')throw new SessionViewError('VIEW_NOT_OWNED','Not owned');calls.push({sid,id,change});return {sessionId:sid,viewId:id,...change};}}});
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const post=(path:string,input:any,authorized=true)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(input)});
 try{
  const path='/sessions/session-A/views/owned';assert.equal((await post(path,{action:'remove'},false)).status,401);
  for(const input of [{action:'delete'},{action:'rename'},{action:'rename',title:''},{action:'rename',title:'a'.repeat(201)},{action:'remove',title:'extra'},{action:'remove',sessionId:'other'},{action:'remove',kind:'component'}])assert.equal((await post(path,input)).status,400);
  assert.equal((await post(path+'?all=true',{action:'remove'})).status,400);assert.equal((await post(path+'/data',{action:'remove'})).status,404);assert.equal((await post('/sessions/session-B/views/owned',{action:'remove'})).status,404);assert.equal((await post('/sessions/session-A/views/missing',{action:'rename',title:'Other'})).status,404);assert.equal(calls.length,0);
  assert.equal((await post(path,{action:['remove']})).status,400);assert.equal((await post(path,{action:'rename',title:'Name'})).status,200);assert.equal((await post(path,{action:'remove'})).status,200);
  assert.deepEqual(calls,[{sid:'session-A',id:'owned',change:{action:'rename',title:'Name'}},{sid:'session-A',id:'owned',change:{action:'remove'}}]);assert.equal(writes,0);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('authenticated session-component routes are owned, read-only and independent of chat activation',async()=>{
 const token='f'.repeat(64);let business=0,globalViews=0,storesWritten=0;
 const spec={id:'owned-view',title:'Synthetic text component',layout:{type:'column',children:['text']},widgets:[{id:'text',type:'text',text:'isolated fixture'}],bindings:[]};
 const metadata={viewId:spec.id,title:spec.title,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',state:'ready'};
 const server=await listenAppServer({token,port:0,health:async()=>({status:'unavailable'}),store:{get:()=>undefined,put:(_collection,_id,value)=>{storesWritten++;return value;},list:()=>[]},presentation:{getView:()=>{globalViews++;return spec;},getViewData:()=>{globalViews++;return {}; }},core:{invoke:async()=>{business++;return {status:'failed'};},refreshDataset:async()=>{business++;return {status:'failed'};},listSessionViews:sid=>({sessionId:sid,views:sid==='session-A'?[metadata]:[]}),getSessionView:(sid,id)=>sid==='session-A'&&id===spec.id?spec:undefined,getSessionViewData:(sid,id)=>sid==='session-A'&&id===spec.id?{status:'ok',data:{viewId:id,bindings:[],missing:[]}}:undefined}});
 const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
 const request=(path:string,options:RequestInit={})=>fetch(base+path,{...options,headers:{authorization:`Bearer ${token}`,...options.headers}});
 try{
  assert.equal((await fetch(base+'/sessions/session-A/views')).status,401);
  const listing=await request('/sessions/session-A/views');assert.equal(listing.status,200);const data=await listing.json();assertJsonCompatible(data);assert.deepEqual(data,{sessionId:'session-A',views:[metadata]});
  assert.deepEqual(await (await request('/sessions/session-B/views')).json(),{sessionId:'session-B',views:[]});
  assert.deepEqual(await (await request('/sessions/session-A/views/owned-view')).json(),spec);
  assert.equal((await request('/sessions/session-A/views/owned-view/data')).status,200);
  assert.equal((await request('/sessions/session-B/views/owned-view')).status,404);
  assert.equal((await request('/sessions/session-B/views/owned-view/data')).status,404);
  assert.equal((await request('/sessions/session-A/views?all=true')).status,400);
  assert.equal((await request('/sessions/session-A/views',{method:'POST'})).status,404);
  assert.equal(business,0);assert.equal(globalViews,0);assert.equal(storesWritten,0);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
