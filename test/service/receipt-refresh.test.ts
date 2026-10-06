import test from 'node:test';
import assert from 'node:assert/strict';
import {listenAppServer} from '../../packages/service/src/server.ts';
test('local receipt refresh works after chat closes but never leaks another session or invokes a tool',async()=>{
 const token='e'.repeat(64);const refreshed:string[]=[];let invoke=0;
 const server=await listenAppServer({token,port:0,health:async()=>({status:'unavailable'}),store:{get:<T>(_table:string,id:string)=>(id==='own-op'?{sessionId:'session-A'}:undefined) as T|undefined,put:(_table,_id,value)=>value,list:()=>[]},presentation:{getView:()=>undefined,getViewData:()=>undefined},core:{invoke:async()=>{invoke++;return{status:'failed'};},refreshDataset:async(key,ctx)=>{refreshed.push(`${ctx.sessionId}:${key}`);return{status:'ok'};}}});
 const address=server.address() as {port:number};const request=(sessionId:string,datasetKey:string)=>fetch(`http://127.0.0.1:${address.port}/refresh`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({sessionId,datasetKey})});
 try{
  assert.equal((await request('session-B','operation:own-op')).status,404);assert.equal((await request('session-A','operation:missing')).status,404);assert.equal(refreshed.length,0);
  assert.equal((await request('session-A','operation:own-op')).status,200);assert.deepEqual(refreshed,['session-A:operation:own-op']);
  assert.equal((await (await request('session-A','store_products:x')).json()).error.code,'APP_NOT_ACTIVE');assert.equal(refreshed.length,1);assert.equal(invoke,0);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
